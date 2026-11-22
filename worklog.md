# Regalia v1.2.3 — round-70 工作日志（2026-11-22 UTC+8）

## 任务来源

PR#59（round-69 交付）开出后，码兔 10:12 报 **7 条 actionable 意见**（邮件 PDF
全文入 upload/）。用户同步报告「.mobsf 未随解压更新」——实测**证伪**：解压提交
`21fdb3fd` 文件清单含 `src/main/java/.mobsf`（+19/-1），upload 分支上已是
round-69 新版 2514B（我从 codeload 独立拉快照逐字节核实）；main 仍为旧版
1296B 属预期（PR#59 合并前 main 不动，.mobsf 也不在仓库根、在
src/main/java/ 下）。基线（upload@`21fdb3fd`＝PR#59 head）首跑：三验证器
44/44、27/27、51/51，r62 十三门全绿，r67-bench OK，upload.zip（git blob
恢复）↔分支 15 文件逐字节一致。

## 实施纪要（细节/数据全部入 verifier/runs/round70-audit.md）

**码兔 7 条意见 7/7 处置**（T-a 分诊表）：

- **#1 postJsCallback FEN 泄漏（真 bug，改根）**：`_postJsCallbackDirect` 的
  catch 记录原始 cleanJs——onEngineEval 回调把 FEN（完整棋局）作为第 8 参
  内嵌，evaluateJavascript 失败即经幸存 release proguard 的 Log.e 泄漏棋局。
  改为**事件名**（新 helper `_callbackEventName`，取首个 `(` 前文本）＋
  **payload 长度**；payload 文本不再可能进 logcat。
- **#2 逐行抑制迁移（Heavy lift，实施）**：实证 mobsfscan 1.2.0 支持行级
  `// mobsf-ignore: android_logging`（微型用例＋源码 suppress_pm_comments
  双证：span 内任一行含标记即抑制）；全树 259 findings→**223 唯一标注点**
  （15 个 Java 文件，match span 末行行尾）；删除 .mobsf 全局 ignore-rules
  （文件留作立场审计记录，无活动指令）。**未来新增不安全 Log 行将在 MobSF
  SARIF 里 ALERT 而非被全局吞掉**。三重验证：复扫 0 findings；奇偶校验
  （剥标记＋撤销两处代码改动＝原始树逐字节相等）；javac 双树错误签名
  1450=1450 一致（标注零语法影响）。
- **#3 r62 空 claim 旁路（改根）**：`_V3CLAIM` 为空（RESULT 存在但无法解析，
  如非数字失败计数）从「跳过计数检查」改为 hard-fail——有效格式或拦截，
  没有第三条路。自测 **6/6**（新增第 6 例：畸形 RESULT＋rc=1＋零 FAIL 行→
  拦截；旧代码此例放行）。
- **#4 优先级表重排（实测）**：E13 systemProp 文件形态**胜**环境变量（bar
  赢 env）、E14 **输给**命令行 -D（baz 赢 bar）、E15 **胜**同文件 plain 条目
  （sysp 赢 plain）——round64-audit ERRATUM-3 B 表按实测重排：systemProp
  形态入系统属性层级第 3 位（高于环境变量、低于命令行 -D），round-70 实测
  记录入档。
- **#5 round68-audit DELETE 示例勘误**：`{"message", "sha": …}` 非法 JSON →
  `{"message":"Delete file","sha":"<blob-sha>","branch":"upload"}`（message
  是必填提交说明字符串）。
- **#6 round69-audit FEN 结论限定**：「`position fen …` 不再可能进 logcat」
  → 限定为 Log.e 路径＋明示 debug Log.d 例外；finding（扫描器报告）与
  泄漏面的区分入档。
- **#7 worklog 双残留列举**：本日志「未实施项」明示幸存 release 的
  path-bearing Log.e（引擎提取/哈希失败路径，非用户数据）；round-70 对
  Log.e 级 48 条 findings 逐一审查（T-logE 表）：唯一真泄漏＝#1（已修），
  2598（引擎行诊断，仅 PV 着法无 FEN 无身份）记档接受，其余为路径/标签/
  整数/静态消息。

**验证器同步（T-v3）**：V3-41 的 getAbsolutePath 邻接锚显式容忍行级抑制标记
（仅该一种标记、邻接形状仍钉死）——迁移后 223 个行尾标记令该锚假 RED（实现
零变更），修复后 51/51。

**门禁终态**：v1 **44/44**、v2 **27/27**、v3 **51/51**、r62 十三门全绿（含
新空-claim 门）、r67-bench OK、mobsfscan 复扫 **0** android_logging
（纯标记级抑制，.mobsf 无活动指令）。

**APK 重建与六连验（T-h）**：download/ 的 round-69 交付件恢复后发现引擎
可用——构建环境从零重建（SDK platform-35/build-tools 34.0.0/cmake 3.31.6/
NDK r27c，腾讯镜像；JDK 17.0.21 Temurin；引擎自 round-69 APK 提取，SHA
前缀 `ffd8fc20`/100,695,968B 双验）；`assembleRelease` 全绿（R8＋签名，
51 任务全执行）。六连验全过：apksigner v1+v2+v3 Verifies；证书 SHA-256
`45bc6d36…a8d8bc`（round-45 起密钥链不变，覆盖升级免卸载）；10203/1.2.3；
chess.html 逐字节＝工作树（SHA `cc69b869…`，与 round-69 确定性重建一致）；
引擎 `ffd8fc20`/100,695,968B；v2/v3 签名块 Python 独立解析 2601B×2。产物
81,552,209 B（round-69 为 81,552,144 B，＋65B＝本轮 Java 改动）。

## 未实施项（诚实清单，详见 round70-audit T-j）

- **chess.html 未重建**：本轮无 chess.src 改动（round-69 构建产物仍有效，
  zip 不含 chess.html）。
- **codeql.yml 修复未落地**：`.github/workflows/*` 是 unzip workflow 的保护
  路径（解压时 find -delete），zip 通道物理不可达——修复全文在交付指南，
  走 web 编辑器或命令行（与 gradlew 权限位可合一提交）。
- **gradlew git mode**：zip 通道送不了 Unix 权限位（同 round-69，用户 git
  命令）。
- **SonarCloud**：用户侧 SONAR_TOKEN（同 round-69 排查路径）。
- **2598 引擎行诊断日志未去敏化**：接受并文档化（T-logE；如需是单行跟进）。

# Regalia v1.2.3 — round-71 工作日志（2026-11-22 UTC）

## 任务与基线

以 PR#59 head `f78317919818a02c1fa169a99b85cad6ebf8a1fe` 为基线，完成 PMD
方法命名整改、CI 配置修复、签名 Release 重建和无引擎源码备份。未推送、合并或
改写 PR/issue/review 状态。完整证据见 `verifier/runs/round71-audit.md` 及带时间戳
运行日志。

## 实施纪要

- **PMD 十二项实际存在项全部机械改名**：StockfishNative 八项、StatsActivity
  三项、EngineService 一项；调用点同步。rename-only proof 对 HEAD 做声明替换后
  三文件逐字节一致，没有夹带其他 Java 修改。PMD 7.4.0 从 422 total / 12
  MethodNamingConventions 降至 **410 total / 0 MethodNamingConventions**；其他规则
  结果未借整改之名清理。
- **MobSF 边界保持可审查**：223 个逐行标记，当前树 8 total / 0 android_logging；
  剥标记副本 267 total / 259 android_logging，两棵 SARIF 均
  `executionSuccessful=true`。`.mobsf` 仍只有评论，无全局 ignore。
- **CI/元数据**：CodeQL 恢复 C/C++ no-build 覆盖并禁止 checkout 持久凭据；
  mobsfscan 固定 1.2.0；新增 Gradle/GitHub Actions Dependabot 周检；gradlew
  index mode 恢复 100755。构建依赖、SDK、ABI、版本与 Manifest 未改。
- **许可与保密**：两级 ledger 更新；根 `LICENSE&NOTICE.zip` 保持 56,011 B 且未改。
  上传 key 只经环境变量参与构建；口令未写入文档、日志、仓库或交付压缩包。
  未新增权限或网络行为；基线已有 INTERNET 权限保持不变，最终 APK 权限集合与
  基线八项精确一致。

## 回归与构建

v1 **44/44**、v2 **27/27**、v3 **51/51**，r62 十三门全绿，r67-bench PASS，JS
语法 10 模块通过。确定性网页包为 24,393 行 / 1,500,732 B，SHA-256
`cc69b869077a72dc1367461c6567a47fea159d292fd5e3d207a2afef84f167b5`。

使用 JDK 17.0.20.1、Gradle 8.11.1、AGP 8.7.3、SDK 35、NDK 27.2.12479018、
CMake 3.31.6 完成 `assembleRelease`：**BUILD SUCCESSFUL in 14m 24s**，51 任务
（46 executed / 5 from cache）。

APK：81,552,289 B，SHA-256
`644919d57c690b54c56b26ed0ce91ec785d67a68e8e58eeaa6aed2946a5533fb`。
apksigner **v1/v2/v3 全 true**，单 signer，证书 SHA-256
`45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc`；
versionCode/name 10203/1.2.3。独立签名块解析确认 v2 `0x7109871a`、v3
`0xf05368c0` 各 2,601 B value。APK 内引擎 100,695,968 B，SHA-256
`ffd8fc2004d3d19f9fdab95d84c92709aea92e8d3af405eda0b281b23cf1daf8`；
网页包与源树逐字节一致。

原生库只含 arm64-v8a 的 Stockfish、JNI bridge 和 `libc++_shared.so` 三项；
C++ runtime 是既有 `c++_shared` 配置的必需产物，未误删。ZIP CRC、路径、重复名、
非 debuggable、min/target SDK 和基线权限门禁全部通过。

## 验证器勘误与输出通道

v4–v10 全部版本化保留，没有覆盖旧验证器。v10 是最终产物门禁，修正恢复稿中的
v2 block ID、原生库集合与基线权限口径；失败 gate、错误 wrapper 和超时均留档。

输出挂载对 `.apk` 扩展名读取返回 EIO（历史 APK 亦如此）。已复验负载先以可读
临时名完成 `cmp`/SHA-256 同一性检查，再通过同文件系统原子改名成为最终 APK；
改名前后 inode 均 15924、大小不变。直接对挂载负载重复完整 gate 的 240 秒超时
被如实记为 124，没有算作通过。

源码 ZIP 由 v10 门禁排除 VCS/build/cache/jniLibs/引擎/签名材料，保留全部验证器、
失败与成功记录、恢复说明和受保护 license ZIP。最终 ZIP 的 post-package 验证日志
按自引用边界保存在恢复目录，不回写改变已验证 ZIP。

## 兼容性声明

小米澎湃 OS 3 仅做静态兼容性核验（SDK、ABI、Manifest、Release 打包与 v1/v2/v3
签名）。未连接物理设备，未做安装或真机运行测试，不作真机验证声明。

# Regalia v1.2.3 — round-72 工作日志（2026-11-22 UTC）

## 任务与当前基线

根据上传 CodeRabbit 邮件的 20 条 actionable 意见完成验证链与交付证据加固。固定比较基线仍为 PR#59 变更前 head `f78317919818a02c1fa169a99b85cad6ebf8a1fe`；实施前和定稿前两次查询远端 `upload` 均为 `a245de549b473812aa36f0158f3f8b1a98a4a3e5`。本轮不改棋类功能或 Java 业务行为，不重建或重签 APK，不执行远端写操作。

## 许可包与自动解压差异

远端当前 `LICENSE&NOTICE.zip` 为 56,011 B、SHA-256 `d4bd3cd4752421aac192475bda7bdb5042964b5eec3102c836265c25f666595b`，与 round-71 原始 ZIP 内同大小但不同哈希的历史副本不同。已先独立保全当前远端版，未用旧 ZIP 覆盖、restore 或 reset 回退。上述观察值不是未来固定不变量，后续人工更新继续优先。

自动解压通道未送达 `.github/dependabot.yml`，CodeQL/MobSF 工作流也落后。本轮恢复 C/C++ no-build、checkout 禁持久凭据、mobsfscan 1.2.0、Dependabot 周检和 gradlew mode 100755；未夹带应用修改。

## v11 实施

- wrapper 缺少命令时退出 64 且不写成功记录；每次运行使用 `mktemp` 排他日志并保留真实退出码。
- rename-only 与 source gate 使用显式固定基线；Java 改动检查为允许子集，干净提交不再误失败，已提交越界修改也不能漏检。
- 新增共用有界递归 ZIP walker：统一深度、成员数、单成员和累计解压大小预算；重复名、危险路径、加密、损坏和读取错误全部 fail closed。
- 密码扫描覆盖源文件、源内归档、原始及递归 APK/source-ZIP；UTF-8、UTF-16LE/BE 均检查，错误只用不透明阶段/成员序号，不输出路径、成员名或口令值。
- 二进制检查在任意嵌套层拒绝 ELF、引擎/密钥库哈希、禁用后缀与任意大小写 `src/main/jniLibs` 成员。
- 源码打包启用 `os.walk(onerror=...)`、完整 regular-file payload、output/lock/tmp 显式排除、独占 output lock 和唯一临时文件；验证完整 entry set 与逐成员 SHA-256，不再只查 required 子集。
- 许可包只要求当前文件存在、非空、CRC/路径有效、递归内容安全并与当前受控字节一致，不写死 56,011 B 或旧哈希。
- v9 页首标明被 v10/v11 取代；v4–v10 旧文本和失败历史均保留。

## 实际验证结果

v1 **44/44**、v2 **27/27**、v3 **51/51**，r62 十三门全绿，r67-bench PASS，JS 10 模块语法通过。网页包两次构建一致：24,393 行 / 1,500,732 B，SHA-256 `cc69b869077a72dc1367461c6567a47fea159d292fd5e3d207a2afef84f167b5`。v11 固定基线 source gate **27/27**，基础负向测试 **17/17**，隔离集成测试 **15/15**。回归前后 Java 聚合摘要和当前许可包哈希不变。

通过现有 HTML 下载入口真实 Chromium 点击并保存 APK，failure=null，建议文件名正确。对**实际下载保存文件**直接运行完整 v11 APK gate，退出 0：81,552,289 B，SHA-256 `644919d57c690b54c56b26ed0ce91ec785d67a68e8e58eeaa6aed2946a5533fb`；v1/v2/v3=true，证书、版本、SDK、基线八项权限、两个签名块、精确三项原生库、引擎和网页包全部通过。澎湃 OS 3 仍仅作静态兼容性说明。

## 最终 ZIP 边界

round-72 新源码 ZIP 包含当前许可包、v1–v11、完整审计与诚实日志，不含引擎、ELF、构建缓存、密钥库或签名材料。最终 ZIP 的 verify、秘密扫描、大小、条目数和 SHA-256 属于 post-package 证据，外置到 recovery 与交付清单，不回写已验 ZIP 造成自引用。完整实施审计见 `verifier/runs/round72-audit.md`，恢复边界见 `verifier/runs/recovery-round72.md`。


# Regalia v1.2.3 — round-73 验证链补丁工作日志（2026-11-22 UTC）

## 基线与范围

根据新上传邮件的 6 条 actionable 意见加固 v11。补丁基线为当前远端 `upload` 提交 `f36e239e3a8b085e3c446620a32fcd57d6dfe996`；固定源码比较基线仍为 `f78317919818a02c1fa169a99b85cad6ebf8a1fe`。只修改验证器、追加式记录及已确认回退的 CI 元数据，不改棋类功能、Java 业务行为、APK、依赖、SDK、ABI、版本或权限，不执行远端写操作。

## 六项修复

- 目录成员在跳过内容前先占用共享成员预算；预算内目录仍通过且计数包含目录。
- 每个非目录成员在既有单成员和累计预算内完整 spool，再用 `zipfile.is_zipfile()` 按内容识别 ZIP；非 ZIP 后缀、shebang 或其他前导数据不能绕过递归。确认为 ZIP 后才执行嵌套大小与深度限制，归档后缀损坏仍 fail closed。
- 源码打包与秘密扫描共用实际 ZIP 内容识别入口；`payload.dat` 内嵌 ELF 会在发布前拒绝。
- `verifier/v11/verify-apk.py` 加入必需文件清单，源目录与 ZIP 同步删除也不能绕过。
- 最终源码 ZIP 在任何成员摘要、CRC 或 `archive.read()` 前先跑共享有界扫描；许可包及 source gate 也复用有界入口，保留原有 CRC 和当前字节一致性检查。
- wrapper 的 EXIT trap 仅清理临时文件；HUP/INT/TERM 分别完成日志与 history 后以 129/130/143 退出，保留中断前输出并记录信号。

## 自动解压元数据

当前远端再次缺 `.github/dependabot.yml`，CodeQL/MobSF 回退且 gradlew index mode 为 100644。按 round-72 已审字节恢复 C/C++ no-build、checkout 禁持久凭据、`mobsfscan==1.2.0`、Dependabot 周检与 gradlew 100755；未做额外 CI 重构。根 `LICENSE&NOTICE.zip` 未修改，后续人工更新继续优先，不以本轮观察值作为固定大小或哈希。

## 负向复现与回归

新增用例先在保留旧实现的隔离副本上分别复现：TERM 后输出/history/退出码错误、前导数据隐式 ZIP 被接受、目录未计费、许可包先 CRC、源码包先摘要、嵌套 ELF 被打包以及 verify-apk 双删被接受。修复后 v11 原语负测 **21/21**、隔离集成测试 **18/18**、固定基线 source gate **27/27**。高压缩率 129 MiB 合成成员在摘要或 CRC 前被成员预算拒绝，未实际执行无界解压。

既有回归 v1 **44/44**、v2 **27/27**、v3 **51/51**，r62 十三门全绿，r67-bench PASS，rename-only 十二项通过，JS 10 模块语法通过。网页包两次构建一致：24,393 行 / 1,500,732 B，SHA-256 `cc69b869077a72dc1367461c6567a47fea159d292fd5e3d207a2afef84f167b5`。本轮仅交付仓库相对路径补丁 ZIP，不生成 APK；补丁自身哈希不写入本日志，避免自引用。


# Regalia v1.2.3 — round-74 包装器中断修复补丁工作日志（2026-11-22 UTC）

## 基线与缺陷复现

根据新邮件的 1 条 Major 意见修复 v11 wrapper。补丁基线为当前远端 `upload` 提交 `677fcef5fa0ab47311632f8febfef90b79e67563`，固定源码比较基线不变。旧实现对子进程组发 TERM 时能够通过测试，但只向 wrapper PID 发 TERM 时，前台 `sleep 30` 仍使 Bash 延迟 trap；新增用例在 5 秒等待后以 `TimeoutExpired` 复现，未把该超时记作通过。

## 实施

- 子命令改为异步启动并保存 `$!`，wrapper 使用 `wait` 等待；正常完成仍保留子命令原始退出码。
- HUP/INT/TERM handler 在写最终日志前向本次子进程发 TERM 并 `wait` 回收，再保存完整 TMP 输出、history 和 129/130/143 状态；重复信号在 handler 内屏蔽。
- 异步子命令显式继承调用者 stdin，避免 Bash 对后台命令默认接 `/dev/null` 改变既有行为；管道输入实测通过。
- 新负测只向 wrapper PID 发 TERM，确认其及时退出 143、子进程已终止并回收、日志保留中断前输出且 history 指向同一日志；原进程组 TERM 用例继续保留。
- 自动解压通道再次漏掉 `.github` 更新与 gradlew 可执行位，本轮按 round-73 已审字节恢复 CodeQL、MobSF、Dependabot 和 gradlew 100755，不做额外 CI 重构。

本轮不改棋类功能、Java 业务行为、APK、依赖、SDK、ABI、版本或权限，不执行远端写操作。根 `LICENSE&NOTICE.zip` 未修改；后续人工更新继续优先，不以当前观察值作为固定大小或哈希。

## 验证结果

修复后 v11 原语负测 **22/22**、隔离集成测试 **18/18**、固定基线 source gate **27/27**、rename-only 十二项通过。既有 v1 **44/44**、v2 **27/27**、v3 **51/51**，r62 十三门全绿，r67-bench PASS，JS 10 模块语法通过。网页包两次构建一致，SHA-256 仍为 `cc69b869077a72dc1367461c6567a47fea159d292fd5e3d207a2afef84f167b5`。

本轮仅交付仓库相对路径补丁 ZIP，不生成 APK；补丁自身哈希不写入本日志，避免自引用。


# Regalia v1.2.3 — round-75 进程组与有界清理补丁工作日志（2026-11-22 UTC）

## 基线与缺陷复现

根据新邮件的 2 条 Major 意见继续加固 v11 wrapper。补丁基线为当前远端 `upload` 提交 `abbfc79f83d518136c5f55740db60819ce9eed21`，固定源码比较基线不变。旧实现下，非 `exec` 后代用例明确报告 `command lacked an isolated process group`；拒绝 TERM 的子进程使 wrapper 在 8 秒后仍以 `TimeoutExpired` 阻塞。两项失败均作为旧缺陷证据保留，未通过放宽断言获得通过。

## 实施

- 子命令通过 `setsid` 在独立进程组中启动，wrapper 仍保存并等待其直接子 PID；HUP/INT/TERM handler 只向该命令的负 PGID 发信号，不向调用者所在组发清理信号。
- TERM 后设置 2 秒有限宽限；独立 watchdog 不属于被清理进程组，超时向同一组发 KILL。handler 回收直接子进程，再取消并回收 watchdog，最后保留完整 TMP 输出、history 和原信号对应的 129/130/143 状态。
- 新负测分别覆盖 `bash -c 'sleep 30 & …; wait'` 的非 `exec` 后代，以及忽略 TERM 的循环子进程；断言独立组、直接子与后代消失、143 状态和日志/history 完整。原 `exec sleep 30`、进程组 TERM、正常退出码和并发日志用例继续保留，管道 stdin 另行实测通过。
- 自动解压通道再次漏掉 `.github` 更新与 gradlew 可执行位，本轮按 round-74 已审字节恢复 CodeQL、MobSF、Dependabot 和 gradlew 100755，不做额外 CI 重构。

本轮不改棋类功能、Java 业务行为、APK、依赖、SDK、ABI、版本或权限，不执行远端写操作。根 `LICENSE&NOTICE.zip` 未修改；后续人工更新继续优先，不以当前观察值作为固定大小或哈希，也不因历史差异回退。

## 验证结果

修复后 v11 原语负测 **24/24**、隔离集成测试 **18/18**、固定基线 source gate **27/27**、rename-only 十二项通过。隔离集成使用仅本地验证提交完成干净检出检查，未推送远端。既有 v1 **44/44**、v2 **27/27**、v3 **51/51**，r62 十三门全绿，r67-bench PASS，JS 10 模块语法通过。网页包两次构建与构建前逐字节一致，大小 1,500,732 B，SHA-256 仍为 `cc69b869077a72dc1367461c6567a47fea159d292fd5e3d207a2afef84f167b5`。

本轮仅交付仓库相对路径补丁 ZIP，不生成 APK；补丁自身哈希不写入本日志，避免自引用。


# Regalia v1.2.3 — round-76 完整进程组清理补丁工作日志（2026-11-22 UTC）

## 基线与缺陷复现

根据新邮件的 4 条 actionable 意见继续加固 v11 wrapper。补丁基线为当前远端 `upload` 提交 `f28bb65e9aea80a2a239a9286ecb67c10433ec33`，固定源码比较基线不变。该提交中的 gradlew Git index mode 实测为 100644，与 round-75 恢复记录不一致。

旧实现经新增负测复现：父进程响应 TERM 退出后，忽略 HUP/TERM 的孤儿后代仍存活；在 `CHILD_PID=$!` 前精确注入 TERM 会遗留已启动命令；组级 QUIT 用例在 8 秒后超时。首个 Bash 顽固孤儿夹具因旧看门竞态偶发碰巧通过，未作为有效证据；最终改用确定性 Python 父子夹具连续复现，未放宽任何断言。

## 实施

- 直接子进程退出不再取消 watchdog。handler 回收直接子进程后仍等待 watchdog 完成 2 秒有限宽限并发出组级 KILL，再回收 watchdog、保存日志和 history；正常命令完成路径不进入该宽限流程。
- 启动信号在 `$!` 记录前只暂存首个 HUP/INT/QUIT/TERM，记录 PID 后立即进入统一清理。后台子壳先恢复默认信号处置再 `exec setsid`，避免暂存期间的忽略状态遗传给命令。
- 清理同时处理直接 PID 与本次命令的独立负 PGID：前者覆盖 setsid 尚未 exec 的窗口，后者覆盖全部后代；不向调用者所在组发送清理信号。组级 QUIT 由 wrapper 捕获并触发同一有界清理，按 131 落盘。
- 原后代与 TERM-refusal 用例的进程消失及独立组断言移到 `try` 内的兜底清理之前；`finally` 仅在断言失败后负责收尾。新增顽固孤儿、PID 赋值前精确中断和组级 QUIT 三项负测，总数增至 27。
- SIGKILL 不可被 Bash 捕获，本轮不声称 wrapper 被外部 KILL 后仍能自我清理；未引入额外常驻监督进程。保留 setsid 隔离、stdin、输出、history 和正常退出码语义。
- 自动解压通道再次回退 `.github` 与 gradlew 模式，本轮按已审字节恢复 CodeQL、MobSF、Dependabot，并同时验证工作树及 Git index 中 gradlew 均为 100755，不做额外 CI 重构。

本轮不改棋类功能、Java 业务行为、APK、依赖、SDK、ABI、版本或权限，不执行远端写操作。根 `LICENSE&NOTICE.zip` 未修改；后续人工更新继续优先，不以当前观察值作为固定大小或哈希，也不因历史差异回退。

## 验证结果

修复后 v11 原语负测 **27/27**、隔离集成测试 **18/18**、固定基线 source gate **27/27**、rename-only 十二项通过。隔离集成使用仅本地验证提交完成干净检出检查，未推送远端。既有 v1 **44/44**、v2 **27/27**、v3 **51/51**，r62 十三门全绿，r67-bench PASS，JS 10 模块语法通过，管道 stdin 实测通过。网页包两次构建与构建前逐字节一致，大小 1,500,732 B，SHA-256 仍为 `cc69b869077a72dc1367461c6567a47fea159d292fd5e3d207a2afef84f167b5`。

本轮仅交付仓库相对路径补丁 ZIP，不生成 APK；补丁自身哈希不写入本日志，避免自引用。
