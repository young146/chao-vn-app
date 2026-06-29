// 씬짜오 베트남 통합검색 허브 (앱 홈) — 웹 vnkorlife.com 홈의 RN 포팅.
// 홈은 '입구'만 담당: 검색창 + 지역 + 옐로페이지 대표카드 + 바로가기.
// 검색을 누르면 별도 '검색결과' 화면이 push 로 열린다(구글식) → 홈은 항상 그대로 유지.
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Modal, FlatList, Platform, Dimensions, ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getRegions } from '../services/searchService';

const BRAND = '#FF6B35';
const BLUE = '#1e3a8a';
// 하단 고정 광고 배너(AdBanner.js: 화면폭×250/750)가 스크롤 하단을 덮으므로,
// 그 높이 + 여유만큼 ScrollView 바닥 여백을 줘서 마지막 카드까지 광고 위로 스크롤되게 한다.
const AD_CLEARANCE = Math.round(Dimensions.get('window').width * 250 / 750) + 40;

// 바로가기 — 콘텐츠 2칸(매거진·뉴스, 큰 카드). color = 아이콘 타일 강조색
const GUIDE_TOP = [
  { key: 'magazine', label: '씬짜오 매거진', desc: '24년 교민 잡지', emoji: '📖', color: '#F43F5E', tab: '홈', screen: '홈메인', params: { type: 'home', resetSearch: 'now' } },
  { key: 'news', label: '데일리 뉴스', desc: '매일 베트남 뉴스', emoji: '📰', color: '#6366F1', tab: '뉴스', screen: '뉴스메인', params: { type: 'news', resetSearch: 'now' } },
];
// 바로가기 — 마켓 3칸(당근·구인·부동산, 가로폭에 맞춰 한 줄)
const GUIDE_BOTTOM = [
  { key: 'danggn', label: '당근·나눔', emoji: '🥕', color: '#F97316', tab: '당근/나눔', screen: '당근/나눔 메인' },
  { key: 'jobs', label: '구인·구직', emoji: '💼', color: '#0EA5E9', tab: '구인구직', screen: '구인구직 메인' },
  { key: 'realestate', label: '부동산', emoji: '🏠', color: '#14B8A6', tab: '부동산', screen: '부동산 메인' },
];

export default function HubScreen({ navigation, route }) {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [regions, setRegions] = useState({ cities: [], districtsByCity: {}, categoriesByType: {} });
  const [picker, setPicker] = useState(null); // 'city' | 'district' | null

  // 지역 옵션 로드
  useEffect(() => {
    getRegions().then(setRegions).catch(() => {});
  }, []);

  // 홈 탭/제목 재탭(resetSearch) 시 입력 초기화 — 홈은 항상 깨끗한 첫 화면
  useEffect(() => {
    if (route?.params?.resetSearch) {
      setQuery(''); setCity(''); setDistrict(''); setPicker(null);
    }
  }, [route?.params?.resetSearch]);

  // 검색 = 별도 결과 화면으로 이동 (홈은 그대로 남음)
  const onSubmit = () => {
    if (!query.trim()) return;
    navigation.navigate('검색결과', { q: query.trim(), city, district });
  };
  const onCity = (c) => { setCity(c); setDistrict(''); setPicker(null); };
  const onDistrict = (d) => { setDistrict(d); setPicker(null); };

  const goGuide = (g) => {
    const params = g.params
      ? { ...g.params, resetSearch: g.params.resetSearch === 'now' ? Date.now() : g.params.resetSearch }
      : undefined;
    navigation.navigate(g.tab, params ? { screen: g.screen, params } : { screen: g.screen });
  };

  const cityDistricts = city ? (regions.districtsByCity[city] || []) : [];

  return (
    <View style={styles.container}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: AD_CLEARANCE }}>
        {/* ===== HERO ===== */}
        <View style={styles.hero}>
          <Text style={styles.heroBadge}>⭐ 24년 교민 잡지가 만든 통합검색</Text>
          <Text style={styles.heroTitle}>씬짜오 베트남 통합검색</Text>
          <Text style={styles.heroSub}>옐로페이지 · 진출기업 · 뉴스 · 매거진을 한 곳에서</Text>

          {/* 검색창 = 입력 · 지역필터(칩) · 검색버튼을 한 박스(흰 pill) 안에 통합 (웹과 동일, 더 크게) */}
          <View style={styles.searchBox}>
            {/* 윗줄: 돋보기 + 입력 */}
            <View style={styles.searchTop}>
              <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={onSubmit}
                returnKeyType="search"
                placeholder="베트남의 모든 정보를 씬짜오에서"
                placeholderTextColor="#9CA3AF"
                style={styles.searchInput}
              />
            </View>
            {/* 아랫줄: 지역 필터(칩) + 검색 버튼 — 모두 검색창 안 */}
            <View style={styles.searchBottom}>
              <View style={styles.regionChips}>
                <TouchableOpacity style={styles.regionChip} onPress={() => setPicker('city')} activeOpacity={0.8}>
                  <Text style={styles.regionChipText}>📍 {city || '전체 도시'} ▾</Text>
                </TouchableOpacity>
                {city && cityDistricts.length > 0 && (
                  <TouchableOpacity style={styles.regionChip} onPress={() => setPicker('district')} activeOpacity={0.8}>
                    <Text style={styles.regionChipText}>{district || '전체 구·군'} ▾</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity style={styles.searchBtn} onPress={onSubmit} activeOpacity={0.85}>
                <Text style={styles.searchBtnText}>검색</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* AI 검색 도우미 입구 — 자연어로 묻고 싶을 때. 보라(AI 연상)+흰글씨로 대비 확보 */}
          <TouchableOpacity
            style={styles.aiEntry}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('AI도우미')}
          >
            <View style={styles.aiIconBadge}>
              <Text style={styles.aiIconEmoji}>💁</Text>
            </View>
            <View style={styles.aiEntryTextWrap}>
              <Text style={styles.aiEntryText}>AI 검색 도우미</Text>
              <Text style={styles.aiEntryHint}>“2군 평점 좋은 한식당”처럼 말해보세요</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.95)" />
          </TouchableOpacity>
        </View>

        {/* ===== 본문(항상 홈) — 베트남 풍경 블러 배경 ===== */}
        <ImageBackground
          source={require('../assets/hub-bg.jpg')}
          blurRadius={6}
          style={styles.body}
          imageStyle={styles.bodyImg}
        >
          {/* 가독성 오버레이 — 사진은 은은하게, 카드·글자는 또렷하게 */}
          <View style={styles.bodyOverlay} pointerEvents="none" />

          {/* 옐로페이지 대표 카드 */}
          <TouchableOpacity
            style={styles.featureCard}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('옐로페이지')}
          >
            <View style={styles.featureLeft}>
              <Text style={styles.featureEmoji}>📒</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>옐로페이지</Text>
                <Text style={styles.featureDesc}>현지 한인 업소 3,700+ · 카테고리·지역으로 찾기</Text>
              </View>
              <Text style={styles.featureArrow}>›</Text>
            </View>
            <TouchableOpacity
              style={styles.featureCta}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('이웃사업', { screen: '이웃사업 등록' })}
            >
              <Text style={styles.featureCtaText}>⭐ 우리 업소 상단노출 신청</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>바로가기</Text>
          {/* 콘텐츠 2칸 */}
          <View style={styles.grid}>
            {GUIDE_TOP.map((g) => (
              <TouchableOpacity key={g.key} style={styles.card} activeOpacity={0.85} onPress={() => goGuide(g)}>
                <View style={[styles.iconTile, { backgroundColor: g.color + '22' }]}>
                  <Text style={styles.iconTileEmoji}>{g.emoji}</Text>
                </View>
                <Text style={styles.cardLabel}>{g.label}</Text>
                <Text style={styles.cardDesc}>{g.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* 마켓 3칸 — 가로폭에 맞춰 한 줄 */}
          <View style={styles.gridThree}>
            {GUIDE_BOTTOM.map((g) => (
              <TouchableOpacity key={g.key} style={styles.cardSmall} activeOpacity={0.85} onPress={() => goGuide(g)}>
                <View style={[styles.iconTileSm, { backgroundColor: g.color + '22' }]}>
                  <Text style={styles.iconTileEmojiSm}>{g.emoji}</Text>
                </View>
                <Text style={styles.cardSmallLabel}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ImageBackground>
      </ScrollView>

      {/* 지역 선택 모달 */}
      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPicker(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{picker === 'city' ? '도시 선택' : '구·군 선택'}</Text>
            <FlatList
              data={picker === 'city'
                ? [{ key: '', label: '전체 도시' }, ...regions.cities.map((c) => ({ key: c.city, label: `${c.city} (${c.n})` }))]
                : [{ key: '', label: '전체 구·군' }, ...cityDistricts.map((d) => ({ key: d.district, label: `${d.district} (${d.n})` }))]}
              keyExtractor={(it) => it.key || 'all'}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => (picker === 'city' ? onCity(item.key) : onDistrict(item.key))}
                >
                  <Text style={styles.modalItemText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  hero: { backgroundColor: BRAND, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 22, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroBadge: { color: '#FFF7ED', fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  heroSub: { color: '#FFEEDD', fontSize: 13, textAlign: 'center', marginTop: 6 },
  // 올인원 검색 박스 (웹과 동일): 흰 pill 안에 입력 + 지역칩 + 검색버튼. 더 크게.
  searchBox: { marginTop: 18, backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  searchTop: { flexDirection: 'row', alignItems: 'center' },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 17, color: '#111' },
  searchBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  regionChips: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  regionChip: { backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  regionChipText: { color: '#374151', fontSize: 14, fontWeight: '600' },
  searchBtn: { backgroundColor: BLUE, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 11, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // AI 검색 도우미 카드 — 보라 솔리드 배경에 흰 글씨(고대비). 흰 원형 배지 안에 큰 도우미 아이콘.
  aiEntry: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#7C3AED', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, shadowColor: '#4C1D95', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  aiIconBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  aiIconEmoji: { fontSize: 28, lineHeight: 34 },
  aiEntryTextWrap: { flex: 1, minWidth: 0 },
  aiEntryText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  aiEntryHint: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, marginTop: 2 },

  body: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, overflow: 'hidden' },
  bodyImg: {},
  bodyOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(248,250,252,0.3)' },

  featureCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#F3E8FF', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  featureLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureEmoji: { fontSize: 30 },
  featureTitle: { fontSize: 17, fontWeight: '800', color: '#111' },
  featureDesc: { fontSize: 12.5, color: '#6B7280', marginTop: 2 },
  featureArrow: { fontSize: 26, color: '#C4B5FD', fontWeight: '700' },
  featureCta: { marginTop: 12, backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  featureCtaText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 22, marginBottom: 12, textShadowColor: 'rgba(255,255,255,0.9)', textShadowRadius: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48%', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  iconTile: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  iconTileEmoji: { fontSize: 24 },
  cardLabel: { fontSize: 15, fontWeight: '700', color: '#111' },
  cardDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  gridThree: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  cardSmall: { width: '31.5%', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  iconTileSm: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  iconTileEmojiSm: { fontSize: 20 },
  cardSmallLabel: { fontSize: 13, fontWeight: '700', color: '#111', textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 32 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 8 },
  modalItem: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalItemText: { fontSize: 15, color: '#374151' },
});
