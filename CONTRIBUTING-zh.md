# 贡献指南 Contributing Guide

> 感谢您对 Regalia 的兴趣！无论您是修复 Bug、添加新功能，还是改进文档，您的贡献都将帮助全球数万名国际象棋爱好者获得更好的对弈体验。

---

## 📋 目录

- [行为准则](#-行为准则)
- [如何报告 Bug](#-如何报告-bug)
- [如何提交功能请求](#-如何提交功能请求)
- [如何提交 Pull Request](#-如何提交-pull-request)
- [开发环境搭建](#-开发环境搭建)
- [代码风格指南](#-代码风格指南)
- [License 合规](#-license-合规)
- [测试要求](#-测试要求)
- [版本号规则](#-版本号规则)
- [联系我们](#-联系我们)

---

## 🤝 行为准则

参与 Regalia 项目，即表示您同意：

- 以尊重、友善的态度对待每一位贡献者
- 欢迎初学者，耐心回答问题
- 接受建设性的批评意见
- 关注对社区最有利的事情
- 本项目主要开发者为非专业程序员（AI 辅助开发），请保持包容和理解

---

## 🐛 如何报告 Bug

### 使用 Issue 模板（推荐）

1. 前往 [Issues 页面](https://github.com/YDW99/Regalia/issues/new/choose)
2. 选择 **"Bug 报告"** 模板
3. 尽可能详细地填写表单

### 在报告之前

- 请先在现有 Issue 中搜索，确认该 Bug 未被报告过
- 确认您使用的是[最新版本](https://github.com/YDW99/Regalia/releases)
- 尝试清除 App 数据后复现问题

### 一份好的 Bug 报告应包含

| 项目 | 说明 |
|------|------|
| 清晰标题 | 一句话概括问题，如 "引擎在特定 FEN 下崩溃" |
| 复现步骤 | 编号列出从打开 App 到触发 Bug 的每一步操作 |
| 期望行为 | 您期望发生什么 |
| 实际行为 | 实际发生了什么（含错误信息） |
| 设备信息 | Android 版本、设备型号、ROM 类型 |
| App 版本 | ℹ️ → 关于 中显示的版本号 |
| PGN/FEN | 如涉及棋局问题，请附上 PGN 或 FEN 字符串 |
| 截图/录屏 | 视觉问题强烈建议附上 |

### 安全漏洞

如发现安全漏洞，**请勿**公开提交 Issue。请发送邮件至开发者（见 GitHub 个人资料）进行私下报告。

---

## 💡 如何提交功能请求

### 使用 Issue 模板（推荐）

1. 前往 [Issues 页面](https://github.com/YDW99/Regalia/issues/new/choose)
2. 选择 **"功能请求"** 模板
3. 详细描述您的想法

### 功能请求原则

- 描述您想解决什么问题，而不仅仅是"添加某个功能"
- 说明目标用户群体和使用场景
- 如果可能，提供用户界面草图或交互流程
- 标明您认为合理的优先级

---

## 🔀 如何提交 Pull Request

### 工作流程

```
1. Fork 仓库 → 2. 创建分支 → 3. 开发 → 4. 测试 → 5. 提交 PR → 6. Code Review → 7. 合并
```

### 1. Fork 与克隆

```bash
# Fork 本仓库到您的 GitHub 账号，然后克隆

git clone https://github.com/YOUR_USERNAME/Regalia.git
cd Regalia
```

### 2. 分支策略

| 分支 | 用途 | 说明 |
|------|------|------|
| `main` | 稳定分支 | 仅通过 PR 合并，直接推送禁止 |
| `dev` | 开发分支 | 功能开发的集成分支 |
| `feature/*` | 功能分支 | 从 `dev` 切出，如 `feature/pgn-import` |
| `fix/*` | 修复分支 | 从 `dev` 切出，如 `fix/engine-crash` |
| `hotfix/*` | 紧急修复 | 从 `main` 切出，用于紧急修复 |

```bash
# 创建功能分支示例
git checkout dev
git pull origin dev
git checkout -b feature/your-feature-name
```

### 3. Commit 规范

我们采用 **Conventional Commits** 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type（必填）

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新（README、手册等） |
| `style` | 代码格式调整（不影响功能） |
| `refactor` | 代码重构 |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `build` | 构建系统相关（Gradle、CMake 等） |
| `chore` | 其他杂项（依赖更新、配置调整等） |
| `i18n` | 国际化/本地化相关 |

#### Scope（可选）

- `engine` — 引擎（Stockfish、JNI 层）
- `ui` — 用户界面（WebView、JavaScript 前端）
- `android` — Android 原生层（Java/Kotlin）
- `docs` — 文档
- `build` — 构建系统

#### 示例

```
feat(engine): 添加 UCI_AnalyseMode 支持

在设置中新增"分析模式"选项，允许引擎以更高深度分析局面。
不影响正常对弈模式的性能。

fix(ui): 修复暗黑主题下坐标文字不可见的问题

坐标颜色未适配暗黑主题色板，现已调整。

refactor(android): 将 BoardActivity 拆分为多个 Fragment

提高代码可维护性，为后续平板布局做准备。
```

### 4. PR 提交前检查清单

- [ ] 代码符合项目代码风格（见 [代码风格指南](#-代码风格指南)）
- [ ] 所有变更在物理 Android 设备上经过测试（见 [测试要求](#-测试要求)）
- [ ] Commit 历史清晰，遵循 Commit 规范
- [ ] 分支已同步最新 `dev` 分支（`git rebase dev`）
- [ ] 无硬编码密钥、密码等敏感信息
- [ ] 新增第三方库已在 NOTICE 文件中声明
- [ ] 我理解并同意本项目的 AGPL v3 + GPL v3 双许可

### 5. PR 审查流程

- 维护者会在 **7 个工作日** 内回应您的 PR
- PR 需要至少 **1 位维护者** 的批准才能合并
- 根据反馈修改后，请保持耐心，维护者会再次审查
- 大型变更可能需要更长的审查时间

---

## 🛠️ 开发环境搭建

### 基本要求

| 项目 | 版本/说明 |
|------|----------|
| Android Studio | 最新稳定版 |
| JDK | 17+ |
| Android SDK | API 24+ (Android 7.0) |
| NDK | r25b+（用于 Stockfish 编译） |
| CMake | 3.22+ |
| Git | 2.30+ |
| 物理设备 | **必需**（见 [测试要求](#-测试要求)） |

### 快速开始

详细构建步骤请参阅 [**BUILDING.md**](BUILDING.md)，以下为要点摘要：

```bash
# 1. 克隆仓库
git clone https://github.com/YDW99/Regalia.git
cd Regalia

# 2. 使用 Android Studio 打开项目
#    File → Open → 选择 Regalia 目录

# 3. 等待 Gradle 同步完成
#    如遇到问题，检查 local.properties 中的 SDK/NDK 路径

# 4. 构建 Stockfish 引擎
#    详细步骤见 BUILDING.md「引擎编译」章节

# 5. 连接物理设备，点击 Run
```

### 常见问题

| 问题 | 解决方案 |
|------|---------|
| NDK 路径未找到 | 在 `local.properties` 中添加 `ndk.dir=/path/to/ndk` |
| Stockfish 编译失败 | 确保 NDK 版本 >= r25b，并安装 CMake 3.22+ |
| WebView 白屏 | 检查 assets 目录中的前端文件是否正确包含 |
| Gradle 同步超时 | 切换为国内镜像源，或启用代理 |

---

## 📝 代码风格指南

### Java（Android 层）

我们遵循 [Google Java Style Guide](https://google.github.io/styleguide/javaguide.html) 的主要原则：

```java
// ✅ 正确示例
public class ChessEngine {
    private static final String TAG = "ChessEngine";
    private final Context context;
    private int searchDepth;

    public ChessEngine(Context context, int depth) {
        this.context = context;
        this.searchDepth = depth;
    }

    /**
     * 启动引擎搜索，返回最佳着法。
     *
     * @param fen 当前局面的 FEN 字符串
     * @param callback 搜索完成后的回调
     */
    public void searchBestMove(String fen, SearchCallback callback) {
        if (fen == null || fen.isEmpty()) {
            throw new IllegalArgumentException("FEN cannot be null or empty");
        }
        // 实现...
    }
}

// ❌ 错误示例
public class chessengine{
private Context ctx;
int search_depth;
public chessengine(Context c, int d){
ctx = c;
search_depth = d;
}
}
```

#### Java 代码规范要点

- **缩进**：4 个空格（不使用 Tab）
- **命名**：类名 PascalCase，方法名/变量名 camelCase，常量 UPPER_SNAKE_CASE
- **行宽**：最大 120 字符
- **括号**：左大括号不换行（K&R 风格）
- **空行**：类/方法之间保留空行，逻辑段之间可加分隔注释
- **注释**：公共 API 必须写 Javadoc，复杂逻辑写行内注释
- **语言**：代码注释使用**英文**，便于国际化贡献者阅读

### JavaScript（WebView 前端）

```javascript
// ✅ 正确示例
/**
 * 更新棋盘显示状态
 * @param {string} fen - FEN 字符串
 * @param {Array} lastMove - 上一步着法 [from, to]
 */
function updateBoard(fen, lastMove) {
    const board = Chessboard('board', {
        position: fen,
        moveSpeed: 200,
        onDrop: handlePieceDrop,
    });

    if (lastMove && lastMove.length === 2) {
        highlightSquare(lastMove[0]);
        highlightSquare(lastMove[1]);
    }

    return board;
}

// 常量使用全大写
const SQUARE_SIZE = 64;
const ANIMATION_DURATION_MS = 200;

// ❌ 错误示例
function update_board(fen,lastmove){
var board=Chessboard('board',{position:fen,moveSpeed:200,onDrop:handlePieceDrop})
if(lastmove){
highlightSquare(lastmove[0]);highlightSquare(lastmove[1])
}return board}
```

#### JavaScript 代码规范要点

- **缩进**：4 个空格
- **引号**：单引号 `'` 为主，HTML 属性使用双引号 `"`
- **分号**：必须显式使用
- **命名**：camelCase，构造函数 PascalCase
- **变量**：优先使用 `const`，需要重新赋值用 `let`，**不使用 `var`**
- **比较**：始终使用 `===` 和 `!==`
- **注释**：函数必须写 JSDoc，复杂算法写说明

### C++（JNI / Stockfish 相关）

遵循 Stockfish 项目自身的代码风格。修改 Stockfish 代码时，请保持与上游一致的风格。

---

## 📜 License 合规

### 双许可说明

Regalia 采用 **AGPL v3 + GPL v3** 双许可：

| 场景 | 适用许可 |
|------|---------|
| 网络服务交互（如在线对弈功能） | AGPL v3 |
| 本地使用、分发 | GPL v3 |

### 贡献者义务

- **提交 PR 即表示**您同意将您的贡献按照 AGPL v3 + GPL v3 许可发布
- 您必须有权授予上述许可（即您提交的内容不侵犯第三方权利）
- 请勿提交从商业闭源软件复制的代码

### 引入新第三方库

如需引入新的第三方库：

1. 确认该库的许可与 AGPL v3 / GPL v3 **兼容**
2. 在 **NOTICE** 文件中添加该库的版权声明
3. 在 PR 描述中说明引入理由和许可信息
4. 不兼容的许可证包括但不限于： proprietary、SSPL、CC-NC 等

### 兼容的许可证（示例）

✅ MIT、BSD-2/3-Clause、Apache-2.0、LGPL-2.1/3.0、GPL-2.0/3.0、AGPL-3.0  
❌ Proprietary、CC-NC-*、SSPL、自定义商业许可

### 版权声明

每个新创建的文件头部请添加：

```java
/*
 * Regalia - Android 国际象棋应用
 * Copyright (C) 2026 D.W. Yang and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
```

---

## 🧪 测试要求

### 必须在物理设备上测试

**模拟器不足以验证以下场景**，请在提交 PR 前在物理 Android 设备上测试：

| 测试项 | 最低要求 |
|--------|---------|
| 引擎加载 | 确认 Stockfish 正常启动，不崩溃 |
| 棋力测试 | 至少完成 3 局完整对弈（不同难度） |
| PGN 导入/导出 | 测试包含注释和变着的 PGN 文件 |
| 主题切换 | 亮色/暗色主题下界面正常 |
| 横竖屏切换 | 对弈过程中旋转屏幕不丢失状态 |
| 后台恢复 | 切换到后台再返回，对弈状态保持 |
| 低内存场景 | 长时间使用（>30 分钟）不崩溃 |

### 推荐测试设备覆盖

- **Android 版本**：至少覆盖 Android 10 和 Android 14
- **架构**：arm64-v8a（Stockfish dotprod 优化依赖）
- **屏幕尺寸**：手机（6" 左右）+ 平板（10" 左右，如有条件）

### 测试报告

在 PR 描述中填写测试设备信息：

```markdown
## 测试设备
- 设备：小米 14
- Android：14 (API 34)
- 架构：arm64-v8a
- ROM：HyperOS 1.0
- 测试结果：全部通过 ✅
```

---

## 🏷️ 版本号规则

Regalia 采用 [语义化版本控制 2.0.0](https://semver.org/lang/zh-CN/)：

```
主版本号.次版本号.修订号（MAJOR.MINOR.PATCH）
```

| 版本位 | 递增条件 | 示例 |
|--------|---------|------|
| MAJOR | 不兼容的 API 变更、重大架构调整 | 1.x.x → 2.0.0 |
| MINOR | 向下兼容的功能新增 | 1.1.x → 1.2.0 |
| PATCH | 向下兼容的 Bug 修复 | 1.1.1 → 1.1.2 |

### 特殊情况

- **预发布版本**：`1.2.0-beta.1`、`1.2.0-rc.1`
- **紧急修复**：如 v1.1.1 出现严重 Bug，快速发布 v1.1.2
- **版本号标签**：GitHub Release 标签格式为 `v1.1.1`（带 `v` 前缀）

### 当前版本

查看最新版本请访问 [Releases 页面](https://github.com/YDW99/Regalia/releases)。

---

## 📬 联系我们

- **Issue 讨论**：https://github.com/YDW99/Regalia/issues
- **GitHub 个人资料**：https://github.com/YDW99

### 其他资源

| 文档 | 说明 |
|------|------|
| [README.md](README.md) | 项目概览与版本历史 |
| [BUILDING.md](BUILDING.md) | 详细构建指南 |
| [PRIVACY.md](PRIVACY.md) | 隐私政策 |
| [UBIQUITOUS_LANGUAGE.md](UBIQUITOUS_LANGUAGE.md) | 领域术语表 |
| [NOTICE](NOTICE) | 第三方组件声明 |
| [Manual/](Manual/) | 中英文用户手册 |

---

> 再次感谢您的贡献！每一行代码、每一个 Bug 报告、每一条建议，都让 Regalia 变得更好。
>
> *— D.W. Yang & Regalia 团队*
