// KR · Retro & Game: Arcade, VS-Screen, Windows-XP, HUD, Pixel
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Base, C, disp, useT, p, lerp, cl, rnd, EXPO, EIN, Cursor, useTheme, tpick} from '../core';
import {fade, Thumb, PixelText, PixelIcon, Burst, Cutout, FaceBox, Emoji, pop, wob} from './kit';

// Größen so begrenzen, dass Themen-Texte nicht über den Rand laufen (Default-Texte bleiben unverändert)
const fit = (s: string, base: number, maxW: number, k = 0.6) => Math.min(base, maxW / Math.max(1, s.length * k));
const pxFit = (s: string, base: number, maxW: number) => Math.min(base, maxW / Math.max(1, s.length * 6 - 1));
const de = (n: number) => Math.round(n).toLocaleString('de-DE');
const DARK = 'radial-gradient(circle at 50% 30%, #2B2F38, #0D0E12 75%)';
// 1 · Arcade-Automat: Bildschirm tippt Text, Pixel-Icon
export const KArcade: React.FC<Base & {small?: string; big?: string; icon?: string; screen?: string; title?: string}> = ({small = 'Schritt 1', big: bp, icon = 'bolt', screen = '#101318', title: tp, dur}) => {
  const t = useT();
  const th = useTheme();
  const big = bp ?? tpick(th.words, ['RAW-Cut'], 0);
  const title = tp ?? th.brand ?? 'ARCADE';
  const z = lerp(p(t, 0, 0.45, EXPO), 0.55, 1);
  const n = Math.min(big.length, Math.floor(Math.max(0, t - 0.25) * 22));
  return (
    <AbsoluteFill style={{background: DARK, opacity: fade(t, dur), overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 540, top: 980, transform: `translate(-50%,-50%) scale(${z})`, width: 760, height: 1500}}>
        <div style={{position: 'absolute', left: 40, top: 0, width: 680, height: 170, background: 'linear-gradient(#2F5FA8,#1E3F78)', borderRadius: '30px 30px 0 0', border: '10px solid #E9DCC0', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><PixelText text={title} px={pxFit(title, 12, 600)} color={C.SUN} shadow={C.RED} /></div>
        <div style={{position: 'absolute', left: 0, top: 170, width: 760, height: 620, background: '#E9DCC0', borderRadius: 20, padding: 50, boxSizing: 'border-box'}}>
          <div style={{width: '100%', height: '100%', background: screen, borderRadius: 30, boxShadow: 'inset 0 0 60px rgba(0,0,0,.9)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20}}>
            <div style={{color: C.SUN, ...disp(800, fit(small, 64, 620, 0.55), 0.02), whiteSpace: 'nowrap', opacity: p(t, 0.15, 0.15)}}>{small}</div>
            <div style={{color: '#fff', ...disp(800, fit(big, 84, 640, 0.52), -0.03), whiteSpace: 'nowrap'}}>{big.slice(0, n)}<span style={{opacity: Math.floor(t * 4) % 2}}>|</span></div>
            <div style={{transform: `scale(${pop(t, 0.25 + big.length / 22, 0.25)})`}}><PixelIcon n={icon} px={14} /></div>
            <div style={{position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 2px, transparent 2px 5px)'}} />
          </div>
        </div>
        <div style={{position: 'absolute', left: 30, top: 790, width: 700, height: 200, background: 'linear-gradient(#2F5FA8,#244C90)', borderRadius: 16, transform: 'perspective(600px) rotateX(35deg)', transformOrigin: '50% 0'}}>
          <div style={{position: 'absolute', left: 120, top: 40, width: 30, height: 90, background: '#222', borderRadius: 10}} /><div style={{position: 'absolute', left: 100, top: 10, width: 70, height: 70, borderRadius: 35, background: 'radial-gradient(circle at 35% 35%, #FF7A72, #C4161C)'}} />
          {[C.BLUE, C.SUN, C.GREEN, '#fff'].map((c, i) => <div key={i} style={{position: 'absolute', left: 360 + i * 80, top: 60 + (i % 2) * 20, width: 56, height: 56, borderRadius: 28, background: c, boxShadow: '0 6px 0 rgba(0,0,0,.35)', transform: `translateY(${Math.floor(t * 5 + i) % 4 === 0 ? 6 : 0}px)`}} />)}
        </div>
        <div style={{position: 'absolute', left: 60, top: 990, width: 640, height: 510, background: 'linear-gradient(#244C90,#18346A)', borderRadius: 10}}><div style={{position: 'absolute', left: 230, top: 120, width: 70, height: 110, background: '#C4161C', borderRadius: 8}} /><div style={{position: 'absolute', left: 340, top: 120, width: 70, height: 110, background: '#C4161C', borderRadius: 8}} /></div>
      </div>
    </AbsoluteFill>
  );
};
// 2 · VS-Screen (Speed-Lines rot, Pixel-VS, Menü)
export const KVs: React.FC<Base & {right?: string}> = ({right = 'robot', dur}) => {
  const t = useT();
  const sel = Math.floor(t / 0.35) % 2;
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), overflow: 'hidden'}}>
      <Burst t={t} c1={C.RED} c2="#FF7A72" core="#FFE3E0" n={64} spin={30} />
      <div style={{position: 'absolute', left: 0, top: 0, transform: `translateX(${lerp(p(t, 0, 0.25, EXPO), -600, 0)}px)`}}><Cutout x={250} y={1420} h={820} /></div>
      <div style={{position: 'absolute', right: 80, top: 640, transform: `translateX(${lerp(p(t, 0.06, 0.25, EXPO), 600, 0)}px) scaleX(-1)`}}><Emoji n={right} s={420} /></div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 720, display: 'flex', justifyContent: 'center', transform: `scale(${lerp(pop(t, 0.2, 0.25), 4, 1)})`, opacity: cl(p(t, 0.2, 0.1) * 2)}}><PixelText text="VS" px={34} color={C.RED} shadow={C.INK} /></div>
      <div style={{position: 'absolute', left: 540, top: 1150, display: 'flex', flexDirection: 'column', gap: 26, opacity: p(t, 0.4, 0.1)}}>
        {['START', 'CONTINUE'].map((s, i) => <div key={s} style={{display: 'flex', alignItems: 'center', gap: 22, background: sel === i ? C.INK : 'transparent', padding: '8px 16px'}}><div style={{width: 40, opacity: sel === i ? 1 : 0}}><PixelText text=">" px={8} color={C.RED} /></div><PixelText text={s} px={9} color={sel === i ? '#fff' : C.INK} /></div>)}
      </div>
    </AbsoluteFill>
  );
};
// 3 · Windows-XP-Desktop mit Fenstern + Fehlermeldung
const XPWin: React.FC<{x: number; y: number; w: number; h: number; k: number; title: string; children?: React.ReactNode}> = ({x, y, w, h, k, title, children}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, transform: `scale(${k})`, transformOrigin: '50% 50%', background: '#ECE9D8', border: '3px solid #0A3FC2', borderRadius: '10px 10px 0 0', boxShadow: '6px 8px 0 rgba(0,0,0,.25)', overflow: 'hidden'}}>
    <div style={{height: 42, background: 'linear-gradient(#3A8CF7,#0A4FD6 45%,#0A3FC2)', display: 'flex', alignItems: 'center', padding: '0 10px', color: '#fff', ...disp(700, 22, 0)}}><span style={{flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{title}</span>{[0, 1, 2].map((i) => <span key={i} style={{width: 30, height: 28, marginLeft: 4, borderRadius: 4, background: i === 2 ? '#E0402A' : '#3C7EF2', border: '1px solid #fff', display: 'flex', alignItems: i === 0 ? 'flex-end' : 'center', justifyContent: 'center', position: 'relative', boxSizing: 'border-box', paddingBottom: i === 0 ? 6 : 0}}>{i === 0 ? <span style={{width: 12, height: 3, background: '#fff'}} /> : i === 1 ? <span style={{width: 13, height: 12, border: '2px solid #fff', borderTopWidth: 4, boxSizing: 'border-box'}} /> : [45, -45].map((r) => <span key={r} style={{position: 'absolute', left: 12, top: 5, width: 3, height: 16, background: '#fff', transform: `rotate(${r}deg)`}} />)}</span>)}</div>
    <div style={{position: 'absolute', top: 42, left: 0, right: 0, bottom: 0}}>{children}</div>
  </div>
);
export const KWinXP: React.FC<Base & {n?: number; error?: boolean; label?: string; titles?: string[]; msg?: string}> = ({n = 4, error = true, label: lp, titles, msg: mp, dur}) => {
  const t = useT();
  const th = useTheme();
  // Fehlermeldung: Prop > Thema („<WORT>.exe: Error“) > alter Default
  const msg = mp ?? (th.words && th.words.length ? `${tpick(th.words, [], 2)}.exe: Error` : 'Zu langweilig. Klick „Fix“.');
  const label = lp ?? tpick(th.words, ['Das Internet'], 1);
  // Fenstertitel: Props > Themen-Wörter > „Video_1.mp4“ …
  const wt = (i: number) => titles && titles.length ? tpick(titles, [], i) : th.words && th.words.length ? (th.words.length > i ? `${tpick(th.words, [], i)}.mp4` : `${tpick(th.words, [], i)}_${i + 1}.mp4`) : `Video_${i + 1}.mp4`;
  const W = [[90, 560, 520, 380], [470, 470, 520, 380], [140, 980, 560, 420], [560, 1080, 440, 340], [300, 700, 480, 360]];
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#2E6FD8 0%,#6FA8F0 45%,#BFE0FF 70%)'}} />
      <div style={{position: 'absolute', left: -300, right: -300, top: 1250, height: 1400, borderRadius: '50%', background: 'radial-gradient(ellipse at 40% 20%, #8BD34A, #3E9A1E 60%)'}} />
      {Array.from({length: 4}, (_, i) => <div key={i} style={{position: 'absolute', left: rnd(i) * 900 - 100 + t * 20, top: 250 + rnd(i + 2) * 500, width: 380, height: 110, borderRadius: 60, background: '#fff', filter: 'blur(14px)', opacity: 0.85}} />)}
      <div style={{position: 'absolute', left: 0, right: 0, top: 380, textAlign: 'center', color: '#fff', ...disp(700, fit(label, 96, 1000, 0.56), -0.03), whiteSpace: 'nowrap', textShadow: '0 4px 14px rgba(0,40,120,.5)', opacity: p(t, 0, 0.15)}}>{label}</div>
      {W.slice(0, n).map(([x, y, w, h], i) => <XPWin key={i} x={x} y={y} w={w} h={h} k={pop(t, 0.12 + i * 0.12, 0.22)} title={wt(i)}><Thumb seed={i + 400} w={w - 6} h={h - 45} r={0} views={false} /></XPWin>)}
      {error ? <XPWin x={260} y={820} w={560} h={250} k={pop(t, 0.2 + n * 0.12, 0.2)} title="Error"><div style={{display: 'flex', alignItems: 'center', gap: 20, padding: 26}}><div style={{width: 64, height: 64, borderRadius: 32, background: '#E0402A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', ...disp(900, 40, 0)}}>×</div><div style={{...disp(500, Math.min(28, 400 / Math.max(1, Math.max(...msg.split(' ').map((w) => w.length)) * 0.55)), 0), color: C.INK, overflowWrap: 'break-word', minWidth: 0}}>{msg}</div></div><div style={{position: 'absolute', left: 220, bottom: 20, width: 120, height: 44, border: '2px solid #333', borderRadius: 4, background: '#F5F4EE', display: 'flex', alignItems: 'center', justifyContent: 'center', ...disp(600, 24, 0), transform: `scale(${t > dur - 0.45 && t < dur - 0.35 ? 0.92 : 1})`}}>Fix</div></XPWin> : null}
      {error ? <Cursor x={lerp(p(t, dur - 0.9, 0.4, EXPO), 900, 560)} y={lerp(p(t, dur - 0.9, 0.4, EXPO), 1500, 1040)} down={t > dur - 0.45 && t < dur - 0.35} /> : null}
    </AbsoluteFill>
  );
};
// 4 · Game-HUD: Herzen, Coins, XP-Leiste, LEVEL UP
export const KHud: React.FC<Base & {coins?: number; label?: string}> = ({coins: cp, label = 'LEVEL UP!', dur}) => {
  const t = useT();
  const th = useTheme();
  const coins = cp ?? tpick(th.numbers, [250], 0);
  const c = Math.round(coins * p(t, 0.15, 0.8));
  const xp = p(t, 0.1, 0.9);
  return (
    <AbsoluteFill className="dl-root" style={{opacity: fade(t, dur), background: '#F4F4F5'}}>
      <div style={{position: 'absolute', left: 60, top: 260, display: 'flex', gap: 10}}>{[0, 1, 2].map((i) => <div key={i} style={{transform: `scale(${pop(t, i * 0.06, 0.2)})`}}><PixelIcon n="heart" px={9} /></div>)}</div>
      <div style={{position: 'absolute', right: 70, top: 262, display: 'flex', alignItems: 'center', gap: 16}}><div style={{transform: `rotateY(${t * 360}deg)`}}><PixelIcon n="coin" px={9} /></div><PixelText text={`x${c}`} px={pxFit(`x${coins}`, 8, 520)} color={C.INK} /></div>
      <div style={{position: 'absolute', left: 140, right: 140, top: 1080, height: 56, border: `6px solid ${C.INK}`, background: '#fff'}}><div style={{width: `${xp * 100}%`, height: '100%', background: `repeating-linear-gradient(90deg, ${C.GREEN} 0 34px, #13A56A 34px 40px)`}} /></div>
      <div style={{position: 'absolute', left: 140, top: 1150}}><PixelText text="XP" px={7} color={C.GREY} /></div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 760, display: 'flex', justifyContent: 'center', transform: `scale(${pop(t, 0.95, 0.25)}) translateY(${Math.sin(t * 10) * 6}px)`}}><PixelText text={label} px={Math.min(16, 900 / (label.length * 6))} color={C.SUN} shadow={C.INK} /></div>
      <div style={{position: 'absolute', left: 470, top: 500, transform: `scale(${pop(t, 0.05, 0.3)})`}}><FaceBox x={0} y={0} w={140} h={140} r={0} style={{border: `6px solid ${C.INK}`, imageRendering: 'pixelated'}} /></div>
    </AbsoluteFill>
  );
};
// 5 · Pixel-Inventar
export const KInventory: React.FC<Base & {dark?: boolean}> = ({dark = true, dur}) => {
  const t = useT();
  const ic = ['heart', 'coin', 'star', 'eye', 'bolt', 'check', 'crown', 'ghost', 'sword'];
  const sel = Math.min(8, Math.floor(t / 0.16));
  return (
    <AbsoluteFill className="dl-root" style={{opacity: fade(t, dur), background: dark ? '#14161C' : '#F4F4F5', alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 470}}><PixelText text="INVENTAR" px={11} color={dark ? '#fff' : C.INK} shadow={C.BLUE} /></div>
      <div style={{position: 'absolute', top: 640, display: 'grid', gridTemplateColumns: 'repeat(3, 230px)', gap: 24}}>
        {ic.map((n, i) => <div key={n} style={{width: 230, height: 230, border: `6px solid ${i === sel ? C.SUN : dark ? '#3A3E48' : '#C9CCD3'}`, background: dark ? '#1E2129' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${pop(t, i * 0.04, 0.2) * (i === sel ? 1.06 : 1)})`}}><PixelIcon n={n} px={14} /></div>)}
      </div>
    </AbsoluteFill>
  );
};
// 6 · Röhren-TV (CRT) mit Gesicht / Thumb
export const KCrt: React.FC<Base & {face?: boolean; ch?: string}> = ({face = true, ch = 'CH 03', dur}) => {
  const t = useT();
  const on = p(t, 0, 0.25, EXPO);
  return (
    <AbsoluteFill className="dl-root" style={{opacity: fade(t, dur), background: '#E8E4DC'}}>
      <div style={{position: 'absolute', left: 120, top: 560, width: 840, height: 720, borderRadius: 60, background: 'linear-gradient(160deg,#5A544C,#2C2924)', boxShadow: '0 40px 80px rgba(0,0,0,.35)', transform: `scale(${pop(t, 0, 0.3)})`}}>
        <div style={{position: 'absolute', left: 50, top: 50, width: 600, height: 500, borderRadius: '48% / 40%', overflow: 'hidden', background: '#000'}}>
          <div style={{position: 'absolute', inset: 0, transform: `scaleY(${on})`}}>{face ? <FaceBox x={0} y={0} w={600} h={500} r={0} filter="contrast(1.2) saturate(1.3)" /> : <Thumb seed={430} w={600} h={500} r={0} />}</div>
          <div style={{position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,.28) 0 2px, transparent 2px 5px)'}} />
          <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle, transparent 50%, rgba(0,0,0,.6) 100%)'}} />
          <div style={{position: 'absolute', right: 110, top: 60}}><PixelText text={ch} px={6} color={C.GREEN} /></div>
        </div>
        <div style={{position: 'absolute', right: 50, top: 90, width: 100, height: 100, borderRadius: 50, background: '#1C1A17', border: '6px solid #77706A', transform: `rotate(${t * 200}deg)`}}><div style={{width: 10, height: 40, background: '#bbb', margin: '6px auto'}} /></div>
        <div style={{position: 'absolute', right: 60, top: 260, width: 80, height: 260, backgroundImage: 'repeating-linear-gradient(0deg, #1C1A17 0 8px, transparent 8px 16px)'}} />
      </div>
    </AbsoluteFill>
  );
};
// 7 · Retro-Ladebalken
export const KLoading: React.FC<Base & {label?: string; color?: string}> = ({label = 'LOADING', color = C.GREEN, dur}) => {
  const t = useT();
  const v = p(t, 0.1, dur - 0.4, (x: number) => Math.min(1, x * 1.1));
  const blocks = Math.floor(v * 12);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), background: '#0F1115', alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 760}}><PixelText text={`${label}${'.'.repeat(1 + (Math.floor(t * 4) % 3))}`} px={10} color="#fff" /></div>
      <div style={{position: 'absolute', top: 900, width: 860, height: 110, border: '8px solid #fff', padding: 8, display: 'flex', gap: 8, boxSizing: 'border-box'}}>{Array.from({length: 12}, (_, i) => <div key={i} style={{flex: 1, background: i < blocks ? color : 'transparent'}} />)}</div>
      <div style={{position: 'absolute', top: 1060}}><PixelText text={`${Math.round(v * 100)}%`} px={9} color={color} /></div>
    </AbsoluteFill>
  );
};
// 8 · Spiel-Menü mit Auswahl-Pfeil
export const KMenu: React.FC<Base & {items?: string[]}> = ({items: ip, dur}) => {
  const t = useT();
  const th = useTheme();
  const items = ip ?? (th.words && th.words.length ? th.words.slice(0, 4) : ['HOOK', 'STORY', 'PAYOFF', 'CTA']);
  const ipx = Math.min(...items.map((s) => pxFit(s, 11, 600)));
  const sel = Math.min(items.length - 1, Math.floor(t / 0.3));
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), background: C.BLUE}}>
      <div style={{position: 'absolute', left: 120, right: 120, top: 520, bottom: 520, border: '10px solid #fff', boxShadow: '12px 12px 0 #0B0B0F', background: '#0A4FD6', padding: 60}}>
        {items.map((s, i) => <div key={i} style={{display: 'flex', alignItems: 'center', gap: 30, marginBottom: 56, transform: `translateX(${lerp(p(t, i * 0.05, 0.2, EXPO), -800, 0)}px)`}}><div style={{width: 60, opacity: sel === i ? 1 : 0, transform: `translateX(${Math.sin(t * 14) * 6}px)`}}><PixelText text=">" px={10} color={C.SUN} /></div><PixelText text={s} px={ipx} color={sel === i ? C.SUN : '#fff'} /></div>)}
      </div>
    </AbsoluteFill>
  );
};
// 9 · Highscore-Liste
export const KHighscore: React.FC<Base & {names?: string[]; scores?: string[]; title?: string}> = ({names, scores, title = 'HIGHSCORE', dur}) => {
  const t = useT();
  const th = useTheme();
  // Namen: Props > Thema (Platz 1 = Marke, 2–4 = Namen) > alter Default; Punkte: Props > Themen-Zahl (gleiche Abstufung) > alter Default
  const N0 = ['LEIF', 'TEAM', 'ALGO', 'KONKURRENZ', 'DU?'];
  const nm = (i: number) => names && names.length ? tpick(names, N0, i) : i === 0 ? (th.brand ?? 'LEIF') : i < 4 ? tpick(th.names, N0.slice(1, 4), i - 1) : 'DU?';
  const top = th.numbers && th.numbers.length ? th.numbers[0] : null;
  const S0 = ['999.999', '420.000', '128.000', '12.000', '???'];
  const sc = (i: number) => scores && scores.length ? tpick(scores, S0, i) : top !== null && i < 4 ? de(top * [1, 0.42, 0.128, 0.012][i]) : S0[i];
  const rows = [0, 1, 2, 3, 4].map((i) => [String(i + 1), nm(i), sc(i)]);
  const npx = Math.min(...rows.map((r) => pxFit(r[1], 8, 500))), spx = Math.min(...rows.map((r) => pxFit(r[2], 8, 380)));
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), background: '#0B0B0F', alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 400}}><PixelText text={title} px={pxFit(title, 14, 960)} color={C.SUN} shadow={C.RED} /></div>
      {rows.map((r, i) => <div key={i} style={{position: 'absolute', left: 60, top: 640 + i * 150, display: 'flex', gap: 30, opacity: i === 0 && Math.floor(t * 6) % 2 ? 0.4 : p(t, 0.1 + i * 0.1, 0.05)}}><PixelText text={r[0]} px={8} color={i ? '#fff' : C.SUN} /><div style={{width: 500}}><PixelText text={r[1]} px={npx} color={i ? '#fff' : C.SUN} /></div><PixelText text={r[2]} px={spx} color={i ? C.GREEN : C.SUN} /></div>)}
    </AbsoluteFill>
  );
};
// 10 · RPG-Dialogbox mit Porträt
export const KDialog: React.FC<Base & {name?: string; text?: string}> = ({name = 'LEIF', text: tp, dur}) => {
  const t = useT();
  const th = useTheme();
  // Text: Prop > Thema („<Wort 1> oder <Wort 2>?“) > alter Default
  const text = tp ?? (th.words && th.words.length ? (th.words.length > 1 ? `${tpick(th.words, [], 0)} oder ${tpick(th.words, [], 1)}?` : `${tpick(th.words, [], 0)}?`) : 'Willst du das System sehen?');
  const n = Math.min(text.length, Math.floor(Math.max(0, t - 0.2) * 34));
  return (
    <AbsoluteFill className="dl-root" style={{opacity: fade(t, dur), background: '#F4F4F5'}}>
      <div style={{position: 'absolute', left: 60, right: 60, top: 980, height: 400, background: '#fff', border: `10px solid ${C.INK}`, boxShadow: `14px 14px 0 ${C.BLUE}`, transform: `translateY(${lerp(p(t, 0, 0.2, EXPO), 500, 0)}px)`}}>
        <div style={{position: 'absolute', left: 30, top: -60, background: C.INK, padding: '12px 20px'}}><PixelText text={name} px={7} color="#fff" /></div>
        <div style={{position: 'absolute', left: 40, top: 60, right: 40, ...disp(800, Math.min(text.length > 30 ? 66 : 76, 860 / Math.max(1, Math.max(...text.split(' ').map((w) => w.length)) * 0.62)), -0.02), color: C.INK, lineHeight: 1.2, overflowWrap: 'break-word'}}>{text.slice(0, n)}</div>
        {n >= text.length && Math.floor(t * 4) % 2 ? <div style={{position: 'absolute', right: 40, bottom: 30, width: 0, height: 0, borderLeft: '20px solid transparent', borderRight: '20px solid transparent', borderTop: `26px solid ${C.INK}`}} /> : null}
      </div>
      <div style={{position: 'absolute', left: 60, top: 500, transform: `scale(${pop(t, 0.05, 0.25)})`}}><FaceBox x={0} y={0} w={360} h={360} r={0} style={{border: `10px solid ${C.INK}`}} /></div>
    </AbsoluteFill>
  );
};
// 11 · Münzregen + Zähler
export const KCoinRain: React.FC<Base & {amount?: number; unit?: string}> = ({amount: ap, unit = '€', dur}) => {
  const t = useT();
  const th = useTheme();
  const amount = ap ?? tpick(th.numbers, [10000], 0);
  const ctxt = `+${Math.round(amount)} ${unit}`;
  return (
    <AbsoluteFill className="dl-root" style={{opacity: fade(t, dur), background: '#FFF8E1', overflow: 'hidden'}}>
      {Array.from({length: 26}, (_, i) => { const st = rnd(i) * 0.9; const k = t - st; const y = 60 + k * 1700; if (k < 0 || y > 1700) return null; /* im Bild bleiben: oben einblenden, vor dem unteren Rand ausblenden */ return <div key={i} style={{position: 'absolute', left: 40 + rnd(i + 2) * 920, top: y, opacity: cl(k * 10) * cl((1700 - y) / 260), transform: `scaleX(${Math.abs(Math.cos(k * 8 + i))})`}}><PixelIcon n="coin" px={12} /></div>; })}
      <div style={{position: 'absolute', left: 0, right: 0, top: 820, display: 'flex', justifyContent: 'center'}}><PixelText text={`+${Math.round(p(t, 0, dur - 0.3) * amount)} ${unit}`} px={pxFit(ctxt, 15, 960)} color={C.INK} shadow={C.SUN} /></div>
    </AbsoluteFill>
  );
};
// 12 · Boss-Lebensbalken wird leergehauen
export const KBossBar: React.FC<Base & {name?: string}> = ({name: np, dur}) => {
  const t = useT();
  const th = useTheme();
  const name = np ?? tpick(th.words, ['LANGEWEILE'], 2);
  const hits = [0.35, 0.65, 0.95, 1.2];
  const hp = 1 - hits.filter((h) => t > h).length * 0.25;
  const shake = hits.some((h) => t > h && t < h + 0.1) ? Math.sin(t * 120) * 12 : 0;
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), background: 'radial-gradient(circle at 50% 62%, #5A1218, #16090A 68%)', transform: `translateX(${shake}px)`, overflow: 'hidden'}}>
      {/* Arcade-Boden + Scanlines: Fläche nie leer */}
      <div style={{position: 'absolute', left: -540, right: -540, top: 1180, height: 1400, transform: 'perspective(500px) rotateX(62deg)', transformOrigin: '50% 0', backgroundImage: 'linear-gradient(rgba(255,70,80,.55) 3px, transparent 3px), linear-gradient(90deg, rgba(255,70,80,.55) 3px, transparent 3px)', backgroundSize: '90px 90px', backgroundPosition: `0 ${(t * 260) % 90}px`}} />
      {Array.from({length: 14}, (_, i) => <div key={'e' + i} style={{position: 'absolute', left: 40 + (i % 7) * 145, top: i < 7 ? 260 : 1700, opacity: 0.35 + 0.25 * Math.sin(t * 6 + i), transform: `translateY(${Math.sin(t * 5 + i) * 10}px)`}}><PixelIcon n={['ghost', 'heart', 'coin', 'star', 'bolt', 'sword', 'crown'][i % 7]} px={7} /></div>)}
      <div style={{position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 2px, transparent 2px 6px)'}} />
      <div style={{position: 'absolute', left: 90, top: 520}}><PixelText text={name} px={pxFit(name, 9, 900)} color="#fff" /></div>
      <div style={{position: 'absolute', left: 90, right: 90, top: 620, height: 80, border: '8px solid #fff', background: '#3A0D10'}}><div style={{width: `${hp * 100}%`, height: '100%', background: C.RED, transition: 'none'}} /></div>
      {/* Schadenszahl nur einmal, unter dem Balken (nie im Balken) */}
      {hits.map((h, i) => t > h && t < h + 0.26 ? <div key={i} style={{position: 'absolute', left: 120 + i * 200, top: 760 - (t - h) * 120, opacity: cl(1 - (t - h) * 3.8)}}><PixelText text="-25" px={10} color={C.SUN} /></div> : null)}
      <div style={{position: 'absolute', left: 340, top: 980, transform: `scale(${1 + (shake ? 0.05 : 0)})`}}><Emoji n="skull" s={400} /></div>
    </AbsoluteFill>
  );
};
// 13 · GAME OVER → CONTINUE-Countdown
export const KGameOver: React.FC<Base & {title?: string; ask?: string; count?: boolean}> = ({title = 'GAME OVER', ask = 'CONTINUE?', count = true, dur}) => {
  const t = useT();
  const cnt = Math.max(0, 9 - Math.floor(Math.max(0, t - 0.5) / 0.2));
  return (
    <AbsoluteFill style={{opacity: fade(t, dur), background: '#000', alignItems: 'center', overflow: 'hidden'}}>
      {/* Pixel-Sterne fliegen durch – Bild steht nie still */}
      {Array.from({length: 46}, (_, i) => { const sp = 0.4 + rnd(i) * 1.2; const y = ((rnd(i + 7) * 1920 + t * 900 * sp) % 2000) - 40; return <div key={'s' + i} style={{position: 'absolute', left: rnd(i + 3) * 1080, top: y, width: 6 + Math.round(sp * 4), height: 6 + Math.round(sp * 4), background: [C.SUN, '#fff', C.BLUE, C.RED][i % 4], opacity: 0.35 + 0.35 * sp / 1.6}} />; })}
      <div style={{position: 'absolute', top: 700, transform: `scale(${lerp(p(t, 0, 0.3, EXPO), 1.6, 1) * (1 + 0.025 * Math.sin(t * 5))})`}}><PixelText text={title} px={pxFit(title, 18, 900)} color={C.RED} /></div>
      {t > 0.5 ? <div style={{position: 'absolute', top: 960, display: 'flex', gap: 30, alignItems: 'center'}}><PixelText text={ask} px={pxFit(ask, 9, count ? 760 : 900)} color="#fff" />{count ? <PixelText text={String(cnt)} px={14} color={C.SUN} /> : null}</div> : null}
    </AbsoluteFill>
  );
};
// 14 · Erfolg freigeschaltet (moderner Konsolen-Toast)
export const KAchievement: React.FC<Base & {title?: string; e?: string}> = ({title: tp, e = 'trophy', dur}) => {
  const t = useT();
  const th = useTheme();
  const themed = !!((th.numbers && th.numbers.length) || (th.words && th.words.length));
  const title = tp ?? (themed ? `${de(tpick(th.numbers, [1000], 0))} ${tpick(th.words, ['Follower'], 0)}` : '1.000 Follower');
  const w = lerp(p(t, 0.15, 0.35, EXPO), 150, 860);
  return (
    <AbsoluteFill className="dl-root" style={{opacity: fade(t, dur), background: '#F4F4F5', alignItems: 'center'}}>
      <div style={{position: 'absolute', top: 820, height: 150, width: w, borderRadius: 75, background: '#16181D', display: 'flex', alignItems: 'center', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,.3)', transform: `scale(${pop(t, 0, 0.25)})`}}>
        <div style={{width: 150, height: 150, borderRadius: 75, background: C.GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}><Emoji n={e} s={100} /></div>
        <div style={{paddingLeft: 30, whiteSpace: 'nowrap', opacity: p(t, 0.4, 0.2)}}><div style={{...disp(500, 30, 0), color: '#9AA0AA'}}>Erfolg freigeschaltet</div><div style={{...disp(700, fit(title, 46, 640, 0.55), -0.02), color: '#fff'}}>{title}</div></div>
      </div>
    </AbsoluteFill>
  );
};
export {Cursor, EIN, wob};
