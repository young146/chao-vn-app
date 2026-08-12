// 씬짜오 베트남 통합검색 허브 (앱 홈) — 2026-08-08 리디자인.
//
// 설계 원칙: **주인공은 하나.** 예전 홈은 누를 수 있는 것이 22개, 색이 12가지여서
// 눈이 어디부터 봐야 할지 정하지 못했다. 지금은 셋뿐이다 — 광고 · 로고 · 검색창.
//
// 위에서 아래로:
//   ① 광고 캐러셀  — 헤더 바로 아래. 홈이 비어 보이지 않게 하는 유일한 장치이자 지면 진열대
//   ② 로고         — assets/icon.png 원본 그대로 (곡진 사각형 테두리선 = 잡지 표지의 정체성)
//   ③ 검색창       — 하나. 짧게 치면 검색, 문장으로 치면 AI (판단은 결과 화면이 한다)
//   그 아래는 비운다 — 하단 탭바에 메뉴가 이미 다 있어서 바로가기 카드는 중복이었다.
//
// 뺀 것과 그 이유:
//   · "24년 교민 잡지" 배지 → 2024년으로 읽히고, 매년 고쳐야 하는 문구는 언젠가 반드시 안 고쳐진다.
//                              대신 로고 아래 SINCE 2001 (연도가 박제되니 안 늙는다)
//   · AI 도우미 별도 카드   → 검색창과 둘로 나뉘어 있으면 "지금 검색인가 질문인가"를 사용자가
//                              판단해야 한다. 답할 수 없는 질문이라 둘 다 안 쓰게 된다. 하나로 합쳤다.
//   · 지역 필터            → 검색하기 *전에* 지역을 고르는 사람은 거의 없다. 결과를 본 다음 좁힌다.
//                              그래서 검색결과 화면으로 옮겼다 (거기 이미 있다).
//   · 바로가기 카드 6개    → 바로 아래 탭바와 같은 곳으로 간다. 지워도 잃는 게 없다.
//   · 배경 사진            → 사진 위에 뭘 올리면 읽기 어려워 그림자·오버레이를 자꾸 덧대게 된다.
//                              그게 복잡함의 절반이었다.
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Image, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HomeAdCarousel from '../components/HomeAdCarousel';
import MicButton from '../components/MicButton';

const BRAND = '#E85D04';
const INK = '#171412';
const MUTE = '#8B8078';
const LINE = '#EDE6DD';
const STRAW = '#A8871C';

// 검색창 안에서 천천히 바뀌는 예시. "이런 것도 물어봐도 되는구나"를 설명 없이 알려준다.
//
// ⚠️ 예문은 곧 사용법 교육이다. 여기 적힌 종류의 질문이 실제로 들어온다.
// 그래서 **사업 질문을 앞에, 그리고 더 많이** 둔다 (2026-08-08 사장님 방향):
//  · 진출기업 수천 곳은 **우리만 가진 자산**이다. 맛집·환율은 구글에도 있지만 이건 없다.
//  · 컨설팅·세무·법무·물류는 그대로 **우리 광고주 업종**이다. 그 질문이 늘면 그 지면 값이 오른다.
//  · 주재원·자영업자·진출기업 담당자가 우리 독자의 중심이다.
// 생활 질문도 섞는다 — 사업 얘기만 있으면 "나는 해당 없네" 하고 닫는 사람이 생긴다.
// 문장형으로 적는 이유: AI 가 문장을 이해한다는 것을 예문 자체가 보여준다.
const EXAMPLES = [
  '베트남 진출 컨설팅 회사 소개해줘',
  '한국계 세무·회계 법인 어디 있어?',
  '법인 설립 대행해주는 곳 알려줘',
  '하노이에 진출한 한국 제조기업 알려줘',
  '물류·통관 대행 업체 찾아줘',
  '한국인 채용하는 회사 있을까?',
  '2군에 평점 좋은 한식당 알려줘',
  '비자 연장 어떻게 해?',
];
const EXAMPLE_MS = 3400;

export default function HubScreen({ navigation, route }) {
  const [query, setQuery] = useState('');
  const [exIdx, setExIdx] = useState(0);
  const [focused, setFocused] = useState(false);

  // 홈 탭/제목 재탭(resetSearch) 시 입력 초기화 — 홈은 항상 깨끗한 첫 화면
  useEffect(() => {
    if (route?.params?.resetSearch) setQuery('');
  }, [route?.params?.resetSearch]);

  // 예시 문장 회전. 입력 중이거나 글자가 있으면 멈춘다 — 눈앞에서 글씨가 바뀌면 거슬린다.
  const busy = focused || query.length > 0;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => {
    const t = setInterval(() => {
      if (busyRef.current) return;
      setExIdx((i) => (i + 1) % EXAMPLES.length);
    }, EXAMPLE_MS);
    return () => clearInterval(t);
  }, []);

  // 검색 = 별도 결과 화면으로 이동 (홈은 그대로 남는다).
  // 지역은 여기서 안 받는다 — 결과 화면에서 좁힌다.
  const onSubmit = () => {
    const q = query.trim();
    if (!q) return;
    navigation.navigate('검색결과', { q });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        {/* ① 광고 — 헤더 바로 아래 */}
        <HomeAdCarousel
          style={styles.carousel}
          onInquiry={() => navigation.navigate('이웃사업', { screen: '이웃사업 등록' })}
        />

        {/* ② 로고 */}
        <View style={styles.lockup}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.badge}
            resizeMode="contain"
          />
          <Text style={styles.wordmark}>XinChaoVietnam</Text>
          <Text style={styles.since}>SINCE 2001</Text>
        </View>

        {/* ③ 검색창 — 하나 */}
        <View style={styles.searchWrap}>
          <View style={[styles.searchBox, focused && styles.searchBoxOn]}>
            {/* 돋보기도 누르면 검색된다. 그림만 있으면 눌러도 아무 일이 없어 "고장"으로 보인다. */}
            <TouchableOpacity
              onPress={onSubmit}
              accessibilityRole="button"
              accessibilityLabel="검색"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
              style={styles.searchIcon}
            >
              <Ionicons name="search" size={19} color={query ? BRAND : MUTE} />
            </TouchableOpacity>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={onSubmit}
              returnKeyType="search"
              placeholder={EXAMPLES[exIdx]}
              placeholderTextColor={MUTE}
              style={styles.searchInput}
            />
            {/* 말로 검색 — 키보드를 못 치는 분들의 **입구**.
                어르신들이 "다 잘 나온다"고 놀라시고도 키보드에서 막히셨다(2026-08-09). */}
            <MicButton
              color={BRAND}
              size={22}
              label="말로 검색하기"
              onText={(t) => {
                // 말한 내용을 검색창에 넣고 **바로 검색까지** 한다.
                // 여기서 멈추고 "검색을 누르세요" 하면 어르신은 또 한 번 막힌다.
                setQuery(t);
                navigation.navigate('검색결과', { q: t });
              }}
            />
            {/* 검색 버튼은 하나. 'AI 검색'이라고 적으면 다시 두 갈래가 되어버린다 —
                사용자에게 "지금 검색인가 질문인가"를 묻지 않는 것이 이 화면의 요점이다.
                ✦ 는 AI가 함께 돈다는 표시일 뿐 별도 모드가 아니다. */}
            <TouchableOpacity
              style={[styles.aiChip, !query.trim() && styles.aiChipOff]}
              onPress={onSubmit}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="검색"
            >
              <Text style={styles.aiChipText}>✦ 검색</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.searchHint}>
            검색하면 <Text style={{ fontWeight: '700', color: '#7C3AED' }}>AI가 함께</Text> 찾아 드려요
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingBottom: 28 },

  carousel: { marginTop: 14 },

  lockup: { alignItems: 'center', paddingTop: 30, paddingHorizontal: 18 },
  // 원본 아이콘 그대로. 바깥 모서리만 둥글려 런처·앱스토어에서 보이는 모습과 맞춘다.
  badge: { width: 63, height: 63, borderRadius: 14 },
  wordmark: {
    marginTop: 10, fontSize: 30, fontWeight: '800', color: INK,
    letterSpacing: -1, textAlign: 'center',
  },
  since: {
    marginTop: 6, fontSize: 9.5, fontWeight: '600', color: STRAW,
    letterSpacing: 2.6,
  },

  searchWrap: { paddingHorizontal: 18, paddingTop: 22 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: LINE, borderRadius: 999,
    paddingLeft: 16, paddingRight: 8, paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    shadowColor: '#3C2612', shadowOpacity: 0.1, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  searchBoxOn: { borderColor: BRAND },
  searchIcon: { marginRight: 9 },
  searchInput: {
    flex: 1, minWidth: 0, fontSize: 15, color: INK,
    paddingVertical: Platform.OS === 'ios' ? 2 : 8,
  },
  aiChip: {
    backgroundColor: '#7C3AED', borderRadius: 999,
    paddingHorizontal: 13, paddingVertical: 8, marginLeft: 8,
  },
  aiChipOff: { backgroundColor: '#B9A7E8' },   // 입력 전에는 눌러도 소용없음을 색으로 알린다
  aiChipText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  searchHint: { marginTop: 10, textAlign: 'center', fontSize: 11.5, color: MUTE },
});
