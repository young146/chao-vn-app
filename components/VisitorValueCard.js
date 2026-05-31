// ============================================================
// VisitorValueCard — 비회원에게 *오늘 새 콘텐츠 가치* 즉시 노출 + 가입 유도
// 작성: 2026-05-21
// 깔때기 단계 1↔2 진입 마찰 해결 (마케팅 활성화 방안 §3 액션 14)
// ============================================================
//
// 왜 이 카드인가 (다른 개발자 인수인계용):
//
// 마케팅 문서: "첫 사용 retention 의 90% 가 첫 30초에서 결정"
// 진입 마찰 진단: 비회원이 앱 첫 진입(뉴스 탭) 시 *왜 이 앱을 깔았는지* 1초 안에
// 가치 못 보면 → 둘러보기만 하고 이탈 → 가입 시도 자체가 안 생김.
//
// 해결: 뉴스 탭 *상단*에 *오늘 새 채용/부동산/중고 카운트* 카드 박음.
// 사용자가 이메일에서 본 "오늘 새 채용 3건" 메시지가 *앱에서도 동일하게 보임*
// → 인지 일관성 + 즉시 가입 유도 CTA.
//
// 데이터 소스: WelcomeAfterSignupScreen 과 동일 (Firestore Jobs/RealEstate/XinChaoDanggn 24h)
// → 이메일 신규 채용/부동산 섹션 + 환영 화면 + 비회원 첫 화면 = 3 채널 자동 동기화
//
// 표시 조건: 비회원(!user) + 카운트 합 > 0. 가입 사용자에게는 노출 X.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getCountFromServer, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { logEvent } from '../lib/analytics';

export default function VisitorValueCard({ navigation }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState({ jobs: 0, realEstate: 0, items: 0, loaded: false });

  useEffect(() => {
    if (user) return; // 가입 사용자는 카운트 query 자체 생략
    let cancelled = false;

    (async () => {
      try {
        const since = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
        const [jobsCount, realEstateCount, itemsCount] = await Promise.all([
          getCountFromServer(query(collection(db, 'Jobs'), where('createdAt', '>', since))).catch(() => null),
          getCountFromServer(query(collection(db, 'RealEstate'), where('createdAt', '>', since))).catch(() => null),
          getCountFromServer(query(collection(db, 'XinChaoDanggn'), where('createdAt', '>', since))).catch(() => null),
        ]);
        if (cancelled) return;
        setCounts({
          jobs: jobsCount ? jobsCount.data().count : 0,
          realEstate: realEstateCount ? realEstateCount.data().count : 0,
          items: itemsCount ? itemsCount.data().count : 0,
          loaded: true,
        });
        // 노출 측정 (defensive — analytics.js 가 부재 시 no-op)
        // ⚠️ 파라미터 값은 반드시 String 으로 보낸다. Firebase Analytics Android 네이티브는
        //    숫자(Double) 파라미터를 받으면 ClassCastException(Double→String) 을 던질 수 있고,
        //    이건 JS try/catch 로 못 잡혀 *앱 전체가 네이티브 크래시* 한다(비로그인 부팅 경로 = 신규설치 무한루프 원인).
        //    다른 모든 이벤트(logNewsRead, company_view 등)도 String() 으로 보내며 안전함이 입증됨.
        try {
          logEvent('visitor_value_card_shown', {
            jobs: String(jobsCount?.data().count ?? 0),
            realEstate: String(realEstateCount?.data().count ?? 0),
            items: String(itemsCount?.data().count ?? 0),
          });
        } catch (_) {}
      } catch (_) { /* fail-safe — 카드 자체 숨김 */ }
    })();

    return () => { cancelled = true; };
  }, [user]);

  // 가입 사용자 노출 X · 데이터 로드 전 또는 카운트 0 시 숨김
  if (user) return null;
  if (!counts.loaded) return null;
  const sum = counts.jobs + counts.realEstate + counts.items;
  if (sum <= 0) return null;

  const handleSignupPress = () => {
    try { logEvent('visitor_value_card_cta_clicked'); } catch (_) {}
    // '로그인' 화면은 RootStack(최상위)에 있음.
    // MagazineScreen의 navigation은 NewsStack 소속이라 직접 navigate 불가.
    // getParent()로 RootStack까지 올라가서 호출해야 실제로 이동함.
    try {
      navigation?.getParent?.()?.navigate?.('로그인');
    } catch (_) {
      navigation?.navigate?.('로그인'); // 폴백 (Navigator 구조 변경 대비)
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="sparkles" size={16} color="#c2410c" />
        <Text style={styles.title}>오늘 (24시간) 새 소식</Text>
      </View>

      <View style={styles.statsRow}>
        {counts.jobs > 0 && (
          <View style={styles.stat}>
            <Text style={styles.statIcon}>💼</Text>
            <Text style={styles.statValue}>{counts.jobs}</Text>
            <Text style={styles.statLabel}>새 채용</Text>
          </View>
        )}
        {counts.realEstate > 0 && (
          <View style={styles.stat}>
            <Text style={styles.statIcon}>🏠</Text>
            <Text style={styles.statValue}>{counts.realEstate}</Text>
            <Text style={styles.statLabel}>새 매물</Text>
          </View>
        )}
        {counts.items > 0 && (
          <View style={styles.stat}>
            <Text style={styles.statIcon}>🛒</Text>
            <Text style={styles.statValue}>{counts.items}</Text>
            <Text style={styles.statLabel}>새 물품</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.cta} onPress={handleSignupPress} activeOpacity={0.85}>
        <Text style={styles.ctaText}>가입하고 내 지역 알림 받기</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 12,
    padding: 14,
    backgroundColor: '#fff8f0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c2410c',
    marginLeft: 6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f97316',
    paddingVertical: 10,
    borderRadius: 8,
  },
  ctaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
