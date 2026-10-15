import sys
src=open('parts/base.html').read()
css=open('parts/cockpit.css').read()
js=open('parts/cockpit.js').read()
def rep(a,b):
    global src
    assert a in src, a[:80]
    src=src.replace(a,b,1)
rep('<title>Content-Flow</title>','<title>Content-Cockpit</title>')
rep('family=Figtree:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600','family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600')
rep("/* Layout: n8n-artiger Node-Editor","/* Layout: Contenthütte-Look (Weiß, Schwarz, #f5f5f7, Inter). Kopf mit Bereichen; Cockpit-Seiten scrollen, Flows sind ein n8n-artiger Node-Editor.\n   Node-Editor:")
rep("""  --bg:#ffffff; --dots:#d5dae3; --panel:#f7f8fa; --panel2:#ffffff; --panel3:#f1f3f6;
  --line:#e1e5ec; --fg:#151a23; --muted:#667085; --brand:#ef3b4a;
  --ok:#16a36a; --warn:#d98b0b; --bad:#e5394b; --idle:#98a1b2;
  --f-ui:'Figtree',system-ui,-apple-system,'Segoe UI',sans-serif;""","""  --bg:#ffffff; --dots:#dcdce1; --panel:#f5f5f7; --panel2:#ffffff; --panel3:#efeff2;
  --line:#e8e8ed; --line2:#d2d2d7; --fg:#0a0a0a; --muted:#6e6e73; --brand:#0a0a0a; --red:#e0323f; --info:#2457c5;
  --ok:#16a36a; --warn:#d98b0b; --bad:#d92d3a; --idle:#aeaeb2;
  --f-ui:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;""")
rep(".btn.on{border-color:var(--brand);color:var(--brand);background:color-mix(in srgb,var(--brand) 9%,var(--panel2))}",".btn.on{border-color:var(--fg);color:#fff;background:var(--fg)}")
toast=".toast{position:fixed;left:50%;transform:translateX(-50%);bottom:max(20px,env(safe-area-inset-bottom,0px));background:var(--fg);color:#fff;border-radius:999px;padding:10px 18px;font-size:14px;z-index:50;box-shadow:0 8px 30px rgba(0,0,0,.18);max-width:calc(100vw - 32px)}.toast.err{background:var(--bad)}\n"
rep("@media (prefers-reduced-motion:reduce){.flow,.st-aktiv .sdot{animation:none}.prog i{transition:none}}\n</style>",
    "@media (prefers-reduced-motion:reduce){.flow,.st-aktiv .sdot{animation:none}.prog i{transition:none}}\n"+css+toast+"</style>")
a=src.index('  <header>');b=src.index('  </header>')+len('  </header>')
src=src[:a]+open('parts/header.html').read().rstrip('\n')+src[b:]
rep('  <section class="plan" id="plan" hidden>','  <section class="page" id="page"><div class="pg" id="pg"></div></section>\n  <section class="plan" id="plan" hidden>')
rep('  <div class="main">','  <div class="main" hidden>')
s=src.index('function showTab(t){');e0="document.querySelectorAll('.tabs [data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));";e=src.index(e0)+len(e0)
src=src[:s]+open('parts/showtab.js').read().rstrip('\n')+src[e:]
rep("/* ---------- Plan: Vorbereitung, Routinen, Budget, Optimierungen ---------- */", js+"\n/* ---------- Plan: Vorbereitung, Routinen, Budget, Optimierungen ---------- */")
a=src.index("try{const t0=location.hash");b=src.index("\n",a)
src=src[:a]+open('parts/init.js').read().rstrip('\n')+src[b:]
rep("  subscribeFlow();\n  startPlan();\n}","  subscribeFlow();\n  startPlan();\n  startCockpit();\n}")
open('app.html','w').write(src);print('ok',len(src))
