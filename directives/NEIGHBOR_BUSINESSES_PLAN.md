# 이웃사업 (우리 이웃 제품/업소) — 구현 설계서

> 교민 이웃이 운영하는 제품/업소를 등록하고, **앱·웹·WP 사이드바** 3면에 노출해
> 앱 설치와 웹 방문을 상호 유도하는 새로운 서비스.
>
> 최종 갱신: 2026-04-19
> 관련 문서: `SYSTEM_OVERVIEW.md`, `ANNOUNCEMENTS_PLAN.md`

---

## 1. 목표와 범위

### 비즈니스 목표
- 교민 이웃의 소규모 사업 홍보 허브 구축
- **크로스 프로모션 루프** 설계: WP 독자 → 앱 설치 / 앱 사용자 → 웹 공유 → 방문자 증가
- Phase 2에서 **유료 광고 상품**으로 수익화 (월·분기 단위 슬롯)

### Phase 1 (이번 구현 범위 — MVP)
1. Firebase 스키마 + 보안 규칙
2. 앱: 6번째 탭 "이웃사업" 추가 + 목록/상세/관리자 등록 화면
3. 앱: 뉴스 탭 상단에 공지 배너 추가 (`ANNOUNCEMENTS_PLAN.md` 참조) — "이웃사업 출시!" 공지
4. 관리자 계정으로 테스트 데이터 10건 등록
5. WP `chaovn-neighbor-sidebar` 플러그인으로 /daily-news-terminal/ 좌측 사이드바에 카드 티저 노출

### Phase 1b (다음 라운드)
- vnkorlife.com `/businesses` 라우트 (별도 레포 작업, 현재 세션 범위 밖)
- Smart Link 확장 (`chaovn-deeplink-handler`) — 앱 설치 여부에 따라 앱/웹으로 분기
- 앱 설치 유도 배너 (vnkorlife.com 상·하단)

### Phase 2 (나중)
- 로그인 사용자 제출 폼
- 결제 연동 (카카오페이 / Stripe / 베트남 결제)
- 관리자 승인 워크플로우 (`approvalStatus: pending → approved`)
- 사용자당 월 N건 제출 제한, 스팸 방지

---

## 2. 데이터 모델 (Firestore)

### 컬렉션: `NeighborBusinesses`

```javascript
{
  // 기본
  id: "auto",
  name: "김치찌개 맛집 할매네",                       // 필수, 1~50자
  description: "30년 전통 한식당, 직접 담근 김치로...", // 필수, 200자+ (textarea)
  listingType: "business",                              // business | product
  category: "food",                                     // food | service | shopping | lodging | beauty | health | education | other
  tags: ["한식", "김치찌개", "배달"],                   // 검색용, 최대 10개

  // 지역 (필수 필터 축)
  city: "호치민",                                       // VIETNAM_LOCATIONS의 key
  district: "Q1",                                       // VIETNAM_LOCATIONS[city].districts 중 하나
  address: "123 Đường Nguyễn Huệ, Quận 1",              // 상세 주소 (선택)
  location: { lat: 10.7769, lng: 106.7009 },            // 지도 좌표 (선택, LocationMap 컴포넌트 재사용)

  // 연락처 (다중, 모두 선택)
  contacts: {
    phone: "+84 90 123 4567",
    kakaoId: "halmae123",
    kakaoOpenChat: "https://open.kakao.com/...",
    zalo: "+84 90 123 4567",                            // 베트남에서 많이 쓰는 메신저
    email: "halmae@example.com",
    website: "https://halmae.vn",
  },

  // 영업 정보 (선택)
  businessHours: {
    mon: "10:00-22:00", tue: "10:00-22:00", wed: "10:00-22:00",
    thu: "10:00-22:00", fri: "10:00-22:00", sat: "10:00-22:00",
    sun: "휴무"
  },
  holidayNote: "매주 일요일 휴무",

  // 이미지 (Firebase Storage)
  images: ["url1", "url2", ...],                        // 최대 10장
  thumbnailIndex: 0,                                     // 대표 이미지 인덱스

  // 외부 링크 (선택)
  externalLink: null,                                    // 상세보기 버튼이 외부로 이동할 경우

  // 노출 제어
  active: true,
  priority: 10,                                          // 높을수록 상위
  startDate: "2026-04-19",                               // ISO
  endDate: "2026-12-31",

  // 통계
  viewsCount: 0,
  clicksCount: 0,                                        // 상세보기 / 전화 / 카톡 클릭 합산
  favoritesCount: 0,
  contactClicks: { phone: 0, kakao: 0, email: 0, website: 0 },

  // Phase 2 대비 (현재는 기본값)
  submittedBy: null,                                     // 사용자 UID
  paymentStatus: null,                                   // "paid" | "pending" | null
  paymentInfo: null,
  approvalStatus: "approved",                            // Phase 1은 관리자가 직접 등록 → 즉시 승인

  // 메타
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: "admin",                                    // Phase 1: 항상 "admin", Phase 2: 사용자 UID
}
```

### 카테고리 값 (i18n)

```javascript
const NEIGHBOR_BUSINESS_CATEGORIES = {
  food:      { ko: "음식점",   vi: "Nhà hàng",   en: "Food" },
  service:   { ko: "서비스",   vi: "Dịch vụ",    en: "Service" },
  shopping:  { ko: "쇼핑",     vi: "Mua sắm",    en: "Shopping" },
  lodging:   { ko: "숙박",     vi: "Lưu trú",    en: "Lodging" },
  beauty:    { ko: "미용",     vi: "Làm đẹp",    en: "Beauty" },
  health:    { ko: "병원/약국", vi: "Y tế",       en: "Health" },
  education: { ko: "교육",     vi: "Giáo dục",   en: "Education" },
  other:     { ko: "기타",     vi: "Khác",       en: "Other" },
}
```

### 지역 데이터
기존 `utils/vietnamLocations.js`의 `VIETNAM_LOCATIONS`를 그대로 재사용.
(호치민/하노이/다낭/냐짱/붕따우/빈증/동나이 + 구/군)

---

## 3. Firestore 보안 규칙 (Phase 1)

```
match /NeighborBusinesses/{docId} {
  // 비로그인 사용자도 활성 업소는 읽기 가능 (WP 사이드바에서 Firebase Web SDK로 조회)
  allow read: if resource.data.active == true
              && resource.data.approvalStatus == "approved"
              && (resource.data.endDate == null
                  || resource.data.endDate >= string(request.time.toMillis()));

  // 쓰기는 관리자 커스텀 클레임 보유자만 (Phase 1)
  allow create, update, delete: if request.auth != null
                                && request.auth.token.admin == true;
}
```

Phase 2에서는 `submittedBy == request.auth.uid`인 본인 문서 쓰기 허용 규칙 추가.

---

## 4. 앱 구조 (chao-vn-app)

### 4.1 하단 탭 업데이트
`App.js`의 `Tab.Navigator` 수정:

- 기존 5개 → 6개로 확장
- 탭 구조, 아이콘, flex 비율은 `SYSTEM_OVERVIEW.md` §6 참조
- **추가 필요한 변경**:
  - `NeighborBusinessesStack` import
  - `DanggnStack` 라벨: "당근/나눔" → "당근"
  - `JobsStack` 라벨: "구인구직" → "일자리"
  - `screenOptions.tabBarItemStyle`에 개별 flex 적용
  - 얇은 실선 구분선: `borderRightWidth: 1, borderRightColor: '#e5e5e5'` + 마지막 탭 제외
  - 아이콘 `size={20}`로 축소
  - 폰트 weight: 비활성 500 / 활성 600

### 4.2 신규 화면 3개

**`screens/NeighborBusinessesScreen.js`** (목록):
- 상단: 검색창 + 도시 드롭다운 + 구 드롭다운 + 카테고리 칩
- 본문: FlatList로 카드 그리드 (RealEstateScreen 패턴 재사용)
- 카드 요소: 썸네일, 이름, 카테고리 배지, 도시·구, 설명 1~2줄
- 하단: 등록 FAB (관리자만 보임)

**`screens/NeighborBusinessDetailScreen.js`** (상세):
- 상단: 이미지 슬라이더 (최대 10장) — `react-native-image-viewing` 활용
- 중단: 이름 / 카테고리 / 지역 / 긴 설명(200자+)
- **액션 버튼 영역**:
  - 📞 전화 → `Linking.openURL('tel:...')`
  - 💬 카톡 ID 복사 + 오픈채팅 열기
  - ✉️ 이메일 열기
  - 🌐 웹사이트 열기
- 지도 (좌표 있을 때) — 기존 `LocationMap.js` 재사용
- 영업시간 표
- 찜하기 (`BookmarksScreen`과 연동)
- 공유 — 스마트 링크 생성 (`shareService.js` 활용)

**`screens/AddNeighborBusinessScreen.js`** (관리자 등록/수정):
- Phase 1: AdminScreen에서만 접근
- 폼 필드: 이름, 설명(textarea 200자+), 카테고리, 도시, 구, 주소, 연락처(다중), 영업시간, 태그, 이미지 업로드(최대 10장), 노출 기간, 우선순위, 활성 스위치
- 이미지 업로드: `expo-image-picker` → `expo-image-manipulator`(리사이즈) → Firebase Storage
  - 저장 경로: `neighbor_businesses/{docId}/{index}.jpg`
- 등록 완료 후 Firestore 문서 쓰기

### 4.3 AdminScreen 확장
기존 `screens/AdminScreen.js`에 "이웃사업 관리" 섹션 추가:
- 전체 목록 (관리자는 비활성/만료 포함 조회)
- 신규 등록 → `AddNeighborBusinessScreen`
- 각 항목 수정/삭제

### 4.4 홈/뉴스 탭 진입 카드 (선택)
- 홈 탭: "이웃사업 둘러보기" 카드 (선택, Phase 1b)

---

## 5. WP 사이드바 티저 (신규 플러그인)

### 신규 플러그인: `chaovn-neighbor-sidebar`

```
wp-plugins/chaovn-neighbor-sidebar/
├── chaovn-neighbor-sidebar.php     # 조건부 스크립트 enqueue
├── assets/
│   ├── sidebar.js                  # Firebase Web SDK로 조회 + 카드 렌더링
│   └── sidebar.css                 # 카드 스타일
└── README.md
```

### PHP (최소 역할)
```php
add_action('wp_enqueue_scripts', function() {
    // /daily-news-terminal/ 페이지에서만 로드
    if (is_page('daily-news-terminal')) {
        wp_enqueue_script('firebase-app',      'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
        wp_enqueue_script('firebase-firestore','https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js');
        wp_enqueue_script('chaovn-neighbor-sidebar',
            plugins_url('assets/sidebar.js', __FILE__),
            ['firebase-firestore'], '1.0.0', true);
        wp_enqueue_style('chaovn-neighbor-sidebar',
            plugins_url('assets/sidebar.css', __FILE__));
    }
});
```

### JS 로직 (sidebar.js)
1. Firebase 초기화 (`firebaseConfig`는 공개 키이므로 JS에 하드코딩 안전)
2. Jenny의 왼쪽 사이드바 DOM 요소 찾기 — **셀렉터는 라이브 페이지 inspect 후 확정**
3. 해당 요소 안에 "우리 이웃 제품/업소" 섹션 DOM 생성
4. Firestore 쿼리:
   ```javascript
   db.collection('NeighborBusinesses')
     .where('active', '==', true)
     .where('approvalStatus', '==', 'approved')
     .orderBy('priority', 'desc')
     .limit(5)
     .get()
   ```
5. 카드 5~7개 렌더링
6. 섹션 하단: "더 많은 이웃 업소 보기 →" 링크 → Smart Link로 앱/웹 분기
7. sessionStorage 5분 캐시 (Firebase 비용 절감)

### 카드 HTML 구조
```html
<section class="chaovn-np-section">
  <h3 class="chaovn-np-title">우리 이웃 제품/업소</h3>
  <div class="chaovn-np-list">
    <article class="chaovn-np-card" data-id="...">
      <img src="..." class="chaovn-np-thumb" loading="lazy" />
      <div class="chaovn-np-info">
        <h4 class="chaovn-np-name">가게명</h4>
        <p class="chaovn-np-meta">호치민 · Q1 · 음식점</p>
        <p class="chaovn-np-desc">짧은 설명...</p>
        <button class="chaovn-np-btn">상세보기</button>
      </div>
    </article>
  </div>
  <a class="chaovn-np-more" href="https://chaovietnam.co.kr/go/neighbor-businesses">
    더 많은 이웃 업소 보기 →
  </a>
</section>
```

### 클릭 추적
상세보기 / 더 보기 클릭 시:
1. Firestore `NeighborBusinesses/{id}.clicksCount` += 1
2. `window.open(smartLink, '_blank')`

---

## 6. 크로스 프로모션 구현 (Phase 1b)

### Smart Link (chaovn-deeplink-handler 확장)
```
사용자 클릭 → https://chaovietnam.co.kr/go/business/{id}
  ↓
  - 앱 설치됨: chao-vn-app://businesses/{id}
  - 앱 미설치(iOS): 앱스토어 → 설치 후 Universal Link로 딥링크
  - 앱 미설치(Android): Play Store → 설치 후 App Link로 딥링크
  - 데스크톱: vnkorlife.com/businesses/{id} (Phase 1b에서 구현)
```

### 앱 설치 유도 배너
- vnkorlife.com 상단 고정 Smart Banner (iOS Safari 네이티브 / Android 커스텀)
- WP 사이드바 섹션 푸터 "📱 앱에서 지도·전화·찜하기 →"

### Share 기능 확장
앱의 공유 URL이 Smart Link 형식이 되도록 `services/shareService.js` 수정.

---

## 7. 이미지 업로드 플로우 (앱)

1. 관리자가 AdminScreen 또는 `AddNeighborBusinessScreen`에서 최대 10장 선택
2. 클라이언트에서 리사이즈 (`expo-image-manipulator`, 최대 1600×1600, 품질 0.8)
3. Firebase Storage 업로드 — 경로: `neighbor_businesses/{businessId}/{index}.jpg`
4. 업로드 완료 시 URL을 `images` 배열에 추가
5. 전체 업로드 완료 후 Firestore 문서 저장/업데이트

---

## 8. 구현 순서 (체크리스트)

### Phase 1 MVP
- [ ] **1.** Firestore 보안 규칙 배포 (`NeighborBusinesses` + `Announcements`)
- [ ] **2.** 관리자 커스텀 클레임 설정 (Firebase Functions 또는 수동)
- [ ] **3.** App.js — 6탭 구조로 전환 (G1 디자인 적용)
  - Stack 추가: `NeighborBusinessesStack`
  - 라벨 단축: 당근/나눔 → 당근, 구인구직 → 일자리
  - flex 비율 + 구분선 적용
- [ ] **4.** `screens/NeighborBusinessesScreen.js` — 목록/검색
- [ ] **5.** `screens/NeighborBusinessDetailScreen.js` — 상세/액션
- [ ] **6.** `screens/AddNeighborBusinessScreen.js` — 관리자 등록 폼
- [ ] **7.** Firebase Storage 이미지 업로드 헬퍼 (최대 10장)
- [ ] **8.** AdminScreen에 이웃사업 관리 섹션 추가
- [ ] **9.** 관리자 테스트 데이터 10건 등록
- [ ] **10.** 공지 배너 시스템 구현 (`ANNOUNCEMENTS_PLAN.md` 참조)
- [ ] **11.** 뉴스 탭 상단에 `<AnnouncementBanner targetScreen="News" />` 추가
- [ ] **12.** "이웃사업 출시!" 공지 배너 1건 등록
- [ ] **13.** 라이브 /daily-news-terminal/ DOM inspect → 사이드바 셀렉터 확정
- [ ] **14.** `wp-plugins/chaovn-neighbor-sidebar/` 플러그인 작성
- [ ] **15.** FTP 업로드 → WP 활성화 → 브라우저 테스트 (데스크톱/모바일)
- [ ] **16.** 문서 업데이트 (본 문서 + SYSTEM_OVERVIEW.md 상태 반영)

### Phase 1b (다음 라운드)
- [ ] vnkorlife.com `/businesses` 라우트
- [ ] Smart Link (chaovn-deeplink-handler 확장)
- [ ] 앱 설치 유도 배너

### Phase 2 (나중)
- [ ] 사용자 제출 폼 + 결제
- [ ] 승인 워크플로우

---

## 9. 리스크와 대응

| 리스크 | 대응 |
|---|---|
| Jenny 사이드바 DOM 구조 변경 시 스크립트 깨짐 | 13단계에서 확정한 셀렉터를 이 문서에 명시. Jenny 업데이트 시 재검증 체크리스트 추가 |
| Firebase 읽기 비용 폭증 | 쿼리 `limit(5)` + sessionStorage 5분 캐시 + composite index 미리 생성 |
| Firestore 공개 키 노출 우려 | 보안 규칙으로 차단 — `active=true, approvalStatus=approved`만 읽기 허용 |
| 이미지 로드 느림 | Firebase Storage 자동 CDN + `loading="lazy"` + 클라이언트 리사이즈 |
| 6탭 라벨이 좁은 기기에서 잘림 | 불균등 너비(이웃사업 flex 1.3) + 짧은 라벨로 대응. tab_design_preview.html 기준 375px에서 OK |
| 이미지 10장 업로드 중 네트워크 끊김 | 순차 업로드 + 재시도. 완전 업로드 전까지 문서 저장 안 함 |

---

## 10. 장기 개선 아이디어

- 업소 즐겨찾기 공유 (사용자 간)
- 리뷰/평점 시스템
- 이벤트/할인 쿠폰 게시 기능
- 카테고리별 유료 광고 슬롯 (Phase 2 수익화)
- 지도 기반 탐색 (반경 검색)

---

## 11. 라이브 페이지 셀렉터 기록 (14단계 완료 후 작성)

> daily-news-terminal 페이지의 좌측 사이드바 DOM 셀렉터 및 Jenny 플러그인 버전.
> 해당 구조 변경 시 즉시 업데이트 필요.

- 셀렉터: `TBD`
- Jenny 버전: `TBD`
- 마지막 확인: `TBD`
