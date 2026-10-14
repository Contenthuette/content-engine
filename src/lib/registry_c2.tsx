// Creatoroly-Block Stufe 2 (+155 → 300). Codes laufen in jeder Kategorie fortlaufend weiter.
import React from 'react';
import type {Entry, Cat, SfxHit} from './registry';
import {C} from './core';
import * as BG from './bg';
import * as T from './text';
import * as UI from './ui';
import * as W from './widgets';
import * as D3 from './three';
import * as M from './map';
import * as DA from './data';
import * as FX from './fx';
import * as AV from './avatar';
import * as N from './c2';

type Row = [string, React.FC<any>, Record<string, unknown> | undefined, number, string, SfxHit[]?];
const mkAt = (cat: Cat, start: number, rows: Row[]): Entry[] => rows.map(([name, Cmp, props, dur, use, sfx], i) => ({code: `${cat}-${String(start + i + 1).padStart(2, '0')}`, cat, name, use, C: Cmp, props, dur, sfx}));

export const bg2 = mkAt('BG', 8, [
  ['Blau-Hauch', BG.Plain, {color: '#EAF2FF'}, 1.4, 'Ruhige Fläche, kühl'],
  ['Rot-Hauch', BG.Plain, {color: '#FFECEC'}, 1.4, 'Ruhige Fläche, warm'],
  ['Grün-Hauch', BG.Plain, {color: '#E9FBF2'}, 1.4, 'Ruhige Fläche, frisch'],
  ['Blobs Blau', BG.Blobs, {colors: [C.BLUE, '#7FB2FF', '#B9D3FF'], strength: 0.35}, 1.6, 'Tech, Vertrauen'],
  ['Blobs Rot', BG.Blobs, {colors: [C.RED, '#FF8A80', C.SUN], strength: 0.35}, 1.6, 'Energie, Dringlichkeit'],
  ['Blobs Grün', BG.Blobs, {colors: [C.GREEN, '#8EF0C4', C.BLUE], strength: 0.35}, 1.6, 'Erfolg, Wachstum'],
  ['Blobs langsam', BG.Blobs, {speed: 0.4, strength: 0.28}, 1.6, 'Ruhige Erklär-Szene'],
  ['Spotlight Rot', BG.Spotlight, {color: C.RED}, 1.6, 'Warnung im Fokus'],
]);

export const tx2 = mkAt('T', 32, [
  ['Gewicht wächst', N.TWeight, undefined, 1.5, 'Stärker werden (variable Schrift)', [[0.1, 'swish', 0.4]]],
  ['Gewicht „Mutiger.“', N.TWeight, {text: 'Mutiger.'}, 1.5, 'Haltung', [[0.1, 'swish', 0.4]]],
  ['Buchstaben ziehen zusammen', N.TTracking, undefined, 1.4, 'Fokussieren', [[0, 'swish', 0.4]]],
  ['Buchstaben „KLARHEIT“', N.TTracking, {text: 'KLARHEIT'}, 1.4, 'Klarheit', [[0, 'swish', 0.4]]],
  ['Zeilen-Maske', N.TLineMask, undefined, 1.8, 'Drei Nutzen untereinander', [[0, 'swish', 0.35], [0.14, 'swish', 0.3], [0.28, 'swish', 0.3]]],
  ['Zeilen-Maske Problem', N.TLineMask, {lines: ['Kein Hook.', 'Kein Tempo.', 'Kein Erfolg.']}, 1.8, 'Drei Probleme', [[0, 'swish', 0.35], [0.14, 'swish', 0.3], [0.28, 'swish', 0.3]]],
  ['Pille wird Satz', N.TPillMorph, undefined, 2.0, 'Ankündigung entfaltet sich', [[0.05, 'pop'], [0.35, 'swish', 0.4]]],
  ['Pille wird Satz Grün', N.TPillMorph, {pill: 'Tipp', text: 'Der erste Satz entscheidet alles.', color: C.GREEN}, 2.0, 'Tipp', [[0.05, 'pop'], [0.35, 'swish', 0.4]]],
  ['Große Zahl + Einheit', N.TBigNumber, undefined, 1.6, 'Zeitangabe', [[0.05, 'thump'], [0.2, 'swish', 0.3]]],
  ['Große Zahl „10x“', N.TBigNumber, {num: '10x', unit: 'schneller', color: C.BLUE}, 1.6, 'Faktor', [[0.05, 'thump'], [0.2, 'swish', 0.3]]],
  ['Frage mit hüpfendem ?', N.TQuestion, undefined, 1.8, 'Frage an Zuschauer', [[0.3, 'pop']]],
  ['Frage „Wer kennt das?“', N.TQuestion, {text: 'wer kennt das?'}, 1.6, 'Relatable-Hook', [[0.3, 'pop']]],
  ['Slam Rot', T.Slam, {text: 'Halt.', color: C.RED}, 1.3, 'Stopp-Moment', [[0.05, 'thump']]],
  ['Serif-Slam „endlich.“', T.Slam, {text: 'endlich.', font: 'serif', size: 230}, 1.3, 'Erleichterung', [[0.05, 'thump', 0.8]]],
  ['Stagger „Sofort.“', T.Stagger, {text: 'Sofort.', mode: 'rot'}, 1.6, 'Tempo', [[0, 'swish', 0.5]]],
  ['Blur-Wörter Grün', T.BlurWords, {text: 'Das spart dir jede Woche Stunden.', accent: 4, accentColor: C.GREEN}, 1.9, 'Nutzen-Aussage'],
  ['Blur-Wörter Rot', T.BlurWords, {text: 'Hier verlierst du deine Zuschauer.', accent: 3, accentColor: C.RED}, 1.9, 'Problem-Aussage'],
  ['Fallblatt Jahr', T.Flap, {text: '2026', from: '2025'}, 1.7, 'Zeitsprung', [[0.1, 'flap'], [0.6, 'flap', 0.7]]],
  ['Picker Tools', T.Picker, {lead: 'Mit', words: ['Claude', 'Remotion', 'ElevenLabs']}, 2.0, 'Werkzeuge nennen', [[0.4, 'tick'], [0.9, 'tick'], [1.4, 'tick']]],
  ['Pille Schwarz', T.PillText, {text: 'Wichtig', bg: C.INK, rot: -3}, 1.3, 'Neutraler Akzent', [[0.1, 'pop']]],
  ['Zeile mit Pille Grün', T.LinePill, {text: 'Ergebnis nach', pill: '7 Tagen', bg: C.GREEN}, 1.8, 'Zeitraum', [[0.5, 'pop']]],
  ['Zähler Views', T.Counter, {to: 250000, label: 'Views', sparks: true}, 2.0, 'Views-Beweis', [[0.05, 'tick', 0.5], [1.1, 'chime']]],
  ['Zähler Euro', T.Counter, {to: 9900, label: 'Umsatz', suffix: ' €', sparks: true}, 2.0, 'Umsatz-Beweis', [[0.05, 'tick', 0.5], [1.1, 'chime']]],
  ['Textmarker Blau', T.Marker, {text: 'Der eigentliche', mark: 'Grund.', color2: '#B9D3FF'}, 1.7, 'Ursache markieren', [[0.6, 'swish', 0.4]]],
  ['Wort-Stapel Nutzen', T.Stack, {words: ['Schneller', 'Besser', 'Günstiger']}, 1.9, 'Drei Vorteile', [[0.1, 'pop', 0.5], [0.4, 'pop', 0.5], [0.7, 'pop', 0.5]]],
  ['Korrektur „Teuer → Günstig“', T.Correction, {text: 'Günstig.', wrong: 'Teuer.'}, 2.0, 'Einwand drehen', [[0.5, 'tap'], [0.9, 'pop']]],
  ['Odometer 100 %', T.Odometer, {to: '100%'}, 1.8, 'Vollständig', [[0.1, 'tick', 0.4], [0.9, 'chime', 0.6]]],
  ['Kicker 02', T.Kicker, {text: 'Der Hook', num: '02'}, 1.5, 'Kapitel 2', [[0.1, 'tap']]],
]);

export const ui2 = mkAt('UI', 26, [
  ['Spotlight-Suche', N.SpotlightSearch, undefined, 2.2, 'Mac-Suche → Ergebnis', [[0.2, 'tick', 0.35], [0.5, 'tick', 0.35], [0.8, 'tick', 0.35], [0.95, 'pop', 0.5]]],
  ['Siri-Rand', N.SiriEdge, undefined, 2.0, 'Sprachbefehl', [[0, 'synpop', 0.6], [0.3, 'swish', 0.3]]],
  ['AirDrop', N.AirDrop, undefined, 2.0, 'Datei senden', [[0, 'pop'], [1.2, 'chime', 0.6]]],
  ['Sperrbildschirm', N.LockScreen, undefined, 2.0, 'Erfolgs-Pushes am Morgen', [[0.2, 'chime', 0.5], [0.32, 'chime', 0.45], [0.44, 'chime', 0.4], [0.56, 'chime', 0.35]]],
  ['Kontrollzentrum', N.ControlCenter, undefined, 1.8, 'Alles an', [[0.4, 'tap'], [0.55, 'tap'], [0.7, 'tap'], [0.85, 'tap']]],
  ['Face ID', N.FaceId, undefined, 1.8, 'Entsperren, Zugang', [[0.2, 'synpop', 0.5], [1.0, 'chime', 0.6]]],
  ['Lautstärke-HUD', N.VolumeHud, undefined, 1.6, 'Lauter werden', [[0.2, 'tick', 0.3], [0.4, 'tick', 0.3], [0.6, 'tick', 0.3]]],
  ['Musik-Player', N.MusicPlayer, undefined, 1.8, 'Sound/Playlist', [[0.05, 'pop', 0.5]]],
  ['Mail senden', N.MailSend, undefined, 2.2, 'Lieferung an Kunden', [[0.3, 'tick', 0.3], [1.4, 'tap'], [1.5, 'send']]],
  ['Fotos auswählen', N.PhotoPicker, undefined, 1.6, 'Material wählen', [[0.25, 'tap', 0.5], [0.5, 'tap', 0.5], [0.75, 'tap', 0.5], [1.0, 'tap', 0.5]]],
  ['Chip Remotion', UI.ChipEl, {text: 'Remotion', dot: C.BLUE}, 1.4, 'Tool-Label', [[0.1, 'pop']]],
  ['Chip ElevenLabs', UI.ChipEl, {text: 'ElevenLabs', dot: C.RED, icon: 2}, 1.4, 'Tool-Label', [[0.1, 'pop']]],
  ['Cursor „Bewerben“', UI.CursorClick, {label: 'Jetzt bewerben', color: C.GREEN}, 1.8, 'Recruiting-CTA', [[0.85, 'tap']]],
  ['Cursor „Kaufen“', UI.CursorClick, {label: 'Jetzt sichern', color: C.RED}, 1.8, 'Verkaufs-CTA', [[0.85, 'tap']]],
  ['Suchleiste KI', UI.SearchBar, {text: 'Wie automatisiere ich Reels?', glow: true}, 2.0, 'Frage eintippen', [[0.3, 'tick', 0.4], [0.7, 'tick', 0.4], [1.1, 'tick', 0.4]]],
  ['Mitteilung Zahlung', UI.Notification, {title: 'ZAHLUNG', body: '990 € erhalten', icon: 2}, 1.7, 'Geld kommt rein', [[0.1, 'chime', 0.8]]],
  ['Mitteilung Termin', UI.Notification, {title: 'KALENDER', body: 'Erstgespräch in 10 Min.', icon: 0}, 1.7, 'Termin', [[0.1, 'chime', 0.8]]],
  ['iMessage Kunde', UI.Chat, {msgs: [{text: 'Kannst du das auch für uns?'}, {me: true, text: 'Klar. Start nächste Woche.'}, {text: 'Deal 🤝'}]}, 2.2, 'Kunden-Chat', [[0.2, 'send'], [0.8, 'pop', 0.6], [1.4, 'send']]],
  ['Kommentare Lob', UI.Comments, {items: [{n: 'anna.k', c: 'Endlich erklärt es mal jemand'}, {n: 'tom.dev', c: 'Gespeichert 🔖'}, {n: 'lisa', c: 'Brauche ich für mein Team'}]}, 2.0, 'Social Proof', [[0.2, 'pop', 0.5], [0.5, 'pop', 0.5], [0.8, 'pop', 0.5]]],
  ['CTA „REEL“', UI.CtaCard, {kw: 'REEL'}, 2.0, 'Keyword-CTA', [[0.2, 'pop'], [1.1, 'tap']]],
  ['CTA „SYSTEM“', UI.CtaCard, {kw: 'SYSTEM'}, 2.0, 'Keyword-CTA', [[0.2, 'pop'], [1.1, 'tap']]],
  ['Schalter Untertitel', UI.Toggle, {label: 'Untertitel'}, 1.6, 'Einstellung', [[0.6, 'tap']]],
  ['Fortschritt Upload', UI.Progress, {label: 'Upload'}, 1.8, 'Hochladen', [[1.3, 'chime', 0.6]]],
  ['Toast „Gepostet“', UI.Toast, {text: 'Gepostet ✓'}, 1.4, 'Erledigt', [[0.1, 'pop', 0.6]]],
]);

export const wd2 = mkAt('W', 17, [
  ['Widget-Stapel', N.WidgetStack, undefined, 2.2, 'Smart Stack blättert', [[0.3, 'swish', 0.3], [0.85, 'swish', 0.3], [1.4, 'swish', 0.3]]],
  ['Widget-Stapel Business', N.WidgetStack, {kinds: ['chart', 'stocks', 'reminders', 'calendar']}, 2.2, 'Business-Kennzahlen', [[0.3, 'swish', 0.3], [0.85, 'swish', 0.3], [1.4, 'swish', 0.3]]],
  ['Widget-Stapel Fokus', N.WidgetStack, {kinds: ['focus', 'timer', 'screen', 'notes']}, 2.2, 'Produktivität', [[0.3, 'swish', 0.3], [0.85, 'swish', 0.3], [1.4, 'swish', 0.3]]],
  ['Widget-Stapel Alltag', N.WidgetStack, {kinds: ['clock', 'weather', 'steps', 'battery']}, 2.2, 'Alltag', [[0.3, 'swish', 0.3], [0.85, 'swish', 0.3], [1.4, 'swish', 0.3]]],
  ['Raster Business', W.WidgetGrid, {kinds: ['chart', 'stocks', 'reminders', 'calendar']}, 2.0, 'Dashboard-Gefühl', [[0.1, 'pop', 0.5], [0.3, 'pop', 0.5], [0.5, 'pop', 0.5]]],
  ['Raster Fokus', W.WidgetGrid, {kinds: ['focus', 'timer', 'notes', 'screen']}, 2.0, 'Fokus-Tag', [[0.1, 'pop', 0.5], [0.3, 'pop', 0.5], [0.5, 'pop', 0.5]]],
  ['Raster Gesundheit', W.WidgetGrid, {kinds: ['rings', 'steps', 'battery', 'clock']}, 2.0, 'Routine', [[0.1, 'pop', 0.5], [0.3, 'pop', 0.5], [0.5, 'pop', 0.5]]],
  ['Raster Reise', W.WidgetGrid, {kinds: ['weather', 'map', 'photos', 'calendar']}, 2.0, 'Reise/Mallorca', [[0.1, 'pop', 0.5], [0.3, 'pop', 0.5], [0.5, 'pop', 0.5]]],
  ['Raster Creator', W.WidgetGrid, {kinds: ['music', 'photos', 'chart', 'notes']}, 2.0, 'Creator-Alltag', [[0.1, 'pop', 0.5], [0.3, 'pop', 0.5], [0.5, 'pop', 0.5]]],
  ...(['weather', 'calendar', 'rings', 'chart', 'stocks', 'timer', 'notes', 'focus'] as W.WKind[]).map((k): Row => [`Widget klein ${({weather: 'Wetter', calendar: 'Kalender', rings: 'Ringe', chart: 'Chart', stocks: 'Aktien', timer: 'Timer', notes: 'Notizen', focus: 'Fokus'} as Record<string, string>)[k]}`, W.WidgetPop, {kind: k, size: 420}, 1.3, 'Kleines Widget neben Text', [[0.08, 'pop', 0.7]]]),
]);

export const d32 = mkAt('3D', 17, [
  ['Glas-Ebenen', N.GlassLayers, undefined, 2.2, 'Schichten eines Systems', [[0, 'swish', 0.5], [0.3, 'pop', 0.4]]],
  ['Glas-Ebenen Funnel', N.GlassLayers, {labels: ['Reichweite', 'Vertrauen', 'Anfrage', 'Kunde']}, 2.2, 'Funnel in 3D', [[0, 'swish', 0.5]]],
  ['Orbit-Ring', N.OrbitRing, undefined, 2.0, 'Verbundenheit', [[0, 'swish', 0.4], [0.2, 'chime', 0.3]]],
  ['Orbit-Ring „Netzwerk“', N.OrbitRing, {word: 'Dein Netzwerk.', n: 60}, 2.0, 'Netzwerk', [[0, 'swish', 0.4]]],
  ['iPhone 3D steht', D3.Phone3D, {spin: false}, 2.0, 'Gerät präsentieren', [[0, 'swish', 0.5]]],
  ['Text-Ring „ULTRA“', D3.TextRing, {text: 'ULTRA · KI · AUTOMATION · ', rad: 400, size: 96}, 2.0, 'Marken-Ring', [[0, 'swish', 0.5]]],
  ['Text-Ring klein', D3.TextRing, {text: 'NEU · NEU · NEU · ', rad: 300, size: 80, speed: 200}, 1.8, 'Neuheit', [[0, 'swish', 0.5]]],
  ['Icon-Orbit dicht', D3.IconOrbit, {n: 14, implode: false}, 2.0, 'Viele Tools', [[0, 'swish', 0.5]]],
  ['Karussell Business', D3.Carousel, {kinds: ['chart', 'stocks', 'calendar', 'reminders', 'notes', 'focus']}, 2.2, 'Business-Karussell', [[0.1, 'swish', 0.5]]],
  ['Cover-Flow 9', D3.CoverFlow, {n: 9}, 2.0, 'Viele Optionen', [[0.4, 'swish', 0.5], [1.0, 'swish', 0.5]]],
  ['Würfel Nutzen', D3.Cube, {faces: ['Zeit', 'Geld', 'Nerven', 'Reichweite']}, 2.2, 'Was du sparst', [[0.5, 'swish', 0.5], [1.2, 'swish', 0.5]]],
  ['Karten-Fächer 7', D3.CardFan, {n: 7}, 1.9, 'Viele Szenen', [[0.1, 'flap', 0.6]]],
  ['Tilt-Karte „Dein Funnel“', D3.TiltCard, {title: 'Dein Funnel'}, 1.9, 'Karte präsentieren', [[0.1, 'swish', 0.4]]],
  ['Flip-Karte Mythos/Fakt', D3.FlipCard, {front: 'Mythos', back: 'Fakt'}, 2.0, 'Mythos aufdecken', [[0.8, 'swish']]],
  ['Galerie-Wand Kunden', D3.GalleryWall, {label: 'Kunden-Reels'}, 2.0, 'Portfolio', [[0.1, 'swish', 0.5]]],
  ['3D-Balken steil', D3.Bars3D, {vals: [0.15, 0.3, 0.55, 0.8, 1]}, 2.0, 'Steiles Wachstum', [[0.2, 'pop', 0.5], [0.5, 'pop', 0.5], [0.8, 'pop', 0.5]]],
  ['Treppe Level', D3.Stairs, {labels: ['Level 1', 'Level 2', 'Level 3']}, 2.0, 'Stufenplan', [[0.2, 'tap'], [0.6, 'tap'], [1.0, 'chime', 0.6]]],
]);

export const mp2 = mkAt('M', 5, [
  ['Stadtkarte Route', N.CityMap, undefined, 2.2, 'Weg zum Termin', [[0.2, 'swish', 0.4], [0.9, 'pin'], [0.3, 'pop', 0.4]]],
  ['Stadtkarte Kunde', N.CityMap, {label: 'Kunde vor Ort', eta: '25 Min.'}, 2.2, 'Kundenbesuch', [[0.2, 'swish', 0.4], [0.9, 'pin']]],
  ['Stadtkarte Büro', N.CityMap, {label: 'Büro Werderstraße', eta: '4 Min.'}, 2.2, 'Büro zeigen', [[0.2, 'swish', 0.4], [0.9, 'pin']]],
  ['Distanz Schwerin → Palma', N.DistanceCard, undefined, 2.2, 'Reise, Remote', [[0.2, 'whoosh2', 0.4], [0.75, 'pin'], [0.6, 'pop', 0.4]]],
  ['Distanz Schwerin → Berlin', N.DistanceCard, {b: 'Berlin', km: '210 km'}, 2.2, 'Nahe Strecke', [[0.2, 'whoosh2', 0.4], [0.75, 'pin']]],
  ['Distanz Hamburg → Dubai', N.DistanceCard, {a: 'Hamburg', b: 'Dubai', km: '4.950 km'}, 2.2, 'Weite Reise', [[0.2, 'whoosh2', 0.4], [0.75, 'pin']]],
  ['Flug nach Sóller', M.MapFlyTo, {search: 'Sóller', place: 'Sóller', sub: 'Mallorca'}, 3.0, 'Anderer Ort auf Mallorca', [[0.3, 'tick', 0.4], [1.0, 'swish'], [2.0, 'pin']]],
  ['Flug nach Alcúdia', M.MapFlyTo, {search: 'Alcúdia', place: 'Alcúdia', sub: 'Mallorca'}, 3.0, 'Strand-Ort', [[0.3, 'tick', 0.4], [1.0, 'swish'], [2.0, 'pin']]],
  ['Radar Kunden', M.Radar, {label: 'Kunden in deiner Nähe'}, 2.0, 'Lokale Kunden', [[0.2, 'synpop', 0.6]]],
  ['Karten-Text PALMA', M.MapText, {text: 'PALMA'}, 2.0, 'Ortsname groß', [[0.1, 'thump', 0.6]]],
]);

export const da2 = mkAt('DA', 11, [
  ['Ziel-Ringe', N.GoalRings, undefined, 2.0, 'Drei Ziele erfüllt', [[0.1, 'swish', 0.4], [1.0, 'chime', 0.5]]],
  ['Ziel-Ringe Content', N.GoalRings, {vals: [1, 0.82, 0.6], labels: ['Drehs', 'Schnitte', 'Posts']}, 2.0, 'Content-Ziele', [[0.1, 'swish', 0.4], [1.0, 'chime', 0.5]]],
  ['KPI klappt hoch', N.KpiFlip, undefined, 2.0, 'Umsatz steigt', [[0, 'flap', 0.5], [0.43, 'flap', 0.5], [0.85, 'flap', 0.5], [1.28, 'flap', 0.5]]],
  ['KPI Follower', N.KpiFlip, {label: 'Follower', vals: ['1.200', '4.800', '12.000', '31.000']}, 2.0, 'Follower steigen', [[0, 'flap', 0.5], [0.43, 'flap', 0.5], [0.85, 'flap', 0.5], [1.28, 'flap', 0.5]]],
  ['Heatmap', N.Heatmap, undefined, 1.8, 'Konsistenz zeigen', [[0.1, 'swish', 0.3]]],
  ['Heatmap Streak', N.Heatmap, {label: '90 Tage am Stück'}, 1.8, 'Durchhalten', [[0.1, 'swish', 0.3]]],
  ['Ring Retention', DA.RingStat, {v: 0.64, label: 'Retention', color: C.BLUE}, 2.0, 'Zuschauer halten', [[1.1, 'chime', 0.6]]],
  ['Ring Zufriedenheit', DA.RingStat, {v: 0.99, label: 'Zufriedenheit', color: C.GREEN}, 2.0, 'Kundenzufriedenheit', [[1.1, 'chime', 0.6]]],
  ['Balken Woche', DA.BarChart, {vals: [0.2, 0.25, 0.4, 0.38, 0.6, 0.8, 1]}, 2.0, 'Wochen-Wachstum', [[0.2, 'pop', 0.4], [0.4, 'pop', 0.4], [0.6, 'pop', 0.4]]],
  ['Vorher/Nachher Kosten', DA.BeforeAfter, {a: '2.000 €', b: '300 €'}, 2.0, 'Kosten senken', [[0.9, 'swish']]],
  ['Zeitstrahl 90 Tage', DA.Timeline, {steps: ['Start', 'Tag 30', 'Tag 60', 'Tag 90']}, 2.2, 'Entwicklung', [[0.2, 'tap'], [0.6, 'tap'], [1.0, 'tap'], [1.4, 'tap']]],
  ['Badge Platz 1', DA.Badge, {text: 'Platz 1', color: C.BLUE}, 1.6, 'Ranking', [[0.1, 'pop'], [0.5, 'chime', 0.5]]],
  ['Vergleich Agentur/KI', DA.Compare, {a: 'Agentur', b: 'KI-System', va: 0.3, vb: 0.9}, 2.0, 'Gegenüberstellung', [[0.3, 'pop', 0.5]]],
]);

export const fx2 = mkAt('FX', 12, [
  ['Wellen', N.Ripples, undefined, 1.8, 'Ausbreitung', [[0, 'synpop', 0.4]]],
  ['Wellen Grün', N.Ripples, {color: C.GREEN}, 1.8, 'Erfolg breitet sich aus', [[0, 'synpop', 0.4]]],
  ['Glas-Kugeln', N.GlassOrbs, undefined, 1.8, 'Premium-Deko', [[0.1, 'pop', 0.3]]],
  ['Lichtstreifen fliegen', N.LightStreaks, undefined, 1.6, 'Tempo im Hintergrund', [[0, 'whoosh2', 0.3]]],
  ['Lichtstreifen Rot', N.LightStreaks, {color: C.RED}, 1.6, 'Tempo warm', [[0, 'whoosh2', 0.3]]],
  ['Konfetti viel', FX.Confetti, {box: [220, 600, 640, 640], n: 140}, 1.8, 'Großer Erfolg', [[0.05, 'boom', 0.5]]],
  ['Strahlen Rot', FX.Rays, {color: C.RED}, 1.8, 'Warmer Reveal'],
  ['Strahlen Grün', FX.Rays, {color: C.GREEN}, 1.8, 'Erfolgs-Reveal'],
  ['Sparkles viele', FX.Sparkles, {n: 30}, 1.6, 'Magie', [[0.1, 'chime', 0.5]]],
  ['Glow-Punkt Grün', FX.GlowDot, {color: C.GREEN}, 1.5, 'Status online', [[0.1, 'synpop', 0.5]]],
  ['Puls Rot', FX.Pulse, {color: C.RED}, 1.6, 'Live/Aufnahme'],
  ['Emoji-Regen Geld', FX.EmojiRain, {emoji: ['💸', '💰', '🤑', '📈']}, 1.8, 'Geld-Flut', [[0.1, 'pop', 0.4]]],
  ['Schockwelle Rot', FX.Shockwave, {color: C.RED}, 1.4, 'Harter Aufprall', [[0.05, 'boom', 0.7]]],
]);

export const tr2 = mkAt('TR', 10, [
  ['Pille füllt Screen', N.TrPillMorph, undefined, 1.2, 'Objekt wird Hintergrund', [[0.2, 'swish', 0.5]]],
  ['Pille füllt Blau', N.TrPillMorph, {color: C.BLUE}, 1.2, 'Blauer Morph', [[0.2, 'swish', 0.5]]],
  ['Pille füllt Rot', N.TrPillMorph, {color: C.RED}, 1.2, 'Roter Morph', [[0.2, 'swish', 0.5]]],
  ['Blur-Push', N.TrBlurPush, undefined, 1.0, 'Sanfter Wechsel', [[0.2, 'swish', 0.4]]],
  ['Blur-Push Weiß', N.TrBlurPush, {color: '#FFFFFF'}, 1.0, 'Heller Wechsel', [[0.2, 'swish', 0.4]]],
  ['Iris Blau', FX.TrIris, {color: C.BLUE}, 1.4, 'Kreis blau', [[0.4, 'swish']]],
  ['Iris Schwarz', FX.TrIris, {color: C.INK}, 1.4, 'Kreis dunkel', [[0.4, 'swish']]],
  ['Punkt füllt Grün', FX.TrDotFill, {color: C.GREEN}, 1.4, 'Erfolgs-Wechsel', [[0.3, 'synpop']]],
  ['Punkt füllt Rot', FX.TrDotFill, {color: C.RED}, 1.4, 'Warn-Wechsel', [[0.3, 'synpop']]],
  ['Panel Blau', FX.TrPanel, {color: C.BLUE}, 1.4, 'Fläche blau', [[0.4, 'swish']]],
  ['Panel Grün', FX.TrPanel, {color: C.GREEN}, 1.4, 'Fläche grün', [[0.4, 'swish']]],
  ['Panel Schwarz', FX.TrPanel, {color: C.INK}, 1.4, 'Fläche dunkel', [[0.4, 'swish']]],
]);

export const av2 = mkAt('AV', 7, [
  ['Gesicht in der Island', N.FaceIsland, undefined, 2.0, 'Leif aus der Dynamic Island', [[0.15, 'synpop'], [0.3, 'swish', 0.5]]],
  ['Gesicht + Glas-Karte', N.FaceGlassCard, undefined, 2.2, 'Vorstellung mit Titel', [[0, 'swish', 0.4], [0.3, 'pop', 0.5]]],
  ['Gesicht + Glas-Karte Contenthütte', N.FaceGlassCard, {role: 'Inhaber · Contenthütte'}, 2.2, 'Vorstellung Contenthütte', [[0, 'swish', 0.4], [0.3, 'pop', 0.5]]],
  ['FaceTime ohne Badge', AV.FaceTile, {live: false}, 2.2, 'Leif spricht, ruhig'],
  ['FaceTime späterer Satz', AV.FaceTile, {start: 2.5}, 2.2, 'Anderer Ausschnitt'],
  ['FaceTime Buttons pur', AV.FaceTile, {controls: true, live: false}, 2.2, 'Anruf-Look ohne Badge', [[0.35, 'pop', 0.5]]],
  ['Punkt → Kachel spät', AV.DotToTile, {start: 1.5}, 2.4, 'Hook, anderer Satz', [[0, 'synpop'], [0.25, 'swish', 0.6]]],
  ['Kachel → Island Handle', AV.TileToIsland, {name: 'dunkelmann.ai'}, 1.8, 'Outro mit Handle', [[0.05, 'swish', 0.6], [0.5, 'synpop']]],
  ['Avatar-Ring ULTRA', AV.AvatarBadge, {text: 'ULTRA · KI-BERATUNG · '}, 2.0, 'Marken-Intro', [[0.1, 'pop']]],
  ['Avatar-Ring Contenthütte', AV.AvatarBadge, {text: 'CONTENTHÜTTE · MARKETING · '}, 2.0, 'Agentur-Intro', [[0.1, 'pop']]],
  ['Polaroid Schwerin', AV.Polaroid, {caption: 'Schwerin, 2026'}, 2.0, 'Herkunft', [[0.35, 'thump', 0.6]]],
  ['Polaroid „Tag 1“', AV.Polaroid, {caption: 'Tag 1'}, 2.0, 'Anfang der Reise', [[0.35, 'thump', 0.6]]],
  ['Polaroid „Damals.“', AV.Polaroid, {caption: 'Damals.'}, 2.0, 'Rückblick', [[0.35, 'thump', 0.6]]],
]);
