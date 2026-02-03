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
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { getColors } from "../utils/colors";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

export default function ReviewScreen({ route, navigation }) {
  const { t } = useTranslation('menu');
  const { item } = route.params;
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert(t('notice'), t('review.enterContent'));
      return;
    }

    if (!user) {
      Alert.alert(t('notice'), t('review.loginRequired'));
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

      Alert.alert(t('review.success'), t('review.successMessage'), [
        {
          text: t('common:confirm'),
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error("리뷰 작성 실패:", error);
      Alert.alert(t('common:error'), t('review.failed'));
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
            <Text style={styles.label}>{t('review.rating')} *</Text>
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
                ? `⭐ ${t('review.ratingExcellent')}`
                : rating === 4
                ? `⭐ ${t('review.ratingGood')}`
                : rating === 3
                ? `⭐ ${t('review.ratingAverage')}`
                : rating === 2
                ? `⭐ ${t('review.ratingBad')}`
                : `⭐ ${t('review.ratingWorst')}`}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* 리뷰 내용 */}
          <View style={styles.section}>
            <Text style={styles.label}>{t('review.content')} *</Text>
            <TextInput
              style={styles.textArea}
              placeholder={t('review.contentPlaceholder')}
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
                <Text style={styles.buttonText}> {t('review.submitting')}</Text>
              </View>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.buttonText}> {t('review.submit')}</Text>
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
    color: "#000", // ✅ 다크모드 대응: 텍스트 색상 명시
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
