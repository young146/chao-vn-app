import firestore from '@react-native-firebase/firestore';
import Constants from 'expo-constants';

const parseVersion = (v) => (v || '0.0.0').split('.').map(Number);

const isOlderThan = (current, min) => {
  const c = parseVersion(current);
  const m = parseVersion(min);
  for (let i = 0; i < 3; i++) {
    if (c[i] < m[i]) return true;
    if (c[i] > m[i]) return false;
  }
  return false;
};

// Firestore config/appVersion 문서의 minVersion과 현재 앱 버전을 비교
// 현재 버전이 minVersion보다 낮으면 true (강제 업데이트 필요)
export const checkForceUpdate = async () => {
  try {
    const doc = await firestore().collection('config').doc('appVersion').get();
    if (!doc.exists) return false;
    const minVersion = doc.data()?.minVersion;
    if (!minVersion) return false;
    const currentVersion = Constants.expoConfig?.version || Constants.manifest?.version || '0.0.0';
    const needsUpdate = isOlderThan(currentVersion, minVersion);
    console.log(`🔍 버전 체크: 현재=${currentVersion}, 최소=${minVersion}, 업데이트필요=${needsUpdate}`);
    return needsUpdate;
  } catch (e) {
    console.log('⚠️ 버전 체크 실패 (무시):', e.message);
    return false;
  }
};
