import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import TranslatedText from "../components/TranslatedText";
import { formatPrice as formatPriceUtil } from "../utils/priceFormatter";

export default function MyFavoritesScreen({ navigation }) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation('menu');
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  // 화면 포커스될 때마다 새로고침
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadFavorites();
    });
    return unsubscribe;
  }, [navigation]);

  const loadFavorites = async () => {
    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const favoritesRef = collection(db, "favorites");
      const q = query(
        favoritesRef,
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(q);
      
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 클라이언트에서 날짜순 정렬
      items.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA; // 최신순
      });
      
      setFavorites(items);
    } catch (error) {
      console.error("찜 목록 로드 실패:", error);
      Alert.alert(t('error'), t('loadFavoritesFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (favoriteId, itemTitle) => {
    Alert.alert(
      t('removeFavorite'),
      t('removeFavoriteConfirm', { title: itemTitle }),
      [
        { text: t('common:cancel'), style: "cancel" },
        {
          text: t('common:delete'),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "favorites", favoriteId));
              setFavorites(prev => prev.filter(item => item.id !== favoriteId));
              Alert.alert(t('deleteComplete'), t('removedFromFavorites'));
            } catch (error) {
              console.error("찜 삭제 실패:", error);
              Alert.alert(t('error'), t('deleteFailed'));
            }
          }
        }
      ]
    );
  };

  const handleItemPress = async (item) => {
    try {
      // 실제 물품 정보 가져오기
      const itemDoc = await getDocs(
        query(collection(db, "XinChaoDanggn"), where("__name__", "==", item.itemId))
      );
      
      if (!itemDoc.empty) {
        const itemData = { id: itemDoc.docs[0].id, ...itemDoc.docs[0].data() };
        // createdAt을 문자열로 변환하여 navigation params에 전달
        const serializableItem = {
          ...itemData,
          createdAt: itemData.createdAt?.toDate?.()?.toISOString() || itemData.createdAt,
        };
        navigation.navigate("당근/나눔 상세", { item: serializableItem });
      } else {
        Alert.alert(t('notice'), t('itemNotFound'));
      }
    } catch (error) {
      console.error("물품 정보 로드 실패:", error);
      Alert.alert(t('error'), t('loadItemFailed'));
    }
  };

  const formatPrice = (price) => {
    return formatPriceUtil(price, i18n.language);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("ko-KR");
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.7}
    >
      {/* 물품 이미지 */}
      <View style={styles.imageContainer}>
        {item.itemImage ? (
          <Image
            source={{ uri: item.itemImage }}
            style={styles.itemImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.noImage}>
            <Ionicons name="image-outline" size={40} color="#ccc" />
          </View>
        )}
      </View>

      {/* 물품 정보 */}
      <View style={styles.itemInfo}>
        <TranslatedText style={styles.itemTitle} numberOfLines={2}>
          {item.itemTitle}
        </TranslatedText>
        <Text style={styles.itemPrice}>{formatPrice(item.itemPrice)}</Text>
        <View style={styles.itemMeta}>
          <Text style={styles.itemCategory}>{item.itemCategory}</Text>
          <Text style={styles.itemDot}>•</Text>
          <Text style={styles.itemDate}>{formatDate(item.createdAt)}</Text>
        </View>
      </View>

      {/* 삭제 버튼 */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleRemoveFavorite(item.id, item.itemTitle)}
      >
        <Ionicons name="close-circle" size={24} color="#999" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="heart-outline" size={80} color="#ccc" />
        <Text style={styles.emptyTitle}>{t('loginRequired')}</Text>
        <Text style={styles.emptyMessage}>
          {t('viewFavoritesLogin')}
        </Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate("로그인")}
        >
          <Text style={styles.loginButtonText}>{t('loginButton')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyMessage}>{t('loading')}</Text>
      </View>
    );
  }

  if (favorites.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="heart-outline" size={80} color="#ccc" />
        <Text style={styles.emptyTitle}>{t('noFavorites')}</Text>
        <Text style={styles.emptyMessage}>
          {t('addFavoriteHint')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={favorites}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  listContainer: {
    padding: 12,
  },
  itemCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#f5f5f5",
  },
  itemImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  noImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 6,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FF6B35",
    marginBottom: 6,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemCategory: {
    fontSize: 13,
    color: "#666",
  },
  itemDot: {
    fontSize: 13,
    color: "#666",
    marginHorizontal: 4,
  },
  itemDate: {
    fontSize: 13,
    color: "#999",
  },
  deleteButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  loginButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});