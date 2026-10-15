try{const h=location.hash.replace('#','');let t0=h||localStorage.getItem('cc_tab')||'cockpit';if(h==='clipping'||h==='flow'||h==='main')t0='flows';
  const f0=h==='clipping'?'clipping':(localStorage.getItem('cf_tab')==='clipping'?'clipping':'main');if(f0==='clipping'){flowId='clipping';loadView();document.querySelectorAll('#flowNav [data-flow]').forEach(x=>x.classList.toggle('on',x.dataset.flow==='clipping'))}
  showTab(t0)}catch(e){showTab('cockpit')}
