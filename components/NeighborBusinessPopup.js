import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Text, Dimensions, Pressable, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');
const HIDE_POPUP_KEY = 'HIDE_NEIGHBOR_BIZ_POPUP';

// 3D Pressable Button Component
const Button3D = ({ onPress, children, style }) => {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={[
        {
          width: '100%',
          backgroundColor: '#c54d20',
          borderRadius: 16,
          height: 65,
          marginTop: 15,
        },
        style
      ]}
    >
      <View
        style={{
          width: '100%',
          backgroundColor: '#FF6B35',
          borderRadius: 16,
          height: 65,
          transform: [{ translateY: pressed ? 6 : 0 }],
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'row',
          paddingHorizontal: 20,
        }}
      >
        {children}
      </View>
    </Pressable>
  );
};

export default function NeighborBusinessPopup({ visible, onClose }) {
  const [isVisible, setIsVisible] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    if (visible) {
      checkPopupVisibility();
    } else {
      setIsVisible(false);
    }
  }, [visible]);

  const checkPopupVisibility = async () => {
    try {
      const hideDate = await AsyncStorage.getItem(HIDE_POPUP_KEY);
      const today = new Date().toDateString();
      if (hideDate !== today) {
        setTimeout(() => {
          setIsVisible(true);
        }, 300);
      } else {
        if (onClose) onClose();
      }
    } catch (e) {
      setIsVisible(true);
    }
  };

  const handleHideToday = async () => {
    try {
      const today = new Date().toDateString();
      await AsyncStorage.setItem(HIDE_POPUP_KEY, today);
      handleClose();
    } catch (e) {
      console.log('Error saving popup state', e);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  const handleNavigate = () => {
    handleClose();
    navigation.navigate('이웃사업');
  };

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          
          {/* Header Theme Container */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeIcon} onPress={handleClose} hitSlop={{top:10, bottom:10, left:10, right:10}}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
            
            <View style={styles.logoWrapper}>
              <Image source={require('../assets/icon.png')} style={styles.logoImage} resizeMode="contain" />
            </View>
            
            <Text style={styles.headerSubtitle}>✨ 새로운 서비스 출현! ✨</Text>
            <Text style={styles.headerTitle}>씬짜오베트남에서{'\n'}알립니다</Text>
          </View>

          {/* Body Content */}
          <View style={styles.content}>
            <Text style={styles.bodyTitle}>
              우리 지역 소식을 한눈에!{'\n'}
              <Text style={styles.highlightText}>"이웃사업 안내"</Text>
            </Text>

            <Text style={styles.description}>
              우리 이웃의 신제품, 파격 이벤트부터{'\n'}동네 업소들의 생생한 소식까지{'\n'}씬짜오 앱에서 가장 먼저 만나보세요.
            </Text>

            <Button3D onPress={handleNavigate}>
              <Ionicons name="apps" size={24} color="#FFF" style={{marginRight: 8}} />
              <View>
                <Text style={styles.btnMainText}>우리 이웃 소식 보기</Text>
              </View>
            </Button3D>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.footerButton} onPress={handleHideToday} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.footerText}>오늘 하루 그만 보기</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.footerButton} onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.footerText}>오늘은 닫기</Text>
            </TouchableOpacity>
          </View>
          
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  container: {
    width: width * 0.9,
    maxHeight: height * 0.85,
    backgroundColor: '#FAFAFA',
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  header: {
    backgroundColor: '#FF6B35',
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    position: 'relative',
  },
  closeIcon: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 20,
    padding: 4,
  },
  logoWrapper: {
    width: 80,
    height: 80,
    backgroundColor: '#FFF',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 8,
    padding: 5,
  },
  logoImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#a03b12',
    backgroundColor: '#FFD166',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 36,
  },
  content: {
    paddingX: 20,
    paddingTop: 30,
    paddingBottom: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  bodyTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#333',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 16,
  },
  highlightText: {
    fontSize: 28,
    color: '#FF6B35',
  },
  description: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  btnMainText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFF',
    height: 56,
  },
  footerButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
  },
  divider: {
    width: 1,
    backgroundColor: '#E0E0E0',
  },
});
