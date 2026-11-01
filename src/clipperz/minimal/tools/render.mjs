// node src/clipperz/minimal/tools/render.mjs <plan.json> <publicDir> stills <outDir> t1 t2 ...
// node src/clipperz/minimal/tools/render.mjs <plan.json> <publicDir> video <out.mp4> [scale]
// Bundles with a SMALL publicDir (only this video's assets + public/minimal) – the full public/ is >1 GB.
import {bundle} from '@remotion/bundler';
import {renderStill, renderMedia, selectComposition} from '@remotion/renderer';
import fs from 'fs';
import path from 'path';
const [planPath, publicDir, mode, out, ...rest] = process.argv.slice(2);
const inputProps = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const serveUrl = await bundle({entryPoint: path.resolve('src/clipperz/index.ts'), publicDir: path.resolve(publicDir), symlinkPublicDir: true});
const chrome = process.env.CHROME || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browserExecutable = fs.existsSync(chrome) ? chrome : null;
const composition = await selectComposition({serveUrl, id: process.env.COMP || 'EditzMinimal', inputProps, browserExecutable});
try {
  if (mode === 'stills') {
    fs.mkdirSync(out, {recursive: true});
    for (const t of rest) {
      const frame = Math.min(composition.durationInFrames - 1, Math.round(parseFloat(t) * 30));
      await renderStill({composition, serveUrl, output: `${out}/f${String(frame).padStart(4, '0')}.png`, frame, inputProps, browserExecutable, imageFormat: 'png', scale: 0.5});
      process.stdout.write('.');
    }
  } else {
    await renderMedia({composition, serveUrl, codec: 'h264', outputLocation: out, inputProps, browserExecutable, crf: 18, scale: parseFloat(rest[0] || '1'),
      concurrency: parseInt(process.env.RENDER_CONCURRENCY || '4'), onProgress: ({progress}) => { if (Math.round(progress * 100) % 10 === 0) process.stdout.write(`${Math.round(progress * 100)} `); }});
  }
} finally {
  fs.rmSync(serveUrl, {recursive: true, force: true});
}
console.log('done');
