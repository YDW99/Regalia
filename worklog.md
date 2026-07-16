# Regalia v1.2.3 — round-17 工作日志（2026-07-17）

## 任务来源
- 《较高优先级问题汇总.pdf》（SonarCloud 扫描结果，AI 生成，需逐条验证）
- 《God Class 重构成果.md》末尾记录的三项待完成提取任务
- 用户要求：修复后逐文件逐行基于设计意图审查优化（优先级：bug修复 > 健壮性 > 功能完善 > 性能 > 冗余清理 > 简化）

## 关键原则：先验证，后动手
PDF 为 AI 生成（文末自带"无法确保真实准确"声明）。全部 500+ 条声称问题逐一对照
实际源码验证，**大量为误报**：
- S2703（隐式全局变量）：声称 122 处（BLOCKER）→ 实际仅 **1 处真实**
  （_trendH 跨作用域引用）；其余全部为已有 let/const 声明、或 typeof 防护的
  可选外部全局（gameEvent/gameSite）、或 Object.defineProperty 惰性挂载的
  有意全局（ECO_OPENINGS）。用 eslint no-undef 在 bundle 级拼接文件上做了
  严格静态分析佐证。
- S125（注释掉的代码块）：误报，ChessWebViewClient.java 无注释代码。
- S3626（冗余 return）：误报，自动恢复路径的 return 是合法提前退出。
- S7767（|0 取整）：声称含 chess.html 重复计数，源码实际 3 处（chess960.js）。

## 真实 bug 修复
1. **_trendH 潜在 ReferenceError（S2703 唯一真实项）**
   `ui.js _refreshEvalTrendChart()` 引用 `_trendH`——该变量是 `_renderReviewMode()`
   的局部 const，此作用域中为未声明全局；图表容器 clientHeight 为 0 时触发
   ReferenceError。修复：提取共享高度公式为顶层 `_computeTrendChartHeight()`，
   两处调用点共用。
2. **java:S1141 嵌套 try（StockfishNative.java）**
   新增 `sleepGracefully(long)` 辅助方法替换 6 处嵌套 try Thread.sleep 模式；
   心跳 2 处改为辅助方法后检查 `isInterrupted()` 决定 break——语义等价
   （中断标志在辅助方法内已恢复）。

## God Class 重构（round-17，成果.md 待完成项）
1. **HapticManager.java（新文件，459 行，GPL v3）**
   从 StockfishNative.java 提取 ~420 行触觉反馈逻辑（isHapticEnabled /
   performHaptic / performHapticInternal / tryPwleVibrate / fallbackVibrate）。
   六种棋子触觉人格原样保留。StockfishNative 保留 @JavascriptInterface 委托
   包装器，JS API 不变。这是 round-10 被删死代码 HapticHelper 的真正全接线继任。
   StockfishNative.java：4,674 → 4,307 行（-8%）。
2. **ui-gameflow.js（新文件，313 行，GPL v3）**
   新局启动（startGame/_startGameImpl）+ 棋钟子系统（initGameClocks /
   _tickGameClock / _onGameClockExpired / recordMoveEnd / formatClock /
   _updateClockDisplay）。
3. **ui-interactions.js（新文件，1,438 行，GPL v3）**
   棋盘点击（sqClick/setupClick/_getCastlingRookForClick）、走子执行与撤销
   （executeMove/_clearAnimationState/undoMove/redoMove）、工具栏动作
   （flipBoard/quickFreeOpening/toggleSound/doPromotion/getHint/
   setDifficultyLevel）、摆棋模式（toggleSetup/exitSetup/_exitSetupImpl/
   undoSetupClick/redoSetupClick）、PGN 保存提示链、返回键路由、导入包装、
   改名/统计导入提示、认输。
   ui.js：8,475 → 6,761 行（-20%）。
   提取方式：带花括号深度跟踪（处理模板字符串/字符串/注释）的程序化提取，
   仅迁移纯函数声明（bundle 内全局提升），无顶层可执行代码移动，无 TDZ/加载
   顺序变化。build-chess.py MODULES 加入两个新模块（位于 ui.js 之前）。

## SonarCloud 代码质量修复（全部验证语义等价）
- **S7773（99 处）**：isNaN/parseInt/isFinite → Number.*，横跨 ai-bridge.js、
  game-logic.js、pgn-standard.js、tablebase.js、ui.js、stats.html。每个调用点
  逐一验证参数为 number 类型（不依赖全局函数的字符串强转）。
- **S7740（9 处）**：ui.js ChessAudioEngine `const self = this` → 箭头函数。
- **S1181（Java）**：ChessWebViewClient 6 处 catch (Throwable) → catch (Exception)
  + destroyWebViewSafely() DRY 提取。HapticManager 反射路径（tryPwleVibrate /
  fallbackVibrate）**有意保留** catch (Throwable) 并附注释（OEM ROM 上反射可能
  抛 NoSuchMethodError——属 Error 非 Exception，必须容忍）。
- **S7761（2 处）**：setAttribute('data-theme') → dataset（ai-bridge.js、stats.html）。
- **S7767（3 处）**：chess960.js `|0` → Math.trunc（spid∈[0,959] 等价）。
- **S7781（3 处转换 + 1 类保留）**：i18n 占位符替换 → replaceAll；stats.html
  printf 式顺序 %d 替换链**必须保留** .replace（replaceAll 会破坏功能）。
- **S8786（2 处）**：worker-pool.js 走法序号正则 `/\d+\.+(\d+\.+)*/g` → `/\d+\.+/g`
  （worker 模板字符串端 + sync 端两份拷贝）；含后续 \s+ 归一化的完整流水线在
  7 组输入（含对抗性）上验证等价。
- **S7741（9 处转换 + 跨模块守卫保留）**：typeof undefined → !== undefined 仅限
  同模块已声明变量；跨模块 typeof 守卫保留（round-11 容错设计），外部注入全局
  （AndroidBridge/gameEvent/gameSite）守卫保留。

## 健壮性加固
- StockfishNative.postJsCallback 新增 null/空白 JS 表达式前置拒绝
  （开发指南 §5.1 方向 1——空载荷此前静默求值为 no-op try{}catch，掩盖调用方 bug）。

## 构建验证
- ✅ 全部 11 个 JS 模块通过 `node --check`（含 2 个新模块）
- ✅ Bundle 级 eslint no-undef 分析：0 个隐式全局（仅剩 3 个有意模式：
  ECO_OPENINGS 惰性挂载、gameEvent/gameSite typeof 防护）
- ✅ Node vm 浏览器桩运行时烟雾测试：加载期零 TDZ 错误（_KING_PIECE_STYLE
  警告为 round-11 起即有的有意防御模式），34/34 关键函数存在，formatClock 正确
- ✅ chess.html 已重建（22,204 行 / 1,334,211 字节，含新模块结构）
- ✅ release APK 已重建：v1+v2+v3 签名齐全，versionCode=123 versionName=1.2.3，
  minSdk 23 / target 35，FGS subtype 属性存在，兼容小米澎湃 OS 3
- ✅ Stockfish dotprod 引擎 SHA-256 三方一致
  （8f7116d3f1a7004a6581d4fb0c1ff891ce095bab6d45e52f1578897cf23b61b5）
- ✅ APK 内含 HapticManager 编译产物（字符串字面量验证）、CMake 源码构建的
  libengine_bridge.so（5,096 字节）、NDK 自动打包的 libc++_shared.so

## 文档更新
- README.license ×3（java/com/Regalia、assets、chess.src）新增 round-17 条目（置顶）
- NOTICE 新增 round-17 许可分类条目（含 HapticManager/ui-gameflow/ui-interactions
  新文件的 GPL v3 归类说明）
- BUILDING.md：模块清单 9→11、CMake 3.22.1→3.31.6
- PRIVACY.md：新增 round-17 纯代码组织变更声明（无新权限/网络/数据收集）
- README.md：新增 round-17 小节
- Manual/Regalia-v1.2.3-manual-zh.html、-en.html：更新日志新增 round-17 条目（置顶，新→旧）

## 环境说明
本次构建环境为沙箱适配：以 /home/kimi/my-project 替代 /home/z/my-project
（沙箱无 /home/z 写权限），目录结构、工具链版本（Temurin JDK 21.0.11、SDK API 35、
Build-Tools 34.0.0、NDK 27.2.12479018、CMake 3.31.6、Gradle 8.11.1 wrapper）与
BUILDING.md 完全一致。GitHub 不可达，JDK 走清华 tuna 镜像、Stockfish 走 gh-proxy
镜像，SDK/CMake/NDK 走 dl.google.com 官方源，Maven 依赖走 settings.gradle 已配置的
阿里云镜像。
