import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchBusinessById,
  createBusiness,
  updateBusiness,
  uploadBusinessImages,
} from '../services/neighborBusinessService';
import {
  CITIES,
  getDistrictsByCity,
  translateCity,
  translateOther,
} from '../utils/vietnamLocations';

/**
 * 이웃사업 등록/수정 화면 (관리자 전용)
 * route.params.editId?: 수정 시 기존 문서 ID
 *
 * 관련 문서: directives/NEIGHBOR_BUSINESSES_PLAN.md
 */

const CATEGORIES = [
  { key: 'food', label: '음식점' },
  { key: 'service', label: '서비스' },
  { key: 'shopping', label: '쇼핑' },
  { key: 'lodging', label: '숙박' },
  { key: 'beauty', label: '미용' },
  { key: 'health', label: '병원/약국' },
  { key: 'education', label: '교육' },
  { key: 'other', label: '기타' },
];

const MAX_IMAGES = 10;

export default function AddNeighborBusinessScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const editId = route.params?.editId;
  const isEditing = !!editId;

  const auth = useAuth() || {};
  const userIsAdmin = typeof auth.isAdmin === 'function' ? auth.isAdmin() : !!auth.isAdmin;

  // 폼 상태
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('food');

  const [city, setCity] = useState(CITIES[0] || '호치민');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');

  const [phone, setPhone] = useState('');
  const [kakaoId, setKakaoId] = useState('');
  const [kakaoOpenChat, setKakaoOpenChat] = useState('');
  const [zalo, setZalo] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');

  const [holidayNote, setHolidayNote] = useState('');
  const [tagsText, setTagsText] = useState('');

  const [images, setImages] = useState([]); // uri array (local or https)
  const [thumbnailIndex, setThumbnailIndex] = useState(0);

  const [externalLink, setExternalLink] = useState('');

  const [priority, setPriority] = useState('10');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [active, setActive] = useState(true);

  const [loadingInitial, setLoadingInitial] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  const districtOptions = useMemo(() => getDistrictsByCity(city), [city]);

  // 권한 체크
  useEffect(() => {
    if (!userIsAdmin) {
      Alert.alert('권한 없음', '관리자만 등록할 수 있습니다.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    }
  }, [userIsAdmin, navigation]);

  // 수정 시 기존 데이터 로드
  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      const b = await fetchBusinessById(editId);
      if (b) {
        setName(b.name || '');
        setDescription(b.description || '');
        setCategory(b.category || 'food');
        setCity(b.city || CITIES[0]);
        setDistrict(b.district || '');
        setAddress(b.address || '');
        setPhone(b.contacts?.phone || '');
        setKakaoId(b.contacts?.kakaoId || '');
        setKakaoOpenChat(b.contacts?.kakaoOpenChat || '');
        setZalo(b.contacts?.zalo || '');
        setEmail(b.contacts?.email || '');
        setWebsite(b.contacts?.website || '');
        setHolidayNote(b.holidayNote || '');
        setTagsText((b.tags || []).join(', '));
        setImages(b.images || []);
        setThumbnailIndex(b.thumbnailIndex || 0);
        setExternalLink(b.externalLink || '');
        setPriority(String(b.priority ?? 10));
        setStartDate(b.startDate || '');
        setEndDate(b.endDate || '');
        setActive(b.active !== false);
      }
      setLoadingInitial(false);
    })();
  }, [editId, isEditing]);

  // ====== 이미지 ======

  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 접근 권한이 필요합니다.');
      return false;
    }
    return true;
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.');
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    if (!(await requestCameraPermission())) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, result.assets[0].uri].slice(0, MAX_IMAGES));
    }
  };

  const pickFromGallery = async () => {
    if (!(await requestGalleryPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: MAX_IMAGES - images.length,
    });
    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...uris].slice(0, MAX_IMAGES));
    }
  };

  const addImage = () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('안내', `이미지는 최대 ${MAX_IMAGES}장까지 등록할 수 있습니다.`);
      return;
    }
    Alert.alert('사진 추가', '추가 방법을 선택하세요', [
      { text: '📷 카메라', onPress: takePhoto },
      { text: '🖼️ 갤러리', onPress: pickFromGallery },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (thumbnailIndex >= index) {
      setThumbnailIndex((t) => Math.max(0, t - (index === t ? 0 : 1)));
    }
  };

  // ====== 저장 ======

  const validate = () => {
    if (!name.trim()) return '업소명을 입력하세요.';
    if (!description.trim() || description.trim().length < 10) {
      return '설명을 10자 이상 입력하세요.';
    }
    if (!city) return '도시를 선택하세요.';
    // 연락 수단 하나는 있어야 의미가 있음
    if (!phone.trim() && !kakaoId.trim() && !kakaoOpenChat.trim() &&
        !zalo.trim() && !email.trim() && !website.trim()) {
      return '연락처를 하나 이상 입력하세요.';
    }
    if (images.length === 0) return '이미지를 1장 이상 등록하세요.';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      Alert.alert('입력 확인', err);
      return;
    }
    setSaving(true);
    try {
      // 이미지 업로드 (이미 https URL은 uploadBusinessImage 내부에서 건너뜀)
      const tempId = editId || `new_${Date.now()}`;
      const uploadedUrls = await uploadBusinessImages(images, tempId);

      const payload = {
        name: name.trim(),
        description: description.trim(),
        category,
        city,
        district: district || '',
        address: address.trim(),
        contacts: {
          phone: phone.trim() || null,
          kakaoId: kakaoId.trim() || null,
          kakaoOpenChat: kakaoOpenChat.trim() || null,
          zalo: zalo.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,
        },
        holidayNote: holidayNote.trim() || '',
        tags: tagsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10),
        images: uploadedUrls,
        thumbnailIndex: Math.min(thumbnailIndex, uploadedUrls.length - 1),
        externalLink: externalLink.trim() || null,
        active,
        priority: parseInt(priority, 10) || 10,
        startDate: startDate || null,
        endDate: endDate || null,
        approvalStatus: 'approved',
      };

      if (isEditing) {
        await updateBusiness(editId, payload);
      } else {
        await createBusiness(payload, auth.user?.uid || 'admin');
      }

      Alert.alert('저장됨', isEditing ? '수정되었습니다.' : '등록되었습니다.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('오류', e?.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitial) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      </View>
    );
  }

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
        {/* 이미지 섹션 */}
        <View style={styles.imageSection}>
          <Text style={styles.imageSectionTitle}>
            사진 등록 ({images.length}/{MAX_IMAGES}) *
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.imageScroll}
          >
            {images.length < MAX_IMAGES && (
              <TouchableOpacity
                style={styles.addImageButton}
                onPress={addImage}
              >
                <Ionicons name="camera" size={40} color="#999" />
                <Text style={styles.addImageText}>사진 추가</Text>
              </TouchableOpacity>
            )}

            {images.map((uri, i) => (
              <View key={i} style={styles.imageWrapper}>
                <Image
                  source={{ uri }}
                  style={styles.imagePreview}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeImage(i)}
                >
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </TouchableOpacity>
                {i === thumbnailIndex && (
                  <View style={styles.mainBadge}>
                    <Text style={styles.mainBadgeText}>대표</Text>
                  </View>
                )}
                {i !== thumbnailIndex && (
                  <TouchableOpacity
                    style={styles.thumbSetBtn}
                    onPress={() => setThumbnailIndex(i)}
                  >
                    <Text style={styles.thumbSetText}>대표 설정</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        </View>

        <Text style={styles.label}>업소명 *</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 김치찌개 맛집 할매네"
          placeholderTextColor="rgba(0, 0, 0, 0.38)"
          value={name}
          onChangeText={setName}
          maxLength={50}
        />

        <Text style={styles.label}>설명 *</Text>
        <Text style={styles.helperText}>💡 200자 이상 작성을 권장합니다.</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="업소 소개, 주요 메뉴/서비스, 특장점, 영업시간 등을 자세히 작성하세요"
          placeholderTextColor="rgba(0, 0, 0, 0.38)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{description.length}자</Text>

        <Text style={styles.label}>카테고리</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={category}
            onValueChange={setCategory}
            style={styles.picker}
          >
            {CATEGORIES.map((c) => (
              <Picker.Item key={c.key} label={c.label} value={c.key} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>지역 (도시) *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={city}
            onValueChange={(v) => { setCity(v); setDistrict(''); }}
            style={styles.picker}
          >
            {CITIES.map((c) => (
              <Picker.Item key={c} label={translateCity(c)} value={c} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>세부 지역 (구/군) *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={district}
            onValueChange={setDistrict}
            style={styles.picker}
          >
            <Picker.Item label="구/군 선택" value="" />
            {districtOptions.map((d) => (
              <Picker.Item key={d} label={translateOther(d)} value={d} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>상세 주소 및 건물명</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 123 Đường Nguyễn Huệ, Quận 1 (랜드마크 빌딩 1층)"
          placeholderTextColor="rgba(0, 0, 0, 0.38)"
          value={address}
          onChangeText={setAddress}
        />

        {/* 연락처 섹션 */}
        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>📞 연락처 정보 * (하나 이상 필수)</Text>

          <Text style={styles.subLabel}>전화번호</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 010-1234-5678 / +84-90-123-4567"
            placeholderTextColor="rgba(0, 0, 0, 0.38)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.subLabel}>카카오톡 ID</Text>
          <TextInput
            style={styles.input}
            placeholder="예: kakao_id123"
            placeholderTextColor="rgba(0, 0, 0, 0.38)"
            value={kakaoId}
            onChangeText={setKakaoId}
            autoCapitalize="none"
          />

          <Text style={styles.subLabel}>카카오 오픈채팅 URL</Text>
          <TextInput
            style={styles.input}
            placeholder="예: https://open.kakao.com/o/..."
            placeholderTextColor="rgba(0, 0, 0, 0.38)"
            value={kakaoOpenChat}
            onChangeText={setKakaoOpenChat}
            autoCapitalize="none"
            keyboardType="url"
          />

          <Text style={styles.subLabel}>Zalo (전화번호 또는 링크)</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 0901234567 또는 https://zalo.me/..."
            placeholderTextColor="rgba(0, 0, 0, 0.38)"
            value={zalo}
            onChangeText={setZalo}
            autoCapitalize="none"
          />

          <Text style={styles.subLabel}>이메일</Text>
          <TextInput
            style={styles.input}
            placeholder="예: contact@chaovietnam.co.kr"
            placeholderTextColor="rgba(0, 0, 0, 0.38)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.label}>부가 정보 및 영업시간</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 매일 10:00-22:00, 매월 첫째주 일요일 휴무"
          placeholderTextColor="rgba(0, 0, 0, 0.38)"
          value={holidayNote}
          onChangeText={setHolidayNote}
        />

        <Text style={styles.label}>태그 (키워드 검색용)</Text>
        <Text style={styles.helperText}>💡 쉼표(,)로 띄어쓰기 없이 구분하여 입력하세요.</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 한식,김치찌개,배달가능"
          placeholderTextColor="rgba(0, 0, 0, 0.38)"
          value={tagsText}
          onChangeText={setTagsText}
          autoCapitalize="none"
        />

        <Text style={styles.label}>외부 웹사이트 (홈페이지/SNS)</Text>
        <TextInput
          style={styles.input}
          placeholder="예: https://www.chaovietnam.co.kr"
          placeholderTextColor="rgba(0, 0, 0, 0.38)"
          value={website}
          onChangeText={setWebsite}
          autoCapitalize="none"
          keyboardType="url"
        />
        
        <Text style={styles.label}>추가 안내 링크 (블로그 등)</Text>
        <TextInput
          style={styles.input}
          placeholder="예: https://blog.naver.com/..."
          placeholderTextColor="rgba(0, 0, 0, 0.38)"
          value={externalLink}
          onChangeText={setExternalLink}
          autoCapitalize="none"
          keyboardType="url"
        />

        {/* (관리자 추가 항목 - 일반 유저가 보아도 무방하지만 가시성 좋게 배포) */}
        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>⚙️ 노출 설정</Text>
          <View style={styles.row}>
            <Text style={styles.inlineLabel}>활성화 상태</Text>
            <Switch value={active} onValueChange={setActive} />
          </View>
          <Text style={styles.subLabel}>우선순위 노출 (숫자가 작을수록 우선 노출)</Text>
          <TextInput
            style={styles.input}
            value={priority}
            onChangeText={setPriority}
            keyboardType="number-pad"
            placeholder="기본값: 10"
            placeholderTextColor="rgba(0, 0, 0, 0.38)"
          />
          <Text style={styles.subLabel}>노출 시작일</Text>
          <TextInput
            style={styles.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD (선택)"
            placeholderTextColor="rgba(0, 0, 0, 0.38)"
          />
          <Text style={styles.subLabel}>노출 종료일</Text>
          <TextInput
            style={styles.input}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD (선택)"
            placeholderTextColor="rgba(0, 0, 0, 0.38)"
          />
        </View>

        {/* 저장 버튼 */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>
              {isEditing ? '이웃사업 수정 완료' : '이웃사업 등록하기'}
            </Text>
          )}
        </TouchableOpacity>
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
    paddingBottom: 60,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginTop: 20,
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#444",
    marginTop: 12,
    marginBottom: 6,
  },
  helperText: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: "#fff",
    color: "#000",
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  charCount: {
    textAlign: "right",
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  picker: {
    height: 50,
    color: "#000",
  },
  contactSection: {
    marginTop: 24,
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 12,
  },
  inlineLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#444",
  },

  // 이미지 섹션
  imageSection: {
    marginBottom: 10,
  },
  imageSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  imageScroll: {
    flexDirection: "row",
  },
  addImageButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    backgroundColor: "#fafafa",
  },
  addImageText: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  imageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 10,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
  },
  mainBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#7C3AED",
    paddingVertical: 4,
    alignItems: "center",
  },
  mainBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  thumbSetBtn: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 4,
    alignItems: "center",
  },
  thumbSetText: {
    color: "#fff",
    fontSize: 10,
  },

  saveBtn: {
    backgroundColor: "#7C3AED",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 32,
    marginBottom: 40,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
