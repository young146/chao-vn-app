/**
 * 언어 선택 화면 - 첫 실행 시 또는 설정에서 사용
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, changeLanguage } from '../i18n';


const LanguageSelectScreen = ({ onComplete, showHeader = false }) => {
  const { i18n } = useTranslation();
  const [selectedLang, setSelectedLang] = useState(i18n.language || 'ko');

  // 언어 선택 즉시 앱 시작
  const handleSelect = async (langCode) => {
    setSelectedLang(langCode);
    await changeLanguage(langCode);
    if (onComplete) {
      onComplete();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <View style={styles.content}>
        {/* 상단 콘텐츠 */}
        <View style={styles.topSection}>
          {/* 로고/아이콘 */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🌏</Text>
            <Text style={styles.appName}>ChaoVN</Text>
          </View>

          {/* 언어 선택 안내 */}
          <Text style={styles.selectText}>
            언어를 선택하면 앱이 시작됩니다{'\n'}
            Chọn ngôn ngữ để bắt đầu{'\n'}
            Tap your language to start
          </Text>

          {/* 언어 버튼들 */}
          <View style={styles.languageList}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageButton,
                  selectedLang === lang.code && styles.languageButtonSelected,
                ]}
                onPress={() => handleSelect(lang.code)}
                activeOpacity={0.7}
              >
                <Text style={styles.languageFlag}>{lang.flag}</Text>
                <View style={styles.languageTextContainer}>
                  <Text style={[
                    styles.languageName,
                    selectedLang === lang.code && styles.languageNameSelected,
                  ]}>
                    {lang.nativeName}
                  </Text>
                  {lang.code !== 'en' && (
                    <Text style={styles.languageNameEnglish}>{lang.name}</Text>
                  )}
                </View>
                {selectedLang === lang.code && (
                  <Text style={styles.checkMark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  topSection: {
    alignItems: 'center',
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FF6B35',
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 18,
    color: '#666',
    marginVertical: 2,
  },
  selectText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  languageList: {
    width: '100%',
    marginBottom: 32,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  languageButtonSelected: {
    backgroundColor: '#FFF5F0',
    borderColor: '#FF6B35',
  },
  languageFlag: {
    fontSize: 32,
    marginRight: 16,
  },
  languageTextContainer: {
    flex: 1,
  },
  languageName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  languageNameSelected: {
    color: '#FF6B35',
  },
  languageNameEnglish: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  checkMark: {
    fontSize: 24,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
});

export default LanguageSelectScreen;
