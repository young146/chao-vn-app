import React, { useState, useEffect } from "react";
import { View, Image, TouchableOpacity, Linking, StyleSheet, Platform } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import firebase from "@react-native-firebase/app";
import remoteConfig from "@react-native-firebase/remote-config";

// AdMob 광고 단위 ID
const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : Platform.select({
      android: "ca-app-pub-7944314901202352/4705993110",
      ios: "ca-app-pub-7944314901202352/7518491734",
    });

// Remote Config 캐시
let cachedConfig = null;
let configFetched = false;

// Remote Config 초기화 및 가져오기
const fetchRemoteConfig = async () => {
  if (configFetched && cachedConfig !== null) {
    return cachedConfig;
  }

  try {
    // Firebase 초기화 확인
    if (!firebase.apps.length) {
      console.log("⚠️ Firebase가 아직 초기화되지 않았습니다");
      return { showAdMob: true, adsConfig: {} };
    }

    // 캐시 시간 설정 (개발: 0초, 프로덕션: 1시간)
    await remoteConfig().setConfigSettings({
      minimumFetchIntervalMillis: __DEV__ ? 0 : 3600000,
    });

    // 기본값 설정
    await remoteConfig().setDefaults({
      show_admob: true,
      ads_config: JSON.stringify({
        home_header: { image: "", link: "" },
        home_section: { image: "", link: "" },
        news_header: { image: "", link: "" },
        news_inline: { image: "", link: "" },
        board_header: { image: "", link: "" },
        board_inline: { image: "", link: "" },
        nanum_header: { image: "", link: "" },
        item_detail: { image: "", link: "" },
      }),
    });

    // Remote Config 가져오기
    await remoteConfig().fetchAndActivate();

    const showAdMob = remoteConfig().getValue("show_admob").asBoolean();
    const adsConfigStr = remoteConfig().getValue("ads_config").asString();
    
    let adsConfig = {};
    try {
      adsConfig = JSON.parse(adsConfigStr);
    } catch (e) {
      console.log("ads_config 파싱 실패:", e);
    }

    cachedConfig = {
      showAdMob,
      adsConfig,
    };
    configFetched = true;

    console.log("✅ Remote Config 로드 성공:", cachedConfig);
    return cachedConfig;
  } catch (error) {
    console.log("❌ Remote Config 로드 실패:", error?.message || error);
    // 실패 시 기본값 (AdMob 표시) - 절대 크래시 안 남
    cachedConfig = { showAdMob: true, adsConfig: {} };
    configFetched = true;
    return cachedConfig;
  }
};

// Firebase 앱 초기화 상태 확인 (더 엄격한 체크)
const isFirebaseInitialized = () => {
  try {
    const app = firebase.app();
    return app && app.name === "[DEFAULT]";
  } catch (e) {
    console.log("⚠️ Firebase 앱 확인 실패:", e?.message);
    return false;
  }
};

/**
 * 광고 배너 컴포넌트
 * @param {string} position - 광고 위치 (home_header, news_inline 등)
 * @param {BannerAdSize} size - 배너 크기
 * @param {object} style - 추가 스타일
 */
export default function AdBanner({ 
  position = "default", 
  size = BannerAdSize.BANNER, 
  style 
}) {
  const [showAdMob, setShowAdMob] = useState(true);
  const [inHouseAd, setInHouseAd] = useState(null);
  const [adError, setAdError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, [position]);

  const loadConfig = async () => {
    try {
      // Firebase 초기화 확인 (크래시 방지)
      if (!isFirebaseInitialized()) {
        console.log("⚠️ Firebase 미초기화 - AdMob 기본값 사용");
        setShowAdMob(true);
        setIsLoading(false);
        return;
      }

      const config = await fetchRemoteConfig();
      
      // null/undefined 체크
      if (!config) {
        setShowAdMob(true);
        setIsLoading(false);
        return;
      }

      setShowAdMob(config.showAdMob !== false); // 기본값 true

      // 위치별 자체 광고 설정
      if (!config.showAdMob && config.adsConfig && config.adsConfig[position]) {
        const ad = config.adsConfig[position];
        if (ad && ad.image && ad.link) {
          setInHouseAd(ad);
        }
      }
    } catch (error) {
      console.log("광고 설정 로드 실패:", error?.message || error);
      setShowAdMob(true); // 에러 시 AdMob 기본값
    } finally {
      setIsLoading(false);
    }
  };

  // 로딩 중
  if (isLoading) {
    return null;
  }

  // 자체 광고 표시
  if (!showAdMob && inHouseAd) {
    return (
      <TouchableOpacity
        style={[styles.adContainer, style]}
        onPress={() => {
          if (inHouseAd.link) {
            Linking.openURL(inHouseAd.link);
          }
        }}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: inHouseAd.image }}
          style={[
            styles.inHouseAdImage,
            size === BannerAdSize.MEDIUM_RECTANGLE && styles.mediumRectangle,
            size === BannerAdSize.LARGE_BANNER && styles.largeBanner,
          ]}
          resizeMode="contain"
        />
      </TouchableOpacity>
    );
  }

  // AdMob 광고 표시
  if (!BANNER_AD_UNIT_ID) {
    console.log("⚠️ AdMob: 광고 ID가 없습니다");
    return null;
  }

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
export function InlineAdBanner({ position = "inline", style }) {
  return (
    <AdBanner
      position={position}
      size={BannerAdSize.MEDIUM_RECTANGLE}
      style={[styles.inlineAd, style]}
    />
  );
}

/**
 * 섹션 구분 광고 (홈 화면 섹션 사이에 배치)
 */
export function SectionAdBanner({ position = "section", style }) {
  return (
    <AdBanner
      position={position}
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
  inHouseAdImage: {
    width: "100%",
    height: 50,
  },
  mediumRectangle: {
    height: 250,
  },
  largeBanner: {
    height: 100,
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
