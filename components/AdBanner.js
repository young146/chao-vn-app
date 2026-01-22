import React, { useState, useEffect } from "react";
import { View, StyleSheet, Image, TouchableOpacity, Linking } from "react-native";
import axios from "axios";

// ============================================
// 🏠 자체 광고 시스템 (WordPress API 연동)
// WordPress 사이트에서 광고를 직접 가져옴
// AD 카테고리 (ID: 399)에서 광고 포스트 로드
// ============================================

const AD_API_URL = "https://chaovietnam.co.kr/wp-json/wp/v2/posts";
const AD_CATEGORIES_API = "https://chaovietnam.co.kr/wp-json/wp/v2/categories";

// 광고 카테고리 ID (WordPress에서 생성 후 ID 확인 필요)
// 기본값은 AD 카테고리, 하위 카테고리가 있으면 자동 감지
let AD_CATEGORY_IDS = {
  banner: null,   // AD-Banner 카테고리 ID
  inline: null,   // AD-Inline 카테고리 ID  
  section: null,  // AD-Section 카테고리 ID
  all: 399,       // AD 카테고리 (기본값)
};

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
 * HTML content에서 링크 URL 추출 (외부 링크 우선)
 */
const extractLinkUrl = (content) => {
  // 모든 a 태그의 href 추출
  const linkMatches = content.match(/<a[^>]+href=["']([^"']+)["']/gi);
  
  if (linkMatches && linkMatches.length > 0) {
    // 각 매치에서 href 값 추출
    for (const match of linkMatches) {
      const hrefMatch = match.match(/href=["']([^"']+)["']/i);
      if (hrefMatch && hrefMatch[1]) {
        const url = hrefMatch[1];
        // chaovietnam.co.kr 내부 링크가 아닌 외부 링크 우선
        if (!url.includes('chaovietnam.co.kr') && url.startsWith('http')) {
          return url;
        }
      }
    }
    
    // 외부 링크가 없으면 첫 번째 링크 반환
    const firstHref = linkMatches[0].match(/href=["']([^"']+)["']/i);
    if (firstHref && firstHref[1] && firstHref[1].startsWith('http')) {
      return firstHref[1];
    }
  }
  
  // URL 패턴으로 직접 찾기 (http로 시작하고 chaovietnam이 아닌 것)
  const urlMatches = content.match(/https?:\/\/[^\s"'<>]+/gi);
  if (urlMatches) {
    for (const url of urlMatches) {
      if (!url.includes('chaovietnam.co.kr') && !url.includes('.jpg') && !url.includes('.png') && !url.includes('.gif')) {
        return url;
      }
    }
  }
  
  return "https://chaovietnam.co.kr"; // 기본값
};

/**
 * 카테고리 ID 찾기 (슬러그로)
 */
const findCategoryId = async (slug) => {
  try {
    const response = await axios.get(AD_CATEGORIES_API, {
      params: { slug, _fields: "id" },
      timeout: 5000,
    });
    if (response.data && response.data.length > 0) {
      return response.data[0].id;
    }
  } catch (error) {
    console.log(`카테고리 ${slug} 찾기 실패:`, error.message);
  }
  return null;
};

/**
 * 특정 카테고리에서 광고 가져오기
 */
const fetchAdsFromCategory = async (categoryId) => {
  if (!categoryId) return [];
  
  try {
    const response = await axios.get(AD_API_URL, {
      params: {
        categories: categoryId,
        per_page: 20,
        _fields: "id,title,content,featured_media,link",
      },
      timeout: 8000,
    });
    
    const posts = response.data || [];
    return posts.map(post => {
      const content = post.content?.rendered || "";
      return {
        id: post.id,
        title: post.title?.rendered || "",
        imageUrl: extractImageUrl(content),
        linkUrl: extractLinkUrl(content),
      };
    }).filter(ad => ad.imageUrl);
  } catch (error) {
    console.log(`카테고리 ${categoryId} 광고 로드 실패:`, error.message);
    return [];
  }
};

/**
 * WordPress API에서 광고 데이터 가져오기 (위치별 분리)
 */
const fetchAdConfig = async () => {
  const now = Date.now();
  
  // 캐시가 유효하면 캐시 반환
  if (cachedAds && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedAds;
  }
  
  try {
    console.log("📢 WordPress에서 광고 로드 중...");
    
    // 카테고리 ID 찾기 (처음 한 번만)
    if (!AD_CATEGORY_IDS.banner) {
      AD_CATEGORY_IDS.banner = await findCategoryId("ad-banner");
      AD_CATEGORY_IDS.inline = await findCategoryId("ad-inline");
      AD_CATEGORY_IDS.section = await findCategoryId("ad-section");
      console.log("📂 광고 카테고리 ID:", AD_CATEGORY_IDS);
    }
    
    // 위치별 광고 가져오기
    const [bannerAds, inlineAds, sectionAds, allAds] = await Promise.all([
      fetchAdsFromCategory(AD_CATEGORY_IDS.banner),
      fetchAdsFromCategory(AD_CATEGORY_IDS.inline),
      fetchAdsFromCategory(AD_CATEGORY_IDS.section),
      fetchAdsFromCategory(AD_CATEGORY_IDS.all),
    ]);
    
    // 위치별 카테고리가 없으면 전체 AD 카테고리에서 가져옴
    cachedAds = {
      banner: bannerAds.length > 0 ? bannerAds : allAds,
      inline: inlineAds.length > 0 ? inlineAds : allAds,
      section: sectionAds.length > 0 ? sectionAds : allAds,
    };
    
    lastFetchTime = now;
    console.log(`✅ 광고 로드: Banner ${cachedAds.banner.length}, Inline ${cachedAds.inline.length}, Section ${cachedAds.section.length}`);
    return cachedAds;
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
