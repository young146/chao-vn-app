// 씬짜오 AI 검색 도우미 — 앱 대화형 검색 화면 (웹 /assistant 의 앱 버전)
// 자연어로 물으면 백엔드(/api/assistant)의 Claude 가 우리 옐로페이지·기사 + 구글 평점을
// 함께 뒤져 대화로 안내한다. 오타·구어("동우회")도 알아서 보정.
// 순수 JS(네이티브 모듈 0개, 기존 의존성만 사용) → OTA 안전.
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { askAssistant, resolveAssistantResultUrl, isDirectoryResult, TYPE_LABEL } from '../services/searchService';
import BizDetailSheet from '../components/BizDetailSheet';

const ORANGE = '#FF6B35';
const STORE_KEY = 'xc_assistant_history_v1';
// (검색·AI 화면은 App.js NO_AD_ROUTE_NAMES 로 하단 전역광고가 표시되지 않음 → 광고 여백 불필요)
const EXAMPLES = [
  '교민단체 알려줘',
  '호치민 2군 평점 좋은 한식당',
  '하노이 한인 미용실 추천',
  '베트남 비자 연장은 어떻게 해?',
];
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// **굵게** 만 처리하는 초경량 렌더러 (한 줄 텍스트 → bold 구간 분리)
function renderRich(text) {
  return String(text || '').split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <Text key={i} style={{ fontWeight: '700' }}>{part.slice(2, -2)}</Text>
    ) : (
      <Text key={i}>{part}</Text>
    )
  );
}

function sourceLabel(r) {
  if (r.source === 'google') return '구글맵';
  return TYPE_LABEL[r.type] || '';
}

function ResultCard({ r, onPress }) {
  const meta = [r.category, r.city, r.address].filter(Boolean).join(' · ');
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => onPress(r)}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={2}>{r.title}</Text>
        {r.source === 'google' && r.rating != null && (
          <Text style={styles.rating}>
            ★ {r.rating}{r.ratingCount != null ? ` (${r.ratingCount})` : ''}
          </Text>
        )}
      </View>
      {!!meta && <Text style={styles.cardMeta} numberOfLines={1}>{meta}</Text>}
      {!!r.phone && <Text style={styles.cardPhone}>📞 {r.phone}</Text>}
      <Text style={styles.cardSource}>{sourceLabel(r)}</Text>
    </TouchableOpacity>
  );
}

export default function AssistantScreen({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [bizSeed, setBizSeed] = useState(null); // 진출기업·옐로 상세 팝업 대상(null=닫힘)
  const scrollRef = useRef(null);
  const chatIdRef = useRef('');
  const messagesRef = useRef([]);
  const historyRef = useRef([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { historyRef.current = history; }, [history]);

  // 키보드 높이 추적 — Android(pan 모드)는 입력창을 키보드 높이만큼 직접 올려 가리지 않게 한다
  // (이 앱의 ChatRoomScreen 과 동일한 검증된 패턴). iOS 는 KeyboardAvoidingView(padding)가 처리.
  useEffect(() => {
    const s = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e?.endCoordinates?.height || 0);
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    const h = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { s.remove(); h.remove(); };
  }, []);

  // 현재 대화를 기기(AsyncStorage)에 저장 — 상위로 끌어올림, 최대 30개.
  // setState 업데이터는 순수해야 하므로(부수효과 금지) ref 로 현재값을 읽어 next 를 만든 뒤
  // setHistory(next) 와 AsyncStorage 를 업데이터 "밖"에서 호출한다.
  const persist = useCallback((id, msgs) => {
    if (!msgs.length) return;
    const title = (msgs.find((m) => m.role === 'user')?.content || '새 대화').slice(0, 40);
    const rest = historyRef.current.filter((c) => c.id !== id);
    const next = [{ id, title, ts: Date.now(), messages: msgs }, ...rest].slice(0, 30);
    setHistory(next);
    AsyncStorage.setItem(STORE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const send = useCallback(async (text) => {
    const q = String(text || '').trim();
    if (!q) return;
    const next = [...messagesRef.current, { role: 'user', content: q }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const { reply, results } = await askAssistant(next);
      const after = [...next, { role: 'assistant', content: reply, results }];
      setMessages(after);
      persist(chatIdRef.current, after);
    } finally {
      setLoading(false);
    }
  }, [persist]);

  const newChat = useCallback(() => {
    setMessages([]);
    setInput('');
    chatIdRef.current = newId();
    setShowHistory(false);
  }, []);

  // 최초: 기록 로드 + 새 대화 id
  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY)
      .then((raw) => { if (raw) setHistory(JSON.parse(raw)); })
      .catch(() => {});
    chatIdRef.current = newId();
  }, []);

  // 헤더 우측: 기록 / 새 채팅
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.headerBtn}>
            <Ionicons name="time-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={newChat} style={styles.headerBtn}>
            <Ionicons name="create-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, newChat]);

  const loadChat = useCallback((c) => {
    chatIdRef.current = c.id;
    setMessages(c.messages || []);
    setShowHistory(false);
  }, []);

  const deleteChat = useCallback((id) => {
    const next = historyRef.current.filter((c) => c.id !== id);
    setHistory(next);
    AsyncStorage.setItem(STORE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const openResult = useCallback(async (r) => {
    // 진출기업·옐로 = 앱 안 팝업. 구글결과·뉴스·매거진 = 인앱브라우저(구글맵/원문).
    if (isDirectoryResult(r)) { setBizSeed(r); return; }
    const url = resolveAssistantResultUrl(r);
    if (!url) return;
    try { await WebBrowser.openBrowserAsync(url); } catch (e) { /* noop */ }
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🤖</Text>
            <Text style={styles.emptyTitle}>무엇이든 물어보세요</Text>
            <Text style={styles.emptyDesc}>
              업소·교민단체·맛집·비자… 자연스럽게 말해 주세요.{'\n'}
              우리 옐로페이지와 구글 평점을 함께 찾아드려요.
            </Text>
            <View style={styles.examples}>
              {EXAMPLES.map((ex) => (
                <TouchableOpacity key={ex} style={styles.exampleChip} activeOpacity={0.8} onPress={() => send(ex)}>
                  <Text style={styles.exampleText}>{ex}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          messages.map((m, i) =>
            m.role === 'user' ? (
              <View key={i} style={styles.userRow}>
                <View style={styles.userBubble}><Text style={styles.userText}>{m.content}</Text></View>
              </View>
            ) : (
              <View key={i} style={styles.botRow}>
                <View style={styles.botBubble}>
                  <Text style={styles.botText}>{renderRich(m.content)}</Text>
                </View>
                {!!(m.results && m.results.length) && (
                  <View style={styles.cards}>
                    {m.results.slice(0, 8).map((r, j) => (
                      <ResultCard key={r.id || r.url || j} r={r} onPress={openResult} />
                    ))}
                  </View>
                )}
              </View>
            )
          )
        )}
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={ORANGE} />
            <Text style={styles.loadingText}>찾는 중…</Text>
          </View>
        )}
      </ScrollView>

      {/* 입력창 — 키보드 열리면 그 높이만큼 올려 가리지 않게(Android pan 모드, 앱 ChatRoom 과 동일).
          iOS 는 KeyboardAvoidingView(padding)가 처리. 이 화면은 하단광고 없음. */}
      <View style={[styles.inputBar, keyboardHeight > 0 && Platform.OS === 'android' ? { marginBottom: keyboardHeight - 20 } : null]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="예: 호치민 2군 평점 좋은 한식당"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={() => send(input)}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (loading || !input.trim()) && styles.sendBtnOff]}
          onPress={() => send(input)}
          disabled={loading || !input.trim()}
          activeOpacity={0.85}
        >
          <Text style={styles.sendText}>보내기</Text>
        </TouchableOpacity>
      </View>

      {/* 기록 패널 */}
      <Modal visible={showHistory} animationType="slide" transparent onRequestClose={() => setShowHistory(false)}>
        <View style={styles.modalRoot}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowHistory(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🕘 대화 기록 (이 기기)</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            {history.length === 0 ? (
              <Text style={styles.historyEmpty}>저장된 대화가 없어요.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {history.map((c) => (
                  <View key={c.id} style={styles.historyRow}>
                    <TouchableOpacity style={styles.historyItem} activeOpacity={0.8} onPress={() => loadChat(c)}>
                      <Text style={styles.historyTitle} numberOfLines={1}>{c.title}</Text>
                      <Text style={styles.historyDate}>
                        {new Date(c.ts).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteChat(c.id)} style={styles.historyDel}>
                      <Ionicons name="trash-outline" size={18} color="#bbb" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* 진출기업·옐로 상세 — 앱 안 팝업 */}
      <BizDetailSheet visible={bizSeed !== null} seed={bizSeed} onClose={() => setBizSeed(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  scroll: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 20 },
  headerBtn: { paddingHorizontal: 8, paddingVertical: 4 },

  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { marginTop: 8, fontSize: 18, fontWeight: '800', color: '#111827' },
  emptyDesc: { marginTop: 6, fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  examples: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  exampleChip: { borderWidth: 1, borderColor: '#FED7AA', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  exampleText: { color: '#C2410C', fontSize: 13, fontWeight: '600' },

  userRow: { alignItems: 'flex-end', marginBottom: 12 },
  userBubble: { maxWidth: '85%', backgroundColor: ORANGE, borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  userText: { color: '#fff', fontSize: 15 },

  botRow: { alignItems: 'flex-start', marginBottom: 14 },
  botBubble: { maxWidth: '92%', backgroundColor: '#fff', borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: '#F3F4F6' },
  botText: { color: '#1F2937', fontSize: 15, lineHeight: 22 },

  cards: { marginTop: 8, width: '100%', gap: 8 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  rating: { fontSize: 12, fontWeight: '800', color: '#B45309', backgroundColor: '#FFFBEB', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  cardMeta: { marginTop: 3, fontSize: 12, color: '#6B7280' },
  cardPhone: { marginTop: 4, fontSize: 14, color: '#C2410C' },
  cardSource: { marginTop: 4, fontSize: 11, fontWeight: '600', color: '#9CA3AF' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  loadingText: { color: '#9CA3AF', fontSize: 14 },

  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#fff' },
  input: { flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#111827' },
  sendBtn: { backgroundColor: ORANGE, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
  sendBtnOff: { opacity: 0.4 },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 28 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  modalClose: { fontSize: 18, color: '#9CA3AF', fontWeight: '700', paddingHorizontal: 6 },
  historyEmpty: { textAlign: 'center', color: '#9CA3AF', paddingVertical: 30 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  historyItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#F3F4F6', backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  historyTitle: { flex: 1, fontSize: 14, color: '#1F2937' },
  historyDate: { marginLeft: 8, fontSize: 12, color: '#9CA3AF' },
  historyDel: { padding: 6 },
});
