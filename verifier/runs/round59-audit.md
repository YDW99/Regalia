# round-59 验证轨迹（append-only）

## 2026-10-07T01:30Z — 谐振仿真改造与验证
- 改动: game-logic.js（_ringKfs 阻尼谐振生成器 + 六种签名余震尾模型化）、ui-interactions.js（过时注释修正）。
- 模型交叉验证（Python 复刻 _ringKfs 算法）: 六种签名 offset 严格单调递增、全部落在 [0,1]、峰值序列符合指数衰减预期
  （王: -5.5/+3.47/-2.19/+1.38/-0.87/+0.55/-0.34；后: 6/-3.64/2.21/-1.34/0.81/-0.49/0.3/-0.18；车: 6.2/-2.69/1.17/-0.51/0.22/-0.1；
  马: 3.2/-1.94/1.18/-0.71/0.43；象: 2.7/-1.28/0.6/-0.28/0.13；兵: 1.3/-0.87/0.58/-0.38/0.25/-0.17/0.11）——通过。
- node --check ×10 JS 模块: 全过（exit 0）。
- verifier 三件套: v1 29/29、v2 19/19、v3 37/37 全绿。
- chess.html 重打包: 24,159 行 / 1,485,430 字节（build-chess.py），含 9 处 _ringKfs 引用。

## 2026-10-07T01:50Z — 中文说明书拼接损坏发现与修复（round-58c 存量缺陷）
- 发现: edit_file 报"not a text file"→ 检出 Manual/Regalia-v1.2.3-manual-zh.html 非法 UTF-8（byte 278526 处 splice 残留）、
  附录 A 整块重复（id="appendix-changelog" ×2）、div 559/563 失衡、正文 90824 字符处与 58b 备份分叉。英文版健康。
- 对照: 58b 备份严格 UTF-8、单附录、div 365/365 —— 判定为 round-58c 文档期引入的存量缺陷。
- 处置: 从 58b 备份重建 + 精确重放 58c 修订（导语行 + 58c 段，段文本取自损坏文件中两份逐字节一致的完整副本）+ 叠加 59 修订。
- 修复后复核: 严格 UTF-8 OK（1,147,386 字节）、appendix anchor ×1、div 365/365、intro59 ×1、59/58c/58b 段各 ×1。

## 2026-10-07T01:40Z — 构建交付验收
- 构建: gradle assembleRelease --offline exit=0 (BUILD SUCCESSFUL in 2m 17s)。前置修复: NDK build/cmake 目录缺失 android.toolchain.cmake（ndk 根下 cmake/ 有完整工具链文件，拷贝补齐——round-52 同类修复的持久化失效，本轮重建）。
- 签名: apksigner verify → v1/v2/v3=true, cert SHA-256=45bc6d36...d8bc ✓
- 版本: aapt2 → versionCode=10203 versionName=1.2.3 ✓
- bundle: sha256(APK内chess.html)=sha256(src bundle)=3eebe158...47a5（24,159 行 / 1,485,430 字节）✓
- 引擎: sha256(libstockfish.so)=8f7116d3...61b5 钉死值 ✓
- tar: 排除清单 grep 命中数=0；tar 内 chess.html 哈希与源码一致 ✓
- 交付: /mnt/agents/output/Regalia-v1.2.3-round59-release.apk (78,306,694B) + Regalia-v1.2.3-round59-源代码备份.tar.gz (5,502,127B)
