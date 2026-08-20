use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[derive(serde::Serialize, serde::Deserialize)]
struct BundleFile {
    name: String,
    data: Vec<u8>,
}

/// 写文件到用户在保存对话框选择的路径
#[tauri::command]
fn save_file(path: String, data: Vec<u8>) -> Result<(), String> {
    fs::write(&path, &data).map_err(|e| format!("写入失败: {e}"))
}

/// 写 TextBundle 文件夹结构（.textbundle 本质是有序文件夹）
#[tauri::command]
fn write_textbundle(dir: String, files: Vec<BundleFile>) -> Result<(), String> {
    let root = PathBuf::from(&dir);
    fs::create_dir_all(&root).map_err(|e| format!("创建目录失败: {e}"))?;
    for f in files {
        let p = root.join(&f.name);
        if let Some(parent) = p.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
        }
        fs::write(p, &f.data).map_err(|e| format!("写入 {} 失败: {e}", f.name))?;
    }
    Ok(())
}

/// 定位随包分发的 Typst sidecar（externalBin 安装在主程序同目录）
fn typst_binary() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let triple = env!("TARGET");
    let candidates = [
        dir.join(format!("typst-{triple}")),
        dir.join(format!("typst-{triple}.exe")),
        dir.join("typst"),
        dir.join("typst.exe"),
    ];
    candidates.into_iter().find(|p| p.exists())
}

/// 调用 Typst sidecar：.typ 源 → PDF
#[tauri::command]
fn typst_compile(source: String, out_path: String, paper: String) -> Result<(), String> {
    let _ = paper; // 页面尺寸已在 Typst 源码 #set page 中设置
    let typst = typst_binary().ok_or_else(|| "未找到 Typst 组件".to_string())?;
    let out = PathBuf::from(&out_path);
    let input = out.with_extension("typ");
    fs::write(&input, &source).map_err(|e| format!("写入临时文件失败: {e}"))?;
    let output = Command::new(&typst)
        .arg("compile")
        .arg(&input)
        .arg(&out)
        .output()
        .map_err(|e| format!("启动 Typst 失败: {e}"))?;
    let _ = fs::remove_file(&input);
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let brief: String = stderr.chars().take(300).collect();
        return Err(format!("Typst 编译失败: {brief}"));
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_file, write_textbundle, typst_compile])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
