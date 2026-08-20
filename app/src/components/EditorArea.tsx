// 编辑区：Milkdown 所见即所得集成（模块化按需引入，禁用 @milkdown/kit 整包）
import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, editorViewOptionsCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm, columnResizingPlugin } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { clipboard } from '@milkdown/plugin-clipboard'
import { cursor } from '@milkdown/plugin-cursor'
import { indent } from '@milkdown/plugin-indent'
import { remarkEmojiPlugin } from '@milkdown/plugin-emoji'
import { highlight, highlightPluginConfig } from '@milkdown/plugin-highlight'
import { automd } from '@milkdown/plugin-automd'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { upload, uploadConfig } from '@milkdown/plugin-upload'
import { createParser } from 'prosemirror-highlight/sugar-high'
import { $inputRule, $mark } from '@milkdown/utils'
import { InputRule } from '@milkdown/prose/inputrules'
import { cellAround } from '@milkdown/prose/tables'
import { get as getEmoji } from 'node-emoji'
import type { Ctx } from '@milkdown/ctx'
import type { Mark, MarkType } from '@milkdown/prose/model'
import type { Node as ProseNode } from '@milkdown/prose/model'
import type { EditorView } from '@milkdown/prose/view'
import { Decoration } from '@milkdown/prose/view'
import type { Selection } from '@milkdown/prose/state'
import type { EditorSettings, ThemeTokens } from '../data'
import { bodyFontStack, codeFontStack } from '../data'

// 预览版说明：下划线不是 Markdown 标准语法，这里作为编辑器内 mark 存在，
// 序列化为 Markdown 时优雅降级为纯文本（不破坏保存链路）。
const underlineMark = $mark('underline', () => ({
  inclusive: false,
  parseDOM: [{ tag: 'u' }],
  toDOM: () => ['u', 0] as const,
  parseMarkdown: {
    match: (node: { type: string }) => node.type === 'underline',
    runner: () => {},
  },
  toMarkdown: {
    match: (mark: Mark) => mark.type.name === 'underline',
    runner: () => {},
  },
}))

export interface EditorApi {
  getEditor: () => Editor | null
  getView: () => EditorView | null
  getContentEl: () => HTMLElement | null
  hasFocus: () => boolean
}

// 光标所在表格状态（供格式栏的表格工具条使用）
export interface TableState {
  inTable: boolean
  align: 'left' | 'center' | 'right'
}

export const TABLE_STATE_OFF: TableState = { inTable: false, align: 'left' }

// 原生 emoji：`:smile:` 输入后直接替换为 Unicode 字符。
// 不使用官方 emoji 组合包——其内置的 twemoji 插件会把 emoji 转成 CDN 图片，
// 导致字号失控、光标错乱与排版异常；这里仅复用其 remark 插件做语法解析。
const nativeEmojiInputRule = $inputRule(
  () =>
    new InputRule(/(:([^:\s]+):)$/, (state, match, start, end) => {
      const shortcode = match[0]
      if (!shortcode) return null
      const char = getEmoji(shortcode)
      if (!char || shortcode.includes(char)) return null
      return state.tr.insertText(char, start, end)
    })
)

interface EditorAreaProps {
  initialMarkdown: string
  settings: EditorSettings
  theme: ThemeTokens
  onMarkdownChange: (markdown: string) => void
  onDocChange: (doc: ProseNode) => void
  onTableState: (state: TableState) => void
  apiRef: { current: EditorApi | null }
}

function EditorAreaInner(props: EditorAreaProps) {
  const { initialMarkdown, settings, theme, onMarkdownChange, onDocChange, onTableState, apiRef } = props
  const scrollRef = useRef<HTMLDivElement>(null)
  const changeRef = useRef({ onMarkdownChange, onDocChange, onTableState, typewriter: settings.typewriter })

  useEffect(() => {
    changeRef.current = { onMarkdownChange, onDocChange, onTableState, typewriter: settings.typewriter }
  }, [onMarkdownChange, onDocChange, onTableState, settings.typewriter])

  // 上报光标所在表格状态（未变化时由 App 侧短路，避免每次按键重渲染）
  const pushTableState = (ctx: Ctx) => {
    try {
      const { state } = ctx.get(editorViewCtx)
      const cell = cellAround(state.selection.$head)
      if (!cell) {
        changeRef.current.onTableState(TABLE_STATE_OFF)
        return
      }
      const align = state.doc.nodeAt(cell.pos)?.attrs.alignment
      const norm = align === 'center' || align === 'right' ? align : 'left'
      changeRef.current.onTableState({ inTable: true, align: norm })
    } catch { /* 编辑器未就绪时忽略 */ }
  }

  const keepCursorCentered = (view: EditorView) => {
    const container = scrollRef.current
    if (!container) return
    try {
      const coords = view.coordsAtPos(view.state.selection.head)
      const top = coords.top - container.getBoundingClientRect().top + container.scrollTop
      container.scrollTo({ top: top - container.clientHeight / 2, behavior: 'smooth' })
    } catch { /* 选区无效时忽略 */ }
  }

  const { get, loading } = useEditor((root) => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, initialMarkdown)
        ctx.set(editorViewOptionsCtx, {
          attributes: { class: 'miaomoo-prose', spellcheck: 'false' },
        })
        ctx.set(highlightPluginConfig.key, { parser: createParser() })
        // 图片/附件拖拽与粘贴：转为 data URI 内联（预览版无网络依赖）
        ctx.set(uploadConfig.key, {
          enableHtmlFileUploader: true,
          uploadWidgetFactory: (pos, spec) => Decoration.widget(pos, document.createElement('span'), spec),
          uploader: async (files, schema) => {
            const nodes: ProseNode[] = []
            for (const file of Array.from(files)) {
              const src: string = await new Promise((resolve, reject) => {
                const r = new FileReader()
                r.onload = () => resolve(String(r.result))
                r.onerror = reject
                r.readAsDataURL(file)
              })
              if (file.type.startsWith('image/')) {
                nodes.push(schema.nodes.image.create({ src, alt: file.name }))
              } else {
                const link = schema.marks.link.create({ href: src })
                nodes.push(schema.text(file.name, [link]))
              }
            }
            return nodes
          },
        })
        ctx.get(listenerCtx)
          .markdownUpdated((_, markdown) => changeRef.current.onMarkdownChange(markdown))
          .selectionUpdated((ctx) => pushTableState(ctx))
          .updated((ctx, doc) => {
            changeRef.current.onDocChange(doc)
            pushTableState(ctx)
            if (changeRef.current.typewriter) {
              const view = ctx.get(editorViewCtx)
              keepCursorCentered(view)
            }
          })
      })
      .use(underlineMark)
      .use(listener)
      .use(commonmark)
      .use(gfm)
      .use(columnResizingPlugin)
      .use(history)
      .use(clipboard)
      .use(cursor)
      .use(indent)
      .use(remarkEmojiPlugin)
      .use(nativeEmojiInputRule)
      .use(highlight)
      .use(automd)
      .use(upload)
    return editor
  }, [])

  useEffect(() => {
    apiRef.current = {
      getEditor: () => get() ?? null,
      getView: () => {
        try { return get()?.action((ctx) => ctx.get(editorViewCtx)) ?? null } catch { return null }
      },
      getContentEl: () => scrollRef.current?.querySelector('.milkdown') ?? null,
      hasFocus: () => {
        try {
          const view = apiRef.current?.getView()
          return !!view?.hasFocus()
        } catch { return false }
      },
    }
    return () => { apiRef.current = null }
  }, [get, apiRef])

  // 编辑器就绪后上报一次文档，让大纲/统计/标题在初始加载即有数据
  useEffect(() => {
    if (loading) return
    const view = apiRef.current?.getView()
    if (view) changeRef.current.onDocChange(view.state.doc)
  }, [loading, apiRef])

  const style: CSSProperties = {
    '--md-page': theme.page,
    '--md-text': theme.text,
    '--md-sub': theme.sub,
    '--md-border': theme.border,
    '--md-accent': theme.accent,
    '--md-font-family': bodyFontStack(settings),
    '--md-code-font': codeFontStack(settings),
    '--md-font-size': `${settings.fontSize}px`,
    '--md-line-height': String(settings.lineHeight),
    '--md-line-width': `${settings.lineWidth}px`,
    '--md-paragraph-spacing': `${settings.paragraphSpacing}em`,
    '--md-indent': settings.paragraphIndent === '2char' ? '2em' : '0',
  } as CSSProperties

  return (
    <div className={`editor-scroll${settings.typewriter ? ' typewriter' : ''}`} ref={scrollRef} style={style}>
      {loading ? <div className="editor-loading">正在加载编辑器…</div> : null}
      <Milkdown />
    </div>
  )
}

export default function EditorArea(props: EditorAreaProps) {
  return (
    <MilkdownProvider>
      <EditorAreaInner {...props} />
    </MilkdownProvider>
  )
}

// 供格式栏使用：切换自定义下划线 mark
export function toggleUnderline(view: EditorView) {
  const { state } = view
  const type: MarkType | undefined = state.schema.marks.underline
  if (!type) return
  const { from, to } = state.selection
  const has = state.doc.rangeHasMark(from, Math.max(from, Math.min(to, state.doc.content.size)), type)
  const tr = has ? state.tr.removeMark(from, to, type) : state.tr.addMark(from, to, type.create())
  view.dispatch(tr)
}

export type { Selection }
