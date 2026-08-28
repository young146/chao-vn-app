/**
 * 신고·차단 시트 (앱 전역 공용)
 *
 * 왜 만들었나 (2026-08-06):
 *   애플은 이용자 생성 콘텐츠가 있는 앱에 "부적절한 콘텐츠 신고 수단"과
 *   "문제 이용자 차단 기능"을 요구한다. 우리 앱(당근·구인구직·부동산·댓글·채팅)에
 *   둘 다 없었다. 화면마다 따로 만들면 반드시 어긋나므로 하나로 만들어 붙인다.
 *
 * 쓰는 법:
 *   const [sheet, setSheet] = useState(false);
 *   <TouchableOpacity onPress={() => setSheet(true)}><Ionicons name="ellipsis-horizontal" .../></TouchableOpacity>
 *   <ReportBlockSheet
 *     visible={sheet} onClose={() => setSheet(false)}
 *     targetType="item" targetId={item.id} targetUserId={item.userId}
 *     targetLabel="이 게시글"
 *     onBlocked={() => navigation.goBack()}   // 차단 후 처리(선택)
 *   />
 *
 * 자기 글에는 띄우지 않는다 — 호출하는 쪽에서 isMine 을 보고 버튼 자체를 숨긴다.
 */
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { REPORT_REASONS, reportContent, blockUser } from '../services/moderationService';
import { auth } from '../firebase/config';

const BRAND = '#FF6B35';

/**
 * 상세화면 맨 아래에 붙이는 "신고 · 차단" 링크.
 * 시트까지 안에서 관리하므로 화면에서는 한 줄이면 된다.
 *
 * @param {boolean} hidden  내 글이면 true — 자기 글을 신고하는 화면은 만들지 않는다
 */
export function ReportLink({ hidden, style, ...sheetProps }) {
  const [open, setOpen] = useState(false);
  if (hidden) return null;

  const openSheet = () => {
    // 신고·차단 모두 "누가 했는지"가 남아야 한다. 비회원은 그걸 만들 수 없다.
    if (!auth?.currentUser) {
      Alert.alert(
        '로그인이 필요합니다',
        '신고와 차단은 회원만 이용할 수 있습니다. 무분별한 신고를 막기 위한 조치입니다.'
      );
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <TouchableOpacity style={[styles.link, style]} onPress={openSheet} activeOpacity={0.7}>
        <Ionicons name="flag-outline" size={14} color="#999" />
        <Text style={styles.linkText}>신고 · 차단</Text>
      </TouchableOpacity>
      <ReportBlockSheet visible={open} onClose={() => setOpen(false)} {...sheetProps} />
    </>
  );
}

export default function ReportBlockSheet({
  visible,
  onClose,
  targetType,
  targetId,
  targetUserId,
  targetLabel = '이 게시글',
  onBlocked,
}) {
  const [step, setStep] = useState('menu');   // menu | reason
  const [reason, setReason] = useState(null);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setStep('menu');
    setReason(null);
    setDetail('');
    setBusy(false);
    onClose?.();
  };

  const submitReport = async () => {
    if (!reason || busy) return;
    setBusy(true);
    const res = await reportContent({ targetType, targetId, targetUserId, reason, detail });
    setBusy(false);
    close();

    // 저장 실패(규칙 미배포 등)여도 사용자를 탓하지 않는다. 접수 자체는 받은 것으로 안내하고
    // 운영자가 확인하도록 남긴다 — 신고하려던 사람에게 오류창을 던지는 게 더 나쁘다.
    Alert.alert(
      '신고가 접수되었습니다',
      res.success
        ? '운영팀이 확인 후 조치하겠습니다. 24시간 이내에 검토합니다.'
        : '접수되었습니다. 운영팀이 확인 후 조치하겠습니다.\n문제가 계속되면 아래 사용자 차단도 이용해 주세요.'
    );
  };

  const confirmBlock = () => {
    if (!targetUserId) {
      Alert.alert('차단할 수 없습니다', '작성자 정보가 없는 게시글입니다. 신고로 접수해 주세요.');
      return;
    }
    Alert.alert(
      '이 사용자를 차단할까요?',
      '차단하면 이 사용자의 게시글과 댓글이 보이지 않고, 채팅도 오지 않습니다.\n언제든 [더보기 → 차단 관리]에서 해제할 수 있습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '차단',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const res = await blockUser(targetUserId);
            setBusy(false);
            close();
            if (res.success) {
              Alert.alert('차단했습니다', '이 사용자의 글이 더 이상 보이지 않습니다.');
              onBlocked?.();
            } else {
              Alert.alert('차단하지 못했습니다', '잠시 후 다시 시도해 주세요.');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={close}>
        {/* 시트 안을 눌렀을 때 닫히지 않도록 이벤트를 여기서 끊는다 */}
        <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
          <View style={styles.handle} />

          {step === 'menu' ? (
            <>
              <Text style={styles.title}>{targetLabel}</Text>

              <TouchableOpacity style={styles.row} onPress={() => setStep('reason')}>
                <Ionicons name="flag-outline" size={21} color="#E53935" />
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>신고하기</Text>
                  <Text style={styles.rowDesc}>스팸·사기·욕설 등 부적절한 내용을 알려주세요</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#BBB" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.row} onPress={confirmBlock}>
                <Ionicons name="person-remove-outline" size={21} color="#555" />
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>이 사용자 차단</Text>
                  <Text style={styles.rowDesc}>이 사람의 글·댓글·채팅이 보이지 않습니다</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancel} onPress={close}>
                <Text style={styles.cancelText}>취소</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => setStep('menu')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="chevron-back" size={22} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>신고 사유</Text>
                <View style={{ width: 22 }} />
              </View>

              <ScrollView style={{ maxHeight: 260 }} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
                {REPORT_REASONS.map((r) => {
                  const on = reason === r.key;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      style={[styles.reason, on && styles.reasonOn]}
                      onPress={() => setReason(r.key)}
                    >
                      <Ionicons
                        name={on ? 'radio-button-on' : 'radio-button-off'}
                        size={19}
                        color={on ? BRAND : '#BBB'}
                      />
                      <Text style={[styles.reasonText, on && styles.reasonTextOn]}>{r.label}</Text>
                    </TouchableOpacity>
                  );
                })}

                <TextInput
                  style={styles.detail}
                  placeholder="자세한 내용을 적어주시면 조치에 도움이 됩니다 (선택)"
                  placeholderTextColor="#AAA"
                  value={detail}
                  onChangeText={setDetail}
                  multiline
                  maxLength={500}
                />
              </ScrollView>

              <TouchableOpacity
                style={[styles.submit, (!reason || busy) && styles.submitOff]}
                onPress={submitReport}
                disabled={!reason || busy}
              >
                {busy
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitText}>신고 접수</Text>}
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 18,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 10 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F1F1F1' },
  rowText: { flex: 1, marginLeft: 12 },
  rowLabel: { fontSize: 15.5, fontWeight: '600', color: '#222' },
  rowDesc: { fontSize: 12.5, color: '#888', marginTop: 2 },

  cancel: { marginTop: 12, paddingVertical: 13, borderRadius: 10, backgroundColor: '#F4F4F5', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#555' },

  reason: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10 },
  reasonOn: { backgroundColor: '#FFF3EC' },
  reasonText: { fontSize: 15, color: '#333', marginLeft: 10 },
  reasonTextOn: { color: BRAND, fontWeight: '600' },

  detail: {
    marginTop: 10, minHeight: 72, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#222', textAlignVertical: 'top',
  },

  submit: { marginTop: 14, paddingVertical: 14, borderRadius: 12, backgroundColor: BRAND, alignItems: 'center' },
  submitOff: { backgroundColor: '#E3E3E3' },
  submitText: { fontSize: 15.5, fontWeight: '700', color: '#fff' },

  // ── ReportLink (상세화면 하단 링크) ──
  // 눈에 띄되 주인공이 아니어야 한다. 회색 작은 글씨로 두되 터치 영역은 넉넉히.
  link: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  linkText: { fontSize: 13, color: '#999', marginLeft: 5, textDecorationLine: 'underline' },
});
