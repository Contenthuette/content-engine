// UI · iOS/macOS-Oberflächen im Apple-Look (neutral, keine fremden Logos)
import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {Base, C, disp, serif, useT, p, lerp, cl, rnd, EXPO, EIN, SPRING, INOUT, outK, Glass, Center, AppIcon, Glyph, Cursor, Ripple, Face, SearchIcon, asset, useTheme, tpick} from './core';

const fade = (t: number, dur: number) => 1 - outK(t, dur);
// weicher Druck-Impuls statt Stufe (Button gedrückt um `at`, Breite w)
const press = (t: number, at: number, w = 0.06, depth = 0.08) => 1 - depth * Math.max(0, 1 - Math.abs(t - at) / w);
const has = (a?: unknown[]) => !!(a && a.length);

export const ChipEl: React.FC<Base & {text?: string; dot?: string; y?: number; icon?: number}> = ({text: textP, dot, icon = 1, y = 960, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = textP ?? tpick(th.apps, ['Claude Code'], 0);
  return (
    <Center y={y} style={{opacity: fade(t, dur)}}>
      <div style={{transform: `scale(${p(t, 0, 0.3, SPRING)})`}}>
        <Glass style={{borderRadius: 40, padding: '16px 30px', display: 'flex', alignItems: 'center', gap: 16, color: C.INK, ...disp(700, 44, -0.01)}}>
          {dot ? <div style={{width: 20, height: 20, borderRadius: 10, background: dot, boxShadow: `0 0 0 7px ${dot}33`}} /> : <AppIcon i={icon} size={54} />}{text}
        </Glass>
      </div>
    </Center>
  );
};
// Cursor fliegt rein und klickt einen Button
export const CursorClick: React.FC<Base & {label?: string; done?: string; color?: string; y?: number}> = ({label = 'Jetzt starten', done = 'Erledigt ✓', color = C.BLUE, y = 960, dur}) => {
  const t = useT();
  const k = p(t, 0.05, 0.35, EXPO);
  const down = t >= 0.45 && t < 0.55;
  const clicked = t >= 0.5;
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <Center y={y}><div style={{transform: `scale(${press(t, 0.5, 0.07) * p(t, 0, 0.3, SPRING)})`, background: clicked ? C.GREEN : color, color: '#fff', borderRadius: 60, padding: '30px 70px', boxShadow: `0 20px 50px ${clicked ? C.GREEN : color}55`, whiteSpace: 'nowrap', ...disp(700, 56, -0.02)}}>{clicked ? done : label}</div></Center>
      <Ripple t={t} at={0.5} x={600} y={y + 10} c={clicked ? C.GREEN : color} size={260} />
      <Cursor x={lerp(k, 950, 580)} y={lerp(k, 1500, y - 10)} down={down} />
    </AbsoluteFill>
  );
};
// Spotlight-Suche: Punkt → Leiste, tippt
export const SearchBar: React.FC<Base & {text?: string; y?: number; glow?: boolean}> = ({text: textP, y = 900, glow = true, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = textP ?? th.topic ?? tpick(th.words, ['Showreel 2026'], 0);
  const born = p(t, 0, 0.3, SPRING);
  const w = lerp(p(t, 0.06, 0.28, EXPO), 120, 860);
  const n = Math.round(cl((t - 0.3) / 0.6) * text.length);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      {glow ? <div style={{position: 'absolute', left: 540 - w / 2 + 40, width: w - 80, top: y + 60, height: 80, borderRadius: 60, filter: 'blur(34px)', opacity: 0.55 * born, background: `linear-gradient(90deg, ${C.BLUE}, ${C.RED}, ${C.GREEN}, ${C.BLUE})`, backgroundSize: '300% 100%', backgroundPosition: `${t * 120}% 0`}} /> : null}
      <div style={{position: 'absolute', left: 540 - w / 2, top: y - 70, width: w, height: 140, borderRadius: 70, background: '#fff', transform: `scale(${born})`, boxShadow: '0 30px 80px rgba(20,30,70,.16), 0 0 0 1.5px rgba(0,0,0,.04)', display: 'flex', alignItems: 'center', gap: 22, padding: '0 40px', boxSizing: 'border-box', overflow: 'hidden'}}>
        <SearchIcon s={48} />
        <span style={{color: C.INK, whiteSpace: 'nowrap', ...disp(650, text.length > 24 ? Math.max(36, Math.round(56 * 24 / text.length)) : 56, -0.03)}}>{text.slice(0, n)}<span style={{color: C.BLUE, opacity: Math.floor(t * 3.4) % 2 ? 0 : 1, fontWeight: 300}}>|</span></span>
      </div>
    </AbsoluteFill>
  );
};
// Dynamic Island in Varianten
export const Island: React.FC<Base & {mode?: 'live' | 'music' | 'timer' | 'call' | 'done'; y?: number; track?: string; name?: string; doneText?: string}> = ({mode = 'live', y = 420, track: trackP, name: nameP, doneText: doneP, dur}) => {
  const t = useT();
  const th = useTheme();
  const track = trackP ?? tpick(th.words, ['Showreel Mix'], 0);
  const name = nameP ?? tpick(th.names, ['Leif Dunkelmann'], 0);
  const doneText = doneP ?? (has(th.words) ? `${tpick(th.words, [], 0)} ✓` : 'Video exportiert');
  const k = p(t, 0, 0.4, SPRING);
  const w = lerp(k, 160, mode === 'call' ? 900 : 620), h = lerp(k, 48, mode === 'call' ? 200 : 110);
  const inner = cl((k - 0.6) / 0.4);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 540 - w / 2, top: y - h / 2, width: w, height: h, borderRadius: h / 2, background: '#000', boxShadow: '0 20px 50px rgba(0,0,0,.25)', overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '0 32px', boxSizing: 'border-box', gap: 18}}>
        <div style={{opacity: inner, display: 'flex', alignItems: 'center', gap: 18, width: '100%'}}>
          {mode === 'live' ? <><div style={{width: 18, height: 18, borderRadius: 9, background: '#FF3B30'}} /><span style={{color: '#fff', ...disp(700, 34, 0.04)}}>LIVE</span><div style={{flex: 1, display: 'flex', gap: 7, justifyContent: 'flex-end', alignItems: 'center'}}>{Array.from({length: 8}, (_, i) => <div key={i} style={{width: 8, height: 12 + Math.abs(Math.sin(t * 20 + i * 1.3)) * 44, borderRadius: 4, background: C.GREEN}} />)}</div></> : null}
          {mode === 'music' ? <><div style={{width: 64, height: 64, borderRadius: 14, background: `linear-gradient(135deg, ${C.RED}, #FF8A80)`}} /><span style={{color: '#fff', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...disp(650, 32, 0)}}>{track}</span>{Array.from({length: 4}, (_, i) => <div key={i} style={{width: 7, height: 10 + Math.abs(Math.sin(t * 16 + i)) * 30, borderRadius: 4, background: C.RED}} />)}</> : null}
          {mode === 'timer' ? <><div style={{width: 54, height: 54, borderRadius: 27, border: `6px solid ${C.RED}`, borderRightColor: 'transparent', transform: `rotate(${t * 360}deg)`}} /><span style={{color: C.RED, flex: 1, textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...disp(600, 54, 0)}}>0:{String(Math.max(0, 15 - Math.floor(t * 4))).padStart(2, '0')}</span></> : null}
          {mode === 'done' ? <><div style={{width: 60, height: 60, borderRadius: 30, background: C.GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Glyph g="check" c="#fff" s={40} /></div><span style={{color: '#fff', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...disp(650, 34, 0)}}>{doneText}</span></> : null}
          {mode === 'call' ? <><Face size={120} /><div style={{flex: 1, minWidth: 0}}><div style={{color: '#9A9AA2', ...disp(500, 28, 0)}}>FaceTime</div><div style={{color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...disp(650, 44, -0.01)}}>{name}</div></div><div style={{width: 96, height: 96, borderRadius: 48, background: '#FF3B30'}} /><div style={{width: 96, height: 96, borderRadius: 48, background: C.GREEN, transform: `scale(${1 + Math.sin(t * 10) * 0.06})`}} /></> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};
// Benachrichtigung fällt von oben rein
export const Notification: React.FC<Base & {title?: string; body?: string; bodies?: string[]; icon?: number; y?: number; stack?: number}> = ({title: titleP, body: bodyP, bodies, icon = 4, y = 250, stack = 1, dur}) => {
  const t = useT();
  const th = useTheme();
  const kw = th.kw ?? tpick(th.comments, ['CODING'], 0);
  const title = titleP ?? (has(th.apps) ? tpick(th.apps, [], 0) : 'KOMMENTARE');
  const body = bodyP ?? `Neuer Kommentar: „${kw}“`;
  // weitere Karten im Stapel: explizite Liste > Thema (Wort + Zahl) > alter Default
  const sub = (i: number) => bodies?.[i] ?? (has(th.words) || has(th.numbers) ? `${tpick(th.words, ['Neue Follower'], i - 1)}: +${tpick(th.numbers, [214], i - 1).toLocaleString('de-DE')}` : 'Neue Follower: +214');
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      {Array.from({length: stack}, (_, i) => {
        const k = p(t, i * 0.18, 0.35, SPRING);
        return (
          <div key={i} style={{position: 'absolute', left: 50, right: 50, top: y + i * 24, transform: `translateY(${lerp(k, -280, 0)}px) scale(${1 - i * 0.04})`, zIndex: 10 - i, opacity: i ? 0.9 : 1}}>
            <Glass style={{borderRadius: 44, padding: '24px 28px', display: 'flex', gap: 22, alignItems: 'center', background: 'rgba(250,250,252,.94)'}}>
              <AppIcon i={icon + i} size={84} />
              <div style={{flex: 1}}><div style={{display: 'flex', justifyContent: 'space-between', color: C.GREY, ...disp(600, 26, 0)}}><span>{title}</span><span>jetzt</span></div><div style={{color: C.INK, marginTop: 6, ...disp(650, 36, -0.01)}}>{i ? sub(i) : body}</div></div>
            </Glass>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
// iMessage-Verlauf
const CHAT0 = [{text: 'Wer hat das geschnitten?? 😳'}, {me: true, text: 'Mein System. Komplett automatisch.'}, {text: 'Wie geht das?? 🤯'}];
export const Chat: React.FC<Base & {msgs?: {me?: boolean; text: string}[]; gap?: number; name?: string}> = ({msgs: msgsP, gap = 0.38, name: nameP, dur}) => {
  const t = useT();
  const th = useTheme();
  const msgs = msgsP ?? CHAT0.map((m, i) => ({...m, text: tpick(th.comments, CHAT0.map((x) => x.text), i)}));
  const name = nameP ?? tpick(th.names, ['Leif'], 0);
  return (
    <AbsoluteFill className="dl-root" style={{background: '#fff', opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 230, height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, borderBottom: `1.5px solid ${C.LINE}`}}><Face size={110} /><div style={{color: C.INK, ...disp(600, 28, 0)}}>{name} ›</div></div>
      {msgs.map((m, i) => {
        const at = 0.25 + i * gap;
        const typing = !m.me && t >= at - 0.22 && t < at;
        const k = p(t, at, 0.35, SPRING);
        return (
          <React.Fragment key={i}>
            {typing ? <div style={{position: 'absolute', left: 90, top: 520 + i * 200, background: '#E9E9EE', borderRadius: 40, padding: '26px 30px', display: 'flex', gap: 10}}>{[0, 1, 2].map((d) => <div key={d} style={{width: 18, height: 18, borderRadius: 9, background: '#9A9AA2', transform: `translateY(${Math.sin(t * 18 - d) * 5}px)`}} />)}</div> : null}
            {t >= at ? <div style={{position: 'absolute', top: 520 + i * 200, [m.me ? 'right' : 'left']: 90, maxWidth: 840, transform: `scale(${lerp(k, 0.5, 1)})`, transformOrigin: m.me ? '100% 100%' : '0% 100%', opacity: cl(k * 3), background: m.me ? C.BLUE : '#E9E9EE', color: m.me ? '#fff' : C.INK, borderRadius: 48, padding: '28px 38px', ...disp(550, 46, -0.015)}}>{m.text}</div> : null}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
// Kommentar-Salve (Karten stapeln sich)
const CMT0 = [{n: 'max.builds', c: 'wie krass ist der Schnitt 🔥'}, {n: 'lena.creates', c: 'welche Software?? 👀'}, {n: 'jonas.media', c: 'brauch ich für meine Firma'}, {n: 'sarah.ai', c: 'CODING'}];
export const Comments: React.FC<Base & {items?: {n: string; c: string}[]}> = ({items: itemsP, dur}) => {
  const t = useT();
  const th = useTheme();
  const hs = has(th.handles) ? th.handles : th.names;
  const items = itemsP ?? CMT0.map((o, i) => ({n: tpick(hs, CMT0.map((x) => x.n), i), c: i === 3 && th.kw ? th.kw : tpick(th.comments, CMT0.map((x) => x.c), i)}));
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      {items.map((c, i) => {
        const k = p(t, i * 0.16, 0.32, SPRING);
        return (
          <div key={i} style={{position: 'absolute', left: 540, top: 440 + i * 190, width: 860, transform: `translateX(-50%) translateY(${lerp(k, 140, 0)}px) rotate(${(i % 2 ? 1 : -1) * 1.5}deg)`, opacity: cl(k * 3)}}>
            <Glass style={{borderRadius: 36, padding: '24px 30px', display: 'flex', gap: 22, alignItems: 'center', background: '#fff'}}>
              <div style={{width: 78, height: 78, borderRadius: 39, background: `linear-gradient(135deg, hsl(${i * 70 + 10},70%,62%), hsl(${i * 70 + 60},70%,52%))`, flexShrink: 0}} />
              <div style={{flex: 1}}><div style={{color: C.INK, ...disp(650, 28, -0.01)}}>{c.n} <span style={{color: C.LIGHT, fontWeight: 500}}>· jetzt</span></div><div style={{color: '#2A2A2E', marginTop: 6, ...disp(550, 40, -0.02)}}>{c.c}</div></div>
              <div style={{color: C.RED, fontSize: 40}}>♥</div>
            </Glass>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
// CTA-Karte: Kommentiere KEYWORD → Senden → DM-Blase
export const CtaCard: React.FC<Base & {kw?: string; y?: number; reply?: string}> = ({kw: kwP, y = 900, reply = 'Hier ist dein Link 🔗', dur}) => {
  const t = useT();
  const th = useTheme();
  const kw = kwP ?? th.kw ?? tpick(th.comments, ['CODING'], 0);
  const ck = p(t, 0, 0.35, SPRING);
  const typed = kw.slice(0, Math.round(cl((t - 0.3) / 0.35) * kw.length));
  const sent = t >= 0.85;
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 90, width: 900, top: y - 150, transform: `translateY(${lerp(ck, 300, 0)}px)`}}>
        <Glass style={{borderRadius: 48, padding: '34px 38px', background: '#fff'}}>
          <div style={{color: C.INK, ...disp(700, 54, -0.03)}}>Kommentiere</div>
          <div style={{marginTop: 18, display: 'flex', alignItems: 'center', gap: 18}}>
            <div style={{flex: 1, height: 104, borderRadius: 52, border: `4px solid ${sent ? C.GREEN : C.BLUE}`, display: 'flex', alignItems: 'center', padding: '0 34px', color: C.INK, ...disp(800, 56, 0.04)}}>{typed}<span style={{color: C.BLUE, opacity: !sent && Math.floor(t * 4) % 2 === 0 ? 1 : 0, fontWeight: 300}}>|</span></div>
            <div style={{width: 104, height: 104, borderRadius: 52, background: sent ? C.GREEN : C.BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${press(t, 0.85, 0.06, 0.14)})`}}><svg width="46" height="46" viewBox="0 0 24 24"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
          </div>
        </Glass>
      </div>
      {sent ? <div style={{position: 'absolute', left: 90, top: y + 200, transform: `scale(${p(t, 0.95, 0.3, SPRING)})`, transformOrigin: '0% 50%', background: C.BLUE, color: '#fff', borderRadius: 40, padding: '18px 38px 20px', boxShadow: `0 20px 44px ${C.BLUE}66`, ...disp(650, 50, -0.02)}}>{reply}</div> : null}
    </AbsoluteFill>
  );
};
export const Toggle: React.FC<Base & {label?: string; y?: number}> = ({label: labelP, y = 960, dur}) => {
  const t = useT();
  const th = useTheme();
  const label = labelP ?? tpick(th.words, ['Auto-Schnitt'], 0);
  const on = p(t, 0.35, 0.25, SPRING);
  return (
    <Center y={y} style={{opacity: fade(t, dur)}}>
      <div style={{transform: `scale(${p(t, 0, 0.3, SPRING)})`}}>
        <Glass style={{width: 860, borderRadius: 44, padding: '34px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff'}}>
          <span style={{...disp(650, 52, -0.02), color: C.INK}}>{label}</span>
          <div style={{width: 170, height: 100, borderRadius: 50, background: `color-mix(in srgb, ${C.GREEN} ${on * 100}%, #E5E5EA)`, position: 'relative'}}><div style={{position: 'absolute', top: 8, left: lerp(on, 8, 78), width: 84, height: 84, borderRadius: 42, background: '#fff', boxShadow: '0 6px 14px rgba(0,0,0,.2)'}} /></div>
        </Glass>
      </div>
    </Center>
  );
};
export const Slider: React.FC<Base & {label?: string; y?: number}> = ({label: labelP, y = 960, dur}) => {
  const t = useT();
  const th = useTheme();
  const label = labelP ?? tpick(th.words, ['Energie'], 0);
  const v = p(t, 0.2, 0.7, INOUT);
  return (
    <Center y={y} style={{opacity: fade(t, dur)}}>
      <Glass style={{width: 860, borderRadius: 44, padding: '34px 40px', background: '#fff', transform: `scale(${p(t, 0, 0.3, SPRING)})`}}>
        <div style={{display: 'flex', justifyContent: 'space-between', ...disp(650, 46, -0.02), color: C.INK}}><span>{label}</span><span style={{color: C.RED, fontVariantNumeric: 'tabular-nums'}}>{Math.round(v * 100)}%</span></div>
        <div style={{position: 'relative', height: 18, borderRadius: 9, background: '#E5E5EA', marginTop: 34}}><div style={{width: `${v * 100}%`, height: 18, borderRadius: 9, background: C.RED}} /><div style={{position: 'absolute', top: -27, left: `calc(${v * 100}% - 36px)`, width: 72, height: 72, borderRadius: 36, background: '#fff', boxShadow: '0 6px 16px rgba(0,0,0,.2)'}} /></div>
      </Glass>
    </Center>
  );
};
export const Progress: React.FC<Base & {label?: string; y?: number}> = ({label: labelP, y = 960, dur}) => {
  const t = useT();
  const th = useTheme();
  const label = labelP ?? tpick(th.words, ['Rendering'], 0);
  const v = p(t, 0.1, Math.max(0.6, dur - 0.5), INOUT);
  return (
    <Center y={y} style={{opacity: fade(t, dur)}}>
      <Glass style={{width: 860, borderRadius: 44, padding: '34px 40px', background: '#fff', transform: `scale(${p(t, 0, 0.3, SPRING)})`}}>
        <div style={{display: 'flex', justifyContent: 'space-between', ...disp(650, 46, -0.02), color: C.INK}}><span>{label}</span><span style={{fontVariantNumeric: 'tabular-nums', color: v >= 0.999 ? C.GREEN : C.INK}}>{v >= 0.999 ? '✓' : `${Math.round(v * 100)}%`}</span></div>
        <div style={{height: 22, borderRadius: 11, background: '#E5E5EA', marginTop: 28, overflow: 'hidden'}}><div style={{width: `${v * 100}%`, height: 22, borderRadius: 11, background: `linear-gradient(90deg, ${C.BLUE}, ${C.GREEN})`}} /></div>
      </Glass>
    </Center>
  );
};
const CHK0 = ['Hook geschnitten', 'Sounds gesetzt', 'Farben gegradet', 'Export fertig'];
export const Checklist: React.FC<Base & {items?: string[]}> = ({items: itemsP, dur}) => {
  const t = useT();
  const th = useTheme();
  const items = itemsP ?? CHK0.map((d, i) => tpick(th.words, CHK0, i));
  return (
    <Center y={960} style={{opacity: fade(t, dur)}}>
      <Glass style={{width: 860, borderRadius: 48, padding: '30px 40px', background: '#fff', transform: `scale(${p(t, 0, 0.3, SPRING)})`}}>
        {items.map((it, i) => { const at = 0.2 + i * 0.22; const done = t >= at + 0.15; const spin = t >= at && !done;
          return <div key={i} style={{display: 'flex', alignItems: 'center', gap: 24, padding: '20px 0', borderBottom: i < items.length - 1 ? `1.5px solid ${C.LINE}` : 'none'}}>
            <div style={{width: 60, height: 60, borderRadius: 30, background: done ? C.GREEN : 'transparent', border: done ? 'none' : `5px solid ${spin ? C.BLUE : '#E5E5EA'}`, borderRightColor: spin ? 'transparent' : undefined, transform: spin ? `rotate(${t * 720}deg)` : `scale(${done ? p(t, at + 0.15, 0.25, SPRING) : 1})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box'}}>{done ? <Glyph g="check" c="#fff" s={40} /> : null}</div>
            <span style={{...disp(600, 46, -0.02), color: done ? C.INK : C.LIGHT}}>{it}</span>
          </div>; })}
      </Glass>
    </Center>
  );
};
export const Toast: React.FC<Base & {text?: string; y?: number}> = ({text = 'Gespeichert', y = 1300, dur}) => {
  const t = useT();
  return (
    <Center y={y} style={{opacity: fade(t, dur)}}>
      <div style={{transform: `translateY(${lerp(p(t, 0, 0.35, SPRING), 200, 0)}px)`, background: C.INK, color: '#fff', borderRadius: 50, padding: '24px 44px', display: 'flex', alignItems: 'center', gap: 18, ...disp(650, 44, -0.01)}}>
        <div style={{width: 50, height: 50, borderRadius: 25, background: C.GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Glyph g="check" c="#fff" s={34} /></div>{text}
      </div>
    </Center>
  );
};
// Tastatur mit tippenden Tasten
export const Keyboard: React.FC<Base & {text?: string}> = ({text: textP, dur}) => {
  const t = useT();
  const th = useTheme();
  const text = textP ?? th.kw ?? tpick(th.words, ['WUMMS'], 0);
  const rows = ['QWERTZUIOP', 'ASDFGHJKL', 'YXCVBNM'];
  // Tipptempo passt sich der Länge an (lange Texte werden vor Ende fertig), Schrift schrumpft statt über den Rand zu laufen
  const step = Math.min(0.14, Math.max(0.05, (dur - 0.5) / Math.max(1, text.length)));
  const i = Math.floor(t / step); const active = (text[i] ?? '').toUpperCase();
  const fs = Math.min(120, Math.round(960 / Math.max(1, text.length * 0.62)));
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <Center y={700}><div style={{...disp(800, fs, 0.02), color: C.INK, whiteSpace: 'nowrap'}}>{text.slice(0, Math.min(text.length, i + 1))}<span style={{color: C.BLUE, fontWeight: 300}}>|</span></div></Center>
      <div style={{position: 'absolute', left: 40, right: 40, top: 1000, padding: 20, borderRadius: 40, background: '#D1D3D9', transform: `translateY(${lerp(p(t, 0, 0.35, EXPO), 600, 0)}px)`}}>
        {rows.map((r, ri) => <div key={ri} style={{display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 12}}>{r.split('').map((k) => <div key={k} style={{width: 84, height: 108, borderRadius: 14, background: k === active ? C.BLUE : '#fff', color: k === active ? '#fff' : C.INK, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 0 rgba(0,0,0,.2)', transform: `scale(${k === active ? 1.15 : 1})`, ...disp(500, 44, 0)}}>{k}</div>)}</div>)}
      </div>
    </AbsoluteFill>
  );
};
// macOS-Fenster mit Screenshot
export const MacWindow: React.FC<Base & {src?: string; title?: string; dark?: boolean}> = ({src = 'lib/img/screenshot.png', title: titleP, dark, dur}) => {
  const t = useT();
  const th = useTheme();
  const title = titleP ?? th.brand ?? tpick(th.apps, ['github.com'], 0);
  const k = p(t, 0, 0.4, EXPO);
  return (
    <AbsoluteFill style={{perspective: 1600, opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 70, top: 460, width: 940, height: 820, borderRadius: 30, overflow: 'hidden', background: dark ? '#141416' : '#fff', boxShadow: '0 50px 120px rgba(10,20,60,.3)', transform: `translateY(${lerp(k, 400, 0)}px) rotateX(${lerp(k, 30, 0)}deg) scale(${lerp(k, 0.8, 1) + t * 0.02})`}}>
        <div style={{height: 58, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', background: dark ? '#1E1E21' : '#F1F1F3'}}>{['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{width: 18, height: 18, borderRadius: 9, background: c}} />)}<div style={{flex: 1, textAlign: 'center', color: C.GREY, marginRight: 70, ...disp(500, 24, 0)}}>{title}</div></div>
        <Img src={asset(src)} style={{width: 940 * 1.7, marginLeft: -940 * 0.62, marginTop: -60}} />
      </div>
    </AbsoluteFill>
  );
};
// Terminal tippt Befehl + Ausgabe
const TERM0 = ['✓ Hook erkannt', '✓ 42 Schnitte gesetzt', '✓ Sounds synchronisiert', '✓ Export: reel_final.mp4'];
export const Terminal: React.FC<Base & {cmd?: string; out?: string[]; bin?: string}> = ({cmd: cmdP, out: outP, bin: binP, dur}) => {
  const t = useT();
  const th = useTheme();
  // Programmname: Prop > Thema (App/Marke) > neutral „run“; ohne Thema alter Default
  const themed = !!(th.topic || has(th.words));
  const bin = (binP ?? (themed ? (tpick(th.apps, [th.brand ?? 'run'], 0)) : 'claude')).toLowerCase().replace(/\s+/g, '-');
  const cmd = cmdP ?? (themed ? `${bin} "${th.topic ?? tpick(th.words, [''], 0)}"` : `${bin} "schneide mein Reel"`);
  const out = outP ?? (has(th.words) ? TERM0.map((o, i) => `✓ ${tpick(th.words, [], i)}`) : TERM0);
  const n = Math.min(cmd.length, Math.floor(cl((t - 0.2) / 0.6) * cmd.length));
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 60, top: 520, width: 960, height: 760, borderRadius: 30, background: '#16161A', boxShadow: '0 50px 120px rgba(10,20,60,.35)', overflow: 'hidden', transform: `scale(${p(t, 0, 0.35, SPRING)})`}}>
        <div style={{height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', background: '#232327'}}>{['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{width: 18, height: 18, borderRadius: 9, background: c}} />)}</div>
        <div style={{padding: '36px 40px', fontFamily: 'Menlo, monospace', fontSize: 38, lineHeight: 1.6, color: '#E6E6EA'}}>
          <div><span style={{color: C.GREEN}}>~ ❯ </span>{cmd.slice(0, n)}<span style={{opacity: Math.floor(t * 3) % 2 ? 0 : 1}}>▋</span></div>
          {out.map((o, i) => t >= 0.9 + i * 0.2 ? <div key={i} style={{color: i === out.length - 1 ? C.GREEN : '#B8B8C0', transform: `translateX(${lerp(p(t, 0.9 + i * 0.2, 0.2), 30, 0)}px)`}}>{o}</div> : null)}
        </div>
      </div>
    </AbsoluteFill>
  );
};
// Code-Editor: Zeilen erscheinen mit Syntaxfarben
export const CodeEditor: React.FC<Base & {kw?: string}> = ({kw: kwP, dur}) => {
  const t = useT();
  const th = useTheme();
  const kw = kwP ?? th.kw ?? tpick(th.words, ['WUMMS'], 0);
  const lines = [[['const ', '#C678DD'], ['reel', C.INK], [' = ', C.GREY], ['await ', '#C678DD'], ['edit', C.BLUE], ['(clip)', C.INK]], [['reel', C.INK], ['.', C.GREY], ['addHook', C.BLUE], ['(', C.GREY], [`"${kw}"`, C.GREEN], [')', C.GREY]], [['reel', C.INK], ['.', C.GREY], ['sync', C.BLUE], ['(', C.GREY], ['beats', C.RED], [')', C.GREY]], [['export ', '#C678DD'], ['reel', C.INK]]];
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <div style={{position: 'absolute', left: 60, top: 560, width: 960, borderRadius: 30, background: '#fff', boxShadow: '0 50px 120px rgba(10,20,60,.2)', padding: '40px 0', transform: `scale(${p(t, 0, 0.35, SPRING)})`}}>
        {lines.map((l, i) => { const k = p(t, 0.2 + i * 0.16, 0.25); return <div key={i} style={{display: 'flex', fontFamily: 'Menlo, monospace', fontSize: 40, lineHeight: 1.8, padding: '0 40px', background: i === Math.floor((t - 0.2) / 0.16) ? `${C.BLUE}10` : 'transparent', opacity: k, transform: `translateX(${lerp(k, 30, 0)}px)`}}><span style={{color: '#C0C0C8', width: 60}}>{i + 1}</span>{l.map(([s, c], j) => <span key={j} style={{color: c, whiteSpace: 'pre'}}>{s}</span>)}</div>; })}
      </div>
    </AbsoluteFill>
  );
};
// Einstellungen-Liste (iOS Settings)
const SET0 = ['Auto-Schnitt', 'Beat-Sync', 'Untertitel', 'Export 4K'];
export const Settings: React.FC<Base & {labels?: string[]}> = ({labels, dur}) => {
  const t = useT();
  const th = useTheme();
  const rows = [[C.BLUE, 'bolt'], [C.RED, 'music'], [C.GREY, 'chat'], [C.GREEN, 'cam']].map(([c, g], i) => [labels?.[i] ?? tpick(th.words, SET0, i), c, g]);
  return (
    <Center y={960} style={{opacity: fade(t, dur)}}>
      <Glass style={{width: 900, borderRadius: 44, padding: '10px 0', background: '#fff', transform: `scale(${p(t, 0, 0.3, SPRING)})`}}>
        {rows.map(([l, c, g], i) => { const on = i === 2 ? 0 : p(t, 0.3 + i * 0.12, 0.25, SPRING); return <div key={i} style={{display: 'flex', alignItems: 'center', gap: 26, padding: '24px 36px', borderBottom: i < 3 ? `1.5px solid ${C.LINE}` : 'none', opacity: p(t, 0.05 + i * 0.06, 0.2)}}>
          <div style={{width: 64, height: 64, borderRadius: 16, background: c as string, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Glyph g={g as string} c="#fff" s={40} /></div>
          <span style={{flex: 1, ...disp(550, 44, -0.01), color: C.INK}}>{l}</span>
          <div style={{width: 120, height: 72, borderRadius: 36, background: `color-mix(in srgb, ${C.GREEN} ${on * 100}%, #E5E5EA)`, position: 'relative'}}><div style={{position: 'absolute', top: 6, left: lerp(on, 6, 54), width: 60, height: 60, borderRadius: 30, background: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,.2)'}} /></div>
        </div>; })}
      </Glass>
    </Center>
  );
};
// Teilen-Sheet fährt von unten hoch
const SHARE0 = ['Leif', 'Max', 'Lena', 'Team'];
export const ShareSheet: React.FC<Base & {names?: string[]}> = ({names, dur}) => {
  const t = useT();
  const th = useTheme();
  const nm = (i: number) => names?.[i] ?? tpick(th.names, SHARE0, i);
  const k = p(t, 0, 0.4, EXPO);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <AbsoluteFill style={{background: 'rgba(0,0,0,.18)', opacity: k}} />
      <div style={{position: 'absolute', left: 30, right: 30, top: lerp(k, 1920, 820), height: 700, borderRadius: 50, background: '#F2F2F7', padding: 40}}>
        <div style={{width: 90, height: 10, borderRadius: 5, background: '#C7C7CC', margin: '0 auto 30px'}} />
        <div style={{display: 'flex', gap: 24, marginBottom: 40}}>{[0, 1, 2, 3].map((i) => <div key={i} style={{textAlign: 'center', transform: `scale(${p(t, 0.25 + i * 0.06, 0.3, SPRING)})`}}><div style={{width: 160, height: 160, borderRadius: 80, overflow: 'hidden', background: '#ddd'}}>{i === 0 ? <Face size={160} /> : <div style={{width: '100%', height: '100%', background: `linear-gradient(135deg, hsl(${i * 80},60%,70%), hsl(${i * 80 + 40},60%,55%))`}} />}</div><div style={{...disp(500, 26, 0), color: C.INK, marginTop: 10, width: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{nm(i)}</div></div>)}</div>
        <div style={{display: 'flex', gap: 30}}>{[0, 1, 2, 3, 4].map((i) => <div key={i} style={{transform: `scale(${p(t, 0.4 + i * 0.05, 0.3, SPRING)})`}}><AppIcon i={i} size={130} /></div>)}</div>
      </div>
    </AbsoluteFill>
  );
};
// Eingehender Anruf (FaceTime-artig, Leif)
export const IncomingCall: React.FC<Base & {name?: string}> = ({name: nameP, dur}) => {
  const t = useT();
  const th = useTheme();
  const name = nameP ?? tpick(th.names, ['Leif Dunkelmann'], 0);
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      <Center y={760}><div style={{transform: `scale(${p(t, 0, 0.35, SPRING)})`, position: 'relative'}}>{[0, 1].map((r) => { const q = ((t + r * 0.5) % 1); return <div key={r} style={{position: 'absolute', left: 140 - 140 * (1 + q * 0.6), top: 140 - 140 * (1 + q * 0.6), width: 280 * (1 + q * 0.6), height: 280 * (1 + q * 0.6), borderRadius: '50%', border: `4px solid ${C.GREEN}`, opacity: (1 - q) * cl(q * 8)}} />; })}<Face size={280} /></div></Center>
      <Center y={1010}><div style={{...disp(700, name.length > 22 ? Math.round(70 * 22 / name.length) : 70, -0.03), color: C.INK, whiteSpace: 'nowrap'}}>{name}</div></Center>
      <Center y={1090}><div style={{...disp(500, 36, 0), color: C.GREY}}>FaceTime Video …</div></Center>
      <Center y={1330}><div style={{display: 'flex', gap: 200}}><div style={{width: 150, height: 150, borderRadius: 75, background: '#FF3B30'}} /><div style={{width: 150, height: 150, borderRadius: 75, background: C.GREEN, transform: `scale(${1 + Math.sin(t * 10) * 0.07})`}} /></div></Center>
    </AbsoluteFill>
  );
};
// Flacher Homescreen mit Dock, Icons springen rein
export const HomeScreen: React.FC<Base> = ({dur}) => {
  const t = useT();
  return (
    <AbsoluteFill style={{opacity: fade(t, dur)}}>
      {Array.from({length: 20}, (_, i) => { const col = i % 4, row = Math.floor(i / 4); const k = p(t, (col + row) * 0.035, 0.32, SPRING); return <div key={i} style={{position: 'absolute', left: 110 + col * 225, top: 360 + row * 230, transform: `scale(${k})`}}><AppIcon i={i} size={170} /></div>; })}
      <div style={{position: 'absolute', left: 60, right: 60, top: 1560, height: 230, borderRadius: 70, background: 'rgba(255,255,255,.55)', backdropFilter: 'blur(20px)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', transform: `translateY(${lerp(p(t, 0.2, 0.35, EXPO), 300, 0)}px)`}}>{[2, 0, 1, 3].map((i) => <AppIcon key={i} i={i} size={160} />)}</div>
    </AbsoluteFill>
  );
};
export {serif, rnd, EIN};
