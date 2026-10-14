// KU · Creator-UI im Kleinecke-Stil: Schnitt-Timeline, Neon-Spuren, Kurven-Editor, Views, Kommentare, Chats
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Base, C, disp, serif, useT, p, lerp, cl, rnd, EXPO, INOUT, Cursor, Glass, useTheme, tpick} from '../core';
import {fade, Thumb, FaceBox, Emoji, pop, wob, Hand, Doodle, Cutout} from './kit';

const DK = 'radial-gradient(circle at 50% 40%, #1C2430, #07090D 75%)';
const has = (a?: unknown[]) => !!(a && a.length);
// Zahl kompakt: 1,2 Mio. / 247k / 4.711
const fmtN = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',').replace(/,0$/, '')} Mio.` : n >= 1e4 ? `${Math.round(n / 1000)}k` : Math.round(n).toLocaleString('de-DE');
// Schriftgröße so, dass ein Wort in `room` px passt
const fit = (txt: string, size: number, room = 960, k = 0.62) => Math.min(size, Math.round(room / Math.max(1, txt.length * k)));
// 1 · Schnitt-Timeline: Waveform, Playhead-Marker, Wörter
export const KTimeline: React.FC<Base & {words?: string[]; cut?: boolean}> = ({words: wordsP, cut = true, dur}) => {
  const t = useT();
  const th = useTheme();
  const words = wordsP ?? (has(th.words) ? th.words! : ['von der', 'Rohdatei', 'Pausen', 'raus']);
  // 8 Clips statt 5: Spur reicht bis zum Ende über den rechten Rand (vorher leerer Bereich rechts)
  const W = 4000; const off = -t * 900;
  const seg = (t / dur) * words.length;
  const wi = Math.min(words.length - 1, Math.floor(seg));
  const gap = cut ? p(t, dur * 0.62, 0.25, EXPO) : 0;
  const wave = (i: number) => 20 + Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11)) * 90 + rnd(i) * 30;
  return (
    <AbsoluteFill style={{background: DK, opacity: fade(t, dur), overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: off + 300, top: 760, width: W, height: 300}}>
        {[0, 1].map((r) => <div key={r} style={{position: 'absolute', left: 0, top: r * 160, width: W, height: 140, display: 'flex', gap: 10}}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((b) => { const red = cut && r === 1 && b === 2; return <div key={b} style={{width: red ? lerp(gap, 480, 0) : 480, height: 140, borderRadius: 18, background: red ? `${C.RED}CC` : r ? 'rgba(68,200,230,.25)' : 'rgba(68,200,230,.55)', overflow: 'hidden', display: 'flex', alignItems: 'flex-end', gap: 3, padding: '0 6px', opacity: red ? 1 - gap : 1, flexShrink: 0}}>
            {r === 1 ? Array.from({length: 60}, (_, i) => <div key={i} style={{width: 5, height: wave(b * 60 + i), background: red ? '#FFB3AE' : '#5FE1FF', borderRadius: 2}} />) : null}</div>; })}
        </div>)}
      </div>
      {[0, 1, 2, 3].map((i) => { const x = 160 + i * 240; return <div key={i} style={{position: 'absolute', left: x, top: 640, height: 560, width: 6, background: C.BLUE, opacity: i <= wi ? 1 : 0.15, boxShadow: `0 0 20px ${C.BLUE}`}}><div style={{position: 'absolute', left: -14, top: -20, width: 34, height: 30, background: C.BLUE, clipPath: 'polygon(0 0,100% 0,100% 60%,50% 100%,0 60%)'}} /></div>; })}
      <div style={{position: 'absolute', left: 0, right: 0, top: 1240, textAlign: 'center', ...disp(700, fit(words[wi] ?? '', 96), -0.03), color: '#fff', whiteSpace: 'nowrap', transform: `scale(${pop(seg % 1, 0, 0.3)})`}}>{words[wi]}</div>
    </AbsoluteFill>
  );
};
// 2 · Neon-Spuren in 3D (Ebenen eines Schnittprogramms)
const TRK0 = ['V1 Video', 'T Text', 'A1 Musik', 'FX', 'V2 B-Roll'];
export const KNeonTracks: React.FC<Base & {cut?: boolean; label?: string; tracks?: string[]}> = ({cut = true, label: labelP, tracks = TRK0, dur}) => {
  const t = useT();
  const th = useTheme();
  const label = labelP !== undefined ? labelP : has(th.words) ? tpick(th.words, [], 0) : 'Wir suchen:';
  const cols = [C.GREEN, '#3EE6FF', C.RED, '#FFFFFF', C.BLUE];
  // nahtlose Schleife: Muster aus 6 Spuren (Periode P) 3× hintereinander, Versatz modulo P → kein sichtbarer Rücksprung
  const pw = (r: number, i: number) => Math.round(380 + rnd(r * 7 + i) * 300) + 30;
  const per = (r: number) => Array.from({length: 6}, (_, i) => pw(r, i)).reduce((a, b) => a + b, 0);
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 30%, #2A2E3A, #0B0C10 70%)', opacity: fade(t, dur), perspective: 900, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 540, top: 1150, transformStyle: 'preserve-3d', transform: `rotateX(62deg) rotateZ(${-18 + t * 4}deg)`}}>
        {Array.from({length: 7}, (_, r) => { const P = per(r); return <div key={r} style={{position: 'absolute', left: -1400 - P, top: -900 + r * 230, display: 'flex', transform: `translateX(${(t * (300 + r * 40)) % P}px)`}}>
          {Array.from({length: 18}, (_, j) => { const i = j % 6; const c = cols[(r + i) % cols.length]; return <div key={j} style={{width: pw(r, i) - 30, marginRight: 30, flexShrink: 0, height: 120, borderRadius: 30, background: c, boxShadow: `0 0 40px ${c}, 0 0 90px ${c}88`, display: 'flex', alignItems: 'center', padding: '0 26px', boxSizing: 'border-box', overflow: 'hidden', whiteSpace: 'nowrap', ...disp(700, 40, 0), color: c === '#FFFFFF' ? '#555' : '#fff'}}>{tracks[(r + i) % tracks.length]}</div>; })}
        </div>; })}
      </div>
      {label ? <div style={{position: 'absolute', left: 80, top: 330, whiteSpace: 'nowrap', ...disp(700, fit(label, 90, 920), -0.03), color: '#fff', opacity: p(t, 0.1, 0.2)}}>{label}</div> : null}
      {cut ? <div style={{position: 'absolute', left: 540 - 140, top: 600, transform: `scale(${pop(t, 0.3, 0.3)})`}}><FaceBox x={0} y={0} w={280} h={360} r={30} style={{boxShadow: '0 0 60px rgba(255,255,255,.3)'}} /></div> : null}
    </AbsoluteFill>
  );
};
// 3 · Kurven-Editor: S-Kurve mit Griffen, Cursor zieht
export const KGraphEditor: React.FC<Base & {label?: string; sub?: string; color?: string}> = ({label: labelP, sub: subP, color = C.GREEN, dur}) => {
  const t = useT();
  const th = useTheme();
  const label = labelP ?? tpick(th.words, ['Animationen'], 0);
  // Untertitel: Prop > Thema (topic, sonst 2. Wort) > alter Default
  const sub = subP ?? th.topic ?? (has(th.words) ? tpick(th.words, [], 1) : 'Geschwindigkeit');
  const k = p(t, 0.35, 0.5, EXPO);
  const hx = lerp(k, 380, 640);
  const d = `M 240 1240 C ${hx} 1240, ${1080 - hx} 760, 840 760`;
  return (
    <AbsoluteFill style={{background: '#0A0B0E', opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 80, top: 330, whiteSpace: 'nowrap', ...disp(700, fit(label, 90, 920), -0.03), color: '#fff'}}>{label}<div style={{...disp(500, fit(sub, 30, 920, 0.55), 0), color: '#9AA0AA'}}>{sub}</div></div>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <line x1={0} y1={1240} x2={1080} y2={1240} stroke={color} strokeWidth={4} strokeDasharray="14 12" opacity={0.6} />
        <line x1={0} y1={760} x2={1080} y2={760} stroke={color} strokeWidth={4} strokeDasharray="14 12" opacity={0.6} />
        <path d={d} stroke={color} strokeWidth={12} fill="none" style={{filter: `drop-shadow(0 0 14px ${color})`}} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p(t, 0, 0.35, EXPO)} />
        <line x1={240} y1={1240} x2={hx} y2={1240} stroke={C.SUN} strokeWidth={8} /><line x1={840} y1={760} x2={1080 - hx} y2={760} stroke={C.SUN} strokeWidth={8} />
        {[[hx, 1240], [1080 - hx, 760], [240, 1240], [840, 760]].map(([x, y], i) => <rect key={i} x={x - 16} y={y - 16} width={32} height={32} fill={i < 2 ? C.SUN : '#fff'} stroke="#000" strokeWidth={3} />)}
      </svg>
      <Cursor x={hx + 10} y={1250} down={t > 0.3 && t < 0.9} />
    </AbsoluteFill>
  );
};
// 4 · Browser-Fenster: Video + Views zählen hoch
// to = Ziel in Tausend (247 → 247k); Thema: th.numbers[0] als absolute Zahl
export const KBrowserViews: React.FC<Base & {to?: number; unit?: string}> = ({to: toP, unit = 'Views', dur}) => {
  const t = useT();
  const th = useTheme();
  const to = toP ?? (has(th.numbers) ? th.numbers![0] / 1000 : 247);
  const from = to > 60 ? 41 : to * 0.2;
  const v = fmtN(lerp(p(t, 0.15, dur - 0.4, EXPO), from, to) * 1000);
  return (
    <AbsoluteFill className="dl-root" style={{background: '#E9EAEE', opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 110, top: 380, width: 860, height: 1100, background: '#fff', borderRadius: 30, boxShadow: '0 40px 90px rgba(0,0,0,.18)', overflow: 'hidden', transform: `scale(${pop(t, 0, 0.3)})`}}>
        <div style={{height: 70, background: '#F2F2F4', display: 'flex', alignItems: 'center', gap: 12, padding: '0 26px'}}>{['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{width: 20, height: 20, borderRadius: 10, background: c}} />)}<div style={{marginLeft: 20, width: 400, height: 30, borderRadius: 15, background: '#E3E3E7'}} /></div>
        <div style={{margin: 30, border: `6px solid ${C.BLUE}`, borderRadius: 12, overflow: 'hidden'}}><Thumb seed={600} w={788} h={440} r={0} views={false} /></div>
        <div style={{display: 'flex', alignItems: 'center', gap: 24, padding: '0 40px'}}><FaceBox x={0} y={0} w={110} h={110} r={55} video={false} style={{position: 'relative'}} /><div style={{...disp(800, fit(`${v} ${unit}`, 92, 640, 0.6), -0.04), color: C.INK, whiteSpace: 'nowrap'}}>{v} {unit}</div></div>
        {[0, 1, 2].map((i) => <div key={i} style={{display: 'flex', gap: 22, alignItems: 'center', padding: '22px 40px 0'}}><div style={{width: 56, height: 56, borderRadius: 28, background: [C.BLUE, C.RED, C.GREEN][i], opacity: 0.6}} /><div style={{flex: 1, height: 44, borderRadius: 22, background: '#EDEDF0'}} /></div>)}
      </div>
    </AbsoluteFill>
  );
};
// 5 · Kommentar-Fenster stapeln sich
const CM = [['max.builds', 'Wie krass ist der Schnitt 🔥'], ['lena.creates', 'Welche Software??'], ['jonas', 'brauch ich für meine Firma'], ['sarah.ai', 'Erklär mal bitte 🙏'], ['tim_v', 'Das System will ich'], ['nora', 'Bester Content gerade']];
export const KCommentStack: React.FC<Base & {n?: number; items?: string[][]}> = ({n = 6, items, dur}) => {
  const t = useT();
  const th = useTheme();
  const hs = has(th.handles) ? th.handles : th.names;
  const list = items ?? CM.map(([u, c], i) => [tpick(hs, CM.map((x) => x[0]), i).replace(/^@/, ''), tpick(th.comments, CM.map((x) => x[1]), i)]);
  return (
    <AbsoluteFill className="dl-root" style={{background: '#EEEFF2', opacity: fade(t, dur), overflow: 'hidden'}}>
      {Array.from({length: Math.min(n, 6)}, (_, i) => list[i % list.length]).map(([u, c], i) => <div key={i} style={{position: 'absolute', left: 60 + (i % 3) * 60, top: 400 + i * 175, width: 820, transform: `scale(${pop(t, i * 0.12, 0.22)}) rotate(${(rnd(i) - 0.5) * 6}deg)`, background: '#fff', borderRadius: 18, boxShadow: '0 16px 40px rgba(0,0,0,.14)', overflow: 'hidden'}}>
        <div style={{height: 34, background: '#F4F4F6', display: 'flex', gap: 8, alignItems: 'center', padding: '0 14px'}}>{['#FF5F57', '#FEBC2E', '#28C840'].map((x) => <div key={x} style={{width: 12, height: 12, borderRadius: 6, background: x}} />)}</div>
        <div style={{display: 'flex', gap: 18, padding: 20, alignItems: 'center'}}><div style={{width: 64, height: 64, borderRadius: 32, background: [C.BLUE, C.RED, C.GREEN][i % 3]}} /><div><div style={{...disp(600, 24, 0), color: C.GREY}}>@{u} · vor {i + 1} Std.</div><div style={{...disp(600, 36, -0.01), color: C.INK}}>{c}</div><div style={{...disp(500, 24, 0), color: C.GREY, marginTop: 6}}>👍 {Math.round(rnd(i + 3) * 200)}   Antworten</div></div></div>
      </div>)}
    </AbsoluteFill>
  );
};
// 6 · Instagram-artiger Kommentar mit Reaktionen
export const KIgComment: React.FC<Base & {text?: string; y?: number; face?: boolean; name?: string}> = ({text: textP, y = 900, face = true, name: nameP, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = textP ?? th.kw ?? tpick(th.comments, ['Bewerbung'], 0);
  const name = nameP ?? tpick(th.names, ['Leif Dunkelmann'], 0);
  const n = Math.min(text.length, Math.floor(Math.max(0, t - 0.25) * 18));
  const rx = [Math.round(p(t, 0.5, 0.8) * 9), Math.round(p(t, 0.6, 0.8) * 6), Math.round(p(t, 0.7, 0.8) * 4), Math.round(p(t, 0.8, 0.8) * 2)];
  return (
    <AbsoluteFill className="dl-root" style={{background: face ? '#F6F3F5' : 'transparent', opacity: fade(t, dur)}}>
      {face ? <Cutout x={540} y={1620} h={1300} /> : null}
      <div style={{position: 'absolute', left: 90, top: y, width: 900, transform: `scale(${lerp(pop(t, 0, 0.3), 0.3, 1)})`, background: '#fff', borderRadius: 36, boxShadow: '0 24px 60px rgba(0,0,0,.18)', padding: '26px 30px', display: 'flex', gap: 22}}>
        <FaceBox x={0} y={0} w={96} h={96} r={48} video={false} style={{position: 'relative', flexShrink: 0}} />
        <div style={{flex: 1}}>
          <div style={{...disp(700, 30, 0), color: C.INK}}>{name} <span style={{color: C.GREY, fontWeight: 500}}>· 1 Min.</span></div>
          <div style={{...disp(500, 38, -0.01), color: C.INK, marginTop: 6, height: 46}}>{text.slice(0, n)}</div>
          <div style={{display: 'flex', gap: 26, marginTop: 10}}>{['❤️', '🔥', '😂', '👏'].map((e, i) => <div key={i} style={{display: 'flex', alignItems: 'center', gap: 6, ...disp(600, 26, 0), color: C.GREY, background: i === 1 && rx[1] > 3 ? `${C.GREEN}22` : 'transparent', borderRadius: 14, padding: '2px 8px', transform: `scale(${1 + (rx[i] > 0 ? 0.16 * Math.pow(Math.sin(Math.PI * ((t % 0.3) / 0.3)), 2) : 0)})`}}>{e} {rx[i]}</div>)}</div>
        </div>
        <div style={{...disp(700, 30, 0), color: C.GREY}}>···</div>
      </div>
    </AbsoluteFill>
  );
};
// 7 · Story-Ring: dreht, wird grün, $-Zeichen kreisen
export const KStoryRing: React.FC<Base & {money?: boolean}> = ({money = true, dur}) => {
  const t = useT();
  const g = money ? p(t, 0.7, 0.2) : 0;
  const ring = `conic-gradient(from ${t * 200}deg, ${C.RED}, ${C.SUN}, #C13584, ${C.RED})`;
  return (
    <AbsoluteFill className="dl-root" style={{background: '#F4F4F5', opacity: fade(t, dur), alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'relative', width: 460, height: 460, marginTop: -100, transform: `scale(${pop(t, 0, 0.3)}) rotateY(${p(t, 0.5, 0.3, INOUT) * 360}deg)`}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: ring, opacity: 1 - g}} />
        <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: C.GREEN, opacity: g, boxShadow: `0 0 60px ${C.GREEN}`}} />
        <div style={{position: 'absolute', inset: 18, borderRadius: '50%', background: '#fff'}} />
        <FaceBox x={30} y={30} w={400} h={400} r={200} />
        {money ? Array.from({length: 5}, (_, i) => { const a = t * 3 + (i / 5) * Math.PI * 2; return <div key={i} style={{position: 'absolute', left: 230 + Math.cos(a) * 280 - 30, top: 230 + Math.sin(a) * 280 - 40, ...disp(900, 80, 0), color: C.GREEN, opacity: g, textShadow: '0 0 0 #fff'}}>$</div>; }) : null}
      </div>
    </AbsoluteFill>
  );
};
// 8 · Chat-Liste (dunkelgrün), eine Zeile tippt
const CL0 = [['A-Player', 'Ich brauch noch 5 Tage'], ['B-Player', '3 Raw-Cuts sind fertig'], ['B-Player', 'Sound Design ist durch :)'], ['B-Player', 'Animationen fertig!']];
export const KChatList: React.FC<Base & {rows?: string[][]; typing?: string}> = ({rows: rowsP, typing = 'schreibt …', dur}) => {
  const t = useT();
  const th = useTheme();
  const rows = rowsP ?? CL0.map((r, i) => [tpick(th.names, CL0.map((x) => x[0]), i), tpick(th.comments, CL0.map((x) => x[1]), i)]);
  const hi = Math.min(rows.length - 1, Math.floor(t / 0.35));
  // Hervorhebung blendet weich von Zeile zu Zeile (vorher Sprung)
  const hw = (i: number) => (i === 0 ? 1 : cl((t - i * 0.35) / 0.08)) - (i < rows.length - 1 ? cl((t - (i + 1) * 0.35) / 0.08) : 0);
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 30% 20%, #1F4A33, #0C1F15 70%)', opacity: fade(t, dur), perspective: 1200}}>
      <div style={{position: 'absolute', left: 60, top: 360, width: 960, transform: `rotateX(${8 - t * 3}deg) rotateY(${-6 + t * 3}deg)`}}>
        <div style={{height: 76, borderRadius: 38, background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', padding: '0 30px', ...disp(500, 30, 0), color: 'rgba(255,255,255,.5)'}}>🔍  Suchen oder neuen Chat beginnen</div>
        <div style={{display: 'flex', gap: 14, margin: '22px 0 30px'}}>{['Alle', 'Ungelesen', 'Favoriten', 'Gruppen'].map((s, i) => <div key={s} style={{padding: '8px 22px', borderRadius: 22, background: i === 0 ? '#2F7A52' : 'rgba(255,255,255,.08)', color: '#fff', ...disp(600, 26, 0)}}>{s}</div>)}</div>
        {rows.map(([n, m], i) => { const k = p(t, i * 0.1, 0.25, EXPO); return <div key={i} style={{display: 'flex', alignItems: 'center', gap: 26, padding: '22px 20px', borderRadius: 24, background: `rgba(255,255,255,${(0.12 * hw(i)).toFixed(3)})`, transform: `translateX(${lerp(k, 300, 0)}px) scale(${1 + 0.04 * hw(i)})`, opacity: k}}>
          <div style={{width: 100, height: 100, borderRadius: 50, background: 'rgba(255,255,255,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60, color: '#4A4F55'}}>●</div>
          <div style={{minWidth: 0, flex: 1}}><div style={{...disp(700, 52, -0.01), color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{n}</div><div style={{...disp(500, 38, 0), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: i === hi && t % 0.7 < 0.35 ? C.GREEN : 'rgba(255,255,255,.6)'}}>{i === hi && t % 0.7 < 0.35 ? typing : m}</div></div>
        </div>; })}
      </div>
    </AbsoluteFill>
  );
};
// 9 · Kanal-Seite (dunkel) scrollt, großes Wort drüber
export const KChannel: React.FC<Base & {word?: string; name?: string; handle?: string; subs?: number}> = ({word: wordP, name: nameP, handle: handleP, subs: subsP, dur}) => {
  const t = useT();
  const th = useTheme();
  const word = wordP ?? tpick(th.words, ['auf'], 0);
  const name = nameP ?? tpick(th.names, ['Leif Dunkelmann'], 0);
  const handle = (handleP ?? tpick(has(th.handles) ? th.handles : th.names, ['dunkelmann.ai'], 0)).replace(/^@/, '').replace(/\s+/g, '').toLowerCase();
  const subs = subsP ?? tpick(th.numbers, [128000], 0);
  return (
    <AbsoluteFill style={{background: '#0F0F10', opacity: fade(t, dur), overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, transform: `translateY(${-p(t, 0.3, dur, EXPO) * 300}px)`}}>
        <div style={{display: 'flex', gap: 30, alignItems: 'center', padding: '300px 50px 30px'}}><FaceBox x={0} y={0} w={190} h={190} r={95} video={false} style={{position: 'relative'}} /><div style={{minWidth: 0, flex: 1}}><div style={{...disp(700, 62, -0.02), color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{name}</div><div style={{...disp(500, 28, 0), color: '#AAA', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>@{handle} · {subs.toLocaleString('de-DE')} Abonnenten</div><div style={{marginTop: 16, display: 'inline-block', background: '#fff', color: '#000', borderRadius: 30, padding: '10px 30px', ...disp(700, 28, 0)}}>Abonnieren</div></div></div>
        <div style={{display: 'flex', gap: 30, padding: '20px 50px', ...disp(600, 30, 0), color: '#fff'}}>{['Übersicht', 'Videos', 'Shorts', 'Live'].map((s, i) => <span key={s} style={{opacity: i === 1 ? 1 : 0.5, borderBottom: i === 1 ? '4px solid #fff' : 'none', paddingBottom: 8}}>{s}</span>)}</div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: '20px 50px'}}>{Array.from({length: 8}, (_, i) => <Thumb key={i} seed={i + 640} w={480} h={290} r={14} />)}</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 820, textAlign: 'center', whiteSpace: 'nowrap', ...disp(800, fit(word, 180, 1000, 0.66), -0.04), color: '#fff', textShadow: '0 10px 40px rgba(0,0,0,.8)', transform: `scale(${pop(t, 0.15, 0.25)})`}}>{word}</div>
    </AbsoluteFill>
  );
};
// 10 · Retention-Kurve: Achsen + Kurve + %-Zähler
export const KRetention: React.FC<Base & {from?: number; to?: number; label?: string; sketch?: boolean}> = ({from = 28.2, to: toP, label = 'Beibehaltungsrate', sketch = false, dur}) => {
  const t = useT();
  const th = useTheme();
  const tn = th.numbers?.[0];
  const to = toP ?? (tn !== undefined && tn > from && tn <= 100 ? tn : 35.0);
  const k = p(t, 0.2, dur - 0.5, EXPO);
  const v = lerp(k, from, to);
  return (
    <AbsoluteFill className="dl-root" style={{background: '#fff', opacity: fade(t, dur)}}>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <path d="M 180 560 L 180 1240 L 940 1240" stroke={sketch ? C.RED : C.INK} strokeWidth={8} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p(t, 0, 0.25, EXPO)} />
        <path d="M 150 600 L 180 560 L 210 600 M 900 1210 L 940 1240 L 900 1270" stroke={sketch ? C.RED : C.INK} strokeWidth={8} fill="none" strokeLinecap="round" opacity={p(t, 0.2, 0.1)} />
        <path d={`M 190 1230 C 330 ${lerp(k, 1100, 760)}, 520 ${lerp(k, 900, 640)}, ${lerp(k, 500, 880)} ${lerp(k, 880, 620)}`} stroke={sketch ? C.RED : C.INK} strokeWidth={10} fill="none" strokeLinecap="round" />
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1300, textAlign: 'center'}}><div style={{...disp(600, 34, 0), color: C.GREY}}>{label}</div><div style={{...disp(800, 110, -0.03), color: C.INK}}>{v.toFixed(1).replace('.', ',')} %</div></div>
    </AbsoluteFill>
  );
};
// 11 · Organigramm (RAWCUT → Editoren …)
const ORG0 = ['RAWCUT', 'MOTION', 'SOUND', 'FINAL'], ORGN0 = ['Editor 1', 'Editor 2', 'Editor 3', 'Leif'];
export const KOrgTree: React.FC<Base & {labels?: string[]; names?: string[]}> = ({labels, names, dur}) => {
  const t = useT();
  const th = useTheme();
  const N: [number, number, string, string][] = ([[390, 400], [130, 800], [650, 800], [390, 1200]] as [number, number][]).map(([x, y], i) => [x, y, (labels?.[i] ?? tpick(th.words, ORG0, i)).toUpperCase(), names?.[i] ?? tpick(th.names, ORGN0, i)]);
  return (
    <AbsoluteFill className="dl-root" style={{background: '#fff', opacity: fade(t, dur)}}>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>{[[0, 1], [0, 2], [1, 3], [2, 3]].map(([a, b], i) => <path key={i} d={`M ${N[a][0] as number + 150} ${N[a][1] as number + 200} L ${N[a][0] as number + 150} ${(N[a][1] as number + N[b][1] as number) / 2 + 100} L ${N[b][0] as number + 150} ${(N[a][1] as number + N[b][1] as number) / 2 + 100} L ${N[b][0] as number + 150} ${N[b][1] as number}`} stroke={C.GREY} strokeWidth={4} fill="none" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p(t, 0.2 + i * 0.12, 0.25)} />)}</svg>
      {N.map(([x, y, a, b], i) => <div key={i} style={{position: 'absolute', left: x as number, top: y as number, transform: `scale(${pop(t, i * 0.15, 0.25)})`}}><Thumb seed={i + 680} w={300} h={190} r={10} views={false} /><div style={{display: 'flex', justifyContent: 'space-between', marginTop: 8, width: 300}}><span style={{...disp(700, 24, 0.03), color: C.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160}}>{a}</span><span style={{...serif(28), color: C.GREY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140}}>{b}</span></div></div>)}
    </AbsoluteFill>
  );
};
// 12 · Kollaboration: mehrere benannte Cursor + „Ready!“
export const KCollab: React.FC<Base & {names?: string[]; done?: string}> = ({names, done = 'Ready!', dur}) => {
  const t = useT();
  const th = useTheme();
  const cur = [C.BLUE, C.RED, C.GREEN].map((c, i) => [c, names?.[i] ?? tpick(th.names, ['Editor 1', 'Editor 2', 'Leif'], i), i]) as [string, string, number][];
  return (
    <AbsoluteFill className="dl-root" style={{background: '#F6F6F8', opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 190, top: 640, transform: `scale(${pop(t, 0, 0.3)}) rotate(-2deg)`}}><Thumb seed={700} w={700} h={480} r={20} /></div>
      <div style={{position: 'absolute', left: 760, top: 600, background: C.GREEN, color: '#fff', ...disp(800, 40, 0), padding: '6px 18px', borderRadius: 8, transform: `scale(${pop(t, dur - 0.7, 0.25)})`}}>{done}</div>
      {cur.map(([c, n, i]) => { const x = 300 + Math.sin(t * 2.4 + i * 2) * 260 + i * 120, y = 760 + Math.cos(t * 2 + i) * 200; return <div key={i} style={{position: 'absolute', left: x, top: y}}>
        <svg width={44} height={52}><path d="M2 2 L 2 44 L 14 32 L 24 50 L 32 46 L 22 28 L 40 28 Z" fill={c} stroke="#fff" strokeWidth={3} /></svg>
        <div style={{marginLeft: 30, marginTop: -6, background: c, color: '#fff', borderRadius: 8, padding: '4px 12px', ...disp(700, 24, 0), whiteSpace: 'nowrap'}}>{n}</div></div>; })}
    </AbsoluteFill>
  );
};
// 13 · Video-Karte mit 2x-Badge, Wort wechselt drunter
export const KSpeedBadge: React.FC<Base & {words?: string[]}> = ({words: wordsP, dur}) => {
  const t = useT();
  const th = useTheme();
  const words = wordsP ?? (has(th.words) ? th.words! : ['das', 'Video', 'automatisch']);
  const i = Math.min(words.length - 1, Math.floor(t / 0.4));
  return (
    <AbsoluteFill style={{background: '#232326', opacity: fade(t, dur), alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 640, transform: `perspective(900px) rotateY(${-14 + Math.sin(t * 2) * 4}deg) rotateX(6deg) scale(${pop(t, 0, 0.3)})`, borderRadius: 18, overflow: 'hidden'}}>
        <Thumb seed={720} w={620} h={380} r={18} views={false} />
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...disp(900, 120, -0.03), color: '#fff', textShadow: '0 6px 20px rgba(0,0,0,.6)', transform: `scale(${1 + Math.max(0, 0.1 - (t % 0.4) * 0.5)})`}}>2x ▶▶</div>
      </div>
      <div style={{position: 'absolute', top: 1110, whiteSpace: 'nowrap', ...disp(600, fit(words[i] ?? '', 64), -0.02), color: '#fff'}}>{words[i]}</div>
    </AbsoluteFill>
  );
};
// 14 · Upload-Warteschlange
export const KUploads: React.FC<Base & {files?: string[]}> = ({files, dur}) => {
  const t = useT();
  const th = useTheme();
  const fname = (i: number) => files?.[i] ?? (has(th.words) ? `${tpick(th.words, [], i)}_${i + 1}.mp4` : `Reel_${i + 1}.mp4`);
  return (
    <AbsoluteFill className="dl-root" style={{background: '#F4F4F5', opacity: fade(t, dur)}}>
      {[0, 1, 2, 3, 4].map((i) => { const v = p(t, 0.1 + i * 0.15, 0.6, EXPO); return <div key={i} style={{position: 'absolute', left: 80, right: 80, top: 440 + i * 210, height: 180, background: '#fff', borderRadius: 30, boxShadow: '0 12px 30px rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', gap: 26, padding: '0 26px', transform: `translateX(${lerp(p(t, i * 0.06, 0.25, EXPO), 1000, 0)}px)`}}>
        <Thumb seed={i + 740} w={110} h={130} r={12} views={false} /><div style={{flex: 1, minWidth: 0}}><div style={{...disp(700, 34, -0.01), color: C.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{fname(i)}</div><div style={{height: 14, borderRadius: 7, background: '#ECECEF', marginTop: 16}}><div style={{width: `${v * 100}%`, height: 14, borderRadius: 7, background: v >= 1 ? C.GREEN : C.BLUE}} /></div></div>
        <div style={{width: 70, height: 70, borderRadius: 35, background: v >= 1 ? C.GREEN : '#ECECEF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', ...disp(800, 40, 0), transform: `scale(${v >= 1 ? pop(t, 0.7 + i * 0.15, 0.2) : 1})`}}>{v >= 1 ? '✓' : ''}</div></div>; })}
    </AbsoluteFill>
  );
};
// 15 · Mitteilungs-Flut + Zähler
export const KNotifFlood: React.FC<Base & {title?: string; body?: string; total?: number}> = ({title: titleP, body = 'folgt dir jetzt', total: totalP, dur}) => {
  const t = useT();
  const th = useTheme();
  const title = titleP ?? tpick(th.words, ['Neuer Follower'], 0);
  const total = totalP ?? tpick(th.numbers, [14 * 73], 0);
  const user = (i: number) => has(th.handles) || has(th.names) ? tpick(has(th.handles) ? th.handles : th.names, [], i).replace(/^@/, '') : `user${(i * 37) % 900}`;
  const n = Math.min(14, Math.floor(t / 0.08));
  // Stapeltiefe läuft stetig statt in 46-px-Sprüngen
  const nf = Math.min(14, t / 0.08);
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg,#DCE6F6,#F6E9EF)', opacity: fade(t, dur), overflow: 'hidden'}}>
      {Array.from({length: n}, (_, i) => { const k = pop(t, i * 0.08, 0.2); const d = Math.max(0, nf - i - 1); return <div key={i} style={{position: 'absolute', left: 60 + (rnd(i) - 0.5) * 60, right: 60 - (rnd(i) - 0.5) * 60, top: 260 + d * 46, transform: `scale(${k * (1 - d * 0.03)})`, opacity: 1 - d * 0.06}}><Glass style={{borderRadius: 34, padding: '22px 26px', display: 'flex', gap: 20, alignItems: 'center'}}><div style={{width: 76, height: 76, borderRadius: 18, background: [C.BLUE, C.RED, C.GREEN][i % 3], opacity: cl(2.6 - d * 0.7)}} /><div style={{opacity: cl(2 - d * 0.7), whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden'}}><div style={{...disp(700, 30, 0), color: C.INK, overflow: 'hidden', textOverflow: 'ellipsis'}}>{title}</div><div style={{...disp(500, 28, 0), color: C.GREY, overflow: 'hidden', textOverflow: 'ellipsis'}}>@{user(i)} {body}</div></div></Glass></div>; })}
      <div style={{position: 'absolute', left: 0, right: 0, top: 1160, textAlign: 'center', ...disp(900, 150, -0.04), color: C.INK}}>+{Math.round((n / 14) * total).toLocaleString('de-DE')}</div>
    </AbsoluteFill>
  );
};
// 16 · DM-Flut (Blasen regnen)
export const KDmFlood: React.FC<Base & {kw?: string; reply?: string}> = ({kw: kwP, reply = 'Hier ist dein Link 🔗', dur}) => {
  const t = useT();
  const th = useTheme();
  const kw = kwP ?? th.kw ?? tpick(th.comments, ['AUDIT'], 0);
  return (
    <AbsoluteFill className="dl-root" style={{background: '#fff', opacity: fade(t, dur), overflow: 'hidden'}}>
      {Array.from({length: 18}, (_, i) => { const at = i * 0.07; if (t < at) return null; const k = pop(t, at, 0.2); return <div key={i} style={{position: 'absolute', left: i % 2 ? 420 : 70, top: 230 + i * 70 - Math.max(0, t - 0.8) * 300, transform: `scale(${k})`, transformOrigin: i % 2 ? '100% 50%' : '0 50%', background: i % 2 ? C.BLUE : '#E9E9EB', color: i % 2 ? '#fff' : C.INK, borderRadius: 30, padding: '14px 26px', ...disp(600, 34, -0.01)}}>{i % 2 ? reply : kw}</div>; })}
    </AbsoluteFill>
  );
};
// 17 · Kalender füllt sich mit Posts
export const KCalendarFill: React.FC<Base & {month?: string}> = ({month = 'Oktober', dur}) => {
  const t = useT();
  return (
    <AbsoluteFill className="dl-root" style={{background: '#F4F4F5', opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 70, top: 400, ...disp(800, 70, -0.03), color: C.INK}}>{month}</div>
      <div style={{position: 'absolute', left: 70, top: 520, display: 'grid', gridTemplateColumns: 'repeat(7, 128px)', gap: 8}}>
        {Array.from({length: 35}, (_, i) => { const on = rnd(i) > 0.25; const k = pop(t, 0.1 + rnd(i + 5) * 0.8, 0.18); return <div key={i} style={{height: 128, borderRadius: 16, background: '#fff', position: 'relative'}}><div style={{position: 'absolute', left: 10, top: 6, ...disp(600, 22, 0), color: C.GREY}}>{i + 1}</div>{on ? <div style={{position: 'absolute', left: 10, right: 10, bottom: 10, height: 50, borderRadius: 10, background: [C.BLUE, C.RED, C.GREEN][i % 3], transform: `scale(${k})`}} /> : null}</div>; })}
      </div>
    </AbsoluteFill>
  );
};
// 18 · Kanban: Karten wandern nach „Fertig“
export const KKanban: React.FC<Base & {cols?: string[]; cards?: string[]; tasks?: string[]}> = ({cols: colsP, cards, tasks, dur}) => {
  const t = useT();
  const th = useTheme();
  // Spalten: Prop > neutraler Workflow bei Thema (passt zu jedem Thema) > alter Reel-Default
  const cols = colsP ?? (has(th.words) || th.topic ? ['Neu', 'Läuft', 'Fertig'] : ['Idee', 'Schnitt', 'Fertig']);
  const colX = [60, 390, 720];
  const card = (i: number) => cards?.[i] ?? (has(th.words) ? tpick(th.words, [], i) : `Reel #${i + 1}`);
  const task = (i: number) => tasks?.[i] ?? (has(th.words) ? `#${i + 1}` : ['Hook', 'Story', 'B-Roll', 'CTA'][i]);
  return (
    <AbsoluteFill className="dl-root" style={{background: '#EEF0F3', opacity: fade(t, dur)}}>
      {cols.slice(0, 3).map((s, i) => <div key={s} style={{position: 'absolute', left: colX[i], top: 420, width: 300, ...disp(700, 40, -0.01), color: C.INK}}>{s}</div>)}
      {[0, 1, 2, 3].map((i) => { const T0 = 0.2 + i * 0.15; const m1 = p(t, T0 + 0.35 - 0.16, 0.16, INOUT), m2 = p(t, T0 + 0.7 - 0.16, 0.16, INOUT); const x = colX[0] + (colX[1] - colX[0]) * m1 + (colX[2] - colX[1]) * m2; const step = m2 > 0.5 ? 2 : m1 > 0.5 ? 1 : 0; return <div key={i} style={{position: 'absolute', left: x, top: 500 + i * 190, width: 300, height: 160, borderRadius: 20, background: '#fff', boxShadow: '0 10px 24px rgba(0,0,0,.1)', padding: 20, boxSizing: 'border-box', transition: 'none', borderLeft: `10px solid ${step === 2 ? C.GREEN : C.BLUE}`}}><div style={{...disp(700, 30, 0), color: C.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{card(i)}</div><div style={{...disp(500, 24, 0), color: C.GREY}}>{task(i)}</div></div>; })}
    </AbsoluteFill>
  );
};
// 19 · Handy nimmt auf (REC + Timer)
export const KRecording: React.FC<Base> = ({dur}) => {
  const t = useT();
  return (
    <AbsoluteFill style={{background: '#0B0B0F', opacity: fade(t, dur), alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 200, width: 760, height: 1500, borderRadius: 80, border: '14px solid #2A2A2F', overflow: 'hidden', transform: `scale(${pop(t, 0, 0.3)})`}}>
        <FaceBox x={0} y={0} w={732} h={1472} r={0} />
        {[1, 2].map((i) => <div key={i} style={{position: 'absolute', left: `${i * 33.3}%`, top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,.3)'}} />)}
        {[1, 2].map((i) => <div key={'h' + i} style={{position: 'absolute', top: `${i * 33.3}%`, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,.3)'}} />)}
        <div style={{position: 'absolute', top: 60, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}><div style={{background: C.RED, color: '#fff', borderRadius: 12, padding: '6px 18px', ...disp(700, 34, 0)}}>● 00:{String(Math.floor(t)).padStart(2, '0')}:{String(Math.floor((t % 1) * 30)).padStart(2, '0')}</div></div>
        <div style={{position: 'absolute', bottom: 70, left: '50%', marginLeft: -60, width: 120, height: 120, borderRadius: 60, border: '8px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><div style={{width: 50, height: 50, borderRadius: 10, background: C.RED}} /></div>
      </div>
    </AbsoluteFill>
  );
};
// 20 · Like-Button wird gehämmert
export const KLikeSpam: React.FC<Base & {step?: number}> = ({step: stepP, dur}) => {
  const t = useT();
  const th = useTheme();
  const taps = Math.floor(t / 0.12);
  // Thema: th.numbers[0] = Endstand
  const step = stepP ?? (has(th.numbers) ? th.numbers![0] / Math.max(1, Math.floor(dur / 0.12)) : 127);
  return (
    <AbsoluteFill className="dl-root" style={{background: '#FFF4F4', opacity: fade(t, dur), alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}}>
      {Array.from({length: Math.min(taps, 16)}, (_, i) => { const q = cl((t - i * 0.12) / 0.9); return <div key={i} style={{position: 'absolute', left: 500 + (rnd(i) - 0.5) * 300, top: 820 - q * 700, fontSize: 70 + rnd(i + 1) * 50, opacity: 1 - q}}>❤️</div>; })}
      <div style={{marginTop: -100, transform: `scale(${1.15 - (t % 0.12) * 1.2})`}}><Emoji n="red_heart" s={300} /></div>
      <div style={{position: 'absolute', top: 1180, ...disp(900, 110, -0.03), color: C.RED}}>{Math.round(taps * step).toLocaleString('de-DE')}</div>
      <Hand x={600} y={960} s={140} down={(t % 0.12) < 0.05} />
    </AbsoluteFill>
  );
};
export {wob, Doodle};
