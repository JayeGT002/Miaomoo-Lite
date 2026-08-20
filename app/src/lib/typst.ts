// Markdown IR → Typst 源码转换（桌面端 PDF 导出走 Typst sidecar）
import type { Block, InlineRun } from './exporters'

// Typst 特殊字符转义（含中文引号外的 ASCII 特殊符号）
const TYPOPT_SPECIAL = /([\\#*_`\[\]$~@"'%\-+<>=|:])/g

function escTypst(text: string): string {
  return text.replace(TYPOPT_SPECIAL, '\\$1')
}

function runsToTypst(runs: InlineRun[]): string {
  return runs
    .map((r) => {
      if (r.text === '\n') return '\\ '
      let t = escTypst(r.text)
      if (r.code) t = `#raw("${t.replace(/"/g, '\\"')}")`
      if (r.underline) t = `#underline[${t}]`
      if (r.strike) t = `#strike[${t}]`
      if (r.em) t = `_${t}_`
      if (r.strong) t = `*${t}*`
      return t
    })
    .join('')
}

const PAPER: Record<string, string> = { A4: 'a4', A5: 'a5', Letter: 'us-letter' }

export function mdToTypst(blocks: Block[], title: string, paper: string, toc: boolean): string {
  const out: string[] = []
  out.push(`#set page(paper: "${PAPER[paper] ?? 'a4'}", margin: (x: 18mm, y: 20mm), numbering: "1")`)
  out.push('#set text(font: ("New Computer Modern", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC"), lang: "zh", size: 11pt)')
  out.push('#set heading(numbering: none)')
  out.push('#show heading.where(level: 1): it => { align(center, text(size: 20pt, weight: "bold", it.body)); v(0.6em) }')
  out.push('#set par(leading: 0.9em, justify: true)')

  // 标题页眉
  out.push(`#align(center)[#text(size: 20pt, weight: "bold")[${escTypst(title)}]]`)
  out.push('#v(1.2em)')

  if (toc) {
    out.push('#outline(title: "目录", depth: 3)')
    out.push('#pagebreak()')
  }

  const headings = blocks.filter((b) => b.kind === 'heading').length
  if (headings > 0 && !toc) out.push('')

  for (const b of blocks) {
    switch (b.kind) {
      case 'heading': {
        const mark = '='.repeat(Math.min(6, b.level))
        out.push(`${mark} ${runsToTypst(b.runs)}`)
        break
      }
      case 'para':
        if (b.quote) out.push(`#quote(block: true)[${runsToTypst(b.runs)}]`)
        else out.push(runsToTypst(b.runs))
        out.push('')
        break
      case 'code':
        out.push('```' + (b.lang || ''))
        out.push(b.text)
        out.push('```')
        out.push('')
        break
      case 'hr':
        out.push('#line(length: 100%)')
        out.push('')
        break
      case 'list': {
        b.items.forEach((it) => {
          out.push(b.ordered ? `+ ${runsToTypst(it)}` : `- ${runsToTypst(it)}`)
        })
        out.push('')
        break
      }
      case 'table': {
        const cols = Math.max(b.header.length, ...b.rows.map((r) => r.length), 1)
        out.push(`#table(`)
        out.push(`  columns: (${'auto, '.repeat(cols).trimEnd().replace(/,$/, '')}),`)
        out.push(`  inset: 6pt,`)
        out.push(`  align: left + horizon,`)
        out.push(`  table.header(${b.header.map((c) => `[*${runsToTypst(c) || '~'}*]`).join(', ')}),`)
        b.rows.forEach((r) => {
          const cells: string[] = []
          // 空单元格用 ~（不断行空格）占位，保证占据一行行高
          for (let i = 0; i < cols; i++) cells.push(`[${runsToTypst(r[i] ?? []) || '~'}]`)
          out.push(`  ${cells.join(', ')},`)
        })
        out.push(`)`)
        out.push('')
        break
      }
    }
  }
  return out.join('\n')
}
