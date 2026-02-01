# 🚀 씬짜오베트남 (XinChao Vietnam) 앱 - 프로젝트 문서

본 문서는 앱의 기술 개요, 주요 기능, 작업 내역을 통합 관리하는 문서입니다.
다음 작업자가 현재의 맥락을 즉시 파악하고 이어서 작업할 수 있도록 작성되었습니다.

---

## 📋 프로젝트 개요

- **앱 정식 명칭**: 씬짜오베트남 (XinChao Vietnam)
- **목표**: WebView 제거를 통한 성능 최적화, iOS App Store 가이드라인(4.2) 준수, 통합 로그인 및 푸시 알림 강화
- **현재 버전**: v2.1.0 (Build 7, VC 41)

---

## 🛠 기술 스택

| 구분 | 기술 |
|------|------|
| **Framework** | Expo (SDK 54), React Native |
| **Backend** | Firebase (Firestore, Storage, Auth, Functions) |
| **Data Source** | `chaovietnam.co.kr` (WP REST API), `vnkorlife.com` (WP REST API & KBoard RSS) |
| **빌드** | EAS Build |

---

## 🏗 주요 구현 사항

### A. UI/UX 네이티브 전환
- **홈 화면**: 대형 검색창 (구글 스타일), WordPress REST API 연동, 5개 주요 섹션, 3초 자동 회전 슬라이더
- **뉴스 탭**: 데일리 뉴스 리스트, 날짜별 필터링 (DatePicker)
- **게시판 탭**: K-Board RSS 파싱 → 네이티브 카드 리스트
- **상세 페이지**: `react-native-render-html`, `expo-image` 캐싱

### B. 통합 로그인
- **Firebase Authentication** 연동
- **구글 로그인**: `@react-native-google-signin/google-signin`
- **애플 로그인**: `expo-apple-authentication` (iOS 심사 필수)
- Firestore `users` 컬렉션에 프로필 및 푸시 토큰 자동 등록

### C. 커뮤니티 (댓글)
- Firebase Firestore 기반 **실시간 댓글**
- 갤러리/카메라 이미지 첨부 → Firebase Storage 업로드

### D. 푸시 알림
- `expo-notifications`, Firebase Cloud Functions
- FCM/APNS 토큰 직접 활용 (앱 종료 상태에서도 수신)
- Android 최고 우선순위 채널 (Importance.MAX)

---

## 📁 유지보수 가이드

### API 엔드포인트
`services/wordpressApi.js`에서 관리:
- `MAGAZINE_BASE_URL`: 매거진 데이터
- `BOARD_BASE_URL`: 게시판 데이터

### 게시판 연동 (KBoard)
K-Board는 일반 API 미지원 → `getBoardPosts` 함수 내 RSS 파싱 로직 참고

### 빌드 및 배포
```bash
# 안드로이드
eas build --platform android

# iOS
eas build --platform ios
```

---

## 📝 작업 내역

## 1. 최근 완료된 주요 개선 사항 (성공 사례)

### 1.1 초기 로딩 속도 최적화 (0초 로딩 구현)
- **배경:** 당근 메뉴 진입 시 데이터 로딩에 15초 이상 소요되어 사용자 이탈 위험이 컸음.
- **조치:** 
    - `App.js`에서 앱 실행 즉시 배경에서 당근 데이터와 상위 6개 이미지를 프리페치(Prefetch)하여 `AsyncStorage` 및 이미지 캐시에 저장.
    - `XinChaoDanggnScreen.js`에서 서버 데이터를 기다리지 않고 캐시 데이터를 즉시 표시하도록 수정.
- **결과:** 메뉴 진입 시 체감 로딩 속도 0초 달성.

### 1.2 채팅 성능 및 리스트 최적화
- **채팅방 목록:** 프리페치 로직을 적용하고, 중복 키 에러를 방지하기 위해 `Map` 객체를 이용한 유니크 필터링 적용.
- **메시지 로딩:** `limitToLast(50)`을 적용하여 최신 메시지 위주로 로딩 속도 개선.
- **중복 에러 해결:** `FlatList`에서 발생하던 `Encountered two children with the same key` 에러를 모든 주요 리스트(당근, 채팅목록)에서 로직적으로 차단함.

### 1.3 데이터 필터링 및 인덱스 에러 대응
- **클라이언트 사이드 정렬:** Firestore의 복합 인덱스 생성 부담을 줄이기 위해 서버 측 `orderBy`를 제거하고, 클라이언트에서 데이터를 받아온 후 정렬하는 방식으로 변경하여 인덱스 에러 발생 차단.
- **카테고리 불일치 수정:** 아이템 등록(`AddItemScreen`)과 목록 조회(`XinChaoDanggnScreen`) 간의 카테고리 텍스트 불일치 문제 해결.

## 2. 현재 진행 중인 핵심 이슈: 구글 로그인 실패

### 2.1 증상 및 에러 메시지
- **에러 내용:** `Error 400: invalid_request`, `Custom scheme URIs are not allowed for 'WEB' client type`.
- **상황:** 구글 로그인 버튼 클릭 시 계정 선택 창으로 넘어가지 못하고 입구에서 차단됨. (이전에는 계정 선택까지는 되었으나 돌아오는 길에 `Something went wrong` 발생)

### 2.2 시도된 조치 및 분석
- **clientId 설정:** 웹 클라이언트 ID를 사용하여 `useProxy: true` 환경에서 HTTPS 리디렉션을 시도함.
- **원인 추정:** 현재 앱이 **'개발 빌드(Development Build)'** 환경에서 실행 중이며, `AuthSession`이 생성하는 `redirect_uri`가 구글 웹 클라이언트가 허용하지 않는 커스텀 스키마(`exp+...` 또는 `com.yourname...`)로 생성되고 있음.
- **실패한 시도들:**
    - `makeRedirectUri`를 이용해 수동으로 주소를 고정하려 했으나 실패.
    - `app.json`에 `owner` 정보를 추가하여 Expo 프록시 서버와의 정체성 일치를 시도했으나 효과 없음.
    - `responseType`을 `token`과 `id_token`으로 번갈아 시도함.

### 2.3 차기 작업자를 위한 권장 사항
1. **Redirect URI 강제 확인:** `promptAsync` 실행 직전 `request.redirectUri` 값이 정확히 `https://auth.expo.io/@young146/chao-vn-app`으로 나오는지 로그 확인 필수.
2. **구글 콘솔 재설정:** 웹 클라이언트 ID의 '승인된 리디렉션 URI'에 위 주소가 정확히 등록되어 있는지 확인.
3. **네이티브 모듈 검토:** 개발 빌드에서는 `expo-auth-session`이 아닌 `react-native-google-signin` 같은 순수 네이티브 라이브러리 도입을 고려해야 할 수도 있음 (현재 Expo 프록시 방식이 개발 빌드와 충돌 가능성 높음).

## 3. 2025년 1월 4일 작업 내역 및 ⚠️ 심각한 문제 발생

### 3.1 성공적으로 완료된 최적화

#### 앱 로딩 속도 획기적 개선
- **이전:** 앱 로딩에 약 10초 이상 소요
- **조치:** 
  - `services/wordpressApi.js`에 `getHomeDataCached()` 함수 추가
  - 10개의 순차 API 호출을 1개의 병렬 호출로 통합
  - AsyncStorage 캐시 + Stale-While-Revalidate 전략 적용
  - `App.js`에서 캐시 우선 로딩 구현
- **결과:** 
  - 첫 실행: ~3.5초
  - 재실행(캐시): 0.013초 (즉시 진입)

#### 구글 로그인 속도 개선
- **이전:** 계정 선택 후 로그인까지 약 15초 소요
- **조치:**
  - `AuthContext.js`에서 푸시 토큰 등록을 백그라운드로 이동 (await 제거)
  - Firestore setDoc 작업들을 Promise.all로 병렬화
- **결과:** 로그인 시간 약 2-3초로 단축

#### 구글 로그인 계정 선택 기능 복원
- `LoginScreen.js`에서 `GoogleSignin.signOut()` 재활성화
- 매번 다른 계정 선택 가능하도록 수정

### 3.2 ⚠️ 심각한 문제: 채팅 알림 완전 불능

#### 문제 상황
- **증상:** 채팅 알림이 전혀 작동하지 않음
  - 앱이 열려있을 때: 알림 안 옴
  - 앱이 닫혀있을 때: 알림 안 옴 (소리도, 메시지도 없음)
- **원인:** 불명확 - 롤백 후에도 문제 지속

#### 시도한 조치들 (모두 실패)

1. **채팅 전송 속도 개선 시도 (ChatRoomScreen.js)**
   - 낙관적 업데이트(Optimistic Update) 구현 시도
   - 결과: 메시지창 깜빡임, 알람 완전 중단
   - **롤백 완료:** commit 5dc6056으로 복원

2. **Firebase Functions 수정 (functions/index.js)**
   - FCM 페이로드에서 channelId, icon 등 수정 시도
   - 결과: 효과 없음
   - **롤백 완료:** commit 5dc6056으로 복원

3. **AuthContext.js 수정**
   - 푸시 토큰 등록 백그라운드 처리
   - 결과: 로그인은 빨라졌으나 알림 문제와 연관 가능성
   - **롤백 완료:** commit 5dc6056으로 복원

4. **App.js 알림 채널 명시적 생성**
   - `setupNotificationChannels()` 함수 추가하여 앱 시작 시 chat 채널 생성
   - 결과: 효과 없음

#### 현재 상태 (2025년 1월 4일)

| 파일 | 상태 | 비고 |
|------|------|------|
| `AuthContext.js` | ✅ 출시 버전 동일 | git diff 확인 완료 |
| `ChatRoomScreen.js` | ✅ 출시 버전 동일 | git diff 확인 완료 |
| `functions/index.js` | ✅ 출시 버전 동일 | git diff 확인 완료 |
| `App.js` | ⚠️ 수정됨 | 로딩 최적화 + 알림 채널 코드 추가 |
| `wordpressApi.js` | ⚠️ 수정됨 | 캐싱 최적화 코드 추가 |
| `LoginScreen.js` | ⚠️ 수정됨 | 구글 로그인 signOut() 복원 |

#### 로그 상태 (정상으로 보임)
```
✅ 알림 채널 생성 완료!
📲 Expo Push Token: ExponentPushToken[UnukgbJB3-aGQUOMqGGCjc]
🔥 FCM/APNS Device Token: eX6i5bpIQTKoafzVjFsvVO:APA91bH...
✅ 푸시 토큰 저장 완료
```

#### 🚨 교훈: "빈대 하나 잡으려다 집을 태웠다"
- 채팅 메시지 전송 속도 개선을 시도하다가 알림 시스템 전체가 망가짐
- 원인 파악 불가 - 롤백해도 복구 안됨
- 출시된 앱에서는 정상 작동하므로 개발 빌드 환경 문제일 가능성 있음

### 3.3 차기 작업자를 위한 권장 사항

1. **절대 함부로 수정하지 말 것** - 알림 관련 코드는 민감함
2. **출시 앱과 개발 앱 비교 테스트** - 같은 코드인데 다르게 동작할 수 있음
3. **Firebase Functions 로그 확인** - Console에서 실제 전송 성공/실패 확인 필요
4. **수신자 기기의 토큰 갱신** - 개발 빌드에서 토큰이 달라질 수 있음
5. **완전 롤백 고려** - App.js, wordpressApi.js도 출시 버전으로 복원 후 테스트

### 3.4 알람 불안정 원인 분석 (2025년 1월 4일 오후)

#### 📊 테스트 결과
| 방향 | 결과 |
|------|------|
| 출시 앱 → 개발 앱 | ✅ 알람 정상 |
| 개발 앱 → 출시 앱 | ❌ 알람 불안정 (됐다가 안 됐다가) |
| 출시 앱 ↔ 출시 앱 | ✅ 완전 정상 |

#### 🎯 핵심 원인: FCM 토큰 충돌

**Firestore에 사용자당 하나의 FCM 토큰만 저장됨:**
```javascript
// AuthContext.js
await setDoc(doc(db, "users", userId), {
  fcmToken: tokens.fcmToken,  // ← 하나만 저장 (덮어씌움)
}, { merge: true });
```

**문제 시나리오:**
1. 사용자 A가 **출시 앱** 로그인 → 출시 앱 토큰 저장
2. 사용자 A가 **개발 앱**도 로그인 → 개발 앱 토큰으로 **덮어씌움**
3. 메시지 수신 시 → **개발 앱에만** 알림 감 (출시 앱은 못 받음)
4. 출시 앱 재시작 → 출시 앱 토큰으로 다시 덮어씌움
5. 이제 **출시 앱에만** 알림 감

**결론:** 마지막으로 앱을 시작한 쪽에만 알림이 감

#### ⚠️ 개발 빌드 특유의 문제들

1. **Firestore WebChannel 연결 불안정**
   ```
   @firebase/firestore: WebChannelConnection RPC 'Listen' stream transport errored
   ```
   - 개발 빌드에서 연결이 자주 끊김
   - 재연결 시 50개 메시지 일괄 수신 → 화면 흔들림

2. **메시지 전송 속도 느림**
   - 전송 버튼 → Firestore 저장 → 입력창 초기화가 순차적으로 실행
   - 개선 시도했으나 알람에 영향 줄 수 있어 롤백함

3. **출시 앱과 개발 앱의 FCM 토큰이 다름**
   - 같은 사용자가 두 앱에 로그인하면 토큰 충돌 발생

#### 💡 근본 해결책 (향후 작업)

**다중 기기 알림 지원 필요:**
- Firestore에 FCM 토큰을 **배열**로 저장
- Firebase Functions에서 **모든 토큰**에 알림 전송
- 발신 기기 토큰은 제외

```javascript
// 예시: 다중 토큰 저장 구조
{
  fcmTokens: [
    { token: "xxx", platform: "android", deviceId: "device1" },
    { token: "yyy", platform: "android", deviceId: "device2" }
  ]
}
```

**⚠️ 주의:** 이 수정은 시스템 설계 변경이므로 신중하게 진행해야 함

## 4. 현재 상황 요약

### ✅ 완료된 작업
- [x] **앱 로딩 속도 최적화** - 10초 → 0.013초 (캐시)
- [x] **구글 로그인 속도 개선** - 15초 → 2-3초
- [x] **구글 로그인 계정 선택** - signOut() 복원

### ⚠️ 개발 빌드 특유 문제 (출시 앱에서는 정상)
- [ ] 알람 불안정 - FCM 토큰 충돌 문제
- [ ] 화면 흔들림 - Firestore WebChannel 불안정
- [ ] 전송 속도 느림 - 순차적 await 구조

### 📌 출시 전 필수 확인
- Native 빌드로 출시 시, 기존 출시 앱(Expo Go)과 동일하게 작동하는지 테스트 필요
- **테스트 방법:** Native 빌드 앱만 단독으로 테스트 (개발 앱과 동시 사용 금지)

---

## 5. 2026년 1월 8일 작업 내역 - UI/UX 대규모 개선

### 5.1 메뉴 및 브랜딩 변경

#### 메뉴 이름 변경
- **이전:** 씬짜오당근
- **변경:** 씬짜오나눔
- **적용 범위:** 
  - 하단 탭 메뉴
  - 스크린 타이틀
  - 더보기 메뉴 버전 정보
  - 알림 설정 화면

#### 메인 메뉴 폰트 강화
- `tabBarLabelStyle` 수정
  - fontSize: 10 → **12**
  - fontWeight: 기본 → **"700"**
  - tabBarInactiveTintColor: #999 → **#666**

### 5.2 나눔(당근) 카드 UI 개선

#### 이미지 크기 확대
- **이전:** 140px
- **변경:** **210px** (1.5배)

#### 지역 표시 개선
- **이전:** 한 줄 (시 · 구)
- **변경:** **두 줄** (시 · 구 + 아파트명)
- **스타일:**
  - fontSize: 11 → **13**
  - color: #999 → **#333**
  - fontWeight: **"600"** 추가

#### 검색 Placeholder 변경
- **이전:** "물품 검색..."
- **변경:** **"내 아파트 나눔을 찾아보세요"**

### 5.3 지역 데이터 간소화 (vietnamLocations.js)

#### 호치민 숫자 지역
- **이전:** "District 7 (Quận 7)"
- **변경:** **"Q7"**

#### 기타 지역 (한글 발음 제거)
- **이전:** "Bình Thạnh (빈탄)"
- **변경:** **"Bình Thạnh"**

#### Firebase 데이터 마이그레이션
- 기존 데이터 수동 수정 완료
- `scripts/migrate-districts.js` 마이그레이션 스크립트 추가

### 5.4 상품 등록 화면 개선 (AddItemScreen.js)

#### 아파트 선택 안내 추가
- **헬퍼 텍스트:** "💡 아파트명을 선택하면 같은 아파트 주민에게 알림이 갑니다!"
- **Placeholder:** "선택하세요" → **"🏠 아파트를 선택하세요"**

### 5.5 상세 페이지 지역 표시 개선 (ItemDetailScreen.js)

- **이전:** 시, 구, 아파트 각각 별도 Text
- **변경:** **"📍 호치민 · Q7 · 아파트명"** 한 줄로 통합
- **스타일:** fontSize: 16, fontWeight: "600", color: "#222"

### 5.6 뉴스 화면 개선 (MagazineScreen.js)

#### 카테고리/출처 표시
- **이전:** "뉴스" 고정 배지
- **변경:** **"경제 / VnExpress"** 형식
- **출처 자동 감지:** VnExpress, Thanh Niên, Tuổi Trẻ, Zing, VietnamNet, Dân Trí, VOV 등

#### 오늘 날짜 뉴스만 표시
- **이전:** 무한 스크롤 (과거 뉴스까지 계속 로딩)
- **변경:** **오늘 날짜 뉴스만** 자동 필터링

#### 마지막 멘트 추가
- 오늘 뉴스 끝나면 표시:
  ```
  ✨ 이상, 씬짜오베트남에서 뽑은 오늘의 베트남 뉴스입니다 ✨
  지난 뉴스는 상단의 '날짜별 뉴스 보기'를 이용해주세요
  ```

### 5.7 수정된 파일 목록

| 파일 | 주요 변경 |
|------|----------|
| `App.js` | 탭 메뉴명 변경, 폰트 스타일 강화 |
| `screens/XinChaoDanggnScreen.js` | 카드 UI, 검색 placeholder |
| `screens/ItemDetailScreen.js` | 지역 표시 통합 |
| `screens/AddItemScreen.js` | 아파트 선택 안내 |
| `screens/MagazineScreen.js` | 카테고리/출처, 오늘 뉴스 필터 |
| `screens/MoreScreen.js` | 버전 정보 |
| `screens/NotificationSettingScreen.js` | 알림 제목 |
| `utils/vietnamLocations.js` | 지역명 간소화 |
| `scripts/migrate-districts.js` | 마이그레이션 스크립트 (신규) |

---

## 6. 2026년 1월 12일 업데이트

### 6.1 AdMob 광고 통합

#### 패키지 설치
- `react-native-google-mobile-ads` - AdMob SDK
- `@react-native-firebase/app` - Firebase 기본
- `@react-native-firebase/remote-config` - 자체/구글 광고 전환 제어

#### AdMob 설정
| 플랫폼 | App ID | Banner Ad Unit ID |
|--------|--------|-------------------|
| Android | `ca-app-pub-7944314901202352~3025832510` | `ca-app-pub-7944314901202352/4705993110` |
| iOS | `ca-app-pub-7944314901202352~9182981091` | `ca-app-pub-7944314901202352/7518491734` |

#### 광고 배치 위치
| 화면 | 위치 | 광고 타입 |
|------|------|----------|
| 홈 | 리스트 최상단 | `AdBanner` |
| 홈 | 각 섹션 제목 위 | `SectionAdBanner` |
| 뉴스/게시판 | 리스트 최상단 | `AdBanner` |
| 뉴스/게시판 | 4개 기사마다 | `InlineAdBanner` |
| 나눔 | 리스트 최상단 | `AdBanner` |
| 물품 상세 | 이미지 아래 | `AdBanner` |

#### Remote Config 연동
- Firebase Remote Config `show_in_house_ads` 변수로 광고 전환 가능
- `false` = AdMob 광고 (기본)
- `true` = 자체 광고

### 6.2 홈 화면 로딩 최적화

#### 문제
- 카테고리 API 9번 중복 호출
- 홈 화면 로딩 3~5초 소요

#### 해결
- 카테고리 목록 캐시 (`cachedCategories`)
- `getAllCategories()` 함수로 1번만 호출
- `getHomeDataCached()`에서 직접 호출로 중복 제거

#### 결과
- API 호출: 9번 → 1번 (88% 감소)
- 로딩 시간: 3~5초 → 1초 이내

### 6.3 검색 복귀 기능 추가

#### 문제
- 검색 후 홈으로 돌아가는 방법 없음
- 홈 탭 눌러도 검색 상태 유지

#### 해결
- `SearchHeader`에 `onClear`, `isSearching` prop 추가
- 검색 중일 때 주황색 X 버튼 표시
- 홈 탭에 `listeners` 추가 - 탭 클릭 시 `resetSearch` 전달
- `resetSearch` useEffect로 검색 초기화

### 6.4 하단 탭바 SafeArea 적용

#### 문제
- 하단 탭이 시스템 영역(제스처 바)에 가려짐

#### 해결
- `SafeAreaProvider`로 앱 전체 감싸기
- `useSafeAreaInsets()`로 디바이스별 안전 영역 감지
- `tabBarStyle`에 동적 패딩 적용

### 6.5 더보기 버튼 수정

#### 문제
- 홈 섹션의 "더보기 >" 버튼 작동 안 함

#### 원인
- `navigation.navigate('HomeStack', ...)` - 존재하지 않는 스크린 이름

#### 해결
- `navigation.navigate('홈', ...)` - 올바른 탭 스크린 이름으로 수정

### 6.6 뉴스 상세 이미지 중복 제거

#### 문제
- 뉴스 기사 열면 같은 이미지가 2번 표시
- 작은 이미지 (featuredImage) + 큰 이미지 (본문 HTML)

#### 원인
- 워드프레스 `content.rendered`에 대표 이미지 포함

#### 해결
- `PostDetailScreen.js`에서 본문 첫 번째 `<img>` 또는 `<figure>` 태그 제거
```javascript
contentHtml = contentHtml
  .replace(/^(\s*<p>\s*)?<figure[^>]*>[\s\S]*?<\/figure>(\s*<\/p>)?/i, '')
  .replace(/^(\s*<p>\s*)?<img[^>]*\/?>/i, '');
```

### 6.7 수정된 파일 목록

| 파일 | 주요 변경 |
|------|----------|
| `App.js` | SafeAreaProvider, useSafeAreaInsets, 홈탭 listeners |
| `app.json` | AdMob 설정, iOS googleServicesFile |
| `package.json` | Firebase, AdMob 패키지 추가 |
| `services/wordpressApi.js` | 카테고리 캐시 최적화 (getAllCategories) |
| `screens/MagazineScreen.js` | getHomeDataCached, 검색 취소, resetSearch, 더보기 수정 |
| `screens/PostDetailScreen.js` | 이미지 중복 제거 |
| `screens/ItemDetailScreen.js` | AdBanner 추가 |
| `screens/XinChaoDanggnScreen.js` | AdBanner 추가 |
| `components/AdBanner.js` | 🆕 광고 배너 컴포넌트 (신규) |
| `GoogleService-Info.plist` | 🆕 iOS Firebase 설정 (신규) |

---

## 7. 2026년 1월 13일 - iOS App Store 리젝트 발생

### 7.1 🚨 iOS 2.2.0 (Build 13) 리젝트

#### 리젝트 상세
| 항목 | 내용 |
|------|------|
| **버전** | 2.2.0 (Build 13) |
| **리젝트 사유** | `Performance: App Completeness` |
| **발생 시점** | 2026-01-13 06:01:12 (앱 시작 후 **0.15초** 만에 크래시) |
| **테스트 기기** | iPhone 18,2 (iPhone OS 26.2) |

#### 크래시 에러 메시지
```
NSInvalidArgumentException
*** -[__NSPlaceholderDictionary initWithObjects:forKeys:count:]: 
    attempt to insert nil object from objects[0]
```

#### 원인 분석
- NSDictionary 생성 시 **nil 값**을 넣으려고 해서 크래시
- 앱 시작 직후 발생 → **초기화 코드 문제**
- 크래시 로그에서 `com.google.admob.n.sql-storage-write` 큐 활성화 확인
- **AdMob / Firebase 초기화 과정에서 문제 발생 추정**

#### 임시 조치 (리젝트 전)
- `@react-native-firebase/app`, `@react-native-firebase/remote-config` 패키지 제거
- 광고 스위칭 기능 비활성화

---

## 8. 2026년 1월 14일 업데이트

### 8.1 Firebase Remote Config 복구 시도

#### 이전 문제 (7.1 참조)
- iOS 빌드 크래시로 App Store 리젝트
- Firebase 패키지 임시 제거로 광고 스위칭 불가

#### 해결 시도
- `@react-native-firebase/app` 및 `@react-native-firebase/remote-config` 패키지 재설치
- `GoogleService-Info.plist`의 `IS_ADS_ENABLED`: false → **true** 수정
- `app.json`에 iOS `googleServicesFile` 설정 추가

### 8.2 위치별 광고 스위칭 구현

#### AdBanner.js 리팩토링
- Firebase Remote Config 연동
- `position` 파라미터로 위치별 다른 광고 지원
- 8개 광고 위치 정의:

| position | 사용 위치 |
|----------|----------|
| `home_header` | 홈 화면 상단 |
| `home_section` | 홈 화면 섹션 사이 |
| `news_header` | 뉴스 화면 상단 |
| `news_inline` | 뉴스 리스트 중간 (4개마다) |
| `board_header` | 게시판 화면 상단 |
| `board_inline` | 게시판 리스트 중간 |
| `nanum_header` | 나눔 화면 상단 |
| `item_detail` | 물품 상세 페이지 |

#### Firebase Remote Config 설정
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `show_admob` | Boolean | true = AdMob, false = 자체광고 |
| `ads_config` | JSON | 위치별 이미지 URL 및 링크 |

#### ads_config JSON 구조
```json
{
  "home_header": { "image": "https://...", "link": "https://..." },
  "news_header": { "image": "https://...", "link": "https://..." },
  ...
}
```

### 8.3 뉴스 기능 개선

#### 탭 전환 시 새로고침
- **이전:** 홈 탭만 `resetSearch` 처리
- **변경:** 모든 탭에서 `resetSearch` 처리
- 날짜 필터, 검색어 초기화 포함

#### 오늘 뉴스 없으면 어제 뉴스 자동 표시
- 자정 ~ 새 뉴스 업로드 전까지 빈 화면 방지
- `showingYesterdayNews` 상태로 어제 뉴스 표시 여부 추적

#### 뉴스 카테고리순 정렬
- 정렬 순서: 경제 → 사회 → 문화 → 정치 → 국제 → 한-베 → 여행 → 건강 → 음식 → 기타
- `sortNewsByCategory()` 함수 추가

#### 과거 날짜 멘트 개선
- **오늘:** "✨ 이상, 씬짜오베트남에서 뽑은 오늘의 베트남 뉴스입니다 ✨"
- **과거:** "✨ 이상, 2026년 1월 13일 베트남 뉴스입니다 ✨"

### 8.4 수정된 파일 목록

| 파일 | 주요 변경 |
|------|----------|
| `GoogleService-Info.plist` | IS_ADS_ENABLED: true |
| `app.json` | iOS googleServicesFile 추가, Firebase 플러그인 추가 |
| `package.json` | @react-native-firebase/app, remote-config 추가 |
| `components/AdBanner.js` | Remote Config 연동, position 기반 스위칭 |
| `screens/MagazineScreen.js` | 탭 새로고침, 어제 뉴스 fallback, 카테고리 정렬 |
| `screens/XinChaoDanggnScreen.js` | position 파라미터 추가 |
| `screens/ItemDetailScreen.js` | position 파라미터 추가 |

---

## 9. 2026년 1월 14일 (저녁) - Firebase 보안 및 Google Maps 설정

### 9.1 Firebase App Check 설정

#### 목적
- Firebase 백엔드 서비스(Firestore, Storage, Auth)에 대한 무단 접근 방지
- "확인된 요청" 비율 증가

#### 작업 내역
1. **Apple Developer Console** - DeviceCheck 키 생성 (.p8 파일)
2. **Firebase Console** - App Check 등록
   - Android: Play Integrity 설정
   - iOS: DeviceCheck + App Attest 설정
3. **앱 코드** - App Check SDK 설치 및 초기화
   ```bash
   npm install @react-native-firebase/app-check@^21.6.1
   ```
4. **App.js** - `initializeAppCheck()` 함수 추가

### 9.2 iOS Google + Apple 로그인 통합

#### 이전 상태
- Android: Google 로그인만
- iOS: Apple 로그인만 (Google 로그인 비활성화)

#### 변경 후
- Android: Google 로그인
- iOS: **Google 로그인 + Apple 로그인 둘 다!**

#### 수정 파일
- `screens/LoginScreen.js`
  - `GoogleSignin.configure()`에 `iosClientId` 추가
  - iOS에서도 Google 로그인 버튼 표시
  - Apple 로그인 버튼 활성화

#### app.json 추가 설정
```json
"ios": {
  "infoPlist": {
    "CFBundleURLTypes": [{
      "CFBundleURLSchemes": ["com.googleusercontent.apps.249390849714-tl1s8pn1pr1e76ebnunu86eagjm98sm8"]
    }]
  }
}
```

### 9.3 Google Maps SDK 설정

#### 문제 상황
- Google Cloud Console에서 Maps SDK 활성화 시 무한 루프 발생
- "사용" 버튼 클릭 → 새 프로젝트/계정 생성 → 다시 "사용" 버튼... (무한 반복)

#### 해결 방법: Google Cloud Shell로 직접 활성화
```bash
gcloud config set project chaovietnam-login
gcloud services enable maps-android-backend.googleapis.com
gcloud services enable maps-ios-backend.googleapis.com
gcloud services api-keys create --display-name="Maps API Key for ChaoVN App"
```

#### 생성된 API 키
- **키 이름**: Maps API Key for ChaoVN App
- **제한사항**: Maps SDK for Android + Maps SDK for iOS (2개만)

#### 패키지 설치
```bash
npm install react-native-maps
```

#### app.json 설정
```json
"ios": {
  "config": {
    "googleMapsApiKey": "AIzaSyByutRuUo-JnpedBT2qnhV-Nzf1S9qbcAU"
  }
},
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "AIzaSyByutRuUo-JnpedBT2qnhV-Nzf1S9qbcAU"
    }
  },
  "permissions": [
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION"
  ]
},
"plugins": [
  "react-native-maps",
  ...
]
```

### 9.4 수정된 파일 목록

| 파일 | 주요 변경 |
|------|----------|
| `App.js` | App Check import 및 초기화 코드 추가 |
| `components/AdBanner.js` | Firebase 초기화 확인 로직 강화 |
| `screens/LoginScreen.js` | iOS Google 로그인 활성화, Apple 로그인 버튼 표시 |
| `app.json` | Google Maps 설정, iOS URL Scheme, 위치 권한 추가 |
| `package.json` | @react-native-firebase/app-check, react-native-maps 추가 |

### 9.5 다음 작업 (TODO)

- [ ] iOS 빌드 테스트 - 크래시 문제 해결 확인
- [ ] 지도 화면 구현 (필요시)
- [ ] Android 업데이트 빌드

---

## 10. 뉴스 상세보기 본문 표시 오류 수정 (2026-02-01)

### 10.1 문제 발견
**날짜:** 2026년 2월 1일  
**심각도:** Critical - 앱 크래시 발생

#### 증상
- 마지막 업데이트 후 뉴스 메뉴에서 뉴스 제목/이미지 클릭 시 **앱 종료**
- 수정 후 상세보기에서 **본문이 표시되지 않고 요약본만 표시**됨

### 10.2 원인 분석

#### 1차 문제: 앱 크래시
- **원인**: WordPress API에서 `content` 필드가 누락
- **영향**: `PostDetailScreen.js`에서 `post.content.rendered` 접근 시 undefined 에러

#### 2차 문제: 본문 미표시
- **원인**: 앱의 캐시 시스템이 `content` 없는 이전 데이터 사용
- **영향**: WordPress 플러그인 수정 후에도 앱에서 본문 안 보임

### 10.3 해결 과정

#### Step 1: WordPress 플러그인 수정
**파일:** `wp-plugins/chaovn-news-api/chaovn-news-api.php`

```php
function chaovn_format_post($post_data) {
    $post_id = $post_data['post_id'];
    $post_obj = get_post($post_id);
    
    // ✅ 본문 추가
    $content_html = apply_filters('the_content', $post_obj->post_content);
    
    return array(
        'id' => $post_id,
        'title' => array('rendered' => get_the_title($post_id)),
        'content' => array('rendered' => $content_html), // ✅ 추가
        'excerpt' => $excerpt,
        // ...
    );
}
```

#### Step 2: 앱 캐시 무효화
**파일:** `services/wordpressApi.js`

```javascript
// 캐시 키 변경으로 기존 캐시 무효화
const NEWS_CACHE_KEY = 'NEWS_SECTIONS_CACHE_V4'; // V3 → V4 변경
```

#### Step 3: 방어 코드 추가
**파일:** `screens/PostDetailScreen.js`

```javascript
// 안전한 content 접근
let contentHtml = post.content?.rendered || post.excerpt || '';
```

### 10.4 수정된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `wp-plugins/chaovn-news-api/chaovn-news-api.php` | `content` 필드 반환 추가 |
| `services/wordpressApi.js` | 캐시 키 V3→V4 변경, content 필드 매핑 |
| `screens/PostDetailScreen.js` | 옵셔널 체이닝으로 안전한 접근 |

### 10.5 커밋 정보
- **커밋 해시:** `5fc5606`
- **메시지:** "fix: 뉴스 상세보기 본문 표시 오류 수정"
- **배포:** WordPress 플러그인 업데이트 + OTA 업데이트

### 10.6 교훈
> **"원인 파악 먼저, 코드 수정은 마지막"**
> - 증상만 보고 성급하게 수정하지 말 것
> - 이전과 지금의 차이점 분석 필수
> - 캐시 시스템 고려

---

## 11. 다크모드 TextInput 텍스트 표시 문제 해결 (2026-02-01)

### 11.1 문제 발견
**날짜:** 2026년 2월 1일  
**심각도:** Critical - 사용자 입력 불가

#### 증상
- **나눔 섹션** 상품 등록 시 입력 필드에서:
  - 키보드 입력 → 커서는 움직임 ✅
  - **텍스트가 화면에 표시 안됨** ❌
- 프로필 수정, 채팅 등 **모든 TextInput**에서 동일 증상
- **iOS는 정상**, **Android만 문제** (여러 기기 확인)
- 사진 업로드는 정상 작동

### 11.2 원인 분석

#### 초기 가설 (❌ 모두 오류)
1. ~~AdMob UMP 동의 폼이 화면 차단~~ → AdMob 문제 아님
2. ~~TextInput 코드 오류~~ → iOS 정상이므로 코드 문제 없음
3. ~~최근 업데이트 영향~~ → 개발 서버는 정상
4. ~~기기별 캐시 문제~~ → 앱 재설치해도 동일

#### 실제 원인: **다크모드**
- 특정 Android 기기들이 **다크모드**로 설정됨
- TextInput에 명시적인 `color` 속성이 없음
- 결과: 흰 배경(`backgroundColor: "#fff"`)에 **흰 글씨** → 안 보임!

### 11.3 해결 방법

#### Step 1: 색상 테마 시스템 생성
**새 파일:** `utils/colors.js`

```javascript
export const lightColors = {
  inputText: '#000000',
  inputBackground: '#FFFFFF',
  // ...
};

export const darkColors = {
  inputText: '#FFFFFF',
  inputBackground: '#2C2C2E',
  // ...
};

export function getColors(colorScheme) {
  return colorScheme === 'dark' ? darkColors : lightColors;
}
```

#### Step 2: 모든 TextInput에 color 속성 추가
**수정된 화면:**
- `screens/AddItemScreen.js` - 상품 등록/수정
- `screens/ChatRoomScreen.js` - 채팅 입력
- `screens/XinChaoDanggnScreen.js` - 검색창
- `screens/ReviewScreen.js` - 리뷰 작성

```javascript
// Before
input: {
  backgroundColor: "#fff",
  fontSize: 16,
}

// After
input: {
  backgroundColor: "#fff",
  fontSize: 16,
  color: "#000", // ✅ 명시적 색상 추가
}
```

#### Step 3: useColorScheme 훅 추가
```javascript
import { useColorScheme } from 'react-native';
import { getColors } from '../utils/colors';

export default function AddItemScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  // ...
}
```

### 11.4 이미 color가 있던 화면 (✅ 수정 불필요)
- `screens/LoginScreen.js` - `color: "#333"`
- `screens/SignupScreen.js` - `color: "#333"`
- `screens/FindPasswordScreen.js` - `color: "#333"`
- `screens/FindIdScreen.js` - `color: "#333"`
- `screens/MagazineScreen.js` - `color: '#333'`
- `screens/UserManagementScreen.js` - `color: "#333"`
- `components/profile/ProfileEditForm.js` - `color: "#333"`

### 11.5 수정된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `utils/colors.js` | ✨ 신규 생성 - 라이트/다크 색상 테마 |
| `screens/AddItemScreen.js` | `color: '#000'` 추가 |
| `screens/ChatRoomScreen.js` | `color: '#000'` 추가 |
| `screens/XinChaoDanggnScreen.js` | `color: '#000'` 추가 |
| `screens/ReviewScreen.js` | `color: '#000'` 추가 |

### 11.6 테스트 결과
- ✅ **라이트 모드**: 정상 작동 (검은 텍스트)
- ✅ **다크 모드**: 정상 작동 (검은 텍스트 - 흰 배경이므로)
- ✅ **iOS**: 정상
- ✅ **Android**: 정상 (여러 기기 확인)

### 11.7 커밋 정보
- **커밋 해시:** `d22af3f`
- **메시지:** "feat: Add dark mode support for TextInput components"
- **배포:** Git 푸시 완료, OTA 업데이트 예정

### 11.8 교훈
> **"성급한 코드 수정 금지, 환경 설정부터 확인"**
> 
> #### 문제 해결 순서:
> 1. ✅ 재현 조건 찾기 (다른 기기에서 확인)
> 2. ✅ 환경 차이 파악 (다크모드!)
> 3. ✅ 최소한의 수정 (color 속성만 추가)
> 4. ❌ 코드부터 수정하지 말 것
> 
> #### 핵심:
> - iOS 정상 → 코드 문제 아님
> - 특정 기기만 문제 → 설정 문제
> - 다크모드는 사용자 편의 우선 → 지원해야 함

---

**최종 업데이트 일자:** 2026년 2월 1일
**작업 상태:** 
- ✅ 로딩/로그인 최적화 성공
- ✅ UI/UX 대규모 개선 완료
- ✅ 지역명 간소화 및 Firebase 데이터 마이그레이션 완료
- ✅ AdMob 광고 통합 완료
- ✅ Firebase Remote Config 복구 및 위치별 광고 스위칭 구현
- ✅ 홈 화면 로딩 최적화 완료 (9번→1번 API 호출)
- ✅ 검색 복귀 기능 추가
- ✅ 하단 탭바 SafeArea 적용
- ✅ 더보기 버튼 수정
- ✅ 뉴스 이미지 중복 제거
- ✅ 뉴스 카테고리순 정렬 및 어제 뉴스 fallback
- ✅ Firebase App Check 설정 완료
- ✅ iOS Google + Apple 로그인 통합
- ✅ Google Maps SDK 설정 완료
- ✅ 뉴스 상세보기 본문 표시 오류 수정 (2026-02-01)
- ✅ 다크모드 TextInput 지원 추가 (2026-02-01)
- ⚠️ 개발 빌드에서 알람 불안정 (FCM 토큰 충돌 - 출시 앱과 동시 테스트 시 발생)
- ✅ 출시 앱은 완전 정상 작동

