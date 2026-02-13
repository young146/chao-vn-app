import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";

export default function MyPageScreen({ navigation }) {
  const { user } = useAuth();
  const { t } = useTranslation('menu');
  const [profileImage, setProfileImage] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [displayEmail, setDisplayEmail] = useState(null);

  useEffect(() => {
    const loadUserProfile = async () => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setProfileImage(data.profileImage || null);
            setDisplayName(data.displayName || data.name || null);
            setDisplayEmail(data.email || user.email || null);
          }
        } catch (error) {
          console.error("프로필 로드 실패:", error);
        }
      } else {
        setProfileImage(null);
        setDisplayName(null);
        setDisplayEmail(null);
      }
    };
    loadUserProfile();
  }, [user?.uid]);

  const myPageItems = [
    {
      id: "favorites",
      title: t('favorites'),
      icon: "heart",
      screen: "찜한 물품",
      color: "#E91E63",
    },
    {
      id: "bookmarks",
      title: t('bookmarks'),
      icon: "bookmark",
      screen: "북마크",
      color: "#4CAF50",
    },
    {
      id: "comments",
      title: t('myReviews'),
      icon: "chatbox",
      screen: "내 후기",
      color: "#2196F3",
    },
    {
      id: "profile",
      title: t('profile'),
      icon: "person",
      screen: "프로필",
      color: "#FF9800",
    },
    {
      id: "myitems",
      title: t('myItems'),
      icon: "cube",
      screen: "내 물품",
      color: "#9C27B0",
    },
  ];

  const handleMenuPress = (item) => {
    navigation.navigate(item.screen);
  };

  return (
    <ScrollView style={styles.container}>
      {/* 사용자 정보 헤더 */}
      <View style={styles.userHeader}>
        <View style={styles.avatarContainer}>
          {profileImage ? (
            <Image
              source={{ uri: profileImage }}
              style={styles.avatarImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <Ionicons name="person-circle" size={80} color="#FF6B35" />
          )}
        </View>
        <Text style={styles.userName}>
          {displayName || (user?.email ? user.email.split("@")[0] : t('user'))}
        </Text>
        <Text style={styles.userEmail}>{displayEmail || user?.email || ""}</Text>
      </View>

      {/* My Page 메뉴 */}
      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>{t('myActivity')}</Text>
        {myPageItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItem}
            onPress={() => handleMenuPress(item)}
            disabled={item.badge === t('preparing')}
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
              <Text
                style={[
                  styles.menuTitle,
                  item.badge === t('preparing') && styles.disabledText,
                ]}
              >
                {item.title}
              </Text>
              {item.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={item.badge === t('preparing') ? "#ccc" : "#999"}
            />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  userHeader: {
    backgroundColor: "#fff",
    padding: 24,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#666",
  },
  menuSection: {
    backgroundColor: "#fff",
    marginTop: 12,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: "uppercase",
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
    flex: 1,
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
  disabledText: {
    color: "#999",
  },
  badge: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    color: "#666",
  },
});
