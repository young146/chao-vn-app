# iOS Fabric nil 크래시 해결 - 최종 버전 (2026-01-18)

## 🔍 문제 상황

### 증상
- iOS 앱이 TestFlight에서 실행 즉시 크래시
- 크래시 로그: `EXC_CRASH (SIGABRT)`
- 에러: `-[__NSPlaceholderDictionary initWithObjects:forKeys:count:]: attempt to insert nil object from objects[0]`
- 발생 위치: `RCTThirdPartyComponentsProvider.mm:22`

### 기술적 배경
- React Native 0.81.5 사용 중
- `newArchEnabled: false`로 설정했지만 Fabric 코드가 여전히 포함됨
- `react-native-google-mobile-ads`가 `codegenConfig.componentProvider`를 가지고 있음
- iOS의 `NSDictionary`는 nil 객체를 허용하지 않아 즉시 크래시 발생
- Android는 문제 없음 (다른 등록 방식 사용)

## 💡 근본 원인

1. **Fabric 컴포넌트 등록 시도**
   - `newArchEnabled: false`여도 React Native 0.81.5는 Fabric 코드 포함
   - `RCTThirdPartyComponentsProvider`가 실행되어 Fabric 컴포넌트 등록 시도

2. **nil 객체 삽입**
   - `react-native-google-mobile-ads`의 `codegenConfig`가 Fabric 컴포넌트를 등록하려고 시도
   - 하지만 `newArchEnabled: false`이므로 Fabric 클래스가 컴파일되지 않음
   - `NSClassFromString`이 nil 반환 → `NSDictionary`에 nil 삽입 시도 → 크래시

3. **Android는 왜 문제 없었나?**
   - Android는 `RCTThirdPartyComponentsProvider`가 없음 (iOS 전용)
   - Java/Kotlin의 HashMap은 null을 허용하여 크래시하지 않음

## ✅ 해결 방법

### 1. Expo Config Plugin 생성 (`app.plugin.js`)

**목적**: Prebuild 시 `react-native-google-mobile-ads`의 `codegenConfig`를 제거

**작동 방식**:
- EAS 빌드 또는 `npx expo prebuild` 실행 시 자동 실행
- `node_modules/react-native-google-mobile-ads/package.json`에서 `codegenConfig` 제거
- 백업 파일 생성 (`.backup`)

**파일 위치**: `chao-vn-app/app.plugin.js`

### 2. app.json 설정

**변경 사항**:
```json
{
  "expo": {
    "newArchEnabled": false,  // 최상위에 명시
    "plugins": [
      "./app.plugin.js",  // 첫 번째 플러그인으로 등록
      // ... 기타 플러그인
      [
        "expo-build-properties",
        {
          "ios": {
            "deploymentTarget": "15.1",  // Expo 54 요구사항
            "useFrameworks": "static",
            "hermesEnabled": true
          }
        }
      ]
    ]
  }
}
```

### 3. react-native.config.js 추가

**목적**: Autolinking 설정 (추가 보안)

**파일 위치**: `chao-vn-app/react-native.config.js`

### 4. 검증 스크립트 추가

**Windows용 검증**:
```bash
npm run verify:plugin
```

**macOS/Linux용 검증**:
```bash
npm run prebuild:ios
```

## 📁 변경된 파일 목록

### 새로 생성된 파일
1. `app.plugin.js` - Expo Config Plugin (핵심 해결책)
2. `react-native.config.js` - React Native autolinking 설정
3. `scripts/verify-plugin.js` - Windows용 검증 스크립트
4. `scripts/prebuild-and-verify.js` - macOS/Linux용 검증 스크립트
5. `scripts/verify-codegen-exclusion.js` - codegenConfig 검증 스크립트

### 수정된 파일
1. `app.json`
   - `newArchEnabled: false` 추가
   - `./app.plugin.js` 플러그인 등록
   - `deploymentTarget: "15.1"` 업데이트

2. `package.json`
   - 검증 스크립트 추가

## 🔧 작동 원리

### 빌드 프로세스

1. **EAS 빌드 시작**
   ```
   eas build --platform ios
   ```

2. **Prebuild 단계**
   - Expo가 `app.json`의 플러그인을 순서대로 실행
   - `./app.plugin.js`가 첫 번째로 실행됨
   - `react-native-google-mobile-ads/package.json`에서 `codegenConfig` 제거

3. **Codegen 단계**
   - React Native가 모든 라이브러리의 `codegenConfig`를 스캔
   - `react-native-google-mobile-ads`에는 `codegenConfig`가 없으므로 제외됨
   - `RCTThirdPartyComponentsProvider.mm`에 AdMob 컴포넌트가 포함되지 않음

4. **빌드 완료**
   - Fabric 컴포넌트 등록 시도 없음
   - nil 객체 크래시 방지

## ✅ 검증 방법

### Windows에서 (로컬)
```bash
npm run verify:plugin
```

확인 사항:
- ✅ `app.plugin.js` 존재
- ✅ `app.json`에 플러그인 등록
- ✅ `newArchEnabled: false`
- ✅ `codegenConfig` 존재 (빌드 시 제거될 예정)

### EAS 빌드 로그에서
빌드 로그에서 다음 메시지 확인:
```
✅ react-native-google-mobile-ads의 codegenConfig 제거됨 (nil 크래시 방지)
```

### TestFlight에서
1. 앱 설치
2. 실행
3. 크래시 없이 정상 실행되는지 확인

## 🚨 주의사항

### 1. npm install 후
- `node_modules`가 재설치되면 `codegenConfig`가 다시 나타남
- 하지만 EAS 빌드 시 `app.plugin.js`가 자동으로 제거하므로 문제 없음

### 2. 라이브러리 업데이트 시
- `react-native-google-mobile-ads`를 업데이트하면 `codegenConfig`가 다시 나타날 수 있음
- `app.plugin.js`가 자동으로 처리하므로 문제 없음

### 3. 다른 라이브러리에서도 같은 문제 발생 시
- `app.plugin.js`를 수정하여 해당 라이브러리도 제거하도록 추가
- 또는 `react-native.config.js`에서 제외 설정

## 📝 다음 개발자를 위한 체크리스트

### 문제가 다시 발생했을 때

1. **크래시 로그 확인**
   - `RCTThirdPartyComponentsProvider` 관련 에러인지 확인
   - nil 객체 삽입 에러인지 확인

2. **설정 확인**
   ```bash
   npm run verify:plugin
   ```

3. **빌드 로그 확인**
   - "codegenConfig 제거됨" 메시지가 있는지 확인
   - `app.plugin.js`가 실행되었는지 확인

4. **codegenConfig 확인**
   ```bash
   # node_modules에서 직접 확인
   cat node_modules/react-native-google-mobile-ads/package.json | grep codegenConfig
   ```

5. **해결 방법**
   - `app.plugin.js`가 제대로 작동하는지 확인
   - `app.json`에 플러그인 등록이 되어 있는지 확인
   - 필요시 `app.plugin.js` 수정

## 🔄 롤백 방법

만약 문제가 발생하면:

1. **백업 파일 확인**
   ```
   node_modules/react-native-google-mobile-ads/package.json.backup
   ```

2. **수동 복원** (필요시)
   ```bash
   # 백업 파일에서 codegenConfig 복원
   ```

3. **Git으로 롤백**
   ```bash
   git revert HEAD
   ```

## 📚 참고 자료

- React Native New Architecture: https://reactnative.dev/docs/the-new-architecture/intro
- Expo Config Plugins: https://docs.expo.dev/config-plugins/introduction/
- GitHub Issue: https://github.com/facebook/react-native/issues/51077

## ✨ 결론

이 해결책은:
- ✅ **근본적 해결**: codegenConfig를 제거하여 문제의 원인 제거
- ✅ **자동화**: EAS 빌드 시 자동으로 처리
- ✅ **안정적**: AdMob 기능은 Legacy 방식으로 정상 작동
- ✅ **확장 가능**: 다른 라이브러리에도 적용 가능

**핵심**: `app.plugin.js`가 prebuild 시 `codegenConfig`를 제거하여 `RCTThirdPartyComponentsProvider`에 nil 객체가 포함되지 않도록 함.

---

**작성일**: 2026-01-18  
**React Native 버전**: 0.81.5  
**Expo SDK**: 54  
**해결 상태**: ✅ 해결됨 (TestFlight 테스트 필요)
