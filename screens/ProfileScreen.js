import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  query,
  where,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";

export default function ProfileScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    bookmarks: 0,
    comments: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const bookmarksQuery = query(
        collection(db, "bookmarks"),
        where("userId", "==", user?.uid)
      );
      const commentsQuery = query(
        collection(db, "comments"),
        where("userId", "==", user?.uid)
      );

      const [bookmarksSnapshot, commentsSnapshot] = await Promise.all([
        getCountFromServer(bookmarksQuery),
        getCountFromServer(commentsQuery),
      ]);

      setStats({
        bookmarks: bookmarksSnapshot.data().count,
        comments: commentsSnapshot.data().count,
      });
    } catch (error) {
      console.error("통계 로드 실패:", error);
    }
  };

  const handleAppSettings = () => {
    Alert.alert("앱 설정", "언어: 한국어\n알림: 켜짐\n테마: 라이트 모드", [
      { text: "확인" },
    ]);
  };

  const handleAppInfo = () => {
    Alert.alert(
      "앱 정보",
      "씬짜오 베트남 뉴스\n버전: 1.0.0\n개발자: Chao Vietnam Team\n\n한국 내 베트남 커뮤니티를 위한 뉴스 앱입니다.",
      [
        { text: "확인" },
        {
          text: "웹사이트 방문",
          onPress: () => Linking.openURL("https://chaovietnam.co.kr"),
        },
      ]
    );
  };

  const handleHelp = () => {
    Alert.alert(
      "도움말",
      "📖 북마크: 기사를 저장하여 나중에 읽을 수 있습니다\n\n💬 댓글: 기사에 댓글을 남기고 다른 사용자와 소통하세요\n\n🔔 알림: 관심있는 카테고리의 새 기사 알림을 받으세요\n\n문의사항이 있으시면 이메일로 연락주세요:\ninfo@chaovietnam.co.kr",
      [
        { text: "확인" },
        {
          text: "이메일 보내기",
          onPress: () => Linking.openURL("mailto:info@chaovietnam.co.kr"),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color="#fff" />
        </View>
        <Text style={styles.username}>
          {user?.email?.split("@")[0] || "User"}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.bookmarks}</Text>
          <Text style={styles.statLabel}>북마크</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.comments}</Text>
          <Text style={styles.statLabel}>댓글</Text>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem} onPress={handleAppSettings}>
          <Ionicons name="settings-outline" size={24} color="#333" />
          <Text style={styles.menuText}>앱 설정</Text>
          <Ionicons name="chevron-forward" size={20} color="#C6C6C8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleAppInfo}>
          <Ionicons name="information-circle-outline" size={24} color="#333" />
          <Text style={styles.menuText}>앱 정보</Text>
          <Ionicons name="chevron-forward" size={20} color="#C6C6C8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleHelp}>
          <Ionicons name="help-circle-outline" size={24} color="#333" />
          <Text style={styles.menuText}>도움말</Text>
          <Ionicons name="chevron-forward" size={20} color="#C6C6C8" />
        </TouchableOpacity>
      </View>

      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>버전 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  profileHeader: {
    backgroundColor: "#fff",
    alignItems: "center",
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  username: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: "#666",
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginTop: 12,
    paddingVertical: 20,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FF6B35",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
  },
  divider: {
    width: 1,
    backgroundColor: "#e0e0e0",
  },
  section: {
    backgroundColor: "#fff",
    marginTop: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C6C6C8",
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    marginLeft: 12,
  },
  versionContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 12,
    color: "#999",
  },
});
