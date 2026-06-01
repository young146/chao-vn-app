import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as wordpressApi from '../services/wordpressApi';

const { width, height } = Dimensions.get('window');

const SectionNewsModal = ({ isVisible, onClose, sectionKey, sectionTitle, categoryId, navigation }) => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (isVisible && sectionKey) {
      loadNews(1);
    } else {
      // 모달이 닫히면 초기화
      setNews([]);
      setCurrentPage(1);
      setHasMore(false);
    }
  }, [isVisible, sectionKey]);

  const loadNews = async (page = 1) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const result = await wordpressApi.getSectionNews(sectionKey, categoryId, page);
      
      if (page === 1) {
        setNews(result.posts);
      } else {
        setNews(prev => [...prev, ...result.posts]);
      }
      
      setHasMore(result.hasMore);
      setCurrentPage(page);
    } catch (error) {
      console.error('Failed to load section news:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadNews(currentPage + 1);
    }
  };

  const handleNewsPress = async (item) => {
    if (!navigation || !item?.id || opening) {
      return;
    }
    // section-news 응답은 요약 데이터만 담겨 본문(content)이 없으므로,
    // 상세 화면(PostDetail)이 기대하는 원본 WP post 를 id 로 받아와 넘긴다.
    setOpening(true);
    try {
      const post = await wordpressApi.wordpressApi.getPostDetail(
        wordpressApi.MAGAZINE_BASE_URL,
        item.id
      );
      onClose();
      navigation.navigate('PostDetail', {
        post,
        baseUrl: wordpressApi.MAGAZINE_BASE_URL,
      });
    } catch (error) {
      console.error('Failed to open news detail:', error);
      onClose();
    } finally {
      setOpening(false);
    }
  };

  const renderNewsItem = ({ item }) => (
    <TouchableOpacity
      style={styles.newsCard}
      onPress={() => handleNewsPress(item)}
      activeOpacity={0.7}
      disabled={opening}
    >
      {item.thumbnail && (
        <Image
          source={{ uri: item.thumbnail }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      )}
      <View style={styles.newsContent}>
        <Text style={styles.newsTitle} numberOfLines={2}>
          {typeof item.title === 'string' ? item.title : item.title?.rendered || '제목 없음'}
        </Text>
        {item.excerpt && (
          <Text style={styles.newsExcerpt} numberOfLines={2}>
            {typeof item.excerpt === 'string' ? item.excerpt : item.excerpt?.rendered || ''}
          </Text>
        )}
        <View style={styles.newsMeta}>
          {item.meta?.news_category && (
            <Text style={styles.newsCategory}>{item.meta.news_category}</Text>
          )}
          {item.dateFormatted && (
            <Text style={styles.newsDate}>{item.dateFormatted}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* 헤더 */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{sectionTitle || '뉴스'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          {/* 뉴스 리스트 */}
          <FlatList
            data={news}
            renderItem={renderNewsItem}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator size="large" color="#d97706" style={styles.loader} />
              ) : (
                <Text style={styles.emptyText}>뉴스가 없습니다</Text>
              )
            }
            ListFooterComponent={
              hasMore && !loading ? (
                <TouchableOpacity onPress={handleLoadMore} style={styles.loadMoreButton}>
                  <Text style={styles.loadMoreText}>더 보기</Text>
                </TouchableOpacity>
              ) : loading && news.length > 0 ? (
                <ActivityIndicator size="small" color="#d97706" style={styles.footerLoader} />
              ) : null
            }
          />

          {opening && (
            <View style={styles.openingOverlay}>
              <ActivityIndicator size="large" color="#d97706" />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: height * 0.7,
    maxHeight: height * 0.9,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  listContent: {
    padding: 16,
  },
  newsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  newsContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  newsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  newsExcerpt: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  newsMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newsCategory: {
    fontSize: 11,
    color: '#d97706',
    fontWeight: '600',
  },
  newsDate: {
    fontSize: 11,
    color: '#999',
  },
  loader: {
    marginTop: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 40,
  },
  loadMoreButton: {
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  loadMoreText: {
    color: '#d97706',
    fontWeight: '600',
    fontSize: 14,
  },
  footerLoader: {
    marginVertical: 16,
  },
  openingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});

export default SectionNewsModal;
