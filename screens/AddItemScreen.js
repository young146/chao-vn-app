import { StackActions } from "@react-navigation/native"; // 추가
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import {
  VIETNAM_LOCATIONS,
  getDistrictsByCity,
  getApartmentsByDistrict,
} from "../utils/vietnamLocations";
import { useAuth } from "../contexts/AuthContext";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
  query,
  where,
  getDoc,
} from "firebase/firestore";
import { db, storage } from "../firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AddItemScreen({ navigation, route }) {
  const { user } = useAuth();
  const editItem = route?.params?.item;
  const isEditMode = !!editItem;

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("전자제품");
  const [selectedCity, setSelectedCity] = useState("호치민");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedApartment, setSelectedApartment] = useState("");
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("판매중");

  const [phone, setPhone] = useState("");
  const [kakaoId, setKakaoId] = useState("");
  const [otherContact, setOtherContact] = useState("");

  useEffect(() => {
    if (isEditMode && editItem) {
      console.log("📝 수정 모드: 기존 데이터 로드", editItem);

      setTitle(editItem.title || "");
      setPrice(editItem.price ? String(editItem.price) : "");
      setDescription(editItem.description || "");
      setCategory(editItem.category || "전자제품");
      setSelectedCity(editItem.city || "호치민");
      setSelectedDistrict(editItem.district || "");
      setSelectedApartment(editItem.apartment || "");
      setStatus(editItem.status || "판매중");

      if (editItem.images && editItem.images.length > 0) {
        setImages(editItem.images);
      }

      if (editItem.contact) {
        setPhone(editItem.contact.phone || "");
        setKakaoId(editItem.contact.kakaoId || "");
        setOtherContact(editItem.contact.other || "");
      }
    }
  }, [isEditMode, editItem]);

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("권한 필요", "카메라 접근 권한이 필요합니다.");
      return false;
    }
    return true;
  };

  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("권한 필요", "갤러리 접근 권한이 필요합니다.");
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setImages([...images, result.assets[0].uri]);
      }
    } catch (error) {
      Alert.alert("오류", "사진 촬영에 실패했습니다.");
    }
  };

  const pickImagesFromGallery = async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - images.length,
      });

      if (!result.canceled) {
        const newImages = result.assets.map((asset) => asset.uri);
        setImages([...images, ...newImages].slice(0, 5));
      }
    } catch (error) {
      Alert.alert("오류", "사진을 선택할 수 없습니다.");
    }
  };

  const pickImages = () => {
    if (images.length >= 5) {
      Alert.alert("알림", "사진은 최대 5장까지 등록할 수 있습니다.");
      return;
    }

    Alert.alert("사진 선택", "사진을 추가할 방법을 선택하세요", [
      {
        text: "📷 카메라로 촬영",
        onPress: takePhoto,
      },
      {
        text: "🖼️ 갤러리에서 선택",
        onPress: pickImagesFromGallery,
      },
      {
        text: "취소",
        style: "cancel",
      },
    ]);
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
  };

  const uploadImageToStorage = async (uri) => {
    try {
      if (uri.startsWith("https://")) {
        return uri;
      }

      const response = await fetch(uri);
      const blob = await response.blob();

      const filename = `items/${user.uid}_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}.jpg`;
      const storageRef = ref(storage, filename);

      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error("이미지 업로드 실패:", error);
      throw error;
    }
  };

  const notifyPriceChange = async (itemId, oldPrice, newPrice) => {
    try {
      console.log("💰 가격 변동 감지:", oldPrice, "→", newPrice);

      const favoritesRef = collection(db, "favorites");
      const q = query(favoritesRef, where("itemId", "==", itemId));
      const snapshot = await getDocs(q);

      console.log(`💝 찜한 사람 ${snapshot.size}명 발견`);

      if (snapshot.empty) {
        console.log("찜한 사람 없음");
        return;
      }

      let notificationCount = 0;

      for (const favoriteDoc of snapshot.docs) {
        const favorite = favoriteDoc.data();
        const userId = favorite.userId;

        const settingsData = await AsyncStorage.getItem("notificationSettings");
        let settings = { priceChange: true };

        if (settingsData) {
          settings = JSON.parse(settingsData);
        }

        if (settings.priceChange !== false) {
          await addDoc(collection(db, "notifications"), {
            userId: userId,
            type: "priceChange",
            itemId: itemId,
            itemTitle: title,
            itemImage: images[0] || null,
            oldPrice: oldPrice,
            newPrice: newPrice,
            discount: oldPrice - newPrice,
            message: `찜한 물품 "${title}"의 가격이 ${(
              oldPrice - newPrice
            ).toLocaleString()}₫ 할인되었습니다!`,
            read: false,
            createdAt: serverTimestamp(),
          });

          notificationCount++;
        }
      }

      console.log(`✅ ${notificationCount}명에게 알림 생성 완료`);
    } catch (error) {
      console.error("가격 변동 알림 생성 실패:", error);
    }
  };

  // 관리자에게 알림 생성하는 함수
  const notifyAdminsNewItem = async (
    itemId,
    itemTitle,
    itemImage,
    itemPrice
  ) => {
    try {
      console.log("📢 관리자에게 신규 물품 알림 생성 중...");

      const adminEmails = ["info@chaovietnam.co.kr", "younghan146@gmail.com"];

      for (const adminEmail of adminEmails) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", adminEmail));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const adminUserId = snapshot.docs[0].id;

          await addDoc(collection(db, "notifications"), {
            userId: adminUserId,
            type: "new_item",
            itemId: itemId,
            itemTitle: itemTitle,
            itemImage: itemImage || "",
            itemPrice: itemPrice,
            sellerEmail: user.email,
            message: `새 물품이 등록되었습니다: ${itemTitle}`,
            read: false,
            createdAt: serverTimestamp(),
          });

          console.log(`✅ ${adminEmail}에게 알림 생성 완료`);
        } else {
          console.log(`⚠️ ${adminEmail} 계정을 찾을 수 없음`);
        }
      }
    } catch (error) {
      console.error("❌ 관리자 알림 생성 실패:", error);
    }
  };

  // 🆕 주변 사용자에게 알림 생성하는 함수
  const notifyNearbyUsers = async (
    itemId,
    itemTitle,
    itemImage,
    itemPrice,
    itemCity,
    itemDistrict,
    itemApartment
  ) => {
    try {
      console.log("🏘️ 주변 사용자에게 알림 생성 중...");
      console.log(`📍 위치: ${itemCity} ${itemDistrict} ${itemApartment}`);

      // 1️⃣ 같은 주소를 가진 사용자 찾기
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("city", "==", itemCity),
        where("district", "==", itemDistrict),
        where("apartment", "==", itemApartment)
      );
      const usersSnapshot = await getDocs(q);

      console.log(`👥 같은 주소 사용자 ${usersSnapshot.size}명 발견`);

      if (usersSnapshot.empty) {
        console.log("⚠️ 같은 주소의 사용자 없음");
        return;
      }

      let notificationCount = 0;

      // 2️⃣ 각 사용자의 알림 설정 확인
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const nearbyUserId = userDoc.id;

        // 본인은 제외
        if (nearbyUserId === user.uid) {
          console.log("⏭️ 본인은 제외");
          continue;
        }

        // 3️⃣ notificationSettings 확인
        const settingsRef = doc(db, "notificationSettings", nearbyUserId);
        const settingsSnap = await getDoc(settingsRef);

        if (settingsSnap.exists()) {
          const settings = settingsSnap.data();

          // nearbyItems가 true인 경우만 알림 생성
          if (settings.nearbyItems === true) {
            await addDoc(collection(db, "notifications"), {
              userId: nearbyUserId,
              type: "nearby_item",
              itemId: itemId,
              itemTitle: itemTitle,
              itemImage: itemImage || "",
              itemPrice: itemPrice,
              itemLocation: `${itemCity} ${itemDistrict} ${itemApartment}`,
              message: `내 주변에 새 상품이 등록되었습니다: ${itemTitle}`,
              read: false,
              createdAt: serverTimestamp(),
            });

            notificationCount++;
            console.log(`✅ ${userData.email}에게 알림 생성`);
          } else {
            console.log(`⏭️ ${userData.email} - 주변 상품 알림 OFF`);
          }
        } else {
          console.log(`⚠️ ${userData.email} - 알림 설정 없음 (스킵)`);
        }
      }

      console.log(`✅ 총 ${notificationCount}명에게 주변 상품 알림 생성 완료`);
    } catch (error) {
      console.error("❌ 주변 사용자 알림 생성 실패:", error);
    }
  };

  const handleSubmit = async () => {
    if (!title || !price || !description || !selectedApartment) {
      Alert.alert("알림", "필수 항목을 모두 입력해주세요!");
      return;
    }

    if (!phone && !kakaoId && !otherContact) {
      Alert.alert("알림", "연락처를 최소 하나 이상 입력해주세요!");
      return;
    }

    if (!user) {
      Alert.alert("알림", "로그인이 필요합니다!");
      return;
    }

    setUploading(true);

    try {
      console.log("📤 이미지 업로드 시작...");
      const uploadedImageUrls = [];

      for (let i = 0; i < images.length; i++) {
        console.log(`📷 이미지 ${i + 1}/${images.length} 처리 중...`);
        const url = await uploadImageToStorage(images[i]);
        uploadedImageUrls.push(url);
        console.log(`✅ 이미지 ${i + 1} 완료`);
      }

      console.log("✅ 모든 이미지 처리 완료!");

      const itemData = {
        title,
        price: parseInt(price),
        description,
        category,
        location: `${selectedCity} ${selectedDistrict} ${selectedApartment}`,
        city: selectedCity,
        district: selectedDistrict,
        apartment: selectedApartment,
        images: uploadedImageUrls,
        contact: {
          phone: phone || "",
          kakaoId: kakaoId || "",
          other: otherContact || "",
        },
      };

      let resultItem;

      if (isEditMode) {
        const oldPrice = editItem.price;
        const newPrice = parseInt(price);
        let newStatus = editItem.status || "판매중";

        if (newPrice < oldPrice) {
          newStatus = "가격 조정됨";
          console.log("💸 가격 할인 감지! 상태를 '가격 조정됨'으로 변경");
        }

        console.log("💾 물품 수정 중...");
        const itemRef = doc(db, "XinChaoDanggn", editItem.id);
        await updateDoc(itemRef, {
          ...itemData,
          status: newStatus,
        });

        if (newPrice < oldPrice) {
          console.log("💸 가격 할인 감지! 알림 생성 시작...");
          await notifyPriceChange(editItem.id, oldPrice, newPrice);
        }

        resultItem = {
          ...editItem,
          ...itemData,
          status: newStatus,
        };

        console.log("✅ 물품 수정 완료!");

        setUploading(false);

        Alert.alert("성공!", "물품이 수정되었습니다!", [
          {
            text: "확인",
            onPress: () => {
              // 스택 리셋: 씬짜오당근메인 → 물품 상세
              navigation.reset({
                index: 1,
                routes: [
                  { name: "씬짜오당근메인" },
                  { name: "물품 상세", params: { item: resultItem } },
                ],
              });
            },
          },
        ]);
      } else {
        // 새 물품 등록
        console.log("💾 물품 등록 중...");
        const docRef = await addDoc(collection(db, "XinChaoDanggn"), {
          ...itemData,
          userId: user.uid,
          userEmail: user.email,
          createdAt: serverTimestamp(),
          status: "판매중",
        });

        // 관리자에게 알림
        await notifyAdminsNewItem(
          docRef.id,
          title,
          uploadedImageUrls[0] || "",
          parseInt(price)
        );

        // 🆕 주변 사용자에게 알림
        await notifyNearbyUsers(
          docRef.id,
          title,
          uploadedImageUrls[0] || "",
          parseInt(price),
          selectedCity,
          selectedDistrict,
          selectedApartment
        );

        resultItem = {
          id: docRef.id,
          ...itemData,
          userId: user.uid,
          userEmail: user.email,
          createdAt: new Date(),
          status: "판매중",
        };

        console.log("✅ 물품 등록 완료! ID:", docRef.id);

        setUploading(false);

        Alert.alert("성공!", "상품이 등록되었습니다!", [
          {
            text: "확인",
            onPress: () => {
              navigation.navigate("물품 상세", { item: resultItem });
            },
          },
        ]);
      }
    } catch (error) {
      console.error("❌ 작업 실패:", error);
      console.error("❌ 에러 상세:", error.message);

      setUploading(false);

      Alert.alert(
        "오류",
        `작업에 실패했습니다.\n\n${error.message}\n\n다시 시도해주세요.`
      );
    }
  };

  const districts = getDistrictsByCity(selectedCity);
  const apartments = selectedDistrict
    ? getApartmentsByDistrict(selectedCity, selectedDistrict)
    : [];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* 사진 업로드 섹션 */}
        <View style={styles.imageSection}>
          <Text style={styles.imageSectionTitle}>
            📷 사진 등록 ({images.length}/5)
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.imageScroll}
          >
            {images.length < 5 && (
              <TouchableOpacity
                style={styles.addImageButton}
                onPress={pickImages}
              >
                <Ionicons name="camera" size={40} color="#999" />
                <Text style={styles.addImageText}>사진 추가</Text>
              </TouchableOpacity>
            )}

            {images.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </TouchableOpacity>
                {index === 0 && (
                  <View style={styles.mainBadge}>
                    <Text style={styles.mainBadgeText}>대표</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>

        <Text style={styles.label}>제목 *</Text>
        <TextInput
          style={styles.input}
          placeholder="상품 제목"
          placeholderTextColor="rgba(0, 0, 0, 0.38)"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>가격 (VND) *</Text>
        <TextInput
          style={styles.input}
          placeholder="가격"
          placeholderTextColor="rgba(0, 0, 0, 0.38)"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
        />

        <Text style={styles.label}>카테고리</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={category}
            onValueChange={setCategory}
            style={styles.picker}
          >
            <Picker.Item label="무료나눔" value="무료나눔" />
            <Picker.Item label="🔍 구인" value="구인" />
            <Picker.Item label="💼 구직" value="구직" />
            <Picker.Item label="🏠 부동산 임대" value="부동산 임대" />
            <Picker.Item label="🏡 부동산 판매" value="부동산 판매" />
            <Picker.Item label="전자제품" value="전자제품" />
            <Picker.Item label="가구/인테리어" value="가구/인테리어" />
            <Picker.Item label="의류/잡화" value="의류/잡화" />
            <Picker.Item label="생활용품" value="생활용품" />
            <Picker.Item label="도서/문구" value="도서/문구" />
            <Picker.Item label="유아용품" value="유아용품" />
            <Picker.Item label="펫 용품" value="펫 용품" />

            <Picker.Item label="기타" value="기타" />
          </Picker>
        </View>

        <Text style={styles.label}>도시 *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedCity}
            onValueChange={(value) => {
              setSelectedCity(value);
              setSelectedDistrict("");
              setSelectedApartment("");
            }}
          >
            <Picker.Item label="호치민" value="호치민" />
            <Picker.Item label="하노이" value="하노이" />
            <Picker.Item label="다낭" value="다낭" />
            <Picker.Item label="냐짱" value="냐짱" />
          </Picker>
        </View>

        <Text style={styles.label}>구/군 *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedDistrict}
            onValueChange={(value) => {
              setSelectedDistrict(value);
              setSelectedApartment("");
            }}
          >
            <Picker.Item label="선택하세요" value="" />
            {districts.map((district) => (
              <Picker.Item key={district} label={district} value={district} />
            ))}
          </Picker>
        </View>

        {apartments.length > 0 && (
          <>
            <Text style={styles.label}>아파트/지역 *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedApartment}
                onValueChange={setSelectedApartment}
              >
                <Picker.Item label="선택하세요" value="" />
                {apartments.map((apartment) => (
                  <Picker.Item
                    key={apartment}
                    label={apartment}
                    value={apartment}
                  />
                ))}
              </Picker>
            </View>
          </>
        )}

        <Text style={styles.label}>상품 설명 *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="상품 설명을 입력하세요"
          placeholderTextColor="rgba(0, 0, 0, 0.38)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>
            📞 연락처 (최소 1개 이상 입력) *
          </Text>

          <Text style={styles.label}>전화번호</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 010-1234-5678 또는 +84-123-456-789"
            placeholderTextColor="rgba(0, 0, 0, 0.38)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>카카오톡 ID</Text>
          <TextInput
            style={styles.input}
            placeholder="예: kakao_id123"
            placeholderTextColor="rgba(0, 0, 0, 0.38)"
            value={kakaoId}
            onChangeText={setKakaoId}
          />

          <Text style={styles.label}>기타 SNS (Zalo, Facebook 등)</Text>
          <TextInput
            style={styles.input}
            placeholder="예: Zalo: 0123456789"
            placeholderTextColor="rgba(0, 0, 0, 0.38)"
            value={otherContact}
            onChangeText={setOtherContact}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, uploading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={uploading}
        >
          {uploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.buttonText}> 처리 중...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>
              {isEditMode ? "수정하기" : "등록하기"}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  imageSection: {
    marginBottom: 20,
  },
  imageSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  imageScroll: {
    flexDirection: "row",
  },
  addImageButton: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    borderWidth: 2,
    borderColor: "#ddd",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  addImageText: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
  },
  imageWrapper: {
    position: "relative",
    marginRight: 10,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  removeButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#FF6B35",
    borderRadius: 12,
  },
  mainBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  mainBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  contactSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#FF6B35",
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  uploadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
});
