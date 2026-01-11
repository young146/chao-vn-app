import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";

// 광고 단위 ID
const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER // 개발 모드에서는 테스트 광고
  : "ca-app-pub-7944314901202352/4705993110"; // 프로덕션 배너 광고

/**
 * AdMob 배너 광고 컴포넌트
 * TODO: Firebase Remote Config는 @react-native-firebase/remote-config 설치 후 추가
 */
export default function AdBanner({ size = BannerAdSize.BANNER, style }) {
  const [adError, setAdError] = useState(false);

  // 에러가 있으면 아무것도 렌더링하지 않음
  if (adError) {
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
