# 작업 현황 로그 (WORKLOG)

> **목적**: 세션·작업자가 바뀌어도 작업을 *이어서* 할 수 있도록, 모든 작업의 현황을 한 곳에 시간순으로 남긴다.
>
> **읽기 규칙**: 새 작업을 시작하기 전, 이 파일 맨 위(최신 항목)부터 읽어 직전 작업의 맥락과 "다음 단계"를 파악한다.
>
> **쓰기 규칙**: 작업을 완료하거나 중단할 때마다 맨 위에 새 항목을 추가한다. 깊은 기술 추적은 주제별 `PROGRESS_*.md`로 링크하고, 이 파일에는 **"무엇을 · 어디까지 · 다음은"** 요약만 남긴다.
>
> 최종 갱신: 2026-07-17

---

## ⏳ 다음 EAS Build 에 반드시 포함할 것

> ⚠️ **이 구역만은 시간순 기록이 아니라 "지금 참인 상태"다. 밑에 쌓지 말고 *제자리에서 고쳐 쓴다*.**
> 네이티브 변경(새 `react-native-*`/`expo-*` 모듈, `app.json` 의 plugins·infoPlist·permissions, `ios/`·`android/`)을 만들면 → **여기 추가**.
> 빌드 후 **실물로 확인**되면 → 항목 삭제. (빌드 됐다고 지우지 말 것. *확인* 됐을 때 지운다)
>
> 📌 **빌드/런타임 현황은 여기 적지 않는다.** 손으로 베낀 표는 반드시 어긋난다 (2026-07-17에 실제로 어긋나 멀쩡한 OTA를 취소할 뻔함).
> → 항상 `eas build:list --status finished --limit 5` / `eas update:list --branch production` 이 정답.
>
> 🚨 2026-06-25 2.4.3 빌드에서 아래 ①이 **누락된 채 나가 iOS 측정이 지금까지 0건**인 사고 있었음. 재발 금지.

- [ ] **① iOS Firebase Analytics 활성화** 🔴 — 빌드 직전 `GoogleService-Info.plist` 의 `IS_ANALYTICS_ENABLED` = `true`, `app.json` infoPlist 의 `FIREBASE_ANALYTICS_COLLECTION_ENABLED` = `true` 인지 **눈으로 확인**. 커밋 `4e78d3a` 로 저장돼 있어 clean checkout 이면 자동 포함되지만, 과거 미커밋으로 누락된 전례가 있으니 `git status` 재확인. → 빌드 후 **Firebase 콘솔에 iOS 이벤트가 실제로 들어오면** ✅ 처리. (지금 iOS 로그인 ~100명이 통째로 안 보이는 원인)
- [ ] **② iOS 푸시 알림 이미지 (Notification Service Extension)** 🟡 — 등록 2026-06-30. 발송측(`functions/index.js` `sendMulticastFCM`)은 이미 `apns.fcmOptions.imageUrl` 을 보내는 중 → **앱에 네이티브 익스텐션만 추가하면 됨**(expo-notifications NSE 설정 또는 config plugin). 안드로이드는 이미 빅픽처로 표시됨. → iOS 실기기에서 이미지 알림 수신 확인되면 ✅.

**지금 빌드해야 하나?** → 🔴 이 있으면 즉시 / 🟡 만 3개 이상이면 모아서 / 비었으면 불필요(OTA로 충분). 신규 유입 캠페인 직전이면 빌드 우선(신규 사용자는 *현재* 빌드를 받으므로 측정 인프라가 빌드돼 있어야 함).

---

## 📂 문서 지도 — 이어가기는 **여기(WORKLOG)** 하나로 시작한다

> 새 세션/작업자는 **이 파일만 열면 된다.** 아래 주제별 문서는 *깊은 내용이 필요할 때만* 들어간다.

| 문서 | 무엇 | 언제 보나 | 상태 |
|---|---|---|---|
| **(이 파일) WORKLOG.md** | 맨 위 = 미빌드 네이티브 현황(제자리 갱신) · 아래 = 시간순 작업 기록 | **항상 여기부터** | 🟢 활성 |
| [PROGRESS_CHAT_SYSTEM.md](PROGRESS_CHAT_SYSTEM.md) | 채팅·등록채널 구조와 함정 | 채팅/등록 오류 재발 시 | 🟢 참조 |
| [directives/ROADMAP.md](directives/ROADMAP.md) | 개선 백로그(ASO·로그인전환·푸시 등) | "다음에 뭘 만들지" 정할 때 | 🟡 백로그 |
| [PROGRESS_MEASUREMENT_INFRA.md](PROGRESS_MEASUREMENT_INFRA.md) | GA4/측정 셋업 진행 | 측정 작업 재개 시 | 🟡 정체(5/25) |
| [PROGRESS_PUSH_SYSTEM.md](PROGRESS_PUSH_SYSTEM.md) | 푸시 발송 시스템 구조 | 푸시 손볼 때 참고 | ⚪ 완료/참고 |

---

## ✍️ 항목 템플릿 (복사해서 맨 위에 붙여넣기)

```md
## YYYY-MM-DD — (작업 제목 한 줄)
- **한 일**: 무엇을 왜 바꿨는지 1~3줄
- **배포**: (앱 OTA / 웹 Vercel / 미배포) + 커밋 해시
- **상태**: ✅ 완료 / 🟡 진행중 / ⏳ 검증·승인 대기
- **다음 단계**: 다음 작업자가 이어서 할 일 (없으면 "없음")
- **관련 파일/문서**: 링크
```

---

## 2026-07-17 (밤) — 📋 [측정] 어드민 복사 버튼에 유입 추적 자동 부착 (카톡/페북/Zalo)

- **한 일**: 직원이 매일 어드민에서 URL 을 복사해 **카톡 단톡방 50여 개 + 오픈방 3개 + 페북 + Zalo** 에 붙여넣는데, 복사되는 링크에 이름표가 없어 GA4 가 전부 **'직접 방문'(주 5,489세션 = 44%)** 으로 쓸어담고 있었다. → 복사 시점에 목적지 이름표가 자동으로 붙게 함.
- **복사 지점 4곳 전수 조사 후 3곳 수정** (전부 맨 URL 복사 중이었음):
  | 파일 | 버튼 | 처리 |
  |---|---|---|
  | `app/admin/card-news/CardNewsPreviewMars.js:396` | "📮 최종적으로 이 URL을 복사하여…" (**카드 게시 후 메인 흐름**) | 목적지별 3종으로 교체 |
  | `app/admin/card-news/CardNewsSimple.js:565` | "📋 뉴스 URL 복사" | 목적지별 3버튼 |
  | `app/admin/published-news/published-news-list.js:923` | "📤 SNS용 URL 복사" (터미널 URL 하드코딩) | 목적지별 3버튼 |
  | `app/admin/published-news/published-news-list.js:674` | "📋 링크 복사" | **대상 아님** — `facebookPermalink`(외부 facebook.com). `withShareUtm` 도 외부 호스트는 손대지 않음 |
- **신규 `lib/share-utm.js`**: `SHARE_TARGETS`(kakao/facebook/zalo) + `withShareUtm()`. 캠페인 ID = `daily_news_YYYYMMDD` (이메일·카톡 모듈과 동일 포맷 → "같은 날 발행분이 채널별로 얼마나 왔나" 한 줄 비교 가능). 우리 도메인에만 부착, 기존 utm 있으면 존중.
- **⚠️ utm_source 를 'kakao' 가 아닌 'kakaotalk' 으로 쓴 이유**: 'kakao' 면 `ga4-channels-report.js` `bucket()` 의 daum/kakao 규칙에 걸려 **다음/카카오 *검색* 유입과 한 덩어리**가 된다. 앱(`deepLinkUtils.js`)과 값을 일치시켜 합산되게 함.
- **★ 사장님 정보로 설계 정정**: 카톡 게시는 오픈방 3개뿐 아니라 **단톡방 50여 개**에도 올림 → `utm_medium=openchat` 은 틀린 이름표 → **`social` 로 정정**(`75dd61d`). 방별 구분은 불가능하고 불필요("카카오톡이면 충분"). **단톡방 50개는 몰랐던 사실 — 카톡 규모가 오픈방 990명보다 훨씬 클 수 있음.**
- **Zalo 포함 이유**: `CardNewsPreviewMars` 안내문에 *"Facebook, 카카오톡, Zalo 모두 이 URL 사용"* 이라 적혀 있었음. 빼면 Zalo 유입이 계속 '직접 방문'에 묻힘.
- **검증 (사장님 요청으로 실제 테스트)**: `next build` **✓ Compiled successfully (exit 0)** · dev 서버 기동 후 `/admin/card-news` **HTTP 200** · **클라이언트 번들에 '카톡용'·'페북용'·'Zalo용'·`kakaotalk` 전부 포함 확인** (버튼은 카드 생성 후 나타나는 조건부 UI라 초기 HTML 에는 없는 게 정상) · **직원이 붙여넣을 실제 URL → HTTP 200** · **그 페이지 GA4 가 `page_location: window.location.href` 사용 → 쿼리(UTM)가 GA4 로 전달됨 확인** · **카톡 미리보기 OG 살아있음**(og:title/og:image 정상)
- **⚠️ 검증의 한계**: curl 은 JS 를 실행하지 않으므로 "실제 클릭 → GA4 기록"까지는 확인 못 함. **사장님이 카톡용 복사 → 붙여넣기 → 클릭 후 GA4 실시간 보고서에서 `kakaotalk` 이 뜨는지 봐주시면 최종 확정.**
- **배포**: `daily-news-final` **`f20e777`** + **`75dd61d`** → Vercel 자동배포
- **곁가지 발견**: 뉴스 터미널에 **GA4 태그가 2개** 박혀 있음 — `G-QTCWJ6GGH0`(우리 것) + **`G-6K2SPGVPL1`(정체불명)**. 우리 리포트는 앞의 것만 보므로 숫자 왜곡은 없으나 확인 필요.
- **✅ 사장님 실물 확인 (내가 못 하던 마지막 한 칸)**: 카톡에 UTM 붙은 링크를 붙여넣으니 **미리보기 카드가 정상 렌더**(제목·설명·이미지 전부). curl 은 JS 를 못 돌려 확인 못 하던 부분을 실물로 채움. **카톡 경로 완성.**
- **⛔ '페북용 복사' 버튼은 만들었다가 제거** (`920ec16`): 사장님 지적 — **페북은 링크를 복사하는 게 아니라 "페북 미리보기 + 게시"로 4개 페이지에 *자동 게시*** 된다(`app/api/fb-publish/route.js`). 페북 **그룹**에도 올라가지만 그건 우리 시스템이 아니라 **페이스북 안에서 페이지 글이 공유되는 것**(확인: `app/api/fb-group-post/route.js` 는 **부르는 곳이 없는 죽은 API**, UI 없음). → **어느 경로로도 직원이 페북 링크를 복사하지 않음** = 안 눌릴 버튼 + "페북도 복사해야 하나?" 오해만 유발. **남은 버튼: 카톡용 / Zalo용 2개** (둘 다 실제 수동 게시).
- **⛔ 페북 자동게시는 건드리지 않기로 결정 (사장님)**: `fb-publish/route.js:81` 이 맨 URL(`https://chaovietnam.co.kr/daily-news-terminal/`)을 올리고 있어 **페북 유입(주 180세션 = 1%)은 계속 미측정**. 잘 돌고 있는 자동화를 1% 채널 때문에 건드릴 이유 없음. *(나중에 필요하면 그 한 줄에 UTM 추가로 가능 — 카톡에서 검증됐듯 미리보기는 안 깨짐)*
- **앱 공유버튼의 facebook 은 유지** — 그건 사용자가 직접 누르는 수동 공유라 유효(`deepLinkUtils.js`).
- **다음 단계**: ① 1주 뒤 리포트에서 **'직접 방문 44%'가 줄고 '카톡 공유'가 뜨는지** — 카톡 가설 최종 판정 ② `lib/kakao-broadcast.js` 는 **죽은 코드**(안 쓰이는 `scripts/send-daily-email.js` 만 import) — 삭제 여부 결정 필요 ③ 웹 공유(`vnkorlife-web` `ShareSection.tsx`)는 아직 UTM 미부착 (일반 방문자용, 우선순위 낮음)
- **관련 파일**: `daily-news-final/lib/share-utm.js` · `app/admin/card-news/*` · `app/admin/published-news/published-news-list.js`

---

## 2026-07-17 (저녁) — 🔗 [측정] 공유 링크에 UTM 부착 — 카톡/페북/Zalo 등 SNS별 유입 구분

- **한 일**: 유입의 **44%(주 5,489세션)가 "직접 방문"** 으로 잡혀 정체불명. 모바일이 PC의 2.3배(13,598 vs 5,806)라 **카톡 공유가 유력**하나 공유 링크에 이름표가 없어 증명 불가였다. 사장님이 카톡 외 페북 등에도 게시하시므로 **플랫폼별로 구분**되게 부착.
  - `utils/deepLinkUtils.js`: `generateDeepLink(type,id,item,platform)` 에 platform 추가 → `shareItem` 이 이미 알고 있는 platform 을 전달. `utm_source=kakaotalk|facebook|threads|zalo|sms|sharesheet` · `utm_medium=share` · `utm_campaign=danggn|job|realestate|neighbor`. **platform 생략 시 기존과 동일(깨끗한 URL) — 하위호환.**
  - `daily-news-final/lib/ga4-channels-report.js`: `bucket()` 에 **`카톡 공유`(kakaotalk) / `공유(대상불명)`(sharesheet)** 칸 추가. **daum/kakao 규칙보다 먼저** 둬야 카톡 *공유* 가 다음/카카오 *검색* 과 안 섞임. (그래서 utm_source 를 'kakao' 아닌 **'kakaotalk'** 으로 쓴 것)
- **⚠️ 왜 이제 안전한가 — 2026-03 에 되돌린 이력이 있음** (`f368fc0` → `22800f1` *"revert share URL query params to fix Kakao preview card"*, 하루 만에 원복. `deepLinkUtils.js:62` 의 "클린 URL … 원복" 주석이 그것): **그때는 구조가 달랐다.** 공유 URL 이 PHP(`chaovietnam.co.kr/app/share`)였고 `title/image/price` 를 **읽어서** OG 를 만들던 탓에 한글 인코딩 파라미터가 카드를 깨뜨림. **지금은 vnkorlife-web 의 `generateMetadata({params})` 가 `[id]` 만 읽고 `searchParams` 는 아예 안 읽는다** → 쿼리를 뭘 붙여도 카드 동일. **UTM 은 시도된 적조차 없었음**(`-S utm_source` 이력 0건).
- **검증 (실물)**: 실제 물품 `pLbCL2HyXtnJszgGL0HD`("PING 풀셋트 골프채")로 —
  ① 깨끗한 URL vs UTM URL → **HTTP 200 / og·twitter 태그 11개 전부 동일**, 카드 제목·이미지 살아있음 (facebookexternalhit UA 로 크롤)
  ② **딥링크 파서 6/6 통과** (`App.js:375` 의 `[^?/\s]+` 가 `?` 앞에서 끊어 UTM 무시) — id 20자 온전, apex/www·`?col=candidates` 병행 모두 정상
- **⚠️ 함정 회피**: `new URL().searchParams` **쓰면 안 됨** — RN 0.81 의 URL 은 `searchParams` 가 없고 폴리필 미설치(앱 내 사용 전례 **0건**). 썼으면 **조용히 아무것도 안 붙었을 것**. 문자열로 직접 부착함.
- **배포**: `chao-vn-app` **`454d073`** → **OTA 완료** (production / rv 2.4.3 / update group `b29f65eb`) · `daily-news-final` **`588231e`** → Vercel
- **다음 단계**: ① **1주 뒤 리포트에서 "직접 방문 44%"가 줄고 "카톡 공유"가 뜨는지 확인** — 사장님 카톡 가설의 최종 판정 ② 웹 공유(`vnkorlife-web/src/components/detail/ShareSection.tsx:32-40` 링크복사/페북/Zalo)에는 **아직 UTM 미부착** — 필요 시 동일 적용 ③ 직원이 카톡에 올릴 때 앱 공유버튼을 써야 이름표가 붙음(웹 관리자에서 복사하면 안 붙음)
- **관련 파일**: [utils/deepLinkUtils.js](utils/deepLinkUtils.js) · `daily-news-final/lib/ga4-channels-report.js`

---

## 2026-07-17 (오후) — 📧🔥 [측정] 이메일 유입이 리포트에서 1/10 로 축소돼 보이던 문제 해결 — 범인은 SendGrid

- **한 일**: 주간 리포트가 이메일을 **245 세션/주**로 보고했으나 실제는 **2,611 세션/주(10.7배)**. 그 탓에 최대급 채널인 데일리 뉴스레터가 "기타"에 숨어 *"유입의 66%가 정체불명"* 이라는 잘못된 그림이 나왔다. 원인 2가지:
  ① **SendGrid 계정 기본값 `ganalytics` 가 우리 UTM 을 덮어씀** — `addUtmToHtml` 이 붙인 `utm_source=email&utm_medium=newsletter` 를 발송 직전 `utm_source=sendgrid.com&utm_medium=email` 로 갈아버림 → GA4 가 뉴스레터를 "sendgrid.com 에서 온 손님"으로 분류.
  ② `ga4-channels-report.js:11-22` `bucket()` 에 **email/sendgrid 규칙 자체가 없음** → 둘 다 `기타` 로 falls through.
- **확정 근거 (GA4 실측 28일)**: sendgrid.com 7,861 + email 1,010 세션. medium 이 `referral` 아닌 **`email`** = SendGrid ganalytics 의 서명. **★결정적: 이메일 미발송일인 일요일에 sendgrid 유입만 콕 집어 소멸 — 일요일 평균 11 vs 그 외 329 (30배).** 구글·네이버는 그대로라 교란변수 아님(앞선 "일요일=이메일 증거" 헛발질을 이번엔 변수 분리로 해소). landingPage 도 일치: `/daily-news-terminal` 2,487 · **`/go/app` 1,575** · 개별기사 다수.
- **수정**: `lib/email-service.js` `sgMail.send()` 에 `trackingSettings` 명시(`ganalytics:false`, `clickTracking:false`) · `lib/ga4-channels-report.js` `bucket()` 에 `이메일` 규칙 추가(google 규칙보다 **먼저**) + 오분류 1건(`google-play` → `구글 검색` 으로 잘못 집계 → `구글플레이(앱)` 분리).
- **배포**: `daily-news-final` **`b66ad96` push 완료** → Vercel 자동배포. 리포트 실행 경로 = **GitHub Actions `.github/workflows/weekly-report.yml`(월 02:00 UTC) → Vercel `/api/cron/weekly-report` → `fetchChannelBreakdown()`** 이므로 **다음 월요일 리포트부터 반영**. (vercel.json cron 에는 weekly-report 없음 — Actions 가 curl 하는 구조)
- **검증 (라이브 GA4, 최근 7일 12,421 세션)**: 이메일 **0 → 2,611(21%, 2위 · 구글검색 2,090보다 큼)** · 기타 **3,001 → 390(-87%)** · 구글플레이 0 → 160.
- **★ 사장님 가설 3개가 전부 데이터로 확인됨 (내가 3번 다 틀림)**:
  | 사장님 말씀 | 실측 |
  |---|---|
  | "이메일은 주로 PC로 연다" | 이메일 유입 **desktop 78.5% / mobile 21.5%** ✅ |
  | "유입 최대 창구는 이메일" | **주 2,611 = 2위, 구글보다 큼** ✅ |
  | "카톡이 앱으로 가는 깔때기" | 직접방문 **모바일 13,598 / PC 5,806** (2.3배) — 정황 강함 |
- **⚠️ 용어 주의**: `deviceCategory=mobile` 은 **"휴대폰"이지 "앱"이 아님**. 앱/웹 구분은 `platform`(web/Android/iOS). 실측: **web×mobile 21,954 세션(폰 브라우저로 웹)** vs **Android(앱) 3,325**. 뉴스 터미널은 `platform=web` **100%**(앱 0).
- **규모 비교 (28일)**: 웹 뉴스터미널 PC 2,940명 / **모바일 2,641명** vs **앱 뉴스메인 701명**. → 폰으로 *웹* 뉴스 보는 사람이 앱보다 **3.8배**. iOS 는 `platform` 에 행 자체가 없음(측정 꺼짐).
- **다음 단계**: ① **직접방문 5,489(44%)가 여전히 최대 미스터리** — 모바일 편중이라 카톡 유력. 공유링크 UTM(`deepLinkUtils.js:62-68`)이면 판별됨 ② 뉴스 터미널 레이아웃 개편(모바일 1열 60장 = 22화면 스크롤) ③ `jenny-daily-news.php:2670` **CSS 버그** — `!important` 가 미디어쿼리를 이겨 태블릿 2열 규칙이 죽어있음 ④ 잔여 `기타 390` 중 `juso*.com` 약 240 = 레퍼러 스팸 의심, `chaovietnam.co.kr` 자기출처 57 = 크로스도메인 미설정
- **관련 파일**: `daily-news-final/lib/email-service.js` · `daily-news-final/lib/ga4-channels-report.js` · `daily-news-final/.github/workflows/weekly-report.yml`

---

## 2026-07-17 — 📖🔍 [매거진/전략] 홈 섹션 복구 OTA + "앱 전면개편" 근거조사 → 계측 먼저로 방향전환

- **발단**: 앱 전면 디자인 개편(emart 참고) 요청 → emart식 홈 목업 제작 → **"혼잡하고 길을 잃겠다"** 판단. 원인은 6개 서비스를 홈에 동등 나열(= 우선순위 결정 안 함). "사용자가 우리를 찾는 이유"를 근거로 다시 짜기 위해 실측 데이터(GA4 주간리포트·SendGrid·카톡방 인원) + 코드 조사.
- **✅ 배포한 것 — 매거진 홈 섹션 복구** (`services/wordpressApi.js`): 홈 칼럼 섹션에 글이 **1편만** 뜨던 문제(2x2 그리드 4칸 중 1칸). 원인 3중:
  ① 칼럼 섹션이 `382`(CHAO COLUMN, 107편)를 가리킴 — 본체는 `13`(컬럼, 하위25개 **1,230편**). 둘은 부모-자식이 아닌 별개 최상위라 자동병합 안 됨 → `id:13 + extraIds:[382]`. 라이프도 자식 `29`(TRAVEL 144편)→부모 `7`(784편).
  ② `getAllCategories` **per_page:100 이 카테고리 138개를 절단** — 2페이지의 컬럼 하위 12개(에디터컬럼 126편·부동산칼럼 등)가 앱에서 조회 불가. WP는 per_page>100 을 **400 거부** → 페이지네이션 필수.
  ③ **3개월 필터가 매거진에도 적용** — 뉴스 코드 상속. 칼럼/국제학교/비자/계약 정보는 수년 전 글도 유효. 24년 자산이 3개월 창으로만 보이던 원인.
  → 라이브 API 검증: **9개 섹션 전부 4/4 충족**(기존 칼럼1·골프1·F&R3 미달). 칼럼 우물 **107→1,275편**.
- **배포**: 앱 **OTA 완료** — `production` 채널 / rv **2.4.3** / iOS+Android / 커밋 **`e18fcaf`** / update group `1fd3b52a`. (OTA 자가점검 3항목 통과: 새 의존성 0, package.json 무변경, rv 일치)
- **🗂️ PROGRESS_BUILD_PENDING.md 삭제 → 이 파일 맨 위로 흡수**: 그 파일이 "마지막 운영빌드 2.4.2(5/21)"라 적고 있었으나 **실제로는 2.4.3 production 빌드가 iOS(build#74)·Android(#108) 양쪽 2026-06-25 완료**돼 있었고 OTA도 계속 rv2.4.3 로 나가는 중이었음 — **낡은 표를 믿었으면 오늘 멀쩡한 배포를 취소할 뻔함**. 10번이나 갱신했는데도 틀렸다 = 부지런함이 아니라 **구조** 문제. → 기계가 아는 것(빌드 현황표)은 버리고 `eas build:list` 로 대체, 기계가 모르는 것(미빌드 네이티브 2건)만 **맨 위 고정 블록**으로 남김. 168줄 → 12줄. `CLAUDE.md`/`AGENTS.md`/`GEMINI.md` 참조도 수정(+ 사라질 뻔한 안전규칙 2개 — "새 모듈은 단일 wrapper 경유", "부팅 경로 주의 = 전 사용자 crash" — 를 CLAUDE.md 로 이관).
- **🔍 조사 결론 — 개편은 근거 확보 후**: 유입의 **66%(직접 4,705 + 기타 2,692 세션)가 이름표 없이 뭉쳐** 있어 어느 채널이 앱설치를 만드는지 증명 불가. "카톡이 최대 무기" 가설도 "이메일이 주력" 가설도 현 계측으론 판별 못 함. → **계측 복구 먼저**. 상세 계획: `~/.claude/plans/ancient-launching-balloon.md`
- **확인된 사실**: 웹 8,652 / Android 452 / **iOS 0(측정불가 — 빌드 홀딩, 실제 로그인 ~100명)** · 구글 유입 상위어 = 태풍·날씨·ios 26.5.2·월드컵(교민 아님), 9,134명 중 앱설치 **56명(0.6%)** · **앱 내 매거진열람 514 vs 뉴스읽음 67**(잡지가 뉴스보다 7.7배 읽힘 — 10%만 열어놓고 낸 성적) · SendGrid 클릭 21,866 **> 웹 전체 세션 11,071 = 물리적 불가 → 대부분 보안스캐너 봇** · 카톡방 990명(구인구직470/당근314/부동산206) · 딥링크(App Links/Universal Links) **정상 작동**(`.well-known/*` 200 확인)
- **반증된 것**(재헛짚 방지): ~~주간리포트 안 돔~~(매주 정상) · ~~카톡 클릭 0~~(유입 있음, UTM 없어 안 보일 뿐) · ~~딥링크 인증파일 부재~~(있고 작동) · ~~일요일 급락=이메일 증거~~(그날 뉴스도 발행 안 함=교란변수) · ~~e-service=별도 발송경로~~(**SendGrid 내부 라벨**, `email-service.js:257`)
- **다음 단계**: ① **B-1 주간리포트에 `deviceCategory` 추가** ⭐ — "이메일은 PC로 열어 앱 설치 안 함" 관찰의 참·거짓이 다음 월요일 판가름. **앱설치 8,000명 전략의 축.** ② A-3 `ga4-channels-report.js:11-22` bucket()에 **email 규칙 없음**(email→기타로 falls through) ③ B-2 공유링크 UTM(`deepLinkUtils.js:62-68`, 카톡 미리보기 카드 시험 필수) ④ A-4/A-5 모바일 설치버튼이 `&referrer=` 버림 + 2.5초 정지 ⑤ B-4 웹 물품페이지 이벤트 0개(`contact_gate_hit`이 전환의 심장) ⑥ A-6 viewCount가 당근에만 기록(인기매물 푸시가 사실상 당근 전용)
- **⛔ 손대지 말 것(사업판단 영역)**: 카톡 메시지의 **판매자 전화번호 노출**(`deepLinkUtils.js:167-174`) — 빼면 앱설치엔 유리하나 판매자 거래가 느려져 **990명짜리 유일한 모바일 자산**이 위태로움.
- **관련 파일/문서**: [services/wordpressApi.js](services/wordpressApi.js) · [CLAUDE.md](CLAUDE.md)(빌드/OTA 규칙) · [PROGRESS_MEASUREMENT_INFRA.md](PROGRESS_MEASUREMENT_INFRA.md) · `~/.claude/plans/ancient-launching-balloon.md`

---

## 2026-07-08 (오후) — 💰📊 [제휴/광고] 기존기사 제휴블록 backfill + AdSense 현황 점검·조언

- **제휴 backfill**: 이미 발행된 기사(검색유입 자산)에 추천 블록을 소급 추가하는 스크립트 작성·실행. `scripts/backfill-affiliate-block.js` — WP REST 최신글부터, 본문에 `/go/` 있으면 skip(중복방지), 재개(커서)·속도제한(200ms)·DRY/LIMIT. 첫 100개 검증(블록 12/12 확인) 후 **전체(~2.5만) 백그라운드 실행 중.** 카테고리 REST 미노출이라 기본조합(알리+타오바오), src=archive. 커밋 **`3fdfcb7`**.
- **AdSense 현황 점검(사이트 직접 크롤 확인)**:
  - **chaovietnam.co.kr = 승인·서빙 중** (코드·ads.txt OK, 자동광고 작동). 수익 지난7일 **$16.09**, 페이지RPM $1.74, CTR 1.09%, **조회가능 46.6%(낮음)**, 페이지뷰 9,270/주. 며칠 전부터 서빙 본격 시작(이전 7일 ≈$0).
  - **vnkorlife.com = 승인 대기(준비중)** — 코드·ads.txt 됐으니 그냥 대기.
  - 만든 수동 광고유닛 5개는 **사이트 미배치**(자동광고가 대신 서빙).
- **사장님 문의 대응(조언)**: ① 앵커광고 ON(조회율↑ 핵심) + 페이지당 광고수 12→중간 ② 크롤러 액세스·제3자 플랫폼 = **불필요(스킵)** ③ 자동광고 형식(인페이지/오버레이/인텐트) **공존 가능** ④ **네이버블로그·페북엔 AdSense 삽입 불가**(폐쇄 플랫폼) → 외부=유입통로, 내 사이트=수익지.
- **배포**: daily-news-final `3fdfcb7`(backfill 스크립트). AdSense는 대시보드 설정(코드 변경 없음).
- **상태**: ✅ AdSense 사실상 완료(앵커 튜닝만 사장님 손). 제휴 backfill 진행 중.
- **다음 단계**: 3~4일 익힌 뒤 결과 확인 — Shopee 승인 / AdSense 조회율(46%→?) / SEO 유입 / 제휴 클릭. **그다음 챕터 = 트래픽**(고단가 주제 비자·환율·부동산 콘텐츠 + 페북/네이버 유입). 시작 전 메인 깔때기 점검.
- **관련 파일**: daily-news-final `scripts/backfill-affiliate-block.js`

## 2026-07-08 — 💰 [제휴] 추천 블록 전체 기사 노출로 확대(2개씩)

- **배경**: 어제 배포한 제휴 블록이 여행·생활·문화 기사엔 붙고 하드뉴스(정치·경제·국제)엔 제외됐음(설계). 확인 결과 정상 작동 중. 사장님 방침 변경 — "기사 하단이라 방해 적고 구매 시에만 수익이니 **모든 기사에 2개씩** 붙이자".
- **한 일**: `lib/affiliate-block.js` — 하드뉴스 제외 해제(Economy·Politics·International·Korea-Hot도 노출), `MAX_ITEMS=2`로 개수 고정. 카테고리 관련도 매칭은 유지(관련 낮으면 알리·타오바오 범용).
- **배포**: 웹(daily-news-final) push **`b31c3f9`** → Vercel. **새 발행 기사부터** 전 카테고리 2개씩. 기존 2.5만 기사는 미변경(원하면 backfill 스크립트 별도).
- **상태**: ✅ 배포. Pending 제휴 승인 대기(그냥 대기 → 승인 시 딥링크 받아 slug 추가). Shopee VN 검토 대기.
- **다음 단계**: (선택) 기존 기사 backfill, 이메일·앱 노출, /go 클릭 로깅 v2. Pending·Shopee 승인 처리.

## 2026-07-07 — 💰 [제휴] AccessTrade→Involve Asia 피벗 + 제휴 추적/추천 블록 착수·배포

- **배경**: 사장님 "accesstrade.vn에서 Shopee/Lazada 제휴 애드하자". 제휴 수익화(전략문서 [AFFILIATE_REVENUE_STRATEGY.md](marketing/AFFILIATE_REVENUE_STRATEGY.md) 2축) 착수.
- **AccessTrade 벽**: 개인 publisher 등록은 됐으나 **신원인증(eKYC)이 베트남 CCCD 전용** → 한국인(여권) 통과 불가. 외국인은 VNeID Level2 또는 회사법인 e-ID 필요. → **AccessTrade 보류.**
- **Involve Asia로 피벗**: 기존 계정(2026-06-07 세팅돼 있던 것) 발견 — **여권 KYC 통과(외국인 OK)** + Shinhan VN 은행 지급. 단 **카탈로그에 Shopee/Lazada "베트남"이 없음**(SG/ID/TH/MY/BR 등 타국만). 승인받은 것: **AliExpress·Taobao·Airalo·Udemy**(4개), 딥링크 검증(af=1089810). Pending: Traveloka VN·Olive Young·iHerb·Airalo Codes.
- **Shopee VN** = 자체 프로그램 `affiliate.shopee.vn` 등록(검토대기 ≤5일, **CCCD 벽 없이 등록 통과**). Lazada VN도 Involve엔 없음 → 추후 Lazada 자체 포털 검토.
- **구현·배포(daily-news-final)**: 범용 **`/go/<slug>` 추적 리다이렉트**(우리 링크로 한 겹 감싸 교체·측정 통제) + `lib/affiliate-links.js` 레지스트리 + `lib/affiliate-block.js`(기사 하단 "베트남 생활·쇼핑 추천" 큐레이션 블록, **하드뉴스 정치·국제·경제 제외**, `rel=nofollow sponsored` + 제휴 고지) + `publisher.js` 발행 시 첨부(try/catch). `next build` 통과.
- **배포**: 웹(daily-news-final) push **`0ba7a52`** → Vercel. **새 기사부터** 관련 카테고리에 추천 블록. 기존 2.5만 기사·앱 OTA 무관.
- **상태**: ✅ 착수·배포. AliExpress 등 4개 라이브. 수익화 첫 삽.
- **다음 단계**: ① Shopee VN 승인(younghan146@gmail 통보) → **지급 KYC 외국인 통과 여부** 확인 → 되면 레지스트리 slug 추가. ② Pending(Traveloka VN·Olive Young·iHerb) 승인 시 딥링크 채우기. ③ v2: `/go` 클릭 로깅(affiliate_clicks), 이메일·앱 노출, `chaovietnam.co.kr/go` 커스텀 도메인. ④ AccessTrade는 회사법인/VNeID 정리되면 재개.
- **관련 파일**: daily-news-final `app/go/[slug]/route.js` · `lib/affiliate-links.js` · `lib/affiliate-block.js` · `lib/publisher.js`

## 2026-07-07 — 📊 [뉴스] 관리자 알림 전수점검 + 주간리포트 이중화 + SEO 검색어 활용 복구

- **배경**: 사장님 3가지 — ① "관리자 메일로 오기로 한 알림들이 안 온다"(Firebase까지 전수조사 요청) ② "주간 analytics 보고서가 안 온다" ③ "네이버·구글 검색어를 뉴스 제목에 활용하는 게 어떻게 되나".
- **① 관리자 알림 전수조사(5개 저장소+Firebase)**: 앱/Firebase엔 **이메일 발송 코드가 전무** — 새 당근/구인/부동산 등록은 Cloud Function이 **푸시+앱내알림만**(이메일 아님). 실측 로그: `younghan146@gmail.com`은 정상 도달, `info@chaovietnam.co.kr`은 **앱 로그인 유저문서가 없어** `⚠️ 관리자 계정 없음`으로 아무것도 안 감. 광고문의는 GAS→구글시트만(이메일X, CRM 30초폴링 배너로만 인지). 구직자등록은 관리자알림 자체가 없음. `notifyAdmins`(utils/adminNotify.js)는 **죽은 코드**(호출처 없음). → 이메일로 오는 건 daily-news `notify-application`(옐로신청)·jobs-crm BCC뿐.
- **② 주간 측정 리포트**: 실은 **Vercel 크론(`0 2 * * 1`)이 정상 작동**했고 사장님이 07-06 메일을 못 본 것(수동 트리거로 발송 확인 `sent:2`). 안정성 위해 **GitHub Action(`weekly-report.yml`)으로 이중화** + Vercel 중복 크론 제거. 숫자 미스터리(07-06 vs 07-07 상이)=집계창이 "최근7일(어제까지)"라 하루 밀리면 데이터 이동 + GSC 지연확정 → 정상.
- **③ SEO 검색어 활용 복구 (핵심)**: 진단 결과 **제목 생성은 잘 됐으나(키워드-포워드)**, LLM이 만든 `seoKeywords`·포커스키워드가 **발행 때 통째로 버려지고** 있었음. 조치:
  - **Fix A**: `publisher.js`가 발행 시 `rank_math_focus_keyword = matchedKeyword`(이미 DB에 있던 값) 세팅 → 새 기사부터 RankMath 목표검색어 확보. 스키마 변경 없음.
  - **Phase C**: 구글 **서치콘솔 실유입 검색어**를 주간 수집→키워드 풀 **최우선**(GSC→네이버→baseline) 반영. `scripts/fetch-gsc-keywords.js` + `weekly-keywords.yml`에 GSC 단계 추가(자격증명 없으면 우아하게 skip). 활성화 위해 GitHub Secret `FIREBASE_SERVICE_ACCOUNT_JSON` 추가 + 서치콘솔 사용자에 서비스계정(이미 됨) — **완료·가동 확인**.
  - **잡음 필터**: 20년 사이트라 GSC에 "축구·월드컵미국·중국비행기충돌" 등 베트남 무관어가 대량 유입 → `isVietnamRelated` 게이트 추가. 재실행 후 **클린데이터 확인**(교민·한인·비자·부동산 검색어만 남음).
- **배포**: daily-news-final push — `ded678c`(리포트 이관) · `139c484`(Fix A) · `c814eab`(Phase C) · `0f5b431`(GSC 필터), 봇 자동커밋 `7e41340`(클린 키워드). **웹만, 앱 OTA 무관.** 리포트 워크플로우 #4 Success.
- **상태**: ✅ 완료·가동. 매주 월요일 네이버+GSC 자동수집→커밋→Vercel배포, 주간리포트 자동발송(GitHub 이중화).
- **다음 단계**: (2~3주 뒤) 서치콘솔로 Fix A+C 효과 측정 후 **Phase B**(seoKeywords→WP 태그 발행, noindex 정책 결정)  판단. info@ 앱알림 필요하면 ADMIN_EMAILS 단일화 or info@ 앱로그인. 옛 기사가 "축구" 등으로 상위노출되는 SEO 잡음 정리도 백로그.
- **관련 파일**: `daily-news-final/lib/publisher.js`, `lib/popular-keywords.js`, `scripts/fetch-gsc-keywords.js`, `.github/workflows/weekly-report.yml`·`weekly-keywords.yml`

## 2026-07-06 — 🧹 [저장소] 5개 워크스페이스 git 정리 + 시크릿 규칙 문서화

- **배경**: 사장님 질문 — VSCode 탐색기 폴더 옆 동그란 점이 "git 미반영"인가. 확인 결과 **커밋·푸시는 정상**이었고, `.tmp/`·firebase 캐시·로그·대용량 PDF가 `.gitignore`에 빠져 정크가 영구히 미추적으로 남아 점이 안 사라진 것.
- **한 일**:
  - chao-vn-app·vnkorlife-web `.gitignore` 보강(`.tmp/`, `.firebase/*.cache`, `*.local.bak`, 561_yellowpage*.pdf, `.claude/`, `.tmp_dev.log`). 이미 추적 중이던 firebase 캐시는 `git rm --cached`로 추적해제.
  - 진짜 작업물만 커밋: 옐로페이지 directives·scripts, go/start 리다이렉트(chao-vn-app) / market-size-dryrun(jobs-crm).
  - **시크릿 규칙 문서화**: CLAUDE·AGENTS·GEMINI.md에 "🔐 Secrets / API Keys" 섹션 추가 — 정본 백업 위치 `OneDrive\dev-secrets\`, 커밋 금지·키 회전 규칙. 모든 AI 숙지 대상.
- **배포**: push 완료 — chao-vn-app `06fa1c1`, vnkorlife-web `9b8ccd7`(원격 rebase 후), jobs-crm `cb10088`. 5개 폴더 전부 미커밋 0·미푸시 0.
- **상태**: ✅ 완료
- **다음 단계**: 없음 (사장님이 새 시크릿 만들 때 dev-secrets 백업 동기화만 유지)

## 2026-07-03 — 🎯 [뉴스] 크롤 단계 인기검색어 관련도 점수화 + 키워드-포워드 발행

- **배경**: 사장님 문제의식 — "크롤링할 때부터 한국인이 검색하는 키워드 기준으로 뉴스를 우선 선정하면 관심 유도가 커진다". 확인 결과 현재 파이프라인은 *선별 단계가 아예 없었고*(새 기사 전부 번역·저장), 키워드는 번역 시 제목에만 쓰였음. 무거운 본문번역+WP발행은 **편집자가 고른 것만** 도는 구조(선택 관문 존재).
- **결정(리드)**: 필터 아닌 **가점**으로. 점수 0도 전부 발행(SEO 롱테일·정보균형 보존), 관리자 후보목록만 점수순 정렬 → 편집자가 명당자리(카드/탑뉴스)를 키워드순으로 고르는 **휴먼-인-루프** 유지. 사장님 추가자료(꿀통 주제·제목/본문 키워드) 반영하되 낚시("!"·"총정리")·블로그재작성은 24년 뉴스 브랜드 문체와 충돌해 제외.
- **한 일**:
  - `translateAndCategorize`에 `keywordScore`(0~3)+`matchedKeyword` 산출(구조화 출력). 비자·세금·부동산규제·법인·법률·생활트렌드 등 高관여 '꿀통' 주제 최우선 3점.
  - `translateFullArticle`: 제목 앞쪽 **키워드-포워드** + 본문 검색어 **2~3회 자연삽입**(스터핑·과장 금지, 기사문체 가드레일 보존).
  - `NewsItem`에 컬럼 2개 추가(nullable) → **Neon db push 완료**. 크롤 저장부·관리자 후보목록 정렬+🔥배지.
  - **탑뉴스 선정 화면**에도 🔥배지 + **👍 추천 탑뉴스**(선정분 최고점≥2, 아직 탑뉴스 아닌 것) 추가 — 하루 1건 탑뉴스가 카드·SNS·이메일로 통일 발행되는 핵심 결정을 그 자리에서 돕게. **자동선정은 편집자 권한 침해라 배제**(정렬·추천까지만).
- **실측(Claude Sonnet, 프로덕션 동일)**: 환율/다낭/하노이아파트=3, 브라질축구=0, 까마우사고=1, 비자기사=3(매칭'베트남 비자')+제목"베트남 호찌민, 2026년부터 외국인 출입국 절차 간소화"(낚시 없음)+본문 비자·출입국·체류 자연삽입. `npm run build` 54/54 통과.
- **배포**: 웹(daily-news-final) push **`6b3e615`**(코어) + **`6ddd225`**(선정화면 배지·추천) → Vercel. **백엔드/관리자 UI, 앱 OTA 무관.**
- **상태**: ✅ Phase 1 완료·배포. 다음 크롤부터 점수 축적 시작.
- **다음 단계**: (Phase 2, 점수 쌓인 뒤) 자동 명당자리 — 앱 피드/이메일 상단/푸시가 점수 자동 참고. 실측 후 "어떤 검색어 주제가 실제 클릭을 부르나" 루프 닫기(네이버 주간조사 ↔ 성과). 한국어 소스(연합 등)는 번역 스킵이라 점수 0 기본값 — 필요 시 별도 기본가점 검토.
- **관련 파일**: `daily-news-final/lib/translator.js`, `lib/crawler-service.js`, `prisma/schema.prisma`, `app/admin/page.js`, `app/admin/collected-news-list.js`

---

## 2026-07-03 — 🧹 [정리] iOS analytics 변경 커밋(빌드 누락방지) + AI 도우미 '추천 상담원' 개선

- **배경**: WORKLOG 며칠분 리뷰로 미완항목 점검. 결과 — 대부분 정리됨/의도적 대기.
- **① iOS analytics 커밋**: `app.json`·`GoogleService-Info.plist`(IS_ANALYTICS_ENABLED true, FIREBASE_ANALYTICS_COLLECTION_ENABLED true)가 **미커밋으로 방치**(2.4.3 빌드서 누락된 항목) → **커밋**(`4e78d3a`)해 다음 빌드 자동포함. `PROGRESS_BUILD_PENDING.md`도 "커밋됨"으로 갱신. **iOS 빌드 자체는 의도적 대기**(안드로이드와 함께 심사받을 기능 모일 때까지).
- **② AI 검색 도우미 개선**: 단순 나열 → **평점 추천 상담원**. (a) 제일 나은 곳 먼저 추천+이유 한 줄, (b) "한 걸음 더"로 안 물은 유용정보 하나 곁들여 재방문 유도, (c) **정직 규칙 강화**(도구가 준 사실만, 지어내기 금지). 프롬프트만 변경. 라이브 검증: "호치민2군 한식당"→목구멍타오디엔(★5.0) 먼저 추천+이유+대안2+밀집지역 팁. 잘 작동.
- **확인된 것(리뷰 결과)**: 푸시500자=이미 커밋(`69f94f6`, 배포≠커밋 개념 설명) · 사이트맵 no-cache=오늘 감시 통과 검증 · vnkorlife AdSense=승인됨(사장님이 광고배치 검토 예정).
- **배포**: 웹(daily-news-final) push **`e3332ca`**(도우미) → Vercel. 앱repo push `4e78d3a`+`8b07d95`(커밋만, 빌드/OTA 아님). 앱 OTA 무관.
- **상태**: ✅ 완료.
- **다음 단계**: (선택) AdSense 광고배치(사장님 주도), iOS 빌드는 기능 모일 때, 도우미 다국어(en/vi).
- **관련 파일**: `daily-news-final/app/api/assistant/route.js`, `app.json`, `GoogleService-Info.plist`, `PROGRESS_BUILD_PENDING.md`

---

## 2026-07-03 — 🌐 [측정] 주간 리포트에 유입 채널별(구글/네이버/직접/SNS) 추가 — 네이버 실적 자동측정

- **한 일**: "네이버는?" 질문 대응. 네이버는 **검색노출 API를 안 줌**(서치어드바이저 대시보드 전용) → 대신 **GA4로 "네이버가 보낸 실제 방문"** 을 잡아 구글·직접 등과 함께 주간 리포트에 표시. 네이버 등록·사이트맵·인증메타는 이미 정상(기반 완비).
- **설계**: `lib/ga4-channels-report.js` — `sessionSource`를 버킷(구글검색/네이버/직접/SNS/다음카카오/기타)으로 묶어 이번주 vs 전주. `ga4-report.js`의 `runReport` export 재사용. route에 채널+서치콘솔 두 섹션 개별 try/catch로 append.
- **실측(최근7일, 총 11,199세션)**: 직접 42%(▼13) · 기타 22% · **구글검색 19%(▼35)** · **네이버 15%(▲24)** · SNS 1% … → **네이버가 실제 유의미 채널이며 증가 중**(구글은 이번주 감소). 검색엔진(구글+네이버)=약 34%, 직접(충성/앱)=42%.
- **배포**: 웹(daily-news-final) push **`9259e19`** → Vercel. build 통과.
- **상태**: ✅ 완료·배포. 다음 월요일 이메일부터 채널표 자동 포함.
- **다음 단계**: (선택) "기타 22%" 정체 파악, 네이버 검색어·순위는 월1회 서치어드바이저 대시보드 수동확인.
- **관련 파일**: `daily-news-final/lib/ga4-channels-report.js`, `lib/ga4-report.js`, `app/api/cron/weekly-report/route.js`

---

## 2026-07-03 — 📊 [측정] 주간 리포트에 구글 검색노출(서치콘솔) 섹션 추가 (✅ SA 권한부여 완료·데이터 확인)

- **한 일**: "일부러 안 찾아도 SEO 상황이 굴러 들어오게" — 이미 매주 월 09:00(VN) 자동발송되는 **주간 측정 이메일**(GA4 트래픽 기반, `weekly-report` 크론)에 **구글 검색노출 섹션**을 얹음. 노출수·클릭·CTR·평균순위(WoW 증감) + 상위 검색어 표.
- **설계**: `lib/search-console-report.js` — GA4와 **동일 서비스계정**(Firebase Admin, `FIREBASE_SERVICE_ACCOUNT_JSON`) 재사용, 스코프만 `webmasters.readonly`. 접근가능 속성에서 chaovietnam 자동선택. **미연결이면 "연결 대기" 안내로 폴백**(전체 리포트 안 죽음). Search Analytics API 최근7일 vs 이전7일(3일 지연 반영).
- **검증**: 모듈 우아한 폴백 확인(현재 `sites.list 403`=SA 미등록, 정상 예상), 인증 자체는 성공, `npm run build` 통과.
- **배포**: 웹(daily-news-final) push **`942796d`** → Vercel. 크론 기존 스케줄 그대로.
- **상태**: 🟡 코드 배포 완료. **1회 설정 대기(사장님)**: ① 서치콘솔에 서비스계정 추가 ② GCP Search Console API 사용설정.
- **다음 단계**: 1) 서치콘솔 → 설정 → 사용자 및 권한 → `firebase-adminsdk-fbsvc@chaovietnam-login.iam.gserviceaccount.com` 추가. 2) GCP(chaovietnam-login) "Google Search Console API" Enable. 3) 완료 후 `?test=1` 미리보기로 데이터 확인 → 다음 월요일부터 자동 포함.
- **관련 파일**: `daily-news-final/lib/search-console-report.js`, `app/api/cron/weekly-report/route.js`

---

## 2026-07-03 — 🔍 [SEO] 발행 시 Rank Math SEO 설명 자동 세팅 + 기존글 백필 (🟡 mu-plugin FTP 대기)

- **한 일**: WP(chaovietnam.co.kr, Rank Math) 글들의 SEO 설명을 통제·최적화. 실측 결과 Rank Math 폴백은 작동하나 ① SEO 설명이 명시 세팅 안 됨(통제불가) ② **소셜공유(og:description)가 "출처: … 날짜: …"로 시작**해 실제 뉴스가 밀림.
- **핵심 발견**: Rank Math 메타가 **WP REST에 미노출** → 발행 코드가 SEO 메타를 직접 못 씀. → 작은 mu-plugin으로 열어줘야 함.
- **만든 것**: ① `wordpress-plugin/mu-plugins/rankmath-rest-meta.php`(rank_math_title/description/focus_keyword를 REST 노출, edit_posts 제한) ② `lib/publisher.js` 발행 시 **rank_math_description=깔끔요약(~160자)** 세팅(제목은 좋은 템플릿 유지). ③ `scripts/backfill-seo-meta.js` 기존글 백필(재개·청크, `npm run backfill-seo`).
- **검증**: buildDesc 출처군더더기 제거·길이컷 로컬확인, `npm run build` 통과. **배포 안전성**: mu-plugin 미업로드 시 세팅값 무시(무해)라 코드 선배포 OK.
- **실측 검증(1차 업로드 후)**: rank_math_description → **구글 meta description 반영 확인(센티넬 추적 ✅)**. 단 **og:description(소셜)은 미반영** — Rank Math가 og는 본문 앞에서 자동생성("출처…" 딸림). → mu-plugin v1.1에 `rank_math/opengraph/{facebook,twitter}/description` 필터 추가해 og도 rank_math_description 쓰게 강제. **한 필드로 구글+소셜 동시 해결**(publisher/백필 코드 불변).
- **배포**: 웹(daily-news-final) push **`6e16a12`**(코어) + **`128cc0d`**(mu-plugin v1.1 og필터) → Vercel. 백엔드/스크립트 — 앱 OTA 무관.
- **최종 완료(실측)**: mu-plugin v1.1 업로드됨. og:description → Rank Math 값으로 정리 ✅. **테마 OG 중복** 발견 → Sahifa `Posts Settings → OG Meta = OFF`로 제거(이제 og 1개). **스키마 중복**도 발견 → 테마가 `Article`, Rank Math가 `NewsArticle` 이중출력 → 테마 `Structure Data → Enable = OFF`로 제거(이제 `NewsArticle` 하나). **뉴스 스키마는 Rank Math가 이미 NewsArticle 출력 중이었음**(새로 만들 필요 없었음).
- **백필**: `npm run backfill-seo` 최신 200개 검증 완료(199 세팅) → 전체(~2.5만) 백그라운드 진행 중.
- **상태**: ✅ SEO 코어 완료(발행자동화·og·스키마 정리). 🔄 기존글 백필 진행 중.
- **다음 단계**: 1) 백필 완료 확인(총 처리수). 2) (선택) Rank Math 브레드크럼 스키마 되살리기, 전역 제목템플릿·소셜이미지 점검. 3) 지식창고 [KNOWLEDGE.md](KNOWLEDGE.md)에 SEO/GEO/AEO·스키마 정리해둠.
- **📚 배운 것**: 「한 기능은 한 소스만」 — og·스키마는 테마+SEO플러그인이 이중출력 쉬움. SEO플러그인에 몰고 테마 쪽 끈다. → KNOWLEDGE.md 참조.
- **관련 파일**: `daily-news-final/wordpress-plugin/mu-plugins/rankmath-rest-meta.php`, `lib/publisher.js`, `scripts/backfill-seo-meta.js`

---

## 2026-07-03 — 🈳 [번역] 본문번역 rate limit 실패 근절 + 27건 복구 + 관리방안

- **한 일**: 크롤 뉴스 본문번역이 DRAFT에 "Translation Failed"로 눌러앉는 문제(165개 중 27개=16%) 근본 해결.
- **원인(2단)**: ① 무거운 본문번역을 **10개 동시** 호출 → rate limit(429), 3회 선형 재시도로 못 뚫음. ② 실패를 3필드 채워 "완료"로 저장 → 배치 재번역이 "이미 완료"로 **영구 스킵** → 자동복구 불가로 쌓임.
- **수정(3층 방어)**: ① **예방** — 동시 10→5, 배치간 200→1000ms, 재시도 3→5회 **지수백오프+지터+429 Retry-After 준수**. ② **자동복구** — 실패는 저장 안 하고 **PENDING 복귀**(다음 번역 때 자동 재시도), 스킵조건서 실패마커 제외. ③ **수동정리** — `npm run retry-failed` 재사용 복구도구.
- **검증**: 헬퍼 5/5·백오프·눌러앉은 4/4 재번역 성공 로컬확인 → `npm run retry-failed` 실행 **27/27 전부 복구**, 전체 DB 실패 **0건**. `npm run build` 통과.
- **곁다리 확인**: 사장님 직감으로 점검한 **Structured Outputs(JSON 수정)는 정상 작동 중**(sonnet-4-6도 output_config 강제됨). 이번 실패와는 무관한 별개 문제였음.
- **배포**: 웹(daily-news-final) push `a4bc7b6`(코어수정)+`531cc1d`(복구도구·문서) → Vercel. **백엔드 전용, 앱 OTA 무관.**
- **상태**: ✅ 완료·배포·27건 복구 완료.
- **다음 단계**: (선택) `retry-failed`를 GitHub Actions 주1회 자동화(Secrets에 ANTHROPIC/DATABASE 필요). 하루 뒤 실패율 재확인.
- **관련 파일/문서**: `daily-news-final/lib/translator.js`, `app/api/batch-translate/route.js`, `app/admin/actions.js`, `scripts/retry-failed-translations.js`, `daily-news-final/docs/번역실패_관리방안.md`

---

## 2026-07-02 — 🗺️ [SEO] chaovietnam.co.kr 사이트맵 freeze 진단·해결 + 감시 자동화 (🔴 내일 SEO 이어가기)

- **한 일**: 매일 발행은 정상인데 **사이트맵이 6/15 이후 멈춰**(Rank Math 내부 캐시 고착) **6/16~오늘 약 2.5주치 기사가 사이트맵에서 누락** → 네이버·구글이 새 기사를 늦게 알던 문제 진단·해결.
  - **진단 근거**(REST/robots/canonical 다 확인): 발행 OK(오늘 #139061), 새 글 `index,follow`+canonical 정상 → **noindex 설정 문제 아님**. 순수 사이트맵 캐시 freeze.
  - **1차 조치**: Rank Math Sitemap Settings **저장**하면 캐시가 비워져 재생성됨(6/15→7/2 즉시 복구 확인). 태그 사이트맵은 켜지 말 것(빈용어·과다 → 크롤예산 낭비).
  - **영구 해결**: mu-plugin `rankmath-sitemap-nocache.php` (`add_filter('rank_math/sitemap/enable_caching','__return_false')`) → 서버 `wp-content/mu-plugins/` 에 **FTP 업로드 완료**. 캐시 자체를 꺼 freeze 원천 차단.
  - **감시 자동화**: `daily-news-final/.github/workflows/sitemap-monitor.yml`(매일 03:00 UTC) + `scripts/check-sitemap-freshness.js`. WP최신 vs 사이트맵최신 비교, 24h↑ 지연/36h↑ 발행중단 시 job실패→소유자 자동 이메일. **읽기전용(GET)** 이라 Wordfence 안 걸림.
  - **주의(발견)**: 앱비번 계정은 **새 글 생성=OK, 기존 글 수정=권한없음(rest_cannot_edit)**. 발행은 새 글 생성이라 무관. Rank Math 관리자 REST(`toolsAction`)는 앱비번으로 401(세션필요) → 캐시청소 자동화는 mu-plugin으로 우회함.
- **배포**: 웹(daily-news-final) push `b46cea4`(감시+mu-plugin 버전관리본) / mu-plugin 서버 FTP 반영. Vercel 무관(WordPress 측).
- **상태**: ✅ 사이트맵 현재 최신. ⏳ **no-cache 최종 증명은 내일 아침 배치 후 자동확인**(monitor가 판정).
- **🔴 다음(내일) 이어갈 것**:
  1. **내일 아침 배치 후** 사이트맵 즉시 최신인지 확인(monitor 자동 or 수동 Run workflow) → no-cache 검증 완료 처리.
  2. **SEO "Not Set" 대량 개선** — 2.5만 글 대부분 SEO 제목·메타설명 미설정. **수동 불가 → 자동화**: ① 발행 스크립트가 발행 시 Rank Math 메타(rank_math_title/description) 자동 세팅 ② 기존 글 백필. 실제 글 title/description 상태부터 점검 후 처방.
  3. 구글 서치콘솔·네이버 서치어드바이저 **색인현황** 판독(발견 단계는 뚫렸으니 실제 색인/랭킹 측정).
- **관련 파일/문서**: `daily-news-final/wordpress-plugin/mu-plugins/rankmath-sitemap-nocache.php`, `.github/workflows/sitemap-monitor.yml`, `scripts/check-sitemap-freshness.js`

---

## 2026-07-02 — 🤖 [SEO] 주간 인기검색어 수집 GitHub Actions 자동화 완료 (무인 운영)

- **한 일**: 앞 항목의 "주 1회 수동 실행"을 **GitHub Actions로 완전 자동화**. 매주 월요일 09:00 KST(cron `0 0 * * 1`) + 수동실행(workflow_dispatch)으로 `npm run keywords` 실행 → `lib/popular-keywords.generated.js` 갱신 → **변경 시에만 봇이 자동 커밋·푸시 → Vercel 자동배포**. 네이버 키 3개는 저장소 Secrets(`NAVER_SEARCHAD_*`)에 등록(암호화). 첫 수동 실행 **Success(49s)**, 봇 자동커밋 `6c67b21` 생성까지 **전체 파이프라인 검증 완료**.
- **참고**: 실행로그의 "Node.js 20 deprecated" 경고는 GitHub가 액션 런타임을 Node24로 옮기는 중이라는 **무해한 안내**(에러 아님). checkout/setup-node 차기 메이저 나오면 자연 소멸.
- **배포**: 웹(daily-news-final) push `d4f171c`(워크플로) + 봇 `6c67b21`(첫 자동갱신). 파일: `.github/workflows/weekly-keywords.yml`.
- **상태**: ✅ 완료·무인 운영 시작. 사장님 개입 불필요.
- **다음 단계**: 없음(정상 가동). 실패 시 GitHub이 저장소 주인에게 자동 이메일. 키 교체 시 Secrets만 갱신하면 됨.
- **관련 파일/문서**: `daily-news-final/.github/workflows/weekly-keywords.yml`, `scripts/fetch-popular-keywords.js`

---

## 2026-07-02 — 🔑 [SEO] 네이버 검색광고 API 키 연결 완료 — 실측 인기검색어 첫 수집·반영 (보류 해제)

- **한 일**: 앞선 "인기검색어 자연 반영" 항목의 **보류였던 네이버 검색광고 API 키 3개**(`NAVER_SEARCHAD_API_KEY`/`_SECRET`/`_CUSTOMER_ID`)를 daily-news-final 루트 `.env`에 넣고 첫 실측 수집 성공. 진행 중 두 가지 버그를 잡음: ① **CUSTOMER_ID 6→7자리** 오입력(403 auth-failed) ② **`keywordstool` hintKeywords 공백 400**(code 11001) → 스크립트에서 시드 공백 제거(`map(k=>k.replace(/\s+/g,''))`)로 해결. 결과 11개 카테고리 62개 키워드 수집(베트남환율 월 55.5만 등).
- **배포**: 웹(daily-news-final) push **`e3282aa`**(스크립트 공백수정 + `lib/popular-keywords.generated.js` 실측 데이터) → Vercel 자동배포. 백엔드 전용 — 앱 OTA 무관.
- **상태**: ✅ 완료·배포. 주간 실측 파이프라인 **가동 시작**(기본 풀 → 실측 병합).
- **다음 단계**: **주 1회** `npm run keywords` 실행 → `generated.js` 커밋 습관화(수동, 또는 cron/Actions 자동화는 선택). API 키는 `.env`에만 있고 gitignore됨 — 다른 PC에선 secrets 마스터(`OneDrive/dev-secrets/daily-news-final/.env`)에서 복사 필요.
- **관련 파일/문서**: `daily-news-final/scripts/fetch-popular-keywords.js`, `lib/popular-keywords.generated.js`

---

## 2026-07-02 — 💰 [웹] vnkorlife.com Google AdSense 스니펫 삽입 (사이트 승인/자동광고용)

- **한 일**: vnkorlife-web 루트 `app/layout.tsx` `<head>` 에 AdSense 로더 스크립트(`adsbygoogle.js`, `client=ca-pub-7944314901202352`) 추가. 원본은 순수 HTML `<script async>` 였으나, 기존 GA4 태그와 동일하게 **`next/script` + `strategy="afterInteractive"`** 로 감싸 페이지 속도 영향 최소화. 아직 개별 광고 슬롯(`<ins class="adsbygoogle">`)은 없음 — 승인/자동광고용 기본 코드 단계.
- **배포**: 웹 Vercel 자동배포 (커밋 `cc84857`, GitHub `young146/vnkorlife-web` main 푸시 완료)
- **상태**: ⏳ AdSense 콘솔 사이트 승인 심사 대기
- **다음 단계**: ① Vercel 배포 Ready + 프로덕션에서 `adsbygoogle.js` 로드 확인 ② AdSense 콘솔에서 vnkorlife.com 승인되면 자동광고 ON 또는 원하는 위치(목록 사이·상세페이지)에 개별 광고 단위 삽입
- **관련 파일/문서**: `vnkorlife-web/app/layout.tsx`

---

## 2026-07-02 — 🔑 [SEO] 번역 제목에 실제 인기 검색어 자연 반영 (기본풀 + 주간 실측 뼈대)

- **한 일**: 뉴스 번역 시 제목에 **실제 한국 독자 인기 검색어**가 자연스럽게 들어가도록 함. 기존 `seoKeywords`는 **모델이 상상해 만들고 저장도 안 되던** 값이라 헛돌던 걸, **카테고리별 인기검색어 풀**(`lib/popular-keywords.js`)을 만들어 제목번역 3경로(`translateTitle`·`translateAndCategorize`·`translateFullArticle`)에 주입. **자동 발행은 도입 안 함** — 기존 수작업 검수·발행 흐름 그대로 유지(사장님 요구).
- **설계(2층)**: ① **기본(baseline) 풀** = 손큐레이션 상시 인기검색어(무료·즉시). ② **주간 실측** = `scripts/fetch-popular-keywords.js`(`npm run keywords`)가 네이버 검색광고 API로 실제 검색량 조회→`lib/popular-keywords.generated.js` 갱신. **키 없으면 안전종료**, 기본 풀로 계속 동작. 병합 우선순위 주간→기본→폴백, 중복제거. **가드**: 자연스럽고 사실에 맞을 때만 삽입, 억지·낚시·키워드 스터핑 금지(애드센스 안전).
- **검증(실 Sonnet API)**: 환율 기사 → "베트남 **동 환율**, 이번 주도 큰 폭 변동" ✅ 자연 삽입 / 부동산·다낭 → 억지 안 되게 정확문구 미강제(가드 정상). 로컬 build 통과, 사이트 200.
- **기본 풀 보강**: 사장님 현장 검증 키워드 추가(환전·아파트임대·한달살기·과일·메트로·자동차가격·이사/해외이사·거주신고 등) → `09da47a`.
- **배포**: 웹(daily-news-final) push **`b446658`**+**`09da47a`** → Vercel 자동배포. 백엔드 전용 — **앱 OTA 무관**.
- **상태**: ✅ 완료·배포. **단, 주간 실측은 아직 꺼짐(기본 풀만 가동 중).**
- **⏭️ 다음 단계 (해야 함, 명기)**: **네이버 검색광고 API 키 3개**(`NAVER_SEARCHAD_API_KEY` / `NAVER_SEARCHAD_SECRET` / `NAVER_SEARCHAD_CUSTOMER_ID`)를 secrets `.env`(`OneDrive/dev-secrets/daily-news-final/.env`)에 넣고 → `npm run keywords` 1회 실행해 `popular-keywords.generated.js` 생성·커밋 → 이후 **주 1회 실행(수동 또는 cron/Actions 자동화)** 세팅. 이걸 해야 "최신 인기검색어" 반영이 켜짐. (선택) 반영 강도(보수↔적극) 조정.
- **관련 파일**: `daily-news-final/lib/popular-keywords.js`, `lib/popular-keywords.generated.js`, `scripts/fetch-popular-keywords.js`, `lib/translator.js`

---

## 2026-07-02 — 🔎 [검색] 카테고리 동의어 — "흔한 말"로 업소 누락 감소

- **한 일**: 통합검색(`daily-news-final/app/api/search/route.js`)에 **카테고리 동의어**(`CAT_SYNONYMS`) 추가. 자유검색이 `searchText`(상호·요약)만 훑어 상호에 그 단어가 없는 업소가 누락되던 문제 해결(예: "미용실"로 검색해도 상호가 "○○Hair"면 못 찾음). 흔한 말→옐로 카테고리 슬러그로 연결해 `category`도 OR 매칭.
- **설계(실측 기반)**: ① **옐로페이지만** 매핑 — 진출기업 카테고리는 산업 대분류(의료·제약 등)라 "치과→제약회사" 노이즈 → 제외. ② 일반어만, **세부과(치과)·잡동사니 통(service=수리·세탁 혼재)은 제외**(상호 텍스트가 더 정확). 실측: 미용실 +220 / 학원 +261 / 병원 +110 / 환전 +85곳 신규 매칭, 전부 도메인 일관(노이즈 0).
- **배포**: 웹(daily-news-final) push `f53ef66` → Vercel. **백엔드 전용 — 앱 변경·OTA 불필요**(앱은 그대로 q 보내면 결과만 좋아짐).
- **상태**: ✅ 완료·배포. 실 DB 6개 검색어 검증 완료.
- **다음 단계**: (선택) ① 오타 "이거 찾으셨나요?" 추천 칩(프론트 필요, 별개 작업). ② 오매칭 발견 시 `CAT_SYNONYMS`에서 해당 항목만 삭제.
- **관련 파일**: `daily-news-final/app/api/search/route.js`

---

## 2026-07-02 — 💰 [LLM 비용/안정성] AI 도우미 Haiku 전환 + 번역 JSON 실패 원천 차단

- **한 일**:
  ① **AI 검색 도우미 모델 Sonnet 4.6 → Haiku 4.5** (`daily-news-final/app/api/assistant/route.js`). 도우미는 도구 라우팅+요약이라 실앱 테스트 결과 품질 차이 없음. 토큰 비용 1/3($3/$15→$1/$5).
  ② **번역 JSON 파싱 실패 원천 차단** (`daily-news-final/lib/translator.js`). 기사체 큰따옴표(`"…라고 말했다"`)가 JSON 문자열을 깨서 `JSON.parse` 실패→"번역 실패" 사고. **Structured Outputs(`output_config.format` json_schema)** 로 전환해 API가 유효 JSON을 생성단계에서 보장. `callLLM`에 `schema` 파라미터 추가·번역 3함수 연결·OpenAI 폴백도 json_schema.
  - 실측(실기사 5건 A/B): **Sonnet 성공률 40%→100%**, 재시도 소거로 평균 18~22s→**10s**. 번역 모델은 **Sonnet 유지**(정확도 우선).
- **배포**: 웹(daily-news-final) push → Vercel 자동배포. ①`f98b9f3` ②`eadb215`. (둘 다 백엔드라 앱 OTA 무관)
- **상태**: ✅ 완료·배포. 도우미 실앱 확인 완료, 번역 A/B 로컬 검증 완료.
- **다음 단계**:
  1. 번역 = 당분간 **Sonnet 유지**. Haiku는 뉴스 금액을 간헐적으로 조작(3회 중 1회 환산값 날조)해 flagship 뉴스엔 리스크 — 비용 급해지면 조작-방지 가드 강화 후 재검토.
  2. (선택) AI 도우미 시스템 프롬프트를 "평점 추천 상담원" 정체성으로 다듬기 — 통합검색과 역할 차별화.
- **관련 파일/문서**: `daily-news-final/app/api/assistant/route.js`, `daily-news-final/lib/translator.js`, 메모리 [[project_assistant_model_haiku]]

---

## 2026-06-30 — 🔔 [푸시] 알림 내용 150→500자 확대 + iOS 다음 빌드 챙길 것 2건 정리

- **한 일**: 어드민 푸시 알림(`daily-news-final /admin/push-notifications`) 내용 글자수 제한을 **150→500자**로 확대. "그날의 명상·짧은 에피소드"를 알림에 직접 담기 위함. 제한은 ① 화면 입력(`page.js` slice) ② **발송 엔진(Firebase Function `sendCustomPush`)** 두 곳에 있었고 **둘 다** 500으로 올림. (앞서 화면만 고쳤다가 서버 거부 발견 → 함수까지 수정)
- **배포**: 웹(daily-news-final) push `119510d` → Vercel / Firebase Function `sendCustomPush` **firebase deploy** (chao-vn-app `functions/index.js` 미커밋 — 커밋 여부 사용자 확인 대기).
- **상태**: ✅ 500자 입력·발송 동작. ⚠️ **푸시 이미지 = 안드로이드만 표시됨**(FCM 빅픽처). **iOS는 텍스트만** — 알림에 사진 그리려면 네이티브 **Notification Service Extension** 필요.
- **다음 단계 (🔴 다음 iOS EAS 빌드 때 *함께* 챙길 것)**:
  1. **iOS Firebase Analytics 활성화** (기존 미빌드 항목 — `GoogleService-Info.plist` `IS_ANALYTICS_ENABLED=true`, app.json infoPlist `FIREBASE_ANALYTICS_COLLECTION_ENABLED=true`)
  2. **iOS 푸시 이미지용 Notification Service Extension 추가** (이거 없으면 iOS 알림에 사진 영영 안 뜸)
  → 둘 다 `PROGRESS_BUILD_PENDING.md` 필수 체크리스트에 등재함. *(당시 문서. 2026-07-17 이 파일 맨 위로 흡수·삭제됨)*
- **관련 파일**: `daily-news-final/app/admin/push-notifications/page.js`, `daily-news-final/수정작업현황.md`, `functions/index.js`(sendCustomPush), `PROGRESS_BUILD_PENDING.md`

---

## 2026-06-29 — 📱 [검색] 진출기업·옐로 상세를 앱 내 팝업으로 + 홈 AI도우미 버튼 개선 (OTA 완료)

- **한 일**: ① 검색결과·AI도우미에서 **진출기업·옐로** 항목을 탭하면 사이트로 나가지 않고 **앱 안 바텀시트 팝업**으로 상세 표시. 신규 `components/BizDetailSheet.js`(데이터=`/api/search/item`, 웹 `/biz/[id]`와 동일 endpoint·서버가 진출기업 원본+관리자수정 병합). 전화=`tel:`·이메일=`mailto:`·지도=지도앱·홈페이지=인앱브라우저. 뉴스·매거진·구글결과는 기존 인앱브라우저 유지. `services/searchService`에 `getDirectoryItem`·`isDirectoryResult` 추가, `SearchResultsScreen`·`AssistantScreen` 연결.
- **UI 마감**: ② 팝업 하단을 **safe-area(시스템 네비바)+하단 광고슬롯(750:250) 높이만큼 항상 예약**(고정 패딩→`useSafeAreaInsets`). ③ 홈 AI 입구: 반투명→**보라 솔리드(고대비)**, "AI에게 물어보기"→**"AI 검색 도우미"**, 아이콘 💁 크게+흰 원형 배지+화살표.
- **배포**: ✅ git push(`ee29245`) → **OTA `production`**(update group `f37508e4`, runtime 2.4.3, iOS+Android). 순수 JS(네이티브 0개)=OTA 안전. babel parse 통과 + item API 라이브 검증(옐로·진출기업).
- **상태**: ✅ 완료·라이브.
- **다음 단계**: (선택) 옐로 데이터에 주소/좌표 보강 시 '지도 보기' 정확도↑. 디렉토리 상세에 하단 광고슬롯 실제 노출 여부 결정. / ⏳ **iOS analytics 미커밋 변경 + 다음 EAS 빌드**는 여전히 대기(이번 OTA와 무관).
- **관련 파일**: `components/BizDetailSheet.js`, `services/searchService.js`, `screens/SearchResultsScreen.js`, `screens/AssistantScreen.js`, `screens/HubScreen.js`

---

## 2026-06-28 — 🤖 [검색] AI 검색 도우미 봇(대화형) 1단계 두뇌 + 구글 Places 통합 (백엔드 라이브)

- **한 일**: 통합검색 위에 **대화형 AI 도우미** 신설. Claude(tool use)가 자연어를 이해해 우리 인덱스를 조회하고 대화로 안내. 동의어 사전을 손으로 채우는 대신 Claude가 "동우회→동호회", "교민단체→동호회·한인회·주요기관"을 알아서 보정.
  - **신규 `daily-news-final/app/api/assistant/route.js`**: POST{messages} → Claude(`claude-sonnet-4-6`, 번역기와 동일 SDK·키) + 도구 2개. **도구① `search_directory`**(SearchIndex 직접 조회, 옐로·기업 우선 정렬), **도구② `search_google_places`**(구글 Places API New, 평점·리뷰·주소). 도구 왕복 4회 상한, 메시지 12개·2000자 제한, CORS 허용.
  - **구글 통합 = 옐로(검증 한인업소·전화) + 구글(평점·리뷰)** 합쳐 추천. `GOOGLE_PLACES_API_KEY` 미설정/미활성이면 **우아하게 폴백**(우리 데이터로만 응답) — 키만 넣으면 자동 활성. (CLAUDE.md의 [[OTA-safe defensive load]] 철학을 외부 API에 적용)
  - **라이브 검증**: "동우회 찾아줘"→동호회로 보정해 8건+되물음 / "호치민 2군 평점 좋은 한식당"→우리 16건 제시+평점은 구글 안내. 잘 동작.
- **배포**: ✅ daily-news-final push 3건(`edf1147` 봇, `e789dcd` 구글도구, 프롬프트 튜닝) → Vercel. `/api/assistant` 라이브.
- **상태**: ✅ 백엔드 완료 + **구글 평점 통합 라이브**(사용자가 서버키 Vercel `GOOGLE_PLACES_API_KEY` 등록 완료, 별도 Maps 프로젝트). 라이브 검증: "호치민 2군 평점좋은 한식당"→괸당집 ★4.9·미나리 ★4.9 등 구글 평점 붙은 16건. / 다음=웹·앱 채팅 UI.
- **②웹 채팅 UI 완료(라이브)**: `vnkorlife-web/app/assistant/page.tsx` — 자연어 대화창(말풍선·예시칩·결과카드, 구글=★평점). **새 채팅 + 기록(localStorage, 기기저장)**. 레이아웃=화면맞춤 카드(입력창 항상 보임). 홈 "🤖 AI에게 물어보기" 입구.
- **③검색↔AI 연결 + 뒤로가기 캐시(라이브)**: `/search` 결과없음·결과목록에 "AI에게 물어보기"→`/assistant?q=`(검색어 넘겨 자동질문). `/search` 결과를 sessionStorage에 검색조건별 캐시 → 상세 보고 뒤로가기 시 **재검색 없이 즉시 복원**. push(`121a6ab`).
- **④악용·비용 방지(라이브)**: 주제 가드레일(베트남 한인 생활정보 외 코딩·숙제·잡담 거절, 비자·병원 등은 범위 안) + IP당 분당 12회 호출제한(429). push(`d82d955`). 라이브 검증 완료. (강한 보호는 Vercel Firewall 엣지 rate limit으로 보강 가능 — Pro 포함, 선택)
- **⑤앱 채팅 화면(OTA 완료)**: `screens/AssistantScreen.js` 신규(웹과 동일 봇, 같은 `/api/assistant`). 말풍선·예시칩·결과카드(구글 ★평점), 결과 탭=인앱브라우저, 새 채팅+기록(AsyncStorage 기기저장, 헤더 우측 아이콘). `services/searchService`에 `askAssistant`·`resolveAssistantResultUrl` 추가. 허브(`HubScreen`) 검색창 아래 "🤖 AI에게 물어보기" 입구 + `App.js` HubStack에 `AI도우미` 스크린 등록. **네이티브 0개 = OTA 안전**(babel parse 4파일 통과). 배포: git push(`eb89ad3`) → **OTA `production` 발행**(update group `b8a85770`, runtime 2.4.3, iOS+Android).
- **⑥앱 UX 마감(OTA 완료)**: ① **검색 화면 하단광고 제거** — `App.js` `NO_AD_ROUTE_NAMES`에 `검색결과`·`AI도우미` 추가(전역 `FixedBottomBanner` 미표시). 입력창이 광고에 가리던 문제 근본 해결(홈·기타 화면 광고 유지=수익 유지). ② **키보드 회피** — 앱 `softwareKeyboardLayoutMode:pan`이라 키보드가 입력창을 가림. `ChatRoomScreen` 검증 패턴 이식(Android=키보드높이만큼 `marginBottom`, iOS=`KeyboardAvoidingView` padding). ③ `persist`/`deleteChat`의 setState 업데이터 내 부수효과 제거(ref로 읽어 밖에서 저장 — "setState in updater" 경고 해소). 개발앱 검증 후 배포: push(`0507dcc`) → OTA `production`(group `518ca624`). ⚠️ Firewall rate-limit 규칙도 daily-news-final에 추가됨(`/api/assistant` IP당 분당 30회).
- **상태**: ✅ **웹·앱 AI 도우미 + 검색개선 전부 라이브·운영 가능.**
- **다음 단계**: (선택) 검색 0건시 앱에서도 도우미 유도, 계정연동 기록(서버저장), 다국어(en/vi) 봇 응답, 옐로페이지 등 다른 화면도 광고 제외 여부 결정.
- **Vercel Firewall 메모**: AI 봇 API는 daily-news-final 프로젝트(웹 화면은 vnkorlife-web). rate-limit 규칙은 **daily-news-final** Firewall에 둠. Places API 키는 별도 Maps 프로젝트(mystic-berm-500814) 서버키 → Vercel `GOOGLE_PLACES_API_KEY`.
- **관련 파일**: `daily-news-final/app/api/assistant/route.js`, `vnkorlife-web/app/assistant/page.tsx`, `vnkorlife-web/app/page.tsx`

---

## 2026-06-28 — 🔎 [검색] 매거진 본문·카테고리까지 색인 + 최신순 정렬 (20년 콘텐츠 회수율 대폭↑)

- **한 일**: 통합검색이 "초라했던" 3가지 원인을 진단·수정. (검색 두뇌 = `daily-news-final /api/search`, DB는 Vercel과 공유)
  - **① 정렬이 가나다순 → 최신순**: 앱·웹이 `sort=category`를 보내는데 그룹 내 정렬이 `title ASC`(가나다)뿐이라 최신글이 묻힘. `route.js` orderBy에 `"publishedAt" DESC NULLS LAST` 추가 → 매거진·뉴스는 최신글 먼저, 옐로·진출기업(날짜 null)은 영향 0. **"22년 이후 글이 안 보임"은 수집 문제가 아니라 이 정렬 착시였음**(데이터는 다 있었음).
  - **② 검색이 제목+요약만 뒤짐 → 본문+카테고리까지 색인**: `search-index-core.js`가 매거진 글마다 **본문 앞 2000자 + 카테고리 이름**을 검색대상에 포함하도록 변경. 결과: "교민" 검색 **475→2,587건**, "베트남" 매거진 3,850→4,899건. 카테고리 컬럼도 채워짐(Han Column·교민단체·INTERVIEW·TRAVEL 등) → 분류 검색 가능.
  - **③ 크롤러 견고화**: 매 요청 새 연결(LiteSpeed keep-alive 'terminated' 회피), 깨진 유니코드 `\u` 복구 파싱, 안 받아지는 페이지는 건너뛰고 전체 색인 계속(옛 글 1건 때문에 전체 실패하던 문제). **로컬 prisma client가 stale**(searchIndex 모델 없음)이라 `npx prisma generate` 필요했음 — 색인은 그동안 Vercel 크론으로만 빌드됐던 것.
  - **④ 일일 크론 = 증분으로 전환**: 본문 색인으로 전량 재색인이 ~6분 → Vercel 크론 300초 초과. 크론은 `buildMagazineRecent`(최근 14일 작성·수정분만 upsert)로 교체. **전량 재색인은 CLI 수동**: `node scripts/build-search-index.js magazine`.
- **⑤ 동의어 사전(검색어↔데이터 표기 불일치 해소)**: "교민단체"로 검색하면 0건이고 기사만 나오던 문제. 원인은 **데이터에 "교민단체"란 단어가 없고** 해당 단체들이 카테고리 "동문·동호회"(203)·"호치민 주요기관"(54)·"종교"(43)로 적혀 있어서. `route.js`에 동의어 맵 추가(교민단체→동호회·주요기관·한인회·협회·종교 등, 맛집→음식점, 병원→의료…) → 검색 시 대체어를 ILIKE OR. 결과: **교민단체 옐로 0→299건**, sort=category라 **단체가 기사보다 먼저** 노출(배드민턴클럽·한국문화원·축구회·순복음교회 등). ⚠️ "동문" 단독은 "자동문" 오매칭이라 제외("동호회"가 카테고리 커버). 쿼리 단계만이라 **재색인 불필요**.
- **배포**: ✅ daily-news-final git push(`e46b8a2` 색인·정렬, `f7887da` 증분크론, `782d640`+`07be03f` 동의어) → Vercel 자동배포. DB 매거진 색인 **수동 재빌드 완료 = 7,131/7,131 전량**. 정렬·회수율·동의어 라이브 검증 완료.
- **상태**: ✅ 배포·검증 완료 (매거진 7,131 전량 색인 + 최신순 정렬 + 동의어 검색).
- **다음 단계**: (선택) 앱·웹 검색 UI에 **매거진/옐로 카테고리 필터칩** 노출(category 컬럼 채워짐). 동의어 사전은 운영하며 자주 찾는 말 추가. 뉴스 본문 색인은 미적용(휘발성).
- **관련 파일**: `daily-news-final/app/api/search/route.js`, `daily-news-final/lib/search-index-core.js`, `daily-news-final/app/api/cron/rebuild-magazine/route.js`

---

## 2026-06-28 — 📱 [앱] 허브 검색창을 웹과 동일한 올인원 박스로 개편 (OTA)

- **한 일**: 앱 허브(`screens/HubScreen.js`) 검색창을 웹 홈과 동일하게 통일. 검색버튼·지역필터(칩)를 **검색창 흰 박스 안으로** 넣고 박스를 더 크게. 윗줄=돋보기+입력, 아랫줄=지역칩+검색버튼(모바일 폭 기준 웹 레이아웃과 동일). 지역칩 탭은 기존 도시/구·군 선택 모달 재사용. JS 전용(네이티브 0개) = **OTA 안전**.
- **배포**: ✅ git push(`0c38652`) → OTA `production` 발행(update group `4d81716b`, runtime 2.4.3, iOS+Android).
- **상태**: ✅ 배포 완료 / ⏳ 실기기 OTA 수신 후 검색창 모양 확인 권장
- **다음 단계**: (선택) `SearchResultsScreen.js` 상단 검색바도 동일 톤으로 맞출지 사용자 확인 후 진행.
- **관련 파일**: `chao-vn-app/screens/HubScreen.js`

---

## 2026-06-28 — 🎨 [웹] 홈 디자인 개편: 배경사진 전면화 + 검색창 올인원 박스

- **한 일**: 홈(`vnkorlife-web/app/page.tsx`) 비주얼 개편 (사용자 로컬 확인 후 배포).
  - **바로가기 순서 재배열**: ① 매거진 · 데일리뉴스 · 옐로페이지 / ② 당근 · 구인구직 · 부동산.
  - **배경사진 전면화**: 헤더 주황 그라데이션 제거 → 앱과 동일 일몰 사진(`public/hub-bg.jpg`, 앱 `assets/hub-bg.jpg` 복사본)을 **페이지 전체에 한 장**으로. 흐림 `6px→1.5px`(또렷한 사진) + 흰 텍스트 가독용 **스크림 그라데이션**(상단 `black/55`→하단 `/10`). "바로가기" 제목은 흰색+그림자.
  - **검색창 올인원 박스(모던 트렌드)**: 입력 + 지역필터(회색 칩) + 검색버튼을 **흰 pill 한 박스** 안에 통합. 검색버튼이 창 밖→창 안으로 들어와 제목과 폭 균형. 모바일은 입력이 첫 줄 전체(`basis-full`), 지역칩+버튼이 같은 박스 둘째 줄로 wrap.
  - 검증: `eslint`·`next build` 통과, 로컬 dev(`localhost:3000`)로 사용자 확인 후 승인.
- **배포**: ✅ 웹 push — 순서 `3dfb5c8`, 배경 `e3ef950`, 전면화+검색창 `9a36e0c` → Vercel 자동배포.
- **상태**: ✅ 배포 완료
- **다음 단계**: (후속) 상세화면 헤더 🏠, 검색결과 인앱브라우저→네이티브 라우팅 등.
- **관련 파일**: `vnkorlife-web/app/page.tsx`, `vnkorlife-web/public/hub-bg.jpg`

---

## 2026-06-28 — 🔍 [웹] 통합검색 결과를 별도 `/search` 페이지로 분리 (앱과 구조 통일)

- **한 일**: 어제 앱에서 한 "검색=별도 결과화면" 구조를 **웹(vnkorlife.com)에도 동일 적용**. ⚠️ 분리 대상은 **통합검색(홈 `/`)** 이지 옐로페이지가 아님(`/yellowpage` 무수정).
  - **홈(`app/page.tsx`)** = 이제 '입구'만: 검색창+지역+바로가기. 검색 상태/결과 렌더/sessionStorage(`xc_hub_search`) **전부 제거**. 검색 누르면 `router.push('/search?q=…&city=…&district=…')`. → 다른 데 갔다 와도 홈에 결과가 안 남아 옐로페이지 진입이 막히던 문제 해소(앱에서 고친 그 버그의 웹판).
  - **신규 `app/search/page.tsx`** = 구글식 결과 전용: 맨 위 고정 검색바(씬짜오 홈링크+돋보기+검색)+지역+타입칩+결과+페이지네이션. **모든 검색 상태(q·type·city·district·page)를 URL 쿼리에** 담음 → 새로고침·뒤로/앞으로·공유·상세(`/biz/[id]`) 다녀오기까지 **URL 만으로 복원**(세션스토리지 불필요). `useSearchParams`라 `<Suspense>` 경계로 감쌈.
  - **정렬 = 앱과 통일**: `/search` 가 `sort=category` 전송(옐로→진출기업→매거진→뉴스 + 그룹 내 프리미엄→가나다). API(daily-news)는 어제 이미 `sort=category` 지원하므로 **추가 배포 불필요**.
  - 검증: `tsc --noEmit` 통과, `eslint` 통과(`<a href="/">`→`<Link>` 교체), `next build` 성공(`/search` 라우트 정상 생성).
- **배포**: ✅ 웹 git push (커밋 `0cf842e`, `c5ea5bd..0cf842e`) → Vercel 자동배포. (관련 파일만 커밋, `.claude/settings.local.json` 제외)
- **상태**: ✅ 배포 트리거 완료 / ⏳ Vercel 배포 후 라이브 확인(홈 검색→`/search` 이동, URL 복원, 뒤로가기 시 홈 복원) 권장
- **다음 단계**: (후속, 낮은 우선순위) 상세화면 헤더 🏠, 검색결과 인앱브라우저→네이티브 라우팅, 허브 헤더 그라데이션(빌드 시), 순수 가나다 옵션(프리미엄 우선 제거).
- **관련 파일**: `vnkorlife-web/app/page.tsx`, `vnkorlife-web/app/search/page.tsx`

---

## 2026-06-27 — 🔍 앱에 통합검색 허브(홈) 도입 = Phase 3 (코드 완료, 배포 대기)

- **한 일**: 웹(vnkorlife.com)에 만든 통합검색 허브를 **앱에도 동일 구조로** 이식. 같은 검색 두뇌(daily-news `/api/search`) 재사용 → 네이티브 모듈 0개 = **OTA 안전**.
  - **허브 앤 스포크 구조 확정**: 허브(통합검색) = 앱 시작 화면·중심.
  - **홈 복귀 = 하단 첫 탭으로 결정(헤더 버튼 폐기)**: 처음엔 헤더에 🏠 버튼을 넣었으나, 실기기에서 헤더(☰+제목+광고문의+언어+아바타)가 너무 빽빽해 인지 안 됨(사용자 피드백). → **`허브`를 보이는 첫 탭 "홈"(집 아이콘)으로 승격**, 헤더 홈버튼 전부 제거. 모바일에서 가장 직관적인 홈 자리.
  - **하단 탭 6개**: `홈(허브) · 매거진 · 뉴스 · 당근 · 구인구직 · 부동산`. 기존 `홈(매거진홈)`은 라벨·아이콘 **매거진**(book)으로 개명. **이웃사업 탭은 탭바 버튼 숨김**(`tabBarButton:null`) — 웹처럼 옐로페이지로 흡수. 스택·딥링크·등록은 유지(삭제 아님).
  - **신규**: `services/searchService.js`(searchUnified·getRegions·resolveResultUrl), `screens/HubScreen.js`(검색+지역모달+타입칩+결과+바로가기 6카드+옐로 대표카드+상단노출 신청 CTA), `screens/YellowPageScreen.js`(카테고리·지역 브라우즈, type=yellow).
  - **검색결과 상세** = 인앱브라우저(`WebBrowser`)로 `vnkorlife.com/biz/{id}`(yellow/company) 또는 원문 url(news/magazine). 웹과 동일 정책.
  - **App.js 배선**: HubStack 추가 + 보이는 `허브`(홈) 첫 탭 + `initialRouteName="허브"`(시작=허브) + 메뉴 뒤로가기 `홈`→`허브`.
  - 그라데이션은 `expo-linear-gradient` 미설치(네이티브) → **단색 헤더로 폴백**(빌드 회피). 다음 빌드 때 옵션.
  - **디자인 보완(피드백 반영)**: ① 바로가기 = 옐로페이지 대표카드 → 매거진·뉴스 2칸 → 당근·구인·부동산 3칸(작게), 하단 광고 높이만큼 동적 스크롤 여백(`AD_CLEARANCE`). ② 검색 플레이스홀더 "베트남의 모든 정보를 씬짜오에서". ③ **바로가기 섹션 배경에 베트남 일몰 사진(사용자 제공, `assets/hub-bg.jpg`)을 `ImageBackground`+`blurRadius:6` + 오버레이 0.3**로 깔고, 흰 카드는 그림자+카테고리 컬러 아이콘 타일로 강조(흰-on-흰 묻힘 해소). 사용자 본인 사진이라 라이선스 무관. ④ 허브 헤더에 "홈" 제목(다른 탭과 동일).
  - **검색 = 별도 결과 화면으로 분리(구글식, 피드백 반영)**: 기존엔 검색이 홈을 덮어쓰고 결과가 AsyncStorage로 남아 홈(옐로 진입 등)이 사라짐 → 신규 `screens/SearchResultsScreen.js`(맨 위 고정 검색창+지역+타입칩+결과+페이지). 홈(`HubScreen`)은 '입구'만: 검색 누르면 `검색결과` push, **홈은 항상 그대로**. 홈탭/뒤로 누르면 결과 화면 pop→홈 복원. 결과는 화면 state로만 유지(인앱브라우저는 화면 안 닫힘) → AsyncStorage 세션복원 제거.
  - **검색창 돋보기 아이콘** 3곳(허브·검색결과·옐로) 왼쪽에 추가(Ionicons search, 기존 의존성).
  - **검색결과 정렬 = 카테고리순(피드백 반영)**: 통합(전체) 결과를 **옐로페이지→진출기업→매거진→뉴스** 순으로 묶고 그룹 내 **가나다(프리미엄 우선)**. ⚠️ **검색 API(daily-news-final) 수정 필요**(페이지네이션 때문에 서버 정렬). `sort=category` **옵트인 파라미터** 추가(`app/api/search/route.js`) → 앱만 보냄, 웹 영향 0. 앱 `searchService`·`SearchResultsScreen`이 `sort:'category'` 전달. **별도 배포 필요**: daily-news-final git push→Vercel 자동배포(앱 OTA와 별개). 미배포 시 앱은 기존 순서로 표시(무해).
- **배포**: ✅ **완료** (2026-06-28). 앱 OTA `production` 발행(update group `7b80ca3b`, runtime 2.4.3, iOS+Android, 커밋 `91e39d8`). 검색 API daily-news-final push→Vercel 배포(커밋 `c80e073`), `sort=category` 라이브 검증 완료(옐로→company→magazine→news 그룹화 확인).
- **상태**: ✅ 배포 완료 / ⏳ 실기기 최종 확인(검색→결과화면→홈복원, 카테고리 정렬) 권장
- **다음 단계**:
  - ⭐ **[웹] 검색결과를 별도 페이지로 분리** (앱과 동일 구조로 통일) — 현재 `vnkorlife-web/app/page.tsx`(허브 홈)는 `searched` 상태로 **같은 화면에 결과를 덮어쓰는** 옛 방식이라, 다른 데 갔다 오면 홈에 결과가 남고 옐로페이지 진입이 막힘(앱에서 고친 그 문제). → 웹도 홈(`/`)은 검색창+바로가기만 두고, 검색 시 별도 `/search` 라우트(맨 위 고정 검색창+결과+타입칩+지역)로 이동. 옵션: 웹도 `sort=category` 적용해 정렬 통일.
  - (후속) 상세화면 헤더 🏠, 검색결과 인앱브라우저→네이티브 라우팅, 허브 헤더 그라데이션(빌드 시), 순수 가나다 옵션(프리미엄 우선 제거).
  - ✅ (완료) 앱 실기기 동선 일부 확인(돋보기·검색분리) + OTA·API 배포.
- **관련 파일**: [services/searchService.js](services/searchService.js), [screens/HubScreen.js](screens/HubScreen.js), [screens/YellowPageScreen.js](screens/YellowPageScreen.js), [App.js](App.js), i18n navigation.json(ko·en·vi)

---

## 2026-06-27 — 🚫 영구 제명 + 블랙리스트 (서버 강제) 처음부터 재설계·배포

- **한 일**: 어제(6/26) 만들었다 원복한 제명 기능을, 감사(audit)로 구멍을 찾아 **처음부터 서버 강제 방식**으로 재구현. 핵심: **Firestore 보안 규칙으로 차단을 강제** → 앱을 조작(해킹)해도 차단 회원은 글·댓글·채팅 쓰기가 서버에서 거부됨.
  - **식별 키 = 이메일** (uid는 재가입 시 바뀌므로 X). 카카오는 토큰 이메일이 합성값이라 `kakao_{kakaoId}@chaovietnam.co.kr`로 키 생성(규칙·클라 일치 핵심 디테일).
  - **집행 지점 = `onAuthStateChanged` 한 곳** — 이메일·구글·애플·카카오 모두 이 길목 통과. 차단이면 즉시 signOut+안내. 이미 로그인된 회원도 다음 실행 때 차단 적용.
  - **서버 규칙**: `bannedUsers/{이메일}` 존재 = 차단. 모든 콘텐츠 쓰기 규칙에 `!isBanned()`/`isActiveUser()` 추가. `bannedUsers`는 본인 것만 `get`(명단 유출 방지), `list`·`write`는 관리자만.
  - **관리자 UI**: 회원 상세 팝업에 영구제명(사유 입력)/차단해제 버튼. 제명 시 블랙리스트 등록 + 전 게시물 삭제.
  - **fail-open이지만 안전**: 클라 조회 실패해도 서버 규칙이 최종 방어. isBanned 조회에 4초 타임아웃(스플래시 안 멈춤).
- **배포**: ✅ **Firestore 규칙 배포 완료**(`firebase deploy --only firestore:rules`, 컴파일 성공·released). 앱 OTA `production` 발행. 비차단 사용자에겐 규칙 동작이 기존과 100% 동일(영향 0).
- **상태**: ✅ 배포 완료 / ⏳ 실제 제명→재로그인·글쓰기 차단 운영 검증 권장
- **한계(정직히)**: 클라이언트 SDK는 남의 Firebase Auth 계정을 못 지움(Admin SDK 필요). 그래서 "계정은 남되 못 들어옴" 방식. 애플 이메일 가리기(null)면 이메일 키 차단 불가(엣지).
- **관련 파일**: [lib/blacklist.js](lib/blacklist.js), [contexts/AuthContext.js](contexts/AuthContext.js), [screens/UserManagementScreen.js](screens/UserManagementScreen.js), [firestore.rules](firestore.rules)

---

## 2026-06-27 — 회원관리 상세 팝업 레이아웃 수정 (삭제 버튼 안 보이던 문제)

- **한 일**: 관리자 "회원관리 → 회원 터치 → 상세 팝업"에서 맨 아래 **"회원 삭제" 버튼이 안드로이드 시스템 내비바에 가려 안 보이던 문제** 수정. 팝업을 하단 시트(박스) 방식에서 **화면 중앙 카드(절대 위치)** 로 변경.
  - **최종 해법**: `modalContent`를 `position:'absolute', top:90, bottom:110, left:16, right:16` 로 못박음. 내부는 헤더(고정) → `ScrollView flex:1`(카드 안 스크롤) → 삭제 버튼(하단 고정). `bottom:110`이 버튼을 내비바(~48) 위로 확실히 띄움.
- **⚠️ 삽질 기록 (다음에 같은 실수 반복 금지)**:
  - `insets.bottom`(useSafeAreaInsets) 은 이 **네이티브 `<Modal>` 안에서 0으로 잡힘** → 짐작으로 쓰지 말 것. 값 확인 없이 6~7번 OTA 날려서 5시간 허비.
  - `maxHeight` + `flexShrink` 조합은 **ScrollView가 높이를 못 정해 스크롤 안 되고 버튼을 밀어냄**. 스크롤 모달은 반드시 **확정 height + ScrollView `flex:1`** (또는 절대위치).
  - `marginBottom` 으로 flex-end 시트를 내비바 위로 올리는 건 이 환경에서 **시각적으로 안 먹었음**. 중앙 카드+절대위치가 정답.
  - StyleSheet 스타일은 핫리로드가 잘 안 먹을 때가 있음 → 검증용 변경은 **인라인 스타일**로.
- **배포**: 앱 OTA `production` 완료 (커밋 `b0d6876`, update group `cb317bb9`). runtime 2.4.3, iOS+Android.
- **상태**: ✅ 완료 (개발 앱 실기기에서 버튼 정상 노출 확인 후 OTA)
- **다음 단계**: **영구 제명 + 블랙리스트 기능**을 이 안정된 상세 팝업 위에 재구현 (오늘 한 번 만들었다가 d7c0aa5로 전체 원복함). 구조 참고: `bannedUsers` 컬렉션(uid/email/kakaoId/phone/사유) + AuthContext 4개 로그인 경로(이메일·구글·애플·카카오)에 `checkBanned` 추가 + UserManagementScreen 제명 버튼·사유입력 모달.
- **관련 파일**: [screens/UserManagementScreen.js](screens/UserManagementScreen.js) (상세 모달), [contexts/AuthContext.js](contexts/AuthContext.js) (제명 재구현 시)

---

## 2026-06-26 — 🔍 교민 통합검색 허브 + 옐로페이지 + 이웃업소 통합 + 자동화 (대규모, 웹)

> 깊은 구조·엔드포인트·재발방지는 [PROGRESS_UNIFIED_SEARCH.md](PROGRESS_UNIFIED_SEARCH.md) 참조.

- **한 일 (요약)**: 흩어진 5개 자산을 한 검색창으로 묶는 통합검색을 만들고 vnkorlife.com을 허브로 전환. 옐로페이지(우리 디지털화 3.7천 + 라이프플라자)와 이웃업소(앱 등록)를 하나로 합쳐, 이웃업소를 *사진+상단 프리미엄*으로 노출. 신청→관리자승인→게재 흐름 + 이메일 알림. 색인 자동갱신(야간 크론 + 승인 즉시)까지 완성.
  - **검색 두뇌 = daily-news-final**(Neon `SearchIndex` 단일색인 + pg_trgm 한글검색). 화면 = vnkorlife.com이 `NEXT_PUBLIC_SEARCH_API`(기본 daily-news vercel)로 호출.
  - **색인 5소스**: 뉴스(WP cat31 ~18k) · 매거진(WP 그외 ~7k) · 진출기업(xcd ~5.4k) · 옐로페이지(매거진/라이프플라자 마스터 JSON ~3.7k) · 이웃업소(Firestore, priority 100). 중복 시 사진 있는 이웃업소가 이김.
  - **옐로 마스터 JSON을 `daily-news-final/data/yellowpage_master.json`에 커밋** → GitHub 백업 + 서버가 직접 읽어 자동 재색인(예전 "로컬 수동" 제약 해소).
  - **vnkorlife 화면**: `/`(허브 통합검색·지역필터·세션복원) · `/yellowpage`(카테고리·도시/구군 둘러보기) · `/biz/[id]`(내부 상세: 진출기업 전항목·기타박스·인라인지도·관리자수정버튼) · `/biz/[id]/edit`(관리자 수정). 네비 '이웃업소'→'옐로페이지', `/neighborbusiness`→`/yellowpage` 리다이렉트(등록 `/new`은 유지).
  - **등록 흐름**: `/neighborbusiness/new` = "옐로페이지 상단노출 **신청**"(active:false·pending) → 접수 안내 → 관리자 패널 "✅ 승인"(active·approved) → 색인 즉시 반영. 신청 시 관리자(info@·younghan146@) **SendGrid 이메일 알림**.
  - **자동화**: 야간 크론 `rebuild-directory`(00:30)·`rebuild-news`(01:00)·`rebuild-magazine`(01:30 UTC) + 승인 즉시 `/api/directory/refresh-neighbor`. 빌더 공용 모듈 `lib/search-index-core.js`(CLI+서버 공용).
  - **디자인**: 허브 홈 전문 리디자인(히어로·컬러 카드·가독성). 지역을 검색창 바로 아래로(검색조건화). 로고·'홈' 탭·제목 클릭 = 검색 초기화 후 첫 화면(구글식, 수익라인 노출 자리 확보).
- **배포**: 웹 Vercel **운영 LIVE** — daily-news-final + vnkorlife-web 다수 커밋 push. 색인은 운영 Neon에 적재 완료. (앱 chao-vn-app은 미적용 = 다음 단계)
- **상태**: ✅ 핵심 완료·운영 검증(검색/옐로/상세/자동갱신 운영 확인) / ⏳ **관리자 수정 저장**(Firebase ID토큰 검증)만 운영 실토큰 테스트 미완 — 실패 시 daily-news Vercel에 `FIREBASE_SERVICE_ACCOUNT_JSON` 추가.
- **다음 단계**:
  ① **홈 화면 수익 라인**(제휴 배너 자리) 설계·삽입 — 홈 노출 늘렸으니 적기.
  ② `/yellowpage`·`/biz` 디자인을 허브와 통일.
  ③ **앱(chao-vn-app)에 통합검색·옐로페이지 적용**(같은 API 재사용) = Phase 3.
  ④ 운영에서 관리자 수정 저장 실테스트.
- **관련 파일/문서**:
  - daily-news-final: `lib/search-index-core.js`, `scripts/build-search-index.js`, `data/yellowpage_master.json`, `app/api/search/*`, `app/api/directory/*`, `app/api/cron/rebuild-*`, `app/api/notify-application`, `vercel.json`, `prisma/schema.prisma`(SearchIndex·DirectoryEdit)
  - vnkorlife-web: `app/page.tsx`(허브), `app/yellowpage/page.tsx`, `app/biz/[id]/page.tsx`·`edit`, `src/components/navigation/GlobalNav.tsx`, `app/(tabs)/neighborbusiness/new/page.tsx`·`page.tsx`, `app/admin/page.tsx`(승인+색인반영)
  - [PROGRESS_UNIFIED_SEARCH.md](PROGRESS_UNIFIED_SEARCH.md)

---

## 2026-06-26 — 잘못된 App Store ID 전수 수정 + iOS 오프라인 배너 버그 + 업데이트 안내 링크

- **한 일**:
  ① 코드 전체의 잘못된 iOS App Store ID(`id6480538597`=404, 플레이스홀더 `id123456789`) **9곳** → 정상 `id6754750793`으로 통일.
  ② **iOS 오프라인 배너가 인터넷 있어도 상시 표시되던 버그** 수정. 원인은 netinfo 값(정상 `conn=true`)이 아니라 `NetworkBanner` 숨김 이동거리 `-60`이 iOS 큰 `insets.top`(노치 ~59)을 못 덮어 배너가 화면 상단에 남던 것 → `-(insets.top+60)`으로 수정. (Android는 insets.top이 작아 원래 정상이었음 = 플랫폼 차이)
  ③ **업데이트 안내용 단일 링크 페이지** `public_html/go/update` 신설 — OS 감지 후 *앱 열기 시도 없이* 곧장 스토어로. (기존 `/go/app`은 deeplink로 구앱을 열어버려 업데이트용으로 부적합)
- **배포**: 앱 OTA 3건(`production`, runtime 2.4.3, iOS+Android) — ID수정·진단·배너수정. Firebase Hosting 배포(`/go/update`). 커밋 `16245fd`·`126d777`·`6f7bc75`(진단,제거됨)·`d7c0aa5`.
- **상태**: ✅ 완료 — iOS 실기기 확인(인터넷 끊기면 배너 뜨고, 연결되면 사라짐).
- **다음 단계**: (선택) 다음 EAS 빌드에 netinfo·딥링크 `associatedDomains`·iOS analytics 반영 → `PROGRESS_BUILD_PENDING.md` *(당시 문서. 2026-07-17 이 파일 맨 위로 흡수·삭제됨)*. WP 딥링크 플러그인 FTP는 **불필요**(구버전, 실라우터는 `public_html/app/share/index.php`이며 스토어ID 미사용).
- **단일 안내 링크**: `https://chaovietnam-login.web.app/go/update`
- **관련 파일/문서**: `components/NetworkBanner.js`, `components/ForceUpdateModal.js`, `public_html/go/update/index.html`, `firebase.json`

---

## 2026-06-23 — 씬짜오 매거진 옐로페이지(Vol-561) 디지털화 OCR

- **한 일**: 스캔 이미지 PDF(`Z:/VOL/VOL_NEW/Vol-561/04-PDF/561_yellowpage-2.pdf`, 42p, 글꼴0)를 비전 OCR로 구조화. PDF→페이지JPEG 추출 + sharp로 2×3 타일(확대·샤픈) → 페이지별 병렬 OCR 에이전트 → 병합·정규화·중복제거. **2,176개 업체** 추출(이름·전화·주소·담당자·카테고리). 라이프플라자(아임웹 디렉토리)는 통째 복제 대신 *전화·주소 교차검증용* 으로만 사용 결정(우리 PDF가 원본=법적 리스크 없음).
- **배포**: 미배포 (로컬 추출물만, 라이브 DB 미접촉)
- **상태**: 🟡 진행중 — 매거진 OCR + 라이프플라자 크롤링 + 통합 완료, 검수 대기
- **추가 진행(같은 날)**: 대분류 색띠 기준 배정 / 라이프플라자 크롤 2,619 / 비교(겹침 25%, 두 곳 독립수집 판명) / **통합 마스터 4,319개**(도시·구군·카테고리 검색구조). 사용자 결정: 둘 다 통합 + 베트남남부 옐로페이지로 전환
- **다음 단계**: ① `yellowpage_master.csv` 검수 ② 잔여 보정(도시 미상 749·대분류 기타 477) ③ `NeighborBusinesses` 임포트(source 보존, 사전승인) ④ 앱·vnkorlife 도시/구군/카테고리 검색 UI
- **관련**: `scripts/yellowpage/{crawl_lifeplaza,compare,build_directory}.js`, 산출 `.tmp/yellowpage/out/yellowpage_master.{csv,json}`
- **관련 파일/문서**: [directives/yellowpage_digitize.md](directives/yellowpage_digitize.md), `scripts/yellowpage/{extract_pages,merge}.js`, 산출물 `.tmp/yellowpage/out/yellowpage.{csv,json}`

---

## 2026-06-23 — 뉴스탭 마켓카드 외부링크 안 열림(investing.com) → 네이버로 교체

- **한 일**: 뉴스탭 정보박스(`MarketStrip`) 주가·금·유가 버튼(kr.investing.com)이 앱에서만 안 열림. 원인 = investing.com이 인앱 브라우저에서 자기 앱으로 튕기거나 webview를 막음(국가 제한 아님 — 웹은 베트남 IP도 정상). ① 앱 `openLink`를 `Linking.openURL`→`WebBrowser.openBrowserAsync`로 교체(OTA 완료) ② 근본해결: jenny 플러그인 `/market` API·웹카드 링크를 **네이버 모바일 증권**으로 교체(`/go/mkt_*` 경유). 앱은 API 링크만 받아써서 OTA 불필요, jenny는 FTP 배포.
- **배포**: 앱 OTA `production`(커밋 `b4a0243`, WebBrowser) / jenny 플러그인 FTP(daily-news-final 커밋 `67eabc0`)
- **상태**: ✅ 완료 (사용자 실기기 정상 확인)
- **함정 기록**: 네이버 commodity 딥링크는 홈으로 튕김 → `/marketindex/home/{metals,energy}` SSR 페이지 사용. 배포 후 `/go/` 최종착지 반드시 curl로 검증.
- **관련**: [PROGRESS_CHAT_SYSTEM.md](PROGRESS_CHAT_SYSTEM.md) 증상 3, [components/MarketStrip.js](components/MarketStrip.js), `daily-news-final/wordpress-plugin/jenny-daily-news.php`

---

## 2026-06-22 — 채팅 오류·하단광고 가림 수정 + 로그아웃 시 로그인 유도

- **한 일**:
  1. **채팅 "채팅방 정보를 불러올 수 없습니다" 오류** → 원인은 카카오톡 폼 등록 글에 `userId`가 없어서임(채팅 받을 앱 계정 부재). 당근·구인·부동산 상세에서 `!item.userId`면 엉뚱한 에러 대신 **"게시자 앱 미설치 → 연락처로 연락" 안내 팝업**.
  2. **채팅방 하단 광고가 입력창/전송버튼 가림** → `NO_AD_ROUTE_NAMES`에 `'ChatRoom'` 추가(채팅목록→채팅방 경로가 안 숨겨지던 구멍).
  3. **로그아웃 시 로그인 유도** — 모든 탭 헤더 + 더보기 헤더에 "로그인" 버튼(`UserAvatarButton`), 로그아웃 시 권유 메시지. 강제 로그인 아님(방문자 둘러보기 유지 = 깔때기·앱스토어 심사 안전).
- **배포**: 앱 OTA `production` 4회 — 커밋 `a910b3e`(당근 채팅+광고), `5463cdd`(구인·부동산 채팅), `57fcd3d`(헤더 로그인버튼+로그아웃 메시지), `4c324eb`(더보기 헤더)
- **상태**: ✅ 완료 (실기기 확인 정상)
- **다음 단계**: 카카오톡 폼(`public_html/form/*`)에 "앱으로 등록하면 실시간 채팅 가능" 공지 추가 — 사용자가 직접 작성 예정.
- **⭐ 중요(재발 참조)**: [PROGRESS_CHAT_SYSTEM.md](PROGRESS_CHAT_SYSTEM.md) — 3채널 등록 구조, `source:'web'`=카카오 함정, 채팅 오류·하단광고 가림 원인/처방 정리.
- **관련 파일**: [screens/ItemDetailScreen.js](screens/ItemDetailScreen.js), [screens/JobDetailScreen.js](screens/JobDetailScreen.js), [screens/RealEstateDetailScreen.js](screens/RealEstateDetailScreen.js), [App.js](App.js), [screens/MoreScreen.js](screens/MoreScreen.js), i18n(danggn/common/menu)

---

## 2026-06-22 — 이웃사업 리스트 틀을 이미지 실제 비율에 자동 맞춤 (여백 제거)

- **한 일**: 고정 4:3 틀 + contain은 와이드 배너(예 2.4:1)에서 상하 회색 여백이 크게 생김. 각 이미지의 `onLoad`로 실제 가로/세로 비율을 읽어 카드 틀(aspectRatio)을 이미지별로 동적 설정 → 여백 0. 로드 전 임시값 `DEFAULT_CARD_RATIO=16/9`, 이미지 없는 카드는 16:9 고정.
- **배포**: 앱 OTA `production` (이 항목 커밋과 함께)
- **상태**: ✅ 완료
- **주의/트레이드오프**: 카드마다 이미지 비율이 달라 **카드 높이가 제각각**이 됨(핀터레스트식). 의도된 결과. 너무 들쭉날쭉하면 상한 비율 클램프(예 세로로 너무 긴 건 최대 4:3까지만) 추가 가능.
- **관련 파일**: [screens/NeighborBusinessesScreen.js](screens/NeighborBusinessesScreen.js) (DEFAULT_CARD_RATIO, imgRatios state, 카드 이미지 onLoad)

---

## 2026-06-22 — 이웃사업 리스트 이미지 contain 전환 (상세와 동일 프레임)

- **한 일**: 리스트 카드 이미지를 `cover`→`contain`으로 변경. 리스트·상세 프레임은 이미 4:3로 동일했고, 채우기 방식만 달라 리스트만 좌우 잘림이 있었음. 이제 둘 다 전체 배너를 가로폭에 맞춰 표시(무잘림). 실사용자 스크린샷 피드백 반영.
- **배포**: 앱 OTA `production` (이 항목 커밋과 함께)
- **상태**: ✅ 완료
- **다음 단계**: 와이드 배너의 상하 회색 여백이 거슬리면 양쪽(리스트+상세) 비율을 4:3→16:9로 좁혀 여백 축소 가능. 사용자 반응 보고 판단.
- **관련 파일**: [screens/NeighborBusinessesScreen.js](screens/NeighborBusinessesScreen.js) (renderBusinessCard 이미지 contentFit)

---

## 2026-06-22 — 이웃사업 리스트 카드 가로 배너형 전환

- **한 일**: 앱 리스트 카드를 "왼쪽 정사각(100×100) 썸네일 + 텍스트" 가로줄 → "상단 가로 전체폭 4:3 이미지 + 하단 텍스트" 세로 배너로 변경. 정사각 틀에서 가로 사진 좌우가 잘리던 문제 해결. 스타일 2개만 변경(`card` 가로→세로, `cardThumb` 100×100→너비100%·4:3).
- **배포**: 앱 OTA `production` (이 항목 커밋과 함께)
- **상태**: ✅ 완료
- **다음 단계**: 등록폼 도움말에 "권장 업로드 이미지 = 가로 4:3 (1200×900)" 안내 한 줄 추가 검토. 그러면 리스트·상세 둘 다 무잘림.
- **관련 파일**: [screens/NeighborBusinessesScreen.js](screens/NeighborBusinessesScreen.js) (styles card/cardThumb). 웹 리스트(`SimpleCards.tsx`)는 이미 5:4 배너형이라 변경 없음.

---

## 2026-06-22 — 이웃사업 정렬·이미지·앱웹 통일

- **한 일**:
  1. 이웃사업 목록을 `priority 높은순 → 최신 등록순`으로 정렬 (앱). 빈 지역 검색 시 캐시 복원 무한루프(화면 흔들림) 제거.
  2. 웹(vnkorlife-web) 목록 정렬을 앱과 동일하게 통일(priority 무시하던 문제 해결). 앱 등록폼 우선순위 라벨 거꾸로 표기 정정("작을수록"→"클수록 위로").
  3. 앱·웹 상세 큰 이미지 `cover→contain`으로 변경 — 어떤 비율도 잘리지 않고 전체 표시. (목록 썸네일은 `cover` 유지)
- **배포**: 앱 OTA `production` 2회 발행(커밋 `2687544`, `19a8330`) / 웹 Vercel 자동배포(커밋 `1a35b00`)
- **상태**: ✅ 완료
- **다음 단계**: 실기기에서 6군 등 빈 지역 검색 + 이미지 표시 정상 확인. 이상적 업로드 이미지 = **가로 4:3 (1200×900)** 안내를 등록폼 도움말에 넣을지 검토.
- **관련 파일**: [services/neighborBusinessService.js](services/neighborBusinessService.js), [screens/NeighborBusinessesScreen.js](screens/NeighborBusinessesScreen.js), [screens/NeighborBusinessDetailScreen.js](screens/NeighborBusinessDetailScreen.js), `vnkorlife-web/src/components/pages/NeighborBusinessPageClient.tsx`, `vnkorlife-web/src/components/detail/ImageGallery.tsx`
- **메모**: 이웃사업 웹 = `vnkorlife-web`(GitHub young146/vnkorlife-web → Vercel 자동배포). 앱과 Firestore `NeighborBusinesses` 컬렉션 공유.

---

## 📚 주제별 심화 추적 (이 로그에서 갈라지는 문서)

- [PROGRESS_CHAT_SYSTEM.md](PROGRESS_CHAT_SYSTEM.md) — 채팅 시스템 / 3채널 등록 구조 / 채팅·광고 오류 재발 참조
- 미빌드 네이티브 변경 / 빌드 시점 결정 → **이 파일 맨 위 「⏳ 다음 EAS Build 에 반드시 포함할 것」** (2026-07-17 `PROGRESS_BUILD_PENDING.md` 흡수·삭제)
- [PROGRESS_MEASUREMENT_INFRA.md](PROGRESS_MEASUREMENT_INFRA.md) — 측정 인프라 (Analytics)
- [PROGRESS_PUSH_SYSTEM.md](PROGRESS_PUSH_SYSTEM.md) — 푸시 알림 시스템
- [PROGRESS_MARKETING_FUNNEL.md](https://github.com/young146/daily-news-final/blob/main/PROGRESS_MARKETING_FUNNEL.md) `daily-news-final` 저장소 — 마케팅 깔때기
