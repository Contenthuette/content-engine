const PAGES=['cockpit','accounts','analytics','setup'];
function showTab(t){if(![...PAGES,'flows','plan'].includes(t))t='cockpit';const isFlow=t==='flows';
  mainEl.hidden=!isFlow;planEl.hidden=t!=='plan';pageEl.hidden=!PAGES.includes(t);
  $('#flowNav').hidden=!isFlow;$('#flowTools').hidden=!isFlow;$('#stats').hidden=!isFlow;
  document.querySelectorAll('.pnav [data-tab]').forEach(b=>{const on=b.dataset.tab===t;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
  try{localStorage.setItem('cc_tab',t)}catch(e){}
  if(PAGES.includes(t)){ctab=t;pageEl.scrollTop=0;renderPage()}
  if(t==='plan')renderPlan();
  if(isFlow)requestAnimationFrame(()=>{renderEdges()})}
document.querySelectorAll('.pnav [data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
document.querySelectorAll('#flowNav [data-flow]').forEach(b=>b.onclick=()=>{document.querySelectorAll('#flowNav [data-flow]').forEach(x=>x.classList.toggle('on',x===b));try{localStorage.setItem('cf_tab',b.dataset.flow)}catch(e){}switchFlow(b.dataset.flow);requestAnimationFrame(()=>renderEdges())});
