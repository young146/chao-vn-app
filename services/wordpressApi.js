import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAGAZINE_BASE_URL = 'https://chaovietnam.co.kr/wp-json/wp/v2';
const BOARD_BASE_URL = 'https://vnkorlife.com/wp-json/wp/v2';

// 캐시 설정
const CACHE_KEY = 'HOME_DATA_CACHE';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5분

const api = axios.create({
  timeout: 8000, // 10초 → 8초로 단축
});

// 홈 화면 섹션 정의 (공통으로 사용)
const HOME_SECTIONS = [
  { id: 32, name: '교민소식' },
  { id: 445, name: 'Xinchao BIZ' },
  { id: 382, name: '컬럼' },
  { id: 427, name: 'F&R' },
  { id: 413, name: 'Golf & Sports' }
];

// 🚀 최적화된 홈 데이터 로드 함수 (캐시 + 단일 API 호출)
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

    // 2. 단일 API 호출로 모든 카테고리 데이터 가져오기
    const categoryIds = HOME_SECTIONS.map(s => s.id).join(',');
    
    console.log('🌐 API 호출 시작...');
    const startTime = Date.now();
    
    const response = await api.get(`${MAGAZINE_BASE_URL}/posts`, {
      params: {
        categories: categoryIds,
        per_page: 25, // 5개 섹션 × 5개 = 25개면 충분
        _embed: 1,
      },
    });
    
    console.log(`✅ API 응답 완료: ${Date.now() - startTime}ms`);

    // 3. 카테고리별로 그룹핑
    const groupedData = {};
    HOME_SECTIONS.forEach(section => {
      groupedData[section.id] = {
        ...section,
        posts: []
      };
    });

    response.data.forEach(post => {
      // 포스트가 속한 카테고리 찾기
      const postCategories = post.categories || [];
      for (const catId of postCategories) {
        if (groupedData[catId] && groupedData[catId].posts.length < 4) {
          groupedData[catId].posts.push({
            ...post,
            id: `sec-${catId}-${post.id}`
          });
          break; // 하나의 섹션에만 추가
        }
      }
    });

    const homeSections = Object.values(groupedData);
    
    // 4. 슬라이드쇼: 각 섹션의 첫 번째 포스트
    const slideshowPosts = homeSections
      .map(section => section.posts[0])
      .filter(Boolean)
      .map((post, idx) => ({ 
        ...post, 
        id: `slide-${idx}-${post.id.replace('sec-', '')}` 
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
      // KBoard RSS 피드 URL (vnkorlife.com)
      // RSS는 페이지네이션을 지원하지 않을 수 있지만, 최신 글을 가져오기에 적합함
      const response = await api.get(`https://vnkorlife.com/wp-content/plugins/kboard/rss.php`, {
        params: {
          per_page: perPage,
        },
      });
      
      const rssData = response.data;
      const items = rssData.split('<item>');
      items.shift(); // 첫 번째 요소는 채널 정보이므로 제거

      const posts = items.map((item, index) => {
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || 
                     item.match(/<title>(.*?)<\/title>/)?.[1] || '제목 없음';
        const link = item.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>/)?.[1] ||
                    item.match(/<link>(.*?)<\/link>/)?.[1] || '';
        const description = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ||
                           item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
        const category = item.match(/<category domain=\".*?\"><!\[CDATA\[(.*?)\]\]><\/category>/)?.[1] || '';
        
        // 이미지 추출 (description 내의 첫 번째 img 태그)
        const imgMatch = description.match(/<img[^>]+src="([^">]+)"/);
        const imageUrl = imgMatch ? imgMatch[1] : null;

        // 고유 ID 생성 (링크에서 숫자 추출 시도, 실패 시 인덱스 활용)
        const linkId = link.match(/redirect=(\d+)/)?.[1] || 
                      link.match(/content_redirect=(\d+)/)?.[1] || 
                      `rss-item-${index}`;

        // WordPress 포스트 형식과 유사하게 변환
        return {
          id: `kb-${linkId}`,
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

      return posts;
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

