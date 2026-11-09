# EDITZ EDL – contract between the worker and the CLIPPERZ editor

The worker describes every finished EDITZ edit as an **EDL** (edit decision list) on the **source timeline** (the uploaded
video, after rotation/normalisation – same seconds as the original upload). The CLIPPERZ app stores it and shows a
word-based cut editor; a manual revision sends the customer's changes back as `manual`. Field names are fixed – do not rename.

Cut rules live in `worker/cutplan.py` (one place for every path that cuts).

## 1. Done callback (`POST edit-status`, `status: "done"`)

In addition to the existing fields (`resultUrl`, `planUrl`, `assets`, `note`, `stats`) the body carries:

```json
{
  "edl": {
    "v": 1,
    "duration": 34.08,
    "words": [{"s": 0.31, "e": 0.58, "t": "Wir", "keep": true}, …],
    "segments": [[0.21, 3.633], [3.767, 4.867], …]
  },
  "cutCheck": {"ok": true, "fixed": ["Doppelung entfernt: „wir haben wir haben“"], "warnings": []}
}
```

| field | meaning |
|---|---|
| `v` | format version, currently `1` |
| `duration` | length of the source video in seconds |
| `words[]` | **every** spoken word of the source (also the cut ones), in source order. `s`/`e` = word start/end in source seconds, measured on the audio (not Whisper's rough times); `t` = text; `keep` = word is in the finished video. Words never overlap. |
| `segments` | the source ranges that make up the finished video, **in output order** (normally ascending; with the smart cut the hook sentence can come first). They never share source time. Concatenated they are exactly the finished video's speaker track. |

All numbers are rounded to 3 decimals, word text ≤ 60 chars, at most 8,000 words (longer videos get no EDL). The word
**index** (position in `words`) is the key for manual edits.

`cutCheck` (optional, only for edits the worker cut itself): result of the automatic cut check – the finished cut is
re-transcribed and compared with the plan. `fixed` = what the worker repaired automatically (German, short),
`warnings` = what is still suspicious (German, show them to the customer/team), `ok` = no warnings left.

Every successful run sends `edl` – new edits, prompt revisions and manual revisions. The EDL is also stored inside the
saved plan (`planUrl`, key `edl`), so revisions always have it. Prompt corrections that cut
words (`remove`) update it; scene/Regie prompt corrections leave it unchanged. Every revision's done callback carries the
current `edl` again – the app should always store the latest one.

## 2. Manual revision (job payload)

The worker reads the job from `edit-config` (`/clipperz/edit-config`). `manual` comes at the top level **and** as
`revise.manual` (either is enough); `revise.edlUrl` points to the stored EDL JSON the indices refer to (it wins over the copy
inside the plan); `revise.planUrl` may be `null`:

```json
{
  "videoUrl": "…",
  "manual": { … same as below … },
  "revisePrompt": "Schnitt von Hand geändert",
  "revise": {
    "planUrl": "…" | null, "edlUrl": "…", "assets": [ … ],
    "manual": {
      "keep": [true, false, true, …],
      "text": {"12": "korrigierter Text"},
      "pad": {"40": [0.0, 0.15]}
    }
  }
}
```

| field | meaning |
|---|---|
| `keep` | **required**, one bool per word of the stored EDL (`keep.length == edl.words.length`, else the job fails with a German error). |
| `text` | optional, word index → corrected caption text (max 60 chars). `""` = the word leaves the captions and its time goes to the word before (for words Whisper split). The audio is not changed by `text`. |
| `pad` | optional, word index → `[before, after]` seconds, a nudge **on top of** the normal edge/margin rules (+ keeps more, − cuts tighter), clamped to ±2 s. `before` acts when the word is the FIRST word of a kept run, `after` when it is the LAST word of a kept run; otherwise ignored. A nudge never reaches into a neighbouring source word and never past the word's own other edge. |

What the worker does with `manual`:

1. **Skips** the automatic cut and every Claude cut/text decision – the prompt (`revisePrompt`, „Schnitt von Hand geändert“) is
   ignored, no model call.
2. Loads the original video again (`revise.videoUrl` if given, else the edit's `videoUrl` from edit-config) and checks that its
   length matches `edl.duration` (± 0.5 s).
3. Builds the segments from the kept words with the same rules as the automatic cut (below). The original block order is kept
   (a smart-cut hook stays first); a newly kept word joins the block of the word before it.
4. Re-renders the **same style**: captions/emphasis/colours, zooms, B-roll, text beats, SFX and hook move with the new
   timeline (elements inside removed parts disappear); scene styles (Minimal/Clean/Doku) keep their scene plan with word
   indices moved to the new transcript and reuse their pictures; Regie plans get the cut redone with the same grade and the
   measurable rules re-applied (a punch-in at every new jump cut, end freeze, captions).
5. Done callback with the **new** `edl` (same word count and indices; `t` includes the text fixes) – see 1.

Without a saved plan (`planUrl: null`) the worker runs the normal edit of the chosen style on the editor's cut (no
transcription, no automatic cut, no cut check; the style planning – hook, zooms, B-roll, scene plan – runs as for a new edit,
a Regie style renders in its fallback look because the Regie agent would cut again).

`manual` wins over `prompt` and over `plan` (editor caption edits) in the same job – send caption/style edits as a separate
revision. A video edited before the EDL existed has no `edl` in its plan → the job fails with
„Für dieses Video gibt es noch keinen Wort-Schnitt – bitte das Video einmal neu schneiden lassen.“

## 3. Cut rules (all paths: standard edit, scene styles, Regie, manual)

- Word edges are measured on the audio (10 ms RMS): stretched Whisper words shrink to their loud part; a word ends after
  120 ms below the speech threshold (search ≤ +0.45 s; a soft consonant tail above the noise floor stays); its start
  reaches back into silence only, never into the previous word.
- A kept piece never reaches into a source word that is not part of it (the doubled-word bug of 09.11.2026), two pieces
  never share source time, touching pieces are merged.
- Head 0.10 s before the first word, tail ≤ 0.30 s after the last word has died away.
- Pauses up to `keepGap` (style, default 0.21 s; Contenthütte 0.10 s) stay; longer pauses keep `after` + `before` of air
  (≥ 60 / 50 ms); cut points snap to the quietest 10 ms within ±40 ms and to whole frames where possible.
- Source discontinuities (hard picture jump, digital silence) are never crossed by head, tail or the air at a join.
- 15 ms audio fade at every join, 40 ms at the very end.
- Retakes: the same 1–4 words said again within 3 s after a restart (pause ≥ 0.3 s, cut-off word or filler) → only the last
  take stays; a direct repeat („wir haben wir haben“) or a stutter („das das“) loses its first copy. Intensifiers
  („sehr, sehr“), clauses ending in a comma and finished sentences are not touched. Fillers (äh, ähm …) go.
- Automatic check after the cut: re-transcription of the result vs. plan → doubled n-grams not in the plan, planned words
  missing at a join, cut points inside a word. One automatic fix (drop first copy / widen the join / more air), then the
  check runs again; anything left is reported in `cutCheck.warnings`.
