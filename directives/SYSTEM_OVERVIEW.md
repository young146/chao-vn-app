# Chao Vietnam 시스템 전체 지도

> 이 문서는 싼짜오베트남 서비스군의 전체 시스템 구조, 데이터 흐름, 운영 방식을
> 한 장에 담은 **Single Source of Truth**다. 새 AI 세션을 시작할 때 또는
> 구조 관련 의사결정을 할 때 이 문서를 **먼저** 읽는다.
>
> 최종 갱신: 2026-04-19

---

## 1. 서비스 구성 (4개)

| 이름 | 역할 | 도메인 | 기술 스택 | 레포 위치 |
|---|---|---|---|---|
| chaovietnam.co.kr | 메인 잡지/뉴스 웹 (25년 전통) | chaovietnam.co.kr | WordPress (PHP) | WP 서버 직접 |
| daily-news-final | 뉴스 크롤/번역/발행 파이프라인 + 편집자 어드민 | Vercel 호스팅 | Next.js, Prisma, Puppeteer | (별도 레포, 로컬) |
| vnkorlife.com | 교민 C2C 플랫폼 (중고/구인/부동산 웹) | vnkorlife.com | Next.js + Firebase | (별도 레포) |
| chao-vn-app | 통합 모바일 앱 (뉴스 + 당근 + 일자리 + 부동산 + 이웃사업) | 앱스토어 | React Native (Expo) | C:\chao-vn-app-native\chao-vn-app |

---

## 2. 3개의 데이터 저장소

각 저장소는 **명확한 역할 분담**을 가진다. 헷갈릴 때 이 표를 먼저 본다.

| 저장소 | 저장 대상 | 접근 주체 |
|---|---|---|
| **WordPress DB** (chaovietnam.co.kr) | 편집 콘텐츠: 뉴스 기사, 광고 메타, 정적 페이지 | daily-news-final이 REST API로 쓰기, 앱이 REST API로 읽기 |
| **Firebase Firestore** (project: `chaovietnam-login`) | 사용자 생성 콘텐츠 + 운영 콘텐츠 | 앱/vnkorlife가 SDK로 직접 read/write |
| **Prisma DB** (daily-news-final 내부) | 파이프라인 상태: 크롤링 이력, 번역 진행, 발행 여부, 뉴스레터 발송 기록 | daily-news-final 내부 전용 |

### Firestore 컬렉션 목록
- `XinChaoDanggn` — 중고거래
- `Jobs` — 구인 게시글
- `candidates` — 구직자 프로필
- `RealEstate` — 부동산
- `NeighborBusinesses` — 우리 이웃 제품/업소 (신규, 관련: `NEIGHBOR_BUSINESSES_PLAN.md`)
- `Announcements` — 공지 배너 시스템 (신규, 관련: `ANNOUNCEMENTS_PLAN.md`)

### Firebase Storage
- 사용자 UGC 이미지 (중고 사진, 프로필, 이웃업소 이미지)
- 버킷: `chaovietnam-login.firebasestorage.app`

### WP Media Library
- 뉴스 기사 이미지 (크롤링된 뉴스, 수동 기사 모두)

---

## 3. 데이터 흐름도

```
┌─ 편집 콘텐츠 (회사가 만드는 것) ──────────────────────────────────┐
│                                                                    │
│  [외부 뉴스 사이트]                                                │
│       ↓ Vercel Cron (매일 23:00 UTC = VN 06:00)                   │
│  [daily-news-final @ Vercel]                                      │
│     ├── Prisma DB (staging, 파이프라인 상태)                     │
│     ├── 자체 어드민 (Next.js) ← 편집자가 수동 기사 작성, 번역,  │
│     │                           뉴스레터 발송                     │
│     └── /wordpress-plugin/jenny-daily-news.php (소스 보관)       │
│       ↓ POST /wp-json/wp/v2/posts                                 │
│       ↓ POST /wp-json/xinchao/v1/upload-image (커스텀)           │
│  [chaovietnam.co.kr - WordPress]                                  │
│     ├── Jenny 플러그인 → /daily-news-terminal/ 페이지 렌더링     │
│     ├── chaovn-news-api → 앱용 뉴스 JSON                         │
│     ├── chaovn-ad-api → 앱용 광고 + Jenny 사이드바 광고 파싱     │
│     ├── chaovn-deeplink-handler → 앱 딥링크                      │
│     ├── chaovn-neighbor-sidebar (신규) → 이웃업소 카드 주입      │
│     └── Ads Inserter (서드파티) → WP 포스트 본문 광고            │
└────────────────────────────────────────────────────────────────────┘

┌─ 커뮤니티 & 운영 콘텐츠 (사용자 + 관리자) ────────────────────────┐
│                                                                    │
│  [Firebase: chaovietnam-login]                                    │
│     ├── Auth (공용 계정 DB, SSO 없음)                             │
│     ├── Firestore (XinChaoDanggn, Jobs, candidates, RealEstate,  │
│     │              NeighborBusinesses, Announcements)             │
│     └── Storage (업로드 이미지)                                   │
│            ↑                    ↑                                 │
│    [vnkorlife.com 웹]   [chao-vn-app]                             │
│    (SDK 직접 read/write) (SDK 직접 read/write)                   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌─ 통합 제공 (chao-vn-app) ──────────────────────────────────────────┐
│  하단 탭 6개: 홈 / 뉴스 / 당근 / 이웃사업 / 일자리 / 부동산       │
│  뉴스 탭 → chaovn-news-api REST                                   │
│  당근/일자리/부동산/이웃사업 탭 → Firebase SDK 직접              │
│  뉴스 탭 상단 배너 → Firestore Announcements                     │
│  광고 → chaovn-ad-api REST                                        │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. WordPress 플러그인 소유권 & 배포

**헷갈릴 때 어디로 가야 하는지 정리:**

| 플러그인 | 소스 위치 (수정할 곳) | WP 배포 방법 |
|---|---|---|
| Jenny Daily News Display | **daily-news-final repo**의 `wordpress-plugin/jenny-daily-news.php` | FTP 수동 업로드 |
| chaovn-news-api | **chao-vn-app repo**의 `wp-plugins/chaovn-news-api/` | FTP 수동 업로드 |
| chaovn-ad-api | **chao-vn-app repo**의 `wp-plugins/chaovn-ad-api/` | FTP 수동 업로드 |
| chaovn-deeplink-handler | **chao-vn-app repo**의 `wp-plugins/chaovn-deeplink-handler/` | FTP 수동 업로드 |
| chaovn-firebase-auth | **chao-vn-app repo**의 `wp-plugins/chaovn-firebase-auth/` | FTP 수동 업로드 |
| chaovn-user-welcome-emails | **chao-vn-app repo**의 `wp-plugins/chaovn-user-welcome-emails/` | FTP 수동 업로드 |
| chaovn-neighbor-sidebar (신규 예정) | **chao-vn-app repo**의 `wp-plugins/chaovn-neighbor-sidebar/` | FTP 수동 업로드 |
| Ads Inserter | 서드파티, WP 관리자에서 설치 | WP 관리자 업데이트 |
| ACF (Advanced Custom Fields) | 서드파티, WP 관리자에서 설치 | WP 관리자 업데이트 |

**원칙**: 레포에서 수정 → 로컬 테스트 → FTP 업로드 → git commit

---

## 5. 인증 실체 (중요한 사실)

- **계정 DB**: Firebase Auth 하나로 통일됨 (`chaovietnam-login`)
- **SSO는 없음**: 앱에서 로그인해도 vnkorlife.com 재로그인 필요, 그 반대도 마찬가지
  - 이유: 앱은 네이티브 스토리지, 웹은 브라우저 쿠키/localStorage — 물리적으로 다른 저장소
  - 개선 가능: Firebase Custom Token + Deep Link로 구현 가능하나 별도 프로젝트
- **WP에는 사용자 계정이 없음**: 독자는 비로그인 상태로 기사 열람

---

## 6. 하단 탭 구조 (chao-vn-app)

현재 5개 → 6개로 확장 예정.

| 순서 | 라벨 | 아이콘 (Ionicons) | flex 비율 | 스택 |
|---|---|---|---|---|
| 1 | 홈 | home-outline / home | 0.8 | HomeStack |
| 2 | 뉴스 | newspaper-outline / newspaper | 0.8 | NewsStack |
| 3 | 당근 (축약: 당근/나눔 → 당근) | gift-outline / gift | 1.05 | DanggnStack |
| 4 | 이웃사업 (신규) | storefront-outline / storefront | 1.3 | NeighborBusinessesStack |
| 5 | 일자리 (축약: 구인구직 → 일자리) | briefcase-outline / briefcase | 1.05 | JobsStack |
| 6 | 부동산 | business-outline / business | 1.05 | RealEstateStack |

**디자인 선택사항:**
- **얇은 outline 아이콘** (focused일 때 filled로 전환, 색상 `#FF6B35`)
- **불균등 너비**: 홈/뉴스를 좁게, 이웃사업을 가장 넓게. `tabBarItemStyle: { flex: ... }`
- **옅은 실선 구분선** (`#e5e5e5`, 상하 16px padding): 각 탭 사이. `borderRightWidth: 1` + `borderRightColor`
- **폰트 웨이트**: 비활성 500 / 활성 600
- **결정 근거**: `tab_design_preview.html` 옵션 G1

---

## 7. 광고 시스템 현황 (통증 1순위)

현재 **4개**의 광고 시스템이 공존. 관리자가 "어디에 등록해야 하지?" 헷갈리는 원인.

| # | 이름 | 표시 위치 | 관리 UI | 담당 |
|---|---|---|---|---|
| 1 | Ads Inserter (서드파티) | chaovietnam.co.kr WP 포스트 본문 + daily-news-terminal Jenny 광고 자리 | WP 관리자 → Ads Inserter | 영업 담당 |
| 2 | chaovn-ad-api (ACF+CPT) | chao-vn-app 앱 내부 광고 (홈/배너/팝업 등) | WP 관리자 → app_ads CPT | 관리자 |
| 3 | vnkorlife.com 자체 광고 | vnkorlife.com 웹 | Firebase 기반 | 관리자 |
| 4 | Jenny의 `jenny-ad-*` 자리 | daily-news-terminal 페이지 | Ads Inserter가 채움 → chaovn-ad-api가 앱용으로 파싱 | - |

### 광고 통합 로드맵 (목표: 2축 분리)

당장 진행하는 작업 아님. 방향만 기록.

- **Phase 0 (현재)**: 4개 공존 상태
- **Phase 1 (장기)**: Native 스택 통합 — chaovn-ad-api의 앱 슬롯 데이터를 Firebase `Ads` 컬렉션으로 이관 → 앱과 vnkorlife가 같은 컬렉션 조회
- **Phase 2 (장기)**: WP 스택 통합 — Ads Inserter + chaovn-ad-api의 Jenny 파싱 부분을 하나의 WP 플러그인으로 합치기
- **최종 목표**: WP 광고는 WP 관리자 1곳 / 네이티브 광고는 Firebase 1곳 → 2곳 관리

---

## 8. 현재 확인된 통증점

1. **광고 관리 파편화** — 4개 시스템 공존 (위 7번 섹션)
2. **플러그인 소속 혼란** — "Jenny 수정하려면 어디 가야 하지?" 이 문서가 해결
3. **관리 화면 3개** — daily-news-final 자체 admin + WP 관리자 + Firebase Console
4. **앱 ↔ 웹 SSO 없음** — 사용자는 각자 로그인 (치명적이진 않지만 UX 손해)
5. **이미지 저장소 이원화** — WP Media (뉴스) vs Firebase Storage (UGC). 경계는 명확하지만, 이 경계를 다시 만드는 실수 방지 필요
6. **Jenny 수동 FTP 배포** — 자동화 가능한 영역. 장기 개선 후보

---

## 9. 향후 개선 후보 (우선순위 낮음)

- GitHub Actions로 `wordpress-plugin/` 폴더 변경 시 자동 FTP 배포
- 앱 ↔ 웹 SSO 구현 (Firebase Custom Token + Deep Link)
- chao-vn-app repo에 있는 `wp-plugins/` 플러그인들을 별도 레포로 분리 검토

---

## 10. 핵심 원칙

1. **편집 콘텐츠는 WP, 사용자/운영 콘텐츠는 Firebase** — 새 기능을 만들 때 이 경계를 먼저 생각한다
2. **Jenny 플러그인 수정은 chaovn-news-api 안에서 하지 않는다** — chaovn-news-api는 Jenny의 데이터를 읽기만 한다
3. **앱 코드 수정은 chao-vn-app 레포, daily-news-final 수정은 별도 레포** — 크로스 레포 변경은 의식적으로 한다
4. **변경 전에는 directives/의 관련 문서를 먼저 갱신한다** — 3-layer 원칙

---

## 11. 관련 문서

- `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` — AI 협업 원칙
- `directives/NEIGHBOR_BUSINESSES_PLAN.md` — 우리 이웃 제품/업소 기능 설계
- `directives/ANNOUNCEMENTS_PLAN.md` — 공지 배너 시스템 설계
- `directives/HANDOVER_NOTES.md` — 과거 변경 이력
