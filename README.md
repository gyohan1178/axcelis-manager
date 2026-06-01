# AXCELIS 통합 관리 시스템

## 폴더 구조
```
axcelis-manager/
├── index.html          ← 진입점
├── css/
│   └── style.css       ← 전체 CSS
├── src/
│   ├── main.js         ← 공통 변수, API, 유틸리티
│   ├── auth.js         ← 로그인/권한
│   ├── sidebar.js      ← 사이드바, 탭 전환
│   ├── po/
│   │   ├── po.js       ← PO 관리 로직
│   │   └── po.html     ← PO 섹션 HTML
│   ├── pdbox/
│   │   ├── pdbox.js    ← PD BOX 로직
│   │   └── pdbox.html  ← PD BOX 섹션 HTML
│   ├── purchase/
│   │   ├── purchase.js ← 구매관리 로직
│   │   └── purchase.html
│   ├── srch/
│   │   ├── srch.js     ← 자재조회 로직
│   │   └── srch.html
│   └── quote/
│       ├── quote.js    ← 견적 로직
│       └── quote.html
└── README.md
```

## GitHub Pages 배포
그대로 push하면 동작합니다.

## 섹션 HTML 동적 로딩 방식
각 섹션 HTML은 `fetch()`로 동적 로드하거나,
빌드 스크립트로 합쳐서 배포합니다.
