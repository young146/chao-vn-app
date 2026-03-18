# iOS App Store Connect 미디어 업로드 문제 해결 가이드

## 문제 상황
- 미리보기 3개, 스크린샷 10개 업로드 시 "아직 미디어 로딩중입니다" 메시지가 계속 나타남
- 2주째 제출 불가 상태

## 필수 요구사항 확인

### 1. 스크린샷 사양 (iPhone)

#### 필수 해상도 (최신 iPhone 기준)
- **iPhone 15 Pro Max / 14 Pro Max**: 1290 x 2796 픽셀
- **iPhone 15 Pro / 14 Pro**: 1179 x 2556 픽셀
- **iPhone 15 Plus / 14 Plus**: 1284 x 2778 픽셀
- **iPhone 15 / 14**: 1170 x 2532 픽셀
- **iPhone 13 Pro Max**: 1284 x 2778 픽셀
- **iPhone 13 Pro**: 1170 x 2532 픽셀
- **iPhone 13 / 13 mini**: 1170 x 2532 픽셀

**권장**: 가장 큰 해상도인 **1290 x 2796** 또는 **1284 x 2778** 사용

#### 형식 요구사항
- ✅ **PNG** 또는 **JPEG** 형식만 허용
- ✅ **sRGB** 색 공간 필수
- ✅ **RGB** 색 모드 (CMYK 불가)
- ✅ **72 DPI** 권장 (DPI는 중요하지 않지만 72가 안전)
- ❌ 투명도 없어야 함 (PNG-24 사용 시 알파 채널 제거)
- ❌ 애니메이션 GIF 불가

### 2. 앱 미리보기 비디오 사양

#### 해상도
- **iPhone 15 Pro Max / 14 Pro Max**: 1290 x 2796
- **iPhone 15 Pro / 14 Pro**: 1179 x 2556
- **iPhone 15 Plus / 14 Plus**: 1284 x 2778
- **iPhone 15 / 14**: 1170 x 2532

#### 형식 요구사항
- ✅ **H.264** 또는 **HEVC (H.265)** 코덱
- ✅ **MP4** 또는 **MOV** 컨테이너
- ✅ 최대 **500MB** 파일 크기
- ✅ 최대 **30초** 길이
- ✅ **프레임레이트**: 30fps 또는 60fps
- ✅ **오디오**: AAC 코덱 (선택사항)

### 3. 파일명 규칙
- ✅ 영문, 숫자, 하이픈(-), 언더스코어(_)만 사용
- ❌ 한글, 특수문자, 공백 금지
- ✅ 예시: `screenshot_1.png`, `preview_1.mp4`

## 문제 해결 단계

### Step 1: 이미지 파일 검증 및 재생성

#### 방법 A: Photoshop/GIMP 사용
1. **새 파일 생성**
   - 너비: 1290px
   - 높이: 2796px
   - 해상도: 72 DPI
   - 색 모드: **RGB** (CMYK 아님)
   - 색 프로필: **sRGB IEC61966-2.1**

2. **스크린샷 삽입 및 조정**
   - 실제 스크린샷을 레이어로 추가
   - 이미지 크기 조정 (비율 유지)
   - 필요시 배경색 추가 (투명도 제거)

3. **저장**
   - **PNG-24** 선택 (알파 채널 체크 해제)
   - 또는 **JPEG** (품질 90-100%)
   - 파일명: `screenshot_1.png`, `screenshot_2.png` 등

#### 방법 B: 온라인 도구 사용
- **ImageOptim** (Mac): https://imageoptim.com/
- **Squoosh** (웹): https://squoosh.app/
- **TinyPNG** (웹): https://tinypng.com/

#### 방법 C: 명령줄 도구 (ImageMagick)
```bash
# PNG로 변환 및 최적화
magick input.jpg -resize 1290x2796^ -gravity center -extent 1290x2796 -colorspace sRGB -strip screenshot_1.png

# JPEG로 변환
magick input.png -resize 1290x2796^ -gravity center -extent 1290x2796 -colorspace sRGB -quality 95 -strip screenshot_1.jpg
```

### Step 2: 메타데이터 제거

#### Mac (Terminal)
```bash
# ExifTool 설치 (Homebrew)
brew install exiftool

# 메타데이터 제거
exiftool -all= screenshot_1.png
```

#### Windows (PowerShell)
```powershell
# ExifTool 다운로드: https://exiftool.org/
# 메타데이터 제거
exiftool.exe -all= screenshot_1.png
```

#### 온라인 도구
- **VerExif**: https://www.verexif.com/
- **ImageOptim**: https://imageoptim.com/online

### Step 3: App Store Connect 업로드 방법

#### 권장 방법
1. **Safari 브라우저 사용** (Mac 권장)
   - Chrome이나 다른 브라우저보다 Safari가 더 안정적
   - 쿠키 및 캐시 삭제 후 재시도

2. **한 번에 하나씩 업로드**
   - 여러 파일 동시 업로드 대신 하나씩 업로드
   - 각 파일 업로드 완료 확인 후 다음 파일 업로드

3. **파일 크기 확인**
   - 스크린샷: 각 파일 10MB 이하 권장
   - 미리보기: 500MB 이하

4. **업로드 순서**
   - 먼저 스크린샷 10개 모두 업로드
   - 업로드 완료 확인 (로딩 완료 표시)
   - 그 다음 미리보기 3개 업로드

### Step 4: 문제 지속 시 대안

#### 방법 1: Transporter 앱 사용 (Mac)
1. Mac App Store에서 **Transporter** 다운로드
2. Transporter로 미디어 파일 직접 업로드
3. App Store Connect보다 더 안정적일 수 있음

#### 방법 2: 파일 형식 변경
- PNG → JPEG로 변경 시도
- 또는 JPEG → PNG로 변경 시도

#### 방법 3: 해상도 조정
- 1290 x 2796 → 1284 x 2778로 변경 시도
- 또는 1179 x 2556으로 변경 시도

#### 방법 4: 네트워크 환경 변경
- 다른 네트워크 (Wi-Fi → 모바일 핫스팟)
- VPN 사용 중이면 해제
- 방화벽 설정 확인

### Step 5: App Store Connect 캐시 클리어

1. **브라우저 캐시 삭제**
   - Safari: 개발자 메뉴 → 캐시 비우기
   - Chrome: 설정 → 개인정보 보호 → 인터넷 사용 기록 삭제

2. **쿠키 삭제**
   - App Store Connect 관련 쿠키 모두 삭제

3. **시크릿/프라이빗 모드로 재시도**
   - 새로운 세션으로 업로드 시도

## 체크리스트

업로드 전 각 파일 확인:
- [ ] 해상도가 정확한가? (1290x2796 또는 1284x2778)
- [ ] 형식이 PNG 또는 JPEG인가?
- [ ] 색 공간이 sRGB인가?
- [ ] RGB 모드인가? (CMYK 아님)
- [ ] 파일명에 특수문자/한글이 없는가?
- [ ] 파일 크기가 적절한가? (10MB 이하 권장)
- [ ] 메타데이터가 제거되었는가?
- [ ] 투명도가 없는가?

## 추가 팁

1. **스크린샷 생성 방법**
   - 실제 iPhone에서 스크린샷 촬영
   - 또는 iOS Simulator에서 스크린샷 촬영
   - 해상도가 자동으로 맞춰짐

2. **미리보기 비디오 생성**
   - iPhone에서 화면 녹화 (30초 이하)
   - QuickTime Player로 편집
   - H.264 코덱으로 내보내기

3. **Apple 지원팀 문의**
   - 문제가 계속되면 App Store Connect 지원팀에 문의
   - 앱 ID와 구체적인 오류 메시지 제공

## 참고 링크

- [App Store Connect 미디어 가이드](https://developer.apple.com/app-store/app-previews/)
- [스크린샷 요구사항](https://developer.apple.com/app-store/product-page/)
- [Transporter 앱](https://apps.apple.com/app/transporter/id1450874784)




