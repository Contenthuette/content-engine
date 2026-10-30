// EDITZ agent still server: bundles the Remotion project ONCE and keeps one browser open, then renders stills on request.
//   node worker/editz_stills.mjs [browserExecutable]
// stdin: one JSON job per line  {"props": "<plan.json>", "frames": [n, …], "out": "<dir>", "scale": 0.5, "quality": 70}
// stdout: one JSON line per job  {"ok": true, "files": ["<dir>/f<n>.jpg", …]}  or  {"ok": false, "error": "…"}
// The public folder is symlinked into the bundle (no 100 MB copy per edit); the bundle is removed on exit.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const browserExecutable = process.argv[2] || process.env.CLIPPERZ_BROWSER || null;
const say = (o) => process.stdout.write(JSON.stringify(o) + '\n');

let serveUrl = null;
let browser = null;
const cleanup = async () => {
  try {
    if (browser) await browser.close({silent: true});
  } catch {}
  try {
    if (serveUrl) fs.rmSync(serveUrl, {recursive: true, force: true});
  } catch {}
};

try {
  serveUrl = await bundle({entryPoint: path.join(root, 'src/clipperz/index.ts'), publicDir: path.join(root, 'public'), symlinkPublicDir: true});
  browser = await openBrowser('chrome', {browserExecutable, chromiumOptions: {gl: 'swangle'}});
  say({ready: true});
} catch (e) {
  say({ok: false, error: 'setup: ' + String(e?.message || e).slice(0, 300)});
  await cleanup();
  process.exit(1);
}

const rl = readline.createInterface({input: process.stdin});
for await (const line of rl) {
  if (!line.trim()) continue;
  try {
    const job = JSON.parse(line);
    const inputProps = JSON.parse(fs.readFileSync(job.props, 'utf8'));
    fs.mkdirSync(job.out, {recursive: true});
    const composition = await selectComposition({serveUrl, id: inputProps.composition || 'ClipperzEdit', inputProps, puppeteerInstance: browser});
    const files = [];
    for (const frame of job.frames) {
      const f = Math.max(0, Math.min(composition.durationInFrames - 1, Math.round(frame)));
      const output = path.join(job.out, `f${f}.jpg`);
      await renderStill({composition, serveUrl, output, inputProps, frame: f, scale: job.scale ?? 0.5, imageFormat: 'jpeg',
        jpegQuality: job.quality ?? 70, puppeteerInstance: browser, overwrite: true});
      files.push(output);
    }
    say({ok: true, files});
  } catch (e) {
    say({ok: false, error: String(e?.message || e).slice(0, 300)});
  }
}
await cleanup();
