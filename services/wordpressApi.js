import axios from 'axios';

const MAGAZINE_BASE_URL = 'https://chaovietnam.co.kr/wp-json/wp/v2';
const BOARD_BASE_URL = 'https://vnkorlife.com/wp-json/wp/v2';

const api = axios.create({
  timeout: 10000,
});

export const wordpressApi = {
  // 매거진 포스트 가져오기
  getMagazinePosts: async (page = 1, perPage = 10) => {
    try {
      const response = await api.get(`${MAGAZINE_BASE_URL}/posts`, {
        params: {
          page,
          per_page: perPage,
          _embed: 1, // 특성 이미지 등을 포함하기 위해 필요
        },
      });
      return response.data;
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
        // WordPress REST API는 ISO8601 형식을 사용 (YYYY-MM-DDTHH:MM:SS)
        // 특정 날짜의 시작과 끝을 지정
        const startDate = `${date}T00:00:00`;
        const endDate = `${date}T23:59:59`;
        params.after = startDate;
        params.before = endDate;
      }

      const response = await api.get(`${MAGAZINE_BASE_URL}/posts`, { params });
      return response.data;
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

      const posts = items.map(item => {
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

        // WordPress 포스트 형식과 유사하게 변환
        return {
          id: link.match(/redirect=(\d+)/)?.[1] || Math.random().toString(),
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

  // 슬라이드쇼 포스트 가져오기 (특정 섹션들의 최신 기사를 하나씩 조합)
  getSlideshowPosts: async () => {
    const sections = [
      { id: 32, name: '교민소식' },
      { id: 445, name: 'Xinchao BIZ' },
      { id: 382, name: '컬럼' },
      { id: 427, name: 'F&R' },
      { id: 413, name: 'Golf & Sports' }
    ];

    try {
      // 각 섹션에서 가장 최신 기사 1개씩만 가져옴 (데일리 뉴스 제외)
      const results = await Promise.all(
        sections.map(async (section) => {
          const response = await api.get(`${MAGAZINE_BASE_URL}/posts`, {
            params: {
              categories: section.id,
              per_page: 1,
              _embed: 1,
            },
          });
          return response.data[0];
        })
      );
      // 데이터가 있는 것만 필터링
      return results.filter(post => !!post);
    } catch (error) {
      console.error('getSlideshowPosts error:', error);
      return [];
    }
  },

  // 특정 카테고리들의 최신 포스트들을 가져와서 홈 섹션 구성용으로 반환
  getHomeSections: async () => {
    const sections = [
      { id: 32, name: '교민소식' },
      { id: 445, name: 'Xinchao BIZ' },
      { id: 382, name: '컬럼' },
      { id: 427, name: 'F&R' },
      { id: 413, name: 'Golf & Sports' }
    ];

    try {
      const results = await Promise.all(
        sections.map(async (section) => {
          const response = await api.get(`${MAGAZINE_BASE_URL}/posts`, {
            params: {
              categories: section.id,
              per_page: 4, 
              _embed: 1,
            },
          });
          return { ...section, posts: response.data };
        })
      );
      return results;
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
      return response.data;
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

