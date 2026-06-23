# PROGRESS — 채팅 시스템 & 등록 채널 (재발 참조용)

> **목적**: 채팅 관련 오류가 다시 나올 때 *원인을 처음부터 다시 파지 않도록* 핵심 구조와 함정을 기록한다.
> 최종 갱신: 2026-06-22

---

## 🔑 가장 중요한 사실 — 등록은 3채널, 채팅 가능 여부는 `userId` 유무로 갈린다

마켓(`XinChaoDanggn`)·구인(`Jobs`)·부동산(`RealEstate`) 글은 **3개 채널**로 등록된다. 인앱 채팅방 ID 규칙이 `itemId_판매자uid_구매자uid` 라서 **글 문서에 작성자 `userId`(Firebase uid)가 있어야만** 채팅이 성립한다.

| 채널 | 코드 위치 | 로그인 | `userId` 저장? | 채팅 | 식별 |
|---|---|---|---|---|---|
| **앱** | `screens/AddItemScreen.js` 등 | 필수 | ✅ `userId: user.uid` | **됨** | `source` 필드 없음 |
| **웹** | `vnkorlife-web/app/(tabs)/{market,jobs,realestate}/new/page.tsx` | 필수 | ✅ `userId: user.uid` (76–77줄 부근) | **됨** | `source` 필드 없음 |
| **카카오톡 폼** | `public_html/form/{secondhand,jobs,realestate}/index.html` | ❌ 없음 | ❌ **의도적 `userId: null`** | **불가** | `source:'web'` + `formItemId` |

### ⚠️ 헷갈리기 쉬운 함정
- **카카오톡 폼이 `source:'web'`로 태깅한다.** 진짜 웹폼(vnkorlife-web)은 `source`를 안 쓴다. → `source:'web'` = "카카오톡 유입"이라고 읽어야 한다. (secondhand/index.html 802~803줄: `source:'web', formItemId, userId:null, userEmail:null`)
- 카카오 폼의 `email` 필드는 **선택 입력 연락처지 로그인 이메일이 아니다**(로그인 자체가 없음). 당근은 0건, 구인/부동산은 일부만. 신원으로 못 쓴다.
- 카카오 폼의 `kakaoId`는 **타이핑한 별명**(예 "merrygomround"). 앱 카카오로그인 식별자는 **숫자 profile.id** → 둘이 달라 매칭 불가.
- 실데이터(2026-06): 카카오 유입 글이 로그인 글보다 **많다** (당근 web 46/구인 56/부동산 62건, 매일 유입 중).

### 결론 / 처방
- 로그인 경로(앱·웹) 글은 **이미 채팅 정상**. 추가 작업 불필요.
- 카카오 폼 글은 **연결할 앱 계정이 없어 채팅 구조상 불가** → 연락처(카카오ID/전화)로만. **정상이며 어쩔 수 없음.**
- 카카오 폼에 로그인을 붙이면 채팅은 가능해지나 "마찰 없는 트래픽 유입"이라는 폼의 존재 목적을 죽임 → 권장 안 함. (대신 폼에 "앱으로 등록하면 실시간 채팅 가능" 공지 권유)

---

## 🐞 증상 1 — 채팅 누르면 "채팅방 정보를 불러올 수 없습니다" 후 튕김

- **진짜 원인**: 그 글이 **카카오톡 폼 등록 글이라 `item.userId`가 null**. `ChatRoomScreen`의 무결성 체크 `if (!sellerId || !currentUserId || !itemId)`에 걸려 alert + goBack. (코드 자체는 정상 동작, 메시지가 엉뚱했을 뿐)
- **오해 주의**: "로그인한 사람만 채팅 가능"으로 오해하기 쉬우나, 제한은 **받는 사람(판매자)** 쪽이다. 구매자는 누구나 가능.
- **조치(2026-06-22)**: 상세화면 `handleChat`에서 `!item.userId`면 죽은 채팅방으로 보내지 말고 **"게시자가 앱 미설치 → 연락처로 연락" 안내 팝업** 후 중단.
  - 당근: `screens/ItemDetailScreen.js` (키 `danggn:detail.chatUnavailableTitle/Msg`)
  - 구인: `screens/JobDetailScreen.js`, 부동산: `screens/RealEstateDetailScreen.js` (키 `common:chatUnavailableTitle/Msg`)

---

## 🐞 증상 2 — 화면 하단 고정 광고가 입력창/버튼을 가림 (특히 채팅방)

- **진짜 원인**: 고정 하단 배너 `FixedBottomBanner`는 **탭 네비게이터 레벨**(`App.js` `BottomTabNavigator`)에서 항상 떠 있고, 특정 화면에서만 `NO_AD_ROUTE_NAMES` 예외 목록으로 숨긴다. 채팅방 라우트 이름 `"ChatRoom"`이 목록에 없었다.
- **왜 일부 경로만?**: 숨김 판정 `isDetailPage`는 **현재 네비 스택에 이름이 `'상세'` 포함이거나 예외목록에 든 라우트가 있는지** 재귀 검사한다. 마켓 상세→채팅 경로는 스택에 `'당근/나눔 상세'`가 있어 *이미* 숨겨졌지만, **채팅목록→채팅방 경로(MenuStack)는 스택에 `'상세'`가 없어** 안 숨겨졌다.
- **조치(2026-06-22)**: `App.js` `NO_AD_ROUTE_NAMES`에 `'ChatRoom'` 추가. (집합 추가는 숨김만 늘리므로 회귀 없음)
- **재발 시 일반 규칙**: pushed 스크린(탭바 숨기는 화면 등)에서 하단 배너가 UI를 가리면 → 그 **라우트 이름을 `NO_AD_ROUTE_NAMES`에 추가**하면 된다. (`tabBarStyle:{display:'none'}`만으론 배너가 안 사라짐 — 배너는 탭 레벨 sibling이라 별개)

---

## 🐞 증상 3 — 뉴스탭 마켓카드 외부 링크가 앱에서만 안 열림 (investing.com)

- **증상**: 뉴스탭 정보박스(`MarketStrip`)의 주가·금·유가 버튼(kr.investing.com)이 **앱에서 안 열림**. 웹은 지역(VPN) 무관하게 정상.
- **국가 제한 아님**: 웹은 베트남 IP에서도 열림(사용자 확인). 앱·웹 링크도 동일(라이브 `/market` API로 확인). 즉 "여는 방식" 차이.
- **진짜 원인**: investing.com은 폰에 **Investing.com 앱이 깔려 있으면** OS가 링크를 그 앱으로 가로채고, 그 앱이 해당 페이지를 못 열어 무반응. 게다가 **investing.com은 인앱 브라우저(webview)에서도 자기 앱으로 튕기거나 webview를 막아** `WebBrowser`로도, `/go/` 리다이렉트 경유로도 실패.
- **조치(2026-06-23)**:
  1. 앱: `MarketStrip.js` `openLink` 를 `Linking.openURL` → `WebBrowser.openBrowserAsync`(expo-web-browser, 이미 설치)로 교체 — 앱링크 가로채기 우회 시도. (이것만으론 investing 못 살림)
  2. **근본 해결 — 소스 교체**: jenny 플러그인(`daily-news-final/wordpress-plugin/jenny-daily-news.php`)의 `/market` REST `links`와 웹 카드 링크를 **investing.com → 네이버 모바일 증권**으로 변경. `/go/{slug}` 경유(앱 가로채기 회피 + 클릭 집계). 앱은 API의 `links`만 받아쓰므로 **앱 OTA 불필요**, jenny 플러그인 FTP 업로드로 적용.
     - 주가 `m.stock.naver.com/domestic/index/KOSPI/total`
     - 금 `m.stock.naver.com/marketindex/home/metals`
     - 유가 `m.stock.naver.com/marketindex/home/energy`
     - (슬러그: `mkt_stock/mkt_gold/mkt_oil` in `jenny_affiliate_destinations()`)
- **함정**: 네이버 commodity *딥링크*(`/marketindex/metals/CMDT_GC`, `/energy/OIL_CL`)는 홈으로 튕긴다. SSR로 안정적인 **`/marketindex/home/{metals,energy}`** 카테고리 페이지를 써야 안 튕김. (배포 후 `/go/` 최종 착지 URL을 curl `-L -w %{url_effective}`로 *반드시* 확인할 것)
- **재발 시 일반 규칙**: 외부 링크가 *앱에서만* 안 열리면 → ① 그 사이트에 전용 앱이 있어 OS가 가로채는지 의심 ② `chaovietnam.co.kr/go/` 경유로 우회(초기 URL이 우리 도메인이라 가로채기 회피) ③ 그래도 안 되면(=그 사이트가 webview 자체를 막음) **앱으로 안 튕기는 사이트로 교체**. 마켓카드 링크는 jenny `/market` API의 `links`에서 옴(앱 하드코딩 아님).

---

## 관련
- 메모리: `project_marketplace_three_channels_chat`
- jenny 플러그인 = `daily-news-final/wordpress-plugin/jenny-daily-news.php` (chaovietnam.co.kr WordPress, **FTP 수동 배포**). 앱 `MarketStrip`은 `/market` REST 소비만.
- 전략 배경: 트래픽 vs 정보 균형 — 카카오 무료 유입은 자산화 대상
