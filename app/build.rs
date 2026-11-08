fn main() {
    // app commands must be listed so the page (served from the Pi) is allowed to call them
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
        "open_url", "autostart", "gpu", "claude_ask", "claude_stop", "yt_stream", "play_external", "clipboard_image", "notify", "audio_devices", "audio_apps", "share_audio", "voice_join", "voice_leave", "voice_set",
    ])))
    .expect("tauri build");
}
