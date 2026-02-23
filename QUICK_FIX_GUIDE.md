# 🚀 iOS 미디어 업로드 문제 빠른 해결 가이드

## 문제
App Store Connect에서 스크린샷/미리보기 업로드 시 "아직 미디어 로딩중입니다" 메시지가 계속 나타남

## 즉시 시도할 해결 방법 (우선순위 순)

### 1️⃣ 파일 검증 (가장 중요!)
먼저 현재 파일들이 요구사항을 만족하는지 확인하세요:

```bash
# 스크린샷 파일 검증
npm run validate:media ./screenshots

# 또는 특정 파일 검증
npm run validate:media ./screenshots/screenshot_1.png
```

### 2️⃣ 파일명 변경
**한글, 특수문자, 공백이 있으면 반드시 변경하세요!**

❌ 잘못된 예:
- `스크린샷 1.png`
- `screenshot (1).png`
- `screenshot-한국어.png`

✅ 올바른 예:
- `screenshot_1.png`
- `screenshot_2.png`
- `preview_1.mp4`

### 3️⃣ 해상도 확인 및 수정

#### 필수 해상도 (하나 선택)
- **1290 x 2796** (iPhone 15 Pro Max) ← **가장 권장**
- **1284 x 2778** (iPhone 15 Plus)
- **1179 x 2556** (iPhone 15 Pro)
- **1170 x 2532** (iPhone 15)

#### 해상도 확인 방법
1. **Mac**: 이미지를 열고 `Cmd + I` (정보 보기)
2. **Windows**: 파일 속성 → 세부 정보 탭
3. **온라인**: https://www.image-size.com/

#### 해상도 수정 방법

**Mac (Preview 사용)**:
1. Preview로 이미지 열기
2. 도구 → 크기 조정
3. 해상도 입력 (1290 x 2796)
4. 저장

**Windows (Paint 사용)**:
1. Paint로 이미지 열기
2. 홈 → 이미지 크기 조정
3. 픽셀 선택, 1290 x 2796 입력
4. 저장

**온라인 도구**:
- https://www.iloveimg.com/resize-image
- https://imageresizer.com/

### 4️⃣ 색 공간 확인 및 수정

**sRGB 색 공간이어야 합니다!**

#### 확인 방법
- **Mac**: 이미지 열고 `Cmd + I` → 색 공간 확인
- **Windows**: 파일 속성 → 세부 정보 → 색 공간

#### 수정 방법
- **Photoshop**: 이미지 → 모드 → RGB, 편집 → 색 설정 → sRGB로 변환
- **GIMP**: 색상 → 프로필 → sRGB 프로필 할당
- **온라인**: https://convertio.co/kr/color-space-converter/

### 5️⃣ 메타데이터 제거

메타데이터가 문제를 일으킬 수 있습니다.

#### Mac (Terminal)
```bash
# ExifTool 설치
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
- https://www.verexif.com/
- https://www.imgonline.com.ua/remove-exif-data.php

### 6️⃣ 파일 형식 재저장

PNG를 JPEG로, 또는 그 반대로 변경해보세요:

**Mac (Preview)**:
1. 이미지 열기
2. 파일 → 내보내기
3. 형식 변경 (PNG ↔ JPEG)
4. 저장

**Windows (Paint)**:
1. 이미지 열기
2. 파일 → 다른 이름으로 저장
3. 형식 변경 (PNG ↔ JPEG)
4. 저장

### 7️⃣ 브라우저 및 업로드 방법 변경

#### Safari 사용 (Mac 권장)
- Chrome보다 Safari가 더 안정적입니다
- 쿠키 및 캐시 삭제 후 재시도

#### 한 번에 하나씩 업로드
- 여러 파일 동시 업로드 ❌
- 하나씩 업로드하고 완료 확인 후 다음 파일 ✅

#### 업로드 순서
1. 먼저 스크린샷 10개 모두 업로드
2. 각 파일이 "업로드 완료" 상태인지 확인
3. 그 다음 미리보기 3개 업로드

### 8️⃣ Transporter 앱 사용 (Mac만)

App Store Connect 웹사이트 대신 Transporter 앱 사용:

1. Mac App Store에서 **Transporter** 다운로드
2. Transporter로 미디어 파일 직접 업로드
3. 더 안정적일 수 있음

### 9️⃣ 네트워크 환경 변경

- 다른 Wi-Fi 네트워크 사용
- 모바일 핫스팟 사용
- VPN 사용 중이면 해제
- 방화벽 설정 확인

## 체크리스트 (업로드 전 필수 확인)

각 파일에 대해 확인:
- [ ] 파일명: 영문, 숫자, 하이픈(-), 언더스코어(_)만 사용
- [ ] 해상도: 1290x2796 또는 1284x2778 (정확히!)
- [ ] 형식: PNG 또는 JPEG
- [ ] 색 공간: sRGB
- [ ] 색 모드: RGB (CMYK 아님)
- [ ] 파일 크기: 10MB 이하 (권장)
- [ ] 메타데이터: 제거됨
- [ ] 투명도: 없음

## 여전히 문제가 있다면?

1. **Apple 지원팀 문의**
   - App Store Connect 지원팀에 문의
   - 앱 ID: `6480538597`
   - 구체적인 오류 메시지와 함께 문의

2. **파일 완전히 새로 만들기**
   - 기존 파일 버리고 처음부터 새로 생성
   - iPhone에서 직접 스크린샷 촬영
   - 또는 iOS Simulator에서 스크린샷 촬영

3. **다른 해상도 시도**
   - 1290x2796 → 1284x2778로 변경
   - 또는 1179x2556으로 변경

## 성공 사례 팁

많은 개발자들이 다음 조합으로 성공했습니다:
- ✅ 파일명: `screenshot_1.png` 형식
- ✅ 해상도: 정확히 1290 x 2796
- ✅ 형식: PNG-24 (알파 채널 없음)
- ✅ 색 공간: sRGB
- ✅ 메타데이터: 완전히 제거
- ✅ 브라우저: Safari
- ✅ 업로드: 한 번에 하나씩

## 미리보기 비디오 변환

iPhone/iPad로 촬영한 비디오를 변환하려면:

1. **FFmpeg 설치** (필수)
   - Mac: `brew install ffmpeg`
   - Windows: https://ffmpeg.org/download.html

2. **비디오 변환**
   - Mac/Linux: `./scripts/convert-preview-video.sh ./preview.mov`
   - Windows: `.\scripts\convert-preview-video.ps1 -InputFile .\preview.mov`

자세한 내용은 `VIDEO_CONVERSION_GUIDE.md` 파일을 참고하세요.

## 추가 도움말

- 자세한 가이드: `IOS_MEDIA_UPLOAD_GUIDE.md`
- 비디오 변환 가이드: `VIDEO_CONVERSION_GUIDE.md`

