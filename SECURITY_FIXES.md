# Regalia Security Fixes — SonarCloud Hotspot 修复

**关联 Issue**: [#34 [Security] SonarCloud 8个Security Hotspots修复建议](https://github.com/YDW99/Regalia/issues/34)

**修复日期**: 2026-07-06（原始 8 项）；**round-42 实况核查与补录**: 2026-08-10；**round-44 复核**: 2026-09-04（StockfishNative +250 行等漂移后全部 file:line 已对照当前代码更新）

---

## round-17~41 安全修复补录（2026-08-10 round-42 实况核查后补录）

> 本节为 round-42 对 worklog.md round-17~41 的提取补录。逐条对照当前代码核实，file:line 以 v1.2.3 round-44 树为准（round-44 复核）。

| 轮次 | 修复 | 位置（当前） | 类别 |
|---|---|---|---|
| round-18 | 移除零使用权限 `ACCESS_NETWORK_STATE` | AndroidManifest.xml（已验证无该权限） | 攻击面收敛 |
| round-18 | 两处 CSP meta 移除无效 `frame-ancestors`（meta 交付不生效的伪指令） | index.html.tpl / stats.html | CSP 卫生 |
| round-18 | tablebase category 回退走 `_esc(_cat)`（XSS 防护模型一致性） | ui.js | XSS |
| round-18 | stats.html 导出 HTML 的 PGN JSON 补 `</` → `<\/` 转义（防闭合 script 截断） | stats.html | XSS/注入 |
| round-19 | JsBridgeGateway 拦截 UCI 命令日志 CR/LF 消毒（java:S5443 日志注入，gitar-bot 交叉印证） | JsBridgeGateway.java:141-142 | 日志注入 |
| round-20 | PGN 标签剥离正则 ReDoS 修复（`\s+`+`[^\]]+` 多项式回溯 → 线性形式，5 处） | stats.html×4 + tablebase.js×1 | ReDoS |
| round-21 | 签名证书重新生成并持久化备份（/tmp 重置致 keystore 丢失；新指纹 SHA-256=8bc19e69…，覆盖安装旧版会被拒，需先卸载） | 构建链 | 供应链/发布 |
| round-23 | stats.html scriptJS 新增 `_enc(s)`：所有 `<` 编码为 `\u003c`（OWASP JSON-in-HTML 推荐），pgnText 与 lang 同编码 | stats.html:3956 | XSS |
| round-23 | PGN tag-strip 正则引号感知化（Q7，ReDoS 形态演进） | tablebase.js + stats.html×4 | ReDoS |
| round-29 | PGN 标签正则统一为规范形式 `/\[\s*[A-Za-z]\w*\s+"(?:[^"\\]|\\.)*"\s*\]/g`，消除多项式回溯（5 处） | stats.html + tablebase.js | ReDoS |
| round-30 | MediaStore 查询 SQL LIKE 通配符（`\` `%` `_`）转义 + `ESCAPE '\\'` 子句 | FileIoHelper.addMediaStoreResults | SQL 注入（语义级） |
| round-30 | `loadAssetAsBase64` 补 `..` 路径穿越检查（与 FileIoHelper 一致，纵深防御） | StatsActivity.java | 路径穿越 |
| round-30 | `JsBridgeGateway.isSafeFileName` 的 `..` 检查作为纵深防御有意保留（评审结论） | JsBridgeGateway.java | 路径穿越 |
| round-36 | `randomSPID()` 委托 `secureRandomInt(960)`（crypto.getRandomValues），保留 518 兜底——彻底消除 PRNG 残留路径 | chess960.js | 弱随机数 |
| round-40 | PGN 剥离正则扩展无引号标签值，病态输入回溯实测线性（10k/100k/1M 字符 0.05/0.4/4ms） | tablebase.js:205-215 | ReDoS |
| round-40 | `fenToState` 结构校验：王恰好各一、兵不在 1/8 排、halfmove 非负整数、fullmove 正整数——收紧 FEN 导入首要攻击面 | tablebase.js | 输入校验 |
| round-41 | 设置导入 `readTextFromUri` 1 MB 字符上限（超限快速失败，防超大文件 OOM；对齐 PGN 路径 5000 行模式） | SafPickerHelper.java:342-368 | DoS/OOM |
| round-41 | sendToEngine 拦截日志改用与 JsBridgeGateway 一致的 CR/LF 消毒字符串（堵 round-19 日志注入修复的旁路） | StockfishNative.java:3833-3834 | 日志注入 |

### 原始 8 项的 round-42 复核结论

- 条目 1/2/3/4/7/8：修复仍然在位（条目 2/7/8 位置已迁移，见下文各条目内标注）。
- **条目 5/6（CSP SHA-256 hash）：已被有意回退**——v1.1.2 PHASE 71 将 stats.html 与 chess.html 的 `script-src` 从固定 SHA-256 hash 回退为 `'unsafe-inline'`（hash 方案对内联脚本单行变更即失效，维护成本高于收益；stats.html:34 与 build-chess.py:122-127 均有记录，build-chess.py 的 hash 自更新块已于 round-13 移除）。当前 CSP 实况见下。

### 当前 CSP 实况（round-42 核实）

- `index.html.tpl:38`（→ chess.html）：`default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; worker-src blob:; connect-src https://tablebase.lichess.ovh; img-src data: file: blob:; base-uri 'self'; form-action 'none'; object-src 'none'`。
- `stats.html:42`：`default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data:; worker-src blob:; connect-src 'none'; base-uri 'self'`。
- 纵深：`form-action 'none'` / `object-src 'none'`（v1.2.1 round-9 加固）、`connect-src` 白名单仅 tablebase 域名（chess.html）/ `'none'`（stats.html）、`base-uri 'self'`；应用层另有 `_esc`/`_enc` 输出转义（见补录表）。

---

## 修复概览（2026-07-06 原始记录）

本次更新修复了 SonarCloud 扫描识别的 8 个 Security Hotspots 中的 6 个（剩余 2 个评估为误报，标记为 Won't Fix）。

| # | 文件 | 类型 | 优先级 | 状态 |
|---|------|------|--------|------|
| 1 | `engine_jni.cpp` | `chmod(path, 0744)` → `0700` | **P1** | ✅ 已修复（round-42 复核在位） |
| 2 | `StockfishNative.java` | `chmod 744` → `700` (两处) | **P1** | ✅ 已修复（round-42 复核：已迁移至 `EngineProcessManager.java`，见条目 2） |
| 3 | `chess960.js` | `Math.random()` 安全回退移除 | **P1** | ✅ 已修复（round-36 进一步委托 `secureRandomInt`，见条目 3） |
| 4 | `game-logic.js` | `Math.random()` → `crypto.getRandomValues` | P2 | ✅ 已修复（round-42 复核在位） |
| 5 | `stats.html` | CSP `unsafe-inline` → SHA-256 hash | P2 | ⚠️ 已回退（v1.1.2 PHASE 71 有意回退，见条目 5） |
| 6 | `chess.html` | CSP `unsafe-inline` → SHA-256 hash | P2 | ⚠️ 已回退（同上，见条目 6） |
| 7 | `ui.js` (2处) | `Math.random()` 音频噪声 | Won't Fix | 音频场景，无安全影响（round-42 复核仍在位，ui.js:459/:478） |
| 8 | `StockfishNative.java` | `checkSelfPermission()` | Won't Fix | 有意为之的正确修复（round-42 复核：已迁移，见条目 8） |

---

## 详细变更说明

### 1. `src/main/cpp/engine_jni.cpp` (P1)

**变更**: `chmod(path, 0744)` → `chmod(path, 0700)`

**原因**: `0744` = `rwxr--r--` 授予 "others" 读权限，任何设备上的用户/进程都可以读取 Stockfish 引擎二进制文件，存在信息泄露风险。`0700` = `rwx------` 仅允许文件 owner 访问。

**影响范围**: JNI 层 `nativeChmod()` 函数

**round-42 复核**: 在位（engine_jni.cpp:58 注释明确 0700 = rwx------）。

---

### 2. `src/main/java/com/Regalia/StockfishNative.java` (P1)

**变更**: `Runtime.exec("chmod 744")` → `Runtime.exec("chmod 700")`（两处）

**原因**: 与 engine_jni.cpp 同理。`makeExecutable()` 方法的 Runtime.exec 回退路径同样使用了过宽的权限。

**round-42 复核**: 修复仍然有效，但代码位置已随 v1.2.1 round-4 God Module 拆分迁移——`makeExecutable()` 现位于 `EngineProcessManager.java`（四级回退链：nativeChmod → setExecutable → `/system/bin/chmod 700`（:102）→ `sh -c "chmod 700 ..."`（:123）——行号为 round-44 复核值）。原文行号 L4468/L4476 已失效。

---

### 3. `src/main/assets/chess.src/chess960.js` (P1)

**变更**: `randomSPID()` 函数的 `catch(e){}` 块中，`Math.floor(Math.random() * 960)` → `return 518`

**原因**: `Math.random()` 是伪随机数生成器（PRNG），使用可预测的 LCG 算法。在 Chess960 局面生成中，可预测的随机序列可能让攻击者预判初始位置。新的安全回退返回标准开局 SP-ID 518（RNBQKBNR）。

**round-42 复核**: 在位（chess960.js:194/:200 均 return 518）。round-36 进一步加强：`randomSPID()` 主路径已委托 `secureRandomInt(960)`（crypto.getRandomValues + 拒绝采样消除模偏），PRNG 路径已彻底移除。

---

### 4. `src/main/assets/chess.src/game-logic.js` (P2)

**变更**:
- 新增 `secureRandomInt(max)` 函数（文件开头），使用 `crypto.getRandomValues()` 生成密码学安全随机数
- `topN[Math.floor(Math.random() * topN.length)]` → `topN[secureRandomInt(topN.length)]`

**原因**: 开局书走法选择虽然非安全敏感场景，但替换为 `crypto.getRandomValues` 可消除 SonarCloud 告警，同时避免伪随机数的可预测性。

**round-42 复核**: 在位（game-logic.js:42 `secureRandomInt` 定义，:60 `crypto.getRandomValues`，:3242 调用点——行号为 round-44 复核值）。该函数此后成为全局安全随机源（round-36 chess960 委托、ECO/开局选择复用）。

---

### 5. `src/main/assets/stats.html` (P2) — ⚠️ 已回退（round-42 标注）

**原变更**: CSP `script-src 'unsafe-inline' blob:` → `script-src 'sha256-<hash>' blob:`

**round-42 实况**: v1.1.2 PHASE 71 已**有意回退**为 `script-src 'unsafe-inline' blob:`（stats.html:42，round-44 复核；回退原因与记录见 stats.html:34 注释与 build-chess.py:122-127）。原记录的 hash 值（`I9Xt0poQXytNiqR2LPRf4xmXHl7fLVtmQ4pUhdls6wc=`）与「202810 字符」描述仅适用于 2026-07-06 当时的内联脚本，**已失效，勿据此核对**。当前有效防护见顶部「当前 CSP 实况」与补录表（round-18/23 输出转义、CSP 指令卫生）。

---

### 6. `src/main/assets/chess.html` (P2) — ⚠️ 已回退（round-42 标注）

**原变更**: CSP `script-src 'unsafe-inline' blob:` → `script-src 'sha256-<hash>' blob:`

**round-42 实况**: 与条目 5 同步回退（chess.html 由 build-chess.py 从 index.html.tpl 生成；当前 CSP 见 index.html.tpl:38，含 `form-action 'none'`、`object-src 'none'`、`connect-src` 仅 tablebase 白名单）。原 hash（`NwXAUM7Cuexq21w0HElhrOOYg3domd5DziqJOUahkHs=`）与「1146311 字符」描述**已失效**。

---

## Won't Fix 说明

### `ui.js` 两处 `Math.random()` — 音频噪声生成

- 混响脉冲响应生成 `(Math.random() * 2 - 1) * decay`（当前 ui.js:459）
- 白噪声缓存 `Math.random() * 2 - 1`（当前 ui.js:478）
- **理由**: 随机数仅用于音频波形生成，不涉及任何安全决策。替换为 `crypto.getRandomValues` 会在音频处理循环中造成显著性能损失。
- **round-42 复核**: 两处仍在位，且已有 v1.2.1 round-16 SECURITY-AUDIT 注释在案；原文行号 L574/L586 已漂移。

### `StockfishNative.java` `checkSelfPermission()`

- **理由**: 这是有意为之的正确修复。在 `@JavascriptInterface` 上下文中，`checkSelfPermission()` 比 `checkCallingOrSelfPermission()` 更能准确反映应用自身的权限状态，符合 Android 安全最佳实践。
- **round-42 复核**: 该调用已随 God Module 拆分迁移，现位于 `PermissionHelper.java:94/:98/:138` 与 `FileIoHelper.java:216/:263`（round-44 复核），语义不变；原文位置（StockfishNative L4505）已失效。

---

## 安装方法

将本压缩包中的文件按目录结构复制到项目根目录，覆盖原文件：

```bash
# 在项目根目录解压
unzip -o regalia-security-fixes.zip
```

**注意（round-42 更新）**: `stats.html` 和 `chess.html` 是通过 `build-chess.py` 打包生成的产物。原「打包脚本也使用 hash 白名单 CSP」的注意事项**已失效**——hash 方案已按 v1.1.2 PHASE 71 有意回退（见条目 5/6），build-chess.py 不再维护 CSP hash（其 hash 自更新块已于 round-13 移除）。重新构建 chess.html 不会破坏当前 CSP。

---

## 验证清单（round-42 更新版）

- [x] `engine_jni.cpp` — chmod permission `0744`（在位，0700）
- [x] `StockfishNative.java` — chmod permission `744` 两处（在位，已迁移 `EngineProcessManager.java:102/:123`，0700——round-44 复核行号）
- [x] `chess960.js` — `Math.random()` 安全回退（在位，return 518；round-36 起主路径委托 `secureRandomInt`）
- [x] `game-logic.js` — `Math.random()` 伪随机数（在位，`secureRandomInt` + `crypto.getRandomValues`）
- [ ] ~~`chess.html` — CSP `script-src 'unsafe-inline'`~~（**有意回退**，见条目 6；SonarCloud 该项维持 Won't Fix 口径）
- [ ] ~~`stats.html` — CSP `script-src 'unsafe-inline'`~~（**有意回退**，见条目 5；同上）
