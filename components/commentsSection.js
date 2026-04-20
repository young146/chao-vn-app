import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image as RNImage,
} from "react-native";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";

export default function CommentsSection({ articleId }) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [selectedImage, setSelectedDateImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const goToLogin = () => {
    navigation.navigate("로그인");
  };

  const requireLogin = () => {
    Alert.alert(
      "로그인 필요",
      "댓글 작성은 로그인 후 이용하실 수 있습니다.",
      [
        { text: "취소", style: "cancel" },
        { text: "로그인", onPress: goToLogin },
      ]
    );
  };

  // 실시간 댓글 불러오기
  useEffect(() => {
    setFetching(true);
    // 인덱스 생성이 완료되면(Enabled) orderBy가 정상 작동합니다.
    const q = query(
      collection(db, "comments"),
      where("articleId", "==", articleId.toString())
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // 클라이언트 사이드 정렬: 작성 시간 오름차순
      commentsData.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.() || new Date(0);
        const timeB = b.createdAt?.toDate?.() || new Date(0);
        return timeA - timeB;
      });

      setComments(commentsData);
      setFetching(false);
    }, (error) => {
      console.error("댓글 로딩 에러:", error);
      setFetching(false);
    });

    return () => unsubscribe();
  }, [articleId]);

  // 사진 선택 또는 촬영을 위한 메뉴 호출
  const handleImagePicker = () => {
    if (!user) {
      requireLogin();
      return;
    }
    Alert.alert(
      "사진 첨부",
      "사진을 어떻게 첨부하시겠습니까?",
      [
        { text: "갤러리에서 선택", onPress: pickImage },
        { text: "직접 촬영하기", onPress: takePhoto },
        { text: "취소", style: "cancel" }
      ]
    );
  };

  // 갤러리에서 사진 선택
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진을 업로드하려면 갤러리 접근 권한이 필요합니다.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setSelectedDateImage(result.assets[0].uri);
    }
  };

  // 카메라로 직접 촬영
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라를 사용하려면 카메라 접근 권한이 필요합니다.');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setSelectedDateImage(result.assets[0].uri);
    }
  };

  // 사진 업로드 함수
  const uploadImageAsync = async (uri) => {
    const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function (e) {
        console.log(e);
        reject(new TypeError("Network request failed"));
      };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });

    const fileRef = ref(storage, `comment_images/${Date.now()}`);
    await uploadBytes(fileRef, blob);

    // blob 정리
    // @ts-ignore
    blob.close();

    return await getDownloadURL(fileRef);
  };

  // 댓글 작성
  const handleSubmit = async () => {
    if (!user) {
      requireLogin();
      return;
    }
    if (!newComment.trim() && !selectedImage) return;

    setLoading(true);
    try {
      let imageUrl = null;
      if (selectedImage) {
        imageUrl = await uploadImageAsync(selectedImage);
      }

      const commentData = {
        articleId: articleId.toString(),
        userId: user.uid,
        userName: user.displayName || "베트남교민",
        content: newComment.trim(),
        imageUrl: imageUrl,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "comments"), commentData);
      setNewComment("");
      setSelectedDateImage(null);
    } catch (error) {
      console.error("댓글 작성 실패:", error);
      Alert.alert("오류", "댓글 작성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  // 수정 시작
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditContent(item.content || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const saveEdit = async (commentId) => {
    if (!editContent.trim()) {
      Alert.alert("알림", "댓글 내용을 입력해주세요.");
      return;
    }
    setSavingEdit(true);
    try {
      await updateDoc(doc(db, "comments", commentId), {
        content: editContent.trim(),
        updatedAt: serverTimestamp(),
      });
      cancelEdit();
    } catch (error) {
      console.error("댓글 수정 실패:", error);
      Alert.alert("오류", "댓글 수정에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = (commentId) => {
    Alert.alert(
      "댓글 삭제",
      "이 댓글을 삭제하시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "comments", commentId));
            } catch (error) {
              console.error("댓글 삭제 실패:", error);
              Alert.alert("오류", "댓글 삭제에 실패했습니다.");
            }
          },
        },
      ]
    );
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="chatbubble-ellipses-outline" size={20} color="#333" />
        <Text style={styles.title}>댓글 ({comments.length})</Text>
      </View>

      {/* 댓글 목록 */}
      {fetching ? (
        <ActivityIndicator size="small" color="#FF6B35" style={{ marginVertical: 20 }} />
      ) : (
        <View style={styles.commentList}>
          {comments.map((item) => {
            const isOwner = user && item.userId && item.userId === user.uid;
            const isEditing = editingId === item.id;
            return (
              <View key={item.id} style={styles.commentItem}>
                <View style={styles.commentHeader}>
                  <Text style={styles.commentUser}>{item.userName || "익명"}</Text>
                  <Text style={styles.commentDate}>
                    {formatTime(item.createdAt)}
                    {item.updatedAt ? " (수정됨)" : ""}
                  </Text>
                </View>

                {isEditing ? (
                  <View style={styles.editContainer}>
                    <TextInput
                      style={styles.editInput}
                      value={editContent}
                      onChangeText={setEditContent}
                      multiline
                      maxLength={200}
                      placeholder="댓글을 입력하세요"
                      placeholderTextColor="#999"
                    />
                    <View style={styles.editActions}>
                      <TouchableOpacity
                        style={[styles.editActionBtn, styles.editCancelBtn]}
                        onPress={cancelEdit}
                        disabled={savingEdit}
                      >
                        <Text style={styles.editCancelText}>취소</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.editActionBtn, styles.editSaveBtn]}
                        onPress={() => saveEdit(item.id)}
                        disabled={savingEdit}
                      >
                        {savingEdit ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.editSaveText}>저장</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    <Text style={styles.commentContent}>{item.content}</Text>
                    {item.imageUrl && (
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={styles.commentImage}
                        contentFit="cover"
                        transition={200}
                      />
                    )}
                    {isOwner && (
                      <View style={styles.ownerActions}>
                        <TouchableOpacity onPress={() => startEdit(item)} hitSlop={8}>
                          <Text style={styles.ownerActionText}>수정</Text>
                        </TouchableOpacity>
                        <Text style={styles.ownerActionDivider}>·</Text>
                        <TouchableOpacity onPress={() => confirmDelete(item.id)} hitSlop={8}>
                          <Text style={[styles.ownerActionText, styles.ownerActionDelete]}>삭제</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })}
          {comments.length === 0 && (
            <Text style={styles.emptyText}>첫 댓글을 남겨보세요!</Text>
          )}
        </View>
      )}

      {/* 댓글 입력 */}
      <View style={styles.inputWrapper}>
        {user ? (
          <>
            {selectedImage && (
              <View style={styles.previewContainer}>
                <RNImage source={{ uri: selectedImage }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setSelectedDateImage(null)}
                >
                  <Ionicons name="close-circle" size={24} color="#FF6B35" />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.inputContainer}>
              <TouchableOpacity style={styles.imagePickerButton} onPress={handleImagePicker}>
                <Ionicons name="camera-outline" size={24} color="#666" />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="댓글을 입력하세요"
                placeholderTextColor="#999"
                value={newComment}
                onChangeText={setNewComment}
                multiline
                maxLength={200}
              />
              <TouchableOpacity
                style={[styles.submitButton, (!newComment.trim() && !selectedImage) && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={loading || (!newComment.trim() && !selectedImage)}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>등록</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity
            style={styles.loginPrompt}
            onPress={goToLogin}
            activeOpacity={0.7}
          >
            <Ionicons name="lock-closed-outline" size={18} color="#666" />
            <Text style={styles.loginPromptText}>로그인 후 댓글을 작성할 수 있습니다</Text>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    borderTopWidth: 8,
    borderTopColor: "#f5f5f5",
    padding: 16,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#333",
  },
  commentList: {
    marginBottom: 20,
  },
  commentItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  commentUser: {
    fontWeight: "600",
    color: "#444",
    fontSize: 14,
  },
  commentDate: {
    fontSize: 11,
    color: "#999",
  },
  commentContent: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 8,
  },
  commentImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: "#eee",
  },
  inputWrapper: {
    marginTop: 10,
  },
  previewContainer: {
    marginBottom: 10,
    position: 'relative',
    width: 100,
    height: 100,
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  inputContainer: {
    flexDirection: "row",
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 8,
    alignItems: "flex-end",
    borderWidth: 1,
    borderColor: "#eee",
  },
  imagePickerButton: {
    padding: 8,
    marginRight: 4,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 14,
    color: "#333",
  },
  submitButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    paddingVertical: 30,
    fontSize: 14,
  },
  infoText: {
    fontSize: 11,
    color: "#999",
    marginTop: 6,
    textAlign: "right",
  },
  ownerActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  ownerActionText: {
    fontSize: 12,
    color: "#888",
    paddingVertical: 2,
  },
  ownerActionDelete: {
    color: "#e55",
  },
  ownerActionDivider: {
    fontSize: 12,
    color: "#ccc",
    marginHorizontal: 8,
  },
  editContainer: {
    marginTop: 4,
  },
  editInput: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: "#333",
    backgroundColor: "#fafafa",
    textAlignVertical: "top",
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
    gap: 8,
  },
  editActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 60,
    alignItems: "center",
  },
  editCancelBtn: {
    backgroundColor: "#f0f0f0",
  },
  editCancelText: {
    color: "#666",
    fontSize: 13,
    fontWeight: "600",
  },
  editSaveBtn: {
    backgroundColor: "#FF6B35",
  },
  editSaveText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  loginPrompt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f8f8",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    paddingVertical: 14,
    gap: 8,
  },
  loginPromptText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
});
