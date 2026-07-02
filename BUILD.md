# Инструкция по сборке приложения SPLPRO

Приложение — React Native (Expo), обёртка WebView над сайтом splpro.ru.
Все сборки выполняются на серверах **GitHub Actions**, локальная машина не обязана иметь
Android SDK или Xcode. Ниже — пошаговые команды для каждого типа пакета.

Оглавление:
1. [Требования](#1-требования)
2. [Первичная настройка (один раз)](#2-первичная-настройка-один-раз)
3. [Быстрая проверка на телефоне (без сборки)](#3-быстрая-проверка-на-телефоне-без-сборки)
4. [Android — подписанные APK + AAB](#4-android--подписанные-apk--aab)
5. [iOS — тестовый пакет (симулятор)](#5-ios--тестовый-пакет-симулятор)
6. [iOS — подписанный .ipa (устройство / TestFlight / App Store)](#6-ios--подписанный-ipa)
7. [Локальная сборка (без GitHub)](#7-локальная-сборка-без-github)
8. [Обновление версии](#8-обновление-версии)
9. [Частые проблемы](#9-частые-проблемы)

---

## 1. Требования

**Минимум (для облачной сборки на GitHub):**
- [Node.js LTS](https://nodejs.org) 18+ — `node -v`
- [git](https://git-scm.com) — `git --version`
- [GitHub CLI](https://cli.github.com) — `gh --version`

**Дополнительно для локальной сборки:**
- Android: JDK 17 + Android Studio (Android SDK), переменная `ANDROID_HOME`
- iOS: macOS + Xcode + CocoaPods

Проверить всё сразу:
```bash
node -v && git --version && gh --version
```

---

## 2. Первичная настройка (один раз)

Выполняется один раз в папке проекта `SplproApp`.

```bash
cd SplproApp
gh auth login              # авторизация в GitHub (выберите GitHub.com → HTTPS → браузер)
```

Репозиторий `mnazarow/splpro-app` уже создан, секреты для Android-подписи уже добавлены.
Если начинаете с нуля на новой машине — просто клонируйте:
```bash
git clone https://github.com/mnazarow/splpro-app.git
cd splpro-app
```

Установить зависимости (нужно для локального запуска/сборки, для облачной — необязательно):
```bash
npm install
```

---

## 3. Быстрая проверка на телефоне (без сборки)

Мгновенно посмотреть приложение через **Expo Go** (Google Play / App Store):
```bash
npx expo start
```
Отсканируйте QR-код: Android — в приложении Expo Go, iOS — камерой.

---

## 4. Android — подписанные APK + AAB

Сборка запускается **автоматически при каждом `git push`** в ветку `main`.
На выходе — подписанные `splpro.apk` (установка на телефон) и `splpro.aab` (Google Play).

### Обычный цикл: внёс правки → собрал
```bash
cd SplproApp
git add -A
git commit -m "Описание изменений"
git push                                   # ← запускает сборку
gh run watch --exit-status                 # ждать завершения
rm -f splpro.apk splpro.aab                # убрать старые файлы, если есть
gh run download -n splpro-release          # скачать APK + AAB в текущую папку
```

### Пересобрать вручную, без нового коммита
```bash
gh workflow run "Build Android (signed release)"
sleep 15
gh run watch --exit-status
rm -f splpro.apk splpro.aab
gh run download -n splpro-release
```

### Скачать из релиза (альтернатива артефактам)
Каждая успешная сборка публикует файлы в Release с тегом `latest`:
```bash
gh release download latest --pattern "splpro.*" --clobber
```

**Установка APK на телефон:** перенесите `splpro.apk` на устройство и откройте
(разрешите «Установка из неизвестных источников»).
**Google Play:** загрузите `splpro.aab` в Play Console.

---

## 5. iOS — тестовый пакет (симулятор)

Бесплатно, **без Apple-аккаунта**. Собирает `.app` для запуска в Xcode Simulator на Mac.
На реальный iPhone не ставится (сборка не подписана).

```bash
gh workflow run "Build iOS (simulator, unsigned)"
sleep 15
gh run watch --exit-status
rm -f splpro-ios-simulator.zip
gh run download -n splpro-ios-simulator
```

Запуск в симуляторе (на Mac):
```bash
unzip splpro-ios-simulator.zip            # получите SPLPRO.app
open -a Simulator                         # запустить симулятор
xcrun simctl install booted SPLPRO.app    # установить в запущенный симулятор
```
Либо просто перетащите `SPLPRO.app` на окно симулятора.

---

## 6. iOS — подписанный .ipa

Для установки на реальный iPhone / TestFlight / App Store.
Требуется **Apple Developer Program** ($99/год) и 8 секретов репозитория
(`.p12`, provisioning profile, ключ App Store Connect API).

> Полная пошаговая инструкция по получению файлов и настройке секретов —
> в отдельном файле [`IOS_SIGNING.md`](./IOS_SIGNING.md).

После настройки секретов:
```bash
# собрать .ipa (метод по умолчанию — app-store)
gh workflow run "Build iOS (signed .ipa)"

# собрать и сразу выгрузить в TestFlight
gh workflow run "Build iOS (signed .ipa)" -f upload_testflight=true

# собрать для установки на зарегистрированные устройства
gh workflow run "Build iOS (signed .ipa)" -f export_method=ad-hoc

# скачать готовый .ipa
sleep 15
gh run watch --exit-status
gh run download -n splpro-ios-ipa
```

---

## 7. Локальная сборка (без GitHub)

### Android (нужны JDK 17 + Android SDK)
```bash
cd SplproApp
npm install
npx expo prebuild --platform android      # сгенерировать папку android/
cd android
./gradlew assembleRelease                  # APK → app/build/outputs/apk/release/
# или app-bundle для Google Play:
./gradlew bundleRelease                     # AAB → app/build/outputs/bundle/release/
```
Для подписи локально положите keystore и параметры в `android/gradle.properties`
(в облаке это делается через секреты автоматически).

### iOS (только macOS + Xcode)
```bash
cd SplproApp
npm install
npx expo prebuild --platform ios
cd ios && pod install && cd ..
npx expo run:ios                           # запуск в симуляторе
```
Для устройства откройте `ios/SPLPRO.xcworkspace` в Xcode, выберите команду подписи и Archive.

---

## 8. Обновление версии

Перед публикацией новой версии поднимите номер в `app.json`:
```jsonc
{
  "expo": {
    "version": "1.0.1",          // ← версия для магазинов (visible)
    "ios":     { "buildNumber": "2" },   // ← добавьте при необходимости
    "android": { "versionCode": 2 }      // ← Google Play требует рост числа
  }
}
```
Затем закоммитьте и запушьте — сборка соберётся с новой версией.

---

## 9. Частые проблемы

**`gh run download` → "file exists"**
В папке остался файл прошлой сборки. Удалите перед скачиванием:
```bash
rm -f splpro.apk splpro.aab splpro-ios-simulator.zip splpro.ipa
```

**`git push` → "File ... exceeds GitHub's file size limit of 100 MB"**
В историю попал собранный APK/большой файл. Он уже в `.gitignore`; пересоздайте историю:
```bash
git checkout --orphan clean && git add -A && git commit -m "clean" \
  && git branch -D main && git branch -m main && git push -f -u origin main
```

**Предупреждение "Node.js 20 is deprecated" в логах Actions**
Это уведомление самих GitHub-экшенов, на сборку не влияет — игнорируйте.

**`gh: authentication required`**
Выполните `gh auth login`.

**iOS-сборка падает на подписи**
Проверьте, что все 8 секретов заданы и `IOS_PROVISIONING_PROFILE_NAME` точно совпадает
с именем профиля в портале Apple. См. [`IOS_SIGNING.md`](./IOS_SIGNING.md).

---

## Сводка команд

| Задача | Команда |
|---|---|
| Проверить на телефоне | `npx expo start` |
| Android APK+AAB (после правок) | `git add -A && git commit -m "..." && git push && gh run watch --exit-status && rm -f splpro.apk splpro.aab && gh run download -n splpro-release` |
| Android без коммита | `gh workflow run "Build Android (signed release)"` |
| iOS тест (симулятор) | `gh workflow run "Build iOS (simulator, unsigned)"` |
| iOS .ipa | `gh workflow run "Build iOS (signed .ipa)"` |
| iOS .ipa + TestFlight | `gh workflow run "Build iOS (signed .ipa)" -f upload_testflight=true` |
| Скачать результат | `gh run download -n <имя-артефакта>` |
