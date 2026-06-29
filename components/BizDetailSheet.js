// 진출기업·옐로페이지 상세 팝업 (앱 안에서 보여줌 — 웹뷰로 사이트를 벗어나지 않음)
// 검색결과/AI도우미 결과에서 진출기업·옐로 항목을 탭하면 이 바텀시트가 올라온다.
// 데이터: services/searchService getDirectoryItem → daily-news /api/search/item
//  (웹 /biz/[id] 와 동일 endpoint. 진출기업 원본 보강 + 관리자 수정/기타까지 서버가 병합해 줌)
// 전화=tel: / 이메일=mailto: / 지도=지도앱 / 홈페이지=인앱브라우저. 순수 JS(Modal+Linking) → OTA 안전.
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Modal, Linking, Dimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { getDirectoryItem, TYPE_LABEL } from '../services/searchService';

const ORANGE = '#FF6B35';
// 하단 고정 광고 슬롯(750:250 비율) 높이. 이 화면엔 지금 광고가 없지만,
// 우리 앱은 어느 화면에든 하단 광고가 들어갈 수 있으므로 그 자리만큼 항상 비워둔다.
// → 광고가 나중에 켜져도 전화/지도 버튼이 절대 가려지지 않는다.
const AD_SLOT_RESERVE = Math.round(Dimensions.get('window').width * 250 / 750);

const uniq = (arr) => Array.from(new Set(arr));
const telHref = (p) => `tel:${String(p).replace(/[^0-9+]/g, '')}`;
const openUrl = (url) => { if (url) Linking.openURL(url).catch(() => {}); };

// 웹 /biz/[id] 와 동일한 전화/이메일 분해 로직 (한 칸에 여러 개가 / , ; 로 들어옴)
function splitPhones(item, isCompany) {
  const src = isCompany ? [item.tel, item.mobile] : [item.phone];
  return uniq(
    src.filter(Boolean)
      .flatMap((p) => String(p).split(/[/,]/))
      .map((s) => s.trim())
      .filter(Boolean)
  );
}
function splitEmails(item) {
  return uniq(
    [item.email, item.additionalEmails].filter(Boolean).join(',')
      .split(/[,;/]/).map((s) => s.trim()).filter(Boolean)
  );
}

// 진출기업 상세 항목 행 구성 (웹과 동일 순서)
function buildRows(item, isCompany) {
  const rows = [];
  if (isCompany) {
    if (item.director) rows.push(['대표자', item.director]);
    const ind = [item.industryGroup, item.industryDetail].filter(Boolean).join(' · ');
    if (ind) rows.push(['업종', ind]);
    if (item.description) rows.push(['사업내용', item.description]);
    if (item.address) rows.push(['주소', item.address]);
    if (item.products) rows.push(['주요 제품/서비스', item.products]);
    if (item.employees) rows.push(['고용인원', String(item.employees)]);
    if (item.foundedYear) rows.push(['설립연도', String(item.foundedYear)]);
    if (item.country) rows.push(['국가', item.country]);
  } else if (item.address) {
    rows.push(['주소', item.address]);
  }
  return rows;
}

export default function BizDetailSheet({ visible, seed, onClose }) {
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // 시스템 네비게이션 바(safe-area) + 하단 광고 슬롯 자리만큼 항상 띄운다.
  const bottomReserve = insets.bottom + AD_SLOT_RESERVE;

  // 팝업이 열릴 때마다 seed.id 로 상세를 불러온다. 닫히면 초기화.
  useEffect(() => {
    if (!visible || !seed?.id) return;
    let alive = true;
    setItem(null);
    setFailed(false);
    setLoading(true);
    getDirectoryItem(seed.id)
      .then((it) => { if (alive) { if (it) setItem(it); else setFailed(true); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [visible, seed?.id]);

  // seed(검색결과 카드)로 먼저 그릴 수 있는 값 → 로딩 중에도 제목/이미지가 즉시 보임
  const view = item || seed || {};
  const type = view.type || seed?.type;
  const isCompany = type === 'company';
  const rows = item ? buildRows(item, isCompany) : [];
  const phones = item ? splitPhones(item, isCompany) : [];
  const emails = item ? splitEmails(item) : [];
  const meta = [view.city, view.district, view.category].filter(Boolean).join(' · ');

  const mapQ = item && (item.address || (item.lat && item.lng))
    ? (item.lat && item.lng ? `${item.lat},${item.lng}` : [item.title, item.address].filter(Boolean).join(' '))
    : '';
  const homepage = item ? (item.homepage || item.url) : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: bottomReserve }]}>
          {/* 헤더 */}
          <View style={styles.handleWrap}><View style={styles.handle} /></View>
          <View style={styles.headerRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{TYPE_LABEL[type] || type || ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{view.title || ''}</Text>
            {view.imageUrl ? (
              <ExpoImage source={{ uri: view.imageUrl }} style={styles.image} contentFit="cover" />
            ) : null}
            {!!meta && <Text style={styles.meta}>{meta}</Text>}

            {loading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={ORANGE} />
                <Text style={styles.loadingText}>상세 정보 불러오는 중…</Text>
              </View>
            )}

            {failed && !loading && (
              <Text style={styles.failText}>상세 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</Text>
            )}

            {item && (
              <View style={styles.detail}>
                {rows.map(([label, value]) => (
                  <View key={label} style={styles.row}>
                    <Text style={styles.rowLabel}>{label}</Text>
                    <Text style={styles.rowValue}>{value}</Text>
                  </View>
                ))}

                {phones.length > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>전화</Text>
                    <View style={styles.linkWrap}>
                      {phones.map((p) => (
                        <TouchableOpacity key={p} onPress={() => openUrl(telHref(p))}>
                          <Text style={styles.link}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {emails.length > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>이메일</Text>
                    <View style={styles.linkWrap}>
                      {emails.map((e) => (
                        <TouchableOpacity key={e} onPress={() => openUrl(`mailto:${e}`)}>
                          <Text style={styles.link}>{e}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {!!item.extra && (
                  <View style={styles.extraBox}>
                    <Text style={styles.extraLabel}>기타</Text>
                    <Text style={styles.extraText}>{item.extra}</Text>
                  </View>
                )}

                {/* 액션 버튼 */}
                <View style={styles.actions}>
                  {phones.length > 0 && (
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => openUrl(telHref(phones[0]))} activeOpacity={0.85}>
                      <Text style={styles.primaryBtnText}>📞 전화하기</Text>
                    </TouchableOpacity>
                  )}
                  {!!mapQ && (
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => openUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQ)}`)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.secondaryBtnText}>📍 지도 보기</Text>
                    </TouchableOpacity>
                  )}
                  {!!homepage && (
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => { WebBrowser.openBrowserAsync(homepage).catch(() => {}); }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.secondaryBtnText}>🌐 홈페이지</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.notice}>
                  정보가 다르거나 폐업했나요? 씬짜오 베트남으로 알려주시면 업데이트합니다.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  // paddingBottom 은 컴포넌트에서 safe-area + 광고슬롯 만큼 동적으로 주입(아래 bottomReserve)
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '90%' },
  handleWrap: { alignItems: 'center', paddingTop: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 10 },
  badge: { backgroundColor: '#F3E8FF', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { color: '#7C3AED', fontSize: 12, fontWeight: '700' },
  close: { fontSize: 18, color: '#9CA3AF', fontWeight: '700', paddingHorizontal: 6 },

  body: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 8 },
  title: { fontSize: 21, fontWeight: '800', color: '#111827', marginTop: 4 },
  image: { width: '100%', height: 180, borderRadius: 14, backgroundColor: '#F3F4F6', marginTop: 12 },
  meta: { fontSize: 13, color: '#6B7280', marginTop: 8 },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 24 },
  loadingText: { color: '#9CA3AF', fontSize: 14 },
  failText: { color: '#9CA3AF', fontSize: 14, paddingVertical: 24, textAlign: 'center' },

  detail: { marginTop: 16 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  rowLabel: { width: 86, flexShrink: 0, color: '#9CA3AF', fontSize: 14 },
  rowValue: { flex: 1, color: '#1F2937', fontSize: 14, lineHeight: 21 },
  linkWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  link: { color: ORANGE, fontSize: 14, fontWeight: '600' },

  extraBox: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginTop: 4, marginBottom: 8 },
  extraLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', marginBottom: 4 },
  extraText: { fontSize: 14, color: '#1F2937', lineHeight: 21 },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  primaryBtn: { backgroundColor: ORANGE, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  secondaryBtnText: { color: '#374151', fontSize: 15, fontWeight: '600' },

  notice: { marginTop: 18, fontSize: 12, color: '#9CA3AF', lineHeight: 18 },
});
