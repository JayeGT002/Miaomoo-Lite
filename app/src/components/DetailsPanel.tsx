// 详情面板：统计 / 大纲（对照原型：分段式切换 + iconpark 全项图标 + H1~H5 层级缩进）
import { useState } from 'react'
import {
  ChartLine, MindmapList, Text as TextIcon, Asterisk, History, SpeedOne, CalendarThree, EditTwo,
  H1, H2, H3, LevelFourTitle, LevelFiveTitle,
} from '@icon-park/react'
import type { OutlineItem, Stats } from '../lib/model'
import { formatDateTime } from '../lib/model'

interface DetailsPanelProps {
  stats: Stats
  outline: OutlineItem[]
  createdAt: number
  updatedAt: number
  onJump: (pos: number) => void
}

// 标题层级图标：与原型一致使用 iconpark H1~H5 线性图标
function HeadingIcon({ level }: { level: number }) {
  const props = { theme: 'outline', size: '13', strokeWidth: 3 } as const
  if (level >= 5) return <LevelFiveTitle {...props} />
  if (level === 4) return <LevelFourTitle {...props} />
  if (level === 3) return <H3 {...props} />
  if (level === 2) return <H2 {...props} />
  return <H1 {...props} />
}

export default function DetailsPanel({ stats, outline, createdAt, updatedAt, onJump }: DetailsPanelProps) {
  const [tab, setTab] = useState<'stats' | 'outline'>('stats')

  const statRows: { icon: React.ReactNode; label: string; value: string }[] = [
    { icon: <TextIcon theme="outline" size="15" />, label: '字数', value: stats.words.toLocaleString() },
    { icon: <Asterisk theme="outline" size="15" />, label: '字符', value: stats.chars.toLocaleString() },
    { icon: <History theme="outline" size="15" />, label: '阅读时长', value: stats.words === 0 ? '—' : `约 ${stats.readingMinutes} 分钟` },
    { icon: <SpeedOne theme="outline" size="15" />, label: '输入速度', value: `${stats.inputSpeed} 字/分钟` },
    { icon: <CalendarThree theme="outline" size="15" />, label: '创建日期', value: formatDateTime(createdAt) },
    { icon: <EditTwo theme="outline" size="15" />, label: '编辑日期', value: formatDateTime(updatedAt) },
  ]

  return (
    <aside className="details-panel">
      <div className="details-tabs">
        <div className="details-seg">
          <button className={`details-tab${tab === 'stats' ? ' active' : ''}`} onClick={() => setTab('stats')}>
            <ChartLine theme="outline" size="14" /><span>统计</span>
          </button>
          <button className={`details-tab${tab === 'outline' ? ' active' : ''}`} onClick={() => setTab('outline')}>
            <MindmapList theme="outline" size="14" /><span>大纲</span>
          </button>
        </div>
      </div>

      {tab === 'stats' ? (
        <div className="details-body">
          {statRows.map((row) => (
            <div key={row.label} className="stat-row">
              <span className="stat-ic">{row.icon}</span>
              <span className="stat-label">{row.label}</span>
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
                style={{ paddingLeft: 10 + (Math.min(item.level, 5) - 1) * 16 }}
                onClick={() => onJump(item.pos)}
                title={item.text}
              >
                <span className="outline-ic"><HeadingIcon level={item.level} /></span>
                <span className="outline-text">{item.text}</span>
              </button>
            ))
          )}
        </div>
      )}
    </aside>
  )
}
