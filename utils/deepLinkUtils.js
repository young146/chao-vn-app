/**
 * 딥링크 URL 생성 및 SNS 공유 유틸리티
 */

const APP_SCHEME = 'chaovietnam://';
const WEB_BASE_URL = 'https://www.vnkorlife.com/';
const CACHE_IMAGE_ENDPOINT = 'https://chaovietnam.co.kr/wp-json/chaovn/v1/share/cache-image';

// 앱 type → vnkorlife.com URL path 매핑
const TYPE_TO_PATH = {
  danggn: 'market',
  job: 'jobs',
  realestate: 'realestate',
  neighbor: 'neighborbusiness',
};

/**
 * 공유 전에 썸네일 URL을 WP 플러그인 캐시에 업로드
 * → 공유 랜딩 페이지가 해당 URL을 og:image로 사용 (카카오톡 미리보기 이미지)
 * 실패해도 공유 자체는 진행 (이미지만 로고로 폴백)
 */
const precacheShareImage = async (type, id, imageUrl) => {
  if (!imageUrl || !imageUrl.startsWith('http')) return;
  try {
    await fetch(CACHE_IMAGE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, item_id: id, image_url: imageUrl }),
    });
  } catch (e) {
    console.warn('[precacheShareImage] failed', e?.message);
  }
};

/**
 * 아이템에서 대표 썸네일 URL 추출 (비디오 피하고 이미지 우선)
 */
const extractThumbnail = (item) => {
  if (!item) return null;
  const imgs = item.images || [];
  if (!imgs.length) return null;
  const types = item.mediaTypes || [];
  const ti = item.thumbnailIndex ?? 0;
  // 지정 썸네일이 비디오면 첫 이미지로 폴백
  if (types[ti] === 'video') {
    const firstImg = types.findIndex((t) => t !== 'video');
    return firstImg >= 0 ? imgs[firstImg] : null;
  }
  return imgs[ti] || imgs[0] || null;
};

// 공유 플랫폼 → utm_source. 카톡은 'kakaotalk' — 'kakao' 로 두면 다음/카카오 *검색* 유입과
// 한 덩어리로 집계돼 공유 기여도를 못 가른다.
const PLATFORM_TO_UTM_SOURCE = {
  kakao: 'kakaotalk',
  facebook: 'facebook',
  threads: 'threads',
  zalo: 'zalo',
  sms: 'sms',
  more: 'sharesheet', // OS 공유 시트 — 최종 도착지는 알 수 없음(정직하게 별도 값)
};

/**
 * 공유 링크에 UTM 부착 — 어느 채널이 실제로 유입을 만드는지 재기 위함.
 *
 * 미리보기 카드는 안 깨진다: vnkorlife-web 의 generateMetadata 는 params([id]) 만 읽고
 * searchParams(쿼리)는 아예 안 읽으므로, 쿼리를 뭘 붙여도 OG 태그가 동일하게 생성된다.
 * (2026-07-17 실측: 깨끗한 URL vs UTM URL 의 og/twitter 태그 9개 전부 일치)
 *
 * ⚠️ 2026-03 에 쿼리 파라미터를 붙였다가 하루 만에 되돌린 이력이 있다(f368fc0 → 22800f1).
 *    그때는 공유 URL 이 PHP(chaovietnam.co.kr/app/share)였고 title/image/price 를 *읽어서*
 *    OG 를 만들던 구조라, 한글이 인코딩된 긴 파라미터가 카드를 깨뜨린 것. 지금 구조와 무관하다.
 *
 * ⚠️ new URL().searchParams 를 쓰지 않는다 — React Native 의 URL 은 불완전해서 searchParams
 *    가 없고(폴리필 미설치), 쓰면 조용히 실패한다. 문자열로 직접 붙인다.
 */
const addShareUtm = (rawUrl, type, platform) => {
  const source = PLATFORM_TO_UTM_SOURCE[platform];
  if (!source) return rawUrl; // 모르는 플랫폼이면 손대지 않음
  const sep = rawUrl.includes('?') ? '&' : '?'; // ?col=candidates 같은 기존 쿼리 보존
  return `${rawUrl}${sep}utm_source=${source}&utm_medium=share&utm_campaign=${encodeURIComponent(type)}`;
};

/**
 * 딥링크 URL 생성
 * @param {string} type - 'danggn' | 'job' | 'realestate' | 'neighbor'
 * @param {string} id - 아이템 ID
 * @param {object} item - 아이템 데이터
 * @param {string} [platform] - 'kakao' | 'facebook' | 'threads' | 'zalo' | 'sms' | 'more'
 *                              지정 시 webLink 에 UTM 부착. 생략 시 기존과 동일(깨끗한 URL).
 * @returns {object} { deepLink, webLink, shareMessage }
 */
export const generateDeepLink = async (type, id, item, platform) => {
  const deepLink = `${APP_SCHEME}${type}/${id}`;

  // 구직자(candidates)는 Jobs 컬렉션이 아닌 candidates 컬렉션에 저장됨 → col 파라미터로 전달
  const sourceCollection = item?.sourceCollection;
  const path = TYPE_TO_PATH[type] || type;
  const baseLink = sourceCollection === 'candidates'
    ? `${WEB_BASE_URL}${path}/${id}?col=candidates`
    : `${WEB_BASE_URL}${path}/${id}`;

  const webLink = addShareUtm(baseLink, type, platform);

  const shareMessage = generateShareMessage(type, item, webLink);

  return {
    deepLink,
    webLink,
    shareMessage,
  };
};

/**
 * 공유 메시지 생성 (웹폼과 동일한 상세 포맷)
 */
const generateShareMessage = (type, item, webLink) => {
  switch (type) {
    case 'danggn':
      return buildDanggnText(item, webLink);
    case 'job':
      return buildJobText(item, webLink);
    case 'realestate':
      return buildRealEstateText(item, webLink);
    case 'neighbor':
      return buildNeighborText(item, webLink);
    default:
      return item.title || item.name || '';
  }
};

/**
 * 이웃사업 공유 텍스트
 */
const buildNeighborText = (item, webLink) => {
  const CAT_LABELS = {
    food: '음식점', service: '서비스', shopping: '쇼핑', lodging: '숙박',
    beauty: '미용', health: '병원/약국', education: '교육', other: '기타',
  };
  const name = item.name || item.title || '';
  const catKey = item.category || '';
  const cat = CAT_LABELS[catKey] || catKey;
  const city = item.city || '';
  const district = item.district || '';
  const addr = item.address || '';
  const desc = item.description || '';
  const phone = item.contacts?.phone || '';
  const kakaoId = item.contacts?.kakaoId || '';
  const zalo = item.contacts?.zalo || '';
  const website = item.contacts?.website || '';

  const loc = [city, district].filter(Boolean).join(' ');

  // 상세 페이지 URL을 먼저 넣어야 카카오톡이 이 URL로 카드 생성 (다른 URL이 앞에 오면 밀림)
  const lines = ['🏪 씬짜오 이웃사업', '━━━━━━━━━━━━━━━━━━━━'];
  if (webLink) lines.push(webLink);
  if (name) lines.push('🏬 업소명: ' + name);
  if (cat) lines.push('🏷️ 카테고리: ' + cat);
  if (loc) lines.push('📍 지역: ' + loc);
  if (addr) lines.push('📮 주소: ' + addr);
  if (desc) {
    const shortDesc = desc.length > 200 ? desc.substring(0, 200) + '...' : desc;
    lines.push('');
    lines.push('📝 소개:');
    lines.push(shortDesc);
  }
  if (phone || kakaoId || zalo || website) {
    lines.push('');
    lines.push('📞 연락처:');
    if (phone) lines.push('   전화: ' + phone);
    if (kakaoId) lines.push('   카카오톡: ' + kakaoId);
    if (zalo) lines.push('   Zalo: ' + zalo);
    if (website) lines.push('   웹사이트: ' + website);
  }

  return lines.join('\n');
};

/**
 * 당근/나눔 공유 텍스트 (웹폼 secondhand/index.html buildText와 동일)
 */
const buildDanggnText = (item, webLink) => {
  const name = item.title || '';
  const price = item.price ? String(item.price) : '가격 문의';
  const cond = item.condition || '';
  const city = item.city || '';
  const district = item.district || '';
  const apt = (item.apartment && item.apartment !== '기타') ? item.apartment : '';
  const desc = item.description || '';
  const phone = item.contact?.phone || item.phone || '';
  const kakaoId = item.contact?.kakaoId || item.kakao || '';
  const other = item.contact?.other || '';

  const loc = [city, district, apt].filter(Boolean).join(' ');

  const lines = ['🥕 씬짜오 당근 / 나눔', '━━━━━━━━━━━━━━━━━━━━'];
  if (name) lines.push('📦 상품명: ' + name);
  if (price) lines.push('💰 가격: ' + price);
  if (cond) lines.push('✨ 상태: ' + cond);
  if (loc) lines.push('📍 위치: ' + loc);
  if (desc) { var shortDesc = desc.length > 200 ? desc.substring(0, 200) + '...' : desc; lines.push(''); lines.push('📝 설명:'); lines.push(shortDesc); }
  if (phone || kakaoId || other) {
    lines.push('');
    lines.push('📞 연락처:');
    if (phone) lines.push('   전화/Zalo: ' + phone);
    if (kakaoId) lines.push('   카카오톡: ' + kakaoId);
    if (other) lines.push('   기타: ' + other);
  }
  if (webLink) { lines.push(''); lines.push('🔗 상세 페이지 (사진 포함):'); lines.push(webLink); }

  return lines.join('\n');
};

/**
 * 구인구직 공유 텍스트
 */
const buildJobText = (item, webLink) => {
  const title = item.title || item.jobTitle || '';
  const salary = item.salary || '급여 협의';
  const jobType = item.jobType || '';
  const industry = item.industry || '';
  const city = item.city || '';
  const district = item.district || '';
  const desc = item.description || item.desc || '';
  const phone = item.contact?.phone || item.phone || '';
  const kakaoId = item.contact?.kakaoId || item.kakao || '';

  const loc = [city, district].filter(Boolean).join(' ');

  const lines = ['💼 씬짜오 구인구직', '━━━━━━━━━━━━━━━━━━━━'];
  if (jobType) lines.push('🔖 구분: ' + jobType);
  if (title) lines.push('📋 제목: ' + title);
  if (industry) lines.push('🏭 업종: ' + industry);
  if (salary) lines.push('💵 급여: ' + salary);
  if (loc) lines.push('📍 위치: ' + loc);
  if (desc) { var shortDesc = desc.length > 200 ? desc.substring(0, 200) + '...' : desc; lines.push(''); lines.push('📝 설명:'); lines.push(shortDesc); }
  if (phone || kakaoId) {
    lines.push('');
    lines.push('📞 연락처:');
    if (phone) lines.push('   전화/Zalo: ' + phone);
    if (kakaoId) lines.push('   카카오톡: ' + kakaoId);
  }
  if (webLink) { lines.push(''); lines.push('🔗 상세 페이지:'); lines.push(webLink); }

  return lines.join('\n');
};

/**
 * 부동산 공유 텍스트
 */
const buildRealEstateText = (item, webLink) => {
  const title = item.title || item.propName || '';
  const dealType = item.dealType || '';
  const price = item.price || item.propPrice || '';
  const city = item.city || '';
  const district = item.district || '';
  const apt = (item.apartment && item.apartment !== '기타') ? item.apartment : '';
  const desc = item.description || item.desc || '';
  const phone = item.contact?.phone || item.phone || '';
  const kakaoId = item.contact?.kakaoId || item.kakao || '';

  const loc = [city, district, apt].filter(Boolean).join(' ');

  const lines = ['🏠 씬짜오 부동산', '━━━━━━━━━━━━━━━━━━━━'];
  if (dealType) lines.push('🔖 거래 유형: ' + dealType);
  if (title) lines.push('🏡 매물명: ' + title);
  if (price) lines.push('💰 가격: ' + String(price));
  if (loc) lines.push('📍 위치: ' + loc);
  if (desc) { var shortDesc = desc.length > 200 ? desc.substring(0, 200) + '...' : desc; lines.push(''); lines.push('📝 설명:'); lines.push(shortDesc); }
  if (phone || kakaoId) {
    lines.push('');
    lines.push('📞 연락처:');
    if (phone) lines.push('   전화/Zalo: ' + phone);
    if (kakaoId) lines.push('   카카오톡: ' + kakaoId);
  }
  if (webLink) { lines.push(''); lines.push('🔗 상세 페이지:'); lines.push(webLink); }

  return lines.join('\n');
};

/**
 * 공유 실행
 * @param {string} type - 'danggn' | 'job' | 'realestate'
 * @param {string} id - 아이템 ID
 * @param {object} item - 아이템 데이터
 * @param {string} platform - 'kakao' | 'facebook' | 'zalo' | 'more'
 */
export const shareItem = async (type, id, item, platform = 'more') => {
  // platform 을 넘겨 webLink 에 UTM 이 붙게 한다 — 어느 SNS 가 유입을 만드는지 측정.
  const { webLink, shareMessage } = await generateDeepLink(type, id, item, platform);

  // OG 이미지용 썸네일 미리 캐싱 (카카오톡 등 미리보기에서 제품 사진 표시)
  // 카카오가 링크를 크롤할 때 og:image가 있어야 하므로 반드시 await (2초 타임아웃)
  const thumb = extractThumbnail(item);
  if (thumb) {
    try {
      await Promise.race([
        precacheShareImage(type, id, thumb),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    } catch {}
  }

  const { shareToSNS } = require('../services/shareService');

  try {
    const title = item.title || item.name || 'ChaoVietnam';
    const result = await shareToSNS(
      platform,
      title,
      shareMessage,
      webLink
    );

    return result;
  } catch (error) {
    console.error('공유 실패:', error);
    return { success: false, error };
  }
};
