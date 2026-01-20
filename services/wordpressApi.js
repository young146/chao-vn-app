import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAGAZINE_BASE_URL = 'https://chaovietnam.co.kr/wp-json/wp/v2';
const BOARD_BASE_URL = 'https://vnkorlife.com/wp-json/wp/v2';

// 캐시 설정
const CACHE_KEY = 'HOME_DATA_CACHE';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5분

const api = axios.create({
  timeout: 8000,
});

// 뉴스 카테고리 섹션 정의 (WordPress 사이트와 동일한 순서)
const NEWS_SECTIONS_CONFIG = [
  { id: null, name: '경제', categoryKey: 'Economy' },
  { id: null, name: '사회', categoryKey: 'Society' },
  { id: null, name: '문화', categoryKey: 'Culture' },
  { id: null, name: '정치', categoryKey: 'Politics' },
  { id: null, name: '국제', categoryKey: 'International' },
  { id: null, name: '한-베', categoryKey: 'Korea-Vietnam' },
  { id: null, name: '여행', categoryKey: 'Travel' },
  { id: null, name: '건강', categoryKey: 'Health' },
  { id: null, name: '음식', categoryKey: 'Food' },
];

// 홈 화면 섹션 정의 (ID 우선, 없으면 이름으로 매칭)
const HOME_SECTIONS_CONFIG = [
  { id: 32, name: '교민소식', searchNames: ['교민 소식', '교민소식'] }, // 기존 ID
  { id: 445, name: '비즈니스&사회', searchNames: ['Xinchao BIZ', 'XINCHO BIZ', '비즈니스', '사회'] }, // 기존 ID
  { id: 382, name: '칼럼&오피니언', searchNames: ['CHAO COLUMN', '컬럼', '칼럼', 'COLUMN'] }, // 기존 ID
  { id: 124, name: '교육&자녀', searchNames: ['Xinchao Edu', 'XINCHAO EDU', '교육', 'EDU'] }, // Xinchao Edu
  { id: 427, name: 'F&R', searchNames: ['F&R', 'F&amp;R', 'Food & Restaurant', 'FOOD & RESTAURANT'] }, // 기존 ID
  { id: 453, name: 'Health Section', searchNames: ['Health Section', 'Health', '헬스'] },
  { id: 413, name: '골프&스포츠', searchNames: ['GOLF & SPORTS', 'GOLF &amp; SPORTS', '골프', '스포츠'] }, // 기존 ID
  { id: 29, name: '라이프&조이&트래블', searchNames: ['TRAVEL', '트래블', '라이프', 'LIFE', '조이', 'JOY'] }, // TRAVEL
  { id: 456, name: 'Pet World', searchNames: ['Pet World', 'pet World', 'PET WORLD', '펫'] }
];

// 3개월 이내 날짜 계산
const getThreeMonthsAgoDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 3);
  return date.toISOString().split('T')[0];
};

// 🚀 카테고리 목록 캐시 (한 번만 가져오기)
let cachedCategories = null;
let categoriesFetchPromise = null;

// 카테고리 목록 가져오기 (1번만 호출, 캐시 사용)
const getAllCategories = async () => {
  // 이미 캐시에 있으면 반환
  if (cachedCategories) {
    return cachedCategories;
  }
  
  // 이미 가져오는 중이면 기다림 (중복 호출 방지)
  if (categoriesFetchPromise) {
    return categoriesFetchPromise;
  }
  
  // 새로 가져오기
  categoriesFetchPromise = api.get(`${MAGAZINE_BASE_URL}/categories`, {
    params: { per_page: 100 },
  }).then(response => {
    cachedCategories = response.data;
    categoriesFetchPromise = null;
    console.log(`📂 카테고리 ${cachedCategories.length}개 로드 완료`);
    return cachedCategories;
  }).catch(error => {
    categoriesFetchPromise = null;
    console.error('카테고리 로드 실패:', error);
    return [];
  });
  
  return categoriesFetchPromise;
};

// 카테고리 ID 또는 이름으로 찾기 및 하위 카테고리 포함 (캐시된 목록 사용)
const findCategoryWithChildren = (config, allCategories) => {
  try {
    let category = null;

    // 1. ID로 직접 찾기
    if (config.id) {
      category = allCategories.find(cat => cat.id === config.id);
    }

    // 2. ID로 못 찾았거나 ID가 없으면 이름으로 찾기
    if (!category && config.searchNames) {
      for (const searchName of config.searchNames) {
        // 정확히 일치하는 것 찾기
        category = allCategories.find(cat => 
          cat.name === searchName ||
          cat.name.toLowerCase() === searchName.toLowerCase()
        );
        
        if (category) break;

        // 부분 일치 찾기
        category = allCategories.find(cat => 
          cat.name.includes(searchName) ||
          searchName.includes(cat.name) ||
          cat.name.toLowerCase().includes(searchName.toLowerCase()) ||
          searchName.toLowerCase().includes(cat.name.toLowerCase())
        );
        
        if (category) break;
      }
    }

    if (!category) {
      return { id: null, name: config.name, childIds: [] };
    }

    // 하위 카테고리 찾기 (parent가 현재 카테고리 ID인 것들)
    const childCategories = allCategories.filter(cat => 
      cat.parent === category.id
    );

    const childIds = childCategories.map(cat => cat.id);

    return {
      id: category.id,
      name: config.name,
      displayName: category.name,
      childIds: childIds
    };
  } catch (error) {
    console.error(`카테고리 "${config.name}" 조회 실패:`, error);
    return { id: null, name: config.name, childIds: [] };
  }
};

// 각 섹션별 포스트 가져오기 (부모+하위 카테고리 포함, 3개월 이내, 최신순, 최대 4개)
const getPostsForSection = async (section) => {
  if (!section.id) {
    return [];
  }

  try {
    const threeMonthsAgo = getThreeMonthsAgoDate();
    const allCategoryIds = [section.id, ...(section.childIds || [])].join(',');
    
    const response = await api.get(`${MAGAZINE_BASE_URL}/posts`, {
      params: {
        categories: allCategoryIds,
        per_page: 4, // 2x2 그리드용
        after: `${threeMonthsAgo}T00:00:00`,
        orderby: 'date',
        order: 'desc',
        _embed: 1,
      },
    });
    
    return response.data.slice(0, 4); // 최대 4개
  } catch (error) {
    console.error(`섹션 "${section.name}" 포스트 로드 실패:`, error);
    return [];
  }
};

// 🚀 최적화된 홈 데이터 로드 함수 (캐시 + 동적 카테고리 로드 + 병렬 처리)
export const getHomeDataCached = async (forceRefresh = false) => {
  try {
    // 1. 캐시 확인 (강제 갱신이 아닌 경우)
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isExpired = Date.now() - timestamp > CACHE_EXPIRY;
        
        if (!isExpired) {
          console.log('📦 캐시 사용 (유효)');
          return data;
        }
        console.log('⏰ 캐시 만료, 새 데이터 로드');
      }
    }

    console.log('🌐 API 호출 시작...');
    const startTime = Date.now();
    
    // 2. 🚀 카테고리 목록을 한 번만 가져오기 (9번 → 1번으로 최적화!)
    const allCategories = await getAllCategories();
    
    // 3. 각 섹션 설정에서 카테고리 찾기 (API 호출 없이 메모리에서 처리)
    const sections = HOME_SECTIONS_CONFIG.map(config => 
      findCategoryWithChildren(config, allCategories)
    );
    
    // 유효한 카테고리만 필터링
    const validSections = sections.filter(section => section.id !== null);
    
    console.log(`📋 ${validSections.length}개 섹션 발견`);

    // 3. 각 섹션별 포스트 가져오기 (병렬 처리)
    const sectionDataPromises = validSections.map(section =>
      getPostsForSection(section).then(posts => ({
        ...section,
        posts: posts.map((post, idx) => ({
          ...post,
          id: `sec-${section.id}-${post.id}-${idx}`
        }))
      })).catch(error => {
        console.error(`섹션 ${section.name} 로드 실패:`, error);
        return { ...section, posts: [] };
      })
    );

    const homeSections = await Promise.all(sectionDataPromises);
    
    console.log(`✅ ${homeSections.length}개 섹션 로드 완료: ${Date.now() - startTime}ms`);

    // 4. 슬라이드쇼: 각 섹션의 첫 번째 포스트 (최대 10개)
    const slideshowPosts = homeSections
      .filter(section => section.posts.length > 0)
      .slice(0, 10)
      .map(section => section.posts[0])
      .filter(Boolean)
      .map((post, idx) => ({ 
        ...post, 
        id: `slide-${idx}-${post.id}` 
      }));

    const result = { homeSections, slideshowPosts };

    // 5. 캐시 저장
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
      data: result,
      timestamp: Date.now()
    }));

    console.log('💾 새 데이터 캐시 저장 완료');
    return result;

  } catch (error) {
    console.error('getHomeDataCached error:', error.message);
    
    // 에러 시 만료된 캐시라도 사용
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        console.log('⚠️ 에러 발생, 이전 캐시 사용');
        return JSON.parse(cached).data;
      }
    } catch (cacheError) {
      console.error('캐시 읽기 실패:', cacheError);
    }
    
    return { homeSections: [], slideshowPosts: [] };
  }
};

// 캐시 존재 여부 확인 함수
export const hasHomeDataCache = async () => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    return !!cached;
  } catch {
    return false;
  }
};

// 🗞️ 뉴스 카테고리별 섹션 데이터 가져오기 (오늘 날짜 기준)
// 캐시 버전: 탑뉴스 로직 추가 (v2)
const NEWS_CACHE_KEY = 'NEWS_SECTIONS_CACHE_V2';

export const getNewsSectionsCached = async (forceRefresh = false, targetDate = null) => {
  try {
    const dateStr = targetDate 
      ? targetDate.toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0];
    
    const cacheKey = `${NEWS_CACHE_KEY}_${dateStr}`;
    
    // 1. 캐시 확인
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isExpired = Date.now() - timestamp > CACHE_EXPIRY;
        if (!isExpired) {
          console.log('📦 뉴스 캐시 사용');
          return data;
        }
      }
    }
    
    console.log(`🗞️ ${dateStr} 뉴스 로딩 시작...`);
    
    // 2. 각 카테고리별 뉴스 가져오기 (병렬 처리)
    const sectionPromises = NEWS_SECTIONS_CONFIG.map(async (config) => {
      try {
        // meta.news_category로 필터링
        const response = await api.get(`${MAGAZINE_BASE_URL}/posts`, {
          params: {
            per_page: 10,
            _embed: 1,
            after: `${dateStr}T00:00:00`,
            before: `${dateStr}T23:59:59`,
            // meta_key와 meta_value는 WordPress REST API 기본 지원 안 함
            // 대신 모든 뉴스를 가져와서 필터링
          },
        });
        
        // 해당 카테고리만 필터링
        const filteredPosts = response.data.filter(
          post => post.meta?.news_category === config.categoryKey
        );
        
        return {
          name: config.name,
          categoryKey: config.categoryKey,
          posts: filteredPosts.slice(0, 4).map((post, idx) => ({
            ...post,
            id: `news-${config.categoryKey}-${post.id}-${idx}`
          }))
        };
      } catch (error) {
        console.error(`뉴스 섹션 ${config.name} 로드 실패:`, error.message);
        return { name: config.name, categoryKey: config.categoryKey, posts: [] };
      }
    });
    
    // 모든 뉴스를 한 번에 가져와서 카테고리별로 분류 (더 효율적)
    let allTodayNews = [];
    try {
      const response = await api.get(`${MAGAZINE_BASE_URL}/posts`, {
        params: {
          per_page: 100, // 오늘 뉴스 최대 100개
          _embed: 1,
          after: `${dateStr}T00:00:00`,
          before: `${dateStr}T23:59:59`,
        },
      });
      allTodayNews = response.data;
      console.log(`📰 ${dateStr} 뉴스 ${allTodayNews.length}개 로드`);
      // 디버그: 첫 3개 뉴스의 meta 값 확인
      if (allTodayNews.length > 0) {
        console.log('📋 샘플 뉴스 meta:', allTodayNews.slice(0, 3).map(p => ({
          id: p.id,
          is_top_news: p.meta?.is_top_news,
          news_category: p.meta?.news_category
        })));
      }
    } catch (error) {
      console.error('뉴스 로드 실패:', error.message);
    }
    
    // 2. 🗞️ 뉴스 분류 (Top News + 카테고리별)
    // is_top_news 값은 WordPress에서 '1', 1, true, 'true', 'on' 등 다양하게 저장될 수 있음
    const topNewsPosts = allTodayNews.filter(post => {
      const isTop = post.meta?.is_top_news;
      return isTop === '1' || isTop === 1 || isTop === true || isTop === 'true' || isTop === 'on';
    });
    console.log(`🔥 탑뉴스 ${topNewsPosts.length}개 발견 (전체 ${allTodayNews.length}개 중)`);

    const newsSections = NEWS_SECTIONS_CONFIG.map(config => {
      const categoryPosts = allTodayNews.filter(
        post => post.meta?.news_category === config.categoryKey
      );
      return {
        name: config.name,
        categoryKey: config.categoryKey,
        posts: categoryPosts.map((post, idx) => ({
          ...post,
          id: `news-${config.categoryKey}-${post.id}-${idx}`
        }))
      };
    }).filter(section => section.posts.length > 0); // 뉴스가 있는 섹션만

    // 3. 탑뉴스가 있으면 맨 앞에 추가
    if (topNewsPosts.length > 0) {
      newsSections.unshift({
        name: '🔥 주요 뉴스',
        categoryKey: 'TopNews',
        posts: topNewsPosts.map((post, idx) => ({
          ...post,
          id: `news-TopNews-${post.id}-${idx}`
        }))
      });
    }
    
    const result = { 
      newsSections, 
      totalCount: allTodayNews.length,
      date: dateStr 
    };
    
    // 3. 캐시 저장
    await AsyncStorage.setItem(cacheKey, JSON.stringify({
      data: result,
      timestamp: Date.now()
    }));
    
    console.log(`✅ ${newsSections.length}개 뉴스 섹션 로드 완료`);
    return result;
    
  } catch (error) {
    console.error('getNewsSectionsCached error:', error.message);
    return { newsSections: [], totalCount: 0, date: null };
  }
};

export const wordpressApi = {
  // 매거진 포스트 가져오기
  getMagazinePosts: async (page = 1, perPage = 10) => {
    try {
      const response = await api.get(`${MAGAZINE_BASE_URL}/posts`, {
        params: {
          page,
          per_page: perPage,
          _embed: 1,
        },
      });
      return response.data.map(post => ({ ...post, id: `mag-${post.id}` }));
    } catch (error) {
      console.error('getMagazinePosts error:', error);
      throw error;
    }
  },

  // 카테고리별 포스트 (뉴스 등) + 날짜 필터 추가
  getPostsByCategory: async (categoryId, page = 1, perPage = 10, date = null) => {
    try {
      const params = {
        categories: categoryId,
        page,
        per_page: perPage,
        _embed: 1,
      };

      if (date) {
        const startDate = `${date}T00:00:00`;
        const endDate = `${date}T23:59:59`;
        params.after = startDate;
        params.before = endDate;
      }

      const response = await api.get(`${MAGAZINE_BASE_URL}/posts`, { params });
      return response.data.map(post => ({ ...post, id: `cat-${categoryId}-${post.id}` }));
    } catch (error) {
      console.error('getPostsByCategory error:', error);
      throw error;
    }
  },

  // 게시판 포스트 가져오기 (KBoard RSS 사용)
  getBoardPosts: async (page = 1, perPage = 10) => {
    try {
      const response = await api.get(`https://vnkorlife.com/wp-content/plugins/kboard/rss.php`, {
        params: {
          per_page: perPage,
        },
      });
      
      const rssData = response.data;
      const items = rssData.split('<item>');
      items.shift();

      const posts = items.map((item, index) => {
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || 
                     item.match(/<title>(.*?)<\/title>/)?.[1] || '제목 없음';
        const link = item.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>/)?.[1] ||
                    item.match(/<link>(.*?)<\/link>/)?.[1] || '';
        const description = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ||
                           item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
        const category = item.match(/<category domain=\".*?\"><!\[CDATA\[(.*?)\]\]><\/category>/)?.[1] || '';
        
        const imgMatch = description.match(/<img[^>]+src="([^">]+)"/);
        const imageUrl = imgMatch ? imgMatch[1] : null;

        // 고유 ID 생성 (안전하게 추출)
        const linkId = link ? (link.match(/redirect=(\d+)/)?.[1] || link.match(/content_redirect=(\d+)/)?.[1]) : null;
        const uniqueId = linkId ? `kb-${linkId}-${index}` : `kb-rss-${index}`;

        return {
          id: uniqueId,
          title: { rendered: title },
          content: { rendered: description },
          date: pubDate,
          _embedded: imageUrl ? {
            'wp:featuredmedia': [{
              source_url: imageUrl
            }]
          } : {},
          category_name: category,
          link: link,
          isKBoard: true
        };
      });

      // 중복 제거 (같은 link를 가진 항목 제거)
      const uniquePosts = posts.filter((post, index, self) => 
        index === self.findIndex(p => p.link === post.link)
      );

      return uniquePosts;
    } catch (error) {
      console.error('getBoardPosts error:', error);
      return [];
    }
  },

  // 🚀 슬라이드쇼 포스트 가져오기 (캐시 활용)
  getSlideshowPosts: async () => {
    try {
      const data = await getHomeDataCached();
      return data.slideshowPosts || [];
    } catch (error) {
      console.error('getSlideshowPosts error:', error);
      return [];
    }
  },

  // 🚀 홈 섹션 가져오기 (캐시 활용)
  getHomeSections: async () => {
    try {
      const data = await getHomeDataCached();
      return data.homeSections || [];
    } catch (error) {
      console.error('getHomeSections error:', error);
      return [];
    }
  },

  // 상세 포스트 가져오기
  getPostDetail: async (baseUrl, postId) => {
    try {
      const response = await api.get(`${baseUrl}/posts/${postId}`, {
        params: {
          _embed: 1,
        },
      });
      return response.data;
    } catch (error) {
      console.error('getPostDetail error:', error);
      throw error;
    }
  },

  // 검색어로 포스트 가져오기
  searchPosts: async (searchTerm, page = 1, perPage = 10) => {
    try {
      // 검색어가 비어있으면 빈 배열 반환
      if (!searchTerm || searchTerm.trim().length === 0) {
        return [];
      }
      
      const response = await api.get(`${MAGAZINE_BASE_URL}/posts`, {
        params: {
          search: searchTerm.trim(),
          page,
          per_page: perPage,
          _embed: 1,
        },
      });
      return response.data.map(post => ({ ...post, id: `search-${post.id}` }));
    } catch (error) {
      console.error('searchPosts error:', error);
      // 🔧 에러 시 빈 배열 반환 (무한 루프 방지)
      return [];
    }
  },

  // 카테고리 목록 가져오기 (디버깅 및 설정용)
  getCategories: async (baseUrl) => {
    try {
      const response = await api.get(`${baseUrl}/categories`, {
        params: {
          per_page: 100,
        },
      });
      return response.data;
    } catch (error) {
      console.error('getCategories error:', error);
      throw error;
    }
  }
};

export { MAGAZINE_BASE_URL, BOARD_BASE_URL };
