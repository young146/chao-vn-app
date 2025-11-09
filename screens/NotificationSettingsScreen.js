import React, { useState, useEffect } from "react";
import { View, Text, Switch, StyleSheet, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function NotificationSettingsScreen() {
  const [settings, setSettings] = useState({
    newArticles: true,
    comments: true,
    community: true,
    jobs: false,
    realEstate: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem("notificationSettings");
      if (saved) {
        setSettings(JSON.parse(saved));
      }
    } catch (error) {
      console.error("설정 로드 실패:", error);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await AsyncStorage.setItem(
        "notificationSettings",
        JSON.stringify(newSettings)
      );
    } catch (error) {
      console.error("설정 저장 실패:", error);
    }
  };

  const toggleSetting = (key) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>알림 설정</Text>

        <View style={styles.settingItem}>
          <View>
            <Text style={styles.settingLabel}>새 기사 알림</Text>
            <Text style={styles.settingDescription}>
              새로운 기사가 올라오면 알림을 받습니다
            </Text>
          </View>
          <Switch
            value={settings.newArticles}
            onValueChange={() => toggleSetting("newArticles")}
          />
        </View>

        <View style={styles.settingItem}>
          <View>
            <Text style={styles.settingLabel}>댓글 알림</Text>
            <Text style={styles.settingDescription}>
              내 댓글에 답글이 달리면 알림을 받습니다
            </Text>
          </View>
          <Switch
            value={settings.comments}
            onValueChange={() => toggleSetting("comments")}
          />
        </View>

        <View style={styles.settingItem}>
          <View>
            <Text style={styles.settingLabel}>커뮤니티 알림</Text>
            <Text style={styles.settingDescription}>커뮤니티 새 글 알림</Text>
          </View>
          <Switch
            value={settings.community}
            onValueChange={() => toggleSetting("community")}
          />
        </View>

        <View style={styles.settingItem}>
          <View>
            <Text style={styles.settingLabel}>구인구직 알림</Text>
            <Text style={styles.settingDescription}>새 채용 공고 알림</Text>
          </View>
          <Switch
            value={settings.jobs}
            onValueChange={() => toggleSetting("jobs")}
          />
        </View>

        <View style={styles.settingItem}>
          <View>
            <Text style={styles.settingLabel}>부동산 알림</Text>
            <Text style={styles.settingDescription}>새 부동산 매물 알림</Text>
          </View>
          <Switch
            value={settings.realEstate}
            onValueChange={() => toggleSetting("realEstate")}
          />
        </View>
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
    textTransform: "uppercase",
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
  settingLabel: {
    fontSize: 16,
    color: "#000",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: "#8E8E93",
  },
});
