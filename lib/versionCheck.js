import remoteConfig from '@react-native-firebase/remote-config';
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

// Firebase Remote Config의 min_app_version과 현재 앱 버전을 비교
// 현재 버전이 min_app_version보다 낮으면 true (강제 업데이트 필요)
export const checkForceUpdate = async () => {
  try {
    await remoteConfig().setDefaults({ min_app_version: '0.0.0' });
    await remoteConfig().fetchAndActivate();
    const minVersion = remoteConfig().getValue('min_app_version').asString();
    if (!minVersion || minVersion === '0.0.0') return false;
    const currentVersion = Constants.expoConfig?.version || Constants.manifest?.version || '0.0.0';
    const needsUpdate = isOlderThan(currentVersion, minVersion);
    console.log(`🔍 버전 체크: 현재=${currentVersion}, 최소=${minVersion}, 업데이트필요=${needsUpdate}`);
    return needsUpdate;
  } catch (e) {
    console.log('⚠️ 버전 체크 실패 (무시):', e.message);
    return false;
  }
};
