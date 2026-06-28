# 작업 현황 로그 (WORKLOG)

> **목적**: 세션·작업자가 바뀌어도 작업을 *이어서* 할 수 있도록, 모든 작업의 현황을 한 곳에 시간순으로 남긴다.
>
> **읽기 규칙**: 새 작업을 시작하기 전, 이 파일 맨 위(최신 항목)부터 읽어 직전 작업의 맥락과 "다음 단계"를 파악한다.
>
> **쓰기 규칙**: 작업을 완료하거나 중단할 때마다 맨 위에 새 항목을 추가한다. 깊은 기술 추적은 주제별 `PROGRESS_*.md`로 링크하고, 이 파일에는 **"무엇을 · 어디까지 · 다음은"** 요약만 남긴다.
>
> 최종 갱신: 2026-06-26

---

## 📂 문서 지도 — 이어가기는 **여기(WORKLOG)** 하나로 시작한다

> 새 세션/작업자는 **이 파일만 열면 된다.** 아래 주제별 문서는 *깊은 내용이 필요할 때만* 들어간다.

| 문서 | 무엇 | 언제 보나 | 상태 |
|---|---|---|---|
| **(이 파일) WORKLOG.md** | 모든 작업의 시간순 현황·다음단계 | **항상 여기부터** | 🟢 활성 |
| [PROGRESS_BUILD_PENDING.md](PROGRESS_BUILD_PENDING.md) | 스토어 빌드에 아직 안 들어간 네이티브 변경 | "지금 EAS 빌드 해야 하나?" 판단 시 | 🟢 활성 |
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
- **다음 단계**: (선택) 다음 EAS 빌드에 netinfo·딥링크 `associatedDomains`·iOS analytics 반영 → [PROGRESS_BUILD_PENDING.md](PROGRESS_BUILD_PENDING.md). WP 딥링크 플러그인 FTP는 **불필요**(구버전, 실라우터는 `public_html/app/share/index.php`이며 스토어ID 미사용).
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
- [PROGRESS_BUILD_PENDING.md](PROGRESS_BUILD_PENDING.md) — 미빌드 네이티브 변경 / 빌드 시점 결정
- [PROGRESS_MEASUREMENT_INFRA.md](PROGRESS_MEASUREMENT_INFRA.md) — 측정 인프라 (Analytics)
- [PROGRESS_PUSH_SYSTEM.md](PROGRESS_PUSH_SYSTEM.md) — 푸시 알림 시스템
- [PROGRESS_MARKETING_FUNNEL.md](../../daily-news-final/daily-news-final/PROGRESS_MARKETING_FUNNEL.md) — 마케팅 깔때기
