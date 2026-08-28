import { getSectionLabel } from '../lib/newsSections';
import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
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
  KeyboardAvoidingView,
} from 'react-native';
import RenderHtml from 'react-native-render-html';
import { useHeaderHeight } from '@react-navigation/elements';
import { WebView } from 'react-native-webview';
import { Image } from 'expo-image';
import ImageViewing from 'react-native-image-viewing';
import { Ionicons, FontAwesome5, FontAwesome } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import CommentsSection from '../components/commentsSection';
import TranslatedText from '../components/TranslatedText';
import { translateText } from '../services/TranslationService';
import { DetailAdBanner, PopupAd, ScrollBottomBanner } from '../components/AdBanner';
import { logMagazineOpen, logNewsRead, logShareClicked } from '../lib/analytics';

// 뉴스 카테고리 ID (chaovietnam.co.kr WordPress 기준)
const NEWS_CATEGORY_ID = 31;

export default function PostDetailScreen({ route, navigation }) {
  const { t, i18n } = useTranslation('menu');
  const { t: tHome } = useTranslation('home');
  const { post } = route.params;
  const { width } = useWindowDimensions();
  // 키보드를 피해 올릴 때, 네비게이션 헤더 높이만큼은 빼고 계산해야 한다
  const headerHeight = useHeaderHeight();

  // 빵조각(탐색경로) — 웹의 「뉴스 > 데일리 뉴스 > 경제」와 같은 줄을 앱에도 보여준다.
  //
  // 근거는 목록이 이미 넘겨준 데이터뿐이다(추가 호출 없음):
  //   post.categoryKey / post.meta.news_category = 'Economy' 같은 분류 값
  // 매거진 글에는 그 값이 없으므로 아무것도 그리지 않는다 — 없는 경로를 지어내지 않는다.
  const breadcrumb = useMemo(() => {
    const raw = post?.categoryKey || post?.meta?.news_category || '';
    const label = getSectionLabel(raw, tHome);
    if (!label) return [];
    return [t('postDetail.breadcrumbNews'), label];
  }, [post?.categoryKey, post?.meta?.news_category, t, tHome]);

  // 🔍 [측정 인프라] 진입 시 한 번만 이벤트 발생 (글이 바뀌면 재발생)
  //
  // 2026-08-06 수정 (측정 결함 4-F). 두 가지가 틀려 있었다:
  //  ① 뉴스/매거진 구분을 post.categories 로 추측했는데, **뉴스 목록 응답에는
  //     categories 가 없다** → 항상 빈 배열 → 뉴스 열람이 전부 '매거진 열람'으로 찍혔다.
  //     추측 대신 **띄운 쪽이 알려준다**(contentType). 목록 화면은 자기가 뉴스인지 안다.
  //  ② 집계 id 로 post.id 를 썼는데 뉴스에서는 그게 화면용 키('news-economy-12345-0')라
  //     글 단위 집계가 불가능했다 → 실제 글 번호(postId)를 쓴다.
  useEffect(() => {
    // 글 번호를 모르면 아예 안 찍는다. 화면용 키로 찍으면 지표가 오염되고,
    // 오염된 지표는 없는 것보다 나쁘다(있는 줄 알고 판단하게 되므로).
    const wpId = post?.postId ?? (typeof post?.id === 'number' ? post.id : null);
    if (!wpId) return;

    const title = post.title?.rendered?.replace(/<[^>]+>/g, '') ?? '';
    const declared = route.params?.contentType; // 'news' | 'magazine'
    const isNews = declared
      ? declared === 'news'
      // 구버전 화면에서 넘어온 경우의 대비책(예전 방식)
      : (Array.isArray(post.categories) ? post.categories : []).includes(NEWS_CATEGORY_ID);

    if (isNews) {
      logNewsRead(wpId, title, 'app');
    } else {
      logMagazineOpen(wpId, title);
    }
  }, [post?.postId, post?.id, route.params?.contentType]);

  const [translatedContent, setTranslatedContent] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  // 목록이 본문을 안 실어 보낸 경우(매거진 홈) 이 화면에서 그 기사 하나만 받아온다.
  const [fetchedHtml, setFetchedHtml] = useState('');
  const [isLoadingBody, setIsLoadingBody] = useState(false);
  const [showPopup, setShowPopup] = useState(true); // 🎯 상세 진입 시 바로 팝업 표시
  const [isImageViewVisible, setIsImageViewVisible] = useState(false); // 🔍 이미지 확대 뷰어

  const featuredImage = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;

  // 📤 공유할 URL과 제목 생성
  const shareUrl = post.link || `https://chaovietnam.co.kr/?p=${post.id}`;
  const shareTitle = post.title?.rendered?.replace(/&#[0-9]+;/g, (match) =>
    String.fromCharCode(match.match(/[0-9]+/))
  ) || '씬짜오베트남 기사';
  const shareMessage = `${shareTitle}\n\n${shareUrl}`;

  // 📤 SNS별 공유 처리
  const handleShare = async (platform) => {
    // 🔍 [측정 인프라] 어느 콘텐츠가 어디로 공유되는지 추적
    logShareClicked(`post:${platform}`, post?.id);
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

  // 📤 헤더 우측 공유 버튼 (다른 상세 화면들과 일관성 유지)
  useLayoutEffect(() => {
    if (!navigation) return;
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => handleShare('more')} style={{ marginRight: 16 }}>
          <Ionicons name="share-social-outline" size={24} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, shareUrl, shareTitle]);

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

  // 📄 본문 확보
  // 매거진 목록(홈 섹션)은 데이터를 가볍게 유지하려고 본문을 빼고 받는다 — 안 그러면
  // 읽지도 않을 기사 36건의 본문 전체를 매번 미리 받게 된다(1.3MB, 캐시 0.78MB).
  // 그래서 본문이 없으면 여기서 그 기사 하나만 받아온다. 뉴스처럼 목록이 본문을 이미
  // 실어 보낸 경우에는 네트워크를 타지 않는다.
  useEffect(() => {
    if (post.content?.rendered) return;
    // 목록에서 id 는 화면용 키로 덮어써져 있다("sec-32-12345-0") → 원본 번호는 postId
    const wpId = post.postId || (typeof post.id === 'number' ? post.id : null);
    if (!wpId) return;

    let alive = true;
    setIsLoadingBody(true);
    const base = route.params?.baseUrl || 'https://chaovietnam.co.kr/wp-json/wp/v2';
    fetch(`${base}/posts/${wpId}?_fields=content`)
      .then((r) => r.json())
      .then((d) => { if (alive) setFetchedHtml(d?.content?.rendered || ''); })
      .catch((e) => { console.log('본문 로드 실패:', e?.message); })
      .finally(() => { if (alive) setIsLoadingBody(false); });

    return () => { alive = false; };
  }, [post?.postId, post?.id]);

  // excerpt 는 WordPress 에서 {rendered} 객체로 온다 — 문자열로 확정해 둔다.
  // (객체가 그대로 흘러가면 아래 .trim() 에서 터진다)
  const excerptHtml =
    post.excerpt?.rendered || (typeof post.excerpt === 'string' ? post.excerpt : '');

  // 🔧 본문에서 첫 번째 이미지 제거 (featuredImage와 중복 방지)
  let originalContentHtml = post.content?.rendered || fetchedHtml || excerptHtml || '';
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

  // 클래스별 스타일 — 본문 HTML 의 class 를 보고 앱이 직접 칠한다.
  //
  // 왜 인라인 style 로 안 하나 (2026-08-08 사장님 지적으로 규명):
  //   본문에는 이미 인라인 style 이 붙어 있는데 **앱에서는 적용되지 않는다**.
  //   제휴 상자가 테두리·배경 없이 맨글자로 나와 본문으로 오해되고,
  //   편집부 표기도 주홍색 지정이 무시돼 검정으로 나왔다.
  //   인라인 style 은 CSS 문자열을 해석해야 하지만, classesStyles 는
  //   **RN 스타일 객체를 그대로 받으므로** 해석 단계가 없다 — 확실하게 적용된다.
  //   웹의 인라인 style 은 그대로 두므로 웹 모양은 안 바뀐다.
  const classesStyles = {
    // 기사 하단 제휴 추천 상자 — "본문이 아니라 광고"임이 한눈에 보여야 한다
    'chaovn-aff': {
      marginTop: 24,
      marginBottom: 8,
      padding: 16,
      borderWidth: 1,
      borderColor: '#f0e6da',
      borderRadius: 12,
      backgroundColor: '#fffaf5',
    },
    'chaovn-aff-title': { fontSize: 15, fontWeight: '700', color: '#c2410c', marginBottom: 3 },
    'chaovn-aff-sub':   { fontSize: 12, color: '#9ca3af', marginBottom: 11 },
    'chaovn-aff-note':  { fontSize: 11, color: '#b3b3b3', marginTop: 11 },
    'chaovn-aff-btn': {
      color: '#111827',
      fontSize: 14,
      fontWeight: '600',
      textDecorationLine: 'none',
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderRadius: 22,
      paddingVertical: 9,
      paddingHorizontal: 15,
      marginRight: 8,
      marginVertical: 5,
    },
    // 출처 상자 (출처/날짜/원문보기) 와 그 안의 편집부 표기
    'news-source-header': {
      marginBottom: 16,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    'news-source-line': { fontSize: 13, color: '#888', marginBottom: 4 },
    'chaovn-editorial-line': { color: '#ea580c', fontSize: 13, fontWeight: '700', marginBottom: 6 },
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
      {/* ⌨️ 댓글 입력창이 키보드에 가려지던 문제 (2026-08-28).
          안드로이드는 app.json 의 softwareKeyboardLayoutMode="pan" 이 화면을 통째로
          밀어 올려 줘서 멀쩡했다. **iOS 에는 그런 자동 처리가 없다** — 댓글을 쓰려고
          입력창을 누르면 키보드가 그 위를 덮어, 자기가 무엇을 쓰는지 보이지 않았다.
          안드로이드에서는 아예 보이지 않는 종류의 결함이라 오래 몰랐다.
          그래서 iOS 에서만 켠다 — 안드로이드에 또 얹으면 두 번 밀려 어색해진다. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 빵조각(탐색경로) — 웹과 같은 자리를 잡아준다.
            분류를 모르는 글(매거진 등)에서는 아무것도 안 그린다 — 빈 줄이 더 나쁘다.

            ⚠️ View 를 flexDirection:'row' + flexWrap 으로 짜지 않는다.
            처음에 그렇게 만들었더니 **안드로이드에는 나오는데 iOS 에서는 안 보였다**
            (2026-08-08 사장님 확인). 줄바꿈 계산이 두 플랫폼에서 달라서
            칸 크기가 0 으로 접힐 수 있다.
            글자 한 줄은 중첩 <Text> 로 그리는 게 정답이다 — 줄바꿈·정렬을
            RN 이 아니라 **글자 조판기**가 처리하므로 두 플랫폼이 똑같이 나온다. */}
        {breadcrumb.length > 0 && (
          <Text style={styles.breadcrumb} numberOfLines={1}>
            {breadcrumb.map((crumb, i) => [
              i > 0 ? (
                <Text key={`bcs-${i}`} style={styles.breadcrumbSep}>{'  ›  '}</Text>
              ) : null,
              <Text
                key={`bc-${i}`}
                style={i === breadcrumb.length - 1 ? styles.breadcrumbLast : styles.breadcrumbText}
              >
                {crumb}
              </Text>,
            ])}
          </Text>
        )}

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
          <>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setIsImageViewVisible(true)}
            >
              <Image
                source={{ uri: featuredImage }}
                style={styles.featuredImage}
                contentFit="cover"
                transition={200}
                cachePolicy="disk"
              />
            </TouchableOpacity>
            <ImageViewing
              images={[{ uri: featuredImage }]}
              imageIndex={0}
              visible={isImageViewVisible}
              onRequestClose={() => setIsImageViewVisible(false)}
            />
          </>
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

        {/* 본문 상단 광고 (통합센터: 앱 / 헤드 / 매거진 상세) */}
        <DetailAdBanner position="top" screen="news" />

        <View style={styles.content}>
          {isLoadingBody && (
            <View style={styles.translatingContainer}>
              <ActivityIndicator size="small" color="#FF6B35" />
              <Text style={styles.translatingText}>
                {i18n.language === 'ko' ? '본문 불러오는 중...' : 'Loading...'}
              </Text>
            </View>
          )}
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
            classesStyles={classesStyles}
            renderers={renderers}
            enableExperimentalMarginCollapsing={true}
          />
        </View>

        {/* 본문 중간 광고 (통합센터: 앱 / 이너 / 매거진 상세) —
            본문 끝, 공유 버튼 앞. 글 읽기를 끊지 않는 자리다. */}
        <DetailAdBanner position="middle" screen="news" />

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
              <Ionicons name="share-social-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <CommentsSection articleId={post.id} />

        {/* 상세 하단 광고 (통합센터: 앱 / 하단 / 매거진 상세) */}
        <DetailAdBanner position="bottom" screen="news" style={{ marginTop: 8 }} />

        {/* 하단 광고 — 예전엔 화면에 고정돼 있었으나 스크롤 끝으로 옮겼다 */}
        <ScrollBottomBanner />
      </ScrollView>
      </KeyboardAvoidingView>

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
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 16,
    // 예전엔 화면을 덮는 고정 광고배너(~125px) 때문에 160 을 비워 뒀다.
    // 그 배너를 스크롤 맨 아래로 옮겼으므로(2026-08-06) 보통 여백만 남긴다.
    paddingBottom: 24,
  },
  // 빵조각 — 제목 위 한 줄. 눈에 띄되 제목을 이기지 않게 작고 흐리게.
  // 바깥이 <Text> 이므로 flex 속성을 쓰지 않는다 (iOS 에서 접히는 원인이었다).
  breadcrumb: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  breadcrumbSep: {
    fontSize: 12,
    color: '#c4c4c4',
  },
  breadcrumbText: {
    fontSize: 12,
    color: '#999',
  },
  breadcrumbLast: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '700',
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

