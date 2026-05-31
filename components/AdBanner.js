import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, Image, TouchableOpacity, Linking, Platform, Modal, Text, Dimensions, ScrollView } from "react-native";
let VideoView = () => null;
let useVideoPlayer = () => null;
try {
  const expoVideo = require('expo-video');
  VideoView = expoVideo.VideoView;
  useVideoPlayer = expoVideo.useVideoPlayer;
} catch (e) {
  console.log('⚠️ expo-video 네이티브 모듈 없음 - 영상 광고 비활성화');
}
import {
  fetchAppAdsConfig,
  trackAppAdClick,
} from "../services/FirebaseAdService";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// ============================================
// 🎯 ChaoVN 광고 시스템 v3.0
// Firestore "app_ads" 기반 (daily-news-final 어드민에서 관리)
// 데이터 fetch만 services/FirebaseAdService로 위임하고
// 컴포넌트/슬롯/스타일은 기존 구조 그대로 유지합니다.
// ============================================


// ============================================
// 설정
// ============================================
const CACHE_DURATION = 10 * 60 * 1000; // 10분 캐시 (FirebaseAdService 내부 5분 캐시와 별개)


// 광고 슬롯 정의 (WordPress와 동일)
const AD_SLOTS = {
  HOME_BANNER: 'home_banner',      // 홈 대형 배너
  HOME_INLINE: 'home_inline',      // 홈 섹션 사이
  HEADER: 'header',                // 리스트 상단 배너
  INLINE: 'inline',                // 리스트 인라인 광고
  DETAIL_TOP: 'detail_top',        // 상세 페이지 상단
  DETAIL_MIDDLE: 'detail_middle',  // 상세 페이지 중간
  DETAIL_BOTTOM: 'detail_bottom',  // 상세 페이지 하단
  POPUP: 'popup',                  // 전면 팝업 광고
};

// 화면(섹션) 정의
const AD_SCREENS = {
  ALL: 'all',
  HOME: 'home',
  NEWS: 'news',
  JOB: 'job',
  REALESTATE: 'realestate',
  DANGGN: 'danggn',
};

// ============================================
// 캐시 (화면별 개별 보관 — 탭 전환 시 서로 덮어쓰지 않음)
// ============================================
const screenAdsCache = {}; // { [screen]: { ads, time } }

// 해석된 광고 결과를 '만료 없이' 보관한다.
// → 컴포넌트가 리마운트(네비게이션/리스트 리렌더)돼도 캐시에서 즉시 시드되어
//   회색 빈 박스/깜빡임 없이 바로 광고가 뜬다. (루트에 한 번 마운트되는 하단배너가 안정적인 것과 동일한 효과)
const resolvedAdsCache = {}; // { [key]: ad[] }

// 이미지를 미리 받아둔다(이미 캐시면 무비용). 표시 직전 백지(다운로드 대기) 방지.
const prefetchAdImages = (ads) => {
  for (const a of ads || []) {
    if (a?.imageUrl) Image.prefetch(a.imageUrl).catch(() => {});
  }
};

// ============================================
// 인라인 광고 중복 방지 (인덱스 기반)
// ============================================
let inlineAdCounter = 0;
let lastInlineScreen = null;
let inlineAdsCount = 0; // 사용 가능한 인라인 광고 수

// 화면 전환 시 카운터 초기화
const getInlineAdIndex = (screen) => {
  if (lastInlineScreen !== screen) {
    inlineAdCounter = 0;
    lastInlineScreen = screen;
  }
  return inlineAdCounter++;
};

// 인라인 광고 수 설정
const setInlineAdsCount = (count) => {
  inlineAdsCount = count;
};

// 현재 인덱스가 광고 수를 초과하는지 확인
const isInlineAdAvailable = (index) => {
  return index < inlineAdsCount;
};

const AdMediaVideo = ({ videoUrl, style, thumbnailUrl }) => {
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

  // ── 단일 player: 배너와 전체화면 VideoView 공유 ──
  // expo-video는 하나의 player를 여러 VideoView에 바인딩 가능
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // mount 이후 재생 보장 + unmount 시 player 정리
  useEffect(() => {
    if (!player || __DEV__) return;
    setPlayerReady(true);
    try {
      player.muted = true;
      player.play();
    } catch (e) {}

    // ★ 핵심: unmount 시 ExoPlayer release → IllegalStateException 방지
    return () => {
      setPlayerReady(false);
      try {
        player.pause();
      } catch (e) {}
    };
  }, [player]);

  // 음소거 토글 동기화
  useEffect(() => {
    if (player && playerReady) {
      try { player.muted = isMuted; } catch (e) {}
    }
  }, [isMuted, player, playerReady]);

  const openFullscreen = () => {
    if (!player || !playerReady) return;
    setIsFullscreen(true);
    // 전체화면에서는 음소거 해제 후 처음부터 재생
    try {
      player.muted = false;
      player.loop = false;
      player.play();
    } catch (e) {}
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
    if (!player || !playerReady) return;
    // 배너로 돌아갈 때 loop + mute 복원
    try {
      player.muted = isMuted;
      player.loop = true;
      player.play();
    } catch (e) {}
  };

  // ── 개발 환경: 썸네일 표시 ──
  if (__DEV__) {
    return (
      <View style={[style, { position: 'relative', backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }]}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 12, opacity: 0.7 }}>🎦 광고 영상 (빌드 후 재생)</Text>
        )}
        <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>DEV</Text>
        </View>
      </View>
    );
  }

  // ── 프로덕션: 단일 player를 배너/전체화면에서 공유 ──
  return (
    <View style={[style, { position: 'relative' }]}>
      {/* 배너 영상 */}
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        nativeControls={false}
      />

      {/* 탭 오버레이 → 전체화면 열기 */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={openFullscreen}
        activeOpacity={0.9}
      />

      {/* 음소거 버튼 — zIndex로 오버레이 위에 표시 */}
      <TouchableOpacity
        style={[styles.muteButton, { zIndex: 10 }]}
        onPress={(e) => {
          e.stopPropagation?.();
          const next = !isMuted;
          setIsMuted(next);
          if (player) player.muted = next;
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.muteIcon}>{isMuted ? '🔇' : '🔊'}</Text>
      </TouchableOpacity>

      {/* 전체화면 Modal — 같은 player 사용 */}
      <Modal
        visible={isFullscreen}
        transparent={false}
        animationType="fade"
        onRequestClose={closeFullscreen}
        statusBarTranslucent
        supportedOrientations={['portrait', 'landscape']}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <VideoView
            player={player}
            style={{ flex: 1 }}
            contentFit="contain"
            nativeControls={true}
          />
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: Platform.OS === 'ios' ? 50 : 20,
              right: 20,
              backgroundColor: 'rgba(0,0,0,0.7)',
              borderRadius: 20,
              width: 40,
              height: 40,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={closeFullscreen}
          >
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const AdMedia = ({ ad, style, thumbnailKey = null, active = true, isVisible = true }) => {
  const [loaded, setLoaded] = useState(false);

  if (ad?.videoUrl) {
    const thumbUrl = thumbnailKey && ad?.thumbnails?.[thumbnailKey]
      ? ad.thumbnails[thumbnailKey]
      : ad?.thumbnailUrl || ad?.imageUrl || null;
    // 비활성 슬롯(띠에서 화면 밖)인 영상은 플레이어 대신 정지 썸네일로 표시.
    // → 여러 영상이 동시에 재생되어 메모리/성능을 잡아먹는 것을 방지.
    if (!active) {
      if (thumbUrl) {
        return (
          <View style={[style, { overflow: 'hidden', backgroundColor: '#111' }]}>
            <Image source={{ uri: thumbUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          </View>
        );
      }
      return <View style={[style, { backgroundColor: '#111' }]} />;
    }
    return <AdMediaVideo videoUrl={ad.videoUrl} style={style} thumbnailUrl={thumbUrl} />;
  }

  // 이미지 표시
  const imageUrl = thumbnailKey && ad?.thumbnails?.[thumbnailKey]
    ? ad.thumbnails[thumbnailKey]
    : ad?.imageUrl;

  if (imageUrl) {
    return (
      <View style={[style, { overflow: 'hidden' }]}>
        {/* blur 배경(보험용): 보이는 슬롯이고 이미지 로드 완료 후에만 렌더.
            - isVisible 가드: 화면 밖 슬롯 N개가 동시에 blur 계산하는 것을 방지
            - loaded 가드: 이미지 완전 로드 전 깨진 프레임이 blur 되어 보이는 현상 방지 */}
        {isVisible && loaded && (
          <Image
            source={{ uri: imageUrl }}
            style={{ position: 'absolute', width: '100%', height: '100%' }}
            resizeMode="cover"
            blurRadius={20}
          />
        )}
        <Image
          source={{ uri: imageUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="contain"
          onLoad={() => setLoaded(true)}
        />
      </View>
    );
  }

  return null;
};

// ============================================
// API 호출
// ============================================

/**
 * 광고 데이터 가져오기 (Firestore "app_ads")
 * @param {string} screen - 화면 타입 (all, home, news, job, realestate, danggn)
 */
const fetchAdConfig = async (screen = 'all') => {
  const now = Date.now();
  const cached = screenAdsCache[screen];
  if (cached && (now - cached.time) < CACHE_DURATION) return cached.ads;

  const config = await fetchAppAdsConfig(screen);
  screenAdsCache[screen] = { ads: config, time: now };
  return config;
};

/**
 * 광고 클릭 추적 (Firestore clicks 카운터 +1)
 */
const trackAdClick = async (ad) => {
  if (!ad) return;
  const campaignId = ad._campaignId || ad.id;
  if (!campaignId) return;
  trackAppAdClick(campaignId);
};

/**
 * 광고 클릭 핸들러
 */
const handleAdPress = async (ad) => {
  if (!ad) return;

  // 클릭 추적 (비동기)
  trackAdClick(ad);

  // 링크 열기
  if (ad.linkUrl) {
    try {
      await Linking.openURL(ad.linkUrl);
    } catch (error) {
      console.log('광고 링크 열기 실패:', error.message);
    }
  }
};

/**
 * 우선순위 기반 랜덤 선택
 * priority가 *낮을수록* 선호출 (예: 1 > 10 > 99).
 * daily-news-final 어드민 UI("낮을수록 선호출")와 의미 통일.
 * 가중치 = 1 / priority. priority=1이 priority=10보다 10배 자주 노출됨.
 * @param {array} ads - 광고 배열
 */
const getRandomAdByPriority = (ads) => {
  if (!ads || ads.length === 0) return null;
  if (ads.length === 1) return ads[0];

  const weightOf = (ad) => 1 / Math.max(1, Number(ad.priority) || 10);
  const totalWeight = ads.reduce((sum, ad) => sum + weightOf(ad), 0);
  let random = Math.random() * totalWeight;

  for (const ad of ads) {
    random -= weightOf(ad);
    if (random <= 0) return ad;
  }

  return ads[0];
};

// ============================================
// 📌 광고 슬라이더 공통 컴포넌트
// ============================================

/**
 * AdSlider - 여러 광고를 5초 간격으로 자동 슬라이딩
 * @param {array}  ads          - 광고 객체 배열
 * @param {object} containerStyle - 컨테이너 스타일
 * @param {string} thumbnailKey - 사용할 썸네일 키
 * @param {number} intervalMs  - 전환 간격 (ms), 기본 5000
 * @param {boolean} showIndicator - 하단 인디케이터 점 표시 여부
 */
export function AdSlider({ ads, containerStyle, thumbnailKey = null, intervalMs = 5000, showIndicator = true }) {
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const scrollRef = useRef(null);
  const indexRef = useRef(0);
  indexRef.current = index;

  const n = ads ? ads.length : 0;
  // 끝→처음 매끄러운 루프용으로 첫 광고 복제본을 맨 뒤에 붙인다.
  const slots = n > 1 ? [...ads, ads[0]] : ads;
  const W = size.width;

  // 한 칸 다음으로 슬라이드. 가로 ScrollView가 네이티브로 부드럽게 처리한다.
  // 모든 광고는 계속 mount 상태라 재로딩(백지)이 없다.
  const goToNext = useCallback(() => {
    if (n <= 1 || !W || !scrollRef.current) return;
    const next = indexRef.current + 1;
    scrollRef.current.scrollTo({ x: next * W, animated: true });
    if (next >= n) {
      // 복제본(=첫 광고)까지 슬라이드한 뒤, 위치만 0으로 순간 복귀(내용 동일 → 이음매 없음)
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: 0, animated: false });
        setIndex(0);
      }, 400);
    } else {
      setIndex(next);
    }
  }, [n, W]);

  // 자동 슬라이드 타이머 (현재 광고가 영상이면 멈춰 재생 보장)
  useEffect(() => {
    if (n <= 1 || !W) return;
    if (ads[index]?.videoUrl) return;
    const t = setInterval(goToNext, intervalMs);
    return () => clearInterval(t);
  }, [n, W, index, ads, goToNext, intervalMs]);

  // ads가 바뀌면 처음으로 리셋
  useEffect(() => {
    setIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [ads]);

  if (!ads || ads.length === 0) return null;

  const currentIsVideo = !!ads[index]?.videoUrl;

  return (
    <View
      style={[containerStyle, { overflow: 'hidden' }]}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w && (Math.abs(w - size.width) > 1 || Math.abs(h - size.height) > 1)) {
          setSize({ width: w, height: h });
        }
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
      >
        {W > 0 && slots.map((ad, i) => {
          const isVideo = !!ad?.videoUrl;
          // blur는 현재 슬롯(i===index)과 다음에 들어올 슬롯(i===index+1)만 계산.
          // 나머지 화면 밖 슬롯에서 blur를 동시에 계산하면 iOS 메인 스레드가 막힘.
          const isCurrentOrNext = i === index || i === index + 1;
          return (
            <View key={i} style={{ width: size.width, height: size.height }}>
              {isVideo ? (
                // 영상은 현재 보이는 칸일 때만 재생, 나머지는 정지 썸네일
                <AdMedia ad={ad} style={styles.adImage} thumbnailKey={thumbnailKey} active={i === index} isVisible={isCurrentOrNext} />
              ) : (
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => handleAdPress(ad)}
                  activeOpacity={0.85}
                >
                  <AdMedia ad={ad} style={styles.adImage} thumbnailKey={thumbnailKey} isVisible={isCurrentOrNext} />
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* 인디케이터 점 */}
      {showIndicator && ads.length > 1 && (
        <View style={styles.indicatorRow}>
          {ads.map((a, idx) => (
            <View
              key={idx}
              style={[
                styles.indicatorDot,
                idx === index && styles.indicatorDotActive,
                idx === index && a?.videoUrl && styles.indicatorDotVideo,
              ]}
            />
          ))}
          {currentIsVideo && (
            <Text style={styles.indicatorVideoLabel}>▶</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ============================================
// 📌 광고 컴포넌트들
// ============================================

/**
 * 홈 대형 배너 (홈 화면 전용) - 5초마다 슬라이딩
 */
export function HomeBanner({ style, intervalMs = 5000 }) {
  const [adList, setAdList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAd = async () => {
      setIsLoading(true);
      const ads = await fetchAdConfig('home');
      const homeBannerAds = (ads?.home_banner || []).filter(a => a?.imageUrl || a?.videoUrl);
      // 우선순위 정렬
      homeBannerAds.sort((a, b) => (a.priority || 10) - (b.priority || 10));
      setAdList(homeBannerAds);
      setIsLoading(false);
    };
    loadAd();
  }, []);

  if (isLoading) return <View style={[styles.homeBanner, style]} />;
  if (adList.length === 0) return null;

  return (
    <AdSlider
      ads={adList}
      containerStyle={[styles.homeBanner, style]}
      thumbnailKey="home_banner"
      intervalMs={intervalMs}
    />
  );
}

/**
 * 홈 섹션 사이 광고 (홈 화면 전용) - 5초마다 슬라이딩
 */
export function HomeSectionAd({ style, intervalMs = 5000 }) {
  const [adList, setAdList] = useState([]);

  useEffect(() => {
    const loadAd = async () => {
      const ads = await fetchAdConfig('home');
      const homeInlineAds = (ads?.home_inline || []).filter(a => a?.imageUrl || a?.videoUrl);
      homeInlineAds.sort((a, b) => (a.priority || 10) - (b.priority || 10));
      setAdList(homeInlineAds);
    };
    loadAd();
  }, []);

  if (adList.length === 0) return null;

  return (
    <AdSlider
      ads={adList}
      containerStyle={[styles.sectionAd, style]}
      thumbnailKey="section"
      intervalMs={intervalMs}
    />
  );
}

/**
 * 리스트 상단 배너 (모든 리스트 화면 공통)
 * @param {string} screen - 화면 타입 (news, job, realestate, danggn)
 * @param {boolean} useAdMob - 자체 광고 없을 때 AdMob 사용 여부
 */
export default function AdBanner({ screen = 'all', style, intervalMs = 5000 }) {
  const cacheKey = `header:${screen}`;
  // 이전에 해석해둔 광고로 초기화 → 리마운트해도 회색 빈 박스 없이 즉시 표시.
  const [adList, setAdList] = useState(() => resolvedAdsCache[cacheKey] || []);

  // 헤더 슬롯 높이(750:300)를 '명시적 픽셀'로 계산한다.
  // iOS는 FlatList 헤더 안에서 aspectRatio로만 높이를 준 뷰의 onLayout 높이를
  // 0/지연으로 보고하는 경우가 있어, 슬라이드가 0높이로 그려져 '자리만 차지한 백지'가 됨.
  // 하단 고정배너처럼 픽셀 높이를 직접 줘서 iOS에서도 안정적으로 렌더되게 한다.
  const bannerHeight = Math.round(Dimensions.get('window').width * 300 / 750);

  useEffect(() => {
    let retryTimer;
    const loadAd = async (isRetry = false) => {
      if (isRetry) {
        // 재시도 전 캐시 무효화 (FirebaseAdService 캐시 리셋)
        delete screenAdsCache[screen];
      }
      const ads = await fetchAdConfig(screen);
      const headerAds = (ads?.header || []).filter(a => a?.imageUrl || a?.videoUrl);
      headerAds.sort((a, b) => (a.priority || 10) - (b.priority || 10));

      if (headerAds.length > 0) {
        resolvedAdsCache[cacheKey] = headerAds; // 다음 마운트용으로 보관
        prefetchAdImages(headerAds);            // 이미지 미리 받기
        setAdList(headerAds);
      } else if (!resolvedAdsCache[cacheKey]?.length) {
        // 받은 게 비어있고 '보여주던 광고도 없을 때만' 4초 후 1회 재시도.
        // 이미 노출 중인 광고가 있으면 일시적 빈 응답(네트워크 오류 등)으로
        // 광고를 지우지 않는다 → 변화가 있기 전까지 항상 노출 유지.
        if (!isRetry) retryTimer = setTimeout(() => loadAd(true), 4000);
      }
    };
    loadAd();
    return () => { if (retryTimer) clearTimeout(retryTimer); };
  }, [screen, cacheKey]);

  // 하단 고정배너와 동일한 방식: 광고 없으면 회색 빈 박스 대신 접는다(자리 차지 X).
  // 있으면 곧바로 슬라이더로 표시 (isLoading 빈 박스 단계 제거 → 백지 노출 없음).
  if (adList.length > 0) {
    return (
      <AdSlider
        ads={adList}
        containerStyle={[styles.headerBanner, { height: bannerHeight }, style]}
        thumbnailKey="header"
        intervalMs={intervalMs}
      />
    );
  }

  return null;
}

/**
 * 인라인 광고 (리스트 중간 삽입)
 * @param {string} screen        - 화면 타입 (news, job, realestate, danggn)
 * @param {number} positionIndex - 이 컴포넌트의 자리 번호 (1, 2, 3...)
 *                                 0 또는 미지정 시 → 모든 광고 슬라이딩
 *                                 N 지정 시 → inlinePosition=0(공용) + inlinePosition=N(전용) 광고만
 * @param {boolean} useAdMob    - 자체 광고 없을 때 AdMob 사용 여부
 * @param {number} intervalMs   - 슬라이딩 간격 (ms)
 */
export function InlineAdBanner({ screen = 'all', positionIndex = 0, style, intervalMs = 5000 }) {
  const [adList, setAdList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let retryTimer;
    const loadAd = async (isRetry = false) => {
      if (!isRetry) setIsLoading(true);
      if (isRetry) delete screenAdsCache[screen];
      const ads = await fetchAdConfig(screen);
      const allInlineAds = (ads?.inline || []).filter(a => a?.imageUrl || a?.videoUrl);

      let filtered;
      if (positionIndex === 0) {
        filtered = allInlineAds;
      } else {
        filtered = allInlineAds.filter(a => {
          const pos = a.inlinePosition ?? 0;
          return pos === 0 || pos === positionIndex;
        });
      }

      filtered.sort((a, b) => (a.priority || 10) - (b.priority || 10));
      setAdList(filtered);
      if (!isRetry) setIsLoading(false);
      if (!isRetry && filtered.length === 0) {
        retryTimer = setTimeout(() => loadAd(true), 4000);
      }
    };
    loadAd();
    return () => { if (retryTimer) clearTimeout(retryTimer); };
  }, [screen, positionIndex]);

  if (isLoading) return <View style={[styles.inlineAd, style]} />;

  // 자체 광고가 있으면 슬라이더로 표시
  if (adList.length > 0) {
    return (
      <AdSlider
        ads={adList}
        containerStyle={[styles.inlineAd, style]}
        thumbnailKey="inline"
        intervalMs={intervalMs}
      />
    );
  }



  return null;
}

/**
 * 상세 페이지 광고 (상단/중간/하단)
 * @param {string} position - 'top', 'middle', 또는 'bottom'
 * @param {string} screen - 화면 타입 (news, job, realestate, danggn)
 */
export function DetailAdBanner({ position = 'top', screen = 'all', style, intervalMs = 5000 }) {
  const [adList, setAdList] = useState([]);
  const [loaded, setLoaded] = useState(false);
  let slot = 'detail_top';
  if (position === 'middle') slot = 'detail_middle';
  if (position === 'bottom') slot = 'detail_bottom';

  useEffect(() => {
    const loadAd = async () => {
      const ads = await fetchAdConfig(screen);
      const detailAds = (ads?.[slot] || []).filter(a => a?.imageUrl || a?.videoUrl);
      detailAds.sort((a, b) => (a.priority || 10) - (b.priority || 10));
      setAdList(detailAds);
      setLoaded(true);
    };
    loadAd();
  }, [position, screen, slot]);

  // 광고 있으면 슬라이더 표시
  if (adList.length > 0) {
    return (
      <AdSlider
        ads={adList}
        containerStyle={[styles.headerBanner, style]}
        thumbnailKey="banner"
        intervalMs={intervalMs}
      />
    );
  }

  // 광고 없어도 자리 확보 (플레이스홀더)
  return (
    <View style={[styles.detailAdPlaceholder, style]}>
      <Text style={styles.detailAdPlaceholderText}>광고</Text>
    </View>
  );
}

/**
 * 전면 팝업 광고 컴포넌트
 * @param {boolean} visible - 팝업 표시 여부
 * @param {function} onClose - 닫기 콜백
 * @param {string} screen - 화면 타입 (all, home, news, job, realestate, danggn)
 * @param {number} autoCloseSeconds - 자동 닫힘 시간 (초), 0이면 자동 닫힘 비활성화
 */
export function PopupAd({ visible, onClose, screen = 'all', autoCloseSeconds = 10 }) {
  const [ad, setAd] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState(autoCloseSeconds);

  // 광고 로드
  useEffect(() => {
    if (visible) {
      const loadAd = async () => {
        setIsLoading(true);
        setCountdown(autoCloseSeconds);
        const ads = await fetchAdConfig(screen);
        const popupAds = ads?.popup || [];

        if (popupAds.length > 0) {
          setAd(getRandomAdByPriority(popupAds));
        } else {
          setAd(null);
          // 팝업 광고가 없으면 자동으로 닫기
          if (onClose) onClose();
        }
        setIsLoading(false);
      };
      loadAd();
    }
  }, [visible, screen]);

  // 자동 닫힘 타이머
  useEffect(() => {
    if (!visible || isLoading || !ad || autoCloseSeconds <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onClose) onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, isLoading, ad, autoCloseSeconds, onClose]);

  // 광고 클릭 핸들러
  const handlePopupPress = async () => {
    if (ad) {
      await handleAdPress(ad);
    }
    if (onClose) onClose();
  };

  // 광고가 없거나 로딩 중이면 표시하지 않음
  if (!visible || isLoading || (!ad?.imageUrl && !ad?.videoUrl)) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.popupOverlay}>
        <View style={styles.popupContainer}>
          {/* 닫기 버튼 - 카운트다운 표시 */}
          <TouchableOpacity
            style={styles.popupCloseButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.popupCloseCircle}>
              <Text style={styles.popupCloseText}>
                {countdown > 0 ? countdown : '✕'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 광고 미디어 (비디오/이미지) */}
          <TouchableOpacity
            onPress={handlePopupPress}
            activeOpacity={0.9}
            style={styles.popupImageWrapper}
          >
            <AdMedia ad={ad} style={styles.popupImage} thumbnailKey="popup" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================
// 📌 고정 하단 배너 (전역 화면 항상 표시)
// ============================================

// 화면 콘텐츠가 배너 뒤에 가려지지 않도록 패딩에 사용할 높이 값
export const FIXED_BOTTOM_HEIGHT = 125; // 하단 고정 배너 높이 (750:250 비율, 평균 125px)

/**
 * 고정 하단 배너 (750x250 비율) - 앱 전쭔 화면 항상 표시
 * ⚠️ App.js의 <SafeAreaProvider> 바로 안에 위치시켜야 합니다.
 * @param {string} screen - 화면 타입 (all, home, news...)
 */
export function FixedBottomBanner({ screen = 'all', intervalMs = 5000 }) {
  const [adList, setAdList] = useState([]);
  const insets = require('react-native-safe-area-context').useSafeAreaInsets();

  // 탭바 높이: 56px(탭바 기본) + safe area bottom (0이면 8px 패딩)
  const tabBarHeight = 56 + (insets.bottom > 0 ? insets.bottom : 8);
  // 750:250 비율로 정확한 높이 계산
  const bannerHeight = Math.round(Dimensions.get('window').width * 250 / 750);

  useEffect(() => {
    const loadAd = async () => {
      const ads = await fetchAdConfig(screen);
      const bottomAds = (ads?.fixed_bottom || []).filter(a => a?.imageUrl || a?.videoUrl);
      bottomAds.sort((a, b) => (a.priority || 10) - (b.priority || 10));
      setAdList(bottomAds);
    };
    loadAd();
  }, [screen]);

  if (adList.length === 0) return null;

  return (
    <AdSlider
      ads={adList}
      containerStyle={[
        styles.fixedBottom,
        {
          height: bannerHeight,
          bottom: tabBarHeight,     // 탭바 바로 위에 위치
        },
      ]}
      thumbnailKey="inline"
      intervalMs={intervalMs}
      showIndicator={false}  // 하단 배너에는 점 표시 안 함
    />
  );
}

// ============================================
// 하위 호환성 (기존 코드 지원)
// ============================================

/**
 * @deprecated SectionAdBanner는 HomeSectionAd로 대체됨
 */
export function SectionAdBanner({ style }) {
  return <HomeSectionAd style={style} />;
}



// ============================================
// 스타일 (비율 기반 + 최대 높이 제한)
// ============================================
const styles = StyleSheet.create({
  // ── 고정 배너 (절대 위치, 화면 전체에 항상 표시) ──
  fixedTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    width: '100%',
    aspectRatio: 750 / 300,
    maxHeight: 56,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 8,
  },
  fixedBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    width: '100%',
    // height와 bottom은 FixedBottomBanner에서 동적으로 계산하여 containerStyle로 주입
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 8,
  },
  // 슬라이더 인디케이터
  indicatorRow: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  indicatorDotActive: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // 비디오 광고 인디케이터: 주황색으로 강조
  indicatorDotVideo: {
    backgroundColor: '#FF9500',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  indicatorVideoLabel: {
    color: '#FF9500',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  // 홈 대형 배너: 750x300 비율 (2.5:1)
  homeBanner: {
    width: "100%",
    aspectRatio: 750 / 300,
    backgroundColor: "#f5f5f5",
    marginVertical: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  // 리스트 헤더/상세 배너: 750x300 비율 (2.5:1)
  headerBanner: {
    width: "100%",
    aspectRatio: 750 / 300,
    backgroundColor: "#f5f5f5",
    marginVertical: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  // 인라인 광고: 750x250 비율 (3:1)
  inlineAd: {
    width: "100%",
    aspectRatio: 750 / 250,
    backgroundColor: "#fff",
    marginVertical: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  // 홈 섹션 사이: 750x250 비율 (3:1)
  sectionAd: {
    width: "100%",
    aspectRatio: 750 / 250,
    backgroundColor: "#fff",
    marginVertical: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  adImage: {
    width: "100%",
    height: "100%",
  },
  // 광고 없을 때 자리 확보 플레이스홀더
  detailAdPlaceholder: {
    width: "100%",
    height: 60,
    backgroundColor: "#f0f0f0",
    marginVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
  },
  detailAdPlaceholderText: {
    fontSize: 11,
    color: "#bbb",
    letterSpacing: 2,
  },
  // 비디오 음소거 버튼
  muteButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  muteIcon: {
    fontSize: 16,
  },
  // 전면 팝업 광고 스타일
  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  popupContainer: {
    width: screenWidth * 0.85,
    maxWidth: 400,
    maxHeight: screenHeight * 0.75,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  popupCloseButton: {
    position: "absolute",
    top: -15,
    right: -15,
    zIndex: 10,
  },
  popupCloseCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  popupCloseText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  popupImageWrapper: {
    width: "100%",
    aspectRatio: 600 / 800,
  },
  popupImage: {
    width: "100%",
    height: "100%",
  },
});
