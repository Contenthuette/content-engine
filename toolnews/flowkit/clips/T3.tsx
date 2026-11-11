// 1:1-Nachbau von ref/AQPRtKxh.mp4 (Showreel), Original-Frames 876–922: Kanal-Karte fliegt nach oben weg,
// der Subscribe-Button bleibt, kippt, rückt zur Mitte und wächst. Nur zum Kalibrieren – Inhalt gehört dem Original.
// Alle Bewegungen kommen als Messreihe pro Frame aus dem Tracker (fixtures/t3_tracks.json), nichts ist geschätzt.
// Koordinaten = Originalpixel (1280×720).
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import {Track, track} from '../curves';
import {MotionBlur, useF} from '../blocks';
import tr from '../fixtures/t3_tracks.json';
import shine from '../fixtures/t3_shine.json';

export const T3_START = tr.start, T3_FRAMES = tr.frames;
const K = tr as unknown as Record<string, Track>;
const SANS = "'Inter Variable', 'Inter', system-ui, sans-serif";
const t = (fs: number, w: number, c: string, ls = 0): React.CSSProperties => ({fontFamily: SANS, fontSize: fs, fontWeight: w, color: c, lineHeight: 1, letterSpacing: `${ls}em`, whiteSpace: 'pre', position: 'absolute'});
const capTop = (y: number, fs: number) => y - 0.137 * fs;      // Inter: Versalien-Oberkante liegt 0,137 em unter der Box-Oberkante

const Bell: React.FC<{h: number}> = ({h}) => (
  <svg width={h * 0.86} height={h} viewBox="0 0 24 28"><path d="M12 1.5 c1.2 0 2 .8 2 1.9 c3.4 .9 5.2 3.6 5.2 7.4 v5.6 l2.3 3.3 v1.5 h-19 v-1.5 l2.3 -3.3 v-5.6 c0 -3.8 1.8 -6.5 5.2 -7.4 c0 -1.1 .8 -1.9 2 -1.9 z" fill="#fff" /><rect x={8.6} y={23.2} width={6.8} height={3.6} rx={1.8} fill="#fff" /></svg>
);

// Glanz: Farbe der Button-Fläche, pro Frame an 4 Höhen × 33 Stellen am Original gemessen (fixtures/t3_shine.json).
// Jede Höhe wird als waagerechter Verlauf gezeichnet, dazwischen senkrecht überblendet. Kein Schätzwert.
const SH = shine as unknown as {v: number[]; nx: number; frames: Record<string, (number[] | null)[][]>};
const Shine: React.FC<{f: number}> = ({f}) => {
  const key = String(Math.max(24, Math.min(46, Math.round(f))));
  const rows = SH.frames[key];
  if (!rows) return null;
  const vs = SH.v;
  const grad = (line: (number[] | null)[]) => { const pts = line.map((c, i) => (c ? `rgb(${c[0]},${c[1]},${c[2]}) ${((i / (SH.nx - 1)) * 100).toFixed(1)}%` : null)).filter(Boolean); return `linear-gradient(90deg, ${pts.join(', ')})`; };
  return (
    <>
      {rows.map((line, k) => {
        const a = k === 0 ? 0 : vs[k - 1] * 100, c = vs[k] * 100, b = k === rows.length - 1 ? 100 : vs[k + 1] * 100;
        const m = `linear-gradient(180deg, ${k === 0 ? '#000' : 'transparent'} ${a}%, #000 ${c}%, ${k === rows.length - 1 ? '#000' : 'transparent'} ${b}%)`;
        return <div key={k} style={{position: 'absolute', inset: 0, background: grad(line), WebkitMaskImage: m, maskImage: m}} />;
      })}
    </>
  );
};

/** Inhalt der Kanal-Karte (ohne Bewegung) – wird auch von der Baustein-Probe benutzt. */
export const T3CardContent: React.FC = () => (
    <>
      {/* Avatar: Ausschnitt aus dem Original (liegt nur lokal in public/ref_local) */}
      <div style={{position: 'absolute', left: 391 - 249.5 - 86, top: 356 - 233 - 86, width: 172, height: 172, borderRadius: 86, background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,.10)'}} />
      <Img src={staticFile('ref_local/t3_avatar.png')} style={{position: 'absolute', left: 391 - 249.5 - 82, top: 356 - 233 - 82, width: 164, height: 164, borderRadius: 82, objectFit: 'cover'}} />
      <div style={{position: 'absolute', left: 323 - 249.5, top: 272 - 233, width: 45, height: 32, borderRadius: 8, background: '#FF1F1F', boxShadow: '0 0 22px 6px rgba(255,40,40,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <svg width={15} height={15} viewBox="0 0 10 10"><path d="M2 1 L9 5 L2 9 Z" fill="#fff" /></svg>
      </div>
      <div style={{...t(41.5, 800, '#191919', -0.012), left: 513 - 249.5, top: capTop(292, 41.5) - 233}}>SHEEVY</div>
      <div style={{...t(27.5, 500, '#222222', -0.01), left: 513 - 249.5, top: capTop(339.5, 27.5) - 233}}>494k subs</div>
      <div style={{position: 'absolute', left: 715 - 249.5, top: 381 - 233, width: 105, height: 50, borderRadius: 25, border: '2px solid #151515', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <span style={{...t(25, 400, '#151515', -0.01), position: 'static'}}>Join</span>
      </div>
    </>
);
/** Inhalt des Subscribe-Buttons (ohne Bewegung). */
export const T3BtnContent: React.FC = () => (
  <>
    <div style={{position: 'absolute', left: 20.5, top: 14.5}}><Bell h={18.5} /></div>
    <div style={{...t(25.2, 560, '#F4F8FF', -0.012), left: 47.5, top: capTop(15.6, 25.2)}}>Subscribe</div>
  </>
);

const Card: React.FC = () => {
  const f = useF();
  const top = track(f, K.cardTop);
  return (
    <div style={{position: 'absolute', left: 249.5, top, width: 714, height: 244, borderRadius: 38, background: '#FFFFFF'}}>
      <T3CardContent />
    </div>
  );
};

const Button: React.FC = () => {
  const f = useF();
  const cx = track(f, K.btnCx), cy = track(f, K.btnCy), s = track(f, K.btnW) / 189.5, ang = track(f, K.btnAng);
  return (
    <div style={{position: 'absolute', left: cx - 95, top: cy - 24.5, width: 190, height: 49, borderRadius: 24.5, background: '#0154FE', overflow: 'hidden', transform: `rotate(${ang}deg) scale(${s})`}}>
      <Shine f={f} />
      <T3BtnContent />
    </div>
  );
};

export const T3Clip: React.FC = () => {
  const f = useF();
  const v = Math.abs(track(f + 0.5, K.cardTop) - track(f - 0.5, K.cardTop));
  return (
    <AbsoluteFill style={{background: '#111111', overflow: 'hidden'}}>
      <MotionBlur active={v > 3} speed={v} dir="y" shutterAngle={70}><Card /></MotionBlur>
      <Button />
    </AbsoluteFill>
  );
};
