# 프로젝트 인계 및 현재 상태 명세서 (Handover Notes)

본 문서는 현재 발생하고 있는 앱의 불안정성과 성능 저하 문제를 해결하기 위해, 차후 작업자가 즉시 파악해야 할 핵심 기술 정보와 현재 상태를 기록한 문서입니다.

## 1. 현재 핵심 문제 (Critical Issues)
- **이미지 로딩 지연 (최대 20초):** `expo-image` 도입 후 특정 환경에서 네트워크/CPU 병목 현상 발생. `WebView`까지 영향을 주고 있음.
- **스크롤 먹통:** `FlatList`의 `numColumns={2}` 환경에서 잘못된 `getItemLayout` 속성 사용으로 인해 스크롤이 중간에 멈춤.
- **앱 불안정성:** 네이티브 모듈(`expo-image`)과 자바스크립트 코드 간의 설정 충돌, 혹은 중복 키(Duplicate Key) 에러로 인한 크래시 발생 가능성.
- **구글 로그인:** `app.json`의 `scheme` 및 `redirectUri` 설정은 완료되었으나, 빌드된 APK와 설정값의 일치 여부 재검토 필요.

## 2. 주요 수정 내역 (최근 작업)

### 2.1 이미지 최적화 (`expo-image`)
- **기존:** `react-native` 기본 `Image` 사용.
- **변경:** 앱 전반에 `expo-image` 도입. `cachePolicy="disk"`, `transition={200}` 적용.
- **주의:** `priority="high"`나 `recyclingKey` 같은 과도한 옵션이 현재 병목을 유발했을 가능성이 있어 최신 로컬 코드에서 제거됨.

### 2.2 리스트 성능 개선 (`XinChaoDanggnScreen.js`)
- **데이터 중복 방지:** `fetchItems` 로직에 `Set`을 사용하여 중복 ID(Key) 유입 차단.
- **메모이제이션:** `ItemCard` 컴포넌트를 `memo`로 분리하여 불필요한 재렌더링 방지.
- **페이지네이션:** 10개 단위로 끊어 읽기(`startAfter`) 적용 완료.

### 2.3 구글 로그인 및 앱 설정
- **정식 명칭 고정:** `app.json` 내 `scheme`, `package`, `bundleIdentifier`를 `com.yourname.chaovnapp`으로 통일.
- **Redirect URI:** `AuthSession.makeRedirectUri`를 사용하여 동적 생성하도록 `LoginScreen.js` 수정.

## 3. 다음 작업자를 위한 기술적 조언 (Next Steps)

### 3.1 `XinChaoDanggnScreen.js` 집중 수정 필요
- **`renderHeader` 최적화:** 현재 `useCallback`의 의존성 배열이 너무 많아 검색어 입력 시 헤더 전체가 무한 렌더링됨. 이를 단순화하거나 `useMemo`로 래핑하여 리소스 낭비를 막아야 함.
- **`FlatList` 속성 제거:** `getItemLayout`은 2열 리스트에서 계산 오류를 일으키므로 절대 사용 금지.
- **이미지 우선순위:** 모든 이미지에 `priority="high"`를 주지 말 것. 화면에 보이는 첫 4~6개만 높게 설정할 것.

### 3.2 디버깅 환경
- **LogBox:** 현재 성능 저하를 막기 위해 `App.js`에서 `LogBox.ignoreAllLogs(true)`로 설정됨. 원인 파악 시에만 일시적으로 해제할 것.
- **네트워크 모니터링:** 사진 로딩 20초 지연은 Firebase Storage 응답 문제인지, 클라이언트 캐싱 엔진의 충돌인지 확인 필요.

## 4. 아직 푸시되지 않은 로컬 수정 사항
- `App.js`: 로그 차단 설정 (`ignoreAllLogs(true)`)
- `XinChaoDanggnScreen.js`: `getItemLayout` 제거, 이미지 옵션 단순화, `renderHeader` 최적화 시도 코드 포함.

---
**작업 주의사항:** 
사용자는 현재 잦은 빌드와 실패에 매우 민감한 상태임. 모든 수정은 철저히 검토 후 한 번에 완벽하게 반영되어야 하며, 불필요한 `git push`는 자제할 것.

