// 씬짜오 베트남 통합검색 서비스 (앱 ↔ 웹 동일 두뇌 재사용)
// 검색 두뇌 = daily-news-final /api/search (Neon SearchIndex + pg_trgm 한글검색).
// 웹(vnkorlife.com app/page.tsx · /yellowpage)이 쓰는 바로 그 API를 앱에서 fetch로 재사용한다.
// 순수 JS — 네이티브 모듈 0개 → OTA 안전.

// API 베이스. 웹과 동일 기본값. (필요 시 추후 Remote Config 등으로 교체 가능)
export const SEARCH_API = 'https://daily-news-final.vercel.app';

// 결과 타입 라벨/색상 — 화면에서 공통 사용
export const TYPE_LABEL = {
  yellow: '옐로페이지',
  company: '진출기업',
  news: '뉴스',
  magazine: '매거진',
};

// 옐로 카테고리 코드 → 한글 라벨 (웹 /yellowpage 와 동일)
export const CAT_LABEL = {
  food: '음식점', cafe: '카페', beauty: '미용·스파', health: '의료·병원',
  shopping: '쇼핑·생활', travel: '여행·여가', lodging: '숙박', education: '교육·학원',
  school: '학교', legal: '법무·회계', finance: '금융', realestate: '부동산',
  construction: '건설·인테리어', manufacturing: '제조', logistics: '물류·운송',
  design: '광고·디자인', it: 'IT', service: '서비스', other: '기타',
};

const EMPTY = { results: [], facets: { type: {} }, total: 0, page: 1, pageSize: 20 };

// 통합검색 / 디렉토리 브라우즈 공용.
//  - q 가 있으면 키워드 검색, 없으면(옐로 브라우즈처럼) 전체 둘러보기.
//  - 잘못된 응답(에러 등)은 빈 결과로 방어 → 화면이 죽지 않게 (웹과 동일 정책).
export async function searchUnified({ q = '', type = '', city = '', district = '', category = '', sort = '', page = 1 } = {}) {
  try {
    const params = new URLSearchParams({ page: String(page) });
    if (q && q.trim()) params.set('q', q.trim());
    if (type) params.set('type', type);
    if (city) params.set('city', city);
    if (district) params.set('district', district);
    if (category) params.set('category', category);
    if (sort) params.set('sort', sort); // 'category' = 옐로→진출기업→매거진→뉴스 + 가나다

    const res = await fetch(`${SEARCH_API}/api/search?${params.toString()}`);
    const json = await res.json();
    if (json && Array.isArray(json.results)) {
      // facets 누락 방어
      if (!json.facets) json.facets = { type: {} };
      if (!json.facets.type) json.facets.type = {};
      return json;
    }
    return { ...EMPTY };
  } catch (e) {
    return { ...EMPTY };
  }
}

// 지역/카테고리 옵션 — 색인 실제값에서 자동 생성된 목록
//  { cities:[{city,n}], districtsByCity:{[city]:[{district,n}]}, categoriesByType:{[type]:[{category,n}]} }
export async function getRegions() {
  try {
    const res = await fetch(`${SEARCH_API}/api/search/regions`);
    const json = await res.json();
    return {
      cities: Array.isArray(json?.cities) ? json.cities : [],
      districtsByCity: json?.districtsByCity || {},
      categoriesByType: json?.categoriesByType || {},
    };
  } catch (e) {
    return { cities: [], districtsByCity: {}, categoriesByType: {} };
  }
}

// AI 검색 도우미 — 대화형 검색. 백엔드(/api/assistant)의 Claude 가
//  우리 옐로페이지·기사 + 구글 평점을 함께 뒤져 대화로 안내한다. 순수 fetch = OTA 안전.
//  messages = [{role:'user'|'assistant', content}] 누적 대화. 반환 { reply, results }.
export async function askAssistant(messages) {
  try {
    const res = await fetch(`${SEARCH_API}/api/assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: (messages || []).map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    const json = await res.json();
    return {
      reply: (json && json.reply) || '죄송해요, 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.',
      results: json && Array.isArray(json.results) ? json.results : [],
    };
  } catch (e) {
    return { reply: '연결에 문제가 있어요. 잠시 후 다시 시도해 주세요.', results: [] };
  }
}

// 도우미 결과 카드 1건을 눌렀을 때 열 URL — 구글결과=구글맵, 옐로/기업=상세, 뉴스/매거진=원문
export function resolveAssistantResultUrl(r) {
  if (!r) return null;
  if (r.source === 'google') return r.url || null;
  if (r.type === 'yellow' || r.type === 'company') {
    return `https://vnkorlife.com/biz/${encodeURIComponent(r.id)}`;
  }
  return r.url || null;
}

// 검색 결과 1건을 눌렀을 때 열 URL 결정 (앱 v1 = 인앱 브라우저)
//  - 디렉토리(yellow/company)는 항상 우리 사이트 상세페이지(/biz/{id}) — 외부 출처 링크 금지(웹 정책 동일)
//  - 뉴스/매거진은 원문 url
export function resolveResultUrl(r) {
  if (!r) return null;
  if (r.type === 'yellow' || r.type === 'company') {
    return `https://vnkorlife.com/biz/${encodeURIComponent(r.id)}`;
  }
  return r.url || null;
}

// 진출기업·옐로 상세 1건 조회 — 앱 내 팝업(BizDetailSheet)용.
//  웹 /biz/[id] 가 쓰는 바로 그 endpoint. 서버가 진출기업 원본 보강 + 관리자 수정/기타를 이미 병합해서 내려준다.
//  반환: 상세 item 객체 또는 null(없거나 실패). 순수 fetch = OTA 안전.
export async function getDirectoryItem(id) {
  if (!id) return null;
  try {
    const res = await fetch(`${SEARCH_API}/api/search/item?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const json = await res.json();
    return (json && json.item) || null;
  } catch (e) {
    return null;
  }
}

// 디렉토리 결과인지(=인앱 팝업 대상인지) 판정. 구글결과·뉴스·매거진은 false.
export function isDirectoryResult(r) {
  return !!r && r.source !== 'google' && (r.type === 'yellow' || r.type === 'company');
}
