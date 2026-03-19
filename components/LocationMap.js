import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GOOGLE_MAPS_API_KEY = 'AIzaSyByutRuUo-JnpedBT2qnhV-Nzf1S9qbcAU';

// 베트남 주요 도시 좌표 (Geocoding 실패 시 폴백)
const CITY_COORDS = {
  '호치민': { latitude: 10.7769, longitude: 106.7009 },
  'TP.HCM': { latitude: 10.7769, longitude: 106.7009 },
  '하노이': { latitude: 21.0278, longitude: 105.8342 },
  '다낭': { latitude: 16.0544, longitude: 108.2022 },
  '칸토': { latitude: 10.0452, longitude: 105.7469 },
  '나트랑': { latitude: 12.2388, longitude: 109.1967 },
  '후에': { latitude: 16.4637, longitude: 107.5909 },
  '달랏': { latitude: 11.9404, longitude: 108.4583 },
  '붕따우': { latitude: 10.3460, longitude: 107.0843 },
  '호이안': { latitude: 15.8794, longitude: 108.3350 },
};

/**
 * LocationMap - 도시/구/아파트 텍스트를 받아서 지도에 핀 표시
 * @param {string} city - 도시명 (예: "호치민")
 * @param {string} district - 구/동 (예: "1군")
 * @param {string} apartment - 아파트/건물명 (선택)
 * @param {string} label - 지도 상단에 표시할 레이블 (선택)
 */
export default function LocationMap({ city, district, apartment, label }) {
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const mapRef = useRef(null);

  // 주소 쿼리 조합
  const locationQuery = [apartment && apartment !== '기타' ? apartment : null, district, city, 'Vietnam']
    .filter(Boolean)
    .join(', ');

  const cacheKey = `geocode_${locationQuery}`;

  useEffect(() => {
    if (!city && !district) {
      setLoading(false);
      setError(true);
      return;
    }

    const fetchCoords = async () => {
      try {
        // 1. AsyncStorage 캐시 확인
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          setCoords(JSON.parse(cached));
          setLoading(false);
          return;
        }

        // 2. Google Geocoding API 호출
        const encoded = encodeURIComponent(locationQuery);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_MAPS_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results.length > 0) {
          const { lat, lng } = data.results[0].geometry.location;
          const result = { latitude: lat, longitude: lng };
          await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
          setCoords(result);
        } else {
          // 3. Geocoding 실패 시 도시 폴백 좌표 사용
          const fallback = CITY_COORDS[city] || CITY_COORDS['호치민'];
          if (fallback) {
            setCoords(fallback);
          } else {
            setError(true);
          }
        }
      } catch (e) {
        // 4. 네트워크 오류 시 도시 폴백 사용
        const fallback = CITY_COORDS[city];
        if (fallback) {
          setCoords(fallback);
        } else {
          setError(true);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCoords();
  }, [city, district, apartment]);

  // 구글맵 앱으로 열기
  const handleOpenMaps = () => {
    if (!coords) return;
    const query = encodeURIComponent(locationQuery);
    const url = Platform.select({
      ios: `maps:?q=${query}&ll=${coords.latitude},${coords.longitude}`,
      android: `geo:${coords.latitude},${coords.longitude}?q=${query}`,
    });
    Linking.openURL(url).catch(() => {
      // 앱이 없으면 웹으로
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#FF6B35" />
        <Text style={styles.loadingText}>지도 로딩 중...</Text>
      </View>
    );
  }

  if (error || !coords) {
    return null; // 좌표를 못 찾으면 지도 섹션 숨김
  }

  const region = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    latitudeDelta: district ? 0.02 : 0.1,
    longitudeDelta: district ? 0.02 : 0.1,
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.mapWrapper} onPress={handleOpenMaps} activeOpacity={0.95}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          region={region}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          pointerEvents="none"
        >
          <Marker
            coordinate={coords}
            title={label || [city, district].filter(Boolean).join(' ')}
          />
        </MapView>

        {/* 오버레이: 위치 텍스트 + 열기 버튼 */}
        <View style={styles.overlay}>
          <View style={styles.locationBadge}>
            <Ionicons name="location" size={14} color="#FF6B35" />
            <Text style={styles.locationBadgeText} numberOfLines={1}>
              {locationQuery.replace(', Vietnam', '')}
            </Text>
          </View>
          <View style={styles.openButton}>
            <Ionicons name="navigate" size={12} color="#fff" />
            <Text style={styles.openButtonText}>지도 열기</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#888',
  },
  mapWrapper: {
    height: 180,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  locationBadgeText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  openButtonText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
});
