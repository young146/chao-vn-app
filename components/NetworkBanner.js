import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NetworkBanner({ isOffline }) {
  const insets = useSafeAreaInsets();
  // 숨길 때 배너를 '위쪽 안전영역(insets.top) + 배너높이'만큼 밀어올려 화면 밖으로 완전히 보낸다.
  // 기존 고정값 -60 은 iOS(노치/다이나믹아일랜드)처럼 insets.top 이 크면 부족해서
  // 배너가 화면 상단에 그대로 남아 "인터넷 있는데도 연결없음"이 떠 보였다.
  const HIDDEN_Y = -(insets.top + 60);
  const translateY = useRef(new Animated.Value(-300)).current; // 시작은 확실히 화면 밖

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isOffline ? 0 : HIDDEN_Y,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline, HIDDEN_Y]);

  return (
    <Animated.View
      style={[
        styles.banner,
        { top: insets.top, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.text}>
        인터넷 연결 없음 — Wi-Fi 또는 데이터를 확인해 주세요
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#c62828',
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
