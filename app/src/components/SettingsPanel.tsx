// 设置面板：通用 / 编辑器 / 快捷键 / 字体 / 主题 / 关于
import { useEffect, useRef, useState } from 'react'
import { Config, Format, Keyboard, FontSize, Theme, Info, Close, Github, Earth, Download, Upload, FolderOpen, Refresh } from '@icon-park/react'
import {
  BODY_FONTS, CODE_FONTS, THEMES, bodyFontStack, codeFontStack,
  SHORTCUT_ACTIONS, DEFAULT_SHORTCUTS, bindingFromEvent, sameBinding, formatBinding,
  type EditorSettings, type FontPreset, type ThemeTokens,
} from '../data'
import { listSystemFonts, isDesktop, pickDirectory, pickSavePath, saveFileRaw } from '../lib/platform'
import { downloadBlob } from '../lib/exporters'

interface SettingsPanelProps {
  settings: EditorSettings
  theme: ThemeTokens
  onChange: (patch: Partial<EditorSettings>) => void
  onClose: () => void
  notify: (msg: string) => void
}

type NavId = 'general' | 'editor' | 'shortcuts' | 'font' | 'theme' | 'about'

const NAV: { id: NavId; name: string; icon: React.ReactNode }[] = [
  { id: 'general', name: '通用', icon: <Config theme="outline" size="16" /> },
  { id: 'editor', name: '编辑器', icon: <Format theme="outline" size="16" /> },
  { id: 'shortcuts', name: '快捷键', icon: <Keyboard theme="outline" size="16" /> },
  { id: 'font', name: '字体', icon: <FontSize theme="outline" size="16" /> },
  { id: 'theme', name: '主题', icon: <Theme theme="outline" size="16" /> },
  { id: 'about', name: '关于', icon: <Info theme="outline" size="16" /> },
]

// 语言选项（i18n 预留，当前仅简体中文可用）
const LANGUAGES: { value: string; label: string; disabled?: boolean }[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English', disabled: true },
  { value: 'ja-JP', label: '日本語', disabled: true },
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

/** 开关行：标签 + 状态文字，switch 置于下方（与原编辑面板打字机行一致） */
function ToggleField({ label, on, onToggle }: { label: string; on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="settings-field">
      <div className="settings-field-head">
        <span>{label}</span>
        <span className="settings-value">{on ? '已开启' : '已关闭'}</span>
      </div>
      <button className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={on} onClick={() => onToggle(!on)}>
        <span className="switch-knob" />
      </button>
    </div>
  )
}

// ── 配置文件导入/导出（多端配置同步） ──
// 数值项按合法区间收敛；平台差异项（桌面目录等）原样保留，仅在使用平台生效
const NUM_RANGES: Partial<Record<keyof EditorSettings, [number, number]>> = {
  fontSize: [14, 22],
  lineHeight: [1.4, 2.2],
  lineWidth: [520, 1440],
  paragraphSpacing: [0.3, 1.6],
  typewriterLine: [50, 80],
  uiScale: [80, 120],
}
const STRING_KEYS: (keyof EditorSettings)[] = ['fontId', 'customFont', 'codeFontId', 'customCodeFont', 'themeId', 'language', 'imageSaveDir', 'backupDir']
const BOOL_KEYS: (keyof EditorSettings)[] = ['typewriter', 'autoSave']

function sanitizeSettings(raw: Record<string, unknown>): Partial<EditorSettings> {
  const patch: Partial<EditorSettings> = {}
  for (const [key, range] of Object.entries(NUM_RANGES) as [keyof EditorSettings, [number, number]][]) {
    const v = raw[key]
    if (typeof v === 'number' && Number.isFinite(v)) {
      ;(patch[key] as number) = Math.min(range[1], Math.max(range[0], v))
    }
  }
  for (const key of STRING_KEYS) {
    const v = raw[key]
    if (typeof v === 'string') (patch[key] as string) = v
  }
  for (const key of BOOL_KEYS) {
    const v = raw[key]
    if (typeof v === 'boolean') (patch[key] as boolean) = v
  }
  if (raw.paragraphIndent === 'none' || raw.paragraphIndent === '2char') patch.paragraphIndent = raw.paragraphIndent
  // 快捷键表：按已知操作 id 白名单合入
  if (raw.shortcuts && typeof raw.shortcuts === 'object' && !Array.isArray(raw.shortcuts)) {
    const sc: Record<string, string> = { ...DEFAULT_SHORTCUTS }
    for (const a of SHORTCUT_ACTIONS) {
      const b = (raw.shortcuts as Record<string, unknown>)[a.id]
      if (typeof b === 'string') sc[a.id] = b
    }
    patch.shortcuts = sc
  }
  return patch
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

export default function SettingsPanel({ settings, theme, onChange, onClose, notify }: SettingsPanelProps) {
  const [nav, setNav] = useState<NavId>('general')
  const [recording, setRecording] = useState<string | null>(null)
  const configInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const applyShortcut = (id: string, binding: string) => {
    onChange({ shortcuts: { ...settings.shortcuts, [id]: binding } })
  }

  // 快捷键录制：捕获下一次按键组合；Esc 取消、Backspace 清除；冲突时提示并不保存
  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.key === 'Escape') { setRecording(null); return }
      if (e.key === 'Backspace' || e.key === 'Delete') { applyShortcut(recording, ''); setRecording(null); return }
      const binding = bindingFromEvent(e)
      if (!binding) return // 纯修饰键，继续等待
      const conflict = Object.entries(settings.shortcuts).find(([id, b]) => id !== recording && b && sameBinding(b, binding))
      if (conflict) {
        const name = SHORTCUT_ACTIONS.find((a) => a.id === conflict[0])?.name ?? conflict[0]
        notify(`该组合已被「${name}」占用`)
      } else {
        applyShortcut(recording, binding)
      }
      setRecording(null)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, settings.shortcuts])

  // 导出配置：桌面端走保存对话框，Web 端浏览器下载
  const exportConfig = async () => {
    const json = JSON.stringify({ ...settings, _app: 'miaomoo-lite' }, null, 2)
    if (isDesktop()) {
      const path = await pickSavePath('miaomoo-lite-settings', '.json')
      if (!path) return
      try {
        await saveFileRaw(path, json)
        notify('配置已导出')
      } catch {
        notify('导出失败，请重试')
      }
    } else {
      downloadBlob('miaomoo-lite-settings.json', new Blob([json], { type: 'application/json' }))
      notify('配置已导出')
    }
  }

  // 导入配置：仅接受本应用导出的 JSON，字段白名单校验后合并
  const importConfig = async (file: File | null) => {
    if (configInputRef.current) configInputRef.current.value = ''
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.json')) {
      notify('仅支持导入 .json 配置文件')
      return
    }
    try {
      const raw = JSON.parse(await file.text()) as Record<string, unknown>
      const patch = sanitizeSettings(raw)
      if (Object.keys(patch).length === 0) {
        notify('导入失败：未识别到有效配置')
        return
      }
      onChange(patch)
      notify('配置已导入')
    } catch {
      notify('导入失败：不是有效的配置文件')
    }
  }

  // 桌面端目录选择（图片保存 / 文档备份）
  const chooseDir = async (key: 'imageSaveDir' | 'backupDir') => {
    const dir = await pickDirectory()
    if (dir) onChange({ [key]: dir } as Partial<EditorSettings>)
  }

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
          {nav === 'general' && (
            <>
              <ToggleField label="打字机模式" on={settings.typewriter} onToggle={(v) => onChange({ typewriter: v })} />
              {settings.typewriter && (
                <Slider label="固定行位置" value={settings.typewriterLine} min={50} max={80} step={1} unit=" %" onChange={(v) => onChange({ typewriterLine: v })} />
              )}
              <ToggleField label="自动保存" on={settings.autoSave} onToggle={(v) => onChange({ autoSave: v })} />
              <Slider label="全局元素缩放" value={settings.uiScale} min={80} max={120} step={5} unit=" %" onChange={(v) => onChange({ uiScale: v })} />
              <div className="settings-field">
                <div className="settings-field-head"><span>语言</span></div>
                <select
                  className="font-select"
                  value={settings.language}
                  onChange={(e) => { if (LANGUAGES.some((l) => l.value === e.target.value && !l.disabled)) onChange({ language: e.target.value }) }}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value} disabled={l.disabled}>{l.label}{l.disabled ? '（即将支持）' : ''}</option>
                  ))}
                </select>
              </div>
              <div className="settings-field">
                <div className="settings-field-head">
                  <span>配置文件</span>
                  <span className="settings-value">多端配置同步</span>
                </div>
                <div className="config-btn-row">
                  <button className="ghost-btn sm" onClick={() => void exportConfig()}>
                    <Download theme="outline" size="14" />导出配置
                  </button>
                  <button className="ghost-btn sm" onClick={() => configInputRef.current?.click()}>
                    <Upload theme="outline" size="14" />导入配置
                  </button>
                  <input
                    ref={configInputRef}
                    type="file"
                    accept=".json,application/json"
                    hidden
                    onChange={(e) => void importConfig(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              {isDesktop() && (
                <>
                  <div className="settings-field">
                    <div className="settings-field-head"><span>图片保存目录</span></div>
                    <div className="dir-row">
                      <span className="dir-path" title={settings.imageSaveDir}>{settings.imageSaveDir || '未设置'}</span>
                      <button className="ghost-btn sm" onClick={() => void chooseDir('imageSaveDir')}>
                        <FolderOpen theme="outline" size="14" />浏览
                      </button>
                    </div>
                  </div>
                  <div className="settings-field">
                    <div className="settings-field-head"><span>文档备份目录</span></div>
                    <div className="dir-row">
                      <span className="dir-path" title={settings.backupDir}>{settings.backupDir || '未设置'}</span>
                      <button className="ghost-btn sm" onClick={() => void chooseDir('backupDir')}>
                        <FolderOpen theme="outline" size="14" />浏览
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {nav === 'editor' && (
            <>
              <Slider label="字体大小" value={settings.fontSize} min={14} max={22} step={1} unit=" px" onChange={(v) => onChange({ fontSize: v })} />
              <Slider label="行高" value={settings.lineHeight} min={1.4} max={2.2} step={0.1} onChange={(v) => onChange({ lineHeight: v })} />
              <Slider label="行宽" value={settings.lineWidth} min={520} max={1440} step={10} unit=" px" onChange={(v) => onChange({ lineWidth: v })} />
              <Slider label="段落间距" value={settings.paragraphSpacing} min={0.3} max={1.6} step={0.1} unit=" em" onChange={(v) => onChange({ paragraphSpacing: v })} />
              <ToggleField
                label="首行缩进"
                on={settings.paragraphIndent === '2char'}
                onToggle={(v) => onChange({ paragraphIndent: v ? '2char' : 'none' })}
              />
            </>
          )}

          {nav === 'shortcuts' && (
            <>
              <div className="settings-field">
                <div className="settings-field-head">
                  <span>格式操作快捷键</span>
                  <button className="ghost-btn sm" onClick={() => onChange({ shortcuts: { ...DEFAULT_SHORTCUTS } })}>
                    <Refresh theme="outline" size="14" />全部恢复默认
                  </button>
                </div>
                <p className="shortcut-hint">
                  点击按键槽后按下新组合完成录制：Esc 取消、Backspace 清除。Mod 在 macOS 为 ⌘，其他平台为 Ctrl。
                </p>
                <div className="shortcut-list">
                  {SHORTCUT_ACTIONS.map((a) => {
                    const binding = settings.shortcuts[a.id] ?? ''
                    return (
                      <div key={a.id} className="shortcut-row">
                        <span className="shortcut-name">{a.name}</span>
                        <span className="shortcut-ops">
                          <button
                            className={`shortcut-key${recording === a.id ? ' recording' : ''}`}
                            onClick={() => setRecording(recording === a.id ? null : a.id)}
                          >
                            {recording === a.id ? '按下快捷键…' : formatBinding(binding)}
                          </button>
                          {binding !== a.defaultKeys && (
                            <button className="shortcut-reset" title="恢复默认" onClick={() => applyShortcut(a.id, a.defaultKeys)}>
                              <Refresh theme="outline" size="13" />
                            </button>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
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
              <p className="about-version">v0.1.4 GUANGDEXINGGONG</p>
              <p className="about-poem">
                我与你建构　光的行宫　光的行宫<br />
                让四散的尘埃汇入　胸腔之中<br />
                聆听它的鼓动
              </p>
              <p className="about-poem-credit">JUSF周存/洛天依/言和「光的行宫」</p>
              <div className="about-footer-row">
                <div className="about-actions">
                  <a className="about-btn" href="https://github.com/noctipastor/miaomoo-lite" target="_blank" rel="noreferrer">
                    <Github theme="outline" size="14" />GitHub
                  </a>
                  <a className="about-btn ghost" href="https://miaomoo.app" target="_blank" rel="noreferrer">
                    <Earth theme="outline" size="14" />官网
                  </a>
                </div>
                <p className="about-footer">Powered by Noctipastor</p>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
