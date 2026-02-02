import { StackActions } from "@react-navigation/native";
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
  Alert,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import { Image } from "expo-image";
import { Picker } from "@react-native-picker/picker";
import { useAuth } from "../contexts/AuthContext";
import { getColors } from "../utils/colors";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "../firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AddRealEstateScreen({ navigation, route }) {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  
  const editItem = route?.params?.editItem;
  const isEditMode = !!editItem;

  // 기본 정보
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  // 부동산 전용 필드
  const [dealType, setDealType] = useState("임대"); // 임대/매매
  const [propertyType, setPropertyType] = useState("아파트");
  const [price, setPrice] = useState(""); // 매매가
  const [deposit, setDeposit] = useState(""); // 보증금
  const [monthlyRent, setMonthlyRent] = useState(""); // 월세
  const [area, setArea] = useState(""); // 면적
  const [rooms, setRooms] = useState(""); // 방 구성
  const [floor, setFloor] = useState(""); // 층수
  const [selectedCity, setSelectedCity] = useState("호치민");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [contact, setContact] = useState("");
  const [availableDate, setAvailableDate] = useState("");
  const [status, setStatus] = useState("거래가능");

  // 거래 유형
  const dealTypes = ["임대", "매매"];

  // 매물 유형
  const propertyTypes = [
    "아파트",
    "빌라/연립",
    "오피스텔",
    "사무실",
    "상가/점포",
    "공장/창고",
    "토지",
    "기타",
  ];

  // 도시 목록
  const cities = ["호치민", "하노이", "다낭", "냐짱", "붕따우", "빈증", "동나이", "기타"];

  // 수정 모드일 때 기존 데이터 로드
  useEffect(() => {
    if (isEditMode && editItem) {
      console.log("📝 수정 모드: 기존 부동산 데이터 로드", editItem);

      setTitle(editItem.title || "");
      setDescription(editItem.description || "");
      setDealType(editItem.dealType || "임대");
      setPropertyType(editItem.propertyType || "아파트");
      setPrice(editItem.price ? String(editItem.price) : "");
      setDeposit(editItem.deposit ? String(editItem.deposit) : "");
      setMonthlyRent(editItem.monthlyRent ? String(editItem.monthlyRent) : "");
      setArea(editItem.area || "");
      setRooms(editItem.rooms || "");
      setFloor(editItem.floor || "");
      setSelectedCity(editItem.city || "호치민");
      setSelectedDistrict(editItem.district || "");
      setContact(editItem.contact || "");
      setAvailableDate(editItem.availableDate || "");
      setStatus(editItem.status || "거래가능");

      if (editItem.images && editItem.images.length > 0) {
        setImages(editItem.images);
      }
    }
  }, [isEditMode, editItem]);

  // 권한 요청
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

  // 사진 촬영
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

  // 갤러리에서 선택
  const pickImagesFromGallery = async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10 - images.length,
      });

      if (!result.canceled) {
        const newImages = result.assets.map((asset) => asset.uri);
        setImages([...images, ...newImages].slice(0, 10));
      }
    } catch (error) {
      Alert.alert("오류", "사진을 선택할 수 없습니다.");
    }
  };

  const pickImages = () => {
    if (images.length >= 10) {
      Alert.alert("알림", "사진은 최대 10장까지 등록할 수 있습니다.");
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

  // 이미지 리사이징
  const resizeImage = async (uri) => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      return manipResult.uri;
    } catch (error) {
      console.error("이미지 리사이징 실패:", error);
      return uri;
    }
  };

  // 이미지 업로드
  const uploadImageToStorage = async (uri) => {
    try {
      if (uri.startsWith("https://")) {
        return uri;
      }

      const resizedUri = await resizeImage(uri);
      const response = await fetch(resizedUri);
      const blob = await response.blob();

      const filename = `realestate/${user.uid}_${Date.now()}_${Math.random()
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

  // 폼 유효성 검사
  const validateForm = () => {
    if (!title.trim()) {
      Alert.alert("알림", "제목을 입력해주세요.");
      return false;
    }
    if (title.trim().length < 5) {
      Alert.alert("알림", "제목은 최소 5자 이상 입력해주세요.");
      return false;
    }
    if (dealType === "임대" && !deposit && !monthlyRent) {
      Alert.alert("알림", "보증금 또는 월세를 입력해주세요.");
      return false;
    }
    if (dealType === "매매" && !price) {
      Alert.alert("알림", "매매가를 입력해주세요.");
      return false;
    }
    if (!selectedCity) {
      Alert.alert("알림", "위치를 선택해주세요.");
      return false;
    }
    if (images.length === 0) {
      Alert.alert("알림", "최소 1장 이상의 사진을 등록해주세요.");
      return false;
    }
    return true;
  };

  // 등록/수정 처리
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setUploading(true);

    try {
      // 이미지 업로드
      const uploadedImages = [];
      for (const imageUri of images) {
        const downloadURL = await uploadImageToStorage(imageUri);
        uploadedImages.push(downloadURL);
      }

      const itemData = {
        title: title.trim(),
        description: description.trim(),
        dealType,
        propertyType,
        price: dealType === "매매" ? price : null,
        deposit: dealType === "임대" ? deposit : null,
        monthlyRent: dealType === "임대" ? monthlyRent : null,
        area: area.trim(),
        rooms: rooms.trim(),
        floor: floor.trim(),
        city: selectedCity,
        district: selectedDistrict.trim(),
        contact: contact.trim(),
        availableDate: availableDate.trim(),
        images: uploadedImages,
        status,
      };

      if (isEditMode) {
        // 수정
        console.log("💾 부동산 수정 중...");
        const itemRef = doc(db, "RealEstate", editItem.id);
        await updateDoc(itemRef, {
          ...itemData,
          updatedAt: serverTimestamp(),
        });

        Alert.alert("수정 완료", "매물 정보가 수정되었습니다!", [
          {
            text: "확인",
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        // 새 등록
        console.log("💾 부동산 등록 중...");
        await addDoc(collection(db, "RealEstate"), {
          ...itemData,
          userId: user.uid,
          userEmail: user.email,
          createdAt: serverTimestamp(),
        });

        // 캐시 무효화
        await AsyncStorage.removeItem("cached_realestate");

        Alert.alert("등록 완료", "부동산 매물이 등록되었습니다!", [
          {
            text: "확인",
            onPress: () => {
              navigation.dispatch(StackActions.pop(1));
            },
          },
        ]);
      }
    } catch (error) {
      console.error("등록 실패:", error);
      Alert.alert("오류", "등록에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 헤더 안내 */}
        <View style={styles.headerBanner}>
          <Ionicons name="home" size={24} color="#E91E63" />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>
              {isEditMode ? "매물 수정" : "부동산 등록"}
            </Text>
            <Text style={styles.headerSubtitle}>
              베트남 교민을 위한 부동산 정보
            </Text>
          </View>
        </View>

        {/* 임대/매매 선택 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="swap-horizontal" size={16} color="#333" /> 거래 유형 *
          </Text>
          <View style={styles.dealTypeContainer}>
            {dealTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.dealTypeButton,
                  dealType === type && styles.dealTypeButtonActive,
                ]}
                onPress={() => setDealType(type)}
              >
                <Ionicons
                  name={type === "임대" ? "key" : "cart"}
                  size={24}
                  color={dealType === type ? "#fff" : "#666"}
                />
                <Text
                  style={[
                    styles.dealTypeText,
                    dealType === type && styles.dealTypeTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 매물 유형 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="home-outline" size={16} color="#333" /> 매물 유형 *
          </Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={propertyType}
              onValueChange={setPropertyType}
              style={styles.picker}
            >
              {propertyTypes.map((type) => (
                <Picker.Item key={type} label={type} value={type} color="#333" />
              ))}
            </Picker>
          </View>
        </View>

        {/* 제목 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="create" size={16} color="#333" /> 제목 *
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="예: 호치민 2군 타오디엔 럭셔리 아파트 임대"
            placeholderTextColor="#999"
            value={title}
            onChangeText={setTitle}
            maxLength={60}
          />
          <Text style={styles.charCount}>{title.length}/60</Text>
        </View>

        {/* 가격 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="cash-outline" size={16} color="#333" /> 가격 정보 * ({dealType === "매매" ? "억동 단위" : "만동 단위"})
          </Text>
          
          {dealType === "임대" ? (
            <>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>보증금</Text>
                <TextInput
                  style={[styles.textInput, styles.priceInput]}
                  placeholder="예: 5000"
                  placeholderTextColor="#999"
                  value={deposit}
                  onChangeText={setDeposit}
                  keyboardType="numeric"
                />
                <Text style={styles.priceUnit}>만동</Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>월세</Text>
                <TextInput
                  style={[styles.textInput, styles.priceInput]}
                  placeholder="예: 2000"
                  placeholderTextColor="#999"
                  value={monthlyRent}
                  onChangeText={setMonthlyRent}
                  keyboardType="numeric"
                />
                <Text style={styles.priceUnit}>만동</Text>
              </View>
            </>
          ) : (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>매매가</Text>
              <TextInput
                style={[styles.textInput, styles.priceInput]}
                placeholder="예: 110 (110억동)"
                placeholderTextColor="#999"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
              />
              <Text style={styles.priceUnit}>억동</Text>
            </View>
          )}
        </View>

        {/* 위치 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="location-outline" size={16} color="#333" /> 위치 *
          </Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedCity}
              onValueChange={setSelectedCity}
              style={styles.picker}
            >
              {cities.map((city) => (
                <Picker.Item key={city} label={city} value={city} color="#333" />
              ))}
            </Picker>
          </View>
          <TextInput
            style={[styles.textInput, { marginTop: 8 }]}
            placeholder="상세 주소 (구/군, 아파트명 등)"
            placeholderTextColor="#999"
            value={selectedDistrict}
            onChangeText={setSelectedDistrict}
          />
        </View>

        {/* 면적/방 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="resize-outline" size={16} color="#333" /> 면적 및 구성
          </Text>
          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>면적 (㎡)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="예: 85"
                placeholderTextColor="#999"
                value={area}
                onChangeText={setArea}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>층수</Text>
              <TextInput
                style={styles.textInput}
                placeholder="예: 15층"
                placeholderTextColor="#999"
                value={floor}
                onChangeText={setFloor}
              />
            </View>
          </View>
          <TextInput
            style={[styles.textInput, { marginTop: 8 }]}
            placeholder="방 구성 (예: 방 2개, 화장실 2개)"
            placeholderTextColor="#999"
            value={rooms}
            onChangeText={setRooms}
          />
        </View>

        {/* 입주 가능일 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="calendar-outline" size={16} color="#333" /> 입주 가능일
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="예: 즉시 입주 가능, 2026년 3월부터"
            placeholderTextColor="#999"
            value={availableDate}
            onChangeText={setAvailableDate}
          />
        </View>

        {/* 연락처 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="call-outline" size={16} color="#333" /> 연락처
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="전화번호 또는 카카오톡 ID"
            placeholderTextColor="#999"
            value={contact}
            onChangeText={setContact}
          />
          <Text style={styles.helperText}>
            * 비공개를 원하시면 채팅으로만 연락받을 수 있습니다
          </Text>
        </View>

        {/* 상세 설명 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="document-text-outline" size={16} color="#333" /> 상세 설명
          </Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="매물의 장점, 주변 편의시설, 특이사항 등을 자세히 작성해주세요"
            placeholderTextColor="#999"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* 이미지 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="images-outline" size={16} color="#333" /> 사진 * (최대 10장)
          </Text>
          <Text style={styles.helperText}>
            첫 번째 사진이 대표 이미지로 사용됩니다
          </Text>
          <View style={styles.imageGrid}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.image} contentFit="cover" />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close-circle" size={24} color="#F44336" />
                </TouchableOpacity>
                {index === 0 && (
                  <View style={styles.mainImageBadge}>
                    <Text style={styles.mainImageText}>대표</Text>
                  </View>
                )}
              </View>
            ))}
            {images.length < 10 && (
              <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
                <Ionicons name="camera" size={32} color="#999" />
                <Text style={styles.addImageText}>사진 추가</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 수정 모드일 때 상태 변경 */}
        {isEditMode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="flag-outline" size={16} color="#333" /> 거래 상태
            </Text>
            <View style={styles.statusContainer}>
              {["거래가능", "예약중", "거래완료"].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.statusButton,
                    status === s && styles.statusButtonActive,
                    status === s && {
                      backgroundColor:
                        s === "거래가능" ? "#E8F5E9" :
                        s === "예약중" ? "#FFF3E0" : "#F5F5F5"
                    }
                  ]}
                  onPress={() => setStatus(s)}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      status === s && {
                        color:
                          s === "거래가능" ? "#4CAF50" :
                          s === "예약중" ? "#FF9800" : "#9E9E9E"
                      }
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* 등록 버튼 */}
        <TouchableOpacity
          style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.submitButtonText}>
                {isEditMode ? "수정 완료" : "등록하기"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  headerBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FCE4EC",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#C2185B",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  dealTypeContainer: {
    flexDirection: "row",
    gap: 12,
  },
  dealTypeButton: {
    flex: 1,
    alignItems: "center",
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  dealTypeButtonActive: {
    backgroundColor: "#E91E63",
    borderColor: "#E91E63",
  },
  dealTypeText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
  },
  dealTypeTextActive: {
    color: "#fff",
  },
  textInput: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    padding: 12,
    fontSize: 15,
    color: "#333",
  },
  textArea: {
    height: 120,
    textAlignVertical: "top",
  },
  charCount: {
    textAlign: "right",
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
    marginBottom: 8,
  },
  pickerWrapper: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    height: 56,
    justifyContent: "center",
  },
  picker: {
    height: 56,
    color: "#333",
    marginLeft: -8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  priceLabel: {
    width: 60,
    fontSize: 14,
    color: "#666",
  },
  priceInput: {
    flex: 1,
    marginRight: 8,
  },
  priceUnit: {
    fontSize: 14,
    color: "#666",
  },
  rowInputs: {
    flexDirection: "row",
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  imageWrapper: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  removeImageButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  mainImageBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(233, 30, 99, 0.9)",
    paddingVertical: 2,
    alignItems: "center",
  },
  mainImageText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  addImageText: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  statusContainer: {
    flexDirection: "row",
    gap: 10,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    alignItems: "center",
  },
  statusButtonActive: {
    borderWidth: 2,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E91E63",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: "#F48FB1",
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#fff",
  },
});
