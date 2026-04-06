import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, changeLanguage } from "../i18n";
import { useAuth } from "../contexts/AuthContext";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
// RNRestart는 Expo Updates 루프 문제로 제거 (Updates.reloadAsync() 사용)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";

export default function MoreScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation('menu');
  const [isAdmin, setIsAdmin] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
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

  // ✅ 관리자 확인
  useEffect(() => {
    if (user && user.email) {
      const adminEmails = ["info@chaovietnam.co.kr", "younghan146@gmail.com"];
      setIsAdmin(adminEmails.includes(user.email));
    }
  }, [user]);

  // ✅ 업데이트 정보 확인
  const checkUpdateInfo = async () => {
    try {
      setCheckingUpdate(true);
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        const manifest = await Updates.fetchUpdateAsync();
        setUpdateInfo({
          isAvailable: true,
          manifest: manifest.manifest,
          message: t('newUpdateMessage'),
        });
        Alert.alert(
          t('newUpdateTitle'),
          t('newUpdateMessage'),
          [
            { text: t('common:later'), style: "cancel" },
            {
              text: t('restartNow'),
              onPress: async () => {
                try {
                  await AsyncStorage.setItem('OTA_SKIP_CHECK', '1');
                  await Updates.reloadAsync();
                } catch (e) {
                  console.log("수동 업데이트 적용 실패:", e);
                }
              },
            },
          ]
        );
      } else {
        // OTA 없음: 현재 runtimeVersion 확인
        const currentRuntimeVersion = Updates.runtimeVersion; // 설치된 바이너리 버전
        const latestVersion = Constants.expoConfig?.version || '2.2.6';

        if (currentRuntimeVersion && currentRuntimeVersion !== latestVersion) {
          // 구버전 바이너리 → 앱스토어 업데이트 필요
          const storeUrl = Platform.OS === 'ios'
            ? 'https://apps.apple.com/app/id6754750793'
            : 'https://play.google.com/store/apps/details?id=com.yourname.chaovnapp';

          setUpdateInfo({
            isAvailable: false,
            message: `앱스토어에서 최신 버전(${latestVersion})으로 업데이트가 필요합니다.`,
          });
          Alert.alert(
            '앱 업데이트 필요',
            `현재 버전: ${currentRuntimeVersion}\n최신 버전: ${latestVersion}\n\n앱스토어에서 최신 버전으로 업데이트해 주세요.`,
            [
              { text: '나중에', style: 'cancel' },
              {
                text: Platform.OS === 'ios' ? 'App Store 바로가기' : 'Google Play 바로가기',
                onPress: () => Linking.openURL(storeUrl).catch(() =>
                  Alert.alert('오류', '스토어를 열 수 없습니다. 직접 검색해주세요.')
                ),
              },
            ]
          );
        } else {
          setUpdateInfo({
            isAvailable: false,
            message: t('latestVersion'),
          });
          Alert.alert(t('newUpdateTitle'), t('latestVersion'));
        }
      }
    } catch (error) {
      console.error("업데이트 확인 실패:", error);
      Alert.alert(t('common:error'), t('common:error'));
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('logout'), t('logoutConfirm'), [
      { text: t('common:cancel'), style: "cancel" },
      {
        text: t('logout'),
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
            Alert.alert(t('common:confirm'), t('logoutSuccess'));
          } catch (error) {
            console.error("로그아웃 실패:", error);
            Alert.alert(t('common:error'), t('common:error'));
          }
        },
      },
    ]);
  };

  const menuItems = [
    {
      id: "chat",
      title: t('chat'),
      icon: "chatbubble-ellipses",
      screen: "내 채팅",
      color: "#4CAF50",
      requiresAuth: true,
    },
    {
      id: "mypage",
      title: t('myPage'),
      icon: "person-circle",
      screen: "My Page",
      color: "#FF6B35",
      requiresAuth: true,
    },
    {
      id: "notifications",
      title: t('notifications'),
      icon: "notifications",
      screen: "알림",
      color: "#2196F3",
      requiresAuth: true,
    },
  ];

  const handleMenuPress = (item) => {
    if (item.requiresAuth && !user) {
      Alert.alert(t('loginRequired'), t('loginRequiredMessage'), [
        { text: t('common:cancel'), style: "cancel" },
        {
          text: t('common:login'),
          onPress: () => navigation.navigate("로그인"),
        },
      ]);
      return;
    }
    navigation.navigate(item.screen);
  };

  return (
    <ScrollView style={styles.container}>
      {/* 사용자 정보 - 누르면 프로필로 이동 */}
      <TouchableOpacity
        style={styles.userSection}
        onPress={() => user ? navigation.navigate("My Page") : navigation.navigate("로그인")}
        activeOpacity={0.7}
      >
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
              {displayName || (user.email ? user.email.split("@")[0] : "사용자")}
            </Text>
            <Text style={styles.userEmail}>{displayEmail || user.email}</Text>
            <Text style={styles.profileHint}>프로필 보기 · 수정 · 탈퇴 →</Text>
          </>
        ) : (
          <>
            <Text style={styles.userName}>{t('loginRequired')}</Text>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => navigation.navigate("로그인")}
            >
              <Text style={styles.loginButtonText}>{t('loginButton')}</Text>
            </TouchableOpacity>
          </>
        )}
      </TouchableOpacity>

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

      {/* ✅ 관리자 메뉴 (번역 불필요 - 관리자 전용) */}
      {isAdmin && (
        <View style={styles.adminSection}>
          <Text style={styles.sectionTitle}>👑 {t('adminMenu')}</Text>

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
              <Text style={styles.menuTitle}>{t('userManagement')}</Text>
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
              <Text style={styles.menuTitle}>{t('newItemManagement')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>
      )}

      {/* 로그아웃 버튼 */}
      {user && (
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#dc3545" />
          <Text style={styles.logoutButtonText}>{t('logout')}</Text>
        </TouchableOpacity>
      )}

      {/* 언어 설정 */}
      <View style={styles.languageSection}>
        <Text style={styles.languageSectionTitle}>{t('languageSettings')}</Text>
        <View style={styles.languageButtons}>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageButton,
                i18n.language === lang.code && styles.languageButtonActive,
              ]}
              onPress={() => changeLanguage(lang.code)}
            >
              <Text style={styles.languageFlag}>{lang.flag}</Text>
              <Text
                style={[
                  styles.languageText,
                  i18n.language === lang.code && styles.languageTextActive,
                ]}
              >
                {lang.nativeName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

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
            {checkingUpdate ? t('checking') : t('updateCheck')}
          </Text>
        </TouchableOpacity>
        {updateInfo && (
          <Text style={styles.updateInfoText}>{updateInfo.message}</Text>
        )}
      </View>

      {/* 앱 정보 */}
      <View style={styles.appInfo}>
        <Text style={styles.appInfoText}>{t('appVersion', { version: Constants.expoConfig?.version || '2.2.5' })}</Text>
        {__DEV__ ? (
          <Text style={[styles.appInfoText, { color: "#FF6B35" }]}>
            {t('devMode')}
          </Text>
        ) : (
          <Text style={[styles.appInfoText, { color: "#4CAF50" }]}>
            {t('prodMode')}
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
  profileHint: {
    fontSize: 12,
    color: "#FF6B35",
    marginTop: 6,
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
  languageSection: {
    backgroundColor: "#fff",
    marginTop: 12,
    padding: 16,
  },
  languageSectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  languageButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  languageButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    borderWidth: 2,
    borderColor: "transparent",
  },
  languageButtonActive: {
    backgroundColor: "#FFF4E6",
    borderColor: "#FF6B35",
  },
  languageFlag: {
    fontSize: 20,
    marginRight: 6,
  },
  languageText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  languageTextActive: {
    color: "#FF6B35",
    fontWeight: "bold",
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
