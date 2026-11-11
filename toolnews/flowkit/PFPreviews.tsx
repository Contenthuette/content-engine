// Vorschau für Zeiger (pointer.tsx) und Schrift-Vorschläge (fonts.tsx). Als Ordner in Root.tsx eingehängt; agents/PF.entry.tsx rendert dasselbe für sich.
import React from 'react';
import {AbsoluteFill, Composition, Folder, Img, continueRender, delayRender, getInputProps, staticFile, useCurrentFrame} from 'remotion';
import {ArrowCursor, GrabCursor, HandCursor} from './pointer';
import '@fontsource-variable/inter/opsz.css';
import '@fontsource-variable/inter-tight/wght.css';
import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/hanken-grotesk/wght.css';
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource-variable/schibsted-grotesk/wght.css';
import '@fontsource-variable/manrope/wght.css';
import '@fontsource-variable/onest/wght.css';
import '@fontsource-variable/albert-sans/wght.css';
import '@fontsource-variable/public-sans/wght.css';
import '@fontsource-variable/dm-sans/wght.css';
import '@fontsource-variable/figtree/wght.css';
import '@fontsource-variable/roboto/wght.css';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import '@fontsource-variable/archivo/wght.css';
import {SCHRIFT_FIT} from './fonts';

// Messstellen: Ausschnitt [x0,y0,x1,y1] im Original, Ankerpunkt und Größe des Zeigers dort (aus der Konturmessung).
const M = [
  {id: 'arrow', label: 'ArrowCursor · mobbin 166', box: [362, 330, 410, 394], anchor: [373.45, 338.6], size: 49.23, rot: 0, bg: '#f3f3f3'},
  {id: 'mhand', label: 'HandCursor system · mobbin 172', box: [335, 323, 406, 410], anchor: [363.96, 330.56], size: 71.51, rot: 0, bg: '#f3f3f3'},
  {id: 'whand', label: 'HandCursor system · wispr 118', box: [866, 407, 925, 479], anchor: [890.9, 413.3], size: 58.93, rot: 0.93, bg: '#2a2a2a'},
  {id: 'rhand', label: 'HandCursor comic · raster 68', box: [474, 940, 534, 1004], anchor: [495.02, 950.64], size: 43.63, rot: 0, bg: '#e6e8ee'},
  {id: 'grab', label: 'GrabCursor · raster 27', box: [510, 784, 578, 848], anchor: [543.22, 818.18], size: 39.55, rot: -38.66, bg: '#e6e8ee'},
] as const;
type Id = (typeof M)[number]['id'];
const draw = (id: Id, x: number, y: number, size: number, rot = 0, shadow: boolean = true) =>
  id === 'arrow' ? <ArrowCursor x={x} y={y} size={size} shadow={shadow} />
  : id === 'grab' ? <GrabCursor x={x} y={y} size={size} rotate={rot} shadow={shadow} />
  : <HandCursor kind={id === 'rhand' ? 'comic' : 'system'} x={x} y={y} size={size} rotate={rot} shadow={shadow} />;
const lab: React.CSSProperties = {position: 'absolute', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 22, fontWeight: 600, color: '#888'};

/** Messbild: Frame i = Zeiger i in Originalgröße an Originalposition auf einfarbigem Grund (für IoU / Konturabweichung). */
const Mess: React.FC = () => {
  const m = M[Math.min(M.length - 1, useCurrentFrame())];
  return <AbsoluteFill style={{background: m.bg}}>{draw(m.id, m.anchor[0], m.anchor[1], m.size, m.rot, m.id === 'arrow' || m.id === 'mhand')}</AbsoluteFill>;
};

const Zeiger: React.FC = () => (
  <AbsoluteFill style={{background: '#fff'}}>
    <div style={{position: 'absolute', left: 0, top: 540, width: 1920, height: 540, background: '#17181c'}} />
    {[0, 1].map((r) => M.filter((m) => m.id !== 'whand').map((m, i) => {
      const cx = 240 + i * 480, top = r * 540 + 110, size = m.id === 'grab' ? 260 : 320;
      return (
        <React.Fragment key={`${r}${i}`}>
          {draw(m.id, m.id === 'grab' ? cx : m.id === 'arrow' ? cx - 80 : cx - 20, m.id === 'grab' ? top + 160 : top, size)}
          <div style={{...lab, left: cx - 180, width: 360, textAlign: 'center', top: r * 540 + 478, color: r ? '#9a9da6' : '#666'}}>{m.label.split(' · ')[0]}</div>
        </React.Fragment>
      );
    }))}
  </AbsoluteFill>
);

const Vergleich: React.FC = () => {
  const k = 5;
  return (
    <AbsoluteFill style={{background: '#111'}}>
      {M.map((m, i) => {
        const w = m.box[2] - m.box[0], h = m.box[3] - m.box[1], x0 = 384 * i + (384 - w * k) / 2;
        const cell = (row: number, kids: React.ReactNode, bg: string) => (
          <div style={{position: 'absolute', left: x0, top: 60 + row * 450, width: w * k, height: h * k, overflow: 'hidden', background: bg}}>{kids}</div>
        );
        const img = (op = 1) => <Img src={staticFile(`ref_local/pf_${m.id}.png`)} style={{position: 'absolute', left: 0, top: 0, width: w * k, height: h * k, imageRendering: 'pixelated', opacity: op}} />;
        const vec = (shadow: boolean) => draw(m.id, (m.anchor[0] - m.box[0]) * k, (m.anchor[1] - m.box[1]) * k, m.size * k, m.rot, shadow);
        return (
          <React.Fragment key={m.id}>
            <div style={{...lab, left: 384 * i, width: 384, textAlign: 'center', top: 16, color: '#ddd', fontSize: 19}}>{m.label}</div>
            {cell(0, img(), '#000')}
            {cell(1, vec(m.id === 'arrow' || m.id === 'mhand'), m.bg)}
            {cell(2, <>{img()}<div style={{position: 'absolute', inset: 0, opacity: 0.5}}>{vec(false)}</div></>, '#000')}
          </React.Fragment>
        );
      })}
      {['Original ×5', 'Vektor ×5', 'Vektor 50 % über Original'].map((t, r) => <div key={t} style={{...lab, left: 8, top: 60 + r * 450 - 26, color: '#ff5', fontSize: 18}}>{t}</div>)}
    </AbsoluteFill>
  );
};

// =====================================================================================================
// Schriften
// =====================================================================================================
export const KANDIDATEN = ['Inter Variable', 'Inter Tight Variable', 'Geist Variable', 'Hanken Grotesk Variable', 'Instrument Sans Variable', 'Schibsted Grotesk Variable', 'Manrope Variable',
  'Onest Variable', 'Albert Sans Variable', 'Public Sans Variable', 'DM Sans Variable', 'Figtree Variable', 'Roboto Variable', 'Plus Jakarta Sans Variable', 'Archivo Variable'];
const GEWICHTE = [300, 350, 400, 450, 500, 550, 600, 650, 700];
// Vergleichstexte; opsz = optische Größe, die Inter bei der Originalgröße bekäme (nur Inter hat diese Achse geladen)
const TEXTE = [{t: 'now', opsz: 32}, {t: 'Subscribe', opsz: 25}, {t: 'patterns in seconds.', opsz: 32}, {t: 'oopsy - Goomba (Official Video)', opsz: 14}];
const MESS_FS = 120, MESS_X = 40, MESS_ROW = 300, MESS_BASE = 200;
const useFonts = (fams: string[]) => {
  const [h] = React.useState(() => delayRender('Schriften laden'));
  React.useEffect(() => {
    Promise.all(fams.flatMap((f) => GEWICHTE.map((w) => document.fonts.load(`${w} 40px "${f}"`, 'now Subscribe (Official Video) - .')))).then(() => document.fonts.ready).then(() => continueRender(h), () => continueRender(h));
  }, [h]);
};
const fvs = (fam: string, opsz: number) => (fam === 'Inter Variable' ? `'opsz' ${opsz}` : undefined);

/** Messbild: Frame = Kandidat × 9 + Gewichtsstufe; vier Texte schwarz auf weiß, 120 px, Grundlinie bei 200 + 300·Zeile. */
const SchriftMess: React.FC = () => {
  const f = useCurrentFrame(), ci = Math.floor(f / GEWICHTE.length), wi = f % GEWICHTE.length, fam = KANDIDATEN[ci], w = GEWICHTE[wi];
  const ls = ((getInputProps() as {ls?: number[][][]}).ls ?? [])[ci]?.[wi] ?? [0, 0, 0, 0];      // 2. Durchgang: Laufweite in px (bei 120 px), damit die Breite ohne Stauchen passt
  useFonts([fam]);
  return (
    <AbsoluteFill style={{background: '#fff'}}>
      <svg width={2600} height={1200}>
        {TEXTE.map((x, i) => <text key={i} x={MESS_X} y={MESS_BASE + MESS_ROW * i} style={{fontFamily: `'${fam}'`, fontSize: MESS_FS, fontWeight: w, fontVariationSettings: fvs(fam, x.opsz), letterSpacing: ls[i], fill: '#000'}}>{x.t}</text>)}
      </svg>
    </AbsoluteFill>
  );
};

/** Vorschau: oben die Original-Ausschnitte, darunter je Kandidat die vier Texte auf gleiche Breite und x-Höhe gesetzt (bestes Gewicht). */
const Schriften: React.FC = () => {
  const F = SCHRIFT_FIT;
  useFonts(F.rows.map((r) => r.fam));
  const rowH = 86, top = 70, colX: number[] = [];
  let x = 330;
  for (const o of F.orig) { colX.push(x); x += o.w * o.k + 36; }
  return (
    <AbsoluteFill style={{background: '#16171b', fontFamily: "'Inter Variable'", color: '#ddd'}}>
      <div style={{position: 'absolute', left: 20, top: 14, fontSize: 20, fontWeight: 600, color: '#ff5'}}>Schrift-Vergleich: Original (oben) · Kandidaten auf gleiche x-Höhe und (über Laufweite) gleiche Breite · Zahl = mittlere Pixelabweichung 0–255 · Gewicht · L = Breite über Laufweite, S = gestaucht · grün = Vorschlag</div>
      {[null, ...F.rows].map((r, ri) => (
        <React.Fragment key={ri}>
          <div style={{position: 'absolute', left: 20, top: top + ri * rowH + 8, width: 300, fontSize: 19, fontWeight: 600, color: r ? (r.pick ? '#7dff9b' : '#ddd') : '#ff5'}}>
            {r ? `${ri}. ${r.fam.replace(' Variable', '')}` : 'Original'}
            {r ? <div style={{fontSize: 14, fontWeight: 400, color: '#999'}}>Mittel {r.mean.toFixed(1)} · rel. zu Inter {r.rel.toFixed(2)} (L {r.relL.toFixed(2)} · S {r.relS.toFixed(2)})</div> : null}
          </div>
          {F.orig.map((o, ci) => {
            const c = r ? r.cells[ci] : null, k = o.k;
            return (
              <div key={ci} style={{position: 'absolute', left: colX[ci], top: top + ri * rowH + (rowH - 8 - o.h * k) / 2, width: o.w * k, height: o.h * k, overflow: 'hidden', background: o.bg}}>
                {c ? (
                  <svg width={o.w * k} height={o.h * k} style={{position: 'absolute', left: 0, top: 0}}>
                    <g transform={`scale(${k}) translate(${c.tx} ${c.ty}) scale(${c.sx} ${c.sy})`}>
                      <text x={0} y={0} style={{fontFamily: `'${r!.fam}'`, fontSize: MESS_FS, fontWeight: c.wght, fontVariationSettings: fvs(r!.fam, TEXTE[ci].opsz), letterSpacing: c.ls, fill: o.ink}}>{TEXTE[ci].t}</text>
                    </g>
                  </svg>
                ) : <Img src={staticFile(`ref_local/pf_text${ci}.png`)} style={{position: 'absolute', left: 0, top: 0, width: o.w * k, height: o.h * k}} />}
                {c ? <div style={{position: 'absolute', right: 3, bottom: 1, fontSize: 12, fontWeight: 600, color: o.dark ? '#ffec80' : '#c0392b'}}>{c.mad.toFixed(1)} · {c.wght} · {c.mode}</div> : null}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </AbsoluteFill>
  );
};

export const PFPreviews: React.FC = () => (
  <Folder name="Zeiger-und-Schriften">
    <Composition id="PF-Zeiger" component={Zeiger} durationInFrames={1} fps={30} width={1920} height={1080} />
    <Composition id="PF-Zeiger-Vergleich" component={Vergleich} durationInFrames={1} fps={30} width={1920} height={1420} />
    <Composition id="PF-Zeiger-Mess" component={Mess} durationInFrames={M.length} fps={30} width={1280} height={1280} />
    <Composition id="PF-Schriften" component={Schriften} durationInFrames={1} fps={30} width={1920} height={70 + 86 * (SCHRIFT_FIT.rows.length + 1) + 10} />
    <Composition id="PF-Schrift-Mess" component={SchriftMess} durationInFrames={KANDIDATEN.length * GEWICHTE.length} fps={30} width={2600} height={1200} />
  </Folder>
);
