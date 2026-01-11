import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import remoteConfig from "@react-native-firebase/remote-config";

// 광고 단위 ID
const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER // 개발 모드에서는 테스트 광고
  : "ca-app-pub-7944314901202352/4705993110"; // 프로덕션 배너 광고

// Remote Config 초기화 및 자체 광고 표시 여부 확인
const shouldShowInHouseAds = async () => {
  try {
    // 캐시 만료 시간 설정 (개발: 0초, 프로덕션: 1시간)
    await remoteConfig().setConfigSettings({
      minimumFetchIntervalMillis: __DEV__ ? 0 : 3600000,
    });

    // 기본값 설정
    await remoteConfig().setDefaults({
      show_in_house_ads: false,
    });

    // 서버에서 값 가져오기 및 활성화
    await remoteConfig().fetchAndActivate();

    // 값 읽기
    const showInHouse = remoteConfig().getValue("show_in_house_ads").asBoolean();
    console.log("📢 Remote Config - show_in_house_ads:", showInHouse);
    return showInHouse;
  } catch (error) {
    console.log("Remote Config 오류:", error);
    return false; // 오류 시 기본값 (AdMob 광고 표시)
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
