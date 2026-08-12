// 말로 검색하기 — 어르신을 위한 전용 화면.
//
// 왜 작은 마이크 아이콘이 아니라 **화면을 덮는 창**인가 (2026-08-09):
//   어르신이 음성 입력에서 가장 많이 겪는 실패는 "지금 듣고 있는 건가?" 를 모르는 것이다.
//   확신이 없으면 말을 안 하고 기다리고, 그러다 시간이 지나 꺼지면 **고장 났다고 생각한다.**
//   그래서 ① 화면을 크게 덮고 ② 듣는 중임을 큰 글씨와 움직임으로 보여주고
//   ③ 말한 내용이 **실시간으로 큰 글씨로** 찍히게 했다. 자기 말이 글자로 보이면 안심한다.
//
// 조작 방식: **한 번 눌러 시작 → 말이 끝나면 자동 종료.**
//   누르고 있는 방식(push-to-talk)은 손 떨림이 있으면 중간에 떼어져 말이 잘린다.
//
// ⚠️ 네이티브 음성 모듈은 lib/voice.js 한 곳으로만 접근한다. 여기서 직접 import 하지 말 것.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Platform, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { startListening, ensureVoicePermission } from '../lib/voice';

const BRAND = '#FF6B35';

export default function VoiceSearchSheet({ visible, onClose, onResult }) {
  const [text, setText] = useState('');          // 지금까지 알아들은 말
  const [phase, setPhase] = useState('ready');   // ready | listening | denied | error
  const [errMsg, setErrMsg] = useState('');
  const sessionRef = useRef(null);
  const pulse = useRef(new Animated.Value(0)).current;
  // 최신 text 를 콜백에서 읽기 위한 보관용 (setState 는 다음 렌더에야 반영된다)
  const textRef = useRef('');
  useEffect(() => { textRef.current = text; }, [text]);

  // 듣는 중 표시 — 원이 천천히 커졌다 작아진다. "살아 있다"는 신호.
  useEffect(() => {
    if (phase !== 'listening') { pulse.stopAnimation(); pulse.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  const stopSession = useCallback((cancel) => {
    const s = sessionRef.current;
    sessionRef.current = null;
    if (!s) return;
    if (cancel) s.cancel(); else s.stop();
  }, []);

  const begin = useCallback(async () => {
    setText(''); setErrMsg('');
    const ok = await ensureVoicePermission();
    if (!ok) { setPhase('denied'); return; }
    setPhase('listening');
    sessionRef.current = startListening({
      onPartial: (t) => setText(t),
      onFinal: (t) => {
        sessionRef.current = null;
        const finalText = (t || textRef.current || '').trim();
        if (finalText) { onResult(finalText); }   // 부모가 창을 닫고 검색을 시작한다
        else { setPhase('error'); setErrMsg('잘 못 들었어요. 다시 한 번 말씀해 주세요.'); }
      },
      onError: (e) => {
        sessionRef.current = null;
        const code = e?.code || '';
        // 'no-speech' = 아무 말 없이 시간이 지난 것. 고장이 아니라 그냥 다시 하면 된다.
        if (code === 'no-speech' || code === 'speech-timeout') {
          setPhase('error'); setErrMsg('소리가 들리지 않았어요. 마이크에 가까이 대고 말씀해 주세요.');
        } else {
          setPhase('error'); setErrMsg('음성 인식을 쓸 수 없어요. 잠시 후 다시 시도해 주세요.');
        }
      },
    });
  }, [onResult]);

  // 창이 열리면 **바로 듣기 시작.** 한 번 더 누르게 하면 그 단계에서 또 막힌다.
  useEffect(() => {
    if (visible) begin();
    else { stopSession(true); setPhase('ready'); setText(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => () => stopSession(true), [stopSession]);   // 화면이 사라질 때 정리

  const close = () => { stopSession(true); onClose(); };

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.08] });

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={close}
           statusBarTranslucent={false} presentationStyle="fullScreen">
      <View style={styles.wrap}>
        {/* 닫기 — 오른쪽 위, 큼직하게 */}
        <TouchableOpacity onPress={close} style={styles.closeBtn} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                          accessibilityRole="button" accessibilityLabel="닫기">
          <Ionicons name="close" size={32} color="#6B7280" />
        </TouchableOpacity>

        <View style={styles.center}>
          {phase === 'listening' && (
            <>
              <Text style={styles.title}>말씀하세요</Text>
              <Text style={styles.sub}>찾으시는 것을 그냥 말씀하시면 됩니다</Text>

              <View style={styles.micArea}>
                <Animated.View style={[styles.ripple, { transform: [{ scale }], opacity }]} />
                <View style={styles.micCircle}>
                  <Ionicons name="mic" size={56} color="#fff" />
                </View>
              </View>

              {/* 말한 내용이 실시간으로 — **크게**. 자기 말이 글자로 보이면 안심한다. */}
              <Text style={[styles.heard, !text && styles.heardWait]} numberOfLines={4}>
                {text || '듣고 있어요…'}
              </Text>
            </>
          )}

          {phase === 'denied' && (
            <>
              <Ionicons name="mic-off-outline" size={64} color="#9CA3AF" />
              <Text style={styles.title}>마이크를 쓸 수 없어요</Text>
              <Text style={styles.sub}>
                말로 검색하시려면 마이크 사용을 허용해 주셔야 해요.{'\n'}
                설정에서 켜실 수 있습니다.
              </Text>
              <TouchableOpacity style={styles.bigBtn} onPress={() => Linking.openSettings()}>
                <Text style={styles.bigBtnText}>설정 열기</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'error' && (
            <>
              <Ionicons name="refresh-circle-outline" size={64} color="#9CA3AF" />
              <Text style={styles.title}>다시 해볼까요?</Text>
              <Text style={styles.sub}>{errMsg}</Text>
              <TouchableOpacity style={styles.bigBtn} onPress={begin}>
                <Text style={styles.bigBtnText}>다시 말하기</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* 아래 큰 버튼 — 듣는 중에는 "다 말했어요"(바로 검색), 그 외엔 닫기 */}
        {phase === 'listening' && (
          <TouchableOpacity style={styles.doneBtn} onPress={() => stopSession(false)} activeOpacity={0.85}
                            accessibilityRole="button" accessibilityLabel="다 말했어요">
            <Text style={styles.doneBtnText}>다 말했어요</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? 12 : 44 },
  closeBtn: { alignSelf: 'flex-end', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  // 글씨는 전부 크게. 이 화면의 대상은 작은 글씨가 안 보이는 분들이다.
  title: { fontSize: 28, fontWeight: '800', color: '#111827', marginTop: 18, textAlign: 'center' },
  sub: { fontSize: 17, color: '#6B7280', marginTop: 10, textAlign: 'center', lineHeight: 25 },
  micArea: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginVertical: 30 },
  ripple: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: BRAND },
  micCircle: {
    width: 112, height: 112, borderRadius: 56, backgroundColor: BRAND,
    alignItems: 'center', justifyContent: 'center',
  },
  heard: { fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center', lineHeight: 34, minHeight: 68 },
  heardWait: { color: '#9CA3AF', fontWeight: '500' },
  bigBtn: {
    marginTop: 26, backgroundColor: BRAND, paddingHorizontal: 34, paddingVertical: 16, borderRadius: 14,
  },
  bigBtnText: { color: '#fff', fontSize: 19, fontWeight: '800' },
  // 손이 닿기 쉬운 화면 아래. 높이도 넉넉히.
  doneBtn: {
    margin: 20, marginBottom: 34, backgroundColor: '#111827', borderRadius: 16,
    paddingVertical: 20, alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontSize: 20, fontWeight: '800' },
});
