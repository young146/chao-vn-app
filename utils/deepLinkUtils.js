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
  
  // 클린 URL — PHP가 Firestore REST API로 직접 OG 태그 세팅
  const webLink = `${WEB_BASE_URL}${type}/${id}`;
  
  const shareMessage = generateShareMessage(type, item);
  
  return {
    deepLink,
    webLink,
    shareMessage,
  };
};

/**
 * 공유 메시지 생성 (간단하게)
 */
const generateShareMessage = (type, item) => {
  const title = item.title || '';
  const price = formatItemPrice(type, item);
  
  switch (type) {
    case 'danggn':
      return `🛍️ ${title}\n💰 ${price}`;
    
    case 'job':
      return `💼 ${title}\n💵 ${price}`;
    
    case 'realestate':
      return `🏠 ${title}\n💰 ${price}`;
    
    default:
      return `${title}`;
  }
};

/**
 * 가격 포맷팅
 */
const formatItemPrice = (type, item) => {
  if (type === 'danggn') {
    return item.price ? `${Number(item.price).toLocaleString()}đ` : '가격 문의';
  }
  
  if (type === 'job') {
    return item.salary || '협의';
  }
  
  if (type === 'realestate') {
    if (item.dealType === '임대') {
      const deposit = item.deposit ? `${Number(item.deposit).toLocaleString()}đ` : '';
      const monthly = item.monthlyRent ? `${Number(item.monthlyRent).toLocaleString()}đ/월` : '';
      return `${deposit} / ${monthly}`;
    }
    return item.price ? `${Number(item.price).toLocaleString()}đ` : '가격 문의';
  }
  
  return '가격 문의';
};

/**
 * 공유 실행
 * @param {string} type - 'danggn' | 'job' | 'realestate'
 * @param {string} id - 아이템 ID
 * @param {object} item - 아이템 데이터
 * @param {string} platform - 'kakao' | 'facebook' | 'zalo' | 'more'
 */
export const shareItem = async (type, id, item, platform = 'more') => {
  const { webLink, shareMessage } = await generateDeepLink(type, id, item);  // await 추가!
  
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
