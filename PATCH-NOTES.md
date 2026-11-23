# Regalia v1.2.3 — round-82 补丁包说明

- 生成时间：2026-11-24（Asia/Shanghai）
- 交付形态：本轮为**增量补丁包**（`Regalia-v1.2.3-round82-patch.zip`，5 个仓库文件，按仓库根目录结构组织）
- 实施基准：GitHub `upload` 分支当前树（tip `beea7339`，= round-81 源码 zip 落库 + 所有权属更新的 `LICENSE&NOTICE.zip`；本补丁 5 个文件均以其分支当前字节为基线，经 GitHub contents API 逐字节拉取核对）
- 输入源：CodeRabbit 对 PR #60 的两轮复审邮件（2026-11-24 01:06 / 02:06）：**4 条 actionable + 1 条 outside-diff**，全部落地（见 §1）；用户指令：EXPECTED_LICENSE_SHA256 跟随已上传至 upload 分支的新版许可归档
- 本轮不改 Java/JS/assets/chess.html → **APK 与源码链路无影响**（round-81 release 指纹 `b77fb2f5…` 继续有效），无需 assembleRelease；源码 zip 指纹 `db6e4710…` 仅随本轮 5 文件更新而演进
- 不变约束：versionCode 10203、八项权限、minSdk 23 / target 35、arm64-v8a only、Stockfish 引擎身份、根 `LICENSE&NOTICE.zip`（远端当前字节，见 §1 第 3 条）、v4–v8 历史验证器、失败日志 append-only

---

## §0 最重要的应用须知（通道丢件教训，先读）

本补丁包里有 **1 个文件不能指望 upload.zip 自动解压通道送达**（`.github/` 点目录受保护集结构化跳过，教训与 round-80 §0 相同）：

| 文件 | 为什么通道送不到 |
| --- | --- |
| `.github/workflows/unzip-folder-optimized.yml` | `.github/` 目录组件 ∈ PROTECTED_DIR_COMPONENTS，预检结构化跳过、永不落地 |

该文件请用以下任一方式落库：
- **方式 A（推荐）**：GitHub 网页打开该文件，粘贴补丁包内同名文件全部内容，直接 commit 到 `upload` 分支。
- **方式 B**：本地 `git clone` 后解压本补丁覆盖，`git add -A && git commit && git push`。

其余 4 个仓库文件（`verifier/v11/source-gate.py`、`verifier/v13/source-gate.py`、`worklog.md`、`PATCH-NOTES.md`）可照旧走 upload.zip 通道，或与上面文件一起用方式 B 一次搞定。

---

## §1 逐文件改动明细（5 文件，CodeRabbit 5 条意见全落地）

| 文件 | 意见级别 | 内容 |
| --- | --- | --- |
| `verifier/v11/source-gate.py`、`verifier/v13/source-gate.py` | Minor ×2（同类成对修复） | ① `effective_gradle_script` 块注释删除改为**留一个空格分隔符**（原直接拼接两侧字符：`compileSdk 35` → `compile/**/Sdk 35` + 独立注释行 `// compileSdk 35` 后有效形态与原文相同，Groovy 分词却已不等价——门禁曾放行；独立注释行仍通过）。② `effective_properties` 经新助手 `_properties_natural_lines` **仅按 CR/LF/CRLF 分行**（`str.splitlines()` 把 `\v`/`\f`/U+001C../NEL/U+2028/U+2029 也当换行：`#`+换页符前缀使 splitlines 见"注释行+属性行"而过滤后保留属性，Java Properties 只认三种终止符、整条属性实为注释——配置已变而门禁曾放行）；注释前空白限定 Properties 支持的 space/tab/formfeed。 |
| `verifier/v13/source-gate.py`（附加） | Major | `EXPECTED_LICENSE_SHA256`：`f5dc2788…` → **`88b9bc20f3ab2e8e881a718bae593a01e00457f10982bfd0c923a847e07d5861`**（所有权属已把新归档上传至 upload 分支——常量跟随当前归档；56,011 B，经 GitHub contents API 逐字节拉取并经门禁自身 `protected_license_metadata` 复核；旧值 `f5dc2788…`/`d4bd3cd4…` 注释留痕，A02 "current remote bytes" 语义延续） |
| `.github/workflows/unzip-folder-optimized.yml` | Minor | exec 位恢复整块重写：从 `ZipInfo.external_attr` 恢复**普通 Unix 权限（`& 0o777`，屏蔽 setuid/setgid/sticky 与文件类型位）对全部成员**生效（python 3.12 `zipfile.extract()` 实证不应用归档模式位——0755 的 `build-chess.py` 落地丢执行位、直接运行 Permission denied）；仅**缺少有效 Unix 元数据**的 `.sh` 回退 0755（DOS 制式 zip）；逐项打印；round-80.1 热修复主体不动；round-81 注释中"extract 应用归档模式位"失实表述更正 |
| `worklog.md` | outside-diff Minor | ① 文件顶部恢复**历史工作日志可查位置索引**（round-18–61 → `git show 6ef7ad6881:worklog.md`；round-69 → `git show 21fdb3fdda:worklog.md`；round-62–68 → 各轮源码 zip 快照与 round76 进度恢复指南；完整链 `git log --follow -- worklog.md`）。② 追加 round-82 工作日志段（本轮全部变更与验证记录） |
| `PATCH-NOTES.md` | — | 本说明置顶（round-81/round-80 说明按惯例保留于下方） |

## §2 应用步骤

1. **先落 1 个点文件**（§0 方式 A 或 B）：`.github/workflows/unzip-folder-optimized.yml`。
2. **再落其余 4 个仓库文件**（通道可达或方式 B 一并）。注意：补丁应用前提是分支上的 `LICENSE&NOTICE.zip` 已是新版（88b9bc20…——你已上传，本轮实测拉取核实），否则 v13 许可身份检查将失败。
3. **门禁重跑**（签名环境，或直接依赖本轮沙盒已跑的全量结果）：v13 source gate（38 检查；`REGALIA_R77_BASE` 固定 f783179 外部基线）→ v11 source gate（27 检查）→ v11 integration（19）→ v11 negative（32）。APK 链路无需重跑（本轮零 Java/JS/assets 改动）。
4. push/merge 前取得明确确认；`LICENSE&NOTICE.zip` 永不回退。

## §3 本轮沙盒已执行验证（交付环境内，分支 tip beea7339 树 + f783179 api-tarball 基线导入）

- 攻击复现→拦截对照 38/38：round-81 实现在 `compile/**/Sdk 35` 与 `#`+换页符两例**复现放行**；round-82 修复在 v11/v13 双文件全部拦截；回归正控全过（独立注释行/续行 `# note`/CRLF/裸 CR/字符串字面量/**真实对照对** 分支 vs f783179 有效形态仍相等）
- **全量门禁重跑**：v13 source-gate **38/38**（`CURRENT_LICENSE bytes=56011 sha256=88b9bc20…` 身份检查转绿；基线树摘要 `be6778e4…` 校验通过）；v11 source-gate **27/27**；v11 integration **19/19**（含 I17 注释编辑通过/I18 配置编辑仍拒）；v11 negative **32/32**
- unzip yml 夹具 8 例全过（0755 `.sh`/0755 `build-chess.py`（CodeRabbit 样例）/0644 `.txt` 按元数据恢复/**0644 `.sh` 原样不提权**/04755 屏蔽为 0755/DOS `.sh` 回退 0755/DOS `.txt` 不伪造执行位/逐项打印）；PyYAML `safe_load` 解析通过（5 步骤完整）；与 round-81 版 diff 恰为 exec 块替换（53 行）
- `py_compile` 双 source-gate 文件、yml 内嵌 python 块独立编译均通过
- **边界**：本轮为工具链/门禁补丁，未执行 assembleRelease（零 Java/JS/assets 改动，APK 指纹不变）；r62/r67/v1-v3 回归未重跑（测试对象本轮零改动）

## §4 不做事项（边界）

ROB-05（统计页阈值 UTF-16 估算，D 档）继续不动；v4–v8 历史验证器与已标 superseded 的 v9/verify-apk.py 不动；verifier/runs 历史日志 append-only 不动（本轮零新增 run 日志入包）；`LICENSE&NOTICE.zip` 不随补丁包重发（分支已携带新版，补丁只更新 pin 常量）；worklog 历史内容不整体回填入树（outside-diff 意见按"可查位置"恢复索引处置，历史字节留 git 历史与各轮交付包）。

---

# Regalia v1.2.3 — round-81 交付说明

- 生成时间：2026-11-23（Asia/Shanghai）
- 交付形态：本轮为**完整源码 zip**（`Regalia-v1.2.3-round81-源代码.zip`，504 条目，根前缀 `Regalia-v1.2.3-round81/`）+ **重签 release APK**（`Regalia-v1.2.3-round81-release.apk`，v1/v2/v3 签名齐全，证书 SHA-256 `45bc6d36…`，采用用户上传 keystore），补齐 round-80 遗留的 APK 重建与门禁全量重跑事务。
- 实施基准：round-80 交付树 + round-80.1 解压工作流热修复 + 本轮 CodeRabbit 复审（3 Major + 2 outside-diff Minor）落地；固定源码比较基线仍为 `f783179…`。
- 引擎渠道（项目所有者指令）：`libstockfish.so` 改由官方 Stockfish sf_19 发布页 `stockfish-android-arm64-universal.tar.gz`（SHA-256 `ebb24051…`）获取；引擎成员字节与既有 pin（`ffd8fc20…` / 100,695,968）逐字节一致——引擎身份不变，仅获取渠道变更。
- 完整变更与验证记录见 `worklog.md` 的 round-81 段；门禁留痕在 `verifier/runs/`。
- 不变约束：versionCode 10203、八项权限、minSdk 23 / target 35、arm64-v8a only、Stockfish 引擎身份、根 `LICENSE&NOTICE.zip`（远端当前字节 `f5dc2788…`）、v4–v8 历史验证器、失败日志 append-only。

---

## round-81 变更一览（15 个仓库文件 + 引擎）

1. `verifier/v10/secret_scan.py`、`verifier/v9/secret_scan.py` — 文件 open/读 OSError 纳入不透明诊断边界（CodeRabbit Major #1）。
2. `verifier/v11/archive_scan.py`、`verifier/v13/archive_scan.py` — EOCD64 定位改解析器固定位置（EOCD-76），注释诱饵不可绕过内存边界（CodeRabbit Major #2）；v11 负测新增诱饵用例 + 合法 ZIP64 正控制。
3. `verifier/v13/source-gate.py` — properties 有效形态比较按逻辑行（续行）识别注释（CodeRabbit Major #3）；允许集/license pin/CodeQL 期望随 round-81 树演进；engine 渠道 pin 演进。
4. `.github/workflows/unzip-folder-optimized.yml` — round-80.1 热修复（stash 序列移除、--ff-only 收编、目录条目排除、:(literal) pathspec、控制字符拒绝）+ `.sh` 执行位保留（outside-diff Minor）。
5. `src/main/java/com/Regalia/PgnCacheManager.java` — `List.sort()` 回退 `Collections.sort()`（API 23 兼容，outside-diff Minor；S9412 按故意误报处理）。
6. `.github/workflows/codeql.yml` — 恢复 round-79 交付版（c-cpp none + persist-credentials: false；round-80 staging 组装回退事故）。
7. `verifier/v11/source_archive.py` — BUNDLE pin 对齐当前 chess.html（round-80 漏更新事故）。
8. `verifier/v11/source-gate.py` — 有效形态比较 + 内容 diff（-G.）+ 允许集对齐 v13；`verifier/v11/integration-tests.py` — 负测语义演进（纯注释通过、配置变更仍拒），19 检查。
9. `verifier/v13/stage-engine.py` — 官方 sf_19 资产渠道（tar.gz SHA pin）；`verifier/v13/source_archive.py` — PREFIX → round-81。
10. `src/main/java/com/Regalia/README.license`、`worklog.md`、本文件 — round-81 账本与记录。
11. `src/main/jniLibs/arm64-v8a/libstockfish.so` — 引擎 staged（不入 git；源码 zip 不含；APK 内嵌）。

---

## APK 交付指纹（verify-apk 门禁输出）

- APK：81,554,761 字节，SHA-256 `b77fb2f5cf43e8951a262fd9423507163702d330a12fe6a38a95bbee833079b6`
- 签名：v1/v2/v3 全 true、单签名者、证书 SHA-256 `45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc`（RSA 4096）
- 引擎：`ffd8fc2004d3d19f9fdab95d84c92709aea92e8d3af405eda0b281b23cf1daf8`（100,695,968 字节）；bundle：`ff703692…`（1,500,928 字节，与源码树一致）
- HyperOS 3 兼容为静态口径（A11）：SDK 35 / arm64-v8a / 16KB 页对齐 native 库（NDK r27c）/ release 非 debuggable。

## 落库方式（完整源码 zip）

- 方式 A：解压 `Regalia-v1.2.3-round81-源代码.zip`，以其 `Regalia-v1.2.3-round81/` 根目录覆盖 upload 分支工作树后 commit（`.github` 点文件照旧不可经 upload.zip 通道，见下节 round-80 遗留说明）。
- 方式 B：仅把上述 15 个文件按仓库路径手工覆盖（增量）。
- APK 与源码 zip 的安装/校验指纹见上节；`LICENSE&NOTICE.zip` 保持远端当前字节，未用历史副本覆盖。

---

# Regalia v1.2.3 — round-80 补丁包说明

- 生成时间：2026-11-23（Asia/Shanghai）
- 实施基准：GitHub `upload` 分支当前树（round-79 补丁应用后状态，经 SHA-256 逐文件核对确认：38 个 round-79 文件中 35 个逐字节一致；`.gitignore`、`.github/workflows/mobsf.yml`、`.github/workflows/unzip-folder-optimized.yml` 因通道丢件停留在 round-76 原始状态——本轮补投，见 §0/§1）
- 输入源：CodeRabbit 对 PR #60（round-79 变更）的复审（25 条可操作评论 + 1 条 diff 外评论）、SonarCloud PR #60 OPEN/CONFIRMED 5 项、《回复复查(2026.11.23)》元级复核意见
- 包内文件：27 个仓库文件（本说明为第 28 个条目），全部按仓库根目录结构组织
- 不变约束：versionCode 10203、八项权限声明、Stockfish 引擎身份、C++ 载荷、根 `LICENSE&NOTICE.zip`、v4–v8 历史验证器、已标 superseded 的 v9/verify-apk.py

---

## §0 最重要的应用须知（通道丢件教训，先读）

**本补丁包里有 4 个文件不能指望 upload.zip 自动解压通道送达**（与 round-67/.gitignore 头部注释记录的教训一致，本轮经 GitHub blob 比对定案）：

| 文件 | 为什么通道送不到 |
| --- | --- |
| `.gitignore` | 你把补丁 zip 重新打包成 upload.zip 时点文件被文件管理器排除（本轮实测：你上传的 blob 里没有它）；旧 workflow 的 find -delete 也不送 `.github/` 下的任何东西 |
| `.github/dependabot.yml` | 同上：`.github/` 点目录 + 重打包丢点文件（该文件自 round-77 起从未落进分支，v9/v10/v11/v13 的 required-entries 与 v13 门禁都因此失败） |
| `.github/workflows/mobsf.yml` | 重打包丢点文件 + workflow 的 find -delete 删除 `.github/workflows/*`（双保险都丢） |
| `.github/workflows/unzip-folder-optimized.yml` | 同上 |

**这 4 个文件请用以下任一方式落库（任选其一）**：

- **方式 A（推荐，和 round-68 的 .gitignore 恢复做法相同）**：在 GitHub 网页上逐个打开这 4 个文件（没有的用“Add file → Create new file”），把补丁包内同名文件的全部内容粘贴进去，直接 commit 到 `upload` 分支。
- **方式 B**：本地 `git clone` 后解压本补丁包覆盖，`git add -A && git commit && git push`。

其余 23 个仓库文件可以照旧走 upload.zip 通道（或同样用方式 B 一次搞定）。注意：如果你仍选择重新打包上传，请确认打包时保留点文件——否则本轮 `.gitignore`/dependabot/两个 workflow 依然落不了地。

---

## §1 逐文件改动明细

### 通道丢件补投（4 文件，round-79 已交付内容的原字节补投 + 1 项新发现）

| 文件 | 内容 |
| --- | --- |
| `.gitignore` | round-79 版本：追加 `.gradle-dumps/` 与 `*.hprof`（ROB-08） |
| `.github/workflows/mobsf.yml` | round-79 版本：`mobsfscan==1.2.0` 固定版本、checkout `persist-credentials: false`（ROB-07 残留）、`|| true` 改为“有 SARIF 的 findings 退出告警继续 / 无报告的工具失败 fail closed” |
| `.github/workflows/unzip-folder-optimized.yml` | round-79 版本：结构化 ZIP 预检（任意层级保护路径、穿越/加密/预算/成员数/自覆盖检查，危险输入失败即终止；保护条目结构化跳过并告警）+ concurrency 串行化 + stash push/pop 失败即终止 + manifest 驱动 staging（替代 git add -A）（ROB-06 嵌套前缀绕过/stash 吞冲突/add -A 吸产物全部闭环） |
| `.github/dependabot.yml` | round-77 源码包中的已审字节原样补投（新发现：该文件从未落进 upload 分支，v9–v13 required-entries 因此一直缺 1 项） |

### Java（3 文件）

| 文件 | 内容 |
| --- | --- |
| `EngineSettingsHelper.java` | ① `engine.threads` 下限 1 恢复（round-79 重构丢了下限，导入 0/负值原样保存；下限钳制计入 clamped 汇总；CodeRabbit 复审 #1）② 设置解析器 `split("\\r\\n|\\r|\\n")` 同时接受裸 CR/LF/CRLF（round-79 字节忠实读保留裸 `\r` 而旧 `split("\\r?\\n")` 不拆，裸 CR 文件整份被拒；CodeRabbit 复审 #2）③ `"importSettings: "` 前缀常量化（SonarCloud S1192）④ validateSettings 循环仅剩 1 个 continue——元数据跳过改 if/else（SonarCloud S135） |
| `FileIoHelper.java` | round-79“流式读保留原始换行形态不影响解析”的失实注释就地更正（交叉引用解析器修复；CodeRabbit 复审 #2 注释侧）；无行为变化 |
| `PgnCacheManager.java` | `" bytes): "` 上限拒绝日志后缀常量化（SonarCloud S1192）；evictIfNeeded 两处 `Collections.sort` → `List.sort`（SonarCloud S9412） |

### JS 与网页包（2 文件）

| 文件 | 内容 |
| --- | --- |
| `chess.src/ai-bridge.js` | openEngineConfig 的两个 try/catch+回退三元对提取为共享 `_bridgeJsonQuery` 助手（行为逐语义保持；SonarCloud S3776 认知复杂度 16→阈值内） |
| `chess.html` | build-chess.py 确定性重建：24,403 行 / 1,500,928 字节，两次构建字节一致，SHA-256 `ff7036920da6e33f7502464dfd5372f5500f8408f1c499d8279913560ae01cf2` |

### verifier v9/v10（4 文件）

| 文件 | 内容 |
| --- | --- |
| `v9/secret_scan.py`、`v10/secret_scan.py` | 诊断改为扫描器生成的“阶段#序号”不透明标识（v11 设计）：路径/成员名彻底不进诊断——round-79 的 `<masked>` 占位符在密码为 "masked" 的子串时本身内含密码（CodeRabbit 复审 Major ×2） |
| `v9/source_archive.py`、`v10/source_archive.py` | ① verify 先 `O_RDONLY\|O_NONBLOCK` 打开 + `os.fstat` 校验普通文件（FIFO 无写入方时 open 永久阻塞，round-79 的 open 后检查不可达；CodeRabbit 复审 #24）② pack 统计改为发布前从本次临时文件计算（发布后 stat 可读到并发写手；diff 外评论 + #5/#6 家族）③ `source_zip_sha256` 输出 hexdigest（此前输出哈希对象；#6/#25 家族）④ jniLibs 识别改连续三组件匹配（子串形式连 jniLibsBackup 一起拒绝；#4/#7 家族） |

### verifier v11/v13（12 文件）

| 文件 | 内容 |
| --- | --- |
| `v11/archive_scan.py`、`v13/archive_scan.py` | 中央目录预检镜像 CPython 3.11 ZIP64 语义：EOCD 前 20 字节有 PK\\x06\\x07 定位记录即按 EOCD64 的 64 位目录大小检查（与经典字段是否 0xFFFFFFFF 无关——round-79 只在 0xFFFFFFFF 时查 EOCD64，“小经典值+敌意 EOCD64”绕过；CodeRabbit 复审 Major ×2）；无法确定有效大小时 fail closed；预检自身 I/O 错误进入不透明诊断边界（路径移走后裸 OSError 会把路径打进回溯；复审 Major ×1） |
| `v11/browser-download.py` | ① 临时文件所有权范围覆盖 browser.close() 与 playwright 上下文退出（close 失败此前逃出内层 except，临时文件无人清理；复审 Major #9）② main() 的 JSON 输出移入临时清理 try 内（打印先于 try 失败会把完整 APK 临时文件留在输出目录；复审 Major #10） |
| `v11/negative-tests.py` | ① 中断历史按实际行数计数——round-79 的 set 压平两条相同行，双重记账仍过 ==1 检查；现按 TSV 第 2 列完整 label 字段筛选列表计数（复审 #11）② 中央目录超限负测：先造夹具，再对被测模块 ZipFile 构造器设 spy 并断言未被调用（此前只查错误文本——先解析再拒绝也通过；错误文本断言保留；复审 #12） |
| `v11/rename-only-proof.py` | 基线先词法去注释/去字符串，每个标识符必须在代码形态命中“TYPE name(params) {”方法声明（re.subn 把注释提及算命中；基线声明已改名而注释残留时可“通过”；subn 与全文比较保留；复审 Major #13） |
| `v11/source_archive.py`、`v13/source_archive.py` | ① `source_zip_sha256` 输出 hexdigest（#6/#23/#25 家族）② pack 统计发布前从临时文件计算 ③ pack 恢复对 `verifier/runs/*-selftest-source.zip` 的显式重建（round-79 一律拒绝使集成测试对树内自测产物第二次 pack 提前失败；仅该命名模式放行，许可证与普通源文件仍受保护；复审 #14/#19） |
| `v13/source_archive.py`（附加） | BUNDLE_SHA256 更新为本轮 chess.html（`ff703692…`）——round-79 重建了 chess.html 却把 pin 留在 round-77 值（`ae15d2b6…`），打包-校验对必然失败（本轮交叉核对发现的 round-79 交付失配） |
| `v11/run-and-log.sh`、`v13/run-and-log.sh` | ① finish 的日志写入改 `set -e` 子 shell 逐条执行（round-79 的 `if ! {…}` 只看组内最后一条命令，中段 printf 失败而 TMP 为空时组状态仍 0，历史指向截断日志；复审 #17/#20）② `cat ""$LOG""` → `cat "$LOG"`（路径含空格时词拆分 + return 0 掩盖；复审 #18/#21） |
| `v13/source-gate.py` | build.gradle/gradle.properties 恢复真实比较——改“有效形态”比较（Gradde 注释剥离、字符串字面量保留、注释删除遗留空行归一）：round-79 把 build.gradle 移出字节比较后依赖声明变化不再触发失败、gradle.properties 子串断言可被“注释保留 false+生效行改 true”满足；有效形态比较拒绝实际依赖/配置变化，同时放行 round-79 注释更正（复审 #22/#23；检查数 37→38） |

### 账本与日志（4 文件）

| 文件 | 内容 |
| --- | --- |
| `src/main/java/com/Regalia/README.license`、`chess.src/README.license`、`assets/README.license` | 顶部各追加 round-80 条目（许可分类不变：AGPL 7 / GPL 13 / Java 16；不改写历史计数） |
| `worklog.md` | 追加 round-79 条目（round-79 补丁的 worklog-round79-append.txt 内容——当时未落地）+ round-80 条目（本轮全部变更与验证记录） |

## §2 应用步骤

1. **先落 4 个点文件**（§0 的方式 A 或 B）：`.gitignore`、`.github/dependabot.yml`、`.github/workflows/mobsf.yml`、`.github/workflows/unzip-folder-optimized.yml`。
2. **再落其余 23 个仓库文件**：解压本补丁包覆盖仓库（或继续走 upload.zip 通道——注意 §0 的重打包提醒）。`worklog.md` 为整文件覆盖（内容 = 当前分支 worklog + round-79 追加 + round-80 条目，已按分支当前状态构建，不会丢 round-78 日志）。
3. **门禁重跑**（签名环境）：v13 source gate（`REGALIA_R77_BASE=<f783179 外部基线目录>`；38 检查）→ v13 打包-校验对（`source_archive.py pack/verify`——BUNDLE pin 已对准本轮 chess.html）→ v13 集成测试（`integration-tests.py`）→ v11 负测 30 门 → v1/v2/v3、r62、r67 回归。
4. **APK 链条**：本轮改了 `chess.src/ai-bridge.js` 并重建 `chess.html`（新 SHA-256 `ff703692…`）——APK 内嵌的 chess.html 与源树不再一致，需 `assembleRelease` 重建重签后重跑 v13 APK 门（八项权限/versionCode/引擎身份不变；APK 哈希会变，属预期）。若暂不重建 APK，不要把本轮源码树当作“与已验收 APK 一致”的交付态。
5. **SonarCloud/PR #60 复扫**：本轮清掉 S3776、S135、S1192×2、S9412 五项；CodeRabbit 复审的 25 条全部落地。推送后确认 issue 列表收敛。
6. push/merge 前取得明确确认；`LICENSE&NOTICE.zip` 永不回退。

## §3 本轮沙盒已执行验证（交付环境内）

- 12 个改动 Python 文件 `py_compile` 全通过；v11/v13 `run-and-log.sh` `bash -n` + 真实运行（正常路径退出码/日志/历史三元正确；注入 cat 失败后正确 fail-closed 退出 75 且不追加历史）
- `ai-bridge.js` `node --check` 通过；`chess.html` 连续两次重建字节一致
- archive_scan 预检功能验证：普通 ZIP 通过；小预算 ZIP 拒绝且 ZipFile 构造器未被调用；合法手造 ZIP64（locator+EOCD64 一致）通过且预检读 EOCD64 值；敌意组合（小经典值+巨 EOCD64）在解析前拒绝（round-79 逻辑会放行——已确认修复）；locator 无 EOCD64/无 EOCD 均按“不可确定”拒绝
- v13 集成 `test_archives` 14/14 全绿（含 round-79 起即失败的树内自测产物双重 pack、pack 统计发布前计算、hexdigest、新 BUNDLE pin 下的完整打包-校验对）
- v9/v10/v11 打包路径功能运行通过，`source_zip_sha256` 输出与真实文件哈希一致
- v11 `test_archive_member_preflights`（含 ZipFile spy 断言）通过
- 3 个 Java 文件 javalang 全文件语法解析通过
- mobsf.yml / unzip-folder-optimized.yml / dependabot.yml YAML 解析通过；全部修复特征断言（约 60 项 marker）逐一验证存在
- **边界**：`compileReleaseJavaWithJavac` 未在本环境执行（无 JDK；语法验证到 javalang 层）；APK 未重建；v13 门禁全量、v1/v2/v3 与 r62/r67 回归须在你的签名环境执行（§2 步骤 3–4）

## §4 不做事项（边界）

ROB-05（统计页阈值 UTF-16 估算，D 档）继续不动（仍与“JS 改动→chess.html→APK”链条的成本核算冲突，且 SonarCloud/CodeRabbit 本轮均未提及）；v4–v8 历史验证器与已标 superseded 的 v9/verify-apk.py 不动；v11 source-gate 的 build 字节比较未动（v11 门禁绑定 round-72 恢复树，其历史 BUNDLE pin cc69b8… 属 round-72 时代值，不随当前树更新）。
