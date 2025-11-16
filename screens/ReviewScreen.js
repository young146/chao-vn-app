import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

export default function ReviewScreen({ route, navigation }) {
  const { item } = route.params;
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert("알림", "리뷰 내용을 입력해주세요!");
      return;
    }

    if (!user) {
      Alert.alert("알림", "로그인이 필요합니다!");
      return;
    }

    setSubmitting(true);

    try {
      // ✅ Firebase에 리뷰 저장
      await addDoc(collection(db, "reviews"), {
        itemId: item.id,
        itemTitle: item.title,
        sellerId: item.userId,
        userId: user.uid,
        userEmail: user.email,
        rating: rating,
        content: content.trim(),
        createdAt: serverTimestamp(),
      });

      // ✅ 판매자에게 알림 전송
      if (item.userId !== user.uid) {
        await addDoc(collection(db, "notifications"), {
          userId: item.userId,
          type: "new_review",
          message: `${user.email?.split("@")[0] || "사용자"}님이 "${
            item.title
          }" 물품에 ${rating}점 리뷰를 남겼습니다!`,
          itemId: item.id,
          itemTitle: item.title,
          itemImage: item.images?.[0] || null,
          rating: rating,
          read: false,
          createdAt: serverTimestamp(),
        });

        console.log("✅ 리뷰 알림 전송 완료:", item.userId);
      }

      Alert.alert("완료!", "리뷰가 등록되었습니다!", [
        {
          text: "확인",
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error("리뷰 작성 실패:", error);
      Alert.alert("오류", "리뷰 작성에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* 물품 정보 */}
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemPrice}>
              {new Intl.NumberFormat("ko-KR").format(item.price)}₫
            </Text>
          </View>

          <View style={styles.divider} />

          {/* 별점 선택 */}
          <View style={styles.section}>
            <Text style={styles.label}>별점 *</Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={40}
                    color={star <= rating ? "#FFD700" : "#ccc"}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingText}>
              {rating === 5
                ? "⭐ 최고예요!"
                : rating === 4
                ? "⭐ 좋아요!"
                : rating === 3
                ? "⭐ 보통이에요"
                : rating === 2
                ? "⭐ 별로예요"
                : "⭐ 최악이에요"}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* 리뷰 내용 */}
          <View style={styles.section}>
            <Text style={styles.label}>리뷰 내용 *</Text>
            <TextInput
              style={styles.textArea}
              placeholder="거래 경험을 공유해주세요&#10;&#10;• 물품 상태는 어땠나요?&#10;• 판매자는 친절했나요?&#10;• 거래 과정은 만족스러웠나요?"
              placeholderTextColor="rgba(0, 0, 0, 0.38)"
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
          </View>

          {/* 등록 버튼 */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.buttonText}> 등록 중...</Text>
              </View>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.buttonText}> 리뷰 등록하기</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
  },
  itemInfo: {
    backgroundColor: "#FFF8F3",
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  itemPrice: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FF6B35",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
  },
  starButton: {
    padding: 8,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FF6B35",
    textAlign: "center",
    marginTop: 12,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 150,
    backgroundColor: "#fff",
  },
  submitButton: {
    backgroundColor: "#FF6B35",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    marginBottom: 40,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  uploadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
