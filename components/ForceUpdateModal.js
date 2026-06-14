import React from 'react';
import { Modal, View, Text, TouchableOpacity, Platform, Linking, StyleSheet } from 'react-native';

const IOS_URL = 'https://apps.apple.com/app/id6480538597';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.yourname.chaovnapp';

export default function ForceUpdateModal({ visible }) {
  const handleUpdate = () => {
    Linking.openURL(Platform.OS === 'ios' ? IOS_URL : ANDROID_URL);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.emoji}>🚨</Text>
          <Text style={s.title}>앱 업데이트가 필요합니다</Text>
          <Text style={s.message}>
            현재 사용 중인 버전은 더 이상 지원되지 않습니다.{'\n\n'}
            최신 버전에서는 호텔 예약(Booking·Agoda), 항공권(Trip.com) 등{'\n'}
            새로운 기능을 모두 이용하실 수 있습니다.{'\n\n'}
            아래 버튼을 눌러 지금 바로 업데이트해 주세요.
          </Text>
          <View style={s.steps}>
            {Platform.OS === 'ios' ? (
              <>
                <Text style={s.step}>① 아래 버튼 → App Store 이동</Text>
                <Text style={s.step}>② "씬짜오" 앱 옆 [업데이트] 탭</Text>
                <Text style={s.step}>③ 설치 완료 후 앱을 다시 여세요</Text>
              </>
            ) : (
              <>
                <Text style={s.step}>① 아래 버튼 → Play 스토어 이동</Text>
                <Text style={s.step}>② "씬짜오" 앱 옆 [업데이트] 탭</Text>
                <Text style={s.step}>③ 설치 완료 후 앱을 다시 여세요</Text>
              </>
            )}
          </View>
          <TouchableOpacity style={s.button} onPress={handleUpdate} activeOpacity={0.85}>
            <Text style={s.buttonText}>
              {Platform.OS === 'ios' ? '📱 App Store에서 업데이트' : '📱 Play Store에서 업데이트'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
  },
  emoji: { fontSize: 52, marginBottom: 14 },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  steps: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    gap: 6,
  },
  step: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#e8382e',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
