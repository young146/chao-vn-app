/**
 * 이번 호 기사 — 한 호에 실린 기사를 꼭지별로 묶어 보여준다.
 *
 * 왜 '목차'가 아니라 '기사'인가 (2026-08-06 사장님과 정리):
 *   잡지에 실린 기사 중 웹에 올라온 것만 여기 나온다. "목차"라고 부르면 완결성을
 *   약속하는 셈이고, 빠진 항목이 있으면 거짓말이 된다. 여기 나오는 항목은 전부
 *   웹에 있는 기사이므로 **링크가 깨질 일이 없다**.
 *   나중에 전 기사를 올리게 되면 그때 이름만 '목차'로 바꾸면 된다.
 *
 * 화면은 서버가 묶어 준 그대로 그린다 — 기사가 올라오면 이 화면이 저절로 채워진다.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import { getMagazineIssue, MAGAZINE_BASE_URL } from '../services/wordpressApi';
import TranslatedText from '../components/TranslatedText';

const decodeTitle = (t) => {
  const raw = typeof t === 'string' ? t : (t?.rendered || '');
  return raw.replace(/&#[0-9]+;/g, (m) => String.fromCharCode(m.match(/[0-9]+/)));
};

export default function IssueContentsScreen({ navigation, route }) {
  const { issueNumber = null } = route.params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await getMagazineIssue(issueNumber);
    setData(res);
    setLoading(false);
    setRefreshing(false);
  }, [issueNumber]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const n = data?.issue?.number;
    if (n) navigation.setOptions({ title: `제${n}호` });
  }, [data, navigation]);

  const openPost = (post) => {
    navigation.navigate('PostDetail', {
      post: {
        id: `issue-${post.postId}`,
        postId: post.postId,
        title: post.title,
        date: post.date,
        link: post.link,
        categories: post.categories || [],
        _embedded: { 'wp:featuredmedia': [{ source_url: post.thumbnail || undefined }] },
      },
      baseUrl: MAGAZINE_BASE_URL,
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!data?.issue) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>호 정보를 불러오지 못했습니다.</Text>
      </View>
    );
  }

  const { issue, groups = [], total = 0 } = data;
  const dateStr = (issue.date || '').replace(/-/g, '.');
  const label = issue.number ? `제${issue.number}호` : issue.title;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            colors={['#FF6B35']}
            tintColor="#FF6B35"
          />
        }
      >
        {/* 표지 */}
        <View style={styles.head}>
          {issue.coverUrl ? (
            <Image source={{ uri: issue.coverUrl }} style={styles.cover} contentFit="cover" cachePolicy="disk" />
          ) : (
            <View style={[styles.cover, styles.coverEmpty]}>
              <Text style={styles.coverEmptyText}>{label}</Text>
            </View>
          )}
          <Text style={styles.title}>{label}</Text>
          {dateStr ? <Text style={styles.meta}>{dateStr} 발행</Text> : null}
          <Text style={styles.meta}>기사 {total}편</Text>
        </View>

        {/* 기사가 아직 없을 때 — 발행 전이면 그렇게 말해준다 */}
        {total === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>아직 올라온 기사가 없습니다.</Text>
            <Text style={styles.emptySub}>
              {dateStr ? `${dateStr} 발행에 맞춰 기사가 올라옵니다.` : '기사를 준비하고 있습니다.'}
            </Text>
          </View>
        )}

        {/* 꼭지별 묶음 — 잡지 목차가 원래 이렇게 생겼다 */}
        {groups.map((g) => (
          <View key={g.section} style={styles.group}>
            <Text style={styles.groupTitle}>{g.section}</Text>
            {g.posts.map((p) => (
              <TouchableOpacity
                key={p.postId}
                style={styles.row}
                onPress={() => openPost(p)}
                activeOpacity={0.7}
              >
                {p.thumbnail ? (
                  <Image source={{ uri: p.thumbnail }} style={styles.thumb} contentFit="cover" cachePolicy="disk" />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]} />
                )}
                <TranslatedText style={styles.rowTitle} numberOfLines={2}>
                  {decodeTitle(p.title)}
                </TranslatedText>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa' },
  content: { paddingBottom: 32 },

  head: { alignItems: 'center', paddingTop: 20, paddingBottom: 18, backgroundColor: '#fff' },
  cover: {
    width: 160,
    height: 213, // 3:4
    borderRadius: 8,
    backgroundColor: '#F1F3F5',
    marginBottom: 14,
  },
  coverEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0E6',
    borderWidth: 1,
    borderColor: '#FFD9C7',
  },
  coverEmptyText: { fontSize: 18, fontWeight: '800', color: '#E85A24' },
  title: { fontSize: 22, fontWeight: '800', color: '#212529' },
  meta: { fontSize: 13, color: '#868E96', marginTop: 4 },

  group: { marginTop: 18 },
  groupTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E85A24',
    marginHorizontal: 16,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  thumb: { width: 64, height: 48, borderRadius: 6, backgroundColor: '#E9ECEF', marginRight: 12 },
  thumbEmpty: { borderWidth: 1, borderColor: '#DEE2E6' },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#212529', lineHeight: 19 },

  emptyBox: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyText: { fontSize: 15, color: '#868E96', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#ADB5BD', textAlign: 'center', marginTop: 6 },
});
