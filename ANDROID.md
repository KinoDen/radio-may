# Фоновое воспроизведение в Android APK — что нужно сделать

## Что обнаружено

* Присланный `app-debug.apk` — только оболочка: в нём один класс приложения `ru.radiomay.app.MainActivity`
  (WebView) и папка `assets/` с веб-файлами. **Нативного плеера, Foreground Service и MediaSession в нём нет.**
* Веб-файлы внутри APK — **более старая версия**, чем присланный ZIP: в их `app.js` нет моста `window.RadioAndroid`.
  В ZIP (и в этой обновлённой версии) мост уже есть: если внутри WebView доступен объект `RadioAndroid`, `app.js`
  не создаёт `<audio>`, а отдаёт управление нативному плееру.
* Исходного Android Studio-проекта в присланных файлах нет, поэтому APK я не пересобирал и нативный код
  не имитировал. JavaScript сам по себе не заменяет Foreground Service: когда Android усыпляет WebView
  (сворачивание, блокировка экрана), страница замирает вместе со звуком.

## Что нужно сделать в Android Studio

1. **Обновить `assets/`**: заменить `index.html`, `app.js`, `genres.js`, `app.css`, `style.css` файлами из этого архива
   (и положить `catalog.json`, если он собран).
2. **Манифест**:
   ```xml
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"/>
   <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>   <!-- Android 13+: запросить в рантайме -->
   <uses-permission android:name="android.permission.WAKE_LOCK"/>
   <service android:name=".PlaybackService" android:exported="true"
            android:foregroundServiceType="mediaPlayback">
     <intent-filter><action android:name="androidx.media3.session.MediaSessionService"/></intent-filter>
   </service>
   ```
3. **`PlaybackService`** — `MediaSessionService` из AndroidX Media3 (`media3-exoplayer`, `media3-session`):
   создаёт `ExoPlayer` (аудио-атрибуты `USAGE_MEDIA`/`AUDIO_CONTENT_TYPE_MUSIC`, `setHandleAudioBecomingNoisy(true)`,
   `setWakeMode(C.WAKE_MODE_NETWORK)`) и `MediaSession`. Media3 сам поднимает Foreground Service с уведомлением,
   кнопками play/pause/prev/next и управлением с экрана блокировки и Bluetooth.
4. **Мост WebView ↔ плеер.** `@JavascriptInterface`-объект с именем `RadioAndroid`, методы, которые вызывает `app.js`:

   | JS → Android | действие |
   |---|---|
   | `reset()` | сбросить очередь (вызывается при старте страницы) |
   | `setVolume(float 0..1)` | громкость плеера |
   | `setQueue(json, currentId, play, subtitle)` | `json` = `[{id,n,u}]` — станции **выбранного жанра** (или избранного); начать с `currentId`; `play` — сразу играть; `subtitle` — «Радио Май · <жанр>» для уведомления |
   | `pause()` / `stop()` | пауза / остановка |

   | Android → JS (`webView.evaluateJavascript`) | когда |
   |---|---|
   | `window.__radio.onState('playing'|'buffering'|'error')` | состояние плеера |
   | `window.__radio.onItem(id)` | станцию переключили из шторки/Bluetooth (интерфейс обновится) |
   | `window.__radio.onCmd('play'|'pause'|'stop')` | кнопки уведомления |

   Очередь передаётся целиком, поэтому «следующая/предыдущая» в шторке уже учитывает выбранный жанр.
5. **Activity**: не вызывать `webView.onPause()` / `pauseTimers()` в `onPause()`, пока играет музыка; запускать
   сервис через `ContextCompat.startForegroundService()`/`MediaController` при первом `setQueue(..., play=true)`;
   на Android 13+ запросить `POST_NOTIFICATIONS`.
6. **Возврат в приложение**: при `onResume` вызвать `evaluateJavascript("window.__radio && ...")` или переотправить
   состояние (`onState`/`onItem`), чтобы интерфейс совпал с реальным плеером.
7. **Эквалайзер**: при нативном плеере живой спектр (FFT) недоступен — в этом режиме он имитируется (как для станций без CORS).
   Для настоящего спектра нужен `Visualizer`/собственный AudioProcessor — отдельная задача.

## Статус
Описание составлено по контракту моста, который уже есть в `app.js`; на реальном устройстве не проверялось —
исходников Android-проекта и сборочной среды здесь нет.
