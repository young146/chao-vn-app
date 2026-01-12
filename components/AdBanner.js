import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Platform, Image } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import remoteConfig from "@react-native-firebase/remote-config";

// 광고 단위 ID (플랫폼별 분리)
const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER // 개발 모드에서는 테스트 광고
  : Platform.select({
      android: "ca-app-pub-7944314901202352/4705993110",
      ios: "ca-app-pub-7944314901202352/7518491734",
    });

// Remote Config에서 자체 광고 표시 여부 확인
const checkShowInHouseAds = async () => {
  try {
    // 캐시 만료 시간 설정 (개발: 0초, 프로덕션: 1시간)
    await remoteConfig().setConfigSettings({
      minimumFetchIntervalMillis: __DEV__ ? 0 : 3600000,
    });

    // 기본값 설정 (false = AdMob 광고 표시)
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
    console.log("Remote Config 오류 (기본값 사용):", error.message);
    return false; // 오류 시 기본값 (AdMob 광고 표시)
  }
};

/**
 * 자체 광고 컴포넌트 (Remote Config로 전환 시 표시)
 */
const InHouseAdBanner = ({ style }) => {
  return (
    <View style={[styles.inHouseContainer, style]}>
      <Text style={styles.inHouseText}>🎉 씬짜오베트남 광고 영역 🎉</Text>
      <Text style={styles.inHouseSubText}>광고 문의: info@chaovietnam.co.kr</Text>
    </View>
  );
};

/**
 * AdMob 배너 광고 컴포넌트
 * Remote Config의 show_in_house_ads가 true면 자체 광고 표시
 */
export default function AdBanner({ size = BannerAdSize.BANNER, style }) {
  const [showInHouseAds, setShowInHouseAds] = useState(false);
  const [adError, setAdError] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      const showInHouse = await checkShowInHouseAds();
      setShowInHouseAds(showInHouse);
      setConfigLoaded(true);
    };
    loadConfig();
  }, []);

  // 설정 로딩 중에는 아무것도 표시 안 함
  if (!configLoaded) {
    return null;
  }

  // 자체 광고 모드
  if (showInHouseAds) {
    return <InHouseAdBanner style={style} />;
  }

  // AdMob 광고 로드 실패 시 숨김
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
          console.log("✅ AdMob 광고 로드 성공");
        }}
        onAdFailedToLoad={(error) => {
          console.log("❌ AdMob 광고 로드 실패:", error);
          setAdError(true);
        }}
      />
    </View>
  );
}

/**
 * 인라인 광고 (리스트 중간에 삽입용)
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
  // 자체 광고 스타일
  inHouseContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF8F3",
    borderWidth: 1,
    borderColor: "#FFE0CC",
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginVertical: 8,
  },
  inHouseText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FF6B35",
    marginBottom: 4,
  },
  inHouseSubText: {
    fontSize: 12,
    color: "#999",
  },
});
