// 标题栏：标题 / 保存状态 / 详情 / 导出 / 设置
import { CheckOne, Loading, Info, Export, Setting } from '@icon-park/react'
import type { ThemeTokens } from '../data'

interface TitleBarProps {
  title: string
  saving: boolean
  showDetails: boolean
  onToggleDetails: () => void
  onOpenExport: () => void
  onOpenSettings: () => void
  theme: ThemeTokens
}

export default function TitleBar({ title, saving, showDetails, onToggleDetails, onOpenExport, onOpenSettings, theme }: TitleBarProps) {
  return (
    <header className="title-bar">
      <h1 className="title-text" title={title}>{title}</h1>
      <span className={`save-status${saving ? ' saving' : ''}`}>
        {saving
          ? <Loading theme="outline" size="14" spin />
          : <CheckOne theme="outline" size="14" style={{ color: '#34A853' }} />}
        <span>{saving ? '保存中…' : '已保存'}</span>
      </span>
      <span className="title-actions">
        <button
          className={`icon-btn${showDetails ? ' active' : ''}`}
          title={showDetails ? '收起详情面板' : '详情面板'}
          onClick={onToggleDetails}
          style={showDetails ? { background: theme.hover } : undefined}
        >
          <Info theme="outline" size="17" />
        </button>
        <button className="icon-btn" title="导出" onClick={onOpenExport}>
          <Export theme="outline" size="17" />
        </button>
        <button className="icon-btn" title="设置" onClick={onOpenSettings}>
          <Setting theme="outline" size="17" />
        </button>
      </span>
    </header>
  )
}
