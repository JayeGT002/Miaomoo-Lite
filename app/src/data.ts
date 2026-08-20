// Miaomoo Lite 设计令牌与数据：主题、字体、设置模型
// 全部色值集中于此，新增主题只加数据不改组件

export interface ThemeTokens {
  page: string
  text: string
  sub: string
  border: string
  appBg: string
  panel: string
  panelText: string
  panelSub: string
  panelBorder: string
  hover: string
  accent: string
  accentText: string
  dark: boolean
}

export interface Theme {
  id: string
  name: string
  group: '冷色调' | '莫兰迪色' | '暗色模式'
  tokens: ThemeTokens
}

export const THEMES: Theme[] = [
  // ── 冷色调 ──
  {
    id: 'su-white', name: '素白', group: '冷色调',
    tokens: { page: '#FFFFFF', text: '#1D1D1F', sub: '#86868B', border: '#E8E8E6', appBg: '#F6F6F4', panel: '#FFFFFF', panelText: '#1D1D1F', panelSub: '#86868B', panelBorder: '#EBEBE9', hover: '#F0F0EE', accent: '#26262A', accentText: '#FFFFFF', dark: false },
  },
  {
    id: 'glacier', name: '冰川', group: '冷色调',
    tokens: { page: '#F3F8FB', text: '#243440', sub: '#7A93A3', border: '#DCE7ED', appBg: '#E8F0F5', panel: '#FBFDFE', panelText: '#243440', panelSub: '#7A93A3', panelBorder: '#DEE9EF', hover: '#E3EDF3', accent: '#3E7CA6', accentText: '#FFFFFF', dark: false },
  },
  {
    id: 'dusk', name: '薄暮', group: '冷色调',
    tokens: { page: '#F8F5FA', text: '#332B3D', sub: '#8E8299', border: '#E6DEEA', appBg: '#F0EAF4', panel: '#FDFCFE', panelText: '#332B3D', panelSub: '#8E8299', panelBorder: '#E8E0EC', hover: '#F0EAF5', accent: '#7A5E8F', accentText: '#FFFFFF', dark: false },
  },
  {
    id: 'celadon', name: '青瓷', group: '冷色调',
    tokens: { page: '#F2F8F5', text: '#223830', sub: '#75948A', border: '#DCEAE3', appBg: '#E8F1EC', panel: '#FBFEFC', panelText: '#223830', panelSub: '#75948A', panelBorder: '#DEECE5', hover: '#E4F0EA', accent: '#4E8071', accentText: '#FFFFFF', dark: false },
  },
  {
    id: 'lilac', name: '雪青', group: '冷色调',
    tokens: { page: '#F7F5F9', text: '#2F2A3B', sub: '#8B84A0', border: '#E5E1EB', appBg: '#EFECF3', panel: '#FCFBFD', panelText: '#2F2A3B', panelSub: '#8B84A0', panelBorder: '#E7E3ED', hover: '#F0ECF5', accent: '#6E63A8', accentText: '#FFFFFF', dark: false },
  },
  {
    id: 'stone-blue', name: '石蓝', group: '冷色调',
    tokens: { page: '#F1F4F8', text: '#232D3B', sub: '#74849A', border: '#DDE4EC', appBg: '#E7EBF1', panel: '#FBFCFE', panelText: '#232D3B', panelSub: '#74849A', panelBorder: '#DFE6EE', hover: '#E6EBF2', accent: '#3C5A87', accentText: '#FFFFFF', dark: false },
  },
  // ── 莫兰迪色 ──
  {
    id: 'cream', name: '米白', group: '莫兰迪色',
    tokens: { page: '#FBF8F1', text: '#3B362D', sub: '#948D7E', border: '#EBE6DA', appBg: '#F2EEE4', panel: '#FEFDF9', panelText: '#3B362D', panelSub: '#948D7E', panelBorder: '#EDE8DC', hover: '#F3EFE5', accent: '#8A7A5C', accentText: '#FFFFFF', dark: false },
  },
  {
    id: 'mist-grey', name: '雾灰', group: '莫兰迪色',
    tokens: { page: '#F5F5F4', text: '#333333', sub: '#8C8C88', border: '#E5E5E2', appBg: '#EBEBE9', panel: '#FAFAF9', panelText: '#333333', panelSub: '#8C8C88', panelBorder: '#E7E7E4', hover: '#EDEDEB', accent: '#6E6E6A', accentText: '#FFFFFF', dark: false },
  },
  {
    id: 'pea-green', name: '豆绿', group: '莫兰迪色',
    tokens: { page: '#F4F6EF', text: '#333A2C', sub: '#87927A', border: '#E2E7D9', appBg: '#EAEEE1', panel: '#FBFCF8', panelText: '#333A2C', panelSub: '#87927A', panelBorder: '#E4E9DB', hover: '#EDF0E5', accent: '#74835F', accentText: '#FFFFFF', dark: false },
  },
  {
    id: 'fog-blue', name: '雾蓝', group: '莫兰迪色',
    tokens: { page: '#F0F2F3', text: '#2F363C', sub: '#83909A', border: '#DEE2E5', appBg: '#E5E9EB', panel: '#FAFBFC', panelText: '#2F363C', panelSub: '#83909A', panelBorder: '#E0E4E7', hover: '#EAEDEE', accent: '#64748B', accentText: '#FFFFFF', dark: false },
  },
  {
    id: 'smoke-pink', name: '烟粉', group: '莫兰迪色',
    tokens: { page: '#FAF4F3', text: '#3C3230', sub: '#9A8884', border: '#EBDEDC', appBg: '#F2E9E7', panel: '#FEFBFA', panelText: '#3C3230', panelSub: '#9A8884', panelBorder: '#EDE0DE', hover: '#F4ECEA', accent: '#B08484', accentText: '#FFFFFF', dark: false },
  },
  {
    id: 'deep-grey', name: '深灰', group: '莫兰迪色',
    tokens: { page: '#EBEBE9', text: '#2E2E2C', sub: '#77776F', border: '#DBDBD7', appBg: '#E0E0DD', panel: '#F2F2F0', panelText: '#2E2E2C', panelSub: '#77776F', panelBorder: '#DDDDD9', hover: '#E4E4E1', accent: '#4A4A46', accentText: '#FFFFFF', dark: false },
  },
  // ── 暗色模式 ──
  {
    id: 'xuan-black', name: '玄黑', group: '暗色模式',
    tokens: { page: '#141414', text: '#EDEDED', sub: '#8E8E8E', border: '#2A2A2A', appBg: '#0C0C0C', panel: '#1D1D1D', panelText: '#EDEDED', panelSub: '#8E8E8E', panelBorder: '#282828', hover: '#262626', accent: '#F0F0F0', accentText: '#141414', dark: true },
  },
  {
    id: 'ink-blue', name: '墨蓝', group: '暗色模式',
    tokens: { page: '#141A23', text: '#DCE3EC', sub: '#7E8B9B', border: '#253040', appBg: '#0D1117', panel: '#1B222D', panelText: '#DCE3EC', panelSub: '#7E8B9B', panelBorder: '#263140', hover: '#222B38', accent: '#7FA7C9', accentText: '#0F1A26', dark: true },
  },
  {
    id: 'night-green', name: '暗夜绿', group: '暗色模式',
    tokens: { page: '#131B17', text: '#DCE7E0', sub: '#7F948A', border: '#22322A', appBg: '#0C120F', panel: '#1A241F', panelText: '#DCE7E0', panelSub: '#7F948A', panelBorder: '#243329', hover: '#203029', accent: '#7FB89A', accentText: '#0F1A14', dark: true },
  },
  {
    id: 'dai-purple', name: '黛紫', group: '暗色模式',
    tokens: { page: '#181521', text: '#E3DFEC', sub: '#8B85A0', border: '#2A2438', appBg: '#100E17', panel: '#201C2B', panelText: '#E3DFEC', panelSub: '#8B85A0', panelBorder: '#2C2539', hover: '#292337', accent: '#A18BD1', accentText: '#1A1425', dark: true },
  },
  {
    id: 'charcoal', name: '炭黑', group: '暗色模式',
    tokens: { page: '#1B1B1D', text: '#E8E8EA', sub: '#909096', border: '#2D2D31', appBg: '#121214', panel: '#232326', panelText: '#E8E8EA', panelSub: '#909096', panelBorder: '#2F2F33', hover: '#2B2B2F', accent: '#C9C9CF', accentText: '#1B1B1D', dark: true },
  },
  {
    id: 'midnight', name: '午夜', group: '暗色模式',
    tokens: { page: '#101522', text: '#D9E0EC', sub: '#76839A', border: '#212B3D', appBg: '#0A0E17', panel: '#182030', panelText: '#D9E0EC', panelSub: '#76839A', panelBorder: '#232D40', hover: '#202B3F', accent: '#8FA6E0', accentText: '#0C1220', dark: true },
  },
]

export const DEFAULT_THEME_ID = 'su-white'

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

// ── 字体 ──

export interface FontPreset {
  id: string
  name: string
  stack: string
}

export const BODY_FONTS: FontPreset[] = [
  { id: 'system', name: '系统默认', stack: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif' },
  { id: 'song', name: '宋体', stack: '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif' },
  { id: 'kai', name: '楷体', stack: '"Kaiti SC", "STKaiti", "KaiTi", serif' },
  { id: 'hei', name: '黑体', stack: '"PingFang SC", "Heiti SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif' },
]

export const CODE_FONTS: FontPreset[] = [
  { id: 'mono', name: '系统等宽', stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace' },
  { id: 'menlo', name: 'Menlo', stack: '"Menlo", "Consolas", monospace' },
  { id: 'sf-mono', name: 'SF Mono', stack: '"SF Mono", SFMono-Regular, Menlo, monospace' },
  { id: 'courier', name: 'Courier', stack: '"Courier New", Courier, monospace' },
]

export function bodyFontStack(settings: EditorSettings): string {
  const custom = settings.customFont.trim()
  if (custom) return `"${custom}", ${BODY_FONTS.find((f) => f.id === settings.fontId)?.stack ?? ''}`
  return BODY_FONTS.find((f) => f.id === settings.fontId)?.stack ?? BODY_FONTS[0].stack
}

export function codeFontStack(settings: EditorSettings): string {
  const custom = settings.customCodeFont.trim()
  if (custom) return `"${custom}", ${CODE_FONTS.find((f) => f.id === settings.codeFontId)?.stack ?? ''}`
  return CODE_FONTS.find((f) => f.id === settings.codeFontId)?.stack ?? CODE_FONTS[0].stack
}

// ── 设置模型 ──

export interface EditorSettings {
  fontId: string
  customFont: string
  codeFontId: string
  customCodeFont: string
  fontSize: number // 14–22 px
  lineHeight: number // 1.4–2.2
  lineWidth: number // 520–1440 px
  paragraphSpacing: number // 0.3–1.6 em
  paragraphIndent: 'none' | '2char'
  typewriter: boolean
  themeId: string
}

export const DEFAULT_SETTINGS: EditorSettings = {
  fontId: 'system',
  customFont: '',
  codeFontId: 'mono',
  customCodeFont: '',
  fontSize: 16,
  lineHeight: 1.7,
  lineWidth: 720,
  paragraphSpacing: 0.8,
  paragraphIndent: 'none',
  typewriter: true,
  themeId: DEFAULT_THEME_ID,
}

// ── 笔记模型 ──

export interface Note {
  title: string // = 第一个 H1
  markdown: string
  createdAt: number
  updatedAt: number
}

export const WELCOME_MARKDOWN = `# 欢迎使用 Miaomoo Lite

一款仿 Bear 的所见即所得 Markdown 笔记编辑器。这里是**预览版**，数据仅保存在当前浏览器中。

## 快速上手

- 直接输入 Markdown，语法会实时渲染成富文本
- 试试底部格式栏：**加粗**、*斜体*、~~删除线~~、\`行内代码\`
- 输入 \`/ \` 之外，还可以用 \`:smile:\` 插入表情 :smile:
- 右上角 **Info** 按钮可查看统计与大纲

### 列表与任务

1. 有序列表
2. 第二项
   - 嵌套无序列表

- [x] 支持任务列表
- [ ] 打开设置（右上角齿轮）挑选 18 款主题

> 引用块：把喜欢的句子放在这里。
> —— Miaomoo

### 代码高亮

\`\`\`ts
const greet = (name: string): string => {
  return \`你好, \${name}!\`
}
\`\`\`

### 表格

| 格式 | 状态 |
| --- | --- |
| Markdown | ✅ |
| 8 种导出 | ✅ |

---

底部格式栏、右侧详情面板、导出与设置弹窗都已就绪，开始书写吧。`
