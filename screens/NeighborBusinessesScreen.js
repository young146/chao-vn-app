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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import AdBanner, { InlineAdBanner, FIXED_BOTTOM_HEIGHT } from '../components/AdBanner';
import {
  fetchActiveBusinesses,
} from '../services/neighborBusinessService';
import {
  CITIES,
  getDistrictsByCity,
  translateCity,
  translateOther,
} from '../utils/vietnamLocations';
import CompanyDirectoryContent from './CompanyDirectoryContent';

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
  { key: 'cafe', label: '카페/베이커리' },
  { key: 'beauty', label: '미용/뷰티' },
  { key: 'health', label: '병원/약국' },
  { key: 'lodging', label: '숙박/호텔' },
  { key: 'travel', label: '여행/관광' },
  { key: 'shopping', label: '쇼핑/소매' },
  { key: 'distribution', label: '유통/도매' },
  { key: 'trade', label: '무역/수출입' },
  { key: 'logistics', label: '물류/화물' },
  { key: 'construction', label: '건축/인테리어' },
  { key: 'realestate', label: '부동산' },
  { key: 'manufacturing', label: '제조업' },
  { key: 'it', label: 'IT/소프트웨어' },
  { key: 'design', label: '디자인/광고' },
  { key: 'legal', label: '법률/회계/세무' },
  { key: 'finance', label: '금융/보험' },
  { key: 'education', label: '교육/학원' },
  { key: 'school', label: '학교/기관' },
  { key: 'translation', label: '통역/번역' },
  { key: 'service', label: '기타 서비스' },
  { key: 'other', label: '기타' },
];

// 썸네일 URL 선택: thumbnailIndex가 비디오면 첫 이미지로 폴백
function pickThumbnail(b) {
  const imgs = b?.images || [];
  if (!imgs.length) return { uri: null, hasVideo: false };
  const types = b?.mediaTypes || [];
  const ti = b?.thumbnailIndex ?? 0;
  let uri = imgs[ti];
  if (types[ti] === 'video') {
    const firstImageIdx = types.findIndex((t) => t !== 'video');
    uri = firstImageIdx >= 0 ? imgs[firstImageIdx] : null;
  }
  const hasVideo = types.some((t) => t === 'video');
  return { uri, hasVideo };
}

export default function NeighborBusinessesScreen() {
  const navigation = useNavigation();
  const auth = useAuth() || {};
  const userIsAdmin = typeof auth.isAdmin === 'function' ? auth.isAdmin() : !!auth.isAdmin;

  // 세그먼트 컨트롤: 'neighbor' | 'company'
  const [selectedTab, setSelectedTab] = useState('neighbor');

  const [city, setCity] = useState('all');
  const [district, setDistrict] = useState('all');
  const [category, setCategory] = useState('all');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businesses, setBusinesses] = useState([]);

  const hasActiveFilter = city !== 'all' || district !== 'all' || category !== 'all';

  const districtOptions = useMemo(() => {
    if (city === 'all') return [];
    return getDistrictsByCity(city);
  }, [city]);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      // 1. 프리페치된(캐시된) 데이터 확인 및 즉시 표시
      if (!isRefresh && businesses.length === 0) {
        try {
          const cachedData = await AsyncStorage.getItem('prefetched_neighbor_businesses');
          if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            if (parsedData.businesses) {
              setBusinesses(parsedData.businesses);
              console.log('⚡ [Cache] 프리페치된 이웃사업 데이터를 즉시 표시합니다.');
            } else {
              setLoading(true);
            }
          } else {
            setLoading(true);
          }
        } catch (e) {
          console.error('캐시 로드 실패:', e);
          setLoading(true);
        }
      }

      const filters = {
        city: city === 'all' ? undefined : city,
        district: district === 'all' ? undefined : district,
        category: category === 'all' ? undefined : category,
      };
      
      const list = await fetchActiveBusinesses(filters);
      setBusinesses(list);

      // 필터가 없을 때만 전체 캐시를 업데이트하여 다음 진입 시 즉시 렌더링
      if (!hasActiveFilter) {
        AsyncStorage.setItem('prefetched_neighbor_businesses', JSON.stringify({ businesses: list }))
          .catch(e => console.error('캐시 저장 실패:', e));
      }
    } catch (err) {
      console.warn('[NeighborBusinessesScreen] load error:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [city, district, category, hasActiveFilter, businesses.length]);

  useFocusEffect(
    useCallback(() => {
      loadData(false);
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



  const renderBusinessCard = ({ item: b, index }) => {
    const { uri: thumb, hasVideo } = pickThumbnail(b);
    const catLabel = CATEGORIES.find((c) => c.key === b.category)?.label || '';
    return (
      <View>
      <TouchableOpacity
        onPress={() => navigateToDetail(b.id)}
        style={styles.card}
        activeOpacity={0.85}
      >
        <View>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.cardThumb} contentFit="cover" />
          ) : (
            <View style={[styles.cardThumb, styles.cardThumbEmpty]}>
              <Ionicons name={hasVideo ? 'videocam' : 'storefront-outline'} size={32} color="#CCC" />
            </View>
          )}
          {hasVideo && (
            <View style={styles.videoBadge}>
              <Ionicons name="play" size={10} color="#fff" />
            </View>
          )}
        </View>
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
      {/* 3개마다 광고 삽입 */}
      {(index + 1) % 3 === 0 && (
        <InlineAdBanner screen="neighbor" />
      )}
      </View>
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
      {/* ===== 세그먼트 컨트롤 ===== */}
      <View style={styles.segmentBar}>
        {/* 이웃 사업소 탭 */}
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            selectedTab === 'neighbor' && styles.segmentBtnActiveNeighbor,
          ]}
          onPress={() => setSelectedTab('neighbor')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="storefront-outline"
            size={18}
            color={selectedTab === 'neighbor' ? '#fff' : '#888'}
          />
          <Text
            style={[
              styles.segmentBtnText,
              selectedTab === 'neighbor'
                ? styles.segmentBtnTextActive
                : styles.segmentBtnTextInactive,
            ]}
          >
            이웃 사업소
          </Text>
        </TouchableOpacity>

        {/* 진출 기업 탭 */}
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            selectedTab === 'company'
              ? styles.segmentBtnActiveCompany
              : styles.segmentBtnInactiveCompany,
          ]}
          onPress={() => setSelectedTab('company')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="business-outline"
            size={18}
            color={selectedTab === 'company' ? '#fff' : '#1565C0'}
          />
          <Text
            style={[
              styles.segmentBtnText,
              selectedTab === 'company'
                ? styles.segmentBtnTextActive
                : styles.segmentBtnTextCompanyInactive,
            ]}
          >
            진출 기업
          </Text>
          {/* NEW 배지 */}
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ===== 콘텐츠 영역 ===== */}
      {selectedTab === 'neighbor' ? (
        <>
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
              ListHeaderComponent={<AdBanner screen="neighbor" style={{ marginTop: 8 }} />}
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
        </>
      ) : (
        <CompanyDirectoryContent />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // ===== 세그먼트 컨트롤 =====
  segmentBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  segmentBtn: {
    flex: 1,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 6,
    position: 'relative',
    backgroundColor: '#F5F5F5',
  },
  segmentBtnActiveNeighbor: {
    backgroundColor: '#4CAF50',
  },
  segmentBtnActiveCompany: {
    backgroundColor: '#1565C0',
  },
  segmentBtnInactiveCompany: {
    backgroundColor: '#E3F2FD',
  },
  segmentBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  segmentBtnTextActive: {
    color: '#fff',
  },
  segmentBtnTextInactive: {
    color: '#666',
  },
  segmentBtnTextCompanyInactive: {
    color: '#1565C0',
  },
  newBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
    backgroundColor: '#E53935',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

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



  listContent: {
    paddingTop: 8,
    paddingBottom: FIXED_BOTTOM_HEIGHT + 50,
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
  videoBadge: {
    position: 'absolute',
    right: 6,
    top: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
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
    bottom: 200,
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
