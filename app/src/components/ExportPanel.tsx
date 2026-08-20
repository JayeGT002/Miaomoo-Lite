// 导出面板：左预览右设置，8 种格式
import { useEffect, useMemo, useState } from 'react'
import { Close } from '@icon-park/react'
import { EXPORT_FORMATS, runExport, type ExportFormat, type ExportOptions } from '../lib/exporters'
import type { ThemeTokens } from '../data'

interface ExportPanelProps {
  title: string
  markdown: string
  theme: ThemeTokens
  getPayload: () => Parameters<typeof runExport>[1]
  onClose: () => void
  notify: (msg: string) => void
}

// 每种格式的图标（@icon-park/react，全项目唯一图标来源）
import { PictureOne, FileWord, FilePdf, FileText, FileCollection, FileCode, HtmlFive, Notebook } from '@icon-park/react'
const ICONS: Record<ExportFormat, React.ReactNode> = {
  png: <PictureOne theme="outline" size="20" />,
  docx: <FileWord theme="outline" size="20" />,
  pdf: <FilePdf theme="outline" size="20" />,
  txt: <FileText theme="outline" size="20" />,
  textbundle: <FileCollection theme="outline" size="20" />,
  rtf: <FileCode theme="outline" size="20" />,
  html: <HtmlFive theme="outline" size="20" />,
  epub: <Notebook theme="outline" size="20" />,
}

function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="export-option">
      <span className="export-option-label">{label}</span>
      <div className="export-option-control">{children}</div>
    </div>
  )
}

function Pills<T extends string | number>({ options, value, onChange }: {
  options: { value: T; label: string; disabled?: boolean }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div className="pills">
      {options.map((o) => (
        <button key={String(o.value)} disabled={o.disabled} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// 左侧预览：按格式区分形态
function FormatPreview({ format, title, theme }: { format: ExportFormat; title: string; theme: ThemeTokens }) {
  const textLines = (
    <>
      {[86, 64, 78, 42].map((w, i) => (
        <div key={i} className="prev-line" style={{ width: `${w}%`, background: theme.border }} />
      ))}
    </>
  )
  switch (format) {
    case 'pdf':
      return (
        <div className="prev-a4" style={{ background: theme.page }}>
          <div className="prev-line" style={{ width: '55%', height: 14, background: theme.sub }} />
          {textLines}
        </div>
      )
    case 'epub':
      return (
        <div className="prev-epub">
          <div className="prev-cover" style={{ background: theme.accent }}>
            <span style={{ color: theme.accentText }}>{title.slice(0, 8)}</span>
          </div>
          <div className="prev-page" style={{ background: theme.page }}>{textLines}</div>
        </div>
      )
    case 'txt':
    case 'rtf':
      return (
        <div className="prev-plain mono" style={{ background: theme.page }}>
          <p>{title}</p>
          {textLines}
        </div>
      )
    case 'textbundle':
      return (
        <div className="prev-tree" style={{ color: theme.sub }}>
          <p className="mono">{title}.textbundle</p>
          <p className="mono">├─ text.md</p>
          <p className="mono">├─ info.json</p>
          <p className="mono">└─ assets/</p>
        </div>
      )
    case 'html':
      return (
        <div className="prev-browser" style={{ background: theme.page }}>
          <div className="prev-chrome" style={{ background: theme.hover }}>
            <span /><span /><span />
            <div className="prev-url" style={{ background: theme.page }}>{title}.html</div>
          </div>
          <div className="prev-body">{textLines}</div>
        </div>
      )
    case 'docx':
      return (
        <div className="prev-doc" style={{ background: theme.page }}>
          <div className="prev-doc-head" style={{ background: theme.accent }} />
          <div className="prev-body">{textLines}</div>
        </div>
      )
    case 'png':
      return (
        <div className="prev-png" style={{ background: theme.page }}>
          <div className="prev-png-frame" style={{ borderColor: theme.accent }}>{textLines}</div>
          <span className="prev-png-tag" style={{ background: theme.accent, color: theme.accentText }}>PNG</span>
        </div>
      )
  }
}

export default function ExportPanel({ title, markdown, theme, getPayload, onClose, notify }: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [filename, setFilename] = useState(title || '无标题')
  const [pngScale, setPngScale] = useState<1 | 2 | 3>(2)
  const [pngTransparent, setPngTransparent] = useState(false)
  const [pdfSize, setPdfSize] = useState<'A4' | 'A5' | 'Letter'>('A4')
  const [pdfToc, setPdfToc] = useState(false)
  const [docxToc, setDocxToc] = useState(false)
  const [rtfToc, setRtfToc] = useState(false)
  const [textbundleAssets, setTextbundleAssets] = useState(true)
  const [htmlInlineStyle, setHtmlInlineStyle] = useState(true)
  const [epubAuthor, setEpubAuthor] = useState('')
  const [epubCover, setEpubCover] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => { setFilename(title || '无标题') }, [title])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fmt = EXPORT_FORMATS.find((f) => f.id === format)!
  const options: ExportOptions = useMemo(() => ({
    format, filename, pngScale, pngTransparent, pdfSize, pdfToc, docxToc, rtfToc,
    txtEncoding: 'UTF-8', textbundleAssets, htmlInlineStyle, epubAuthor, epubCover,
  }), [format, filename, pngScale, pngTransparent, pdfSize, pdfToc, docxToc, rtfToc, textbundleAssets, htmlInlineStyle, epubAuthor, epubCover])

  const doExport = async () => {
    setBusy(true)
    try {
      await runExport(options, getPayload())
      notify(format === 'pdf' ? '已打开打印面板，选择「存储为 PDF」' : `已导出 ${filename || '无标题'}${fmt.ext}`)
      if (format !== 'pdf') onClose()
    } catch (err) {
      notify(`导出失败：${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setBusy(false)
    }
  }

  void markdown

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card export-card">
        <button className="modal-close" onClick={onClose} title="关闭"><Close theme="outline" size="16" /></button>

        <div className="export-preview" style={{ background: theme.appBg }}>
          <FormatPreview format={format} title={filename || title || '无标题'} theme={theme} />
        </div>

        <div className="export-settings">
          <div className="settings-field">
            <div className="settings-field-head"><span>文件名</span></div>
            <input className="text-input" value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="无标题" />
          </div>

          <div className="settings-field">
            <div className="settings-field-head"><span>格式</span></div>
            <div className="format-grid">
              {EXPORT_FORMATS.map((f) => (
                <button key={f.id} className={`format-card${format === f.id ? ' active' : ''}`} onClick={() => setFormat(f.id)}>
                  {ICONS[f.id]}
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="export-options">
            {format === 'png' && (
              <>
                <OptionRow label="分辨率">
                  <Pills options={[{ value: 1 as const, label: '1x' }, { value: 2 as const, label: '2x' }, { value: 3 as const, label: '3x' }]} value={pngScale} onChange={setPngScale} />
                </OptionRow>
                <OptionRow label="背景">
                  <Pills options={[{ value: 'no' as const, label: '不透明' }, { value: 'yes' as const, label: '透明' }]} value={pngTransparent ? 'yes' : 'no'} onChange={(v) => setPngTransparent(v === 'yes')} />
                </OptionRow>
              </>
            )}
            {format === 'pdf' && (
              <>
                <OptionRow label="页面尺寸">
                  <Pills options={[{ value: 'A4' as const, label: 'A4' }, { value: 'A5' as const, label: 'A5' }, { value: 'Letter' as const, label: 'Letter' }]} value={pdfSize} onChange={setPdfSize} />
                </OptionRow>
                <OptionRow label="包含目录">
                  <Pills options={[{ value: 'no' as const, label: '否' }, { value: 'yes' as const, label: '是' }]} value={pdfToc ? 'yes' : 'no'} onChange={(v) => setPdfToc(v === 'yes')} />
                </OptionRow>
              </>
            )}
            {format === 'docx' && (
              <OptionRow label="包含目录">
                <Pills options={[{ value: 'no' as const, label: '否' }, { value: 'yes' as const, label: '是' }]} value={docxToc ? 'yes' : 'no'} onChange={(v) => setDocxToc(v === 'yes')} />
              </OptionRow>
            )}
            {format === 'rtf' && (
              <OptionRow label="包含目录">
                <Pills options={[{ value: 'no' as const, label: '否' }, { value: 'yes' as const, label: '是' }]} value={rtfToc ? 'yes' : 'no'} onChange={(v) => setRtfToc(v === 'yes')} />
              </OptionRow>
            )}
            {format === 'txt' && (
              <OptionRow label="编码">
                <Pills options={[{ value: 'UTF-8' as const, label: 'UTF-8' }, { value: 'GBK' as const, label: 'GBK', disabled: true }]} value="UTF-8" onChange={() => undefined} />
              </OptionRow>
            )}
            {format === 'textbundle' && (
              <OptionRow label="包含附件">
                <Pills options={[{ value: 'no' as const, label: '否' }, { value: 'yes' as const, label: '是' }]} value={textbundleAssets ? 'yes' : 'no'} onChange={(v) => setTextbundleAssets(v === 'yes')} />
              </OptionRow>
            )}
            {format === 'html' && (
              <OptionRow label="样式">
                <Pills options={[{ value: 'no' as const, label: '简洁' }, { value: 'yes' as const, label: '内嵌样式' }]} value={htmlInlineStyle ? 'yes' : 'no'} onChange={(v) => setHtmlInlineStyle(v === 'yes')} />
              </OptionRow>
            )}
            {format === 'epub' && (
              <>
                <OptionRow label="作者">
                  <input className="text-input" placeholder="作者名（可选）" value={epubAuthor} onChange={(e) => setEpubAuthor(e.target.value)} />
                </OptionRow>
                <OptionRow label="生成封面">
                  <Pills options={[{ value: 'no' as const, label: '否' }, { value: 'yes' as const, label: '是' }]} value={epubCover ? 'yes' : 'no'} onChange={(v) => setEpubCover(v === 'yes')} />
                </OptionRow>
              </>
            )}
          </div>

          <button className="primary-btn" disabled={busy} onClick={() => void doExport()}>
            {busy ? '导出中…' : `导出 ${filename || '无标题'}${fmt.ext}`}
          </button>
        </div>
      </div>
    </div>
  )
}
