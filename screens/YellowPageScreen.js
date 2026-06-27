// 베트남 남부 옐로페이지 (앱) — 웹 vnkorlife.com /yellowpage 의 RN 포팅.
// 우리가 디지털화한 한인 업소 디렉토리(3,700+) 둘러보기. 카테고리·도시/구군·키워드.
// 앱 등록 이웃업소는 그 안의 "상단노출(프리미엄)" 항목으로 상위 노출됨.
// 검색 두뇌 = daily-news /api/search (type=yellow, browse 모드). 순수 JS → OTA 안전.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Modal, FlatList, Platform, Dimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { searchUnified, getRegions, resolveResultUrl, CAT_LABEL } from '../services/searchService';

const BRAND = '#FF6B35';
const PURPLE = '#7C3AED';
// 하단 고정 광고 배너(화면폭×250/750) 높이 + 여유 → 마지막 항목이 광고에 안 묻히게
const AD_CLEARANCE = Math.round(Dimensions.get('window').width * 250 / 750) + 40;

export default function YellowPageScreen({ navigation }) {
  const [regions, setRegions] = useState({ cities: [], districtsByCity: {}, categoriesByType: {} });
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [q, setQ] = useState('');
  const [activeQ, setActiveQ] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [picker, setPicker] = useState(null); // 'city' | 'district' | null
  const scrollRef = useRef(null);

  useEffect(() => { getRegions().then(setRegions).catch(() => {}); }, []);

  const load = useCallback(async (opts) => {
    setLoading(true);
    const safe = await searchUnified({ ...opts, type: 'yellow' });
    setData(safe);
    setLoading(false);
    scrollRef.current?.scrollTo?.({ y: 0, animated: true });
  }, []);

  // 첫 진입 = 전체 둘러보기
  useEffect(() => { load({ category: '', city: '', district: '', q: '', page: 1 }); }, [load]);

  const apply = (next) => {
    load({
      category: next.category ?? category,
      city: next.city ?? city,
      district: next.district ?? district,
      q: next.q ?? activeQ,
      page: 1,
    });
  };

  const onCategory = (c) => { setCategory(c); apply({ category: c }); };
  const onCity = (c) => { setCity(c); setDistrict(''); setPicker(null); apply({ city: c, district: '' }); };
  const onDistrict = (d) => { setDistrict(d); setPicker(null); apply({ district: d }); };
  const onSearch = () => { setActiveQ(q); apply({ q }); };
  const goPage = (p) => load({ category, city, district, q: activeQ, page: p });

  const openResult = async (r) => {
    const url = resolveResultUrl(r);
    if (!url) return;
    try { await WebBrowser.openBrowserAsync(url); } catch (e) { /* noop */ }
  };

  const cats = regions.categoriesByType.yellow || [];
  const cityDistricts = city ? (regions.districtsByCity[city] || []) : [];
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: AD_CLEARANCE }}>
        <Text style={styles.h1}>베트남 남부 옐로페이지</Text>
        <Text style={styles.sub}>씬짜오 베트남이 정리한 한인 업소 디렉토리 — 검증된 연락처를 카테고리·지역으로.</Text>

        <TouchableOpacity style={styles.applyBtn} activeOpacity={0.85} onPress={() => navigation.navigate('이웃사업', { screen: '이웃사업 등록' })}>
          <Text style={styles.applyBtnText}>⭐ 옐로페이지 상단 노출 신청</Text>
        </TouchableOpacity>

        {/* 키워드 */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              value={q}
              onChangeText={setQ}
              onSubmitEditing={onSearch}
              returnKeyType="search"
              placeholder="업소명·업종 (예: 병원, 한식, 미용실)"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
            />
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={onSearch} activeOpacity={0.85}>
            <Text style={styles.searchBtnText}>검색</Text>
          </TouchableOpacity>
        </View>

        {/* 지역 */}
        <View style={styles.regionRow}>
          <Text style={styles.regionLabel}>지역</Text>
          <TouchableOpacity style={styles.regionPick} onPress={() => setPicker('city')} activeOpacity={0.8}>
            <Text style={styles.regionPickText}>{city || '전체 도시'} ▾</Text>
          </TouchableOpacity>
          {city && cityDistricts.length > 0 && (
            <TouchableOpacity style={styles.regionPick} onPress={() => setPicker('district')} activeOpacity={0.8}>
              <Text style={styles.regionPickText}>{district || '전체 구·군'} ▾</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 카테고리 칩 */}
        <View style={styles.chipRow}>
          <Chip active={category === ''} label="전체" onPress={() => onCategory('')} />
          {cats.map((c) => (
            <Chip key={c.category} active={category === c.category}
              label={`${CAT_LABEL[c.category] || c.category} ${c.n}`} onPress={() => onCategory(c.category)} />
          ))}
        </View>

        {/* 목록 */}
        {loading ? (
          <ActivityIndicator size="large" color={BRAND} style={{ marginVertical: 48 }} />
        ) : data && data.results.length > 0 ? (
          <>
            <Text style={styles.totalText}>총 {data.total.toLocaleString()}곳 · {data.page}/{totalPages} 페이지</Text>
            {data.results.map((r) => (
              <TouchableOpacity key={r.id} style={styles.row} activeOpacity={0.8} onPress={() => openResult(r)}>
                {r.imageUrl ? (
                  <ExpoImage source={{ uri: r.imageUrl }} style={styles.rowImg} contentFit="cover" />
                ) : null}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{r.title}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {[r.category ? (CAT_LABEL[r.category] || r.category) : null, r.city, r.district].filter(Boolean).join(' · ')}
                  </Text>
                  {r.address ? <Text style={styles.rowAddr} numberOfLines={1}>{r.address}</Text> : null}
                </View>
              </TouchableOpacity>
            ))}
            <Pagination page={data.page} totalPages={totalPages} onGo={goPage} />
          </>
        ) : (
          <Text style={styles.emptyText}>해당 조건의 업소가 없습니다.</Text>
        )}
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
                <TouchableOpacity style={styles.modalItem} onPress={() => (picker === 'city' ? onCity(item.key) : onDistrict(item.key))}>
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

function Chip({ active, label, onPress }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Pagination({ page, totalPages, onGo }) {
  if (totalPages <= 1) return null;
  return (
    <View style={styles.pagination}>
      <TouchableOpacity disabled={page <= 1} style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]} onPress={() => onGo(page - 1)}>
        <Text style={styles.pageBtnText}>이전</Text>
      </TouchableOpacity>
      <Text style={styles.pageIndicator}>{page} / {totalPages}</Text>
      <TouchableOpacity disabled={page >= totalPages} style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]} onPress={() => onGo(page + 1)}>
        <Text style={styles.pageBtnText}>다음</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  h1: { fontSize: 21, fontWeight: '800', color: '#111' },
  sub: { fontSize: 13, color: '#6B7280', marginTop: 4, lineHeight: 18 },
  applyBtn: { alignSelf: 'flex-start', marginTop: 10, backgroundColor: PURPLE, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  applyBtnText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },

  searchRow: { flexDirection: 'row', marginTop: 14, gap: 8 },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingLeft: 12 },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, paddingRight: 12, paddingVertical: Platform.OS === 'ios' ? 11 : 8, fontSize: 15, color: '#111' },
  searchBtn: { backgroundColor: BRAND, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  regionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  regionLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  regionPick: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  regionPickText: { color: '#374151', fontSize: 13, fontWeight: '600' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: BRAND },
  chipText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  chipTextActive: { color: '#fff' },

  totalText: { fontSize: 13, color: '#9CA3AF', marginTop: 16, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowImg: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#F3F4F6' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  rowMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  rowAddr: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  emptyText: { textAlign: 'center', color: '#9CA3AF', fontSize: 15, marginVertical: 48 },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 18 },
  pageBtn: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9, backgroundColor: '#fff' },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  pageIndicator: { fontSize: 14, color: '#6B7280', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 32 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 8 },
  modalItem: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalItemText: { fontSize: 15, color: '#374151' },
});
