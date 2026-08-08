/**
 * 뉴스 섹션 이름 — 앱에서 한 곳에서만 정의한다.
 *
 * 왜 파일로 뺐나 (2026-08-08):
 *   섹션 정의가 서버(chaovn-news-api) · Jenny · 앱 화면에 각각 따로 있었고,
 *   그중 앱 쪽 매핑이 MagazineScreen 안에만 박혀 있어서 상세화면은 쓸 수 없었다.
 *   같은 날 "Jenny 에 이미 있는 키를 모르고 새로 지어내" 앱 '더보기'가 통째로 비는
 *   사고를 냈다. 같은 규칙을 여러 곳에 적으면 반드시 어긋난다 — 그래서 한 곳으로 모은다.
 *
 * ⚠️ 여기 키(왼쪽)는 워드프레스 post meta `news_category` 의 **실제 값**이다.
 *    서버의 chaovn_get_sections_config() / Jenny 의 jenny_get_sections_keys() 와
 *    같은 값을 다룬다. 새 분류가 생기면 **서버·Jenny·여기 셋을 함께** 고쳐야 한다.
 */

/** post meta 값 → i18n 키 (`home:sections.*`) */
export const NEWS_CATEGORY_KEY_MAP = {
  // 한국 국내 뉴스. Jenny 의 'korea_hot' 과 짝이다.
  'Korea-Hot': 'koreaHot',
  '한국 주요뉴스': 'koreaHot',

  Society: 'society',
  Economy: 'economy',
  Culture: 'culture',
  Politics: 'politics',
  International: 'international',
  'Korea-Vietnam': 'koreaVietnam',
  Community: 'community',
  Travel: 'travel',
  Health: 'health',
  Food: 'food',
  Other: 'other',
  'Real Estate': 'realEstate',

  // 아래는 예전 수집기가 쓰던 값들. 지금은 안 나오지만 옛 기사에 남아 있다.
  Sports: 'sports',
  Technology: 'technology',
  Education: 'education',
  Entertainment: 'entertainment',
  Business: 'business',
  World: 'world',
  Life: 'life',
  Pet: 'pet',
  Weather: 'weather',
  Opinion: 'opinion',
  Lifestyle: 'lifestyle',
  Wellness: 'wellness',
  Recipe: 'recipe',
};

/**
 * 분류 값을 화면에 쓸 이름으로 바꾼다.
 *
 * @param {string} raw  post meta `news_category` 값 (예: 'Economy', 'Korea-Hot')
 * @param {Function} t  useTranslation('home') 의 t
 * @returns {string} 번역된 이름. 모르는 값이면 **원문 그대로** 돌려준다
 *                   (빈 문자열보다 낫다 — 최소한 무슨 분류인지는 보인다)
 */
export function getSectionLabel(raw, t) {
  const value = (raw || '').trim();
  if (!value) return '';

  const key = NEWS_CATEGORY_KEY_MAP[value];
  if (!key || typeof t !== 'function') return value;

  const label = t(`sections.${key}`);
  // i18n 에 키가 없으면 t() 는 키 문자열을 그대로 돌려준다 — 그건 화면에 쓰면 안 된다
  return label && label !== `sections.${key}` ? label : value;
}
