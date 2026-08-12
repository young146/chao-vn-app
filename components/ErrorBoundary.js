import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { restartApp } from '../lib/restartApp';

// 크래시 발생 시 자동 재시작 대기 시간 (초)
const AUTO_RELOAD_SECONDS = 5;

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, countdown: AUTO_RELOAD_SECONDS, reloading: false };
    this._timer = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('💥 앱 크래시 감지:', error?.message);
    console.error(info?.componentStack);
    this._startCountdown();
  }

  componentWillUnmount() {
    if (this._timer) clearInterval(this._timer);
    if (this._hardRestartTimer) clearTimeout(this._hardRestartTimer);
  }

  _startCountdown() {
    this._timer = setInterval(() => {
      this.setState((prev) => {
        if (prev.countdown <= 1) {
          clearInterval(this._timer);
          this._reload();
          return { countdown: 0 };
        }
        return { countdown: prev.countdown - 1 };
      });
    }, 1000);
  }

  async _reload() {
    if (this.state.reloading) return;
    this.setState({ reloading: true });
    try {
      // OTA 번들로 실행 중이면 reloadAsync로 재시작 (이전 버전으로 롤백될 수 있음)
      if (!__DEV__ && Updates.isEnabled) {
        await Updates.reloadAsync();
        // 여기까지 왔는데 화면이 그대로면 reloadAsync 가 *조용히* 실패한 것이다.
        // 안드로이드에서 실제로 그런다 — 예외도 안 나고 아무 일도 안 일어난다.
        // 그러면 사용자는 "재시작 중..." 스피너에 갇힌다(버튼도 사라진 상태).
        // 프로세스를 통째로 재시작하는 최후 수단을 걸어 둔다. 사유는 lib/restartApp.js 참고.
        //
        // ⛔ 안드로이드에서만. iOS 는 이 경로가 원래 잘 동작하고, 거기서 프로세스 재시작을
        //    시도해봐야 옛 번들을 다시 읽을 뿐이다(lib/restartApp.js 상단 주석).
        //    잘 되는 쪽은 건드리지 않는다.
        if (Platform.OS === 'android') {
          this._hardRestartTimer = setTimeout(() => {
            restartApp({ onFailed: () => this._recover() });
          }, 1500);
        }
        return;
      }
      // 개발 모드이거나 Updates 가 꺼져 있으면 재렌더링으로 복구를 시도한다
      this._recover();
    } catch (e) {
      // reloadAsync 실패 시 state 리셋으로 앱 재렌더링 시도
      this._recover();
    }
  }

  /** 재시작이 안 될 때 최소한 화면은 되살린다 (버튼 없는 스피너에 갇히지 않게) */
  _recover() {
    if (this._hardRestartTimer) clearTimeout(this._hardRestartTimer);
    this.setState({ hasError: false, error: null, countdown: AUTO_RELOAD_SECONDS, reloading: false });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { countdown, reloading } = this.state;

    return (
      <View style={styles.container}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>앱 오류 발생</Text>
        <Text style={styles.subtitle}>
          {reloading
            ? '재시작 중...'
            : `${countdown}초 후 자동으로 재시작됩니다`}
        </Text>

        {reloading ? (
          <ActivityIndicator size="large" color="#fff" style={{ marginTop: 24 }} />
        ) : (
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              if (this._timer) clearInterval(this._timer);
              this._reload();
            }}
          >
            <Text style={styles.buttonText}>지금 재시작</Text>
          </TouchableOpacity>
        )}

        {__DEV__ && this.state.error && (
          <Text style={styles.errorText} numberOfLines={6}>
            {this.state.error?.toString()}
          </Text>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#aaaacc',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorText: {
    marginTop: 32,
    fontSize: 11,
    color: '#ff6666',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
