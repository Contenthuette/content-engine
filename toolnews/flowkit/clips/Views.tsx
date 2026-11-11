// Die vier Ansichten pro 1:1-Stelle: Vergleich, Nachbau, Differenz, Überblendung.
import React from 'react';
import {AbsoluteFill, Composition, Folder, OffthreadVideo, staticFile, useCurrentFrame} from 'remotion';

export type ClipDef = {id: string; src: string; start: number; frames: number; w: number; h: number; comp: React.FC; crop?: [number, number, number, number]};   // crop = [x, y, Videobreite, Videohöhe]: Ausschnitt w×h ab (x, y)
const tag: React.CSSProperties = {position: 'absolute', left: 14, bottom: 12, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 20, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.62)', borderRadius: 8, padding: '4px 10px'};
const Orig: React.FC<{d: ClipDef}> = ({d}) => d.crop
  ? <div style={{position: 'absolute', left: 0, top: 0, width: d.w, height: d.h, overflow: 'hidden'}}><OffthreadVideo src={staticFile(d.src)} trimBefore={d.start} muted style={{position: 'absolute', left: -d.crop[0], top: -d.crop[1], width: d.crop[2], height: d.crop[3], maxWidth: 'none'}} /></div>
  : <OffthreadVideo src={staticFile(d.src)} trimBefore={d.start} muted style={{width: d.w, height: d.h}} />;

export const clipViews = (d: ClipDef) => {
  const Vergleich: React.FC = () => { const f = d.start + useCurrentFrame(); return (
    <AbsoluteFill style={{background: '#000'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: d.w, height: d.h, overflow: 'hidden'}}><Orig d={d} /><div style={tag}>Original · Frame {f}</div></div>
      <div style={{position: 'absolute', left: d.w + 4, top: 0, width: d.w, height: d.h, overflow: 'hidden'}}><d.comp /><div style={tag}>Nachbau · Frame {f}</div></div>
    </AbsoluteFill>); };
  const Differenz: React.FC = () => <AbsoluteFill style={{background: '#000'}}><Orig d={d} /><AbsoluteFill style={{mixBlendMode: 'difference'}}><d.comp /></AbsoluteFill></AbsoluteFill>;
  const Ueberblendung: React.FC = () => <AbsoluteFill style={{background: '#000'}}><Orig d={d} /><AbsoluteFill style={{opacity: 0.5}}><d.comp /></AbsoluteFill></AbsoluteFill>;
  return (
    <Folder name={`Stelle-${d.id}`}>
      <Composition id={`${d.id}-Vergleich`} component={Vergleich} durationInFrames={d.frames} fps={30} width={d.w * 2 + 4} height={d.h} />
      <Composition id={`${d.id}-Nachbau`} component={d.comp} durationInFrames={d.frames} fps={30} width={d.w} height={d.h} />
      <Composition id={`${d.id}-Differenz`} component={Differenz} durationInFrames={d.frames} fps={30} width={d.w} height={d.h} />
      <Composition id={`${d.id}-Ueberblendung`} component={Ueberblendung} durationInFrames={d.frames} fps={30} width={d.w} height={d.h} />
    </Folder>
  );
};
