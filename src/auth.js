// ─── 인증 ───


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


function showApp() {
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('app-wrap').style.display = 'block';
  // 사이드바 순서 복원 + 드래그 초기화
  setTimeout(function(){ }, 100);

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
  // 섹션 HTML 로드 완료 후 초기화
  function waitAndInit(tries) {
    if(window._sectionsLoaded) {
      initAfterLogin();
    } else if(tries > 0) {
      setTimeout(function(){ waitAndInit(tries-1); }, 100);
    } else {
      console.warn('[auth] sections load timeout, initializing anyway');
      initAfterLogin();
    }
  }
  waitAndInit(30);

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


function doLogout() {
  CURRENT_USER = null; CURRENT_TOKEN = null;
  sessionStorage.clear();
  document.getElementById('user-menu').style.display = 'none';
  document.getElementById('app-wrap').style.display = 'none';
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('login-id').value = '';
  document.getElementById('login-pw').value = '';
  document.getElementById('login-err').textContent = '';
}