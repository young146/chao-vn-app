import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { WebView } from "react-native-webview";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";

// AuthContext
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// 인증 화면
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";

// 네이티브 화면들
import MoreScreen from "./screens/MoreScreen";
import BookmarksScreen from "./screens/BookmarksScreen";
import MyCommentsScreen from "./screens/MyCommentsScreen";
import NotificationSettingsScreen from "./screens/NotificationSettingsScreen";
import ProfileScreen from "./screens/ProfileScreen";

// 씬짜오당근 화면들
import XinChaoDanggnScreen from "./screens/XinChaoDanggnScreen";
import AddItemScreen from "./screens/AddItemScreen";
import ItemDetailScreen from "./screens/ItemDetailScreen";

// ------------------------------------------------------------------
// ** 1. URL 구조 **
// ------------------------------------------------------------------
const siteURLs = {
  site1: "https://chaovietnam.co.kr/",
  site3: "https://vnkorlife.com/?directory_type=jobs",
  site4: "https://vnkorlife.com/?directory_type=real-estate",
  site5: "https://vnkorlife.com/xinchao-board/",
};

// ------------------------------------------------------------------
// ** 2. 푸시 알림 로직 **
// ------------------------------------------------------------------
async function registerForPushNotificationsAsync() {
  let token;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.log("푸시 알림 권한이 거부되었습니다!");
    return;
  }
  token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log("푸시 알림 토큰:", token);
}

// ------------------------------------------------------------------
// ** 3. WebView 컴포넌트 **
// ------------------------------------------------------------------
const SiteWebView = ({ url }) => {
  const webviewRef = React.useRef(null);
  const [canGoBack, setCanGoBack] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);
  const [currentUrl, setCurrentUrl] = React.useState(url);
  const [currentTitle, setCurrentTitle] = React.useState("");
  const { user } = useAuth();

  const onNavigationStateChange = (navState) => {
    setCanGoBack(navState.canGoBack);
    setIsLoading(navState.loading);
    setCurrentUrl(navState.url);
    setCurrentTitle(navState.title || navState.url);
  };

  const handleBack = () => {
    if (canGoBack) {
      webviewRef.current.goBack();
    }
  };

  const handleRefresh = () => {
    setHasError(false);
    webviewRef.current.reload();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  const handleBookmark = async () => {
    try {
      const { addDoc, collection, serverTimestamp } = await import(
        "firebase/firestore"
      );
      const { db } = await import("./firebase/config");

      await addDoc(collection(db, "bookmarks"), {
        userId: user?.uid || "demo-user",
        url: currentUrl,
        title: currentTitle,
        savedAt: serverTimestamp(),
      });

      Alert.alert("✅ 북마크 저장", "북마크에 저장되었습니다!", [
        { text: "확인" },
      ]);
    } catch (error) {
      console.error("북마크 저장 실패:", error);
      Alert.alert("오류", "북마크 저장에 실패했습니다.");
    }
  };

  const statusBarHeight =
    Platform.OS === "android" ? StatusBar.currentHeight || 24 : 0;

  const injectedJavaScript = `
    (function() {
      const style = document.createElement('style');
      style.textContent = 'body{padding-bottom:70px!important}';
      document.head.appendChild(style);
      window.open = function(url){window.location.href=url;return window};
    })();
    true;
  `;

  return (
    <View style={styles.container}>
      <View style={[styles.statusBarBackground, { height: statusBarHeight }]} />

      {(canGoBack || isLoading) && (
        <View style={styles.header}>
          {canGoBack && (
            <TouchableOpacity onPress={handleBack} style={styles.navButton}>
              <Ionicons name="arrow-back" size={24} color="#333" />
              <Text style={styles.navButtonText}>이전</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={handleRefresh} style={styles.navButton}>
            <Ionicons name="refresh" size={24} color="#333" />
            <Text style={styles.navButtonText}>새로고침</Text>
          </TouchableOpacity>

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FF6B35" />
            </View>
          )}
        </View>
      )}

      {hasError ? (
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color="#999" />
          <Text style={styles.errorTitle}>페이지를 불러올 수 없습니다</Text>
          <Text style={styles.errorMessage}>
            인터넷 연결을 확인하거나{"\n"}잠시 후 다시 시도해주세요
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Ionicons name="reload" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <WebView
            ref={webviewRef}
            source={{ uri: url }}
            style={styles.webview}
            onNavigationStateChange={onNavigationStateChange}
            onError={handleError}
            onHttpError={handleError}
            userAgent="Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            cacheEnabled={true}
            injectedJavaScript={injectedJavaScript}
            setSupportMultipleWindows={false}
            androidHardwareAccelerationDisabled={false}
            androidLayerType="hardware"
          />

          <TouchableOpacity
            style={styles.floatingBookmarkButton}
            onPress={handleBookmark}
            activeOpacity={0.8}
          >
            <Ionicons name="bookmark" size={24} color="#fff" />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

// ------------------------------------------------------------------
// ** 4. Bottom Tab Navigator **
// ------------------------------------------------------------------
const Tab = createBottomTabNavigator();

function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "매거진") {
            iconName = focused ? "book" : "book-outline";
          } else if (route.name === "씬짜오당근") {
            iconName = focused ? "cart" : "cart-outline";
          } else if (route.name === "구인구직") {
            iconName = focused ? "briefcase" : "briefcase-outline";
          } else if (route.name === "부동산") {
            iconName = focused ? "business" : "business-outline";
          } else if (route.name === "게시판") {
            iconName = focused ? "chatbubbles" : "chatbubbles-outline";
          } else if (route.name === "더보기") {
            iconName = focused ? "menu" : "menu-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#FF6B35",
        tabBarInactiveTintColor: "#999",
        tabBarLabelStyle: { fontSize: 11 },
      })}
    >
      <Tab.Screen name="매거진" options={{ title: "매거진" }}>
        {() => <SiteWebView url={siteURLs.site1} />}
      </Tab.Screen>
      <Tab.Screen
        name="씬짜오당근"
        component={DanggnStack}
        options={{ title: "당근" }}
      />
      <Tab.Screen name="게시판" options={{ title: "게시판" }}>
        {() => <SiteWebView url={siteURLs.site5} />}
      </Tab.Screen>
      <Tab.Screen name="구인구직" options={{ title: "구인" }}>
        {() => <SiteWebView url={siteURLs.site3} />}
      </Tab.Screen>
      <Tab.Screen name="부동산" options={{ title: "부동산" }}>
        {() => <SiteWebView url={siteURLs.site4} />}
      </Tab.Screen>
      <Tab.Screen
        name="더보기"
        component={MoreStack}
        options={{ title: "더보기" }}
      />
    </Tab.Navigator>
  );
}

// ------------------------------------------------------------------
// ** 5. 씬짜오당근 Stack Navigator (수정됨!) **
// ------------------------------------------------------------------
const Stack = createNativeStackNavigator();

// 헤더 우측 버튼 컴포넌트
function DanggnHeaderRight({ navigation }) {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}
    >
      {/* 새로고침 버튼 */}
      <TouchableOpacity
        style={{ padding: 8 }}
        onPress={() => {
          setRefreshKey(Date.now());
          navigation.setParams({ refresh: Date.now() });
        }}
      >
        <Ionicons name="refresh-outline" size={24} color="#fff" />
      </TouchableOpacity>

      {/* 로그인 상태 표시 */}
      {user ? (
        <TouchableOpacity
          style={{ padding: 8 }}
          onPress={() => navigation.navigate("더보기")}
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

function DanggnStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="씬짜오당근메인"
        component={XinChaoDanggnScreen}
        options={({ navigation }) => ({
          title: "씬짜오당근",
          headerStyle: { backgroundColor: "#FF6B35" },
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
    </Stack.Navigator>
  );
}

// ------------------------------------------------------------------
// ** 6. 더보기 Stack Navigator **
// ------------------------------------------------------------------
function MoreStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="더보기메인"
        component={MoreScreen}
        options={{ headerShown: false }}
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
        name="내 댓글"
        component={MyCommentsScreen}
        options={{
          title: "내 댓글",
          headerStyle: { backgroundColor: "#FF6B35" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="알림 설정"
        component={NotificationSettingsScreen}
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
    </Stack.Navigator>
  );
}

// ------------------------------------------------------------------
// ** 7. Auth Stack Navigator **
// ------------------------------------------------------------------
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="로그인" component={LoginScreen} />
      <Stack.Screen name="회원가입" component={SignupScreen} />
    </Stack.Navigator>
  );
}

// ------------------------------------------------------------------
// ** 8. 메인 Navigator (항상 탭 먼저!) **
// ------------------------------------------------------------------
function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ presentation: "modal" }}>
      {/* 메인 앱 - 항상 첫 화면 */}
      <Stack.Screen
        name="MainApp"
        component={BottomTabNavigator}
        options={{ headerShown: false }}
      />
      {/* 로그인/회원가입 - 필요할 때만 모달로 */}
      <Stack.Screen
        name="로그인"
        component={LoginScreen}
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="회원가입"
        component={SignupScreen}
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
    </Stack.Navigator>
  );
}

// ------------------------------------------------------------------
// ** 9. App 컴포넌트 **
// ------------------------------------------------------------------
export default function App() {
  useEffect(() => {
    registerForPushNotificationsAsync();

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }, []);

  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

// ------------------------------------------------------------------
// ** 10. Styles **
// ------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  statusBarBackground: {
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  navButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: "#333",
  },
  loadingContainer: {
    marginLeft: "auto",
    paddingHorizontal: 12,
  },
  webview: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  floatingBookmarkButton: {
    position: "absolute",
    bottom: 80,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
});
