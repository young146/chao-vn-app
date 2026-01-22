import React, { useState, useEffect } from "react";
import { View, StyleSheet, Image, TouchableOpacity, Linking } from "react-native";
import axios from "axios";

// ============================================
// 🏠 자체 광고 시스템 (ChaoVN Ad API 연동)
// Ad Inserter 플러그인 데이터를 REST API로 가져옴
// 플러그인: wp-plugins/chaovn-ad-api
// ============================================

const AD_API_URL = "https://chaovietnam.co.kr/wp-json/chaovn/v1/ads";

/**
 * 기본 광고 데이터 (WordPress API 로드 실패 시 사용)
 */
const DEFAULT_ADS = {
  banner: [
    { imageUrl: "https://chaovietnam.co.kr/ads/banner_ad.png", linkUrl: "https://chaovietnam.co.kr" },
  ],
  inline: [
    { imageUrl: "https://chaovietnam.co.kr/ads/inline_ad.png", linkUrl: "https://chaovietnam.co.kr" },
  ],
  section: [
    { imageUrl: "https://chaovietnam.co.kr/ads/section_ad.png", linkUrl: "https://chaovietnam.co.kr" },
  ],
};

/**
 * 배열에서 랜덤으로 하나 선택
 */
const getRandomAd = (adsArray) => {
  if (!adsArray || adsArray.length === 0) return null;
  if (!Array.isArray(adsArray)) return adsArray;
  const randomIndex = Math.floor(Math.random() * adsArray.length);
  return adsArray[randomIndex];
};

// 캐시된 광고 데이터
let cachedAds = null;
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10분 캐시

/**
 * ChaoVN Ad API에서 광고 데이터 가져오기
 * Ad Inserter 플러그인 데이터를 REST API로 가져옴
 */
const fetchAdConfig = async () => {
  const now = Date.now();
  
  // 캐시가 유효하면 캐시 반환
  if (cachedAds && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedAds;
  }
  
  try {
    console.log("📢 ChaoVN Ad API에서 광고 로드 중...");
    
    const response = await axios.get(AD_API_URL, {
      timeout: 8000,
    });
    
    if (response.data?.success && response.data?.data) {
      const apiAds = response.data.data;
      
      cachedAds = {
        banner: apiAds.banner?.length > 0 ? apiAds.banner : DEFAULT_ADS.banner,
        inline: apiAds.inline?.length > 0 ? apiAds.inline : DEFAULT_ADS.inline,
        section: apiAds.section?.length > 0 ? apiAds.section : DEFAULT_ADS.section,
      };
      
      lastFetchTime = now;
      console.log(`✅ 광고 로드: Banner ${cachedAds.banner.length}, Inline ${cachedAds.inline.length}, Section ${cachedAds.section.length}`);
      return cachedAds;
    }
  } catch (error) {
    console.log("ChaoVN Ad API 로드 실패, 기본값 사용:", error.message);
  }
  
  return DEFAULT_ADS;
};

/**
 * 광고 클릭 핸들러
 */
const handleAdPress = async (url) => {
  if (url) {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.log("광고 링크 열기 실패:", error);
    }
  }
};

/**
 * 광고 배너 컴포넌트 (자체 광고 - Ad Inserter 연동)
 * ✅ 여러 광고 중 랜덤 표시
 */
export default function AdBanner({ position = "default", size, style }) {
  const [ad, setAd] = useState(getRandomAd(DEFAULT_ADS.banner));
  
  useEffect(() => {
    fetchAdConfig().then(ads => {
      const bannerAds = ads?.banner?.length > 0 ? ads.banner : DEFAULT_ADS.banner;
      const selectedAd = getRandomAd(bannerAds);
      if (selectedAd) setAd(selectedAd);
    }).catch(() => {
      // 에러 시 기본값 유지
    });
  }, []);
  
  // 광고 데이터가 없으면 렌더링하지 않음
  if (!ad?.imageUrl) {
    return null;
  }
  
  return (
    <TouchableOpacity 
      style={[styles.adPlaceholder, style]} 
      onPress={() => handleAdPress(ad?.linkUrl)}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: ad.imageUrl }} 
        style={styles.adImage}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );
}

/**
 * 인라인 광고 (리스트 중간에 삽입용 - Ad Inserter 연동)
 * ✅ 여러 광고 중 랜덤 표시
 */
export function InlineAdBanner({ position = "inline", style }) {
  const [ad, setAd] = useState(getRandomAd(DEFAULT_ADS.inline));
  
  useEffect(() => {
    fetchAdConfig().then(ads => {
      const inlineAds = ads?.inline?.length > 0 ? ads.inline : DEFAULT_ADS.inline;
      const selectedAd = getRandomAd(inlineAds);
      if (selectedAd) setAd(selectedAd);
    }).catch(() => {
      // 에러 시 기본값 유지
    });
  }, []);
  
  // 광고 데이터가 없으면 렌더링하지 않음
  if (!ad?.imageUrl) {
    return null;
  }
  
  return (
    <TouchableOpacity 
      style={[styles.inlineAdPlaceholder, style]} 
      onPress={() => handleAdPress(ad?.linkUrl)}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: ad.imageUrl }} 
        style={styles.adImage}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );
}

/**
 * 섹션 구분 광고 (홈 화면 섹션 사이에 배치 - Ad Inserter 연동)
 * ✅ 여러 광고 중 랜덤 표시
 */
export function SectionAdBanner({ position = "section", style }) {
  const [ad, setAd] = useState(getRandomAd(DEFAULT_ADS.section));
  
  useEffect(() => {
    fetchAdConfig().then(ads => {
      const sectionAds = ads?.section?.length > 0 ? ads.section : DEFAULT_ADS.section;
      const selectedAd = getRandomAd(sectionAds);
      if (selectedAd) setAd(selectedAd);
    }).catch(() => {
      // 에러 시 기본값 유지
    });
  }, []);
  
  // 광고 데이터가 없으면 렌더링하지 않음
  if (!ad?.imageUrl) {
    return null;
  }
  
  return (
    <TouchableOpacity 
      style={[styles.sectionAdPlaceholder, style]} 
      onPress={() => handleAdPress(ad?.linkUrl)}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: ad.imageUrl }} 
        style={styles.adImage}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );
}

// BannerAdSize는 더 이상 사용하지 않으므로 더미 객체로 export
export const BannerAdSize = {
  BANNER: "BANNER",
  LARGE_BANNER: "LARGE_BANNER",
  MEDIUM_RECTANGLE: "MEDIUM_RECTANGLE",
};

const styles = StyleSheet.create({
  adPlaceholder: {
    height: 50,
    backgroundColor: "#f5f5f5",
    marginVertical: 8,
    overflow: "hidden",
    // 그림자 효과
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // Android용
  },
  inlineAdPlaceholder: {
    height: 250,
    backgroundColor: "#fff",
    marginVertical: 16,
    borderRadius: 8,
    overflow: "hidden",
    // 그림자 효과
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4, // Android용
  },
  sectionAdPlaceholder: {
    height: 100,
    backgroundColor: "#fff",
    marginVertical: 20,
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: "hidden",
    // 그림자 효과
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // Android용
  },
  adImage: {
    width: "100%",
    height: "100%",
  },
});
