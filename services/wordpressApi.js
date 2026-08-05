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

/**
 * 매거진 홈(섹션 9개) 전용 타임아웃.
 *
 * 왜 따로 두나: 이 화면만 요청이 11번(카테고리 2 + 섹션 9)이고 앱 시작 시 다른 6개 탭과
 * 동시에 나간다(lazy:false). 실측 2.8초(유선) → 베트남 모바일이면 6~9초라 5초에 자주 걸린다.
 * 그리고 여기서 한 번 실패하면 홈이 통째로 비어 보이므로, 조금 더 기다리는 편이 낫다.
 */
const HOME_REQUEST_TIMEOUT = 12000;

/**
 * 서버 앞단 캐시(LiteSpeed + 호스팅 CDN)를 건너뛰기 위한 시간 도장.
 *
 * 왜 필요한가: 이 REST 주소는 서버 앞단에서 통째로 캐시된다. 그래서 플러그인을 새로
 * 올려도 PHP 가 아예 실행되지 않고 옛 응답이 계속 나간다 — 2026-08-05 실측:
 * 워드프레스 캐시를 비운 뒤에도 `x-litespeed-cache: hit` 로 옛 지면이 나왔고,
 * 주소에 아무 값이나 덧붙이자(= 캐시에 없는 새 주소) 즉시 새 지면이 나왔다.
 *
 * 30분 버킷인 이유: 같은 30분 안의 모든 사용자는 *같은 주소*를 부르므로 캐시 이득은
 * 그대로 두면서(서버 부담 안 늘림) 지연은 최대 30분으로 묶인다.
 * 당겨서 새로고침(forceRefresh)은 그 순간 시각을 찍어 무조건 새로 받는다.
 */
const CACHE_BUST_WINDOW_MS = 30 * 60 * 1000;
const newsCacheBustValue = (forceRefresh) =>
  forceRefresh ? Date.now() : Math.floor(Date.now() / CACHE_BUST_WINDOW_MS);


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
          timeout: HOME_REQUEST_TIMEOUT,
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
      // ⚠️ 실패를 캐시하면 안 된다. 예전엔 여기서 cachedCategories = [] 로 "재시도 방지"를
      // 했는데, 이 변수는 앱이 살아있는 동안 계속 남는다 → 네트워크가 한 번 삐끗해 실패하면
      // 홈의 9개 섹션이 전부 "카테고리 못 찾음"이 되어, 앱을 완전히 껐다 켜기 전까지
      // 매거진 탭이 계속 빈 화면이었다. 실패는 기억하지 않고 다음 호출에서 다시 시도한다.
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
      // 본문(content)은 목록에 필요 없다 — 카드가 쓰는 건 제목·썸네일·날짜뿐이다.
      // 본문까지 받으면 섹션 하나가 167KB(9섹션 = 1.3MB), 저장되는 캐시가 0.78MB 가 되어
      // 탭을 열 때마다 그걸 읽고 파싱하느라 화면이 멈칫한다. 실측 167KB → 29KB.
      // 본문은 기사를 실제로 열 때 PostDetailScreen 이 그 한 건만 받아온다.
      // _links 는 반드시 남겨야 한다 — 이게 없으면 _embed 가 통째로 빠져 썸네일이 사라진다.
      _fields: "id,title,date,link,excerpt,categories,_links",
    };

    const response = await api.get(`${MAGAZINE_BASE_URL}/posts`, {
      params,
      timeout: HOME_REQUEST_TIMEOUT,
    });

    return response.data.slice(0, 4); // 최대 4개
  } catch (error) {
    console.error(`섹션 "${section.name}" 포스트 로드 실패:`, error);
    return [];
  }
};

/**
 * 매거진 홈을 서버가 조립해 준 API 로 한 번에 받아온다.
 *
 * 이게 없던 시절에는 앱이 직접 11번 불렀다 — 카테고리 목록 2페이지(순차)를 받아
 * 섹션별 하위 카테고리를 찾아낸 뒤, 섹션 9개를 병렬로 조회(실측 3.3초).
 * 서버는 그 일을 30분 캐시로 한 번만 하면 된다(뉴스탭이 이미 그렇게 돌고 있다).
 *
 * @returns {object|null} 성공하면 {homeSections, slideshowPosts}, 실패하면 null(→ 기존 방식으로 폴백)
 */
const MAGAZINE_HOME_API_URL =
  "https://chaovietnam.co.kr/wp-json/chaovn/v1/magazine-home";

const fetchMagazineHomeAssembled = async (forceRefresh = false) => {
  try {
    // v = 앞단 캐시(LiteSpeed/CDN) 우회용 시간 도장 — 뉴스 API 와 같은 이유
    const url = `${MAGAZINE_HOME_API_URL}?v=${newsCacheBustValue(forceRefresh)}`;
    const res = await api.get(url, { timeout: HOME_REQUEST_TIMEOUT });
    const data = res.data;
    if (!data?.success || !Array.isArray(data.sections)) return null;

    const homeSections = data.sections.map((section) => ({
      id: section.id,
      name: section.name,
      childIds: [],
      posts: (section.posts || []).map((post, idx) => ({
        // 화면 목록 key 용 id (기존 형식 유지) + 원본 글번호 보관
        id: `sec-${section.id}-${post.postId}-${idx}`,
        postId: post.postId,
        title: post.title,
        date: post.date,
        link: post.link,
        categories: post.categories || [],
        _embedded: {
          "wp:featuredmedia": [{ source_url: post.thumbnail || undefined }],
        },
      })),
    }));

    // 기사가 하나도 없으면 실패로 취급 — 빈 화면을 캐시하지 않는다
    if (!homeSections.some((s) => s.posts.length > 0)) return null;

    const slideshowPosts = homeSections
      .filter((s) => s.posts.length > 0)
      .slice(0, 10)
      .map((s) => s.posts[0])
      .filter(Boolean)
      .map((post, idx) => ({ ...post, id: `slide-${idx}-${post.id}` }));

    // 이번 호 (표지 + 목차) — 서버가 호를 아직 지정 안 했으면 null
    const ci = data.currentIssue;
    const currentIssue = ci
      ? {
          ...ci,
          posts: (ci.posts || []).map((post, idx) => ({
            id: `issue-${ci.id}-${post.postId}-${idx}`,
            postId: post.postId,
            title: post.title,
            date: post.date,
            link: post.link,
            section: post.section || "",
            categories: post.categories || [],
            _embedded: {
              "wp:featuredmedia": [{ source_url: post.thumbnail || undefined }],
            },
          })),
        }
      : null;

    return { homeSections, slideshowPosts, currentIssue };
  } catch (error) {
    // 플러그인이 아직 안 올라갔거나 서버 오류 → 조용히 기존 방식으로 폴백
    console.log("매거진 홈 조립 API 미사용:", error?.message);
    return null;
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
        // 만료됐어도 *일단 돌려준다*. 예전엔 여기서 곧장 네트워크로 넘어가 3~9초를 기다렸고,
        // 그 동안 화면은 비어 있었다. 옛 목록이라도 즉시 보여주는 편이 낫다.
        // _stale 표시를 보고 화면이 뒤에서 조용히 갱신한다(→ MagazineScreen).
        if (data?.homeSections?.length) {
          console.log("⏰ 캐시 만료 — 옛 데이터 먼저 표시하고 뒤에서 갱신");
          return { ...data, _stale: true };
        }
        console.log("⏰ 캐시 만료(내용 없음), 새 데이터 로드");
      }
    }

    console.log("🌐 API 호출 시작...");
    const startTime = Date.now();

    // 2-0. 🚀 서버가 조립해 주는 매거진 홈 API 를 먼저 시도한다 (호출 11번 → 1번).
    //      실패하면(플러그인 미설치·서버 오류) 아래 기존 방식으로 그대로 내려간다.
    //      그래서 이 코드는 플러그인이 올라가기 전에 배포돼도 안전하다.
    const assembled = await fetchMagazineHomeAssembled(forceRefresh);
    if (assembled) {
      console.log(`✅ 매거진 홈(서버 조립) 로드: ${Date.now() - startTime}ms`);
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data: assembled, timestamp: Date.now() }),
      );
      return assembled;
    }

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
          // 응답을 통째로 들고 있지 말고 *화면이 실제로 쓰는 것만* 남긴다.
          // WordPress 응답에는 _links(글마다 수십 개 URL)와 _embedded 안의 부가정보가
          // 딸려오는데, 이걸 그대로 캐시에 저장하면 316KB → 탭 열 때마다 그 JSON 을
          // 읽고 파싱하느라 화면이 멈칫한다. 필요한 것만 남기면 29KB.
          posts: posts.map((post, idx) => ({
            // id 는 화면 목록의 key 용(중복 방지) — 원본 글 번호는 postId 로 따로 보관한다.
            // 상세화면이 본문을 받아올 때 이 번호가 필요하다.
            id: `sec-${section.id}-${post.id}-${idx}`,
            postId: post.id,
            title: post.title,
            date: post.date,
            link: post.link,
            excerpt: post.excerpt, // 본문 조회 실패 시 대체 표시용
            categories: post.categories, // 상세화면 측정(뉴스/매거진 구분)에 쓰인다
            _embedded: {
              "wp:featuredmedia": [
                {
                  source_url:
                    post._embedded?.["wp:featuredmedia"]?.[0]?.source_url,
                },
              ],
            },
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

    // 5. 캐시 저장 — 단, *내용이 있을 때만*.
    // ⚠️ 예전엔 결과가 비어도 그대로 저장했다. 그래서 네트워크가 한 번 삐끗해 섹션을 0개
    // 받으면 "빈 화면"이 6시간짜리 캐시로 굳어, 앱을 껐다 켜도 6시간 동안 매거진 탭이
    // 비어 있었다. 빈 결과는 저장하지 않고, 있던 캐시(옛 목록)를 그대로 돌려준다.
    const hasContent = homeSections.some((s) => s.posts && s.posts.length > 0);
    if (!hasContent) {
      console.warn("⚠️ 홈 데이터가 비어 있음 — 캐시에 저장하지 않고 이전 데이터 유지");
      try {
        const prev = await AsyncStorage.getItem(CACHE_KEY);
        if (prev) {
          const prevData = JSON.parse(prev).data;
          if (prevData?.homeSections?.length) return prevData;
        }
      } catch (e) {
        console.error("이전 캐시 읽기 실패:", e);
      }
      return result;
    }

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
// V6: 목록에서 본문 제거(light=1) + postId 보존 → 다시 형태가 달라진다.
const NEWS_CACHE_KEY = "NEWS_SECTIONS_CACHE_V6";
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
    //    v     = 앞단 캐시 우회용 시간 도장 (newsCacheBustValue 주석 참고)
    //    light = 목록에 안 쓰는 기사 본문을 빼고 받는다(응답의 78%가 본문이었다).
    //            본문은 기사를 열 때 PostDetailScreen 이 그 한 건만 받아온다.
    const query = `?${allowBackfill ? "fill=1&" : ""}light=1&v=${newsCacheBustValue(forceRefresh)}`;
    const apiUrl = targetDate
      ? `${NEWS_TERMINAL_API_URL}/${dateStr}${query}`
      : `${NEWS_TERMINAL_API_URL}${query}`;

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
          // id 는 화면 목록의 key 용이라 원본 글번호를 따로 보관한다 —
          // 상세화면이 본문을 받아올 때 필요하다(light=1 로 본문이 안 오므로).
          postId: post.id,
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
              postId: post.id, // 상세화면 본문 조회용 (위 탑뉴스 주석 참고)
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
/**
 * 한 호의 전체 기사를 꼭지별로 묶어 받아온다 ("이번 호 기사" 화면).
 * number 를 안 주면 현재 호. 서버가 이미 묶어 주므로 앱은 그리기만 한다.
 */
export const getMagazineIssue = async (number = null) => {
  try {
    const q = `?${number ? `number=${number}&` : ""}v=${newsCacheBustValue(false)}`;
    const res = await api.get(
      `https://chaovietnam.co.kr/wp-json/chaovn/v1/magazine-issue${q}`,
      { timeout: HOME_REQUEST_TIMEOUT },
    );
    if (!res.data?.success) return null;
    return res.data; // { issue, groups:[{section, posts:[...]}], total }
  } catch (error) {
    console.log("호 기사 조회 실패:", error?.message);
    return null;
  }
};

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
