<!--
  Privacy Policy — Regalia
  Copyright (C) 2026 Regalia
  Licensed under GNU Affero General Public License v3 (AGPL v3)
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

All other features, including AI gameplay, review analysis, PGN import/export, and engine configuration, work without any network connection.

## Local Data

Game data (board positions, move records, engine settings) is stored locally on the device using browser localStorage and Android SharedPreferences. This data:

- Never leaves the device
- Can be cleared by uninstalling the app or clearing app data
- Is not shared with any third party

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
