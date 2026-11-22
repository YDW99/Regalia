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
