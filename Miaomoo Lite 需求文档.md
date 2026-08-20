# Miaomoo Lite — 项目需求文档

> 面向开发 Agent 的实现文档。UI 原型已完成（React + Vite 工程，本文档随原型代码一起提供），本文档描述**功能与技术要求**，视觉与交互以原型代码为准，不再重复描述像素细节。

## 1. 项目概述

Miaomoo Lite 是一款仿 Bear 的 Markdown 笔记编辑器，所见即所得，单笔记编辑界面。

- **桌面端**：Tauri 2 打包，跨 Windows / macOS / Linux
- **轻量版（Lite Web）**：同一代码库构建的纯前端 SPA，部署到 GitHub Pages，无桌面端能力降级运行

## 2. 技术栈（原则：越轻量越好）

| 层 | 选型 | 说明 |
|---|---|---|
| 前端框架 | React 18 + TypeScript + Vite | 原型已有，勿更换 |
| 样式 | Tailwind CSS | 原型已有；设计令牌走 `data.ts` 的主题对象，勿写死色值 |
| 图标 | `@icon-park/react` | **全项目唯一图标来源**，禁止 emoji 与第三方图标库 |
| 编辑器 | Milkdown（ProseMirror 系），**模块化按需引入** | 禁止 `@milkdown/kit` 整包，模块化按需引入：`@milkdown/core`、`@milkdown/ctx`、`@milkdown/react`、`@milkdown/preset-commonmark`、`@milkdown/preset-gfm`、`plugin-history`、`plugin-listener`、`plugin-clipboard`、`plugin-upload`、`plugin-indent`、`plugin-cursor`、`plugin-emoji`（支持输入）、`plugin-highlight`、`plugin-automd`、`plugin-block`。完整包清单见《Milkdown 独立功能包清单.md》。原型中 `EditorArea` 为占位，需替换 |
| 桌面壳 | Tauri 2 | Rust 侧只保留最小程序，能力按需开权限 |
| 状态 | React `useState` 单页内聚 | 不引入 Redux/Zustand，规模不需要 |
| 持久化 | 桌面端：Tauri fs 插件写本地文件；Web 版：`localStorage` + 手动导出 | 见 §7 |
| 导出 | 见 §6，优先零依赖/轻依赖方案 | 禁止引入大型渲染引擎 |

禁止事项：`npx shadcn add` 类脚手架改动、Electron、`@milkdown/kit` 整包引入、任何 UI 组件库重写原型已有组件。

## 3. 功能需求

### 3.1 标题栏（顶部）

从左到右：

1. **标题**：只读文本，映射当前笔记第一个一级标题（无 H1 时显示「无标题」）
2. **保存状态**：`已保存`（CheckOne 图标，绿色）/ `保存中…`（Loading 旋转）；输入触发防抖 900ms 后回到已保存，同时刷新「编辑日期」
3. **详情面板**（Info 图标）：切换右侧详情栏显隐
4. **导出**（Export 图标）：打开导出弹窗
5. **设置**（Setting 图标）：打开设置弹窗

### 3.2 编辑区

- Milkdown 所见即所得渲染 Markdown；无纸张卡片，内容与背景融合（背景 = 主题 `page` 色）
- 排版参数实时生效：字体、字号、行高、行宽（内容最大宽度）、段落间距、段落缩进（0 / 2 字符）
- **打字机模式**：开启后光标所在行滚动至视口垂直居中（底部需预留约 45vh 空白）
- 输入时实时更新统计数据与保存状态

### 3.3 格式栏（底部悬浮，常显）

浅色圆角条（圆角 8px，柔和阴影，无描边），按钮从左到右：

| 按钮 | 图标 | 行为 |
|---|---|---|
| 标题 | `H` | 弹出菜单：一～五级标题（`H1/H2/H3/LevelFourTitle/LevelFiveTitle`） |
| 加粗 / 斜体 / 下划线 / 删除线 | `TextBold / TextItalic / TextUnderline / Strikethrough` | 行内格式切换 |
| 列表 | `ListTop` | 弹出菜单：无序列表（`ListTop`）、有序列表（`OrderedList`） |
| 图片 | `Pic` | 插入图片（桌面端可选本地文件） |
| 附件 | `Paperclip` | 插入附件 |
| 链接 | `LinkOne` | 插入/编辑链接 |
| 表格 | `InsertTable` | 插入表格 |
| 代码 | `Code` | 弹出菜单：行内代码、代码块（`CodeBrackets`） |
| 分割线 | `DividingLineOne` | 插入 `---` |

菜单点击外部自动收起；按钮 hover 用主题 `hover` 色，菜单项带快捷键提示文案。

### 3.4 详情面板（右侧栏）

无标题栏、无关闭按钮（由标题栏 Info 按钮开关），顶部为「统计 / 大纲」分段切换（大纲页签图标 `MindmapList`）：

- **统计**：字数、字符（不含空白）、阅读时长（按 400 字/分钟）、输入速度（字/分钟）、创建日期、编辑日期
- **大纲**：按层级缩进的标题列表，图标按级别显示：`H1/H2/H3/LevelFourTitle`…`LevelEightTitle`（最高 8 级）；点击滚动定位到对应标题

### 3.5 导出面板（居中弹窗，左预览右设置）

- **文件名**输入框（默认 = 笔记 H1）
- **8 种格式**：PNG / DOCX / PDF / TXT / TextBundle / RTF / HTML / EPUB，各带独立图标
- 左侧实时预览，按格式区分形态（PDF=A4 页面、EPUB=封面+内页、TXT/RTF=纯文本、TextBundle=包结构、HTML=带浏览器框）
- 选项随格式联动：PNG（分辨率 1x/2x/3x、透明背景）、PDF（页面尺寸 A4/A5/Letter、包含目录）、DOCX/RTF（包含目录）、TXT（编码 UTF-8/GBK）、TextBundle（包含附件）、HTML（内嵌样式）、EPUB（作者、生成封面）
- 导出按钮文案 = `导出 {文件名}{扩展名}`

实现建议（轻量优先）：PNG 用 `html-to-image`；PDF 桌面端走 Tauri `webview.print()`，Web 走 `window.print()`；HTML/TXT 直接字符串生成；DOCX/RTF/EPUB 可用轻量库（`docx`、自写 RTF 模板、`epub-gen` 类）或标记为后续迭代，**禁止为导出引入 Puppeteer/wkhtmltopdf**。

### 3.6 设置面板（居中弹窗，左导航右明细）

左侧导航（无「设置」标题文字）：编辑器 / 字体 / 主题 / 关于。选中项 = 主题 `accent` 底 + `accentText` 字。

- **编辑器**：字体大小（14–22px）、行高（1.4–2.2）、行宽（520–860px）、段落间距（0.3–1.6em）、段落缩进（无 / 2 字符）、打字机模式开关
- **字体**：正文字体（4 预设 + 自定义字体名输入，自定义优先）、代码块字体（4 预设 + 自定义），底部实时预览区
- **主题**：三组共 18 个，整组切换**整个 App 外壳 + 编辑区**（非仅编辑区）：
  - 冷色调：素白（**默认**，白+黑）、冰川、薄暮、青瓷、雪青、石蓝
  - 莫兰迪色：米白、雾灰、豆绿、雾蓝、烟粉、深灰
  - 暗色模式：玄黑、墨蓝、暗夜绿、黛紫、炭黑、午夜
- **关于**：应用图标（`public/app-icon.png`）、项目名 **Miaomoo Lite**、诗句文本（见原型 `SettingsPanel.tsx`）、GitHub 与官网链接按钮、`Powered by Noctipastor`

### 3.7 全局视觉规范

- 圆角统一 **8px**（开关等胶囊形除外）；**全局无分割线/描边分隔**，层级靠底色差与阴影表达
- 重点色为每主题的 `accent`（深色系），用于选中态、主按钮、光标色
- 主题令牌结构：`{ page, text, sub, border, appBg, panel, panelText, panelSub, panelBorder, hover, accent, accentText, dark }`，全部色值集中于 `data.ts`，新增主题只加数据不改组件

## 4. 双端架构

```
src/                 # 共享前端（原型代码演进）
src-tauri/           # Tauri 2 壳（桌面端）
```

- 同一份 React 代码，通过 `window.__TAURI_INTERNALS__` 探测运行环境
- 平台能力封装为一个 `platform.ts` 适配层：`saveNote / openFile / exportFile / pickImage` 等，桌面端走 Tauri 插件，Web 版降级为 localStorage + 浏览器下载
- Web 版（GitHub Pages）构建：`vite build` + `base: './'`，hash 路由或单页无路由；CI 用 GitHub Actions 自动发布到 `gh-pages`
- 桌面端构建：`tauri build`，目标 Windows (msi/nsis)、macOS (dmg)、Linux (AppImage/deb)

## 5. 数据与持久化

- 笔记模型：`{ title(=H1), markdown, createdAt, updatedAt, settings }`
- 设置模型即原型 `EditorSettings`（含 `fontId/customFont/codeFontId/customCodeFont/fontSize/lineHeight/lineWidth/paragraphSpacing/paragraphIndent/typewriter/themeId`）
- 桌面端：笔记存为 `.md` 文件，设置存应用配置目录 JSON
- Web 版：全部存 `localStorage`，页面需明确提示数据仅存于当前浏览器

## 6. 导出能力矩阵

| 格式 | 桌面端 | Web 版 |
|---|---|---|
| HTML / TXT | ✅ 文件保存对话框 | ✅ 浏览器下载 |
| PNG | ✅ | ✅ |
| PDF | ✅ webview 打印 | ✅ window.print |
| DOCX / RTF / EPUB / TextBundle | ✅ | ✅（纯 JS 生成） |

## 7. 非功能需求

- 冷启动 < 2s（桌面端），Web 首屏 JS gzip < 500KB
- 无遥测、无网络依赖（字体仅本机字体栈，不加载 WebFont）
- 全部文案中文；快捷键提示按 macOS 风格展示（⌘⇧）
- 打包产物：Web 版单目录静态文件；桌面端单安装包 < 20MB

## 8. 里程碑建议

1. M1：原型代码接入 Milkdown，编辑/统计/保存闭环（Web 版先行）
2. M2：导出 8 格式 + GitHub Actions 发布 gh-pages
3. M3：Tauri 2 壳 + platform 适配层 + 三平台打包
