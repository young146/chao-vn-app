# PROGRESS — 교민 통합검색 / 옐로페이지 시스템

> 시작: 2026-06-26. 흩어진 자산을 한 검색창으로 묶는 "교민의 첫 검색창" 인프라.
> 이어가기 요약은 [WORKLOG.md](WORKLOG.md) 2026-06-26 항목. 이 문서는 *구조·엔드포인트·함정* 상세.

## 큰 그림
- **검색 두뇌 = `daily-news-final`** (Vercel). Neon Postgres `SearchIndex` 단일 색인 + pg_trgm 한글검색.
- **화면 = `vnkorlife.com`** (vnkorlife-web). 검색 데이터를 `daily-news-final` API로 호출만 함.
  - 호출 주소: `process.env.NEXT_PUBLIC_SEARCH_API || "https://daily-news-final.vercel.app"` (vnkorlife Vercel에 env 미설정 → 기본값 사용 중).
- **앱(chao-vn-app)**: ✅ 적용 완료(2026-08-08). 홈=허브 검색창 → `검색결과` 화면이 같은 API 사용.

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

---

## 2026-08-08 — 검색 품질 대수술 + AI 도우미 결합

> 이어가기 요약은 [WORKLOG.md](WORKLOG.md) 2026-08-08(밤) 항목. 여기는 *구조·수치·함정* 상세.
> 앱(chao-vn-app)도 이제 같은 API를 쓴다 — 위 "큰 그림"의 "앱: 아직 미적용"은 해소됐다.

### 1. 검색어 쪼개기 — 가장 큰 결함이었다

**증상(실측)**: 문장으로 검색하면 결과가 거의 안 나온다.

| 검색어 | 전 | 후 |
|---|---|---|
| `베트남 구인구직 안내 정보` | **1건** | 12건 |
| `구인구직 안내` | 0건 | — |
| `구인구직` | 11건 | — |
| `구인` | 219건 | — |
| `2군에 평점 좋은 한식당` | 거의 없음 | 2,235건 |
| `호치민 부동산 추천` | 69건 | 6,621건 |

**원인**: 입력어를 **통째로** `searchText ILIKE '%전체 문장%'`. 그 문장이 통으로 적힌 데이터만 걸린다.
`similarity()` 오타보정도 문장이 길수록 값이 떨어져 도움이 안 됐다.
⚠️ 새 홈이 "무엇이든 물어보세요"로 **문장 입력을 권하므로** 이 결함이 더 자주 드러난다.

**조치**: `lib/search-terms.js` (daily-news-final) 신설.
- 낱말로 쪼개고 군말·조사 제거. 조사 떼기는 **3글자 이상일 때만** — "요가"의 '가'까지 떼면 검색어가 사라진다.
- 부탁 말꼬리 제거 ("소개해줘" → "소개" → 군말로 걸러짐)
- 최대 5낱말, 중복 제거

### 2. "2개 이상 일치" 기준 — 흔한 낱말 폭주 차단

`"베트남 진출을 위한 컨설팅업체를 소개해줘"` → 뉴스 **2,048** · 매거진 **2,521**.
범인은 **'위한'** — "~을 위한"은 기사 수천 개에 있다.
→ 낱말이 2개 이상이면 **최소 2개는 맞아야** 후보. `minTermHits()`.

⚠️ 군말 사전은 **영원히 완성되지 않는다**(사장님 지적). 새 문장이 오면 새 군말이 나온다.
   그래서 사전은 **AI 도착 전 첫 목록용 임시 방편**으로만 두고 **더 늘리지 않는다.** 진짜 답은 3번.

### 3. AI가 이해한 검색어로 목록을 좁힌다 ★ 핵심 구조

목록은 사용자가 친 **문장 그대로**를 받고, AI는 같은 문장을 **이해해서** `search_directory("컨설팅")`을 부른다.
즉 **AI는 이미 좋은 검색어를 만들고 있었는데 버려지고 있었다.**

```
t=0    목록(문장 그대로, 거칠지만 즉시)  +  AI 호출
t≈9초  AI 답변 도착 → terms(AI가 실제로 쓴 검색어)로 목록 재조회·교체
       화면: "✦ AI가 이해한 검색어 [컨설팅]"
```
- `/api/assistant` 응답에 `terms` 추가 (최대 3개)
- 추가 비용 0, 추가 대기 0 — **이미 돌리던 AI 결과의 부산물**
- 검색어를 화면에 밝히는 이유: 결과가 슬쩍 바뀌면 사용자는 **고장으로 받아들인다**

### 4. 정렬 — 관련도가 종류보다 앞

**전**: `종류(옐로→기업→매거진→뉴스) → priority → …`
→ 딱 맞는 매거진 기사가 살짝 스친 옐로 업소보다 **항상 아래**였다.

**후**: `관련도 → 종류 → priority → …`
- 관련도 = 낱말별 **제목 일치 2점 + 본문 일치 1점**
- "한식당"을 찾는 사람은 업소를, "비자 연장"을 찾는 사람은 기사를 원한다. 종류를 고정하면 둘 중 하나는 반드시 틀린다.
- ⚠️ **priority(프리미엄)도 관련도 뒤**로 뒀다. 낱말 하나 스친 프리미엄 업소가 위에 오면
  검색이 망가지고 **결국 광고 지면의 신뢰가 떨어져 광고 가치 자체가 하락**한다.
  같은 관련도끼리는 여전히 프리미엄이 이긴다 — 광고주 약속은 그걸로 충분.

### 5. 같은 규칙을 두 벌로 두면 반드시 어긋난다 ⚠️

`/api/search`(목록)와 `search_directory`(AI 도구)가 **각자 자기 SQL**을 갖고 있었다.
목록만 고쳤더니 **"웹에선 찾아지는데 AI는 못 찾는"** 상태가 됐다.
→ 규칙을 `lib/search-terms.js` 한 곳으로. **새로 검색을 쓰는 곳이 생기면 여기를 import 할 것.**

### 6. 진출기업 색인 보강 (재색인 완료)

원본 `xcd/v1/list`가 주는 필드를 실측(표본 500/5,381):

| 필드 | 채워짐 | 조치 |
|---|---|---|
| `employees` | **58.2%** | 색인 추가 ("한국인 45명 내국인 700명" 같은 자연어) |
| `products` | 55.0% | 이미 있었음 |
| `description` | 2.4% | 색인 추가 |
| `founded_year` | **2.2%** | 색인 추가 — **단, 정렬·필터 기준으로는 쓰지 않음** |

⚠️ `founded_year`를 정렬 기준으로 쓰면 안 되는 이유: 97.8%가 빈 값이라
   "오래된 기업"을 물었을 때 **값이 적힌 소수만 나오고 실제로 더 오래된 기업 대부분이 빠진다.**
   답이 아니라 착시다. AI 프롬프트에도 "비어 있는 것과 짧은 것은 다르다"를 못박았다.

재색인: `GET /api/cron/rebuild-directory` (인증 없음) → company 5,381 · yellow 3,751 · **58초**.
트래픽 적은 시간에 돌릴 것 — 도는 동안 진출기업 결과가 잠시 흔들린다.

### 7. AI 도우미 쪽 변경 (`/api/assistant`)

- 모델 **Haiku 4.5 → Sonnet 5**, `thinking: disabled`, `max_tokens` 2048
  - ⚠️ Sonnet 5는 thinking이 **기본 ON** — 안 끄면 max_tokens를 생각과 답변이 나눠 쓰다 답이 잘린다
  - ⚠️ thinking을 끄면 **도구를 덜 쓴다** → 프롬프트에 "반드시 검색하라"를 박아야 한다. **둘은 한 쌍**
  - 프롬프트 캐싱: system 마지막 블록에 `cache_control` 하나 → 도구 정의까지 함께 캐시
    (Haiku 4.5는 캐시 최소 4,096토큰이라 애초에 캐시가 안 됐다. Sonnet은 1,024)
- **탐색 순서 규칙**: ①우리 서비스 → ②우리 데이터 → ③일반 정보
  - ⚠️ 실제 사고: 내가 넣은 "**무조건 검색부터**"가 "우리 것 먼저"를 이겨서, "중고거래 단톡방"에
    부동산 업소를 답했다. **강한 명령이 약한 서술을 이긴다** — 지시끼리 싸우지 않게 상하관계를 명시할 것.
- **우리 사업정보 내장** — 검색 색인에는 남의 업소·기사만 있어서 우리 서비스는 검색으로 절대 안 나온다.
  정본은 `BUSINESS_CONTEXT.md`. **바뀌면 그쪽을 먼저 고치고 프롬프트에 반영**할 것(어긋나면 도우미가 거짓말을 한다).
- **'씬짜오 안내 책임자' 역할 부여** — 자산을 쓰게 하되, 금지선을 함께 박았다
  ("도움 안 되는데 끼워 넣지 마라 / 없는 걸 있다고 하지 마라 / 잘 답하는 것이 최고의 홍보").
  ⚠️ '홍보 책임자'로 이름 붙이면 영업 톤으로 기울어 **신뢰를 잃고 홍보 효과가 음수**가 된다.

### 남은 것
1. **스트리밍** — 업소 검색 질문은 여전히 15초 안팎. 생성 시간이 대부분이라 프롬프트로는 한계.
   글자 나오는 대로 표시하는 것이 근본 해결. 서버·앱 양쪽 작업.
2. **검색 미리보기** — 타이핑 중 첫 결과 3건 (시안엔 있으나 미구현)
3. **`founded_year` 채우기** — 2.2% → 채우면 "역사가 깊은 기업" 질문이 제대로 답해짐

### 8. 웹(vnkorlife.com) 적용 — 2026-08-09

앱에 만든 통합검색을 웹으로 옮김. **히어로 검색 + 결과화면 AI 카드**만 바꾸고 나머지는 그대로.

**앱↔웹 어디까지 같아야 하나 (원칙)**
| | 같아야 하나 | 이유 |
|---|---|---|
| 두뇌 (색인·낱말쪼개기·순위·AI 프롬프트) | 🔴 예외 없이 | 두 벌이면 반드시 한쪽만 고쳐진다 (5번 항목이 그 사고) |
| 동작 (무엇이 언제 일어나나) | 🔴 예 | 다르게 굴면 그건 두 개의 기능 |
| 화면 (배치·크기·접기) | 🟢 아니오 | 폰은 좁고 손가락, 데스크톱은 넓고 마우스 |

**웹에만 있는 정당한 차이 — URL 처리**
AI 검색어로 좁힐 때 **주소(URL)는 원래 질문 그대로 둔다.** 화면 결과만 정확해진다.
웹은 주소가 곧 상태라, 자동으로 주소까지 바꾸면
  · 뒤로가기가 "좁히기 전"으로 가고
  · 공유한 링크가 사용자가 친 질문이 아니게 된다.
칩("✦ AI가 이해한 검색어")을 누르면 그때 주소도 바뀐다 — 사용자가 명시적으로 원한 것이므로.
`refinedFor` ref 로 **질문 하나당 한 번만** 좁힌다(안 그러면 필터 누를 때마다 원문/좁힘이 경쟁).

**웹 도우미 이어받기**: `/assistant?q=&reply=&ask=` — 앞 문답을 이어붙인다.
⚠️ 앱과 동일한 함정: `send()` 가 state 가 아니라 `messagesRef` 를 본다 → **ref 를 먼저 채우고** send.
⚠️ `useSearchParams` 는 Suspense 경계를 요구해 페이지 구조를 바꿔야 한다 → `window.location` 사용.
