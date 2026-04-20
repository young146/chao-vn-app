import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Linking,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchBusinessById,
  incrementViews,
  incrementClick,
  deleteBusiness,
} from '../services/neighborBusinessService';
import { translateCity } from '../utils/vietnamLocations';
import LocationMap from '../components/LocationMap';
import YouTubeCard from '../components/YouTubeCard';
import { shareItem } from '../utils/deepLinkUtils';

const { width: SCREEN_W } = Dimensions.get('window');
const IMG_HEIGHT = Math.round(SCREEN_W * 0.75);

// 캐로셀 아이템 (사진 또는 비디오)
function MediaCarouselItem({ uri, isVideo, width, height }) {
  if (!isVideo) {
    return (
      <Image
        source={{ uri }}
        style={{ width, height }}
        contentFit="cover"
      />
    );
  }
  return (
    <Video
      source={{ uri }}
      style={{ width, height, backgroundColor: '#000' }}
      useNativeControls
      resizeMode={ResizeMode.CONTAIN}
      shouldPlay={false}
      isLooping={false}
    />
  );
}

const CATEGORY_LABELS = {
  food: '음식점',
  service: '서비스',
  shopping: '쇼핑',
  lodging: '숙박',
  beauty: '미용',
  health: '병원/약국',
  education: '교육',
  other: '기타',
};

const DAY_LABELS = {
  mon: '월', tue: '화', wed: '수', thu: '목',
  fri: '금', sat: '토', sun: '일',
};

/**
 * 이웃사업 상세 화면
 * route.params.id: 문서 ID
 */
export default function NeighborBusinessDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const id = route.params?.id;

  const auth = useAuth() || {};
  const userIsAdmin = typeof auth.isAdmin === 'function' ? auth.isAdmin() : !!auth.isAdmin;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const b = await fetchBusinessById(id);
    setData(b);
    setLoading(false);
    if (b) incrementViews(id);
  }, [id]);

  // 화면에 포커스될 때마다 재조회 (편집 후 돌아왔을 때 최신 데이터 반영)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const trackAndOpen = useCallback(
    async (type, url, fallbackMsg) => {
      try {
        if (!url) return;
        incrementClick(id, type);
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          Linking.openURL(url);
        } else if (fallbackMsg) {
          Alert.alert('안내', fallbackMsg);
        }
      } catch (err) {
        if (fallbackMsg) Alert.alert('안내', fallbackMsg);
      }
    },
    [id]
  );

  const handlePhone = (phone) => {
    const clean = phone.replace(/[^0-9+]/g, '');
    trackAndOpen('contact_phone', `tel:${clean}`, `전화: ${phone}`);
  };

  const handleKakaoId = (kakaoId) => {
    Alert.alert(
      '카카오톡',
      `ID: ${kakaoId}\n\n카카오톡 앱에서 이 ID를 검색하세요.`,
      [{ text: '확인', onPress: () => incrementClick(id, 'contact_kakao') }]
    );
  };

  const handleKakaoOpenChat = (url) => {
    trackAndOpen('contact_kakao', url, '오픈채팅 링크를 열 수 없습니다');
  };

  const handleZalo = (zalo) => {
    // zalo가 URL이면 그대로 열고, 전화번호면 tel:
    const isUrl = /^https?:\/\//.test(zalo);
    const url = isUrl ? zalo : `tel:${zalo.replace(/[^0-9+]/g, '')}`;
    trackAndOpen('contact_phone', url, `Zalo: ${zalo}`);
  };

  const handleEmail = (email) => {
    trackAndOpen('contact_email', `mailto:${email}`, email);
  };

  const handleWebsite = (url) => {
    trackAndOpen('contact_website', url, url);
  };

  const handleExternalLink = (url) => {
    trackAndOpen('external_link', url, url);
  };

  const handleShare = async () => {
    try {
      // 공유 URL: chaovietnam.co.kr/app/share/neighbor/{id} — WordPress 랜딩이 앱/웹 분기 처리
      await shareItem('neighbor', id, data, 'more');
    } catch (e) {
      console.warn('share failed', e);
    }
  };

  const handleEdit = () => {
    navigation.navigate('이웃사업 등록', { editId: id });
  };

  const handleDelete = () => {
    Alert.alert(
      '삭제 확인',
      `"${data.name}"을(를) 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBusiness(id);
              Alert.alert('삭제됨', '업소가 삭제되었습니다.');
              navigation.goBack();
            } catch (err) {
              Alert.alert('오류', err?.message || '삭제에 실패했습니다.');
            }
          },
        },
      ]
    );
  };

  // ======= 렌더링 =======

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={48} color="#CCC" />
          <Text style={styles.emptyText}>업소를 찾을 수 없습니다</Text>
        </View>
      </SafeAreaView>
    );
  }

  const catLabel = CATEGORY_LABELS[data.category] || '';
  const contacts = data.contacts || {};

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* 이미지 슬라이더 */}
        {data.images?.length > 0 ? (
          <View>
            <FlatList
              data={data.images}
              keyExtractor={(_, i) => String(i)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                setCurrentImageIndex(idx);
              }}
              renderItem={({ item, index }) => {
                const isVideo = (data.mediaTypes || [])[index] === 'video';
                return (
                  <MediaCarouselItem
                    uri={item}
                    isVideo={isVideo}
                    width={SCREEN_W}
                    height={IMG_HEIGHT}
                  />
                );
              }}
            />
            {data.images.length > 1 && (
              <View style={styles.pageIndicator}>
                <Text style={styles.pageIndicatorText}>
                  {currentImageIndex + 1} / {data.images.length}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.imgPlaceholder, { height: IMG_HEIGHT }]}>
            <Ionicons name="storefront-outline" size={64} color="#CCC" />
          </View>
        )}

        {/* 본문 */}
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{data.name}</Text>
            {catLabel ? (
              <View style={styles.catBadge}>
                <Text style={styles.catBadgeText}>{catLabel}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color="#888" />
            <Text style={styles.locationText}>
              {translateCity(data.city || '')}
              {data.district ? ` · ${data.district}` : ''}
            </Text>
          </View>

          {data.address ? (
            <Text style={styles.address}>{data.address}</Text>
          ) : null}

          {/* 설명 */}
          {data.description ? (
            <>
              <View style={styles.sectionDivider} />
              <Text style={styles.sectionTitle}>소개</Text>
              <Text style={styles.description}>{data.description}</Text>
            </>
          ) : null}

          {/* YouTube 소개 영상 */}
          {data.youtubeUrl ? (
            <YouTubeCard
              youtubeUrl={data.youtubeUrl}
              label="📹 소개 영상"
            />
          ) : null}

          {/* 태그 */}
          {data.tags?.length > 0 ? (
            <View style={styles.tagRow}>
              {data.tags.map((t, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>#{t}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* 영업시간 */}
          {(data.businessHours || data.holidayNote) ? (
            <>
              <View style={styles.sectionDivider} />
              <Text style={styles.sectionTitle}>영업시간</Text>
              {data.businessHours ? (
                <View style={styles.hoursWrap}>
                  {Object.keys(DAY_LABELS).map((day) => {
                    const hours = data.businessHours[day];
                    if (!hours) return null;
                    return (
                      <View key={day} style={styles.hoursRow}>
                        <Text style={styles.hoursDay}>{DAY_LABELS[day]}</Text>
                        <Text style={styles.hoursTime}>{hours}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
              {data.holidayNote ? (
                <Text style={styles.holidayNote}>{data.holidayNote}</Text>
              ) : null}
            </>
          ) : null}

          {/* 지도 */}
          {data.city ? (
            <>
              <View style={styles.sectionDivider} />
              <Text style={styles.sectionTitle}>위치</Text>
              <View style={styles.mapWrap}>
                <LocationMap
                  city={data.city}
                  district={data.district}
                  label={data.name}
                />
              </View>
            </>
          ) : null}

          {/* 외부 링크 (있으면) */}
          {data.externalLink ? (
            <TouchableOpacity
              style={styles.externalLinkBtn}
              onPress={() => handleExternalLink(data.externalLink)}
              activeOpacity={0.7}
            >
              <Ionicons name="open-outline" size={16} color="#1976D2" />
              <Text style={styles.externalLinkText}>상세 보기 (외부 링크)</Text>
            </TouchableOpacity>
          ) : null}

          {/* 연락처 */}
          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>연락처</Text>
          <View style={styles.contactWrap}>
            {contacts.phone ? (
              <ContactButton
                icon="call"
                label="전화"
                value={contacts.phone}
                color="#2E7D32"
                onPress={() => handlePhone(contacts.phone)}
              />
            ) : null}
            {contacts.kakaoId ? (
              <ContactButton
                icon="chatbubble"
                label="카카오 ID"
                value={contacts.kakaoId}
                color="#FEE500"
                onPress={() => handleKakaoId(contacts.kakaoId)}
              />
            ) : null}
            {contacts.kakaoOpenChat ? (
              <ContactButton
                icon="chatbubbles"
                label="오픈채팅"
                value="열기"
                color="#FEE500"
                onPress={() => handleKakaoOpenChat(contacts.kakaoOpenChat)}
              />
            ) : null}
            {contacts.zalo ? (
              <ContactButton
                icon="logo-whatsapp"
                label="Zalo"
                value={contacts.zalo}
                color="#0068FF"
                onPress={() => handleZalo(contacts.zalo)}
              />
            ) : null}
            {contacts.email ? (
              <ContactButton
                icon="mail"
                label="이메일"
                value={contacts.email}
                color="#1565C0"
                onPress={() => handleEmail(contacts.email)}
              />
            ) : null}
            {contacts.website ? (
              <ContactButton
                icon="globe"
                label="웹사이트"
                value="방문"
                color="#6A1B9A"
                onPress={() => handleWebsite(contacts.website)}
              />
            ) : null}
            {!contacts.phone && !contacts.kakaoId && !contacts.kakaoOpenChat &&
             !contacts.zalo && !contacts.email && !contacts.website ? (
              <Text style={styles.noContact}>연락처 정보가 없습니다</Text>
            ) : null}
          </View>

          {/* 관리자 버튼 */}
          {userIsAdmin ? (
            <>
              <View style={styles.sectionDivider} />
              <View style={styles.adminRow}>
                <TouchableOpacity
                  style={[styles.adminBtn, { backgroundColor: '#FF6B35' }]}
                  onPress={handleEdit}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={18} color="#fff" />
                  <Text style={styles.adminBtnText}>수정</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.adminBtn, { backgroundColor: '#D32F2F' }]}
                  onPress={handleDelete}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                  <Text style={styles.adminBtnText}>삭제</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          <View style={{ height: 16 }} />
        </View>
      </ScrollView>

      {/* 공유 버튼 (fixed) */}
      <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
        <Ionicons name="share-social-outline" size={22} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function ContactButton({ icon, label, value, color, onPress }) {
  return (
    <TouchableOpacity style={styles.contactBtn} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.contactIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={18} color="#fff" />
      </View>
      <View style={styles.contactTextWrap}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={styles.contactValue} numberOfLines={1}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#CCC" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centerWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  emptyText: { fontSize: 14, color: '#888', marginTop: 12 },

  imgPlaceholder: {
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageIndicator: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pageIndicatorText: { color: '#fff', fontSize: 12 },

  body: { paddingHorizontal: 16, paddingTop: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  name: { flex: 1, fontSize: 22, fontWeight: '700', color: '#222' },
  catBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  catBadgeText: { fontSize: 11, color: '#E65100', fontWeight: '700' },

  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  locationText: { fontSize: 14, color: '#666', marginLeft: 4 },
  address: { fontSize: 13, color: '#888', marginBottom: 4 },

  sectionDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
  },

  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  tag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
    marginBottom: 6,
  },
  tagText: { fontSize: 12, color: '#555' },

  hoursWrap: { marginBottom: 4 },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  hoursDay: {
    width: 32,
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  hoursTime: {
    fontSize: 13,
    color: '#333',
  },
  holidayNote: { fontSize: 13, color: '#888', marginTop: 4, fontStyle: 'italic' },

  mapWrap: {
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 4,
  },

  externalLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 12,
  },
  externalLinkText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#1976D2',
    fontWeight: '600',
  },

  contactWrap: {},
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactTextWrap: { flex: 1, minWidth: 0 },
  contactLabel: { fontSize: 11, color: '#888' },
  contactValue: { fontSize: 14, color: '#333', fontWeight: '500' },
  noContact: { fontSize: 13, color: '#AAA', fontStyle: 'italic', paddingVertical: 8 },

  adminRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  adminBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  adminBtnText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 6,
  },

  shareBtn: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
