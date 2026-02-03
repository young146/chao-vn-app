/**
 * 가격 포맷 유틸리티
 * 언어에 따라 다른 단위로 가격을 표시
 * 
 * 한국어: 만, 억
 * 베트남어: triệu (tr), tỷ (ty)
 * 영어: million (M), billion (B)
 */

/**
 * 일반 가격 포맷 (당근/나눔, 찜 목록 등)
 * @param {number} price - 가격 (VND)
 * @param {string} language - 언어 코드 ('ko', 'vi', 'en')
 * @returns {string} 포맷된 가격 문자열
 */
export const formatPrice = (price, language = 'ko') => {
  if (!price) return '0₫';
  const num = parseInt(price);
  
  if (language === 'vi') {
    // 베트남어: triệu (tr), tỷ (ty)
    if (num >= 1000000000) {
      // 1 tỷ 이상
      const ty = num / 1000000000;
      return `${ty % 1 === 0 ? ty.toFixed(0) : ty.toFixed(1)} tỷ`;
    } else if (num >= 1000000) {
      // 1 triệu 이상
      const tr = num / 1000000;
      return `${tr % 1 === 0 ? tr.toFixed(0) : tr.toFixed(1)} tr`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('vi-VN').format(num) + '₫';
  } else if (language === 'en') {
    // 영어: million (M), billion (B)
    if (num >= 1000000000) {
      const b = num / 1000000000;
      return `${b % 1 === 0 ? b.toFixed(0) : b.toFixed(1)}B ₫`;
    } else if (num >= 1000000) {
      const m = num / 1000000;
      return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M ₫`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K ₫`;
    }
    return new Intl.NumberFormat('en-US').format(num) + ' ₫';
  } else {
    // 한국어 기본
    return new Intl.NumberFormat('ko-KR').format(num) + '₫';
  }
};

/**
 * 부동산 임대 가격 포맷 (만동 단위 입력)
 * @param {number} price - 가격 (만동 단위)
 * @param {string} language - 언어 코드
 * @param {string} unit - 추가 단위 텍스트 (예: '월')
 * @returns {string} 포맷된 가격 문자열
 */
export const formatRentPrice = (price, language = 'ko', unit = '') => {
  if (!price) {
    return language === 'vi' ? 'Thỏa thuận' : language === 'en' ? 'Negotiable' : '협의';
  }
  
  const num = parseInt(price);
  // 입력값은 만동 단위 → VND로 변환: num * 10,000
  const vnd = num * 10000;
  
  if (language === 'vi') {
    const unitText = unit === '월' ? '/tháng' : unit;
    if (vnd >= 1000000000) {
      const ty = vnd / 1000000000;
      return `${ty % 1 === 0 ? ty.toFixed(0) : ty.toFixed(1)} tỷ ${unitText}`.trim();
    } else if (vnd >= 1000000) {
      const tr = vnd / 1000000;
      return `${tr % 1 === 0 ? tr.toFixed(0) : tr.toFixed(1)} tr ${unitText}`.trim();
    }
    return `${num.toLocaleString()}만 ${unitText}`.trim();
  } else if (language === 'en') {
    const unitText = unit === '월' ? '/month' : unit;
    if (vnd >= 1000000000) {
      const b = vnd / 1000000000;
      return `${b % 1 === 0 ? b.toFixed(0) : b.toFixed(1)}B ${unitText}`.trim();
    } else if (vnd >= 1000000) {
      const m = vnd / 1000000;
      return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M ${unitText}`.trim();
    }
    return `${num.toLocaleString()}만 ${unitText}`.trim();
  } else {
    // 한국어
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}억 ${unit || ''}`.trim();
    }
    return `${num.toLocaleString()}만 ${unit || ''}`.trim();
  }
};

/**
 * 부동산 매매 가격 포맷 (억동 단위 입력)
 * @param {number} price - 가격 (억동 단위)
 * @param {string} language - 언어 코드
 * @returns {string} 포맷된 가격 문자열
 */
export const formatSalePrice = (price, language = 'ko') => {
  if (!price) {
    return language === 'vi' ? 'Thỏa thuận' : language === 'en' ? 'Negotiable' : '협의';
  }
  
  const num = parseFloat(price);
  // 입력값은 억동 단위 → VND로 변환: num * 100,000,000
  const vnd = num * 100000000;
  
  if (language === 'vi') {
    if (vnd >= 1000000000) {
      const ty = vnd / 1000000000;
      return `${ty % 1 === 0 ? ty.toFixed(0) : ty.toFixed(1)} tỷ`;
    } else if (vnd >= 1000000) {
      const tr = vnd / 1000000;
      return `${tr % 1 === 0 ? tr.toFixed(0) : tr.toFixed(1)} tr`;
    }
    return new Intl.NumberFormat('vi-VN').format(vnd) + '₫';
  } else if (language === 'en') {
    if (vnd >= 1000000000) {
      const b = vnd / 1000000000;
      return `${b % 1 === 0 ? b.toFixed(0) : b.toFixed(1)}B`;
    } else if (vnd >= 1000000) {
      const m = vnd / 1000000;
      return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
    }
    return new Intl.NumberFormat('en-US').format(vnd) + ' ₫';
  } else {
    // 한국어
    if (num >= 100) {
      return `${(num / 100).toFixed(0)}천억`;
    }
    return `${num}억`;
  }
};

export default {
  formatPrice,
  formatRentPrice,
  formatSalePrice,
};
