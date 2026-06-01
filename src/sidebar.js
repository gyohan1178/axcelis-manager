// ─── 사이드바 ───


function toggleSidebar(){
  if(window.innerWidth>768) return;
  var sb=document.getElementById('sidebar');
  var ov=document.getElementById('sidebar-overlay');
  var isOpen=sb.classList.contains('open');
  sb.classList.toggle('open',!isOpen);
  if(ov) ov.classList.toggle('show',!isOpen);
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
  sp.style.display  = (app==='purchase') ? 'block':'none';
  so.style.display  = (app==='po')       ? 'block':'none';
  if(ss)  ss.style.display  = (app==='srch')   ? 'block':'none';
  if(st)  { st.style.display = (app==='todo')  ? 'block':'none'; if(app==='todo') st.style.cssText='display:block!important'; }
  if(sq)  { sq.style.display = (app==='quote') ? 'block':'none'; if(app==='quote') sq.style.cssText='display:block!important'; }
  if(spb) { spb.style.display=(app==='pdbox')  ? 'block':'none'; if(app==='pdbox') spb.style.cssText='display:block!important'; }
  if(spr) { spr.style.display=(app==='process')? 'block':'none'; }
  sp.classList.toggle('on', app==='purchase');
  so.classList.toggle('on', app==='po');
  if(ss)  ss.classList.toggle('on',  app==='srch');
  if(st)  st.classList.toggle('on',  app==='todo');
  if(sq)  sq.classList.toggle('on',  app==='quote');
  if(spb) spb.classList.toggle('on', app==='pdbox');
  document.getElementById('appbtn-purchase').classList.toggle('on', app==='purchase');
  document.getElementById('appbtn-po').classList.toggle('on', app==='po');
  var bs=document.getElementById('appbtn-srch');   if(bs)  bs.classList.toggle('on', app==='srch');
  var bt=document.getElementById('appbtn-todo');   if(bt)  bt.classList.toggle('on', app==='todo');
  var bq=document.getElementById('appbtn-quote');  if(bq)  bq.classList.toggle('on', app==='quote');
  var bb=document.getElementById('appbtn-pdbox');  if(bb)  bb.classList.toggle('on', app==='pdbox');
  var bp=document.getElementById('appbtn-process');if(bp)  bp.classList.toggle('on', app==='process');
  if(app==='srch')   { srchTab('item'); }
  if(app==='todo')   renderTodo();
  if(app==='quote')  { qInitCheck(); }
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


function sbSaveOrder(){
  var list = document.getElementById('sb-menu-list');
  if(!list) return;
  var order = Array.prototype.slice.call(list.querySelectorAll('.sb-item[data-app]')).map(function(i){ return i.dataset.app; });
  try{ localStorage.setItem('jst_sb_order', JSON.stringify(order)); }catch(e){}
}


function sbRestoreOrder(){ return; // 비활성화
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