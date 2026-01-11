import React, { useState, useEffect } from "react";
import { View, StyleSheet, Platform } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { getRemoteConfig, fetchAndActivate, getValue } from "firebase/remote-config";
import { app } from "../firebase/config";

// 광고 단위 ID
const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER // 개발 모드에서는 테스트 광고
  : "ca-app-pub-7944314901202352/4705993110"; // 프로덕션 배너 광고

// Firebase Remote Config 인스턴스
let remoteConfig = null;

// Remote Config 초기화
const initRemoteConfig = async () => {
  if (remoteConfig) return remoteConfig;
  
  try {
    remoteConfig = getRemoteConfig(app);
    remoteConfig.settings.minimumFetchIntervalMillis = __DEV__ ? 0 : 3600000; // 개발: 즉시, 프로덕션: 1시간
    
    // 기본값 설정
    remoteConfig.defaultConfig = {
      show_in_house_ads: false,
    };
    
    await fetchAndActivate(remoteConfig);
    return remoteConfig;
  } catch (error) {
    console.log("Remote Config 초기화 실패:", error);
    return null;
  }
};

// 자체 광고 표시 여부 확인
const shouldShowInHouseAds = async () => {
  try {
    const config = await initRemoteConfig();
    if (!config) return false;
    
    const value = getValue(config, "show_in_house_ads");
    return value.asBoolean();
  } catch (error) {
    console.log("Remote Config 값 읽기 실패:", error);
    return false;
  }
};

/**
 * AdMob 배너 광고 컴포넌트
 * Firebase Remote Config의 show_in_house_ads가 true면 광고 숨김
 */
export default function AdBanner({ size = BannerAdSize.BANNER, style }) {
  const [showAd, setShowAd] = useState(true);
  const [adError, setAdError] = useState(false);

  useEffect(() => {
    checkAdConfig();
  }, []);

  const checkAdConfig = async () => {
    const showInHouse = await shouldShowInHouseAds();
    // show_in_house_ads가 true면 AdMob 광고 숨기기
    setShowAd(!showInHouse);
  };

  // 광고를 표시하지 않거나 에러가 있으면 아무것도 렌더링하지 않음
  if (!showAd || adError) {
    return null;
  }

  return (
    <View style={[styles.adContainer, style]}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={size}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={() => {
          console.log("✅ 광고 로드 성공");
        }}
        onAdFailedToLoad={(error) => {
          console.log("❌ 광고 로드 실패:", error);
          setAdError(true);
        }}
      />
    </View>
  );
}

/**
 * 인라인 광고 (리스트 중간에 삽입용)
 * 뉴스 피드 등에서 기사 사이에 배치
 */
export function InlineAdBanner({ style }) {
  return (
    <AdBanner
      size={BannerAdSize.MEDIUM_RECTANGLE}
      style={[styles.inlineAd, style]}
    />
  );
}

/**
 * 섹션 구분 광고 (홈 화면 섹션 사이에 배치)
 */
export function SectionAdBanner({ style }) {
  return (
    <AdBanner
      size={BannerAdSize.LARGE_BANNER}
      style={[styles.sectionAd, style]}
    />
  );
}

const styles = StyleSheet.create({
  adContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f9fa",
    marginVertical: 8,
  },
  inlineAd: {
    marginVertical: 16,
    borderRadius: 8,
    overflow: "hidden",
  },
  sectionAd: {
    marginVertical: 20,
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: "hidden",
  },
});
