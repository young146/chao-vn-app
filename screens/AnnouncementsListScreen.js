import React, { useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  Image, StyleSheet, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  collection, query, orderBy, limit, onSnapshot,
} from "firebase/firestore";
import { getDb } from "../firebase/config";

const BRAND = "#FF6B35";

export default function AnnouncementsListScreen({ navigation }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub;
    (async () => {
      const db = await getDb();
      const q = query(
        collection(db, "announcements"),
        orderBy("sentAt", "desc"),
        limit(50)
      );
      unsub = onSnapshot(q, (snap) => {
        setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });
    })();
    return () => unsub?.();
  }, []);

  const formatTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate?.() || new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}시간 전`;
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("공지 상세", { announcementId: item.id })}
      activeOpacity={0.8}
    >
      {item.imageUrl && (
        <Image source={{ uri: item.imageUrl }} style={styles.thumbnail} resizeMode="cover" />
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardText} numberOfLines={2}>{item.body}</Text>
        <View style={styles.cardMeta}>
          <Ionicons name="megaphone-outline" size={12} color="#bbb" />
          <Text style={styles.metaText}>씬짜오</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{formatTime(item.sentAt)}</Text>
          {(item.commentCount || 0) > 0 && (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Ionicons name="chatbubble-outline" size={12} color="#bbb" />
              <Text style={styles.metaText}>{item.commentCount}</Text>
            </>
          )}
          {item.url && (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Ionicons name="link-outline" size={12} color={BRAND} />
            </>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#ddd" style={styles.chevron} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={BRAND} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={announcements}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      style={styles.container}
      ListEmptyComponent={
        <View style={styles.center}>
          <Ionicons name="megaphone-outline" size={48} color="#ddd" />
          <Text style={styles.emptyText}>등록된 공지사항이 없습니다.</Text>
        </View>
      }
      contentContainerStyle={announcements.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { color: "#bbb", fontSize: 14 },

  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  thumbnail: { width: 90, height: 90 },
  cardBody: { flex: 1, padding: 12 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  cardText: { fontSize: 13, color: "#666", lineHeight: 18 },
  cardMeta: {
    flexDirection: "row", alignItems: "center",
    marginTop: 8, gap: 4, flexWrap: "wrap",
  },
  metaText: { fontSize: 11, color: "#bbb" },
  metaDot: { fontSize: 11, color: "#ddd" },
  chevron: { marginRight: 8 },
});
