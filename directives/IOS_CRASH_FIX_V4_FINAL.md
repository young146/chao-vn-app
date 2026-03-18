# iOS StartupProcedure/ErrorRecovery 크래시 근본 해결 (2026-01-18)

## 🎯 근본 원인 발견

### 핵심 문제: 모듈 로드 시 즉시 실행되는 Firebase 초기화

**발견한 근본 원인:**
- `firebase/config.js`가 모듈 로드 시점에 즉시 실행되어 웹 Firebase SDK를 초기화
- 동시에 `App.js`에서 네이티브 Firebase SDK (`@react-native-firebase/app`) 초기화 시작
- 두 Firebase SDK가 동시에 초기화되면서 iOS 네이티브 레이어에서 경쟁 상태(race condition) 발생
- 특히 `initializeAuth`가 `ReactNativeAsyncStorage`를 사용할 때 네이티브 모듈이 아직 준비되지 않음
- expo-updates의 ErrorRecovery가 이를 감지하고 `tryRelaunchFromCache()` 시도
- 네이티브 모듈 초기화가 완료되지 않은 상태에서 재시작 시도 → 크래시

### 왜 Android는 문제가 없는가?

Android는 네이티브 모듈 초기화가 더 관대하고, 비동기 초기화 순서가 다릅니다. iOS는 초기화 순서가 매우 엄격합니다.

### 왜 이전 해결책들이 실패했는가?

1. **순서 조정만으로는 부족**: Updates 체크 타이밍만 조정해도 근본 원인(모듈 로드 시 즉시 실행)이 해결되지 않음
2. **설정 변경만으로는 부족**: `checkAutomatically` 설정만 변경해도 Firebase 초기화 경쟁 상태는 남아있음
3. **근본 원인**: 모듈 로드 시 즉시 실행되는 코드가 네이티브 모듈 초기화와 경쟁

## ✅ 근본적인 해결책

### 1. Lazy Initialization 패턴 적용

**변경 전 (`firebase/config.js`):**
```javascript
// 모듈 로드 시 즉시 실행됨!
app = initializeApp(firebaseConfig);
auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
export { db, auth, storage };
```

**변경 후 (`firebase/config.js`):**
```javascript
// ✅ Lazy Initialization: 모듈 로드 시 즉시 실행하지 않음
let app = null;
let db = null;
let auth = null;
let storage = null;
let isInitialized = false;

const initializeFirebase = async () => {
  if (isInitialized) return { app, db, auth, storage };
  // 초기화 로직...
};

export { initializeFirebase, db, auth, storage };
```

### 2. 초기화 순서 보장

**변경 전 (`App.js`):**
```javascript
// Firebase 초기화 순서 불명확
const firebaseReady = await waitForFirebase(5000);
// Updates 체크가 너무 일찍 실행됨
if (!__DEV__ && Updates.isEnabled) {
  await Updates.checkForUpdateAsync();
}
```

**변경 후 (`App.js`):**
```javascript
// ✅ 명확한 초기화 순서 보장
// 1. 네이티브 Firebase 초기화 완료 대기
const firebaseReady = await waitForFirebase(5000);

// 2. 웹 Firebase 초기화 (네이티브 Firebase 이후)
await initializeFirebase();

// 3. App Check 초기화
await initializeAppCheck();

// 4. Updates 체크는 첫 화면 렌더링 이후로 이동
useEffect(() => {
  if (!isReady) return;
  setTimeout(async () => {
    await Updates.checkForUpdateAsync();
  }, 3000);
}, [isReady]);
```

### 3. Updates 설정 최적화

**변경 전 (`app.json`):**
```json
{
  "updates": {
    "url": "https://u.expo.dev/..."
  }
}
```

**변경 후 (`app.json`):**
```json
{
  "updates": {
    "url": "https://u.expo.dev/...",
    "checkAutomatically": "ON_ERROR_RECOVERY",
    "fallbackToCacheTimeout": 0
  }
}
```

## 📋 적용된 변경사항

### 1. `firebase/config.js`
- ✅ Lazy Initialization 패턴 적용
- ✅ `initializeFirebase()` 함수 추가
- ✅ 기존 코드 호환성 유지 (`export { db, auth, storage }`)
- ✅ 새로운 API 제공 (`getDb()`, `getAuthInstance()`, `getStorageInstance()`)

### 2. `App.js`
- ✅ `initializeFirebase()` import 및 호출 추가
- ✅ 초기화 순서 보장: 네이티브 Firebase → 웹 Firebase → App Check
- ✅ Updates 체크를 첫 화면 렌더링 이후로 이동
- ✅ 타임아웃 및 에러 핸들링 추가

### 3. `app.json`
- ✅ `checkAutomatically: "ON_ERROR_RECOVERY"` 추가
- ✅ `fallbackToCacheTimeout: 0` 추가

## 🔍 기술적 배경

### Lazy Initialization의 장점

1. **경쟁 상태 방지**: 네이티브 모듈이 완전히 준비된 후에만 초기화
2. **명확한 초기화 순서**: App.js에서 순서를 명시적으로 제어
3. **에러 복구 안정화**: 초기화 순서가 보장되어 ErrorRecovery가 안정적으로 작동

### 초기화 순서의 중요성

iOS에서는 다음 순서가 필수적입니다:
1. 네이티브 모듈 초기화 (React Native Bridge)
2. 네이티브 Firebase 초기화 (`@react-native-firebase/app`)
3. 웹 Firebase 초기화 (`firebase/app`)
4. 첫 화면 렌더링 (`content appeared` 이벤트)
5. Updates 체크

이 순서를 지키지 않으면 ErrorRecovery가 정상 상태를 인식하지 못해 크래시가 발생합니다.

## 🎉 기대 효과

1. **iOS 크래시 완전 해결**: 모듈 로드 시 즉시 실행 문제 제거
2. **안정적인 초기화**: 명확한 순서 보장으로 경쟁 상태 제거
3. **ErrorRecovery 안정화**: 초기화 순서 보장으로 롤백 시 크래시 방지
4. **기존 코드 호환성**: 기존 코드 수정 없이 작동

## 📝 참고사항

- 기존 코드는 `import { db, auth, storage } from "./firebase/config"`로 계속 사용 가능
- `App.js`에서 `initializeFirebase()`를 먼저 호출하므로 다른 컴포넌트들은 이미 초기화된 상태에서 사용
- 새로운 코드는 `getDb()`, `getAuthInstance()`, `getStorageInstance()` 사용 권장

## ✅ 검증 방법

1. TestFlight 빌드 생성
2. iOS 기기에서 앱 설치 및 실행
3. 크래시 로그 확인 (크래시가 발생하지 않아야 함)
4. 앱 정상 작동 확인

---

**작성일**: 2026-01-18  
**해결 방법**: Lazy Initialization + 초기화 순서 보장 + Updates 설정 최적화  
**근본 원인**: 모듈 로드 시 즉시 실행되는 Firebase 초기화가 네이티브 모듈 초기화와 경쟁
