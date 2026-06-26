# PROGRESS — 교민 통합검색 / 옐로페이지 시스템

> 시작: 2026-06-26. 흩어진 자산을 한 검색창으로 묶는 "교민의 첫 검색창" 인프라.
> 이어가기 요약은 [WORKLOG.md](WORKLOG.md) 2026-06-26 항목. 이 문서는 *구조·엔드포인트·함정* 상세.

## 큰 그림
- **검색 두뇌 = `daily-news-final`** (Vercel). Neon Postgres `SearchIndex` 단일 색인 + pg_trgm 한글검색.
- **화면 = `vnkorlife.com`** (vnkorlife-web). 검색 데이터를 `daily-news-final` API로 호출만 함.
  - 호출 주소: `process.env.NEXT_PUBLIC_SEARCH_API || "https://daily-news-final.vercel.app"` (vnkorlife Vercel에 env 미설정 → 기본값 사용 중).
- **앱(chao-vn-app)**: 아직 미적용 (다음 단계, 같은 API 재사용 예정).

## 데이터 소스 (색인 5종, type 컬럼)
| type | 출처 | 건수 | 비고 |
|---|---|---|---|
| news | WP REST `categories=31`(데일리뉴스) | ~18k | 6년 아카이브 원본 = WP (Neon NewsItem 은 일부라 미사용) |
| magazine | WP REST `categories_exclude=31` | ~7k | 매거진·교민 콘텐츠 |
| company | `chaovietnam.co.kr/wp-json/xcd/v1/list` | ~5.4k | 진출기업. 상세는 xcd/v1/{id}로 전항목 보강 |
| yellow | `daily-news-final/data/yellowpage_master.json` | ~3.7k | 매거진OCR+라이프플라자. **레포 커밋**(백업+서버읽기) |
| (yellow) neighbor | Firestore `NeighborBusinesses`(active+approved) | 수십 | priority 100 = 옐로 최상단 프리미엄(사진). id `neighbor:*`, type='yellow' |

- **지역 정규화**: 영문 省名·발음변형 → 한글 도시(`CITY_KO`+deAccent). 호치민 군 1~12만 유효(OCR오류 51군 등 제거).
- **중복제거**: 이웃업소와 매거진/라이프플라자 옐로가 겹치면(전화/이름 키) **사진 있는 이웃업소가 이김**.

## 핵심 파일
- `daily-news-final/lib/search-index-core.js` — 빌더 공용(prisma 인자화): buildNews/Magazine/Company/buildYellow(prisma,list)/fetchNeighbor/neighborToRecord/refreshNeighbor/helpers. **CLI·서버 크론 공용**.
- `daily-news-final/scripts/build-search-index.js` — 로컬 전체 재색인 CLI(thin wrapper). 사용: `node scripts/build-search-index.js [news|company|yellow|magazine] [--mag-limit=N]`.
- `daily-news-final/scripts/init-search-index.js` — 테이블·pg_trgm·컬럼 멱등 생성.
- `daily-news-final/lib/apply-directory-edits.js` — 관리자 수정(DirectoryEdit)을 SearchIndex 에 반영/재적용.
- `daily-news-final/data/yellowpage_master.json` — 옐로 마스터 원본(3,767). **여기가 정본**(`.tmp` 아님).

## 엔드포인트 (daily-news-final)
- `GET /api/search?q=&type=&city=&district=&category=&page=` — 통합검색. q 없이 필터만이면 browse(목록). 빈 조건 방지 `WHERE TRUE`. 반환: results(imageUrl 포함)·facets.type·total.
- `GET /api/search/regions` — 도시·구군·타입별 카테고리(빈도 임계).
- `GET /api/search/item?id=` — 상세 1건. company 면 xcd/v1 로 전항목 보강 + DirectoryEdit(관리자수정/기타) 병합.
- `POST /api/directory/edit` — 관리자 수정 저장. **Firebase ID토큰 검증**(`lib/firebase-admin.js` getFirebaseAuth, projectId=chaovietnam-login) + 관리자 이메일 허용 → DirectoryEdit upsert + 색인 즉시 반영.
- `GET|POST /api/directory/refresh-neighbor` — 이웃업소 승인 즉시 색인 반영(neighbor:* 교체 + 중복 yellow 제거). 인증 불필요(권위 Firestore 미러).
- `POST /api/notify-application` — 신청 시 관리자 SendGrid 메일.
- 크론(`vercel.json`): `rebuild-directory`(00:30 UTC, company+yellow+edits) · `rebuild-news`(01:00) · `rebuild-magazine`(01:30). maxDuration news/magazine=300.

## 화면 (vnkorlife-web)
- `app/page.tsx` — 허브 홈(`/`). 검색+지역(검색조건)·세션복원(SS_KEY `xc_hub_search`). 로고/홈탭/제목 클릭 = `<a href="/">`+세션삭제 = 첫화면 새로고침.
- `app/yellowpage/page.tsx` — 옐로 둘러보기(카테고리 칩·도시/구군·키워드, browse). 세션 `xc_yellow_browse`.
- `app/biz/[id]/page.tsx` — 내부 상세(외부 출처 링크 금지). 진출기업 전항목·기타·인라인 지도·이미지. 관리자면 수정 버튼.
- `app/biz/[id]/edit/page.tsx` — 관리자 수정(토큰 인증 API 호출).
- `app/(tabs)/neighborbusiness/new/page.tsx` — 상단노출 **신청**(pending) + 접수 안내. `page.tsx` = `/yellowpage` 리다이렉트.
- `src/components/navigation/GlobalNav.tsx` — '홈/옐로페이지' 탭, 로고·홈·제목 홈리셋.
- `app/admin/page.tsx` — 이웃사업 승인 시 `refresh-neighbor` 호출.

## 함정 / 재발방지
- **검색 색인은 복사본**이다. 원본(WP·Firestore·JSON) 바뀌면 재색인해야 반영. 자동화돼 있으나, 옐로 JSON 자체를 바꾸면(잡지 재디지털화) `data/yellowpage_master.json` 갱신+커밋 필요.
- **옐로 외부링크 금지**(라이프플라자=경쟁사). 디렉토리는 `url=null`→내부 `/biz/[id]`. 진출기업만 자사 homepage 버튼.
- `prisma generate`는 dev 서버가 켜져 있으면 Windows DLL 잠금으로 실패 → 포트 3000 종료 후 실행.
- vnkorlife `permanentRedirect`(308) 캐시 → 홈 교체 후 안 바뀌면 재배포로 캐시 갱신.
- **관리자 수정 저장**: 토큰 검증이 서비스계정 없이 projectId 만으로 동작 예상이나 운영 실토큰 미검증. 실패 시 daily-news Vercel env `FIREBASE_SERVICE_ACCOUNT_JSON` 추가.

## 다음 단계
1. 홈 화면 수익 라인(제휴 배너) 자리 설계·삽입.
2. `/yellowpage`·`/biz` 디자인 허브와 통일.
3. 앱(chao-vn-app)에 통합검색·옐로페이지 적용(같은 API).
4. 관리자 수정 저장 운영 실테스트.
