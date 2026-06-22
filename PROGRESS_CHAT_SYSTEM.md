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

## 관련
- 메모리: `project_marketplace_three_channels_chat`
- 전략 배경: 트래픽 vs 정보 균형 — 카카오 무료 유입은 자산화 대상
