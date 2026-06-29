// 통합검색 결과 화면 (구글식) — 맨 위 고정 검색창 + 결과 리스트.
// 홈(허브)에서 검색 시 이 화면이 push 되어 열린다. 홈은 그대로 유지 → 뒤로/홈탭이면 홈 복원.
// 이 화면에서 계속 검색·타입필터·지역·페이지 이동. 결과 탭 = 인앱 브라우저(vnkorlife.com/biz 등).
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Modal, FlatList, Platform, Dimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { searchUnified, getRegions, resolveResultUrl, isDirectoryResult, TYPE_LABEL } from '../services/searchService';
import BizDetailSheet from '../components/BizDetailSheet';

const BRAND = '#FF6B35';
// 하단 고정 광고 배너(화면폭×250/750) 높이 + 여유 → 마지막 결과가 광고에 안 묻히게
const AD_CLEARANCE = Math.round(Dimensions.get('window').width * 250 / 750) + 40;

const TYPE_BADGE = {
  yellow: { bg: '#F3E8FF', fg: '#7C3AED' },
  company: { bg: '#DBEAFE', fg: '#1D4ED8' },
  news: { bg: '#FFEDD5', fg: '#C2410C' },
  magazine: { bg: '#D1FAE5', fg: '#047857' },
};

export default function SearchResultsScreen({ route }) {
  const initialQ = route?.params?.q || '';
  const [query, setQuery] = useState(initialQ);
  const [activeQ, setActiveQ] = useState(initialQ);
  const [typeFilter, setTypeFilter] = useState('');
  const [city, setCity] = useState(route?.params?.city || '');
  const [district, setDistrict] = useState(route?.params?.district || '');
  const [regions, setRegions] = useState({ cities: [], districtsByCity: {}, categoriesByType: {} });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(null);
  const [bizSeed, setBizSeed] = useState(null); // 진출기업·옐로 상세 팝업 대상(null=닫힘)
  const scrollRef = useRef(null);

  useEffect(() => { getRegions().then(setRegions).catch(() => {}); }, []);

  const search = useCallback(async (opts) => {
    if (!opts.q || !opts.q.trim()) return;
    setLoading(true);
    // sort=category → 결과를 옐로페이지→진출기업→매거진→뉴스 순으로 묶고 그룹 내 가나다(프리미엄 우선)
    const safe = await searchUnified({ ...opts, sort: 'category' });
    setData(safe);
    setLoading(false);
    scrollRef.current?.scrollTo?.({ y: 0, animated: true });
  }, []);

  // 진입 시 홈에서 받은 질의로 즉시 검색
  useEffect(() => {
    if (initialQ) search({ q: initialQ, type: '', city, district, page: 1 });
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = () => { setActiveQ(query); setTypeFilter(''); search({ q: query, type: '', city, district, page: 1 }); };
  const onChip = (t) => { setTypeFilter(t); search({ q: activeQ, type: t, city, district, page: 1 }); };
  const onCity = (c) => { setCity(c); setDistrict(''); setPicker(null); search({ q: activeQ, type: typeFilter, city: c, district: '', page: 1 }); };
  const onDistrict = (d) => { setDistrict(d); setPicker(null); search({ q: activeQ, type: typeFilter, city, district: d, page: 1 }); };
  const goPage = (p) => search({ q: activeQ, type: typeFilter, city, district, page: p });
  const openResult = async (r) => {
    // 진출기업·옐로 = 앱 안 팝업(사이트 안 벗어남). 뉴스·매거진 = 원문 인앱브라우저.
    if (isDirectoryResult(r)) { setBizSeed(r); return; }
    const url = resolveResultUrl(r);
    if (!url) return;
    try { await WebBrowser.openBrowserAsync(url); } catch (e) { /* noop */ }
  };

  const facets = data?.facets?.type || {};
  const allCount = Object.values(facets).reduce((a, b) => a + b, 0);
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;
  const cityDistricts = city ? (regions.districtsByCity[city] || []) : [];

  return (
    <View style={styles.container}>
      {/* 고정 상단 검색바 + 지역 (구글식 — 항상 보임) */}
      <View style={styles.searchHeader}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={onSubmit}
              returnKeyType="search"
              placeholder="베트남의 모든 정보를 씬짜오에서"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              autoFocus={!initialQ}
            />
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={onSubmit} activeOpacity={0.85}>
            <Text style={styles.searchBtnText}>검색</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.regionRow}>
          <Text style={styles.regionLabel}>📍 지역</Text>
          <TouchableOpacity style={styles.regionPick} onPress={() => setPicker('city')} activeOpacity={0.8}>
            <Text style={styles.regionPickText}>{city || '전체 도시'} ▾</Text>
          </TouchableOpacity>
          {city && cityDistricts.length > 0 && (
            <TouchableOpacity style={styles.regionPick} onPress={() => setPicker('district')} activeOpacity={0.8}>
              <Text style={styles.regionPickText}>{district || '전체 구·군'} ▾</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: AD_CLEARANCE }}>
        {/* 타입 필터칩 */}
        {data && data.results.length > 0 && (
          <View style={styles.chipRow}>
            <Chip active={typeFilter === ''} label={`전체 ${allCount}`} onPress={() => onChip('')} />
            {Object.keys(TYPE_LABEL).map((t) =>
              facets[t] ? (
                <Chip key={t} active={typeFilter === t} label={`${TYPE_LABEL[t]} ${facets[t]}`} onPress={() => onChip(t)} />
              ) : null
            )}
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={BRAND} style={{ marginVertical: 48 }} />
        ) : data && data.results.length > 0 ? (
          <>
            <Text style={styles.totalText}>
              총 <Text style={{ fontWeight: '800', color: BRAND }}>{data.total.toLocaleString()}</Text>건 · {data.page}/{totalPages} 페이지
            </Text>
            {data.results.map((r) => (
              <TouchableOpacity key={r.id} style={styles.resultCard} activeOpacity={0.8} onPress={() => openResult(r)}>
                {r.imageUrl ? (
                  <ExpoImage source={{ uri: r.imageUrl }} style={styles.resultImg} contentFit="cover" />
                ) : null}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.resultMeta}>
                    <View style={[styles.badge, { backgroundColor: (TYPE_BADGE[r.type] || {}).bg || '#eee' }]}>
                      <Text style={[styles.badgeText, { color: (TYPE_BADGE[r.type] || {}).fg || '#555' }]}>
                        {TYPE_LABEL[r.type] || r.type}
                      </Text>
                    </View>
                    {(r.city || r.category) && (
                      <Text style={styles.resultLoc} numberOfLines={1}>
                        {[r.city, r.district, r.category].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.resultTitle} numberOfLines={2}>{r.title}</Text>
                  {r.summary ? <Text style={styles.resultSummary} numberOfLines={2}>{r.summary}</Text> : null}
                </View>
              </TouchableOpacity>
            ))}
            <Pagination page={data.page} totalPages={totalPages} onGo={goPage} />
          </>
        ) : (
          <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
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

      {/* 진출기업·옐로 상세 — 앱 안 팝업 */}
      <BizDetailSheet visible={bizSeed !== null} seed={bizSeed} onClose={() => setBizSeed(null)} />
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
  searchHeader: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingLeft: 12 },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, paddingRight: 12, paddingVertical: Platform.OS === 'ios' ? 11 : 8, fontSize: 15, color: '#111' },
  searchBtn: { backgroundColor: BRAND, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  regionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  regionLabel: { fontSize: 13, color: '#6B7280', fontWeight: '700' },
  regionPick: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  regionPickText: { color: '#374151', fontSize: 13, fontWeight: '600' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  chipActive: { backgroundColor: BRAND, borderColor: BRAND },
  chipText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  chipTextActive: { color: '#fff' },

  totalText: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  resultCard: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  resultImg: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#F3F4F6' },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  resultLoc: { fontSize: 11.5, color: '#9CA3AF', flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  resultSummary: { fontSize: 13, color: '#6B7280', marginTop: 3, lineHeight: 18 },

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
