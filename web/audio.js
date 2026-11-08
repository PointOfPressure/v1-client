/* V1 Client voice engine.
   Mic: getUserMedia -> AudioWorklet (20 ms chunks) -> WebCodecs Opus -> WebSocket [2, opus...]
   Speakers: WebSocket [1, uid(8), opus...] -> one AudioDecoder per user -> mixing worklet (jitter buffer per user). */
const WebVoice = (() => {
  const WORKLET = `
  class Cap extends AudioWorkletProcessor {
    constructor() { super(); this.buf = new Float32Array(960); this.n = 0; }
    process(inputs) {
      const ch = inputs[0] && inputs[0][0];
      if (!ch) return true;
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === 960) {
          let s = 0; for (let k = 0; k < 960; k++) s += this.buf[k] * this.buf[k];
          this.port.postMessage({ pcm: this.buf, rms: Math.sqrt(s / 960) }, [this.buf.buffer]);
          this.buf = new Float32Array(960); this.n = 0;
        }
      }
      return true;
    }
  }
  const PRE = 1920, MAX = 9600, TRIM = 2880; // 40 ms to start, 200 ms ceiling, trimmed back to 60 ms
  class Mix extends AudioWorkletProcessor {
    constructor() {
      super(); this.q = new Map(); this.gain = new Map();
      this.port.onmessage = (e) => {
        const d = e.data;
        if (d.t === 'gain') { this.gain.set(d.uid, d.g); return; }
        if (d.t === 'drop') { this.q.delete(d.uid); return; }
        let u = this.q.get(d.uid);
        if (!u) { u = { c: [], off: 0, len: 0, on: false }; this.q.set(d.uid, u); }
        u.c.push(d); u.len += d.l.length;
        if (u.len > MAX) while (u.len > TRIM && u.c.length > 1) { const x = u.c.shift(); u.len -= x.l.length - u.off; u.off = 0; }
      };
    }
    process(_in, outputs) {
      const L = outputs[0][0], R = outputs[0][1] || outputs[0][0], n = L.length;
      for (const [uid, u] of this.q) {
        if (!u.on) { if (u.len >= PRE) u.on = true; else continue; }
        const g = this.gain.has(uid) ? this.gain.get(uid) : 1;
        let i = 0;
        while (i < n && u.c.length) {
          const c = u.c[0], take = Math.min(n - i, c.l.length - u.off);
          for (let k = 0; k < take; k++) { L[i + k] += c.l[u.off + k] * g; R[i + k] += c.r[u.off + k] * g; }
          i += take; u.off += take; u.len -= take;
          if (u.off >= c.l.length) { u.c.shift(); u.off = 0; }
        }
        if (i < n) u.on = false; // ran dry: build a cushion again before resuming
      }
      return true;
    }
  }
  registerProcessor('v1cap', Cap);
  registerProcessor('v1mix', Mix);`;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('v1.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('v1.' + k, JSON.stringify(v)); } catch { /* fine */ } },
  };

  let ctx = null, stream = null, cap = null, mix = null, out = null, enc = null, getWs = null;
  let mode = store.get('mode', 'open'), key = store.get('pttKey', 'Backquote');
  let muted = false, deaf = false, held = false, gateUntil = 0, sending = false, ts = 0, level = 0;
  let threshold = store.get('threshold', -50);
  const decoders = new Map();
  const gains = store.get('gains', {});
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => f());

  function gateOpen(now) { return now < gateUntil; }
  function transmitting(now = performance.now()) {
    if (!ctx || muted || deaf) return false;
    return mode === 'ptt' ? held : gateOpen(now);
  }

  async function start(ws) {
    getWs = ws;
    if (ctx) return;
    if (!('AudioEncoder' in window) || !('AudioDecoder' in window)) throw new Error('this browser has no WebCodecs audio');
    ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
    // file:// pages cannot load blob: or file: worklets; a data: URL works
    await ctx.audioWorklet.addModule('data:text/javascript;base64,' + btoa(WORKLET));

    mix = new AudioWorkletNode(ctx, 'v1mix', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    out = ctx.createGain(); out.gain.value = deaf ? 0 : 1;
    mix.connect(out).connect(ctx.destination);
    for (const [uid, g] of Object.entries(gains)) mix.port.postMessage({ t: 'gain', uid, g });

    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
    const src = ctx.createMediaStreamSource(stream);
    cap = new AudioWorkletNode(ctx, 'v1cap', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
    const sink = ctx.createGain(); sink.gain.value = 0;
    src.connect(cap).connect(sink).connect(ctx.destination); // keeps the capture node pulled

    enc = new AudioEncoder({
      output: (chunk) => {
        const ws = getWs?.();
        if (!ws || ws.readyState !== 1 || ws.bufferedAmount > 32000) return;
        const b = new Uint8Array(chunk.byteLength + 1); b[0] = 2; chunk.copyTo(b.subarray(1)); ws.send(b);
      },
      error: (e) => console.warn('encoder', e),
    });
    enc.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 1, bitrate: 64000,
      opus: { frameDuration: 20000, complexity: 8, useinbandfec: true } });

    cap.port.onmessage = (e) => {
      const { pcm, rms } = e.data;
      const now = performance.now();
      const db = 20 * Math.log10(rms + 1e-9);
      level = db;
      if (db > threshold) gateUntil = now + 350;
      const tx = transmitting(now);
      if (tx !== sending) {
        sending = tx;
        if (!tx) getWs?.()?.readyState === 1 && getWs().send(JSON.stringify({ t: 'talkEnd' }));
        emit();
      }
      if (!tx || enc.state !== 'configured') return;
      const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: 960, numberOfChannels: 1, timestamp: ts, data: pcm });
      ts += 20000;
      enc.encode(ad); ad.close();
    };
    if (ctx.state !== 'running') await ctx.resume();
    emit();
  }

  function stop() {
    for (const d of decoders.values()) try { d.dec.close(); } catch { /* closed */ }
    decoders.clear();
    try { enc?.close(); } catch { /* closed */ }
    stream?.getTracks().forEach((t) => t.stop());
    ctx?.close();
    ctx = stream = cap = mix = out = enc = null;
    sending = false; held = false;
    emit();
  }

  function onPacket(buf) {
    if (!ctx || !mix) return;
    const view = new DataView(buf);
    const uid = view.getBigUint64(1).toString();
    let d = decoders.get(uid);
    if (!d || d.dec.state === 'closed') {
      const dec = new AudioDecoder({
        output: (ad) => {
          const n = ad.numberOfFrames, l = new Float32Array(n), r = new Float32Array(n);
          ad.copyTo(l, { planeIndex: 0, format: 'f32-planar' });
          if (ad.numberOfChannels > 1) ad.copyTo(r, { planeIndex: 1, format: 'f32-planar' }); else r.set(l);
          ad.close();
          mix?.port.postMessage({ uid, l, r }, [l.buffer, r.buffer]);
        },
        error: (e) => { console.warn('decoder', uid, e); decoders.delete(uid); },
      });
      dec.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2 });
      d = { dec, ts: 0 };
      decoders.set(uid, d);
    }
    d.dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: d.ts, data: new Uint8Array(buf, 9) }));
    d.ts += 20000;
  }

  function setHeld(v) {
    if (held === v) return;
    held = v;
    if (!v && sending && mode === 'ptt') { sending = false; getWs?.()?.readyState === 1 && getWs().send(JSON.stringify({ t: 'talkEnd' })); }
    emit();
  }

  return {
    native: false, start, stop, onPacket, setHeld,
    async join(vcId, wsSend, ws) { await start(ws); wsSend({ t: 'join', channelId: vcId }); },
    leave(wsSend) { wsSend({ t: 'leave' }); stop(); },
    ended() { stop(); },
    on: (f) => listeners.add(f),
    get active() { return !!ctx; },
    get mode() { return mode; },
    set mode(m) { mode = m; store.set('mode', m); emit(); },
    get key() { return key; },
    set key(k) { key = k; store.set('pttKey', k); emit(); },
    get muted() { return muted; },
    set muted(v) { muted = v; emit(); },
    get deaf() { return deaf; },
    set deaf(v) { deaf = v; if (out) out.gain.value = v ? 0 : 1; emit(); },
    get sending() { return sending; },
    get level() { return level; },
    get threshold() { return threshold; },
    set threshold(v) { threshold = v; store.set('threshold', v); },
    gain(uid) { return gains[uid] ?? 1; },
    setGain(uid, g) { gains[uid] = g; store.set('gains', gains); mix?.port.postMessage({ t: 'gain', uid, g }); },
  };
})();

/* In the V1 Client app (Tauri) voice runs natively: Rust captures, encodes, mixes and does global push-to-talk.
   The page only keeps the settings and shows the state. */
const NativeVoice = (() => {
  const store = {
    get(k, d) { try { const v = localStorage.getItem('v1.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('v1.' + k, JSON.stringify(v)); } catch { /* fine */ } },
  };
  const T = window.__TAURI__;
  const invoke = (c, a) => (T?.core?.invoke ?? window.__TAURI_INTERNALS__.invoke)(c, a);
  const dev = store.get('devices', {});
  const st = { mode: store.get('mode', 'open'), key: store.get('pttKey', 'Backquote'), muted: false, deaf: false,
    threshold: store.get('threshold', -50), gains: store.get('gains', {}), noise: store.get('noise', true), input: dev.input || null, output: dev.output || null };
  let active = false, sending = false, level = -100;
  const listeners = new Set(), errors = new Set();
  const emit = () => listeners.forEach((f) => f());
  const push = () => invoke('voice_set', { settings: st }).catch((e) => console.warn('voice_set', e));
  push();
  (T?.event?.listen ?? (() => Promise.resolve()))('v1-voice', ({ payload: p }) => {
    if (p.t === 'state') { const ch = p.sending !== sending; sending = p.sending; level = p.level; if (ch) emit(); }
    else if (p.t === 'error') errors.forEach((f) => f(p.error));
    else if (p.t === 'ended') { active = false; sending = false; emit(); }
  });
  return {
    native: true,
    async join(vcId) { active = true; emit(); await invoke('voice_join', { channelId: vcId }); },
    leave() { invoke('voice_leave'); active = false; sending = false; emit(); },
    ended() { if (active) invoke('voice_leave'); active = false; sending = false; emit(); },
    onPacket() {}, setHeld() {}, stop() { this.ended(); },
    on: (f) => listeners.add(f), onError: (f) => errors.add(f),
    get active() { return active; },
    get mode() { return st.mode; }, set mode(m) { st.mode = m; store.set('mode', m); push(); emit(); },
    get key() { return st.key; }, set key(k) { st.key = k; store.set('pttKey', k); push(); emit(); },
    get muted() { return st.muted; }, set muted(v) { st.muted = v; push(); emit(); },
    get deaf() { return st.deaf; }, set deaf(v) { st.deaf = v; push(); emit(); },
    get sending() { return sending; }, get level() { return level; },
    get threshold() { return st.threshold; }, set threshold(v) { st.threshold = v; store.set('threshold', v); push(); },
    get noise() { return st.noise; }, set noise(v) { st.noise = v; store.set('noise', v); push(); },
    devices(d) { st.input = d.input; st.output = d.output; push(); },
    gain(uid) { return st.gains[uid] ?? 1; },
    setGain(uid, g) { st.gains[uid] = g; store.set('gains', st.gains); push(); },
  };
})();
const Voice = window.V1_NATIVE ? NativeVoice : WebVoice;
if (!Voice.onError) Voice.onError = () => {};
