import React, { useState, useEffect } from "react";
import { View, StyleSheet, Image, TouchableOpacity, Linking } from "react-native";
import { getRemoteConfig, fetchAndActivate, getValue } from "firebase/remote-config";
import { remoteConfig } from "../firebase/config";

// ============================================
// 🏠 자체 광고 시스템 (Firebase Remote Config 연동)
// Firebase Console에서 광고 URL을 실시간 변경 가능
// ============================================

/**
 * 기본 광고 데이터 (Remote Config 로드 실패 시 사용)
 */
const DEFAULT_ADS = {
  banner: {
    imageUrl: "https://chaovietnam.co.kr/ads/banner_ad.png",
    linkUrl: "https://chaovietnam.co.kr",
  },
  inline: {
    imageUrl: "https://chaovietnam.co.kr/ads/inline_ad.png",
    linkUrl: "https://chaovietnam.co.kr",
  },
  section: {
    imageUrl: "https://chaovietnam.co.kr/ads/section_ad.png",
    linkUrl: "https://chaovietnam.co.kr",
  },
};

// 캐시된 광고 데이터
let cachedAds = null;

/**
 * Firebase Remote Config에서 광고 데이터 가져오기
 */
const fetchAdConfig = async () => {
  if (cachedAds) return cachedAds;
  
  try {
    if (remoteConfig) {
      await fetchAndActivate(remoteConfig);
      
      const adsConfigString = getValue(remoteConfig, "in_house_ads").asString();
      if (adsConfigString) {
        cachedAds = JSON.parse(adsConfigString);
        console.log("📢 Remote Config 광고 로드 성공");
        return cachedAds;
      }
    }
  } catch (error) {
    console.log("Remote Config 광고 로드 실패, 기본값 사용:", error.message);
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
 * 광고 배너 컴포넌트 (자체 광고 - Remote Config 연동)
 */
export default function AdBanner({ position = "default", size, style }) {
  const [ad, setAd] = useState(DEFAULT_ADS.banner);
  
  useEffect(() => {
    fetchAdConfig().then(ads => setAd(ads.banner || DEFAULT_ADS.banner));
  }, []);
  
  return (
    <TouchableOpacity 
      style={[styles.adPlaceholder, style]} 
      onPress={() => handleAdPress(ad.linkUrl)}
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
 * 인라인 광고 (리스트 중간에 삽입용 - Remote Config 연동)
 */
export function InlineAdBanner({ position = "inline", style }) {
  const [ad, setAd] = useState(DEFAULT_ADS.inline);
  
  useEffect(() => {
    fetchAdConfig().then(ads => setAd(ads.inline || DEFAULT_ADS.inline));
  }, []);
  
  return (
    <TouchableOpacity 
      style={[styles.inlineAdPlaceholder, style]} 
      onPress={() => handleAdPress(ad.linkUrl)}
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
 * 섹션 구분 광고 (홈 화면 섹션 사이에 배치 - Remote Config 연동)
 */
export function SectionAdBanner({ position = "section", style }) {
  const [ad, setAd] = useState(DEFAULT_ADS.section);
  
  useEffect(() => {
    fetchAdConfig().then(ads => setAd(ads.section || DEFAULT_ADS.section));
  }, []);
  
  return (
    <TouchableOpacity 
      style={[styles.sectionAdPlaceholder, style]} 
      onPress={() => handleAdPress(ad.linkUrl)}
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
