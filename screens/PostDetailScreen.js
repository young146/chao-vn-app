import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  useWindowDimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import RenderHtml from 'react-native-render-html';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import CommentsSection from '../components/commentsSection';

export default function PostDetailScreen({ route }) {
  const { post } = route.params;
  const { width } = useWindowDimensions();

  const featuredImage = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
  
  // 날짜 변환 (KBoard는 RSS 날짜 형식이므로 처리 필요)
  let dateStr = '날짜 정보 없음';
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
  let contentHtml = post.content.rendered;
  if (featuredImage) {
    // 본문 맨 앞의 공백 제거 후 <img> 또는 <figure> 태그 제거
    contentHtml = contentHtml.trim()
      .replace(/^(<p>\s*)?<figure[^>]*>[\s\S]*?<\/figure>(\s*<\/p>)?/i, '')
      .replace(/^(<p>\s*)?<img[^>]*\/?>\s*(<\/p>)?/i, '');
  }
  
  const source = {
    html: contentHtml
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>
          {post.title.rendered.replace(/&#[0-9]+;/g, (match) => String.fromCharCode(match.match(/[0-9]+/)))}
        </Text>
        
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
            />
          </View>
        )}

        <View style={styles.content}>
          <RenderHtml
            contentWidth={width - 32}
            source={source}
            tagsStyles={tagsStyles}
            enableExperimentalMarginCollapsing={true}
          />
        </View>

        <CommentsSection articleId={post.id} />
      </ScrollView>
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
    paddingBottom: 40,
  },
});

