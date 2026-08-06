/**
 * 차단 관리 — 내가 차단한 사람 목록과 해제
 *
 * 왜 별도 화면인가 (2026-08-06):
 *   애플은 UGC 앱에 "문제 이용자를 차단하는 기능"을 요구하는데, 차단만 되고
 *   *푸는 곳이 없으면* 실수로 차단했을 때 되돌릴 방법이 없다. 심사에서도
 *   해제 수단을 함께 본다.
 *
 * ⚠️ 관리자 화면의 "영구 제명"(회원관리 → bannedUsers)과는 전혀 다른 기능이다.
 *   영구 제명 = 운영자가 악성 회원을 서비스에서 퇴출 (모두에게 영향)
 *   여기 차단 = 이용자가 특정 상대를 내 화면에서만 안 보이게 함 (나에게만 영향)
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getBlockedUsers, unblockUser } from '../services/moderationService';

const BRAND = '#FF6B35';

export default function BlockedUsersScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const blocked = await getBlockedUsers();
    const uids = Array.from(blocked);

    // 이름을 보여주려면 프로필을 읽어야 한다. 차단은 보통 한 자릿수라 개별 조회로 충분하고,
    // 이름을 못 읽어도(탈퇴 등) 목록에서 사라지면 안 된다 — 해제할 방법이 없어지므로.
    const list = await Promise.all(
      uids.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          const d = snap.exists() ? snap.data() : null;
          return { uid, name: d?.name || d?.displayName || '알 수 없는 사용자' };
        } catch (_) {
          return { uid, name: '알 수 없는 사용자' };
        }
      })
    );

    setRows(list);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmUnblock = (row) => {
    Alert.alert(
      '차단을 해제할까요?',
      `${row.name}님의 게시글과 댓글이 다시 보이고, 채팅도 받을 수 있게 됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '해제',
          onPress: async () => {
            const res = await unblockUser(row.uid);
            if (res.success) setRows((prev) => prev.filter((r) => r.uid !== row.uid));
            else Alert.alert('해제하지 못했습니다', '잠시 후 다시 시도해 주세요.');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.notice}>
        차단한 사용자의 게시글·댓글은 내 화면에서만 보이지 않습니다. 상대에게는 알려지지 않습니다.
      </Text>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.uid}
        contentContainerStyle={rows.length === 0 ? styles.emptyWrap : { paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={19} color="#999" />
            </View>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <TouchableOpacity style={styles.unblockBtn} onPress={() => confirmUnblock(item)}>
              <Text style={styles.unblockText}>차단 해제</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="shield-checkmark-outline" size={46} color="#DDD" />
            <Text style={styles.emptyTitle}>차단한 사용자가 없습니다</Text>
            <Text style={styles.emptyDesc}>
              게시글이나 댓글에서 [신고 · 차단]을 눌러 차단할 수 있습니다.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  notice: {
    fontSize: 12.5, color: '#777', lineHeight: 18,
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FAFAFA',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#F2F2F2',
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F1F3',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  name: { flex: 1, fontSize: 15, color: '#222' },
  unblockBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1, borderColor: BRAND,
  },
  unblockText: { fontSize: 13, color: BRAND, fontWeight: '600' },

  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 15.5, fontWeight: '600', color: '#666', marginTop: 14 },
  emptyDesc: { fontSize: 13, color: '#999', textAlign: 'center', marginTop: 6, lineHeight: 19 },
});
