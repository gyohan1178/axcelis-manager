


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
  'recv_items':   'ax_recv_items',
  'out_items':    'ax_out_items',
  'stock_items':  'ax_stock_items',
  'bom_data':     'ax_bom_data',
  'quote_hist':   'ax_quote_hist',
  'pdbox_data':   'ax_pdbox',
  'users':        'ax_users',
};

// 현재 로그인 사용자
var CURRENT_USER    = null;
var CURRENT_TOKEN   = null;
var CURRENT_COMPANY = 'AXCELIS';
var _syncQueue = [];
var _syncing   = false;

// 서버(po_data 컬럼) → 앱 PO 객체 역매핑 + overdue/gap 재계산
function rowsToPO(rows){
  if(!Array.isArray(rows)) return [];
  return rows.map(function(r){
    var promise  = r.promise || r.promise_date || '';
    var required = r.required || r.required_date || '';
    var srev = r.srev||'', brev = r.brev||'';
    var shipped = (typeof r.shipped==='boolean') ? r.shipped : (String(r.chuldo||'')==='발송 완료');
    var gap = (typeof calcGap==='function') ? calcGap(promise, required) : (Number(r.gap)||0);
    var overdue = shipped ? 0 : ((typeof calcOverdue==='function') ? calcOverdue(promise) : (Number(r.overdue)||0));
    return {
      item: r.item||'',
      desc: r.desc||r.description||'',
      pn: r.pn||'',
      rv: r.rv||'',
      ccn: r.ccn||'',
      type: r.type||'',
      order: r.order_num||r.order||'',
      orderLine: r.order_line||r.orderLine||'',
      delLine: r.del_line||r.delLine||'',
      qty: Number(r.qty)||0,
      unit: r.unit||'EA',
      promise: promise,
      required: required,
      srev: srev, brev: brev,
      rev_chg: !!(srev && brev && srev !== brev),
      gap: gap, overdue: overdue, shipped: shipped,
      delay: gap,
      status: r.status||'',
      placed: r.placed||'',
      lt: Number(r.lt)||0,
      unit_price: Number(r.unit_price)||0,
      extended_price: Number(r.extended_price||r.amount)||0,
      amount: Number(r.amount||r.extended_price)||0,
      chuldo: r.chuldo||'',
      trackNum: r.track_num||r.trackNum||'',
      alt: r.alt||'',
      note: r.note||''
    };
  });
}
// 서버(po_delivered 컬럼) → 앱 납품 객체 역매핑
function rowsToDelivered(rows){
  if(!Array.isArray(rows)) return [];
  return rows.map(function(r){
    return {
      item: r.item||'',
      desc: r.desc||r.description||'',
      pn: r.pn||'',
      order: r.order_num||r.order||'',
      orderLine: r.order_line||r.orderLine||'',
      delLine: r.del_line||r.delLine||'',
      qty: Number(r.qty)||0,
      unit: r.unit||'EA',
      unitPrice: Number(r.unit_price||r.unitPrice)||0,
      amount: Number(r.amount||r.extended_price)||0,
      deliveredDate: r.delivered_date||r.deliveredDate||'',
      ccn: r.ccn||'',
      trackNum: r.track_num||r.trackNum||'',
      note: r.note||''
    };
  });
}
function sbMapRow(r, sheet, company){
  var row = {};
  if(sheet === 'chk_items'){
    row.company   = company;
    row.pn        = String(r.pn||'').trim();
    row.grade     = r.grade||'B';
    row["desc"]   = r.desc||'';
    row.sf        = r.sf||0;
    row.note      = r.note||'';
    row.last_date = r.lastDate||null;
    row.last_qty  = (r.lastQty==null?0:r.lastQty);
    row.last_note = r.lastNote||'';
    row.last_insp = r.lastInsp||'';
    return row;
  }
  if(sheet === 'db_items'){
    // 전체 컬럼 전송. 서버에 없는 컬럼은 insert 시 자동 제거+재시도됨(PGRST204 처리).
    // 모든 행 동일 키 유지(PGRST102 방지).
    row['품번']      = String(r.pn||'').trim();
    row['품명']      = r.d||'';
    row['REV']       = r.rv||'';
    row['제조사']    = r.mg||'';
    row['제조사품번'] = r.mp||'';
    row['Category']  = r.ct||'';
    row['Classification'] = r.cl||'';
    row['보관좌표']  = r.lc||'';
    row['구매처']    = r.by||'';
    row['납기']      = r.lt||0;
    row['MOQ']       = r.mq||0;
    row['25년매입가'] = r.k5||0;
    row['26년매입가'] = r.k6||0;
    row['관리대상']  = r.managed||'';
    row['관리부서']  = r.dept||'';
    return row;
  }
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
    row.machine_recv  = !!r.machineRecv;
    row.harness_recv  = !!r.harnessRecv;
    row.elec_recv     = !!r.elecRecv;
    row.qc_done       = !!r.qcDone;
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

// ──────────────────────────────────────────────────────────
//  API 호출 (GET) — Supabase REST
// ──────────────────────────────────────────────────────────
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
      // 1000행씩 전체 페이지네이션 로드 (이전엔 1000행에서 잘림)
      var acc=[];
      function _pg(off){
        return apiGet({action:'getSheet', sheet:n, limit:1000, offset:off}).then(function(r){
          acc=acc.concat(r.data||[]);
          if(r.hasMore) return _pg(off+1000);
          return acc;
        });
      }
      return _pg(0).then(function(rows){ return {name:n, data:rows}; });
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

// ──────────────────────────────────────────────────────────
//  API 호출 (POST) — Supabase REST
// ──────────────────────────────────────────────────────────
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
        // uid(기본키) 중복 제거 — 같은 키는 마지막 값만 유지 (duplicate key 에러 방지)
        if(rows.length && rows[0] && rows[0].uid !== undefined){
          var _seen={}, _dedup=[];
          for(var di=rows.length-1; di>=0; di--){
            var _k=rows[di].uid;
            if(_seen[_k]) continue;
            _seen[_k]=1; _dedup.push(rows[di]);
          }
          _dedup.reverse();
          rows=_dedup;
        }
        var chunks = [];
        for(var i=0;i<rows.length;i+=500) chunks.push(rows.slice(i,i+500));
        var _fail=null, _ins=0;
        // PGRST204(컬럼 없음) 발생 시 해당 컬럼 제거 후 재시도
        function _postChunk(chunk, retries){
          return fetch(SB_URL+'/rest/v1/'+tbl, {
            method:'POST',
            headers:sbHeaders({'Prefer':'return=minimal'}),
            body:JSON.stringify(chunk)
          }).then(function(r){
            if(r.ok){ _ins += chunk.length; return; }
            return r.text().then(function(t){
              // "Could not find the 'XXX' column" → 그 컬럼 제거 후 재시도
              var mm = t && t.match(/Could not find the '([^']+)' column/);
              if(mm && retries>0){
                var badCol = mm[1];
                chunk.forEach(function(o){ delete o[badCol]; });
                return _postChunk(chunk, retries-1);
              }
              if(!_fail) _fail=t; console.error('SB insert error:',t);
            });
          });
        }
        return chunks.reduce(function(p,chunk){
          return p.then(function(){ return _postChunk(chunk, 8); });
        }, Promise.resolve()).then(function(){ return {fail:_fail, ins:_ins}; });
      })
      .then(function(res){
        if(res.fail) return {ok:false, error:res.fail, count:res.ins};
        return {ok:true, count:data.length};
      })
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



// ──────────────────────────────────────────────────────────
//  로그인 / 로그아웃
// ──────────────────────────────────────────────────────────
function doLogin() {
  var id = document.getElementById('login-id').value.trim();
  var pw = document.getElementById('login-pw').value.trim();
  var errEl  = document.getElementById('login-err');
  var loadEl = document.getElementById('login-loading');
  if(!id || !pw){ errEl.textContent = '아이디와 비밀번호를 입력하세요'; return; }
  errEl.textContent = '';
  loadEl.style.display = '';
  document.querySelector('.login-btn').disabled = true;

  apiPost({ action:'login', id:id, pw:pw }).then(function(res) {
    console.log('[Login] response:', res);
    loadEl.style.display = 'none';
    document.querySelector('.login-btn').disabled = false;
    if(res.ok) {
      CURRENT_USER    = res.user;
      CURRENT_TOKEN   = res.token;
      CURRENT_COMPANY = res.user.company || 'AXCELIS';
      // 세션 저장 (새로고침 유지)
      sessionStorage.setItem('ax_token',   CURRENT_TOKEN);
      sessionStorage.setItem('ax_user',    JSON.stringify(CURRENT_USER));
      sessionStorage.setItem('ax_company', CURRENT_COMPANY);
      // 아이디·비번 저장
      var saveId = document.getElementById('login-save-id');
      if(saveId && saveId.checked){
        try { localStorage.setItem('ax_saved_cred', JSON.stringify({id:id, pw:pw})); } catch(e){}
      } else {
        try { localStorage.removeItem('ax_saved_cred'); } catch(e){}
      }
      // 자동 로그인 (탭 닫아도 유지)
      var autoLogin = document.getElementById('login-auto');
      if(autoLogin && autoLogin.checked){
        try {
          localStorage.setItem('ax_auto', JSON.stringify({
            token: CURRENT_TOKEN, user: CURRENT_USER, company: CURRENT_COMPANY
          }));
        } catch(e){}
      } else {
        try { localStorage.removeItem('ax_auto'); } catch(e){}
      }
      showApp();
    } else {
      errEl.textContent = res.error || '로그인 실패';
    }
  }).catch(function(e) {
    console.error('[Login] error:', e);
    loadEl.style.display = 'none';
    document.querySelector('.login-btn').disabled = false;
    errEl.textContent = '서버 연결 실패. 잠시 후 다시 시도하세요.';
  });
}

function doLogout() {
  CURRENT_USER = null; CURRENT_TOKEN = null;
  sessionStorage.clear();
  try { localStorage.removeItem('ax_auto'); } catch(e){}  // 자동로그인 해제 (아이디·비번 저장은 유지)
  document.getElementById('user-menu').style.display = 'none';
  document.getElementById('app-wrap').style.display = 'none';
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('login-id').value = '';
  document.getElementById('login-pw').value = '';
  document.getElementById('login-err').textContent = '';
  // 저장된 아이디·비번이 있으면 다시 채워줌
  try {
    var cred = JSON.parse(localStorage.getItem('ax_saved_cred')||'null');
    if(cred && cred.id){
      document.getElementById('login-id').value = cred.id;
      if(cred.pw) document.getElementById('login-pw').value = cred.pw;
      var sc=document.getElementById('login-save-id'); if(sc) sc.checked=true;
    }
  } catch(e){}
}

function showApp() {
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('app-wrap').style.display = 'block';
  // 사이드바 순서 복원 + 드래그 초기화
  setTimeout(function(){ sbRestoreOrder(); sbInitDrag(); }, 100);

  // 사용자 배지
  var badge = document.getElementById('user-badge');
  var nameEl = document.getElementById('user-name-display');
  if(badge) badge.style.display = 'flex';
  if(nameEl) nameEl.textContent = CURRENT_USER.name || CURRENT_USER.id;
  var mName = document.getElementById('user-menu-name');
  var mRole = document.getElementById('user-menu-role');
  var mComp = document.getElementById('user-menu-company');
  var mAdmin = document.getElementById('user-menu-admin');
  var role = (CURRENT_USER ? CURRENT_USER.role : '') || 'user';
  if(mName) mName.textContent = CURRENT_USER.name;
  if(mRole) mRole.textContent = role==='admin' ? '🔑 관리자' : role==='viewer'||role==='guest' ? '👁 조회 전용' : '👤 일반 사용자';
  if(mComp) mComp.textContent = CURRENT_COMPANY;
  if(mAdmin) mAdmin.style.display = role==='admin' ? '' : 'none';

  // 공정관리 탭: 관리자만 표시
  var bproc = document.getElementById('appbtn-process');
  if(bproc) bproc.style.display = role==='admin' ? '' : 'none';

  // 앱 초기화
  initAfterLogin();

  // ── 권한별 UI 제한 ──
  if(role === 'viewer' || role === 'guest') {
    // viewer: PD BOX + 자재조회 열람 (편집/삭제/등록 불가)
    _pbViewerMode = true;
    var appBar = document.querySelector('.app-bar');
    if(appBar) {
      appBar.querySelectorAll('.app-btn, .app-divider').forEach(function(el){
        var show = el.id === 'appbtn-pdbox' || el.id === 'appbtn-srch';
        if(!show) el.style.display = 'none';
      });
    }
    // 헤더 업로드/초기화 버튼 숨김
    document.querySelectorAll('[data-role-hide]').forEach(function(el){ el.style.display='none'; });
    // PD BOX로 시작 — 캐시 즉시 표시 후 서버 자동 동기화
    switchApp('pdbox');
    pbLoad(); pbRender();
    pbSyncFromServer(function(){ pbRender(); });

  } else if(role === 'user') {
    // 일반 사용자: perms 있으면 적용, 없으면 전체 허용 (업무 탭으로 시작)
    var up = CURRENT_USER.perms;
    if(up && (up.access && up.access.length > 0)) {
      applyTabPerms(up, role);
    }
    switchApp('purchase');

  } else {
    // admin: 모든 탭 표시, 구매관리로 시작
    // 로컬 캐시 DB가 있으면 즉시 렌더
    switchApp('purchase');
  }
}


function toggleUserMenu() {
  var m = document.getElementById('user-menu');
  if(m) m.style.display = m.style.display === 'none' ? 'block' : 'none';
}
document.addEventListener('click', function(e) {
  var menu = document.getElementById('user-menu');
  var badge = document.getElementById('user-badge');
  if(menu && badge && !badge.contains(e.target) && !menu.contains(e.target)) {
    menu.style.display = 'none';
  }
});

// ──────────────────────────────────────────────────────────
//  데이터 동기화 (Google Sheets ↔ localStorage)
// ──────────────────────────────────────────────────────────
var KEY_TO_SHEET = {
  'jst_db2':      'db_items',
  'jst_recv2':    'recv_items',
  'jst_out2':     'out_items',
  'jst_hist2':    'hist_items',
  // 'jst_chk2':  'chk_items',   // ax_chk_items 테이블 없음(404) → 서버 동기화 비활성. 테이블 생성 후 복구.
  'jst_chkhist2': 'chkhist_data',
  'jst_bom2':     'bom_data',
  'po_history':   'po_history',
  'po_delivered': 'po_delivered',
  'po_tracking':  'ax_po_data',
};

// BOM 객체 → 행 배열로 변환
function bomToRows(obj) {
  var rows = [];
  Object.keys(obj).forEach(function(parent) {
    (obj[parent] || []).forEach(function(child) {
      // 모든 행이 동일한 키 집합을 갖도록 고정 (PGRST102 'All object keys must match' 방지)
      rows.push({
        parent_pn: parent,
        child_pn:  String(child.pn||child.child_pn||'').trim(),
        no:    child.no!=null?child.no:0,
        lv:    child.lv!=null?child.lv:1,
        desc:  child.desc||'',
        qty:   child.qty!=null?child.qty:0,
        aqty:  child.aqty!=null?child.aqty:(child.qty!=null?child.qty:0),
        unit:  child.unit||'EA',
        cat:   child.cat||'',
        mfg:   child.mfg||'',
        mfgpn: child.mfgPn||child.mfgpn||'',
        rev:   child.rev||'',
        loc:   child.loc||'',
        note:  child.note||'',
        is_alt: child.isAlt||child.is_alt||''
      });
    });
  });
  return rows;
}
// 행 배열 → BOM 객체로 변환
function rowsToBom(rows) {
  var obj = {};
  rows.forEach(function(r) {
    var p = r.parent_pn;
    if(!p) return;
    if(!obj[p]) obj[p] = [];
    var child = Object.assign({}, r);
    delete child.parent_pn;
    delete child.company;
    if(!child.pn && child.child_pn) {
      child.pn = String(child.child_pn).trim().replace(/\.0$/, '');
    }
    delete child.child_pn;
    if(child.pn) child.pn = String(child.pn).trim().replace(/\.0$/, '');
    // 서버 컬럼명 → 앱 필드명
    if(child.mfgpn!==undefined){ if(child.mfgpn) child.mfgPn=child.mfgpn; delete child.mfgpn; }
    if(child.is_alt!==undefined){ if(child.is_alt) child.isAlt=child.is_alt; delete child.is_alt; }
    obj[p].push(child);
  });
  return obj;
}

// CHKHIST 객체 → 행 배열
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

// 동기화 상태 표시
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

// 서버에서 전체 데이터 로드 → localStorage에 캐시
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
  var fast_sheets = 'po_data,po_delivered';
  apiGet({ action:'getSheets', sheets: fast_sheets })
    .then(function(res1) {
      if(res1 && res1.ok && res1.data) {
        var d1 = res1.data;
        if(d1['po_data'] && d1['po_data'].length) {
          var poData = rowsToPO(d1['po_data']);
          try { localStorage.setItem('po_data', JSON.stringify(poData.slice(0,500))); } catch(e){}
          PO = poData;
          var h = getHist();
          if(h.length > 0) h[0].data = PO;
          else h = [{date: new Date().toLocaleString('ko-KR'), data: PO, changes:[]}];
          try { localStorage.setItem(LS_HIST, JSON.stringify(h)); } catch(e){}
          refreshAll(); buildHistSelect();
        }
        if(d1['po_delivered'] && d1['po_delivered'].length) {
          var dvData = rowsToDelivered(d1['po_delivered']);
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
        setSyncStatus('syncing', 'PO 로드 완료 · DB 로드 중...');
      }
    })
    .catch(function(e){ console.warn('1단계 로드 실패:', e.message); })
    .finally(function(){
      // DB/BOM은 위에서 별도 요청으로 처리됨
    });

  // ── 3단계: 나머지 시트 (가장 나중, 영향 없음) ──
  setTimeout(function(){
    var bg_sheets = 'recv_items,out_items';
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

// DB 필드 <-> 구글시트 컬럼명 매핑 (엑셀 DB시트와 동일하게)
var DB_COL_MAP = {
  pn:'품번', d:'품명', rv:'REV', mg:'제조사', mp:'제조사품번',
  ct:'Category', cl:'Classification', lc:'보관좌표', by:'구매처',
  lt:'납기', mq:'MOQ', k5:'25년매입가', k6:'26년매입가',
  ud:'매입가($)', fc:'FCST', sf:'안전재고',
  op:'기존품품번', om:'기존품제조사',
  managed:'관리대상', dept:'관리부서',
  ia:'대체품여부', ay:'대체승인일', k4:'24년매입가'
};
var DB_COL_MAP_REV = (function(){
  var m = {};
  for(var k in DB_COL_MAP) m[DB_COL_MAP[k]] = k;
  return m;
})();

// 내부 필드명 → 한글 컬럼명 (GSheet 저장용)
function dbToGSheet(rows) {
  return rows.map(function(r) {
    var out = {};
    for(var k in r) { out[DB_COL_MAP[k]||k] = r[k]; }
    return out;
  });
}
// 한글 컬럼명 → 내부 필드명 (GSheet 읽기용)
function gSheetToDB(rows) {
  return rows.map(function(r) {
    var out = {};
    for(var k in r) { out[DB_COL_MAP_REV[k]||k] = r[k]; }
    if(out.pn !== undefined) out.pn = String(out.pn||'').trim().replace(/\.0$/, '');
    return out;
  });
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
    // 대용량 DB(수천 건)는 다른 키를 밀어내므로, 큰 경우 로컬 저장 생략(서버가 원본)
    if(k === K.DB && Array.isArray(v) && v.length > 3000){
      try {
        var _sz = JSON.stringify(_val).length;
        if(_sz > 2500000){ localStorage.removeItem(k); }  // 2.5MB↑면 로컬 캐시 비움(서버에서 로드)
      } catch(e){}
    }
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


// ──────────────────────────────────────────────────────────
//  작업 히스토리 모달
// ──────────────────────────────────────────────────────────
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


// ── 날짜 표기 헬퍼 (YYYY-MM-DD → YYYY년 MM월 DD일) ──
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

// yy-mm-dd 형식 날짜 (전역)
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
// ══ 앱 전환 ══
function switchApp(app) {
  // 탭 전환 시 PD BOX 모달 닫기
  var mpdbox=document.getElementById('m-pdbox');
  if(mpdbox){ mpdbox.classList.remove('on'); mpdbox.style.display='none'; }
  // 스크롤 맨 위로
  var mc=document.getElementById('main-content');
  if(mc) mc.scrollTop=0;
  window.scrollTo(0,0);
  // 사이드바 active 동기화
  sbSyncActive(app);
  var sp  = document.getElementById('sect-purchase');
  var so  = document.getElementById('sect-po');
  var ss  = document.getElementById('sect-srch');
  var st  = document.getElementById('sect-todo');
  var sq  = document.getElementById('sect-quote');
  var spb = document.getElementById('sect-pdbox');
  var spr = document.getElementById('sect-process');
  var sca = document.getElementById('sect-cost');
  sp.style.display  = (app==='purchase') ? 'block':'none';
  so.style.display  = (app==='po')       ? 'block':'none';
  if(ss)  ss.style.display  = (app==='srch')   ? 'block':'none';
  if(st)  { st.style.display = (app==='todo')  ? 'block':'none'; if(app==='todo') st.style.cssText='display:block!important'; }
  if(sq)  { sq.style.display = (app==='quote') ? 'block':'none'; if(app==='quote') sq.style.cssText='display:block!important'; }
  if(spb) { spb.style.display=(app==='pdbox')  ? 'block':'none'; if(app==='pdbox') spb.style.cssText='display:block!important'; }
  if(spr) { spr.style.display=(app==='process')? 'block':'none'; }
  if(sca) { sca.style.display=(app==='cost')   ? 'block':'none'; if(app==='cost') sca.style.cssText='display:block!important'; }
  sp.classList.toggle('on', app==='purchase');
  so.classList.toggle('on', app==='po');
  if(ss)  ss.classList.toggle('on',  app==='srch');
  if(st)  st.classList.toggle('on',  app==='todo');
  if(sq)  sq.classList.toggle('on',  app==='quote');
  if(spb) spb.classList.toggle('on', app==='pdbox');
  var sca2=document.getElementById('sect-cost'); if(sca2) sca2.classList.toggle('on', app==='cost');
  document.getElementById('appbtn-purchase').classList.toggle('on', app==='purchase');
  document.getElementById('appbtn-po').classList.toggle('on', app==='po');
  var bs=document.getElementById('appbtn-srch');   if(bs)  bs.classList.toggle('on', app==='srch');
  var bt=document.getElementById('appbtn-todo');   if(bt)  bt.classList.toggle('on', app==='todo');
  var bq=document.getElementById('appbtn-quote');  if(bq)  bq.classList.toggle('on', app==='quote');
  var bb=document.getElementById('appbtn-pdbox');  if(bb)  bb.classList.toggle('on', app==='pdbox');
  var bp=document.getElementById('appbtn-process');if(bp)  bp.classList.toggle('on', app==='process');
  var bc=document.getElementById('appbtn-cost');   if(bc)  bc.classList.toggle('on', app==='cost');
  if(app==='srch')   { srchTab('item'); }
  if(app==='todo')   renderTodo();
  if(app==='quote')  { qInitCheck(); }
  if(app==='cost')   { if(typeof caInit==='function') caInit(); }
  if(app==='pdbox')  {
    pbLoad();
    pbRender(); // 캐시 즉시 표시
    // 자동 서버 동기화 (항상)
    pbSyncFromServer(function(){
      pbRender();
      if(_pbCalMode) pbRenderCal();
    });
  }
  var ptTabs=document.getElementById('pt-inner-tabs');
  if(ptTabs) ptTabs.style.display=(app==='purchase')?'':'none';
}

// ══ 구매관리 JS ══

// ══ ERP 거래처 코드 맵 (코드시트 기준) ══
const VMAP={
  "세봉":{c:"1018126748",p:"정기 결제"},
  "그로스":{c:"8808600716",p:"정기 결제"},
  "뉴엔":{c:"5078800625",p:"정기 결제"},
  "대현상공":{c:"1138116942",p:"정기 결제"},
  "명일기전":{c:"4748600831",p:"정기 결제"},
  "무궁화엘앤비":{c:"3128636405",p:"선금 결제"},
  "바오산전":{c:"1758800637",p:"정기 결제"},
  "보명이티씨":{c:"1418108812",p:""},
  "삼기":{c:"1078784715",p:"50% 선금"},
  "상도전자":{c:"1138640393",p:"정기 결제"},
  "상명시스텍":{c:"1198633677",p:"정기 결제"},
  "서울아크릴":{c:"1718601251",p:"정기 결제"},
  "세펙트":{c:"1138159112",p:"선금 결제"},
  "스웨즈락":{c:"1998601133",p:"선금 결제"},
  "씨디씨뉴매틱":{c:"1138536102",p:"선금 결제"},
  "알엔":{c:"5758800666",p:"정기 결제"},
  "에스엠시스템":{c:"7628801482",p:"정기 결제"},
  "에이치티씨":{c:"8148100280",p:"정기 결제"},
  "위트솔루션즈":{c:"6398100700",p:"정기 결제"},
  "이디에스":{c:"6058174188",p:"정기 결제"},
  "터크코리아":{c:"1348634582",p:"선금 결제"},
  "가나에프에이":{c:"2158743975",p:"정기 결제"},
  "삼진ENG":{c:"1131875684",p:"정기 결제"},
  "상암교역":{c:"1448120815",p:"정기 결제"},
  "성도전기":{c:"3128195812",p:"정기 결제"},
  "에이티에스솔루션":{c:"4938602219",p:"정기 결제"},
  "에프에이코리아":{c:"3128535092",p:"정기 결제"},
  "엠포시스템":{c:"4060164795",p:"정기 결제"},
  "정금ENG":{c:"3122308035",p:"정기 결제"},
  "수주테크":{c:"2178149615",p:"정기 결제"},
  "엠엠피":{c:"1348601908",p:"선금 결제"},
  "엘앤피코리아":{c:"6068700380",p:"정기 결제"},
  "진풍에프엔":{c:"8440401241",p:"정기 결제"},
  "카본플러스":{c:"7570501279",p:"선금 결제"},
  "파워일렉":{c:"2417000322",p:"선금 결제"},
  "인터넷구매":{c:"12395",p:"카드 결제"},
  "동신":{c:"1408105980",p:"정기 결제"},
  "디지키":{c:"",p:"카드 결제"},
  "마우저":{c:"",p:"카드 결제"},
  "ONLINECOMPONENT":{c:"",p:"카드 결제"},
  "GALCO":{c:"",p:"카드 결제"},
  "AFC":{c:"",p:"해외 송금"},
  "MCMASTERCARR":{c:"",p:"카드 결제"},
  "유로박스":{c:"",p:"카드 결제"},
  "TME":{c:"",p:"카드 결제"},
  "motionelec":{c:"",p:"해외 송금"},
  "ELECTRICAUTOMATION":{c:"",p:"카드 결제"},
  "RALPH":{c:"",p:"해외 송금"},
  "세경이앤에스":{c:"",p:"정기 결제"},
  "메틀러토레도코리아":{c:"",p:"선금 결제"},
  "EUAUTOMATION":{c:"",p:"해외 송금"},
  "EU AUTOMATION":{c:"",p:"해외 송금"},
  "CDM":{c:"",p:"카드 결제"},
  "HAIHONG":{c:"",p:"해외 송금"},
  "미즈미":{c:"",p:"카드 결제"},
  "이삭이앤아이":{c:"",p:"정기 결제"},
  "엘리먼트":{c:"",p:"카드 결제"},
  "엘엔피코리아":{c:"",p:"정기 결제"},
  "세방코포레이션":{c:"",p:"정기 결제"},
  "AXCELIS":{c:"",p:"사급"},
  "케이블맵":{c:"",p:"정기 결제"},
  "인터캡":{c:"",p:"선금 결제"},
  "진풍":{c:"",p:"정기 결제"},
  "EAO":{c:"",p:"해외 송금"},
  "레오콤":{c:"",p:"카드 결제"},
  "신원머티리얼즈":{c:"",p:"선금 결제"},
  "Flykey":{c:"",p:"해외 송금"},
  "이로피":{c:"",p:"정기 결제"},
  "썬더볼트":{c:"",p:"카드 결제"},
  "oxidationtech":{c:"",p:"해외 송금"},
  "OMEGA":{c:"",p:"카드 결제"},
  "피에스디이":{c:"",p:"정기 결제"},
  "엘레파츠":{c:"",p:"카드 결제"},
  "케이투":{c:"",p:"카드 결제"},
  "MPF PRODUCTS INC":{c:"",p:"해외 송금"},
  "ARROW":{c:"",p:"카드 결제"},
  "MCS":{c:"",p:"카드 결제"},
  "메르센코리아":{c:"",p:"정기 결제"},
  "거전산업":{c:"",p:"선금 결제"},
  "위너스오토메이션":{c:"",p:"정기 결제"},
  "제스코":{c:"",p:"선금 결제"},
  "지원테크":{c:"",p:"정기 결제"},
};
// ERP 고정값
const ERP_FIXED={
  manager:'00022',   // 담당자
  warehouse:'00009', // 입고창고
  project:'',        // 프로젝트 (설정에서 변경)
};

// ══ 스토리지 ══
const K={DB:'jst_db2',RECV:'jst_recv2',OUT:'jst_out2',HIST:'jst_hist2',BOM:'jst_bom2',CHK:'jst_chk2',CHKHIST:'jst_chkhist2'};
let ld=(k,d=[])=>{try{return JSON.parse(localStorage.getItem(k)||'null')||d;}catch{return d;}};
let sv=(k,v)=>{
  try {
    // RECV: 최근 2년치만
    if(k===K.RECV && Array.isArray(v)) {
      var _2y=(new Date().getFullYear()-2)+'-01-01';
      v=v.filter(function(r){return (r.order_date||'')>=_2y;});
    }
    // OUT: 최근 2년치만 로컬 저장
    if(k===K.OUT && Array.isArray(v)) {
      var _2yOut=(new Date().getFullYear()-2)+'-01-01';
      v=v.filter(function(r){ return (r.date||'')>=_2yOut; });
    }
    // CHK: null/undefined 필드 제거해서 크기 축소
    if(k===K.CHK && Array.isArray(v)) {
      v=v.map(function(r){
        var o={pn:r.pn,grade:r.grade||'B',sf:r.sf||0};
        if(r.note) o.note=r.note;
        if(r.lastDate) o.lastDate=r.lastDate;
        if(r.lastQty!=null&&r.lastQty!==undefined) o.lastQty=r.lastQty;
        if(r.lastNote) o.lastNote=r.lastNote;
        if(r.lastInsp) o.lastInsp=r.lastInsp;
        return o;
      });
    }
    localStorage.setItem(k,JSON.stringify(v));
  } catch(e) {
    if(e.name==='QuotaExceededError'||(e.message&&e.message.includes('quota'))) {
      console.warn('용량 초과:',k);
      if(Array.isArray(v)) {
        try { localStorage.setItem(k,JSON.stringify(v.slice(0,Math.floor(v.length/2)))); }
        catch(e2) { console.warn('저장 실패(무시):',k); }
      }
    }
  }
};

// ══ 엑셀 업로드 ══
// 앱 필드 정의: [key, 한국어 레이블, 필수여부]
const UP_FIELDS=[
  ['pn','품번',true],['d','품명',true],['rv','REV',false],
  ['mg','제조사',false],['mp','제조사품번',false],
  ['ct','Category',false],['cl','Classification',false],['lc','보관좌표',false],
  ['by','구매처',false],['lt','LT(주)',false],['mq','MOQ',false],
  ['k5','25년 매입가(₩)',false],['k6','26년 매입가(₩)',false],
  ['ud','매입가($) — 선택안함',false],['fc','FCST/월 — 선택안함',false],['sf','안전재고 — 선택안함',false],
  ['op','기존품품번',false],['om','기존품제조사',false],
  ['managed','관리대상',false],['dept','관리부서',false],
];

let upRows=[],upHeaders=[];

function openUpload(){
  // 초기화
  upRows=[];upHeaders=[];
  var rc=document.getElementById('up-replace'); if(rc) rc.checked=false;
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

