// 업종 번역 맵
const INDUSTRY_TRANSLATIONS = {
  "전체": { vi: "Tất cả", en: "All" },
  "식당/요리": { vi: "Nhà hàng/Nấu ăn", en: "Restaurant/Cooking" },
  "IT/개발": { vi: "IT/Phát triển", en: "IT/Development" },
  "제조/생산": { vi: "Sản xuất", en: "Manufacturing" },
  "무역/물류": { vi: "Thương mại/Logistics", en: "Trade/Logistics" },
  "교육/강사": { vi: "Giáo dục/Giảng viên", en: "Education/Teaching" },
  "서비스/판매": { vi: "Dịch vụ/Bán hàng", en: "Service/Sales" },
  "사무/관리": { vi: "Văn phòng/Quản lý", en: "Office/Management" },
  "건설/인테리어": { vi: "Xây dựng/Nội thất", en: "Construction/Interior" },
  "미용/뷰티": { vi: "Làm đẹp", en: "Beauty" },
  "통역/번역": { vi: "Phiên dịch/Biên dịch", en: "Interpretation/Translation" },
  "기타": { vi: "Khác", en: "Other" },
};

// 고용형태 번역 맵
const EMPLOYMENT_TYPE_TRANSLATIONS = {
  "정규직": { vi: "Toàn thời gian", en: "Full-time" },
  "계약직": { vi: "Hợp đồng", en: "Contract" },
  "파트타임": { vi: "Bán thời gian", en: "Part-time" },
  "인턴": { vi: "Thực tập sinh", en: "Intern" },
  "프리랜서": { vi: "Freelancer", en: "Freelancer" },
  "협의": { vi: "Thỏa thuận", en: "Negotiable" },
};

// 구인/구직 번역 맵
const JOB_TYPE_TRANSLATIONS = {
  "전체": { vi: "Tất cả", en: "All" },
  "구인": { vi: "Tuyển dụng", en: "Hiring" },
  "구직": { vi: "Tìm việc", en: "Job Seeking" },
};

// 거래유형 번역 맵
const DEAL_TYPE_TRANSLATIONS = {
  "전체": { vi: "Tất cả", en: "All" },
  "임대": { vi: "Cho thuê", en: "Rent" },
  "매매": { vi: "Mua bán", en: "Sale" },
};

// 매물유형 번역 맵
const PROPERTY_TYPE_TRANSLATIONS = {
  "전체": { vi: "Tất cả", en: "All" },
  "아파트": { vi: "Căn hộ", en: "Apartment" },
  "빌라/연립": { vi: "Biệt thự/Nhà liền kề", en: "Villa/Townhouse" },
  "오피스텔": { vi: "Officetel", en: "Officetel" },
  "사무실": { vi: "Văn phòng", en: "Office" },
  "상가/점포": { vi: "Cửa hàng", en: "Shop/Store" },
  "공장/창고": { vi: "Nhà xưởng/Kho", en: "Factory/Warehouse" },
  "토지": { vi: "Đất", en: "Land" },
  "기타": { vi: "Khác", en: "Other" },
};

// 상태 번역 맵 (부동산)
const REAL_ESTATE_STATUS_TRANSLATIONS = {
  "거래가능": { vi: "Có sẵn", en: "Available" },
  "예약중": { vi: "Đang đặt", en: "Reserved" },
  "거래완료": { vi: "Đã bán", en: "Completed" },
};

// 상태 번역 맵 (구인구직)
const JOB_STATUS_TRANSLATIONS = {
  "모집중": { vi: "Đang tuyển", en: "Recruiting" },
  "마감임박": { vi: "Sắp hết hạn", en: "Closing Soon" },
  "마감": { vi: "Đã đóng", en: "Closed" },
};

// 번역 함수들
export const translateIndustry = (industry, language) => {
  if (language === 'ko') return industry;
  return INDUSTRY_TRANSLATIONS[industry]?.[language] || industry;
};

export const translateEmploymentType = (type, language) => {
  if (language === 'ko') return type;
  return EMPLOYMENT_TYPE_TRANSLATIONS[type]?.[language] || type;
};

export const translateJobType = (type, language) => {
  if (language === 'ko') return type;
  return JOB_TYPE_TRANSLATIONS[type]?.[language] || type;
};

export const translateDealType = (type, language) => {
  if (language === 'ko') return type;
  return DEAL_TYPE_TRANSLATIONS[type]?.[language] || type;
};

export const translatePropertyType = (type, language) => {
  if (language === 'ko') return type;
  return PROPERTY_TYPE_TRANSLATIONS[type]?.[language] || type;
};

export const translateRealEstateStatus = (status, language) => {
  if (language === 'ko') return status;
  return REAL_ESTATE_STATUS_TRANSLATIONS[status]?.[language] || status;
};

export const translateJobStatus = (status, language) => {
  if (language === 'ko') return status;
  return JOB_STATUS_TRANSLATIONS[status]?.[language] || status;
};
