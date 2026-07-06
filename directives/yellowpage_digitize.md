# Directive: 씬짜오 매거진 옐로페이지 디지털화 (Vol-561)

## 목표
스캔 이미지 PDF(`Z:/VOL/VOL_NEW/Vol-561/04-PDF/561_yellowpage-2.pdf`, 42p)의 업체 디렉토리를
구조화 데이터로 OCR 추출 → 검수 → `NeighborBusinesses` Firestore 스키마로 정규화.

## 입력
- PDF 페이지 = 스캔 JPEG 1장/페이지 (글꼴 0, 추출 텍스트 0 → 비전 OCR 필수)
- 페이지 매핑: **PDF page + 98 = 잡지 page** (PDF 2p = 잡지 100p). PDF 1p = 목차(제외)
- 타일: `scripts/yellowpage/extract_pages.js` 가 페이지당 2(열)×3(행)=6 타일 생성
  (`.tmp/yellowpage/tiles/page_NN_r{1..3}c{1..2}.png`, 2배 확대+샤픈, 4% 겹침)

## 마스터 카테고리 (목차 기준 19종) → app 카테고리 매핑 (병합 단계에서 적용)
| 잡지 섹션 | app category |
|---|---|
| 호치민주요기관 | service (기관) |
| 종합병원 / 의료 | health |
| 호치민국제학교 / 교육 | school / education |
| 종교 | other (종교) |
| 가구·인테리어·건설 | construction |
| 광고·디자인 | design |
| 동창회·동호회 | other (커뮤니티) |
| 금융·은행·송금·보험 | finance |
| 미용·마사지·스파·네일 | beauty |
| 물류·운송·항공·통관 | logistics |
| 법무·회계·공증 | legal |
| 부동산 | realestate |
| 생활(잡화·꽃·선물·이벤트·애완) | shopping / service |
| 음식점·식품·주류 (카페/술집→cafe) | food / cafe |
| 여행·여가·골프·렌트·항공사·호텔 | travel |
| 컴퓨터·주변기기·모바일 | it |
| 산업·건설·제조 | manufacturing / construction |

## 출력 레코드 스키마 (페이지별 JSON: `.tmp/yellowpage/out/page_NN.json`)
```json
{
  "page": 2, "mag_page": 100, "section": "호치민시 주요기관",
  "entries": [
    {
      "name": "주 베트남 대한민국 대사관",
      "name_en": "",
      "contact_person": "",
      "phones": ["024 3831 5110"],
      "address": "SQ4 Diplomatic Complex, Do Nhuan St, Xuan Tao, Bac Tu Liem, Hanoi",
      "extra": "fax/email/homepage 등",
      "confidence": "high",
      "notes": "불확실 글자 표시"
    }
  ]
}
```

## OCR 규칙 (에이전트 준수)
1. 페이지의 6개 타일을 모두 읽는다. 타일은 4% 겹치므로 경계 항목은 중복 등장 → **name+phone 기준 중복 제거**.
2. 전화번호는 **보이는 그대로** 옮긴다(공백 포함). 한 업소에 번호가 여러 개면 배열로.
3. 판독 불확실한 숫자/글자는 추측하지 말고 `?` 로 표기하고 `confidence:"low"` + `notes` 에 사유.
4. 광고(큰 배너)만 있고 디렉토리 항목이 없는 타일은 건너뛴다. 단, 광고 안의 업소명/전화도 항목이면 포함.
5. 주소의 베트남어 지명(PMH, Q.7, Dist.7, P.8 등)은 그대로 보존.
6. 섹션 헤더(페이지 상단 색 띠)를 `section` 에 원문으로 기록.

## 후처리 (merge 단계, `scripts/yellowpage/merge.js`)
- 전 페이지 JSON 병합 → 전화 정규화(+84/0 처리) → 라이프플라자 크롤링과 전화·주소 대조(오독 교정·폐업/신규 플래그)
- app category 매핑 적용, `source:"magazine-561"`, `isSponsor:false` 부여
- 산출물: `.tmp/yellowpage/out/yellowpage.json` + `yellowpage.csv` (검수용)
- 검수 통과 후에만 `NeighborBusinesses` 임포트 (라이브 DB는 그 전까지 미접촉)

## 상태
- [x] PDF 추출·타일링 (42p, 252 tiles)
- [x] OCR (page 2~42) — 41p 처리, 39p에 데이터 (40·42p는 전면광고/판권)
- [x] 병합·정규화·중복제거 → **2,176개 업체** (`yellowpage.json` / `yellowpage.csv`)
      - confidence low 81 / 전화없음 4 / 주소없음 878(원본이 이름+전화만인 경우 다수, 정상)
- [x] 대분류(매거진 섹션) 항목별 배정 — 색 띠 기준. 전환 11p는 태깅(major_*.json), 단일 띠 p는 페이지 1띠. 22대분류
- [x] 라이프플라자 크롤링 (`crawl_lifeplaza.js`) — **2,619개**(전부 주소, 2,149 GPS). 아임웹 지도형 게시판, `?sort=TIME&page=N`
- [x] 비교 (`compare.js`) — 전화매칭 418. **발견: 두 디렉토리는 독립 수집 → 같은 업체도 전화·상호가 달라 자동매칭 25%만**. 차이는 OCR오독 아닌 실제 차이 → 우리 전화 덮어쓰지 않음
- [x] **통합 (`build_directory.js`) → 베트남 남부 옐로페이지 마스터 4,319개** (both 539 / 매거진 1637 / 라이프플라자 2143)
      - 주소→도시·구군 자동추출(호치민 2962·다낭 234·빈증 186·동나이 97…), 카테고리 통일, source 표기
      - 산출: `yellowpage_master.json` / `yellowpage_master.csv`
      - 잔여: 도시 미상 749(주소없는 매거진 항목), 대분류 기타 477(라이프플라자 지역게시판)
- [ ] 사용자 검수 (`yellowpage_master.csv`)
- [ ] NeighborBusinesses 임포트 (source 보존) — **라이브 DB, 사전 승인 필수**
- [ ] 앱·vnkorlife 검색(도시·구군·카테고리) 추가
