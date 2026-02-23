# iOS 미디어 업로드 문제 해결

## 문제
App Store Connect에서 스크린샷/미리보기 업로드 시 "아직 미디어 로딩중입니다" 오류

## 해결 방법 (순서대로)

### 1. 미리보기 비디오 변환 (가장 중요!)

**Windows에서:**
```powershell
# 단일 파일 변환
.\scripts\convert-preview-video.ps1 -InputFile "비디오파일경로.mov"

# 여러 파일 변환
.\scripts\convert-preview-video-all.ps1 -InputDir "비디오폴더경로"
```

**필요한 것:**
- FFmpeg 설치 (https://ffmpeg.org/download.html)

**결과:**
- `previews_converted` 폴더에 변환된 파일 저장
- 해상도: 1290 x 2796
- 형식: MP4 (H.264)

### 2. 파일명 변경

한글, 공백, 특수문자 제거:
- ❌ `스크린샷 1.png` → ✅ `screenshot_1.png`
- ❌ `preview (1).mov` → ✅ `preview_1.mp4`

### 3. 스크린샷 해상도 확인

필수 해상도: **1290 x 2796** (또는 1284 x 2778)

확인 방법:
- 파일 우클릭 → 속성 → 세부 정보

수정 방법:
- Paint로 열기 → 홈 → 이미지 크기 조정 → 1290 x 2796 입력

### 4. 파일 검증

```bash
npm run validate:media "스크린샷폴더경로"
```

### 5. 업로드

- Safari 브라우저 사용
- 한 번에 하나씩 업로드
- 스크린샷 10개 먼저 → 미리보기 3개 나중에

## 만든 파일 위치

- `scripts/convert-preview-video.ps1` - 비디오 변환 (Windows)
- `scripts/validate-ios-media.js` - 파일 검증
- `사용방법.txt` - 상세 사용법




