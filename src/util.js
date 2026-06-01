// ─── 미분류 유틸리티 함수 ───


function toggleUserMenu() {
  var m = document.getElementById('user-menu');
  if(m) m.style.display = m.style.display === 'none' ? 'block' : 'none';
}


function bomToRows(obj) {
  var rows = [];
  Object.keys(obj).forEach(function(parent) {
    (obj[parent] || []).forEach(function(child) {
      var row = Object.assign({ parent_pn: parent }, child);
      // pn → child_pn 으로 서버 헤더에 맞춤
      if(row.pn !== undefined && row.child_pn === undefined) {
        row.child_pn = row.pn;
        delete row.pn;
      }
      rows.push(row);
    });
  });
  return rows;
}


function rowsToBom(rows) {
  var obj = {};
  rows.forEach(function(r) {
    var p = r.parent_pn;
    if(!p) return;
    if(!obj[p]) obj[p] = [];
    var child = Object.assign({}, r);
    delete child.parent_pn;
    delete child.company;
    // child_pn → pn 필드명 통일
    if(!child.pn && child.child_pn) {
      child.pn = String(child.child_pn).trim().replace(/\.0$/, '');
      delete child.child_pn;
    }
    if(child.pn) child.pn = String(child.pn).trim().replace(/\.0$/, '');
    obj[p].push(child);
  });
  return obj;
}


function chkhistToRows(obj) {
  var rows = [];
  Object.keys(obj).forEach(function(pn) {
    (obj[pn] || []).forEach(function(h) {
      rows.push(Object.assign({ pn: pn }, h));
    });
  });
  return rows;
}


function rowsToChkhist(rows) {
  var obj = {};
  rows.forEach(function(r) {
    var p = r.pn;
    if(!p) return;
    if(!obj[p]) obj[p] = [];
    var h = Object.assign({}, r);
    delete h.pn;
    obj[p].push(h);
  });
  return obj;
}


function dbToGSheet(rows) {
  return rows.map(function(r) {
    var out = {};
    for(var k in r) { out[DB_COL_MAP[k]||k] = r[k]; }
    return out;
  });
}


function gSheetToDB(rows) {
  return rows.map(function(r) {
    var out = {};
    for(var k in r) { out[DB_COL_MAP_REV[k]||k] = r[k]; }
    if(out.pn !== undefined) out.pn = String(out.pn||'').trim().replace(/\.0$/, '');
    return out;
  });
}


function openAuditLog() {
  document.getElementById('user-menu').style.display = 'none';
  var modal = document.getElementById('m-audit');
  if(!modal) return;
  modal.classList.add('on');
  document.getElementById('audit-tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">불러오는 중...</td></tr>';
  apiGet({ action:'getAudit' }).then(function(res) {
    if(!res.ok){ document.getElementById('audit-tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--red)">오류: '+res.error+'</td></tr>'; return; }
    var rows = res.data || [];
    if(!rows.length){ document.getElementById('audit-tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3)">기록 없음</td></tr>'; return; }
    document.getElementById('audit-tbody').innerHTML = rows.slice(0,200).map(function(r) {
      return '<tr><td style="font-family:var(--mono);font-size:10px;color:var(--text3)">'+r.created_at+'</td>'+
        '<td style="font-weight:600">'+r.user_name+'</td>'+
        '<td style="font-size:11px;color:var(--text3)">'+r.user_id+'</td>'+
        '<td><span style="font-family:var(--mono);font-size:10px;color:var(--tel)">'+r.sheet+'</span></td>'+
        '<td><span style="font-size:11px">'+r.action+'</span></td>'+
        '<td style="font-size:11px;color:var(--text2)">'+r.detail+'</td></tr>';
    }).join('');
  }).catch(function(){ document.getElementById('audit-tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--red)">서버 연결 실패</td></tr>'; });
}


function openUserMgmt() {
  document.getElementById('user-menu').style.display = 'none';
  var modal = document.getElementById('m-usermgmt');
  if(!modal) return;
  modal.classList.add('on');
  updateTabPermUI();
}


function saveNewUser() {
  var id   = document.getElementById('nu-id').value.trim();
  var pw   = document.getElementById('nu-pw').value.trim();
  var name = document.getElementById('nu-name').value.trim();
  var role = document.getElementById('nu-role').value;
  var perms = getTabPerms();
  if(!id||!pw||!name){ alert('모두 입력하세요'); return; }
  apiPost({ action:'addUser', id:id, password:pw, name:name, role:role, perms:perms, company:CURRENT_COMPANY }).then(function(res) {
    if(res.ok){ alert('✅ 계정 생성 완료\n아이디: '+id+'\n비밀번호: '+pw); document.getElementById('m-usermgmt').classList.remove('on'); }
    else{ alert('오류: '+(res.error||'실패')); }
  }).catch(function(){ alert('서버 연결 실패'); });
}


function fmtKoDate(v){
  if(v===null||v===undefined||v==='') return '—';
  var s = String(v).trim();
  // YYYY-MM-DD 또는 YYYY-MM-DDTHH... 형식
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return m[1]+'년 '+parseInt(m[2])+'월 '+parseInt(m[3])+'일';
  // MM/DD/YYYY 형식
  var mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(mdy) return mdy[3]+'년 '+parseInt(mdy[1])+'월 '+parseInt(mdy[2])+'일';
  // 엑셀 시리얼 숫자 (40000~50000)
  var n = parseFloat(s);
  if(!isNaN(n) && n > 40000 && n < 60000) {
    var d = new Date((n - 25569) * 86400 * 1000);
    return d.getFullYear()+'년 '+(d.getMonth()+1)+'월 '+d.getDate()+'일';
  }
  return s.substring(0,10)||'—';
}


function fmtShortDate(v){
  if(!v) return '—';
  var s = String(v).trim();
  // YYYY-MM-DD → yy-mm-dd
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return m[1].slice(2)+'-'+m[2]+'-'+m[3];
  // M/D/YY 또는 MM/DD/YY
  var mdy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if(mdy2) return (parseInt(mdy2[3])<50?'20':'19')+mdy2[3].slice(-2)+'-'+mdy2[1].padStart(2,'0')+'-'+mdy2[2].padStart(2,'0');
  // MM/DD/YYYY
  var mdy4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(mdy4) return mdy4[3].slice(2)+'-'+mdy4[1].padStart(2,'0')+'-'+mdy4[2].padStart(2,'0');
  return s||'—';
}


function buildMapGrid(){
  const opts=['<option value="">— 선택 안 함 —</option>',
    ...upHeaders.map((h,i)=>`<option value="${i}">${h}</option>`)].join('');
  
  // 자동 매핑 - 정확히 일치 우선, 부분일치 후순위
  // sf/fc/ud 는 의도적으로 자동매핑 안함 (선택안함 유지)
  const autoMap={};
  // exact: 정확히 일치하는 헤더
  const exactMap={
    'pn':'품번','d':'품명','rv':'REV','rv':'rev',
    'mg':'제조사','mp':'제조사품번',
    'ct':'category','ct':'Category',
    'cl':'classification','cl':'Classification ',
    'lc':'보관좌표','by':'구매처','lt':'납기',
    'mq':'moq','mq':'MOQ',
    'k5':'25년매입가','k5':'매입가',
    'k6':'26년매입가',
    'op':'기존품품번','om':'기존품제조사',
    'managed':'관리대상','dept':'관리부서',
  };
  // 필드별 정확일치 키워드 (정규화 후 비교)
  const exactHints={
    pn:['품번'],
    d:['품명'],
    rv:['rev'],
    mg:['제조사'],
    mp:['제조사품번'],
    ct:['category','classification '],
    cl:['classification'],
    lc:['보관좌표'],
    by:['구매처'],
    lt:['납기','lt(주)'],
    mq:['moq'],
    k4:['k4','24년'],
    k5:['매입가','25년매입가','k5'],
    k6:['26년매입가','k6'],
    op:['기존품품번','기존품번'],
    om:['기존품제조사','기존제조사'],
    managed:['관리대상'],
    dept:['관리부서'],
  };
  // 부분일치(폴백)는 sf/fc/ud 제외
  const partialHints={
    pn:['part','partnumber'],
    d:['description','품목명'],
    rv:['revision'],
    mg:['manufacturer','mfg','maker'],
    mp:['mfg_pn','mfgpn','제조사부품번호'],
    ct:['cat','카테고리'],
    cl:['class'],
    lc:['location','위치','좌표'],
    by:['vendor','supplier'],
    lt:['lead_time','leadtime','리드타임'],
    mq:['min_order','최소수량'],
    k4:['2024','price_2024'],
    k5:['2025','price_2025'],
    k6:['2026','price_2026'],
    op:['orig_pn','original_pn'],
    om:['orig_mfg'],
    managed:['관리'],
    dept:['부서','department'],
  };
  // 1패스: 정확일치
  upHeaders.forEach((h,i)=>{
    const hn=h.toLowerCase().replace(/\s/g,'').replace(/\.0$/,'');
    for(const [fld,kws] of Object.entries(exactHints)){
      if(!autoMap[fld]&&kws.some(k=>hn===k.toLowerCase().replace(/\s/g,''))){autoMap[fld]=i;}
    }
  });
  // 2패스: 부분일치 (아직 매핑 안된 필드만)
  upHeaders.forEach((h,i)=>{
    const hn=h.toLowerCase().replace(/\s/g,'');
    for(const [fld,kws] of Object.entries(partialHints)){
      if(!autoMap[fld]&&kws.some(k=>hn.includes(k.toLowerCase().replace(/\s/g,'')))){autoMap[fld]=i;}
    }
  });

  document.getElementById('map-grid').innerHTML=UP_FIELDS.map(([k,lbl,req])=>`
    <div class="map-label">${lbl}${req?'<span class="map-req"> ★</span>':''}</div>
    <div class="map-arr">→</div>
    <div class="map-sel">
      <select id="mp-${k}" onchange="upPreview()">
        ${opts.replace(`value="${autoMap[k]??''}"`,`value="${autoMap[k]??''}" selected`)}
      </select>
    </div>`).join('');
  upPreview();
}


function upPreview(){
  if(!upRows.length)return;
  const getIdx=k=>{const el=document.getElementById('mp-'+k);return el&&el.value!==''?+el.value:-1;};
  const pi=getIdx('pn'),di=getIdx('d');
  const sample=upRows.slice(0,3).map(r=>{
    const pn=pi>=0?r[pi]:'?';
    const d=di>=0?r[di]:'?';
    return `품번: ${pn}  품명: ${d}`;
  });
  document.getElementById('up-preview').textContent='미리보기 (상위 3행):\n'+sample.join('\n');
}


function dChip(f){
  if(f==='all'){dF.clear();dF.add('all');}
  else{dF.delete('all');dF.has(f)?dF.delete(f):dF.add(f);if(!dF.size)dF.add('all');}
  document.querySelectorAll('[id^="dc-"]').forEach(el=>{
    el.className=el.className.replace(/\bon\b/g,'').trim();
  });
  dF.forEach(k=>{const el=document.getElementById('dc-'+k);if(el)el.classList.add('on');});
  dPn=1;renderDB();
}


function ds(k){if(dSk===k)dSd*=-1;else{dSk=k;dSd=1;}
  document.querySelectorAll('#pg-db th').forEach(th=>{th.classList.remove('srt');});
  const idx={pn:0,d:1,rv:2,ct:3,mg:4,by:6,lt:7,k5:9,k6:10}[k];
  if(idx!==undefined) document.querySelectorAll('#pg-db th')[idx]?.classList.add('srt');
  renderDB();
}


function filtDB(){
  const q=(document.getElementById('dq')||{value:''}).value.toLowerCase();
  return DB.filter(r=>{
    if(q&&!((r.pn||'')+(r.d||'')+(r.mg||'')+(r.by||'')+(r.lc||'')+(r.mp||'')).toLowerCase().includes(q))return false;
    if(dF.has('all'))return true;
    if(dF.has('alt')&&r.ia)return true;
    if(dF.has('orig')&&!r.ia)return true;
    if(dF.has('nolt')&&(!r.lt||r.lt===0))return true;
    if(dF.has('save')&&r.k5>0&&r.k6>0&&r.k6<r.k5)return true;
    if(dF.has('부품')&&r.ct==='부품')return true;
    if(dF.has('와이어')&&r.ct==='와이어_케이블')return true;
    if(dF.has('하네스')&&r.ct&&r.ct.includes('하네스'))return true;
    return false;
  }).sort((a,b)=>{
    const va=a[dSk]||0,vb=b[dSk]||0;
    if(typeof va==='number')return(va-vb)*dSd;
    return String(va).localeCompare(String(vb),'ko')*dSd;
  });
}


function resetDB(){
  if(!confirm('⚠️ 품목 DB 전체를 초기화하시겠습니까?\n\n현재 저장된 모든 품목 데이터가 삭제됩니다.'))return;
  DB=[];
  sv(K.DB,DB);
  renderDB();updateStat();
  alert('품목 DB가 초기화되었습니다.');
}


function dPg(d){dPn+=d;renderDB();}


function openDBModal(pn){
  editPN=pn||null;
  const r=pn?DB.find(x=>x.pn===pn):null;
  document.getElementById('m-title').innerHTML=(pn?'품목 편집':'품목 추가')+' <button class="mx" onclick="closeM(\'m-db\')">✕</button>';
  document.getElementById('del-btn').style.display=pn?'':'none';

  const setF=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||'';};
  setF('f-pn',r?.pn);setF('f-rv',r?.rv);setF('f-desc',r?.d);
  setF('f-mfg',r?.mg);setF('f-mp',r?.mp);
  setF('f-cat',r?.ct||'부품');setF('f-cls',r?.cl);setF('f-loc',r?.lc);
  setF('f-op',r?.op);setF('f-om',r?.om);setF('f-ay',r?.ay||'');
  setF('f-by',r?.by);setF('f-lt',r?.lt);setF('f-mq',r?.mq);
  setF('f-mg',r?.managed||'Y');
  setF('f-dept',r?.dept||'지원본부');
  setF('f-p4',r?.k4);setF('f-p5',r?.k5);setF('f-p6',r?.k6);
  setF('f-ud',r?.ud);setF('f-qu',r?.qu);setF('f-qk',r?.qk);setF('f-tg',r?.tg);
  setF('f-fc',r?.fc);setF('f-sf',r?.sf);

  // 가격비교 표시
  const pca=document.getElementById('price-compare-area');
  if(r&&(r.k4||r.k5||r.k6)){
    const items=[[24,r.k4],[25,r.k5],[26,r.k6]].filter(x=>x[1]>0);
    pca.innerHTML=`<div class="price-compare">${items.map(([y,v],i)=>`
      ${i>0&&items[i-1]?`<span class="pc-arr">${items[i-1][1]>v?'▼':'▲'}</span>`:''}
      <div class="pc-item"><div class="pc-yr">${y}년</div><div class="pc-val" style="color:${i===items.length-1?'var(--tel)':'var(--text2)'}">${v.toLocaleString()}원</div></div>
    `).join('')}
    ${items.length>=2?`<div class="pc-item"><div class="pc-yr">절감</div><div class="pc-val ${items[items.length-1][1]<items[0][1]?'save-pos':'save-neg'}">${(((items[0][1]-items[items.length-1][1])/items[0][1])*100).toFixed(1)}%</div></div>`:''}
    </div>`;
  } else pca.innerHTML='';

  // 이력
  const hist=HIST.filter(h=>h.pn===pn);
  const hp=document.getElementById('hist-panel');
  hp.style.display=hist.length?'block':'none';
  if(hist.length){
    document.getElementById('hist-list').innerHTML=hist.slice(0,8).map(h=>`
      <div class="he"><div class="hd"></div>
      <div class="hb">
        <div class="hdate">${h.date}</div>
        <div class="htxt">${h.action}</div>
        ${h.changes?.length?`<div class="hch">${h.changes.map(c=>`<span class="old">${c.o}</span><span class="arr"> → </span><span class="new">${c.n}</span> <span style="color:var(--text3)">(${c.f})</span>`).join(' &nbsp;')}</div>`:''}
      </div></div>`).join('');
  }
  document.getElementById('m-db').classList.add('on');
}


function calcS(){
  const lt=parseFloat(document.getElementById('f-lt')?.value)||0;
  const fc=parseFloat(document.getElementById('f-fc')?.value)||0;
  if(lt>0&&fc>0){
    const ltM=lt/4.3;
    document.getElementById('f-sf').value=Math.round(fc*(ltM+1));
  }
  // 가격변동 실시간
  const p5=parseFloat(document.getElementById('f-p5')?.value)||0;
  const p6=parseFloat(document.getElementById('f-p6')?.value)||0;
  const pa=document.getElementById('price-compare-area');
  if(pa&&p5>0&&p6>0){
    const pct=((p5-p6)/p5*100).toFixed(1);
    const cls=p6<p5?'save-pos':'save-neg';
    pa.innerHTML=`<div class="price-compare">
      <div class="pc-item"><div class="pc-yr">25년</div><div class="pc-val" style="color:var(--text2)">${p5.toLocaleString()}원</div></div>
      <span class="pc-arr">${p6<p5?'▼':'▲'}</span>
      <div class="pc-item"><div class="pc-yr">26년</div><div class="pc-val" style="color:var(--tel)">${p6.toLocaleString()}원</div></div>
      <div class="pc-item"><div class="pc-yr">변동</div><div class="pc-val ${cls}">${p6<p5?'-':'+'}${Math.abs(pct)}%</div></div>
    </div>`;
  }
}


function saveItem(){
  const pn=document.getElementById('f-pn').value.trim();
  if(!pn){alert('품번을 입력하세요');return;}
  const g=id=>document.getElementById(id)?.value.trim()||'';
  const gn=id=>parseFloat(document.getElementById(id)?.value)||0;
  const fc=gn('f-fc'), lt=gn('f-lt');
  const sf=lt>0&&fc>0?Math.round(fc*(lt/4.3+1)):0;
  const nd={
    pn,d:g('f-desc'),rv:g('f-rv'),mg:g('f-mfg'),mp:g('f-mp'),
    ct:g('f-cat'),cl:g('f-cls'),lc:g('f-loc'),
    ia:!!(g('f-op')||g('f-om')||g('f-ay')),
    ay:g('f-ay'),op:g('f-op'),om:g('f-om'),
    by:g('f-by'),lt:gn('f-lt'),mq:gn('f-mq'),
    managed:g('f-mg'),
    dept:g('f-dept')||'지원본부',
    k4:gn('f-p4'),k5:gn('f-p5'),k6:gn('f-p6'),
    ud:gn('f-ud'),qu:gn('f-qu'),qk:gn('f-qk'),tg:gn('f-tg'),
    fc,sf:gn('f-sf')||sf,
  };
  const idx=DB.findIndex(x=>x.pn===pn);
  const dt=new Date().toLocaleString('ko-KR');
  if(idx>=0){
    const old=DB[idx];
    const ch=[];
    [['lt','LT(주)'],['by','구매처'],['k5','25년가'],['k6','26년가'],['sf','안전재고'],['rv','REV'],['lc','보관좌표']].forEach(([k,l])=>{
      if(String(old[k]||'')!==String(nd[k]||''))ch.push({f:l,o:old[k]||'없음',n:nd[k]||'없음'});
    });
    if(ch.length)HIST.unshift({pn,date:dt,action:'수정',changes:ch});
    DB[idx]=nd;
  }else{
    DB.unshift(nd);
    HIST.unshift({pn,date:dt,action:'신규 등록',changes:[]});
  }
  svDBItem(nd, false);sv(K.HIST,HIST);
  closeM('m-db');renderDB();
  syncDBtoCHK(); // DB 변경 시 CHK 자동 연동
}


function delItem(){
  if(!editPN||!confirm(`${editPN} 품목을 삭제하시겠습니까?`))return;
  HIST.unshift({pn:editPN,date:new Date().toLocaleString('ko-KR'),action:'삭제',changes:[]});
  DB=DB.filter(x=>x.pn!==editPN);
  svDBItem(nd, false);sv(K.HIST,HIST);
  closeM('m-db');renderDB();
  syncDBtoCHK();
}


function rChip(f){
  if(f==='all'){rF.clear();rF.add('all');}else{rF.delete('all');rF.has(f)?rF.delete(f):rF.add(f);if(!rF.size)rF.add('all');}
  document.querySelectorAll('[id^="rc-"]').forEach(el=>el.classList.remove('on'));
  rF.forEach(k=>{document.getElementById('rc-'+k)?.classList.add('on');});
  rPn=1;renderRecv();
}


function rs(k){if(rSk===k)rSd*=-1;else{rSk=k;rSd=1;}renderRecv();}


function filtRecv(){
  const q=(document.getElementById('rq')||{value:''}).value.toLowerCase();
  return RECV.filter(r=>{
    if(q&&!(r.pn+r.vendor+(r.bl||'')).toLowerCase().includes(q))return false;
    if(rF.has('all'))return true;
    if(rF.has('pend')&&!r.recv_date)return true;
    if(rF.has('정기')&&r.pay==='정기 결제')return true;
    if(rF.has('카드')&&r.pay==='카드 결제')return true;
    if(rF.has('해외')&&r.pay==='해외 송금')return true;
    return false;
  }).sort((a,b)=>{
    const va=a[rSk]||'',vb=b[rSk]||'';
    if(rSk.includes('date'))return(new Date(va||'1900')-new Date(vb||'1900'))*rSd;
    return(typeof va==='number'?(va-vb):String(va).localeCompare(String(vb),'ko'))*rSd;
  });
}


function rPg(d){rPn+=d;renderRecv();}


function toggleAllRecv(el){
  document.querySelectorAll('.row-chk').forEach(c=>c.checked=el.checked);
  updateRecvBulkBtns();
}


function updateRecvBulkBtns(){
  const cnt=document.querySelectorAll('.row-chk:checked').length;
  document.getElementById('recv-bulk-recv-btn').style.display=cnt>0?'':'none';
  document.getElementById('recv-bulk-edit-btn').style.display=cnt===1?'':'none';
}


function openRecvModal(){
  recvRowId=0;
  document.getElementById('r-od').value=new Date().toISOString().split('T')[0];
  document.getElementById('r-rd').value='';
  document.getElementById('r-vd').value='';
  document.getElementById('r-bl').value='';
  document.getElementById('r-sd').value='';
  const vds=[...new Set(RECV.map(r=>r.vendor).filter(Boolean))].slice(0,30);
  document.getElementById('vl').innerHTML=vds.map(v=>`<option value="${v}">`).join('');
  document.getElementById('recv-rows').innerHTML='';
  addRecvRow(); addRecvRow(); // 기본 2행
  updateRecvTotal();
  document.getElementById('m-recv').classList.add('on');
}


function addRecvRow(){
  const id=recvRowId++;
  const tr=document.createElement('tr');
  tr.id='rr-'+id;
  tr.innerHTML=`
    <td><input type="text" id="rpn-${id}" placeholder="품번" oninput="autoFillRecv(${id})"></td>
    <td><input type="text" id="rdesc-${id}" class="auto" placeholder="품명 자동입력" readonly></td>
    <td><input type="text" id="rmfg-${id}" class="auto" placeholder="제조사" readonly></td>
    <td><input type="number" id="rqty-${id}" placeholder="0" min="0" oninput="calcRecvRow(${id})"></td>
    <td><select id="runit-${id}"><option>EA</option><option>M</option><option>Foot</option></select></td>
    <td><input type="number" id="rup-${id}" placeholder="0" oninput="calcRecvRow(${id})"></td>
    <td><input type="number" id="rtot-${id}" placeholder="자동계산" oninput="updateRecvTotal()"></td>
    <td><input type="date" id="rid-${id}"></td>
    <td><input type="text" id="rnote-${id}" placeholder="비고"></td>
    <td><button class="btn br-btn sm" style="padding:3px 7px" onclick="removeRecvRow(${id})">✕</button></td>`;
  document.getElementById('recv-rows').appendChild(tr);
}


function removeRecvRow(id){
  const tr=document.getElementById('rr-'+id);
  if(tr)tr.remove();
  updateRecvTotal();
}


function autoFillRecv(id){
  const pn=document.getElementById('rpn-'+id)?.value.trim();
  const r=DB.find(x=>x.pn===pn);
  const desc=document.getElementById('rdesc-'+id);
  const mfg=document.getElementById('rmfg-'+id);
  const up=document.getElementById('rup-'+id);
  if(r){
    if(desc){desc.value=r.d||'';desc.style.color='var(--text)';}
    if(mfg){mfg.value=(r.mg||'')+(r.mp?' / '+r.mp:'');mfg.style.color='var(--text)';}
    // DB 매입가 자동 채우기 (26년 > 25년 순)
    if(up&&!up.value&&(r.k6||r.k5)){up.value=r.k6||r.k5;}
    calcRecvRow(id);
  } else {
    if(desc){desc.value='';desc.style.color='';}
    if(mfg){mfg.value='';mfg.style.color='';}
  }
}


function calcRecvRow(id){
  const qty=parseFloat(document.getElementById('rqty-'+id)?.value)||0;
  const up=parseFloat(document.getElementById('rup-'+id)?.value)||0;
  const tot=document.getElementById('rtot-'+id);
  if(tot&&qty&&up)tot.value=qty*up;
  updateRecvTotal();
}


function updateRecvTotal(){
  let sum=0;
  document.querySelectorAll('[id^="rtot-"]').forEach(el=>{sum+=parseFloat(el.value)||0;});
  document.getElementById('recv-total-txt').textContent=sum>0?`합계금액: ${sum.toLocaleString()}원`:'';
}


function saveRecv(){
  const g=id=>document.getElementById(id)?.value.trim()||'';
  const od=g('r-od'),vd=g('r-vd');
  if(!od||!vd){alert('발주일과 공급업체를 입력하세요');return;}
  const rows=document.querySelectorAll('[id^="rr-"]');
  let cnt=0;
  rows.forEach(tr=>{
    const id=tr.id.replace('rr-','');
    const pn=document.getElementById('rpn-'+id)?.value.trim();
    const qty=parseFloat(document.getElementById('rqty-'+id)?.value)||0;
    if(!pn||!qty)return;
    const r=DB.find(x=>x.pn===pn)||{};
    RECV.unshift({order_date:od,req_date:g('r-rd'),recv_date:g('rid-'+id),vendor:vd,
      pn,mfg:r.mg||'',mfg_pn:r.mp||'',qty,unit:document.getElementById('runit-'+id)?.value||'EA',
      unit_price:parseFloat(document.getElementById('rup-'+id)?.value)||0,
      total:parseFloat(document.getElementById('rtot-'+id)?.value)||0,
      pay:g('r-pay'),sign_date:g('r-sd'),bl:g('r-bl'),
      note:document.getElementById('rnote-'+id)?.value.trim()||'',
      _added:new Date().toLocaleString('ko-KR')});
    cnt++;
  });
  if(!cnt){alert('등록할 품목이 없습니다 (품번·수량 모두 필요)');return;}
  sv(K.RECV,RECV);closeM('m-recv');renderRecv();updateStat();

  // 26년 매입가 DB 자동 갱신
  let k6updated=0;
  RECV.slice(0,cnt).forEach(r=>{
    if(r.order_date&&String(r.order_date).startsWith('2026')&&r.unit_price>0){
      const idx=DB.findIndex(x=>x.pn===r.pn);
      if(idx>=0&&DB[idx].k6!==r.unit_price){
        const old=DB[idx].k6||0;
        DB[idx].k6=r.unit_price;
        HIST.unshift({pn:r.pn,date:new Date().toLocaleString('ko-KR'),
          action:'26년 매입가 자동갱신',
          changes:[{f:'k6',o:old||'없음',n:r.unit_price}]});
        k6updated++;
      }
    }
  });
  if(k6updated>0){sv(K.DB,DB);sv(K.HIST,HIST);renderDB();}
  alert(`${cnt}건 등록 완료${k6updated>0?' · 26년 매입가 '+k6updated+'건 DB 갱신됨':''}`);
}


function delRecv(i){if(!confirm('삭제하시겠습니까?'))return;RECV.splice(i,1);sv(K.RECV,RECV);renderRecv();updateStat();}


function exportEcount(){
  const checked=[...document.querySelectorAll('.row-chk:checked')];
  let rows = checked.length>0
    ? checked.map(el=>RECV[+el.dataset.idx]).filter(Boolean)
    : filtRecv();
  if(!rows.length){alert('내보낼 항목이 없습니다');return;}

  // 거래처별 그룹핑 (같은 발주일+거래처 = 같은 발주)
  const prj = document.getElementById('erp-prj')?.value.trim() || ERP_FIXED.project;
  const grouped={};
  rows.forEach(r=>{
    const key=`${r.order_date||''}__${r.vendor||''}`;
    if(!grouped[key])grouped[key]=[];
    grouped[key].push(r);
  });

  // ERP 발주서 컬럼: 일자,순번,납기일자,거래처코드,거래처명,참조,담당자,거래유형,입고창고,통화,환율,프로젝트,배송지,메모,품목코드,품목명,규격,수량,단가,외화금액,공급가액,부가세,적요
  const header=['일자','순번','납기일자','거래처코드','거래처명','참조','담당자','거래유형','입고창고','통화','환율','프로젝트','배송지','메모','품목코드','품목명','규격','수량','단가','외화금액','공급가액','부가세','적요'];
  const dataRows=[];
  let noCode=[];

  Object.values(grouped).forEach(grp=>{
    const vname=(grp[0].vendor||'').trim();
    const vinfo=VMAP[vname]||{c:'',p:''};
    if(!vinfo.c) noCode.push(vname);

    grp.forEach((r,i)=>{
      const dbItem=DB.find(x=>x.pn===r.pn)||{};
      const qty=r.qty||0;
      const price=r.unit_price||0;
      const supply=r.total||qty*price;
      const vat=Math.round(supply*0.1);
      dataRows.push([
        i===0?(r.order_date||''):'',   // 일자 (첫 품목만)
        i+1,                            // 순번
        r.req_date||r.order_date||'',   // 납기일자
        i===0?vinfo.c:'',               // 거래처코드 (첫 품목만)
        i===0?vname:'',                 // 거래처명 (첫 품목만)
        '',                             // 참조
        ERP_FIXED.manager,              // 담당자 (고정 00022)
        '',                             // 거래유형
        ERP_FIXED.warehouse,            // 입고창고 (고정 00009)
        '',                             // 통화
        '',                             // 환율
        prj,                            // 프로젝트 (고정)
        '',                             // 배송지
        r.note||'',                     // 메모
        r.pn||'',                       // 품목코드
        dbItem.d||'',                   // 품목명
        dbItem.mp||'',                  // 규격 (제조사품번)
        qty,                            // 수량
        price,                          // 단가
        '',                             // 외화금액
        supply,                         // 공급가액
        vat,                            // 부가세
        r.bl||'',                       // 적요 (BL번호)
      ]);
    });
  });

  const ws=XLSX.utils.aoa_to_sheet([header,...dataRows]);
  ws['!cols']=[
    {wch:12},{wch:5},{wch:12},{wch:14},{wch:16},{wch:10},{wch:8},{wch:10},
    {wch:10},{wch:6},{wch:6},{wch:10},{wch:10},{wch:20},{wch:14},{wch:30},
    {wch:20},{wch:8},{wch:12},{wch:10},{wch:12},{wch:10},{wch:16}
  ];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'ERP발주서');
  const dt=new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb,`ERP발주서_${dt}.xlsx`);

  if(noCode.length){
    const uniq=[...new Set(noCode)];
    alert(`⚠️ 거래처코드 미등록 업체 ${uniq.length}곳:\n${uniq.join(', ')}\n\n발주서는 생성됐으나 거래처코드 없이 저장됐습니다.`);
  }
}


function oTab(t) {
  _oTab = t;
  document.querySelectorAll('#pg-out .chip').forEach(function(el) {
    el.classList.toggle('on', el.id === 'oc-' + t);
    el.classList.toggle('t', el.id === 'oc-' + t);
  });
  oPn = 1; renderOut();
}


function outDone(gi) {
  var all = Array.isArray(OUT) ? OUT : [];
  var q = ((document.getElementById('oq')||{}).value||'').toLowerCase().trim();
  var data = all.filter(function(r) {
    if(_oTab === 'pend' && r._done) return false;
    if(_oTab === 'done' && !r._done) return false;
    if(q && !((r.pn||'').toLowerCase().includes(q) ||
              (r.dest||'').toLowerCase().includes(q) ||
              (r.note||'').toLowerCase().includes(q))) return false;
    return true;
  }).slice().sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  var r = data[(oPn-1)*OP + gi % OP];
  if(!r) return;
  var idx = OUT.indexOf(r);
  if(idx < 0) return;
  OUT[idx]._done = true;
  OUT[idx]._doneAt = new Date().toLocaleString('ko-KR');
  sv(K.OUT, OUT);
  renderOut(); updateStat();
}


function oPg(d){ oPn+=d; renderOut(); }


function openOutModal(){
  outRowId=0;
  document.getElementById('o-dt').value=new Date().toISOString().split('T')[0];
  document.getElementById('o-dest').value='';
  document.getElementById('o-rec').value='';
  document.getElementById('bom-pn').value='';
  document.getElementById('bom-status').textContent='';
  const dests=[...new Set(OUT.map(r=>r.dest).filter(Boolean))].slice(0,10);
  document.getElementById('dl').innerHTML=dests.map(v=>`<option value="${v}">`).join('');
  document.getElementById('out-rows').innerHTML='';
  addOutRow();
  updateOutTotal();
  document.getElementById('m-out').classList.add('on');
}


function addOutRow(pn='',qty='',bomSrc='',unit=''){
  const id=outRowId++;
  const r=DB.find(x=>x.pn===pn)||{};
  const dept=r.dept||'미관리';
  const deptBadge=dept==='지원본부'?`<span class="bd dept-jb" style="font-size:9px">지원</span>`
    :dept==='하네스'?`<span class="bd dept-hn" style="font-size:9px">하네스</span>`
    :`<span class="bd dept-na" style="font-size:9px">미관리</span>`;
  const rowUnit=unit||r.unit||'EA';
  const tr=document.createElement('tr');
  tr.id='or-'+id;
  if(dept==='미관리'||dept==='') tr.style.opacity='0.45';
  tr.innerHTML=`
    <td><input type="text" id="opn-${id}" placeholder="품번" value="${pn}" oninput="autoFillOut(${id})"></td>
    <td><input type="text" id="odesc-${id}" class="auto" placeholder="품명 자동입력" readonly value="${r.d||''}"></td>
    <td><input type="text" id="omp-${id}" class="auto" placeholder="제조사품번" readonly value="${r.mp||''}"></td>
    <td><input type="number" id="oqty-${id}" placeholder="0" min="0" value="${qty}" oninput="updateOutTotal()"></td>
    <td><select id="ounit-${id}">
      <option${rowUnit==='EA'?' selected':''}>EA</option>
      <option${rowUnit==='M'?' selected':''}>M</option>
      <option${rowUnit==='Foot'?' selected':''}>Foot</option>
      <option${rowUnit==='SET'?' selected':''}>SET</option>
    </select></td>
    <td id="odept-${id}" style="text-align:center">${pn?deptBadge:'—'}</td>
    <td style="font-size:11px;color:var(--pur)">${bomSrc?`<span class="bom-tag" style="font-size:9px">${bomSrc}</span>`:''}</td>
    <td><input type="text" id="onote-${id}" placeholder="비고"></td>
    <td><button class="btn br-btn sm" style="padding:3px 7px" onclick="removeOutRow(${id})">✕</button></td>`;
  document.getElementById('out-rows').appendChild(tr);
  if(pn&&r.d){
    document.getElementById('odesc-'+id).style.color='var(--text)';
    document.getElementById('omp-'+id).style.color='var(--text)';
  }
}


function removeOutRow(id){
  const tr=document.getElementById('or-'+id);if(tr)tr.remove();updateOutTotal();
}


function autoFillOut(id){
  const pn=document.getElementById('opn-'+id)?.value.trim();
  const r=DB.find(x=>x.pn===pn);
  const desc=document.getElementById('odesc-'+id);
  const mp=document.getElementById('omp-'+id);
  const deptEl=document.getElementById('odept-'+id);
  const tr=document.getElementById('or-'+id);
  if(r){
    if(desc){desc.value=r.d||'';desc.style.color='var(--text)';}
    if(mp){mp.value=r.mp||'';mp.style.color='var(--text)';}
    if(deptEl){
      const dept=r.dept||'미관리';
      deptEl.innerHTML=dept==='지원본부'?`<span class="bd dept-jb" style="font-size:9px">지원</span>`
        :dept==='하네스'?`<span class="bd dept-hn" style="font-size:9px">하네스</span>`
        :`<span class="bd dept-na" style="font-size:9px">미관리</span>`;
      if(tr) tr.style.opacity=(dept==='미관리'||dept==='')?'0.45':'1';
    }
  } else {
    if(desc){desc.value='';desc.style.color='';}
    if(mp){mp.value='';mp.style.color='';}
    if(deptEl){deptEl.innerHTML='—';}
    if(tr) tr.style.opacity='1';
  }
}


function updateOutTotal(){
  let cnt=0;
  document.querySelectorAll('[id^="oqty-"]').forEach(el=>{if(parseFloat(el.value)>0)cnt++;});
  document.getElementById('out-total-txt').textContent=cnt>0?`${cnt}개 품목 등록 예정`:'';
}


function expandBOM(){
  const parentPN=document.getElementById('bom-pn').value.trim();
  if(!parentPN){alert('상위 품번을 입력하세요');return;}
  const bom=BOM[parentPN];
  const st=document.getElementById('bom-status');
  if(!bom||!bom.length){
    st.textContent=`'${parentPN}' BOM 없음`;st.style.color='var(--red)';return;
  }
  const multiplier=parseFloat(document.getElementById('bom-expand-qty')?.value)||1;
  let managed=0,unmanaged=0;
  bom.forEach(item=>{
    const r=DB.find(x=>x.pn===item.pn)||{};
    const needQty=Math.round((item.aqty??item.qty)*multiplier*1000)/1000;
    addOutRow(item.pn, needQty, parentPN+(multiplier!==1?` ×${multiplier}`:''), item.unit||r.unit||'EA');
    const dept=r.dept||'미관리';
    if(dept==='지원본부'||dept==='하네스') managed++;
    else unmanaged++;
  });
  st.innerHTML=`✅ ${bom.length}건 전개 <span style="color:var(--grn)">관리${managed}</span> <span style="color:var(--text3)">미관리${unmanaged}</span>`;
  updateOutTotal();
}


function saveOut(){
  const g=id=>document.getElementById(id)?.value.trim()||'';
  const dt=g('o-dt');
  if(!dt){alert('불출일을 입력하세요');return;}
  const rows=document.querySelectorAll('[id^="or-"]');
  let cnt=0;
  rows.forEach(tr=>{
    const id=tr.id.replace('or-','');
    const pn=document.getElementById('opn-'+id)?.value.trim();
    const qty=parseFloat(document.getElementById('oqty-'+id)?.value)||0;
    if(!pn||!qty)return;
    const r=DB.find(x=>x.pn===pn)||{};
    OUT.unshift({date:dt,pn,mfg_pn:r.mp||'',qty,
      unit:document.getElementById('ounit-'+id)?.value||'EA',
      purpose:g('o-pur'),dest:g('o-dest'),receiver:g('o-rec'),
      note:document.getElementById('onote-'+id)?.value.trim()||'',
      _added:new Date().toLocaleString('ko-KR')});
    cnt++;
  });
  if(!cnt){alert('등록할 품목이 없습니다');return;}
  sv(K.OUT,OUT);closeM('m-out');renderOut();updateStat();
  alert(`${cnt}건 불출 등록 완료`);
}


function delOut(i){if(!confirm('삭제하시겠습니까?'))return;OUT.splice(i,1);sv(K.OUT,OUT);
    if(typeof CURRENT_TOKEN!=='undefined'&&CURRENT_TOKEN){
    }
    renderOut();updateStat();}


function lChip(f){
  if(f==='all'){lF.clear();lF.add('all');}else{lF.delete('all');lF.has(f)?lF.delete(f):lF.add(f);if(!lF.size)lF.add('all');}
  document.querySelectorAll('[id^="lc-"]').forEach(el=>el.classList.remove('on'));
  lF.forEach(k=>{document.getElementById('lc-'+k)?.classList.add('on');});
  lPn=1;renderLT();
}


function savePriceHist(arr){try{localStorage.setItem(K_PRICE,JSON.stringify(arr));}catch(e){}}


function recordPriceChanges(changes){
  var today=new Date().toISOString().slice(0,10);
  changes.forEach(function(c){
    var ex=PRICE_HIST.find(function(r){return r.pn===c.pn&&r.date===today;});
    if(ex){ex.k6=c.newPrice;ex.diff=c.diff;ex.pct=c.pct;ex.recvDate=c.date;ex.qty=c.qty||0;ex.totalDiff=c.totalDiff||0;}
    else PRICE_HIST.unshift({date:today,pn:c.pn,d:c.d,k5:c.oldPrice,k6:c.newPrice,diff:c.diff,pct:c.pct,recvDate:c.date||'',qty:c.qty||0,totalDiff:c.totalDiff||0});
  });
  savePriceHist(PRICE_HIST);
  var bdg=document.getElementById('b-price');if(bdg)bdg.textContent=PRICE_HIST.length;
}


function priceChip(f){
  _priceFilter=f;
  ['all','down','up'].forEach(function(k){var el=document.getElementById('pc-'+k);if(el)el.className='chip'+(k===f?' on':'')+(k==='down'?' g':k==='up'?' r':'');});
  renderPriceHist();
}


function exportPriceHistCSV(){
  if(!PRICE_HIST.length){alert('이력 없음');return;}
  var bom='\uFEFF',hdr=['변동일','품번','품명','25년단가','26년단가','변동액','변동률','올해수량','실절감액','최근발주일'];
  var rows=PRICE_HIST.map(function(r){return[r.date,r.pn,'"'+(r.d||'')+'"',r.k5,r.k6,r.diff,r.pct!==null?r.pct+'%':'신규',(r.qty||0),(r.totalDiff||0),r.recvDate].join(',');});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([bom+hdr.join(',')+'\n'+rows.join('\n')],{type:'text/csv;charset=utf-8'}));
  a.download='단가변동이력_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
}


function _loadStock(raw) {
  if(!raw || raw.length < 2) return;
  var hdr = raw[0].map(function(c){ return String(c||'').toLowerCase().replace(/\s/g,''); });
  var fi  = function(kws){ return hdr.findIndex(function(h){ return kws.some(function(k){ return h.includes(k); }); }); };
  var tn  = function(v){ var n=parseFloat(String(v||'').replace(/,/g,'')); return isNaN(n)?0:n; };
  var ts  = function(v){ return String(v||'').trim().replace(/\.0$/,''); };

  var pnI   = fi(['품목코드','품번','pn']);
  var mpI   = fi(['제조사품번']);
  var unitI = fi(['단위','unit']);
  var initI = fi(['기초재고']);
  var inI   = fi(['총입고']);
  var outI  = fi(['총출고']);
  var curI  = fi(['현재고']);
  var safeI = fi(['안전재고']);
  var statI = fi(['재고상태']);
  var availI= fi(['가용재고']);
  var noteI = fi(['비고']);

  STOCK = [];
  for(var i=1; i<raw.length; i++){
    var r = raw[i];
    var pn = ts(r[pnI]); if(!pn) continue;
    STOCK.push({
      pn:    pn,
      mp:    mpI>=0  ? ts(r[mpI])   : '',
      unit:  unitI>=0? ts(r[unitI]) : 'EA',
      init:  initI>=0 ? tn(r[initI])  : 0,
      inQty: inI>=0   ? tn(r[inI])    : 0,
      outQty:outI>=0  ? tn(r[outI])   : 0,
      cur:   curI>=0  ? tn(r[curI])   : 0,
      safe:  safeI>=0 ? tn(r[safeI])  : 0,
      stat:  statI>=0 ? ts(r[statI])  : '',
      avail: availI>=0? tn(r[availI]) : 0,
      note:  noteI>=0 ? ts(r[noteI])  : ''
    });
  }
  var bdg = document.getElementById('b-stock');
  if(bdg) bdg.textContent = STOCK.length;
  renderStock();
  // 서버 저장
  if(typeof CURRENT_TOKEN!=='undefined' && CURRENT_TOKEN) {
    apiPost({action:'setSheet', sheet:'stock_items', data:STOCK}).catch(function(){});
  }
}


function stockChip(f){
  _stockFilter=f;
  ['all','zero','neg','ok'].forEach(function(k){
    var el=document.getElementById('sc-'+k);
    if(el) el.className='chip'+(k===f?' on':'')+(k==='zero'?' r':k==='neg'?' r':k==='ok'?' g':'');
  });
  renderStock();
}


function fixNegStock(){
  var negs=STOCK.filter(function(r){return r.cur<0;});
  if(!negs.length){alert('음수 재고 없음');return;}
  if(!confirm('음수 재고 '+negs.length+'건을 0으로 수정할까요?'))return;
  negs.forEach(function(r){ r.cur=0; r.avail=Math.max(0,r.avail); r.stat=r.stat||'품절'; });
  renderStock();
  alert('✅ '+negs.length+'건 수정 완료 (현재 화면 기준, 원본 파일은 변경되지 않습니다)');
}


function exportStockCSV(){
  if(!STOCK.length){alert('재고 데이터 없음');return;}
  var bom='\uFEFF';
  var hdr=['품번','제조사품번','단위','기초재고','총입고','총출고','현재고','안전재고','재고상태','가용재고','비고'];
  var rows=STOCK.map(function(r){
    return [r.pn,'"'+(r.mp||'')+'"',r.unit,r.init,r.inQty,r.outQty,r.cur,r.safe,r.stat,r.avail,'"'+(r.note||'')+'"'].join(',');
  });
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([bom+hdr.join(',')+'\n'+rows.join('\n')],{type:'text/csv;charset=utf-8'}));
  a.download='재고현황_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
}


function openPriceUpdate(){
  priceUpdateTarget='k5';
  document.getElementById('pu-k5').style.cssText='flex:1;padding:8px;border-radius:6px;border:2px solid var(--amber);background:var(--amber);color:#000;font-weight:700;cursor:pointer';
  document.getElementById('pu-k6').style.cssText='flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text2);cursor:pointer';
  document.getElementById('price-update-file').value='';
  document.getElementById('price-update-result').style.display='none';
  document.getElementById('m-price-update').classList.add('on');
}


function reloadRecvFromServer() {
  if(!CURRENT_TOKEN){ alert('로그인 필요'); return; }
  setSyncStatus('syncing', '매입·불출 이력 로드 중...');
  apiGet({ action:'getSheets', sheets:'recv_items,out_items,stock_items' })
    .then(function(res) {
      if(!res || !res.ok || !res.data) { setSyncStatus('error','로드 실패'); return; }
      var changed = false;
      if(res.data['recv_items'] && res.data['recv_items'].length) {
        RECV = res.data['recv_items'];
        var _2y=(new Date().getFullYear()-2)+'-01-01';
        try { localStorage.setItem(K.RECV, JSON.stringify(RECV.filter(function(r){return (r.order_date||'')>=_2y;}))); } catch(e){}
        renderRecv(); renderAggIfOpen(); renderRecvDash();
        changed = true;
      }
      if(res.data['out_items'] && res.data['out_items'].length) {
        OUT = res.data['out_items'];
        var _2yo=(new Date().getFullYear()-2)+'-01-01';
        try { localStorage.setItem(K.OUT, JSON.stringify(OUT.filter(function(r){return (r.date||'')>=_2yo;}))); } catch(e){}
        renderOut(); changed = true;
      }
      if(res.data['stock_items'] && res.data['stock_items'].length) {
        STOCK = res.data['stock_items'];
        renderStock();
        var bdg=document.getElementById('b-stock'); if(bdg) bdg.textContent=STOCK.length;
        changed = true;
      }
      updateStat();
      setSyncStatus('ok');
      if(changed) alert('✅ 불러오기 완료\n매입이력 '+RECV.length+'건 / 불출이력 '+OUT.length+'건 / 재고 '+STOCK.length+'건');
      else alert('서버에 데이터 없음');
    })
    .catch(function(e){ setSyncStatus('error', e.message); alert('오류: '+e.message); });
}


function lPg(d){lPn+=d;renderLT();}


function prevLT(pn){
  const id=pn.replace(/[^a-zA-Z0-9]/g,'_');
  const lt=parseFloat(document.getElementById('li-'+id)?.value)||0;
  const r=DB.find(x=>x.pn===pn);
  const el=document.getElementById('lp-'+id);
  if(el&&r&&lt>0&&r.fc>0)el.textContent='안전재고 '+Math.round(r.fc*(lt/4.3+1))+'개';
}


function saveLT(pn){
  const id=pn.replace(/[^a-zA-Z0-9]/g,'_');
  const lt=parseFloat(document.getElementById('li-'+id)?.value)||0;
  if(!lt){alert('주수를 입력하세요');return;}
  const idx=DB.findIndex(x=>x.pn===pn);
  if(idx<0)return;
  const old=DB[idx].lt||0;
  DB[idx].lt=lt;
  if(DB[idx].fc>0)DB[idx].sf=Math.round(DB[idx].fc*(lt/4.3+1));
  HIST.unshift({pn,date:new Date().toLocaleString('ko-KR'),action:'LT 입력',
    changes:[{f:'LT',o:old||'없음',n:lt+'주'}]});
  sv(K.DB,DB);sv(K.HIST,HIST);
  renderLT();updateStat();
}


function clearSrch(){
  document.getElementById('sq').value='';
  document.getElementById('srch-results').innerHTML='';
  document.getElementById('bom-results').innerHTML='';
  document.getElementById('sq-hint').textContent='품번 전체 또는 일부 · 품명 · 제조사 · 보관좌표 검색 가능 | BOM 조회: 상위품번 입력 후 BOM 버튼';
}


function doSrch(){
  var sqEl = document.getElementById('sq');
  if(!sqEl){ console.error('sq 없음'); return; }
  var q = sqEl.value.trim().toLowerCase();
  var hintEl = document.getElementById('sq-hint');
  var resEl  = document.getElementById('srch-results');

  if(!q){
    if(hintEl) hintEl.textContent = '검색어를 입력하세요';
    return;
  }
  if(!DB || DB.length === 0){
    if(hintEl) hintEl.textContent = '⏳ DB 로딩 중...';
    return;
  }

  var hits = [];
  for(var i=0; i<DB.length; i++){
    var r = DB[i];
    var pn = String(r.pn||'').toLowerCase();
    var d  = String(r.d||'').toLowerCase();
    var mg = String(r.mg||'').toLowerCase();
    var by = String(r.by||'').toLowerCase();
    var lc = String(r.lc||'').toLowerCase();
    var mp = String(r.mp||'').toLowerCase();
    if(pn.includes(q)||d.includes(q)||mg.includes(q)||mp.includes(q)||by.includes(q)||lc.includes(q)){
      hits.push(r);
      if(hits.length>=20) break;
    }
  }

  if(hintEl) hintEl.textContent = hits.length ? hits.length+'건 검색됨' : '"'+q+'" 결과 없음 (DB:'+DB.length+'건)';
  if(!resEl){ console.error('srch-results 없음'); return; }

  if(!hits.length){
    resEl.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3)">🔍 "'+q+'"에 해당하는 품목이 없습니다</div>';
    return;
  }
  resEl.innerHTML = hits.map(function(r){ return buildItemCard(r); }).join('');
}


function buildItemCard(r){
  if(!r || !r.pn) return '';
  try {
  var _recv = Array.isArray(RECV) ? RECV : [];
  var _out  = Array.isArray(OUT)  ? OUT  : [];
  var totalIn  = _recv.filter(function(x){return x.pn===r.pn;}).reduce(function(s,x){return s+(+x.qty||0);},0);
  var totalOut = _out.filter(function(x){return x.pn===r.pn;}).reduce(function(s,x){return s+(+x.qty||0);},0);
  var stock    = totalIn - totalOut;
  var sf       = r.sf || 0;
  var stockCls = sf>0 ? (stock>=sf?'ok':stock>0?'warn':'bad') : 'na';
  var _bom     = (typeof BOM === 'object' && BOM) ? BOM : {};
  var hasBOM   = _bom[r.pn] && _bom[r.pn].length > 0;
  var altTag   = r.ia ? '<span class="bd ba" style="margin-left:4px;font-size:10px">대체품</span>' : '';
  var isViewer = !CURRENT_USER || CURRENT_USER.role==='viewer' || CURRENT_USER.role==='guest';
  var pnSafe   = String(r.pn||'').replace(/"/g,'&quot;');
  var catMap   = {'부품':'bt','와이어_케이블':'ba','하네스_도면':'bp'};
  var catBdg   = r.ct ? '<span class="bd '+(catMap[r.ct]||'bk')+'" style="font-size:10px">'+r.ct+'</span>' : '';
  var ltTxt    = r.lt>0 ? r.lt+'주' : '미입력';
  var p6       = r.k6>0 ? r.k6.toLocaleString()+'원' : r.k5>0 ? r.k5.toLocaleString()+'원 (25년)' : '—';
  var stockVal = (totalIn>0||totalOut>0) ? stock : '—';
  var locVal   = r.lc || '—';

  var bomBtn = hasBOM ? '<button class="btn sm" style="background:var(--pbg);color:var(--pur);border:1px solid var(--pur);font-size:11px" onclick="showBOM(this.dataset.pn)" data-pn="'+pnSafe+'">🌿 BOM</button>' : '';
  var reqBtn = isViewer ? '' : '<button class="btn ba-btn sm" style="font-size:11px;white-space:nowrap" onclick="addToReq(this.dataset.pn)" data-pn="'+pnSafe+'">+ 불출요청</button>';
  var googleQuery=((r.mg||'')+' '+(r.mp||'')).trim();
  var googleBtn=googleQuery
    ?'<button class="btn ba-btn sm" style="font-size:11px;white-space:nowrap;background:none;border:1px solid var(--border2);color:var(--text2)" onclick="window.open(\'https://www.google.com/search?q=\'+this.dataset.q.replace(/ /g,\'+\'),\'_blank\')" data-q="'+googleQuery.replace(/"/g,'&quot;')+'" title="'+googleQuery+'로 구글 검색">🔍 구글</button>'
    :'';

  // viewer: 현재고 + 보관위치 2칸
  var statBoxes = isViewer
    ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px">'
      + '<div style="background:var(--bg3);border-radius:7px;padding:10px 14px;text-align:center">'
        + '<div style="font-size:10px;color:var(--text3);margin-bottom:4px">현재고</div>'
        + '<div class="ic-sv '+stockCls+'" style="font-size:22px;font-weight:700">'+stockVal+'</div>'
      + '</div>'
      + '<div style="background:var(--bg3);border-radius:7px;padding:10px 14px;text-align:center">'
        + '<div style="font-size:10px;color:var(--text3);margin-bottom:4px">보관위치</div>'
        + '<div style="font-size:16px;font-weight:700;font-family:var(--mono);color:var(--tel)">'+locVal+'</div>'
      + '</div>'
    + '</div>'
    // 일반/관리자: 6칸 그리드
    : '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px">'
      + '<div style="background:var(--bg3);border-radius:7px;padding:8px 10px;text-align:center">'
        + '<div style="font-size:10px;color:var(--text3);margin-bottom:3px">현재고</div>'
        + '<div class="ic-sv '+stockCls+'" style="font-size:18px;font-weight:700">'+stockVal+'</div>'
      + '</div>'
      + '<div style="background:var(--bg3);border-radius:7px;padding:8px 10px;text-align:center">'
        + '<div style="font-size:10px;color:var(--text3);margin-bottom:3px">보관위치</div>'
        + '<div style="font-size:13px;font-weight:600;font-family:var(--mono);color:var(--tel)">'+locVal+'</div>'
      + '</div>'
      + '<div style="background:var(--bg3);border-radius:7px;padding:8px 10px;text-align:center">'
        + '<div style="font-size:10px;color:var(--text3);margin-bottom:3px">매입가</div>'
        + '<div style="font-size:11px;font-weight:600;color:var(--text2)">'+p6+'</div>'
      + '</div>'
      + '<div style="background:var(--bg3);border-radius:7px;padding:8px 10px;text-align:center">'
        + '<div style="font-size:10px;color:var(--text3);margin-bottom:3px">안전재고</div>'
        + '<div style="font-size:16px;font-weight:600;color:var(--text)">'+(sf>0?sf:'—')+'</div>'
      + '</div>'
      + '<div style="background:var(--bg3);border-radius:7px;padding:8px 10px;text-align:center">'
        + '<div style="font-size:10px;color:var(--text3);margin-bottom:3px">LT</div>'
        + '<div style="font-size:13px;font-weight:600;color:'+(r.lt>0?'var(--text)':'var(--amber)')+'">'+ltTxt+'</div>'
      + '</div>'
      + '<div style="background:var(--bg3);border-radius:7px;padding:8px 10px;text-align:center">'
        + '<div style="font-size:10px;color:var(--text3);margin-bottom:3px">FCST/월</div>'
        + '<div style="font-size:16px;font-weight:600;color:var(--pur)">'+(r.fc>0?r.fc:'—')+'</div>'
      + '</div>'
    + '</div>';

  return '<div class="item-card">'
    + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">'
      + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
        + '<span style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--tel)">'+r.pn+'</span>'
        + catBdg + altTag
      + '</div>'
      + '<div style="display:flex;gap:5px;flex-shrink:0">'+bomBtn+reqBtn+googleBtn+'</div>'
    + '</div>'
    + '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+r.d+'</div>'
    + '<div style="font-size:11px;color:var(--text3);margin-bottom:'+(isViewer?'0':'2px')+'">'
      + '<span style="color:var(--text2)">'+(r.mg||'—')+'</span>'
      + (r.mp ? ' · <span style="font-family:var(--mono)">'+r.mp+'</span>' : '')
      + (r.by ? ' · <span style="color:var(--text3)">'+r.by+'</span>' : '')
    + '</div>'
    // 총매입/총불출은 viewer에게 숨김
    + (isViewer ? '' : '<div style="font-size:10px;color:var(--text3)">총 매입 '+totalIn+' · 총 불출 '+totalOut+'</div>')
    + statBoxes
    + '</div>';
  } catch(e) {
    console.error('buildItemCard 오류:', e, r);
    return '<div class="item-card"><div style="font-family:var(--mono);color:var(--teal)">' + (r.pn||'') + '</div><div style="color:var(--text);margin-top:4px">' + (r.d||'') + '</div></div>';
  }
}


function showBOM(parentPN){
  var _pn = String(parentPN||'').trim().replace(/\.0$/, '');
  document._currentBOMPN = _pn;
  var children = BOM[_pn];
  if(!children || !children.length){
    document.getElementById('bom-results').innerHTML =
      '<div class="bom-tree"><div style="color:var(--text3);font-size:12px;padding:20px">BOM 데이터 없음: '+_pn+'</div></div>';
    return;
  }
  var parent = DB.find(function(x){return String(x.pn||'').replace(/\.0$/,'')===_pn;}) || {pn:_pn, d:'', ct:''};
  var LV_COLORS = {1:'var(--tel)',2:'var(--pur)',3:'var(--grn)',4:'var(--amb)',5:'var(--red)'};

  var tbodyRows = children.map(function(item, i) {
    // pn 필드 호환성 - 가능한 모든 키 시도
    if(!item.pn) {
      item.pn = item.child || item.item || item.partNumber || item.part_number ||
                item.childPn || item.child_pn || '';
    }
    // 숫자인 경우 문자열 변환
    if(typeof item.pn === 'number') item.pn = String(item.pn);
    item.pn = String(item.pn || '').trim().replace(/\.0$/, '');
    var lv  = item.lv || 1;
    var r   = DB.find(function(x){return String(x.pn||'').replace(/\.0$/,'')===String(item.pn||'').replace(/\.0$/,'');}) || {};
    var col = LV_COLORS[lv] || 'var(--tel)';
    var indent = (lv-1)*16;
    var noDb = item.pn && !r.pn;
    var altBadge = (item.isAlt || r.ia)
      ? '<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:var(--amb-bg,#2a1f00);color:var(--amb);border:1px solid var(--amb)">대체</span>'
      : '<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:var(--bg3);color:var(--grn);border:1px solid var(--grn)">정품</span>';
    var noteStr = (item.note||r.op) ? ((item.note||'')+(r.op?' 기존:'+r.op:'')) : '—';
    var aqtyStr = (item.aqty!==undefined) ? item.aqty : item.qty;
    var aqtyColor = (item.aqty!==undefined && item.aqty!==item.qty) ? 'var(--amb)' : 'var(--text3)';
    return '<tr style="border-bottom:1px solid var(--border2)">'
      + '<td style="padding:7px 10px;font-family:var(--mono);font-size:12px;color:'+col+';white-space:nowrap;padding-left:'+(10+indent)+'px">'
        + (lv>1 ? '<span style="color:var(--text3);margin-right:4px">\u2514</span>' : '')
        + (item.pn || '—')
        + (noDb ? '<span style="font-size:9px;margin-left:4px;padding:1px 5px;border-radius:3px;background:var(--red-bg);color:var(--red)">DB없음</span>' : '')
      + '</td>'
      + '<td style="padding:7px 10px;color:var(--text);font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+(r.d||item.desc||'')+'">'+(r.d||item.desc||'—')+'</td>'
      + '<td style="padding:7px 10px;font-size:11px;color:var(--text2);white-space:nowrap">'+(r.mg||item.mfg||'—')+'</td>'
      + '<td style="padding:7px 10px;font-family:var(--mono);font-size:11px;color:var(--text2);white-space:nowrap">'+(r.mp||item.mfgPn||'—')+'</td>'
      + '<td style="padding:7px 10px;font-family:var(--mono);font-weight:700;color:var(--pur);text-align:right;white-space:nowrap">'+item.qty+'</td>'
      + '<td style="padding:7px 10px;font-family:var(--mono);text-align:right;white-space:nowrap;color:'+aqtyColor+'">'+aqtyStr+'</td>'
      + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);white-space:nowrap">'+(item.unit||'EA')+'</td>'
      + '<td style="padding:7px 10px;text-align:center;white-space:nowrap">'+altBadge+'</td>'
      + '<td style="padding:7px 10px;font-size:11px;color:var(--text3);max-width:120px;overflow:hidden;text-overflow:ellipsis" title="'+(item.note||'')+'">'+noteStr+'</td>'
      + '<td style="padding:7px 10px;font-family:var(--mono);font-size:11px;color:var(--tel);white-space:nowrap">'+(r.lc||item.loc||'—')+'</td>'
      + '</tr>';
  }).join('');

  var thead = '<thead><tr style="background:var(--bg3)">'
    + '<th style="padding:7px 10px;font-size:11px;color:var(--text3);border-bottom:1px solid var(--border);white-space:nowrap">품번</th>'
    + '<th style="padding:7px 10px;font-size:11px;color:var(--text3);border-bottom:1px solid var(--border)">품명</th>'
    + '<th style="padding:7px 10px;font-size:11px;color:var(--text3);border-bottom:1px solid var(--border);white-space:nowrap">제조사</th>'
    + '<th style="padding:7px 10px;font-size:11px;color:var(--text3);border-bottom:1px solid var(--border);white-space:nowrap">제조사품번</th>'
    + '<th style="padding:7px 10px;font-size:11px;color:var(--text3);border-bottom:1px solid var(--border);text-align:right;white-space:nowrap">수량</th>'
    + '<th style="padding:7px 10px;font-size:11px;color:var(--text3);border-bottom:1px solid var(--border);text-align:right;white-space:nowrap">실수량</th>'
    + '<th style="padding:7px 10px;font-size:11px;color:var(--text3);border-bottom:1px solid var(--border);white-space:nowrap">단위</th>'
    + '<th style="padding:7px 10px;font-size:11px;color:var(--text3);border-bottom:1px solid var(--border);text-align:center;white-space:nowrap">정품/대체</th>'
    + '<th style="padding:7px 10px;font-size:11px;color:var(--text3);border-bottom:1px solid var(--border)">비고</th>'
    + '<th style="padding:7px 10px;font-size:11px;color:var(--text3);border-bottom:1px solid var(--border);white-space:nowrap">보관장소</th>'
    + '</tr></thead>';

  document.getElementById('bom-results').innerHTML =
    '<div class="bom-tree">'
    + '<div class="bom-tree-title" style="flex-wrap:wrap;gap:6px">'
      + '<span>\ud83c\udf3f BOM \uc804\uac1c</span>'
      + '<span style="font-family:var(--mono);color:var(--tel)">'+_pn+'</span>'
      + '<span style="font-size:12px;font-weight:400;color:var(--text2)">'+(parent.d||'')+'</span>'
      + '<span style="font-size:11px;color:var(--text3);font-weight:400">\ud558\uc704\ubd80\ud488 '+children.length+'\uac74</span>'
      + '<button class="btn bk-btn sm" style="margin-left:auto" onclick="addBOMToReq(document._currentBOMPN)">\ud83d\udce4 \uc804\uccb4 \ubd88\ucd9c\uc694\uccad</button>'
      + '<button class="btn bk-btn sm" onclick="exportBOMView(document._currentBOMPN)">\u2b07 CSV</button>'
    + '</div>'
    + '<div style="overflow-x:auto;margin-top:8px">'
      + '<table style="width:100%;border-collapse:collapse;table-layout:auto">'
      + thead
      + '<tbody style="font-size:12px">'+tbodyRows+'</tbody>'
      + '</table>'
    + '</div>'
    + '</div>';
}


function exportBOMView(parentPN){
  const children=BOM[parentPN]||[];
  const parent=DB.find(x=>x.pn===parentPN)||{pn:parentPN};
  const esc=v=>{const s=String(v==null?'':v);return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:s;};
  const header=['상위품번','상위품명','LV','하위품번','Category','품명','제조사','제조사품번','REV','수량','실수량','단위','정품/대체품','비고','보관좌표'];
  const rows=children.map(c=>{
    const r=DB.find(x=>x.pn===c.pn)||{};
    const altStr=c.isAlt?`대체(${c.isAlt})`:r.ia?`대체(${r.ay||''})`: '정품';
    return [parentPN,parent.d||'',c.lv||1,c.pn,r.ct||'',r.d||c.desc||'',r.mg||c.mfg||'',r.mp||c.mfgPn||'',r.rv||'',c.qty,c.aqty??c.qty,c.unit||'EA',altStr,c.note||'',r.lc||c.loc||''];
  });
  const csv=[header,...rows].map(r=>r.map(esc).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`BOM_${parentPN}_${new Date().toISOString().split('T')[0]}.csv`;a.click();
  URL.revokeObjectURL(url);
}


function addBOMToReq(parentPN){
  const children=BOM[parentPN]||[];
  children.forEach(item=>{
    if(!reqItems.find(x=>x.pn===item.pn)){
      const r=DB.find(x=>x.pn===item.pn)||{pn:item.pn,d:''};
      reqItems.push({pn:item.pn,d:r.d||'',qty:item.qty||1,unit:'EA',note:''});
    }
  });
  renderReqPanel();
}


function removeReqItem(i){reqItems.splice(i,1);renderReqPanel();}


function renderReqPanel(){
  const panel=document.getElementById('req-panel');
  panel.style.display=reqItems.length||true?'block':'none'; // 항상 표시
  document.getElementById('req-tbody').innerHTML=reqItems.length
    ? reqItems.map((r,i)=>`<tr>
        <td style="text-align:center"><input type="checkbox" class="lt-chk" data-pn="${r.pn}" onchange="ltSelChange()" style="accent-color:var(--teal);width:13px;height:13px"></td>
    <td style="font-family:var(--mono);font-size:11px;color:var(--tel)">${r.pn}</td>
        <td style="font-size:12px">${r.d||'—'}</td>
        <td><input type="number" min="1" value="${r.qty}" style="width:60px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:3px 6px;color:var(--text);font-size:12px" onchange="reqItems[${i}].qty=+this.value"></td>
        <td><select style="background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:3px 5px;color:var(--text);font-size:12px" onchange="reqItems[${i}].unit=this.value"><option>EA</option><option>M</option><option>Foot</option></select></td>
        <td><input type="text" placeholder="비고" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:3px 6px;color:var(--text);font-size:12px" onchange="reqItems[${i}].note=this.value"></td>
        <td><button class="btn br-btn sm" style="padding:2px 7px" onclick="removeReqItem(${i})">✕</button></td>
      </tr>`).join('')
    : `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:16px;font-size:12px">검색결과에서 + 불출요청 버튼을 눌러 품목을 추가하세요</td></tr>`;
}


function clearReq(){
  if(reqItems.length&&!confirm('요청 목록을 초기화하시겠습니까?'))return;
  reqItems=[];renderReqPanel();
}


function chkMode(m){
  chkViewMode=m;
  document.getElementById('cm-full').classList.toggle('on', m==='full');
  document.getElementById('cm-wire').classList.toggle('on', m==='wire');
  document.getElementById('chk-full-view').style.display=m==='full'?'':'none';
  document.getElementById('chk-wire-view').style.display=m==='wire'?'':'none';
  if(m==='wire') renderWire();
}


function cChip(f){
  if(f==='all'){cF.clear();cF.add('all');}
  else{cF.delete('all');cF.has(f)?cF.delete(f):cF.add(f);if(!cF.size)cF.add('all');}
  document.querySelectorAll('[id^="cc-"]').forEach(el=>el.classList.remove('on'));
  cF.forEach(k=>{document.getElementById('cc-'+k)?.classList.add('on');});
  chkPn=1; renderChkFull();
}


function isOverdue(item){
  if(!item.lastDate) return true;
  const cycle=GRADE_CYCLE[item.grade]||30;
  return (Date.now()-new Date(item.lastDate).getTime())/86400000 > cycle;
}


function daysSinceLast(item){
  if(!item.lastDate) return null;
  return Math.floor((Date.now()-new Date(item.lastDate).getTime())/86400000);
}


function getInspector(){
  return document.getElementById('chk-inspector')?.value.trim()||'';
}


function toggleBulk(){
  bulkOpen=!bulkOpen;
  document.getElementById('bulk-body').style.display=bulkOpen?'':'none';
  document.getElementById('bulk-arrow').textContent=bulkOpen?'▲':'▼';
  if(bulkOpen) loadBulkItems();
}


function bulkInputChange(pn,el,sf){
  const v=parseFloat(el.value);
  el.className=isNaN(v)?'':(sf>0?(v>=sf?'b-ok':'b-low'):'b-ok');
}


function saveBulkAll(){
  const dt=document.getElementById('blk-dt')?.value;
  if(!dt){alert('점검일을 입력하세요');return;}
  const insp=document.getElementById('blk-insp')?.value.trim()||getInspector()||'';
  const rows=document.querySelectorAll('[id^="brow-"]');
  let cnt=0, skipped=0;
  rows.forEach(tr=>{
    const safeId=tr.id.replace('brow-','');
    const qEl=document.getElementById('bq-'+safeId);
    const nEl=document.getElementById('bn-'+safeId);
    if(!qEl||qEl.value===''){skipped++;return;}
    // 원래 품번 복원 (safeId는 특수문자를 _로 치환했으므로 CHK에서 찾기)
    const r=CHK.find(x=>x.pn.replace(/\W/g,'_')===safeId);
    if(!r){skipped++;return;}
    const qty=parseFloat(qEl.value);
    const note=nEl?.value.trim()||'';
    const sf=r.sf>0?r.sf:(DB.find(x=>x.pn===r.pn)||{sf:0}).sf||0;
    const ok=sf>0?(qty>=sf):true;
    const idx=CHK.indexOf(r);
    CHK[idx].lastDate=dt;CHK[idx].lastQty=qty;CHK[idx].lastNote=note;CHK[idx].lastInsp=insp;
    if(!CHKHIST[r.pn])CHKHIST[r.pn]=[];
    CHKHIST[r.pn].unshift({date:dt,qty,note,ok,sf,insp});
    cnt++;
  });
  sv(K.CHK,CHK);sv(K.CHKHIST,CHKHIST);
  renderChkFull();loadBulkItems();
  alert(`✅ ${cnt}건 저장 완료${skipped?` (${skipped}건 수량 미입력 건너뜀)`:''}`);
}


function renderChkFull(){
  const q=(document.getElementById('cq')||{value:''}).value.toLowerCase();
  // 지원본부 품목 (하네스 제외)
  let data=CHK.filter(r=>{
    const dbr=DB.find(x=>x.pn===r.pn)||{};
    const dept=dbr.dept||r.dept||'지원본부';
    if(dept==='하네스') return false;
    if(q&&!(r.pn+r.desc).toLowerCase().includes(q)) return false;
    if(cF.has('all')) return true;
    if(cF.has('A')&&r.grade==='A') return true;
    if(cF.has('B')&&r.grade==='B') return true;
    if(cF.has('C')&&r.grade==='C') return true;
    if(cF.has('over')&&isOverdue(r)) return true;
    if(cF.has('done')&&r.lastDate) return true;
    return false;
  });
  const tot=data.length, pages=Math.ceil(tot/CHKP)||1;
  if(chkPn>pages)chkPn=1;
  const sl=data.slice((chkPn-1)*CHKP,chkPn*CHKP);
  document.getElementById('chk-cnt').textContent=`${tot}건`;
  document.getElementById('chk-pgn').textContent=`${chkPn}/${pages} (${tot}건)`;
  document.getElementById('chkp').disabled=chkPn===1;
  document.getElementById('chkn').disabled=chkPn===pages;

  if(!CHK.length){
    document.getElementById('chk-tbody').innerHTML=`<tr><td colspan="14" style="text-align:center;padding:40px;color:var(--text3)">점검 목록이 없습니다. <b>+ 품목 추가</b>로 등록하세요.</td></tr>`;
    return;
  }
  document.getElementById('chk-tbody').innerHTML=sl.map(r=>{
    const over=isOverdue(r);
    const days=daysSinceLast(r);
    const dbr=DB.find(x=>x.pn===r.pn)||{};
    const sf=r.sf>0?r.sf:dbr.sf||0;
    const mfg=dbr.mg||'—';
    const mfgPn=dbr.mp||'—';
    const lastQty=r.lastQty!==undefined?r.lastQty:'—';
    const stockCls=sf>0&&r.lastQty!==undefined?(r.lastQty>=sf?'grn':r.lastQty>0?'amb':'red'):'text3';
    const statusTxt=r.lastDate?(r.lastQty!==undefined&&sf>0?(r.lastQty>=sf?'✅ 충족':'⚠️ 부족'):'✔ 완료'):'🔴 미점검';
    const overTxt=over&&r.lastDate?`<span style="color:var(--red);font-size:10px"> (${days}일)</span>`:'';
    const inspTxt=r.lastInsp?`<span style="font-size:11px;color:var(--text2)">${r.lastInsp}</span>`:'—';
    return `<tr class="${over?'chk-over':''}">
      <td><input type="checkbox" class="recv-chk item-chk" data-idx="${CHK.indexOf(r)}"></td>
      <td style="text-align:center"><input type="checkbox" class="lt-chk" data-pn="${r.pn}" onchange="ltSelChange()" style="accent-color:var(--teal);width:13px;height:13px"></td>
    <td style="font-family:var(--mono);font-size:11px;color:var(--tel)">${r.pn}</td>
      <td style="color:var(--text)" title="${r.desc||''}">${r.desc||'—'}</td>
      <td style="font-size:11px;color:var(--text2)">${mfg}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${mfgPn}</td>
      <td><span class="bd" style="background:${GRADE_COLOR[r.grade]||'var(--bg4)'}22;color:${GRADE_COLOR[r.grade]||'var(--text3)'};border:1px solid ${GRADE_COLOR[r.grade]||'var(--border)'}">${r.grade||'—'}</span></td>
      <td style="font-size:11px;color:var(--text3)">${GRADE_LABEL[r.grade]||'—'}</td>
      <td style="font-family:var(--mono);text-align:right">${sf||'—'}</td>
      <td style="font-family:var(--mono);text-align:right;color:var(--${stockCls})">${lastQty}</td>
      <td style="font-size:11px">${r.lastDate||'<span style="color:var(--red)">없음</span>'}${overTxt}</td>
      <td>${inspTxt}</td>
      <td style="font-size:11px">${statusTxt}</td>
      <td style="font-size:11px;color:var(--text3)" title="${r.note||''}">${r.note||'—'}</td>
      <td><div style="display:flex;gap:4px">
        <button class="btn bt-btn sm" style="padding:3px 7px;font-size:10px" onclick="openChkIn('${r.pn}')">입력</button>
        <button class="btn bk-btn sm" style="padding:3px 7px;font-size:10px" onclick="openChkHist('${r.pn}')">이력</button>
        <button class="btn bk-btn sm" style="padding:3px 7px;font-size:10px" onclick="openEditChk('${r.pn}')">편집</button>
      </div></td>
    </tr>`;
  }).join('');
}


function chkPg(d){chkPn+=d;renderChkFull();}


function toggleAllChk(el){document.querySelectorAll('.item-chk').forEach(c=>c.checked=el.checked);}


function openAddChkModal(){
  editChkPN=null;
  document.getElementById('m-chk-title').innerHTML='점검 품목 추가 <button class="mx" onclick="closeM(\'m-chk\')">✕</button>';
  document.getElementById('ck-del').style.display='none';
  ['ck-pn','ck-desc','ck-sf','ck-note'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('ck-gr').value='B';
  document.getElementById('m-chk').classList.add('on');
}


function openEditChk(pn){
  const r=CHK.find(x=>x.pn===pn);if(!r)return;
  editChkPN=pn;
  document.getElementById('m-chk-title').innerHTML='점검 품목 편집 <button class="mx" onclick="closeM(\'m-chk\')">✕</button>';
  document.getElementById('ck-del').style.display='';
  document.getElementById('ck-pn').value=r.pn;
  document.getElementById('ck-gr').value=r.grade||'B';
  document.getElementById('ck-desc').value=r.desc||'';
  document.getElementById('ck-sf').value=r.sf||'';
  document.getElementById('ck-note').value=r.note||'';
  document.getElementById('m-chk').classList.add('on');
}


function autoFillChk(){
  const pn=document.getElementById('ck-pn').value.trim();
  const r=DB.find(x=>x.pn===pn);
  if(r){
    document.getElementById('ck-desc').value=r.d||'';
    document.getElementById('ck-sf').value=r.sf||'';
    if(pn.startsWith('77'))document.getElementById('ck-gr').value='B';
  }
}


function saveChkItem(){
  const pn=document.getElementById('ck-pn').value.trim();
  if(!pn){alert('품번을 입력하세요');return;}
  const obj={pn,grade:document.getElementById('ck-gr').value||'B',
    desc:document.getElementById('ck-desc').value.trim()||(DB.find(x=>x.pn===pn)||{d:''}).d||'',
    sf:parseFloat(document.getElementById('ck-sf').value)||0,
    note:document.getElementById('ck-note').value.trim(),
    lastDate:null,lastQty:undefined,lastNote:'',lastInsp:''};
  if(editChkPN){
    const idx=CHK.findIndex(x=>x.pn===editChkPN);
    if(idx>=0){const old=CHK[idx];obj.lastDate=old.lastDate;obj.lastQty=old.lastQty;obj.lastNote=old.lastNote;obj.lastInsp=old.lastInsp||'';CHK[idx]=obj;}
  } else {
    if(CHK.find(x=>x.pn===pn)){alert('이미 등록된 품번입니다');return;}
    CHK.push(obj);
  }
  sv(K.CHK,CHK);closeM('m-chk');renderChkFull();loadBulkItems();
}


function delChkItem(){
  if(!editChkPN||!confirm('삭제하시겠습니까?'))return;
  const idx=CHK.findIndex(x=>x.pn===editChkPN);
  if(idx>=0)CHK.splice(idx,1);
  sv(K.CHK,CHK);closeM('m-chk');renderChkFull();loadBulkItems();
}


function openChkIn(pn){
  chkInPN=pn;
  const r=CHK.find(x=>x.pn===pn)||{};
  document.getElementById('m-chkin-title').innerHTML=`실재고 입력 — <span style="font-family:var(--mono);color:var(--tel)">${pn}</span> <button class="mx" onclick="closeM('m-chkin')">✕</button>`;
  document.getElementById('cin-dt').value=new Date().toISOString().split('T')[0];
  document.getElementById('cin-insp').value=getInspector();
  document.getElementById('cin-qty').value=r.lastQty!==undefined?r.lastQty:'';
  document.getElementById('cin-note').value='';
  document.getElementById('m-chkin').classList.add('on');
}


function saveChkIn(){
  const qty=document.getElementById('cin-qty').value;
  if(qty===''){alert('실재고를 입력하세요');return;}
  const dt=document.getElementById('cin-dt').value;
  const note=document.getElementById('cin-note').value.trim();
  const insp=document.getElementById('cin-insp').value.trim()||getInspector()||'';
  let idx=CHK.findIndex(x=>x.pn===chkInPN);
  if(idx<0){
    const dbr=DB.find(x=>x.pn===chkInPN)||{};
    CHK.push({pn:chkInPN,grade:'B',desc:dbr.d||'',sf:dbr.sf||0,note:'',lastDate:null,lastQty:undefined,lastNote:'',lastInsp:''});
    idx=CHK.length-1;
  }
  const sf=CHK[idx].sf||0;
  const ok=sf>0?(+qty>=sf):true;
  CHK[idx].lastDate=dt;CHK[idx].lastQty=+qty;CHK[idx].lastNote=note;CHK[idx].lastInsp=insp;
  if(!CHKHIST[chkInPN])CHKHIST[chkInPN]=[];
  CHKHIST[chkInPN].unshift({date:dt,qty:+qty,note,ok,sf,insp});
  sv(K.CHK,CHK);sv(K.CHKHIST,CHKHIST);
  closeM('m-chkin');renderChkFull();loadBulkItems();
  if(chkViewMode==='wire')renderWire();
}


function openChkHist(pn){
  const hist=CHKHIST[pn]||[];
  const r=CHK.find(x=>x.pn===pn)||{};
  document.getElementById('m-chkhist-title').innerHTML=`점검 이력 — <span style="font-family:var(--mono);color:var(--tel)">${pn}</span> <span style="font-size:12px;color:var(--text3)">${r.desc||''}</span> <button class="mx" onclick="closeM('m-chkhist')">✕</button>`;
  document.getElementById('chkhist-list').innerHTML=!hist.length
    ?'<div style="text-align:center;padding:30px;color:var(--text3);font-size:12px">점검 이력이 없습니다</div>'
    :hist.map(h=>`<div class="ht-item">
        <div class="ht-dot ${h.ok?'ok':'low'}"></div>
        <div class="ht-body">
          <div class="ht-date">${h.date}${h.insp?` · <b>${h.insp}</b>`:''}</div>
          <div class="ht-val" style="color:${h.ok?'var(--grn)':'var(--red)'}">${h.qty} <span style="font-size:11px;color:var(--text3)">/ 안전재고 ${h.sf||'—'}</span></div>
          ${h.note?`<div class="ht-note">${h.note}</div>`:''}
        </div>
      </div>`).join('');
  document.getElementById('m-chkhist').classList.add('on');
}


function syncDBtoCHK(){
  let added=0;
  DB.forEach(r=>{
    if(!r.dept||r.dept==='미관리') return;
    if(CHK.find(x=>x.pn===r.pn)) return; // 이미 있음
    CHK.push({
      pn:r.pn, grade:'B',
      sf:r.sf||0, note:'',
      lastDate:null, lastQty:undefined, lastNote:'', lastInsp:''
    });
    added++;
  });
  // CHK에 있는데 DB에서 품명/안전재고 변경된 경우 동기화
  CHK.forEach((c,i)=>{
    const dbr=DB.find(x=>x.pn===c.pn);
    if(dbr){
      if(dbr.d&&dbr.d!==c.desc) CHK[i].desc=dbr.d;
      if(dbr.sf>0&&dbr.sf!==c.sf) CHK[i].sf=dbr.sf;
    }
  });
  if(added>0){sv(K.CHK,CHK);}
  return added;
}


function wChip(f){
  if(f==='all'){wF.clear();wF.add('all');}
  else{wF.delete('all');wF.has(f)?wF.delete(f):wF.add(f);if(!wF.size)wF.add('all');}
  document.querySelectorAll('[id^="wc-"]').forEach(el=>el.classList.remove('on'));
  wF.forEach(k=>{document.getElementById('wc-'+k)?.classList.add('on');});
  wirePn=1; renderWire();
}


function wirePg(d){wirePn+=d;renderWire();}


function toggleAllWire(el){document.querySelectorAll('.wire-item-chk').forEach(c=>c.checked=el.checked);}


function renderWire(){
  syncDBtoCHK();
  const q=(document.getElementById('wq')||{value:''}).value.toLowerCase();
  let data=CHK.filter(r=>{
    const dbr=DB.find(x=>x.pn===r.pn)||{};
    const dept=dbr.dept||r.dept||'';
    if(dept!=='하네스') return false;
    if(q&&!(r.pn+r.desc).toLowerCase().includes(q)) return false;
    if(wF.has('all')) return true;
    if(wF.has('A')&&r.grade==='A') return true;
    if(wF.has('B')&&r.grade==='B') return true;
    if(wF.has('C')&&r.grade==='C') return true;
    if(wF.has('over')&&isOverdue(r)) return true;
    if(wF.has('done')&&r.lastDate) return true;
    return false;
  });

  const tot=data.length, pages=Math.ceil(tot/WIREP)||1;
  if(wirePn>pages)wirePn=1;
  const sl=data.slice((wirePn-1)*WIREP,wirePn*WIREP);
  document.getElementById('wire-cnt').textContent=`${tot}건`;
  document.getElementById('wire-pgn').textContent=`${wirePn}/${pages} (${tot}건)`;
  document.getElementById('wirep').disabled=wirePn===1;
  document.getElementById('wiren').disabled=wirePn===pages;

  if(!data.length){
    document.getElementById('wire-tbody').innerHTML=`<tr><td colspan="14" style="text-align:center;padding:40px;color:var(--text3)">하네스팀 점검 품목이 없습니다.<br><span style="font-size:11px">품목 DB에서 관리부서를 <b style="color:var(--pur)">하네스</b>로 설정하면 자동으로 표시됩니다.</span></td></tr>`;
    updateHnPendingCnt();
    return;
  }

  document.getElementById('wire-tbody').innerHTML=sl.map(r=>{
    const dbr=DB.find(x=>x.pn===r.pn)||{};
    const over=isOverdue(r);
    const days=daysSinceLast(r);
    const sf=r.sf>0?r.sf:dbr.sf||0;
    const mfg=dbr.mg||'—';
    const mfgPn=dbr.mp||'—';
    const lastQty=r.lastQty!==undefined?r.lastQty:'—';
    const stockCls=sf>0&&r.lastQty!==undefined?(r.lastQty>=sf?'grn':r.lastQty>0?'amb':'red'):'text3';
    const statusTxt=r.lastDate?(r.lastQty!==undefined&&sf>0?(r.lastQty>=sf?'✅ 충족':'⚠️ 부족'):'✔ 완료'):'🔴 미점검';
    const overTxt=over&&r.lastDate?`<span style="color:var(--red);font-size:10px"> (${days}일)</span>`:'';
    const inspTxt=r.lastInsp?`<span style="font-size:11px;color:var(--text2)">${r.lastInsp}</span>`:'—';
    return `<tr class="${over?'chk-over':''}">
      <td><input type="checkbox" class="recv-chk wire-item-chk" data-idx="${CHK.indexOf(r)}"></td>
      <td style="text-align:center"><input type="checkbox" class="lt-chk" data-pn="${r.pn}" onchange="ltSelChange()" style="accent-color:var(--teal);width:13px;height:13px"></td>
    <td style="font-family:var(--mono);font-size:11px;color:var(--tel)">${r.pn}</td>
      <td style="color:var(--text)" title="${r.desc||''}">${r.desc||'—'}</td>
      <td style="font-size:11px;color:var(--text2)">${mfg}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${mfgPn}</td>
      <td><span class="bd" style="background:${GRADE_COLOR[r.grade]||'var(--bg4)'}22;color:${GRADE_COLOR[r.grade]||'var(--text3)'};border:1px solid ${GRADE_COLOR[r.grade]||'var(--border)'}">${r.grade||'—'}</span></td>
      <td style="font-size:11px;color:var(--text3)">${GRADE_LABEL[r.grade]||'—'}</td>
      <td style="font-family:var(--mono);text-align:right">${sf||'—'}</td>
      <td style="font-family:var(--mono);text-align:right;color:var(--${stockCls})">${lastQty}</td>
      <td style="font-size:11px">${r.lastDate||'<span style="color:var(--red)">없음</span>'}${overTxt}</td>
      <td>${inspTxt}</td>
      <td style="font-size:11px">${statusTxt}</td>
      <td style="font-size:11px;color:var(--text3)" title="${r.note||''}">${r.note||'—'}</td>
      <td><div style="display:flex;gap:4px">
        <button class="btn bt-btn sm" style="padding:3px 7px;font-size:10px" onclick="openChkIn('${r.pn}')">입력</button>
        <button class="btn bk-btn sm" style="padding:3px 7px;font-size:10px" onclick="openChkHist('${r.pn}')">이력</button>
        <button class="btn bk-btn sm" style="padding:3px 7px;font-size:10px" onclick="openEditChk('${r.pn}')">편집</button>
      </div></td>
    </tr>`;
  }).join('');
  updateHnPendingCnt();
}


function hnCard(r){
  const sf=r.sf>0?r.sf:(DB.find(x=>x.pn===r.pn)||{sf:0}).sf||0;
  const over=isOverdue(r);
  const overTag=over?`<span style="font-size:9px;color:var(--red)"> 기한초과</span>`:'';
  const hist=CHKHIST[r.pn]||[];
  const lastOk=hist.length>0?hist[0].ok:null;
  const cardCls=lastOk===true?'ok':lastOk===false?'low':'na';
  const safeId=r.pn.replace(/\W/g,'_');
  const lastTxt=r.lastDate
    ?`<div style="font-size:10px;color:var(--text3)">${r.lastDate}${r.lastInsp?` · ${r.lastInsp}`:''}</div>`
    :`<div style="font-size:10px;color:var(--amb)">미점검</div>`;
  const okSel=r.lastDate&&lastOk===true?'sel':'';
  const lowSel=r.lastDate&&lastOk===false?'sel':'';
  return `<div class="hn-card ${cardCls}" id="hn-${safeId}">
    <div><div style="font-family:var(--mono);font-size:11px;color:var(--tel)">${r.pn}</div>
      <span class="bd" style="font-size:9px;background:${GRADE_COLOR[r.grade]||'var(--bg4)'}22;color:${GRADE_COLOR[r.grade]||'var(--text3)'}">${r.grade||'—'}</span>${overTag}
    </div>
    <div style="font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.desc||''}">${r.desc||'—'}</div>
    <div style="font-size:11px;text-align:center;color:var(--text3)">SF: <b style="font-family:var(--mono)">${sf||'—'}</b></div>
    <div style="font-size:10px;text-align:center">${lastTxt}${hist.length>0?`<button class="btn bk-btn sm" style="font-size:9px;padding:2px 5px;margin-top:3px" onclick="openChkHist('${r.pn}')">이력 ${hist.length}</button>`:''}</div>
    <div class="hn-btns">
      <button class="hn-ok ${okSel}" id="hn-ok-${safeId}" onclick="saveHnCheck('${r.pn}',true)">✅ 충족</button>
      <button class="hn-low ${lowSel}" id="hn-low-${safeId}" onclick="saveHnCheck('${r.pn}',false)">❌ 미달</button>
    </div>
    <div style="font-size:10px;color:var(--text3)">${r.lastDate||''}${r.lastInsp?`<br>${r.lastInsp}`:''}</div>
  </div>`;
}


function saveHnCheck(pn, ok){
  const dt=document.getElementById('hn-dt')?.value||new Date().toISOString().split('T')[0];
  const insp=document.getElementById('hn-insp')?.value.trim()||getInspector()||'';
  let idx=CHK.findIndex(x=>x.pn===pn);
  if(idx<0){
    const dbr=DB.find(x=>x.pn===pn)||{};
    CHK.push({pn,grade:'B',desc:dbr.d||'',sf:dbr.sf||0,note:'',lastDate:null,lastQty:undefined,lastNote:'',lastInsp:''});
    idx=CHK.length-1;
  }
  const sf=CHK[idx].sf||(DB.find(x=>x.pn===pn)||{sf:0}).sf||0;
  CHK[idx].lastDate=dt;
  CHK[idx].lastQty=ok?sf:0; // 충족=안전재고값, 미달=0 (기록용)
  CHK[idx].lastNote=ok?'충족':'미달';
  CHK[idx].lastInsp=insp;
  if(!CHKHIST[pn])CHKHIST[pn]=[];
  CHKHIST[pn].unshift({date:dt,qty:ok?sf:0,note:ok?'충족':'미달',ok,sf,insp});
  sv(K.CHK,CHK);sv(K.CHKHIST,CHKHIST);

  // 카드 즉시 업데이트
  const card=document.getElementById('hn-'+pn.replace(/\W/g,'_'));
  if(card){
    card.className=`hn-card ${ok?'ok':'low'}`;
    document.getElementById('hn-ok-'+pn.replace(/\W/g,'_'))?.classList.toggle('sel',ok);
    document.getElementById('hn-low-'+pn.replace(/\W/g,'_'))?.classList.toggle('sel',!ok);
    // 최근점검일 셀 업데이트
    const cells=card.querySelectorAll('div');
    if(cells[3]){cells[3].innerHTML=`<div style="font-size:10px;color:var(--text3)">${dt}${insp?' · '+insp:''}</div>`;}
  }
  updateHnPendingCnt();
}


function updateHnPendingCnt(){
  const el=document.getElementById('hn-pending-cnt');
  if(!el)return;
  const hnItems=CHK.filter(r=>{
    const dbr=DB.find(x=>x.pn===r.pn)||{};
    return (dbr.dept||r.dept||'')===('하네스');
  });
  const pending=hnItems.filter(r=>isOverdue(r)).length;
  el.textContent=pending;
}


function wireInputChange(){}


function saveWireStock(){}


function bomSubTab(mode){
  bomSubMode=mode;
  document.getElementById('bom-view-mgmt').style.display=mode==='mgmt'?'':'none';
  document.getElementById('bom-view-req').style.display=mode==='req'?'':'none';
  document.getElementById('bst-mgmt').classList.toggle('on',mode==='mgmt');
  document.getElementById('bst-req').classList.toggle('on',mode==='req');
}


function resetBOM(){
  if(!confirm('⚠️ BOM 전체를 초기화하시겠습니까?\n\n현재 저장된 모든 BOM 데이터가 삭제됩니다.'))return;
  BOM={};
  sv(K.BOM,BOM);
  bomSelParent=null;
  renderBOM();
  renderBOMChildren();
  updateBOMStat();
  alert('BOM이 초기화되었습니다.');
}


function bChip(f){
  if(f==='all'){bomFilter.clear();bomFilter.add('all');}
  else{bomFilter.delete('all');bomFilter.has(f)?bomFilter.delete(f):bomFilter.add(f);if(!bomFilter.size)bomFilter.add('all');}
  document.querySelectorAll('[id^="bc-"]').forEach(el=>el.classList.remove('on'));
  bomFilter.forEach(k=>{document.getElementById('bc-'+k)?.classList.add('on');});
  renderBOM();
}


function updateBOMStat(){
  const parents=Object.keys(BOM);
  const totalChildren=parents.reduce((s,p)=>s+(BOM[p]||[]).length,0);
  const allChildren=[...new Set(parents.flatMap(p=>(BOM[p]||[]).map(c=>c.pn)))];
  const notInDB=allChildren.filter(pn=>!DB.find(x=>x.pn===pn)).length;
  const noBOM=DB.filter(r=>(r.ct==='조립도_도면'||r.ct==='하네스_도면'||r.ct==='KIT')&&!BOM[r.pn]).length;
  document.getElementById('bom-s0').textContent=parents.length;
  document.getElementById('bom-s1').textContent=totalChildren;
  document.getElementById('bom-s2').textContent=notInDB;
  document.getElementById('bom-s3').textContent=noBOM;
  if(document.getElementById('b-bom'))document.getElementById('b-bom').textContent=parents.length;
}


function getBOMParents(){
  const q=(document.getElementById('bq')||{value:''}).value.toLowerCase();
  return Object.keys(BOM).filter(pn=>{
    const dbr=DB.find(x=>x.pn===pn)||{};
    if(q&&!(pn+(dbr.d||'')).toLowerCase().includes(q)) return false;
    if(bomFilter.has('all')) return true;
    if(bomFilter.has('조립')&&dbr.ct==='조립도_도면') return true;
    if(bomFilter.has('하네스')&&dbr.ct==='하네스_도면') return true;
    if(bomFilter.has('KIT')&&dbr.ct==='KIT') return true;
    return false;
  }).sort((a,b)=>a.localeCompare(b,'ko'));
}


function renderBOM(){
  updateBOMStat();
  const parents=getBOMParents();
  document.getElementById('bom-parent-cnt').textContent=parents.length+'건';
  const listEl=document.getElementById('bom-parent-list');
  if(!parents.length){
    listEl.innerHTML=`<div class="bom-empty-state" style="padding:30px">
      <div style="font-size:20px;margin-bottom:6px">🧩</div>
      <div style="font-size:12px">등록된 BOM이 없습니다</div>
      <div style="font-size:11px;margin-top:4px">+ BOM 등록으로 추가하세요</div>
    </div>`;
    return;
  }
  listEl.innerHTML=parents.map(pn=>{
    const dbr=DB.find(x=>x.pn===pn)||{};
    const cnt=(BOM[pn]||[]).length;
    const isSel=pn===bomSelParent;
    return `<div class="bom-prow${isSel?' sel':''}" onclick="selectBOMParent('${pn}')">
      <div style="min-width:0;flex:1">
        <div class="bom-ppn">${pn}</div>
        <div class="bom-pdesc">${dbr.d||'<span style="color:var(--amb)">DB 미등록</span>'}</div>
      </div>
      <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
        <span class="bom-pcnt">${cnt}건</span>
        <button class="btn br-btn" style="padding:2px 7px;font-size:10px;border-radius:4px" title="삭제"
          onclick="event.stopPropagation();deleteBOMFromList('${pn}')">✕</button>
      </div>
    </div>`;
  }).join('');
}


function deleteBOMFromList(pn){
  const cnt=(BOM[pn]||[]).length;
  if(!confirm(`상위품번 '${pn}' BOM을 삭제하시겠습니까?\n(하위품목 ${cnt}건)` ))return;
  delete BOM[pn];
  sv(K.BOM,BOM);
  if(bomSelParent===pn){bomSelParent=null;renderBOMChildren();}
  renderBOM();
  updateBOMStat();
}


function selectBOMParent(pn){
  bomSelParent=pn;
  bomChildSortKey='no'; bomChildSortDir=1;
  renderBOM();
  renderBOMChildren();
}


function sortChildRows(){
  if(!bomSelParent)return;
  // NO → LV → PN 순환
  const keys=['no','lv','pn'];
  const cur=keys.indexOf(bomChildSortKey);
  if(cur<0||cur===keys.length-1){bomChildSortKey='no';bomChildSortDir=1;}
  else{bomChildSortKey=keys[cur+1];}
  BOM[bomSelParent].sort((a,b)=>{
    const va=a[bomChildSortKey]??0, vb=b[bomChildSortKey]??0;
    if(typeof va==='number') return (va-vb)*bomChildSortDir;
    return String(va).localeCompare(String(vb),'ko')*bomChildSortDir;
  });
  sv(K.BOM,BOM);
  renderBOMChildren();
  // 버튼에 현재 정렬 기준 표시
  const btn=document.getElementById('bom-sort-btn');
  if(btn) btn.textContent={no:'⇅ NO순',lv:'⇅ LV순',pn:'⇅ 품번순'}[bomChildSortKey]||'⇅ 정렬';
}


function renderBOMChildren(){
  const pn=bomSelParent;
  const btns=['bom-tree-btn','bom-del-btn','bom-add-child-btn','bom-sort-btn'];
  if(!pn){
    document.getElementById('bom-right-title').textContent='상위품번을 선택하세요';
    document.getElementById('bom-right-sub').textContent='';
    document.getElementById('bom-right-body').innerHTML=`<div class="bom-empty-state"><div style="font-size:32px;margin-bottom:10px">🧩</div><div>왼쪽에서 상위품번을 선택하면</div><div style="font-size:11px;margin-top:4px">하위 부품 목록이 표시됩니다</div></div>`;
    btns.forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
    return;
  }
  const dbr=DB.find(x=>x.pn===pn)||{};
  const children=BOM[pn]||[];
  document.getElementById('bom-right-title').textContent=pn;
  document.getElementById('bom-right-sub').textContent=(dbr.d||'DB 미등록 품번')+` · 하위부품 ${children.length}건`;
  btns.forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='';});

  const tbody=children.map((c,i)=>{
    // pn 호환성 처리
    if(!c.pn&&c.child) c.pn=c.child;
    if(!c.pn&&c.item)  c.pn=c.item;
    if(typeof c.pn==='number') c.pn=String(c.pn);
    c.pn=String(c.pn||'').trim().replace(/\.0$/,'');
    const cdbr=DB.find(x=>String(x.pn||'').replace(/\.0$/,'')===String(c.pn||'').replace(/\.0$/,''))||{};
    const inDB=!!cdbr.pn;
    const lv=c.lv||1;
    const lvCol={1:'var(--tel)',2:'var(--pur)',3:'var(--grn)',4:'var(--amb)',5:'var(--red)'}[lv]||'var(--text3)';
    const altBadge=c.isAlt
      ?`<span class="bd ${c.isAlt==='승인'?'bg':c.isAlt==='미결'?'ba':'bk'}" style="font-size:9px">${c.isAlt}</span>`
      :(cdbr.ia?`<span class="alt-badge" style="font-size:9px">대체</span>`:'<span class="orig-badge" style="font-size:9px">정품</span>');
    const aqtyTxt=c.aqty!==undefined&&c.aqty!==c.qty
      ?`<span style="color:var(--amb)">${c.aqty}</span>`
      :`${c.aqty??c.qty}`;
    return `<tr>
      
      
      <td style="font-family:var(--mono);font-size:11px;color:var(--tel)">${c.pn}${!inDB?` <span class="bd ba" style="font-size:9px">DB없음</span>`:''}</td>
      <td style="color:var(--text)">${cdbr.d||'—'}</td>
      <td style="font-size:11px;color:var(--text3)">${cdbr.mg||'—'}</td>
      <td style="font-size:11px;color:var(--text3);font-family:var(--mono)">${cdbr.mp||'—'}</td>
      <td style="font-family:var(--mono);font-weight:700;color:var(--pur);text-align:right">${c.qty}</td>
      <td style="font-family:var(--mono);text-align:right;font-size:11px">${aqtyTxt}</td>
      <td style="font-size:11px">${c.unit||'EA'}</td>
      <td style="text-align:center">${altBadge}</td>
      <td style="font-size:11px;color:var(--text3)">${c.note||'—'}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--tel);white-space:nowrap">${(DB.find(x=>x.pn===c.pn)||{}).lc||c.loc||'—'}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn bk-btn sm" style="padding:3px 7px;font-size:10px" onclick="editChildRow(${i})">편집</button>
          <button class="btn br-btn sm" style="padding:3px 7px;font-size:10px" onclick="deleteChildRow(${i})">삭제</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('bom-right-body').innerHTML=`
    <div style="overflow-x:auto;max-height:520px;overflow-y:auto">
      <table class="bom-child-table">
        <thead><tr>
          <th style="white-space:nowrap">품번</th>
          <th>품명</th>
          <th style="white-space:nowrap">제조사</th>
          <th style="white-space:nowrap">제조사품번</th>
          <th style="text-align:right;white-space:nowrap">수량</th>
          <th style="text-align:right;white-space:nowrap">실수량</th>
          <th style="white-space:nowrap">단위</th>
          <th style="text-align:center;white-space:nowrap">정품/대체</th>
          <th>비고</th>
          <th style="white-space:nowrap">보관장소</th>
          <th style="width:70px">관리</th>
        </tr></thead>
        <tbody id="bom-child-tbody">${tbody}</tbody>
      </table>
    </div>`;
}


function addChildRow(){
  if(!bomSelParent){alert('상위품번을 먼저 선택하세요');return;}
  const tbody=document.getElementById('bom-child-tbody');
  if(!tbody)return;
  // 기존 추가행 있으면 제거
  document.getElementById('bom-new-row')?.remove();
  const tr=document.createElement('tr');
  tr.id='bom-new-row';
  tr.className='bom-add-row';
  tr.innerHTML=`
    <td><input id="bnr-pn" placeholder="품번" oninput="bnrAutofill()" style="font-family:var(--mono)"></td>
    <td><input id="bnr-desc" placeholder="자동입력" readonly style="color:var(--text3)"></td>
    <td><input id="bnr-mfg" placeholder="자동입력" readonly style="color:var(--text3)"></td>
    <td><input id="bnr-mp" placeholder="자동입력" readonly style="color:var(--text3)"></td>
    <td><input id="bnr-qty" type="number" min="0" step="0.001" placeholder="1" style="text-align:right;font-family:var(--mono)"></td>
    <td><select id="bnr-unit"><option>EA</option><option>M</option><option>Foot</option><option>SET</option><option>KG</option></select></td>
    <td><input id="bnr-note" placeholder="비고"></td>
    <td>
      <div style="display:flex;gap:4px">
        <button class="btn bt-btn sm" style="padding:3px 7px;font-size:10px" onclick="saveNewChild()">✅</button>
        <button class="btn bk-btn sm" style="padding:3px 7px;font-size:10px" onclick="document.getElementById('bom-new-row')?.remove()">✕</button>
      </div>
    </td>`;
  tbody.appendChild(tr);
  document.getElementById('bnr-pn').focus();
}


function bnrAutofill(){
  const pn=document.getElementById('bnr-pn')?.value.trim();
  const r=DB.find(x=>x.pn===pn);
  const desc=document.getElementById('bnr-desc');
  const mfg=document.getElementById('bnr-mfg');
  const mp=document.getElementById('bnr-mp');
  if(r){
    if(desc){desc.value=r.d||'';desc.style.color='var(--text)';}
    if(mfg){mfg.value=r.mg||'';mfg.style.color='var(--text)';}
    if(mp){mp.value=r.mp||'';mp.style.color='var(--text)';}
  } else {
    if(desc){desc.value='';desc.style.color='var(--text3)';}
    if(mfg){mfg.value='';mfg.style.color='var(--text3)';}
    if(mp){mp.value='';mp.style.color='var(--text3)';}
  }
}


function saveNewChild(){
  const pn=document.getElementById('bnr-pn')?.value.trim();
  if(!pn){alert('하위품번을 입력하세요');return;}
  const qty=parseFloat(document.getElementById('bnr-qty')?.value)||1;
  const unit=document.getElementById('bnr-unit')?.value||'EA';
  const note=document.getElementById('bnr-note')?.value.trim()||'';
  if(!BOM[bomSelParent])BOM[bomSelParent]=[];
  // 중복 체크
  if(BOM[bomSelParent].find(c=>c.pn===pn)){
    if(!confirm(`'${pn}'이 이미 등록되어 있습니다. 수량을 갱신하시겠습니까?`))return;
    const idx=BOM[bomSelParent].findIndex(c=>c.pn===pn);
    BOM[bomSelParent][idx]={pn,qty,unit,note};
  } else {
    BOM[bomSelParent].push({pn,qty,unit,note});
  }
  sv(K.BOM,BOM);
  renderBOMChildren();
  updateBOMStat();
}


function editChildRow(i){
  if(!bomSelParent)return;
  const c=BOM[bomSelParent][i];
  if(!c)return;
  // 기존 추가행 제거
  document.getElementById('bom-new-row')?.remove();
  // 해당 행을 편집모드로 교체
  const tbody=document.getElementById('bom-child-tbody');
  const rows=tbody.querySelectorAll('tr');
  const tr=rows[i];
  if(!tr)return;
  const cdbr=DB.find(x=>String(x.pn||'').replace(/\.0$/,'')===String(c.pn||'').replace(/\.0$/,''))||{};
  tr.className='bom-add-row';
  tr.innerHTML=`
    <td><input id="bnr-pn-${i}" value="${c.pn}" oninput="bnrAutofillEdit(${i})" style="font-family:var(--mono)"></td>
    <td><input id="bnr-desc-${i}" value="${cdbr.d||''}" readonly style="color:var(--text3)"></td>
    <td><input id="bnr-mfg-${i}" value="${cdbr.mg||''}" readonly style="color:var(--text3)"></td>
    <td><input id="bnr-mp-${i}" value="${cdbr.mp||''}" readonly style="color:var(--text3)"></td>
    <td><input id="bnr-qty-${i}" type="number" min="0" step="0.001" value="${c.qty}" style="text-align:right;font-family:var(--mono)"></td>
    <td><select id="bnr-unit-${i}">
      <option${c.unit==='EA'?' selected':''}>EA</option>
      <option${c.unit==='M'?' selected':''}>M</option>
      <option${c.unit==='Foot'?' selected':''}>Foot</option>
      <option${c.unit==='SET'?' selected':''}>SET</option>
      <option${c.unit==='KG'?' selected':''}>KG</option>
    </select></td>
    <td><input id="bnr-note-${i}" value="${c.note||''}"></td>
    <td>
      <div style="display:flex;gap:4px">
        <button class="btn bt-btn sm" style="padding:3px 7px;font-size:10px" onclick="saveEditChild(${i})">✅</button>
        <button class="btn bk-btn sm" style="padding:3px 7px;font-size:10px" onclick="renderBOMChildren()">✕</button>
      </div>
    </td>`;
}


function bnrAutofillEdit(i){
  const pn=document.getElementById(`bnr-pn-${i}`)?.value.trim();
  const r=DB.find(x=>x.pn===pn);
  const desc=document.getElementById(`bnr-desc-${i}`);
  const mfg=document.getElementById(`bnr-mfg-${i}`);
  const mp=document.getElementById(`bnr-mp-${i}`);
  if(r){
    if(desc){desc.value=r.d||'';desc.style.color='var(--text)';}
    if(mfg){mfg.value=r.mg||'';mfg.style.color='var(--text)';}
    if(mp){mp.value=r.mp||'';mp.style.color='var(--text)';}
  }
}


function saveEditChild(i){
  const pn=document.getElementById(`bnr-pn-${i}`)?.value.trim();
  if(!pn){alert('품번을 입력하세요');return;}
  const qty=parseFloat(document.getElementById(`bnr-qty-${i}`)?.value)||1;
  const unit=document.getElementById(`bnr-unit-${i}`)?.value||'EA';
  const note=document.getElementById(`bnr-note-${i}`)?.value.trim()||'';
  BOM[bomSelParent][i]={pn,qty,unit,note};
  sv(K.BOM,BOM);
  renderBOMChildren();
  updateBOMStat();
}


function deleteChildRow(i){
  if(!bomSelParent)return;
  if(!confirm('이 하위품목을 삭제하시겠습니까?'))return;
  BOM[bomSelParent].splice(i,1);
  sv(K.BOM,BOM);
  renderBOMChildren();
  updateBOMStat();
  renderBOM();
}


function deleteParentBOM(){
  if(!bomSelParent)return;
  if(!confirm(`상위품번 '${bomSelParent}'의 BOM 전체를 삭제하시겠습니까?\n하위품목 ${(BOM[bomSelParent]||[]).length}건이 모두 삭제됩니다.`))return;
  delete BOM[bomSelParent];
  sv(K.BOM,BOM);
  bomSelParent=null;
  renderBOM();
  renderBOMChildren();
  updateBOMStat();
}


function openAddBOMParent(){
  document.getElementById('bom-add-parent').value='';
  document.getElementById('bom-add-memo').value='';
  document.getElementById('bom-add-parent-info').textContent='';
  document.getElementById('m-bom-add').classList.add('on');
  setTimeout(()=>document.getElementById('bom-add-parent').focus(),100);
}


function bomParentAutofill(){
  const pn=document.getElementById('bom-add-parent')?.value.trim();
  const r=DB.find(x=>x.pn===pn);
  const info=document.getElementById('bom-add-parent-info');
  if(r) info.textContent=`✅ ${r.d||''} ${r.ct?'· '+r.ct:''}`;
  else if(pn) info.textContent='⚠ 품목 DB에 없는 품번 (직접 등록 가능)';
  else info.textContent='';
}


function saveBOMParent(){
  const pn=document.getElementById('bom-add-parent')?.value.trim();
  if(!pn){alert('상위품번을 입력하세요');return;}
  if(BOM[pn]&&BOM[pn].length>0){
    if(!confirm(`'${pn}'은 이미 BOM이 등록되어 있습니다. 이어서 편집하시겠습니까?`))return;
  } else {
    BOM[pn]=BOM[pn]||[];
    sv(K.BOM,BOM);
  }
  closeM('m-bom-add');
  bomSelParent=pn;
  renderBOM();
  renderBOMChildren();
  updateBOMStat();
}


function openBOMTree(){
  if(!bomSelParent)return;
  const dbr=DB.find(x=>x.pn===bomSelParent)||{};
  document.getElementById('bom-tree-title').innerHTML=
    `🌳 BOM 트리 — <span style="font-family:var(--mono);color:var(--tel)">${bomSelParent}</span> <span style="font-size:12px;color:var(--text3)">${dbr.d||''}</span>
     <button class="mx" onclick="closeM('m-bom-tree')">✕</button>`;
  document.getElementById('bom-tree-body').innerHTML=buildBOMTree(bomSelParent,0,new Set());
  document.getElementById('m-bom-tree').classList.add('on');
}


function buildBOMTree(pn, depth, visited){
  if(visited.has(pn)||depth>6) return `<div style="padding:4px ${depth*20+8}px;font-size:11px;color:var(--red)">⚠ 순환참조 감지: ${pn}</div>`;
  visited=new Set(visited);visited.add(pn);
  const dbr=DB.find(x=>x.pn===pn)||{};
  const children=BOM[pn]||[];
  const indent=depth*20;
  let html=`<div class="tree-row" style="padding-left:${indent+8}px">
    ${depth>0?`<span class="tree-icon">${depth===1?'└':'└'}</span>`:''}
    <span class="tree-pn" style="color:${depth===0?'var(--tel)':'var(--tel)'}">${pn}</span>
    <span class="tree-desc">${dbr.d||'<span style="color:var(--amb)">DB 미등록</span>'}</span>
    ${depth>0?`<span class="tree-qty" style="color:var(--pur)">×${children.find?.[0]?.qty||''}</span>`:''}
  </div>`;
  children.forEach(c=>{
    const cdbr=DB.find(x=>String(x.pn||'').replace(/\.0$/,'')===String(c.pn||'').replace(/\.0$/,''))||{};
    const hasChildren=BOM[c.pn]&&BOM[c.pn].length>0;
    html+=`<div class="tree-row" style="padding-left:${indent+28}px">
      <span class="tree-icon" style="color:var(--border2)">└</span>
      <span class="tree-pn">${c.pn}</span>
      <span class="tree-desc">${cdbr.d||'<span style="color:var(--amb)">DB 미등록</span>'}</span>
      <span class="tree-qty">×${c.qty}${c.unit&&c.unit!=='EA'?' '+c.unit:''}</span>
      <span class="tree-stock" style="color:var(--text3)">${cdbr.sf>0?'SF:'+cdbr.sf:''}</span>
    </div>`;
    if(hasChildren) html+=buildBOMTree(c.pn,depth+1,visited);
  });
  return html;
}


function reqParentAutofill(){
  const pn=document.getElementById('req-parent-pn')?.value.trim();
  const r=DB.find(x=>x.pn===pn);
  const info=document.getElementById('req-parent-info');
  const hasBOM=BOM[pn]&&BOM[pn].length>0;
  if(r) info.innerHTML=`✅ ${r.d||''} ${r.ct?`<span class="bd ${catCls[r.ct]||'bk'}" style="font-size:9px">${r.ct}</span>`:''}${hasBOM?` <span class="bd bt" style="font-size:9px">BOM ${BOM[pn].length}건</span>`:''}`;
  else if(pn&&hasBOM) info.innerHTML=`⚠ DB 미등록 품번 · <span class="bd bt" style="font-size:9px">BOM ${BOM[pn].length}건</span>`;
  else if(pn) info.textContent='⚠ BOM 없음 — 품번 확인 필요';
  else info.textContent='';
}


function calcReq(){
  const pn=document.getElementById('req-parent-pn')?.value.trim();
  const qty=parseFloat(document.getElementById('req-qty')?.value)||1;
  if(!pn){alert('상위품번을 입력하세요');return;}
  const children=BOM[pn];
  if(!children||!children.length){alert(`'${pn}' BOM이 없습니다`);return;}
  const ALT_STR={'승인':'대체(승인)','미결':'대체(미결)','한시적승인':'대체(한시)','검토중':'대체(검토)','불가':'대체(불가)'};
  reqData=children.map(c=>{
    const r=DB.find(x=>x.pn===c.pn)||{};
    const dept=r.dept||'미관리';
    const isManaged=(dept==='지원본부'||dept==='하네스');
    const altStr=c.isAlt?ALT_STR[c.isAlt]||`대체(${c.isAlt})`:r.ia?`대체(${r.ay||''})`: '정품';
    const needQty=Math.round((c.aqty??c.qty)*qty*1000)/1000;
    return {
      lv:c.lv||1, no:c.no||0, pn:c.pn,
      desc:r.d||'—', mfg:r.mg||'—', mfgPn:r.mp||'—', rv:r.rv||'—',
      needQty, unit:c.unit||'EA',
      altStr, note:c.note||r.op?`${c.note||''}${r.op?' 기존:'+r.op:''}`.trim():'—',
      dept, isManaged, loc:r.lc||'—', ct:r.ct||''
    };
  });
  reqSortKey=''; reqSortDir=1;
  // 필터바 표시
  const fb=document.getElementById('req-filter-bar');
  if(fb) fb.style.display='flex';
  document.getElementById('req-print-btn').style.display='';
  document.getElementById('req-csv-btn').style.display='';
  document.getElementById('req-result-wrap').style.display='';
  // 인쇄 헤더
  const pdbr=DB.find(x=>x.pn===pn)||{};
  document.getElementById('req-ph-title').textContent=`소요량 조회 — ${pn}  ×${qty}`;
  document.getElementById('req-ph-sub').textContent=`${pdbr.d||''}  ·  ${new Date().toLocaleDateString('ko-KR')}  ·  총 ${children.length}건`;
  renderReqTable();
}


function renderReqTable(){
  const showMgmt=document.getElementById('req-show-mgmt')?.checked!==false;
  const showUnmgmt=document.getElementById('req-show-unmgmt')?.checked!==false;
  let data=reqData.filter(r=>r.isManaged?showMgmt:showUnmgmt);
  if(reqSortKey){
    data=[...data].sort((a,b)=>{
      const va=a[reqSortKey]??'', vb=b[reqSortKey]??'';
      if(typeof va==='number') return (va-vb)*reqSortDir;
      return String(va).localeCompare(String(vb),'ko')*reqSortDir;
    });
  }
  const mgmt=reqData.filter(r=>r.isManaged).length;
  const unmgmt=reqData.length-mgmt;
  document.getElementById('req-summary').textContent=`관리대상 ${mgmt}건 · 미관리 ${unmgmt}건`;
  // 헤더 정렬 표시
  document.querySelectorAll('#req-thead-row th').forEach(th=>{th.classList.remove('srt');});
  const ALT_BADGE_MAP={'정품':'<span class="orig-badge" style="font-size:9px">정품</span>',};
  document.getElementById('req-bom-tbody').innerHTML=data.map(r=>{
    const deptBadge=r.dept==='지원본부'?`<span class="bd dept-jb" style="font-size:9px">지원</span>`
      :r.dept==='하네스'?`<span class="bd dept-hn" style="font-size:9px">하네스</span>`
      :`<span class="bd dept-na" style="font-size:9px">미관리</span>`;
    const altBadge=r.altStr==='정품'?'<span class="orig-badge" style="font-size:9px">정품</span>'
      :`<span class="alt-badge" style="font-size:9px">${r.altStr}</span>`;
    const lvCol={1:'var(--tel)',2:'var(--pur)',3:'var(--grn)',4:'var(--amb)',5:'var(--red)'}[r.lv]||'var(--text3)';
    return `<tr class="${!r.isManaged?'unmanaged':''}">
      <td style="font-family:var(--mono);font-size:11px;color:${lvCol}">${r.pn}</td>
      <td style="color:var(--text)">${r.desc}</td>
      <td style="font-size:11px;color:var(--text3)">${r.mfg}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${r.mfgPn}</td>
      <td style="font-family:var(--mono);font-size:11px">${r.rv}</td>
      <td style="font-family:var(--mono);font-weight:700;color:var(--pur);text-align:right">${r.needQty}</td>
      <td>${r.unit}</td>
      <td style="text-align:center">${altBadge}</td>
      <td style="font-size:11px;color:var(--text3)">${r.note}</td>
      <td style="text-align:center">${deptBadge}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${r.loc}</td>
    </tr>`;
  }).join('');
}


function reqSort(key){
  if(reqSortKey===key) reqSortDir*=-1; else{reqSortKey=key;reqSortDir=1;}
  document.querySelectorAll('#req-thead-row th').forEach(th=>{th.classList.remove('srt');});
  // 현재 정렬 th 강조
  const thMap={pn:0,desc:1,mfg:2,mfgPn:3,rv:4,needQty:5,unit:6,altStr:7,note:8,dept:9,loc:10};
  const idx=thMap[key];
  if(idx!==undefined){
    const ths=document.querySelectorAll('#req-thead-row th');
    if(ths[idx]) ths[idx].classList.add('srt');
  }
  renderReqTable();
}


function printReq(){
  // 인쇄 헤더 표시
  document.getElementById('req-print-header').style.display='block';
  window.print();
  setTimeout(()=>{document.getElementById('req-print-header').style.display='none';},500);
}


function exportReqCSV(){
  const showMgmt=document.getElementById('req-show-mgmt')?.checked!==false;
  const showUnmgmt=document.getElementById('req-show-unmgmt')?.checked!==false;
  const data=reqData.filter(r=>r.isManaged?showMgmt:showUnmgmt);
  const header=['품번','품명','제조사','제조사품번','REV','소요량','단위','정품/대체','비고','관리부서','보관좌표'];
  const rows=data.map(r=>[r.pn,r.desc,r.mfg,r.mfgPn,r.rv,r.needQty,r.unit,r.altStr,r.note,r.dept,r.loc]);
  const esc=v=>{const s=String(v==null?'':v);return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:s;};
  const csv=[header,...rows].map(r=>r.map(esc).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const pn=document.getElementById('req-parent-pn')?.value.trim()||'BOM';
  a.href=url;a.download=`소요량_${pn}_${new Date().toISOString().split('T')[0]}.csv`;a.click();
  URL.revokeObjectURL(url);
}


function exportBOMCSV(){
  const rows=[['상위품번','상위품명','NO','LV','하위품번','Category','품명','제조사','제조사품번','수량','실수량','단위','정품/대체품','비고']];
  Object.keys(BOM).sort().forEach(pn=>{
    const pdbr=DB.find(x=>x.pn===pn)||{};
    (BOM[pn]||[]).forEach(c=>{
      const cdbr=DB.find(x=>String(x.pn||'').replace(/\.0$/,'')===String(c.pn||'').replace(/\.0$/,''))||{};
      const altStr=c.isAlt?`대체(${c.isAlt})`:cdbr.ia?`대체(${cdbr.ay||''})`: '정품';
      rows.push([pn,pdbr.d||'',c.no||'',c.lv||1,c.pn,cdbr.ct||'',cdbr.d||'',cdbr.mg||'',cdbr.mp||'',c.qty,c.aqty??c.qty,c.unit||'EA',altStr,c.note||'']);
    });
  });
  const esc=v=>{const s=String(v==null?'':v);return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:s;};
  const csv=rows.map(r=>r.map(esc).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`BOM_전체_${new Date().toISOString().split('T')[0]}.csv`;a.click();
  URL.revokeObjectURL(url);
}


function openBOMUpload(){
  document.getElementById('bom-up-file').value='';
  document.getElementById('bom-up-result').style.display='none';
  document.getElementById('m-bom-upload').classList.add('on');
}


function exportCSV(tab){
  let rows=[], header=[], fname='';
  const dt=new Date().toISOString().split('T')[0];

  if(tab==='db'){
    header=['품번','품명','REV','Category','제조사','제조사품번','Classification','구매처','LT(주)','MOQ','보관좌표','관리대상','관리부서','24년매입가','25년매입가','26년매입가','매입가($)','FCST월','안전재고','기존품번','기존제조사'];
    rows=filtDB().map(r=>[r.pn,r.d,r.rv,r.ct,r.mg,r.mp,r.cl,r.by,r.lt,r.mq,r.lc,r.managed||'Y',r.dept||'지원본부',r.k4,r.k5,r.k6,r.ud,r.fc,r.sf,r.op,r.om]);
    fname=`품목DB_${dt}.csv`;
  } else if(tab==='recv'){
    header=['발주일','입고요청일','입고일','공급업체','품번','제조사','제조사품번','수량','단위','발주단가','합계금액','결제방식','신고일자','BL번호','비고'];
    rows=filtRecv().map(r=>[r.order_date,r.req_date,r.recv_date,r.vendor,r.pn,r.mfg,r.mfg_pn,r.qty,r.unit,r.unit_price,r.total,r.pay,r.sign_date,r.bl,r.note]);
    fname=`매입이력_${dt}.csv`;
  } else if(tab==='out'){
    header=['불출일','품번','제조사품번','수량','단위','출고목적','출고처','인수자','비고'];
    rows=filtOut().map(r=>[r.date,r.pn,r.mfg_pn,r.qty,r.unit,r.purpose,r.dest,r.receiver,r.note]);
    fname=`자재불출_${dt}.csv`;
  } else if(tab==='lt'){
    const ltData=DB.filter(r=>!r.lt||r.lt===0);
    header=['품번','품명','Category','구매처','FCST월'];
    rows=ltData.map(r=>[r.pn,r.d,r.ct,r.by,r.fc]);
    fname=`LT미입력_${dt}.csv`;
  } else if(tab==='chk'){
    header=['품번','품명','등급','주기','안전재고','최근점검일','실재고','실시자','상태','비고'];
    rows=CHK.map(r=>{
      const sf=r.sf>0?r.sf:(DB.find(x=>x.pn===r.pn)||{sf:0}).sf||0;
      const ok=r.lastQty!==undefined&&sf>0?(r.lastQty>=sf?'충족':'부족'):(r.lastDate?'완료':'미점검');
      return [r.pn,r.desc,r.grade,GRADE_LABEL[r.grade]||'',sf,r.lastDate||'',r.lastQty!==undefined?r.lastQty:'',r.lastInsp||'',ok,r.note||''];
    });
    fname=`재고점검_${dt}.csv`;
  }

  // CSV 생성 (BOM 처리)
  const esc=v=>{
    const s=String(v==null?'':v);
    return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:s;
  };
  const csv=[header,...rows].map(r=>r.map(esc).join(',')).join('\n');
  const bom='\uFEFF'; // UTF-8 BOM (Excel 한글 깨짐 방지)
  const blob=new Blob([bom+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=fname;a.click();
  URL.revokeObjectURL(url);
}


function _onResizerMove(e){
  if(!_rCol) return;
  var w = Math.max(40, _rStartW + (e.clientX - _rStartX));
  _rCol.style.width = w+'px'; _rCol.style.minWidth = w+'px'; _rCol.style.maxWidth = w+'px';
}


function _onResizerUp(){
  if(_rCol) _rCol.querySelectorAll('.col-resizer').forEach(function(d){d.classList.remove('resizing');});
  _rCol=null;
  document.removeEventListener('mousemove',_onResizerMove);
  document.removeEventListener('mouseup',_onResizerUp);
}


function autoFillOutEdit(){
  const pn=document.getElementById('oe-pn').value.trim();
  const dbr=DB.find(x=>x.pn===pn)||{};
  document.getElementById('oe-desc').value=dbr.d||'';
  document.getElementById('oe-mfg').value=dbr.mp||'';
}


function openEditOut(gi){
  editOutIdx=gi;
  const r=OUT[gi];
  if(!r)return;
  document.getElementById('oe-dt').value=r.date||'';
  document.getElementById('oe-pur').value=r.purpose||'자재불출';
  document.getElementById('oe-pn').value=r.pn||'';
  document.getElementById('oe-qty').value=r.qty||'';
  document.getElementById('oe-unit').value=r.unit||'EA';
  document.getElementById('oe-dest').value=r.dest||'';
  document.getElementById('oe-rec').value=r.receiver||'';
  document.getElementById('oe-note').value=r.note||'';
  const dbr=DB.find(x=>x.pn===r.pn)||{};
  document.getElementById('oe-desc').value=dbr.d||'';
  document.getElementById('oe-mfg').value=dbr.mp||r.mfg_pn||'';
  document.getElementById('m-out-edit').classList.add('on');
}


function openOutUpload(){
  document.getElementById('out-up-file').value='';
  document.getElementById('out-up-result').style.display='none';
  document.getElementById('out-up-dropzone').classList.remove('drag');
  document.getElementById('m-out-upload').classList.add('on');
}


function outUpDrag(e,on){e.preventDefault();document.getElementById('out-up-dropzone').classList[on?'add':'remove']('drag');}


function outUpDrop(e){e.preventDefault();outUpDrag(e,false);if(e.dataTransfer.files[0])outUpLoad(e.dataTransfer.files[0]);}


function outUpLoad(file){
  if(!file)return;
  const ext=file.name.split('.').pop().toLowerCase();
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      let wb;
      if(ext==='csv') wb=XLSX.read(e.target.result,{type:'string'});
      else wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      if(raw.length<2){alert('데이터가 없습니다');return;}
      const hdr=raw[0].map(c=>String(c).toLowerCase().replace(/\s/g,''));
      const fi=(kws)=>hdr.findIndex(h=>kws.some(k=>h.includes(k)));
      const dtI=fi(['불출일','date','출고일']),
            pnI=fi(['품목코드','품번','pn','itemcode','partcode']),
            qI =fi(['수량','qty']),
            uI =fi(['단위','unit']),
            purI=fi(['목적','purpose','출고목적']),
            dstI=fi(['출고처','dest','destination']),
            recI=fi(['인수자','receiver','수령']),
            ntI =fi(['비고','note','memo']);
      if(dtI<0||pnI<0||qI<0){alert('필수 열(불출일, 품번, 수량)을 찾을 수 없습니다');return;}
      const ts=v=>String(v||'').trim();
      const tn=(v,d=0)=>{const n=parseFloat(String(v||'').replace(/,/g,''));return isNaN(n)?d:n;};
      let added=0;
      raw.slice(1).forEach(row=>{
        if(!row||row.every(c=>c===''))return;
        const pn=ts(row[pnI]), dt=ts(row[dtI]);
        if(!pn||!dt)return;
        const dbr=DB.find(x=>x.pn===pn)||{};
        OUT.unshift({
          date:dt, pn, mfg_pn:dbr.mp||'',
          qty:tn(row[qI]), unit:uI>=0?ts(row[uI]):'EA',
          purpose:purI>=0?ts(row[purI]):'자재불출',
          dest:dstI>=0?ts(row[dstI]):'',
          receiver:recI>=0?ts(row[recI]):'',
          note:ntI>=0?ts(row[ntI]):'',
          _added:'엑셀업로드 '+new Date().toLocaleString('ko-KR')
        });
        added++;
      });
      sv(K.OUT,OUT);
      const el=document.getElementById('out-up-result');
      el.textContent=`✅ ${added}건 추가 완료`;
      el.style.display='';
      renderOut(); updateStat();
    }catch(err){alert('파싱 오류: '+err.message);}
  };
  ext==='csv'?reader.readAsText(file,'utf-8'):reader.readAsArrayBuffer(file);
}


function resetBOMAddModal(){
  document.getElementById('bom-add-parent').value='';
  document.getElementById('bom-add-memo').value='';
  document.getElementById('bom-add-parent-info').textContent='';
}


function resetBOMFilter(){
  document.getElementById('bq').value='';
  bomFilter=new Set(['all']);
  document.querySelectorAll('[id^="bc-"]').forEach(el=>el.classList.remove('on'));
  document.getElementById('bc-all')?.classList.add('on');
  renderBOM();
}


function resetCHK(){
  if(!confirm('⚠️ 재고점검 데이터를 초기화하시겠습니까?\n\n점검 이력 및 실재고 기록이 모두 삭제됩니다.'))return;
  CHK=[];CHKHIST={};
  sv(K.CHK,CHK);sv(K.CHKHIST,CHKHIST);
  syncDBtoCHK();
  renderChkFull&&renderChkFull();
  renderWire&&renderWire();
  alert('✅ 재고점검 데이터가 초기화되었습니다.');
}


function resetChkInModal(){
  document.getElementById('cin-dt').value=new Date().toISOString().split('T')[0];
  document.getElementById('cin-insp').value='';
  document.getElementById('cin-qty').value='';
  document.getElementById('cin-note').value='';
}


function resetChkModal(){
  document.getElementById('ck-pn').value='';
  document.getElementById('ck-desc').value='';
  document.getElementById('ck-sf').value='';
  document.getElementById('ck-note').value='';
  document.getElementById('ck-gr').value='A';
}


function resetDBFilter(){
  document.getElementById('dq').value='';
  dF=new Set(['all']); dSk='pn'; dSd=1; dPn=1;
  document.querySelectorAll('[id^="dc-"]').forEach(el=>el.classList.remove('on'));
  document.getElementById('dc-all')?.classList.add('on');
  renderDB();
}


function resetDBModal(){
  const ids=['f-pn','f-rv','f-desc','f-mfg','f-mp','f-cls','f-op','f-om','f-loc',
             'f-by','f-lt','f-mq','f-p4','f-p5','f-p6','f-ud','f-qu','f-qk','f-tg','f-fc','f-sf'];
  ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const cat=document.getElementById('f-cat'); if(cat) cat.value='부품';
  const mg=document.getElementById('f-mg');   if(mg)  mg.value='Y';
  const dept=document.getElementById('f-dept'); if(dept) dept.value='지원본부';
  const ay=document.getElementById('f-ay');   if(ay)  ay.value='';
  const pa=document.getElementById('price-compare-area'); if(pa) pa.innerHTML='';
}


function resetLTFilter(){
  document.getElementById('lq').value='';
  lF=new Set(['all']); lPn=1;
  document.querySelectorAll('[id^="lc-"]').forEach(el=>el.classList.remove('on'));
  document.getElementById('lc-all')?.classList.add('on');
  renderLT();
}


function resetOutFilter(){
  document.getElementById('oq').value='';
  oF=new Set(['all']); oSk='date'; oSd=-1; oPn=1;
  document.querySelectorAll('[id^="oc-"]').forEach(el=>el.classList.remove('on'));
  document.getElementById('oc-all')?.classList.add('on');
  renderOut();
}


function resetOutModal(){
  if(!confirm('입력한 내용을 모두 초기화하시겠습니까?'))return;
  document.getElementById('o-dt').value=new Date().toISOString().split('T')[0];
  document.getElementById('o-dest').value='';
  document.getElementById('o-rec').value='';
  document.getElementById('o-pur').value='자재불출';
  document.getElementById('bom-pn').value='';
  document.getElementById('bom-expand-qty').value='1';
  document.getElementById('bom-status').textContent='';
  document.getElementById('out-rows').innerHTML='';
  outRowId=0;
  addOutRow();
  updateOutTotal();
}


function resetRecvFilter(){
  document.getElementById('rq').value='';
  rF=new Set(['all']); rSk='order_date'; rSd=-1; rPn=1;
  document.querySelectorAll('[id^="rc-"]').forEach(el=>el.classList.remove('on'));
  document.getElementById('rc-all')?.classList.add('on');
  renderRecv();
}


function resetRecvModal(){
  if(!confirm('입력한 내용을 모두 초기화하시겠습니까?'))return;
  document.getElementById('r-od').value=new Date().toISOString().split('T')[0];
  document.getElementById('r-rd').value='';
  document.getElementById('r-vd').value='';
  document.getElementById('r-bl').value='';
  document.getElementById('r-sd').value='';
  document.getElementById('r-pay').value='정기 결제';
  document.getElementById('recv-rows').innerHTML='';
  recvRowId=0;
  addRecvRow(); addRecvRow();
  updateRecvTotal();
}


function resetReqInput(){
  document.getElementById('req-parent-pn').value='';
  document.getElementById('req-qty').value='1';
  document.getElementById('req-parent-info').textContent='';
  document.getElementById('req-result-wrap').style.display='none';
  document.getElementById('req-filter-bar').style.display='none';
  const printBtn=document.getElementById('req-print-btn');
  const csvBtn=document.getElementById('req-csv-btn');
  if(printBtn) printBtn.style.display='none';
  if(csvBtn) csvBtn.style.display='none';
  reqData=[];
  document.getElementById('req-tbody').innerHTML='';
}


function saveOutEdit(){
  if(editOutIdx<0)return;
  const g=id=>document.getElementById(id)?.value.trim()||'';
  const dt=g('oe-dt'),pn=g('oe-pn');
  if(!dt||!pn){alert('불출일, 품번은 필수입니다');return;}
  const dbr=DB.find(x=>x.pn===pn)||{};
  OUT[editOutIdx]={
    ...OUT[editOutIdx],
    date:dt, pn, mfg_pn:dbr.mp||g('oe-mfg'),
    qty:parseFloat(document.getElementById('oe-qty').value)||0,
    unit:document.getElementById('oe-unit').value,
    purpose:document.getElementById('oe-pur').value,
    dest:g('oe-dest'), receiver:g('oe-rec'), note:g('oe-note'),
    _edited:new Date().toLocaleString('ko-KR')
  };
  sv(K.OUT,OUT); closeM('m-out-edit'); renderOut(); updateStat();
}


function closeM(id){
  var el=document.getElementById(id);
  if(!el) return;
  el.classList.remove('on');
  el.style.display='none';
}


function recvUpLoad(file){
  if(!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();
  reader.onload = e => {
    try {
      let wb;
      if(ext==='csv') wb = XLSX.read(e.target.result, {type:'string'});
      else wb = XLSX.read(new Uint8Array(e.target.result), {type:'array', cellDates:true});
      // Current Data 시트 우선, 없으면 첫 시트
      // 매입이력 시트 자동 감지: 발주입고내역 > Received > 첫 시트
      var _poSn = wb.SheetNames.find(function(n){ return n.trim()==='발주입고내역'; })
                || wb.SheetNames[0];
      const ws = wb.Sheets[_poSn];
      const raw = XLSX.utils.sheet_to_json(ws, {header:1, defval:'', raw:true, cellDates:true});
      if(raw.length < 2){ alert('데이터가 없습니다'); return; }

      const hdr = raw[0].map(c => String(c||'').toLowerCase().replace(/\s/g,''));
      const fi = kws => hdr.findIndex(h => kws.some(k => h.includes(k)));

      const odI  = fi(['발주일','order_date']);
      const rdI  = fi(['입고요청','req_date']);
      const idI  = fi(['입고일','recv_date']);
      const vdI  = fi(['구매처','공급업체','vendor','거래처','supplier']);
      const pnI  = fi(['품번','품목코드','pn','partnumber','itemcode']);
      const mgI  = fi(['제조사','mfg','manufacturer']);
      const mpI  = fi(['제조사품번','mfgpn']);
      const qI   = fi(['수량','qty','quantity']);
      const uI   = fi(['단위','unit']);
      const upI  = fi(['발주단가','발주금액','단가','unit_price','unitprice']);
      const totI = fi(['합계금액','합계','total']);
      const payI = fi(['결제방식','결제','pay','payment']);
      const blI  = fi(['bl no','bl','선하']);
      const ntI  = fi(['비고','note','memo']);

      if(odI<0 || pnI<0 || qI<0){
        alert('필수 열을 찾을 수 없습니다.\n헤더: '+hdr.slice(0,10).join(', ')+'\n\n필요: 발주일, 품번, 수량');
        return;
      }

      const toISO = v => {
        if(!v && v!==0) return '';
        if(v instanceof Date){
          return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');
        }
        const s = String(v).trim();
        if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0,10);
        const mdy4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if(mdy4) return mdy4[3]+'-'+mdy4[1].padStart(2,'0')+'-'+mdy4[2].padStart(2,'0');
        const mdy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
        if(mdy2){ const yr=parseInt(mdy2[3]); return (yr<50?2000+yr:1900+yr)+'-'+mdy2[1].padStart(2,'0')+'-'+mdy2[2].padStart(2,'0'); }
        const n = parseFloat(s);
        if(!isNaN(n) && n>40000 && n<60000){
          const d = new Date(Math.round((n-25569)*86400*1000));
          return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
        }
        return s.substring(0,10)||'';
      };
      const ts = v => { if(v instanceof Date) return toISO(v); return String(v||'').trim(); };
      const tn = (v,d=0) => { const n=parseFloat(String(v||'').replace(/,/g,'')); return isNaN(n)?d:n; };

      const newRows = [];
      raw.slice(1).forEach(row => {
        if(!row || row.every(c => c==='' || c===null || c===undefined)) return;
        const pnRaw = row[pnI];
        const pn = String(typeof pnRaw==='number' ? Math.round(pnRaw) : pnRaw||'').trim().replace(/\.0$/,'');
        const od = toISO(row[odI]);
        if(!pn || !od) return;
        const dbr = DB.find(x => x.pn===pn) || {};
        const qty = tn(row[qI], 0);
        const up  = tn(row[upI], 0);
        const recvDate = idI>=0 ? toISO(row[idI]) : '';
        newRows.push({
          order_date: od,
          req_date:   rdI>=0 ? toISO(row[rdI]) : '',
          recv_date:  recvDate,
          recv_yn:    recvDate ? 'Y' : 'N',
          vendor:     vdI>=0 ? ts(row[vdI]) : '',
          pn,
          mfg:     mgI>=0 ? ts(row[mgI])  : (dbr.mg||''),
          mfg_pn:  mpI>=0 ? ts(row[mpI])  : (dbr.mp||''),
          qty,
          unit:    uI>=0  ? ts(row[uI])   : 'EA',
          unit_price: up,
          total:   totI>=0 ? tn(row[totI], qty*up) : qty*up,
          pay:     payI>=0 ? ts(row[payI]) : '',
          bl:      blI>=0  ? ts(row[blI])  : '',
          note:    ntI>=0  ? ts(row[ntI])  : '',
          _added:  '엑셀업로드 '+new Date().toLocaleString('ko-KR')
        });
      });

      const uidFn = r => (r.order_date||'')+'|'+(r.req_date||'')+'|'+(r.pn||'')+'|'+(r.qty||'');
      const recvMap2 = {};
      RECV.forEach(r => { recvMap2[uidFn(r)] = r; });
      let added=0, updated=0;
      newRows.forEach(r => {
        const k = uidFn(r);
        if(recvMap2[k]) {
          const ex=recvMap2[k];
          if(r.unit_price>0) ex.unit_price=r.unit_price;
          if(r.total>0)      ex.total=r.total;
          if(r.recv_date)    ex.recv_date=r.recv_date;
          if(r.vendor)       ex.vendor=r.vendor;
          if(r.pay)          ex.pay=r.pay;
          if(r.bl)           ex.bl=r.bl;
          if(r.note)         ex.note=r.note;
          updated++;
        } else { RECV.unshift(r); recvMap2[k]=r; added++; }
      });
      // 저장 전 중복 제거 (발주일+품번+수량 기준)
      var recvSeen = new Set();
      RECV = RECV.filter(function(r){
        var key = (r.order_date||'')+'|'+(r.pn||'')+'|'+(r.qty||'');
        if(recvSeen.has(key)) return false;
        recvSeen.add(key);
        return true;
      });
      // localStorage 용량 최적화: 최근 2년치만 로컬 저장
      var _twoYearsAgo = (new Date().getFullYear()-2)+'-01-01';
      var _recvLocal = RECV.filter(function(r){ return (r.order_date||'') >= _twoYearsAgo; });
      var _recvAll   = RECV;
      try {
        localStorage.setItem(K.RECV, JSON.stringify(_recvLocal));
        RECV = _recvAll; // 메모리는 전체 유지
      } catch(e) {
        if(e.name==='QuotaExceededError') {
          // 최근 1년치로 추가 축소
          var _oneYear = (new Date().getFullYear()-1)+'-01-01';
          var _slim = RECV.filter(function(r){ return (r.order_date||'') >= _oneYear; });
          try { localStorage.setItem(K.RECV, JSON.stringify(_slim)); } catch(e2) {
            // 그래도 안되면 최근 500건
            try { localStorage.setItem(K.RECV, JSON.stringify(RECV.slice(0,500))); } catch(e3) {}
          }
        }
      }
      // ── 단가변동 기록: DB.k5(25년) vs 올해 발주단가 비교 ──
      const curYear = new Date().getFullYear();
      const pnLatest = {};
      const pnQty = {};  // 품번별 올해 총 수량
      // 올해 데이터 중 최근 발주단가 추출 + 총 수량 집계
      RECV.filter(r => parseInt((r.order_date||'').substring(0,4)) >= curYear)
          .sort((a,b) => (b.order_date||'').localeCompare(a.order_date||''))
          .forEach(r => {
            if(r.pn && r.unit_price > 0 && !pnLatest[r.pn])
              pnLatest[r.pn] = {price: r.unit_price, date: r.order_date};
            if(r.pn) pnQty[r.pn] = (pnQty[r.pn]||0) + (parseFloat(r.qty)||0);
          });

      const priceChanges = [];
      Object.keys(pnLatest).forEach(pn => {
        const dbIdx = DB.findIndex(x => x.pn === pn);
        if(dbIdx < 0) return;
        const newP = pnLatest[pn].price;
        const oldP = DB[dbIdx].k5 || 0;   // 25년 DB단가 기준
        if(newP > 0 && oldP > 0 && newP !== oldP) {
          // k6에도 반영
          if(DB[dbIdx].k6 !== newP) {
            DB[dbIdx].k6 = newP;
            svDBItem(DB[dbIdx], false);
          }
          priceChanges.push({
            pn, d: DB[dbIdx].d || '',
            oldPrice: oldP, newPrice: newP,
            diff: newP - oldP,
            pct: Math.round((newP - oldP) / oldP * 100),
            date: pnLatest[pn].date,
            qty: pnQty[pn] || 0,
            totalDiff: (newP - oldP) * (pnQty[pn] || 0)  // 수량×단가차 = 실절감액
          });
        }
      });

      if(priceChanges.length > 0) {
        sv(K.DB, DB); renderDB(); updateStat();
        recordPriceChanges(priceChanges);
        // 단가변동 탭으로 이동
        ptTab('price');
      }

      const el = document.getElementById('recv-up-result');
      if(el){ el.textContent='✅ '+added+'건 추가, '+updated+'건 업데이트 (전체 '+newRows.length+'건 파싱)'+(priceChanges.length>0?' | 단가변동 '+priceChanges.length+'건':''); el.style.display=''; }
      renderRecv(); updateStat(); renderAggIfOpen();
    } catch(err){
      if(err.name==='QuotaExceededError' || (err.message&&err.message.includes('quota'))) {
        // localStorage 용량 초과 - 오류 무시 (서버에는 저장됨)
        console.warn('매입이력 localStorage 용량 초과:', err.message);
        const el = document.getElementById('recv-up-result');
        if(el){ el.textContent='✅ 저장 완료 (localStorage 용량 한도로 로컬 저장 제한됨, 서버에는 정상 저장)'; el.style.display=''; }
      } else {
        alert('파싱 오류: '+err.message+'\n\n'+(err.stack||'').split('\n').slice(0,3).join('\n'));
      }
    }
  };
  ext==='csv' ? reader.readAsText(file,'utf-8') : reader.readAsArrayBuffer(file);
}


function openEditRecv(gi){
  editRecvIdx=gi;
  const r=RECV[gi];
  if(!r)return;
  document.getElementById('re-od').value=r.order_date||'';
  document.getElementById('re-rd').value=r.req_date||'';
  document.getElementById('re-id').value=r.recv_date||'';
  document.getElementById('re-vd').value=r.vendor||'';
  document.getElementById('re-pn').value=r.pn||'';
  document.getElementById('re-desc').value=r.mfg||'';
  document.getElementById('re-mfg').value=r.mfg_pn||'';
  document.getElementById('re-qty').value=r.qty||'';
  document.getElementById('re-unit').value=r.unit||'EA';
  document.getElementById('re-up').value=r.unit_price||'';
  document.getElementById('re-tot').value=r.total||'';
  document.getElementById('re-pay').value=r.pay||'정기 결제';
  document.getElementById('re-bl').value=r.bl||'';
  document.getElementById('re-sd').value=r.sign_date||'';
  document.getElementById('re-note').value=r.note||'';
  // autofill desc/mfg from DB
  const dbr=DB.find(x=>x.pn===r.pn)||{};
  if(dbr.d) document.getElementById('re-desc').value=dbr.d;
  if(dbr.mp) document.getElementById('re-mfg').value=dbr.mp;
  document.getElementById('m-recv-edit').classList.add('on');
}


function autoFillRecvEdit(){
  const pn=document.getElementById('re-pn').value.trim();
  const dbr=DB.find(x=>x.pn===pn)||{};
  document.getElementById('re-desc').value=dbr.d||'';
  document.getElementById('re-mfg').value=dbr.mp||'';
}


function calcRecvEditTotal(){
  const qty=parseFloat(document.getElementById('re-qty').value)||0;
  const up=parseFloat(document.getElementById('re-up').value)||0;
  if(qty&&up) document.getElementById('re-tot').value=qty*up;
}


function saveRecvEdit(){
  if(editRecvIdx<0)return;
  const g=id=>document.getElementById(id)?.value.trim()||'';
  const od=g('re-od'),vd=g('re-vd'),pn=g('re-pn');
  if(!od||!vd||!pn){alert('발주일, 공급업체, 품번은 필수입니다');return;}
  RECV[editRecvIdx]={
    ...RECV[editRecvIdx],
    order_date:od, req_date:g('re-rd'), recv_date:g('re-id'),
    vendor:vd, pn, mfg:document.getElementById('re-desc').value,
    mfg_pn:document.getElementById('re-mfg').value,
    qty:parseFloat(document.getElementById('re-qty').value)||0,
    unit:document.getElementById('re-unit').value,
    unit_price:parseFloat(document.getElementById('re-up').value)||0,
    total:parseFloat(document.getElementById('re-tot').value)||0,
    pay:document.getElementById('re-pay').value,
    bl:g('re-bl'), sign_date:g('re-sd'), note:g('re-note'),
    _edited:new Date().toLocaleString('ko-KR')
  };
  sv(K.RECV,RECV); closeM('m-recv-edit'); renderRecv(); updateStat(); renderAggIfOpen();
}


function bulkSetRecvDate(){
  document.getElementById('bulk-recv-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('m-recv-bulk-recv').classList.add('on');
}


function confirmBulkRecv(){
  const dt=document.getElementById('bulk-recv-date').value;
  if(!dt){alert('입고일을 선택하세요');return;}
  const checked=[...document.querySelectorAll('.row-chk:checked')];
  if(!checked.length){alert('항목을 선택하세요');return;}
  checked.forEach(el=>{
    const gi=+el.dataset.idx;
    if(RECV[gi]) RECV[gi].recv_date=dt;
  });
  sv(K.RECV,RECV);
  closeM('m-recv-bulk-recv');
  document.getElementById('rchk-all').checked=false;
  updateRecvBulkBtns();
  renderRecv();
  renderAggIfOpen();
  alert(`✅ ${checked.length}건 입고 처리 완료 (${dt})`);
}


function bulkEditRecv(){
  const checked=[...document.querySelectorAll('.row-chk:checked')];
  if(checked.length!==1){alert('수정은 1건만 선택해주세요');return;}
  openEditRecv(+checked[0].dataset.idx);
}


function openRecvUpload(){
  document.getElementById('recv-up-file').value='';
  document.getElementById('recv-up-result').style.display='none';
  document.getElementById('recv-up-dropzone').classList.remove('drag');
  document.getElementById('m-recv-upload').classList.add('on');
}


function recvUpDrag(e,on){e.preventDefault();document.getElementById('recv-up-dropzone').classList[on?'add':'remove']('drag');}


function recvUpDrop(e){e.preventDefault();recvUpDrag(e,false);if(e.dataTransfer.files[0])recvUpLoad(e.dataTransfer.files[0]);}


function resetRECV(){
  if(!confirm('⚠️ 매입 이력 전체를 삭제하시겠습니까?\n\n등록된 모든 매입 기록이 삭제됩니다.'))return;
  RECV=[];sv(K.RECV,RECV);renderRecv();updateStat();
  alert('✅ 매입 이력이 초기화되었습니다.');
}


function resetOUT(){
  if(!confirm('⚠️ 자재 불출 이력 전체를 삭제하시겠습니까?\n\n등록된 모든 불출 기록이 삭제됩니다.'))return;
  OUT=[];sv(K.OUT,OUT);
    if(typeof CURRENT_TOKEN!=='undefined'&&CURRENT_TOKEN){
      apiPost({action:'setSheet',sheet:'out_items',data:OUT}).catch(function(){});
    }
    renderOut();updateStat();
  alert('✅ 자재 불출 이력이 초기화되었습니다.');
}


function _parseAndSaveRecv(rawInput) {
  if(!rawInput || rawInput.length < 2) return {added:0, total:RECV.length};
  var raw = rawInput;
  var hdr = raw[0].map(function(c){ return String(c||'').toLowerCase().replace(/\s/g,''); });
  var fi  = function(kws){ return hdr.findIndex(function(h){ return kws.some(function(k){ return h.includes(k); }); }); };
  var toISO = function(v){
    if(!v) return '';
    if(v instanceof Date){ return v.getUTCFullYear()+'-'+String(v.getUTCMonth()+1).padStart(2,'0')+'-'+String(v.getUTCDate()).padStart(2,'0'); }
    var s=String(v).trim(); if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0,10); return s;
  };
  var ts  = function(v){ return String(v||'').trim().replace(/\.0$/,''); };
  var tn  = function(v){ var n=parseFloat(String(v||'').replace(/,/g,'')); return isNaN(n)?0:n; };

  var odI=fi(['발주일','order_date']), rdI=fi(['입고요청','req_date']), idI=fi(['입고일','recv_date']);
  var vdI=fi(['구매처','공급업체','vendor']), pnI=fi(['품번','품목코드','pn','partnumber','itemcode']);
  var mgI=fi(['제조사','mfg']), mpI=fi(['제조사품번','mfgpn']);
  var qI=fi(['수량','qty']), uI=fi(['단위','unit']);
  var upI=fi(['발주단가','발주금액','단가','unit_price','unitprice']);
  var totI=fi(['합계금액','합계','total']), payI=fi(['결제방식','결제','pay']);
  var blI=fi(['bl no','bl']), ntI=fi(['비고','note','memo']);

  if(odI<0||pnI<0||qI<0) return {added:0, total:RECV.length};

  var newRows=[];
  for(var i=1;i<raw.length;i++){
    var r=raw[i];
    var pn=ts(r[pnI]); if(!pn) continue;
    var qty=tn(r[qI]); if(qty<=0) continue;
    newRows.push({
      order_date: odI>=0?toISO(r[odI]):'',
      req_date:   rdI>=0?toISO(r[rdI]):'',
      recv_date:  idI>=0?toISO(r[idI]):'',
      vendor:     vdI>=0?ts(r[vdI]):'',
      pn: pn,
      mfg:    mgI>=0?ts(r[mgI]):'',
      mfg_pn: mpI>=0?ts(r[mpI]):'',
      qty: qty,
      unit:       uI>=0?ts(r[uI]):'EA',
      unit_price: upI>=0?tn(r[upI]):0,
      total:      totI>=0?tn(r[totI]):0,
      pay:        payI>=0?ts(r[payI]):'',
      bl:         blI>=0?ts(r[blI]):'',
      note:       ntI>=0?ts(r[ntI]):''
    });
  }

  // 발주일+납품요청일+품번+수량 = 동일키: 업데이트 / 나머지: 신규
  var uid = function(r){ return (r.order_date||'')+'|'+(r.req_date||'')+'|'+(r.pn||'')+'|'+(r.qty||''); };
  var recvMap = {};
  RECV.forEach(function(r){ recvMap[uid(r)] = r; });

  var addedCnt=0, updatedCnt=0;
  newRows.forEach(function(r){
    var k = uid(r);
    if(recvMap[k]) {
      // 동일키 → 내용 업데이트 (단가, 합계, 결제방식 등)
      var ex = recvMap[k];
      if(r.unit_price>0) ex.unit_price = r.unit_price;
      if(r.total>0)      ex.total      = r.total;
      if(r.recv_date)    ex.recv_date  = r.recv_date;
      if(r.vendor)       ex.vendor     = r.vendor;
      if(r.pay)          ex.pay        = r.pay;
      if(r.bl)           ex.bl         = r.bl;
      if(r.note)         ex.note       = r.note;
      updatedCnt++;
    } else {
      RECV.unshift(r);
      recvMap[k] = r;
      addedCnt++;
    }
  });

  // 저장 (최근 2년치만 로컬)
  var _2y=(new Date().getFullYear()-2)+'-01-01';
  try{ localStorage.setItem(K.RECV, JSON.stringify(RECV.filter(function(r){return (r.order_date||'')>=_2y;}))); }catch(e){}

  // 서버 동기화
  if(typeof CURRENT_TOKEN!=='undefined' && CURRENT_TOKEN) {
    apiPost({action:'setSheet', sheet:'recv_items', data:RECV}).catch(function(){});
  }

  renderRecv(); updateStat(); renderAggIfOpen();
  return {added:addedCnt, updated:updatedCnt, total:RECV.length};
}


function _parseAndSaveOut(raw) {
  if(!raw || raw.length < 2) return {added:0, total:OUT.length};
  var hdr = raw[0].map(function(c){ return String(c||'').toLowerCase().replace(/\s/g,''); });
  var fi  = function(kws){ return hdr.findIndex(function(h){ return kws.some(function(k){ return h.includes(k); }); }); };
  var toISO = function(v) {
    if(!v) return '';
    if(v instanceof Date){ return v.getUTCFullYear()+'-'+String(v.getUTCMonth()+1).padStart(2,'0')+'-'+String(v.getUTCDate()).padStart(2,'0'); }
    var s=String(v).trim(); if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0,10); return s;
  };
  var ts = function(v){ return String(v||'').trim().replace(/\.0$/,''); };
  var tn = function(v){ var n=parseFloat(String(v||'').replace(/,/g,'')); return isNaN(n)?0:n; };

  var dtI=fi(['출고일','불출일','date']), pnI=fi(['품목코드','품번','pn','itemcode']);
  var qI=fi(['수량','qty']), uI=fi(['단위','unit']);
  var purI=fi(['출고목적','목적','purpose']), dstI=fi(['출고처','dest','destination']);
  var recI=fi(['인수자','receiver','수령']), ntI=fi(['비고','note','memo']);

  if(dtI<0||pnI<0||qI<0) return {added:0, total:OUT.length};

  var newRows=[];
  for(var i=1;i<raw.length;i++){
    var r=raw[i];
    var pn=ts(r[pnI]); if(!pn) continue;
    var qty=tn(r[qI]); if(qty<=0) continue;
      // DB에서 제조사/제조사품번 매칭
      var dbItem = DB.find(function(x){ return x.pn === pn; });
      newRows.push({
        date: toISO(r[dtI]),
        pn:  pn,
        qty: qty,
        unit: uI>=0?ts(r[uI]):'EA',
        mfg:    dbItem ? (dbItem.mg||'') : '',
        mfg_pn: dbItem ? (dbItem.mp||'') : '',
        purpose: purI>=0?ts(r[purI]):'',
        dest:    dstI>=0?ts(r[dstI]):'',
        receiver:recI>=0?ts(r[recI]):'',
        note:    ntI>=0?ts(r[ntI]):'',
        _src:'엑셀업로드'
      });
  }

  var keySet=new Set(OUT.map(function(r){return (r.date||'')+'|'+(r.pn||'')+'|'+(r.qty||'');}));
  var toAdd=newRows.filter(function(r){return !keySet.has((r.date||'')+'|'+(r.pn||'')+'|'+(r.qty||''));});
  toAdd.forEach(function(r){OUT.unshift(r);});

  var seen=new Set();
  OUT=OUT.filter(function(r){var k=(r.date||'')+'|'+(r.pn||'')+'|'+(r.qty||'');if(seen.has(k))return false;seen.add(k);return true;});

  try{ sv(K.OUT, OUT); }catch(e){ console.warn('OUT 저장 오류',e); }
  // 서버 동기화
  if(typeof CURRENT_TOKEN!=='undefined' && CURRENT_TOKEN) {
    apiPost({action:'setSheet', sheet:'out_items', data:OUT}).catch(function(){});
  }
  renderOut(); updateStat();
  return {added:toAdd.length, total:OUT.length};
}


function handleUnifiedUpload(inp) {
  if(!inp.files[0]) return;
  var file = inp.files[0];
  inp.value = '';
  var ext = file.name.split('.').pop().toLowerCase();
  if(!['xlsx','xls','xlsm'].includes(ext) && ext!=='csv') {
    alert('xlsx, xls, xlsm, csv 파일만 지원합니다.'); return;
  }
  if(ext==='csv') { processSalesFile(file); return; }

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb = XLSX.read(new Uint8Array(e.target.result), {type:'array', cellDates:true, raw:true});
      var sheetNames = wb.SheetNames.map(function(n){ return n.trim(); });
      var hasPO     = sheetNames.indexOf('Current Data') >= 0;
      var hasRcv    = sheetNames.indexOf('Received') >= 0;
      var hasRecvKR = sheetNames.indexOf('발주입고내역') >= 0;
      var hasOut    = sheetNames.indexOf('출고내역') >= 0;
      var hasStock  = sheetNames.indexOf('재고현황') >= 0;
      var msgs = [];

      // PO 처리 (Current Data 시트)
      if(hasPO) {
        var cdWs  = wb.Sheets['Current Data'];
        var cdRaw = XLSX.utils.sheet_to_json(cdWs, {header:1, defval:'', raw:true, cellDates:true});
        var prev  = PO.length > 0 ? [...PO] : (getHist()[0]&&getHist()[0].data || []);
        var parsed = parseRows(cdRaw);
        var changes = detectChanges(prev, parsed);
        PO = parsed;
        var dateStr = new Date().toLocaleString('ko-KR');
        var hist = getHist();
        hist.unshift({date:dateStr, data:parsed, changes});
        if(hist.length > 10) hist.splice(10);
        saveHist(hist);
        updateTracking(parsed, dateStr);
        document.getElementById('last-updated').textContent = '업로드: '+dateStr;
        // 서버 동기화
        if(CURRENT_TOKEN) {
          var histRows = hist.map(function(entry){
            return {upload_date:entry.date, changes_count:(entry.changes||[]).length, data_json:JSON.stringify(entry.data||[])};
          });
          apiPost({action:'setSheet', sheet:'po_history', data:histRows}).catch(function(){});
        }
        msgs.push('PO '+parsed.length+'건');
        if(changes.length > 0) {
          var b = document.getElementById('badge-changes');
          if(b){b.textContent=changes.length; b.style.display='';}
        }
        refreshAll(); buildHistSelect();
      }

      // 불출이력 처리 (출고내역 시트)
      // 매입이력 처리 (발주입고내역 시트)
      if(hasRecvKR) {
        var krWs  = wb.Sheets['발주입고내역'];
        var krRaw = XLSX.utils.sheet_to_json(krWs, {header:1, defval:'', raw:true, cellDates:true});
        var krResult = _parseAndSaveRecv(krRaw);
        msgs.push('매입이력 '+krResult.added+'건 추가, '+krResult.updated+'건 업데이트 (전체 '+krResult.total+'건)');
      }

      // 불출이력 처리 (출고내역 시트)
      if(hasOut) {
        var outWs  = wb.Sheets['출고내역'];
        var outRaw = XLSX.utils.sheet_to_json(outWs, {header:1, defval:'', raw:true, cellDates:true});
        var outResult = _parseAndSaveOut(outRaw);
        if(outResult.added >= 0)
          msgs.push('불출이력 '+outResult.added+'건 추가 (전체 '+outResult.total+'건)');
      }

      // 재고현황 처리
      if(hasStock) {
        var stWs  = wb.Sheets['재고현황'];
        var stRaw = XLSX.utils.sheet_to_json(stWs, {header:1, defval:'', raw:true, cellDates:true});
        _loadStock(stRaw);
        msgs.push('재고현황 '+STOCK.length+'건 로드');
      }

      // Received 시트는 [납품이력 업로드] 버튼으로 별도 처리

      if(!hasPO && !hasRecvKR && !hasOut && !hasStock) {
        if(confirm('시트: '+wb.SheetNames.join(', ')+'\n\n[확인] PO 처리 / [취소] 납품이력 처리'))
          processFile(file);
        else
          processSalesFile(file);
        return;
      }

      if(hasPO && msgs.length) poTab('po');
      alert('✅ 업로드 완료\n' + msgs.join('\n'));
    } catch(err) { alert('파일 오류: '+err.message+'\n'+(err.stack||'').split('\n').slice(0,2).join('\n')); }
  };
  reader.readAsArrayBuffer(file);
}


function handleUpload(inp) { if(inp.files[0]) processFile(inp.files[0]); inp.value=''; }


function azFilter(f) {
  _azFilter = f;
  document.querySelectorAll('#pg-analyze .chip[id^="az-f-"]').forEach(function(el) {
    el.classList.toggle('on', el.id === 'az-f-' + f);
  });
  renderAzPOList();
}


function azResFilter(f) {
  _azResFilter = f;
  document.querySelectorAll('#pg-analyze .chip[id^="az-r-"]').forEach(function(el) {
    el.classList.toggle('on', el.id === 'az-r-' + f);
    // 관리대상Y 버튼 색상 유지
    if(el.id === 'az-r-mgmt' && el.classList.contains('on')) {
      el.style.color = 'var(--teal)'; el.style.borderColor = 'var(--teal)';
    } else if(el.id === 'az-r-mgmt') {
      el.style.color = ''; el.style.borderColor = '';
    }
  });
  renderAzResults(_azResults);
}


function azToggleEl(el) {
  var key = el ? el.dataset.azkey : null;
  if(!key) return;
  if(_azSelected[key]) delete _azSelected[key]; else _azSelected[key] = true;
  document.getElementById('az-sel-cnt').textContent = Object.keys(_azSelected).length;
  renderAzPOList();
}


function azSelectAll() {
  var q = ((document.getElementById('az-q')||{}).value||'').toLowerCase().trim();
  (PO||[]).filter(function(r){
    if(r.shipped) return false;
    if(_azFilter!=='all' && r.ccn!==_azFilter) return false;
    if(q && !(r.item||'').toLowerCase().includes(q) && !(r.desc||'').toLowerCase().includes(q)) return false;
    return true;
  }).forEach(function(r){ _azSelected[r.item+'|'+r.order]=true; });
  document.getElementById('az-sel-cnt').textContent = Object.keys(_azSelected).length;
  renderAzPOList();
}


function azClearAll() {
  _azSelected = {};
  document.getElementById('az-sel-cnt').textContent = 0;
  renderAzPOList();
}


function runAnalyze() {
  var keys = Object.keys(_azSelected);
  if(!keys.length) { alert('PO를 하나 이상 선택하세요.'); return; }

  var selPOs = (PO||[]).filter(function(r){ return _azSelected[r.item+'|'+r.order]; });

  // ── REV 불일치 체크 ──
  var revWarns = [];
  selPOs.forEach(function(r){
    if(!BOM||!BOM[r.item]||!BOM[r.item].length) return;
    if(!r.srev) return;
    var match = BOM[r.item].some(function(c){ return !c.pRev || c.pRev === r.srev; });
    if(!match) revWarns.push(r.item + ' (PO Rev: ' + r.srev + ', BRev: ' + r.brev + ')');
  });
  var revWarnEl = document.getElementById('az-rev-warn');
  var revListEl = document.getElementById('az-rev-list');
  if(revWarns.length) {
    revWarnEl.style.display = '';
    revListEl.innerHTML = revWarns.map(function(w){ return '• ' + w; }).join('<br>');
  } else {
    revWarnEl.style.display = 'none';
  }

  // ── 하위 소요량 합산 ──
  // {childPn: totalQty}
  var need = {};
  var noBOM = [];
  selPOs.forEach(function(r){
    var poBOM = BOM && BOM[r.item];
    if(!poBOM || !poBOM.length) {
      if(noBOM.indexOf(r.item) < 0) noBOM.push(r.item);
      return;
    }
    poBOM.forEach(function(c){
      var cpn = String(c.pn||c.child||'').trim().replace(/\.0$/,'');
      if(!cpn) return;
      var qty = (c.aqty !== undefined ? +c.aqty : +c.qty) || 0;
      need[cpn] = (need[cpn]||0) + qty * (r.qty||1);
    });
  });

  // ── 가용재고 계산 ──
  // 입고예정 = RECV 중 recv_date 없고 order_date 있는 것
  var pendingMap = {};
  (RECV||[]).forEach(function(r){
    if(r.recv_date || !r.order_date) return;
    var pn = String(r.pn||'').trim();
    if(!pn) return;
    pendingMap[pn] = (pendingMap[pn]||0) + (+r.qty||0);
  });

  // 결과 계산
  var results = Object.keys(need).map(function(pn){
    var reqQty   = need[pn];
    var stk      = (STOCK.find(function(s){ return s.pn === pn; })||{cur:null}).cur;
    var curStock = stk !== null && stk !== undefined ? +stk : null;
    var pending  = pendingMap[pn] || 0;
    var avail    = curStock !== null ? curStock + pending : null;
    var shortage = avail !== null ? Math.max(0, reqQty - avail) : null;
    var dbr      = (DB||[]).find(function(d){ return d.pn === pn; }) || {};
    var status   = avail === null ? 'nostock' : shortage > 0 ? 'short' : 'ok';
    return {
      pn, mp: dbr.mp||'', desc: dbr.d||'', by: dbr.by||'', lt: dbr.lt||0,
      reqQty, curStock, pending, avail, shortage, status
    };
  });

  // 납기 빠른 순으로 정렬된 PO 기준 부족 우선
  results.sort(function(a,b){
    var order = {short:0, nostock:1, ok:2};
    return (order[a.status]||3) - (order[b.status]||3) || a.pn.localeCompare(b.pn);
  });

  _azResults = results;

  // BOM 없는 PO 개수
  document.getElementById('az-bom-cnt').textContent = Object.keys(need).length;

  // BOM 없는 품목 패널
  var nobomPanel = document.getElementById('az-nobom-panel');
  var nobomList  = document.getElementById('az-nobom-list');
  var nobomCnt   = document.getElementById('az-nobom-cnt');
  if(noBOM.length) {
    nobomPanel.style.display = '';
    nobomCnt.textContent = noBOM.length + '건';
    nobomList.innerHTML = noBOM.map(function(pn){
      var dbr = (DB||[]).find(function(d){ return d.pn === pn; }) || {};
      return '<span style="background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:2px 8px;font-family:var(--mono);font-size:11px;color:var(--teal);cursor:pointer" title="' + (dbr.d||'') + '">' + pn + '</span>';
    }).join('');
  } else {
    nobomPanel.style.display = 'none';
  }

  // 요약
  var nOk = results.filter(function(r){return r.status==='ok';}).length;
  var nSh = results.filter(function(r){return r.status==='short';}).length;
  var nNs = results.filter(function(r){return r.status==='nostock';}).length;
  document.getElementById('az-s-total').textContent  = results.length;
  document.getElementById('az-s-ok').textContent     = nOk;
  document.getElementById('az-s-short').textContent  = nSh;
  document.getElementById('az-s-nostock').textContent= nNs;
  document.getElementById('az-s-nodb').textContent   = noBOM.length;

  document.getElementById('az-empty').style.display   = 'none';
  document.getElementById('az-summary').style.display = '';

  renderAzResults(results);
}


function renderAzResults(results) {
  var tbody = document.getElementById('az-tbody'); if(!tbody) return;
  var filtered = results.filter(function(r){
    if(_azResFilter === 'short') return r.status === 'short' || r.status === 'nostock';
    if(_azResFilter === 'ok')    return r.status === 'ok';
    if(_azResFilter === 'mgmt') {
      var dbr = (DB||[]).find(function(d){ return d.pn === r.pn; }) || {};
      return (dbr.managed || dbr.mg2 || dbr.mng || '') !== 'N';
    }
    return true;
  });

  if(!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="11" style="padding:24px;text-align:center;color:var(--text3)">해당 없음</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function(r){
    var statusHtml =
      r.status==='ok'      ? '<span class="az-tag ok">충분</span>' :
      r.status==='short'   ? '<span class="az-tag err">부족</span>' :
                             '<span class="az-tag warn">재고없음</span>';
    var orderableHtml = (r.by && r.lt > 0)
      ? '<span class="az-tag ok">가능</span><span style="font-size:10px;color:var(--text3);margin-left:3px">' + r.lt + '주</span>'
      : (r.by ? '<span class="az-tag warn">LT없음</span>' : '<span class="az-tag gray">미등록</span>');
    var rowCls = r.status==='short'?'az-row-short':r.status==='nostock'?'az-row-warn':'az-row-ok';

    return '<tr class="' + rowCls + '" style="border-bottom:1px solid var(--border)">' +
      '<td style="padding:6px 10px;font-family:var(--mono);font-size:11px;color:var(--teal);overflow:hidden;text-overflow:ellipsis">' + r.pn + '</td>' +
      '<td style="padding:6px 10px;font-size:10px;color:var(--text3);overflow:hidden;text-overflow:ellipsis">' + (r.mp||'—') + '</td>' +
      '<td style="padding:6px 10px;font-size:11px;overflow:hidden;text-overflow:ellipsis" title="' + r.desc + '">' + (r.desc||'—') + '</td>' +
      '<td style="padding:6px 10px;font-family:var(--mono);font-size:11px;text-align:right;font-weight:700">' + r.reqQty.toLocaleString() + '</td>' +
      '<td style="padding:6px 10px;font-family:var(--mono);font-size:11px;text-align:right">' + (r.curStock!==null?r.curStock.toLocaleString():'—') + '</td>' +
      '<td style="padding:6px 10px;font-family:var(--mono);font-size:11px;text-align:right;color:var(--teal)">' + (r.pending>0?'+'+r.pending.toLocaleString():'—') + '</td>' +
      '<td style="padding:6px 10px;font-family:var(--mono);font-size:11px;text-align:right;font-weight:600">' + (r.avail!==null?r.avail.toLocaleString():'—') + '</td>' +
      '<td style="padding:6px 10px;font-family:var(--mono);font-size:11px;text-align:right;color:var(--red);font-weight:700">' + (r.shortage>0?r.shortage.toLocaleString():'—') + '</td>' +
      '<td style="padding:6px 10px;text-align:center">' + statusHtml + '</td>' +
      '<td style="padding:6px 10px;text-align:center">' + orderableHtml + '</td>' +
      '<td style="padding:6px 10px;font-size:10px;color:var(--text3)">' + (r.by||'—') + '</td>' +
    '</tr>';
  }).join('');
}


function exportAzCSV() {
  if(!_azResults.length) { alert('먼저 분석을 실행하세요.'); return; }
  var hdr = ['품번','제조사품번','품명','총소요','현재고','입고예정','가용재고','부족수량','상태','구매처','LT(주)'];
  var rows = _azResults.map(function(r){
    return [r.pn, r.mp, '"'+(r.desc||'')+'"', r.reqQty,
            r.curStock!==null?r.curStock:'', r.pending,
            r.avail!==null?r.avail:'', r.shortage||0,
            r.status==='ok'?'충분':r.status==='short'?'부족':'재고없음',
            r.by||'', r.lt||''].join(',');
  });
  var csv = '\uFEFF' + hdr.join(',') + '\n' + rows.join('\n');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download = '소요량분석_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}


function palFilter(f) {
  _palFilter = f;
  document.querySelectorAll('#pg-palert .chip').forEach(function(el) {
    el.classList.toggle('on', el.id === 'pal-f-' + f);
  });
  renderPurchaseAlert();
}


function handleStockUpload(inp) {
  if(!inp.files[0]) return;
  var file = inp.files[0]; inp.value = '';
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb = XLSX.read(new Uint8Array(e.target.result), {type:'array', cellDates:true, raw:true});
      var sheetNames = wb.SheetNames.map(function(n){ return n.trim(); });
      // 재고현황 시트 찾기
      var stockSn = sheetNames.find(function(n){
        return n === '재고현황' || n.includes('재고') || n.toLowerCase().includes('stock');
      });
      if(!stockSn) {
        alert('재고현황 시트를 찾을 수 없습니다.\n포함된 시트: ' + wb.SheetNames.join(', ') +
              '\n\n26_자재입출고재고관리.xlsm 파일을 확인하세요.');
        return;
      }
      var ws  = wb.Sheets[stockSn];
      var raw = XLSX.utils.sheet_to_json(ws, {header:1, defval:'', raw:true, cellDates:true});
      _loadStock(raw);
      alert('✅ 재고현황 업로드 완료\n시트: ' + stockSn + '\n' + STOCK.length + '건 로드');
    } catch(err) {
      alert('재고현황 업로드 오류: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}


function handleReceivedUpload(inp) {
  if(!inp.files[0]) return;
  var file = inp.files[0];
  inp.value = '';
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var wb = XLSX.read(new Uint8Array(e.target.result), {type:'array', cellDates:true, raw:true});
      var sheetNames = wb.SheetNames.map(function(n){ return n.trim(); });
      var recvSn = sheetNames.find(function(n){ return n === 'Received'; });
      if(!recvSn) {
        alert('Received 시트를 찾을 수 없습니다.\n포함된 시트: ' + wb.SheetNames.join(', '));
        return;
      }
      var rws  = wb.Sheets[recvSn];
      var rraw = XLSX.utils.sheet_to_json(rws, {header:1, defval:'', raw:true, cellDates:true});
      var rparsed = parseSalesRows(rraw);
      if(rparsed.length === 0) {
        alert('납품이력 파싱 결과가 없습니다.\n현황 컬럼이 납품완료/발송완료인 행만 처리됩니다.');
        return;
      }
      // 수동 납품처리(_source=manual)는 유지, 나머지는 전체 교체
      var existing = getDelivered();
      var manual = existing.filter(function(r) { return r._source === 'manual'; });
      var uidSeen = {};
      var deduped = rparsed.filter(function(r) {
        // _uid 없으면 그냥 통과 (orderLine/delLine이 없는 경우)
        if(!r._uid) return true;
        if(uidSeen[r._uid]) return false;
        uidSeen[r._uid] = true;
        return true;
      });
      var merged = deduped.concat(manual).sort(function(a,b) {
        return (b.deliveredDate||'').localeCompare(a.deliveredDate||'');
      });
      saveDelivered(merged);
      if(CURRENT_TOKEN) {
        apiPost({action:'setSheet', sheet:'po_delivered', data:merged}).catch(function(){});
      }
      var dateStr = new Date().toLocaleString('ko-KR');
      updateDeliveredBadge();
      buildYearTabs(merged);
      renderSalesDash();
      renderDelivered();
      updateTrackFromDelivered(merged, dateStr);
      if(typeof renderTracking === 'function') renderTracking();
      var dupCnt = rparsed.length - deduped.length;
      alert('납품이력 업로드 완료\n' +
            'Received 파싱: ' + rparsed.length + '건\n' +
            (dupCnt > 0 ? '중복 제거 (동일 오더+품번): ' + dupCnt + '건\n' : '') +
            '수동납품 유지: ' + manual.length + '건\n' +
            '최종 저장: ' + merged.length + '건');
    } catch(err) {
      alert('납품이력 업로드 오류: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}


function processFile(file, _preloadedWb) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = _preloadedWb || XLSX.read(e.target.result, {type:'array', cellDates:true, raw:true});
      // Current Data 시트 우선, 없으면 첫 시트
      // 매입이력 시트 자동 감지: 발주입고내역 > Received > 첫 시트
      var _poSn = wb.SheetNames.find(function(n){ return n.trim()==='발주입고내역'; })
                || wb.SheetNames[0];
      const ws = wb.Sheets[_poSn];
      const raw = XLSX.utils.sheet_to_json(ws, {header:1, defval:'', raw:true, cellDates:true});
      
      const prev = PO.length > 0 ? [...PO] : (getHist()[0]?.data || []);
      const parsed = parseRows(raw);
      const changes = detectChanges(prev, parsed);
      
      PO = parsed;
      const dateStr = new Date().toLocaleString('ko-KR');
      
      // 이력 저장 (최근 10개)
      const hist = getHist();
      hist.unshift({date: dateStr, data: parsed, changes});
      if(hist.length > 10) hist.splice(10);
      saveHist(hist);
      
      // CCN B 트레킹 업데이트
      updateTracking(parsed, dateStr);
      
      document.getElementById('last-updated').textContent = '업로드: ' + dateStr;
      // 서버에 PO 이력 동기화
      if(CURRENT_TOKEN) {
        var _histRows = hist.map(function(entry){
          return { upload_date: entry.date, changes_count: (entry.changes||[]).length, data_json: JSON.stringify(entry.data||[]) };
        });
        apiPost({ action:'setSheet', sheet:'po_history', data: _histRows })
          .catch(function(e){ console.warn('PO 서버 저장 오류:', e.message); });
      }

      alert('✅ PO 업로드 완료: ' + parsed.length + '건\n납품이력은 [납품이력 업로드] 버튼을 사용하세요.\n업로드: ' + dateStr);
      
      refreshAll();
      buildHistSelect();
      
      if(changes.length > 0) {
        const b = document.getElementById('badge-changes');
        b.textContent = changes.length; b.style.display='';
        poTab('changes');
      }
    } catch(err) {
      alert('PO 파싱 오류:\n' + err.message + '\n\n' + (err.stack||'').split('\n').slice(1,3).join('\n'));
    }
  };
  if(!_preloadedWb) {
    reader.readAsArrayBuffer(file);
  } else {
    // _preloadedWb가 있으면 바로 실행
    reader.onload({target:{result:new ArrayBuffer(0)}});
  }
}


function parseRows(rawInput) {
  // header:1 방식(배열) 또는 header:0 방식(객체) 모두 지원
  var raw = rawInput;
  var useObj = !Array.isArray(rawInput[0]);

  if(!useObj) {
    // header:1 배열 방식 - 첫행이 헤더
    var hdr = rawInput[0];
    // 'Item' 컬럼 찾기 (숫자 값이 들어있으면 col3 자리)
    var itemColIdx = hdr.indexOf('Item');
    if(itemColIdx < 0) {
      // 헤더가 없거나 다른 버전 - col3이 품번 데이터 컬럼으로 추정
      // CCN이 col1이면 col3이 Item
      if(String(hdr[0]).trim()==='CCN') itemColIdx = 2;
    }
    // 객체 배열로 변환
    raw = rawInput.slice(1).map(function(row) {
      var obj = {};
      // 중복 헤더 처리: 첫 번째 등장한 헤더만 사용 (마지막이 덮어쓰지 않도록)
      hdr.forEach(function(h, i) {
        if(h && !(h in obj)) obj[h] = row[i];  // 첫 번째 등장만
      });
      if(itemColIdx >= 0 && !obj['Item']) obj['Item'] = row[itemColIdx];
      return obj;
    });
  }

  return raw.filter(function(r) {
    var item = r['Item'];
    return item && String(item).trim() && String(item).trim() !== 'nan';
  }).map(r => {
    const rawItem = r['Item']; const item = String(typeof rawItem==='number' ? Math.round(rawItem) : rawItem||'').trim().replace(/\.0$/,'');
    const promise = fmtDate(r['Promise Date']);
    const required = fmtDate(r['Required Date']);
    const srev = String(r['SRev']||'').trim();
    const brev = String(r['BRev']||'').trim();
    const gap = calcGap(promise, required);
    const trackRaw = String(r['비고']||'').trim();
    const trackNum = extractTrackNum(trackRaw);
    const _chuldoRaw = r['출도 납기'];
    const chuldoVal = _chuldoRaw instanceof Date ? fmtDate(_chuldoRaw) : String(_chuldoRaw||'').trim();
    const shipped = chuldoVal === '발송 완료';
    const overdue = shipped ? 0 : calcOverdue(promise);
    return {
      item, desc: String(r['Item Desc']||'').trim(),
      pn: String(r['PN']||r['Item']||'').trim().replace(/\.0$/,''),
      rv: String(r['REV']||r['SRev']||'').trim(),
      ccn: String(r['CCN']||'').trim(),
      type: String(r['Plan Exc Type']||'').trim(),
      order: String(r['OrderNumber']||'').trim(),
      orderLine: String(r['Order Lines']||'').trim(),
      delLine: String(r['Del Line']||'').trim(),
      qty: parseFloat(r['Quantity']||0)||0,
      unit: String(r['Buy UM']||'EA').trim(),
      promise, required,
      srev, brev,
      rev_chg: srev && brev && srev !== brev,
      gap, overdue, shipped,
      delay: gap,
      status: String(r['Status']||'').trim(),
      lt: parseFloat(r['Fixed Lead Time']||0)||0,
      placed: fmtDate(r['Date Placed']),
      chuldo: (r['출도 납기'] instanceof Date ? fmtDate(r['출도 납기']) : String(r['출도 납기']||'').trim()),
      chuldo_date: fmtDate(r['출도일']),
      issue_date: r['출도일'] ? fmtDate(r['출도일']) : '',
      trackNum, trackRaw,
      alt: String(r['대체여부']||'').trim(),
      unit_price: parseFloat(r['Unit Price']||0)||0,
      extended_price: parseFloat(String(r['Extended Price']||'').replace(/[^\d.]/g,''))||0,
      amount: parseFloat(String(r['Extended Price']||'').replace(/[^\d.]/g,''))||parseFloat(r['Unit Price']||0)||0,
    };
  }).filter(r => r.item && r.item !== 'nan')
   .filter((r, idx, arr) => arr.findIndex(x => x.item===r.item && x.order===r.order && x.delLine===r.delLine) === idx); // Del Line 포함 중복 제거
}


function fmtDate(v) {
  if(!v && v!==0) return '';
  // JS Date 객체 (raw:true + cellDates:true)
  if(v instanceof Date) {
    const y=v.getUTCFullYear(), m=String(v.getUTCMonth()+1).padStart(2,'0'), d=String(v.getUTCDate()).padStart(2,'0');
    return y+'-'+m+'-'+d;
  }
  const s = String(v).trim();
  if(!s || s==='0') return '';
  // YYYY-MM-DD
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0,10);
  // MM/DD/YYYY or M/D/YYYY
  const mdy4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(mdy4) return mdy4[3]+'-'+mdy4[1].padStart(2,'0')+'-'+mdy4[2].padStart(2,'0');
  // M/D/YY (엑셀 raw:false 날짜: "3/19/26")
  const mdy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if(mdy2) {
    const yr = parseInt(mdy2[3]); const fullYr = yr < 50 ? 2000+yr : 1900+yr;
    return fullYr+'-'+mdy2[1].padStart(2,'0')+'-'+mdy2[2].padStart(2,'0');
  }
  // 엑셀 시리얼 숫자
  const n = parseFloat(s);
  if(!isNaN(n) && n>40000 && n<60000) {
    const d = new Date(Math.round((n-25569)*86400*1000));
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  return s.replace(/\s.*$/,'').substring(0,10)||'';
}


function calcGap(promise, required) {
  if(!promise || !required) return 0;
  const d = (new Date(promise) - new Date(required)) / 86400000;
  return isNaN(d) ? 0 : Math.round(d);
}


function calcOverdue(promise) {
  if(!promise) return 0;
  const d = (new Date() - new Date(promise)) / 86400000;
  return isNaN(d) ? 0 : Math.round(d);
}


function extractTrackNum(memo) {
  if(!memo || memo==='nan' || memo==='None' || memo==='') return '';
  // "6482473826 / JS0203261" 형태 또는 순수 숫자 8자리+ 추출
  const m = memo.match(/\d{8,}/);
  if(m) return memo.trim();
  return '';
}


function detectChanges(prev, curr) {
  const changes = [];
  const prevMap = {};
  prev.forEach(r => { prevMap[r.item + '|' + r.order] = r; });
  const currMap = {};
  curr.forEach(r => { currMap[r.item + '|' + r.order] = r; });

  // 신규 PO
  curr.forEach(r => {
    if(!prevMap[r.item+'|'+r.order]) {
      changes.push({type:'new', item:r.item, desc:r.desc, order:r.order, promise:r.promise, ccn:r.ccn, detail:'신규 PO 등록'});
    }
  });

  // 사라진 PO (분류)
  prev.forEach(r => {
    if(!currMap[r.item+'|'+r.order]) {
      let goneType = 'unknown';
      let goneLabel = '확인 필요';
      if(r.chuldo === '발송 완료') { goneType='shipped'; goneLabel='납품 완료 (발송완료 후 삭제)'; }
      else if(r.type === 'CAN') { goneType='cancelled'; goneLabel='취소 (CAN)'; }
      else {
        const sameItem = curr.find(c => c.item === r.item && c.order !== r.order);
        if(sameItem) { goneType='merged'; goneLabel=`오더 통합 → ${sameItem.order}`; }
      }
      changes.push({type:'gone', goneType, item:r.item, desc:r.desc, order:r.order, promise:r.promise, ccn:r.ccn, detail:goneLabel, prevData:r});
    }
  });

  // 납기 변동
  curr.forEach(r => {
    const p = prevMap[r.item+'|'+r.order];
    if(p && p.promise && r.promise && p.promise !== r.promise) {
      const diff = Math.round((new Date(r.promise)-new Date(p.promise))/86400000);
      changes.push({type:'delay', item:r.item, desc:r.desc, order:r.order, promise:r.promise, ccn:r.ccn,
        detail:`Promise ${p.promise} → ${r.promise} (${diff>0?'+':''}${diff}일)`, diff});
    }
  });

  // REV 변경 (이전과 비교)
  curr.forEach(r => {
    const p = prevMap[r.item+'|'+r.order];
    if(p && p.brev && r.brev && p.brev !== r.brev) {
      changes.push({type:'rev', item:r.item, desc:r.desc, order:r.order, promise:r.promise, ccn:r.ccn,
        detail:`BRev ${p.brev} → ${r.brev}`, srev:r.srev, brev:r.brev});
    }
  });

  // CCN B 트레킹번호 변경
  curr.filter(r=>r.ccn==='B').forEach(r => {
    const p = prevMap[r.item+'|'+r.order];
    if(p && p.trackNum !== r.trackNum && r.trackNum) {
      changes.push({type:'track', item:r.item, desc:r.desc, order:r.order, promise:r.promise, ccn:r.ccn,
        detail:`트레킹번호: ${r.trackNum}`, prev_track:p.trackNum});
    }
  });

  return changes;
}


function updateTracking(data, dateStr) {
  const track = getTrack();
  data.filter(r => r.ccn === 'B').forEach(r => {
    const key = r.item + '|' + r.order;
    if(!track[key]) track[key] = {item:r.item, desc:r.desc, order:r.order, history:[]};
    const last = track[key].history[0];
    if(!last || last.trackNum !== r.trackNum || last.chuldo !== r.chuldo) {
      track[key].history.unshift({date:dateStr, trackNum:r.trackNum, chuldo:r.chuldo, promise:r.promise});
    }
    track[key].desc = r.desc;
  });
  saveTrack(track);
}


function toggleChip(id) {
  if(id==='all'){poFilters.clear();poFilters.add('all');}
  else{poFilters.delete('all');poFilters.has(id)?poFilters.delete(id):poFilters.add(id);if(!poFilters.size)poFilters.add('all');}
  document.querySelectorAll('[id^="cp-"]').forEach(el=>el.classList.remove('on','default','red','amber','purple','teal'));
  poFilters.forEach(f=>{const el=document.getElementById('cp-'+f);if(el){el.classList.add('on');
    const cls={all:'default',overdue:'red',gap:'amber',rev:'default',hot:'purple',K:'default',B:'default',RSIN:'default',RSOU:'default',CAN:'red'}[f]||'default';
    el.classList.add(cls);}});
  poPage=1; renderPO();
}


function srt(key) {
  if(sortKey===key) sortDir*=-1; else { sortKey=key; sortDir=1; }
  // 헤더 화살표 표시
  document.querySelectorAll('th[data-sort]').forEach(th => {
    const s = th.getAttribute('data-sort');
    const arrow = s===key ? (sortDir===1?' ▲':' ▼') : '';
    th.innerHTML = th.innerHTML.replace(/ [▲▼]$/,'') + arrow;
    th.style.color = s===key ? 'var(--accent)' : '';
  });
  renderPO();
}


function filteredPO() {
  const q = document.getElementById('po-q')?.value.toLowerCase()||'';
  return PO.filter(r=>{
    if(q && !r.item.toLowerCase().includes(q) && !r.desc.toLowerCase().includes(q) && !r.order.toLowerCase().includes(q) && !(r.trackNum||'').toLowerCase().includes(q)) return false;
    if(poFilters.has('all')) return true;
    if(poFilters.has('overdue') && r.overdue > 0) return true;
    if(poFilters.has('gap')     && r.gap > 0)     return true;
    if(poFilters.has('rev')     && r.rev_chg)      return true;
    if(poFilters.has('hot')     && r.type==='HOT') return true;
    if(poFilters.has('K')       && r.ccn==='K')    return true;
    if(poFilters.has('B')       && r.ccn==='B')    return true;
    if(poFilters.has('RSIN')    && r.type==='RSIN')return true;
    if(poFilters.has('RSOU')    && r.type==='RSOU')return true;
    if(poFilters.has('CAN')     && r.type==='CAN') return true;
    return false;
  }).sort((a,b)=>{
    let va = a[sortKey], vb = b[sortKey];
    if(DATE_KEYS.has(sortKey)) {
      const da = va ? new Date(va) : new Date('9999-12-31');
      const db = vb ? new Date(vb) : new Date('9999-12-31');
      return (da - db) * sortDir;
    }
    if(typeof va === 'number') return (va - vb) * sortDir;
    return String(va||'').localeCompare(String(vb||''), 'ko') * sortDir;
  });
}


function getPOKey(r){ return r.item+'|'+r.order+'|'+(r.delLine||''); }


function toggleAllPO(el){
  const data = filteredPO();
  const slice = data.slice((poPage-1)*PER, poPage*PER);
  slice.forEach(r=>{ el.checked ? selectedPOKeys.add(getPOKey(r)) : selectedPOKeys.delete(getPOKey(r)); });
  renderPO();
  updatePOActionBar();
}


function togglePORow(key, el){
  el.checked ? selectedPOKeys.add(key) : selectedPOKeys.delete(key);
  updatePOActionBar();
  const tr = el.closest('tr');
  if(tr) tr.classList.toggle('po-selected', el.checked);
}


function updatePOActionBar(){
  const n = selectedPOKeys.size;
  const bar = document.getElementById('po-action-bar');
  const info = document.getElementById('po-sel-info');
  bar.classList.toggle('show', n > 0);
  info.textContent = n+'건 선택됨';
  // 분할은 정확히 1건만
  const splitBtn = bar.querySelector('.split');
  if(splitBtn) splitBtn.style.opacity = n===1 ? '1' : '0.4';
  if(splitBtn) splitBtn.style.pointerEvents = n===1 ? '' : 'none';
}


function clearPOSelect(){
  selectedPOKeys.clear();
  renderPO();
  updatePOActionBar();
}


function renderPO() {
  if(!PO || !PO.length){ document.getElementById('po-tbody').innerHTML='<tr><td colspan="15" style="text-align:center;padding:40px;color:var(--text3)">엑셀 파일을 업로드하세요</td></tr>'; return; }
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.style.color = '';
    const s = th.getAttribute('data-sort');
    if(s === sortKey) th.style.color = 'var(--accent)';
  });
  const data = filteredPO();
  const total = data.length, pages = Math.ceil(total/PER)||1;
  if(poPage>pages) poPage=1;
  const slice = data.slice((poPage-1)*PER, poPage*PER);
  document.getElementById('po-cnt').textContent = total+'건';
  document.getElementById('po-pgn-info').textContent = `${poPage}/${pages} (${total}건)`;
  document.getElementById('po-prev').disabled = poPage===1;
  document.getElementById('po-next').disabled = poPage===pages;
  const allChk = document.getElementById('po-chk-all');
  if(allChk) allChk.checked = slice.length > 0 && slice.every(r=>selectedPOKeys.has(getPOKey(r)));
  const typeCls = {HOT:'bd-purple',RSIN:'bd-blue',RSOU:'bd-amber',CAN:'bd-red'};
  document.getElementById('po-tbody').innerHTML = slice.map(r=>{
    const key = getPOKey(r);
    const checked = selectedPOKeys.has(key);
    const deliveredTag = r._delivered ? `<span class="bd bd-green" style="font-size:9px">납품완료</span> ` : '';
    const splitTag = r._splitFrom ? `<span class="bd bd-purple" style="font-size:9px">분할</span> ` : '';
    const issueTd = r.issue_date
      ? `<td style="font-family:var(--mono);font-size:11px;color:var(--teal)">${fmtShortDate(r.issue_date)}</td>`
      : `<td style="color:var(--text3);font-size:11px">—</td>`;
    return `<tr class="${checked?'po-selected':''}">
    <td style="text-align:center"><input type="checkbox" class="po-chk" ${checked?'checked':''} onchange="togglePORow('${key}',this)"></td>
    <td style="font-family:var(--mono);font-size:11px;color:var(--accent)">${splitTag}${deliveredTag}${r.item}</td>
    <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;color:var(--text)">${r.desc}</td>
    <td style="font-family:var(--mono);font-size:11px">${fmtShortDate(r.promise)}</td>
    <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${fmtShortDate(r.required)}</td>
    <td>${r.overdue>0?`<span style="color:var(--red);font-weight:700;font-family:var(--mono)">+${r.overdue}일</span>`:`<span style="color:var(--text3)">—</span>`}</td>
    <td>${r.gap>0?`<span style="color:var(--amber);font-family:var(--mono)">+${r.gap}일</span>`:r.gap<0?`<span style="color:var(--green);font-family:var(--mono)">${r.gap}일</span>`:`<span style="color:var(--text3)">—</span>`}</td>
    <td>${r.rev_chg?`<span style="color:var(--amber);font-weight:700;font-family:var(--mono)">${r.brev}→${r.srev}</span>`:`<span style="color:var(--text3);font-family:var(--mono)">${r.srev}</span>`}</td>
    <td style="text-align:center"><span class="bd ${r.ccn==='K'?'bd-red':r.ccn==='B'?'bd-amber':'bd-gray'}">${r.ccn||'—'}</span></td>
    <td><span class="bd ${typeCls[r.type]||'bd-gray'}">${r.type||'—'}</span></td>
    <td style="text-align:right;font-family:var(--mono)">${r.qty.toLocaleString()} ${r.unit}</td>
    ${issueTd}
    <td style="font-family:var(--mono);font-size:10px;color:var(--text3)">${r.order}</td>
    <td style="font-family:var(--mono);font-size:10px;text-align:center;color:var(--text3)">${r.delLine||'—'}</td>
    <td style="font-size:11px;color:${r.shipped?'var(--green)':'var(--text3)'}">${r.chuldo&&r.chuldo!=='nan'?fmtShortDate(r.chuldo.substring(0,10)):'—'}</td>
    <td style="font-family:var(--mono);font-size:10px;color:var(--amber)">${r.trackNum||'—'}</td>
  </tr>`;}).join('');
}


function chgPage(d) { poPage+=d; renderPO(); }


function savePOChanges(){
  const hist = getHist();
  if(hist.length){ hist[0].data = PO; saveHist(hist); }
}


function closeModal(id){ document.getElementById(id).classList.remove('on'); }


function openIssueModal(){
  if(!selectedPOKeys.size){ alert('출도일을 입력할 항목을 선택하세요'); return; }
  const rows = PO.filter(r=>selectedPOKeys.has(getPOKey(r)));
  document.getElementById('issue-list').innerHTML = rows.map(r=>`
    <div class="deliver-item">
      <span style="font-family:var(--mono);font-size:11px;color:var(--accent);width:120px;flex-shrink:0">${r.item}</span>
      <span style="font-size:11px;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis">${r.desc}</span>
      <span class="bd ${r.ccn==='K'?'bd-red':r.ccn==='B'?'bd-amber':'bd-gray'}" style="flex-shrink:0">${r.ccn||'—'}</span>
      ${r.issue_date?`<span style="font-family:var(--mono);font-size:10px;color:var(--teal);flex-shrink:0">기존: ${r.issue_date}</span>`:''}
    </div>`).join('');
  document.getElementById('issue-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('issue-note').value = '';
  document.getElementById('m-issue').classList.add('on');
}


function exportPOCSV(){
  const data = filteredPO();
  if(!data.length){ alert('내보낼 데이터가 없습니다'); return; }
  const header = ['품번','품명','Promise Date','Required Date','경과일','요청갭','REV','CCN','구분','수량','단위','출도일','오더','출도납기','트레킹번호'];
  const esc = v=>{ const s=String(v==null?'':v); return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:s; };
  const rows = data.map(r=>[
    r.item, r.desc, r.promise||'', r.required||'',
    r.overdue>0?'+'+r.overdue+'일':'',
    r.gap>0?'+'+r.gap+'일':r.gap<0?r.gap+'일':'',
    r.srev||'', r.ccn||'', r.type||'',
    r.qty, r.unit||'EA',
    r.issue_date||'',
    r.order||'',
    r.chuldo&&r.chuldo!=='nan'?r.chuldo.substring(0,10):'',
    r.trackNum||''
  ]);
  const csv = '\uFEFF' + [header,...rows].map(r=>r.map(esc).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download = `PO현황_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}


function openDeliverModal(){
  if(!selectedPOKeys.size){ alert('납품처리할 항목을 선택하세요'); return; }
  const rows = PO.filter(r=>selectedPOKeys.has(getPOKey(r)));
  // 선택 항목 목록 표시
  document.getElementById('deliver-list').innerHTML = rows.map(r=>{
    const safeKey = getPOKey(r).replace(/[|.]/g,'_');
    return `<div class="deliver-item">
      <span style="font-family:var(--mono);font-size:11px;color:var(--accent);width:110px;flex-shrink:0">${r.item}</span>
      <span style="font-size:11px;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis">${r.desc}</span>
      <span class="bd ${r.ccn==='K'?'bd-red':r.ccn==='B'?'bd-amber':'bd-gray'}" style="flex-shrink:0">${r.ccn||'—'}</span>
      <span style="font-family:var(--mono);font-size:11px;color:var(--text3);flex-shrink:0;width:55px;text-align:right">${r.qty} ${r.unit||'EA'}</span>
      <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
        <span style="font-size:10px;color:var(--text3)">${r.ccn==='B'?'$':'₩'}</span>
        <input id="d-price-${safeKey}" type="number" min="0" step="any"
          placeholder="${r.ccn==='B'?'단가(USD)':'단가(₩)'}"
          style="width:90px;padding:3px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-family:var(--mono);font-size:11px">
      </div>
    </div>`;
  }).join('');
  document.getElementById('d-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('d-track').value = '';
  document.getElementById('d-note').value = '';
  document.getElementById('m-deliver').classList.add('on');
}


function confirmDeliver(){
  const dt = document.getElementById('d-date').value;
  const track = document.getElementById('d-track').value.trim();
  const note = document.getElementById('d-note').value.trim();
  if(!dt){ alert('납품일을 입력하세요'); return; }

  const targets = PO.filter(r=>selectedPOKeys.has(getPOKey(r)));
  if(!targets.length){ alert('선택된 항목이 없습니다'); return; }

  // 납품완료 저장소에 추가
  const delivered = getDelivered();
  targets.forEach(r=>{
    const safeKey = getPOKey(r).replace(/[|.]/g,'_');
    const up = parseFloat(document.getElementById('d-price-'+safeKey)?.value) || r.unit_price || 0;
    const autoAmt = r.amount || (up * (r.qty||1));
    delivered.unshift({
      ...r,
      _id: Date.now() + '_' + Math.random().toString(36).slice(2),
      _source: 'po',
      deliveredDate: dt,
      trackNum: track || r.trackNum || '',
      unitPrice: up,
      amount: autoAmt || up * (r.qty||1),  // CCN B: USD, CCN K: KRW
      note: note || '',
      _deliveredAt: new Date().toLocaleString('ko-KR'),
    });
  });
  saveDelivered(delivered);

  // PO에서 제거
  const keySet = new Set(targets.map(getPOKey));
  PO = PO.filter(r=>!keySet.has(getPOKey(r)));
  savePOChanges();

  updateDeliveredBadge();
  closeModal('m-deliver');
  clearPOSelect();
  renderPO();
  renderDash();
  renderSalesDash();
  renderAggIfOpen();
  alert(`✅ ${targets.length}건 납품완료 처리 — "납품 완료" 탭에서 확인하세요`);
}


function openSplitModal(){
  if(selectedPOKeys.size !== 1){ alert('분할납품은 1건만 선택하세요'); return; }
  splitTargetKey = [...selectedPOKeys][0];
  const r = PO.find(x=>getPOKey(x)===splitTargetKey);
  if(!r){ alert('선택한 PO를 찾을 수 없습니다'); return; }
  document.getElementById('split-info').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <div><div class="label">품번</div><div class="val">${r.item}</div></div>
      <div><div class="label">오더</div><div class="val" style="color:var(--text3)">${r.order}</div></div>
      <div><div class="label">CCN</div><div class="val" style="color:${r.ccn==='K'?'var(--red)':'var(--amber)'}">${r.ccn||'—'}</div></div>
      <div style="grid-column:1/-1"><div class="label">품명</div><div style="font-size:12px;color:var(--text);margin-top:2px">${r.desc}</div></div>
      <div><div class="label">원본 수량</div><div class="val">${r.qty.toLocaleString()} ${r.unit}</div></div>
      <div><div class="label">Promise Date</div><div class="val" style="color:var(--text3)">${r.promise||'—'}</div></div>
      <div><div class="label">Required Date</div><div class="val" style="color:var(--text3)">${r.required||'—'}</div></div>
    </div>`;
  document.getElementById('split-orig-qty').textContent = r.qty.toLocaleString()+' '+r.unit;
  // 초기 2행
  splitRowCount = 0;
  document.getElementById('split-rows').innerHTML = '';
  addSplitRow(Math.floor(r.qty/2), r.promise);
  addSplitRow(r.qty - Math.floor(r.qty/2), '');
  updateSplitSum();
  document.getElementById('m-split').classList.add('on');
}


function addSplitRow(qty='', promise=''){
  const id = ++splitRowCount;
  const r = PO.find(x=>getPOKey(x)===splitTargetKey);
  const div = document.createElement('div');
  div.className = 'split-row';
  div.id = 'sr-'+id;
  div.innerHTML = `
    <div class="split-row-num">#${id}</div>
    <div>
      <span class="mfl">수량 *</span>
      <input class="minput" id="sq-${id}" type="number" min="0.01" step="any" value="${qty}" oninput="updateSplitSum()" placeholder="수량">
    </div>
    <div>
      <span class="mfl">단위</span>
      <input class="minput" value="${r?r.unit:'EA'}" readonly>
    </div>
    <div>
      <span class="mfl">Promise Date *</span>
      <input class="minput" id="sp-${id}" type="date" value="${promise}">
    </div>
    <div style="padding-bottom:6px">
      <button onclick="removeSplitRow(${id})" style="width:24px;height:24px;background:var(--red-bg);color:var(--red);border:1px solid var(--red);border-radius:4px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center">✕</button>
    </div>`;
  document.getElementById('split-rows').appendChild(div);
  updateSplitSum();
}


function removeSplitRow(id){
  const el = document.getElementById('sr-'+id);
  if(el) el.remove();
  updateSplitSum();
}


function updateSplitSum(){
  let sum = 0;
  document.querySelectorAll('[id^="sq-"]').forEach(el=>{ sum += parseFloat(el.value)||0; });
  const r = PO.find(x=>getPOKey(x)===splitTargetKey);
  const orig = r ? r.qty : 0;
  const sumEl = document.getElementById('split-sum-qty');
  const warnEl = document.getElementById('split-qty-warn');
  if(sumEl) sumEl.textContent = sum.toLocaleString();
  const match = Math.abs(sum - orig) < 0.001;
  if(sumEl) sumEl.style.color = match ? 'var(--green)' : 'var(--red)';
  if(warnEl) warnEl.classList.toggle('show', !match && sum > 0);
}


function confirmSplit(){
  const r = PO.find(x=>getPOKey(x)===splitTargetKey);
  if(!r){ alert('원본 PO를 찾을 수 없습니다'); return; }
  // 수집
  const rows = [];
  let hasErr = false;
  document.querySelectorAll('#split-rows .split-row').forEach(div=>{
    const id = div.id.replace('sr-','');
    const qty = parseFloat(document.getElementById('sq-'+id)?.value)||0;
    const promise = document.getElementById('sp-'+id)?.value||'';
    if(!qty){ alert('수량을 입력하세요'); hasErr=true; return; }
    if(!promise){ alert('Promise Date를 입력하세요'); hasErr=true; return; }
    rows.push({qty, promise});
  });
  if(hasErr || !rows.length) return;
  // 수량 합계 검증
  const sum = rows.reduce((s,x)=>s+x.qty,0);
  if(Math.abs(sum - r.qty) > 0.001){
    if(!confirm(`분할 수량 합계(${sum})가 원본 수량(${r.qty})과 다릅니다.\n그래도 진행하시겠습니까?`)) return;
  }
  if(!confirm(`${r.item}을 ${rows.length}건으로 분할합니다.\n원본 PO는 제거됩니다.`)) return;

  const idx = PO.indexOf(r);
  // 원본 제거 후 분할 행 삽입
  const newRows = rows.map((x,i)=>({
    ...r,
    qty: x.qty,
    promise: x.promise,
    overdue: calcOverdue(x.promise),
    gap: calcGap(x.promise, r.required),
    _splitFrom: getPOKey(r),
    _splitIdx: i+1,
    order: r.order + (i>0?`-S${i+1}`:''),
  }));
  PO.splice(idx, 1, ...newRows);
  savePOChanges();
  closeModal('m-split');
  clearPOSelect();
  renderDash();
  alert(`✅ 분할 완료: ${r.item} → ${rows.length}건`);
}


function toggleChgFilter(f) {
  if(f==='all'){chgFilter.clear();chgFilter.add('all');}
  else{chgFilter.delete('all');chgFilter.has(f)?chgFilter.delete(f):chgFilter.add(f);if(!chgFilter.size)chgFilter.add('all');}
  ['all','delay','rev','new','gone'].forEach(k=>{const el=document.getElementById('chg-'+k);if(el){el.classList.remove('on','default','red','amber','green','teal');
    if(chgFilter.has(k)){el.classList.add('on');el.classList.add({all:'default',delay:'red',rev:'amber',new:'green',gone:'teal'}[k]||'default');}}});
  renderChanges();
}


function changeCard(c) {
  const cfg = {
    new:  {cls:'green', icon:'✦', label:'신규'},
    gone: {cls: c.goneType==='shipped'?'teal':c.goneType==='cancelled'?'red':'amber', icon: c.goneType==='shipped'?'✓':c.goneType==='cancelled'?'✕':'?', label: c.goneType==='shipped'?'납품완료':c.goneType==='cancelled'?'취소':c.goneType==='merged'?'통합':'확인필요'},
    delay:{cls:'red',   icon:'⏱', label:'납기변동'},
    rev:  {cls:'amber', icon:'↺', label:'REV변경'},
    track:{cls:'amber', icon:'📦',label:'트레킹'},
  }[c.type] || {cls:'gray',icon:'·',label:'기타'};
  return `<div class="cc ${cfg.cls}">
    <div class="cc-icon">${cfg.icon}</div>
    <div class="cc-body">
      <div class="cc-pn">${c.item} <span style="font-family:var(--font);font-size:10px;color:var(--text3)">· ${c.order} · ${c.ccn||'—'}</span></div>
      <div class="cc-desc">${c.desc}</div>
      <div class="cc-detail">${c.detail}</div>
    </div>
    <div class="cc-meta"><span class="bd bd-${cfg.cls==='red'?'red':cfg.cls==='amber'?'amber':cfg.cls==='green'?'green':cfg.cls==='teal'?'teal':'gray'}">${cfg.label}</span><br><span style="font-size:10px;margin-top:4px;display:block">${c.promise||'—'}</span></div>
  </div>`;
}


function toggleTrkFilter(f) {
  if(f==='all'){trkFilterState.clear();trkFilterState.add('all');}
  else{trkFilterState.delete('all');trkFilterState.has(f)?trkFilterState.delete(f):trkFilterState.add(f);if(!trkFilterState.size)trkFilterState.add('all');}
  ['all','has','none','shipped'].forEach(k=>{const el=document.getElementById('trk-'+k);if(el){el.classList.remove('on','default','amber','red','green');
    if(trkFilterState.has(k)){el.classList.add('on');el.classList.add({all:'default',has:'amber',none:'red',shipped:'green'}[k]||'default');}}});
  renderTracking();
}


function toggleTrack(key, header) {
  const id = 'tb-' + key.replace(/[|.]/g,'');
  const body = document.getElementById(id);
  if(!body) return;
  body.classList.toggle('open');
}


function dvChip(f){
  if(f==='all'){dvFilter.clear();dvFilter.add('all');}
  else{dvFilter.delete('all');dvFilter.has(f)?dvFilter.delete(f):dvFilter.add(f);if(!dvFilter.size)dvFilter.add('all');}
  ['all','B','K','notrack'].forEach(k=>{
    const el=document.getElementById('dvc-'+k);
    if(!el) return;
    el.classList.remove('on','default');
    if(dvFilter.has(k)){ el.classList.add('on','default'); }
  });
  dvPage=1; renderDelivered();
}


function dvChgPage(d){ dvPage+=d; renderDelivered(); }


function filteredDelivered(){
  const q = (document.getElementById('dv-q')||{value:''}).value.toLowerCase();
  const monthSel = document.getElementById('dv-month-sel')?.value||'';
  return getDelivered().filter(r=>{
    if(q && !(r.item+r.desc+(r.trackNum||'')+(r.order||'')).toLowerCase().includes(q)) return false;
    if(monthSel && !(r.deliveredDate||'').startsWith(monthSel)) return false;
    if(dvFilter.has('all')) return true;
    if(dvFilter.has('B') && r.ccn==='B') return true;
    if(dvFilter.has('K') && r.ccn==='K') return true;
    if(dvFilter.has('notrack') && !r.trackNum) return true;
    return false;
  });
}


function buildDvMonthSel(data){
  const months = [...new Set(data.map(r=>(r.deliveredDate||'').substring(0,7)).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
  const sel = document.getElementById('dv-month-sel');
  if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">전체 기간</option>' + months.map(m=>`<option value="${m}" ${m===cur?'selected':''}>${m}</option>`).join('');
}


function openDvEdit(id){
  const all = getDelivered();
  const r = all.find(x=>x._id===id);
  if(!r) return;
  dvEditId = id;
  document.getElementById('dv-edit-info').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div><div class="label">품번</div><div class="val">${r.item}</div></div>
      <div><div class="label">CCN</div><div class="val" style="color:${r.ccn==='K'?'var(--red)':'var(--amber)'}">${r.ccn||'—'}</div></div>
      <div><div class="label">등록일시</div><div style="font-size:11px;color:var(--text3);margin-top:2px">${r._deliveredAt||'—'}</div></div>
      <div style="grid-column:1/-1"><div class="label">품명</div><div style="font-size:12px;color:var(--text);margin-top:2px">${r.desc||'—'}</div></div>
    </div>`;
  document.getElementById('dve-date').value    = r.deliveredDate||'';
  document.getElementById('dve-track').value   = r.trackNum||'';
  document.getElementById('dve-price').value   = r.unitPrice||'';
  document.getElementById('dve-qty').value     = r.qty||'';
  document.getElementById('dve-promise').value = r.promise||'';
  document.getElementById('dve-order').value   = r.order||'';
  document.getElementById('dve-note').value    = r.note||'';
  document.getElementById('m-dv-edit').classList.add('on');
}


function saveDvEdit(){
  if(!dvEditId) return;
  const dt = document.getElementById('dve-date').value;
  if(!dt){ alert('납품일을 입력하세요'); return; }
  const all = getDelivered();
  const idx = all.findIndex(x=>x._id===dvEditId);
  if(idx<0) return;
  all[idx] = {
    ...all[idx],
    deliveredDate: dt,
    trackNum: document.getElementById('dve-track').value.trim(),
    unitPrice: parseFloat(document.getElementById('dve-price').value)||0,
    qty: parseFloat(document.getElementById('dve-qty').value)||all[idx].qty,
    promise: document.getElementById('dve-promise').value,
    order: document.getElementById('dve-order').value.trim(),
    note: document.getElementById('dve-note').value.trim(),
    _editedAt: new Date().toLocaleString('ko-KR'),
  };
  saveDelivered(all);
  closeModal('m-dv-edit');
  renderDelivered();
}


function confirmRestoreToPA(){
  if(!dvEditId) return;
  closeModal('m-dv-edit');
  restoreToPO(dvEditId);
}


function restoreToPO(id){
  if(!confirm('이 항목을 PO 현황으로 되돌리시겠습니까?')) return;
  const all = getDelivered();
  const idx = all.findIndex(x=>x._id===id);
  if(idx<0) return;
  const r = all[idx];
  // 납품완료 필드 제거 후 PO 배열에 복원
  const restored = {...r};
  delete restored._id; delete restored.deliveredDate; delete restored.unitPrice;
  delete restored._deliveredAt; delete restored._editedAt;
  restored.shipped = false; restored.chuldo = ''; restored._delivered = false;
  restored.overdue = calcOverdue(restored.promise);
  PO.unshift(restored);
  all.splice(idx,1);
  saveDelivered(all);
  savePOChanges();
  updateDeliveredBadge();
  renderDelivered();
  renderPO();
  renderDash();
  alert(`↩ PO로 복원 완료: ${r.item}`);
}


function exportDeliveredCSV(){
  const data = filteredDelivered();
  if(!data.length){ alert('내보낼 데이터가 없습니다'); return; }
  const header = ['납품일','품번','품명','CCN','수량','단위','단가','오더','Promise Date','트레킹번호','비고','납품처리일시'];
  const esc = v=>{ const s=String(v==null?'':v); return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:s; };
  const rows = data.map(r=>[r.deliveredDate,r.item,r.desc,r.ccn,r.qty,r.unit||'EA',r.unitPrice||0,r.order,r.promise,r.trackNum||'',r.note||'',r._deliveredAt||'']);
  const csv = '\uFEFF' + [header,...rows].map(r=>r.map(esc).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download = `납품완료_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}


function getSalesData(){ try{ return JSON.parse(localStorage.getItem(LS_SALES)||'[]'); }catch{ return []; } }


function saveSalesData(d){ localStorage.setItem(LS_SALES, JSON.stringify(d)); }


function getExrate(){ return parseFloat(localStorage.getItem('po_exrate')||'1350')||1350; }


function saveExrate(v){ localStorage.setItem('po_exrate', String(v)); }


function handleSalesUpload(inp){
  if(inp.files[0]) processSalesFile(inp.files[0]);
  inp.value='';
}


function processSalesFile(file, _preloadedWb){
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();
  reader.onload = e => {
    try{
      let wb;
      if(ext==='csv') wb = XLSX.read(e.target.result, {type:'string'});
      else wb = XLSX.read(new Uint8Array(e.target.result), {type:'array', cellDates:true});
      // Received 시트 우선, 없으면 첫 시트
      var _salesSn = wb.SheetNames.find(function(n){ return n.trim()==='Received'; }) || wb.SheetNames[0];
      const ws = wb.Sheets[_salesSn];
      const sheetName = _salesSn;
      const raw = XLSX.utils.sheet_to_json(ws, {header:1, defval:'', raw:true, cellDates:true});

      // PO 파일 감지: 시트명이 'Current Data' 이거나 헤더에 '현황' 없는 PO 형식
      if(raw.length > 0){
        const hdr0 = raw[0].map(function(h){ return String(h||'').trim(); });
        const hasPOSign = sheetName === 'Current Data' ||
                          (hdr0[0]==='CCN' && hdr0[2]!=='Item' && !hdr0.includes('현황'));
        if(hasPOSign){
          alert('⚠️ 이 파일은 PO 현황 파일입니다.\n\n납품이력 업로드에는 시트명이 \'Received\'인 납품이력 파일을 사용하세요.\nPO 파일은 헤더의 [↑ PO 업로드] 버튼을 사용하세요.');
          return;
        }
      }

      const parsed = parseSalesRows(raw);
      if(!parsed.length){ alert('파싱된 데이터가 없습니다.\n\n[확인사항]\n- 시트명: Received\n- 헤더: CCN, Item, 현황, 정산일 포함\n- 현황 값: \'납품 완료\''); return; }

      // LS_DELIVERED에 병합 (중복 키: deliveredDate+item+order+amount)
      const existing = getDelivered();
      // upsert: _uid(Order|Line|DelLine) 기준 - 같으면 덮어쓰기, 없으면 추가
      var uidMap = {};
      existing.forEach(function(r){ if(r._uid) uidMap[r._uid] = true; });
      var toAdd = [], toUpdate = 0;
      parsed.forEach(function(r){
        if(r._uid && uidMap[r._uid]) toUpdate++;
        else toAdd.push(r);
      });
      // 기존에서 갱신된 항목 제거 후 새 데이터로 대체
      var kept = existing.filter(function(r){
        return !r._uid || !parsed.find(function(p){ return p._uid && p._uid===r._uid; });
      });
      const merged = parsed.concat(kept).sort((a,b)=>(b.deliveredDate||'').localeCompare(a.deliveredDate||''));
      // 전체 저장 (localStorage 초과 시 saveDelivered 내부에서 자동 처리)
      saveDelivered(merged);

      updateDeliveredBadge();
      buildYearTabs(merged);
      renderSalesDash();
      renderAggIfOpen();
      // CCN B 트레킹 업데이트 (비고1 트레킹번호 반영)
      const trackDateStr = new Date().toLocaleString('ko-KR');
      updateTrackFromDelivered(merged, trackDateStr);
      if(typeof renderTracking === 'function') renderTracking();
      poTab('sales');
      alert(`✅ ${toAdd.length}건 추가, ${toUpdate}건 갱신 (전체 납품완료 ${merged.length}건)\n파일: ${file.name}`);
    }catch(err){ alert('파일 파싱 오류: '+err.message); }
  };
  ext==='csv' ? reader.readAsText(file,'utf-8') : reader.readAsArrayBuffer(file);
}


function parseSalesRows(raw){
  if(!raw || raw.length < 2) return [];
  var hdrOrig = raw[0].map(function(c){ return String(c||''); });
  var hdrLow  = hdrOrig.map(function(c){ return c.toLowerCase().replace(/\s/g,''); });
  var fi = function(kws){ return hdrLow.findIndex(function(h){ return kws.some(function(k){ return h.includes(k); }); }); };
  var ts = function(v){
    if(!v) return '';
    // Date 객체 → YYYY-MM-DD (UTC 기준)
    if(v instanceof Date){ return v.getUTCFullYear()+'-'+String(v.getUTCMonth()+1).padStart(2,'0')+'-'+String(v.getUTCDate()).padStart(2,'0'); }
    var s=String(v).trim();
    // YYYY-MM-DD 또는 ISO 전체 문자열
    if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0,10);
    // MM/DD/YYYY
    var mdy4=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(mdy4) return mdy4[3]+'-'+mdy4[1].padStart(2,'0')+'-'+mdy4[2].padStart(2,'0');
    // 엑셀 시리얼 숫자
    var n=parseFloat(s);
    if(!isNaN(n)&&n>40000&&n<60000){ var d=new Date(Math.round((n-25569)*86400*1000)); return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0'); }
    return s;
  };
  var tn = function(v){ var n=parseFloat(String(v||'').replace(/[^0-9.-]/g,'')); return isNaN(n)?0:n; };
  var getCell = function(row,idx){ return idx>=0 ? row[idx] : ''; };

  var ccnIdx    = fi(['ccn']);
  var itemIdx   = fi(['item','품번','partnumber']);
  var descIdx   = fi(['item desc','itemdesc','품명','description']);
  var qtyIdx    = fi(['quantity','수량','qty']);
  var unitIdx   = fi(['buy um','unit','단위']);
  var upIdx     = fi(['unit price','unitprice','단가']);
  var extIdx    = fi(['extended price','extendedprice','금액','amount']);
  var orderIdx  = fi(['order number','ordernumber','order','주문번호']);
  var orderLineIdx = fi(['order lines','orderlines','order line']);
  var delLineIdx   = fi(['del line','delline']);
  var statusIdx = fi(['현황']); if(statusIdx<0) statusIdx=fi(['status']);
  var promiseIdx= fi(['promise date','promisedate','납기']);
  var jeongIdx  = fi(['정산일','세금계산서','tax']);  // 정산일(세금계산서일자) 우선
  var trackIdx  = fi(['비고1']); if(trackIdx<0) trackIdx=fi(['memo','비고','note']);
  var altIdx    = fi(['대체여부','alt']);

  var result = [];
  for(var i=1; i<raw.length; i++){
    var row = raw[i];
    if(!row || row.every(function(c){return !c;})) continue;

    // 현황 필터 - 납품완료/발송완료만
    var status = ts(getCell(row,statusIdx));
    if(status && status!=='납품 완료' && status!=='발송 완료') continue;

    var item = String(getCell(row,itemIdx)||'').trim().replace(/\.0$/,'');
    if(!item || item==='nan') continue;

    var ccn = ts(getCell(row,ccnIdx)).toUpperCase();
    // CCN이 숫자나 특수문자면 K로 처리
    if(!ccn) ccn='K';
    var isBCcn = ccn==='B';
    // 동신/동원 등 → K
    if(['동신','동원','DONG'].some(function(x){return ccn.includes(x)})) { ccn='K'; isBCcn=false; }

    var qty = tn(getCell(row,qtyIdx));
    var up  = tn(getCell(row,upIdx));
    var ext = tn(getCell(row,extIdx));
    // 총금액 = 수량 × 단가 (Extended Price가 정확하면 사용, 아니면 계산)
    var amount = (ext > 0 && Math.abs(ext - up*qty) < 1) ? ext : (up * qty);

    // 매출일자: Promise Date 기준
    var promise  = promiseIdx>=0 ? ts(getCell(row,promiseIdx)) : '';
    var deliveredDate = promise;
    if(!deliveredDate) continue;

    var orderNum  = ts(getCell(row,orderIdx)).replace(/\.0$/,'');
    var orderLine = orderLineIdx>=0 ? ts(getCell(row,orderLineIdx)).replace(/\.0$/,'') : '';
    var delLine   = delLineIdx>=0   ? ts(getCell(row,delLineIdx)).replace(/\.0$/,'')   : '';

    // 중복 키: OrderNumber + OrderLine + DelLine + Item + PromiseDate
    // orderLine/delLine이 비어있을 때 납품일로 구분
    var uid = orderNum+'|'+(orderLine||'')+'|'+(delLine||'')+'|'+item+'|'+(promise||'');

    var trackRaw = trackIdx>=0 ? ts(getCell(row,trackIdx)) : '';
    // memo(P열)도 트레킹 참고
    var memoVal  = fi(['memo','p열'])>=0 ? ts(getCell(row, fi(['memo']))) : '';
    var trackNum = '';
    // trackRaw 또는 memo에 숫자/영문 조합 있으면 트레킹번호로 사용
    var _trackSrc = (trackRaw && trackRaw!=='nan') ? trackRaw : memoVal;
    if(_trackSrc && _trackSrc!=='nan') {
      trackNum = _trackSrc.trim(); // 전체 내용 저장
    }

    result.push({
      _uid:         uid,
      _id:          uid+'_'+Math.random().toString(36).slice(2),
      _source:      'upload',
      _deliveredAt: new Date().toLocaleString('ko-KR'),
      deliveredDate: deliveredDate,
      item:         item,
      desc:         descIdx>=0 ? ts(getCell(row,descIdx)) : '',
      ccn:          ccn,
      qty:          qty,
      unit:         unitIdx>=0 ? ts(getCell(row,unitIdx)) : 'EA',
      unitPrice:    up,
      amount:       amount,
      order:        orderNum,
      orderLine:    orderLine,
      delLine:      delLine,
      trackNum:     trackNum,
      note:         trackRaw,
      promise:      promise,
    });
  }
  return result;
}


function extractYear(dateStr){
  if(!dateStr) return '';
  const s = String(dateStr).trim();
  // YYYY-MM-DD
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0,4);
  // MM/DD/YYYY or M/D/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(mdy) return mdy[3];
  // YYYYMMDD
  if(/^\d{8}$/.test(s)) return s.substring(0,4);
  // 그냥 4자리로 시작하면
  const m4 = s.match(/(\d{4})/);
  return m4 ? m4[1] : '';
}


function buildYearTabs(data){
  // data 항목들은 deliveredDate 필드를 가짐
  const years = [...new Set(data.map(r=>extractYear(r.deliveredDate||'')).filter(y=>y && /^\d{4}$/.test(y)))].sort((a,b)=>b-a);
  if(!years.length) return;
  if(!years.includes(String(salesYear))) salesYear = parseInt(years[0])||new Date().getFullYear();
  const el = document.getElementById('year-tabs');
  if(!el) return;
  el.innerHTML = years.map(y=>`<button class="year-tab${y==salesYear?' on':''}" onclick="setSalesYear(${y})">${y}년</button>`).join('');
}


function setSalesYear(y){
  salesYear=y;
  document.querySelectorAll('.year-tab').forEach(el=>{
    el.classList.toggle('on', parseInt(el.textContent)===y);
  });
  renderSalesDash();
}


function resetSalesData(){
  if(!confirm('업로드된 납품이력을 삭제하시겠습니까?\n(PO에서 직접 납품처리한 건은 유지됩니다)')) return;
  // _source:'upload' 항목만 제거
  const kept = getDelivered().filter(r=>r._source !== 'upload');
  saveDelivered(kept);
  updateDeliveredBadge();
  buildYearTabs(kept);
  renderSalesDash();
  renderDelivered();
  alert(`✅ 업로드 이력 삭제 완료 (잔여 ${kept.length}건)`);
}


function renderPOAmounts(){
  var exrate = getExrate();
  var fk = function(n){ if(!n||isNaN(n))return '—'; if(Math.abs(n)>=100000000)return (n/100000000).toFixed(1)+'억'; if(Math.abs(n)>=10000)return Math.round(n/10000).toLocaleString()+'만'; return n.toLocaleString(); };
  var fu = function(n){ if(!n||isNaN(n))return '—'; return '$'+(n>=1000?n.toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:0}):n.toFixed(0)); };

  var poData = (typeof PO !== 'undefined') ? PO : [];
  if(!poData.length){
    ['po-k-krw','po-b-usd','po-b-krw','po-total-krw'].forEach(function(id){ var el=document.getElementById(id); if(el) el.textContent='—'; });
    ['po-k-cnt','po-b-cnt','po-total-cnt'].forEach(function(id){ var el=document.getElementById(id); if(el) el.textContent='—'; });
    return;
  }

  var kRows = poData.filter(function(r){ return r.ccn==='K'; });
  var bRows = poData.filter(function(r){ return r.ccn==='B'; });

  // Extended Price 기준 (없으면 Unit Price × Qty)
  var getAmt = function(r){ return r.extended_price || r.amount || (r.unit_price||0)*(r.qty||1) || 0; };
  var kKrw = kRows.reduce(function(s,r){ return s+getAmt(r); }, 0);
  var bUsd = bRows.reduce(function(s,r){ return s+getAmt(r); }, 0);
  var bKrw = bUsd * exrate;
  var total = kKrw + bKrw;

  var el;
  el=document.getElementById('po-k-krw'); if(el) el.textContent=fk(kKrw);
  el=document.getElementById('po-k-cnt'); if(el) el.textContent=kRows.length+'건';
  el=document.getElementById('po-b-usd'); if(el) el.textContent=fu(bUsd);
  el=document.getElementById('po-b-cnt'); if(el) el.textContent=bRows.length+'건';
  el=document.getElementById('po-b-krw'); if(el) el.textContent=fk(bKrw);
  el=document.getElementById('po-total-krw'); if(el) el.textContent=fk(total);
  el=document.getElementById('po-total-cnt'); if(el) el.textContent=poData.length+'건';
}


function renderGrandTotal(){
  var fk=function(n){if(!n||isNaN(n))return '—';if(Math.abs(n)>=100000000)return (n/100000000).toFixed(1)+'억';if(Math.abs(n)>=10000)return Math.round(n/10000).toLocaleString()+'만';return n.toLocaleString();};
  var fu=function(n){if(!n||isNaN(n))return '—';return '$'+(n>=1000?n.toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:0}):n.toFixed(0));};
  var exrate=getExrate();
  var curYear=new Date().getFullYear();
  var isCurrentYear=(salesYear===curYear);

  // 납품완료 (선택 연도)
  var delAll=getDelivered().filter(function(r){return (r.deliveredDate||'').startsWith(String(salesYear));});
  var getAmt=function(r){return r.amount||((r.unitPrice||0)*(r.qty||1));};
  var delBUsd=delAll.filter(function(r){return r.ccn==='B';}).reduce(function(s,r){return s+getAmt(r);},0);
  var delKKrw=delAll.filter(function(r){return r.ccn==='K';}).reduce(function(s,r){return s+getAmt(r);},0);
  var delBKrw=delBUsd*exrate;

  // PO 잔여 — 현재 연도일 때만 합산
  var poBUsd=0, poKKrw=0, poBKrw=0, poCnt=0;
  if(isCurrentYear){
    var poData=(typeof PO!=='undefined')?PO:[];
    var getPoAmt=function(r){return r.extended_price||r.amount||(r.unit_price||0)*(r.qty||1)||0;};
    poBUsd=poData.filter(function(r){return r.ccn==='B';}).reduce(function(s,r){return s+getPoAmt(r);},0);
    poKKrw=poData.filter(function(r){return r.ccn==='K';}).reduce(function(s,r){return s+getPoAmt(r);},0);
    poBKrw=poBUsd*exrate;
    poCnt=poData.length;
  }

  var grandBUsd=delBUsd+poBUsd;
  var grandKKrw=delKKrw+poKKrw;
  var grandBKrw=grandBUsd*exrate;
  var grandTotal=grandKKrw+grandBKrw;
  var grandCnt=delAll.length+poCnt;

  // 제목 동적 변경
  var titleEl=document.querySelector('[data-grand-title]');
  if(titleEl) titleEl.textContent='🏆 총 사업 규모 ('+(isCurrentYear?'납품완료 + PO잔여 합산':'납품완료 기준 · '+salesYear+'년')+')';

  var subEl=document.getElementById('grand-total-sub');
  if(subEl) subEl.textContent=isCurrentYear?'납품완료+PO잔여':(salesYear+'년 납품완료');

  var s=function(id,v){var el=document.getElementById(id);if(el)el.textContent=v;};
  s('grand-total-krw',fk(grandTotal));
  s('grand-k-krw',fk(grandKKrw));
  s('grand-b-krw',fk(grandBKrw));
  s('grand-b-usd',fu(grandBUsd));
  s('grand-cnt',grandCnt.toLocaleString()+'건');
}


function renderSalesDetail(){
  const all = getDelivered();
  const exrate = getExrate();
  let data = all.filter(r=>(r.deliveredDate||'').startsWith(String(salesYear)));
  if(!salesFilter.has('all')) data = data.filter(r=>salesFilter.has(r.ccn));

  const total = data.length, pages = Math.ceil(total/SALES_PER)||1;
  if(salesPage>pages) salesPage=1;
  const slice = data.slice((salesPage-1)*SALES_PER, salesPage*SALES_PER);

  document.getElementById('sales-detail-cnt').textContent = total+'건';
  document.getElementById('sales-pgn-info').textContent = `${salesPage}/${pages} (${total}건)`;
  document.getElementById('sl-prev').disabled = salesPage===1;
  document.getElementById('sl-next').disabled = salesPage===pages;

  if(!slice.length){
    document.getElementById('sales-detail-tbody').innerHTML='<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text3)">데이터 없음</td></tr>';
    return;
  }
  const getAmt = r => r.amount || ((r.unitPrice||0)*(r.qty||1));
  document.getElementById('sales-detail-tbody').innerHTML = slice.map(r=>{
    const isB = r.ccn==='B';
    const amt = getAmt(r);
    const krw = isB ? amt*exrate : amt;
    const srcBadge = r._source==='upload'
      ? `<span class="bd" style="background:#0a1a30;color:#4f7cff;font-size:9px;margin-left:3px">업로드</span>`
      : `<span class="bd" style="background:#0a2018;color:#34d399;font-size:9px;margin-left:3px">PO</span>`;
    return `<tr>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${fmtShortDate(r.deliveredDate)}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--accent)">${r.item||'—'}${srcBadge}</td>
      <td style="color:var(--text);max-width:150px;overflow:hidden;text-overflow:ellipsis">${r.desc||'—'}</td>
      <td><span class="bd ${isB?'bd-amber':'bd-red'}">${r.ccn||'—'}</span></td>
      <td style="text-align:right;font-family:var(--mono)">${(r.qty||0).toLocaleString()}</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--text3)">${isB?fmtUsd(r.unitPrice||0):(r.unitPrice||0)>0?(r.unitPrice||0).toLocaleString()+'원':'—'}</td>
      <td style="text-align:right;font-family:var(--mono);color:${isB?'var(--amber)':'var(--red)'}">${isB?fmtUsd(amt):amt>0?amt.toLocaleString()+'원':'—'}</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--green);font-weight:600">${krw>0?fmtKrw(krw):'—'}</td>
      <td style="font-family:var(--mono);font-size:10px;color:var(--text3)">${r.order||'—'}</td>
    </tr>`;
  }).join('');
}


function toggleSalesFilter(f){
  if(f==='all'){salesFilter.clear();salesFilter.add('all');}
  else{salesFilter.delete('all');salesFilter.has(f)?salesFilter.delete(f):salesFilter.add(f);if(!salesFilter.size)salesFilter.add('all');}
  ['all','B','K'].forEach(k=>{const el=document.getElementById('sl-'+k);if(el){el.classList.remove('on','default');if(salesFilter.has(k))el.classList.add('on','default');}});
  salesPage=1; renderSalesDetail();
}


function salesChgPage(d){ salesPage+=d; renderSalesDetail(); }


function fmtKrw(n){ if(!n||isNaN(n))return '—'; if(Math.abs(n)>=100000000) return (n/100000000).toFixed(1)+'억'; if(Math.abs(n)>=10000) return (n/10000).toFixed(0)+'만'; return n.toLocaleString(); }


function fmtUsd(n){ if(!n||isNaN(n))return '—'; return '$'+(n<1000?n.toFixed(2):n.toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:0})); }


function renderSalesChart(monthly){
  const el = document.getElementById('sales-chart');
  const hasDelivered = monthly.some(m=>m.bKrw>0||m.kKrw>0);
  const exrate = getExrate();

  // PO 잔여 월별 집계 (promise date 기준)
  const poData = (typeof PO !== 'undefined') ? PO : [];
  const poMonthly = monthly.map(m=>{
    const poRows = poData.filter(r=>(r.promise||'').startsWith(m.m));
    const getAmt = r=>r.extended_price||r.amount||(r.unit_price||0)*(r.qty||1)||0;
    const poBKrw = poRows.filter(r=>r.ccn==='B').reduce((s,r)=>s+getAmt(r),0)*exrate;
    const poKKrw = poRows.filter(r=>r.ccn==='K').reduce((s,r)=>s+getAmt(r),0);
    return {m:m.m, label:m.label, total:poBKrw+poKKrw, cnt:poRows.length};
  });
  const hasPO = poMonthly.some(m=>m.total>0);

  if(!hasDelivered && !hasPO){
    el.innerHTML='<div class="no-sales">데이터 없음</div>'; return;
  }

  const CHART_H=200, Y_LBL_W=58, BAR_AREA_W=46, BAR_W=10, BAR_GAP=2, BOTTOM_PAD=28, GRID_LINES=4;
  const maxVal=Math.max(...monthly.map(m=>Math.max(m.bKrw,m.kKrw,m.total)),...poMonthly.map(m=>m.total),1);
  const rawStep=maxVal/GRID_LINES, mag=Math.pow(10,Math.floor(Math.log10(rawStep)));
  const step=Math.ceil(rawStep/mag)*mag, yMax=step*GRID_LINES;
  const gridLabels=Array.from({length:GRID_LINES+1},(_,i)=>{
    const v=i*step; if(!v)return '0';
    if(v>=100000000)return (v/100000000).toFixed(1)+'억';
    if(v>=10000)return Math.round(v/10000)+'만'; return v.toLocaleString();
  });
  const totalW=Y_LBL_W+monthly.length*BAR_AREA_W+8;
  let svgBars='',svgMonthLabels='',svgGrid='';

  for(let i=0;i<=GRID_LINES;i++){
    const y=CHART_H-(i/GRID_LINES)*CHART_H;
    svgGrid+=`<line x1="${Y_LBL_W}" y1="${y}" x2="${totalW}" y2="${y}" stroke="#2e3448" stroke-width="${i===0?1.5:0.5}" stroke-dasharray="${i===0?'none':'4,3'}"/>`;
    svgGrid+=`<text x="${Y_LBL_W-6}" y="${y+4}" text-anchor="end" font-size="9" fill="#5a6180">${gridLabels[i]}</text>`;
  }

  monthly.forEach((m,i)=>{
    const x=Y_LBL_W+i*BAR_AREA_W+(BAR_AREA_W-BAR_W*3-BAR_GAP*2)/2;
    const cx=Y_LBL_W+i*BAR_AREA_W+BAR_AREA_W/2;
    svgMonthLabels+=`<text x="${cx}" y="${CHART_H+18}" text-anchor="middle" font-size="9" fill="#5a6180">${m.label}</text>`;

    const bH=m.bKrw>0?Math.max(2,(m.bKrw/yMax)*CHART_H):0;
    const kH=m.kKrw>0?Math.max(2,(m.kKrw/yMax)*CHART_H):0;
    const poH=poMonthly[i].total>0?Math.max(2,(poMonthly[i].total/yMax)*CHART_H):0;

    if(bH>0) svgBars+=`<rect x="${x}" y="${CHART_H-bH}" width="${BAR_W}" height="${bH}" rx="2" fill="#ffb547" opacity="0.9"><title>납품 CCN B ${m.label}: ${fmtKrw(m.bKrw)}</title></rect>`;
    if(kH>0) svgBars+=`<rect x="${x+BAR_W+BAR_GAP}" y="${CHART_H-kH}" width="${BAR_W}" height="${kH}" rx="2" fill="#ff5555" opacity="0.9"><title>납품 CCN K ${m.label}: ${fmtKrw(m.kKrw)}</title></rect>`;
    if(poH>0) svgBars+=`<rect x="${x+BAR_W*2+BAR_GAP*2}" y="${CHART_H-poH}" width="${BAR_W}" height="${poH}" rx="2" fill="#4f7cff" opacity="0.45"><title>PO잔여 ${m.label}: ${fmtKrw(poMonthly[i].total)} (${poMonthly[i].cnt}건)</title></rect>`;
  });

  el.innerHTML=`<div style="overflow-x:auto;padding-bottom:4px">
    <svg width="${Math.max(totalW,500)}" height="${CHART_H+BOTTOM_PAD+4}" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">
      <g transform="translate(0,4)">${svgGrid}${svgBars}${svgMonthLabels}</g>
    </svg></div>`;
}


function renderSalesTable(monthly, exrate){
  const active = monthly.filter(m=>m.bKrw>0||m.kKrw>0);
  document.getElementById('sales-tbl-cnt').textContent = active.length+'개월';
  const totB = monthly.reduce((s,m)=>s+m.bUsd,0);
  const totBK= totB*exrate;
  const totK = monthly.reduce((s,m)=>s+m.kKrw,0);
  const totT = totBK+totK;
  const totC = monthly.reduce((s,m)=>s+m.cnt,0);

  document.getElementById('sales-tbody').innerHTML = [
    ...monthly.filter(m=>m.cnt>0).map(m=>`<tr>
      <td>${m.label}</td>
      <td style="color:var(--text3);font-family:var(--font)">${salesYear}년 ${m.label}</td>
      <td style="color:var(--amber)">${m.bUsd>0?fmtUsd(m.bUsd):'—'}</td>
      <td style="color:var(--amber)">${m.bKrw>0?fmtKrw(m.bKrw):'—'}</td>
      <td style="color:var(--red)">${m.kKrw>0?fmtKrw(m.kKrw):'—'}</td>
      <td style="color:var(--green);font-weight:600">${m.total>0?fmtKrw(m.total):'—'}</td>
      <td style="color:var(--text3)">${m.cnt||'—'}</td>
    </tr>`),
    `<tr class="total-row">
      <td>합계</td>
      <td style="font-family:var(--font)">${salesYear}년 전체</td>
      <td style="color:var(--amber)">${fmtUsd(totB)}</td>
      <td style="color:var(--amber)">${fmtKrw(totBK)}</td>
      <td style="color:var(--red)">${fmtKrw(totK)}</td>
      <td style="color:var(--green)">${fmtKrw(totT)}</td>
      <td>${totC}</td>
    </tr>`
  ].join('');
}


function renderAgg() {
  var _aggEl = document.getElementById('agg-exrate');
  var exrate = _aggEl ? (parseFloat(_aggEl.value) || 1380) : 1380;
  var exEl = document.getElementById('agg-exrate-label');
  if(exEl) exEl.textContent = '1 USD = ' + exrate.toLocaleString() + '원';

  var recvAll = ld(K.RECV, []);
  // 입고완료 = recv_date 있는 것, 예상 = recv_date 없는 것
  var recvDone = recvAll.filter(function(r){ return r.recv_date && r.recv_date.trim() !== ''; });
  var recvPend = recvAll.filter(function(r){ return !r.recv_date || r.recv_date.trim() === ''; });
  var delivered = getDelivered();

  // 연도 목록 수집 (입고일 + 발주일 + 납품일 모두 포함)
  var yearSet = new Set();
  // 입고완료: recv_date 기준
  recvDone.forEach(function(r){ var y=(r.recv_date||'').substring(0,4); if(y.match(/^\d{4}$/)) yearSet.add(y); });
  // 미입고: order_date 기준
  recvPend.forEach(function(r){ var y=(r.order_date||r.req_date||'').substring(0,4); if(y.match(/^\d{4}$/)) yearSet.add(y); });
  // 매출: deliveredDate 기준
  delivered.forEach(function(r){ var y=(r.deliveredDate||'').substring(0,4); if(y.match(/^\d{4}$/)) yearSet.add(y); });
  // 연도가 하나도 없으면 현재 연도 추가
  if(!yearSet.size) yearSet.add(String(new Date().getFullYear()));
  var years = Array.from(yearSet).sort(function(a,b){return b-a;});
  if(!years.length) years = [String(aggYear)];
  if(!years.includes(String(aggYear))) aggYear = parseInt(years[0]);

  // 연도 탭
  var ytEl = document.getElementById('agg-year-tabs');
  if(ytEl) ytEl.innerHTML = years.map(function(y){
    var active = y == aggYear;
    return '<button onclick="setAggYear('+y+')" style="padding:5px 14px;border-radius:6px;border:1px solid '+(active?'var(--accent)':'var(--border)')+';background:'+(active?'var(--accent)':'var(--bg3)')+';color:'+(active?'#fff':'var(--text3)')+';font-size:12px;cursor:pointer;font-family:var(--font)">'+y+'년</button>';
  }).join('');

  // 연도 필터 (입고일/발주일 기준)
  var yrDone = recvDone.filter(function(r){ return (r.recv_date||'').startsWith(String(aggYear)); });
  var yrPend = recvPend.filter(function(r){ return ((r.req_date||r.order_date||'')).startsWith(String(aggYear)); });
  var yrDeli = delivered.filter(function(r){ return (r.deliveredDate||'').startsWith(String(aggYear)); });

  // 월별 집계
  var months = [];
  for(var mn=1;mn<=12;mn++){
    var mStr = String(aggYear) + '-' + String(mn).padStart(2,'0');
    var mDone = yrDone.filter(function(r){ return (r.recv_date||'').startsWith(mStr); });
    var mPend = yrPend.filter(function(r){ return ((r.req_date||r.order_date||'')).startsWith(mStr); });
    var mDeli = yrDeli.filter(function(r){ return (r.deliveredDate||'').startsWith(mStr); });
    var doneAmt = mDone.reduce(function(s,r){ return s+(parseFloat(r.total)||0); },0);
    var pendAmt = mPend.reduce(function(s,r){ return s+(parseFloat(r.total)||0); },0);
    var bRows = mDeli.filter(function(r){ return r.ccn==='B'; });
    var kRows = mDeli.filter(function(r){ return r.ccn==='K'; });
    var getAmt = function(r){ return r.amount||((r.unitPrice||0)*(r.qty||1)); };
    var bUsd = bRows.reduce(function(s,r){ return s+getAmt(r); },0);
    var kKrw = kRows.reduce(function(s,r){ return s+getAmt(r); },0);
    months.push({
      m: mStr, label: mn+'월',
      doneAmt: doneAmt, doneCnt: mDone.length,
      pendAmt: pendAmt, pendCnt: mPend.length,
      bUsd: bUsd, bKrw: bUsd*exrate, kKrw: kKrw,
      salesTotal: bUsd*exrate+kKrw, salesCnt: mDeli.length
    });
  }

  // 포맷 함수
  var fk = function(n){ if(!n||isNaN(n))return '—'; if(Math.abs(n)>=100000000) return (n/100000000).toFixed(1)+'억'; if(Math.abs(n)>=10000) return Math.round(n/10000)+'만'; return n.toLocaleString(); };
  var fu = function(n){ if(!n||isNaN(n))return '—'; return '$'+(n>=1000?n.toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:0}):n.toFixed(0)); };

  // 요약 카드
  var totDone  = months.reduce(function(s,m){ return s+m.doneAmt; },0);
  var totPend  = months.reduce(function(s,m){ return s+m.pendAmt; },0);
  var totBUsd  = months.reduce(function(s,m){ return s+m.bUsd; },0);
  var totBKrw  = totBUsd*exrate;
  var totKKrw  = months.reduce(function(s,m){ return s+m.kKrw; },0);
  var totSales = totBKrw+totKKrw;

  document.getElementById('agg-total-recv').textContent      = fk(totDone);
  document.getElementById('agg-total-recv-pend').textContent = fk(totPend);
  var raEl = document.getElementById('agg-total-recv-all'); if(raEl) raEl.textContent = fk(totDone+totPend);
  document.getElementById('agg-total-b').textContent         = fk(totBKrw);
  document.getElementById('agg-total-b-usd').textContent     = fu(totBUsd)+' (USD)';
  document.getElementById('agg-total-k').textContent         = fk(totKKrw);
  document.getElementById('agg-total-sales').textContent     = fk(totSales);

  renderAggChart('agg-recv-chart', months, 'recv', exrate);
  renderAggChart('agg-sales-chart', months, 'sales', exrate);
  renderAggTable(months, fk, fu);
}


function setAggYear(y){ aggYear=y; renderAgg(); }


function renderAggChart(elId, months, type, exrate) {
  exrate = exrate || 1380;
  var el = document.getElementById(elId);
  if(!el) return;
  var hasData = months.some(function(m){ return type==='recv'?(m.doneAmt>0||m.pendAmt>0):m.salesTotal>0; });
  if(!hasData){ el.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3)">데이터 없음</div>'; return; }

  var CHART_H=160, Y_W=58, BAR_W=type==='recv'?20:14, BAR_GAP=4, AREA_W=46, BOT=24, GRID=4;
  var maxVal = Math.max.apply(null, months.map(function(m){
    return type==='recv' ? Math.max(m.doneAmt, m.pendAmt, m.doneAmt+m.pendAmt) : Math.max(m.bKrw, m.kKrw, m.salesTotal);
  }).concat([1]));
  var rawStep=maxVal/GRID, mag=Math.pow(10,Math.floor(Math.log10(rawStep)));
  var step=Math.ceil(rawStep/mag)*mag, yMax=step*GRID;
  var gridLabels=[];
  for(var i=0;i<=GRID;i++){
    var v=i*step;
    gridLabels.push(v===0?'0':v>=100000000?(v/100000000).toFixed(1)+'억':v>=10000?Math.round(v/10000)+'만':v.toLocaleString());
  }
  var totalW = Y_W + months.length*AREA_W + 8;
  var bars='', xlabels='', grid='';
  for(var i2=0;i2<=GRID;i2++){
    var y2=CHART_H-(i2/GRID)*CHART_H;
    grid+='<line x1="'+Y_W+'" y1="'+y2+'" x2="'+totalW+'" y2="'+y2+'" stroke="#2e3448" stroke-width="'+(i2===0?1.5:0.5)+'" stroke-dasharray="'+(i2===0?'none':'4,3')+'"/>';
    grid+='<text x="'+(Y_W-6)+'" y="'+(y2+4)+'" text-anchor="end" font-size="9" fill="#5a6180">'+gridLabels[i2]+'</text>';
  }
  months.forEach(function(m,i){
    var cx=Y_W+i*AREA_W+AREA_W/2;
    xlabels+='<text x="'+cx+'" y="'+(CHART_H+18)+'" text-anchor="middle" font-size="9" fill="#5a6180">'+m.label+'</text>';
    if(type==='recv'){
      var dH=m.doneAmt>0?Math.max(2,(m.doneAmt/yMax)*CHART_H):0;
      var pH=m.pendAmt>0?Math.max(2,(m.pendAmt/yMax)*CHART_H):0;
      var xd=Y_W+i*AREA_W+(AREA_W-BAR_W*2-BAR_GAP)/2;
      if(dH>0) bars+='<rect x="'+xd+'" y="'+(CHART_H-dH)+'" width="'+BAR_W+'" height="'+dH+'" rx="2" fill="#4f7cff" opacity="0.9"><title>'+m.label+' 실제매입: '+m.doneAmt.toLocaleString()+'원 ('+m.doneCnt+'건)</title></rect>';
      if(pH>0) bars+='<rect x="'+(xd+BAR_W+BAR_GAP)+'" y="'+(CHART_H-pH)+'" width="'+BAR_W+'" height="'+pH+'" rx="2" fill="#a78bfa" opacity="0.85"><title>'+m.label+' 예상매입: '+m.pendAmt.toLocaleString()+'원 ('+m.pendCnt+'건)</title></rect>';
    } else {
      var bH=m.bKrw>0?Math.max(2,(m.bKrw/yMax)*CHART_H):0;
      var kH=m.kKrw>0?Math.max(2,(m.kKrw/yMax)*CHART_H):0;
      var xb=Y_W+i*AREA_W+(AREA_W-BAR_W*2-BAR_GAP)/2;
      if(bH>0) bars+='<rect x="'+xb+'" y="'+(CHART_H-bH)+'" width="'+BAR_W+'" height="'+bH+'" rx="2" fill="#ffb547" opacity="0.9"><title>CCN B '+m.label+': '+m.bKrw.toLocaleString()+'원</title></rect>';
      if(kH>0) bars+='<rect x="'+(xb+BAR_W+BAR_GAP)+'" y="'+(CHART_H-kH)+'" width="'+BAR_W+'" height="'+kH+'" rx="2" fill="#ff5555" opacity="0.9"><title>CCN K '+m.label+': '+m.kKrw.toLocaleString()+'원</title></rect>';
    }
  });
  el.innerHTML='<div style="overflow-x:auto"><svg width="'+Math.max(totalW,500)+'" height="'+(CHART_H+BOT+4)+'" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible"><g transform="translate(0,4)">'+grid+bars+xlabels+'</g></svg></div>';
}


function renderAggTable(months, fk, fu) {
  var active = months.filter(function(m){ return m.recvCnt>0||m.salesCnt>0; });
  document.getElementById('agg-tbl-cnt').textContent = active.length+'개월';
  var totR=0,totP=0,totBU=0,totBK=0,totK=0,totS=0,totRC=0,totSC=0;
  months.forEach(function(m){ totR+=m.doneAmt; totP+=m.pendAmt; totBU+=m.bUsd; totBK+=m.bKrw; totK+=m.kKrw; totS+=m.salesTotal; totRC+=m.doneCnt; totSC+=m.salesCnt; });
  var rows = months.filter(function(m){ return m.recvCnt>0||m.salesCnt>0; }).map(function(m){
    return '<tr>'+
      '<td>'+m.label+'</td>'+
      '<td style="text-align:right;font-family:var(--mono);color:var(--accent)">'+(m.doneAmt>0?fk(m.doneAmt):'—')+'</td>'+
      '<td style="text-align:right;font-family:var(--mono);color:var(--purple)">'+(m.pendAmt>0?fk(m.pendAmt):'—')+'</td>'+
      '<td style="text-align:right;font-family:var(--mono);color:var(--amber)">'+(m.bUsd>0?fu(m.bUsd):'—')+'</td>'+
      '<td style="text-align:right;font-family:var(--mono);color:var(--amber)">'+(m.bKrw>0?fk(m.bKrw):'—')+'</td>'+
      '<td style="text-align:right;font-family:var(--mono);color:var(--red)">'+(m.kKrw>0?fk(m.kKrw):'—')+'</td>'+
      '<td style="text-align:right;font-family:var(--mono);color:var(--green);font-weight:600">'+(m.salesTotal>0?fk(m.salesTotal):'—')+'</td>'+
      '<td style="text-align:right;color:var(--text3)">'+(m.doneCnt||'—')+'</td>'+
      '<td style="text-align:right;color:var(--text3)">'+(m.salesCnt||'—')+'</td>'+
    '</tr>';
  });
  rows.push('<tr class="total-row">'+
    '<td>합계</td>'+
    '<td style="text-align:right;font-family:var(--mono);color:var(--accent)">'+fk(totR)+'</td>'+
    '<td style="text-align:right;font-family:var(--mono);color:var(--purple)">'+fk(totP)+'</td>'+
    '<td style="text-align:right;font-family:var(--mono);color:var(--amber)">'+fu(totBU)+'</td>'+
    '<td style="text-align:right;font-family:var(--mono);color:var(--amber)">'+fk(totBK)+'</td>'+
    '<td style="text-align:right;font-family:var(--mono);color:var(--red)">'+fk(totK)+'</td>'+
    '<td style="text-align:right;font-family:var(--mono);color:var(--green);font-weight:700">'+fk(totS)+'</td>'+
    '<td style="text-align:right">'+totRC+'</td>'+
    '<td style="text-align:right">'+totSC+'</td>'+
  '</tr>');
  document.getElementById('agg-tbody').innerHTML = rows.join('');
}


function renderAggIfOpen(){
  var sa = document.getElementById('sect-agg');
  if(sa && sa.style.display !== 'none') renderAgg();
}


function setRdashYear(y){ rdashYear=y; renderRecvDash(); }


function addToReq2(pn){
  var r=DB.find(function(x){return x.pn===pn;})||{pn:pn};
  if(reqItems2.find(function(x){return x.pn===pn;})){alert(pn+'은 이미 요청 목록에 있습니다');return;}
  reqItems2.push({pn:pn,d:r.d||'',qty:1,unit:'EA',note:''});
  switchApp('srch'); srchTab('req');
  renderReqPanel2();
}


function renderReqPanel2(){
  var tbody=document.getElementById('req-tbody-2');
  if(!tbody) return;
  tbody.innerHTML=reqItems2.length
    ? reqItems2.map(function(r,i){return '<tr><td style="font-family:var(--mono);font-size:11px;color:var(--tel)">'+r.pn+'</td><td style="font-size:12px">'+( r.d||'—')+'</td><td><input type="number" min="1" value="'+r.qty+'" style="width:60px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:3px 6px;color:var(--text)" onchange="reqItems2['+i+'].qty=+this.value"></td><td>'+r.unit+'</td><td><input type="text" placeholder="비고" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:3px 6px;color:var(--text);font-size:12px" onchange="reqItems2['+i+'].note=this.value"></td><td><button class="btn br-btn sm" style="padding:2px 7px" onclick="reqItems2.splice('+i+',1);renderReqPanel2()">✕</button></td></tr>';}).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:16px;font-size:12px">품번조회 탭에서 + 불출요청 버튼을 눌러 추가하세요</td></tr>';
}


function clearReq2(){
  if(!confirm('요청 목록을 초기화하시겠습니까?')) return;
  reqItems2=[];renderReqPanel2();
}


function submitReq2(){
  if(!reqItems2.length){alert('요청 품목이 없습니다');return;}
  var dt=document.getElementById('req-dt-2')?.value;
  var dest=document.getElementById('req-dest-2')?.value.trim();
  var rec=document.getElementById('req-rec-2')?.value.trim()||'';
  var pur=document.getElementById('req-pur-2')?.value||'자재불출';
  if(!dt||!dest){alert('요청일과 출고처를 입력하세요');return;}
  reqItems2.forEach(function(r){
    var dbr=DB.find(function(x){return x.pn===r.pn;})||{};
    OUT.unshift({date:dt,pn:r.pn,mfg_pn:dbr.mp||'',qty:r.qty,unit:r.unit,purpose:pur,dest:dest,receiver:rec,note:'[불출요청]'+(r.note||''),_added:new Date().toLocaleString('ko-KR')});
  });
  sv(K.OUT,OUT);
  var cnt=reqItems2.length;
  reqItems2=[];renderReqPanel2();
  updateStat();
  oF=new Set(['all']);
  alert('✅ '+cnt+'건 불출 요청 등록됨. 구매관리 → 자재불출 탭에서 확인하세요.');
}


function doSrchBOM(){
  var pn=document.getElementById('bom-srch-pn')?.value.trim();
  var el=document.getElementById('bom-srch-results');
  if(!pn||!el){alert('품번을 입력하세요');return;}
  var bom=BOM[pn];
  if(!bom||!bom.length){el.innerHTML='<div style="text-align:center;padding:30px;color:var(--text3)">BOM 데이터가 없습니다 (품번: '+pn+')</div>';return;}
  el.innerHTML='<div class="tw"><div class="th-row"><div class="th-title">BOM — '+pn+'</div><div class="th-count">'+bom.length+'개 부품</div></div><div class="tbl-scroll"><table><thead><tr><th>품번</th><th>품명</th><th>수량</th><th>단위</th><th>비고</th></tr></thead><tbody>'+bom.map(function(b){return '<tr><td style="font-family:var(--mono);font-size:11px;color:var(--tel)">'+b.cpn+'</td><td>'+( b.cdesc||'—')+'</td><td style="text-align:right">'+( b.qty||1)+'</td><td>'+(b.unit||'EA')+'</td><td style="font-size:11px;color:var(--text3)">'+( b.note||'—')+'</td></tr>';}).join('')+'</tbody></table></div></div>';
}


function getItemGroup(item){
  var s = String(item||'').trim();
  if(/^11[0-9]/.test(s)) return '110*';
  if(/^16[0-9]/.test(s)) return '16*';
  if(/^17[0-9]/.test(s)) return '17*';
  if(/^51[0-9]/.test(s)) return '51*';
  if(/^54[0-9]/.test(s)) return '54*';
  if(/^19[0-9]/.test(s)) return '19*';
  if(/^12[0-9]/.test(s)) return '12*';
  return '기타';
}


function renderItemGroupChart(){
  var el = document.getElementById('item-group-chart');
  var legendEl = document.getElementById('item-group-legend');
  if(!el) return;

  var src = (document.getElementById('item-group-src')||{value:'delivered'}).value;
  var months = Array.from({length:12}, function(_,i){
    return String(salesYear)+'-'+String(i+1).padStart(2,'0');
  });

  // 데이터 소스
  var rows = [];
  if(src === 'po'){
    rows = (typeof PO !== 'undefined' ? PO : []).map(function(r){
      return {item: r.item, month: (r.promise||'').substring(0,7), qty: r.qty||1};
    });
  } else {
    rows = getDelivered().filter(function(r){
      return (r.deliveredDate||'').startsWith(String(salesYear));
    }).map(function(r){
      return {item: r.item, month: (r.deliveredDate||'').substring(0,7), qty: r.qty||1};
    });
  }

  // 품목군 집계
  var groupSet = {};
  rows.forEach(function(r){
    var g = getItemGroup(r.item);
    var m = r.month;
    if(!groupSet[g]) groupSet[g] = {};
    if(!groupSet[g][m]) groupSet[g][m] = 0;
    groupSet[g][m] += r.qty||1;
  });

  var groups = Object.keys(groupSet).sort(function(a,b){
    var ta = Object.values(groupSet[a]).reduce(function(s,v){return s+v;},0);
    var tb = Object.values(groupSet[b]).reduce(function(s,v){return s+v;},0);
    return tb-ta;
  });

  if(!groups.length){
    el.innerHTML='<div class="no-sales">데이터를 업로드하면 표시됩니다</div>';
    if(legendEl) legendEl.innerHTML='';
    return;
  }

  // SVG 바 차트 (그룹 × 월)
  var CHART_H=140, Y_LBL_W=44, AREA_W=44, BOT=22, GRID=4;
  var maxVal=1;
  months.forEach(function(m){
    var sum=groups.reduce(function(s,g){return s+(groupSet[g][m]||0);},0);
    if(sum>maxVal) maxVal=sum;
  });
  var step=Math.ceil(maxVal/GRID), yMax=step*GRID;
  var totalW=Y_LBL_W+months.length*AREA_W+8;
  var barW=Math.max(3,Math.floor((AREA_W-2)/(groups.length||1)));
  var svgG='',svgB='',svgL='';

  for(var gi=0;gi<=GRID;gi++){
    var y=CHART_H-(gi/GRID)*CHART_H;
    svgG+='<line x1="'+Y_LBL_W+'" y1="'+y+'" x2="'+totalW+'" y2="'+y+'" stroke="#2e3448" stroke-width="'+(gi===0?1.5:0.5)+'" stroke-dasharray="'+(gi===0?'none':'4,3')+'"/>';
    svgG+='<text x="'+(Y_LBL_W-4)+'" y="'+(y+4)+'" text-anchor="end" font-size="9" fill="#5a6180">'+(gi*step)+'</text>';
  }

  months.forEach(function(m,mi){
    var cx=Y_LBL_W+mi*AREA_W+AREA_W/2;
    svgL+='<text x="'+cx+'" y="'+(CHART_H+16)+'" text-anchor="middle" font-size="9" fill="#5a6180">'+(mi+1)+'월</text>';
    var stackY=CHART_H;
    groups.forEach(function(g,gi){
      var cnt=groupSet[g][m]||0;
      if(!cnt) return;
      var h=Math.max(2,(cnt/yMax)*CHART_H);
      stackY-=h;
      var color=ITEM_GROUP_COLORS[gi%ITEM_GROUP_COLORS.length];
      svgB+='<rect x="'+(Y_LBL_W+mi*AREA_W+4)+'" y="'+stackY+'" width="'+(AREA_W-8)+'" height="'+h+'" fill="'+color+'" opacity="0.85"><title>'+g+' '+m.substring(5)+'월: '+cnt+'건</title></rect>';
    });
  });

  el.innerHTML='<div style="overflow-x:auto"><svg width="'+Math.max(totalW,500)+'" height="'+(CHART_H+BOT+4)+'" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible"><g transform="translate(0,4)">'+svgG+svgB+svgL+'</g></svg></div>';

  // 범례
  if(legendEl){
    legendEl.innerHTML=groups.map(function(g,i){
      var total=Object.values(groupSet[g]).reduce(function(s,v){return s+v;},0);
      var color=ITEM_GROUP_COLORS[i%ITEM_GROUP_COLORS.length];
      return '<span style="display:flex;align-items:center;gap:4px;padding:2px 8px;background:var(--bg3);border-radius:4px;border:1px solid var(--border)">'+
        '<span style="width:10px;height:10px;border-radius:2px;background:'+color+';display:inline-block"></span>'+
        '<span>'+g+'</span><span style="color:var(--text3)">'+total+'건</span></span>';
    }).join('');
  }
}


function lookupBOM(){
  var pn = (document.getElementById('bom-lookup-pn')||{value:''}).value.trim();
  if(!pn){ alert('상위품번을 입력하세요'); return; }
  showBOM(pn);
  // bom-results 가 srch-panel-bom 안에 있으므로 자동 표시
}


function lookupWhere(){
  var pn=(document.getElementById('where-pn')||{value:''}).value.trim();
  if(!pn){ alert('품번을 입력하세요'); return; }
  renderWhereUsed(pn);
}


function renderWhereUsed(childPN){
  var el=document.getElementById('where-results');
  if(!el) return;
  if(!BOM||!Object.keys(BOM).length){
    el.innerHTML='<div style="color:var(--amber);padding:20px;text-align:center">BOM 데이터가 없습니다. 로그인 후 데이터를 로드하세요.</div>';
    return;
  }

  var pn=String(childPN).trim();
  var raw=[];
  Object.keys(BOM).forEach(function(parentPN){
    (BOM[parentPN]||[]).forEach(function(child){
      if(String(child.pn||child.child_pn||'').trim()===pn){
        raw.push({parentPN:parentPN, qty:+(child.qty||child.aqty||0), lv:child.lv||1, no:child.no||'', isAlt:child.isAlt||false});
      }
    });
  });

  var dbItem=(typeof DB!=='undefined')?DB.find(function(r){return String(r.pn).trim()===pn;}):null;

  if(!raw.length){
    el.innerHTML='<div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:28px;text-align:center;color:var(--text3)">'
      +'<div style="font-size:22px;margin-bottom:8px">🔍</div>'
      +'<div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:4px">사용처 없음</div>'
      +'<div style="font-size:12px">품번 <span style="font-family:var(--mono);color:var(--tel)">'+pn+'</span>을 사용하는 상위 ASSY가 없습니다</div>'
      +'</div>';
    return;
  }

  // ── 상위품번 기준 그룹핑 (합계 수량) ──
  var groupMap={};
  raw.forEach(function(r){
    if(!groupMap[r.parentPN]){
      var pi=(typeof DB!=='undefined')?DB.find(function(d){return String(d.pn).trim()===r.parentPN;}):null;
      groupMap[r.parentPN]={parentPN:r.parentPN, totalQty:0, rows:[], desc:pi?pi.d:'', mfg:pi?pi.mg:''};
    }
    groupMap[r.parentPN].totalQty+=r.qty;
    groupMap[r.parentPN].rows.push(r);
  });
  var groups=Object.values(groupMap).sort(function(a,b){return a.parentPN.localeCompare(b.parentPN);});
  var grandTotal=groups.reduce(function(s,g){return s+g.totalQty;},0);

  // ── 헤더 ──
  var html='<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden">'
    +'<div style="background:var(--bg3);border-bottom:1px solid var(--border2);padding:11px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">'
      +'<span style="font-family:var(--mono);font-size:14px;font-weight:700;color:var(--tel)">'+pn+'</span>'
      +(dbItem?'<span style="font-size:13px;color:var(--text)">'+dbItem.d+'</span>':'')
      +(dbItem&&dbItem.mg?'<span style="font-size:11px;color:var(--text3)">'+dbItem.mg+'</span>':'')
      +'<div style="margin-left:auto;display:flex;gap:16px;font-size:12px">'
        +'<span style="color:var(--text2)">사용 ASSY: <b style="color:var(--tel)">'+groups.length+'개</b></span>'
        +'<span style="color:var(--text2)">총 합계수량: <b style="color:var(--tel)">'+grandTotal+'</b></span>'
      +'</div>'
    // ── 테이블 (품명 좁힘, 수량 소수점 2자리) ──
    +'<table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed">'
    +'<colgroup><col style="width:140px"><col style="width:220px"><col style="width:100px"><col style="width:80px"><col style="width:72px"></colgroup>'
    +'<thead><tr style="background:var(--bg3);border-bottom:1px solid var(--border2)">'
      +'<th style="padding:7px 14px;text-align:left;font-size:10.5px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;white-space:nowrap">상위품번 (ASSY)</th>'
      +'<th style="padding:7px 12px;text-align:left;font-size:10.5px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px">품명</th>'
      +'<th style="padding:7px 14px;text-align:right;font-size:10.5px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px">합계 수량</th>'
      +'<th style="padding:7px 12px;text-align:center;font-size:10.5px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px">BOM</th>'
      +'<th style="padding:7px 12px;text-align:center;font-size:10.5px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px">상세</th>'
    +'</tr></thead>'
    +'<tbody id="where-tbody">';

  groups.forEach(function(g,gi){
    var multiRow=g.rows.length>1;
    var detailId='wu-det-'+gi;
    var totQtyDisp=parseFloat(parseFloat(g.totalQty).toFixed(2));
    // ── 요약 행 ──
    html+='<tr style="border-bottom:1px solid var(--border)">'
      +'<td style="padding:9px 14px;font-family:var(--mono);font-size:12px;font-weight:700;color:var(--tel);white-space:nowrap">'+g.parentPN+'</td>'
      +'<td style="padding:9px 12px;font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+g.desc+'">'+g.desc+'</td>'
      +'<td style="padding:9px 14px;text-align:right;font-family:var(--mono);font-size:14px;font-weight:700;color:var(--text)">'+totQtyDisp+'</td>'
      +'<td style="padding:9px 12px;text-align:center">'
        +'<button onclick="srchTab(\'bom\');document.getElementById(\'bom-lookup-pn\').value=\''+g.parentPN+'\';lookupBOM()" '
          +'style="background:none;border:1px solid var(--tel);border-radius:5px;padding:3px 10px;color:var(--tel);font-size:11px;cursor:pointer;font-weight:600">조회</button>'
      +'</td>'
      +'<td style="padding:9px 12px;text-align:center">'
        +(multiRow
          ? '<button onclick="wuToggle(\''+detailId+'\')" id="wubtn-'+gi+'" '
              +'style="background:none;border:1px solid var(--border2);border-radius:5px;padding:3px 10px;color:var(--text2);font-size:11px;cursor:pointer;min-width:44px">▼ '+g.rows.length+'</button>'
          : '<span style="font-size:11px;color:var(--text3)">—</span>')
      +'</td>'
    +'</tr>';
    // ── 세부 행 (기본 숨김, multiRow만) ──
    if(multiRow){
      html+='<tr id="'+detailId+'" style="display:none"><td colspan="5" style="padding:0;background:rgba(45,212,191,.04);border-bottom:2px solid var(--border2)">'
        +'<table style="width:100%;border-collapse:collapse;font-size:11.5px;table-layout:fixed">'
        +'<colgroup><col style="width:100px"><col style="width:44px"><col><col style="width:90px"><col style="width:70px"></colgroup>'
        +'<thead></thead><tbody>'
        +g.rows.map(function(r){
          var qDisp=parseFloat(parseFloat(r.qty).toFixed(2));
          return '<tr style="border-top:1px solid rgba(45,212,191,.1)">'
            +'<td style="padding:5px 14px;font-family:var(--mono);font-size:11px;color:var(--text3)">'+(r.no||'—')+'</td>'
            +'<td style="padding:5px 8px;text-align:center"><span style="background:rgba(45,212,191,.15);color:var(--tel);border-radius:3px;padding:1px 6px;font-size:10px;font-weight:700;font-family:var(--mono)">'+r.lv+'</span></td>'
            +'<td style="padding:5px 8px;color:var(--text2);font-size:11px;font-family:var(--mono)">'+pn+'</td>'
            +'<td style="padding:5px 14px;text-align:right;font-family:var(--mono);font-size:13px;font-weight:700;color:var(--text)">'+qDisp+'</td>'
            +'<td style="padding:5px 10px;text-align:center">'+(r.isAlt?'<span style="font-size:10px;background:rgba(255,181,71,.18);color:var(--amber);border-radius:3px;padding:1px 6px;font-weight:700">대체</span>':'')+'</td>'
            +'</tr>';
        }).join('')
        +'</tbody></table></td></tr>';
    }
  });

  html+='</tbody></table></div>';
  el.innerHTML=html;
}


function wuToggle(id){
  var row=document.getElementById(id);
  if(!row) return;
  var gi=id.replace('wu-det-','');
  var btn=document.getElementById('wubtn-'+gi);
  var open=row.style.display==='none'||row.style.display==='';
  row.style.display=open?'table-row':'none';
  if(btn){
    var cnt=btn.textContent.replace(/[▼▲ ]/g,'').trim();
    btn.textContent=(open?'▲ ':'▼ ')+cnt;
    btn.style.color=open?'var(--tel)':'var(--text2)';
    btn.style.borderColor=open?'var(--tel)':'var(--border2)';
  }
}


function setOtrPeriod(v){
  otrPeriod = v;
  ['month','quarter','half','year'].forEach(function(k){
    var el = document.getElementById('otrp-'+k);
    if(el){ el.classList.toggle('on', k===v); el.classList.toggle('default', k===v); }
  });
  renderOrdTrend();
}


function setOtrData(v){
  otrData = v;
  ['po','delivered','both'].forEach(function(k){
    var el = document.getElementById('otrd-'+k);
    if(el){ el.classList.toggle('on', k===v); el.classList.toggle('default', k===v); }
  });
  renderOrdTrend();
}


function setOtrShow(v){
  otrShow = v;
  ['qty','amt'].forEach(function(k){
    var el = document.getElementById('otrs-'+k);
    if(el){ el.classList.toggle('on', k===v); el.classList.toggle('default', k===v); }
  });
  renderOrdTrend();
}


function getPeriodKey(dateStr){
  if(!dateStr || dateStr.length < 7) return null;
  var y = dateStr.substring(0,4);
  var m = parseInt(dateStr.substring(5,7));
  if(otrPeriod === 'month')   return y + '-' + String(m).padStart(2,'0');
  if(otrPeriod === 'quarter') return y + '-Q' + Math.ceil(m/3);
  if(otrPeriod === 'half')    return y + '-H' + (m <= 6 ? 1 : 2);
  if(otrPeriod === 'year')    return y;
  return y + '-' + String(m).padStart(2,'0');
}


function showOtrSafety(pn){
  var banner = document.getElementById('otr-safety-banner');
  var content = document.getElementById('otr-safety-content');
  if(!banner || !content) return;

  var itemMap = {};
  var rows = [];

  if(otrData === 'po' || otrData === 'both'){
    (typeof PO !== 'undefined' ? PO : []).forEach(function(r){
      var dk = getPeriodKey(r.promise||r.placed||'');
      var rpn = r.item || r.pn || '';
      if(!dk || rpn !== pn) return;
      rows.push({qty:r.qty||0, period:dk});
    });
  }
  if(otrData === 'delivered' || otrData === 'both'){
    getDelivered().filter(function(r){return r.item===pn;}).forEach(function(r){
      var dk = getPeriodKey(r.deliveredDate||'');
      if(!dk) return;
      rows.push({qty:r.qty||0, period:dk});
    });
  }

  var periodSet = {};
  rows.forEach(function(r){ periodSet[r.period] = (periodSet[r.period]||0) + r.qty; });
  var periods = Object.keys(periodSet).sort();
  var totalQty = Object.values(periodSet).reduce(function(s,v){return s+v;},0);
  var avgPerPeriod = periods.length > 0 ? totalQty / periods.length : 0;
  var maxQty = periods.length > 0 ? Math.max.apply(null, Object.values(periodSet)) : 0;

  var dbItem = DB.find(function(x){return x.pn===pn;})||{};
  var lt = dbItem.lt || 0;
  var safetyStock = Math.ceil(avgPerPeriod * (lt/4.3 + 1));

  var periodLabel = {month:'월', quarter:'분기', half:'반기', year:'년'}[otrPeriod]||'기간';

  content.innerHTML = [
    {label:'품번', val:pn, color:'var(--accent)'},
    {label:'품명', val:dbItem.d||'—', color:'var(--text)'},
    {label:'LT (주)', val: lt>0 ? lt+'주' : '미입력', color: lt>0?'var(--text)':'var(--red)'},
    {label:'집계 기간 수', val:periods.length+periodLabel, color:'var(--text)'},
    {label:'총 발주수량', val:totalQty.toLocaleString(), color:'var(--amber)'},
    {label:'평균/'+periodLabel, val:avgPerPeriod.toFixed(1), color:'var(--teal)'},
    {label:'최대 발주량', val:maxQty.toLocaleString(), color:'var(--purple)'},
    {label:'✅ 권장 안전재고', val:safetyStock>0?safetyStock.toLocaleString():'LT 필요', color:'var(--green)', bold:true},
  ].map(function(c){
    return '<div style="background:var(--bg3);border-radius:7px;padding:10px 14px;border:1px solid var(--border)">'
      + '<div style="font-size:10px;color:var(--text3);margin-bottom:4px">'+c.label+'</div>'
      + '<div style="font-size:'+(c.bold?'18':'15')+'px;font-weight:'+(c.bold?'800':'600')+';color:'+c.color+';font-family:var(--mono)">'+c.val+'</div>'
      + '</div>';
  }).join('');

  banner.style.display = 'block';
  banner.scrollIntoView({behavior:'smooth', block:'nearest'});
}


function exportOtrCSV(){
  var table = document.getElementById('otr-table');
  if(!table) return;
  var rows = Array.from(table.querySelectorAll('tr'));
  var csv = '﻿' + rows.map(function(r){
    return Array.from(r.querySelectorAll('th,td')).map(function(c){ return '"'+c.innerText.replace(/"/g,'""')+'"'; }).join(',');
  }).join('\n');
  var a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = '발주추이_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}


function updateTrackFromDelivered(deliveredRows, dateStr) {
  var track = getTrack();
  deliveredRows.filter(function(r){ return r.ccn === 'B'; }).forEach(function(r) {
    var pn  = r.item || r.pn || '';
    var ord = r.order || '';
    if(!pn) return;
    var key = pn + '|' + ord;
    if(!track[key]) track[key] = {item: pn, desc: r.desc||'', order: ord, history: []};
    var last = track[key].history[0];
    // trackNum 또는 날짜가 변경된 경우 이력 추가
    if(!last || last.trackNum !== (r.trackNum||'') || last.deliveredDate !== (r.deliveredDate||'')) {
      track[key].history.unshift({
        date:          dateStr,
        trackNum:      r.trackNum || '',
        trackRaw:      r.note || r.trackNum || '',
        chuldo:        r.chuldo || '',
        promise:       r.deliveredDate || '',
        deliveredDate: r.deliveredDate || ''
      });
    }
    track[key].desc = r.desc || track[key].desc;
  });
  saveTrack(track);
}


function ldTodo(){ try{ return JSON.parse(localStorage.getItem(K_TODO)||'[]'); }catch{ return []; } }


function svTodo(d){
  localStorage.setItem(K_TODO, JSON.stringify(d));
  if(CURRENT_TOKEN) {
    apiPost({action:'setSheet', sheet:'todo_items', data:d}).catch(function(){});
  }
}


function openTodoModal(id){
  todoEditId = id || null;
  document.getElementById('todo-modal-title').textContent = id ? '수정' : '추가';
  if(id){
    var item = ldTodo().find(function(t){ return t.id===id; });
    if(item){
      document.getElementById('todo-title').value = item.title||'';
      document.getElementById('todo-recv').value = item.recv||'';
      document.getElementById('todo-due').value = item.due||'';
      document.getElementById('todo-priority').value = item.priority||'mid';
      document.getElementById('todo-status').value = item.status||'todo';
      document.getElementById('todo-memo').value = item.memo||'';
    }
  } else {
    document.getElementById('todo-title').value = '';
    document.getElementById('todo-recv').value = new Date().toISOString().slice(0,10); // 오늘 날짜 기본값
    document.getElementById('todo-due').value = '';
    document.getElementById('todo-priority').value = 'mid';
    document.getElementById('todo-status').value = 'todo';
    document.getElementById('todo-memo').value = '';
  }
  document.getElementById('m-todo').classList.add('on');
}


function saveTodo(){
  var title = document.getElementById('todo-title').value.trim();
  if(!title){ alert('업무 내용을 입력하세요'); return; }
  var todos = ldTodo();
  var now = new Date().toLocaleString('ko-KR');
  if(todoEditId){
    var idx = todos.findIndex(function(t){ return t.id===todoEditId; });
    if(idx>=0){
      todos[idx].title    = title;
      todos[idx].recv     = document.getElementById('todo-recv').value;
      todos[idx].due      = document.getElementById('todo-due').value;
      todos[idx].priority = document.getElementById('todo-priority').value;
      todos[idx].status   = document.getElementById('todo-status').value;
      todos[idx].memo     = document.getElementById('todo-memo').value.trim();
      todos[idx].updatedAt = now;
    }
  } else {
    todos.unshift({
      id: 'td_'+Date.now(),
      title:    title,
      recv:     document.getElementById('todo-recv').value,
      due:      document.getElementById('todo-due').value,
      priority: document.getElementById('todo-priority').value,
      status:   'todo',
      memo:     document.getElementById('todo-memo').value.trim(),
      createdAt: now,
      updatedAt: now
    });
  }
  svTodo(todos);
  closeM('m-todo');
  renderTodo();
}


function deleteTodo(id){
  if(!confirm('이 업무를 삭제하시겠습니까?')) return;
  svTodo(ldTodo().filter(function(t){ return t.id!==id; }));
  renderTodo();
}


function toggleTodoStatus(id){
  var todos = ldTodo();
  var item = todos.find(function(t){ return t.id===id; });
  if(!item) return;
  var cycle = {todo:'wip', wip:'done', done:'todo'};
  item.status = cycle[item.status]||'todo';
  item.updatedAt = new Date().toLocaleString('ko-KR');
  svTodo(todos);
  renderTodo();
}


function renderTodo(){
  var todos = ldTodo();
  var filter = (document.getElementById('todo-filter')||{value:'all'}).value;
  var filtered = filter==='all' ? todos
    : todos.filter(function(t){ return filter==='done' ? t.status==='done' : t.status!=='done'; });

  var el = function(id){ return document.getElementById(id); };
  if(el('ts-total')) el('ts-total').textContent = todos.length;
  if(el('ts-done'))  el('ts-done').textContent  = todos.filter(function(t){return t.status==='done';}).length;
  if(el('ts-wip'))   el('ts-wip').textContent   = todos.filter(function(t){return t.status==='wip';}).length;
  if(el('ts-todo'))  el('ts-todo').textContent  = todos.filter(function(t){return t.status==='todo';}).length;
  var di = el('todo-date-info');
  if(di) di.textContent = new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'});

  var prioVal={high:0,mid:1,low:2}, statusOrd={todo:0,wip:1,done:2};
  filtered.sort(function(a,b){
    if(statusOrd[a.status]!==statusOrd[b.status]) return statusOrd[a.status]-statusOrd[b.status];
    if(prioVal[a.priority]!==prioVal[b.priority]) return prioVal[a.priority]-prioVal[b.priority];
    if(a.due&&b.due) return a.due.localeCompare(b.due);
    if(a.due) return -1; if(b.due) return 1;
    return 0;
  });

  var listEl = el('todo-list');
  if(!listEl) return;
  listEl.innerHTML = '';
  if(!filtered.length){
    listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">'+(filter==='done'?'완료된 업무 없음':'할 일 없음 \uD83C\uDF89')+'</div>';
    return;
  }

  var today = new Date().toISOString().split('T')[0];
  var PRI_C={high:'var(--red)',mid:'var(--amber)',low:'var(--grn,#34d399)'};
  var PRI_L={high:'\uD83D\uDD34',mid:'\uD83D\uDFE1',low:'\uD83D\uDFE2'};
  var ST_L={todo:'\uD83D\uDCCC',wip:'\uD83D\uDD04',done:'\u2705'};
  var ST_F={todo:'\uD83D\uDCCC \uBBF8\uC644\uB8CC',wip:'\uD83D\uDD04 \uC9C4\uD589\uC911',done:'\u2705 \uC644\uB8CC'};
  var ST_C={todo:'var(--red)',wip:'var(--amber)',done:'var(--grn,#34d399)'};

  filtered.forEach(function(t){
    var isDone=t.status==='done';
    var isOD=t.due&&t.due<today&&!isDone;
    var card=document.createElement('div');
    card.style.cssText='background:var(--bg2);border:1px solid '+(isOD?'var(--red)':'var(--border)')+';border-left:3px solid '+PRI_C[t.priority||'mid']+';border-radius:9px;padding:14px 16px;opacity:'+(isDone?'0.65':'1');

    var row=document.createElement('div');
    row.style.cssText='display:flex;align-items:flex-start;gap:12px';

    var togBtn=document.createElement('button');
    togBtn.title='\uC0C1\uD0DC \uBCC0\uACBD';
    togBtn.style.cssText='flex-shrink:0;background:none;border:none;cursor:pointer;font-size:20px;padding:0;margin-top:1px';
    togBtn.textContent=ST_L[t.status||'todo'];
    togBtn.addEventListener('click',function(){toggleTodoStatus(t.id);});

    var info=document.createElement('div');
    info.style.cssText='flex:1;min-width:0';
    info.innerHTML='<div style="font-size:13px;font-weight:600;color:var(--text);text-decoration:'+(isDone?'line-through':'none')+';margin-bottom:5px">'+t.title+'</div>'
      +(t.memo?'<div style="font-size:11px;color:var(--text3);margin-bottom:5px">'+t.memo+'</div>':'')
      +'<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
      +'<span style="font-size:10px;color:'+ST_C[t.status||'todo']+'">'+ST_F[t.status||'todo']+'</span>'
      +(t.due?'<span style="font-size:10px;color:'+(isOD?'var(--red)':'var(--text3)')+'">'+( isOD?'\u26A0\uFE0F ':'📅 ')+t.due+(isOD?' \uAE30\uD55C\uCD08\uACFC':'')+'</span>':'')
      +'<span style="font-size:10px;color:var(--text3)">'+PRI_L[t.priority||'mid']+' '+(t.priority==='high'?'\uB192\uC74C':t.priority==='low'?'\uB099\uC74C':'\uBCF4\uD1B5')+'</span>'
      +'</div>';

    var btns=document.createElement('div');
    btns.style.cssText='display:flex;gap:4px;flex-shrink:0';
    var editBtn=document.createElement('button');
    editBtn.style.cssText='padding:4px 9px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;font-size:11px;color:var(--text2);cursor:pointer';
    editBtn.textContent='\uD3B8\uC9D1';
    editBtn.addEventListener('click',function(){openTodoModal(t.id);});
    var delBtn=document.createElement('button');
    delBtn.style.cssText='padding:4px 9px;background:var(--red-bg);border:1px solid var(--red);border-radius:5px;font-size:11px;color:var(--red);cursor:pointer';
    delBtn.textContent='\uC0AD\uC81C';
    delBtn.addEventListener('click',function(){deleteTodo(t.id);});
    btns.appendChild(editBtn);
    btns.appendChild(delBtn);

    row.appendChild(togBtn);
    row.appendChild(info);
    row.appendChild(btns);
    card.appendChild(row);
    listEl.appendChild(card);
  });
}


function updateTabPermUI(){
  var role = (document.getElementById('nu-role')||{value:'user'}).value;
  var isAdmin = role === 'admin';
  var isViewer = role === 'viewer';
  var container = document.getElementById('nu-tab-perms');
  if(!container) return;

  // 섹션별 그룹
  var sects = ['top','purchase','po'];
  var html = '';
  sects.forEach(function(sect){
    var tabs = TAB_DEFS.filter(function(t){ return t.sect===sect; });
    html += '<div style="grid-column:1/-1;font-size:10px;font-weight:700;color:var(--text3);margin-top:6px;padding-bottom:4px;border-bottom:1px solid var(--border)">'
          + SECT_LABELS[sect] + '</div>';
    tabs.forEach(function(t){
      var defAccess = isAdmin ? true : isViewer ? (t.key==='srch'||t.key==='todo') : t.default;
      var defEdit   = isAdmin ? true : isViewer ? false : (t.canEdit ? t.default : false);
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:var(--bg3);border-radius:6px;gap:8px">'
            + '<span style="font-size:12px;color:var(--text2)">' + t.label + '</span>'
            + '<div style="display:flex;gap:12px;align-items:center">'
            + '<label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text3);cursor:pointer">'
            + '<input type="checkbox" id="nu-acc-'+t.key+'" '+(defAccess?'checked':'')+(isAdmin?' disabled':'')
            + ' style="accent-color:var(--teal);width:13px;height:13px"> 접근'
            + '</label>';
      if(t.canEdit){
        html += '<label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text3);cursor:pointer">'
              + '<input type="checkbox" id="nu-edit-'+t.key+'" '+(defEdit?'checked':'')+(isAdmin?' disabled':'')
              + ' style="accent-color:var(--amber);width:13px;height:13px"> 수정'
              + '</label>';
      } else {
        html += '<span style="font-size:10px;color:var(--text3);width:52px"></span>';
      }
      html += '</div></div>';
    });
  });

  container.innerHTML = html;
}


function getTabPerms(){
  var perms = {access:[], edit:[]};
  TAB_DEFS.forEach(function(t){
    var accEl  = document.getElementById('nu-acc-'+t.key);
    var editEl = document.getElementById('nu-edit-'+t.key);
    if(accEl  && accEl.checked)  perms.access.push(t.key);
    if(editEl && editEl.checked) perms.edit.push(t.key);
  });
  return perms;
}


function applyTabPerms(perms, role){
  if(!perms || role==='admin') return; // admin은 모두 허용
  var access = perms.access || [];
  var edit   = perms.edit   || [];

  // 상위탭
  ['todo','purchase','po','srch'].forEach(function(key){
    var btn = document.getElementById('appbtn-'+key);
    if(btn) btn.style.display = access.includes(key) ? '' : 'none';
  });

  // 구매관리 서브탭
  document.querySelectorAll('#pt-inner-tabs .pt-itab').forEach(function(el){
    var tab = el.dataset.tab;
    if(tab && !access.includes(tab)) el.style.display = 'none';
  });

  // PO 서브탭
  document.querySelectorAll('#po-inner-tabs .po-itab').forEach(function(el){
    var tab = el.dataset.tab;
    var key = 'po-'+tab;
    if(tab && !access.includes(key) && !access.includes(tab)) el.style.display = 'none';
  });

  // 수정 권한 없는 탭 - 버튼들 숨김
  TAB_DEFS.filter(function(t){ return t.canEdit && !edit.includes(t.key); }).forEach(function(t){
    var editBtns = document.querySelectorAll('[data-edit-tab="'+t.key+'"]');
    editBtns.forEach(function(b){ b.style.display='none'; });
  });

  // 접근 가능한 첫 상위탭으로 이동
  var topOrder = ['todo','purchase','po','srch'];
  var firstApp = topOrder.find(function(k){ return access.includes(k); });
  if(firstApp) {
    switchApp(firstApp);
    // 해당 섹션의 접근 가능한 첫 서브탭으로 이동
    if(firstApp === 'purchase') {
      var ptOrder = ['db','recv','out','lt','bom','rdash','chk'];
      var firstPt = ptOrder.find(function(k){ return access.includes(k); });
      if(firstPt) ptTab(firstPt);
    } else if(firstApp === 'po') {
      var poOrder = ['dash','po','delivered','changes','tracking','sales','ordtrend'];
      var firstPo = poOrder.find(function(k){ return access.includes('po-'+k) || access.includes(k); });
      if(firstPo) poTab(firstPo);
    }
  }
}


function svDBItem(item, isDelete) {
  localStorage.setItem(K.DB, JSON.stringify(DB));
  if(!CURRENT_TOKEN) return;
  setSyncStatus('syncing');
  if(isDelete) {
    apiPost({ action:'deleteRow', sheet:'db_items', keyField:'pn', keyValue:item.pn })
      .then(function(r){ setSyncStatus(r.ok?'ok':'error'); })
      .catch(function(e){ setSyncStatus('error', e.message); });
  } else {
    // updateRow 먼저 시도, 없으면 appendRows
    apiPost({ action:'updateRow', sheet:'db_items', keyField:'pn', keyValue:item.pn, updates:item })
      .then(function(r){
        if(r.ok) { setSyncStatus('ok'); return; }
        // 행이 없으면 추가
        apiPost({ action:'appendRows', sheet:'db_items', rows:[item] })
          .then(function(r2){ setSyncStatus(r2.ok?'ok':'error'); })
          .catch(function(e){ setSyncStatus('error', e.message); });
      })
      .catch(function(e){ setSyncStatus('error', e.message); });
  }
}


function ltSelAll(checked){
  document.querySelectorAll('.lt-chk').forEach(function(c){ c.checked=checked; });
  ltSelChange();
}


function ltSelChange(){
  ltSelected = new Set();
  document.querySelectorAll('.lt-chk:checked').forEach(function(el){
    ltSelected.add(el.dataset.pn);
  });
  // LT 탭 일괄처리 바
  var bar = document.getElementById('lt-bulk-bar');
  var cnt = document.getElementById('lt-sel-cnt');
  if(bar){ bar.style.display = ltSelected.size > 0 ? 'flex' : 'none'; }
  if(cnt){ cnt.textContent = ltSelected.size + '개 선택됨'; }
  // LT 탭 전체선택 체크박스 상태
  var all = document.getElementById('lt-chk-all');
  var total = document.querySelectorAll('.lt-chk').length;
  if(all) all.indeterminate = ltSelected.size > 0 && ltSelected.size < total;
  if(all) all.checked = ltSelected.size === total && total > 0;
  // DB 탭 일괄편집 바 (현재 pg-db가 표시 중일 때만)
  var dbBar = document.getElementById('db-bulk-bar');
  var dbCnt = document.getElementById('db-sel-cnt');
  if(dbBar){ dbBar.style.display = ltSelected.size > 0 ? 'flex' : 'none'; }
  if(dbCnt){ dbCnt.textContent = ltSelected.size + '개 선택됨'; }
  // DB 전체선택 체크박스 상태
  var dbAll = document.getElementById('db-chk-all');
  var dbTotal = document.querySelectorAll('#db-tbody .lt-chk').length;
  if(dbAll) dbAll.indeterminate = ltSelected.size > 0 && ltSelected.size < dbTotal;
  if(dbAll) dbAll.checked = dbTotal > 0 && ltSelected.size >= dbTotal;
}


function ltCheckAll(checked){
  document.querySelectorAll('.lt-chk').forEach(function(el){ el.checked = checked; });
  ltSelChange();
}


function ltClearSel(){
  document.querySelectorAll('.lt-chk').forEach(function(el){ el.checked = false; });
  var all = document.getElementById('lt-chk-all');
  if(all){ all.checked = false; all.indeterminate = false; }
  ltSelected.clear();
  var bar = document.getElementById('lt-bulk-bar');
  if(bar) bar.style.display = 'none';
}


function ltBulkSave(){
  var ltVal = parseFloat(document.getElementById('lt-bulk-lt').value);
  if(!ltVal || ltVal <= 0){ alert('LT 주수를 입력하세요'); return; }
  if(!ltSelected.size){ alert('선택된 품목이 없습니다'); return; }
  var dt = new Date().toLocaleString('ko-KR');
  var cnt = 0;
  ltSelected.forEach(function(pn){
    var idx = DB.findIndex(function(x){ return x.pn === pn; });
    if(idx < 0) return;
    var old = DB[idx].lt;
    DB[idx].lt = ltVal;
    if(DB[idx].fc > 0) DB[idx].sf = Math.round(DB[idx].fc * (ltVal/4.3 + 1));
    HIST.unshift({pn, date:dt, action:'LT 일괄입력', changes:[{f:'LT', o:old||'없음', n:ltVal+'주'}]});
    svDBItem(DB[idx], false);
    cnt++;
  });
  sv(K.HIST, HIST);
  alert('✅ ' + cnt + '개 품목 LT 저장 완료 ('+ltVal+'주)');
  ltClearSel();
  renderLT(); updateStat();
}


function dbClearSel(){
  document.querySelectorAll('.lt-chk').forEach(function(el){ el.checked = false; });
  var all = document.getElementById('db-chk-all');
  if(all){ all.checked = false; all.indeterminate = false; }
  ltSelected.clear();
  var bar = document.getElementById('db-bulk-bar');
  if(bar) bar.style.display = 'none';
}


function openDBBulkEdit(){
  if(!ltSelected.size){ alert('품목을 선택하세요'); return; }
  var pns = Array.from(ltSelected);
  document.getElementById('db-bulk-sel-cnt').textContent = '(' + pns.length + '개 선택됨)';
  document.getElementById('db-bulk-preview').innerHTML =
    '<b style="color:var(--teal)">선택 품번:</b> ' + pns.slice(0,20).join(', ') + (pns.length>20?' 외 '+(pns.length-20)+'건':'');
  ['bulk-ct','bulk-managed','bulk-dept'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  ['bulk-by','bulk-lt','bulk-mq'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('m-db-bulk').classList.add('on');
}


function saveDBBulkEdit(){
  if(!ltSelected.size){ alert('선택된 품목이 없습니다'); return; }
  var ct      = document.getElementById('bulk-ct').value;
  var by      = document.getElementById('bulk-by').value.trim();
  var ltVal   = document.getElementById('bulk-lt').value;
  var mqVal   = document.getElementById('bulk-mq').value;
  var managed = document.getElementById('bulk-managed').value;
  var dept    = document.getElementById('bulk-dept').value;
  if(!ct && !by && ltVal==='' && mqVal==='' && !managed && !dept){
    alert('변경할 항목을 하나 이상 입력하세요'); return;
  }
  var dt = new Date().toLocaleString('ko-KR');
  var cnt = 0;
  ltSelected.forEach(function(pn){
    var idx = DB.findIndex(function(x){ return x.pn === pn; });
    if(idx < 0) return;
    var changes = [];
    if(ct && DB[idx].ct !== ct)          { changes.push({f:'Category', o:DB[idx].ct||'—', n:ct});       DB[idx].ct = ct; }
    if(by && DB[idx].by !== by)          { changes.push({f:'구매처',   o:DB[idx].by||'—', n:by});       DB[idx].by = by; }
    if(ltVal !== ''){
      var lt = parseFloat(ltVal);
      if(!isNaN(lt) && lt >= 0 && DB[idx].lt !== lt){
        changes.push({f:'LT', o:DB[idx].lt||'—', n:lt+'주'}); DB[idx].lt = lt;
        if(DB[idx].fc > 0) DB[idx].sf = Math.round(DB[idx].fc * (lt/4.3 + 1));
      }
    }
    if(mqVal !== ''){
      var mq = parseInt(mqVal);
      if(!isNaN(mq) && mq >= 0 && DB[idx].mq !== mq){
        changes.push({f:'MOQ', o:DB[idx].mq||'—', n:mq}); DB[idx].mq = mq;
      }
    }
    if(managed && DB[idx].managed !== managed){ changes.push({f:'관리대상', o:DB[idx].managed||'—', n:managed}); DB[idx].managed = managed; }
    if(dept    && DB[idx].dept    !== dept)   { changes.push({f:'관리부서', o:DB[idx].dept||'—',    n:dept});    DB[idx].dept    = dept; }
    if(changes.length){ HIST.unshift({pn, date:dt, action:'일괄편집', changes:changes}); svDBItem(DB[idx], false); cnt++; }
  });
  sv(K.DB, DB); sv(K.HIST, HIST);
  closeM('m-db-bulk'); dbClearSel();
  renderDB(); updateStat(); syncDBtoCHK();
  alert('✅ ' + cnt + '개 품목 일괄 편집 완료');
}


function resetAllData(){
  if(CURRENT_USER && CURRENT_USER.role !== 'admin'){
    alert('관리자만 초기화할 수 있습니다.');
    return;
  }
  var pw = prompt('관리자 암호를 입력하세요:');
  if(!pw) return;
  if(!confirm('\u26a0\ufe0f 전체 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
  apiPost({ action:'resetAll', password: pw }).then(function(res) {
    if(!res.ok){ alert('\u274c ' + (res.error || '초기화 실패')); return; }
    // 로컬 초기화
    DB=[]; RECV=[]; OUT=[]; HIST=[]; BOM={}; CHK=[]; CHKHIST={};
    Object.values(K).forEach(function(k){ localStorage.removeItem(k); });
    sv(K.DB,DB); sv(K.RECV,RECV); sv(K.OUT,OUT); sv(K.HIST,HIST);
    sv(K.BOM,BOM); sv(K.CHK,CHK); sv(K.CHKHIST,CHKHIST);
    bomSelParent=null;
    [LS_HIST,LS_TRACK,LS_DELIVERED,LS_SALES].forEach(function(k){ localStorage.removeItem(k); });
    PO=[];
    renderDB(); updateStat(); renderPO(); updateDeliveredBadge();
    alert('\u2705 전체 데이터가 초기화되었습니다.');
  }).catch(function(){ alert('서버 연결 실패'); });
}