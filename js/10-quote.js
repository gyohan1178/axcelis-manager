var QP = { items: [], poNo: '', poDate: '' };

function qSw(id){
  document.querySelectorAll('.q-stab').forEach(function(b){ b.classList.remove('on'); });
  document.querySelectorAll('.q-tp').forEach(function(p){ p.classList.remove('on'); });
  var btn=document.getElementById('qstab-'+id); if(btn) btn.classList.add('on');
  var tp=document.getElementById('q-tp-'+id); if(tp) tp.classList.add('on');
}

/* ── Toast ── */
function qToast(m,t,ms){
  t=t||'ok'; ms=ms||2800;
  var e=document.getElementById('q-toast');
  e.className=t; e.textContent=m; e.style.display='block';
  clearTimeout(e._t); e._t=setTimeout(function(){ e.style.display='none'; },ms);
}

/* ── 환율 ── */
function qUpdRateDisp(){
  var b=+(document.getElementById('q-buy-rate')||{value:1450}).value||1450;
  var s=+(document.getElementById('q-sell-rate')||{value:1250}).value||1250;
  var el=document.getElementById('q-rate-disp');
  if(el) el.textContent='매입 '+b.toLocaleString()+' | 판매 '+s.toLocaleString()+' ₩/$';
}

/* ── DB 조회 (전역 DB 사용) ── */
function qFindItem(pn){
  if(!DB||!DB.length) return null;
  var p=String(pn).trim();
  return DB.find(function(r){ return String(r.pn).trim()===p; })||null;
}

/* ── 설정 ── */
function qGetCfg(){
  var g=function(id,def){ var e=document.getElementById(id); return e?+(e.value)||def:def; };
  return{
    buyRate:  g('q-buy-rate',1450),
    sellRate: g('q-sell-rate',1250),
    laborMarg:g('q-labor-marg',25)/100,
    tiers:[
      {min:1000000,m:g('q-m1',20)/100},
      {min:100000, m:g('q-m2',25)/100},
      {min:10000,  m:g('q-m3',35)/100},
      {min:0,      m:g('q-m4',45)/100},
    ]
  };
}
function qGetMarg(buyKrw,cfg){
  if(!buyKrw||buyKrw<=0) return cfg.tiers[cfg.tiers.length-1].m;
  for(var i=0;i<cfg.tiers.length;i++){ if(buyKrw>=cfg.tiers[i].min) return cfg.tiers[i].m; }
  return cfg.tiers[cfg.tiers.length-1].m;
}

/* ── ASSY 판별 ── */
function qIsAssy(pn){ return /^(10|11|12|16)/.test(String(pn)); }

/* ── toNumber ── */
function qToN(v){ if(v==null||v==='') return null; var n=parseFloat(String(v).replace(/,/g,'')); return isNaN(n)?null:n; }

/* ── BOM Excel 파싱 ── */
function qLoadBOMXl(inp){
  if(!inp||!inp.files[0]) return;
  if(typeof QS==='undefined'||!QS){ window.QS={bomAssies:[],quoteAssies:[]}; }
  qToast('BOM 파일 읽는 중...','info');
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var wb=XLSX.read(e.target.result,{type:'array'});
      var rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:null});
      qParseBOMRows(rows); qToast('✓ BOM 파싱 완료','ok');
    }catch(err){ qToast('BOM 읽기 실패: '+err.message,'err',5000); }
    inp.value='';
  };
  reader.readAsArrayBuffer(inp.files[0]);
}

function qParseBOMRows(rows){
  if(typeof QS==='undefined'||!QS){ window.QS={bomAssies:[],quoteAssies:[]}; }
  QS.bomAssies=[];
  var cur=null;
  var dfl=+(document.getElementById('q-labor-def')||{value:50000}).value||50000;
  for(var i=0;i<rows.length;i++){
    var r=rows[i];
    var lv=r[0]!=null?parseInt(r[0]):null, tp=r[1], pn=r[2]!=null?String(r[2]).trim():'';
    var desc=String(r[3]||''), qty=r[4], unit=String(r[5]||''), rev=String(r[6]||'');
    // 대소문자 무관하게 Part만 처리 (Document, Mfr Part 등 제외)
    if(!tp||String(tp).toLowerCase()!=='part') continue;
    if((qty===0||qty===null)&&unit==='as needed') continue;
    if(lv===0){
      cur={pn:pn,desc:desc,rev:rev,isAssy:qIsAssy(pn),assyQty:1,laborKrw:dfl,parts:[]};
      QS.bomAssies.push(cur);
    } else if(lv!==null && lv!==0){
      if(!cur){ cur={pn:'(미분류)',desc:'미분류',rev:'',isAssy:false,assyQty:1,laborKrw:0,parts:[]}; QS.bomAssies.push(cur); }
      cur.parts.push({pn:pn,desc:desc,qty:qty!=null?qty:0,unit:unit,rev:rev,lv:lv});
    }
  }
  qRefreshBOMTable();
  qUpdBOMCnt();
}

/* ── BOM 테이블 렌더 ── */
function qRefreshBOMTable(){
  var tb=document.getElementById('q-bom-rows');
  if(!tb) return;
  tb.innerHTML='';
  QS.bomAssies.forEach(function(a,ai){
    var atr=document.createElement('tr');
    atr.style.background='var(--bg3)';
    atr.innerHTML='<td class="c"><span class="q-lvc q-lv0">0</span></td>'
      +'<td class="q-apn" style="font-family:var(--mono);font-size:11.5px;color:var(--amb)">'+a.pn+'</td>'
      +'<td style="font-weight:500">'+a.desc+'</td>'
      +'<td class="r" colspan="2"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">'
        +'<span style="font-size:11px;color:var(--text2)">ASSY수량</span>'
        +'<input class="q-aqty-in" type="number" value="'+a.assyQty+'" min="1"'
          +' onchange="QS.bomAssies['+ai+'].assyQty=parseFloat(this.value)||1;qUpdBOMCnt()">'
        +'</div></td>'
      +'<td class="c"><span class="qbdg qbdg-g">'+a.rev+'</span></td>'
      +'<td><button class="q-rdel" onclick="QS.bomAssies.splice('+ai+',1);qRefreshBOMTable();qUpdBOMCnt()">✕</button></td>';
    tb.appendChild(atr);
    a.parts.forEach(function(p,pi){
      var lv=p.lv||1;
      var lvClr={1:'var(--accent)',2:'var(--teal)',3:'var(--text3)'}[lv]||'var(--text3)';
      var lvBg={1:'q-lv1',2:'q-lv2',3:'q-lv3'}[lv]||'q-lv1';
      var indent=(lv-1)*14;
      var ptr=document.createElement('tr');
      if(lv>1) ptr.style.opacity='0.85';
      ptr.innerHTML='<td class="c"><span class="q-lvc '+lvBg+'">'+lv+'</span></td>'
        +'<td style="font-family:var(--mono);font-size:11px;color:'+lvClr+';padding-left:'+(6+indent)+'px">'
          +(lv>1?'<span style="color:var(--text3);margin-right:3px">└</span>':'')
          +p.pn+'</td>'
        +'<td style="font-size:11.5px;color:var(--text2);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+p.desc+'</td>'
        +'<td class="r"><input class="q-bni" type="number" value="'+p.qty+'" min="0"'
          +' onchange="QS.bomAssies['+ai+'].parts['+pi+'].qty=parseFloat(this.value)||0"></td>'
        +'<td class="c" style="font-size:11px;color:var(--text2)">'+p.unit+'</td>'
        +'<td class="c"><span class="qbdg qbdg-g">'+p.rev+'</span></td>'
        +'<td><button class="q-rdel" onclick="QS.bomAssies['+ai+'].parts.splice('+pi+',1);qRefreshBOMTable()">✕</button></td>';
      tb.appendChild(ptr);
    });
  });
}

function qUpdBOMCnt(){
  var total=QS.bomAssies.reduce(function(s,a){return s+a.parts.length;},0);
  var el=document.getElementById('q-bom-cnt');
  if(el) el.textContent=QS.bomAssies.length?QS.bomAssies.length+'개 ASSY / '+total+'개 부품':'';
}

function qAddRow(){
  var tb=document.getElementById('q-bom-rows'); if(!tb) return;
  _qmrid++;
  var id='qmr'+_qmrid;
  var tr=document.createElement('tr');
  tr.id=id;
  tr.innerHTML='<td class="c">'
    +'<select class="q-bsi" style="width:44px" onchange="qRowLvChange(this)">'
    +'<option value="0">0</option><option value="1" selected>1</option></select></td>'
    +'<td><input class="q-bpni" type="text" placeholder="품번 입력" onblur="qRowPnLookup(this)" onkeydown="if(event.key===\'Enter\')qRowPnLookup(this)"></td>'
    +'<td style="font-size:11px;color:var(--text3)" class="q-row-desc">— DB 조회 —</td>'
    +'<td class="r"><input class="q-bni" type="number" value="1" min="0"></td>'
    +'<td class="c"><input class="q-bsi" type="text" value="EA" style="width:46px"></td>'
    +'<td class="c"><input class="q-bsi" type="text" value="" placeholder="REV" style="width:42px"></td>'
    +'<td><button class="q-rdel" onclick="this.closest(\'tr\').remove()">✕</button></td>';
  tb.appendChild(tr);
}

// 품번 입력 후 포커스 아웃 → DB 조회해서 설명 채우기
function qRowPnLookup(inp){
  var pn=inp.value.trim();
  if(!pn) return;
  var tr=inp.closest('tr'); if(!tr) return;
  var descCell=tr.querySelector('.q-row-desc');
  var item=qFindItem(pn);
  if(item){
    if(descCell) descCell.textContent=(item.d||'')+(item.mg?' ['+item.mg+']':'');
    // REV 자동 채우기
    var revInp=tr.querySelectorAll('input')[3];
    if(revInp&&!revInp.value) revInp.value=item.rv||'';
  } else {
    if(descCell){ descCell.textContent='⚠ DB 미등록'; descCell.style.color='var(--red)'; }
  }
}

// LV 0이면 ASSY(수량 필드 숨기지않고 그냥 표시)
function qRowLvChange(sel){
  var tr=sel.closest('tr'); if(!tr) return;
  var lv=parseInt(sel.value);
  var pnInp=tr.querySelector('.q-bpni');
  if(pnInp) pnInp.placeholder=lv===0?'ASSY 품번':'부품 품번';
}

// BOM 테이블 DOM → QS.bomAssies에 반영 후 계산
function qCollectAndRun(){
  if(typeof QS==='undefined'||!QS){ window.QS={bomAssies:[],quoteAssies:[]}; }
  var tb=document.getElementById('q-bom-rows'); if(!tb) return;
  var rows=tb.querySelectorAll('tr');

  if(!rows.length&&!QS.bomAssies.length){ qToast('BOM을 먼저 입력하세요','err'); return; }

  // qRefreshBOMTable로 렌더된 행(파일업로드/붙여넣기)은 QS.bomAssies가 이미 있으므로
  // 수량 input 변경분만 QS.bomAssies에 동기화
  if(QS.bomAssies.length){
    var partIdx=0;
    rows.forEach(function(tr){
      // ASSY 헤더 행: q-bni + ASSY수량 input
      var isAssyRow=tr.querySelector('.q-rdel')&&tr.innerHTML.indexOf('assyQty')>-1;
      var qniInputs=tr.querySelectorAll('input.q-bni');
      // ASSY 행 수량
      if(tr.querySelector('input[onchange*="assyQty"]')){
        var ai=parseInt((tr.querySelector('input[onchange*="assyQty"]').getAttribute('onchange')||'').match(/\[(\d+)\]/)||[0,0]);
        if(!isNaN(ai)&&QS.bomAssies[ai]) QS.bomAssies[ai].assyQty=parseFloat(tr.querySelector('input[onchange*="assyQty"]').value)||1;
      }
      // 부품 행 수량 (onchange에 .parts[pi] 포함)
      if(tr.querySelector('input[onchange*="parts"]')){
        var m=(tr.querySelector('input[onchange*="parts"]').getAttribute('onchange')||'').match(/\[(\d+)\]\.parts\[(\d+)\]/);
        if(m&&QS.bomAssies[m[1]]&&QS.bomAssies[m[1]].parts[m[2]]){
          QS.bomAssies[m[1]].parts[m[2]].qty=parseFloat(tr.querySelector('input[onchange*="parts"]').value)||0;
        }
      }
    });
    // 직접입력 행(q-bpni)만 별도 수집해서 추가
    var manualRows=Array.from(rows).filter(function(tr){ return tr.querySelector('.q-bpni'); });
    if(manualRows.length){
      var dfl=+(document.getElementById('q-labor-def')||{value:50000}).value||50000;
      var cur=null;
      // 기존 직접입력 ASSY 제거 후 재수집
      QS.bomAssies=QS.bomAssies.filter(function(a){return a.pn!=='(직접입력)';});
      manualRows.forEach(function(tr){
        var lv=parseInt((tr.querySelector('select')||{value:'1'}).value)||1;
        var pn=String((tr.querySelector('.q-bpni')||{}).value||'').trim();
        var qty=parseFloat((tr.querySelector('input.q-bni')||{}).value)||0;
        var unit=String((tr.querySelectorAll('input')[2]||{}).value||'EA').trim();
        var rev=String((tr.querySelectorAll('input')[3]||{}).value||'').trim();
        var descCell=tr.querySelector('.q-row-desc');
        var desc=descCell?descCell.textContent.replace('— DB 조회 —','').replace('⚠ DB 미등록','').trim():'';
        if(!pn) return;
        if(lv===0){
          cur={pn:pn,desc:desc||pn,rev:rev,isAssy:qIsAssy(pn),assyQty:qty||1,laborKrw:dfl,parts:[]};
          QS.bomAssies.push(cur);
        } else {
          if(!cur){ cur={pn:'(직접입력)',desc:'직접입력',rev:'',isAssy:false,assyQty:1,laborKrw:0,parts:[]}; QS.bomAssies.push(cur); }
          cur.parts.push({pn:pn,desc:desc,qty:qty,unit:unit,rev:rev,lv:lv});
        }
      });
    }
  } else {
    // QS.bomAssies 없음 → 직접입력 행만으로 구성
    var dfl=+(document.getElementById('q-labor-def')||{value:50000}).value||50000;
    QS.bomAssies=[];
    var cur=null;
    rows.forEach(function(tr){
      var pnInp=tr.querySelector('.q-bpni');
      if(!pnInp) return;
      var lv=parseInt((tr.querySelector('select')||{value:'1'}).value)||1;
      var pn=String(pnInp.value||'').trim();
      var qty=parseFloat((tr.querySelector('input.q-bni')||{}).value)||0;
      var unit=String((tr.querySelectorAll('input')[2]||{}).value||'EA').trim();
      var rev=String((tr.querySelectorAll('input')[3]||{}).value||'').trim();
      var descCell=tr.querySelector('.q-row-desc');
      var desc=descCell?descCell.textContent.replace('— DB 조회 —','').replace('⚠ DB 미등록','').trim():'';
      if(!pn) return;
      if(lv===0){
        cur={pn:pn,desc:desc||pn,rev:rev,isAssy:qIsAssy(pn),assyQty:qty||1,laborKrw:dfl,parts:[]};
        QS.bomAssies.push(cur);
      } else {
        if(!cur){ cur={pn:'(직접입력)',desc:'직접입력',rev:'',isAssy:false,assyQty:1,laborKrw:0,parts:[]}; QS.bomAssies.push(cur); }
        cur.parts.push({pn:pn,desc:desc,qty:qty,unit:unit,rev:rev,lv:lv});
      }
    });
  }

  qGenQuote();
}

function qClearBOM(){
  QS.bomAssies=[];
  var tb=document.getElementById('q-bom-rows'); if(tb) tb.innerHTML='';
  var rs=document.getElementById('q-result'); if(rs) rs.style.display='none';
  var el=document.getElementById('q-bom-cnt'); if(el) el.textContent='';
}

function qTogglePaste(){
  var e=document.getElementById('q-paste-wrap');
  if(e) e.style.display=e.style.display==='none'?'block':'none';
}

function qParsePaste(){
  var ta=document.getElementById('q-paste-ta'); if(!ta||!ta.value.trim()) return;
  var dfl=+(document.getElementById('q-labor-def')||{value:50000}).value||50000;
  var cur=null;
  ta.value.trim().split('\n').filter(function(l){return l.trim();}).forEach(function(line){
    var cols=line.split('\t').map(function(c){return c.trim();});
    var lv=parseInt(cols[0]),pn=cols[1]||'',qty=parseFloat(cols[2])||0,unit=cols[3]||'EA',rev=cols[4]||'';
    if(!pn) return;
    if(lv===0){ cur={pn:pn,desc:pn,rev:rev,isAssy:qIsAssy(pn),assyQty:1,laborKrw:dfl,parts:[]}; QS.bomAssies.push(cur); }
    else{ if(!cur){ cur={pn:'(미분류)',desc:'',rev:'',isAssy:false,assyQty:1,laborKrw:0,parts:[]}; QS.bomAssies.push(cur); } cur.parts.push({pn:pn,desc:'',qty:qty,unit:unit,rev:rev}); }
  });
  ta.value='';
  var pw=document.getElementById('q-paste-wrap'); if(pw) pw.style.display='none';
  qRefreshBOMTable(); qUpdBOMCnt(); qToast('✓ 파싱 완료','ok');
}

/* ── 견적 생성 ── */
function qGenQuote(){
  if(!QS.bomAssies.length){ qToast('BOM을 먼저 입력하세요','err'); return; }
  if(!DB||!DB.length){ qToast('DB가 로드되지 않았습니다. 구매관리 → 품목DB를 먼저 로드하세요','err',5000); return; }
  var cfg=qGetCfg();

  QS.quoteAssies=QS.bomAssies.map(function(assy){
    var assyQty=assy.assyQty||1;
    var qp=assy.parts.map(function(p){
      var pn=String(p.pn).trim();
      var item=qFindItem(pn);
      var status='ok', buyKrw=null, quoteUSDper=null, margin=null;
      if(!item){ status='unreg'; }
      else{
        buyKrw=qToN(item.k6)||qToN(item.k5)||null;
        if(buyKrw===null){ status='noprice'; }
        else{ margin=qGetMarg(buyKrw,cfg); quoteUSDper=buyKrw/(1-margin)/cfg.sellRate; }
      }
      var effQty=p.qty*assyQty;
      return Object.assign({},p,{
        item:item, status:status, buyKrw:buyKrw, margin:margin, effQty:effQty,
        buyKrwTotal:buyKrw!=null?buyKrw*effQty:null,
        quoteUSDTotal:quoteUSDper!=null?quoteUSDper*effQty:null,
        quoteUSDper:quoteUSDper,
        rev:p.rev||(item?item.rv:'')||'',
        vendor:item?item.by||'':'', lt:item?item.lt||'':'',
        mfg:item?item.mg||'':'', mfgpn:item?item.mp||'':''
      });
    });
    var okParts=qp.filter(function(p){return p.buyKrw!=null;});
    var totalBuyKrw=okParts.reduce(function(s,p){return s+(p.buyKrwTotal||0);},0);
    var totalPartUSD=qp.reduce(function(s,p){return s+(p.quoteUSDTotal||0);},0);
    var labor=assy.isAssy?(assy.laborKrw||0):0;
    var laborUSD=assy.isAssy?labor/(1-cfg.laborMarg)/cfg.sellRate:0;
    var totalUSD=totalPartUSD+laborUSD;
    var totalKRW=totalUSD*cfg.sellRate;
    var gm=totalKRW>0?(totalKRW-totalBuyKrw-labor)/totalKRW*100:0;
    return Object.assign({},assy,{assyQty:assyQty,parts:qp,totalBuyKrw:totalBuyKrw,
      totalPartUSD:totalPartUSD,laborUSD:laborUSD,totalUSD:totalUSD,totalKRW:totalKRW,overallMargin:gm});
  });

  qRenderResults(cfg);
  qUpdateIssues();
  qBuildDoc();
  var rs=document.getElementById('q-result'); if(rs) rs.style.display='block';
  qToast('✓ 견적 생성 완료 ('+QS.quoteAssies.length+'개 ASSY)','ok');
}

/* ── 결과 렌더 ── */
function qRenderResults(cfg){
  var all=QS.quoteAssies;
  var allParts=[];
  all.forEach(function(a){ a.parts.forEach(function(p){ allParts.push(p); }); });
  var tBuy=all.reduce(function(s,a){return s+a.totalBuyKrw;},0);
  var tLabor=all.reduce(function(s,a){return s+(a.isAssy?a.laborKrw||0:0);},0);
  var tUSD=all.reduce(function(s,a){return s+a.totalUSD;},0);
  var tKRW=tUSD*cfg.sellRate;
  var tMarg=tKRW-tBuy-tLabor;
  var gPct=tKRW>0?tMarg/tKRW*100:0;
  var ucnt=allParts.filter(function(p){return p.status==='unreg';}).length;
  var npcnt=allParts.filter(function(p){return p.status==='noprice';}).length;
  document.getElementById('q-summary').innerHTML=
    '<div class="q-sc"><div class="q-scl">총 ASSY</div><div class="q-scv">'+all.length+'</div><div class="q-scs">'+allParts.length+'개 부품</div></div>'+
    '<div class="q-sc"><div class="q-scl">총 매입가 (₩)</div><div class="q-scv" style="font-size:14px">'+Math.round(tBuy).toLocaleString()+'</div><div class="q-scs">작업비 제외</div></div>'+
    '<div class="q-sc"><div class="q-scl">작업비 합계 (₩)</div><div class="q-scv" style="font-size:14px">'+Math.round(tLabor).toLocaleString()+'</div></div>'+
    '<div class="q-sc"><div class="q-scl">총 견적가 ($)</div><div class="q-scv" style="color:var(--amb)">'+tUSD.toFixed(2)+'</div><div class="q-scs">'+Math.round(tKRW).toLocaleString()+' ₩</div></div>'+
    '<div class="q-sc"><div class="q-scl">총 마진 (₩)</div><div class="q-scv" style="font-size:14px;color:'+(tMarg>=0?'var(--green)':'var(--red)')+'">'+Math.round(tMarg).toLocaleString()+'</div><div class="q-scs">'+gPct.toFixed(1)+'%</div></div>'+
    (ucnt?'<div class="q-sc" style="border-color:var(--red)"><div class="q-scl" style="color:var(--red)">미등록</div><div class="q-scv" style="color:var(--red)">'+ucnt+'</div><div class="q-scs" style="color:var(--red)">DB 등록 필요</div></div>':'')+
    (npcnt?'<div class="q-sc" style="border-color:var(--amb)"><div class="q-scl" style="color:var(--amb)">단가없음</div><div class="q-scv" style="color:var(--amb)">'+npcnt+'</div><div class="q-scs" style="color:var(--amb)">k5/k6 등록 필요</div></div>':'');
  qRerender();
}

function qRerender(){
  var hz=document.getElementById('q-hide-zero'); var hd=document.getElementById('q-hide-docs');
  var hideZero=hz&&hz.checked; var hideDocs=hd&&hd.checked;
  var cont=document.getElementById('q-assy-sections'); if(!cont) return;
  cont.innerHTML='';
  QS.quoteAssies.forEach(function(a,ai){
    var d=document.createElement('div'); d.className='q-assy';
    d.innerHTML=qBuildAssyHTML(a,ai,hideZero,hideDocs);
    cont.appendChild(d);
  });
}

function qBuildAssyHTML(assy,ai,hideZero,hideDocs){
  var cfg=qGetCfg();
  var ucnt=assy.parts.filter(function(p){return p.status==='unreg';}).length;
  var ncnt=assy.parts.filter(function(p){return p.status==='noprice';}).length;
  var issueBdg=(ucnt?'<span class="qbdg qbdg-r">미등록 '+ucnt+'</span> ':'')+(ncnt?'<span class="qbdg qbdg-a">단가없음 '+ncnt+'</span>':'');
  var labor=assy.isAssy?(assy.laborKrw||0):0;
  var laborSection=assy.isAssy
    ?('<div style="display:flex;align-items:center;gap:6px">'
        +'<span style="font-size:11px;color:var(--text2)">작업비(₩)</span>'
        +'<input class="q-labor-in" type="number" value="'+labor+'" step="1000" min="0" onchange="qUpdLabor('+ai+',this.value)">'
        +'<span style="font-size:11px;color:var(--text2)">=$<span id="q-lusd-'+ai+'">'+assy.laborUSD.toFixed(2)+'</span></span>'
        +'</div>')
    :'<span class="qbdg qbdg-g">작업비없음</span>';

  var parts=assy.parts.filter(function(p){
    if(hideDocs&&p.qty===0) return false;
    if(hideZero&&p.effQty===0) return false;
    return true;
  });

  var rows=parts.map(function(p,pi){
    var rc=p.status==='unreg'?'q-ru':p.status==='noprice'?'q-rn':'';
    var it=p.item||{};
    var desc=p.item?it.d||p.desc:p.desc||'<span style="color:var(--red)">미등록</span>';
    var mfgStr=[it.mg,it.mp].filter(Boolean).join(' | ');
    var buyStr=p.buyKrw!=null?p.buyKrw.toLocaleString():(p.status==='unreg'?'—':'<span style="color:var(--amb)">미등록</span>');
    var totStr=p.buyKrwTotal!=null?p.buyKrwTotal.toLocaleString():'—';
    var effStr=p.effQty!==p.qty?('<span style="color:var(--amb);font-weight:700">'+p.effQty+'</span> <span style="color:var(--text3);font-size:10px">(×'+assy.assyQty+')</span>'):''+p.qty;
    var mg=p.margin!=null?('<span class="'+(p.margin>=.35?'mhi':p.margin>=.25?'mmd':'mlo')+'">'+(p.margin*100).toFixed(0)+'%</span>'):'—';
    var qdef=p.quoteUSDTotal!=null?p.quoteUSDTotal.toFixed(2):'';
    return '<tr class="'+rc+'">'
      +'<td class="q-pn">'+p.pn+'</td>'
      +'<td><div class="q-dm">'+desc+'</div>'+(mfgStr?'<div class="q-ds">'+mfgStr+'</div>':'')+'</td>'
      +'<td class="c"><span class="qbdg qbdg-g">'+(p.rev||'-')+'</span></td>'
      +'<td class="r" style="font-size:12px">'+effStr+'</td>'
      +'<td class="c" style="font-size:11px;color:var(--text2)">'+p.unit+'</td>'
      +'<td class="q-pkrw">'+buyStr+'</td>'
      +'<td class="q-pkrw">'+totStr+'</td>'
      +'<td class="q-mval">'+mg+'</td>'
      +'<td><input class="q-epr" type="number" step="0.01" value="'+qdef+'" onchange="qOnPrEd('+ai+','+pi+',this.value)"></td>'
      +'<td style="font-size:11px;color:var(--text2)">'+p.vendor+'</td>'
      +'<td class="c" style="font-size:11px;color:var(--text2)">'+p.lt+'</td>'
      +'</tr>';
  }).join('');

  var gm=assy.overallMargin;
  var gmcls=gm>=30?'var(--green)':gm>=20?'var(--amb)':'var(--red)';

  return '<div class="q-ahdr">'
    +'<span class="q-apn">'+assy.pn+'</span>'
    +'<span class="q-adesc">'+assy.desc+'</span>'
    +'<span class="q-arev">REV '+assy.rev+'</span>'
    +(assy.isAssy?'<span class="q-abd q-abd-a">ASSY</span>':'<span class="q-abd q-abd-n">PART</span>')
    +issueBdg
    +'<div class="q-aqty-wrap"><label style="font-size:11px;color:var(--text2)">ASSY 수량</label>'
    +'<input class="q-aqty-in" type="number" value="'+assy.assyQty+'" min="1" onchange="qUpdAssyQty('+ai+',this.value)"></div>'
    +laborSection
    +'<input style="background:var(--bg2);border:1px solid var(--border2);border-radius:5px;padding:4px 8px;color:var(--text2);font-size:11px;width:160px;font-family:var(--font)" '
    +' value="'+(assy.remark||'').replace(/"/g,'&quot;')+'"'
    +' onchange="QS.quoteAssies['+ai+'].remark=this.value" placeholder="Remark...">'
    +'</div>'
    +'<div class="q-tw" style="border:none;border-radius:0"><table><thead><tr>'
    +'<th style="width:120px">품번</th><th>품명/제조사</th>'
    +'<th class="c" style="width:42px">REV</th>'
    +'<th class="r" style="width:80px">수량(실)</th>'
    +'<th class="c" style="width:50px">단위</th>'
    +'<th class="r" style="width:100px">매입가(₩)</th>'
    +'<th class="r" style="width:105px">매입소계(₩)</th>'
    +'<th class="c" style="width:52px">마진</th>'
    +'<th class="r" style="width:86px">견적가($)</th>'
    +'<th style="width:76px">구매처</th>'
    +'<th class="c" style="width:46px">납기</th>'
    +'</tr></thead>'
    +'<tbody>'+(rows||'<tr><td colspan="11" style="text-align:center;padding:14px;color:var(--text3)">표시할 부품 없음</td></tr>')+'</tbody>'
    +'</table></div>'
    +'<div class="q-aftr">'
    +'<div class="q-astat"><span class="q-astl">매입합계</span><span class="q-astv">'+Math.round(assy.totalBuyKrw).toLocaleString()+' ₩</span></div>'
    +(assy.isAssy?'<div class="q-astat"><span class="q-astl">작업비</span><span class="q-astv" id="q-lftr-'+ai+'" style="color:var(--amb)">'+Math.round(labor).toLocaleString()+' ₩</span></div>':'')
    +'<div class="q-astat"><span class="q-astl">ASSY 견적가</span><span class="q-astv" style="color:var(--amb)">$ <span id="q-atot-'+ai+'">'+assy.totalUSD.toFixed(2)+'</span></span></div>'
    +'<div class="q-astat"><span class="q-astl">마진율</span><span class="q-astv" id="q-amarg-'+ai+'" style="color:'+gmcls+'">'+gm.toFixed(1)+'%</span></div>'
    +'</div>';
}

/* ── ASSY qty / Labor 업데이트 ── */
function qUpdAssyQty(ai,val){
  var cfg=qGetCfg(); var a=QS.quoteAssies[ai]; var aq=parseFloat(val)||1;
  a.assyQty=aq; if(QS.bomAssies[ai]) QS.bomAssies[ai].assyQty=aq;
  a.parts.forEach(function(p){ p.effQty=p.qty*aq; p.buyKrwTotal=p.buyKrw!=null?p.buyKrw*p.effQty:null; p.quoteUSDTotal=p.quoteUSDper!=null?p.quoteUSDper*p.effQty:null; });
  qRecalcAssy(ai,cfg); qRerender();
}
function qUpdLabor(ai,val){
  var cfg=qGetCfg(); var a=QS.quoteAssies[ai];
  a.laborKrw=parseFloat(val)||0; if(QS.bomAssies[ai]) QS.bomAssies[ai].laborKrw=a.laborKrw;
  qRecalcAssy(ai,cfg);
  var e; e=document.getElementById('q-lusd-'+ai); if(e) e.textContent=a.laborUSD.toFixed(2);
  e=document.getElementById('q-lftr-'+ai); if(e) e.textContent=Math.round(a.laborKrw).toLocaleString()+' ₩';
  e=document.getElementById('q-atot-'+ai); if(e) e.textContent=a.totalUSD.toFixed(2);
  e=document.getElementById('q-amarg-'+ai); if(e){ e.textContent=a.overallMargin.toFixed(1)+'%'; e.style.color=a.overallMargin>=30?'var(--green)':a.overallMargin>=20?'var(--amb)':'var(--red)'; }
}
function qRecalcAssy(ai,cfg){
  var a=QS.quoteAssies[ai];
  a.totalBuyKrw=a.parts.filter(function(p){return p.buyKrw!=null;}).reduce(function(s,p){return s+(p.buyKrwTotal||0);},0);
  a.totalPartUSD=a.parts.reduce(function(s,p){return s+(p.quoteUSDTotal||0);},0);
  var labor=a.isAssy?(a.laborKrw||0):0;
  a.laborUSD=a.isAssy?labor/(1-cfg.laborMarg)/cfg.sellRate:0;
  a.totalUSD=a.totalPartUSD+a.laborUSD;
  a.totalKRW=a.totalUSD*cfg.sellRate;
  a.overallMargin=a.totalKRW>0?(a.totalKRW-a.totalBuyKrw-labor)/a.totalKRW*100:0;
}
function qOnPrEd(ai,pi,val){ if(QS.quoteAssies[ai]&&QS.quoteAssies[ai].parts[pi]) QS.quoteAssies[ai].parts[pi]._custom=parseFloat(val)||null; }

/* ── 이슈 탭 ── */
function qUpdateIssues(){
  var allParts=[];
  QS.quoteAssies.forEach(function(a){ a.parts.forEach(function(p){ allParts.push(Object.assign({},p,{assyPn:a.pn})); }); });
  var ur=allParts.filter(function(p){return p.status==='unreg';});
  var np=allParts.filter(function(p){return p.status==='noprice';});
  var eu=document.getElementById('q-cnt-ur'); if(eu) eu.textContent=ur.length;
  var en=document.getElementById('q-cnt-np'); if(en) en.textContent=np.length;
  var btn=document.getElementById('qstab-issues');
  if(btn) btn.textContent='⚠ 이슈'+(ur.length+np.length?' ('+(ur.length+np.length)+')':'');
  var up=document.getElementById('q-panel-ur');
  if(up) up.innerHTML=ur.length?('<div class="q-tw"><table><thead><tr><th>품번</th><th>BOM 품명</th><th class="r">BOM수량</th><th class="r">실수량</th><th>소속 ASSY</th></tr></thead><tbody>'
    +ur.map(function(p){return '<tr class="q-ru"><td class="q-pn">'+p.pn+'</td><td>'+p.desc+'</td><td class="r">'+p.qty+'</td><td class="r" style="color:var(--amb)">'+p.effQty+'</td><td style="font-family:var(--mono);font-size:11px;color:var(--text3)">'+p.assyPn+'</td></tr>';}).join('')
    +'</tbody></table></div>'):'<div style="color:var(--green);padding:10px 0;font-size:12px">✓ 미등록 품목 없음</div>';
  var np2=document.getElementById('q-panel-np');
  if(np2) np2.innerHTML=np.length?('<div class="q-tw"><table><thead><tr><th>품번</th><th>DB 품명</th><th>제조사</th><th class="r">BOM수량</th><th class="r">실수량</th><th>소속 ASSY</th></tr></thead><tbody>'
    +np.map(function(p){var it=p.item||{}; return '<tr class="q-rn"><td class="q-pn" style="color:var(--amb)">'+p.pn+'</td><td>'+it.d+'</td><td style="font-size:11px">'+it.mg+'</td><td class="r">'+p.qty+'</td><td class="r" style="color:var(--amb)">'+p.effQty+'</td><td style="font-family:var(--mono);font-size:11px;color:var(--text3)">'+p.assyPn+'</td></tr>';}).join('')
    +'</tbody></table></div>'):'<div style="color:var(--green);padding:10px 0;font-size:12px">✓ 단가 없는 품목 없음</div>';
}

/* ── 견적서 빌드 (상위품번만, REMARK, 세부내역 확장) ── */
function qBuildDoc(){
  var cont=document.getElementById('q-doc-container');
  if(!QS.quoteAssies.length){ if(cont) cont.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3)">견적 생성 후 확인 가능합니다</div>'; return; }
  var cfg=qGetCfg();
  var g=function(id,def){ var e=document.getElementById(id); return e?e.value:(def||''); };
  var qno=g('q-no','—'), qdate=g('q-date',new Date().toISOString().slice(0,10));
  var qprj=g('q-project',''), qto=g('q-to','AXCELIS Corp.'), qctact=g('q-contact','');
  var qdeliv=g('q-delivery','To be discussed later');
  var sperson=g('q-s-person','Jangho Woo'), semail=g('q-s-email','sales@jinsuntech.co.kr'), stel=g('q-s-tel','041-579-5845');

  // AJS 로고 SVG
  var logoSVG='<svg xmlns="http://www.w3.org/2000/svg" width="72" height="40" viewBox="0 0 72 40" class="qdoc-logo-svg">'
    +'<rect x="0" y="0" width="72" height="40" rx="4" fill="#1a2a5e"/>'
    +'<text x="36" y="27" font-family="Arial Black,Arial" font-weight="900" font-size="20" fill="white" text-anchor="middle" letter-spacing="1">AJS</text>'
    +'</svg>';

  // 경고
  var allParts=[]; QS.quoteAssies.forEach(function(a){ a.parts.forEach(function(p){ allParts.push(p); }); });
  var warnHtml=allParts.some(function(p){return p.status!=='ok';})?'<div class="qdoc-warn">⚠ 미등록/단가없는 품목이 있습니다. 견적가가 불완전할 수 있습니다.</div>':'';

  // 테이블 행
  var rowNum=0, tableRows='';
  QS.quoteAssies.forEach(function(assy,ai){
    rowNum++;
    var totalUSD=assy._customTotalUSD!=null?assy._customTotalUSD:assy.totalUSD;
    var unitUSD=assy.assyQty>0?(totalUSD/assy.assyQty):totalUSD;
    var rmk=assy.remark||'';
    var altMark=assy.altPart?'O':'-';
    tableRows+='<tr class="qa-row">'
      +'<td class="c">'+rowNum+'</td>'
      +'<td style="font-family:monospace;font-size:10px">'+assy.pn+'</td>'
      +'<td>'+assy.desc+'</td>'
      +'<td class="c">'+assy.rev+'</td>'
      +'<td class="c">EA</td>'
      +'<td class="c">'+assy.assyQty+'</td>'
      +'<td class="r" style="font-weight:700">'+unitUSD.toFixed(2)+'</td>'
      +'<td class="c">-</td>'
      +'<td><input id="qrm-'+ai+'" value="'+rmk.replace(/"/g,'&quot;')+'"'
        +' onchange="QS.quoteAssies['+ai+'].remark=this.value"'
        +' style="border:none;border-bottom:1px solid #ccc;padding:2px 4px;font-size:10px;width:100%;background:transparent;font-family:inherit"'
        +' placeholder="L/T, Remark..."></td>'
      +'</tr>';
  });

  // 빈 행 (PDF처럼 여유 공간)
  var emptyRows='';
  var fillCount=Math.max(0, 14-QS.quoteAssies.length);
  for(var i=0;i<fillCount;i++) emptyRows+='<tr class="qempty"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';

  var grandUSD=QS.quoteAssies.reduce(function(s,a){return s+(a._customTotalUSD!=null?a._customTotalUSD:a.totalUSD);},0);

  // 날짜 포맷: 24-Apr-26
  var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var qd=new Date(qdate); var dispDate=(qd.getDate()+'-'+months[qd.getMonth()]+'-'+String(qd.getFullYear()).slice(2));

  if(cont) cont.innerHTML='<div class="qdoc">'+warnHtml

    // ── 헤더 ──
    +'<div class="qdoc-hdr">'
      +'<div class="qdoc-hdr-left">'
        +'<div class="qdoc-no-row">NO : '+qno+'</div>'
        +'<div class="qdoc-date-row">'+dispDate+'</div>'
      +'</div>'
      +'<div class="qdoc-hdr-right">'
        +logoSVG
        +'<div class="qdoc-brand">Jinsun Tech co., Ltd</div>'
      +'</div>'
    +'</div>'

    // ── QUOTE 타이틀 ──
    +'<div class="qdoc-title-bar"><div class="qdoc-title">QUOTE</div></div>'

    // ── 발행처 + 공급자 ──
    +'<div class="qdoc-two-col">'
      +'<div>'
        +'<div class="qdoc-issued-box">'
          +'<div class="qdoc-issued-lbl">Issued by</div>'
          +'<div class="qdoc-issued-co">'+qto+'</div>'
          +'<div class="qdoc-issued-ct">'+(qctact||'')+'</div>'
        +'</div>'
        +'<div style="margin-top:12px">'
          +'<div style="font-size:10px;color:#555;margin-bottom:4px">We hereby provide the following quotation:</div>'
          +'<div style="font-size:10px;color:#555">Quotation Validity: 15 days from the date of the quotation</div>'
          +'<div style="font-size:10px;color:#555">Delivery Schedule: '+qdeliv+'</div>'
        +'</div>'
        +(qprj?'<div style="margin-top:12px"><div class="qdoc-project-name">Project Name: '+qprj+'</div></div>':'')
      +'</div>'
      +'<div>'
        +'<div class="qdoc-issued-lbl" style="border:1px solid #ddd;padding:4px 10px;margin-bottom:0;background:#f0f0f0;font-size:9.5px;font-weight:700;letter-spacing:1px;color:#333;text-transform:uppercase">Supplier</div>'
        +'<table class="qdoc-sup-tbl" style="border:1px solid #ddd;border-top:none">'
          +'<tr><td>Company</td><td>Jinsun Tech Co., Ltd</td></tr>'
          +'<tr><td>Business registration number</td><td>312-86-59918</td></tr>'
          +'<tr><td>CEO</td><td>ChunSeok Hong</td></tr>'
          +'<tr><td>Adress</td><td>98 Chadollo-ro, Dongnam-gu, Cheonan-si,<br>Chungcheongnam-do, 2nd floor</td></tr>'
          +'<tr><td>Business Type</td><td>Diode Transistors and Similar Semiconductor/<br>Integrated Circuits</td></tr>'
          +'<tr><td>Contact</td><td>'+sperson+' (82+10-4456-7794)</td></tr>'
          +'<tr><td>Tel / Fax</td><td>'+stel+' / 041-579-5846</td></tr>'
          +'<tr><td>E-Mail</td><td><a href="mailto:'+semail+'" style="color:#1a5fa8;text-decoration:none">'+semail+'</a><br><span style="font-size:9.5px;color:#888">etax@jinsuntech.co.kr (Invoice)</span></td></tr>'
        +'</table>'
      +'</div>'
    +'</div>'

    // ── 메인 테이블 ──
    +'<table class="qdoc-tbl">'
      +'<thead><tr>'
        +'<th class="c" style="width:28px">NO.</th>'
        +'<th style="width:100px">Item no.</th>'
        +'<th>Description</th>'
        +'<th class="c" style="width:33px">REV</th>'
        +'<th class="c" style="width:36px">Unit</th>'
        +'<th class="c" style="width:50px">Quantity</th>'
        +'<th class="r" style="width:86px">Unit Price(USD)</th>'
        +'<th class="c" style="width:54px">alternative<br>(O)</th>'
        +'<th style="min-width:80px">Remarks</th>'
      +'</tr></thead>'
      +'<tbody>'+tableRows+emptyRows+'</tbody>'
    +'</table>'

    // ── 하단: Conditions + Total ──
    +'<div class="qdoc-bottom">'
      +'<div class="qdoc-cond">'
        +'<div class="qdoc-cond-lbl">Quotation Conditions</div>'
        +'<div style="font-size:10.5px;color:#333;line-height:1.8;margin-top:6px">'
          +'- L/T 8W<br>'
          +(qdeliv&&qdeliv!=='To be discussed later'?'- Delivery: '+qdeliv+'<br>':'')
          +'- Prices valid for 15 days'
        +'</div>'
      +'</div>'
      +'<div class="qdoc-total-box">'
        +'<div class="qdoc-total-lbl">Total (Excluding VAT)</div>'
        +'<div class="qdoc-total-val">$ '+grandUSD.toFixed(2)+'</div>'
      +'</div>'
    +'</div>'

    // ── 푸터 ──
    +'<div class="qdoc-footer">진선테크 견적서 / '+qdate+'</div>'
    +'</div>';
}

function qToggleDetail(id){
  var row=document.getElementById(id);
  if(!row) return;
  var ai=id.replace('qdx-','');
  var btn=document.getElementById('qdbtn-'+ai);
  if(row.style.display==='none'){ row.style.display=''; if(btn) btn.textContent='▲'; }
  else{ row.style.display='none'; if(btn) btn.textContent='▼'; }
}

function qPrintDoc(){
  var html=document.getElementById('q-doc-container').innerHTML;
  var w=window.open('','_blank');
  var sty=Array.from(document.querySelectorAll('#sect-quote style,style')).map(function(s){return s.textContent;}).join('\n');
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Quotation</title>'
    +'<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap" rel="stylesheet">'
    +'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:\'Noto Sans KR\',sans-serif;background:#fff}'
    +'.qdoc{padding:24px 28px}'
    +'.qdoc-title{font-size:22px;font-weight:900;letter-spacing:4px;text-align:center;margin-bottom:4px}'
    +'.qdoc-no{text-align:center;font-size:12px;color:#555;margin-bottom:18px}'
    +'.qdoc-parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;border:1px solid #ddd;border-radius:4px;overflow:hidden}'
    +'.qdoc-party{padding:11px 14px}.qdoc-party.issued{background:#f8f8f8;border-right:1px solid #ddd}'
    +'.qdoc-party-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px}'
    +'.qdoc-party-name{font-size:13px;font-weight:700;margin-bottom:3px}.qdoc-party-sub{font-size:10px;color:#555;line-height:1.7}'
    +'.qdoc-meta{display:flex;border:1px solid #ddd;border-radius:4px;margin-bottom:12px;overflow:hidden}'
    +'.qdoc-meta-item{flex:1;padding:7px 11px;border-right:1px solid #ddd}.qdoc-meta-item:last-child{border-right:none}'
    +'.qdoc-meta-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:1px}.qdoc-meta-val{font-size:12px;font-weight:600}'
    +'.qdoc-tbl{width:100%;border-collapse:collapse;margin-bottom:12px}'
    +'.qdoc-tbl th{background:#1a1a1a;color:#fff;padding:6px 9px;text-align:left;font-size:9.5px;font-weight:700;text-transform:uppercase}'
    +'.qdoc-tbl th.r,.qdoc-tbl td.r{text-align:right}.qdoc-tbl th.c,.qdoc-tbl td.c{text-align:center}'
    +'.qdoc-tbl td{padding:5px 9px;border-bottom:1px solid #eee;font-size:11px}'
    +'.qa-row td{background:#f5f0e0;font-weight:700;font-size:11px}'
    +'.qtot td{background:#1a1a1a;color:#fff;font-weight:700;padding:7px 9px}'
    +'.qdoc-tbl input{border:1px solid #ccc;border-radius:3px;padding:2px 5px;font-size:10px;width:100%;font-family:inherit}'
    +'[id^="qdx-"]{display:none!important}'   /* 인쇄시 세부내역 숨김 */
    +'button{display:none!important}'          /* 인쇄시 버튼 숨김 */
    +'.qdoc-terms{border:1px solid #ddd;border-radius:4px;padding:9px 12px;font-size:10px;color:#555;line-height:1.7;margin-bottom:12px}'
    +'.qdoc-sig{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:14px}'
    +'.qdoc-sig-box{border:1px solid #ddd;border-radius:4px;padding:11px 13px}'
    +'.qdoc-sig-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:18px}'
    +'.qdoc-sig-line{border-top:1px solid #999;margin-top:14px;padding-top:4px;font-size:10px;color:#555}'
    +'.qdoc-warn{background:#fff8e0;border:1px solid #f0a825;border-radius:4px;padding:7px 11px;font-size:10px;color:#7a5a00;margin-bottom:10px}'
    +'@media print{@page{size:A4;margin:12mm}}</style>'
    +'</head><body>'+html+'<script>window.onload=function(){window.print();}<\/script></body></html>');
  w.document.close();
}

function qExportDocHTML(){
  var html=document.getElementById('q-doc-container').innerHTML;
  var qno=document.getElementById('q-no').value||'DRAFT';
  var blob=new Blob(['<!DOCTYPE html><html><head><meta charset="UTF-8"><title>견적서 '+qno+'</title></head><body style="background:#eee;padding:20px">'+html+'</body></html>'],{type:'text/html'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='견적서_'+qno+'_'+new Date().toISOString().slice(0,10)+'.html';
  a.click(); qToast('✓ HTML 저장됨','ok');
}

/* ── 견적 제출 (이력 저장) ── */
function qSubmitQuote(){
  if(!QS.quoteAssies.length){ qToast('먼저 견적을 생성하세요','err'); return; }
  if(!confirm('이 견적을 제출하고 이력에 저장하시겠습니까?')) return;
  var cfg=qGetCfg();
  var qno=document.getElementById('q-no').value||'Q-'+Date.now();
  var qdate=document.getElementById('q-date').value||new Date().toISOString().slice(0,10);
  var prj=document.getElementById('q-project').value||'';
  var grandUSD=QS.quoteAssies.reduce(function(s,a){return s+a.totalUSD;},0);
  var grandKRW=grandUSD*cfg.sellRate;
  var totalBuy=QS.quoteAssies.reduce(function(s,a){return s+a.totalBuyKrw;},0);
  var totalLabor=QS.quoteAssies.reduce(function(s,a){return s+(a.isAssy?a.laborKrw||0:0);},0);

  var records=QS.quoteAssies.map(function(a){
    return {견적번호:qno,견적일자:qdate,품번:a.pn,품명:a.desc,ASSY수량:a.assyQty,
      매입합계:Math.round(a.totalBuyKrw),작업비:a.isAssy?(a.laborKrw||0):0,
      견적가달러:parseFloat(a.totalUSD.toFixed(2)),견적가한화:Math.round(a.totalUSD*cfg.sellRate),
      마진율:parseFloat(a.overallMargin.toFixed(1)),프로젝트:prj,비고:a.remark||'',
      제출일시:new Date().toISOString(),상태:'제출'};
  });
  // 합계 행
  records.push({견적번호:qno,견적일자:qdate,품번:'(합계)',품명:'견적서 '+qno+' 합계',
    ASSY수량:QS.quoteAssies.reduce(function(s,a){return s+a.assyQty;},0),
    매입합계:Math.round(totalBuy),작업비:Math.round(totalLabor),
    견적가달러:parseFloat(grandUSD.toFixed(2)),견적가한화:Math.round(grandKRW),
    마진율:grandKRW>0?parseFloat(((grandKRW-totalBuy-totalLabor)/grandKRW*100).toFixed(1)):0,
    프로젝트:prj,제출일시:new Date().toISOString(),상태:'합계'});

  try{
    var existing=JSON.parse(localStorage.getItem('jst_quote_hist')||'[]');
    localStorage.setItem('jst_quote_hist',JSON.stringify(records.concat(existing)));
  }catch(e){}
  qToast('✓ 견적 "'+qno+'" 이력 저장 완료','ok');

  // Apps Script 서버 저장 (rows를 객체배열로 전송 — GS handleAppendRows 형식 맞춤)
  if(CURRENT_TOKEN){
    apiPost({action:'appendRows',sheet:'quote_hist',rows:records})
      .then(function(res){ if(res&&(res.ok||res.result==='ok')) qToast('✓ 서버 이력 저장 완료','ok'); })
      .catch(function(){});
  }
}

/* ── 이력 렌더 ── */
function qRenderHist(){
  var hist; try{hist=JSON.parse(localStorage.getItem('jst_quote_hist')||'[]');}catch(e){hist=[];}
  var cont=document.getElementById('q-hist-cont');
  if(!cont) return;

  // 서버에서 최신 이력 병합 (CURRENT_TOKEN 있을 때)
  if(CURRENT_TOKEN){
    cont.innerHTML='<div style="text-align:center;padding:20px;color:var(--text3)">서버에서 이력 불러오는 중...</div>';
    apiGet({action:'getQuoteHist'}).then(function(res){
      if(res&&res.data&&res.data.length){
        // 서버 데이터 + 로컬 병합 (견적번호+제출일시 기준 중복 제거)
        var serverKeys=new Set(res.data.map(function(r){return r.견적번호+'|'+r.제출일시;}));
        var localOnly=hist.filter(function(r){return !serverKeys.has(r.견적번호+'|'+r.제출일시);});
        hist=res.data.concat(localOnly);
        try{ localStorage.setItem('jst_quote_hist',JSON.stringify(hist)); }catch(e){}
      }
      qRenderHistData(hist,cont);
    }).catch(function(){ qRenderHistData(hist,cont); });
  } else {
    qRenderHistData(hist,cont);
  }
}

function qRenderHistData(hist,cont){
  if(!hist.length){
    cont.innerHTML='<div style="text-align:center;padding:30px;color:var(--text3)">견적 제출 이력이 없습니다<br><br>'
      +'<button class="qbtn qbp qbsm" onclick="qHistAddNew()">+ 단건 추가</button></div>';
    return;
  }
  var totals=hist.filter(function(r){return r.상태==='합계';})
    .sort(function(a,b){return new Date(b.제출일시)-new Date(a.제출일시);});
  var details=hist.filter(function(r){return r.상태==='제출';});

  var html='<div style="margin-bottom:8px;text-align:right">'
    +'<button class="qbtn qbp qbsm" onclick="qHistAddNew()">+ 단건 추가</button></div>'
    +'<div class="q-tw"><table id="q-hist-tbl"><thead><tr>'
    +'<th>견적번호</th><th>견적일자</th><th>ASSY</th><th>품명</th>'
    +'<th class="r">수량</th><th class="r">매입합계(₩)</th><th class="r">작업비(₩)</th>'
    +'<th class="r">견적가($)</th><th class="r">견적가(₩)</th><th class="r">마진율</th>'
    +'<th>프로젝트</th><th>제출일시</th><th style="color:var(--teal)">수정일시</th>'
    +'<th style="width:90px"></th>'
    +'</tr></thead><tbody>';

  totals.forEach(function(r){
    var mr=parseFloat(r.마진율)||0;
    var qno=r.견적번호||'';
    var idx=hist.indexOf(r);
    var modAt=(r.수정일시||'').slice(0,16).replace('T',' ');
    var mrClr=mr>=30?'var(--green)':mr>=20?'var(--amb)':'var(--red)';

    // 합계 행
    html+='<tr id="qhr-'+qno+'" style="background:var(--bg3)">'
      +'<td style="font-family:var(--mono);font-weight:700;color:var(--amb)">'+qno+'</td>'
      +'<td class="qh-ed" data-qno="'+qno+'" data-field="견적일자" style="font-family:var(--mono);font-size:11.5px;cursor:pointer" title="클릭하여 수정">'+(r.견적일자||'')+'</td>'
      +'<td style="font-family:var(--mono);font-size:11px;color:var(--text2)">ALL</td>'
      +'<td style="font-weight:600">합계</td>'
      +'<td class="r qh-ed" data-qno="'+qno+'" data-field="ASSY수량" style="cursor:pointer" title="클릭하여 수정">'+(r.ASSY수량||0)+'</td>'
      +'<td class="r qh-ed" data-qno="'+qno+'" data-field="매입합계" style="font-family:var(--mono);color:var(--text2);cursor:pointer" title="클릭하여 수정">'+(+r.매입합계||0).toLocaleString()+'</td>'
      +'<td class="r qh-ed" data-qno="'+qno+'" data-field="작업비" style="font-family:var(--mono);color:var(--text2);cursor:pointer" title="클릭하여 수정">'+(+r.작업비||0).toLocaleString()+'</td>'
      +'<td class="r qh-ed" data-qno="'+qno+'" data-field="견적가달러" style="font-family:var(--mono);font-weight:700;color:var(--amb);cursor:pointer" title="클릭하여 수정">'+(+r.견적가달러||0).toFixed(2)+'</td>'
      +'<td class="r qh-ed" data-qno="'+qno+'" data-field="견적가한화" style="font-family:var(--mono);color:var(--text2);cursor:pointer" title="클릭하여 수정">'+(+r.견적가한화||0).toLocaleString()+'</td>'
      +'<td class="r qh-ed" data-qno="'+qno+'" data-field="마진율" style="font-family:var(--mono);color:'+mrClr+';cursor:pointer" title="클릭하여 수정">'+(mr||0)+'%</td>'
      +'<td class="qh-ed" data-qno="'+qno+'" data-field="프로젝트" style="font-size:11px;color:var(--text2);cursor:pointer" title="클릭하여 수정">'+(r.프로젝트||'')+'</td>'
      +'<td style="font-family:var(--mono);font-size:10.5px;color:var(--text3);white-space:nowrap">'+(r.제출일시||'').slice(0,16).replace('T',' ')+'</td>'
      +'<td style="font-family:var(--mono);font-size:10px;color:var(--teal);white-space:nowrap">'+modAt+'</td>'
      +'<td style="text-align:center;white-space:nowrap" onclick="event.stopPropagation()">'
        +'<button data-qno="'+qno+'" onclick="qHistDelete(this.dataset.qno)" style="background:none;border:1px solid rgba(255,85,85,.4);border-radius:4px;padding:2px 7px;font-size:11px;color:var(--red);cursor:pointer" title="삭제">🗑</button>'
      +'</td></tr>';

    // 상세 행
    details.filter(function(d){return d.견적번호===qno;}).forEach(function(d,di){
      var dm=parseFloat(d.마진율)||0;
      var dmClr=dm>=30?'var(--green)':dm>=20?'var(--amb)':'var(--red)';
      var dkey=qno+'__'+di;  // 상세행 고유키
      html+='<tr id="qhd-'+dkey+'">'
        +'<td></td>'
        +'<td style="font-family:var(--mono);font-size:11px;color:var(--text3)">'+(d.견적일자||'')+'</td>'
        +'<td class="qhd-ed q-pn" data-key="'+dkey+'" data-field="품번" style="cursor:pointer;color:var(--accent)" title="클릭하여 수정">'+(d.품번||'')+'</td>'
        +'<td class="qhd-ed" data-key="'+dkey+'" data-field="품명" style="font-size:11.5px;color:var(--text2);cursor:pointer" title="클릭하여 수정">'+(d.품명||'')+'</td>'
        +'<td class="r qhd-ed" data-key="'+dkey+'" data-field="ASSY수량" style="cursor:pointer" title="클릭하여 수정">'+(d.ASSY수량||0)+'</td>'
        +'<td class="r qhd-ed q-pkrw" data-key="'+dkey+'" data-field="매입합계" style="font-family:var(--mono);cursor:pointer" title="클릭하여 수정">'+(+d.매입합계||0).toLocaleString()+'</td>'
        +'<td class="r qhd-ed q-pkrw" data-key="'+dkey+'" data-field="작업비" style="font-family:var(--mono);cursor:pointer" title="클릭하여 수정">'+(+d.작업비||0).toLocaleString()+'</td>'
        +'<td class="r qhd-ed q-pusd" data-key="'+dkey+'" data-field="견적가달러" style="font-family:var(--mono);cursor:pointer" title="클릭하여 수정">'+(+d.견적가달러||0).toFixed(2)+'</td>'
        +'<td class="r qhd-ed q-pkrw" data-key="'+dkey+'" data-field="견적가한화" style="font-family:var(--mono);cursor:pointer" title="클릭하여 수정">'+(+d.견적가한화||0).toLocaleString()+'</td>'
        +'<td class="r qhd-ed" data-key="'+dkey+'" data-field="마진율" style="font-family:var(--mono);font-size:11px;color:'+dmClr+';cursor:pointer" title="클릭하여 수정">'+dm+'%</td>'
        +'<td class="qhd-ed" data-key="'+dkey+'" data-field="프로젝트" style="font-size:11px;color:var(--text2);cursor:pointer" title="클릭하여 수정">'+(d.프로젝트||'')+'</td>'
        +'<td></td><td></td>'
        +'<td style="text-align:center" onclick="event.stopPropagation()">'
          +'<button data-key="'+dkey+'" data-qno="'+qno+'" onclick="qHistDelDetail(this.dataset.key,this.dataset.qno)" style="background:none;border:1px solid rgba(255,85,85,.3);border-radius:4px;padding:2px 6px;font-size:10px;color:var(--red);cursor:pointer" title="행 삭제">✕</button>'
        +'</td></tr>';
    });
  });

  html+='</tbody></table></div>';
  cont.innerHTML=html;

  // 합계행 셀 클릭 → 인라인 편집
  cont.querySelectorAll('.qh-ed').forEach(function(td){
    td.addEventListener('click', function(){
      if(td.querySelector('input')) return;
      var field=td.dataset.field;
      var qno=td.dataset.qno;
      var curVal=td.textContent.replace('%','').replace(/,/g,'').trim();
      var isNum=['ASSY수량','매입합계','작업비','견적가달러','견적가한화','마진율'].indexOf(field)>=0;
      var inp=document.createElement('input');
      inp.type=isNum?'number':'text';
      inp.value=curVal;
      inp.style.cssText='width:100%;background:var(--bg);border:1px solid var(--amb);border-radius:4px;padding:2px 5px;color:var(--text);font-size:11.5px;font-family:var(--mono);text-align:'+(isNum?'right':'left');
      inp.onclick=function(e){e.stopPropagation();};
      function saveInline(){
        var val=inp.value.trim();
        qHistInlineSave(qno, field, val);
      }
      inp.addEventListener('blur', saveInline);
      inp.addEventListener('keydown', function(e){
        if(e.key==='Enter') inp.blur();
        if(e.key==='Escape'){ qHistInlineSave(null,null,null); }
      });
      td.innerHTML='';
      td.appendChild(inp);
      inp.focus(); inp.select();
    });
  });
  // 상세행 셀 클릭 → 인라인 편집
  cont.querySelectorAll('.qhd-ed').forEach(function(td){
    td.addEventListener('click', function(){
      if(td.querySelector('input')) return;
      var field=td.dataset.field;
      var key=td.dataset.key;
      var curVal=td.textContent.replace('%','').replace(/,/g,'').trim();
      var isNum=['ASSY수량','매입합계','작업비','견적가달러','견적가한화','마진율'].indexOf(field)>=0;
      var inp=document.createElement('input');
      inp.type=isNum?'number':'text';
      inp.value=curVal;
      inp.style.cssText='width:100%;background:var(--bg);border:1px solid var(--teal);border-radius:4px;padding:2px 5px;color:var(--text);font-size:11px;font-family:var(--mono);text-align:'+(isNum?'right':'left');
      inp.onclick=function(e){e.stopPropagation();};
      inp.addEventListener('blur',function(){ qHistDetailSave(key,field,inp.value.trim()); });
      inp.addEventListener('keydown',function(e){ if(e.key==='Enter') inp.blur(); if(e.key==='Escape'){ var c=document.getElementById('q-hist-cont'); if(c){ var h=JSON.parse(localStorage.getItem('jst_quote_hist')||'[]'); qRenderHistData(h,c); } } });
      td.innerHTML=''; td.appendChild(inp); inp.focus(); inp.select();
    });
  });
}

function qHistDetailSave(key, field, val){
  if(!key||!field) return;
  var sp=key.split('__'), qno=sp[0], di=parseInt(sp[1]);
  var hist; try{hist=JSON.parse(localStorage.getItem('jst_quote_hist')||'[]');}catch(e){hist=[];}
  var isNum=['ASSY수량','매입합계','작업비','견적가달러','견적가한화','마진율'].indexOf(field)>=0;
  var parsed=isNum?parseFloat(val)||0:val;
  var detRows=hist.map(function(r,i){return {r:r,i:i};}).filter(function(x){return x.r.견적번호===qno&&x.r.상태==='제출';});
  if(detRows[di]!==undefined){
    hist[detRows[di].i][field]=parsed;
    hist=hist.map(function(r){ return (r.견적번호===qno&&r.상태==='합계')?Object.assign({},r,{수정일시:new Date().toISOString()}):r; });
  }
  try{localStorage.setItem('jst_quote_hist',JSON.stringify(hist));}catch(e){}
  qToast('✓ 저장됨','ok',1000);
  var cont=document.getElementById('q-hist-cont');
  if(cont) qRenderHistData(hist,cont);
}

function qHistDelDetail(key, qno){
  if(!confirm('이 항목을 삭제하시겠습니까?')) return;
  var di=parseInt(key.split('__')[1]);
  var hist; try{hist=JSON.parse(localStorage.getItem('jst_quote_hist')||'[]');}catch(e){hist=[];}
  var detRows=hist.map(function(r,i){return {r:r,i:i};}).filter(function(x){return x.r.견적번호===qno&&x.r.상태==='제출';});
  if(detRows[di]!==undefined){
    hist.splice(detRows[di].i,1);
    hist=hist.map(function(r){ return (r.견적번호===qno&&r.상태==='합계')?Object.assign({},r,{수정일시:new Date().toISOString()}):r; });
  }
  try{localStorage.setItem('jst_quote_hist',JSON.stringify(hist));}catch(e){}
  qToast('삭제됨','ok',1000);
  var cont=document.getElementById('q-hist-cont');
  if(cont) qRenderHistData(hist,cont);
}

function qHistInlineSave(qno, field, val){
  if(!qno) return;
  var hist; try{hist=JSON.parse(localStorage.getItem('jst_quote_hist')||'[]');}catch(e){hist=[];}
  var isNum=['ASSY수량','매입합계','작업비','견적가달러','견적가한화','마진율'].indexOf(field)>=0;
  var parsed=isNum?parseFloat(val)||0:val;
  var now=new Date().toISOString();
  hist=hist.map(function(r){
    if(r.견적번호===qno&&r.상태==='합계'){
      var updated=Object.assign({},r);
      updated[field]=parsed;
      updated.수정일시=now;
      return updated;
    }
    return r;
  });
  try{localStorage.setItem('jst_quote_hist',JSON.stringify(hist));}catch(e){}
  qToast('✓ 저장됨','ok',1200);
  var cont=document.getElementById('q-hist-cont');
  if(cont) qRenderHistData(hist,cont);
}

// ── 견적이력 단건 추가 ──
function qHistAddNew(){
  var today=new Date().toISOString().slice(0,10);
  qHistShowModal({
    견적번호:'', 견적일자:today, 품번:'', 품명:'', ASSY수량:1,
    매입합계:0, 작업비:0, 견적가달러:0, 견적가한화:0, 마진율:0,
    프로젝트:'', 비고:'', 제출일시:new Date().toISOString(), 상태:'합계', 수정일시:''
  }, true);
}

function qHistShowModal(r, isNew){
  var existing=document.getElementById('m-hist-edit');
  if(existing) existing.remove();
  var div=document.createElement('div');
  div.id='m-hist-edit';
  div.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center';
  div.innerHTML='<div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:24px;width:500px;max-width:95vw;max-height:90vh;overflow-y:auto">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">'
    +'<b style="font-size:14px;color:var(--text)">견적이력 단건 추가</b>'
    +'<button onclick="document.getElementById(\'m-hist-edit\').remove()" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer">✕</button>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    +qHF('견적번호','h-qno',r.견적번호||'')
    +qHF('견적일자','h-qdate',r.견적일자||'','date')
    +qHF('품번(ASSY)','h-pn',r.품번||'')
    +qHF('품명','h-pname',r.품명||'')
    +qHF('ASSY수량','h-qty',r.ASSY수량||1,'number')
    +qHF('프로젝트','h-proj',r.프로젝트||'')
    +qHF('매입합계(₩)','h-buy',r.매입합계||0,'number')
    +qHF('작업비(₩)','h-labor',r.작업비||0,'number')
    +qHF('견적가($)','h-usd',r.견적가달러||0,'number')
    +qHF('견적가(₩)','h-krw',r.견적가한화||0,'number')
    +qHF('마진율(%)','h-margin',r.마진율||0,'number')
    +qHF('비고','h-note',r.비고||'')
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">'
    +'<button onclick="document.getElementById(\'m-hist-edit\').remove()" style="padding:8px 18px;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;color:var(--text2);cursor:pointer">취소</button>'
    +'<button onclick="qHistSaveModal()" style="padding:8px 18px;background:var(--amb);border:none;border-radius:7px;color:#111;font-weight:700;cursor:pointer">추가</button>'
    +'</div></div>';
  document.body.appendChild(div);
}

function qHF(label,id,val,type,disabled){
  type=type||'text';
  return '<div><label style="font-size:11px;color:var(--text3);display:block;margin-bottom:3px">'+label+'</label>'
    +'<input id="'+id+'" type="'+type+'" value="'+val+'" '+(disabled?'disabled':'')+' style="width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;padding:6px 8px;color:var(--text);font-size:12px;box-sizing:border-box"></div>';
}

function qHistSaveModal(){
  var qno=document.getElementById('h-qno').value.trim();
  if(!qno){ qToast('견적번호를 입력하세요','err'); return; }
  var hist; try{hist=JSON.parse(localStorage.getItem('jst_quote_hist')||'[]');}catch(e){hist=[];}
  var now=new Date().toISOString();
  var newRow={
    견적번호:qno, 견적일자:document.getElementById('h-qdate').value,
    품번:document.getElementById('h-pn').value.trim(),
    품명:document.getElementById('h-pname').value.trim(),
    ASSY수량:parseFloat(document.getElementById('h-qty').value)||1,
    프로젝트:document.getElementById('h-proj').value.trim(),
    매입합계:parseFloat(document.getElementById('h-buy').value)||0,
    작업비:parseFloat(document.getElementById('h-labor').value)||0,
    견적가달러:parseFloat(document.getElementById('h-usd').value)||0,
    견적가한화:parseFloat(document.getElementById('h-krw').value)||0,
    마진율:parseFloat(document.getElementById('h-margin').value)||0,
    비고:document.getElementById('h-note').value.trim(),
    제출일시:now, 수정일시:'', 상태:'합계'
  };
  hist.unshift(newRow);
  try{localStorage.setItem('jst_quote_hist',JSON.stringify(hist));}catch(e){}
  document.getElementById('m-hist-edit').remove();
  qToast('✓ 추가됨: '+qno,'ok',2000);
  var cont=document.getElementById('q-hist-cont');
  if(cont) qRenderHistData(hist,cont);
}

function qHistDelete(qno){
  if(!confirm('['+qno+'] 견적이력을 삭제하시겠습니까?')) return;
  var hist; try{hist=JSON.parse(localStorage.getItem('jst_quote_hist')||'[]');}catch(e){hist=[];}
  var newHist=hist.filter(function(r){return r.견적번호!==qno;});
  try{localStorage.setItem('jst_quote_hist',JSON.stringify(newHist));}catch(e){}
  qToast('삭제됨: '+qno,'ok',2000);
  var cont=document.getElementById('q-hist-cont');
  if(cont) qRenderHistData(newHist,cont);
}

function qExportHistCSV(){
  var hist; try{hist=JSON.parse(localStorage.getItem('jst_quote_hist')||'[]');}catch(e){hist=[];}
  if(!hist.length){ qToast('이력이 없습니다','err'); return; }
  var keys=['견적번호','견적일자','품번','품명','ASSY수량','매입합계','작업비','견적가달러','견적가한화','마진율','프로젝트','비고','제출일시','상태'];
  var csv=[keys].concat(hist.map(function(r){return keys.map(function(k){return r[k]!=null?r[k]:'';});}))
    .map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
  a.download='견적이력_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click(); qToast('✓ 이력 CSV 저장됨','ok');
}

/* ── CSV 상세 내보내기 ── */
function qExportCSV(){
  if(!QS.quoteAssies.length){ qToast('견적을 먼저 생성하세요','err'); return; }
  var cfg=qGetCfg();
  var rows=[['ASSY PN','ASSY DESC','ASSY수량','LV','품번','품명','제조사','MFG PN','REV','BOM수량','실수량','UNIT','매입가(₩)','매입소계(₩)','마진율(%)','견적가per($)','견적소계($)','구매처','납기','상태','작업비(₩)']];
  QS.quoteAssies.forEach(function(a){
    rows.push([a.pn,a.desc,a.assyQty,'0',a.pn,a.desc,'','',a.rev,'','','','','','','','','','',a.isAssy?'ASSY':'PART',a.isAssy?a.laborKrw:'']);
    a.parts.forEach(function(p){
      var it=p.item||{};
      rows.push([a.pn,a.desc,a.assyQty,'1',p.pn,it.d||p.desc,it.mg||'',it.mp||'',p.rev,p.qty,p.effQty,p.unit,p.buyKrw!=null?p.buyKrw:'',p.buyKrwTotal!=null?p.buyKrwTotal:'',p.margin!=null?(p.margin*100).toFixed(1):'',p.quoteUSDper!=null?p.quoteUSDper.toFixed(4):'',p._custom!=null?p._custom:p.quoteUSDTotal!=null?p.quoteUSDTotal.toFixed(2):'',p.vendor,p.lt,p.status,'']);
    });
    rows.push([a.pn,'합계',a.assyQty,'','','','','','','','','','',Math.round(a.totalBuyKrw),'',a.totalUSD.toFixed(2),'','','','',a.isAssy?a.laborKrw:'']);
    rows.push([]);
  });
  var csv=rows.map(function(r){return r.map(function(c){return '"'+String(c!=null?c:'').replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
  a.download='견적_'+(document.getElementById('q-no').value||'DRAFT')+'_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click(); qToast('✓ CSV 저장됨','ok');
}

/* ── 초기화 ── */
(function(){
  var today=new Date().toISOString().slice(0,10);
  var qd=document.getElementById('q-date');
  if(qd){ qd.value=today; qAutoNo(today); }
  qUpdRateDisp();
})();

/* ── BOM관리에 저장 ── */
function qSaveToBOM(){
  if(!QS.bomAssies.length){ qToast('BOM이 비어있습니다','err'); return; }
  var assyPNs=QS.bomAssies.filter(function(a){return a.parts.length>0;}).map(function(a){return a.pn;});
  if(!assyPNs.length){ qToast('저장할 ASSY가 없습니다','err'); return; }

  // 확인 메시지
  var msg='다음 ASSY BOM을 BOM관리에 저장합니다:\n\n'+assyPNs.join('\n')+'\n\n기존 데이터는 덮어씌워집니다. 계속하시겠습니까?';
  if(!confirm(msg)) return;

  var added=0, updated=0;
  QS.bomAssies.forEach(function(assy){
    if(!assy.parts.length) return;
    var parent=String(assy.pn).trim();
    var children=assy.parts.map(function(p,idx){
      var entry={
        no: idx+1,
        lv: 1,
        pn: String(p.pn).trim(),
        desc: p.desc||(p.item?p.item.d:''),
        qty: p.qty,
        aqty: p.qty,   // 실사용수량은 ASSY수량 곱셈이므로 BOM엔 기본값 저장
        unit: p.unit||'EA'
      };
      // REV가 있으면 추가
      if(p.rev) entry.rev=p.rev;
      return entry;
    });
    if(BOM[parent]) updated++; else added++;
    BOM[parent]=children;
  });

  // localStorage + 서버 동기화
  try{ sv(K.BOM, BOM); }catch(e){}
  if(CURRENT_TOKEN){
    apiPost({ action:'setSheet', sheet:'bom_data', data: bomToRows(BOM) })
      .then(function(){ qToast('✓ BOM관리 저장 완료 (신규 '+added+'건 / 갱신 '+updated+'건)','ok'); })
      .catch(function(e){ qToast('서버 저장 실패, 로컬 저장됨','info'); });
  } else {
    qToast('✓ 로컬 BOM 저장 완료 (신규 '+added+'건 / 갱신 '+updated+'건)','ok');
  }

  // BOM관리 탭 UI 갱신 (함수가 있으면)
  if(typeof renderBOM==='function') renderBOM();
  if(typeof updateBOMStat==='function') updateBOMStat();
}

/* ── 문서번호 자동부여 ── */
function qAutoNo(dateStr){
  if(!dateStr) return;
  var d=dateStr; // 'YYYY-MM-DD'
  var prefix=d.slice(2,4)+d.slice(5,7)+d.slice(8,10); // 'YYMMDD'
  var hist=[]; try{hist=JSON.parse(localStorage.getItem('jst_quote_hist')||'[]');}catch(e){}
  // 같은 날짜 prefix의 '합계' 이력 수 카운트
  var count=hist.filter(function(r){ return r.상태==='합계'&&r.견적번호&&r.견적번호.startsWith(prefix+'-'); }).length;
  var seq=String(count+1).padStart(3,'0');
  var noEl=document.getElementById('q-no');
  if(noEl) noEl.value=prefix+'-'+seq;
}

/* ── 수동입력 날짜 → 문서번호 ── */
function qMAutoNo(dateStr){
  if(!dateStr) return;
  var d=dateStr;
  var prefix=d.slice(2,4)+d.slice(5,7)+d.slice(8,10);
  var hist=[]; try{hist=JSON.parse(localStorage.getItem('jst_quote_hist')||'[]');}catch(e){}
  var count=hist.filter(function(r){ return r.상태==='합계'&&r.견적번호&&r.견적번호.startsWith(prefix+'-'); }).length;
  var seq=String(count+1).padStart(3,'0');
  var noEl=document.getElementById('qm-no');
  if(noEl&&!noEl.value) noEl.value=prefix+'-'+seq;
}

/* ── 수동이력 토글 ── */
function qToggleManualEntry(){
  var el=document.getElementById('q-manual-entry');
  if(!el) return;
  el.style.display=el.style.display==='none'?'block':'none';
  if(el.style.display==='block'){
    var today=new Date().toISOString().slice(0,10);
    var dateEl=document.getElementById('qm-date');
    if(dateEl&&!dateEl.value){ dateEl.value=today; qMAutoNo(today); }
  }
}

/* ── 수동이력 저장 ── */
function qSaveManualEntry(){
  var g=function(id){ var e=document.getElementById(id); return e?e.value.trim():''; };
  var qdate=g('qm-date'); if(!qdate){ qToast('견적일자를 입력하세요','err'); return; }
  var pn=g('qm-pn'); if(!pn){ qToast('품번을 입력하세요','err'); return; }
  var usd=parseFloat(g('qm-usd')); if(!usd){ qToast('견적가($)를 입력하세요','err'); return; }
  var qno=g('qm-no')||qdate.slice(2,4)+qdate.slice(5,7)+qdate.slice(8,10)+'-M'+Date.now().toString().slice(-3);
  var qty=parseInt(g('qm-qty'))||1;
  var buyKrw=parseFloat(g('qm-buy'))||0;
  var labor=parseFloat(g('qm-labor'))||0;
  var cfg2=qGetCfg();
  var krw=parseFloat(g('qm-krw'))||Math.round(usd*cfg2.sellRate);
  var marg=krw>0?parseFloat(((krw-buyKrw-labor)/krw*100).toFixed(1)):0;

  var records=[
    {견적번호:qno,견적일자:qdate,품번:pn,품명:g('qm-desc'),ASSY수량:qty,
     매입합계:buyKrw,작업비:labor,견적가달러:usd,견적가한화:krw,
     마진율:marg,프로젝트:g('qm-prj'),비고:g('qm-note'),
     제출일시:new Date().toISOString(),상태:'제출'},
    {견적번호:qno,견적일자:qdate,품번:'(합계)',품명:'수동입력',ASSY수량:qty,
     매입합계:buyKrw,작업비:labor,견적가달러:usd,견적가한화:krw,
     마진율:marg,프로젝트:g('qm-prj'),비고:g('qm-note'),
     제출일시:new Date().toISOString(),상태:'합계'}
  ];

  var hist=[]; try{hist=JSON.parse(localStorage.getItem('jst_quote_hist')||'[]');}catch(e){}
  // 같은 견적번호면 합계만 업데이트하고 제출 추가
  hist=hist.filter(function(r){ return !(r.견적번호===qno&&r.상태==='합계'); });
  try{ localStorage.setItem('jst_quote_hist',JSON.stringify(records.concat(hist))); }catch(e){}

  // 서버 저장 (rows를 객체배열로 전송)
  if(CURRENT_TOKEN){
    apiPost({action:'appendRows',sheet:'quote_hist',rows:records}).catch(function(){});
  }

  qToast('✓ 이력 저장: '+qno+' / '+pn,'ok');

  // 폼 초기화 (품번만 클리어, 나머지 유지하여 동일 견적번호로 여러 ASSY 추가 가능)
  ['qm-pn','qm-desc','qm-qty','qm-buy','qm-labor','qm-usd','qm-krw','qm-note'].forEach(function(id){
    var e=document.getElementById(id); if(e) e.value=id==='qm-qty'?'1':'';
  });
  qRenderHist();
}

/* ── PO PDF 업로드 (PDF.js 동적 로드) ── */
var _pdfJsLoaded = false;
var _pdfJsLoading = false;
var _pdfJsCbs = [];

function qEnsurePdfJs(cb){
  if(_pdfJsLoaded){ cb(); return; }
  _pdfJsCbs.push(cb);
  if(_pdfJsLoading) return;
  _pdfJsLoading = true;
  var s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  s.onload = function(){
    // pdf.js 워커 설정
    if(window.pdfjsLib){
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    _pdfJsLoaded = true;
    _pdfJsCbs.forEach(function(fn){ fn(); });
    _pdfJsCbs = [];
  };
  s.onerror = function(){
    qToast('PDF.js 로드 실패. 인터넷 연결을 확인하세요','err',5000);
    _pdfJsLoading = false; _pdfJsCbs = [];
  };
  document.head.appendChild(s);
}

function qLoadPOPdf(inp){
  if(!inp||!inp.files[0]) return;
  var file=inp.files[0];
  var stEl=document.getElementById('qpo-pdf-status');
  if(stEl) stEl.textContent='⏳ PDF.js 로드 중...';
  qToast('PDF 로드 중...','info',8000);

  qEnsurePdfJs(function(){
    if(!window.pdfjsLib){ qToast('PDF.js 로드 실패','err'); return; }
    if(stEl) stEl.textContent='⏳ PDF 파싱 중...';
    var reader=new FileReader();
    reader.onload=function(e){
      var arr=new Uint8Array(e.target.result);
      pdfjsLib.getDocument({data:arr}).promise.then(function(pdf){
        var pages=pdf.numPages, textPromises=[];
        for(var pg=1;pg<=pages;pg++){
          textPromises.push(pdf.getPage(pg).then(function(page){
            return page.getTextContent({normalizeWhitespace:false, disableCombineTextItems:false});
          }));
        }
        Promise.all(textPromises).then(function(results){
          var fullText='';
          results.forEach(function(tc){
            // ── y좌표 허용오차 그룹핑 (±4px) ──
            var Y_TOL=4;
            var groups=[]; // [{y, items:[{x,str,w}]}]
            tc.items.forEach(function(item){
              var iy=item.transform[5];
              var ix=item.transform[4];
              var iw=item.width||0;
              var grp=null;
              for(var g=0;g<groups.length;g++){
                if(Math.abs(groups[g].y-iy)<=Y_TOL){ grp=groups[g]; break; }
              }
              if(!grp){ grp={y:iy,items:[]}; groups.push(grp); }
              grp.items.push({x:ix,str:item.str,w:iw});
            });
            // y 내림차순 (PDF좌표 = 아래가 0, 위가 큰값)
            groups.sort(function(a,b){return b.y-a.y;});
            groups.forEach(function(grp){
              grp.items.sort(function(a,b){return a.x-b.x;});
              var lineStr='';
              grp.items.forEach(function(it,idx){
                if(!it.str) return;
                if(idx===0){ lineStr+=it.str; return; }
                var prev=grp.items[idx-1];
                // x 간격으로 스페이스 개수 결정 (컬럼 구분)
                var gap=it.x-(prev.x+(prev.w||0));
                if(gap>30) lineStr+='  '+it.str;       // 넓은 간격=컬럼 경계
                else if(gap>2) lineStr+=' '+it.str;     // 일반 단어 간격
                else lineStr+=it.str;                   // 붙어있는 문자
              });
              lineStr=lineStr.trim();
              if(lineStr) fullText+=lineStr+'\n';
            });
          });

          // ── 디버그: textarea에 원본 표시 ──
          var ta=document.getElementById('qpo-paste');
          if(ta) ta.value=fullText;

          // ── PO No 자동 추출 ──
          var mPO=fullText.match(/(?:PURCHASE ORDER NO\.?|815\d{3})\s*\n?\s*(\d{6,})/i)
                ||fullText.match(/(\d{6,})\s*\n.*PURCHASE ORDER/i);
          // 간단히 6자리 이상 숫자로 PO No 추정
          var mPO2=fullText.match(/\b(8\d{5})\b/);
          if(mPO2){
            var noEl=document.getElementById('qpo-no');
            if(noEl&&!noEl.value) noEl.value=mPO2[1];
          }

          // ── 날짜 자동 추출 ──
          var mDate=fullText.match(/(\d{2}\/\d{2}\/\d{2,4})/);
          if(mDate){
            var dateEl=document.getElementById('qpo-date');
            if(dateEl&&!dateEl.value){
              var dp=mDate[1].split('/');
              var yr=dp[2].length===2?'20'+dp[2]:dp[2];
              dateEl.value=yr+'-'+dp[0].padStart(2,'0')+'-'+dp[1].padStart(2,'0');
            }
          }

          if(stEl) stEl.textContent='✓ '+pages+'페이지 추출 — 파싱 중...';
          qToast('✓ PDF 추출 완료 — 파싱 중...','ok');
          // 파싱 실행
          setTimeout(function(){ qParsePO(); },100);
        });
      }).catch(function(err){
        if(stEl) stEl.textContent='❌ PDF 오류: '+err.message;
        qToast('PDF 파싱 오류: '+err.message,'err',5000);
      });
    };
    reader.readAsArrayBuffer(file);
    inp.value='';
  });
}

/* ── PO 파싱 & 대조 ── */
function qParsePO(){
  var txt=document.getElementById('qpo-paste').value;
  if(!txt.trim()){ qToast('PO 내용을 붙여넣기하세요','err'); return; }
  QP.poNo   = document.getElementById('qpo-no').value.trim() || '?';
  QP.poDate = document.getElementById('qpo-date').value || '';
  QP.items  = [];
  var lines=txt.split('\n').map(function(l){return l.trim();}).filter(Boolean);
  // AXCELIS PO ITEM 행 정규식 (스페이스 수 무관, 컬럼 순: ITEM QTY OPENQTY UM PN REV UNITPRICE $EXT BREV)
  var reItem = /^(0\d{3})\s+([\d.]+)\s+([\d.]+)\s+(\w+)\s+(\S+?)\s+([A-Z#*])\s+([\d.]+)\s+\$([\d,]+\.?\d*)\s*([A-Z#*])?/;
  // 대체 패턴: $기호 없이 오는 경우 대비
  var reItem2= /^(0\d{3})\s+([\d.]+)\s+([\d.]+)\s+(\w+)\s+(\d[\dA-Za-z\-]+)\s+([A-Z#*])\s+([\d.]+)\s+([\d,]+\.?\d*)/;
  // SEQ 납기 행
  var reSeq  = /^(0\d{2})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.]+)\s+([\d.]+)/;
  var cur = null;
  for(var i=0;i<lines.length;i++){
    var l=lines[i];
    var mItem=l.match(reItem)||l.match(reItem2);
    if(mItem){
      var pnRaw=mItem[5].replace(/\.0+$/,'').replace(/\s/g,'');
      cur={item:mItem[1],ordQty:parseFloat(mItem[2]),openQty:parseFloat(mItem[3]),
        um:mItem[4],pn:pnRaw,rev:mItem[6],
        unitPrice:parseFloat(mItem[7]),
        extension:parseFloat((mItem[8]||'0').replace(/,/g,'')),
        brev:mItem[9]||'',desc:'',delivDate:'',_note:''};
      QP.items.push(cur); continue;
    }
    var mSeq=l.match(reSeq);
    if(mSeq&&cur){ if(!cur.delivDate) cur.delivDate=mSeq[2]; continue; }
    if(cur&&!cur.desc&&/^[A-Z]/.test(l)&&l.length>4&&!/^PAGE|^PURCHASE|^AXCELIS|^JINSUN|^Axcelis/.test(l)){
      if(/QUOTE|quote/.test(l)&&/\d{2}\.\d{2}\.\d{2}/.test(l)) cur._note=l;
      else cur.desc=l;
    }
  }
  if(!QP.items.length){
    // 파싱 실패 시 textarea에서 문제 라인 찾아서 힌트 제공
    var sampleLines=lines.slice(0,30).filter(function(l){return /^0\d{3}/.test(l);});
    var hint=sampleLines.length?'\n\n감지된 ITEM 후보:\n'+sampleLines.slice(0,3).join('\n'):'';
    qToast('PO 항목 파싱 실패. 텍스트란을 확인하세요'+hint,'err',6000);
    return;
  }

  // 견적 이력 인덱스 (품번 → 가장 최근 제출가)
  var histIdx={};
  try{
    var hist=JSON.parse(localStorage.getItem('jst_quote_hist')||'[]');
    hist.filter(function(r){return r.상태==='제출';})
      .sort(function(a,b){return (b.견적일자||'').localeCompare(a.견적일자||'');})
      .forEach(function(r){
        var pn=String(r.품번||'').trim();
        if(pn&&pn!=='(합계)'&&!histIdx[pn]){
          histIdx[pn]={usd:+(r.견적가달러)||null, date:r.견적일자||'', no:r.견적번호||''};
        }
      });
  }catch(e){}

  var cfg=qGetCfg();
  QP.items.forEach(function(p){
    var item=qFindItem(p.pn);
    p.dbItem=item;
    var buyKrw=item?(qToN(item.k6)||qToN(item.k5)||null):null;
    p.buyKrw=buyKrw;
    var histEntry=histIdx[p.pn]||null;
    p.histQuote=histEntry;
    p.calcQuoteUSD=buyKrw!=null?buyKrw/(1-qGetMarg(buyKrw,cfg))/cfg.sellRate:null;
    // 비교 기준: 이력 견적가 우선, 없으면 이론 견적가
    p.cmpUSD=(histEntry&&histEntry.usd)?histEntry.usd:p.calcQuoteUSD;
    p.poMargin=buyKrw!=null?(p.unitPrice-buyKrw/cfg.sellRate)/p.unitPrice*100:null;
    if(!item) p.status='nodb';
    else if(buyKrw==null) p.status='noprice';
    else p.status='ok';
  });

  qPORenderSummary(cfg);
  qPORenderTable();
  document.getElementById('qpo-result').style.display='block';
  qToast('✓ PO '+QP.items.length+'개 항목 파싱 완료','ok');
}

function qPORenderSummary(cfg){
  if(!cfg) cfg=qGetCfg();
  var tol=parseFloat((document.getElementById('qpo-tolerance')||{value:2}).value)||2;
  var nodb   =QP.items.filter(function(p){return p.status==='nodb';}).length;
  var noprice=QP.items.filter(function(p){return p.status==='noprice';}).length;
  var mismatch=QP.items.filter(function(p){
    return p.cmpUSD!=null&&Math.abs(p.unitPrice-p.cmpUSD)/Math.max(p.cmpUSD,.01)*100>tol;
  }).length;
  var ok=QP.items.length-nodb-noprice-mismatch;
  var totalPO=QP.items.reduce(function(s,p){return s+p.extension;},0);
  var el=document.getElementById('qpo-summary');
  if(!el) return;
  el.innerHTML=
    '<div class="q-sc"><div class="q-scl">PO No.</div><div class="q-scv" style="font-size:14px;color:var(--teal)">'+QP.poNo+'</div><div class="q-scs">'+QP.poDate+'</div></div>'
   +'<div class="q-sc"><div class="q-scl">총 항목</div><div class="q-scv">'+QP.items.length+'</div><div class="q-scs">Line Items</div></div>'
   +'<div class="q-sc"><div class="q-scl">PO 총액 ($)</div><div class="q-scv" style="color:var(--teal)">'+totalPO.toFixed(2)+'</div><div class="q-scs">'+(Math.round(totalPO*cfg.sellRate)).toLocaleString()+' ₩</div></div>'
   +(mismatch?'<div class="q-sc" style="border-color:var(--red)"><div class="q-scl" style="color:var(--red)">단가 불일치</div><div class="q-scv red">'+mismatch+'</div><div class="q-scs" style="color:var(--red)">허용오차 '+tol+'% 초과</div></div>':'')
   +(nodb?'<div class="q-sc" style="border-color:var(--amb)"><div class="q-scl" style="color:var(--amb)">DB 미등록</div><div class="q-scv" style="color:var(--amb)">'+nodb+'</div></div>':'')
   +(noprice?'<div class="q-sc" style="border-color:var(--accent)"><div class="q-scl" style="color:var(--accent)">단가없음</div><div class="q-scv" style="color:var(--accent)">'+noprice+'</div></div>':'')
   +'<div class="q-sc" style="border-color:var(--green)"><div class="q-scl" style="color:var(--green)">일치</div><div class="q-scv grn">'+ok+'</div></div>';
}

function qPORenderTable(){
  var tol=parseFloat((document.getElementById('qpo-tolerance')||{value:2}).value)||2;
  var cfg=qGetCfg();
  var fEl=document.querySelector('input[name="qpo-filter"]:checked');
  var fVal=fEl?fEl.value:'all';
  var items=QP.items.filter(function(p){
    if(fVal==='nodb')    return p.status==='nodb'||p.status==='noprice';
    if(fVal==='ok')      return p.cmpUSD!=null&&Math.abs(p.unitPrice-p.cmpUSD)/Math.max(p.cmpUSD,.01)*100<=tol;
    if(fVal==='mismatch')return p.cmpUSD!=null&&Math.abs(p.unitPrice-p.cmpUSD)/Math.max(p.cmpUSD,.01)*100>tol;
    return true;
  });
  var html=items.map(function(p){
    var buyDisp=p.buyKrw!=null?p.buyKrw.toLocaleString()+' \u20a9':'—';
    // 제출 견적가 표시 (이력 = 굵게, 이론 = 회색)
    var quotDisp;
    if(p.histQuote&&p.histQuote.usd){
      quotDisp='<span style="font-weight:700;color:var(--text)">'+p.histQuote.usd.toFixed(2)+'</span>'
        +'<div style="font-size:9px;color:var(--text3);font-family:var(--mono)">'+p.histQuote.date+'</div>';
    } else if(p.calcQuoteUSD!=null){
      quotDisp='<span style="color:var(--text3)">'+p.calcQuoteUSD.toFixed(2)+'</span>'
        +'<div style="font-size:9px;color:var(--text3)">이론가</div>';
    } else { quotDisp='<span style="color:var(--text3)">—</span>'; }
    // 차이 ($)
    var diffDisp='—', diffStyle='color:var(--text3)';
    if(p.cmpUSD!=null){
      var dv=p.unitPrice-p.cmpUSD;
      diffDisp=(dv>=0?'+':'')+dv.toFixed(2);
      diffStyle=dv>0.01?'color:var(--green);font-weight:700':dv<-0.01?'color:var(--red);font-weight:700':'color:var(--green)';
    }
    var marDisp=p.poMargin!=null?p.poMargin.toFixed(1)+'%':'—';
    var marCol=p.poMargin!=null?(p.poMargin>=30?'var(--green)':p.poMargin>=20?'var(--amb)':'var(--red)'):'var(--text3)';
    // 상태
    var stHtml,rowBg='';
    if(p.status==='nodb'){
      stHtml='<span style="background:rgba(255,181,71,.18);color:var(--amb);border:1px solid rgba(255,181,71,.3);border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700">미등록</span>';
      rowBg='background:rgba(255,181,71,.05)';
    } else if(p.status==='noprice'){
      stHtml='<span style="background:rgba(79,124,255,.15);color:var(--accent);border:1px solid rgba(79,124,255,.3);border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700">단가없음</span>';
      rowBg='background:rgba(79,124,255,.05)';
    } else if(p.cmpUSD==null){
      stHtml='<span style="background:var(--bg3);color:var(--text2);border:1px solid var(--border2);border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700">미대조</span>';
    } else {
      var pct=Math.abs(p.unitPrice-p.cmpUSD)/Math.max(p.cmpUSD,.01)*100;
      var dv2=p.unitPrice-p.cmpUSD;
      if(pct<=tol){
        stHtml='<span style="background:rgba(52,211,153,.15);color:var(--green);border:1px solid rgba(52,211,153,.3);border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700">✓ 일치</span>';
      } else if(dv2>0){
        stHtml='<span style="background:rgba(52,211,153,.12);color:var(--green);border:1px solid rgba(52,211,153,.3);border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700">\u2191 PO높음</span>';
        rowBg='background:rgba(52,211,153,.04)';
      } else {
        stHtml='<span style="background:rgba(255,85,85,.12);color:var(--red);border:1px solid rgba(255,85,85,.3);border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700">\u2193 PO낮음</span>';
        rowBg='background:rgba(255,85,85,.06)';
      }
    }
    var ppStyle=p.cmpUSD!=null?((p.unitPrice-p.cmpUSD)>0.01?'color:var(--green);font-weight:700':(p.unitPrice-p.cmpUSD)<-0.01?'color:var(--red);font-weight:700':'color:var(--green)'):'';
    return '<tr style="'+rowBg+'">'
      +'<td class="c" style="font-family:var(--mono);font-size:11px;color:var(--text2)">'+p.item+'</td>'
      +'<td style="font-family:var(--mono);font-size:11px;font-weight:600;color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+p.pn+'</td>'
      +'<td style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+p.desc+'">'+p.desc+'</td>'
      +'<td class="c" style="font-family:var(--mono);font-size:10px">'+p.rev+'</td>'
      +'<td class="r" style="font-family:var(--mono);font-size:12px">'+p.ordQty+'</td>'
      +'<td class="r" style="font-family:var(--mono);font-size:12.5px;'+ppStyle+'">'+p.unitPrice.toFixed(2)+'</td>'
      +'<td class="r" style="font-family:var(--mono);font-size:12px;line-height:1.3">'+quotDisp+'</td>'
      +'<td class="r" style="font-family:var(--mono);font-size:11px;color:var(--text2)">'+buyDisp+'</td>'
      +'<td class="r" style="font-family:var(--mono);font-size:12px;'+diffStyle+'">'+diffDisp+'</td>'
      +'<td class="c" style="font-family:var(--mono);font-size:11px;color:'+marCol+'">'+marDisp+'</td>'
      +'<td class="r" style="font-family:var(--mono);font-size:11.5px">'+p.extension.toFixed(2)+'</td>'
      +'<td class="r" style="font-family:var(--mono);font-size:10.5px;color:var(--text2)">'+p.delivDate+'</td>'
      +'<td class="c">'+stHtml+'</td>'
      +'</tr>';
  }).join('');
  var tb=document.getElementById('qpo-rows');
  if(tb) tb.innerHTML=html||'<tr><td colspan="13" style="text-align:center;padding:20px;color:var(--text3)">해당 항목 없음</td></tr>';
  qPORenderSummary(cfg);
}

function qExportPOResult(){
  if(!QP.items.length){ qToast('PO 파싱 먼저 하세요','err'); return; }
  var cfg=qGetCfg();
  var tol=parseFloat((document.getElementById('qpo-tolerance')||{value:2}).value)||2;
  var rows=[['PO No.','발주일','ITEM','품번','품명','REV','발주량','UM','PO단가($)','PO금액($)','DB매입가(₩)','우리견적단가($)','PO마진율(%)','단가차이(%)','납기요청','상태']];
  QP.items.forEach(function(p){
    var diff = p.ourQuoteUSD!=null ? ((p.unitPrice-p.ourQuoteUSD)/p.ourQuoteUSD*100).toFixed(1) : '';
    var stat = p.status==='nodb'?'미등록':p.status==='noprice'?'단가없음':
               (p.ourQuoteUSD!=null&&Math.abs(p.unitPrice-p.ourQuoteUSD)/p.ourQuoteUSD*100<=tol?'일치':
               (p.unitPrice>p.ourQuoteUSD?'상향':'하향'));
    rows.push([QP.poNo,QP.poDate,p.item,p.pn,p.desc,p.rev,p.ordQty,p.um,
      p.unitPrice.toFixed(2),p.extension.toFixed(2),
      p.buyKrw!=null?p.buyKrw:'',p.ourQuoteUSD!=null?p.ourQuoteUSD.toFixed(4):'',
      p.poMargin!=null?p.poMargin.toFixed(1):'',diff,p.delivDate,stat]);
  });
  var csv=rows.map(function(r){return r.map(function(c){return '"'+String(c!=null?c:'').replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
  a.download='PO대조_'+QP.poNo+'_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click(); qToast('✓ CSV 저장됨','ok');
}

/* ── 견적 이력 CSV/Excel 업로드 ── */
function qLoadHistCSV(inp){
  if(!inp||!inp.files[0]) return;
  var file=inp.files[0];
  var ext=file.name.split('.').pop().toLowerCase();
  qToast('파일 읽는 중...','info');

  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var rows;
      if(ext==='csv'){
        // CSV 파싱 (UTF-8 BOM 처리)
        var txt=e.target.result.replace(/^\uFEFF/,'');
        rows=qParseCSVText(txt);
      } else {
        // Excel (XLSX/XLS)
        var wb=XLSX.read(e.target.result,{type:'array',cellDates:true});
        var ws=wb.Sheets[wb.SheetNames[0]];
        rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      }
      var result=qConvertHistRows(rows);
      if(result.error){ qToast(result.error,'err',5000); return; }
      qMergeHistRecords(result.records);
      qToast('✓ '+result.records.length+'건 이력 로드 완료 (중복 '+result.dupes+'건 제외)','ok');
      document.getElementById('q-csv-guide').style.display='none';
      qRenderHist();
    }catch(err){
      qToast('파싱 실패: '+err.message,'err',5000);
    }
    inp.value='';
  };
  if(ext==='csv') reader.readAsText(file,'UTF-8');
  else            reader.readAsArrayBuffer(file);
}

/* CSV 텍스트 → 2D 배열 */
function qParseCSVText(txt){
  var rows=[];
  var lines=txt.split(/\r?\n/);
  lines.forEach(function(line){
    if(!line.trim()) return;
    var cols=[]; var cur=''; var inQ=false;
    for(var i=0;i<line.length;i++){
      var c=line[i];
      if(c==='"'){ inQ=!inQ; }
      else if(c===','&&!inQ){ cols.push(cur.trim()); cur=''; }
      else cur+=c;
    }
    cols.push(cur.trim());
    rows.push(cols);
  });
  return rows;
}

/* 2D 배열 → 이력 레코드 변환
   필수: 품번, 견적일자, 견적가
   선택: 견적번호, MOQ(=ASSY수량), 작업비, 매입합계, 견적가(₩), 프로젝트, 비고
*/
function qConvertHistRows(rows){
  if(!rows||rows.length<2) return{error:'데이터가 없습니다 (헤더+데이터 최소 2행 필요)'};

  // 헤더 정규화
  var hdr=rows[0].map(function(h){ return String(h).trim().replace(/\s+/g,''); });

  // 열 인덱스 매핑 (다양한 열명 허용)
  function fi(aliases){
    for(var i=0;i<aliases.length;i++){
      var idx=hdr.findIndex(function(h){ return h.toLowerCase()===aliases[i].toLowerCase(); });
      if(idx>=0) return idx;
    }
    return -1;
  }
  var iPN    = fi(['품번','pn','partnumber','partno','part_number','itemno','item']);
  var iDate  = fi(['견적일자','견적일','date','quotedate','quotation_date']);
  var iUSD   = fi(['견적가','견적가($)','견적가달러','price($)','unitprice','quoteprice','usd','견적단가','quote_price_usd']);
  var iNo    = fi(['견적번호','quoteno','quote_no','견적no','po','order']);
  var iMOQ   = fi(['moq','최소발주','assy수량','qty','수량','quantity']);
  var iLabor = fi(['작업비','laborcost','labor','labor(₩)','작업비(₩)']);
  var iBuy   = fi(['매입합계','매입가','buyprice','buy','매입가(₩)','매입합계(₩)']);
  var iKRW   = fi(['견적가(₩)','견적가krw','krw','won','원']);
  var iPrj   = fi(['프로젝트','project','rfq','프로젝트/rfq']);
  var iNote  = fi(['비고','note','remark','remarks','메모']);
  var iDesc  = fi(['품명','description','desc','item_desc']);

  if(iPN<0)   return{error:'필수 열 없음: 품번 (pn / partnumber 등)'};
  if(iDate<0) return{error:'필수 열 없음: 견적일자 (date / quotedate 등)'};
  if(iUSD<0)  return{error:'필수 열 없음: 견적가 (usd / quoteprice / 견적가($) 등)'};

  var cfg=qGetCfg();
  // 업로드 시점 환율 (입력값 우선, 없으면 설정탭 판매환율)
  var exRateEl=document.getElementById('qhist-exrate');
  var exRate=exRateEl?(parseFloat(exRateEl.value)||cfg.sellRate):cfg.sellRate;
  var records=[];
  var dupes=0;
  var existing=[];
  try{ existing=JSON.parse(localStorage.getItem('jst_quote_hist')||'[]'); }catch(e){}
  var existSet=new Set(existing.map(function(r){ return r.품번+'|'+r.견적일자+'|'+r.견적가달러; }));

  // 날짜 정규화 (다양한 형식 → YYYY-MM-DD)
  function normalDate(v){
    if(!v) return '';
    var s=String(v);
    // Excel date serial
    if(/^\d{5}$/.test(s)){
      var d=new Date((+s-25569)*86400000);
      return d.toISOString().slice(0,10);
    }
    // Date object (XLSX cellDates:true)
    if(v instanceof Date) return v.toISOString().slice(0,10);
    // YYYY-MM-DD, YYYY/MM/DD
    var m=s.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
    if(m) return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
    // YY-MM-DD or MM/DD/YY etc
    m=s.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
    if(m){
      var yr=m[3].length===2?'20'+m[3]:m[3];
      return yr+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');
    }
    return s;
  }

  function toNum(v){ if(v===''||v===null||v===undefined) return 0; var n=parseFloat(String(v).replace(/[$,₩]/g,'')); return isNaN(n)?0:n; }

  // 날짜별 시퀀스 카운터 (자동 견적번호용)
  var dateSeq={};

  for(var i=1;i<rows.length;i++){
    var r=rows[i];
    if(r.every(function(c){return !String(c).trim();})) continue; // 빈 행

    var pn    = String(r[iPN]||'').trim().replace(/\.0+$/,'');
    var qdate = normalDate(r[iDate]);
    var usd   = toNum(r[iUSD]);

    if(!pn||!qdate||!usd) continue; // 필수값 누락

    var moq   = iMOQ>=0?toNum(r[iMOQ])||1:1;
    var labor = iLabor>=0?toNum(r[iLabor]):0;
    var buy   = iBuy>=0?toNum(r[iBuy]):0;
    var krw   = iKRW>=0?toNum(r[iKRW]):Math.round(usd*exRate);
    var prj   = iPrj>=0?String(r[iPrj]||'').trim():'';
    var note  = iNote>=0?String(r[iNote]||'').trim():'';
    var desc  = iDesc>=0?String(r[iDesc]||'').trim():'';

    // 마진율 역산
    var marg = (krw>0&&buy>0) ? parseFloat(((krw-buy-labor)/krw*100).toFixed(1)) : 0;

    // 견적번호
    var qno;
    if(iNo>=0&&r[iNo]){
      qno=String(r[iNo]).trim().replace(/\.0+$/,'');
    } else {
      // 날짜 기준 자동번호
      var prefix=qdate.slice(2,4)+qdate.slice(5,7)+qdate.slice(8,10);
      dateSeq[prefix]=(dateSeq[prefix]||0)+1;
      qno=prefix+'-'+String(dateSeq[prefix]).padStart(3,'0');
    }

    // 중복 체크 (품번+날짜+금액)
    var key=pn+'|'+qdate+'|'+usd;
    if(existSet.has(key)){ dupes++; continue; }
    existSet.add(key);

    var now=new Date().toISOString();
    records.push({
      견적번호:qno, 견적일자:qdate, 품번:pn, 품명:desc,
      ASSY수량:moq, 매입합계:buy, 작업비:labor,
      견적가달러:usd, 견적가한화:krw,
      마진율:marg, 프로젝트:prj, 비고:note,
      제출일시:now, 상태:'제출'
    });
  }

  // 견적번호별 합계 행 생성
  var byNo={};
  records.forEach(function(r){
    var k=r.견적번호;
    if(!byNo[k]) byNo[k]={records:[],date:r.견적일자,prj:r.프로젝트};
    byNo[k].records.push(r);
  });
  var totals=[];
  Object.keys(byNo).forEach(function(qno){
    var recs=byNo[qno].records;
    var totUSD=recs.reduce(function(s,r){return s+(+r.견적가달러||0);},0);
    var totKRW=recs.reduce(function(s,r){return s+(+r.견적가한화||0);},0);
    var totBuy=recs.reduce(function(s,r){return s+(+r.매입합계||0);},0);
    var totLabor=recs.reduce(function(s,r){return s+(+r.작업비||0);},0);
    var totQty=recs.reduce(function(s,r){return s+(+r.ASSY수량||0);},0);
    var gm=totKRW>0?parseFloat(((totKRW-totBuy-totLabor)/totKRW*100).toFixed(1)):0;
    totals.push({
      견적번호:qno, 견적일자:byNo[qno].date, 품번:'(합계)', 품명:'CSV업로드 '+qno,
      ASSY수량:totQty, 매입합계:totBuy, 작업비:totLabor,
      견적가달러:parseFloat(totUSD.toFixed(2)), 견적가한화:totKRW,
      마진율:gm, 프로젝트:byNo[qno].prj, 비고:'CSV업로드',
      제출일시:new Date().toISOString(), 상태:'합계'
    });
  });

  return{ records:records.concat(totals), dupes:dupes };
}

/* 기존 이력에 병합 저장 */
