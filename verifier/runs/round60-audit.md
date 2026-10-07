# round-60 验证轨迹（append-only）

## 2026-10-07T02:20Z — 任务输入
- 主需求：王走动震屏幅度增大。
- 副需求：消化 round-59 全量逐行审查报告（排查误报→理解不足→步骤分明的完善方案→彻底实施）。

## 误报排查结论
报告第 5 章负空间记录已自行完成证伪（N-1 键类型、N-2 缓存跨局、N-3 悔棋前缀、N-4 SPID 构造、N-5 重派过验、N-10 手册锚点——复核认可全部证伪过程）。采纳修复：F-1（TDZ 死代码，已复现 v1 告警 "Cannot access '_KING_PIECE_STYLE' before initialization"——确认真实）、F-2（指南 §1"无网络权限"与 Manifest INTERNET 矛盾——确认真实）、F-3（当前调用图不可达，按报告建议文档化）、F-4（fr/ja/ru locale 回退不一致——确认真实，一行统一为 !startsWith("zh")→en）、F-5（注释机制失真——确认真实，防御代码保留、注释修正）。

## 2026-10-07T02:40Z — 实施记录
- 王震屏幅度：起振首峰 -5.5→-7px（y(τ)=-7·e^(−6τ)·cos(13πτ)；Python 复算峰值 -7/+4.42/-2.79/+1.76/-1.11/+0.70/-0.44/+0.28/-0.17/+0.11；频率 6.5Hz 与 680ms 时长不变）。超越后 6px 地面砸击，王者签名振幅重回首位。
- F-1 根治（方案 a）：_KING_PIECE_STYLE 从 ui.js 上移至 game-logic.js 共享常量区（首模块，任何顶层调用前完成初始化）+ 加入 export 列表；ai-bridge.js 删除 try/typeof 死代码分支，直接用共享常量；ui.js 留指引注释。修复后 v1 输出 TDZ 告警消失（"warns seen: 4" 为其余既有调试 warn，非 TDZ 类）。
- F-2：指南 §1 隐私行改为"离线优先：除可选的 Lichess 残局库查询…外无任何网络出口"。
- F-3：EngineService.start() 早退处补窗口文档化注释（不可达性 + onEngineReady 自愈路径 + 未来改动触发条件）。
- F-4：MainActivity.showToastLocalized 回退语义统一为 !startsWith("zh")→en（zh/en 用户行为不变）。
- F-5：ai-bridge.js _evictIfOverCap 注释修正为数组对格式保型 + String() 比较系防未来格式漂移的防御。
- 验证器扩展：V1-30（consoleProxy 捕获 warn，TDZ 告警即失败）、V2-20（_KING_PIECE_STYLE 位置三断言）、V3-38（指南隐私行准确性，指南缺席时跳过）。
- 方法论闭环：Regalia-bug-hunting-methodology.md 落盘源码树根目录；指南 §5 标记完成、§5.5 三项打勾。

## 事故记录（编辑工具竞态复发）
- ai-bridge.js 编辑曾引入 4,257 行意外 diff（edit_file 工具异常），用 58b 教训的既定流程处置：round-59 tar 提取干净副本还原 → Python 脚本带 count==1 断言重打两处补丁 → diff 复核仅剩 F-1/F-5 两组有意改动（27 行）→ node --check 通过。
- 教训重申：edit_file 对 5,000+ 行文件不可靠；大文件改动一律走"还原→断言脚本→diff 复核"三段式。

## 2026-10-07T02:55Z — 验证结果
- node --check ×10 JS 模块: 全过。
- verifier 三件套新基线: v1 30/30、v2 20/20、v3 38/38 全绿（V1-30/V2-20/V3-38 三个新哨兵全部生效并 PASS）。
