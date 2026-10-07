# round-58c review trail (append-only)
- task: king shake enhancement + full-tree line-by-line first-principles audit
- ai-bridge.js: 5460/5460 lines reviewed, no new findings
- ui.js: 7049/7049 lines reviewed, no new findings
- tablebase.js: 2153/2153 lines reviewed, no new findings
- ui-interactions.js: 1943/1943 lines reviewed, no new findings
- ui-gameflow.js: 530/530 lines reviewed, no new findings
- chess960.js: 734/734 lines reviewed, no new findings
- pgn-standard.js: 679/679 lines reviewed, no new findings
- state-store.js: 506/506 lines reviewed; FIXES: (1) latent bug — SET_CHESS960 `payload.spid || -1` mapped valid SPID 0 (BBQNNRKR) to -1/unset, now `payload.spid != null ? payload.spid : -1`; (2) robustness — ENTER_REVIEW/SET_CHESS960/PGN_LOADED reducers now guard missing payload (Phase-71 precedent). All live dispatch sites verified behavior-preserving (SET_LANG string, TOGGLE_SOUND bool, ENTER_REVIEW object, SETUP_EXIT/PGN_CLEARED no payload use).
- INCIDENT (round-58c): parallel edit_file calls on the same file raced — game-logic.js (king shake + 2 comment fixes) and eco-data.js (2 comment fixes) were silently corrupted (duplicated/interleaved regions; game-logic.js 3586→6325 lines, eco-data.js 197→294). state-store.js lost 2 of 3 edits (last-writer-wins). Detected via node --check (Unexpected token ':' / identifier 'call') + line-count anomaly + diff vs round-58b tar backup. Repaired: restored both files from the 58b backup and re-applied ALL intended edits via a python script with count==1 assertions (verifier/runs/../../../mnt patch — see patch log); state-store.js 2 lost fixes re-applied. Post-repair: all 10 modules pass node --check; the other 7 modules + index.html.tpl verified byte-identical to the 58b backup; diffs for the 3 touched files contain ONLY the intended edits. Lesson: never parallel-edit the same file; always diff against the previous round's backup after edits.
- game-logic.js: 3597/3597 lines reviewed (king shake rewrite verified in place; diff-vs-backup audit confirms no other changes)
- state-store.js: 522/522 lines reviewed; all 3 reducer fixes confirmed in final diff
- eco-data.js: 198/198 lines reviewed; 2 comment fixes confirmed in final diff

### PgnCacheManager.java (468 行) — 全量审查，无新发现
- sanitizeName 预编译正则防目录穿越（round-30 perf）；getCacheDir 缓存 File 句柄避免重复系统调用（round-30）。
- setTags：delete 失败回退空数组写入 + fsync（round-44 E3），两级失败均 Log.w 并如实返回 false，不静默吞。
- copyAndDelete：复制中途失败删除可能截断的 dst（round-46 PR53 CR#25），源文件保留可安全重试。
- evictIfNeeded：LRU 按 lastModified 升序，total 计入 .pgn+.tags.json，删除失败 continue 不中断；best-effort 符合设计。
- getTags 异常返回 "[]" 兜底，JS 侧 JSON.parse 永不炸。catch (Throwable) 为全库既定约定（186 处）。

### StabilizationHelper.java (433 行) — 尾部复核，无新发现
- Rev67 旋转映射符号修正注释完整（四象限第一性原理推导在案）；±8px MAX_DISPLACEMENT_PX 钳制。
- SystemClock.elapsedRealtime() 节流（round-31 防墙钟回拨）；JS_CALLBACK_MIN_INTERVAL_MS 注释已于本轮修正 16→33ms。
- D11 单 Runnable 复用 + volatile 载荷覆盖（transform 是状态量非事件流，覆盖即最新语义）；D12 JS 侧 __stabBwrap 缓存 + isConnected 失效重查。

### EngineService.java (481 行) — 全量审查，无新发现
- wakeLock 三访问器（acquire/refresh/release）全部 static synchronized 类监视器串行化（round-53 S2696），refresh-vs-release 竞态已闭。
- setReferenceCounted(false) 先于字段发布（round-54 PR56 CR#10）——竞态窗口不存在；单次 release 即可释放无论 re-arm 多少次。
- releaseEngineWakeLock 先 null 字段再 release，迟到 refreshWakeLock 自然 no-op。
- isRunning 延迟到 startForeground 成功后置位（round-10 P3）；startForeground 失败 stopSelf + 保持 false（round-49），调用方永不被骗。
- wake lock 路径刻意 catch (Exception) per S1181（PowerManager 仅抛 RuntimeException，Error 必须传播）——与全库 catch (Throwable) 防御约定是两类场景，文档化清楚，不动。
- PREFS_NAME="RegaliaEngine" 与 StockfishNative.saveLangPref 一致（v1.0.2 修复在案）。

### HapticManager.java (546 行) — 全量审查，无新发现
- KING_MOVE haptic 为「四下有节制的重击（威严庄重）」独立设计，与本轮王震屏「玉玺重印」分属 haptic/visual 两通道，用户仅抱怨震屏弱，haptic 通道不动（避免扩大变更面；后的 massive impact 与王的 measured thuds 人格区分是既有设计意图）。
- tryWaveformVibrate 实际走公共 createWaveform API（round-23 Q11+Q17 已替换失效的 PWLE 隐藏反射），注释在案；API<26 返回 false 走 fallback 正确。
- E7 设计债（~300 行 switch 可表驱动化）已文档化，回归面大+无测试覆盖，本轮维持不做（简化让位于健壮性）。
- Application Context 归一化（round-33）、Cache+AtomicReference CAS（round-44 E6）、elapsedRealtime 缓存时钟（round-31）均正确。

### FileIoHelper.java (581 行) — 全量审查，无新发现
- writeTextFile 三重后备 + round-44 D1 错误分类重试（确定性错误立即放弃主路径，瞬时 IOException yield 重试）正确。
- readTextFile 三形态返回契约（内容/null/{"error":...}哨兵）round-56 文档化；1MiB 上限 + 读中二次上限（防竞态增长）正确。
- buildSortedListingResult 声明 throws Throwable 风格粗糙（精确化应为 JSONException），但唯一调用方 listFiles 已 catch (Throwable)，改动签名风险>收益，不动。
- loadAssetAsBase64 逐段路径校验（round-44 D6）、MediaStore LIKE 通配符转义（round-30）均在案。

### EngineConfigHelper.java (722 行) — 全量审查，无新发现
- 所有 setter 边界钳制（Threads≤2×CPU、Hash≤50%堆、MoveOverhead≤1000ms、MultiPV≤8、Skill 0-20、ELO 500-3500）与 Phase 69 UCI 指南一致。
- setGameDifficulty：mid-search 用 fire-and-forget sendUciCommand（避免 readyok 死锁），round-44 C5/C6 torn-pair 快照修复在案（limitEloForJs/eloForJs 局部对）；ELO_MAP 死索引已清（C10）。
- detectBigCoreCount：round-44 C1 基线改最低簇、round-30 MHz 优先于 BogoMIPS、失败不缓存（round-10）均在案；_detectInFlight CAS 去重（C8）正确。
- applySettings 每步握手后复查 isEngineReady；C9 批量 setoption 设计债已标注，跨文件不动。

### StatsActivity.java (923 行) — 全量审查，无新发现
- BACK 决策链完整：onKeyDown→handleBackKeyPress（API<33）/OnBackInvokedCallback（API 33+，round-48 BUG-2）共享同一逻辑；250ms 兜底 + ackStatsBackHandled 回执（round-44 E4 / round-46 CR#26）消「取消被误踢」缺陷。
- onDestroy：回调注销 + 6 步 WebView 拆除 + backFallbackHandler.removeCallbacksAndMessages 清尾。
- PGN 导入：8KB 分块 + MAX_LINES/MAX_CHARS 双上限 + CR/LF/CRLF 行计数折叠（round-49 P2-1 / round-54 CR#8/CR#11）；onStatsPGNFileError 显式失败回调。
- WebView 安全配置与 MainActivity 对齐（禁 file/content access、MIXED_CONTENT_NEVER_ALLOW、filterTouchesWhenObscured）；Chrome 版本门禁复用 MainActivity.extractChromeMajorFromUA/webViewTooOldMessage（round-49 ROB-1，单一事实源）。
- _handleUrlOverride 双签名重载（API 23 兼容）+ 大小写不敏感 scheme 检查，仅放行 file:///android_asset/。

### MainActivity.java (1523 行) — 全量审查，无新发现
- BACK 链：handleBackKeyPress 双入口（onKeyDown/API 33+ callback）+ 250ms ack 兜底（round-49 P3-3）+ _isFallbackMode/ROB-5 假返回路由到系统默认；所有失败路径均有日志。
- WebView 生命周期：Chrome 84 门禁先于 loadUrl（ROB-1）；showFallbackUI 先撤重试再拆 WebView（CR#22/23，B3）；onDestroy 链式拆除 + 500ms 兜底 + runWebViewTeardown 幂等。
- flushAllState 统一刷盘（B1/B7）：pause/stop/userLeaveHint/trimMemory 去重、destroy 强制；BG-1 批量分析时推迟 webView.onPause 并在批次结束时补刀（round-51），design intent 清晰。
- 引擎初始化重试：round-34 修复了 initRetryCount 永不递增导致的不可达分支；重试穷尽后双语 fallback。
- toggleStabilization 与 onDestroy/onResume/onPause 全部经 _stabilizationLock 串行化（round-31/33）。

### StockfishNative.java (5141 行) — 全量审查，无新发现
- bestmove 三路分派并发协议严密：_stopLatchLock 原子捕获-清、_discardFlagLock 原子 check-and-clear（Phase 58/71、round-9 锁错配修复、round-52 T6 状态判别）；info 行双门控（STATE_NONE 早退 + discard 期跳过）防陈旧搜索污染新搜索。
- STATE_EVAL：upperbound/lowerbound 不落地存储分（防 aspiration miss 污染）；批量分析期跳过 restoreGameplayOptions（round-51 BUG-1）；onEngineEval 第 8 参 _lastEvalFen 供 JS 步进身份校验（round-49 T1）。
- 引擎二进制：新鲜提取必经 SHA-256 钉死校验（round-56 SEC-01①，MessageDigest.isEqual 常数时间比较），缓存仅 root 设备加验（SEC-09，省 114MB 哈希开销）；截断残留删除自愈（round-49 P2-2）；ELF 魔数 + MIN_SIZE 双闸。
- 生命周期状态机（round-40 文档化五状态）+ gen-token（round-33/34/35）+ _externalShutdownRequested 中断三分诊（round-40）——restart/shutdown/recover 全部竞态窗口在案封闭。
- postJsCallback 结构化重载：EVENT_NAME_PATTERN 标识符白名单 + JSONArray 编码防注入；onEngineProgress 16ms 节流合并（round-44 A11）。
- 沙箱：write/read 严格 isPathInSandbox，listFiles/getParentPath 用 isPathBrowsable 宽门（round-54 CR#12），getParentPath 对解析结果二次校验（round-55）。
- 持久化：persistentSetSync commit() + persistentFlush 空 commit 刷队列（HyperOS 3 SIGKILL 对策）；saveEvalCacheSync tmp+ATOMIC_MOVE+遗留 tmp 清理（round-17 P1-3）。
- 心跳三连检（线程死亡标记→进程存活→搜索中 zombie，空闲引擎不误判）；recoverEngine 带退避、计数、stale 检测、中断即弃（S2142 修复在案）。

## round-58c 全量审查总结
19 个 Java 文件 + 10 个 JS 模块 + index.html.tpl + build-chess.py 全部逐行审毕。
本轮实际改动：game-logic.js 王震屏签名增强（todo#2 主需求）；state-store.js 三处 reducer 守卫修复（含 SET_CHESS960 SPID-0 静默映射 bug）；eco-data.js 两处注释指向修正；StabilizationHelper.java 一处过时注释（16→33ms）。
其余文件设计意图清晰、既有防御体系完整，按优先级纪律无动。

### chess.src/README.license — round-58b 存量许可证标签误标修复
- 验证器 v3 H2a 红灯：round-58b 条目把 GPL v3 分类的 ai-bridge.js / ui.js / game-logic.js 误标为 (AGPL v3)（分类记录：AGPL v3 = chess960.js, eco-data.js, state-store.js；其余 GPL v3）。
- 三处标签改为 (GPL v3)，v3 恢复 37/37 全绿。属"bug修复"优先级的文档修正。

## round-58c 构建交付验收运行记录（2026-10-06T17:30Z）
- 构建: gradle assembleRelease --offline exit=0 (BUILD SUCCESSFUL in 1m 27s; 两次前置失败已修复: GRADLE_USER_HOME 指向 buildenv/gradle-home、JAVA_HOME 指向 buildenv/jdk17、storepass 解析格式修正)
- 签名: apksigner verify --print-certs → v1/v2/v3=true, v3.1/v4=false(预期), cert SHA-256=45bc6d36...d8bc ✓
- 版本: aapt2 dump badging → versionCode=10203 versionName=1.2.3 ✓
- bundle: sha256(APK内chess.html)=sha256(src bundle)=b9bf9ea0...83eb, 24132行/1483663字节 ✓ (wc -l 24131 因末行无换行)
- 引擎: sha256(libstockfish.so)=8f7116d3...61b5 钉死值 ✓
- tar: 排除清单 grep 命中数=0; tar 内 chess.html 哈希与源码一致; 共194项 ✓
- 交付: /mnt/agents/output/Regalia-v1.2.3-round58c-release.apk (78304342B) + Regalia-v1.2.3-round58c-源代码备份.tar.gz (5495316B)
