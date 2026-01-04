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
import { wordpressApi, MAGAZINE_BASE_URL, BOARD_BASE_URL } from '../services/wordpressApi';

const { width } = Dimensions.get('window');

const SearchHeader = ({ onSearch }) => {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    onSearch(text);
    Keyboard.dismiss();
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
          returnKeyType="search"
        />
        {text.length > 0 && (
          <TouchableOpacity onPress={() => setText('')}>
            <Ionicons name="close-circle" size={20} color="#ccc" />
          </TouchableOpacity>
        )}
      </View>
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

  const getCategoryName = () => {
    if (item.category_name) return item.category_name;
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
            <Ionicons name="image-outline" size={40} color="#ccc" />
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
            <Text style={styles.categoryText}>{getCategoryName()}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function MagazineScreen({ navigation, route }) {
  const { type = 'magazine', categoryId } = route.params || {};
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
          const [slideshowPosts, sectionsData] = await Promise.all([
            wordpressApi.getSlideshowPosts(),
            wordpressApi.getHomeSections()
          ]);
          setSlides(slideshowPosts);
          setHomeSections(sectionsData);
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
      } else if (categoryId) {
        // 날짜 필터 적용 (뉴스 탭 전용)
        const dateStr = date ? date.toISOString().split('T')[0] : null;
        newPosts = await wordpressApi.getPostsByCategory(categoryId, pageNum, 10, dateStr);
      } else {
        newPosts = await wordpressApi.getMagazinePosts(pageNum);
      }
      
      if (newPosts.length < 10) {
        setHasMore(false);
      }

      if (pageNum === 1) {
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }
    } catch (error) {
      console.error('Fetch posts error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [type, categoryId]);

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
      <FlatList
        data={type === 'home' && !searchQuery ? [] : posts}
        renderItem={({ item }) => <MagazineCard item={item} onPress={handlePostPress} type={type} />}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <SearchHeader onSearch={handleSearch} />
            
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
                
                {homeSections.map((section) => (
                  <View key={section.id} style={styles.homeSection}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>{section.name}</Text>
                      <TouchableOpacity onPress={() => navigation.navigate(type === 'home' ? 'HomeStack' : route.name, { screen: '홈메인', params: { categoryId: section.id, type: 'category' } })}>
                        <Text style={styles.seeMore}>더보기 ></Text>
                      </TouchableOpacity>
                    </View>
                    <FlatList
                      data={section.posts}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyExtractor={(item) => `section-${section.id}-${item.id}`}
                      renderItem={({ item }) => (
                        <TouchableOpacity 
                          style={styles.sectionCard} 
                          onPress={() => handlePostPress(item)}
                        >
                          <Image
                            source={{ uri: item._embedded?.['wp:featuredmedia']?.[0]?.source_url }}
                            style={styles.sectionCardImage}
                            contentFit="cover"
                          />
                          <Text style={styles.sectionCardTitle} numberOfLines={2}>
                            {item.title.rendered.replace(/&#[0-9]+;/g, (match) => String.fromCharCode(match.match(/[0-9]+/)))}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B35']} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={() => 
          loadingMore ? (
            <ActivityIndicator style={{ marginVertical: 20 }} color="#FF6B35" />
          ) : null
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>게시글이 없습니다.</Text>
            </View>
          )
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
    marginBottom: 20,
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
});

