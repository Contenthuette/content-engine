// ProofShot – the real source page (screenshot from toolnews/engine/proof.mjs) in a 3D browser frame.
// The camera flies in, zooms onto the quoted sentence, a red line marks it, the source URL stays readable.
// Reusable for every bespoke video: pass the proof.mjs result (file, w, h, rects, url) as `shot`.
import React from 'react';
import {Img, staticFile} from 'remotion';

export type Shot = {file: string; w: number; h: number; rects: {x: number; y: number; w: number; h: number}[]; url: string};

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lin = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const eOut = (x: number) => 1 - Math.pow(1 - clamp(x), 4);
const eIO = (x: number) => { const c = clamp(x); return c < 0.5 ? 8 * c ** 4 : 1 - (-2 * c + 2) ** 4 / 2; };
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

export const ProofShot: React.FC<{t: number; len: number; shot: Shot; accent?: string; zoomTo?: number; dark?: boolean; label?: string; ios?: boolean}> = ({t, len, shot, accent = '#FF3B30', zoomTo, dark = true, label = 'Quelle', ios = false}) => {
  const FX = 40, FY = 430, FW = 1000, CH = 66;
  const k = FW / shot.w;
  const ih = shot.h * k;
  const R = shot.rects;
  const bx0 = Math.min(...R.map((r) => r.x)), bx1 = Math.max(...R.map((r) => r.x + r.w));
  const by0 = Math.min(...R.map((r) => r.y)), by1 = Math.max(...R.map((r) => r.y + r.h));
  const cx = FX + ((bx0 + bx1) / 2) * k, cy = FY + CH + ((by0 + by1) / 2) * k;
  const S = zoomTo ?? clamp(820 / Math.max(120, (bx1 - bx0) * k), 1.4, 2.5);
  const fly = eOut(lin(t, 0, 0.32));
  const z = eIO(lin(t, 0.22, 0.62));
  const mark = eOut(lin(t, 0.5, 0.85));
  const drift = lin(t, 0.6, len);
  const sc = mix(1, S, z) * (1 + 0.04 * drift);
  const host = (() => { try { return new URL(shot.url).host + new URL(shot.url).pathname.replace(/\/$/, ''); } catch { return shot.url; } })();
  return (
    <>
      <div style={{position: 'absolute', inset: 0, perspective: 1700}}>
        <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d',
          transform: `translateZ(${mix(-1300, 0, fly)}px) rotateX(${mix(38, 0, z) + 4 * (1 - z) * fly}deg) rotateY(${mix(-24, 0, z) + mix(0, 3, drift)}deg) rotateZ(${mix(-6, 0, z)}deg)`}}>
          <div style={{position: 'absolute', inset: 0, transformOrigin: `${cx}px ${cy}px`, transform: `translate(${(540 - cx) * z}px, ${(900 - cy) * z}px) scale(${sc})`}}>
            <div style={{position: 'absolute', left: FX, top: FY, width: FW, height: ih + CH, borderRadius: ios ? 44 : 26, overflow: 'hidden', background: dark ? '#0d1117' : '#fff',
              border: ios ? '1px solid rgba(0,0,0,.08)' : `2px solid ${dark ? '#30363d' : '#ddd'}`, boxShadow: ios ? '0 50px 120px rgba(20,30,70,.18), 0 10px 30px rgba(20,30,70,.08)' : '0 60px 140px rgba(0,0,0,.6)'}}>
              <div style={{height: CH, display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', background: dark ? '#161b22' : '#f3f3f3', borderBottom: `1px solid ${dark ? '#30363d' : '#ddd'}`}}>
                {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{width: 16, height: 16, borderRadius: 8, background: c, filter: 'grayscale(1) brightness(1.3)'}} />)}
                <div style={{marginLeft: 18, flex: 1, height: 38, borderRadius: 10, background: dark ? '#0d1117' : '#fff', display: 'flex', alignItems: 'center', padding: '0 16px',
                  fontFamily: "'Inter Variable', Inter, sans-serif", fontSize: 22, color: dark ? '#9aa4ae' : '#555'}}>🔒&nbsp; {host}</div>
              </div>
              <div style={{position: 'relative'}}>
                <Img src={staticFile(shot.file)} style={{width: FW, display: 'block', filter: ios ? 'none' : 'grayscale(1) contrast(1.08)'}} />
                {R.map((r, i) => {
                  const p = clamp(mark * R.length - i);
                  return (
                    <React.Fragment key={i}>
                      <div style={{position: 'absolute', left: r.x * k - 4, top: r.y * k - 2, width: (r.w * k + 8) * p, height: r.h * k + 4, background: `${accent}33`, borderRadius: 4}} />
                      <div style={{position: 'absolute', left: r.x * k - 4, top: (r.y + r.h) * k + 1, width: (r.w * k + 8) * p, height: 4, background: accent, borderRadius: 2, boxShadow: `0 0 10px ${accent}`}} />
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* source label, screen space */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 1390, display: 'flex', justifyContent: 'center', opacity: clamp(lin(t, 0.3, 0.5)), transform: `translateY(${mix(30, 0, eOut(lin(t, 0.3, 0.6)))}px)`}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14, background: ios ? '#0A0A0A' : 'rgba(255,255,255,.96)', color: ios ? '#fff' : '#0A0A0A', borderRadius: 999, padding: '16px 30px',
          fontFamily: "'Inter Variable', Inter, sans-serif", fontWeight: 700, fontSize: 30}}>
          <span style={{width: 12, height: 12, borderRadius: 6, background: accent}} />{label}: <span style={{fontWeight: 500, color: ios ? '#bbb' : '#444'}}>{host}</span>
        </div>
      </div>
    </>
  );
};
