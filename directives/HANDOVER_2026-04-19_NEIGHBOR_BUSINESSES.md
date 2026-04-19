# 세션 인수인계 — 이웃사업 기능 + 공지 배너 인프라

> 2026-04-19 Cowork 세션에서 작업한 내용을 VS Code / Claude Code 등 다른 IDE로
> 이어받기 위한 **인수인계 문서**. 이 문서를 읽으면 다음 AI 세션이 현재 상태를
> 정확히 파악하고 이어서 작업할 수 있다.
>
> 작업자: Cowork 세션 (Claude)
> 다음 작업자: VS Code + Claude Code (같은 모델)

---

## 0. 시작하기 전에 읽을 문서 (순서대로)

1. `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` — 최상위 원칙 (§5 자체점검 규칙 포함)
2. `directives/AGENT_WORKFLOW.md` — **자체점검 프로토콜. 모든 작업 후 필수.**
3. `directives/SYSTEM_OVERVIEW.md` — 전체 시스템 지도
4. `directives/NEIGHBOR_BUSINESSES_PLAN.md` — 이웃사업 기능 설계서
5. `directives/ANNOUNCEMENTS_PLAN.md` — 공지 배너 인프라 설계서
6. 본 문서 (마지막으로)

---

## 1. 이번 세션 성과 요약

**완료된 범위 (Round 1 + Round 3, 앱 코드 전체)**:
- ✅ 하단 탭 구조 5개 → 6개 (이웃사업 추가, 라벨 단축, G1 디자인)
- ✅ Firestore 컬렉션 2개 신규: `NeighborBusinesses`, `Announcements`
- ✅ 이웃사업 전체 기능 구현 (목록/상세/관리자 등록 폼)
- ✅ 재사용 가능한 공지 배너 인프라
- ✅ 뉴스 탭에 공지 배너 배선
- ✅ AdminScreen에 이웃사업 관리 버튼
- ✅ 설계 문서 4개 작성

**보류된 범위 (Round 2, 외부 작업 필요)**:
- ⏳ Firestore 보안 규칙 배포
- ⏳ 관리자 커스텀 클레임 설정
- ⏳ 복합 인덱스 생성
- ⏳ 개발 빌드 + 실기기 테스트
- ⏳ 테스트 데이터 등록

---

## 2. 파일 변경 내역 (이번 세션 한정)

### 🆕 신규 파일 (12개)

| 경로 | 목적 |
|---|---|
| `components/AnnouncementBanner.js` | 재사용 공지 배너 UI 컴포넌트 (`<AnnouncementBanner targetScreen="News" />`) |
| `services/announcementService.js` | 공지 Firestore 조회/dismiss/트래킹 (8 함수) |
| `services/neighborBusinessService.js` | 이웃사업 CRUD + Firebase Storage 업로드 (12 함수) |
| `screens/NeighborBusinessesScreen.js` | 이웃사업 탭 메인: 필터/최근등록/목록/empty state/관리자 FAB |
| `screens/NeighborBusinessDetailScreen.js` | 상세: 이미지 슬라이더, 연락처 6종, 지도, 공유, 관리자 수정/삭제 |
| `screens/AddNeighborBusinessScreen.js` | 관리자 등록·수정 폼 (이미지 10장, 전체 필드, 검증) |
| `utils/announcementStyles.js` | 공지 스타일 프리셋 5종 (info/announcement/event/warning/promo) |
| `directives/SYSTEM_OVERVIEW.md` | 전체 시스템 지도 (서비스 4개, 저장소 3개, 광고 통합 로드맵) |
| `directives/NEIGHBOR_BUSINESSES_PLAN.md` | 이웃사업 설계서 (스키마/UI/구현 체크리스트) |
| `directives/ANNOUNCEMENTS_PLAN.md` | 공지 배너 설계서 |
| `directives/AGENT_WORKFLOW.md` | 자체점검 프로토콜 SOP |
| `tab_design_preview.html` | **작업용 미리보기** — repo에 둘 필요 없음, 삭제 또는 `.gitignore` 추가 권장 |

### ✏️ 수정 파일 (8개)

| 경로 | 변경 요약 |
|---|---|
| `App.js` | ① NeighborBusinesses/Detail/Add 3개 screen import 추가 (225-227줄) ② `NeighborBusinessesStack` 함수 신규 추가 (Detail/Add 포함 3개 Screen) ③ `tabLabels`에 "이웃사업" 추가 ④ `screenOptions` G1 디자인: `tabBarItemStyle` 개별 flex, borderRight 구분선, icon size 20, fontWeight 500 ⑤ `Tab.Screen name="이웃사업"` 삽입 (당근/나눔과 구인구직 사이) |
| `AGENTS.md` | Operating Principles §5 자체점검 규칙 추가 |
| `CLAUDE.md` | 동일 (미러) |
| `GEMINI.md` | 동일 (미러) |
| `i18n/locales/ko/navigation.json` | `tabs.danggn`: "당근/나눔" → "당근" / `tabs.jobs`: "구인구직" → "일자리" / `tabs.neighborBusinesses: "이웃사업"` 신규 |
| `i18n/locales/vi/navigation.json` | `tabs.neighborBusinesses: "Cửa hàng"` 신규 |
| `i18n/locales/en/navigation.json` | `tabs.neighborBusinesses: "Local Biz"` 신규 |
| `screens/AdminScreen.js` | 헤더와 통계 사이에 "이웃사업 관리" 빠른 작업 버튼 + 관련 스타일 3개 추가 |
| `screens/MagazineScreen.js` | `AnnouncementBanner` import 및 `ListHeaderComponent` 최상단에 `<AnnouncementBanner targetScreen="News" />` 삽입 |

### ⚠️ 내가 건드리지 않았지만 이미 수정된 파일들
git status 확인 시 **167개**의 modified 파일이 있는데, **대부분 이전 세션(Google 로그인 수정, 플러그인 작업 등)의 누적 변경**임. 이번 세션이 건드린 파일은 위 표 **8개만**. 커밋 시 혼동 방지 위해 선별 add 권장.

---

## 3. 주요 설계 결정 (왜 이렇게 했는지)

### 3.1 데이터 저장: Firestore 단일 DB
- 초기 검토에서 WP CPT도 고려했으나, vnkorlife.com과 앱이 Firebase를 이미 공유하는 점을 살려 **커뮤니티성 콘텐츠는 Firebase**라는 시스템 철학과 일치시킴
- 장점: 3개 면(앱/vnkorlife/WP 사이드바)에서 모두 동일 데이터 소스 바라보기 가능

### 3.2 탭 디자인: G1 (불균등 너비 + 옅은 실선 구분선)
- 라벨 글자수에 비례한 flex 값 (`홈/뉴스 0.8` ~ `이웃사업 1.3`)
- 미니멀 outline 아이콘 20px + 옅은 구분선 `#e5e5e5`
- **결정 근거**: `tab_design_preview.html` 실물 비교 (옵션 G1 채택)
- **중요**: Stack.Screen `name`은 기존대로 "당근/나눔", "구인구직" 유지 → 기존 `navigation.navigate()` 호출 코드 영향 0
  - 바뀐 건 사용자에게 보이는 **라벨 뿐** (i18n)

### 3.3 관리자 등록 방식: Phase 1은 앱 내 FAB
- Firebase Console 수동 입력이 아니라 **앱에서 직접 폼으로** 등록
- AdminScreen → 이웃사업 탭 이동 → 우측 하단 FAB → 등록 폼
- Phase 2: 스키마에 `submittedBy`, `paymentStatus`, `approvalStatus` 이미 준비됨 → 마이그레이션 없이 일반 사용자 유료 등록 확장 가능

### 3.4 공지 배너: 범용 인프라로 분리
- "이웃사업 출시!" 1회용 기능으로 안 짜고 **재사용 가능한 `Announcements` 컬렉션 + `<AnnouncementBanner>` 컴포넌트**로 구현
- 앞으로 "씬짜오 오픈채팅 오픈", "서버 점검 공지" 등 모든 공지를 코드 수정 없이 관리자가 Firestore에서 올리고 내릴 수 있음
- i18n 지원 (title/message가 객체 `{ko, vi, en}` 형식)

### 3.5 자체점검 프로토콜 도입 (사용자 요청)
- 모든 작업 후 A~F 체크리스트 + 보고 형식 강제
- CLAUDE.md/AGENTS.md/GEMINI.md §5에 규칙 등재
- `directives/AGENT_WORKFLOW.md`에 상세 템플릿
- **예외 없음**. 작은 수정이든 큰 리팩터링이든 동일 적용

---

## 4. 다음 세션이 해야 할 일 (우선순위 순)

### 🔥 Step 1. git 정리 및 커밋 (필수, 최우선)

**문제**: 167개 modified 파일 중 이번 세션 변경은 8개 + 신규 12개만.

**해결**: 새 브랜치 + 선별 커밋

```bash
cd C:\chao-vn-app-native\chao-vn-app
git checkout -b feature/neighbor-businesses

# 신규 파일 (11개, tab_design_preview.html 제외)
git add components/AnnouncementBanner.js \
  services/announcementService.js \
  services/neighborBusinessService.js \
  screens/NeighborBusinessesScreen.js \
  screens/NeighborBusinessDetailScreen.js \
  screens/AddNeighborBusinessScreen.js \
  utils/announcementStyles.js \
  directives/SYSTEM_OVERVIEW.md \
  directives/NEIGHBOR_BUSINESSES_PLAN.md \
  directives/ANNOUNCEMENTS_PLAN.md \
  directives/AGENT_WORKFLOW.md \
  directives/HANDOVER_2026-04-19_NEIGHBOR_BUSINESSES.md

# 수정 파일 (8개)
git add App.js \
  AGENTS.md CLAUDE.md GEMINI.md \
  screens/AdminScreen.js \
  screens/MagazineScreen.js \
  i18n/locales/ko/navigation.json \
  i18n/locales/vi/navigation.json \
  i18n/locales/en/navigation.json

git commit -m "feat: 이웃사업 탭 + 재사용 공지 배너 + 자체점검 프로토콜

- 6탭 구조 (이웃사업 신규) + G1 디자인 (불균등 너비 + 얇은 구분선)
- NeighborBusinesses Firestore 컬렉션: 관리자 등록/상세/수정/삭제 + 이미지 10장
- Announcements 재사용 배너 인프라: i18n/스타일프리셋/dismiss/트래킹
- 뉴스 탭 상단 공지 배너 배선
- 자체점검 프로토콜 SOP 도입 (CLAUDE.md §5)
- Phase 2 유료 확장 대비 스키마 포함
"

# tab_design_preview.html 처리 (둘 중 하나)
#   (a) 삭제: rm tab_design_preview.html
#   (b) .gitignore 추가
echo "tab_design_preview.html" >> .gitignore
```

**이전 세션들의 누적 변경(159개)은 별개 판단** — 내용을 살펴보고 필요한 것만 별도 커밋 권장. 본 세션 작업과는 분리.

### 🔥 Step 2. Firebase 보안 규칙 배포

`firestore.rules`에 아래 블록 추가 (기존 규칙 보존):

```
match /databases/{database}/documents {
  // ... 기존 규칙 ...

  // NeighborBusinesses
  match /NeighborBusinesses/{docId} {
    allow read: if resource.data.active == true
                && resource.data.approvalStatus == "approved";
    allow create, update, delete: if request.auth != null
                && request.auth.token.admin == true;
  }

  // Announcements
  match /Announcements/{docId} {
    allow read: if resource.data.active == true;
    allow create, update, delete: if request.auth != null
                && request.auth.token.admin == true;
  }
}
```

그리고 Storage 규칙에 `neighbor_businesses/**` 경로 관리자 쓰기 허용 추가.

배포:
```bash
firebase deploy --only firestore:rules,storage
```

### 🔥 Step 3. 관리자 커스텀 클레임 (결정 필요)

현재 AdminScreen은 **이메일 목록 방식** (`younghan146@gmail.com` 포함)이지만, Firestore 보안 규칙의 `token.admin == true`는 **Firebase Auth 커스텀 클레임**이 필요. 두 가지 옵션:

**(A) Cloud Function으로 1회 클레임 부여 (안전)**
```javascript
// functions/setAdminClaim.js (임시)
const admin = require('firebase-admin');
admin.initializeApp();

exports.setAdminClaim = functions.https.onRequest(async (req, res) => {
  const uid = 'YOUR_UID';  // Firebase Console에서 Auth > Users로 확인
  await admin.auth().setCustomUserClaims(uid, { admin: true });
  res.send('OK');
});
```
배포 후 1회 호출, 사용자 재로그인, 함수 삭제.

**(B) 보안 규칙을 이메일 기반으로 변경 (간단)**
```
allow create, update, delete: if request.auth != null
    && (request.auth.token.email == "younghan146@gmail.com"
     || request.auth.token.email == "info@chaovietnam.co.kr");
```
덜 안전하지만 즉시 가능. AdminScreen의 이메일 목록과 일관성.

**권장**: 프로덕션은 (A), 급하면 (B)로 시작.

### 🔥 Step 4. 복합 인덱스 생성

Firestore 쿼리 실행 시 에러 나면 Firebase Console에 "인덱스 만들기" 링크가 자동으로 뜸. 또는 미리 생성:

- `NeighborBusinesses`: `active` + `approvalStatus` + `city` + `priority DESC`
- `NeighborBusinesses`: `active` + `approvalStatus` + `createdAt DESC`
- `Announcements`: `active` + `targetScreens` (array-contains) + `endDate` + `priority DESC`

### 🔥 Step 5. 개발 빌드 + 실기기 테스트

```bash
npx expo run:android   # 또는 ios
```

**체크리스트**:
- [ ] 하단 탭 6개, 이웃사업이 가장 넓게 표시
- [ ] 이웃사업 탭: empty state 메시지 ("우리 이웃의 제품이나 사업 내용을 홍보하는 자리로 관리자만 등록할 수 있습니다.")
- [ ] 관리자 로그인 → 이웃사업 탭 → FAB로 등록 폼 진입 가능
- [ ] 등록 폼: 이미지 10장까지, 필수 검증(이름/설명/연락처1개/이미지1장), 저장 성공
- [ ] 목록에 등록한 업소 카드 노출, "최근 등록" 가로 스트립 상단 표시
- [ ] 상세 화면: 이미지 슬라이더 작동, 전화/카톡/이메일/웹사이트 액션
- [ ] 지도 표시 (도시/구 기반, react-native-maps)
- [ ] 공유 버튼 작동
- [ ] 관리자: 상세에서 수정/삭제 가능
- [ ] 뉴스 탭: Announcements에 테스트 공지 1건 추가 후 배너 표시되는지
- [ ] X 버튼으로 공지 닫기 → `showOnce: true`면 재시작 후에도 안 뜸
- [ ] AdminScreen → "이웃사업 관리" 버튼 → 이웃사업 탭으로 이동

### 🔥 Step 6. 테스트 데이터 등록

1. 관리자 계정으로 로그인
2. 이웃사업 탭 → FAB → 등록 폼
3. 테스트 업소 5~10건 등록 (호치민/하노이 섞어서, 카테고리 다양하게)
4. Firebase Console에서 직접 공지 1건 추가:
   ```json
   {
     "active": true,
     "priority": 100,
     "targetScreens": ["News"],
     "title": { "ko": "새로운 서비스 출시! 🎉" },
     "message": { "ko": "이웃사업 탭에서 우리 이웃 업소를 만나보세요" },
     "style": "announcement",
     "link": {
       "type": "internal",
       "target": "이웃사업",
       "label": { "ko": "둘러보기" }
     },
     "dismissible": true,
     "showOnce": true,
     "endDate": "2026-06-30",
     "createdAt": <timestamp>
   }
   ```

---

## 5. 향후 작업 (이번 세션 범위 밖, 문서화만)

### Phase 1b — 다음 라운드
- vnkorlife.com `/businesses` 라우트 구현 (별도 레포)
- Smart Link 확장 (`chaovn-deeplink-handler` 플러그인)
- WP `/daily-news-terminal/` 좌측 사이드바에 `chaovn-neighbor-sidebar` 플러그인 (티저 카드)
- 앱 설치 유도 배너

### Phase 2 — 유료 사용자 제출
- 로그인 사용자 제출 폼 (비관리자)
- 결제 연동 (카카오페이 / Stripe / 베트남 결제)
- 관리자 승인 워크플로우 (`approvalStatus: pending → approved`)
- 사용자당 월 N건 제한

### 공지 배너 Phase 2
- 캐러셀 (여러 공지 동시 회전)
- AdminScreen에 공지 관리 UI (현재는 Firebase Console에서 수동)
- A/B 테스트

### 광고 통합 장기 로드맵
`SYSTEM_OVERVIEW.md` §7 참조 — 현재 광고 시스템 4개(Ads Inserter / chaovn-ad-api / Jenny jenny-ad / vnkorlife 자체)를 **WP 축 + Native 축 2개로** 통합하는 장기 계획.

---

## 6. 알려진 주의사항

1. **Firestore 인덱스**: 앱 첫 실행 시 쿼리 에러가 로그에 뜰 가능성 — 에러 메시지의 링크를 클릭해서 자동 인덱스 생성 (또는 위 Step 4 수동 생성)
2. **이미지 업로드**: 로컬 URI → Firebase Storage. 네트워크 느리면 10장 업로드 1~2분 소요 가능. 현재 순차 업로드 (병렬 X)
3. **서비스 함수 내부 에러**: 모두 `console.warn` + 폴백 반환 (null/빈배열) 패턴. 사용자 UI에 예외 전파 안 됨 → 디버깅 시 react-native logger 확인
4. **AuthContext의 `isAdmin`은 함수**: 현재 이웃사업 화면들에서 `auth.isAdmin()` 함수 호출식으로 올바르게 사용. 새 화면 만들 때 주의 (boolean으로 착각 금지)
5. **Stack.Screen name은 한국어**: `"이웃사업 메인"`, `"이웃사업 상세"`, `"이웃사업 등록"`. 기존 프로젝트 컨벤션 따름.
6. **tab_design_preview.html**: 작업용 미리보기 파일. repo에 남겨둘 필요 없음 (삭제 또는 `.gitignore` 추가)

---

## 7. 자체점검 프로토콜 (계속 준수 필수)

다음 세션의 모든 작업 후 반드시:

```
### 1. 변경 요약 (파일 표)
### 2. 자체점검 결과 (A~F ✅/❌/N/A)
### 3. 사용자 확인 필요 사항
### 4. 다음 단계 제안
```

상세: `directives/AGENT_WORKFLOW.md`

---

## 8. 질문이나 혼란이 있으면

- **설계 이유**: `directives/` 해당 PLAN 문서 참조
- **코드 수정 범위 판단**: CLAUDE.md §4 (절대 불필요한 수정 금지)
- **자체점검 누락**: CLAUDE.md §5 + AGENT_WORKFLOW.md
- **아키텍처 전체 감각**: SYSTEM_OVERVIEW.md

AI가 바뀌어도 이 문서들을 순서대로 읽으면 상황 파악 + 이어서 작업 가능.
