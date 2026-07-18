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
