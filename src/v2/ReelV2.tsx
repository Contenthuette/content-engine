import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, Easing, Loop} from 'remotion';
import '@fontsource/inter-tight/700.css';
import '@fontsource/inter-tight/800.css';
import '@fontsource/inter-tight/900.css';
import '@fontsource/inter/600.css';
import '@fontsource/caveat/700.css';
import rawWords from '../words.json';
import {C, FONT, HAND, FPS, f, clamp, DarkBG, LightBG, Tilt, Glass, Leif, Cursor, HandNote, Typed, TerminalDevice, useAbs, usePopAt} from './kit';

export const DURATION_S = 35.79;

type Trans = 'zoom' | 'whip' | 'whipL' | 'glitch' | 'punch';
type Beat = {id: string; s: number; e: number; light?: boolean; trans: Trans};

const BEATS: Beat[] = [
  {id: 'hook', s: 0, e: 1.4, trans: 'punch'},
  {id: 'repo', s: 1.4, e: 2.3, trans: 'zoom'},
  {id: 'alert', s: 2.3, e: 3.55, trans: 'glitch'},
  {id: 'apps', s: 3.55, e: 5.36, light: true, trans: 'whip'},
  {id: 'free', s: 5.36, e: 7.6, light: true, trans: 'whipL'},
  {id: 'oss', s: 7.6, e: 8.9, trans: 'zoom'},
  {id: 'stars', s: 8.9, e: 11.22, trans: 'whip'},
  {id: 'install', s: 11.22, e: 13.7, trans: 'zoom'},
  {id: 'map', s: 13.7, e: 15.84, trans: 'whipL'},
  {id: 'agents', s: 15.84, e: 18.1, trans: 'zoom'},
  {id: 'scan', s: 18.1, e: 20.6, trans: 'whip'},
  {id: 'inject', s: 20.6, e: 23.3, trans: 'glitch'},
  {id: 'chat1', s: 23.3, e: 25.4, trans: 'zoom'},
  {id: 'chat2', s: 25.4, e: 27.58, trans: 'punch'},
  {id: 'real', s: 27.58, e: 29.24, light: true, trans: 'whip'},
  {id: 'step3', s: 29.24, e: 31.0, trans: 'zoom'},
  {id: 'report', s: 31.0, e: 33.7, trans: 'whipL'},
  {id: 'cta', s: 33.7, e: DURATION_S, trans: 'punch'},
];

const SFX: {t: number; src: string; v: number}[] = [
  {t: 0.0, src: 'impact', v: 0.8},
  {t: 1.35, src: 'whoosh', v: 0.5},
  {t: 1.9, src: 'click', v: 0.9},
  {t: 2.25, src: 'glitch', v: 0.6},
  {t: 2.4, src: 'alert', v: 0.45},
  {t: 3.5, src: 'whoosh', v: 0.5},
  {t: 5.32, src: 'whoosh', v: 0.5},
  {t: 6.6, src: 'success', v: 0.6},
  {t: 7.56, src: 'whoosh', v: 0.45},
  {t: 7.75, src: 'typing', v: 0.5},
  {t: 8.86, src: 'whoosh', v: 0.5},
  {t: 11.18, src: 'whoosh', v: 0.45},
  {t: 11.6, src: 'typing', v: 0.5},
  {t: 12.4, src: 'typing', v: 0.5},
  {t: 13.05, src: 'success', v: 0.55},
  {t: 13.66, src: 'whoosh', v: 0.5},
  {t: 15.8, src: 'whoosh', v: 0.5},
  {t: 16.6, src: 'impact', v: 0.5},
  {t: 18.06, src: 'whoosh', v: 0.5},
  {t: 18.32, src: 'pop', v: 0.7},
  {t: 18.96, src: 'pop', v: 0.7},
  {t: 19.68, src: 'pop', v: 0.7},
  {t: 20.56, src: 'glitch', v: 0.6},
  {t: 20.98, src: 'alert', v: 0.35},
  {t: 23.26, src: 'whoosh', v: 0.45},
  {t: 23.4, src: 'pop', v: 0.6},
  {t: 24.4, src: 'pop', v: 0.6},
  {t: 26.9, src: 'impact', v: 0.7},
  {t: 27.54, src: 'whoosh', v: 0.5},
  {t: 29.2, src: 'whoosh', v: 0.45},
  {t: 29.4, src: 'typing', v: 0.5},
  {t: 30.96, src: 'whoosh', v: 0.5},
  {t: 32.9, src: 'click', v: 0.9},
  {t: 33.0, src: 'success', v: 0.6},
  {t: 33.66, src: 'whoosh', v: 0.5},
  {t: 34.2, src: 'impact', v: 0.6},
];

// ---------- transition wrapper ----------
const BeatWrap: React.FC<{beat: Beat; children: React.ReactNode}> = ({beat, children}) => {
  const frame = useCurrentFrame();
  const dur = f(beat.e) - f(beat.s);
  const push = interpolate(frame, [0, dur], [1, 1.07]);
  let transform = `scale(${push})`;
  let filter = 'none';
  let overlay: React.ReactNode = null;
  if (beat.trans === 'zoom') {
    const p = interpolate(frame, [0, 7], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
    transform = `scale(${push * interpolate(p, [0, 1], [1.45, 1])})`;
    filter = `blur(${(1 - p) * 22}px)`;
  } else if (beat.trans === 'whip' || beat.trans === 'whipL') {
    const p = interpolate(frame, [0, 6], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
    const dir = beat.trans === 'whip' ? 1 : -1;
    transform = `translateX(${(1 - p) * 1100 * dir}px) scale(${push})`;
    filter = `blur(${(1 - p) * 30}px)`;
  } else if (beat.trans === 'punch') {
    const p = interpolate(frame, [0, 6], [0, 1], {...clamp, easing: Easing.out(Easing.back(2))});
    transform = `scale(${push * interpolate(p, [0, 1], [1.15, 1])})`;
  } else if (beat.trans === 'glitch' && frame < 7) {
    const jitter = (frame % 2 === 0 ? 1 : -1) * (7 - frame) * 9;
    transform = `translateX(${jitter}px) skewX(${jitter / 6}deg) scale(${push})`;
    filter = `hue-rotate(${frame * 40}deg) saturate(2)`;
    overlay = (
      <AbsoluteFill style={{pointerEvents: 'none', zIndex: 100}}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{position: 'absolute', left: 0, right: 0, top: ((i * 397 + frame * 211) % 1800), height: 30 + ((i * 53) % 90), background: i % 2 ? 'rgba(40,224,255,0.35)' : 'rgba(255,59,78,0.4)', mixBlendMode: 'screen', transform: `translateX(${((i * 77 + frame * 131) % 300) - 150}px)`}} />
        ))}
        <AbsoluteFill style={{background: frame < 2 ? 'rgba(255,255,255,0.5)' : 'transparent'}} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill style={{transform, filter}}>{children}</AbsoluteFill>
      {overlay}
    </AbsoluteFill>
  );
};

// ---------- scenes ----------
const Shot: React.FC<{crop: {x: number; y: number; w: number; h: number}; width: number; style?: React.CSSProperties; radius?: number}> = ({crop, width, style, radius = 36}) => {
  const s = width / crop.w;
  return (
    <div style={{width, height: crop.h * s, overflow: 'hidden', borderRadius: radius, position: 'relative', boxShadow: '0 50px 140px rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.15)', ...style}}>
      <Img src={staticFile('assets/github_repo.png')} style={{position: 'absolute', width: 2560 * s, height: 3200 * s, left: -crop.x * s, top: -crop.y * s}} />
    </div>
  );
};

const Hook: React.FC<{s: number}> = ({s}) => (
  <>
    <DarkBG tint={C.orange} tint2={C.blue} />
    <Tilt rx={16} ry={-18} style={{position: 'absolute', left: 60, top: 180}}>
      <div style={{filter: 'blur(1.5px)'}}>
        <Shot crop={{x: 0, y: 0, w: 2560, h: 1500}} width={960} />
      </div>
    </Tilt>
    <HandNote beatStart={s} at={0.25} text="NEU von Cloudflare" x={420} y={90} arrow="M 60 120 C 20 170, -10 210, -60 250" color={C.yellow} size={72} />
    <Leif beatStart={s} clip="f1" height={1000} style={{left: 265, bottom: -80}} glow={C.orange} />
  </>
);

const Repo: React.FC<{s: number}> = ({s}) => {
  const t = useAbs(s);
  const z = interpolate(t, [1.4, 2.3], [1, 1.9], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const starred = t >= 1.92;
  return (
    <>
      <DarkBG tint={C.blue} tint2={C.cyan} grid={false} />
      <div style={{position: 'absolute', left: 0, top: 560, width: 1080, transform: `scale(${z})`, transformOrigin: '93% 18%'}}>
        <Shot crop={{x: 0, y: 150, w: 2560, h: 1500}} width={1080} radius={0} />
        <div style={{position: 'absolute', left: 952, top: 98, width: 104, height: 30, borderRadius: 8, boxShadow: starred ? `0 0 0 3px ${C.yellow}, 0 0 40px ${C.yellow}` : 'none'}} />
      </div>
      <Cursor beatStart={s} path={[[1.45, 520, 1300], [1.85, 990, 680], [2.3, 990, 680]]} clickAt={[1.9]} />
    </>
  );
};

const Alert: React.FC<{s: number}> = ({s}) => {
  const t = useAbs(s);
  const shake = t > 2.36 && t < 2.6 ? Math.sin(t * 120) * 14 : 0;
  const tags = [
    {at: 2.4, l: 'Passwort im Klartext', y: 360},
    {at: 2.75, l: 'API-Key öffentlich', y: 560},
    {at: 3.1, l: 'Login umgehbar', y: 760},
  ];
  return (
    <div style={{position: 'absolute', inset: 0, transform: `translate(${shake}px, ${-shake / 2}px)`}}>
      <DarkBG tint={C.red} tint2="#5B0010" />
      <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 50%, transparent 40%, rgba(255,0,30,0.35) 100%)', opacity: 0.6 + Math.sin(t * 18) * 0.3}} />
      <Tilt rx={12} ry={20} style={{position: 'absolute', left: 140, top: 250}}>
        <Glass style={{width: 560, padding: 50}} glow={C.red}>
          <div style={{width: 80, height: 80, borderRadius: 22, background: `linear-gradient(135deg, ${C.purple}, ${C.blue})`, margin: '0 auto 24px'}} />
          <div style={{textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 42}}>Willkommen zurück</div>
          {['du@email.de', '••••••••••'].map((p) => (
            <div key={p} style={{background: 'rgba(255,255,255,0.1)', borderRadius: 18, padding: '22px 26px', fontSize: 30, color: C.sub, marginTop: 20, fontFamily: FONT}}>
              {p}
            </div>
          ))}
          <div style={{background: C.blue, borderRadius: 18, padding: 22, textAlign: 'center', fontSize: 32, fontWeight: 800, marginTop: 24, fontFamily: FONT}}>Anmelden</div>
        </Glass>
      </Tilt>
      {tags.map((tg) => (
        <AlertTag key={tg.l} s={s} at={tg.at} label={tg.l} y={tg.y} />
      ))}
    </div>
  );
};

const AlertTag: React.FC<{s: number; at: number; label: string; y: number}> = ({s, at, label, y}) => {
  const p = usePopAt(at, s, 9);
  return (
    <div style={{position: 'absolute', left: 470, top: y, transform: `scale(${p}) rotate(${interpolate(p, [0, 1], [-14, -3])}deg)`, transformOrigin: 'left center', opacity: Math.min(1, p * 2), zIndex: 10}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 16, background: C.red, color: '#fff', fontFamily: FONT, fontWeight: 900, fontSize: 40, padding: '20px 34px', borderRadius: 999, boxShadow: `0 0 60px ${C.red}, 0 20px 40px rgba(0,0,0,0.5)`}}>
        <span style={{width: 44, height: 44, borderRadius: 22, background: '#fff', color: C.red, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 30}}>!</span>
        {label}
      </div>
    </div>
  );
};

const AppCard: React.FC<{x: number; y: number; ry: number; hue: string; title: string; s: number; at: number; ph: number}> = ({x, y, ry, hue, title, s, at, ph}) => {
  const frame = useCurrentFrame();
  const p = usePopAt(at, s, 12);
  const bob = Math.sin(frame / 14 + ph) * 14;
  return (
    <Tilt rx={8} ry={ry} style={{position: 'absolute', left: x, top: y + bob, transform: `scale(${p})`}}>
      <div style={{width: 300, background: '#fff', borderRadius: 34, padding: 26, boxShadow: '0 40px 80px rgba(0,0,0,0.18)'}}>
        <div style={{height: 120, borderRadius: 20, background: `linear-gradient(135deg, ${hue}, ${hue}88)`}} />
        <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 30, marginTop: 18, color: '#111'}}>{title}</div>
        <div style={{height: 12, width: '70%', background: '#E6E7EC', borderRadius: 6, marginTop: 12}} />
        <div style={{position: 'absolute', right: -18, top: -18, width: 64, height: 64, borderRadius: 32, background: C.red, color: '#fff', fontWeight: 900, fontSize: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, boxShadow: `0 0 30px ${C.red}`}}>!</div>
      </div>
    </Tilt>
  );
};

const Apps: React.FC<{s: number}> = ({s}) => (
  <>
    <LightBG />
    <AppCard s={s} at={3.6} x={40} y={260} ry={24} hue={C.purple} title="SaaS-Dashboard" ph={0} />
    <AppCard s={s} at={3.75} x={740} y={420} ry={-24} hue={C.blue} title="Buchungs-App" ph={2} />
    <AppCard s={s} at={3.9} x={60} y={760} ry={20} hue={C.orange} title="Shop" ph={4} />
    <Leif beatStart={s} clip="f1" height={1000} style={{left: 265, bottom: -80}} />
    <HandNote beatStart={s} at={4.0} text="deine App?" x={640} y={980} arrow="M 40 -10 C 10 -70, -40 -110, -110 -130" color={C.red} size={80} rot={-4} />
  </>
);

const Free: React.FC<{s: number}> = ({s}) => {
  const t = useAbs(s);
  const p = usePopAt(6.55, s, 8);
  const strike = interpolate(t, [6.35, 6.55], [0, 1], clamp);
  return (
    <>
      <LightBG />
      <Leif beatStart={s} clip="f1" height={1000} style={{left: 0, bottom: -80}} />
      <Tilt rx={6} ry={-18} style={{position: 'absolute', left: 450, top: 300}}>
        <div style={{width: 480, background: '#0B0C10', borderRadius: 40, padding: 44, boxShadow: '0 50px 120px rgba(0,0,0,0.35)'}}>
          <div style={{fontFamily: FONT, color: 'rgba(255,255,255,0.6)', fontSize: 30, fontWeight: 700}}>Security-Audit</div>
          <div style={{position: 'relative', fontFamily: FONT, color: 'rgba(255,255,255,0.45)', fontSize: 72, fontWeight: 900, marginTop: 12, display: 'inline-block'}}>
            499 €
            <div style={{position: 'absolute', left: -10, top: '52%', height: 8, width: `${strike * 110}%`, background: C.red, borderRadius: 4, transform: 'rotate(-8deg)'}} />
          </div>
          <div style={{fontFamily: FONT, fontSize: 150, fontWeight: 900, letterSpacing: -6, lineHeight: 1, marginTop: 10, transform: `scale(${p})`, transformOrigin: 'left center', background: `linear-gradient(135deg, ${C.green}, #B8FFDA)`, WebkitBackgroundClip: 'text', color: 'transparent', filter: `drop-shadow(0 0 30px ${C.green}88)`}}>
            0 €
          </div>
        </div>
      </Tilt>
    </>
  );
};

const Screen: React.FC<{children: React.ReactNode}> = ({children}) => <div style={{fontFamily: FONT, color: '#fff', textAlign: 'center', width: '100%'}}>{children}</div>;

const Oss: React.FC<{s: number}> = ({s}) => (
  <>
    <DarkBG tint={C.blue} tint2={C.cyan} />
    <TerminalDevice width={2000} style={{left: -460, top: 380}}>
      <Screen>
        <div style={{fontSize: 34, color: C.cyan, fontWeight: 700, letterSpacing: 4}}>CLOUDFLARE</div>
        <Typed beatStart={s} from={7.7} to={8.3} text="Open Source" style={{fontSize: 92, fontWeight: 900}} />
        <div style={{fontSize: 40, color: C.green, fontWeight: 800, marginTop: 10, opacity: interpolate(useAbs(s), [8.35, 8.5], [0, 1], clamp)}}>✓ MIT-Lizenz · kostenlos</div>
      </Screen>
    </TerminalDevice>
  </>
);

const Stars: React.FC<{s: number}> = ({s}) => {
  const t = useAbs(s);
  const p = interpolate(t, [9.0, 10.3], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const val = Math.round(28100 * p);
  const W = 860;
  const H = 700;
  const pts = Array.from({length: 60}, (_, i) => {
    const x = i / 59;
    const y = Math.pow(x, 2.6);
    return [x * W, H - y * H];
  });
  const shown = pts.slice(0, Math.max(2, Math.ceil(p * 60)));
  const d = shown.map((q, i) => `${i ? 'L' : 'M'} ${q[0]} ${q[1]}`).join(' ');
  const last = shown[shown.length - 1];
  return (
    <>
      <DarkBG tint="#0A4D2E" tint2={C.blue} />
      <Tilt rx={10} ry={-12} style={{position: 'absolute', left: 110, top: 360}}>
        <div style={{position: 'relative', width: W, height: H}}>
          <svg width={W + 40} height={H + 40} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
            <path d={`M 0 0 L 0 ${H} L ${W} ${H}`} stroke="rgba(255,255,255,0.7)" strokeWidth="4" fill="none" />
            <path d={d} stroke={C.green} strokeWidth="12" fill="none" strokeLinecap="round" style={{filter: `drop-shadow(0 0 18px ${C.green}) drop-shadow(0 0 40px ${C.green})`}} />
            <circle cx={last[0]} cy={last[1]} r="16" fill="#fff" style={{filter: `drop-shadow(0 0 20px ${C.green})`}} />
          </svg>
          <div style={{position: 'absolute', left: 30, top: -10, fontFamily: FONT, color: '#fff'}}>
            <div style={{fontSize: 34, color: C.sub, fontWeight: 700}}>GitHub-Sterne</div>
            <div style={{fontSize: 150, fontWeight: 900, letterSpacing: -6, fontVariantNumeric: 'tabular-nums', lineHeight: 1}}>{val.toLocaleString('de-DE')}</div>
          </div>
        </div>
      </Tilt>
      <Cursor beatStart={s} path={[[9.0, 140, 1080], [10.3, 110 + last[0] * 0.95, 360 + last[1] * 0.95 + 20], [11.2, 110 + last[0] * 0.95, 360 + last[1] * 0.95 + 20]]} />
    </>
  );
};

const Install: React.FC<{s: number}> = ({s}) => {
  const t = useAbs(s);
  const phase2 = t >= 12.3;
  return (
    <>
      <DarkBG tint={C.purple} tint2={C.blue} />
      <TerminalDevice width={2000} style={{left: -460, top: 380}}>
        {!phase2 ? (
          <Screen>
            <div style={{fontSize: 36, color: C.cyan, fontWeight: 700, letterSpacing: 4}}>SCHRITT 1</div>
            <Typed beatStart={s} from={11.5} to={12.1} text="Installieren" style={{fontSize: 96, fontWeight: 900}} />
          </Screen>
        ) : (
          <div style={{fontFamily: 'Menlo, monospace', color: '#E6FFE9', fontSize: 30, padding: 30, width: '100%', lineHeight: 1.5}}>
            <span style={{color: C.green}}>➜</span> <Typed beatStart={s} from={12.35} to={12.95} text="npx skills add cloudflare/security-audit-skill" />
            <div style={{color: C.green, fontWeight: 700, opacity: t >= 13.05 ? 1 : 0}}>✓ installiert in Claude Code</div>
          </div>
        )}
      </TerminalDevice>
      <HandNote beatStart={s} at={12.5} text="nur 1 Befehl!" x={110} y={1170} arrow="M 380 10 C 430 -40, 470 -90, 500 -170" color={C.yellow} size={88} />
    </>
  );
};

const MapScene: React.FC<{s: number}> = ({s}) => {
  const t = useAbs(s);
  const nodes = [
    {l: 'Login', x: 380, y: 60, c: C.blue},
    {l: 'API', x: 80, y: 280, c: C.cyan},
    {l: 'Datenbank', x: 620, y: 300, c: C.purple},
    {l: 'Admin', x: 120, y: 560, c: C.orange},
    {l: 'Zahlungen', x: 540, y: 600, c: C.green},
  ];
  const edges = [[0, 1], [0, 2], [1, 3], [2, 4], [1, 2], [3, 4]];
  return (
    <>
      <DarkBG tint={C.blue} tint2={C.cyan} />
      <Tilt rx={30} ry={-14} style={{position: 'absolute', left: 60, top: 140}}>
        <div style={{position: 'relative', width: 960, height: 800}}>
          <svg width="960" height="800" style={{position: 'absolute', overflow: 'visible'}}>
            {edges.map(([a, b], i) => {
              const p = interpolate(t, [13.9 + i * 0.18, 14.3 + i * 0.18], [0, 1], clamp);
              const A = nodes[a];
              const B = nodes[b];
              return <line key={i} x1={A.x + 110} y1={A.y + 45} x2={A.x + 110 + (B.x - A.x) * p} y2={A.y + 45 + (B.y - A.y) * p} stroke={C.cyan} strokeWidth="5" style={{filter: `drop-shadow(0 0 10px ${C.cyan})`}} />;
            })}
          </svg>
          {nodes.map((n, i) => {
            const p = interpolate(t, [13.75 + i * 0.12, 14.0 + i * 0.12], [0, 1], clamp);
            return (
              <Glass key={n.l} style={{position: 'absolute', left: n.x, top: n.y, padding: '20px 34px', borderRadius: 999, transform: `scale(${p})`, fontFamily: FONT, fontWeight: 800, fontSize: 38, display: 'flex', gap: 14, alignItems: 'center'}} glow={n.c}>
                <span style={{width: 22, height: 22, borderRadius: 11, background: n.c, boxShadow: `0 0 20px ${n.c}`}} />
                {n.l}
              </Glass>
            );
          })}
        </div>
      </Tilt>
      <Leif beatStart={s} clip="f2" height={780} style={{left: 600, bottom: -60}} glow={C.blue} />
    </>
  );
};

const Bot: React.FC<{color: string; size?: number}> = ({color, size = 200}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{filter: `drop-shadow(0 0 24px ${color}) drop-shadow(0 0 60px ${color}88)`}}>
    <rect x="12" y="24" width="76" height="60" rx="22" fill={color} />
    <rect x="46" y="8" width="8" height="18" rx="4" fill={color} />
    <circle cx="50" cy="9" r="7" fill="#fff" />
    <rect x="26" y="42" width="48" height="20" rx="10" fill="#0B0C10" />
    <circle cx="38" cy="52" r="5" fill="#fff" />
    <circle cx="62" cy="52" r="5" fill="#fff" />
  </svg>
);

const Agents: React.FC<{s: number}> = ({s}) => {
  const t = useAbs(s);
  const frame = useCurrentFrame();
  const bots = [
    {c: C.cyan, x: 120, d: 0},
    {c: C.purple, x: 430, d: 0.12},
    {c: C.orange, x: 740, d: 0.24},
  ];
  return (
    <>
      <DarkBG tint={C.purple} tint2={C.cyan} />
      {bots.map((b, i) => {
        const p = interpolate(t, [16.45 + b.d, 17.0 + b.d], [0, 1], {...clamp, easing: Easing.out(Easing.back(1.6))});
        const bob = Math.sin(frame / 8 + i) * 14;
        return (
          <div key={i} style={{position: 'absolute', left: b.x, top: interpolate(p, [0, 1], [1100, 560]) + bob, transform: `scale(${interpolate(p, [0, 1], [0.2, 1])})`, opacity: p}}>
            <div style={{position: 'absolute', left: 70, top: 160, width: 60, height: 500 * (1 - p) + 120, background: `linear-gradient(${b.c}, transparent)`, filter: 'blur(16px)', opacity: 0.8}} />
            <Bot color={b.c} />
          </div>
        );
      })}
      <div style={{position: 'absolute', top: 300, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 64, color: '#fff', letterSpacing: -1, opacity: interpolate(t, [16.9, 17.2], [0, 1], clamp)}}>
        Team aus <span style={{background: `linear-gradient(90deg, ${C.cyan}, ${C.purple}, ${C.orange})`, WebkitBackgroundClip: 'text', color: 'transparent'}}>KI-Agenten</span>
      </div>
    </>
  );
};

const Scan: React.FC<{s: number}> = ({s}) => {
  const t = useAbs(s);
  const rows = [
    {l: 'Logins', at: 18.32, c: C.cyan, f: '2 Funde'},
    {l: 'Datenbank', at: 18.96, c: C.purple, f: '1 Fund'},
    {l: 'APIs', at: 19.68, c: C.orange, f: '3 Funde'},
  ];
  return (
    <>
      <DarkBG tint={C.cyan} tint2={C.purple} />
      <Tilt rx={22} ry={-6} style={{position: 'absolute', left: 70, top: 330, transform: 'scale(0.9)'}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 40}}>
          {rows.map((r, i) => {
            const on = t >= r.at;
            const sc = interpolate(t, [r.at, r.at + 0.6], [0, 1], clamp);
            const blur = on ? 0 : 3;
            return (
              <Glass key={r.l} style={{width: 900, padding: '44px 50px', display: 'flex', alignItems: 'center', gap: 34, filter: `blur(${blur}px)`, border: on ? `3px solid ${r.c}` : '2px solid rgba(255,255,255,0.15)', transform: `translateZ(${on ? 60 : 0}px)`}} glow={on ? r.c : undefined}>
                <div style={{width: 90, height: 90, borderRadius: 26, background: `${r.c}33`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <div style={{width: 40, height: 40, borderRadius: 12, background: r.c, boxShadow: `0 0 24px ${r.c}`}} />
                </div>
                <div style={{flex: 1}}>
                  <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 56}}>{r.l}</div>
                  <div style={{height: 12, background: 'rgba(255,255,255,0.12)', borderRadius: 6, marginTop: 16, overflow: 'hidden'}}>
                    <div style={{width: `${sc * 100}%`, height: '100%', background: r.c, boxShadow: `0 0 20px ${r.c}`}} />
                  </div>
                </div>
                <div style={{width: 220, textAlign: 'right', fontFamily: FONT, fontWeight: 900, fontSize: 34, color: C.red, opacity: sc >= 1 ? 1 : 0}}>{r.f}</div>
              </Glass>
            );
          })}
        </div>
      </Tilt>
    </>
  );
};

const Inject: React.FC<{s: number}> = ({s}) => {
  const frame = useCurrentFrame();
  const t = useAbs(s);
  const g = (frame % 9 < 2 ? 1 : 0) * 14;
  const show = interpolate(t, [20.95, 21.15], [0, 1], clamp);
  const txt = (color: string, dx: number) => (
    <div style={{position: 'absolute', top: 260, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 170, lineHeight: 0.9, letterSpacing: -6, color, transform: `translateX(${dx}px)`, mixBlendMode: 'screen', opacity: show}}>
      PROMPT<br />INJECTION
    </div>
  );
  return (
    <>
      <DarkBG tint={C.red} tint2="#300008" grid={false} />
      {txt('#FF2A3A', -6 - g)}
      {txt('#2AF0FF', 6 + g)}
      {txt('#FFFFFF', 0)}
      <Leif beatStart={s} clip="f3" height={1000} style={{left: 265, bottom: -80}} glow={C.red} />
    </>
  );
};

const Bubble: React.FC<{s: number; at: number; who: string; text: string; right?: boolean; color: string}> = ({s, at, who, text, right, color}) => {
  const p = usePopAt(at, s, 12);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: right ? 'flex-end' : 'flex-start', transform: `scale(${p})`, transformOrigin: right ? 'right bottom' : 'left bottom', opacity: p}}>
      <div style={{fontFamily: FONT, fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.65)', margin: '0 20px 10px'}}>{who}</div>
      <div style={{maxWidth: 720, padding: '30px 40px', borderRadius: 46, fontFamily: FONT, fontWeight: 700, fontSize: 42, lineHeight: 1.2, color: '#fff', background: right ? color : 'rgba(255,255,255,0.14)', boxShadow: right ? `0 0 50px ${color}66` : 'none'}}>{text}</div>
    </div>
  );
};

const ChatBase: React.FC<{s: number; second?: boolean}> = ({s, second}) => {
  const t = useAbs(s);
  const frame = useCurrentFrame();
  const stamp = usePopAt(26.9, s, 8);
  return (
    <>
      <DarkBG tint="#0B5A35" tint2="#063322" grid={false} />
      <Tilt rx={18} ry={second ? 16 : -16} style={{position: 'absolute', left: 60, top: second ? 200 : 260}}>
        <div style={{width: 960, display: 'flex', flexDirection: 'column', gap: 40, filter: 'none'}}>
          <Bubble s={s} at={second ? s - 1 : 23.4} who="Agent 1 · Finder" text="Lücke gefunden: Passwort wird im Klartext gespeichert." color={C.green} />
          <Bubble s={s} at={second ? s - 1 : 24.4} who="Agent 2 · Skeptiker" text="Glaub ich nicht. Ich versuche, das zu widerlegen …" right color="#1FA35A" />
          {second ? (
            t < 26.5 ? (
              <div style={{alignSelf: 'flex-end', background: 'rgba(255,255,255,0.14)', borderRadius: 40, padding: '26px 36px', display: 'flex', gap: 12}}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{width: 20, height: 20, borderRadius: 10, background: '#fff', opacity: 0.4 + 0.6 * Math.abs(Math.sin(frame / 6 + i))}} />
                ))}
              </div>
            ) : (
              <Bubble s={s} at={26.5} who="Agent 2 · Skeptiker" text="Widerlegen gescheitert. Die Lücke ist echt." right color="#1FA35A" />
            )
          ) : null}
        </div>
      </Tilt>
      {second ? (
        <>
          <HandNote beatStart={s} at={25.6} text="Skeptiker-Agent" x={520} y={120} arrow="M 160 90 C 180 150, 200 200, 210 250" color={C.yellow} size={74} />
          <div style={{position: 'absolute', top: 1050, width: '100%', display: 'flex', justifyContent: 'center', transform: `scale(${interpolate(stamp, [0, 1], [2.4, 1])}) rotate(-7deg)`, opacity: stamp}}>
            <div style={{border: `10px solid ${C.green}`, color: C.green, fontFamily: FONT, fontWeight: 900, fontSize: 92, padding: '16px 48px', borderRadius: 30, background: 'rgba(0,0,0,0.6)', boxShadow: `0 0 60px ${C.green}`, letterSpacing: 2}}>✓ BESTÄTIGT</div>
          </div>
        </>
      ) : null}
    </>
  );
};

const Real: React.FC<{s: number}> = ({s}) => {
  const p = usePopAt(27.62, s, 10);
  return (
    <>
      <LightBG />
      <div style={{position: 'absolute', top: 210, width: '100%', textAlign: 'center', transform: `scale(${p})`}}>
        <div style={{fontFamily: FONT, fontWeight: 900, fontSize: 132, letterSpacing: -5, lineHeight: 0.95, background: `linear-gradient(90deg, ${C.green}, ${C.cyan}, ${C.blue}, ${C.purple})`, WebkitBackgroundClip: 'text', color: 'transparent'}}>
          „Nur echte
          <br />
          Lücken"
        </div>
      </div>
      <Leif beatStart={s} clip="f3" height={1000} style={{left: 265, bottom: -80}} />
    </>
  );
};

const Step3: React.FC<{s: number}> = ({s}) => (
  <>
    <DarkBG tint={C.orange} tint2={C.purple} />
    <TerminalDevice width={2000} style={{left: -460, top: 380}}>
      <Screen>
        <div style={{fontSize: 36, color: C.orange, fontWeight: 700, letterSpacing: 4}}>AM ENDE</div>
        <Typed beatStart={s} from={29.4} to={29.95} text="Der Report" style={{fontSize: 100, fontWeight: 900}} />
      </Screen>
    </TerminalDevice>
  </>
);

const Report: React.FC<{s: number}> = ({s}) => {
  const t = useAbs(s);
  const rows = [
    {sev: 'Kritisch', c: C.red, l: 'Passwort im Klartext', at: 31.1},
    {sev: 'Hoch', c: C.orange, l: 'Admin-Route offen', at: 31.4},
    {sev: 'Mittel', c: C.yellow, l: 'Kein Login-Limit', at: 31.7},
  ];
  const fix = interpolate(t, [32.2, 32.6], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const applied = t >= 32.95;
  return (
    <>
      <DarkBG tint={C.blue} tint2={C.green} />
      <Tilt rx={12} ry={14} style={{position: 'absolute', left: 70, top: 220}}>
        <Glass style={{width: 940, padding: 50}} glow={C.green}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: FONT}}>
            <div style={{fontSize: 56, fontWeight: 900}}>Security-Report</div>
            <div style={{fontSize: 30, fontWeight: 800, color: C.green, background: `${C.green}22`, padding: '10px 22px', borderRadius: 999}}>3 bestätigt</div>
          </div>
          {rows.map((r) => {
            const p = interpolate(t, [r.at, r.at + 0.25], [0, 1], clamp);
            return (
              <div key={r.l} style={{display: 'flex', alignItems: 'center', gap: 22, marginTop: 28, opacity: p, transform: `translateX(${(1 - p) * 60}px)`, fontFamily: FONT}}>
                <span style={{fontSize: 28, fontWeight: 800, color: r.c, background: `${r.c}22`, padding: '8px 18px', borderRadius: 999}}>{r.sev}</span>
                <span style={{flex: 1, fontSize: 40, fontWeight: 800}}>{r.l}</span>
                <span style={{width: 52, height: 52, borderRadius: 26, background: C.green, color: '#04210F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 32, boxShadow: `0 0 20px ${C.green}`}}>✓</span>
              </div>
            );
          })}
          <div style={{height: fix * 300, overflow: 'hidden', marginTop: 30}}>
            <div style={{background: '#0B0C10', borderRadius: 26, padding: '28px 32px', fontFamily: 'Menlo, monospace', fontSize: 30, lineHeight: 1.7}}>
              <div style={{color: '#8E8E93'}}>// So fixt du es:</div>
              <div style={{color: '#FF7A85', background: 'rgba(255,59,78,0.15)', borderRadius: 8, padding: '0 10px'}}>- user.pw = req.body.pw</div>
              <div style={{color: '#7DFFB0', background: 'rgba(61,255,143,0.15)', borderRadius: 8, padding: '0 10px'}}>+ user.pw = await hash(req.body.pw)</div>
            </div>
            <div style={{marginTop: 22, display: 'inline-block', background: applied ? C.green : '#fff', color: applied ? '#04210F' : '#000', fontFamily: FONT, fontWeight: 900, fontSize: 34, padding: '18px 34px', borderRadius: 999, boxShadow: applied ? `0 0 40px ${C.green}` : 'none'}}>
              {applied ? '✓ Fix angewendet' : 'Fix anwenden'}
            </div>
          </div>
        </Glass>
      </Tilt>
      <Cursor beatStart={s} path={[[32.4, 900, 1400], [32.85, 330, 880], [33.7, 330, 880]]} clickAt={[32.9]} />
    </>
  );
};

const Cta: React.FC<{s: number}> = ({s}) => {
  const frame = useCurrentFrame();
  const p = usePopAt(34.15, s, 9);
  const sweep = ((frame * 22) % 1400) - 300;
  return (
    <>
      <DarkBG tint={C.blue} tint2={C.purple} />
      <Leif beatStart={s} clip="f4" height={1000} style={{left: 265, bottom: -80}} glow={C.purple} />
      <div style={{position: 'absolute', top: 230, width: '100%', display: 'flex', justifyContent: 'center'}}>
        <Tilt rx={14} ry={-10}>
          <div style={{position: 'relative', overflow: 'hidden', transform: `scale(${p})`, padding: '40px 110px', borderRadius: 999, background: `linear-gradient(135deg, ${C.blue}, ${C.purple}, ${C.pink})`, fontFamily: FONT, fontWeight: 900, fontSize: 150, color: '#fff', letterSpacing: 4, boxShadow: `0 0 90px ${C.purple}, 0 30px 60px rgba(0,0,0,0.5)`}}>
            AUDIT
            <div style={{position: 'absolute', top: 0, bottom: 0, left: sweep, width: 120, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)', transform: 'skewX(-20deg)'}} />
          </div>
        </Tilt>
      </div>
      <HandNote beatStart={s} at={33.85} text="kommentiere" x={120} y={90} arrow="M 380 80 C 430 100, 470 120, 500 150" color={C.yellow} size={84} rot={-8} />
    </>
  );
};

const SCENES: Record<string, React.FC<{s: number}>> = {
  hook: Hook,
  repo: Repo,
  alert: Alert,
  apps: Apps,
  free: Free,
  oss: Oss,
  stars: Stars,
  install: Install,
  map: MapScene,
  agents: Agents,
  scan: Scan,
  inject: Inject,
  chat1: (p) => <ChatBase s={p.s} />,
  chat2: (p) => <ChatBase s={p.s} second />,
  real: Real,
  step3: Step3,
  report: Report,
  cta: Cta,
};

// ---------- captions: one word at a time ----------
type W = {w: string; s: number; e: number};
const FIX: Record<string, string> = {'fixst.': 'fixt.', 'Job?': 'Job:', Ihn: 'ihn', 'Mit': 'mit', komplett: 'KOMPLETT', echte: 'ECHTE'};
const WORDS: W[] = (() => {
  const out: W[] = [];
  for (const x of rawWords as W[]) {
    if ((x.w.startsWith('-') || x.w.startsWith('.')) && out.length) {
      out[out.length - 1].w += x.w;
      out[out.length - 1].e = x.e;
    } else out.push({...x});
  }
  return out.map((x) => ({...x, w: (FIX[x.w] ?? x.w).replace(/[,.:?!–]+$/, '')}));
})();
const HL: [RegExp, string][] = [
  [/KOMPLETT|kostenlos|ECHTE/, C.green],
  [/Sicherheitslücken|Prompt|Injection|Lücke|Lücken/, C.red],
  [/25\.000|Claude|Code/, C.orange],
  [/KI-Agenten|KI-Skill|Agenten/, C.purple],
  [/AUDIT|Report|GitHub/, C.cyan],
];

const CAP_Y: Record<string, number> = {hook: 850, apps: 850, free: 850, inject: 850, real: 850, cta: 850, map: 960};
const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const i = WORDS.findIndex((w, k) => t >= w.s && t < (WORDS[k + 1]?.s ?? DURATION_S));
  if (i < 0) return null;
  const w = WORDS[i];
  const beat = BEATS.find((b) => t >= b.s && t < b.e);
  const light = beat?.light;
  const local = frame - f(w.s);
  const sc = interpolate(local, [0, 4], [1.25, 1], {...clamp, easing: Easing.out(Easing.back(2))});
  const col = HL.find(([r]) => r.test(w.w))?.[1];
  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 200}}>
      <div style={{position: 'absolute', top: CAP_Y[beat?.id ?? ''] ?? 1390, width: '100%', textAlign: 'center', transform: `scale(${sc})`}}>
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: Math.min(118, Math.floor(1900 / Math.max(6, w.w.length))),
            letterSpacing: -2,
            color: col ?? (light ? '#0B0C10' : '#FFFFFF'),
            textShadow: light ? 'none' : '0 6px 30px rgba(0,0,0,0.75), 0 2px 6px rgba(0,0,0,0.6)',
            filter: col && !light ? `drop-shadow(0 0 20px ${col}88)` : 'none',
          }}
        >
          {w.w}
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const ReelV2: React.FC = () => (
  <AbsoluteFill style={{background: C.ink}}>
    {BEATS.map((b) => {
      const S = SCENES[b.id];
      return (
        <Sequence key={b.id} from={f(b.s)} durationInFrames={f(b.e) - f(b.s)} layout="none">
          <BeatWrap beat={b}>
            <S s={b.s} />
          </BeatWrap>
        </Sequence>
      );
    })}
    <Captions />
    <Audio src={staticFile('vo.wav')} />
    <Loop durationInFrames={f(15)}>
      <Audio src={staticFile('sfx/music.mp3')} volume={0.1} />
    </Loop>
    {SFX.map((x, i) => (
      <Sequence key={i} from={Math.max(0, f(x.t))} durationInFrames={f(2)} layout="none">
        <Audio src={staticFile(`sfx/${x.src}.mp3`)} volume={x.v} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
