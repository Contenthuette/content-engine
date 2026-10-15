// D3 · 3D-Elemente (CSS-3D, perspektivisch)
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Base, C, ACCENTS, disp, serif, useT, p, lerp, cl, rnd, EXPO, EIN, SPRING, INOUT, SOFT, outK, AppIcon, Glyph, Ring, useTheme, tpick} from './core';
import {Blobs} from './bg';
import {WidgetFace, WKind} from './widgets';
import {Emoji} from './lk/kit';

const fade = (t: number, dur: number) => 1 - outK(t, dur);
// Schriftgröße so wählen, dass ein Wort in die Breite w passt (lange Themen-Wörter)
const fit = (txt: string, base: number, w: number, k = 0.6) => Math.min(base, w / Math.max(1, txt.length * k));
const nn = (i: number) => String(i + 1).padStart(2, '0');
const Wall: React.FC<{children: React.ReactNode; persp?: number; o?: number; origin?: string}> = ({children, persp = 1500, o = 1, origin = '50% 45%'}) => <AbsoluteFill style={{perspective: persp, perspectiveOrigin: origin, opacity: o}}><div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d'}}>{children}</div></AbsoluteFill>;

// iPhone fliegt in 3D rein (Dicke, Glanz), optional dreht 360°
export const Phone3D: React.FC<Base & {spin?: boolean; date?: string; time?: string}> = ({spin, date = 'Dienstag, 13. Oktober', time = '9:41', dur}) => {
  const t = useT();
  const k = p(t, 0, 0.85, Easing2);
  const ry = spin ? t * 220 : lerp(k, 75, 0) + Math.sin(cl(t / 0.85) * Math.PI) * -10;
  const W = 500, H = 1030;
  const glare = lerp(cl(t / 1.0), -60, 160);
  return (
    <Wall o={fade(t, dur)}>
      <div style={{position: 'absolute', left: 540 - W / 2, top: 900 - H / 2, width: W, height: H, transformStyle: 'preserve-3d', transform: `translateZ(${lerp(k, -1500, 0)}px) rotateY(${ry}deg) rotateX(${lerp(k, 28, 4)}deg) rotateZ(${lerp(k, -24, 0)}deg)`}}>
        {Array.from({length: 14}, (_, i) => <div key={i} style={{position: 'absolute', inset: 0, borderRadius: 86, background: `hsl(228, 6%, ${58 + i * 1.8}%)`, transform: `translateZ(${-i * 2.2}px)`}} />)}
        <div style={{position: 'absolute', inset: 0, borderRadius: 86, background: '#0B0B0F', transform: 'translateZ(1px)', padding: 14, backfaceVisibility: 'hidden'}}>
          <div style={{position: 'relative', width: '100%', height: '100%', borderRadius: 74, overflow: 'hidden'}}>
            <Blobs dur={dur} strength={0.55} />
            <div style={{position: 'absolute', left: 0, right: 0, top: 230, textAlign: 'center', color: C.GREY, ...disp(600, 30, 0)}}>{date}</div>
            <div style={{position: 'absolute', left: 0, right: 0, top: 260, textAlign: 'center', color: C.INK, ...disp(300, 170, -0.04)}}>{time}</div>
            <div style={{position: 'absolute', inset: 0, background: `linear-gradient(115deg, rgba(255,255,255,0) ${glare - 30}%, rgba(255,255,255,.55) ${glare}%, rgba(255,255,255,0) ${glare + 30}%)`}} />
          </div>
          <div style={{position: 'absolute', left: W / 2 - 70, top: 34, width: 140, height: 40, borderRadius: 20, background: '#000'}} />
        </div>
        <div style={{position: 'absolute', inset: 0, borderRadius: 86, background: '#C9CBD2', transform: 'translateZ(-32px) rotateY(180deg)'}} />
      </div>
    </Wall>
  );
};
const Easing2 = (x: number) => 1 - Math.pow(1 - x, 3);

// Buchstaben auf einem Zylinder, dreht sich
export const TextRing: React.FC<Base & {text?: string; rad?: number; size?: number; speed?: number}> = ({text, rad = 520, size = 110, speed = 120, dur}) => {
  const t = useT();
  const th = useTheme();
  const txt = text ?? (th.words && th.words.length ? th.words.join(' · ').toUpperCase() + ' · ' : 'EDITING · MOTION · DESIGN · ');
  const ch = Array.from(txt);
  return (
    <Wall o={fade(t, dur) * p(t, 0, 0.2)}>
      <div style={{position: 'absolute', left: 540, top: 900, transformStyle: 'preserve-3d', transform: `rotateX(-12deg) rotateZ(-7deg) rotateY(${-t * speed}deg) scale(${lerp(p(t, 0, 0.5), 1.6, 1)})`}}>
        {/* Vorderseite deckend, Rückseite als blasser Schatten – nie Spiegelschrift */}
        {ch.map((c, i) => [0, 1].map((b) => <div key={`${i}-${b}`} style={{position: 'absolute', left: -36, top: -size * 0.55, width: 72, textAlign: 'center', backfaceVisibility: 'hidden', transform: `rotateY(${(i / ch.length) * 360}deg) translateZ(${rad}px)${b ? ' rotateY(180deg)' : ''}`, color: b ? 'rgba(11,11,15,.09)' : C.INK, ...disp(850, size, 0)}}>{c}</div>))}
      </div>
    </Wall>
  );
};
// Icons kreisen als gekippter Ring (Saturn), optional Implosion am Ende
export const IconOrbit: React.FC<Base & {n?: number; implode?: boolean}> = ({n = 14, implode = true, dur}) => {
  const t = useT();
  const imp = implode ? p(t, dur - 0.45, 0.3, EIN) : 0;
  return (
    <Wall o={fade(t, dur)} persp={1300}>
      <div style={{position: 'absolute', left: 540, top: 900, transformStyle: 'preserve-3d', transform: `rotateX(64deg) rotateZ(${t * 70}deg)`}}>
        {Array.from({length: n}, (_, i) => { const ang = (i / n) * Math.PI * 2; const pop = p(t, 0.05 + i * 0.02, 0.3, SPRING); const r = 470 * (1 - imp);
          return <div key={i} style={{position: 'absolute', left: Math.cos(ang) * r - 60, top: Math.sin(ang) * r - 60, transform: `rotateZ(${-t * 70}deg) rotateX(-64deg) scale(${pop * (1 - imp)})`}}><AppIcon i={i} size={120} /></div>; })}
      </div>
      <div style={{position: 'absolute', left: 540 - 90, top: 900 - 90, width: 180, height: 180, borderRadius: 50, background: '#fff', boxShadow: `0 30px 70px rgba(20,30,70,.2), 0 0 ${imp * 140}px ${C.BLUE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${p(t, 0, 0.3, SPRING) * (1 + imp * 0.3)})`}}><Glyph g="bolt" c={C.BLUE} s={100} /></div>
    </Wall>
  );
};
// Karussell aus Widgets (dreht sich, Front-Karte landet)
const WK: WKind[] = ['weather', 'music', 'calendar', 'rings', 'chart', 'notes', 'clock', 'battery'];
export const Carousel: React.FC<Base & {kinds?: WKind[]}> = ({kinds = WK, dur}) => {
  const t = useT();
  const n = kinds.length, step = 360 / n;
  const spin = lerp(p(t, 0, Math.max(0.8, dur - 0.3), SOFT), 250, 0);
  const enter = p(t, 0, 0.35);
  return (
    <Wall o={fade(t, dur)} persp={1700} origin="50% 40%">
      <div style={{position: 'absolute', left: 540, top: 880, transformStyle: 'preserve-3d', transform: `translateZ(${lerp(enter, -700, -160)}px) rotateX(${lerp(enter, -30, -10)}deg) rotateY(${spin}deg)`}}>
        {kinds.map((k, i) => <div key={i} style={{position: 'absolute', left: -180, top: -180, transform: `rotateY(${-i * step}deg) translateZ(560px)`, backfaceVisibility: 'hidden'}}><WidgetFace kind={k} t={t} /></div>)}
      </div>
    </Wall>
  );
};
// Cover-Flow: Karten in einer Reihe, mittlere frontal
export const CoverFlow: React.FC<Base & {n?: number; titles?: string[]; tags?: string[]; icons?: string[]}> = ({n = 7, titles, tags, icons, dur}) => {
  const t = useT();
  const th = useTheme();
  const hasW = !!(th.words && th.words.length);
  const pos = lerp(p(t, 0, Math.max(0.8, dur - 0.3), SOFT), n - 1, (n - 1) / 2);
  return (
    <Wall o={fade(t, dur)} persp={1400}>
      {Array.from({length: n}, (_, i) => { const d = i - pos; const ad = Math.abs(d);
        const ttl = titles?.[i] ?? (hasW ? tpick(th.words, [''], i) : `Look ${nn(i)}`);
        const tag = tags?.[i] ?? (hasW ? nn(i) : ['clean', 'bold', 'soft', 'loud', 'calm', 'pop', 'raw'][i % 7]);
        return <div key={i} style={{position: 'absolute', left: 540 - 220, top: 900 - 300, width: 440, height: 600, borderRadius: 40, overflow: 'hidden', transform: `translateX(${d * 260 + Math.sign(d) * 80 * Math.min(1, ad)}px) translateZ(${-ad * 220}px) rotateY(${-Math.sign(d) * Math.min(1, ad) * 55}deg)`, zIndex: 100 - Math.round(ad * 10), boxShadow: '0 40px 80px rgba(20,30,70,.25)',
          background: `linear-gradient(160deg, ${['#EAF2FF', '#FFECEC', '#E9FBF2'][i % 3]}, #fff)`}}>
          <div style={{position: 'absolute', left: 40, top: 40}}>{icons?.[i] ? <DeckIcon n={icons[i]} size={110} /> : <AppIcon i={i} size={110} />}</div>
          <div style={{position: 'absolute', left: 40, bottom: 50, ...disp(800, fit(ttl, 64, 360), -0.04), color: C.INK, whiteSpace: 'nowrap'}}>{ttl}</div>
          <div style={{position: 'absolute', left: 40, bottom: 120, ...serif(fit(tag, 48, 360, 0.45)), color: C.GREY, whiteSpace: 'nowrap'}}>{tag}</div>
        </div>; })}
    </Wall>
  );
};
// Würfel dreht sich mit 4 Seiten (Text pro Seite)
export const Cube: React.FC<Base & {faces?: string[]}> = ({faces: fp, dur}) => {
  const t = useT();
  const th = useTheme();
  const faces = fp ?? [0, 1, 2, 3].map((i) => tpick(th.words, ['Hook.', 'Tempo.', 'Story.', 'CTA.'], i));
  const steps = faces.length;
  const seg = Math.max(0.35, (dur - 0.2) / steps);
  const i = Math.min(steps - 1, Math.floor(t / seg));
  // Drehung länger + Sinus-Kurve (vorher 0,45·seg mit steiler INOUT: ~80° in einem Frame = Bildsprung); Takt pro Seite bleibt gleich
  const ang = (i + p(t, i * seg + seg * 0.38, seg * 0.6, (x: number) => (1 - Math.cos(Math.PI * x)) / 2) * (i < steps - 1 ? 1 : 0)) * 90;
  const S = 600;
  return (
    <AbsoluteFill style={{perspective: 2000, opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 540 - S / 2, top: 900 - S / 2, width: S, height: S, transformStyle: 'preserve-3d', transform: `scale(${p(t, 0, 0.35, SPRING)}) translateZ(${-S / 2}px) rotateX(-14deg) rotateY(${-ang}deg)`}}>
        {faces.map((f, j) => <div key={j} style={{position: 'absolute', inset: 0, borderRadius: 40, background: ['#fff', C.INK, '#fff', C.BLUE][j % 4], display: 'flex', alignItems: 'center', justifyContent: 'center', backfaceVisibility: 'hidden', whiteSpace: 'nowrap', transform: `rotateY(${j * 90}deg) translateZ(${S / 2}px)`, boxShadow: 'inset 0 0 0 2px rgba(0,0,0,.05)', color: j % 2 ? '#fff' : C.INK, ...(j % 2 ? serif(fit(f, 150, 520, 0.45)) : disp(850, fit(f, 120, 520), -0.05))}}>{f}</div>)}
        {/* Deckel oben/unten: man sieht nie ins Innere (sonst Spiegelschrift der Rückwände) */}
        {[90, -90].map((a) => <div key={a} style={{position: 'absolute', inset: 0, borderRadius: 40, background: '#E9EAEE', backfaceVisibility: 'hidden', transform: `rotateX(${a}deg) translateZ(${S / 2}px)`}} />)}
      </div>
    </AbsoluteFill>
  );
};
// Karten-Fächer öffnet sich
export const CardFan: React.FC<Base & {n?: number; titles?: string[]; subs?: string[]}> = ({n = 5, titles, subs, dur}) => {
  const t = useT();
  const th = useTheme();
  const hasW = !!(th.words && th.words.length);
  const k = p(t, 0.05, 0.5, SPRING);
  return (
    <Wall o={fade(t, dur)}>
      {Array.from({length: n}, (_, i) => { const d = i - (n - 1) / 2;
        const ttl = titles?.[i] ?? (hasW ? tpick(th.words, [''], i) : `Szene ${i + 1}`);
        const sub = subs?.[i] ?? (hasW ? nn(i) : ['Hook', 'Problem', 'Lösung', 'Beweis', 'CTA'][i % 5]);
        return <div key={i} style={{position: 'absolute', left: 540 - 190, top: 1100 - 520, width: 380, height: 540, borderRadius: 36, background: '#fff', boxShadow: '0 30px 70px rgba(20,30,70,.2)', transformOrigin: '50% 140%', transform: `rotate(${d * 12 * k}deg) translateY(${-Math.abs(d) * 10 * k}px) rotateY(${d * -6}deg)`, padding: 34, boxSizing: 'border-box'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 18}}><AppIcon i={i} size={84} /><div style={{whiteSpace: 'nowrap'}}><div style={{...disp(800, fit(ttl, 44, 205), -0.03), color: C.INK}}>{ttl}</div><div style={{...serif(fit(sub, 40, 205, 0.45)), color: C.GREY}}>{sub}</div></div></div>
        </div>; })}
    </Wall>
  );
};
// Kartenstapel mischt sich (oberste fliegt nach hinten)
export const CardShuffle: React.FC<Base & {n?: number}> = ({n = 4, dur}) => {
  const t = useT();
  const per = Math.max(0.3, (dur - 0.2) / n);
  return (
    <Wall o={fade(t, dur)}>
      {/* u wächst stetig: [0,1) = Karte fliegt von vorn nach hinten, [1,n) = rückt Stufe für Stufe nach vorn – kein Zurückspringen, keine Stufen ohne Übergang */}
      {Array.from({length: n}, (_, i) => { const u = (((t / per - i) % n) + n) % n; const f = u % 1; const e = INOUT(f);
        const fly = u < 1; const depth = fly ? INOUT(cl((f - 0.3) / 0.6)) * (n - 1) : n - 1 - (Math.floor(u - 1) + e); // fliegt erst hoch, taucht am höchsten Punkt nach hinten
        const lift = fly ? Math.sin(f * Math.PI) * 300 : 0;
        return <div key={i} style={{position: 'absolute', left: 540 - 300, top: 900 - 400, width: 600, height: 800, borderRadius: 50, background: ['#fff', '#EAF2FF', '#FFECEC', '#E9FBF2'][i % 4], boxShadow: '0 40px 90px rgba(20,30,70,.22)',
          transform: `translateY(${-depth * 26 - lift}px) translateZ(${-depth * 60}px) rotate(${(i % 2 ? 1 : -1) * (2 + depth)}deg) scale(${1 - depth * 0.04})`, zIndex: fly ? (f < 0.5 ? 100 : 0) : Math.round((n - depth) * 10), display: 'flex', alignItems: 'center', justifyContent: 'center', ...disp(850, 160, -0.05), color: C.INK}}>{i + 1}</div>; })}
    </Wall>
  );
};
// Isometrischer Homescreen – Icons heben sich als Welle
export const IsoGrid: React.FC<Base> = ({dur}) => {
  const t = useT();
  const iso = 1 - p(t, dur - 0.35, 0.3, INOUT) * 0;
  return (
    <AbsoluteFill style={{perspective: 2200, perspectiveOrigin: '50% 40%', opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 540 - 380, top: 960 - 520, width: 760, height: 1040, transformStyle: 'preserve-3d', transform: `rotateX(${55 * iso}deg) rotateZ(${-38 * iso}deg) scale(${p(t, 0, 0.35, SPRING)})`}}>
        <div style={{position: 'absolute', inset: -40, borderRadius: 90, background: 'rgba(255,255,255,.6)', boxShadow: '0 60px 120px rgba(20,30,70,.2)', border: '2px solid #fff'}} />
        <div style={{position: 'absolute', left: 0, top: 0, width: 360, height: 360, transform: 'translateZ(30px)'}}><div style={{width: 360, height: 360, borderRadius: 64, background: '#fff', boxShadow: '0 30px 60px rgba(20,30,70,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><svg width="270" height="270" viewBox="0 0 220 220"><Ring r={92} c={C.RED} v={0.85 * p(t, 0.2, 0.8)} /><Ring r={62} c={C.GREEN} v={0.7 * p(t, 0.3, 0.8)} /><Ring r={32} c={C.BLUE} v={0.92 * p(t, 0.4, 0.8)} /></svg></div></div>
        {Array.from({length: 20}, (_, i) => { const col = i < 4 ? 2 + (i % 2) : (i - 4) % 4, row = i < 4 ? Math.floor(i / 2) : 2 + Math.floor((i - 4) / 4); const pop = p(t, 0.05 + (col + row) * 0.04, 0.35, SPRING); const wave = Math.max(0, Math.sin(t * 7 - (col + row) * 0.7)) * 60;
          return <div key={i} style={{position: 'absolute', left: col * 200 + 20, top: row * 200 + 20, transform: `translateZ(${wave + 10}px) scale(${pop})`}}><AppIcon i={i + 2} size={150} /></div>; })}
      </div>
    </AbsoluteFill>
  );
};
// Karte kippt mit Parallax (Vorder-/Hintergrund-Ebenen)
// Deck-Icon: Emoji auf weißer Kachel (gleich in Cover-Flow und Tilt-Karte → durchgehendes Karten-Motiv)
const DeckIcon: React.FC<{n: string; size: number}> = ({n, size}) => (
  <div style={{width: size, height: size, borderRadius: size * 0.26, background: '#fff', boxShadow: '0 10px 24px rgba(20,30,70,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Emoji n={n} s={size * 0.68} /></div>
);
export const TiltCard: React.FC<Base & {title?: string; tag?: string; icon?: string; tint?: number; float?: boolean}> = ({title: tp, tag, icon, tint = 0, float = true, dur}) => {
  const t = useT();
  const th = useTheme();
  const title = tp ?? tpick(th.words, ['Parallax'], 0);
  const deck = !!(icon || tag);
  // Deck-Variante: Karte peitscht seitlich rein, dreht sich durch, Hintergrund-Kacheln ziehen vorbei (mehr Bewegung, QA 15.10.)
  const kin = p(t, 0, 0.22, EXPO), sweep = p(t, 0, dur, (x: number) => x);
  const rx = deck ? lerp(kin, 25, 6) : Math.sin(t * 2.2) * 14, ry = deck ? lerp(kin, -70, 0) + lerp(sweep, -14, 18) : Math.cos(t * 1.8) * 18;
  const tx = deck ? lerp(kin, 900 * (tint % 2 ? -1 : 1), 0) : 0;
  const pool = th.emoji && th.emoji.length ? th.emoji : null;
  return (
    <Wall o={fade(t, dur)}>
      {deck && pool && float ? <div style={{position: 'absolute', inset: 0, transform: 'translateZ(-600px) scale(1.45)', transformStyle: 'preserve-3d'}}>{Array.from({length: 14}, (_, i) => { const c = i % 4, r = Math.floor(i / 4); const y = 1920 - ((t * (520 + rnd(i) * 260) + r * 520 + rnd(i + 3) * 200) % 2400);
        return <div key={i} style={{position: 'absolute', left: 40 + c * 270 + (r % 2) * 120, top: y, opacity: 0.55, transform: `rotate(${(rnd(i + 7) - 0.5) * 30}deg)`}}><DeckIcon n={pool[i % pool.length]} size={150} /></div>; })}</div> : null}
      <div style={{position: 'absolute', left: 540 - 330, top: 900 - 440, width: 660, height: 880, borderRadius: 60, transformStyle: 'preserve-3d', transform: `translateX(${tx}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${deck ? lerp(sweep, 0.94, 1.06) : p(t, 0, 0.35, SPRING)})`, background: `linear-gradient(160deg, ${['#EAF2FF', '#FFECEC', '#E9FBF2'][tint % 3]}, #fff)`, boxShadow: '0 60px 120px rgba(20,30,70,.25)'}}>
        {icon || tag ? null : <div style={{position: 'absolute', left: 60, top: 60, transform: 'translateZ(60px)'}}><AppIcon i={0} size={160} /></div>}
        {icon || tag ? null : <div style={{position: 'absolute', right: 60, top: 300, width: 220, height: 220, borderRadius: 110, background: `radial-gradient(circle, ${C.RED}, #FF8A80)`, transform: 'translateZ(120px)', boxShadow: `0 30px 60px ${C.RED}55`}} />}
        {icon ? <div style={{position: 'absolute', left: 60, top: 60, transform: 'translateZ(80px)'}}><DeckIcon n={icon} size={220} /></div> : null}
        {tag ? <div style={{position: 'absolute', left: 60, bottom: 220, transform: 'translateZ(70px)', ...serif(fit(tag, 72, 540, 0.45)), color: C.GREY, whiteSpace: 'nowrap'}}>{tag}</div> : null}
        <div style={{position: 'absolute', left: 60, bottom: 80, transform: 'translateZ(90px)', ...disp(850, fit(title, 110, 540), -0.05), color: C.INK, whiteSpace: 'nowrap'}}>{title}</div>
      </div>
    </Wall>
  );
};
// Karte dreht sich um (Vorder-/Rückseite)
export const FlipCard: React.FC<Base & {front?: string; back?: string}> = ({front: fp, back: bp, dur}) => {
  const t = useT();
  const th = useTheme();
  const front = fp ?? tpick(th.words, ['Vorher'], 0), back = bp ?? tpick(th.words, ['', 'Nachher'], 1);
  const k = p(t, dur * 0.4, 0.45, INOUT);
  const face = (txt: string, bk: boolean): React.CSSProperties => ({position: 'absolute', inset: 0, borderRadius: 60, backfaceVisibility: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bk ? C.BLUE : '#fff', color: bk ? '#fff' : C.INK, transform: bk ? 'rotateY(180deg)' : 'none', boxShadow: '0 50px 100px rgba(20,30,70,.22)', whiteSpace: 'nowrap', ...(bk ? serif(fit(txt, 150, 560, 0.45)) : disp(850, fit(txt, 120, 560), -0.05))});
  return (
    <Wall o={fade(t, dur)}>
      <div style={{position: 'absolute', left: 540 - 330, top: 900 - 440, width: 660, height: 880, transformStyle: 'preserve-3d', transform: `rotateY(${k * 180}deg) scale(${p(t, 0, 0.35, SPRING) * (1 + Math.sin(k * Math.PI) * 0.08)})`}}>
        <div style={face(front, false)}>{front}</div><div style={face(back, true)}>{back}</div>
      </div>
    </Wall>
  );
};
// Tunnel: Karten fliegen auf die Kamera zu
export const CardTunnel: React.FC<Base> = ({dur}) => {
  const t = useT();
  return (
    <Wall o={fade(t, dur) * p(t, 0, 0.15)} persp={900}>
      <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateZ(${t * 20}deg)`}}>
        {Array.from({length: 16}, (_, i) => { const z = -2600 + ((t * 2400 + i * 300) % 3200); const ang = i * 2.399; const op = cl((z + 2600) / 500) * cl((500 - z) / 300);
          return <div key={i} style={{position: 'absolute', left: 540 + Math.cos(ang) * 480 - 150, top: 960 + Math.sin(ang) * 560 - 200, width: 300, height: 400, borderRadius: 30, transform: `translateZ(${z}px)`, opacity: op, background: '#fff', boxShadow: '0 20px 40px rgba(20,30,70,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><AppIcon i={i} size={130} /></div>; })}
      </div>
    </Wall>
  );
};
// Galeriewand fliegt rein (Masse als Beweis)
export const GalleryWall: React.FC<Base & {label?: string}> = ({label: lp, dur}) => {
  const t = useT();
  const th = useTheme();
  const label = lp ?? tpick(th.words, ['100+ Looks'], 0);
  const e = p(t, 0, 0.8, SOFT);
  return (
    <AbsoluteFill style={{perspective: 1100, opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `translateZ(${lerp(e, -900, 200)}px) rotateX(${lerp(e, 38, 8)}deg) rotateZ(${lerp(e, -14, -4)}deg)`}}>
        {Array.from({length: 16}, (_, i) => { const c = i % 4, r = Math.floor(i / 4); const pop = p(t, i * 0.02, 0.3, SPRING);
          return <div key={i} style={{position: 'absolute', left: 540 + (c - 1.5) * 330 - 150, top: 960 + (r - 1.5) * 520 + (c % 2 ? 120 : -60) - 230, width: 300, height: 460, borderRadius: 26, overflow: 'hidden', transform: `translateZ(${(rnd(i) - 0.5) * 300}px) scale(${pop})`, boxShadow: '0 30px 60px rgba(20,30,70,.18)', background: `linear-gradient(${i * 40}deg, ${['#EAF2FF', '#FFECEC', '#E9FBF2', '#F4F4F5'][i % 4]}, #fff)`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><WidgetFace kind={(['weather', 'rings', 'chart', 'music', 'calendar', 'steps', 'photos', 'map'] as WKind[])[i % 8]} t={t} size={260} /></div>; })}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 860, textAlign: 'center', opacity: p(t, 0.45, 0.25)}}><span style={{display: 'inline-block', background: '#fff', borderRadius: 30, padding: '18px 44px 26px', boxShadow: '0 30px 80px rgba(20,30,70,.25)', color: C.INK, whiteSpace: 'nowrap', ...disp(800, fit(label, 120, 900), -0.05)}}>{label}</span></div>
    </AbsoluteFill>
  );
};
// 3D-Balken wachsen (isometrisch)
export const Bars3D: React.FC<Base & {vals?: number[]; label?: string}> = ({vals = [0.35, 0.55, 0.45, 0.8, 1], label, dur}) => {
  const t = useT();
  const th = useTheme();
  const num = th.numbers && th.numbers.length ? th.numbers[0] : null;
  const head = label ?? (num !== null ? `+${Math.round(num * p(t, 0.5, 0.8, SOFT)).toLocaleString('de-DE')}` : '+128%');
  return (
    <AbsoluteFill style={{perspective: 1800, opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 540, top: 1150, transformStyle: 'preserve-3d', transform: `rotateX(58deg) rotateZ(-40deg)`}}>
        {vals.map((v, i) => { const h = v * 520 * p(t, 0.1 + i * 0.08, 0.5, SPRING); const x = (i - (vals.length - 1) / 2) * 150; const col = i === vals.length - 1 ? C.BLUE : '#D9DCE4';
          return <div key={i} style={{position: 'absolute', left: x - 50, top: -50, width: 100, height: 100, transformStyle: 'preserve-3d'}}>
            <div style={{position: 'absolute', inset: 0, background: i === vals.length - 1 ? '#5AA0FF' : '#fff', transform: `translateZ(${h}px)`}} />
            <div style={{position: 'absolute', left: 0, top: 100, width: 100, height: h, background: col, transformOrigin: '0 0', transform: 'rotateX(-90deg)'}} />
            <div style={{position: 'absolute', left: 100, top: 0, width: h, height: 100, background: i === vals.length - 1 ? '#0850C8' : '#C4C8D2', transformOrigin: '0 0', transform: 'rotateY(90deg)'}} />
          </div>; })}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 330, textAlign: 'center', ...disp(800, fit(head, 120, 960), -0.05), color: C.INK, opacity: p(t, 0.5, 0.3), fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>{head}</div>
    </AbsoluteFill>
  );
};
// Kugel aus Icons (Fibonacci-Kugel) dreht sich
export const IconSphere: React.FC<Base & {n?: number}> = ({n = 34, dur}) => {
  const t = useT();
  const R = 420;
  return (
    <Wall o={fade(t, dur)} persp={1600}>
      <div style={{position: 'absolute', left: 540, top: 900, transformStyle: 'preserve-3d', transform: `rotateY(${t * 60}deg) rotateX(${-15 + Math.sin(t) * 8}deg) scale(${p(t, 0, 0.5, SPRING)})`}}>
        {Array.from({length: n}, (_, i) => { const y = 1 - (i / (n - 1)) * 2; const r = Math.sqrt(1 - y * y); const th = i * 2.39996; const x = Math.cos(th) * r, z = Math.sin(th) * r;
          const ry = Math.atan2(x, z) * 180 / Math.PI, rx = -Math.asin(y) * 180 / Math.PI;
          return <div key={i} style={{position: 'absolute', left: -50, top: -50, transform: `rotateY(${ry}deg) rotateX(${rx}deg) translateZ(${R}px)`}}><AppIcon i={i} size={100} /></div>; })}
      </div>
    </Wall>
  );
};
// Stufen-Treppe: Karten bauen sich als 3D-Treppe auf
export const Stairs: React.FC<Base & {labels?: string[]}> = ({labels: lp, dur}) => {
  const t = useT();
  const th = useTheme();
  const labels = lp ?? (th.words && th.words.length >= 2 ? th.words.slice(0, 5) : ['Idee', 'Skript', 'Schnitt', 'Post', 'Viral']);
  return (
    <Wall o={fade(t, dur)} persp={1800}>
      <div style={{position: 'absolute', left: 540, top: 1000, transformStyle: 'preserve-3d', transform: 'rotateX(20deg) rotateY(-25deg)'}}>
        {labels.map((l, i) => { const k = p(t, i * 0.12, 0.4, SPRING);
          return <div key={i} style={{position: 'absolute', left: -380 + i * 150, top: -i * 150 - 100, width: 300, height: 120, borderRadius: 24, background: i === labels.length - 1 ? C.GREEN : '#fff', color: i === labels.length - 1 ? '#fff' : C.INK, boxShadow: '0 30px 60px rgba(20,30,70,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `translateZ(${lerp(k, 400, 0)}px) scale(${k})`, whiteSpace: 'nowrap', ...disp(750, fit(l, 48, 260), -0.02)}}>{l}</div>; })}
      </div>
    </Wall>
  );
};
export {Glyph, ACCENTS, EXPO};
