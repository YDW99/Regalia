# Regalia 隐蔽 bug 发现与修复工程方法论

> 抽取自《Regalia v1.2.3 开发进度恢复指南Pro》§5（round-60 实例化定稿；round-61 基线同步；round-62 行级出处扩写）。
> 每条原则配 round 真实案例与代码出处（**file + 函数名锚定**；行号以 round-62 基线标注——按 §6.2 #6「行号引用即谎言」，跨轮引用时以锚定特征为准）。
> 本文件随源码树归档，验证器三件套为其执行工具。

## 1. 为什么本项目的 bug 隐蔽（问题域特征）

1. **三进程四线程的因果断裂**：JS 主线程（WebView）⇄ Java 绑定线程（@JavascriptInterface）⇄ 引擎命令执行线程 ⇄ 引擎 stdout 读取线程。一次"点选步骤分析"跨越四个执行域，任何一处的"好心"防御都可能成为另一域的凶手（round-58 幽灵状态、58b 重复派发皆是跨域误判）。
   - **round-60 补充的第五种域：装载形态语义差**。同一份代码在源模块模式（多个 `<script>`）与打包模式（单脚本 bundle）下语义不同——`typeof` 守卫对未声明变量返回 `'undefined'`，但对同一脚本内后续 `const` 的暂时性死区（TDZ）**抛 ReferenceError**（F-1）。
   - **出处（round-62 基线）**：TDZ 现场在 `ai-bridge.js` 顶层 `_showLoadingOverlay()` 调用与 `ui.js` 的 `const _KING_PIECE_STYLE`；修复把常量上移 `game-logic.js:634`（`const _KING_PIECE_STYLE={`，打包首模块）；哨兵 V2-20（`verifier/v2/round53-sonar-triage.js`）+ V1-30（`verifier/v1/eval-stale-harness.js`，bundle 求值期 warn 捕获）。
2. **防御机制自身的副作用**：本项目大量 bug 不是功能没写，而是**修复过的修复**——安全定时器杀健康搜索（57）、恢复机制重置失败计数（57c）、防陈旧检查误丢好成果（58b Bug E）、预置状态被误读为在途（58）。**每一道防线都要问：它误伤谁？** F-1 的 try/catch + 逐值相同的回退副本是"好心的防御"把缺陷消音的典型：没有 catch，这条 ReferenceError 每次启动都会炸醒所有人。防御越周到，故障越安静。
   - **出处**：57 进度感知重置——`ai-bridge.js` `onEngineProgress`（`onEngineProgress(depth,nodes,nps,...)` 入口，round-62 基线 3037 行）；57c 墙上时钟终结器——`ui.js` `_batchWallClockExceeded()`（5740 行）与 `_reviewAnalyzeResetSafetyTimer()`（5763 行）；58 幽灵 STATE_EVAL——`StockfishNative.java` `engineEvalDeep(final String fen)`（1308 行，真实发 `go depth 22` 前一刻自设状态）；58b Bug E 救援——`ai-bridge.js` `_cacheStaleReviewEvalByFen()`（3281 行）与 onEngineEval 的 gen 不匹配但 fen 匹配分支（3494 行起）。
3. **静默吞食**：bestmove 被 latch/丢弃标志吞掉时没有任何日志上屏，JS 侧表现=死等。隐蔽 bug 的第一形态是"什么都没发生"——F-1 的第二形态是"只发生一行 warn"。
   - **出处**：round-52 T6 预言注释与 `_discardingPonderBestmove` 武装逻辑——`StockfishNative.java` `stopAndWaitForBestmove`；round-58 逐字应验——`engineEvalDeepEndBatch()`（1407 行）的 `searchMaybeInFlight` 守卫（1474-1478 行）。
4. **用户行为是放大器**：UI 无生命迹象 ⇒ 用户重复操作 ⇒ 重复操作触发更深的 bug（58b 的 C+A 耦合）。UI 反馈缺失本身应被当作 bug 源头来审查。
   - **出处**：58b Bug C 同局面在飞去重——`ai-bridge.js` `requestEngineEval()` 的去重分支（4975-4986 行：`reviewMode&&_evalLoading&&_evalSafetyTimerId&&_evalLastDispatchedGen===_evalRequestGen` + fen 一致 ⇒ 仅重申分析中）；Bug A 手动单步进度条门控——`ai-bridge.js:3131` `const _manualLive=(!_batchLive&&_evalLoading&&...&&_reviewEvalRequestedStep===reviewStep)`。round-62 起两者有行为级/结构级哨兵（v1 场景 S58-C/S58-D0，v2 V2-22）。

## 2. 发现方法论（八路侦察）

1. **现象精确化**：把"卡住"逼问成可复现的时序——"停多久？有无 Toast？第几步？之后是否恢复？"round-58 的根因就是用户描述的精确波形直接对应丢弃标志的状态轨迹。问不清波形就用 ask_user 给选项。**当无法问用户时，让数学当用户**（round-59 谐振模型逐系数独立复算）。
   - **出处**：round-59 阻尼谐振 `_ringKfs`（`y(τ)=A·e^(−d·τ)·cos(2πf·τ)`，四分之一周期采样、0.08px 感知阈收束、48 帧硬上限）——`game-logic.js` 六棋子余震尾生成；round-60 王首峰 −7px 序列经 Python 独立复算一致（见 worklog round-60 节）。
2. **跨层因果链推演（第一性原理走查）**：从用户可观测点出发，沿 请求→队列→引擎命令→stdout→回调→缓存→DOM 全链路逐跳问"这一跳谁可能吞掉/延迟/错配？"每跳写下假设与证伪手段。57/58/58b 三次根因全部由此法命中。
3. **代码预言挖掘**：搜索注释中的警告性语句（"would silently eat…"、"never completes until…"）——round-52 的 T6 注释逐字预言了 round-58 的故障链。**推论：catch 块里的 warn/error 与警告性注释同等对待，逐条分诊**（F-1 的 `console.warn` 就是当年作者埋下却没被读的未爆弹地图）。
   - **出处**：F-1 warn 现场——`ai-bridge.js` 顶层装载路径（V1-30 在 v1 harness 内捕获 `before initialization` 关键词硬失败）。
4. **对称性审查**：修了一条路径，立刻枚举它的对称面——批量⇄手动单步（58b）、beginBatch⇄endBatch（58）、正常路径⇄stale/错误/重启/恢复四条边路径（58b Bug F）、写入点⇄所有读取点；文档对称面同样适用：手册 zh/en、指南 vs 手册 vs Manifest（F-2 命中于此）。
   - **出处**：58b Bug F 清偿配对——`ai-bridge.js` `onEngineRestarting()`/`onEngineReady()` 各含 `if(_evalLoading){_evalLoading=false` + `if(_evalSafetyTimerId){clearTimeout...` 成对（2594-2598 / 2650-2654 行）；onEngineEval 三条出口分支（救援 3502、stale 缓存 3541、正常 3572）同配对。哨兵 V2-23a/b/c。
5. **生命周期配对审计**：每个状态变量列三问——**谁置位？谁清偿？什么路径会跳过清偿？** `_evalLoading`、`_evalSafetyTimerId`、`_discardingPonderBestmove`、`_stopLatch`、`_evalRequestBatchGen` 各有 5+ 个写者，漏清偿即泄漏。
   - **实例（R61-d，round-61）**：`engineEvalDeepEndBatch()` 的 `if (!engineReady) return;` 早退把门后与引擎无关的副作用（round-51 BG-1 延迟的 `webView.onPause()` 通知派发）连坐跳过——`StockfishNative.java:1407` 起；修复把通知块上移门控之前；哨兵 V2-21（行锚定正则，见本节第 8 条与 §3 军规 3）。
6. **并发/时序压力想象**：对每个锁与每个异步回调问"若两个执行者在此交错半步？"——TOCTOU（latch 所有权、丢弃标志 check-and-clear）、gen 代数被非派发路径递增（58b Bug E）、回调到达时世界已变。想象力的产出要分诊：真问题（F-3 的 stop→start 窗口）标注可达性后再决定修不修，假问题（N-1 键类型竞态）记录证伪过程。
   - **实例（R61-c，round-61）**："有活性但无进展"挂起：进度 tick 不断重置 60s 静默定时器 ⇒ 住在其触发处理器里的 180s 墙钟检查永不到达——`ui.js` 修复提取 `_batchWallClockExceeded()`（5740 行）双点调用（`_reviewAnalyzeResetSafetyTimer()` 入口 + 原 60s 处理器内）。**教训升格（§6.2 #14）：总时长终结器不得住在静默定时器处理器里；两个时钟独立计量，活性信号不得否决整批看门狗。** 哨兵 v1 场景 R61（四断言）。
7. **负空间测试（验证器补盲）**：现有验证器测"期望的行为"，隐蔽 bug 住在"没人测的行为"。F-1 的存在反证了"结构验证器测不到装载期 TDZ"——据此新增 V1-30/V2-20/V3-38。**记录"查过没问题"与记录"查出问题"同样值钱**（负空间记录防止未来轮次重复排查）。
   - **出处**：负空间轨迹 `verifier/runs/round58c/59/60/61-audit.md`（append-only）。
8. **验证器输出噪声分诊（round-60 新增）**：三件套输出中的任何非 PASS/非预期行，要么当轮修复、要么在审计文件中显式豁免并写明理由；禁止"下次再看"。F-1 在 v1 输出里躺了至少 7 轮（harness 建于 round-52），是这条规则的完整反面案例。
   - **round-61 实例化两条新维度**：
     - **哨兵字面量不得在注释中原样复写**：V2-21 初版 indexOf 定位被 R61-d 修复注释里原文引用的门控行抢先命中（误报）——**行锚定正则（`\n\s*…`）是结构哨兵的默认姿势**；修复注释引用旧代码时改述，不复写原文（§6.2 #17）。
     - **哨兵单向性**：H2b 只扫"GPL 类被误标 AGPL"，反向漏检；H2f 补齐，且 round-61 新台账条目自己同向误标被 H2b 当场抓获——**每个"不得误标"检查都枚举反方向，且新条目写完立即跑双向哨兵，不等收尾**（§6.2 #12/#18）。出处：`verifier/v3/round54-pr56-triage.js` H2b（186 行）/H2f（216 行）。
   - **round-62 实例化（负例测试纪律）**：每条新哨兵必须证明"在旧代码上会变红"——round-62 六哨兵（v1 S58 ×10 断言、v2 V2-22/23/24）逐条做了回归变异负例（把修复改回旧行为 ⇒ 哨兵 RED，恢复 ⇒ GREEN；轨迹入 `verifier/runs/round62-audit.md`）。G7 消重迁移同步案例：逻辑移入 FileIoHelper 后原 G7a/G7b 变红，哨兵按军规 3 更新为"唯一实现处 + 三调用方接线"双守护，并对"调用方回退朴素读取"做负例 RED 验证。
   - **round-63 实例化（守护者的守护者也要过军规）**：负例测试脚本自身 fail-open 被外部评审（PR #57 CodeRabbit）抓出四条，逐条属实：退出码失真（`node … | tail -1` 返回 tail 的 0——perl 表达式失配后脚本会打印 mutated=no 然后以 0 宣布通过，六哨兵裸奔无人知晓）、路径硬编码（/home/ 绝对路径——异机运行备份失败；该路径恰好存在时会变异并验证另一个检出）、变异不可恢复（无 trap——SIGTERM 中断后工作区留下故意注入的回归；固定 /tmp 备份路径并发互踩）、文档指向失真（台账引用不存在的沙箱路径）。四条全部是 §6.2 #13「fail-open 验证器等于没有验证器」在元层的重演——负向测试脚本是"守护者的守护者"，它自己 fail-open 比哨兵缺失更隐蔽。修法四条：路径自解析（BASH_SOURCE）、mktemp 独占备份 + EXIT/INT/TERM trap、失败累计器 + `set -o pipefail` 真实退出码、台账指向已提交路径；防回潮：v3 V3-39 结构哨兵把四条纪律永久化（负空间测试标准动作：本轮手工发现 → 永久哨兵）。**元纪律：负例脚本必须能证明自己会失败**——round-63 元负例三连测（故意改坏 perl 表达式 ⇒ 修复版 exit 1 / 原版 A/B 对照 exit 0 缺陷现场 / SIGTERM 中断 ⇒ trap 恢复 + 143）即此纪律的执行形态；另：脚本副本放到其它目录深度会解析到错误根并以 1 退出（fail-closed，不会静默验证错误的树）。
   - **round-64 实例化（防御机制自身的副作用 + 哨兵也要被负向验证——三轮评审的同构递归闭环）**：round-63 加固自身引入两条**数据丢失路径**（§1.2「防御机制自身的副作用」的 shell 版）：初始备份 `cp` 裸跑（tmpfs 满/源不可读 ⇒ 空备份 ⇒ 后续所有恢复用坏备份覆盖 ai-bridge.js，运行前内容连同未提交修改永久丢失——"恢复保证"本身就是销毁向量）与 `restore()` 无条件删备份（cp 失败仍 `rm -f` 唯一副本 + `2>/dev/null` 吞诊断 + EXIT trap 不传播失败 ⇒ 恢复失败仍 exit 0）。同轮 V3-39 被发现两处绕过：trap 正则可被空处理器满足（`trap '' EXIT` 照样匹配——`[^']*` 允许零字符）、`includes('mktemp')` 被脚本自己的头注释 "exclusive mktemp backup" 满足（**删实现留注释，哨兵照绿——活体绕过而非假设**，§6.2 #17 第三次重演，这次在元哨兵身上）。修法：备份/恢复全链 `cp + cmp -s` 字节复核（失败保留备份 + 打印路径 + 非零退出；幂等 restore 使信号→EXIT 双调用不误报）；V3-39 从"字面量存在性"升级为"**实现行存在性**"（全部子句行锚定 `^…/m`，`[^#\n]*` 前缀永不匹配注释行；trap 正则要求 handler 体内含 `restore`）。**硬约束升格（入指南 §7）：任何新增哨兵（含守护脚本的元哨兵）当轮必须 RED-verified，负向用例必须覆盖"声明存在但实现为空 / 被注释替代"两类绕过**——这是军规 4 对称性审查的完整闭环：修了脚本 → 给脚本加哨兵 → 哨兵自己也要被负向验证。round-64 二十五断言元负例套件（备份失败前中止 / 恢复失败保备份 / SIGINT 130 双调用不误报 / 空处理器 RED / 删实现留注释 RED + 旧检查 A/B 绕过现场）即此约束的执行形态。附带环境坑入档：非交互 shell 后台作业（`&` + job control 关）被 POSIX 异步列表规则设 SIGINT=SIG_IGN，bash 拒绝 trap 启动时被忽略的信号——`script & kill -INT` 永远到不了 INT trap（测试静默通过的陷阱；setsid 无效，`set -m` 解）；SIGTERM 不受此限。

## 3. 修复方法论（六条军规）

1. **治本优先，UI 不动**：能修根因不加界面创可贴（round-57 用户明确选"只修①治本，不动界面"）。F-1 三方案中选"常量上移到首模块"（治本：单一事实源真正成为事实源），不选"文档化双源"（创可贴）。
   - **出处**：`game-logic.js:634`（上移后的 `const _KING_PIECE_STYLE={`）。
2. **最小侵入、不引入冗余**：优先复用既有机制（58b 的环缓存助手由既有 T5 逻辑抽出）。删除冗余代码本身是修复。
   - **round-62 实例（消重）**：SafPickerHelper 导出/导入选择器两对逐行重复块（`openExportFilePicker`/`openPGNExportFilePicker`、`openSystemFilePicker`/`openPGNFilePicker`）合并为 `openCreateDocumentPicker`/`openOpenDocumentPicker` 单实现 + 参数化薄壳；8KB 分块读循环三份拷贝（SafPickerHelper ×2 + StatsActivity）收敛为 `FileIoHelper.readCappedText()` 单实现（`FileIoHelper.java`，round-62 基线 617 行起）；**防回潮哨兵 V2-25**（CREATE_DOCUMENT/OPEN_DOCUMENT 启动块各恰好 1 处、`char[8192]` 循环只在 FileIoHelper）。
3. **修复不得破坏既有哨兵**：验证器用结构字符串做哨兵——重构提取函数时保留关键标识符命名（58b 的 `_cbFenNav` 形参命名案例；F-1 修复保留 `_KING_PIECE_STYLE` 原名）；重构移动代码位置时**当轮同步迁移哨兵并重做负例**（round-62 G7a/G7b 随消重迁移至 FileIoHelper 锚点并负例验证——哨兵是活的契约，不是化石）。
4. **有界恢复**：任何自动重试必须有显式上界与"谁重置计数"的说明（`_manualEvalAutoRetries` 只在用户导航派发时清零；对照 57c：恢复路径重置失败计数制造了无限循环）。F-3 选择"注释文档化 + 依赖 onEngineReady 自愈"而非引入新锁，正是该教训的正面应用。
   - **出处**：`ai-bridge.js:603`（`let _manualEvalAutoRetries=0`）、613 行 `_armEvalSafetyTimer(isReview)`（真静默测量 + `_manualEvalAutoRetries<1` 有界重派 + 重试路径不复位预算）、5056 行（**唯一**复位点：新鲜用户导航派发）。哨兵 v1 S58-D1/D2/D3。
5. **状态真实化**：宁可显示"等待中"也不要伪造"分析中"——去重判据、看门狗、进度门控全部依赖 `_evalLoading` 的真实语义。真实化也针对文档与死代码：F-1 修复后执行路径与代码意图首次一致；F-2 修复后指南陈述与 Manifest 一致。**round-61 深化：指标真实化三不**——不排除手写文件、不调质量门阈值、不稀释分母；合法排除仅限生成物（如 chess.html 打包产物）且注明理由（§3.9 / §6.2 #21）。**round-62 深化：指标过线 ≠ 债务消除**——PR #56 合并后主分支重复率 2.9%<3 过线源于统计窗口变化，重复块原样仍在；round-62 把最大三组实体重复真正删除（见军规 2），其余（StockfishNative 五组、ui.js 两组）保留为显式待办。
   - **出处**：StockfishNative 重复对（round-62 基线行号，供后续轮次定位）：`engineGoInternal`/`engineGoTimed`（1084/1161 一带，最大组 ~90 行）、2763/2818、4793/4905、4709/4842、912/1272；ui.js 4183/220、6611-6638（跨 ui-interactions）。
6. **修完即归档**：当轮 worklog 记录根因链（含"以前为何没炸"），手册附录 A 同步，验证器补哨兵；新写台账条目后立即跑 v3 双向哨兵（H2b/H2f）。

## 4. 验证体系（现状与扩展位）

| 验证器 | 覆盖 | 基线 |
|---|---|---|
| `verifier/v1/eval-stale-harness.js` | eval 回调陈旧性、批量推进、缓存归属的**行为级**仿真 + TDZ 哨兵 + 场景 R61 + **场景 S58（round-62：在飞去重/环缓存救援/看门狗有界重试，10 断言）** | **44 项** |
| `verifier/v2/round53-sonar-triage.js` | round-44 起各修复的**结构哨兵** + V2-20/21 + **V2-22/23a/23b/23c（58b Bug A/F 结构守护）+ V2-25（消重防回潮）** | **27 项** |
| `verifier/v3/round54-pr56-triage.js` | PR 评审项、文档/许可完整性（H2a–H2f 双向）+ V3-38 指南隐私行（fail-closed）+ G7 升级版（round-62：唯一实现 + 调用方接线双守护）+ **V3-39（round-63：负例脚本自纪律；round-64：升级为实现行锚定——无绝对路径/trap 恢复且 handler 必须真调 restore/备份与恢复全链字节复核/失败累计/台账指向实物）** | **40 项** |

- 运行：`cd verifier && node v1/eval-stale-harness.js && node v2/round53-sonar-triage.js && node v3/round54-pr56-triage.js`（不依赖 Android 环境）。
- round-62 状态闭环：58b 六 bug 哨兵欠账**已全部落地**（v1 行为级三主题：重复派发抑制 S58-C、环缓存救援 S58-E、看门狗有界重试 S58-D；v2 结构级三主题：`_manualLive` 门控 V2-22、Bug F 清偿点 V2-23a/b/c、列表刷新接线 V2-24），负例回归变异六连测全 RED；**58b 哨兵欠账清零**。
- round-63 状态闭环：负例脚本四缺陷（退出码失真/路径硬编码/无 trap 恢复/台账失真）全部修复并元负例三连测验证；V3-39 永久哨兵落地，新基线 **44/27/40**。
- round-64 状态闭环：round-63 加固自身引入的两条数据丢失路径（未校验备份/无条件删备份）全部闭合（备份与恢复全链 `cp + cmp -s` 字节复核 + 幂等 restore + 失败传播），V3-39 两处绕过（空处理器/注释满足）以实现行锚定堵死；二十五断言元负例套件全 PASS；基线 **44/27/40 不变**。
- 扩展位：StockfishNative 五组与 ui.js 两组重复对的消重防回潮哨兵（届时与 V2-25 同型）。

## 5. 工具与环境坑（跨沙箱恢复必读）

- **构建环境每次按 §2.3 重建**；本沙箱（round-62）新增两条：①项目 `gradle.properties` 要求 `-Xmx4096m` 而 4GB 物理内存的沙箱会 OOM 杀 daemon——用 `GRADLE_USER_HOME/gradle.properties` 覆盖为 `-Xmx1536m`；②长驻后台进程（setsid nohup 含 Gradle daemon）在工具调用间隙会被清理——**构建必须在单次前台调用内完成**，依赖下载用 Gradle 文件级缓存跨段收敛（实测 4 段，每段 ≤570s）。
- AGP 8.7.3 的自动 SDK 安装器下载 build-tools 可能反复挂起——`sdkmanager` 手动预装后恢复。
