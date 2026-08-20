// Miaomoo Lite — 仿 Bear 的所见即所得 Markdown 笔记编辑器（预览版）
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { TextSelection } from '@milkdown/prose/state'
import type { Node as ProseNode } from '@milkdown/prose/model'
import TitleBar from './components/TitleBar'
import EditorArea, { type EditorApi } from './components/EditorArea'
import FormatBar from './components/FormatBar'
import DetailsPanel from './components/DetailsPanel'
import ExportPanel from './components/ExportPanel'
import SettingsPanel from './components/SettingsPanel'
import Notify, { useNotify } from './components/Notify'
import { getTheme, type EditorSettings } from './data'
import {
  computeStats, extractOutline, firstH1, loadNote, loadSettings, saveNote, saveSettings,
  type Note, type OutlineItem, type Stats,
} from './lib/model'

const SAVE_DEBOUNCE = 900

export default function App() {
  const initial = useRef(loadNote())
  const [settings, setSettings] = useState<EditorSettings>(loadSettings)
  const [title, setTitle] = useState(initial.current.title)
  const [saving, setSaving] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [stats, setStats] = useState<Stats>({ words: 0, chars: 0, readingMinutes: 0, inputSpeed: 0 })
  const [dates, setDates] = useState({ createdAt: initial.current.createdAt, updatedAt: initial.current.updatedAt })
  const { notices, notify } = useNotify()

  const apiRef = useRef<EditorApi | null>(null)
  const noteRef = useRef<Note>(initial.current)
  const markdownRef = useRef(initial.current.markdown)
  const speedWindow = useRef<{ t: number; chars: number }[]>([])
  const lastLen = useRef(-1)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  const theme = useMemo(() => getTheme(settings.themeId), [settings.themeId])

  useEffect(() => {
    // 首次进入提示（Web 版数据仅存于当前浏览器）
    const t = setTimeout(() => notify('预览版：内容与设置仅保存在当前浏览器'), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 主题联动 body 背景
  useEffect(() => {
    document.body.style.background = theme.tokens.appBg
    document.body.classList.toggle('dark', theme.tokens.dark)
  }, [theme])

  // 设置变化即时持久化
  useEffect(() => { saveSettings(settings) }, [settings])

  const onMarkdownChange = (markdown: string) => {
    markdownRef.current = markdown
    setSaving(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const now = Date.now()
      const note: Note = { ...noteRef.current, title, markdown, updatedAt: now }
      noteRef.current = note
      saveNote(note)
      setDates((d) => ({ ...d, updatedAt: now }))
      setSaving(false)
    }, SAVE_DEBOUNCE)
  }

  const onDocChange = (doc: ProseNode) => {
    setOutline(extractOutline(doc))
    setTitle(firstH1(doc) ?? '无标题')
    const len = doc.textContent.length
    if (lastLen.current >= 0 && len > lastLen.current) {
      speedWindow.current.push({ t: Date.now(), chars: len - lastLen.current })
      if (speedWindow.current.length > 500) speedWindow.current.splice(0, 100)
    }
    lastLen.current = len
    setStats(computeStats(markdownRef.current, speedWindow.current))
  }

  const jumpToHeading = (pos: number) => {
    const view = apiRef.current?.getView()
    if (!view) return
    try {
      const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos + 1)))
      view.dispatch(tr.scrollIntoView())
      view.focus()
    } catch { /* 位置失效忽略 */ }
  }

  const exportPayload = () => ({
    title: title === '无标题' ? '无标题' : title,
    markdown: markdownRef.current,
    doc: apiRef.current?.getView()?.state.doc ?? null as never,
    getContentEl: () => apiRef.current?.getContentEl() ?? null,
  })

  const rootStyle: CSSProperties = {
    '--app-bg': theme.tokens.appBg,
    '--page': theme.tokens.page,
    '--text': theme.tokens.text,
    '--sub': theme.tokens.sub,
    '--border': theme.tokens.border,
    '--panel': theme.tokens.panel,
    '--panel-text': theme.tokens.panelText,
    '--panel-sub': theme.tokens.panelSub,
    '--panel-border': theme.tokens.panelBorder,
    '--hover': theme.tokens.hover,
    '--accent': theme.tokens.accent,
    '--accent-text': theme.tokens.accentText,
  } as CSSProperties

  return (
    <div className={`app-shell${theme.tokens.dark ? ' dark' : ''}`} style={rootStyle}>
      <Notify notices={notices} />
      <TitleBar
        title={title}
        saving={saving}
        showDetails={showDetails}
        onToggleDetails={() => setShowDetails((v) => !v)}
        onOpenExport={() => setShowExport(true)}
        onOpenSettings={() => setShowSettings(true)}
        theme={theme.tokens}
      />
      <main className="app-main">
        <div className="editor-pane">
          <EditorArea
            initialMarkdown={initial.current.markdown}
            settings={settings}
            theme={theme.tokens}
            onMarkdownChange={onMarkdownChange}
            onDocChange={onDocChange}
            apiRef={apiRef}
          />
        </div>
        {showDetails && (
          <DetailsPanel
            stats={stats}
            outline={outline}
            createdAt={dates.createdAt}
            updatedAt={dates.updatedAt}
            onJump={jumpToHeading}
          />
        )}
      </main>
      <FormatBar apiRef={apiRef} />

      {showExport && (
        <ExportPanel
          title={title === '无标题' ? '' : title}
          markdown={markdownRef.current}
          theme={theme.tokens}
          getPayload={exportPayload}
          onClose={() => setShowExport(false)}
          notify={notify}
        />
      )}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          theme={theme.tokens}
          onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
