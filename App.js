import "react-native-gesture-handler";
import { LogBox, Platform, Alert, Image as RNImage } from "react-native";

// i18n 초기화 (앱 시작 시 바로 실행)
import './i18n';
import { isFirstLaunch, setFirstLaunchComplete } from './i18n';
import Constants from "expo-constants";
// LogBox.ignoreAllLogs(true);



// Firebase Remote Config deprecated 경고 무시 (기능은 정상 작동)
LogBox.ignoreLogs([
  "This method is deprecated",
  "Please use `getApp()` instead",
  "Please use `getValue()` instead",
  "Please use `setConfigSettings()` instead",
  "Please use `setDefaults()` instead",
  "Please use `fetchAndActivate()` instead",
]);

// Firebase 초기화 (앱 시작 시 바로 실행)
import firebase from "@react-native-firebase/app";
import appCheck from "@react-native-firebase/app-check";

// App Check 초기화 (앱 시작 시 바로 실행)
const initializeAppCheck = async () => {
  try {
    // Firebase 앱 초기화 확인
    let app;
    try {
      app = firebase.app();
    } catch (e) {
      console.log("⚠️ Firebase 앱이 아직 로드되지 않았습니다.");
      return false;
    }

    if (!app || app.name !== "[DEFAULT]") {
      console.log("⚠️ 기본 Firebase 앱이 없습니다.");
      return false;
    }

    // App Check 활성화 (iOS: DeviceCheck/AppAttest, Android: Play Integrity)
    const rnfbProvider = appCheck().newReactNativeFirebaseAppCheckProvider();
    rnfbProvider.configure({
      android: {
        provider: __DEV__ ? "debug" : "playIntegrity",
      },
      apple: {
        provider: __DEV__ ? "debug" : "deviceCheck",
      },
    });

    await appCheck().initializeAppCheck({
      provider: rnfbProvider,
      isTokenAutoRefreshEnabled: true,
    });

    console.log("✅ Firebase App Check 초기화 완료");
    return true;
  } catch (error) {
    console.log("⚠️ App Check 초기화 실패:", error?.message);
    return false;
  }
};

// Firebase 초기화 상태 확인 함수 (네이티브 Firebase)
// ⚡ 타임아웃 2초로 단축 (딥링크 속도 개선)
const waitForFirebase = async (timeout = 2000) => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const apps = firebase.apps;
      if (apps && apps.length > 0) {
        const app = firebase.app();
        if (app && app.name === "[DEFAULT]") {
          console.log(`✅ 네이티브 Firebase 초기화 완료 (${Date.now() - startTime}ms)`);
          return true;
        }
      }
    } catch (e) {
      // 아직 초기화 안됨 - 계속 대기
    }
    await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms로 단축
  }

  console.log("⚠️ 네이티브 Firebase 초기화 타임아웃 (기본값으로 진행)");
  return false;
};

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Image as ExpoImage } from "expo-image";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import RNRestart from "react-native-restart";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from 'expo-linking';
import { NavigationContainer, useNavigation, createNavigationContainerRef, getStateFromPath as defaultGetStateFromPath } from "@react-navigation/native";

// 딥링크 핸들링용 navigation ref (앱 실행 중 딥링크 수신 시 사용)
const navigationRef = createNavigationContainerRef();
notificationService.setNavigationRef(navigationRef);
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// ✅ 네이티브 스플래시를 잠깐만 유지 후 JS 로딩 화면(프로그레스 바) 표시
SplashScreen.preventAutoHideAsync().catch(() => {
  // 이미 숨겨졌거나 에러 발생 시 무시
});
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { hasHomeDataCache } from "./services/wordpressApi";
import notificationService from "./services/NotificationService";
import { initializeFirebase } from "./firebase/config";
import { logScreenView } from "./lib/analytics";

// 🔍 [측정 인프라] 활성 라우트명 추출 — 중첩 navigator도 끝까지 따라감
const getActiveRouteName = (state) => {
  if (!state || typeof state.index !== 'number') return undefined;
  const route = state.routes[state.index];
  if (route?.state) return getActiveRouteName(route.state);
  return route?.name;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// 🔔 앱 시작 시 알림 채널 생성 (Android)
const setupNotificationChannels = async () => {
  if (Platform.OS === "android") {
    try {
      // 기본 채널
      await Notifications.setNotificationChannelAsync("default", {
        name: "기본 알림",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });

      // 채팅 알림 채널 (강제 알람용 - 최고 우선순위)
      await Notifications.setNotificationChannelAsync("chat", {
        name: "채팅 알림",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B35",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });

      console.log("✅ 알림 채널 생성 완료!");
    } catch (error) {
      console.error("❌ 알림 채널 생성 실패:", error);
    }
  }
};

// 앱 로드 시 즉시 채널 생성
setupNotificationChannels();

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { PopupAd, FixedBottomBanner } from "./components/AdBanner";
import { prefetchAppAds } from "./services/FirebaseAdService";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import WelcomeAfterSignupScreen from "./screens/WelcomeAfterSignupScreen";
import AnnouncementDetailScreen from "./screens/AnnouncementDetailScreen";
import AnnouncementsListScreen from "./screens/AnnouncementsListScreen";
import FindIdScreen from "./screens/FindIdScreen";
import FindPasswordScreen from "./screens/FindPasswordScreen";
import MagazineScreen from "./screens/MagazineScreen";
import PostDetailScreen from "./screens/PostDetailScreen";
import MoreScreen from "./screens/MoreScreen";
import MyPageScreen from "./screens/MyPageScreen";
import MyFavoritesScreen from "./screens/MyFavoritesScreen";
import ChatListScreen from "./screens/ChatListScreen";
import BookmarksScreen from "./screens/BookmarksScreen";
import MyCommentsScreen from "./screens/MyCommentsScreen";
import NotificationSettingScreen from "./screens/NotificationSettingScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ChatRoomScreen from "./screens/ChatRoomScreen";
import ReviewScreen from "./screens/ReviewScreen";
import MyItemsScreen from "./screens/MyItemsScreen";
import UserManagementScreen from "./screens/UserManagementScreen";
import NotificationsScreen from "./screens/NotificationsScreen";
import XinChaoDanggnScreen from "./screens/XinChaoDanggnScreen";
import NeighborBusinessesScreen from "./screens/NeighborBusinessesScreen";
import NeighborBusinessDetailScreen from "./screens/NeighborBusinessDetailScreen";
import AddNeighborBusinessScreen from "./screens/AddNeighborBusinessScreen";
import AddItemScreen from "./screens/AddItemScreen";
import ItemDetailScreen from "./screens/ItemDetailScreen";
import JobsScreen from "./screens/JobsScreen";
import JobDetailScreen from "./screens/JobDetailScreen";
import CandidateDetailScreen from "./screens/CandidateDetailScreen";
import AddJobScreen from "./screens/AddJobScreen";
import AddCandidateScreen from "./screens/AddCandidateScreen";
import RealEstateScreen from "./screens/RealEstateScreen";
import RealEstateDetailScreen from "./screens/RealEstateDetailScreen";
import AddRealEstateScreen from "./screens/AddRealEstateScreen";
import AddAgentScreen from "./screens/AddAgentScreen";
import AdminScreen from "./screens/AdminScreen";
import LanguageSelectScreen from "./screens/LanguageSelectScreen";
import LanguageSwitcher from "./components/LanguageSwitcher";
import SplashAnimation from "./components/SplashAnimation";
import ForceUpdateModal from "./components/ForceUpdateModal";
import { checkForceUpdate } from "./lib/versionCheck";
import NetInfo from "@react-native-community/netinfo";
import NetworkBanner from "./components/NetworkBanner";

// ============================================
// 📢 광고문의 헤더 버튼 (모든 탭에서 공유)
// ============================================
function AdInquiryHeaderButton({ color = "#fff" }) {
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL("https://chaovietnam.co.kr/ads_request/")}
      style={{
        marginRight: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: "rgba(255,255,255,0.22)",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.5)",
        alignItems: "center",
        justifyContent: "center",
      }}
      activeOpacity={0.75}
    >
      <Text style={{ color, fontSize: 12, fontWeight: "700", letterSpacing: 0.2 }}>
        📢 광고문의
      </Text>
    </TouchableOpacity>
  );
}

// 햄버거 메뉴 버튼 (헤더 좌측)
function HamburgerMenuButton({ navigation }) {
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate("메뉴")}
      style={{ marginLeft: 12, padding: 4 }}
      activeOpacity={0.75}
    >
      <Ionicons name="menu" size={26} color="#fff" />
    </TouchableOpacity>
  );
}

// 사용자 아바타 버튼 (헤더 우측)
function UserAvatarButton({ navigation }) {
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const [avatar, setAvatar] = React.useState(null);

  React.useEffect(() => {
    if (!user) { setAvatar(null); return; }
    if (user.photoURL) setAvatar(user.photoURL);
    try {
      const { doc, getDoc } = require("firebase/firestore");
      const { db } = require("./firebase/config");
      if (!db) return;
      getDoc(doc(db, "users", user.uid)).then(snap => {
        if (snap.exists() && snap.data().profileImage) {
          setAvatar(snap.data().profileImage);
        }
      }).catch(() => { });
    } catch (e) { }
  }, [user?.uid]);

  // 로그아웃 상태: 모든 헤더에 로그인 버튼 노출 (방문자 → 로그인/가입 유도)
  if (!user) {
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate("로그인")}
        style={{ flexDirection: "row", alignItems: "center", marginRight: 8, paddingHorizontal: 8, paddingVertical: 4 }}
        activeOpacity={0.75}
      >
        <Ionicons name="person-circle-outline" size={20} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700", marginLeft: 3 }}>{t('login')}</Text>
      </TouchableOpacity>
    );
  }

  if (!avatar) return null;

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate("메뉴")}
      style={{ marginRight: 8 }}
      activeOpacity={0.75}
    >
      <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.8)", overflow: "hidden" }}>
        <RNImage source={{ uri: avatar }} style={{ width: 24, height: 24, borderRadius: 12 }} />
      </View>
    </TouchableOpacity>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);
  const [showStartupPopup, setShowStartupPopup] = useState(false);
  const [showForceUpdate, setShowForceUpdate] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const updatesCheckedRef = useRef(false);
  const popupShownRef = useRef(false);
  const deepLinkHandledRef = useRef(false); // 중복 처리 방지
  const routeNameRef = useRef(null); // 🔍 [측정 인프라] 직전 화면 이름 추적

  // 🔗 딥링크 수동 핸들러 (링킹 prop 실패 시 안전망)
  const handleDeepLinkUrl = useCallback((url) => {
    if (!url) return;
    console.log('🔗 [안전망] 딥링크 수신:', url);

    // 웹 경로명 → 내부 타입명 매핑 (linking config와 동일)
    const WEB_TO_TYPE = {
      market: 'danggn', jobs: 'job', realestate: 'realestate', neighborbusiness: 'neighbor',
      danggn: 'danggn', job: 'job', neighbor: 'neighbor',
    };
    const pathKeys = Object.keys(WEB_TO_TYPE).join('|');

    // URL에서 type, id 파싱
    let type = null, id = null;

    // chaovietnam://{type}/ID (내부 scheme)
    const schemeMatch = url.match(new RegExp(`chaovietnam:\\/\\/(${pathKeys})\\/([^?/\\s]+)`));
    if (schemeMatch) {
      type = WEB_TO_TYPE[schemeMatch[1]];
      id = schemeMatch[2];
    }

    // https://chaovietnam.co.kr/app/share/{type}/ID (구 공유 endpoint)
    if (!type) {
      const webMatch = url.match(new RegExp(`chaovietnam\\.co\\.kr\\/app\\/share\\/(${pathKeys})\\/([^?/\\s]+)`));
      if (webMatch) {
        type = WEB_TO_TYPE[webMatch[1]];
        id = webMatch[2];
      }
    }

    // https://(www.)vnkorlife.com/{market|jobs|realestate|neighborbusiness}/ID — 카톡·페북·이메일 실제 공유 URL
    if (!type) {
      const vnMatch = url.match(new RegExp(`vnkorlife\\.com\\/(${pathKeys})\\/([^?/\\s]+)`));
      if (vnMatch) {
        type = WEB_TO_TYPE[vnMatch[1]];
        id = vnMatch[2];
      }
    }

    // 🏷️ 탭전용 딥링크: ID없는 패턴 → 탭 메인으로 이동
    if (!type) {
      const tabOnlyMatch = url.match(new RegExp(`(?:chaovietnam:\\/\\/|vnkorlife\\.com\\/(?:tab\\/)?)(${pathKeys})\\/?$`));
      if (tabOnlyMatch) {
        const t = WEB_TO_TYPE[tabOnlyMatch[1]];
        const tabName = { danggn: '당근/나눔', job: '구인구직', realestate: '부동산', neighbor: '이웃사업' }[t];
        if (tabName) {
          let attempts = 0;
          const tryNav = () => {
            attempts++;
            if (navigationRef.isReady()) {
              try { navigationRef.navigate('MainApp', { screen: tabName }); } catch (e) { }
            } else if (attempts < 20) {
              setTimeout(tryNav, 200);
            }
          };
          setTimeout(tryNav, 300);
        }
        return;
      }
    }

    if (!type || !id) {
      console.log('🔗 [안전망] 파싱 실패:', url);
      return;
    }

    const screenMap = {
      danggn: { tab: '당근/나눔', main: '당근/나눔 메인', screen: '당근/나눔 상세' },
      job: { tab: '구인구직', main: '구인구직 메인', screen: '구인구직 상세' },
      realestate: { tab: '부동산', main: '부동산 메인', screen: '부동산 상세' },
      neighbor: { tab: '이웃사업', main: '이웃사업 메인', screen: '이웃사업 상세' },
    };
    const target = screenMap[type];
    if (!target) return;

    console.log(`🔗 [안전망] 네비게이션 시도: ${target.tab} > ${target.screen} (id: ${id})`);

    // navigationRef가 준비될 때까지 재시도
    let attempts = 0;
    const tryNavigate = () => {
      attempts++;
      if (navigationRef.isReady()) {
        try {
          // 먼저 탭 메인으로 이동
          navigationRef.navigate('MainApp', {
            screen: target.tab,
            params: {
              screen: target.main,
            },
          });
          // 그 후 상세 화면을 push (메인 위에 쌓임 → 뒤로가기 시 메인으로 돌아감)
          setTimeout(() => {
            navigationRef.navigate('MainApp', {
              screen: target.tab,
              params: {
                screen: target.screen,
                params: { id },
              },
            });
          }, 100);
          console.log('✅ [안전망] 네비게이션 성공');
        } catch (e) {
          console.log('❌ [안전망] 네비게이션 실패:', e.message);
        }
      } else if (attempts < 20) {
        setTimeout(tryNavigate, 200);
      }
    };
    setTimeout(tryNavigate, 300);
  }, []);

  // Cold start: 앱이 딥링크로 시작된 경우
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url && !deepLinkHandledRef.current) {
        console.log('🔗 [Cold Start] 초기 URL:', url);
        // linking prop이 먼저 처리할 시간 줌 (500ms), 그래도 실패하면 안전망 실행
        setTimeout(() => {
          if (!navigationRef.isReady()) return;
          const state = navigationRef.getState();
          const currentRoute = state?.routes?.[state.routes.length - 1];
          // 현재 화면이 상세페이지가 아니면 수동으로 이동
          const isOnDetailPage = currentRoute?.state?.routes?.some(r =>
            r.state?.routes?.some(s => s.name?.includes('상세'))
          );
          if (!isOnDetailPage) {
            console.log('⚠️ [Cold Start] 상세 페이지 아님 → 안전망 실행');
            handleDeepLinkUrl(url);
          }
        }, 800);
      }
    });
  }, [handleDeepLinkUrl]);

  // Hot start: 앱이 실행 중일 때 딥링크 수신
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('🔗 [Hot Start] URL 이벤트:', url);
      // linking prop의 subscribe와 중복이지만 해당 시스템이 실패 시 안전망
      setTimeout(() => handleDeepLinkUrl(url), 300);
    });
    return () => subscription.remove();
  }, [handleDeepLinkUrl]);

  // 🚀 캐시 우선 로딩 전략
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log("🚀 앱 초기화 시작...");
        const startTime = Date.now();

        // 🌐 첫 실행 시 언어 선택 화면 표시
        const firstLaunch = await isFirstLaunch();
        if (firstLaunch) {
          setShowLanguageSelect(true);
          setIsReady(true);
          return;
        }

        // 🚨 강제 업데이트 체크 (Firestore config/appVersion.minVersion)
        const needsUpdate = await checkForceUpdate();
        if (needsUpdate) {
          setShowForceUpdate(true);
          setIsReady(true);
          return;
        }

        // 📢 광고 워밍업 — 스플래시(최소 5초) 유휴 시간에 광고를 미리 데워서
        //    첫 화면 진입 시 광고가 이미 메모리에 준비되도록 함(노출 공백 0).
        //    fire-and-forget: 초기화 흐름을 막지 않음.
        prefetchAppAds();

        // 🚀 1. OTA 직후 재시작 여부 확인 (캐시보다 먼저)
        const otaFlag = await AsyncStorage.getItem('OTA_JUST_APPLIED').catch(() => null);
        if (otaFlag) {
          // OTA 플래그 + 캐시 동시 삭제 → 새 데이터 로드 강제
          await AsyncStorage.multiRemove(['OTA_JUST_APPLIED', 'HOME_DATA_CACHE']).catch(() => {});
          updatesCheckedRef.current = true; // ⏩ 이번 세션 업데이트 체크 완전 스킵 (루프 방지)
          console.log('🔄 OTA 직후 재시작 - 캐시 삭제 완료, 업데이트 체크 스킵');
          // hasCache 블록 전체 skip → slow-path(프로그레스 바 + API)로 진행
        } else {
          // 🚀 1. 캐시 먼저 확인 - 있으면 즉시 진입! (최우선)
          const hasCache = await hasHomeDataCache();

          if (hasCache) {
            console.log('✅ 캐시 발견! 즉시 진입');
            // 애니메이션 감상을 위해 무조건 최소 5.0초는 로딩 화면을 보여줌
            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, 5000 - elapsedTime);
            setTimeout(() => setIsReady(true), remainingTime);

            // 백그라운드에서 로그인 필수 항목만 초기화 (사용자는 안 기다림)
            // 홈 데이터 사전 로딩, AdMob, 광고 동의 등은 로그인 후 각 화면 마운트 시점으로 미룸
            Promise.allSettled([
              waitForFirebase(2000),
              initializeFirebase(),
              !__DEV__ && initializeAppCheck(),
            ]).then(() => console.log('✅ 백그라운드 초기화 완료'));

            console.log(`⏱️ 즉시 진입: ${Date.now() - startTime}ms`);
            return;
          }
        } // end else (no OTA flag)

        // 🚀 2. 캐시 없음 → 프로그레스 바 표시 + 빠른 초기화
        console.log("⏳ 첫 실행, 프로그레스 바 표시...");

        let progress = 0;
        const interval = setInterval(() => {
          if (progress < 90) {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            setLoadProgress(progress);
          }
        }, 100);

        // 모든 초기화를 병렬로 + 최대 5.0초 타임아웃
        const MAX_INIT_TIME = 5000; // 최대 5.0초

        // 로그인 필수 항목만 초기화 — 나머지는 로그인 후로 미룸
        const allInitPromise = Promise.allSettled([
          waitForFirebase(1500),
          initializeFirebase(),
          !__DEV__ && initializeAppCheck(),
        ]);

        const timeoutPromise = new Promise(resolve =>
          setTimeout(() => resolve('timeout'), MAX_INIT_TIME)
        );

        const result = await Promise.race([allInitPromise, timeoutPromise]);

        clearInterval(interval);
        setLoadProgress(100);

        if (result === 'timeout') {
          console.log(`⏱️ ${MAX_INIT_TIME}ms 타임아웃, 화면 진입`);
          // 백그라운드에서 계속
          allInitPromise.then(() => console.log("✅ 백그라운드 초기화 완료"));
        } else {
          console.log(`⏱️ 초기화 완료: ${Date.now() - startTime}ms`);
        }

        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, 5000 - elapsedTime);
        setTimeout(() => setIsReady(true), remainingTime);
      } catch (error) {
        console.log("초기화 에러:", error);
        setIsReady(true); // 에러 시에도 진입
      }
    };

    initializeApp();
  }, []);

  // ✅ 앱 마운트 시 바로 스플래시 숨기고 JS 로딩 화면(프로그레스 바) 표시
  useEffect(() => {
    // 약간의 딜레이 후 스플래시 숨김 (JS 로딩 화면이 렌더링된 후)
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {
        // 이미 숨겨졌거나 에러 시 무시
      });
    }, 100); // 100ms 후 스플래시 숨김 → 프로그레스 바 로딩 화면 표시

    return () => clearTimeout(timer);
  }, []);

  // 네트워크 상태 감지 — 오프라인 시 상단 배너 표시
  useEffect(() => {
    // iOS는 리스너 첫 emit 시 isConnected 가 null(상태 미확정)로 와서
    // !null=true 가 되어 인터넷이 있어도 오프라인으로 오인됨. 그리고 이후
    // 네트워크 변화가 없으면 null 인 채로 멈춰 배너가 계속 떠 있음.
    // → 명시적으로 false 일 때만 오프라인 처리한다 (null/undefined = 오프라인 아님).
    const handle = (state) => setIsOffline(state.isConnected === false);
    // 시작 시 실제 상태를 1회 직접 조회해 첫 emit 의 null 을 보정
    NetInfo.fetch().then(handle).catch(() => {});
    const unsubscribe = NetInfo.addEventListener(handle);
    return () => unsubscribe();
  }, []);

  // ✅ 완전 자동 OTA 업데이트: 새 버전 감지 시 자동 다운로드 → 자동 재시작
  useEffect(() => {
    if (!isReady) return;

    const timer = setTimeout(async () => {
      if (!updatesCheckedRef.current && !__DEV__ && Updates.isEnabled) {
        updatesCheckedRef.current = true;

        // OTA 직후 재시작인 경우 체크 스킵 (무한루프 방지)
        const skipCheck = await AsyncStorage.getItem('OTA_SKIP_CHECK').catch(() => null);
        if (skipCheck) {
          await AsyncStorage.removeItem('OTA_SKIP_CHECK').catch(() => {});
          return;
        }

        try {
          const update = await Promise.race([
            Updates.checkForUpdateAsync(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
          ]);

          if (update?.isAvailable) {
            console.log("📦 새 업데이트 감지 - 자동 다운로드 시작...");

            await Promise.race([
              Updates.fetchUpdateAsync(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 20000))
            ]);

            console.log("✅ 다운로드 완료 - 자동 재시작...");

            // 루프 방지 플래그 저장 후 즉시 재시작
            await AsyncStorage.multiSet([
              ['OTA_JUST_APPLIED', '1'],
              ['OTA_SKIP_CHECK', '1'],
            ]).catch(() => {});

            // 프로세스 완전 재시작 (iOS/Android 동일) - 껐다 켜기와 동일하여 OTA 후 멈춤 방지
            RNRestart.Restart();
          }
        } catch (e) {
          console.log("⚠️ 업데이트 체크 실패 (앱 정상 작동):", e?.message);
        }
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isReady]); // isReady가 true가 된 후에만 실행

  // 🎯 앱 시작 5초 후 전면 팝업 광고 표시
  useEffect(() => {
    if (!isReady || showLanguageSelect || popupShownRef.current) return;

    const timer = setTimeout(() => {
      popupShownRef.current = true;
      setShowStartupPopup(true);
    }, 5000); // 5초 후 팝업 표시

    return () => clearTimeout(timer);
  }, [isReady, showLanguageSelect]);

  // ✅ iOS 크래시 수정: Firebase 초기화 완료 전에는 AuthProvider를 렌더링하지 않음
  // AuthProvider 내부의 onAuthStateChanged가 null auth를 참조하면 크래시 발생
  if (!isReady) {
    return (
      <View style={[styles.loadingOverlay, { backgroundColor: '#0f0f13' }]}>
        <SplashAnimation />
        <View style={[styles.progressBottomContainer, { position: 'absolute', bottom: 50, zIndex: 10 }]}>
          <ActivityIndicator size="small" color="#d4af37" />
          <Text style={[styles.loadingPercentText, { color: 'rgba(212, 175, 55, 0.7)', marginTop: 8 }]}>
            XinChaoVietnam 로딩 중...
          </Text>
          <View style={[styles.progressBarBg, { backgroundColor: 'rgba(255,255,255,0.1)', height: 3 }]}>
            <View
              style={[styles.progressBarFill, { width: `${loadProgress}%`, backgroundColor: '#d4af37' }]}
            />
          </View>
        </View>
      </View>
    );
  }

  // 🌐 첫 실행 시 언어 선택 화면 표시
  if (showLanguageSelect) {
    return (
      <LanguageSelectScreen
        onComplete={async () => {
          await setFirstLaunchComplete();
          setShowLanguageSelect(false);
        }}
      />
    );
  }

  return (
    <AuthProvider>
      <GlobalChatNotificationListener />
      <SafeAreaProvider>
        <NavigationContainer
          ref={navigationRef}
          // 🔍 [측정 인프라] 자동 화면 추적 — 모든 화면 진입을 GA4 screen_view 이벤트로 기록
          onReady={() => {
            const currentRoute = navigationRef.isReady() ? navigationRef.getCurrentRoute() : null;
            routeNameRef.current = currentRoute?.name;
            if (currentRoute?.name) {
              logScreenView(currentRoute.name);
            }
          }}
          onStateChange={() => {
            if (!navigationRef.isReady()) return;
            const previousRouteName = routeNameRef.current;
            const currentRouteName = navigationRef.getCurrentRoute()?.name;
            if (currentRouteName && previousRouteName !== currentRouteName) {
              routeNameRef.current = currentRouteName;
              logScreenView(currentRouteName);
            }
          }}
          linking={{
            prefixes: [
              Linking.createURL('/'),
              'chaovietnam://',
              'https://chaovietnam.co.kr',
              'https://www.chaovietnam.co.kr',
              // vnkorlife.com — 카톡/페북/이메일에서 공유되는 상품·채용·부동산 URL의 실제 도메인
              // 누락 시 React Navigation이 URL을 자기 관할로 인식 못 함 → 메인(뉴스) 화면으로 떨어짐
              'https://vnkorlife.com',
              'https://www.vnkorlife.com',
            ],
            // 🔗 expo-linking을 명시적으로 사용 (React Navigation 기본값은 react-native Linking)
            async getInitialURL() {
              const url = await Linking.getInitialURL();
              console.log('🔗 expo-linking getInitialURL:', url);
              return url;
            },
            subscribe(listener) {
              const sub = Linking.addEventListener('url', ({ url }) => {
                console.log('🔗 expo-linking URL event:', url);
                listener(url);
              });
              return () => sub.remove();
            },
            config: {
              screens: {
                MainApp: {
                  screens: {
                    '뉴스': {
                      screens: {
                        '뉴스메인': 'daily-news-terminal',
                      },
                    },
                    '당근/나눔': {
                      initialRouteName: '당근/나눔 메인',
                      screens: {
                        '당근/나눔 상세': 'danggn/:id',
                      },
                    },
                    '구인구직': {
                      initialRouteName: '구인구직 메인',
                      screens: {
                        '구인구직 상세': 'job/:id',
                      },
                    },
                    '부동산': {
                      initialRouteName: '부동산 메인',
                      screens: {
                        '부동산 상세': 'realestate/:id',
                      },
                    },
                    '이웃사업': {
                      initialRouteName: '이웃사업 메인',
                      screens: {
                        '이웃사업 상세': 'neighbor/:id',
                      },
                    },
                  },
                },
              },
            },
            getStateFromPath: (path, options) => {
              console.log('🔗 getStateFromPath 원본 path:', path);
              const cleanPath = path.replace(/^\/?(?:app\/share\/)?/, '');
              console.log('🔗 cleanPath:', cleanPath);

              // defaultGetStateFromPath 먼저 시도
              const state = defaultGetStateFromPath(cleanPath, options);
              if (state) {
                console.log('✅ defaultGetStateFromPath 성공');
                return state;
              }

              // 실패 시 수동으로 파싱 → 직접 state 생성
              console.log('⚠️ defaultGetStateFromPath 실패 → 수동 파싱 시도');
              // 📰 뉴스 터미널 URL → 뉴스 탭 메인으로 이동
              if (/^daily-news-terminal/.test(cleanPath)) {
                console.log('📰 뉴스 탭 딥링크 → 뉴스메인 이동');
                return {
                  routes: [{
                    name: 'MainApp',
                    state: { routes: [{ name: '뉴스', state: { routes: [{ name: '뉴스메인' }] } }] },
                  }],
                };
              }

              // 웹 경로명(market/jobs/realestate/neighborbusiness) → 내부 타입명(danggn/job/realestate/neighbor) 변환
              // 카톡·페북·이메일에서 공유되는 URL은 모두 *웹 경로명* 사용 (deepLinkUtils.js의 TYPE_TO_PATH)
              const WEB_TO_TYPE = {
                market: 'danggn',
                jobs: 'job',
                realestate: 'realestate',
                neighborbusiness: 'neighbor',
                // 내부 타입명도 그대로 받아 호환 유지
                danggn: 'danggn',
                job: 'job',
                neighbor: 'neighbor',
              };
              const pathKeys = Object.keys(WEB_TO_TYPE).join('|');

              // 🏷️ 탭전용 경로: /tab/{name} 또는 /{name} (ID없음) → 탭 메인
              const tabOnlyMatch = cleanPath.match(new RegExp(`^(?:tab\\/)?(${pathKeys})\\/?$`));
              if (tabOnlyMatch) {
                const type = WEB_TO_TYPE[tabOnlyMatch[1]];
                const tabName = { danggn: '당근/나눔', job: '구인구직', realestate: '부동산', neighbor: '이웃사업' }[type];
                console.log(`🏷️ 탭전용 딥링크: ${tabName} 탭 메인`);
                return {
                  routes: [{
                    name: 'MainApp',
                    state: { routes: [{ name: tabName }] },
                  }],
                };
              }

              const match = cleanPath.match(new RegExp(`^(${pathKeys})\\/([^?/]+)`));
              if (!match) {
                console.log('❌ 경로 파싱 실패:', cleanPath);
                return undefined;
              }

              const type = WEB_TO_TYPE[match[1]];
              const id = match[2];
              console.log(`🔗 수동 파싱 성공: type=${type}, id=${id} (원본 path=${match[1]})`);

              const screenMap = {
                danggn: { tab: '당근/나눔', main: '당근/나눔 메인', screen: '당근/나눔 상세' },
                job: { tab: '구인구직', main: '구인구직 메인', screen: '구인구직 상세' },
                realestate: { tab: '부동산', main: '부동산 메인', screen: '부동산 상세' },
                neighbor: { tab: '이웃사업', main: '이웃사업 메인', screen: '이웃사업 상세' },
              };
              const target = screenMap[type];
              if (!target) return undefined;

              // React Navigation state 구조 수동 생성
              // 메인 화면을 스택에 먼저 넣어서 뒤로가기 시 목록으로 돌아가도록 함
              return {
                routes: [
                  {
                    name: 'MainApp',
                    state: {
                      routes: [
                        {
                          name: target.tab,
                          state: {
                            routes: [
                              { name: target.main },
                              { name: target.screen, params: { id } },
                            ],
                          },
                        },
                      ],
                    },
                  },
                ],
              };
            },
          }}
          fallback={<ActivityIndicator size="large" color="#FF6B35" />}
        >
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />
          <ProfileCompletionPrompt />
          <RootNavigator />
        </NavigationContainer>

        {/* 🎯 앱 시작 5초 후 전면 팝업 광고 (10초 후 자동 닫힘) */}
        <PopupAd
          visible={showStartupPopup}
          onClose={() => setShowStartupPopup(false)}
          screen="startup"
          autoCloseSeconds={10}
        />

        {/* 🚨 강제 업데이트 팝업 — 닫기 불가, 스토어로 유도 */}
        <ForceUpdateModal visible={showForceUpdate} />

        {/* 네트워크 오프라인 배너 — 인터넷 끊길 시 상단 슬라이드인 */}
        <NetworkBanner isOffline={isOffline} />

      </SafeAreaProvider>
    </AuthProvider>
  );
}

// 스택 및 탭 정의
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// i18n 훅 사용을 위한 import
import { useTranslation } from 'react-i18next';

function HomeStack() {
  const { t } = useTranslation(['home', 'common']);
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="홈메인"
        component={MagazineScreen}
        initialParams={{ type: "home" }}
        options={({ navigation }) => ({
          title: "",
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <HamburgerMenuButton navigation={navigation} />
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("홈메인", {
                    type: "home",
                    categoryId: null,
                    resetSearch: Date.now(),
                  })
                }
                activeOpacity={0.7}
                style={{ marginLeft: 8 }}
              >
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                  {t('home:title')}
                </Text>
              </TouchableOpacity>
            </View>
          ),
          headerStyle: { backgroundColor: "#FF6B35", height: 70 },
          headerTintColor: "#fff",
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AdInquiryHeaderButton />
              <LanguageSwitcher />
              <UserAvatarButton navigation={navigation} />
            </View>
          ),
        })}
      />
      <Stack.Screen
        name="카테고리목록"
        component={MagazineScreen}
        options={({ route }) => ({
          title: route.params?.sectionName || "",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
          headerBackTitleVisible: false,
        })}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{
          title: t('home:postDetail'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
    </Stack.Navigator>
  );
}

function NewsStack() {
  const { t } = useTranslation(['home', 'common']);
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="뉴스메인"
        component={MagazineScreen}
        initialParams={{ type: "news", categoryId: 31 }}
        options={({ navigation }) => ({
          title: "",
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <HamburgerMenuButton navigation={navigation} />
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("뉴스메인", {
                    type: "news",
                    categoryId: 31,
                    resetSearch: Date.now(),
                  })
                }
                activeOpacity={0.7}
                style={{ marginLeft: 8 }}
              >
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                  {t('home:newsTitle')}
                </Text>
              </TouchableOpacity>
            </View>
          ),
          headerStyle: { backgroundColor: "#FF6B35", height: 70 },
          headerTintColor: "#fff",
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AdInquiryHeaderButton />
              <LanguageSwitcher />
              <UserAvatarButton navigation={navigation} />
            </View>
          ),
        })}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{
          title: t('home:postDetail'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
    </Stack.Navigator>
  );
}

function JobsStack() {
  const { t } = useTranslation(['jobs', 'common']);
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="구인구직 메인"
        component={JobsScreen}
        options={({ navigation }) => ({
          title: "",
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <HamburgerMenuButton navigation={navigation} />
              <TouchableOpacity
                onPress={() => navigation.navigate("구인구직 메인")}
                activeOpacity={0.7}
                style={{ marginLeft: 8 }}
              >
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                  {t('jobs:title')}
                </Text>
              </TouchableOpacity>
            </View>
          ),
          headerStyle: { backgroundColor: "#2196F3", height: 70 },
          headerTintColor: "#fff",
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AdInquiryHeaderButton />
              <LanguageSwitcher />
              <UserAvatarButton navigation={navigation} />
            </View>
          ),
        })}
      />
      <Stack.Screen
        name="구인구직 상세"
        component={JobDetailScreen}
        options={{
          title: t('jobs:jobDetail'),
          headerStyle: { backgroundColor: "#2196F3" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="구인구직 등록"
        component={AddJobScreen}
        options={{
          title: t('jobs:addJob'),
          headerStyle: { backgroundColor: "#2196F3" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="구직자 등록"
        component={AddCandidateScreen}
        options={{
          title: t('jobs:addJob'),
          headerStyle: { backgroundColor: "#FF7043" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="구직자 상세"
        component={CandidateDetailScreen}
        options={{
          title: "구직자 프로필",
          headerStyle: { backgroundColor: "#FF7043" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={{
          title: t('common:chat'),
          headerStyle: { backgroundColor: "#2196F3" },
          headerTintColor: "#fff",
          tabBarStyle: { display: 'none' },
        }}
      />
    </Stack.Navigator>
  );
}

function RealEstateStack() {
  const { t } = useTranslation(['realEstate', 'common']);
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="부동산 메인"
        component={RealEstateScreen}
        options={({ navigation }) => ({
          title: "",
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <HamburgerMenuButton navigation={navigation} />
              <TouchableOpacity
                onPress={() => navigation.navigate("부동산 메인")}
                activeOpacity={0.7}
                style={{ marginLeft: 8 }}
              >
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                  {t('realEstate:title')}
                </Text>
              </TouchableOpacity>
            </View>
          ),
          headerStyle: { backgroundColor: "#E91E63", height: 70 },
          headerTintColor: "#fff",
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AdInquiryHeaderButton />
              <LanguageSwitcher />
              <UserAvatarButton navigation={navigation} />
            </View>
          ),
        })}
      />
      <Stack.Screen
        name="부동산 상세"
        component={RealEstateDetailScreen}
        options={{
          title: t('realEstate:propertyDetail'),
          headerStyle: { backgroundColor: "#E91E63" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="부동산 등록"
        component={AddRealEstateScreen}
        options={{
          title: t('realEstate:addProperty'),
          headerStyle: { backgroundColor: "#E91E63" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="중개인 등록"
        component={AddAgentScreen}
        options={{
          title: "중개인 프로필",
          headerStyle: { backgroundColor: "#E91E63" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={{
          title: t('common:chat'),
          headerStyle: { backgroundColor: "#E91E63" },
          headerTintColor: "#fff",
          tabBarStyle: { display: 'none' },
        }}
      />
    </Stack.Navigator>
  );
}

function DanggnStack() {
  const { t } = useTranslation(['danggn', 'common']);
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="당근/나눔 메인"
        component={XinChaoDanggnScreen}
        options={({ navigation }) => ({
          title: "",
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <HamburgerMenuButton navigation={navigation} />
              <TouchableOpacity
                onPress={() => navigation.navigate("당근/나눔 메인")}
                activeOpacity={0.7}
                style={{ marginLeft: 8 }}
              >
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                  {t('danggn:title')}
                </Text>
              </TouchableOpacity>
            </View>
          ),
          headerStyle: { backgroundColor: "#FF6B35", height: 70 },
          headerTintColor: "#fff",
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AdInquiryHeaderButton />
              <LanguageSwitcher />
              <UserAvatarButton navigation={navigation} />
            </View>
          ),
        })}
      />
      <Stack.Screen
        name="당근/나눔 등록"
        component={AddItemScreen}
        options={{
          title: t('danggn:addItem'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="당근/나눔 상세"
        component={ItemDetailScreen}
        options={{
          title: t('danggn:itemDetail'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
          tabBarStyle: { display: 'none' },
        }}
      />
      <Stack.Screen
        name="당근/나눔 수정"
        component={AddItemScreen}
        options={{
          title: t('danggn:editItem'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="리뷰 작성"
        component={ReviewScreen}
        options={{
          title: t('danggn:writeReview'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={{
          title: t('common:chat'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
          tabBarStyle: { display: 'none' },
        }}
      />
    </Stack.Navigator>
  );
}

function MenuStack() {
  const { t } = useTranslation(['menu', 'navigation', 'common']);
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="메뉴메인"
        component={MoreScreen}
        options={({ navigation }) => ({
          title: t('menu:title'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("홈")}
              style={{ marginLeft: 12, padding: 4 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={26} color="#fff" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <LanguageSwitcher />
              <UserAvatarButton navigation={navigation} />
            </View>
          ),
        })}
      />
      <Stack.Screen
        name="My Page"
        component={MyPageScreen}
        options={{
          title: t('menu:myPage'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="내 채팅"
        component={ChatListScreen}
        options={{
          title: t('menu:myChats'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={{
          title: t('common:chat'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
          tabBarStyle: { display: 'none' },
        }}
      />
      <Stack.Screen
        name="찜한 물품"
        component={MyFavoritesScreen}
        options={{
          title: t('menu:favorites'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="북마크"
        component={BookmarksScreen}
        options={{
          title: t('menu:bookmarks'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="알림 설정"
        component={NotificationSettingScreen}
        options={{
          title: t('menu:notificationSettings'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="프로필"
        component={ProfileScreen}
        options={{
          title: t('menu:profile'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="관리자 페이지"
        component={AdminScreen}
        options={{
          title: t('menu:adminMenu'),
          headerStyle: { backgroundColor: "#dc3545" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="당근/나눔 상세"
        component={ItemDetailScreen}
        options={{
          title: t('navigation:headers.itemDetail'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
          tabBarStyle: { display: 'none' },
        }}
      />
      <Stack.Screen
        name="내 물품"
        component={MyItemsScreen}
        options={{
          title: t('menu:myItems'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="내 후기"
        component={MyCommentsScreen}
        options={{
          title: t('menu:myReviews'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="회원관리"
        component={UserManagementScreen}
        options={{
          title: t('menu:userManagement'),
          headerStyle: { backgroundColor: "#dc3545" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="알림"
        component={NotificationsScreen}
        options={({ navigation }) => ({
          title: t('menu:notifications'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("알림 설정")}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="settings-outline" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="알림 대화창 목록"
        component={AnnouncementsListScreen}
        options={{
          title: "알림 대화창",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="알림 대화창"
        component={AnnouncementDetailScreen}
        options={{
          title: "알림 대화창",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
    </Stack.Navigator>
  );
}


function NeighborBusinessesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="이웃사업 메인"
        component={NeighborBusinessesScreen}
        options={({ navigation }) => ({
          title: "",
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <HamburgerMenuButton navigation={navigation} />
              <TouchableOpacity
                onPress={() => navigation.navigate("이웃사업 메인")}
                activeOpacity={0.7}
                style={{ marginLeft: 8 }}
              >
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                  이웃사업
                </Text>
              </TouchableOpacity>
            </View>
          ),
          headerStyle: { backgroundColor: "#7C3AED", height: 70 },
          headerTintColor: "#fff",
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AdInquiryHeaderButton />
              <LanguageSwitcher />
              <UserAvatarButton navigation={navigation} />
            </View>
          ),
        })}
      />
      <Stack.Screen
        name="이웃사업 상세"
        component={NeighborBusinessDetailScreen}
        options={{
          title: "상세 보기",
          headerStyle: { backgroundColor: "#7C3AED" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="이웃사업 등록"
        component={AddNeighborBusinessScreen}
        options={({ route }) => ({
          title: route.params?.editId ? "수정" : "등록",
          headerStyle: { backgroundColor: "#7C3AED" },
          headerTintColor: "#fff",
        })}
      />
    </Stack.Navigator>
  );
}


function BottomTabNavigator() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('navigation');

  // 🚫 상세 페이지 + 관리자 화면 + 채팅방에서는 고정 하단 배너 숨김
  //    - 상세: 전화/채팅/후기 버튼이 가려지는 문제
  //    - 관리자 페이지/회원관리: 운영 작업 화면(목록 영역 확보 우선, 광고 노출 가치 없음)
  //    - ChatRoom/알림 대화창: 배너가 메시지 입력창·전송 버튼을 덮어 채팅 기능 마비
  //      (채팅목록→채팅방 경로는 스택에 '상세'가 없어 별도로 명시해야 숨겨짐)
  const NO_AD_ROUTE_NAMES = new Set(['관리자 페이지', '회원관리', '알림 대화창', 'ChatRoom']);
  const isDetailPage = require('@react-navigation/native').useNavigationState(state => {
    if (!state) return false;
    const checkRoute = (route) => {
      if (route.name && (route.name.includes('상세') || NO_AD_ROUTE_NAMES.has(route.name))) return true;
      if (route.state?.routes) return route.state.routes.some(r => checkRoute(r));
      return false;
    };
    return state.routes?.some(r => checkRoute(r)) || false;
  });
  // 탭 라벨 번역 맵
  const tabLabels = {
    "홈": t('tabs.home'),
    "뉴스": t('tabs.news'),
    "당근/나눔": t('tabs.danggn'),
    "이웃사업": t('tabs.neighborBusinesses'),
    "구인구직": t('tabs.jobs'),
    "부동산": t('tabs.realEstate'),
  };

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="뉴스"
        screenOptions={({ route }) => {
          // G1 디자인: 라벨 글자수에 비례한 탭 너비 (SYSTEM_OVERVIEW.md §6 참조)
          const tabFlex = {
            "홈": 0.8,
            "뉴스": 0.8,
            "당근/나눔": 1.05,
            "이웃사업": 1.3,
            "구인구직": 1.05,
            "부동산": 1.05,
          }[route.name] ?? 1;
          // 마지막 탭(부동산)은 오른쪽 구분선 제거
          const isLastTab = route.name === "부동산";

          return {
            headerShown: false,
            lazy: false,
            tabBarLabel: tabLabels[route.name] || route.name,
            tabBarIcon: ({ focused, color }) => {
              let iconName;
              if (route.name === "홈") iconName = focused ? "home" : "home-outline";
              else if (route.name === "뉴스")
                iconName = focused ? "newspaper" : "newspaper-outline";
              else if (route.name === "당근/나눔")
                iconName = focused ? "gift" : "gift-outline";
              else if (route.name === "이웃사업")
                iconName = focused ? "storefront" : "storefront-outline";
              else if (route.name === "구인구직")
                iconName = focused ? "briefcase" : "briefcase-outline";
              else if (route.name === "부동산")
                iconName = focused ? "business" : "business-outline";
              return <Ionicons name={iconName} size={20} color={color} />;
            },
            tabBarActiveTintColor: route.name === '이웃사업' ? '#7C3AED' : "#FF6B35",
            tabBarInactiveTintColor: "#666",
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: "500",
              marginBottom: 2,
            },
            tabBarItemStyle: {
              flex: tabFlex,
              borderRightWidth: isLastTab ? 0 : 1,
              borderRightColor: "#e5e5e5",
            },
            // 🔥 시스템 영역(제스처 바) 위로 탭바 올리기
            tabBarStyle: {
              paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
              height: 56 + (insets.bottom > 0 ? insets.bottom : 8),
            },
          };
        }}
      >
        <Tab.Screen
          name="홈"
          component={HomeStack}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              navigation.navigate("홈", {
                screen: "홈메인",
                params: {
                  type: "home",
                  categoryId: null,
                  resetSearch: Date.now(),
                },
              });
            },
          })}
        />
        <Tab.Screen
          name="뉴스"
          component={NewsStack}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              navigation.navigate("뉴스", {
                screen: "뉴스메인",
                params: { type: "news", resetSearch: Date.now() },
              });
            },
          })}
        />
        <Tab.Screen
          name="당근/나눔"
          component={DanggnStack}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              navigation.navigate("당근/나눔", {
                screen: "당근/나눔 메인",
              });
            },
          })}
        />
        <Tab.Screen
          name="이웃사업"
          component={NeighborBusinessesStack}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              navigation.navigate("이웃사업", {
                screen: "이웃사업 메인",
              });
            },
          })}
        />
        <Tab.Screen
          name="구인구직"
          component={JobsStack}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              navigation.navigate("구인구직", {
                screen: "구인구직 메인",
              });
            },
          })}
        />
        <Tab.Screen
          name="부동산"
          component={RealEstateStack}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              navigation.navigate("부동산", {
                screen: "부동산 메인",
              });
            },
          })}
        />
        {/* 숨김 탭 - 햄버거/아바타 버튼으로만 진입. 진입 시에도 하단 탭바 유지 */}
        <Tab.Screen
          name="메뉴"
          component={MenuStack}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
      </Tab.Navigator>

      {/* 📢 고정 하단 배너 - 탭바 바로 위에 위치 (상세 페이지에서는 숨김) */}
      {!isDetailPage && <FixedBottomBanner screen="all" />}
    </View>
  );
}

function RootNavigator() {
  const { user, isVisitor } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ presentation: "modal" }}>
      {/* 로그인된 사용자 또는 방문자 모드: MainApp이 첫 화면 */}
      {(user || isVisitor) && (
        <Stack.Screen
          name="MainApp"
          component={BottomTabNavigator}
          options={{ headerShown: false }}
        />
      )}
      {/* 비로그인 시 로그인이 첫 화면 / 로그인된 경우에도 스택에 포함 (navigate 호환) */}
      <Stack.Screen
        name="로그인"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="회원가입"
        component={SignupScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="환영"
        component={WelcomeAfterSignupScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="아이디찾기"
        component={FindIdScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="비밀번호찾기"
        component={FindPasswordScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

const GlobalChatNotificationListener = () => {
  useEffect(() => {
    // NotificationService 초기화 (알림 핸들러, 리스너, 토큰 등록 통합 관리)
    notificationService.initialize();
    console.log("🔔 Global Notification Service 활성화됨");
  }, []);
  return null;
};

// 📝 로그인 후 프로필 미작성 유저에게 프로필 작성 유도 팝업 (하루 1회)
const ProfileCompletionPrompt = () => {
  const { user, needsProfileComplete, setNeedsProfileComplete } = useAuth();
  const navigation = useNavigation();
  const promptShownRef = useRef(false);

  useEffect(() => {
    if (!user || !needsProfileComplete || promptShownRef.current) return;

    const checkAndShow = async () => {
      try {
        // 마지막 팝업 표시 시간 확인 (하루 1회 제한)
        const lastShown = await AsyncStorage.getItem("@profile_prompt_last");
        if (lastShown) {
          const lastDate = new Date(lastShown).toDateString();
          const today = new Date().toDateString();
          if (lastDate === today) return; // 오늘 이미 보여줌
        }

        promptShownRef.current = true;
        await AsyncStorage.setItem("@profile_prompt_last", new Date().toISOString());

        // 가입 후 aha moment: "왜 앱인가" 즉시 가치 노출 (잔소리 X, 보상 O)
        // 8초 → 3초로 단축. 알림 권한 팝업(5초)보다 *먼저* 떠서 환영 흐름 선점.
        setTimeout(() => {
          Alert.alert(
            "🎉 씬짜오 베트남에 오신 걸 환영합니다",
            "내 지역의 새 채용 · 부동산 · 중고거래를 가장 먼저 받아보려면 *알림*과 *지역 설정*이 필요합니다.\n\n지금 1분만 투자하시면 매일 맞춤 정보가 도착합니다.",
            [
              {
                text: "둘러보기 먼저",
                style: "cancel",
              },
              {
                text: "1분 설정 →",
                style: "default",
                onPress: () => {
                  setNeedsProfileComplete(false);
                  navigation.navigate("MainApp", {
                    screen: "메뉴",
                    params: { screen: "프로필" },
                  });
                },
              },
            ]
          );
        }, 3000);
      } catch (e) {
        console.log("프로필 프롬프트 체크 실패:", e);
      }
    };

    checkAndShow();

    // 로그아웃 시 리셋
    return () => { };
  }, [user, needsProfileComplete]);

  // 로그아웃 시 리셋
  useEffect(() => {
    if (!user) {
      promptShownRef.current = false;
    }
  }, [user]);

  return null;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  statusBarBackground: { backgroundColor: "#fff" },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    paddingHorizontal: 30,
  },
  progressBottomContainer: {
    alignItems: "center",
    width: "100%",
    position: "absolute",
    bottom: 100,
  },
  loadingPercentText: {
    marginBottom: 20,
    fontSize: 16,
    color: "#666",
    fontWeight: "600",
  },
  progressBarBg: {
    width: "80%",
    height: 6,
    backgroundColor: "#eee",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 15,
  },
  progressBarFill: { height: "100%", backgroundColor: "#FF6B35" },
  loadingPercent: { fontSize: 24, color: "#FF6B35", fontWeight: "bold" },
});
