// V1 Client: a native window around the V1 Client UI (served by V1 on the Pi),
// with voice done natively (cpal + Opus) and global push-to-talk (rdev, X11).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod voice;

use tauri::{WebviewUrl, WebviewWindowBuilder};

const DEFAULT_API: &str = "http://127.0.0.1:7380"; // override with ~/.config/v1-client/api or V1_API

fn read_key() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    std::fs::read_to_string(format!("{home}/.config/v1-client/key")).unwrap_or_default().trim().to_string()
}

// WebKitGTK doesn't hand pasted images to the page; read them from the X clipboard instead
#[tauri::command]
fn clipboard_image() -> Option<serde_json::Value> {
    use base64::Engine;
    let out = |args: &[&str]| std::process::Command::new("xclip").args(args).output().ok().filter(|o| o.status.success()).map(|o| o.stdout);
    let targets = String::from_utf8(out(&["-selection", "clipboard", "-t", "TARGETS", "-o"])?).ok()?;
    let ty = ["image/png", "image/jpeg", "image/gif", "image/webp"].into_iter().find(|t| targets.lines().any(|l| l.trim() == *t))?;
    let data = out(&["-selection", "clipboard", "-t", ty, "-o"])?;
    if data.is_empty() || data.len() > 10 * 1024 * 1024 { return None; }
    let ext = ty.split('/').nth(1).unwrap_or("png");
    Some(serde_json::json!({ "name": format!("image.{ext}"), "type": ty, "data": base64::engine::general_purpose::STANDARD.encode(data) }))
}

// Desktop notification; clicking it focuses V1 Client and jumps to the message
#[tauri::command]
fn notify(app: tauri::AppHandle, title: String, body: String, target: Option<serde_json::Value>) {
    std::thread::spawn(move || {
        let out = std::process::Command::new("notify-send")
            .args(["-a", "V1 Client", "-i", "v1-client", "-A", "default=Open", "--wait", &title, &body])
            .output();
        if let Ok(o) = out {
            if String::from_utf8_lossy(&o.stdout).trim() == "default" {
                use tauri::{Emitter, Manager};
                if let Some(w) = app.get_webview_window("main") { let _ = w.unminimize(); let _ = w.show(); let _ = w.set_focus(); }
                let _ = app.emit("v1-open", target.unwrap_or(serde_json::Value::Null));
            }
        }
    });
}

// YouTube without YouTube's player: yt-dlp hands back a direct progressive stream for a plain <video>
#[tauri::command]
async fn yt_stream(url: String) -> Result<String, String> {
    if !(url.starts_with("https://youtu.be/") || url.starts_with("https://www.youtube.com/")) { return Err("not a YouTube link".into()); }
    // the apt yt-dlp is too old for current YouTube; prefer ~/.local/bin, which also needs a JS runtime (node)
    let home = std::env::var("HOME").unwrap_or_default();
    let bin = if std::path::Path::new(&format!("{home}/.local/bin/yt-dlp")).exists() { format!("{home}/.local/bin/yt-dlp") } else { "yt-dlp".into() };
    let out = tokio::process::Command::new(bin)
        .args(["--js-runtimes", "node", "-f", "b[acodec!=none][vcodec!=none][ext=mp4][height<=720]/b[acodec!=none][vcodec!=none][ext=mp4]/b[acodec!=none][vcodec!=none]", "-g", "--no-playlist", "--no-warnings", &url])
        .output().await.map_err(|e| e.to_string())?;
    let s = String::from_utf8_lossy(&out.stdout);
    s.lines().next().filter(|l| l.starts_with("http")).map(|l| l.to_string()).ok_or_else(|| String::from_utf8_lossy(&out.stderr).chars().take(200).collect())
}

// switch off one of WebKit's feature flags by name (the webkit2gtk crate doesn't wrap the 2.42 feature API).
// AnimatedImageAsyncDecodingEnabled: decoding GIF/WebP frames on a background thread makes them fall behind and then race to catch up
fn feature_off(st: &webkit2gtk::Settings, id: &str) {
    use std::ffi::{c_char, c_void, CStr};
    use webkit2gtk::glib::object::ObjectType;
    extern "C" {
        fn webkit_settings_get_all_features() -> *mut c_void;
        fn webkit_feature_list_get_length(l: *mut c_void) -> usize;
        fn webkit_feature_list_get(l: *mut c_void, i: usize) -> *mut c_void;
        fn webkit_feature_list_unref(l: *mut c_void);
        fn webkit_feature_get_identifier(f: *mut c_void) -> *const c_char;
        fn webkit_settings_set_feature_enabled(s: *mut c_void, f: *mut c_void, on: i32);
    }
    unsafe {
        let l = webkit_settings_get_all_features();
        if l.is_null() { return; }
        for i in 0..webkit_feature_list_get_length(l) {
            let f = webkit_feature_list_get(l, i);
            let n = webkit_feature_get_identifier(f);
            if !n.is_null() && CStr::from_ptr(n).to_bytes() == id.as_bytes() { webkit_settings_set_feature_enabled(st.as_ptr() as *mut c_void, f, 0); }
        }
        webkit_feature_list_unref(l);
    }
}

#[tauri::command]
fn play_external(url: String) {
    if url.starts_with("https://") { let _ = std::process::Command::new("celluloid").arg(url).spawn(); }
}

// Memory guard: if the page process (and its swap) passes 1.2 GB, ask the page to reload at its next safe moment
fn start_memory_guard(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let me = std::process::id();
        loop {
            std::thread::sleep(std::time::Duration::from_secs(30));
            let mut kb = 0u64;
            if let Ok(rd) = std::fs::read_dir("/proc") {
                for e in rd.flatten() {
                    let p = e.path();
                    let stat = std::fs::read_to_string(p.join("stat")).unwrap_or_default();
                    let ppid = stat.rsplit(')').next().and_then(|r| r.split_whitespace().nth(1)).and_then(|x| x.parse::<u32>().ok());
                    if ppid != Some(me) { continue; }
                    let st = std::fs::read_to_string(p.join("status")).unwrap_or_default();
                    for l in st.lines() { if l.starts_with("VmRSS:") || l.starts_with("VmSwap:") { kb += l.split_whitespace().nth(1).and_then(|x| x.parse::<u64>().ok()).unwrap_or(0); } }
                }
            }
            if kb > 1_200_000 { use tauri::Emitter; let _ = app.emit("v1-memory", serde_json::json!({ "mb": kb / 1024 })); }
        }
    });
}

// Claude panel: Claude Code (your subscription) with only V1's tools + web search/fetch. No shell or file tools.
static CLAUDE_PID: std::sync::Mutex<Option<u32>> = std::sync::Mutex::new(None);
#[tauri::command]
async fn claude_ask(app: tauri::AppHandle, prompt: String, resume: Option<String>, context: String, moderate: bool, model: Option<String>) -> Result<(), String> {
    use tauri::Emitter;
    use tokio::io::{AsyncBufReadExt, BufReader};
    let home = std::env::var("HOME").unwrap_or_default();
    let dir = format!("{home}/.cache/v1-client/claude");
    let _ = std::fs::create_dir_all(&dir);
    let mcp = serde_json::json!({ "mcpServers": { "v1": { "command": "node", "args": [format!("{home}/dev/v1-client/app/v1-mcp.mjs")], "env": { "V1_MCP_MOD": if moderate { "1" } else { "0" } } } } }).to_string();
    let mut args: Vec<String> = vec!["-p".into(), prompt, "--output-format".into(), "stream-json".into(), "--verbose".into(), "--include-partial-messages".into(),
        "--mcp-config".into(), mcp, "--strict-mcp-config".into(), "--setting-sources".into(), "project".into(),
        "--allowedTools".into(), "mcp__v1".into(), "WebSearch".into(), "WebFetch".into(),
        "--disallowedTools".into(), "Bash".into(), "Edit".into(), "Write".into(), "Read".into(), "Glob".into(), "Grep".into(), "NotebookEdit".into(), "Task".into(), "TodoWrite".into(),
        "--append-system-prompt".into(), context];
    if let Some(r) = resume.filter(|r| !r.is_empty()) { args.push("--resume".into()); args.push(r); }
    if let Some(m) = model.filter(|m| !m.is_empty()) { args.push("--model".into()); args.push(m); }
    let bin = format!("{home}/.local/bin/claude");
    let mut child = tokio::process::Command::new(if std::path::Path::new(&bin).exists() { bin } else { "claude".into() })
        .args(&args).current_dir(&dir).stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::piped()).kill_on_drop(true)
        .spawn().map_err(|e| format!("could not start Claude Code: {e}"))?;
    *CLAUDE_PID.lock().unwrap() = child.id();
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let app2 = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut err = String::new();
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(l)) = lines.next_line().await { if err.len() < 2000 { err.push_str(&l); err.push('\n'); } }
        let _ = app2.emit("v1-claude", serde_json::json!({ "stderr": err }));
    });
    let mut lines = BufReader::new(stdout).lines();
    while let Ok(Some(l)) = lines.next_line().await { let _ = app.emit("v1-claude", serde_json::json!({ "line": l })); }
    let code = child.wait().await.ok().and_then(|s| s.code());
    *CLAUDE_PID.lock().unwrap() = None;
    let _ = app.emit("v1-claude", serde_json::json!({ "done": true, "code": code }));
    Ok(())
}

#[tauri::command]
fn claude_stop() {
    if let Some(pid) = CLAUDE_PID.lock().unwrap().take() { let _ = std::process::Command::new("kill").arg(pid.to_string()).status(); }
}

#[tauri::command]
fn gpu(on: Option<bool>) -> bool {
    let home = std::env::var("HOME").unwrap_or_default();
    let f = format!("{home}/.config/v1-client/no-gpu");
    if let Some(on) = on { if on { let _ = std::fs::remove_file(&f); } else { let _ = std::fs::write(&f, "1"); } }
    !std::path::Path::new(&f).exists()
}

// Start on login: an XDG autostart entry, like Discord's "Open Discord" setting
#[tauri::command]
fn autostart(on: Option<bool>) -> bool {
    let home = std::env::var("HOME").unwrap_or_default();
    let path = format!("{home}/.config/autostart/v1-client.desktop");
    if let Some(on) = on {
        if on {
            let _ = std::fs::create_dir_all(format!("{home}/.config/autostart"));
            let _ = std::fs::write(&path, format!("[Desktop Entry]\nType=Application\nName=V1 Client\nExec={home}/.local/bin/v1client\nIcon=v1-client\nX-GNOME-Autostart-enabled=true\n"));
        } else { let _ = std::fs::remove_file(&path); }
    }
    std::path::Path::new(&path).exists()
}

#[tauri::command]
fn open_url(url: String) {
    if url.starts_with("http://") || url.starts_with("https://") {
        let _ = std::process::Command::new("xdg-open").arg(url).spawn();
    }
}

fn main() {
    // GPU (DMA-BUF) rendering is on: much smoother scrolling/dragging.
    // Settings → Advanced → Hardware acceleration off writes ~/.config/v1-client/no-gpu to fall back to the CPU path.
    let home0 = std::env::var("HOME").unwrap_or_default();
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() && std::path::Path::new(&format!("{home0}/.config/v1-client/no-gpu")).exists() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
    // Hardware (VA-API) video decoding deadlocked WebKit's page process on some machines. Clips are tiny,
    // so decode in software: demote the va* decoders unless the user set their own ranks.
    if std::env::var_os("GST_PLUGIN_FEATURE_RANK").is_none() {
        std::env::set_var("GST_PLUGIN_FEATURE_RANK", "vah264dec:NONE,vah265dec:NONE,vavp9dec:NONE,vavp8dec:NONE,vaav1dec:NONE,vampeg2dec:NONE,vajpegdec:NONE");
    }
    let key = read_key();
    let api = std::env::var("V1_API").ok()
        .or_else(|| std::fs::read_to_string(format!("{}/.config/v1-client/api", std::env::var("HOME").unwrap_or_default())).ok().map(|s| s.trim().trim_end_matches('/').to_string()).filter(|s| !s.is_empty()))
        .unwrap_or_else(|| DEFAULT_API.to_string());
    let voice = voice::Voice::new(api.clone(), key.clone());
    let shared = voice.shared();

    tauri::Builder::default()
        .manage(voice)
        .invoke_handler(tauri::generate_handler![
            open_url,
            autostart,
            gpu,
            claude_ask,
            claude_stop,
            yt_stream,
            play_external,
            clipboard_image,
            notify,
            voice::audio_devices,
            voice::audio_apps,
            voice::share_audio,
            voice::voice_join,
            voice::voice_leave,
            voice::voice_set,
        ])
        .setup(move |app| {
            let init = format!(
                "window.V1_KEY={};window.V1_API={};window.V1_NATIVE=true;window.V1_INSTANT_NATIVE=true;",
                serde_json::to_string(&key)?,
                serde_json::to_string(&api)?
            );
            let origin = api.clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(format!("{api}/").parse()?))
                .title("V1 Client")
                .inner_size(1360.0, 820.0)
                .min_inner_size(820.0, 480.0)
                .decorations(false) // Discord-style title bar drawn by the page
                .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))?)?
                .initialization_script(&init)
                .on_navigation(move |u| {
                    let s = u.as_str();
                    if s.starts_with(&origin) { return true; }
                    if s.starts_with("http") { let _ = std::process::Command::new("xdg-open").arg(s).spawn(); }
                    false
                })
                .build()?;
            // instant wheel scrolling on WebKit's fast (threaded) path: no smooth-scroll animation
            if let Some(w) = tauri::Manager::get_webview_window(app, "main") {
                let _ = w.with_webview(|wv| {
                    use webkit2gtk::{SettingsExt, WebViewExt};
                    if let Some(st) = WebViewExt::settings(&wv.inner()) { st.set_enable_smooth_scrolling(false); feature_off(&st, "AnimatedImageAsyncDecodingEnabled"); }
                    // smallest in-memory cache (no back/forward page cache, decoded images freed sooner): this box has 3 GB
                    if let Some(ctx) = WebViewExt::context(&wv.inner()) { use webkit2gtk::WebContextExt; ctx.set_cache_model(webkit2gtk::CacheModel::DocumentViewer); }
                    // page process killed (earlyoom on a full box, or a WebKit crash): bring it straight back instead of a dead window
                    wv.inner().connect_web_process_terminated(|v, _reason| { v.reload(); });
                    // V1 restarting = connection refused: show a black "Reconnecting" page that retries, not WebKit's white error page
                    wv.inner().connect_load_failed(|v, _ev, uri, err| {
                        if err.matches(webkit2gtk::PolicyError::FrameLoadInterruptedByPolicyChange) || err.matches(webkit2gtk::NetworkError::Cancelled) { return false; } // links we open outside
                        let u = uri.replace('\\', "").replace('"', "");
                        let html = format!(r#"<!doctype html><body style="margin:0;background:#000;color:#fff;font:15px sans-serif;display:grid;place-items:center;height:100vh">Reconnecting to V1…<script>setTimeout(()=>location.replace("{u}"),2000)</script></body>"#);
                        v.load_alternate_html(&html, uri, Some(uri));
                        true
                    });
                });
            }
            voice::start_ptt(shared.clone());
            start_memory_guard(app.handle().clone());
            voice::start_events(app.handle().clone(), shared.clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("V1 Client failed to start");
}
