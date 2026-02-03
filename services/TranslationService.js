/**
 * Google Cloud Translation API 서비스
 * 동적 콘텐츠(사용자 생성 게시물 등)를 실시간 번역
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Google Cloud Translation API 키
const GOOGLE_TRANSLATE_API_KEY = 'AIzaSyAbQLuGH_zDNwqh0wnEzGxaDcLKFx0MFk8';
const TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';

// 번역 캐시 키 prefix
const TRANSLATION_CACHE_PREFIX = 'translation_cache_';
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7일

/**
 * 텍스트 번역
 * @param {string} text - 번역할 텍스트
 * @param {string} targetLang - 목표 언어 ('ko', 'vi', 'en')
 * @param {string} sourceLang - 원본 언어 (선택, 자동 감지)
 * @returns {Promise<string>} 번역된 텍스트
 */
export const translateText = async (text, targetLang, sourceLang = null) => {
  if (!text || text.trim() === '') return text;
  
  // 같은 언어면 번역 불필요
  if (sourceLang === targetLang) return text;
  
  // 한국어로 번역할 필요 없음 (원본이 한국어)
  if (targetLang === 'ko') return text;
  
  try {
    // 캐시 확인
    const cacheKey = `${TRANSLATION_CACHE_PREFIX}${targetLang}_${hashCode(text)}`;
    const cached = await getCachedTranslation(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Google Translation API 호출
    const params = new URLSearchParams({
      key: GOOGLE_TRANSLATE_API_KEY,
      q: text,
      target: targetLang,
    });
    
    if (sourceLang) {
      params.append('source', sourceLang);
    }
    
    const response = await fetch(`${TRANSLATE_API_URL}?${params.toString()}`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      console.log('번역 API 에러:', response.status);
      return text; // 실패 시 원문 반환
    }
    
    const data = await response.json();
    const translatedText = data.data?.translations?.[0]?.translatedText || text;
    
    // HTML 엔티티 디코딩
    const decodedText = decodeHtmlEntities(translatedText);
    
    // 캐시 저장
    await cacheTranslation(cacheKey, decodedText);
    
    return decodedText;
  } catch (error) {
    console.log('번역 실패:', error?.message);
    return text; // 실패 시 원문 반환
  }
};

/**
 * 여러 텍스트 일괄 번역
 * @param {string[]} texts - 번역할 텍스트 배열
 * @param {string} targetLang - 목표 언어
 * @returns {Promise<string[]>} 번역된 텍스트 배열
 */
export const translateTexts = async (texts, targetLang) => {
  if (!texts || texts.length === 0) return texts;
  if (targetLang === 'ko') return texts;
  
  try {
    // 빈 텍스트 필터링 및 인덱스 추적
    const validTexts = [];
    const indices = [];
    
    texts.forEach((text, index) => {
      if (text && text.trim() !== '') {
        validTexts.push(text);
        indices.push(index);
      }
    });
    
    if (validTexts.length === 0) return texts;
    
    // 캐시 확인 및 미캐시 항목 분리
    const results = [...texts];
    const uncachedTexts = [];
    const uncachedIndices = [];
    
    for (let i = 0; i < validTexts.length; i++) {
      const cacheKey = `${TRANSLATION_CACHE_PREFIX}${targetLang}_${hashCode(validTexts[i])}`;
      const cached = await getCachedTranslation(cacheKey);
      
      if (cached) {
        results[indices[i]] = cached;
      } else {
        uncachedTexts.push(validTexts[i]);
        uncachedIndices.push(indices[i]);
      }
    }
    
    // 캐시에 없는 항목만 API 호출
    if (uncachedTexts.length > 0) {
      const params = new URLSearchParams({
        key: GOOGLE_TRANSLATE_API_KEY,
        target: targetLang,
      });
      
      uncachedTexts.forEach(text => params.append('q', text));
      
      const response = await fetch(`${TRANSLATE_API_URL}?${params.toString()}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        const translations = data.data?.translations || [];
        
        for (let i = 0; i < translations.length; i++) {
          const translatedText = decodeHtmlEntities(translations[i].translatedText);
          results[uncachedIndices[i]] = translatedText;
          
          // 캐시 저장
          const cacheKey = `${TRANSLATION_CACHE_PREFIX}${targetLang}_${hashCode(uncachedTexts[i])}`;
          await cacheTranslation(cacheKey, translatedText);
        }
      }
    }
    
    return results;
  } catch (error) {
    console.log('일괄 번역 실패:', error?.message);
    return texts;
  }
};

// 캐시 관련 유틸리티
const getCachedTranslation = async (key) => {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) {
      const { text, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_EXPIRY) {
        return text;
      }
      // 만료된 캐시 삭제
      await AsyncStorage.removeItem(key);
    }
    return null;
  } catch {
    return null;
  }
};

const cacheTranslation = async (key, text) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({
      text,
      timestamp: Date.now(),
    }));
  } catch {
    // 캐시 저장 실패 무시
  }
};

// 문자열 해시 생성 (캐시 키용)
const hashCode = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

// HTML 엔티티 디코딩
const decodeHtmlEntities = (text) => {
  if (!text) return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
};

// 번역 캐시 초기화
export const clearTranslationCache = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const translationKeys = keys.filter(key => key.startsWith(TRANSLATION_CACHE_PREFIX));
    await AsyncStorage.multiRemove(translationKeys);
    console.log(`번역 캐시 ${translationKeys.length}개 삭제됨`);
  } catch (error) {
    console.log('캐시 초기화 실패:', error?.message);
  }
};

export default {
  translateText,
  translateTexts,
  clearTranslationCache,
};
