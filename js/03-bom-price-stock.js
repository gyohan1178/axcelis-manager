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

// ══ 이카운트 ERP 발주서 내보내기 ══
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

// ══ 자재 불출 (요청 관리) ══
var _oTab = 'pend';
var oPn = 1; var OP = 20;

function oTab(t) {
  _oTab = t;
  document.querySelectorAll('#pg-out .chip').forEach(function(el) {
    el.classList.toggle('on', el.id === 'oc-' + t);
    el.classList.toggle('t', el.id === 'oc-' + t);
  });
  oPn = 1; renderOut();
}

function renderOut() {
  var q = ((document.getElementById('oq')||{}).value||'').toLowerCase().trim();
  var all = Array.isArray(OUT) ? OUT : [];

  // 필터링
  var data = all.filter(function(r) {
    if(_oTab === 'pend' && r._done) return false;
    if(_oTab === 'done' && !r._done) return false;
    if(q && !((r.pn||'').toLowerCase().includes(q) ||
              (r.dest||'').toLowerCase().includes(q) ||
              (r.note||'').toLowerCase().includes(q))) return false;
    return true;
  });

  // 요청일 내림차순
  data = data.slice().sort(function(a,b){
    return (b.date||'').localeCompare(a.date||'');
  });

  var total = data.length;
  var pages = Math.ceil(total/OP)||1;
  if(oPn > pages) oPn = 1;
  var slice = data.slice((oPn-1)*OP, oPn*OP);

  var cntEl = document.getElementById('o-cnt');
  var pgnEl = document.getElementById('o-pgn');
  var prevEl = document.getElementById('op');
  var nextEl = document.getElementById('on_');
  if(cntEl) cntEl.textContent = total+'건';
  if(pgnEl) pgnEl.textContent = oPn+'/'+pages+' ('+total+'건)';
  if(prevEl) prevEl.disabled = oPn===1;
  if(nextEl) nextEl.disabled = oPn===pages;

  // 미처리 건수 배지
  var pend = all.filter(function(r){ return !r._done; }).length;
  var bdg = document.getElementById('b-out');
  if(bdg) bdg.textContent = pend > 0 ? pend : '';

  var tbody = document.getElementById('out-tbody');
  if(!tbody) return;

  if(!slice.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text3)">' +
      (_oTab==='pend' ? '대기 중인 불출요청이 없습니다' :
       _oTab==='done' ? '처리완료 내역이 없습니다' : '데이터 없음') + '</td></tr>';
    return;
  }

  tbody.innerHTML = slice.map(function(r, idx) {
    var gi = (oPn-1)*OP + idx;
    var dbr = (DB||[]).find(function(x){ return x.pn===r.pn; })||{};
    var isDone = !!r._done;
    var rowStyle = isDone ? 'opacity:.55' : '';
    var statusHtml = isDone
      ? '<span style="background:rgba(52,211,153,.15);color:var(--grn);padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700">✅ 처리완료</span>'
        + '<div style="font-size:10px;color:var(--text3);margin-top:2px">' + (r._doneAt||'') + '</div>'
      : '<button onclick="outDone('+gi+')" style="padding:3px 10px;background:var(--teal);color:#051515;border:none;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer">처리</button>';
    return '<tr style="border-bottom:1px solid var(--border);'+rowStyle+'">' +
      '<td style="padding:7px 10px;font-family:var(--mono);font-size:11px;color:var(--text3)">' + (r.date||'—') + '</td>' +
      '<td style="padding:7px 10px;font-family:var(--mono);font-size:11px;color:var(--teal);overflow:hidden;text-overflow:ellipsis">' + (r.pn||'—') + '</td>' +
      '<td style="padding:7px 10px;font-size:11px;overflow:hidden;text-overflow:ellipsis" title="'+(dbr.d||r.note||'')+'">' + (dbr.d||'—') + '</td>' +
      '<td style="padding:7px 10px;font-family:var(--mono);font-size:11px;text-align:right">' + (r.qty||0).toLocaleString() + '</td>' +
      '<td style="padding:7px 10px;font-size:11px;color:var(--text3)">' + (r.unit||'EA') + '</td>' +
      '<td style="padding:7px 10px;font-size:11px;overflow:hidden;text-overflow:ellipsis">' + (r.dest||'—') + '</td>' +
      '<td style="padding:7px 10px;font-size:11px;color:var(--text3)">' + (r.purpose||'—') + '</td>' +
      '<td style="padding:7px 10px;font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis">' + ((r.note||'').replace('[불출요청]','').trim()||'—') + '</td>' +
      '<td style="padding:7px 10px;text-align:center">' + statusHtml + '</td>' +
    '</tr>';
  }).join('');
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



// ══ 자재 불출 다품목 + BOM 전개 ══
let outRowId=0;
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

// BOM 전개
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

// ══ LT 미입력 ══
let lF=new Set(['all']),lPn=1; const LP=30;
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
function renderPriceHist(){
  var q=(document.getElementById('price-q')||{value:''}).value.toLowerCase();
  var data=PRICE_HIST.slice();
  if(q)data=data.filter(function(r){return(r.pn||'').toLowerCase().includes(q)||(r.d||'').toLowerCase().includes(q);});
  if(_priceFilter==='down')data=data.filter(function(r){return r.diff<0;});
  if(_priceFilter==='up')data=data.filter(function(r){return r.diff>0;});
  var cnt=document.getElementById('price-cnt');if(cnt)cnt.textContent=data.length+'건';
  var bdg=document.getElementById('b-price');if(bdg)bdg.textContent=PRICE_HIST.length;
  var downs=PRICE_HIST.filter(function(r){return r.diff<0;}),ups=PRICE_HIST.filter(function(r){return r.diff>0;});
  var sumD=downs.reduce(function(s,r){return s+Math.abs(r.diff);},0),sumU=ups.reduce(function(s,r){return s+r.diff;},0);
  var sumEl=document.getElementById('price-summary');
  var totalQty=PRICE_HIST.reduce(function(s,r){return s+(r.qty||0);},0);
  var realSaved=downs.reduce(function(s,r){return s+Math.abs(r.totalDiff||0);},0);
  var realUp=ups.reduce(function(s,r){return s+(r.totalDiff||0);},0);
  if(sumEl)sumEl.innerHTML=
    '<div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--text3)">총 변동품목</div><div style="font-size:20px;font-weight:700">'+PRICE_HIST.length+'건</div><div style="font-size:11px;color:var(--text3)">올해 매입 '+totalQty.toLocaleString()+'개</div></div>'+
    '<div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center;border:1px solid var(--green)"><div style="font-size:10px;color:var(--text3)">인하 (단가×수량)</div><div style="font-size:16px;font-weight:700;color:var(--green)">▼ '+sumD.toLocaleString()+'원</div><div style="font-size:11px;color:var(--green);font-weight:600">실절감 ▼ '+realSaved.toLocaleString()+'원</div><div style="font-size:10px;color:var(--text3)">'+downs.length+'품목</div></div>'+
    '<div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center;border:1px solid var(--red)"><div style="font-size:10px;color:var(--text3)">인상 (단가×수량)</div><div style="font-size:16px;font-weight:700;color:var(--red)">▲ '+sumU.toLocaleString()+'원</div><div style="font-size:11px;color:var(--red);font-weight:600">실증가 ▲ '+realUp.toLocaleString()+'원</div><div style="font-size:10px;color:var(--text3)">'+ups.length+'품목</div></div>';
  var tbody=document.getElementById('price-tbody');if(!tbody)return;
  if(!data.length){tbody.innerHTML='<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--text3)">단가변동 이력이 없습니다</td></tr>';return;}
  tbody.innerHTML=data.map(function(r){
    var isDown=r.diff<0,color=isDown?'var(--green)':'var(--red)',arrow=isDown?'▼':'▲';
    var pct=r.pct!==null?arrow+Math.abs(r.pct)+'%':'신규';
    return '<tr style="border-bottom:1px solid var(--border)">'+
      '<td style="padding:7px 10px;font-size:11px;color:var(--text3)">'+r.date+'</td>'+
      '<td style="padding:7px 10px;font-family:var(--mono);font-size:11px;color:var(--accent)">'+r.pn+'</td>'+
      '<td style="padding:7px 10px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+r.d+'</td>'+
      '<td style="padding:7px 10px;text-align:right;font-family:var(--mono);color:var(--text3)">'+(r.k5>0?r.k5.toLocaleString():'—')+'</td>'+
      '<td style="padding:7px 10px;text-align:right;font-family:var(--mono);font-weight:600">'+r.k6.toLocaleString()+'</td>'+
      '<td style="padding:7px 10px;text-align:right;color:'+color+';font-weight:700">'+arrow+Math.abs(r.diff).toLocaleString()+'</td>'+
      '<td style="padding:7px 10px;text-align:right;color:'+color+';font-weight:700">'+pct+'</td>'+
      '<td style="padding:7px 10px;text-align:right;font-family:var(--mono);color:var(--text2)">'+(r.qty||0).toLocaleString()+'</td>'+
      '<td style="padding:7px 10px;text-align:right;font-family:var(--mono);color:'+color+';font-weight:600">'+(r.totalDiff?arrow+Math.abs(r.totalDiff).toLocaleString():'—')+'</td>'+
      '<td style="padding:7px 10px;font-size:11px;color:var(--text3)">'+r.recvDate+'</td>'+
    '</tr>';
  }).join('');
}
function exportPriceHistCSV(){
  if(!PRICE_HIST.length){alert('이력 없음');return;}
  var bom='\uFEFF',hdr=['변동일','품번','품명','25년단가','26년단가','변동액','변동률','올해수량','실절감액','최근발주일'];
  var rows=PRICE_HIST.map(function(r){return[r.date,r.pn,'"'+(r.d||'')+'"',r.k5,r.k6,r.diff,r.pct!==null?r.pct+'%':'신규',(r.qty||0),(r.totalDiff||0),r.recvDate].join(',');});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([bom+hdr.join(',')+'\n'+rows.join('\n')],{type:'text/csv;charset=utf-8'}));
  a.download='단가변동이력_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
}
function clearPriceHist(){if(!confirm('단가변동 이력을 모두 삭제할까요?'))return;PRICE_HIST=[];savePriceHist([]);renderPriceHist();alert('삭제 완료');}


// ── 재고현황 ──
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

function renderStock(){
  var q=(document.getElementById('stock-q')||{value:''}).value.toLowerCase();
  var data=STOCK.slice();
  if(q) data=data.filter(function(r){return (r.pn||'').toLowerCase().includes(q)||(r.mp||'').toLowerCase().includes(q)||(r.stat||'').includes(q);});
  if(_stockFilter==='zero') data=data.filter(function(r){return r.cur<=0;});
  if(_stockFilter==='neg')  data=data.filter(function(r){return r.cur<0;});
  if(_stockFilter==='ok')   data=data.filter(function(r){return r.cur>0;});

  var cnt=document.getElementById('stock-cnt'); if(cnt) cnt.textContent=data.length+'건';
  var bdg=document.getElementById('b-stock'); if(bdg) bdg.textContent=STOCK.length;

  // 요약 카드
  var total=STOCK.length;
  var negCnt=STOCK.filter(function(r){return r.cur<0;}).length;
  var zeroCnt=STOCK.filter(function(r){return r.cur===0;}).length;
  var okCnt=STOCK.filter(function(r){return r.cur>0;}).length;
  var sumEl=document.getElementById('stock-summary');
  if(sumEl) sumEl.innerHTML=
    '<div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--text3)">전체품목</div><div style="font-size:22px;font-weight:700">'+total+'</div></div>'+
    '<div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center;border:1px solid var(--green)"><div style="font-size:10px;color:var(--text3)">재고있음</div><div style="font-size:22px;font-weight:700;color:var(--green)">'+okCnt+'</div></div>'+
    '<div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center;border:1px solid var(--border)"><div style="font-size:10px;color:var(--text3)">품절</div><div style="font-size:22px;font-weight:700;color:var(--text3)">'+zeroCnt+'</div></div>'+
    '<div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center;border:1px solid var(--red)"><div style="font-size:10px;color:var(--text3)">음수재고</div><div style="font-size:22px;font-weight:700;color:var(--red)">'+negCnt+'</div></div>';

  var tbody=document.getElementById('stock-tbody'); if(!tbody) return;
  if(!data.length){
    tbody.innerHTML='<tr><td colspan="11" style="text-align:center;padding:30px;color:var(--text3)">재고현황 데이터 없음 — 파일 업로드하세요</td></tr>';
    return;
  }
  tbody.innerHTML=data.map(function(r){
    var curColor = r.cur<0 ? 'var(--red)' : r.cur===0 ? 'var(--text3)' : 'var(--green)';
    var statBd = r.stat==='품절'?'bd bd-red':r.cur>0?'bd bd-green':'bd bk';
    var isSafe = r.safe>0 && r.cur < r.safe;
    return '<tr style="border-bottom:1px solid var(--border)">'
      +'<td style="font-family:var(--mono);font-size:11px;color:var(--accent);padding:7px 10px">'+r.pn+'</td>'
      +'<td style="font-size:11px;padding:7px 10px;color:var(--text2)">'+r.mp+'</td>'
      +'<td style="padding:7px 10px;color:var(--text3);font-size:11px">'+r.unit+'</td>'
      +'<td style="text-align:right;padding:7px 10px;font-family:var(--mono)">'+r.init+'</td>'
      +'<td style="text-align:right;padding:7px 10px;font-family:var(--mono);color:var(--teal)">'+r.inQty+'</td>'
      +'<td style="text-align:right;padding:7px 10px;font-family:var(--mono);color:var(--amber)">'+r.outQty+'</td>'
      +'<td style="text-align:right;padding:7px 10px;font-family:var(--mono);font-weight:700;color:'+curColor+'">'+r.cur+'</td>'
      +'<td style="text-align:right;padding:7px 10px;font-family:var(--mono);color:'+(isSafe?'var(--red)':'var(--text3)')+'">'+r.safe+'</td>'
      +'<td style="padding:7px 10px"><span class="'+statBd+'">'+r.stat+'</span></td>'
      +'<td style="text-align:right;padding:7px 10px;font-family:var(--mono)">'+r.avail+'</td>'
      +'<td style="font-size:11px;padding:7px 10px;color:var(--text3)">'+r.note+'</td>'
      +'</tr>';
  }).join('');
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


var priceUpdateTarget = 'k5';

function openPriceUpdate(){
  priceUpdateTarget='k5';
  document.getElementById('pu-k5').style.cssText='flex:1;padding:8px;border-radius:6px;border:2px solid var(--amber);background:var(--amber);color:#000;font-weight:700;cursor:pointer';
  document.getElementById('pu-k6').style.cssText='flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text2);cursor:pointer';
  document.getElementById('price-update-file').value='';
  document.getElementById('price-update-result').style.display='none';
  document.getElementById('m-price-update').classList.add('on');
}

// k5/k6 버튼 토글
document.addEventListener('click', function(e){
  if(e.target.id==='pu-k5'){
    priceUpdateTarget='k5';
    document.getElementById('pu-k5').style.cssText='flex:1;padding:8px;border-radius:6px;border:2px solid var(--amber);background:var(--amber);color:#000;font-weight:700;cursor:pointer';
    document.getElementById('pu-k6').style.cssText='flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text2);cursor:pointer';
  } else if(e.target.id==='pu-k6'){
    priceUpdateTarget='k6';
    document.getElementById('pu-k6').style.cssText='flex:1;padding:8px;border-radius:6px;border:2px solid var(--teal);background:var(--teal);color:#000;font-weight:700;cursor:pointer';
    document.getElementById('pu-k5').style.cssText='flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text2);cursor:pointer';
  }
});

function handlePriceUpdate(inp){
  if(!inp.files[0]) return;
  var file = inp.files[0];
  inp.value = '';
  var reader = new FileReader();
  reader.onload = function(e){
    try {
      var ext = file.name.split('.').pop().toLowerCase();
      var wb = XLSX.read(new Uint8Array(e.target.result), {type:'array', raw:true});
      var ws = wb.Sheets[wb.SheetNames[0]];
      var raw = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      if(raw.length < 2){ alert('데이터 없음'); return; }

      // 헤더 찾기 - 품번/단가 컬럼
      var hdr = raw[0].map(function(h){ return String(h||'').toLowerCase().replace(/\s/g,''); });
      var pnI = hdr.findIndex(function(h){ return h.includes('품번')||h.includes('pn')||h.includes('itemcode'); });
      var prI = hdr.findIndex(function(h){ return h.includes('단가')||h.includes('price')||h.includes('금액'); });
      if(pnI<0||prI<0){ alert('품번/단가 컬럼을 찾을 수 없습니다\n헤더: '+raw[0].join(', ')); return; }

      var updated=0, notFound=0, noChange=0;
      raw.slice(1).forEach(function(row){
        var pn = String(row[pnI]||'').trim().replace(/\.0$/,'');
        var price = parseFloat(String(row[prI]||'').replace(/,/g,''));
        if(!pn || isNaN(price) || price<=0) return;

        var idx = DB.findIndex(function(x){ return x.pn===pn; });
        if(idx<0){ notFound++; return; }
        if(DB[idx][priceUpdateTarget]===price){ noChange++; return; }

        DB[idx][priceUpdateTarget] = price;
        svDBItem(DB[idx], false);
        updated++;
      });

      sv(K.DB, DB);
      renderDB(); updateStat();

      var msg = '✅ 업데이트 완료\n';
      msg += '• 수정: '+updated+'건\n';
      if(notFound) msg += '• DB 미등록: '+notFound+'건\n';
      if(noChange) msg += '• 변동없음: '+noChange+'건';

      var resEl = document.getElementById('price-update-result');
      resEl.innerHTML = msg.replace(/\n/g,'<br>');
      resEl.style.display = '';
      resEl.style.color = 'var(--green)';

    } catch(err){ alert('오류: '+err.message); }
  };
  reader.readAsArrayBuffer(file);
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

// PO 현황 강제 서버 업로드
function poForcePush(){
  if(!CURRENT_TOKEN){ alert('로그인 필요'); return; }
  // PO 전역변수 우선, 없으면 localStorage에서 복원
  var poData = (PO && PO.length) ? PO : (function(){
    try{ return JSON.parse(localStorage.getItem('po_data')||'[]'); }catch(e){ return []; }
  })();
  if(!poData.length){ alert('업로드할 PO 데이터가 없습니다.\nPO 엑셀을 먼저 업로드하세요.'); return; }
  var btn=document.getElementById('po-force-push');
  if(btn){ btn.disabled=true; btn.textContent='업로드 중...'; }
  apiPost({action:'setSheet',sheet:'po_data',data:poData})
    .then(function(res){
      if(btn){ btn.disabled=false; btn.textContent='⬆ 서버 업로드'; }
      if(res&&res.ok) alert('✓ PO 현황 '+poData.length+'건 서버 업로드 완료');
      else alert('✗ 실패: '+(res&&res.error||'오류'));
    })
    .catch(function(e){
      if(btn){ btn.disabled=false; btn.textContent='⬆ 서버 업로드'; }
      alert('✗ 업로드 실패: '+e.message);
    });
}

// 납품완료 강제 서버 업로드
function dvForcePush(){
  if(!CURRENT_TOKEN){ alert('로그인 필요'); return; }
  var d=getDelivered();
  if(!d.length){ alert('업로드할 납품이력이 없습니다'); return; }
  var btn=document.getElementById('dv-force-push');
  if(btn){ btn.disabled=true; btn.textContent='업로드 중...'; }
  apiPost({action:'setSheet',sheet:'po_delivered',data:d})
    .then(function(res){
      if(btn){ btn.disabled=false; btn.textContent='⬆ 서버 업로드'; }
      if(res&&res.ok) alert('✓ 납품이력 '+d.length+'건 서버 업로드 완료');
      else alert('✗ 실패: '+(res&&res.error||'오류'));
    })
    .catch(function(e){
      if(btn){ btn.disabled=false; btn.textContent='⬆ 서버 업로드'; }
      alert('✗ 업로드 실패: '+e.message);
    });
}

function reloadPOFromServer() {
  if(!CURRENT_TOKEN){ alert('로그인 필요'); return; }
  setSyncStatus('syncing', 'PO 데이터 로드 중...');
  apiGet({ action:'getSheets', sheets:'po_data,po_delivered' })
    .then(function(res) {
      if(!res || !res.ok || !res.data) { setSyncStatus('error','로드 실패'); return; }
      var msgs = [];

      // PO 현황
      if(res.data['po_data'] && res.data['po_data'].length) {
        // 서버 필드명 → 클라이언트 필드명 정규화
        var _fieldMap={'d':'desc','promise_date':'promise','req_date':'required','del_line':'delLine','order_line':'orderLine','total':'extended_price','order_date':'placed'};
        PO = res.data['po_data'].map(function(r){
          var out=Object.assign({},r);
          Object.keys(_fieldMap).forEach(function(sk){
            var ck=_fieldMap[sk];
            if(r[sk]!==undefined&&r[ck]===undefined) out[ck]=r[sk];
          });
          ['promise','required','placed','chuldo'].forEach(function(f){
            if(out[f]&&String(out[f]).length>10) out[f]=String(out[f]).slice(0,10);
          });
          return out;
        });
        // 로컬 캐시 (500건)
        try { localStorage.setItem('po_data', JSON.stringify(PO.slice(0,500))); } catch(e){}
        // getHist 메타와 동기화
        var h = getHist();
        if(h.length > 0) h[0].data = PO;
        else h = [{date: new Date().toLocaleString('ko-KR'), data: PO, changes:[]}];
        var slim = h.slice(0,10).map(function(entry){
          return {date:entry.date, changes:entry.changes||[]};
        });
        try { localStorage.setItem(LS_HIST, JSON.stringify(slim)); } catch(e){}
        var lu = document.getElementById('last-updated');
        if(lu) lu.textContent = '서버 동기화: ' + new Date().toLocaleString('ko-KR');
        msgs.push('PO ' + PO.length + '건');
        refreshAll();
        buildHistSelect();
      }

      // 납품완료
      if(res.data['po_delivered'] && res.data['po_delivered'].length) {
        var dvData = res.data['po_delivered'];
        try { localStorage.setItem(LS_DELIVERED, JSON.stringify(dvData)); } catch(e){
          try { localStorage.setItem(LS_DELIVERED, JSON.stringify(dvData.slice(0,500))); } catch(e2){}
        }
        updateDeliveredBadge();
        buildYearTabs(dvData);
        renderDelivered();
        renderSalesDash();
        msgs.push('납품이력 ' + dvData.length + '건');
      }

      // 트레킹
      if(res.data['po_tracking'] && res.data['po_tracking'].length) {
        // 행 배열 → 트레킹 객체로 변환
        var trkObj = {};
        res.data['po_tracking'].forEach(function(r){
          var key = (r.item||r.pn||'') + '|' + (r.order||'');
          if(!trkObj[key]) trkObj[key] = {item:r.item||r.pn||'', desc:r.desc||'', order:r.order||'', history:[]};
          trkObj[key].history.push({date:r.date||'', trackNum:r.trackNum||r.track_num||'', chuldo:r.chuldo||'', promise:r.promise||''});
        });
        try { localStorage.setItem(LS_TRACK, JSON.stringify(trkObj)); } catch(e){}
        if(typeof renderTracking==='function') renderTracking();
      }

      setSyncStatus('ok');
      if(msgs.length) alert('✅ 서버에서 불러오기 완료\n' + msgs.join('\n'));
      else alert('서버에 PO 데이터 없음');
    })
    .catch(function(e){ setSyncStatus('error', e.message); alert('오류: ' + e.message); });
}

function renderLT(){
  const q=(document.getElementById('lq')||{value:''}).value.toLowerCase();
  if(!DB || DB.length === 0){
    var tbody = document.getElementById('lt-tbody');
    if(tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text3)">품목 DB 로딩 중... 잠시 후 다시 확인하세요</td></tr>';
    return;
  }
  // lt가 없거나 0이거나 빈문자열이거나 NaN인 경우 모두 포함
let data=DB.filter(r=>{ var lt=parseFloat(r.lt); return !lt || lt<=0; });
  if(q)data=data.filter(r=>(r.pn+r.d+r.by).toLowerCase().includes(q));
  if(lF.has('fcst'))data=[...data].sort((a,b)=>(b.fc||0)-(a.fc||0));
  if(lF.has('부품'))data=data.filter(r=>r.ct==='부품');
  if(lF.has('와이어'))data=data.filter(r=>r.ct==='와이어_케이블');
  const tot=data.length,pages=Math.ceil(tot/LP)||1;
  if(lPn>pages)lPn=1;
  const sl=data.slice((lPn-1)*LP,lPn*LP);
  document.getElementById('l-cnt').textContent=tot+'건';
  document.getElementById('l-pgn').textContent=`${lPn}/${pages} (${tot}건)`;
  document.getElementById('lp').disabled=lPn===1;
  document.getElementById('ln').disabled=lPn===pages;
  document.getElementById('lt-tbody').innerHTML=sl.map(r=>`<tr data-pn="${r.pn}">
    <td style="text-align:center"><input type="checkbox" class="lt-chk" data-pn="${r.pn}" onchange="ltSelChange()" style="accent-color:var(--teal);width:13px;height:13px"></td>
    <td style="font-family:var(--mono);font-size:11px;color:var(--tel)">${r.pn}</td>
    <td style="color:var(--text)" title="${r.d}">${r.d}</td>
    <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${r.mp||'—'}</td>
    <td><span class="bd ${catCls[r.ct]||'bk'}">${r.ct||'—'}</span></td>
    <td>${r.by||'—'}</td>
    <td>${r.fc>0?`<span style="font-family:var(--mono);color:var(--pur)">${r.fc}</span>`:'—'}</td>
    <td>
      <div style="display:flex;gap:5px;align-items:center">
        <input type="number" min="1" step="0.5" placeholder="주수" style="width:62px;padding:4px 7px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:12px"
          id="li-${r.pn.replace(/[^a-zA-Z0-9]/g,'_')}" oninput="prevLT('${r.pn}')">
        <button class="btn ba-btn sm" onclick="saveLT('${r.pn}')">저장</button>
      </div>
    </td>
    <td id="lp-${r.pn.replace(/[^a-zA-Z0-9]/g,'_')}" style="font-family:var(--mono);color:var(--tel)">
      ${r.fc>0?'주수 입력 시 계산':'—'}
    </td>
  </tr>`).join('');
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

// ══ BOM 엑셀 업로드 지원 ══
// upImport 이후 BOM시트가 있으면 자동 파싱 (선택사항)
// BOM 포맷: 상위품번 | 하위품번 | 수량
// 수동 등록 예시: BOM['510000100']=[{pn:'510000200',qty:2},{pn:'510000300',qty:1}]

// ══ 자재 조회 탭 ══
let reqItems=[]; // 불출요청 품목 리스트

function initSrch(){
  // 출고처 datalist 채우기
  const dests=[...new Set(OUT.map(r=>r.dest).filter(Boolean))];
  document.getElementById('dl2').innerHTML=dests.map(v=>`<option value="${v}">`).join('');
  // 날짜 기본값
  if(!document.getElementById('req-dt').value)
    document.getElementById('req-dt').value=new Date().toISOString().split('T')[0];
  // req-panel 항상 표시
  // req-panel은 srch-pg-req에 있음
  renderReqPanel();
}

// ── 실시간 검색 (타이핑) ──
let srchTimer=null;
function srchLive(){
  clearTimeout(srchTimer);
  srchTimer=setTimeout(()=>{
    const q=document.getElementById('sq').value.trim();
    if(q.length>=2)doSrch();
    else if(!q)clearSrch();
  },300);
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



