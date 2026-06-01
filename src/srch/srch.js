// ─── 자재조회 ───


function srchLive(){
  clearTimeout(srchTimer);
  srchTimer=setTimeout(()=>{
    const q=document.getElementById('sq').value.trim();
    if(q.length>=2)doSrch();
    else if(!q)clearSrch();
  },300);
}


function addToReq(pn){
  const r=DB.find(x=>x.pn===pn)||{pn};
  if(reqItems.find(x=>x.pn===pn)){
    alert(`${pn}은 이미 요청 목록에 있습니다`);return;
  }
  reqItems.push({pn,d:r.d||'',qty:1,unit:'EA',note:''});
  renderReqPanel();
  // 자재불출요청 탭으로 자동 이동
  srchTab("req");
}


function submitReq(){
  if(!reqItems.length){alert('요청 품목이 없습니다');return;}
  const dt=document.getElementById('req-dt').value;
  const dest=document.getElementById('req-dest').value.trim();
  const rec=document.getElementById('req-rec').value.trim();
  const pur=document.getElementById('req-pur').value;
  if(!dt||!dest){alert('요청일과 출고처를 입력하세요');return;}

  reqItems.forEach(r=>{
    const dbr=DB.find(x=>x.pn===r.pn)||{};
    OUT.unshift({date:dt,pn:r.pn,mfg_pn:dbr.mp||'',qty:r.qty,unit:r.unit,
      purpose:pur,dest,receiver:rec,note:'[불출요청]'+(r.note||''),
      _done:false,_added:new Date().toLocaleString('ko-KR')});
  });
  sv(K.OUT,OUT);
  var cnt=reqItems.length;
  reqItems=[];renderReqPanel();
  renderOut(); updateStat();
  alert('✅ '+cnt+'건 불출 요청이 등록됐습니다.\n구매관리 → 자재불출 탭에서 확인하세요.');
}


function srchTab(t){
  ['item','req','bom','where'].forEach(function(tab){
    var pg=document.getElementById('srch-pg-'+tab); if(pg) pg.style.display=tab===t?'block':'none';
  });
  document.querySelectorAll('#srch-inner-tabs .pt-itab').forEach(function(el){
    el.classList.toggle('on', el.dataset.tab===t);
  });
  if(t==='item') initSrch();
  if(t==='req'){
    // req-dt 기본값
    var dt=document.getElementById('req-dt');
    if(dt&&!dt.value) dt.value=new Date().toISOString().split('T')[0];
    // 출고처 datalist
    var dests=[...new Set(OUT.map(function(r){return r.dest;}).filter(Boolean))];
    var dl2=document.getElementById('dl2');
    if(dl2) dl2.innerHTML=dests.map(function(v){return '<option value="'+v+'">';}).join('');
    renderReqPanel();
  }
}


function srchSubTab(tab){
  var panels = {item:'srch-panel-item', bom:'srch-panel-bom'};
  var tabs = {item:'srch-tab-item', bom:'srch-tab-bom'};
  Object.keys(panels).forEach(function(k){
    var p = document.getElementById(panels[k]);
    var t = document.getElementById(tabs[k]);
    if(p) p.style.display = k===tab ? 'block' : 'none';
    if(t){
      t.style.borderBottomColor = k===tab ? 'var(--tel)' : 'transparent';
      t.style.color = k===tab ? 'var(--tel)' : 'var(--text3)';
    }
  });
  if(tab==='item'){
    var sq = document.getElementById('sq');
    if(sq) sq.focus();
  }
}