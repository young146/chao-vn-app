import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MAGAZINE_BASE_URL = "https://chaovietnam.co.kr/wp-json/wp/v2";
const BOARD_BASE_URL = "https://vnkorlife.com/wp-json/wp/v2";

// 캐시 설정
const CACHE_KEY = "HOME_DATA_CACHE";
const HOME_CACHE_EXPIRY = 6 * 60 * 60 * 1000; // 6시간 (격주 발행, OTA 업데이트 시 자동 삭제)
const NEWS_CACHE_EXPIRY = 2 * 60 * 60 * 1000; // 2시간 (하루 1-2회 업데이트)

const api = axios.create({
  timeout: 5000, // 5초 - 느린 네트워크에서 빠른 캐시 폴백
});

// 뉴스 카테고리 섹션 정의 (WordPress 사이트와 동일한 순서)
const NEWS_SECTIONS_CONFIG = [
  { id: null, name: "경제", categoryKey: "Economy" },
  { id: null, name: "사회", categoryKey: "Society" },
  { id: null, name: "문화", categoryKey: "Culture" },
  { id: null, name: "정치", categoryKey: "Politics" },
  { id: null, name: "국제", categoryKey: "International" },
  { id: null, name: "한-베", categoryKey: "Korea-Vietnam" },
  { id: null, name: "여행", categoryKey: "Travel" },
  { id: null, name: "건강", categoryKey: "Health" },
  { id: null, name: "음식", categoryKey: "Food" },
];

// 홈 화면 섹션 정의 (ID 우선, 없으면 이름으로 매칭)
const HOME_SECTIONS_CONFIG = [
  { id: 32, name: "교민소식", searchNames: ["교민 소식", "교민소식"] }, // 기존 ID
  {
    id: 445,
    name: "비즈니스&사회",
    searchNames: ["Xinchao BIZ", "XINCHO BIZ", "비즈니스", "사회"],
  }, // 기존 ID
  {
    id: 13,
    name: "칼럼&오피니언",
    searchNames: ["컬럼", "칼럼", "COLUMN"],
    // 컬럼(13, 하위 25개 = 1,230편) 이 칼럼 재고의 본체다.
    // CHAO COLUMN(382, 107편) 은 13 의 자식이 아니라 별개 최상위라 자동 병합되지 않아 함께 지정한다.
    extraIds: [382],
  }, // 13 = 컬럼(column-opinion)
  {
    id: 124,
    name: "교육&자녀",
    searchNames: ["Xinchao Edu", "XINCHAO EDU", "교육", "EDU"],
  }, // Xinchao Edu
  {
    id: 427,
    name: "F&R",
    searchNames: ["F&R", "F&amp;R", "Food & Restaurant", "FOOD & RESTAURANT"],
  }, // 기존 ID
  {
    id: 453,
    name: "Health Section",
    searchNames: ["Health Section", "Health", "헬스"],
  },
  {
    id: 413,
    name: "골프&스포츠",
    searchNames: ["GOLF & SPORTS", "GOLF &amp; SPORTS", "골프", "스포츠"],
  }, // 기존 ID
  {
    id: 7,
    name: "라이프&조이&트래블",
    searchNames: ["라이프 & 조이 & 트래블", "라이프", "LIFE", "조이", "JOY"],
  }, // 7 = 라이프&조이&트래블 (부모). 29(TRAVEL, 144편) 은 7 의 자식이라 자동 포함된다.
  {
    id: 456,
    name: "Pet World",
    searchNames: ["Pet World", "pet World", "PET WORLD", "펫"],
  },
];

// 카테고리 페이지 안전장치 (무한 루프 방지)
const MAX_CATEGORY_PAGES = 5;

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

  // 새로 가져오기 — WordPress 는 per_page 최대 100 (그 이상은 400 거부).
  // 카테고리가 100개를 넘으면 뒷 페이지가 통째로 누락되고, 그러면 해당 섹션의
  // 하위 카테고리를 못 찾아 섹션이 비어 보인다. 반드시 전 페이지를 받는다.
  categoriesFetchPromise = (async () => {
    try {
      const all = [];
      let page = 1;
      let totalPages = 1;

      do {
        const response = await api.get(`${MAGAZINE_BASE_URL}/categories`, {
          params: { per_page: 100, page },
        });
        all.push(...response.data);
        totalPages =
          parseInt(response.headers["x-wp-totalpages"], 10) || totalPages;
        page += 1;
      } while (page <= totalPages && page <= MAX_CATEGORY_PAGES);

      cachedCategories = all;
      console.log(`📂 카테고리 ${all.length}개 로드 완료 (${page - 1}페이지)`);
      return all;
    } catch (error) {
      console.error(
        "❌ 카테고리 로드 실패:",
        error.response?.status,
        error.message,
      );
      // 빈 배열 캐시해서 재시도 방지
      cachedCategories = [];
      return [];
    } finally {
      categoriesFetchPromise = null;
    }
  })();

  return categoriesFetchPromise;
};

// 카테고리 ID 또는 이름으로 찾기 및 하위 카테고리 포함 (캐시된 목록 사용)
const findCategoryWithChildren = (config, allCategories) => {
  try {
    let category = null;

    // 1. ID로 직접 찾기
    if (config.id) {
      category = allCategories.find((cat) => cat.id === config.id);
    }

    // 2. ID로 못 찾았거나 ID가 없으면 이름으로 찾기
    if (!category && config.searchNames) {
      for (const searchName of config.searchNames) {
        // 정확히 일치하는 것 찾기
        category = allCategories.find(
          (cat) =>
            cat.name === searchName ||
            cat.name.toLowerCase() === searchName.toLowerCase(),
        );

        if (category) break;

        // 부분 일치 찾기
        category = allCategories.find(
          (cat) =>
            cat.name.includes(searchName) ||
            searchName.includes(cat.name) ||
            cat.name.toLowerCase().includes(searchName.toLowerCase()) ||
            searchName.toLowerCase().includes(cat.name.toLowerCase()),
        );

        if (category) break;
      }
    }

    if (!category) {
      return { id: null, name: config.name, childIds: [] };
    }

    // 하위 카테고리 찾기 (parent가 현재 카테고리 ID인 것들)
    const childrenOf = (parentId) =>
      allCategories.filter((cat) => cat.parent === parentId).map((cat) => cat.id);

    const childIds = childrenOf(category.id);

    // 부모가 다른 최상위 카테고리를 같은 섹션에 합칠 때 (extraIds) — 그 하위까지 포함
    for (const extraId of config.extraIds || []) {
      if (!allCategories.some((cat) => cat.id === extraId)) continue;
      childIds.push(extraId, ...childrenOf(extraId));
    }

    return {
      id: category.id,
      name: config.name,
      displayName: category.name,
      childIds: [...new Set(childIds)],
    };
  } catch (error) {
    console.error(`카테고리 "${config.name}" 조회 실패:`, error);
    return { id: null, name: config.name, childIds: [] };
  }
};

// 각 섹션별 포스트 가져오기 (부모+하위 카테고리 포함, 최신순, 최대 4개)
const getPostsForSection = async (section) => {
  if (!section.id) {
    return [];
  }

  try {
    const allCategoryIds = [section.id, ...(section.childIds || [])].join(",");

    // 날짜 제한 없음 — 매거진은 뉴스가 아니다.
    // 뉴스는 3개월 지나면 가치가 없지만 칼럼·국제학교·비자·계약 정보는 몇 년 전 글도 그대로 유효하다.
    // 3개월 창을 걸면 24년치 자산 중 최근 것만 보이고 섹션이 비어 보인다
    // (예: 칼럼 섹션이 4칸 그리드에 글 1개). 최신순 4개만 뽑으므로 창이 없어도 최신 글이 뜬다.
    const params = {
      categories: allCategoryIds,
      per_page: 4, // 2x2 그리드용
      orderby: "date",
      order: "desc",
      _embed: 1,
    };

    const response = await api.get(`${MAGAZINE_BASE_URL}/posts`, {
      params,
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
        const isExpired = Date.now() - timestamp > HOME_CACHE_EXPIRY;

        if (!isExpired) {
          console.log("📦 캐시 사용 (유효)");
          return data;
        }
        console.log("⏰ 캐시 만료, 새 데이터 로드");
      }
    }

    console.log("🌐 API 호출 시작...");
    const startTime = Date.now();

    // 2. 🚀 카테고리 목록을 한 번만 가져오기 (9번 → 1번으로 최적화!)
    const allCategories = await getAllCategories();

    // 3. 각 섹션 설정에서 카테고리 찾기 (API 호출 없이 메모리에서 처리)
    const sections = HOME_SECTIONS_CONFIG.map((config) =>
      findCategoryWithChildren(config, allCategories),
    );

    // 유효한 카테고리만 필터링
    const validSections = sections.filter((section) => section.id !== null);

    console.log(`📋 ${validSections.length}개 섹션 발견`);

    // 3. 각 섹션별 포스트 가져오기 (병렬 처리)
    const sectionDataPromises = validSections.map((section) =>
      getPostsForSection(section)
        .then((posts) => ({
          ...section,
          posts: posts.map((post, idx) => ({
            ...post,
            id: `sec-${section.id}-${post.id}-${idx}`,
          })),
        }))
        .catch((error) => {
          console.error(`섹션 ${section.name} 로드 실패:`, error);
          return { ...section, posts: [] };
        }),
    );

    const homeSections = await Promise.all(sectionDataPromises);

    console.log(
      `✅ ${homeSections.length}개 섹션 로드 완료: ${Date.now() - startTime}ms`,
    );

    // 4. 슬라이드쇼: 각 섹션의 첫 번째 포스트 (최대 10개)
    const slideshowPosts = homeSections
      .filter((section) => section.posts.length > 0)
      .slice(0, 10)
      .map((section) => section.posts[0])
      .filter(Boolean)
      .map((post, idx) => ({
        ...post,
        id: `slide-${idx}-${post.id}`,
      }));

    const result = { homeSections, slideshowPosts };

    // 5. 캐시 저장
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        data: result,
        timestamp: Date.now(),
      }),
    );

    console.log("💾 새 데이터 캐시 저장 완료");
    return result;
  } catch (error) {
    console.error("getHomeDataCached error:", error.message);

    // 에러 시 만료된 캐시라도 사용
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        console.log("⚠️ 에러 발생, 이전 캐시 사용");
        return JSON.parse(cached).data;
      }
    } catch (cacheError) {
      console.error("캐시 읽기 실패:", cacheError);
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

// 🗞️ 뉴스 터미널 API (chaovn-news-api 플러그인 사용)
// V4: content 필드 추가 (본문 포함)
// V5: 과거 뉴스 채움(fill) + isPast 필드 추가 → 캐시 형태가 달라져 키를 올린다.
const NEWS_CACHE_KEY = "NEWS_SECTIONS_CACHE_V5";
const NEWS_TERMINAL_API_URL =
  "https://chaovietnam.co.kr/wp-json/chaovn/v1/news-terminal";

/**
 * @param {boolean} forceRefresh 캐시 무시하고 새로 받기
 * @param {Date}    targetDate   조회할 날짜
 * @param {boolean} allowBackfill "오늘의 뉴스"면 true — 섹션이 비면 서버가 과거 기사로 채운다.
 *   사용자가 날짜를 직접 고른 "지난 뉴스 보기"에서는 false 로 줘야 그 날짜 지면이 그대로 나온다.
 *   (서버는 날짜 파라미터만으로는 둘을 구분할 수 없다 — 앱이 오늘도 날짜를 박아 부르기 때문)
 */
export const getNewsSectionsCached = async (
  forceRefresh = false,
  targetDate = null,
  allowBackfill = true,
) => {
  try {
    const dateStr = targetDate
      ? targetDate.toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    // 채운 지면과 안 채운 지면은 내용이 다르므로 캐시도 따로 둔다
    const cacheKey = `${NEWS_CACHE_KEY}_${dateStr}${allowBackfill ? "_f" : ""}`;

    // 1. 캐시 확인
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isExpired = Date.now() - timestamp > NEWS_CACHE_EXPIRY;
        if (!isExpired) {
          console.log("📦 뉴스 캐시 사용");
          return data;
        }
      }
    }

    console.log(`🗞️ ${dateStr} 뉴스 로딩 시작 (새 API)...`);
    const startTime = Date.now();

    // 2. 새 API 호출 (서버에서 이미 정리된 데이터)
    const fillQuery = allowBackfill ? "?fill=1" : "";
    const apiUrl = targetDate
      ? `${NEWS_TERMINAL_API_URL}/${dateStr}${fillQuery}`
      : `${NEWS_TERMINAL_API_URL}${fillQuery}`;

    const response = await api.get(apiUrl);
    const apiData = response.data;

    if (!apiData.success) {
      throw new Error(apiData.error || "API 응답 실패");
    }

    console.log(
      `📰 API 응답: ${apiData.totalCount}개 뉴스, ${apiData.newsSections?.length || 0}개 섹션 (${Date.now() - startTime}ms)`,
    );

    // 3. 데이터 변환 (앱 형식에 맞게)
    const newsSections = [];

    // 탑뉴스 추가
    if (apiData.topNews && apiData.topNews.length > 0) {
      newsSections.push({
        name: "🔥 주요 뉴스",
        categoryKey: "TopNews",
        posts: apiData.topNews.map((post, idx) => ({
          id: `news-TopNews-${post.id}-${idx}`,
          title: post.title,
          content: post.content || { rendered: "" },
          excerpt: post.excerpt,
          date: post.dateISO || post.date,
          link: post.link,
          _embedded: {
            "wp:featuredmedia": post.thumbnail
              ? [{ source_url: post.thumbnail }]
              : [],
          },
          meta: post.meta || {},
        })),
      });
    }

    // 섹션별 뉴스 추가
    if (apiData.newsSections) {
      for (const section of apiData.newsSections) {
        if (section.posts && section.posts.length > 0) {
          newsSections.push({
            name: section.name,
            categoryKey: section.categoryKey || section.key,
            posts: section.posts.map((post, idx) => ({
              id: `news-${section.key}-${post.id}-${idx}`,
              title: post.title,
              content: post.content || { rendered: "" },
              excerpt: post.excerpt,
              date: post.dateISO || post.date,
              link: post.link,
              _embedded: {
                "wp:featuredmedia": post.thumbnail
                  ? [{ source_url: post.thumbnail }]
                  : [],
              },
              meta: post.meta || {},
              // 오늘치가 모자라 과거에서 끌어온 기사 → 목록에서 날짜를 붙여 구분
              isPast: !!post.isPast,
            })),
          });
        }
      }
    }

    const result = {
      newsSections,
      totalCount: apiData.totalCount || 0,
      date: apiData.date || dateStr,
    };

    // 4. 캐시 저장
    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({
        data: result,
        timestamp: Date.now(),
      }),
    );

    console.log(
      `✅ ${newsSections.length}개 뉴스 섹션 로드 완료 (${Date.now() - startTime}ms)`,
    );
    return result;
  } catch (error) {
    console.error("getNewsSectionsCached error:", error.message);

    // 에러 시 캐시 사용 시도
    try {
      const dateStr = targetDate
        ? targetDate.toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];
      const cacheKey = `${NEWS_CACHE_KEY}_${dateStr}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        console.log("⚠️ 에러 발생, 이전 캐시 사용");
        return JSON.parse(cached).data;
      }
    } catch (cacheError) {
      console.error("캐시 읽기 실패:", cacheError);
    }

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
      return response.data.map((post) => ({ ...post, id: `mag-${post.id}` }));
    } catch (error) {
      console.error("getMagazinePosts error:", error);
      throw error;
    }
  },

  // 카테고리별 포스트 (뉴스 등) + 날짜 필터 추가
  getPostsByCategory: async (
    categoryId,
    page = 1,
    perPage = 10,
    date = null,
  ) => {
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
      return response.data.map((post) => ({
        ...post,
        id: `cat-${categoryId}-${post.id}`,
      }));
    } catch (error) {
      console.error("getPostsByCategory error:", error);
      throw error;
    }
  },

  // 게시판 포스트 가져오기 (KBoard RSS 사용)
  getBoardPosts: async (page = 1, perPage = 10) => {
    try {
      const response = await api.get(
        `https://vnkorlife.com/wp-content/plugins/kboard/rss.php`,
        {
          params: {
            per_page: perPage,
          },
        },
      );

      const rssData = response.data;
      const items = rssData.split("<item>");
      items.shift();

      const posts = items.map((item, index) => {
        const title =
          item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
          item.match(/<title>(.*?)<\/title>/)?.[1] ||
          "제목 없음";
        const link =
          item.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>/)?.[1] ||
          item.match(/<link>(.*?)<\/link>/)?.[1] ||
          "";
        const description =
          item.match(
            /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/,
          )?.[1] ||
          item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ||
          "";
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
        const category =
          item.match(
            /<category domain=\".*?\"><!\[CDATA\[(.*?)\]\]><\/category>/,
          )?.[1] || "";

        const imgMatch = description.match(/<img[^>]+src="([^">]+)"/);
        const imageUrl = imgMatch ? imgMatch[1] : null;

        // 고유 ID 생성 (안전하게 추출)
        const linkId = link
          ? link.match(/redirect=(\d+)/)?.[1] ||
          link.match(/content_redirect=(\d+)/)?.[1]
          : null;
        const uniqueId = linkId ? `kb-${linkId}-${index}` : `kb-rss-${index}`;

        return {
          id: uniqueId,
          title: { rendered: title },
          content: { rendered: description },
          date: pubDate,
          _embedded: imageUrl
            ? {
              "wp:featuredmedia": [
                {
                  source_url: imageUrl,
                },
              ],
            }
            : {},
          category_name: category,
          link: link,
          isKBoard: true,
        };
      });

      // 중복 제거 (같은 link를 가진 항목 제거)
      const uniquePosts = posts.filter(
        (post, index, self) =>
          index === self.findIndex((p) => p.link === post.link),
      );

      return uniquePosts;
    } catch (error) {
      console.error("getBoardPosts error:", error);
      return [];
    }
  },

  // 🚀 슬라이드쇼 포스트 가져오기 (캐시 활용)
  getSlideshowPosts: async () => {
    try {
      const data = await getHomeDataCached();
      return data.slideshowPosts || [];
    } catch (error) {
      console.error("getSlideshowPosts error:", error);
      return [];
    }
  },

  // 🚀 홈 섹션 가져오기 (캐시 활용)
  getHomeSections: async () => {
    try {
      const data = await getHomeDataCached();
      return data.homeSections || [];
    } catch (error) {
      console.error("getHomeSections error:", error);
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
      console.error("getPostDetail error:", error);
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
      return response.data.map((post) => ({
        ...post,
        id: `search-${post.id}`,
      }));
    } catch (error) {
      console.error("searchPosts error:", error);
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
      console.error("getCategories error:", error);
      throw error;
    }
  },
};

// ============================================================================
// 뉴스 섹션 기능 (앱 전용)
// ============================================================================

const JENNY_API_URL = "https://chaovietnam.co.kr/wp-json/jenny/v1";

// 기본 섹션 목록 (jenny API가 없을 때 폴백)
const DEFAULT_SECTIONS = [
  { key: 'economy', name: '📈 경제' },
  { key: 'society', name: '👥 사회' },
  { key: 'culture', name: '🎭 문화/스포츠' },
  { key: 'realestate', name: '🏠 부동산' },
  { key: 'politics', name: '⚖️ 정치/정책' },
  { key: 'world', name: '🌏 국제' },
  { key: 'korea_vietnam', name: '🇰🇷🇻🇳 한-베' },
  { key: 'gyominNews', name: '📣 교민소식' },
  { key: 'travel', name: '✈️ 여행' },
  { key: 'health', name: '💊 건강' },
  { key: 'food', name: '🍜 음식' },
  { key: 'other', name: '✨ 기타' },
];

/**
 * 섹션 목록 가져오기 (WordPress에서 동적으로 로드, 실패 시 기본값 사용)
 */
let cachedSections = null;
export const getSectionsList = async () => {
  try {
    // 캐시가 있으면 반환
    if (cachedSections) {
      return cachedSections;
    }

    const response = await api.get(`${JENNY_API_URL}/sections`);
    if (response.data.success && response.data.data && response.data.data.length > 0) {
      cachedSections = response.data.data;
      return cachedSections;
    }
    return DEFAULT_SECTIONS;
  } catch (error) {
    console.log("섹션 목록 API 불가, 기본 섹션 사용");
    return DEFAULT_SECTIONS;
  }
};

/**
 * 특정 섹션의 뉴스 가져오기
 */
export const getSectionNews = async (sectionKey, categoryId, page = 1) => {
  try {
    const response = await api.get(`${JENNY_API_URL}/section-news`, {
      params: {
        section: sectionKey,
        category: categoryId,
        page: page,
        per_page: 10,
      },
    });

    if (response.data.success) {
      return {
        posts: response.data.posts || [],
        hasMore: response.data.has_more || false,
        totalPages: response.data.total_pages || 1,
      };
    }

    return { posts: [], hasMore: false, totalPages: 1 };
  } catch (error) {
    console.error("Failed to fetch section news:", error);
    return { posts: [], hasMore: false, totalPages: 1 };
  }
};

/**
 * 마켓 정보(날씨·환율·항공권·주가 + 시계열) 가져오기 — 뉴스 탭 상단 카드용.
 * jenny/v1/market 엔드포인트. 실패 시 null 반환 → 화면에서 카드 영역 숨김.
 */
export const getMarketData = async () => {
  try {
    // 캐시 우회: 서버(LiteSpeed)가 /market REST 응답을 페이지 캐시로 물고 있으면
    // 플러그인을 새로 올려도 앱은 '옛 스냅샷'(hotel_agoda·flights 누락)을 계속 받는다.
    // 매 호출마다 고유 쿼리를 붙여 항상 MISS(=신선한 데이터)로 받게 한다.
    // (무거운 외부 API는 PHP transient로 따로 캐시되므로 서버 부하 영향 미미)
    const response = await api.get(`${JENNY_API_URL}/market`, {
      params: { _ts: Date.now() },
    });
    if (response.data && response.data.success) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.log("마켓 정보 API 불가:", error?.message || error);
    return null;
  }
};

export { MAGAZINE_BASE_URL, BOARD_BASE_URL };
