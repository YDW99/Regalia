# Regalia Ubiquitous Language

> Domain terminology reference for the Regalia Android chess application (v1.1.0, versionCode 110).
> Covers: Standard Chess, Chess960 variant, Stockfish UCI engine, PGN notation, Syzygy endgame tablebase.
>
> AI-GEN: AI assisted — this document was AI-assisted and has been reviewed for AGPL v3 compliance.
> Copyright (C) 2026 Regalia. Licensed under GNU Affero General Public License v3 (AGPL v3).

---

## 1. Board & Pieces

| Term | Definition | Aliases to avoid / ambiguity notes |
|------|------------|------------------------------------|
| **Piece** | One of six chess piece types: King, Queen, Rook, Bishop, Knight, Pawn | Avoid "chessman" (archaic); Knight uses symbol "N" (not "H" for Horse) |
| **Board** | The 8×8 array of squares. Internal coordinates use `row` 0-7 (top to bottom) and `col` 0-7 (left to right). User-visible coordinates use `rank` 1-8 (bottom to top) and `file` a-h (left to right) | `row`/`col` are internal implementation terms; `rank`/`file` are UI/domain terms — do not mix |
| **Square** | A single board cell, e.g. e4 = `{row:4, col:4}` | Avoid "cell" (out-of-domain) |
| **Algebraic Coordinate** | The textual representation of a single square, e.g. `e2`, `a1`, `h8` | — |
| **King Position** | The exact coordinate of each side's king in the current game state, cached as `s.wk` (white king) / `s.bk` (black king) for fast check detection | Do not confuse with "castling rights" |
| **Promotion** | When a pawn reaches the back rank, it is replaced by a Queen/Rook/Bishop/Knight of the same color | Avoid "transform", "upgrade" |
| **En Passant** | A special pawn capture: when a pawn advances two squares from its starting rank, an enemy pawn on an adjacent file may capture it as if it had advanced only one square | — |
| **Castling Rights** | Four independent boolean flags: `whiteKingside`, `whiteQueenside`, `blackKingside`, `blackQueenside`. Lost when the king or the relevant rook moves | Avoid "castle availability" (vague) |

**Relationship:**
```
Board ──contains──> 64 Squares
Square ──holds──> Piece (or empty)
Piece ──type──> King | Queen | Rook | Bishop | Knight | Pawn
Piece ──color──> White | Black
King Position ──derived from──> Board (real-time coordinates of the King)
Castling Rights ──independent of──> King Position (rights can be lost without moving the king)
```

---

## 2. Moves & Rules

| Term | Definition | Aliases to avoid / ambiguity notes |
|------|------------|------------------------------------|
| **Move** | A single legal piece movement. Internal structure: `{from, to, piece, captured?, promotion?, isCheck?, isCastling?, ...}` | Avoid "step", "turn" (turn = side-to-move) |
| **Turn** | The side currently to move: White to move or Black to move | — |
| **Pseudo-Move** | A move that follows the piece's movement rules but has NOT been filtered for "would leave own king in check" | Avoid "possible move" (ambiguous) |
| **Legal Move** | A pseudo-move that does not leave the mover's own king in check | — |
| **Check** | The king is attacked by an enemy piece | — |
| **Checkmate** | Check + no legal move can resolve the check; game ends immediately | Avoid bare "mate" without context |
| **Stalemate** | Not in check, but no legal move exists; game ends as a draw | Avoid "deadlock", "draw by no moves" |
| **Castling** | A simultaneous king+rook special move. Two variants: kingside (O-O) and queenside (O-O-O) | — |
| **Kingside Castling** | King moves toward the h-file (king's side). SAN: `O-O` | — |
| **Queenside Castling** | King moves toward the a-file (queen's side). SAN: `O-O-O` | — |
| **Castle Side** | Internal enum value (`'kingside'` / `'queenside'` / `null`) used to distinguish which castling variant a move represents | Avoid "direction", "orientation" |
| **Half-Move Clock** | Number of half-moves since the last pawn move or capture; used for the 50/75-move draw rules | Avoid "move counter" (collides with `fullMoveNumber`) |
| **Full-Move Number** | The 1-indexed full-move counter, incremented after Black's move | Avoid "move count", "step count" |
| **Draw Conditions** | 50-move rule / 75-move mandatory rule / threefold repetition / fivefold repetition mandatory / dead position | — |
| **Dead Position** | Neither side can possibly checkmate the other (FIDE 5.2.2), e.g. K vs K, K+minor vs K | Do not confuse with "stalemate" |
| **Checkmate Priority** | FIDE rule: checkmate determination takes priority over ALL draw conditions (including the 75-move rule and fivefold repetition) | Annotated in code as a critical priority |

**Ambiguity ⚠️:**
- `makeMv` vs `makeMvInPlace` (in `game-logic.js`) coexist: the former clones the state before mutating (functional style), the latter mutates in place and returns an undo record (imperative style). In domain conversation, distinguish "clone-move" from "in-place move".
- `_castleSide()` returns an enum (`'kingside'`/`'queenside'`/`null`) but the name suggests a boolean. Reads more naturally as `getCastleSide()` or `detectCastling()` — kept under the legacy name for stability.

---

## 3. Notation Systems

| Term | Definition | Aliases to avoid / ambiguity notes |
|------|------------|------------------------------------|
| **SAN (Standard Algebraic Notation)** | Human-readable move notation, e.g. `Nf3`, `exd5`, `O-O`, `Qh7#` | Avoid bare "algebraic notation" (ambiguous without "Standard") |
| **UCI Move** | Engine-communication move format: source-square + destination-square [+ promotion-piece-letter], e.g. `e2e4`, `g1f3`, `e7e8q` | Avoid "engine move" (too generic) |
| **FEN (Forsyth-Edwards Notation)** | Single-position description standard, e.g. `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` | — |
| **Shredder-FEN** | Chess960-extended FEN: uses the king's and rook's source-file letters instead of `KQkq` to denote castling rights (e.g. `HAha`, `BF`). Also informally called "X-FEN" | **Always use "Shredder-FEN"** in code comments and conversation; "X-FEN" is an alias |
| **PGN (Portable Game Notation)** | Full-game record format: tag pairs + movetext + variations + comments | — |
| **Coordinate Conversion** | `uciToCoords` converts a UCI string (e.g. `e2e4`) into an internal coordinate object `{from, to, promotion?}` | — |
| **Disambiguation** | When multiple same-type pieces can reach the same destination, SAN adds a source-file letter, source-rank digit, or both to disambiguate (e.g. `Nbd2` vs `Nfd2`) | — |

**Relationship:**
```
PGN ──contains──> Tag Pairs + Half-Moves
Half-Move ──represented as──> SAN (human) | UCI (engine)
FEN ──describes──> single static position
SAN ──derived from──> Move + Game State (requires post-move state for +/#)
UCI ──convertible to──> Coords ──executable as──> Move
```

---

## 4. Chess960 Variant

| Term | Definition | Aliases to avoid / ambiguity notes |
|------|------------|------------------------------------|
| **SP-ID (Starting Position ID)** | Chess960 starting-position number, 0-959, uniquely identifying the back-rank piece arrangement | Avoid "position number", "chess960 id" |
| **Chess960 Mode** | Engine mode enabled by `UCI_Chess960=true`; changes FEN parsing and castling-move encoding | — |
| **UCI_Chess960 Castling Format** | In Chess960 mode, Stockfish transmits castling as "king-captures-rook" (e.g. `e1h1`), where the destination is the rook's source square — NOT the king's final square | Avoid "king-capture-rook notation" (informal) |
| **`findCastlingRooks()`** | In Chess960, dynamically computes the available castling rooks based on the current king and rook positions | — |
| **`backRankToSPID()`** | Reverse-maps a back-rank piece arrangement to its Chess960 SP-ID | — |
| **Chess960 Short-King Castling** | In SP-IDs where the king starts at g1/f1 etc., castling moves the king only 1 square | Do not confuse with standard castling (king always moves 2 squares) |

**Ambiguity ⚠️:**
- Standard chess and Chess960 use different castling-detection paths: standard uses "king moves 2 squares", Chess960 uses `_castleSide()` + `findCastlingRooks()`. Domain conversation must specify "which variant is currently active".
- The `gameVariant` variable holds `'chess960'` or `null` — `null` does NOT mean "standard chess explicitly selected", it means "unspecified (treated as standard)". Use `isChess960Mode()` (or equivalent explicit check) for variant detection.

---

## 5. Engine & UCI Protocol

| Term | Definition | Aliases to avoid / ambiguity notes |
|------|------------|------------------------------------|
| **UCI (Universal Chess Interface)** | The communication protocol used by Stockfish and most modern chess engines | — |
| **UCI Handshake** | Initialization sequence: send `uci` → receive `uciok` → send `isready` → receive `readyok` | — |
| **Stockfish 18** | The engine version Regalia uses (arm64-v8a-dotprod native build, run via JNI subprocess) | Avoid "SF" in domain conversation (code abbreviation only) |
| **Best Move** | The move the engine returns via `bestmove` after a `go` command | — |
| **Think / Go** | The engine's search process, triggered by the `go` command | — |
| **Hint** | A short-time-limit search to produce a "hint move" for the current position | Avoid "suggestion", "advice" |
| **Ponder** | The engine pre-searches the opponent's likely reply while they are thinking | Do not confuse with "think" |
| **Evaluation** | The engine's numerical judgement of the position, expressed in centipawns or mate distance | — |
| **Centipawn (cp)** | Evaluation unit; 1 cp = 1/100 of a pawn's value | — |
| **Mate Distance** | The number of moves to forced checkmate (positive = White wins, negative = Black wins) | — |
| **Depth** | The engine's main search-tree depth (plies) | — |
| **Seldepth (Selective Depth)** | The maximum depth reached in tactical lines; usually ≥ depth | Avoid "tactical depth" (non-standard) |
| **Nodes** | The number of positions the engine evaluated during search | — |
| **NPS (Nodes Per Second)** | Engine search speed | — |
| **PV (Principal Variation)** | The engine's best-line sequence, a list of UCI moves | — |
| **MultiPV** | The engine simultaneously returns N best lines (main line + alternatives) | — |
| **WDL (Win/Draw/Loss)** | A triple of percentages expressing the engine's win/draw/loss estimate for the side to move | Three distinct meanings — engine eval WDL, Syzygy tablebase WDL, UI-displayed WDL. Always qualify the source. |
| **UCINewGame** | The UCI command telling the engine a new game is starting; the engine should clear its hash | — |
| **UCI Option** | A configurable engine parameter: `Hash`, `Threads`, `MultiPV`, `UCI_Elo`, `UCI_LimitStrength`, `UCI_Chess960`, `Contempt`, etc. | — |
| **AI Level** | A 1-8 preset difficulty level, mapped to `UCI_Elo` values (0, 800, 1350, 1700, 2000, 2200, 2350). Level 7 = unrestricted strength, Level 8 = custom | — |
| **Engine State Machine** | `STATE_NONE` / `STATE_GO` / `STATE_HINT` / `STATE_EVAL` / `STATE_PONDER` | — |
| **Engine Recovery** | The Java layer's automatic engine-process restart after a crash or unresponsiveness | — |
| **Contempt** | The engine's draw-aversion parameter; higher values make the engine less willing to accept draws | — |

**Relationship:**
```
UCI Handshake ──precondition──> Go / Eval / Hint / Ponder
Go ──produces──> Best Move + PV (info lines stream)
PV ──contains──> sequence of UCI Moves
Evaluation ──expressed as──> Centipawn | Mate Distance
Evaluation ──may carry──> WDL triple
AI Level ──maps to──> UCI_Elo ──controls──> LimitStrength
MultiPV ──controls──> number of PVs returned
```

---

## 6. PGN & Annotations

| Term | Definition | Aliases to avoid / ambiguity notes |
|------|------------|------------------------------------|
| **Seven-Tag Roster** | The 7 mandatory PGN tags: `Event`, `Site`, `Date`, `Round`, `White`, `Black`, `Result` | — |
| **Variation / RAV (Recursive Annotation Variation)** | An alternative move sequence in a PGN, wrapped in `(...)`. Can be nested | Avoid "branch", "alternative line" |
| **Type A Variation** | An alternative to the branching-point move itself (same side to move as the branch point) | Used only in PGN parsing code |
| **Type B Variation** | A continuation AFTER the branching point (opposite side to move vs. the branch point) | Used only in PGN parsing code |
| **NAG (Numeric Annotation Glyph)** | Numeric annotation symbol, e.g. `$1`=`!`, `$2`=`?`, `$3`=`!!`, `$4`=`??`, `$6`=`!?` | — |
| **`[%eval]` comment** | Embedded engine-evaluation PGN comment, e.g. `[%eval +2.35]` or `[%eval #-3]` | — |
| **`[%csl]` comment** | Colored Squares annotation, e.g. `[%csl Gc5]` (green circle on c5) | — |
| **`[%cal]` comment** | Colored Arrows annotation, e.g. `[%cal Gc5d4]` (green arrow c5→d4) | — |
| **`[%emt]` comment** | Elapsed Move Time annotation | — |
| **`[%clk]` comment** | Clock time remaining annotation | — |
| **Prefix Ellipsis** | The `N...` display format used in Type B variations where the branch point is a Black move (e.g. `1... e5`) | — |
| **Move Record** | The UI-side structure for a single move: `{notation, from, to, piece, captured, promotion, isCheck, isCastling, variations, comment, ...}` | — |
| **Round-Trip Export** | PGN-then-re-import to verify all information is losslessly preserved | — |

**Ambiguity ⚠️:**
- `moveHistory` (in `game-logic.js`) holds the move list in internal coordinates. `moveRecords` (in `ui.js`) holds the display list with algebraic notation and metadata. They are distinct concepts; do not use the names interchangeably.
- The `moveIdx` returned by `_parsePGN` and the index into `moveRecords` after `importPGN` may differ by 1 due to the `_prependBlackToMovePlaceholder` logic.

---

## 7. Endgame Tablebase

| Term | Definition | Aliases to avoid / ambiguity notes |
|------|------------|------------------------------------|
| **Syzygy** | The endgame tablebase format standard, covering all positions with 7 or fewer pieces | — |
| **WDL (tablebase)** | The tablebase's win/draw/loss verdict for the current position (no distance info) | Same abbreviation as engine WDL but different source — always qualify |
| **DTZ (Distance To Zeroing)** | The number of moves to the nearest "zeroing event" (capture or pawn move); used for precise endgame navigation | — |
| **DTC / DTL** | Distance To Conversion / Distance To Mate (Regalia does not use Syzygy DTM directly) | — |
| **Tablebase Probe** | An online query to the Lichess API (`tablebase.lichess.ovh`) for Syzygy data | — |
| **7-Piece Endgame** | The Syzygy coverage ceiling: both sides total ≤ 7 pieces (including kings). Checked via `pieceCountLE7()` | — |
| **LRU Cache (Tablebase Cache)** | A FEN-keyed cache of tablebase query results, max 50 entries | — |
| **Tablebase Offline Flag** | After 3 consecutive query failures, the tablebase is temporarily marked unavailable and auto-recovered after 60 seconds | — |

---

## 8. Opening Classification

| Term | Definition | Aliases to avoid / ambiguity notes |
|------|------------|------------------------------------|
| **ECO (Encyclopedia of Chess Openings)** | The standard opening classification system, codes A00-E99 | — |
| **ECO Code** | One of 5 opening classes: A (flank), B (semi-open), C (open), D (closed), E (Indian defenses) | — |
| **ECO Opening Name** | A human-readable name like "Ruy Lopez", "Sicilian Defense" | — |
| **ECO Opening Family** | The family classification, e.g. "Sicilian", "King's Indian" | — |
| **ECO Book Move** | The opening-book move queried from the ECO database for the current move history | — |
| **ECO Recommendation** | A book move recommended to the player, weighted by material exchange, center control, and development | — |
| **ECO Hash Index** | A prebuilt index by 1st/2nd/3rd move, accelerating opening matching | — |

---

## 9. UI & Interaction

| Term | Definition | Aliases to avoid / ambiguity notes |
|------|------------|------------------------------------|
| **Review Mode** | Post-game mode for replaying the game, viewing engine evaluations and variation lines | Avoid "replay mode" (ambiguous) |
| **Setup Mode** | Free-edit mode for placing pieces and configuring a custom position | — |
| **Eval Bar** | A visual bar showing the current position's evaluation from White's perspective | — |
| **Control Heatmap** | A colored overlay showing how many times each side attacks each square | — |
| **Move Records List** | The UI display list of moves, supports variation expansion | — |
| **Visual Annotation** | Colored arrows and highlighted squares on the board, derived from engine analysis or PGN import | Includes check arrows (red), check-response arrows (green) |
| **Haptic Feedback** | Vibration feedback triggered on the player's move | — |
| **Move Sound** | Sound effect matched to the operation type (capture, check, castling, normal move) | — |
| **AI Think Indicator** | The "thinking..." status UI shown during engine search | — |

---

## 10. State & Persistence

| Term | Definition | Aliases to avoid / ambiguity notes |
|------|------------|------------------------------------|
| **Game State** | The complete position representation: `board`, `currentTurn`, `castlingRights`, `enPassantTarget`, `halfMoveClock`, `fullMoveNumber`, `moveHistory`, `posCount`, `wk`, `bk`, `hash`, `boardVersion` | Avoid "position" (only refers to the board layout) |
| **Zobrist Hash** | A 64-bit hash value for fast position-equality comparison, supports incremental update | — |
| **Position Count** | A `Map<hash, count>` recording how many times each Zobrist hash has occurred, used for repetition detection | The current position IS counted in the map — when checking "3 occurrences", the current occurrence is included |
| **State History** | An array of per-move snapshots supporting undo, each containing a cloned state and an undo record | — |
| **Review Eval Cache** | A per-position engine-evaluation cache keyed by review step (LRU, 2000-entry soft cap) | — |
| **Start FEN** | The FEN string for a custom starting position (set when importing PGN/FEN) | Stored in the `_setupFEN` variable |
| **Board Version** | An incrementing integer for fast "did the board change?" detection (replaces `JSON.stringify`) | — |

---

## 11. Domain Model Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Regalia Domain Model                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                │
│  │ Board/Piece │◄───│    Move     │◄───│ Notation    │                │
│  │             │    │             │    │ FEN/SAN/UCI │                │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                │
│         │                  │                  │                        │
│         ▼                  ▼                  ▼                        │
│  ┌─────────────────────────────────────────────────────┐              │
│  │                  Game State                          │              │
│  │  board + currentTurn + castlingRights + wk/bk + ... │              │
│  └──────┬──────────────────────────────┬───────────────┘              │
│         │                              │                              │
│         ▼                              ▼                              │
│  ┌─────────────┐              ┌─────────────────────┐                │
│  │  Rules      │              │  PGN import/export  │                │
│  │  check/mate │              │  [%eval][%csl][%cal]│                │
│  └──────┬──────┘              └──────────┬──────────┘                │
│         │                                │                            │
│         ▼                                ▼                            │
│  ┌─────────────┐              ┌─────────────────────┐                │
│  │  Chess960   │              │  ECO classification  │                │
│  │  SP-ID      │              │  queryECOBookMove    │                │
│  │ Shredder-FEN│              └─────────────────────┘                │
│  └──────┬──────┘                                                       │
│         │                                                              │
│         ▼                                                              │
│  ┌─────────────────────────────────────────────────────┐              │
│  │              Stockfish UCI Engine Layer              │              │
│  │  go/hint/eval/ponder ──► bestmove + PV + info       │              │
│  │  scoreCp / scoreMate / WDL / depth / seldepth       │              │
│  └──────┬──────────────────────────────┬──────────────┘              │
│         │                              │                              │
│         ▼                              ▼                              │
│  ┌─────────────┐              ┌─────────────────┐                    │
│  │ AI Level 1-8│              │ Syzygy Tablebase│                    │
│  │ UCI_Elo map │              │ Lichess API     │                    │
│  └─────────────┘              │ WDL / DTZ       │                    │
│                               └─────────────────┘                    │
│                                                                        │
│  ┌─────────────────────────────────────────────────────┐              │
│  │                    UI Layer                          │              │
│  │  Review Mode | Setup Mode | Eval Bar | Heatmap      │              │
│  │  Move Records | Visual Annotations | Haptic         │              │
│  └─────────────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Ambiguity Summary

| # | Ambiguity | Location | Recommendation |
|---|-----------|----------|----------------|
| 1 | `row` vs `rank` | `game-logic.js` uses `row` (0-7) internally; UI uses `rank` (1-8) and `file` (a-h) | Standardize: `row`/`col` in implementation, `rank`/`file` at the UI boundary |
| 2 | `makeMv` vs `makeMvInPlace` | `game-logic.js` — coexist; former clones, latter mutates | Distinguish "clone-move" from "in-place move" in conversation |
| 3 | `_castleSide()` returns enum | `game-logic.js` — name suggests boolean | Reads as `getCastleSide()` / `detectCastling()`; kept under legacy name for stability |
| 4 | `moveHistory` vs `moveRecords` | Former: internal-coord array (engine-facing); latter: algebraic+metadata array (UI-facing) | Distinguish "move history" (internal) from "move records" (UI) |
| 5 | Shredder-FEN / X-FEN | Used interchangeably in `ai-bridge.js` comments | **Always use "Shredder-FEN"**; "X-FEN" is an alias |
| 6 | `gameVariant='chess960'` vs `null` | `null` does not mean "standard chess explicitly selected" — it means "unspecified (treated as standard)" | Use `isChess960Mode()` (or equivalent explicit check) for variant detection |
| 7 | `posCount` includes current position | When checking "≥ 3 occurrences for draw", the current occurrence is counted | Make the "includes current occurrence" semantics explicit in repetition-check dialogue |
| 8 | `_discardingPonderBestmove` flag | `StockfishNative.java` — discards a stale bestmove from a stopped ponder | Could read as `_stalePonderBestmoveFlag` for clarity; kept under legacy name |
| 9 | `hint` vs `eval` engine states | `STATE_HINT` and `STATE_EVAL` share code paths in the engine layer | Make "Hint is a time-limited search; Eval is a deep search" explicit in conversation |
| 10 | `WDL` triple meaning | Engine eval WDL / Syzygy tablebase WDL / UI-displayed WDL — same abbreviation, different sources | Always qualify the source ("engine WDL", "tablebase WDL", "displayed WDL") |

---

## 13. Example Conversations

### Conversation 1: Castling-Rights Notation

> **Developer**: How should we represent castling rights in Chess960 mode? The standard `KQkq` doesn't seem sufficient.
>
> **Domain Expert**: In Chess960, `KQkq` is **ambiguous** — `K` implies the white king is on e1 and a white rook on h1, but in Chess960 they may be elsewhere. We should use **Shredder-FEN**, which uses the **source-file letters** of the king and rook, e.g. `HAha` means White can castle on the a-file and h-file.
>
> **Developer**: Got it. So our `generateFEN` function needs to detect Chess960 mode and switch between `KQkq` and Shredder-FEN automatically.
>
> **Domain Expert**: Correct. For backward compatibility, when the king is on e1 and rooks on a1/h1 (the standard position), still output `KQkq`.

### Conversation 2: Engine Move Format

> **Developer**: Stockfish seems to send a different castling-move format in Chess960 mode? I'm getting `e1h1` instead of `e1g1`.
>
> **Domain Expert**: That's the **UCI_Chess960 castling format** — the engine sends a "king-captures-rook" move where the destination is the **rook's source square**, not the king's final square. You need to detect this in `uciToCoords`: if the source square is the king, the destination square holds a same-color rook, and they're on the same rank, rewrite the destination to the king's actual castling destination (kingside = col 6, queenside = col 2).
>
> **Developer**: That's completely different from the standard `e1g1` format.
>
> **Domain Expert**: Standard uses `e1g1` (king moves 2 squares); Chess960 uses `e1h1` (king "captures" the rook). The detection key is "does the destination square hold a same-color rook".

### Conversation 3: Evaluation and Review

> **Developer**: In the review eval cache, what do reviewStep 0 and reviewStep N represent?
>
> **Domain Expert**: Step 0 is the **initial position** (before any move); Step N is the position **after** the Nth move. So a 10-move game has 11 evaluable steps (0 through 10).
>
> **Developer**: Which step should a PGN `[%eval]` comment attach to?
>
> **Domain Expert**: A `[%eval]` after a move is the post-move evaluation, corresponding to `reviewStep = moveIndex + 1`. Note the +1 offset if the game starts with Black to move (there's a placeholder null move).
>
> **Developer**: Clear. We use `_reviewEvalCache` keyed by `reviewStep`.

### Conversation 4: Tablebase Probe Timing

> **Developer**: Why does the tablebase only get queried at AI Level 7?
>
> **Domain Expert**: Only the **highest level** queries the **Syzygy tablebase** (7 pieces or fewer). Lower levels intentionally skip it, letting Stockfish compute itself — simulating the human experience of making mistakes in endgames.
>
> **Developer**: How are the `wdl` and `dtz` fields from the tablebase used?
>
> **Domain Expert**: WDL tells you whether the position is win/draw/loss; DTZ tells you the distance to the nearest "zeroing event" (capture or pawn move). If DTZ is 50+, the game may end in a 50-move-rule draw before conversion.
>
> **Developer**: Should the UI show WDL or DTZ?
>
> **Domain Expert**: Show WDL (e.g. "Tablebase: Win"); reserve DTZ for advanced users or the stats page.

### Conversation 5: PGN Variation Types

> **Developer**: PGN imports sometimes show variations next to the wrong move. What's going on?
>
> **Domain Expert**: PGN variations come in two types. A **Type A variation** is an alternative to the branch-point move itself — e.g. if White played 1.e4, the variation 1.d4 is Type A. A **Type B variation** is a continuation AFTER the branch point — after 1.e4 e5, a variation starting 2.Nf3 is Type B.
>
> **Developer**: So the `branchMoveIsWhite` vs `firstMoveIsWhite` relationship determines the type?
>
> **Domain Expert**: Exactly. If `firstMoveIsWhite == branchMoveIsWhite`, it's Type A (alternative) — kept at the branch-point move record. Otherwise it's Type B (continuation) — may need relocation after the actual game move is matched.
>
> **Developer**: And the `N...` prefix ellipsis in Type B variations is auto-generated?
>
> **Domain Expert**: Yes. When the branch point is a Black move and the variation starts with White's next move, display `N...` to indicate "after Black plays something else".

---

## 14. Abbreviation Quick Reference

| Abbreviation | Full Form | Domain |
|--------------|-----------|--------|
| SAN | Standard Algebraic Notation | Notation |
| FEN | Forsyth-Edwards Notation | Position description |
| PGN | Portable Game Notation | Game record |
| UCI | Universal Chess Interface | Engine communication |
| NAG | Numeric Annotation Glyph | PGN annotation |
| ECO | Encyclopedia of Chess Openings | Opening classification |
| SP-ID | Starting Position ID | Chess960 |
| PV | Principal Variation | Engine analysis |
| WDL | Win/Draw/Loss | Engine eval / tablebase |
| DTZ | Distance To Zeroing | Tablebase |
| NPS | Nodes Per Second | Engine performance |
| cp | centipawn | Engine eval |
| LRU | Least Recently Used | Caching |
| TB | Tablebase | Endgame |
| RAV | Recursive Annotation Variation | PGN variation |
| CSL | Colored Squares | PGN annotation |
| CAL | Colored Arrows | PGN annotation |
| EMT | Elapsed Move Time | PGN annotation |
| OIS | Optical Image Stabilization | Anti-shake (analogous) |
| OEM | Original Equipment Manufacturer | Device vendor |
| TLS | Transport Layer Security | Network security |
| SAF | Storage Access Framework | Android file I/O |
| JNI | Java Native Interface | Native bridge |
| API | Application Programming Interface | Android version level |

---

*This glossary is based on the Regalia v1.1.0 source code, covering 7 core source files and extracting 80+ domain terms.*
