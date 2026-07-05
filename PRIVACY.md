<!--
  Privacy Policy — Regalia
  Copyright (C) 2026 Regalia
  Licensed under GNU Affero General Public License v3 (AGPL v3)

  AI-GEN: AI assisted
  This document was AI-assisted and has been reviewed for AGPL v3 compliance.
-->
# Privacy Policy — Regalia

Regalia is a fully offline chess application. This policy applies to the Regalia Android application (current version: **v1.1.0**, versionCode 110).

## Data Collection

**Regalia collects no personal data.** The application:

- Does not collect, transmit, or store any personal information
- Does not require user registration or accounts
- Does not include advertising SDKs or analytics services
- Does not track user behavior or game history remotely

## Network Access

Regalia's core features work entirely offline. The only network-dependent features are:

- **Syzygy Endgame Tablebase**: Queries the public Lichess Tablebase API (`tablebase.lichess.ovh`) for positions with 7 or fewer pieces. This is optional and automatically disabled when offline. No personal data is sent in these queries — only chess position data (FEN strings). All network traffic is forced over TLS 1.2+ via `TlsSecurityHelper.java` and `network_security_config.xml` (cleartext traffic is blocked entirely).
- **External hyperlinks (v1.0.4 Rev27+)**: When the user taps a hyperlink in the About dialog (e.g. the GitHub source code link, AGPL v3 / GPL v3 license links) or anywhere else in the app, the URL is handed to the system default browser via `Intent.ACTION_VIEW`. Regalia itself does not make any HTTP request — the browser app handles the URL fetch. Only http(s) URLs are allowed; other schemes are silently rejected. No Regalia data is sent to the browser; the URL itself is the only datum transmitted.

All other features, including AI gameplay, review analysis, PGN import/export, and engine configuration, work without any network connection.

## Local Data

Game data (board positions, move records, engine settings, PGN cache entries, eval cache) is stored locally on the device using browser localStorage, Android SharedPreferences, and app-private files. The on-device storage locations are:

- `/data/data/com.Regalia/app_webview/Local Storage/` — WebView localStorage (may be wiped by aggressive OEM memory managers like Xiaomi HyperOS 3)
- `/data/data/com.Regalia/shared_prefs/RegaliaEngine.xml` — SharedPreferences (engine settings, language preference, persistent kv_* fallback store)
- `/data/data/com.Regalia/files/eval_cache.json` — Eval cache (per-move Stockfish evaluations for review mode, v1.0.4 Rev20+)
- `/data/data/com.Regalia/files/pgn_cache/<name>.pgn` — PGN cache entries (saved via 📚 PGN Cache Manager)
- `/data/data/com.Regalia/files/pgn_cache/<name>.tags.json` — Tag files for PGN cache entries (v1.0.4 Rev20+)

### v1.0.4 Rev28: Stats↔main PGN sync

The stats page (`StatsActivity`) and the main/review page (`MainActivity`) now synchronize PGN data bidirectionally:

- **Entering stats page**: `openStatsPage()` always rebuilds the PGN from the current `moveRecords` and passes it to the stats page via the Intent extra `statsPayload`. No PGN data leaves the device.
- **Returning from stats page**: If the user imported a PGN on the stats page and tapped "Yes" on the "🗃️ Import PGN to game?" dialog, the imported PGN text is stashed in a static volatile field `StatsActivity.importedPGNOnStats` (in-memory only, never written to disk) and read by `MainActivity.onResume()` (one-shot — cleared immediately after read). The PGN is then imported into the main game via `importPGN()`. If the user tapped "No" or "Cancel", no data crosses the activity boundary.

This data:

- Never leaves the device
- Can be cleared by uninstalling the app or clearing app data
- Is not shared with any third party
- The PGN cache entries contain only chess game records (PGN format) — no personal or device-identifying information. They are never uploaded.
- The eval cache (`eval_cache.json`) contains per-move Stockfish evaluation scores (centipawn values, mate distances, search depths, WDL probabilities) keyed by review step index. It contains no personal or position-identifying information beyond the chess evaluation data itself. (v1.0.7+: capped at 2000 entries via LRU eviction — the currently-viewed step is never evicted; eviction order is preserved across app restarts.)
- The tag files contain user-defined tag strings (e.g., "opening", "tactics") for organizing PGN cache entries. They contain no personal or device-identifying information.

## Permissions

| Permission | Purpose | Required |
|-----------|---------|----------|
| INTERNET | Tablebase API queries | No (only for tablebase feature) |
| ACCESS_NETWORK_STATE | Detect offline status | No |
| WAKE_LOCK | Keep engine process alive during analysis | Yes (foreground service) |
| VIBRATE | Haptic feedback (personified per-piece haptics, v1.0.8+) | No |
| FOREGROUND_SERVICE | Engine stability notification | Yes (Android 14+) |
| FOREGROUND_SERVICE_SPECIAL_USE | Engine foreground service type (`specialUse`, Android 14+) | Yes (Android 14+) |
| POST_NOTIFICATIONS | Engine foreground service notification (Android 13+) | Yes (Android 13+, runtime-requested) |
| READ_EXTERNAL_STORAGE | PGN file import from shared storage (legacy, `maxSdkVersion=32`) | No (SAF used on Android 13+) |
| WRITE_EXTERNAL_STORAGE | PGN/settings file export to shared storage (legacy, `maxSdkVersion=28`) | No (SAF used on Android 9+) |

> **Note on sensors (v1.0.5+):** The board anti-shake feature (`StabilizationHelper.java`) reads the `TYPE_LINEAR_ACCELERATION` sensor for OIS-style translation compensation. This sensor does **not** require any Android permission and the raw motion data is **never** stored or transmitted — it is consumed in real time to apply a `transform: translate()` on the board element and discarded. No permission declaration is needed in the manifest for this sensor.

> **Note on the wake lock (v1.1.0 Phase 57+):** The `EngineService` foreground service acquires a partial wake lock with a **30-minute timeout** as a safety net. If the OEM silently kills the service and `onDestroy` never runs, the wake lock is released automatically after 30 minutes — preventing indefinite CPU wake on misbehaving OEM ROMs. Normal analysis sessions are well under this window; longer sessions re-acquire by re-entering the foreground state.

## Haptic Feedback (v1.0.8+)

v1.0.8 introduces personified haptic feedback — each of the six piece types (pawn, knight, bishop, rook, queen, king) plus castling and promotion has a dedicated vibration pattern. Haptics are:

- Triggered locally via `Vibrator`/`VibrationEffect` (API 26+) or PWLE (API 35+)
- Controlled by the user's system haptic-feedback preference (`Settings → Sound & vibration → Haptic feedback`)
- Throttled per-event-type to avoid vibration fatigue
- Never recorded or transmitted — the vibration is the only output

## Engine Binary Integrity

The Stockfish 18 engine binary (`libstockfish.so`) is shipped as an arm64-v8a native library inside the APK. On first launch, `StockfishNative.java` validates the binary:

- **ELF magic check** (first 4 bytes = `\x7fELF`) — guards against corrupted downloads.
- **SHA-256 hash verification** against a baked-in expected hash — guards against tampering.

If either check fails, the engine refuses to start and reports the error to the user via the UI. The binary is never downloaded at runtime; it is statically embedded in the APK.

## Contact

For questions about this privacy policy, please open an issue on the GitHub repository.

---
*AI-GEN*
