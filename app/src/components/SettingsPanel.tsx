// 设置面板：编辑器 / 字体 / 主题 / 关于
import { useEffect, useState } from 'react'
import { Edit, Text, Theme, Info, Close } from '@icon-park/react'
import { BODY_FONTS, CODE_FONTS, THEMES, bodyFontStack, codeFontStack, type EditorSettings } from '../data'

interface SettingsPanelProps {
  settings: EditorSettings
  onChange: (patch: Partial<EditorSettings>) => void
  onClose: () => void
}

type NavId = 'editor' | 'font' | 'theme' | 'about'

const NAV: { id: NavId; name: string; icon: React.ReactNode }[] = [
  { id: 'editor', name: '编辑器', icon: <Edit theme="outline" size="16" /> },
  { id: 'font', name: '字体', icon: <Text theme="outline" size="16" /> },
  { id: 'theme', name: '主题', icon: <Theme theme="outline" size="16" /> },
  { id: 'about', name: '关于', icon: <Info theme="outline" size="16" /> },
]

function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="settings-field">
      <div className="settings-field-head">
        <span>{label}</span>
        <span className="settings-value">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

function Segmented<T extends string | number>({ options, value, onChange }: {
  options: { value: T; label: string; disabled?: boolean }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={String(o.value)} disabled={o.disabled} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}{o.disabled ? '（即将支持）' : ''}
        </button>
      ))}
    </div>
  )
}

export default function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  const [nav, setNav] = useState<NavId>('editor')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card settings-card">
        <button className="modal-close" onClick={onClose} title="关闭"><Close theme="outline" size="16" /></button>
        <nav className="settings-nav">
          {NAV.map((n) => (
            <button key={n.id} className={`settings-nav-item${nav === n.id ? ' active' : ''}`} onClick={() => setNav(n.id)}>
              {n.icon}<span>{n.name}</span>
            </button>
          ))}
        </nav>

        <div className="settings-detail">
          {nav === 'editor' && (
            <>
              <Slider label="字体大小" value={settings.fontSize} min={14} max={22} step={1} unit=" px" onChange={(v) => onChange({ fontSize: v })} />
              <Slider label="行高" value={settings.lineHeight} min={1.4} max={2.2} step={0.1} onChange={(v) => onChange({ lineHeight: v })} />
              <Slider label="行宽" value={settings.lineWidth} min={520} max={860} step={10} unit=" px" onChange={(v) => onChange({ lineWidth: v })} />
              <Slider label="段落间距" value={settings.paragraphSpacing} min={0.3} max={1.6} step={0.1} unit=" em" onChange={(v) => onChange({ paragraphSpacing: v })} />
              <div className="settings-field">
                <div className="settings-field-head"><span>段落缩进</span></div>
                <Segmented
                  options={[{ value: 'none', label: '无' }, { value: '2char', label: '2 字符' }]}
                  value={settings.paragraphIndent}
                  onChange={(v) => onChange({ paragraphIndent: v })}
                />
              </div>
              <div className="settings-field">
                <div className="settings-field-head">
                  <span>打字机模式</span>
                  <span className="settings-value">{settings.typewriter ? '已开启' : '已关闭'}</span>
                </div>
                <button
                  className={`switch${settings.typewriter ? ' on' : ''}`}
                  role="switch"
                  aria-checked={settings.typewriter}
                  onClick={() => onChange({ typewriter: !settings.typewriter })}
                >
                  <span className="switch-knob" />
                </button>
              </div>
            </>
          )}

          {nav === 'font' && (
            <>
              <div className="settings-field">
                <div className="settings-field-head"><span>正文字体</span></div>
                <div className="font-grid">
                  {BODY_FONTS.map((f) => (
                    <button
                      key={f.id}
                      className={`font-card${settings.fontId === f.id && !settings.customFont ? ' active' : ''}`}
                      style={{ fontFamily: f.stack }}
                      onClick={() => onChange({ fontId: f.id })}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
                <input
                  className="text-input"
                  placeholder="自定义字体名（优先生效，如「霞鹜文楷」）"
                  value={settings.customFont}
                  onChange={(e) => onChange({ customFont: e.target.value })}
                />
              </div>
              <div className="settings-field">
                <div className="settings-field-head"><span>代码块字体</span></div>
                <div className="font-grid">
                  {CODE_FONTS.map((f) => (
                    <button
                      key={f.id}
                      className={`font-card mono${settings.codeFontId === f.id && !settings.customCodeFont ? ' active' : ''}`}
                      style={{ fontFamily: f.stack }}
                      onClick={() => onChange({ codeFontId: f.id })}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
                <input
                  className="text-input mono"
                  placeholder="自定义代码字体名"
                  value={settings.customCodeFont}
                  onChange={(e) => onChange({ customCodeFont: e.target.value })}
                />
              </div>
              <div className="font-preview" style={{ fontFamily: bodyFontStack(settings) }}>
                <p style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight }}>
                  山间明月，江上清风 —— 正文预览 The quick brown fox 0123456789
                </p>
                <pre style={{ fontFamily: codeFontStack(settings) }}>{'const note = "Miaomoo Lite";'}</pre>
              </div>
            </>
          )}

          {nav === 'theme' && (
            <div className="theme-groups">
              {(['冷色调', '莫兰迪色', '暗色模式'] as const).map((group) => (
                <div key={group} className="settings-field">
                  <div className="settings-field-head"><span>{group}</span></div>
                  <div className="theme-grid">
                    {THEMES.filter((t) => t.group === group).map((t) => (
                      <button
                        key={t.id}
                        className={`theme-card${settings.themeId === t.id ? ' active' : ''}`}
                        onClick={() => onChange({ themeId: t.id })}
                        title={t.name}
                      >
                        <span className="theme-swatch" style={{ background: t.tokens.page }}>
                          <span className="theme-line" style={{ background: t.tokens.sub }} />
                          <span className="theme-line short" style={{ background: t.tokens.sub }} />
                          <span className="theme-dot" style={{ background: t.tokens.accent }} />
                        </span>
                        <span className="theme-name">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {nav === 'about' && (
            <div className="about">
              <img src="./app-icon.png" alt="Miaomoo Lite" className="about-icon" />
              <h2>Miaomoo Lite</h2>
              <p className="about-poem">
                何以消烦暑，端居一院中。<br />
                眼前无长物，窗下有清风。
              </p>
              <div className="about-actions">
                <a className="about-btn" href="https://github.com/JayeGT002/Miaomoo-Lite" target="_blank" rel="noreferrer">GitHub 仓库</a>
                <a className="about-btn" href="https://github.com/JayeGT002" target="_blank" rel="noreferrer">项目主页</a>
              </div>
              <p className="about-footer">Powered by Noctipastor</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
