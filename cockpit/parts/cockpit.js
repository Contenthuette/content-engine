/* ================= COCKPIT: Aufträge, Accounts, Analytics, Setup ================= */
const ENG={
  higgsfield:{name:'Higgsfield',flow:['Reel','Gesicht','Higgsfield','Freigabe','Metricool + Clipper-Pool'],hf:2,
    hint:'Reels rein, die du gut findest. Claude baut sie mit deinem Gesicht nach.',
    models:[['genjutsu','Genjutsu'],['seedance','Seedance 2.5'],['katana','Katana']]},
  clipping:{name:'Clipping',flow:['Stream','Clips','Schnitt','Freigabe','Metricool'],hf:-1,
    hint:'Claude schneidet alle brauchbaren Clips raus – meist 10 bis 30 pro Stream.',
    styles:[['clean','Clean'],['hype','Hype'],['podcast','Podcast']]},
  avatar:{name:'Avatar',flow:['Skript','Stimme','Avatar','Schnitt','Freigabe'],hf:-1,
    hint:'Thema oder fertiges Skript – Claude schreibt, vertont und schneidet ein Reel mit deinem Avatar.'}
};
const COLS=[['neu','Neu'],['in_arbeit','In Arbeit'],['freigabe','Zur Freigabe'],['geplant','Geplant'],['gepostet','Gepostet']];
const MODEL_NAME={genjutsu:'Genjutsu',seedance:'Seedance 2.5',katana:'Katana'};
const CONNECTORS=[
  {server:'Higgsfield',tool:'balance',label:'Higgsfield',why:'Genjutsu, Seedance 2.5, Katana'},
  {server:'Metricool Social Media Management',tool:'getBrandSettings',label:'Metricool',why:'Accounts, Posten, Zahlen'},
  {server:'Google Drive',tool:'list_recent_files',args:{pageSize:1,excludeContentSnippets:true},label:'Google Drive',why:'Ablage für fertige Videos'},
  {server:'ElevenLabs',tool:'creative_list_voices',args:{context:'Verbindungstest im Content-Cockpit',search:'Leif'},label:'ElevenLabs',why:'Deine Stimme (Avatar-Engine)'}
];
let jobs=[], cfg=null, stats=null, brands=null, brandsErr='', connState={}, credits=null, assetsApi=null, mcpApi=null;
let ctab='cockpit', ceng='higgsfield', busyJ=new Set(), showAllDone={};
try{const e=localStorage.getItem('cc_eng');if(ENG[e])ceng=e}catch(e){}
const pageEl=$('#page'), pgEl=$('#pg');
const nowIso=()=>new Date().toISOString();
const fmtT=iso=>{if(!iso)return'';const d=new Date(iso);if(isNaN(d))return'';return d.toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})};
const slots=()=>(cfg&&cfg.slots)||[];
const brandById=id=>(brands||[]).find(b=>String(b.id)===String(id));
const slotLinked=s=>!!s.brandId;
const initials=t=>String(t||'?').replace(/[^A-Za-zÄÖÜäöü0-9 ]/g,'').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';
function dbErr(e){const c=e&&e.code;if(c==='permission_denied'||c==='not_granted')return'Du hast hier nur Leserechte.';if(c==='quota_exceeded')return'Speicher voll – alte Aufträge entfernen.';if(c==='unavailable')return'Verbindung kurz weg – nochmal versuchen.';return'Konnte nicht speichern ('+(c||'Fehler')+').'}
async function cfgUpdate(patch){if(!db||!cfg)return;try{await db.doc('config/main').update(patch)}catch(e){toast(dbErr(e),true)}}
function toast(t,err){const x=elx('div','toast'+(err?' err':''),t);document.body.appendChild(x);setTimeout(()=>x.remove(),3600)}

/* ---------- Kopf-Badge ---------- */
function updateBadges(){const n=jobs.filter(j=>j.status==='freigabe').length;const b=$('#nb_cockpit');if(b)b.textContent=n||'';const o=setupAll().filter(x=>x.status==='problem').length;const s=$('#nb_setup');if(s)s.textContent=o||''}

/* ---------- Render-Weiche ---------- */
function renderPage(){
  if(!pgEl||pageEl.hidden)return;
  const a=document.activeElement;if(a&&a.closest&&a.closest('#pg')&&(a.matches('textarea,input[type=text],input[type=url]'))&&a.value)return; // nicht beim Tippen neu zeichnen
  pgEl.innerHTML='';updateBadges();
  if(ctab==='cockpit')renderCockpit();
  else if(ctab==='accounts')renderAccounts();
  else if(ctab==='analytics')renderAnalytics();
  else if(ctab==='setup')renderSetup();
}
function head(eyebrow,title,lead,live){const h=elx('div','ph1');const e=elx('span','eyebrow'+(live?' live':''),eyebrow);h.append(e,elx('h1',null,title));if(lead)h.appendChild(elx('p',null,lead));return h}

/* ---------- COCKPIT ---------- */
function kpiRow(){
  const k=elx('div','kpis');const n=s=>jobs.filter(j=>j.status===s).length;
  const today=new Date().toDateString();
  const posted=jobs.filter(j=>j.status==='gepostet'&&j.postedAt&&new Date(j.postedAt).toDateString()===today).length;
  const items=[[n('freigabe'),'warten auf dich',n('freigabe')>0],[n('neu')+n('in_arbeit'),'in Arbeit'],[n('geplant')+n('freigegeben'),'eingeplant'],[posted,'heute gepostet'],[credits!=null?credits:'–','Higgsfield-Credits']];
  for(const [v,l,hot] of items){const d=elx('div','kpi'+(hot?' hot':''));d.append(elx('b',null,String(v)),elx('span',null,l));k.appendChild(d)}
  return k;
}
function renderCockpit(){
  const w=(cfg&&cfg.worker)||{};
  pgEl.appendChild(head(w.lastRun?'Claude zuletzt aktiv · '+fmtT(w.lastRun):'Claude wartet auf „los“ im Chat','Cockpit.','Aufträge rein, Videos freigeben, fertig. Claude erledigt alles dazwischen.',!!w.lastRun));
  pgEl.appendChild(kpiRow());
  const sw=elx('div','sech');const seg=elx('div','seg');
  for(const e of Object.keys(ENG)){const b=elx('button',ceng===e?'on':'');b.type='button';b.append(document.createTextNode(ENG[e].name+(e==='higgsfield'?'-Flow':'')));const c=jobs.filter(j=>j.engine===e&&j.status==='freigabe').length;b.appendChild(elx('span','n',c?String(c):''));b.onclick=()=>{ceng=e;try{localStorage.setItem('cc_eng',e)}catch(x){}renderPage()};seg.appendChild(b)}
  sw.appendChild(seg);const E=ENG[ceng];const fl=elx('div','fline');fl.setAttribute('aria-label','Ablauf');E.flow.forEach((s,i)=>{if(i)fl.appendChild(elx('em',null,'→'));fl.appendChild(elx('span',i===E.hf?'hf':'',s))});sw.appendChild(fl);pgEl.appendChild(sw);if(w.note)pgEl.appendChild(elx('p','hint','Claude: '+w.note));
  const v=elx('div','cview');v.append(orderForm(ceng),boardCard(ceng));pgEl.appendChild(v);
}
function stepBox(n,label,extra,node){const s=elx('div','fstep');const lb=elx('div','lb');lb.append(elx('i',null,String(n)),document.createTextNode(label));if(extra)lb.appendChild(elx('small',null,extra));s.append(lb,node);return s}
function orderForm(e){
  const E=ENG[e];const f=elx('form','cardx');f.id='form_'+e;
  f.appendChild(elx('h3',null,'Neuer Auftrag.'));
  f.appendChild(elx('p','hint',E.hint));
  let n=1,src,model='genjutsu',styleBox,script;
  if(e==='higgsfield'){src=elx('textarea');src.id='src_'+e;src.placeholder='https://www.instagram.com/reel/…\nEin Link pro Zeile';f.appendChild(stepBox(n++,'Reel-Links',null,src));
    f.appendChild(stepBox(n++,'Dein Gesicht',((cfg&&cfg.faces)||[]).length+' Fotos',facesBox()));
    const ms=elx('div','seg');for(const [k,t] of E.models){const b=elx('button',k===model?'on':'',t);b.type='button';b.onclick=()=>{model=k;ms.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b))};ms.appendChild(b)}
    f.appendChild(stepBox(n++,'Modell',null,ms))}
  if(e==='clipping'){src=elx('input');src.type='url';src.id='src_'+e;src.placeholder='Kick-VOD, YouTube- oder Drive-Link';f.appendChild(stepBox(n++,'Stream-Video',null,src));
    styleBox=elx('div','chips');for(const [k,t] of E.styles){const c=elx('label','tchip');const i=elx('input');i.type='checkbox';i.value=k;i.id='sty_'+k;i.checked=k==='clean';c.append(i,document.createTextNode(t));styleBox.appendChild(c)}
    f.appendChild(stepBox(n++,'Schnitt-Stile','alle brauchbaren Clips',styleBox))}
  if(e==='avatar'){script=elx('textarea');script.id='scr_'+e;script.placeholder='Thema in einem Satz – oder das fertige Skript';f.appendChild(stepBox(n++,'Thema / Skript',null,script))}
  // Ziel-Accounts
  const tg=elx('div','chips');
  for(const s of slots()){if(s.role==='reserve')continue;const c=elx('label','tchip');const i=elx('input');i.type='checkbox';i.value=s.id;i.id='tg_'+e+'_'+s.id;i.disabled=!slotLinked(s);if(slotLinked(s)&&s.role==='haupt')i.checked=false;c.append(i,document.createTextNode(s.name));if(!slotLinked(s))c.appendChild(elx('small',null,'nicht verbunden'));c.title=slotLinked(s)?'':'Erst unter „Accounts“ mit einer Metricool-Marke verbinden';tg.appendChild(c)}
  if(!slots().length)tg.appendChild(elx('span','msg','Noch keine Accounts angelegt.'));
  if(cfg&&cfg.clipperPool){const c=elx('label','tchip');const i=elx('input');i.type='checkbox';i.value='pool';i.id='tg_'+e+'_pool';i.checked=true;c.append(i,document.createTextNode('Clipper-Pool'));c.appendChild(elx('small',null,'Drive'));c.title='Video landet im Drive-Ordner, aus dem sich die Clipper bedienen';tg.appendChild(c)}
  f.appendChild(stepBox(n++,'Posten auf',slots().filter(slotLinked).length+' verbunden',tg));
  // Freigabe-Modus
  let mode=(cfg&&cfg.postMode)||'check';const pm=elx('div','seg');
  for(const [k,t] of [['check','Vorher prüfen'],['auto','Autopost']]){const b=elx('button',k===mode?'on':'',t);b.type='button';b.onclick=()=>{mode=k;pm.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b))};pm.appendChild(b)}
  f.appendChild(stepBox(n++,'Freigabe',null,pm));
  const note=elx('textarea');note.id='note_'+e;note.style.minHeight='56px';note.placeholder='Optional: Pointe, Text, was anders sein soll …';f.appendChild(stepBox(n++,'Notiz an Claude','optional',note));
  const r=elx('div','row');const b=elx('button','btn dark','In die Warteschlange');b.type='submit';const msg=elx('span','msg');r.append(b,msg);f.appendChild(r);
  f.onsubmit=async ev=>{ev.preventDefault();if(!db){msg.className='msg err';msg.textContent='Keine Verbindung zur Datenbank – Seite neu laden.';return}
    const targets=[...tg.querySelectorAll('input:checked')].map(i=>i.value);
    const base={engine:e,status:'neu',postMode:mode,note:note.value.trim(),targets,createdAt:nowIso(),updatedAt:nowIso(),log:[{t:nowIso(),msg:'Auftrag angelegt'}]};
    let docs=[];
    if(e==='higgsfield'){const links=src.value.split(/\s+/).map(s=>s.trim()).filter(s=>/^https?:\/\//i.test(s));if(!links.length){msg.className='msg err';msg.textContent='Mindestens einen Link einfügen (beginnt mit https://).';return}
      if(!((cfg&&cfg.faces)||[]).length){msg.className='msg err';msg.textContent='Erst Fotos von deinem Gesicht hinzufügen.';return}
      docs=links.map(l=>({...base,src:l,model,title:shortLink(l)}))}
    if(e==='clipping'){const l=src.value.trim();if(!/^https?:\/\//i.test(l)){msg.className='msg err';msg.textContent='Bitte einen Link zum Stream-Video einfügen.';return}
      docs=[{...base,src:l,title:'Stream '+new Date().toLocaleDateString('de-DE'),styles:[...styleBox.querySelectorAll('input:checked')].map(i=>i.value),count:'max'}]}
    if(e==='avatar'){const s=script.value.trim();if(!s){msg.className='msg err';msg.textContent='Thema oder Skript fehlt.';return}docs=[{...base,script:s,title:s.slice(0,70)}]}
    if(!targets.length)base.log.push({t:nowIso(),msg:'Noch kein Ziel-Account gewählt'});
    b.disabled=true;msg.className='msg';msg.textContent='Speichert…';
    try{for(const d of docs)await db.collection('jobs').add(d);if(mode!==((cfg&&cfg.postMode)||'check'))cfgUpdate({postMode:mode});
      if(src)src.value='';if(script)script.value='';note.value='';msg.className='msg okm';msg.textContent=docs.length+(docs.length===1?' Auftrag':' Aufträge')+' in der Warteschlange.'}
    catch(err){msg.className='msg err';msg.textContent=dbErr(err)}
    b.disabled=false};
  return f;
}
function facesBox(){
  const box=elx('div','faces');const faces=(cfg&&cfg.faces)||[];
  for(const fc of faces){const d=elx('div','face');const im=elx('img');im.src='/_blob/'+fc.id;im.alt='Gesichtsfoto';im.loading='lazy';d.appendChild(im);
    if(assetsApi){const x=elx('button',null,'×');x.type='button';x.title='Foto entfernen';x.setAttribute('aria-label','Foto entfernen');x.onclick=async()=>{await cfgUpdate({faces:faces.filter(f=>f.id!==fc.id)});try{await assetsApi.delete(fc.id)}catch(e){}};d.appendChild(x)}
    box.appendChild(d)}
  if(assetsApi){const lab=elx('label','addface','+');lab.title='Fotos hinzufügen';const inp=elx('input');inp.type='file';inp.accept='image/*';inp.multiple=true;inp.id='faceUpload';inp.hidden=true;lab.appendChild(inp);
    inp.onchange=async()=>{const files=[...inp.files].slice(0,10);if(!files.length)return;lab.textContent='…';const added=[];
      for(const f of files){try{const r=await assetsApi.upload(f);added.push({id:r.id,name:f.name,at:nowIso()})}catch(e){toast('Foto „'+f.name+'“ ging nicht ('+(e&&e.code||'Fehler')+').',true)}}
      if(added.length)await cfgUpdate({faces:[...((cfg&&cfg.faces)||[]),...added]});renderPage()};
    box.appendChild(lab)}
  else if(!faces.length)box.appendChild(elx('span','msg','Fotos hinzufügen geht nur mit Bearbeitungsrechten.'));
  return box;
}
function shortLink(u){try{const x=new URL(u);const h=x.hostname.replace('www.','');const parts=x.pathname.split('/').filter(Boolean);if(/instagram/.test(h)&&parts.length>1)return(parts[0]==='p'?'Post ':'Reel ')+parts[1];if(/tiktok/.test(h))return'TikTok '+(parts[parts.length-1]||'').slice(0,14);if(/youtu/.test(h))return'YouTube '+(x.searchParams.get('v')||parts[parts.length-1]||'').slice(0,14);return h+'/'+parts.join('/').slice(0,24)}catch(e){return u.slice(0,40)}}
function slotName(id){if(id==='pool')return'Clipper-Pool';const s=slots().find(x=>x.id===id);return s?s.name:id}
function boardCard(e){
  const c=elx('div','cardx');const h=elx('div','sech');h.appendChild(elx('h3',null,'Strecke.'));c.appendChild(h);
  const list=jobs.filter(j=>j.engine===e);const board=elx('div','board');
  for(const [s,t] of COLS){const col=elx('div','col');col.dataset.s=s;const inCol=list.filter(j=>s==='geplant'?(j.status==='geplant'||j.status==='freigegeben'):j.status===s);
    const hh=elx('div','colh');hh.append(elx('b',null,t),elx('span','c',String(inCol.length)));col.appendChild(hh);
    const lim=s==='gepostet'&&!showAllDone[e]?6:999;
    if(!inCol.length)col.appendChild(elx('div','cempty',{neu:'Nichts in der Warteschlange.',in_arbeit:'Gerade nichts in Arbeit.',freigabe:'Nichts zum Freigeben.',geplant:'Nichts eingeplant.',gepostet:'Noch nichts gepostet.'}[s]));
    for(const j of inCol.slice(0,lim))col.appendChild(jobCard(j));
    if(inCol.length>lim){const bb=elx('button','btn ghost sm',`Alle ${inCol.length} zeigen`);bb.type='button';bb.onclick=()=>{showAllDone[e]=true;renderPage()};col.appendChild(bb)}
    board.appendChild(col)}
  c.appendChild(board);
  const off=list.filter(j=>j.status==='abgelehnt'||j.status==='fehler');
  if(off.length){const d=elx('details');d.appendChild(elx('summary','msg',`Abgelehnt / Fehler (${off.length})`));const g=elx('div','board');g.style.gridTemplateColumns='repeat(auto-fill,minmax(230px,1fr))';for(const j of off)g.appendChild(jobCard(j));d.appendChild(g);c.appendChild(d)}
  return c;
}
function jobCard(j){
  const c=elx('article','job');c.dataset.s=j.status;c.appendChild(elx('div','t',j.title||'Auftrag'));
  const tags=elx('div','tags');
  if(j.model)tags.appendChild(elx('span','tg m',MODEL_NAME[j.model]||j.model));
  if(j.styles&&j.styles.length)tags.appendChild(elx('span','tg m',j.styles.join(' · ')));
  if(j.postMode==='auto')tags.appendChild(elx('span','tg auto','Autopost'));
  for(const t of j.targets||[])tags.appendChild(elx('span','tg',slotName(t)));
  if(j.status==='fehler')tags.appendChild(elx('span','tg err','Fehler'));
  if(j.status==='abgelehnt')tags.appendChild(elx('span','tg err','Abgelehnt'));
  if(j.status==='freigegeben')tags.appendChild(elx('span','tg st','Freigegeben – wird eingeplant'));
  if(j.result&&j.result.credits)tags.appendChild(elx('span','tg',j.result.credits+' Credits'));
  if(j.clips)tags.appendChild(elx('span','tg',j.clips+' Clips'));
  c.appendChild(tags);
  if(j.src){const a=elx('a',null,'Quelle öffnen ↗');a.href=j.src;a.target='_blank';a.rel='noopener';c.appendChild(a)}
  if(j.status==='in_arbeit'){const p=elx('div','meta');p.append(elx('span','pulse'),document.createTextNode(j.step||'läuft …'));c.appendChild(p)}
  if(j.error)c.appendChild(elx('div','msg err',j.error));
  const vid=j.result&&j.result.assetId;
  if(vid&&['freigabe','freigegeben','geplant','gepostet','abgelehnt'].includes(j.status)){const v=elx('video');v.src='/_blob/'+vid;v.controls=true;v.preload='metadata';v.playsInline=true;c.appendChild(v)}
  else if(j.result&&j.result.url){const a=elx('a',null,'Video öffnen ↗');a.href=j.result.url;a.target='_blank';a.rel='noopener';c.appendChild(a)}
  if(j.status==='freigabe'){
    const ta=elx('textarea');ta.id='cap_'+j.id;ta.value=j.caption||'';ta.placeholder='Caption';c.appendChild(ta);
    const acts=elx('div','acts');const ok=elx('button','btn ok sm','Freigeben');const no=elx('button','btn sm','Ablehnen');const re=elx('button','btn ghost sm','Neu machen');
    ok.onclick=()=>act(j,{status:'freigegeben',caption:ta.value,approvedAt:nowIso()},'Freigegeben');
    no.onclick=()=>act(j,{status:'abgelehnt',caption:ta.value},'Abgelehnt');
    re.onclick=()=>{if(c.querySelector('.why'))return;const w=elx('textarea','why');w.id='why_'+j.id;w.placeholder='Was soll anders werden?';c.insertBefore(w,acts);const send=elx('button','btn dark sm','Mit Notiz neu machen');send.onclick=()=>act(j,{status:'neu',note:((j.note?j.note+'\n':'')+'Neu machen: '+w.value.trim()).trim(),result:null},'Zurück in die Warteschlange');acts.appendChild(send);w.focus()};
    acts.append(ok,no,re);c.appendChild(acts)}
  if(['neu','fehler','abgelehnt'].includes(j.status)){const acts=elx('div','acts');
    if(j.status!=='neu'){const rq=elx('button','btn sm','Nochmal versuchen');rq.onclick=()=>act(j,{status:'neu',error:null},'Zurück in die Warteschlange');acts.appendChild(rq)}
    const del=elx('button','btn ghost sm','Entfernen');del.onclick=async()=>{if(del.dataset.arm){try{await db.doc('jobs/'+j.id).delete()}catch(e){toast(dbErr(e),true)}}else{del.dataset.arm='1';del.textContent='Wirklich entfernen?'}};acts.appendChild(del);c.appendChild(acts)}
  const parts=['angelegt '+fmtT(j.createdAt)];if(j.scheduledAt)parts.push('geplant '+fmtT(j.scheduledAt));if(j.postedAt)parts.push('gepostet '+fmtT(j.postedAt));c.appendChild(elx('div','meta',parts.join(' · ')));
  if(j.log&&j.log.length>1){const d=elx('details');d.appendChild(elx('summary',null,'Verlauf'));const lg=elx('div','log');for(const l of j.log.slice(-8))lg.appendChild(elx('div',null,fmtT(l.t)+' – '+l.msg));d.appendChild(lg);c.appendChild(d)}
  return c;
}
async function act(j,patch,logMsg){if(busyJ.has(j.id))return;busyJ.add(j.id);
  try{await db.doc('jobs/'+j.id).update({...patch,updatedAt:nowIso(),log:[...(j.log||[]),{t:nowIso(),msg:logMsg}].slice(-30)})}catch(e){toast(dbErr(e),true)}finally{busyJ.delete(j.id)}}

/* ---------- ACCOUNTS ---------- */
function netsOf(b){const n=(b&&b.networksData)||{};const out=[];if(n.instagramData)out.push(['ig','@'+n.instagramData]);if(n.tiktokData)out.push(['tt','@'+n.tiktokData]);if(n.youtubeData)out.push(['yt',typeof n.youtubeData==='string'&&!/^UC[\w-]{20,}$/.test(n.youtubeData)?n.youtubeData:'YouTube']);return out}
function avatarFor(name,brand){const a=elx('div','av');const logo=brand&&cfg&&cfg.brandLogos&&cfg.brandLogos[String(brand.id)];if(logo){const im=elx('img');im.src='/_blob/'+logo;im.alt='';a.appendChild(im)}else a.textContent=initials(brand?brand.label:name);return a}
function renderAccounts(){
  const linked=slots().filter(slotLinked).length;
  pgEl.appendChild(head('Metricool · '+(brands?brands.length+' Marken':'lädt …'),'Accounts.',`${linked} von ${slots().filter(s=>s.role!=='reserve').length} Account-Sets verbunden. Jedes Set postet auf Instagram, TikTok und YouTube.`));
  // Sets
  const s1=elx('div');s1.style.display='grid';s1.style.gap='14px';const h=elx('div','sech');const hl=elx('div');hl.append(elx('h2',null,'Deine Account-Sets.'),elx('p',null,'Jedes Set mit einer Metricool-Marke verbinden – dann kann Claude darauf posten.'));h.appendChild(hl);
  const rb=elx('button','btn sm','Metricool neu laden');rb.type='button';rb.onclick=()=>loadBrands(true);h.appendChild(rb);s1.appendChild(h);
  if(brandsErr)s1.appendChild(elx('p','msg err',brandsErr));
  const grid=elx('div','slots');const used=new Set(slots().map(s=>String(s.brandId||'')));
  slots().forEach((s,i)=>{const b=s.brandId?brandById(s.brandId):null;const card=elx('div','slot'+(slotLinked(s)?'':' off'));
    const sh=elx('div','sh');const av=slotLinked(s)?avatarFor(s.name,b):elx('div','av ghost','+');const nm=elx('div','nm');nm.append(elx('b',null,s.name),elx('span',null,b?b.label:(s.brandId?'Marke #'+s.brandId:'noch keine Marke')));sh.append(av,nm);
    sh.appendChild(elx('span','pill '+(s.role==='haupt'?'dark':slotLinked(s)?'ok':'no'),s.role==='haupt'?'Haupt':s.role==='reserve'?'Reserve':slotLinked(s)?'verbunden':'offen'));card.appendChild(sh);
    const nets=elx('div','nets');const ns=b?netsOf(b):[];const have=new Set(ns.map(x=>x[0]));for(const [k,t] of ns)nets.appendChild(elx('span','net '+k,t));for(const [k,t] of [['ig','Instagram'],['tt','TikTok'],['yt','YouTube']])if(!have.has(k))nets.appendChild(elx('span','net miss '+k,t+' fehlt'));card.appendChild(nets);
    const sel=elx('select');sel.id='link_'+s.id;sel.setAttribute('aria-label','Metricool-Marke für '+s.name);const o0=elx('option',null,'– Marke wählen –');o0.value='';sel.appendChild(o0);
    for(const br of brands||[]){const o=elx('option',null,br.label+(used.has(String(br.id))&&String(br.id)!==String(s.brandId||'')?' (vergeben)':''));o.value=String(br.id);sel.appendChild(o)}
    if(s.brandId&&!brandById(s.brandId)){const o=elx('option',null,'Marke #'+s.brandId);o.value=String(s.brandId);sel.appendChild(o)}
    sel.value=s.brandId?String(s.brandId):'';sel.disabled=!brands||readOnly;
    sel.onchange=()=>{const v=sel.value;cfgUpdate({slots:slots().map((x,k)=>k===i?{...x,brandId:v?Number(v)||v:null}:x)})};card.appendChild(sel);grid.appendChild(card)});
  s1.appendChild(grid);pgEl.appendChild(s1);
  // Clipper-Pool
  if(cfg&&cfg.clipperPool){const cp=cfg.clipperPool;const s4=elx('div','cardx');const hh=elx('div','sech');const hl=elx('div');hl.append(elx('h3',null,'Clipper-Pool.'),elx('p','hint','Jedes freigegebene Video landet zusätzlich in diesem Drive-Ordner. Clipper mit eigenen Accounts posten es und bekommen '+(cp.rate||'1 € pro 1.000 Views')+'.'));hh.appendChild(hl);
    const a=elx('a','btn sm','Ordner öffnen ↗');a.href=cp.url;a.target='_blank';a.rel='noopener';hh.appendChild(a);s4.appendChild(hh);
    const st=elx('div','nets');st.append(elx('span','pill '+(cp.shared?'ok':'warn'),cp.shared?'für Clipper freigegeben':'noch nicht geteilt'),elx('span','pill no',(cp.clippers||0)+' Clipper aktiv'),elx('span','pill no',jobs.filter(j=>(j.targets||[]).includes('pool')&&['geplant','gepostet'].includes(j.status)).length+' Videos im Pool'));s4.appendChild(st);
    s4.appendChild(elx('p','hint','Pflicht für Clipper: @leifdunkelmann in Caption oder angepinntem Kommentar. Bezahlt werden nur geprüfte Views.'));pgEl.appendChild(s4)}
  // Alle Marken
  const s2=elx('div');s2.style.display='grid';s2.style.gap='14px';const h2=elx('div','sech');const h2l=elx('div');h2l.append(elx('h2',null,'In Metricool.'),elx('p',null,'Alle Marken in deinem Metricool-Konto. Kundenmarken bleiben unberührt.'));h2.appendChild(h2l);s2.appendChild(h2);
  if(!brands){s2.appendChild(elx('div','emptyx',null)).append(elx('b',null,mcpApi?'Lädt Metricool …':'Metricool nicht erreichbar'),elx('span',null,mcpApi?'Beim ersten Mal fragt Claude nach deiner Freigabe für Metricool.':'Diese Ansicht braucht den Metricool-Connector in claude.ai.'))}
  else{const g=elx('div','slots');for(const b of brands){const slot=slots().find(s=>String(s.brandId)===String(b.id));const card=elx('div','slot');const sh=elx('div','sh');const nm=elx('div','nm');nm.append(elx('b',null,b.label),elx('span',null,'Marke #'+b.id));sh.append(avatarFor(b.label,b),nm);sh.appendChild(elx('span','pill '+(slot?'ok':'no'),slot?slot.name:'nicht im Plan'));card.appendChild(sh);
      const nets=elx('div','nets');const ns=netsOf(b);if(!ns.length)nets.appendChild(elx('span','net miss','keine Kanäle verbunden'));for(const [k,t] of ns)nets.appendChild(elx('span','net '+k,t));card.appendChild(nets);g.appendChild(card)}s2.appendChild(g)}
  pgEl.appendChild(s2);
  // Weitere Kanäle
  const ch=((cfg&&cfg.setup)||[]).filter(x=>x.group==='kanal');
  if(ch.length){const s3=elx('div','cardx');s3.appendChild(elx('h3',null,'Weitere Kanäle.'));s3.appendChild(checklist(ch));pgEl.appendChild(s3)}
}
async function loadBrands(force){
  if(!mcpApi){brandsErr='';return}
  try{const r=await mcpApi.callTool('Metricool Social Media Management','getBrandSettings',{},force?{cache:{refresh:true,gcTime:600000}}:{cache:{staleTime:120000,gcTime:600000}});const p=r.payload||{};brands=Array.isArray(p.data)?p.data:Array.isArray(p)?p:[];brandsErr='';connState['Metricool Social Media Management']='connected'}
  catch(e){brands=null;const c=e&&e.code;brandsErr=c==='server_not_connected'?'Metricool ist in claude.ai nicht verbunden (Einstellungen → Connectors).':c==='needs_reauth'?'Metricool neu verbinden (claude.ai → Einstellungen → Connectors).':c==='not_in_manifest'?'Metricool-Zugriff für diese Seite abgelehnt.':'Metricool gerade nicht erreichbar.';if(c)connState['Metricool Social Media Management']=c}
  renderPage();
}
async function loadCredits(){if(!mcpApi)return;try{const r=await mcpApi.callTool('Higgsfield','balance',{},{cache:{staleTime:60000,gcTime:600000}});const p=r.payload||{};if(typeof p.credits==='number'){credits=Math.round(p.credits*10)/10;connState['Higgsfield']='connected'}}catch(e){if(e&&e.code)connState['Higgsfield']=e.code}renderPage()}

/* ---------- ANALYTICS ---------- */
function renderAnalytics(){
  pgEl.appendChild(head(stats&&stats.updatedAt?'Stand '+fmtT(stats.updatedAt):'Noch keine Zahlen','Analytics.','Views, Follower und Posts über alle Account-Sets – Claude holt die Zahlen täglich aus Metricool.'));
  if(!stats||!stats.totals){const e=elx('div','emptyx');e.append(elx('b',null,'Noch keine Zahlen.'),elx('span',null,'Sobald die ersten Videos auf verbundenen Accounts laufen, trägt Claude hier täglich Views, Follower und Posts ein – pro Account-Set und gesamt.'));pgEl.appendChild(e);return}
  const t=stats.totals;const k=elx('div','kpis');for(const [v,l] of [[t.views7,'Views (7 Tage)'],[t.followers,'Follower gesamt'],[t.newFollowers7,'neue Follower (7 Tage)'],[t.posts7,'Posts (7 Tage)']]){const d=elx('div','kpi');d.append(elx('b',null,v==null?'–':Number(v).toLocaleString('de-DE')),elx('span',null,l));k.appendChild(d)}pgEl.appendChild(k);
  const daily=(stats.daily||[]).slice(-14);
  if(daily.length){const c=elx('div','cardx');c.appendChild(elx('h3',null,'Views pro Tag.'));c.appendChild(barChart(daily));pgEl.appendChild(c)}
  const per=stats.perSlot||{};const ids=Object.keys(per);
  if(ids.length){const w=elx('div','tbx');const tb=elx('table');const th=elx('thead');const tr=elx('tr');for(const [h,r] of [['Account-Set',0],['Follower',1],['Views (7 T.)',1],['Posts (7 T.)',1],['Bestes Video',0]])tr.appendChild(elx('th',r?'r':'',h));th.appendChild(tr);tb.appendChild(th);
    const bd=elx('tbody');ids.sort((a,b)=>(per[b].views7||0)-(per[a].views7||0)).forEach(id=>{const p=per[id];const r=elx('tr');r.append(elx('td',null,slotName(id)),elx('td','r',(p.followers??'–').toLocaleString('de-DE')),elx('td','r',(p.views7??'–').toLocaleString('de-DE')),elx('td','r',String(p.posts7??'–')),elx('td',null,p.best||'–'));bd.appendChild(r)});tb.appendChild(bd);w.appendChild(tb);pgEl.appendChild(w)}
}
function barChart(data){
  const W=720,H=220,pl=44,pb=28,pt=10,pr=8;const max=Math.max(1,...data.map(d=>d.views||0));const step=niceStep(max);const top=Math.ceil(max/step)*step;
  const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('class','bars');svg.setAttribute('role','img');svg.setAttribute('aria-label','Views pro Tag');
  const mk=(t,a)=>{const e=document.createElementNS(ns,t);for(const k in a)e.setAttribute(k,a[k]);svg.appendChild(e);return e};
  for(let v=0;v<=top;v+=step){const y=pt+(H-pt-pb)*(1-v/top);mk('line',{x1:pl,x2:W-pr,y1:y,y2:y,stroke:'#e8e8ed'});const tx=mk('text',{x:pl-6,y:y+4,'text-anchor':'end','font-size':11,fill:'#6e6e73'});tx.textContent=v>=1000?(v/1000).toLocaleString('de-DE')+'k':String(v)}
  const bw=(W-pl-pr)/data.length;data.forEach((d,i)=>{const h=(H-pt-pb)*((d.views||0)/top);const x=pl+i*bw+bw*.18;mk('rect',{x,y:H-pb-h,width:bw*.64,height:Math.max(h,1),rx:4,fill:i===data.length-1?'#0a0a0a':'#c7c7cc'});
    if(i%Math.ceil(data.length/7)===0||i===data.length-1){const tx=mk('text',{x:x+bw*.32,y:H-8,'text-anchor':'middle','font-size':11,fill:'#6e6e73'});const dd=new Date(d.d);tx.textContent=isNaN(dd)?d.d:dd.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})}});
  return svg;
}
function niceStep(m){const raw=m/4;const p=Math.pow(10,Math.floor(Math.log10(raw)));const n=raw/p;return (n<=1?1:n<=2?2:n<=5?5:10)*p}

/* ---------- SETUP ---------- */
function checklist(items){const box=elx('div','chk');
  for(const it of items){const r=elx('div','ck');const st=it.status||'offen';const ic=elx('span','ic '+(st==='erledigt'?'ok':st==='laeuft'?'warn':st==='problem'?'bad':'no'),st==='erledigt'?'✓':st==='laeuft'?'…':st==='problem'?'!':'');
    const tx=elx('div','tx');tx.appendChild(elx('b',null,it.title));const sub=[it.owner?it.owner+' ':'',it.note||''].join('').trim();if(sub)tx.appendChild(elx('span',null,sub));r.append(ic,tx);
    if(it.id&&!it.auto&&!readOnly&&cfg){const b=elx('button','btn sm'+(st==='erledigt'?' ghost':''),st==='erledigt'?'Wieder öffnen':'Erledigt');b.type='button';b.onclick=()=>cfgUpdate({setup:(cfg.setup||[]).map(x=>x.id===it.id?{...x,status:st==='erledigt'?'offen':'erledigt'}:x)});r.appendChild(b)}
    else r.appendChild(elx('span','pill '+(st==='erledigt'?'ok':st==='laeuft'?'warn':st==='problem'?'bad':'no'),st==='erledigt'?'erledigt':st==='laeuft'?'läuft':st==='problem'?'Problem':'offen'));
    box.appendChild(r)}
  return box}
function connItems(){
  return CONNECTORS.map(c=>{const s=connState[c.server];let status='offen',note=c.why;
    if(s==='connected'){status='erledigt';if(c.server==='Higgsfield'&&credits!=null)note+=' · '+credits+' Credits'}
    else if(s==='needs_reauth'){status='problem';note='Neu verbinden: claude.ai → Einstellungen → Connectors'}
    else if(s==='server_not_connected'||s==='absent'){status='problem';note='Nicht verbunden: claude.ai → Einstellungen → Connectors'}
    else if(s==='not_in_manifest'){status='problem';note='Für diese Seite nicht freigegeben'}
    else if(s==='unknown'){status='laeuft';note=c.why+' · wird beim ersten Zugriff geprüft'}
    else if(!mcpApi){status='offen';note=c.why+' · Prüfung nur im Claude-Viewer'}
    return {title:c.label,owner:'',note,status,auto:true}})}
function setupAuto(){
  const faces=((cfg&&cfg.faces)||[]).length;const main=slots().find(s=>s.role==='haupt');const subs=slots().filter(s=>s.role==='sub');const subsL=subs.filter(slotLinked).length;
  return [{title:'Gesichtsfotos hinterlegt',note:faces+' Fotos (mindestens 3, verschiedene Winkel)',status:faces>=3?'erledigt':faces?'laeuft':'offen',auto:true},
    {title:'Hauptaccount mit Metricool verbunden',note:main&&main.brandId?(brandById(main.brandId)||{}).label||'verbunden':'Marke für @leifdunkelmann in Metricool anlegen und hier verknüpfen',status:main&&main.brandId?'erledigt':'offen',auto:true},
    {title:'Sub-Account-Sets verbunden',note:subsL+' von '+subs.length+' Sets mit einer Metricool-Marke verknüpft',status:subsL>=subs.length&&subs.length?'erledigt':subsL?'laeuft':'offen',auto:true}]}
function setupAll(){return [...connItems(),...setupAuto(),...((cfg&&cfg.setup)||[])]}
function renderSetup(){
  const auto=setupAuto();const manual=((cfg&&cfg.setup)||[]);const all=setupAll();const done=all.filter(x=>x.status==='erledigt').length;
  pgEl.appendChild(head(done+' von '+all.length+' erledigt','Setup.','Was steht, was fehlt. Grün ist erledigt, Gelb läuft, Rot braucht dich.'));
  const pr=elx('div','prog');const bar=elx('i');bar.style.width=(all.length?done/all.length*100:0)+'%';pr.appendChild(bar);pgEl.appendChild(pr);
  const g=elx('div','grid2x');
  const c1=elx('div','cardx');c1.appendChild(elx('h3',null,'Verbindungen.'));c1.appendChild(elx('p','hint','Connectors in claude.ai, die das Cockpit braucht.'));c1.appendChild(checklist(connItems()));
  if(mcpApi){const b=elx('button','btn sm','Jetzt prüfen');b.type='button';b.onclick=()=>{checkConnectors(true)};c1.appendChild(b)}
  const c2=elx('div','cardx');c2.appendChild(elx('h3',null,'Accounts & Gesicht.'));c2.appendChild(checklist(auto));
  g.append(c1,c2);
  for(const [grp,title] of [['deal','Deal & Budget.'],['kanal','Kanäle & Links.'],['clipper','Clipper.'],['technik','Technik & Automatik.']]){const it=manual.filter(x=>x.group===grp);if(!it.length)continue;const c=elx('div','cardx');c.appendChild(elx('h3',null,title));c.appendChild(checklist(it));g.appendChild(c)}
  pgEl.appendChild(g);
}
async function checkConnectors(probe){
  if(!mcpApi)return;
  try{const r=await mcpApi.listTools();const seen=new Set();for(const s of r.servers||[]){if(s.kind==='artifact')continue;seen.add(s.server);if(!(connState[s.server]==='connected'&&s.authStatus==='unknown'))connState[s.server]=s.authStatus}
    for(const c of CONNECTORS)if(!seen.has(c.server))connState[c.server]='absent'}catch(e){}
  if(probe){for(const c of CONNECTORS){if(connState[c.server]==='absent')continue;try{if(c.server==='Higgsfield'){await loadCredits();continue}if(c.server==='Metricool Social Media Management'){await loadBrands(true);continue}await mcpApi.callTool(c.server,c.tool,c.args||{},{cache:{staleTime:300000,gcTime:600000}});connState[c.server]='connected'}catch(e){if(e&&e.code)connState[c.server]=e.code==='tool_error'?'connected':e.code}}}
  renderPage();
}

/* ---------- Start ---------- */
async function startCockpit(){
  const api=window.claude;
  db.collection('jobs').orderBy('createdAt','desc').limit(500).onSnapshot(s=>{jobs=s.docs.map(d=>({id:d.id,...d.data()}));updateBadges();renderPage()},()=>toast('Verbindung zu den Aufträgen verloren – Seite neu laden.',true));
  db.doc('config/main').onSnapshot(s=>{cfg=s.exists?clone(s.data()):null;renderPage()},()=>{});
  db.doc('stats/main').onSnapshot(s=>{stats=s.exists?s.data():null;if(ctab==='analytics')renderPage()},()=>{});
  try{assetsApi=await api.use('assets')}catch(e){assetsApi=null}
  try{mcpApi=await api.use('mcp')}catch(e){mcpApi=null}
  if(mcpApi){checkConnectors(false);loadCredits();loadBrands(false)}
  renderPage();
}
