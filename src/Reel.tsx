import React from 'react';
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import rawWords from './words.json';

const fontFamily = 'Inter, sans-serif';

export const FPS = 30;
export const DURATION_S = 35.79;

// ---------- Design tokens (iOS / Apple) ----------
const C = {
  bg: '#FFFFFF',
  grouped: '#F2F2F7',
  text: '#000000',
  sub: '#8E8E93',
  sep: '#E5E5EA',
  blue: '#0A84FF',
  green: '#30D158',
  red: '#FF453A',
  orange: '#FF9F0A',
  yellow: '#FFD60A',
  purple: '#BF5AF2',
  term: '#1C1C1E',
};
const shadow = '0 30px 80px rgba(0,0,0,0.12), 0 6px 18px rgba(0,0,0,0.06)';

type Layout = 'A' | 'B' | 'C';
type Scene = {id: string; layout: Layout; s: number; e: number};

const SCENES: Scene[] = [
  {id: 'hook', layout: 'A', s: 0, e: 5.36},
  {id: 'free', layout: 'B', s: 5.36, e: 7.58},
  {id: 'github', layout: 'C', s: 7.58, e: 11.22},
  {id: 'terminal', layout: 'C', s: 11.22, e: 13.7},
  {id: 'map', layout: 'B', s: 13.7, e: 15.84},
  {id: 'agents', layout: 'C', s: 15.84, e: 20.6},
  {id: 'inject', layout: 'B', s: 20.6, e: 23.3},
  {id: 'chat', layout: 'A', s: 23.3, e: 27.58},
  {id: 'real', layout: 'B', s: 27.58, e: 29.24},
  {id: 'report', layout: 'C', s: 29.24, e: 33.7},
  {id: 'cta', layout: 'B', s: 33.7, e: DURATION_S},
];

const FACE_CLIPS = [
  {file: 'face/f1.mp4', s: 0.0, e: 7.6},
  {file: 'face/f2.mp4', s: 13.6, e: 15.85},
  {file: 'face/f3.mp4', s: 20.5, e: 29.25},
  {file: 'face/f4.mp4', s: 33.6, e: 35.82},
];

const f = (sec: number) => Math.round(sec * FPS);
const sceneAt = (t: number) => SCENES.find((s) => t >= s.s && t < s.e) ?? SCENES[SCENES.length - 1];

// ---------- helpers ----------
const usePop = (atSec: number, sceneStart = 0, damping = 14) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - f(atSec - sceneStart), fps, config: {damping, mass: 0.6}});
};

const Pill: React.FC<{color: string; children: React.ReactNode; size?: number; solid?: boolean}> = ({
  color,
  children,
  size = 30,
  solid = false,
}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      padding: `${size * 0.32}px ${size * 0.7}px`,
      borderRadius: 999,
      fontSize: size,
      fontWeight: 700,
      color: solid ? '#fff' : color,
      background: solid ? color : `${color}1F`,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);

const Card: React.FC<{style?: React.CSSProperties; children: React.ReactNode}> = ({style, children}) => (
  <div style={{background: '#fff', borderRadius: 48, boxShadow: shadow, ...style}}>{children}</div>
);

// ---------- Face ----------
const FaceLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const sc = sceneAt(t);
  if (sc.layout === 'C') return null;
  const clip = FACE_CLIPS.find((c) => t >= c.s && t < c.e);
  if (!clip) return null;
  const local = t - sc.s;
  const zoom = 1 + Math.min(local, 4) * 0.012;
  const isCard = sc.layout === 'A';
  const cardTop = 1000;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: isCard ? 0 : 0,
          top: isCard ? cardTop : 0,
          width: 1080,
          height: isCard ? 1920 - cardTop : 1920,
          overflow: 'hidden',
          borderTopLeftRadius: isCard ? 64 : 0,
          borderTopRightRadius: isCard ? 64 : 0,
          boxShadow: isCard ? '0 -20px 60px rgba(0,0,0,0.10)' : 'none',
        }}
      >
        <Sequence from={f(clip.s)} layout="none">
          <OffthreadVideo
            src={staticFile(clip.file)}
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: isCard ? 'center 18%' : 'center 40%',
              transform: `scale(${zoom})`,
              filter: 'saturate(0.93) contrast(1.03)',
            }}
          />
        </Sequence>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Scenes (graphics) ----------
const Grouped: React.FC<{children: React.ReactNode; light?: boolean}> = ({children, light}) => (
  <AbsoluteFill style={{background: light ? C.grouped : C.bg}}>{children}</AbsoluteFill>
);

const HookScene: React.FC<{s: number}> = ({s}) => {
  const banner = usePop(0.25, s, 16);
  const card = usePop(0.1, s, 18);
  const tags = [
    {t: 2.35, label: 'Passwort im Klartext', y: 330},
    {t: 2.9, label: 'API-Key öffentlich', y: 470},
    {t: 3.45, label: 'Login umgehbar', y: 610},
  ];
  return (
    <Grouped light>
      {/* notification banner */}
      <div
        style={{
          position: 'absolute',
          top: interpolate(banner, [0, 1], [-200, 70]),
          left: 60,
          right: 60,
          background: 'rgba(255,255,255,0.92)',
          borderRadius: 40,
          boxShadow: shadow,
          padding: '28px 32px',
          display: 'flex',
          gap: 26,
          alignItems: 'center',
          zIndex: 5,
        }}
      >
        <div
          style={{
            width: 86,
            height: 86,
            borderRadius: 22,
            background: `linear-gradient(135deg, ${C.orange}, ${C.red})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 50,
            fontWeight: 900,
          }}
        >
          !
        </div>
        <div style={{flex: 1}}>
          <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 30, color: C.sub, fontWeight: 600}}>
            <span>SECURITY AUDIT</span>
            <span>jetzt</span>
          </div>
          <div style={{fontSize: 38, fontWeight: 800, marginTop: 4}}>3 Sicherheitslücken gefunden</div>
          <div style={{fontSize: 32, color: C.sub, fontWeight: 500}}>in deiner vibe-gecodeten App</div>
        </div>
      </div>
      {/* app login card */}
      <Card
        style={{
          position: 'absolute',
          left: 170,
          top: 290,
          width: 560,
          padding: 44,
          transform: `scale(${interpolate(card, [0, 1], [0.92, 1])})`,
          opacity: card,
        }}
      >
        <div style={{width: 74, height: 74, borderRadius: 20, background: C.purple, margin: '0 auto 22px'}} />
        <div style={{textAlign: 'center', fontSize: 40, fontWeight: 800}}>Willkommen zurück</div>
        <div style={{textAlign: 'center', fontSize: 26, color: C.sub, marginBottom: 28}}>Melde dich an</div>
        {['du@email.de', '••••••••••'].map((p) => (
          <div
            key={p}
            style={{background: C.grouped, borderRadius: 18, padding: '20px 24px', fontSize: 28, color: C.sub, marginBottom: 16}}
          >
            {p}
          </div>
        ))}
        <div style={{background: C.blue, color: '#fff', borderRadius: 18, padding: 20, textAlign: 'center', fontSize: 30, fontWeight: 700}}>
          Anmelden
        </div>
      </Card>
      {tags.map((tg) => (
        <Tag key={tg.label} at={tg.t} s={s} y={tg.y} label={tg.label} />
      ))}
    </Grouped>
  );
};

const Tag: React.FC<{at: number; s: number; y: number; label: string}> = ({at, s, y, label}) => {
  const p = usePop(at, s, 12);
  return (
    <div
      style={{
        position: 'absolute',
        left: 600,
        top: y,
        transform: `scale(${p}) rotate(${interpolate(p, [0, 1], [-8, -2])}deg)`,
        transformOrigin: 'left center',
        opacity: p,
        zIndex: 6,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          background: C.red,
          color: '#fff',
          fontWeight: 800,
          fontSize: 32,
          padding: '14px 26px',
          borderRadius: 999,
          boxShadow: '0 12px 30px rgba(255,69,58,0.35)',
        }}
      >
        <span style={{width: 34, height: 34, borderRadius: 17, background: '#fff', color: C.red, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24}}>!</span>
        {label}
      </span>
    </div>
  );
};

const GithubScene: React.FC<{s: number}> = ({s}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS + s;
  const card = usePop(s + 0.05, s, 16);
  const count = Math.round(
    interpolate(t, [8.4, 9.9], [0, 25391], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)}),
  );
  const chips = [
    {at: 7.7, c: C.green, l: 'Open Source'},
    {at: 7.95, c: C.blue, l: 'Kostenlos'},
    {at: 8.2, c: C.sub, l: 'MIT-Lizenz'},
  ];
  return (
    <Grouped>
      <Card
        style={{
          position: 'absolute',
          left: 110,
          top: 300,
          width: 860,
          padding: 60,
          transform: `scale(${interpolate(card, [0, 1], [0.9, 1])})`,
          opacity: card,
        }}
      >
        <div style={{fontSize: 30, color: C.sub, fontWeight: 600}}>GitHub · Repository</div>
        <div style={{fontSize: 46, fontWeight: 800, marginTop: 10}}>
          <span style={{color: C.sub, fontWeight: 600}}>cloudflare / </span>security-audit-skill
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 24, margin: '50px 0'}}>
          <svg width="110" height="110" viewBox="0 0 24 24">
            <path fill={C.yellow} d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" />
          </svg>
          <div>
            <div style={{fontSize: 130, fontWeight: 900, letterSpacing: -4, lineHeight: 1, fontVariantNumeric: 'tabular-nums'}}>
              {count.toLocaleString('de-DE')}
            </div>
            <div style={{fontSize: 32, color: C.sub, fontWeight: 600}}>Sterne</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: 16, flexWrap: 'wrap'}}>
          {chips.map((ch) => (
            <Chip key={ch.l} at={ch.at} s={s} color={ch.c} label={ch.l} />
          ))}
        </div>
      </Card>
    </Grouped>
  );
};

const Chip: React.FC<{at: number; s: number; color: string; label: string}> = ({at, s, color, label}) => {
  const p = usePop(at, s, 14);
  return (
    <span style={{transform: `scale(${p})`, opacity: p, display: 'inline-block'}}>
      <Pill color={color}>{label}</Pill>
    </span>
  );
};

const TerminalScene: React.FC<{s: number}> = ({s}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS + s;
  const cmd = 'npx skills add cloudflare/security-audit-skill';
  const typed = Math.floor(interpolate(t, [11.35, 12.4], [0, cmd.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const ok1 = usePop(12.55, s, 15);
  const ok2 = usePop(12.95, s, 15);
  const card = usePop(s, s, 18);
  const caret = Math.floor(frame / 8) % 2 === 0;
  return (
    <Grouped>
      <div
        style={{
          position: 'absolute',
          left: 70,
          top: 380,
          width: 940,
          background: C.term,
          borderRadius: 36,
          boxShadow: '0 40px 90px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          transform: `scale(${interpolate(card, [0, 1], [0.92, 1])})`,
          opacity: card,
        }}
      >
        <div style={{display: 'flex', gap: 14, padding: '26px 30px', background: '#2C2C2E', alignItems: 'center'}}>
          {[C.red, C.yellow, C.green].map((c) => (
            <div key={c} style={{width: 24, height: 24, borderRadius: 12, background: c}} />
          ))}
          <div style={{flex: 1, textAlign: 'center', color: '#8E8E93', fontSize: 26, fontWeight: 600, marginRight: 80}}>Terminal — Claude Code</div>
        </div>
        <div style={{padding: '40px 40px 50px', fontFamily: 'Menlo, monospace', fontSize: 34, lineHeight: 1.6, color: '#fff', minHeight: 300}}>
          <div>
            <span style={{color: C.green}}>➜</span> <span style={{color: '#64D2FF'}}>~/meine-app</span> {cmd.slice(0, typed)}
            {typed < cmd.length && caret ? <span style={{background: '#fff'}}>&nbsp;</span> : null}
          </div>
          <div style={{opacity: ok1, color: C.green, marginTop: 18}}>✓ Skill „security-audit" installiert</div>
          <div style={{opacity: ok2, color: '#FFFFFF'}}>
            <span style={{color: C.orange}}>✦</span> Bereit in Claude Code
          </div>
        </div>
      </div>
    </Grouped>
  );
};

const Agent: React.FC<{color: string; size?: number}> = ({color, size = 120}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <rect x="12" y="22" width="76" height="62" rx="22" fill={color} />
    <rect x="46" y="6" width="8" height="18" rx="4" fill={color} />
    <circle cx="50" cy="8" r="7" fill={color} />
    <circle cx="36" cy="50" r="8" fill="#fff" />
    <circle cx="64" cy="50" r="8" fill="#fff" />
    <rect x="36" y="66" width="28" height="6" rx="3" fill="#fff" opacity="0.85" />
  </svg>
);

const AgentsScene: React.FC<{s: number}> = ({s}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS + s;
  const rows = [
    {label: 'Logins', at: 18.25, c: C.blue, finds: '2 Funde'},
    {label: 'Datenbank', at: 18.9, c: C.purple, finds: '1 Fund'},
    {label: 'APIs', at: 19.6, c: C.orange, finds: '3 Funde'},
  ];
  const agentsIn = usePop(16.55, s, 13);
  const header = usePop(s, s, 18);
  return (
    <Grouped light>
      <div style={{position: 'absolute', top: 170, width: '100%', textAlign: 'center', opacity: header}}>
        <div style={{fontSize: 30, color: C.sub, fontWeight: 700, letterSpacing: 2}}>PHASE 2 · AGENTEN-SUCHE</div>
      </div>
      <div style={{position: 'absolute', top: 250, width: '100%', display: 'flex', justifyContent: 'center', gap: 40}}>
        {[C.blue, C.purple, C.orange].map((c, i) => {
          const bob = Math.sin((frame + i * 9) / 7) * 8;
          return (
            <div
              key={c}
              style={{
                transform: `translateY(${interpolate(agentsIn, [0, 1], [260, 0]) + bob}px) scale(${agentsIn})`,
                opacity: agentsIn,
              }}
            >
              <Agent color={c} />
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', top: 480, left: 90, right: 90, display: 'flex', flexDirection: 'column', gap: 30}}>
        {rows.map((r, i) => {
          const active = t >= r.at;
          const p = interpolate(t, [r.at, r.at + 0.55], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const appear = interpolate(t, [s + 0.1 + i * 0.12, s + 0.4 + i * 0.12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <Card
              key={r.label}
              style={{
                padding: '38px 44px',
                display: 'flex',
                alignItems: 'center',
                gap: 30,
                opacity: appear,
                transform: `translateX(${(1 - appear) * 80}px) scale(${active ? 1 + 0.03 * Math.sin(p * Math.PI) : 1})`,
                outline: active ? `5px solid ${r.c}` : '5px solid transparent',
              }}
            >
              <div style={{width: 84, height: 84, borderRadius: 24, background: `${r.c}22`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <div style={{width: 36, height: 36, borderRadius: 10, background: r.c}} />
              </div>
              <div style={{flex: 1}}>
                <div style={{fontSize: 46, fontWeight: 800}}>{r.label}</div>
                <div style={{height: 10, background: C.sep, borderRadius: 5, marginTop: 16, overflow: 'hidden'}}>
                  <div style={{width: `${p * 100}%`, height: '100%', background: r.c, borderRadius: 5}} />
                </div>
              </div>
              <div style={{width: 200, textAlign: 'right'}}>
                {p >= 1 ? <Pill color={C.red} size={28}>{r.finds}</Pill> : active ? <Pill color={C.sub} size={28}>prüft…</Pill> : null}
              </div>
            </Card>
          );
        })}
      </div>
    </Grouped>
  );
};

const Bubble: React.FC<{at: number; s: number; side: 'l' | 'r'; who: string; children: React.ReactNode}> = ({at, s, side, who, children}) => {
  const p = usePop(at, s, 14);
  const left = side === 'l';
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: left ? 'flex-start' : 'flex-end', opacity: p, transform: `scale(${interpolate(p, [0, 1], [0.8, 1])})`, transformOrigin: left ? 'left bottom' : 'right bottom'}}>
      <div style={{fontSize: 26, color: C.sub, fontWeight: 600, margin: '0 22px 8px'}}>{who}</div>
      <div
        style={{
          maxWidth: 760,
          padding: '26px 36px',
          borderRadius: 44,
          fontSize: 38,
          fontWeight: 600,
          lineHeight: 1.25,
          background: left ? '#E9E9EB' : C.blue,
          color: left ? '#000' : '#fff',
        }}
      >
        {children}
      </div>
    </div>
  );
};

const ChatScene: React.FC<{s: number}> = ({s}) => {
  const stamp = usePop(26.65, s, 9);
  return (
    <Grouped light>
      <div style={{position: 'absolute', top: 110, left: 60, right: 60, display: 'flex', flexDirection: 'column', gap: 34}}>
        <Bubble at={23.35} s={s} side="l" who="Agent #1 · Finder">
          Lücke gefunden: Passwort wird im Klartext gespeichert.
        </Bubble>
        <Bubble at={24.4} s={s} side="r" who="Agent #2 · Skeptiker">
          Glaub ich nicht. Ich versuche, das zu widerlegen …
        </Bubble>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 640,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          transform: `scale(${interpolate(stamp, [0, 1], [2.2, 1])}) rotate(-6deg)`,
          opacity: stamp,
        }}
      >
        <div style={{border: `8px solid ${C.green}`, color: C.green, fontWeight: 900, fontSize: 64, padding: '14px 40px', borderRadius: 28, background: '#fff', letterSpacing: 2}}>
          ✓ BESTÄTIGT
        </div>
      </div>
    </Grouped>
  );
};

const ReportScene: React.FC<{s: number}> = ({s}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS + s;
  const card = usePop(s, s, 18);
  const rows = [
    {sev: 'Kritisch', c: C.red, l: 'Passwort im Klartext', at: 29.55},
    {sev: 'Hoch', c: C.orange, l: 'Admin-Route ungeschützt', at: 29.85},
    {sev: 'Mittel', c: '#C9A400', l: 'Kein Login-Limit', at: 30.15},
  ];
  const verified = t >= 31.0;
  const fixOpen = interpolate(t, [32.2, 32.7], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  return (
    <Grouped>
      <Card style={{position: 'absolute', left: 80, right: 80, top: 230, padding: 50, opacity: card, transform: `scale(${interpolate(card, [0, 1], [0.92, 1])})`}}>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30}}>
          <div style={{fontSize: 48, fontWeight: 900}}>Security-Report</div>
          <Pill color={C.green} size={28}>3 bestätigt</Pill>
        </div>
        {rows.map((r, i) => {
          const p = interpolate(t, [r.at, r.at + 0.3], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <div key={r.l} style={{opacity: p, transform: `translateY(${(1 - p) * 30}px)`}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 22, padding: '24px 0', borderTop: i ? `2px solid ${C.sep}` : 'none'}}>
                <Pill color={r.c} size={26}>{r.sev}</Pill>
                <div style={{flex: 1, fontSize: 36, fontWeight: 700}}>{r.l}</div>
                <div style={{width: 48, height: 48, borderRadius: 24, background: verified ? C.green : C.sep, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 900}}>
                  {verified ? '✓' : ''}
                </div>
              </div>
              {i === 0 ? (
                <div style={{height: fixOpen * 210, overflow: 'hidden'}}>
                  <div style={{background: C.term, borderRadius: 24, padding: '26px 30px', fontFamily: 'Menlo, monospace', fontSize: 28, lineHeight: 1.7, marginBottom: 20}}>
                    <div style={{color: '#8E8E93'}}>// So fixt du es:</div>
                    <div style={{color: '#FF6961', background: 'rgba(255,69,58,0.15)', borderRadius: 8, padding: '0 10px'}}>- user.pw = req.body.pw</div>
                    <div style={{color: '#5DE27D', background: 'rgba(48,209,88,0.15)', borderRadius: 8, padding: '0 10px'}}>+ user.pw = await hash(req.body.pw)</div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </Card>
    </Grouped>
  );
};

const GRAPHICS: Record<string, React.FC<{s: number}>> = {
  hook: HookScene,
  github: GithubScene,
  terminal: TerminalScene,
  agents: AgentsScene,
  chat: ChatScene,
  report: ReportScene,
};

// ---------- Captions ----------
type W = {w: string; s: number; e: number};
const FIXES: Record<string, string> = {'fixst.': 'fixt.', 'Job?': 'Job:', 'Ihn': 'ihn', 'kostenlos,': 'kostenlos.', 'Source,': 'Source –', 'los,': 'los –', 'Report.': 'Report –', 'Mit': 'mit', 'komplett': 'KOMPLETT', 'echte': 'ECHTE'};
const words: W[] = (() => {
  const out: W[] = [];
  for (const x of rawWords as W[]) {
    if ((x.w.startsWith('-') || x.w.startsWith('.')) && out.length) {
      out[out.length - 1].w += x.w;
      out[out.length - 1].e = x.e;
    } else out.push({...x});
  }
  return out.map((x) => ({...x, w: FIXES[x.w] ?? x.w}));
})();

const chunks = (() => {
  const res: {text: string[]; s: number; e: number}[] = [];
  let cur: W[] = [];
  const flush = () => {
    if (cur.length) res.push({text: cur.map((c) => c.w), s: cur[0].s, e: cur[cur.length - 1].e});
    cur = [];
  };
  for (const w of words) {
    const sc = sceneAt(w.s);
    if (cur.length && sceneAt(cur[0].s).id !== sc.id) flush();
    cur.push(w);
    const len = cur.map((c) => c.w).join(' ').length;
    if (/[.,:?!–]$/.test(w.w) || cur.length >= 3 || len > 14) flush();
  }
  flush();
  return res.map((c, i) => ({...c, e: i < res.length - 1 ? Math.min(res[i + 1].s, c.e + 0.6) : DURATION_S}));
})();

const KEY: [RegExp, string][] = [
  [/KOMPLETT|kostenlos/i, C.green],
  [/ECHTE/, C.green],
  [/Sicherheitslücken|Prompt|Injection|Lücken?/i, C.red],
  [/25\.000/, C.orange],
  [/Claude|Code\.?$/, C.orange],
  [/KI-Agenten|KI-Skill/, C.purple],
  [/AUDIT/, C.blue],
];
const colorFor = (w: string) => KEY.find(([r]) => r.test(w))?.[1];

const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const ch = chunks.find((c) => t >= c.s && t < c.e);
  if (!ch) return null;
  const sc = sceneAt(ch.s);
  const p = spring({frame: frame - f(ch.s), fps, config: {damping: 12, mass: 0.5}});
  const onFace = sc.layout === 'B';
  const isCta = sc.id === 'cta';
  const top = sc.layout === 'B' ? 1330 : sc.layout === 'A' ? 850 : 1320;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', top, left: 50, right: 50, textAlign: 'center', transform: `scale(${interpolate(p, [0, 1], [0.82, 1])})`, opacity: p}}>
        <span
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: Math.min(onFace ? 96 : sc.layout === 'A' ? 70 : 84, Math.floor(1700 / Math.max(10, ch.text.join(' ').length))),
            letterSpacing: -2,
            lineHeight: 1.05,
            color: onFace ? '#fff' : C.text,
            textShadow: onFace ? '0 4px 28px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.4)' : 'none',
          }}
        >
          {ch.text.map((w, i) => {
            const col = colorFor(w);
            if (isCta && /AUDIT/.test(w)) {
              return (
                <span key={i} style={{display: 'inline-block', margin: '0 10px', padding: '6px 34px', borderRadius: 999, color: '#fff', background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`, textShadow: 'none', boxShadow: '0 12px 40px rgba(10,132,255,0.45)'}}>
                  {w.replace(/[„"“]/g, '')}
                </span>
              );
            }
            return (
              <span key={i} style={{color: col ?? undefined, marginRight: i < ch.text.length - 1 ? 22 : 0}}>
                {w}
              </span>
            );
          })}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Main ----------
export const Reel: React.FC = () => {
  return (
    <AbsoluteFill style={{background: '#fff', fontFamily}}>
      {SCENES.map((sc) => {
        const G = GRAPHICS[sc.id];
        if (!G) return null;
        return (
          <Sequence key={sc.id} from={f(sc.s)} durationInFrames={f(sc.e) - f(sc.s)} layout="none">
            <AbsoluteFill>
              <G s={sc.s} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <FaceLayer />
      <Captions />
      <Audio src={staticFile('vo.wav')} />
    </AbsoluteFill>
  );
};
