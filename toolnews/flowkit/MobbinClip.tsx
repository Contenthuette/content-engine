// 1:1-Nachbau von ref/mobbin.mp4, Original-Frames 60–180 (Sekunde 2–6) – jetzt nur noch aus Bausteinen (blocks.tsx).
// Nur zum Kalibrieren der Bewegung: Inhalt und Marken gehören dem Original und kommen in kein eigenes Video.
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {siDeepseek, siRevolut} from 'simple-icons';
import {MOBBIN as M, mixCol, track} from './curves';
import {ArrowButton, CameraZoom, FlowList, LetterTile, Pointer, RowData, SANS, Stage, TypedTravel} from './blocks';

export const MOBBIN_START = 60;          // erster Original-Frame des Ausschnitts
export const MOBBIN_FRAMES = 121;        // 60…180
const T = (origFrame: number) => origFrame - MOBBIN_START;   // Original-Frame → lokale Zeit

export const MOBBIN_ROWS: RowData[] = [
  {title: 'Google TV', sub: 'Movies & TV', dim: 0.6, icon: <LetterTile bg="#fff"><div style={{width: 40, height: 29, borderRadius: 8, borderStyle: 'solid', borderWidth: 6, borderColor: '#4285F4 #FBBC04 #EA4335 #34A853'}} /></LetterTile>},
  {title: 'Tiimo', sub: 'ADHD task & planning', icon: <LetterTile bg="#fff"><div style={{width: 54, height: 54, borderRadius: 27, background: 'radial-gradient(circle at 40% 30%, #C9B6FF, #9A82F0)', position: 'relative'}}><div style={{position: 'absolute', left: 14, top: 18, width: 10, height: 7, borderRadius: 4, background: '#1c1c28'}} /><div style={{position: 'absolute', left: 28, top: 18, width: 10, height: 7, borderRadius: 4, background: '#1c1c28'}} /></div></LetterTile>},
  {title: 'Revoult Business', sub: 'Go beyond business as usual', icon: <LetterTile bg="#000"><svg width={36} height={36} viewBox="0 0 24 24"><path d={siRevolut.path} fill="#fff" /></svg></LetterTile>},
  {title: 'Stake', sub: 'Stocks, ETFs, SMSF', icon: <LetterTile bg="#0A0A0A"><span style={{fontFamily: SANS, fontSize: 19, fontWeight: 800, fontStyle: 'italic', color: '#fff', letterSpacing: '-0.04em', transform: 'scaleX(.78) skewX(-6deg)'}}>STAKE</span></LetterTile>},
  {title: 'Deepseek', sub: 'Intelligent AI assistant', dim: 0.6, icon: <LetterTile bg="#fff"><svg width={42} height={42} viewBox="0 0 24 24"><path d={siDeepseek.path} fill="#4D6BFE" /></svg></LetterTile>},
];

export const MobbinClip: React.FC<{size?: number}> = ({size}) => {
  const fr = useCurrentFrame();
  const F = MOBBIN_START + fr;
  return (
    <Stage size={size} bg={mixCol('#FFFFFF', '#EBF0FD', track(F, M.tint))}>
      {F < 79.5 ? (
        <TypedTravel text="Find design patterns in seconds." anchor={12} x={12} y={324} hold={10} />
      ) : (
        <>
          <CameraZoom from={1.219} origin={[360, 360]} moves={[{at: T(96.7), to: 1, kind: 'out'}, {at: T(149.7), to: 0.873, kind: 'pre'}, {at: T(173), to: 0.873 * 1.03, kind: 'press'}]}>
            <ArrowButton x={611} y={360} appearAt={T(103)} activeAt={T(136.5)} outAt={T(145.2)} />
            <FlowList rows={MOBBIN_ROWS} focus={2} cy={360} typeAt={T(80)} slide={108 / 1.219} cometAt={T(96.4)} growAt={T(103)} scrolls={[{at: T(127.1), to: 3}]} hoverAt={T(162)} pressAt={T(173)} clickAt={T(178.3)} />
          </CameraZoom>
          <Pointer at={T(158)} from={[560, 347]} to={[372, 340]} handAt={T(167)} pressAt={T(173)} outAt={T(178.5)} />
        </>
      )}
    </Stage>
  );
};
