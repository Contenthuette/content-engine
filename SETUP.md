# Einrichtung – 10 Minuten, einmalig

1. **Terminal öffnen** (Spotlight → „Terminal“).
2. **Werkstatt einrichten** – diese Zeile einfügen, Enter (dauert 5–10 Min., fragt evtl. nach deinem Mac-Passwort):
   ```
   cd ~/Desktop/"CONTENT AUTOMATION ULTRA"/content-engine && bash setup.sh
   ```
3. **Claude Code installieren** (falls noch nicht da):
   ```
   curl -fsSL https://claude.ai/install.sh | bash
   ```
   Danach ein **neues** Terminal-Fenster öffnen.
4. **Starten:**
   ```
   cd ~/Desktop/"CONTENT AUTOMATION ULTRA"/content-engine && claude
   ```
   Beim ersten Start mit deinem Claude-Konto anmelden. ElevenLabs und Metricool sind automatisch da
   (deine Connectors aus claude.ai) – prüfen mit `/mcp`.
5. **Stock-Bibliotheken:** API-Keys in `CONTENT AUTOMATION ULTRA/engine/secrets.env` eintragen
   (`PEXELS_KEY=…`, `PIXABAY_KEY=…`, `FREESOUND_KEY=…`). Kostenlos:
   pexels.com/api · pixabay.com/api/docs · freesound.org/apiv2/apply
   Andere Bibliotheken (Artlist, Envato …): Claude sagen, welche – ohne API lädt Claude über deinen Chrome
   und fragt bei jedem Download.

## Benutzen
- `/analysieren <link> <link> …` – Referenzvideos parallel zerlegen und den Stil lernen
- `/kopieren <instagram-link>` – Reel komplett auf Deutsch neu bauen
- `/qa <id>` – harte Qualitätsprüfung durch einen unabhängigen Prüfer
- Live zuschauen: Claude startet die Vorschau (`npx remotion studio`) – sie öffnet sich im Browser.

Fertige Videos landen in `CONTENT AUTOMATION ULTRA/Reels/`.
