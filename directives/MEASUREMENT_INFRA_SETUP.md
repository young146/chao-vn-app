# 측정 인프라 셋업 (Quick Win #5)

> **목적**: 씬짜오 디지털 자산(앱·웹·이메일·카톡)의 사용자 행동을 측정하여,
> 이후 모든 마케팅 액션의 효과를 *데이터 기반*으로 검증 가능하게 만든다.
>
> 작성일: 2026-05-20
> 참고: [씬짜오 디지털 마케팅 활성화 방안.md](../씬짜오%20디지털%20마케팅%20활성화%20방안.md) §5 Quick Win 5
> 진행표: [PROGRESS_MEASUREMENT_INFRA.md](../PROGRESS_MEASUREMENT_INFRA.md) — **모든 작업 완료 시 반드시 함께 업데이트**

---

## 0. 한 줄 요약

> **Firebase Analytics(GA4) 하나로 앱·웹·이메일·카톡 4개 채널을 한 속성에 묶고, 매주 볼 6개 KPI 대시보드를 만든다.**

이미 Firebase 프로젝트 `chaovietnam-login`과 GA4 측정ID `G-QTCWJ6GGH0`이 존재하므로 *추가 비용 0원*, 새 도구 학습 0개.

---

## 1. 왜 Firebase Analytics(GA4)인가

| 후보 | 장점 | 단점 | 결론 |
|---|---|---|---|
| **Firebase Analytics (GA4)** | 이미 Firebase 사용 중 / 무료 / 앱+웹 통합 | UI가 다소 복잡 | ⭐ 선택 |
| Mixpanel | 행동 분석 UI 우수 | 별도 계정/SDK 추가 부담 | 보류 |
| Amplitude | 깔때기 분석 강함 | 동일 | 보류 |

---

## 2. 측정 대상 — 핵심 6개 KPI

문서 §4 KPI 표 기준:

| # | KPI | 측정 방법 |
|---|---|---|
| 1 | 앱 누적 설치 / MAU | Firebase Analytics `first_open` / `user_engagement` |
| 2 | 이메일 → 앱 전환률 | 이메일 링크 UTM + GA4 캠페인 보고서 |
| 3 | 이메일 오픈률 | SendGrid 대시보드 (별도 통합 불필요, SendGrid 자체 측정) |
| 4 | 카톡 → 앱 클릭 | 카톡 게시 링크 UTM + GA4 캠페인 보고서 |
| 5 | 앱 첫 화면 이탈률 | Firebase Analytics `screen_view` + retention 보고서 |
| 6 | jobs-crm 매칭 발송 수 | (별도 작업 — jobs-crm 활성화 시 자동 측정) |

---

## 3. 작업 단계 (Phase 1~5)

### Phase 1 — 앱 측정 (1~2일, *가장 중요*)

| # | 작업 | 파일 | 비고 |
|---|---|---|---|
| 1-1 | `@react-native-firebase/analytics` 설치 | `package.json` | iOS/Android prebuild 필요할 수 있음 |
| 1-2 | Analytics 초기화 + 자동 화면 추적 설정 | `App.tsx` / `lib/analytics.ts` 신규 | `screen_view` 자동 수집 |
| 1-3 | 주요 이벤트 6개 심기 | 화면별 진입 시점 | `magazine_open`, `news_read`, `job_view`, `realestate_view`, `signup_complete`, `share_clicked` |
| 1-4 | DebugView로 이벤트 흐름 확인 | Firebase 콘솔 | 이벤트가 실제로 흐르는지 |
| 1-5 | **EAS Build + Store Submit** | `eas build --profile production` 후 `eas submit` | ⚠️ 네이티브 모듈 추가 = OTA 불가. 스토어 심사 필요 |

### Phase 2 — 웹 측정 (반나절)

| # | 작업 | 파일 |
|---|---|---|
| 2-1 | `chaovietnam.co.kr` GA4 태그 확인/추가 | 별도 저장소 (사용자 확인 필요) |
| 2-2 | `vnkorlife.com` GA4 태그 확인/추가 | `c:\vnkorlife.web\vnkorlife-web` |
| 2-3 | 두 웹사이트를 같은 GA4 속성에 묶기 | Firebase 콘솔 데이터스트림 추가 |

### Phase 3 — 이메일 UTM 자동 부착 (반나절)

| # | 작업 | 파일 |
|---|---|---|
| 3-1 | SendGrid 발송 코드의 모든 링크에 UTM 자동 부착 | `c:\xinchao-news-final\daily-news-final` |
| 3-2 | 발송별 캠페인 ID 자동 생성 (예: `daily_news_2026_05_20`) | 동상 |

### Phase 4 — 카톡 링크 UTM (반나절)

| # | 작업 |
|---|---|
| 4-1 | 카톡 게시용 단축링크 생성기 만들기 (UTM 자동 부착) |
| 4-2 | 매일 뉴스 카드 + UTM 링크 자동 출력 |

### Phase 5 — 대시보드 (반나절)

| # | 작업 |
|---|---|
| 5-1 | Looker Studio (구 Data Studio)에서 KPI 6개 대시보드 만들기 |
| 5-2 | 매주 자동 이메일 리포트 설정 (월요일 오전 9시) |

---

## 4. 이벤트 명명 규칙 (반드시 준수)

GA4 권장 명명 규칙:
- 소문자 + 언더스코어 (예: `news_read`, ✅)
- 미래 확장 가능한 명사_동사 형태
- 한 이벤트당 파라미터 25개 이하

### 정의된 이벤트 사전

| 이벤트명 | 발생 시점 | 파라미터 |
|---|---|---|
| `screen_view` | 모든 화면 진입 (자동) | `screen_name`, `screen_class` |
| `magazine_open` | 매거진 콘텐츠 진입 | `magazine_id`, `magazine_title` |
| `news_read` | 뉴스 상세 진입 | `news_id`, `news_title`, `source` |
| `job_view` | 구인 공고 상세 진입 | `job_id`, `job_title`, `company` |
| `realestate_view` | 부동산 매물 상세 진입 | `listing_id`, `location` |
| `signup_complete` | 회원가입 완료 | `method` (google/apple/kakao/email) |
| `share_clicked` | 공유 버튼 클릭 | `content_type`, `content_id` |

---

## 5. 자체 학습 사항 (작업 중 발견 시 추가)

> 작업하며 발견한 API 제약/팁/실수 등을 이 섹션에 추가하여 다음 작업자가 참고하게 함

(작업 시작 후 채워질 영역)

---

## 6. 완료 정의 (Definition of Done)

이 SOP가 완료됐다고 말하려면 **모두** 충족:
- [ ] 앱에 Analytics 패키지 설치되고 빌드 성공
- [ ] Firebase 콘솔 DebugView에 이벤트 4종 이상 실시간 표시 확인
- [ ] EAS Update가 production 채널로 배포됨
- [ ] 두 웹사이트에 GA4 태그 작동 (Realtime 보고서에서 활성 사용자 1+ 확인)
- [ ] 이메일/카톡 링크에 UTM 자동 부착
- [ ] Looker Studio 대시보드 1개 작성 + 사용자에게 링크 전달
