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
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db, storage } from "../firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

export default function AddItemScreen({ navigation, route }) {
  const { user } = useAuth();
  const editItem = route?.params?.item; // 수정할 물품 데이터
  const isEditMode = !!editItem; // 수정 모드 여부

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("전자제품");
  const [selectedCity, setSelectedCity] = useState("호치민");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedApartment, setSelectedApartment] = useState("");
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [phone, setPhone] = useState("");
  const [kakaoId, setKakaoId] = useState("");
  const [otherContact, setOtherContact] = useState("");

  // ✅ 수정 모드일 때 기존 데이터 불러오기
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
      
      // 이미지 로드
      if (editItem.images && editItem.images.length > 0) {
        setImages(editItem.images);
      }
      
      // 연락처 로드
      if (editItem.contact) {
        setPhone(editItem.contact.phone || "");
        setKakaoId(editItem.contact.kakaoId || "");
        setOtherContact(editItem.contact.other || "");
      }
    }
  }, [isEditMode, editItem]);

  // ✅ 카메라 권한 요청
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.');
      return false;
    }
    return true;
  };

  // ✅ 갤러리 권한 요청
  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
      return false;
    }
    return true;
  };

  // ✅ 카메라로 촬영
  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
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

  // ✅ 갤러리에서 선택 (복수 선택 가능!)
  const pickImagesFromGallery = async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - images.length,
      });

      if (!result.canceled) {
        const newImages = result.assets.map(asset => asset.uri);
        setImages([...images, ...newImages].slice(0, 5));
      }
    } catch (error) {
      Alert.alert("오류", "사진을 선택할 수 없습니다.");
    }
  };

  // ✅ 사진 선택 메뉴
  const pickImages = () => {
    if (images.length >= 5) {
      Alert.alert("알림", "사진은 최대 5장까지 등록할 수 있습니다.");
      return;
    }

    Alert.alert(
      "사진 선택",
      "사진을 추가할 방법을 선택하세요",
      [
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
      ]
    );
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
  };

  // ✅ 이미지를 Firebase Storage에 업로드하는 함수
  const uploadImageToStorage = async (uri) => {
    try {
      // 이미 Firebase URL인 경우 그대로 반환
      if (uri.startsWith('https://')) {
        return uri;
      }

      const response = await fetch(uri);
      const blob = await response.blob();
      
      const filename = `items/${user.uid}_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const storageRef = ref(storage, filename);
      
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error("이미지 업로드 실패:", error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    // 1️⃣ 유효성 검사
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
      // 2️⃣ 이미지 업로드
      console.log("📤 이미지 업로드 시작...");
      const uploadedImageUrls = [];
      
      for (let i = 0; i < images.length; i++) {
        console.log(`📷 이미지 ${i + 1}/${images.length} 처리 중...`);
        const url = await uploadImageToStorage(images[i]);
        uploadedImageUrls.push(url);
        console.log(`✅ 이미지 ${i + 1} 완료`);
      }

      console.log("✅ 모든 이미지 처리 완료!");

      // 3️⃣ 데이터 준비
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
        // 4️⃣-A 수정 모드: Firestore 업데이트
        console.log("💾 물품 수정 중...");
        const itemRef = doc(db, "XinChaoDanggn", editItem.id);
        await updateDoc(itemRef, itemData);
        
        resultItem = {
          ...editItem,
          ...itemData,
        };

        console.log("✅ 물품 수정 완료!");

        setUploading(false);

        Alert.alert("성공!", "물품이 수정되었습니다!", [
          {
            text: "확인",
            onPress: () => {
              navigation.navigate("물품 상세", { item: resultItem });
            },
          },
        ]);

      } else {
        // 4️⃣-B 등록 모드: Firestore에 새로 추가
        console.log("💾 물품 등록 중...");
        const docRef = await addDoc(collection(db, "XinChaoDanggn"), {
          ...itemData,
          userId: user.uid,
          userEmail: user.email,
          createdAt: serverTimestamp(),
          status: "판매중",
        });

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
            {/* 사진 추가 버튼 */}
            {images.length < 5 && (
              <TouchableOpacity
                style={styles.addImageButton}
                onPress={pickImages}
              >
                <Ionicons name="camera" size={40} color="#999" />
                <Text style={styles.addImageText}>사진 추가</Text>
              </TouchableOpacity>
            )}

            {/* 선택된 사진들 */}
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

        {/* 제목 */}
        <Text style={styles.label}>제목 *</Text>
        <TextInput
          style={styles.input}
          placeholder="상품 제목"
          value={title}
          onChangeText={setTitle}
        />

        {/* 가격 */}
        <Text style={styles.label}>가격 (VND) *</Text>
        <TextInput
          style={styles.input}
          placeholder="가격"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
        />

        {/* 카테고리 */}
        <Text style={styles.label}>카테고리</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={category} onValueChange={setCategory}>
            <Picker.Item label="전자제품" value="전자제품" />
            <Picker.Item label="가구/인테리어" value="가구/인테리어" />
            <Picker.Item label="의류/잡화" value="의류/잡화" />
            <Picker.Item label="생활용품" value="생활용품" />
            <Picker.Item label="도서/티켓" value="도서/티켓" />
            <Picker.Item label="유아용품" value="유아용품" />
            <Picker.Item label="펫용품" value="펫용품" />
            <Picker.Item label="기타" value="기타" />
          </Picker>
        </View>

        {/* 도시 */}
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

        {/* 구/군 */}
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

        {/* 아파트/지역 */}
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

        {/* 상품 설명 */}
        <Text style={styles.label}>상품 설명 *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="상품 설명을 입력하세요"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        {/* 연락처 섹션 */}
        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>
            📞 연락처 (최소 1개 이상 입력) *
          </Text>

          <Text style={styles.label}>전화번호</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 010-1234-5678 또는 +84-123-456-789"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>카카오톡 ID</Text>
          <TextInput
            style={styles.input}
            placeholder="예: kakao_id123"
            value={kakaoId}
            onChangeText={setKakaoId}
          />

          <Text style={styles.label}>기타 SNS (Zalo, Facebook 등)</Text>
          <TextInput
            style={styles.input}
            placeholder="예: Zalo: 0123456789"
            value={otherContact}
            onChangeText={setOtherContact}
          />
        </View>

        {/* 등록/수정 버튼 */}
        <TouchableOpacity 
          style={[styles.button, uploading && styles.buttonDisabled]} 
          onPress={handleSubmit}
          disabled={uploading}
        >
          {uploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.buttonText}>  처리 중...</Text>
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
  },
  contactSection: {
    backgroundColor: "#FFF8F3",
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FF6B35",
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#FF6B35",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
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