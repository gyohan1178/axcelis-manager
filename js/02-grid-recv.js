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
    lt:['납기','lt(주)','lt㈜','lt(주)'],
    mq:['moq'],
    k4:['k4','24년','24년매입가','24년매입가(\\)'],
    k5:['매입가','25년매입가','k5','25년매입가(\\)'],
    k6:['26년매입가','k6','26년매입가(\\)'],
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
    lt:['lead_time','leadtime','리드타임','lt(주)','lt㈜','lt('],
    mq:['min_order','최소수량'],
    k4:['2024','price_2024','24년'],
    k5:['2025','price_2025','25년'],
    k6:['2026','price_2026','26년'],
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

function upImport(){
  const getIdx=k=>{const el=document.getElementById('mp-'+k);return el&&el.value!==''?+el.value:-1;};
  const pi=getIdx('pn');
  if(pi<0){
    var errEl=document.getElementById('up-map-err');
    if(errEl){ errEl.textContent='⚠️ 품번 열을 반드시 선택하세요'; errEl.style.display='block'; }
    else { alert('품번 열을 반드시 선택하세요'); }
    return;
  }
  var errEl=document.getElementById('up-map-err');
  if(errEl) errEl.style.display='none';

  const toNum=v=>{if(v===''||v===undefined||v===null)return 0;const n=parseFloat(String(v).replace(/,/g,''));return isNaN(n)?0:n;};
  const toStr=v=>String(v||'').trim();

  // 로컬 DB 중복 제거 (pn 기준)
  const seenPns = new Set();
  DB = DB.filter(function(x){ 
    if(seenPns.has(x.pn)) return false;
    seenPns.add(x.pn);
    return true;
  });

  let added=0,updated=0;
  // 전체교체 옵션
  var dbReplace = (document.getElementById('up-replace')||{}).checked;
  if(dbReplace){ DB.length=0; }
  upRows.forEach(r=>{
    const pn=toStr(r[pi]);
    if(!pn)return;
    const mk=(k)=>{const i=getIdx(k);return i>=0?r[i]:undefined;};
    const obj={
      pn,
      d:toStr(mk('d')||''),
      rv:toStr(mk('rv')||''),
      mg:toStr(mk('mg')||''),
      mp:toStr(mk('mp')||''),
      ct:toStr(mk('ct')||''),
      cl:toStr(mk('cl')||''),
      lc:toStr(mk('lc')||''),
      by:toStr(mk('by')||''),
      lt:toNum(mk('lt')),
      mq:toNum(mk('mq'))||1,
      k4:toNum(mk('k4')),
      k5:toNum(mk('k5')),
      k6:toNum(mk('k6')),
      ud:toNum(mk('ud')),
      fc:toNum(mk('fc')),
      sf:toNum(mk('sf')),
      op:toStr(mk('op')||''),
      om:toStr(mk('om')||''),
      managed:toStr(mk('managed')||'Y')||'Y',
      dept:toStr(mk('dept')||'지원본부')||'지원본부',
      ia:toStr(mk('op')||'')!=='',
    };
    // LT·FCST 모두 있으면 안전재고 자동계산
    if(obj.lt>0&&obj.fc>0&&obj.sf===0)obj.sf=Math.round(obj.fc*(obj.lt/4.3+1));
    const idx=DB.findIndex(x=>x.pn===pn);
    if(idx>=0){DB[idx]={...DB[idx],...obj};updated++;}
    else{DB.push(obj);added++;}
  });

  try { sv(K.DB,DB); } catch(e) {
    // localStorage 용량 초과 시 서버에만 저장, 로컬은 스킵
    console.warn('localStorage DB 저장 실패:', e.message);
  }
  // DB는 구글시트에서 직접 관리 - 서버 업로드 없음
  // (품목DB 탭 [서버 새로고침] 버튼으로 불러오기)
  document.getElementById('up-s2').classList.remove('on');
  document.getElementById('up-s3').classList.add('on');
  document.getElementById('up-next').style.display='none';
  document.getElementById('up-result').innerHTML=
    `✅ 가져오기 완료!<br>신규 추가: <b>${added}건</b> · 기존 갱신: <b>${updated}건</b> · 전체 DB: <b>${DB.length}건</b>`;
  renderDB();updateStat();
  const chkAdded=syncDBtoCHK();
  if(chkAdded>0) document.getElementById('up-result').innerHTML+=
    `<br>📋 재고점검 목록 자동 연동: <b>${chkAdded}건</b> 추가됨`;
}

// ══ 초기 데이터 ══
let DB=ld(K.DB,[]);
var STOCK=[];  // 재고현황 (업로드 시 교체)
var _stockFilter='all';
var K_PRICE='jst_price_hist';
var PRICE_HIST=ld(K_PRICE,[]);
var _priceFilter='all';
let RECV=ld(K.RECV,[]);
let OUT=ld(K.OUT,[]);
let HIST=ld(K.HIST,[]);
let BOM=ld(K.BOM,{});
let CHK=ld(K.CHK,[]);
let CHKHIST=ld(K.CHKHIST,{});


// ══ 탭 ══
function ptTab(t){
  document.querySelectorAll('#sect-purchase .pg').forEach(function(el){
    el.style.display = 'none';
    el.classList.remove('on');
  });
  var target = document.getElementById('pg-'+t);
  if(target){ target.style.display = 'block'; target.classList.add('on'); }
  var mc=document.getElementById('main-content'); if(mc) mc.scrollTop=0;
  document.querySelectorAll('#pt-inner-tabs .pt-itab').forEach(function(el){
    el.classList.toggle('on', el.dataset.tab===t);
  });
  var fns={db:renderDB,recv:renderRecv,out:renderOut,stock:renderStock,lt:renderLT,price:renderPriceHist,bom:initBOM,rdash:renderRecvDash,srch:initSrch,chk:initChk,palert:renderPurchaseAlert,analyze:renderAzPOList};
  if(fns[t]) fns[t]();
  var tblMap={db:'db-tbl',recv:'recv-tbl',out:'out-tbl'};
  if(tblMap[t]) { initColResize(tblMap[t]); setTimeout(function(){ initColResize(tblMap[t]); },300); }
}

// ══ 요약 ══
function updateStat(){
  const noLT=DB.filter(r=>!r.lt||r.lt===0);
  const alt=DB.filter(r=>r.ia);
  const saved=DB.filter(r=>r.k5>0&&r.k6>0&&r.k6<r.k5);
  const hasSafe=DB.filter(r=>r.sf>0);
  const _set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  _set('d0',DB.length.toLocaleString());
  _set('d1',noLT.length.toLocaleString());
  _set('d2',alt.length.toLocaleString());
  _set('d3',saved.length.toLocaleString());
  _set('d4',hasSafe.length.toLocaleString());
  _set('b-db',DB.length);
  _set('b-recv',RECV.length);
  _set('b-out',OUT.length);
  _set('b-lt',noLT.length);
  _set('b-bom',Object.keys(BOM).length);
  _set('hstat',`DB ${DB.length}건 · 매입 ${RECV.length}건 · BOM ${Object.keys(BOM).length}건`);
}

// ══ 품목 DB ══
const catCls={부품:'bt',와이어_케이블:'ba',하네스_도면:'bp',가공물_도면:'bk',조립도_도면:'bk',라벨:'bk',KIT:'bg'};
let dF=new Set(['all']),dSk='pn',dSd=1,dPn=1; const DP=25;

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

function reloadDBFromServer(){
  if(!CURRENT_TOKEN){ alert('로그인 필요'); return; }
  setSyncStatus('syncing', 'DB 로드 중...');
  var _buf = [];
  var PAGE = 1000;

  function _loadPage(offset){
    apiGet({ action:'getSheet', sheet:'db_items', limit:PAGE, offset:offset })
      .then(function(res){
        if(!res || !res.ok){ setSyncStatus('error','DB 로드 실패'); return; }
        var rows = res.data || [];
        if(rows.length) _buf = _buf.concat(gSheetToDB(rows));
        if(res.hasMore) {
          setSyncStatus('syncing', 'DB ' + _buf.length + '건 로드 중...');
          setTimeout(function(){ _loadPage(offset + PAGE); }, 100);
        } else {
          // 완료: pn 중복 제거 후 적용
          var seen = {};
          DB = _buf.filter(function(item){
            var k = String(item.pn||'').trim();
            if(!k || seen[k]) return false;
            seen[k] = true; return true;
          });
          try{ localStorage.setItem('jst_db2', JSON.stringify(DB)); }catch(e){}
          renderDB(); updateStat();
          setSyncStatus('ok', 'DB ' + DB.length + '건 로드 완료');
        }
      })
      .catch(function(e){ setSyncStatus('error', e.message); });
  }
  _loadPage(0);
}

function resetDB(){
  if(!confirm('⚠️ 품목 DB 전체를 초기화하시겠습니까?\n\n현재 저장된 모든 품목 데이터가 삭제됩니다.'))return;
  DB=[];
  sv(K.DB,DB);
  renderDB();updateStat();
  alert('품목 DB가 초기화되었습니다.');
}
function setDBDensity(mode){
  var tbl=document.getElementById('db-tbl'); if(!tbl) return;
  tbl.classList.remove('dens-compact','dens-normal','dens-wide');
  tbl.classList.add('dens-'+mode);
  try{ localStorage.setItem('ax_db_density', mode); }catch(e){}
}
function applyDBDensity(){
  var mode='normal';
  try{ mode=localStorage.getItem('ax_db_density')||'normal'; }catch(e){}
  var tbl=document.getElementById('db-tbl'); if(tbl){ tbl.classList.remove('dens-compact','dens-normal','dens-wide'); tbl.classList.add('dens-'+mode); }
}
function renderDB(){
  applyDBDensity();
  updateStat();
  const data=filtDB(),tot=data.length,pages=Math.ceil(tot/DP)||1;
  if(dPn>pages)dPn=1;
  const sl=data.slice((dPn-1)*DP,dPn*DP);
  document.getElementById('d-cnt').textContent=tot+'건';
  document.getElementById('d-pgn').textContent=`${dPn}/${pages} (${tot}건)`;
  document.getElementById('dp').disabled=dPn===1;
  document.getElementById('dn').disabled=dPn===pages;

  document.getElementById('db-tbody').innerHTML=sl.map(r=>{
    const ltTxt=(!r.lt||r.lt===0)?`<span class="lt-warn">미입력</span>`:r.lt;
    const p5=r.k5>0?r.k5.toLocaleString():'—';
    const p6=r.k6>0?r.k6.toLocaleString():'—';
    let saveTxt='—';
    if(r.k5>0&&r.k6>0){
      const pct=((r.k5-r.k6)/r.k5*100).toFixed(1);
      saveTxt=pct>0?`<span class="save-pos">▼${pct}%</span>`:pct<0?`<span class="save-neg">▲${Math.abs(pct)}%</span>`:'±0%';
    }
    const altTxt=r.ia
      ?`<span class="alt-badge">대체</span>`
      :`<span class="orig-badge">정품</span>`;
    const ayMap={'승인':'<span class="bd bg" style="font-size:9px">승인</span>','미결':'<span class="bd ba" style="font-size:9px">미결</span>','한시적승인':'<span class="bd bt" style="font-size:9px">한시</span>','검토중':'<span class="bd bk" style="font-size:9px">검토</span>','불가':'<span class="bd br" style="font-size:9px">불가</span>'};
    const ayTxt=r.ia?(ayMap[r.ay]||`<span class="alt-badge" style="font-size:9px">${r.ay||'대체'}</span>`):altTxt;
    const hc=HIST.filter(h=>h.pn===r.pn).length;
    return `<tr onclick="openDBModal('${r.pn}')">
      <td style="text-align:center"><input type="checkbox" class="lt-chk" data-pn="${r.pn}" onchange="ltSelChange()" style="accent-color:var(--teal);width:13px;height:13px"></td>
    <td style="font-family:var(--mono);font-size:11px;color:var(--tel);white-space:nowrap;min-width:90px">${r.pn}</td>
      <td style="color:var(--text);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.d}">${r.d}</td>
      <td style="font-family:var(--mono)">${r.rv||'—'}</td>
      <td><span class="bd ${catCls[r.ct]||'bk'}">${r.ct||'—'}</span></td>
      <td style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${r.mg||''}">${r.mg||'—'}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text2);white-space:nowrap" title="${r.mp||''}">${r.mp||'—'}</td>
      <td style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${r.by||''}">${r.by||'—'}</td>
      <td>${ltTxt}</td>
      <td style="font-family:var(--mono)">${r.mq||'—'}</td>
      <td style="font-family:var(--mono);color:var(--text2)">${p5}</td>
      <td style="font-family:var(--mono);color:var(--text)">${p6}</td>
      <td>${saveTxt}</td>
      <td>${r.fc>0?`<span style="font-family:var(--mono);font-size:11px;color:var(--pur)">${r.fc}</span>`:'—'}</td>
      <td>${r.sf>0?`<span class="bd bg">${r.sf}</span>`:'—'}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${r.lc||'—'}</td>
      <td style="text-align:center">${ayTxt}</td>
      <td><span class="bd ${r.dept==='지원본부'?'dept-jb':r.dept==='하네스'?'dept-hn':'dept-na'}">${r.dept||'지원본부'}</span></td>
      <td><button class="btn bk-btn sm" onclick="event.stopPropagation();openDBModal('${r.pn}')">편집</button></td>
    </tr>`;
  }).join('');
}
function dPg(d){dPn+=d;renderDB();}

// 품목 모달
let editPN=null;
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

// ══ 매입 이력 ══
let rF=new Set(['all']),rSk='order_date',rSd=-1,rPn=1; const RP=25;
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
function renderRecv(){
  const data=filtRecv(),tot=data.length,pages=Math.ceil(tot/RP)||1;
  if(rPn>pages)rPn=1;
  const sl=data.slice((rPn-1)*RP,rPn*RP);
  document.getElementById('r-cnt').textContent=tot+'건';
  document.getElementById('r-pgn').textContent=`${rPn}/${pages} (${tot}건)`;
  document.getElementById('rp').disabled=rPn===1;
  document.getElementById('rn').disabled=rPn===pages;
  const pyCls={'정기 결제':'bt','카드 결제':'ba','해외 송금':'bp','사급':'bk','선금 결제':'br'};
  document.getElementById('recv-tbody').innerHTML=sl.map((r,i)=>{
    const gi=RECV.indexOf(r); // global index for delete
    return `<tr>
    <td style="width:32px"><input type="checkbox" class="recv-chk row-chk" data-idx="${gi}" onchange="updateRecvBulkBtns()"></td>
    <td style="font-family:var(--mono);font-size:11px;white-space:nowrap">${fmtShortDate(r.order_date)}</td>
    <td style="font-family:var(--mono);font-size:11px;white-space:nowrap;color:var(--amb)">${fmtShortDate(r.req_date)}</td>
    <td style="font-family:var(--mono);font-size:11px;white-space:nowrap;color:${r.recv_date?'var(--grn)':'var(--text3)'}">${fmtShortDate(r.recv_date)}</td>
    <td style="text-align:center;white-space:nowrap">${r.recv_date?'<span class="bd" style="background:var(--gbg);color:var(--grn);font-size:10px">✅입고</span>':'<span class="bd" style="background:var(--abg);color:var(--amb);font-size:10px">⏳미입고</span>'}</td>
    <td style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px" title="${r.vendor||''}">${r.vendor||'—'}</td>
    <td style="font-family:var(--mono);font-size:11px;color:var(--tel);white-space:nowrap">${r.pn||'—'}</td>
    <td style="font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px" title="${r.mfg||''}">${r.mfg||'—'}</td>
    <td style="font-family:var(--mono);font-size:11px;white-space:nowrap">${r.mfg_pn||'—'}</td>
    <td style="text-align:right;font-family:var(--mono);white-space:nowrap">${(+r.qty).toLocaleString()}</td>
    <td style="font-size:11px;color:var(--text3)">${r.unit||'EA'}</td>
    <td style="text-align:right;font-family:var(--mono);white-space:nowrap;color:var(--text2)">${r.unit_price>0?r.unit_price.toLocaleString():'—'}</td>
    <td style="text-align:right;font-family:var(--mono);white-space:nowrap">${r.total>0?r.total.toLocaleString():'—'}</td>
    <td><span class="bd ${pyCls[r.pay]||'bk'}" style="font-size:10px;white-space:nowrap">${r.pay||'—'}</span></td>
    <td style="font-family:var(--mono);font-size:10px;color:var(--text3);white-space:nowrap">${r.bl||'—'}</td>
    <td style="font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px" title="${r.note||''}">${r.note||'—'}</td>
    <td style="white-space:nowrap;display:flex;gap:4px">
      <button class="btn bk-btn sm" onclick="openEditRecv(${gi})">수정</button>
      <button class="btn bk-btn sm" style="color:var(--red)" onclick="delRecv(${gi})">삭제</button>
    </td>
  </tr>`;}).join('');
}
function rPg(d){rPn+=d;renderRecv();}

// 전체 체크박스
function toggleAllRecv(el){
  document.querySelectorAll('.row-chk').forEach(c=>c.checked=el.checked);
  updateRecvBulkBtns();
}
function updateRecvBulkBtns(){
  const cnt=document.querySelectorAll('.row-chk:checked').length;
  document.getElementById('recv-bulk-recv-btn').style.display=cnt>0?'':'none';
  document.getElementById('recv-bulk-edit-btn').style.display=cnt===1?'':'none';
}

// ══ 매입 다품목 등록 ══
let recvRowId=0;
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

