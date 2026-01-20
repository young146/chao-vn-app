import React from "react";
import { View, StyleSheet } from "react-native";

// ============================================
// 🧪 iOS 크래시 테스트를 위해 AdMob 비활성화
// AdMob이 크래시 원인인지 확인 후 복원 예정
// ============================================

// import {
//   BannerAd,
//   BannerAdSize,
//   TestIds,
// } from "react-native-google-mobile-ads";
// import firebase from "@react-native-firebase/app";
// import remoteConfig from "@react-native-firebase/remote-config";

/**
 * 광고 배너 컴포넌트 (AdMob 비활성화 - 빈 View 반환)
 */
export default function AdBanner({ position = "default", size, style }) {
  // 테스트용: 빈 View 반환 (광고 자리는 유지)
  return <View style={[styles.adPlaceholder, style]} />;
}

/**
 * 인라인 광고 (리스트 중간에 삽입용)
 */
export function InlineAdBanner({ position = "inline", style }) {
  return <View style={[styles.inlineAdPlaceholder, style]} />;
}

/**
 * 섹션 구분 광고 (홈 화면 섹션 사이에 배치)
 */
export function SectionAdBanner({ position = "section", style }) {
  return <View style={[styles.sectionAdPlaceholder, style]} />;
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
    backgroundColor: "#f0f0f0",
    marginVertical: 8,
  },
  inlineAdPlaceholder: {
    height: 250,
    backgroundColor: "#f0f0f0",
    marginVertical: 16,
    borderRadius: 8,
  },
  sectionAdPlaceholder: {
    height: 100,
    backgroundColor: "#f0f0f0",
    marginVertical: 20,
    marginHorizontal: 16,
    borderRadius: 8,
  },
});
