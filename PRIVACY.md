<!--
  Privacy Policy — Regalia
  Copyright (C) 2026 Regalia
  Licensed under GNU Affero General Public License v3 (AGPL v3)

  AI-GEN: AI assisted
  This document was AI-assisted and has been reviewed for AGPL v3 compliance.
-->
# Privacy Policy — Regalia

Regalia is a fully offline chess application. This policy applies to the Regalia Android application.

## Data Collection

**Regalia collects no personal data.** The application:

- Does not collect, transmit, or store any personal information
- Does not require user registration or accounts
- Does not include advertising SDKs or analytics services
- Does not track user behavior or game history remotely

## Network Access

Regalia's core features work entirely offline. The only network-dependent features are:

- **Syzygy Endgame Tablebase**: Queries the public Lichess Tablebase API (`tablebase.lichess.ovh`) for positions with 7 or fewer pieces. This is optional and automatically disabled when offline. No personal data is sent in these queries — only chess position data (FEN strings).
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
- The eval cache (`eval_cache.json`) contains per-move Stockfish evaluation scores (centipawn values, mate distances, search depths, WDL probabilities) keyed by review step index. It contains no personal or position-identifying information beyond the chess evaluation data itself.
- The tag files contain user-defined tag strings (e.g., "opening", "tactics") for organizing PGN cache entries. They contain no personal or device-identifying information.

## Permissions

| Permission | Purpose | Required |
|-----------|---------|----------|
| INTERNET | Tablebase API queries | No (only for tablebase feature) |
| ACCESS_NETWORK_STATE | Detect offline status | No |
| WAKE_LOCK | Keep engine process alive during analysis | Yes (foreground service) |
| VIBRATE | Haptic feedback | No |
| FOREGROUND_SERVICE | Engine stability notification | Yes (Android 14+) |

## Contact

For questions about this privacy policy, please open an issue on the GitHub repository.
