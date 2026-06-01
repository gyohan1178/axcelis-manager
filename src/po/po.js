// ─── PO 관리 ───


function loadAllFromServer() {
  if(!CURRENT_TOKEN) { setSyncStatus('error', '토큰 없음'); return; }

  setSyncStatus('syncing', '서버 연결 중...');

  // ── DB 페이지네이션 로드 (1000행씩, 첫 배치 즉시 표시) ──
  (function(){
    var _dbBuf = [];
    function _loadDBPage(offset){
      apiGet({ action:'getSheet', sheet:'db_items', limit:1000, offset:offset })
        .then(function(r){
          if(!r || !r.ok) return;
          var rows = r.data || [];
          if(rows.length) _dbBuf = _dbBuf.concat(gSheetToDB(rows));
          var hint = document.getElementById('sq-hint');
          if(r.hasMore) {
            if(hint) hint.textContent = 'DB 로드 중... (' + _dbBuf.length + '건)';
            setTimeout(function(){ _loadDBPage(offset + 1000); }, 200);
          } else {
            // 완료 후에만 DB 교체 (로드 중 0건 방지)
            var seen = {};
            var newDB = _dbBuf.filter(function(item){
              var k = String(item.pn||'').trim();
              if(!k || seen[k]) return false;
              seen[k] = true; return true;
            });
            if(newDB.length > 0) {
              DB = newDB;
              try { localStorage.setItem('jst_db2', JSON.stringify(DB)); } catch(e){}
              renderDB(); updateStat();
              setSyncStatus('ok', 'DB ' + DB.length + '건 로드 완료');
            } else {
              setSyncStatus('ok', '서버 DB 없음 · 캐시 사용 중');
            }
            if(hint) hint.textContent = 'DB ' + DB.length + '건 · 검색하세요';
            if(document.getElementById('sq') && document.getElementById('sq').value.trim().length >= 2) doSrch();
          }
        })
        .catch(function(e){ console.warn('DB 로드 실패:', e.message); setSyncStatus('error','DB 로드 실패'); });
    }
    _loadDBPage(0);
  })();

  // ── BOM 단독 로드 ──
  apiGet({ action:'getSheet', sheet:'bom_data' })
    .then(function(r) {
      if(r && r.ok && r.data && r.data.length) {
        BOM = rowsToBom(r.data);
        try { localStorage.setItem('jst_bom2', JSON.stringify(BOM)); } catch(e){}
      }
    })
    .catch(function(e){ console.warn('BOM 로드 실패:', e.message); });

  // ── 1단계: PO + 소형 시트 (병렬) ──
  var fast_sheets = 'po_data,po_delivered,todo_items';
  apiGet({ action:'getSheets', sheets: fast_sheets })
    .then(function(res1) {
      if(res1 && res1.ok && res1.data) {
        var d1 = res1.data;
        if(d1['po_data'] && d1['po_data'].length) {
          var poData = d1['po_data'];
          try { localStorage.setItem('po_data', JSON.stringify(poData.slice(0,500))); } catch(e){}
          PO = poData;
          var h = getHist();
          if(h.length > 0) h[0].data = PO;
          else h = [{date: new Date().toLocaleString('ko-KR'), data: PO, changes:[]}];
          try { localStorage.setItem(LS_HIST, JSON.stringify(h)); } catch(e){}
          refreshAll(); buildHistSelect();
        }
        if(d1['po_delivered'] && d1['po_delivered'].length) {
          var dvData = d1['po_delivered'];
          try { localStorage.setItem(LS_DELIVERED, JSON.stringify(dvData)); } catch(e){}
          updateDeliveredBadge(); buildYearTabs(dvData); renderDelivered(); renderSalesDash();
        }
        if(d1['po_tracking'] && d1['po_tracking'].length) {
          var trkObj = {};
          d1['po_tracking'].forEach(function(r){
            var key = (r.item||r.pn||'') + '|' + (r.order||'');
            if(!trkObj[key]) trkObj[key] = {item:r.item||r.pn||'', order:r.order||'', history:[]};
            trkObj[key].history.push({date:r.date||'', trackNum:r.trackNum||'', chuldo:r.chuldo||'', promise:r.promise||''});
          });
          try { localStorage.setItem(LS_TRACK, JSON.stringify(trkObj)); } catch(e){}
        }
        if(d1['todo_items']) {
          try { localStorage.setItem('jst_todo', JSON.stringify(d1['todo_items'])); } catch(e){}
        }
        setSyncStatus('syncing', 'PO 로드 완료 · DB 로드 중...');
      }
    })
    .catch(function(e){ console.warn('1단계 로드 실패:', e.message); })
    .finally(function(){
      // DB/BOM은 위에서 별도 요청으로 처리됨
    });

  // ── 3단계: 나머지 시트 (가장 나중, 영향 없음) ──
  setTimeout(function(){
    var bg_sheets = 'po_history,recv_items,out_items';
    apiGet({ action:'getSheets', sheets: bg_sheets })
      .then(function(res2) {
        if(!res2 || !res2.ok || !res2.data) { setSyncStatus('ok'); return; }
        var d2 = res2.data;
        var bgKeyMap = {
          'hist_items':'jst_hist2', 'chk_items':'jst_chk2',
          'chkhist_data':'jst_chkhist2', 'po_history':'po_history',
          'recv_items':'jst_recv2', 'out_items':'jst_out2'
        };
        Object.keys(bgKeyMap).forEach(function(sName){
          var data = d2[sName]; if(!data) return;
          var lsKey = bgKeyMap[sName];
          if(lsKey === 'jst_chkhist2') {
            CHKHIST = rowsToChkhist(data);
            try { localStorage.setItem(lsKey, JSON.stringify(CHKHIST)); } catch(e){}
          } else if(lsKey === 'po_history') {
            var hist = data.map(function(row){
              try { return {date:row.upload_date,changes:[],data:JSON.parse(row.data_json||'[]')}; }
              catch(e){ return null; }
            }).filter(Boolean);
            try { localStorage.setItem(lsKey, JSON.stringify(hist)); } catch(e){}
          } else if(lsKey === 'jst_recv2') {
            RECV = data;
            var _2y = (new Date().getFullYear()-2)+'-01-01';
            try { localStorage.setItem(lsKey, JSON.stringify(RECV.filter(function(r){return (r.order_date||'')>=_2y;}))); } catch(e){}
            renderRecv();
            if(typeof renderRecvDash==='function') renderRecvDash();
            renderPurchaseAlert();
          } else if(lsKey === 'jst_out2') {
            // _done 필드: 서버값이 문자열 "TRUE"/"FALSE"일 수 있으므로 boolean 변환
            OUT = data.map(function(r){
              r._done = r._done === true || r._done === 'TRUE' || r._done === 'true';
              return r;
            });
            try { localStorage.setItem(lsKey, JSON.stringify(OUT)); } catch(e){}
          } else {
            try { localStorage.setItem(lsKey, JSON.stringify(data)); } catch(e){}
          }
        });
        HIST = ld(K.HIST);
        CHK = ld(K.CHK, []);
        updateStat();
        setSyncStatus('ok');
      })
      .catch(function(e){ console.warn('3단계 로드 실패:', e.message); setSyncStatus('ok'); });
  }, 2000); // 2초 딜레이 후 나머지 로드
}


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


function refreshAll() {
  renderDash(); renderPO(); renderChanges(); renderTracking();
  buildHistSelect();
  updateDeliveredBadge();
  if(typeof renderPOAmounts === 'function') renderPOAmounts();
}


function renderDash() {
  if(!PO || !PO.length) return;
  const today = new Date();
  const overdues = PO.filter(r => r.overdue > 0);
  const gaps     = PO.filter(r => r.gap > 0);
  const revs     = PO.filter(r => r.rev_chg);
  const hots     = PO.filter(r => r.type === 'HOT');
  const tracked  = PO.filter(r => r.ccn === 'B' && r.trackNum);
  const hist     = getHist();
  const chgs     = hist[0]?.changes || [];

  document.getElementById('d-delay').textContent = overdues.length;
  document.getElementById('d-gap').textContent   = gaps.length;
  document.getElementById('d-rev').textContent   = revs.length;
  document.getElementById('d-hot').textContent   = hots.length;
  document.getElementById('d-track').textContent = tracked.length;
  document.getElementById('d-total').textContent = PO.length;

  // 요주의: Promise 경과 or HOT or REV변경
  const alerts = PO.filter(r => r.overdue > 0 || r.rev_chg || r.type === 'HOT')
    .sort((a,b) => (b.overdue||0) - (a.overdue||0)).slice(0, 12);
  document.getElementById('dash-alert').innerHTML = alerts.length
    ? alerts.map(r => `<div style="padding:9px 14px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center">
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--mono);font-size:12px;color:var(--accent)">${r.item} <span style="font-family:var(--font);font-size:11px;color:var(--text3)">· ${r.order}</span></div>
          <div style="font-size:11px;color:var(--text2);overflow:hidden;text-overflow:ellipsis">${r.desc}</div>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
          ${r.overdue > 0 ? `<span class="bd bd-red">경과 +${r.overdue}일</span>` : ''}
          ${r.gap > 0 ? `<span class="bd bd-amber" title="고객요청 대비 ${r.gap}일 늦음">갭 +${r.gap}일</span>` : ''}
          ${r.rev_chg ? `<span class="bd bd-purple">${r.brev}→${r.srev}</span>` : ''}
          ${r.type === 'HOT' ? `<span class="bd bd-teal">HOT</span>` : ''}
        </div>
      </div>`).join('')
    : '<div class="empty"><div class="empty-icon">✓</div><div>요주의 항목 없음</div></div>';

  // 임박
  const cut = new Date(); cut.setDate(cut.getDate()+30);
  const soon = PO.filter(r=>r.promise && new Date(r.promise)<=cut)
    .sort((a,b)=>new Date(a.promise)-new Date(b.promise)).slice(0,15);
  document.getElementById('dash-soon-cnt').textContent = soon.length+'건';
  document.getElementById('dash-soon').innerHTML = soon.map(r=>`
    <div style="padding:8px 14px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center">
      <div style="font-family:var(--mono);font-size:11px;color:var(--text3);width:78px;flex-shrink:0">${fmtShortDate(r.promise)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--mono);font-size:12px;color:var(--accent)">${r.item}</div>
        <div style="font-size:11px;color:var(--text2);overflow:hidden;text-overflow:ellipsis">${r.desc}</div>
      </div>
      ${r.delay>0?`<span class="bd bd-red">+${r.delay}일</span>`:r.rev_chg?`<span class="bd bd-amber">REV↑</span>`:''}
    </div>`).join('');

  // 최근 변경
  document.getElementById('dash-chg-cnt').textContent = chgs.length+'건';
  document.getElementById('dash-chg').innerHTML = chgs.slice(0,10).map(c=>changeCard(c)).join('') ||
    '<div class="empty" style="padding:30px"><div>이전 데이터 없음 (첫 업로드 시 비교 불가)</div></div>';
}


function confirmIssueDate(){
  const dt = document.getElementById('issue-date').value;
  const note = document.getElementById('issue-note').value.trim();
  if(!dt){ alert('출도일을 선택하세요'); return; }
  let cnt = 0;
  PO.forEach(r=>{
    if(!selectedPOKeys.has(getPOKey(r))) return;
    r.issue_date = dt;
    if(note) r.issue_note = note;
    cnt++;
  });
  savePOChanges();
  closeModal('m-issue');
  clearPOSelect();
  alert(`✅ ${cnt}건 출도일 입력 완료 (${dt})`);
}


function updateDeliveredBadge(){
  const n = getDelivered().length;
  const el = document.getElementById('badge-delivered');
  if(el){ el.textContent = n; el.style.display = n ? '' : 'none'; }
}


function buildHistSelect() {
  const hist = getHist();
  const sel = document.getElementById('hist-sel');
  sel.innerHTML = hist.length
    ? hist.map((h,i)=>`<option value="${i}">${h.date} (변경 ${h.changes?.length||0}건)</option>`).join('')
    : '<option>업로드 이력 없음</option>';
}


function renderChanges() {
  const hist = getHist();
  const idx = parseInt(document.getElementById('hist-sel')?.value||'0');
  const entry = hist[idx];
  if(!entry || !entry.changes?.length) {
    document.getElementById('changes-body').innerHTML = `<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">변경사항 없음</div><div class="empty-sub">엑셀을 두 번 이상 업로드하면 비교 이력이 생성됩니다</div></div>`;
    return;
  }
  let chgs = entry.changes;
  if(!chgFilter.has('all')) {
    chgs = chgs.filter(c=>{
      if(chgFilter.has('delay') && c.type==='delay') return true;
      if(chgFilter.has('rev')   && (c.type==='rev'||c.type==='track')) return true;
      if(chgFilter.has('new')   && c.type==='new') return true;
      if(chgFilter.has('gone')  && c.type==='gone') return true;
      return false;
    });
  }

  const groups = {};
  chgs.forEach(c=>{
    const g = {delay:'납기 변동',rev:'REV / 트레킹 변경',new:'신규 PO',gone:'사라진 PO'}[c.type==='track'?'rev':c.type]||'기타';
    if(!groups[g]) groups[g]=[];
    groups[g].push(c);
  });

  const badge = document.getElementById('badge-changes');
  badge.textContent = chgs.length; badge.style.display = chgs.length?'':'none';

  document.getElementById('changes-body').innerHTML = Object.entries(groups).map(([g,items])=>`
    <div class="change-section">
      <div class="change-title">${g} <span style="color:var(--text3);font-size:11px;font-weight:400">${items.length}건</span></div>
      <div class="change-cards">${items.map(changeCard).join('')}</div>
    </div>`).join('');
}


function renderTracking() {
  const track = getTrack();
  const q = document.getElementById('trk-q')?.value.toLowerCase()||'';
  let entries = Object.values(track);

  if(q) entries = entries.filter(e=>{
    var last = e.history[0]||{};
    return e.item.toLowerCase().includes(q)
      || e.desc.toLowerCase().includes(q)
      || (last.trackNum||'').toLowerCase().includes(q)
      || (last.trackRaw||'').toLowerCase().includes(q)
      || (e.order||'').toLowerCase().includes(q);
  });
  if(!trkFilterState.has('all')) {
    entries = entries.filter(e=>{
      const last = e.history[0]||{};
      if(trkFilterState.has('has')     && last.trackNum) return true;
      if(trkFilterState.has('none')    && !last.trackNum) return true;
      if(trkFilterState.has('shipped') && last.chuldo==='발송 완료') return true;
      return false;
    });
  }

  if(!entries.length) {
    document.getElementById('tracking-body').innerHTML = `<div class="empty"><div class="empty-icon">📦</div><div class="empty-title">CCN B 트레킹 이력 없음</div><div class="empty-sub">엑셀 업로드 시 CCN B 품목의 트레킹번호가 자동 수집됩니다</div></div>`;
    return;
  }

  document.getElementById('tracking-body').innerHTML = entries.map(e=>{
    const last = e.history[0]||{};
    const hasNum = !!last.trackNum;
    const shipped = last.chuldo==='발송 완료';
    return `<div class="track-card">
      <div class="track-header" onclick="toggleTrack('${e.item}|${e.order}', this)">
        <div class="track-pn">${e.item}</div>
        <div class="track-desc">${e.desc}</div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
          ${hasNum?`<span style="font-family:var(--mono);font-size:11px;color:var(--amber)">${last.trackNum}</span>`:`<span style="font-size:11px;color:var(--text3)">번호 없음</span>`}
          ${shipped?`<span class="bd bd-green">발송완료</span>`:''}
          <span class="track-ccn">CCN-B</span>
          <span style="font-size:11px;color:var(--text3)">이력 ${e.history.length}건 ▾</span>
        </div>
      </div>
      <div class="track-body" id="tb-${e.item}${e.order}">
        <div class="track-timeline">
          ${e.history.map(h=>`<div class="track-entry">
            <div class="te-date">${h.date}</div>
            <div class="te-num ${h.trackNum?'':'none'}">${h.trackNum||'(트레킹번호 없음)'}</div>
            <div class="te-order">Promise: ${h.promise||'—'} &nbsp;·&nbsp; ${h.chuldo&&h.chuldo!=='nan'?h.chuldo:'출도예정'}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
  }).join('');
}


function renderDelivered(){
  const all = getDelivered();
  // 요약 카드
  const today = new Date();
  const ym = today.toISOString().slice(0,7);
  document.getElementById('dv-total').textContent = all.length;
  document.getElementById('dv-b').textContent = all.filter(r=>r.ccn==='B').length;
  document.getElementById('dv-k').textContent = all.filter(r=>r.ccn==='K').length;
  const thisMonth = all.filter(r=>(r.deliveredDate||'').startsWith(ym));
  document.getElementById('dv-month').textContent = thisMonth.length;
  document.getElementById('dv-month-sub').textContent = ym.replace('-','년 ')+'월';
  document.getElementById('dv-tracked').textContent = all.filter(r=>r.trackNum).length;

  buildDvMonthSel(all);

  const data = filteredDelivered();
  const total = data.length, pages = Math.ceil(total/DV_PER)||1;
  if(dvPage>pages) dvPage=1;
  const slice = data.slice((dvPage-1)*DV_PER, dvPage*DV_PER);

  document.getElementById('dv-cnt').textContent = total+'건';
  document.getElementById('dv-pgn-info').textContent = `${dvPage}/${pages} (${total}건)`;
  document.getElementById('dv-prev').disabled = dvPage===1;
  document.getElementById('dv-next').disabled = dvPage===pages;

  if(!slice.length){
    document.getElementById('dv-tbody').innerHTML = `<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--text3)">
      ${all.length ? '검색 결과 없음' : 'PO 현황에서 납품처리하면 여기에 표시됩니다'}</td></tr>`;
    return;
  }

  document.getElementById('dv-tbody').innerHTML = slice.map(r=>`<tr>
    <td style="font-family:var(--mono);font-size:11px;color:var(--green)">${fmtShortDate(r.deliveredDate)||'—'}</td>
    <td style="font-family:var(--mono);font-size:11px;color:var(--accent)">${r.item}</td>
    <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)">${r.desc||'—'}</td>
    <td><span class="bd ${r.ccn==='K'?'bd-red':r.ccn==='B'?'bd-amber':'bd-gray'}">${r.ccn||'—'}</span></td>
    <td style="text-align:right;font-family:var(--mono)">${(r.qty||0).toLocaleString()}</td>
    <td style="text-align:right;font-family:var(--mono);color:var(--text3)">${r.unitPrice>0?r.unitPrice.toLocaleString():'—'}</td>
    <td style="text-align:right;font-family:var(--mono);color:var(--text);font-weight:600">${r.amount>0?(r.ccn==='B'?'$'+(r.amount.toLocaleString(undefined,{maximumFractionDigits:0})):r.amount.toLocaleString()+'원'):'—'}</td>
    <td style="font-family:var(--mono);font-size:10px;color:var(--text3)">${r.order||'—'}</td>
    <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${fmtShortDate(r.promise)}</td>
    <td style="font-family:var(--mono);font-size:10px;color:${r.trackNum?'var(--amber)':'var(--text3)'}">${r.trackNum||'—'}</td>
    <td style="font-size:11px;color:var(--text3);max-width:100px;overflow:hidden;text-overflow:ellipsis">${r.note||'—'}</td>
    <td style="display:flex;gap:4px">
      <button class="edit-del-btn" onclick="openDvEdit('${r._id}')">수정</button>
      <button class="restore-btn" onclick="restoreToPO('${r._id}')">↩ PO</button>
    </td>
  </tr>`).join('');
}


function renderSalesDash(){
  const all = getDelivered();
  if(!all.length){
    document.getElementById('sales-chart').innerHTML='<div class="no-sales">📊 납품이력 업로드 또는 PO 납품처리 시 자동으로 집계됩니다</div>';
    ['s-total-krw','s-k-krw','s-b-krw','s-b-usd','s-count'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent='—'; });
    return;
  }
  buildYearTabs(all);
  const exrate = getExrate();
  document.getElementById('exrate-input').value = exrate;
  document.getElementById('exrate-result').textContent = `1 USD = ${exrate.toLocaleString()}원 적용`;

  const yearData = all.filter(r=>(r.deliveredDate||'').startsWith(String(salesYear)));
  const bRows = yearData.filter(r=>r.ccn==='B');
  const kRows = yearData.filter(r=>r.ccn==='K');
  // amount: CCN B → USD, CCN K → KRW (amount 없으면 unitPrice*qty 폴백)
  const getAmt = r => r.amount || ((r.unitPrice||0)*(r.qty||1));
  const bUsd = bRows.reduce((s,r)=>s+getAmt(r),0);
  const bKrw = bUsd * exrate;
  const kKrw = kRows.reduce((s,r)=>s+getAmt(r),0);
  const total = bKrw + kKrw;

  document.getElementById('s-b-usd').textContent  = fmtUsd(bUsd);
  document.getElementById('s-b-krw').textContent  = fmtKrw(bKrw);
  document.getElementById('s-k-krw').textContent  = fmtKrw(kKrw);
  document.getElementById('s-total-krw').textContent = fmtKrw(total);
  document.getElementById('s-count').textContent  = yearData.length.toLocaleString();

  // 월별 집계
  const months = Array.from({length:12},(_,i)=>String(salesYear)+'-'+(String(i+1).padStart(2,'0')));
  const monthly = months.map(m=>{
    const rows = yearData.filter(r=>(r.deliveredDate||'').startsWith(m));
    const bU = rows.filter(r=>r.ccn==='B').reduce((s,r)=>s+getAmt(r),0);
    const bK = bU * exrate;
    const kK = rows.filter(r=>r.ccn==='K').reduce((s,r)=>s+getAmt(r),0);
    return {m, label:(parseInt(m.split('-')[1]))+'월', bUsd:bU, bKrw:bK, kKrw:kK, total:bK+kK, cnt:rows.length};
  });

  renderSalesChart(monthly);
  renderSalesTable(monthly, exrate);
  renderSalesDetail();
  // PO 잔여금액 집계
  renderPOAmounts();
  // 품목군별 차트
  renderItemGroupChart();
  // 총 파이프라인 (납품완료 + PO잔여)
  setTimeout(renderGrandTotal, 100);
}


function onExrateChange(){
  const v = parseFloat(document.getElementById('exrate-input').value)||0;
  if(v>0){ saveExrate(v); document.getElementById('exrate-result').textContent=`1 USD = ${v.toLocaleString()}원 적용`; }
  else{ document.getElementById('exrate-result').textContent='환율을 입력하세요'; }
  renderSalesDash();
}


function renderOrdTrend(){
  var q = (document.getElementById('otr-q')||{value:''}).value.trim().toLowerCase();

  // ── 데이터 수집 ──
  var rows = [];

  if(otrData === 'po' || otrData === 'both'){
    var poRows = (typeof PO !== 'undefined' ? PO : []);
    poRows.forEach(function(r){
      var dateKey = getPeriodKey(r.promise || r.placed || '');
      if(!dateKey) return;
      var getAmt = function(x){ return x.extended_price || x.amount || (x.unit_price||0)*(x.qty||1) || 0; };
      var pn = r.item || r.pn || '';
      if(!pn) return;
      rows.push({
        pn: pn, desc: r.desc||'', ccn: r.ccn||'',
        qty: r.qty||0, amt: getAmt(r),
        period: dateKey, src: 'po'
      });
    });
  }

  if(otrData === 'delivered' || otrData === 'both'){
    var dvRows = getDelivered();
    dvRows.forEach(function(r){
      var dateKey = getPeriodKey(r.deliveredDate || '');
      if(!dateKey) return;
      rows.push({
        pn: r.item||'', desc: r.desc||'', ccn: r.ccn||'',
        qty: r.qty||0, amt: r.amount||((r.unitPrice||0)*(r.qty||1)),
        period: dateKey, src: 'delivered'
      });
    });
  }

  // ── 품번별 집계 ──
  var itemMap = {};
  rows.forEach(function(r){
    var pn = r.pn;
    if(!pn) return;
    if(!itemMap[pn]) itemMap[pn] = {pn:pn, desc:r.desc, ccn:r.ccn, periods:{}};
    if(!itemMap[pn].periods[r.period]) itemMap[pn].periods[r.period] = {qty:0, amt:0};
    itemMap[pn].periods[r.period].qty += r.qty;
    itemMap[pn].periods[r.period].amt += r.amt;
  });

  // 검색 필터
  var items = Object.values(itemMap).filter(function(it){
    if(!q) return true;
    return it.pn.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q);
  });

  // 기간 컬럼 목록 (정렬)
  var periodSet = {};
  rows.forEach(function(r){ if(r.period) periodSet[r.period] = 1; });
  var periods = Object.keys(periodSet).sort();

  // ── 테이블 렌더링 ──
  var thead = document.getElementById('otr-thead');
  var tbody = document.getElementById('otr-tbody');
  var cntEl = document.getElementById('otr-cnt');
  if(!thead || !tbody) return;

  var TH_STYLE = 'padding:7px 10px;font-size:10px;font-weight:600;color:var(--text3);background:var(--bg3);border-bottom:1px solid var(--border);white-space:nowrap;text-align:right;position:sticky;top:0';
  var TH_LEFT  = TH_STYLE + ';text-align:left';

  var headerHTML = '<tr>'
    + '<th style="'+TH_LEFT+';min-width:110px">품번</th>'
    + '<th style="'+TH_LEFT+';min-width:150px">품명</th>'
    + '<th style="'+TH_LEFT+';width:50px">CCN</th>'
    + '<th style="'+TH_STYLE+';width:60px">합계</th>';
  periods.forEach(function(p){
    headerHTML += '<th style="'+TH_STYLE+'">' + p + '</th>';
  });
  headerHTML += '<th style="'+TH_STYLE+';color:var(--teal);width:80px">평균/기간</th>'
    + '<th style="'+TH_STYLE+';color:var(--green);width:80px">안전재고</th>'
    + '</tr>';
  thead.innerHTML = headerHTML;

  // 합계 기준 정렬
  items.sort(function(a,b){
    var sa = Object.values(a.periods).reduce(function(s,v){return s+(otrShow==='qty'?v.qty:v.amt);},0);
    var sb = Object.values(b.periods).reduce(function(s,v){return s+(otrShow==='qty'?v.qty:v.amt);},0);
    return sb - sa;
  });

  var fv = function(v){
    if(otrShow === 'qty') return v > 0 ? v.toLocaleString() : '';
    if(!v) return '';
    if(Math.abs(v)>=10000) return '$'+(v/10000).toFixed(1)+'만';
    return '$'+v.toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:0});
  };

  var fkrw = function(v){
    if(!v) return '';
    if(Math.abs(v)>=100000000) return (v/100000000).toFixed(1)+'억';
    if(Math.abs(v)>=10000) return Math.round(v/10000)+'만';
    return v.toLocaleString();
  };

  var TD = 'padding:6px 10px;font-size:12px;border-bottom:1px solid var(--border2);text-align:right;font-family:var(--mono);white-space:nowrap';
  var TD_L = 'padding:6px 10px;font-size:12px;border-bottom:1px solid var(--border2);text-align:left;white-space:nowrap';

  var bodyHTML = items.map(function(it){
    var total = 0;
    var nonZeroCnt = 0;
    var cells = periods.map(function(p){
      var val = it.periods[p] ? (otrShow==='qty' ? it.periods[p].qty : it.periods[p].amt) : 0;
      if(val > 0){ total += val; nonZeroCnt++; }
      var heat = val > 0 ? 'color:var(--text);font-weight:600' : 'color:var(--text3)';
      return '<td style="'+TD+';'+heat+'">' + fv(val) + '</td>';
    }).join('');

    var avg = nonZeroCnt > 0 ? (total / periods.length) : 0; // 전체 기간 기준 평균
    // 안전재고: 평균 × (LT/4.3 + 1)
    var dbItem = DB.find(function(x){return x.pn===it.pn;})||{};
    var lt = dbItem.lt || 0;
    var safetyStock = avg > 0 ? Math.ceil(avg * (lt/4.3 + 1)) : 0;

    var ccnColor = it.ccn==='B' ? 'color:var(--amber)' : it.ccn==='K' ? 'color:var(--red)' : 'color:var(--text3)';

    var rowHtml = '<tr style="cursor:pointer;transition:background .1s" data-otr-pn="'+encodeURIComponent(it.pn)+'" onclick="showOtrSafety(decodeURIComponent(this.dataset.otrPn))" title="클릭: 안전재고 상세">'
      + '<td style="'+TD_L+';color:var(--accent);font-family:var(--mono);font-size:11px">'+it.pn+'</td>'
      + '<td style="'+TD_L+';max-width:180px;overflow:hidden;text-overflow:ellipsis" title="'+it.desc+'">'+it.desc+'</td>'
      + '<td style="'+TD_L+';'+ccnColor+';font-weight:700;font-size:11px">'+it.ccn+'</td>'
      + '<td style="'+TD+';color:var(--text);font-weight:700">'+fv(total)+'</td>'
      + cells
      + '<td style="'+TD+';color:var(--teal);font-weight:600">'+(avg>0?fv(Math.round(avg)):'—')+'</td>'
      + '<td style="'+TD+';color:var(--green);font-weight:700;background:var(--green-bg)">'+(safetyStock>0?safetyStock.toLocaleString():'—')+'</td>'
      + '</tr>';
    return rowHtml;
  }).join('');

  if(!items.length){
    bodyHTML = '<tr><td colspan="'+(periods.length+6)+'" style="text-align:center;padding:30px;color:var(--text3)">PO 또는 납품이력을 업로드하면 표시됩니다</td></tr>';
  }

  tbody.innerHTML = bodyHTML;
  if(cntEl) cntEl.textContent = items.length + '개 품목 · ' + periods.length + '개 기간';
}