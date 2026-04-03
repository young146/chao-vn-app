/**
 * 딥링크 URL 생성 및 SNS 공유 유틸리티
 */

const APP_SCHEME = 'chaovietnam://';
const WEB_BASE_URL = 'https://chaovietnam.co.kr/app/share/';

/**
 * 딥링크 URL 생성
 * @param {string} type - 'danggn' | 'job' | 'realestate'
 * @param {string} id - 아이템 ID
 * @param {object} item - 아이템 데이터
 * @returns {object} { deepLink, webLink, shareMessage }
 */
export const generateDeepLink = async (type, id, item) => {
  const deepLink = `${APP_SCHEME}${type}/${id}`;
  
  // 클린 URL — 카카오톡 미리보기 카드가 예쁘게 생성되도록 깔끔한 원래 주소로 원복
  // 구직자(candidates)는 Jobs 컬렉션이 아닌 candidates 컬렉션에 저장됨 → col 파라미터로 전달
  const sourceCollection = item?.sourceCollection;
  const webLink = sourceCollection === 'candidates'
    ? `${WEB_BASE_URL}${type}/${id}?col=candidates`
    : `${WEB_BASE_URL}${type}/${id}`;
  
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
    default:
      return item.title || '';
  }
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
  const { webLink, shareMessage } = await generateDeepLink(type, id, item);
  
  const { shareToSNS } = require('../services/shareService');
  
  try {
    const title = item.title || 'ChaoVietnam';
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
