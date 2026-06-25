# Regalia ♔

<!-- AI-GEN: AI assisted
     This document was AI-assisted and has been reviewed for AGPL v3 compliance. -->

A standalone, open-source chess app for Android — play offline against Stockfish 18, analyze your games, and explore openings. No account, no network, no tracking. Now with **Chess960 (Fischer Random Chess)** support (v1.0.4).

"Regalia" is used solely as a project name for this open-source chess app. No trademark rights are claimed. Anyone is free to fork and rename their own version.

## Screenshots

<p align="center">
  <img src="assets/screenshot.jpg" alt="Regalia gameplay screenshot" width="280">
</p>

*Portrait mode — evaluation bar, move history, AI opponent display with ponder info, and Control heatmap*

**Control Heatmap** — Tap the 🌈 button on the toolbar to toggle the control heatmap. Each square is dynamically colored by HSL to indicate which side controls it: blue-purple = your control, red = opponent's control, purple = contested. Hovering a square shows SVG arrows from each controlling piece to that square (warm gold for your pieces, cool silver-blue for opponent's). The info card below the board shows per-piece control contributions with position labels.

**🌿Line** — In the move record, 🌿 lines appear below each move showing engine analysis variations (MultiPV) and PGN import variations (RAV). Each variation is labeled 🌿Line 1, 🌿Line 2, etc., assigned sequentially by display order. PGN import variations are automatically parsed and displayed as 🌿Lines with proper move numbering. Toggle the Variations switch to show or hide them.

## Features

- **Stockfish 18 Engine** — arm64-v8a-dotprod variant with NEON acceleration for optimal performance on modern devices
- **Chess960 / Fischer Random Chess** (v1.0.4 NEW) — full support for the 960 starting positions with proper castling rules, SP-ID selector in New Game dialog, Shredder-FEN castling rights, and `UCI_Chess960` engine option
- **Standardized PGN** (v1.0.4 NEW) — import/export follows the 1994 PGN spec strictly: Seven-Tag Roster always emitted, `[%eval]` / `[%clk]` / `[%emt]` annotations embedded, Result terminator enforced, tolerant parser auto-corrects malformed input
- **NAG &amp; Visual Annotations** (v1.0.4 NEW) — NAG ($1-$19) support; automatic selection &amp; caching of `[%csl ...]` (square highlights) and `[%cal ...]` (arrows) per move: Blue=control paths, Red=check path, Green=escape squares, Yellow=queen-threat path
- **Time-Control Chess** (v1.0.4 NEW) — Sudden Death / Fischer Increment / Bronstein Delay / US Delay modes; live clock display with low-time warning; auto-emits `[TimeControl "..."]` header and `[%clk HH:MM:SS]` per-move annotations; for untimed games, emits `[%emt HH:MM:SS]` (elapsed move time)
- **Web Worker Pool** (v1.0.4 NEW) — `worker-pool.js` offloads PGN parsing, statistics computation, and control-map computation to a background thread; falls back to inline execution on devices without Worker support
- **8 Difficulty Levels** — from beginner (800 ELO) to maximum strength (2800+ ELO), plus Skill Level mode
- **PGN Import** — paste PGN from clipboard, or select a PGN file from your device
- **Review Mode** — full game replay with evaluation trend chart, move-by-move analysis, move classification (brilliant/good/blunder), and engine evaluation cache
- **MultiPV Analysis** — 1–8 lines of analysis simultaneously
- **ECO Opening Classification** — 500+ standard openings with search, category filtering, and book move recommendations
- **Syzygy Endgame Tablebases** — 7-piece endgame lookup via Lichess Tablebase API (requires network; auto-disables when offline)
- **Position Setup** — custom board editing with FEN copy/import
- **Ponder Mode** — engine thinks on opponent's time for stronger play
- **WDL Display** — Win/Draw/Loss probability shown alongside evaluation
- **Heatmap Control Statistics** (v1.0.4 NEW) — per-square average control across all positions, strongest/weakest square detection, center-control trend
- **Bilingual UI** — full Chinese/English toggle via the ↔️ button on the toolbar, with automatic system language detection
- **Landscape Support** — adaptive layout for both portrait and landscape orientation
- **Engine Configuration** — full UCI parameter control with export/import
- **Haptic Feedback** — responsive touch feedback throughout the interface

## Download

Download the latest APK from [GitHub Releases](https://github.com/YDW99/Regalia/releases). Enable "Install from unknown sources" to install.

## Requirements

- Android 5.0 (API 21) or later
- ARM64 device (arm64-v8a)
- ~80 MB storage

## Building

### Prerequisites

- Android SDK with API 35 (Android 15)
- Gradle 8.x (wrapper included)
- Stockfish 18 engine binary for arm64-v8a-dotprod

### Build Steps

1. Place the Stockfish engine binary at:
   ```
   /tmp/stockfish/stockfish-android-armv8-dotprod
   ```

2. Build the chess.html asset:
   ```bash
   cd src/main/assets/chess.src/
   bash build-chess.sh
   ```

3. Build the APK:
   ```bash
   ./gradlew assembleRelease
   ```

The signed APK will be at `build/outputs/apk/release/`.

## Project Structure

```
Regalia/
├── src/main/
│   ├── assets/
│   │   ├── chess.src/          # Source files (JS + CSS + HTML template)
│   │   │   ├── game-logic.js   # Chess rules, move generation, i18n
│   │   │   ├── chess960.js     # Chess960 SP-ID, Shredder-FEN, 960 castling rules (v1.0.4 NEW)
│   │   │   ├── pgn-standard.js # Standardized PGN encoder/decoder, NAG, [%csl]/[%cal], TimeControl (v1.0.4 NEW)
│   │   │   ├── worker-pool.js  # Web Worker pool for PGN/stats/control-map offloading (v1.0.4 NEW)
│   │   │   ├── ai-bridge.js    # Engine communication, eval display, PGN export
│   │   │   ├── ui.js           # Rendering, dialogs, interaction, review mode, time-control UI
│   │   │   ├── eco-data.js     # ECO opening classification data
│   │   │   ├── tablebase.js    # Lichess Syzygy tablebase queries + PGN import
│   │   │   ├── index.html.tpl  # CSS template
│   │   │   └── build-chess.sh  # Build script → chess.html
│   │   ├── chess.html          # Built output (combined JS+CSS+HTML)
│   │   ├── stats.html          # Statistics page (📊统计) — fullscreen WebView
│   │   ├── AGPLv3_Logo.svg     # AGPL logo for About page
│   │   └── GPLv3_Logo.svg      # GPL logo for 💾HTML export dialog
│   ├── java/com/Regalia/
│   │   ├── MainActivity.java   # WebView host, immersive mode, lifecycle
│   │   ├── StockfishNative.java # Engine process management, UCI protocol, SAF file I/O
│   │   │                       # v1.0.4: setChess960Mode() / isChess960Mode() bridge methods
│   │   ├── StatsActivity.java  # Fullscreen WebView for 📊统计 statistics page
│   │   ├── ChessWebViewClient.java # Page load handler
│   │   ├── EngineService.java  # Foreground service for engine stability
│   │   ├── ChessApp.java       # Application class, crash protection
│   │   ├── TlsSecurityHelper.java # TLS 1.2+ enforcement for tablebase API
│   │   └── RootDetector.java   # Informational root detection (About dialog)
│   ├── cpp/
│   │   ├── engine_jni.cpp      # JNI native chmod/renice (from DroidFish)
│   │   └── CMakeLists.txt
│   ├── res/
│   │   └── values/strings.xml
│   └── AndroidManifest.xml
├── NOTICE                      # Third-party component notices
├── NOTICE-DroidFish            # Original DroidFish notice
├── NOTICE-gradle               # Gradle notice (Apache v2.0)
├── AUTHORS-stockfish           # Stockfish project authors list
├── LICENSE-AGPL v3             # AGPL v3 full text (application)
├── LICENSE-GPL v3              # GPL v3 full text (engine components)
├── LICENSE-Apache v2.0         # Apache v2.0 full text (Gradle)
├── PRIVACY.md                  # Privacy policy
├── build-chess.py              # Python build script (alternative to build-chess.sh)
├── Regalia-v1.0.4-manual-zh.html  # Chinese user manual
├── Regalia-v1.0.4-manual-en.html  # English user manual
└── README.md
```

## Licensing

Regalia is a **combined work** under dual licensing:

| Component | License | File |
|-----------|---------|------|
| Original application code (UI, WebView, services, build scripts) | AGPL v3 | LICENSE-AGPL v3 |
| DroidFish-derived code (engine management, game logic, PGN parsing, UI patterns) | GPL v3 | LICENSE-GPL v3 |
| Stockfish 18 engine binary | GPL v3 | LICENSE-GPL v3 |
| ECO opening data | CC0 (data) / AGPL v3 (code) | — |
| Application icons | AI-generated / AGPL v3 | — |

Per GPL v3 Section 13, these licenses are compatible for combination. Each component retains its original license. Since AGPL v3 imposes stricter network interaction provisions (Section 13), its obligations effectively extend to the entire combined work, ensuring users who access the work over a network retain the right to obtain source code.

**Source code**: Available at https://github.com/YDW99/Regalia

### GPL v3 Files (DroidFish-derived)

- `StockfishNative.java` — Engine management logic
- `engine_jni.cpp` — Native chmod/renice from DroidFish
- `game-logic.js` — PGN disambiguation and SAN notation
- `ai-bridge.js` — Engine communication patterns
- `ui.js` — UI layout and interaction patterns
- `tablebase.js` — PGN parsing (GameTree/PgnToken/PgnScanner)

### AGPL v3 Files (original)

- `MainActivity.java`, `ChessApp.java`, `ChessWebViewClient.java`, `EngineService.java`
- `eco-data.js`, `index.html.tpl`, `CMakeLists.txt`
- `build-chess.py`, `build-chess.sh`
- All other project files not listed above

### Third-Party Components

- **DroidFish** — Engine management, game logic, PGN parsing, UI patterns (Copyright © Peter Österlund, GPL v3)
- **Stockfish 18** — Chess engine (Copyright © T. Romstad, M. Costalba, J. Kiiski, G. Linscott, GPL v3)
- **Lichess Tablebase API** — Endgame tablebase queries (public API, requires network)
- **lichess-org/chess-openings** — ECO opening classification data (CC0)

See [NOTICE](NOTICE) for full attribution details. More declaration documents are preserved in [NOTICE-DroidFish](NOTICE-DroidFish) and [AUTHORS-stockfish](AUTHORS-stockfish).

## Contributing

Contributions are welcome! Please ensure:

1. All contributions to the application layer are licensed under AGPL v3
2. Any modifications to DroidFish-derived or Stockfish code remain under GPL v3
3. Code is tested on physical Android devices (especially Xiaomi HyperOS 3)

## Version

**v1.0.4** (versionCode 104) — major release

The v1.0.4 release adds:

1. **Chess960 (Fischer Random Chess) mode** — full implementation with SP-ID selector,
   Shredder-FEN castling rights, 960 castling rules, `UCI_Chess960` engine option,
   and `[Variant "Chess960"]` PGN tag.
2. **Standardized PGN import/export** — Seven-Tag Roster always emitted, `[%eval]`
   / `[%clk]` annotations embedded, Result terminator enforced, tolerant parser
   auto-corrects malformed input.
3. **Heatmap-based control statistics** — per-square average control across all
   positions, strongest/weakest square detection, center-control trend.
4. **Version sync** — versionCode, versionName, AndroidManifest, build.gradle,
   every in-app UI display, Java file VERSION constants, README, NOTICE, every
   README.license file, and HTML manuals all synchronized to v1.0.4.

### Patch revisions (version number unchanged — still v1.0.4 / versionCode 104)

Multiple patch revisions have been applied under the same v1.0.4 version number.
The most significant recent revisions are:

- **Round-5 Revision 17** — Xiaomi HyperOS 3 cache-clearing fix: added a
  Java-side persistent storage layer (`AndroidBridge.persistentGet/Set/Remove`)
  backed by `SharedPreferences`, dual-written alongside WebView localStorage so
  the review-eval cache, language preference, and crash-recovery state survive
  HyperOS 3's aggressive cache wipes. Also added `AndroidManifest.xml` backup
  rules (`backup_rules.xml` + `data_extraction_rules.xml`) declaring
  SharedPreferences and WebView Local Storage as user data (not cache).
- **Round-5 Revision 18** — 📚 PGN Cache Manager: new modal dialog
  accessible from the review toolbar (📚 button next to 🌗/🌈). Lets users
  save the current PGN to a named entry, list all saved entries (with size +
  mtime), import any entry with one tap (syncs both review and main move
  list), and select multiple entries for batch deletion. Backed by
  `AndroidBridge.listPGNCaches/savePGNCache/getPGNCache/deletePGNCaches`
  writing to `/data/data/com.Regalia/files/pgn_cache/` (HyperOS-proof).
  Also removed the 200-entry cap on `_reviewEvalCache` — now unlimited.
- **Round-5 Revision 19** — onclick syntax fix + click-empty-moves-to-review:
  fixed HTML attribute-escaping bug that broke the cache manager's click
  handlers. Also made the "No moves yet" text in the main move list
  clickable to enter review mode (useful for users who just installed the
  app and want to import a PGN before playing any move).
- **Round-5 Revision 20** (current) — HyperOS 3 eval-cache root-cause fix +
  PGN cache rename/tags + review toolbar reorder:
  • **Eval cache**: first-principles analysis revealed that
    SharedPreferences.apply() is async — HyperOS 3 SIGKILLs the app before
    the disk flush, losing data. Fix: dedicated file
    (`/data/data/com.Regalia/files/eval_cache.json`) with atomic write
    (tmp + fsync + rename) + synchronous `saveEvalCacheSync()` Java
    interface. Critical-event flush on onPause/onStop/onUserLeaveHint +
    pagehide/visibilitychange/beforeunload. Debounce reduced 500ms→150ms.
    Eval cache now loads synchronously at JS module construction — **instant
    recovery** of all previously-analyzed evals when entering review mode.
  • **PGN Cache Manager**: new ✏️ Rename and 🔖 Add Tags buttons per entry.
    Tags stored in `<name>.tags.json`, displayed as gold capsule chips.
    Max 10 tags per entry, each ≤30 chars, case-insensitive dedup.
    listPGNCaches() returns all tags in one call.
  • **Review toolbar button order**: 🌗/🌈 moved to right of 💬Vars toggle,
    left of 📝 PGN — groups display buttons (Vars, Heatmap) before action
    buttons (PGN, Save, Cache, FEN).
  • New Java interfaces: persistentSetSync, persistentFlush,
    loadEvalCacheSync, saveEvalCacheSync, renamePGNCache, setPGNCacheTags,
    getPGNCacheTags.
  • backup_rules.xml + data_extraction_rules.xml: added eval_cache.json
    and pgn_cache/ as user data for cloud backup / device migration.
  • Dead code cleanup: removed unused `_pgnCacheToast` variable.
- **Round-5 Revision 21** — Eval cache writes now synchronous +
  PGN cache tag filter/search:
  • **Eval cache**: `_reviewEvalCache.set()` / `.delete()` / `.clear()` now
    trigger **immediate synchronous write** to `eval_cache.json` (no
    debounce). Each eval arrives ~1/sec via `onEngineEval`; sync write
    overhead is ~1-5ms — imperceptible. Completely eliminates the 150ms
    debounce window where new eval data could be lost if HyperOS 3
    SIGKILLed the app mid-debounce.
  • **PGN Cache Manager**: new 🔍 text search box + tag-chip quick-filter
    row at the top of the modal. Search matches entry names AND tags
    (case-insensitive substring). Tag chips collect all unique tags across
    all entries; click a chip to filter by that tag. Tag chips below each
    entry name are also clickable. Smart Select All/None operates only on
    visible (filtered) entries. Filter status bar shows match count.
    Auto-clears filter on close/reopen.
  • New JS functions: `_pgnCacheOnSearchInput`, `_pgnCacheApplyFilter`,
    `_pgnCacheClearFilter`, `_pgnCacheFilterByTag`,
    `_pgnCacheEntryMatchesFilter`, `_pgnCacheCollectAllTags`.
  • New i18n keys: `pgn_cache_search_placeholder`, `pgn_cache_search_apply`,
    `pgn_cache_search_clear`, `pgn_cache_filter_all`, `pgn_cache_filter_by_tag`,
    `pgn_cache_filter_status`, `pgn_cache_filter_no_match` (all zh/en).
- **Round-5 Revision 22** — New Game dialog layout + HyperOS 3
  defense strengthened + PGN cache search UX:
  • **New Game dialog**: Chess960 toggle moved to be directly below the
    "Play Color" section (was below AI Book Moves). Removed the redundant
    "Classic Openings (Optional)" residual title from the Chess960-OFF
    branch. The Chess960-ON dedicated-settings section heading is now
    `T('chess960_label')` (was `T('classic_openings')`).
  • **HyperOS 3 eval-cache defense**: `MainActivity.onDestroy()` now also
    calls `_flushReviewEvalCache()` + `persistentFlush()` before destroying
    the WebView. Previously onDestroy skipped the flush — any eval data
    that arrived between onStop and onDestroy could be lost. The four-layer
    defense is now: (1) dedicated file `eval_cache.json` with atomic write;
    (2) synchronous `saveEvalCacheSync()` using `FileDescriptor.sync()`;
    (3) critical-event flush on Java onPause/onStop/onUserLeaveHint/
    onDestroy AND JS pagehide/visibilitychange/beforeunload; (4) Rev21's
    per-set synchronous write (no debounce).
  • **PGN Cache Manager search**: removed the redundant 🔍 apply button
    (soft-keyboard Enter now triggers search directly via
    `enterkeyhint="search"`). Input type changed to `search` for native
    affordances. The ✏️/🔖/📥 buttons per entry now share the same row
    (was a vertical column).
  • **HTML manuals**: removed the obsolete "Stockfish engine binary"
    paragraph from the v1.0.3 changelog in both zh and en manuals.
- **Round-5 Revision 23** — First-principles code review fixes:
  • **Critical bug fix**: Engine restart (`onEngineRestarting()` /
    `restartCurrentEngine()`) no longer calls `_reviewEvalCache.clear()`,
    which previously destroyed the ENTIRE persisted eval cache (all games'
    data). Now only resets `_reviewEvalRequestedStep=-1` — Stockfish is
    deterministic, so other games' evals remain valid.
  • **Performance**: Eval cache writes restored to 150ms debounce (Rev21's
    per-set synchronous write serialized the entire ~12MB Map on every eval
    callback). `_flushSync()` from lifecycle handlers still forces immediate
    write, so the debounce window is covered by Rev22's onDestroy flush.
  • **Bug fix**: `saveEvalCacheSync()` now uses `Files.move()` with
    `ATOMIC_MOVE` + `REPLACE_EXISTING` on API 26+ — the old delete+rename
    sequence had a brief window where neither file existed.
  • **Redundancy**: Removed dead second cache check in `requestEngineEval()`,
    dead `moveNum` variable in `_buildPGNString()`, stale 🔍 comment.
- **Round-5 Revision 24** (current) — Analyze-all root-cause fix + instant
  PGN-comment eval recovery + player rename + PGN cache completeness:
  • **Analyze-all interruption root-cause fix**: First-principles analysis
    revealed FIVE distinct causes of "分析全部 interrupted at a certain
    point":
    (1) The old `startStep=0` fallback when all steps were cached caused
    `requestEngineEval()` to early-return on cache hit WITHOUT calling
    `_reviewAnalyzeAdvance()`, stalling the batch until the safety timer
    fired. Now `reviewAnalyzeAll()` detects the all-cached case up front
    and short-circuits to completion INSTANTLY (no engine calls, no timer).
    (2) The safety timer was set ONCE with `min(N*8s, 300s)` — capped at 5
    minutes. For long games with depth-22 evals (5-15s/step), the 5min cap
    fired mid-analysis. Now the per-step safety timer RESETS on every
    advance (60s/step, no global cap), and a stuck step is SKIPPED (not
    aborting the whole batch).
    (3) If the engine auto-recovered (`onEngineReady` after Java
    `recoverEngine()`), the batch was silently dropped. Now `onEngineReady`
    resumes the batch if `_reviewAnalyzeAllActive` is still true.
    (4) If `requestEngineEval()` hit cache during batch (rare race or
    re-entry), it returned without advancing. Now it detects
    `_reviewAnalyzeAllActive + cache hit` and calls `_reviewAnalyzeAdvance`.
    (5) `onEngineError` no longer clears `_reviewAnalyzeAllActive` — the
    per-step safety timer covers the recovery window, and the batch resumes
    on `onEngineReady`.
  • **Instant cache restoration from PGN comments**: `tablebase.js _parsePGN()`
    now extracts `[%eval ...]` tags from `{}` comments BEFORE stripping them,
    and `importPGN()` populates `_reviewEvalCache` from the extracted evals.
    When the user enters review mode after import, all positions with
    `[%eval ...]` annotations are shown INSTANTLY with their cached eval —
    the engine is only invoked for positions WITHOUT `[%eval ...]`. This
    implements the "instant recovery from cache (including PGN comments)"
    requirement. Supports all Lichess eval formats: `[%eval 0.35]`,
    `[%eval -1.5]`, `[%eval #5]`, `[%eval #-3]`, `[%eval M5]`.
  • **PGN cache archive completeness**: `_pgnCacheSaveCurrent()` now ALWAYS
    uses `_buildPGNString(true)` (forceIncludeVariations=true). The previous
    behavior preferred `_cachedOriginalPGN` (the imported text), which lost
    NEW moves played after import. `_buildPGNString()` now includes: all
    moveRecords (including post-import moves), variations (forced on
    independent of showVariations UI toggle), `[%eval ...]` from the review
    cache, `[%emt]/[%clk]/[%csl]/[%cal]`, Seven-Tag Roster + supplementary
    tags. The saved PGN archive contains the COMPLETE game record.
  • **Player rename feature**: Clicking the "你"/"You" name on the main
    interface player bar opens a rename prompt. The new name is:
    - Persisted via `AndroidBridge.persistentSet('Regalia_humanName', ...)`
      (HyperOS 3-proof)
    - Reflected in all PGN text (`[White "..."]` / `[Black "..."]`)
    - Reflected in PGN cache archives and clipboard copies
    - Loaded synchronously at JS module init (available before first render)
    Entering an empty string or the default name resets to "你"/"You".
    PGN import with explicit `[White "..."]`/`[Black "..."]` headers also
    populates `_humanPlayerName` if the human player's slot has a non-default
    name.
  • **Redundant 📥 button removed**: The 📥 Import button in the PGN Cache
    Manager was redundant — clicking the entry's name already imports it.
    Removed to save horizontal space; ✏️ Rename and 🔖 Tags buttons remain.
  • **New i18n keys**: `rename_player_hint`, `rename_player_prompt`,
    `rename_player_saved`, `rename_player_reset` (all zh/en).
  • **New globals**: `_humanPlayerName`, `playerWhite`, `playerBlack`.
  • **Stockfish 18 arm64-v8a-dotprod**: Engine binary updated to the
    official sf_18 release (NDK r27c build, 114 MB, NEON+dotprod
    acceleration).
- **Round-5 Revision 25** (current) — Stats page promotion symbols + Chess960
  dialog heading cleanup + first-principles review:
  • **Stats page promotion symbol fix (bug fix)**: In `stats.html
    renderPGNText()`, the `renderSAN()` function previously only prepended
    the pawn symbol for pawn moves (e.g., "e8=Q" → "♙e8=Q") but left the
    "=Q"/"=R"/"=B"/"=N" promotion suffix as a literal letter — inconsistent
    with non-pawn moves where the piece letter IS converted to a symbol.
    Now every promotion piece (Q/R/B/N after '=') is converted to its
    side-colored symbol (♕/♛, ♖/♜, ♗/♝, ♘/♞), regardless of whether the
    move is a pawn move or a piece move. Examples: "e8=Q+" → "♙e8=♕+"
    (White) / "♟e8=♛+" (Black); "exd8=R" → "♙exd8=♖" (White) / "♟exd8=♜"
    (Black). A shared `_replacePromo()` helper handles both the pawn-move
    and piece-move branches uniformly, including the rare theoretical case
    of a piece-letter move with a promotion suffix (not legal in standard
    chess, but defensive).
  • **Chess960 dialog heading removed (redundancy cleanup)**: In the New
    Game dialog, when Chess960 is enabled, the dedicated settings section
    (SP-ID input, back-rank preview, note) previously had a redundant
    `<h3>` heading showing "菲舍尔任意制象棋" / "Fischer Random Chess". The
    Chess960 toggle above (with its own label) already makes it clear what
    mode the user is in. Rev25 removes the heading so the settings appear
    directly under the toggle, saving vertical space. The heading is
    removed in both Chinese and English modes.
- **Round-5 Revision 26** — Stats page promotion symbol root-cause
  fix:
  • **Root cause of "e8=Q still shows letter" found and fixed**: Rev25 added
    a `_replacePromo()` helper to convert `=Q`/`=R`/`=B`/`=N` suffixes to
    piece symbols, but the promotion STILL showed as a letter because the
    underlying SAN regex in `stats.html renderPGNText()` never captured the
    promotion suffix for non-capture pawn promotions. The regex's pawn
    non-capture alternative was `[a-h][1-8][+#]?` (NO promotion group), so
    for "e8=Q" it matched only "e8" — leaving "=Q" to be rendered as raw
    literal characters via the "pass through other characters" fallback.
    Rev26 fixes the regex alternative to `[a-h][1-8](?:=[QRBN])?[+#]?`,
    which captures the full "e8=Q" so `renderSAN()` (and its `_replacePromo`
    helper) can convert the promotion piece to a symbol. The same fix is
    applied to the variation-move regex. Now ALL promotion formats render
    correctly: `e8=Q` → ♙e8=♕, `exd8=R` → ♙exd8=♖, `a8=N#` → ♟a8=♞#,
    `b1=B+` → ♙b1=♗+. Verified via regex test against 12 sample moves.
- **Round-5 Revision 27** — Hyperlinks open in system browser +
  Resign feature + Stats board display + multi-report P0/P1 fixes:
  • **Clickable hyperlinks (About page + everywhere)**: The About page's
    "Source code: https://github.com/YDW99/Regalia" is now a real `<a>`
    hyperlink (previously plain text). ALL hyperlinks anywhere in the app
    (About dialog's AGPL/GPL license links, stats.html links, etc.) are
    intercepted by a new global click handler that calls
    `AndroidBridge.openUrlInBrowser(url)` — a new `@JavascriptInterface`
    method in StockfishNative.java and StatsActivity.java that launches
    the system default browser via `Intent.ACTION_VIEW`. Defense-in-depth:
    `ChessWebViewClient.shouldOverrideUrlLoading()` and the stats WebView's
    WebViewClient also intercept http(s) URLs at the navigation layer, so
    links triggered by any means (JS `window.open`, meta refresh, etc.)
    are routed to the system browser. URLs are strictly validated to be
    http(s) only — file:, content:, javascript:, intent: schemes are
    silently rejected.
  • **🏳️ Resign feature (DeepSeek review 2.1)**: A new 🏳️ Resign button
    appears in the player bar next to the "Your turn" indicator. Tapping
    it opens a confirmation dialog; confirming ends the game with the
    opponent winning. PGN export follows the 元宝 PGN report convention:
    `[Result "0-1"]` if White resigns / `[Result "1-0"]` if Black resigns,
    `[Termination "Resignation"]` supplementary tag, and a
    `{White resigns.}` / `{Black resigns.}` comment on the last move.
    Stops the engine (`stop` command + isAIThinking=false) and the game
    clock. The game-over overlay shows the correct resign text and
    win/lose emoji.
  • **Stats page board display (DeepSeek review)**: A small chess board
    now appears ABOVE the PGN text panel in 📊统计, showing the position
    after the currently-selected move (or initial position if nothing is
    selected). The board uses the SAME color scheme as the main
    chess.html board (SQ_LIGHT/SQ_DARK gradients, coordinate labels with
    stroke, piece symbols with color/stroke/glow), with White at the
    bottom and Black at the top. Width is responsive (max 360px, aspect
    ratio 1:1).
  • **Kimi stats.html P0 fix — Backspace global interceptor**: The
    `keydown` listener that turns Backspace into "return to main game"
    now checks whether the key event originated from an INPUT, TEXTAREA,
    or contentEditable element. Previously, pressing Backspace while
    editing the PGN paste field or any prompt input would (1) prevent
    the character deletion AND (2) immediately bounce the user back to
    the main game — making text editing impossible.
  • **Kimi stats.html P0 fix — applySANMove king-safety validation**:
    `applySANMove` now validates that the moving side's king is NOT in
    check AFTER the candidate move, by calling a new `_isKingSafe()`
    helper. Previously, `canMoveTo` only checked pseudo-legal moves, so
    a pinned piece could "move" and leave its own king in check —
    corrupting the replayed position and all downstream statistics.
    Castling also now checks post-castle king safety. If a disambiguated
    piece fails the check, the scanner continues to the next matching
    piece (correct SAN disambiguation behavior).
  • **Kimi stats.html P1 fix — game complexity threshold**: Changed
    `validEvals.length>=3` to `>=2`. With 2 evals, `changes` has 1
    element — `avgChange` and `variance` are both well-defined
    (variance=0 for a single sample). The previous >=3 check skipped
    the entire complexity section for 2-eval games.
  • **Kimi stats.html P1 fix — _escFEN escaping**: Added `"` and `'`
    escaping to `_escFEN()`, matching chess.html's `_esc()` behavior.
    Closes a potential XSS vector where a malicious FEN imported via
    PGN could break out of HTML attribute context.
  • **Kimi stats.html P1 fix — exportFullHTML regex**: Replaced the
    lazy `[\s\S]*?\n}` regex (which could match a nested object
    literal's closing brace instead of the function's) with a new
    `_stripFnBody()` helper that does brace-depth counting to find the
    function's true closing brace. Prevents orphaned code from leaking
    into the exported HTML.
  • **Stats.html hyperlink interceptor**: New global click handler in
    stats.html routes `<a href="http(s)://...">` clicks to the new
    `AndroidBridge.openUrlInBrowser()` bridge method.
  • **formatEval resign fix**: The resign case in `formatEval()` now
    uses `_resignWinnerColor` directly (set by `_resignGame()`) instead
    of trying to detect "White wins" / "Black wins" in the gameOver
    text (which only contains "resigns"). Fixes a bug where the player
    always appeared to lose even when they won (e.g. AI resigns).
- **Round-5 Revision 28** (current) — Stats↔main PGN sync + resign emoji
  fix + stats board promotion fix:
  • **Stats↔main PGN sync**: Every time the user enters the stats page
    (📊 button), `openStatsPage()` now ALWAYS rebuilds the PGN from the
    current `moveRecords` via `_buildPGNString(true)` (forceIncludeVariations=true).
    Previously, it used `_cachedOriginalPGN` (the text from the last
    importPGN/importPGNFile call), which became STALE when the user played
    new moves after importing — the stats page would show the imported
    PGN's moves, not the current game's moves. Now the stats page always
    reflects the current main/review game state.
  • **Stats→main PGN import-back prompt**: When the user imports a PGN on
    the stats page (via 🗃️ Paste PGN or 📂 Select PGN File) and then
    returns to the main activity (back button or 返回对局 button), a new
    "🗃️ Import PGN to game?" dialog appears with Yes/No/Cancel:
    - **Cancel**: Stay on the stats page (don't return to main).
    - **No**: Return to main without importing (main keeps its current game).
    - **Yes**: Return to main AND trigger the existing "💾 Save PGN file?"
      prompt (to avoid losing the main/review's current PGN), then import
      the stats-page PGN via `importPGN()`.
    The dialog UI matches the app's existing dialog style (.dov/.dlg/.dlg-btns).
    The Android back button is intercepted: if the import-back dialog is
    visible, back = Cancel (dismiss); otherwise back = returnToGame()
    (which may show the import-back dialog if a PGN was imported).
  • **Resign game-over emoji fix**: The game-over overlay's emoji was
    hardcoded to show 🤝 for all non-checkmate terminations. Now it shows
    🏳️ when `_gameOverStatusKey==='resign'` (matching the resign button's
    icon), and 🤝 only for genuine draws (stalemate, 50-move, repetition,
    insufficient material, agreement).
  • **Stats board promotion fix**: The stats page board display (added in
    Rev27) showed a pawn on the back rank instead of the promoted piece
    (queen/rook/bishop/knight) for promotion moves. Root cause: the
    `moveRecords.push({...})` in `tablebase.js _parsePGN()` (the PGN import
    path) was missing the `promotion` field, so `openStatsPage()` serialized
    move records without promotion info, and the stats page's
    `executeMove()` couldn't apply the promotion. Fixed by adding
    `promotion: move.promotion||null` to the pushed move record.
- **Round-5 Revision 29** — PGN import failure root-cause fix + stats page
  en passant + comprehensive bug fixes:
  • **CRITICAL: PGN import failure fix**: Rev28's `promotion:
    move.promotion||null` referenced an undefined variable `move` (loop
    variable is `parsedMove`). The ReferenceError was caught by the
    surrounding try/catch and shown to the user as "Invalid PGN format" —
    EVERY PGN import failed. Fixed to `(parsedMove&&parsedMove.move&&
    parsedMove.move.promotion)||null`.
  • **CRITICAL: Stats page en passant support**: The simplified SAN parser's
    `canMoveTo()` and `executeMove()` did not handle en passant. Importing
    a PGN with en passant (e.g. move 48 `gxf6` in the user's
    Regalia_game 3Ω.pgn) caused parsing to fail at move 94 → side-to-move
    desync → 25 subsequent moves all rejected → stats page showed only 98
    moves. Added en passant branch to `canMoveTo()` and captured-pawn
    removal to `executeMove()`. Stats page now parses all 123 moves.
  • **Stats page checkmate symbol fix**: `buildSAN()` previously never
    emitted `#` (checkmate) — all checks shown as `+`. Added full
    checkmate detection via in-place simulation (mutate→check king
    safety→revert) to avoid the recursive executeMove→buildSAN→
    executeMove loop that caused stack overflow with the naive approach.
  • **NAG Black-side fix**: `ai-bridge.js _buildPGNString()` and
    `stats.html classifyMove()` used raw White-POV delta for mate
    thresholds. A BLACK mating move was misclassified as $4 (blunder)
    instead of $3 (brilliant). Fixed to use side-relative moverDelta.
  • **Stats page Black-to-move-start caption fix**: `_renderStatsBoard()`
    caption used `lastIdx%2===0` for White/Black, ignoring
    `parsed.isBlackToMoveStart`. For black-to-move-start games, the color
    was inverted. Fixed to respect `parsed.isBlackToMoveStart`.
  • **PGN parsing tolerance improvement**: Unclosed `{...}` comments
    previously survived the multi-iteration regex removal, and the
    residual content was tokenized into bogus move tokens generating
    meaningless NULL placeholders. Now follows PGN spec's tolerant
    behavior: an unclosed `{` consumes the rest of the movetext.
  • **Variation prefix number falsy-0 fix**: `v.prefixEllipsisNum||vmn`
    in `_buildPGNString()` incorrectly fell back to vmn when
    prefixEllipsisNum===0 (legitimate rare value). Fixed to explicit
    null check.
  • **stats.html PGN parse error i18n**: Was hardcoded English "PGN parse
    error". Added i18n key `pgn_parse_error` (zh: "PGN 解析失败").
  • **PGN import high-tolerance**: Invalid moves are skipped with NULL
    placeholders (shown as dimmed "—") and side-to-move is auto-advanced
    to avoid cascade failure. Nested variations supported via recursive
    descent parser. App self-exported PGN re-imports perfectly (123
    moves → export → re-import → 123 moves, lossless).
- **Round-5 Revision 30** (current) — Robustness hardening + scroll
  restoration bug fix:
  • **ROBUSTNESS: Scroll position restoration fix**: The .mlist move list
    repeatedly jumped back to top during re-renders. Root cause: with
    `scroll-behavior:smooth` on .mlist, programmatic `scrollTop`
    assignment during restore fired intermediate 'scroll' events that
    overwrote `_mlistScrollState.scrollTop`, causing the NEXT render to
    restore to a stale intermediate position. Fixed with a
    `_scrollRestoreGuard` flag that suppresses `_onMlistScroll` during
    programmatic restore, plus temporarily switching `scroll-behavior`
    to 'auto' for instant restoration. The save phase now also reads
    `scrollTop` DIRECTLY from the live DOM (not just from the event
    handler) for the most reliable snapshot. Same pattern applied to
    `.review-body` in review mode. `_scrollRestoreGuard` is reset on
    new game.
  • **ROBUSTNESS: ChessWebViewClient URL overload**: Now also overrides
    the newer `WebResourceRequest`-based `shouldOverrideUrlLoading`
    overload (API 24+). The deprecated String-based overload only fires
    on API 21-23; on API 24+ only the `WebResourceRequest` overload is
    invoked. Without this override, http(s) links clicked on API 24+
    devices would NOT be redirected to the system browser. The new
    overload delegates to the String overload for consistent behavior.
  • **ROBUSTNESS: chess960.js randomSPID() modulo bias elimination**:
    Previously `buf[0]%960` had a slight bias (65536 isn't a multiple of
    960; values 0..255 were ~0.03% more likely than 256..959). Now uses
    rejection sampling: only accept values < 65280 (the largest multiple
    of 960 ≤ 65536) before applying %960. Bounded retry count (8)
    prevents infinite loops; fallback to %960 if all retries exceed
    (extremely unlikely — P ≈ 0.4%).

See `NOTICE` (VERSION HISTORY SUMMARY → v1.0.4) and the per-module
`README.license` files for full details.
- **Round-5 Revision 31** (current) — Stats board piece sizing + review
  orientation scroll fix + UCI timed-ponder compliance + dead code cleanup:
  • **Stats board piece sizing fix**: `stats.html _renderStatsBoard()` piece
    font-size was `5.2vw` (viewport-relative). In landscape, the viewport is
    wide (e.g. 800px+) but the board container is capped at 360px, so pieces
    overflowed their squares. Fixed: piece font-size now uses a CSS variable
    `--piece-size` set via JS to `(boardWidth / 8 * 0.72)`. This scales
    correctly with the ACTUAL board container in both portrait and landscape,
    on all Android WebView versions (no container query support needed).
    Added `_updateStatsBoardPieceSize()` called after render and on
    resize/orientationchange.
  • **Review mode orientation-change scroll bug fix**: After orientation
    change, the review move list jumped to a wrong scroll position because
    the save phase read `scrollTop` from the OLD layout and the restore
    phase applied that pixel offset to the NEW layout (where it points to a
    different move). The review-moves-list scroll-into-view logic didn't
    fire either (no `reviewStep` change). Fixed: (1) on orientationchange,
    force `_lastReviewStepScrolled=-2` so the next render re-centers the
    active move in the NEW layout; (2) invalidate `_mlistScrollState.valid`
    so the main move list re-snapshots from the new DOM; (3) set
    `_skipReviewBodyScrollRestore` flag so the review-body doesn't restore
    the stale scrollTop (the active-move scroll-into-view handles
    re-centering instead).
  • **UCI COMPLIANCE: Timed-game ponder fix**: Per UCI spec, `go ponder`
    MUST include time params (wtime/btime/winc/binc) so the engine can
    switch to normal time management when `ponderhit` fires. Previously
    `startPonder()` sent only "go ponder" with no time params — breaking
    timed-game ponder (engine searched indefinitely or panicked after
    ponderhit). Fixed: `startPonder()` now accepts 4 time params; JS side
    passes current `gameClocks` values. For untimed games, all zeros are
    passed and Java side sends plain "go ponder". Added `@deprecated`
    legacy single-arg `startPonder()` overload for backward compat.
  • **Dead code cleanup**: Removed unused `_unclosed` flag in
    `tablebase.js _parsePGN` (was set but never read). Removed dead
    `oppKing` variable in `stats.html buildSAN()` (was always null, never
    read — leftover from abandoned check-detection). Removed dead
    `ch==='\s'` comparison in `pgn-standard.js` (a single char can never
    equal the 2-char string "\s" — typo for regex \s class). Fixed
    `composePGN()` to avoid leading blank lines when tagPairs is empty.
- **Round-5 Revision 32** (current) — ECO book move engine-unresponsive
  bug fix + UCI eval optimization:
  • **CRITICAL: ECO book move causing engine unresponsive**: When "AI
    prefers ECO opening book moves" is enabled, after 3 consecutive
    book-served AI moves, the engine appeared "unresponsive" — no AI
    move was made. Root cause: `doAIMove()` increments `_aiRetryCount`
    on every call (expecting it to be reset by `onBestMove`). When the
    ECO book provides a move, the engine is NOT called, so `onBestMove`
    never fires, and `_aiRetryCount` accumulates. After 3 book moves,
    `_aiRetryCount>=3` → `doAIMove()` falsely concludes "AI move failed
    after 3 consecutive timeouts" → shows `ai_timeout` toast and
    RETURNS WITHOUT CALLING THE ENGINE. Fix: reset `_aiRetryCount=0`
    on a successful book move (and tablebase move) — the "request" was
    satisfied, just by the book instead of the engine.
  • **UCI EVAL OPTIMIZATION (per SF18 best-practices doc)**:
    `engineEval()` and `engineEvalDeep()` now set `Contempt=0` (objective
    eval; default 24 biases scores by avoiding draws, distorting
    analysis), `MultiPV=1` (max search depth; MultiPV>1 reduces depth),
    `UCI_ShowWDL=true` (Win/Draw/Loss probability output) BEFORE the
    eval search. After the eval, `handleBestMove()`'s STATE_EVAL case
    calls `restoreGameplayOptions()` to restore `Contempt=24` (aggressive
    gameplay) and the user's MultiPV setting. New methods:
    `applyEvalModeOptions()`, `restoreGameplayOptions()`.
- **Round-5 Revision 33** (current) — Seldepth (SD) display throughout:
  • **Seldepth parsing & display**: Per SF18 eval best-practices doc, added
    seldepth (selective search depth / tactical depth) parsing and display.
    Seldepth reflects the actual max depth reached in tactical variations
    (usually >= depth). Displayed as "SD<N>" right after "D<N>" to match
    the existing abbreviated depth style (e.g., "D15 SD22").
  • **Main UI eval bar + AI opponent bar**: Both now show "D15 SD22" during
    engine search. SD only shown when > 0 AND > depth (seldepth == depth
    is redundant).
  • **Review mode eval bar**: Now shows real-time depth (D), seldepth (SD),
    nodes, and nps during analysis — previously only showed D with no
    nodes/nps. This gives the user full visibility into the engine's
    search progress while reviewing a position.
  • **PGN eval annotation**: formatEvalTag() now includes "SD<N>" in the
    `{SF18 D15 SD22 +0.5 50%W/30%D/20%L}` annotation when seldepth > depth.
  • **Implementation**: StockfishNative.java new SELDEPTH_PATTERN +
    processInfoLine() parsing + 9th/6th/7th params to onEngineProgress/
    onPonderProgress/onEngineEval. ai-bridge.js new _sfSeldepth global +
    cache storage. ui.js updated all 3 eval bar render paths.
- **Round-5 Revision 34** (current) — Chess960 castling own-piece capture
  fix + heatmap coordinate labels:
  • **CRITICAL: Chess960 castling could capture own pieces**:
    `isChess960CastlingLegal()` only checked squares BETWEEN the king and
    rook, not the king's/rook's destinations. In Chess960, the king and
    rook can start close together (e.g., king b1, rook c1), so the king's
    path extends far beyond the rook through occupied squares. `makeMv()`
    would overwrite those squares, destroying own pieces. Fix: now checks
    the UNION of the king's path and rook's path — every square must be
    empty except the king's and rook's own starting positions.
  • **stats.html Chess960 castling**: `applySANMove()` no longer hardcodes
    king from col 4 (e1) — scans the back rank for the king's actual
    column. `executeMove()` castling rook move is now Chess960-aware,
    finding the nearest rook on the castling side instead of always
    using col 7/0.
  • **stats.html heatmap coordinate labels**: Each heatmap cell now
    displays its coordinate (e.g., "a8", "e4") at the top, centered.
- **Round-5 Revision 35** (current) — Timed-game engine stop fix + AI bar
  seldepth label localization:
  • **CRITICAL: Timed-game engine search exceeded clock time**: Two root
    causes fixed:
    (1) Clock expiry didn't send "stop" to the engine. The engine kept
        searching past the GUI's 0-second mark. Fix: `_onGameClockExpired()`
        now calls `AndroidBridge.engineStop()` for an immediate hard-stop.
    (2) `wtime`/`btime` sent to the engine were stale (measured at JS call
        time, but "go" is sent up to 6s later after stopAndWait + ucinewgame
        + readyok). The engine over-allocated search time. Fix: `engineGoTimed()`
        now deducts the setup overhead + a safety margin from the clock
        values before sending "go".
  • **New @JavascriptInterface methods**: `engineStop()` (hard-stop any
    engine state, discards bestmove), `sendToEngine(String)` (raw UCI
    command fallback).
  • **AI opponent bar SD label localization**: The AI opponent bar now
    shows "选深" (Chinese) / "SelDepth" (English) instead of "SD". The
    eval bar keeps "SD" for compactness. New i18n key: `seldepth_label`.
- **Round-5 Revision 36** (current) — AI bar layout restructure + seldepth
  colon + critical bug fixes:
  • **AI opponent bar layout restructure**: Engine search real-time info
    (depth/seldepth/nodes/nps) moved to line 2 right-aligned. Ponder info
    moved to line 3 right-aligned. Line 1 shows only compact status.
  • **Seldepth label colon**: Added ':' between seldepth label and value
    (选深:22 / SelDepth:22) for format consistency.
  • **CRITICAL: engineStop() idle-state fix**: No longer sets
    _discardingPonderBestmove when engine is idle — prevents the next
    game's first bestmove from being silently discarded.
  • **CRITICAL: onPonderProgress score perspective fix**: was inverted
    (playerColor==='black' → should be 'white'). Ponder scores now display
    with correct sign.
  • **stats.html Chess960 castling detection**: Fixed to use destination
    column (6/2) instead of distance (===2) for Chess960 compatibility.
  • **Redundancy**: _updateAIThinkDisplay() no longer duplicates the
    "thinking" placeholder on line 2.
- **Round-5 Revision 37** (current) — AI bar captured pieces split at 7:
  • **AI opponent bar captured pieces split**: When the AI's captured pieces
    count exceeds 7, pieces 8+ are displayed on line 3 (left-aligned),
    sharing the line with ponder info (right-aligned). Pieces 1-7 remain
    on their original row. The player bar keeps the original single-row
    wrap behavior (unchanged). `capturedPiecesHtml()` gains a `splitAt`
    parameter (7 for AI bar, 0/omitted for player bar).
- **Round-5 Revision 38** (current) — AI opponent bar overflow fix:
  • **AI opponent bar overflow fix**: Some information was exceeding the AI
    bar's display width. Fixed by adding `overflow:hidden` to the inner
    column div, `max-width:100%` + `box-sizing:border-box` to
    `#ai-search-info`, `min-width:0` + `overflow:hidden` to the line-3
    container, `min-width:0` to `#ai-ponder-info`, and `max-width:100%` +
    `overflow:hidden` to `.pbar` CSS. All text now properly truncates with
    ellipsis when the bar is too narrow.
- **Round-5 Revision 39** (current) — Ponder info not displayed when captured
  pieces > 7:
  • **CRITICAL: Ponder info not displayed when captured pieces > 7**: The
    `#ai-cap-overflow` div had `width:100%` + `flex:0 0 auto`, causing it to
    take ALL available width in the line-3 flex container, pushing
    `#ai-ponder-info` off-screen. Fix: removed `width:100%`, changed to
    `flex:0 1 auto` (shrink-to-fit) + `min-width:0`. Now the overflow pieces
    only take the space they need, leaving room for ponder info on the right.
- **Round-5 Revision 40** (current) — Overflow pieces horizontal fix +
  ponder alignment fix:
  • **Overflow pieces vertical wrapping fix**: `#ai-cap-overflow` used
    `flex-wrap:wrap` causing pieces to stack vertically when container
    narrowed. Changed to `flex-wrap:nowrap` + `overflow:hidden` — pieces
    always stay horizontal. Reduced font-size to 0.85rem for overflow pieces.
  • **Ponder alignment fix**: Line-3 container used
    `justify-content:space-between` which put `#ai-ponder-info` at LEFT
    when no overflow (single child). Changed to `margin-left:auto` on
    `#ai-ponder-info` for always-right alignment.
- **Round-5 Revision 41** (current) — Player bar captured pieces font-size
  + stats board coordinate labels rework:
  • **Player bar captured pieces font-size**: Reduced from 1.1rem to 0.85rem
    to match AI opponent bar (both bars now visually consistent).
  • **Stats page board coordinate labels rework**: File labels (a-h) moved
    outside board on TOP, rank labels (1-8) moved outside board on LEFT,
    per-cell coordinate labels (e.g. "e4") added inside each cell — all
    matching main board style exactly (color, stroke, glow, paint-order).
- **Round-5 Revision 42** (current) — AI bar overflow pieces not displayed:
  • **CRITICAL: Overflow captured pieces not displayed**: `#ai-cap-overflow` had
    `overflow:hidden` (clipped pieces) + `flex:0 1 auto` (shrank to 0 width).
    Fix: removed `overflow:hidden`, changed to `flex:0 0 auto` (natural width,
    no shrink). All overflow pieces now display correctly.
- **Round-5 Revision 43** (current) — Exported stats HTML stuck at "Loading..." fix:
  • **CRITICAL: Exported stats HTML stuck at "Loading..."**: The `_stripFnBody()`
    function's brace-counting logic matched nested function closing braces
    (at depth 0 + next char \n/space), truncating the strip of `_exportFullHTML`
    mid-function. This left orphaned code in the exported JS → syntax error →
    page never executed → stuck at "Loading...". Fix: changed end condition to
    depth===0 AND '}' at start of line (preceded by \n) — standard JS convention
    for top-level function closing braces. All 9 stripped functions now strip
    correctly; full exported JS passes syntax validation.
- **Round-5 Revision 44** (current) — Eval bar stuck fix + Worker memory leak
  fix + _stripFnBody simplification:
  • **Eval bar stuck mid-analysis**: Added JS-side eval safety timer (10s) that
    resets `_evalLoading` if the engine doesn't respond. Prevents the eval bar
    from getting stuck at "分析中" when `stopAndWaitForBestmove` blocks or the
    engine fails to respond.
  • **Worker memory leak fix (review report item 1)**: Added `terminateWorker()`
    registered on `pagehide`/`beforeunload` — terminates the Web Worker and
    revokes its Blob URL on page exit, preventing OOM from accumulated Worker
    threads in Android WebView.
  • **_stripFnBody simplification (review report item 18)**: Replaced fragile
    brace-counting with simple regex `function name(){...}` → `function name(){}`
    via non-greedy match to next `\n}` at column 0. Verified for all 9 functions.
- **Round-5 Revision 45** (current) — Engine timeout threshold extended:
  • **AI safety timer**: Extended from 15s to 30s to accommodate timed-game
    mode where the engine may need 20-25s for complex positions at high
    difficulty levels.
  • **Eval safety timer**: Extended from 10s to 15s to match (eval searches
    at depth 15/22 can take 10-12s on complex positions).
- **Round-5 Revision 46** (current) — Timeout emoji fix + engine timeout 360s:
  • **Timeout emoji fix**: Game-over overlay and eval bar now show ⌛ for timeout
    wins (was 🤝 — fell through to default draw emoji).
  • **Engine timeout extended**: AI safety timer 30s→360s (6 min); eval safety
    timer 15s→30s. Fully accommodates long timed games.
- **Round-5 Revision 47** (current) — Timeout game-over text re-localization:
  • **Timeout text not re-localizing**: The timeout game-over text was set
    directly using `_lang` instead of `T()`, so switching language after
    game-over didn't update the text. Fix: added `'timeout'` branch to
    `_gameOverStrFromStatus()` with new `_timeoutWinnerColor` variable and
    new i18n key `timeout_win_suffix`. Now re-localizes correctly.
