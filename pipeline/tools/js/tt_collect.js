// TikTok-Tag-Seiten rendern (headless Chromium) und Video-Links einsammeln.
// node pipeline/tools/js/tt_collect.js <out.json> <tag> [<tag> …]   (Tag ohne #; „d:slug“ = Discover-Seite)
const {chromium} = require('playwright-core');
const fs = require('fs');
const EXE = process.env.CHROME_FULL || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
(async () => {
  const [out, ...tags] = process.argv.slice(2);
  const b = await chromium.launch({executablePath: EXE, args: ['--disable-blink-features=AutomationControlled']});
  const ctx = await b.newContext({viewport: {width: 1280, height: 1600}, locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'});
  const p = await ctx.newPage();
  const res = {};
  for (const t of tags) {
    const u = t.startsWith('d:') ? `https://www.tiktok.com/discover/${t.slice(2)}` : `https://www.tiktok.com/tag/${encodeURIComponent(t)}`;
    try {
      await p.goto(u, {waitUntil: 'domcontentloaded', timeout: 45000});
      await p.waitForTimeout(5000);
      for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 3500); await p.waitForTimeout(1300); }
      res[t] = await p.$$eval('a[href*="/video/"]', (as) => [...new Set(as.map((a) => a.href.split('?')[0]))]);
    } catch (e) { res[t] = []; }
    console.log(t, res[t].length);
  }
  fs.writeFileSync(out, JSON.stringify(res));
  await b.close();
})();
