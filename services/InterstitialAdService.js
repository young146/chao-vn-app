/**
 * 전면 광고 서비스 (Interstitial Ad)
 * 
 * 전면 광고는 화면 전체를 차지하며 사용자가 닫아야 합니다.
 * - 화면 전환 시 (예: 게시글 나갈 때)
 * - 특정 액션 후 (예: 저장 완료 후)
 * 
 * ⚠️ 너무 자주 표시하면 사용자 경험이 나빠지므로 최소 2-3분 간격 권장
 */

import { Platform } from 'react-native';

// 전면 광고 관련 import (Android만)
let InterstitialAd = null;
let AdEventType = null;
let TestIds = null;

if (Platform.OS === 'android') {
  try {
    const GoogleMobileAds = require('react-native-google-mobile-ads');
    InterstitialAd = GoogleMobileAds.InterstitialAd;
    AdEventType = GoogleMobileAds.AdEventType;
    TestIds = GoogleMobileAds.TestIds;
  } catch (e) {
    console.log('InterstitialAd 로드 실패:', e.message);
  }
}

// 광고 단위 ID
const INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-7944314901202352/3814173100';

// 전면 광고 인스턴스
let interstitialAd = null;
let isAdLoaded = false;
let isAdLoading = false;

// 마지막 광고 표시 시간 (너무 자주 표시 방지)
let lastShownTime = 0;
const MIN_INTERVAL = 3 * 60 * 1000; // 최소 3분 간격

/**
 * 전면 광고 미리 로드
 * 앱 시작 시 또는 광고 표시 후 호출
 */
export const preloadInterstitialAd = () => {
  if (Platform.OS !== 'android' || !InterstitialAd) {
    console.log('📢 전면 광고는 Android만 지원');
    return;
  }

  if (isAdLoading || isAdLoaded) {
    console.log('📢 전면 광고 이미 로딩 중 또는 로드됨');
    return;
  }

  try {
    isAdLoading = true;
    
    // 광고 인스턴스 생성
    const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : INTERSTITIAL_AD_UNIT_ID;
    interstitialAd = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    // 이벤트 리스너 등록
    interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      console.log('✅ 전면 광고 로드 완료');
      isAdLoaded = true;
      isAdLoading = false;
    });

    interstitialAd.addAdEventListener(AdEventType.ERROR, (error) => {
      console.log('❌ 전면 광고 로드 실패:', error.message);
      isAdLoaded = false;
      isAdLoading = false;
    });

    interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('📢 전면 광고 닫힘, 다시 로드');
      isAdLoaded = false;
      // 광고 닫힌 후 다시 미리 로드
      setTimeout(() => preloadInterstitialAd(), 1000);
    });

    // 광고 로드
    interstitialAd.load();
    console.log('📢 전면 광고 로딩 시작...');
  } catch (error) {
    console.log('❌ 전면 광고 초기화 실패:', error.message);
    isAdLoading = false;
  }
};

/**
 * 전면 광고 표시
 * @returns {Promise<boolean>} 광고 표시 성공 여부
 */
export const showInterstitialAd = async () => {
  if (Platform.OS !== 'android' || !InterstitialAd) {
    console.log('📢 전면 광고는 Android만 지원');
    return false;
  }

  // 최소 간격 체크
  const now = Date.now();
  if (now - lastShownTime < MIN_INTERVAL) {
    const remaining = Math.ceil((MIN_INTERVAL - (now - lastShownTime)) / 1000);
    console.log(`📢 전면 광고 쿨다운 중... ${remaining}초 남음`);
    return false;
  }

  if (!isAdLoaded || !interstitialAd) {
    console.log('📢 전면 광고가 아직 로드되지 않음');
    // 다음을 위해 로드 시작
    preloadInterstitialAd();
    return false;
  }

  try {
    await interstitialAd.show();
    lastShownTime = Date.now();
    isAdLoaded = false;
    console.log('✅ 전면 광고 표시됨');
    return true;
  } catch (error) {
    console.log('❌ 전면 광고 표시 실패:', error.message);
    isAdLoaded = false;
    preloadInterstitialAd(); // 다시 로드
    return false;
  }
};

/**
 * 전면 광고 로드 상태 확인
 */
export const isInterstitialAdReady = () => {
  return isAdLoaded && interstitialAd !== null;
};

/**
 * 다음 광고까지 남은 시간 (초)
 */
export const getTimeUntilNextAd = () => {
  const elapsed = Date.now() - lastShownTime;
  if (elapsed >= MIN_INTERVAL) return 0;
  return Math.ceil((MIN_INTERVAL - elapsed) / 1000);
};

export default {
  preloadInterstitialAd,
  showInterstitialAd,
  isInterstitialAdReady,
  getTimeUntilNextAd,
};

