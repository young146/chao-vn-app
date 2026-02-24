import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, Image, TouchableOpacity, Linking, Platform, Modal, Text, Dimensions, Animated } from "react-native";
import { Video, ResizeMode } from "expo-av";
import axios from "axios";

// ============================================
// 🎯 ChaoVN 광고 시스템 v2.0
// ACF + CPT 기반 단순화된 슬롯 시스템
// ============================================

// AdMob 배너 (Android만 사용, 자체 광고 없을 때 폴백)
let BannerAd = null;
let BannerAdSizeEnum = null;
let TestIds = null;

if (Platform.OS === 'android') {
  try {
    const GoogleMobileAds = require('react-native-google-mobile-ads');
    BannerAd = GoogleMobileAds.BannerAd;
    BannerAdSizeEnum = GoogleMobileAds.BannerAdSize;
    TestIds = GoogleMobileAds.TestIds;
  } catch (e) {
    console.log('AdMob 로드 실패, 자체 광고만 사용:', e.message);
  }
}

// ============================================
// 설정
// ============================================
const API_BASE_URL = "https://chaovietnam.co.kr/wp-json/chaovn/v2";
const CACHE_DURATION = 10 * 60 * 1000; // 10분 캐시

// AdMob 광고 단위 ID (자체 광고 없을 때만 사용)
const ADMOB_AD_UNITS = {
  BANNER: 'ca-app-pub-7944314901202352/4259843310',    // 헤더 배너 (새로 생성)
  INLINE: 'ca-app-pub-7944314901202352/8698508125',    // 인라인 배너 (새로 생성)
};

// 광고 슬롯 정의 (WordPress와 동일)
const AD_SLOTS = {
  HOME_BANNER: 'home_banner',      // 홈 대형 배너
  HOME_INLINE: 'home_inline',      // 홈 섹션 사이
  HEADER: 'header',                // 리스트 상단 배너
  INLINE: 'inline',                // 리스트 인라인 광고
  DETAIL_TOP: 'detail_top',        // 상세 페이지 상단
  DETAIL_BOTTOM: 'detail_bottom',  // 상세 페이지 하단
  POPUP: 'popup',                  // 전면 팝업 광고
};

// 화면(섹션) 정의
const AD_SCREENS = {
  ALL: 'all',
  HOME: 'home',
  NEWS: 'news',
  JOB: 'job',
  REALESTATE: 'realestate',
  DANGGN: 'danggn',
};

// ============================================
// 캐시
// ============================================
let cachedAds = null;
let lastFetchTime = 0;
let currentScreen = 'all';

// ============================================
// 인라인 광고 중복 방지 (인덱스 기반)
// ============================================
let inlineAdCounter = 0;
let lastInlineScreen = null;
let inlineAdsCount = 0; // 사용 가능한 인라인 광고 수

// 화면 전환 시 카운터 초기화
const getInlineAdIndex = (screen) => {
  if (lastInlineScreen !== screen) {
    inlineAdCounter = 0;
    lastInlineScreen = screen;
  }
  return inlineAdCounter++;
};

// 인라인 광고 수 설정
const setInlineAdsCount = (count) => {
  inlineAdsCount = count;
};

// 현재 인덱스가 광고 수를 초과하는지 확인
const isInlineAdAvailable = (index) => {
  return index < inlineAdsCount;
};

// ============================================
// 광고 미디어 렌더링 (비디오/이미지)
// ============================================

/**
 * 광고 미디어 컴포넌트 (비디오 우선, 이미지 폴백)
 * @param {object} ad - 광고 데이터
 * @param {object} style - 스타일
 * @param {string} thumbnailKey - 썸네일 키 (home_banner, header, inline, etc.)
 */
const AdMedia = ({ ad, style, thumbnailKey = null }) => {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);

  // 비디오가 있으면 비디오 재생
  if (ad?.videoUrl) {
    return (
      <View style={[style, { position: 'relative' }]}>
        <Video
          ref={videoRef}
          source={{ uri: ad.videoUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode={ResizeMode.COVER}
          shouldPlay={true}
          isLooping={true}
          isMuted={isMuted}
          useNativeControls={false}
        />
        {/* 음소거 토글 버튼 */}
        <TouchableOpacity
          style={styles.muteButton}
          onPress={() => setIsMuted(!isMuted)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.muteIcon}>{isMuted ? '🔇' : '🔊'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 이미지 표시
  const imageUrl = thumbnailKey && ad?.thumbnails?.[thumbnailKey]
    ? ad.thumbnails[thumbnailKey]
    : ad?.imageUrl;

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={style}
        resizeMode="cover"
      />
    );
  }

  return null;
};

// ============================================
// API 호출
// ============================================

/**
 * 광고 데이터 가져오기 (캐시 적용)
 * @param {string} screen - 화면 타입 (all, home, news, job, realestate, danggn)
 */
const fetchAdConfig = async (screen = 'all') => {
  const now = Date.now();

  // 캐시가 유효하고 같은 screen이면 캐시 반환
  if (cachedAds && (now - lastFetchTime) < CACHE_DURATION && currentScreen === screen) {
    return cachedAds;
  }

  try {
    console.log(`📢 광고 API 호출: screen=${screen}`);
    const response = await axios.get(`${API_BASE_URL}/ads`, {
      params: { screen },
      timeout: 8000,
    });

    if (response.data?.success && response.data?.data) {
      cachedAds = response.data.data;
      lastFetchTime = now;
      currentScreen = screen;

      // 광고 수 로깅
      const counts = Object.entries(cachedAds)
        .map(([slot, ads]) => `${slot}:${ads.length}`)
        .join(', ');
      console.log(`✅ 광고 로드 완료: ${counts}`);

      return cachedAds;
    }
  } catch (error) {
    console.log('❌ 광고 API 실패:', error.message);
  }

  // 실패 시 빈 슬롯 반환
  return {
    home_banner: [],
    home_inline: [],
    header: [],
    inline: [],
    detail_top: [],
    detail_bottom: [],
    popup: [],
    fixed_top: [],
    fixed_bottom: [],
  };
};

/**
 * 광고 클릭 추적
 * @param {object} ad - 광고 객체
 */
const trackAdClick = async (ad) => {
  if (!ad?.id) return;

  try {
    await axios.post(`${API_BASE_URL}/ads/${ad.id}/click`);
    console.log(`📊 광고 클릭 추적: ${ad.id}`);
  } catch (error) {
    console.log('클릭 추적 실패:', error.message);
  }
};

/**
 * 광고 클릭 핸들러
 */
const handleAdPress = async (ad) => {
  if (!ad) return;

  // 클릭 추적 (비동기)
  trackAdClick(ad);

  // 링크 열기
  if (ad.linkUrl) {
    try {
      await Linking.openURL(ad.linkUrl);
    } catch (error) {
      console.log('광고 링크 열기 실패:', error.message);
    }
  }
};

/**
 * 우선순위 기반 랜덤 선택
 * 우선순위가 높은 광고가 선택될 확률이 높음
 * @param {array} ads - 광고 배열
 */
const getRandomAdByPriority = (ads) => {
  if (!ads || ads.length === 0) return null;
  if (ads.length === 1) return ads[0];

  // 우선순위 가중치로 랜덤 선택
  const totalWeight = ads.reduce((sum, ad) => sum + (ad.priority || 10), 0);
  let random = Math.random() * totalWeight;

  for (const ad of ads) {
    random -= (ad.priority || 10);
    if (random <= 0) return ad;
  }

  return ads[0];
};

// ============================================
// 📌 광고 슬라이더 공통 컴포넌트
// ============================================

/**
 * AdSlider - 여러 광고를 5초 간격으로 자동 슬라이딩
 * @param {array}  ads          - 광고 객체 배열
 * @param {object} containerStyle - 컨테이너 스타일
 * @param {string} thumbnailKey - 사용할 썸네일 키
 * @param {number} intervalMs  - 전환 간격 (ms), 기본 5000
 * @param {boolean} showIndicator - 하단 인디케이터 점 표시 여부
 */
export function AdSlider({ ads, containerStyle, thumbnailKey = null, intervalMs = 5000, showIndicator = true }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const SCREEN_WIDTH = Dimensions.get('window').width;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const goToNext = useCallback(() => {
    if (!ads || ads.length <= 1) return;
    // 1) 현재 광고를 왼쪽으로 밀어냄
    Animated.timing(slideAnim, {
      toValue: -SCREEN_WIDTH,
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      // 2) 인덱스 업데이트 + 오른쪽에서 시작
      setCurrentIndex(prev => (prev + 1) % ads.length);
      slideAnim.setValue(SCREEN_WIDTH);
      // 3) 오른쪽에서 왼쪽으로 슬라이드 인
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start();
    });
  }, [ads, slideAnim, SCREEN_WIDTH]);

  useEffect(() => {
    if (!ads || ads.length <= 1) return;

    // ⚠️ 현재 광고가 비디오이면 슬라이딩 중단 (영상 재생 보장)
    const currentAd = ads[currentIndex];
    if (currentAd?.videoUrl) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    timerRef.current = setInterval(goToNext, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [ads, currentIndex, goToNext, intervalMs]);

  if (!ads || ads.length === 0) return null;

  const ad = ads[currentIndex];
  if (!ad?.imageUrl && !ad?.videoUrl) return null;

  const isVideo = !!ad?.videoUrl;

  return (
    <View style={[containerStyle, { overflow: 'hidden' }]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => handleAdPress(ad)}
          activeOpacity={0.85}
        >
          <AdMedia ad={ad} style={styles.adImage} thumbnailKey={thumbnailKey} />
        </TouchableOpacity>
      </Animated.View>

      {/* 인디케이터 점 */}
      {showIndicator && ads.length > 1 && (
        <View style={styles.indicatorRow}>
          {ads.map((a, idx) => (
            <View
              key={idx}
              style={[
                styles.indicatorDot,
                idx === currentIndex && styles.indicatorDotActive,
                idx === currentIndex && a?.videoUrl && styles.indicatorDotVideo,
              ]}
            />
          ))}
          {isVideo && (
            <Text style={styles.indicatorVideoLabel}>▶</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ============================================
// 📌 광고 컴포넌트들
// ============================================

/**
 * 홈 대형 배너 (홈 화면 전용) - 5초마다 슬라이딩
 */
export function HomeBanner({ style, intervalMs = 5000 }) {
  const [adList, setAdList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAd = async () => {
      setIsLoading(true);
      const ads = await fetchAdConfig('home');
      const homeBannerAds = (ads?.home_banner || []).filter(a => a?.imageUrl || a?.videoUrl);
      // 우선순위 정렬
      homeBannerAds.sort((a, b) => (b.priority || 10) - (a.priority || 10));
      setAdList(homeBannerAds);
      setIsLoading(false);
    };
    loadAd();
  }, []);

  if (isLoading) return <View style={[styles.homeBanner, style]} />;
  if (adList.length === 0) return null;

  return (
    <AdSlider
      ads={adList}
      containerStyle={[styles.homeBanner, style]}
      thumbnailKey="home_banner"
      intervalMs={intervalMs}
    />
  );
}

/**
 * 홈 섹션 사이 광고 (홈 화면 전용) - 5초마다 슬라이딩
 */
export function HomeSectionAd({ style, intervalMs = 5000 }) {
  const [adList, setAdList] = useState([]);

  useEffect(() => {
    const loadAd = async () => {
      const ads = await fetchAdConfig('home');
      const homeInlineAds = (ads?.home_inline || []).filter(a => a?.imageUrl || a?.videoUrl);
      homeInlineAds.sort((a, b) => (b.priority || 10) - (a.priority || 10));
      setAdList(homeInlineAds);
    };
    loadAd();
  }, []);

  if (adList.length === 0) return null;

  return (
    <AdSlider
      ads={adList}
      containerStyle={[styles.sectionAd, style]}
      thumbnailKey="section"
      intervalMs={intervalMs}
    />
  );
}

/**
 * 리스트 상단 배너 (모든 리스트 화면 공통)
 * @param {string} screen - 화면 타입 (news, job, realestate, danggn)
 * @param {boolean} useAdMob - 자체 광고 없을 때 AdMob 사용 여부
 */
export default function AdBanner({ screen = 'all', style, useAdMob = true, intervalMs = 5000 }) {
  const [adList, setAdList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const canUseAdMob = Platform.OS === 'android' && BannerAd && useAdMob && !isLoading && adList.length === 0;

  useEffect(() => {
    const loadAd = async () => {
      setIsLoading(true);
      const ads = await fetchAdConfig(screen);
      const headerAds = (ads?.header || []).filter(a => a?.imageUrl || a?.videoUrl);
      headerAds.sort((a, b) => (b.priority || 10) - (a.priority || 10));
      setAdList(headerAds);
      setIsLoading(false);
    };
    loadAd();
  }, [screen]);

  if (isLoading) return <View style={[styles.headerBanner, style]} />;

  // 자체 광고가 있으면 슬라이더로 표시
  if (adList.length > 0) {
    return (
      <AdSlider
        ads={adList}
        containerStyle={[styles.headerBanner, style]}
        thumbnailKey="header"
        intervalMs={intervalMs}
      />
    );
  }

  // 자체 광고 없고 AdMob 사용 가능하면 AdMob 표시
  if (canUseAdMob) {
    return (
      <View style={[styles.headerBanner, style]}>
        <BannerAd
          unitId={__DEV__ ? TestIds.BANNER : ADMOB_AD_UNITS.BANNER}
          size={BannerAdSizeEnum.BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdLoaded={() => console.log('✅ AdMob 헤더 배너 로드')}
          onAdFailedToLoad={(error) => console.log('❌ AdMob 헤더 실패:', error.message)}
        />
      </View>
    );
  }

  return null;
}

/**
 * 인라인 광고 (리스트 중간 삽입)
 * @param {string} screen        - 화면 타입 (news, job, realestate, danggn)
 * @param {number} positionIndex - 이 컴포넌트의 자리 번호 (1, 2, 3...)
 *                                 0 또는 미지정 시 → 모든 광고 슬라이딩
 *                                 N 지정 시 → inlinePosition=0(공용) + inlinePosition=N(전용) 광고만
 * @param {boolean} useAdMob    - 자체 광고 없을 때 AdMob 사용 여부
 * @param {number} intervalMs   - 슬라이딩 간격 (ms)
 */
export function InlineAdBanner({ screen = 'all', positionIndex = 0, style, useAdMob = true, intervalMs = 5000 }) {
  const [adList, setAdList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const canUseAdMob = Platform.OS === 'android' && BannerAd && useAdMob && !isLoading && adList.length === 0;

  useEffect(() => {
    const loadAd = async () => {
      setIsLoading(true);
      const ads = await fetchAdConfig(screen);
      const allInlineAds = (ads?.inline || []).filter(a => a?.imageUrl || a?.videoUrl);

      let filtered;
      if (positionIndex === 0) {
        // positionIndex 미지정 → 전체 광고 슬라이딩 (기존 동작)
        filtered = allInlineAds;
      } else {
        // positionIndex 지정 →
        //   ① inlinePosition === 0 (공용, 모든 자리): 항상 포함
        //   ② inlinePosition === positionIndex (이 자리 전용): 포함
        //   ③ 그 외 다른 자리 전용 광고: 제외
        filtered = allInlineAds.filter(a => {
          const pos = a.inlinePosition ?? 0;
          return pos === 0 || pos === positionIndex;
        });
      }

      // 우선순위 높은 순 정렬
      filtered.sort((a, b) => (b.priority || 10) - (a.priority || 10));
      setAdList(filtered);
      setIsLoading(false);
    };
    loadAd();
  }, [screen, positionIndex]);

  if (isLoading) return <View style={[styles.inlineAd, style]} />;

  // 자체 광고가 있으면 슬라이더로 표시
  if (adList.length > 0) {
    return (
      <AdSlider
        ads={adList}
        containerStyle={[styles.inlineAd, style]}
        thumbnailKey="inline"
        intervalMs={intervalMs}
      />
    );
  }

  // 자체 광고 없고 AdMob 사용 가능하면 AdMob 표시
  if (canUseAdMob) {
    return (
      <View style={[styles.inlineAd, style, { justifyContent: 'center', alignItems: 'center' }]}>
        <BannerAd
          unitId={__DEV__ ? TestIds.BANNER : ADMOB_AD_UNITS.INLINE}
          size={BannerAdSizeEnum.MEDIUM_RECTANGLE}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdLoaded={() => console.log('✅ AdMob 인라인 로드')}
          onAdFailedToLoad={(error) => console.log('❌ AdMob 인라인 실패:', error.message)}
        />
      </View>
    );
  }

  return null;
}

/**
 * 상세 페이지 광고 (상단/하단)
 * @param {string} position - 'top' 또는 'bottom'
 * @param {string} screen - 화면 타입 (news, job, realestate, danggn)
 */
export function DetailAdBanner({ position = 'top', screen = 'all', style, intervalMs = 5000 }) {
  const [adList, setAdList] = useState([]);
  const slot = position === 'top' ? 'detail_top' : 'detail_bottom';

  useEffect(() => {
    const loadAd = async () => {
      const ads = await fetchAdConfig(screen);
      const detailAds = (ads?.[slot] || []).filter(a => a?.imageUrl || a?.videoUrl);
      detailAds.sort((a, b) => (b.priority || 10) - (a.priority || 10));
      setAdList(detailAds);
    };
    loadAd();
  }, [position, screen, slot]);

  if (adList.length === 0) return null;

  return (
    <AdSlider
      ads={adList}
      containerStyle={[styles.headerBanner, style]}
      thumbnailKey="banner"
      intervalMs={intervalMs}
    />
  );
}

// ============================================
// 📌 전면 팝업 광고
// ============================================

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * 전면 팝업 광고 컴포넌트
 * @param {boolean} visible - 팝업 표시 여부
 * @param {function} onClose - 닫기 콜백
 * @param {string} screen - 화면 타입 (all, home, news, job, realestate, danggn)
 * @param {number} autoCloseSeconds - 자동 닫힘 시간 (초), 0이면 자동 닫힘 비활성화
 */
export function PopupAd({ visible, onClose, screen = 'all', autoCloseSeconds = 10 }) {
  const [ad, setAd] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState(autoCloseSeconds);

  // 광고 로드
  useEffect(() => {
    if (visible) {
      const loadAd = async () => {
        setIsLoading(true);
        setCountdown(autoCloseSeconds);
        const ads = await fetchAdConfig(screen);
        const popupAds = ads?.popup || [];

        if (popupAds.length > 0) {
          setAd(getRandomAdByPriority(popupAds));
        } else {
          setAd(null);
          // 팝업 광고가 없으면 자동으로 닫기
          if (onClose) onClose();
        }
        setIsLoading(false);
      };
      loadAd();
    }
  }, [visible, screen]);

  // 자동 닫힘 타이머
  useEffect(() => {
    if (!visible || isLoading || !ad || autoCloseSeconds <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onClose) onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, isLoading, ad, autoCloseSeconds, onClose]);

  // 광고 클릭 핸들러
  const handlePopupPress = async () => {
    if (ad) {
      await handleAdPress(ad);
    }
    if (onClose) onClose();
  };

  // 광고가 없거나 로딩 중이면 표시하지 않음
  if (!visible || isLoading || (!ad?.imageUrl && !ad?.videoUrl)) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.popupOverlay}>
        <View style={styles.popupContainer}>
          {/* 닫기 버튼 - 카운트다운 표시 */}
          <TouchableOpacity
            style={styles.popupCloseButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.popupCloseCircle}>
              <Text style={styles.popupCloseText}>
                {countdown > 0 ? countdown : '✕'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 광고 미디어 (비디오/이미지) */}
          <TouchableOpacity
            onPress={handlePopupPress}
            activeOpacity={0.9}
            style={styles.popupImageWrapper}
          >
            <AdMedia ad={ad} style={styles.popupImage} thumbnailKey="popup" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================
// 📌 고정 하단 배너 (전역 화면 항상 표시)
// ============================================

// 화면 콘텐츠가 배너 뒤에 가려지지 않도록 패딩에 사용할 높이 값
export const FIXED_BOTTOM_HEIGHT = 62; // 하단 고정 배너 높이 (750:250 비율, 평균 62px)

/**
 * 고정 하단 배너 (750x250 비율) - 앱 전쭔 화면 항상 표시
 * ⚠️ App.js의 <SafeAreaProvider> 바로 안에 위치시켜야 합니다.
 * @param {string} screen - 화면 타입 (all, home, news...)
 */
export function FixedBottomBanner({ screen = 'all', intervalMs = 5000 }) {
  const [adList, setAdList] = useState([]);
  const insets = require('react-native-safe-area-context').useSafeAreaInsets();

  // 탭바 높이: 56px(탭바 기본) + safe area bottom (0이면 8px 패딩)
  const tabBarHeight = 56 + (insets.bottom > 0 ? insets.bottom : 8);
  // 750:200 비율로 정확한 높이 계산
  const bannerHeight = Math.round(Dimensions.get('window').width * 200 / 750);

  useEffect(() => {
    const loadAd = async () => {
      const ads = await fetchAdConfig(screen);
      const bottomAds = (ads?.fixed_bottom || []).filter(a => a?.imageUrl || a?.videoUrl);
      bottomAds.sort((a, b) => (b.priority || 10) - (a.priority || 10));
      setAdList(bottomAds);
    };
    loadAd();
  }, [screen]);

  if (adList.length === 0) return null;

  return (
    <AdSlider
      ads={adList}
      containerStyle={[
        styles.fixedBottom,
        {
          height: bannerHeight,
          bottom: tabBarHeight,     // 탭바 바로 위에 위치
        },
      ]}
      thumbnailKey="inline"
      intervalMs={intervalMs}
      showIndicator={false}  // 하단 배너에는 점 표시 안 함
    />
  );
}

// ============================================
// 하위 호환성 (기존 코드 지원)
// ============================================

/**
 * @deprecated SectionAdBanner는 HomeSectionAd로 대체됨
 */
export function SectionAdBanner({ style }) {
  return <HomeSectionAd style={style} />;
}

// BannerAdSize export (하위 호환성)
export const BannerAdSize = {
  BANNER: "BANNER",
  LARGE_BANNER: "LARGE_BANNER",
  MEDIUM_RECTANGLE: "MEDIUM_RECTANGLE",
};

// ============================================
// 스타일 (비율 기반 + 최대 높이 제한)
// ============================================
const styles = StyleSheet.create({
  // ── 고정 배너 (절대 위치, 화면 전체에 항상 표시) ──
  fixedTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    width: '100%',
    aspectRatio: 750 / 300,
    maxHeight: 56,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 8,
  },
  fixedBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    width: '100%',
    // height와 bottom은 FixedBottomBanner에서 동적으로 계산하여 containerStyle로 주입
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 8,
  },
  // 슬라이더 인디케이터
  indicatorRow: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  indicatorDotActive: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // 비디오 광고 인디케이터: 주황색으로 강조
  indicatorDotVideo: {
    backgroundColor: '#FF9500',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  indicatorVideoLabel: {
    color: '#FF9500',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  // 홈 대형 배너: 750x300 비율 (2.5:1)
  homeBanner: {
    width: "100%",
    aspectRatio: 750 / 300,
    maxHeight: 200,
    backgroundColor: "#f5f5f5",
    marginVertical: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  // 리스트 헤더/상세 배너: 750x300 비율 (2.5:1)
  headerBanner: {
    width: "100%",
    aspectRatio: 750 / 300,
    maxHeight: 180,
    backgroundColor: "#f5f5f5",
    marginVertical: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  // 인라인 광고: 750x200 비율 (3.75:1)
  inlineAd: {
    width: "100%",
    aspectRatio: 750 / 200,
    maxHeight: 150,
    backgroundColor: "#fff",
    marginVertical: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  // 홈 섹션 사이: 750x150 비율 (5:1)
  sectionAd: {
    width: "100%",
    aspectRatio: 750 / 150,
    maxHeight: 100,
    backgroundColor: "#fff",
    marginVertical: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  adImage: {
    width: "100%",
    height: "100%",
  },
  // 비디오 음소거 버튼
  muteButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  muteIcon: {
    fontSize: 16,
  },
  // 전면 팝업 광고 스타일
  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  popupContainer: {
    width: screenWidth * 0.85,
    maxWidth: 400,
    maxHeight: screenHeight * 0.75,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  popupCloseButton: {
    position: "absolute",
    top: -15,
    right: -15,
    zIndex: 10,
  },
  popupCloseCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  popupCloseText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  popupImageWrapper: {
    width: "100%",
    aspectRatio: 600 / 800,
  },
  popupImage: {
    width: "100%",
    height: "100%",
  },
});
