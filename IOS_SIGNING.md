# Подписанная iOS-сборка (.ipa) через GitHub Actions + fastlane

Workflow `.github/workflows/build-ios-signed.yml` собирает и подписывает `.ipa` на macOS-раннере
GitHub и (по желанию) выгружает его в TestFlight. Подпись — ручная (manual): вы передаёте
distribution-сертификат, provisioning profile и ключ App Store Connect API как секреты репозитория.

Требуется активный **Apple Developer Program** ($99/год).

---

## Шаг 1. Подготовьте 3 файла в аккаунте Apple

### A. Distribution-сертификат → `.p12`
1. В [Apple Developer → Certificates](https://developer.apple.com/account/resources/certificates/list)
   создайте сертификат типа **Apple Distribution** (или используйте существующий).
2. Установите его в **Keychain Access** на Mac (двойной клик по скачанному `.cer`).
3. В Keychain Access найдите сертификат, разверните его, выделите **сертификат вместе с приватным ключом**,
   правый клик → **Export 2 items…** → сохраните как `dist.p12`, задайте пароль.
   Этот пароль пойдёт в секрет `IOS_DIST_CERT_PASSWORD`.

### B. Provisioning profile → `.mobileprovision`
1. Убедитесь, что App ID **`ru.splpro.app`** зарегистрирован в
   [Identifiers](https://developer.apple.com/account/resources/identifiers/list).
2. В [Profiles](https://developer.apple.com/account/resources/profiles/list) создайте профиль:
   - тип **App Store** (для TestFlight/App Store) или **Ad Hoc** (для установки на конкретные устройства);
   - App ID = `ru.splpro.app`, сертификат = ваш Apple Distribution.
3. Скачайте `.mobileprovision`. Запомните **Name** профиля (как он назван в портале) —
   он пойдёт в секрет `IOS_PROVISIONING_PROFILE_NAME`.

### C. Ключ App Store Connect API → `.p8`
1. В [App Store Connect → Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)
   создайте ключ с ролью **App Manager**.
2. Скачайте файл `AuthKey_XXXXXXXXXX.p8` (даётся один раз).
3. Со страницы ключа возьмите **Key ID** и **Issuer ID**.

---

## Шаг 2. Переведите файлы в base64

На Mac (значение копируется в буфер обмена):
```bash
base64 -i dist.p12 | pbcopy                 # → IOS_DIST_CERT_P12_BASE64
base64 -i profile.mobileprovision | pbcopy  # → IOS_PROVISIONING_PROFILE_BASE64
base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy     # → ASC_KEY_P8_BASE64
```

---

## Шаг 3. Список секретов репозитория

Задайте в репозитории (**Settings → Secrets and variables → Actions**) или командой `gh secret set`:

| Секрет | Что это | Откуда |
|---|---|---|
| `APPLE_TEAM_ID` | 10-символьный Team ID | Apple Developer → Membership |
| `IOS_DIST_CERT_P12_BASE64` | base64 файла `dist.p12` | шаг 1A + шаг 2 |
| `IOS_DIST_CERT_PASSWORD` | пароль, заданный при экспорте `.p12` | шаг 1A |
| `IOS_PROVISIONING_PROFILE_BASE64` | base64 файла `.mobileprovision` | шаг 1B + шаг 2 |
| `IOS_PROVISIONING_PROFILE_NAME` | **Name** профиля из портала | шаг 1B |
| `ASC_KEY_ID` | Key ID ключа ASC API | шаг 1C |
| `ASC_ISSUER_ID` | Issuer ID | шаг 1C |
| `ASC_KEY_P8_BASE64` | base64 файла `AuthKey_*.p8` | шаг 1C + шаг 2 |

> `IOS_BUNDLE_ID` (`ru.splpro.app`) уже задан в workflow — секретом делать не нужно.

Пример через CLI (значения base64 читаются из файлов):
```bash
gh secret set APPLE_TEAM_ID -b "ABCDE12345"
gh secret set IOS_DIST_CERT_PASSWORD -b "ваш-пароль-от-p12"
gh secret set IOS_PROVISIONING_PROFILE_NAME -b "SPLPRO App Store"
gh secret set ASC_KEY_ID -b "XXXXXXXXXX"
gh secret set ASC_ISSUER_ID -b "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
gh secret set IOS_DIST_CERT_P12_BASE64 < <(base64 -i dist.p12)
gh secret set IOS_PROVISIONING_PROFILE_BASE64 < <(base64 -i profile.mobileprovision)
gh secret set ASC_KEY_P8_BASE64 < <(base64 -i AuthKey_XXXXXXXXXX.p8)
```

---

## Шаг 4. Запуск сборки

```bash
gh workflow run "Build iOS (signed .ipa)"                                  # только собрать .ipa
gh workflow run "Build iOS (signed .ipa)" -f upload_testflight=true        # собрать и залить в TestFlight
gh workflow run "Build iOS (signed .ipa)" -f export_method=ad-hoc          # для установки на устройства из профиля
```

Скачать готовый файл:
```bash
gh run watch --exit-status
gh run download -n splpro-ios-ipa
```

Результат — `splpro.ipa`. Для App Store/TestFlight используйте `export_method=app-store`;
для прямой установки на зарегистрированные устройства — `ad-hoc`.

---

## Как это устроено

- `fastlane/Fastfile`, лейн `ios release`: `setup_ci` создаёт временный keychain, `import_certificate`
  импортирует `.p12`, `build_app` собирает и подписывает `.ipa` вручную указанным профилем,
  `upload_to_testflight` (по флагу) выгружает сборку по ключу ASC API.
- Секретные файлы (`.p12`, `.mobileprovision`, `.p8`) декодируются на раннере во время сборки
  и **не хранятся в репозитории** (исключены в `.gitignore`).
