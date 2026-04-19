# 공지 배너 (Announcements) — 재사용 인프라 설계서

> 앱 내 임의의 화면에 관리자가 코드 변경 없이 공지/이벤트/프로모션 배너를
> 띄울 수 있는 **범용 인프라**. 최초 사용 사례는 "이웃사업 출시!" 알림.
>
> 최종 갱신: 2026-04-19
> 관련 문서: `SYSTEM_OVERVIEW.md`, `NEIGHBOR_BUSINESSES_PLAN.md`

---

## 1. 왜 필요한가

- "이웃사업 출시!", "씬짜오 오픈채팅 오픈", "신규 매거진", "앱 업데이트 안내" 등
  일회성 공지가 앞으로 자주 생길 것
- **매번 코드 수정해서 배포하면 너무 비용 큼** → 관리자가 Firebase에서 즉시 올리고 내릴 수 있는 시스템 필요
- 앞으로 다른 탭(당근/부동산 등)에서도 재사용 가능

---

## 2. 데이터 모델 (Firestore)

### 컬렉션: `Announcements`

```javascript
{
  id: "auto",

  // 콘텐츠 (i18n 지원)
  title: {
    ko: "새로운 서비스 출시!",
    vi: "Dịch vụ mới ra mắt!",
    en: "New service launched!"
  },
  message: {
    ko: "우리 이웃 제품/업소 소개를 확인하세요",
    vi: "Khám phá sản phẩm/cửa hàng của hàng xóm",
    en: "Discover neighbor products/businesses"
  },
  icon: "megaphone",                                   // Ionicons 이름

  // 액션 (선택)
  link: {
    type: "internal",                                  // internal | external | kakao
    target: "NeighborBusinesses",                      // internal이면 스크린 이름, external이면 URL
    label: { ko: "바로가기", vi: "Xem ngay", en: "Go" }
  },

  // 표시 설정
  active: true,
  priority: 10,                                        // 여러 개 활성 시 가장 높은 것 노출
  startDate: "2026-04-19",
  endDate: "2026-05-19",

  // 타겟팅
  targetScreens: ["News"],                             // 어느 화면에서 표시 (복수 가능)
  targetLanguages: [],                                 // 빈 배열이면 전체. ["ko"] 등 지정 가능
  targetCities: [],                                    // 빈 배열이면 전체

  // 스타일
  style: "announcement",                               // info | announcement | event | warning | promo
  backgroundColor: null,                               // style 기본값 덮어쓰기 (선택)
  textColor: null,

  // UX
  dismissible: true,                                   // 사용자가 X로 닫을 수 있는지
  showOnce: false,                                     // 한 번 닫으면 다시 안 뜨게 (AsyncStorage 활용)

  // 통계
  impressionsCount: 0,
  clicksCount: 0,
  dismissCount: 0,

  // 메타
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: "admin",
}
```

### 스타일 프리셋

```javascript
const ANNOUNCEMENT_STYLES = {
  info:         { bg: "#E3F2FD", text: "#0D47A1", icon: "information-circle" },
  announcement: { bg: "#FFF3E0", text: "#E65100", icon: "megaphone" },
  event:        { bg: "#F3E5F5", text: "#6A1B9A", icon: "gift" },
  warning:      { bg: "#FFEBEE", text: "#B71C1C", icon: "warning" },
  promo:        { bg: "#E8F5E9", text: "#1B5E20", icon: "pricetag" },
}
```

---

## 3. Firestore 보안 규칙

```
match /Announcements/{docId} {
  // 누구나 읽기 가능
  allow read: if resource.data.active == true
              && resource.data.endDate >= string(request.time.toMillis());

  // 쓰기는 관리자만
  allow create, update, delete: if request.auth != null
                                && request.auth.token.admin == true;

  // impressionsCount/clicksCount/dismissCount는 모든 사용자가 증가 가능 (통계용)
  // (Firestore rules에서 특정 필드만 증가 허용은 별도 규칙 함수 필요)
}
```

※ 카운터 증가는 보안 규칙에서 세부 제어하거나, Cloud Function으로 중계하는 방법 검토 필요.

---

## 4. UI 컴포넌트: `<AnnouncementBanner />`

### Props
```jsx
<AnnouncementBanner
  targetScreen="News"         // 이 화면용 배너만 조회
  style={customStyle}          // 선택 (레이아웃 조정)
/>
```

### 내부 동작
1. 마운트 시 Firestore 쿼리:
   ```javascript
   db.collection('Announcements')
     .where('active', '==', true)
     .where('targetScreens', 'array-contains', targetScreen)
     .where('endDate', '>=', today)
     .orderBy('endDate')
     .orderBy('priority', 'desc')
     .limit(1)                              // Phase 1: 하나만
     .get()
   ```
2. 언어 필터 (`targetLanguages`가 비어있지 않으면 현재 i18n 언어와 매칭)
3. `showOnce` 배너라면 AsyncStorage에서 `announcement_dismissed_${id}` 체크 → 이미 닫았으면 스킵
4. 배너 렌더링
5. `impressionsCount` +1 (한 번만)

### 렌더링 구조
```jsx
<View style={[styles.banner, { backgroundColor }]}>
  <Ionicons name={icon} size={20} color={textColor} />
  <View style={styles.content}>
    <Text style={styles.title}>{title[lang]}</Text>
    <Text style={styles.message}>{message[lang]}</Text>
  </View>
  {link && (
    <TouchableOpacity onPress={handleClick}>
      <Text style={styles.linkLabel}>{link.label[lang]}</Text>
    </TouchableOpacity>
  )}
  {dismissible && (
    <TouchableOpacity onPress={handleDismiss}>
      <Ionicons name="close" size={18} />
    </TouchableOpacity>
  )}
</View>
```

### 액션 처리
- **link.type === "internal"**: `navigation.navigate(link.target)` → `clicksCount` +1
- **link.type === "external"**: `Linking.openURL(link.target)` → `clicksCount` +1
- **link.type === "kakao"**: `Linking.openURL('kakaoopen://...')` 또는 대체 → `clicksCount` +1
- **닫기**: AsyncStorage에 ID 저장 + `dismissCount` +1 + 컴포넌트 hide

---

## 5. 사용 예시

### 뉴스 탭 상단에 배치
```jsx
// screens/NewsScreen.js (또는 MagazineScreen.js)
import AnnouncementBanner from '../components/AnnouncementBanner';

<View>
  <SearchBar />
  <AnnouncementBanner targetScreen="News" />
  <NewsList />
</View>
```

### 당근 탭 등 다른 화면 추가 시
```jsx
<AnnouncementBanner targetScreen="Danggn" />
```

즉, **화면에는 컴포넌트만 두 번 쓰면 끝**. 데이터는 Firestore가 관리.

---

## 6. 관리자 UI (AdminScreen 확장)

`screens/AdminScreen.js`에 "공지 배너 관리" 섹션 추가:
- 목록: 현재 활성 + 예약 + 만료 분리 표시
- 신규 등록 폼:
  - 제목/메시지 (한국어 필수, 베트남어/영어 선택)
  - 스타일 프리셋 선택
  - 링크 설정 (없음 / 내부스크린 / 외부URL / 카톡)
  - 노출 기간 (시작/종료 DatePicker)
  - 타겟 화면 체크박스 (News / Home / Danggn / Jobs / RealEstate / NeighborBusinesses)
  - 언어 타겟 (선택)
  - dismissible / showOnce 스위치
- 수정/삭제/비활성화

---

## 7. 사용 시나리오 예시

### 시나리오 1: "이웃사업 출시!" (Phase 1 출시일)
```javascript
{
  title: { ko: "새로운 서비스 출시! 🎉", ... },
  message: { ko: "이웃사업 탭에서 우리 이웃 업소를 만나보세요", ... },
  style: "announcement",
  link: { type: "internal", target: "NeighborBusinesses", label: { ko: "둘러보기", ... } },
  targetScreens: ["News"],
  dismissible: true,
  showOnce: true,
  startDate: "2026-04-19", endDate: "2026-05-19",
  priority: 100,
}
```

### 시나리오 2: 씬짜오 오픈채팅 안내
```javascript
{
  title: { ko: "씬짜오 오픈채팅 오픈!", ... },
  message: { ko: "실시간으로 교민들과 소통하세요", ... },
  style: "event",
  link: { type: "external", target: "https://open.kakao.com/...", label: { ko: "참여하기", ... } },
  targetScreens: ["News", "Home"],
  dismissible: true,
  showOnce: false,
  priority: 50,
}
```

### 시나리오 3: 앱 점검 공지
```javascript
{
  title: { ko: "서버 점검 안내", ... },
  message: { ko: "4/25 02:00~04:00 점검 예정", ... },
  style: "warning",
  link: null,
  targetScreens: ["Home", "News", "Danggn", "Jobs", "RealEstate", "NeighborBusinesses"],
  dismissible: false,
  priority: 200,
}
```

---

## 8. 구현 순서 (체크리스트)

- [ ] **1.** Firestore 보안 규칙 (위 §3)
- [ ] **2.** `utils/announcementStyles.js` — 스타일 프리셋
- [ ] **3.** `components/AnnouncementBanner.js` — UI 컴포넌트
- [ ] **4.** `services/announcementService.js` — Firestore 쿼리 / 통계 업데이트 / AsyncStorage
- [ ] **5.** `screens/NewsScreen.js`(또는 `MagazineScreen.js`)에 `<AnnouncementBanner targetScreen="News" />` 삽입
- [ ] **6.** AdminScreen에 "공지 배너 관리" 섹션 추가 (목록/등록/수정)
- [ ] **7.** Cloud Function 검토 (카운터 증가용) — 또는 보안 규칙으로 해결
- [ ] **8.** "이웃사업 출시!" 배너 1건 등록 후 동작 확인

---

## 9. 확장 여지 (Phase 2+)

- **캐러셀**: 여러 배너 동시 노출 + 자동 회전 (현재는 우선순위 1개만)
- **A/B 테스트**: 같은 메시지 두 버전으로 노출 → 클릭률 비교
- **세그먼트 타겟팅**: 로그인/비로그인, 가입 N일, 마지막 방문 등
- **유료 공지 슬롯**: 이웃사업 등록자가 돈 내고 공지 배너에 노출
- **웹 연동**: vnkorlife.com과 WP에도 같은 컬렉션 기반으로 배너 노출

---

## 10. 주의사항

- **`title`, `message`는 반드시 한국어(ko) 키 필수**. 베트남어/영어는 없으면 한국어 폴백
- `endDate` 지난 배너는 자동으로 조회 안 됨 (Firestore 쿼리 조건)
- `showOnce` 배너를 테스트할 땐 AsyncStorage의 `announcement_dismissed_*` 키 수동 삭제
- 관리자 토큰(`admin: true` 커스텀 클레임) 설정 필수 (공통 인프라)
