# 🚀 씬짜오베트남(XinChao Vietnam) 앱 네이티브 전환 프로젝트 리포트

본 문서는 씬짜오베트남 앱을 기존 WebView 기반 하이브리드 방식에서 100% Native UI/UX 방식으로 전환한 프로젝트의 주요 변경 사항 및 기술적 세부 정보를 담고 있습니다. 추후 유지보수 및 추가 개발 시 참고 자료로 활용하시기 바랍니다.

## 1. 프로젝트 개요
- **목표**: WebView 제거를 통한 성능 최적화, iOS App Store 가이드라인(4.2) 준수, 통합 로그인 및 푸시 알림 강화.
- **앱 정식 명칭**: 씬짜오베트남 (XinChao Vietnam)
- **최종 버전**: v2.1.0 (Build 7, VC 41)

## 2. 주요 구현 사항

### A. UI/UX 네이티브 전환
- **홈 화면 (Home)**:
    - 대형 검색창 구현 (구글 스타일) 및 WordPress REST API 연동 검색 기능.
    - 5개 주요 섹션(교민소식, BIZ, 컬럼, F&R, Golf & Sports) 최신글 자동 로딩.
    - 3초 간격 자동 회전 슬라이더 구현.
- **뉴스 탭 (News)**:
    - '데일리 뉴스' 전용 리스트 뷰.
    - 날짜별 뉴스 필터링 기능 (DatePicker 연동).
- **게시판 탭 (Board)**:
    - 기존 `vnkorlife.com`의 K-Board 데이터를 RSS 피드 방식으로 파싱하여 네이티브 카드 리스트로 구현.
- **상세 페이지 (Post Detail)**:
    - `react-native-render-html`을 사용한 고성능 콘텐츠 렌더링.
    - `expo-image`를 활용한 이미지 캐싱 최적화.

### B. 통합 로그인 (Auth)
- **Firebase Authentication** 연동.
- **구글 로그인**: `@react-native-google-signin/google-signin` 적용.
- **애플 로그인**: `expo-apple-authentication` 적용 (iOS 심사 필수 요건).
- **인증 흐름**: 로그인 시 Firestore `users` 컬렉션에 사용자 프로필 및 푸시 토큰 자동 등록.

### C. 인터랙션 및 커뮤니티 (Comments)
- **실시간 댓글**: Firebase Firestore 기반 실시간 댓글 시스템.
- **미디어 첨부**: 댓글 작성 시 갤러리 이미지 선택 또는 카메라 촬영 후 Firebase Storage 업로드 및 표시 기능.

### D. 푸시 알림 및 채팅 (Notifications)
- **기술 스택**: `expo-notifications`, Firebase Cloud Functions.
- **강제 알림 (Force Alarm)**: FCM/APNS 토큰을 직접 활용하여 앱이 종료된 상태에서도 알림 수신이 가능하도록 설계.
- **알림 채널**: Android 최고 우선순위 채널(Importance.MAX) 설정.

## 3. 기술 스택 및 데이터 소스
- **Framework**: Expo (SDK 54), React Native
- **Data Source**:
    - `chaovietnam.co.kr` (WP REST API)
    - `vnkorlife.com` (WP REST API & KBoard RSS)
- **Backend**: Firebase (Firestore, Storage, Auth, Functions)

## 4. 유지보수 가이드

### API 엔드포인트 수정
`chao-vn-app/services/wordpressApi.js` 파일에서 베이스 URL 및 카테고리 ID를 관리합니다.
- `MAGAZINE_BASE_URL`: 매거진 데이터 소스
- `BOARD_BASE_URL`: 게시판 데이터 소스

### 게시판 연동 (KBoard)
K-Board는 일반 API로 연동되지 않으므로 `getBoardPosts` 함수 내의 RSS 파싱 로직을 참고하십시오.

### 빌드 및 배포
본 프로젝트는 **EAS Build**를 사용합니다.
- 안드로이드 빌드: `eas build --platform android`
- iOS 빌드: `eas build --platform ios`

## 6. 현재 긴급 상황 및 장애 보고 (2026-01-04)

### 상황 요약
- **장애 현상**: 앱 초기 로딩 시 로딩 화면에서 무한 대기하거나 로딩 시간이 1분 이상 소요되는 심각한 성능 저하 발생.
- **현재 상태 (2026-01-04 기준)**: 
    - 타이핑 및 소리 로직 완전 제거 후 **실시간 로딩 바(Progress Bar)** UI 도입.
    - 홈 화면 필수 데이터(슬라이드, 뉴스 섹션)를 우선적으로 프리페치하도록 최적화.
    - **현재 평균 로딩 시간: 약 10초 내외** (네트워크 환경에 따라 변동 가능).

### 조치 사항 및 해결 완료
1. **로딩 바(Progress Bar) 구현**: 사용자가 시각적으로 로딩 진행 상황을 확인할 수 있도록 오렌지색 프로그레스 바와 실시간 % 표시 적용.
2. **홈 데이터 우선순위 재설정**: 홈 화면 진입 시 즉시 기사가 보이도록 `getSlideshowPosts()`, `getHomeSections()`를 앱 기동 시 병렬로 로드.
3. **병렬 처리 고도화**: `Promise.all`을 사용하여 여러 API 호출을 동시에 수행함으로써 전체 대기 시간 단축.
4. **타이핑 로직 영구 삭제**: 성능 저하의 주요 원인이었던 애니메이션 및 오디오 로직을 코드에서 완전히 제거.

---
**최종 업데이트**: 2026년 1월 4일 (긴급 성능 수정 포함)
**작성자**: AI 코딩 어시스턴트 (Cursor)

