import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import TranslatedText from "../components/TranslatedText";

export default function MyCommentsScreen({ navigation }) {
  const { user } = useAuth();
  const { t } = useTranslation('menu');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    // ✅ reviews 컬렉션에서 내가 쓴 리뷰 가져오기
    // ✅ orderBy 제거하고 JavaScript로 정렬
    const q = query(collection(db, "reviews"), where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reviewsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // ✅ JavaScript로 정렬 (최신순)
      reviewsData.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });

      setReviews(reviewsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleDelete = async (reviewId) => {
    Alert.alert(t('deleteReview'), t('deleteReviewConfirm'), [
      { text: t('common:cancel'), style: "cancel" },
      {
        text: t('common:delete'),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "reviews", reviewId));
            Alert.alert(t('complete'), t('reviewDeleted'));
          } catch (error) {
            console.error("리뷰 삭제 실패:", error);
            Alert.alert(t('error'), t('deleteReviewFailed'));
          }
        },
      },
    ]);
  };

  const renderReview = ({ item }) => (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <View style={styles.itemInfo}>
          <TranslatedText style={styles.itemTitle} numberOfLines={1}>
            {item.itemTitle || t('item')}
          </TranslatedText>
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= item.rating ? "star" : "star-outline"}
                size={16}
                color="#FFD700"
              />
            ))}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => handleDelete(item.id)}
          style={styles.deleteButton}
        >
          <Ionicons name="trash-outline" size={22} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      <TranslatedText style={styles.content}>{item.content}</TranslatedText>

      <Text style={styles.date}>
        {item.createdAt?.toDate().toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={reviews}
        renderItem={renderReview}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>{t('noReviewsMessage')}</Text>
            <Text style={styles.emptySubtext}>
              {t('leaveReviewHint')}
            </Text>
          </View>
        }
        contentContainerStyle={reviews.length === 0 && { flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  reviewItem: {
    backgroundColor: "#fff",
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: "row",
    gap: 2,
  },
  deleteButton: {
    padding: 4,
  },
  content: {
    fontSize: 14,
    color: "#333",
    marginBottom: 12,
    lineHeight: 20,
  },
  date: {
    fontSize: 12,
    color: "#999",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#999",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#ccc",
    marginTop: 8,
  },
});
