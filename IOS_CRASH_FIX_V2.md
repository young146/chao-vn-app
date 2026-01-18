# iOS 크래시 해결 방안 V2 (2026-01-18)

## 🔍 발견된 문제점

### 1. Firebase 이중 초기화 충돌
- **문제**: 웹 Firebase SDK (`firebase/config.js`)와 네이티브 Firebase SDK (`@react-native-firebase/app`)가 동시에 사용됨
- **영향**: 초기화 순서 문제로 nil 객체 크래시 발생 가능
- **해결**: 
  - `firebase/config.js`에 중복 초기화 방지 로직 추가
  - 안전한 초기화 및 에러 핸들링 강화

### 2. package-lock.json 동기화 문제
- **문제**: `@react-native-async-storage/async-storage` 버전 불일치
  - `package.json`: `~1.23.1` 사용
  - `package-lock.json`: Firebase의 peerDependencies에 `^2.2.0` 참조 남아있음
- **영향**: `npm ci` 빌드 실패
- **해결**: 
  - `package.json`의 `overrides` 강화
  - **필수**: `package-lock.json` 재생성 필요

### 3. Firebase 초기화 순서
- **문제**: `firebase/config.js`가 모듈 로드 시 즉시 실행되어 네이티브 Firebase보다 먼저 초기화됨
- **해결**: 
  - `App.js`에서 네이티브 Firebase 초기화 대기 로직 개선
  - 안전한 초기화 체크 추가

## ✅ 적용된 수정 사항

### 1. `firebase/config.js` 개선
- 중복 초기화 방지 (`getApps()` 체크)
- 안전한 초기화 및 에러 핸들링
- Auth 초기화 시 기존 인스턴스 확인

### 2. `App.js` 개선
- 네이티브 Firebase 초기화 대기 로직 강화
- App Check 초기화를 프로덕션에서만 활성화
- 타임아웃 시간 증가 (3초 → 5초)

### 3. `components/AdBanner.js` 개선
- Firebase 초기화 확인 로직 강화
- 안전한 체크 함수 사용

### 4. `package.json` 개선
- `overrides` 섹션 강화
- Firebase의 peerDependencies도 override

## 🚨 필수 작업: package-lock.json 재생성

**중요**: 다음 명령어를 실행하여 `package-lock.json`을 재생성해야 합니다:

```powershell
cd chao-vn-app
Remove-Item package-lock.json -ErrorAction SilentlyContinue
npm install
```

또는:

```powershell
cd chao-vn-app
npm install --package-lock-only
```

이 작업을 하지 않으면 EAS 빌드에서 계속 `npm ci` 실패가 발생합니다.

## 📋 추가 권장 사항

### 1. 빌드 전 확인
- `package.json`과 `package-lock.json`이 동기화되었는지 확인
- `npm ci`를 로컬에서 테스트하여 빌드 서버와 동일한 환경 확인

### 2. iOS 빌드 테스트
- TestFlight에 업로드 후 실제 기기에서 테스트
- 앱 시작 직후 크래시 여부 확인
- Firebase 기능 (인증, Firestore, Storage) 정상 작동 확인

### 3. 모니터링
- Firebase Console에서 크래시 로그 확인
- Xcode Organizer에서 크래시 리포트 확인

## 🔄 변경된 파일 목록

1. `firebase/config.js` - 안전한 초기화 로직 추가
2. `App.js` - Firebase 초기화 대기 로직 개선
3. `components/AdBanner.js` - 초기화 확인 로직 강화
4. `package.json` - overrides 강화

## 📝 참고

- 이전 해결 방안: `IOS_CRASH_FIX_LOG.md` 참조
- Expo 54 SDK 표준에 맞춘 의존성 구조 유지
- New Architecture는 비활성화 상태 (`newArchEnabled: false`)
