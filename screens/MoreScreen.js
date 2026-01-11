import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import * as Updates from "expo-updates";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";

export default function MoreScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [profileImage, setProfileImage] = useState(null);

  useEffect(() => {
    const loadProfileImage = async () => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setProfileImage(userDoc.data().profileImage);
          }
        } catch (error) {
          console.error("프로필 이미지 로드 실패:", error);
        }
      }
    };
    loadProfileImage();
  }, [user]);

  // ✅ 관리자 확인
  useEffect(() => {
    if (user && user.email) {
      const adminEmails = ["info@chaovietnam.co.kr", "younghan146@gmail.com"];
      setIsAdmin(adminEmails.includes(user.email));
    }
  }, [user]);

  // ✅ 업데이트 정보 확인 (개선된 에러 핸들링)
  const checkUpdateInfo = async () => {
    // 개발 모드에서는 업데이트 체크 불가
    if (__DEV__) {
      Alert.alert("알림", "개발 모드에서는 업데이트 확인이 불가능합니다.");
      return;
    }

    // Updates가 활성화되지 않은 경우
    if (!Updates.isEnabled) {
      Alert.alert("알림", "이 빌드에서는 OTA 업데이트가 비활성화되어 있습니다.");
      return;
    }

    try {
      setCheckingUpdate(true);
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        try {
          const manifest = await Updates.fetchUpdateAsync();
          setUpdateInfo({
            isAvailable: true,
            manifest: manifest.manifest,
            message: "새 업데이트가 있습니다! 앱을 재시작하면 적용됩니다.",
          });
          Alert.alert(
            "업데이트 확인",
            "새 업데이트가 있습니다.\n앱을 재시작하면 적용됩니다.",
            [
              { text: "나중에", style: "cancel" },
              {
                text: "지금 재시작",
                onPress: async () => {
                  try {
                    await Updates.reloadAsync();
                  } catch (reloadError) {
                    console.error("앱 재시작 실패:", reloadError);
                    Alert.alert(
                      "재시작 실패",
                      "앱 재시작에 실패했습니다. 앱을 수동으로 종료 후 다시 시작해주세요."
                    );
                  }
                },
              },
            ]
          );
        } catch (fetchError) {
          console.error("업데이트 다운로드 실패:", fetchError);
          Alert.alert(
            "다운로드 실패",
            "업데이트 다운로드에 실패했습니다.\n네트워크 연결을 확인해주세요."
          );
        }
      } else {
        setUpdateInfo({
          isAvailable: false,
          message: "최신 버전입니다.",
        });
        Alert.alert("업데이트 확인", "최신 버전입니다.");
      }
    } catch (error) {
      console.error("업데이트 확인 실패:", error);
      // 에러 메시지를 더 구체적으로 표시
      const errorMessage = error.message?.includes("fingerprint") 
        ? "앱 버전이 일치하지 않습니다.\n앱 스토어에서 최신 버전을 다운로드해주세요."
        : "업데이트 확인에 실패했습니다.\n네트워크 연결을 확인해주세요.";
      Alert.alert("오류", errorMessage);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("로그아웃", "정말 로그아웃하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
            Alert.alert("완료", "로그아웃되었습니다.");
          } catch (error) {
            console.error("로그아웃 실패:", error);
            Alert.alert("오류", "로그아웃에 실패했습니다.");
          }
        },
      },
    ]);
  };

  const menuItems = [
    {
      id: "chat",
      title: "채팅",
      icon: "chatbubble-ellipses",
      screen: "내 채팅",
      color: "#4CAF50",
      requiresAuth: true,
    },
    {
      id: "mypage",
      title: "마이페이지",
      icon: "person-circle",
      screen: "My Page",
      color: "#FF6B35",
      requiresAuth: true,
    },
    {
      id: "notifications",
      title: "알림",
      icon: "notifications",
      screen: "알림",
      color: "#2196F3",
      requiresAuth: true,
    },
  ];

  const handleMenuPress = (item) => {
    if (item.requiresAuth && !user) {
      Alert.alert("로그인 필요", "이 기능을 사용하려면 로그인이 필요합니다.", [
        { text: "취소", style: "cancel" },
        {
          text: "로그인",
          onPress: () => navigation.navigate("로그인"),
        },
      ]);
      return;
    }
    navigation.navigate(item.screen);
  };

  return (
    <ScrollView style={styles.container}>
      {/* 사용자 정보 */}
      <View style={styles.userSection}>
        <View style={styles.avatarContainer}>
          {profileImage ? (
            <Image
              source={{ uri: profileImage }}
              style={styles.avatarImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <Ionicons name="person-circle" size={60} color="#FF6B35" />
          )}
        </View>
        {user ? (
          <>
            <Text style={styles.userName}>
              {user.email ? user.email.split("@")[0] : "사용자"}
            </Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </>
        ) : (
          <>
            <Text style={styles.userName}>로그인이 필요합니다</Text>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => navigation.navigate("로그인")}
            >
              <Text style={styles.loginButtonText}>로그인하기</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* 메뉴 리스트 */}
      <View style={styles.menuSection}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItem}
            onPress={() => handleMenuPress(item)}
          >
            <View style={styles.menuLeft}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: item.color + "20" },
                ]}
              >
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <Text style={styles.menuTitle}>{item.title}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        ))}
      </View>

      {/* ✅ 관리자 메뉴 */}
      {isAdmin && (
        <View style={styles.adminSection}>
          <Text style={styles.sectionTitle}>👑 관리자 메뉴</Text>

          <TouchableOpacity
            style={styles.adminMenuItem}
            onPress={() => navigation.navigate("회원관리")}
          >
            <View style={styles.menuLeft}>
              <View
                style={[styles.iconContainer, { backgroundColor: "#dc354520" }]}
              >
                <Ionicons name="people" size={24} color="#dc3545" />
              </View>
              <Text style={styles.menuTitle}>회원관리</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.adminMenuItem}
            onPress={() => navigation.navigate("관리자 페이지")}
          >
            <View style={styles.menuLeft}>
              <View
                style={[styles.iconContainer, { backgroundColor: "#dc354520" }]}
              >
                <Ionicons name="shield-checkmark" size={24} color="#dc3545" />
              </View>
              <Text style={styles.menuTitle}>신규 물품 관리</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>
      )}

      {/* 로그아웃 버튼 */}
      {user && (
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#dc3545" />
          <Text style={styles.logoutButtonText}>로그아웃</Text>
        </TouchableOpacity>
      )}

      {/* 업데이트 확인 버튼 */}
      <View style={styles.updateSection}>
        <TouchableOpacity
          style={styles.updateButton}
          onPress={checkUpdateInfo}
          disabled={checkingUpdate}
        >
          {checkingUpdate ? (
            <ActivityIndicator size="small" color="#FF6B35" />
          ) : (
            <Ionicons name="refresh" size={20} color="#FF6B35" />
          )}
          <Text style={styles.updateButtonText}>
            {checkingUpdate ? "확인 중..." : "업데이트 확인"}
          </Text>
        </TouchableOpacity>
        {updateInfo && (
          <Text style={styles.updateInfoText}>{updateInfo.message}</Text>
        )}
      </View>

      {/* 앱 정보 */}
      <View style={styles.appInfo}>
        <Text style={styles.appInfoText}>씬짜오나눔 v2.2.0</Text>
        <Text style={styles.appInfoText}>베트남 한인 중고거래</Text>
        {__DEV__ ? (
          <Text style={[styles.appInfoText, { color: "#FF6B35" }]}>
            개발 모드
          </Text>
        ) : (
          <Text style={[styles.appInfoText, { color: "#4CAF50" }]}>
            프로덕션 모드
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  userSection: {
    backgroundColor: "#fff",
    padding: 20,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  userName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#666",
  },
  loginButton: {
    marginTop: 12,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  menuSection: {
    backgroundColor: "#fff",
    marginTop: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuTitle: {
    fontSize: 16,
    color: "#333",
  },
  adminSection: {
    backgroundColor: "#fff",
    marginTop: 12,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#dc3545",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  adminMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    marginTop: 12,
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e0e0e0",
  },
  logoutButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: "#dc3545",
    fontWeight: "600",
  },
  updateSection: {
    backgroundColor: "#fff",
    marginTop: 12,
    padding: 16,
  },
  updateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF4E6",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  updateButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#FF6B35",
    fontWeight: "600",
  },
  updateInfoText: {
    marginTop: 8,
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  appInfo: {
    alignItems: "center",
    paddingVertical: 20,
  },
  appInfoText: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
});
