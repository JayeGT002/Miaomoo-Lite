// 编辑区：Milkdown 所见即所得集成（模块化按需引入，禁用 @milkdown/kit 整包）
import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, editorViewOptionsCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { clipboard } from '@milkdown/plugin-clipboard'
import { cursor } from '@milkdown/plugin-cursor'
import { indent } from '@milkdown/plugin-indent'
import { emoji } from '@milkdown/plugin-emoji'
import { highlight, highlightPluginConfig } from '@milkdown/plugin-highlight'
import { automd } from '@milkdown/plugin-automd'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { upload, uploadConfig } from '@milkdown/plugin-upload'
import { createParser } from 'prosemirror-highlight/sugar-high'
import { $mark } from '@milkdown/utils'
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

interface EditorAreaProps {
  initialMarkdown: string
  settings: EditorSettings
  theme: ThemeTokens
  onMarkdownChange: (markdown: string) => void
  onDocChange: (doc: ProseNode) => void
  apiRef: { current: EditorApi | null }
}

function EditorAreaInner(props: EditorAreaProps) {
  const { initialMarkdown, settings, theme, onMarkdownChange, onDocChange, apiRef } = props
  const scrollRef = useRef<HTMLDivElement>(null)
  const changeRef = useRef({ onMarkdownChange, onDocChange, typewriter: settings.typewriter })
  changeRef.current = { onMarkdownChange, onDocChange, typewriter: settings.typewriter }

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
          .updated((ctx, doc) => {
            changeRef.current.onDocChange(doc)
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
      .use(history)
      .use(clipboard)
      .use(cursor)
      .use(indent)
      .use(emoji)
      .use(highlight)
      .use(automd)
      .use(upload)
    return editor
  }, [])

  const keepCursorCentered = (view: EditorView) => {
    const container = scrollRef.current
    if (!container) return
    try {
      const coords = view.coordsAtPos(view.state.selection.head)
      const top = coords.top - container.getBoundingClientRect().top + container.scrollTop
      container.scrollTo({ top: top - container.clientHeight / 2, behavior: 'smooth' })
    } catch { /* 选区无效时忽略 */ }
  }

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
