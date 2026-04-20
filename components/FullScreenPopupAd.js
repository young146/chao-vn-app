import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Dimensions, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit, updateDoc, doc, increment } from 'firebase/firestore';

const { width, height } = Dimensions.get('window');

export default function FullScreenPopupAd() {
  const [visible, setVisible] = useState(false);
  const [ad, setAd] = useState(null);

  useEffect(() => {
    fetchActivePopupAd();
  }, []);

  const fetchActivePopupAd = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const q = query(
        collection(db, 'app_ads'),
        where('position', '==', 'popup'),
        where('isActive', '==', true),
        where('startDate', '<=', today),
        where('endDate', '>=', today),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const adData = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
        setAd(adData);
        
        // 10초 지연 후 표시
        setTimeout(() => {
          setVisible(true);
          // 노출 성공 시 impressions 증가
          updateDoc(doc(db, 'app_ads', adData.id), {
            impressions: increment(1)
          }).catch(err => console.log('Impression update failed', err));
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
      updateDoc(doc(db, 'app_ads', ad.id), {
        clicks: increment(1)
      }).catch(err => console.log('Click update failed', err));

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
