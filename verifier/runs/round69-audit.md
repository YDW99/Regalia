# round-69 审计（PR#57 CodeRabbit 9 条意见 + 指导四步 + CI/Dependabot）

基线：main `6ed30d3f`（= round-68 全链路落地态：PR#57 `78119023` 合并 → PR#58
`.gitignore` `850e9c21` 合并 → web 删除 worker-pool.js `6ed30d3f`）。基线首跑
三验证器 **44/44、27/27、51/51**（V3-46/V3-47 双转绿——round-68 正式收官，
upload/main 同 head，.gitignore 687B 与交付包逐字节一致）。

任务来源：用户上传《元宝指导(2026.11.22).md》（PR#58 合并次序指导——收到时
#58 已合并、验证器已 51/51，指导第 2 步「合并后重跑 verifier 确认」已同步完成）
＋ PR#57 CodeRabbit 9 条意见全文 PDF ＋ Dependabot 双 High 漏洞邮件 PDF。指令：
「实施所有值得实施的措施」。

## T-a 意见分诊（9/9 全部处置）

| # | 级别 | 位置 | 处置 |
|---|------|------|------|
| 1 | Minor | tablebase.js `_tbLoadingBoard` 引用做 ownership | **实施（改根）**：token 换 fresh object（`_tbLoadingOwner`），AI 入口同机制；board 引用仅保留 payload 正确性门 |
| 2 | Minor | tablebase.js 5xx 超时后二次计数 | **实施（改根）**：`_TB_NETFAIL` 冻结 sentinel + 竞速后单点计费 |
| 3 | Minor | .mobsf 全局豁免掩盖 sendUciCommand FEN 泄漏 | **实施（根修）+ 不采纳字面（删全局豁免）**：见 T-b |
| 4 | Minor | README.license stats.html 标 AGPL v3 | **实施**：改 GPL v3 + round-69 条目记录勘误 |
| 5 | Major | r62 把 v3 异常退出当「仅豁免失败」 | **实施**：RESULT 完成标记门 + 计数一致性门（自测 5/5） |
| 6 | Minor | r67-bench 缺 closeBracket:true 反向校验 | **实施**：镜像拒绝分支 |
| 7 | Minor | round64-audit 缺 systemProp. 文件来源 | **实施**：E12 实测补正（见 T-c） |
| 8 | Major | round68-audit PUT `?ref=upload` 不指定写分支 | **实施**：请求体 `"branch":"upload"` 勘误 |
| 9 | Minor | round68-audit PUT 不能删除文件 | **实施**：DELETE+sha+branch 勘误 |

## T-b .mobsf 决策记录（意见 3 的分诊依据）

CodeRabbit 字面建议「删全局豁免」。实际处置＝**修根因 + 保留豁免 + rationale
可审计化**，理由三条（已写入 .mobsf 注释与 PR 描述）：

1. **根因已修**：StockfishNative.java sendUciCommand 的 `Log.e(TAG, "Error
   sending command: " + command, e)` 改为静态消息＋`command.length()`（长度
   助关联、无内容）；`position fen …` 命令不再可能进 logcat。该 finding 从
   源头消失，不再是「被豁免掩盖的真问题」。
2. **删豁免的代价不可接受**：mobsfscan 1.2.0 全树 264 条 android_logging
   findings 中除 sendUciCommand 外全部是 Log.v/d/i/w（release 构建 proguard
   `-assumenosideeffects` 剥离，proguard-rules.pro:135-139，round-56 SEC-06
   立场）＋两条已文档化的 path-bearing Log.e 残留；`.mobsf` 只提供
   ignore-rules/ignore-paths/ignore-filenames 三种粒度，**没有行级豁免**——
   删全局规则＝重开 ~263 条 SARIF alerts，唯一效果是把真信号埋进噪音
   （alert fatigue 本身是安全反模式）。
3. **不修 Log.d**（3041 行 `"Sending UCI: " + command`）：debug 构建专属
   （release 剥离），保留供开发诊断；注释里已写明这个差别。

若未来 mobsfscan 支持行级豁免，优先收窄到两条 E 级残留（.mobsf 尾注已留指引）。

## T-c E12 实测（意见 7 的勘误依据）

沙箱最小工程 /tmp/gradle-e12（Gradle 8.11.1 + OpenJDK 21.0.13，无 -D/-P/无
环境变量）：

| 实验 | gradle.properties 内容 | findProperty('foo') |
|------|------------------------|---------------------|
| E12 | `systemProp.org.gradle.project.foo=bar` | **bar（有效）** |
| E9 复测 | `org.gradle.project.foo=bar`（无前缀） | null（无效，原结论成立） |
| 基线 | （无文件） | null |

结论：官方文档 "Project properties" 第 2 项 "or gradle.properties file" 所指
是 **systemProp. 前缀形态**且实测有效；round64-audit 旧第 5 条把「无前缀形态
无效」误记为「文档与实测不符」——E9 测错了形态。已按 append-only 勘误纪律
改写为第 5/6 条＋勘误注记，实测记录补 round-69 段。

## T-d tablebase 双改动的行为语义（意见 1/2）

**Token 化**（意见 1）：round-68 用 board 引用做 `_tbLoadingBoard`——AI 入口
无重入检查地 re-arm，两查询同 board 引用时早完成回调仍通过 identity 检查清
flag（UI 谎报"未在查询"，新 probe 仍在飞）。round-69 每次 arm 生成
`const _myOwnerToken={}`（新对象，构造即唯一）；回调仅当
`_tbLoadingOwner===_myOwnerToken` 才降 flag。保留 reference-equality 语义
（military rule 2 字面），引用对象从 board 换成 per-query token。board
identity 检查保留在 autoSelect/executeMove（payload 正确性，与 ownership
正交）。manual（tablebase.js）与 AI（game-logic.js）双入口同机制。

**单点计费**（意见 2）：`_fetchProbe` 5xx 分支不再内联 `_tbFailCount++`，
改为返回冻结 sentinel `_TB_NETFAIL`（`Object.freeze`，=== 判等，JSON body
不可能撞上）；竞速/调用落定后 `if(data===_TB_NETFAIL)` 单点计数。legacy
无-AbortController 路径：5s 墙钟超时 → catch 计一次；迟到的 5xx → sentinel
resolve 但 race 已被 catch 赢走，不会二次计——两次失败查询不再可能触发
3-strike 60s 离线。404-no-count（Rev62）/bad-JSON-no-count（PHASE 19）语义
不变（`undefined` sentinel 独立保留）。

**验证器同步**：V3-48 增锚 (7)sentinel 声明 (8)单点计费位置在 undefined 门后
(9)内联计数负锚；V3-49 重写为 fresh-token 形态＋`_tbLoadingBoard` 双文件
零出现负锚。三验证器 **44/44、27/27、51/51**。

## T-e CI 修复（指导第 1 步）

红 CI 画像（head `6ed30d3f` 实测，匿名 API）：
- Automatic Dependency Submission ×2：`validate-project` 步骤失败（gradlew
  无可执行位 → `./gradlew: Permission denied`）；
- CodeQL Advanced：c-cpp 与 java-kotlin 两 job `Perform CodeQL Analysis`
  失败（`Finalizing cpp/java ... could not process any code`），
  javascript-typescript 与 python 两 job 绿；
- SonarCloud：**长期红**（见 T-f）；
- Android CI / PMD / Semgrep：绿。

修复：
1. **codeql.yml 矩阵收敛**：删 c-cpp（仓库无 C/C++ 源码——引擎是预编译 .so
   且 jniLibs 被 ignore，提取器永远无代码可提）；java-kotlin → `build-mode:
   manual` ＋ android-ci 同款 `compileDebugJavaWithJavac` 配方（-x
   externalNativeBuild*/package*，与绿 job 逐字一致）；js/ts 与 python 保持
   none（前后均绿）；新增 setup-java 17（仅 java-kotlin job）＋
   `chmod +x gradlew`（zip 通道丢权限位的兜底——android-ci 的既有做法）。
2. **gradlew 可执行位**：zip overlay 通道**送不了 git mode**（zip 不保留
   Unix 权限位），必须用户侧 git 命令落地（见交付 README 手动步骤）：
   `git update-index --chmod=+x gradlew` + commit + push。本文件与其余改动
   交付走 pr-upload.zip，此步单独走命令行。
3. **auto-submission workflow**（GitHub 注入，repo 侧改不了步骤）：唯一修复
   途径就是 gradlew 的 git mode（步骤 2）。

## T-f SonarCloud 调查（不修，附操作指导）

最近 139 次 run 中可见的 40 次**全部 failure**（含 PR#57 合并前的
2026-09-05 起）——非本轮引入、非本轮改动相关（CodeRabbit 对 #58 亦判「与
变更无关」）。repo 侧无法修复：`Analyze with SonarCloud` 步骤失败需要
SONAR_TOKEN / SonarCloud 项目配置，二者只在用户侧（secrets / SonarCloud
控制台）。job 日志匿名 API 403（需 admin）。交付 README 附排查路径：
Settings→Secrets→Actions 确认 `SONAR_TOKEN` 有效；SonarCloud 项目
`YDW99_Regalia`（org `ydw99`）存在且未过期；必要时重生成 token。

## T-g Dependabot 双 High（指导第 4 步）

依赖树实测（`gradle buildEnvironment`，Gradle 8.11.1）：AGP 8.7.3 传递拉取
`org.bouncycastle:bcprov-jdk18on:1.77`（经 bcpkix-jdk18on 1.77，apksig 签名
用）与 `com.google.guava:guava:32.0.1-jre`。无 open PR（Dependabot 对
buildscript 传递依赖不开自动 PR）。

修复：build.gradle buildscript 块内 `configurations.classpath {
resolutionStrategy { force … } }`——bc 三件套（bcprov/bcpkix/bcutil-jdk18on）
同 force **1.87**（CVE-2025-14813 GOST CTR keystream 影响 <1.80.2/<1.81.1，
及后续 ASN.1/DoS 修复线；三件同版本保证 bcpkix 编译引用不跨版本）；
guava force **33.8.0-jre**（CVE-2026-102554 反序列化 DoS 修复于 33.7.2+，
33.8.0 为当前 maven 最新 release）。均为**构建期依赖，不进 APK**——暴露面
是构建机供应链。force 后依赖树复核：bc 全链 1.87、guava 全链 33.8.0-jre；
**全量 assembleRelease + apksig 签名全程跑通**（兼容性实证，T-h）。

## T-h 构建与 APK 六连验（沙箱环境从零重建）

环境重建：SDK（platform-35/build-tools 34.0.0/platform-tools/cmake 3.31.6/
NDK 27.2.12479018，腾讯镜像）＋ Gradle 8.11.1（腾讯镜像）＋ Oracle JDK
17.0.2（华为镜像，系统 Java 21 为无 javac 的 JRE）＋ 引擎
`libstockfish.so` 自 round-68 APK 提取（SHA256 前缀 `ffd8fc20` /
100,695,968 B 双验通过）；密钥仅经环境变量注入（keystore.properties 未落盘，
口令不写入任何交付物）。

chess.html 确定性重建：24,393 行 / 1,500,732 B（round-68 基线 24,358 行 /
1,498,288 B；+35 行/+8,444 B＝本轮 tablebase/game-logic 改动），两次构建
SHA256 一致：`cc69b869077a72dc1367461c6567a47fea159d292fd5e3d207a2afef84f167b5`。

APK 六连验（独立 Python 解析 + apksigner 权威双轨）：

| 项 | 结果 |
|----|------|
| v1/v2/v3 签名（apksigner） | Verifies；v1 true、v2 true、v3 true |
| v2 块 0x7109871a（Python 独立解析） | 2601B，size 一致 8184 |
| v3 块 0xf05368c0（Python 独立解析） | 2601B |
| 证书 SHA-256 | `45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc`（与 round-45 密钥记录一致） |
| versionCode / versionName | 10203 / 1.2.3（aapt2） |
| chess.html | 1,500,732B，与工作树逐字节一致 |
| 引擎 | `ffd8fc20…` 前缀 / 100,695,968B |

## T-i 负例门与守护者自证

- r62 十三门全绿（本文件 T-d 改动后的门自身先过）：N1–N7 变异 RED、N8 基准
  GREEN、N8a–N8d 自保护 RED、N9 互斥 RED，还原后 44/27/51 全绿，零残留。
- r67-bench：`R67-BENCH OK`（含新 closeBracket:true 镜像分支——三个声明
  closeBracket:true 的既有用例 build 输出本就含 `]`，不误伤）。
- r62 新门定向自测 5/5：无 RESULT 的异常退出→KILLED_NO_RESULT 拦截；仅
  V3-46/47 失败的完整执行→ALLOWANCE_CLEARED 放行；含意外失败→拦截；
  RESULT 声明计数与 FAIL 行不符→拦截；全绿 rc=0→放行。

## T-j 未实施项（诚实清单）

- **SonarCloud 红未修**（T-f：repo 侧不可修，附用户排查指导）。
- **gradlew git mode 未由本通道落地**（zip 通道物理不可达；用户 git 命令，
  交付 README 第 1 步）。
- **.mobsf 全局豁免未删**（T-b：根因已修，删豁免代价＞收益；PR 描述说明）。
- **guava CVE-2026-118042**（HeroDevs 报告影响 ≤33.7.2-jre）：上游修复版本
  尚不可用（HeroDevs 卖 NES 商业补丁）；33.8.0-jre 是否含修复未证实——
  Dependabot 警报是否因此条触发亦未证实（alerts API 需 admin）。本轮已升至
  最新可用版，警报如仍在请把 alert 详情发我分诊。
- **PR#58 检查页 11 个 skipped checks**：指导建议合并前刷新 Checks——#58
  已合并（收到指导前），此条作废；后续 PR 合并前刷新 Checks 的做法保留。
