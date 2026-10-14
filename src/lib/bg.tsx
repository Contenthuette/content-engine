// BG · Hintergründe (alle hell, Marke)
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Base, C, ACCENTS, useT, lerp} from './core';

export const Studio: React.FC<Base> = () => (
  <AbsoluteFill style={{background: `radial-gradient(ellipse 95% 62% at 50% 38%, #FFFFFF 0%, ${C.PAPER} 56%, #E2E3E7 100%)`}} />
);
export const Blobs: React.FC<Base & {strength?: number; colors?: string[]; speed?: number}> = ({strength = 0.18, colors = ACCENTS, speed = 1}) => {
  const t = useT() * speed;
  const a = Math.round(Math.min(1, Math.max(0, strength)) * 255).toString(16).padStart(2, '0');
  const pos = [[220, 520], [860, 1180], [300, 1500], [820, 420]];
  return (
    <AbsoluteFill className="dl-root" style={{background: '#F6F7FA'}}>
      {colors.map((c, i) => (
        <div key={i} style={{position: 'absolute', left: pos[i % 4][0] - 420 + Math.sin(t * 0.7 + i * 2) * 70, top: pos[i % 4][1] - 420 + Math.cos(t * 0.6 + i * 2) * 70, width: 840, height: 840, borderRadius: 420,
          background: `radial-gradient(circle, ${c}${a} 0%, ${c}00 65%)`}} />
      ))}
    </AbsoluteFill>
  );
};
export const GridPaper: React.FC<Base & {size?: number}> = ({size = 72}) => {
  const t = useT();
  return <AbsoluteFill className="dl-root" style={{background: '#FAFAFB', backgroundImage: 'linear-gradient(rgba(11,11,15,.06) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(11,11,15,.06) 1.5px, transparent 1.5px)',
    backgroundSize: `${size}px ${size}px`, backgroundPosition: `0 ${t * 20}px`}} />;
};
export const Dots: React.FC<Base> = () => {
  const t = useT();
  return <AbsoluteFill className="dl-root" style={{background: '#FAFAFB', backgroundImage: 'radial-gradient(rgba(11,11,15,.14) 2px, transparent 2.5px)', backgroundSize: '44px 44px', backgroundPosition: `${t * 12}px ${t * 18}px`}} />;
};
export const Mesh: React.FC<Base> = () => {
  const t = useT();
  return <AbsoluteFill style={{background: `conic-gradient(from ${t * 40}deg at 50% 45%, #EAF2FF, #FFECEC, #E9FBF2, #EAF2FF)`, filter: 'blur(40px)', transform: 'scale(1.2)'}} />;
};
export const Sky: React.FC<Base> = () => {
  const t = useT();
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #5EA9FF 0%, #A9D4F5 55%, #EAF4FF 100%)'}}>
      {[0, 1, 2, 3].map((i) => <div key={i} style={{position: 'absolute', left: ((i * 330 + t * 40) % 1700) - 560, /* Wolke (420 px + Blur) bricht erst außerhalb des Bildes um */ top: 260 + i * 260, width: 420, height: 130, borderRadius: 80, background: 'rgba(255,255,255,.8)', filter: 'blur(22px)'}} />)}
    </AbsoluteFill>
  );
};
export const Spotlight: React.FC<Base & {color?: string}> = ({color = C.BLUE}) => {
  const t = useT();
  return (
    <AbsoluteFill className="dl-root" style={{background: '#F7F8FB'}}>
      <div style={{position: 'absolute', left: 540 - 600, top: 900 - 600, width: 1200, height: 1200, borderRadius: 600, background: `radial-gradient(circle, ${color}33 0%, ${color}00 60%)`, transform: `scale(${lerp((Math.sin(t * 2) + 1) / 2, 0.9, 1.08)})`}} />
    </AbsoluteFill>
  );
};
export const Plain: React.FC<Base & {color?: string}> = ({color = C.PAPER}) => <AbsoluteFill style={{background: color}} />;
