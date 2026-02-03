/**
 * TranslatedText - 동적 콘텐츠 번역 컴포넌트
 * 
 * Firebase 등에서 가져온 동적 텍스트를 Google Cloud Translation API를 통해
 * 현재 언어로 번역합니다.
 */

import React, { useState, useEffect, memo } from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { translateText } from '../services/TranslationService';

const TranslatedText = memo(({ children, style, numberOfLines, ...props }) => {
  const { i18n } = useTranslation();
  const [translatedText, setTranslatedText] = useState(children);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const currentLang = i18n.language;
    
    // 한국어거나 children이 없으면 번역하지 않음
    if (currentLang === 'ko' || !children || typeof children !== 'string') {
      setTranslatedText(children);
      return;
    }

    // 번역 실행
    const translate = async () => {
      setIsLoading(true);
      try {
        const result = await translateText(children, currentLang);
        setTranslatedText(result);
      } catch (error) {
        console.error('번역 실패:', error);
        setTranslatedText(children); // 실패 시 원본 표시
      } finally {
        setIsLoading(false);
      }
    };

    translate();
  }, [children, i18n.language]);

  return (
    <Text style={style} numberOfLines={numberOfLines} {...props}>
      {translatedText}
    </Text>
  );
});

TranslatedText.displayName = 'TranslatedText';

export default TranslatedText;
