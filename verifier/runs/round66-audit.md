# round-66 audit — upload 分支全量审查报告 v2 的逐项实施与验证轨迹

> 审查输入：《Regalia-upload分支全量审查报告（v2·合并外部评审分诊）》（2026-11-21，审查对象
> head `e33f0add` = round-65 完成态）。本审计记录 round-66 对该报告 **23 项属实发现**的逐项
> 处置、验证数据、负空间与判定不动项。基线 `e33f0add` → round-66 树；行号以标识符锚定。
> 优先级铁律：bug 修复 > 健壮性巩固 > 功能完善 > 性能突破 > 冗余清理 > 简化代码。

---

## 0. 恢复实录（沙箱回滚第四次实证）

开工时本地树再次回滚到 round-61 态（work/ 树、worklog 顶部 round-61、无 V3-39/40、无 SF19）。
按指南 §2 以 **GitHub 远端为唯一权威源**恢复：

- `git ls-remote` 核实 upload head = `e33f0add`（与审查报告一致）；git clone 443 端口
  超时后改走 codeload 快照（5,651,634 B，2.3MB/s）解包为 regalia/ 树；
- 首跑三验证器 **44/27/41 全绿** = 恢复树正确（指南 §2 步骤 1 的核对标准）；
- 引擎从 round-65 APK 提取（`lib/arm64-v8a/libstockfish.so`，Deflate 存储），SHA-256
  `ffd8fc20…cf1daf8` / 100,695,968 B 与 NOTICE/Java 常量三方一致；APK 内 chess.html
  与恢复树逐字节一致（1,488,720 B）；
- **新发现（repo 卫生，记为 R-9）**：main 与 upload 分支**均无 `.gitignore`**——round-56
  SEC-02 制作的 990B 文件从未推送到远端（这正是 round-63 `git add -A` 扫进 114MB 引擎 +
  337 个构建产物三次才清干净的根源）。round-66 将该文件落库（本地基线 git 亦借此排除引擎）。

---

## 1. 报告 23 项发现处置总表

| # | 级别 | 处置 | 验证 |
|---|---|---|---|
| F-1 | bug·高 | **已修**：新增 `EXPECTED_ENGINE_SIZE_BYTES = 100_695_968L` 常量；两处缓存复用门 `> MIN_ENGINE_BINARY_SIZE` → `== EXPECTED_ENGINE_SIZE_BYTES`（extractEngineFromApk / extractEngineFromAssets 各一，共 2 处） | V3-41 行锚定钉门形×2 + 常量声明；元负例 `V41-gate-revert`（单门回退 `>`）RED |
| F-2 | bug | **已修**：release-helper.yml:133 `Stockfish 18` → `Stockfish 19 engine binary (arm64-universal build)` | V3-40b（release-helper 必含 19 必无 18）；元负例 `V40b-release-helper-sf18` RED |
| F-3 | bug | **已修 9 处 + 2 处加注**：手册活章节引擎身份——报告列 8 处，本轮全量扫描发现 **en:544 为第 9 处**（round-65 漏网之一，报告亦未列）：en:544/546 概述×2、en:589/939/1366 徽标×3、zh:544 概述、zh:587/934/1361 徽标×3 → SF19/arm64-universal；en:1492/zh:1487 Hash 表出处引用按报告保留并加注"（SF18 最佳实践，SF19 沿用）" | V3-40b 活区 grep 清零（豁免清单化：两条加注后的出处引用）；元负例 `V40b-manual-live-sf18` RED；手册三检：严格 UTF-8 ✓、附录锚点 1/1 ✓、div 365/365 双语 ✓ |
| F-4 | bug | **已修**：PRIVACY.md:922 引擎身份改 SF19；同句"uncompressed/memory-map"反转表述一并勘误（见 R-8） | V3-40b（PRIVACY 必含当前摘要）；全局传播扫描：反转表述共 5 处（见 §3） |
| F-5 | bug | **已修**：game-logic.js 模块头按 build-chess.py 实际顺序重写（game-logic 第一 → chess960 → pgn-standard → state-store → ai-bridge → tablebase → eco-data → ui-gameflow → ui-interactions → ui 末位），补 TDZ 警示（ui.js 全局仅运行期可访问，round-60 F-1 教训），删除 worker-pool 假引用 | V3-42（头注释事实 + 与 modules 清单交叉核对）；元负例 `V42-order-reverted` RED |
| F-6 | bug | **已修（处置 a：删除）**：worker-pool.js（732 行）整文件删除——round-56 台账早已声称 "DELETED" 但文件滞留至今（台账与现实背离）；chess.src 台账 round-66 条目记载 | 删除后全模块 node --check 10/10；三验证器全绿；build-chess.py 重打包确定性复核 0 差异；台账双向哨兵 H2a/H2f 即时跑 PASS |
| F-7 | bug | **已修**：两处提取路径原子提交——写 `libstockfish.so.tmp` 同目录临时文件 → ELF+SHA 在 tmp 上验证 → `renameTo(destFile)`（Linux/Android rename(2) 原子替换）→ 验证通过才 makeExecutable；失败路径全部只动 tmp，旧缓存永不被失败的重提取破坏 | V3-41 钉 FileOutputStream(tmpFile) + 活语句形态 renameTo×2（行锚定 `^ +if \(!tmpFile\.renameTo…`）；元负例 `V41-rename-disabled`（`false &&` 死守卫）与 rename-call-removed 双变体 RED |
| F-8 | 健壮性 | **已修**：readCappedText 行上限扫描（appendLen 计算）移到字符上限判定**之前**，throw 条件从 `sb.length()+n` 改为 `sb.length()+appendLen`——行上限本可合法截断的导入不再被整 chunk 越限误拒。G7a 哨兵标识符（prevWasCr/折叠逻辑）不动 | V3-43（顺序钉死 + 旧形态必须消失）；元负例 `V43-order-swapped` RED；G7a/G7b 复跑 PASS |
| F-9 | 健壮性 | **已修（超出报告方案）**：报告推荐的行锚定正则**实测不达标**——100k 空格无闭合单行，旧形态 >120s（本轮实测，连基准脚本都跑不完），行锚定形态仍 >90s（锚定只减少起点数，不消除单起点内 lazy×`\s*` 歧义回溯）。改用**确定性扫描器**（indexOf 定界 + 线性引号扫描），语义与旧正则**差分零差异**：43,010 例结构化语料 + 300,000 例随机语料（含 U+2028/2029）= **343,010 例 0 diff**。畸形输入：新扫描器 1M 空格单行 24ms / 5000 行×200 空格 48ms（旧形态同类输入 >120,000ms） | V3-45（lazy 尾形必须消失 + 扫描器实现行存在）；负例脚本新增 **N7**（杀扫描器 tag-start 查找 → v3 V3-45 RED，进交付门）；元负例 `V45-scanner-regex-back`（换回旧正则）RED。**fuzz 过程抓获并闭合一个语义细节**：旧正则转义分支 `\\.` 的 `.` 不匹配行终止符——反斜杠+换行须判定为未闭合引号（首轮 10 例分歧的根因），扫描器已精确复刻 |
| F-10 | 健壮性 | **已修**：openCreateDocumentPicker 的 Activity-null 分支 return 前清 `_pendingExportContent=null; _pendingExportType="settings"`（与 catch 路径完全对称）。注：round-62 合并出的 openOpenDocumentPicker（导入侧，:290）同型 null 分支**不设 pending**，无需修改（修 F-10 时锚点双命中，现场核实后以 pending 置位行为前置锚消歧） | V3-44（null 分支内清理行、位置在 toast 之前）；元负例 `V44-clear-deleted` RED；V2-25 复跑 PASS |
| F-11 | 健壮性 | **已修**：tablebase.js probeTablebase——无 AbortController 时 `Promise.race([fetch, 5s reject])` 墙钟兜底（reject 进既有 catch，失败计数语义与 abort 路径统一；Promise.race 已给落败 fetch 挂 handler，晚到网络拒绝不会成为 unhandled rejection）；`clearTimeout` 移入 finally（原先仅成功路径清理） | 代码走查 + v1/v2/v3 全绿；tablebase 限流/离线回退路径未动（N-13 维持） |
| F-12 | 健壮性 | **已修**：ai-bridge.js:5217 延迟推进重试空 catch 补 `console.warn('[BATCH] delayed advance failed', …)`（全仓第 21 处空 catch 中唯一在关键推进链上的例外，其余 20 处 UI/audio/haptic 约定不动，N-14 维持） | node --check + v1 场景 R61/S58 复跑 PASS；V1-30 无新 warn 类别 |
| F-19 | bug·Major | **已修**：BUILDING.md 活构建指南（"# Building Regalia v1.2.3 from source" 章）：下载 URL sf_18 tar → sf_19 `stockfish-android-arm64-universal.tar.gz`；解包/复制命令 → `stockfish/stockfish-android-arm64-universal`；校验段升级为**尺寸+摘要双检**（`stat -c %s` → `# 100695968` + sha256sum → `# ffd8fc20…`），与 Java 常量同源 | V3-40b（活指南区摘要+尺寸 == Java 常量）；元负例 `V40b-guide-digest` / `V40b-guide-size` RED |
| F-20 | 健壮性 | **已修**：V3-39 trap 谓词从"handler 含 restore 单词"升级为**命令形状** `^trap\s+'restore\s*\|\|\s*exit\s+1[^']*'\s+(EXIT\|INT\|TERM)`（当前三个 handler 均为 `restore \|\| exit 1…` 形状，精确匹配） | 元负例 `V39-echo-restore`（EXIT）与 `V39-echo-restore-INT`（INT）双 RED；`trap 'restore \|\| exit 1; echo x'` 类"调用+附加提及"按选定语义仍绿（调用位是判据，如实记录） |
| F-21 | bug·Minor | **已修（append-only 勘误）**：round64-audit.md 末尾追加 ERRATUM 节——恢复正确优先级（命令行 > **GRADLE_USER_HOME** > 项目根 > GRADLE_HOME），指明 round-62 worklog:145 原记载本就正确、round-64 的"更精确"把对的改反了；沙箱实测复现见 §4（构建阶段） | 勘误后全文 `does NOT outrank` 仅存于被勘误的历史行 + 勘误节引文（grep 复核）；N-15 维持（未传播） |
| F-22 | 健壮性 | **已修**：V3-39 补齐名实一致的谓词组——`backup_one` 体（`cp $1 $2 && cmp -s`）、`restore_one` 体（`cp+cmp; then`）、武装行（两目标 backup_one 调用）、neg() 内 per-item 恢复（`cp $_bak $_tgt \|\| cmp`）全部行锚定钉死；ok() 标题同步改写为逐属性可对照 | 元负例 `V39-backup-impl-deleted` / `V39-restore-cmp-deleted`（删实现留函数与 mktemp）双 RED；round-64 两条旧绕过（空处理器 `V39-empty-handler` / 注释满足 `V39-comment-satisfy`）回归仍 RED |
| O-2 | 机会 | **已实施**：`EXPECTED_ENGINE_SIZE_BYTES` 单源供缓存门×2、进度分母（`total * 13L / EXPECTED_ENGINE_SIZE_BYTES`）、NOTICE/BUILDING 声明（经 V3-40/V3-40b 钉一致性）；V3-40 的 (b) 腿从"分母==NOTICE"改为"常量==NOTICE"（分母→常量接线由 V3-41 钉，链路无缺口且更稳） | 三验证器 44/27/47 全绿；元负例 `V40-notice-size-flip` / `V41-constant-wrong` RED |
| O-3 | 机会 | **已实施**：resolveEngineBinary 优先级 1-3 全部加尺寸等值门（优先级 1 为 `!=` 前置跳过+日志，2/3 为 `== && isElfFile` 联言）——OEM 安装器按字节解包，合法副本尺寸精确等于捆绑值；SELinux 信任模型不动（不哈希只比尺寸） | V3-41 钉三处优先级门的实现行；元负例 `V41-gate-revert` 单门回退即 RED |
| R-1 | 冗余 | **已修**：shouldVerifyCachedEngine 注释 "the 114MB hash" → "~100MB hash"，"length+ELF gate" → "exact-size+ELF gate (round-66, F-1)"（:335 已是 ~100MB，同文件不再自相矛盾） | grep 复核同文件无 114MB 残留 |
| R-2 | 冗余 | **已修**：game-logic.js:3325 死引用从句删除，改述为 lichess 探测的网络依赖理由（typeof 守卫理由保留）并注明 round-66 出处 | node --check + V3-42 相关断言不受影响 |
| R-3 | 冗余 | **已修**：stats.html:707/728 两处注释的镜像源从 worker-pool.js 改述为 tablebase.js `_parsePGN`（F-23 之后两处解析器真正同构共享 hardened 形态，"keep in sync" 注释首次名实相符） | 注释走查；F-23 使镜像关系真实 |
| R-4 | 冗余 | **随 F-6 一并处置（删除）** | 同 F-6 |
| R-5 | 冗余 | **已核实并记录**：`catch (Throwable)` 实测计数 **191**（本轮 `grep -rc` 全 Java 求和）；"186" 引用仅存于 worklog.md:378 与 round58c-audit.md:21 两处**历史/append-only 记录**（当时口径），活文档（README/NOTICE/PRIVACY/BUILDING/方法论/术语表）零引用——无需改动，本审计与 round-66 worklog 记载正确值 | `grep -rn "186"` 全仓扫描留证；约定不动（第六章判定不动项 #2 维持） |
| R-6 | 冗余 | **已修**：v3 G7a `.replace(/\\n/g,'\\n')` 恒等无操作删除（CodeQL js/identity-replacement 属实） | G7a 复跑 PASS（44/27/47 全绿证） |
| R-7 | 冗余 | **已修**：BUILDING.md:945-948 幻影 CI 门句删除，如实改写为"There is NO CI hash gate for the engine…enforcement points are: this manual check at build time, and the app's runtime gate on every fresh extraction + exact-size cached-copy identity check + rooted-device re-hash"（全部 12 个 workflow 零引擎哈希门，报告扫描结论维持） | 文本走查；V3-40b 钉活指南区（若有人改回幻影门句而丢摘要/尺寸仍会 RED） |

**O-1（剩余消重）判定不做，如实记录**：engineGoInternal/engineGoTimed 90 行骨架抽取是引擎状态机
核心路径，回归面大（需全套行为级仿真护航），优先级铁律下排在四批修复之后；round-62 判定与
报告批次⑤"视回归面"一致。待办保留（指南 §5.2），下轮若做须配 V2-25 同型防回潮哨兵。

---

## 2. 新发现（round-66 实施过程中查出，报告未列）

| # | 级别 | 内容 | 处置 |
|---|---|---|---|
| **F-23** | bug·高 | **tablebase.js:155 主页 PGN 导入分卷正则仍为 round-49 修复前旧形态** `/\n\s*\n(?=\[)/`——round-49 修了三处副本（stats.html + worker-pool.js ×2）漏了这第四处（主页 `_parsePGN`，主线程）：长空白行 run 无 `[` 跟随时 O(k²) 回溯，敌意 PGN 可 ANR 主页导入路径。属 round-49 修复不完整的同型复发 | **已修**：换用 stats.html 同款 hardened lookbehind 形态（round-49 已证该变换 30 万例 fuzz 零差异；本轮另做等价抽查通过）。V3-45 钉 hardened 形态存在 + 旧二次形态必须消失；负例脚本 N7 联防；元负例 `V45-tablebase-old-split` RED |
| **R-8** | 冗余·文档 | **useLegacyPackaging 语义反转表述**：build.gradle:270-273 活注释、PRIVACY:922、BUILDING:2664（round-8 历史节）三处声称 "true = .so 未压缩/安装期映射"——实测 round-65 APK 内引擎为 **Deflate 压缩**（100,695,968 → 79,926,725 B，21%），true 的真实语义是压缩存储+安装期解压提取。报告 F-1 选项 4 曾沿引该错误表述（"useLegacyPackaging true 保证 .so 未压缩"） | **已修 3 处**：build.gradle 活注释就地勘误；PRIVACY:922 随 F-4 一并改写；BUILDING:2664 依 append-only 加括注勘误（保留 round-8 史实本身）。README round-8 段只述事实不含反转表述（干净）；手册附录 A round-8 历史段与 worklog:6141 历史记载按 append-only 不改写，豁免清单化 |
| **R-9** | repo 卫生 | `.gitignore` 从未进入远端仓库（见 §0） | 已随 round-66 变更集落库 |
| **V41-死守卫** | 元哨兵第四级绕过 | 元负例验证过程中发现：`if (false && !tmpFile.renameTo(destFile))` 使原子提交成死代码，但 V3-41 原钉法（子串计数 ×2）仍绿——**"文本出现"≠"活语句"**，三级递进之后还有第四级 | **当场闭合**：V3-41 改为行锚定活语句形态 `^ +if \(!tmpFile\.renameTo\(destFile\)\) \{$`；`V41-rename-disabled` 与 rename-call-removed 双变体 RED。此发现升格入方法论 §3.10（见 §5） |
| （过程实录） | — | 负例脚本泛化时把 stats.html 路径变量命名为 `ST`，与 neg() 内部哨兵状态变量 `ST=RED` **撞名**——N6 残值 "RED" 被当成目标文件名（perl "Can't open RED"）。首跑即暴露，改名 `STF` 修复 | 修复后七项全 RED；实录入 worklog（shell 全局变量命名撞名坑） |

---

## 3. F-9 基准与差分 fuzz 数据（畸形输入基准，报告第七章要求入审计）

- **旧形态** `/\[(\w+)\s+(?:"((?:[^"\\]|\\.)*)"|([^\]\n]*?))\s*\]/g`：`[FEN ` + 100,000 空格
  无闭合单行 → **>120,000ms**（120s 超时未完成，基准脚本被杀）。
- **报告推荐行锚定形态** `^…$/gm`：同一输入 **>90,000ms**（90s 超时）——锚定减少起点数，
  单起点内 lazy 值分支 × `\s*` 尾部歧义的回溯不受影响。**报告方案实测不达标，据此改道**。
- **本轮采用**（确定性扫描器，语义差分零差异）：同输入 1,000,000 空格 **24ms**；5000 行×200
  空格 **48ms**。回溯面上界从 O(n²) 降为 O(n)。
- **差分 fuzz**：结构化语料 3,010 例（引号/转义/无引号/跨行值/单行 PGN/畸形嵌套/空值）+
  随机语料 40,000 例 + 第二轮随机 300,000 例（字母表含 `[]"\\ \n\r\t U+2028 U+2029`）=
  **343,010 例，0 差异**。首轮 10 例分歧全部同根因（`\\.` 的 `.` 不匹配行终止符），扫描器
  复刻该语义后归零。
- **F-23 等价性**：hardened lookbehind 与旧分卷形态的等价性由 round-49 的 300k fuzz 历史背书，
  本轮补做抽查（7 个边界用例含尾随空格/多空行 run/无空行对照）0 差异。

---

## 4. 构建与六连验（实测数据）

构建环境重建（沙箱回收后从零）：腾讯镜像（13–24MB/s）取 SDK 全家（platform-tools r37.0.3 /
platform-35 r02 / build-tools r35+r34 / cmake 3.31.6 / NDK r27c）+ Gradle 8.11.1；Azul CDN
8 段并行取 Zulu JDK 17.0.13（198,242,125 B 拼接校验一致）；Maven 官方源慢而可达（≤54KB/s）
→ init-script 摘除官方仓库由阿里镜像接管（指南 §2.3）。引擎无需下载——直接从 round-65 APK
提取（三方一致的既有身份）。命令行 `-Dorg.gradle.jvmargs=-Xmx1536m` 内存覆盖 + `--no-daemon`
单前台段完成。**BUILD SUCCESSFUL in 1m 21s（51 tasks，与 round-64 记录同构）**；首次段
2m08s 用于依赖收敛（签名变量未导出的 fail-fast 也在该段暴露——`set -a` 修正后一次通过）。

六连验（全部实测通过）：

| 验 | 结果 |
|---|---|
| 签名方案 | v1 true / v2 true / v3 true（v3.1/v4 false，与历轮一致） |
| 证书指纹 | SHA-256 `45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc`（alias regalia，锁定） |
| 版本 | versionCode=10203 / versionName="1.2.3"（锁定） |
| chess.html | APK 内与源码 bundle **逐字节一致**（1,491,174 B，round-66 新 bundle） |
| 引擎 | SHA-256 `ffd8fc20…cf1daf8` / 100,695,968 B；APK == 磁盘 == NOTICE 声明三方一致 |
| 交付门 | 三验证器 **44/27/47** 全绿 + 负例脚本七变异全 RED + exit 0 |

APK：**81,542,436 字节**（round-65 为 81,548,307；-5,871 B 为本轮代码/文档变更的净效应）。

**F-21 Gradle 优先级实测**（勘误的实证部分，Gradle 8.11.1，三种独立方法交叉验证）：

1. **构建属性合并**：用户级 `my.prop=userValue` / 项目级 `my.prop=projectValue` →
   `providers.gradleProperty('my.prop')` 取 **userValue**（用户级胜）。
2. **真实 daemon Xmx**：用户级 `org.gradle.jvmargs=-Xmx512m` / 项目级 `-Xmx384m` →
   daemon 进程命令行（jcmd/ps 实测）携带 **-Xmx512m**（用户级胜）。
3. **无效值矩阵**（--no-daemon）：用户级无效 + 项目级合法 → JVM 拒绝启动（用户级值生效）；
   用户级合法 + 项目级无效 → 构建通过（项目级无效值被忽略）；用户级无效 + 命令行 -D 合法 →
   通过（命令行最高）。

结论一致：**命令行 > GRADLE_USER_HOME > 项目根 > GRADLE_HOME**（构建属性与
org.gradle.jvmargs 同序）——round-62 记载正确，round-64 的"更精确"确实写反，勘误成立。
**验证过程元教训（如实记录）**：无效值矩阵首跑时用户级文件被写成裸值（漏 `org.gradle.jvmargs=`
键名），一度得出"项目级胜出"的反向结论、险些推翻勘误本身——是方法 2 的 jcmd 交叉检验暴露了
测试自身的缺陷。每一个"实证"结果都欠读者一次交叉检验，勘误也不例外；该教训入方法论候选。

---

## 5. 元纪律升格（写入方法论 §3.10 / 指南 §3.10）

哨兵检查三级递进 → **四级实证谱系**（每级配当轮绕过负例，全部 RED-verified）：

1. 字面存在（includes 'mktemp'）→ 被**注释满足**（round-64 抓获，V2-21 教训第三次重演）；
2. 实现行存在（`^BAK=\$\(mktemp\)`）→ 被**空处理器满足**（`trap '' EXIT`，round-64）；
3. handler 提及 restore（`[^']*\brestore\b[^']*`）→ 被 **echo restore** 满足（round-66 F-20，
   CodeRabbit 14:09 抓获）；
4. 属性覆盖面（名称声称 verified backup）→ 被**删实现留函数**满足（round-66 F-22，
   CodeRabbit 同封邮件抓获）；
5. （round-66 实施中新增）**活语句**行锚定 → 被 `false &&` **死守卫**满足（V41-rename-disabled，
   本轮元负例自抓自闭合）。

结论固化：肯定性检查一律**行锚定活语句形态匹配**（语句级 `^…$`，而非子串计数）；每个 ok()
标题声称的属性必须有逐一对应的谓词（名实对照表见 §1 F-22 行）；新哨兵当轮 RED-verified 且
负例须覆盖本级绕过形态。**元负例套件本身也是代码——它抓出的绕过就是下一级的教材。**

---

## 6. 负空间记录（查过没问题，防重复排查）

- N-16：round-66 全量扫描 `Stockfish 18|SF18|sf18|armv8-dotprod` 活文档残留——手册活区仅余
  2 处**加注后**的出处引用（豁免清单化于 V3-40b 实现内），README 活区/NOTICE/PRIVACY 活段/
  release-helper/BUILDING 活指南区全部清零。
- N-17：`ST`/`STF` 撞名修复后，负例脚本 7 项变异全部 mutated=yes + RED，工作树恢复后
  git status 仅含 round-66 变更（无残留变异）。
- N-18：v1/v2 验证器本轮零改动（44/27 维持），F-8/F-10 涉及的 G7a/G7b/V2-25 复跑全绿。
- N-19：tablebase.js `_parsePGN` 的 header 提取用定点锚定正则（[FEN…]/[Variant…]）+
  PHASE 52 头剥离，无 F-9 同款 lazy 歧义形态（逐表达式走查）。
- N-20：report-helper/release-template 以外 11 个 workflow 无引擎身份字符串（维持 round-65
  N 空间结论；幻影门句删除后 BUILDING 不再声称 CI 有哈希门）。
- N-21：删除 worker-pool.js 后全仓 grep `workerParsePGN|terminateWorkerPool|_WORKER_SRC`
  仅剩台账/注释中的历史记载（合法）与 tablebase.js:1838 描述删除缘由的注释（准确）。

---

## 7. 名实对照表（V3-39 round-66 版，报告 F-22 要求入审计）

| ok() 标题声称 | 对应谓词（行锚定） |
|---|---|
| self-resolved root | `^ROOT=.*BASH_SOURCE` |
| exclusive mktemp -d backup dir | `^BAK=\$\(mktemp -d\)` |
| byte-verified backup | `^  cp "\$1" "\$2" && cmp -s "\$1" "\$2"$`（backup_one 体）+ 武装行 `^if ! backup_one "\$AB"… \|\| ! backup_one "\$STF"…` |
| byte-verified restore | `^  if cp "\$1" "\$2" && cmp -s "\$1" "\$2"; then$`（restore_one 体） |
| byte-verified per-item | `^[^#\n]*if ! cp "\$_bak" "\$_tgt" \|\| ! cmp -s "\$_bak" "\$_tgt"; then$` |
| restore-CALLING trap handlers (command shape) | `^trap\s+'restore\s*\|\|\s*exit\s+1[^']*'\s+(EXIT\|INT\|TERM)` ×3 |
| accumulated failures | `^[^#\n]*FAILED=\$\(\(FAILED\+1\)\)` |
| real exit codes | `^set -o pipefail` + `\[ "\$FAILED" -gt 0 \]` |
| no absolute paths | `!s.includes('/home/')` |
| 台账指向 | vl.includes 已提交路径 && !includes 旧沙箱路径 |

---

## 8. 验证体系终态（round-66）

| 验证器 | 覆盖 | 基线 |
|---|---|---|
| v1 eval-stale-harness.js | 未改动 | **44** |
| v2 round53-sonar-triage.js | 未改动 | **27** |
| v3 round54-pr56-triage.js | V3-39 第三轮加固 + V3-40 (b) 腿改常量 + **V3-40b/41/42/43/44/45 六新哨兵** + R-6 | **47** |
| r62-negative-tests.sh | N1–N6（58b 哨兵）+ **N7（F-9 扫描器）**；多目标字节校验备份（mktemp -d） | 7 RED + 3 GREEN + exit 0 |
| 元负例套件（/tmp fixture，不入库） | 20 场景 + rename 删除变体 | 全 RED |

三验证器 **44/27/47**；负例脚本 `R62-NEG OK: all seven mutations RED`；元负例
`ALL RED — every round-66 sentinel catches its bypass`。
