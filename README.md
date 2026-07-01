# SPLPRO — мобильное приложение

Приложение на **React Native (Expo)**, которое открывает сайт **https://splpro.ru** внутри полноэкранного WebView.

Возможности:
- Полноэкранное отображение сайта splpro.ru
- Индикатор загрузки
- Обработка кнопки «Назад» на Android (навигация по истории сайта)
- Экран ошибки с кнопкой «Повторить» при отсутствии интернета
- Pull-to-refresh
- Иконки и splash-экран с брендом SPL

## Структура проекта

```
SplproApp/
├── App.js            # Основной экран с WebView
├── index.js          # Точка входа
├── app.json          # Конфигурация Expo (имя, иконки, package id)
├── eas.json          # Конфигурация облачной сборки EAS
├── package.json      # Зависимости
├── babel.config.js
└── assets/           # Иконки и splash
```

Адрес сайта задаётся константой `SITE_URL` в файле `App.js`.

## Оптимизации под 1С-Битрикс

Приложение настроено с учётом того, что сайт работает на Bitrix:

- **Сессия и cookie** — `sharedCookiesEnabled` (iOS) и `thirdPartyCookiesEnabled` (Android) сохраняют авторизацию, корзину и сессию Bitrix между запусками.
- **Метка приложения в User-Agent** — добавляется `SPLPROApp/1.0`. На бэкенде можно определять заход из приложения:
  ```php
  if (strpos($_SERVER['HTTP_USER_AGENT'], 'SPLPROApp') !== false) {
      // отдать облегчённый шаблон / скрыть шапку
  }
  ```
- **Хук для шаблона** — до загрузки страницы к `<html>` добавляется класс `in-app`, в JS ставится `window.isMobileApp = true` и `localStorage.is_mobile_app = '1'`. Можно скрыть лишние блоки прямо в CSS шаблона:
  ```css
  html.in-app .bx-header,
  html.in-app .bx-footer { display: none; }
  ```
- **Платежи и авторизация не ломаются** — все http/https переходы (ЮKassa, Сбербанк, oauth-редиректы) остаются внутри WebView. Наружу в систему уходят только `tel:`, `mailto:`, `sms:`, `whatsapp:`, `tg:`, `viber:`.
- **Прогресс-бар загрузки** — тонкая полоса сверху, т.к. страницы Bitrix бывают тяжёлыми.
- **Кэширование** — `cacheEnabled` + `LOAD_DEFAULT` ускоряют повторные заходы. Для максимального эффекта включите на сайте композитный кэш Bitrix.
- **Загрузка файлов из форм** — разрешён доступ к камере и галерее (права в `app.json`), формы с `input[type=file]` работают.
- **Производительность** — аппаратный слой отрисовки на Android, отключён overscroll.

Рекомендация на стороне сайта: включить **композитный сайт (Composite)** в Битрикс и адаптивный/мобильный шаблон — это сильнее всего ускорит приложение.

---

## Как запустить и собрать

Внутри среды Claude собрать APK нельзя (нет доступа к npm-реестру и Android SDK).
Ниже — три способа получить приложение на вашем компьютере. Для всех нужен установленный **Node.js LTS** (18+).

### 0. Установка зависимостей (один раз)

```bash
cd SplproApp
npm install
```

### Вариант A — быстро проверить на телефоне (без сборки)

1. Установите на телефон приложение **Expo Go** (Google Play / App Store).
2. В папке проекта выполните:
   ```bash
   npx expo start
   ```
3. Отсканируйте QR-код камерой (iOS) или в Expo Go (Android). Приложение откроется мгновенно.

### Вариант 🚀 — залить на GitHub и собрать там ОДНОЙ командой

APK соберётся автоматически на серверах GitHub (файл `.github/workflows/build-android.yml`).
Нужен установленный и авторизованный [GitHub CLI](https://cli.github.com/): один раз выполните `gh auth login`.

Затем из папки проекта — одна команда, которая создаёт репозиторий, заливает код,
дожидается сборки и скачивает готовый `splpro.apk` в текущую папку:

```bash
cd SplproApp && git init -b main && git add -A && git commit -m "SPLPRO app" && gh repo create splpro-app --public --source=. --push && sleep 15 && gh run watch --exit-status && gh run download -n splpro-apk
```

Готовый APK также появится на странице **Releases** репозитория (тег `latest`) и в разделе **Actions → Artifacts**.

> Собирается **debug APK** — его можно сразу установить на любой Android (разрешите «установку из неизвестных источников»). Для публикации в Google Play нужна подписанная release-сборка — см. Вариант B.

### Вариант B — собрать APK/IPA в облаке (рекомендуется, Android Studio не нужен)

Самый простой способ получить готовый `.apk` / `.aab` / `.ipa`:

```bash
npm install -g eas-cli
eas login              # нужен бесплатный аккаунт expo.dev
eas build:configure

# Android APK (для установки на телефон напрямую):
eas build -p android --profile preview

# Android App Bundle для Google Play:
eas build -p android --profile production

# iOS (нужен платный Apple Developer аккаунт):
eas build -p ios --profile production
```

По завершении EAS даст ссылку на скачивание готового файла.

### Вариант C — локальная сборка APK (нужен Android SDK)

Требования: **JDK 17**, **Android Studio** + Android SDK, переменная `ANDROID_HOME`.

```bash
cd SplproApp
npx expo prebuild -p android      # генерирует папку android/
cd android
./gradlew assembleRelease          # APK: android/app/build/outputs/apk/release/
```

Готовый APK будет в `android/app/build/outputs/apk/release/app-release.apk`.

Для iOS (только на macOS с Xcode):
```bash
npx expo prebuild -p ios
npx expo run:ios
```

---

## Настройка

- **Изменить сайт:** откройте `App.js`, поменяйте `SITE_URL`.
- **Изменить название/иконку:** отредактируйте `app.json` (`name`) и файлы в `assets/`.
- **Package ID:** сейчас `ru.splpro.app` (в `app.json`, разделы `android` и `ios`).

Иконки в `assets/` — временные плейсхолдеры с текстом «SPL». Замените их своими логотипами (PNG, 1024×1024 для icon и adaptive-icon).
