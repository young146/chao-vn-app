# 작업 진행 기록 — 2026-03-24

## 수정 파일 요약

| # | 시간 | 작업 내용 | 수정 파일 | 배포 |
|---|------|----------|----------|------|
| 1 | 14:30 | **iOS 부동산 서브탭 freeze 수정** — 서브탭(전체/임대/매매)을 FlatList 바깥으로 이동, `useMemo` 제거, `Pressable` 사용 | [RealEstateScreen.js](file:///c:/chao-vn-app/chao-vn-app/screens/RealEstateScreen.js) | OTA ✅ |
| 2 | 15:19 | **헤더 아바타 + 더보기 버튼 추가** — 로그인 시 프로필 사진 원형 아바타 + "더보기" 텍스트 표시. 5개 스택 모두 적용 | [App.js](file:///c:/chao-vn-app/chao-vn-app/App.js) | OTA ✅ |
| 3 | 15:31 | **프로필 사진 업로드 수정** — `fetch+blob` → `XMLHttpRequest` 기반 (iOS 호환), `storage` null 방지 | [ProfileScreen.js](file:///c:/chao-vn-app/chao-vn-app/screens/ProfileScreen.js) | OTA ✅ |
| 4 | 15:51 | **Firebase Storage 권한 추가** — `profileImages/` 경로에 로그인 사용자 쓰기 권한 추가 | [storage.rules](file:///c:/chao-vn-app/chao-vn-app/storage.rules) | Firebase ✅ |
| 5 | 16:02 | **헤더 subtitle 제거 + 더보기 텍스트 강화** — 안 보이던 subtitle 삭제, 아바타 옆에 "더보기" 항상 표시 | [App.js](file:///c:/chao-vn-app/chao-vn-app/App.js) | OTA ✅ |
| 6 | 16:10 | **iOS 크래시 수정** — `Image` 미import + 인라인 require 제거 → 파일 상단 정적 import로 교체 | [App.js](file:///c:/chao-vn-app/chao-vn-app/App.js) | OTA ✅ |
| 7 | 16:20 | **iOS 제목 왼쪽 정렬** — `headerTitle` → `headerLeft`로 전환 (iOS 네이티브 스택은 headerTitleAlign 무시) | [App.js](file:///c:/chao-vn-app/chao-vn-app/App.js) | OTA ✅ |
| 8 | 17:17 | **카카오톡 공유 카드 프리뷰 수정** — 공유 URL에 title/image/price query param 포함, PHP에서 우선 사용 | [deepLinkUtils.js](file:///c:/chao-vn-app/chao-vn-app/utils/deepLinkUtils.js), [index.php](file:///c:/chao-vn-app/chao-vn-app/public_html/app/share/index.php) | OTA ✅ + Hosting ✅ |

## Git 커밋

| 시간 | 커밋 해시 | 내용 |
|------|----------|------|
| 17:29 | `0f3bbf0` | iOS 탭 freeze 수정, 프로필 사진 업로드, 헤더 아바타, 카카오 공유 카드 개선 |

## 핵심 원인 분석

| 문제 | 근본 원인 |
|------|----------|
| iOS 서브탭 멈춤 | `FlatList`의 `ListHeaderComponent` 내부 `useMemo` JSX가 데이터 변경 시 터치 이벤트를 stale closure로 고정 |
| 프로필 사진 업로드 실패 | 1) iOS에서 `fetch(localUri).blob()` 미지원 2) `storage` lazy init으로 null 3) Storage 보안 규칙에 `profileImages/` 경로 누락 |
| iOS 제목 가운데 쏠림 | iOS 네이티브 스택은 `headerTitleAlign: "left"`를 무시하고 항상 center 정렬 |
| 카카오 공유 카드 빈칸 | App Check가 PHP 서버의 Firestore REST API 호출을 차단 → OG 메타태그에 기본값만 사용 |
