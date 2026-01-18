import "react-native-gesture-handler";
import { LogBox } from "react-native";
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
const waitForFirebase = async (timeout = 5000) => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const apps = firebase.apps;
      if (apps && apps.length > 0) {
        const app = firebase.app();
        if (app && app.name === "[DEFAULT]") {
          console.log("✅ 네이티브 Firebase 초기화 완료");
          return true;
        }
      }
    } catch (e) {
      // 아직 초기화 안됨 - 계속 대기
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log("⚠️ 네이티브 Firebase 초기화 타임아웃 (기본값으로 진행)");
  return false;
};

import React, { useEffect, useState, useRef } from "react";
import { Image as ExpoImage } from "expo-image";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
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
import AdminScreen from "./screens/AdminScreen";

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const updatesCheckedRef = useRef(false);

  // 🚀 캐시 우선 로딩 전략
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log("🚀 앱 초기화 시작...");
        const startTime = Date.now();

        // ✅ 0. 네이티브 Firebase 초기화 완료 대기 (최우선)
        // 네이티브 모듈이 완전히 준비될 때까지 대기
        const firebaseReady = await waitForFirebase(5000);
        if (!firebaseReady) {
          console.log("⚠️ 네이티브 Firebase 초기화 지연, 계속 진행...");
        }

        // ✅ 0.1 웹 Firebase 초기화 (네이티브 Firebase 이후)
        // Lazy initialization으로 변경했으므로 명시적으로 초기화
        try {
          await initializeFirebase();
          console.log("✅ 웹 Firebase 초기화 완료");
        } catch (webFirebaseError) {
          console.log("⚠️ 웹 Firebase 초기화 실패 (계속 진행):", webFirebaseError?.message);
        }

        // ✅ 0.5 App Check 초기화 (Firebase 백엔드 보안)
        // 프로덕션에서만 활성화
        if (!__DEV__) {
          try {
            await initializeAppCheck();
          } catch (appCheckError) {
            console.log("⚠️ App Check 초기화 실패 (계속 진행):", appCheckError?.message);
          }
        }

        // ⚠️ Updates 체크는 첫 화면 렌더링 이후로 이동 (아래 useEffect에서 처리)

        // 2. 캐시 확인 - 있으면 즉시 진입!
        const hasCache = await hasHomeDataCache();

        if (hasCache) {
          console.log("✅ 캐시 발견! 즉시 진입");
          setIsReady(true);

          // 백그라운드에서 조용히 데이터 갱신 (사용자는 모름)
          getHomeDataCached(true); // forceRefresh = true
          console.log(`⏱️ 총 소요시간: ${Date.now() - startTime}ms`);
          return;
        }

        // 3. 캐시 없음 (첫 설치) → 로딩 화면 표시
        console.log("⏳ 첫 실행, 데이터 로딩 중...");

        let progress = 0;
        const interval = setInterval(() => {
          if (progress < 90) {
            progress += Math.random() * 20;
            if (progress > 90) progress = 90;
            setLoadProgress(progress);
          }
        }, 150);

        // 최적화된 단일 API 호출
        await getHomeDataCached();

        clearInterval(interval);
        setLoadProgress(100);

        console.log(`⏱️ 첫 로딩 완료: ${Date.now() - startTime}ms`);
        setTimeout(() => setIsReady(true), 100);
      } catch (error) {
        console.log("초기화 에러:", error);
        setIsReady(true); // 에러 시에도 진입
      }
    };

    initializeApp();
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
            console.log("✅ 업데이트 다운로드 완료, 다음 실행 시 적용됩니다");
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

  return (
    <AuthProvider>
      {!isReady ? (
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
      ) : (
        <>
          <GlobalChatNotificationListener />
          <SafeAreaProvider>
            <NavigationContainer
              linking={{
                prefixes: [
                  "xinchao://",
                  "com.yourname.chaovnapp://",
                  "exp+chao-vn-app://",
                  "https://auth.expo.io/@young146/chao-vn-app",
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
                        씬짜오나눔: "danggn",
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
          </SafeAreaProvider>
        </>
      )}
    </AuthProvider>
  );
}

// 스택 및 탭 정의
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeStack() {
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
                씬짜오베트남
              </Text>
              <Text style={{ color: "#333", fontSize: 12, marginTop: 2 }}>
                2002년부터 격주 발행, 베트남 교민사회의 길잡이
              </Text>
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: "#FF6B35", height: 70 },
          headerTintColor: "#fff",
        })}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{
          title: "상세보기",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
    </Stack.Navigator>
  );
}

function NewsStack() {
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
                데일리 뉴스
              </Text>
              <Text style={{ color: "#333", fontSize: 12, marginTop: 2 }}>
                매일 아침 발행되는 온라인 베트남 뉴스
              </Text>
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: "#FF6B35", height: 70 },
          headerTintColor: "#fff",
        })}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{
          title: "상세보기",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
    </Stack.Navigator>
  );
}

function BoardStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="게시판메인"
        component={MagazineScreen}
        initialParams={{ type: "board" }}
        options={({ navigation }) => ({
          headerTitle: () => (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("게시판메인", {
                  type: "board",
                  resetSearch: Date.now(),
                })
              }
              activeOpacity={0.7}
            >
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                게시판
              </Text>
              <Text style={{ color: "#333", fontSize: 12, marginTop: 2 }}>
                우리 이웃들의 소리가 담긴 베트남 교민 커뮤니티
              </Text>
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: "#FF6B35", height: 70 },
          headerTintColor: "#fff",
        })}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{
          title: "상세보기",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
    </Stack.Navigator>
  );
}

function DanggnStack() {
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
                나눔
              </Text>
              <Text style={{ color: "#333", fontSize: 12, marginTop: 2 }}>
                무료 나눔, 중고 거래소. 내 아파트 주변 물품 찾기
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
          title: "물품 등록",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="물품 상세"
        component={ItemDetailScreen}
        options={{
          title: "물품 상세",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="물품 수정"
        component={AddItemScreen}
        options={{
          title: "물품 수정",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="리뷰 작성"
        component={ReviewScreen}
        options={{
          title: "리뷰 작성",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={{
          title: "채팅",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
    </Stack.Navigator>
  );
}

function MenuStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="메뉴메인"
        component={MoreScreen}
        options={{
          title: "메뉴",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="My Page"
        component={MyPageScreen}
        options={{
          title: "My Page",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="내 채팅"
        component={ChatListScreen}
        options={{
          title: "내 채팅",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={{
          title: "채팅",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="찜한 물품"
        component={MyFavoritesScreen}
        options={{
          title: "찜한 물품",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="북마크"
        component={BookmarksScreen}
        options={{
          title: "북마크",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="알림 설정"
        component={NotificationSettingScreen}
        options={{
          title: "알림 설정",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="프로필"
        component={ProfileScreen}
        options={{
          title: "프로필",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="관리자 페이지"
        component={AdminScreen}
        options={{
          title: "관리자 페이지",
          headerStyle: { backgroundColor: "#dc3545" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="물품 상세"
        component={ItemDetailScreen}
        options={{
          title: "물품 상세",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="내 물품"
        component={MyItemsScreen}
        options={{
          title: "내 물품",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="내 후기"
        component={MyCommentsScreen}
        options={{
          title: "내 후기",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="회원관리"
        component={UserManagementScreen}
        options={{
          title: "회원관리",
          headerStyle: { backgroundColor: "#dc3545" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="알림"
        component={NotificationsScreen}
        options={({ navigation }) => ({
          title: "알림",
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
  const { user } = useAuth();
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}
    >
      {user ? (
        <TouchableOpacity
          style={{ padding: 8 }}
          onPress={() => navigation.navigate("Menu")}
        >
          <Ionicons name="person-circle" size={28} color="#fff" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.2)",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 16,
            marginLeft: 8,
          }}
          onPress={() => navigation.navigate("로그인")}
        >
          <Ionicons name="log-in-outline" size={18} color="#fff" />
          <Text
            style={{
              marginLeft: 4,
              fontSize: 13,
              fontWeight: "600",
              color: "#fff",
            }}
          >
            로그인
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function BottomTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="홈"
      screenOptions={({ route }) => ({
        headerShown: false,
        lazy: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === "홈") iconName = focused ? "home" : "home-outline";
          else if (route.name === "뉴스")
            iconName = focused ? "newspaper" : "newspaper-outline";
          else if (route.name === "게시판")
            iconName = focused ? "chatbubbles" : "chatbubbles-outline";
          else if (route.name === "나눔")
            iconName = focused ? "gift" : "gift-outline";
          else if (route.name === "메뉴")
            iconName = focused ? "apps" : "apps-outline";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#FF6B35",
        tabBarInactiveTintColor: "#555",
        tabBarLabelStyle: {
          fontSize: 12,
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
        name="게시판"
        component={BoardStack}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            navigation.navigate("게시판", {
              screen: "게시판메인",
              params: { type: "board", resetSearch: Date.now() },
            });
          },
        })}
      />
      <Tab.Screen
        name="나눔"
        component={DanggnStack}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            navigation.navigate("나눔", {
              screen: "씬짜오나눔메인",
            });
          },
        })}
      />
      <Tab.Screen name="메뉴" component={MenuStack} />
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
