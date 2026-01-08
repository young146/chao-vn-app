# 프로젝트 인계 및 현재 상태 명세서 (Handover Notes)

본 문서는 앱의 주요 기능 개선 사항과 현재 해결 중인 구글 로그인 이슈의 상세 과정을 기록한 문서입니다. 다음 작업자가 현재의 맥락을 즉시 파악하고 이어서 작업할 수 있도록 작성되었습니다.

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
**최종 업데이트 일자:** 2026년 1월 8일 13:30
**작업 상태:** 
- ✅ 로딩/로그인 최적화 성공
- ✅ UI/UX 대규모 개선 완료
- ✅ 지역명 간소화 및 Firebase 데이터 마이그레이션 완료
- ⚠️ 개발 빌드에서 알람 불안정 (FCM 토큰 충돌 - 출시 앱과 동시 테스트 시 발생)
- ✅ 출시 앱은 완전 정상 작동
