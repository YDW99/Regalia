# round-70 审计（PR#59 CodeRabbit 7 条意见全处置 + .mobsf 通道调查）

基线：upload 分支 `21fdb3fd`（＝PR#59 head；round-69 交付态：`974437b3`
「Add files via upload」＋10 秒后 `21fdb3fd`「auto unzip files to root」）。
基线首跑三验证器 **44/44、27/27、51/51**（round-68 收官态在 main `6ed30d3f`
同步确认），r62 十三门全绿，r67-bench OK。

任务来源：用户报告「.mobsf 未随解压更新」（T-zip 调查：证伪，见下）＋
PR#59 CodeRabbit 邮件 PDF（10:12，**7 条 actionable**）。指令（延续
round-69）：「实施所有值得实施的措施」。

## T-a 意见分诊（7/7 全部处置）

| # | 级别 | 位置 | 处置 |
|---|------|------|------|
| 1 | Minor·Security | StockfishNative `_postJsCallbackDirect` catch 记录 cleanJs（onEngineEval 第 8 参＝FEN，Log.e 幸存 release proguard） | **实施（改根）**：事件名（新 helper `_callbackEventName`）＋payload 长度；payload 文本不再进 logcat |
| 2 | Minor·Security·Heavy | .mobsf 声称无行级豁免；全局忽略掩盖未来新增不安全日志 | **实施（迁移）**：实证行级语法成立→259 findings 全量迁移至 223 个行级标记；删全局 ignore-rules。见 T-mobsf |
| 3 | Minor·Correctness | r62：RESULT 存在但 `_V3CLAIM` 为空时跳过计数检查，畸形输出可入白名单 | **实施（改根）**：空 claim＝hard-fail（有效格式或拦截，无第三门）。自测 6/6。见 T-r62 |
| 4 | Minor·Correctness | round64-audit 优先级表把 systemProp 文件形态列在环境变量之后 | **实施（实测重排）**：E13/E14/E15 实测裁决→入系统属性层级第 3 位。见 T-e13 |
| 5 | Minor·Correctness | round68-audit DELETE 示例 `{"message", …}` 非法 JSON | **实施（勘误）**：`{"message":"Delete file",...}`＋message 必填说明 |
| 6 | Minor·Security | round69-audit「position fen 不再可能进 logcat」过宽（debug Log.d 仍记录） | **实施（限定）**：限定为 Log.e 路径＋debug 例外＋finding/泄漏面区分 |
| 7 | Minor·Security | worklog 摘要称剩余告警全部 release 剥离（漏两条幸存 Log.e） | **实施（列举）**：round-70 worklog 未实施项明示＋T-logE 48 条全量审查 |

## T-mobsf 逐行抑制迁移（意见 2 的实施记录）

**语法实证（双层证据）**：
1. 源码层：mobsfscan 1.2.0 `suppress_pm_comments`/`_line_ignores_rule`
   （mobsfscan.py:373-404）——检查 match span 内**每一行**，任一行含
   `mobsf-ignore: <rule_id>` 即抑制该 finding；行注释/JSX/HTML 注释均支持。
2. 行为层：微型用例（`import android.util.Log` 惯用形）——标注行抑制、
   未标注行标记，Log.e/Log.d 双验证；另证全限定名 `android.util.Log.e`
   **不触发**该规则（模式匹配 import 惯用形）。

**迁移执行**：原始基线扫描（移除 .mobsf 全局规则后，mobsfscan 1.2.0 +
AndroidManifest）＝**259 条 android_logging findings**（另
task_hijacking2×1、javascript_interface×3 为历史已分诊项，前后不变）。
按 match span 末行行尾追加 ` // mobsf-ignore: android_logging`，去重后
**223 个唯一标注点**（15 文件：StockfishNative 109、PgnCacheManager 26、
FileIoHelper 15、StatsActivity 12、EngineConfigHelper 10、
EngineSettingsHelper 9、ChessApp 8、ChessWebViewClient 8、JsBridgeGateway 7、
SafPickerHelper 7、MainActivity 6、HapticManager 2、TlsSecurityHelper 2、
EngineProcessManager 1、StabilizationHelper 1）。259−223＝36 条为跨 span
重复（同一末行多模式命中）。`.mobsf` 重写为纯注释审计记录（**零活动指令**）。

**三重验证（全过）**：
- G1 复扫：android_logging **0** findings（纯标记级抑制）；
- G2 奇偶校验：剥除全部 223 个标记＋撤销两处代码改动（3222 根修＋helper）
  后与原始树**逐字节相等**——证明除标记与两处文档化改动外零变更；
- G3 javac 签名：pristine 与 work 两树全量 javac（无 android classpath，
  预期解析错误）错误消息多重集 **1450=1450 一致**——标记与改动零语法影响。
  （Java 无文本块已先证：行尾注释不可能落入字符串字面量内部。）

**安全收益**：未来新增/重构产生的不安全 Log 行将进入 MobSF SARIF（ALERT）
而非被全局规则静默吞掉；.mobsf 尾注已写明「再看到 android_logging findings
就是新的，去读，不要回来加全局豁免」。

## T-logE Log.e 级全量审查（意见 7 的审查底稿）

48 条 Log.e 级 findings（含 5 组同末行重复）逐一分类：

- **携带棋局内容（真泄漏）**：`_postJsCallbackDirect` catch 的 cleanJs
  （onEngineEval 第 8 参 FEN）——**本轮已修**（事件名＋长度）。
  sendUciCommand（round-69 已修，静态＋长度）。
- **记档接受**：2598 `Error processing engine line: + line`——引擎协议行
  （info/bestmove），仅含当前搜索的少量 PV 着法，无 FEN、无身份信息，
  仅解析失败异常路径触发；保留诊断价值，T-j 留单行跟进选项。
- **引擎路径（既文档化残留学）**：4716/4731 引擎哈希读取/校验失败路径、
  binPath、FileIoHelper 272/404/577（app 内部目录/资产路径）。
- **静态标签/整数/线程名**：ChessApp 线程名+异常类名 ×6、WebViewClient
  崩溃计数、exit code、recovery reason、setting 名、回调事件名（3274）、
  heartbeat 毫秒值、4972/5006 引擎 label（"arm64"/"universal"）、
  SafPickerHelper logLabel、StatsActivity/StockfishNative openUrlInBrowser
  的固定 URL。

**结论**：release 幸存 Log.e 的输出面＝路径/标签/整数/静态消息/事件名，
无用户数据、无棋局内容；两条棋局内容通道均已根修。

## T-r62 空-claim 硬化（意见 3 的实施记录）

旧逻辑：`rc≠0 && RESULTN≥1 && [-n _V3CLAIM] && claim≠failn` 才拦——
RESULT 行存在但 sed 解析不出数字（如 `RESULT: 51 passed, X failed`）时
`_V3CLAIM` 为空，`-n` 短路跳过计数门，零 FAIL 行即落入豁免分支放行。
新逻辑：`rc≠0 && { [ -z "$_V3CLAIM" ] || [ "$_V3CLAIM" != "$_V3FAILN" ]; }`
——**空 claim 或计数不符均 hard-fail**；有效、计数一致的 RESULT 才可入
豁免（无第三门）。注释块同步注明 round-70 加固。

**定向自测 6/6**（从交付版 r62 文件 sed 抽取门块、合成输出喂入）：
1. 无 RESULT＋rc=1 → 拦截 ✓
2. 仅 V3-46/47 失败＋RESULT 49/2＋2 FAIL 行 → 放行（豁免语义保持）✓
3. 意外失败（FAIL V3-12）→ 拦截 ✓
4. RESULT 声明 2 失败但仅 1 FAIL 行 → 拦截 ✓
5. 全绿 rc=0 → 放行 ✓
6. **（新）畸形 RESULT（51 passed, X failed）＋rc=1＋零 FAIL 行 → 拦截 ✓**
   （旧代码此例放行——正是码兔指出的洞。）

## T-e13 Gradle 属性优先级实测（意见 4 的勘误依据）

环境：Gradle 8.11.1（腾讯镜像 zip）＋ Temurin 17.0.21（清华 Adoptium 镜像），
/tmp/ge-* 最小工程（无插件/无源码，仅 showProps 任务打印 findProperty），
隔离 GRADLE_USER_HOME、--no-daemon、无来源基线 foo=null：

| 实验 | 来源并存 | 结果 | 裁决 |
|------|----------|------|------|
| E13 | 文件 `systemProp.org.gradle.project.foo=bar` vs 环境变量 `ORG_GRADLE_PROJECT_foo=env` | **bar** | systemProp 形态**胜**环境变量 |
| E13b | 文件 plain `foo=plain` vs 同一环境变量 | env | E2 复现：环境变量胜 plain 条目 |
| E14 | E13 文件 vs 命令行 `-Dorg.gradle.project.foo=baz` | **baz** | 命令行 -D **胜**文件 systemProp |
| E15 | 同文件 plain `foo=plain` + `systemProp...foo=sysp` | **sysp** | systemProp 形态**胜**同文件 plain 条目 |

结论：CodeRabbit 指出的排序错误属实——systemProp 形态经 JVM 系统属性通道
加载，应占系统属性层级的文件档位（第 3 位：低于命令行 -D，高于环境变量与
plain 文件条目）。round64-audit ERRATUM-3 B 表已按实测重排＋round-70 实测
记录入档（append-only 勘误纪律）。

## T-v3 V3-41 锚的标记容忍（迁移的验证器同步）

迁移后 v3 首跑 50/51：V3-41 子锚 (5) 的邻接正则
`getAbsolutePath\(\)\);\n            return null;` 被 4994 行 Log.w 行尾的
抑制标记打断（实现零变更的假 RED）。修复：正则显式容忍**仅该一种**标记
`(?: \/\/ mobsf-ignore: android_logging)?`，邻接形状仍钉死；其余 12 个
子锚不受标记影响（已逐项核对：均锚在非 Log 行或无行尾锚定的模式）。
修复后 51/51。v1/v2 无相关锚，44/44、27/27 未动。

## T-zip 「.mobsf 未随解压更新」调查（用户报告的核实）

**结论：证伪——.mobsf 已随解压更新到 upload 分支**。证据链：
1. 解压提交 `21fdb3fd` 文件清单含 `src/main/java/.mobsf`（+19/−1）；
2. PR#59 Files changed 含同一文件（+19/−1）；
3. codeload 独立拉取 upload 分支快照：`.mobsf`＝2514B round-69 新版
   （含 sendUciCommand 根修说明），main 上仍是 1296B 旧版——**PR 合并前
   main 不动是预期行为**；且 .mobsf 位于 `src/main/java/` 下（mobsfscan
   约定：第一个扫描路径下的配置），不在仓库根。
4. 从 git blob（`974437b3` 的 upload.zip，827,841B）恢复上传原件解包：
   15 文件与分支**逐字节一致**（integrity_failures=0）——上传通道零丢失，
   zip 内本就含 .mobsf（2514B）。zip 里**没有** codeql.yml（保护路径
   `.github/workflows/*` 会被 unzip workflow 删除，故从未入 zip）——
   codeql.yml 修复只能走手动通道（交付指南含全文）。

## T-h 构建与 APK 六连验（环境从零重建）

**触发**：打包阶段发现 download/ 的 round-68/69 交付件恢复（含
round-69-release.apk）——引擎可用，重建条件齐备。

环境：SDK（platform-35_r02 / build-tools 34.0.0 / platform-tools r37.0.3 /
cmake 3.31.6 / NDK r27c=27.2.12479018，腾讯 Nexus 直连）＋ Gradle 8.11.1
＋ Temurin JDK 17.0.21；引擎自 round-69 APK 提取（仅 libstockfish.so 入
jniLibs，bridge/libc++ 由 CMake 生成——避免 mergeNativeLibs duplicate）
SHA 前缀 `ffd8fc20`/100,695,968B 双验；签名四变量自 upload/keystore-info.txt
运行时解析＋export（踩坑记录：eval 赋值不 export 时 gradle 子进程看不到，
构建以「Release keystore not configured」拒绝——fail-fast 门自身先验证
了）。`assembleRelease` 全绿（51 任务，R8＋lintVital＋签名）。

六连验（apksigner 权威＋Python 独立双轨）：

| 项 | 结果 |
|----|------|
| v1/v2/v3（apksigner） | Verifies；v1 true、v2 true、v3 true |
| 证书 SHA-256 | `45bc6d36…a8d8bc`（round-45 起密钥链不变） |
| versionCode/Name | 10203 / 1.2.3（aapt2） |
| chess.html | 1,500,732B 逐字节＝工作树；SHA `cc69b869…`＝round-69 确定性重建 |
| 引擎 | `ffd8fc20…`/100,695,968B；bridge 4,824B；libc++ 1,292,904B |
| v2/v3 签名块（Python） | 0x7109871a/0xf05368c0 各 2601B（＝round-69，块结构一致） |

产物 81,552,209 B（round-69：81,552,144 B；＋65B＝本轮 Java 改动的 dex/
编译产物差异）。安装覆盖升级免卸载（签名链未变）。

## T-j 未实施项（诚实清单）

- **chess.html 未重建**：无 chess.src 改动（round-69 产物 1,500,732B 有效；
  六连验确认 APK 内 chess.html 与 round-69 确定性重建逐字节一致）。
- **codeql.yml 修复未落地**：保护路径物理不可达（T-zip 第 4 条）；修复全文
  走交付指南的 web 编辑器/命令行步骤。
- **gradlew git mode**：zip 不保留 Unix 权限位（用户 git 命令）。
- **SonarCloud**：用户侧 SONAR_TOKEN/项目配置（round-69 T-f 排查路径不变）。
- **2598 引擎行诊断未去敏化**：T-logE 记档接受；如需是单行跟进。
- **guava CVE-2026-118042**：上游修复仍不可用（round-69 T-g 结论不变；
  警报如仍在需 alert 详情分诊）。
