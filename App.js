import React, { useEffect } from "react";
import { StyleSheet, SafeAreaView, View, Text } from "react-native";
import { WebView } from "react-native-webview";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";

// 여기에 운영 중인 워드프레스 사이트의 URL 4개를 입력하세요.
const siteURLs = {
  site1: "https://chaoVietNam.co.kr/", // 매거진
  site2: "https://vnkorlife.com/", // 씬짜오 당근
  site3: "https://vnkorlife.com/?directory_type=jobs", // 구인구직
  site4: "https://vnkorlife.com/?directory_type=real-estate", // 부동산
};

// 각 탭에서 웹사이트를 보여주는 컴포넌트
const SiteWebView = ({ url }) => {
  return (
    <SafeAreaView style={styles.container}>
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        startInLoadingState={true}
        renderLoading={() => (
          <Text style={styles.loadingText}>사이트를 불러오는 중...</Text>
        )}
      />
    </SafeAreaView>
  );
};

const Tab = createBottomTabNavigator();

export default function App() {
  // 푸시 알림 권한을 요청하고 토큰을 가져오는 함수
  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  async function registerForPushNotificationsAsync() {
    let token;

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
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

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === "매거진") {
              iconName = focused ? "book" : "book-outline";
            } else if (route.name === "커뮤니티 라운지") {
              iconName = focused ? "chatbubbles" : "chatbubbles-outline";
            } else if (route.name === "구인구직") {
              iconName = focused ? "briefcase" : "briefcase-outline";
            } else if (route.name === "부동산") {
              iconName = focused ? "business" : "business-outline";
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="매거진" options={{ title: "뉴스" }}>
          {() => <SiteWebView url={siteURLs.site1} />}
        </Tab.Screen>
        <Tab.Screen name="커뮤니티 라운지" options={{ title: "커뮤니티" }}>
          {() => <SiteWebView url={siteURLs.site2} />}
        </Tab.Screen>
        <Tab.Screen name="구인구직" options={{ title: "구인" }}>
          {() => <SiteWebView url={siteURLs.site3} />}
        </Tab.Screen>
        <Tab.Screen name="부동산" options={{ title: "부동산" }}>
          {() => <SiteWebView url={siteURLs.site4} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
  },
});
