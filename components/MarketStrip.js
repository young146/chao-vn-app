// ============================================================================
// MarketStrip — 뉴스 탭 상단 가로 스와이프 정보 카드 (날씨·환율·항공권·주가)
// ----------------------------------------------------------------------------
// - 데이터: jenny/v1/market (wordpressApi.getMarketData)
// - 그래프: react-native-svg 없이 순수 View 막대(spark bars)로 추세 표현 → OTA 배포 가능
// - 수익 동선: 카드마다 제휴/소스 버튼을 항상 노출 (숨기지 않음)
// - 카드 순서: 항공권 → 환율 → 주가 → 날씨 (수익 우선)
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as wordpressApi from '../services/wordpressApi';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.round(SCREEN_W * 0.82); // 화면의 82% — 다음 카드가 ~18% 보여 "더 있다"는 신호
const CARD_GAP = 12;
const AVIASALES_URL = 'https://www.aviasales.com/?marker=733771';

// ── 미니 막대 그래프 (순수 View) ──────────────────────────────────────────
// points: 숫자 배열(오래된→최신). color: 막대 색.
function SparkBars({ points, color }) {
  const nums = (Array.isArray(points) ? points : [])
    .map((n) => parseFloat(n))
    .filter((n) => !isNaN(n) && n > 0);

  if (nums.length < 2) {
    return <View style={styles.sparkEmpty} />;
  }

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;

  // 너무 많으면 최근 24개만 (좁은 폰 화면 가독성)
  const shown = nums.length > 24 ? nums.slice(-24) : nums;

  return (
    <View style={styles.sparkRow}>
      {shown.map((v, i) => {
        // 최소 6% ~ 최대 100% 높이로 정규화 (완전 0 높이 방지)
        const h = 6 + 94 * ((v - min) / range);
        const isLast = i === shown.length - 1;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: `${h}%`,
              backgroundColor: color,
              opacity: isLast ? 1 : 0.5, // 최신 막대 강조
              borderTopLeftRadius: 2,
              borderTopRightRadius: 2,
              marginHorizontal: 0.5,
            }}
          />
        );
      })}
    </View>
  );
}

// ── 카드 1장 ────────────────────────────────────────────────────────────────
function MarketCard({ card }) {
  const openLink = () => {
    if (card.linkUrl) Linking.openURL(card.linkUrl).catch(() => {});
  };

  return (
    <View style={[styles.card, { width: CARD_W }]}>
      {/* 헤더: 아이콘 + 제목 + 부제 */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{card.icon}</Text>
        <Text style={styles.cardTitle}>{card.title}</Text>
        {!!card.subtitle && <Text style={styles.cardSubtitle}>{card.subtitle}</Text>}
      </View>

      {/* 본문: 지표 1~2개 (값 + 막대그래프) */}
      <View style={styles.metricsRow}>
        {card.metrics.map((m, idx) => (
          <View key={idx} style={styles.metric}>
            <View style={styles.metricValRow}>
              {!!m.flag && <Text style={styles.flag}>{m.flag}</Text>}
              <Text style={styles.metricLabel}>{m.label}</Text>
            </View>
            <Text style={[styles.metricValue, m.valueColor && { color: m.valueColor }]}>
              {m.value}
              {!!m.unit && <Text style={styles.metricUnit}>{m.unit}</Text>}
            </Text>
            {!!m.sub && <Text style={[styles.metricSub, m.subColor && { color: m.subColor }]}>{m.sub}</Text>}
            {card.showGraph !== false && (
              <View style={styles.graphBox}>
                <SparkBars points={m.spark} color={m.graphColor || card.accent} />
              </View>
            )}
          </View>
        ))}
      </View>

      {/* 제휴/소스 버튼 (항상 노출) */}
      {!!card.buttonText && (
        <TouchableOpacity
          style={[styles.cardBtn, { backgroundColor: card.accent }]}
          onPress={openLink}
          activeOpacity={0.85}
        >
          <Text style={styles.cardBtnText}>{card.buttonText}</Text>
          <Ionicons name="chevron-forward" size={14} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
export default function MarketStrip({ onScrollLock, onScrollUnlock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const md = await wordpressApi.getMarketData();
      if (mounted) {
        setData(md);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="small" color="#ea580c" />
      </View>
    );
  }

  // 데이터 없으면 영역 자체를 숨김 (깨진 화면 방지)
  if (!data) return null;

  // ── 카드 구성 (수익 우선 순서: 항공권 → 환율 → 주가 → 날씨) ──
  const cards = [];

  // 1) 항공권
  const af = data.airfare || {};
  const afMetrics = [];
  if (af.sgn && af.sgn.price) {
    afMetrics.push({
      label: af.sgn.label || '호치민',
      flag: '🇻🇳',
      value: af.sgn.price,
      unit: af.sgn.unit || '원~',
      spark: af.sgn.spark,
      graphColor: '#2f9e44',
    });
  }
  if (af.han && af.han.price) {
    afMetrics.push({
      label: af.han.label || '하노이',
      flag: '🇻🇳',
      value: af.han.price,
      unit: af.han.unit || '원~',
      spark: af.han.spark,
      graphColor: '#2f9e44',
    });
  }
  if (afMetrics.length) {
    cards.push({
      key: 'airfare',
      icon: '✈️',
      title: '항공권 최저가',
      subtitle: '인천 출발',
      accent: '#1a73e8',
      metrics: afMetrics,
      buttonText: '항공권 검색하기',
      linkUrl: AVIASALES_URL,
    });
  }

  // 2) 환율
  const ex = data.exchange || {};
  const exMetrics = [];
  if (ex.usd && ex.usd.value) {
    exMetrics.push({
      label: '1 USD',
      flag: '🇺🇸',
      value: ex.usd.value,
      unit: ex.usd.unit || '₫',
      spark: ex.usd.spark,
      graphColor: '#e03131',
      valueColor: '#059669',
    });
  }
  if (ex.krw && ex.krw.value) {
    exMetrics.push({
      label: ex.krw.label || '100 KRW',
      flag: '🇰🇷',
      value: ex.krw.value,
      unit: ex.krw.unit || '₫',
      spark: ex.krw.spark,
      graphColor: '#e03131',
      valueColor: '#059669',
    });
  }
  if (exMetrics.length) {
    cards.push({
      key: 'exchange',
      icon: '💱',
      title: '환율',
      subtitle: '30일 추세',
      accent: '#059669',
      metrics: exMetrics,
      buttonText: '환율 검색',
      linkUrl: data.links?.exchange || 'https://finance.naver.com/marketindex/',
    });
  }

  // 3) 주가
  const st = data.stock || {};
  const stMetrics = [];
  ['kospi', 'vnindex'].forEach((k) => {
    if (st[k] && st[k].value) {
      const up = st[k].dir === 'up';
      const down = st[k].dir === 'down';
      // 한국 관례: 상승=빨강, 하락=파랑
      const color = up ? '#e03131' : down ? '#1971c2' : '#868e96';
      const arrow = up ? '▲' : down ? '▼' : '–';
      stMetrics.push({
        label: st[k].label || k,
        flag: k === 'kospi' ? '🇰🇷' : '🇻🇳',
        value: st[k].value,
        sub: `${arrow} ${st[k].pct}%`,
        subColor: color,
        spark: st[k].spark,
        graphColor: color,
      });
    }
  });
  if (stMetrics.length) {
    cards.push({
      key: 'stock',
      icon: '📈',
      title: '주가지수',
      subtitle: '전일 대비',
      accent: '#7048e8',
      metrics: stMetrics,
      buttonText: '주가 확인',
      linkUrl: data.links?.stock || 'https://kr.investing.com/indices/major-indices',
    });
  }

  // 4) 날씨 (수익 없음 → 맨 뒤, 그래프 없음)
  const weather = Array.isArray(data.weather) ? data.weather : [];
  if (weather.length) {
    cards.push({
      key: 'weather',
      icon: '🌤',
      title: '오늘의 날씨',
      subtitle: 'Open-Meteo',
      accent: '#0ea5e9',
      showGraph: false,
      metrics: weather.slice(0, 3).map((w) => ({
        label: w.city,
        value: w.temp,
      })),
      buttonText: null,
    });
  }

  if (!cards.length) return null;

  const onScroll = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / (CARD_W + CARD_GAP));
    if (idx !== activeIdx) setActiveIdx(idx);
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={listRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate={0.92}
        snapToInterval={CARD_W + CARD_GAP}
        snapToAlignment="start"
        directionalLockEnabled={true}
        nestedScrollEnabled={true}
        contentContainerStyle={styles.listContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => onScrollLock?.()}
        onScrollEndDrag={() => onScrollUnlock?.()}
        onMomentumScrollEnd={() => onScrollUnlock?.()}
      >
        {cards.map((card, i) => (
          <View key={card.key} style={{ marginLeft: i === 0 ? 0 : CARD_GAP }}>
            <MarketCard card={card} />
          </View>
        ))}
      </ScrollView>
      {/* 페이지 인디케이터 */}
      <View style={styles.dots}>
        {cards.map((c, i) => (
          <View
            key={c.key}
            style={[styles.dot, i === activeIdx && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: '#fafafa',
  },
  loadingBox: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardIcon: { fontSize: 20, marginRight: 7 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  cardSubtitle: { fontSize: 11, color: '#9ca3af', marginLeft: 6, fontWeight: '500' },
  metricsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  metric: { flex: 1 },
  metricValRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  flag: { fontSize: 13, marginRight: 4 },
  metricLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  metricValue: { fontSize: 19, fontWeight: '800', color: '#111827' },
  metricUnit: { fontSize: 12, fontWeight: '600', color: '#9ca3af' },
  metricSub: { fontSize: 13, fontWeight: '700', marginTop: 1 },
  graphBox: {
    marginTop: 8,
    height: 42,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eef2f7',
    paddingHorizontal: 6,
    paddingVertical: 5,
    justifyContent: 'flex-end',
  },
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
  },
  sparkEmpty: { height: '100%' },
  cardBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
  },
  cardBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d1d5db',
  },
  dotActive: {
    backgroundColor: '#ea580c',
    width: 18,
  },
});
