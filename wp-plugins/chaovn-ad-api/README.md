# ChaoVN Ad API 플러그인

Ad Inserter 플러그인의 광고 데이터를 REST API로 노출하여 ChaoVN 앱에서 사용할 수 있게 합니다.

## 설치 방법

### 방법 1: FTP 업로드
1. `chaovn-ad-api` 폴더 전체를 `/wp-content/plugins/` 폴더에 업로드
2. WordPress 관리자 → 플러그인 → "ChaoVN Ad API" 활성화

### 방법 2: ZIP 업로드
1. `chaovn-ad-api` 폴더를 ZIP으로 압축
2. WordPress 관리자 → 플러그인 → 새로 추가 → 플러그인 업로드
3. ZIP 파일 선택 후 설치 및 활성화

## API 엔드포인트

### 광고 목록 가져오기
```
GET https://chaovietnam.co.kr/wp-json/chaovn/v1/ads
```

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "banner": [
      {
        "id": 1,
        "name": "Banner-Top",
        "imageUrl": "https://chaovietnam.co.kr/ads/banner1.jpg",
        "linkUrl": "https://advertiser.com/promo"
      }
    ],
    "inline": [...],
    "section": [...]
  },
  "meta": {
    "total": 5,
    "generated_at": "2026-01-22T10:30:00+09:00"
  }
}
```

### 디버그 (관리자 전용)
```
GET https://chaovietnam.co.kr/wp-json/chaovn/v1/ads/debug
```
※ WordPress 관리자로 로그인한 상태에서만 접근 가능

## Ad Inserter 설정 가이드

### 광고 위치 지정 방법

광고가 앱에서 어디에 표시될지는 **블록 이름** 또는 **블록 번호**로 결정됩니다.

#### 방법 1: 블록 이름으로 지정 (권장)
Ad Inserter에서 블록 이름에 키워드를 포함시키세요:

| 키워드 | 앱 표시 위치 | 예시 이름 |
|--------|-------------|----------|
| `banner` 또는 `배너` | 상단 배너 (50px) | "Banner-Top", "메인배너" |
| `inline` 또는 `인라인` | 콘텐츠 중간 (250px) | "Inline-1", "인라인광고" |
| `section` 또는 `섹션` | 섹션 구분 (100px) | "Section-Footer", "섹션광고" |

#### 방법 2: 블록 번호로 지정
이름에 키워드가 없으면 블록 번호로 자동 분류됩니다:

| 블록 번호 | 앱 표시 위치 |
|-----------|-------------|
| 1-5번 | banner |
| 6-10번 | inline |
| 11-16번 | section |

### 광고 코드 작성 예시

Ad Inserter 블록에 다음과 같이 입력하세요:

```html
<a href="https://광고주사이트.com/landing">
  <img src="https://chaovietnam.co.kr/wp-content/uploads/ads/광고이미지.jpg" alt="광고">
</a>
```

## 문제 해결

### 광고가 앱에 안 나와요
1. 플러그인이 활성화되어 있는지 확인
2. `https://chaovietnam.co.kr/wp-json/chaovn/v1/ads` 접속해서 데이터 확인
3. Ad Inserter 블록에 이미지가 포함되어 있는지 확인

### 링크가 기본값(chaovietnam.co.kr)으로 나와요
- Ad Inserter에서 광고 코드에 `<a href="...">` 태그가 제대로 포함되어 있는지 확인
- href 속성이 `http://` 또는 `https://`로 시작하는지 확인

### 디버그 API로 원본 데이터 확인
관리자로 로그인 후 다음 URL 접속:
```
https://chaovietnam.co.kr/wp-json/chaovn/v1/ads/debug
```

## 버전 히스토리

### v1.0.0 (2026-01-22)
- 초기 릴리즈
- Ad Inserter 블록 1-16 지원
- 이미지/링크 자동 추출
- 위치별 광고 분류 (banner, inline, section)
