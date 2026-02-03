import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 번역 리소스 import
import ko from './locales/ko';
import vi from './locales/vi';
import en from './locales/en';

const LANGUAGE_KEY = 'app_language';

// 지원 언어 목록
export const SUPPORTED_LANGUAGES = [
  { code: 'ko', name: '한국어', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
];

// 언어 감지 플러그인
const languageDetectorPlugin = {
  type: 'languageDetector',
  async: true,
  detect: async (callback) => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (savedLanguage) {
        callback(savedLanguage);
        return;
      }
    } catch (error) {
      console.log('언어 감지 실패:', error);
    }
    callback('ko'); // 기본 언어
  },
  init: () => {},
  cacheUserLanguage: async (language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, language);
    } catch (error) {
      console.log('언어 저장 실패:', error);
    }
  },
};

// i18next 초기화
i18n
  .use(languageDetectorPlugin)
  .use(initReactI18next)
  .init({
    resources: {
      ko,
      vi,
      en,
    },
    fallbackLng: 'ko',
    defaultNS: 'common',
    ns: ['common', 'auth', 'home', 'jobs', 'realEstate', 'danggn', 'menu', 'navigation', 'profile'],
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

// 언어 변경 함수
export const changeLanguage = async (languageCode) => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, languageCode);
    await i18n.changeLanguage(languageCode);
    console.log('✅ 언어 변경됨:', languageCode);
  } catch (error) {
    console.log('언어 변경 실패:', error);
  }
};

// 현재 언어 가져오기
export const getCurrentLanguage = () => i18n.language;

// 첫 실행 여부 확인
const FIRST_LAUNCH_KEY = 'first_launch_language_selected';

export const isFirstLaunch = async () => {
  try {
    const value = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    return value === null;
  } catch {
    return true;
  }
};

export const setFirstLaunchComplete = async () => {
  try {
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'true');
  } catch (error) {
    console.log('첫 실행 상태 저장 실패:', error);
  }
};

export default i18n;
