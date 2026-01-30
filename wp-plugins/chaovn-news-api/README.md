# ChaoVN News Terminal REST API

## 개요
Jenny Daily News Display 플러그인의 뉴스 데이터를 REST API로 제공하는 플러그인입니다.

**중요: Jenny 플러그인을 전혀 수정하지 않습니다. 별도의 REST API 엔드포인트만 추가합니다.**

## 요구사항
- WordPress 5.0 이상
- **Jenny Daily News Display 플러그인 활성화 필수**

## 설치 방법

### 1. 백업 먼저!
설치 전에 반드시 WordPress 백업을 해두세요.

### 2. 플러그인 업로드
1. FTP로 `/wp-content/plugins/` 폴더에 접속
2. `chaovn-news-api` 폴더 전체를 업로드
3. WordPress 관리자 → 플러그인 → "ChaoVN News Terminal REST API" 활성화

### 3. 테스트
브라우저에서 접속하여 확인:
```
https://chaovietnam.co.kr/wp-json/chaovn/v1/news-terminal
```

## API 엔드포인트

### 오늘의 뉴스 (또는 최근 발행일)
```
GET /wp-json/chaovn/v1/news-terminal
```

### 특정 날짜의 뉴스
```
GET /wp-json/chaovn/v1/news-terminal/2026-01-30
```

## 응답 예시
```json
{
  "success": true,
  "date": "2026-01-30",
  "topNews": [
    {
      "id": 12345,
      "title": {"rendered": "뉴스 제목"},
      "excerpt": "뉴스 요약...",
      "thumbnail": "https://...",
      "link": "https://...",
      "date": "2026.01.30",
      "category": "경제",
      "source": "VnExpress",
      "isTop": true
    }
  ],
  "newsSections": [
    {
      "key": "economy",
      "name": "경제",
      "posts": [...]
    }
  ],
  "totalCount": 25
}
```

## 문제 발생 시
1. 플러그인 비활성화 (Jenny 플러그인에는 영향 없음)
2. `/wp-content/plugins/chaovn-news-api/` 폴더 삭제
3. 기존 뉴스 터미널 페이지는 정상 작동 유지

## 버전
- 1.0.0: 최초 릴리즈
