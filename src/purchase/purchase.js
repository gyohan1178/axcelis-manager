// ─── 구매관리 ───


function openUpload(){
  // 초기화
  upRows=[];upHeaders=[];
  document.getElementById('up-file').value='';
  document.getElementById('up-s1').classList.add('on');
  document.getElementById('up-s2').classList.remove('on');
  document.getElementById('up-s3').classList.remove('on');
  document.getElementById('up-next').style.display='none';
  document.getElementById('up-dropzone').classList.remove('drag');
  document.getElementById('m-upload').classList.add('on');
}


function upDrag(e,on){e.preventDefault();document.getElementById('up-dropzone').classList[on?'add':'remove']('drag');}


function upDrop(e){e.preventDefault();upDrag(e,false);if(e.dataTransfer.files[0])upLoad(e.dataTransfer.files[0]);}


function upLoad(file){
  if(!file)return;
  const ext=file.name.split('.').pop().toLowerCase();
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      let wb;
      if(ext==='csv'){
        wb=XLSX.read(e.target.result,{type:'string'});
      } else {
        wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      }
      // DB 시트 우선 ('DB', 'db', '품목' 포함 시트), 없으면 첫 번째
      const dbSheetName = wb.SheetNames.find(n=>n.trim()==='DB') ||
                          wb.SheetNames.find(n=>n.trim().toUpperCase()==='DB') ||
                          wb.SheetNames.find(n=>n.includes('품목')) ||
                          wb.SheetNames[0];
      const ws=wb.Sheets[dbSheetName];
      const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      if(raw.length<2){alert('데이터가 없습니다 (헤더 + 1행 이상 필요)');return;}
      upHeaders=raw[0].map(String);
      upRows=raw.slice(1).filter(r=>r.some(c=>c!==''));

      // BOM 시트 자동 파싱 (시트명에 'BOM' 포함 또는 2번째 시트)
      const bomSheetName=wb.SheetNames.find(n=>n.toUpperCase().includes('BOM'))||
                         (wb.SheetNames.length>1?wb.SheetNames[1]:null);
      let bomInfo='';
      if(bomSheetName&&bomSheetName!==wb.SheetNames[0]){
        const bomWs=wb.Sheets[bomSheetName];
        const bomRaw=XLSX.utils.sheet_to_json(bomWs,{header:1,defval:''});
        if(bomRaw.length>1){
          // 헤더 자동 감지: 상위품번, 하위품번, 수량
          const hdr=bomRaw[0].map(c=>String(c).toLowerCase());
          const pi=hdr.findIndex(h=>h.includes('상위')||h.includes('parent')||h==='pn'||h.includes('조립'));
          const ci=hdr.findIndex(h=>h.includes('하위')||h.includes('child')||h.includes('부품')||(h.includes('pn')&&h!==hdr[pi]));
          const qi=hdr.findIndex(h=>h.includes('수량')||h.includes('qty')||h.includes('q'));
          if(pi>=0&&ci>=0){
            const newBOM={};
            bomRaw.slice(1).forEach(r=>{
              const parent=String(r[pi]||'').trim();
              const child=String(r[ci]||'').trim();
              const qty=parseFloat(r[qi>=0?qi:2])||1;
              if(parent&&child){
                if(!newBOM[parent])newBOM[parent]=[];
                newBOM[parent].push({pn:child,qty});
              }
            });
            const bomCount=Object.keys(newBOM).length;
            if(bomCount>0){
              Object.assign(BOM,newBOM);
              sv(K.BOM,BOM);
              bomInfo=` · BOM ${bomCount}개 상위품번 로드됨`;
            }
          }
        }
      }

      document.getElementById('up-file-info').textContent=
        `✅ ${file.name} — 시트: ${dbSheetName} / 헤더 ${upHeaders.length}개 / 데이터 ${upRows.length}행${bomInfo}`;
      buildMapGrid();
      document.getElementById('up-s1').classList.remove('on');
      document.getElementById('up-s2').classList.add('on');
      document.getElementById('up-next').style.display='';
    }catch(err){alert('파일 파싱 오류: '+err.message);}
  };
  ext==='csv'?reader.readAsText(file,'utf-8'):reader.readAsArrayBuffer(file);
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


function renderDB(){
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


function clearPriceHist(){if(!confirm('단가변동 이력을 모두 삭제할까요?'))return;PRICE_HIST=[];savePriceHist([]);renderPriceHist();alert('삭제 완료');}


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


function initChk(){
  syncDBtoCHK(); // DB 기준 자동 연동
  document.getElementById('blk-dt').value=new Date().toISOString().split('T')[0];
  renderChkFull();
  loadBulkItems();
  if(chkViewMode==='wire') renderWire();
}


function loadBulkItems(){
  const gradeF=document.getElementById('blk-grade')?.value||'';
  const overF=document.getElementById('blk-over')?.value||'';
  // 지원본부 품목만
  let items=CHK.filter(r=>{
    const dbr=DB.find(x=>x.pn===r.pn)||{};
    const dept=dbr.dept||r.dept||'지원본부';
    if(dept==='하네스') return false;
    if(gradeF&&r.grade!==gradeF) return false;
    if(overF==='1'&&!isOverdue(r)) return false;
    return true;
  });
  document.getElementById('bulk-cnt-badge').textContent=items.length+'건';
  document.getElementById('bulk-summary').textContent=`총 ${items.length}건 표시 중`;
  document.getElementById('bulk-tbody').innerHTML=items.map((r,i)=>{
    const sf=r.sf>0?r.sf:(DB.find(x=>x.pn===r.pn)||{sf:0}).sf||0;
    const days=daysSinceLast(r);
    const safeId=r.pn.replace(/\W/g,'_');
    return `<tr id="brow-${safeId}">
      <td style="text-align:center"><input type="checkbox" class="lt-chk" data-pn="${r.pn}" onchange="ltSelChange()" style="accent-color:var(--teal);width:13px;height:13px"></td>
    <td style="font-family:var(--mono);font-size:11px;color:var(--tel)">${r.pn}</td>
      <td style="color:var(--text)" title="${r.desc||''}">${r.desc||'—'}</td>
      <td style="text-align:center"><span class="bd" style="font-size:9px;background:${GRADE_COLOR[r.grade]||'var(--bg4)'}22;color:${GRADE_COLOR[r.grade]||'var(--text3)'}">${r.grade||'—'}</span></td>
      <td style="font-family:var(--mono);text-align:right;color:var(--text3)">${sf||'—'}</td>
      <td><input type="number" min="0" id="bq-${safeId}" placeholder="수량"
        ${r.lastQty!==undefined?`value="${r.lastQty}"`:''}
        class="${r.lastQty!==undefined&&sf>0?(r.lastQty>=sf?'b-ok':'b-low'):''}"
        oninput="bulkInputChange('${r.pn}',this,${sf})"></td>
      <td><input class="b-note" id="bn-${safeId}" placeholder="특이사항"></td>
      <td style="font-size:10px;color:var(--text3)">${r.lastDate||'없음'}${days!==null?`<br><span style="color:${isOverdue(r)?'var(--red)':'var(--text3)'}">${days}일전</span>`:''}</td>
    </tr>`;
  }).join('');
}


function initBOM(){
  renderBOM();
  updateBOMStat();
}


function bomUpDrag(e,on){e.preventDefault();document.getElementById('bom-up-dropzone').classList[on?'add':'remove']('drag');}


function bomUpDrop(e){e.preventDefault();bomUpDrag(e,false);if(e.dataTransfer.files[0])bomUpLoad(e.dataTransfer.files[0]);}


function bomUpLoad(file){
  if(!file)return;
  const ext=file.name.split('.').pop().toLowerCase();
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      let wb;
      if(ext==='csv') wb=XLSX.read(e.target.result,{type:'string'});
      else wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const sheetName=wb.SheetNames.find(n=>n.toUpperCase().includes('BOM'))||wb.SheetNames[0];
      const ws=wb.Sheets[sheetName];
      // data_only 효과 — 수식 셀은 캐시값 사용
      const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true});

      // 헤더 행 탐색 (첫 번째 비어있지 않은 행)
      let hdrIdx=0;
      for(let i=0;i<Math.min(raw.length,5);i++){
        if(raw[i]&&raw[i].some(c=>c!=null&&String(c).trim()!=='')){{hdrIdx=i;break;}}
      }
      const hdr=raw[hdrIdx].map(c=>String(c||'').toLowerCase().trim());

      // 컬럼 감지 — 이 파일 포맷: 상위PN, NO, LEVEL, PN, Desc, MFG, MFG PN, QTY, 실수량, 관리대상, UNIT, 대체품여부, Note, LOCATION
      const fi=(keywords)=>hdr.findIndex(h=>keywords.some(k=>h.includes(k)));
      const pi  = fi(['상위pn','상위 pn','parent','상위품번','상위']);
      const dci = fi(['품명','description','desc','item desc','itemdesc']);  // 하위품명
      const noi = fi(['no','번호']);
      const lvi = fi(['level','lv','레벨']);
      const ci  = fi(['pn','하위pn','하위','child','부품번']);   // 상위PN보다 뒤에 있는 PN
      // ci가 pi와 같으면 다음 PN 컬럼 탐색
      const ciReal = (ci>pi) ? ci : hdr.findIndex((h,idx)=>idx>pi&&(h==='pn'||h.includes('하위')||h.includes('child')));
      const qi  = fi(['qty','수량']);
      const aqi = fi(['실수량','actual','aqty']);
      const ui  = fi(['unit','단위']);
      const alti= fi(['대체품','alt','alternate']);
      const ni  = fi(['note','비고','remark']);
      const loci= fi(['location','loc','보관','위치']);

      const pCol=pi>=0?pi:0;
      const cCol=ciReal>=0?ciReal:(ci>=0?ci:3);
      const qCol=qi>=0?qi:7;
      const aqCol=aqi>=0?aqi:-1;
      const lvCol=lvi>=0?lvi:2;
      const noCol=noi>=0?noi:1;
      const uCol=ui>=0?ui:10;
      const altCol=alti>=0?alti:-1;
      const nCol=ni>=0?ni:-1;
      const locCol=loci>=0?loci:-1;

      const toStr=v=>{
        if(v==null) return '';
        if(typeof v==='number') return Number.isInteger(v)?String(v):String(Math.round(v));
        return String(v).trim();
      };
      const toNum=(v,def=1)=>{const n=parseFloat(v);return isNaN(n)?def:n;};

      let added=0, updated=0, skipped=0;
      for(let i=hdrIdx+1;i<raw.length;i++){
        const row=raw[i];
        if(!row||row.every(c=>c==null)) continue;
        const parent=toStr(row[pCol]);
        const child =toStr(row[cCol]);
        if(!parent||!child) continue;
        const no   =row[noCol]!=null?parseInt(row[noCol])||i-hdrIdx:i-hdrIdx;
        const lv   =row[lvCol]!=null?parseInt(row[lvCol])||1:1;
        const qty  =toNum(row[qCol]);
        const aqty =aqCol>=0&&row[aqCol]!=null?toNum(row[aqCol],qty):qty;
        const unit =uCol>=0&&row[uCol]?toStr(row[uCol]):'EA';
        const isAlt=altCol>=0?toStr(row[altCol]):'';
        const note =nCol>=0?toStr(row[nCol]):'';

        if(!BOM[parent]) BOM[parent]=[];
        // 같은 상위+하위 조합: NO 기준 갱신, 없으면 추가
        const idx=BOM[parent].findIndex(c=>c.pn===child&&c.no===no);
        const desc = dci>=0?toStr(row[dci]):'';
        const entry={no,lv,pn:child,desc,qty,aqty,unit};
        if(isAlt) entry.isAlt=isAlt;
        if(note)  entry.note=note;
        if(idx>=0){BOM[parent][idx]=entry;updated++;}
        else{BOM[parent].push(entry);added++;}
      }
      sv(K.BOM,BOM);
      if(CURRENT_TOKEN) {
        apiPost({ action:'setSheet', sheet:'bom_data', data: bomToRows(BOM) }).catch(function(){});
      }
      const resEl=document.getElementById('bom-up-result');
      resEl.textContent=`✅ 완료 — 신규 ${added}건 추가, ${updated}건 갱신, ${skipped}건 건너뜀 (시트: ${sheetName})`;
      resEl.style.display='';
      renderBOM(); updateBOMStat();
      if(bomSelParent) renderBOMChildren();
    }catch(err){alert('파싱 오류: '+err.message+'\n'+err.stack);}
  };
  ext==='csv'?reader.readAsText(file,'utf-8'):reader.readAsArrayBuffer(file);
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


function renderPurchaseAlert() {
  var today = new Date(); today.setHours(0,0,0,0);
  var todayStr = today.toISOString().slice(0,10);
  var q = (document.getElementById('pal-q') || {}).value;
  q = q ? q.toLowerCase().trim() : '';

  // 전체 미입고 (발주일 있고 입고일 없는 것)
  var allPending = RECV.filter(function(r) {
    return !r.recv_date && r.order_date;
  });

  // 지연: req_date < 오늘 & 미입고
  var late = allPending.filter(function(r) {
    return r.req_date && r.req_date < todayStr;
  });

  // 임박: 오늘 <= req_date <= 오늘+7 & 미입고
  var soonDate = new Date(today); soonDate.setDate(soonDate.getDate() + 7);
  var soonStr = soonDate.toISOString().slice(0,10);
  var soon = allPending.filter(function(r) {
    return r.req_date && r.req_date >= todayStr && r.req_date <= soonStr;
  });

  // 요약 카드 업데이트
  document.getElementById('pal-n1').textContent = late.length;
  document.getElementById('pal-n2').textContent = soon.length;
  document.getElementById('pal-n3').textContent = allPending.length;

  // 필터 적용
  var base = _palFilter === 'late' ? late : _palFilter === 'soon' ? soon : allPending;

  // 검색 필터
  if(q) {
    base = base.filter(function(r) {
      var dbr = DB.find(function(x){ return x.pn === r.pn; }) || {};
      return (r.pn||'').toLowerCase().includes(q) ||
             (dbr.d||'').toLowerCase().includes(q) ||
             (r.vendor||'').toLowerCase().includes(q) ||
             (dbr.by||'').toLowerCase().includes(q);
    });
  }

  // 지연일 내림차순 정렬
  base = base.slice().sort(function(a, b) {
    var da = a.req_date ? (new Date(a.req_date) - today) : 99999999;
    var db2 = b.req_date ? (new Date(b.req_date) - today) : 99999999;
    return da - db2; // 지연 많은 것 위로 (음수가 작음)
  });

  var tbody = document.getElementById('pal-tbody');
  var countEl = document.getElementById('pal-count');
  if(!tbody) return;

  document.getElementById('pal-updated').textContent =
    '기준: ' + new Date().toLocaleString('ko-KR');

  if(!RECV || !RECV.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="padding:30px;text-align:center;color:var(--text3)">매입이력을 업로드하면 알람이 표시됩니다</td></tr>';
    if(countEl) countEl.textContent = '';
    return;
  }

  if(!base.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="padding:30px;text-align:center;color:var(--grn)">✅ 해당 없음</td></tr>';
    if(countEl) countEl.textContent = '';
    return;
  }

  tbody.innerHTML = base.map(function(r) {
    var dbr = DB.find(function(x){ return x.pn === r.pn; }) || {};
    var today2 = new Date(); today2.setHours(0,0,0,0);

    // 지연일 계산
    var diffDays = null;
    var statusHtml = '';
    if(r.req_date) {
      var reqD = new Date(r.req_date);
      diffDays = Math.floor((today2 - reqD) / 86400000);
      if(diffDays > 0) {
        statusHtml = '<span style="background:rgba(255,85,85,.15);color:var(--red);padding:1px 7px;border-radius:4px;font-size:10px;font-weight:700">지연</span>';
      } else if(diffDays >= -7) {
        statusHtml = '<span style="background:rgba(255,181,71,.15);color:var(--amber);padding:1px 7px;border-radius:4px;font-size:10px;font-weight:700">임박</span>';
      } else {
        statusHtml = '<span style="background:rgba(255,255,255,.06);color:var(--text3);padding:1px 7px;border-radius:4px;font-size:10px;font-weight:700">진행중</span>';
      }
    }

    var delayHtml = diffDays === null ? '—' :
      diffDays > 0
        ? '<span style="color:var(--red);font-weight:700">+' + diffDays + '일</span>'
        : diffDays === 0
          ? '<span style="color:var(--amber);font-weight:700">오늘</span>'
          : '<span style="color:var(--text3)">' + Math.abs(diffDays) + '일 후</span>';

    return '<tr style="border-bottom:1px solid var(--border)">' +
      '<td style="padding:7px 10px;font-family:var(--mono);font-size:11px;color:var(--teal);overflow:hidden;text-overflow:ellipsis">' + (r.pn||'—') + '</td>' +
      '<td style="padding:7px 10px;font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis">' + (dbr.mg||'—') + '</td>' +
      '<td style="padding:7px 10px;font-family:var(--mono);font-size:11px;color:var(--text2);overflow:hidden;text-overflow:ellipsis">' + (dbr.mp||'—') + '</td>' +
      '<td style="padding:7px 10px;font-size:11px;color:var(--text2);overflow:hidden;text-overflow:ellipsis">' + (r.vendor||dbr.by||'—') + '</td>' +
      '<td style="padding:7px 10px;font-family:var(--mono);font-size:11px;color:var(--text3)">' + fmtShortDate(r.order_date) + '</td>' +
      '<td style="padding:7px 10px;font-family:var(--mono);font-size:11px;color:var(--amber)">' + fmtShortDate(r.req_date) + '</td>' +
      '<td style="padding:7px 10px;font-family:var(--mono);font-size:11px;text-align:right">' + ((+r.qty)||0).toLocaleString() + '</td>' +
      '<td style="padding:7px 10px;text-align:center">' + statusHtml + '</td>' +
      '<td style="padding:7px 10px;text-align:center">' + delayHtml + '</td>' +
      '</tr>';
  }).join('');

  if(countEl) countEl.textContent = base.length + '건';

  // 탭 뱃지 업데이트
  var bdg = document.getElementById('b-palert');
  if(bdg) {
    bdg.textContent = late.length > 0 ? late.length : '';
    bdg.style.display = late.length > 0 ? '' : 'none';
  }
}


function renderRecvDash() {
  var exrate = parseFloat(document.getElementById('rdash-exrate')?.value) || 1380;
  var recvAll = ld(K.RECV, []);
  var recvDone = recvAll.filter(function(r){ return r.recv_date && r.recv_date.trim(); });
  var recvPend = recvAll.filter(function(r){ return !r.recv_date || !r.recv_date.trim(); });

  // 연도 수집
  var yearSet = new Set();
  recvDone.forEach(function(r){ var y=(r.recv_date||'').substring(0,4); if(/^\d{4}$/.test(y)) yearSet.add(y); });
  recvPend.forEach(function(r){ var y=(r.order_date||'').substring(0,4); if(/^\d{4}$/.test(y)) yearSet.add(y); });
  if(!yearSet.size) yearSet.add(String(rdashYear));
  var years = Array.from(yearSet).sort(function(a,b){return b-a;});
  if(!years.includes(String(rdashYear))) rdashYear = parseInt(years[0]);

  // 연도 탭
  var ytEl = document.getElementById('rdash-year-tabs');
  if(ytEl) ytEl.innerHTML = years.map(function(y){
    var on = y==rdashYear;
    return '<button onclick="setRdashYear('+y+')" style="padding:5px 14px;border-radius:6px;border:1px solid '+(on?'var(--accent)':'var(--border)')+';background:'+(on?'var(--accent)':'var(--bg3)')+';color:'+(on?'#fff':'var(--text3)')+';font-size:12px;cursor:pointer">'+y+'년</button>';
  }).join('');

  var yrDone = recvDone.filter(function(r){ return (r.recv_date||'').startsWith(String(rdashYear)); });
  var yrPend = recvPend.filter(function(r){ return ((r.req_date||r.order_date||'')).startsWith(String(rdashYear)); });

  // 월별 집계
  var fk = function(n){ if(!n||isNaN(n))return '—'; if(Math.abs(n)>=100000000) return (n/100000000).toFixed(1)+'억'; if(Math.abs(n)>=10000) return Math.round(n/10000)+'만'; return n.toLocaleString(); };
  var months = [];
  for(var mn=1;mn<=12;mn++){
    var mStr = String(rdashYear)+'-'+String(mn).padStart(2,'0');
    var mDone = yrDone.filter(function(r){ return (r.recv_date||'').startsWith(mStr); });
    var mPend = yrPend.filter(function(r){ return ((r.req_date||r.order_date||'')).startsWith(mStr); });
    var doneAmt = mDone.reduce(function(s,r){ return s+(parseFloat(r.total)||0); },0);
    var pendAmt = mPend.reduce(function(s,r){ return s+(parseFloat(r.total)||0); },0);
    months.push({ label:mn+'월', mStr:mStr, doneAmt:doneAmt, pendAmt:pendAmt, doneCnt:mDone.length, pendCnt:mPend.length });
  }

  var totDone = months.reduce(function(s,m){return s+m.doneAmt;},0);
  var totPend = months.reduce(function(s,m){return s+m.pendAmt;},0);
  var el_done  = document.getElementById('rdash-done');  if(el_done)  el_done.textContent  = fk(totDone);
  var el_pend  = document.getElementById('rdash-pend');  if(el_pend)  el_pend.textContent  = fk(totPend);
  var el_total = document.getElementById('rdash-total'); if(el_total) el_total.textContent = fk(totDone+totPend);
  var el_cnt   = document.getElementById('rdash-cnt');   if(el_cnt)   el_cnt.textContent   = (yrDone.length+yrPend.length).toLocaleString()+'건';

  // 차트
  var chartEl = document.getElementById('rdash-chart');
  var hasData = months.some(function(m){return m.doneAmt>0||m.pendAmt>0;});
  if(!hasData||!chartEl){ if(chartEl) chartEl.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3)">데이터 없음</div>'; }
  else {
    var CH=160, YW=58, BW=14, BG=4, AW=46, BOT=24, GRID=4;
    var maxV=Math.max.apply(null,months.map(function(m){return Math.max(m.doneAmt,m.pendAmt);}).concat([1]));
    var rawStep=maxV/GRID, mag=Math.pow(10,Math.floor(Math.log10(rawStep)));
    var step=Math.ceil(rawStep/mag)*mag, yMax=step*GRID;
    var gridLbls=[]; for(var gi=0;gi<=GRID;gi++){var v=gi*step;gridLbls.push(v===0?'0':v>=100000000?(v/100000000).toFixed(1)+'억':v>=10000?Math.round(v/10000)+'만':v.toLocaleString());}
    var W=YW+months.length*AW+8, bars='', xls='', grid='';
    for(var gi2=0;gi2<=GRID;gi2++){var y2=CH-(gi2/GRID)*CH;grid+='<line x1="'+YW+'" y1="'+y2+'" x2="'+W+'" y2="'+y2+'" stroke="#2e3448" stroke-width="'+(gi2===0?1.5:0.5)+'" stroke-dasharray="'+(gi2===0?'none':'4,3')+'"/><text x="'+(YW-6)+'" y="'+(y2+4)+'" text-anchor="end" font-size="9" fill="#5a6180">'+gridLbls[gi2]+'</text>';}
    months.forEach(function(m,i){
      var cx=YW+i*AW+AW/2;
      xls+='<text x="'+cx+'" y="'+(CH+18)+'" text-anchor="middle" font-size="9" fill="#5a6180">'+m.label+'</text>';
      var xd=YW+i*AW+(AW-BW*2-BG)/2;
      var dH=m.doneAmt>0?Math.max(2,(m.doneAmt/yMax)*CH):0;
      var pH=m.pendAmt>0?Math.max(2,(m.pendAmt/yMax)*CH):0;
      if(dH>0) bars+='<rect x="'+xd+'" y="'+(CH-dH)+'" width="'+BW+'" height="'+dH+'" rx="2" fill="#4f7cff" opacity="0.9"><title>'+m.label+' 실제매입: '+m.doneAmt.toLocaleString()+'원</title></rect>';
      if(pH>0) bars+='<rect x="'+(xd+BW+BG)+'" y="'+(CH-pH)+'" width="'+BW+'" height="'+pH+'" rx="2" fill="#a78bfa" opacity="0.85"><title>'+m.label+' 예상매입: '+m.pendAmt.toLocaleString()+'원</title></rect>';
    });
    chartEl.innerHTML='<div style="overflow-x:auto"><svg width="'+Math.max(W,500)+'" height="'+(CH+BOT+4)+'" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible"><g transform="translate(0,4)">'+grid+bars+xls+'</g></svg></div>';
  }

  // 테이블
  var active = months.filter(function(m){return m.doneCnt>0||m.pendCnt>0;});
  var cntEl = document.getElementById('rdash-tbl-cnt'); if(cntEl) cntEl.textContent=active.length+'개월';
  var totR=0,totP=0,totRC=0,totPC=0;
  months.forEach(function(m){totR+=m.doneAmt;totP+=m.pendAmt;totRC+=m.doneCnt;totPC+=m.pendCnt;});
  var rows = active.map(function(m){
    return '<tr><td>'+m.label+'</td><td style="text-align:right;font-family:var(--mono);color:var(--accent)">'+(m.doneAmt>0?fk(m.doneAmt):'—')+'</td><td style="text-align:right;font-family:var(--mono);color:var(--purple)">'+(m.pendAmt>0?fk(m.pendAmt):'—')+'</td><td style="text-align:right;font-family:var(--mono);color:var(--tel)">'+(m.doneAmt+m.pendAmt>0?fk(m.doneAmt+m.pendAmt):'—')+'</td><td style="text-align:right">'+(m.doneCnt||'—')+'</td><td style="text-align:right">'+(m.pendCnt||'—')+'</td></tr>';
  });
  rows.push('<tr class="total-row"><td>합계</td><td style="text-align:right;font-family:var(--mono);color:var(--accent)">'+fk(totR)+'</td><td style="text-align:right;font-family:var(--mono);color:var(--purple)">'+fk(totP)+'</td><td style="text-align:right;font-family:var(--mono);color:var(--tel)">'+fk(totR+totP)+'</td><td style="text-align:right">'+totRC+'</td><td style="text-align:right">'+totPC+'</td></tr>');
  var tbody = document.getElementById('rdash-tbody'); if(tbody) tbody.innerHTML=rows.join('');
}


function initSrch2(){
  var dests=[...new Set(OUT.map(function(r){return r.dest;}).filter(Boolean))];
  var dl3=document.getElementById('dl3');
  if(dl3) dl3.innerHTML=dests.map(function(v){return '<option value="'+v+'">';}).join('');
  var dt2=document.getElementById('req-dt-2');
  if(dt2 && !dt2.value) dt2.value=new Date().toISOString().split('T')[0];
  renderReqPanel2();
}

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
