// 格式栏：底部悬浮，常显；二级菜单与触发按钮中心对齐；表格内附加表格工具条
import { useEffect, useRef, useState } from 'react'
import {
  H, H1, H2, H3, LevelFourTitle, LevelFiveTitle,
  TextBold, TextItalic, TextUnderline, Strikethrough,
  ListTop, OrderedList, Pic, Paperclip, LinkOne, InsertTable,
  Code, CodeBrackets, DividingLineOne,
  AlignTextLeft, AlignTextCenter, AlignTextRight, DeleteOne,
} from '@icon-park/react'
import { callCommand } from '@milkdown/utils'
import type { CmdKey } from '@milkdown/core'
import {
  toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand,
  wrapInHeadingCommand, wrapInBulletListCommand, wrapInOrderedListCommand,
  insertHrCommand, createCodeBlockCommand, insertImageCommand, toggleLinkCommand,
} from '@milkdown/preset-commonmark'
import {
  toggleStrikethroughCommand, insertTableCommand,
  addRowBeforeCommand, addRowAfterCommand, addColBeforeCommand, addColAfterCommand,
  setAlignCommand, selectRowCommand, selectColCommand, selectTableCommand,
  deleteSelectedCellsCommand,
} from '@milkdown/preset-gfm'
import { selectedRect } from '@milkdown/prose/tables'
import type { EditorApi, TableState } from './EditorArea'
import { toggleUnderline } from './EditorArea'

interface FormatBarProps {
  apiRef: { current: EditorApi | null }
  tableState: TableState
}

type MenuId = 'heading' | 'list' | 'code' | 'image' | 'link' | 'row' | 'col' | null

const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result))
  r.onerror = reject
  r.readAsDataURL(file)
})

export default function FormatBar({ apiRef, tableState }: FormatBarProps) {
  const [menu, setMenu] = useState<MenuId>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const barRef = useRef<HTMLDivElement>(null)
  const imageFileRef = useRef<HTMLInputElement>(null)
  const attachFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setMenu(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menu])

  const run = (fn: (helpers: { command: <T>(key: CmdKey<T>, payload?: T) => void; focus: () => void }) => void) => {
    const api = apiRef.current
    const editor = api?.getEditor()
    if (!editor) return
    fn({
      command: (key, payload) => { try { editor.action(callCommand(key, payload)) } catch { /* 预览版容错 */ } },
      focus: () => setTimeout(() => api?.getView()?.focus(), 0),
    })
    if (menu) setMenu(null)
  }

  const insertImageFiles = async (files: FileList | null) => {
    const api = apiRef.current
    const editor = api?.getEditor()
    if (!editor || !files?.length) return
    for (const file of Array.from(files)) {
      const src = await readAsDataUrl(file)
      try { editor.action(callCommand(insertImageCommand.key, { src, alt: file.name, title: '' })) } catch { /* 忽略 */ }
    }
    setTimeout(() => api?.getView()?.focus(), 0)
    setMenu(null)
  }

  const insertAttachments = async (files: FileList | null) => {
    const api = apiRef.current
    const view = api?.getView()
    if (!view || !files?.length) return
    const { schema } = view.state
    for (const file of Array.from(files)) {
      const href = await readAsDataUrl(file)
      const node = schema.text(file.name, [schema.marks.link.create({ href })])
      view.dispatch(view.state.tr.replaceSelectionWith(node, false))
    }
    view.focus()
  }

  // 表格行/列删除：先按当前坐标选中行/列（或整表），再执行删除
  const deleteTablePart = (kind: 'row' | 'col' | 'table') => {
    const api = apiRef.current
    const editor = api?.getEditor()
    const view = api?.getView()
    if (!editor || !view) return
    try {
      if (kind === 'table') {
        editor.action(callCommand(selectTableCommand.key))
      } else {
        const rect = selectedRect(view.state)
        editor.action(callCommand(
          kind === 'row' ? selectRowCommand.key : selectColCommand.key,
          { index: kind === 'row' ? rect.top : rect.left },
        ))
      }
      editor.action(callCommand(deleteSelectedCellsCommand.key))
    } catch { /* 预览版容错 */ }
    setTimeout(() => view.focus(), 0)
    setMenu(null)
  }

  const menuBtn = (id: Exclude<MenuId, null>, label: string) => ({
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); setMenu(menu === id ? null : id) },
    title: label,
    className: `fmt-btn${menu === id ? ' active' : ''}`,
  })

  const MenuItem = ({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void }) => (
    <button className="menu-item" onClick={(e) => { e.stopPropagation(); onClick() }}>
      {icon}<span>{label}</span>{hint ? <span className="hint">{hint}</span> : null}
    </button>
  )

  const AlignBtn = ({ align, label, icon }: { align: TableState['align']; label: string; icon: React.ReactNode }) => (
    <button
      className={`fmt-btn${tableState.align === align ? ' active' : ''}`}
      title={label}
      onClick={() => run(({ command, focus }) => { command(setAlignCommand.key, align); focus() })}
    >
      {icon}
    </button>
  )

  return (
    <div className="format-bar-wrap" ref={barRef}>
      {/* 表格工具条：光标位于表格内时显示在格式栏上方 */}
      {tableState.inTable && (
        <div className="table-tools">
          <AlignBtn align="left" label="左对齐" icon={<AlignTextLeft theme="outline" size="16" />} />
          <AlignBtn align="center" label="居中对齐" icon={<AlignTextCenter theme="outline" size="16" />} />
          <AlignBtn align="right" label="右对齐" icon={<AlignTextRight theme="outline" size="16" />} />
          <span className="fmt-sep" />

          <div className="fmt-group">
            <button {...menuBtn('row', '行操作')}>
              <span className="fmt-text">行</span>
            </button>
            {menu === 'row' && (
              <div className="fmt-menu">
                <MenuItem icon={<span className="fmt-text">↑</span>} label="在上方插入行" onClick={() => run(({ command, focus }) => { command(addRowBeforeCommand.key); focus() })} />
                <MenuItem icon={<span className="fmt-text">↓</span>} label="在下方插入行" onClick={() => run(({ command, focus }) => { command(addRowAfterCommand.key); focus() })} />
                <MenuItem icon={<span className="fmt-text">✕</span>} label="删除此行" onClick={() => deleteTablePart('row')} />
              </div>
            )}
          </div>

          <div className="fmt-group">
            <button {...menuBtn('col', '列操作')}>
              <span className="fmt-text">列</span>
            </button>
            {menu === 'col' && (
              <div className="fmt-menu">
                <MenuItem icon={<span className="fmt-text">←</span>} label="在左侧插入列" onClick={() => run(({ command, focus }) => { command(addColBeforeCommand.key); focus() })} />
                <MenuItem icon={<span className="fmt-text">→</span>} label="在右侧插入列" onClick={() => run(({ command, focus }) => { command(addColAfterCommand.key); focus() })} />
                <MenuItem icon={<span className="fmt-text">✕</span>} label="删除此列" onClick={() => deleteTablePart('col')} />
              </div>
            )}
          </div>

          <span className="fmt-sep" />
          <button className="fmt-btn" title="删除表格" onClick={() => deleteTablePart('table')}>
            <DeleteOne theme="outline" size="16" />
          </button>
        </div>
      )}

      <div className="format-bar">
        {/* 标题 */}
        <div className="fmt-group">
          <button {...menuBtn('heading', '标题')}>
            <H theme="outline" size="17" />
          </button>
          {menu === 'heading' && (
            <div className="fmt-menu">
              {[1, 2, 3, 4, 5].map((lvl, i) => {
                const names = ['一级标题', '二级标题', '三级标题', '四级标题', '五级标题']
                const icons = [<H1 key="1" />, <H2 key="2" />, <H3 key="3" />, <LevelFourTitle key="4" />, <LevelFiveTitle key="5" />]
                return (
                  <MenuItem
                    key={lvl}
                    icon={icons[i]}
                    label={names[i]}
                    hint={`⌘${lvl}`}
                    onClick={() => run(({ command, focus }) => { command(wrapInHeadingCommand.key, lvl); focus() })}
                  />
                )
              })}
            </div>
          )}
        </div>

        <span className="fmt-sep" />

        <button className="fmt-btn" title="加粗 ⌘B" onClick={() => run(({ command, focus }) => { command(toggleStrongCommand.key); focus() })}><TextBold theme="outline" size="17" /></button>
        <button className="fmt-btn" title="斜体 ⌘I" onClick={() => run(({ command, focus }) => { command(toggleEmphasisCommand.key); focus() })}><TextItalic theme="outline" size="17" /></button>
        <button className="fmt-btn" title="下划线 ⌘U" onClick={() => run(({ focus }) => { const v = apiRef.current?.getView(); if (v) { toggleUnderline(v); focus() } })}><TextUnderline theme="outline" size="17" /></button>
        <button className="fmt-btn" title="删除线" onClick={() => run(({ command, focus }) => { command(toggleStrikethroughCommand.key); focus() })}><Strikethrough theme="outline" size="17" /></button>

        <span className="fmt-sep" />

        {/* 列表 */}
        <div className="fmt-group">
          <button {...menuBtn('list', '列表')}>
            <ListTop theme="outline" size="17" />
          </button>
          {menu === 'list' && (
            <div className="fmt-menu">
              <MenuItem icon={<ListTop />} label="无序列表" hint="⌘⇧8" onClick={() => run(({ command, focus }) => { command(wrapInBulletListCommand.key); focus() })} />
              <MenuItem icon={<OrderedList />} label="有序列表" hint="⌘⇧7" onClick={() => run(({ command, focus }) => { command(wrapInOrderedListCommand.key); focus() })} />
            </div>
          )}
        </div>

        {/* 图片 */}
        <div className="fmt-group">
          <button {...menuBtn('image', '插入图片')}>
            <Pic theme="outline" size="17" />
          </button>
          {menu === 'image' && (
            <div className="fmt-menu wide">
              <MenuItem icon={<Pic />} label="选择本地图片…" onClick={() => imageFileRef.current?.click()} />
              <div className="menu-input-row">
                <input
                  autoFocus
                  placeholder="或输入图片链接…"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && imageUrl.trim()) {
                      run(({ command, focus }) => { command(insertImageCommand.key, { src: imageUrl.trim(), alt: '' }); focus() })
                      setImageUrl('')
                    }
                  }}
                />
                <button
                  className="menu-confirm"
                  onClick={() => {
                    if (!imageUrl.trim()) return
                    run(({ command, focus }) => { command(insertImageCommand.key, { src: imageUrl.trim(), alt: '' }); focus() })
                    setImageUrl('')
                  }}
                >
                  插入
                </button>
              </div>
            </div>
          )}
        </div>
        <input ref={imageFileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void insertImageFiles(e.target.files); e.target.value = '' }} />

        {/* 附件 */}
        <button className="fmt-btn" title="插入附件" onClick={() => attachFileRef.current?.click()}><Paperclip theme="outline" size="17" /></button>
        <input ref={attachFileRef} type="file" multiple hidden onChange={(e) => { void insertAttachments(e.target.files); e.target.value = '' }} />

        {/* 链接 */}
        <div className="fmt-group">
          <button {...menuBtn('link', '插入/编辑链接')}>
            <LinkOne theme="outline" size="17" />
          </button>
          {menu === 'link' && (
            <div className="fmt-menu wide">
              <div className="menu-input-row">
                <input
                  autoFocus
                  placeholder="输入链接地址…"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && linkUrl.trim()) {
                      run(({ command, focus }) => { command(toggleLinkCommand.key, { href: linkUrl.trim() }); focus() })
                      setLinkUrl('')
                    }
                  }}
                />
                <button
                  className="menu-confirm"
                  onClick={() => {
                    if (!linkUrl.trim()) return
                    run(({ command, focus }) => { command(toggleLinkCommand.key, { href: linkUrl.trim() }); focus() })
                    setLinkUrl('')
                  }}
                >
                  应用
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 表格 */}
        <button className="fmt-btn" title="插入表格" onClick={() => run(({ command, focus }) => { command(insertTableCommand.key); focus() })}><InsertTable theme="outline" size="17" /></button>

        <span className="fmt-sep" />

        {/* 代码 */}
        <div className="fmt-group">
          <button {...menuBtn('code', '代码')}>
            <Code theme="outline" size="17" />
          </button>
          {menu === 'code' && (
            <div className="fmt-menu">
              <MenuItem icon={<Code />} label="行内代码" hint="⌘E" onClick={() => run(({ command, focus }) => { command(toggleInlineCodeCommand.key); focus() })} />
              <MenuItem icon={<CodeBrackets />} label="代码块" onClick={() => run(({ command, focus }) => { command(createCodeBlockCommand.key); focus() })} />
            </div>
          )}
        </div>

        {/* 分割线 */}
        <button className="fmt-btn" title="插入分割线" onClick={() => run(({ command, focus }) => { command(insertHrCommand.key); focus() })}><DividingLineOne theme="outline" size="17" /></button>
      </div>
    </div>
  )
}
