import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";

const DEMO_USER_ID = "demo-user";

export default function CommentsSection({ articleId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);

  // 실시간 댓글 불러오기
  useEffect(() => {
    const q = query(
      collection(db, "comments"),
      where("articleId", "==", articleId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setComments(commentsData);
    });

    return () => unsubscribe();
  }, [articleId]);

  // 댓글 작성
  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      await addDoc(collection(db, "comments"), {
        articleId,
        userId: DEMO_USER_ID,
        content: newComment.trim(),
        createdAt: serverTimestamp(),
      });
      setNewComment("");
    } catch (error) {
      console.error("댓글 작성 실패:", error);
      alert("댓글 작성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const renderComment = ({ item }) => (
    <View style={styles.commentItem}>
      <Text style={styles.commentUser}>{item.userId}</Text>
      <Text style={styles.commentContent}>{item.content}</Text>
      <Text style={styles.commentDate}>
        {item.createdAt?.toDate().toLocaleDateString("ko-KR")}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>댓글 ({comments.length})</Text>

      {/* 댓글 입력 */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="댓글을 입력하세요..."
          placeholderTextColor="rgba(0, 0, 0, 0.38)"
          value={newComment}
          onChangeText={setNewComment}
          multiline
        />
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? "전송 중..." : "작성"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 댓글 목록 */}
      <FlatList
        data={comments}
        renderItem={renderComment}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>첫 댓글을 작성해보세요!</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    minHeight: 50,
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  commentItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  commentUser: {
    fontWeight: "600",
    marginBottom: 4,
  },
  commentContent: {
    fontSize: 14,
    marginBottom: 4,
  },
  commentDate: {
    fontSize: 12,
    color: "#666",
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 20,
  },
});
