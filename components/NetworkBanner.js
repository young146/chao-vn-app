import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NetworkBanner({ isOffline }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isOffline ? 0 : -60,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline]);

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
