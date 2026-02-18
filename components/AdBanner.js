import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
  Modal,
  Text,
  Dimensions,
} from "react-native";
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

if (Platform.OS === "android") {
  try {
    const GoogleMobileAds = require("react-native-google-mobile-ads");
    BannerAd = GoogleMobileAds.BannerAd;
    BannerAdSizeEnum = GoogleMobileAds.BannerAdSize;
    TestIds = GoogleMobileAds.TestIds;
  } catch (e) {
    console.log("AdMob 로드 실패, 자체 광고만 사용:", e.message);
  }
}

// ============================================
// 설정
// ============================================
const API_BASE_URL = "https://chaovietnam.co.kr/wp-json/chaovn/v2";
const CACHE_DURATION = 10 * 60 * 1000; // 10분 캐시

// AdMob 광고 단위 ID (자체 광고 없을 때만 사용)
const ADMOB_AD_UNITS = {
  BANNER: "ca-app-pub-7944314901202352/4259843310", // 헤더 배너 (새로 생성)
  INLINE: "ca-app-pub-7944314901202352/8698508125", // 인라인 배너 (새로 생성)
};

// 광고 슬롯 정의 (WordPress와 동일)
const AD_SLOTS = {
  HOME_BANNER: "home_banner", // 홈 대형 배너
  HOME_INLINE: "home_inline", // 홈 섹션 사이
  HEADER: "header", // 리스트 상단 배너
  INLINE: "inline", // 리스트 인라인 광고
  DETAIL_TOP: "detail_top", // 상세 페이지 상단
  DETAIL_BOTTOM: "detail_bottom", // 상세 페이지 하단
  POPUP: "popup", // 전면 팝업 광고
};

// 화면(섹션) 정의
const AD_SCREENS = {
  ALL: "all",
  HOME: "home",
  NEWS: "news",
  JOB: "job",
  REALESTATE: "realestate",
  DANGGN: "danggn",
};

// ============================================
// 캐시
// ============================================
let cachedAds = null;
let lastFetchTime = 0;
let currentScreen = "all";

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
 * @param {function} onVideoPress - 비디오 클릭 시 콜백 (전체 화면 재생용)
 */
const AdMedia = ({ ad, style, thumbnailKey = null, onVideoPress = null }) => {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);

  // 비디오가 있으면 비디오 재생
  if (ad?.videoUrl) {
    return (
      <TouchableOpacity
        style={[style, { position: "relative" }]}
        onPress={() => onVideoPress?.(ad)}
        activeOpacity={0.9}
      >
        <Video
          ref={videoRef}
          source={{ uri: ad.videoUrl }}
          style={{ width: "100%", height: "100%" }}
          resizeMode={ResizeMode.COVER}
          shouldPlay={true}
          isLooping={true}
          isMuted={isMuted}
          useNativeControls={false}
        />
        {/* 음소거 토글 버튼 */}
        <TouchableOpacity
          style={styles.muteButton}
          onPress={(e) => {
            e.stopPropagation();
            setIsMuted(!isMuted);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.muteIcon}>{isMuted ? "🔇" : "🔊"}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  // 이미지 표시
  const imageUrl =
    thumbnailKey && ad?.thumbnails?.[thumbnailKey]
      ? ad.thumbnails[thumbnailKey]
      : ad?.imageUrl;

  if (imageUrl) {
    return (
      <Image source={{ uri: imageUrl }} style={style} resizeMode="cover" />
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
const fetchAdConfig = async (screen = "all") => {
  const now = Date.now();

  // 캐시가 유효하고 같은 screen이면 캐시 반환
  if (
    cachedAds &&
    now - lastFetchTime < CACHE_DURATION &&
    currentScreen === screen
  ) {
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
        .join(", ");
      console.log(`✅ 광고 로드 완료: ${counts}`);

      return cachedAds;
    }
  } catch (error) {
    console.log("❌ 광고 API 실패:", error.message);
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
    console.log("클릭 추적 실패:", error.message);
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
      console.log("광고 링크 열기 실패:", error.message);
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
    random -= ad.priority || 10;
    if (random <= 0) return ad;
  }

  return ads[0];
};

/**
 * 우선순위 기반 정렬 (높은 순서대로)
 * 인라인 광고처럼 순차적으로 배치할 때 사용
 * @param {array} ads - 광고 배열
 * @returns {array} - 우선순위 높은 순서로 정렬된 배열
 */
const getSortedAdsByPriority = (ads) => {
  if (!ads || ads.length === 0) return [];

  // 우선순위로 정렬 (높은 순)
  return [...ads].sort((a, b) => (b.priority || 10) - (a.priority || 10));
};

// ============================================
// 📌 전체 화면 비디오 플레이어 모달
// ============================================

/**
 * 비디오 광고 전체 화면 플레이어
 */
function VideoPlayerModal({ visible, video, onClose }) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false); // 전체 화면은 음소거 기본값 false
  const [isPlaying, setIsPlaying] = useState(true);

  if (!visible || !video?.videoUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* 검은 배경 */}
      <View style={styles.fullscreenVideoContainer}>
        {/* 비디오 플레이어 */}
        <Video
          ref={videoRef}
          source={{ uri: video.videoUrl }}
          style={styles.fullscreenVideo}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={isPlaying}
          isLooping={true}
          isMuted={isMuted}
          useNativeControls={true}
          progressUpdateIntervalMillis={500}
          onPlaybackStatusUpdate={(status) => {
            if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
              // 비디오 종료 시 처리 (필요시)
            }
          }}
        />

        {/* 클로즈 버튼 */}
        <TouchableOpacity
          style={styles.fullscreenCloseButton}
          onPress={onClose}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Text style={styles.fullscreenCloseIcon}>✕</Text>
        </TouchableOpacity>

        {/* 음소거 토글 */}
        <TouchableOpacity
          style={styles.fullscreenMuteButton}
          onPress={() => setIsMuted(!isMuted)}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Text style={styles.fullscreenMuteIcon}>{isMuted ? "🔇" : "🔊"}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ============================================
// 📌 광고 컴포넌트들
// ============================================

/**
 * 홈 대형 배너 (홈 화면 전용)
 */
export function HomeBanner({ style }) {
  const [ad, setAd] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  useEffect(() => {
    const loadAd = async () => {
      setIsLoading(true);
      const ads = await fetchAdConfig("home");
      const homeBannerAds = ads?.home_banner || [];
      setAd(getRandomAdByPriority(homeBannerAds));
      setIsLoading(false);
    };
    loadAd();
  }, []);

  if (isLoading) return <View style={[styles.homeBanner, style]} />;
  if (!ad?.imageUrl && !ad?.videoUrl) return null;

  const handleVideoPress = (video) => {
    setShowVideoPlayer(true);
  };

  const handleAdPress = async (adData) => {
    // 비디오 광고는 전체 화면 플레이어로, 이미지는 링크로
    if (!adData?.videoUrl && adData?.linkUrl) {
      trackAdClick(adData);
      try {
        await Linking.openURL(adData.linkUrl);
      } catch (error) {
        console.log("광고 링크 열기 실패:", error.message);
      }
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.homeBanner, style]}
        onPress={() => handleAdPress(ad)}
        activeOpacity={0.8}
      >
        <AdMedia
          ad={ad}
          style={styles.adImage}
          thumbnailKey="home_banner"
          onVideoPress={handleVideoPress}
        />
      </TouchableOpacity>

      <VideoPlayerModal
        visible={showVideoPlayer}
        video={ad}
        onClose={() => setShowVideoPlayer(false)}
      />
    </>
  );
}

/**
 * 홈 섹션 사이 광고 (홈 화면 전용)
 */
export function HomeSectionAd({ style }) {
  const [ad, setAd] = useState(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  useEffect(() => {
    const loadAd = async () => {
      const ads = await fetchAdConfig("home");
      const homeInlineAds = ads?.home_inline || [];
      setAd(getRandomAdByPriority(homeInlineAds));
    };
    loadAd();
  }, []);

  if (!ad?.imageUrl && !ad?.videoUrl) return null;

  const handleVideoPress = (video) => {
    setShowVideoPlayer(true);
  };

  const handleAdPress = async (adData) => {
    // 비디오 광고는 전체 화면 플레이어로, 이미지는 링크로
    if (!adData?.videoUrl && adData?.linkUrl) {
      trackAdClick(adData);
      try {
        await Linking.openURL(adData.linkUrl);
      } catch (error) {
        console.log("광고 링크 열기 실패:", error.message);
      }
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.sectionAd, style]}
        onPress={() => handleAdPress(ad)}
        activeOpacity={0.8}
      >
        <AdMedia
          ad={ad}
          style={styles.adImage}
          thumbnailKey="section"
          onVideoPress={handleVideoPress}
        />
      </TouchableOpacity>

      <VideoPlayerModal
        visible={showVideoPlayer}
        video={ad}
        onClose={() => setShowVideoPlayer(false)}
      />
    </>
  );
}

/**
 * 리스트 상단 배너 (모든 리스트 화면 공통)
 * @param {string} screen - 화면 타입 (news, job, realestate, danggn)
 * @param {boolean} useAdMob - 자체 광고 없을 때 AdMob 사용 여부
 */
export default function AdBanner({ screen = "all", style, useAdMob = true }) {
  const [ad, setAd] = useState(null);
  const [hasSelfAd, setHasSelfAd] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  const canUseAdMob =
    Platform.OS === "android" &&
    BannerAd &&
    useAdMob &&
    !hasSelfAd &&
    !isLoading;

  useEffect(() => {
    const loadAd = async () => {
      setIsLoading(true);
      const ads = await fetchAdConfig(screen);
      const headerAds = ads?.header || [];

      // 이미지나 비디오가 있는 광고만 필터링
      const validAds = headerAds.filter((a) => a?.imageUrl || a?.videoUrl);

      if (validAds.length > 0) {
        setAd(getRandomAdByPriority(validAds));
        setHasSelfAd(true);
      } else {
        setAd(null);
        setHasSelfAd(false);
      }
      setIsLoading(false);
    };
    loadAd();
  }, [screen]);

  if (isLoading) return <View style={[styles.headerBanner, style]} />;

  const handleVideoPress = (video) => {
    setShowVideoPlayer(true);
  };

  const handleAdPress = async (adData) => {
    // 비디오 광고는 전체 화면 플레이어로, 이미지는 링크로
    if (!adData?.videoUrl && adData?.linkUrl) {
      trackAdClick(adData);
      try {
        await Linking.openURL(adData.linkUrl);
      } catch (error) {
        console.log("광고 링크 열기 실패:", error.message);
      }
    }
  };

  // 자체 광고가 있으면 표시 (이미지 또는 비디오)
  if (hasSelfAd && (ad?.imageUrl || ad?.videoUrl)) {
    return (
      <>
        <TouchableOpacity
          style={[styles.headerBanner, style]}
          onPress={() => handleAdPress(ad)}
          activeOpacity={0.8}
        >
          <AdMedia
            ad={ad}
            style={styles.adImage}
            thumbnailKey="header"
            onVideoPress={handleVideoPress}
          />
        </TouchableOpacity>

        <VideoPlayerModal
          visible={showVideoPlayer}
          video={ad}
          onClose={() => setShowVideoPlayer(false)}
        />
      </>
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
          onAdLoaded={() => console.log("✅ AdMob 헤더 배너 로드")}
          onAdFailedToLoad={(error) =>
            console.log("❌ AdMob 헤더 실패:", error.message)
          }
        />
      </View>
    );
  }

  return null;
}

/**
 * 인라인 광고 (리스트 중간 삽입)
 * @param {string} screen - 화면 타입 (news, job, realestate, danggn)
 * @param {boolean} useAdMob - 자체 광고 없을 때 AdMob 사용 여부
 */
export function InlineAdBanner({ screen = "all", style, useAdMob = true }) {
  const [ad, setAd] = useState(null);
  const [hasSelfAd, setHasSelfAd] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  const canUseAdMob =
    Platform.OS === "android" &&
    BannerAd &&
    useAdMob &&
    !hasSelfAd &&
    !isLoading;

  // 컴포넌트 마운트 시 인덱스 할당 (동기적)
  const adIndex = React.useMemo(() => getInlineAdIndex(screen), [screen]);

  useEffect(() => {
    const loadAd = async () => {
      setIsLoading(true);

      const ads = await fetchAdConfig(screen);
      const inlineAds = ads?.inline || [];

      // 이미지나 비디오가 있는 광고만 필터링
      const validAds = inlineAds.filter((a) => a?.imageUrl || a?.videoUrl);

      // 우선순위 높은 순서대로 정렬
      const sortedAds = getSortedAdsByPriority(validAds);

      // 사용 가능한 광고 수 저장 (첫 번째 컴포넌트에서)
      if (adIndex === 0) {
        setInlineAdsCount(sortedAds.length);
      }

      // 인덱스가 광고 수보다 작을 때만 자체 광고 표시 (순서대로)
      if (sortedAds.length > 0 && adIndex < sortedAds.length) {
        // 우선순위 높은 순서대로 이미 정렬되어 있으므로 그냥 인덱스로 선택
        const selectedAd = sortedAds[adIndex];

        setAd(selectedAd);
        setHasSelfAd(true);
      } else {
        // 광고 부족 → AdMob 폴백
        setAd(null);
        setHasSelfAd(false);
      }
      setIsLoading(false);
    };
    loadAd();
  }, [screen, adIndex]);

  if (isLoading) return <View style={[styles.inlineAd, style]} />;

  const handleVideoPress = (video) => {
    setShowVideoPlayer(true);
  };

  const handleAdPress = async (adData) => {
    // 비디오 광고는 전체 화면 플레이어로, 이미지는 링크로
    if (!adData?.videoUrl && adData?.linkUrl) {
      trackAdClick(adData);
      try {
        await Linking.openURL(adData.linkUrl);
      } catch (error) {
        console.log("광고 링크 열기 실패:", error.message);
      }
    }
  };

  // 자체 광고가 있으면 표시 (이미지 또는 비디오)
  if (hasSelfAd && (ad?.imageUrl || ad?.videoUrl)) {
    return (
      <>
        <TouchableOpacity
          style={[styles.inlineAd, style]}
          onPress={() => handleAdPress(ad)}
          activeOpacity={0.8}
        >
          <AdMedia
            ad={ad}
            style={styles.adImage}
            thumbnailKey="inline"
            onVideoPress={handleVideoPress}
          />
        </TouchableOpacity>

        <VideoPlayerModal
          visible={showVideoPlayer}
          video={ad}
          onClose={() => setShowVideoPlayer(false)}
        />
      </>
    );
  }

  // 자체 광고 없고 AdMob 사용 가능하면 AdMob 표시
  if (canUseAdMob) {
    return (
      <View
        style={[
          styles.inlineAd,
          style,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <BannerAd
          unitId={__DEV__ ? TestIds.BANNER : ADMOB_AD_UNITS.INLINE}
          size={BannerAdSizeEnum.MEDIUM_RECTANGLE}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdLoaded={() => console.log("✅ AdMob 인라인 로드")}
          onAdFailedToLoad={(error) =>
            console.log("❌ AdMob 인라인 실패:", error.message)
          }
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
export function DetailAdBanner({ position = "top", screen = "all", style }) {
  const [ad, setAd] = useState(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const slot = position === "top" ? "detail_top" : "detail_bottom";

  useEffect(() => {
    const loadAd = async () => {
      const ads = await fetchAdConfig(screen);
      const detailAds = ads?.[slot] || [];
      setAd(getRandomAdByPriority(detailAds));
    };
    loadAd();
  }, [position, screen]);

  if (!ad?.imageUrl && !ad?.videoUrl) return null;

  const handleVideoPress = (video) => {
    setShowVideoPlayer(true);
  };

  const handleAdPress = async (adData) => {
    // 비디오 광고는 전체 화면 플레이어로, 이미지는 링크로
    if (!adData?.videoUrl && adData?.linkUrl) {
      trackAdClick(adData);
      try {
        await Linking.openURL(adData.linkUrl);
      } catch (error) {
        console.log("광고 링크 열기 실패:", error.message);
      }
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.headerBanner, style]}
        onPress={() => handleAdPress(ad)}
        activeOpacity={0.8}
      >
        <AdMedia
          ad={ad}
          style={styles.adImage}
          thumbnailKey="banner"
          onVideoPress={handleVideoPress}
        />
      </TouchableOpacity>

      <VideoPlayerModal
        visible={showVideoPlayer}
        video={ad}
        onClose={() => setShowVideoPlayer(false)}
      />
    </>
  );
}

// ============================================
// 📌 전면 팝업 광고
// ============================================

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

/**
 * 전면 팝업 광고 컴포넌트
 * @param {boolean} visible - 팝업 표시 여부
 * @param {function} onClose - 닫기 콜백
 * @param {string} screen - 화면 타입 (all, home, news, job, realestate, danggn)
 * @param {number} autoCloseSeconds - 자동 닫힘 시간 (초), 0이면 자동 닫힘 비활성화
 */
export function PopupAd({
  visible,
  onClose,
  screen = "all",
  autoCloseSeconds = 10,
}) {
  const [ad, setAd] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState(autoCloseSeconds);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

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
      setCountdown((prev) => {
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

  // 비디오 클릭 핸들러
  const handleVideoPress = (video) => {
    setShowVideoPlayer(true);
  };

  // 광고 클릭 핸들러
  const handlePopupPress = async () => {
    if (!ad?.videoUrl && ad?.linkUrl) {
      trackAdClick(ad);
      try {
        await Linking.openURL(ad.linkUrl);
      } catch (error) {
        console.log("광고 링크 열기 실패:", error.message);
      }
    }
    if (onClose) onClose();
  };

  // 광고가 없거나 로딩 중이면 표시하지 않음
  if (!visible || isLoading || (!ad?.imageUrl && !ad?.videoUrl)) {
    return null;
  }

  return (
    <>
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
                  {countdown > 0 ? countdown : "✕"}
                </Text>
              </View>
            </TouchableOpacity>

            {/* 광고 미디어 (비디오/이미지) */}
            <TouchableOpacity
              onPress={handlePopupPress}
              activeOpacity={0.9}
              style={styles.popupImageWrapper}
            >
              <AdMedia
                ad={ad}
                style={styles.popupImage}
                thumbnailKey="popup"
                onVideoPress={handleVideoPress}
              />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <VideoPlayerModal
        visible={showVideoPlayer}
        video={ad}
        onClose={() => setShowVideoPlayer(false)}
      />
    </>
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
  // 비디오 음소거 버튼 (미니 사이즈)
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
  // 전체 화면 비디오 플레이어
  fullscreenVideoContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenVideo: {
    width: "100%",
    height: "100%",
  },
  // 전체 화면 클로즈 버튼 (좌상단)
  fullscreenCloseButton: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 100,
  },
  fullscreenCloseIcon: {
    fontSize: 32,
    color: "#fff",
    fontWeight: "bold",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 20,
    width: 44,
    height: 44,
    lineHeight: 44,
    textAlign: "center",
  },
  // 전체 화면 음소거 버튼 (우하단)
  fullscreenMuteButton: {
    position: "absolute",
    bottom: 40,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenMuteIcon: {
    fontSize: 24,
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
