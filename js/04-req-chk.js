function exportBOMView(parentPN){
  const children=BOM[parentPN]||[];
  const parent=DB.find(x=>x.pn===parentPN)||{pn:parentPN};
  const esc=v=>{const s=String(v==null?'':v);return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:s;};
  const header=['상위품번','상위품명','LV','하위품번','Category','품명','제조사','제조사품번','REV','수량','실수량','단위','정품/대체품','비고','보관좌표'];
  const rows=children.map(c=>{
    const r=DB.find(x=>x.pn===c.pn)||{};
    const altStr=c.isAlt?`대체(${c.isAlt})`:r.ia?`대체(${r.ay||''})`: '정품';
    return [parentPN,parent.d||'',c.lv||1,c.pn,r.ct||'',r.d||c.desc||'',r.mg||c.mfg||'',r.mp||c.mfgPn||'',r.rv||'',c.qty,c.aqty??c.qty,c.unit||'EA',altStr,c.note||'',r.lc||c.loc||''];
  });
  const csv=[header,...rows].map(r=>r.map(esc).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`BOM_${parentPN}_${new Date().toISOString().split('T')[0]}.csv`;a.click();
  URL.revokeObjectURL(url);
}

// ── 불출 요청 패널 ──
function addToReq(pn){
  const r=DB.find(x=>x.pn===pn)||{pn};
  if(reqItems.find(x=>x.pn===pn)){
    alert(`${pn}은 이미 요청 목록에 있습니다`);return;
  }
  reqItems.push({pn,d:r.d||'',qty:1,unit:'EA',note:''});
  renderReqPanel();
  // 자재불출요청 탭으로 자동 이동
  srchTab("req");
}

function addBOMToReq(parentPN){
  const children=BOM[parentPN]||[];
  children.forEach(item=>{
    if(!reqItems.find(x=>x.pn===item.pn)){
      const r=DB.find(x=>x.pn===item.pn)||{pn:item.pn,d:''};
      reqItems.push({pn:item.pn,d:r.d||'',qty:item.qty||1,unit:'EA',note:''});
    }
  });
  renderReqPanel();
}

function removeReqItem(i){reqItems.splice(i,1);renderReqPanel();}

function renderReqPanel(){
  const panel=document.getElementById('req-panel');
  panel.style.display=reqItems.length||true?'block':'none'; // 항상 표시
  document.getElementById('req-tbody').innerHTML=reqItems.length
    ? reqItems.map((r,i)=>`<tr>
        <td style="text-align:center"><input type="checkbox" class="lt-chk" data-pn="${r.pn}" onchange="ltSelChange()" style="accent-color:var(--teal);width:13px;height:13px"></td>
    <td style="font-family:var(--mono);font-size:11px;color:var(--tel)">${r.pn}</td>
        <td style="font-size:12px">${r.d||'—'}</td>
        <td><input type="number" min="1" value="${r.qty}" style="width:60px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:3px 6px;color:var(--text);font-size:12px" onchange="reqItems[${i}].qty=+this.value"></td>
        <td><select style="background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:3px 5px;color:var(--text);font-size:12px" onchange="reqItems[${i}].unit=this.value"><option>EA</option><option>M</option><option>Foot</option></select></td>
        <td><input type="text" placeholder="비고" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:3px 6px;color:var(--text);font-size:12px" onchange="reqItems[${i}].note=this.value"></td>
        <td><button class="btn br-btn sm" style="padding:2px 7px" onclick="removeReqItem(${i})">✕</button></td>
      </tr>`).join('')
    : `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:16px;font-size:12px">검색결과에서 + 불출요청 버튼을 눌러 품목을 추가하세요</td></tr>`;
}

function clearReq(){
  if(reqItems.length&&!confirm('요청 목록을 초기화하시겠습니까?'))return;
  reqItems=[];renderReqPanel();
}

function submitReq(){
  if(!reqItems.length){alert('요청 품목이 없습니다');return;}
  const dt=document.getElementById('req-dt').value;
  const dest=document.getElementById('req-dest').value.trim();
  const rec=document.getElementById('req-rec').value.trim();
  const pur=document.getElementById('req-pur').value;
  if(!dt||!dest){alert('요청일과 출고처를 입력하세요');return;}

  reqItems.forEach(r=>{
    const dbr=DB.find(x=>x.pn===r.pn)||{};
    OUT.unshift({date:dt,pn:r.pn,mfg_pn:dbr.mp||'',qty:r.qty,unit:r.unit,
      purpose:pur,dest,receiver:rec,note:'[불출요청]'+(r.note||''),
      _done:false,_added:new Date().toLocaleString('ko-KR')});
  });
  sv(K.OUT,OUT);
  var cnt=reqItems.length;
  reqItems=[];renderReqPanel();
  renderOut(); updateStat();
  alert('✅ '+cnt+'건 불출 요청이 등록됐습니다.\n구매관리 → 자재불출 탭에서 확인하세요.');
}


// ══ 재고점검 탭 ══
const GRADE_CYCLE={A:30,B:91,C:183};
const GRADE_LABEL={A:'월간',B:'분기',C:'반기'};
const GRADE_COLOR={A:'var(--grn)',B:'var(--tel)',C:'var(--amb)'};

let chkViewMode='full';
let cF=new Set(['all']), chkPn=1; const CHKP=30;
let editChkPN=null, chkInPN=null;
let bulkOpen=false;

function initChk(){
  syncDBtoCHK(); // DB 기준 자동 연동
  document.getElementById('blk-dt').value=new Date().toISOString().split('T')[0];
  renderChkFull();
  loadBulkItems();
  if(chkViewMode==='wire') renderWire();
}

function chkMode(m){
  chkViewMode=m;
  document.getElementById('cm-full').classList.toggle('on', m==='full');
  document.getElementById('cm-wire').classList.toggle('on', m==='wire');
  document.getElementById('chk-full-view').style.display=m==='full'?'':'none';
  document.getElementById('chk-wire-view').style.display=m==='wire'?'':'none';
  if(m==='wire') renderWire();
}

function cChip(f){
  if(f==='all'){cF.clear();cF.add('all');}
  else{cF.delete('all');cF.has(f)?cF.delete(f):cF.add(f);if(!cF.size)cF.add('all');}
  document.querySelectorAll('[id^="cc-"]').forEach(el=>el.classList.remove('on'));
  cF.forEach(k=>{document.getElementById('cc-'+k)?.classList.add('on');});
  chkPn=1; renderChkFull();
}

function isOverdue(item){
  if(!item.lastDate) return true;
  const cycle=GRADE_CYCLE[item.grade]||30;
  return (Date.now()-new Date(item.lastDate).getTime())/86400000 > cycle;
}
function daysSinceLast(item){
  if(!item.lastDate) return null;
  return Math.floor((Date.now()-new Date(item.lastDate).getTime())/86400000);
}
function getInspector(){
  return document.getElementById('chk-inspector')?.value.trim()||'';
}

// ── 다품목 일괄 입력 ──
function toggleBulk(){
  bulkOpen=!bulkOpen;
  document.getElementById('bulk-body').style.display=bulkOpen?'':'none';
  document.getElementById('bulk-arrow').textContent=bulkOpen?'▲':'▼';
  if(bulkOpen) loadBulkItems();
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

function bulkInputChange(pn,el,sf){
  const v=parseFloat(el.value);
  el.className=isNaN(v)?'':(sf>0?(v>=sf?'b-ok':'b-low'):'b-ok');
}

function saveBulkAll(){
  const dt=document.getElementById('blk-dt')?.value;
  if(!dt){alert('점검일을 입력하세요');return;}
  const insp=document.getElementById('blk-insp')?.value.trim()||getInspector()||'';
  const rows=document.querySelectorAll('[id^="brow-"]');
  let cnt=0, skipped=0;
  rows.forEach(tr=>{
    const safeId=tr.id.replace('brow-','');
    const qEl=document.getElementById('bq-'+safeId);
    const nEl=document.getElementById('bn-'+safeId);
    if(!qEl||qEl.value===''){skipped++;return;}
    // 원래 품번 복원 (safeId는 특수문자를 _로 치환했으므로 CHK에서 찾기)
    const r=CHK.find(x=>x.pn.replace(/\W/g,'_')===safeId);
    if(!r){skipped++;return;}
    const qty=parseFloat(qEl.value);
    const note=nEl?.value.trim()||'';
    const sf=r.sf>0?r.sf:(DB.find(x=>x.pn===r.pn)||{sf:0}).sf||0;
    const ok=sf>0?(qty>=sf):true;
    const idx=CHK.indexOf(r);
    CHK[idx].lastDate=dt;CHK[idx].lastQty=qty;CHK[idx].lastNote=note;CHK[idx].lastInsp=insp;
    if(!CHKHIST[r.pn])CHKHIST[r.pn]=[];
    CHKHIST[r.pn].unshift({date:dt,qty,note,ok,sf,insp});
    cnt++;
  });
  sv(K.CHK,CHK);sv(K.CHKHIST,CHKHIST);
  renderChkFull();loadBulkItems();
  alert(`✅ ${cnt}건 저장 완료${skipped?` (${skipped}건 수량 미입력 건너뜀)`:''}`);
}

// ── 조달팀 전체 뷰 렌더 ──
function renderChkFull(){
  const q=(document.getElementById('cq')||{value:''}).value.toLowerCase();
  // 지원본부 품목 (하네스 제외)
  let data=CHK.filter(r=>{
    const dbr=DB.find(x=>x.pn===r.pn)||{};
    const dept=dbr.dept||r.dept||'지원본부';
    if(dept==='하네스') return false;
    if(q&&!(r.pn+r.desc).toLowerCase().includes(q)) return false;
    if(cF.has('all')) return true;
    if(cF.has('A')&&r.grade==='A') return true;
    if(cF.has('B')&&r.grade==='B') return true;
    if(cF.has('C')&&r.grade==='C') return true;
    if(cF.has('over')&&isOverdue(r)) return true;
    if(cF.has('done')&&r.lastDate) return true;
    return false;
  });
  const tot=data.length, pages=Math.ceil(tot/CHKP)||1;
  if(chkPn>pages)chkPn=1;
  const sl=data.slice((chkPn-1)*CHKP,chkPn*CHKP);
  document.getElementById('chk-cnt').textContent=`${tot}건`;
  document.getElementById('chk-pgn').textContent=`${chkPn}/${pages} (${tot}건)`;
  document.getElementById('chkp').disabled=chkPn===1;
  document.getElementById('chkn').disabled=chkPn===pages;

  if(!CHK.length){
    document.getElementById('chk-tbody').innerHTML=`<tr><td colspan="14" style="text-align:center;padding:40px;color:var(--text3)">점검 목록이 없습니다. <b>+ 품목 추가</b>로 등록하세요.</td></tr>`;
    return;
  }
  document.getElementById('chk-tbody').innerHTML=sl.map(r=>{
    const over=isOverdue(r);
    const days=daysSinceLast(r);
    const dbr=DB.find(x=>x.pn===r.pn)||{};
    const sf=r.sf>0?r.sf:dbr.sf||0;
    const mfg=dbr.mg||'—';
    const mfgPn=dbr.mp||'—';
    const lastQty=r.lastQty!==undefined?r.lastQty:'—';
    const stockCls=sf>0&&r.lastQty!==undefined?(r.lastQty>=sf?'grn':r.lastQty>0?'amb':'red'):'text3';
    const statusTxt=r.lastDate?(r.lastQty!==undefined&&sf>0?(r.lastQty>=sf?'✅ 충족':'⚠️ 부족'):'✔ 완료'):'🔴 미점검';
    const overTxt=over&&r.lastDate?`<span style="color:var(--red);font-size:10px"> (${days}일)</span>`:'';
    const inspTxt=r.lastInsp?`<span style="font-size:11px;color:var(--text2)">${r.lastInsp}</span>`:'—';
    return `<tr class="${over?'chk-over':''}">
      <td><input type="checkbox" class="recv-chk item-chk" data-idx="${CHK.indexOf(r)}"></td>
      <td style="text-align:center"><input type="checkbox" class="lt-chk" data-pn="${r.pn}" onchange="ltSelChange()" style="accent-color:var(--teal);width:13px;height:13px"></td>
    <td style="font-family:var(--mono);font-size:11px;color:var(--tel)">${r.pn}</td>
      <td style="color:var(--text)" title="${r.desc||''}">${r.desc||'—'}</td>
      <td style="font-size:11px;color:var(--text2)">${mfg}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${mfgPn}</td>
      <td><span class="bd" style="background:${GRADE_COLOR[r.grade]||'var(--bg4)'}22;color:${GRADE_COLOR[r.grade]||'var(--text3)'};border:1px solid ${GRADE_COLOR[r.grade]||'var(--border)'}">${r.grade||'—'}</span></td>
      <td style="font-size:11px;color:var(--text3)">${GRADE_LABEL[r.grade]||'—'}</td>
      <td style="font-family:var(--mono);text-align:right">${sf||'—'}</td>
      <td style="font-family:var(--mono);text-align:right;color:var(--${stockCls})">${lastQty}</td>
      <td style="font-size:11px">${r.lastDate||'<span style="color:var(--red)">없음</span>'}${overTxt}</td>
      <td>${inspTxt}</td>
      <td style="font-size:11px">${statusTxt}</td>
      <td style="font-size:11px;color:var(--text3)" title="${r.note||''}">${r.note||'—'}</td>
      <td><div style="display:flex;gap:4px">
        <button class="btn bt-btn sm" style="padding:3px 7px;font-size:10px" onclick="openChkIn('${r.pn}')">입력</button>
        <button class="btn bk-btn sm" style="padding:3px 7px;font-size:10px" onclick="openChkHist('${r.pn}')">이력</button>
        <button class="btn bk-btn sm" style="padding:3px 7px;font-size:10px" onclick="openEditChk('${r.pn}')">편집</button>
      </div></td>
    </tr>`;
  }).join('');
}
function chkPg(d){chkPn+=d;renderChkFull();}
function toggleAllChk(el){document.querySelectorAll('.item-chk').forEach(c=>c.checked=el.checked);}

// ── 품목 추가/편집 ──
function openAddChkModal(){
  editChkPN=null;
  document.getElementById('m-chk-title').innerHTML='점검 품목 추가 <button class="mx" onclick="closeM(\'m-chk\')">✕</button>';
  document.getElementById('ck-del').style.display='none';
  ['ck-pn','ck-desc','ck-sf','ck-note'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('ck-gr').value='B';
  document.getElementById('m-chk').classList.add('on');
}
function openEditChk(pn){
  const r=CHK.find(x=>x.pn===pn);if(!r)return;
  editChkPN=pn;
  document.getElementById('m-chk-title').innerHTML='점검 품목 편집 <button class="mx" onclick="closeM(\'m-chk\')">✕</button>';
  document.getElementById('ck-del').style.display='';
  document.getElementById('ck-pn').value=r.pn;
  document.getElementById('ck-gr').value=r.grade||'B';
  document.getElementById('ck-desc').value=r.desc||'';
  document.getElementById('ck-sf').value=r.sf||'';
  document.getElementById('ck-note').value=r.note||'';
  document.getElementById('m-chk').classList.add('on');
}
function autoFillChk(){
  const pn=document.getElementById('ck-pn').value.trim();
  const r=DB.find(x=>x.pn===pn);
  if(r){
    document.getElementById('ck-desc').value=r.d||'';
    document.getElementById('ck-sf').value=r.sf||'';
    if(pn.startsWith('77'))document.getElementById('ck-gr').value='B';
  }
}
function saveChkItem(){
  const pn=document.getElementById('ck-pn').value.trim();
  if(!pn){alert('품번을 입력하세요');return;}
  const obj={pn,grade:document.getElementById('ck-gr').value||'B',
    desc:document.getElementById('ck-desc').value.trim()||(DB.find(x=>x.pn===pn)||{d:''}).d||'',
    sf:parseFloat(document.getElementById('ck-sf').value)||0,
    note:document.getElementById('ck-note').value.trim(),
    lastDate:null,lastQty:undefined,lastNote:'',lastInsp:''};
  if(editChkPN){
    const idx=CHK.findIndex(x=>x.pn===editChkPN);
    if(idx>=0){const old=CHK[idx];obj.lastDate=old.lastDate;obj.lastQty=old.lastQty;obj.lastNote=old.lastNote;obj.lastInsp=old.lastInsp||'';CHK[idx]=obj;}
  } else {
    if(CHK.find(x=>x.pn===pn)){alert('이미 등록된 품번입니다');return;}
    CHK.push(obj);
  }
  sv(K.CHK,CHK);closeM('m-chk');renderChkFull();loadBulkItems();
}
function delChkItem(){
  if(!editChkPN||!confirm('삭제하시겠습니까?'))return;
  const idx=CHK.findIndex(x=>x.pn===editChkPN);
  if(idx>=0)CHK.splice(idx,1);
  sv(K.CHK,CHK);closeM('m-chk');renderChkFull();loadBulkItems();
}

// ── 실재고 단건 입력 ──
function openChkIn(pn){
  chkInPN=pn;
  const r=CHK.find(x=>x.pn===pn)||{};
  document.getElementById('m-chkin-title').innerHTML=`실재고 입력 — <span style="font-family:var(--mono);color:var(--tel)">${pn}</span> <button class="mx" onclick="closeM('m-chkin')">✕</button>`;
  document.getElementById('cin-dt').value=new Date().toISOString().split('T')[0];
  document.getElementById('cin-insp').value=getInspector();
  document.getElementById('cin-qty').value=r.lastQty!==undefined?r.lastQty:'';
  document.getElementById('cin-note').value='';
  document.getElementById('m-chkin').classList.add('on');
}
function saveChkIn(){
  const qty=document.getElementById('cin-qty').value;
  if(qty===''){alert('실재고를 입력하세요');return;}
  const dt=document.getElementById('cin-dt').value;
  const note=document.getElementById('cin-note').value.trim();
  const insp=document.getElementById('cin-insp').value.trim()||getInspector()||'';
  let idx=CHK.findIndex(x=>x.pn===chkInPN);
  if(idx<0){
    const dbr=DB.find(x=>x.pn===chkInPN)||{};
    CHK.push({pn:chkInPN,grade:'B',desc:dbr.d||'',sf:dbr.sf||0,note:'',lastDate:null,lastQty:undefined,lastNote:'',lastInsp:''});
    idx=CHK.length-1;
  }
  const sf=CHK[idx].sf||0;
  const ok=sf>0?(+qty>=sf):true;
  CHK[idx].lastDate=dt;CHK[idx].lastQty=+qty;CHK[idx].lastNote=note;CHK[idx].lastInsp=insp;
  if(!CHKHIST[chkInPN])CHKHIST[chkInPN]=[];
  CHKHIST[chkInPN].unshift({date:dt,qty:+qty,note,ok,sf,insp});
  sv(K.CHK,CHK);sv(K.CHKHIST,CHKHIST);
  closeM('m-chkin');renderChkFull();loadBulkItems();
  if(chkViewMode==='wire')renderWire();
}

// ── 점검 이력 모달 ──
function openChkHist(pn){
  const hist=CHKHIST[pn]||[];
  const r=CHK.find(x=>x.pn===pn)||{};
  document.getElementById('m-chkhist-title').innerHTML=`점검 이력 — <span style="font-family:var(--mono);color:var(--tel)">${pn}</span> <span style="font-size:12px;color:var(--text3)">${r.desc||''}</span> <button class="mx" onclick="closeM('m-chkhist')">✕</button>`;
  document.getElementById('chkhist-list').innerHTML=!hist.length
    ?'<div style="text-align:center;padding:30px;color:var(--text3);font-size:12px">점검 이력이 없습니다</div>'
    :hist.map(h=>`<div class="ht-item">
        <div class="ht-dot ${h.ok?'ok':'low'}"></div>
        <div class="ht-body">
          <div class="ht-date">${h.date}${h.insp?` · <b>${h.insp}</b>`:''}</div>
          <div class="ht-val" style="color:${h.ok?'var(--grn)':'var(--red)'}">${h.qty} <span style="font-size:11px;color:var(--text3)">/ 안전재고 ${h.sf||'—'}</span></div>
          ${h.note?`<div class="ht-note">${h.note}</div>`:''}
        </div>
      </div>`).join('');
  document.getElementById('m-chkhist').classList.add('on');
}

// ── 하네스팀 와이어 뷰 ──
// ── DB → CHK 자동 연동 ──
// DB에 관리부서가 지원본부/하네스인 품목 → CHK에 없으면 자동 추가
function syncDBtoCHK(){
  let added=0;
  DB.forEach(r=>{
    if(!r.dept||r.dept==='미관리') return;
    if(CHK.find(x=>x.pn===r.pn)) return; // 이미 있음
    CHK.push({
      pn:r.pn, grade:'B',
      sf:r.sf||0, note:'',
      lastDate:null, lastQty:undefined, lastNote:'', lastInsp:''
    });
    added++;
  });
  // CHK에 있는데 DB에서 품명/안전재고 변경된 경우 동기화
  CHK.forEach((c,i)=>{
    const dbr=DB.find(x=>x.pn===c.pn);
    if(dbr){
      if(dbr.d&&dbr.d!==c.desc) CHK[i].desc=dbr.d;
      if(dbr.sf>0&&dbr.sf!==c.sf) CHK[i].sf=dbr.sf;
    }
  });
  if(added>0){sv(K.CHK,CHK);}
  return added;
}

// ── 하네스팀 뷰 상태 ──
let wF=new Set(['all']), wirePn=1; const WIREP=30;
function wChip(f){
  if(f==='all'){wF.clear();wF.add('all');}
  else{wF.delete('all');wF.has(f)?wF.delete(f):wF.add(f);if(!wF.size)wF.add('all');}
  document.querySelectorAll('[id^="wc-"]').forEach(el=>el.classList.remove('on'));
  wF.forEach(k=>{document.getElementById('wc-'+k)?.classList.add('on');});
  wirePn=1; renderWire();
}
function wirePg(d){wirePn+=d;renderWire();}
function toggleAllWire(el){document.querySelectorAll('.wire-item-chk').forEach(c=>c.checked=el.checked);}

// ── 하네스팀 체크리스트 ──
function renderWire(){
  syncDBtoCHK();
  const q=(document.getElementById('wq')||{value:''}).value.toLowerCase();
  let data=CHK.filter(r=>{
    const dbr=DB.find(x=>x.pn===r.pn)||{};
    const dept=dbr.dept||r.dept||'';
    if(dept!=='하네스') return false;
    if(q&&!(r.pn+r.desc).toLowerCase().includes(q)) return false;
    if(wF.has('all')) return true;
    if(wF.has('A')&&r.grade==='A') return true;
    if(wF.has('B')&&r.grade==='B') return true;
    if(wF.has('C')&&r.grade==='C') return true;
    if(wF.has('over')&&isOverdue(r)) return true;
    if(wF.has('done')&&r.lastDate) return true;
    return false;
  });

  const tot=data.length, pages=Math.ceil(tot/WIREP)||1;
  if(wirePn>pages)wirePn=1;
  const sl=data.slice((wirePn-1)*WIREP,wirePn*WIREP);
  document.getElementById('wire-cnt').textContent=`${tot}건`;
  document.getElementById('wire-pgn').textContent=`${wirePn}/${pages} (${tot}건)`;
  document.getElementById('wirep').disabled=wirePn===1;
  document.getElementById('wiren').disabled=wirePn===pages;

  if(!data.length){
    document.getElementById('wire-tbody').innerHTML=`<tr><td colspan="14" style="text-align:center;padding:40px;color:var(--text3)">하네스팀 점검 품목이 없습니다.<br><span style="font-size:11px">품목 DB에서 관리부서를 <b style="color:var(--pur)">하네스</b>로 설정하면 자동으로 표시됩니다.</span></td></tr>`;
    updateHnPendingCnt();
    return;
  }

  document.getElementById('wire-tbody').innerHTML=sl.map(r=>{
    const dbr=DB.find(x=>x.pn===r.pn)||{};
    const over=isOverdue(r);
    const days=daysSinceLast(r);
    const sf=r.sf>0?r.sf:dbr.sf||0;
    const mfg=dbr.mg||'—';
    const mfgPn=dbr.mp||'—';
    const lastQty=r.lastQty!==undefined?r.lastQty:'—';
    const stockCls=sf>0&&r.lastQty!==undefined?(r.lastQty>=sf?'grn':r.lastQty>0?'amb':'red'):'text3';
    const statusTxt=r.lastDate?(r.lastQty!==undefined&&sf>0?(r.lastQty>=sf?'✅ 충족':'⚠️ 부족'):'✔ 완료'):'🔴 미점검';
    const overTxt=over&&r.lastDate?`<span style="color:var(--red);font-size:10px"> (${days}일)</span>`:'';
    const inspTxt=r.lastInsp?`<span style="font-size:11px;color:var(--text2)">${r.lastInsp}</span>`:'—';
    return `<tr class="${over?'chk-over':''}">
      <td><input type="checkbox" class="recv-chk wire-item-chk" data-idx="${CHK.indexOf(r)}"></td>
      <td style="text-align:center"><input type="checkbox" class="lt-chk" data-pn="${r.pn}" onchange="ltSelChange()" style="accent-color:var(--teal);width:13px;height:13px"></td>
    <td style="font-family:var(--mono);font-size:11px;color:var(--tel)">${r.pn}</td>
      <td style="color:var(--text)" title="${r.desc||''}">${r.desc||'—'}</td>
      <td style="font-size:11px;color:var(--text2)">${mfg}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${mfgPn}</td>
      <td><span class="bd" style="background:${GRADE_COLOR[r.grade]||'var(--bg4)'}22;color:${GRADE_COLOR[r.grade]||'var(--text3)'};border:1px solid ${GRADE_COLOR[r.grade]||'var(--border)'}">${r.grade||'—'}</span></td>
      <td style="font-size:11px;color:var(--text3)">${GRADE_LABEL[r.grade]||'—'}</td>
      <td style="font-family:var(--mono);text-align:right">${sf||'—'}</td>
      <td style="font-family:var(--mono);text-align:right;color:var(--${stockCls})">${lastQty}</td>
      <td style="font-size:11px">${r.lastDate||'<span style="color:var(--red)">없음</span>'}${overTxt}</td>
      <td>${inspTxt}</td>
      <td style="font-size:11px">${statusTxt}</td>
      <td style="font-size:11px;color:var(--text3)" title="${r.note||''}">${r.note||'—'}</td>
      <td><div style="display:flex;gap:4px">
        <button class="btn bt-btn sm" style="padding:3px 7px;font-size:10px" onclick="openChkIn('${r.pn}')">입력</button>
        <button class="btn bk-btn sm" style="padding:3px 7px;font-size:10px" onclick="openChkHist('${r.pn}')">이력</button>
        <button class="btn bk-btn sm" style="padding:3px 7px;font-size:10px" onclick="openEditChk('${r.pn}')">편집</button>
      </div></td>
    </tr>`;
  }).join('');
  updateHnPendingCnt();
}

function hnCard(r){
  const sf=r.sf>0?r.sf:(DB.find(x=>x.pn===r.pn)||{sf:0}).sf||0;
  const over=isOverdue(r);
  const overTag=over?`<span style="font-size:9px;color:var(--red)"> 기한초과</span>`:'';
  const hist=CHKHIST[r.pn]||[];
  const lastOk=hist.length>0?hist[0].ok:null;
  const cardCls=lastOk===true?'ok':lastOk===false?'low':'na';
  const safeId=r.pn.replace(/\W/g,'_');
  const lastTxt=r.lastDate
    ?`<div style="font-size:10px;color:var(--text3)">${r.lastDate}${r.lastInsp?` · ${r.lastInsp}`:''}</div>`
    :`<div style="font-size:10px;color:var(--amb)">미점검</div>`;
  const okSel=r.lastDate&&lastOk===true?'sel':'';
  const lowSel=r.lastDate&&lastOk===false?'sel':'';
  return `<div class="hn-card ${cardCls}" id="hn-${safeId}">
    <div><div style="font-family:var(--mono);font-size:11px;color:var(--tel)">${r.pn}</div>
      <span class="bd" style="font-size:9px;background:${GRADE_COLOR[r.grade]||'var(--bg4)'}22;color:${GRADE_COLOR[r.grade]||'var(--text3)'}">${r.grade||'—'}</span>${overTag}
    </div>
    <div style="font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.desc||''}">${r.desc||'—'}</div>
    <div style="font-size:11px;text-align:center;color:var(--text3)">SF: <b style="font-family:var(--mono)">${sf||'—'}</b></div>
    <div style="font-size:10px;text-align:center">${lastTxt}${hist.length>0?`<button class="btn bk-btn sm" style="font-size:9px;padding:2px 5px;margin-top:3px" onclick="openChkHist('${r.pn}')">이력 ${hist.length}</button>`:''}</div>
    <div class="hn-btns">
      <button class="hn-ok ${okSel}" id="hn-ok-${safeId}" onclick="saveHnCheck('${r.pn}',true)">✅ 충족</button>
      <button class="hn-low ${lowSel}" id="hn-low-${safeId}" onclick="saveHnCheck('${r.pn}',false)">❌ 미달</button>
    </div>
    <div style="font-size:10px;color:var(--text3)">${r.lastDate||''}${r.lastInsp?`<br>${r.lastInsp}`:''}</div>
  </div>`;
}

function saveHnCheck(pn, ok){
  const dt=document.getElementById('hn-dt')?.value||new Date().toISOString().split('T')[0];
  const insp=document.getElementById('hn-insp')?.value.trim()||getInspector()||'';
  let idx=CHK.findIndex(x=>x.pn===pn);
  if(idx<0){
    const dbr=DB.find(x=>x.pn===pn)||{};
    CHK.push({pn,grade:'B',desc:dbr.d||'',sf:dbr.sf||0,note:'',lastDate:null,lastQty:undefined,lastNote:'',lastInsp:''});
    idx=CHK.length-1;
  }
  const sf=CHK[idx].sf||(DB.find(x=>x.pn===pn)||{sf:0}).sf||0;
  CHK[idx].lastDate=dt;
  CHK[idx].lastQty=ok?sf:0; // 충족=안전재고값, 미달=0 (기록용)
  CHK[idx].lastNote=ok?'충족':'미달';
  CHK[idx].lastInsp=insp;
  if(!CHKHIST[pn])CHKHIST[pn]=[];
  CHKHIST[pn].unshift({date:dt,qty:ok?sf:0,note:ok?'충족':'미달',ok,sf,insp});
  sv(K.CHK,CHK);sv(K.CHKHIST,CHKHIST);

  // 카드 즉시 업데이트
  const card=document.getElementById('hn-'+pn.replace(/\W/g,'_'));
  if(card){
    card.className=`hn-card ${ok?'ok':'low'}`;
    document.getElementById('hn-ok-'+pn.replace(/\W/g,'_'))?.classList.toggle('sel',ok);
    document.getElementById('hn-low-'+pn.replace(/\W/g,'_'))?.classList.toggle('sel',!ok);
    // 최근점검일 셀 업데이트
    const cells=card.querySelectorAll('div');
    if(cells[3]){cells[3].innerHTML=`<div style="font-size:10px;color:var(--text3)">${dt}${insp?' · '+insp:''}</div>`;}
  }
  updateHnPendingCnt();
}

function updateHnPendingCnt(){
  const el=document.getElementById('hn-pending-cnt');
  if(!el)return;
  const hnItems=CHK.filter(r=>{
    const dbr=DB.find(x=>x.pn===r.pn)||{};
    return (dbr.dept||r.dept||'')===('하네스');
  });
  const pending=hnItems.filter(r=>isOverdue(r)).length;
  el.textContent=pending;
}

function wireInputChange(){}  // legacy stub
function saveWireStock(){}    // legacy stub — replaced by saveHnCheck


    // legacy stub — replaced by saveHnCheck


// ══════════════════════════════════════════════════
// ══ BOM 관리 탭 ══
// ══════════════════════════════════════════════════
let bomSelParent=null;
let bomFilter=new Set(['all']);
let bomChildEditId=null;
let bomSubMode='mgmt'; // 'mgmt' | 'req'
let reqData=[];        // 소요량 계산 결과 [{pn,desc,mfg,mfgPn,rv,needQty,unit,altStr,note,dept,loc,isManaged}]
let reqSortKey='';
let reqSortDir=1;
let bomChildSortKey='no'; // 하위품목 정렬 기준
let bomChildSortDir=1;

// ── 서브탭 전환 ──
function bomSubTab(mode){
  bomSubMode=mode;
  document.getElementById('bom-view-mgmt').style.display=mode==='mgmt'?'':'none';
  document.getElementById('bom-view-req').style.display=mode==='req'?'':'none';
  document.getElementById('bst-mgmt').classList.toggle('on',mode==='mgmt');
  document.getElementById('bst-req').classList.toggle('on',mode==='req');
}

// ── BOM 초기화 ──
function resetBOM(){
  if(!confirm('⚠️ BOM 전체를 초기화하시겠습니까?\n\n현재 저장된 모든 BOM 데이터가 삭제됩니다.'))return;
  BOM={};
  sv(K.BOM,BOM);
  bomSelParent=null;
  renderBOM();
  renderBOMChildren();
  updateBOMStat();
  alert('BOM이 초기화되었습니다.');
}

function bChip(f){
  if(f==='all'){bomFilter.clear();bomFilter.add('all');}
  else{bomFilter.delete('all');bomFilter.has(f)?bomFilter.delete(f):bomFilter.add(f);if(!bomFilter.size)bomFilter.add('all');}
  document.querySelectorAll('[id^="bc-"]').forEach(el=>el.classList.remove('on'));
  bomFilter.forEach(k=>{document.getElementById('bc-'+k)?.classList.add('on');});
  renderBOM();
}

function initBOM(){
  renderBOM();
  updateBOMStat();
}

function updateBOMStat(){
  const parents=Object.keys(BOM);
  const totalChildren=parents.reduce((s,p)=>s+(BOM[p]||[]).length,0);
  const allChildren=[...new Set(parents.flatMap(p=>(BOM[p]||[]).map(c=>c.pn)))];
  const notInDB=allChildren.filter(pn=>!DB.find(x=>x.pn===pn)).length;
  const noBOM=DB.filter(r=>(r.ct==='조립도_도면'||r.ct==='하네스_도면'||r.ct==='KIT')&&!BOM[r.pn]).length;
  document.getElementById('bom-s0').textContent=parents.length;
  document.getElementById('bom-s1').textContent=totalChildren;
  document.getElementById('bom-s2').textContent=notInDB;
  document.getElementById('bom-s3').textContent=noBOM;
  if(document.getElementById('b-bom'))document.getElementById('b-bom').textContent=parents.length;
}

function getBOMParents(){
  const q=(document.getElementById('bq')||{value:''}).value.toLowerCase();
  return Object.keys(BOM).filter(pn=>{
    const dbr=DB.find(x=>x.pn===pn)||{};
    if(q&&!(pn+(dbr.d||'')).toLowerCase().includes(q)) return false;
    if(bomFilter.has('all')) return true;
    if(bomFilter.has('조립')&&dbr.ct==='조립도_도면') return true;
    if(bomFilter.has('하네스')&&dbr.ct==='하네스_도면') return true;
    if(bomFilter.has('KIT')&&dbr.ct==='KIT') return true;
    return false;
  }).sort((a,b)=>a.localeCompare(b,'ko'));
}

function renderBOM(){
  updateBOMStat();
  const parents=getBOMParents();
  document.getElementById('bom-parent-cnt').textContent=parents.length+'건';
  const listEl=document.getElementById('bom-parent-list');
  if(!parents.length){
    listEl.innerHTML=`<div class="bom-empty-state" style="padding:30px">
      <div style="font-size:20px;margin-bottom:6px">🧩</div>
      <div style="font-size:12px">등록된 BOM이 없습니다</div>
      <div style="font-size:11px;margin-top:4px">+ BOM 등록으로 추가하세요</div>
    </div>`;
    return;
  }
  listEl.innerHTML=parents.map(pn=>{
    const dbr=DB.find(x=>x.pn===pn)||{};
    const cnt=(BOM[pn]||[]).length;
    const isSel=pn===bomSelParent;
    return `<div class="bom-prow${isSel?' sel':''}" onclick="selectBOMParent('${pn}')">
      <div style="min-width:0;flex:1">
        <div class="bom-ppn">${pn}</div>
        <div class="bom-pdesc">${dbr.d||'<span style="color:var(--amb)">DB 미등록</span>'}</div>
      </div>
      <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
        <span class="bom-pcnt">${cnt}건</span>
        <button class="btn br-btn" style="padding:2px 7px;font-size:10px;border-radius:4px" title="삭제"
          onclick="event.stopPropagation();deleteBOMFromList('${pn}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

function deleteBOMFromList(pn){
  const cnt=(BOM[pn]||[]).length;
  if(!confirm(`상위품번 '${pn}' BOM을 삭제하시겠습니까?\n(하위품목 ${cnt}건)` ))return;
  delete BOM[pn];
  sv(K.BOM,BOM);
  if(bomSelParent===pn){bomSelParent=null;renderBOMChildren();}
  renderBOM();
  updateBOMStat();
}

function selectBOMParent(pn){
  bomSelParent=pn;
  bomChildSortKey='no'; bomChildSortDir=1;
  renderBOM();
  renderBOMChildren();
}

// ── 하위품목 정렬 ──
function sortChildRows(){
  if(!bomSelParent)return;
  // NO → LV → PN 순환
  const keys=['no','lv','pn'];
  const cur=keys.indexOf(bomChildSortKey);
  if(cur<0||cur===keys.length-1){bomChildSortKey='no';bomChildSortDir=1;}
  else{bomChildSortKey=keys[cur+1];}
  BOM[bomSelParent].sort((a,b)=>{
    const va=a[bomChildSortKey]??0, vb=b[bomChildSortKey]??0;
    if(typeof va==='number') return (va-vb)*bomChildSortDir;
    return String(va).localeCompare(String(vb),'ko')*bomChildSortDir;
  });
  sv(K.BOM,BOM);
  renderBOMChildren();
  // 버튼에 현재 정렬 기준 표시
  const btn=document.getElementById('bom-sort-btn');
  if(btn) btn.textContent={no:'⇅ NO순',lv:'⇅ LV순',pn:'⇅ 품번순'}[bomChildSortKey]||'⇅ 정렬';
}

function renderBOMChildren(){
  const pn=bomSelParent;
  const btns=['bom-tree-btn','bom-del-btn','bom-add-child-btn','bom-sort-btn'];
  if(!pn){
    document.getElementById('bom-right-title').textContent='상위품번을 선택하세요';
    document.getElementById('bom-right-sub').textContent='';
    document.getElementById('bom-right-body').innerHTML=`<div class="bom-empty-state"><div style="font-size:32px;margin-bottom:10px">🧩</div><div>왼쪽에서 상위품번을 선택하면</div><div style="font-size:11px;margin-top:4px">하위 부품 목록이 표시됩니다</div></div>`;
    btns.forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
    return;
  }
  const dbr=DB.find(x=>x.pn===pn)||{};
  const children=BOM[pn]||[];
  document.getElementById('bom-right-title').textContent=pn;
  document.getElementById('bom-right-sub').textContent=(dbr.d||'DB 미등록 품번')+` · 하위부품 ${children.length}건`;
  btns.forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='';});

  const tbody=children.map((c,i)=>{
    // pn 호환성 처리
    if(!c.pn&&c.child) c.pn=c.child;
    if(!c.pn&&c.item)  c.pn=c.item;
    if(typeof c.pn==='number') c.pn=String(c.pn);
    c.pn=String(c.pn||'').trim().replace(/\.0$/,'');
    const cdbr=DB.find(x=>String(x.pn||'').replace(/\.0$/,'')===String(c.pn||'').replace(/\.0$/,''))||{};
    const inDB=!!cdbr.pn;
    const lv=c.lv||1;
    const lvCol={1:'var(--tel)',2:'var(--pur)',3:'var(--grn)',4:'var(--amb)',5:'var(--red)'}[lv]||'var(--text3)';
    const altBadge=c.isAlt
      ?`<span class="bd ${c.isAlt==='승인'?'bg':c.isAlt==='미결'?'ba':'bk'}" style="font-size:9px">${c.isAlt}</span>`
      :(cdbr.ia?`<span class="alt-badge" style="font-size:9px">대체</span>`:'<span class="orig-badge" style="font-size:9px">정품</span>');
    const aqtyTxt=c.aqty!==undefined&&c.aqty!==c.qty
      ?`<span style="color:var(--amb)">${c.aqty}</span>`
      :`${c.aqty??c.qty}`;
    return `<tr>
      
      
      <td style="font-family:var(--mono);font-size:11px;color:var(--tel)">${c.pn}${!inDB?` <span class="bd ba" style="font-size:9px">DB없음</span>`:''}</td>
      <td style="color:var(--text)">${cdbr.d||'—'}</td>
      <td style="font-size:11px;color:var(--text3)">${cdbr.mg||'—'}</td>
      <td style="font-size:11px;color:var(--text3);font-family:var(--mono)">${cdbr.mp||'—'}</td>
      <td style="font-family:var(--mono);font-weight:700;color:var(--pur);text-align:right">${c.qty}</td>
      <td style="font-family:var(--mono);text-align:right;font-size:11px">${aqtyTxt}</td>
      <td style="font-size:11px">${c.unit||'EA'}</td>
      <td style="text-align:center">${altBadge}</td>
      <td style="font-size:11px;color:var(--text3)">${c.note||'—'}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--tel);white-space:nowrap">${(DB.find(x=>x.pn===c.pn)||{}).lc||c.loc||'—'}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn bk-btn sm" style="padding:3px 7px;font-size:10px" onclick="editChildRow(${i})">편집</button>
          <button class="btn br-btn sm" style="padding:3px 7px;font-size:10px" onclick="deleteChildRow(${i})">삭제</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('bom-right-body').innerHTML=`
    <div style="overflow-x:auto;max-height:520px;overflow-y:auto">
      <table class="bom-child-table">
        <thead><tr>
          <th style="white-space:nowrap">품번</th>
          <th>품명</th>
          <th style="white-space:nowrap">제조사</th>
          <th style="white-space:nowrap">제조사품번</th>
          <th style="text-align:right;white-space:nowrap">수량</th>
          <th style="text-align:right;white-space:nowrap">실수량</th>
          <th style="white-space:nowrap">단위</th>
          <th style="text-align:center;white-space:nowrap">정품/대체</th>
          <th>비고</th>
          <th style="white-space:nowrap">보관장소</th>
          <th style="width:70px">관리</th>
        </tr></thead>
        <tbody id="bom-child-tbody">${tbody}</tbody>
      </table>
    </div>`;
}

function addChildRow(){
  if(!bomSelParent){alert('상위품번을 먼저 선택하세요');return;}
  const tbody=document.getElementById('bom-child-tbody');
  if(!tbody)return;
  // 기존 추가행 있으면 제거
  document.getElementById('bom-new-row')?.remove();
  const tr=document.createElement('tr');
  tr.id='bom-new-row';
  tr.className='bom-add-row';
  tr.innerHTML=`
    <td><input id="bnr-pn" placeholder="품번" oninput="bnrAutofill()" style="font-family:var(--mono)"></td>
    <td><input id="bnr-desc" placeholder="자동입력" readonly style="color:var(--text3)"></td>
    <td><input id="bnr-mfg" placeholder="자동입력" readonly style="color:var(--text3)"></td>
    <td><input id="bnr-mp" placeholder="자동입력" readonly style="color:var(--text3)"></td>
    <td><input id="bnr-qty" type="number" min="0" step="0.001" placeholder="1" style="text-align:right;font-family:var(--mono)"></td>
    <td><select id="bnr-unit"><option>EA</option><option>M</option><option>Foot</option><option>SET</option><option>KG</option></select></td>
    <td><input id="bnr-note" placeholder="비고"></td>
    <td>
      <div style="display:flex;gap:4px">
        <button class="btn bt-btn sm" style="padding:3px 7px;font-size:10px" onclick="saveNewChild()">✅</button>
        <button class="btn bk-btn sm" style="padding:3px 7px;font-size:10px" onclick="document.getElementById('bom-new-row')?.remove()">✕</button>
      </div>
    </td>`;
  tbody.appendChild(tr);
  document.getElementById('bnr-pn').focus();
}

function bnrAutofill(){
  const pn=document.getElementById('bnr-pn')?.value.trim();
  const r=DB.find(x=>x.pn===pn);
  const desc=document.getElementById('bnr-desc');
  const mfg=document.getElementById('bnr-mfg');
  const mp=document.getElementById('bnr-mp');
  if(r){
    if(desc){desc.value=r.d||'';desc.style.color='var(--text)';}
    if(mfg){mfg.value=r.mg||'';mfg.style.color='var(--text)';}
    if(mp){mp.value=r.mp||'';mp.style.color='var(--text)';}
  } else {
    if(desc){desc.value='';desc.style.color='var(--text3)';}
    if(mfg){mfg.value='';mfg.style.color='var(--text3)';}
    if(mp){mp.value='';mp.style.color='var(--text3)';}
  }
}

function saveNewChild(){
  const pn=document.getElementById('bnr-pn')?.value.trim();
  if(!pn){alert('하위품번을 입력하세요');return;}
  const qty=parseFloat(document.getElementById('bnr-qty')?.value)||1;
  const unit=document.getElementById('bnr-unit')?.value||'EA';
  const note=document.getElementById('bnr-note')?.value.trim()||'';
  if(!BOM[bomSelParent])BOM[bomSelParent]=[];
  // 중복 체크
  if(BOM[bomSelParent].find(c=>c.pn===pn)){
    if(!confirm(`'${pn}'이 이미 등록되어 있습니다. 수량을 갱신하시겠습니까?`))return;
    const idx=BOM[bomSelParent].findIndex(c=>c.pn===pn);
    BOM[bomSelParent][idx]={pn,qty,unit,note};
  } else {
    BOM[bomSelParent].push({pn,qty,unit,note});
  }
  sv(K.BOM,BOM);
  renderBOMChildren();
  updateBOMStat();
}

function editChildRow(i){
  if(!bomSelParent)return;
  const c=BOM[bomSelParent][i];
  if(!c)return;
  // 기존 추가행 제거
  document.getElementById('bom-new-row')?.remove();
  // 해당 행을 편집모드로 교체
  const tbody=document.getElementById('bom-child-tbody');
  const rows=tbody.querySelectorAll('tr');
  const tr=rows[i];
  if(!tr)return;
  const cdbr=DB.find(x=>String(x.pn||'').replace(/\.0$/,'')===String(c.pn||'').replace(/\.0$/,''))||{};
  tr.className='bom-add-row';
  tr.innerHTML=`
    <td><input id="bnr-pn-${i}" value="${c.pn}" oninput="bnrAutofillEdit(${i})" style="font-family:var(--mono)"></td>
    <td><input id="bnr-desc-${i}" value="${cdbr.d||''}" readonly style="color:var(--text3)"></td>
    <td><input id="bnr-mfg-${i}" value="${cdbr.mg||''}" readonly style="color:var(--text3)"></td>
    <td><input id="bnr-mp-${i}" value="${cdbr.mp||''}" readonly style="color:var(--text3)"></td>
    <td><input id="bnr-qty-${i}" type="number" min="0" step="0.001" value="${c.qty}" style="text-align:right;font-family:var(--mono)"></td>
    <td><select id="bnr-unit-${i}">
      <option${c.unit==='EA'?' selected':''}>EA</option>
      <option${c.unit==='M'?' selected':''}>M</option>
      <option${c.unit==='Foot'?' selected':''}>Foot</option>
      <option${c.unit==='SET'?' selected':''}>SET</option>
      <option${c.unit==='KG'?' selected':''}>KG</option>
    </select></td>
    <td><input id="bnr-note-${i}" value="${c.note||''}"></td>
    <td>
      <div style="display:flex;gap:4px">
        <button class="btn bt-btn sm" style="padding:3px 7px;font-size:10px" onclick="saveEditChild(${i})">✅</button>
        <button class="btn bk-btn sm" style="padding:3px 7px;font-size:10px" onclick="renderBOMChildren()">✕</button>
      </div>
    </td>`;
}

function bnrAutofillEdit(i){
  const pn=document.getElementById(`bnr-pn-${i}`)?.value.trim();
  const r=DB.find(x=>x.pn===pn);
  const desc=document.getElementById(`bnr-desc-${i}`);
  const mfg=document.getElementById(`bnr-mfg-${i}`);
  const mp=document.getElementById(`bnr-mp-${i}`);
  if(r){
    if(desc){desc.value=r.d||'';desc.style.color='var(--text)';}
    if(mfg){mfg.value=r.mg||'';mfg.style.color='var(--text)';}
    if(mp){mp.value=r.mp||'';mp.style.color='var(--text)';}
  }
}

function saveEditChild(i){
  const pn=document.getElementById(`bnr-pn-${i}`)?.value.trim();
  if(!pn){alert('품번을 입력하세요');return;}
  const qty=parseFloat(document.getElementById(`bnr-qty-${i}`)?.value)||1;
  const unit=document.getElementById(`bnr-unit-${i}`)?.value||'EA';
  const note=document.getElementById(`bnr-note-${i}`)?.value.trim()||'';
  BOM[bomSelParent][i]={pn,qty,unit,note};
  sv(K.BOM,BOM);
  renderBOMChildren();
  updateBOMStat();
}

function deleteChildRow(i){
  if(!bomSelParent)return;
  if(!confirm('이 하위품목을 삭제하시겠습니까?'))return;
  BOM[bomSelParent].splice(i,1);
  sv(K.BOM,BOM);
  renderBOMChildren();
  updateBOMStat();
  renderBOM();
}

function deleteParentBOM(){
  if(!bomSelParent)return;
  if(!confirm(`상위품번 '${bomSelParent}'의 BOM 전체를 삭제하시겠습니까?\n하위품목 ${(BOM[bomSelParent]||[]).length}건이 모두 삭제됩니다.`))return;
  delete BOM[bomSelParent];
  sv(K.BOM,BOM);
  bomSelParent=null;
  renderBOM();
  renderBOMChildren();
  updateBOMStat();
}

function openAddBOMParent(){
  document.getElementById('bom-add-parent').value='';
  document.getElementById('bom-add-memo').value='';
  document.getElementById('bom-add-parent-info').textContent='';
  document.getElementById('m-bom-add').classList.add('on');
  setTimeout(()=>document.getElementById('bom-add-parent').focus(),100);
}

function bomParentAutofill(){
  const pn=document.getElementById('bom-add-parent')?.value.trim();
  const r=DB.find(x=>x.pn===pn);
  const info=document.getElementById('bom-add-parent-info');
  if(r) info.textContent=`✅ ${r.d||''} ${r.ct?'· '+r.ct:''}`;
  else if(pn) info.textContent='⚠ 품목 DB에 없는 품번 (직접 등록 가능)';
  else info.textContent='';
}

function saveBOMParent(){
  const pn=document.getElementById('bom-add-parent')?.value.trim();
  if(!pn){alert('상위품번을 입력하세요');return;}
  if(BOM[pn]&&BOM[pn].length>0){
    if(!confirm(`'${pn}'은 이미 BOM이 등록되어 있습니다. 이어서 편집하시겠습니까?`))return;
  } else {
    BOM[pn]=BOM[pn]||[];
    sv(K.BOM,BOM);
  }
  closeM('m-bom-add');
  bomSelParent=pn;
  renderBOM();
  renderBOMChildren();
  updateBOMStat();
}

// ── BOM 트리 모달 ──
function openBOMTree(){
  if(!bomSelParent)return;
  const dbr=DB.find(x=>x.pn===bomSelParent)||{};
  document.getElementById('bom-tree-title').innerHTML=
    `🌳 BOM 트리 — <span style="font-family:var(--mono);color:var(--tel)">${bomSelParent}</span> <span style="font-size:12px;color:var(--text3)">${dbr.d||''}</span>
     <button class="mx" onclick="closeM('m-bom-tree')">✕</button>`;
  document.getElementById('bom-tree-body').innerHTML=buildBOMTree(bomSelParent,0,new Set());
  document.getElementById('m-bom-tree').classList.add('on');
}

function buildBOMTree(pn, depth, visited){
  if(visited.has(pn)||depth>6) return `<div style="padding:4px ${depth*20+8}px;font-size:11px;color:var(--red)">⚠ 순환참조 감지: ${pn}</div>`;
  visited=new Set(visited);visited.add(pn);
  const dbr=DB.find(x=>x.pn===pn)||{};
  const children=BOM[pn]||[];
  const indent=depth*20;
  let html=`<div class="tree-row" style="padding-left:${indent+8}px">
    ${depth>0?`<span class="tree-icon">${depth===1?'└':'└'}</span>`:''}
    <span class="tree-pn" style="color:${depth===0?'var(--tel)':'var(--tel)'}">${pn}</span>
    <span class="tree-desc">${dbr.d||'<span style="color:var(--amb)">DB 미등록</span>'}</span>
    ${depth>0?`<span class="tree-qty" style="color:var(--pur)">×${children.find?.[0]?.qty||''}</span>`:''}
  </div>`;
  children.forEach(c=>{
    const cdbr=DB.find(x=>String(x.pn||'').replace(/\.0$/,'')===String(c.pn||'').replace(/\.0$/,''))||{};
    const hasChildren=BOM[c.pn]&&BOM[c.pn].length>0;
    html+=`<div class="tree-row" style="padding-left:${indent+28}px">
      <span class="tree-icon" style="color:var(--border2)">└</span>
      <span class="tree-pn">${c.pn}</span>
      <span class="tree-desc">${cdbr.d||'<span style="color:var(--amb)">DB 미등록</span>'}</span>
      <span class="tree-qty">×${c.qty}${c.unit&&c.unit!=='EA'?' '+c.unit:''}</span>
      <span class="tree-stock" style="color:var(--text3)">${cdbr.sf>0?'SF:'+cdbr.sf:''}</span>
    </div>`;
    if(hasChildren) html+=buildBOMTree(c.pn,depth+1,visited);
  });
  return html;
}

// ══ 소요량 조회 ══
function reqParentAutofill(){
  const pn=document.getElementById('req-parent-pn')?.value.trim();
  const r=DB.find(x=>x.pn===pn);
  const info=document.getElementById('req-parent-info');
  const hasBOM=BOM[pn]&&BOM[pn].length>0;
  if(r) info.innerHTML=`✅ ${r.d||''} ${r.ct?`<span class="bd ${catCls[r.ct]||'bk'}" style="font-size:9px">${r.ct}</span>`:''}${hasBOM?` <span class="bd bt" style="font-size:9px">BOM ${BOM[pn].length}건</span>`:''}`;
  else if(pn&&hasBOM) info.innerHTML=`⚠ DB 미등록 품번 · <span class="bd bt" style="font-size:9px">BOM ${BOM[pn].length}건</span>`;
  else if(pn) info.textContent='⚠ BOM 없음 — 품번 확인 필요';
  else info.textContent='';
}

function calcReq(){
  const pn=document.getElementById('req-parent-pn')?.value.trim();
  const qty=parseFloat(document.getElementById('req-qty')?.value)||1;
  if(!pn){alert('상위품번을 입력하세요');return;}
  const children=BOM[pn];
  if(!children||!children.length){alert(`'${pn}' BOM이 없습니다`);return;}
  const ALT_STR={'승인':'대체(승인)','미결':'대체(미결)','한시적승인':'대체(한시)','검토중':'대체(검토)','불가':'대체(불가)'};
  reqData=children.map(c=>{
    const r=DB.find(x=>x.pn===c.pn)||{};
    const dept=r.dept||'미관리';
    const isManaged=(dept==='지원본부'||dept==='하네스');
    const altStr=c.isAlt?ALT_STR[c.isAlt]||`대체(${c.isAlt})`:r.ia?`대체(${r.ay||''})`: '정품';
    const needQty=Math.round((c.aqty??c.qty)*qty*1000)/1000;
    return {
      lv:c.lv||1, no:c.no||0, pn:c.pn,
      desc:r.d||'—', mfg:r.mg||'—', mfgPn:r.mp||'—', rv:r.rv||'—',
      needQty, unit:c.unit||'EA',
      altStr, note:c.note||r.op?`${c.note||''}${r.op?' 기존:'+r.op:''}`.trim():'—',
      dept, isManaged, loc:r.lc||'—', ct:r.ct||''
    };
  });
  reqSortKey=''; reqSortDir=1;
  // 필터바 표시
  const fb=document.getElementById('req-filter-bar');
  if(fb) fb.style.display='flex';
  document.getElementById('req-print-btn').style.display='';
  document.getElementById('req-csv-btn').style.display='';
  document.getElementById('req-result-wrap').style.display='';
  // 인쇄 헤더
  const pdbr=DB.find(x=>x.pn===pn)||{};
  document.getElementById('req-ph-title').textContent=`소요량 조회 — ${pn}  ×${qty}`;
  document.getElementById('req-ph-sub').textContent=`${pdbr.d||''}  ·  ${new Date().toLocaleDateString('ko-KR')}  ·  총 ${children.length}건`;
  renderReqTable();
}

function renderReqTable(){
  const showMgmt=document.getElementById('req-show-mgmt')?.checked!==false;
  const showUnmgmt=document.getElementById('req-show-unmgmt')?.checked!==false;
  let data=reqData.filter(r=>r.isManaged?showMgmt:showUnmgmt);
  if(reqSortKey){
    data=[...data].sort((a,b)=>{
      const va=a[reqSortKey]??'', vb=b[reqSortKey]??'';
      if(typeof va==='number') return (va-vb)*reqSortDir;
      return String(va).localeCompare(String(vb),'ko')*reqSortDir;
    });
  }
  const mgmt=reqData.filter(r=>r.isManaged).length;
  const unmgmt=reqData.length-mgmt;
  document.getElementById('req-summary').textContent=`관리대상 ${mgmt}건 · 미관리 ${unmgmt}건`;
  // 헤더 정렬 표시
  document.querySelectorAll('#req-thead-row th').forEach(th=>{th.classList.remove('srt');});
  const ALT_BADGE_MAP={'정품':'<span class="orig-badge" style="font-size:9px">정품</span>',};
  document.getElementById('req-bom-tbody').innerHTML=data.map(r=>{
    const deptBadge=r.dept==='지원본부'?`<span class="bd dept-jb" style="font-size:9px">지원</span>`
      :r.dept==='하네스'?`<span class="bd dept-hn" style="font-size:9px">하네스</span>`
      :`<span class="bd dept-na" style="font-size:9px">미관리</span>`;
    const altBadge=r.altStr==='정품'?'<span class="orig-badge" style="font-size:9px">정품</span>'
      :`<span class="alt-badge" style="font-size:9px">${r.altStr}</span>`;
    const lvCol={1:'var(--tel)',2:'var(--pur)',3:'var(--grn)',4:'var(--amb)',5:'var(--red)'}[r.lv]||'var(--text3)';
    return `<tr class="${!r.isManaged?'unmanaged':''}">
      <td style="font-family:var(--mono);font-size:11px;color:${lvCol}">${r.pn}</td>
      <td style="color:var(--text)">${r.desc}</td>
      <td style="font-size:11px;color:var(--text3)">${r.mfg}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${r.mfgPn}</td>
      <td style="font-family:var(--mono);font-size:11px">${r.rv}</td>
      <td style="font-family:var(--mono);font-weight:700;color:var(--pur);text-align:right">${r.needQty}</td>
      <td>${r.unit}</td>
      <td style="text-align:center">${altBadge}</td>
      <td style="font-size:11px;color:var(--text3)">${r.note}</td>
      <td style="text-align:center">${deptBadge}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text3)">${r.loc}</td>
    </tr>`;
  }).join('');
}

function reqSort(key){
  if(reqSortKey===key) reqSortDir*=-1; else{reqSortKey=key;reqSortDir=1;}
  document.querySelectorAll('#req-thead-row th').forEach(th=>{th.classList.remove('srt');});
  // 현재 정렬 th 강조
  const thMap={pn:0,desc:1,mfg:2,mfgPn:3,rv:4,needQty:5,unit:6,altStr:7,note:8,dept:9,loc:10};
  const idx=thMap[key];
  if(idx!==undefined){
    const ths=document.querySelectorAll('#req-thead-row th');
    if(ths[idx]) ths[idx].classList.add('srt');
  }
  renderReqTable();
}

function printReq(){
  // 인쇄 헤더 표시
  document.getElementById('req-print-header').style.display='block';
  window.print();
  setTimeout(()=>{document.getElementById('req-print-header').style.display='none';},500);
}

function exportReqCSV(){
  const showMgmt=document.getElementById('req-show-mgmt')?.checked!==false;
  const showUnmgmt=document.getElementById('req-show-unmgmt')?.checked!==false;
  const data=reqData.filter(r=>r.isManaged?showMgmt:showUnmgmt);
  const header=['품번','품명','제조사','제조사품번','REV','소요량','단위','정품/대체','비고','관리부서','보관좌표'];
  const rows=data.map(r=>[r.pn,r.desc,r.mfg,r.mfgPn,r.rv,r.needQty,r.unit,r.altStr,r.note,r.dept,r.loc]);
  const esc=v=>{const s=String(v==null?'':v);return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:s;};
  const csv=[header,...rows].map(r=>r.map(esc).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const pn=document.getElementById('req-parent-pn')?.value.trim()||'BOM';
  a.href=url;a.download=`소요량_${pn}_${new Date().toISOString().split('T')[0]}.csv`;a.click();
  URL.revokeObjectURL(url);
}

// ── BOM CSV 내보내기 ──
function exportBOMCSV(){
  const rows=[['상위품번','상위품명','NO','LV','하위품번','Category','품명','제조사','제조사품번','수량','실수량','단위','정품/대체품','비고']];
  Object.keys(BOM).sort().forEach(pn=>{
    const pdbr=DB.find(x=>x.pn===pn)||{};
    (BOM[pn]||[]).forEach(c=>{
      const cdbr=DB.find(x=>String(x.pn||'').replace(/\.0$/,'')===String(c.pn||'').replace(/\.0$/,''))||{};
      const altStr=c.isAlt?`대체(${c.isAlt})`:cdbr.ia?`대체(${cdbr.ay||''})`: '정품';
      rows.push([pn,pdbr.d||'',c.no||'',c.lv||1,c.pn,cdbr.ct||'',cdbr.d||'',cdbr.mg||'',cdbr.mp||'',c.qty,c.aqty??c.qty,c.unit||'EA',altStr,c.note||'']);
    });
  });
  const esc=v=>{const s=String(v==null?'':v);return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:s;};
  const csv=rows.map(r=>r.map(esc).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`BOM_전체_${new Date().toISOString().split('T')[0]}.csv`;a.click();
  URL.revokeObjectURL(url);
}

// ── BOM 엑셀 업로드 ──
function openBOMUpload(){
  document.getElementById('bom-up-file').value='';
  document.getElementById('bom-up-result').style.display='none';
  document.getElementById('m-bom-upload').classList.add('on');
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


