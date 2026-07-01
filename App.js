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
  Image,
  StatusBar as RNStatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';

const SITE_URL = 'https://splpro.ru';
const SITE_HOST = 'splpro.ru';
const BRAND_COLOR = '#2D2A26'; // фирменный графит SPL

// Логотипы из бандла — показываются мгновенно, без обращения к сети
const LOGO_MARK = require('./assets/adaptive-icon.png'); // белая марка для тёмной заставки
const LOGO_ICON = require('./assets/icon.png'); // полный знак для светлого экрана ошибки

// Максимум держим заставку, даже если сайт не ответил (мс)
const SPLASH_MAX_MS = 12000;

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
  const [splashVisible, setSplashVisible] = useState(true);
  const progress = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  // Плавно убрать брендовую заставку после первой загрузки
  const hideSplash = useCallback(() => {
    Animated.timing(splashOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => setSplashVisible(false));
  }, [splashOpacity]);

  // Страховка: не держать заставку вечно, если сайт не ответил
  useEffect(() => {
    const t = setTimeout(() => hideSplash(), SPLASH_MAX_MS);
    return () => clearTimeout(t);
  }, [hideSplash]);

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
      // Показать сайт раньше — не дожидаясь полной загрузки тяжёлого Bitrix
      if (nativeEvent.progress >= 0.7) hideSplash();
    },
    [progress, hideSplash]
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
          <Image source={LOGO_ICON} style={styles.errorLogo} resizeMode="contain" />
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
          onLoadEnd={() => {
            setLoading(false);
            hideSplash();
          }}
          onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
          onError={() => {
            setError(true);
            setLoading(false);
            hideSplash();
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

      {splashVisible && (
        <Animated.View
          style={[styles.splash, { opacity: splashOpacity }]}
          pointerEvents={loading ? 'auto' : 'none'}
        >
          <Image source={LOGO_MARK} style={styles.splashLogo} resizeMode="contain" />
          <ActivityIndicator size="small" color="#ffffff" style={{ marginTop: 26 }} />
          <Text style={styles.splashText}>Загрузка…</Text>
        </Animated.View>
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
  splash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLOR,
  },
  splashLogo: {
    width: 180,
    height: 180,
  },
  splashText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 12,
    letterSpacing: 1,
  },
  errorLogo: {
    width: 96,
    height: 96,
    marginBottom: 24,
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
