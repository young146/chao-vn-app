import React, { useState, useEffect } from "react";
import { View, StyleSheet, Image, TouchableOpacity, Linking } from "react-native";
import axios from "axios";

// ============================================
// 🏠 자체 광고 시스템 (WordPress API 연동)
// WordPress 사이트에서 광고를 직접 가져옴
// AD 카테고리 (ID: 399)에서 광고 포스트 로드
// ============================================

const AD_API_URL = "https://chaovietnam.co.kr/wp-json/wp/v2/posts";
const AD_CATEGORY_ID = 399; // AD 카테고리

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
 * HTML content에서 이미지 URL 추출
 */
const extractImageUrl = (content) => {
  // img 태그에서 src 추출
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];
  
  // 이미지 URL 직접 찾기
  const urlMatch = content.match(/(https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|gif|webp))/i);
  if (urlMatch) return urlMatch[1];
  
  return null;
};

/**
 * HTML content에서 링크 URL 추출
 */
const extractLinkUrl = (content) => {
  // a 태그에서 href 추출
  const linkMatch = content.match(/<a[^>]+href=["']([^"']+)["']/i);
  if (linkMatch) return linkMatch[1];
  
  return "https://chaovietnam.co.kr"; // 기본값
};

/**
 * WordPress API에서 광고 데이터 가져오기
 */
const fetchAdConfig = async () => {
  const now = Date.now();
  
  // 캐시가 유효하면 캐시 반환
  if (cachedAds && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedAds;
  }
  
  try {
    console.log("📢 WordPress에서 광고 로드 중...");
    
    const response = await axios.get(AD_API_URL, {
      params: {
        categories: AD_CATEGORY_ID,
        per_page: 50, // 최대 50개 광고
        _fields: "id,title,content,featured_media,link",
      },
      timeout: 8000,
    });
    
    const posts = response.data;
    
    if (posts && posts.length > 0) {
      // 모든 광고를 하나의 배열로 (위치 구분 없이 랜덤 사용)
      const allAds = posts.map(post => {
        const content = post.content?.rendered || "";
        return {
          id: post.id,
          title: post.title?.rendered || "",
          imageUrl: extractImageUrl(content),
          linkUrl: extractLinkUrl(content),
        };
      }).filter(ad => ad.imageUrl); // 이미지가 있는 것만
      
      cachedAds = {
        banner: allAds,
        inline: allAds,
        section: allAds,
      };
      
      lastFetchTime = now;
      console.log(`✅ WordPress 광고 ${allAds.length}개 로드 성공`);
      return cachedAds;
    }
  } catch (error) {
    console.log("WordPress 광고 로드 실패, 기본값 사용:", error.message);
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
 * ✅ 여러 광고 중 랜덤 표시
 */
export default function AdBanner({ position = "default", size, style }) {
  const [ad, setAd] = useState(getRandomAd(DEFAULT_ADS.banner));
  
  useEffect(() => {
    fetchAdConfig().then(ads => {
      const bannerAds = ads.banner || DEFAULT_ADS.banner;
      setAd(getRandomAd(bannerAds));
    });
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
 * ✅ 여러 광고 중 랜덤 표시
 */
export function InlineAdBanner({ position = "inline", style }) {
  const [ad, setAd] = useState(getRandomAd(DEFAULT_ADS.inline));
  
  useEffect(() => {
    fetchAdConfig().then(ads => {
      const inlineAds = ads.inline || DEFAULT_ADS.inline;
      setAd(getRandomAd(inlineAds));
    });
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
 * ✅ 여러 광고 중 랜덤 표시
 */
export function SectionAdBanner({ position = "section", style }) {
  const [ad, setAd] = useState(getRandomAd(DEFAULT_ADS.section));
  
  useEffect(() => {
    fetchAdConfig().then(ads => {
      const sectionAds = ads.section || DEFAULT_ADS.section;
      setAd(getRandomAd(sectionAds));
    });
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
