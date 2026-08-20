<div align="center"> <img alt="LOGO" src="./app/src-tauri/icons/icon.png" width="256" height="256" />

# Miaomoo Lite

轻量化的桌面笔记app，支持Windows/macOS/Linux/Web

⚠️警告：项目仍然处于初级阶段，暂不可投入生产环境，使用前请悉知此说明。



</div>

## 产品特性

- 基于 Milkdown，所见即所得
  - 块级拖拽排序、拖拽插入位置指示
  - 表格增强：列宽拖拽、行/列增删、单元格对齐、工具条跟随表格
  - 图片本地上传与注释、链接标题、代码块语言选择器
  - 原生 emoji 输入（`:smile:` 自动转换，无外部 CDN 依赖）
- Tauri2，多平台适配
  - Windows（.msi/.exe）、macOS（.dmg，arm64/x86_64）、Linux（.deb/.AppImage/.rpm）
  - Web 版功能对齐，配置文件导入导出实现多端同步
- 轻量级编辑器
  - 大纲导航（点击跳转并居中）、实时统计
  - 打字机模式（固定行位置 50%–80% 可调）
  - 主题、字体、行宽、首行缩进等编辑偏好
  - 自定义快捷键（15 项格式操作，录制式绑定）
  - 导出 Markdown / HTML / PNG / DOCX / EPUB / PDF（Typst）

## 安装

从 [Releases](https://github.com/JayeGT002/Miaomoo-Lite/releases) 下载对应平台安装包。

| 平台 | 文件 |
| --- | --- |
| Windows | `.msi` / `.exe` |
| macOS (Apple Silicon) | `aarch64.dmg` |
| macOS (Intel) | `x64.dmg` |
| Linux | `.deb` / `.AppImage` / `.rpm` |

> macOS 未签名，首次打开请右键选择「打开」；Windows 未签名，SmartScreen 提示时选择「仍要运行」。

## 开发

环境要求：Node.js 22+、Rust stable（含各平台 Tauri 依赖）。

```bash
cd app
npm install
npm run tauri dev    # 桌面端开发调试
npm run dev          # 纯 Web 开发调试
npm run tauri build  # 打包桌面端
```

## 使用的开源项目

- [Tauri](https://github.com/tauri-apps/tauri) — 跨平台桌面框架
- [Milkdown](https://github.com/Milkdown/milkdown) / ProseMirror — 所见即所得 Markdown 编辑器
- [React](https://github.com/facebook/react) / [Vite](https://github.com/vitejs/vite) / [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) — 前端
- [IconPark](https://github.com/bytedance/iconpark) — 图标
- [Typst](https://github.com/typst/typst) — PDF 排版（sidecar）
- [html2canvas-pro](https://github.com/yorickshan/html2canvas-pro) — PNG 导出
- [sugar-high](https://github.com/huozhi/sugar-high) — 代码高亮
- [fflate](https://github.com/101arrowz/fflate) — EPUB 打包

## 致谢

- 特别感谢 @流绪绪绪 的猫，他作为Miaomoo Lite的app icon

## 开源许可

本项目遵循MIT license
