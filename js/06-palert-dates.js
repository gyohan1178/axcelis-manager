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

// ══ 구매 알람 대시보드 ══
var _palFilter = 'all';

function palFilter(f) {
  _palFilter = f;
  document.querySelectorAll('#pg-palert .chip').forEach(function(el) {
    el.classList.toggle('on', el.id === 'pal-f-' + f);
  });
  renderPurchaseAlert();
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

// ══ 재고현황 업로드 (재고현황 시트) ══
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

// == 납품이력 전용 업로드 (Received 시트만, 전체 교체) ==
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

// ══ 행 파싱 ══
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

// 고객요청 미충족 갭: Promise - Required (양수 = 우리가 늦게 공급)
function calcGap(promise, required) {
  if(!promise || !required) return 0;
  const d = (new Date(promise) - new Date(required)) / 86400000;
  return isNaN(d) ? 0 : Math.round(d);
}
// 오늘 기준 Promise 경과일: 오늘 - Promise (양수 = Promise 이미 지남)
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

// ══ 변경 감지 ══
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

// ══ CCN B 트레킹 업데이트 ══
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

// ══ 렌더 전체 ══
function refreshAll() {
  renderDash(); renderPO(); renderChanges(); renderTracking();
  buildHistSelect();
  updateDeliveredBadge();
  if(typeof renderPOAmounts === 'function') renderPOAmounts();
}

// ══ 대시보드 ══
function renderDash() {
  if(typeof renderDashCal==='function') renderDashCal();
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

// ══ PO 테이블 ══
