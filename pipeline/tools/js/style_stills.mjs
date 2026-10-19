// Style search helper: renders the same frames for many style candidates with ONE bundle and ONE browser.
//   node pipeline/tools/js/style_stills.mjs <job.json>
// job.json: {serveUrl, frames: [n...], scale, browser?, candidates: [{id, props}], outDir}
// Writes <outDir>/<id>_<frame>.png for every candidate and frame.
import fs from 'node:fs';
import path from 'node:path';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';

const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
fs.mkdirSync(job.outDir, {recursive: true});
const browser = await openBrowser('chrome', {browserExecutable: job.browser || null, chromiumOptions: {gl: 'swangle'}});
try {
  for (const c of job.candidates) {
    const composition = await selectComposition({serveUrl: job.serveUrl, id: 'ClipperzEdit', inputProps: c.props, puppeteerInstance: browser});
    for (const frame of job.frames) {
      const output = path.join(job.outDir, `${c.id}_${frame}.png`);
      if (fs.existsSync(output)) continue;
      await renderStill({composition, serveUrl: job.serveUrl, output, inputProps: c.props, frame, scale: job.scale ?? 0.5,
        imageFormat: 'png', puppeteerInstance: browser, overwrite: true});
    }
    process.stdout.write(`${c.id}\n`);
  }
} finally {
  await browser.close({silent: true});
}
