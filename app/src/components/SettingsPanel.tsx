// 设置面板：编辑器 / 字体 / 主题 / 关于
import { useEffect, useState } from 'react'
import { Format, FontSize, Theme, Info, Close } from '@icon-park/react'
import { BODY_FONTS, CODE_FONTS, THEMES, bodyFontStack, codeFontStack, type EditorSettings, type FontPreset, type ThemeTokens } from '../data'
import { listSystemFonts } from '../lib/platform'

interface SettingsPanelProps {
  settings: EditorSettings
  theme: ThemeTokens
  onChange: (patch: Partial<EditorSettings>) => void
  onClose: () => void
}

type NavId = 'editor' | 'font' | 'theme' | 'about'

const NAV: { id: NavId; name: string; icon: React.ReactNode }[] = [
  { id: 'editor', name: '编辑器', icon: <Format theme="outline" size="16" /> },
  { id: 'font', name: '字体', icon: <FontSize theme="outline" size="16" /> },
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

/** 字体下拉框：Web 端仅内置预设；桌面端附带系统字体（Rust 枚举） */
function FontSelect({ presets, fontId, customFont, onPick }: {
  presets: FontPreset[]
  fontId: string
  customFont: string
  onPick: (patch: { fontId?: string; customFont?: string }) => void
}) {
  const [systemFonts, setSystemFonts] = useState<string[] | null>(null)
  useEffect(() => { void listSystemFonts().then(setSystemFonts) }, [])

  const useCustom = customFont.trim() !== ''
  const value = useCustom ? `@custom:${customFont.trim()}` : fontId

  return (
    <select
      className="font-select"
      value={value}
      onChange={(e) => {
        const v = e.target.value
        if (v.startsWith('@custom:')) onPick({ customFont: v.slice(8), fontId: presets[0].id })
        else onPick({ fontId: v, customFont: '' })
      }}
    >
      {presets.map((f) => (
        <option key={f.id} value={f.id} style={{ fontFamily: f.stack }}>{f.name}</option>
      ))}
      {useCustom && <option value={value}>{customFont.trim()}（本地字体）</option>}
      {systemFonts && systemFonts.length > 0 && (
        <optgroup label="系统字体">
          {systemFonts.map((name) => (
            <option key={name} value={`@custom:${name}`} style={{ fontFamily: `"${name}"` }}>{name}</option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

export default function SettingsPanel({ settings, theme, onChange, onClose }: SettingsPanelProps) {
  const [nav, setNav] = useState<NavId>('editor')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card settings-card">
        <nav className="settings-nav">
          {NAV.map((n) => (
            <button key={n.id} className={`settings-nav-item${nav === n.id ? ' active' : ''}`} onClick={() => setNav(n.id)}>
              {n.icon}<span>{n.name}</span>
            </button>
          ))}
        </nav>

        <div className="settings-main">
          <div className="settings-head">
            <span className="settings-title">{NAV.find((n) => n.id === nav)?.name}</span>
            <button className="head-close" onClick={onClose} title="关闭"><Close theme="outline" size="16" /></button>
          </div>

          <div className="settings-detail">
          {nav === 'editor' && (
            <>
              <Slider label="字体大小" value={settings.fontSize} min={14} max={22} step={1} unit=" px" onChange={(v) => onChange({ fontSize: v })} />
              <Slider label="行高" value={settings.lineHeight} min={1.4} max={2.2} step={0.1} onChange={(v) => onChange({ lineHeight: v })} />
              <Slider label="行宽" value={settings.lineWidth} min={520} max={1440} step={10} unit=" px" onChange={(v) => onChange({ lineWidth: v })} />
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
                <FontSelect
                  presets={BODY_FONTS}
                  fontId={settings.fontId}
                  customFont={settings.customFont}
                  onPick={(p) => onChange(p)}
                />
              </div>
              <div className="settings-field">
                <div className="settings-field-head"><span>代码块字体</span></div>
                <FontSelect
                  presets={CODE_FONTS}
                  fontId={settings.codeFontId}
                  customFont={settings.customCodeFont}
                  onPick={(p) => onChange(p.fontId !== undefined ? { codeFontId: p.fontId, customCodeFont: p.customFont ?? '' } : { customCodeFont: p.customFont ?? '' })}
                />
              </div>
              <div
                className="font-preview-editor-wrap"
                style={{
                  // 注入编辑器排版变量（--md-* 仅存在于编辑区，此处按当前主题/设置补齐，保证预览与编辑区一致）
                  '--md-text': theme.text,
                  '--md-sub': theme.sub,
                  '--md-border': theme.border,
                  '--md-accent': theme.accent,
                  '--md-paragraph-spacing': `${settings.paragraphSpacing}em`,
                  '--md-indent': settings.paragraphIndent === '2char' ? '2em' : '0',
                } as React.CSSProperties}
              >
                <div className="font-preview-title">编辑器预览</div>
                <div
                  className="miaomoo-prose font-preview-editor"
                  contentEditable={false}
                  suppressContentEditableWarning
                  style={{ fontFamily: bodyFontStack(settings), fontSize: Math.min(settings.fontSize, 15), lineHeight: settings.lineHeight }}
                >
                  <h3>山间明月，江上清风</h3>
                  <p>
                    正文预览：<strong>加粗</strong>、<em>斜体</em>与<code>行内代码</code>都以当前字体渲染。The quick brown fox jumps 0123456789。
                  </p>
                  <pre style={{ fontFamily: codeFontStack(settings) }}><code>{'const note = "Miaomoo Lite";\nconsole.log(note);'}</code></pre>
                </div>
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
                <a className="about-btn ghost" href="https://jayegt002.github.io/Miaomoo-Lite/" target="_blank" rel="noreferrer">官网</a>
              </div>
              <p className="about-footer">Powered by Noctipastor</p>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
