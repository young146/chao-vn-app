# iOS Crash (Fabric nil object) 대응 기록 (2026-01-18)

## 1. 현상 분석
- **Incident ID**: `298C39D7-8753-4D2B-ACAD-27763E30FD8C`
- **Error**: `EXC_CRASH (SIGABRT)`
- **Reason**: `*** -[__NSPlaceholderDictionary initWithObjects:forKeys:count:]: attempt to insert nil object from objects[0]`
- **Location**: `RCTThirdPartyComponentsProvider.mm:22`
- **분석 결과**: React Native 0.81.x 환경에서 Fabric(New Architecture) 구성 요소 등록 시, 특정 라이브러리의 네이티브 구현체(Class)를 찾지 못해 `nil`이 삽입되며 발생하는 런타임 크래시임. `newArchEnabled: false` 설정임에도 불구하고 브릿지 생성 로직에서 충돌이 발생함.

## 2. 조치 사항
### A. `app.json` 설정 보완
- **변경 내용**: `plugins` 목록에 `react-native-maps`를 명시적으로 추가함.
- **이유**: `package.json`에는 존재하나 플러그인 설정이 누락되어 iOS 빌드 시 네이티브 링크가 불완전하게 생성될 가능성이 있었음.

### B. 의존성 버전 고정
- **변경 내용**: `react-native-google-mobile-ads` 버전을 `^16.0.1`에서 `16.0.1`로 고정함.
- **이유**: 광고 라이브러리는 Fabric 관련 코드를 포함하고 있어, 유동적인 버전(`^`) 사용 시 EAS 빌드 서버에서 검증되지 않은 버전이 설치되어 링크 오류를 일으킬 수 있음.

### C. 의존성 청소 및 재생성
- **변경 내용**: `package-lock.json`을 삭제하고 `npm install`을 통해 전체 의존성 지도를 새로 그림.
- **이유**: 3차례 동일 사고 발생은 로컬 캐시나 꼬인 버전이 `package-lock.json`에 고정되어 빌드 서버로 전송되고 있었을 가능성이 매우 높기 때문임.

### D. 자동 제출 설정 (Auto-Submission)
- **변경 내용**: 빌드 완료 후 App Store Connect에 자동으로 제출(Submit)될 수 있도록 사용자 환경변수를 추가함.
- **이유**: 빌드와 제출 과정을 자동화하여 작업 효율을 높이고, 수동 제출 시 발생할 수 있는 번거로움을 줄이기 위함.

## 3. 권장 빌드 절차
1. 로컬에서 `npm install`로 의존성 상태 확인
2. `eas build --profile production --platform ios` 실행
3. (필요시) `eas build` 실행 전 빌드 서버 캐시를 완전히 무시하기 위해 `--clear-cache` 옵션 사용 고려

## 4. 추가 관찰 사항
만약 동일 증상이 반복될 경우, `expo-apple-authentication`이나 `expo-image-picker` 등 UI와 밀접한 다른 플러그인들도 `app.json` 설정 누락 여부를 전수 조사해야 함.
