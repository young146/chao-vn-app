import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Image, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection, doc, addDoc, updateDoc, increment,
  onSnapshot, orderBy, query, serverTimestamp, getDoc,
} from "firebase/firestore";
import { getDb, getStorageInstance } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";

const BRAND = "#FF6B35";

export default function AnnouncementDetailScreen({ route }) {
  const { announcementId } = route.params;
  const { user } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();

  const [announcement, setAnnouncement] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null); // { id, displayName }
  const [imageUri, setImageUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef(null);

  // 공지 본문 실시간 구독
  useEffect(() => {
    let unsub;
    (async () => {
      const db = await getDb();
      unsub = onSnapshot(doc(db, "announcements", announcementId), (snap) => {
        if (snap.exists()) setAnnouncement({ id: snap.id, ...snap.data() });
        setLoading(false);
      });
    })();
    return () => unsub?.();
  }, [announcementId]);

  // 댓글 실시간 구독
  useEffect(() => {
    let unsub;
    (async () => {
      const db = await getDb();
      const q = query(
        collection(db, "announcements", announcementId, "comments"),
        orderBy("createdAt", "asc")
      );
      unsub = onSnapshot(q, (snap) => {
        setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    })();
    return () => unsub?.();
  }, [announcementId]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("권한 필요", "사진첩 접근 권한이 필요합니다.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri) => {
    const storage = await getStorageInstance();
    const blob = await (await fetch(uri)).blob();
    const filename = `announcement-comments/${announcementId}/${Date.now()}.jpg`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  const submitComment = async () => {
    if (!text.trim() && !imageUri) return;
    if (!user) {
      Alert.alert("로그인 필요", "댓글을 달려면 로그인이 필요합니다.");
      return;
    }
    setUploading(true);
    try {
      const db = await getDb();
      let uploadedImageUrl = null;
      if (imageUri) uploadedImageUrl = await uploadImage(imageUri);

      await addDoc(collection(db, "announcements", announcementId, "comments"), {
        userId: user.uid,
        displayName: user.displayName || user.email?.split("@")[0] || "익명",
        photoURL: user.photoURL || null,
        text: text.trim(),
        imageUrl: uploadedImageUrl,
        parentId: replyTo?.id || null,
        parentDisplayName: replyTo?.displayName || null,
        createdAt: serverTimestamp(),
      });

      // commentCount 증가
      await updateDoc(doc(db, "announcements", announcementId), {
        commentCount: increment(1),
      });

      setText("");
      setImageUri(null);
      setReplyTo(null);
    } catch (e) {
      Alert.alert("오류", "댓글 등록에 실패했습니다.");
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const handleReply = (comment) => {
    setReplyTo({ id: comment.id, displayName: comment.displayName });
    inputRef.current?.focus();
  };

  // 댓글 트리 빌드: 최상위 → 바로 아래 대댓글 목록 순으로 평탄화
  const buildTree = useCallback(() => {
    const roots = comments.filter((c) => !c.parentId);
    const replies = comments.filter((c) => !!c.parentId);
    const result = [];
    roots.forEach((root) => {
      result.push({ ...root, depth: 0 });
      replies
        .filter((r) => r.parentId === root.id)
        .forEach((r) => result.push({ ...r, depth: 1 }));
    });
    // parentId가 있지만 부모가 없는 고아 댓글도 표시
    const rootIds = new Set(roots.map((r) => r.id));
    replies
      .filter((r) => !rootIds.has(r.parentId))
      .forEach((r) => result.push({ ...r, depth: 1 }));
    return result;
  }, [comments]);

  const formatTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate?.() || new Date(ts);
    return d.toLocaleString("ko-KR", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const renderComment = ({ item }) => (
    <View style={[styles.commentRow, item.depth === 1 && styles.commentIndented]}>
      {item.depth === 1 && (
        <Ionicons name="return-down-forward" size={14} color="#aaa" style={styles.replyIcon} />
      )}
      <View style={styles.commentBubble}>
        <View style={styles.commentHeader}>
          {item.photoURL ? (
            <Image source={{ uri: item.photoURL }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{(item.displayName || "?")[0]}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.commentName}>{item.displayName}</Text>
            {item.parentDisplayName && item.depth === 1 && (
              <Text style={styles.replyTarget}>↩ {item.parentDisplayName}에게</Text>
            )}
          </View>
          <Text style={styles.commentTime}>{formatTime(item.createdAt)}</Text>
        </View>

        {item.text ? <Text style={styles.commentText}>{item.text}</Text> : null}
        {item.imageUrl ? (
          <TouchableOpacity onPress={() => Linking.openURL(item.imageUrl)}>
            <Image source={{ uri: item.imageUrl }} style={styles.commentImage} resizeMode="cover" />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity onPress={() => handleReply(item)} style={styles.replyBtn}>
          <Ionicons name="chatbubble-outline" size={12} color={BRAND} />
          <Text style={styles.replyBtnText}>답글</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const ListHeader = () => {
    if (!announcement) return null;
    return (
      <View style={styles.postCard}>
        {announcement.imageUrl ? (
          <Image source={{ uri: announcement.imageUrl }} style={styles.postImage} resizeMode="cover" />
        ) : null}
        <View style={styles.postBody}>
          <Text style={styles.postTitle}>{announcement.title}</Text>
          <Text style={styles.postText}>{announcement.body}</Text>
          {announcement.url ? (
            <TouchableOpacity onPress={() => Linking.openURL(announcement.url)} style={styles.linkRow}>
              <Ionicons name="link" size={14} color={BRAND} />
              <Text style={styles.linkText} numberOfLines={1}>{announcement.url}</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.postMeta}>
            {formatTime(announcement.sentAt)} · 댓글 {announcement.commentCount || 0}개
          </Text>
        </View>
        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>댓글</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={BRAND} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingBottom: tabBarHeight }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={buildTree()}
        keyExtractor={(item) => item.id}
        renderItem={renderComment}
        ListHeaderComponent={<ListHeader />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>첫 댓글을 남겨보세요!</Text>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      {/* 입력 영역 */}
      <View style={styles.inputArea}>
        {replyTo && (
          <View style={styles.replyBanner}>
            <Text style={styles.replyBannerText}>↩ {replyTo.displayName}에게 답글</Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        )}
        {imageUri && (
          <View style={styles.imagePreviewRow}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            <TouchableOpacity onPress={() => setImageUri(null)} style={styles.removeImageBtn}>
              <Ionicons name="close-circle" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <TouchableOpacity onPress={pickImage} style={styles.imageBtn}>
            <Ionicons name="image-outline" size={22} color={BRAND} />
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={replyTo ? `${replyTo.displayName}에게 답글…` : "댓글을 입력하세요…"}
            placeholderTextColor="#aaa"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={submitComment}
            disabled={uploading || (!text.trim() && !imageUri)}
            style={[styles.sendBtn, (!text.trim() && !imageUri) && styles.sendBtnDisabled]}
          >
            {uploading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // 공지 본문
  postCard: { backgroundColor: "#fff", marginBottom: 8 },
  postImage: { width: "100%", height: 200 },
  postBody: { padding: 16 },
  postTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  postText: { fontSize: 15, color: "#333", lineHeight: 22 },
  linkRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 6 },
  linkText: { color: BRAND, fontSize: 13, flex: 1 },
  postMeta: { fontSize: 12, color: "#999", marginTop: 12 },
  divider: { height: 1, backgroundColor: "#f0f0f0", marginHorizontal: 16 },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: "#666", paddingHorizontal: 16, paddingVertical: 10 },

  // 댓글
  emptyText: { textAlign: "center", color: "#bbb", padding: 24, fontSize: 14 },
  commentRow: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 6 },
  commentIndented: { paddingLeft: 28 },
  replyIcon: { marginRight: 4, marginTop: 10 },
  commentBubble: { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 10 },
  commentHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  avatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
  avatarFallback: { backgroundColor: BRAND, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  commentName: { fontSize: 13, fontWeight: "600", color: "#222" },
  replyTarget: { fontSize: 11, color: "#999" },
  commentTime: { fontSize: 11, color: "#bbb", marginLeft: "auto" },
  commentText: { fontSize: 14, color: "#333", lineHeight: 20 },
  commentImage: { width: "100%", height: 160, borderRadius: 8, marginTop: 8 },
  replyBtn: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 3 },
  replyBtnText: { fontSize: 12, color: BRAND },

  // 입력창
  inputArea: { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#eee" },
  replyBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#fff8f5",
    borderBottomWidth: 1, borderBottomColor: "#ffe0d0",
  },
  replyBannerText: { fontSize: 12, color: BRAND },
  imagePreviewRow: { padding: 8, paddingBottom: 0 },
  imagePreview: { width: 64, height: 64, borderRadius: 8 },
  removeImageBtn: {
    position: "absolute", top: 0, left: 56,
    backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 10,
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", padding: 8, gap: 6 },
  imageBtn: { padding: 6 },
  input: {
    flex: 1, backgroundColor: "#f5f5f5", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, fontSize: 14,
    maxHeight: 100, color: "#222",
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: BRAND, alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#ccc" },
});
