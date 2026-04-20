import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  fetchActiveAnnouncement,
  pickLocalizedText,
  dismissAnnouncement,
  trackImpression,
  trackClick,
} from '../services/announcementService';
import { getStyleConfig } from '../utils/announcementStyles';

/**
 * 공지 배너 컴포넌트
 * 관련 문서: directives/ANNOUNCEMENTS_PLAN.md
 *
 * 사용 예:
 *   <AnnouncementBanner targetScreen="News" />
 *
 * 내부 동작:
 *   1. Firestore Announcements 에서 targetScreen에 해당하는 활성 공지 1개 조회
 *   2. showOnce + dismissed 인 배너는 스킵
 *   3. 렌더링 시 impressionsCount +1
 *   4. 링크 클릭 → navigate or Linking.openURL + clicksCount +1
 *   5. X 클릭 → AsyncStorage에 기록 + dismissCount +1 + 컴포넌트 숨김
 */
export default function AnnouncementBanner({ targetScreen, containerStyle }) {
  const navigation = useNavigation();
  const { i18n } = useTranslation();
  const language = (i18n.language || 'ko').split('-')[0];

  const [announcement, setAnnouncement] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [impressionTracked, setImpressionTracked] = useState(false);

  // 공지 조회
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchActiveAnnouncement({ targetScreen, language });
      if (!cancelled) setAnnouncement(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetScreen, language]);

  // 노출 카운트 1회
  useEffect(() => {
    if (announcement && !impressionTracked) {
      trackImpression(announcement.id);
      setImpressionTracked(true);
    }
  }, [announcement, impressionTracked]);

  const handleLinkPress = useCallback(() => {
    if (!announcement || !announcement.link) return;
    const link = announcement.link;
    trackClick(announcement.id);

    try {
      if (link.type === 'internal' && link.target) {
        // React Navigation 탭/스크린 이름으로 이동
        navigation.navigate(link.target);
      } else if (link.type === 'external' && link.target) {
        Linking.openURL(link.target);
      } else if (link.type === 'kakao' && link.target) {
        Linking.openURL(link.target);
      }
    } catch (err) {
      console.warn('[AnnouncementBanner] link handle error:', err?.message);
    }
  }, [announcement, navigation]);

  const handleDismiss = useCallback(() => {
    if (!announcement) return;
    dismissAnnouncement(announcement.id);
    setHidden(true);
  }, [announcement]);

  if (!announcement || hidden) return null;

  const style = getStyleConfig(announcement.style);
  const bgColor = announcement.backgroundColor || style.bg;
  const textColor = announcement.textColor || style.text;
  const iconName = announcement.icon || style.icon;

  const title = pickLocalizedText(announcement.title, language);
  const message = pickLocalizedText(announcement.message, language);
  const linkLabel = announcement.link
    ? pickLocalizedText(announcement.link.label, language)
    : null;

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: bgColor },
        containerStyle,
      ]}
    >
      <Ionicons
        name={iconName}
        size={20}
        color={textColor}
        style={styles.icon}
      />
      <View style={styles.content}>
        {title ? (
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {message ? (
          <Text
            style={[styles.message, { color: textColor }]}
            numberOfLines={2}
          >
            {message}
          </Text>
        ) : null}
      </View>

      {announcement.link && linkLabel ? (
        <TouchableOpacity
          onPress={handleLinkPress}
          style={styles.linkBtn}
          activeOpacity={0.7}
        >
          <Text style={[styles.linkLabel, { color: textColor }]}>
            {linkLabel}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={textColor} />
        </TouchableOpacity>
      ) : null}

      {announcement.dismissible !== false ? (
        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.closeBtn}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Ionicons name="close" size={18} color={textColor} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
      },
      android: { elevation: 1 },
    }),
  },
  icon: {
    marginRight: 10,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 1,
  },
  message: {
    fontSize: 12,
    lineHeight: 16,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  linkLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 2,
  },
  closeBtn: {
    marginLeft: 4,
    padding: 4,
  },
});
