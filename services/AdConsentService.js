/**
 * AdMob 사용자 동의 서비스 (UMP - User Messaging Platform)
 * 
 * EU 사용자 및 개인정보 보호법 준수를 위한 광고 동의 관리
 * - GDPR (EU)
 * - CCPA (캘리포니아)
 * 
 * 앱 시작 시 동의 상태를 확인하고 필요시 동의 폼을 표시합니다.
 */

import { Platform } from 'react-native';

// AdsConsent는 Android에서만 사용
let AdsConsent = null;
let AdsConsentStatus = null;
let AdsConsentDebugGeography = null;

if (Platform.OS === 'android') {
  try {
    const GoogleMobileAds = require('react-native-google-mobile-ads');
    AdsConsent = GoogleMobileAds.AdsConsent;
    AdsConsentStatus = GoogleMobileAds.AdsConsentStatus;
    AdsConsentDebugGeography = GoogleMobileAds.AdsConsentDebugGeography;
  } catch (e) {
    console.log('AdsConsent 로드 실패:', e.message);
  }
}

// 동의 상태 캐시
let consentStatus = null;
let canShowAds = false;
let canShowPersonalizedAds = false;

/**
 * 사용자 동의 상태 확인 및 필요시 동의 폼 표시
 * 앱 시작 시 한 번 호출
 */
export const requestAdConsent = async () => {
  // iOS는 ATT로 처리하므로 여기서는 Android만
  if (Platform.OS !== 'android' || !AdsConsent) {
    console.log('📢 iOS 또는 AdsConsent 미지원, 동의 스킵');
    canShowAds = true;
    canShowPersonalizedAds = false;
    return { canShowAds: true, canShowPersonalizedAds: false };
  }

  try {
    console.log('📢 광고 동의 상태 확인 중...');
    
    // 1. 동의 정보 업데이트 요청
    const consentInfo = await AdsConsent.requestInfoUpdate();
    
    console.log('📋 동의 정보:', {
      status: consentInfo.status,
      isConsentFormAvailable: consentInfo.isConsentFormAvailable,
    });

    // 2. 동의가 필요하고 폼이 있으면 표시
    if (
      consentInfo.isConsentFormAvailable &&
      (consentInfo.status === AdsConsentStatus.REQUIRED ||
       consentInfo.status === AdsConsentStatus.UNKNOWN)
    ) {
      console.log('📋 동의 폼 표시 필요');
      const formResult = await AdsConsent.showForm();
      consentStatus = formResult.status;
      console.log('📋 동의 폼 결과:', formResult.status);
    } else {
      consentStatus = consentInfo.status;
    }

    // 3. 동의 상태에 따라 광고 표시 가능 여부 결정
    canShowAds = consentStatus === AdsConsentStatus.OBTAINED ||
                 consentStatus === AdsConsentStatus.NOT_REQUIRED;
    
    // 개인화 광고 가능 여부 확인
    if (canShowAds) {
      try {
        const purposes = await AdsConsent.getUserChoices();
        canShowPersonalizedAds = purposes?.storeAndAccessInformationOnDevice === true;
      } catch (e) {
        canShowPersonalizedAds = false;
      }
    }

    console.log('✅ 광고 동의 완료:', { canShowAds, canShowPersonalizedAds });
    
    return { canShowAds, canShowPersonalizedAds };
  } catch (error) {
    console.log('❌ 광고 동의 에러:', error.message);
    // 에러 시에도 광고는 표시 (비개인화)
    canShowAds = true;
    canShowPersonalizedAds = false;
    return { canShowAds: true, canShowPersonalizedAds: false };
  }
};

/**
 * 현재 광고 표시 가능 여부 반환
 */
export const getAdConsentStatus = () => {
  return {
    canShowAds,
    canShowPersonalizedAds,
    status: consentStatus,
  };
};

/**
 * 동의 설정 초기화 (디버깅용)
 */
export const resetAdConsent = async () => {
  if (Platform.OS !== 'android' || !AdsConsent) return;
  
  try {
    await AdsConsent.reset();
    consentStatus = null;
    canShowAds = false;
    canShowPersonalizedAds = false;
    console.log('🔄 광고 동의 초기화됨');
  } catch (error) {
    console.log('❌ 동의 초기화 실패:', error.message);
  }
};

export default {
  requestAdConsent,
  getAdConsentStatus,
  resetAdConsent,
};

