import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Dimensions, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFilteredAds, trackFirebaseAdImpression, trackFirebaseAdClick } from '../services/FirebaseAdService';

const { width, height } = Dimensions.get('window');

export default function FullScreenPopupAd() {
  const [visible, setVisible] = useState(false);
  const [ad, setAd] = useState(null);

  useEffect(() => {
    fetchActivePopupAd();
  }, []);

  const fetchActivePopupAd = async () => {
    try {
      // 'popup' 위치의 광고를 가져오며, 'home' 페이지용으로 타겟팅된 광고를 검색
      const adList = await getFilteredAds('popup', 'home');
      
      if (adList && adList.length > 0) {
        // 우선순위에 따른 랜덤 선택 가능하지만, 여기서는 첫 번째 광고를 사용하거나 
        // 별도의 랜덤 로직을 적용할 수 있습니다. 이미 getFilteredAds가 우선순위 정렬을 해줍니다.
        const adData = adList[0];
        setAd(adData);
        
        // 10초 지연 후 표시
        setTimeout(() => {
          setVisible(true);
          // 노출 성공 시 impressions 증가
          trackFirebaseAdImpression(adData.id);
        }, 10000);
      }
    } catch (error) {
      console.error('Error fetching popup ad:', error);
    }
  };

  const handleClose = () => {
    setVisible(false);
  };

  const handlePress = async () => {
    if (ad?.linkUrl) {
      // 클릭수 증가
      trackFirebaseAdClick(ad.id);

      Linking.openURL(ad.linkUrl).catch(err => console.error('Failed to open link:', err));
      setVisible(false);
    }
  };

  if (!ad || !ad.images?.[0]) return null;

  const imageUrl = ad.images[0];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          activeOpacity={1} 
          style={styles.container}
          onPress={handlePress}
        >
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.fullImage} 
            resizeMode="cover" 
          />
          
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={handleClose}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Ionicons name="close-circle" size={36} color="rgba(255, 255, 255, 0.8)" />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width,
    height: height,
    position: 'relative',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 50, // 상태바 고려
    right: 20,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 10,
  },
});
