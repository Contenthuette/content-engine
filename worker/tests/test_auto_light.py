"""auto_light: good footage untouched, dark brightened, warm casts left alone, cold casts never pushed colder."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import auto_light as al  # noqa: E402

GOOD = {"mean": 0.45, "p1": 0.05, "p50": 0.45, "p99": 0.92, "r": 0.8, "g": 0.8, "b": 0.74, "sr": 0.15, "sg": 0.15, "sb": 0.15}


def test_good_footage_untouched():
    assert al.correction(GOOD) is None


def test_dark_gets_brighter():
    st = {**GOOD, "mean": 0.22, "p50": 0.19, "p99": 0.6}
    c = al.correction(st)
    assert c and "heller" in c["notes"] and "gamma=1." in c["filter"]


def test_warm_room_not_cooled():
    st = {**GOOD, "r": 0.85, "g": 0.75, "b": 0.6}
    c = al.correction(st)
    assert c is None or "weißabgleich" not in c["notes"]


def test_cold_cast_corrected_towards_warm():
    st = {**GOOD, "r": 0.6, "g": 0.66, "b": 0.78}
    c = al.correction(st)
    assert c and "weißabgleich" in c["notes"] and "bm=-" in c["filter"]
