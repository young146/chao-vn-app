import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchActiveBusinesses,
  fetchRecentBusinesses,
} from '../services/neighborBusinessService';
import {
  CITIES,
  getDistrictsByCity,
  translateCity,
  translateOther,
} from '../utils/vietnamLocations';

/**
 * 이웃사업 탭 메인 화면 (Phase 1)
 * 관련 문서: directives/NEIGHBOR_BUSINESSES_PLAN.md
 *
 * 구성:
 *   - 상단: 도시 / 구 / 카테고리 필터
 *   - 최근 등록 스트립 (최근 7일 이내 등록된 업소, 작게 상단 배치)
 *   - 목록 FlatList
 *   - 데이터가 0개이고 필터가 없으면 empty state 안내 메시지 (관리자만 등록 가능)
 *   - 관리자(admin claim 소유)만 우측 하단 + FAB 노출
 */

const CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'food', label: '음식점' },
  { key: 'service', label: '서비스' },
  { key: 'shopping', label: '쇼핑' },
  { key: 'lodging', label: '숙박' },
  { key: 'beauty', label: '미용' },
  { key: 'health', label: '병원/약국' },
  { key: 'education', label: '교육' },
  { key: 'other', label: '기타' },
];

export default function NeighborBusinessesScreen() {
  const navigation = useNavigation();
  const auth = useAuth() || {};
  const userIsAdmin = typeof auth.isAdmin === 'function' ? auth.isAdmin() : !!auth.isAdmin;

  const [city, setCity] = useState('all');
  const [district, setDistrict] = useState('all');
  const [category, setCategory] = useState('all');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [recent, setRecent] = useState([]);

  const hasActiveFilter = city !== 'all' || district !== 'all' || category !== 'all';

  const districtOptions = useMemo(() => {
    if (city === 'all') return [];
    return getDistrictsByCity(city);
  }, [city]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const filters = {
        city: city === 'all' ? undefined : city,
        district: district === 'all' ? undefined : district,
        category: category === 'all' ? undefined : category,
      };
      const [list, recentList] = await Promise.all([
        fetchActiveBusinesses(filters),
        hasActiveFilter ? Promise.resolve([]) : fetchRecentBusinesses(7, 5),
      ]);
      setBusinesses(list);
      setRecent(recentList);
    } catch (err) {
      console.warn('[NeighborBusinessesScreen] load error:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [city, district, category, hasActiveFilter]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const navigateToDetail = (id) => {
    navigation.navigate('이웃사업 상세', { id });
  };

  const navigateToAdd = () => {
    navigation.navigate('이웃사업 등록');
  };

  // =========== 렌더러 ===========

  // 현재 선택된 라벨 헬퍼
  const cityLabel = city === 'all' ? '전체 도시' : translateCity(city);
  const districtLabel = district === 'all' ? '전체 구/군' : translateOther(district);
  const categoryLabel = CATEGORIES.find((c) => c.key === category)?.label || '전체';

  const renderFilters = () => (
    <View style={styles.filterBar}>
      {/* 도시 Picker */}
      <View style={styles.pickerWrap}>
        <Text style={styles.pickerLabel}>{cityLabel}</Text>
        <Picker
          selectedValue={city}
          onValueChange={(v) => {
            setCity(v);
            setDistrict('all');
          }}
          style={styles.picker}
          mode="dropdown"
        >
          <Picker.Item label="전체 도시" value="all" />
          {CITIES.map((c) => (
            <Picker.Item key={c} label={translateCity(c)} value={c} />
          ))}
        </Picker>
      </View>

      {/* 구/군 Picker (도시 선택 시만) */}
      {city !== 'all' && districtOptions.length > 0 && (
        <View style={styles.pickerWrap}>
          <Text style={styles.pickerLabel}>{districtLabel}</Text>
          <Picker
            selectedValue={district}
            onValueChange={setDistrict}
            style={styles.picker}
            mode="dropdown"
          >
            <Picker.Item label="전체 구/군" value="all" />
            {districtOptions.map((d) => (
              <Picker.Item key={d} label={translateOther(d)} value={d} />
            ))}
          </Picker>
        </View>
      )}

      {/* 카테고리 Picker */}
      <View style={styles.pickerWrap}>
        <Text style={styles.pickerLabel}>{categoryLabel}</Text>
        <Picker
          selectedValue={category}
          onValueChange={setCategory}
          style={styles.picker}
          mode="dropdown"
        >
          {CATEGORIES.map((c) => (
            <Picker.Item key={c.key} label={c.label} value={c.key} />
          ))}
        </Picker>
      </View>
    </View>
  );

  const renderRecentStrip = () => {
    if (recent.length === 0) return null;
    return (
      <View style={styles.recentStrip}>
        <View style={styles.recentHeader}>
          <Ionicons name="sparkles" size={14} color="#E65100" />
          <Text style={styles.recentTitle}>최근 등록</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recentScrollContent}
        >
          {recent.map((b) => (
            <TouchableOpacity
              key={b.id}
              onPress={() => navigateToDetail(b.id)}
              style={styles.recentCard}
              activeOpacity={0.8}
            >
              {b.images?.[b.thumbnailIndex || 0] ? (
                <Image
                  source={{ uri: b.images[b.thumbnailIndex || 0] }}
                  style={styles.recentThumb}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.recentThumb, styles.recentThumbEmpty]}>
                  <Ionicons name="storefront-outline" size={20} color="#CCC" />
                </View>
              )}
              <Text style={styles.recentName} numberOfLines={1}>
                {b.name}
              </Text>
              <Text style={styles.recentMeta} numberOfLines={1}>
                {translateCity(b.city || '')} · {b.district || ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderBusinessCard = ({ item: b }) => {
    const thumb = b.images?.[b.thumbnailIndex || 0];
    const catLabel = CATEGORIES.find((c) => c.key === b.category)?.label || '';
    return (
      <TouchableOpacity
        onPress={() => navigateToDetail(b.id)}
        style={styles.card}
        activeOpacity={0.85}
      >
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.cardThumb} contentFit="cover" />
        ) : (
          <View style={[styles.cardThumb, styles.cardThumbEmpty]}>
            <Ionicons name="storefront-outline" size={32} color="#CCC" />
          </View>
        )}
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {b.name}
            </Text>
            {catLabel ? (
              <View style={styles.catBadge}>
                <Text style={styles.catBadgeText}>{catLabel}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {translateCity(b.city || '')} · {b.district || '-'}
          </Text>
          {b.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>
              {b.description}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (hasActiveFilter) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={56} color="#CCC" />
          <Text style={styles.emptyTitle}>검색 결과가 없습니다</Text>
          <Text style={styles.emptyMessage}>다른 필터를 시도해보세요</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons name="storefront-outline" size={64} color="#CCC" />
        <Text style={styles.emptyTitle}>우리 이웃 제품/업소</Text>
        <Text style={styles.emptyMessage}>
          이 공간은 관리자만 등록이 가능합니다.{'\n'}
          등록을 원하시면 info@chaovietnam.co.kr 로 연락주세요.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderFilters()}
      {loading && !refreshing ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <FlatList
          data={businesses}
          keyExtractor={(item) => item.id}
          renderItem={renderBusinessCard}
          ListHeaderComponent={renderRecentStrip}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={
            businesses.length === 0 ? styles.listEmpty : styles.listContent
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      {userIsAdmin && (
        <TouchableOpacity style={styles.fab} onPress={navigateToAdd} activeOpacity={0.8}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  pickerWrap: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  pickerLabel: {
    position: 'absolute',
    left: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    zIndex: 1,
    pointerEvents: 'none',
  },
  picker: { height: 44, opacity: 0.01 },

  recentStrip: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#F3EEFF',
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  recentTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
    marginLeft: 4,
  },
  recentScrollContent: {
    paddingHorizontal: 12,
  },
  recentCard: {
    width: 90,
    marginRight: 10,
  },
  recentThumb: {
    width: 90,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  recentThumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  recentMeta: {
    fontSize: 10,
    color: '#888',
    marginTop: 1,
  },

  listContent: {
    paddingVertical: 8,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
  },
  cardThumb: {
    width: 100,
    height: 100,
    backgroundColor: '#f5f5f5',
  },
  cardThumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    padding: 10,
    minWidth: 0,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  cardName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
  },
  catBadge: {
    backgroundColor: '#F3EEFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  catBadgeText: {
    fontSize: 10,
    color: '#7C3AED',
    fontWeight: '600',
  },
  cardMeta: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: '#555',
    lineHeight: 17,
  },

  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
    color: '#333',
  },
  emptyMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  comingSoon: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },

  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 105,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
  },
});
