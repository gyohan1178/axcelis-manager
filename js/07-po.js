let poFilters = new Set(['all']);
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

// ══ PO 선택 상태 ══
let selectedPOKeys = new Set(); // "item|order" 키 세트

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

// ══ PO 수정 저장 (localStorage hist[0].data 반영) ══
function savePOChanges(){
  const hist = getHist();
  if(hist.length){ hist[0].data = PO; saveHist(hist); }
}

// ══ 모달 공통 ══
function closeModal(id){ document.getElementById(id).classList.remove('on'); }
document.addEventListener('click', e=>{
  ['m-deliver','m-split','m-issue'].forEach(id=>{
    const el=document.getElementById(id);
    if(el && e.target===el) el.classList.remove('on');
  });
});

// ══ 출도일 입력 모달 ══
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

// ══ PO CSV 내보내기 ══
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

// ══ 납품처리 모달 ══
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

function updateDeliveredBadge(){
  const n = getDelivered().length;
  const el = document.getElementById('badge-delivered');
  if(el){ el.textContent = n; el.style.display = n ? '' : 'none'; }
}

// ══ 분할납품 모달 ══
let splitTargetKey = null;
let splitRowCount = 0;

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

// ══ 변경이력 ══
function toggleChgFilter(f) {
  if(f==='all'){chgFilter.clear();chgFilter.add('all');}
  else{chgFilter.delete('all');chgFilter.has(f)?chgFilter.delete(f):chgFilter.add(f);if(!chgFilter.size)chgFilter.add('all');}
  ['all','delay','rev','new','gone'].forEach(k=>{const el=document.getElementById('chg-'+k);if(el){el.classList.remove('on','default','red','amber','green','teal');
    if(chgFilter.has(k)){el.classList.add('on');el.classList.add({all:'default',delay:'red',rev:'amber',new:'green',gone:'teal'}[k]||'default');}}});
  renderChanges();
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

// ══ CCN B 트레킹 ══
let trkFilterState = new Set(['all']);
function toggleTrkFilter(f) {
  if(f==='all'){trkFilterState.clear();trkFilterState.add('all');}
  else{trkFilterState.delete('all');trkFilterState.has(f)?trkFilterState.delete(f):trkFilterState.add(f);if(!trkFilterState.size)trkFilterState.add('all');}
  ['all','has','none','shipped'].forEach(k=>{const el=document.getElementById('trk-'+k);if(el){el.classList.remove('on','default','amber','red','green');
    if(trkFilterState.has(k)){el.classList.add('on');el.classList.add({all:'default',has:'amber',none:'red',shipped:'green'}[k]||'default');}}});
  renderTracking();
}

function renderTracking() {
  var _tb=document.getElementById('tracking-body');
  if(!_tb) return; // CCN B 트레킹 페이지 제거됨 → 안전 no-op
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

function toggleTrack(key, header) {
  const id = 'tb-' + key.replace(/[|.]/g,'');
  const body = document.getElementById(id);
  if(!body) return;
  body.classList.toggle('open');
}

// ══ 납품 완료 탭 ══
let dvFilter = new Set(['all']);
let dvPage = 1;
const DV_PER = 25;
let dvEditId = null;

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

// ── 납품완료 수정 모달 ──
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

// ── PO로 복원 ──
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

// ── CSV 내보내기 ──
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

// ══ 매출 대시보드 ══
const LS_SALES = 'po_sales_history';
let salesYear = new Date().getFullYear();
let salesFilter = new Set(['all']);
let salesPage = 1;
const SALES_PER = 30;

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


// ══════════════════ PO 대시보드 납기 캘린더 (Promise Date 기준) ══════════════════
var _dashCalM = null; // 표시 중인 달 (Date, 매월 1일)
function dashCalMove(d){ if(!_dashCalM){ _dashCalM=new Date(); _dashCalM.setDate(1); } _dashCalM.setMonth(_dashCalM.getMonth()+d); renderDashCal(); }
function dashCalToday(){ _dashCalM=new Date(); _dashCalM.setDate(1); renderDashCal(); }
function renderDashCal(){
  var grid=document.getElementById('dash-cal-grid');
  var titleEl=document.getElementById('dash-cal-title');
  if(!grid) return;
  if(!_dashCalM){ _dashCalM=new Date(); _dashCalM.setDate(1); }
  var y=_dashCalM.getFullYear(), m=_dashCalM.getMonth();
  if(titleEl) titleEl.textContent = y+'년 '+(m+1)+'월';

  // Promise Date 기준 그룹 (미납품 건만: _delivered 아닌 것)
  var byDate={};
  (PO||[]).forEach(function(r){
    if(!r.promise || r._delivered) return;
    var d=String(r.promise).slice(0,10);
    if(!byDate[d]) byDate[d]=[];
    byDate[d].push(r);
  });

  var days=['일','월','화','수','목','금','토'];
  var html=days.map(function(d,i){ return '<div class="dash-cal-hdr '+(i===0?'sun':i===6?'sat':'')+'">'+d+'</div>'; }).join('');

  var first=new Date(y,m,1), last=new Date(y,m+1,0);
  var today=new Date(); today.setHours(0,0,0,0);

  for(var i=0;i<first.getDay();i++) html+='<div class="pb-cal-day other-month"></div>';

  for(var day=1; day<=last.getDate(); day++){
    var key=y+'-'+String(m+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    var dt=new Date(y,m,day);
    var isToday=dt.getTime()===today.getTime();
    var overdue=dt.getTime()<today.getTime();
    var items=byDate[key]||[];
    // 품번별 수량 합산
    var byItem={};
    items.forEach(function(r){ var k=r.item||'?'; byItem[k]=(byItem[k]||0)+(Number(r.qty)||0); });
    var keys=Object.keys(byItem);
    html+='<div class="pb-cal-day'+(isToday?' today':'')+'">';
    html+='<div class="pb-cal-daynum">'+(isToday?'✦ ':'')+day
        +(keys.length?' <span style="float:right;color:var(--accent);font-size:10px">'+keys.length+'건</span>':'')+'</div>';
    keys.slice(0,4).forEach(function(it){
      html+='<div class="pb-cal-item po'+(overdue?' overdue':'')+'" title="'+it+' · '+byItem[it].toLocaleString()+'개">'
          + it + ' <span style="float:right">'+byItem[it].toLocaleString()+'</span></div>';
    });
    if(keys.length>4) html+='<div class="dash-cal-more">+'+(keys.length-4)+' 더…</div>';
    html+='</div>';
  }

  var remain=(7-(first.getDay()+last.getDate())%7)%7;
  for(var i=0;i<remain;i++) html+='<div class="pb-cal-day other-month"></div>';

  grid.innerHTML=html;
}
