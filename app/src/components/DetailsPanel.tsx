// 详情面板：统计 / 大纲（对照原型：全项图标 + H1/H2/H3 徽标大纲）
import { useState } from 'react'
import { ChartLine, MindmapList, Text as TextIcon, Asterisk, History, SpeedOne, CalendarThree, EditTwo } from '@icon-park/react'
import type { OutlineItem, Stats } from '../lib/model'
import { formatDateTime } from '../lib/model'

interface DetailsPanelProps {
  stats: Stats
  outline: OutlineItem[]
  createdAt: number
  updatedAt: number
  onJump: (pos: number) => void
}

/** 标题层级徽标：与原型一致的小号 H1/H2/H3 字标，杜绝 icon 图标字形歧义 */
function HeadingBadge({ level }: { level: number }) {
  return <span className={`heading-badge${level > 3 ? ' deep' : ''}`}>H{level}</span>
}

export default function DetailsPanel({ stats, outline, createdAt, updatedAt, onJump }: DetailsPanelProps) {
  const [tab, setTab] = useState<'stats' | 'outline'>('stats')

  const statRows: { icon: React.ReactNode; label: string; value: string }[] = [
    { icon: <TextIcon theme="outline" size="14" />, label: '字数', value: stats.words.toLocaleString() },
    { icon: <Asterisk theme="outline" size="14" />, label: '字符', value: stats.chars.toLocaleString() },
    { icon: <History theme="outline" size="14" />, label: '阅读时长', value: stats.words === 0 ? '—' : `约 ${stats.readingMinutes} 分钟` },
    { icon: <SpeedOne theme="outline" size="14" />, label: '输入速度', value: `${stats.inputSpeed} 字/分钟` },
    { icon: <CalendarThree theme="outline" size="14" />, label: '创建日期', value: formatDateTime(createdAt) },
    { icon: <EditTwo theme="outline" size="14" />, label: '编辑日期', value: formatDateTime(updatedAt) },
  ]

  return (
    <aside className="details-panel">
      <div className="details-tabs">
        <button className={`details-tab${tab === 'stats' ? ' active' : ''}`} onClick={() => setTab('stats')}>
          <ChartLine theme="outline" size="15" /><span>统计</span>
        </button>
        <button className={`details-tab${tab === 'outline' ? ' active' : ''}`} onClick={() => setTab('outline')}>
          <MindmapList theme="outline" size="15" /><span>大纲</span>
        </button>
      </div>

      {tab === 'stats' ? (
        <div className="details-body">
          {statRows.map((row) => (
            <div key={row.label} className="stat-row">
              <span className="stat-label">{row.icon}{row.label}</span>
              <span className="stat-value">{row.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="details-body outline">
          {outline.length === 0 ? (
            <p className="outline-empty">暂无标题<br />输入「# 」开始创建一级标题</p>
          ) : (
            outline.map((item, i) => (
              <button
                key={`${item.pos}-${i}`}
                className="outline-item"
                style={{ paddingLeft: 8 + (item.level - 1) * 14 }}
                onClick={() => onJump(item.pos)}
                title={item.text}
              >
                <HeadingBadge level={item.level} />
                <span className="outline-text">{item.text}</span>
              </button>
            ))
          )}
        </div>
      )}
    </aside>
  )
}
