# Recherche-Notizen (Nacht 14./15.10.2026) – Content-Automation, Editing, Clipping

## Plattform-Regeln (wichtig für Multi-Account + Kopieren)
- Instagram (Policy-Update April 2026): Unoriginale Inhalte (Reposts ohne echte Veränderung) verlieren die **Empfehlungen** (Feed/Explore/Reels für Nicht-Follower).
  Als echte Veränderung zählen eigener Text, kreative Edits, **Voiceover**, Kommentar/Perspektive. NICHT: Tempo ändern, Quelle einblenden.
  → Unser Ansatz (deutsches VO, Library-Schnitt, eigenes Material, fremde Clips ≤ 2 s) ist genau die „Transformation“. 1:1-Kopien mit Leif drin wären es nicht.
  Quelle: https://tubefilter.com/2026/04/30/instagram-removes-algorithm-recommendations-repost-content-aggregator
- Clipping-Branche: Plattformen löschen Netzwerke mit vielen fast identischen Uploads (YouTube: 16 Kanäle / 4,7 Mrd. Views in einem Monat).
  → Bei 10 Accounts pro Plattform: jede Variante anders (Hook, Text, Musik, Schnitt-Format) – nie dasselbe Video auf mehreren Accounts.
  Quelle: https://trends.vc/clipping-businesses-pay-per-view-distribution-clip-armies-view-verification/

## Clipping-Ökonomie (Benchmarks)
- Pay-per-View-Marktplätze (z. B. Whop Content Rewards): ca. 1,50–3 $ pro 1.000 Views für Clipper, Brand-Kampagnen 5–20 Tsd. $.
- Der Wert wandert vom Schneiden (KI macht es billig) zu **Distribution + Hook-Auswahl**. Hook-Auswahl ist die Kernkompetenz.
- Für uns: Kosten pro Reel (~1,10–1,40 $) vs. 1,50 $/1.000 Views → schon ab ~1.000 Views pro Reel günstiger als bezahlte Clipper.

## Editing-Ästhetiken 2026 (Short-Form) – was wir schon können / was fehlt
- Brainrot-Stack (2–3 Ebenen übereinander, Schnitt alle 0,6–0,8 s, kinetische Captions) → entspricht unserem „breaking“-Format; Captions bleiben bei uns aus.
- Greenscreen-Explain (Sprecher im Drittel, Visuals alle 4–6 s neu) → unser Avatar-Kachel + ME-Bausteine.
- Vox/Video-Essay (Karten/Charts alle 8–10 s, ruhige Musik unter VO) → fehlt als Format („essay“) – Kandidat für Format Nr. 5.
- Audio-reaktive KI-Visuals, Doku-Realismus, Phone-first-Cinematic → für Leif-B-Roll (Seedance/Higgsfield) interessant.
  Quelle: https://www.opus.pro/blog/editing-aesthetics-dominating-short-form-2026

## Viral-Radar (eigenes Tool, pipeline/tools/viral.py)
- TikTok-Tag-Seiten lassen sich headless rendern (ca. 110–150 Videos pro Tag-Seite), Statistik pro Video steht im eingebetteten JSON der Videoseite.
- Tag-Seiten zeigen eine Mischung aus neu + alt; ≥ 1 Mio in 7 Tagen ist selten pro Tag → Sortierung nach **Views pro Stunde** zeigt, was gerade abhebt.
- Instagram-Hashtags brauchen Login → Instagram über kuratierte Account-Listen pro Nische (wie scout.py).
