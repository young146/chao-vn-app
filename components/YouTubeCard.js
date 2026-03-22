/**
 * YouTubeCard.js
 * YouTube URL을 파싱해 썸네일을 보여주고 탭하면 YouTube를 외부에서 엽니다.
 * react-native-webview 없이 OTA 배포 가능.
 */
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking, Dimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * YouTube URL → 비디오 ID 추출
 * 지원 형식: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/shorts/ID
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pat of patterns) {
    const m = url.match(pat);
    if (m) return m[1];
  }
  return null;
}

/**
 * YouTubeCard: 등록된 유튜브 URL을 썸네일로 보여주는 카드
 * props:
 *   youtubeUrl: string
 *   label?: string  (카드 제목)
 */
export default function YouTubeCard({ youtubeUrl, label = "📹 소개 영상" }) {
  if (!youtubeUrl) return null;

  const videoId = extractYouTubeId(youtubeUrl);

  const handleOpen = () => {
    const url = videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : youtubeUrl;
    Linking.openURL(url).catch(() => {});
  };

  const thumbnailUri = videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{label}</Text>
      <TouchableOpacity style={styles.thumbContainer} onPress={handleOpen} activeOpacity={0.85}>
        {thumbnailUri ? (
          <>
            <Image
              source={{ uri: thumbnailUri }}
              style={styles.thumbnail}
              contentFit="cover"
              transition={200}
            />
            {/* 재생 버튼 오버레이 */}
            <View style={styles.playOverlay}>
              <View style={styles.playButton}>
                <Ionicons name="logo-youtube" size={36} color="#FF0000" />
              </View>
            </View>
          </>
        ) : (
          <View style={styles.noThumb}>
            <Ionicons name="logo-youtube" size={48} color="#FF0000" />
            <Text style={styles.noThumbText}>YouTube에서 보기</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={handleOpen} style={styles.linkRow}>
        <Ionicons name="open-outline" size={14} color="#2196F3" />
        <Text style={styles.linkText} numberOfLines={1}>{youtubeUrl}</Text>
      </TouchableOpacity>
    </View>
  );
}

const THUMB_HEIGHT = (SCREEN_WIDTH - 32) * 9 / 16; // 16:9

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    padding: 16,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ececec",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  thumbContainer: {
    width: "100%",
    height: THUMB_HEIGHT,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  playOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  noThumb: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
    gap: 8,
  },
  noThumbText: {
    fontSize: 14,
    color: "#666",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 6,
  },
  linkText: {
    flex: 1,
    fontSize: 12,
    color: "#2196F3",
    textDecorationLine: "underline",
  },
});
