// ─── 공통 변수 및 API ───

// ══════════════════════════════════════════════════════════
//  API 설정
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  Supabase 설정
// ══════════════════════════════════════════════════════════
const SB_URL = 'https://zlmdxxginskguqqitsbp.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsbWR4eGdpbnNrZ3VxcWl0c2JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMjQyMTcsImV4cCI6MjA5MzYwMDIxN30.1b1bGTNfq7a1ZTBeHVnzTRsjWgwZP4rY9ei3XqljNi0';

// 구글 시트 → Supabase 테이블명 매핑
var SB_TABLE_MAP = {
  'db_items':     'ax_db_items',
  'po_data':      'ax_po_data',
  'po_delivered': 'ax_po_delivered',
  'po_history':   'ax_po_data',
  'recv_items':   'ax_recv_items',
  'out_items':    'ax_out_items',
  'stock_items':  'ax_stock_items',
  'bom_data':     'ax_bom_data',
  'quote_hist':   'ax_quote_hist',
  'pdbox_data':   'ax_pdbox',
  'users':        'ax_users',
  'todo_items':   'ax_pdbox',
};

// 현재 로그인 사용자
var CURRENT_USER    = null;
var CURRENT_TOKEN   = null;
var CURRENT_COMPANY = 'AXCELIS';
var _syncQueue = [];
var _syncing   = false;


function sbMapRow(r, sheet, company){
  var row = {};
  // po_data 필드 매핑 (앱 내부명 → DB 컬럼명)
  if(sheet === 'po_data'){
    row.uid          = (r.order||'')+'|'+(r.orderLine||'')+'|'+(r.delLine||'')+'|'+(r.item||'')+'|'+(r.promise||'');
    row.company      = company;
    row.item         = r.item||'';
    row.order_num    = r.order||'';
    row.order_line   = r.orderLine||'';
    row.del_line     = r.delLine||'';
    row.pn           = r.pn||'';
    row["desc"]      = r.desc||'';
    row.rv           = r.rv||'';
    row.srev         = r.srev||'';
    row.brev         = r.brev||'';
    row.ccn          = r.ccn||'';
    row.type         = r.type||'';
    row.qty          = r.qty||0;
    row.unit         = r.unit||'';
    row.promise      = r.promise||'';
    row.required     = r.required||'';
    row.placed       = r.placed||'';
    row.status       = r.status||'';
    row.lt           = r.lt||0;
    row.unit_price   = r.unit_price||0;
    row.extended_price = r.extended_price||r.amount||0;
    row.amount       = r.amount||r.extended_price||0;
    row.chuldo       = r.chuldo||'';
    row.track_num    = r.trackNum||r.track_num||'';
    row.alt          = r.alt||'';
    row.note         = r.note||'';
    row.gap          = r.gap||0;
    row.overdue      = !!r.overdue;
    row.shipped      = !!r.shipped;
    return row;
  }
  if(sheet === 'po_delivered'){
    row.uid          = (r.order||r.order_num||'')+'|'+(r.orderLine||r.order_line||'')+'|'+(r.delLine||r.del_line||'')+'|'+(r.item||'')+'|'+(r.deliveredDate||r.delivered_date||'');
    row.company      = company;
    row.item         = r.item||'';
    row.order_num    = r.order||r.order_num||'';
    row.order_line   = r.orderLine||r.order_line||'';
    row.del_line     = r.delLine||r.del_line||'';
    row.pn           = r.pn||'';
    row["desc"]      = r.desc||r.d||'';
    row.qty          = r.qty||0;
    row.unit         = r.unit||'EA';
    row.unit_price   = r.unitPrice||r.unit_price||0;
    row.extended_price = r.amount||r.extended_price||0;
    row.amount       = r.amount||0;
    row.delivered_date = r.deliveredDate||r.delivered_date||'';
    row.ccn          = r.ccn||'';
    row.track_num    = r.trackNum||r.track_num||'';
    row.note         = r.note||'';
    return row;
  }
  if(sheet === 'pdbox_data'){
    row.id            = r.id||'';
    row.company       = company;
    row.name          = r.name||'';
    row.pn            = r.pn||'';
    row.hogi          = r.hogi||'';
    row.ccn           = r.ccn||'';
    row.rev           = r.rev||'';
    row.status        = r.status||'PO접수';
    row.po_received   = r.poReceived!==false;
    row.req_date      = r.reqDate||'';
    row.machine_date  = r.machineDate||'';
    row.arrival_date  = r.arrivalDate||'';
    row.harness_issue = r.harnessIssue||'';
    row.harness_done  = r.harnessDone||'';
    row.part_issue    = r.partIssue||'';
    row.elec_done     = r.elecDone||'';
    row.note          = r.note||'';
    row.missing_parts = JSON.stringify(r.missingParts||[]);
    row.changes       = JSON.stringify(r.changes||[]);
    row.created_at    = r.createdAt||new Date().toISOString();
    row.updated_at    = r.updatedAt||new Date().toISOString();
    return row;
  }
  if(sheet === 'quote_hist'){
    row.company      = company;
    row.quote_no     = r.견적번호||'';
    row.quote_date   = r.견적일자||'';
    row.pn           = r.품번||'';
    row["desc"]      = r.품명||'';
    row.assy_qty     = r.ASSY수량||0;
    row.buy_total    = r.매입합계||0;
    row.labor        = r.작업비||0;
    row.usd          = r.견적가달러||0;
    row.krw          = r.견적가한화||0;
    row.margin       = r.마진율||0;
    row.project      = r.프로젝트||'';
    row.note         = r.비고||'';
    row.submitted_at = r.제출일시||'';
    row.modified_at  = r.수정일시||'';
    row.status       = r.상태||'';
    return row;
  }
  // 기본: 그대로 + company 추가
  var out = Object.assign({}, r);
  out.company = company;
  ['missingParts','changes','perms'].forEach(function(f){
    if(out[f] && typeof out[f]==='object') out[f]=JSON.stringify(out[f]);
  });
  return out;
}


function sbHeaders(extra){
  var h = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer '+SB_KEY,
    'Content-Type': 'application/json',
  };
  return Object.assign(h, extra||{});
}


function sbTable(name){
  return SB_TABLE_MAP[name] || ('ax_'+name);
}


function apiGet(params) {
  var action  = params.action;
  var company = CURRENT_COMPANY || 'AXCELIS';

  if(action === 'getSheet'){
    var tbl    = sbTable(params.sheet);
    var limit  = parseInt(params.limit  || '1000');
    var offset = parseInt(params.offset || '0');
    var url = SB_URL+'/rest/v1/'+tbl+'?select=*';
    // company 필터 (db_items는 company 컬럼 없음)
    if(params.sheet !== 'db_items') url += '&company=eq.'+encodeURIComponent(company);
    if(limit)  url += '&limit='+limit+'&offset='+offset;
    return fetch(url, {headers: sbHeaders({'Prefer':'count=exact'})})
      .then(function(r){
        var cr = r.headers.get('Content-Range')||'';
        var total = parseInt((cr.split('/')[1])||'0')||0;
        return r.json().then(function(data){
          var arr = Array.isArray(data)?data:[];
          return {ok:true, data:arr, total:total||arr.length, hasMore: offset+limit < total};
        });
      });
  }

  if(action === 'getSheets'){
    var names = (params.sheets||'').split(',').filter(Boolean);
    return Promise.all(names.map(function(n){
      return apiGet({action:'getSheet', sheet:n, limit:0, offset:0})
        .then(function(r){ return {name:n, data:r.data||[]}; });
    })).then(function(results){
      var data={};
      results.forEach(function(r){ data[r.name]=r.data; });
      return {ok:true, data:data};
    });
  }

  if(action === 'getAudit'){
    return Promise.resolve({ok:true, data:[]});
  }

  if(action === 'getQuoteHist'){
    return apiGet({action:'getSheet', sheet:'quote_hist', limit:0, offset:0});
  }

  return Promise.resolve({ok:false, error:'알 수 없는 action: '+action});
}


function apiPost(body) {
  var action  = body.action;
  var company = body.company || CURRENT_COMPANY || 'AXCELIS';

  // ── 로그인 ──
  if(action === 'login'){
    var url = SB_URL+'/rest/v1/ax_users?id=eq.'+encodeURIComponent(body.id)+'&password=eq.'+encodeURIComponent(body.pw||body.password||'');
    return fetch(url, {headers:sbHeaders()})
      .then(function(r){ return r.json(); })
      .then(function(data){
        if(!data||!data.length) return {ok:false, error:'아이디 또는 비밀번호가 틀립니다'};
        var u = data[0];
        if(u.perms && typeof u.perms==='string') try{u.perms=JSON.parse(u.perms);}catch(e){}
        var token = btoa(u.id+':'+Date.now());
        delete u.password;
        return {ok:true, token:token, user:u};
      });
  }

  // ── 전체 덮어쓰기 ──
  if(action === 'setSheet'){
    var tbl  = sbTable(body.sheet);
    var data = body.data || [];
    if(!data.length) return Promise.resolve({ok:true, count:0});

    // 기존 데이터 삭제
    var delUrl = SB_URL+'/rest/v1/'+tbl+'?company=eq.'+encodeURIComponent(company);
    if(body.sheet === 'db_items') delUrl = SB_URL+'/rest/v1/'+tbl+'?pn=neq.____never____';

    return fetch(delUrl, {method:'DELETE', headers:sbHeaders()})
      .then(function(){
        var rows = data.map(function(r){
          return sbMapRow(r, body.sheet, company);
        });
        var chunks = [];
        for(var i=0;i<rows.length;i+=500) chunks.push(rows.slice(i,i+500));
        return chunks.reduce(function(p,chunk){
          return p.then(function(){
            return fetch(SB_URL+'/rest/v1/'+tbl, {
              method:'POST',
              headers:sbHeaders({'Prefer':'return=minimal'}),
              body:JSON.stringify(chunk)
            }).then(function(r){
              if(!r.ok) return r.text().then(function(t){console.error('SB insert error:',t);});
            });
          });
        }, Promise.resolve());
      })
      .then(function(){ return {ok:true, count:data.length}; })
      .catch(function(e){ console.error('setSheet error:',e); return {ok:false, error:e.message}; });
  }

  if(action === 'appendRows'){
    var tbl  = sbTable(body.sheet);
    var rows = (body.rows||[]).map(function(r){
      return sbMapRow(r, body.sheet, company);
    });
    if(!rows.length) return Promise.resolve({ok:true, count:0});
    return fetch(SB_URL+'/rest/v1/'+tbl, {
      method:'POST',
      headers:sbHeaders({'Prefer':'return=minimal'}),
      body:JSON.stringify(rows)
    }).then(function(r){
      return r.ok ? {ok:true, count:rows.length} : r.json().then(function(e){ return {ok:false, error:e.message||JSON.stringify(e)}; });
    }).catch(function(e){ return {ok:false, error:e.message}; });
  }

  // ── 행 업데이트 ──
  if(action === 'updateRow'){
    var tbl = sbTable(body.sheet);
    var url = SB_URL+'/rest/v1/'+tbl+'?'+body.keyField+'=eq.'+encodeURIComponent(body.keyValue);
    return fetch(url, {
      method:'PATCH',
      headers:sbHeaders({'Prefer':'return=minimal'}),
      body:JSON.stringify(body.updates)
    }).then(function(r){ return r.ok?{ok:true}:{ok:false}; });
  }

  // ── 행 삭제 ──
  if(action === 'deleteRow'){
    var tbl = sbTable(body.sheet);
    var url = SB_URL+'/rest/v1/'+tbl+'?'+body.keyField+'=eq.'+encodeURIComponent(body.keyValue);
    return fetch(url, {method:'DELETE', headers:sbHeaders()})
      .then(function(r){ return r.ok?{ok:true}:{ok:false}; });
  }

  // ── 사용자 추가 ──
  if(action === 'addUser'){
    var row = {id:body.id, password:body.password, name:body.name, role:body.role||'user', company:body.company||company};
    if(body.perms) row.perms = typeof body.perms==='object'?JSON.stringify(body.perms):body.perms;
    return fetch(SB_URL+'/rest/v1/ax_users', {
      method:'POST',
      headers:sbHeaders({'Prefer':'return=minimal'}),
      body:JSON.stringify(row)
    }).then(function(r){ return r.ok?{ok:true}:{ok:false, error:'추가 실패'}; });
  }

  // ── 전체 초기화 ──
  if(action === 'resetAll'){
    if(!CURRENT_USER||CURRENT_USER.role!=='admin') return Promise.resolve({ok:false, error:'권한 없음'});
    var tables=['ax_db_items','ax_po_data','ax_po_delivered','ax_recv_items','ax_out_items','ax_stock_items','ax_bom_data','ax_quote_hist','ax_pdbox'];
    return Promise.all(tables.map(function(t){
      return fetch(SB_URL+'/rest/v1/'+t+'?company=eq.'+encodeURIComponent(company), {method:'DELETE', headers:sbHeaders()});
    })).then(function(){ return {ok:true}; });
  }

  return Promise.resolve({ok:false, error:'알 수 없는 action: '+action});
}


function qToast(m,t,ms){
  t=t||'ok'; ms=ms||2800;
  var e=document.getElementById('q-toast');
  e.className=t; e.textContent=m; e.style.display='block';
  clearTimeout(e._t); e._t=setTimeout(function(){ e.style.display='none'; },ms);
}


function svWithSync(k, v) {
  try {
    // RECV는 최근 2년치만 로컬
    var _val = v;
    if(k === K.RECV && Array.isArray(v)) {
      var _2yr = (new Date().getFullYear()-2)+'-01-01';
      _val = v.filter(function(r){ return (r.order_date||'') >= _2yr; });
    }
    localStorage.setItem(k, JSON.stringify(_val));
  } catch(e) {
    if(e.name === 'QuotaExceededError' || (e.message && e.message.includes('quota'))) {
      console.warn('localStorage 용량 초과 ['+k+'] - 서버만 동기화');
      // 로컬 저장 실패해도 서버 동기화는 계속
    } else {
      console.error('localStorage 저장 오류:', e);
    }
  }
  var sheetName = KEY_TO_SHEET[k];
  if(!sheetName || !CURRENT_TOKEN) return;

  var rows;
  if(k === 'jst_bom2') {
    rows = bomToRows(v);
  } else if(k === 'jst_chkhist2') {
    rows = chkhistToRows(v);
  } else if(k === 'po_history') {
    rows = v.map(function(entry) {
      return { upload_date: entry.date, changes_count: (entry.changes||[]).length, data_json: JSON.stringify(entry.data||[]) };
    });
  } else {
    rows = Array.isArray(v) ? v : Object.values(v);
  }

  setSyncStatus('syncing');

  // 청크 크기: 큰 데이터(DB 5000+건)는 200건씩 나눠 전송
  var CHUNK = 200;
  if(rows.length <= CHUNK) {
    // 소량 데이터는 한번에
    apiPost({ action:'setSheet', sheet: sheetName, data: rows }).then(function(res) {
      setSyncStatus(res.ok ? 'ok' : 'error');
    }).catch(function(e){ setSyncStatus('error', e.message); });
  } else {
    // 대량 데이터: 첫 청크는 전체 삭제 후 삽입, 이후 청크는 추가
    var chunks = [];
    for(var i=0; i<rows.length; i+=CHUNK) chunks.push(rows.slice(i, i+CHUNK));
    var idx = 0;
    function sendChunk(){
      if(idx >= chunks.length){ setSyncStatus('ok'); return; }
      var action = idx===0 ? 'setSheet' : 'appendRows';
      var body = idx===0
        ? { action:action, sheet:sheetName, data:chunks[idx] }
        : { action:action, sheet:sheetName, rows:chunks[idx] };
      idx++;
      apiPost(body).then(function(res){
        if(!res.ok){ setSyncStatus('error'); return; }
        sendChunk();
      }).catch(function(e){ setSyncStatus('error', e.message); });
    }
    sendChunk();
  }
}


function setSyncStatus(status, msg) {
  var dot = document.getElementById('sync-dot');
  var txt = document.getElementById('sync-status-txt');
  if(!dot) return;
  dot.className = 'sync-dot' + (status==='syncing' ? ' syncing' : status==='error' ? ' error' : '');
  var label = status==='syncing' ? '동기화 중...' : status==='error' ? '⚠️ 동기화 오류' : '✅ 동기화 완료';
  if(txt) txt.textContent = label + (msg ? ': '+msg : '');
  // 헤더에 오류 배너 표시
  var banner = document.getElementById('sync-error-banner');
  if(!banner) {
    banner = document.createElement('div');
    banner.id = 'sync-error-banner';
    banner.style.cssText = 'display:none;position:fixed;bottom:16px;right:16px;background:#1a0a0a;border:1px solid var(--red);color:var(--red);border-radius:8px;padding:10px 16px;font-size:12px;z-index:999;max-width:320px;box-shadow:0 4px 16px rgba(0,0,0,.5)';
    document.body.appendChild(banner);
  }
  if(status === 'error') {
    var closeBtn = '<button onclick="document.getElementById(\'sync-error-banner\').style.display=\'none\'" style="float:right;background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;margin-left:8px">✕</button>';
    banner.innerHTML = closeBtn + '⚠️ <b>동기화 오류</b>' + (msg ? '<br><span style="color:var(--text2);font-size:11px">'+msg+'</span>' : '');
    banner.style.display = 'block';
    setTimeout(function(){ banner.style.display='none'; }, 8000);
  } else {
    banner.style.display = 'none';
  }
}



function initAfterLogin() {
  // sv 동기화 버전으로 교체
  sv = function(k, v) { svWithSync(k, v); };

  // 캐시 있으면 즉시 표시 (로딩 없이 바로 보임)
  var cachedDB = (function(){ try{ return JSON.parse(localStorage.getItem('jst_db2')||'null'); }catch(e){ return null; }})();
  if(cachedDB && cachedDB.length) {
    DB = cachedDB;
    renderDB(); updateStat();
    setSyncStatus('syncing', 'DB ' + DB.length + '건 (캐시) · 최신화 중...');
  }

  // 서버에서 최신 데이터 로드 (백그라운드)
  loadAllFromServer();

  // PO 초기화 (po_data 캐시 우선 — saveHist는 메타만 저장)
  var hist = getHist();
  var poCache2 = (function(){ try{ return JSON.parse(localStorage.getItem('po_data')||'[]'); }catch{ return []; }})();
  if(poCache2.length > 0 || (hist.length > 0 && hist[0].data && hist[0].data.length > 0)) {
    PO = poCache2.length > 0 ? poCache2 : hist[0].data;
    var lu = document.getElementById('last-updated');
    if(lu && hist.length > 0) lu.textContent = '마지막 PO: ' + hist[0].date;
    if(PO.length) refreshAll();
  } else {
    var da = document.getElementById('dash-alert');
    if(da) da.innerHTML = '<div class="empty"><div class="empty-icon">📂</div><div class="empty-title">PO 엑셀을 업로드하세요</div></div>';
    var ds = document.getElementById('dash-soon');
    if(ds) ds.innerHTML = '<div class="empty" style="padding:30px"><div>데이터 없음</div></div>';
  }
  buildHistSelect();
  ['chg-all','trk-all','sl-all'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.classList.add('on','default');
  });
  var dvData = getDelivered();
  if(dvData.length) {
    buildYearTabs(dvData);
    var inp = document.getElementById('exrate-input');
    if(inp) inp.value = getExrate();
  }
  updateDeliveredBadge();
}
