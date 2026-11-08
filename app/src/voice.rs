// Native voice for V1 Client.
// Mic (cpal, 48 kHz mono) -> 20 ms frames -> gate / push-to-talk -> Opus -> WebSocket [2, opus..] -> V1 on the Pi.
// WebSocket [1, uid(8 BE), opus..] -> per-user Opus decoder -> per-user jitter buffer -> mixed in the cpal output callback.
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{mpsc, Arc};
use std::time::Duration;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use futures_util::{SinkExt, StreamExt};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc as tmpsc;
use tokio_tungstenite::tungstenite::Message;

const RATE: u32 = 48_000;
const FRAME: usize = 960; // 20 ms
const PRE: usize = 1920 * 2; // 40 ms stereo cushion before a speaker starts
const MAX: usize = 9600 * 2; // 200 ms ceiling...
const TRIM: usize = 2880 * 2; // ...trimmed back to 60 ms

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub mode: String, // "open" (voice activity) or "ptt"
    pub key: String,  // KeyboardEvent.code, or Mouse1/Mouse3/Mouse4
    pub muted: bool,
    pub deaf: bool,
    pub threshold: f32, // dBFS gate for open mic
    pub gains: HashMap<String, f32>,
    pub noise: bool, // RNNoise suppression on the mic
    pub input: Option<String>,  // device name, None = system default
    pub output: Option<String>,
}
impl Default for Settings {
    fn default() -> Self {
        Settings { mode: "open".into(), key: "Backquote".into(), muted: false, deaf: false, threshold: -50.0, gains: HashMap::new(), noise: true, input: None, output: None }
    }
}

struct UserBuf { q: VecDeque<f32>, on: bool }

pub struct Shared {
    settings: Mutex<Settings>,
    held: AtomicBool,
    sending: AtomicBool,
    level: AtomicU32, // f32 bits, dBFS
    active: AtomicBool,
    users: Mutex<HashMap<u64, UserBuf>>,
    events: Mutex<Vec<Value>>,
}
impl Shared {
    fn event(&self, v: Value) { self.events.lock().push(v); }
}

struct Session { tx: tmpsc::UnboundedSender<Message>, stop: Arc<AtomicBool> }

pub struct Voice { api: String, key: String, sh: Arc<Shared>, sess: Mutex<Option<Session>> }

impl Voice {
    pub fn new(api: String, key: String) -> Self {
        Voice {
            api, key, sess: Mutex::new(None),
            sh: Arc::new(Shared {
                settings: Mutex::new(Settings::default()), held: AtomicBool::new(false), sending: AtomicBool::new(false),
                level: AtomicU32::new((-100f32).to_bits()), active: AtomicBool::new(false),
                users: Mutex::new(HashMap::new()), events: Mutex::new(Vec::new()),
            }),
        }
    }
    pub fn shared(&self) -> Arc<Shared> { self.sh.clone() }
}

fn stop_session(sh: &Shared, s: Session) {
    s.stop.store(true, Ordering::SeqCst);
    let _ = s.tx.send(Message::Close(None));
    sh.active.store(false, Ordering::SeqCst);
    sh.sending.store(false, Ordering::SeqCst);
    sh.users.lock().clear();
}

#[tauri::command]
pub fn voice_join(voice: State<'_, Voice>, channel_id: String) -> Result<(), String> {
    let join = Message::Text(json!({ "t": "join", "channelId": channel_id }).to_string());
    let mut sess = voice.sess.lock();
    if let Some(s) = sess.as_ref() {
        if !s.stop.load(Ordering::SeqCst) { let _ = s.tx.send(join); return Ok(()); }
    }
    let (tx, rx) = tmpsc::unbounded_channel::<Message>();
    let stop = Arc::new(AtomicBool::new(false));
    let sh = voice.sh.clone();
    sh.active.store(true, Ordering::SeqCst);
    let url = format!("{}/?k={}", voice.api.replacen("http", "ws", 1), voice.key);
    tauri::async_runtime::spawn(net(url, rx, sh.clone(), stop.clone()));
    let txa = tx.clone();
    let st = stop.clone();
    std::thread::Builder::new().name("v1-audio".into()).spawn(move || {
        if let Err(e) = audio(sh.clone(), txa, st.clone()) {
            sh.event(json!({ "t": "error", "error": format!("audio: {e}") }));
            st.store(true, Ordering::SeqCst);
        }
    }).map_err(|e| e.to_string())?;
    let _ = tx.send(join);
    *sess = Some(Session { tx, stop });
    Ok(())
}

#[tauri::command]
pub fn voice_leave(voice: State<'_, Voice>) {
    if let Some(s) = voice.sess.lock().take() {
        let _ = s.tx.send(Message::Text(json!({ "t": "leave" }).to_string()));
        stop_session(&voice.sh, s);
    }
}

#[tauri::command]
pub fn voice_set(voice: State<'_, Voice>, settings: Settings) {
    *voice.sh.settings.lock() = settings;
}

async fn net(url: String, mut rx: tmpsc::UnboundedReceiver<Message>, sh: Arc<Shared>, stop: Arc<AtomicBool>) {
    let ws = match tokio_tungstenite::connect_async(url.as_str()).await {
        Ok((ws, _)) => ws,
        Err(e) => { sh.event(json!({ "t": "error", "error": format!("voice socket: {e}") })); stop.store(true, Ordering::SeqCst); sh.event(json!({ "t": "ended" })); return; }
    };
    let (mut wr, mut rd) = ws.split();
    let writer = tauri::async_runtime::spawn(async move {
        while let Some(m) = rx.recv().await {
            let close = matches!(m, Message::Close(_));
            if wr.send(m).await.is_err() || close { break; }
        }
    });
    let mut decoders: HashMap<u64, opus::Decoder> = HashMap::new();
    let mut pcm = vec![0f32; 5760 * 2];
    let mut joined = false;
    while let Some(Ok(m)) = rd.next().await {
        if stop.load(Ordering::SeqCst) { break; }
        match m {
            Message::Binary(b) if b.len() > 9 && b[0] == 1 => {
                if sh.settings.lock().deaf { continue; }
                let uid = u64::from_be_bytes(b[1..9].try_into().unwrap());
                let dec = decoders.entry(uid).or_insert_with(|| opus::Decoder::new(RATE, opus::Channels::Stereo).expect("opus decoder"));
                let n = match dec.decode_float(&b[9..], &mut pcm, false) { Ok(n) => n, Err(_) => continue };
                let mut users = sh.users.lock();
                let u = users.entry(uid).or_insert_with(|| UserBuf { q: VecDeque::with_capacity(MAX), on: false });
                u.q.extend(&pcm[..n * 2]);
                if u.q.len() > MAX { let cut = u.q.len() - TRIM; u.q.drain(..cut); }
            }
            Message::Text(t) => {
                let v: Value = serde_json::from_str(&t).unwrap_or(Value::Null);
                match v["t"].as_str() {
                    Some("voice") => {
                        if v["v"].is_null() { if joined { break; } } else { joined = true; }
                    }
                    Some("error") => sh.event(json!({ "t": "error", "error": v["error"] })),
                    _ => {}
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }
    stop.store(true, Ordering::SeqCst);
    sh.active.store(false, Ordering::SeqCst);
    sh.sending.store(false, Ordering::SeqCst);
    sh.users.lock().clear();
    writer.abort();
    sh.event(json!({ "t": "ended" }));
}

fn audio(sh: Arc<Shared>, tx: tmpsc::UnboundedSender<Message>, stop: Arc<AtomicBool>) -> Result<(), String> {
    let host = cpal::default_host();
    let (want_in, want_out) = { let s = sh.settings.lock(); (s.input.clone(), s.output.clone()) };
    let pick_in = want_in.and_then(|n| host.input_devices().ok()?.find(|d| d.name().ok().as_deref() == Some(n.as_str())));
    let pick_out = want_out.and_then(|n| host.output_devices().ok()?.find(|d| d.name().ok().as_deref() == Some(n.as_str())));
    let input = pick_in.or_else(|| host.default_input_device()).ok_or("no microphone")?;
    let output = pick_out.or_else(|| host.default_output_device()).ok_or("no output device")?;

    // ---- output: mix every speaker's buffer
    let osh = sh.clone();
    let ocfg = cpal::StreamConfig { channels: 2, sample_rate: cpal::SampleRate(RATE), buffer_size: cpal::BufferSize::Fixed(480) };
    let mix = move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
        data.fill(0.0);
        let (deaf, gains) = { let s = osh.settings.lock(); (s.deaf, s.gains.clone()) };
        if deaf { return; }
        let mut users = osh.users.lock();
        for (uid, u) in users.iter_mut() {
            if !u.on { if u.q.len() >= PRE { u.on = true; } else { continue; } }
            let g = gains.get(&uid.to_string()).copied().unwrap_or(1.0);
            let n = data.len().min(u.q.len());
            for (d, s) in data[..n].iter_mut().zip(u.q.drain(..n)) { *d += s * g; }
            if n < data.len() { u.on = false; } // ran dry: build a cushion again
        }
        for d in data.iter_mut() { *d = d.clamp(-1.0, 1.0); }
    };
    let err = |e| eprintln!("v1 audio: {e}");
    let ostream = output.build_output_stream(&ocfg, mix.clone(), err, None)
        .or_else(|_| output.build_output_stream(&cpal::StreamConfig { buffer_size: cpal::BufferSize::Default, ..ocfg.clone() }, mix, err, None))
        .map_err(|e| format!("output: {e}"))?;

    // ---- input: hand mono samples to the encoder loop below
    let (mtx, mrx) = mpsc::channel::<Vec<f32>>();
    let icfg_def = input.default_input_config().map_err(|e| format!("mic: {e}"))?;
    let try_cfg = |ch: u16, buf: cpal::BufferSize| cpal::StreamConfig { channels: ch, sample_rate: cpal::SampleRate(RATE), buffer_size: buf };
    let mut istream = None;
    for (ch, buf) in [(1, cpal::BufferSize::Fixed(480)), (1, cpal::BufferSize::Default), (icfg_def.channels(), cpal::BufferSize::Default)] {
        let m = mtx.clone();
        let cb = move |data: &[f32], _: &cpal::InputCallbackInfo| {
            let mono: Vec<f32> = if ch == 1 { data.to_vec() } else { data.chunks(ch as usize).map(|c| c.iter().sum::<f32>() / ch as f32).collect() };
            let _ = m.send(mono);
        };
        if let Ok(s) = input.build_input_stream(&try_cfg(ch, buf), cb, err, None) { istream = Some(s); break; }
    }
    let istream = istream.ok_or("could not open the microphone at 48 kHz")?;
    ostream.play().map_err(|e| e.to_string())?;
    istream.play().map_err(|e| e.to_string())?;

    let mut enc = opus::Encoder::new(RATE, opus::Channels::Mono, opus::Application::Voip).map_err(|e| e.to_string())?;
    let _ = enc.set_bitrate(opus::Bitrate::Bits(64_000));
    let _ = enc.set_inband_fec(true);
    let mut acc: Vec<f32> = Vec::with_capacity(FRAME * 4);
    let mut out = vec![0u8; 4000];
    let mut gate_until = std::time::Instant::now();
    let mut dn = nnnoiseless::DenoiseState::new();
    let mut dn_out = [0f32; 480];
    let mut was_sending = false;
    while !stop.load(Ordering::SeqCst) {
        let chunk = match mrx.recv_timeout(Duration::from_millis(100)) { Ok(c) => c, Err(mpsc::RecvTimeoutError::Timeout) => continue, Err(_) => break };
        acc.extend_from_slice(&chunk);
        while acc.len() >= FRAME {
            let mut frame: Vec<f32> = acc.drain(..FRAME).collect();
            if sh.settings.lock().noise { // RNNoise wants 480-sample frames in i16 range
                for half in frame.chunks_mut(480) {
                    let scaled: Vec<f32> = half.iter().map(|v| v * 32767.0).collect();
                    dn.process_frame(&mut dn_out, &scaled);
                    for (d, s) in half.iter_mut().zip(dn_out.iter()) { *d = s / 32767.0; }
                }
            }
            let rms = (frame.iter().map(|v| v * v).sum::<f32>() / FRAME as f32).sqrt();
            let db = 20.0 * (rms + 1e-9).log10();
            sh.level.store(db.to_bits(), Ordering::Relaxed);
            let (mode, muted, deaf, thr) = { let s = sh.settings.lock(); (s.mode.clone(), s.muted, s.deaf, s.threshold) };
            let now = std::time::Instant::now();
            if db > thr { gate_until = now + Duration::from_millis(350); }
            let tx_on = !muted && !deaf && if mode == "ptt" { sh.held.load(Ordering::Relaxed) } else { now < gate_until };
            if tx_on != was_sending {
                was_sending = tx_on;
                sh.sending.store(tx_on, Ordering::Relaxed);
                if !tx_on { let _ = tx.send(Message::Text(json!({ "t": "talkEnd" }).to_string())); }
            }
            if !tx_on { continue; }
            if let Ok(n) = enc.encode_float(&frame, &mut out) {
                let mut b = Vec::with_capacity(n + 1);
                b.push(2u8);
                b.extend_from_slice(&out[..n]);
                let _ = tx.send(Message::Binary(b));
            }
        }
    }
    drop(istream);
    drop(ostream);
    sh.sending.store(false, Ordering::Relaxed);
    Ok(())
}

// Push the voice state to the page ~15 times a second while in a call (and queued one-off events at once).
pub fn start_events(app: AppHandle, sh: Arc<Shared>) {
    std::thread::Builder::new().name("v1-events".into()).spawn(move || {
        let mut last = (false, 0i32);
        loop {
            std::thread::sleep(Duration::from_millis(66));
            let evs: Vec<Value> = std::mem::take(&mut *sh.events.lock());
            for e in evs { let _ = app.emit("v1-voice", e); }
            if !sh.active.load(Ordering::Relaxed) { continue; }
            let sending = sh.sending.load(Ordering::Relaxed);
            let level = f32::from_bits(sh.level.load(Ordering::Relaxed)).round() as i32;
            if (sending, level) != last {
                last = (sending, level);
                let _ = app.emit("v1-voice", json!({ "t": "state", "sending": sending, "level": level }));
            }
        }
    }).expect("events thread");
}

// ---- global push-to-talk (X11 via XRecord: sees keys and mouse buttons without grabbing them)
#[derive(PartialEq, Clone, Copy)]
enum Bind { Key(rdev::Key), Button(rdev::Button) }

fn bind_of(code: &str) -> Option<Bind> {
    use rdev::Key::*;
    let k = match code {
        "Mouse1" => return Some(Bind::Button(rdev::Button::Middle)),
        "Mouse3" => return Some(Bind::Button(rdev::Button::Unknown(8))),
        "Mouse4" => return Some(Bind::Button(rdev::Button::Unknown(9))),
        "Backquote" => BackQuote, "Minus" => Minus, "Equal" => Equal, "BracketLeft" => LeftBracket, "BracketRight" => RightBracket,
        "Semicolon" => SemiColon, "Quote" => Quote, "Backslash" => BackSlash, "IntlBackslash" => IntlBackslash, "Comma" => Comma,
        "Period" => Dot, "Slash" => Slash, "Space" => Space, "Tab" => Tab, "CapsLock" => CapsLock,
        "ShiftLeft" => ShiftLeft, "ShiftRight" => ShiftRight, "ControlLeft" => ControlLeft, "ControlRight" => ControlRight,
        "AltLeft" => Alt, "AltRight" => AltGr, "MetaLeft" => MetaLeft, "MetaRight" => MetaRight,
        "Insert" => Insert, "Home" => Home, "End" => End, "PageUp" => PageUp, "PageDown" => PageDown, "Delete" => Delete,
        "ScrollLock" => ScrollLock, "Pause" => Pause, "PrintScreen" => PrintScreen, "NumLock" => NumLock,
        "F1" => F1, "F2" => F2, "F3" => F3, "F4" => F4, "F5" => F5, "F6" => F6, "F7" => F7, "F8" => F8, "F9" => F9, "F10" => F10, "F11" => F11, "F12" => F12,
        "Digit0" => Num0, "Digit1" => Num1, "Digit2" => Num2, "Digit3" => Num3, "Digit4" => Num4, "Digit5" => Num5, "Digit6" => Num6, "Digit7" => Num7, "Digit8" => Num8, "Digit9" => Num9,
        "Numpad0" => Kp0, "Numpad1" => Kp1, "Numpad2" => Kp2, "Numpad3" => Kp3, "Numpad4" => Kp4, "Numpad5" => Kp5, "Numpad6" => Kp6, "Numpad7" => Kp7, "Numpad8" => Kp8, "Numpad9" => Kp9,
        "KeyA" => KeyA, "KeyB" => KeyB, "KeyC" => KeyC, "KeyD" => KeyD, "KeyE" => KeyE, "KeyF" => KeyF, "KeyG" => KeyG, "KeyH" => KeyH, "KeyI" => KeyI,
        "KeyJ" => KeyJ, "KeyK" => KeyK, "KeyL" => KeyL, "KeyM" => KeyM, "KeyN" => KeyN, "KeyO" => KeyO, "KeyP" => KeyP, "KeyQ" => KeyQ, "KeyR" => KeyR,
        "KeyS" => KeyS, "KeyT" => KeyT, "KeyU" => KeyU, "KeyV" => KeyV, "KeyW" => KeyW, "KeyX" => KeyX, "KeyY" => KeyY, "KeyZ" => KeyZ,
        _ => return None,
    };
    Some(Bind::Key(k))
}

pub fn start_ptt(sh: Arc<Shared>) {
    std::thread::Builder::new().name("v1-ptt".into()).spawn(move || {
        let res = rdev::listen(move |ev| {
            let (b, down) = match ev.event_type {
                rdev::EventType::KeyPress(k) => (Bind::Key(k), true),
                rdev::EventType::KeyRelease(k) => (Bind::Key(k), false),
                rdev::EventType::ButtonPress(b) => (Bind::Button(b), true),
                rdev::EventType::ButtonRelease(b) => (Bind::Button(b), false),
                _ => return,
            };
            let want = bind_of(&sh.settings.lock().key);
            if want == Some(b) { sh.held.store(down, Ordering::Relaxed); }
        });
        if let Err(e) = res { eprintln!("v1 push-to-talk unavailable: {e:?}"); }
    }).expect("ptt thread");
}

#[tauri::command]
pub fn audio_devices() -> Value {
    let host = cpal::default_host();
    let names = |it: Option<Vec<cpal::Device>>| -> Vec<String> { it.unwrap_or_default().iter().filter_map(|d| d.name().ok()).collect() };
    json!({
        "inputs": names(host.input_devices().ok().map(|i| i.collect())),
        "outputs": names(host.output_devices().ok().map(|i| i.collect())),
    })
}
