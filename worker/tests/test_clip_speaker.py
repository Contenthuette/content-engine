"""CLIPPERZ Pro reframe: active speaker choice (clipperz_reframe.decide / person_parts / track).

Run:  python3 -m pytest worker/tests -q
Synthetic face + audio series (10 samples/s), no video. Face tuple: (cx, cy, w, h, score, front, track id, mouth activity).
"""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import clipperz_reframe as rf  # noqa: E402

CW = (1080 * 9 / 16) / 1920  # 9:16 window of a 1080p frame (0.316 of the width)
A = (0.40, 0.35, 0.06, 0.12)  # two people close together (both fit into 9:16)
B = (0.52, 0.35, 0.06, 0.12)
FAR = (0.85, 0.35, 0.06, 0.12)  # too far from A for one 9:16 window


def face(pos, tid, act, front=True, score=0.9):
    return (pos[0], pos[1], pos[2], pos[3], score, front, tid, act)


def series(dur, who, voiced=lambda t: True, rng=None):
    """who(t) -> list of faces at time t. Returns samples [(t, faces, thumb)] and voice flags."""
    rng = rng or np.random.default_rng(1)
    ss, vs = [], []
    for k in range(int(dur * 10)):
        t = round(k / 10, 2)
        ss.append((t, who(t, rng), None))
        vs.append(voiced(t))
    return ss, vs


def talk(on, rng):
    """Mouth activity: talking ~2.5 (noisy), silent ~0.3."""
    return float(max(0.0, rng.normal(2.6, 0.6) if on else rng.normal(0.3, 0.15)))


def run(ss, vs, dur, pos_b=B):
    wins = rf.windows(ss, vs, dur)
    return rf.decide(wins, CW, dur)


def modes(segs):
    return [(round(a, 1), round(b, 1), m, t) for a, b, m, t in segs]


def time_of(segs, mode, tid=None):
    return sum(b - a for a, b, m, t in segs if m == mode and (tid is None or t == tid))


def test_follows_the_speaker():
    dur = 12.0
    ss, vs = series(dur, lambda t, r: [face(A, 1, talk(t < 6, r)), face(FAR, 2, talk(t >= 6, r))])
    segs = run(ss, vs, dur)
    assert [m for _, _, m, _ in segs] == ["track", "track"], modes(segs)
    assert segs[0][3] == 1 and segs[1][3] == 2
    assert 6.0 <= segs[1][0] <= 7.2, modes(segs)  # switch shortly after B starts (0.8 s confirmation)


def test_no_ping_pong_on_a_short_interjection():
    """B says one word (0.4 s) while A talks: the camera stays on A."""
    dur = 10.0
    ss, vs = series(dur, lambda t, r: [face(A, 1, talk(not 4.0 <= t < 4.4, r)), face(FAR, 2, talk(4.0 <= t < 4.4, r))])
    segs = run(ss, vs, dur)
    assert len(segs) == 1 and segs[0][2] == "track" and segs[0][3] == 1, modes(segs)


def test_min_hold_on_a_speaker():
    """Every track segment lasts >= 1.2 s, even when the speaker changes every second."""
    dur = 10.0
    ss, vs = series(dur, lambda t, r: [face(A, 1, talk(int(t) % 2 == 0, r)), face(FAR, 2, talk(int(t) % 2 == 1, r))])
    segs = run(ss, vs, dur)
    assert all(b - a >= rf.HOLD_MIN - 1e-6 for a, b, m, _ in segs[:-1]), modes(segs)


def test_fast_dialogue_shows_both():
    """Back-and-forth every 0.8 s between two frontal people next to each other -> group, not ping-pong."""
    dur = 12.0
    ss, vs = series(dur, lambda t, r: [face(A, 1, talk(int(t / 0.8) % 2 == 0, r)), face(B, 2, talk(int(t / 0.8) % 2 == 1, r))])
    segs = run(ss, vs, dur)
    assert time_of(segs, "group") >= 0.6 * dur, modes(segs)


def test_fast_dialogue_far_apart_goes_wide():
    dur = 12.0
    ss, vs = series(dur, lambda t, r: [face(A, 1, talk(int(t / 0.8) % 2 == 0, r)), face(FAR, 2, talk(int(t / 0.8) % 2 == 1, r))])
    segs = run(ss, vs, dur)
    assert time_of(segs, "wide") >= 0.5 * dur, modes(segs)


def test_group_only_when_nobody_clearly_speaks():
    dur = 8.0
    quiet = series(dur, lambda t, r: [face(A, 1, talk(False, r)), face(B, 2, talk(False, r))])
    segs = run(*quiet, dur)
    assert [m for _, _, m, _ in segs] == ["group"], modes(segs)
    one = series(dur, lambda t, r: [face(A, 1, talk(True, r)), face(B, 2, talk(False, r))])
    segs = run(*one, dur)
    assert [m for _, _, m, _ in segs] == ["track"] and segs[0][3] == 1, modes(segs)


def test_group_needs_two_frontal_faces():
    """One frontal face + one profile, nobody speaks -> the frontal person, not the group."""
    dur = 8.0
    ss, vs = series(dur, lambda t, r: [face(A, 1, 0.2), face(B, 2, 0.2, front=False)])
    segs = run(ss, vs, dur)
    assert [m for _, _, m, _ in segs] == ["track"] and segs[0][3] == 1, modes(segs)


def test_back_to_camera_is_never_the_main_subject():
    """A turns around at 3 s (no face found any more), nobody else shows a face -> the whole scene (wide), at most
    ~1 s later; never a crop on a person without a face."""
    dur = 10.0
    ss, vs = series(dur, lambda t, r: [face(A, 1, talk(True, r))] if t < 3 else [])
    segs = run(ss, vs, dur)
    assert segs[0][2] == "track" and segs[-1][2] == "wide", modes(segs)
    assert segs[-1][0] <= 3 + rf.LOST + 0.45, modes(segs)


def test_turned_away_speaker_hands_over_to_the_visible_face():
    """The speaker A turns away (face gone), B is in the picture with a face -> camera goes to B, not to A's back."""
    dur = 10.0
    ss, vs = series(dur, lambda t, r: ([face(A, 1, talk(True, r))] if t < 4 else []) + [face(FAR, 2, talk(False, r))])
    segs = run(ss, vs, dur)
    assert segs[0][3] == 1 and segs[-1][3] == 2 and segs[-1][0] <= 4 + rf.LOST + 0.45, modes(segs)


def test_flickering_face_is_not_followed():
    """A face found only in 1 of 5 samples (a head seen from behind now and then) never becomes the target."""
    dur = 8.0
    ss, vs = series(dur, lambda t, r: [face(A, 1, 2.5)] if int(round(t * 10)) % 5 == 0 else [])
    segs = run(ss, vs, dur)
    assert time_of(segs, "track") == 0 and time_of(segs, "wide") == dur, modes(segs)


def test_short_detection_gaps_keep_the_person():
    """YuNet misses a frontal face for 0.3 s now and then: the camera stays (no wide flash)."""
    dur = 10.0
    ss, vs = series(dur, lambda t, r: [] if 0.0 <= (t % 2.0) < 0.3 and t > 1 else [face(A, 1, talk(True, r))])
    segs = run(ss, vs, dur)
    assert [m for _, _, m, _ in segs] == ["track"], modes(segs)


def test_wide_part_lasts_at_least_two_seconds():
    dur = 12.0
    ss, vs = series(dur, lambda t, r: [] if 3 <= t < 4.6 else [face(A, 1, talk(True, r))])
    segs = run(ss, vs, dur)
    for a, b, m, _ in segs[:-1]:
        if m == "wide":
            assert b - a >= rf.WIDE_MIN - 1e-6, modes(segs)


def test_no_voice_no_switch():
    """B's mouth moves (chewing, laughing silently) while there is no voice: no speaker switch."""
    dur = 10.0
    ss, vs = series(dur, lambda t, r: [face(A, 1, talk(t < 3, r)), face(FAR, 2, talk(t >= 3, r))], voiced=lambda t: t < 3)
    segs = run(ss, vs, dur)
    assert all(t == 1 for _, _, m, t in segs if m == "track"), modes(segs)


def test_person_parts_log_and_layouts():
    dur = 12.0
    ss, vs = series(dur, lambda t, r: [face(A, 1, talk(t < 6, r)), face(FAR, 2, talk(t >= 6, r))])
    parts, ms, switches = rf.person_parts(ss, vs, dur, CW)
    assert switches == 1
    assert len(parts) == 1 and parts[0][2]["layout"] == "track"  # one crop chain, the window moves
    xs = [x for _, _, x in parts[0][2]["segs"]]
    assert abs(xs[0] - A[0]) < 0.05 and abs(xs[-1] - FAR[0]) < 0.05


def test_x_expr_soft_pan_and_cut():
    e = rf.x_expr([(0, 2, 0.40), (2, 4, 0.45), (4, 6, 0.85)], 1920, 608)
    assert "if(lt(t,2.4" in e and "3-2*" in e  # 0.40 -> 0.45: soft pan over 0.4 s
    assert "if(lt(t,4),8" in e or "if(lt(t,4)," in e  # 0.45 -> 0.85 (another person): a cut


def test_track_drops_fake_faces():
    """A weak, motionless 'face' (lamp, poster) is dropped; a real one stays."""
    samples = []
    for k in range(60):
        t = k / 10
        lamp = [0.93, 0.10, 0.1, 0.2, 0.64, True, None, 0.0, None, None]
        real = [0.4, 0.35, 0.06, 0.12, 0.9, True, None, 0.0, None, None]
        samples.append((t, [lamp, real], None))
    out = rf.track(samples)
    left = {round(f[0], 2) for _, fs, _ in out for f in fs}
    assert left == {0.4}


def test_blind_share_counts_crop_without_face():
    s = [(k / 10, [(0.2, 0.3, 0.05, 0.1, 0.9, True, 1, 0.0)], None) for k in range(20)]
    parts = [(0.0, 1.0, {"layout": "track", "segs": [(0.0, 1.0, 0.2)], "w": CW}),
             (1.0, 2.0, {"layout": "track", "segs": [(0.0, 1.0, 0.8)], "w": CW})]
    assert abs(rf.blind_share(s, parts) - 0.5) < 1e-6
    parts[1] = (1.0, 2.0, {"layout": "wide", "segs": [(0.0, 1.0, 0.8)], "w": 0.5})
    assert rf.blind_share(s, parts) == 0.0


def test_faceless_cut_series_is_not_held_on_a_crop():
    """Six short faceless scenes in a row (hard cuts every 1.5 s, 22.10.2026 kitchen stream): no 9:16 crop on nobody
    for longer than 2 s; a single short faceless scene keeps the neighbour's window."""
    rng = np.random.default_rng(3)
    samples = []
    for k in range(240):  # 24 s at 10/s
        t = k / 10
        scene = 0 if t < 8 else 1 + int((t - 8) / 1.5) if t < 17 else 99
        thumb = np.full((36, 64), 40.0 + 60 * (scene % 3), np.float32)
        faces = [face(A, 1 if t < 8 else 2, talk(True, rng))] if (t < 8 or t >= 17) else []
        samples.append((t, faces, thumb))
    parts, st = rf.plan(samples, [True] * len(samples), 1920, 1080, 24.0)
    for a, b, sc in parts:
        if sc["layout"] in ("track", "group"):
            empty = sum(1 for t, fs, _ in samples if a <= t < b and not fs) / 10
            assert empty <= 2.0, (a, b, sc["layout"], empty)
    assert st["blind"] < 0.15, st


if __name__ == "__main__":
    for k, v in list(globals().items()):
        if k.startswith("test_"):
            v()
            print("ok", k)
