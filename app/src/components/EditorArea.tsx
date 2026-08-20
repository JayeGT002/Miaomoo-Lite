// 编辑区：Milkdown 所见即所得集成（模块化按需引入，禁用 @milkdown/kit 整包）
import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, editorViewOptionsCtx } from '@milkdown/core'
import {
  commonmark, imageSchema, codeBlockSchema,
  toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand,
  wrapInHeadingCommand, wrapInBulletListCommand, wrapInOrderedListCommand,
  insertHrCommand, createCodeBlockCommand,
} from '@milkdown/preset-commonmark'
import { gfm, columnResizingPlugin, toggleStrikethroughCommand, insertTableCommand } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { clipboard } from '@milkdown/plugin-clipboard'
import { cursor } from '@milkdown/plugin-cursor'
import { indent } from '@milkdown/plugin-indent'
import { remarkEmojiPlugin } from '@milkdown/plugin-emoji'
import { highlight, highlightPluginConfig } from '@milkdown/plugin-highlight'
import { automd } from '@milkdown/plugin-automd'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { upload, uploadConfig } from '@milkdown/plugin-upload'
import { block, BlockProvider } from '@milkdown/plugin-block'
import { trailing } from '@milkdown/plugin-trailing'
import { dropCursor } from 'prosemirror-dropcursor'
import { createParser } from 'prosemirror-highlight/sugar-high'
import { $inputRule, $mark, $prose, $view, callCommand, replaceAll } from '@milkdown/utils'
import { InputRule } from '@milkdown/prose/inputrules'
import { cellAround } from '@milkdown/prose/tables'
import { get as getEmoji } from 'node-emoji'
import type { Mark, MarkType } from '@milkdown/prose/model'
import type { Node as ProseNode } from '@milkdown/prose/model'
import type { EditorView } from '@milkdown/prose/view'
import { Decoration } from '@milkdown/prose/view'
import type { Selection } from '@milkdown/prose/state'
import type { EditorSettings, ThemeTokens } from '../data'
import { bodyFontStack, codeFontStack, bindingFromEvent, sameBinding } from '../data'

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
  /** 将指定文档位置滚动到编辑区可视中央（大纲跳转用） */
  centerAtPos: (pos: number) => void
  /** 整体替换文档内容（导入 .md/.txt 用），成功返回 true */
  setContent: (markdown: string) => boolean
}

// 光标所在表格状态（供表格工具条使用）
export interface TableState {
  inTable: boolean
  align: 'left' | 'center' | 'right'
  /** 表格在视口中的矩形，工具条据此跟随定位 */
  rect?: { top: number; left: number; width: number }
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

// 拖拽块/文本时显示插入位置指示线（颜色跟随主题强调色）
const dropCursorPlugin = $prose(() => dropCursor({ color: 'var(--md-accent)', width: 2 }))

// 图片节点视图：图片下方附带注释输入框，内容写入 title 属性（序列化为 ![alt](src "title")）
const imageView = $view(imageSchema.node, () => (node, view, getPos) => {
  let current = node
  const wrap = document.createElement('span')
  wrap.className = 'mm-image'
  wrap.contentEditable = 'false'
  const img = document.createElement('img')
  img.draggable = false
  const caption = document.createElement('input')
  caption.type = 'text'
  caption.className = 'mm-image-caption'
  caption.placeholder = '添加图片注释…'
  const sync = (n: ProseNode) => {
    const src = String(n.attrs.src ?? '')
    if (img.getAttribute('src') !== src) img.setAttribute('src', src)
    img.alt = String(n.attrs.alt ?? '')
    if (document.activeElement !== caption) caption.value = String(n.attrs.title ?? '')
  }
  sync(node)
  const commit = () => {
    const pos = getPos()
    if (typeof pos !== 'number' || caption.value === String(current.attrs.title ?? '')) return
    view.dispatch(view.state.tr.setNodeAttribute(pos, 'title', caption.value))
  }
  caption.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); caption.blur() }
  })
  caption.addEventListener('blur', commit)
  wrap.append(img, caption)
  return {
    dom: wrap,
    update: (n) => {
      if (n.type.name !== 'image') return false
      current = n
      sync(n)
      return true
    },
    ignoreMutation: () => true,
    stopEvent: (e) => e.target === caption,
    selectNode: () => wrap.classList.add('selected'),
    deselectNode: () => wrap.classList.remove('selected'),
  }
})

// 代码块节点视图：右上角语言选择器（对照 milkdown 演示），改动写回 language 属性
const CODE_LANGS: [string, string][] = [
  ['', '纯文本'], ['typescript', 'TypeScript'], ['javascript', 'JavaScript'], ['tsx', 'TSX'],
  ['python', 'Python'], ['rust', 'Rust'], ['go', 'Go'], ['java', 'Java'],
  ['c', 'C'], ['cpp', 'C++'], ['csharp', 'C#'], ['php', 'PHP'],
  ['ruby', 'Ruby'], ['swift', 'Swift'], ['kotlin', 'Kotlin'], ['sql', 'SQL'],
  ['bash', 'Bash'], ['shell', 'Shell'], ['json', 'JSON'], ['yaml', 'YAML'],
  ['toml', 'TOML'], ['html', 'HTML'], ['css', 'CSS'], ['xml', 'XML'],
  ['markdown', 'Markdown'], ['diff', 'Diff'],
]
const codeBlockView = $view(codeBlockSchema.node, () => (node, view, getPos) => {
  const wrap = document.createElement('div')
  wrap.className = 'mm-code-block'
  const bar = document.createElement('div')
  bar.className = 'mm-code-bar'
  bar.contentEditable = 'false'
  const select = document.createElement('select')
  select.className = 'mm-code-lang'
  for (const [val, label] of CODE_LANGS) {
    const opt = document.createElement('option')
    opt.value = val
    opt.textContent = label
    select.append(opt)
  }
  const sync = (n: ProseNode) => { select.value = String(n.attrs.language ?? '') }
  sync(node)
  select.addEventListener('change', () => {
    const pos = getPos()
    if (typeof pos !== 'number') return
    view.dispatch(view.state.tr.setNodeAttribute(pos, 'language', select.value))
  })
  bar.append(select)
  const pre = document.createElement('pre')
  const code = document.createElement('code')
  pre.append(code)
  wrap.append(bar, pre)
  return {
    dom: wrap,
    contentDOM: code,
    update: (n) => {
      if (n.type.name !== 'code_block') return false
      sync(n)
      return true
    },
    ignoreMutation: (m) => m.target instanceof Node && bar.contains(m.target),
    stopEvent: (e) => e.target instanceof Node && bar.contains(e.target),
  }
})

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
  const changeRef = useRef({ onMarkdownChange, onDocChange, onTableState, typewriter: settings.typewriter, typewriterLine: settings.typewriterLine, shortcuts: settings.shortcuts })

  useEffect(() => {
    changeRef.current = { onMarkdownChange, onDocChange, onTableState, typewriter: settings.typewriter, typewriterLine: settings.typewriterLine, shortcuts: settings.shortcuts }
  }, [onMarkdownChange, onDocChange, onTableState, settings.typewriter, settings.typewriterLine, settings.shortcuts])

  // 上报光标所在表格状态（含表格视口矩形，工具条据此跟随表格定位）
  // 注意：selectionUpdated 在 plugin state.apply 阶段触发，此时 view.state 仍是旧选区，
  // 必须用回调传入的新选区，否则工具条会滞后一次点击
  const pushTableState = (view: EditorView, selection?: Selection) => {
    try {
      const sel = selection ?? view.state.selection
      const cell = cellAround(sel.$head)
      if (!cell) {
        changeRef.current.onTableState(TABLE_STATE_OFF)
        return
      }
      const align = sel.$head.doc.nodeAt(cell.pos)?.attrs.alignment
      const norm = align === 'center' || align === 'right' ? align : 'left'
      const dom = view.nodeDOM(cell.pos)
      const tableEl = dom instanceof Element ? dom.closest('table') : null
      const r = tableEl ? tableEl.getBoundingClientRect() : null
      changeRef.current.onTableState({
        inTable: true,
        align: norm,
        rect: r ? { top: r.top, left: r.left, width: r.width } : undefined,
      })
    } catch { /* 编辑器未就绪时忽略 */ }
  }

  // 打字机模式：光标行固定在视口 typewriterLine%（50–80）位置处
  const keepCursorCentered = (view: EditorView) => {
    const container = scrollRef.current
    if (!container) return
    try {
      const coords = view.coordsAtPos(view.state.selection.head)
      const top = coords.top - container.getBoundingClientRect().top + container.scrollTop
      const ratio = Math.min(80, Math.max(50, changeRef.current.typewriterLine)) / 100
      container.scrollTo({ top: top - container.clientHeight * ratio, behavior: 'smooth' })
    } catch { /* 选区无效时忽略 */ }
  }

  const { get, loading } = useEditor((root) => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, initialMarkdown)
        ctx.set(editorViewOptionsCtx, {
          attributes: { class: 'miaomoo-prose', spellcheck: 'false' },
          // 自定义快捷键：在 DOM 事件层拦截（先于 Milkdown 内置 keymap），
          // 命中用户绑定即执行对应格式命令
          handleDOMEvents: {
            keydown: (view, event) => {
              const binding = bindingFromEvent(event)
              if (!binding) return false
              const hit = Object.entries(changeRef.current.shortcuts).find(([, b]) => b && sameBinding(b, binding))
              if (!hit) return false
              const id = hit[0]
              try {
                switch (id) {
                  case 'bold': callCommand(toggleStrongCommand.key)(ctx); break
                  case 'italic': callCommand(toggleEmphasisCommand.key)(ctx); break
                  case 'underline': toggleUnderline(view); break
                  case 'strikethrough': callCommand(toggleStrikethroughCommand.key)(ctx); break
                  case 'inlineCode': callCommand(toggleInlineCodeCommand.key)(ctx); break
                  case 'codeBlock': callCommand(createCodeBlockCommand.key)(ctx); break
                  case 'bulletList': callCommand(wrapInBulletListCommand.key)(ctx); break
                  case 'orderedList': callCommand(wrapInOrderedListCommand.key)(ctx); break
                  case 'table': callCommand(insertTableCommand.key)(ctx); break
                  case 'hr': callCommand(insertHrCommand.key)(ctx); break
                  default: {
                    if (!/^h[1-5]$/.test(id)) return false
                    callCommand(wrapInHeadingCommand.key, Number(id[1]))(ctx)
                  }
                }
                return true
              } catch { return false }
            },
          },
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
          .selectionUpdated((ctx, selection) => pushTableState(ctx.get(editorViewCtx), selection))
          .updated((ctx, doc) => {
            changeRef.current.onDocChange(doc)
            pushTableState(ctx.get(editorViewCtx))
            if (changeRef.current.typewriter) {
              keepCursorCentered(ctx.get(editorViewCtx))
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
      .use(trailing)
      .use(block)
      .use(dropCursorPlugin)
      .use(imageView)
      .use(codeBlockView)
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
      centerAtPos: (pos: number) => {
        const container = scrollRef.current
        const view = apiRef.current?.getView()
        if (!container || !view) return
        try {
          const clamped = Math.min(Math.max(pos + 1, 0), view.state.doc.content.size)
          const coords = view.coordsAtPos(clamped)
          const top = coords.top - container.getBoundingClientRect().top + container.scrollTop
          container.scrollTo({ top: top - container.clientHeight / 2, behavior: 'smooth' })
        } catch { /* 位置失效忽略 */ }
      },
      setContent: (markdown: string) => {
        const editor = get()
        if (!editor) return false
        try {
          editor.action(replaceAll(markdown))
          return true
        } catch { return false }
      },
    }
    return () => { apiRef.current = null }
  }, [get, apiRef])

  // 编辑区滚动时重新上报表格矩形，让浮动工具条跟随表格
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const view = apiRef.current?.getView()
        if (view) pushTableState(view)
      })
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 编辑器就绪后上报一次文档，让大纲/统计/标题在初始加载即有数据
  useEffect(() => {
    if (loading) return
    const view = apiRef.current?.getView()
    if (view) changeRef.current.onDocChange(view.state.doc)
  }, [loading, apiRef])

  // 块级拖拽手柄：block 插件不带默认 UI，就绪后用 BlockProvider 接线自绘手柄
  useEffect(() => {
    if (loading) return
    const editor = get()
    if (!editor) return
    const handle = document.createElement('div')
    handle.className = 'mm-block-handle'
    handle.title = '拖拽移动'
    handle.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">' +
      '<circle cx="3" cy="2" r="1.4"/><circle cx="9" cy="2" r="1.4"/>' +
      '<circle cx="3" cy="6" r="1.4"/><circle cx="9" cy="6" r="1.4"/>' +
      '<circle cx="3" cy="10" r="1.4"/><circle cx="9" cy="10" r="1.4"/></svg>'
    const provider = new BlockProvider({
      ctx: editor.ctx,
      content: handle,
      getOffset: () => 10,
      // 手柄统一锚定在正文内容区左缘（列表缩进层级不同也不偏移），
      // 固定落在左侧留白栏内，避免与列表行标/序号重叠；
      // 垂直方向锚定块的首行——floating-ui 会把手柄垂直居中在锚定矩形上，
      // 而图片等 NodeView 的 coords 覆盖整个高块（图+注释框），直接用会落中部，
      // 故把锚定矩形高度钳制到一行文本高度，使手柄始终贴块首行
      getPosition: ({ active, editorDom }) => {
        const r = active.el.getBoundingClientRect()
        const pad = parseFloat(getComputedStyle(editorDom).paddingLeft || '0') || 0
        const left = editorDom.getBoundingClientRect().left + pad
        let top = r.top
        let height = Math.min(r.height, 28)
        try {
          const view = editor.ctx.get(editorViewCtx)
          const pos = Math.min(active.$pos.pos + 1, view.state.doc.content.size)
          const c = view.coordsAtPos(pos)
          // 首行坐标需落在块矩形内才算有效（atom 节点等场景可能越界）
          if (Number.isFinite(c.top) && c.top >= r.top - 2 && c.bottom <= r.bottom + 2) {
            top = c.top
            height = Math.min(Math.max(c.bottom - c.top, 12), 28)
          }
        } catch { /* 坐标不可得时退回块矩形顶部 */ }
        return new DOMRect(left, top, 0, height)
      },
    })
    provider.update()
    // 视图偶发晚于 loading 就绪时兜底重试一次
    const retry = setTimeout(() => provider.update(), 200)
    return () => {
      clearTimeout(retry)
      provider.destroy()
    }
  }, [loading, get])

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
