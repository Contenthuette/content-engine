// Proof shots for bespoke videos: open the real source page, find a sentence, capture the area around it.
//   node toolnews/engine/proof.mjs <tasks.json> <results.json>
// task: {id, url, phrase, out (png path), width?=1280, pad?=220, maxH?=1400, scale?=2}
// result: {id, ok, file, url, w, h, rects:[{x,y,w,h}] (phrase lines, image px), pageTitle, error?}
// Uses the real page as it is (no edits besides closing cookie banners / fixed overlays). Never solves CAPTCHAs:
// a page that shows a bot wall returns ok:false and the video uses another source.
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const [tasksPath, outPath] = process.argv.slice(2);
const tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));

const launch = async () => {
  const exe = process.env.TOOLNEWS_CHROME || process.env.CLIPPERZ_BROWSER || null;
  const args = ['--disable-blink-features=AutomationControlled', '--no-sandbox'];
  try { if (!exe) return await require('playwright').chromium.launch({args}); } catch {}
  return await require('playwright-core').chromium.launch({executablePath: exe, args});
};

const BOT = /captcha|unusual traffic|verify you are human|are you a robot|access denied|just a moment/i;

const browser = await launch();
const out = [];
for (const t of tasks) {
  const scale = t.scale ?? 2, width = t.width ?? 1280, pad = t.pad ?? 220, maxH = t.maxH ?? 1400;
  const ctx = await browser.newContext({viewport: {width, height: 1600}, deviceScaleFactor: scale, locale: 'en-US', colorScheme: t.dark ? 'dark' : 'light'});
  const page = await ctx.newPage();
  try {
    await page.goto(t.url, {waitUntil: 'domcontentloaded', timeout: 45000});
    await page.waitForTimeout(2500);
    const body = (await page.textContent('body').catch(() => '')) || '';
    if (BOT.test(body.slice(0, 4000))) throw new Error('bot wall');
    // close cookie banners (reject first), hide fixed overlays
    for (const sel of ['button:has-text("Reject")', 'button:has-text("Decline")', 'button:has-text("Ablehnen")', 'button:has-text("Accept")']) {
      const b = page.locator(sel).first();
      if (await b.isVisible().catch(() => false)) { await b.click({timeout: 1500}).catch(() => {}); break; }
    }
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if ((cs.position === 'fixed' || cs.position === 'sticky') && el.getBoundingClientRect().height < innerHeight * 0.6) el.style.visibility = 'hidden';
      }
    });
    // find the phrase: smallest element whose text contains it, then a Range for the exact line rects
    const found = await page.evaluate((phrase) => {
      const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
      const want = norm(phrase);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let best = null;
      while (walker.nextNode()) {
        const el = walker.currentNode;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (norm(el.textContent || '').includes(want) && (!best || (el.textContent || '').length < (best.textContent || '').length)) best = el;
      }
      if (!best) return null;
      // exact text range inside best
      const texts = [];
      const tw = document.createTreeWalker(best, NodeFilter.SHOW_TEXT);
      while (tw.nextNode()) texts.push(tw.currentNode);
      const full = texts.map((n) => n.textContent).join('');
      const map = []; let acc = '';
      texts.forEach((n, ni) => { for (let i = 0; i < n.textContent.length; i++) { const c = n.textContent[i]; if (/\s/.test(c)) { if (acc.endsWith(' ')) continue; acc += ' '; } else acc += c.toLowerCase(); map.push([ni, i]); } });
      const at = acc.indexOf(want);
      const rect = best.getBoundingClientRect();
      const sy = scrollY;
      let rects = [];
      if (at >= 0) {
        const [n0, o0] = map[Math.min(at, map.length - 1)], [n1, o1] = map[Math.min(at + want.length - 1, map.length - 1)];
        const rg = document.createRange();
        rg.setStart(texts[n0], o0); rg.setEnd(texts[n1], o1 + 1);
        rects = [...rg.getClientRects()].filter((q) => q.width > 2).map((q) => ({x: q.x, y: q.y + sy, w: q.width, h: q.height}));
      }
      void full;
      return {box: {x: rect.x, y: rect.y + sy, w: rect.width, h: rect.height}, rects};
    }, t.phrase);
    if (!found) throw new Error('phrase not found');
    const r0 = found.rects.length ? found.rects : [found.box];
    const top = Math.max(0, Math.min(...r0.map((q) => q.y)) - pad);
    const bottom = Math.max(...r0.map((q) => q.y + q.h)) + pad;
    const clip = {x: 0, y: top, width, height: Math.min(maxH, Math.max(600, bottom - top))};
    await page.screenshot({path: t.out, clip, fullPage: true});
    out.push({id: t.id, ok: true, file: t.out, url: page.url(), pageTitle: await page.title(), w: width * scale, h: clip.height * scale,
      rects: r0.map((q) => ({x: q.x * scale, y: (q.y - top) * scale, w: q.w * scale, h: q.h * scale}))});
  } catch (e) {
    out.push({id: t.id, ok: false, url: t.url, error: String(e.message || e).slice(0, 200)});
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(out.map((r) => `${r.id}: ${r.ok ? 'ok ' + r.rects.length + ' rects' : 'FAIL ' + r.error}`).join('\n'));
