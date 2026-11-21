# round-61 验证轨迹（append-only）

## 2026-11-21T00:00Z — 任务输入
- 主需求：消化 PR #56 最近批 CodeRabbit 评审中已逐条到源码现场核实属实的四条缺陷（指南 §5.1 R61-a/b/c/d），按 §7 全套流程实施。
- 开工前状态确认：源码处 round-60（tar 与 upload 分支逐字节吻合：chess.html 24,173 行 / 1,486,508 字节；三件套基线 30/20/38）。

## 分诊复核（四条全部复核属实，无误报）
- R61-a：java/README.license 行 3/8/18（round-60 两条目 + round-58c 一条目）把 MainActivity / EngineService / StabilizationHelper 标为 (GPL v3)——三者为 AGPL v3 分类类（round-56 行 57-59 分类清单）。漏检根因：v3 H2b 只扫「GPL 类被误标 AGPL」单方向。属实。
- R61-b：v3 V3-38（原行 214-224）`if (!row) return true;` 与 `catch (e) { return true; }`——指南在但缺隐私行/读失败全部静默 PASS，与「指南缺席」混为一谈。属实。
- R61-c：ui.js:5750-5756 的 180s 终结检查位于 60s 静默定时器触发处理器内部；onEngineProgress 每行进度重置该定时器 → 「持续报进度、永不回 bestmove、无步完成」时处理器永不触发、检查永不到达；57c 三连击依赖步完成事件兜不住。属实。
- R61-d：StockfishNative.java:1411 `if (!engineReady) return;` 早退跳过 1452-1467 的 onEvalDeepBatchEnded 派发 → 批中途引擎死亡时 round-51 BG-1 延迟的 webView.onPause() 永不执行（后台耗电泄漏）。属实。

## 2026-11-21 实施记录
- R61-c（ui.js）：终结检查提取为 `_batchWallClockExceeded()`（含批量活跃门控），两处调用——(1) `_reviewAnalyzeResetSafetyTimer()` 入口（onEngineProgress 进度 tick / 步推进 / 引擎恢复的公共漏斗；修复点），(2) 60s 静默触发处理器内（原位置，覆盖真静默面）。语义原样：`_batchLastStepCompletedAt>0 && now-Δ>180000 && _terminateBatchAfterRepeatedFailures 可用`。
- R61-d（StockfishNative.java）：Activity 通知块（onEvalDeepBatchEnded 派发）整体上移至 engineReady 门控之前；引擎侧清理（searchMaybeInFlight 守卫 stop-and-wait、状态复位、applySettings）原样留门内。依据：通知幂等有守卫（仅确实跳过过暂停且仍在后台才动作），引擎就绪路径通知最多提前 ~1s（闩至多 1s），无 JS 定时器参与引擎清理。
- R61-a：三处 (GPL v3) → (AGPL v3) 原地更正 + java 台账 round-61 新条目置顶；v3 新增 H2f 反向哨兵（7 个 AGPL 类 + 3 个 AGPL 模块的反方向）。
- R61-b：V3-38 收紧——仅候选路径全缺席才跳过；缺行 FAIL、读失败 FAIL（附 console.warn 诊断）；新增 REGALIA_V338_GUIDE_PATH 环境变量候选列表（path.delimiter 分隔，先到先得，兜底 /mnt/agents/temp 历史路径）。

## 事故与哨兵互作记录（本会话实况）
1. **新条目同向误标被 H2b 当场抓获**：本人在 java 台账新写的 round-61 条目一度把 StockfishNative.java（GPL v3 类）标为 (AGPL v3)——H2b（单向哨兵）红灯。已更正为 (GPL v3, DroidFish-derived)。教训：新台账条目写完立即跑 v3 双向哨兵；单向哨兵对它守的方向永远有效，双向都要补。
2. **注释引用哨兵字面文本遮蔽匹配**：V2-21 初版用 indexOf 定位门控行，而 R61-d 修复注释原文引用了 `if (!engineReady) return;` 字面 → indexOf 命中注释（idx 421）先于真实派发行（idx 2956）→ 误报。处置双保险：注释改述（不再含字面原文）+ 哨兵改行锚定正则（`\n\s*if \(!engineReady\) return;`），注释内的行中引用永不匹配行首锚。教训入方法论：哨兵匹配的代码字面量不得在注释中原样复写；行锚定是结构哨兵的默认姿势。

## 2026-11-21 验证结果
- node --check ×10 JS 模块 + 3 个验证器文件：全过。
- 三件套新基线：**v1 34/34、v2 21/21、v3 39/39 全绿**（+4/+1/+1）：
  - v1 新增场景 R61（行为级）：R61-1 新批启动、R61-2 健康进度 tick（新墙钟）不误杀、R61-3 进度 tick + 200s 陈旧墙钟 → 终结批量（旧代码下必红）、R61-4 终结路径确实执行（step 复位 -1）；
  - v2 新增 V2-21（结构级）：endBatch 方法体内通知调用先于 engineReady 门控行；
  - v3 新增 H2f（反向许可哨兵）。
- V3-38 负例四连测（fixture 于 /tmp/v338-fixtures，健康样本为真实指南）：
  - 健康指南 → `PASS V3-38 guide §1 privacy line accurate (skip only when guide absent)`；
  - 缺隐私行（删除 `| 隐私 |` 行）→ `FAIL V3-38 …`（收紧前静默 PASS）；
  - 陈旧表述（隐私行改回「完全离线：无网络权限」）→ `FAIL V3-38 …`（收紧前静默 PASS）；
  - 缺席（REGALIA_V338_GUIDE_PATH 指向不存在路径且历史路径不存在）→ 跳过（PASS）。
- chess.html 重打包：24,208 行 / 1,488,718 字节（build-chess.py 字节确定性；round-60 为 24,173 / 1,486,508；增量 +35 行全部来自 ui.js R61-c 助手与注释，与 ui.js diff 核对一致）。
- 版本号不变（versionCode=10203，versionName="1.2.3"）；无新权限、无新网络出口、无新数据收集。
- 本沙箱无 Android SDK / NDK / 引擎二进制（libstockfish.so 不在 tar 内）/ release 密钥库——APK 六连验中的 APK 侧四项（v1/v2/v3 签名、证书指纹 45bc6d36…、引擎 SHA-256 8f7116d3…、APK 内 bundle 比对）本轮不可执行；JS/文档/验证器层全部完成，APK 构建待回原构建环境（/mnt/agents/buildenv）补做。源码层 bundle 一致性已验：chess.html 为 build-chess.py 对当前 chess.src 的确定性产物。
