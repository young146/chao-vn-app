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

// 카테고리 ID 또는 이름으로 찾기 및 하위 카테고리 포함
const findCategoryWithChildren = async (config) => {
  try {
    // 모든 카테고리 가져오기 (한 번만 호출)
    const response = await api.get(`${MAGAZINE_BASE_URL}/categories`, {
      params: {
        per_page: 100,
      },
    });

    const allCategories = response.data;
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
      console.warn(`카테고리 "${config.name}" (ID: ${config.id})을 찾을 수 없습니다.`);
      return { id: null, name: config.name, childIds: [] };
    }

    // 하위 카테고리 찾기 (parent가 현재 카테고리 ID인 것들)
    const childCategories = allCategories.filter(cat => 
      cat.parent === category.id
    );

    const childIds = childCategories.map(cat => cat.id);

    console.log(`✅ 카테고리 찾음: "${category.name}" (ID: ${category.id}, 하위: ${childIds.length}개)`);

    return {
      id: category.id,
      name: config.name, // 사용자에게 보여줄 이름
      displayName: category.name, // 실제 카테고리 이름
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
    
    // 2. 카테고리 ID 또는 이름으로 찾기 및 하위 카테고리 포함 (병렬 처리)
    const categoryPromises = HOME_SECTIONS_CONFIG.map(config => findCategoryWithChildren(config));
    const sections = await Promise.all(categoryPromises);
    
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

        // 고유 ID 생성: linkId + index 조합으로 중복 방지
        const linkId = link.match(/redirect=(\d+)/)?.[1] || 
                      link.match(/content_redirect=(\d+)/)?.[1] || 
                      null;
        
        // 고유 ID 생성 (linkId가 있으면 사용, 없으면 index 사용)
        // index를 포함하여 같은 linkId라도 고유하게 만듦
        const uniqueId = linkId 
          ? `kb-${linkId}-${index}` 
          : `kb-rss-${index}`;

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
      const response = await api.get(`${MAGAZINE_BASE_URL}/posts`, {
        params: {
          search: searchTerm,
          page,
          per_page: perPage,
          _embed: 1,
        },
      });
      return response.data.map(post => ({ ...post, id: `search-${post.id}` }));
    } catch (error) {
      console.error('searchPosts error:', error);
      throw error;
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
