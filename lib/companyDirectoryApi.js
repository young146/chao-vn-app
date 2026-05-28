// ============================================================
// 기업 디렉토리 API 헬퍼 — chaovietnam.co.kr WP REST API (xcd/v1)
// BASE URL: https://chaovietnam.co.kr/wp-json/xcd/v1
// 공개 endpoint (인증 불필요)
// ============================================================

const BASE_URL = 'https://chaovietnam.co.kr/wp-json/xcd/v1';

/**
 * 공통 fetch 래퍼 — 에러 처리 통일
 */
const apiFetch = async (path) => {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`API Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

/**
 * 통합 검색
 * @param {object} params - { q, area, group, page, per_page }
 * @returns {{ items, total, page, total_pages, per_page }}
 */
export const searchCompanies = async ({ q = '', area = '', group = '', page = 1, per_page = 20 } = {}) => {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (area) params.set('area', area);
  if (group) params.set('group', group);
  params.set('page', String(page));
  params.set('per_page', String(per_page));
  return apiFetch(`/search?${params.toString()}`);
};

/**
 * 목록 조회 (필터/정렬)
 * @param {object} params - { page, per_page, area, group, sort, dir }
 * @returns {{ items, total, page, total_pages, per_page }}
 */
export const listCompanies = async ({ page = 1, per_page = 20, area = '', group = '', sort = '', dir = '' } = {}) => {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('per_page', String(per_page));
  if (area) params.set('area', area);
  if (group) params.set('group', group);
  if (sort) params.set('sort', sort);
  if (dir) params.set('dir', dir);
  return apiFetch(`/list?${params.toString()}`);
};

/**
 * 단건 조회
 * @param {number|string} id
 */
export const getCompany = async (id) => {
  return apiFetch(`/${id}`);
};

/**
 * 통계 조회
 */
export const getStats = async () => {
  return apiFetch('/stats');
};
