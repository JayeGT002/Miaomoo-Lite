// 导出能力：8 种格式，轻量实现（禁止大型渲染引擎）
// PNG=html-to-image / 桌面 PDF=Typst sidecar、Web PDF=window.print / HTML·TXT=字符串
// DOCX·RTF=自写模板 / EPUB·TextBundle=fflate 打包
// 桌面端经 platform.ts 走原生保存对话框 + Rust 写文件；Web 版走浏览器下载
import type { Node as ProseNode } from '@milkdown/prose/model'
import { toPng } from 'html-to-image'
import { strToU8, zipSync } from 'fflate'
import { isDesktop, pickSavePath, saveFileRaw, saveTextBundleRaw, typstCompileRaw, type BundleFile } from './platform'
import { mdToTypst } from './typst'

export type ExportFormat = 'png' | 'docx' | 'pdf' | 'txt' | 'textbundle' | 'rtf' | 'html' | 'epub'

export interface ExportOptions {
  format: ExportFormat
  filename: string
  pngScale: 1 | 2 | 3
  pngTransparent: boolean
  pdfSize: 'A4' | 'A5' | 'Letter'
  pdfToc: boolean
  docxToc: boolean
  rtfToc: boolean
  txtEncoding: 'UTF-8' // GBK 预览版预留
  textbundleAssets: boolean
  htmlInlineStyle: boolean
  epubAuthor: string
  epubCover: boolean
}

export const EXPORT_FORMATS: { id: ExportFormat; name: string; ext: string }[] = [
  { id: 'png', name: 'PNG', ext: '.png' },
  { id: 'docx', name: 'DOCX', ext: '.docx' },
  { id: 'pdf', name: 'PDF', ext: '.pdf' },
  { id: 'txt', name: 'TXT', ext: '.txt' },
  { id: 'textbundle', name: 'TextBundle', ext: '.textbundle' },
  { id: 'rtf', name: 'RTF', ext: '.rtf' },
  { id: 'html', name: 'HTML', ext: '.html' },
  { id: 'epub', name: 'EPUB', ext: '.epub' },
]

export interface ExportPayload {
  title: string
  markdown: string
  doc: ProseNode
  getContentEl: () => HTMLElement | null
}

// ── 文档 IR：从 ProseMirror 文档抽取结构 ──

export interface InlineRun { text: string; strong?: boolean; em?: boolean; code?: boolean; strike?: boolean; underline?: boolean }
export type Block =
  | { kind: 'heading'; level: number; runs: InlineRun[] }
  | { kind: 'para'; runs: InlineRun[]; quote?: boolean }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'hr' }
  | { kind: 'list'; ordered: boolean; items: InlineRun[][] }
  | { kind: 'table'; header: InlineRun[][]; rows: InlineRun[][][] }

function collectRuns(node: ProseNode): InlineRun[] {
  const runs: InlineRun[] = []
  const walk = (n: ProseNode, marks: { strong?: boolean; em?: boolean; code?: boolean; strike?: boolean; underline?: boolean }) => {
    n.forEach((child) => {
      if (child.isText) {
        runs.push({ text: child.text ?? '', ...marks })
      } else if (child.type.name === 'hardbreak') {
        runs.push({ text: '\n' })
      } else if (child.isInline) {
        const next = { ...marks }
        switch (child.type.name) {
          case 'strong': next.strong = true; break
          case 'emphasis': next.em = true; break
          case 'inline-code': next.code = true; break
          case 'strikethrough': next.strike = true; break
          default: break // image/link 等取纯文本
        }
        if (child.type.name === 'link') { walk(child, next) } else { walk(child, next) }
      }
    })
  }
  walk(node, {})
  return runs
}

export function docToBlocks(doc: ProseNode): Block[] {
  const blocks: Block[] = []
  const walk = (node: ProseNode, quote = false) => {
    node.forEach((child) => {
      switch (child.type.name) {
        case 'heading':
          blocks.push({ kind: 'heading', level: child.attrs.level as number, runs: collectRuns(child) })
          break
        case 'paragraph':
          blocks.push({ kind: 'para', runs: collectRuns(child), quote })
          break
        case 'blockquote':
          walk(child, true)
          break
        case 'code-block':
          blocks.push({ kind: 'code', lang: (child.attrs.language as string) || '', text: child.textContent })
          break
        case 'hr':
          blocks.push({ kind: 'hr' })
          break
        case 'bullet-list':
        case 'ordered-list': {
          const items: InlineRun[][] = []
          child.forEach((li) => li.forEach((p) => { if (p.type.name === 'paragraph') items.push(collectRuns(p)) }))
          blocks.push({ kind: 'list', ordered: child.type.name === 'ordered-list', items })
          break
        }
        case 'table': {
          const header: InlineRun[][] = []
          const rows: InlineRun[][][] = []
          child.forEach((row) => {
            const cells: InlineRun[][] = []
            row.forEach((cell) => {
              const runs: InlineRun[] = []
              cell.forEach((p) => { if (p.type.name === 'paragraph') runs.push(...collectRuns(p)) })
              cells.push(runs)
            })
            if (header.length === 0) header.push(...cells)
            else rows.push(cells)
          })
          blocks.push({ kind: 'table', header, rows })
          break
        }
        default: break
      }
    })
  }
  walk(doc)
  return blocks
}

const runText = (runs: InlineRun[]) => runs.map((r) => r.text).join('')

// ── 通用下载 ──

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function downloadBytes(filename: string, data: Uint8Array, mime: string) {
  const copy = new Uint8Array(data.length)
  copy.set(data)
  downloadBlob(filename, new Blob([copy], { type: mime }))
}

// ── TXT ──

function toPlainText(blocks: Block[]): string {
  const out: string[] = []
  for (const b of blocks) {
    switch (b.kind) {
      case 'heading': out.push(`${'#'.repeat(b.level)} ${runText(b.runs)}`); break
      case 'para': out.push(runText(b.runs)); break
      case 'code': out.push(b.text); break
      case 'hr': out.push('――――――――――'); break
      case 'list': b.items.forEach((it, i) => out.push(`${b.ordered ? `${i + 1}.` : '•'} ${runText(it)}`)); break
      case 'table':
        out.push(b.header.map(runText).join('\t'))
        b.rows.forEach((r) => out.push(r.map(runText).join('\t')))
        break
    }
  }
  return out.join('\n\n')
}

// ── HTML ──

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function runsToHtml(runs: InlineRun[]): string {
  return runs.map((r) => {
    let h = escHtml(r.text).replace(/\n/g, '<br/>')
    if (r.code) h = `<code>${h}</code>`
    if (r.strong) h = `<strong>${h}</strong>`
    if (r.em) h = `<em>${h}</em>`
    if (r.strike) h = `<del>${h}</del>`
    if (r.underline) h = `<u>${h}</u>`
    return h
  }).join('')
}

function toHtmlBody(blocks: Block[], toc: Block[] | null, withIds: boolean): string {
  const out: string[] = []
  if (toc) {
    out.push('<nav class="toc"><h2>目录</h2><ol>')
    for (const b of toc) if (b.kind === 'heading') out.push(`<li class="lvl-${b.level}"><a href="#h-${b.level}">${escHtml(runText(b.runs))}</a></li>`)
    out.push('</ol></nav>')
  }
  let headingIdx = 0
  for (const b of blocks) {
    switch (b.kind) {
      case 'heading': {
        headingIdx++
        const id = withIds ? ` id="h-${headingIdx}"` : ''
        out.push(`<h${b.level}${id}>${runsToHtml(b.runs)}</h${b.level}>`)
        break
      }
      case 'para': out.push(`<p${b.quote ? ' class="quote"' : ''}>${runsToHtml(b.runs)}</p>`); break
      case 'code': out.push(`<pre><code>${escHtml(b.text)}</code></pre>`); break
      case 'hr': out.push('<hr/>'); break
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul'
        out.push(`<${tag}>${b.items.map((it) => `<li>${runsToHtml(it)}</li>`).join('')}</${tag}>`)
        break
      }
      case 'table':
        out.push('<table><thead><tr>')
        b.header.forEach((c) => out.push(`<th>${runsToHtml(c)}</th>`))
        out.push('</tr></thead><tbody>')
        b.rows.forEach((r) => { out.push('<tr>'); r.forEach((c) => out.push(`<td>${runsToHtml(c)}</td>`)); out.push('</tr>') })
        out.push('</tbody></table>')
        break
    }
  }
  return out.join('\n')
}

const HTML_CSS = `body{max-width:720px;margin:40px auto;padding:0 24px;font:16px/1.8 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#1d1d1f}
h1,h2,h3,h4,h5{line-height:1.4;margin:1.4em 0 .6em}h1{font-size:1.8em}p{margin:.8em 0}
pre{background:#f5f5f4;padding:14px 16px;border-radius:8px;overflow:auto}code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9em}
blockquote{margin:.8em 0;padding:.2em 1em;border-left:3px solid #d0d0ce;color:#666}
table{border-collapse:collapse;margin:1em 0}th,td{border:1px solid #d0d0ce;padding:6px 12px;text-align:left}th{background:#f5f5f4}
hr{border:none;border-top:1px solid #d0d0ce;margin:2em 0}.toc{background:#f7f7f5;border-radius:8px;padding:12px 20px}.toc ol{padding-left:1.2em}.toc .lvl-3{margin-left:1em}`

function toHtmlDoc(title: string, body: string, inlineStyle: boolean): string {
  const style = inlineStyle ? `\n<style>${HTML_CSS}</style>` : ''
  return `<!doctype html>\n<html lang="zh">\n<head>\n<meta charset="utf-8"/>\n<meta name="viewport" content="width=device-width,initial-scale=1"/>\n<title>${escHtml(title)}</title>${style}\n</head>\n<body>\n${body}\n</body>\n</html>`
}

// ── RTF ──

const rtfEsc = (s: string) => s.split('').map((ch) => {
  const c = ch.charCodeAt(0)
  if (ch === '\\' || ch === '{' || ch === '}') return `\\${ch}`
  if (c < 128) return ch
  return `\\u${c >= 0x8000 ? c - 0x10000 : c}?`
}).join('')

function runsToRtf(runs: InlineRun[]): string {
  return runs.map((r) => {
    let h = rtfEsc(r.text).replace(/\n/g, '\\line ')
    let pre = '', post = ''
    if (r.code) { pre += '\\f1'; post = '\\f0' + post }
    if (r.strong) { pre += '\\b'; post = '\\b0' + post }
    if (r.em) { pre += '\\i'; post = '\\i0' + post }
    if (r.strike) { pre += '\\strike'; post = '\\strike0' + post }
    if (r.underline) { pre += '\\ul'; post = '\\ulnone' + post }
    return `{${pre}${h}${post}}`
  }).join('')
}

const RTF_HEADINGS: Record<number, number> = { 1: 40, 2: 34, 3: 28, 4: 24, 5: 22, 6: 21, 7: 21, 8: 21 }

function toRtf(blocks: Block[], title: string, toc: boolean): string {
  const par: string[] = []
  const push = (text: string, opts = '') => par.push(`\\pard${opts}\\sa200 ${text}\\par`)
  if (toc) {
    push(`\\b\\fs28 ${rtfEsc('目录')}`)
    for (const b of blocks) if (b.kind === 'heading') push(`${rtfEsc('  '.repeat(Math.max(0, b.level - 1)))}${runsToRtf(b.runs)}`)
    push('')
  }
  for (const b of blocks) {
    switch (b.kind) {
      case 'heading': push(runsToRtf(b.runs), `\\b\\fs${RTF_HEADINGS[b.level] ?? 21}\\sa240\\keepn`); break
      case 'para': push(runsToRtf(b.runs), b.quote ? '\\li600\\sa200' : ''); break
      case 'code': b.text.split('\n').forEach((l) => push(`{\\f1 ${rtfEsc(l)}}`, '\\sa0\\sb0\\li200\\f1')); break
      case 'hr': push('\\brdrb\\brdrs\\brdrw10\\brsp20 ', '\\sa240'); break
      case 'list': b.items.forEach((it, i) => push(`${b.ordered ? `${i + 1}. ` : '\\bullet  '}${runsToRtf(it)}`, '\\li360\\fi-360')); break
      case 'table': {
        // 简化表格：以制表符分隔
        push(b.header.map((c) => runsToRtf(c)).join('\\tab '), '\\b')
        b.rows.forEach((r) => push(r.map((c) => runsToRtf(c)).join('\\tab ')))
        break
      }
    }
  }
  return `{\\rtf1\\ansi\\ansicpg65001\\deff0{\\fonttbl{\\f0 -apple-system;}{\\f1 Menlo;}}\n{\\info{\\title ${rtfEsc(title)}}}\n${par.join('\n')}\n}`
}

// ── DOCX（最小 OOXML） ──

const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

function runsToDocx(runs: InlineRun[]): string {
  return runs.map((r) => {
    const props: string[] = []
    if (r.strong) props.push('<w:b/>')
    if (r.em) props.push('<w:i/>')
    if (r.strike) props.push('<w:strike/>')
    if (r.underline) props.push('<w:u w:val="single"/>')
    if (r.code) props.push('<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:shd w:val="clear" w:fill="F2F2F0"/>')
    const text = escXml(r.text).replace(/\n/g, '</w:t><w:br/><w:t xml:space="preserve">')
    return `<w:r>${props.length ? `<w:rPr>${props.join('')}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`
  }).join('')
}

const DOCX_HEADINGS: Record<number, number> = { 1: 40, 2: 32, 3: 28, 4: 25, 5: 22, 6: 21, 7: 21, 8: 21 }

function docxParagraph(runsXml: string, opts: { heading?: number; quote?: boolean; code?: boolean; bold?: boolean; indent?: number; hanging?: boolean } = {}): string {
  const pPr: string[] = []
  const rPr: string[] = []
  if (opts.heading) { pPr.push(`<w:outlineLvl w:val="${Math.min(8, opts.heading) - 1}"/>`); rPr.push(`<w:b/><w:sz w:val="${DOCX_HEADINGS[opts.heading] ?? 21}"/>`) }
  if (opts.quote) { pPr.push('<w:ind w:left="600"/>'); rPr.push('<w:i/>') }
  if (opts.code) { pPr.push('<w:ind w:left="200"/>'); rPr.push('<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>') }
  if (opts.bold) rPr.push('<w:b/>')
  if (opts.indent) pPr.push(`<w:ind w:left="${opts.indent}"${opts.hanging ? ' w:hanging="360"' : ''}/>`)
  return `<w:p><w:pPr>${pPr.join('')}${rPr.length ? `<w:rPr>${rPr.join('')}</w:rPr>` : ''}</w:pPr>${runsXml}</w:p>`
}

function toDocxXml(blocks: Block[], title: string, toc: boolean): string {
  const body: string[] = []
  body.push(docxParagraph(`<w:r><w:rPr><w:b/><w:sz w:val="44"/></w:rPr><w:t xml:space="preserve">${escXml(title)}</w:t></w:r>`))
  if (toc) {
    body.push(docxParagraph(`<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">目录</w:t></w:r>`, { bold: true }))
    for (const b of blocks) if (b.kind === 'heading') body.push(docxParagraph(runsToDocx(b.runs), { indent: 360 * b.level }))
  }
  for (const b of blocks) {
    switch (b.kind) {
      case 'heading': body.push(docxParagraph(runsToDocx(b.runs), { heading: b.level })); break
      case 'para': body.push(docxParagraph(runsToDocx(b.runs), { quote: b.quote })); break
      case 'code': b.text.split('\n').forEach((l) => body.push(docxParagraph(`<w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/></w:rPr><w:t xml:space="preserve">${escXml(l)}</w:t></w:r>`, { code: true }))); break
      case 'hr': body.push(docxParagraph('<w:r><w:t xml:space="preserve">――――――――――――</w:t></w:r>', { quote: true })); break
      case 'list': b.items.forEach((it, i) => body.push(docxParagraph(`<w:r><w:t xml:space="preserve">${b.ordered ? `${i + 1}. ` : '• '}</w:t></w:r>${runsToDocx(it)}`, { indent: 480, hanging: true }))); break
      case 'table': {
        const cols = Math.max(b.header.length, ...b.rows.map((r) => r.length))
        const cell = (runs: InlineRun[], header: boolean) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${docxParagraph(header ? `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escXml(runText(runs))}</w:t></w:r>` : `<w:r><w:t xml:space="preserve">${escXml(runText(runs))}</w:t></w:r>`)}</w:tc>`
        const borders = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="4" w:color="D0D0CE"/>`).join('') + '</w:tblBorders>'
        body.push(`<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${borders}</w:tblPr><w:tblGrid>${'<w:gridCol/>'.repeat(cols)}</w:tblGrid>`)
        body.push(`<w:tr>${b.header.map((c) => cell(c, true)).join('')}</w:tr>`)
        b.rows.forEach((r) => body.push(`<w:tr>${r.map((c) => cell(c, false)).join('')}</w:tr>`))
        body.push('</w:tbl>')
        break
      }
    }
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`
}

function buildDocx(blocks: Block[], title: string, toc: boolean): Uint8Array {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  return zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rels),
    'word/document.xml': strToU8(toDocxXml(blocks, title, toc)),
  })
}

// ── EPUB 3（最小结构） ──

function buildEpub(blocks: Block[], title: string, author: string, withCover: boolean): Uint8Array {
  const uid = `urn:uuid:${crypto.randomUUID()}`
  const body = toHtmlBody(blocks, null, true)
  const chapter = `<?xml version="1.0" encoding="utf-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh"><head><title>${escXml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>${body}</body></html>`
  const tocItems: string[] = []
  let i = 0
  for (const b of blocks) if (b.kind === 'heading') { i++; tocItems.push(`<li><a href="chapter1.xhtml#h-${i}">${escXml(runText(b.runs))}</a></li>`) }
  const nav = `<?xml version="1.0" encoding="utf-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh"><head><title>目录</title></head><body><nav epub:type="toc" id="toc"><h1>目录</h1><ol>${tocItems.join('')}</ol></nav></body></html>`
  const manifest = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>',
    '<item id="css" href="style.css" media-type="text/css"/>',
    ...(withCover ? ['<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>'] : []),
  ]
  const spine = [...(withCover ? ['<itemref idref="cover"/>'] : []), '<itemref idref="chapter1"/>']
  const opf = `<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="pub-id">${escXml(uid)}</dc:identifier><dc:title>${escXml(title)}</dc:title><dc:creator>${escXml(author || 'Miaomoo Lite')}</dc:creator><dc:language>zh</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata><manifest>${manifest.join('')}</manifest><spine>${spine.join('')}</spine></package>`
  const container = `<?xml version="1.0" encoding="utf-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
  const cover = `<?xml version="1.0" encoding="utf-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" lang="zh"><head><title>封面</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#f6f6f4;font-family:-apple-system,"PingFang SC",sans-serif}h1{font-size:2em;color:#26262a}</style></head><body><h1>${escXml(title)}</h1></body></html>`
  const css = HTML_CSS.replace('body{max-width:720px;margin:40px auto;padding:0 24px;', 'body{max-width:600px;margin:0 24px;padding:2em 0;')
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
    'META-INF/container.xml': strToU8(container),
    'OEBPS/content.opf': strToU8(opf),
    'OEBPS/nav.xhtml': strToU8(nav),
    'OEBPS/chapter1.xhtml': strToU8(chapter),
    'OEBPS/style.css': strToU8(css),
  }
  if (withCover) files['OEBPS/cover.xhtml'] = strToU8(cover)
  return zipSync(files)
}

// ── TextBundle ──

function buildTextBundleFiles(markdown: string, withAssets: boolean): BundleFile[] {
  const files: BundleFile[] = [
    { name: 'info.json', data: strToU8(JSON.stringify({ version: 2, type: 'net.daringfireball.markdown', creatorIdentifier: 'com.miaomoo.lite', creatorURL: 'https://github.com/JayeGT002/Miaomoo-Lite', transient: false }, null, 2)) },
  ]
  let md = markdown
  if (withAssets) {
    const dataUri = /!\[([^\]]*)\]\((data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,([A-Za-z0-9+/=]+))\)/g
    let m: RegExpExecArray | null
    let idx = 0
    while ((m = dataUri.exec(md)) !== null) {
      idx++
      const ext = m[3] === 'jpeg' ? 'jpg' : m[3].replace('svg+xml', 'svg')
      const name = `assets/image-${idx}.${ext}`
      files.push({ name, data: Uint8Array.from(atob(m[4]), (c) => c.charCodeAt(0)) })
      md = md.replace(m[0], m[0].replace(`(${m[2]})`, `(${name})`))
    }
  }
  files.push({ name: 'text.md', data: strToU8(md) })
  return files
}

function buildTextBundleZip(markdown: string, withAssets: boolean): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  for (const f of buildTextBundleFiles(markdown, withAssets)) entries[f.name] = f.data
  return zipSync(entries)
}

// ── PDF（window.print） ──

function printPdf(size: 'A4' | 'A5' | 'Letter') {
  const style = document.createElement('style')
  style.id = 'miaomoo-print-style'
  style.textContent = `@page { size: ${size}; margin: 18mm; }`
  document.head.appendChild(style)
  document.documentElement.classList.add('print-export')
  const cleanup = () => {
    document.documentElement.classList.remove('print-export')
    document.getElementById('miaomoo-print-style')?.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
  // Safari 兜底：某些环境不触发 afterprint
  setTimeout(() => { if (document.documentElement.classList.contains('print-export')) cleanup() }, 60_000)
}

// ── 入口 ──

/** 桌面端：原生保存对话框 + Rust 写文件；返回 false 表示用户取消 */
async function exportViaDialog(base: string, ext: string, data: Uint8Array | string): Promise<boolean> {
  const path = await pickSavePath(base, ext)
  if (!path) return false
  await saveFileRaw(path, data)
  return true
}

/** 返回 true=已导出（或已打开打印），false=用户在保存对话框取消 */
export async function runExport(opts: ExportOptions, payload: ExportPayload): Promise<boolean> {
  const { format, filename } = opts
  const blocks = docToBlocks(payload.doc)
  const base = filename || '无标题'
  const desktop = isDesktop()
  switch (format) {
    case 'txt': {
      const text = toPlainText(blocks)
      if (desktop) return exportViaDialog(`${base}.txt`, '.txt', `\ufeff${text}`)
      downloadBlob(`${base}.txt`, new Blob([`\ufeff${text}`], { type: 'text/plain;charset=utf-8' }))
      return true
    }
    case 'html': {
      const body = toHtmlBody(blocks, null, false)
      const html = toHtmlDoc(payload.title || base, body, opts.htmlInlineStyle)
      if (desktop) return exportViaDialog(`${base}.html`, '.html', html)
      downloadBlob(`${base}.html`, new Blob([html], { type: 'text/html;charset=utf-8' }))
      return true
    }
    case 'rtf': {
      const rtf = toRtf(blocks, payload.title || base, opts.rtfToc)
      if (desktop) return exportViaDialog(`${base}.rtf`, '.rtf', strToU8(rtf))
      downloadBytes(`${base}.rtf`, strToU8(rtf), 'application/rtf')
      return true
    }
    case 'docx': {
      const bytes = buildDocx(blocks, payload.title || base, opts.docxToc)
      if (desktop) return exportViaDialog(`${base}.docx`, '.docx', bytes)
      downloadBytes(`${base}.docx`, bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      return true
    }
    case 'epub': {
      const bytes = buildEpub(blocks, payload.title || base, opts.epubAuthor, opts.epubCover)
      if (desktop) return exportViaDialog(`${base}.epub`, '.epub', bytes)
      downloadBytes(`${base}.epub`, bytes, 'application/epub+zip')
      return true
    }
    case 'textbundle': {
      if (desktop) {
        // .textbundle 本质是有序文件夹，桌面端直接写目录结构
        const path = await pickSavePath(`${base}.textbundle`, '.textbundle')
        if (!path) return false
        await saveTextBundleRaw(path, buildTextBundleFiles(payload.markdown, opts.textbundleAssets))
        return true
      }
      downloadBytes(`${base}.textbundle`, buildTextBundleZip(payload.markdown, opts.textbundleAssets), 'application/octet-stream')
      return true
    }
    case 'png': {
      const el = payload.getContentEl()
      if (!el) throw new Error('未找到编辑内容区域')
      const dataUrl = await toPng(el, { pixelRatio: opts.pngScale, ...(opts.pngTransparent ? {} : { backgroundColor: getComputedStyle(el).backgroundColor || '#ffffff' }) })
      const bytes = new Uint8Array(await (await fetch(dataUrl)).arrayBuffer())
      if (desktop) return exportViaDialog(`${base}.png`, '.png', bytes)
      downloadBytes(`${base}.png`, bytes, 'image/png')
      return true
    }
    case 'pdf': {
      if (desktop) {
        const path = await pickSavePath(`${base}.pdf`, '.pdf')
        if (!path) return false
        try {
          await typstCompileRaw(mdToTypst(blocks, payload.title || base, opts.pdfSize, opts.pdfToc), path, opts.pdfSize)
          return true
        } catch (err) {
          // sidecar 不可用时兜底系统打印
          printPdf(opts.pdfSize)
          throw new Error(`Typst 编译失败（${err instanceof Error ? err.message : '未知原因'}），已打开打印面板兜底`)
        }
      }
      printPdf(opts.pdfSize)
      return true
    }
  }
}
