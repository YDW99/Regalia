# Regalia v1.2.3 — round-68 审计轨迹（2026-11-22）

> 基线：GitHub upload head `414a523b41e81e8dcfc600d8b1fb0352ffcb64bf`（round-67 交付树
> ＋release-helper.yml web 编辑，2026-11-22 06:24 复核 head 未前进）。起始三验证器实跑
> **44/44、27/27、47/49（V3-46/V3-47 RED = T0 预期可见缺口）**；Sonar 门 OK（新代码
> 重复率 0.0%）。本轮输入：2026-11-21 18:16-18:20 三封评审邮件（码兔 4 inline＋2
> outside、PMD braces ×5、mobsfscan CWE-532 ×12）＋Sonar 16 Issue——《round-68 任务
> 规划》已逐条到源码现场核实，本轮按规划实施并逐条独立复核。
> 收官基线：**本地 44 / 27 / 51 项中 50 PASS**（交付树携带 .gitignore——V3-47 本地绿，
> 唯 V3-46 红＝worker-pool.js 按用户决定留待合并后手动删；远端上传后预期 50，dotfile
> 若再未落地则 49，合并后即 51/51），负例门十三项
> exit 0，元负例 9 场景全 RED，行为 fixture 6/6，差分 fuzz 162,416 例零差异。

## 0. 输入处置表（码兔 6 条全属实；Sonar 15 修＋1 豁免；PMD/mobsfscan 平台侧）

| # | 来源/位点 | 级别 | 处置 | 验证 |
|---|---|---|---|---|
| 1 | 码兔 inline：r67-bench.js:91 `' \\n'` 字面量 | — | T1：输入求值为空格+反斜杠+字母 n，无真实换行——字节级核实属实；修复＋输入元断言体系 | N8c RED（元断言对事故形态报用例名）；修复后 case-1 实测 12.6ms |
| 2 | 码兔 inline：r67-bench.js:81-87 同步超时 | Heavy | T2：双层结构（--case 子进程＋父 3s 硬超时 SIGKILL＋点名＋exit≠0） | N8d RED（死循环用例 3s kill＋点名）；正常输出格式与 round-67 逐行一致 |
| 3 | 码兔 outside :2125：body 读取无期限 | Major | T4：try/catch/finally 三段式，AbortError 重抛进既有 catch | fixture 6/6（两停体路径 5.005/5.006s＋failCount=1；404/bad-JSON/5xx 语义回归不变）；V3-48；元负例 3 RED |
| 4 | 码兔 outside :2174：回调无身份校验 | Minor | T5：board 引用身份门＋_tbLoadingBoard 归属令牌（手动+AI 两路） | V3-49；元负例 3 RED（归属删除/autoSelect 门删除/AI 认领删除） |
| 5 | 码兔 inline：V3-41 只钉 if 行不钉分支体 | — | T11：两拒绝分支体 `return null;` 邻接钉法＋reject 单源钉法 | 元负例 ×3 RED（两分支 return destFile、拒绝臂内联回退） |
| 6 | 码兔 inline：round64-audit 项目属性清单漏两来源 | — | T12：ERRATUM-3＋权威优先级表（文档对照＋实测裁决） | §T12 E1-E11；沙箱实测 `-Dorg.gradle.project.foo` 覆盖生效（E3） |
| 7 | Sonar S3504 ×6 / S3776 ×2 / S7766 ×3（分割器两孪生＋扫描器） | CRITICAL/CRITICAL/MINOR | T7/T8：var→let/const、_blankRunStart 助手、Math.max ×2 处 | 差分 fuzz 112,411＋50,005 例零差异；V3-45 同批改钉；N8 基准仍绿 |
| 8 | Sonar S125 :4838 "注释掉的代码块" | MAJOR | **现场核实：全文件无真正的注释掉的代码运行**（三条正则/启发式扫描零命中）；:4836-4840 为含代码式标点链（`→ … ;`）的说明注释且与助手 javadoc 重复——精简为指针（真实冗余清理）。若远端重扫仍报，按本条分析标 FP | 注释前后语义无变化（纯注释编辑）；编译门通过 |
| 9 | Sonar S1192 :5003/:5006/:5010 ×3 | CRITICAL | T10：rejectExtractedEngine 助手单源（字面量 ×3→×1） | V3-41(8-ext) 钉三调用点＋声明＋字面量单源；元负例 M9 RED |
| 10 | Sonar S1066 :1788 优先级 2 嵌套 | MAJOR | T10：合并单条件（round-67 T4 优先级 3 同型先例） | 编译门通过；V3-41(10) 尺寸门钉法不受影响 |
| 11 | Sonar S3776 :4979 复杂度 28 | CRITICAL | T10：抽共享拒绝助手（三拒绝臂一实现） | 编译门通过；V3-41 邻接/调用点钉法全保持 |
| 12 | Sonar S7755 stats 孪生分割器 `[_cuts.length-1]` | — | T9：**平台豁免不改码**——`.at()` 需 Chrome 92+，项目 WebView 底线 84；改码会在 84-91 WebView 崩 | 平台 API 底线清单入方法论（S9412/minSdk23＋S7755/WebView84 两例成表）；用户 Sonar UI 标 FP 附理由 |
| 13 | PMD ControlStatementBraces ×5（邮件 diff 范围；全树 194） | style | T13：`config/pmd-ruleset.xml` 平台侧豁免＋pmd.yml 一行激活（用户 web 操作） | PMD 7.4.0 本地实证：与现行为逐规则等价（diff 仅 braces 194→0）；**附带发现 pmd.yml 另两个 ruleset 引用从未解析**（§T13） |
| 14 | mobsfscan CWE-532 ×12（邮件 diff 范围；全树 264） | info | T13：`src/main/java/.mobsf` 仓库侧豁免（round-56 SEC-06 proguard 实证理由） | mobsfscan 1.2.0 本地实证：264→0、其余规则不受影响（hijacking 1/js-interface 3 照报）；UI 逐条 Accept 不再需要 |

## T0 交付管线（立项收口）＋git 直推方案

**三先天限制（round-67 定性，round-68 立项跟踪）**：①`.github/workflows/*` 被解包工作流
保护性剥离——workflow 修改唯一通道是 web/git 直改（本轮 pmd.yml 一行激活即此类）；
②覆盖式上传不能删除文件——worker-pool.js 须合并后手动删（V3-46 钉缺席，过渡期 RED
是缺口可见化特性）；③dotfile 经 zip 渠道不可靠（.gitignore 前科，原因未定案）——
.mobsf 与 .gitignore 均留 web 兜底指引＋远端复核断言。

**合并后三步 checklist（交付 README 同文，用户操作）**：
1. web 删除 `src/main/assets/chess.src/worker-pool.js`（732 行死代码；V3-46 转绿）；
2. web 建 `.gitignore`（内容见交付 README；V3-47 转绿）——若 round-68 zip 的
   .gitignore 已落地则跳过；
3. 远端快照复跑三验证器至 **51/51 全绿**（codeload tar 下载→跑 v1/v2/v3＋bundle
   字节核对 24,358/1,498,288）。
PR #57 stale 大限 **2026-12-21**，合并收尾在此前。

**git 直推方案（T0-b 立项文档化；实施视沙箱凭据可用性）**：一次性消灭"不能删/workflow
被剥/dotfile 丢失"整类交付完整性问题。两条路线——
- 路线 A（沙箱 git push）：`git clone` upload 分支 → 应用 round-68 变更集（或解包
  source-backup）→ `git add -A`（**能表达删除**）→ commit（署名 D.W. Yang）→ push。
  凭据约束：PAT 只经环境变量/凭据管理器注入命令，**永不写入仓库、文档、tar、zip、
  交付 README 或任何会离开沙箱的文件**；凭据用后即焚（unset）。
- 路线 B（GitHub Contents API 逐文件）——**round-69 勘误（CodeRabbit PR#57
  Major＋Minor）**：原文写「PUT `…/<path>?ref=upload`（base64 内容＋sha 可表达
  修改与删除）」有两处错误，均已按 Contents API 文档（docs.github.com）更正：
  1. **写入分支必须在请求体里指定**：URL 上的 `?ref=upload` 只是读取基准，不指定
     写入分支——默认分支不是 upload 时 PUT 会写到默认分支，或因 sha 不匹配而
     409。每个 PUT/DELETE 请求体都必须带 `"branch": "upload"`。
  2. **PUT 不能删除文件**：PUT 只能创建/替换（base64 内容＋当前 sha 表达修改）；
     删除必须用同端点的 **DELETE** 方法，请求体带 `{"message", "sha": <文件
     blob sha>, "branch": "upload"}`。按原文操作 worker-pool.js 会残留、
     V3-46 持续 RED。
  一次循环送全部变更文件（修改走 PUT、删除走 DELETE）；同样凭据约束。
- 共同验收：推送后对远端 head 快照复跑三件套＋`diff -rq` 远端 vs 本地交付树零未解释
  差异（§7 硬断言照走）——git 直推改变的是"送达通道"，不豁免"送达后复核"。

## 批次① N8 基准完整性（T1/T2/T3）

- **T1 字面量字节级核实**：round-67 源 `' \\n'` 在 JS 求值为 3 字符串（空格、反斜杠、
  字母 n）——`input.indexOf('\n') === -1`，旧分割器的按行路径根本不触发；对照 :92
  `'\n'` 为真实换行。修复为 `' \n'.repeat(100000)` 后该用例在**旧正则形态上耗时显著
  上升**（N8a 注入实测：被 3s 硬超时 kill）——用例从"空转假绿"变为"真抓回归"。
  **输入元断言体系**：CASES 表每项声明 `spec`（realNewline/bracket/closeBracket——
  用例名所声称的输入类不变量），子进程 build 后、bench 前逐一断言，失配即 fail 并报
  用例名。10MB 单行用例显式声明 `realNewline:false`（其类本就无换行——断言双向，
  意外引入换行同样 RED）。
- **T2 双层结构**：子进程 `node r67-bench.js --case <name>`（沿用提取逻辑：splitter/
  scanner 块从源文件 verbatim 提取＋new Function 执行，只读不写树；子进程自身也执行
  BOUND_MS 界检查——双保险）；父进程串行 spawn＋`HARD_TIMEOUT_MS=BOUND_MS*3`，超时
  SIGKILL＋`bench <name>: child exceeded 3000ms hard timeout — killed`＋门失败。
  判定＝父进程退出码＋`R67-BENCH OK` 标记双证（r62 门既有约定）。**锁纪律**：bench
  只读不取锁；r62 负例脚本内所有 bench 调用 `9>&-` 关闭互斥锁 fd——node 子进程不继承
  工作区互斥（N9 第二实例 fail-fast 语义不受影响，实测 N9 照常 zero-touch RED）。
- **T3 负例自证（全部 RED-verified，入负例门为常设门）**：
  - N8a：round-66 lookbehind 形态（worklog:939 原文 `(?<!\n)\n[^\S\n]*\n(?:[^\S\n]*\n)*
    (?=\[)`）注入**两孪生同体**（孪生字节等检查保持可满足——失败必须来自时序界本身，
    而非孪生失配的"错误原因的红"）；实测 case-1/case-2 被 3s kill（空间空白行类
    Θ(n²) 现场重现）。
  - N8b：扫描器 `_nextClose` 回注 per-candidate `text.indexOf(']',from)` 重扫
    （r66-#4 二次类；保留箭头花括号形使 bench 提取器照常命中——失败来自时序）；
    实测 3 用例 1,180-2,117ms 超界 RED（该形态在现输入规模下秒级而非分钟级——
    断言接受"硬超时 kill **或** 界超"两种合法 RED，机器快慢都成立）。
  - N8c：`' \n'.repeat`→`' \\n'.repeat` 事故重注→元断言 RED（报用例名）。
  - N8d：死循环用例（build 处 `for(;;){}`）→父进程 3s kill＋点名＋exit≠0（round-67
    形态对此类用例**永不报失败**——T2 修复的行为级证明）。
- **负例脚本扩展**：备份集四目标（ai-bridge/stats/tablebase/r67-bench，字节复核
  cp+cmp）；`mutcheck`/`restore_mut` 与 neg() 同纪律；终检只豁免**恰好** V3-46/V3-47
  两个文档化过渡 RED（其余任何 v3 失败仍拦——失败的变异还原无法借豁免藏身）；收尾
  消息更新为**十三门**。V3-39 同批改钉（四目标备份行、N8a-d 门标签、run_bench
  fd 纪律、restore_mut 形状）。

## 批次② tablebase 网络健壮性（T4/T5/T6）

**T4 期限覆盖响应体**（新形全文见 tablebase.js:2066 起，语义对照表）：

| 路径/场景 | round-67 行为 | round-68 行为 | fixture 实测 |
|---|---|---|---|
| ctrl 路径·停体（发头后 body 挂起） | **无限挂起**（fetch 返回头即清定时器） | 5s abort→json() 拒绝 AbortError→**重抛进外层 catch** | 5,005ms，null，failCount=1 |
| legacy 路径·停体（无 AbortController） | 挂起（race 只包 fetch） | race 包整条 fetch→status→body 链 | 5,006ms，null，failCount=1 |
| 正常 200 | 返回+缓存+清零 | 同 | payload 返回、cache=1、failCount 2→0 |
| 404 | null 不计数（Rev62） | 同 | null，failCount 保持 2 |
| 5xx ×3 | 三击离线 60s | 同 | 第三击 offline=true |
| bad JSON | null 不计数（PHASE 19） | 同（AbortError 除外——重抛） | null，failCount 保持 2 |

设计要点：`tmr` 声明在 try **外**（finally 覆盖所有路径含 early return）；`_fetchProbe`
为两路径共享的单链（对称面单一实现）；`undefined` 作 handled-outcome 哨兵（JSON 解析
永不产生 undefined——字面 `null` body 保持历史缓存+清零语义，如实保真）；Promise.race
对输家 fetch 附挂处理器（round-66 F-11 论证保持——迟到的网络拒绝不会变 unhandled
rejection）。

**T5 身份门＋归属令牌**：共享可变旗＋双写者（手动 `_triggerTbQuery` 有再入门、AI 路径
**无**再入门直接覆写）⇒ 归属必须显式。`_tbLoadingBoard`（模块级、board **引用**相等、
非 gen 计数器）：手动路径发起时捕获+认领，回调两臂 `if(_tbLoadingBoard===_boardAtQuery)`
 才降旗清偿；autoSelect 另有 `gameState.board===_boardAtQuery` 板等价门（过期推荐
永不上到已变局面）；AI 路径武装点补认领 1 行＋.then/.catch 两臂同规则降旗。全案例
推演（含 AI-AI 竞态、纯换局不卡死——过期回调**仍清偿自己的旗**避免手动按钮永久
卡死、AI 覆写窗口期 stale 手动回调不再误降 AI 的旗）入代码注释与 V3-49。

**T6 哨兵**：V3-48（位置锚定：tmr 声明索引 < try < body 解析 < clearTimeout·finally；
AbortError 重抛行；`if(data===undefined)return null;` 行锚定；legacy race 包
`_fetchProbe()` 整链；旧早清形与裸 fetch race 形禁令）＋V3-49（令牌声明行、捕获+认领
邻接、两臂只清己有 ×2 计数、autoSelect 门三行形、AI 认领邻接＋两臂 ×2 计数、旧无门
形禁令）。**元负例 6 场景全 RED**：M1 早清重注/M2 重抛删除/M3 race 降范围（→V3-48）；
M4 归属删除/M5 autoSelect 门删除/M6 AI 认领删除（→V3-49）；还原后 v3 复 49+2。

## 批次③ Sonar 清理（T7/T8/T9/T10/T11）

- **T7/T8 孪生分割器重写**（两文件字节一致，V3-45 孪生检查持续 PASS）：var→let/const
  （_ls/_pos/_cuts/_run/_i/_out 六处）；`_blankRunStart=(line,idx,run)=>/^\s*$/.test
  (line)?(run===-1?idx:run):-1` 局部助手（等价性逐分支证明：空白+无 run→idx；空白+
  有 run→保持；非空白→-1）；`_pos[Math.max(_run,1)]`（`_run>=1?_run:1` 全整数域
  等价）；扫描器 `Math.max(_ws,_j)`。**差分 fuzz**（xorshift32 确定性语料，可复现）：
  分割器 112,411 例（结构化 PGN 2 万＋对抗类＋字母表 `[]"\\ \n\r\t\u00a0` 噪声 6 万＋
  tag 形噪声 2.5 万＋拼接/前导空白/多空行变体）**零差异**；扫描器 50,005 例**零差异**。
  `[x.length-1]` 形保留（S7755 平台豁免）。
- **T9 平台豁免**：S7755 建议 `.at()` 替代 `[arr.length-1]`——**不采纳改码**：
  Array.prototype.at 需 Chrome 92+（V8 9.2），项目 WebView 底线 84（低版本直接
  TypeError 崩页面）。处置：代码不动＋"平台 API 底线对照"清单入方法论 §5
  （minSdk 23：List.sort API24+/networkSecurityConfig API24+；WebView 84：.at() 禁用/
  lookbehind 62+ 可用/AbortController 66+ 可用且有兜底；Java 8 无 desugaring）＋
  用户在 Sonar UI 对该 Issue 标 False Positive 附此理由（两例成表防第三例）。
- **T10 StockfishNative**：`rejectExtractedEngine(File tmpFile, String label, String
  reason)`——log＋best-effort 删 .tmp＋return null，三拒绝臂一实现（S3776 复杂度 28→
  12 估算；S1192 字面量 ×3→×1）；优先级 2 合并（S1066）；:4836 调用点注释精简
  （S125——**诚实定性**：全文件无注释掉的代码块，Sonar 命中的是含 `→ … ;` 代码式
  标点的说明注释，且与 commitExtractedEngine javadoc 重复——精简是真冗余清理；重扫
  若再报按此标 FP）。**V3-41 全部既有钉法保持**（尺寸常量行/早退形两门/两 label 调用
  点/verify→rename 邻接/LOG_DELETE_FAILED 单源/tmp 流 ×2/优先级 1-3 尺寸门/死守卫
  禁令）；编译门 BUILD SUCCESSFUL（16 任务）。
- **T11 V3-41 分支体钉法**：尺寸/ELF 分支 `!isElfFile(destFile)) {\n            return
  null;\n        }` 邻接钉；SHA 分支删失败日志行后邻接 `return null;`（分支块结束前）。
  元负例：两分支各 `return null;`→`return destFile;` 均 RED（方法返回 File，该变异
  编译得过且放行坏缓存——round-67 钉法的真实缺口）；M9 拒绝臂内联回退 RED（单源钉法）。

## 批次④ 文档收口＋平台豁免（T12/T13/T14）

**T12 Gradle 权威优先级表（E1-E11 实测配方，Gradle 8.11.1＋Temurin 17.0.21，
/tmp/gradle-prio 最小工程可复现）**：

| 实验 | 设置 | 结果 |
|---|---|---|
| E1 | 仅项目根 gradle.properties `foo=…` | from-properties-file |
| E2 | 根文件 vs `ORG_GRADLE_PROJECT_foo` env | **env 胜** |
| E3 | 根文件 vs `-Dorg.gradle.project.foo` | **系统属性胜**（规划验收项✓） |
| E4 | 根文件 vs `-Pfoo` | -P 胜 |
| E5 | env vs `-P` | -P 胜 |
| E6 | env vs `-Dorg.gradle.project.*` | 系统属性胜 |
| E9 | `org.gradle.project.foo` 写在 GUH gradle.properties（唯一来源） | **foo unset——该形态 8.11.1 完全无效** |
| E10 | GUH 文件 vs 项目根文件（同名 plain 键） | GUH 胜 |
| E11 | GUH 文件 vs env | **env 胜** |

**结论**（ERRATUM-3 收口，全文见 round64-audit）：Gradle 属性（org.gradle.*）＝命令行
-D ＞ GUH ＞ 项目根 ＞ GRADLE_HOME（与官方文档表一致）；项目属性＝**-P ＞
-Dorg.gradle.project.* ＞ ORG_GRADLE_PROJECT_* ＞ 各级 gradle.properties**——与官方
文档"四选项"列表的第 3/4 位次**相反**（E2/E11：env 实胜文件），且文档第 2 项"or
gradle.properties file"措辞与 E9 实测不符（文件内该形态无效）。分歧如实记录，**以实验
为准**；同套实验为后续版本复核配方。勘误递归封顶原则（第三轮必须产出权威表＋可复现
实验，标注前次 superseded）入方法论 §5。

**T13 平台侧豁免（两配置入仓，全部本地实证）**：
- `config/pmd-ruleset.xml`：quickstart 减 ControlStatementBraces。**附带发现**：pmd.yml
  的 `rulesets/java/errorprone.xml` 与 `rulesets/java/bestpractices.xml` 在 PMD 7.4.0
  **Cannot resolve**（PMD 6 弃用别名，7.4.0 jar 内无此文件——unzip -l 核实）——CI 的
  PMD 自始只跑了 quickstart。新 ruleset 与现行为逐规则 diff：**仅 ControlStatement
  Braces 194→0**，其余逐条相同。激活＝pmd.yml "Run PMD" 步 rulesets 一行改为
  `config/pmd-ruleset.xml`（用户 web 编辑——保护路径；两个死引用同编辑删除）。
- `src/main/java/.mobsf`：`ignore-rules: [android_logging]`（YAML；mobsfscan 以首个
  扫描路径寻找 .mobsf——workflow 首参即 src/main/java，零工作流改动自动生效）。
  实证：264→0；android_task_hijacking2（1）与 webview_javascript_interface（3）照报
  （豁免不扩面）。理由（round-56 SEC-06）：proguard -assumenosideeffects 剥离
  Log.v/d/i/w（release 不存在），仅 Log.e 保留且带路径 E 级恰两处 documented 残余
  （引擎提取失败路径），离线优先无用户数据。**dotfile 渠道风险**：.gitignore 前科
  ——zip 携带＋README 指引用户 web 兜底创建＋交付后远端复核断言三保险。
- 验收对照：下轮 PMD/mobsf 评审不再重报 braces/CWE-532 类；若重报，直接引用本节＋
  配置文件头注释。

**T14 方法论入档**：§4 基线表更新（v3 51 项：49 PASS＋2 过渡 RED，V3-48/49 新增）
＋round-68 状态闭环行；§5 新增三条——平台 API 底线对照清单（评审器建议先对表）、
基准输入自身也要被守护（N8 字面量事故一般化）、勘误递归封顶（ERRATUM-3 首例）。

## 构建与六连验

构建环境从零（scripts/r68-env-setup.sh：腾讯镜像 platform-tools r37.0.3/platform-35
r02/build-tools 35.0.0/cmake 3.31.6/NDK r27c（663,987,688 B 与指南精确一致）/Gradle
8.11.1＋清华 Temurin 17.0.21；全部 source.properties/android.jar/cmake Modules/
javac 存在性验证通过）。init-script 走 BUILDING.md 镜像配方（beforeSettings 级
Aliyun 前置）。Java 编译门 22s BUILD SUCCESSFUL。构建命令与内存覆盖同 round-67
（`-Dorg.gradle.jvmargs=-Xmx1536m…`，见指南 §2.3）。APK 重建 ×2 排竞态；六连验
数据（v1/v2/v3 签名、证书 45bc6d36…、版本 10203/"1.2.3"、chess.html 逐字节
24,358/1,498,288、引擎 ffd8fc20…/100,695,968）见交付 SHA256SUMS 与下方记录。

实测记录（2026-11-22，两遍构建 cmp 逐字节一致——无竞态）：

- APK：`Regalia-release.apk` **81,559,890 B**（round-67：81,545,261；增量来自 T4/T5 的
  chess.html 与本轮 Java 改动）。
- 六连验：①v1/v2/v3 签名全 **true**（apksigner；v3.1 false＝设备无关预期）；②证书
  SHA-256 **45bc6d36c9fcff8ef9e55f510b43bce44cb854ea4b2f235a0f4955da05a8d8bc**；③
  versionCode **10203**/versionName **"1.2.3"**（锁死）；④APK 内 chess.html 与源
  **逐字节一致**（1,498,288 B/24,357 行[wc 口径；builder 报 24,358 含尾行]）；⑤引擎
  SHA **ffd8fc20…1daf8**/100,695,968 B，APK 内与 jniLibs 逐字节一致；⑥构建后负例门
  **十三门全绿 exit 0**＋三验证器 44/44、27/27、50/51（V3-46 过渡红）。
- Java 编译门：compileReleaseJavaWithJavac BUILD SUCCESSFUL（22s，41 条既有风格警告，
  无新增错误）。

## 交付清单（老三样＋辅助）

1. `Regalia-v1.2.3-round68-source-backup.tar.gz`（纯净树，排除清单见指南 §3.3；
   `tar -tf | grep` 复核 0 命中＋口令扫描 0 命中）
2. `Regalia-v1.2.3-round68-release.apk`（六连验通过）
3. `Regalia-v1.2.3-round68-recovery-guide.md` ＋ `.zip`（round-68 版恢复指南）
4. `Regalia-v1.2.3-round68-pr-upload.zip`（改名为 upload.zip 拖入 upload 分支；
   含 .gitignore/.mobsf/config/ 等 round-68 全部变更文件——**不含**需 web 操作的
   pmd.yml 激活与文件删除）
5. `Regalia-v1.2.3-round68-SHA256SUMS.txt`
6. `README.md`（用户操作指导：上传步骤、pmd.yml 一行激活、.gitignore/.mobsf web
   兜底、合并后三步、PR 收尾时限）

**交付后硬断言**（指南 §7 第 12 步）：上传后对远端 head 快照复跑三件套（预期
44/27/50-of-51 PASS——.gitignore 经 zip 落地则 V3-47 绿；若 dotfile 再未落地则 49，
按 README web 兜底建 .gitignore 后复跑至 50）＋bundle 字节核对＋改动文件清单逐一
对照——本地树全绿不构成交付完成的证明。
