# Contributing Guide

> Thank you for your interest in Regalia! Whether you are fixing a bug, adding a new feature, or improving documentation, your contribution will help chess enthusiasts worldwide enjoy a better playing experience.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Report Bugs](#how-to-report-bugs)
- [How to Submit Feature Requests](#how-to-submit-feature-requests)
- [How to Submit a Pull Request](#how-to-submit-a-pull-request)
- [Development Environment Setup](#development-environment-setup)
- [Code Style Guide](#code-style-guide)
- [License Compliance](#license-compliance)
- [Testing Requirements](#testing-requirements)
- [Version Number Rules](#version-number-rules)
- [Contact Us](#contact-us)

---

## Code of Conduct

By participating in the Regalia project, you agree to:

- Treat every contributor with respect and kindness
- Welcome beginners and answer questions patiently
- Accept constructive criticism
- Focus on what is best for the community
- This project is primarily developed by a non-professional programmer (AI-assisted development); please be inclusive and understanding

---

## How to Report Bugs

### Using the Issue Template (Recommended)

1. Go to the [Issues page](https://github.com/YDW99/Regalia/issues/new/choose)
2. Select the **"Bug Report"** template
3. Fill out the form as completely as possible

### Before Reporting

- Search existing Issues to confirm the bug has not been reported
- Make sure you are using the [latest version](https://github.com/YDW99/Regalia/releases)
- Try clearing App data and reproducing the issue

### A Good Bug Report Should Include

| Item | Description |
|------|-------------|
| Clear title | One sentence summarizing the problem, e.g. "Engine crashes on specific FEN" |
| Reproduction steps | Numbered list of steps from opening the App to triggering the bug |
| Expected behavior | What you expected to happen |
| Actual behavior | What actually happened (including error messages) |
| Device info | Android version, device model, ROM type |
| App version | The version number shown in ℹ️ → About |
| PGN/FEN | If the bug is game-related, attach a PGN or FEN string |
| Screenshots/recording | Highly recommended for visual issues |

### Security Vulnerabilities

If you discover a security vulnerability, **do not** submit a public Issue. Please contact the developer privately via email (see GitHub profile).

---

## How to Submit Feature Requests

### Using the Issue Template (Recommended)

1. Go to the [Issues page](https://github.com/YDW99/Regalia/issues/new/choose)
2. Select the **"Feature Request"** template
3. Describe your idea in detail

### Feature Request Guidelines

- Describe the problem you want to solve, not just "add some feature"
- Explain the target user group and use cases
- If possible, provide UI sketches or interaction flow diagrams
- Indicate what you consider a reasonable priority

---

## How to Submit a Pull Request

### Workflow

```
1. Fork repo -> 2. Create branch -> 3. Develop -> 4. Test -> 5. Submit PR -> 6. Code Review -> 7. Merge
```

### 1. Fork and Clone

```bash
# Fork this repository to your GitHub account, then clone

git clone https://github.com/YOUR_USERNAME/Regalia.git
cd Regalia
```

### 2. Branch Strategy

| Branch | Purpose | Note |
|--------|---------|------|
| `main` | Stable branch | Only merge via PR, direct push is prohibited(Unless permitted to bypass the rules) |
| `upload` | Upload and unzip | Create a branch from any branch, specifically for use with the `unzip-folder-optimized.yml` workflow to automatically unzip and upload ZIP archives |
| `dev` | Development branch | Integration branch for feature development |
| `feature/*` | Feature branches | Branched from `dev`, e.g. `feature/pgn-import` |
| `fix/*` | Fix branches | Branched from `dev`, e.g. `fix/engine-crash` |
| `hotfix/*` | Emergency fixes | Branched from `main`, for urgent fixes |

```bash
# Example: creating a feature branch
git checkout dev
git pull origin dev
git checkout -b feature/your-feature-name
```

### 3. Commit Convention

We follow the **Conventional Commits** specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type (Required)

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation updates (README, manuals, etc.) |
| `style` | Code formatting changes (no functional impact) |
| `refactor` | Code refactoring |
| `perf` | Performance optimization |
| `test` | Testing related |
| `build` | Build system related (Gradle, CMake, etc.) |
| `chore` | Other miscellaneous tasks (dependency updates, config changes, etc.) |
| `i18n` | Internationalization / localization related |

#### Scope (Optional)

- `engine` -- Engine (Stockfish, JNI layer)
- `ui` -- User interface (WebView, JavaScript frontend)
- `android` -- Android native layer (Java/Kotlin)
- `docs` -- Documentation
- `build` -- Build system

#### Examples

```
feat(engine): add UCI_AnalyseMode support

Add an "Analysis Mode" option in settings, allowing the engine
to analyze positions at greater depth.
Does not affect normal gameplay mode performance.

fix(ui): fix coordinate text invisible in dark theme

Coordinate colors were not adapted to the dark theme palette, now fixed.

refactor(android): split BoardActivity into multiple Fragments

Improve code maintainability and lay groundwork for tablet layouts.
```

### 4. Pre-PR Checklist

- [ ] Code follows the project code style (see [Code Style Guide](#code-style-guide))
- [ ] All changes have been tested on a physical Android device (see [Testing Requirements](#testing-requirements))
- [ ] Commit history is clear and follows the commit convention
- [ ] Branch is synced with the latest `dev` branch (`git rebase dev`)
- [ ] No hardcoded keys, passwords, or other sensitive information
- [ ] New third-party libraries are declared in the NOTICE file
- [ ] I understand and agree to the project's AGPL v3 + GPL v3 dual license

### 5. PR Review Process

- Maintainers will respond to your PR within **7 business days**
- A PR requires approval from **at least 1 maintainer** before merging
- Please be patient when revising based on feedback; maintainers will review again
- Large changes may require a longer review period

---

## Development Environment Setup

### Basic Requirements

| Item | Version / Note |
|------|---------------|
| Android Studio | Latest stable version |
| JDK | 17+ |
| Android SDK | API 24+ (Android 7.0) |
| NDK | r25b+ (for Stockfish compilation) |
| CMake | 3.22+ |
| Git | 2.30+ |
| Physical device | **Required** (see [Testing Requirements](#testing-requirements)) |

### Quick Start

For detailed build steps, please refer to [**BUILDING.md**](BUILDING.md). Below is a summary:

```bash
# 1. Clone the repository
git clone https://github.com/YDW99/Regalia.git
cd Regalia

# 2. Open the project in Android Studio
#    File -> Open -> Select the Regalia directory

# 3. Wait for Gradle sync to complete
#    If you encounter issues, check the SDK/NDK paths in local.properties

# 4. Build the Stockfish engine
#    Detailed steps are in BUILDING.md "Engine Compilation" section

# 5. Connect a physical device and click Run
```

### Common Issues

| Problem | Solution |
|---------|----------|
| NDK path not found | Add `ndk.dir=/path/to/ndk` in `local.properties` |
| Stockfish compilation failed | Ensure NDK version >= r25b, and install CMake 3.22+ |
| WebView white screen | Check that frontend files in the assets directory are correctly included |
| Gradle sync timeout | Switch to a domestic mirror or enable a proxy |

---

## Code Style Guide

### Java (Android Layer)

We follow the main principles of the [Google Java Style Guide](https://google.github.io/styleguide/javaguide.html):

```java
// Correct example
public class ChessEngine {
    private static final String TAG = "ChessEngine";
    private final Context context;
    private int searchDepth;

    public ChessEngine(Context context, int depth) {
        this.context = context;
        this.searchDepth = depth;
    }

    /**
     * Start engine search and return the best move.
     *
     * @param fen Current position FEN string
     * @param callback Callback after search completes
     */
    public void searchBestMove(String fen, SearchCallback callback) {
        if (fen == null || fen.isEmpty()) {
            throw new IllegalArgumentException("FEN cannot be null or empty");
        }
        // Implementation...
    }
}

// Incorrect example
public class chessengine{
private Context ctx;
int search_depth;
public chessengine(Context c, int d){
ctx = c;
search_depth = d;
}
}
```

#### Java Code Style Essentials

- **Indentation**: 4 spaces (no tabs)
- **Naming**: PascalCase for classes, camelCase for methods/variables, UPPER_SNAKE_CASE for constants
- **Line width**: Max 120 characters
- **Braces**: Opening brace on the same line (K&R style)
- **Blank lines**: Keep blank lines between classes/methods; add separator comments between logical sections
- **Comments**: Javadoc is mandatory for public APIs; use inline comments for complex logic
- **Language**: All code comments must be in **English** for the benefit of international contributors

### JavaScript (WebView Frontend)

```javascript
// Correct example
/**
 * Update the board display state
 * @param {string} fen - FEN string
 * @param {Array} lastMove - Last move [from, to]
 */
function updateBoard(fen, lastMove) {
    const board = Chessboard('board', {
        position: fen,
        moveSpeed: 200,
        onDrop: handlePieceDrop,
    });

    if (lastMove && lastMove.length === 2) {
        highlightSquare(lastMove[0]);
        highlightSquare(lastMove[1]);
    }

    return board;
}

// Constants use ALL_CAPS
const SQUARE_SIZE = 64;
const ANIMATION_DURATION_MS = 200;

// Incorrect example
function update_board(fen,lastmove){
var board=Chessboard('board',{position:fen,moveSpeed:200,onDrop:handlePieceDrop})
if(lastmove){
highlightSquare(lastmove[0]);highlightSquare(lastmove[1])
}return board}
```

#### JavaScript Code Style Essentials

- **Indentation**: 4 spaces
- **Quotes**: Single quotes `'` as primary; use double quotes `"` for HTML attributes
- **Semicolons**: Always use explicit semicolons
- **Naming**: camelCase; PascalCase for constructors
- **Variables**: Prefer `const`; use `let` when reassignment is needed; **never use `var`**
- **Comparison**: Always use `===` and `!==`
- **Comments**: JSDoc is mandatory for functions; explain complex algorithms

### C++ (JNI / Stockfish Related)

Follow the Stockfish project's own code style. When modifying Stockfish code, please maintain consistency with the upstream style.

---

## License Compliance

### Dual License Notice

Regalia adopts the **AGPL v3 + GPL v3** dual license:

| Scenario | Applicable License |
|----------|-------------------|
| Network service interaction (e.g., online play features) | AGPL v3 |
| Local use, distribution | GPL v3 |

### Contributor Obligations

- **By submitting a PR**, you agree to release your contribution under the AGPL v3 + GPL v3 license
- You must have the right to grant the above license (i.e., your submission does not infringe third-party rights)
- Do not submit code copied from commercial closed-source software

### Introducing New Third-Party Libraries

If you need to introduce a new third-party library:

1. Confirm that the library's license is **compatible** with AGPL v3 / GPL v3
2. Add the library's copyright notice to the **NOTICE** file
3. Explain the rationale and license information in the PR description
4. Incompatible licenses include but are not limited to: proprietary, SSPL, CC-NC, etc.

### Compatible Licenses (Examples)

Compatible: MIT, BSD-2/3-Clause, Apache-2.0, LGPL-2.1/3.0, GPL-2.0/3.0, AGPL-3.0  
Incompatible: Proprietary, CC-NC-*, SSPL, custom commercial licenses

### Copyright Header

Please add the following header to each newly created file:

```java
/*
 * Regalia - Open-source Android chess application
 * Copyright (C) 2026 D.W. Yang and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
```

---

## Testing Requirements

### Must Test on a Physical Device

**An emulator is not sufficient to verify the following scenarios.** Please test on a physical Android device before submitting a PR:

| Test Item | Minimum Requirement |
|-----------|--------------------|
| Engine loading | Confirm Stockfish starts normally without crashing |
| Strength test | Complete at least 3 full games (different difficulty levels) |
| PGN import/export | Test PGN files containing comments and variations |
| Theme switching | UI is normal under both light and dark themes |
| Orientation change | Rotating the screen during gameplay does not lose state |
| Background recovery | Switch to background and return; game state is preserved |
| Low memory scenario | No crash after extended use (>30 minutes) |

### Recommended Device Coverage

- **Android versions**: Cover at least Android 10 and Android 14
- **Architecture**: arm64-v8a (Stockfish dotprod optimization depends on it)
- **Screen sizes**: Phone (~6") + tablet (~10", if available)

### Test Report

Fill in the test device information in the PR description:

```markdown
## Test Device
- Device: Xiaomi 14
- Android: 14 (API 34)
- Architecture: arm64-v8a
- ROM: HyperOS 1.0
- Test Result: All passed
```

---

## Version Number Rules

Regalia follows [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH
```

| Version Field | Increment Condition | Example |
|---------------|--------------------|---------|
| MAJOR | Incompatible API changes, major architecture adjustments | 1.x.x -> 2.0.0 |
| MINOR | Backward-compatible feature additions | 1.1.x -> 1.2.0 |
| PATCH | Backward-compatible bug fixes | 1.1.1 -> 1.1.2 |

### Special Cases

- **Pre-release versions**: `1.2.0-beta.1`, `1.2.0-rc.1`
- **Emergency fixes**: If a critical bug is found in v1.1.1, quickly release v1.1.2
- **Version tags**: GitHub Release tag format is `v1.1.1` (with `v` prefix)

### Current Version

To check the latest version, visit the [Releases page](https://github.com/YDW99/Regalia/releases).

---

## Contact Us

- **Issue Discussions**: https://github.com/YDW99/Regalia/issues
- **GitHub Profile**: https://github.com/YDW99

### Other Resources

| Document | Description |
|----------|-------------|
| [README.md](README.md) | Project overview and version history |
| [BUILDING.md](BUILDING.md) | Detailed build guide |
| [PRIVACY.md](PRIVACY.md) | Privacy policy |
| [UBIQUITOUS_LANGUAGE.md](UBIQUITOUS_LANGUAGE.md) | Domain terminology glossary |
| [NOTICE](NOTICE) | Third-party component declarations |
| [Manual/](Manual/) | Chinese and English user manuals |

---

> Thank you again for your contribution! Every line of code, every bug report, and every suggestion makes Regalia better.
>
> *-- D.W. Yang & The Regalia Team*
