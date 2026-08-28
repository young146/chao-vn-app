// 씬짜오 AI 검색 도우미 — 앱 대화형 검색 화면 (웹 /assistant 의 앱 버전)
// 자연어로 물으면 백엔드(/api/assistant)의 Claude 가 우리 옐로페이지·기사 + 구글 평점을
// 함께 뒤져 대화로 안내한다. 오타·구어("동우회")도 알아서 보정.
// 순수 JS(네이티브 모듈 0개, 기존 의존성만 사용) → OTA 안전.
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Keyboard, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { askAssistantStream, resolveAssistantResultUrl, isDirectoryResult, TYPE_LABEL } from '../services/searchService';
import BizDetailSheet from '../components/BizDetailSheet';
import MicButton from '../components/MicButton';
import { isSpeakSupported, speak, stopSpeaking, createSpeechStream, probeSpeech } from '../lib/voice';
import { renderAnswer } from '../components/RichAnswer';

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
// 굵은 글씨 + **눌리는 주소**. 규칙은 components/RichAnswer.js 한 곳에만 둔다 —
// 같은 답변이 검색결과 AI 카드에도 나오므로 두 벌로 두면 한쪽만 고쳐진다.
const renderRich = renderAnswer;

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

export default function AssistantScreen({ navigation, route }) {
  const [messages, setMessages] = useState([]);
  // 검색결과의 "이어서 물어보기"로 들어오면 그 검색어를 입력칸에 채워 둔다.
  // **보내지는 않는다** — 무엇을 더 물을지는 사용자가 정한다.
  const [input, setInput] = useState(route?.params?.q || '');
  const [loading, setLoading] = useState(false);
  // 도착하는 중인 답(스트리밍). 다 받으면 messages 로 옮겨 담고 비운다.
  const [streaming, setStreaming] = useState('');
  // 지금 무엇을 하는 중인지("'컨설팅' 찾는 중"). 서버가 알려준다.
  const [status, setStatus] = useState('');
  // 읽어주기 — 모듈이 없는 기기에서는 버튼을 숨긴다.
  // (마이크는 MicButton 이 스스로 판단해 숨으므로 여기서 볼 필요가 없다)
  const speakOK = isSpeakSupported();
  const [speakingIdx, setSpeakingIdx] = useState(-1);   // 지금 읽고 있는 답변의 위치
  // **말로 물었으면 말로 답한다.** 글을 읽기 어려워서 말로 묻는 것이니 글만 주면 절반이다.
  // (타자로 물었으면 소리는 안 낸다 — 칠 수 있는 분은 읽을 수 있고, 조용한 자리일 수도 있다)
  const askedByVoice = useRef(false);
  const speechRef = useRef(null);
  const [reading, setReading] = useState(false);   // 도착하는 답을 소리로 읽는 중인가
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [bizSeed, setBizSeed] = useState(null); // 진출기업·옐로 상세 팝업 대상(null=닫힘)
  const scrollRef = useRef(null);
  // 돌고 있는 스트림 손잡이 — 새로 보내거나 화면을 떠날 때 끊는다.
  const streamRef = useRef(null);
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

  // 흘려보내기(스트리밍)로 받는다 — 답을 다 만들 때까지 기다리지 않고, 글자가
  // 만들어지는 대로 화면에 붙인다. 사업체를 찾는 질문은 예전에 15초간 빈 화면이었다.
  const send = useCallback((text) => {
    const q = String(text || '').trim();
    if (!q) return;
    const next = [...messagesRef.current, { role: 'user', content: q }];
    setMessages(next);
    setInput('');
    setLoading(true);
    setStreaming(''); setStatus('');
    streamRef.current?.cancel?.();
    speechRef.current?.stop?.();

    // 말로 물었으면 문장이 완성되는 대로 읽어 준다 — 글과 말이 함께 나온다.
    const readAloud = askedByVoice.current && speakOK;
    askedByVoice.current = false;          // 이번 질문에만 적용
    speechRef.current = readAloud
      ? createSpeechStream({
          onStart: () => setReading(true),      // 소리가 실제로 나기 시작할 때만 '멈춤' 표시
          onIdle: () => { setSpeakingIdx(-1); setReading(false); },
          onError: () => { setReading(false); setSpeakingIdx(-1); reportSpeechProblem(); },
        })
      : null;
    setReading(false);

    let acc = '';   // 지금까지 도착한 글자(화면 표시용)
    const finish = (reply, results) => {
      const after = [...next, { role: 'assistant', content: reply, results }];
      setMessages(after);
      persist(chatIdRef.current, after);
      setLoading(false); setStreaming(''); setStatus('');
      // 읽던 것과 최종본을 맞추고 남은 꼬리를 마저 읽는다.
      // 읽는 중이면 그 답변에 '멈춤'이 뜨도록 위치를 잡아 준다.
      if (speechRef.current) { setSpeakingIdx(after.length - 1); setReading(false); speechRef.current.flush(reply); }
    };

    streamRef.current = askAssistantStream(next, {
      onDelta: (t) => { acc += t; setStreaming(acc); setStatus(''); speechRef.current?.push(acc); },
      // 도구를 쓰기 전 서두였다 — 최종 답은 다음 판에 온다.
      // 말풍선을 비우고 **읽던 것도 멈춘다**(버려진 문장을 소리로 읽으면 안 된다).
      onReset: () => { acc = ''; setStreaming(''); speechRef.current?.reset(); },
      onStatus: (s) => setStatus(s),
      onDone: ({ reply, results }) => finish(reply, results),
      onError: () => { speechRef.current?.stop?.(); setReading(false); finish('연결에 문제가 있어요. 잠시 후 다시 시도해 주세요.', []); },
    });
  }, [persist, reportSpeechProblem]);

  // 답을 소리로 읽어준다. 다시 누르면 멈춤. 다른 답을 누르면 그쪽으로 옮겨 간다.
  // ⚠️ setState 업데이터 안에서 speak/stop 을 부르지 않는다 — 업데이터는 순수해야 한다
  //    (이 파일 위쪽 persist() 에도 같은 주의가 붙어 있다). 그래서 ref 로 현재값을 읽는다.
  const speakingRef = useRef(-1);
  useEffect(() => { speakingRef.current = speakingIdx; }, [speakingIdx]);
  // 읽어주기가 안 되면 **왜 안 되는지 알려준다.** "아무 일도 안 일어남"은 고칠 수 없다.
  const reportSpeechProblem = useCallback(async () => {
    const p = await probeSpeech();
    Alert.alert('읽어주기를 쓸 수 없어요', p.reason || '알 수 없는 이유로 소리가 나지 않습니다.');
  }, []);

  const toggleSpeak = useCallback((idx, text) => {
    const cur = speakingRef.current;
    speechRef.current?.stop?.();           // 자동 낭독이 돌고 있으면 끈다
    if (cur === idx) { stopSpeaking(); setSpeakingIdx(-1); return; }   // 같은 답을 다시 누름 = 멈춤
    // ⚠️ 여기서 stopSpeaking() 을 또 부르지 않는다 — speak() 가 스스로 앞엣것을 확인하고 정리한다.
    //    바로 앞에서 stop 을 던지면 그것이 speak 뒤에 도착해 방금 시작한 말을 죽인다(2026-08-12 사고).
    setSpeakingIdx(idx);
    speak(text, {
      onDone: () => setSpeakingIdx(-1),
      onError: () => { setSpeakingIdx(-1); reportSpeechProblem(); },
    });
  }, [reportSpeechProblem]);

  const newChat = useCallback(() => {
    stopSpeaking(); setSpeakingIdx(-1);
    setMessages([]);
    setInput('');
    chatIdRef.current = newId();
    setShowHistory(false);
  }, []);

  // 검색결과에서 "이어서 물어보기"로 들어온 경우 — 앞선 문답을 이어받아 대화를 잇는다.
  //
  // 왜 필요한가: 앞 대화를 안 넘기면 "그럼 서류는?" 같은 후속 질문이 통째로 헛돈다.
  //             도우미가 무엇에 대한 '그럼'인지 모르기 때문이다.
  // ⚠️ send() 는 state 가 아니라 messagesRef 를 기준으로 이어붙인다. setMessages 는 다음
  //    렌더에야 ref 에 반영되므로, **ref 를 직접 먼저 채운 뒤** send 해야 앞 대화가 붙는다.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    const seed = route?.params?.seed;
    const ask = route?.params?.ask;
    if (!Array.isArray(seed) || seed.length === 0) return;
    seededRef.current = true;
    messagesRef.current = seed;
    setMessages(seed);
    // 검색결과에서 **말로** 이어 물었으면 여기서도 소리로 답한다(route 로 넘어온다).
    if (route?.params?.spoken) askedByVoice.current = true;
    if (ask) send(ask);
  }, [route?.params?.seed, route?.params?.ask, route?.params?.spoken, send]);

  // 최초: 기록 로드 + 새 대화 id
  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY)
      .then((raw) => { if (raw) setHistory(JSON.parse(raw)); })
      .catch(() => {});
    chatIdRef.current = newId();
    // 화면을 떠나면 돌고 있는 스트림을 끊는다 — 사라진 화면에 setState 하지 않기 위해.
    return () => { streamRef.current?.cancel?.(); speechRef.current?.stop?.(); stopSpeaking(); };
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
        keyboardDismissMode="on-drag"
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
                {/* 읽어주기 — 말로 물으신 분은 읽기도 불편하다(노안).
                    자동 재생은 안 한다. 듣고 싶을 때만 누르면 된다.
                    ⚠️ **검색결과 AI카드와 똑같이 생겨야 한다.** 처음엔 여기만 흐린 회색이라
                       "잘 안 보인다"는 지적을 받았다(2026-08-12). 같은 기능이 두 곳에서
                       다르게 생기면 어르신은 같은 것인 줄 모른다. */}
                {speakOK && (
                  <TouchableOpacity
                    onPress={() => toggleSpeak(i, m.content)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={speakingIdx === i ? '읽기 멈춤' : '읽어주기'}
                    style={styles.speakBtn}
                  >
                    <Ionicons name={speakingIdx === i ? 'stop-circle' : 'volume-high'} size={17} color="#6D28D9" />
                    <Text style={styles.speakText}>{speakingIdx === i ? '멈춤' : '읽어주기'}</Text>
                  </TouchableOpacity>
                )}
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
        {/* 도착하는 중인 답 — 글자가 만들어지는 대로 여기 붙는다.
            다 받은 뒤에 messages 로 옮겨 담으므로 이 말풍선은 잠깐만 존재한다. */}
        {!!streaming && (
          <View style={styles.botRow}>
            {/* 도착하는 중에 소리로도 읽고 있으면 **여기서 바로 멈출 수 있어야** 한다.
                답이 다 오기를 기다렸다 멈추게 하면 이미 늦다. */}
            {reading && (
              <TouchableOpacity
                onPress={() => { speechRef.current?.stop?.(); stopSpeaking(); setReading(false); }}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="읽기 멈춤"
                style={styles.speakBtn}
              >
                <Ionicons name="stop-circle" size={17} color="#6D28D9" />
                <Text style={styles.speakText}>멈춤</Text>
              </TouchableOpacity>
            )}
            <View style={styles.botBubble}>
              <Text style={styles.botText}>{renderRich(streaming)}</Text>
            </View>
          </View>
        )}
        {loading && !streaming && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={ORANGE} />
            {/* 서버가 무엇을 찾는 중인지 알려주면 그대로 보여준다 */}
            <Text style={styles.loadingText}>{status ? `${status}…` : '찾는 중…'}</Text>
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
        {/* 말로 묻기 — 대화창에서도 키보드 없이 이어갈 수 있어야 한다 */}
        {!loading && (
          <MicButton
            color={ORANGE} size={22} label="말로 묻기"
            onOpen={() => { speechRef.current?.stop?.(); stopSpeaking(); setSpeakingIdx(-1); }}
            onText={(t) => { askedByVoice.current = true; send(t); }}
          />
        )}
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
  // 검색결과 AI카드와 **같은 토큰**. 한쪽만 바꾸지 말 것.
  speakBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: '#EDE9FE', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6,
  },
  speakText: { color: '#6D28D9', fontSize: 13, fontWeight: '800' },
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
