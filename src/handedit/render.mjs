// usage: node src/handedit/render.mjs <publicDir> <plan.json> <out.mp4> [--scale 0.5] [--crf 18] [--concurrency 2]
// Renders video only (audio is mixed separately and muxed afterwards). Bundle is deleted after the render.
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import fs from 'fs';
import path from 'path';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const scale = parseFloat(opt('--scale', '1')), crf = parseInt(opt('--crf', '16')), concurrency = parseInt(opt('--concurrency', '2'));
const [publicDir, planPath, out] = args;
const inputProps = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const serveUrl = await bundle({entryPoint: path.resolve('src/handedit/index.ts'), publicDir: path.resolve(publicDir)});
const chrome = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browserExecutable = fs.existsSync(chrome) ? chrome : null;
const composition = await selectComposition({serveUrl, id: 'BauplanReel', inputProps, browserExecutable});
const t0 = Date.now();
let last = -1;
await renderMedia({composition, serveUrl, codec: 'h264', outputLocation: out, inputProps, browserExecutable, scale, crf, concurrency, muted: true,
  pixelFormat: 'yuv420p', x264Preset: 'medium',
  onProgress: ({progress}) => { const p = Math.floor(progress * 20); if (p !== last) { last = p; process.stdout.write(`${p * 5}% `); } }});
fs.rmSync(serveUrl, {recursive: true, force: true});
console.log(`\nrendered ${out} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
