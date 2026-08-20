fn main() {
    // 将构建目标三元组透传给 lib.rs（rustc 编译期没有 TARGET 环境变量）
    let target = std::env::var("TARGET").unwrap_or_default();
    println!("cargo:rustc-env=APP_TARGET={target}");
    tauri_build::build()
}
