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


// 납품이력 업로드 시 CCN B 트레킹 업데이트
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


// ══════════════════════════════════════════════
//  업무 To-Do List
// ══════════════════════════════════════════════
var K_TODO = 'jst_todo';
var todoEditId = null;

function ldTodo(){ try{ return JSON.parse(localStorage.getItem(K_TODO)||'[]'); }catch{ return []; } }
function svTodo(d){
  localStorage.setItem(K_TODO, JSON.stringify(d));
  // todo_items 서버 동기화 제거 (ax_pdbox 테이블과 충돌해 PD BOX 데이터를 덮어쓰던 문제)
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


// ══ 탭 접근/수정 권한 정의 ══
var TAB_DEFS = [
  // [key, 레이블, 섹션, 기본접근, 수정가능여부]
  {key:'todo',    label:'📋 업무',          sect:'top',      default:true,  canEdit:true},
  {key:'purchase',label:'📦 구매관리',      sect:'top',      default:true,  canEdit:false},
  {key:'po',      label:'📋 PO 관리',       sect:'top',      default:true,  canEdit:false},
  {key:'srch',    label:'🔍 자재조회',       sect:'top',      default:true,  canEdit:false},
  // 구매관리 서브탭
  {key:'db',      label:'품목 DB',          sect:'purchase', default:true,  canEdit:true},
  {key:'recv',    label:'매입 이력',         sect:'purchase', default:true,  canEdit:true},
  {key:'out',     label:'자재 불출',         sect:'purchase', default:true,  canEdit:true},
  {key:'lt',      label:'LT 미입력',        sect:'purchase', default:true,  canEdit:false},
  {key:'bom',     label:'BOM 관리',         sect:'purchase', default:true,  canEdit:true},
  {key:'rdash',   label:'매입 대시보드',     sect:'purchase', default:true,  canEdit:false},
  {key:'chk',     label:'재고점검',          sect:'purchase', default:true,  canEdit:true},
  // PO 서브탭
  {key:'po-dash', label:'PO 대시보드',      sect:'po',       default:true,  canEdit:false},
  {key:'po-po',   label:'PO 현황',          sect:'po',       default:true,  canEdit:true},
  {key:'po-deliv',label:'납품 완료',         sect:'po',       default:true,  canEdit:true},
  {key:'po-sales',label:'매출 대시보드',     sect:'po',       default:true,  canEdit:false},
  {key:'po-track',label:'CCN B 트레킹',     sect:'po',       default:false, canEdit:false},
];

var SECT_LABELS = {top:'상위 탭', purchase:'구매관리 탭', po:'PO 관리 탭'};

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

// 권한에 따라 탭 적용
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


// DB 아이템 단위 서버 동기화 (전체 재전송 없이 해당 행만)
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


// ── LT 일괄 처리 ──
var ltSelected = new Set();

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

// ══ 초기 실행 ══

(function initAll() {
  // 초기 섹션 상태
  document.getElementById('sect-purchase').style.display = 'block';
  document.getElementById('sect-po').style.display = 'none';
  var _ss=document.getElementById('sect-srch'); if(_ss) _ss.style.display='none';

  // sv 함수를 동기화 버전으로 교체
  // (기존 sv = localStorage만 저장, svWithSync = 서버도 동기화)
  // 구매 sv 함수 오버라이드
  window._origSv = window.sv;
  window.sv = function(k, v) { svWithSync(k, v); };

  // 세션 복원 (새로고침 시 재로그인 방지)
  var savedToken   = sessionStorage.getItem('ax_token');
  var savedUser    = sessionStorage.getItem('ax_user');
  var savedCompany = sessionStorage.getItem('ax_company');
  if(savedToken && savedUser) {
    try {
      CURRENT_TOKEN   = savedToken;
      CURRENT_USER    = JSON.parse(savedUser);
      CURRENT_COMPANY = savedCompany || 'AXCELIS';
      showApp();
      return; // showApp 안에서 initAll 다시 호출되지 않도록
    } catch(e) { sessionStorage.clear(); }
  }

  // 로컬 캐시 즉시 표시
  var _initCache=(function(){try{return JSON.parse(localStorage.getItem('jst_db2')||'null');}catch(e){return null;}})();
  if(_initCache&&_initCache.length){DB=_initCache;}
  renderDB(); syncDBtoCHK(); updateStat();

  var hist = getHist();
  if(hist.length > 0 && hist[0].data && hist[0].data.length > 0) {
    PO = hist[0].data;
    var lu = document.getElementById('last-updated');
    if(lu) lu.textContent = '마지막 PO: ' + hist[0].date;
    refreshAll();
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
})();

// showApp 에서 로그인 완료 후 초기화
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


// ═══════════════════════════════════════════════════════════
//  견적 모듈 (QUOTE MODULE) v3
//  ※ DB 전역배열 사용: r.pn, r.d, r.rv, r.mg, r.mp, r.by, r.lt, r.k5, r.k6
//  ※ 수량체계: part.qty(BOM1개당) × assy.assyQty(발주수량) = 실사용수량
// ═══════════════════════════════════════════════════════════

var QS = {
  bomAssies: [],    // [{pn,desc,rev,isAssy,assyQty,laborKrw,parts:[{pn,desc,qty,unit,rev}]}]
  quoteAssies: [],  // after DB lookup
};
var _qmrid = 0;

function qInitCheck(){
  if(DB && DB.length) qUpdRateDisp();
}

/* ── 서브탭 ── */
/* ══════════════════════════════════════════════════════
   PO 단가 대조 모듈
   파싱 대상: AXCELIS PO 표준 양식
   ITEM 행 패턴: 0001  25.00  25.00  EA  160009300  C  28.00  $700.00  C
   납기 행 패턴: 001  06/25/2026  25.00  25.00
══════════════════════════════════════════════════════ */

