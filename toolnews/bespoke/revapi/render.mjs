// node toolnews/bespoke/revapi/render.mjs <publicDir> <props.json> <out> [stills t1,t2,...]
import path from 'node:path';
import fs from 'node:fs';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderMedia, renderStill, selectComposition} from '@remotion/renderer';
const [publicDir, propsFile, out, stills] = process.argv.slice(2);
const inputProps = JSON.parse(fs.readFileSync(propsFile, 'utf8'));
const serveUrl = await bundle({entryPoint: path.resolve('toolnews/bespoke/revapi/index.ts'), publicDir, symlinkPublicDir: true});
const browser = await openBrowser('chrome', {browserExecutable: process.env.CLIPPERZ_BROWSER, chromiumOptions: {gl: 'swangle'}});
const composition = await selectComposition({serveUrl, id: process.env.COMP || 'RevApi', inputProps, puppeteerInstance: browser});
if (stills) {
  fs.mkdirSync(out, {recursive: true});
  for (const t of stills.split(',').map(Number)) {
    await renderStill({composition, serveUrl, inputProps, frame: Math.round(t * 30), output: path.join(out, `s_${t.toFixed(2)}.jpg`), imageFormat: 'jpeg', jpegQuality: 80, scale: 0.5, puppeteerInstance: browser, overwrite: true});
  }
} else {
  await renderMedia({composition, serveUrl, inputProps, codec: 'h264', crf: 17, x264Preset: 'veryfast', imageFormat: 'png', colorSpace: 'bt709', audioCodec: 'aac', outputLocation: out,
    concurrency: 2, puppeteerInstance: browser, overwrite: true, onProgress: ({progress}) => { if (Math.round(progress * 100) % 10 === 0) process.stdout.write(`\r${Math.round(progress * 100)}%`); }});
}
await browser.close({silent: true});
console.log('\nok');
