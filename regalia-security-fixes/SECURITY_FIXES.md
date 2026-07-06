# Regalia Security Fixes — SonarCloud Hotspot 修复

**关联 Issue**: [#34 [Security] SonarCloud 8个Security Hotspots修复建议](https://github.com/YDW99/Regalia/issues/34)

**修复日期**: 2026-07-06

---

## 修复概览

本次更新修复了 SonarCloud 扫描识别的 8 个 Security Hotspots 中的 6 个（剩余 2 个评估为误报，标记为 Won't Fix）。

| # | 文件 | 类型 | 优先级 | 状态 |
|---|------|------|--------|------|
| 1 | `engine_jni.cpp` | `chmod(path, 0744)` → `0700` | **P1** | ✅ 已修复 |
| 2 | `StockfishNative.java` | `chmod 744` → `700` (两处) | **P1** | ✅ 已修复 |
| 3 | `chess960.js` | `Math.random()` 安全回退移除 | **P1** | ✅ 已修复 |
| 4 | `game-logic.js` | `Math.random()` → `crypto.getRandomValues` | P2 | ✅ 已修复 |
| 5 | `stats.html` | CSP `unsafe-inline` → SHA-256 hash | P2 | ✅ 已修复 |
| 6 | `chess.html` | CSP `unsafe-inline` → SHA-256 hash | P2 | ✅ 已修复 |
| 7 | `ui.js` (2处) | `Math.random()` 音频噪声 | Won't Fix | 音频场景，无安全影响 |
| 8 | `StockfishNative.java` | `checkSelfPermission()` | Won't Fix | 有意为之的正确修复 |

---

## 详细变更说明

### 1. `src/main/cpp/engine_jni.cpp` (P1)

**变更**: `chmod(path, 0744)` → `chmod(path, 0700)`

**原因**: `0744` = `rwxr--r--` 授予 "others" 读权限，任何设备上的用户/进程都可以读取 Stockfish 引擎二进制文件，存在信息泄露风险。`0700` = `rwx------` 仅允许文件 owner 访问。

**影响范围**: JNI 层 `nativeChmod()` 函数

---

### 2. `src/main/java/com/Regalia/StockfishNative.java` (P1)

**变更**: `Runtime.exec("chmod 744")` → `Runtime.exec("chmod 700")`（两处）

**位置**:
- L4468: `new String[]{"/system/bin/chmod", "700", file.getAbsolutePath()}`
- L4476: `"chmod 700 " + file.getAbsolutePath()`

**原因**: 与 engine_jni.cpp 同理。`makeExecutable()` 方法的 Runtime.exec 回退路径同样使用了过宽的权限。

---

### 3. `src/main/assets/chess.src/chess960.js` (P1)

**变更**: `randomSPID()` 函数的 `catch(e){}` 块中，`Math.floor(Math.random() * 960)` → `return 518`

**原因**: `Math.random()` 是伪随机数生成器（PRNG），使用可预测的 LCG 算法。在 Chess960 局面生成中，可预测的随机序列可能让攻击者预判初始位置。新的安全回退返回标准开局 SP-ID 518（RNBQKBNR）。

---

### 4. `src/main/assets/chess.src/game-logic.js` (P2)

**变更**:
- 新增 `secureRandomInt(max)` 函数（文件开头），使用 `crypto.getRandomValues()` 生成密码学安全随机数
- `topN[Math.floor(Math.random() * topN.length)]` → `topN[secureRandomInt(topN.length)]`

**原因**: 开局书走法选择虽然非安全敏感场景，但替换为 `crypto.getRandomValues` 可消除 SonarCloud 告警，同时避免伪随机数的可预测性。

---

### 5. `src/main/assets/stats.html` (P2)

**变更**: CSP `script-src 'unsafe-inline' blob:` → `script-src 'sha256-<hash>' blob:`

**技术细节**: 提取 stats.html 中唯一的内联脚本（202810 字符），计算其 SHA-256 hash (`I9Xt0poQXytNiqR2LPRf4xmXHl7fLVtmQ4pUhdls6wc=`)，写入 CSP 白名单。`blob:` 保留用于 Web Worker。

---

### 6. `src/main/assets/chess.html` (P2)

**变更**: CSP `script-src 'unsafe-inline' blob:` → `script-src 'sha256-<hash>' blob:`

**技术细节**: 提取 chess.html 中唯一的内联脚本（1146311 字符），计算其 SHA-256 hash (`NwXAUM7Cuexq21w0HElhrOOYg3domd5DziqJOUahkHs=`)，写入 CSP 白名单。

---

## Won't Fix 说明

### `ui.js` 两处 `Math.random()` — 音频噪声生成

- **L574**: 混响脉冲响应生成 `(Math.random() * 2 - 1) * decay`
- **L586**: 白噪声缓存 `Math.random() * 2 - 1`
- **理由**: 随机数仅用于音频波形生成，不涉及任何安全决策。替换为 `crypto.getRandomValues` 会在音频处理循环中造成显著性能损失。

### `StockfishNative.java` `checkSelfPermission()`

- **L4505**: `context.checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE)`
- **理由**: 这是有意为之的正确修复。在 `@JavascriptInterface` 上下文中，`checkSelfPermission()` 比 `checkCallingOrSelfPermission()` 更能准确反映应用自身的权限状态，符合 Android 安全最佳实践。

---

## 安装方法

将本压缩包中的文件按目录结构复制到项目根目录，覆盖原文件：

```bash
# 在项目根目录解压
unzip -o regalia-security-fixes.zip
```

**注意**: `stats.html` 和 `chess.html` 是通过 `build-chess.py` 打包生成的产物。下次运行 `build-chess.py` 时，需要确保打包脚本也使用 hash 白名单 CSP，否则修改会被覆盖。

---

## 验证清单

覆盖文件后，在 SonarCloud 中确认以下告警消失：

- [ ] `engine_jni.cpp` — chmod permission `0744`
- [ ] `StockfishNative.java` — chmod permission `744` (两处)
- [ ] `chess960.js` — `Math.random()` 安全回退
- [ ] `game-logic.js` — `Math.random()` 伪随机数
- [ ] `chess.html` — CSP `script-src 'unsafe-inline'`
- [ ] `stats.html` — CSP `script-src 'unsafe-inline'`
