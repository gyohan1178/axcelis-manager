function qMergeHistRecords(newRecs){
  var existing=[];
  try{ existing=JSON.parse(localStorage.getItem('jst_quote_hist')||'[]'); }catch(e){}
  var merged=newRecs.concat(existing);
  try{ localStorage.setItem('jst_quote_hist',JSON.stringify(merged)); }catch(e){
    qToast('localStorage 용량 부족 — 서버에만 저장 시도','info');
  }
  // 서버 저장 (CURRENT_TOKEN 있을 때)
  if(CURRENT_TOKEN&&newRecs.length){
    var detailOnly=newRecs.filter(function(r){return r.상태==='제출';});
    if(detailOnly.length){
      apiPost({action:'appendRows',sheet:'quote_hist',rows:detailOnly}).catch(function(){});
    }
  }
}

/* ════════════════════════════════════════════════════════
   PD BOX 관리 모듈
   저장: localStorage 'jst_pdbox' + GS 'pdbox_data' 시트
════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════
   PD BOX 관리 모듈 v2
════════════════════════════════════════════════════════ */
var PB_KEY = 'jst_pdbox';
var _pbData = [];
var _pbViewerMode = false;
var _pbSortKey = 'reqDate';
var _pbSortDir = 1;  // 1=오름차순, -1=내림차순

function pbLoad(){
  try{ _pbData=JSON.parse(localStorage.getItem(PB_KEY)||'[]'); }catch(e){ _pbData=[]; }
}
function pbSaveAll(onDone){
  try{ localStorage.setItem(PB_KEY,JSON.stringify(_pbData)); }catch(e){}
  if(CURRENT_TOKEN){
    apiPost({action:'setSheet',sheet:'pdbox_data',data:_pbData})
      .then(function(res){
        if(res&&res.ok){ if(onDone) onDone(true,''); }
        else{ if(onDone) onDone(false, res&&res.error||'서버 오류'); }
      })
      .catch(function(err){ if(onDone) onDone(false, String(err)); });
  } else {
    if(onDone) onDone(false,'토큰 없음');
  }
}
// 로컬 → 서버 강제 업로드
function pbForcePush(){
  pbLoad();
  if(!CURRENT_TOKEN){ qToast('로그인 후 사용 가능합니다','err'); return; }
  var btn=document.getElementById('pb-force-push');
  if(btn){ btn.disabled=true; btn.textContent='업로드 중...'; }
  console.log('[PB] 업로드 시작, 건수:', _pbData.length, '데이터크기:', JSON.stringify(_pbData).length, 'bytes');
  pbSaveAll(function(ok, errMsg){
    if(btn){ btn.disabled=false; btn.textContent='⬆ 서버 업로드'; }
    if(ok){
      qToast('✓ 서버 업로드 완료 ('+_pbData.length+'건)','ok',3000);
    } else {
      console.error('[PB] 업로드 실패:', errMsg);
      qToast('✗ 업로드 실패: '+(errMsg||'서버 연결 확인'),'err',5000);
    }
  });
}
function pbSyncFromServer(callback){
  if(!CURRENT_TOKEN){ if(callback) callback(); return; }
  apiGet({action:'getSheet',sheet:'pdbox_data'}).then(function(res){
    if(res&&res.ok&&Array.isArray(res.data)&&res.data.length>0){
      // Supabase snake_case → 앱 camelCase 변환
      var sbMap={
        req_date:'reqDate', machine_date:'machineDate', arrival_date:'arrivalDate',
        harness_issue:'harnessIssue', harness_done:'harnessDone',
        part_issue:'partIssue', elec_done:'elecDone',
        machine_recv:'machineRecv', harness_recv:'harnessRecv', elec_recv:'elecRecv', qc_done:'qcDone',
        po_received:'poReceived', missing_parts:'missingParts',
        created_at:'createdAt', updated_at:'updatedAt'
      };
      var serverData=res.data.map(function(r){
        var out={};
        Object.keys(r).forEach(function(k){ out[sbMap[k]||k]=r[k]; });
        ['missingParts','changes'].forEach(function(f){
          if(out[f]&&typeof out[f]==='string'){try{out[f]=JSON.parse(out[f]);}catch(e){out[f]=[];}}
        });
        return out;
      });
      var serverMap={};
      serverData.forEach(function(r){ if(r.id) serverMap[r.id]=r; });
      var local=[];
      try{ local=JSON.parse(localStorage.getItem(PB_KEY)||'[]'); }catch(e){}
      var localMap={};
      local.forEach(function(r){ if(r.id) localMap[r.id]=r; });
      var allIds=new Set(Object.keys(serverMap).concat(Object.keys(localMap)));
      var merged=[];
      allIds.forEach(function(id){
        var s=serverMap[id], l=localMap[id];
        if(s&&l){ merged.push((s.updatedAt||'')>=(l.updatedAt||'')?s:l); }
        else merged.push(s||l);
      });
      merged.sort(function(a,b){return (a.reqDate||'').localeCompare(b.reqDate||'');});
      var dateFields=['reqDate','machineDate','arrivalDate','harnessIssue','harnessDone','partIssue','elecDone'];
      merged.forEach(function(r){
        dateFields.forEach(function(f){ if(r[f]) r[f]=pbNormDate(r[f]); });
      });
      _pbData=merged;
      try{ localStorage.setItem(PB_KEY,JSON.stringify(_pbData)); }catch(e){}
    } else {
      pbLoad();
    }
    if(callback) callback();
  }).catch(function(e){
    console.warn('pbSync error:', e);
    pbLoad();
    if(callback) callback();
  });
}
function pbUID(){ return 'pb'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

// 납품요청일 기준 전장 완료요청일 자동계산 (영업일 -4일)
function pbAutoElecDate(){
  var reqVal=document.getElementById('pb-req-date').value;
  var el=document.getElementById('pb-elec-done');
  if(!reqVal||!el){return;}
  var d=new Date(reqVal); var sub=0;
  while(sub<4){
    d.setDate(d.getDate()-1);
    var dow=d.getDay();
    if(dow!==0&&dow!==6) sub++;
  }
  el.value=d.toISOString().slice(0,10);
}

function pbStatusClass(s){
  return 'pb-s-'+({'PO접수':'po','자재발주':'mat','제작중':'mfg','품질검수':'qual','납품대기':'wait','완료':'done'}[s]||'before');
}
function pbStatusLabel(s){
  return {'PO접수':'PO 접수','자재발주':'자재 발주','제작중':'제작 중','품질검수':'품질 검수','납품대기':'납품 대기','완료':'완료'}[s]||s;
}
function pbNormDate(v){
  if(!v) return '';
  var s=String(v);
  // ISO 포맷 처리: 2026-04-22T15:00:00.000Z → 2026-04-22
  if(s.length>10 && s[10]==='T') s=s.slice(0,10);
  // Google Sheets Serial 숫자인 경우 변환
  if(/^\d{5}$/.test(s)){
    var d=new Date(1899,11,30); d.setDate(d.getDate()+parseInt(s));
    s=d.toISOString().slice(0,10);
  }
  return s;
}
function pbDtCell(v, highlight){
  var s=pbNormDate(v);
  if(!s) return '<span class="pb-dt empty">—</span>';
  var today=new Date(); today.setHours(0,0,0,0);
  var d=new Date(s); var diff=Math.round((d-today)/86400000);
  var cls='pb-dt';
  if(highlight!==false){
    // highlight=true 또는 기본: 납품일/전장완료 강조
    if(diff<0) cls+=' overdue';
    else if(diff<=3) cls+=' soon';
  }
  // 납품일 강조 (highlight===true): 추가 스타일
  var extraStyle=(highlight===true&&diff<=7&&diff>=0)?'font-weight:700;':'';
  var disp=s.length>=7?s.slice(5):s;
  return '<span class="'+cls+'" style="'+extraStyle+'" title="'+s+'">'+disp+'</span>';
}

function pbRenderStats(items){
  var nodb=items.filter(function(r){return !r.poReceived;}).length;
  var mfg=items.filter(function(r){return r.status==='제작중';}).length;
  var qual=items.filter(function(r){return r.status==='품질검수';}).length;
  var hasMissing=items.filter(function(r){return (r.missingParts||[]).length>0;}).length;
  var el=document.getElementById('pb-stats'); if(!el) return;
  el.innerHTML=
    '<div class="pb-stat"><div class="pb-stat-l">전체</div><div class="pb-stat-v">'+items.length+'</div></div>'
   +'<div class="pb-stat" style="border-color:var(--accent)"><div class="pb-stat-l" style="color:var(--accent)">제조</div><div class="pb-stat-v" style="color:var(--accent)">'+mfg+'</div></div>'
   +'<div class="pb-stat" style="border-color:var(--purple,#a78bfa)"><div class="pb-stat-l" style="color:var(--purple,#a78bfa)">품질</div><div class="pb-stat-v" style="color:var(--purple,#a78bfa)">'+qual+'</div></div>'
   +'<div class="pb-stat" style="border-color:var(--amb)"><div class="pb-stat-l" style="color:var(--amb)">PO미접수</div><div class="pb-stat-v" style="color:var(--amb)">'+nodb+'</div></div>'
   +'<div class="pb-stat" style="border-color:var(--red)"><div class="pb-stat-l" style="color:var(--red)">미불출 있음</div><div class="pb-stat-v" style="color:var(--red)">'+hasMissing+'</div></div>';
}

function pbRender(){
  // pbLoad()는 탭 전환 시에만 호출, 검색/필터 시엔 메모리 데이터 그대로 사용
  if(!_pbData || !_pbData.length) pbLoad();
  var fStatus=(document.getElementById('pb-flt-status')||{value:''}).value;
  var fPO=(document.getElementById('pb-flt-po')||{value:''}).value;
  var fQ=((document.getElementById('pb-flt-q')||{value:''}).value||'').toLowerCase();
  var fHideDone=(document.getElementById('pb-flt-hidedone')||{}).checked;
  var fFA=(_pbView==='fa'); // FA 뷰: #FA 호기만
  var items=_pbData.filter(function(r){
    if(fHideDone&&r.status==='완료') return false;
    if(fFA&&!(r.hogi||'').includes('FA')) return false;
    if(fStatus&&r.status!==fStatus) return false;
    if(fPO==='Y'&&!r.poReceived) return false;
    if(fPO==='N'&&r.poReceived) return false;
    if(fQ&&!(
      (String(r.name||r['품명']||'')).toLowerCase().includes(fQ)||
      (String(r.pn||r['품번']||'')).toLowerCase().includes(fQ)||
      (String(r.hogi||r['호기']||'')).toLowerCase().includes(fQ)||
      (String(r.note||r['비고']||'')).toLowerCase().includes(fQ)||
      (String(r.status||'')).toLowerCase().includes(fQ)||
      (String(r.reqDate||'')).includes(fQ)
    )) return false;
    return true;
  });
  // 정렬
  var sk=_pbSortKey, sd=_pbSortDir;
  items.sort(function(a,b){
    var av=a[sk]||'', bv=b[sk]||'';
    if(!av&&!bv) return 0;
    if(!av) return 1; if(!bv) return -1;
    return av.localeCompare(bv)*sd;
  });
  // 정렬 아이콘 업데이트
  document.querySelectorAll('#pb-table th[data-sort]').forEach(function(th){
    var arr=th.querySelector('.pb-sort-arr');
    if(arr) arr.textContent = th.dataset.sort===sk ? (sd===1?'▲':'▼') : '⇅';
  });
  pbRenderStats(items);
  var tb=document.getElementById('pb-tbody'); if(!tb) return;

  // viewer 모드: 등록/편집/삭제만 숨김, 서버수신 유지
  var isViewer=_pbViewerMode||(!CURRENT_USER||CURRENT_USER.role==='viewer'||CURRENT_USER.role==='guest');
  document.querySelectorAll('#sect-pdbox .pb-toolbar button, #sect-pdbox .pb-toolbar label').forEach(function(btn){
    var t=(btn.textContent||btn.innerText||'').trim();
    var hide=t.includes('PD 등록')||t.includes('CSV 가져오기')||t.includes('편집')||t.includes('삭제')||t.includes('서버 업로드')||t.includes('샘플');
    if(hide) btn.style.display=isViewer?'none':'';
  });

  if(!items.length){ tb.innerHTML='<tr><td colspan="16" style="text-align:center;padding:28px;color:var(--text3)">등록된 PD가 없습니다</td></tr>'; return; }
  var _byMonth = (_pbSortKey==='reqDate');  // 납품일 정렬일 때만 월별 구분 행
  var _prevMonth = null;
  tb.innerHTML=items.map(function(r){
    var _divider='';
    if(_byMonth){
      var _rd=pbNormDate(r.reqDate);
      var _mk=_rd?_rd.slice(0,7):'미정';
      if(_mk!==_prevMonth){
        _prevMonth=_mk;
        var _mTitle = _mk==='미정' ? '납품일 미정' : (_mk.slice(0,4)+'년 '+(+_mk.slice(5,7))+'월');
        var _mItems=items.filter(function(x){var d=pbNormDate(x.reqDate);return (d?d.slice(0,7):'미정')===_mk;});
        var _mDelay=_mItems.filter(function(x){return _pbCardHasDelay(x);}).length;
        _divider='<tr class="pb-month-row"><td colspan="17" style="background:var(--bg3);padding:8px 14px;font-weight:700;font-size:12.5px;color:var(--text);border-top:2px solid var(--border2)">'
          +'📦 '+_mTitle+' <span style="font-weight:400;color:var(--text3);font-size:11px">· '+_mItems.length+'건</span>'
          +(_mDelay?' <span style="color:var(--red);font-size:11px;font-weight:700;margin-left:8px">⚠ 지연 '+_mDelay+'건</span>':'')
          +'</td></tr>';
      }
    }
    return _divider + (function(){
    var hogiCls=r.hogi==='#FA'?'pb-hogi fa':'pb-hogi';
    var rowCls=(r.poReceived?'':'pb-pre-row')+(_pbCardHasDelay(r)?' pb-delay-row':'');
    var mp=r.missingParts||[];
    var mpCnt=mp.length;
    var mpBadge=mpCnt?'<span style="background:rgba(255,85,85,.18);color:var(--red);border-radius:4px;padding:1px 7px;font-size:11px;font-weight:700;font-family:var(--mono);cursor:pointer" onclick="pbToggleMissing(event,\'pb-mp-'+r.id+'\')">'+mpCnt+' ▼</span>':'<span style="color:var(--text3);font-size:11px">—</span>';
    var editBtn2=isViewer?'':('<button onclick="pbOpenEdit(\''+r.id+'\')" style="background:none;border:1px solid var(--border2);border-radius:5px;padding:3px 9px;color:var(--text2);font-size:11px;cursor:pointer;margin-right:4px">편집</button>');
    var delBtn2=isViewer?'':('<button onclick="pbDelete(\''+r.id+'\')" style="background:none;border:1px solid rgba(255,85,85,.4);border-radius:5px;padding:3px 9px;color:var(--red);font-size:11px;cursor:pointer">삭제</button>');
    // 미불출 상세 행
    var mpDetail=mp.length?'<tr id="pb-mp-'+r.id+'" style="display:none;background:rgba(255,85,85,.05)"><td colspan="17" style="padding:0"><table style="width:100%;border-collapse:collapse;font-size:11.5px"><thead><tr style="background:rgba(255,85,85,.1)"><th style="padding:5px 12px;text-align:left;font-size:10px;font-weight:600;color:var(--red);width:120px">품번</th><th style="padding:5px 12px;text-align:left;font-size:10px;font-weight:600;color:var(--red)">품명</th><th style="padding:5px 12px;font-size:10px;font-weight:600;color:var(--red)">제조사</th><th style="padding:5px 12px;font-size:10px;font-weight:600;color:var(--red)">제조사품번</th><th style="padding:5px 12px;text-align:right;font-size:10px;font-weight:600;color:var(--red);width:70px">미입고수량</th><th style="padding:5px 12px;font-size:10px;font-weight:600;color:var(--red);width:100px">입고예정일</th></tr></thead><tbody>'
      +mp.map(function(p){
        var dbi=typeof DB!=='undefined'?DB.find(function(d){return String(d.pn).trim()===String(p.pn).trim();}):null;
        return '<tr style="border-top:1px solid rgba(255,85,85,.12)"><td style="padding:5px 12px;font-family:var(--mono);font-size:11px;color:var(--accent)">'+p.pn+'</td><td style="padding:5px 12px;font-size:11.5px">'+((dbi&&dbi.d)||'')+'</td><td style="padding:5px 12px;font-size:11px;color:var(--text2)">'+((dbi&&dbi.mg)||'')+'</td><td style="padding:5px 12px;font-family:var(--mono);font-size:11px;color:var(--text2)">'+((dbi&&dbi.mp)||'')+'</td><td style="padding:5px 12px;text-align:right;font-family:var(--mono);font-size:12px;font-weight:700;color:var(--red)">'+p.qty+'</td><td style="padding:5px 12px;font-family:var(--mono);font-size:11px;color:var(--amb)">'+p.expectedDate+'</td></tr>';
      }).join('')
      +'</tbody></table></td></tr>':'';
    var chkCell=isViewer?'<td></td>':'<td style="text-align:center" onclick="event.stopPropagation()"><input type="checkbox" class="pb-row-chk" data-id="'+r.id+'" style="accent-color:var(--teal);width:14px;height:14px;cursor:pointer" onchange="pbSelChange()"></td>';
    return '<tr class="'+rowCls+'" id="pbr-'+r.id+'" onclick="'+(isViewer?'':('pbSelectRow(\''+r.id+'\')'))+'" style="cursor:'+(isViewer?'default':'pointer')+'">'
      +chkCell
      +'<td style="font-family:var(--mono);font-size:11.5px;color:var(--accent);white-space:nowrap">'+r.pn+'</td>'
      +'<td style="font-weight:600;min-width:80px;white-space:normal;word-break:break-word;line-height:1.4">'+r.name+'</td>'
      +'<td style="white-space:nowrap"><span class="'+hogiCls+'">'+r.hogi+'</span></td>'
      +'<td style="font-family:var(--mono);font-size:11px;color:var(--text2)">'+r.rev+'</td>'
      +'<td style="white-space:nowrap"><span class="pb-status '+pbStatusClass(r.status)+'">'+pbStatusLabel(r.status)+'</span></td>'
      +'<td style="white-space:nowrap;min-width:36px;padding:3px 2px">'+pbDtCell(r.reqDate,true)+'</td>'
      // 가공물
      +'<td style="background:rgba(255,181,71,.04);text-align:center;width:20px;padding:0" onclick="event.stopPropagation()"><input type="checkbox"'+(r.machineDate?' checked':'')+' '+(isViewer?'disabled':('onchange="pbChkField(this,\''+r.id+'\',\'machineDate\')"'))+' style="accent-color:var(--amb);width:14px;height:14px;cursor:'+(isViewer?'not-allowed':'pointer')+'"></td>'
      +'<td style="background:rgba(255,181,71,.04);white-space:nowrap;min-width:36px;padding:3px 2px;cursor:pointer" onclick="event.stopPropagation();pbToggleComplete(\''+r.id+'\',\'machineRecv\')" title="'+(r.machineRecv?'✔ 입고완료 · 클릭=취소':'입고예정 · 클릭하면 완료')+'">'  +(r.machineRecv?'<span style="color:#f59e0b;font-weight:700;font-size:11px">✔ '+(pbNormDate(r.arrivalDate)?pbNormDate(r.arrivalDate).slice(5,10):'완료')+'</span>':'<span style="font-size:10.5px;color:var(--text2)">'+(pbNormDate(r.arrivalDate)?pbNormDate(r.arrivalDate).slice(5,10):'—')+'</span>')+'</td>'
      // 하네스
      +'<td style="background:rgba(45,212,191,.04);text-align:center;width:20px;padding:0" onclick="event.stopPropagation()"><input type="checkbox"'+(r.harnessIssue?' checked':'')+' '+(isViewer?'disabled':('onchange="pbChkField(this,\''+r.id+'\',\'harnessIssue\')"'))+' style="accent-color:var(--teal);width:14px;height:14px;cursor:'+(isViewer?'not-allowed':'pointer')+'"></td>'
      +'<td style="background:rgba(45,212,191,.04);white-space:nowrap;min-width:36px;padding:3px 2px;cursor:pointer" onclick="event.stopPropagation();pbToggleComplete(\''+r.id+'\',\'harnessRecv\')" title="'+(r.harnessRecv?'✔ 완료확인 · 클릭=취소':'완료예정 · 클릭하면 완료')+'">'  +(r.harnessRecv?'<span style="color:#10b981;font-weight:700;font-size:11px">✔ '+(pbNormDate(r.harnessDone)?pbNormDate(r.harnessDone).slice(5,10):'완료')+'</span>':'<span style="font-size:10.5px;color:var(--text2)">'+(pbNormDate(r.harnessDone)?pbNormDate(r.harnessDone).slice(5,10):'—')+'</span>')+'</td>'
      // 전장
      +'<td style="background:rgba(167,139,250,.04);text-align:center;width:20px;padding:0" onclick="event.stopPropagation()"><input type="checkbox"'+(r.partIssue?' checked':'')+' '+(isViewer?'disabled':('onchange="pbChkField(this,\''+r.id+'\',\'partIssue\')"'))+' style="accent-color:var(--purple,#a78bfa);width:14px;height:14px;cursor:'+(isViewer?'not-allowed':'pointer')+'"></td>'
      +'<td style="background:rgba(167,139,250,.04);white-space:nowrap;min-width:36px;padding:3px 2px;cursor:pointer" onclick="event.stopPropagation();pbToggleComplete(\''+r.id+'\',\'elecRecv\')" title="'+(r.elecRecv?'✔ 전장완료 · 클릭=취소':'완료요청 · 클릭하면 완료')+'">'  +(r.elecRecv?'<span style="color:#a78bfa;font-weight:700;font-size:11px">✔ '+(pbNormDate(pbCalcElec(r))?pbNormDate(pbCalcElec(r)).slice(5,10):'완료')+'</span>':'<span style="font-size:10.5px;color:var(--text2)">'+(pbNormDate(pbCalcElec(r))?pbNormDate(pbCalcElec(r)).slice(5,10):'—')+'</span>')+'</td>'
      +'<td style="text-align:center;padding:4px 2px" onclick="event.stopPropagation()">'+mpBadge+'</td>'
      +(function(){
        var noteHtml='<span style="font-size:11.5px;color:var(--text2);white-space:pre-line">'+r.note+'</span>';
        var changes=r.changes||[];
        if(typeof changes==='string'){try{changes=JSON.parse(changes);}catch(e){changes=[];}}
        if(!Array.isArray(changes)) changes=[];
        // 신규등록, 납품일 변경만 표시
        var showChanges=changes.filter(function(c){
          return c.type==='신규' || (c.type==='날짜' && (c.msg||'').includes('납품요청일'));
        });
        if(!showChanges.length) return '<td style="white-space:normal;word-break:break-word;line-height:1.4">'+noteHtml+'</td>';
        var recent=showChanges.slice(-2).reverse();
        var badges=recent.map(function(c){
          var color=c.type==='신규'?'#00e676':c.type==='날짜'?'var(--amb)':c.type==='상태'?'var(--accent)':'var(--text2)';
          var bg=c.type==='신규'?'rgba(0,230,118,.12)':c.type==='날짜'?'rgba(255,181,71,.12)':c.type==='상태'?'rgba(79,124,255,.12)':'rgba(255,255,255,.05)';
          var dt=c.at?(c.at.slice(5,10).replace('-','/')):'';
          var typeLabel=c.type==='신규'?'🆕':c.type==='날짜'?'📅':c.type==='상태'?'🔄':'✏';
          return '<div style="font-size:10px;line-height:1.5;padding:1px 5px;border-radius:4px;background:'+bg+';color:'+color+';white-space:nowrap;margin-bottom:2px">'+typeLabel+' '+c.msg+(dt?' <span style="opacity:.55;font-size:9px">/ '+dt+'</span>':'')+'</div>';
        }).join('');
        return '<td style="white-space:normal;word-break:break-word;line-height:1.4;min-width:140px">'+(r.note?noteHtml+'<br>':'')+badges+'</td>';
      })()
      +'</tr>'
      +mpDetail;
    })();
  }).join('');
  // 컬럼 리사이즈 초기화
  // 더블클릭 편집
  var tb2 = document.getElementById('pb-tbody');
  if(tb2){
    tb2.ondblclick = function(e){
      var tr = e.target.closest('tr[id^="pbr-"]');
      if(tr){ pbOpenEdit(tr.id.replace('pbr-','')); }
    };
  }

  setTimeout(pbInitColResize, 50);
}

function pbToggleMissing(e, id){
  e.stopPropagation();
  var row=document.getElementById(id);
  if(!row) return;
  var span=e.target;
  var open=row.style.display==='none';
  row.style.display=open?'':'none';
  span.textContent=span.textContent.replace(open?'▼':'▲',open?'▲':'▼');
}

/* ── 일괄 선택 / 수정 / 삭제 ── */
var _pbSelected = new Set();

function pbSelChange(){
  _pbSelected.clear();
  document.querySelectorAll('.pb-row-chk:checked').forEach(function(c){
    _pbSelected.add(c.dataset.id);
  });
  var cnt=_pbSelected.size;
  var bar=document.getElementById('pb-bulk-bar');
  var cntEl=document.getElementById('pb-sel-cnt');
  if(bar) bar.style.display=cnt>0?'flex':'none';
  if(cntEl) cntEl.textContent=cnt+'건 선택';
  // 전체선택 체크박스 indeterminate 처리
  var all=document.getElementById('pb-chk-all');
  var total=document.querySelectorAll('.pb-row-chk').length;
  if(all){ all.indeterminate=cnt>0&&cnt<total; all.checked=cnt===total&&total>0; }
}
function pbSelAll(checked){
  document.querySelectorAll('.pb-row-chk').forEach(function(c){ c.checked=checked; });
  pbSelChange();
}
function pbClearSel(){
  document.querySelectorAll('.pb-row-chk').forEach(function(c){ c.checked=false; });
  var all=document.getElementById('pb-chk-all'); if(all){all.checked=false;all.indeterminate=false;}
  pbSelChange();
}

function pbBulkDelete(){
  if(!_pbSelected.size){ qToast('선택된 항목이 없습니다','err'); return; }
  if(!confirm(_pbSelected.size+'건을 삭제하시겠습니까?\n삭제 후 복구가 불가합니다.')) return;
  pbLoad();
  _pbData=_pbData.filter(function(r){ return !_pbSelected.has(r.id); });
  pbSaveAll();
  _pbSelected.clear();
  pbRender();
  qToast('✓ '+_pbSelected.size+'건 삭제 완료','ok');
  // 재렌더 후 cnt 재표시
  var bar=document.getElementById('pb-bulk-bar'); if(bar) bar.style.display='none';
}

function pbBulkEdit(){
  if(!_pbSelected.size){ qToast('선택된 항목이 없습니다','err'); return; }
  // 선택된 첫 번째 레코드 기준으로 공통값 표시
  pbLoad();
  var sel=_pbData.filter(function(r){ return _pbSelected.has(r.id); });
  // 공통값 추출 (다르면 빈칸)
  var g=function(k){ var vals=[...new Set(sel.map(function(r){return r[k]||'';}))].filter(Boolean); return vals.length===1?vals[0]:''; };
  document.getElementById('pb-bulk-status').value=g('status');
  document.getElementById('pb-bulk-po').checked=sel.every(function(r){return !r.poReceived;});
  document.getElementById('pb-bulk-note').value=g('note');
  document.getElementById('pb-bulk-cnt').textContent=_pbSelected.size+'건 일괄 수정';
  document.getElementById('m-pb-bulk').classList.add('on');
}

function pbBulkSaveEdit(){
  pbLoad();
  var status=document.getElementById('pb-bulk-status').value;
  var noPo=document.getElementById('pb-bulk-po').checked;
  var note=document.getElementById('pb-bulk-note').value;
  var chgStatus=document.getElementById('pb-bulk-chg-status').checked;
  var chgPo=document.getElementById('pb-bulk-chg-po').checked;
  var chgNote=document.getElementById('pb-bulk-chg-note').checked;
  var cnt=0;
  _pbData.forEach(function(r){
    if(!_pbSelected.has(r.id)) return;
    if(chgStatus&&status) r.status=status;
    if(chgPo) r.poReceived=!noPo;
    if(chgNote) r.note=note;
    r.updatedAt=new Date().toISOString();
    cnt++;
  });
  pbSaveAll();
  closeM('m-pb-bulk');
  pbClearSel();
  pbRender();
  qToast('✓ '+cnt+'건 수정 완료','ok');
}

// 전장완료요청일 계산 (reqDate 기준 영업일 -4)
function pbCalcElec(r){
  if(r.elecDone) return r.elecDone;
  if(!r.reqDate) return '';
  var d=new Date(r.reqDate); var sub=0;
  while(sub<4){ d.setDate(d.getDate()-1); var dow=d.getDay(); if(dow!==0&&dow!==6) sub++; }
  return d.toISOString().slice(0,10);
}

// 체크박스 클릭 → 날짜 토글 저장
function pbChkField(el, id, field){
  pbLoad();
  var rec=_pbData.find(function(x){return x.id===id;}); if(!rec) return;
  var now=new Date().toISOString();
  var who=(CURRENT_USER&&CURRENT_USER.name)||'';
  var fieldLabel={
    machineDate:'가공물 발주', arrivalDate:'가공물 입고예정',
    harnessIssue:'하네스 불출', harnessDone:'하네스 완료요청',
    partIssue:'전장 불출', elecDone:'전장 완료요청',
    machineRecv:'가공물 입고확인', harnessRecv:'하네스 입고확인', elecRecv:'전장 입고확인'
  }[field]||field;

  if(el.checked){
    rec[field]=rec[field]||now.slice(0,10);
    pbAddHistory(rec, {type:'체크', msg:fieldLabel+' ✔ ('+who+')', at:now});
  } else {
    rec[field]='';
    pbAddHistory(rec, {type:'체크', msg:fieldLabel+' 해제 ('+who+')', at:now});
  }
  rec.updatedAt=now;
  pbSaveAll(function(ok){
    qToast(ok?'✓ 저장됨':'⚠ 로컬 저장됨', ok?'ok':'info', ok?1500:3000);
  });
}

// 히스토리 추가 헬퍼
function pbAddHistory(rec, entry){
  if(!rec.history) rec.history=[];
  if(typeof rec.history==='string'){try{rec.history=JSON.parse(rec.history);}catch(e){rec.history=[];}}
  rec.history.push(entry);
  // 최대 50건 유지
  if(rec.history.length>50) rec.history=rec.history.slice(-50);
}

// 히스토리 모달 표시
function pbShowHistory(id){
  pbLoad();
  var rec=_pbData.find(function(x){return x.id===id;});
  if(!rec) return;
  var hist=rec.history||[];
  if(typeof hist==='string'){try{hist=JSON.parse(hist);}catch(e){hist=[];}}
  var existing=document.getElementById('m-pb-hist');
  if(existing) existing.remove();
  var div=document.createElement('div');
  div.id='m-pb-hist';
  div.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:center;justify-content:center';
  var rows=hist.length
    ? hist.slice().reverse().map(function(h){
        var typeClr=h.type==='신규'?'#00e676':h.type==='날짜'?'var(--amb)':h.type==='상태'?'var(--accent)':h.type==='체크'?'var(--teal)':'var(--text2)';
        var dt=(h.at||'').slice(0,16).replace('T',' ');
        return '<tr><td style="padding:5px 8px;font-size:11px;color:'+typeClr+';white-space:nowrap;font-weight:600">'+h.type+'</td>'
          +'<td style="padding:5px 8px;font-size:12px;color:var(--text)">'+h.msg+'</td>'
          +'<td style="padding:5px 8px;font-size:10.5px;color:var(--text3);white-space:nowrap">'+dt+'</td></tr>';
      }).join('')
    : '<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text3)">변경 이력이 없습니다</td></tr>';
  div.innerHTML='<div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:20px;width:520px;max-width:95vw;max-height:80vh;overflow-y:auto">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'
    +'<b style="color:var(--text)">📋 변경 이력 — '+(rec.name||rec.pn||'')+(rec.hogi?' '+rec.hogi:'')+'</b>'
    +'<button onclick="document.getElementById(\'m-pb-hist\').remove()" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer">✕</button>'
    +'</div>'
    +'<table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:1px solid var(--border)">'
    +'<th style="padding:5px 8px;font-size:11px;color:var(--text3);text-align:left;width:60px">구분</th>'
    +'<th style="padding:5px 8px;font-size:11px;color:var(--text3);text-align:left">내용</th>'
    +'<th style="padding:5px 8px;font-size:11px;color:var(--text3);text-align:left;width:110px">일시</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>'
    +'</div>';
  document.body.appendChild(div);
  div.addEventListener('click',function(e){ if(e.target===div) div.remove(); });
}

// ── PD BOX 컬럼 리사이저 ──
var PB_COL_W_KEY = 'jst_pb_col_w';
var _pbResizeHandles = [];

function pbInitColResize(){
  var tbl = document.getElementById('pb-table');
  if(!tbl) return;

  // 기존 핸들 제거
  _pbResizeHandles.forEach(function(h){ if(h.parentNode) h.parentNode.removeChild(h); });
  _pbResizeHandles = [];

  // 저장된 폭 복원
  var saved = {};
  try{ saved = JSON.parse(localStorage.getItem(PB_COL_W_KEY)||'{}'); }catch(e){}

  var ths = Array.prototype.slice.call(tbl.querySelectorAll('thead tr:first-child th'));
  ths.forEach(function(th, idx){
    if(saved[idx]) th.style.width = saved[idx]+'px';
  });

  // 핸들을 body에 붙이고 th 위치 기준으로 배치
  function positionHandles(){
    ths.forEach(function(th, idx){
      var h = _pbResizeHandles[idx];
      if(!h) return;
      var rect = th.getBoundingClientRect();
      h.style.left = (rect.right - 3) + 'px';
      h.style.top  = rect.top + 'px';
      h.style.height = rect.height + 'px';
    });
  }

  ths.forEach(function(th, idx){
    var handle = document.createElement('div');
    handle.className = 'pb-col-resizer';
    handle.title = '드래그로 폭 조정';
    document.body.appendChild(handle);
    _pbResizeHandles.push(handle);

    var startX, startW;
    handle.addEventListener('mousedown', function(e){
      e.preventDefault();
      startX = e.clientX;
      startW = th.offsetWidth;
      handle.classList.add('active');

      function onMove(e){
        var newW = Math.max(20, startW + (e.clientX - startX));
        th.style.width = newW + 'px';
        positionHandles();
      }
      function onUp(){
        handle.classList.remove('active');
        try{
          var w = JSON.parse(localStorage.getItem(PB_COL_W_KEY)||'{}');
          w[idx] = th.offsetWidth;
          localStorage.setItem(PB_COL_W_KEY, JSON.stringify(w));
        }catch(e){}
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });

  // 초기 배치 + 스크롤/리사이즈 시 재배치
  positionHandles();
  var wrap = tbl.closest('div');
  if(wrap) wrap.addEventListener('scroll', positionHandles);
  window.addEventListener('resize', positionHandles);
}

// 컬럼 폭 초기화 버튼
function pbResetColW(){
  localStorage.removeItem(PB_COL_W_KEY);
  var ths = document.querySelectorAll('#pb-table thead tr:first-child th');
  ths.forEach(function(th){ th.style.width=''; });
  qToast('컬럼 폭 초기화됨','ok',1500);
}

function pbSortBy(key){
  if(_pbSortKey===key){ _pbSortDir*=-1; }
  else{ _pbSortKey=key; _pbSortDir=1; }
  pbRender();
}

// 행 선택 → 툴바 편집/삭제 활성화
var _pbSelRow = null;
function pbSelectRow(id){
  // 이전 선택 해제
  if(_pbSelRow){ var prev=document.getElementById('pbr-'+_pbSelRow); if(prev) prev.style.outline=''; }
  if(_pbSelRow===id){ _pbSelRow=null; pbTbSelUpdate(); return; }  // 토글
  _pbSelRow=id;
  var row=document.getElementById('pbr-'+id);
  if(row) row.style.outline='2px solid var(--teal)';
  pbTbSelUpdate();
}
// 셀 클릭으로 완료/취소 토글 (machineRecv, harnessRecv)
function pbToggleComplete(id, field){
  pbLoad();
  var rec=_pbData.find(function(x){return x.id===id;}); if(!rec) return;
  var now=new Date().toISOString();
  var who=(CURRENT_USER&&CURRENT_USER.name)||'';
  var label={machineRecv:'가공물 입고확인', harnessRecv:'하네스 완료확인', elecRecv:'전장 완료확인'}[field]||field;
  rec[field] = !rec[field];
  if(rec[field]) pbAddHistory(rec, {type:'체크', msg:label+' ✔ 완료 ('+who+')', at:now});
  else           pbAddHistory(rec, {type:'체크', msg:label+' 취소 ('+who+')', at:now});
  rec.updatedAt=now;
  pbSaveAll(function(ok){
    qToast(ok?'✓ 저장됨':'⚠ 로컬 저장됨', ok?'ok':'info', 1500);
  });
  pbRender();
}

function pbTbSelUpdate(){
  var role = CURRENT_USER ? CURRENT_USER.role : '';
  var isViewerMode = _pbViewerMode || role==='viewer' || role==='guest';
  var container = document.getElementById('pb-sel-actions');
  if(!container) return;

  // 매번 새로 생성 (stale 버튼 문제 완전 제거)
  container.innerHTML = '';

  if(!_pbSelRow) return;

  if(!isViewerMode){
    // 편집 버튼
    var btnEdit = document.createElement('button');
    btnEdit.textContent = '✏ 편집';
    btnEdit.style.cssText = 'padding:6px 11px;background:var(--bg3);border:1px solid var(--border2);border-radius:7px;font-size:12px;color:var(--text2);cursor:pointer;white-space:nowrap';
    btnEdit.onclick = function(){ pbOpenEdit(_pbSelRow); };
    container.appendChild(btnEdit);

    // 삭제 버튼
    var btnDel = document.createElement('button');
    btnDel.textContent = '🗑 삭제';
    btnDel.style.cssText = 'padding:6px 11px;background:none;border:1px solid rgba(255,85,85,.35);border-radius:7px;font-size:12px;color:var(--red);cursor:pointer;white-space:nowrap';
    btnDel.onclick = function(){ pbTbDelete(); };
    container.appendChild(btnDel);
  }

  // 이력 버튼 (뷰어도 가능)
  var btnHist = document.createElement('button');
  btnHist.textContent = '📋 이력';
  btnHist.style.cssText = 'padding:6px 10px;background:none;border:1px solid var(--border2);border-radius:7px;font-size:12px;color:var(--text3);cursor:pointer;white-space:nowrap';
  btnHist.onclick = function(){ pbShowHistory(_pbSelRow); };
  container.appendChild(btnHist);
}

// 플로팅 액션 패널 (레거시 호환)
var _pbActId = null;
function pbShowAct(id,name){}
function pbHideAct(){}
function pbActEdit(){}
function pbActDelete(){}

function pbDelete(id){
  if(!confirm('이 PD를 삭제하시겠습니까?\n삭제 후 복구가 불가합니다.')) return;
  pbLoad();
  var idx=_pbData.findIndex(function(x){return x.id===id;});
  if(idx<0){qToast('항목을 찾을 수 없습니다','err');return;}
  var name=_pbData[idx].name+' '+_pbData[idx].hogi;
  _pbData.splice(idx,1);
  pbSaveAll();
  pbRender();
  qToast('✓ 삭제: '+name,'ok');
}
function pbModalFields(r){
  r=r||{};
  document.getElementById('pb-name').value=r.name||'';
  document.getElementById('pb-pn').value=r.pn||'';
  var hSel=document.getElementById('pb-hogi');
  var knownH=['#FA','#FA1','#1','#2','#3','#4','#5','#6','#7','#8','#9','#10','#11','#12','#13','#14','#15','#16','#17','#18','#19','#20','#21','#22','#23'];
  if(knownH.indexOf(r.hogi)>=0){ hSel.value=r.hogi||'#FA'; document.getElementById('pb-hogi-custom').style.display='none'; document.getElementById('pb-hogi-custom').value=''; }
  else if(r.hogi){ hSel.value='기타'; document.getElementById('pb-hogi-custom').style.display='block'; document.getElementById('pb-hogi-custom').value=r.hogi; }
  else{ hSel.value='#FA'; document.getElementById('pb-hogi-custom').style.display='none'; }
  document.getElementById('pb-ccn').value=r.ccn||'';
  document.getElementById('pb-rev').value=r.rev||'';
  document.getElementById('pb-status').value=r.status||'PO접수';
  document.getElementById('pb-note').value=r.note||'';
  document.getElementById('pb-no-po').checked=!r.poReceived;
  document.getElementById('pb-req-date').value=pbNormDate(r.reqDate)||'';
  document.getElementById('pb-machine-date').value=pbNormDate(r.machineDate)||'';
  document.getElementById('pb-arrival-date').value=pbNormDate(r.arrivalDate)||'';
  document.getElementById('pb-harness-issue').value=pbNormDate(r.harnessIssue)||'';
  document.getElementById('pb-harness-done').value=pbNormDate(r.harnessDone)||'';
  document.getElementById('pb-part-issue').value=pbNormDate(r.partIssue)||'';
  document.getElementById('pb-elec-done').value=pbNormDate(r.elecDone)||'';
  // 확정일 (상대방 실제 확인)
  if(r.reqDate) pbAutoElecDate();
  var cont=document.getElementById('pb-missing-rows');
  cont.innerHTML='';
  (r.missingParts||[]).forEach(function(p){ pbAddMissingPartRow(p); });
  document.getElementById('pb-missing-empty').style.display=(r.missingParts&&r.missingParts.length)?'none':'';
}

function pbOpenNew(){
  var modal=document.getElementById('m-pdbox');
  if(modal){ modal.classList.remove('on'); modal.style.display=''; }
  document.getElementById('pb-modal-title').textContent='등록';
  document.getElementById('pb-edit-id').value='';
  pbModalFields({});
  if(modal){ modal.style.display=''; modal.classList.add('on'); }
}
function pbOpenEdit(id){
  var modal=document.getElementById('m-pdbox');
  if(modal){ modal.classList.remove('on'); modal.style.display='none'; }
  pbLoad();
  var r=_pbData.find(function(x){return x.id===id;}); if(!r) return;
  document.getElementById('pb-modal-title').textContent='편집';
  document.getElementById('pb-edit-id').value=id;
  pbModalFields(r);
  setTimeout(function(){
    if(modal){ modal.style.display='grid'; modal.classList.add('on'); }
  }, 30);
}

function pbSave(){
  var name=document.getElementById('pb-name').value.trim();
  if(!name){ alert('PD 명을 입력하세요'); return; }
  var hogiSel=document.getElementById('pb-hogi').value;
  var hogi=hogiSel==='기타'?(document.getElementById('pb-hogi-custom').value.trim()||hogiSel):hogiSel;
  // 미불출 수집
  var mpRows=document.getElementById('pb-missing-rows').querySelectorAll('.pb-mp-row');
  var missingParts=[];
  mpRows.forEach(function(row){
    var pn=(row.querySelector('[data-f="pn"]')||{value:''}).value.trim();
    var qty=(row.querySelector('[data-f="qty"]')||{value:''}).value;
    var date=(row.querySelector('[data-f="date"]')||{value:''}).value;
    var note=(row.querySelector('[data-f="note"]')||{value:''}).value;
    if(pn||qty) missingParts.push({pn:pn,qty:qty,expectedDate:date,note:note});
  });
  var id=document.getElementById('pb-edit-id').value;
  var now=new Date().toISOString();
  var rec={
    id:id||pbUID(), name:name,
    pn:document.getElementById('pb-pn').value.trim(),
    hogi:hogi, ccn:document.getElementById('pb-ccn').value.trim(),
    rev:document.getElementById('pb-rev').value.trim(),
    status:document.getElementById('pb-status').value||'PO접수',
    note:document.getElementById('pb-note').value.trim(),
    poReceived:!document.getElementById('pb-no-po').checked,
    reqDate:document.getElementById('pb-req-date').value,
    machineDate:document.getElementById('pb-machine-date').value,
    arrivalDate:document.getElementById('pb-arrival-date').value,
    harnessIssue:document.getElementById('pb-harness-issue').value,
    harnessDone:document.getElementById('pb-harness-done').value,
    partIssue:document.getElementById('pb-part-issue').value,
    elecDone:document.getElementById('pb-elec-done').value,
    missingParts:missingParts, updatedAt:now,
  };
  pbLoad();
  var isNew = !id;
  var oldRec = id ? _pbData.find(function(x){return x.id===id;}) : null;
  var who=(CURRENT_USER&&CURRENT_USER.name)||'';

  // 변경 이력 추적 (changes: 비고셀 표시용 / history: 전체 이력)
  var changes = (oldRec && oldRec.changes) ? oldRec.changes.slice() : [];
  var history = (oldRec && oldRec.history) ? oldRec.history.slice() : [];
  if(typeof history==='string'){try{history=JSON.parse(history);}catch(e){history=[];}}

  if(isNew){
    changes.push({type:'신규', msg:'등록됨', at:now});
    history.push({type:'신규', msg:'신규 등록 ('+who+')', at:now});
  } else if(oldRec) {
    var dateFields = [
      {key:'reqDate', label:'납품요청일'},
      {key:'machineDate', label:'가공물 발주일'},
      {key:'arrivalDate', label:'가공물 입고예정'},
      {key:'harnessIssue', label:'하네스 자재불출'},
      {key:'harnessDone', label:'하네스 완료요청'},
      {key:'partIssue', label:'전장 자재불출'},
      {key:'elecDone', label:'전장 완료요청'},
    ];
    dateFields.forEach(function(f){
      var oldV=pbNormDate(oldRec[f.key])||'—';
      var newV=pbNormDate(rec[f.key])||'—';
      if(oldV!==newV){
        changes.push({type:'날짜', msg:f.label+' '+oldV+'→'+newV, at:now});
        history.push({type:'날짜', msg:f.label+' '+oldV+'→'+newV+' ('+who+')', at:now});
      }
    });
    if((oldRec.status||'')!==(rec.status||'')){
      changes.push({type:'상태', msg:(oldRec.status||'')+'→'+(rec.status||''), at:now});
      history.push({type:'상태', msg:(oldRec.status||'')+'→'+(rec.status||'')+' ('+who+')', at:now});
    }
    if((oldRec.note||'')!==(rec.note||'')){
      history.push({type:'수정', msg:'비고 변경 ('+who+')', at:now});
    }
  }
  rec.changes = changes;
  rec.history = history.slice(-50);  // 최대 50건

  if(id){ var idx=_pbData.findIndex(function(x){return x.id===id;});
    if(idx>=0){rec.createdAt=_pbData[idx].createdAt||now;_pbData[idx]=rec;}
    else{rec.createdAt=now;_pbData.push(rec);}
  } else {rec.createdAt=now;_pbData.push(rec);}
  pbSaveAll();
  closeM('m-pdbox');
  _pbSelRow=null;
  pbRender();
  pbTbSelUpdate();
  qToast('✓ 저장: '+name+' '+hogi,'ok');
}

function pbAddMissingPart(){ pbAddMissingPartRow({}); }
function pbAddMissingPartRow(p){
  document.getElementById('pb-missing-empty').style.display='none';
  var cont=document.getElementById('pb-missing-rows');
  var div=document.createElement('div'); div.className='pb-mp-row';
  var pnVal=p.pn||''; var dbi=pnVal&&typeof DB!=='undefined'?DB.find(function(d){return String(d.pn).trim()===pnVal.trim();}):null;
  div.innerHTML=
    '<input class="pb-mp-inp" data-f="pn" type="text" placeholder="품번" value="'+pnVal+'" style="font-family:var(--mono)" oninput="pbMpLookup(this)">'
    +'<input class="pb-mp-inp" data-f="qty" type="number" placeholder="수량" value="'+(p.qty||'')+'" min="0">'
    +'<input class="pb-mp-inp" data-f="date" type="date" value="'+(p.expectedDate||'')+'">'
    +'<div style="grid-column:1/-2;display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-top:3px">'
      +'<input class="pb-mp-inp" data-f="desc" type="text" placeholder="품명 (자동)" value="'+(dbi?dbi.d:'')+((!dbi&&p.note)?p.note:'')+'" readonly style="background:var(--bg2);font-size:11.5px">'
      +'<input class="pb-mp-inp" data-f="mfg" type="text" placeholder="제조사 (자동)" value="'+(dbi?dbi.mg:'')+'" readonly style="background:var(--bg2);font-size:11.5px">'
      +'<input class="pb-mp-inp" data-f="mp" type="text" placeholder="제조사품번 (자동)" value="'+(dbi?dbi.mp:'')+'" readonly style="background:var(--bg2);font-size:11.5px;font-family:var(--mono)">'
    +'</div>'
    +'<button class="pb-del-btn" onclick="var r=this.closest(\'.pb-mp-row\');r.remove();if(!document.getElementById(\'pb-missing-rows\').children.length)document.getElementById(\'pb-missing-empty\').style.display=\'\'" title="삭제">✕</button>';
  cont.appendChild(div);
}
function pbMpLookup(inp){
  var row=inp.closest('.pb-mp-row');
  if(!row||typeof DB==='undefined') return;
  var pn=inp.value.trim();
  var dbi=DB.find(function(d){return String(d.pn).trim()===pn;});
  (row.querySelector('[data-f="desc"]')||{}).value=dbi?dbi.d||'':'';
  (row.querySelector('[data-f="mfg"]')||{}).value=dbi?dbi.mg||'':'';
  (row.querySelector('[data-f="mp"]')||{}).value=dbi?dbi.mp||'':'';
}

// ── CSV 업로드 (기존 데이터 일괄 입력) ──
function pbImportCSV(inp){
  if(!inp||!inp.files[0]) return;
  var ext=inp.files[0].name.split('.').pop().toLowerCase();
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var rows;
      if(ext==='csv'){
        var txt=e.target.result.replace(/^\uFEFF/,'');
        rows=txt.split(/\r?\n/).filter(function(l){return l.trim();}).map(function(l){
          var cols=[]; var cur=''; var inQ=false;
          for(var i=0;i<l.length;i++){
            var c=l[i];
            if(c==='"'){inQ=!inQ;}
            else if(c===','&&!inQ){cols.push(cur.trim());cur='';}
            else cur+=c;
          }
          cols.push(cur.trim()); return cols;
        });
      } else {
        var wb=XLSX.read(e.target.result,{type:'array'});
        rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
      }
      if(rows.length<2){ qToast('데이터가 없습니다','err'); return; }
      var hdr=rows[0].map(function(h){return String(h).trim();});
      var fi=function(aliases){ for(var i=0;i<aliases.length;i++){var idx=hdr.findIndex(function(h){return h.toLowerCase()===aliases[i].toLowerCase();});if(idx>=0)return idx;} return -1;};
      var iName=fi(['pd명','pd name','name','프로젝트','project']);
      var iPn=fi(['품번','pn','part number','partnumber','partno']);
      var iHogi=fi(['호기','hogi','unit']);
      var iCcn=fi(['ccn']);
      var iRev=fi(['rev','revision']);
      var iStatus=fi(['상태','status']);
      var iNoPo=fi(['po미접수','nopo','no_po','선진행']);
      var iNote=fi(['비고','note','remark']);
      var iReq=fi(['납품요청일','reqdate','req_date','납품일','납품일자']);
      var iMachine=fi(['가공물발주','machinedate','machine_date','가공물발주일','가공물 발주일']);
      var iArrival=fi(['입고예정','arrivaldate','arrival_date','가공물입고','가공물 입고일','가공물입고일']);
      var iHiIssue=fi(['하네스불출','harnessdate','harness_issue','하네스불출일','하네스자재불출']);
      var iHiDone=fi(['하네스완료','harnessdone','harness_done','하네스제작완료','하네스완료요청']);
      var iPartIssue=fi(['파트불출','partissue','part_issue','파트불출일','전장자재불출']);
      var iElec=fi(['전장완료','elecdone','elec_done','전장완료요청일','전장완료요청']);
      var now=new Date().toISOString();
      var added=0, skipped=0;
      pbLoad();
      rows.slice(1).forEach(function(r){
        var name=iName>=0?String(r[iName]||'').trim():'';
        if(!name){skipped++;return;}
        var rec={
          id:pbUID(),
          name:name,
          pn:iPn>=0?String(r[iPn]||'').trim():'',
          hogi:iHogi>=0?String(r[iHogi]||'').trim():'#1',
          ccn:iCcn>=0?String(r[iCcn]||'').trim():'',
          rev:iRev>=0?String(r[iRev]||'').trim():'',
          status:(function(){
            var raw=iStatus>=0?String(r[iStatus]||'').trim():'PO접수';
            var map={'발주접수':'PO접수','시작 전':'PO접수','진행 중 - 제조':'제작중','진행 중 - 품질':'품질검수','출하':'납품대기','완료':'완료','PO접수':'PO접수','자재발주':'자재발주','제작중':'제작중','품질검수':'품질검수','납품대기':'납품대기'};
            return map[raw]||raw||'PO접수';
          })(),
          poReceived:iNoPo>=0?String(r[iNoPo]||'').trim()!=='Y'&&String(r[iNoPo]||'').trim()!=='TRUE'&&String(r[iNoPo]||'').trim()!=='1':true,
          note:iNote>=0?String(r[iNote]||'').trim():'',
          reqDate:iReq>=0?String(r[iReq]||'').trim():'',
          machineDate:iMachine>=0?String(r[iMachine]||'').trim():'',
          arrivalDate:iArrival>=0?String(r[iArrival]||'').trim():'',
          harnessIssue:iHiIssue>=0?String(r[iHiIssue]||'').trim():'',
          harnessDone:iHiDone>=0?String(r[iHiDone]||'').trim():'',
          partIssue:iPartIssue>=0?String(r[iPartIssue]||'').trim():'',
          elecDone:iElec>=0?String(r[iElec]||'').trim():'',
          missingParts:[],
          changes:[{type:'신규', msg:'CSV 등록', at:now}],
          createdAt:now, updatedAt:now,
        };
        _pbData.push(rec); added++;
      });
      // 중복 제거: 동일 품번+호기 조합이면 신규만 추가 (기존 유지)
      var existKeys={};
      _pbData.forEach(function(r,i){
        var k=(r.pn||'')+'|'+(r.hogi||'');
        if(existKeys[k]===undefined) existKeys[k]=i;
        else if(existKeys[k]!==i){
          // 나중에 추가된 것(추가된 것)이 같은 키면 제거
        }
      });
      // 신규 추가분 중 기존과 중복된 것 제거
      var before=_pbData.length-added;
      var deduped=[]; var seen={};
      _pbData.forEach(function(r){
        var k=(r.pn||'')+'|'+(r.hogi||'');
        if(!seen[k]){ seen[k]=true; deduped.push(r); }
        else if(_pbData.indexOf(r)<before){ deduped.push(r); seen[k]=true; } // 기존 유지
      });
      // 실제 중복 처리
      var dupCnt=0;
      var existingKeys={}; var fresh=[];
      _pbData.slice(0,before).forEach(function(r){ existingKeys[(r.pn||'')+'|'+(r.hogi||'')]=true; });
      _pbData.slice(before).forEach(function(r){
        var k=(r.pn||'')+'|'+(r.hogi||'');
        if(existingKeys[k]){ dupCnt++; } else { fresh.push(r); existingKeys[k]=true; }
      });
      _pbData=_pbData.slice(0,before).concat(fresh);
      added=fresh.length;
      pbSaveAll(); pbRender();
      qToast('✓ '+added+'건 추가'+(dupCnt?' · '+dupCnt+'건 중복제외':'')+(skipped?' · '+skipped+'건 건너뜀':''),'ok',3000);
    }catch(err){ qToast('가져오기 실패: '+err.message,'err',5000); }
    inp.value='';
  };
  if(ext==='csv') reader.readAsText(inp.files[0],'UTF-8');
  else reader.readAsArrayBuffer(inp.files[0]);
}

// ── PD BOX 캘린더 뷰 ──
var _pbCalMode = false;
var _pbCalYear = new Date().getFullYear();
var _pbCalMonth = new Date().getMonth(); // 0-based


// ── PD BOX 뷰 모드 ──
var _pbView = 'list'; // list | cal | bypn | fa

function pbSetView(v){
  _pbView = v;
  // 탭 active
  ['list','cal','bypn','fa'].forEach(function(k){
    var btn = document.getElementById('pbt-'+k);
    if(btn) btn.classList.toggle('on', k===v);
  });
  // 캘린더 wrap 토글
  var calWrap = document.getElementById('pb-cal-wrap');
  var tblWrap = document.querySelector('#sect-pdbox .pb-table-wrap');
  var bypnWrap = document.getElementById('pb-bypn-wrap');

  if(calWrap)  calWrap.style.display  = (v==='cal')  ? 'block' : 'none';
  if(tblWrap)  tblWrap.style.display  = (v==='list'||v==='fa') ? '' : 'none';
  if(bypnWrap) { bypnWrap.style.display = (v==='bypn') ? 'block' : 'none'; if(v==='bypn'&&calWrap) calWrap.parentNode.insertBefore(bypnWrap, calWrap); }

  if(v==='cal')  pbRenderCal();
  else if(v==='bypn') pbRenderByPN();
  else pbRender();
}

function pbRenderByPN(){
  pbLoad();
  var wrap = document.getElementById('pb-bypn-wrap');
  if(!wrap) return;
  var fStatus = (document.getElementById('pb-flt-status')||{value:''}).value;
  var fQ = ((document.getElementById('pb-flt-q')||{value:''}).value||'').toLowerCase();
  var fHide = (document.getElementById('pb-flt-hidedone')||{}).checked;

  var items = _pbData.filter(function(r){
    if(fHide&&r.status==='완료') return false;
    if(fStatus&&r.status!==fStatus) return false;
    if(fQ&&!(String(r.name||'').toLowerCase().includes(fQ)||String(r.pn||'').toLowerCase().includes(fQ))) return false;
    return true;
  });

  // 품번별 그룹
  var groups = {};
  items.forEach(function(r){
    var k = r.pn||'(품번없음)';
    if(!groups[k]) groups[k]={pn:k,name:r.name||'',items:[]};
    groups[k].items.push(r);
  });

  var statusClr={'PO접수':'#a78bfa','자재발주':'#a78bfa','제작중':'#4f7cff','품질검수':'#ffb547','납품대기':'#00e5a0','완료':'#555'};
  var html = Object.keys(groups).sort().map(function(pn){
    var g = groups[pn];
    var cards = g.items.map(function(r){
      var sc = statusClr[r.status]||'var(--text3)';
      var rd = pbNormDate(r.reqDate);
      var today=new Date(); today.setHours(0,0,0,0);
      var diff=rd?Math.round((new Date(rd)-today)/86400000):null;
      var dStyle=diff!==null&&diff<0?'color:var(--red)':diff!==null&&diff<=3?'color:var(--amb)':'color:var(--text2)';
      // 진행 상태 표시 (요청 vs 확정)
      var progress='';
      if(r.machineConfirm) progress+='<span style="font-size:9.5px;color:#f59e0b">⚙✔</span> ';
      else if(r.machineDate) progress+='<span style="font-size:9.5px;color:rgba(255,181,71,.5)">⚙→</span> ';
      if(r.harnessConfirm) progress+='<span style="font-size:9.5px;color:#10b981">🧵✔</span> ';
      else if(r.harnessIssue) progress+='<span style="font-size:9.5px;color:rgba(45,212,191,.5)">🧵→</span> ';
      if(r.elecConfirm) progress+='<span style="font-size:9.5px;color:#8b5cf6">⚡✔</span>';
      else if(r.partIssue) progress+='<span style="font-size:9.5px;color:rgba(167,139,250,.5)">⚡→</span>';

      return '<div class="pb-bypn-card" onclick="pbSelectRow(\''+r.id+'\');pbOpenEdit(\''+r.id+'\');">'
        +'<div class="pbc-hogi">'+r.hogi+(r.rev?' · '+r.rev:'')+'</div>'
        +'<div class="pbc-status"><span style="color:'+sc+';font-weight:600;font-size:11px">'+( r.status||'')+'</span></div>'
        +(rd?'<div class="pbc-date" style="'+dStyle+'">납기 '+rd.slice(5)+'</div>':'')
        +(progress?'<div style="margin-top:4px">'+progress+'</div>':'')
        +'</div>';
    }).join('');
    return '<div class="pb-bypn-group">'
      +'<div class="pb-bypn-hdr"><span style="font-family:var(--mono);color:var(--accent)">'+pn+'</span><span style="color:var(--text2);font-weight:400"> — '+g.name+'</span><span style="margin-left:auto;font-size:11px;color:var(--text3)">'+g.items.length+'건</span></div>'
      +'<div class="pb-bypn-body">'+cards+'</div>'
      +'</div>';
  }).join('');

  wrap.innerHTML = html || '<div style="text-align:center;padding:30px;color:var(--text3)">데이터 없음</div>';
}

// ── 기존 pbToggleCal 대체 ──
function pbToggleCal(){
  pbSetView(_pbView==='cal'?'list':'cal');
}

function pbCalMove(d){
  _pbCalMonth += d;
  if(_pbCalMonth > 11){ _pbCalMonth=0; _pbCalYear++; }
  if(_pbCalMonth < 0){ _pbCalMonth=11; _pbCalYear--; }
  pbRenderCal();
}

function pbCalToday(){
  var now=new Date();
  _pbCalYear=now.getFullYear(); _pbCalMonth=now.getMonth();
  pbRenderCal();
}

function pbRenderCal(){
  var titleEl=document.getElementById('pb-cal-title');
  var grid=document.getElementById('pb-cal-grid');
  if(!titleEl||!grid) return;

  titleEl.textContent = _pbCalYear+'년 '+(_pbCalMonth+1)+'월';

  var days=['일','월','화','수','목','금','토'];
  var html = days.map(function(d,i){
    return '<div class="pb-cal-hdr '+(i===0?'sun':i===6?'sat':'')+'">' +d+'</div>';
  }).join('');

  var first = new Date(_pbCalYear, _pbCalMonth, 1);
  var last  = new Date(_pbCalYear, _pbCalMonth+1, 0);
  var today = new Date(); today.setHours(0,0,0,0);

  // 해당 월의 PD BOX 아이템 날짜별 그룹 (reqDate 기준)
  var byDate = {};
  // 캘린더는 완료 포함 전체 표시 (상태 필터 미적용)
  (_pbData||[]).forEach(function(r){
    var d = pbNormDate(r.reqDate);
    if(!d) return;
    if(!byDate[d]) byDate[d]=[];
    byDate[d].push(r);
  });

  // 앞쪽 빈 칸
  for(var i=0;i<first.getDay();i++) html+='<div class="pb-cal-day other-month"></div>';

  for(var day=1; day<=last.getDate(); day++){
    var key = _pbCalYear+'-'+String(_pbCalMonth+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    var dt = new Date(_pbCalYear, _pbCalMonth, day);
    var dow = dt.getDay();
    var isToday = dt.getTime()===today.getTime();
    var isWknd = (dow===0||dow===6);
    html += '<div class="pb-cal-day'+(isToday?' today':'')+(isWknd?' weekend':'')+'">';
    html += '<div class="pb-cal-daynum">'+(isToday?'✦ ':'')+day+'</div>';
    (byDate[key]||[]).forEach(function(r){
      var sc='s-'+(r.status||'').replace(/\s/g,'');
      var statusShort={'PO접수':'준비','자재발주':'준비','제작중':'제작','품질검수':'검수','납품대기':'포장','완료':'완료'}[r.status]||r.status||'';
      var delay = (typeof _pbCardHasDelay==='function') && _pbCardHasDelay(r);
      var titleAttr=[r.pn,r.name,r.hogi,r.status].filter(Boolean).join(' | ');
      html+='<div class="pb-cal-item '+sc+(delay?' is-delay':'')+'" title="'+titleAttr+'" onclick="pbOpenEdit(\''+r.id+'\')">'
        + '<div class="ci-top"><span class="ci-tag">'+statusShort+'</span>'+(r.pn||'')+(delay?' ⚠':'')+'</div>'
        + '<div class="ci-sub">'+(r.name||'')+(r.hogi?' · '+r.hogi:'')+'</div>'
        + '</div>';
    });
    html += '</div>';
  }

  // 뒤쪽 빈 칸
  var remain = (7 - (first.getDay() + last.getDate()) % 7) % 7;
  for(var i=0;i<remain;i++) html+='<div class="pb-cal-day other-month"></div>';

  grid.innerHTML = html;
}

function pbDownloadSampleCSV(){
  var csv='pd명,품번,호기,rev,납품요청일,상태,비고\n';
  csv+='ASSY TERM PD 480VAC,110171800,#FA,E,2026-05-30,PO접수,\n';
  csv+='ASSY TERM PD 208VAC,110171970,#1,C,2026-06-10,자재발주,\n';
  csv+='LEB PD,110214084,#2,D,2026-06-15,,\n';
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='pd_box_sample.csv';
  a.click();
}

function pbExportCSV(){
  pbLoad();
  var keys=['name','pn','hogi','ccn','rev','status','poReceived','reqDate','machineDate','arrivalDate','harnessIssue','harnessDone','partIssue','elecDone','note','updatedAt'];
  var header=keys.concat(['미불출품번','미불출수량','입고예정일','비고']);
  var rows=[header];
  _pbData.forEach(function(r){
    var base=keys.map(function(k){return r[k]!=null?r[k]:'';});
    var mp=r.missingParts||[];
    if(!mp.length) rows.push(base.concat(['','','','']));
    else mp.forEach(function(p){ rows.push(base.concat([p.pn||'',p.qty||'',p.expectedDate||'',p.note||''])); });
  });
  var csv=rows.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
  a.download='PDBOX_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click(); qToast('✓ CSV 저장됨','ok');
}

// ═══ PD BOX 모듈 끝 ═══


// ─── 사이드바 JS (메인 스크립트 내) ───

// ── 사이드바 드래그 순서 변경 ──
var _sbDragSrc = null;
function sbInitDrag(){
  var list = document.getElementById('sb-menu-list');
  if(!list) return;
  list.querySelectorAll('.sb-item[draggable]').forEach(function(item){
    item.addEventListener('dragstart',function(e){
      _sbDragSrc = item;
      e.dataTransfer.effectAllowed = 'move';
      item.style.opacity = '0.5';
    });
    item.addEventListener('dragend',function(){
      item.style.opacity = '';
      list.querySelectorAll('.sb-item').forEach(function(i){ i.classList.remove('drag-over'); });
      sbSaveOrder();
    });
    item.addEventListener('dragover',function(e){
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      list.querySelectorAll('.sb-item').forEach(function(i){ i.classList.remove('drag-over'); });
      if(item !== _sbDragSrc) item.classList.add('drag-over');
    });
    item.addEventListener('drop',function(e){
      e.preventDefault();
      if(_sbDragSrc && _sbDragSrc !== item){
        var items = Array.prototype.slice.call(list.querySelectorAll('.sb-item'));
        var srcIdx = items.indexOf(_sbDragSrc);
        var tgtIdx = items.indexOf(item);
        if(srcIdx < tgtIdx) list.insertBefore(_sbDragSrc, item.nextSibling);
        else list.insertBefore(_sbDragSrc, item);
      }
    });
  });
}

function sbSaveOrder(){
  var list = document.getElementById('sb-menu-list');
  if(!list) return;
  var order = Array.prototype.slice.call(list.querySelectorAll('.sb-item[data-app]')).map(function(i){ return i.dataset.app; });
  try{ localStorage.setItem('jst_sb_order', JSON.stringify(order)); }catch(e){}
}

function sbRestoreOrder(){
  var list = document.getElementById('sb-menu-list');
  if(!list) return;
  var order;
  try{ order = JSON.parse(localStorage.getItem('jst_sb_order')||'null'); }catch(e){ order=null; }
  if(!order||!order.length) return;
  order.forEach(function(app){
    var item = list.querySelector('.sb-item[data-app="'+app+'"]');
    if(item) list.appendChild(item);
  });
}

function sbToggle(group){
  var hdr=document.getElementById('appbtn-'+group);
  var sub=document.getElementById('sbsub-'+group);
  if(!hdr||!sub) return;
  var isOpen=sub.classList.contains('open');
  // 다른 아코디언 닫기
  ['purchase','po'].forEach(function(g){
    document.getElementById('sbsub-'+g)&&document.getElementById('sbsub-'+g).classList.remove('open');
    document.getElementById('appbtn-'+g)&&document.getElementById('appbtn-'+g).classList.remove('open');
  });
  if(!isOpen){
    sub.classList.add('open');
    hdr.classList.add('open');
    // 해당 앱으로 전환
    switchApp(group);
  }
}

function setSbSub(group, tab){
  // 해당 그룹 서브버튼 active 처리
  document.querySelectorAll('#sbsub-'+group+' .sb-sub-btn').forEach(function(b){
    b.classList.remove('active');
  });
  var btn=document.getElementById('sb'+group+'-'+tab);
  if(btn) btn.classList.add('active');
  // 헤더도 active
  var hdr=document.getElementById('appbtn-'+group);
  if(hdr) hdr.classList.add('active');
}

// switchApp 호출 시 사이드바 active 동기화
var _sbOrigSwitchApp = null;
function sbSyncActive(app){
  // 모든 app-btn active 해제
  document.querySelectorAll('.app-btn,.sb-group-hdr,.sb-top-btn').forEach(function(b){ b.classList.remove('on','active'); });
  var btn=document.getElementById('appbtn-'+app);
  if(btn){ btn.classList.add(app==='purchase'||app==='po'?'active':'on'); }
  // 아코디언 열기
  if(app==='purchase'||app==='po'){
    var sub=document.getElementById('sbsub-'+app);
    var hdr=document.getElementById('appbtn-'+app);
    if(sub&&!sub.classList.contains('open')){ sub.classList.add('open'); hdr&&hdr.classList.add('open'); }
  }
}

function toggleSidebar(){
  var sb=document.getElementById('sidebar');
  var tog=document.getElementById('sidebar-toggle');
  var mc=document.getElementById('main-content');
  var ov=document.getElementById('sidebar-overlay');
  var isMobile=window.innerWidth<=768;
  if(isMobile){
    var isOpen=sb.classList.contains('open');
    sb.classList.toggle('open',!isOpen);
    tog.classList.toggle('open',!isOpen);
    if(ov) ov.classList.toggle('show',!isOpen);
  } else {
    var collapsed=sb.classList.contains('collapsed');
    sb.classList.toggle('collapsed',!collapsed);
    tog.classList.toggle('open',collapsed);
    if(mc) mc.classList.toggle('sidebar-collapsed',!collapsed);
  }
}
function closeSidebarMobile(){
  if(window.innerWidth>768) return;
  var sb=document.getElementById('sidebar');
  var tog=document.getElementById('sidebar-toggle');
  var ov=document.getElementById('sidebar-overlay');
  sb.classList.remove('open');
  tog.classList.remove('open');
  if(ov) ov.classList.remove('show');
}
// 리사이즈 시 레이아웃 재계산
window.addEventListener('resize',function(){
  var isMobile=window.innerWidth<=768;
  var sb=document.getElementById('sidebar');
  var mc=document.getElementById('main-content');
  if(!isMobile){
    sb.classList.remove('open');
    var collapsed=sb.classList.contains('collapsed');
    if(mc) mc.classList.toggle('sidebar-collapsed',collapsed);
  } else {
    if(mc) mc.classList.remove('sidebar-collapsed');
  }
});



// ══════════════════ PD BOX 카드형 뷰 (공정 흐름 + 지연 강조 + 월별 그룹) ══════════════════
// 품질검수일 = 납품일 -1일 자동
function pbCalcQC(r){
  if(!r.reqDate) return '';
  var d=new Date(pbNormDate(r.reqDate)); if(isNaN(d)) return '';
  d.setDate(d.getDate()-1);
  return d.toISOString().slice(0,10);
}
function _pbDelayDays(dateStr){
  if(!dateStr) return null;
  var d=new Date(pbNormDate(dateStr)); if(isNaN(d)) return null;
  var t=new Date(); t.setHours(0,0,0,0);
  return Math.round((t-d)/86400000);
}
function _pbCardHasDelay(r){
  if(r.status==='완료') return false;
  var st=[
    [r.machineDate||r.arrivalDate, r.arrivalDate, r.machineRecv],
    [r.harnessIssue, r.harnessDone, r.harnessRecv],
    [r.partIssue, pbCalcElec(r), r.elecRecv],
    [r.partIssue||r.elecDone, pbCalcQC(r), r.qcDone]
  ];
  return st.some(function(s){
    if(!pbNormDate(s[0])) return false;       // 불출 전이면 지연 아님
    if(s[2]) return false;                     // 완료체크면 지연 아님
    var dd=_pbDelayDays(s[1]); return dd!==null && dd>0;
  });
}
function pbRefreshView(){
  if(_pbView==='cal') pbRenderCal();
  else if(_pbView==='bypn') pbRenderByPN();
  else pbRender();
}
