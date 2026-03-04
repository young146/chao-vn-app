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
  Alert,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import { Image } from "expo-image";
import { Picker } from "@react-native-picker/picker";
import { useTranslation } from "react-i18next";
import {
  VIETNAM_LOCATIONS,
  CITIES,
  getDistrictsByCity,
  getApartmentsByDistrict,
  translateCity,
  translateOther,
} from "../utils/vietnamLocations";
import { useAuth } from "../contexts/AuthContext";
import { getColors } from "../utils/colors";
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
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AddItemScreen({ navigation, route }) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation(['danggn', 'common']);
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);

  const editItem = route?.params?.item;
  const isEditMode = !!editItem;

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("전자제품");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedApartment, setSelectedApartment] = useState("");
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("판매중");
  const [condition, setCondition] = useState("");

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
      setCondition(editItem.condition || "");

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
      Alert.alert(t('form.permissionRequired'), t('form.cameraPermission'));
      return false;
    }
    return true;
  };

  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t('form.permissionRequired'), t('form.galleryPermission'));
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
      Alert.alert(t('form.error'), t('common:cameraError', '사진 촬영에 실패했습니다.'));
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
        selectionLimit: 10 - images.length,
      });

      if (!result.canceled) {
        const newImages = result.assets.map((asset) => asset.uri);
        setImages([...images, ...newImages].slice(0, 10));
      }
    } catch (error) {
      Alert.alert(t('form.error'), t('common:photoSelectError', '사진을 선택할 수 없습니다.'));
    }
  };

  const pickImages = () => {
    if (images.length >= 10) {
      Alert.alert(t('common:notice'), t('common:maxPhotos', '사진은 최대 10장까지 등록할 수 있습니다.'));
      return;
    }

    Alert.alert(t('common:selectPhoto', '사진 선택'), t('common:selectPhotoMethod', '사진을 추가할 방법을 선택하세요'), [
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

  const resizeImage = async (uri) => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }], // 가로 800px로 대폭 축소 (원본 업로드 부하 방지)
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG } // 품질 0.7로 최적화
      );
      return manipResult.uri;
    } catch (error) {
      console.error("이미지 리사이징 실패:", error);
      return uri; // 실패 시 원본 반환
    }
  };

  const uploadImageToStorage = async (uri) => {
    try {
      if (uri.startsWith("https://")) {
        return uri;
      }

      // 🔥 업로드 전 휴대폰에서 1차 리사이징 및 압축 강제 실행 (가로 800px)
      const resizedUri = await resizeImage(uri);
      const response = await fetch(resizedUri);
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

  // 가격 입력 핸들러
  const handlePriceChange = (text) => {
    setPrice(text);
  };

  const handleSubmit = async () => {
    if (!title || !price || !description || !selectedApartment) {
      Alert.alert(t('form.requiredFields'), t('form.fillRequiredFields'));
      return;
    }

    if (!phone && !kakaoId && !otherContact) {
      Alert.alert(t('common:notice'), t('common:contactRequired', '연락처를 최소 하나 이상 입력해주세요!'));
      return;
    }

    if (!user) {
      Alert.alert(t('common:notice'), t('common:loginRequired'));
      return;
    }

    setUploading(true);

    try {
      console.log("📤 이미지 업로드 시작...");
      const uploadedImageUrls = [];

      for (let i = 0; i < images.length; i++) {
        // 이미 업로드된 이미지(https://)는 재업로드 없이 그대로 사용
        if (images[i].startsWith("https://")) {
          uploadedImageUrls.push(images[i]);
          console.log(`⏭️ 이미지 ${i + 1} 건너뜀 (이미 업로드됨)`);
          continue;
        }

        console.log(`📷 이미지 ${i + 1}/${images.length} 처리 중...`);
        const resizedUri = await resizeImage(images[i]);
        const url = await uploadImageToStorage(resizedUri);
        uploadedImageUrls.push(url);
        console.log(`✅ 이미지 ${i + 1} 완료`);
      }

      console.log("✅ 모든 이미지 처리 완료!");

      const itemData = {
        title,
        price,
        description,
        category,
        location: `${selectedCity} ${selectedDistrict} ${selectedApartment}`,
        city: selectedCity,
        district: selectedDistrict,
        apartment: selectedApartment,
        images: uploadedImageUrls,
        condition,
        contact: {
          phone: phone || "",
          kakaoId: kakaoId || "",
          other: otherContact || "",
        },
      };

      let resultItem;

      if (isEditMode) {
        const oldPrice = editItem.price;
        const newPrice = price;
        let newStatus = editItem.status || "판매중";

        if (newPrice !== oldPrice) {
          newStatus = "가격 조정됨";
          console.log("💸 가격 변경 감지! 상태를 '가격 조정됨'으로 변경");
        }

        console.log("💾 당근/나눔 수정 중...");
        const itemRef = doc(db, "XinChaoDanggn", editItem.id);
        await updateDoc(itemRef, {
          ...itemData,
          status: newStatus,
        });

        if (newPrice !== oldPrice) {
          console.log("💸 가격 변경 감지! 알림 생성 시작...");
          await notifyPriceChange(editItem.id, oldPrice, newPrice);
        }

        resultItem = {
          ...editItem,
          ...itemData,
          status: newStatus,
          // createdAt을 문자열로 변환
          createdAt:
            editItem.createdAt?.toDate?.()?.toISOString() || editItem.createdAt,
        };

        console.log("✅ 당근/나눔 수정 완료!");

        setUploading(false);

        Alert.alert(t('form.success'), t('form.itemUpdated'), [
          {
            text: "확인",
            onPress: () => {
              // 스택 리셋: 당근/나눔 메인 → 당근/나눔 상세
              navigation.reset({
                index: 1,
                routes: [
                  { name: "당근/나눔 메인" },
                  { name: "당근/나눔 상세", params: { item: resultItem } },
                ],
              });
            },
          },
        ]);
      } else {
        // 새 당근/나눔 등록
        console.log("💾 당근/나눔 등록 중...");
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
          price
        );

        // 🆕 주변 사용자에게 알림
        await notifyNearbyUsers(
          docRef.id,
          title,
          uploadedImageUrls[0] || "",
          price,
          selectedCity,
          selectedDistrict,
          selectedApartment
        );

        resultItem = {
          id: docRef.id,
          ...itemData,
          userId: user.uid,
          userEmail: user.email,
          createdAt: new Date().toISOString(),
          status: "판매중",
        };

        console.log("✅ 당근/나눔 등록 완료! ID:", docRef.id);

        setUploading(false);

        Alert.alert(t('form.success'), t('form.itemRegistered'), [
          {
            text: "확인",
            onPress: () => {
              navigation.navigate("당근/나눔 상세", { item: resultItem });
            },
          },
        ]);
      }
    } catch (error) {
      console.error("❌ 작업 실패:", error);
      console.error("❌ 에러 상세:", error.message);

      setUploading(false);

      Alert.alert(
        t('form.error'),
        `${t('form.errorMessage')}\n\n${error.message}`
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
            {t('form.photoSection')} ({images.length}/10)
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.imageScroll}
          >
            {images.length < 10 && (
              <TouchableOpacity
                style={styles.addImageButton}
                onPress={pickImages}
              >
                <Ionicons name="camera" size={40} color="#999" />
                <Text style={styles.addImageText}>{t('form.addPhoto')}</Text>
              </TouchableOpacity>
            )}

            {images.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image
                  source={{ uri }}
                  style={styles.imagePreview}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </TouchableOpacity>
                {index === 0 && (
                  <View style={styles.mainBadge}>
                    <Text style={styles.mainBadgeText}>{t('form.mainPhoto')}</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>

        <Text style={styles.label}>{t('form.titleLabel')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('form.titlePlaceholder')}
          placeholderTextColor="rgba(0, 0, 0, 0.38)"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>{t('form.priceLabel')}</Text>
        <TextInput
          style={styles.input}
          placeholder="예) 500만동, 100달러, 협의"
          placeholderTextColor="rgba(0, 0, 0, 0.38)"
          value={price}
          onChangeText={handlePriceChange}
        />

        <Text style={styles.label}>{t('form.categoryLabel')}</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={category}
            onValueChange={setCategory}
            style={styles.picker}
          >
            <Picker.Item label={t('categories.free')} value="무료나눔" />
            <Picker.Item label={`🔍 ${t('categories.hiring')}`} value="구인" />
            <Picker.Item label={`💼 ${t('categories.seeking')}`} value="구직" />
            <Picker.Item label={`🏠 ${t('categories.rentProperty')}`} value="부동산 임대" />
            <Picker.Item label={`🏡 ${t('categories.sellProperty')}`} value="부동산 판매" />
            <Picker.Item label={t('categories.electronics')} value="전자제품" />
            <Picker.Item label={t('categories.furniture')} value="가구/인테리어" />
            <Picker.Item label={t('categories.clothing')} value="의류/잡화" />
            <Picker.Item label={t('categories.household')} value="생활용품" />
            <Picker.Item label={t('categories.books')} value="도서/문구" />
            <Picker.Item label={t('categories.baby')} value="유아용품" />
            <Picker.Item label={t('categories.pet')} value="펫 용품" />
            <Picker.Item label={t('categories.other')} value="기타" />
          </Picker>
        </View>

        <Text style={styles.label}>{t('form.cityLabel')}</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedCity}
            onValueChange={(value) => {
              setSelectedCity(value);
              setSelectedDistrict("");
              setSelectedApartment("");
            }}
            style={styles.picker}
          >
            <Picker.Item label={t('form.selectCity')} value="" />
            {CITIES.map((city) => (
              <Picker.Item key={city} label={translateCity(city, i18n.language)} value={city} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>{t('form.districtLabel')}</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedDistrict}
            onValueChange={(value) => {
              setSelectedDistrict(value);
              setSelectedApartment("");
            }}
            style={styles.picker}
          >
            <Picker.Item label={t('form.selectDistrict')} value="" />
            {districts.map((district) => (
              <Picker.Item key={district} label={translateOther(district, i18n.language)} value={district} />
            ))}
          </Picker>
        </View>

        {apartments.length > 0 && (
          <>
            <Text style={styles.label}>{t('form.apartmentLabel')} *</Text>
            <Text style={styles.helperText}>💡 {t('common:apartmentNotice', '아파트명을 선택하면 같은 아파트 주민에게 알림이 갑니다!')}</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedApartment}
                onValueChange={setSelectedApartment}
                style={styles.picker}
              >
                <Picker.Item label={`🏠 ${t('form.selectApartment')}`} value="" />
                {apartments.map((apartment) => (
                  <Picker.Item
                    key={apartment}
                    label={translateOther(apartment, i18n.language)}
                    value={apartment}
                  />
                ))}
              </Picker>
            </View>
          </>
        )}

        <Text style={styles.label}>{t('form.descriptionLabel')} *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={t('form.descriptionPlaceholder')}
          placeholderTextColor="rgba(0, 0, 0, 0.38)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>
            📞 {t('form.contactLabel')} *
          </Text>

          <Text style={styles.label}>{t('form.phonePlaceholder')}</Text>
          <TextInput
            style={styles.input}
            placeholder="010-1234-5678 / +84-123-456-789"
            placeholderTextColor="rgba(0, 0, 0, 0.38)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>{t('form.kakaoPlaceholder')}</Text>
          <TextInput
            style={styles.input}
            placeholder="kakao_id123"
            placeholderTextColor="rgba(0, 0, 0, 0.38)"
            value={kakaoId}
            onChangeText={setKakaoId}
          />

          <Text style={styles.label}>{t('form.otherContactPlaceholder')}</Text>
          <TextInput
            style={styles.input}
            placeholder="Zalo: 0123456789"
            placeholderTextColor="rgba(0, 0, 0, 0.38)"
            value={otherContact}
            onChangeText={setOtherContact}
          />
        </View>

        {/* 물품 컨디션 */}
        <Text style={styles.label}>✨ 물품 컨디션</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={condition}
            onValueChange={setCondition}
            style={styles.picker}
          >
            <Picker.Item label="선택 안 함" value="" />
            <Picker.Item label="신품" value="신품" />
            <Picker.Item label="A급 (거의 새것)" value="A급" />
            <Picker.Item label="B급 (사용감 있음)" value="B급" />
            <Picker.Item label="C급 (많이 사용)" value="C급" />
            <Picker.Item label="D급 (고장/파손)" value="D급" />
          </Picker>
        </View>

        <TouchableOpacity
          style={[styles.button, uploading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={uploading}
        >
          {uploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.buttonText}> {t('form.uploading')}</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>
              {isEditMode ? t('form.updateButton') : t('form.submitButton')}
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
  helperText: {
    fontSize: 13,
    color: "#FF6B35",
    marginBottom: 8,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: "#fff",
    color: "#000", // ✅ 다크모드 대응: 텍스트 색상 명시
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  pickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    height: Platform.OS === "ios" ? 120 : 56,
  },
  picker: {
    flex: 1,
    height: Platform.OS === "ios" ? 120 : 56,
    fontSize: 16,
    color: "#333",
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
