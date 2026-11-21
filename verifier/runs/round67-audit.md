# Regalia v1.2.3 — round-67 审计轨迹（2026-11-21）

> 基线：GitHub upload head `3a083a4a`（round-66 交付树）。起始三验证器实跑 **44/44、27/27、
> 46/47（V3-40b RED）**——T0 交付完整性缺陷的现场证实。本轮输入：《round-67 任务规划》
> + CodeRabbit 16:13 评审 9 条（全部属实）+ SonarCloud PR #57 实时数据（质量门 ERROR：
> 新代码重复率 13.2% > 3%；S1192 CRITICAL / S1066 MAJOR / S6582 / S7765 四 Issue 全部属实）。
> 收官基线：**44 / 27 / 49**，负向门九项，元负例 17 场景全 RED。

## 1. T0 交付完整性——根因比规划记载更深一层

远端 codeload 快照 vs 本地 round-66 source-backup 全树 `diff -rq` 出四项差异，逐一定性：

| # | 差异 | 定性 | 根因 | 处置 |
|---|---|---|---|---|
| 1 | `.github/workflows/release-helper.yml`（远端仍 SF18 表述，V3-40b 腿 b RED） | 交付完整性缺陷 | **规划记载"没进 upload zip"不成立**——round-66 zip 内有修复版（7,317 B = 旧 7,293 B + 24 B 增量）；真因是 `unzip-folder-optimized.yml` 的 `PROTECTED_PATHS` 按设计剥离 `.github/workflows/`（防工作流注入），zip 渠道**结构上送不进**该路径 | work 树内修复 + 交付用户 web 编辑指引（唯一可达通道）+ 指南 §7 远端复跑硬断言 |
| 2 | `.gitignore`（远端缺失） | 交付完整性缺陷 | zip 内有（1,086 B），bot 提交 `3a083a4a` 文件清单中无——stale 上传或解包怪象，**无法定案**（诚实记录）；该路径不受工作流保护，本应落地 | round-67 zip 重新携带 + 新哨兵 V3-47 钉在位 |
| 3 | `src/main/assets/chess.src/worker-pool.js`（远端仍在） | 交付渠道能力缺口 | zip 覆盖式上传（`cp -a` 只增改 + `git add -A`）**结构上不可能删除文件**；round-66 README 的手动删除指引尚未被用户执行 | 新哨兵 V3-46 钉缺席（缺口可见化）+ round-67 README 重申 web 删除步骤 |
| 4 | `LICENSE&NOTICE.zip`（字节差） | 良性 | 内容逐字节相同（unzip diff 为空）——zip 元数据差异（远端收到的是 zip 内版本，本地备份是构建期重建版） | 无动作，如实记录 |

**上传渠道能力矩阵（新知识，入指南 §7）**：upload.zip（须以此文件名拖入 upload/main 分支）
→ 触发 `unzip-folder-optimized.yml` → 解包到根 + 剥离保护路径（`.github/workflows/`、`.git/`、
`gradlew`、`gradle/`、`local.properties`、`*.keystore`、`*.jks`）→ `git add -A` 提交
（`[skip ci]`）。能力边界：**不能**投递保护路径内文件；**不能**删除任何文件；用户 web 手动
提交（Add file / web 编辑器）是普通提交（触发 CI/PR synchronize），是两类改动的唯一通道。
**流程硬断言**：每轮交付上传后，必须对远端 head 快照（codeload tar）复跑三验证器 + bundle
字节核对 + 改动文件清单对照——本地树全绿不构成交付完成证明（round-66 教训升格；V3-40b(b)/
V3-46/V3-47 在用户完成两步 web 操作前于远端保持 RED，是缺口可见化特性）。

## 2. CodeRabbit 16:13 评审 9 条处置表

| # | 位点 | 级别 | 处置 | 验证 |
|---|---|---|---|---|
| 1 | methodology:41 "活语句" | Minor | T15：表述作废——四级谱系第四级改名"行锚定语句形态（仍是文本级）"+ round-67 勘误注记；V3-41 加 `if (false`/`if (0)` 字面量禁令（明示仍可被 `if (0==1)` 绕，守卫是减速带） | 元负例 `V41-rename-wrapped-if-false` RED；方法论 round-67 实例化段入档 |
| 2 | chess.html:12479 分割器（bundle 副本） | Minor | T6：随 tablebase.js 源重建消失（bundle 24,288 行/1,493,374 B，旧形态 grep 0 命中） | V3-45(3) 调用点钉 + 差分 fuzz 零差异 |
| 3 | tablebase.js:163 分割器 | Minor | T6：`_pgnFirstGameSplit()` 单遍线性扫描替换（CodeRabbit 建议的 lookbehind 扩展 `(?<!\n[^\S\n]*)` 未采纳——round-66 教训：同类问题要单一实现 + 全类敌意基准，正则形态难以证明无其他绕过面） | 差分 fuzz 64,037 例 0 差异 + 基准（§5）+ V3-45 同构孪生钉 + N8 |
| 4 | stats.html:797 扫描器 | Minor | T7：单调缓存（next-`]`+ws 段起点、next-`\n`）+ 切片前先查缓存；`_j` 严格递增证明（§5.3） | 差分 fuzz 64,032 例 0 差异 + 基准 + V3-45(5) 实现行钉 + N8 |
| 5 | r62-negative-tests.sh:34 并发 | Minor | T10：flock 工作区互斥（首备份前取锁持到退出；EXIT/INT/TERM 恢复在锁内；被占零触碰 fail-fast；锁按 ROOT 哈希入 /tmp） | N9 并发负例（第二实例非零退出+锁消息+树哈希不变）；元负例 `V39-flock-line-deleted`/`V39-lock-after-backup` RED |
| 6 | round64-audit.md:272 Gradle -P | Minor | T11：ERRATUM-2 append-only（两命名空间各自优先级；Gradle 属性命令行来源仅 -D；`gradle properties -P` 分类实测佐证） | 全文 grep：`-P` 仅存于历史 ERRATUM-1、其超替注记与本勘误的项目属性节 |
| 7 | round66-audit.md:44/46 管道符 | Minor | T12：单元格内全部裸管道转义（(EXIT\|INT\|TERM)、restore \|\| exit 1…、cp $_bak $_tgt \|\| cmp、trap 'restore \|\| exit 1; echo x'） | 两行未转义管道数复核 = 5（恰为表格结构管道） |
| 8 | v3:434 V3-41 无顺序断言 | Minor | T14：verify→rename **邻接**断言（`if (verifyEngineSha256(tmpFile)) {\n` + 20 空格 rename 行）——比纯 indexOf 顺序更强（钉包含关系）；单一共享实现使两路径同享该保证 | 元负例 `V41-verify-deleted` / `V41-order-swapped` 双 RED |
| 9 | v3:471 V3-43 只钉声明位置 | Trivial | T13：钉截断**赋值** `appendLen = i + 1; break; }` 位于 maxChars throw 之前（声明/赋值/throw 三锚点有序） | 元负例 `V43-charcap-before-truncation` RED |

## 3. SonarCloud PR #57 四 Issue 处置表

| 规则 | 级别 | 位点 | 处置 | 状态 |
|---|---|---|---|---|
| java:S1192 | CRITICAL | StockfishNative:4851 "Failed to delete: " ×8 | T3：`LOG_DELETE_FAILED` 常量 + T2 共享级联（×1）；V3-41(8) 钉字面量仅存于常量声明 | 结构性清除（待远端重扫确认） |
| java:S1066 | MAJOR | StockfishNative:1812 嵌套 if | T4：优先级 3 两守卫合并为单条件（语义等价走查） | 结构性清除 |
| javascript:S6582 | MINOR | ai-bridge.js:5221 | T5：`_e?.message\|\|_e`（全取值域与原三目等价，含 falsy throw 与空 message） | 结构性清除 |
| javascript:S7765 | MINOR | stats.html:801 | T7：`slice().indexOf('\n')<0` 检查整体消失（换行缓存替代，切片前先查） | 结构性清除 |

重复率 13.2% > 3% 的主消除量：两对孪生级联（~80 行逐行相同）+ 两处缓存门（~30 行）。
**门绿判定以推送后 Sonar 面板实时数据为准**；若仍 >3%，下一目标是 O-1（engineGoInternal/
engineGoTimed ~90 行，round-62 起挂账）——禁止排除文件/调阈值/稀释分母（§3.9）。

## 4. 实施明细（代码层）

- **T1 `cachedEngineAcceptable(File destFile, String label)`**：早退形身份门（`!exists || length
  != EXPECTED || !isElf` → null）+ root 设备 SHA 门（不匹配删除并回退重抽）+ 复用路径
  （makeExecutable/currentEnginePath 置位）。两调用点 label：`"extracted"` / `"asset-extracted"`。
  日志措辞变化（"Cached engine" → "Cached extracted/asset-extracted engine"）为诊断文案，无行为影响。
- **T2 `commitExtractedEngine(File tmpFile, File destFile, String label)`**：尺寸门→ELF 门→
  `.tmp` 上 SHA→原子 renameTo→makeExecutable；任一失败删 `.tmp` 返回 null（F-7 协议不变）。
  两调用点 label：`"APK"` / `"assets"`。
- **T4**：优先级 3 的 exists/canRead/isFile 与 length==EXPECTED&&isElf 合并（O-3 语义不变）。
- **T6 `_pgnFirstGameSplit(text)`**（tablebase.js 与 stats.html **字节一致双实现**，V3-45 钉）：
  行切分一遍扫描 + 前缀位置表；分割规则=「≥1 空白行（仅空白符/空行）夹在前一行与 `[` 开头行
  之间，分隔符吞开行 `\n` + 全部空白行（含其中的空格）」——与旧正则匹配跨完全一致（fuzz 证）。
  `${k=0 时的开行=行 0（BOI 后行首 \n 或行内空格后的 \n）}`等边缘在 fuzz 手工集中覆盖。
- **T7 单调缓存**：`_nextClose(from)`（-1 视作 +∞ 缓存）+ `_closeWsStart()`（缓存 `]` 的前置
  空白段起点，消逐候选 trim 重扫）+ `_nextNl(from)`；未加引号分支改动（区段不相交论证见 §5.3）。
- **N9 首版实现缺陷（如实记录）**：零触碰检查 `!= "$_N9H2"` 丢 `$`（比较对象成字面量）→ 恒
  假阳性；手动复现（持锁+子实例）与脚本内行为差分定位，24 秒全量复跑确认修复。
- **N8 fail-closed 缺口（元负例当场抓获）**：空 harness exit 0 可假绿 → N8 现要求**退出码与
  `R67-BENCH OK` 标记双证**；`META[N8-harness-emptied]` RED 验证。

## 5. T8 等价性与基准数据

### 5.1 差分 fuzz（scripts/r67-fuzz-bench.js，旧实现取自 ref-r66 树原样提取）

| 对比 | 语料 | 例数 | 差异 |
|---|---|---|---|
| 分割：round-66 lookbehind 正则 vs 新扫描器 | 结构化 legit + 手工边缘 31 例（前导空白行/空格空白行/CRLF/`\u00a0`/`\u2028`/无 `[` 尾）+ 随机有界 60,000 + 敌意小件 6 | **64,037** | **0** |
| 扫描头：round-66 扫描器 vs 新缓存扫描器 | 结构化 legit + 手工边缘 26 例 + 随机有界 60,000 + 敌意小件 6 | **64,032** | **0** |

### 5.2 敌意基准（新实现，上界 1000ms；沙箱 Node，2026-11-21）

| 用例 | 新实现耗时 | 备注 |
|---|---|---|
| 分割：10 万空格空白行对（无 `[`） | 8.0ms | 旧形态 4k 件即 36.2ms（25× 输入 4.5× 时长——每字节 >112× 优势且随 n² 恶化） |
| 分割：100 万换行 | 74.0ms | |
| 分割：10MB 单行 | 8.7ms | |
| 分割：5 万真实多局 | 13.0ms | |
| 扫描：`[Event x`×200k（无 `]`） | 51.0ms | 旧形态 4k 件 1.4ms（外推 200k ≈ 3.5s；原生 indexOf 常数小但 n² 仍在） |
| 扫描：`[Event x\n`×200k+`]` | 50.6ms | CodeRabbit #4 第二形态 |
| 扫描：`[A `×200k+`\n`+100 万空格+`]` | 27.0ms | 旧 trim 逐候选重扫空白段（round-66 也未覆盖的第三形态） |
| 扫描：引号重型 ×200k | 30.0ms | 未加引号分支区段不相交（§5.3） |
| 扫描：`[FEN `+10MB 空格（无 `]`） | **293.7ms（最坏）** | round-66 实测 24ms（1M 空格）的 10× 规模 |
| 扫描：10MB 单行混合标签 | 159.9ms | |

### 5.3 线性性论证（实现内注释同步记载）

1. **分割**：行一遍扫描 + 每空白行至多被回看一次（分割点吞尽空白行段；未触发分割的段不回看）。
2. **扫描候选值起点 `_j` 严格递增**：`[_b+1, _j)` 全为 `\w` 或 `\s`（不含 `[`）→ 下一候选
   `_b' ≥ _j` → `_j' > _j` → 缓存查询单调、缓存扫描区段互不重叠，每位置 O(1) 次访问。
3. **`_closeWsStart`**：每个缓存 `]` 计算一次前置空白段起点；段与段之间被 `]`（非空白）隔断，
   总扫描 O(n)。
4. **未加引号分支不改**：引号扫描段以"下一个未转义引号"为界——任一进行中扫描遇到引号即止，
   后续候选的引号扫描只能从更晚的引号开始 → 区段互不重叠（转义破例情形由 fuzz 引号类覆盖，
   基准实测 30ms）。
5. **线性是行为属性**：上表数据 + N8 可执行断言（r67-bench.js 上界 1000ms）守护；V3-45 文本
   谓词只防已知坏形态回潮（方法论 round-67 硬规则③）。

## 6. V3-39 名实对照表（T17，round-67 升级后）

| ok() 标题声称的属性 | 对应谓词 |
|---|---|
| self-resolved root | `^ROOT=.*BASH_SOURCE/m` |
| flock 工作区互斥**先于首备份** | 三实现行（LOCK= / exec 9> / flock -n 9）+ `lockIdx < bakIdx` 次序断言 |
| 独占 mktemp -d 备份目录 | `^BAK=\$\(mktemp -d\)/m` |
| 备份/恢复/每项恢复全链字节复核 | backup_one 体 `cp && cmp -s`；restore_one 体 `if cp && cmp -s; then`；neg() 内 `if ! cp \|\| ! cmp` |
| 武装行两目标备份 | `^if ! backup_one "\$AB" … \|\| ! backup_one "\$STF" …; then$` |
| trap 恢复为命令形状（EXIT/INT/TERM） | `^trap\s+'restore\s*\|\|\s*exit\s+1[^']*'\s+(EXIT\|INT\|TERM)` ×3 |
| 失败累计 + 真实退出码 | `FAILED=\$\(\(FAILED\+1\)\)` + `[ "\$FAILED" -gt 0 ]` + `^set -o pipefail` |
| 无绝对路径 | `!includes('/home/')` |
| N8 基准门接线 | `includes('node runs/r67-bench.js')` |
| N9 并发负例接线 | `includes('bash "$0" >"$_N9LOG"')` + `includes('TREE MODIFIED…')` |
| 台账指向实物 | vl 含 r62-negative-tests.sh 与 r67-bench.js、不含沙箱路径 |

## 7. 元负例 17 场景（scripts/r67-meta-neg.sh，全 RED 实跑记录）

V3-41：verify 删除 / rename 包裹 if(false) / 缓存调用点删除 / 身份门回退 >MIN / 提交调用点
删除 / 日志字面量复活 / verify-rename 换序——7 RED。V3-43：maxChars throw 前插（截断赋值
失效形态）——1 RED。V3-45：lookbehind 回潮（tablebase 调用点换旧正则）/ 孪生失同步（stats
单侧改动）/ 缓存声明抹除——3 RED。V3-46：worker-pool.js 复活——1 RED。V3-47：.gitignore
移除——1 RED。V3-39：flock 行删除 / 锁移到备份之后（次序）/ bench 接线摘除——3 RED。
N8 fail-closed：harness 清空（exit 0 无标记）→ 负向门整体 FAILED——1 RED（缺口当场闭合）。
恢复后终检 49/49 绿。

## 8. 构建与 APK 六连验

- 环境：Temurin 17.0.21 + Gradle 8.11.1（init-script 摘除官方仓库、阿里镜像接管）+ AGP 8.7.2
  /SDK 35（build-tools 34+35）/NDK r27c(27.2.12479018)/cmake 3.31.6；SDK 掏空后按
  r67-sdk-repair.sh 重拉（§环境坑）；`-Dorg.gradle.jvmargs` CLI 覆盖（优先级矩阵见
  round64-audit ERRATUM-2）。
- 构建：compileReleaseJavaWithJavac BUILD SUCCESSFUL（41 条预存 deprecation 警告，0 错误）→
  首次 assembleRelease 因 cmake share 模块被掏空失败 → 重拉 cmake 后 `rm -rf .cxx` 重建
  **BUILD SUCCESSFUL（51 任务）** → 二次构建排竞态 SUCCESSFUL（3 executed, 48 up-to-date）。
- 六连验（scripts/r67-six-verify.sh，全过）：
  1. APK **81,545,261 B**（`build/outputs/apk/release/Regalia-release.apk`；round-66 为
     81,542,436 B）；
  2. 签名 **v1/v2/v3 全 true**（apksigner --verbose；v3.1/v4/SourceStamp false 如期）；
  3. 证书 SHA-256 **45bc6d36…05a8d8bc**（与历轮一致）；
  4. **versionCode=10203 / versionName="1.2.3"** 锁死；
  5. APK 内 chess.html 与源码树**逐字节一致**（1,493,374 B / 24,287 行-wc；build-chess.py
     报 24,288 行/1,493,374 B，两次重建 cmp 0 差异）；
  6. 引擎**官方 tar = 磁盘 = APK 三方逐字节一致**，100,695,968 B，
     SHA-256 ffd8fc2004d3d19f9fdab95d84c92709aea92e8d3af405eda0b281b23cf1daf8；
  7. 构建后负向交付门：**九门全绿 exit 0**（N1-N7 变异 RED + N8 基准 + N9 互斥）。
- 六连验脚本首版 grep 模式未适配 apksigner 的 "(APK Signature Scheme v2)" 括号内编号而误报
  MISSING——apksigner 原始输出三 scheme 全 true，修正模式后复跑全过（如实记录）。

## 8a. 本轮变更文件清单（vs 远端 head `3a083a4a`）

修改 15：`.github/workflows/release-helper.yml`（**不入 zip**——保护路径，渠道无能力，交付为
web 编辑指引）、manual-en/zh、methodology、chess.html、ai-bridge.js、tablebase.js、stats.html、
StockfishNative.java、verifier/README.license、r62-negative-tests.sh、round64-audit.md、
round66-audit.md、v3/round54-pr56-triage.js、worklog.md。新增 3：`.gitignore`、
`verifier/runs/r67-bench.js`、`verifier/runs/round67-audit.md`。删除 1（远端待用户 web 执行）：
`src/main/assets/chess.src/worker-pool.js`。pr-upload.zip = 17 文件（15 改 − release-helper
＋3 增）。

## 9. 交付清单与远端模拟验证（§7 第 12 步的本地等价证明）

- 老三样：source-backup.tar.gz（166 文件，纯净复核 0/0）/ release.apk / recovery-guide.md(+zip)；
  辅助：pr-upload.zip（**17 文件，含 .gitignore**；**不含** `.github/workflows/*`——渠道无能力）、
  PR57-title-description.txt、SHA256SUMS、README。
- **远端模拟**（纯净远端树 `3a083a4a` + pr-upload.zip 按工作流语义应用[unzip -o，无保护路径
  条目]）：
  - 场景 A（仅上传 zip，两步 web 操作前）：v3 **47/49——恰好 V3-40b（release-helper 仍 SF18）
    与 V3-46（worker-pool 仍在）双红**，其余全绿（含 V3-47——.gitignore 已随 zip 送达）——
    缺口可见化按设计工作；
  - 场景 B（叠加用户两步 web 操作：release-helper `Stockfish 18 engine binary` →
    `Stockfish 19 engine binary (arm64-universal build)` + 删除 worker-pool.js）：v3 **49/49
    全绿**，v1/v2 44/27 全绿，bundle 与交付树逐字节一致，全树 diff 零差异。
- **用户三步**（远端 49/49 全绿的必要条件）：① pr-upload.zip **重命名为 `upload.zip`** 拖入
  upload 分支；② web 编辑器改 `.github/workflows/release-helper.yml` 第 133 行（SF18→SF19
  表述，README 附精确前后文——注意文件内是转义反引号，编辑时只改 `Stockfish 18 engine
  binary` 这一段即可）；③ web 删除 `src/main/assets/chess.src/worker-pool.js`。②③ 为普通
  提交（触发 Sonar 重扫 + CodeRabbit）。
