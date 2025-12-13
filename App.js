import { LogBox } from "react-native";
LogBox.ignoreAllLogs(true);
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

import AsyncStorage from "@react-native-async-storage/async-storage";
import { db, auth } from "./firebase/config";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import Constants from "expo-constants";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, // ← 추가!
    shouldShowBanner: true, // iOS용
    shouldShowList: true, // iOS용
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// AuthContext
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// 인증 화면
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import FindIdScreen from "./screens/FindIdScreen";
import FindPasswordScreen from "./screens/FindPasswordScreen";

// 네이티브 화면들
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


// 씬짜오당근 화면들
import XinChaoDanggnScreen from "./screens/XinChaoDanggnScreen";
import AddItemScreen from "./screens/AddItemScreen";
import ItemDetailScreen from "./screens/ItemDetailScreen";
import AdminScreen from "./screens/AdminScreen";

// ------------------------------------------------------------------
// ** 1. URL 구조 **
// ------------------------------------------------------------------
const siteURLs = {
  magazine: "https://chaovietnam.co.kr/",
  board: "https://vnkorlife.com/xinchao-board/",
};

// ------------------------------------------------------------------
// ** 2. 자동 로그인 토큰 생성 (현재 사용 안 함 - 웹사이트와 당근 메뉴 로그인 분리) **
// ------------------------------------------------------------------
// 웹사이트는 자체 로그인 시스템 사용, 당근 메뉴는 Firebase Authentication 사용
// 필요시 주석 해제하여 사용 가능
/*
const generateAutoLoginToken = (email) => {
  const secret = "chaovietnam_firebase_2025"; // WordPress 플러그인과 동일
  const timestamp = Math.floor(Date.now() / (3600 * 1000)); // 1시간 단위

  // 간단한 해시 생성
  const text = email + secret + timestamp;
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  // SHA256 흉내 (더 강력한 해시)
  const hashStr = Math.abs(hash).toString(16);
  const extendedHash = hashStr + text.length.toString(16);

  return extendedHash.padStart(64, "0").substring(0, 64);
};
*/

// ------------------------------------------------------------------
// ** 3. WebView 컴포넌트 **
// ------------------------------------------------------------------
const SiteWebView = ({ url }) => {
  const webViewRef = React.useRef(null);
  const [canGoBack, setCanGoBack] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);
  const [currentUrl, setCurrentUrl] = React.useState(url);
  const [currentTitle, setCurrentTitle] = React.useState("");
  const { user } = useAuth(); // 북마크 기능을 위해만 사용

  // 웹사이트는 자체 로그인 시스템 사용, 당근 메뉴는 Firebase Authentication 사용

  const onNavigationStateChange = (navState) => {
    setCanGoBack(navState.canGoBack);
    setIsLoading(navState.loading);

    if (navState.url) {
      setCurrentUrl(navState.url);
    }
    // 항상 제목 업데이트 (제목이 없으면 URL을 fallback으로 사용)
    setCurrentTitle(navState.title || navState.url);

    // 페이지가 다시 로딩되면 에러 상태는 해제
    setHasError(false);
  };

  const handleBack = () => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
    }
  };

  const handleRefresh = () => {
    // 에러 상태/로딩 상태 초기화 후 새로고침
    setHasError(false);
    setIsLoading(true);

    if (webViewRef.current) {
      webViewRef.current.reload();
    }
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
            ref={webViewRef}
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
            originWhitelist={['https://*', 'http://*']}
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
// ------------------------------------------------------------------
// ** 4. Bottom Tab Navigator **
// ------------------------------------------------------------------
const Tab = createBottomTabNavigator();

// 채팅 스택
function ChatStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ title: "채팅 목록" }}
      />
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={{ title: "채팅방" }}
      />
    </Stack.Navigator>
  );
}

function BottomTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName={Platform.OS === "ios" ? "씬짜오당근" : "매거진"}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "매거진") {
            iconName = focused ? "book" : "book-outline";
          } else if (route.name === "게시판") {
            iconName = focused ? "chatbubbles" : "chatbubbles-outline";
          } else if (route.name === "씬짜오당근") {
            iconName = focused ? "cart" : "cart-outline";
          } else if (route.name === "Menu") { // Changed from "메뉴" to "Menu"
            iconName = focused ? "menu" : "menu-outline";
          }
          // Chat tab icon is handled directly in Tab.Screen

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#FF6B35",
        tabBarInactiveTintColor: "#999",
        tabBarLabelStyle: { fontSize: 11 },
      })}
    >
      {Platform.OS !== "ios" && (
        <>
          <Tab.Screen name="매거진" options={{ title: "매거진" }}>
            {() => <SiteWebView url={siteURLs.magazine} />}
          </Tab.Screen>
          <Tab.Screen name="게시판" options={{ title: "게시판" }}>
            {() => <SiteWebView url={siteURLs.board} />}
          </Tab.Screen>
        </>
      )}
      <Tab.Screen
        name="씬짜오당근"
        component={DanggnStack}
        options={{ title: "당근" }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatStack}
        options={{
          title: "채팅",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbox-ellipses-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Menu" // Changed from "메뉴" to "Menu"
        component={MenuStack} // Changed from MoreStack to MenuStack
        options={{ title: "메뉴" }}
      />
    </Tab.Navigator>
  );
}

// ------------------------------------------------------------------
// ** 5. 씬짜오당근 Stack Navigator **
// ------------------------------------------------------------------
const Stack = createNativeStackNavigator();

// 헤더 우측 버튼 컴포넌트
function DanggnHeaderRight({ navigation }) {
  const { user } = useAuth();

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}
    >
      {user ? (
        <TouchableOpacity
          style={{ padding: 8 }}
          onPress={() => navigation.navigate("메뉴")}
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
// ------------------------------------------------------------------
// ** 6. 더보기 Stack Navigator **
// ------------------------------------------------------------------
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
// ------------------------------------------------------------------
// ** 7. Auth Stack Navigator **
// ------------------------------------------------------------------
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="로그인" component={LoginScreen} />
      <Stack.Screen name="회원가입" component={SignupScreen} />
      <Stack.Screen name="아이디찾기" component={FindIdScreen} />
      <Stack.Screen name="비밀번호찾기" component={FindPasswordScreen} />
    </Stack.Navigator>
  );
}

// ------------------------------------------------------------------
// ** 8. 메인 Navigator **
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// ** 8. 메인 Navigator **
// ------------------------------------------------------------------
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
      <Stack.Screen
        name="아이디찾기"
        component={FindIdScreen}
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="비밀번호찾기"
        component={FindPasswordScreen}
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
    </Stack.Navigator>
  );
}
// ------------------------------------------------------------------
// ** 9. 전역 채팅 알림 리스너 **
// ------------------------------------------------------------------
const GlobalChatNotificationListener = () => {
  useEffect(() => {
    let unsubscribeChatListener = null;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      // 이전 리스너가 있다면 정리
      if (unsubscribeChatListener) {
        unsubscribeChatListener();
        unsubscribeChatListener = null;
      }

      if (user) {
        console.log("🔔 전역 채팅 알림 리스너 시작:", user.uid);
        unsubscribeChatListener = listenToAllChatRooms(user.uid);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeChatListener) {
        unsubscribeChatListener();
      }
    };
  }, []);

  const listenToAllChatRooms = (userId) => {
    const chatRoomsRef = collection(db, "chatRooms");
    const q = query(
      chatRoomsRef,
      where("participants", "array-contains", userId)
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      // 로컬 변경사항(내가 쓴 글)은 무시
      if (snapshot.metadata.hasPendingWrites) {
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const chatData = change.doc.data();

          // 1. 보낸 사람이 내가 아닐 때
          // 2. 메시지가 존재할 때
          if (
            chatData.lastMessageSenderId &&
            chatData.lastMessageSenderId !== userId
          ) {
            const isSeller = userId === chatData.sellerId;
            const hasUnread = isSeller
              ? !chatData.sellerRead
              : !chatData.buyerRead;

            if (hasUnread) {
              console.log("🔔 새 메시지 감지!", chatData.lastMessage);
              playGlobalNotification(chatData.lastMessage, chatData.itemTitle);
            }
          }
        }
      });
    });

    return unsubscribe;
  };

  const playGlobalNotification = async (messageText, itemTitle) => {
    try {
      const notificationEnabled = await AsyncStorage.getItem(
        "chatNotificationEnabled"
      );
      if (notificationEnabled === "false") {
        console.log("🔇 알림 OFF 상태");
        return;
      }

      // ✅ 기본 시스템 알림음 + 채팅 전용 채널 사용
      await Notifications.scheduleNotificationAsync({
        content: {
          title: itemTitle || "새 메시지",
          body: messageText,
          sound: "default", // 🔊 true 대신 "default" 로 명시
          data: { screen: "ChatRoom" },
        },
        trigger:
          Platform.OS === "android"
            ? { seconds: 1, channelId: "chat_default_v2" } // 👈 아래 App에서 만든 채널과 이름 일치
            : { seconds: 1 },
      });

      console.log("🔔 전역 알림 재생 완료!");
    } catch (error) {
      console.log("전역 알림 실패:", error);
    }
  };

  return null;
};

// ------------------------------------------------------------------
// ** 9-1. 푸시 토큰 등록 (Expo Push Token → Firestore 저장) **
// ------------------------------------------------------------------
const registerPushToken = async (user) => {
  if (!user?.uid) return;

  try {
    // 1) 권한 확인/요청
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.log("🔇 푸시 권한 거부됨");
      return;
    }

    // 2) Expo Push Token 발급
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      Constants?.expoConfig?.projectId;
    if (!projectId) {
      console.log("⚠️ projectId 없음. app.json > extra.eas.projectId 확인 필요");
      return;
    }

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    if (!expoPushToken) {
      console.log("⚠️ Expo Push Token 발급 실패");
      return;
    }
    console.log("✅ Expo Push Token:", expoPushToken);

    // 3) Firestore users/{uid}에 저장
    await setDoc(
      doc(db, "users", user.uid),
      {
        pushToken: expoPushToken,
        pushTokenUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.log("❌ 푸시 토큰 등록 실패:", error);
  }
};

// ------------------------------------------------------------------
// ** 10. App 컴포넌트 **
// ------------------------------------------------------------------
export default function App() {
  // 로그인 시 푸시 토큰 등록
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        registerPushToken(user);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (Platform.OS === "android") {
      // ✅ 기본 알림 채널 (내 주변상품, 가격변동, 리뷰, 뉴스 등)
      Notifications.setNotificationChannelAsync("default", {
        name: "기본 알림",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B35",
      });

      // ✅ 채팅 알림 전용 채널 (소리 + 높은 우선순위)
      Notifications.setNotificationChannelAsync("chat_default_v2", {
        name: "채팅 알림",
        importance: Notifications.AndroidImportance.MAX, // 채팅은 가장 강하게
        sound: "default", // 🔊 여기서도 "default"
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B35",
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC, // 잠금화면 알림 표시
      });
    }
  }, []);

  return (
    <AuthProvider>
      <GlobalChatNotificationListener />
      <NavigationContainer>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

// ------------------------------------------------------------------
// ** 11. Styles **
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
