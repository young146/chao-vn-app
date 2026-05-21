// ============================================================
// WelcomeAfterSignupScreen — 가입 직후 전용 환영 화면 (A v2)
// 작성: 2026-05-21
// 깔때기 단계 2 보강 작업 A v2
// ============================================================
//
// 왜 이 화면이 필요한가 (다른 개발자 인수인계용):
//
// 진단(2026-05-21): 앱 다운로드 ~2,000 vs 회원가입 584 = 70% 누수.
// 핵심 원인 중 하나는 *가입 직후 보상이 없음*. 가입 → LoginScreen 복귀 → 8초 후
// "프로필 채우세요" 잔소리만 떴음. 사용자가 *왜 가입했는지* 1초 안에 보상을
// 받지 못해서 다음 세션 이탈.
//
// A v1 (단기): 잔소리 Alert 텍스트를 환영 메시지로 변경 + 8→3초.
// A v2 (이 화면): 전용 풀스크린 환영 + 카테고리 가치 안내 + 푸시 알림 권한 요청 통합.
//
// 디자인 원칙:
// 1. 가입 직후 *3초 이내 도달*. 사용자가 가입 이유를 기억하는 동안 보상.
// 2. 카테고리는 4개로 한정 (뉴스/채용/부동산/중고). 너무 많으면 압도감.
// 3. 푸시 알림 요청을 *환영 흐름에 자연스럽게 통합* — 별도 시스템 팝업의 거부감 줄임.
// 4. *큰 CTA 1개* + 작은 옵션 — 결정 부담 최소화.
// 5. 닫기/X 없음 — 사용자가 *반드시* 메인 진입 흐름을 거치게.

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { logEvent } from '../lib/analytics';

export default function WelcomeAfterSignupScreen({ route, navigation }) {
  const displayName = route?.params?.displayName || '회원';

  // 화면 노출 측정 (defensive analytics 안전)
  useEffect(() => {
    logEvent('welcome_screen_shown', { source: route?.params?.source || 'signup' });
  }, []);

  const handleEnablePushAndStart = async () => {
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      logEvent('welcome_push_enabled', { result: finalStatus });
    } catch (e) {
      // 권한 요청 실패해도 흐름 막지 않음
    }
    goToMain();
  };

  const handleStart = () => {
    logEvent('welcome_get_started_clicked');
    goToMain();
  };

  const goToMain = () => {
    // RootNavigator 스택을 MainApp 으로 교체 → 뒤로가기로 환영 화면 못 돌아옴
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainApp' }],
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 헤더 — 환영 + 닉네임 */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.welcome}>씬짜오 베트남에 오신 걸 환영합니다</Text>
          <Text style={styles.name}>{displayName}님</Text>
        </View>

        {/* 가치 소개 */}
        <Text style={styles.sectionTitle}>매일 받아보실 정보</Text>

        <CategoryCard
          icon="newspaper-outline"
          color="#d1121d"
          title="📰 베트남 한인 뉴스"
          desc="매일 새벽 발행. 호치민·하노이·다낭 등 베트남 한인 사회 주요 이슈"
        />
        <CategoryCard
          icon="briefcase-outline"
          color="#0369a1"
          title="💼 채용 정보"
          desc="베트남 진출 한국기업 채용. 내 지역·업종 매칭 알림"
        />
        <CategoryCard
          icon="home-outline"
          color="#15803d"
          title="🏠 부동산 매물"
          desc="아파트·주택 신규 등록 알림. 가격 변동 추적"
        />
        <CategoryCard
          icon="cart-outline"
          color="#c2410c"
          title="🛒 중고거래·나눔"
          desc="이웃이 올린 물품·서비스. 위치 기반 매칭"
        />

        {/* 푸시 알림 안내 */}
        <View style={styles.pushBox}>
          <Ionicons name="notifications" size={24} color="#f97316" style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pushTitle}>새 콘텐츠 *즉시* 받기</Text>
            <Text style={styles.pushDesc}>푸시 알림을 켜시면 새 채용·부동산·물품을 가장 먼저 받아보실 수 있어요.</Text>
          </View>
        </View>
      </ScrollView>

      {/* 하단 고정 CTA */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleEnablePushAndStart} activeOpacity={0.85}>
          <Ionicons name="notifications" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.primaryButtonText}>알림 켜고 시작하기</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleStart} activeOpacity={0.85}>
          <Text style={styles.secondaryButtonText}>알림 없이 둘러보기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CategoryCard({ icon, color, title, desc }) {
  return (
    <View style={styles.card}>
      <View style={[styles.cardIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 24 },
  header: { alignItems: 'center', marginBottom: 28 },
  emoji: { fontSize: 48, marginBottom: 8 },
  welcome: { fontSize: 18, color: '#666', textAlign: 'center', marginBottom: 4 },
  name: { fontSize: 22, fontWeight: '700', color: '#222', textAlign: 'center' },
  sectionTitle: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 12, marginLeft: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 2 },
  cardDesc: { fontSize: 12, color: '#666', lineHeight: 18 },
  pushBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8f0',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  pushTitle: { fontSize: 14, fontWeight: '700', color: '#7c2d12', marginBottom: 2 },
  pushDesc: { fontSize: 12, color: '#92400e', lineHeight: 17 },
  ctaContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f97316',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#888', fontSize: 14 },
});
