// 平台适配层：桌面端（Tauri）走原生能力，Web 版降级为浏览器下载
// 通过 window.__TAURI_INTERNALS__ 探测运行环境（需求文档 §4）

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global {
  // eslint-disable-next-line no-var
  var __TAURI_INTERNALS__: any
}

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** 桌面端：原生保存对话框；Web 版返回 null（调用方走下载） */
export async function pickSavePath(defaultName: string, ext: string): Promise<string | null> {
  if (!isDesktop()) return null
  const { save } = await import('@tauri-apps/plugin-dialog')
  return await save({
    defaultPath: defaultName.endsWith(ext) ? defaultName : `${defaultName}${ext}`,
    filters: [{ name: ext.replace('.', '').toUpperCase(), extensions: [ext.replace('.', '')] }],
  })
}

/** 桌面端：写文件到指定路径（Rust 命令） */
export async function saveFileRaw(path: string, data: Uint8Array | string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  const payload = typeof data === 'string' ? Array.from(new TextEncoder().encode(data)) : Array.from(data)
  await invoke('save_file', { path, data: payload })
}

export interface BundleFile {
  name: string
  data: Uint8Array
}

/** 桌面端：写 TextBundle 文件夹结构（Rust 命令） */
export async function saveTextBundleRaw(dir: string, files: BundleFile[]): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('write_textbundle', {
    dir,
    files: files.map((f) => ({ name: f.name, data: Array.from(f.data) })),
  })
}

/** 桌面端：Typst sidecar 编译 PDF；失败时抛错由调用方兜底 */
export async function typstCompileRaw(source: string, outPath: string, paper: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('typst_compile', { source, outPath, paper })
}
