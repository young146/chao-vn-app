import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Dimensions,
  TextInput,
  Keyboard,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { wordpressApi, MAGAZINE_BASE_URL, BOARD_BASE_URL, getHomeDataCached } from '../services/wordpressApi';
import AdBanner, { SectionAdBanner, InlineAdBanner } from '../components/AdBanner';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_HISTORY = 5;

const SearchHeader = ({ onSearch, onClear, isSearching }) => {
  const [text, setText] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // 검색 히스토리 로드
  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    try {
      const history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (history) {
        setSearchHistory(JSON.parse(history));
      }
    } catch (error) {
      console.log('검색 히스토리 로드 실패:', error);
    }
  };

  const saveSearchHistory = async (newHistory) => {
    try {
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
      setSearchHistory(newHistory);
    } catch (error) {
      console.log('검색 히스토리 저장 실패:', error);
    }
  };

  const handleSubmit = () => {
    if (text.trim()) {
      // 검색 히스토리에 추가 (중복 제거, 최대 5개)
      const newHistory = [text.trim(), ...searchHistory.filter(h => h !== text.trim())].slice(0, MAX_HISTORY);
      saveSearchHistory(newHistory);
      onSearch(text.trim());
      setShowHistory(false);
    }
    Keyboard.dismiss();
  };

  const handleHistoryClick = (query) => {
    setText(query);
    onSearch(query);
    setShowHistory(false);
    Keyboard.dismiss();
  };

  const removeHistoryItem = async (query) => {
    const newHistory = searchHistory.filter(h => h !== query);
    saveSearchHistory(newHistory);
  };

  // 검색 취소 및 홈으로 복귀
  const handleClear = () => {
    setText('');
    setShowHistory(false);
    if (onClear) {
      onClear();
    }
  };

  return (
    <View style={styles.searchHeaderContainer}>
      <View style={styles.searchBarWrapper}>
        <Ionicons name="search-outline" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchTextInput}
          placeholder="궁금한 소식을 검색해보세요"
          placeholderTextColor="#999"
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSubmit}
          onFocus={() => setShowHistory(true)}
          returnKeyType="search"
        />
        {/* 검색어 입력 중이거나 검색 결과 표시 중일 때 X 버튼 표시 */}
        {(text.length > 0 || isSearching) && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={22} color="#FF6B35" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* 🔍 최근 검색어 */}
      {showHistory && searchHistory.length > 0 && !isSearching && (
        <View style={styles.historyContainer}>
          <Text style={styles.historyTitle}>최근 검색어</Text>
          {searchHistory.map((query, index) => (
            <View key={index} style={styles.historyItem}>
              <TouchableOpacity 
                style={styles.historyTextWrapper}
                onPress={() => handleHistoryClick(query)}
              >
                <Ionicons name="time-outline" size={16} color="#999" />
                <Text style={styles.historyText}>{query}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeHistoryItem(query)}>
                <Ionicons name="close" size={18} color="#ccc" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const HomeSlider = ({ posts, onPress }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (!posts || posts.length <= 1) return;

    const interval = setInterval(() => {
      const nextIndex = (activeIndex + 1) % posts.length;
      setActiveIndex(nextIndex);
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
    }, 3000); // 3초 간격

    return () => clearInterval(interval);
  }, [activeIndex, posts]);

  if (!posts || posts.length === 0) return null;

  return (
    <View style={styles.sliderContainer}>
      <FlatList
        ref={flatListRef}
        data={posts}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / (width - 32));
          setActiveIndex(newIndex);
        }}
        keyExtractor={(item) => `slide-${item.id}`}
        renderItem={({ item }) => {
          const featuredImage = item._embedded?.['wp:featuredmedia']?.[0]?.source_url;
          return (
            <TouchableOpacity 
              activeOpacity={0.9} 
              style={styles.slide} 
              onPress={() => onPress(item)}
            >
              <Image
                source={{ uri: featuredImage }}
                style={styles.slideImage}
                contentFit="cover"
              />
              <View style={styles.slideOverlay}>
                <Text style={styles.slideTitle} numberOfLines={2}>
                  {item.title.rendered.replace(/&#[0-9]+;/g, (match) => String.fromCharCode(match.match(/[0-9]+/)))}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
      <View style={styles.pagination}>
        {posts.map((_, index) => (
          <View 
            key={index} 
            style={[styles.paginationDot, activeIndex === index && styles.paginationDotActive]} 
          />
        ))}
      </View>
    </View>
  );
};

const MagazineCard = ({ item, onPress, type }) => {
  // WordPress API에서 특성 이미지 가져오기 (_embed: 1 필요)
  const featuredImage = item._embedded?.['wp:featuredmedia']?.[0]?.source_url;
  
  // 날짜 변환 (KBoard는 RSS 날짜 형식이므로 처리 필요)
  let dateStr = '날짜 정보 없음';
  try {
    if (item.date) {
      const dateObj = new Date(item.date);
      if (!isNaN(dateObj.getTime())) {
        dateStr = dateObj.toLocaleDateString();
      }
    }
  } catch (e) {
    console.log('Date parse error:', e);
  }

  // 카테고리와 출처 추출 (WordPress meta 필드 사용)
  const getCategoryAndSource = () => {
    // 영어 카테고리 → 한글 변환 (12개 카테고리)
    const categoryMap = {
      'Society': '사회',
      'Economy': '경제',
      'Culture': '문화',
      'Politics': '정치',
      'International': '국제',
      'Korea-Vietnam': '한-베',
      'Community': '교민',
      'Travel': '여행',
      'Health': '건강',
      'Food': '음식',
      'Other': '기타',
      // 추가 카테고리
      'Sports': '스포츠',
      'Technology': '기술',
      'Education': '교육',
      'Entertainment': '연예',
      'Business': '비즈니스',
      'World': '국제',
      'Life': '생활',
      'Pet': '펫',
      'Weather': '날씨',
      'Opinion': '오피니언',
      'Real Estate': '부동산',
      'Lifestyle': '라이프',
      'Wellness': '웰니스',
      'Recipe': '레시피',
    };
    
    // 1. meta 필드에서 카테고리와 출처 가져오기
    const newsCategory = item.meta?.news_category || '';
    const newsSource = item.meta?.news_source || '';
    
    // 카테고리 한글 변환
    const category = categoryMap[newsCategory] || newsCategory;
    
    // 2. 결과 조합
    if (category && newsSource) {
      return `${category} / ${newsSource}`;
    } else if (category) {
      return category;
    } else if (newsSource) {
      return newsSource;
    }
    
    // 3. meta가 없으면 기존 방식 시도
    if (item.category_name) {
      return item.category_name;
    }
    
    // 기본값
    switch(type) {
      case 'news': return '뉴스';
      case 'board': return '게시판';
      default: return '매거진';
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(item)}>
      <View style={styles.imageContainer}>
        {featuredImage ? (
          <Image
            source={{ uri: featuredImage }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            cachePolicy="disk"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Image
              source={require('../assets/icon.png')}
              style={styles.placeholderLogo}
              contentFit="contain"
            />
          </View>
        )}
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title.rendered.replace(/&#[0-9]+;/g, (match) => String.fromCharCode(match.match(/[0-9]+/)))}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.date}>{dateStr}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{getCategoryAndSource()}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function MagazineScreen({ navigation, route }) {
  const { type = 'magazine', categoryId, resetSearch } = route.params || {};
  const [posts, setPosts] = useState([]);
  const [slides, setSlides] = useState([]);
  const [homeSections, setHomeSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 날짜 선택 관련 state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isFilteredByDate, setIsFilteredByDate] = useState(false);

  const fetchPosts = async (pageNum = 1, isRefresh = false, query = searchQuery, date = null) => {
    try {
      if (pageNum === 1) {
        if (!isRefresh) setLoading(true);
        // 홈 화면이고 검색어가 없을 때만 슬라이더 및 섹션 데이터 가져옴
        if (type === 'home' && !query) {
          // 🚀 최적화: getHomeDataCached()를 1번만 호출 (중복 호출 제거)
          const homeData = await getHomeDataCached(isRefresh);
          setSlides(homeData.slideshowPosts || []);
          setHomeSections(homeData.homeSections || []);
          setLoading(false);
          return;
        }
      } else {
        if (type === 'home' && !query) return;
        setLoadingMore(true);
      }

      let newPosts = [];
      if (query) {
        newPosts = await wordpressApi.searchPosts(query, pageNum);
      } else if (type === 'board') {
        newPosts = await wordpressApi.getBoardPosts(pageNum);
      } else if (categoryId || type === 'news') {
        // 뉴스 탭: 날짜 필터가 없으면 오늘 날짜로 자동 필터링
        let filterDate = date;
        if (type === 'news' && !date && !isFilteredByDate) {
          filterDate = new Date(); // 오늘 날짜
        }
        const dateStr = filterDate ? filterDate.toISOString().split('T')[0] : null;
        newPosts = await wordpressApi.getPostsByCategory(categoryId, pageNum, 10, dateStr);
      } else {
        newPosts = await wordpressApi.getMagazinePosts(pageNum);
      }
      
      if (newPosts.length < 10) {
        setHasMore(false);
      }
      
      // 뉴스 탭: 오늘 날짜 뉴스가 더 이상 없으면 종료
      if (type === 'news' && newPosts.length === 0 && pageNum === 1) {
        setHasMore(false);
      }

      if (pageNum === 1) {
        setPosts(newPosts);
      } else {
        // 중복 제거: 기존 posts에 없는 항목만 추가
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNewPosts = newPosts.filter(p => !existingIds.has(p.id));
          return [...prev, ...uniqueNewPosts];
        });
      }
    } catch (error) {
      console.error('Fetch posts error:', error);
      // 🔧 에러 시 무한 루프 방지
      setHasMore(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [type, categoryId]);

  // 🔙 홈 탭을 누르면 검색 초기화
  useEffect(() => {
    if (resetSearch && type === 'home') {
      setSearchQuery('');
      setPage(1);
      setHasMore(true);
      fetchPosts(1, false, '');
    }
  }, [resetSearch]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    fetchPosts(1, true, searchQuery, isFilteredByDate ? selectedDate : null);
  }, [type, categoryId, searchQuery, selectedDate, isFilteredByDate]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    setIsFilteredByDate(false); // 검색 시 날짜 필터 해제
    setPage(1);
    setHasMore(true);
    fetchPosts(1, false, query);
  };

  // 🔙 검색 취소 및 홈으로 복귀
  const handleClearSearch = () => {
    setSearchQuery('');
    setPage(1);
    setHasMore(true);
    fetchPosts(1, false, ''); // 홈 화면 데이터 다시 로드
  };

  const onDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      setIsFilteredByDate(true);
      setSearchQuery(''); // 날짜 선택 시 검색어 해제
      setPage(1);
      setHasMore(true);
      fetchPosts(1, false, '', date);
    }
  };

  const resetDateFilter = () => {
    setIsFilteredByDate(false);
    setSelectedDate(new Date());
    setPage(1);
    setHasMore(true);
    fetchPosts(1, false, searchQuery, null);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPosts(nextPage);
    }
  };

  const handlePostPress = (post) => {
    navigation.navigate('PostDetail', { 
      post, 
      baseUrl: type === 'board' ? BOARD_BASE_URL : MAGAZINE_BASE_URL 
    });
  };

  if (loading && page === 1) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <SearchHeader 
        onSearch={handleSearch} 
        onClear={handleClearSearch}
        isSearching={searchQuery.length > 0}
      />
      
      <FlatList
        data={type === 'home' && !searchQuery ? [] : posts}
        renderItem={({ item, index }) => (
          <View>
            <MagazineCard item={item} onPress={handlePostPress} type={type} />
            {/* 뉴스/게시판: 4개 기사마다 광고 삽입 (4, 8, 12...) */}
            {(type === 'news' || type === 'board') && (index + 1) % 4 === 0 && (
              <InlineAdBanner />
            )}
          </View>
        )}
        keyExtractor={(item, index) => {
          // 고유 키 생성: id가 있으면 사용, 없으면 index와 link 조합
          if (item.id) {
            return item.id.toString();
          }
          // link가 있으면 link + index 조합 사용
          if (item.link) {
            return `item-${item.link}-${index}`;
          }
          return `item-${index}`;
        }}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {/* 🔥 메인 헤더 광고 */}
            <AdBanner style={{ marginHorizontal: 16, marginBottom: 8, borderRadius: 8 }} />

            {type === 'news' && (
              <View style={styles.dateFilterContainer}>
                <TouchableOpacity 
                  style={[styles.dateButton, isFilteredByDate && styles.dateButtonActive]} 
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color={isFilteredByDate ? "#fff" : "#FF6B35"} />
                  <Text style={[styles.dateButtonText, isFilteredByDate && styles.dateButtonTextActive]}>
                    {isFilteredByDate ? selectedDate.toLocaleDateString() : '날짜별 뉴스 보기'}
                  </Text>
                </TouchableOpacity>
                {isFilteredByDate && (
                  <TouchableOpacity style={styles.resetButton} onPress={resetDateFilter}>
                    <Ionicons name="refresh-circle" size={24} color="#999" />
                  </TouchableOpacity>
                )}
                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                    maximumDate={new Date()}
                  />
                )}
              </View>
            )}

            {type === 'home' && !searchQuery && (
              <View>
                {slides.length > 0 && (
                  <HomeSlider posts={slides} onPress={handlePostPress} />
                )}
                
                {homeSections.map((section, sectionIndex) => (
                  <View key={section.id}>
                    {/* 🔥 각 섹션 위에 광고 배치 */}
                    <SectionAdBanner />
                    
                    <View style={styles.homeSection}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>{section.name}</Text>
                      <TouchableOpacity onPress={() => navigation.navigate('홈', { screen: '홈메인', params: { categoryId: section.id, type: 'category' } })}>
                        <Text style={styles.seeMore}>더보기 ></Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.gridContainer}>
                      {[...Array(4)].map((_, index) => {
                        const post = section.posts[index];
                        return (
                          <TouchableOpacity
                            key={`section-${section.id}-${index}`}
                            style={styles.gridCard}
                            onPress={() => post && handlePostPress(post)}
                            activeOpacity={post ? 0.7 : 1}
                          >
                            {post ? (
                              <>
                                <Image
                                  source={{ uri: post._embedded?.['wp:featuredmedia']?.[0]?.source_url }}
                                  style={styles.gridCardImage}
                                  contentFit="cover"
                                />
                                <Text style={styles.gridCardTitle} numberOfLines={2}>
                                  {post.title.rendered.replace(/&#[0-9]+;/g, (match) => String.fromCharCode(match.match(/[0-9]+/)))}
                                </Text>
                              </>
                            ) : (
                              <View style={styles.emptyCard}>
                                <View style={styles.emptyCardPlaceholder} />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
            {searchQuery.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>'{searchQuery}' 검색 결과</Text>
              </View>
            )}
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B35']} tintColor="#FF6B35" />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={() => {
          if (loadingMore) {
            return <ActivityIndicator style={{ marginVertical: 20 }} color="#FF6B35" />;
          }
          // 뉴스 탭에서 더 이상 뉴스가 없을 때 마지막 멘트 표시
          if (type === 'news' && !hasMore && posts.length > 0) {
            return (
              <View style={styles.endMessageContainer}>
                <Text style={styles.endMessageText}>
                  ✨ 이상, 씬짜오베트남에서 뽑은 오늘의 베트남 뉴스입니다 ✨
                </Text>
                <Text style={styles.endMessageSubText}>
                  지난 뉴스는 상단의 '날짜별 뉴스 보기'를 이용해주세요
                </Text>
              </View>
            );
          }
          return null;
        }}
        ListEmptyComponent={
          !loading && searchQuery.length > 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>검색 결과가 없습니다</Text>
              <Text style={styles.emptySubtext}>다른 키워드로 검색해보세요</Text>
            </View>
          ) : !loading && type !== 'home' && posts.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>콘텐츠를 준비 중입니다</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  listContent: {
    padding: 16,
  },
  searchHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#f8f9fa',
    zIndex: 10,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 15,
    height: 50,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  // 🔍 검색 히스토리 스타일
  historyContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyTitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    fontWeight: '600',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  historyTextWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 8,
  },
  dateFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF6B35',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  dateButtonActive: {
    backgroundColor: '#FF6B35',
  },
  dateButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
  },
  dateButtonTextActive: {
    color: '#fff',
  },
  resetButton: {
    marginLeft: 10,
  },
  sliderContainer: {
    width: width - 32,
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#eee',
    position: 'relative',
  },
  slide: {
    width: width - 32,
    height: 220,
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  slideOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 15,
  },
  slideTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  pagination: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    alignSelf: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#fff',
    width: 20,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
    paddingLeft: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  seeMore: {
    fontSize: 14,
    color: '#999',
  },
  homeSection: {
    marginBottom: 30,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  gridCard: {
    width: '48%',
    marginBottom: 16,
  },
  gridCardImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#eee',
  },
  gridCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    lineHeight: 18,
    minHeight: 36,
  },
  emptyCard: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCardPlaceholder: {
    width: '80%',
    height: '60%',
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    opacity: 0.5,
  },
  // 기존 가로 스크롤용 스타일 유지 (호환성)
  sectionCard: {
    width: 160,
    marginRight: 15,
  },
  sectionCardImage: {
    width: 160,
    height: 100,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#eee',
  },
  sectionCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  imageContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#eee',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff', // 기본 로고가 잘 보이도록 흰색 배경
  },
  placeholderLogo: {
    width: 100,
    height: 100,
    opacity: 0.6,
  },
  contentContainer: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    lineHeight: 24,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 13,
    color: '#999',
  },
  categoryBadge: {
    backgroundColor: '#FFF0E6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 11,
    color: '#FF6B35',
    fontWeight: '600',
  },
  endMessageContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FFF8F5',
    marginHorizontal: 16,
    marginVertical: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE0D0',
  },
  endMessageText: {
    fontSize: 15,
    color: '#FF6B35',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  endMessageSubText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
  },
});

