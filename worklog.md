# Regalia v1.2.3 — round-69 工作日志（2026-11-22 UTC+8）

## 任务来源

用户确认 web 删除 `worker-pool.js` 后指令：「了解上传的内容，实施所有值得实施
的措施」。upload/ 新输入三份：《元宝指导(2026.11.22).md》（四步走指导）、
PR#57 CodeRabbit 9 条意见全文邮件 PDF、Dependabot 双 High 漏洞邮件 PDF
（`bcprov-jdk18on` + `guava`，manifest=settings.gradle）。

## 基线确认（round-68 收官）

远端 main `6ed30d3f`（PR#57 `78119023` → PR#58 `.gitignore` `850e9c21` →
web 删 worker-pool.js；main/upload 同 head）。codeload 快照首跑三验证器
**44/44、27/27、51/51**——V3-46/V3-47 双转绿，round-68 全链路（四步手动 +
合并 + 删除）验证收官。PR#58 在收到指导时已合并，指导第 2 步「合并后重跑
verifier」同步完成。

## 实施纪要（细节/数据全部入 verifier/runs/round69-audit.md）

**CodeRabbit 9 条意见 9/9 处置**（T-a 分诊表）：

- **tablebase.js 双 Minor 改根**（T-d）：loading-flag ownership token 从
  board 引用（同引用双 arm 时早回调误清 flag）换成 **fresh object per
  query**（`_tbLoadingOwner`，manual/AI 双入口同机制，reference-equality
  语义保留）；5xx 失败计数从 fetch 链内联改为 **`_TB_NETFAIL` 冻结 sentinel
  ＋竞速落定后单点计费**（legacy 路径超时已计＋迟到 5xx 再计的双计洞堵死）。
  V3-48/V3-49 验证器同步重锚（新增 sentinel/单点计费/内联回归负锚；
  `_tbLoadingBoard` 双文件零出现负锚）。
- **.mobsf 意见根修不删豁免**（T-b）：sendUciCommand 的
  `Log.e("…" + command)` 去掉 command 内容（FEN 不再可能进 logcat，release
  幸存的 Log.e 是真实泄漏面）；全局豁免保留并 rationale 可审计化——剩余
  ~263 条全是 release-proguard 剥离的 Log.v/d/i/w，mobsfscan 无行级豁免粒度，
  删全局＝263 条噪音 alerts 淹没真信号（alert fatigue 反模式）。Log.d（debug
  专属，release 剥离）保留供开发诊断。
- **r62 Major 完成 marker 门**（T-i）：v3 异常退出（无 RESULT、无 FAIL 行）
  不得进入豁免分支——RESULT 存在性门＋声明计数/实际 FAIL 行一致性门；定向
  自测 5/5（kill 拦截/纯豁免放行/意外失败拦截/计数不符拦截/全绿放行）。
  豁免本体保留（post-merge 51/51 已确认，allowance 降级为纯保险）。
- **r67-bench Minor**：closeBracket:true 且输入无 `]` 的镜像拒绝分支
  （既有用例全过，`R67-BENCH OK`）。
- **round64-audit Minor＋E12 实测**（T-c）：项目根 gradle.properties 内
  `systemProp.org.gradle.project.foo=bar` 实测**有效**（foo=bar；无前缀形态
  复测仍无效；无文件基线 null）——官方文档 "or gradle.properties file" 指
  systemProp. 前缀形态，旧第 5 条「文档与实测不符」是 E9 测错形态，按
  append-only 勘误纪律改写为第 5/6 条。
- **round68-audit Major＋Minor**（路线 B 勘误）：PUT 的 `?ref=upload` 只选
  读取基准不选写入分支→请求体必须带 `"branch":"upload"`；PUT 不能删除文件
  →删除走 DELETE＋blob sha＋branch。
- **README.license Minor**：stats.html 标签 AGPL v3→GPL v3（与文件头及台账
  109/749 行一致），round-69 条目记录勘误；两个 README.license 均新增
  round-69 段。

**CI 修复**（T-e）：codeql.yml 矩阵收敛——删 c-cpp（无 C/C++ 源码）、
java-kotlin→manual＋android-ci 同款构建配方＋setup-java 17＋chmod gradlew
兜底、js/ts 与 python 保持 none。gradlew 可执行位**zip 通道物理不可达**
（zip 不保留 Unix 权限），用户侧 git 命令落地（交付 README 第 1 步）。

**SonarCloud 调查**（T-f）：139 runs 可见 40 次全败（2026-09-05 起）——长期
红、与变更无关、repo 侧不可修（SONAR_TOKEN/项目配置在用户侧）；交付 README
附排查路径。

**Dependabot 双 High**（T-g）：AGP 8.7.3 传递依赖 bcprov-jdk18on 1.77（经
bcpkix，apksig 用）与 guava 32.0.1-jre；buildscript classpath 加
resolutionStrategy force——bc 三件套同 1.87（CVE-2025-14813 修复线）、guava
33.8.0-jre（CVE-2026-102554 修复线）；依赖树复核全链 force 生效；均为构建期
依赖不进 APK。

**构建与交付**（T-h）：沙箱构建环境从零重建（SDK/Gradle/JDK17/引擎自
round-68 APK 提取，SHA 双验）；chess.html 确定性重建 24,393 行/1,500,732 B
（两次构建 SHA 一致）；assembleRelease 全绿；APK 六连验全过（apksigner
v1+v2+v3 Verifies、证书 `45bc6d36…a8d8bc`、10203/1.2.3、chess.html 逐字节、
引擎 `ffd8fc20`/100,695,968B、v2/v3 块 Python 独立解析 2601B×2）。

**门禁终态**：v1 44/44、v2 27/27、v3 51/51、r62 十三门全绿、r67-bench OK、
r62 新门自测 5/5。

## 未实施项（诚实清单，详见 round69-audit T-j）

SonarCloud token 侧修复（用户）；gradlew git mode（用户 git 命令）；
.mobsf 全局豁免保留（根因已修，代价收益分诊见 T-b）；guava CVE-2026-118042
上游修复不可用（已升至 33.8.0-jre 最新，警报如仍在需 alert 详情分诊）。
