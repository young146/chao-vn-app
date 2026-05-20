# 측정 대시보드 셋업 가이드 (Phase 5)

> 이 문서는 GA4 콘솔과 Looker Studio 콘솔에서 *사용자 직접* 실행하는 단계 가이드입니다.
> 코드 작업은 없습니다.
>
> 작성: 2026-05-20
> 선행: [MEASUREMENT_INFRA_SETUP.md](MEASUREMENT_INFRA_SETUP.md) Phase 1~4 코드 완료
> 진행표: [../PROGRESS_MEASUREMENT_INFRA.md](../PROGRESS_MEASUREMENT_INFRA.md)

---

## 0. 시작 전 체크리스트

데이터가 흐르지 않으면 대시보드도 비어 있습니다. 다음이 *모두* 충족된 뒤 진행:

- [ ] WordPress 플러그인 `chaovn-ga4-tag.php` FTP 업로드 + 활성화 → chaovietnam.co.kr 페이지 소스에 `G-QTCWJ6GGH0` 보임
- [ ] vnkorlife.com Vercel 배포 완료 → 페이지 소스에 `G-QTCWJ6GGH0` 보임
- [ ] EAS Build + Store Submit 완료 + 사용자 일부 업데이트 (앱 데이터는 빌드 후 1~2일 지연 발생)
- [ ] 첫 *데일리 뉴스 자동 발송* 1회 이상 (UTM 부착된 이메일이 실제 발송돼야 데이터 발생)

위 4개 완료 후 *24시간 대기* → GA4 콘솔에 데이터가 쌓이기 시작.

---

## 5-1. Looker Studio KPI 6종 대시보드

### 단계 1. Looker Studio 접속
1. https://lookerstudio.google.com 접속 (younghan146@gmail.com 로그인)
2. `+ 만들기` → `보고서`

### 단계 2. 데이터 소스 연결
1. `Google Analytics` 커넥터 선택
2. 계정: 본인 계정 → 속성: `chaovietnam-login` (또는 GA4 측정 ID `G-QTCWJ6GGH0` 이 포함된 속성)
3. `연결` 버튼

### 단계 3. KPI 6종 위젯 배치

대시보드 첫 페이지에 다음 6개 위젯을 격자 형태로 배치:

| 위치 | 위젯 종류 | 지표 / 차원 | 필터 / 비고 |
|---|---|---|---|
| 좌상 | **스코어카드** | `Total users` (총 사용자) | 최근 30일. 비교 기간: 직전 30일 |
| 우상 | **스코어카드** | `Active users` (활성 사용자) | 최근 28일 |
| 좌중 | **시계열 차트** | `Daily active users` × 날짜 | 최근 30일 |
| 우중 | **표** | `Source / Medium` × `Sessions`, `Conversions` | 필터: `Source` IN ('email', 'kakao'). 이메일 vs 카톡 효과 비교 |
| 좌하 | **표** | `Event name` × `Event count` | 필터: Event name IN ('magazine_open','news_read','job_view','realestate_view','signup_complete','share_clicked'). 어떤 콘텐츠가 인기인지 |
| 우하 | **표** | `Platform` × `Total users` | iOS / Android / Web 비중 |

### 단계 4. 캠페인 별 분석 페이지 (2번째 페이지)

`+ 페이지 추가` 후 다음 위젯:

| 위젯 | 지표 | 차원 / 필터 |
|---|---|---|
| 표 | `Sessions`, `Conversions` | `Session campaign` × `Source`. UTM 캠페인별 트래픽 |
| 시계열 | `New users` | 필터: `Source = 'email'`. 이메일 캠페인 신규 유입 추이 |
| 시계열 | `New users` | 필터: `Source = 'kakao'`. 카톡 캠페인 신규 유입 추이 |

### 단계 5. 공유 및 저장
1. 우상단 `공유` → `링크 공유` → 본인이 접근 가능한 사용자에게 보기 권한
2. 보고서 이름: `씬짜오 측정 인프라 v1` (또는 본인이 원하는 이름)
3. **이 보고서 URL 을 [PROGRESS_MEASUREMENT_INFRA.md](../PROGRESS_MEASUREMENT_INFRA.md) 에 기록**

---

## 5-2. 매주 자동 이메일 리포트

### 옵션 A — Looker Studio 내장 스케줄 발송 (권장)

1. 5-1에서 만든 보고서 열기
2. 우상단 `공유` 아이콘 옆 `⋮` → `발송 일정`
3. 다음 설정:
   - 빈도: **매주 월요일** (베트남 시각 09:00)
   - 받는 사람: `younghan146@gmail.com` (필요 시 다른 팀원 이메일 추가)
   - 포함 페이지: 모두
   - 형식: PDF
4. `저장`

### 옵션 B — GA4 자체 이메일 알림 (보조)

1. GA4 콘솔 → `Insights` → `Create custom insight`
2. 다음 알림 추가:
   - `이메일 캠페인 신규 사용자가 7일 평균 대비 20% 하락 시` → 이메일 발송
   - `앱 신규 설치 일 50건 하락 시` → 이메일 발송
   - `이벤트 `signup_complete` 일 5건 미만 시` → 이메일 발송

---

## ⚠️ 흔한 함정 (실행 전 읽기)

### "데이터가 안 보여요"
- GA4 는 *4시간~24시간* 지연 후 보고서에 반영. `Realtime` 보고서로 즉시 확인 가능
- 앱 데이터는 *48시간 지연* 가능 (Firebase → GA4 동기화)
- DebugView 는 즉시 — 디버그 모드 활성화 필요

### "이메일/카톡 캠페인이 'direct' 로 잡혀요"
- iOS Mail/카톡 인앱 브라우저가 referer 헤더를 안 보내는 경우가 있음
- 해결: UTM 파라미터는 작동 (우리는 이미 부착 완료). `direct/(none)` 으로 보이면 click 별로 카운트가 안 모이는 것
- 검증: GA4 `Traffic acquisition` 보고서에서 `Source = email` 또는 `kakao` 가 잡히는지 확인

### "앱 설치는 GA4 어디서 봐요?"
- `Engagement` → `Events` → `first_open` 이벤트 카운트 = 신규 설치
- `Acquisition` → `User acquisition` 에서 `First user source/medium` 으로 유입 채널별 분리

### "두 웹사이트가 섞여서 보여요"
- 우리는 같은 측정 ID 를 두 사이트에 적용 → 자동으로 같은 속성에 모임
- 분리해서 보고 싶으면: `Hostname` 차원으로 필터 (`chaovietnam.co.kr` vs `vnkorlife.com`)
- 완전 분리가 필요하면: GA4 에서 추가 데이터 스트림 생성 후 새 측정 ID 발급 → 코드 한 줄만 바꿔서 적용

---

## 완료 정의

- [ ] Looker Studio 보고서 1개 작성 및 본인 접근 가능
- [ ] 보고서 URL이 진행표에 기록됨
- [ ] 매주 월요일 오전 9시 자동 발송 스케줄 설정됨
- [ ] 첫 주간 리포트 받음 (2026-05-25 이후 첫 월요일 예상)
