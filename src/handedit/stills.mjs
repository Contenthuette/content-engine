// usage: node src/handedit/stills.mjs <publicDir> <plan.json> <outDir> [--scale 0.5] t1 t2 ...  (seconds)
// Bundles once (public dir = private footage folder, outside the repo), renders one PNG per time.
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import fs from 'fs';
import path from 'path';
const args = process.argv.slice(2);
let scale = 0.5;
const si = args.indexOf('--scale');
if (si >= 0) { scale = parseFloat(args[si + 1]); args.splice(si, 2); }
const [publicDir, planPath, outDir, ...times] = args;
fs.mkdirSync(outDir, {recursive: true});
const inputProps = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const serveUrl = await bundle({entryPoint: path.resolve('src/handedit/index.ts'), publicDir: path.resolve(publicDir)});
const browserExecutable = fs.existsSync('/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell') ? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' : null;
const composition = await selectComposition({serveUrl, id: 'BauplanReel', inputProps, browserExecutable});
for (const t of times) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(parseFloat(t) * 30));
  await renderStill({composition, serveUrl, output: `${outDir}/s_${String(frame).padStart(4, '0')}.png`, frame, inputProps, browserExecutable, imageFormat: 'png', scale});
  process.stdout.write('.');
}
fs.rmSync(serveUrl, {recursive: true, force: true});
console.log('done');
