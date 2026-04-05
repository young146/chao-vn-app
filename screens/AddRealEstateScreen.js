import { StackActions } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import React, { useState, useEffect, useCallback } from "react";
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
} from "react-native";
import { Image } from "expo-image";
import { Picker } from "@react-native-picker/picker";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "../firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { translateCity, translateOther } from "../utils/vietnamLocations";
import { translatePropertyType, translateDealType, translateRealEstateStatus } from "../utils/optionTranslations";

export default function AddRealEstateScreen({ navigation, route }) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation(['realEstate', 'common']);

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
  const [youtubeUrl, setYoutubeUrl] = useState("");

  // 중개인 연결
  const [myAgent, setMyAgent] = useState(null);       // 내 등록된 중개인 프로필
  const [linkedAgent, setLinkedAgent] = useState(null); // 이 매물에 연결할 중개인
  const [agentLoading, setAgentLoading] = useState(false);

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
      setYoutubeUrl(editItem.youtubeUrl || "");
      if (editItem.agentId) {
        // agentSnapshot을 임시로 설정 (useFocusEffect에서 최신 데이터로 덮어씌워짐)
        setLinkedAgent({ id: editItem.agentId, ...(editItem.agentSnapshot || {}) });
        // Agents 컬렉션에서 최신 데이터 직접 조회
        getDoc(doc(db, "Agents", editItem.agentId))
          .then((agentSnap) => {
            if (agentSnap.exists()) {
              setLinkedAgent({ id: agentSnap.id, ...agentSnap.data() });
            } else {
              // 에이전트 삭제됨 → 연결 해제
              setLinkedAgent(null);
            }
          })
          .catch(() => {});
      }
    }
  }, [isEditMode, editItem]);

  // 내 중개인 프로필 조회 — 화면 포커스마다 실행 (중개인 등록/수정 후 돌아올 때 자동 반영)
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      const fetchMyAgent = async () => {
        setAgentLoading(true);
        try {
          const q = query(collection(db, "Agents"), where("userId", "==", user.uid));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const agentData = { id: snap.docs[0].id, ...snap.docs[0].data() };
            setMyAgent(agentData);
            // linkedAgent가 이 에이전트와 같은 id면 최신 데이터로 갱신 (사진 등 동기화)
            setLinkedAgent(prev => {
              if (!prev) return agentData; // 미연결 → 자동 연결
              if (prev.id === agentData.id) return agentData; // 같은 에이전트면 최신 데이터로 교체
              return prev; // 다른 에이전트면 유지
            });
          } else {
            setMyAgent(null);
            // 내 에이전트가 삭제됐으면 연결도 해제
            setLinkedAgent(prev =>
              prev?.userId === user.uid ? null : prev
            );
          }
        } catch (e) {
          console.log("중개인 프로필 없음:", e?.code || e?.message);
          setMyAgent(null);
        } finally {
          setAgentLoading(false);
        }
      };
      fetchMyAgent();
    }, [user])
  );

  // 권한 요청
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t('common:permissionRequired'), t('common:cameraPermission'));
      return false;
    }
    return true;
  };

  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t('common:permissionRequired'), t('common:galleryPermission'));
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
      Alert.alert(t('form.error'), t('common:cameraError'));
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
      Alert.alert(t('form.error'), t('common:photoSelectError'));
    }
  };

  const pickImages = () => {
    if (images.length >= 10) {
      Alert.alert(t('common:notice'), t('common:maxPhotos'));
      return;
    }

    Alert.alert(t('common:selectPhoto'), t('common:selectPhotoMethod'), [
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
      Alert.alert(t('common:notice'), t('form.titleRequired'));
      return false;
    }
    if (title.trim().length < 5) {
      Alert.alert(t('common:notice'), t('form.titleTooShort'));
      return false;
    }
    if (dealType === "임대" && !deposit && !monthlyRent) {
      Alert.alert(t('common:notice'), t('form.rentRequired'));
      return false;
    }
    if (dealType === "매매" && !price) {
      Alert.alert(t('common:notice'), t('form.priceRequired'));
      return false;
    }
    if (!selectedCity) {
      Alert.alert(t('common:notice'), t('form.locationRequired'));
      return false;
    }
    if (images.length === 0) {
      Alert.alert(t('common:notice'), t('form.photoRequired'));
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
        youtubeUrl: youtubeUrl.trim() || null,
        // 중개인 연결
        agentId: linkedAgent?.id || null,
        agentSnapshot: linkedAgent ? {
          name: linkedAgent.name || "",
          company: linkedAgent.company || "",
          phone: linkedAgent.phone || "",
          kakaoId: linkedAgent.kakaoId || "",
          profileImage: linkedAgent.profileImage || null,
          licenseNumber: linkedAgent.licenseNumber || "",
          experienceYears: linkedAgent.experienceYears || 0,
          description: linkedAgent.description || "",
          city: linkedAgent.city || "",
          district: linkedAgent.district || "",
          addressDetail: linkedAgent.addressDetail || "",
        } : null,
      };

      if (isEditMode) {
        // 수정
        console.log("💾 부동산 수정 중... agentId=", itemData.agentId, "agentSnapshot=", JSON.stringify(itemData.agentSnapshot));
        const itemRef = doc(db, "RealEstate", editItem.id);
        await updateDoc(itemRef, {
          ...itemData,
          updatedAt: serverTimestamp(),
        });
        console.log("✅ 부동산 수정 완료! agentSnapshot 저장됨:", !!itemData.agentSnapshot);

        // 캐시 무효화 (수정 후 최신 데이터 표시)
        await AsyncStorage.removeItem("cached_realestate");

        Alert.alert(t('form.success'), t('form.propertyUpdated'), [
          {
            text: "확인",
            onPress: () => {
              // goBack 후 상세 화면이 포커스를 받으면 useFocusEffect가 즉시 재로드함
              navigation.goBack();
            },
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

        Alert.alert(t('form.success'), t('form.propertyRegistered'), [
          {
            text: "확인",
            onPress: () => {
              navigation.dispatch(StackActions.pop(1));
            },
          },
        ]);
      }
    } catch (error) {
      console.error("❌ 부동산 등록/수정 실패:", error);
      console.error("❌ 에러 상세:", error.message);
      Alert.alert(t('form.error'), `${t('form.errorMessage')}\n${error.message}`);
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
              {isEditMode ? t('form.updateButton') : t('addProperty')}
            </Text>
            <Text style={styles.headerSubtitle}>
              {t('subtitle')}
            </Text>
          </View>
        </View>

        {/* 임대/매매 선택 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="swap-horizontal" size={16} /> {t('form.dealTypeLabel')}
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
                  {type === "임대" ? t('rent') : t('sale')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 매물 유형 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="home-outline" size={16} /> {t('form.propertyTypeLabel')}
          </Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={propertyType}
              onValueChange={setPropertyType}
              style={styles.picker}
            >
              {propertyTypes.map((type) => (
                <Picker.Item key={type} label={translatePropertyType(type, i18n.language)} value={type} />
              ))}
            </Picker>
          </View>
        </View>

        {/* 제목 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="create" size={16} /> {t('form.titleLabel')}
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder={t('form.titlePlaceholder')}
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
            <Ionicons name="cash-outline" size={16} /> {dealType === "매매" ? t('form.priceLabel') : t('form.monthlyRentLabel')}
          </Text>

          {dealType === "임대" ? (
            <>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>{t('deposit')}</Text>
                <TextInput
                  style={[styles.textInput, styles.priceInput]}
                  placeholder="예) 1,000만동 / 500 USD / 협의"
                  placeholderTextColor="#999"
                  value={deposit}
                  onChangeText={setDeposit}
                  keyboardType="default"
                />
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>{t('monthlyRent')}</Text>
                <TextInput
                  style={[styles.textInput, styles.priceInput]}
                  placeholder="예) 300만동 / 200 USD / 협의"
                  placeholderTextColor="#999"
                  value={monthlyRent}
                  onChangeText={setMonthlyRent}
                  keyboardType="default"
                />
              </View>
            </>
          ) : (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>{t('form.priceLabel')}</Text>
              <TextInput
                style={[styles.textInput, styles.priceInput]}
                placeholder="예) 30억동 / 15만 USD / 협의"
                placeholderTextColor="#999"
                value={price}
                onChangeText={setPrice}
                keyboardType="default"
              />
            </View>
          )}
        </View>

        {/* 위치 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="location-outline" size={16} /> {t('form.cityLabel')}
          </Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedCity}
              onValueChange={setSelectedCity}
              style={styles.picker}
            >
              {cities.map((city) => (
                <Picker.Item key={city} label={translateCity(city, i18n.language)} value={city} />
              ))}
            </Picker>
          </View>
          <TextInput
            style={[styles.textInput, { marginTop: 8 }]}
            placeholder={t('form.selectDistrict')}
            placeholderTextColor="#999"
            value={selectedDistrict}
            onChangeText={setSelectedDistrict}
          />
        </View>

        {/* 면적/방 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="resize-outline" size={16} /> {t('area')}
          </Text>
          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>{t('form.areaLabel')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={t('form.areaPlaceholder')}
                placeholderTextColor="#999"
                value={area}
                onChangeText={setArea}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>{t('form.floorLabel')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={t('form.floorPlaceholder')}
                placeholderTextColor="#999"
                value={floor}
                onChangeText={setFloor}
              />
            </View>
          </View>
          <TextInput
            style={[styles.textInput, { marginTop: 8 }]}
            placeholder={t('form.roomsPlaceholder')}
            placeholderTextColor="#999"
            value={rooms}
            onChangeText={setRooms}
          />
        </View>

        {/* 입주 가능일 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="calendar-outline" size={16} /> {t('form.availableDateLabel')}
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder={t('form.availableDatePlaceholder')}
            placeholderTextColor="#999"
            value={availableDate}
            onChangeText={setAvailableDate}
          />
        </View>

        {/* 연락처 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="call-outline" size={16} /> {t('form.contactLabel')}
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder={t('form.contactPlaceholder')}
            placeholderTextColor="#999"
            value={contact}
            onChangeText={setContact}
          />
          <Text style={styles.helperText}>
            * {t('common:chatOnlyContact', '비공개를 원하시면 채팅으로만 연락받을 수 있습니다')}
          </Text>
        </View>

        {/* 상세 설명 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="document-text-outline" size={16} /> {t('form.descriptionLabel')}
          </Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder={t('form.descriptionPlaceholder')}
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
            <Ionicons name="images-outline" size={16} /> {t('form.photoSection')} * (10)
          </Text>
          <Text style={styles.helperText}>
            {t('common:firstPhotoMain', '첫 번째 사진이 대표 이미지로 사용됩니다')}
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
                    <Text style={styles.mainImageText}>{t('form.mainPhoto')}</Text>
                  </View>
                )}
              </View>
            ))}
            {images.length < 10 && (
              <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
                <Ionicons name="camera" size={32} color="#999" />
                <Text style={styles.addImageText}>{t('form.addPhoto')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 수정 모드일 때 상태 변경 */}
        {isEditMode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="flag-outline" size={16} /> {t('form.statusLabel')}
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
                    {translateRealEstateStatus(s, i18n.language)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── 중개인 연결 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="shield-checkmark" size={16} color="#E91E63" /> 중개인 프로필 연결
          </Text>

          {agentLoading ? (
            <ActivityIndicator color="#E91E63" />
          ) : myAgent ? (
            linkedAgent ? (
              // ✅ 연결됨 — 이름·회사 + X 버튼
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF8FB", borderWidth: 1.5, borderColor: "#E91E63", borderRadius: 12, padding: 12 }}>
                <Ionicons name="shield-checkmark" size={22} color="#E91E63" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#222" }}>{linkedAgent.name}</Text>
                  <Text style={{ fontSize: 12, color: "#888" }}>{linkedAgent.company || "업체 미등록"}</Text>
                </View>
                <TouchableOpacity onPress={() => setLinkedAgent(null)} style={{ padding: 6 }}>
                  <Ionicons name="close-circle" size={22} color="#ccc" />
                </TouchableOpacity>
              </View>
            ) : (
              // 내 프로필 있음 — + 버튼으로 연결
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 12, color: "#888", lineHeight: 18 }}>
                  아래 <Text style={{ fontWeight: "700", color: "#E91E63" }}>＋ 버튼</Text>을 눌러야 이 매물에 중개인 프로필이 연결됩니다.
                </Text>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FCE4EC", borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: "#E91E63" }}
                  onPress={() => setLinkedAgent(myAgent)}
                >
                  <Ionicons name="person-circle" size={28} color="#E91E63" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#E91E63" }}>{myAgent.name}</Text>
                    <Text style={{ fontSize: 12, color: "#888" }}>{myAgent.company || "업체 미등록"}</Text>
                  </View>
                  <Ionicons name="add-circle" size={28} color="#E91E63" />
                </TouchableOpacity>
              </View>
            )
          ) : (
            // 중개인 프로필 없음 — 등록 안내
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FCE4EC", borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: "#E91E63", borderStyle: "dashed" }}
              onPress={() => navigation.navigate("중개인 등록")}
            >
              <Ionicons name="add-circle-outline" size={24} color="#E91E63" />
              <View>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#E91E63" }}>중개인 프로필 등록하기</Text>
                <Text style={{ fontSize: 11, color: "#888", marginTop: 2 }}>등록 후 ＋ 버튼으로 연결할 수 있습니다</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* YouTube 소개 영상 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="logo-youtube" size={16} color="#FF0000" /> 매물 소개 영상 (YouTube)
          </Text>
          <Text style={[styles.helperText, { marginBottom: 8 }]}>
            매물을 소개하는 유튜브 영상 링크를 입력하세요
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="https://youtu.be/xxxxx 또는 youtube.com/watch?v=xxxxx"
            placeholderTextColor="#999"
            value={youtubeUrl}
            onChangeText={setYoutubeUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

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
                {isEditMode ? t('form.updateButton') : t('form.submitButton')}
              </Text>
            </>
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
    height: Platform.OS === "ios" ? 120 : 56,
    justifyContent: "center",
  },
  picker: {
    height: Platform.OS === "ios" ? 120 : 56,
    marginLeft: Platform.OS === "ios" ? 0 : -8,
    color: "#333",
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
