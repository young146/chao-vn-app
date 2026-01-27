import React, { useState, useEffect } from "react";
import { View, StyleSheet, Image, TouchableOpacity, Linking, Platform } from "react-native";
import axios from "axios";

// AdMob 배너 (Android만 사용)
let BannerAd = null;
let BannerAdSizeEnum = null;
let TestIds = null;

// Android에서만 AdMob 로드
if (Platform.OS === 'android') {
  try {
    const GoogleMobileAds = require('react-native-google-mobile-ads');
    BannerAd = GoogleMobileAds.BannerAd;
    BannerAdSizeEnum = GoogleMobileAds.BannerAdSize;
    TestIds = GoogleMobileAds.TestIds;
  } catch (e) {
    console.log('AdMob 로드 실패, 자체 광고 사용:', e.message);
  }
}

// ============================================
// 🏠 하이브리드 광고 시스템
// 1. AdMob 먼저 시도 (Android만)
// 2. 실패 시 ChaoVN Ad API (Ad Inserter 플러그인)
// 3. 최종 폴백: WordPress Posts API
// ============================================

// AdMob 광고 단위 ID (실제 프로덕션용)
const ADMOB_AD_UNITS = {
  BANNER: 'ca-app-pub-7944314901202352/4705993110',           // 매인 상단 배너
  INTERSTITIAL: 'ca-app-pub-7944314901202352/3814173100',     // 전면 광고
  NATIVE_ADVANCED: 'ca-app-pub-7944314901202352/2867922944',  // 콘텐츠 광고 (네이티브)
};

// API URLs
const CHAOVN_AD_API_URL = "https://chaovietnam.co.kr/wp-json/chaovn/v1/ads";
const WP_POSTS_API_URL = "https://chaovietnam.co.kr/wp-json/wp/v2/posts";
const WP_CATEGORIES_API = "https://chaovietnam.co.kr/wp-json/wp/v2/categories";
const WP_TAGS_API = "https://chaovietnam.co.kr/wp-json/wp/v2/tags";

// 광고 카테고리 ID (WordPress에서 생성 후 ID 확인 필요)
let AD_CATEGORY_IDS = {
  banner: null,   // AD-Banner 카테고리 ID
  inline: null,   // AD-Inline 카테고리 ID  
  section: null,  // AD-Section 카테고리 ID
  all: 399,       // AD 카테고리 (기본값)
};

// 캐시된 태그 ID
let AD_TAG_IDS = {};

/**
 * 기본 광고 데이터 (API 로드 실패 시 사용)
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
    const response = await axios.get(WP_CATEGORIES_API, {
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
 * 태그 ID 찾기 (슬러그로)
 */
const findTagId = async (slug) => {
  // 캐시 확인
  if (AD_TAG_IDS[slug]) return AD_TAG_IDS[slug];
  
  try {
    const response = await axios.get(WP_TAGS_API, {
      params: { slug, _fields: "id" },
      timeout: 5000,
    });
    if (response.data && response.data.length > 0) {
      AD_TAG_IDS[slug] = response.data[0].id;
      return response.data[0].id;
    }
  } catch (error) {
    console.log(`태그 ${slug} 찾기 실패:`, error.message);
  }
  return null;
};

/**
 * 특정 태그로 광고 가져오기 (WordPress Posts API)
 */
const fetchAdsByTag = async (tagSlug, categoryType = 'banner') => {
  const tagId = await findTagId(tagSlug);
  if (!tagId) return null; // 태그가 없으면 null 반환 (기본 광고로 대체)
  
  try {
    // 카테고리 ID 확인
    let categoryId = AD_CATEGORY_IDS[categoryType] || AD_CATEGORY_IDS.all;
    
    const response = await axios.get(WP_POSTS_API_URL, {
      params: {
        tags: tagId,
        categories: categoryId,
        per_page: 10,
        _fields: "id,title,content,featured_media,link",
      },
      timeout: 8000,
    });
    
    const posts = response.data || [];
    const ads = posts.map(post => {
      const content = post.content?.rendered || "";
      return {
        id: post.id,
        title: post.title?.rendered || "",
        imageUrl: extractImageUrl(content),
        linkUrl: extractLinkUrl(content),
      };
    }).filter(ad => ad.imageUrl);
    
    console.log(`📍 태그 [${tagSlug}] 광고: ${ads.length}개`);
    return ads.length > 0 ? ads : null;
  } catch (error) {
    console.log(`태그 ${tagSlug} 광고 로드 실패:`, error.message);
    return null;
  }
};

/**
 * 특정 카테고리에서 광고 가져오기 (WordPress Posts API)
 */
const fetchAdsFromCategory = async (categoryId) => {
  if (!categoryId) return [];
  
  try {
    const response = await axios.get(WP_POSTS_API_URL, {
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
 * 광고 데이터 가져오기 (하이브리드 방식)
 * 1. ChaoVN Ad API 먼저 시도 (Ad Inserter 연동)
 * 2. 실패 시 WordPress Posts API 사용
 */
const fetchAdConfig = async () => {
  const now = Date.now();
  
  // 캐시가 유효하면 캐시 반환
  if (cachedAds && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedAds;
  }
  
  try {
    // 1. ChaoVN Ad API 시도 (Ad Inserter 플러그인)
    console.log("📢 ChaoVN Ad API에서 광고 로드 시도...");
    const response = await axios.get(CHAOVN_AD_API_URL, { timeout: 8000 });
    
    if (response.data?.success && response.data?.data) {
      const apiAds = response.data.data;
      
      cachedAds = {
        banner: apiAds.banner?.length > 0 ? apiAds.banner : DEFAULT_ADS.banner,
        inline: apiAds.inline?.length > 0 ? apiAds.inline : DEFAULT_ADS.inline,
        section: apiAds.section?.length > 0 ? apiAds.section : DEFAULT_ADS.section,
      };
      
      lastFetchTime = now;
      console.log(`✅ ChaoVN Ad API 성공: Banner ${cachedAds.banner.length}, Inline ${cachedAds.inline.length}, Section ${cachedAds.section.length}`);
      return cachedAds;
    }
  } catch (error) {
    console.log("ChaoVN Ad API 실패, WordPress Posts API로 fallback:", error.message);
  }
  
  try {
    // 2. WordPress Posts API 시도 (카테고리 기반)
    console.log("📢 WordPress Posts API에서 광고 로드 시도...");
    
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
      banner: bannerAds.length > 0 ? bannerAds : allAds.length > 0 ? allAds : DEFAULT_ADS.banner,
      inline: inlineAds.length > 0 ? inlineAds : allAds.length > 0 ? allAds : DEFAULT_ADS.inline,
      section: sectionAds.length > 0 ? sectionAds : allAds.length > 0 ? allAds : DEFAULT_ADS.section,
    };
    
    lastFetchTime = now;
    console.log(`✅ WordPress Posts API 성공: Banner ${cachedAds.banner.length}, Inline ${cachedAds.inline.length}, Section ${cachedAds.section.length}`);
    return cachedAds;
  } catch (error) {
    console.log("WordPress Posts API도 실패, 기본값 사용:", error.message);
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
 * 광고 배너 컴포넌트 (하이브리드 방식)
 * ✅ 자체 광고 우선 (사이트 계약 광고)
 * ✅ 자체 광고가 없으면 AdMob으로 채움 (Android만)
 * 
 * @param {string} position - 광고 위치 태그 (예: "home_header", "news_header")
 * @param {boolean} useAdMob - 자체 광고 없을 때 AdMob 사용 여부 (기본: true, Android만)
 */
export default function AdBanner({ position = "default", size, style, useAdMob = true }) {
  const [ad, setAd] = useState(null);
  const [hasSelfAd, setHasSelfAd] = useState(true); // 자체 광고 존재 여부
  const [isLoading, setIsLoading] = useState(true);
  
  // Android에서 AdMob 사용 가능 여부 (자체 광고가 없을 때만)
  const canUseAdMob = Platform.OS === 'android' && BannerAd && useAdMob && !hasSelfAd && !isLoading;
  
  useEffect(() => {
    const loadSelfAd = async () => {
      setIsLoading(true);
      try {
        // 1. 먼저 위치별 태그로 광고 찾기 (예: "home_header")
        if (position && position !== "default") {
          const tagAds = await fetchAdsByTag(position, 'banner');
          if (tagAds && tagAds.length > 0) {
            setAd(getRandomAd(tagAds));
            setHasSelfAd(true);
            setIsLoading(false);
            return;
          }
        }
        
        // 2. 태그별 광고가 없으면 ChaoVN Ad API에서 가져오기
        const ads = await fetchAdConfig();
        const bannerAds = ads?.banner || [];
        
        // 기본 광고(DEFAULT_ADS)는 진짜 광고가 아니므로 제외
        const realAds = bannerAds.filter(ad => 
          ad.imageUrl && !ad.imageUrl.includes('/ads/banner_ad.png')
        );
        
        if (realAds.length > 0) {
          setAd(getRandomAd(realAds));
          setHasSelfAd(true);
        } else {
          // 자체 광고 없음 → AdMob 사용
          console.log("📢 자체 광고 없음, AdMob으로 대체");
          setHasSelfAd(false);
        }
      } catch (error) {
        console.log("배너 광고 로드 실패:", error.message);
        setHasSelfAd(false); // 에러 시 AdMob 사용
      }
      setIsLoading(false);
    };
    
    loadSelfAd();
  }, [position]);
  
  // 로딩 중이면 빈 공간
  if (isLoading) {
    return <View style={[styles.adPlaceholder, style]} />;
  }
  
  // 자체 광고가 있으면 자체 광고 표시 (최우선)
  if (hasSelfAd && ad?.imageUrl) {
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
  
  // 자체 광고가 없고 AdMob 사용 가능하면 AdMob 표시
  if (canUseAdMob) {
    return (
      <View style={[styles.adPlaceholder, style]}>
        <BannerAd
          unitId={__DEV__ ? TestIds.BANNER : ADMOB_AD_UNITS.BANNER}
          size={BannerAdSizeEnum.BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
          onAdLoaded={() => {
            console.log('✅ AdMob 배너 로드 성공 (자체 광고 빈 자리 채움)');
          }}
          onAdFailedToLoad={(error) => {
            console.log('❌ AdMob 배너도 실패:', error.message);
          }}
        />
      </View>
    );
  }
  
  // 아무 광고도 없으면 렌더링 안 함
  return null;
}

/**
 * 인라인 광고 (리스트 중간에 삽입용)
 * ✅ 자체 광고 우선 (사이트 계약 광고)
 * ✅ 자체 광고가 없으면 AdMob으로 채움 (Android만)
 * 
 * @param {string} position - 광고 위치 태그 (예: "news_inline", "board_inline")
 * @param {boolean} useAdMob - 자체 광고 없을 때 AdMob 사용 여부 (기본: true, Android만)
 */
export function InlineAdBanner({ position = "inline", style, useAdMob = true }) {
  const [ad, setAd] = useState(null);
  const [hasSelfAd, setHasSelfAd] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  // Android에서 AdMob 사용 가능 여부 (자체 광고가 없을 때만)
  const canUseAdMob = Platform.OS === 'android' && BannerAd && useAdMob && !hasSelfAd && !isLoading;
  
  useEffect(() => {
    const loadSelfAd = async () => {
      setIsLoading(true);
      try {
        // 1. 위치별 태그로 광고 찾기
        if (position && position !== "inline") {
          const tagAds = await fetchAdsByTag(position, 'inline');
          if (tagAds && tagAds.length > 0) {
            setAd(getRandomAd(tagAds));
            setHasSelfAd(true);
            setIsLoading(false);
            return;
          }
        }
        
        // 2. ChaoVN Ad API에서 인라인 광고 가져오기
        const ads = await fetchAdConfig();
        const inlineAds = ads?.inline || [];
        
        // 기본 광고는 진짜 광고가 아니므로 제외
        const realAds = inlineAds.filter(ad => 
          ad.imageUrl && !ad.imageUrl.includes('/ads/inline_ad.png')
        );
        
        if (realAds.length > 0) {
          setAd(getRandomAd(realAds));
          setHasSelfAd(true);
        } else {
          console.log("📢 자체 인라인 광고 없음, AdMob으로 대체");
          setHasSelfAd(false);
        }
      } catch (error) {
        console.log("인라인 광고 로드 실패:", error.message);
        setHasSelfAd(false);
      }
      setIsLoading(false);
    };
    
    loadSelfAd();
  }, [position]);
  
  // 로딩 중이면 빈 공간
  if (isLoading) {
    return <View style={[styles.inlineAdPlaceholder, style]} />;
  }
  
  // 자체 광고가 있으면 자체 광고 표시 (최우선)
  if (hasSelfAd && ad?.imageUrl) {
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
  
  // 자체 광고가 없고 AdMob 사용 가능하면 AdMob 표시
  if (canUseAdMob) {
    return (
      <View style={[styles.inlineAdPlaceholder, style, { height: 250, justifyContent: 'center', alignItems: 'center' }]}>
        <BannerAd
          unitId={__DEV__ ? TestIds.BANNER : ADMOB_AD_UNITS.NATIVE_ADVANCED}
          size={BannerAdSizeEnum.MEDIUM_RECTANGLE}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
          onAdLoaded={() => {
            console.log('✅ AdMob 인라인 광고 로드 성공 (빈 자리 채움)');
          }}
          onAdFailedToLoad={(error) => {
            console.log('❌ AdMob 인라인도 실패:', error.message);
          }}
        />
      </View>
    );
  }
  
  // 아무 광고도 없으면 렌더링 안 함
  return null;
}

/**
 * 섹션 구분 광고 (홈 화면 섹션 사이에 배치)
 * ✅ 여러 광고 중 랜덤 표시
 * 
 * @param {string} position - 광고 위치 태그 (예: "home_section", "news_section")
 */
export function SectionAdBanner({ position = "section", style }) {
  const [ad, setAd] = useState(getRandomAd(DEFAULT_ADS.section));
  
  useEffect(() => {
    const loadAd = async () => {
      try {
        // 1. 위치별 태그로 광고 찾기
        if (position && position !== "section") {
          const tagAds = await fetchAdsByTag(position, 'section');
          if (tagAds && tagAds.length > 0) {
            setAd(getRandomAd(tagAds));
            return;
          }
        }
        
        // 2. 기본 섹션 광고
        const ads = await fetchAdConfig();
        const sectionAds = ads?.section?.length > 0 ? ads.section : DEFAULT_ADS.section;
        const selectedAd = getRandomAd(sectionAds);
        if (selectedAd) setAd(selectedAd);
      } catch (error) {
        console.log("섹션 광고 로드 실패:", error.message);
      }
    };
    
    loadAd();
  }, [position]);
  
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
