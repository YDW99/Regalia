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


# Regalia v1.2.3 — round-77 持久化原子性与 Release 重建工作日志（2026-11-23 UTC）

## 基线与范围

权威起点为远端 `upload@6fe34dde16767b6b31fa2f8f1a6d3ab5e6f907b6`，固定源码比较基线仍为 `f78317919818a02c1fa169a99b85cad6ebf8a1fe`。环境重置后使用精确提交的 CRC 校验归档重建工作树；本地恢复提交不冒充上游哈希。按已审内容恢复 Dependabot、CodeQL、MobSF 和 gradlew 100755，保留当前远端 `LICENSE&NOTICE.zip`，未用历史副本覆盖。

本轮只处理 eval/PGN/tags 覆盖写、持久化失败结果传播和网页并发构建临时文件竞态。不重写引擎生命周期、UI 或 Binder，不做无 profiling 支撑的性能改造，不改变依赖、SDK、NDK、ABI、版本或权限，不执行远端写操作。

## 实施

- 新增 GPL v3 `AtomicFileStore.java`：在目标同目录创建唯一临时文件，完整 UTF-8 写入后执行 flush、文件描述符 sync 和 API 23 可用的 `android.system.Os.rename` 原子替换。替换成功前不删除或截断旧文件；失败只清理由本次调用拥有的临时文件，不使用 API 26 才有的 NIO 路径。
- eval 缓存及 PGN、tags 的三处直接覆盖写统一改用该共享原语，保留原有缓存入口、LRU、读取上限和外层异常语义。
- `persistentSetSync` 改为返回 `SharedPreferences.Editor.commit()` 的真实布尔结果。JS 只有在专用文件或同步 SharedPreferences 至少一个明确成功时才清除 dirty；localStorage 单独成功仍只是 best-effort。失败保留 dirty，后续 flush 或 mutation 可重试，不新增无限自动重试。
- `build-chess.py` 使用每进程唯一的同目录临时文件，flush、fsync 后 `os.replace`，避免并发进程共享或清理同一个 `chess.html.tmp`。
- 更新两级许可台账：AGPL 保持 7 个文件，GPL 增为 13 个文件，Java 总数增为 16；历史 Round-71 计数不改写。

## 已执行验证

源码接线 **24/24**；JS 持久化 **19/19**；真实生产 `AtomicFileStore` 经 host-only Android 替身测试 **11/11**，含 96 路并发、Unicode、完整覆盖和注入 rename 失败保留旧字节。40 对、80 个并发网页构建进程 failures=0、temporary_residuals=0，结果确定；当前 bundle 为 1,500,801 B、24,391 行，SHA-256 `ae15d2b699624e549745582b5835d35418ff77b51a08ae704915a0d643e6c9e0`。

既有 v1 **44/44**、v2 **27/27**、v3 **51/51**，r62 十三门、r67-bench 和 v11 原语负测 **27/27** 均通过。v13 source gate **31/31**、v13 隔离集成 **18/18**。历史 v11 集成在 Round-72 恢复树上通过 **15/15**；归档通道缺失的 Dependabot 及回退的 CodeQL/MobSF 元数据先按已审字节恢复，首次失败和诊断日志均保留，未修改历史验证器或删除失败证据。

语法检查覆盖 10 个 chess.src JS 模块、1 个真实生成内联脚本及全部 11 个 v13 Python 文件。签名环境下 `compileReleaseJavaWithJavac` 的真实 runner 记录为 exit 0、BUILD SUCCESSFUL；既有弃用警告未作为新缺陷隐藏。所有验证均由 v13 runner 保存带时间戳的命令、退出码和输出，外层通道超时没有被伪记为数字退出码。

NDK 受损安装缺少整个 `build/` 目录；官方 ZIP 的大小与 SHA-256 已匹配，恢复目录内 88 个 regular files 时逐成员读取并通过 ZIP CRC，随后 NDK revision、clang、正确 aarch64 libc++ 路径及 CMake toolchain 布局门通过。完整 ZIP CRC、Release APK 与最终交付验收以各自最终 runner 记录为准；未进行物理澎湃 OS 3 设备测试。

## Release 构建与最终 APK 验收

官方 NDK ZIP 的完整 CRC 已在独立 runner 中完成，exit 0；9,277 个成员、revision 27.2.12479018、CMake toolchain、clang 与正确 aarch64 libc++ 路径均通过。签名环境下 `assembleRelease --no-daemon --stacktrace` 的真实记录为 exit 0、BUILD SUCCESSFUL（25m17s，51 个 actionable tasks）。未把进程启动、缓冲日志或阶段输出当作构建成功。

构建产物及交付 inode 均通过 v13 实际 APK 门：Release 非 debuggable，`com.Regalia`／10203／1.2.3，minSdk 23、targetSdk 35、arm64-v8a，八项权限不变；原生库精确为 Stockfish、engine_bridge、libc++_shared 三个，引擎和当前 chess.html 逐字节匹配。v1/v2/v3 均为 true，单 signer，证书 SHA-256 与上传 key 对应值一致，v2/v3 Signing Block 结构存在且通过 apksigner。APK 为 81,552,039 B，SHA-256 `f7999994cb601a2d8892f14788e73e9ab26ee366e1f5cb74891085dddd1c9c0a`。

交付挂载当前对以 `.apk` 命名的文件读回返回 EIO，历史 APK 也呈现相同行为，而旧源码 ZIP 与 NDK 可读。首次最终路径验收失败记录完整保留，没有将其伪称为通过。随后对交付文件本身仅以非 APK 别名改名，确认 dev/inode 不变后读回并重新运行完整 v13 APK 门，exit 0、摘要与构建产物一致；最后只 rename 回正式 APK 文件名，dev/inode/size 保持一致，没有复制、覆盖或替换已验收字节。该记录不构成物理设备测试；澎湃 OS 3 仍仅完成静态兼容性核验。

源码 ZIP 验收器另将 gradlew 的归档模式收紧为必须恰好 0755；收紧后语法检查、v13 集成 **18/18** 和固定基线源码门 **31/31** 已重新通过。最终源码包与秘密扫描结果以各自交付后 runner 记录为准，源码 ZIP 自身哈希不写入本日志，避免自引用。

# Regalia v1.2.3 — round-78 剩余缺陷修复补丁包工作日志（2026-11-23 UTC+8）

## 基线与范围

以用户上传的 round-77 源码包（`Regalia-v1.2.3-round77-源代码.zip`，399 文件，其内容与远端 round-77 交付声明一致）为只读基线。本轮为**补丁包交付**：不创建提交、不触碰远端、不改 versionCode 10203、不动 Manifest 权限声明、不动 `LICENSE&NOTICE.zip`、不动引擎身份与 C++ 载荷、不改 chess.src（chess.html 交付物及其确定性哈希不受影响）。

处置范围来自 round-77 验收复核报告 §6 的建议与本轮用户指令「实施所有值得实施的措施」：ROB-02/03/04/06/07 残留/08/09、RED-01（除 ai-bridge.js 项）与 RED-02。**明确排除**：ROB-05 与 RED-01 的 ai-bridge.js 项——两者都要求改 `chess.src/ai-bridge.js`，会连带 chess.html 重建、既有 24,390 行交付哈希失效并牵动 APK 重打包链条，超出「源码级补丁」的合理边界，留待下一个有功能理由的 JS 轮次。

## 实施（16 个文件）

- **ROB-08**：`.gitignore` 追加 `.gradle-dumps/` 与 `*.hprof`；`gradle.properties` 的 round-56 "git-ignored" 失实注释补 round-78 更正说明。
- **ROB-07 残留**：`mobsf.yml` checkout 补 `persist-credentials: false`；扫描步骤去掉 `|| true`，改为「退出码与 SARIF 产物合法性双通道」——exit 1 且产物合法（findings，信息级）放行，任何退出码且无合法 SARIF（扫描器崩溃/命令缺失）fail closed（exit 3）。
- **ROB-06**：`unzip-folder-optimized.yml` 三处——保护路径删除改为**任意深度**（`-type d -path '*/.github/workflows'`、`-name '.git'`（目录与 gitfile 两种形态）、`-name 'gradle'` 目录树级删除），find 错误不再被 `2>/dev/null || true` 吞没；`git stash pop --index` 冲突即终止（`git stash list` 门控避免干净运行误伤）；staging 改为按解压载荷清单 `git add`（与既有注释一致，不再 `git add -A` 混入无关本地改动；upload.zip 的删除单独显式 stage）。
- **ROB-04**：`EngineSettingsHelper.java` 导入改为两阶段事务——全部行 validate 通过才 apply（全或无）；布尔只接受明确 true/false（`parseStrictBoolean`，`Boolean.parseBoolean` 的静默 false 映射移除）；未知键/非法数值/非法布尔整体拒绝且逐行错误进入消息；JS 回调 JSON 新增 applied/rejected/clamped 计数（向后兼容）。
- **ROB-02**：`FileIoHelper.readTextFile` 改 8K chunk 读取、append 前检查上限（多 GB 无换行单行不再先物化后拒绝）；输出契约与旧 readLine 循环**逐字节等价**（CR/LF/CRLF→LF、末行补 \n）；上限拆为字节预检（File.length()）与 UTF-16 chars 读中守卫两个显式单位常量。
- **ROB-03**：`PgnCacheManager` save/get/getTags 加单文件上限（16 Mi chars 写 / 32 MiB、1 MiB 读，单位逐常量注明）；`evictIfNeeded` 统计口径限定受管文件（.pgn/.tags.json），杂散文件不再把总量钉在预算上导致淘汰循环删光 PGN（隔离不删）；`StockfishNative.loadEvalCacheSync` 加 16 MiB 字节预检 + 读中 chars 守卫，超限 fail closed 返回 null 由 JS 重建。
- **ROB-09**：`PgnCacheManager.rename` 的「PGN 已重命名而 tags 丢失/删除失败」从返回 true 改为返回 false（部分成功显式化；boolean 签名保留以维持 @JavascriptInterface/JS 协议不变，结构化状态枚举留待下一个 JS 联动轮次）。
- **RED-01**（5 处非 JS 注释）：`build.gradle:263` JDK 21 表述改为「toolchain 可为 JDK 21，语言级固定 17」；`AndroidManifest.xml` round-46 更正段追加 round-78 现状（res/xml 仅 network_security_config.xml，两个规则文件已不在树中，勿按旧注恢复）；`CMakeLists.txt` nativeRenice/sys/resource.h 注释改为「仅 nativeChmod 保留（nativeRenice 于 round-48 RED-3 删除）」；`assets/README.license` 的 screenshot.png「PNG format fallback」失实描述就地更正（byte-identical JPEG copy）+ 头部追加 round-78 台账条目（保留 round-28 历史措辞的更正记录，不改写历史事实）。
- **RED-02**：`TlsSecurityHelper.verifyDeviceIntegrity()` 永真桩**删除**（返回值无任何调用方消费）；其 SafetyNet 静态分析引用移入 `init()` 并显式标注「satisfier only, no runtime effect」；`ChessApp` 调用点同步清理。MobSF 三个模式的代码可见性保持（不破坏 mobsf-gate 既有基线）。
- 台账：`src/main/java/com/Regalia/README.license` 头部追加 round-78 条目（许可分类不变：AGPL 7 / GPL 13，未改写历史计数）。

## 本环境已执行验证与边界（如实声明）

**已执行**：6 个修改 Java 文件中 5 个经 javalang 完整语法解析通过；`StockfishNative.java` 因 javalang 0.13 不支持 Java 16+ instanceof 模式匹配（原文件 :1466 起即无法解析，与本轮修改无关）改为：全文件词法 tokenize 通过（19,953 tokens）+ 修改区段（EVAL_CACHE 常量与 load/saveEvalCacheSync）提取入独立壳类**完整语法解析通过** + 新旧文件括号配对差值与意图吻合（braces +2/+2）。两个 workflow 经 YAML 结构解析（jobs/steps 完整）；AndroidManifest 经 XML 解析；mobsf heredoc 缩进一致性验证；旧方法（applySettingLine/verifyDeviceIntegrity）残留引用为零；staging 与 round-77 基线逐文件 diff 复核（变更集精确锁定 16 个意图文件，无意外触达）。

**边界（用户侧必须执行的验收）**：本补丁包**未经 `compileReleaseJavaWithJavac` 编译验证**（交付环境无 JDK，仅有 JRE 21；语法验证到 javalang 层）。应用补丁后须在签名环境执行：v13 source gate 允许子集核对（Java 改动属 source-gate 纪律范围，基线 `f783179…` 须用户侧持有）→ v1/v2/v3、r62、r67、v11 负测 27/27 全量回归 → `compileReleaseJavaWithJavac` 与 `assembleRelease` → APK 重建/重签与 v13 APK 门（chess.html 不在本轮改动内，交付哈希 `ae15d2b6…` 应保持一致，可作为回归锚点）。ROB-04 行为变化（导入事务化）与 ROB-09 返回语义变化建议各配一次设备级冒烟（导入含错行文件、重命名含标签条目）。push/merge 前须取得用户明确确认；`LICENSE&NOTICE.zip` 永不回退。

补丁包内含 `PATCH-NOTES.md`（逐文件改动说明与应用方法）；worklog 本条目不自称任何未在本环境实际执行的门禁结果。

---

## v1.2.3 round-79 (2026.11.23)：剩余项一次性正确落地（PR #60 复核 + CodeRabbit/SonarCloud 意见吸收）

本轮以 round-77 源码包为实施基准，把 round-77 验收后剩余的 ROB-02/03/04/06/08/09、ROB-07 残留、RED-01/02 与 CodeRabbit 对 PR #60（round-78）的全部可操作评论、SonarCloud PR #60 的 9 项 OPEN 问题一次性正确落地。round-78 曾引入的 `StringWriter.size()` 编译阻断错误不在本轮产物中 —— 全部读取循环统一使用 `sw.getBuffer().length()`（java.io.StringWriter 没有 size() 方法）。

### Java 载荷（六文件）

- EngineSettingsHelper（ROB-04）：导入重构为两阶段 validate→apply；未知键、非整数、非布尔、空值在应用任何设置之前以 "line N: reason" 拒绝整份文件；exportSettings() 产出的 engine.name / engine.path 只读元数据键被识别并跳过（round-78 严格化误伤"自导出配置无法恢复"的问题不复现）；布尔仅接受显式 true/false；0 个有效键不报成功；诊断与键名常量化（SonarCloud S1192 ×4）；校验返回 String 而非 Boolean-null（S2447）。
- PgnCacheManager（ROB-03/09）：PGN 写 32MB（UTF-8 字节写前）/ 读 64M chars；标签 1MiB 对称上限（getTags 文件级+读循环级，setTags 序列化字节写前检查、超限保留旧文件并返回 false）；rename 的"PGN 已改名但标签丢失/迁移失败"部分成功返回 false 并要求调用方刷新列表；evictIfNeeded 预算只统计受管文件（.pgn 与 .tags.json）、孤儿标签为第二优先淘汰候选、杂散文件受控忽略、淘汰排空仍超限输出警告；setTags 嵌套 try 提取为 clearTagsFile（S1141）。
- StockfishNative（ROB-03）：loadEvalCacheSync 增加 16M chars 读循环上限与 16MB 文件级上限；saveEvalCacheSync 增加 16MB 写前上限（超限拒绝、旧正式缓存保持原样）。
- FileIoHelper（ROB-02）：readTextFile 弃用 readLine 整行物化（先物化后检查），改为 8KB char[] 流式读、追加前判限；文件级字节上限与循环级字符上限常量拆分并注明口径关系。
- AtomicFileStore（SonarCloud S899）：失败清理路径的 temp.delete() 返回值记录（清理失败记 Log.w），原始写入/替换失败仍优先上抛。
- TlsSecurityHelper（RED-02）：文档透明化 —— Class.forName 满足器明确标注为"非运行时防御"，永真 verifyDeviceIntegrity 明确标注为"显式不适用、不得用作授权依据"；无行为变化（MobSF 可见性保持）。

### JS 与网页包

ui.js 的 _pgnCacheRename 失败分支刷新缓存列表并重渲染（与 rename false 语义闭环，CodeRabbit PR#60）；ai-bridge.js 的两处桥接 catch 记录异常（SonarCloud S2486），eval-cache 写策略注释合并为当前混合策略 + 2000-entry 规模的单一叙述（RED-01④，过时的 60k-entry/~12MB 数字不再以现状口吻出现）。chess.html 由 build-chess.py 确定性重建：24,388 行 / 1,500,518 字节，连续两次构建字节一致，SHA-256 `9e356a3cd3851730f17bf5719aace76f35d0c6b4619b87c78a63aeaa985f0a32`。

### 仓库卫生与 CI

.gitignore 落地 `.gradle-dumps/` 与 `*.hprof` 两道规则（ROB-08，gradle.properties 注释同步更正）；mobsf.yml 补 `persist-credentials: false`，`|| true` 改为区分"有 SARIF 的 findings 退出"（预期，告警后继续上传）与"无报告的工具失败"（fail closed）（ROB-07 残留）；unzip-folder-optimized.yml 重写：python3 结构化 ZIP 预检（任意层级保护路径、穿越/加密/预算/成员数/自覆盖检查，危险输入失败即终止；保护条目结构化跳过并告警，通道功能保持）+ 并发串行化（concurrency）+ stash push/pop 失败即终止 + manifest 驱动 staging（git add --pathspec-from-file，与"Stage only the extracted files"的注释终于一致；旧实现 git add -A 与注释直接矛盾）（ROB-06）。RED-01 六处注释更正：JDK 17 工具链口径（build.gradle）、备份规则文件已删除勘误（AndroidManifest）、nativeChmod-only（CMakeLists）、写策略单一叙述（ai-bridge）、.gitignore 落地对齐（gradle.properties）、账本条目（assets/README.license 追加 round-79 记录）。

### verifier 加固（v9/v10/v11/v13；v4–v8 历史与已标 superseded 的 v9/verify-apk.py 不动）

- archive_scan（v11+v13 同构同修）：EOCD 中央目录预检（解析前限制元数据资源）+ infolist 后按实际记录数执行成员上限 + 目录条目纳入重复成员检查 + 先路径/加密检查再拒带数据的目录条目（CodeRabbit #10/#11/#12）。
- source_archive（v11+v13）：pack 拒绝覆盖受保护输入（LICENSE&NOTICE.zip 及任何载荷源文件）+ 发布前对临时 ZIP 执行与 verify 相同的有界扫描 + verify 全程单一文件对象并就地报告身份（#21/#22/#23）。
- source_archive（v9+v10）：mkstemp 独占临时文件、jniLibs 小写两口径匹配修复、verify 单文件对象（#29/#30/#7）。
- secret_scan（v9+v10）：诊断 label 先遮蔽已知密码（#28）；v11：源码枚举失败转不含路径诊断并 from None（#20）。
- verify-apk（v10/v11/v13）：uses-permission-sdk-23 声明纳入基准权限集合、APK 私有副本（所有检查与身份报告针对同一副本、原路径在副本后不再重开）、v11 固定批准身份前置检查（#8/#9/#27）。
- source-gate（v11）：解析两清单 XML 比较权限元素（含 sdk-23 与 maxSdkVersion）、-z NUL 分隔路径枚举、inherited_unchanged 同时比较内容与 index/tree 模式（#24/#25/#26）。
- rename-only-proof（v11）：re.subn 且每个标识符至少命中一次（#17）。
- negative-tests（v11）：expect_failure 增加预期诊断片段并逐用例标注（I/O 错误不再算作预期拒绝）、中断历史断言先按 label 筛选；新增中央目录预算/重复目录/带数据目录三个负测（原语负测 27→30）（#14/#15 + 新防线佐证）。
- run-and-log（v11+v13）：finish 状态化 —— 日志写入成功才追加历史；子进程退出码保留，证据写失败不报验证成功（75）（#18/#19）。
- browser-download（v11）：唯一临时文件保存下载，大小+SHA-256 双校验通过才原子替换目标，失败清理临时（#13）。

### v13 source gate 适配（31→37 检查）

允许集扩展至 round-79 变更面（Java 新增 EngineSettingsHelper/FileIoHelper/TlsSecurityHelper；.gitignore、AndroidManifest、CMakeLists、assets 两账本、chess.src/ui.js、unzip workflow、build.gradle、gradle.properties 入 allowed_exact）；build.gradle / gradle.properties 从逐字节不变改为构建语义不变断言（SDK/NDK contract 与 jvmargs 块；settings.gradle 与 wrapper 仍逐字节不变）；新增六项断言：.gitignore 落地、MobSF checkout credentials、gradle 语义、只读元数据键跳过特征、部分改名可观测特征、tracked 文件模式白名单（内容快照基线看不到模式位变更，此为其可执行等价物）。

### 本轮静态验证（沙盒内完成）

17 个改动 Python 文件 py_compile 全部通过；v11/v13 run-and-log.sh bash -n 通过；ui.js/ai-bridge.js node --check 通过；mobsf.yml 与 unzip-folder-optimized.yml YAML 解析通过；AndroidManifest.xml XML 解析通过；六个 Java 文件 javalang 语法级解析通过（StockfishNative 的 Java 16 instanceof 模式匹配以等价改写后全文件解析验证，round-77 原版在同位置受 javalang 版本能力限制属既有现象）；chess.html 两次重建字节一致；全部修复特征断言（约 90 项）逐一验证在文件内存在。APK 未重建（本轮全部为源码/脚本/配置变更，versionCode/引擎身份/权限/protected zip/APK 均不动）；v13 门禁重跑、v1/v2/v3 与 r62/r67 回归、v11 负测与 APK 重建重签由仓库侧按惯例执行——EXPECTED_BASE_TREE_SHA256 基线树常量与外部基线目录（f783179）由仓库侧维护，应用步骤与门禁重跑指引见补丁包内 PATCH-NOTES.md。

（本条目为追加文件落地：`cat worklog-round79-append.txt >> worklog.md`，不整体覆盖 worklog.md，以保护 round-78 的既有日志行。）

---

## v1.2.3 round-80 (2026.11.23)：CodeRabbit 复审 25 项 + SonarCloud 5 项落地 + 自动解压通道丢件补投

本轮实施基准为 GitHub `upload` 分支当前树（round-79 补丁应用后状态；经 SHA-256 逐文件核对，38 个文件中 35 个与 round-79 补丁逐字节一致，`.gitignore`、`.github/workflows/mobsf.yml`、`.github/workflows/unzip-folder-optimized.yml` 仍停留在 round-76 原始状态——补投原因见下）。输入源：用户上传的 CodeRabbit 对 PR #60（round-79 变更）的复审邮件（25 条可操作评论 + 1 条 diff 外评论）、SonarCloud PR #60 OPEN/CONFIRMED 5 项、《回复复查(2026.11.23)》元级复核意见。

### 通道丢件根因与补投（round-79 遗留三项）

经 GitHub API 取回上传 blob 与 round-79 补丁包逐字节比对确认：用户侧把补丁包重新打包为 upload.zip 上传时（重打包时间戳 13:39，SHA-256 不同于补丁包），点文件（`.gitignore`、`.github/`）与交付说明文件（PATCH-NOTES.md、worklog-round79-append.txt）未进入重打包的 zip；且 `unzip-folder-optimized.yml` 的 find -delete 也会在解压阶段删除 `.github/workflows/*` 条目（通道自身设计如此，另有 round-67/.gitignore 头部注释的历史佐证）。因此 ROB-06/07/08 的修复自 round-78/79 起从未真正落进仓库——当前分支的 mobsf.yml 仍是"未固定版本 + 无 persist-credentials + `|| true`"的原始状态，unzip workflow 仍是"嵌套前缀绕过 + `|| true` 吞 stash 冲突 + git add -A"的原始状态，.gitignore 仍缺 `.gradle-dumps/` 与 `*.hprof`。本轮把这三个文件按 round-79 已交付版本原字节补投进补丁包；**应用方式变更**：这三个文件（及 worklog 之外的 dotfile）必须经 GitHub 网页编辑器或直接 git push 落库，不能指望 upload.zip 通道（详见 PATCH-NOTES.md 第 0 节）。

### Java（3 文件）

- EngineSettingsHelper（CodeRabbit 复审 #1 + SonarCloud S135/S1192 + 复审 #2 解析侧）：engine.threads 下限 1 恢复（round-79 重构丢了 Math.max(1,...)，导入 0/负值原样保存；下限钳制计入 clamped）；设置解析器改为 split("\\r\\n|\\r|\\n") 同时接受裸 CR/LF/CRLF（round-79 的字节忠实流式读保留裸 \\r，而 split("\\r?\\n") 不拆裸 CR 行，整份导入被拒）；"importSettings: " 前缀常量化（S1192）；validateSettings 循环单一 continue——元数据跳过改 if/else（S135）。
- FileIoHelper（复审 #2 注释侧）：round-79"流式读保留原始换行形态不影响解析"的失实注释就地更正（交叉引用 round-80 解析器修复）；无行为变化。
- PgnCacheManager（SonarCloud S1192/S9412）：" bytes): " 上限拒绝日志后缀常量化（CAP_REFUSAL_BYTES_SUFFIX）；evictIfNeeded 两处 Collections.sort 改 List.sort。

### JS 与网页包（SonarCloud S3776）

ai-bridge.js：openEngineConfig 的两个 try/catch + 回退三元对提取为共享 _bridgeJsonQuery 助手（行为逐语义保持：桥返回假值仍为 null、异常仍记录、调用方回退仍生效），认知复杂度 16 → 阈值 15 以内。chess.html 由 build-chess.py 确定性重建：24,403 行 / 1,500,928 字节，连续两次构建字节一致，SHA-256 `ff7036920da6e33f7502464dfd5372f5500f8408f1c499d8279913560ae01cf2`。

### verifier（16 文件）

- secret_scan（v9+v10，CodeRabbit 复审 Major）：诊断改为扫描器生成的"阶段#序号"不透明标识，路径/成员名彻底不进诊断——round-79 的 `<masked>` 占位符在密码为 "masked" 的子串（"mask"/"ask"/"ed"…）时本身内含密码，两个失败诊断仍会打印它（采用 v11 的既有设计）。
- source_archive（v9+v10）：verify 先以 O_RDONLY|O_NONBLOCK 打开并用 os.fstat 校验为普通文件（FIFO 无写入方时 open("rb") 永久阻塞，round-79 的 open 后 is_file 检查恰好不可达）；pack 的 size/SHA-256 改为发布前从本次已完成的临时文件计算（发布后 output.stat() 可读到并发写手的归档）；source_zip_sha256 输出 hexdigest（此前输出哈希对象）；jniLibs 识别改为连续 src/main/jnilibs 三组件匹配（round-79 子串形式连 src/main/jniLibsBackup/README.md 一并拒绝，对齐 v11/v13 实现）。
- source_archive（v11+v13）：source_zip_sha256 输出 hexdigest；pack 统计同样改为发布前从临时文件计算；pack 恢复对 verifier/runs/*-selftest-source.zip 的显式重建（round-79 的一律拒绝使集成测试对树内自测产物的第二次 pack 提前失败；_is_rebuildable_test_artifact 仅放行该命名模式，许可证与普通源文件仍受保护）。
- source_archive（v13 附加）：BUNDLE_SHA256 更新为本轮重建后的 chess.html（`ff703692…`）——round-79 重建了 chess.html 却把该 pin 留在 round-77 值（`ae15d2b6…`），打包-校验对必然失败"source bundle hash mismatch"（round-79 交付引入的失配，本轮交叉核对发现）。
- archive_scan（v11+v13 同构同修，CodeRabbit 复审 Major）：中央目录预检镜像 CPython 3.11 解析器的 ZIP64 语义——EOCD 前 20 字节存在 PK\\x06\\x07 定位记录即意味着解析器采用 EOCD64 的 64 位目录大小（与经典字段是否 0xFFFFFFFF 无关），预检据此取 EOCD64 值；无法确定有效大小时（无 EOCD、定位记录而无完整 EOCD64）fail closed 拒绝；预检自身的 I/O 错误进入与解析器相同的不透明诊断边界（路径移走后的裸 OSError 会把原路径打进回溯）。
- browser-download（v11，两条 Major）：临时文件所有权范围覆盖 browser.close() 与 playwright 上下文退出（close 失败此前逃出内层 except，download() 不返回、临时文件无人清理；现在任何退出阶段失败先删临时再上抛，全部成功后才把路径交给 main）；main() 的 JSON 输出移入临时清理 try 内（打印在 try 之前失败会把完整下载的 APK 临时文件留在输出目录）。
- negative-tests（v11）：中断历史按实际行数计数（round-79 的 set 压平了两条相同行，双重记账仍过 ==1 检查；现按 TSV 第 2 列完整 label 字段筛选列表计数）；中央目录超限负测构造夹具后对被测模块 ZipFile 构造器设 spy 并断言未被调用（此前只查错误文本——先解析再拒绝也会通过；错误文本断言保留）。
- rename-only-proof（v11，Major）：基线先做词法去注释/去字符串，每个标识符必须在代码形态中命中"TYPE name(params) {"方法声明——round-79 的 re.subn 把注释提及也算命中，基线声明已改名而注释残留时可"通过"而不证明任何东西；subn 变换与全文比较保留。
- run-and-log（v11+v13）：finish 的日志写入改为 set -e 子shell 逐条执行——round-79 的 if ! {…} 只看组内最后一条命令（cat），中段 printf 失败（磁盘满）而 TMP 为空时组状态仍为 0，历史条目指向截断日志；cat ""$LOG"" 改 cat "$LOG"（路径含空格时词拆分，日志无法输出且 return 0 掩盖）。
- source-gate（v13，两条）：build.gradle / gradle.properties 恢复真实比较——改为"有效形态"比较（Gradle 注释/属性注释剥离、字符串字面量保留、注释删除遗留的空行归一）：round-79 把 build.gradle 从字节比较中移除后依赖声明变化不再触发失败、gradle.properties 的子串断言可被"注释保留 false + 生效行改 true"满足；有效形态比较拒绝实际依赖/配置变化，同时放行 round-79 的注释更正（检查数 37→38）。

### 账本

src/main/java/com/Regalia/README.license、chess.src/README.license、assets/README.license 顶部各追加 round-80 条目（许可分类不变：AGPL 7 / GPL 13 / 16 Java 总数；不改写历史计数）。

### 本轮沙盒验证

12 个改动 Python 文件 py_compile 通过；v11/v13 run-and-log.sh bash -n + 真实运行（退出码/日志/历史三元正确）通过；ai-bridge.js node --check 通过；chess.html 两次重建字节一致；archive_scan 预检对普通 ZIP/合法 ZIP64/经典字段+敌意 EOCD64/不可确定四类夹具功能验证通过（敌意组合正确拒绝、普通与合法 ZIP64 通过）；v13 集成 test_archives 全绿（含树内自测产物双重 pack——round-79 起即失败的场景、pack 统计发布前计算、hexdigest、新 BUNDLE pin）；v9/v10/v11/v13 source_archive 打包流程功能运行通过；mobsf.yml / unzip-folder-optimized.yml YAML 解析通过。APK 未重建（全部为源码/脚本/配置变更，versionCode/引擎身份/八项权限/protected zip/APK 均不动）；v13 门禁全量重跑、v1/v2/v3 与 r62/r67 回归、v11 负测与 APK 重建重签由仓库侧按惯例执行。push/merge 前须取得用户确认；`LICENSE&NOTICE.zip` 永不回退。
