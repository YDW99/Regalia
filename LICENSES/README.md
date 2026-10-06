# LICENSES/ — License & Notice File Index

<!-- AI-GEN: AI assisted
     This document was AI-assisted and has been reviewed for AGPL v3 compliance. -->

Regalia is a combined work under **AGPL v3** (original code) + **GPL v3**
(DroidFish-derived code and the Stockfish engine), each "either version 3
of the License, or (at your option) any later version". This index lists
every license/notice file in the repository. The files themselves live at
the locations below (mostly the repository root) so that GitHub and
tooling detect them in their conventional places.

## Root directory

| File | Content | Applies to |
|------|---------|------------|
| `LICENSE` | GNU Affero General Public License v3 (full text) | Original Regalia code (primary project license detected by GitHub) |
| `LICENSE-AGPL v3` | Same AGPL v3 full text (byte-identical to `LICENSE`) | Original Regalia code |
| `LICENSE-GPL v3` | GNU General Public License v3 (full text) | DroidFish-derived files + Stockfish engine (see `NOTICE` §1 for the per-file list) |
| `LICENSE-Apache v2.0` | Apache License v2.0 (full text) **+ LLVM Exception appendix** | `libc++_shared.so` (NDK C++ runtime, Apache-2.0 WITH LLVM Exception) and the Gradle wrapper (Apache-2.0) |
| `NOTICE` | Third-party notices: combined-work licensing, per-file GPL/AGPL classification, and per-component attribution (Stockfish, DroidFish, libc++_shared, Gradle, ECO data, Lichess tablebase API) | Whole project |
| `NOTICE-DroidFish` | Detailed file-by-file DroidFish derivation mapping | GPL v3-classified files |
| `NOTICE-gradle` | Gradle notice (Apache-2.0) | `gradle/wrapper/`, `gradlew`, `gradlew.bat` (build-time only) |
| `AUTHORS-stockfish` | Stockfish project authors list | `libstockfish.so` |

## Per-directory `README.license` ledgers

Each `README.license` records the license classification of its directory
and a newest-first change ledger (per round/phase):

- `src/main/README.license`
- `src/main/assets/README.license`
- `src/main/assets/chess.src/README.license`
- `src/main/cpp/README.license`
- `src/main/java/com/Regalia/README.license`
- `src/main/res/README.license`
- `assets/README.license`
- `lib/arm64-v8a/README.license` (deletion record for the prebuilt `.so`
  files; build-time binaries live in `src/main/jniLibs/arm64-v8a/`, not committed)
- `Manual/README.license`
- `verifier/README.license`
- `.github/README.license`

## Notes

- `libstockfish.so` (Stockfish 18, arm64-v8a-dotprod) is **not committed**;
  it is downloaded at build time into `src/main/jniLibs/arm64-v8a/` with a
  SHA-256 check — see `BUILDING.md`. Its runtime integrity is additionally
  verified by the app (`EXPECTED_ENGINE_SHA256` in `StockfishNative`).
- The ECO opening data embedded in `src/main/assets/chess.src/eco-data.js`
  comes from lichess-org/chess-openings (CC0 1.0).
- The Lichess tablebase API is an online service (the app's only network
  access, certificate-pinned), not a bundled component — see `NOTICE` §7
  and `PRIVACY.md`.
- History: up to round-55, `NOTICE` doubled as the English development
  log; in round-56 it was rewritten as this third-party notices document
  and the original log was archived verbatim in `worklog.md`.
