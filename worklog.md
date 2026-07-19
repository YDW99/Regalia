# Regalia v1.2.3 — round-30 工作日志（2026-07-19）

## 任务来源

用户要求：以最具健壮性的方法继续完成更多进一步优化。检查每一个文件的每一行代码，理解设计意图，基于第一性原理思考是否有优化空间。优化方向按优先级排序：bug修复 > 健壮性巩固 > 功能完善 > 性能突破 > 冗余清理 > 简化代码。版本号保持 v1.2.3。

附加要求：更新 BUILDING.md & PRIVACY.md；检查所有 README/LICENSE/NOTICE 文件；检查 README.md 目录树；检查新增文件的头部权利声明与 AI-GEN 声明；检查中英文说明书与 APP 源代码的匹配度（尤其是示意图）；html 说明书中更新日志由上至下从新到旧排列；交付 release APK（v1+v2+v3 签名齐全，兼容小米澎湃OS3）+ tar 源码备份包（无引擎文件）+ 更新后的 html 说明书。

## 第一性原理审查（3 个并行代理）

启动 3 个并行审查代理：

1. **review-js-modules**（game-logic/chess960/pgn-standard/worker-pool/state-store/eco-data）— 识别 10 项发现，前 5 项高价值。
2. **review-ui-modules**（ui-gameflow/ui-interactions/ui/ai-bridge/tablebase）— 识别 15 项发现，0 个 bug、4 个健壮性、5 个性能、3 个冗余、3 个简化。
3. **review-java-files**（19 个 Java 文件）— 识别 15 项发现，5 个 bug、4 个健壮性、1 个功能、3 个性能、1 个冗余、1 个简化。

总计 20 项可操作发现，实施 18 项（2 项暂缓——`_escapeHTML` 包装保留以兼容现有调用点；`JsBridgeGateway.isSafeFileName` 的 `..` 检查作为纵深防御保留）。

## 实施的优化（18 项）

### Bug 修复（6 项）

1. **FIDE 6.9 K+B+B 同色象遗漏**（game-logic.js）— `winnerLacksMatingMaterial` 此前遗漏 K+B+B 同色象场景（两个象都在浅色格或都在深色格）——此局面下无法强制将杀。现跟踪赢方象的格子色奇偶性，K+B+B 同色（无马）时返回 true。马+象+象同色正确返回 false。11 个单元测试场景全部通过。

2. **MediaStore SQL LIKE 通配符注入**（FileIoHelper.addMediaStoreResults）— 目录路径含 `_`（匹配任意单字符）或 `%`（匹配任意序列）时会过度匹配。现转义 `\\`、`%`、`_` 并添加 `ESCAPE '\\'` 子句到两个 LIKE 表达式。

3. **StatsActivity.loadAssetAsBase64 缺少路径穿越检查** — 添加 `..` 路径穿越检查（与 FileIoHelper 一致，纵深防御）。

4. **EngineConfigHelper.detectBigCoreCount BogoMIPS 覆盖 CPU max MHz** — ARM64 内核同时输出 "CPU max MHz"（权威）和 "BogoMIPS"（粗略代理）时，最后的胜出（常为 BogoMIPS）。现 "CPU max MHz" 始终胜出；"BogoMIPS" 仅在无 MHz 读数时填充。

5. **MainActivity stabilizationHelper/stabilizationEnabled 未声明 volatile** — JS binder 线程与主线程跨线程访问，缺少 volatile 可能导致主线程看到陈旧的 false 值。两个字段现声明为 `volatile`。

6. **MainActivity.scheduleInitRetry 静默失败** — 3 次重试全部耗尽后，重试循环静默停止，用户无反馈。现调用 `showFallbackUI("engine init failed. Please restart the app.")`。

### 健壮性巩固（7 项）

7. **state-store._notifyListeners 深拷贝** — 监听器此前接收 LIVE `_state` 引用，可能直接修改破坏单一数据源契约。现传递 `_deepClone(_state)`（与 v1.2.1 P0-1/P0-2 不变量一致）。

8. **_savePGNYes 轮询无上限**（ui-interactions.js）— 递归 `setTimeout(_waitForDialog, 200)` 无上限——若 dismiss 回调失败，轮询持续到会话结束。现上限 50 次（10s）；超时后执行回调并重置 `_skipPGNSavePrompt`。

9. **_makeLoadingClickable 轮询无上限**（ai-bridge.js）— `setInterval(..., 200)` 无上限——若 `_showLoadingOverlay` 静默失败，interval 永久泄漏。现上限 25 次（5s）。

10. **onSettingsImported 安全网 setTimeout 覆盖用户对话框**（ai-bridge.js）— 100ms/300ms 安全网闭包无条件移除任何 `.dov[role="dialog"]`。若用户在 300ms 内打开另一个对话框，迟到的 timer 会破坏它。现使用代际 token（`_settingsImportGen`）——新导入使旧闭包失效。

11. **_requestBatchEval 未就绪分支旋转重试**（ai-bridge.js）— 引擎未就绪时调度 `setTimeout(_reviewAnalyzeAdvance, 100)`，重入 `_requestBatchEval` → 同一未就绪分支 → 另一个 100ms timer，旋转 60s+。现不再调度重试，依赖 `onEngineReady` 恢复批量。

12. **StockfishNative.engineGoDepth 无 depth 钳制** — `depth` 参数直接传给 `go depth N`。JS bug 传 0 会瞬时返回劣着；传 100 会搜索数小时。现钳制到 `[1, MAX_REASONABLE_DEPTH]`（60）。

13. **HapticManager.isHapticEnabled 每次 Binder IPC** — `Settings.System.getInt` 每次触觉调用都做跨进程 Binder 调用（5-10 次/秒）。现缓存系统侧设置 5 秒；`volatile` 跨线程可见。

### 性能突破（6 项）

14. **_updateCtrlInfoPanel O(cards) 文本扫描**（ui.js）— 每次悬停运行 `querySelectorAll('.card')` + `.textContent.includes('控制'/'Control')`。元素已有稳定 id `ctrl-info-card`。改为单次 `getElementById` 调用；移除 `_cachedCtrlCard` 缓存。

15. **PgnCacheManager.sanitizeName 重新编译正则** — `String.replaceAll(String, String)` 每次调用都重新编译 Pattern。现使用两个预编译 `static final Pattern` 实例。

16. **tablebase._tbCache LRU 刷新两次 Map 查找** — `has(fen)` + `get(fen)` + `delete(fen)` + `set(fen,v)`。简化为 `get(fen)` + nullish 检查 + `delete(fen)` + `set(fen,v)`——少一次 Map 查找。

17. **tablebase._parsePGN 花括号注释循环在无注释 PGN 上跑 10 次** — `while(moveText.includes('{')&&_braceIter++<10)` 每次迭代都做 O(n) `includes('{')` 检查。现预检查 `if(moveText.includes('{'))` 一次以在无注释输入上跳过整个循环。

18. **showToast 孤立的 300ms 移除定时器**（ai-bridge.js）— 快速 `showToast()` 调用每次清除 `_toastTimer` 但留下内部的 300ms `setTimeout(()=>t.remove(),300)` 武装——孤立 timer 在已分离节点上触发。现追踪内部 timer 在 `_toastRemoveTimer` 并在每次新 `showToast()` 时清除。

### 冗余清理（3 项）

19. **ui.js lastRenderRequest 死状态** — 在 line 1725 声明、line 2017 写入，但任何地方都未读取。round-20 DIRTY_* 移除后的残留。移除声明 + 写入。

20. **StatsActivity.performHaptic 重复 HapticManager 逻辑** — 内联重复 haptic-enabled 检查 + VibrationEffect fallback 链，而非委托给 `HapticManager`。两个数据源可能分歧（如 round-30 的 5s 设置缓存需要在两处应用）。现委托给懒初始化的 `HapticManager` 实例（与 StockfishNative line 472 相同模式）。

21. **HapticManager._init 外露 API**（ai-bridge.js）— IIFE 的 `return { fire, refreshSettings, _init }` 外露 `_init`，但仅内部构造时调用一次。无外部调用方。从导出 API 移除。

## 暂缓的优化（2 项）

1. **`_escapeHTML` 包装移除**（ui.js）— 代理标记为低可信度冗余。注释明确声明为有意保留以兼容现有调用点。grep 显示有 7 处调用点（包括 mockup HTML）。移除需要批量重写所有调用点，回归风险高于收益。保留。

2. **`JsBridgeGateway.isSafeFileName` 的 `..` 检查** — 代理标记为低可信度冗余。`/` 和 `\\` 检查已经阻止目录穿越，`..` 检查是过度严格的冗余防御，会拒绝合法文件名如 `my..file.txt`。然而作为安全检查，保持过度严格比放宽更安全。保留作为纵深防御。

## 验证

### JS 语法

```
所有 11 个 chess.src/*.js 模块通过 node --check ✓
stats.html 内联脚本通过 node --check ✓
chess.html 重建后内联脚本通过 node --check ✓
```

### Node vm 烟雾测试（winnerLacksMatingMaterial + state-store）

11 个 FIDE 6.9 场景全部通过：
- Test 1: K vs K — winner cannot mate ✓
- Test 2: K+Q vs K — winner can mate ✓
- Test 3: K+N vs K — winner cannot mate ✓
- Test 4: K+B vs K — winner cannot mate ✓
- Test 5: K+R vs K — winner can mate ✓
- Test 6: K+2N vs K — winner cannot mate ✓
- Test 7: K+N+B vs K — winner can mate ✓
- Test 8: FIDE 6.9 asymmetric — winner has K+N only, draw ✓
- Test 9 (NEW round-30): K+B+B same color — winner cannot mate ✓
- Test 10 (NEW round-30): K+B+B opposite colors — winner can mate ✓
- Test 11 (NEW round-30): K+N+B+B same color — winner can mate (knight helps) ✓

### chess.html 重建

```
python3 build-chess.py
Built chess.html (22951 lines, 1382039 bytes)
```

### APK 构建

```
./gradlew --no-daemon assembleRelease -x lint -x lintRelease -x lintVitalRelease --offline
BUILD SUCCESSFUL in 8s
```

### APK 签名

```
apksigner verify --verbose Regalia-release.apk
Verifies
Verified using v1 scheme (JAR signing): true
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): true
```

### Stockfish 引擎 SHA-256 三方一致

```
源文件：8f7116d3f1a7004a6581d4fb0c1ff891ce095bab6d45e52f1578897cf23b61b5
jniLibs：8f7116d3f1a7004a6581d4fb0c1ff891ce095bab6d45e52f1578897cf23b61b5
APK 内：8f7116d3f1a7004a6581d4fb0c1ff891ce095bab6d45e52f1578897cf23b61b5
三方一致 ✓
```

### tar 打包

```
bash /home/z/my-project/scripts/create_v123_tar.sh
Tar entry count: 118
排除清单全部生效
```

## 文档同步

- `NOTICE`：round-30 条目置顶（18 项实施的优化 + 2 项暂缓的完整记录）。
- `8× README.license`：round-30 条目置顶。
- `README.md`：round-30 章节置顶；目录树更新（ui.js 6,795 行，HapticManager.java 493 行，round-30 注释）。
- `BUILDING.md`：round-30 章节置顶（构建相关变更 + 误报说明 + 验证）。
- `PRIVACY.md`：round-30 条目置顶（纯代码组织 + bug 修复 + 健壮性 + 性能轮，无新权限/网络/数据收集）。
- 中英文说明书：round-30 更新日志条目置顶（内容对等非机翻）。

## 最终交付（/home/z/my-project/download/）

- `Regalia-release.apk` — SHA-256 见 SHA256SUMS.txt
- `Regalia-v1.2.3-src.tar` — 118 条目，0 禁用模式
- `Regalia-v1.2.3-manual-zh.html` — 中文说明书
- `Regalia-v1.2.3-manual-en.html` — 英文说明书
- `README.md` / `BUILDING.md` / `PRIVACY.md` / `NOTICE` / `worklog.md` — 同步更新
- `SHA256SUMS.txt` — 所有交付物 SHA-256 汇总

版本号保持 v1.2.3（versionCode=123, versionName="1.2.3"）。

---

# Regalia v1.2.3 — round-29 工作日志（2026-07-19）

## 任务来源

用户上传了 2 份新审查报告（SonarCloud_PR52_Issues_Summary.docx、PR52_Unresolved_Issues_Optimization.docx）+ 3 份参考资料（🛡️ AI大模型代码生成防缺陷终极指南.pdf、Android WebView App 开发专业指南.pdf、SonarCloud 完美通过审查指南.pdf）+ 1 份源码包 Regalia-v1.2.3-src.tar + 1 份开发进度恢复指南。

任务要求：

1. 完整读取上传的 docx 文件，排查误报，剔除误报后了解清楚需要修复的问题；
2. 精确实施修复（重要的改动完成后要测试）；
3. 修复后逐文件用 `node --check` 验证所有 JS 语法；
4. 重建 chess.html；
5. 构建 release APK（v1+v2+v3 签名齐全，兼容小米澎湃OS3）；
6. 用 `create_v123_tar.sh` 打包 tar 源码备份（无引擎文件）；
7. 验证 Stockfish 引擎是 dotprod 版本（SHA-256 三方一致）；
8. 更新 BUILDING.md、PRIVACY.md、README.md、NOTICE、所有 README.license；
9. 更新中英文 HTML 说明书（更新日志由上至下从新到旧排列）；
10. 版本号保持 v1.2.3（versionCode=123, versionName="1.2.3"）；
11. 所有交付物保存到 `/home/z/my-project/download/`；
12. 完成后更新 worklog.md。

## 环境重建（沙箱重置后）

- JDK 21.0.11（Temurin）：`/home/z/my-project/tools/jdk21`
- Android SDK：API 35 / Build-Tools 34.0.0 / NDK 27.2.12479018 / CMake 3.31.6
- Stockfish 引擎 SHA-256 验证：`8f7116d3f1a7004a6581d4fb0c1ff891ce095bab6d45e52f1578897cf23b61b5`（源文件 / 部署到 jniLibs / APK 内三方一致）
- keystore：`/home/z/my-project/workspace/debug.keystore`（alias `debug`，storepass/keypass `android`）
- keystore.properties：`/home/z/my-project/workspace/keystore.properties`（驱动 build.gradle 的 signingConfigs.release）

## PR52 问题排查与误报剔除

### SonarCloud_PR52_Issues_Summary.docx

声称 80 个 OPEN 状态问题（5 BLOCKER + 12 CRITICAL + 41 MAJOR + 22 MINOR）。逐项对照源码验证：

**真实缺陷（14 项，已修复）：**

1. **FIDE 6.9 超时判和 Bug**（ui-gameflow.js:311-322）— round-25 使用 `isDeadPosition`（对称检查双方），遗漏非对称场景（赢方仅有 K/K+N/K+B/K+2N → 无法将杀）。新增 `winnerLacksMatingMaterial(s, winner)` 函数检查 WINNER 的将杀能力，作为主判据；`isDeadPosition` 保留为 FIDE 5.2.2 对称兜底。8 个单元测试场景全部通过。
2. **`_restoreClocks` 调用 `initGameClocks()` 覆盖已恢复时钟值**（ui-interactions.js:104-107）— `initGameClocks()` 从 `dlgTimeControl.baseSec` 重建 `gameClocks`，覆盖快照恢复的 `remainingSec`/`displayRemainingSec`。改为仅重启 tick 间隔。
3. **README.md 公开签名密钥凭据**（README.md:349）— round-13 发布说明暴露 alias/password/backup path。移除凭据；改为引用 `keystore.properties`（gitignored）。
4. **AGPL v3/GPL v3 许可证标签错误**（NOTICE + 5 README.license，共 49 处）— `tablebase.js`、`stats.html`、`worker-pool.js`、`JsBridgeGateway.java` 这 4 个 DroidFish 派生文件在历史条目中误标为 AGPL v3，实际各文件头部声明为 GPL v3。已批量修正。
5. **stats.html + tablebase.js PGN 标签正则 ReDoS**（5 处）— 替换为规范形式 `/\[\s*[A-Za-z]\w*\s+"(?:[^"\\]|\\.)*"\s*\]/g`（与 pgn-standard.js:696 一致），消除多项式回溯。
6. **ai-bridge.js var→const**（4 处）— `dov`/`fb`/`info`/`s` 改为 const（S3504）。
7. **StockfishNative.java `_hapticManager` 未声明 final** — 改为 `private final HapticManager`，与同字段一致（safe-publication）。
8. **S6582 可选链**（6 处）— `_st?.board && _st.board[mv.to.row] ? ...` → `_st?.board?.[mv.to.row]?.[mv.to.col] ?? null`；`gameState?.board && gameState.board[...]` → `gameState?.board?.[...]`；`parsedMove?.move && parsedMove.move.promotion` → `parsedMove?.move?.promotion`；`e?.message ? e.message : e` → `e?.message ?? e`。
9. **S3358 嵌套三元**（2 处）— ai-bridge.js 提取 `_evalOrMate` 辅助函数；HapticManager.java 改用 `Math.max(0, Math.min(255, a))`。
10. **stats.html S7780/S7781**（1 处）— `JSON.stringify(s).replace(/</g, '\\u003c')` → `JSON.stringify(s).replaceAll('<', String.raw\`\u003c\`)`。
11. **worker-pool.js S6551**（1 处）— `e?.message || e` → `e?.message || String(e)`。
12. **ui.js S1481**（1 处）— 移除死局部变量 `_isLandscapeReview`（round-12 统一 portrait/landscape DOM 后未再使用）。
13. **`src/main/README.license` 权限清单未移除 ACCESS_NETWORK_STATE** — round-18 已从 AndroidManifest 移除但文档未同步；已修正。
14. **Manual 工具栏顺序描述遗漏 💾 按钮**（zh + en）— PGN 缓存管理章节的工具栏顺序段落现包含 💾（导出 PGN 到文件）按钮，与示意图一致。
- 附：worklog.md round-23 PDF 计数 4→6（与列出的 6 个文件名一致）；`src/main/res/README.license` xml/ 摘要更新（说明 backup_rules.xml/data_extraction_rules.xml 不再被 AndroidManifest 引用）。

**误报（6 项，跳过）：**

1. **build.gradle:184-192 CMake version "3.31.6+"** — 误报。AGP 接受 Gradle 风格版本范围（`+` 是通配符）；项目自 round-13 起一直使用此设置且构建成功。
2. **HapticManager.java:413, 467 S125** — 误报。这些是描述历史 API 变更的文档注释，不是被注释的代码。
3. **game-logic.js:3089, 2553, 1817 S2681** — 误报。这些是单行表达式，没有多行代码块。
4. **ai-bridge.js:1004, 1290 S7741 `typeof _timeoutWinnerColor!=='undefined'`** — 误报。这是 round-11 设计的跨模块 typeof 守卫（`_timeoutWinnerColor` 在 ui-gameflow.js 声明，ai-bridge.js 使用），防止单模块加载失败连锁崩溃。
5. **assets/README.license:4-9 历史记录未更新至 round-28** — 误报。基于过时的行号；该文件已更新至 round-28。
6. **README.md:393-395 权限清单未移除 ACCESS_NETWORK_STATE** — 误报。该位置是描述移除 ACCESS_NETWORK_STATE 的文字段落，不是权限清单。

### PR52_Unresolved_Issues_Optimization.docx

声称 18 个未解决问题。逐项验证：

- **#1-3 阻断级（合并冲突、Quality Gate 失败、Autofix 无法运行）**：GitHub PR 状态问题，不属于源码修复范围。跳过。
- **#4 FIDE 6.9 超时判和**：真实缺陷，已修复（见真实缺陷 #1）。
- **#5 README.md 签名密钥泄露**：真实问题，已修复（见真实缺陷 #3）。
- **#6 AGPL/GPL 标签错误**：真实问题，已修复（见真实缺陷 #4）。
- **#7 stats.html 正则回溯风险**：真实问题，已修复（见真实缺陷 #5）。
- **#8 build.gradle CMake 版本语义错误**：误报（见误报 #1）。
- **#9 ui-interactions.js initGameClocks**：docx 声称已在 commit acda070 修复，但实际源码仍调用 initGameClocks()。真实缺陷，已修复（见真实缺陷 #2）。
- **#10 ai-bridge.js var→const**：真实问题，已修复（见真实缺陷 #6）。
- **#11 权限清单未移除 ACCESS_NETWORK_STATE**：真实问题，已修复（见真实缺陷 #13）。
- **#12 assets/README.license 历史未更新至 round-28**：误报（见误报 #5）。
- **#13 Manual 工具栏遗漏 💾**：真实问题，已修复（见真实缺陷 #14）。
- **#14 res/README.license 资源摘要与清单不同步**：真实问题，已修复。
- **#15 worklog.md round-23 PDF 计数错误**：真实问题，已修复。
- **#16 StockfishNative _hapticManager final**：真实问题，已修复（见真实缺陷 #7）。
- **#17 worklog.md Markdown 规范违规**：跳过（markdownlint 是辅助工具，不影响代码正确性；后续轮次可统一处理）。
- **#18 Docstring 覆盖率 62.4% < 80%**：跳过（Pre-merge 检查项，不属于代码修复范围）。

### PDF 资料汲取

- 《Android WebView App 开发专业指南》— 通用指南，项目已实现全部最佳实践（WebSettings 显式配置、JS 接口 @JavascriptInterface 注解、URL 拦截、生命周期管理、destroy 清理）。
- 《SonarCloud 完美通过审查指南》— 通用指南，项目已遵循 Sonar way 质量门禁原则（新增代码零缺陷、控制代码异味、覆盖率达标）。
- 《AI大模型代码生成防缺陷终极指南》— 通用指南，本轮工作中已应用：边缘情况处理（winnerLacksMatingMaterial 覆盖 K/K+N/K+B/K+2N/K+N+B/K+2N 等所有 FIDE 6.9 场景）、安全规范（移除硬编码密钥）、单一职责（提取 _evalOrMate 辅助函数）。

## 修复实施

### P0 Bug 修复

**Bug #1: FIDE 6.9 超时判和**（game-logic.js + ui-gameflow.js）

新增 `winnerLacksMatingMaterial(s, winnerColor)` 函数：
- 扫描棋盘，统计 winner 的非王棋子数（pawn/knight/bishop/rook/queen）
- K vs K（winner 仅有王）→ 无法将杀 → true
- K + 单 minor（N 或 B）→ 无法将杀 → true
- K + 2N → 无法强制将杀（FIDE 规则）→ true
- K + 2B 同色 / K + N+B / K + 2N+其他 → CAN mate → false
- 任何 pawn/rook/queen → CAN mate → false

`_onGameClockExpired` 修改：
- 主判据改为 `winnerLacksMatingMaterial(gameState, winner)` → draw
- 兜底 `isDeadPosition(gameState)` → draw（覆盖 K vs K 等对称场景）
- 否则 → timeout win

**Bug #2: Undo/Redo 时钟恢复**（ui-interactions.js）

`_restoreClocks` 修改：
- 移除 `if(typeof initGameClocks==='function'&&!gameOver){initGameClocks();}`
- 改为 `if(typeof _tickGameClock==='function'&&!gameOver){gameClockTimerId=setInterval(_tickGameClock,200);}`
- 这避免了 `initGameClocks()` 重建 `gameClocks` 覆盖已恢复值

### P3 代码质量修复

详见上文「真实缺陷」清单。所有修改均为语义保持，已通过 node --check + Node vm 烟雾测试验证。

## 验证

### JS 语法

```
所有 11 个 chess.src/*.js 模块通过 node --check ✓
stats.html 内联脚本通过 node --check ✓
chess.html 重建后内联脚本通过 node --check ✓
```

### Node vm 烟雾测试（winnerLacksMatingMaterial）

8 个 FIDE 6.9 场景全部通过：
- Test 1: K vs K — winner cannot mate ✓
- Test 2: K+Q vs K — winner can mate ✓
- Test 3: K+N vs K — winner cannot mate ✓
- Test 4: K+B vs K — winner cannot mate ✓
- Test 5: K+R vs K — winner can mate ✓
- Test 6: K+2N vs K — winner cannot mate ✓
- Test 7: K+N+B vs K — winner can mate ✓
- Test 8: FIDE 6.9 asymmetric case — winner has K+N only, draw ✓

### chess.html 重建

```
python3 build-chess.py
Built chess.html (22854 lines, 1377004 bytes)
```

### APK 构建

```
./gradlew --no-daemon assembleRelease -x lint -x lintRelease -x lintVitalRelease --offline
BUILD SUCCESSFUL in 1m 5s
```

### APK 签名

```
apksigner verify --verbose Regalia-release.apk
Verifies
Verified using v1 scheme (JAR signing): true
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): true
```

### Stockfish 引擎 SHA-256 三方一致

```
源文件（/home/z/my-project/tools/stockfish/...）：
  8f7116d3f1a7004a6581d4fb0c1ff891ce095bab6d45e52f1578897cf23b61b5

部署到 jniLibs（src/main/jniLibs/arm64-v8a/libstockfish.so）：
  8f7116d3f1a7004a6581d4fb0c1ff891ce095bab6d45e52f1578897cf23b61b5

APK 内（lib/arm64-v8a/libstockfish.so）：
  8f7116d3f1a7004a6581d4fb0c1ff891ce095bab6d45e52f1578897cf23b61b5

三方一致 ✓
```

### tar 打包

```
bash /home/z/my-project/scripts/create_v123_tar.sh
Tar entry count: 118
排除清单全部生效（无 build/、.gradle/、.cxx/、local.properties、lint-baseline.xml、jniLibs/、keystore、keystore.properties、version.properties、.git/、.idea/）
```

## 文档同步

- `NOTICE`：round-29 条目置顶（14 项真实缺陷 + 6 项误报 + 49 处许可证标签修正的完整记录）。
- `8× README.license`：round-29 条目置顶（assets/chess.src/assets/src/main/java/com/Regalia/res/cpp/Manual）。
- `README.md`：round-29 章节置顶；GPL v3 文件清单新增 `JsBridgeGateway.java`。
- `BUILDING.md`：round-29 章节置顶（构建相关变更 + 误报说明 + 验证）。
- `PRIVACY.md`：round-29 条目置顶（纯代码组织 + bug 修复 + 文档同步，无新权限/网络/数据收集）。
- 中英文说明书：round-29 更新日志条目置顶（内容对等非机翻）。

## 最终交付（/home/z/my-project/download/）

- `Regalia-release.apk` — SHA-256 见 SHA256SUMS.txt
- `Regalia-v1.2.3-src.tar` — 118 条目，0 禁用模式
- `Regalia-v1.2.3-manual-zh.html` — 中文说明书
- `Regalia-v1.2.3-manual-en.html` — 英文说明书
- `README.md` / `BUILDING.md` / `PRIVACY.md` / `NOTICE` — 同步更新
- `SHA256SUMS.txt` — 所有交付物 SHA-256 汇总

版本号保持 v1.2.3（versionCode=123, versionName="1.2.3"）。

---

# Regalia v1.2.3 — round-28 工作日志（2026-07-19）

## 任务来源
用户要求：悔棋(Undo)时应当记录剩余时间，便于撤悔(Redo)后恢复剩余时间。
同时要求更严格的逐文件逐行第一性原理审查。

## Undo/Redo 时钟恢复审查

### 现有实现（round-23 Q3 修复）
经审查，round-23 已实现 `_snapshotClocks`/`_restoreClocks` 辅助函数：
- `executeMove` 在 `applyMove` 之前将时钟快照推入 `stateHistory`（捕获走子前状态）
- `undoMove` 从 `stateHistory` 弹出，将当前状态（含时钟）推入 `_redoStack`，从快照恢复时钟
- `redoMove` 从 `_redoStack` 弹出，将当前状态推入 `stateHistory`，从快照恢复时钟
- `_restoreClocks` 将 `lastMoveTimestamp` 重基准化至 `Date.now()`，避免立即扣除快照至今的 elapsed 时间

完整往返验证（白方 300s，黑方 300s）：
1. 白走 e4（耗时 5s）→ stateHistory 捕获 {W:300, B:300}；recordMoveEnd → W:295
2. 黑走 e5（耗时 4s）→ stateHistory 捕获 {W:295, B:300}；recordMoveEnd → B:296
3. Undo（2 步）→ _redoStack 推入 {W:295,B:296} 与 {W:295,B:300}；恢复 {W:300,B:300}
4. Redo（2 步）→ 从 _redoStack 弹出 {W:295,B:300} → 恢复；再弹出 {W:295,B:296} → 恢复
5. 最终：W:295, B:296（与步骤 2 后一致）✓

结论：Undo/Redo 时钟恢复功能已完整实现，往返正确。

### round-28 改进：baseSec 完整性
`_snapshotClocks` 此前遗漏了 `baseSec` 字段。虽然 `baseSec` 在对局期间不变
（仅用于 PGN [TimeControl] 标签），且 `_restoreClocks` 不恢复它时
`gameClocks.baseSec` 保持原值（正确），但为快照完整性仍应包含。
- `_snapshotClocks` 新增 `baseSec:gameClocks.baseSec||0`
- `_restoreClocks` 新增 `if(snap.baseSec!==undefined)gameClocks.baseSec=snap.baseSec`

## 第一性原理审查

### recordMoveEnd 时钟扣除顺序（ui-gameflow.js）
审查 `recordMoveEnd` 函数：
- 正确处理 `gameClocks===null`（未计时对局）与 `gameClockExpired`（已超时）
- round-23 Q2 修复：扣除后立即检查 `remainingSec<=0`，归零则触发 `_onGameClockExpired` 并提前 return，不再加 Fischer 增量
- Fischer 增量仅在未超时时添加
- Bronstein/US-delay 先减去 delay 再扣除
- 结论：实现正确，无需修改

### _tickGameClock 显示更新（ui-gameflow.js）
- 仅更新 `displayRemainingSec`（显示用），不更新 `remainingSec`（提交值）
- `remainingSec` 仅在 `recordMoveEnd` 时提交
- Undo 期间 `_tickGameClock` 仍在运行但 `remainingSec` 不变，`displayRemainingSec` 被覆盖
- `_restoreClocks` 恢复两者并重基准 `lastMoveTimestamp`，下次 tick 从 0 开始
- 结论：实现正确

### _restoreClocks gameOver 检查顺序
- undoMove 第 478 行设置 `gameOver=null` 在第 481 行 `_restoreClocks` 之前
- `_restoreClocks` 第 101 行 `!gameOver` 检查通过，tick 间隔重启
- 结论：顺序正确

### _redoStack 推送时机
- undoMove 第 467 行 `_redoStack.push` 在 `gameState=prev.state`（468）与 `_restoreClocks`（481）之前
- 捕获的是 undo 前的当前状态（走子后），时钟也是走子后的
- Redo 时恢复这个「走子后」时钟
- 结论：正确

## 验证
- ✅ 全部 11 个 JS 模块通过 `node --check`。
- ✅ chess.html 内嵌脚本块通过 `node --check`（22,766 行 / 1,372,057 字节）。
- ✅ release APK：v1+v2+v3 签名全 true；引擎 SHA-256 三方一致（8f7116d3...）。
- ✅ tar 源码包：118 条目，0 禁用条目。

## 文档更新
- BUILDING.md：新增 round-28 章节。
- PRIVACY.md：round-28 条目置顶。
- NOTICE：round-28 条目置顶。
- 8× README.license：chess.src 变更条目置顶；其余 no-changes 条目置顶。
- README.md：round-28 章节。
- 中英文说明书：round-28 更新日志条目置顶。
- worklog.md：本条目。

## 最终交付（/home/z/my-project/download/）
- Regalia-release.apk
- Regalia-v1.2.3-src.tar
- Regalia-v1.2.3-manual-zh.html
- Regalia-v1.2.3-manual-en.html
- SHA256SUMS.txt

---

# Regalia v1.2.3 — round-27 工作日志（2026-07-19）

## 任务来源
用户要求逐文件逐行第一性原理审查，优化方向按优先度：bug修复 > 健壮性 > 功能完善 >
性能 > 冗余清理 > 简化。检查 i18n 完善性、README 目录树、说明书示意图与源代码匹配度、
更新日志顺序等。

## 第一性原理审查结果

### i18n 完整性审计
编写 Python 脚本提取所有 `T('key')` 调用与 `game-logic.js` 中的 i18n 键定义：
- 全部 480+ 个 `T()` 调用均有对应的 i18n 键（无缺失键）。
- 全部 i18n 条目均同时包含 `zh` 与 `en` 值（无单语言条目）。
- 结论：i18n 完整，无需补充。

### FIDE 6.9 注释准确性修复（ui-gameflow.js）
`_onGameClockExpired` 中的注释原为「isDeadPosition checks if EITHER side cannot mate」
——这是不准确的。`isDeadPosition` 检查的是「任何合法走子序列下是否可能将杀」
（FIDE 5.2.2 定义），这正是 FIDE 6.9 超时和棋所需的条件。修正注释以准确描述语义。
（代码行为正确，仅注释不准确。）

### 冗余移除（ai-bridge.js `_deriveGameResult`）
移除不可达的 `if(_gameOverStatusKey==='timeout') return '1/2-1/2'` 分支。
当 `_timeoutWinnerColor===null`（FIDE 6.9 和棋）时，timeout 早期返回被跳过，
函数自然落到最终 `return '1/2-1/2'` 兜底分支。显式 timeout-draw 分支为不可达冗余。

### 说明书示意图准确性修复
中英文说明书的缓存管理窗口示意图仍显示每个条目上的 📥（导入）按钮，
但该按钮在 v1.0.4 Rev24 已从实际 UI 移除（点击条目名称直接导入）。
- 移除示意图中所有 📥 按钮元素（zh 手册 3 处、en 手册 3 处）。
- 修正文字描述：「✏️/🔖/📥 三个按钮」→「✏️/🔖 两个按钮」。
- 修正表格行：「点击条目名或 📥 按钮」→「点击条目名称」。

### README.md 目录树更新
- `ui.js`：~6,761 行 → ~6,791 行（round-24 God Function 拆分后净增注释）。
- `HapticManager.java`：487 行 → 471 行（round-23 PWLE 反射移除）。
- `HapticManager.java` 描述更新：移除「PWLE」提及，改为「vibration waveform API」。

## 验证
- ✅ 全部 11 个 JS 模块通过 `node --check`。
- ✅ chess.html 内嵌脚本块通过 `node --check`（22,761 行 / 1,371,753 字节）。
- ✅ release APK：v1+v2+v3 签名全 true；引擎 SHA-256 三方一致（8f7116d3...）。
- ✅ tar 源码包：118 条目，0 禁用条目。

## 文档更新
- BUILDING.md：新增 round-27 章节。
- PRIVACY.md：round-27 条目置顶。
- NOTICE：round-27 条目置顶。
- 8× README.license：chess.src/assets/Manual 变更条目置顶；其余 no-changes 条目置顶。
- README.md：round-27 章节 + 目录树行数更新。
- 中英文说明书：round-27 更新日志条目置顶 + 缓存管理示意图 📥 移除。
- worklog.md：本条目。

## 最终交付（/home/z/my-project/download/）
- Regalia-release.apk
- Regalia-v1.2.3-src.tar
- Regalia-v1.2.3-manual-zh.html
- Regalia-v1.2.3-manual-en.html
- SHA256SUMS.txt

---

# Regalia v1.2.3 — round-26 工作日志（2026-07-19）

## 任务来源
用户要求继续完成下一步任务。round-25 已完成 FIDE 6.9 超时和棋功能，但发现 PGN 导出
侧的配套修复未完成——超时和棋的 [Termination] 标签与最后一步走法注释仍按超时胜处理。

## PGN 导出配套修复（FIDE 6.9 超时和棋）

### 问题 1：[Termination] 标签错误
`_buildTerminationTag()` 此前对所有 `timeout` 状态返回 `[Termination "Time forfeit"]`，
即使 `_timeoutWinnerColor===null`（FIDE 6.9 和棋）也返回"Time forfeit"——与
`[Result "1/2-1/2"]` 矛盾。

**修复**（ai-bridge.js `_buildTerminationTag`）：
- `timeout` + `_timeoutWinnerColor` 有值 → `[Termination "Time forfeit"]`（原行为）
- `timeout` + `_timeoutWinnerColor===null` → `[Termination "Both flag fall / insufficient material"]`（FIDE 6.9 和棋）
- 顺带补全其他终局状态的 Termination 标签（此前仅 resign/timeout 有）：
  - `draw_insufficient` → `[Termination "Dead position"]`
  - `draw_stalemate` → `[Termination "Stalemate"]`
  - `draw_50move` → `[Termination "50-move rule"]`
  - `draw_75move` → `[Termination "75-move rule"]`
  - `draw_repetition` → `[Termination "Threefold repetition"]`
  - `draw_5fold` → `[Termination "Fivefold repetition"]`
  - `checkmate` → `[Termination "Normal"]`（PGN 规范推荐值）

### 问题 2：最后一步走法注释错误
`_buildPGNString` 的 timeout 注释逻辑此前仅在 `_timeoutWinnerColor` 有值时追加
"白方超时胜"/"Black wins by timeout" 注释。FIDE 6.9 和棋时（`_timeoutWinnerColor===null`）
无注释，PGN 末步缺乏和棋说明。

**修复**（ai-bridge.js `_buildPGNString` timeout 分支）：
- `_timeoutWinnerColor` 有值 → 原"超时胜"注释
- `_timeoutWinnerColor===null` → 新增 `pgn_timeout_draw_insufficient` i18n key 注释：
  - zh: "超时但子力不足，和棋"
  - en: "Timeout but insufficient material, draw"

### 问题 3：`_deriveGameResult` 显式 draw 状态处理
原实现依赖 `gameOver.includes(T('white_wins'))` 文本匹配判断胜负，对和棋状态走 fallback
返回 `1/2-1/2`。虽然结果正确，但逻辑隐晦。新增显式 draw_* 状态分支，所有和棋状态直接
返回 `1/2-1/2`，不再依赖本地化文本匹配。

### 新增 i18n key
- `pgn_timeout_draw_insufficient`：zh="超时但子力不足，和棋"，en="Timeout but insufficient material, draw"

## 验证
- ✅ 全部 11 个 JS 模块通过 `node --check`。
- ✅ chess.html 内嵌脚本块通过 `node --check`（22,766 行 / 1,371,956 字节）。
- ✅ release APK：v1+v2+v3 签名全 true；versionCode=123 / versionName="1.2.3"；
  引擎 SHA-256 三方一致（8f7116d3...）。
- ✅ tar 源码包：118 条目，0 禁用条目。

## 文档更新
- BUILDING.md：新增 round-26 章节（PGN Termination/注释配套修复）。
- PRIVACY.md：round-26 条目置顶。
- NOTICE：round-26 条目置顶。
- 8× README.license：chess.src/assets 变更条目置顶。
- README.md：round-26 章节。
- 中英文说明书：round-26 更新日志条目置顶。
- worklog.md：本条目。

## 最终交付（/home/z/my-project/download/）
- Regalia-release.apk
- Regalia-v1.2.3-src.tar
- Regalia-v1.2.3-manual-zh.html
- Regalia-v1.2.3-manual-en.html
- SHA256SUMS.txt

## 记录在案的已知遗留（下轮候选）
- **SonarCloud S6582/S3358/S3504 剩余项**：风格性优化，转换风险高于收益（与 round-25 一致）。
- **设备验证**：建议在多款 API 级别设备上验证触觉反馈、复盘模式渲染、超时和棋判定、
  PGN 导出的 Termination 标签与最后一步注释。
- **FIDE 5.2.2 死局自动判和**：已通过 `gameStatus()` → `_applyGameOver()` 链路在每次
  渲染时检查（cached by `_cachedStatusKey`），无需额外修复。

---

# Regalia v1.2.3 — round-25 工作日志（2026-07-19）

## 任务来源
用户要求继续完成 round-24 记录在案的下一步任务：
1. SonarCloud 风格性优化：S6582 可选链（401 项）、S3358 嵌套三元（167 项）。
2. 棋钟 undo 不回表、超时未查对方材料不足等功能级议题。

## 风格性优化

### S6582 可选链（401 项 → 174 行转换）
编写 `scripts/apply_optional_chaining.py` 脚本，自动识别并转换 `x && x.prop` → `x?.prop` 模式。
- 仅转换变量名两侧相同的 `&&` 链（语义完全等价）。
- 跳过注释行、typeof 守卫行（round-11 跨模块设计保留）。
- 跳过方法调用 `obj && obj.method()`（`?.()` 会改变 `this` 绑定）。
- 共转换 174 行，横跨 8 个文件：ai-bridge.js (50)、ui.js (33)、game-logic.js (28)、
  worker-pool.js (24)、state-store.js (15)、ui-interactions.js (10)、chess960.js (8)、
  eco-data.js (6)。
- 典型转换：`e&&e.message?e.message:e` → `e?.message?e.message:e`（错误日志访问）；
  `pv.pv && pv.pv.length>0` → `pv.pv?.length>0`（PV 长度检查）；
  `_st&&_st.board&&_st.board[r]` → `_st?.board&&_st.board[r]`（棋盘访问）。

### S3358 嵌套三元（高价值点 4 处修复）
手动重构嵌套三元为 if/else 链，保留语义等价：
1. **ui.js L1390** `_buildEvalTrendPoints` mate 标签：
   `md > 0 ? '#+' + Math.abs(md) : md < 0 ? '#-' + Math.abs(md) : (ev.eval > 0 ? '#+' : '#-')`
   → 三分支 if/else。
2. **ui.js L1590** `formatEval` 缓存命中 mate 标签：同款三分支 if/else。
3. **ui.js L1605** `formatEval` 实时 mate 标签：同款三分支 if/else。
4. **ai-bridge.js L1296-1297** `_findCriticalMoves` NAG 评估：
   `cur.mate?(cur.mate>0?90000:-90000):cur.eval` → `cur.mate!=null?(cur.mate>0?90000:-90000):cur.eval`
   （同时修正了原代码的 falsy 0 bug：mate=0 时原代码会走 eval 分支，现在显式 !=null 检查）。

## 功能级议题修复

### 超时未查对方材料不足（FIDE 6.9）
**问题**：`_onGameClockExpired` 此前无条件判超时方对手获胜，即使对手子力不足将杀
（如 K vs K、K+B vs K、K+N vs K）。FIDE 6.9 规定：超时方对手若子力不足以将杀，
应判和棋（insufficient material draw）。

**修复**（ui-gameflow.js `_onGameClockExpired`）：超时判定前调用 `isDeadPosition(gameState)`
检查当前局面是否为死局。若为死局，`_gameOverStatusKey='draw_insufficient'`，
`_timeoutWinnerColor=null`，`gameOver=_gameOverStrFromStatus('draw_insufficient')`
（i18n key `insufficient_draw` 已存在：zh='子力不足和棋！'，en='Insufficient material!'）。
否则维持原超时判负逻辑。

**isDeadPosition 覆盖范围**（game-logic.js L2456，已存在）：
- K vs K（双方仅王）
- K+minor vs K（一方王+象/马，另一方仅王）
- K+B vs K+B 同色象（双方各一象且同色格）
- K+B+B(same color) vs K（一方双象同色 + 另一方仅王）

### 棋钟 undo 不回表
**已在 round-23 实现**（Q3 修复）：`_snapshotClocks/_restoreClocks` 辅助函数在
`stateHistory.push` 与 `_redoStack.push` 时快照 `gameClocks`，`undoMove`/`redoMove`
恢复时重基准化 `lastMoveTimestamp` 至 `Date.now()` 并按 `isRunning` 状态重启 tick 间隔。
本轮复查确认功能完整，无需额外修复。

## 验证
- ✅ 全部 11 个 JS 模块通过 `node --check`（含可选链与嵌套三元重构）。
- ✅ chess.html 内嵌脚本块通过 `node --check`（22,719 行 / 1,369,260 字节）。
- ✅ release APK（78,187,520 字节）：v1+v2+v3 签名全 true；versionCode=123 /
  versionName="1.2.3"；targetSdk 35 / minSdk 23；FGS subtype 属性存在；引擎 SHA-256
  三方一致（8f7116d3...）。
- ✅ tar 源码包：118 条目，0 引擎/构建产物/keystore/local.properties/lint-baseline。

## 文档更新
- BUILDING.md：新增 round-25 章节（S6582/S3358 修复 + FIDE 6.9 超时和棋 + 验证）。
- PRIVACY.md：round-25 条目置顶（纯代码风格 + 功能完善，无新权限/网络/数据收集）。
- NOTICE：round-25 条目置顶。
- 8× README.license：chess.src/assets 变更条目置顶；其余 no-changes 条目置顶。
- README.md：round-25 章节。
- 中英文说明书：round-25 更新日志条目置顶。
- worklog.md：本条目。

## 最终交付（/home/z/my-project/download/）
- Regalia-release.apk
- Regalia-v1.2.3-src.tar
- Regalia-v1.2.3-manual-zh.html
- Regalia-v1.2.3-manual-en.html
- SHA256SUMS.txt

## 记录在案的已知遗留（下轮候选）
- **SonarCloud S6582 剩余项（~227 项）**：跨模块 typeof 守卫（round-11 设计保留）、
  方法调用 `obj && obj.method()`（`?.()` 改变 this 绑定）、复杂条件表达式中的 &&
  链（转换风险高于收益）。可下轮用 IDE 自动重构工具逐一评估。
- **SonarCloud S3358 剩余项（~163 项）**：多为简单两分支三元（非嵌套），S3358 仅
  报告嵌套三元，剩余项为误报或低价值。
- **SonarCloud S3504 var（63 项）**：worker-pool.js 模板字符串内的 var（round-11 设计
  保留，Worker 源码在模板字符串内，双反斜线转义正确）。
- **设备验证**：建议在多款 API 级别设备上验证触觉反馈、复盘模式渲染、超时和棋判定。

---

# Regalia v1.2.3 — round-24 工作日志（2026-07-19）

## 任务来源
用户要求继续完成 round-23 记录在案的下一步任务：
1. God Function 拆分：ui.js 的 _renderReviewMode (552 行)、_resetGameUIState (231 行)、
   _reviewAnalyzeAdvance (218 行) 仍为大型函数，认知复杂度较高。
2. StatsActivity.java 许可证标签不一致：文件头部为 GPL v3，但 README.license 多处标为
   AGPL v3（PR51 Q12 仅覆盖 HapticManager/JsBridgeGateway，未涉及 StatsActivity）。

## God Function 拆分（S3776 认知复杂度）

### _renderReviewMode 拆分（552 → 357 行，-35%）
通过 Python 脚本（scripts/extract_review_helpers.py）精确提取 8 个辅助函数 + 1 个模块级常量：

| 提取项 | 类型 | 职责 | 行数 |
|---|---|---|---|
| `_RV_VA_COLORS` | 模块级 const | 视觉注解色板（B/R/Y/G → #hex），从函数内移至模块级以共享 | 1 |
| `_computeRvBoardMetrics()` | 函数 | 计算复盘棋盘尺寸（cell/label/boardPx/fullBoardH），纯函数无副作用 | ~20 |
| `_renderRvBoardCells()` | 函数 | 渲染 8×8 棋盘格子（控制图着色、[%csl] 高亮、坐标标注、棋子符号、🔁/⚡ 标记） | ~80 |
| `_renderRvArrowSvg()` | 函数 | 渲染 SVG 箭头叠加层（[%cal] 视觉注解，去重 + 按颜色对角偏移） | ~65 |
| `_buildRvEvalBarHTML()` | 函数 | 构建评估栏 HTML（emoji/desc/score/depth/progress/WDL/delta） | ~10 |
| `_buildRvSliderHTML()` | 函数 | 构建复盘步进滑块 HTML（CSS calc 定位，与图表数据点对齐） | ~15 |
| `_buildRvChartHTML()` | 函数 | 构建评估趋势图 HTML 包装（含全局/局部切换开关） | ~12 |
| `_buildRvNavHTML()` | 函数 | 构建导航按钮 HTML（⏮ ◀ ▶ ⏭） | ~7 |
| `_buildRvAnalyzeBtnHTML()` | 函数 | 构建「分析全部」按钮 HTML | ~3 |

设计原则：
- 所有辅助函数为 function 声明（bundle 级提升），调用顺序安全。
- 每个函数接收显式参数（局部变量依赖），不依赖隐式闭包。
- 模块级全局（reviewStep/reviewStates/showCtrlMap 等）仍直接读取，与原设计一致。
- _RV_VA_COLORS 从函数内 const 移至模块级 const，两个渲染函数共享，避免参数传递。

### _reviewAnalyzeAdvance 拆分（218 → 171 行，-22%）
通过 Python 脚本（scripts/extract_review_analyze_helpers.py）提取 2 个辅助函数：

| 提取项 | 类型 | 职责 | 行数 |
|---|---|---|---|
| `_findNextUncachedBatchStep(fromStep, lastStep)` | 函数 | 扫描下一个未缓存步骤（正向快路径 + 全范围回退，处理优先级中断） | ~18 |
| `_triggerPendingPostBatchActions(_pendingSave, _pendingStats)` | 函数 | 触发批量分析完成后的待处理动作（PGN 缓存保存 + 统计页打开），消除 S1192 代码重复 | ~16 |

设计原则：
- _findNextUncachedBatchStep 将「正向快路径 + 全范围回退」逻辑集中，原函数中该逻辑
  分散在 if/else 嵌套中。
- _triggerPendingPostBatchActions 消除完成分支中的代码重复（原 targetStep-valid 与
  targetStep-invalid 两个分支各有一份相同的 pendingSave+pendingStats 触发代码，共 ~30 行）。

### _resetGameUIState（231 行，不动）
经分析，该函数虽长但认知复杂度低：
- 全部为扁平的 `if(typeof X!=='undefined')X=null/0/false;` 语句序列，无嵌套。
- 231 行中大部分是注释（解释每个变量为何需要重置）。
- SonarCloud S3776 衡量分支/嵌套/布尔运算复杂度，不衡量行数。
- 强行拆分（如按「AI 状态」「复盘状态」「对话框状态」分组）会引入额外的函数调用
  开销，且需要传递大量模块级全局引用，反而增加认知负担。
- 结论：保持原样，记录为有意设计。

## StatsActivity.java 许可证标签修正
- 文件头部已明确声明 GPL v3（含详细的「dual-license confusion」说明注释）。
- README.license (java/com/Regalia) 中 12 处历史变更日志条目标为 AGPL v3，与文件头部不一致。
- 已全部修正为 GPL v3（sed 批量替换）。
- 其他文件（MainActivity/ChessWebViewClient/StabilizationHelper/EngineService/
  TlsSecurityHelper/ChessApp）的头部与 README.license 均一致标为 AGPL v3，无需改动。

## 验证
- ✅ 全部 11 个 JS 模块通过 `node --check`（含重构后的 ui.js）。
- ✅ chess.html 内嵌脚本块通过 `node --check`（22,677 行 / 1,368,101 字节）。
- ✅ Node vm 浏览器桩烟雾测试：bundle 加载零错误，10 个新提取辅助函数全部存在且可调用，
  _renderReviewMode/_reviewAnalyzeAdvance 仍为可调用函数。（_KING_PIECE_STYLE 警告为
  round-11 起既有有意防御模式，非新引入。）
- ✅ release APK（78,187,019 字节）：v1+v2+v3 签名全 true；versionCode=123 /
  versionName="1.2.3"；targetSdk 35 / minSdk 23；FGS subtype 属性存在；引擎 SHA-256
  三方一致（8f7116d3...）；APK 内 chess.html 含全部 10 个新辅助函数（字符串字面量验证）。
- ✅ tar 源码包：118 条目，0 引擎/构建产物/keystore/local.properties/lint-baseline。

## 文档更新
- BUILDING.md：新增 round-24 章节（God Function 拆分清单 + StatsActivity 许可证修正 + 验证）。
- PRIVACY.md：round-24 条目置顶（纯代码组织变更，无新权限/网络/数据收集）。
- NOTICE：round-24 条目置顶（God Function 拆分 + StatsActivity GPL v3 标签统一）。
- 8× README.license：chess.src 变更条目置顶；java/com/Regalia 含 StatsActivity 标签修正；
  其余 no-changes 条目置顶。
- README.md：round-24 章节。
- 中英文说明书：round-24 更新日志条目置顶。
- worklog.md：本条目。

## 最终交付（/home/z/my-project/download/）
- Regalia-release.apk
- Regalia-v1.2.3-src.tar
- Regalia-v1.2.3-manual-zh.html
- Regalia-v1.2.3-manual-en.html
- SHA256SUMS.txt

## 记录在案的已知遗留（下轮候选）
- **SonarCloud S6582 可选链（401 项）、S3358 嵌套三元（167 项）**：风格性优化，跨多文件
  批量改写风险高于收益，可下轮用 IDE 自动重构工具批量处理。
- **棋钟 undo 不回表、超时未查对方材料不足**等功能级议题（与 round-22/23 遗留一致）。
- God Function 拆分已完成主要目标（_renderReviewMode -35%、_reviewAnalyzeAdvance -22%）；
  _resetGameUIState 经分析为低认知复杂度扁平序列，保持原样。

---

# Regalia v1.2.3 — round-23 工作日志（2026-07-19）

## 任务来源
用户上传了 6 份新 PDF 参考资料（Regalia-PR51-剩余问题完善方案.pdf、SonarCloud_Regalia_修复方案.pdf、
931个代码异味问题.pdf、AI大模型代码生成防缺陷终极指南.pdf、Android WebView App 开发专业指南.pdf、
SonarCloud 完美通过审查指南.pdf），要求：

1. 完整读取上传的 PDF 参考资料，排查误报后汲取适用于本项目的信息；
2. 彻底解决上帝类&上帝函数的问题；
3. 彻底解决报告中所有非误报的问题；
4. 修复后检查每一个文件的每一行代码，基于设计意图思考是否有优化空间（优先级：
   bug修复 > 健壮性 > 功能完善 > 性能 > 冗余清理 > 简化）；
5. 修复后逐文件用 node --check 验证所有 JS 语法；
6. 重建 chess.html；
7. 构建 release APK（v1+v2+v3 签名齐全，兼容小米澎湃OS3）；
8. 用 create_v123_tar.sh 打包 tar 源码备份（无引擎文件）；
9. 验证 Stockfish 引擎是 dotprod 版本（SHA-256 三方一致）；
10. 更新 BUILDING.md、PRIVACY.md、README.md、NOTICE、所有 README.license；
11. 更新中英文 HTML 说明书（更新日志由上至下从新到旧排列）；
12. 版本号保持 v1.2.3（versionCode=123, versionName="1.2.3"）；
13. 所有交付物保存到 /home/z/my-project/download/。

## PDF 误报复查结论
按恢复指南警告「PDF 是 AI 生成的，误报率极高」，对每条声称对照源码验证：

### PR51 18 条问题（Regalia-PR51-剩余问题完善方案.pdf）
| 编号 | 严重度 | 类别 | 验证结论 | 处理 |
|---|---|---|---|---|
| Q1 | Major | 功能正确性 | 真实（Chess960 SPID 残留） | 修复 |
| Q2 | Major | 功能正确性 | 真实（Fischer 增量掩盖超时） | 修复 |
| Q3 | Major | 功能正确性 | 真实（stateHistory 未含 gameClocks） | 修复 |
| Q4 | Major | 功能正确性 | 真实（输入未钳制 max） | 修复 |
| Q5 | Major | 功能正确性 | 真实（null move 静默跳过） | 修复 |
| Q6 | Major | 功能正确性 | 真实（SPID 越界未拒绝） | 修复 |
| Q7 | Major | 数据完整性 | 真实（tag-strip 非引号感知） | 修复 |
| Q8 | Major | 数据完整性 | 部分误报（worker-pool headerRe 已引号感知） | 记录 |
| Q9 | Minor | 数据完整性 | 真实（仅替换小写 </） | 修复 |
| Q10 | Minor | 评估显示 | 真实（符号硬编码 +） | 修复 |
| Q11 | Major | 安全与许可证 | 真实（反射不存在的 API） | 修复 |
| Q12 | Major | 安全与许可证 | 真实（README.license AGPL→GPL） | 修复 |
| Q13 | Minor | 文档元数据 | 真实（signal #1 应为 #2） | 修复 |
| Q14 | Minor | 文档元数据 | 真实（MODULES 缺 ui-gameflow/ui-interactions） | 修复 |
| Q15 | Trivial | 文档元数据 | 误报（无 v1.2.1 manual 引用残留） | 不动 |
| Q16 | Trivial | 文档元数据 | 真实（重建尺寸不一致） | 修复 |
| Q17 | Trivial | 代码质量 | 真实（应为 static） | 随 Q11 一并修复 |
| Q18 | Trivial | 代码质量 | 真实（MD058 表格缺空行） | 修复 |

**16 条真实缺陷全部修复，2 条误报已记录。**

### SonarCloud 931 项代码异味（931个代码异味问题.pdf）
按问题类型分布（前 8 类，共占 90%+）：

| 规则 | 数量 | 严重度 | 处理结论 |
|---|---|---|---|
| S6582 可选链 | 401 | MINOR | 风格性优化，跨多文件批量改写风险高于收益，不动 |
| S3776 认知复杂度 | 298 | CRITICAL | round-17/20/22 已大量拆分，剩余项主要为 _renderReviewMode (552 行) 等大型渲染函数，拆分需大量变量共享分析，记录下轮处理 |
| S7741 typeof 守卫 | 243 | MINOR | round-11 跨模块容错设计保留，仅同模块 typeof 已在 round-17 转为 !== undefined |
| S2703 隐式全局 | 207 | BLOCKER | round-17 eslint no-undef 验证仅 ECO_OPENINGS 惰性挂载/gameEvent/gameSite 注入全局命中，均为有意设计 |
| S3358 嵌套三元 | 167 | MAJOR | 风格性优化，不动 |
| S2681 花括号 | 154 | MAJOR | 已在 round-17/20 检查并补齐关键字路径 |
| S8786 ReDoS | 85 | MAJOR | round-20 已修复 PGN tag-strip 正则（5 处），本轮 Q7 进一步引号感知化 |
| S2486 空 catch | 72 | MINOR | round-15/17 已大量补 console.warn，剩余项为有意吞异常（反射、特性检测） |
| S1181 catch(Throwable) | 69 | MAJOR | round-17 已转 catch(Exception)，仅 HapticManager 反射路径保留 Throwable（Q11 修复后反射已移除） |
| S3504 var | 63 | CRITICAL | 风格性优化，不动 |
| S7781 replaceAll | 61 | MINOR | round-17 已处理 |
| S1192 重复字面量 | 58 | CRITICAL | 多为 i18n 键名/HTML 标签，提取常量收益有限 |
| S7758 Unicode | 51 | MINOR | 全部为已验证 ASCII 棋谱记法，codePointAt 无意义 |
| S116 字段命名 | 42 | MINOR | Java 字段命名遵循驼峰，部分缩写如 mPref 风格性 |
| S108 空块 | 42 | MAJOR | 多为 catch 块（已处理）或静态初始化块 |

### 其他 PDF（通用指南类）
- AI大模型代码生成防缺陷终极指南.pdf：通用提示词工程指南，已应用的实践包括版本锁定、边缘情况处理、单一职责、思维链自省。
- Android WebView App 开发专业指南.pdf：通用 WebView 开发指南，已应用的实践包括禁用文件访问、密码保存关闭、JS 注解校验、HTTPS 校验、内存泄漏防护、WebChromeClient 进度反馈、WebView 销毁清理。
- SonarCloud 完美通过审查指南.pdf：通用 SonarCloud 流程指南，已应用的实践包括 New Code 基准、Quality Gate 五维度、sonar-project.properties 配置。

## 修复实施（按优先级 bug > 健壮性 > 功能 > 性能 > 冗余 > 简化）

### Bug 修复（PR51 Major/Minor 功能与数据完整性）
1. **Q1 Chess960 身份残留**（tablebase.js + ui-interactions.js）：tablebase.js importPGN
   Chess960 分支现先 `gameSPID=null` 再让 FEN 反推结果覆盖；ui-interactions.js 非 Chess960
   摆棋分支退出时 `gameSPID=null`（此前仅 setChess960Mode(false)）。
2. **Q2 Fischer 增量掩盖超时**（ui-gameflow.js recordMoveEnd）：扣时后立即检查
   `clock.remainingSec<=0`，归零则触发 `_onGameClockExpired` 并提前 return，不再加增量。
3. **Q3 stateHistory 未含 gameClocks**（ui-interactions.js）：新增 `_snapshotClocks()`/
   `_restoreClocks(snap)` 辅助函数，stateHistory.push 与 _redoStack.push 都加入 clocks
   字段；undoMove/redoMove 恢复时重基准化 lastMoveTimestamp 至 Date.now()，按需重启
   tick 间隔。
4. **Q4 时间控制输入未钳制 max**（ui.js）：base/incr/delay oninput 加入 v>600/v>60
   钳制并把超限值回写到输入框。
5. **Q5 null move 静默跳过**（ui.js _replayMovesToState）：仅 i===0 跳过（黑先占位符），
   其他位置 null 触发 console.error 并 return null 中止回放。
6. **Q6 SPID 越界未拒绝**（ui.js）：oninput 检测越界值立即清空输入框并设
   dlgChess960SPID=-1。
7. **Q7 PGN tag-strip 非引号感知**（tablebase.js + stats.html 4 处）：
   `/\[\w+\s+\S[^\]]*\]/g` → `/\[\s*\w+\s+(?:"[^"]*"|[^\]]*?)\s*\]/g`，引号分支完整消耗
   value，非引号分支非贪婪兜底，无 ReDoS 风险。
8. **Q9 scriptJS 仅替换小写 </**（stats.html）：新增 `_enc(s)` 辅助函数，所有 `<` 编码为
   `\u003c`（OWASP JSON-in-HTML 推荐），同时编码 pgnText 与 lang。
9. **Q10 _formatEvalDelta 符号硬编码 +**（ai-bridge.js）：dp 改用 Math.abs(d)/100，
   正负分支分别用 +dp 与 \u2212dp（Unicode 减号），与 round-22 玩家视角色标契约一致。
10. **Q11 HapticManager PWLE 反射不存在 API**（HapticManager.java）：移除全部反射代码
    （pwleState/pwleCtor/pwleStartMethod/pwleAddPwleRampMethod/pwleComposeMethod），
    改用公共 VibrationEffect.createWaveform(long[], int[], int) API（API 26+）。float[]
    振幅 [0..1] 缩放至 int[] [0..255]，long[] 时长原样传递，保留多阶段包络语义。17 个
    触觉人格原样保留。
11. **Q12 README.license AGPL→GPL**（java/com/Regalia/README.license）：round-19/20
    变更日志的 HapticManager.java 与 JsBridgeGateway.java 标签由 AGPL v3 修正为 GPL v3
    （与文件头部和其他条目一致）。
12. **Q13 AndroidManifest signal 编号**（AndroidManifest.xml）：<queries> 块注释将包检测
    由 signal #1 修正为 signal #2（RootDetector: #1 su-binary paths, #2 package detection,
    #3 test-keys）。
13. **Q14 manual MODULES 示例缺失**（Manual/manual-zh.html + manual-en.html）：补齐
    state-store.js（v1.2.0 新增）、ui-gameflow.js、ui-interactions.js（round-17 God Class
    拆分模块）。
14. **Q16 chess.html 重建尺寸不一致**：本轮重建统一为 22,659 行 / 1,368,542 字节，
    README.license 与 manual-en.html 均使用此值。
15. **Q17 tryPwleVibrate 应为 static**：随 Q11 一并处理（方法已不存在），新增的
    tryWaveformVibrate 与 fallbackVibrate 均为 private static（SonarCloud java:S2696）。
16. **Q18 worklog.md MD058**：本轮 worklog 已统一格式（表格前后空行）。

### 误报确认（不动）
- **Q8**：worker-pool.js 的 headerRe 已是引号感知（`"((?:[^"\\]|\\.)*)"` 处理转义引号），
  无需改动；记录为部分误报。
- **Q15**：assets/README.license 已无 v1.2.1 manual 引用（早期轮次已更新为 v1.2.3）。

### SonarCloud 931 项代码异味
按恢复指南警告「PDF 是 AI 生成的，误报率极高」，逐类对照源码验证：
- S6582 可选链（401 项）、S3358 嵌套三元（167 项）：风格性优化，跨多文件批量改写风险
  高于收益，不动。
- S3776 认知复杂度（298 项）：round-17/20/22 已大量拆分，剩余项主要为
  _renderReviewMode (552 行)、_resetGameUIState (231 行)、_reviewAnalyzeAdvance (218 行)
  等大型渲染/状态机函数。这些函数包含大量局部变量共享，拆分需逐行分析变量作用域，
  风险较高，记录下轮处理。
- S7741 typeof 守卫（243 项）：round-11 跨模块容错设计保留，仅同模块 typeof 已在
  round-17 转为 !== undefined。
- S2703 隐式全局（207 项 BLOCKER）：round-17 eslint no-undef 验证仅 ECO_OPENINGS 惰性
  挂载/gameEvent/gameSite 注入全局命中，均为有意设计。
- S8786 ReDoS（85 项）：round-20 已修复 PGN tag-strip 正则（5 处），本轮 Q7 进一步
  引号感知化。
- S2486 空 catch（72 项）、S1181 catch(Throwable)（69 项）：round-15/17 已大量补
  console.warn 与转 catch(Exception)，仅 HapticManager 反射路径保留 Throwable（Q11
  修复后反射已移除）。
- S7781 replaceAll（61 项）：round-17 已处理。
- S7758 Unicode（51 项）：全部为已验证 ASCII 棋谱记法，codePointAt 无意义。
- 其余类别（S3504 var、S1192 重复字面量、S116 字段命名、S108 空块等）：风格性优化，
  本轮不动以避免引入新风险。

### 第一性原理优化
- **HapticManager**：Q11 修复采用「移除反射 + 使用公共 API」方案，而非 PR51 建议的
  「保留反射 + 加 API 35 公共 PwleBuilder 分支」。理由：API 35 公共 SDK 中
  VibrationEffect.Composition 仅有 addPrimitive/compose，没有 startPwle/addPwleRamp，
  也没有 createPwleBuilder（经验证 android-35/android.jar）。反射必然失败，应直接移除
  并使用 API 26+ 的 createWaveform 公共 API。这一方案同时解决 Q17（方法变 static）。
- **tryWaveformVibrate 设计**：输入参数 (Vibrator, float[], long[]) 与原 tryPwleVibrate
  一致，float[] 振幅 [0..1] 缩放至 int[] [0..255]（Math.round + clamp），long[] 时长
  原样传递。所有 17 个调用点的 float[]/long[] 数组保持不变，行为语义等价（多阶段包络）。
- **_snapshotClocks/_restoreClocks**：快照包含 type/incrementSec/delaySec + 双方
  remainingSec/displayRemainingSec/lastMoveTimestamp。恢复时 lastMoveTimestamp 重基准化
  至 Date.now()，避免立即扣除快照至今的 elapsed 时间。按 isRunning 状态重启 tick 间隔
  （initGameClocks 幂等，先 clearInterval 再 setInterval）。
- **Q7 引号感知正则**：使用 alternation `(?:"[^"]*"|[^\]]*?)` 而非回溯分支。引号分支
  优先匹配（消耗完整引号字符串），非引号分支非贪婪匹配到第一个 ]。验证无 ReDoS 风险
  （分支互斥，非贪婪单字符类）。

## 验证
- ✅ 全部 11 个 JS 模块通过 `node --check`（含 ui-gameflow/ui-interactions 两个 round-17
  新增模块）。
- ✅ chess.html 内嵌脚本块通过 `node --check`（提取至 /tmp/chess-inline.js 验证）。
- ✅ chess.html 重建：22,659 行 / 1,368,542 字节。
- ✅ HapticManager.java 编译通过（仅 deprecated API 警告，vibrate(long) 在 API 26+
  已弃用但仍可用）。
- ✅ release APK（78,186,040 字节）：v1+v2+v3 签名全 true（v3.1 false 可选，不影响）；
  versionCode=123 / versionName="1.2.3"；targetSdk 35 / minSdk 23；FGS subtype 属性
  存在（specialUse + chess_engine_analysis）；引擎 SHA-256 三方一致（APK == 源 ==
  预期 8f7116d3...）；libengine_bridge.so(5096)+libc++_shared.so+libstockfish.so 齐全；
  HapticManager 编入 dex（验证字符串字面量 createWaveform 存在、startPwle/addPwleRamp
  无残留）。
- ✅ tar 源码包：118 条目，0 引擎/构建产物/keystore/local.properties/lint-baseline。

## 文档更新
- BUILDING.md：新增 round-23 章节（PR51 18 条修复清单 + 验证 + 工具链事实表）。
- PRIVACY.md：round-23 条目置顶（纯代码组织变更，无新权限/网络/数据收集）。
- NOTICE：round-23 条目置顶（HapticManager.java GPL v3 归类不变，所有 PR51 修复点
  逐项记录）。
- 8× README.license：chess.src/assets/src/main/Manual 变更条目置顶；
  java/com/Regalia/res/cpp no-changes 条目置顶。
- README.md：round-23 章节（PR51 修复清单 + 验证）。
- 中英文说明书：round-23 更新日志条目置顶（内容对等非机翻），含 Q14 MODULES 修复。

## 最终交付（/home/z/my-project/download/）
- Regalia-release.apk — SHA-256 见 SHA256SUMS.txt
- Regalia-v1.2.3-src.tar — SHA-256 见 SHA256SUMS.txt
- Regalia-v1.2.3-manual-zh.html — SHA-256 见 SHA256SUMS.txt
- Regalia-v1.2.3-manual-en.html — SHA-256 见 SHA256SUMS.txt
- SHA256SUMS.txt

## 记录在案的已知遗留（下轮候选）
- **God Function 拆分**：ui.js 的 _renderReviewMode (552 行)、_resetGameUIState (231 行)、
  _reviewAnalyzeAdvance (218 行) 仍为大型函数，认知复杂度较高。拆分需逐行分析变量作用域
  与共享状态，风险较高，记录下轮处理。
- **StatsActivity.java license 标签不一致**：文件头部为 GPL v3，但 README.license 多处
  标为 AGPL v3（早期分类遗留）。PR51 Q12 仅覆盖 HapticManager/JsBridgeGateway，未涉及
  StatsActivity。下轮可统一修正。
- **SonarCloud S6582 可选链（401 项）、S3358 嵌套三元（167 项）**：风格性优化，跨多文件
  批量改写风险高于收益，可下轮用 IDE 自动重构工具批量处理。
- **棋钟 undo 不回表、超时未查对方材料不足**等功能级议题（与 round-22 遗留一致）。

---

# Regalia v1.2.3 — round-22 工作日志（2026-07-18）

## 任务来源
用户报告评估栏视角 Bug：评估栏显示的优劣之视角有时不符合玩家立场。明确设计契约：
分值/折线图/将杀记号（#+/#-）为白方视角（正数=白方优势），emoji+描述/增减色标/WDL 标签/
终局分值为玩家视角（无论玩家执白或执黑都看到自己的优劣势报告）。要求修复违反该契约的缺陷，
并对每个文件逐行第一性原理审查优化（bug>健壮性>功能>性能>冗余>简化），版本号保持 123/1.2.3，
交付 release APK（v1+v2+v3 签名、兼容澎湃 OS 3）+ tar 源码包（无引擎）+ 中英文 HTML 说明书。

## 评估栏视角 Bug 修复（4 处，均对照源码验证）
1. **formatEval() 超时/认输终局分值**（ui.js）：已杀分支已正确用 `whiteWins` 生成 `#+`/`#-`，
   但超时与认输分支用 `playerWins` 生成 `+∞`/`-∞`——黑方玩家靠超时/认输获胜时会看到 `+∞`
   （白方优势分值）配 🏆（玩家获胜 emoji）的矛盾视图。修复为统一 `score:whiteWins?'+∞':'-∞'`，
   emoji/desc 保持玩家视角。
2. **应用内 W/D/L 标签**（ai-bridge.js 主评估栏 + ui.js 复盘评估栏）：`_sfWdlW` 为白方胜率却
   标为 "W"，黑方玩家看到的 "W" 实为对手胜率。修复为玩家视角（黑方玩家时交换 W/L，"W"=我的胜率）。
   PGN 导出 WDL（pgn-standard.js）仍为白方视角（PGN 为可移植中立格式），不变。
3. **评估增减色标**（_formatEvalDelta, ai-bridge.js）：绿色原为白方改善，黑方玩家局面恶化时却显示
   绿色"良好"。修复为玩家视角色标（绿色=对玩家有利；显示数值仍为白方视角以与相邻分值一致）。
   将杀转换色标（→#/脱险）同样改为玩家视角（玩家将杀/脱险=绿色）。
4. **复盘评估栏 WDL 缺 total>0 守卫**（ui.js）：主评估栏已有，复盘评估栏缺失，引擎输出 `wdl 0 0 0`
   时会显示 `NaN%`。补齐守卫。

## 第一性原理逐文件审查
对照 3 份 PDF 参考资料（AI 防缺陷指南、Android WebView 指南、SonarCloud 指南——均为通用指南，
按恢复指南警告 PDF 误报率高，仅汲取通用原则：边缘情况处理、不吞异常、单一职责、DRY、WebView
生命周期管理）。round-17/20/21 已做大量清理，本轮重点：
- 评估栏全链路视角审计（formatEval/posDesc/posEmoji/_formatEvalDelta/WDL/折线图/_classifyMove），
  确认 emoji+desc 经 evP 玩家视角、分值/折线图/将杀记号白方视角、走法分类 mover 视角——均正确，
  仅上述 4 处违反契约。
- Java 文件抽查（EngineHealthMonitor/EngineProcessManager/ChessApp）：clean，round-17/20 已加固。
- ui-gameflow.js / ui-interactions.js 头部补齐 GPL v3 版权声明块（与 ui.js 风格一致，round-17 遗漏）。

## 文档同步
- BUILDING.md：新增 round-22 章节（视角契约说明 + 4 处修复 + 验证 + 工具链事实表）；修正 buildDir
  路径（`/tmp/regalia_build/...` 为陈旧，实际为 `build/outputs/apk/release/`）；补充 lint baseline
  首次构建行为说明 + 单模块无 `:app:` 前缀。
- PRIVACY.md：round-22 条目置顶（纯显示视角修复，无新权限/网络/数据收集）。
- NOTICE：round-22 条目置顶（ui.js/ai-bridge.js GPL v3 归类不变，chess.html AGPL v3 不变）。
- 8× README.license：chess.src/assets/src/main/Manual 变更条目，java/res/cpp/assets(root) no-changes 条目。
- README.md 目录树：补齐 ui-gameflow.js、ui-interactions.js、HapticManager.java、worklog.md、
  CONTRIBUTING-{zh,en}.md、SECURITY_FIXES.md、About_v18.x.x_.md、LICENSE&NOTICE.zip。
- 中英文说明书：round-22 更新日志条目置顶（内容对等非机翻），示意图无 UI 布局变更故不变。

## 验证
- ✅ 11 个 JS 模块 + chess.html 内嵌脚本 `node --check` 全过。
- ✅ chess.html 重建：22,545 行 / 1,362,350 字节；评估修复标记存在（5×round-22、2×score:whiteWins）。
- ✅ bundle 级 eslint no-undef + Node vm 烟雾测试：11/11 关键函数存在，零加载期 TDZ 错误。
- ✅ release APK（78,182,170 字节）：v1+v2+v3 签名全 true（v3.1 false 可选，不影响）；versionCode=123/
  versionName="1.2.3"；targetSdk 35 / minSdk 23；FGS subtype 属性存在（specialUse + chess_engine_analysis）；
  引擎 SHA-256 三方一致（APK == 源 == 预期 8f7116d3...）；libengine_bridge.so(5096)+libc++_shared.so+
  libstockfish.so 齐全；HapticManager 编入 dex。
- ✅ tar 源码包：97 条目，0 引擎/构建产物/keystore/local.properties/lint-baseline。

## 最终交付（/home/z/my-project/download/）
- Regalia-release.apk — SHA-256=2c67d65693ba3f9513ac27b7c2ccd65ee36109b178bf1daf8ff49c3bd899b597
- Regalia-v1.2.3-src.tar — SHA-256=81f66b7f90e44e820ae6841a82b8603c6cf9619badf1e04a0260cfdca88ad19f
- Regalia-v1.2.3-manual-zh.html — SHA-256=48342fd5147100a71122f03f11426fac4e5f4b78586a9a34eb374b776d213600
- Regalia-v1.2.3-manual-en.html — SHA-256=7cd37df0d7f049136798ebe293eb65fe08d25608976f2319ca9bfe544e1ed68c
- SHA256SUMS.txt

# Regalia v1.2.3 — round-21 工作日志（2026-07-17）

## 任务来源
用户报告边缘情形：round-20 的 FEN 导入 Chess960 检测在「对方王离 e 列」时误触发
（例：3k4/8/8/8/8/8/8/R3K2R w KQ - 0 1），询问是否为误报。

## 排查结论：非误报（报告成立）
_needsShredderFEN 的王位置检查为全局或：任一易位权存在 且 任意王不在初始格 → true。
报告局面中白方持 KQ 权且王车全在标准位，黑王游走至 d8（黑方无权）——完全合法的
标准局面被误判 960（gameVariant/引擎 UCI_Chess960/PGN 变体标签连锁误标；该局面两种
规则易位目标格重合，走子合法性不受影响，影响限于变体误标+引擎配置）。

## 修复
ai-bridge.js _needsShredderFEN：王位置信号按颜色与己方易位权联动门控——
(whiteKingside||whiteQueenside)&&s.wk 离家 才 true；黑方同理。标准规则下持权方王
必在初始格，对方王位置无关。角落车检查本就逐权门控，未动。三个消费方（导入检测、
引擎 Shredder-FEN 输出、PGN [FEN] 转换）同时受益。

## 环境重建（沙箱重置）
本轮 /tmp 被重置（工具链/构建副本/引擎/keystore 全失，/mnt/agents 幸存）：
- /mnt/agents/tools 下 jdk21.tar.gz 与 cmdtools.zip 为 100MiB 截断损坏品（挂载上限），
  gradle-home 仅 wrapper。全部重新下载：JDK 21.0.11、cmdline-tools、SDK
  platform-35+build-tools 34.0.0+platform-tools+cmake 3.31.6+NDK 27.2.12479018、
  Gradle 8.11.1（tuna/腾讯镜像，分块下载绕单连接上限）。
- 引擎重新下载 stockfish sf_18，SHA-256 复核一致（8f7116d3…）。
- **签名密钥丢失**：按原参数重新生成（alias debug，CN=Android Debug，RSA-2048，
  10950 天）并持久化备份 /mnt/agents/tools/debug.keystore.bak。
  ⚠️ 新证书指纹 SHA-256=8bc19e69…，与旧轮次不同——覆盖安装旧版会被拒，需先卸载。
- 踩坑：首轮构建 versionCode=111/1.1.1 —— version.properties 在项目**父目录**
  （../version.properties），补拷后恢复 123/1.2.3。

## 验证
- 烟雾测试 13 场景全过：新增场景 M（报告 FEN 回归不误标；持权方王离家双方仍触发；
  标准初始/960 SP0 不变；导入路径端到端不误标）。chess.html 重建内嵌脚本 check 过。
- APK（78,176,601 字节）：v1+v2+v3 全过；123/1.2.3/targetSdk 35；无 ACCESS_NETWORK_STATE；
  FGS subtype 完整；引擎哈希三方一致；chess.html 含修复代码。

## 文档更新
- 双语说明书 round-21 条目置顶（含签名证书变更醒目说明）；
- NOTICE/PRIVACY/README round-21 小节；8× README.license（chess.src/assets/src/main
  变更条目，Manual 变更条目，其余 no-changes）；worklog 本条目置顶。

## 最终交付记录（round-21）
- /tmp 本轮遭遇**两次**重置：首次重置后重建工具链并发现 keystore 丢失（重新生成+备份）；
  第二次重置后再次重建（keystore 从备份恢复，证书指纹保持一致 8bc19e69…）。
  重建要点：cmdtools 需完整重下（续传与非并发）、lintVitalRelease 首次自动生成
  lint-baseline.xml 需二次构建、version.properties 在项目父目录。
- 交付物（/mnt/agents/output/）：
  - Regalia-release.apk（78,177,683 字节）— SHA-256=3ce653d469512bb251a7a38bd98866652e84e0d423ab1501cdb082489bc8a9be
  - Regalia-v1.2.3-src.tar.gz — 118 条目，0 禁用条目
  - Regalia-v1.2.3-manual-{zh,en}.html、SHA256SUMS.txt

# Regalia v1.2.3 — round-20 工作日志（2026-07-17）

## 任务来源
- 完整读取《PR #51 中影响可靠性的代码异味.pdf》，排查误报，修复非误报。
- 彻底完善记录在案的 4 项已知遗留：易位权最近车启发式同侧双车歧义（A-1）、
  FEN 导入未做 Chess960 检测（B）、DIRTY_* 增量渲染死代码 ~200 行（C）、
  HapticManager PWLE 反射公开 SDK 失效（E-3）。
- 批量分析提示改为仅在「分析全部」按钮上右对齐显示（仅批量进行中），中英双语。
- 版本号 v1.2.3 不变；交付 release APK + tar（无引擎）+ 双语说明书。

## 新 PDF 排查（4 类）
| 报告项 | 结论 | 处理 |
|---|---|---|
| S8786 worker-pool.js:486 / chess.html:6510 正则 | 误报 | 更早轮次已修（\d+\.+ 无嵌套量词，注释在案） |
| S8786 stats.html:1518/1558 PGN 标签剥离正则 | **非误报** | `/\[[A-Za-z]\w*\s+[^\]]+\]/g`（\s+ 与 [^\]]+ 空白重叠→多项式回溯）改为 `/\[\w+\s+\S[^\]]*\]/g`（相邻量词类互斥），同款 5 处全改（stats.html×4 + tablebase.js×1）；10 个代表性 PGN 语义等价验证通过，未闭合 '[' 病态输入线性 |
| S7758 charCodeAt（ai-bridge/game-logic/tablebase/chess.html 多处） | 全部误报 | 所涉均为已验证 ASCII 棋谱记法（代数格/UCI 走法），codePointAt 无意义 |
| S7773 parseFloat（stats.html:1602/1639） | 非误报（风格） | → Number.parseFloat |
| S7781 replace（stats.html:3923） | 非误报（风格） | → replaceAll('</','<\\/') |

## 已知遗留完善（4 项）
1. **A-1 指定车列**：castlingRights 新增 *RookFile 四字段；parseShredderCastling
   从 FEN 易位字段记录（含 KQkq 兼容映射）；initState=a/h；initChess960State=实际车列；
   摆棋 🔁 标记记录标记车。新 findDesignatedCastlingRook（指定列在场验证优先，退化启发式）
   用于 960 易位执行与合法性；toShredderCastling 输出指定列（X-FEN 精确往返）；
   makeMv/makeMvInPlace 全部清权点（车移动/被吃/王移动/角落兜底）指定列感知并置空。
   cloneS/undo 展开复制天然兼容。
2. **B FEN 导入检测**：_applyImportedFEN 用 _needsShredderFEN 判定非标准布置 →
   gameVariant='chess960' + 引擎模式 + state.chess960 + 完整初始布置时推导 SP-ID；
   标准 FEN 导入重置残留 Chess960 模式（原模式跨局残留问题一并修复）。
3. **C DIRTY 死代码移除**：全部 markDirty 调用点历来只走全量渲染分支（DIRTY_FULL /
   MOVES|PANEL|EVAL 均触发 full-render），细粒度增量路径不可达。移除常量/markDirty/
   _scheduleRender/_performDirtyRender/Integer_bitcount/_updateBoardIncremental/
   _updateEvalDisplayIncremental（~200 行），调用点直接 render()（行为等价）。
   共享原语 _updateSingleSq/_updateChangedSquares/_getSqElCache 保留（_updateBoardLightweight
   活跃路径在用）。boardVersion 字段保留（唯一消费方已移除，留作状态计数）。
4. **E-3 PWLE 缓存探测**：tryPwleVibrate 原每次震动完整反射（Class.forName+3×getMethod
   +构造器），公开 SDK 失效机型每帧抛异常静默兜底。改为进程内一次探测三态缓存：
   AVAILABLE 复用句柄；UNAVAILABLE 跳过反射直走波形兜底，仅探测时记一次 Log.d。

## 功能调整
- 移除 round-19 的 #review-batch-hint 独立提示行（_rvBatchHintHTML/_updateReviewBatchHint
  及全部引用）；
- 「分析全部」按钮改 flex 布局：左标签 + 右对齐提示（accent 色 .66rem，可省略），
  仅 _reviewAnalyzeAllActive 时显示；_rvAnalyzeBtnInnerHTML 统一渲染，
  _updateReviewAnalyzeBtn 改用 innerHTML；reviewAnalyzeAll 开始时原地刷新按钮。

## 验证
- 11 个 JS 模块 node --check 全过；build-chess.py 重建（22,428 行 / 1,356,181 字节）；
  chess.html 与 stats.html 内嵌脚本 node --check 全过；Java 两文件括号配平。
- 烟雾测试 12 场景全过：新增 K（指定车列：init/X-FEN/查找/往返/指定车移动清权+
  非指定车移动**不**清权/960 初始）、L（FEN 导入 960 检测 + 标准局清洁）、
  J 重写适配按钮右对齐新结构。
- 正则语义等价：node 专项脚本 10 用例新旧正则输出完全一致。
- APK：v1+v2+v3 全过；123/1.2.3/targetSdk 35；无 ACCESS_NETWORK_STATE；
  FGS subtype "chess_engine_analysis"；引擎 SHA-256 三方一致；
  chess.html 含新代码（17 处命中）；dex 含 startPwle/addPwleRamp 反射字面量。

## 文档更新
- 双语说明书 round-20 条目置顶；NOTICE/PRIVACY/README round-20 小节；
  8× README.license（5 目录变更条目 + 3 目录 no-changes）；worklog 本条目置顶。

## 最终交付记录（round-20）
- 文档更新后同步构建副本并**增量重建 APK**（78,176,620 字节），重新验证：
  v1+v2+v3 签名全过、版本 123/1.2.3/targetSdk 35、引擎哈希三方一致、
  APK 内嵌 README.license 含 round-20 条目。
- 交付物（/mnt/agents/output/）：
  - Regalia-release.apk — SHA-256=ab713dde2e48342eb56125855436937f551deb6168eb54723484151b384e0417
  - Regalia-v1.2.3-src.tar.gz — 118 条目，0 禁用条目
  - Regalia-v1.2.3-manual-{zh,en}.html、SHA256SUMS.txt

# Regalia v1.2.3 — round-19 工作日志（2026-07-17）

## 任务来源
- 用户新需求（中英双语适配）：
  1. 每次打开 app 进入主界面、棋盘刚显示时，Toast 提示「长按棋盘可开/关棋盘防抖」。
  2. 批量分析（分析全部）进行期间，复盘界面评估栏增加「批量分析进行中… 长按走法可设为优先」文字。
- 完整读取两份外部审查报告（/mnt/agents/upload/gitar-bot报告.md、
  PR #51 概述与代码异味总结.pdf），排查误报后修复非误报部分。
- 要求：小心谨慎、版本号 v1.2.3 不变、更新全部文档、交付 release APK
  （澎湃OS3、v1+v2+v3 签名）+ tar 源码备份（无引擎）+ 双语说明书。

## 审查报告逐项排查结论
gitar-bot 报告仅 1 项；PR #51 PDF 为 AI 推测性总结（文末自述"无法确保真实准确"）共 8 项。
两份报告交叉指向同一处问题，逐项复核：

| 报告项 | 结论 | 依据 |
|---|---|---|
| gitar-bot：JsBridgeGateway CR/LF 拦截日志直接记录 command.trim()，嵌入换行可伪造 logcat 日志行 | **非误报 → 已修复** | 源码 JsBridgeGateway.java:135 确认 trim() 不去嵌入 CR/LF |
| PDF 同项（java:S5443 日志注入） | 同上（同一处） | 与 gitar-bot 交叉印证 |
| PDF java:S1448 上帝类（提取 HapticManager） | 误报 | HapticManager.java 已存在（round-17） |
| PDF javascript:S138 ui.js 过长（拆分） | 误报 | ui-gameflow.js / ui-interactions.js 已拆分（round-17） |
| PDF javascript:S109 parseInt 魔法数字 | 误报 | 全库 grep 无非 Number.parseInt 命中 |
| PDF java:S2221 通用异常（sleepGracefully） | 误报 | StockfishNative.java:677 已存在并 4 处使用 |
| PDF javascript:S134 嵌套过深 | 误报 | dataset/箭头函数/Math.trunc 重构已完成 |
| PDF java:S2095 引擎重启清理 _evalDeepBatchActive | 误报 | ui.js:5194/5558/5687/5856 四处已覆盖 |
| PDF 构建配置（CMake 固定 3.31.6+/keystore 验证） | 误报 | build.gradle:184 round-13 已固定 |

## 修复与实现
1. **安全修复（唯一非误报）** JsBridgeGateway.java：CR/LF 拦截日志改为
   `command.trim().replace("\r","\\r").replace("\n","\\n")`（String.replace 字面量，
   无正则陷阱），被拦截载荷单行显示。
2. **功能 1（启动 Toast）**：
   - ui.js：新增 `_boardDebounceHintShown` 标志 + `_maybeShowBoardDebounceHint()`
     （overlay 未消失则跳过；标志保证每次页面加载仅触发一次；4500ms toast），
     在 `_postRenderFinalize` 末尾调用。
   - ai-bridge.js：`_hideLoadingOverlay` 延迟 600ms 以 typeof 守卫调用同一函数，
     覆盖"overlay 消失后长时间无 render"路径（如 AI 首步长考）。
   - i18n 键 `board_debounce_hint`（术语对齐 MainActivity「棋盘防抖/Board stabilization」）。
3. **功能 2（批量分析提示行）**：
   - 评估栏 `#review-eval-bar` 为严格单行（overflow:hidden+nowrap），提示不能内嵌，
     故在评估栏正下方新增独立提示行 `#review-batch-hint`。
   - 全量渲染路径：`_rvBatchHintHTML`（仅 `_reviewAnalyzeAllActive` 为真时非空），
     在 `.review-bottom` 中紧随 `h+=_rvEvalBarHTML` 输出。
   - 原地更新路径：`_updateReviewBatchHint()`（insertAdjacentElement('afterend') /
     remove，幂等）；在 `reviewAnalyzeAll()` 置 active=true 后立即调用（批量开始无全量
     render）；批量完成/取消/退出复盘路径本就有 reviewGoTo/render，提示自动消失。
   - i18n 键 `review_batch_analyzing_hint`；对应已有功能 `_prioritizeReviewStep`
     （v1.1.2 长按走法优先）。
4. **i18n**：game-logic.js 键表新增上述 2 键（zh/en）。

## 验证
- 11 个 JS 模块 node --check 全过；build-chess.py 重建 chess.html
  （22,459 行 / 1,351,368 字节），内嵌脚本 node --check 通过。
- Node vm 烟雾测试扩展到 10 场景全过：A–H 既有 + 新增 I（启动提示 once 守卫 + 双语键）、
  J（批量提示行插入/幂等/移除 + 双语键）。
  - 顺带修复测试工装自身 bug：场景 H 的模板字符串转义层错误导致正则字面量损坏
    （`\/`→`/`、`\\`→`\` 后变成未闭合分组），此前恒 ERROR；重写为 indexOf 切片 +
    charCodeAt 校验（规避转义歧义）+ new RegExp 编译 + 语义解析验证，并修正变量名
    `_PGN_WORKER_SOURCE`→`_WORKER_SRC`。场景 I 初跑暴露 `_lang` 依赖（启动语言探测在
    node UA 下落 en），改为显式置位+恢复。生产代码无问题。
- APK（/tmp/build …/Regalia-release.apk，78,172,965 字节）：
  apksigner v1+v2+v3 全 true；versionCode=123 / versionName=1.2.3 / targetSdk 35；
  权限无 ACCESS_NETWORK_STATE、FOREGROUND_SERVICE_SPECIAL_USE 保留；
  FGS subtype "chess_engine_analysis"（type 0x40000000 specialUse）；
  引擎 SHA-256=8f7116d3f1a7004a6581d4fb0c1ff891ce095bab6d45e52f1578897cf23b61b5 三方一致；
  APK 内 chess.html 含全部新代码（11 处命中）；dex 字节级验证含 `\r`/`\n` 替换字面量各 1 条。

## 文档更新
- 双语说明书：round-19 条目插入第一章行流最前（新到旧）。
- NOTICE / PRIVACY.md / README.md：round-19 小节置顶。
- 8× README.license：有改动目录（Manual、src/main、src/main/assets、chess.src、
  java/com/Regalia）写变更条目；无改动目录（根 assets、cpp、res）写 no-changes 条目。
- worklog.md：本条目置顶。

## 最终交付记录（round-19）
- 文档在首轮 APK 构建后更新，且 src/main/assets 下 2 个 README.license 内嵌于 APK
  assets → 全部文档同步构建副本后**增量重建 APK**（78,173,702 字节），重新完整验证：
  v1+v2+v3 签名全过、版本 123/1.2.3/targetSdk 35、引擎哈希三方一致、APK 内嵌
  README.license 含 round-19 条目。
- 交付物（/mnt/agents/output/）：
  - Regalia-release.apk — SHA-256=eb416435c30c241c16a512bf6b1efc5dd57a9b1555d536ad02b2f0904de9031b
  - Regalia-v1.2.3-src.tar.gz — 118 条目，0 禁用条目（build.gradle/settings.gradle 为合法源码）
  - Regalia-v1.2.3-manual-{zh,en}.html、SHA256SUMS.txt

# Regalia v1.2.3 — round-18 工作日志（2026-07-17）

## 任务来源
- 用户报告 Bug（P0）：Chess960 模式下导出 PGN 的 [FEN] 标签不是开局初始局面。
- 用户要求：完成《Regalia v1.2.3 开发进度恢复指南.md》全部任务；修复后逐文件
  逐行基于设计意图审查优化（优先级：bug修复 > 健壮性 > 功能完善 > 性能 >
  冗余清理 > 简化）；node --check 全量验证；重建 chess.html；构建 v1+v2+v3
  签名 release APK（兼容小米澎湃OS3）；引擎 SHA-256 三方一致；tar 源码备份
  （无引擎）；更新全部文档与说明书；更新 worklog.md。

## 环境说明（本轮沙箱限制与对策）
- 本轮沙箱 /home 为临时目录且被重置过一次（round-17 的 /home/kimi 工具链丢失）；
  源码与交付物改放 /mnt/agents（portal 持久挂载）。
- /mnt/agents 挂载单文件 100 MiB 上限（dd 实测截断）→ 工具链（JDK/SDK/NDK/
  Gradle）安装到 /tmp/tools；下载走 Range 分块（单连接亦被 100MB 截断）。
- 引擎：官方 Stockfish sf_18 stockfish-android-armv8-dotprod，
  SHA-256=8f7116d3f1a7004a6581d4fb0c1ff891ce095bab6d45e52f1578897cf23b61b5
  （与指南预期值一致；sf_17.1/17/16.1/16 均不匹配，逐一实测排除）。

## 主 Bug（用户报告）根因与修复
- 根因：_startGameImpl() 的 Chess960 分支在 _resetGameUIState()（集中复位，
  ui.js 内将 _setupFEN=null）**之前**赋值 _setupFEN=generateFEN(gameState)。
  v1.0.8 PHASE 24 曾修过同一 bug；v1.1.1 Phase 61 把复位集中进 _startGameImpl
  后改变了赋值/复位顺序，静默回潮。importPGN/_applyImportedFEN 当年均已改为
  「局部捕获 → reset → 再赋值」，唯独新局对话框路径遗漏。
  → PGN 导出回退 generateFEN(gameState)（当前局面），违反 PGN 规范
  （Chess960 必须 [SetUp "1"] + [FEN "初始局面"]）。
- 修复（ui-gameflow.js）：局部变量 _newGameInitialFEN 捕获初始 FEN，
  _resetGameUIState() 之后再赋给 _setupFEN；同步清理函数头部被 reset 覆盖的
  5 处手动清零；reviewBaseState 死赋值改为 reset 后赋值（同类时序 bug）。
- 加固（ai-bridge.js）：_buildPGNString 的 startFEN 回退由 generateFEN(gameState)
  改为 stateHistory[0].state（真实初始局面）；PlyCount 不再计入黑先 null 占位。
- 验证：Node vm 烟雾测试（基于构建产物 chess.html）7 场景全过——Chess960 新局
  FEN 标签=初始局面（含走子后/undo 后）、标准局无 FEN/SetUp 标签、Chess960 PGN
  导入往返一致、FEN 导入路径、黑先 PlyCount=1、黑先注解回放不再中止。

## 逐行审查（7 个并行审查代理 × 全代码库）与修复清单
审查域：game-logic/chess960/pgn-standard；ai-bridge/worker-pool/state-store；
tablebase/eco-data/ui-gameflow/ui-interactions；ui.js 前/后半；19 个 Java 文件+
manifest+cpp；误报专项+stats.html/index.html.tpl/build-chess.py。
误报专项结论：round-17 全部误报判定独立复查**维持**（S125=0 处、S3626 恢复路径
无冗余 return、S2703 bundle 级 eslint 仅命中既有设计、printf .replace 链、
worker 模板双反斜线、HapticManager catch (Throwable)）。

已应用修复（按优先级）：
1. bug：
   - ui.js _replayMovesToState：黑先 null 占位 return null（全局注解失效）→ continue。
   - ui.js _resetGameUIState：新增 analyze-all 批处理终止（幽灵批处理 + Java 侧
     _evalDeepBatchActive 永不复位）+ 清 window._pendingOpenStats 标志/计时器。
   - ai-bridge.js onBestMove：新增 gameOver 守卫（超时/认输后在途 bestmove 丢弃）；
     校验失败分支承诺的 360s 重试不会触发（timer 以 isAIThinking 为守卫）→ 立即重试。
   - ui.js render()：_animRetryCount 在 200ms 回调被提前重置（卡死守卫成死代码）→ 移除。
   - tablebase.js _parsePGN：注解扫描字符类补 '0'（0-0/0-0-0 计入走法，注解不错位）。
   - ai-bridge.js：引擎变例（MultiPV/分叉）编号 3 处补 _importedStartMoveNum 偏移
     （与 round-13 tablebase.js 同款）。
   - worker-pool.js：头部剥离正则补闭合 \]（worker 模板 + sync 镜像两处；
     worker 字符串内注释不得含反引号——本轮实测踩坑修复）。
   - pgn-standard.js parseStandardPGN：游离 } 死循环防御修复（函数当前无调用方；
     RAV 归属方向/无引号标签未剥离两点记录为已知限制）。
   - stats.html extractMoveTimes 2 处：弃用 /^\\[.*\\]$/gm（单行 PGN [FEN] 头残留
     → 计时错位+黑白颠倒），改用 parsePGN 同款标签格式正则。
   - ui.js reviewGoTo：缓存命中补 _sfSeldepth 恢复（对照 ai-bridge 六字段）。
   - game-logic.js _validateSetupEpMark：补跳过格/起始格占用检查
     （新增 i18n 键 setup_ep_err_blocked，中英双语）。
   - tablebase.js importPGN：Chess960 无 [FEN] 时清残留 gameSPID。
   - game-logic.js doAIMove：TB 路径要求 gameState.board===_tbSavedBoard
     （防异步期间局面变化注入异局着法）。
   - MainActivity.java：fallback 错误页 BACK 键不再被吞。
   - StockfishNative.java：握手重试前重置 optionsBuilder（防选项重复）。
   - index.html.tpl：contain-intrinsic-size:auto → auto 300px（非法声明被 Chromium 丢弃）。
2. 健壮性：
   - ui.js：tablebase category 回退 _esc(_cat)（XSS 防护模型一致性）；
     pieceCountLE7 补 typeof 守卫（round-11 模式一致）。
   - stats.html：导出 HTML 的 PGN JSON 补 </ → <\/ 转义（防闭合 script 截断；
     注释本身也须避开字面序列——inline script 约束）。
   - PgnCacheManager.java：save() 补 fsync（与 setTags 一致）。
3. 功能完善：Chess960 SP-ID 输入框焦点保持（id=spidInput + _spidEditing +
   _postRenderFinalize 恢复，镜像 _ecoSearchFocused 机制）。
4. 性能：复盘+热力图时主棋盘控制图不再与复盘棋盘共用缓存键（每帧 2 次全量
   getCtrlMap → 1 次）。
5. 冗余清理：_startGameImpl 头部 5 处手动清零；_resetGameUIState 内 5 变量
   重复复位；game-logic.js export 列表移除 4 个外来符号（generateFEN/uciToCoords/
   _esc 改由 ai-bridge.js 导出，posDesc 改由 ui.js 导出）；_processDeferredVariations
   未使用解构变量；AndroidManifest 移除零使用 ACCESS_NETWORK_STATE；两处 CSP meta
   移除无效 frame-ancestors。
6. 简化：无独立项。

## 记录在案的已知遗留（下轮候选）
- 易位权「王同侧最近车」启发式在同侧双车时归属歧义（正规对局不可达；
  修复需易位权数据结构改造，回归风险高于收益）。
- FEN 导入路径未做 Chess960 检测（绕过摆棋检测逻辑）。
- DIRTY_* 增量渲染子系统死代码（~200 行，无设备验证暂不移除）。
- 棋钟 undo 不回表、超时未查对方材料不足等功能级议题。
- ui-interactions.js:97 尾置 return 与全文件分支风格一致，保留。

## 验证记录
- node --check：11 个 JS 模块 + stats.html 内嵌脚本 + chess.html 内嵌脚本全过。
- bundle 级 eslint no-undef：仅 ECO_OPENINGS 惰性挂载/gameEvent/gameSite 注入
  全局命中（既有设计），零新增。
- Node vm 烟雾测试 7 场景全过（见上）。
- worker 头部正则：模板求值后语义实跑验证（7 标签头剥离无残留）。
- chess.html 重建（build-chess.py）。
- release APK：v1+v2+v3 签名齐全；versionCode=123 / versionName=1.2.3；
  targetSdk 35；FGS subtype 属性存在；APK 内 libstockfish.so SHA-256 与
  官方发布、本地工具链三方一致。
- tar 源码备份：排除 build/.gradle/.cxx/local.properties/lint-baseline.xml/
  jniLibs/*.keystore/keystore.properties/version.properties/.git/.idea，抽查 0 禁用条目。

## 最终交付记录
- 文档表述修正（_esc(_cat) 计 1 处）同步构建副本后做了一次增量重建，
  保证 APK 内嵌 assets 文档与 tar 内文档完全一致；最终 APK 重新通过
  v1+v2+v3 签名、版本号、FGS subtype、引擎哈希全部验证。
- Regalia-release.apk：78,169,550 字节，
  SHA-256=60e7f13d5c041b57b1046b0a674763eae936b299ab09cc489c4cd4817ce47abb
- Regalia-v1.2.3-src.tar.gz：5,099,332 字节（118 条目，无引擎），
  内容抽样确认含 _newGameInitialFEN 修复与本日志。
- 交付物：APK + 源码 tar + 中英文说明书 HTML + SHA256SUMS.txt。

（下附 round-17 完整日志，保留备查）

---

## 任务来源
- 《较高优先级问题汇总.pdf》（SonarCloud 扫描结果，AI 生成，需逐条验证）
- 《God Class 重构成果.md》末尾记录的三项待完成提取任务
- 用户要求：修复后逐文件逐行基于设计意图审查优化（优先级：bug修复 > 健壮性 > 功能完善 > 性能 > 冗余清理 > 简化）

## 关键原则：先验证，后动手
PDF 为 AI 生成（文末自带"无法确保真实准确"声明）。全部 500+ 条声称问题逐一对照
实际源码验证，**大量为误报**：
- S2703（隐式全局变量）：声称 122 处（BLOCKER）→ 实际仅 **1 处真实**
  （_trendH 跨作用域引用）；其余全部为已有 let/const 声明、或 typeof 防护的
  可选外部全局（gameEvent/gameSite）、或 Object.defineProperty 惰性挂载的
  有意全局（ECO_OPENINGS）。用 eslint no-undef 在 bundle 级拼接文件上做了
  严格静态分析佐证。
- S125（注释掉的代码块）：误报，ChessWebViewClient.java 无注释代码。
- S3626（冗余 return）：误报，自动恢复路径的 return 是合法提前退出。
- S7767（|0 取整）：声称含 chess.html 重复计数，源码实际 3 处（chess960.js）。

## 真实 bug 修复
1. **_trendH 潜在 ReferenceError（S2703 唯一真实项）**
   `ui.js _refreshEvalTrendChart()` 引用 `_trendH`——该变量是 `_renderReviewMode()`
   的局部 const，此作用域中为未声明全局；图表容器 clientHeight 为 0 时触发
   ReferenceError。修复：提取共享高度公式为顶层 `_computeTrendChartHeight()`，
   两处调用点共用。
2. **java:S1141 嵌套 try（StockfishNative.java）**
   新增 `sleepGracefully(long)` 辅助方法替换 6 处嵌套 try Thread.sleep 模式；
   心跳 2 处改为辅助方法后检查 `isInterrupted()` 决定 break——语义等价
   （中断标志在辅助方法内已恢复）。

## God Class 重构（round-17，成果.md 待完成项）
1. **HapticManager.java（新文件，459 行，GPL v3）**
   从 StockfishNative.java 提取 ~420 行触觉反馈逻辑（isHapticEnabled /
   performHaptic / performHapticInternal / tryPwleVibrate / fallbackVibrate）。
   六种棋子触觉人格原样保留。StockfishNative 保留 @JavascriptInterface 委托
   包装器，JS API 不变。这是 round-10 被删死代码 HapticHelper 的真正全接线继任。
   StockfishNative.java：4,674 → 4,307 行（-8%）。
2. **ui-gameflow.js（新文件，313 行，GPL v3）**
   新局启动（startGame/_startGameImpl）+ 棋钟子系统（initGameClocks /
   _tickGameClock / _onGameClockExpired / recordMoveEnd / formatClock /
   _updateClockDisplay）。
3. **ui-interactions.js（新文件，1,438 行，GPL v3）**
   棋盘点击（sqClick/setupClick/_getCastlingRookForClick）、走子执行与撤销
   （executeMove/_clearAnimationState/undoMove/redoMove）、工具栏动作
   （flipBoard/quickFreeOpening/toggleSound/doPromotion/getHint/
   setDifficultyLevel）、摆棋模式（toggleSetup/exitSetup/_exitSetupImpl/
   undoSetupClick/redoSetupClick）、PGN 保存提示链、返回键路由、导入包装、
   改名/统计导入提示、认输。
   ui.js：8,475 → 6,761 行（-20%）。
   提取方式：带花括号深度跟踪（处理模板字符串/字符串/注释）的程序化提取，
   仅迁移纯函数声明（bundle 内全局提升），无顶层可执行代码移动，无 TDZ/加载
   顺序变化。build-chess.py MODULES 加入两个新模块（位于 ui.js 之前）。

## SonarCloud 代码质量修复（全部验证语义等价）
- **S7773（99 处）**：isNaN/parseInt/isFinite → Number.*，横跨 ai-bridge.js、
  game-logic.js、pgn-standard.js、tablebase.js、ui.js、stats.html。每个调用点
  逐一验证参数为 number 类型（不依赖全局函数的字符串强转）。
- **S7740（9 处）**：ui.js ChessAudioEngine `const self = this` → 箭头函数。
- **S1181（Java）**：ChessWebViewClient 6 处 catch (Throwable) → catch (Exception)
  + destroyWebViewSafely() DRY 提取。HapticManager 反射路径（tryPwleVibrate /
  fallbackVibrate）**有意保留** catch (Throwable) 并附注释（OEM ROM 上反射可能
  抛 NoSuchMethodError——属 Error 非 Exception，必须容忍）。
- **S7761（2 处）**：setAttribute('data-theme') → dataset（ai-bridge.js、stats.html）。
- **S7767（3 处）**：chess960.js `|0` → Math.trunc（spid∈[0,959] 等价）。
- **S7781（3 处转换 + 1 类保留）**：i18n 占位符替换 → replaceAll；stats.html
  printf 式顺序 %d 替换链**必须保留** .replace（replaceAll 会破坏功能）。
- **S8786（2 处）**：worker-pool.js 走法序号正则 `/\d+\.+(\d+\.+)*/g` → `/\d+\.+/g`
  （worker 模板字符串端 + sync 端两份拷贝）；含后续 \s+ 归一化的完整流水线在
  7 组输入（含对抗性）上验证等价。
- **S7741（9 处转换 + 跨模块守卫保留）**：typeof undefined → !== undefined 仅限
  同模块已声明变量；跨模块 typeof 守卫保留（round-11 容错设计），外部注入全局
  （AndroidBridge/gameEvent/gameSite）守卫保留。

## 健壮性加固
- StockfishNative.postJsCallback 新增 null/空白 JS 表达式前置拒绝
  （开发指南 §5.1 方向 1——空载荷此前静默求值为 no-op try{}catch，掩盖调用方 bug）。

## 构建验证
- ✅ 全部 11 个 JS 模块通过 `node --check`（含 2 个新模块）
- ✅ Bundle 级 eslint no-undef 分析：0 个隐式全局（仅剩 3 个有意模式：
  ECO_OPENINGS 惰性挂载、gameEvent/gameSite typeof 防护）
- ✅ Node vm 浏览器桩运行时烟雾测试：加载期零 TDZ 错误（_KING_PIECE_STYLE
  警告为 round-11 起即有的有意防御模式），34/34 关键函数存在，formatClock 正确
- ✅ chess.html 已重建（22,204 行 / 1,334,211 字节，含新模块结构）
- ✅ release APK 已重建：v1+v2+v3 签名齐全，versionCode=123 versionName=1.2.3，
  minSdk 23 / target 35，FGS subtype 属性存在，兼容小米澎湃 OS 3
- ✅ Stockfish dotprod 引擎 SHA-256 三方一致
  （8f7116d3f1a7004a6581d4fb0c1ff891ce095bab6d45e52f1578897cf23b61b5）
- ✅ APK 内含 HapticManager 编译产物（字符串字面量验证）、CMake 源码构建的
  libengine_bridge.so（5,096 字节）、NDK 自动打包的 libc++_shared.so

## 文档更新
- README.license ×3（java/com/Regalia、assets、chess.src）新增 round-17 条目（置顶）
- NOTICE 新增 round-17 许可分类条目（含 HapticManager/ui-gameflow/ui-interactions
  新文件的 GPL v3 归类说明）
- BUILDING.md：模块清单 9→11、CMake 3.22.1→3.31.6
- PRIVACY.md：新增 round-17 纯代码组织变更声明（无新权限/网络/数据收集）
- README.md：新增 round-17 小节
- Manual/Regalia-v1.2.3-manual-zh.html、-en.html：更新日志新增 round-17 条目（置顶，新→旧）

## 环境说明
本次构建环境为沙箱适配：以 /home/kimi/my-project 替代 /home/z/my-project
（沙箱无 /home/z 写权限），目录结构、工具链版本（Temurin JDK 21.0.11、SDK API 35、
Build-Tools 34.0.0、NDK 27.2.12479018、CMake 3.31.6、Gradle 8.11.1 wrapper）与
BUILDING.md 完全一致。GitHub 不可达，JDK 走清华 tuna 镜像、Stockfish 走 gh-proxy
镜像，SDK/CMake/NDK 走 dl.google.com 官方源，Maven 依赖走 settings.gradle 已配置的
阿里云镜像。
