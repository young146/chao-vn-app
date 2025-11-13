import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";

export default function MoreScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  // ✅ 관리자 확인
  useEffect(() => {
    if (user && user.email) {
      const adminEmails = ["info@chaovietnam.co.kr", "younghan146@gmail.com"];
      setIsAdmin(adminEmails.includes(user.email));
    }
  }, [user]);

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
          <Ionicons name="person-circle" size={60} color="#FF6B35" />
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

      {/* 앱 정보 */}
      <View style={styles.appInfo}>
        <Text style={styles.appInfoText}>씬짜오당근 v1.0.0</Text>
        <Text style={styles.appInfoText}>베트남 한인 중고거래</Text>
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
