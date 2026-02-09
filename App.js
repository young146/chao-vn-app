import "react-native-gesture-handler";
import { LogBox, Platform, Alert, Linking } from "react-native";

// i18n 초기화 (앱 시작 시 바로 실행)
import './i18n';
import { isFirstLaunch, setFirstLaunchComplete } from './i18n';
import Constants from "expo-constants";
// LogBox.ignoreAllLogs(true);

// expo-tracking-transparency는 Expo Go에서 사용 불가 (프로덕션 빌드에서만 작동)
let requestTrackingPermissionsAsync = null;
const isExpoGo = Constants.appOwnership === 'expo';
if (!isExpoGo) {
  try {
    const TrackingTransparency = require("expo-tracking-transparency");
    requestTrackingPermissionsAsync = TrackingTransparency.requestTrackingPermissionsAsync;
  } catch (e) {
    console.log("⚠️ expo-tracking-transparency 로드 실패 (Expo Go에서는 정상)");
  }
}

// AdMob SDK 초기화 (Android에서만 사용)
let mobileAds = null;
if (Platform.OS === 'android') {
  try {
    mobileAds = require('react-native-google-mobile-ads').default;
  } catch (e) {
    console.log("⚠️ AdMob SDK 로드 실패:", e.message);
  }
}

const initializeAdMob = async () => {
  if (Platform.OS !== 'android' || !mobileAds) {
    console.log("ℹ️ AdMob 초기화 스킵 (Android 아님 또는 SDK 없음)");
    return false;
  }
  
  try {
    const adapterStatuses = await mobileAds().initialize();
    console.log("✅ AdMob SDK 초기화 완료:", adapterStatuses);
    return true;
  } catch (e) {
    console.log("❌ AdMob SDK 초기화 실패:", e.message);
    return false;
  }
};

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
import * as SplashScreen from "expo-splash-screen";
import { NavigationContainer } from "@react-navigation/native";
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
import { getHomeDataCached, hasHomeDataCache } from "./services/wordpressApi";
import notificationService from "./services/NotificationService";
import { initializeFirebase } from "./firebase/config";

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
import { PopupAd } from "./components/AdBanner";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
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
import AddItemScreen from "./screens/AddItemScreen";
import ItemDetailScreen from "./screens/ItemDetailScreen";
import JobsScreen from "./screens/JobsScreen";
import JobDetailScreen from "./screens/JobDetailScreen";
import AddJobScreen from "./screens/AddJobScreen";
import RealEstateScreen from "./screens/RealEstateScreen";
import RealEstateDetailScreen from "./screens/RealEstateDetailScreen";
import AddRealEstateScreen from "./screens/AddRealEstateScreen";
import AdminScreen from "./screens/AdminScreen";
import LanguageSelectScreen from "./screens/LanguageSelectScreen";
import LanguageSwitcher from "./components/LanguageSwitcher";

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);
  const [showStartupPopup, setShowStartupPopup] = useState(false);
  const updatesCheckedRef = useRef(false);
  const popupShownRef = useRef(false);

  // 🔗 딥링크 처리
  useEffect(() => {
    const handleDeepLink = (event) => {
      const url = event.url;
      console.log('🔗 딥링크 수신:', url);
      Alert.alert('딥링크 수신', url);
    };

    // 초기 URL 확인 (앱이 닫혀있다가 딥링크로 열린 경우)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🔗 초기 딥링크:', url);
        Alert.alert('초기 딥링크', url);
      }
    });

    // URL 이벤트 리스너 (앱이 실행 중일 때 딥링크 수신)
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => subscription.remove();
  }, []);

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

        // 🚀 1. 캐시 먼저 확인 - 있으면 즉시 진입! (최우선)
        const hasCache = await hasHomeDataCache();

        if (hasCache) {
          console.log("✅ 캐시 발견! 즉시 진입");
          setIsReady(true);

          // 백그라운드에서 모든 초기화 + 데이터 갱신 (사용자는 안 기다림)
          Promise.allSettled([
            // Firebase 초기화
            waitForFirebase(2000),
            initializeFirebase(),
            !__DEV__ && initializeAppCheck(),
            // AdMob SDK 초기화 (Android)
            initializeAdMob(),
            // 데이터 갱신
            getHomeDataCached(true),
            // 광고 동의 (백그라운드)
            Platform.OS === "android" && (async () => {
              try {
                const { requestAdConsent } = require("./services/AdConsentService");
                const result = await requestAdConsent();
                if (result.canShowAds) {
                  const { preloadInterstitialAd } = require("./services/InterstitialAdService");
                  preloadInterstitialAd();
                }
              } catch (e) {}
            })(),
          ]).then(() => console.log("✅ 백그라운드 초기화 완료"));
          
          console.log(`⏱️ 즉시 진입: ${Date.now() - startTime}ms`);
          return;
        }

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

        // 모든 초기화를 병렬로 + 최대 2초 타임아웃
        const MAX_INIT_TIME = 2000; // 최대 2초

        const allInitPromise = Promise.allSettled([
          waitForFirebase(1500),
          initializeFirebase(),
          !__DEV__ && initializeAppCheck(),
          // AdMob SDK 초기화 (Android)
          initializeAdMob(),
          getHomeDataCached(),
          // 광고 동의도 병렬로
          Platform.OS === "ios" && requestTrackingPermissionsAsync?.(),
          Platform.OS === "android" && (async () => {
            try {
              const { requestAdConsent } = require("./services/AdConsentService");
              await requestAdConsent();
            } catch (e) {}
          })(),
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

        setTimeout(() => setIsReady(true), 100);
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

  // ✅ 첫 화면이 완전히 렌더링된 후 Updates 체크
  // "content appeared" 이벤트 이후에 실행하여 ErrorRecovery 크래시 방지
  useEffect(() => {
    if (!isReady) return; // 아직 준비 안됨
    
    // 첫 화면 렌더링 완료 대기 (content appeared 이벤트 이후)
    const timer = setTimeout(async () => {
      if (!updatesCheckedRef.current && !__DEV__ && Updates.isEnabled) {
        updatesCheckedRef.current = true;
        
        try {
          console.log("📦 첫 화면 렌더링 완료, 업데이트 체크 시작...");
          
          // 타임아웃과 함께 안전하게 체크
          const update = await Promise.race([
            Updates.checkForUpdateAsync(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Updates check timeout')), 10000)
            )
          ]);
          
          if (update && update.isAvailable) {
            console.log("📦 새 업데이트 발견, 다운로드 중...");
            await Promise.race([
              Updates.fetchUpdateAsync(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Updates fetch timeout')), 15000)
              )
            ]);
            console.log("✅ 업데이트 다운로드 완료");
            
            // 🔔 업데이트 완료 팝업 표시 (지금 적용이 기본 선택)
            Alert.alert(
              "🎉 새로운 업데이트",
              "새로운 기능이 추가되었습니다!\n지금 업데이트를 적용하시겠습니까?",
              [
                { 
                  text: "나중에", 
                  style: "cancel",
                  onPress: () => console.log("업데이트 나중에 적용")
                },
                { 
                  text: "지금 적용", 
                  style: "default",
                  isPreferred: true,
                  onPress: async () => {
                    try {
                      await Updates.reloadAsync();
                    } catch (e) {
                      console.log("업데이트 적용 실패:", e);
                    }
                  }
                }
              ],
              { cancelable: false } // 뒤로가기나 바깥 터치로 닫기 방지
            );
          } else {
            console.log("✅ 최신 버전입니다");
          }
        } catch (updateError) {
          console.log("⚠️ 업데이트 체크 실패 (앱은 정상 작동):", updateError?.message || updateError);
          // 업데이트 실패해도 앱은 정상 작동
        }
      }
    }, 3000); // 첫 화면 렌더링 후 3초 대기 (content appeared 이벤트 확실히 발생 후)
    
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
      <View style={styles.loadingOverlay}>
        <ExpoImage
          source={require("./assets/icon.png")}
          style={{ width: 150, height: 150, marginBottom: 50 }}
          contentFit="contain"
        />
        <View style={styles.progressBottomContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingPercentText}>
            첫 실행 데이터 준비 중...
          </Text>
          <View style={styles.progressBarBg}>
            <View
              style={[styles.progressBarFill, { width: `${loadProgress}%` }]}
            />
          </View>
          <Text style={styles.loadingPercent}>
            {Math.round(loadProgress)}%
          </Text>
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
          linking={{
            prefixes: [
              "chaovietnam://",
              "xinchao://",
              "com.yourname.chaovnapp://",
              "exp+chao-vn-app://",
              "https://auth.expo.io/@young146/chao-vn-app",
              "https://chaovietnam.co.kr",
              "https://chaovietnam.co.kr/app/share",
            ],
            config: {
              screens: {
                MainApp: {
                  screens: {
                    홈: {
                      screens: {
                        홈메인: {
                          path: "",
                          parse: {
                            type: () => "home",
                            categoryId: (categoryId) => categoryId ? parseInt(categoryId) : null,
                          },
                        },
                      },
                    },
                    뉴스: {
                      screens: {
                        뉴스메인: {
                          path: "daily-news",
                          parse: {
                            type: () => "news",
                            categoryId: () => 31,
                          },
                        },
                      },
                    },
                    씬짜오나눔: {
                      screens: {
                        씬짜오나눔메인: "danggn",
                        물품상세: {
                          path: "danggn/:id",
                          parse: {
                            id: (id) => `${id}`,
                          },
                        },
                      },
                    },
                    구인구직: {
                      screens: {
                        Jobs메인: "job",
                        Jobs상세: {
                          path: "job/:id",
                          parse: {
                            id: (id) => `${id}`,
                          },
                        },
                      },
                    },
                    부동산: {
                      screens: {
                        부동산메인: "realestate",
                        부동산상세: {
                          path: "realestate/:id",
                          parse: {
                            id: (id) => `${id}`,
                          },
                        },
                      },
                    },
                    Chat: "chat",
                    Menu: "menu",
                  },
                },
                로그인: "login",
              },
            },
          }}
        >
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />
          <RootNavigator />
        </NavigationContainer>
        
        {/* 🎯 앱 시작 5초 후 전면 팝업 광고 (10초 후 자동 닫힘) */}
        <PopupAd 
          visible={showStartupPopup} 
          onClose={() => setShowStartupPopup(false)}
          screen="startup"
          autoCloseSeconds={10}
        />
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
          headerTitle: () => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("홈메인", {
                  type: "home",
                  categoryId: null,
                  resetSearch: Date.now(),
                })
              }
              activeOpacity={0.7}
            >
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                {t('home:title')}
              </Text>
              <Text style={{ color: "#333", fontSize: 12, marginTop: 2 }}>
                {t('home:subtitle')}
              </Text>
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: "#FF6B35", height: 70 },
          headerTintColor: "#fff",
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <LanguageSwitcher />
              <TouchableOpacity
                onPress={() => navigation.navigate("메뉴")}
                style={{ marginRight: 16, alignItems: "center" }}
              >
                <Ionicons name="menu" size={22} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 9 }}>{t('common:more')}</Text>
              </TouchableOpacity>
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

function NewsStack() {
  const { t } = useTranslation(['home', 'common']);
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="뉴스메인"
        component={MagazineScreen}
        initialParams={{ type: "news", categoryId: 31 }}
        options={({ navigation }) => ({
          headerTitle: () => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("뉴스메인", {
                  type: "news",
                  categoryId: 31,
                  resetSearch: Date.now(),
                })
              }
              activeOpacity={0.7}
            >
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                {t('home:newsTitle')}
              </Text>
              <Text style={{ color: "#333", fontSize: 12, marginTop: 2 }}>
                {t('home:newsSubtitle')}
              </Text>
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: "#FF6B35", height: 70 },
          headerTintColor: "#fff",
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <LanguageSwitcher />
              <TouchableOpacity
                onPress={() => navigation.navigate("메뉴")}
                style={{ marginRight: 16, alignItems: "center" }}
              >
                <Ionicons name="menu" size={22} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 9 }}>{t('common:more')}</Text>
              </TouchableOpacity>
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
        name="Jobs메인"
        component={JobsScreen}
        options={({ navigation }) => ({
          headerTitle: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("Jobs메인")}
              activeOpacity={0.7}
            >
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                {t('jobs:title')}
              </Text>
              <Text style={{ color: "#333", fontSize: 12, marginTop: 2 }}>
                {t('jobs:subtitle')}
              </Text>
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: "#2196F3", height: 70 },
          headerTintColor: "#fff",
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <LanguageSwitcher />
              <TouchableOpacity
                onPress={() => navigation.navigate("메뉴")}
                style={{ marginRight: 16, alignItems: "center" }}
              >
                <Ionicons name="menu" size={22} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 9 }}>{t('common:more')}</Text>
              </TouchableOpacity>
            </View>
          ),
        })}
      />
      <Stack.Screen
        name="Jobs상세"
        component={JobDetailScreen}
        options={{
          title: t('jobs:jobDetail'),
          headerStyle: { backgroundColor: "#2196F3" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="Jobs등록"
        component={AddJobScreen}
        options={{
          title: t('jobs:addJob'),
          headerStyle: { backgroundColor: "#2196F3" },
          headerTintColor: "#fff",
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
        name="부동산메인"
        component={RealEstateScreen}
        options={({ navigation }) => ({
          headerTitle: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("부동산메인")}
              activeOpacity={0.7}
            >
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                {t('realEstate:title')}
              </Text>
              <Text style={{ color: "#333", fontSize: 12, marginTop: 2 }}>
                {t('realEstate:subtitle')}
              </Text>
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: "#E91E63", height: 70 },
          headerTintColor: "#fff",
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <LanguageSwitcher />
              <TouchableOpacity
                onPress={() => navigation.navigate("메뉴", { screen: "메뉴메인" })}
                style={{ marginRight: 16, alignItems: "center" }}
              >
                <Ionicons name="menu" size={22} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 9 }}>{t('common:more')}</Text>
              </TouchableOpacity>
            </View>
          ),
        })}
      />
      <Stack.Screen
        name="부동산상세"
        component={RealEstateDetailScreen}
        options={{
          title: t('realEstate:propertyDetail'),
          headerStyle: { backgroundColor: "#E91E63" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="부동산등록"
        component={AddRealEstateScreen}
        options={{
          title: t('realEstate:addProperty'),
          headerStyle: { backgroundColor: "#E91E63" },
          headerTintColor: "#fff",
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
        name="씬짜오나눔메인"
        component={XinChaoDanggnScreen}
        options={({ navigation }) => ({
          headerTitle: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("씬짜오나눔메인")}
              activeOpacity={0.7}
            >
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                {t('danggn:title')}
              </Text>
              <Text style={{ color: "#333", fontSize: 12, marginTop: 2 }}>
                {t('danggn:subtitle')}
              </Text>
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: "#FF6B35", height: 70 },
          headerTintColor: "#fff",
          headerRight: () => <DanggnHeaderRight navigation={navigation} />,
        })}
      />
      <Stack.Screen
        name="물품 등록"
        component={AddItemScreen}
        options={{
          title: t('danggn:addItem'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="물품 상세"
        component={ItemDetailScreen}
        options={{
          title: t('danggn:itemDetail'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="물품 수정"
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
        options={{
          title: t('menu:title'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
          headerRight: () => <LanguageSwitcher />,
        }}
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
        name="물품 상세"
        component={ItemDetailScreen}
        options={{
          title: t('navigation:headers.itemDetail'),
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
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
    </Stack.Navigator>
  );
}

function DanggnHeaderRight({ navigation }) {
  const { t } = useTranslation('common');
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}
    >
      <LanguageSwitcher />
      <TouchableOpacity
        style={{ padding: 8, alignItems: "center" }}
        onPress={() => navigation.navigate("메뉴")}
      >
        <Ionicons name="menu" size={22} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 9 }}>{t('more')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function BottomTabNavigator() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('navigation');

  // 탭 라벨 번역 맵
  const tabLabels = {
    "홈": t('tabs.home'),
    "뉴스": t('tabs.news'),
    "당근/나눔": t('tabs.danggn'),
    "Jobs": t('tabs.jobs'),
    "부동산": t('tabs.realEstate'),
  };

  return (
    <Tab.Navigator
      initialRouteName="뉴스"
      screenOptions={({ route }) => ({
        headerShown: false,
        lazy: false,
        tabBarLabel: tabLabels[route.name] || route.name,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === "홈") iconName = focused ? "home" : "home-outline";
          else if (route.name === "뉴스")
            iconName = focused ? "newspaper" : "newspaper-outline";
          else if (route.name === "Jobs")
            iconName = focused ? "briefcase" : "briefcase-outline";
          else if (route.name === "부동산")
            iconName = focused ? "business" : "business-outline";
          else if (route.name === "당근/나눔")
            iconName = focused ? "gift" : "gift-outline";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#FF6B35",
        tabBarInactiveTintColor: "#555",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginBottom: 2,
        },
        // 🔥 시스템 영역(제스처 바) 위로 탭바 올리기
        tabBarStyle: {
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          height: 56 + (insets.bottom > 0 ? insets.bottom : 8),
        },
      })}
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
              screen: "씬짜오나눔메인",
            });
          },
        })}
      />
      <Tab.Screen
        name="Jobs"
        component={JobsStack}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            navigation.navigate("Jobs", {
              screen: "Jobs메인",
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
              screen: "부동산메인",
            });
          },
        })}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ presentation: "modal" }}>
      <Stack.Screen
        name="MainApp"
        component={BottomTabNavigator}
        options={{ headerShown: false }}
      />
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
        name="아이디찾기"
        component={FindIdScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="비밀번호찾기"
        component={FindPasswordScreen}
        options={{ headerShown: false }}
      />
      {/* 메뉴 화면들 - 어디서든 접근 가능 */}
      <Stack.Screen
        name="메뉴"
        component={MenuStack}
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
