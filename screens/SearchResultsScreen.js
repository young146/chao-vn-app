// 통합검색 결과 화면 (구글식) — 맨 위 고정 검색창 + 결과 리스트.
// 홈(허브)에서 검색 시 이 화면이 push 되어 열린다. 홈은 그대로 유지 → 뒤로/홈탭이면 홈 복원.
// 이 화면에서 계속 검색·타입필터·지역·페이지 이동. 결과 탭 = 인앱 브라우저(vnkorlife.com/biz 등).
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Modal, FlatList, Platform, Dimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import {
  searchUnified, getRegions, resolveResultUrl, isDirectoryResult, TYPE_LABEL,
  askAssistantStream, resolveAssistantResultUrl,
} from '../services/searchService';
import BizDetailSheet from '../components/BizDetailSheet';
import { renderAnswer } from '../components/RichAnswer';

const BRAND = '#FF6B35';
// 스크롤 바닥 여백. 예전엔 화면을 덮는 고정 광고배너 높이만큼(약 165) 비워 뒀는데,
// 그 배너를 없앴으므로(2026-08-06) 보통 여백만 남긴다.
// ※ 이 화면은 원래 그 배너가 제외된 곳이라 광고를 새로 넣지 않는다.
const AD_CLEARANCE = 40;

const TYPE_BADGE = {
  yellow: { bg: '#F3E8FF', fg: '#7C3AED' },
  company: { bg: '#DBEAFE', fg: '#1D4ED8' },
  news: { bg: '#FFEDD5', fg: '#C2410C' },
  magazine: { bg: '#D1FAE5', fg: '#047857' },
};

export default function SearchResultsScreen({ route, navigation }) {
  const initialQ = route?.params?.q || '';
  const [query, setQuery] = useState(initialQ);
  const [activeQ, setActiveQ] = useState(initialQ);
  const [typeFilter, setTypeFilter] = useState('');
  const [city, setCity] = useState(route?.params?.city || '');
  const [district, setDistrict] = useState(route?.params?.district || '');
  const [regions, setRegions] = useState({ cities: [], districtsByCity: {}, categoriesByType: {} });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(null);
  const [bizSeed, setBizSeed] = useState(null); // 진출기업·옐로 상세 팝업 대상(null=닫힘)
  const scrollRef = useRef(null);

  // ── AI 답변 (일반 검색과 **동시에** 돈다) ──────────────────────────
  // 검색은 하나인데 뒤에서 두 가지가 나란히 움직인다:
  //   · /api/search    — 우리 색인(옐로페이지·진출기업·매거진·뉴스). 빠르다. 목록으로 나온다.
  //   · /api/assistant — Claude 가 우리 데이터 + **구글 평점·리뷰**까지 뒤져 문장으로 답한다. 느리다.
  // 목록을 먼저 띄우고 AI 답이 오면 위에 얹는다 → 사용자는 기다리지 않는다.
  const [aiReply, setAiReply] = useState('');
  const [aiResults, setAiResults] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  // 지금 무엇을 하는 중인지("'컨설팅' 찾는 중"). 서버가 알려준다.
  const [aiStatus, setAiStatus] = useState('');
  // 빠르게 다시 검색하면 예전 답이 늦게 도착해 새 답을 덮을 수 있다 → 순번으로 막는다.
  const aiSeq = useRef(0);
  // 돌고 있는 스트림 손잡이 — 새 검색을 하거나 화면을 떠날 때 끊는다.
  const aiStreamRef = useRef(null);

  const [followQ, setFollowQ] = useState('');
  const [aiOpen, setAiOpen] = useState(false);   // AI 답변 펼침 여부(기본: 접힘)

  // 이어서 묻기 — 지금까지의 문답을 통째로 들고 AI 도우미로 넘어가 대화를 잇는다.
  // 여기서 바로 대화를 이어가지 않는 이유: 이 화면은 '검색 결과 목록'이고,
  // 대화는 AI 도우미 화면이 이미 잘 하고 있다(기록 저장·되돌아보기 포함).
  // 두 벌로 만들면 반드시 어긋나므로, 맥락만 넘겨 자연스럽게 넘어가게 한다.
  const askFollow = () => {
    const q = followQ.trim();
    if (!q || !aiReply) return;
    setFollowQ('');
    navigation.navigate('AI도우미', {
      seed: [
        { role: 'user', content: activeQ },
        { role: 'assistant', content: aiReply },
      ],
      ask: q,
    });
  };

  // AI 가 이해한 검색어로 목록을 좁혔을 때 화면에 표시할 말(빈 값이면 원문 그대로 검색한 것)
  const [aiTerms, setAiTerms] = useState([]);

  const askAI = useCallback((q) => {
    const text = (q || '').trim();
    if (!text) return;
    const my = ++aiSeq.current;
    aiStreamRef.current?.cancel?.();          // 앞 요청이 돌고 있으면 끊는다
    setAiLoading(true); setAiReply(''); setAiResults([]); setAiTerms([]); setAiStatus('');
    const stale = () => my !== aiSeq.current;  // 늦게 온 예전 답은 버린다

    // 흘려보내기 — 글자가 만들어지는 대로 붙인다. 첫 글자가 2~3초에 뜬다.
    aiStreamRef.current = askAssistantStream([{ role: 'user', content: text }], {
      onDelta: (t) => {
        if (stale()) return;
        setAiLoading(false);   // 첫 글자가 오면 '검색 중' 표시를 내린다
        setAiStatus('');
        setAiReply((prev) => prev + t);
      },
      // 도구를 쓰기 전 서두였다는 뜻 — 최종 답은 다음 판에 온다. 화면을 비운다.
      onReset: () => { if (!stale()) { setAiReply(''); setAiLoading(true); } },
      // 무엇을 찾는 중인지 — 빈 화면에서 기다리는 것과 체감이 완전히 다르다.
      onStatus: (s) => { if (!stale()) setAiStatus(s); },
      onError: () => {
        if (stale()) return;
        setAiLoading(false); setAiStatus('');
        setAiReply('연결에 문제가 있어요. 잠시 후 다시 시도해 주세요.');
      },
      onDone: ({ reply, results, terms }) => {
        if (stale()) return;
        // 흘려받은 글자와 최종본을 한 번 맞춘다(중간에 놓친 조각이 있어도 여기서 바로잡힌다)
        setAiReply(reply || '');
        setAiResults(Array.isArray(results) ? results : []);
        setAiLoading(false); setAiStatus('');

        // ── AI 가 이해한 검색어로 목록을 다시 좁힌다 ──────────────────────────
        // 왜: 목록 검색은 사용자가 친 **문장 그대로**를 받는다. "베트남 진출을 위한
        //     컨설팅업체를 소개해줘" 같은 문장에서 '위한' 같은 흔한 낱말이 기사 수천 건을
        //     끌고 들어온다. 군말 사전으로 걸러내는 건 영원히 완성되지 않는다 —
        //     새 문장이 오면 새 군말이 나온다.
        //     자연어를 이해하는 검색이 필요해서 AI 를 쓰는 것이니, **AI 가 정한 검색어**를
        //     목록에도 그대로 물려준다. 추가 비용·추가 대기 없다(이미 돌린 결과의 부산물).
        // 흐름: 문장 그대로의 목록이 먼저 뜨고 → AI 가 도착하면 정확한 목록으로 바뀐다.
        const t = Array.isArray(terms) ? terms.filter(Boolean) : [];
        if (t.length && t.join(' ') !== text) {
          setAiTerms(t);
          search({ q: t.join(' '), type: '', city, district, page: 1 });
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, city, district]);

  useEffect(() => { getRegions().then(setRegions).catch(() => {}); }, []);

  const search = useCallback(async (opts) => {
    if (!opts.q || !opts.q.trim()) return;
    setLoading(true);
    // sort=category → 결과를 옐로페이지→진출기업→매거진→뉴스 순으로 묶고 그룹 내 가나다(프리미엄 우선)
    const safe = await searchUnified({ ...opts, sort: 'category' });
    setData(safe);
    setLoading(false);
    scrollRef.current?.scrollTo?.({ y: 0, animated: true });
  }, []);

  // 진입 시 홈에서 받은 질의로 즉시 검색 — 목록과 AI 를 동시에 건다
  useEffect(() => {
    if (initialQ) { search({ q: initialQ, type: '', city, district, page: 1 }); askAI(initialQ); }
    else setLoading(false);
    // 화면을 떠나면 돌고 있는 AI 스트림을 끊는다 — 사라진 화면에 setState 하지 않기 위해.
    return () => { aiStreamRef.current?.cancel?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⚠️ AI 는 **새 검색어일 때만** 부른다.
  //    타입칩·지역·페이지는 이미 받은 목록을 걸러내는 동작이라 질문이 달라지지 않는다.
  //    거기서도 부르면 같은 답을 돈 내고 다시 받는 셈이고, 서버 rate limit 에도 걸린다.
  const onSubmit = () => {
    setActiveQ(query); setTypeFilter('');
    search({ q: query, type: '', city, district, page: 1 });
    askAI(query);
  };
  const onChip = (t) => { setTypeFilter(t); search({ q: activeQ, type: t, city, district, page: 1 }); };
  const onCity = (c) => { setCity(c); setDistrict(''); setPicker(null); search({ q: activeQ, type: typeFilter, city: c, district: '', page: 1 }); };
  const onDistrict = (d) => { setDistrict(d); setPicker(null); search({ q: activeQ, type: typeFilter, city, district: d, page: 1 }); };
  const goPage = (p) => search({ q: activeQ, type: typeFilter, city, district, page: p });
  const openResult = async (r) => {
    // 진출기업·옐로 = 앱 안 팝업(사이트 안 벗어남). 뉴스·매거진 = 원문 인앱브라우저.
    if (isDirectoryResult(r)) { setBizSeed(r); return; }
    const url = resolveResultUrl(r);
    if (!url) return;
    try { await WebBrowser.openBrowserAsync(url); } catch (e) { /* noop */ }
  };
  // AI 카드 안의 결과 — 구글 결과는 구글맵, 우리 업소는 상세 팝업(사이트를 안 벗어난다)
  const openAiResult = async (r) => {
    if (isDirectoryResult(r)) { setBizSeed(r); return; }
    const url = resolveAssistantResultUrl(r);
    if (!url) return;
    try { await WebBrowser.openBrowserAsync(url); } catch (e) { /* noop */ }
  };

  const facets = data?.facets?.type || {};
  const allCount = Object.values(facets).reduce((a, b) => a + b, 0);
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;
  const cityDistricts = city ? (regions.districtsByCity[city] || []) : [];

  return (
    <View style={styles.container}>
      {/* 고정 상단 검색바 + 지역 (구글식 — 항상 보임) */}
      <View style={styles.searchHeader}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={onSubmit}
              returnKeyType="search"
              placeholder="베트남의 모든 정보를 씬짜오에서"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              autoFocus={!initialQ}
            />
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={onSubmit} activeOpacity={0.85}>
            <Text style={styles.searchBtnText}>검색</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.regionRow}>
          <Text style={styles.regionLabel}>📍 지역</Text>
          <TouchableOpacity style={styles.regionPick} onPress={() => setPicker('city')} activeOpacity={0.8}>
            <Text style={styles.regionPickText}>{city || '전체 도시'} ▾</Text>
          </TouchableOpacity>
          {city && cityDistricts.length > 0 && (
            <TouchableOpacity style={styles.regionPick} onPress={() => setPicker('district')} activeOpacity={0.8}>
              <Text style={styles.regionPickText}>{district || '전체 구·군'} ▾</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: AD_CLEARANCE }}>
        {/* ── AI 답변 — 목록 위에. 늦게 도착하므로 자리를 먼저 잡아 둔다 ── */}
        {(aiLoading || aiReply) && (
          <View style={styles.aiCard}>
            {/* 예전엔 여기 오른쪽에 "이어서 물어보기 ›" 링크가 있었다. 답을 다 읽고 나면 눈이
                이미 아래에 있는데 링크는 위에 있어서, 다시 올려다봐야 보이는 위치였다.
                → 링크를 없애고 답 아래에 입력창을 뒀다(아래 followRow). */}
            <View style={styles.aiHead}>
              <Text style={styles.aiHeadText}>✦ AI 답변</Text>
            </View>

            {aiLoading && !aiReply ? (
              <View style={styles.aiLoadingRow}>
                <ActivityIndicator size="small" color="#7C3AED" />
                {/* 서버가 "지금 무엇을 찾는 중"인지 알려주면 그걸 그대로 보여준다.
                    빈 화면에서 막연히 기다리는 것과 "'컨설팅' 찾는 중"을 보는 것은 체감이 다르다.
                    아직 아무 소식이 없으면 중립적으로 '검색 중…'. ("구글 평점까지 함께" 같은
                    문구는 식당·병원 질문에만 맞는 말이라 비자·문화 질문에서 엉뚱해 보였다.) */}
                <Text style={styles.aiLoadingText}>{aiStatus ? `${aiStatus}…` : '검색 중…'}</Text>
              </View>
            ) : (
              <>
                {/* 답이 길면 접어 둔다.
                    사장님 화면에서 AI 카드가 **화면을 통째로 덮어** 정작 우리 콘텐츠 목록이
                    맨 아래로 밀려나 있었다. 우리 24년치 자산이 먼저 보여야 하는데
                    요약이 그 자리를 뺏으면 안 된다. 요약은 요약답게. */}
                <Text style={styles.aiReply} numberOfLines={aiOpen ? undefined : 7}>
                  {renderAnswer(aiReply)}
                </Text>
                {aiReply.length > 180 && (
                  <TouchableOpacity onPress={() => setAiOpen((v) => !v)} activeOpacity={0.7}>
                    <Text style={styles.aiToggle}>{aiOpen ? '접기 ▴' : '더보기 ▾'}</Text>
                  </TouchableOpacity>
                )}
                {aiResults.slice(0, 4).map((r, i) => (
                  <TouchableOpacity
                    key={`ai-${i}`}
                    style={styles.aiItem}
                    activeOpacity={0.8}
                    onPress={() => openAiResult(r)}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.aiItemTitle} numberOfLines={1}>{r.title}</Text>
                      {(r.address || r.phone) && (
                        <Text style={styles.aiItemSub} numberOfLines={1}>
                          {[r.address, r.phone].filter(Boolean).join(' · ')}
                        </Text>
                      )}
                    </View>
                    {r.rating ? (
                      <Text style={styles.aiRating}>
                        ★ {r.rating}
                        {r.ratingCount ? <Text style={styles.aiRatingCount}> ({r.ratingCount})</Text> : null}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}

                {/* 이어서 묻기 — 답 바로 아래, 읽던 자리에서 그대로.
                    보낸 문답을 함께 넘기므로 "그럼 서류는?" 같은 후속 질문이 이어진다.
                    (안 넘기면 도우미가 앞 얘기를 몰라 엉뚱한 답을 한다) */}
                <View style={styles.followRow}>
                  <TextInput
                    value={followQ}
                    onChangeText={setFollowQ}
                    onSubmitEditing={askFollow}
                    returnKeyType="send"
                    placeholder="이어서 물어보세요"
                    placeholderTextColor="#9B8FB5"
                    style={styles.followInput}
                  />
                  <TouchableOpacity
                    style={[styles.followBtn, !followQ.trim() && styles.followBtnOff]}
                    onPress={askFollow}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="이어서 물어보기"
                  >
                    <Ionicons name="arrow-up" size={17} color="#fff" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {/* AI 가 문장을 이해해 검색어를 좁혔을 때 — 무엇으로 좁혔는지 밝힌다.
            사용자가 "왜 결과가 바뀌었지?" 하고 의아해하면 안 된다. */}
        {aiTerms.length > 0 && (
          <View style={styles.termRow}>
            <Text style={styles.termLabel}>✦ AI가 이해한 검색어</Text>
            {aiTerms.map((t) => (
              <View key={t} style={styles.termChip}><Text style={styles.termChipText}>{t}</Text></View>
            ))}
          </View>
        )}

        {/* 타입 필터칩 */}
        {data && data.results.length > 0 && (
          <View style={styles.chipRow}>
            <Chip active={typeFilter === ''} label={`전체 ${allCount}`} onPress={() => onChip('')} />
            {Object.keys(TYPE_LABEL).map((t) =>
              facets[t] ? (
                <Chip key={t} active={typeFilter === t} label={`${TYPE_LABEL[t]} ${facets[t]}`} onPress={() => onChip(t)} />
              ) : null
            )}
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={BRAND} style={{ marginVertical: 48 }} />
        ) : data && data.results.length > 0 ? (
          <>
            <Text style={styles.totalText}>
              총 <Text style={{ fontWeight: '800', color: BRAND }}>{data.total.toLocaleString()}</Text>건 · {data.page}/{totalPages} 페이지
            </Text>
            {data.results.map((r) => (
              <TouchableOpacity key={r.id} style={styles.resultCard} activeOpacity={0.8} onPress={() => openResult(r)}>
                {r.imageUrl ? (
                  <ExpoImage source={{ uri: r.imageUrl }} style={styles.resultImg} contentFit="cover" />
                ) : null}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.resultMeta}>
                    <View style={[styles.badge, { backgroundColor: (TYPE_BADGE[r.type] || {}).bg || '#eee' }]}>
                      <Text style={[styles.badgeText, { color: (TYPE_BADGE[r.type] || {}).fg || '#555' }]}>
                        {TYPE_LABEL[r.type] || r.type}
                      </Text>
                    </View>
                    {(r.city || r.category) && (
                      <Text style={styles.resultLoc} numberOfLines={1}>
                        {[r.city, r.district, r.category].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.resultTitle} numberOfLines={2}>{r.title}</Text>
                  {r.summary ? <Text style={styles.resultSummary} numberOfLines={2}>{r.summary}</Text> : null}
                </View>
              </TouchableOpacity>
            ))}
            <Pagination page={data.page} totalPages={totalPages} onGo={goPage} />
          </>
        ) : (
          <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
        )}
      </ScrollView>

      {/* 지역 선택 모달 */}
      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPicker(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{picker === 'city' ? '도시 선택' : '구·군 선택'}</Text>
            <FlatList
              data={picker === 'city'
                ? [{ key: '', label: '전체 도시' }, ...regions.cities.map((c) => ({ key: c.city, label: `${c.city} (${c.n})` }))]
                : [{ key: '', label: '전체 구·군' }, ...cityDistricts.map((d) => ({ key: d.district, label: `${d.district} (${d.n})` }))]}
              keyExtractor={(it) => it.key || 'all'}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => (picker === 'city' ? onCity(item.key) : onDistrict(item.key))}>
                  <Text style={styles.modalItemText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 진출기업·옐로 상세 — 앱 안 팝업 */}
      <BizDetailSheet visible={bizSeed !== null} seed={bizSeed} onClose={() => setBizSeed(null)} />
    </View>
  );
}

function Chip({ active, label, onPress }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Pagination({ page, totalPages, onGo }) {
  if (totalPages <= 1) return null;
  return (
    <View style={styles.pagination}>
      <TouchableOpacity disabled={page <= 1} style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]} onPress={() => onGo(page - 1)}>
        <Text style={styles.pageBtnText}>이전</Text>
      </TouchableOpacity>
      <Text style={styles.pageIndicator}>{page} / {totalPages}</Text>
      <TouchableOpacity disabled={page >= totalPages} style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]} onPress={() => onGo(page + 1)}>
        <Text style={styles.pageBtnText}>다음</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── AI 답변 카드 (목록 위) ──
  // 보라 = AI. 결과 목록(흰 카드)과 확실히 구분돼야 "이건 답변, 저건 목록"이 한눈에 읽힌다.
  aiCard: {
    backgroundColor: '#F8F5FF', borderWidth: 1, borderColor: '#E4DAFB',
    borderRadius: 14, padding: 14, marginBottom: 14,
  },
  aiHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  aiHeadText: { color: '#6D28D9', fontSize: 12.5, fontWeight: '800', letterSpacing: 0.3 },
  aiMore: { color: '#7C3AED', fontSize: 12, fontWeight: '700' },
  aiLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4 },
  aiLoadingText: { color: '#6B5B8A', fontSize: 13 },
  aiReply: { color: '#1F1B2E', fontSize: 14, lineHeight: 21 },
  aiToggle: { color: '#7C3AED', fontSize: 12.5, fontWeight: '700', marginTop: 6 },
  // AI 가 이해한 검색어 표시줄
  termRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  termLabel: { color: '#6D28D9', fontSize: 11.5, fontWeight: '700' },
  termChip: {
    backgroundColor: '#F3EEFF', borderWidth: 1, borderColor: '#E4DAFB',
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },
  termChipText: { color: '#5B21B6', fontSize: 12, fontWeight: '700' },
  aiItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, marginTop: 8,
  },
  aiItemTitle: { color: '#171412', fontSize: 13.5, fontWeight: '700' },
  aiItemSub: { color: '#8B8078', fontSize: 11.5, marginTop: 1 },
  aiRating: { color: '#B4540A', fontSize: 12.5, fontWeight: '800' },
  aiRatingCount: { color: '#A99', fontSize: 11, fontWeight: '400' },
  // 이어서 묻기 입력줄 — 답 바로 아래
  followRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  followInput: {
    flex: 1, minWidth: 0, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E4DAFB', borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    fontSize: 13.5, color: '#1F1B2E',
  },
  followBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#7C3AED',
    alignItems: 'center', justifyContent: 'center',
  },
  followBtnOff: { backgroundColor: '#C3B4E8' },   // 입력 전에는 눌러도 소용없음을 색으로

  container: { flex: 1, backgroundColor: '#F8FAFC' },
  searchHeader: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingLeft: 12 },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, paddingRight: 12, paddingVertical: Platform.OS === 'ios' ? 11 : 8, fontSize: 15, color: '#111' },
  searchBtn: { backgroundColor: BRAND, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  regionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  regionLabel: { fontSize: 13, color: '#6B7280', fontWeight: '700' },
  regionPick: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  regionPickText: { color: '#374151', fontSize: 13, fontWeight: '600' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  chipActive: { backgroundColor: BRAND, borderColor: BRAND },
  chipText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  chipTextActive: { color: '#fff' },

  totalText: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  resultCard: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  resultImg: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#F3F4F6' },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  resultLoc: { fontSize: 11.5, color: '#9CA3AF', flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  resultSummary: { fontSize: 13, color: '#6B7280', marginTop: 3, lineHeight: 18 },

  emptyText: { textAlign: 'center', color: '#9CA3AF', fontSize: 15, marginVertical: 48 },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 18 },
  pageBtn: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9, backgroundColor: '#fff' },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  pageIndicator: { fontSize: 14, color: '#6B7280', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 32 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 8 },
  modalItem: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalItemText: { fontSize: 15, color: '#374151' },
});
