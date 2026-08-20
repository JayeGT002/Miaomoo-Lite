// 笔记模型、统计与持久化（Web 版：localStorage）
import type { Node as ProseNode } from '@milkdown/prose/model'
import { DEFAULT_SETTINGS, WELCOME_MARKDOWN, type EditorSettings, type Note } from '../data'

export type { Note, EditorSettings }

const NOTE_KEY = 'miaomoo-lite.note'
const SETTINGS_KEY = 'miaomoo-lite.settings'

export function loadNote(): Note {
  try {
    const raw = localStorage.getItem(NOTE_KEY)
    if (raw) {
      const n = JSON.parse(raw) as Note
      if (typeof n.markdown === 'string') return n
    }
  } catch { /* 忽略损坏数据 */ }
  const now = Date.now()
  return { title: '欢迎使用 Miaomoo Lite', markdown: WELCOME_MARKDOWN, createdAt: now, updatedAt: now }
}

export function saveNote(note: Note) {
  try { localStorage.setItem(NOTE_KEY, JSON.stringify(note)) } catch { /* 存储失败静默 */ }
}

// 存量设置迁移：v2 起打字机模式默认启用
const SETTINGS_VERSION = 2

export function loadSettings(): EditorSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const stored = JSON.parse(raw) as Partial<EditorSettings> & { _v?: number }
      const { _v, ...patch } = stored
      if (!_v || _v < SETTINGS_VERSION) {
        const merged = { ...DEFAULT_SETTINGS, ...patch, typewriter: true }
        saveSettings(merged)
        return merged
      }
      return { ...DEFAULT_SETTINGS, ...patch }
    }
  } catch { /* 忽略 */ }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(s: EditorSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, _v: SETTINGS_VERSION })) } catch { /* 忽略 */ }
}

// ── 统计 ──

export interface Stats {
  words: number // 字数：CJK 逐字 + 西文按词
  chars: number // 字符（不含空白）
  readingMinutes: number // 阅读时长（分钟，400 字/分钟）
  inputSpeed: number // 输入速度（字/分钟，滑动窗口）
}

export function computeStats(markdown: string, speedWindow: { t: number; chars: number }[]): Stats {
  const plain = markdown.replace(/```[\s\S]*?```/g, (m) => m) // 保留代码内容统计
  const cjk = (plain.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) ?? []).length
  const latinWords = (plain.match(/[a-zA-Z0-9]+(?:['’-][a-zA-Z0-9]+)*/g) ?? []).length
  const words = cjk + latinWords
  const chars = plain.replace(/\s/g, '').length
  const now = Date.now()
  const recent = speedWindow.filter((x) => now - x.t < 60_000)
  const inputSpeed = recent.reduce((a, x) => a + x.chars, 0)
  return { words, chars, readingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / 400)), inputSpeed }
}

// ── 大纲 ──

export interface OutlineItem {
  level: number // 1–8
  text: string
  pos: number // 文档内位置（用于滚动定位）
}

export function extractOutline(doc: ProseNode): OutlineItem[] {
  const items: OutlineItem[] = []
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      items.push({ level: node.attrs.level as number, text: node.textContent || '无标题', pos })
      return false
    }
    return true
  })
  return items
}

export function firstH1(doc: ProseNode): string | null {
  let title: string | null = null
  doc.descendants((node) => {
    if (title !== null) return false
    if (node.type.name === 'heading' && node.attrs.level === 1) {
      title = node.textContent || null
      return false
    }
    return true
  })
  return title
}

// ── 格式化 ──

export function formatDateTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
