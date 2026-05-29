import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { searchCompanies, listCompanies } from '../lib/companyDirectoryApi';
import { logEvent } from '../lib/analytics';
import { FIXED_BOTTOM_HEIGHT } from '../components/AdBanner';

// ============================================================
// 지역 필터 칩 목록
// ============================================================
const AREAS = [
  { label: '전체', value: '' },
  { label: '하노이', value: 'HANOI' },
  { label: '호치민', value: 'HCMC' },
  { label: '박닌', value: 'BAC NINH' },
  { label: '빈증', value: 'BINH DUONG' },
  { label: '동나이', value: 'DONG NAI' },
  { label: '하이퐁', value: 'HAI PHONG' },
  { label: '다낭', value: 'DA NANG' },
  { label: '박장', value: 'BAC GIANG' },
];

const PER_PAGE = 20;

// ============================================================
// 상세 모달
// ============================================================
const DetailModal = memo(({ company, visible, onClose }) => {
  if (!company) return null;

  const handleTel = () => {
    if (company.tel) Linking.openURL(`tel:${company.tel.replace(/\s/g, '')}`);
  };

  const handleHomepage = async () => {
    if (company.homepage) {
      await WebBrowser.openBrowserAsync(company.homepage);
    }
  };

  const handleSource = async () => {
    if (company.source_url) {
      await WebBrowser.openBrowserAsync(company.source_url);
    }
  };

  const emailList = company.email
    ? company.email.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    : [];

  const additionalEmailList = company.additional_emails
    ? company.additional_emails.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    : [];

  const handleMobile = () => {
    if (company.mobile) Linking.openURL(`tel:${company.mobile.replace(/\s/g, '')}`);
  };

  const formattedDate = company.created_at
    ? String(company.created_at).slice(0, 10)
    : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.modalTitle} numberOfLines={2}>{company.company || '회사 정보'}</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
          {company.area ? (
            <View style={styles.modalAreaRow}>
              <View style={styles.areaChip}>
                <Ionicons name="location" size={13} color="#2196F3" />
                <Text style={styles.areaChipText}>{company.area}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.modalSection}>
            {company.director ? (
              <View style={styles.modalRow}>
                <Ionicons name="person-outline" size={18} color="#666" style={styles.modalIcon} />
                <View style={styles.modalRowContent}>
                  <Text style={styles.modalLabel}>대표자</Text>
                  <Text style={styles.modalValue}>{company.director}</Text>
                </View>
              </View>
            ) : null}

            {company.industry_group ? (
              <View style={styles.modalRow}>
                <Ionicons name="briefcase-outline" size={18} color="#666" style={styles.modalIcon} />
                <View style={styles.modalRowContent}>
                  <Text style={styles.modalLabel}>업종</Text>
                  <Text style={styles.modalValue}>{company.industry_group}</Text>
                </View>
              </View>
            ) : null}

            {company.industry_detail ? (
              <View style={styles.modalRow}>
                <Ionicons name="document-text-outline" size={18} color="#666" style={styles.modalIcon} />
                <View style={styles.modalRowContent}>
                  <Text style={styles.modalLabel}>사업내용</Text>
                  <Text style={styles.modalValue}>{company.industry_detail}</Text>
                </View>
              </View>
            ) : null}

            {company.address ? (
              <View style={styles.modalRow}>
                <Ionicons name="map-outline" size={18} color="#666" style={styles.modalIcon} />
                <View style={styles.modalRowContent}>
                  <Text style={styles.modalLabel}>주소</Text>
                  <Text style={styles.modalValue}>{company.address}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* 회사 소개 / 주요 제품 / 추가 정보 — 크롤링된 데이터 */}
          {(company.description || company.products || company.employees ||
            company.founded_year || company.country) ? (
            <View style={styles.modalSection}>
              {company.description ? (
                <View style={styles.modalRow}>
                  <Ionicons name="information-circle-outline" size={18} color="#666" style={styles.modalIcon} />
                  <View style={styles.modalRowContent}>
                    <Text style={styles.modalLabel}>회사 소개</Text>
                    <Text style={styles.modalValue}>{company.description}</Text>
                  </View>
                </View>
              ) : null}

              {company.products ? (
                <View style={styles.modalRow}>
                  <Ionicons name="cube-outline" size={18} color="#666" style={styles.modalIcon} />
                  <View style={styles.modalRowContent}>
                    <Text style={styles.modalLabel}>주요 제품/서비스</Text>
                    <Text style={styles.modalValue}>{company.products}</Text>
                  </View>
                </View>
              ) : null}

              {company.employees ? (
                <View style={styles.modalRow}>
                  <Ionicons name="people-outline" size={18} color="#666" style={styles.modalIcon} />
                  <View style={styles.modalRowContent}>
                    <Text style={styles.modalLabel}>고용인원</Text>
                    <Text style={styles.modalValue}>{company.employees}</Text>
                  </View>
                </View>
              ) : null}

              {company.founded_year ? (
                <View style={styles.modalRow}>
                  <Ionicons name="flag-outline" size={18} color="#666" style={styles.modalIcon} />
                  <View style={styles.modalRowContent}>
                    <Text style={styles.modalLabel}>창립연도</Text>
                    <Text style={styles.modalValue}>{company.founded_year}년</Text>
                  </View>
                </View>
              ) : null}

              {company.country ? (
                <View style={styles.modalRow}>
                  <Ionicons name="earth-outline" size={18} color="#666" style={styles.modalIcon} />
                  <View style={styles.modalRowContent}>
                    <Text style={styles.modalLabel}>법인등록국가</Text>
                    <Text style={styles.modalValue}>{company.country}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.modalSection}>
            {company.tel ? (
              <TouchableOpacity style={styles.modalContactRow} onPress={handleTel}>
                <View style={[styles.contactIconWrap, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="call" size={20} color="#4CAF50" />
                </View>
                <Text style={[styles.modalContactText, { color: '#4CAF50' }]}>{company.tel}</Text>
                <Ionicons name="chevron-forward" size={16} color="#ccc" />
              </TouchableOpacity>
            ) : null}

            {company.homepage ? (
              <TouchableOpacity style={styles.modalContactRow} onPress={handleHomepage}>
                <View style={[styles.contactIconWrap, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="globe" size={20} color="#2196F3" />
                </View>
                <Text style={[styles.modalContactText, { color: '#2196F3' }]}>{company.homepage}</Text>
                <Ionicons name="chevron-forward" size={16} color="#ccc" />
              </TouchableOpacity>
            ) : null}

            {emailList.map((email, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.modalContactRow}
                onPress={() => Linking.openURL(`mailto:${email}`)}
              >
                <View style={[styles.contactIconWrap, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="mail" size={20} color="#FF9800" />
                </View>
                <Text style={[styles.modalContactText, { color: '#FF9800' }]}>{email}</Text>
                <Ionicons name="chevron-forward" size={16} color="#ccc" />
              </TouchableOpacity>
            ))}

            {company.mobile ? (
              <TouchableOpacity style={styles.modalContactRow} onPress={handleMobile}>
                <View style={[styles.contactIconWrap, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="phone-portrait-outline" size={20} color="#4CAF50" />
                </View>
                <Text style={[styles.modalContactText, { color: '#4CAF50' }]}>{company.mobile}</Text>
                <Ionicons name="chevron-forward" size={16} color="#ccc" />
              </TouchableOpacity>
            ) : null}

            {additionalEmailList.map((email, idx) => (
              <TouchableOpacity
                key={`ae_${idx}`}
                style={styles.modalContactRow}
                onPress={() => Linking.openURL(`mailto:${email}`)}
              >
                <View style={[styles.contactIconWrap, { backgroundColor: '#F3E5F5' }]}>
                  <Ionicons name="mail-open-outline" size={20} color="#9C27B0" />
                </View>
                <Text style={[styles.modalContactText, { color: '#9C27B0' }]}>{email}</Text>
                <Ionicons name="chevron-forward" size={16} color="#ccc" />
              </TouchableOpacity>
            ))}
          </View>

          {(company.source || company.source_url || formattedDate || company.id != null) ? (
            <View style={styles.modalSection}>
              {company.source ? (
                <TouchableOpacity
                  style={styles.modalRow}
                  onPress={company.source_url ? handleSource : null}
                  disabled={!company.source_url}
                >
                  <Ionicons name="link-outline" size={18} color="#666" style={styles.modalIcon} />
                  <View style={styles.modalRowContent}>
                    <Text style={styles.modalLabel}>출처</Text>
                    <Text style={styles.modalValue}>{company.source}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              {company.source_url ? (
                <TouchableOpacity style={styles.modalRow} onPress={handleSource}>
                  <Ionicons name="open-outline" size={18} color="#666" style={styles.modalIcon} />
                  <View style={styles.modalRowContent}>
                    <Text style={styles.modalLabel}>출처 URL</Text>
                    <Text style={[styles.modalValue, { color: '#2196F3', textDecorationLine: 'underline' }]}>
                      {company.source_url}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              {formattedDate ? (
                <View style={styles.modalRow}>
                  <Ionicons name="calendar-outline" size={18} color="#666" style={styles.modalIcon} />
                  <View style={styles.modalRowContent}>
                    <Text style={styles.modalLabel}>등록일</Text>
                    <Text style={styles.modalValue}>{formattedDate}</Text>
                  </View>
                </View>
              ) : null}

              {company.id != null ? (
                <View style={styles.modalRow}>
                  <Ionicons name="information-circle-outline" size={18} color="#bbb" style={styles.modalIcon} />
                  <View style={styles.modalRowContent}>
                    <Text style={styles.modalLabel}>ID</Text>
                    <Text style={[styles.modalValue, { color: '#bbb', fontSize: 12 }]}>{company.id}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
});

// ============================================================
// 회사 카드
// ============================================================
const CompanyCard = memo(({ item, onPress }) => {
  const industryLabel = [item.industry_group, item.industry_detail ? item.industry_detail.slice(0, 20) : ''].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(item)} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <Text style={styles.cardCompany} numberOfLines={1}>{item.company || '(회사명 없음)'}</Text>
        {item.area ? (
          <View style={styles.areaChip}>
            <Ionicons name="location" size={12} color="#2196F3" />
            <Text style={styles.areaChipText}>{item.area}</Text>
          </View>
        ) : null}
      </View>

      {item.director ? (
        <Text style={styles.cardDirector} numberOfLines={1}>
          <Text style={styles.cardLabel}>대표 </Text>{item.director}
        </Text>
      ) : null}

      {industryLabel ? (
        <Text style={styles.cardIndustry} numberOfLines={1}>{industryLabel}</Text>
      ) : null}

      {item.address ? (
        <View style={styles.cardRow}>
          <Ionicons name="map-outline" size={13} color="#999" />
          <Text style={styles.cardAddress} numberOfLines={2}>{item.address}</Text>
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        {item.tel ? (
          <View style={styles.cardContact}>
            <Ionicons name="call-outline" size={13} color="#4CAF50" />
            <Text style={styles.cardContactText}>{item.tel}</Text>
          </View>
        ) : null}
        {item.homepage ? (
          <View style={styles.cardContact}>
            <Ionicons name="globe-outline" size={13} color="#2196F3" />
            <Text style={[styles.cardContactText, { color: '#2196F3' }]} numberOfLines={1}>{item.homepage}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

// ============================================================
// 임베드 가능한 기업 디렉토리 콘텐츠 컴포넌트
// (navigation 의존 없음 — NeighborBusinessesScreen에서 인라인 사용)
// ============================================================
export default function CompanyDirectoryContent() {
  const [query, setQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [companies, setCompanies] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const debounceTimer = useRef(null);
  const isSearch = query.trim().length > 0;

  const fetchFirst = useCallback(async (q, area, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const areaParam = area;
      let data;
      if (q.trim()) {
        data = await searchCompanies({ q: q.trim(), area: areaParam, page: 1, per_page: PER_PAGE });
      } else {
        data = await listCompanies({ area: areaParam, page: 1, per_page: PER_PAGE });
      }
      setCompanies(data.items || []);
      setPage(1);
      setTotalPages(data.total_pages || 1);
      setTotal(data.total || 0);
    } catch (e) {
      setError('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      console.error('[CompanyDirectory] fetch error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFirst('', '');
  }, []);

  const handleQueryChange = (text) => {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchFirst(text, selectedArea);
    }, 300);
  };

  const handleAreaChange = (area) => {
    setSelectedArea(area);
    fetchFirst(query, area);
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || page >= totalPages) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const areaParam = selectedArea;
      let data;
      if (isSearch) {
        data = await searchCompanies({ q: query.trim(), area: areaParam, page: nextPage, per_page: PER_PAGE });
      } else {
        data = await listCompanies({ area: areaParam, page: nextPage, per_page: PER_PAGE });
      }
      setCompanies((prev) => [...prev, ...(data.items || [])]);
      setPage(nextPage);
      setTotalPages(data.total_pages || 1);
    } catch (e) {
      console.error('[CompanyDirectory] loadMore error:', e?.message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, page, totalPages, selectedArea, query, isSearch]);

  const onRefresh = useCallback(() => {
    fetchFirst(query, selectedArea, true);
  }, [fetchFirst, query, selectedArea]);

  const handleCardPress = useCallback((company) => {
    setSelectedCompany(company);
    setModalVisible(true);
    try {
      logEvent('company_view', { company_id: String(company.id ?? ''), company_name: company.company ?? '' });
    } catch (_) {}
  }, []);

  const renderItem = useCallback(({ item }) => (
    <CompanyCard item={item} onPress={handleCardPress} />
  ), [handleCardPress]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#1565C0" />
      </View>
    );
  }, [loadingMore]);

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="business-outline" size={60} color="#ccc" />
        <Text style={styles.emptyText}>검색 결과가 없습니다</Text>
        <Text style={styles.emptySubText}>다른 키워드나 지역을 선택해보세요</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 검색바 */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#999" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="회사명·사업내용·업종·주소 통합 검색..."
            placeholderTextColor="#bbb"
            value={query}
            onChangeText={handleQueryChange}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && Platform.OS === 'android' && (
            <TouchableOpacity onPress={() => handleQueryChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#bbb" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.searchHint}>플라스틱 사출, 금형, 물류 등 키워드로 검색 가능</Text>
      </View>

      {/* 지역 필터 라벨 + 칩 */}
      <View style={styles.areaFilterWrap}>
        <View style={styles.areaFilterLabelRow}>
          <Ionicons name="location-outline" size={14} color="#1565C0" />
          <Text style={styles.areaFilterLabel}>지역 선택</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.areaFilterContent}
        >
        {AREAS.map((area) => (
          <TouchableOpacity
            key={area.value || 'all'}
            style={[styles.areaChipBtn, selectedArea === area.value && styles.areaChipBtnActive]}
            onPress={() => handleAreaChange(area.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.areaChipBtnText, selectedArea === area.value && styles.areaChipBtnTextActive]}>
              {area.label}
            </Text>
          </TouchableOpacity>
        ))}
        </ScrollView>
      </View>

      {/* 총 건수 */}
      {!loading && (
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {total > 0 ? `총 ${total.toLocaleString()}개 기업` : ''}
          </Text>
        </View>
      )}

      {/* 로딩 인디케이터 (첫 로드) */}
      {loading && (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color="#1565C0" />
          <Text style={styles.loadingText}>기업 정보 불러오는 중...</Text>
        </View>
      )}

      {/* 에러 */}
      {error && !loading && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#dc3545" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchFirst(query, selectedArea)}>
            <Text style={styles.retryBtnText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 리스트 */}
      {!loading && !error && (
        <FlatList
          data={companies}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1565C0']} tintColor="#1565C0" />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          removeClippedSubviews={true}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      )}

      {/* 상세 모달 */}
      <DetailModal
        company={selectedCompany}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

// ============================================================
// 스타일
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  searchHint: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 6,
    marginLeft: 2,
  },
  areaFilterScroll: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  areaFilterWrap: {
    backgroundColor: '#F8FAFD',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: 10,
    paddingBottom: 4,
  },
  areaFilterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  areaFilterLabel: {
    fontSize: 12,
    color: '#1565C0',
    fontWeight: '600',
  },
  areaFilterContent: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  areaChipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#d0d7e0',
    marginRight: 6,
  },
  areaChipBtnActive: {
    backgroundColor: '#1565C0',
    borderColor: '#1565C0',
  },
  areaChipBtnText: {
    fontSize: 14,
    color: '#1565C0',
    fontWeight: '500',
  },
  areaChipBtnTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  countRow: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  countText: {
    fontSize: 12,
    color: '#888',
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#dc3545',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: '#1565C0',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: FIXED_BOTTOM_HEIGHT + 60,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
  },
  emptySubText: {
    marginTop: 6,
    fontSize: 13,
    color: '#bbb',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardCompany: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1A237E',
    marginRight: 8,
  },
  areaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  areaChipText: {
    fontSize: 11,
    color: '#1565C0',
    fontWeight: '600',
    marginLeft: 3,
  },
  cardDirector: {
    fontSize: 13,
    color: '#555',
    marginBottom: 3,
  },
  cardLabel: {
    color: '#999',
    fontWeight: '400',
  },
  cardIndustry: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 4,
  },
  cardAddress: {
    flex: 1,
    fontSize: 12,
    color: '#888',
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  cardContact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardContactText: {
    fontSize: 12,
    color: '#4CAF50',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#1A237E',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  modalBody: {
    flex: 1,
  },
  modalAreaRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  modalSection: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  modalIcon: {
    marginTop: 2,
    marginRight: 12,
  },
  modalRowContent: {
    flex: 1,
  },
  modalLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  modalValue: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  modalContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  contactIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalContactText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
});
