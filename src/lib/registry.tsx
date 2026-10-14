// Dunkelmann Editing Library – Register. Jeder Eintrag = Code (z. B. „T-07“), Name, Wofür, Komponente + Props, Dauer, Sounds.
// Neue Elemente: unten in die passende Kategorie eintragen, Code fortlaufend. Codes NIE neu vergeben (Leifs Feedback hängt daran).
import React from 'react';
import {Base, C} from './core';
import * as BG from './bg';
import * as T from './text';
import * as UI from './ui';
import * as W from './widgets';
import * as D3 from './three';
import * as M from './map';
import * as DA from './data';
import * as FX from './fx';
import * as AV from './avatar';
import * as ME from './media';
import {LK, LK_CATS} from './lk/registry_lk';
import * as S2 from './registry_c2';

export type Cat = 'BG' | 'T' | 'UI' | 'W' | '3D' | 'M' | 'DA' | 'FX' | 'TR' | 'AV' | 'ME' | 'KT' | 'KC' | 'KR' | 'KB' | 'KU' | 'KD' | 'KX' | 'KA';
export type SfxHit = [number, string, number?]; // [Sekunde lokal, Sound-Name aus public/lib/sfx, Lautstärke]
export type Entry = {code: string; cat: Cat; name: string; use: string; C: React.FC<any>; props?: Record<string, unknown>; dur: number; sfx?: SfxHit[]};

export const CATS: {cat: Cat; title: string; sub: string}[] = [
  {cat: 'BG', title: 'Hintergründe', sub: 'Die Bühne unter allem'},
  {cat: 'T', title: 'Typo', sub: 'Wörter, die sich bewegen'},
  {cat: 'UI', title: 'iPhone & Mac UI', sub: 'Apple-Vokabular'},
  {cat: 'W', title: 'Widgets', sub: 'Live-Kacheln'},
  {cat: '3D', title: '3D', sub: 'Tiefe & Wow'},
  {cat: 'M', title: 'Karten', sub: 'Orte & Routen'},
  {cat: 'DA', title: 'Zahlen & Daten', sub: 'Beweise zeigen'},
  {cat: 'FX', title: 'Effekte', sub: 'Details & Belohnung'},
  {cat: 'TR', title: 'Übergänge', sub: 'Szene A → Szene B'},
  {cat: 'ME', title: 'Eigenes Material', sub: 'Footage, Logos, Screenshots pro Video'},
  {cat: 'AV', title: 'Avatar', sub: 'Leif im Bild'},
  ...LK_CATS,
];

type Row = [string, React.FC<any>, Record<string, unknown> | undefined, number, string, SfxHit[]?];
const mk = (cat: Cat, rows: Row[]): Entry[] =>
  rows.map(([name, Cmp, props, dur, use, sfx], i) => ({code: `${cat}-${String(i + 1).padStart(2, '0')}`, cat, name, use, C: Cmp, props, dur, sfx}));

const bg = mk('BG', [
  ['Studio-Weiß', BG.Studio, undefined, 1.6, 'Ruhiger Standard für Text-Beats'],
  ['Farb-Blobs', BG.Blobs, undefined, 1.6, 'Lebendiger Standard, wandernde Farbflecken'],
  ['Blobs kräftig', BG.Blobs, {strength: 0.45, colors: [C.RED, C.SUN, C.BLUE]}, 1.6, 'Energie-Beat, Hook'],
  ['Raster-Papier', BG.GridPaper, undefined, 1.6, 'Erklär-/Planungs-Szenen'],
  ['Punkte-Raster', BG.Dots, undefined, 1.6, 'Tech/Daten-Szenen'],
  ['Mesh-Verlauf', BG.Mesh, undefined, 1.6, 'Premium, Apple-Keynote-Gefühl'],
  ['Himmel', BG.Sky, undefined, 1.6, 'Reise, Freiheit, Mallorca'],
  ['Spotlight', BG.Spotlight, {color: C.BLUE}, 1.6, 'Ein Objekt im Fokus'],
]);

const W2 = {text: 'Ohne Team.'};
const tx = mk('T', [
  ['Slam', T.Slam, {text: 'Stopp.'}, 1.4, 'Hook-Wort knallt rein', [[0.05, 'thump']]],
  ['Serif-Slam', T.Slam, {text: 'einfach.', font: 'serif', size: 230}, 1.4, 'Weiches Schlüsselwort', [[0.05, 'thump', 0.8]]],
  ['Stagger hoch', T.Stagger, {text: 'Schnell.', mode: 'up'}, 1.8, 'Standard für Aussagen', [[0, 'swish', 0.5]]],
  ['Stagger runter', T.Stagger, {text: 'Von oben.', mode: 'down'}, 1.8, 'Variation für Aussagen', [[0, 'swish', 0.5]]],
  ['Stagger Dreh', T.Stagger, {text: 'Gedreht.', mode: 'rot'}, 1.8, 'Verspielter Beat', [[0, 'swish', 0.5]]],
  ['Stagger Zoom', T.Stagger, {text: 'Wächst.', mode: 'scale'}, 1.8, 'Betonung, Aufzählung', [[0, 'pop', 0.6]]],
  ['Blur-Wörter', T.BlurWords, {text: 'Klar wird es erst jetzt.', accent: 3}, 1.8, 'Ruhige Aussage mit Akzentwort'],
  ['Typewriter', T.Typewriter, {text: 'Schreib mir einfach.'}, 1.9, 'Prompt, Chat, Eingabe', [[0.1, 'tick', 0.5], [0.4, 'tick', 0.5], [0.7, 'tick', 0.5], [1.0, 'tick', 0.5]]],
  ['Fallblatt', T.Flap, {text: 'MALLORCA', from: 'BERLIN'}, 1.9, 'Ort/Zahl wechselt wie Flughafen-Tafel', [[0.1, 'flap'], [0.6, 'flap', 0.7]]],
  ['iOS-Picker', T.Picker, {lead: 'Für', words: ['Coaches', 'Agenturen', 'Creator']}, 2.0, 'Zielgruppen/Optionen durchrollen', [[0.4, 'tick'], [0.9, 'tick'], [1.4, 'tick']]],
  ['Masken-Wipe links', T.MaskWipe, {text: 'Neu gedacht.', dir: 'l'}, 1.5, 'Sauberer Reveal', [[0, 'swish', 0.6]]],
  ['Masken-Wipe hoch', T.MaskWipe, {text: 'Von unten.', dir: 'u'}, 1.5, 'Sauberer Reveal vertikal', [[0, 'swish', 0.6]]],
  ['Pille Blau', T.PillText, {text: 'KI-Agent', bg: C.BLUE}, 1.4, 'Ein Schlüsselbegriff', [[0.1, 'pop']]],
  ['Pille Rot', T.PillText, {text: 'Achtung', bg: C.RED, rot: -4}, 1.4, 'Warnung, Problem', [[0.1, 'pop']]],
  ['Pille Grün', T.PillText, {text: 'Erledigt', bg: C.GREEN, rot: 3}, 1.4, 'Lösung, bestätigt', [[0.1, 'pop']]],
  ['Zeile mit Pille', T.LinePill, {text: 'Das spart dir', pill: '10 Stunden'}, 1.8, 'Satz mit eingebettetem Chip', [[0.5, 'pop']]],
  ['Serif-Unterstrich', T.SerifUnderline, {text: 'der Punkt.'}, 1.8, 'Editorial-Betonung', [[0.6, 'swish', 0.5]]],
  ['Zähler', T.Counter, {to: 1000, label: 'Follower', prefix: '+', sparks: true}, 2.0, 'Ergebnis-Zahl mit Funkeln', [[0.05, 'tick', 0.5], [1.1, 'chime']]],
  ['Glanz-Text', T.Glare, {text: 'Premium.'}, 1.6, 'Lichtstreifen über Wort', [[0.4, 'swish', 0.4]]],
  ['Speed-Text', T.Speed, {text: 'Schneller.'}, 1.4, 'Tempo, Geschwindigkeit', [[0, 'swish']]],
  ['Laufband', T.Marquee, {text: 'AUTOMATISIERT · ', rows: 3}, 1.8, 'Energie-Hintergrund aus Text'],
  ['Textmarker', T.Marker, {text: 'Das ist', mark: 'wichtig.'}, 1.7, 'macOS-Markierung', [[0.6, 'swish', 0.4]]],
  ['Scramble', T.Scramble, {text: 'DECODIERT'}, 1.7, 'Tech, Hacker, Enthüllung', [[0.1, 'tick', 0.4], [0.5, 'tick', 0.4], [0.9, 'pop', 0.5]]],
  ['Wort-Stapel', T.Stack, {words: ['Planen', 'Bauen', 'Posten']}, 1.9, 'Drei Schritte untereinander', [[0.1, 'pop', 0.5], [0.4, 'pop', 0.5], [0.7, 'pop', 0.5]]],
  ['Klammern', T.Brackets, {text: 'Fokus'}, 1.5, 'Eckige Klammern um Wort', [[0.2, 'tap']]],
  ['Split', T.Split, {text: 'Zwei Hälften'}, 1.6, 'Wort teilt sich/kommt zusammen', [[0.3, 'thump', 0.6]]],
  ['Outline → Füllung', T.OutlineFill, {text: 'Echt.'}, 1.6, 'Wort füllt sich auf', [[0.4, 'swish', 0.4]]],
  ['Korrektur', T.Correction, {text: 'Automatisch.', wrong: 'Manuell.'}, 2.0, 'Falsch durchstreichen → richtig', [[0.5, 'tap'], [0.9, 'pop']]],
  ['Zitat', T.Quote, {text: 'Weniger, aber besser.', who: 'Dieter Rams'}, 2.0, 'Zitat mit Serif'],
  ['Odometer', T.Odometer, {to: '24/7'}, 1.8, 'Zahl rollt ein', [[0.1, 'tick', 0.4], [0.9, 'chime', 0.6]]],
  ['Kicker', T.Kicker, {text: 'Der Trick', num: '01'}, 1.6, 'Kapitel/Listen-Nummer', [[0.1, 'tap']]],
  ['Wort-Tausch', T.TypeSwap, {...W2, swap: 'Ohne Stress.'}, 2.0, 'Wort ersetzt sich', [[0.9, 'swish', 0.5]]],
]);

const ui = mk('UI', [
  ['Chip', UI.ChipEl, {text: 'Claude Code', dot: C.GREEN}, 1.5, 'Tool/Label einblenden', [[0.1, 'pop']]],
  ['Cursor-Klick', UI.CursorClick, {label: 'Jetzt starten'}, 1.8, 'Button wird geklickt', [[0.85, 'tap']]],
  ['Suchleiste', UI.SearchBar, {text: 'Reel-Ideen für Coaches', glow: true}, 2.0, 'Suche/Prompt mit Siri-Glow', [[0.3, 'tick', 0.4], [0.7, 'tick', 0.4], [1.1, 'tick', 0.4]]],
  ['Island Live', UI.Island, {mode: 'live'}, 1.8, 'Dynamic Island: läuft gerade', [[0.1, 'synpop']]],
  ['Island Musik', UI.Island, {mode: 'music'}, 1.8, 'Dynamic Island: Musik', [[0.1, 'synpop']]],
  ['Island Timer', UI.Island, {mode: 'timer'}, 1.8, 'Dynamic Island: Zeit läuft', [[0.1, 'synpop']]],
  ['Island Anruf', UI.Island, {mode: 'call'}, 1.8, 'Dynamic Island: Anruf', [[0.1, 'synpop']]],
  ['Island Fertig', UI.Island, {mode: 'done'}, 1.8, 'Dynamic Island: erledigt ✓', [[0.1, 'synpop'], [0.6, 'chime', 0.6]]],
  ['Mitteilung', UI.Notification, {title: 'Neuer Kunde', body: 'Hat gerade gebucht.'}, 1.8, 'Push-Banner', [[0.1, 'chime', 0.8]]],
  ['Mitteilungs-Stapel', UI.Notification, {stack: 3}, 2.0, 'Viele Pushes = Erfolg', [[0.1, 'chime', 0.6], [0.35, 'chime', 0.6], [0.6, 'chime', 0.6]]],
  ['iMessage', UI.Chat, undefined, 2.2, 'Chat-Verlauf', [[0.2, 'send'], [0.8, 'pop', 0.6], [1.4, 'send']]],
  ['Kommentare', UI.Comments, undefined, 2.0, 'Kommentar-Flut', [[0.2, 'pop', 0.5], [0.5, 'pop', 0.5], [0.8, 'pop', 0.5]]],
  ['CTA-Karte', UI.CtaCard, {kw: 'AUDIT'}, 2.0, 'Kommentiere KEYWORD', [[0.2, 'pop'], [1.1, 'tap']]],
  ['Schalter', UI.Toggle, {label: 'Autopilot'}, 1.6, 'An/Aus-Moment', [[0.6, 'tap']]],
  ['Regler', UI.Slider, {label: 'Reichweite'}, 1.8, 'Wert hochziehen', [[0.2, 'tick', 0.4]]],
  ['Fortschritt', UI.Progress, {label: 'Export'}, 1.8, 'Laden/Fertigstellen', [[1.3, 'chime', 0.6]]],
  ['Checkliste', UI.Checklist, {items: ['Skript', 'Schnitt', 'Posten']}, 2.0, 'Schritte abhaken', [[0.4, 'tap'], [0.8, 'tap'], [1.2, 'tap']]],
  ['Toast', UI.Toast, {text: 'Gespeichert'}, 1.5, 'Kurze Bestätigung', [[0.1, 'pop', 0.6]]],
  ['Tastatur', UI.Keyboard, {text: 'Mach mir ein Reel'}, 2.2, 'Tippen am iPhone', [[0.2, 'tick', 0.4], [0.5, 'tick', 0.4], [0.8, 'tick', 0.4], [1.1, 'tick', 0.4]]],
  ['Mac-Fenster', UI.MacWindow, {src: 'lib/img/screenshot.png', title: 'github.com'}, 2.0, 'Screenshot im Fenster', [[0.1, 'swish', 0.5]]],
  ['Terminal', UI.Terminal, undefined, 2.2, 'Code/Automatisierung', [[0.2, 'tick', 0.4], [0.6, 'tick', 0.4], [1.3, 'chime', 0.5]]],
  ['Code-Editor', UI.CodeEditor, undefined, 2.0, 'Programmieren zeigen'],
  ['Einstellungen', UI.Settings, undefined, 2.0, 'iOS-Settings-Zeilen', [[0.9, 'tap']]],
  ['Teilen-Sheet', UI.ShareSheet, undefined, 1.9, 'Teilen/Senden', [[0.1, 'swish', 0.4]]],
  ['Eingehender Anruf', UI.IncomingCall, undefined, 2.0, 'Kunde ruft an', [[0.1, 'synpop'], [0.6, 'synpop', 0.7]]],
  ['Homescreen', UI.HomeScreen, undefined, 2.0, 'App-Raster poppt rein', [[0.1, 'pop', 0.5], [0.3, 'pop', 0.5]]],
]);

const KINDS: W.WKind[] = ['weather', 'music', 'calendar', 'rings', 'chart', 'notes', 'clock', 'battery', 'steps', 'stocks', 'reminders', 'timer', 'photos', 'map', 'screen', 'focus'];
const KN: Record<string, string> = {weather: 'Wetter', music: 'Musik', calendar: 'Kalender', rings: 'Aktivitätsringe', chart: 'Chart', notes: 'Notizen', clock: 'Uhr', battery: 'Batterie', steps: 'Schritte', stocks: 'Aktien', reminders: 'Erinnerungen', timer: 'Timer', photos: 'Fotos', map: 'Karte', screen: 'Bildschirmzeit', focus: 'Fokus'};
const wd = mk('W', [
  ...KINDS.map((k): Row => [`Widget ${KN[k]}`, W.WidgetPop, {kind: k}, 1.5, `${KN[k]}-Widget poppt rein`, [[0.08, 'pop']]]),
  ['Widget-Raster', W.WidgetGrid, undefined, 2.0, 'Mehrere Widgets füllen den Screen', [[0.1, 'pop', 0.5], [0.3, 'pop', 0.5], [0.5, 'pop', 0.5]]],
]);

const d3 = mk('3D', [
  ['iPhone 3D', D3.Phone3D, {spin: true}, 2.2, 'Gerät dreht sich in den Raum', [[0, 'swish']]],
  ['Text-Ring', D3.TextRing, {text: 'DUNKELMANN · CONTENT · ', rad: 360, size: 90}, 2.0, 'Rotierender Schriftring', [[0, 'swish', 0.5]]],
  ['Icon-Orbit', D3.IconOrbit, {n: 8}, 2.0, 'Apps kreisen um Mitte', [[0, 'swish', 0.5]]],
  ['Icon-Implosion', D3.IconOrbit, {n: 8, implode: true}, 2.0, 'Alles saugt sich in einen Punkt', [[1.2, 'boom', 0.6]]],
  ['Widget-Karussell', D3.Carousel, undefined, 2.2, '3D-Karussell aus Widgets', [[0.1, 'swish', 0.5]]],
  ['Cover-Flow', D3.CoverFlow, {n: 7}, 2.0, 'Karten wie Cover-Flow', [[0.4, 'swish', 0.5], [1.0, 'swish', 0.5]]],
  ['Würfel', D3.Cube, {faces: ['Idee', 'Skript', 'Schnitt', 'Post']}, 2.2, 'Würfel dreht Begriffe', [[0.5, 'swish', 0.5], [1.2, 'swish', 0.5]]],
  ['Karten-Fächer', D3.CardFan, {n: 5}, 1.9, 'Optionen auffächern', [[0.1, 'flap', 0.6]]],
  ['Karten-Mischen', D3.CardShuffle, {n: 5}, 2.0, 'Karten mischen sich', [[0.3, 'flap', 0.5], [0.9, 'flap', 0.5]]],
  ['Iso-Raster', D3.IsoGrid, undefined, 2.0, 'Isometrische Kachelwelt', [[0.1, 'pop', 0.5]]],
  ['Tilt-Karte', D3.TiltCard, {title: 'Dein System'}, 1.9, 'Karte kippt mit Glanz', [[0.1, 'swish', 0.4]]],
  ['Flip-Karte', D3.FlipCard, {front: 'Vorher', back: 'Nachher'}, 2.0, 'Karte dreht um', [[0.8, 'swish']]],
  ['Karten-Tunnel', D3.CardTunnel, undefined, 2.0, 'Flug durch Karten', [[0, 'swish']]],
  ['Galerie-Wand', D3.GalleryWall, {label: 'Deine Reels'}, 2.0, 'Wand aus Kacheln', [[0.1, 'swish', 0.5]]],
  ['3D-Balken', D3.Bars3D, {vals: [0.3, 0.5, 0.75, 1]}, 2.0, 'Wachstum in 3D', [[0.2, 'pop', 0.5], [0.5, 'pop', 0.5], [0.8, 'pop', 0.5]]],
  ['Icon-Kugel', D3.IconSphere, {n: 24}, 2.0, 'Kugel aus Apps', [[0, 'swish', 0.5]]],
  ['Treppe', D3.Stairs, {labels: ['Start', 'Wachstum', 'Skalierung']}, 2.0, 'Stufen nach oben', [[0.2, 'tap'], [0.6, 'tap'], [1.0, 'chime', 0.6]]],
]);

const mp = mk('M', [
  ['Flug nach Mallorca', M.MapFlyTo, {search: 'Mallorca', place: 'Palma', sub: 'Spanien'}, 3.0, 'Apple-Maps-Suche → Flug → Pin', [[0.3, 'tick', 0.4], [1.0, 'swish'], [2.0, 'pin']]],
  ['Pin-Drop', M.MapPin, undefined, 2.0, 'Ort markieren', [[0.5, 'pin']]],
  ['Route', M.MapRoute, undefined, 2.4, 'Weg A → B zeichnet sich', [[0.2, 'swish', 0.5], [1.8, 'chime', 0.6]]],
  ['Karten-Text', M.MapText, {text: 'MALLORCA'}, 2.0, 'Text als Masken-Fenster', [[0.1, 'thump', 0.6]]],
  ['Radar', M.Radar, {label: 'In deiner Nähe'}, 2.0, 'Umkreis-Suche', [[0.2, 'synpop', 0.6]]],
]);

const da = mk('DA', [
  ['Ring-Statistik', DA.RingStat, {v: 0.87, label: 'Abschlussquote'}, 2.0, 'Prozent als Ring', [[1.1, 'chime', 0.6]]],
  ['Balken', DA.BarChart, undefined, 2.0, 'Vergleich in Balken', [[0.2, 'pop', 0.4], [0.4, 'pop', 0.4], [0.6, 'pop', 0.4]]],
  ['Linie', DA.LineChart, undefined, 2.0, 'Wachstumskurve', [[0.1, 'swish', 0.5]]],
  ['Donut', DA.Donut, undefined, 2.0, 'Anteile'],
  ['Stat-Karten', DA.StatCards, undefined, 2.0, 'Drei KPIs', [[0.1, 'pop', 0.5], [0.3, 'pop', 0.5], [0.5, 'pop', 0.5]]],
  ['Vorher/Nachher', DA.BeforeAfter, {a: '8 Std.', b: '20 Min.'}, 2.0, 'Gegenüberstellung', [[0.9, 'swish']]],
  ['Zeitstrahl', DA.Timeline, {steps: ['Tag 1', 'Woche 2', 'Monat 3']}, 2.2, 'Ablauf über Zeit', [[0.2, 'tap'], [0.7, 'tap'], [1.2, 'tap']]],
  ['Rangliste', DA.Leaderboard, undefined, 2.0, 'Ranking', [[0.9, 'chime', 0.6]]],
  ['Badge', DA.Badge, {text: 'Top 1 %'}, 1.6, 'Auszeichnung', [[0.1, 'pop'], [0.5, 'chime', 0.5]]],
  ['Vergleich', DA.Compare, {a: 'Du', b: 'KI', va: 0.35, vb: 0.95}, 2.0, 'A gegen B', [[0.3, 'pop', 0.5]]],
  ['Trichter', DA.Funnel, undefined, 2.0, 'Funnel/Conversion', [[0.2, 'pop', 0.4], [0.5, 'pop', 0.4], [0.8, 'pop', 0.4]]],
]);

const fx = mk('FX', [
  ['Konfetti', FX.Confetti, {box: [220, 600, 640, 640]}, 1.8, 'Erfolg, nur hinter/neben Objekten', [[0.05, 'boom', 0.5]]],
  ['Strahlen', FX.Rays, undefined, 1.8, 'Enthüllung, Heiligenschein'],
  ['Sparkles', FX.Sparkles, undefined, 1.6, '✦ an Zahlen/Wörtern', [[0.1, 'chime', 0.5]]],
  ['Glow-Punkt', FX.GlowDot, {color: C.BLUE}, 1.5, 'Licht materialisiert', [[0.1, 'synpop', 0.5]]],
  ['Puls', FX.Pulse, {color: C.BLUE}, 1.6, 'Live-/Standort-Puls'],
  ['Lichtstreifen', FX.LightSweep, undefined, 1.4, 'Glanz über Screen', [[0.2, 'swish', 0.4]]],
  ['Emoji-Regen', FX.EmojiRain, undefined, 1.8, 'Reaktions-Flut', [[0.1, 'pop', 0.4]]],
  ['Herzen', FX.Hearts, undefined, 1.8, 'Likes steigen auf', [[0.1, 'pop', 0.4], [0.4, 'pop', 0.4]]],
  ['Check-Burst', FX.CheckBurst, undefined, 1.6, 'Erledigt-Moment', [[0.1, 'chime']]],
  ['Schockwelle', FX.Shockwave, {color: C.BLUE}, 1.4, 'Aufprall/Drop', [[0.05, 'boom', 0.7]]],
  ['Bokeh', FX.Bokeh, undefined, 1.8, 'Weiche Lichter für Tiefe'],
  ['Feuerwerk', FX.Fireworks, undefined, 2.0, 'Großer Abschluss', [[0.2, 'boom', 0.4], [0.8, 'boom', 0.4]]],
]);

const tr = mk('TR', [
  ['Balken-Wipe', FX.TrWipeBars, undefined, 1.4, 'Energischer Szenenwechsel', [[0.35, 'swish']]],
  ['Iris', FX.TrIris, {color: C.BLUE}, 1.4, 'Kreis öffnet/schließt', [[0.4, 'swish']]],
  ['Shutter', FX.TrShutter, undefined, 1.4, 'Kamera-Verschluss', [[0.6, 'tap']]],
  ['Punkt füllt', FX.TrDotFill, {color: C.RED}, 1.4, 'Punkt wächst zum Vollbild', [[0.3, 'synpop']]],
  ['Panel', FX.TrPanel, {color: C.INK}, 1.4, 'Fläche schiebt durch', [[0.4, 'swish']]],
  ['Glas', FX.TrGlass, undefined, 1.4, 'Milchglas-Blur-Wechsel', [[0.4, 'swish', 0.5]]],
  ['Vorhang', FX.TrCurtain, undefined, 1.4, 'Zwei Hälften schließen', [[0.5, 'thump', 0.6]]],
  ['Streifen', FX.TrSlices, undefined, 1.4, 'Schräge Streifen', [[0.4, 'swish']]],
  ['Kacheln', FX.TrTiles, undefined, 1.4, 'Kachel-Raster klappt', [[0.4, 'tick', 0.5]]],
  ['Zoom-Blur', FX.TrZoomBlur, undefined, 1.2, 'Reinzoomen mit Unschärfe', [[0.4, 'swish']]],
]);

const av = mk('AV', [
  ['FaceTime-Kachel', AV.FaceTile, undefined, 2.4, 'Leif spricht (Standard)'],
  ['FaceTime + Buttons', AV.FaceTile, {controls: true}, 2.4, 'Anruf-Look mit Steuerung', [[0.35, 'pop', 0.5]]],
  ['Punkt → Pille → Kachel', AV.DotToTile, undefined, 2.4, 'Hook: Leif erscheint', [[0, 'synpop'], [0.25, 'swish', 0.6]]],
  ['Kachel → Island', AV.TileToIsland, undefined, 1.8, 'Outro: Leif wird zur Insel', [[0.05, 'swish', 0.6], [0.5, 'synpop']]],
  ['Bild-im-Bild', AV.PiP, undefined, 2.0, 'Leif klein, Inhalt groß', [[0.1, 'pop', 0.6]]],
  ['Avatar + Textring', AV.AvatarBadge, undefined, 2.0, 'Profil/Intro', [[0.1, 'pop']]],
  ['Polaroid', AV.Polaroid, undefined, 2.0, 'Persönlicher Moment', [[0.35, 'thump', 0.6]]],
]);

// Eigenes Material pro Video (seit 14.10.): src/srcs/crop/label per Props aus dem Schnittplan, Dateien unter public/media/<id>/
const me = mk('ME', [
  ['Footage Vollbild', ME.FootageFull, undefined, 1.8, 'Clip aus dem Quell-Reel/eigenes Video füllt den Screen', [[0, 'whoosh3', 0.4]]],
  ['Footage-Karte', ME.FootageCard, undefined, 1.8, 'Clip/Bild in 3D-Karte (Overlay)', [[0.05, 'swipe', 0.45]]],
  ['Logo-Slam', ME.LogoSlam, undefined, 1.4, 'Marke/Tool knallt rein (Claude, GitHub …)', [[0.02, 'snap', 0.6], [0.1, 'sparkle', 0.35]]],
  ['Logo-Reihe', ME.LogoRow, undefined, 1.6, 'Mehrere Tools als App-Kacheln', [[0, 'tock', 0.4], [0.08, 'tock', 0.35], [0.16, 'tock', 0.35]]],
  ['Screenshot-Scroll', ME.ShotScroll, undefined, 2.2, 'Repo/Website scrollt im Browserfenster', [[0.05, 'slide', 0.4]]],
  ['Footage im iPhone', ME.FootagePhone, undefined, 2.0, 'Clip/App läuft im iPhone', [[0.05, 'whoosh', 0.4]]],
  ['Footage-Collage', ME.FootageWall, undefined, 2.0, 'Viele Bilder/Clips als dichte Wand (Bühne)', [[0, 'swipe', 0.4], [0.15, 'tick2', 0.3]]],
  ['Footage-Split', ME.FootageSplit, undefined, 2.0, 'Original vs. Nachbau nebeneinander', [[0.05, 'slide2', 0.4], [0.35, 'pop2', 0.4]]],
  ['Stat-Karte', ME.StatCard, undefined, 2.2, 'Beweis-Zahl mit Logo (Sterne, Nutzer, Umsatz …)', [[0.05, 'swipe', 0.4], [0.15, 'counter', 0.35], [1.3, 'sparkle', 0.4]]],
]);

export const CREATOROLY: Entry[] = [...bg, ...S2.bg2, ...tx, ...S2.tx2, ...ui, ...S2.ui2, ...wd, ...S2.wd2, ...d3, ...S2.d32, ...mp, ...S2.mp2, ...da, ...S2.da2, ...fx, ...S2.fx2, ...tr, ...S2.tr2, ...av, ...S2.av2, ...me];
export const LIB: Entry[] = [...CREATOROLY, ...LK];
export const byCode = (code: string) => LIB.find((e) => e.code === code.toUpperCase());
export const DEFAULT_BG = BG.Blobs;
export type {Base};
