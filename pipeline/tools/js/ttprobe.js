const {chromium}=require('playwright-core');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--disable-blink-features=AutomationControlled']});
const ctx=await b.newContext({viewport:{width:1280,height:1600},userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',locale:'en-US'});
const p=await ctx.newPage();
for (const u of process.argv.slice(2)){ await p.goto(u,{waitUntil:'domcontentloaded',timeout:45000}).catch(e=>console.log('ERR',e.message));
 await p.waitForTimeout(6000); for(let i=0;i<4;i++){await p.mouse.wheel(0,3000);await p.waitForTimeout(1500);}
 const links=await p.$$eval('a[href*="/video/"]',as=>[...new Set(as.map(a=>a.href))]);
 const views=await p.$$eval('[data-e2e="video-views"]',e=>e.map(x=>x.textContent)).catch(()=>[]);
 console.log(u, links.length, 'views:', views.length, JSON.stringify(links.slice(0,5)), JSON.stringify(views.slice(0,5)));}
await b.close();})();
