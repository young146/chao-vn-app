import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";

// 알림음 옵션
const NOTIFICATION_SOUNDS = [
  {
    id: "default",
    label: "기본 알림음",
    file: "default.wav",
    channel: "chat_default",
  },
  { id: "chime", label: "차임벨", file: "chime.wav", channel: "chat_chime" },
  { id: "bell", label: "종소리", file: "bell.wav", channel: "chat_bell" },
];

export default function NotificationSettingScreen() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    newArticles: true,
    comments: true,
    community: true,
    jobs: false,
    realEstate: false,
    chat: true, // 채팅 알림
    priceChange: true, // 가격 변동 알림
    review: true, // 리뷰 알림
    nearbyItems: false, // 🆕 내 주변 상품 알림
  });

  const [selectedSound, setSelectedSound] = useState("default");

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      // AsyncStorage에서 로드
      const saved = await AsyncStorage.getItem("notificationSettings");
      if (saved) {
        setSettings(JSON.parse(saved));
      }

      // Firebase에서 notificationSettings 로드 (있으면 덮어쓰기)
      if (user) {
        const docRef = doc(db, "notificationSettings", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const firebaseSettings = docSnap.data();
          setSettings((prev) => ({
            ...prev,
            nearbyItems: firebaseSettings.nearbyItems || false,
            chat:
              firebaseSettings.chat !== undefined
                ? firebaseSettings.chat
                : prev.chat,
            review:
              firebaseSettings.reviews !== undefined
                ? firebaseSettings.reviews
                : prev.review,
          }));
        }
      }

      // 알림음 설정 로드
      const soundData = await AsyncStorage.getItem("notification_sound");
      if (soundData) {
        const sound = JSON.parse(soundData);
        setSelectedSound(sound.id);
      }
    } catch (error) {
      console.error("설정 로드 실패:", error);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      // AsyncStorage에 저장
      await AsyncStorage.setItem(
        "notificationSettings",
        JSON.stringify(newSettings)
      );

      // Firebase notificationSettings 업데이트 (주변 상품 알림만)
      if (user) {
        const docRef = doc(db, "notificationSettings", user.uid);
        await setDoc(
          docRef,
          {
            nearbyItems: newSettings.nearbyItems,
            chat: newSettings.chat,
            reviews: newSettings.review,
          },
          { merge: true }
        );
      }
    } catch (error) {
      console.error("설정 저장 실패:", error);
    }
  };

  const toggleSetting = (key) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // 알림음 선택
  const handleSoundSelect = async (sound) => {
    try {
      setSelectedSound(sound.id);
      await AsyncStorage.setItem("notification_sound", JSON.stringify(sound));
      await playTestNotification(sound);
      Alert.alert("알림음 변경", `"${sound.label}"로 변경되었습니다`);
    } catch (error) {
      console.error("알림음 변경 실패:", error);
    }
  };

  // 테스트 알림 재생
  const playTestNotification = async (sound) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "알림음 미리듣기",
          body: `${sound.label} 소리입니다`,
          sound: sound.file,
        },
        trigger: {
          seconds: 1,
          channelId: sound.channel,
        },
      });
    } catch (error) {
      console.log("미리듣기 실패:", error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* 뉴스 관련 알림 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📰 뉴스 알림</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons
              name="newspaper"
              size={20}
              color="#FF6B35"
              style={styles.settingIcon}
            />
            <View>
              <Text style={styles.settingLabel}>새 기사 알림</Text>
              <Text style={styles.settingDescription}>
                새로운 기사가 올라오면 알림을 받습니다
              </Text>
            </View>
          </View>
          <Switch
            value={settings.newArticles}
            onValueChange={() => toggleSetting("newArticles")}
            trackColor={{ false: "#ccc", true: "#FF6B35" }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons
              name="chatbubbles"
              size={20}
              color="#4CAF50"
              style={styles.settingIcon}
            />
            <View>
              <Text style={styles.settingLabel}>댓글 알림</Text>
              <Text style={styles.settingDescription}>
                내 댓글에 답글이 달리면 알림을 받습니다
              </Text>
            </View>
          </View>
          <Switch
            value={settings.comments}
            onValueChange={() => toggleSetting("comments")}
            trackColor={{ false: "#ccc", true: "#FF6B35" }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons
              name="people"
              size={20}
              color="#9C27B0"
              style={styles.settingIcon}
            />
            <View>
              <Text style={styles.settingLabel}>커뮤니티 알림</Text>
              <Text style={styles.settingDescription}>커뮤니티 새 글 알림</Text>
            </View>
          </View>
          <Switch
            value={settings.community}
            onValueChange={() => toggleSetting("community")}
            trackColor={{ false: "#ccc", true: "#FF6B35" }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons
              name="briefcase"
              size={20}
              color="#2196F3"
              style={styles.settingIcon}
            />
            <View>
              <Text style={styles.settingLabel}>구인구직 알림</Text>
              <Text style={styles.settingDescription}>새 채용 공고 알림</Text>
            </View>
          </View>
          <Switch
            value={settings.jobs}
            onValueChange={() => toggleSetting("jobs")}
            trackColor={{ false: "#ccc", true: "#FF6B35" }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons
              name="home"
              size={20}
              color="#FF9800"
              style={styles.settingIcon}
            />
            <View>
              <Text style={styles.settingLabel}>부동산 알림</Text>
              <Text style={styles.settingDescription}>새 부동산 매물 알림</Text>
            </View>
          </View>
          <Switch
            value={settings.realEstate}
            onValueChange={() => toggleSetting("realEstate")}
            trackColor={{ false: "#ccc", true: "#FF6B35" }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* 씬짜오나눔 알림 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎁 씬짜오나눔 알림</Text>

        {/* 🆕 내 주변 상품 알림 */}
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons
              name="location"
              size={20}
              color="#E91E63"
              style={styles.settingIcon}
            />
            <View>
              <Text style={styles.settingLabel}>내 주변 상품 알림</Text>
              <Text style={styles.settingDescription}>
                내 주소 주변에 새 상품이 등록되면 알려드립니다
              </Text>
            </View>
          </View>
          <Switch
            value={settings.nearbyItems}
            onValueChange={() => toggleSetting("nearbyItems")}
            trackColor={{ false: "#ccc", true: "#FF6B35" }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons
              name="chatbubble-ellipses"
              size={20}
              color="#4CAF50"
              style={styles.settingIcon}
            />
            <View>
              <Text style={styles.settingLabel}>채팅 알림</Text>
              <Text style={styles.settingDescription}>
                새 메시지가 오면 알려드립니다
              </Text>
            </View>
          </View>
          <Switch
            value={settings.chat}
            onValueChange={() => toggleSetting("chat")}
            trackColor={{ false: "#ccc", true: "#FF6B35" }}
            thumbColor="#fff"
          />
        </View>

        {/* 가격 변동 알림 */}
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons
              name="pricetag"
              size={20}
              color="#FF9800"
              style={styles.settingIcon}
            />
            <View>
              <Text style={styles.settingLabel}>가격 변동 알림</Text>
              <Text style={styles.settingDescription}>
                찜한 물품의 가격이 변경되면 알려드립니다
              </Text>
            </View>
          </View>
          <Switch
            value={settings.priceChange}
            onValueChange={() => toggleSetting("priceChange")}
            trackColor={{ false: "#ccc", true: "#FF6B35" }}
            thumbColor="#fff"
          />
        </View>

        {/* 리뷰 알림 */}
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons
              name="star"
              size={20}
              color="#FFD700"
              style={styles.settingIcon}
            />
            <View>
              <Text style={styles.settingLabel}>리뷰 알림</Text>
              <Text style={styles.settingDescription}>
                내 물품에 리뷰가 달리면 알려드립니다
              </Text>
            </View>
          </View>
          <Switch
            value={settings.review}
            onValueChange={() => toggleSetting("review")}
            trackColor={{ false: "#ccc", true: "#FF6B35" }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* 채팅 알림음 선택 */}
      {settings.chat && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔔 채팅 알림음</Text>

          {NOTIFICATION_SOUNDS.map((sound) => (
            <TouchableOpacity
              key={sound.id}
              style={[
                styles.soundOption,
                selectedSound === sound.id && styles.soundOptionSelected,
              ]}
              onPress={() => handleSoundSelect(sound)}
            >
              <View style={styles.soundLeft}>
                <Ionicons
                  name={
                    selectedSound === sound.id
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={24}
                  color={selectedSound === sound.id ? "#FF6B35" : "#8E8E93"}
                />
                <Text
                  style={[
                    styles.soundLabel,
                    selectedSound === sound.id && styles.soundLabelSelected,
                  ]}
                >
                  {sound.label}
                </Text>
              </View>
              {selectedSound === sound.id && (
                <Ionicons name="checkmark-circle" size={24} color="#FF6B35" />
              )}
            </TouchableOpacity>
          ))}

          <View style={styles.infoBox}>
            <Ionicons name="volume-high" size={18} color="#8E8E93" />
            <Text style={styles.infoText}>
              알림음을 선택하면 미리듣기가 재생됩니다
            </Text>
          </View>
        </View>
      )}

      {/* 안내 메시지 */}
      <View style={styles.footerInfo}>
        <Ionicons name="information-circle-outline" size={20} color="#8E8E93" />
        <Text style={styles.footerText}>
          알림은 앱이 실행 중일 때 표시됩니다.{"\n"}
          가격 변동 알림은 찜한 물품의 가격이 낮아질 때 알려드립니다.{"\n"}
          주변 상품 알림은 프로필에 주소를 등록하셔야 받으실 수 있습니다.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  section: {
    backgroundColor: "#fff",
    marginTop: 20,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 13,
    color: "#8E8E93",
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C6C6C8",
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: "#000",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: "#8E8E93",
    maxWidth: 250,
  },
  soundOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C6C6C8",
  },
  soundOptionSelected: {
    backgroundColor: "#FFF5F2",
  },
  soundLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  soundLabel: {
    fontSize: 16,
    color: "#000",
    marginLeft: 12,
  },
  soundLabelSelected: {
    fontWeight: "600",
    color: "#FF6B35",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 13,
    color: "#8E8E93",
    marginLeft: 8,
    flex: 1,
  },
  footerInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 40,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
  },
  footerText: {
    fontSize: 13,
    color: "#8E8E93",
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
});
