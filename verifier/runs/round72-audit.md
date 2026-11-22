# Regalia v1.2.3 round-72 实施与交付审计

日期：2026-11-22（UTC）。状态：实现、回归和实际下载 APK 验收完成；最终源码 ZIP 的 post-package 证据按 §6 外置。

## 1. 基线与范围

- 固定变更前基线：PR #59 head `f78317919818a02c1fa169a99b85cad6ebf8a1fe`。
- 实施前重新取得的当前远端：`upload` = `a245de549b473812aa36f0158f3f8b1a98a4a3e5`，提交说明 `chore: auto unzip files to root [skip ci]`。
- round-72 仅加固验证链、CI 配置恢复、秘密扫描、源码 ZIP 完整性和实际下载产物证据；不改棋类功能或 Java 业务行为，不重新签名 APK。
- 不推送、不合并 PR、不关闭 issue、不删除分支、不解决 review thread。

## 2. 当前许可包保护

远端当前 `LICENSE&NOTICE.zip` 为 56,011 B，SHA-256 `d4bd3cd4752421aac192475bda7bdb5042964b5eec3102c836265c25f666595b`；原始 round-71 ZIP 内的历史快照虽同为 56,011 B，但 SHA-256 为 `9abb597cc4974d9a3a8c416db8929dee9381c7c48f8e06be828d8cb315fb3cba`。二者不同，当前远端版 CRC 通过，已独立保全。

这只是本次取得版本的实际身份，不是未来固定不变量。后续人工更新仍优先；变更记录、大小或哈希变化均不得触发旧版回退。禁止用旧 ZIP 覆盖当前文件。

## 3. 自动解压通道差异

当前远端相对最终 round-71 源 ZIP 缺 `.github/dependabot.yml`，且 `codeql.yml`、`mobsf.yml` 为旧内容。round-72 恢复 CodeQL C/C++ no-build、`persist-credentials: false`、MobSF 1.2.0 固定版本、Dependabot 配置和 `gradlew` mode `100755`。业务源码与资源未因该通道差异而改变。

## 4. 二十条评审意见分诊

邮件共 20 条 actionable 意见（8 Major、12 Minor）。同一根因的重复评论合并到下列机制；每条都由 v11 或其交付证据覆盖，不重写 v4–v10 历史。

| 根因/意见组 | 处理 |
|---|---|
| 实际最终交付文件缺完整 gate 通过记录 | 对下载入口实际保存文件执行 v11 APK、秘密与源码交付门禁；退出码和完整输出留档。 |
| 源码入口及源码 ZIP 入口递归秘密扫描不足 | 共用 `archive_scan.py`，有界任意嵌套递归；超限/损坏/读取失败均 fail closed。 |
| 嵌套归档中密钥库、引擎和 ELF 漏检 | 每层执行名称策略、ELF magic、引擎和密钥库摘要检查。 |
| 密码命中诊断路径泄密 | 仅输出不透明阶段与成员序号；路径、成员名和值均不进入异常。 |
| 源码 ZIP 只验证 required 子集 | 比较完整预期清单与逐文件 SHA-256，再单独执行 required 集合。 |
| 重跑打包自包含旧 ZIP | 显式排除解析后的 output、lock 和独占临时路径；加入重跑负测。 |
| 固定 `.tmp` 并发竞态 | 独占 output lock + `mkstemp`，持锁期间原子发布。 |
| `os.walk` 忽略读取错误 | `onerror` 直接抛出；负测模拟权限错误。 |
| `jniLibs` 大小写匹配失效 | 全部路径分量小写后比较；嵌套成员同策略。 |
| HEAD 自比较导致干净提交误失败/漏检 | 固定 `f783179…`；rename-only 与 source gate 均显式 `--base`。 |
| 固定 Java 变更集合在干净提交误失败 | 改为相对固定基线的允许子集，并同时检查 untracked。 |
| wrapper 无命令 fail-open | 参数少于两个时退出 64，不写运行记录。 |
| 同秒同名日志覆盖 | `mktemp` 排他创建；同秒八并发负测。 |
| v9 历史规范未标记取代 | 页首标明被 v10/v11 取代，旧条款保留供审计。 |
| MobSF 未固定版本的重复评论 | 最终 round-71 已固定 1.2.0；恢复自动解压遗漏并加 v11 source gate。 |

## 5. 已实施验证器

- `v11/run-and-log.sh`：参数验证、真实退出码、独占日志和追加历史。
- `v11/archive_scan.py`：统一有界递归遍历、预算与安全路径检查。
- `v11/secret_scan.py`：原始及递归成员密码扫描，脱敏错误。
- `v11/source_archive.py`：完整 payload、递归二进制检查、安全打包和逐成员摘要验证。
- `v11/source-gate.py`、`rename-only-proof.py`：固定基线和当前许可包规则。
- `v11/verify-apk.py`：继承 v10 全部门禁，并固定已验收 APK 的精确字节身份。
- `v11/negative-tests.py`：隔离故障夹具；真实口令不进入测试或日志。

## 6. 执行结果与 post-package 边界

### 6.1 回归、负向和固定基线

| 检查 | 实际结果 |
|---|---|
| v1 / v2 / v3 | 44/44、27/27、51/51 |
| r62 negative gates | 十三门全绿 |
| r67-bench | PASS |
| JS 语法 | 10 个模块通过 |
| 确定性网页包 | 两次重建一致；24,393 行、1,500,732 B，SHA-256 `cc69b869077a72dc1367461c6567a47fea159d292fd5e3d207a2afef84f167b5` |
| v11 基础负向测试 | 17/17；另保留测试自身计数和累积 glob 误判的失败日志，没有改写历史 |
| v11 集成测试 | 15/15；覆盖完整 manifest、摘要、required、重跑、锁、干净提交、额外提交和人工许可更新 |
| rename-only / source gate | 十二项重命名无其他变化；source gate 27/27 |
| diff / 不变性 | `git diff --check` 通过；回归前后 Java 聚合摘要和当前许可包 SHA-256 不变 |

所有上述主要命令均通过 v11 wrapper 留存 UTC 起止时间、命令、真实退出码和完整输出；索引为 `verifier/runs/v11-history.tsv`。

### 6.2 实际下载 APK 验收

通过现有下载页真实 Chromium 点击并保存，建议文件名 `Regalia-v1.2.3-round71-release.apk`，failure=null。round-72 没有应用载荷变化，因此继承并交付同一已验收字节，不为了轮次号无意义重签。

- 实际保存文件：81,552,289 B；SHA-256 `644919d57c690b54c56b26ed0ce91ec785d67a68e8e58eeaa6aed2946a5533fb`。
- `v11-browser-download` 与 `v11-downloaded-apk-gate` 均为退出 0。
- 完整 gate 直接读取该下载保存文件，而不是只比较同 inode 或引用中间构建产物。
- v1/v2/v3=true，单 signer，证书 SHA-256 `45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc`。
- 34 entries，CRC/重复名/路径通过；v2/v3 Signing Block ID 分别为 `0x7109871a`/`0xf05368c0`。
- 权限精确等于基线八项；原生库精确为 arm64-v8a 的 Stockfish、engine_bridge 和 libc++_shared；引擎与网页包大小/SHA-256 均匹配。
- 小米澎湃 OS 3 仍为静态兼容性核验，未进行物理设备安装或运行测试。

### 6.3 最终源码 ZIP 与包外证据

最终源码 ZIP 使用 `v11/source_archive.py pack` 写出，包含当前许可包、v1–v11、审计和诚实运行记录，不含 `.git`、引擎、ELF、构建缓存、APK/AAB、密钥库或签名材料。完整 manifest、逐成员 SHA-256、required、CRC、路径、gradlew mode 和递归二进制检查由 `verify` 执行；两项上传口令的递归秘密扫描由 `secret_scan.py` 执行。

**最终 ZIP 写出后才能验证该 ZIP。**这些 post-package 日志若再塞回 ZIP，会改变 ZIP 并造成无限自引用。因此最终 verify、secret-scan、实际大小、条目数和 SHA-256 均记录在包外恢复目录及交付清单；本文件不内嵌或伪造自身哈希。交付时只以实际退出生成的包外记录为准。

### 6.4 未实施与边界

- 未改棋类功能或 Java 业务行为；未重建或重签 APK。
- 未新增网络权限、网络出口、数据收集、应用依赖或无关清理。
- 未推送、未合并 PR、未关闭 issue、未删除分支、未解决 review thread。
- 没有物理 HyperOS 3 测试，也不把本地 HTTP 浏览器测试描述为公网发布。
