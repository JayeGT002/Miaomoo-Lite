// 详情面板：统计 / 大纲
import { useState } from 'react'
import { DocDetail, MindmapList, H1, H2, H3, LevelFourTitle, LevelFiveTitle, LevelSixTitle, LevelSevenTitle, LevelEightTitle } from '@icon-park/react'
import type { OutlineItem, Stats } from '../lib/model'
import { formatDateTime } from '../lib/model'

interface DetailsPanelProps {
  stats: Stats
  outline: OutlineItem[]
  createdAt: number
  updatedAt: number
  onJump: (pos: number) => void
}

const LEVEL_ICONS = [H1, H2, H3, LevelFourTitle, LevelFiveTitle, LevelSixTitle, LevelSevenTitle, LevelEightTitle]

export default function DetailsPanel({ stats, outline, createdAt, updatedAt, onJump }: DetailsPanelProps) {
  const [tab, setTab] = useState<'stats' | 'outline'>('stats')

  return (
    <aside className="details-panel">
      <div className="details-tabs">
        <button className={`details-tab${tab === 'stats' ? ' active' : ''}`} onClick={() => setTab('stats')}>
          <DocDetail theme="outline" size="15" /><span>统计</span>
        </button>
        <button className={`details-tab${tab === 'outline' ? ' active' : ''}`} onClick={() => setTab('outline')}>
          <MindmapList theme="outline" size="15" /><span>大纲</span>
        </button>
      </div>

      {tab === 'stats' ? (
        <div className="details-body">
          <div className="stat-row"><span className="stat-label">字数</span><span className="stat-value">{stats.words.toLocaleString()}</span></div>
          <div className="stat-row"><span className="stat-label">字符（不含空白）</span><span className="stat-value">{stats.chars.toLocaleString()}</span></div>
          <div className="stat-row"><span className="stat-label">阅读时长</span><span className="stat-value">{stats.words === 0 ? '—' : `${stats.readingMinutes} 分钟`}</span></div>
          <div className="stat-row"><span className="stat-label">输入速度</span><span className="stat-value">{stats.inputSpeed > 0 ? `${stats.inputSpeed} 字/分钟` : '—'}</span></div>
          <div className="stat-row"><span className="stat-label">创建日期</span><span className="stat-value">{formatDateTime(createdAt)}</span></div>
          <div className="stat-row"><span className="stat-label">编辑日期</span><span className="stat-value">{formatDateTime(updatedAt)}</span></div>
        </div>
      ) : (
        <div className="details-body outline">
          {outline.length === 0 ? (
            <p className="outline-empty">暂无标题<br />输入「# 」开始创建一级标题</p>
          ) : (
            outline.map((item, i) => {
              const Icon = LEVEL_ICONS[Math.min(item.level, 8) - 1]
              return (
                <button
                  key={`${item.pos}-${i}`}
                  className="outline-item"
                  style={{ paddingLeft: 10 + (item.level - 1) * 14 }}
                  onClick={() => onJump(item.pos)}
                  title={item.text}
                >
                  <Icon theme="outline" size="14" />
                  <span className="outline-text">{item.text}</span>
                </button>
              )
            })
          )}
        </div>
      )}
    </aside>
  )
}
