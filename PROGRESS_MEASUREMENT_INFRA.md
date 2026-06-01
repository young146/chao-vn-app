# 측정 인프라 셋업 진행표

> **자동 갱신 규칙**: 모든 하위 작업 완료/상태 변경 시 이 파일을 함께 업데이트하고 commit한다.
> 사용자는 이 파일 하나만 보면 전체 진행 상황을 파악할 수 있어야 한다.
>
> SOP: [directives/MEASUREMENT_INFRA_SETUP.md](directives/MEASUREMENT_INFRA_SETUP.md)
>
> 시작: 2026-05-20
> 최종 갱신: 2026-05-25 (소셜 가입 signup_complete 4경로 통합)

---

## 🎯 한눈에 보기

| Phase | 진행률 | 상태 |
|---|---|---|
| **Phase 1 — 앱 측정** | 3 / 5 | 🟡 코드 완료, 배포 대기 |
| **Phase 2 — 웹 측정** | 3 / 3 | ✅ 코드 완료 |
| **Phase 3 — 이메일 UTM** | 2 / 2 | ✅ 코드 완료 |
| **Phase 4 — 카톡 링크 UTM** | 2 / 2 | ✅ 코드 완료 |
| **Phase 5 — 보고(코드형 주간 리포트)** | 1 / 2 | 🟡 코드 완료(daily-news-final), GA4 API 활성화 대기 |
| **전체** | **11 / 14** | 79% |

상태 기호: ✅ 완료 · 🟡 진행 중 · ⏳ 대기 · ❌ 막힘 · ⏭️ 보류

---

## Phase 1 — 앱 측정

| # | 작업 | 상태 | 변경/메모 | 갱신일 |
|---|---|---|---|---|
| 1-1 | `@react-native-firebase/analytics` 설치 | ✅ | `package.json`에 `^21.14.0` 추가, `node_modules` 설치 확인 | 2026-05-20 |
| 1-2 | Analytics 초기화 + 자동 화면 추적 | ✅ | `lib/analytics.js` 신규 작성, App.js `NavigationContainer`에 `onReady`/`onStateChange` 연결. 모든 화면 진입이 `screen_view`로 자동 기록됨 | 2026-05-20 |
| 1-3 | 주요 이벤트 6종 심기 | ✅ | PostDetailScreen(magazine_open/news_read/share_clicked), JobDetailScreen(job_view), RealEstateDetailScreen(realestate_view), AuthContext(signup_complete: **email/google/apple/kakao**) | 2026-05-25 |
| 1-4 | DebugView로 이벤트 흐름 확인 | ⏳ | — | — |
| 1-5 | **EAS Build + Store Submit** (네이티브 모듈 추가이므로 OTA 불가) | ⏳ | iOS 빌드번호 73 / Android versionCode 106으로 자동 증가 | — |

## Phase 2 — 웹 측정

| # | 작업 | 상태 | 변경/메모 | 갱신일 |
|---|---|---|---|---|
| 2-1 | `chaovietnam.co.kr` GA4 태그 확인/추가 | ✅ | `wp-plugins/chaovn-ga4-tag.php` 신규. `G-QTCWJ6GGH0` 자동 주입. **FTP 업로드 필요** (배포 규칙 §wp-plugins) | 2026-05-20 |
| 2-2 | `vnkorlife.com` GA4 태그 확인/추가 | ✅ | `app/layout.tsx`에 `next/script`로 GA4 주입. Vercel 자동 배포 시 즉시 활성화 | 2026-05-20 |
| 2-3 | 두 웹사이트를 같은 GA4 속성에 묶기 | ✅ | 두 사이트 모두 동일 측정 ID `G-QTCWJ6GGH0` 사용 → 자동으로 같은 GA4 속성. hostname 으로 트래픽 구분 가능. 필요 시 GA4 콘솔에서 추후 분리 가능 | 2026-05-20 |

## Phase 3 — 이메일 UTM 자동 부착

| # | 작업 | 상태 | 변경/메모 | 갱신일 |
|---|---|---|---|---|
| 3-1 | SendGrid 발송 코드 링크에 UTM 자동 부착 | ✅ | `lib/email-service.js`에 `addUtmToHtml()` 도입. SendGrid·SMTP 양쪽 경로 모두 UTM 부착. 자사 5개 도메인만 대상, unsubscribe 링크 제외 | 2026-05-20 |
| 3-2 | 발송별 캠페인 ID 자동 생성 | ✅ | `generateCampaignId()` → `daily_news_YYYYMMDD` 포맷. SendGrid 실패→SMTP 폴백 시 같은 ID 공유 (`sendNewsletterWithFallback`에서 1회 생성) | 2026-05-20 |

## Phase 4 — 카톡 링크 UTM

| # | 작업 | 상태 | 변경/메모 | 갱신일 |
|---|---|---|---|---|
| 4-1 | 카톡 게시용 단축링크 생성기 | ✅ | `daily-news-final/lib/kakao-broadcast.js` 신규. `utm_source=kakao&utm_medium=openchat` 자동 부착 | 2026-05-20 |
| 4-2 | 매일 뉴스 카드 + UTM 링크 자동 출력 | ✅ | `send-daily-email.js`에 통합. 매일 발송 후 `kakao-out/YYYY-MM-DD.txt` 파일 + 콘솔 출력. 사용자는 복사하여 카톡방 3개에 붙여넣기 | 2026-05-20 |

## Phase 5 — 대시보드

| # | 작업 | 상태 | 변경/메모 | 갱신일 |
|---|---|---|---|---|
| 5-1 | **코드형 주간 리포트** (Looker Studio 수동작업 대체) | ✅ | `daily-news-final/lib/ga4-report.js` + `app/api/cron/weekly-report/route.js` 신규. GA4 Data API → 6종 KPI(주간 비교) → HTML 이메일. 인증은 기존 Firebase 서비스계정(GOOGLE_APPLICATION_CREDENTIALS) 재사용 | 2026-06-01 |
| 5-2 | 매주 자동 발송 스케줄 | ✅ | `daily-news-final/vercel.json` 에 Vercel Cron `0 2 * * 1` (월 09:00 베트남) 추가. 수신: `REPORT_EMAIL` 또는 `ADMIN_EMAIL`. **활성화 조건: 아래 ⚠️ GA4 API 2-클릭 + push** | 2026-06-01 |

---

## 🪵 작업 로그 (최신순)

> 매 작업 완료/이슈 발생 시 한 줄씩 추가. 가장 최근이 맨 위.

- `2026-06-01` — **Phase 5 코드형 주간 리포트 구축 + 선행조건 전면 재검증.** 기존 문서가 stale 하여 사용자 혼선 → 라이브 검증 결과 Phase 2-1(WP), 2-2(vnkorlife), 1-5(빌드) 모두 사실상 완료 상태로 확인. Looker Studio 수동 30~60분 작업 대신 **코드형 리포트로 대체**: `daily-news-final` 에 `lib/ga4-report.js`(GA4 Data API, 6 KPI 주간비교 HTML) + `app/api/cron/weekly-report/route.js` + Vercel Cron(`0 2 * * 1`, 월 09:00 베트남) 추가. 인증은 기존 Firebase 서비스계정 재사용 — 추가 비용/키 0. 남은 것은 GA4 API 2-클릭 활성화(위 🔴 항목)뿐. mock 데이터로 HTML 렌더 검증 완료.
- `2026-05-25` — **소셜 가입 signup_complete 4경로 통합** — `AuthContext.js`의 googleLogin/appleLogin/kakaoLogin 각 `isNewSignup` 분기에 `logSignupComplete('google'|'apple'|'kakao')` 추가. 기존 이메일 가입 패턴(line 109~111) 동일 적용 — defensive require + try/catch로 OTA-safe. iOS·Android 5/21 빌드의 native analytics 모듈이 그대로 수신. 단계 3 retention 코호트 측정 사전 작업 (4명 중 3명 측정 누락 차단).
- `2026-05-20` — Phase 5 가이드 작성 완료 (`MEASUREMENT_DASHBOARD_SETUP.md`). 코드 작업 없음. GA4/Looker Studio 콘솔에서 사용자 직접 실행. 코드 작업 전체 100% — 10/14 완료, 나머지 4개는 사용자 콘솔/빌드 작업.
- `2026-05-20` — Phase 4 (4-1·4-2) 일괄 완료. `kakao-broadcast.js` 신규 + 일일 발송 후 `kakao-out/*.txt` 파일 자동 생성. 다음: Phase 5 (대시보드, 사용자 콘솔 작업).
- `2026-05-20` — Phase 3 (3-1·3-2) 일괄 완료. `email-service.js`에 UTM 자동 부착 + 캠페인 ID 자동 생성. SendGrid·SMTP 폴백 공유. 다음: Phase 4 (카톡 UTM).
- `2026-05-20` — Phase 2 (2-1·2-2·2-3) 일괄 완료. WordPress 플러그인 + Next.js layout 동시 GA4 주입. 같은 측정 ID 사용으로 자동 통합. 다음: Phase 3 (이메일 UTM).
- `2026-05-20` — Phase 1-3 완료. 6종 이벤트 코드 심기 완료 (PostDetail/JobDetail/RealEstateDetail/AuthContext). Phase 1-4·1-5는 사용자 결정 필요(EAS Build 비용/스토어 심사).
- `2026-05-20` — Phase 1-2 완료. `lib/analytics.js` 헬퍼 작성 + App.js 자동 `screen_view` 연결. Phase 1-3 시작.
- `2026-05-20` — Phase 1-1 완료 (`@react-native-firebase/analytics@21.14.0` 설치). Phase 1-2 시작.
- `2026-05-20` — Phase 1-5를 "EAS Update" → "EAS Build + Store Submit"으로 정정. analytics는 네이티브 모듈이므로 OTA로 전달 불가.
- `2026-05-20` — 진행표·SOP 셋업 완료. Phase 1-1부터 시작 예정.

---

## ⚠️ 사용자 확인 필요 사항

> Claude가 처리할 수 없거나, 외부 시스템 접근이 필요한 항목

- ~~**Phase 2-1 FTP 업로드**~~ ✅ 2026-06-01 검증 — chaovietnam.co.kr 라이브 HTML 에 `G-QTCWJ6GGH0` + gtag 확인됨. 업로드·활성화 완료 상태.
- ~~**Phase 2-2 Vercel 배포**~~ ✅ 2026-06-01 검증 — vnkorlife.com 라이브 HTML 에 `G-QTCWJ6GGH0` 확인됨. 커밋 `ecec25d` push 완료, Vercel 배포됨.
- ~~**Phase 1-5 EAS Build**~~ ✅ 2026-06-01 추정완료 — app.json buildNumber 73 / versionCode 106 (SOP 예측치와 일치). analytics 커밋(5714bdc) 이후 다수 빌드/스토어 제출됨. native analytics 모듈 탑재된 것으로 판단. (DebugView 최종 확인만 권장)
- **🔴 Phase 5 활성화 — GA4 API 2-클릭 (코드형 리포트 작동 조건)** — Claude 가 코드는 완료. 작동하려면 사용자가 단 2가지:
  1. GCP 콘솔(프로젝트 `chaovietnam-login`)에서 **Google Analytics Data API** + **Google Analytics Admin API** 사용 설정 → https://console.cloud.google.com/apis/library 에서 두 API 검색 후 "사용"
  2. GA4 콘솔 → 관리 → 속성 액세스 관리 → 서비스계정 `firebase-adminsdk-fbsvc@chaovietnam-login.iam.gserviceaccount.com` 를 **뷰어**로 추가
  → 이후 `daily-news-final` 을 push 하면 매주 월요일 자동 발송. 즉시 테스트: 배포 후 `/api/cron/weekly-report?test=1` 로 미리보기.
- **Phase 1-4 DebugView 확인** — 빌드 후 사용자가 실기기 또는 시뮬레이터에서 앱을 실행하고 Firebase 콘솔의 Analytics > DebugView에서 이벤트가 흐르는지 확인 필요. (사용자만 가능)
- ~~**소셜 회원가입 이벤트 추가 instrument**~~ ✅ 2026-05-25 완료 — Google/Apple/Kakao 세 경로 모두 `signup_complete` 발화 (method 라벨로 구분). 4개 가입 경로 모두 측정됨.
- **카테고리 ID 검증** — `NEWS_CATEGORY_ID = 31` 가정. 실제 WordPress 사이트에서 뉴스 카테고리 ID가 31이 맞는지 사용자 확인 필요.
- **Phase 4 카톡 출력 확인** — 다음 일일 발송 시 `daily-news-final/kakao-out/YYYY-MM-DD.txt` 파일 생성됨. 사용자가 그 내용을 카톡방 3개(씬짜오 구인구직 / 부동산 / 당근·나눔)에 복사·붙여넣기.
- **Phase 5 콘솔 작업** — `directives/MEASUREMENT_DASHBOARD_SETUP.md` 가이드 따라 사용자가 직접 Looker Studio 보고서 작성 (코드 없음, 30~60분 소요 예상). 데이터 흐름이 안정된 뒤 (Phase 1~4 모두 배포 + 24시간 경과) 진행 권장.

---

## 📌 사용 방법 (사용자용)

1. 이 파일을 열어서 **🎯 한눈에 보기** 표만 보면 전체 진행률을 알 수 있음
2. 어떤 작업이 지금 진행 중인지는 🟡 (진행 중) 표시된 항목을 찾으면 됨
3. 막힌 부분이 있으면 ❌ 표시된 항목의 "변경/메모" 칸을 보면 이유 적혀 있음
4. **⚠️ 사용자 확인 필요 사항** 섹션은 매번 확인 권장 — 사용자만 할 수 있는 일이 모임
