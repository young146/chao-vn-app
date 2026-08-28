import { getSectionLabel } from '../lib/newsSections';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  ScrollView,
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
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { wordpressApi, MAGAZINE_BASE_URL, BOARD_BASE_URL, getHomeDataCached, getNewsSectionsCached, getSectionsList } from '../services/wordpressApi';
import AdBanner, { InlineAdBanner, HomeBanner, HomeSectionAd, PopupAd, ScrollBottomBanner } from '../components/AdBanner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TranslatedText from '../components/TranslatedText';
import SectionNewsModal from '../components/SectionNewsModal';
import AnnouncementBanner from '../components/AnnouncementBanner';
import MarketStrip from '../components/MarketStrip';
import VisitorValueCard from '../components/VisitorValueCard';
import MicButton from '../components/MicButton';

const { width } = Dimensions.get('window');

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_HISTORY = 5;

const SearchHeader = ({ onSearch, onClear, isSearching }) => {
  const { t } = useTranslation('menu');
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
          placeholder={t('magazine.searchPlaceholder')}
          placeholderTextColor="#999"
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSubmit}
          onFocus={() => setShowHistory(true)}
          returnKeyType="search"
        />
        {/* 말로 검색 — 검색창이 있는 곳엔 어디든 마이크를 둔다.
            handleHistoryClick 과 같은 흐름(입력칸 채우고 바로 검색)이다. */}
        <MicButton
          size={20}
          label="말로 검색하기"
          onText={(t) => { setText(t); onSearch(t); setShowHistory(false); }}
        />
        {/* 검색어 입력 중이거나 검색 결과 표시 중일 때 X 버튼 표시 */}
        {(text.length > 0 || isSearching) && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={22} color="#FF6B35" />
          </TouchableOpacity>
        )}
        {/* 찾기 버튼 */}
        <TouchableOpacity
          style={styles.searchSubmitButton}
          onPress={handleSubmit}
          activeOpacity={0.75}
        >
          <Text style={styles.searchSubmitText}>찾기</Text>
        </TouchableOpacity>
      </View>

      {/* 🔍 최근 검색어 */}
      {showHistory && searchHistory.length > 0 && !isSearching && (
        <View style={styles.historyContainer}>
          <Text style={styles.historyTitle}>{t('magazine.recentSearches')}</Text>
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
                <TranslatedText style={styles.slideTitle} numberOfLines={2}>
                  {item.title.rendered.replace(/&#[0-9]+;/g, (match) => String.fromCharCode(match.match(/[0-9]+/)))}
                </TranslatedText>
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
  const { t } = useTranslation('home');
  // WordPress API에서 특성 이미지 가져오기 (_embed: 1 필요)
  const featuredImage = item._embedded?.['wp:featuredmedia']?.[0]?.source_url;

  // 날짜 변환 (KBoard는 RSS 날짜 형식이므로 처리 필요)
  let dateStr = t('noDateInfo');
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
    // 분류 → 이름 변환표는 lib/newsSections.js 한 곳에만 둔다.
    // 여기 안에 박아뒀더니 상세화면이 같은 표를 쓸 수 없었다 (2026-08-08).

    // 1. meta 필드에서 카테고리와 출처 가져오기
    const newsCategory = item.meta?.news_category || '';
    const newsSource = item.meta?.news_source || '';

    // 카테고리 번역 (모르는 값이면 원문 그대로 돌려준다)
    const category = getSectionLabel(newsCategory, t);

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
    switch (type) {
      case 'news': return t('types.news');
      case 'board': return t('types.board');
      default: return t('types.magazine');
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
        <TranslatedText style={styles.title} numberOfLines={2}>
          {item.title.rendered.replace(/&#[0-9]+;/g, (match) => String.fromCharCode(match.match(/[0-9]+/)))}
        </TranslatedText>
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

/**
 * 섹션 제목 리스트 한 줄 — 대표카드 아래로 쌓이는 헤드라인.
 *
 * 웹 뉴스터미널(2026-07-17 개편)과 같은 배치를 앱에도 옮긴 것이다.
 * 이전에는 섹션의 모든 기사를 큰 카드로 뿌려서, 카드 하나가 세로로 300px 넘게 먹는 탓에
 * 뒤쪽 섹션(여행·음식 등)까지 내려가려면 화면을 스무 번 넘게 넘겨야 했다.
 * → 섹션당 대표카드 1개 + 이 줄 7개.
 *
 * 앞에 사진(64x48)을 붙인다 — 글자만 늘어놓으면 눈이 걸리는 데가 없다.
 * 과거에서 채운 기사(isPast)에는 날짜를 붙인다 — 오늘 것처럼 보이면 안 된다.
 */
const NewsHeadlineRow = ({ item, index, onPress }) => {
  const thumb = item._embedded?.['wp:featuredmedia']?.[0]?.source_url;
  const rawTitle = typeof item.title === 'string' ? item.title : (item.title?.rendered || '');

  // 과거 기사 날짜 배지 (8/3 형태)
  let pastLabel = '';
  if (item.isPast && item.date) {
    const d = new Date(item.date);
    if (!isNaN(d.getTime())) pastLabel = `${d.getMonth() + 1}/${d.getDate()}`;
  }

  return (
    <TouchableOpacity
      style={[styles.hlRow, index % 2 === 1 && styles.hlRowAlt]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      {thumb ? (
        <Image
          source={{ uri: thumb }}
          style={styles.hlThumb}
          contentFit="cover"
          transition={150}
          cachePolicy="disk"
        />
      ) : (
        /* 사진 없는 기사도 같은 자리를 차지해야 제목 시작선이 들쭉날쭉해지지 않는다 */
        <View style={[styles.hlThumb, styles.hlThumbEmpty]} />
      )}
      <TranslatedText style={styles.hlTitle} numberOfLines={2}>
        {rawTitle.replace(/&#[0-9]+;/g, (match) => String.fromCharCode(match.match(/[0-9]+/)))}
      </TranslatedText>
      {pastLabel !== '' && <Text style={styles.hlDate}>{pastLabel}</Text>}
    </TouchableOpacity>
  );
};

// 섹션 하나에 보여줄 제목 줄 수 (대표카드 1개 + 이만큼). 서버(CHAOVN_SECTION_TARGET=8)와 맞춘 값.
const HEADLINE_LIMIT = 7;

/**
 * 매거진 탭 맨 위 "이번 호" 블록 — 표지 + 호수 + 그 호 목차(가로 스크롤).
 *
 * 왜 필요한가 (2026-08-06): 격주 발행 잡지인데 앱에는 "몇 호"라는 개념이 없어서,
 * 카테고리별 최신 4건이 흩어져 보일 뿐 잡지처럼 읽히지 않았다. 매호 새로 생기는 꼭지도
 * 고정 섹션에 안 잡히면 묻혔다. 호 단위로 묶으면 그 호가 실제로 가진 꼭지가 그대로 나온다.
 *
 * 서버가 호를 아직 지정 안 했으면(currentIssue=null) 이 블록은 그리지 않는다 — 기존 화면 그대로.
 */
const CurrentIssueBlock = ({ issue, onPressPost, onOpenContents, onOpenArchive }) => {
  if (!issue) return null;

  const dateStr = (issue.date || '').replace(/-/g, '.');
  const label = issue.number ? `제${issue.number}호` : issue.title;
  const articleCount = issue.posts?.length || 0;

  // 발행일이 아직 안 온 호 = "발행 예정".
  // 이 상태를 표시하지 않으면 기사도 표지도 없는 빈 칸이 그냥 고장처럼 보인다
  // (2026-08-06 사장님이 실물에서 지적).
  const publishTs = issue.date ? new Date(`${issue.date}T00:00:00`).getTime() : NaN;
  const isUpcoming = !isNaN(publishTs) && publishTs > Date.now();

  // 표지 높이 = 실제 비율. 서버가 크기를 안 주면 잡지에서 가장 흔한 A4 비율로.
  const coverW = Math.round(width * 0.34);
  const ratio =
    issue.coverWidth && issue.coverHeight ? issue.coverWidth / issue.coverHeight : 1 / 1.414;
  const coverHeight = Math.round(coverW / ratio);

  return (
    <View style={styles.issueBlock}>
      <View style={styles.issueHeader}>
        <Text style={styles.issueBadge}>📖 이번 호</Text>
        {isUpcoming && <Text style={styles.issueUpcomingTag}>발행 예정</Text>}
        <TouchableOpacity onPress={onOpenArchive} style={styles.issueArchiveLink}>
          <Text style={styles.issueArchiveText}>지난 호 ›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.issueTop}>
        {/* 표지를 누르면 그 호 기사 목록으로 — 잡지 앱의 표준 동작 */}
        <TouchableOpacity onPress={onOpenContents} activeOpacity={0.85}>
          {issue.coverUrl ? (
            /* 표지 비율은 판형마다 다르다(A4·국배판…). 서버가 실제 크기를 주면 그대로 그려
               잘리지도 여백이 생기지도 않게 한다 — 담당자가 규격을 맞출 필요가 없다. */
            <Image
              source={{ uri: issue.coverUrl }}
              style={[styles.issueCover, { height: coverHeight }]}
              contentFit="cover"
              cachePolicy="disk"
            />
          ) : (
            /* 표지를 아직 안 올린 호도 화면이 깨지면 안 된다 — 대체 표지를 그린다 */
            <View style={[styles.issueCover, styles.issueCoverEmpty, { height: coverHeight }]}>
              <Text style={styles.issueCoverEmptyText}>{label}</Text>
              {isUpcoming && <Text style={styles.issueCoverEmptySub}>표지 준비 중</Text>}
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.issueInfo}>
          <Text style={styles.issueTitle}>{label}</Text>
          {dateStr ? (
            <Text style={styles.issueMeta}>{dateStr} {isUpcoming ? '발행 예정' : '발행'}</Text>
          ) : null}
          {articleCount > 0 ? (
            <Text style={styles.issueMeta}>기사 {issue.count || articleCount}편</Text>
          ) : (
            <Text style={styles.issueNotice}>
              {isUpcoming
                ? '발행일에 맞춰 기사가 올라옵니다.'
                : '기사를 준비하고 있습니다.'}
            </Text>
          )}
        </View>
      </View>

      {/* 기사가 있으면 "전체 보기" 문을 하나 더 둔다 (표지 탭을 모르는 사람도 있다) */}
      {articleCount > 0 && (
        <TouchableOpacity style={styles.issueMoreBtn} onPress={onOpenContents} activeOpacity={0.8}>
          <Text style={styles.issueMoreText}>이번 호 기사 전체 보기 ›</Text>
        </TouchableOpacity>
      )}

      {issue.posts?.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.issueList}>
          {issue.posts.map((post) => {
            const thumb = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
            const raw = typeof post.title === 'string' ? post.title : (post.title?.rendered || '');
            return (
              <TouchableOpacity
                key={post.id}
                style={styles.issueCard}
                onPress={() => onPressPost(post)}
                activeOpacity={0.8}
              >
                {thumb ? (
                  <Image source={{ uri: thumb }} style={styles.issueCardImage} contentFit="cover" cachePolicy="disk" />
                ) : (
                  <View style={[styles.issueCardImage, styles.issueCoverEmpty]} />
                )}
                {post.section ? <Text style={styles.issueCardSection} numberOfLines={1}>{post.section}</Text> : null}
                <TranslatedText style={styles.issueCardTitle} numberOfLines={2}>
                  {raw.replace(/&#[0-9]+;/g, (m) => String.fromCharCode(m.match(/[0-9]+/)))}
                </TranslatedText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

export default function MagazineScreen({ navigation, route }) {
  const { t } = useTranslation('home');
  const { type = 'magazine', categoryId, resetSearch } = route.params || {};
  const [posts, setPosts] = useState([]);
  const [slides, setSlides] = useState([]);
  const [homeSections, setHomeSections] = useState([]);
  const [currentIssue, setCurrentIssue] = useState(null); // 📖 이번 호 (표지+목차)
  const [newsSections, setNewsSections] = useState([]); // 🗞️ 뉴스 카테고리별 섹션
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPopup, setShowPopup] = useState(false); // 🎯 팝업 상태
  const popupShownRef = useRef(false); // 세션 중 한 번만 표시
  // 마지막으로 **서버에서** 받아온 시각. 화면에 돌아왔을 때 다시 받을지 정하는 기준.
  const lastFetchRef = useRef(Date.now());
  const REFETCH_AFTER_MS = 5 * 60 * 1000; // 5분
  const mainListRef = useRef(null);

  // 날짜 선택 관련 state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isFilteredByDate, setIsFilteredByDate] = useState(false);
  const [showingYesterdayNews, setShowingYesterdayNews] = useState(false);
  // 뉴스가 비었을 때 "그날 뉴스가 없음" 인지 "못 불러옴" 인지 — 화면 안내 문구가 갈린다
  const [newsFailed, setNewsFailed] = useState(false);

  // 🗂️ 뉴스 항목별 기사 보기 모달 state
  const [selectedSection, setSelectedSection] = useState(null);
  const [sectionsList, setSectionsList] = useState([]); // API에서 로드한 섹션 목록

  /**
   * @param {boolean} filtered 사용자가 날짜를 직접 고른 상태인지.
   *   ⛔ 이 값을 state 에서 바로 읽으면 안 된다 — setIsFilteredByDate(true) 직후에
   *   같은 렌더의 이 함수를 부르면 클로저는 아직 옛 값(false)을 들고 있어서,
   *   고른 날짜가 아래에서 "오늘"로 덮어써졌다. 날짜 버튼 라벨만 바뀌고 내용은 오늘
   *   것이 나오던 원인이다. 그래서 부르는 쪽이 명시적으로 넘긴다.
   */
  const fetchPosts = async (pageNum = 1, isRefresh = false, query = searchQuery, date = null, filtered = isFilteredByDate) => {
    try {
      if (pageNum === 1) {
        if (!isRefresh) {
          // 이미 데이터가 있으면 스피너 생략 — 탭 재진입 시 깜빡임 방지
          const hasExistingData =
            (type === 'home' && !query && homeSections.length > 0) ||
            (type === 'news' && !query && newsSections.length > 0);
          if (!hasExistingData) setLoading(true);
        }
        // 홈 화면이고 검색어가 없을 때만 슬라이더 및 섹션 데이터 가져옴
        if (type === 'home' && !query) {
          const homeData = await getHomeDataCached(isRefresh);
          setSlides(homeData.slideshowPosts || []);
          setHomeSections(homeData.homeSections || []);
          setCurrentIssue(homeData.currentIssue || null);
          setLoading(false);

          // 캐시가 만료된 상태였다면(_stale) 옛 목록을 이미 화면에 띄운 뒤
          // 뒤에서 조용히 갱신한다 — 사용자는 기다리지 않는다.
          // 갱신에 실패하면 아무것도 하지 않는다(옛 목록이 그대로 남는 게 빈 화면보다 낫다).
          if (homeData._stale) {
            getHomeDataCached(true)
              .then((fresh) => {
                if (fresh?.homeSections?.length) {
                  setSlides(fresh.slideshowPosts || []);
                  setHomeSections(fresh.homeSections);
                  setCurrentIssue(fresh.currentIssue || null);
                }
              })
              .catch(() => { });
          }
          return;
        }

        // 🗞️ 뉴스 탭: 카테고리별 섹션으로 표시 (WordPress 사이트와 동일)
        if (type === 'news' && !query) {
          let targetDate = date || selectedDate;
          if (!filtered) {
            targetDate = new Date(); // 오늘 날짜
          }

          // 3번째 인자 = 과거 뉴스로 채울지. "지난 뉴스 보기"로 날짜를 고른 경우에는
          // 그 날짜 지면을 그대로 보여줘야 하므로 채우지 않는다.
          let newsData = await getNewsSectionsCached(isRefresh, targetDate, !filtered);

          // 오늘 지면이 아직 없으면 직전 발행일 지면을 그대로 보여준다
          // (최대 7일 뒤까지 시도 — 라벨은 "오늘의 뉴스" 그대로 유지)
          //
          // ⚠️ 판단 기준은 `totalCount` 다. **`newsSections.length` 로 보면 안 된다.**
          //   서버는 fill=1 이면 그날 발행분이 0건이어도 섹션을 과거 기사로 채워 보낸다.
          //   그래서 일요일(발행 없음)에도 섹션이 11개 와서 "뉴스가 있다"로 판정됐고,
          //   fallback 이 아예 돌지 않았다. 결과는 **토요일 지면의 열화판**이었다
          //   (실측 2026-08-09: 토요일 92건 → 일요일 77건, 전부 토요일 것의 부분집합.
          //    빠진 15건에 **주요 뉴스 2건이 통째로 포함** — 맨 위 큰 카드가 사라졌다).
          //   채우기는 섹션당 8건까지만 하고, 탑뉴스 표시는 *그 날짜 기사*에만 붙기 때문이다.
          //   평일 새벽에도 같은 일이 매일 벌어지고 있었다(그날 첫 기사가 올라오기 전).
          //
          //   totalCount 는 서버가 세는 **그 날짜 자체 발행분**이다(채운 기사는 안 센다).
          //   0 이면 "그 날은 지면이 없다" 가 정확한 뜻이다.
          //
          // 단, 못 불러온 것(failed)은 "뉴스가 없다"가 아니다 — 망이 끊긴 상태에서
          // 7번을 더 두드려봐야 7배로 기다리기만 한다. 그럴 땐 바로 안내로 넘긴다.
          if (!newsData.totalCount && !newsData.failed && !filtered) {
            for (let i = 1; i <= 7; i++) {
              const past = new Date();
              past.setDate(past.getDate() - i);
              // 여기는 "오늘 뉴스가 아직 없어 어제로 내려가는" 경로 = 여전히 오늘의 뉴스 모드 → 채운다
              const pastData = await getNewsSectionsCached(isRefresh, past, true);
              if (pastData.totalCount > 0) {
                newsData = pastData;
                break;
              }
              if (pastData.failed) break;
            }
          }
          // 자동 fallback인 경우에도 selectedDate는 오늘 유지 → 라벨은 "오늘의 뉴스"
          setShowingYesterdayNews(false);

          setNewsFailed(!!newsData.failed);
          setNewsSections(newsData.newsSections || []);
          setHasMore(false); // 섹션 뷰에서는 무한 스크롤 없음
          setLoading(false);
          return;
        }
      } else {
        if (type === 'home' && !query) return;
        if (type === 'news' && !query) return; // 뉴스 섹션 뷰에서는 추가 로딩 없음
        setLoadingMore(true);
      }

      let newPosts = [];
      if (query) {
        newPosts = await wordpressApi.searchPosts(query, pageNum);
      } else if (type === 'board') {
        newPosts = await wordpressApi.getBoardPosts(pageNum);
      } else if (categoryId) {
        // 카테고리별 포스트 (뉴스 외)
        // toISOString() 은 UTC 라 한국·베트남에서 하루 앞당겨진다 — 현지 달력값을 그대로 쓴다
        const pad = (n) => String(n).padStart(2, '0');
        const dateStr = date
          ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
          : null;
        newPosts = await wordpressApi.getPostsByCategory(categoryId, pageNum, 10, dateStr);
      } else {
        newPosts = await wordpressApi.getMagazinePosts(pageNum);
      }

      if (newPosts.length < 10) {
        setHasMore(false);
      }

      // 뉴스 탭: 뉴스가 더 이상 없으면 종료
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

  // 🗂️ 뉴스 탭: 섹션 목록 로드
  useEffect(() => {
    if (type === 'news') {
      getSectionsList().then((sections) => {
        if (sections && sections.length > 0) {
          setSectionsList(sections);
        }
      }).catch(() => { });
    }
  }, [type]);

  /**
   * 🔙 탭을 누르면 검색 초기화 + **서버에서 새로 받아온다**.
   *
   * 2026-08-28 사장님 지적:
   *   "다른 탭은 누르면 로딩 표시가 잠깐 떴다 사라지는데, 뉴스·매거진 탭은 그 과정이
   *    없어서 다른 데 갔다 와도 앞에서 보던 화면이 그대로 남아 있다."
   *
   * 원인: 여기서 `fetchPosts(1, false, ...)` 를 불렀다 — isRefresh=false 라
   *   **캐시를 다시 읽을 뿐** 서버에 묻지 않았다(뉴스 2시간·홈 6시간).
   *   그래서 눌러도 화면이 그대로고, 로딩 표시도 뜰 일이 없었다.
   *
   * → isRefresh=true 로 캐시를 건너뛰고, 도는 것이 보이도록 스피너도 직접 켠다.
   *   (fetchPosts 는 isRefresh 일 때 스피너를 켜지 않는다 — 당겨서 새로고침은
   *    RefreshControl 이 따로 표시하기 때문. 탭 클릭에는 그게 없다)
   */
  useEffect(() => {
    if (resetSearch) {
      setSearchQuery('');
      setIsFilteredByDate(false);
      setShowingYesterdayNews(false);
      setSelectedDate(new Date());
      setPage(1);
      setHasMore(true);
      setLoading(true);
      lastFetchRef.current = Date.now();
      // 바로 위에서 끈 날짜 필터를 명시적으로 넘긴다 (state 는 아직 옛 값이다)
      fetchPosts(1, true, '', null, false);
    }
  }, [resetSearch]);

  /**
   * 🗞️ 뉴스 탭은 **언제 들어와도 오늘 뉴스**가 떠야 한다 (2026-08-28 사장님 지시).
   *
   * 왜 필요한가: 날짜 필터를 끄는 길이 `resetSearch` 하나뿐이었고, 그건
   * **탭 아이콘을 눌렀을 때만** 전달된다(App.js 의 tabPress 리스너).
   * 그래서 아래 경로로 들어오면 지난번에 고른 날짜가 그대로 남아 있었다:
   *   · 이메일·카톡 링크(딥링크)로 뉴스 화면에 바로 진입
   *   · 알림을 눌러 진입
   *   · 다른 탭에 갔다가 화면이 살아있는 채로 돌아옴
   * 사장님이 "간혹 예전 날짜 뉴스가 그대로 뜬다" 고 한 것이 이 경우다.
   *
   * → 화면에 포커스될 때 날짜 필터가 켜져 있으면 오늘로 되돌린다.
   *   기사 모달을 열고 닫는 것은 같은 화면 안의 일이라 포커스가 바뀌지 않는다
   *   → 지난 뉴스를 보다가 기사를 읽고 닫는 흐름은 그대로 유지된다.
   *
   * ※ "오늘 지면이 없으면 지난 날짜로 내려가는" 처리는 fetchPosts 안에 이미 있다
   *   (최대 7일, totalCount 기준). 여기서는 '오늘 모드로 되돌리는' 것만 한다.
   */
  useFocusEffect(
    useCallback(() => {
      if (type !== 'news' && type !== 'home') return;

      // ⓐ 뉴스 탭에 날짜 필터가 켜진 채로 돌아왔다 → 오늘로 되돌린다
      if (type === 'news' && isFilteredByDate) {
        setIsFilteredByDate(false);
        setShowingYesterdayNews(false);
        setSelectedDate(new Date());
        setSearchQuery('');
        setPage(1);
        setHasMore(true);
        setLoading(true);
        lastFetchRef.current = Date.now();
        // 방금 끈 필터를 명시적으로 넘긴다 — state 는 이 클로저에 아직 반영돼 있지 않다
        fetchPosts(1, true, '', null, false);
        return;
      }

      // ⓑ 한참 만에 돌아왔으면 새로 받는다.
      //   매번 받으면 다른 탭 잠깐 다녀올 때마다 화면이 깜빡여 거슬리고,
      //   아예 안 받으면 앞에서 보던 화면이 계속 남는다 → 5분을 경계로 삼는다.
      if (Date.now() - lastFetchRef.current < REFETCH_AFTER_MS) return;
      if (searchQuery) return;          // 검색 결과를 보는 중이면 건드리지 않는다
      if (isFilteredByDate) return;     // 특정 날짜를 보는 중이면 그대로 둔다
      lastFetchRef.current = Date.now();
      setLoading(true);
      fetchPosts(1, true, '', null, false);
    }, [type, isFilteredByDate, searchQuery])
  );

  // 🎯 홈 화면 진입 시 팝업 광고 표시 (세션 중 한 번만)
  useEffect(() => {
    if (type === 'home' && !popupShownRef.current && !loading) {
      popupShownRef.current = true;
      // 약간의 딜레이 후 팝업 표시 (화면 로드 후)
      const timer = setTimeout(() => setShowPopup(true), 500);
      return () => clearTimeout(timer);
    }
  }, [type, loading]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    lastFetchRef.current = Date.now();
    fetchPosts(1, true, searchQuery, isFilteredByDate ? selectedDate : null);
  }, [type, categoryId, searchQuery, selectedDate, isFilteredByDate]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    setIsFilteredByDate(false); // 검색 시 날짜 필터 해제
    setPage(1);
    setHasMore(true);
    fetchPosts(1, false, query, null, false);
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
      // filtered=true 를 직접 넘긴다 — 바로 위 setIsFilteredByDate(true) 는
      // 이 클로저에 아직 반영돼 있지 않다(그래서 예전엔 고른 날짜가 무시됐다)
      fetchPosts(1, false, '', date, true);
    }
  };

  const resetDateFilter = () => {
    setIsFilteredByDate(false);
    setSelectedDate(new Date());
    setPage(1);
    setHasMore(true);
    fetchPosts(1, false, searchQuery, null, false);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPosts(nextPage, false, searchQuery, isFilteredByDate ? selectedDate : null);
    }
  };

  const handlePostPress = (post) => {
    navigation.navigate('PostDetail', {
      post,
      baseUrl: type === 'board' ? BOARD_BASE_URL : MAGAZINE_BASE_URL,
      // 뉴스인지 매거진인지는 *이 화면이 안다*. 상세화면이 글 데이터로 추측하게 두면
      // 목록 응답에 카테고리가 없는 뉴스가 전부 매거진으로 집계된다(측정 결함 4-F).
      contentType: type === 'news' ? 'news' : 'magazine',
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
        ref={mainListRef}
        data={type === 'home' && !searchQuery ? [] : posts}
        renderItem={({ item, index }) => (
          <View>
            <MagazineCard item={item} onPress={handlePostPress} type={type} />
            {/* 뉴스/게시판: 3개 기사마다 광고 삽입 */}
            {(type === 'news' || type === 'board') && (index + 1) % 3 === 0 && (
              <InlineAdBanner screen="news" />
            )}
          </View>
        )}
        keyExtractor={(item, index) => {
          if (item.id) return item.id.toString();
          if (item.link) return `item-${item.link}-${index}`;
          return `item-${index}`;
        }}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {/* 📢 공지 배너 (Firestore Announcements에서 조회) */}
            <AnnouncementBanner targetScreen="News" />

            {/* 🎯 비회원 가치 카드 — 뉴스 탭 비회원에게만 노출 (액션 14)
                이메일·환영화면과 동일 데이터(Firestore 24h count). 3채널 인지 일관성. */}
            {type === 'news' && !searchQuery && (
              <VisitorValueCard navigation={navigation} />
            )}

            {/* 홈 배너: 스크롤과 함께 움직임 */}
            {type === 'home' && (
              <HomeBanner style={{ marginBottom: 8 }} />
            )}
            {/* 뉴스/기타 탭 헤더 광고 (뉴스탭 제외 — 스크롤 성능) */}
            {type !== 'home' && type !== 'news' && (
              <AdBanner screen="news" style={{ marginBottom: 8 }} />
            )}

            {type === 'news' && (
              <View style={styles.dateFilterContainer}>
                <TouchableOpacity
                  style={[styles.dateButton, isFilteredByDate && styles.dateButtonActive]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color={isFilteredByDate ? "#fff" : "#FF6B35"} />
                  <Text style={[styles.dateButtonText, isFilteredByDate && styles.dateButtonTextActive]}>
                    {isFilteredByDate ? selectedDate.toLocaleDateString() : t('viewByDate')}
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

            {/* 📊 마켓 정보 카드 (날씨·환율·항공권·주가) — 뉴스 탭 상단 가로 스와이프 */}
            {type === 'news' && !searchQuery && (
              <MarketStrip
                onScrollLock={() => mainListRef.current?.setNativeProps({ scrollEnabled: false })}
                onScrollUnlock={() => mainListRef.current?.setNativeProps({ scrollEnabled: true })}
              />
            )}

            {/* 🗂️ 뉴스 항목별 기사 보기 (카테고리 버튼) */}
            {type === 'news' && !searchQuery && sectionsList.length > 0 && (
              <View style={styles.sectionButtonsContainer}>
                <Text style={styles.sectionButtonsTitle}>🗞️ 뉴스 항목별 기사 보기</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sectionButtonsRow}
                >
                  {sectionsList.map((section) => (
                    <TouchableOpacity
                      key={section.key || section.id}
                      style={styles.sectionButton}
                      onPress={() => setSelectedSection(section)}
                    >
                      <Text style={styles.sectionButtonText}>
                        {section.icon ? `${section.icon} ` : ''}{section.name || section.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {type === 'home' && !searchQuery && (
              <View>
                {/* 📖 이번 호 — 잡지 탭의 첫 화면은 "이번 호"여야 잡지답다 */}
                <CurrentIssueBlock
                  issue={currentIssue}
                  onPressPost={handlePostPress}
                  onOpenContents={() =>
                    navigation.navigate('이번호기사', { issueNumber: currentIssue?.number || null })
                  }
                  onOpenArchive={() => navigation.navigate('지난호')}
                />

                {slides.length > 0 && (
                  <HomeSlider posts={slides} onPress={handlePostPress} />
                )}

                {homeSections.map((section, sectionIndex) => (
                  <View key={section.id}>
                    <HomeSectionAd />
                    <View style={styles.homeSection}>
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{section.name}</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('카테고리목록', { categoryId: section.id, type: 'category', sectionName: section.name })}>
                          <Text style={styles.seeMore}>{t('seeMore')} {'>'}</Text>
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
                                  <TranslatedText style={styles.gridCardTitle} numberOfLines={2}>
                                    {post.title.rendered.replace(/&#[0-9]+;/g, (match) => String.fromCharCode(match.match(/[0-9]+/)))}
                                  </TranslatedText>
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

            {/* 🗞️ 뉴스 탭: 카테고리별 섹션 (WordPress 사이트와 동일) */}
            {type === 'news' && !searchQuery && newsSections.length > 0 && (
              <View>
                {newsSections.map((section) => {
                  // 탑뉴스는 웹과 동일하게 큰 카드 그대로 둔다 (2건뿐 — 대표/목록으로 쪼갤 게 없다)
                  if (section.categoryKey === 'TopNews') {
                    return (
                      <View key={`news-section-${section.categoryKey}`}>
                        <View style={styles.homeSection}>
                          <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{section.name}</Text>
                          </View>
                          {section.posts.map((post, index) => (
                            <MagazineCard
                              key={`news-top-${post.id}-${index}`}
                              item={post}
                              onPress={handlePostPress}
                              type="news"
                            />
                          ))}
                        </View>
                        <HomeSectionAd />
                      </View>
                    );
                  }

                  // 대표카드만 덩그러니 있는 섹션은 지면만 먹고 읽을 게 없다 (웹과 같은 규칙)
                  if (section.posts.length < 2) return null;

                  const lead = section.posts[0];
                  const headlines = section.posts.slice(1, 1 + HEADLINE_LIMIT);

                  return (
                    <View key={`news-section-${section.categoryKey}`}>
                      <View style={styles.homeSection}>
                        <View style={styles.sectionHeader}>
                          <Text style={styles.sectionTitle}>{section.name}</Text>
                        </View>

                        {/* 대표기사 = 기존 카드 그대로 (사진 + 제목 + 요약) */}
                        <MagazineCard item={lead} onPress={handlePostPress} type="news" />

                        {/* 제목 리스트 — 리스트만 덩그러니 있으면 "이게 뭔 목록인지" 안 보여 이름표를 얹는다 */}
                        <View style={styles.hlBox}>
                          <Text style={styles.hlLabel}>📰 이 시각 주요 뉴스</Text>
                          {headlines.map((post, index) => (
                            <NewsHeadlineRow
                              key={`hl-${section.categoryKey}-${post.id}-${index}`}
                              item={post}
                              index={index}
                              onPress={handlePostPress}
                            />
                          ))}
                        </View>

                        {/* 7줄 뒤로 가는 문 — 이미 있는 섹션 팝업을 연다 (새로 만들지 않는다) */}
                        <TouchableOpacity
                          style={styles.hlMoreBtn}
                          onPress={() => setSelectedSection({ key: section.categoryKey, label: section.name })}
                        >
                          <Text style={styles.hlMoreText}>{section.name} 뉴스 더보기 ›</Text>
                        </TouchableOpacity>
                      </View>

                      {/* 섹션 끝 광고 — 대표카드 → 제목 7줄 → 광고 (웹 지면과 같은 자리) */}
                      <HomeSectionAd />
                    </View>
                  );
                })}

                {/* 마지막 멘트 */}
                <View style={styles.endMessageContainer}>
                  <Text style={styles.endMessageText}>
                    {(isFilteredByDate || showingYesterdayNews)
                      ? `✨ ${t('dateNewsEnd', { year: selectedDate.getFullYear(), month: selectedDate.getMonth() + 1, day: selectedDate.getDate() })} ✨`
                      : `✨ ${t('todayNewsEnd')} ✨`
                    }
                  </Text>
                  {!isFilteredByDate && !showingYesterdayNews && (
                    <Text style={styles.endMessageSubText}>
                      {t('pastNewsHint')}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* 🕳️ 뉴스가 없을 때 — 예전엔 아무것도 안 그려서 헤더와 하단 광고만 남았다.
                사용자 입장에선 "그날 뉴스가 없는 건지, 앱이 고장난 건지" 알 방법이 없었다. */}
            {type === 'news' && !searchQuery && !loading && newsSections.length === 0 && (
              <View style={styles.newsEmptyBox}>
                <Ionicons
                  name={newsFailed ? 'cloud-offline-outline' : 'newspaper-outline'}
                  size={40}
                  color="#CCC"
                />
                <Text style={styles.newsEmptyText}>
                  {newsFailed ? t('newsLoadFailed') : t('noNews')}
                </Text>
                <Text style={styles.newsEmptySubText}>
                  {newsFailed ? t('newsLoadFailedHint') : t('noNewsHint')}
                </Text>
                <TouchableOpacity
                  style={styles.newsRetryButton}
                  onPress={() => fetchPosts(1, true, '', isFilteredByDate ? selectedDate : null)}
                >
                  <Ionicons name="refresh" size={16} color="#fff" />
                  <Text style={styles.newsRetryText}>{t('retry')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {searchQuery.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>'{searchQuery}' {t('searchResult')}</Text>
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
          // 스크롤 끝에 붙는 것들: (로딩중이면 스피너 | 뉴스탭 마지막 멘트) + 하단 광고.
          // 광고는 어느 경우에도 맨 끝에 온다 — 예전엔 화면에 고정돼 있던 자리다.
          const tail = <ScrollBottomBanner />;

          if (loadingMore) {
            return (
              <View>
                <ActivityIndicator style={{ marginVertical: 20 }} color="#FF6B35" />
                {tail}
              </View>
            );
          }
          // 뉴스 탭에서 더 이상 뉴스가 없을 때 마지막 멘트 표시
          if (type === 'news' && !hasMore && posts.length > 0) {
            // 오늘 날짜인지 확인 (어제 뉴스 자동 표시 중이면 오늘이 아님)
            const today = new Date();
            const isToday = !showingYesterdayNews && !isFilteredByDate &&
              (selectedDate.getFullYear() === today.getFullYear() &&
                selectedDate.getMonth() === today.getMonth() &&
                selectedDate.getDate() === today.getDate());

            // 날짜 포맷 함수
            const formatDate = (date) => {
              return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
            };

            return (
              <View>
                <View style={styles.endMessageContainer}>
                  <Text style={styles.endMessageText}>
                    {isToday
                      ? '✨ 이상, 씬짜오베트남에서 뽑은 오늘의 베트남 뉴스입니다 ✨'
                      : `✨ 이상, ${formatDate(selectedDate)} 베트남 뉴스입니다 ✨`
                    }
                  </Text>
                  {isToday && (
                    <Text style={styles.endMessageSubText}>
                      지난 뉴스는 상단의 '날짜별 뉴스 보기'를 이용해주세요
                    </Text>
                  )}
                </View>
                {tail}
              </View>
            );
          }
          return tail;
        }}
        ListEmptyComponent={
          !loading && searchQuery.length > 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>검색 결과가 없습니다</Text>
              <Text style={styles.emptySubtext}>다른 키워드로 검색해보세요</Text>
            </View>
          ) : !loading && type !== 'home' && type !== 'news' && posts.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>콘텐츠를 준비 중입니다</Text>
            </View>
          ) : null
        }
        windowSize={10}
        maxToRenderPerBatch={5}
        initialNumToRender={6}
        nestedScrollEnabled={true}
      />

      {/* 🎯 홈 화면 팝업 광고 (10초 후 자동 닫힘) */}
      {type === 'home' && (
        <PopupAd
          visible={showPopup}
          onClose={() => setShowPopup(false)}
          screen="home"
          autoCloseSeconds={10}
        />
      )}

      {/* 🗂️ 뉴스 항목별 기사 보기 모달 */}
      {selectedSection && (
        <SectionNewsModal
          isVisible={!!selectedSection}
          onClose={() => setSelectedSection(null)}
          sectionKey={selectedSection.key}
          sectionTitle={selectedSection.label}
          navigation={navigation}
        />
      )}
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 16,
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
  searchSubmitButton: {
    marginLeft: 8,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  searchSubmitText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
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
  // 🗂️ 뉴스 항목별 기사 보기 버튼 스타일
  sectionButtonsContainer: {
    backgroundColor: '#fff9f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ffe0b2',
  },
  sectionButtonsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6B35',
    marginBottom: 10,
  },
  sectionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  sectionButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#FF6B35',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  sectionButtonText: {
    fontSize: 13,
    color: '#FF6B35',
    fontWeight: '600',
  },
  dateFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginHorizontal: 16,
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
    marginHorizontal: 16,
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
    marginHorizontal: 16,
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
  // ── 📖 이번 호 블록 ────────────────────────────────────────
  issueBlock: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 20,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFE0D2',
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  issueBadge: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E85A24',
  },
  issueArchiveLink: { marginLeft: 'auto' },
  issueArchiveText: { fontSize: 13, fontWeight: '700', color: '#EA580C' },
  issueUpcomingTag: {
    marginLeft: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#7048E8',
    backgroundColor: '#F3F0FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  issueNotice: {
    fontSize: 13,
    color: '#868E96',
    marginTop: 8,
    lineHeight: 18,
  },
  issueCoverEmptySub: {
    fontSize: 11,
    color: '#C08B6E',
    marginTop: 4,
  },
  issueTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // 표지는 잡지 앱의 주인공이다. 84px 은 엄지손톱만 해서 표지 구실을 못 했고
  // 오른쪽이 텅 비어 보였다(2026-08-06 사장님 지적).
  // 화면 폭의 34% → 잡지 앱들이 쓰는 비중(35~45%)의 아래쪽. 3:4 비율 유지.
  issueCover: {
    width: Math.round(width * 0.34),
    // height 는 표지 실제 비율로 계산해 넘긴다 (CurrentIssueBlock 참고)
    borderRadius: 6,
    backgroundColor: '#F1F3F5',
    marginRight: 14,
  },
  issueCoverEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0E6',
    borderWidth: 1,
    borderColor: '#FFD9C7',
  },
  issueCoverEmptyText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E85A24',
    textAlign: 'center',
  },
  issueInfo: {
    flex: 1,
  },
  issueTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#212529',
    marginBottom: 6,
  },
  issueMeta: {
    fontSize: 13,
    color: '#868E96',
    marginTop: 2,
  },
  issueMoreBtn: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD9C7',
    borderRadius: 8,
    backgroundColor: '#FFF8F5',
  },
  issueMoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EA580C',
  },
  issueList: {
    paddingTop: 14,
    paddingRight: 4,
  },
  issueCard: {
    width: 120,
    marginRight: 10,
  },
  issueCardImage: {
    width: 120,
    height: 80,
    borderRadius: 6,
    backgroundColor: '#F1F3F5',
    marginBottom: 6,
  },
  issueCardSection: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E85A24',
    marginBottom: 2,
  },
  issueCardTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#212529',
    lineHeight: 17,
  },
  // ── 섹션 제목 리스트 (대표카드 아래 7줄) ─────────────────────────────
  // 대표카드(marginHorizontal 16)와 좌우를 맞춰 한 덩어리로 보이게 한다.
  hlBox: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  hlLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E85A24',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#FFE0D2',
  },
  hlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  // 한 줄 건너 바탕색 — 줄 구분선을 대신한다 (선까지 두면 가로줄이 겹쳐 지저분하다)
  hlRowAlt: {
    backgroundColor: '#F1F3F5',
  },
  hlThumb: {
    width: 64,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#E9ECEF',
    marginRight: 12,
  },
  // 사진 없는 기사 — 깨진 이미지처럼 보이지 않게 옅은 테두리만 준 빈 칸
  hlThumbEmpty: {
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  hlTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
    lineHeight: 19,
  },
  // 과거 뉴스로 채운 항목의 날짜 — 오늘 것처럼 보이면 안 된다
  hlDate: {
    marginLeft: 8,
    fontSize: 11,
    color: '#ADB5BD',
  },
  hlMoreBtn: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD9C7',
    borderRadius: 8,
    backgroundColor: '#FFF8F5',
  },
  hlMoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EA580C',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
    marginHorizontal: 16,
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
    marginHorizontal: 16,
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
  newsEmptyBox: {
    alignItems: 'center',
    paddingVertical: 44,
    paddingHorizontal: 24,
  },
  newsEmptyText: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '700',
    color: '#666',
    textAlign: 'center',
  },
  newsEmptySubText: {
    marginTop: 6,
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 19,
  },
  newsRetryButton: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF6B35',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  newsRetryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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

