/**
 * 지난 호 — 표지를 격자로 늘어놓고, 누르면 그 호 기사로 간다.
 *
 * 표지가 값어치를 하는 곳이 여기다. 한 호에 1장씩 올리면 이 화면에 그대로 쌓인다.
 * 표지를 아직 안 올린 호도 자리를 지킨다(호수 카드로 대신) — 완벽한 운영을 전제하면 깨진다.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { getMagazineIssues } from '../services/wordpressApi';

const { width } = Dimensions.get('window');
const COLS = 3;
const GAP = 12;
const CARD_W = Math.floor((width - GAP * (COLS + 1)) / COLS);
// 표지 비율은 호마다 다를 수 있다(A4·국배판…). 서버가 실제 크기를 주면 그대로,
// 없으면 잡지에서 가장 흔한 A4 비율로 자리를 잡는다.
const FALLBACK_RATIO = 1 / 1.414;

export default function IssueArchiveScreen({ navigation }) {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await getMagazineIssues();
    setIssues(list || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  const renderItem = ({ item }) => {
    const ratio = item.coverWidth && item.coverHeight
      ? item.coverWidth / item.coverHeight
      : FALLBACK_RATIO;
    const h = Math.round(CARD_W / ratio);
    const dateStr = (item.date || '').replace(/-/g, '.');

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('이번호기사', { issueNumber: item.number })}
      >
        {item.coverUrl ? (
          <Image
            source={{ uri: item.coverUrl }}
            style={[styles.cover, { height: h }]}
            contentFit="cover"
            cachePolicy="disk"
            transition={150}
          />
        ) : (
          <View style={[styles.cover, styles.coverEmpty, { height: h }]}>
            <Text style={styles.coverEmptyText}>제{item.number}호</Text>
          </View>
        )}
        <Text style={styles.num}>제{item.number}호</Text>
        {dateStr ? <Text style={styles.date}>{dateStr}</Text> : null}
        <Text style={styles.count}>{item.count}편</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={issues}
        keyExtractor={(i) => String(i.id)}
        renderItem={renderItem}
        numColumns={COLS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            colors={['#FF6B35']}
            tintColor="#FF6B35"
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>등록된 호가 없습니다.</Text>
          </View>
        }
        windowSize={10}
        initialNumToRender={12}
        removeClippedSubviews={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  list: { padding: GAP, paddingBottom: 32 },
  row: { justifyContent: 'flex-start', gap: GAP, marginBottom: 18 },
  card: { width: CARD_W },
  cover: {
    width: CARD_W,
    borderRadius: 6,
    backgroundColor: '#E9ECEF',
    marginBottom: 6,
  },
  coverEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0E6',
    borderWidth: 1,
    borderColor: '#FFD9C7',
  },
  coverEmptyText: { fontSize: 13, fontWeight: '800', color: '#E85A24' },
  num: { fontSize: 13, fontWeight: '700', color: '#212529' },
  date: { fontSize: 11, color: '#868E96', marginTop: 1 },
  count: { fontSize: 11, color: '#ADB5BD', marginTop: 1 },
  emptyText: { fontSize: 15, color: '#868E96' },
});
