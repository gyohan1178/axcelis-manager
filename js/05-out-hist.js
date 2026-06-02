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

// ══ 테이블 컬럼 리사이즈 ══
var _rCol=null, _rStartX=0, _rStartW=0;
function initColResize(tableId){
  var tblEl = tableId ? document.getElementById(tableId) : document.getElementById('req-table');
  if(!tblEl) return;
  var ths = tblEl.querySelectorAll('thead th');
  ths.forEach(function(th){
    th.querySelectorAll('.col-resizer').forEach(function(r){ r.remove(); });
    var div = document.createElement('div');
    div.className = 'col-resizer';
    th.appendChild(div);
    div.addEventListener('mousedown', function(e){
      e.preventDefault(); e.stopPropagation();
      _rCol = th; _rStartX = e.clientX; _rStartW = th.offsetWidth;
      div.classList.add('resizing');
      document.addEventListener('mousemove', _onResizerMove);
      document.addEventListener('mouseup', _onResizerUp);
    });
  });
  if(!tableId && !window._reqRenderHooked){
    window._reqRenderHooked = true;
    var origRender = window.renderReqTable;
    window.renderReqTable = function(){ if(origRender) origRender.call(this); setTimeout(function(){initColResize();},50); };
    var origCalc = window.calcReq;
    window.calcReq = function(){ if(origCalc) origCalc.call(this); setTimeout(function(){initColResize();},100); };
  }
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
// ══ 구매관리 복구 함수 ══
// [복구] openEditRecv
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

// [복구] autoFillRecvEdit
function autoFillRecvEdit(){
  const pn=document.getElementById('re-pn').value.trim();
  const dbr=DB.find(x=>x.pn===pn)||{};
  document.getElementById('re-desc').value=dbr.d||'';
  document.getElementById('re-mfg').value=dbr.mp||'';
}

// [복구] calcRecvEditTotal
function calcRecvEditTotal(){
  const qty=parseFloat(document.getElementById('re-qty').value)||0;
  const up=parseFloat(document.getElementById('re-up').value)||0;
  if(qty&&up) document.getElementById('re-tot').value=qty*up;
}

// [복구] saveRecvEdit
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

// [복구] bulkSetRecvDate
function bulkSetRecvDate(){
  document.getElementById('bulk-recv-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('m-recv-bulk-recv').classList.add('on');
}

// [복구] confirmBulkRecv
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

// [복구] bulkEditRecv
function bulkEditRecv(){
  const checked=[...document.querySelectorAll('.row-chk:checked')];
  if(checked.length!==1){alert('수정은 1건만 선택해주세요');return;}
  openEditRecv(+checked[0].dataset.idx);
}

// [복구] openRecvUpload
function openRecvUpload(){
  document.getElementById('recv-up-file').value='';
  document.getElementById('recv-up-result').style.display='none';
  document.getElementById('recv-up-dropzone').classList.remove('drag');
  document.getElementById('m-recv-upload').classList.add('on');
}

// [복구] recvUpDrag
function recvUpDrag(e,on){e.preventDefault();document.getElementById('recv-up-dropzone').classList[on?'add':'remove']('drag');}

// [복구] recvUpDrop
function recvUpDrop(e){e.preventDefault();recvUpDrag(e,false);if(e.dataTransfer.files[0])recvUpLoad(e.dataTransfer.files[0]);}

// [복구] resetRECV
function resetRECV(){
  if(!confirm('⚠️ 매입 이력 전체를 삭제하시겠습니까?\n\n등록된 모든 매입 기록이 삭제됩니다.'))return;
  RECV=[];sv(K.RECV,RECV);renderRecv();updateStat();
  alert('✅ 매입 이력이 초기화되었습니다.');
}

// [복구] resetOUT
function resetOUT(){
  if(!confirm('⚠️ 자재 불출 이력 전체를 삭제하시겠습니까?\n\n등록된 모든 불출 기록이 삭제됩니다.'))return;
  OUT=[];sv(K.OUT,OUT);
    if(typeof CURRENT_TOKEN!=='undefined'&&CURRENT_TOKEN){
      apiPost({action:'setSheet',sheet:'out_items',data:OUT}).catch(function(){});
    }
    renderOut();updateStat();
  alert('✅ 자재 불출 이력이 초기화되었습니다.');
}

// ══ PO 관리 JS ══

// ══ 상태 ══
let PO = [];
let sortKey = 'promise', sortDir = 1;
const DATE_KEYS = new Set(['promise','required','placed','chuldo_date','issue_date']);
let filters = new Set(['all']);
let chgFilter = new Set(['all']);
let trkFilter = new Set(['all']);
let poPage = 1;
const PER = 25;

// ══ localStorage 키 ══
const LS_HIST = 'po_history';   // [{date, data[], changes[]}]
const LS_TRACK = 'po_tracking'; // {item: [{date, trackNum, order}]}
const LS_DELIVERED = 'po_delivered'; // [{...poFields, deliveredDate, trackNum, unitPrice, note, _id}]

function getHist() { try { return JSON.parse(localStorage.getItem(LS_HIST)||'[]'); } catch{return [];} }
function getTrack() { try { return JSON.parse(localStorage.getItem(LS_TRACK)||'{}'); } catch{return {};} }
function saveHist(h) {
  // localStorage: data 제외하고 메타(날짜/변경)만 저장 → 용량 초과 방지
  var slim = h.slice(0,10).map(function(entry){
    return {date:entry.date, changes:entry.changes||[]};
  });
  try { localStorage.setItem(LS_HIST, JSON.stringify(slim)); } catch(e) {
    console.warn('po_history 메타 저장 실패:', e.message);
  }
  // PO 본체는 po_data 키에 최근 500건만 로컬 캐시
  if(h.length > 0 && h[0].data && h[0].data.length > 0) {
    try { localStorage.setItem('po_data', JSON.stringify(h[0].data.slice(0,500))); } catch(e) {
      console.warn('po_data 로컬 저장 실패:', e.message);
    }
  }
  // 서버 동기화
  if(CURRENT_TOKEN) {
    var histRows = h.map(function(entry){
      return {upload_date:entry.date, changes_count:(entry.changes||[]).length};
    });
    apiPost({action:'setSheet', sheet:'po_history', data:histRows}).catch(function(){});
    if(h.length > 0 && h[0].data && h[0].data.length > 0) {
      apiPost({action:'setSheet', sheet:'po_data', data:h[0].data}).catch(function(){});
    }
  }
}
function saveTrack(t) { localStorage.setItem(LS_TRACK, JSON.stringify(t)); }
function getDelivered() { try { return JSON.parse(localStorage.getItem(LS_DELIVERED)||'[]'); } catch{return [];} }
function saveDelivered(d) {
  // Supabase에 전체 저장
  if(typeof CURRENT_TOKEN !== 'undefined' && CURRENT_TOKEN) {
    apiPost({action:'setSheet', sheet:'po_delivered', data:d}).catch(function(){});
  }
  // 로컬 캐시 (용량 허용 범위 내 최대한 저장)
  var limit = d.length;
  while(limit > 0) {
    try {
      localStorage.setItem(LS_DELIVERED, JSON.stringify(d.slice(0, limit)));
      break;
    } catch(e) { limit = Math.floor(limit * 0.8); }
  }
}
function poTab(t) {
  document.querySelectorAll('#sect-po .page').forEach(function(el){
    el.style.display = 'none';
    el.classList.remove('active');
  });
  var target = document.getElementById('page-'+t);
  if(target){ target.style.display = 'block'; target.classList.add('active'); }
  var mc=document.getElementById('main-content'); if(mc) mc.scrollTop=0;
  document.querySelectorAll('#po-inner-tabs .po-itab').forEach(function(el){
    el.classList.toggle('active', el.dataset.tab===t);
  });
  if(t==='sales') renderSalesDash();
  if(t==='delivered') renderDelivered();
  if(t==='ordtrend') renderOrdTrend();
  if(t==='tracking') renderTracking();
  var tblMap={po:'po-tbl',delivered:'dv-tbl'};
  if(tblMap[t]) { initColResize(tblMap[t]); setTimeout(function(){ initColResize(tblMap[t]); },300); }
}

// ══ 드래그&드롭 ══
document.addEventListener('dragover', e=>{e.preventDefault(); document.getElementById('drop-overlay').classList.add('show');});
document.addEventListener('dragleave', e=>{if(!e.relatedTarget) document.getElementById('drop-overlay').classList.remove('show');});
document.addEventListener('drop', e=>{
  e.preventDefault(); document.getElementById('drop-overlay').classList.remove('show');
  const f = e.dataTransfer.files[0];
  if(f) processFile(f);
});

// ══ 파일 업로드 ══



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

// ══ 분석 탭 ══
var _azFilter = 'all';
var _azResFilter = 'all';
var _azSelected = {};   // {item|order: true}
var _azResults  = [];   // 분석 결과 캐시

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

function renderAzPOList() {
  var q = ((document.getElementById('az-q')||{}).value||'').toLowerCase().trim();
  var list = document.getElementById('az-po-list'); if(!list) return;

  // Open PO: shipped 아닌 것, Promise Date 순 정렬
  var rows = (PO||[]).filter(function(r) {
    if(r.shipped) return false;
    if(_azFilter !== 'all' && r.ccn !== _azFilter) return false;
    if(q && !(r.item||'').toLowerCase().includes(q) && !(r.desc||'').toLowerCase().includes(q)) return false;
    return true;
  }).slice().sort(function(a,b){
    return (a.promise||'9999').localeCompare(b.promise||'9999');
  });

  if(!rows.length) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3);font-size:11px">PO 데이터 없음</div>';
    return;
  }

  list.innerHTML = rows.map(function(r) {
    var key = r.item + '|' + r.order;
    var keyAttr = key.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
    var sel = _azSelected[key];
    var hasBOM = BOM && BOM[r.item] && BOM[r.item].length > 0;
    // REV 체크
    var revOk = true;
    if(hasBOM && r.srev) {
      revOk = BOM[r.item].some(function(c){ return !c.pRev || c.pRev === r.srev; });
    }
    return '<div class="az-card' + (sel?' selected':'') + '" data-azkey="' + keyAttr + '" onclick="azToggleEl(this)">' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
        '<input type="checkbox"' + (sel?' checked':'') + ' style="accent-color:var(--teal);flex-shrink:0" onclick="event.stopPropagation();azToggleEl(this.closest(\'.az-card\')">' +
        '<span style="font-family:var(--mono);font-size:11px;color:var(--teal);flex:1;overflow:hidden;text-overflow:ellipsis">' + r.item + '</span>' +
        '<span class="az-tag ' + (r.ccn==='B'?'warn':'err') + '">' + (r.ccn||'?') + '</span>' +
        (!hasBOM ? '<span class="az-tag gray">BOM없음</span>' : '') +
        (!revOk  ? '<span class="az-tag warn">REV불일치</span>' : '') +
      '</div>' +
      '<div style="font-size:10px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;margin-left:18px">' + (r.desc||'—') + '</div>' +
      '<div style="display:flex;gap:10px;margin-top:4px;margin-left:18px;font-size:10px;color:var(--text3);white-space:nowrap;flex-wrap:nowrap;overflow:hidden">' +
        '<span>수량: <b style="color:var(--text)">' + (r.qty||0).toLocaleString() + '</b></span>' +
        '<span>Promise: <b style="color:var(--amber)">' + fmtShortDate(r.promise||'') + '</b></span>' +
        '<span>오더: ' + (r.order||'—') + '</span>' +
      '</div>' +
    '</div>';
  }).join('');

  document.getElementById('az-sel-cnt').textContent = Object.keys(_azSelected).length;
}

