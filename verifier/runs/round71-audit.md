# Regalia v1.2.3 round-71 实施与交付审计

日期：2026-11-22（UTC）。基线：PR #59 head `f78317919818a02c1fa169a99b85cad6ebf8a1fe`，head 分支 `upload`，base 分支 `main`。本轮未合并 PR、未关闭 issue、未删除分支、未解决 review thread，也未推送或改写远端状态。

## 1. 范围与实施

- 三个 Java 文件仅机械重命名实际存在的十二个下划线前缀方法：`StockfishNative.java` 八个、`StatsActivity.java` 三个、`EngineService.java` 一个；同步调用点。`verifier/v6/rename-only-proof.py` 对 HEAD 逐文件执行声明替换后逐字节比较，结果为 `RENAME-ONLY PROOF V2 OK: 12 methods, 3 files, no other byte changes`。
- 未改反射或 JNI 标识符；未全局改写历史手册中的历史名称；未改应用依赖、SDK、ABI、版本、权限或构建参数。
- `.github/workflows/codeql.yml` 恢复 `c-cpp` 的 `build-mode: none` 并设置 `persist-credentials: false`；注释承认已跟踪的 `engine_jni.cpp`/`CMakeLists.txt`。
- `.github/workflows/mobsf.yml` 固定 `mobsfscan==1.2.0`；新增 Gradle/GitHub Actions 的 Dependabot 周检配置。`gradlew` 文件系统与 Git index 均为可执行，index mode `100755`。
- 更新两级 license ledger、MobSF 评论边界与 round-70 历史审计勘误。根 `LICENSE&NOTICE.zip` 保持 56,011 字节且相对 HEAD 未改。

## 2. 安全与数据边界

- 签名材料只经构建时环境变量使用。口令永不写入任何文档/交付物；密钥库/口令永不入仓库、tar、zip 或本指南。日志只含命令、退出码和非敏感验证输出。
- 上传密钥库身份检查通过：keystore SHA-256 `6a44f6607f4ed90fa6f4c52bedb8626d22ef285ba4127b68dd26975aaa522ccc`，alias `regalia`，证书 SHA-256 `45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc`。
- 未新增权限或网络行为。`AndroidManifest.xml` 相对 HEAD 逐字节未改；基线本来就声明 INTERNET，本轮没有擅自删除。最终 APK 的八个权限名与基线精确一致。
- MobSF 1.2.0：223 个逐行标记；当前树 SARIF `executionSuccessful=true`，8 total / 0 android_logging；剥标记副本 `executionSuccessful=true`，267 total / 259 android_logging。v7 的八段唯一 span 门禁通过。进程退出 1 是存在 findings 的预期行为，接受依据是 SARIF 成功标志及精确结果，不是把退出码强行当 0。
- PMD 7.4.0 使用项目 quickstart 减 ControlStatementBraces 规则集：基线 422 total / 12 MethodNamingConventions；最终 410 total / 0 MethodNamingConventions。两轮均 ControlStatementBraces=0、UnusedPrivateMethod=1、SingularField=3。

## 3. 恢复与验证器诚实记录

- 持久挂载上的克隆出现 checkout/index 异常后，改用本地磁盘干净克隆并核对精确 HEAD；未把损坏工作树当作交付源。
- 丢失的原始日志没有伪造。`verifier/runs/recovery-round71.md` 明确区分持久摘录与幸存原始日志。
- v4–v10 全部保留。v4 的十三方法说法、v5 的错误版本假设与重复 MobSF span、v7 的错误 v2 ID/stockfish-only 说法、v8 的两库集合、v9 的错误 no-INTERNET 断言均由后续版本勘误，没有覆盖旧版本。
- v8 对实际 APK 的拒绝运行（`20261122T103054Z-rejected-v8-apk-gate.log`）首先命中错误 no-INTERNET 断言，退出 1；该运行不是通过记录。v10 才同时修正基线权限集合和完整三库集合。
- 所有主要恢复后验证均以带 UTC 起止时间、命令、真实退出码和完整输出的日志保存在 `verifier/runs/`；失败 wrapper、失败 gate 和超时均保留。

## 4. 回归与确定性证据

| 检查 | 结果 |
|---|---|
| v1 / v2 / v3 | 44/44、27/27、51/51 |
| r62 negative gates | 十三门全绿 |
| r67-bench | PASS |
| JavaScript syntax | `node_check_modules=10 OK` |
| 确定性网页包 | 24,393 行，1,500,732 B |
| 网页包 SHA-256 | `cc69b869077a72dc1367461c6567a47fea159d292fd5e3d207a2afef84f167b5` |
| rename-only / source gate | 十二方法无其他字节变化；22/22 |
| Git diff checks | `git diff --check` 与 cached 检查通过 |

引擎来自已校验的官方 Stockfish archive；暂存引擎为 100,695,968 B，SHA-256 `ffd8fc2004d3d19f9fdab95d84c92709aea92e8d3af405eda0b281b23cf1daf8`。

## 5. Release 构建

构建日志：`verifier/runs/20261122T101432Z-recovered-assemble-release.log`。

- JDK Temurin 17.0.20.1+1；Gradle 8.11.1；AGP 8.7.3；compile/target SDK 35；minSdk 23；NDK 27.2.12479018；CMake 3.31.6。
- `gradle assembleRelease --no-daemon --stacktrace --console=plain`：`BUILD SUCCESSFUL in 14m 24s`，51 actionable tasks，46 executed / 5 from cache。
- 构建产物：`build/outputs/apk/release/Regalia-release.apk`，81,552,289 B，SHA-256 `644919d57c690b54c56b26ed0ce91ec785d67a68e8e58eeaa6aed2946a5533fb`。

## 6. APK 独立验收

主日志：`verifier/runs/20261122T103300Z-recovered-apk-gate-v10.log`，退出 0。

- ZIP：34 entries，CRC 全过，无重复名、无不安全路径。
- apksigner：v1=true、v2=true、v3=true，一个 signer，证书 SHA-256 与上传 key 完全一致。v3.1/v4/SourceStamp 为 false，不属于本任务要求。
- aapt：`com.Regalia`，versionCode 10203，versionName 1.2.3，minSdk 23，targetSdk 35，native-code arm64-v8a，无 debuggable 标记，权限集合精确等于基线八项。
- 独立 Python Signing Block 解析：块偏移 81,541,711，总块长 8,192 B；首尾 size 一致、magic 与 pair 边界正确；v2 `0x7109871a` value 2,601 B，v3 `0xf05368c0` value 2,601 B。
- 原生库精确为且仅为 `lib/arm64-v8a/libstockfish.so`、`lib/arm64-v8a/libengine_bridge.so`、`lib/arm64-v8a/libc++_shared.so`。C++ runtime 来自未改的 `ANDROID_STL=c++_shared`，不是冗余文件；无其他 ABI。
- APK 内 Stockfish 大小/SHA-256 与暂存引擎一致；APK 内 `assets/chess.html` 与最终源网页包逐字节一致，大小/SHA-256 均符合确定性证据。

## 7. 输出挂载 I/O 异常与交付同一性

- 第一次直接复制为 `.apk` 后，`cmp` 和读取返回 EIO（`20261122T103353Z-deliver-apk-copy.log`，退出 2）。进一步诊断显示该挂载对目录内历史 `.apk` 也同样返回 EIO，而文本、tar/zip 与临时 `.bin` 可读；这是输出文件通道限制，不被记为 APK 验证通过。
- 改用临时 `.bin` 完整写入后，`cmp` 与 SHA-256 均通过，负载 inode 15924、81,552,289 B（`20261122T103559Z-deliver-apk-readable-staging.log`）。
- 在挂载文件上直接重复多遍完整 APK gate 的尝试达到 240 秒外层 deadline；恢复记录为退出 124，临时输出 0 B，不声称通过（`20261122T104058Z-delivered-apk-payload-gate-v10-timeout.log`）。完整 gate 已在逐字节相同的本地 APK 上通过。
- 最后通过同一文件系统原子 `mv` 将已复验 `.bin` 负载改为最终 `.apk` 文件名；改名前后 inode 均 15924，大小保持 81,552,289 B（`20261122T104350Z-deliver-apk-atomic-rename.log`）。此证据链排除了改名过程中的二次写入或内容变化。

## 8. 源码 ZIP 与 post-package 边界

`verifier/v10/source_archive.py` 打包时排除 `.git`、build/.gradle/.cxx、local/signing properties、`src/main/jniLibs`、引擎二进制/归档、APK/AAB、密钥库和其他本地缓存；保留 dotfiles、`.github`、`.mobsf`、全部 verifier 版本、诚实运行记录和受保护 license ZIP。

ZIP 验收逐成员检查 CRC、路径、重复名、禁止路径/后缀、ELF、引擎 SHA-256 和上传密钥库 SHA-256；必检 `chess.html` 与 56,011 B 的 `LICENSE&NOTICE.zip`。口令扫描不输出口令值，覆盖源 payload、原始及解压 APK 成员、原始及解压 source-ZIP 成员和嵌套 ZIP。

最终 ZIP 写出后才能验证该 ZIP；这些 post-package 日志若再塞回 ZIP 会改变 ZIP 并造成无限自引用。因此它们按 v10 约定保存在恢复目录，而不回写最终 ZIP。最终大小与 SHA-256 只在实际输出写出后记录。

## 9. 小米澎湃 OS 3 声明边界

仅完成静态兼容性核验：minSdk 23 / targetSdk 35、arm64-v8a、完整 JNI/C++ runtime、Release 非 debuggable、v1/v2/v3 签名和 APK 结构。未连接任何小米澎湃 OS 3 物理设备，未进行安装或真机运行测试，不作真机兼容声明。
