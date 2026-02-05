import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  useWindowDimensions,
  SafeAreaView,
  Platform,
  Share,
  Linking,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import RenderHtml from 'react-native-render-html';
import { WebView } from 'react-native-webview';
import { Image } from 'expo-image';
import { Ionicons, FontAwesome5, FontAwesome } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import CommentsSection from '../components/commentsSection';
import TranslatedText from '../components/TranslatedText';
import { translateText } from '../services/TranslationService';
import { PopupAd } from '../components/AdBanner';

export default function PostDetailScreen({ route }) {
  const { t, i18n } = useTranslation('menu');
  const { post } = route.params;
  const { width } = useWindowDimensions();
  
  const [translatedContent, setTranslatedContent] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [showPopup, setShowPopup] = useState(true); // 🎯 상세 진입 시 바로 팝업 표시

  const featuredImage = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
  
  // 📤 공유할 URL과 제목 생성
  const shareUrl = post.link || `https://chaovietnam.co.kr/?p=${post.id}`;
  const shareTitle = post.title?.rendered?.replace(/&#[0-9]+;/g, (match) => 
    String.fromCharCode(match.match(/[0-9]+/))
  ) || '씬짜오베트남 기사';
  const shareMessage = `${shareTitle}\n\n${shareUrl}`;

  // 📤 SNS별 공유 처리
  const handleShare = async (platform) => {
    try {
      switch (platform) {
        case 'kakao':
          // 카카오톡 - 일반 공유 시트 사용 (SDK 없이)
          await Share.share({ message: shareMessage, title: shareTitle });
          break;
          
        case 'facebook':
          // 페이스북 웹 공유
          const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
          await Linking.openURL(fbUrl);
          break;
          
        case 'threads':
          // 스레드 앱 열기 시도
          const threadsUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(shareMessage)}`;
          await Linking.openURL(threadsUrl);
          break;
          
        case 'zalo':
          // Zalo 앱으로 공유 시도
          const zaloInstalled = await Linking.canOpenURL('zalo://');
          if (zaloInstalled) {
            await Share.share({ message: shareMessage, title: shareTitle });
          } else {
            Alert.alert('Zalo', t('postDetail.zaloNotInstalled'));
          }
          break;
          
        case 'sms':
          // 문자 메시지
          const smsUrl = Platform.OS === 'ios' 
            ? `sms:&body=${encodeURIComponent(shareMessage)}`
            : `sms:?body=${encodeURIComponent(shareMessage)}`;
          await Linking.openURL(smsUrl);
          break;
          
        case 'more':
        default:
          // 기본 공유 시트
          await Share.share({ 
            message: shareMessage, 
            title: shareTitle,
            url: shareUrl // iOS only
          });
          break;
      }
    } catch (error) {
      console.log('공유 실패:', error);
    }
  };
  
  // 날짜 변환 (KBoard는 RSS 날짜 형식이므로 처리 필요)
  let dateStr = t('postDetail.noDateInfo');
  try {
    if (post.date) {
      const dateObj = new Date(post.date);
      if (!isNaN(dateObj.getTime())) {
        dateStr = dateObj.toLocaleDateString();
      }
    }
  } catch (e) {
    console.log('Date parse error:', e);
  }

  // 🔧 본문에서 첫 번째 이미지 제거 (featuredImage와 중복 방지)
  // 안전하게 content 필드 확인
  let originalContentHtml = post.content?.rendered || post.excerpt || '';
  if (featuredImage && originalContentHtml) {
    // 본문 맨 앞의 공백 제거 후 <img> 또는 <figure> 태그 제거
    originalContentHtml = originalContentHtml.trim()
      .replace(/^(<p>\s*)?<figure[^>]*>[\s\S]*?<\/figure>(\s*<\/p>)?/i, '')
      .replace(/^(<p>\s*)?<img[^>]*\/?>\s*(<\/p>)?/i, '');
  }

  // 🌐 HTML 본문 번역
  useEffect(() => {
    const translateContent = async () => {
      if (i18n.language === 'ko') {
        setTranslatedContent(originalContentHtml);
        return;
      }
      
      if (!originalContentHtml || originalContentHtml.trim() === '') {
        setTranslatedContent(originalContentHtml);
        return;
      }

      setIsTranslating(true);
      try {
        // Google Translate API는 HTML 태그를 보존하면서 텍스트만 번역
        const translated = await translateText(originalContentHtml, i18n.language, 'ko');
        setTranslatedContent(translated);
      } catch (error) {
        console.log('본문 번역 실패:', error);
        setTranslatedContent(originalContentHtml); // 실패 시 원문 표시
      } finally {
        setIsTranslating(false);
      }
    };

    translateContent();
  }, [originalContentHtml, i18n.language]);
  
  const source = {
    html: translatedContent || originalContentHtml
  };

  const tagsStyles = {
    body: {
      color: '#333',
      fontSize: 16,
      lineHeight: 24,
    },
    p: {
      marginBottom: 16,
    },
    img: {
      marginVertical: 10,
    },
    iframe: {
        width: width - 32,
        height: (width - 32) * 0.5625,
    }
  };

  // iframe 커스텀 렌더러 정의
  const renderers = {
    iframe: (props) => {
      const { src, width: contentWidth, height: contentHeight } = props.tnode.attributes;
      return (
        <View style={{ width: width - 32, height: (width - 32) * 0.5625, marginVertical: 10 }}>
          <WebView
            source={{ uri: src }}
            style={{ flex: 1 }}
            allowsFullscreenVideo
            scrollEnabled={false}
          />
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TranslatedText style={styles.title}>
          {post.title.rendered.replace(/&#[0-9]+;/g, (match) => String.fromCharCode(match.match(/[0-9]+/)))}
        </TranslatedText>
        
        <View style={styles.metaInfo}>
          <Text style={styles.date}>{dateStr}</Text>
          <View style={styles.authorContainer}>
            <Ionicons name="person-outline" size={14} color="#999" />
            <Text style={styles.author}>{post._embedded?.author?.[0]?.name || '씬짜오베트남'}</Text>
          </View>
        </View>

        {featuredImage ? (
          <Image
            source={{ uri: featuredImage }}
            style={styles.featuredImage}
            contentFit="cover"
            transition={200}
            cachePolicy="disk"
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <Image
              source={require('../assets/icon.png')}
              style={styles.placeholderLogo}
              contentFit="contain"
              transition={200}
            />
          </View>
        )}

        <View style={styles.content}>
          {isTranslating && (
            <View style={styles.translatingContainer}>
              <ActivityIndicator size="small" color="#FF6B35" />
              <Text style={styles.translatingText}>
                {i18n.language === 'vi' ? 'Đang dịch...' : 'Translating...'}
              </Text>
            </View>
          )}
          <RenderHtml
            contentWidth={width - 32}
            source={source}
            tagsStyles={tagsStyles}
            renderers={renderers}
            enableExperimentalMarginCollapsing={true}
          />
        </View>

        {/* 📤 SNS 공유 섹션 */}
        <View style={styles.shareSection}>
          <Text style={styles.shareTitle}>📤 {t('postDetail.shareTitle')}</Text>
          <View style={styles.shareButtons}>
            {/* 카카오톡 */}
            <TouchableOpacity 
              style={[styles.shareButton, { backgroundColor: '#FEE500' }]}
              onPress={() => handleShare('kakao')}
            >
              <Text style={styles.kakaoIcon}>💬</Text>
            </TouchableOpacity>
            
            {/* 페이스북 */}
            <TouchableOpacity 
              style={[styles.shareButton, { backgroundColor: '#1877F2' }]}
              onPress={() => handleShare('facebook')}
            >
              <FontAwesome name="facebook" size={24} color="#fff" />
            </TouchableOpacity>
            
            {/* 스레드 */}
            <TouchableOpacity 
              style={[styles.shareButton, { backgroundColor: '#000' }]}
              onPress={() => handleShare('threads')}
            >
              <Text style={styles.threadsIcon}>@</Text>
            </TouchableOpacity>
            
            {/* Zalo */}
            <TouchableOpacity 
              style={[styles.shareButton, { backgroundColor: '#0068FF' }]}
              onPress={() => handleShare('zalo')}
            >
              <Text style={styles.zaloIcon}>Z</Text>
            </TouchableOpacity>
            
            {/* 문자 */}
            <TouchableOpacity 
              style={[styles.shareButton, { backgroundColor: '#34C759' }]}
              onPress={() => handleShare('sms')}
            >
              <Ionicons name="chatbubble" size={22} color="#fff" />
            </TouchableOpacity>
            
            {/* 더보기 (기본 공유) */}
            <TouchableOpacity 
              style={[styles.shareButton, { backgroundColor: '#FF6B35' }]}
              onPress={() => handleShare('more')}
            >
              <Ionicons name="share-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <CommentsSection articleId={post.id} />
      </ScrollView>
      
      {/* 🎯 뉴스 상세 진입 시 전면 팝업 광고 (10초 후 자동 닫힘) */}
      <PopupAd 
        visible={showPopup} 
        onClose={() => setShowPopup(false)}
        screen="news"
        autoCloseSeconds={10}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    lineHeight: 32,
    marginBottom: 12,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 12,
  },
  date: {
    fontSize: 14,
    color: '#999',
    marginRight: 16,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  author: {
    fontSize: 14,
    color: '#999',
    marginLeft: 4,
  },
  featuredImage: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    marginBottom: 20,
  },
  placeholderContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#fff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  placeholderLogo: {
    width: 120,
    height: 120,
    opacity: 0.5,
  },
  content: {
    paddingBottom: 20,
  },
  translatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#FFF8F3',
    borderRadius: 8,
  },
  translatingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FF6B35',
  },
  // 📤 공유 섹션 스타일
  shareSection: {
    marginTop: 10,
    marginBottom: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  shareTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  shareButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  shareButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  kakaoIcon: {
    fontSize: 24,
  },
  threadsIcon: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
  },
  zaloIcon: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
  },
});

