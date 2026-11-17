use std::fs;
use std::io::Write;
use std::path::PathBuf;
use url::Url;

pub fn log_msg(msg: &str) {
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let line = format!("[{:010}] [ESPERANZAAI-TAURI] {}\n", dur.as_secs(), msg);
    print!("{}", line);
    let _ = std::io::stdout().flush();

    let paths = [PathBuf::from("/tmp/esperanza_ai_image_editor.log")];
    for p in &paths {
        if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(p) {
            let _ = f.write_all(line.as_bytes());
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    log_msg("=== EsperanzaAI Image Editor Desktop Starting ===");

    tauri::Builder::default()
        .setup(move |app| {
            let target_url = Url::parse("http://127.0.0.1:5000/").unwrap();
            log_msg(&format!("setup() -> Creating WebviewWindow pointing to: {}", target_url));
            
            let _win = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::External(target_url),
            )
            .title("EsperanzaAI Image Editor v2 - Dual-Layer Darkroom Studio")
            .inner_size(1540.0, 960.0)
            .min_inner_size(1024.0, 720.0)
            .resizable(true)
            .build()?;
            
            log_msg("setup() -> Window initialized successfully!");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
