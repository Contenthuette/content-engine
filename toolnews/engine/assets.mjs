// Toolnews assets via Playwright: screenshots with text highlight, logos, scroll recordings.
//   node toolnews/engine/assets.mjs <tasks.json> <results.json>
// tasks: [{id, type: "shot"|"logo"|"record", url, highlight?, out}]  (out = file path without extension for record)
// result per task: {id, ok, …, error?}. Never throws for a single task: a failed card is ok:false and the planner uses another block.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const [tasksPath, outPath] = process.argv.slice(2);
const tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));

// Sandbox: `playwright` (with its own browsers). GitHub/Docker: playwright-core + Remotion's Chrome Headless Shell.
const launch = async () => {
  const exe = process.env.TOOLNEWS_CHROME || process.env.CLIPPERZ_BROWSER || null;
  const args = ['--disable-blink-features=AutomationControlled', '--no-sandbox'];
  try {
    if (!exe) {
      const {chromium} = require('playwright');
      return await chromium.launch({args});
    }
  } catch {}
  const {chromium} = require('playwright-core');
  let executablePath = exe;
  if (!executablePath) {
    const base = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'node_modules', '.remotion');
    const found = [];
    const walk = (d, depth = 0) => {
      if (depth > 5 || !fs.existsSync(d)) return;
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (/^chrome-headless-shell$|^headless_shell$/.test(f) && fs.statSync(p).isFile()) found.push(p);
        else if (fs.statSync(p).isDirectory()) walk(p, depth + 1);
      }
    };
    walk(base);
    executablePath = found[0];
  }
  return await chromium.launch({executablePath, args});
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const W = 540, SHOT_H = 700;

// cookie banners: reject first, else accept, else hide
const REJECT = [/^(alle )?ablehnen$/i, /^nur (notwendige|erforderliche|essenzielle)/i, /^reject( all)?$/i, /^decline( all)?$/i, /^do not consent$/i,
  /^nicht zustimmen$/i, /^necessary only$/i, /^only necessary/i, /^refuse( all)?$/i, /^deny( all)?$/i, /^continue without accepting/i, /^weiter ohne/i];
const ACCEPT = [/^(alle )?akzeptieren$/i, /^accept( all)?( cookies)?$/i, /^allow( all)?$/i, /^agree$/i, /^i agree$/i, /^zustimmen$/i, /^einverstanden$/i,
  /^got it$/i, /^ok$/i, /^alle zulassen$/i, /^consent$/i];
const CMP_CSS = `#axeptio_overlay,#axeptio_main_button,.axeptio_mount,#onetrust-banner-sdk,#onetrust-consent-sdk,.onetrust-pc-dark-filter,#didomi-host,.didomi-popup-open,
#usercentrics-root,#usercentrics-cmp-ui,#CybotCookiebotDialog,#CybotCookiebotDialogBodyUnderlay,[id^="sp_message_container"],.sp_veil,.fc-consent-root,.fc-dialog-overlay,
#cookie-banner,#cookiebanner,.cookie-banner,.cookie-consent,#cookie-consent,.cc-window,.cc-banner,#cmpbox,#cmpbox2,.cmpboxBG,#qc-cmp2-container,.qc-cmp2-container,
[aria-label*="cookie" i][role="dialog"],[class*="CookieBanner"],[class*="cookieBanner"],#gdpr-banner,.gdpr-banner,#truste-consent-track{display:none!important;visibility:hidden!important}
html,body{overflow:auto!important}`;

const clickBy = async (page, patterns) => {
  for (const frame of page.frames()) {
    let els = [];
    try { els = await frame.$$('button, [role="button"], a, input[type="button"], input[type="submit"]'); } catch { continue; }
    for (const el of els.slice(0, 400)) {
      let txt = '';
      try { txt = ((await el.innerText({timeout: 300})) || (await el.getAttribute('value')) || '').trim().replace(/\s+/g, ' '); } catch { continue; }
      if (!txt || txt.length > 40) continue;
      if (patterns.some((re) => re.test(txt))) {
        try { if (await el.isVisible()) { await el.click({timeout: 1500}); return txt; } } catch {}
      }
    }
  }
  return null;
};

// hide newsletter / sign-up / promo boxes and fixed overlays that cover the page (never the element holding the highlight)
const HIDE_JS = (keep) => {
  const keepEl = keep ? (() => { const r = document.querySelectorAll('[data-tn-keep]'); return r.length ? r[0] : null; })() : null;
  const promo = /(newsletter|subscribe|sign ?up|abonnier|anmelden|registrier|join (our|the)|get (the|our) (app|newsletter)|download (the|our) app|sponsored|advertisement|anzeige|we use cookies|cookies? (policy|settings)|datenschutz-einstellungen)/i;
  let n = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (keepEl && (el.contains(keepEl) || keepEl.contains(el))) continue;
    const cs = getComputedStyle(el);
    const fixed = cs.position === 'fixed' || cs.position === 'sticky';
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 30) continue;
    const big = r.width * r.height > innerWidth * innerHeight * 0.18;
    const dialog = el.getAttribute('role') === 'dialog' || el.getAttribute('aria-modal') === 'true' || el.tagName === 'DIALOG';
    const txt = (el.innerText || '').slice(0, 400);
    if ((fixed && (big || promo.test(txt))) || (dialog && promo.test(txt)) || (fixed && r.top > innerHeight * 0.55) ||
        (!fixed && promo.test(txt) && txt.length < 260 && r.height < 520 && /form|input|button/i.test(el.innerHTML.slice(0, 3000)) && el.querySelector('input[type="email"], input[name*="mail" i]'))) {
      el.style.setProperty('visibility', 'hidden', 'important');
      n += 1;
    }
  }
  return n;
};

// locate highlight text: returns rects (viewport CSS px) of the first visible occurrence, marks its element with data-tn-keep
const FIND_JS = (needle) => {
  const norm = (s) => s.replace(/[‘’ʼ]/g, "'").replace(/[“”„]/g, '"').replace(/ /g, ' ').toLowerCase();
  const want = norm(needle).replace(/\s+/g, ' ').trim();
  if (!want) return null;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const map = [];
  let all = '';
  let lastSpace = true;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName)) continue;
    const s = norm(node.nodeValue || '');
    for (let i = 0; i < s.length; i++) {
      const ch = /\s/.test(s[i]) ? ' ' : s[i];
      if (ch === ' ' && lastSpace) continue;
      all += ch; map.push([node, i]); lastSpace = ch === ' ';
    }
    if (!lastSpace) { all += ' '; map.push([node, s.length]); lastSpace = true; }
  }
  let from = 0;
  while (true) {
    const at = all.indexOf(want, from);
    if (at < 0) return null;
    from = at + 1;
    const [n0, o0] = map[at], [n1, o1] = map[at + want.length - 1];
    const range = document.createRange();
    try { range.setStart(n0, o0); range.setEnd(n1, Math.min((n1.nodeValue || '').length, o1 + 1)); } catch { continue; }
    const el = n0.parentElement;
    if (el.checkVisibility && !el.checkVisibility({checkOpacity: true, checkVisibilityCSS: true})) continue;
    const rects = [...range.getClientRects()].filter((r) => r.width > 2 && r.height > 4).map((r) => [r.left, r.top, r.width, r.height]);
    if (!rects.length) continue;
    // merge rects on the same line
    const lines = [];
    for (const r of rects.sort((a, b) => a[1] - b[1] || a[0] - b[0])) {
      const l = lines.find((x) => Math.abs(x[1] - r[1]) < r[3] * 0.5);
      if (l) { const x1 = Math.max(l[0] + l[2], r[0] + r[2]); l[0] = Math.min(l[0], r[0]); l[2] = x1 - l[0]; l[3] = Math.max(l[3], r[3]); }
      else lines.push([...r]);
    }
    document.querySelectorAll('[data-tn-keep]').forEach((x) => x.removeAttribute('data-tn-keep'));
    (range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement).setAttribute('data-tn-keep', '1');
    return {rects: lines, top: Math.min(...lines.map((l) => l[1])) + scrollY};
  }
};

// wait until the visible text stops changing (animated counters, typewriters) – max ~4 s
const settle = async (page) => {
  let last = '';
  for (let i = 0; i < 8; i++) {
    const cur = await page.evaluate(() => (document.body?.innerText || '').slice(0, 30000)).catch(() => '');
    if (cur === last) return;
    last = cur;
    await page.waitForTimeout(500);
  }
};

// promo boxes: an element labelled "Sponsored"/"Anzeige"/… → its card-sized container is removed (layout is re-measured after)
const PROMO_JS = () => {
  const label = /^(sponsored|gesponsert|anzeige|werbung|advertisement|ad|promoted)$/i;
  const kept = (el) => el.querySelector('[data-tn-keep]') || el.closest('[data-tn-keep]');
  // the whole card around a promo label / a newsletter form: climb while the box stays card-sized and short on text
  // never climb into a box that holds a heading, the highlighted text or a lot of other text
  const card = (el, maxText) => {
    let box = el, best = null;
    for (let i = 0; i < 8 && box && box !== document.body; i++, box = box.parentElement) {
      const r = box.getBoundingClientRect();
      if (r.height > 900 || (box.innerText || '').length > maxText || box.querySelector('h1, h2, [data-tn-keep]') || box.closest('[data-tn-keep]')) break;
      if (r.height >= 40) best = box;
    }
    return best;
  };
  let n = 0;
  const hide = (el) => { if (el && !kept(el)) { el.style.setProperty('display', 'none', 'important'); n += 1; } };
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length > 2) continue;
    if (label.test((el.innerText || '').trim())) hide(card(el, 420));
  }
  for (const inp of document.querySelectorAll('input[type="email"], input[name*="mail" i], input[placeholder*="mail" i]')) hide(card(inp, 160));
  return n;
};

const BOT = /(captcha|verify you are human|are you a robot|access denied|just a moment|attention required|checking your browser|enable javascript and cookies|request blocked|zugriff verweigert)/i;
const DIGEST = /(newsletter|news of the week|this week in|weekly (recap|roundup|digest)|wochenrückblick|recap|roundup|digest|news der woche)/i;

const openPage = async (browser, url, opts = {}) => {
  const ctx = await browser.newContext({viewport: {width: opts.width || W, height: opts.height || SHOT_H}, deviceScaleFactor: opts.dpr || 2, userAgent: UA,
    locale: 'en-US', recordVideo: opts.recordVideo, colorScheme: 'light'});
  const page = await ctx.newPage();
  const t0 = Date.now();
  let resp;
  try {
    resp = await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 30000});
  } catch (e) {
    await ctx.close();
    return {error: 'Seite nicht erreichbar'};
  }
  const status = resp ? resp.status() : 0;
  if (status >= 400) { await ctx.close(); return {error: `HTTP ${status}`}; }
  try { await page.waitForLoadState('networkidle', {timeout: 7000}); } catch {}
  await page.waitForTimeout(800);
  const rej = await clickBy(page, REJECT);
  if (!rej) await clickBy(page, ACCEPT);
  await page.addStyleTag({content: CMP_CSS}).catch(() => null);
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => ({title: document.title, h1: (document.querySelector('h1')?.innerText || '').slice(0, 200), text: (document.body?.innerText || '').slice(0, 20000)}));
  if (BOT.test(info.title) || (info.text.length < 400 && BOT.test(info.text))) { await ctx.close(); return {error: 'Bot-Sperre'}; }
  if (info.text.replace(/\s+/g, ' ').trim().length < 120) { await ctx.close(); return {error: 'Seite leer'}; }
  return {ctx, page, info, t0, status};
};

const shot = async (browser, task) => {
  const o = await openPage(browser, task.url);
  if (o.error) return {ok: false, error: o.error};
  const {ctx, page, info} = o;
  try {
    const hlWords = (task.highlight || '').trim().split(/\s+/).filter(Boolean).length;
    if ((DIGEST.test(info.title) || DIGEST.test(info.h1) || /newsletter|digest|recap|roundup/i.test(task.url)) && hlWords < 2)
      return {ok: false, error: 'Sammelseite ohne Markierung'};
    let found = null, y = 0;
    if (task.highlight) {
      found = await page.evaluate(FIND_JS, task.highlight);
      if (!found) {
        // lazy / animated content (counters start on scroll-into-view): walk down the page once, let it settle, search again
        for (let i = 1; i <= 8; i++) {
          await page.evaluate((k) => window.scrollTo(0, k * innerHeight * 0.9), i);
          await page.waitForTimeout(350);
        }
        await settle(page);
        found = await page.evaluate(FIND_JS, task.highlight);
      }
      if (!found) return {ok: false, error: 'Markierter Text nicht auf der Seite'};
      y = Math.max(0, found.top - SHOT_H * 0.38);
    } else {
      y = await page.evaluate(() => {
        const h = [...document.querySelectorAll('h1, article h2, main h2')].find((e) => e.getBoundingClientRect().height > 0);
        return h ? Math.max(0, h.getBoundingClientRect().top + scrollY - 40) : 0;
      });
    }
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(700);  // lazy images, sticky headers settle
    await page.evaluate(PROMO_JS);
    await page.evaluate(HIDE_JS, !!found);
    await settle(page);
    await page.waitForTimeout(200);
    let rects = [];
    if (found) {
      // re-measure after hiding banners / layout shifts; the text must be fully on screen and not covered
      const again = await page.evaluate(FIND_JS, task.highlight);
      if (!again) return {ok: false, error: 'Markierter Text verschwunden'};
      const top = Math.min(...again.rects.map((r) => r[1])), bot = Math.max(...again.rects.map((r) => r[1] + r[3]));
      if (top < 0 || bot > SHOT_H || again.rects.some((r) => r[0] < -2 || r[0] + r[2] > W + 2)) {
        await page.evaluate((yy) => window.scrollTo(0, yy), Math.max(0, again.top - SHOT_H * 0.38));
        await page.waitForTimeout(400);
      }
      const fin = await page.evaluate(FIND_JS, task.highlight);
      if (!fin) return {ok: false, error: 'Markierter Text verschwunden'};
      const t2 = Math.min(...fin.rects.map((r) => r[1])), b2 = Math.max(...fin.rects.map((r) => r[1] + r[3]));
      if (t2 < 0 || b2 > SHOT_H) return {ok: false, error: 'Markierter Text nicht im Bild'};
      const covered = await page.evaluate((rs) => rs.some((r) => {
        const el = document.elementFromPoint(r[0] + Math.min(r[2] / 2, 20), r[1] + r[3] / 2);
        const keep = document.querySelector('[data-tn-keep]');
        return !el || !keep || !(keep.contains(el) || el.contains(keep));
      }), fin.rects);
      if (covered) {
        // something sits on top of the text (sticky header, popup): hide fixed elements over it and re-check
        await page.evaluate((rs) => {
          for (const r of rs) {
            let el = document.elementFromPoint(r[0] + 10, r[1] + r[3] / 2);
            const keep = document.querySelector('[data-tn-keep]');
            while (el && keep && !(keep.contains(el) || el.contains(keep)) && el !== document.body) {
              const cs = getComputedStyle(el);
              if (cs.position === 'fixed' || cs.position === 'sticky') { el.style.setProperty('visibility', 'hidden', 'important'); break; }
              el = el.parentElement;
            }
          }
        }, fin.rects);
        const still = await page.evaluate((rs) => rs.some((r) => {
          const el = document.elementFromPoint(r[0] + Math.min(r[2] / 2, 20), r[1] + r[3] / 2);
          const keep = document.querySelector('[data-tn-keep]');
          return !el || !keep || !(keep.contains(el) || el.contains(keep));
        }), fin.rects);
        if (still) return {ok: false, error: 'Markierter Text verdeckt'};
      }
      rects = fin.rects.map((r) => r.map((v) => Math.round(v * 2)));
    }
    if (!found) await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await settle(page);
    await page.screenshot({path: task.out, clip: {x: 0, y: 0, width: W, height: SHOT_H}});
    const domain = new URL(page.url()).hostname.replace(/^www\./, '');
    return {ok: true, img: task.out, w: W * 2, h: SHOT_H * 2, hl: rects, domain, title: info.title.slice(0, 120), focus: found ? 0.38 : 0.2};
  } catch (e) {
    return {ok: false, error: 'Screenshot fehlgeschlagen: ' + String(e.message || e).slice(0, 120)};
  } finally {
    await ctx.close();
  }
};

const logo = async (browser, task) => {
  const o = await openPage(browser, task.url, {dpr: 1});
  if (o.error) return {ok: false, error: o.error};
  const {ctx, page} = o;
  try {
    const cands = await page.evaluate(async () => {
      const out = [];
      const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
      for (const l of document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"], link[rel="mask-icon"]')) {
        const s = (l.getAttribute('sizes') || '').split('x')[0];
        out.push({url: abs(l.href), size: s === 'any' ? 512 : Number(s) || (l.rel.includes('apple') ? 180 : 0), svg: /\.svg(\?|$)/i.test(l.href) || l.type === 'image/svg+xml'});
      }
      const m = document.querySelector('link[rel="manifest"]');
      if (m) {
        try {
          const j = await (await fetch(m.href)).json();
          for (const ic of j.icons || []) out.push({url: abs(new URL(ic.src, m.href).href), size: Number(String(ic.sizes || '').split('x')[0]) || 0, svg: /svg/.test(ic.type || ic.src)});
        } catch {}
      }
      // inline header logo (svg/img in the first header/nav link)
      const hl = document.querySelector('header a img, nav a img, a[href="/"] img');
      if (hl && hl.naturalWidth >= 96) out.push({url: abs(hl.currentSrc || hl.src), size: hl.naturalWidth, svg: /\.svg/i.test(hl.src), header: true});
      out.push({url: abs('/apple-touch-icon.png'), size: 180, guess: true});
      return out.filter((c) => c.url);
    });
    cands.sort((a, b) => (b.svg ? 1000 : b.size) - (a.svg ? 1000 : a.size));
    for (const c of cands) {
      if (!c.svg && c.size && c.size < 96) continue;
      try {
        const r = await ctx.request.get(c.url, {timeout: 15000});
        if (!r.ok()) continue;
        const buf = await r.body();
        const ct = r.headers()['content-type'] || '';
        if (buf.length < 200 || /text\/html/.test(ct)) continue;
        const svg = c.svg || /svg/.test(ct) || buf.slice(0, 200).toString().includes('<svg');
        if (svg) {
          // rasterise the svg at 512 px with a transparent background
          const p2 = await ctx.newPage();
          await p2.setViewportSize({width: 512, height: 512});
          await p2.setContent(`<html><body style="margin:0;background:transparent"><img id="i" src="data:image/svg+xml;base64,${buf.toString('base64')}" style="width:512px;height:512px;object-fit:contain"></body></html>`);
          await p2.waitForTimeout(300);
          await p2.screenshot({path: task.out, omitBackground: true});
          await p2.close();
          return {ok: true, img: task.out, src: c.url, svg: true};
        }
        fs.writeFileSync(task.out + '.raw', buf);
        return {ok: true, raw: task.out + '.raw', src: c.url, size: c.size, header: !!c.header};
      } catch {}
    }
    return {ok: false, error: 'Kein Logo ≥ 96 px gefunden'};
  } finally {
    await ctx.close();
  }
};

const record = async (browser, task) => {
  const dir = path.dirname(task.out);
  const vw = 720, vh = 720;
  const o = await openPage(browser, task.url, {width: vw, height: vh, dpr: 1, recordVideo: {dir, size: {width: vw, height: vh}}});
  if (o.error) return {ok: false, error: o.error};
  const {ctx, page, t0} = o;
  try {
    await page.evaluate(PROMO_JS);
    await page.evaluate(HIDE_JS, false);
    const start = await page.evaluate(() => {
      const h = [...document.querySelectorAll('h1, main h2, article h2')].find((e) => e.getBoundingClientRect().height > 0);
      return h ? Math.max(0, h.getBoundingClientRect().top + scrollY - 60) : 0;
    });
    await page.evaluate((y) => window.scrollTo(0, y), start);
    await page.waitForTimeout(600);
    // pages re-render after hydration / lazy load: hide promos again right before the take, and keep hiding during it
    await page.evaluate(PROMO_JS);
    await page.evaluate(HIDE_JS, false);
    await page.waitForTimeout(250);
    const startAt = (Date.now() - t0) / 1000;
    // keep hiding promos during the take from the Node side (an in-page observer would need eval, which CSP often blocks)
    let rolling = true;
    const keepHiding = (async () => {
      while (rolling) {
        try { await page.evaluate(PROMO_JS); await page.evaluate(HIDE_JS, false); } catch {}
        await page.waitForTimeout(200);
      }
    })();
    await page.evaluate(async (y0) => {
      const H = Math.max(0, Math.min(1500, document.documentElement.scrollHeight - innerHeight - y0));
      const T = 6000, t0 = performance.now();
      await new Promise((res) => {
        const step = (now) => {
          const q = Math.min(1, (now - t0) / T);
          const e = q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
          window.scrollTo(0, y0 + H * e);
          if (q < 1) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
    }, start);
    rolling = false;
    await keepHiding;
    await page.waitForTimeout(300);
    const video = page.video();
    await ctx.close();
    const raw = await video.path();
    return {ok: true, raw, start: startAt, w: vw, h: vh, domain: new URL(task.url).hostname.replace(/^www\./, '')};
  } catch (e) {
    try { await ctx.close(); } catch {}
    return {ok: false, error: 'Aufnahme fehlgeschlagen: ' + String(e.message || e).slice(0, 120)};
  }
};

// GitHub repo page: stars, description, language, owner avatar (fallback when the public API is rate-limited)
const ghmeta = async (browser, task) => {
  const o = await openPage(browser, task.url, {dpr: 1, width: 1280, height: 900});
  if (o.error) return {ok: false, error: o.error};
  const {ctx, page} = o;
  try {
    const m = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      const num = (v) => { const x = parseFloat(v.replace(/,/g, '')); return /k$/i.test(v) ? Math.round(x * 1000) : /m$/i.test(v) ? Math.round(x * 1e6) : Math.round(x); };
      const st = document.querySelector('#repo-stars-counter-star');
      let stars = st ? num((st.getAttribute('title') || st.textContent || '').trim()) : null;
      if (!stars) { const mm = txt.match(/([\d.,]+[kKmM]?)\s+stars?\b/); stars = mm ? num(mm[1]) : null; }
      let desc = (document.querySelector('meta[property="og:description"]')?.content || document.querySelector('meta[name="description"]')?.content || '').trim();
      desc = desc.replace(/\s*Contribute to [^ ]+ development by creating an account on GitHub\.?$/i, '').replace(/\s+-\s+[\w.-]+\/[\w.-]+$/, '').trim();
      const lm = txt.match(/Languages\s*\n+\s*([^\n]{1,30})\n+\s*[\d.]+%/);
      const owner = location.pathname.split('/')[1];
      const av = [...document.querySelectorAll('img')].find((i) => /avatars\.githubusercontent\.com\/u\//.test(i.src) && (i.alt || '').replace('@', '') === owner)
        || [...document.querySelectorAll('img')].find((i) => /avatars\.githubusercontent\.com\/u\//.test(i.src));
      return {stars: Number.isFinite(stars) && stars > 0 ? stars : null, desc, lang: lm ? lm[1].trim() : '', avatar: av ? av.src : null};
    });
    if (m.avatar) {
      try {
        const r = await ctx.request.get(m.avatar.replace(/([?&])s=\d+/, '$1s=200'), {timeout: 15000});
        if (r.ok()) { fs.writeFileSync(task.out, await r.body()); m.avatarFile = task.out; }
      } catch {}
    }
    return {ok: true, ...m};
  } finally {
    await ctx.close();
  }
};

const browser = await launch();
const results = [];
const run = async (task) => {
  const fn = {shot, logo, record, ghmeta}[task.type];
  let r;
  try {
    r = fn ? await Promise.race([fn(browser, task), new Promise((res) => setTimeout(() => res({ok: false, error: 'Zeitlimit'}), 75000))]) : {ok: false, error: 'unknown task'};
  } catch (e) {
    r = {ok: false, error: String(e.message || e).slice(0, 160)};
  }
  results.push({id: task.id, type: task.type, url: task.url, ...r});
  process.stderr.write(`asset ${task.id} ${task.type}: ${r.ok ? 'ok' : 'FAIL ' + r.error}\n`);
};
const queue = [...tasks];
await Promise.all(Array.from({length: 2}).map(async () => { while (queue.length) await run(queue.shift()); }));
await browser.close();
fs.writeFileSync(outPath, JSON.stringify(results, null, 1));
