# SNS 공유 딥링크 작업 현황 (2026-02-09)

## 작업 목표
당근/나눔, 구인구직, 부동산 상세 페이지를 SNS로 공유하고, 공유 링크 클릭 시 앱으로 자동 이동

## 완료된 작업

### 1. 앱 코드 (커밋: 840de39)
- ✅ `App.js`: 딥링크 설정 (`chaovietnam://`, `xinchao://`)
- ✅ `utils/deepLinkUtils.js`: 딥링크 URL 생성
- ✅ `services/shareService.js`: SNS 플랫폼별 공유
- ✅ `ItemDetailScreen.js`, `JobDetailScreen.js`, `RealEstateDetailScreen.js`: 공유 버튼 추가
- ✅ 프로덕션 빌드 완료: Android 2.2.1 (versionCode 60+)

### 2. 서버 파일 (로컬에 생성됨, 아직 서버 업로드 안 됨)
- ✅ `/public_html/app/share/index.php`: 웹 랜딩 페이지
- ✅ `/public_html/app/share/.htaccess`: URL 리라이트
- ✅ `/public_html/.well-known/assetlinks.json`: Android App Links (SHA256: 34:DE:B6:01:95:A0:CE:87:9C:E5:24:AB:58:09:75:71:70:91:A8:67:C2:44:5E:5B:E0:7C:43:06:C8:9C:43:FC)
- ✅ `/public_html/.well-known/apple-app-site-association`: iOS Universal Links

## 현재 문제

### 증상
프로덕션 앱(2.2.1)에서 테스트 시:
- 웹 페이지: `https://chaovietnam.co.kr/app/share/danggn/zXrMajWgcWJsLSXL3zzE`
- "앱으로 보기" 버튼 클릭 → 앱이 열리지 않음
- "설치되어있지 않습니까" 메시지 표시

### 원인 분석 (미확정)
1. 프로덕션 앱에 딥링크 코드는 있음 (840de39 커밋 포함)
2. 서버 파일은 로컬에만 있고 실서버 업로드 안 됨
3. 딥링크 스킴: `chaovietnam://danggn/id` 형식
4. 앱의 딥링크 수신 확인 필요

## 다음 단계

### 즉시 해야 할 것
1. **서버 파일 업로드**
   - `/public_html/app/share/index.php`
   - `/public_html/app/share/.htaccess`
   - `/public_html/.well-known/assetlinks.json`
   - `/public_html/.well-known/apple-app-site-association`

2. **테스트**
   - 모바일에서 `https://chaovietnam.co.kr/app/share/danggn/테스트ID` 접속
   - "앱으로 보기" 버튼 클릭
   - 앱이 열리는지 확인

3. **디버깅 (만약 작동 안 하면)**
   - App.js에 추가된 딥링크 수신 코드 확인 (Alert 표시)
   - 앱이 실제로 URL을 받는지 확인
   - Chrome 개발자 도구로 JavaScript 에러 확인

### iOS 빌드 (진행 중)
- 버전: 2.2.2
- iOS buildNumber: 49
- 빌드 URL: https://expo.dev/accounts/young146/projects/chao-vn-app/builds/

## 파일 위치

### 로컬 파일 (Git에 커밋됨)
```
c:\chao-vn-app-native\chao-vn-app\
├── App.js (딥링크 수신 코드 추가)
├── utils/deepLinkUtils.js
├── services/shareService.js
├── screens/ItemDetailScreen.js
├── screens/JobDetailScreen.js
├── screens/RealEstateDetailScreen.js
├── public_html/
│   ├── app/share/
│   │   ├── index.php
│   │   └── .htaccess
│   └── .well-known/
│       ├── assetlinks.json
│       └── apple-app-site-association
└── app.json (version 2.2.2, iOS 49, Android 61)
```

### 서버 업로드 필요
```
chaovietnam.co.kr 서버:
/public_html/
├── app/share/
│   ├── index.php
│   └── .htaccess
└── .well-known/
    ├── assetlinks.json
    └── apple-app-site-association
```

## 참고사항

### 딥링크 형식
- Custom Scheme: `chaovietnam://danggn/ID` (또는 `xinchao://danggn/ID`)
- 웹 URL: `https://chaovietnam.co.kr/app/share/danggn/ID`

### App.json 설정
- Primary scheme: `chaovietnam`
- iOS CFBundleURLSchemes: `["chaovietnam", "xinchao"]`
- Associated Domains: `applinks:chaovietnam.co.kr`

### 테스트 URL 예시
```
https://chaovietnam.co.kr/app/share/danggn/zXrMajWgcWJsLSXL3zzE
https://chaovietnam.co.kr/app/share/job/테스트ID
https://chaovietnam.co.kr/app/share/realestate/테스트ID
```

## 미완료/미확정 사항
- 실제 프로덕션 환경에서 딥링크 작동 여부 미확인
- Android App Links/iOS Universal Links 작동 여부 미확인
- 자동 앱 오픈 기능 미확인 (현재는 버튼 클릭만 구현)

---
작성: 2026-02-09
