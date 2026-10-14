// DA · Daten & Zahlen
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Base, C, disp, serif, useT, p, lerp, cl, SPRING, INOUT, SOFT, EXPO, outK, Glass, Center, Ring, Face, useTheme, tpick} from './core';

const fade = (t: number, dur: number) => 1 - outK(t, dur);
// Schriftgröße so wählen, dass Text in die Breite w passt (lange Themen-Wörter)
const fit = (txt: string, base: number, w: number, k = 0.6) => Math.min(base, w / Math.max(1, txt.length * k));
const de = (n: number) => Math.round(n).toLocaleString('de-DE');
const hasL = (a?: unknown[]) => !!(a && a.length);
// i-te Themen-Zahl; hat das Thema weniger Zahlen als Einträge, werden die fehlenden aus der ersten abgeleitet (keine doppelten Werte)
const tnum = (nums: number[] | undefined, i: number, ratio: number[]) => (nums && nums.length > i ? nums[i] : nums && nums.length ? Math.max(1, Math.round(nums[0] * ratio[i % ratio.length])) : null);
export const RingStat: React.FC<Base & {v?: number; label?: string; color?: string}> = ({v: vp, label: lp, color = C.GREEN, dur}) => {
  const t = useT();
  const th = useTheme();
  const tn = hasL(th.numbers) ? th.numbers![0] : null;
  const v = vp ?? (tn !== null && tn > 0 && tn <= 100 ? tn / 100 : 0.87);
  const label = lp ?? tpick(th.words, ['Watchtime'], 0);
  const d = p(t, 0.1, 0.9, INOUT);
  return (
    <Center y={900} style={{opacity: fade(t, dur)}}>
      <div style={{position: 'relative', width: 640, height: 640, transform: `scale(${p(t, 0, 0.35, SPRING)})`}}>
        <svg width="640" height="640" viewBox="0 0 220 220"><Ring r={92} c={color} v={v * d} w={22} /></svg>
        <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{...disp(800, 170, -0.05), color: C.INK, fontVariantNumeric: 'tabular-nums'}}>{Math.round(v * d * 100)}%</div>
          <div style={{...serif(fit(label, 64, 520, 0.45)), color: C.GREY, whiteSpace: 'nowrap'}}>{label}</div>
        </div>
      </div>
    </Center>
  );
};
export const BarChart: React.FC<Base & {vals?: number[]; labels?: string[]; title?: string; delta?: number; unit?: string}> = ({vals = [0.3, 0.45, 0.4, 0.62, 0.55, 0.85, 1], labels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], title: tp, delta: dp, unit = '%', dur}) => {
  const t = useT();
  const th = useTheme();
  const title = tp ?? tpick(th.words, ['Views'], 0);
  const delta = dp ?? (hasL(th.numbers) ? th.numbers![0] : 214);
  return (
    <Center y={960} style={{opacity: fade(t, dur)}}>
      <Glass style={{width: 900, height: 760, borderRadius: 50, padding: 50, boxSizing: 'border-box', background: '#fff', transform: `scale(${p(t, 0, 0.3, SPRING)})`}}>
        <div style={{display: 'flex', justifyContent: 'space-between', ...disp(700, 46, -0.02), color: C.INK}}><span style={{fontSize: fit(title, 46, 480), whiteSpace: 'nowrap'}}>{title}</span><span style={{color: C.GREEN, fontVariantNumeric: 'tabular-nums'}}>+{de(p(t, 0.2, 0.8) * delta)}{unit}</span></div>
        <div style={{display: 'flex', alignItems: 'flex-end', gap: 22, height: 480, marginTop: 40}}>
          {vals.map((v, i) => <div key={i} style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, height: '100%', justifyContent: 'flex-end'}}><div style={{width: '100%', height: `${v * 100 * p(t, 0.15 + i * 0.06, 0.45, SPRING)}%`, borderRadius: 18, background: i === vals.length - 1 ? C.BLUE : '#E5E7EE'}} /><span style={{...disp(600, 28, 0), color: C.GREY}}>{labels[i]}</span></div>)}
        </div>
      </Glass>
    </Center>
  );
};
export const LineChart: React.FC<Base & {title?: string; value?: number}> = ({title: tp, value: vp, dur}) => {
  const t = useT();
  const th = useTheme();
  const title = tp ?? tpick(th.words, ['Follower'], 0);
  const value = vp ?? (hasL(th.numbers) ? th.numbers![0] : 48200);
  const d = p(t, 0.15, 0.9, INOUT);
  const pts = [[0, 420], [120, 400], [240, 430], [360, 330], [480, 350], [600, 220], [720, 240], [800, 90]];
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  // Punkt läuft stufenlos mit der Linienspitze (Bogenlänge wie strokeDashoffset) statt von Knick zu Knick zu springen
  const segL = pts.slice(1).map(([x, y], i) => Math.hypot(x - pts[i][0], y - pts[i][1]));
  const tot = segL.reduce((a, b) => a + b, 0);
  let rest = d * tot, si = 0;
  while (si < segL.length - 1 && rest > segL[si]) { rest -= segL[si]; si++; }
  const sf = cl(rest / segL[si]);
  const dot = [lerp(sf, pts[si][0], pts[si + 1][0]), lerp(sf, pts[si][1], pts[si + 1][1])];
  return (
    <Center y={960} style={{opacity: fade(t, dur)}}>
      <Glass style={{width: 900, height: 700, borderRadius: 50, padding: 50, boxSizing: 'border-box', background: '#fff', transform: `scale(${p(t, 0, 0.3, SPRING)})`}}>
        <div style={{...disp(700, fit(title, 46, 800), -0.02), color: C.INK, whiteSpace: 'nowrap'}}>{title}</div>
        <div style={{...disp(800, 90, -0.04), color: C.INK, fontVariantNumeric: 'tabular-nums'}}>{de(d * value)}</div>
        <svg width="800" height="460" viewBox="0 0 800 460" style={{marginTop: -20}}>
          <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.BLUE} stopOpacity="0.25" /><stop offset="1" stopColor={C.BLUE} stopOpacity="0" /></linearGradient></defs>
          <path d={`${path} L800 460 L0 460 Z`} fill="url(#lg)" opacity={d} />
          <path d={path} stroke={C.BLUE} strokeWidth="8" fill="none" strokeLinejoin="round" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - d} />
          <circle cx={dot[0]} cy={dot[1]} r="14" fill="#fff" stroke={C.BLUE} strokeWidth="6" />
        </svg>
      </Glass>
    </Center>
  );
};
export const Donut: React.FC<Base & {labels?: string[]; vals?: number[]}> = ({labels, vals, dur}) => {
  const t = useT();
  const th = useTheme();
  const d = p(t, 0.1, 0.9, INOUT);
  const DV = [0.48, 0.32, 0.2], DL = ['Reels', 'TikTok', 'Shorts'];
  const seg = [C.BLUE, C.RED, C.GREEN].map((c, i) => [c, vals?.[i] ?? DV[i], labels?.[i] ?? tpick(th.apps && th.apps.length ? th.apps : th.words, DL, i)] as const);
  let acc = 0;
  return (
    <Center y={900} style={{opacity: fade(t, dur)}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40, transform: `scale(${p(t, 0, 0.35, SPRING)})`}}>
        <svg width="560" height="560" viewBox="0 0 220 220">{seg.map(([c, v], i) => { const el = <circle key={i} cx="110" cy="110" r="80" stroke={c} strokeWidth="40" fill="none" pathLength={1} strokeDasharray={`${v * d} 1`} strokeDashoffset={-acc * d} transform="rotate(-90 110 110)" />; acc += v; return el; })}</svg>
        <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 30, rowGap: 16, maxWidth: 980}}>{seg.map(([c, v, l], i) => <div key={i} style={{display: 'flex', alignItems: 'center', gap: 12, ...disp(650, 36, 0), color: C.INK, whiteSpace: 'nowrap', opacity: p(t, 0.5 + i * 0.1, 0.2)}}><div style={{width: 24, height: 24, borderRadius: 12, background: c}} />{l} {Math.round(v * 100)}%</div>)}</div>
      </div>
    </Center>
  );
};
export const StatCards: React.FC<Base & {labels?: string[]; vals?: number[]}> = ({labels, vals, dur}) => {
  const t = useT();
  const th = useTheme();
  const items = [C.BLUE, C.RED, C.GREEN].map((c, i) => [labels?.[i] ?? tpick(th.words, ['Views', 'Likes', 'Follower'], i), vals?.[i] ?? tnum(th.numbers, i, [1, 0.077, 0.0053]) ?? [2400000, 184000, 12800][i], c] as const);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      {items.map(([l, v, c], i) => { const k = p(t, i * 0.12, 0.35, SPRING); const n = Math.round(p(t, 0.1 + i * 0.12, 0.8, SOFT) * v);
        return <div key={i} style={{position: 'absolute', left: 90, width: 900, top: 520 + i * 300, transform: `translateX(${lerp(k, i % 2 ? 600 : -600, 0)}px)`}}>
          <Glass style={{borderRadius: 44, padding: '36px 44px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{...disp(600, fit(l, 46, 400), -0.02), color: C.GREY, whiteSpace: 'nowrap'}}>{l}</span><span style={{...disp(800, 96, -0.04), color: c, fontVariantNumeric: 'tabular-nums'}}>{n.toLocaleString('de-DE')}</span>
          </Glass>
        </div>; })}
    </AbsoluteFill>
  );
};
// Vorher/Nachher-Schieber
export const BeforeAfter: React.FC<Base & {a?: string; b?: string}> = ({a: ap, b: bp, dur}) => {
  const t = useT();
  const th = useTheme();
  const a = ap ?? tpick(th.words, ['Roh'], 0), b = bp ?? tpick(th.words, ['', 'Geschnitten'], 1);
  const x = lerp(p(t, 0.15, Math.max(0.6, dur - 0.5), INOUT), 980, 100);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <AbsoluteFill className="dl-root" style={{background: '#D9D9DE', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><span style={{...disp(800, fit(a, 130, 940), -0.04), color: '#A3A3AB', whiteSpace: 'nowrap'}}>{a}</span></AbsoluteFill>
      <AbsoluteFill style={{clipPath: `inset(0 0 0 ${x}px)`, background: `radial-gradient(ellipse at 50% 40%, #fff, ${C.PAPER})`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><span style={{...serif(fit(b, 170, 940, 0.45)), color: C.INK, whiteSpace: 'nowrap'}}>{b}</span><div style={{position: 'absolute', left: 140, top: 520, width: 200, height: 200, borderRadius: 100, background: `${C.BLUE}22`}} /><div style={{position: 'absolute', right: 160, bottom: 560, width: 140, height: 140, borderRadius: 70, background: `${C.RED}22`}} /></AbsoluteFill>
      <div style={{position: 'absolute', left: x - 3, top: 0, width: 6, height: 1920, background: '#fff', boxShadow: '0 0 20px rgba(0,0,0,.25)'}} />
      <div style={{position: 'absolute', left: x - 50, top: 910, width: 100, height: 100, borderRadius: 50, background: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', ...disp(700, 40, 0), color: C.INK}}>‹ ›</div>
    </AbsoluteFill>
  );
};
// Zeitstrahl mit Schritten
export const Timeline: React.FC<Base & {steps?: string[]}> = ({steps: sp, dur}) => {
  const t = useT();
  const th = useTheme();
  const steps = sp ?? (th.words && th.words.length >= 2 ? th.words.slice(0, 6) : ['Idee', 'Dreh', 'Schnitt', 'Post']);
  const N = steps.length;
  const ats = steps.map((_, i) => 0.1 + i * ((dur - 0.5) / N));
  // Balken erreicht jeden Punkt genau dann, wenn er aufleuchtet (vorher lief er unabhängig davon)
  const seg = ats.findIndex((a) => t < a);
  const prog = N < 2 ? p(t, 0.1, 0.4, INOUT) : seg === 0 ? 0 : seg === -1 ? 1 : (seg - 1 + p(t, ats[seg - 1], ats[seg] - ats[seg - 1], INOUT)) / (N - 1);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 200, top: 420, width: 8, height: 1000, borderRadius: 4, background: '#E5E7EE'}}><div style={{width: 8, height: `${prog * 100}%`, borderRadius: 4, background: C.BLUE}} /></div>
      {steps.map((s, i) => { const at = ats[i]; const on = t >= at; const k = p(t, at, 0.3, SPRING); const pulse = Math.sin(p(t, at, 0.3, INOUT) * Math.PI);
        return <div key={i} style={{position: 'absolute', left: 170, top: 420 + i * (1000 / Math.max(1, N - 1)) - 34, display: 'flex', alignItems: 'center', gap: 40}}>
          <div style={{width: 68, height: 68, borderRadius: 34, background: on ? C.BLUE : '#E5E7EE', transform: `scale(${1 + pulse * 0.4})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', ...disp(800, 30, 0)}}>{i + 1}</div>
          <span style={{...disp(750, fit(s, 80, 740), -0.04), color: on ? C.INK : '#C7C7CC', transform: `translateX(${lerp(k, 40, 0)}px)`, display: 'inline-block', whiteSpace: 'nowrap'}}>{s}</span>
        </div>; })}
    </AbsoluteFill>
  );
};
// Rangliste: eigener Eintrag schiebt sich nach oben
export const Leaderboard: React.FC<Base & {rows?: string[]}> = ({rows: rp, dur}) => {
  const t = useT();
  const th = useTheme();
  const list = hasL(th.handles) ? th.handles! : hasL(th.names) ? th.names! : null;
  // Anzahl Zeilen = Themen-Liste (2–4), damit keine Namen doppelt stehen; letzte Zeile = „du“, klettert auf Platz 1
  const rows = rp ?? (list && list.length >= 2 ? list.slice(0, 4).map((h) => (h.startsWith('@') ? h : `@${h}`)) : ['@nick', '@sarah', '@max', '@leifdunkelmann']);
  const N = rows.length, L = N - 1;
  const climb = p(t, 0.4, 0.6, INOUT);
  return (
    <Center y={960} style={{opacity: fade(t, dur)}}>
      <div style={{position: 'relative', width: 900, height: N * 160}}>
        {rows.map((r, i) => { const me = i === L; const pos = me ? lerp(climb, L, 0) : i + climb;
          return <div key={i} style={{position: 'absolute', left: 0, right: 0, top: pos * 160, transform: `scale(${me ? 1 + Math.sin(climb * Math.PI) * 0.06 : 1})`, zIndex: me ? 10 : 1}}>
            <Glass style={{borderRadius: 36, padding: '26px 36px', display: 'flex', alignItems: 'center', gap: 26, background: me ? C.BLUE : '#fff', color: me ? '#fff' : C.INK}}>
              <span style={{...disp(800, 44, 0), width: 60}}>{Math.round(pos) + 1}</span>{me ? <Face size={70} /> : <div style={{width: 70, height: 70, borderRadius: 35, background: '#E5E7EE'}} />}<span style={{flex: 1, ...disp(650, fit(r, 44, 560), -0.02), whiteSpace: 'nowrap'}}>{r}</span>{me ? <span style={{...disp(800, 40, 0)}}>▲ {L}</span> : null}
            </Glass>
          </div>; })}
      </div>
    </Center>
  );
};
// Großer Prozent-Badge mit Pfeil
export const Badge: React.FC<Base & {text?: string; color?: string}> = ({text: tp, color = C.GREEN, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = tp ?? (hasL(th.numbers) ? `+${de(th.numbers![0])}%` : '+340%');
  const k = p(t, 0, 0.35, SPRING);
  return (
    <Center y={900} style={{opacity: fade(t, dur)}}>
      <div style={{transform: `scale(${k}) rotate(${lerp(k, -12, -3)}deg)`, background: color, color: '#fff', borderRadius: 80, padding: '30px 70px 40px', display: 'flex', alignItems: 'center', gap: 30, boxShadow: `0 30px 80px ${color}66`, whiteSpace: 'nowrap', ...disp(850, fit(text, 160, 720), -0.05)}}>
        <svg width="120" height="120" viewBox="0 0 24 24" style={{transform: `translateY(${-Math.abs(Math.sin(t * 6)) * 10}px)`}}><path d="M12 4l7 8h-4.5v8h-5v-8H5z" fill="#fff" /></svg>{text}
      </div>
    </Center>
  );
};
// A gegen B (zwei Balken)
export const Compare: React.FC<Base & {a?: string; b?: string; va?: number; vb?: number; pct?: boolean; title?: string}> = ({a: ap, b: bp, va = 0.25, vb = 0.92, pct = true, title, dur}) => {
  const t = useT();
  const th = useTheme();
  const a = ap ?? tpick(th.words, ['Ohne System'], 0), b = bp ?? tpick(th.words, ['', 'Mit System'], 1);
  return (
    <Center y={960} style={{opacity: fade(t, dur)}}>
      <div style={{width: 900}}>
        {title ? <div style={{...disp(800, fit(title, 44, 900, 0.62), 0.06), color: C.GREY, marginBottom: 40, whiteSpace: 'nowrap'}}>{title}</div> : null}
        {[[a, va, '#C7C7CC'], [b, vb, C.BLUE]].map(([l, v, c], i) => <div key={i} style={{marginBottom: 60}}>
          <div style={{display: 'flex', justifyContent: 'space-between', ...disp(700, 50, -0.02), color: C.INK}}><span style={{fontSize: fit(l as string, 50, 680), whiteSpace: 'nowrap'}}>{l}</span>{pct ? <span style={{color: c as string, fontVariantNumeric: 'tabular-nums'}}>{Math.round((v as number) * 100 * p(t, 0.2 + i * 0.2, 0.7, SOFT))}%</span> : null}</div>
          <div style={{height: 70, borderRadius: 35, background: '#EEF0F4', marginTop: 20, overflow: 'hidden'}}><div style={{width: `${(v as number) * 100 * p(t, 0.2 + i * 0.2, 0.7, SOFT)}%`, height: 70, borderRadius: 35, background: c as string}} /></div>
        </div>)}
      </div>
    </Center>
  );
};
// Trichter (Funnel)
export const Funnel: React.FC<Base & {labels?: string[]; vals?: string[]}> = ({labels, vals, dur}) => {
  const t = useT();
  const th = useTheme();
  const DL = ['Views', 'Profilbesuche', 'Kommentare', 'Kunden'], DV = ['2,4 Mio.', '180 Tsd.', '12 Tsd.', '214'];
  const rows = [1, 0.75, 0.52, 0.3].map((w, i) => [labels?.[i] ?? tpick(th.words, DL, i), vals?.[i] ?? (hasL(th.numbers) ? de(tnum(th.numbers, i, [1, 0.12, 0.03, 0.006])!) : DV[i]), w] as const);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      {rows.map(([l, v, w], i) => { const k = p(t, i * 0.15, 0.35, SPRING);
        return <div key={i} style={{position: 'absolute', left: 540 - (w * 900) / 2, width: w * 900, top: 460 + i * 230, height: 190, borderRadius: 40, background: [C.INK, '#2E2E36', C.BLUE, C.GREEN][i], color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `scaleX(${k})`, opacity: cl(k * 3)}}>
          <span style={{...disp(800, fit(v, 64, w * 900 - 60), -0.03), whiteSpace: 'nowrap'}}>{v}</span><span style={{...disp(500, fit(l, 30, w * 900 - 60), 0), opacity: 0.8, whiteSpace: 'nowrap'}}>{l}</span></div>; })}
    </AbsoluteFill>
  );
};
export {EXPO};
