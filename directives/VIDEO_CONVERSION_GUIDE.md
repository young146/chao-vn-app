# 🎬 iOS 미리보기 비디오 변환 가이드

iPhone/iPad로 직접 촬영한 미리보기 비디오를 App Store Connect 규격으로 변환하는 방법입니다.

## 📋 변환 규격

변환된 비디오는 다음 규격을 만족합니다:
- **해상도**: 1290 x 2796 (iPhone 15 Pro Max)
- **코덱**: H.264 (libx264)
- **형식**: MP4
- **프레임레이트**: 30fps
- **오디오**: AAC (있는 경우)
- **최대 길이**: 30초 (자동 잘림)
- **최대 크기**: 500MB 이하

## 🔧 사전 준비: FFmpeg 설치

### Mac
```bash
brew install ffmpeg
```

### Windows
1. https://ffmpeg.org/download.html 에서 다운로드
2. 또는 Chocolatey 사용: `choco install ffmpeg`
3. PATH 환경변수에 추가

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

## 🚀 사용 방법

### 방법 1: 단일 파일 변환

#### Mac/Linux
```bash
# 스크립트에 실행 권한 부여 (최초 1회)
chmod +x scripts/convert-preview-video.sh

# 비디오 변환
./scripts/convert-preview-video.sh ./preview.mov

# 출력 디렉토리 지정
./scripts/convert-preview-video.sh ./preview.mov ./output
```

#### Windows (PowerShell)
```powershell
# 비디오 변환
.\scripts\convert-preview-video.ps1 -InputFile .\preview.mov

# 출력 디렉토리 지정
.\scripts\convert-preview-video.ps1 -InputFile .\preview.mov -OutputDir .\output
```

### 방법 2: 여러 파일 한 번에 변환

#### Mac/Linux
```bash
# 스크립트에 실행 권한 부여 (최초 1회)
chmod +x scripts/convert-preview-video-all.sh

# 디렉토리 내 모든 비디오 변환
./scripts/convert-preview-video-all.sh ./previews

# 입력/출력 디렉토리 지정
./scripts/convert-preview-video-all.sh ./previews ./previews_converted
```

#### Windows (PowerShell)
```powershell
# 디렉토리 내 모든 비디오 변환
.\scripts\convert-preview-video-all.ps1 -InputDir .\previews

# 입력/출력 디렉토리 지정
.\scripts\convert-preview-video-all.ps1 -InputDir .\previews -OutputDir .\previews_converted
```

## 📝 변환 과정 설명

### 입력 형식
다음 형식을 지원합니다:
- MOV (iPhone 기본 형식)
- MP4
- M4V
- AVI
- 기타 FFmpeg가 지원하는 형식

### 변환 과정
1. **해상도 조정**: 1290x2796으로 리사이즈
   - 원본 비율 유지
   - 부족한 부분은 검은색으로 패딩
2. **코덱 변환**: H.264로 인코딩
3. **프레임레이트**: 30fps로 조정
4. **길이 제한**: 30초 초과 시 자동 잘림
5. **최적화**: 빠른 스트리밍을 위한 최적화

### 출력 파일
- 파일명: `원본파일명_converted.mp4`
- 위치: 지정한 출력 디렉토리 (기본: `./previews_converted`)

## ✅ 변환 후 확인 사항

1. **파일 크기**: 500MB 이하인지 확인
2. **길이**: 30초 이하인지 확인
3. **해상도**: 1290x2796인지 확인
4. **재생**: 정상 재생되는지 확인

## 🔍 문제 해결

### FFmpeg를 찾을 수 없습니다
- FFmpeg가 설치되어 있는지 확인: `ffmpeg -version`
- PATH 환경변수에 추가되어 있는지 확인

### 변환이 너무 느립니다
- `-preset slow`를 `-preset medium` 또는 `-preset fast`로 변경
- 스크립트 파일을 열어서 수정

### 파일 크기가 너무 큽니다
- CRF 값을 높여서 압축률 증가 (기본: 23, 더 높일수록 작아짐)
- 스크립트의 `-crf 23`을 `-crf 28`로 변경

### 해상도를 다른 크기로 변경하고 싶습니다
스크립트에서 다음 부분을 수정:
```bash
# 1290x2796 대신 다른 해상도 사용
-vf "scale=1284:2778:force_original_aspect_ratio=decrease,pad=1284:2778:(ow-iw)/2:(oh-ih)/2:color=black"
```

지원하는 해상도:
- 1290 x 2796 (iPhone 15 Pro Max) ← 기본값
- 1284 x 2778 (iPhone 15 Plus)
- 1179 x 2556 (iPhone 15 Pro)
- 1170 x 2532 (iPhone 15)

## 💡 팁

1. **원본 비율 유지**: 스크립트는 원본 비율을 유지하고 검은색 패딩을 추가합니다
2. **고품질**: `-preset slow`는 더 나은 품질을 제공하지만 시간이 더 걸립니다
3. **빠른 변환**: 시간이 중요하면 `-preset fast` 사용
4. **여러 해상도**: 다른 해상도가 필요하면 스크립트를 복사해서 수정

## 📚 참고

- [FFmpeg 공식 문서](https://ffmpeg.org/documentation.html)
- [App Store Connect 미리보기 가이드](https://developer.apple.com/app-store/app-previews/)




