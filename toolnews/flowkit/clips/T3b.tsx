// 1:1-Nachbau von ref/AQNkrIP5.mp4 (Diktier-App), Original-Frames 96–113: Textcursor kippt, wächst und wird zum Send-Knopf.
// Nur zum Kalibrieren – Inhalt gehört dem Original. Alle Bewegungen sind Messreihen pro Frame (fixtures/t3b_tracks.json).
// Szene = Layout von Frame 100 (Originalpixel 1280×720), darüber die pro Frame gemessene Kamera (Maßstab + Verschiebung).
// Hintergrundfoto, Pille und Avatar-Kachel sind Ausschnitte aus dem Original (nur lokal in public/ref_local).
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import '@fontsource-variable/inter/opsz.css';
import {clamp} from '../curves';
import tr from '../fixtures/t3b_tracks.json';

export const T3B_START = tr.start, T3B_FRAMES = tr.frames;
const D = tr as unknown as {bg: number[][]; mag: number[][]; bars: number[][][]; hand: (number[] | null)[]; label: number[]};
const SANS = "'Inter Variable', 'Inter', system-ui, sans-serif";
const HAND = 'M7 1.2 C7 0.3 9.6 0.3 9.6 1.2 L9.6 9.5 C9.6 8.3 12.1 8.4 12.1 9.6 L12.1 10.6 C12.1 9.4 14.6 9.6 14.6 10.8 L14.6 11.8 C14.6 10.8 17 11 17 12.2 L17 17.5 C17 21.5 15 24 11.5 24 L9.8 24 C7.5 24 6.2 22.8 4.9 20.6 L1.6 15.2 C0.9 14 2.6 12.8 3.6 13.9 L7 17.5 Z';

/** Szene ohne Cursor/Knopf und ohne Hand: Hintergrund, Fenster mit Text, Pegel-Balken. Wird auch von der Baustein-Probe benutzt. */
export const T3bScene: React.FC = () => {
  const i = Math.max(0, Math.min(T3B_FRAMES - 1, useCurrentFrame()));
  const F = T3B_START + i;
  const [s, tx, ty] = D.bg[i], [s0, tx0, ty0] = D.bg[0];
  const text = 'I need to send a new scirpt to client' + (F >= 101 ? '..' : F >= 99 ? '.' : '');
  const tw = F >= 101 ? 335 : F >= 99 ? 329 : 324;                    // gemessene Textbreite je Zustand (Szenen-Pixel)
  return (
    <>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transformOrigin: '0 0', transform: `matrix(${s},0,0,${s},${tx},${ty})`}}>
        <Img src={staticFile('ref_local/t3b_plate.png')} style={{position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transformOrigin: '0 0', transform: `translate(${-tx0 / s0}px, ${-ty0 / s0}px) scale(${1 / s0})`}} />
        <div style={{position: 'absolute', left: 338, top: 242, width: 606, height: 210, borderRadius: 29, background: 'rgb(24,25,30)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.16)'}}>
          {[['#D34440', 26.6], ['#D1C443', 48.2], ['#3FD753', 69.7]].map(([c, x]) => <div key={c as string} style={{position: 'absolute', left: (x as number) - 7, top: 27.6 - 7, width: 14, height: 14, borderRadius: 7, background: c as string}} />)}
          <Img src={staticFile('ref_local/t3b_avatar.png')} style={{position: 'absolute', left: 38, top: 57, width: 69, height: 70, borderRadius: 9}} />
          <div style={{position: 'absolute', left: 115.5, top: 58.6, fontFamily: SANS, fontSize: 20.5, fontWeight: 450, color: '#F2F2F2', lineHeight: 1, letterSpacing: '-0.02em', whiteSpace: 'pre'}}>Oly <span style={{color: '#85808A', fontWeight: 400, fontSize: 19.5}}>00:02</span></div>
          <svg width={360} height={34} style={{position: 'absolute', left: 117, top: 84, overflow: 'visible'}}>
            <text x={0} y={25.2} textLength={tw} lengthAdjust="spacing" style={{fontFamily: SANS, fontSize: 22.2, fontWeight: 430, fill: '#F2F2F2'}}>{text}</text>
          </svg>
        </div>
      </div>
      {D.bars[i].map((b, k) => <div key={k} style={{position: 'absolute', left: b[0], top: b[1], width: b[2], height: b[3], borderRadius: b[2] / 2, background: 'rgb(231,231,231)'}} />)}
    </>
  );
};

export const T3bClip: React.FC = () => {
  const i = Math.max(0, Math.min(T3B_FRAMES - 1, useCurrentFrame()));
  const [mx, my, ml, ms, ma, msig, mr, mg, mb] = D.mag[i];
  const hand = D.hand[i];
  const lab = clamp(D.label[i] / 0.111);
  const blur = Math.max(0, msig - 0.3) * 10;
  const thin = Math.max(0, 1 - (ms - 3) / 8);                         // solange es ein Strich ist: Kern des Originals ist ~1,6 px breiter und heller als der Schwellenwert-Median
  const mw = ms + 1.6 * thin, kr = Math.min(255, mr + 22 * thin), kb = Math.min(255, mb + 18 * thin);                           // Unschärfe des Knopfs: aus der gemessenen Kantensteilheit, Umrechnung genähert
  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      <T3bScene />
      <div style={{position: 'absolute', left: mx - ml / 2, top: my - mw / 2, width: ml, height: mw, borderRadius: Math.min(mw / 2, 7), background: `rgb(${kr},${mg},${kb})`, transform: `rotate(${ma}deg)`, boxShadow: `0 0 ${12 + ms * 0.5}px rgba(225,20,165,.6)`, filter: blur > 0.15 ? `blur(${blur}px)` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, overflow: 'hidden'}}>
        {lab > 0 ? <><span style={{fontFamily: SANS, fontSize: 21, fontWeight: 500, color: '#FFF4FB', lineHeight: 1, letterSpacing: '-0.01em', opacity: lab}}>Send</span><svg width={20} height={18} viewBox="0 0 17 15" style={{opacity: lab}}><path d="M1 1 L16 7.5 L1 14 L4.5 7.5 Z" fill="#FFF4FB" /></svg></> : null}
      </div>
      {hand ? (
        <svg width={19 * (hand[2] / 17)} height={26 * (hand[2] / 17)} viewBox="-1 -1 19 26" style={{position: 'absolute', left: hand[0] - hand[2] / 17, top: hand[1] - hand[2] / 17, overflow: 'visible', filter: `drop-shadow(0 2px 3px rgba(0,0,0,.35)) blur(${clamp((30 - hand[2]) / 6) * 1.5}px)`}}>
          <path d={HAND} fill="#fff" stroke="#000" strokeWidth={1.5} strokeLinejoin="round" />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};
