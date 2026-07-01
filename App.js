import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  BackHandler,
  Platform,
  RefreshControl,
  ScrollView,
  Linking,
  Animated,
  StatusBar as RNStatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';

const SITE_URL = 'https://splpro.ru';
const SITE_HOST = 'splpro.ru';
const BRAND_COLOR = '#2D2A26'; // фирменный графит SPL

// Метка приложения в User-Agent — на стороне Bitrix можно определять
// заход из приложения (например, php: strpos($_SERVER['HTTP_USER_AGENT'],'SPLPROApp'))
const APP_UA_TAG = 'SPLPROApp/1.0';

// Высота системной строки на Android (iOS обрабатывает SafeAreaView сам)
const STATUSBAR_HEIGHT = Platform.OS === 'android' ? RNStatusBar.currentHeight || 24 : 0;

// Схемы, которые должна открывать система, а не WebView
const EXTERNAL_SCHEMES = ['tel:', 'mailto:', 'sms:', 'whatsapp:', 'tg:', 'viber:', 'intent:', 'geo:'];

// Выполняется ДО загрузки страницы: помечаем html классом in-app,
// чтобы шаблон Bitrix мог по желанию скрыть шапку/футер через CSS
// (html.in-app .bx-header{display:none}) и ставим флаг для JS сайта.
const INJECTED_BEFORE = `
  (function() {
    try {
      document.documentElement.classList.add('in-app');
      window.isMobileApp = true;
      window.localStorage && localStorage.setItem('is_mobile_app', '1');
    } catch (e) {}
    true;
  })();
`;

export default function App() {
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [canGoBack]);

  const reload = useCallback(() => {
    setError(false);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    webViewRef.current?.reload();
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  const onLoadProgress = useCallback(
    ({ nativeEvent }) => {
      Animated.timing(progress, {
        toValue: nativeEvent.progress,
        duration: 120,
        useNativeDriver: false,
      }).start();
    },
    [progress]
  );

  // Внешние схемы (звонок, почта, мессенджеры) отдаём системе.
  // Все http/https (включая платёжные шлюзы, oauth-редиректы Bitrix)
  // оставляем внутри WebView, чтобы не ломать оплату и авторизацию.
  const onShouldStartLoadWithRequest = useCallback((request) => {
    const url = request.url || '';
    if (EXTERNAL_SCHEMES.some((s) => url.startsWith(s))) {
      Linking.openURL(url).catch(() => {});
      return false;
    }
    return true;
  }, []);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={[styles.container, { paddingTop: STATUSBAR_HEIGHT }]}>
      <StatusBar style="light" backgroundColor={BRAND_COLOR} translucent />

      {error ? (
        <ScrollView
          contentContainerStyle={styles.errorContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.errorTitle}>Нет соединения</Text>
          <Text style={styles.errorText}>
            Не удалось загрузить splpro.ru. Проверьте подключение к интернету.
          </Text>
          <TouchableOpacity style={styles.button} onPress={reload}>
            <Text style={styles.buttonText}>Повторить</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: SITE_URL }}
          style={styles.webview}
          originWhitelist={['*']}
          // --- Bitrix: сессия и хранилище ---
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled            // iOS: общие cookie (авторизация, корзина)
          thirdPartyCookiesEnabled        // Android: сторонние cookie (оплата, метрики)
          // --- User-Agent с меткой приложения ---
          applicationNameForUserAgent={APP_UA_TAG}
          // --- Кэш: ускоряет повторные заходы на тяжёлый Bitrix ---
          cacheEnabled
          cacheMode="LOAD_DEFAULT"
          // --- Формы Bitrix: загрузка файлов, доступ к файловой системе ---
          allowFileAccess
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          // --- Инъекции для интеграции с шаблоном ---
          injectedJavaScriptBeforeContentLoaded={INJECTED_BEFORE}
          // --- Навигация ---
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled
          // --- Производительность ---
          androidLayerType="hardware"
          overScrollMode="never"
          decelerationRate="normal"
          startInLoadingState
          onLoadProgress={onLoadProgress}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
          onError={() => {
            setError(true);
            setLoading(false);
          }}
          onHttpError={() => setLoading(false)}
          renderError={() => null}
        />
      )}

      {loading && !error && (
        <View style={styles.progressTrack} pointerEvents="none">
          <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
        </View>
      )}

      {loading && !error && (
        <View style={styles.loader} pointerEvents="none">
          <ActivityIndicator size="large" color={BRAND_COLOR} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND_COLOR },
  webview: { flex: 1, backgroundColor: '#ffffff' },
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'transparent',
  },
  progressBar: {
    height: 3,
    backgroundColor: BRAND_COLOR,
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  errorContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#ffffff',
  },
  errorTitle: { fontSize: 22, fontWeight: '700', color: '#222', marginBottom: 12 },
  errorText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    backgroundColor: BRAND_COLOR,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
