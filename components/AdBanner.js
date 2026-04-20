import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, Image, TouchableOpacity, Linking, Platform, Modal, Text, Dimensions, Animated } from "react-native";
import { getFilteredAds, trackFirebaseAdImpression, trackFirebaseAdClick } from "../services/FirebaseAdService";

const { width: screenWidth } = Dimensions.get('window');

let VideoView = () => null;
let useVideoPlayer = () => null;
try {
  const expoVideo = require('expo-video');
  VideoView = expoVideo.VideoView;
  useVideoPlayer = expoVideo.useVideoPlayer;
} catch (e) {
  console.log('⚠️ expo-video 네이티브 모듈 없음 - 영상 광고 비활성화');
}

/**
 * 우선순위 기반 랜덤 선택 로직
 */
const getRandomAdByPriority = (ads) => {
  if (!ads || ads.length === 0) return null;
  if (ads.length === 1) return ads[0];

  const totalWeight = ads.reduce((sum, ad) => sum + (Number(ad.priority) || 10), 0);
  let random = Math.random() * totalWeight;

  for (const ad of ads) {
    random -= (Number(ad.priority) || 10);
    if (random <= 0) return ad;
  }
  return ads[0];
};

/**
 * 광고 미디어 (비디오 또는 이미지) 컴포넌트
 */
const AdMediaVideo = ({ videoUrl, style }) => {
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    if (!player || __DEV__) return;
    setPlayerReady(true);
    try {
      player.muted = true;
      player.play();
    } catch (e) {}

    return () => {
      setPlayerReady(false);
      try {
        player.pause();
      } catch (e) {}
    };
  }, [player]);

  useEffect(() => {
    if (player && playerReady) {
      try { player.muted = isMuted; } catch (e) {}
    }
  }, [isMuted, player, playerReady]);

  const openFullscreen = () => {
    if (!player || !playerReady) return;
    setIsFullscreen(true);
    try {
      player.muted = false;
      player.loop = false;
      player.play();
    } catch (e) {}
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
    if (!player || !playerReady) return;
    try {
      player.muted = isMuted;
      player.loop = true;
      player.play();
    } catch (e) {}
  };

  if (__DEV__) {
    return (
      <View style={[style, { position: 'relative', backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }]}>
         <Text style={{ color: '#fff', fontSize: 12, opacity: 0.7 }}>🎦 광고 영상 (빌드 후 재생)</Text>
      </View>
    );
  }

  return (
    <View style={[style, { position: 'relative' }]}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        nativeControls={false}
      />
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={openFullscreen}
        activeOpacity={0.9}
      />
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
            style={styles.closeModalButton}
            onPress={closeFullscreen}
          >
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const AdMedia = ({ ad, style }) => {
  if (ad?.type === 'video' && ad?.images?.[0]) {
    return <AdMediaVideo videoUrl={ad.images[0]} style={style} />;
  }

  const imageUrl = ad?.images?.[0];
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={style}
        resizeMode="cover"
      />
    );
  }

  return null;
};

/**
 * 광고 슬라이더 (노출/클릭 트래킹 포함)
 */
export function AdSlider({ ads, containerStyle, intervalMs = 5000, showIndicator = true }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [trackedImpressions, setTrackedImpressions] = useState(new Set());
  const SCREEN_WIDTH = Dimensions.get('window').width;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  // 현재 광고 노출 트래킹
  useEffect(() => {
    if (!ads || ads.length === 0) return;
    const currentAd = ads[currentIndex];
    if (currentAd && !trackedImpressions.has(currentAd.id)) {
      trackFirebaseAdImpression(currentAd.id);
      setTrackedImpressions(prev => new Set(prev).add(currentAd.id));
    }
  }, [currentIndex, ads, trackedImpressions]);

  const goToNext = useCallback(() => {
    if (!ads || ads.length <= 1) return;
    Animated.timing(slideAnim, {
      toValue: -SCREEN_WIDTH,
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex(prev => (prev + 1) % ads.length);
      slideAnim.setValue(SCREEN_WIDTH);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start();
    });
  }, [ads, slideAnim, SCREEN_WIDTH]);

  useEffect(() => {
    if (!ads || ads.length <= 1) return;
    const currentAd = ads[currentIndex];
    if (currentAd?.type === 'video') {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    timerRef.current = setInterval(goToNext, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [ads, currentIndex, goToNext, intervalMs]);

  if (!ads || ads.length === 0) return null;

  const ad = ads[currentIndex];
  if (!ad?.images?.length) return null;

  const isVideo = ad?.type === 'video';

  const handlePress = async () => {
    trackFirebaseAdClick(ad.id);
    if (ad.linkUrl) {
      try {
        await Linking.openURL(ad.linkUrl);
      } catch (error) {
        console.log('광고 링크 열기 실패:', error.message);
      }
    }
  };

  return (
    <View style={[containerStyle, { overflow: 'hidden' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: slideAnim }] }]}>
        {isVideo ? (
          <AdMedia ad={ad} style={styles.adImage} />
        ) : (
          <TouchableOpacity style={{ flex: 1 }} onPress={handlePress} activeOpacity={0.85}>
            <AdMedia ad={ad} style={styles.adImage} />
          </TouchableOpacity>
        )}
      </Animated.View>

      {showIndicator && ads.length > 1 && (
        <View style={styles.indicatorRow}>
          {ads.map((a, idx) => (
            <View
              key={idx}
              style={[
                styles.indicatorDot,
                idx === currentIndex && styles.indicatorDotActive,
                idx === currentIndex && a?.type === 'video' && styles.indicatorDotVideo,
              ]}
            />
          ))}
          {isVideo && <Text style={styles.indicatorVideoLabel}>▶</Text>}
        </View>
      )}
    </View>
  );
}

// ----------------------------------------------------------------------
// 고도화된 광고 컴포넌트 (Admin 기준 슬롯/타겟 적용)
// ----------------------------------------------------------------------

const useFilteredAdsHook = (position, targetPage) => {
  const [adList, setAdList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAds = async () => {
      setIsLoading(true);
      const filtered = await getFilteredAds(position, targetPage.toLowerCase());
      setAdList(filtered || []);
      setIsLoading(false);
    };
    loadAds();
  }, [position, targetPage]);

  return { adList, isLoading };
};

/**
 * 전용 홈 배너 (상단)
 */
export function HomeBanner({ style, intervalMs = 5000 }) {
  const { adList, isLoading } = useFilteredAdsHook('head', 'home');
  if (isLoading || adList.length === 0) return null;
  return <AdSlider ads={adList} containerStyle={[styles.homeBanner, style]} intervalMs={intervalMs} />;
}

/**
 * 전용 홈 본문 광고 (중간)
 */
export function HomeSectionAd({ style, intervalMs = 5000 }) {
  const { adList, isLoading } = useFilteredAdsHook('inner', 'home');
  if (isLoading || adList.length === 0) return null;
  return <AdSlider ads={adList} containerStyle={[styles.sectionAd, style]} intervalMs={intervalMs} />;
}

/**
 * 범용 가로 배너 (상세 페이지 등에서 사용)
 * position: head | inner | bottom
 * screen: home | danggn | danggn-detail | realestate | realestate-detail | jobs | jobs-detail | magazine | magazine-detail | neighbor
 */
export default function AdaptiveAdBanner({ screen = 'home', position = 'head', style, intervalMs = 5000 }) {
  // 슬롯 이름 정규화
  let slot = position;
  if (position === 'header' || position === 'top') slot = 'head';
  if (position === 'inline' || position === 'middle') slot = 'inner';

  const { adList, isLoading } = useFilteredAdsHook(slot, screen);
  
  if (isLoading || adList.length === 0) return null;

  let containerStyle = styles.headerBanner;
  if (slot === 'inner') containerStyle = styles.inlineAd;
  if (slot === 'bottom') containerStyle = styles.bottomAd || styles.headerBanner;
  
  return <AdSlider ads={adList} containerStyle={[containerStyle, style]} intervalMs={intervalMs} />;
}

/**
 * 리스트 중간 광고용
 */
export function InlineAdBanner({ screen = 'home', style, intervalMs = 5000 }) {
  return <AdaptiveAdBanner screen={screen} position="inner" style={style} intervalMs={intervalMs} />;
}

/**
 * 상세 페이지 광고 (상단/중간/하단)
 */
export function DetailAdBanner({ position = 'head', screen = 'home', style, intervalMs = 5000 }) {
  return <AdaptiveAdBanner screen={screen} position={position} style={style} intervalMs={intervalMs} />;
}

/**
 * 팝업 광고 (별도 관리 필요할 수 있으나 현재는 inner 또는 head 중 선택 지원 가능하게 하거나, 필요시 Admin에 popup 추가)
 * 일단 position="popup"으로 유지 (Admin에서도 필요 시 추가 예정)
 */
export function PopupAd({ visible, onClose, screen = 'home', autoCloseSeconds = 10 }) {
  const { adList, isLoading } = useFilteredAdsHook('popup', screen);
  const [ad, setAd] = useState(null);
  const [countdown, setCountdown] = useState(autoCloseSeconds);
  const [hasTracked, setHasTracked] = useState(false);

  useEffect(() => {
    if (visible && !isLoading) {
      if (adList.length > 0) {
        const selected = getRandomAdByPriority(adList);
        setAd(selected);
        setCountdown(autoCloseSeconds);
        if (!hasTracked && selected) {
          trackFirebaseAdImpression(selected.id);
          setHasTracked(true);
        }
      } else {
        if (onClose) onClose();
      }
    }
  }, [visible, isLoading, adList, autoCloseSeconds, onClose, hasTracked]);

  useEffect(() => {
    if (!visible) setHasTracked(false);
  }, [visible]);

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

  const handlePopupPress = async () => {
    if (ad) {
      trackFirebaseAdClick(ad.id);
      if (ad.linkUrl) Linking.openURL(ad.linkUrl).catch(()=>console.log("링크 열기 실패"));
    }
    if (onClose) onClose();
  };

  if (!visible || isLoading || !ad) return null;

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.popupOverlay}>
        <View style={styles.popupContainer}>
          <TouchableOpacity style={styles.popupCloseButton} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <View style={styles.popupCloseCircle}>
              <Text style={styles.popupCloseText}>{countdown > 0 ? countdown : '✕'}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePopupPress} activeOpacity={0.9} style={styles.popupImageWrapper}>
            <AdMedia ad={ad} style={styles.popupImage} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  homeBanner: {
    width: '100%',
    aspectRatio: 720 / 300,
    backgroundColor: '#f5f5f5',
  },
  sectionAd: {
    width: '100%',
    aspectRatio: 720 / 200,
    marginVertical: 4,
    backgroundColor: '#f5f5f5',
  },
  headerBanner: {
    width: '100%',
    aspectRatio: 720 / 180,
    backgroundColor: '#f5f5f5',
  },
  inlineAd: {
    width: '100%',
    aspectRatio: 720 / 250,
    marginVertical: 4,
    backgroundColor: '#f5f5f5',
  },
  adImage: {
    width: '100%',
    height: '100%',
  },
  indicatorRow: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  indicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginHorizontal: 2,
  },
  indicatorDotActive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  indicatorDotVideo: {
    backgroundColor: '#ff3b30',
  },
  indicatorVideoLabel: {
    color: '#fff',
    fontSize: 8,
    marginLeft: 4,
    lineHeight: 10,
  },
  muteButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muteIcon: {
    fontSize: 14,
    color: '#fff',
  },
  closeModalButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupContainer: {
    width: screenWidth * 0.85,
    height: screenWidth * 1.1, // 가로세로비 조정
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  popupImageWrapper: {
    flex: 1,
  },
  popupImage: {
    width: '100%',
    height: '100%',
  },
  popupCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  popupCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
