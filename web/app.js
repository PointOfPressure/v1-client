/* V1 Client: Discord as V1. Talks to client-api.js inside the V1 process on the Pi. */
(() => {
  const store = {
    get(k, d) { try { const v = localStorage.getItem('v1.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('v1.' + k, JSON.stringify(v)); } catch { /* fine */ } },
  };
  const API = window.V1_API || (location.protocol.startsWith('http') ? location.origin : '');
  let KEY = window.V1_KEY || store.get('key', '');
  if (!KEY) { KEY = (prompt('V1 Client key') || '').trim(); store.set('key', KEY); }
  const $ = (s, el = document) => el.querySelector(s);
  const esc = MD.esc;
  const NATIVE = !!window.V1_NATIVE;
  const invoke = (c, a) => (window.__TAURI__?.core?.invoke ?? window.__TAURI_INTERNALS__?.invoke)?.(c, a);
  const openUrl = (u) => { if (NATIVE) (window.__TAURI__?.core?.invoke ?? window.__TAURI_INTERNALS__.invoke)('open_url', { url: u }); else window.open(u, '_blank', 'noopener'); };
  const report = (msg) => { try { fetch(API + '/api/log', { method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ msg }) }); } catch { /* offline */ } };
  addEventListener('error', (e) => report(`${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}`));
  addEventListener('unhandledrejection', (e) => report('promise: ' + (e.reason?.message || e.reason)));
  // the page is http (from the bot's machine), where WebKit blocks navigator.clipboard: copy through a hidden textarea instead
  const copy = (t) => {
    const ok = () => {}, fallback = () => {
      const tx = document.createElement('textarea'); tx.value = t; tx.setAttribute('readonly', ''); tx.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.append(tx); tx.select(); tx.setSelectionRange(0, t.length);
      let done = false; try { done = document.execCommand('copy'); } catch { /* */ }
      tx.remove(); done ? ok() : toast('Copy failed: the clipboard is blocked here', true);
    };
    if (window.isSecureContext && navigator.clipboard?.writeText) navigator.clipboard.writeText(t).then(ok, fallback); else fallback();
  };

  const P = (d, extra = '') => `<svg viewBox="0 0 24 24"${extra}><path fill="currentColor" fill-rule="evenodd" d="${d}"/></svg>`;
  const I = {
    hash: P('M10.99 3.16A1 1 0 1 0 9 2.84L8.15 8H4a1 1 0 0 0 0 2h3.82l-.67 4H3a1 1 0 1 0 0 2h3.82l-.8 4.84a1 1 0 0 0 1.97.32L8.85 16h4.97l-.8 4.84a1 1 0 0 0 1.97.32l.86-5.16H20a1 1 0 1 0 0-2h-3.82l.67-4H21a1 1 0 1 0 0-2h-3.82l.8-4.84a1 1 0 1 0-1.97-.32L15.15 8h-4.97l.8-4.84ZM14.15 14l.67-4H9.85l-.67 4h4.97Z', ' class="hash"'),
    speaker: P('M12 3a1 1 0 0 0-1-1h-.06a1 1 0 0 0-.74.32L5.92 7H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.92l4.28 4.68a1 1 0 0 0 .74.32H11a1 1 0 0 0 1-1V3ZM15.1 20.75c-.58.14-1.1-.33-1.1-.92v-.03c0-.5.37-.92.85-1.05a7 7 0 0 0 0-13.5A1.11 1.11 0 0 1 14 4.2v-.03c0-.6.52-1.06 1.1-.92a9 9 0 0 1 0 17.5ZM15.16 16.51c-.57.28-1.16-.2-1.16-.83v-.14c0-.43.28-.8.63-1.02a3 3 0 0 0 0-5.04c-.35-.23-.63-.6-.63-1.02v-.14c0-.63.59-1.1 1.16-.83a5 5 0 0 1 0 9.02Z', ' class="hash"'),
    chat: P('M12 22a10 10 0 1 0-8.45-4.64c.13.19.11.44-.04.61l-2.06 2.37A1 1 0 0 0 2.2 22H12Z'),
    mic: P('M12 2a4 4 0 0 0-4 4v4a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4ZM6 10a1 1 0 0 0-2 0 8 8 0 0 0 7 7.94V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.06A8 8 0 0 0 20 10a1 1 0 1 0-2 0 6 6 0 0 1-12 0Z'),
    micOff: P('m2.7 22.7 20-20a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4ZM10.8 17.32c-.21.21-.1.58.2.62V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.06A8 8 0 0 0 20 10a1 1 0 0 0-2 0c0 1.45-.52 2.79-1.38 3.83l-.02.02A5.99 5.99 0 0 1 12.32 16a.52.52 0 0 0-.34.15l-1.18 1.18ZM15.36 4.52c.15-.15.19-.38.08-.56A4 4 0 0 0 8 6v4c0 .3.03.58.1.86.07.34.49.43.74.18l6.52-6.52ZM5.06 13.98c.16.28.53.31.75.09l.75-.75c.16-.16.19-.4.08-.61A5.97 5.97 0 0 1 6 10a1 1 0 0 0-2 0c0 1.45.39 2.81 1.06 3.98Z'),
    head: P('M12 3a9 9 0 0 0-8 13.1V19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5.07a7 7 0 1 1 13.86 0H17a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-2.9A9 9 0 0 0 12 3Z'),
    headOff: P('M22.7 2.7a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4l20-20ZM17.5 10.62l1.5-1.5c.15-.15.4-.1.46.1A9 9 0 0 1 20 12v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-4c0-.88.58-1.62 1.37-1.89a.6.6 0 0 0 .4-.48c.1-.66.35-1.34.73-1.97v-.14ZM6.6 14.4a.5.5 0 0 0 .46-.13l7.3-7.3a.5.5 0 0 0-.18-.83A7 7 0 0 0 5.07 13H7c-.15 0-.28.02-.4.4ZM3.97 15.36a.5.5 0 0 1-.1-.58A9 9 0 0 1 15.6 3.74a.5.5 0 0 1 .17.82l-.73.73a.5.5 0 0 1-.5.12A7 7 0 0 0 5.06 13.4l-1.09 1.96Z'),
    gear: P('M10.56 1.1c-.46.05-.7.53-.64.98.18 1.16-.19 2.2-.98 2.53-.8.33-1.79-.15-2.49-1.1-.27-.36-.78-.52-1.14-.24-.77.59-1.45 1.27-2.04 2.04-.28.36-.12.87.24 1.14.96.7 1.43 1.7 1.1 2.49-.33.8-1.37 1.16-2.53.98-.45-.07-.93.18-.99.64a11.1 11.1 0 0 0 0 2.88c.06.46.54.7.99.64 1.16-.18 2.2.19 2.53.98.33.8-.14 1.79-1.1 2.49-.36.27-.52.78-.24 1.14.59.77 1.27 1.45 2.04 2.04.36.28.87.12 1.14-.24.7-.95 1.7-1.43 2.49-1.1.8.33 1.16 1.37.98 2.53-.07.45.18.93.64.99a11.1 11.1 0 0 0 2.88 0c.46-.06.7-.54.64-.99-.18-1.16.19-2.2.98-2.53.8-.33 1.79.14 2.49 1.1.27.36.78.52 1.14.24.77-.59 1.45-1.27 2.04-2.04.28-.36.12-.87-.24-1.14-.96-.7-1.43-1.7-1.1-2.49.33-.8 1.37-1.16 2.53-.98.45.07.93-.18.99-.64a11.1 11.1 0 0 0 0-2.88c-.06-.46-.54-.7-.99-.64-1.16.18-2.2-.19-2.53-.98-.33-.8.14-1.79 1.1-2.49.36-.27.52-.78.24-1.14a11.07 11.07 0 0 0-2.04-2.04c-.36-.28-.87-.12-1.14.24-.7.96-1.7 1.43-2.49 1.1-.8-.33-1.16-1.37-.98-2.53.07-.45-.18-.93-.64-.99a11.1 11.1 0 0 0-2.88 0ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'),
    leave: P('M21.1 13.6c.6-.6.9-1.4.9-2.3 0-1.1-.5-2-1.4-2.6A16.4 16.4 0 0 0 12 6.5c-3.1 0-6.1.8-8.6 2.2-.9.6-1.4 1.5-1.4 2.6 0 .9.3 1.7.9 2.3l.6.6c.7.7 1.8.7 2.5.1l1.5-1.2c.5-.4.7-1 .6-1.6l-.2-.9a12.7 12.7 0 0 1 8.2 0l-.2.9c-.1.6.1 1.2.6 1.6l1.5 1.2c.7.6 1.8.6 2.5-.1l.6-.6Z'),
    plus: P('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 6a1 1 0 1 0-2 0v3H8a1 1 0 1 0 0 2h3v3a1 1 0 1 0 2 0v-3h3a1 1 0 1 0 0-2h-3V8Z'),
    smile: P('M12 23a11 11 0 1 0 0-22 11 11 0 0 0 0 22ZM6.5 13a1 1 0 0 0-.98 1.2 6.6 6.6 0 0 0 12.96 0 1 1 0 0 0-.98-1.2h-11ZM8.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm8.5-1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z'),
    reply: P('M2.3 7.3a1 1 0 0 0 0 1.4l5 5a1 1 0 0 0 1.4-1.4L5.42 9H11a7 7 0 0 1 7 7v4a1 1 0 1 0 2 0v-4a9 9 0 0 0-9-9H5.41l3.3-3.3a1 1 0 0 0-1.42-1.4l-5 5Z'),
    edit: P('m13.96 5.46 4.58 4.58a1 1 0 0 0 1.42 0l1.38-1.38a2 2 0 0 0 0-2.82l-3.18-3.18a2 2 0 0 0-2.82 0l-1.38 1.38a1 1 0 0 0 0 1.42ZM2.11 20.16l.73-4.22a3 3 0 0 1 .83-1.61l7.87-7.87a1 1 0 0 1 1.42 0l4.58 4.58a1 1 0 0 1 0 1.42l-7.87 7.87a3 3 0 0 1-1.6.83l-4.23.73a1.5 1.5 0 0 1-1.73-1.73Z'),
    trash: P('M14.25 1c.41 0 .75.34.75.75V3h5.25c.41 0 .75.34.75.75v.5c0 .41-.34.75-.75.75H3.75A.75.75 0 0 1 3 4.25v-.5c0-.41.34-.75.75-.75H9V1.75c0-.41.34-.75.75-.75h4.5ZM5.06 7a1 1 0 0 0-1 1.06l.76 12.13a3 3 0 0 0 3 2.81h8.36a3 3 0 0 0 3-2.81l.75-12.13a1 1 0 0 0-1-1.06H5.07ZM11 12a1 1 0 1 0-2 0v6a1 1 0 1 0 2 0v-6Zm3-1a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z'),
    file: P('M6 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V9h-5a3 3 0 0 1-3-3V2H6Zm9 .4V6a1 1 0 0 0 1 1h3.6L15 2.4Z'),
    x: P('M17.3 18.7a1 1 0 0 0 1.4-1.4L13.42 12l5.3-5.3a1 1 0 0 0-1.42-1.4L12 10.58l-5.3-5.3a1 1 0 0 0-1.4 1.42L10.58 12l-5.3 5.3a1 1 0 1 0 1.42 1.4L12 13.42l5.3 5.3Z', ' width="16" height="16"'),
    people: P('M14.5 8a3 3 0 1 0-2.7-4.3c-.2.4.06.86.44 1.12a5 5 0 0 1 2.14 3.08c.01.06.06.1.12.1ZM18.44 17.27c.15.43.54.73 1 .73h1.06c.83 0 1.5-.67 1.5-1.5a7.5 7.5 0 0 0-6.5-7.43c-.55-.08-.99.38-1.1.92-.06.3-.15.6-.26.87-.23.58-.05 1.3.47 1.63a9.53 9.53 0 0 1 3.83 4.78ZM12.5 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM2 20.5a7.5 7.5 0 0 1 15 0c0 .83-.67 1.5-1.5 1.5a.2.2 0 0 1-.2-.16c-.2-.96-.56-1.87-.88-2.54-.1-.23-.42-.15-.42.1v2.1a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-2.1c0-.25-.31-.33-.42-.1-.32.67-.67 1.58-.88 2.54a.2.2 0 0 1-.2.16A1.5 1.5 0 0 1 2 20.5Z'),
    dm: P('M19.73 4.87a18.2 18.2 0 0 0-4.6-1.44c-.21.4-.4.8-.58 1.21-1.69-.25-3.4-.25-5.1 0-.18-.41-.37-.82-.59-1.2-1.6.27-3.14.75-4.6 1.43A19.04 19.04 0 0 0 .96 17.7a18.43 18.43 0 0 0 5.63 2.87c.46-.62.86-1.28 1.2-1.98-.65-.25-1.29-.55-1.9-.92.17-.12.32-.24.47-.37 3.58 1.7 7.7 1.7 11.28 0l.46.37c-.6.36-1.25.67-1.9.92.35.7.75 1.35 1.2 1.98 2.03-.63 3.94-1.6 5.64-2.87.47-4.87-.78-9.09-3.3-12.83ZM8.3 15.12c-1.1 0-2-1.02-2-2.27 0-1.24.88-2.26 2-2.26s2.02 1.02 2 2.26c0 1.25-.89 2.27-2 2.27Zm7.4 0c-1.1 0-2-1.02-2-2.27 0-1.24.88-2.26 2-2.26s2.02 1.02 2 2.26c0 1.25-.88 2.27-2 2.27Z'),
    bell: P('M9.7 2.1c.18-.38.6-.6 1.02-.6h2.56c.42 0 .84.22 1.02.6.28.6.48 1.23.6 1.88 2.97.94 4.1 3.6 4.1 6.52v3l1.5 2.5a1 1 0 0 1-.86 1.5H4.36a1 1 0 0 1-.86-1.5L5 13.5v-3c0-2.92 1.13-5.58 4.1-6.52.12-.65.32-1.28.6-1.88ZM10 20a2 2 0 1 0 4 0h-4Z'),
    bellOff: P('M1.3 21.3a1 1 0 1 0 1.4 1.4l20-20a1 1 0 0 0-1.4-1.4l-20 20ZM14.33 3.98A7.13 7.13 0 0 1 17.6 6.3L5 18.9V18H4.36a1 1 0 0 1-.86-1.5L5 13.5v-3c0-2.92 1.13-5.58 4.1-6.52.12-.65.32-1.28.6-1.88.18-.38.6-.6 1.02-.6h2.56c.42 0 .84.22 1.02.6.28.6.48 1.23.6 1.88ZM19 10.83V13.5l1.5 2.5a1 1 0 0 1-.86 1.5H12.33L19 10.83ZM10 20a2 2 0 1 0 4 0h-4Z'),
    caret: P('M5.3 9.3a1 1 0 0 1 1.4 0l5.3 5.29 5.3-5.3a1 1 0 1 1 1.4 1.42l-6 6a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1 0-1.42Z'),
    crown: '<svg viewBox="0 0 24 24" width="14" height="14" style="flex:none"><path fill="#f0b232" d="M5 18a1 1 0 0 0-1 1 3 3 0 0 0 3 3h10a3 3 0 0 0 3-3 1 1 0 0 0-1-1H5ZM3.04 7.76a1 1 0 0 0-1.52 1.15l2.25 6.42a1 1 0 0 0 .94.67h14.55a1 1 0 0 0 .95-.71l1.94-6.45a1 1 0 0 0-1.55-1.1l-4.11 3-3.55-5.33.82-.82a.83.83 0 0 0 0-1.18l-1.17-1.17a.83.83 0 0 0-1.18 0l-1.17 1.17a.83.83 0 0 0 0 1.18l.82.82-3.61 5.42-4.41-3.07Z"/></svg>',
    pin: P('M19.38 11.38a3 3 0 0 0 4.24 0l.03-.03a.5.5 0 0 0 0-.7L13.35.35a.5.5 0 0 0-.7 0l-.03.03a3 3 0 0 0 0 4.24L13 5l-2.92 2.92-3.65-.34a2 2 0 0 0-1.6.58l-.62.63a1 1 0 0 0 0 1.42l9.58 9.58a1 1 0 0 0 1.42 0l.63-.63a2 2 0 0 0 .58-1.6l-.34-3.64L19 11l.38.38ZM9.07 17.07a.5.5 0 0 1-.08.77l-5.15 3.43a.5.5 0 0 1-.63-.06l-.42-.42a.5.5 0 0 1-.06-.63L6.16 15a.5.5 0 0 1 .77-.08l2.14 2.14Z'),
    announce: P('M19.56 2a3 3 0 0 0-2.46 1.28 3.85 3.85 0 0 1-1.86 1.42l-8.9 3.18a.5.5 0 0 0-.34.47v10.3c0 .2.12.39.3.46l.62.27a.5.5 0 0 0 .7-.4l.23-1.5a.5.5 0 0 1 .65-.4l7.6 2.72c.7.25 1.32.7 1.8 1.27A3 3 0 0 0 22 19.2V4.84A2.84 2.84 0 0 0 19.56 2ZM4 18.4c0 .23-.2.4-.42.37l-.48-.07A1.3 1.3 0 0 1 2 17.42V10.6c0-.64.47-1.19 1.1-1.28l.48-.07c.22-.04.42.14.42.37v8.8Z', ' class="hash"'),
    rules: P('M4 4a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V4Zm12.7 4.7a1 1 0 0 0-1.4-1.4L11 11.58l-1.3-1.3a1 1 0 0 0-1.4 1.42l2 2a1 1 0 0 0 1.4 0l5-5ZM8 16a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8Z', ' class="hash"'),
    forum: P('M18.91 12.98a5.45 5.45 0 0 1 2.18 6.2c-.1.33-.09.68.1.96l.83 1.32a.5.5 0 0 1-.42.76h-4.6a5.6 5.6 0 0 1-3.03-.87A5.46 5.46 0 0 1 18.9 13ZM16.4 9.57a7.2 7.2 0 0 0-5.85 9.68.5.5 0 0 1-.46.67H6.48a.5.5 0 0 1-.36-.15l-1.3-1.33A8 8 0 1 1 16.4 9.57Z', ' class="hash"'),
    stage: P('M19.61 18.25a1.08 1.08 0 0 1-.07-1.33 9 9 0 1 0-15.07 0c.26.42.25.97-.08 1.33l-.02.02c-.41.44-1.12.43-1.46-.07a11 11 0 1 1 18.17 0c-.33.5-1.04.51-1.45.07l-.02-.02ZM16.83 15.23c.43.47 1.18.42 1.45-.14a7 7 0 1 0-12.57 0c.28.56 1.03.6 1.46.14l.03-.03c.3-.33.35-.81.17-1.23A4.98 4.98 0 0 1 12 7a5 5 0 0 1 4.6 6.97c-.17.42-.13.9.18 1.23l.05.03ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM6.33 20.03c-.25.72.12 1.5.8 1.84a10.96 10.96 0 0 0 9.73 0 1.5 1.5 0 0 0 .8-1.84 6 6 0 0 0-11.33 0Z', ' class="hash"'),
    hashLock: '<svg viewBox="0 0 24 24" class="hash"><path fill="currentColor" fill-rule="evenodd" d="M16 4h.5v-.5a2.5 2.5 0 0 1 5 0V4h.5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm4-.5V4h-2v-.5a1 1 0 1 1 2 0Z"/><path fill="currentColor" d="M12.5 8c.28 0 .5.22.5.5V9c0 .1 0 .2.02.31.03.34-.21.69-.56.69H9.85l-.67 4h4.97l.28-1.68c.06-.34.44-.52.77-.43a3 3 0 0 0 .8.11c.27 0 .47.24.43.5l-.25 1.5H20a1 1 0 1 1 0 2h-4.15l-.86 5.16a1 1 0 0 1-1.98-.32l.8-4.84H8.86l-.86 5.16A1 1 0 0 1 6 20.84L6.82 16H3a1 1 0 1 1 0-2h4.15l.67-4H4a1 1 0 1 1 0-2h4.15l.86-5.16a1 1 0 1 1 1.98.32L10.19 8h2.31Z"/></svg>',
    speakerLock: '<svg viewBox="0 0 24 24" class="hash"><path fill="currentColor" fill-rule="evenodd" d="M16 4h.5v-.5a2.5 2.5 0 0 1 5 0V4h.5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm4-.5V4h-2v-.5a1 1 0 1 1 2 0Z"/><path fill="currentColor" d="M11 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1h-.06a1 1 0 0 1-.74-.32L5.92 17H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h2.92l4.28-4.68a1 1 0 0 1 .74-.32H11ZM20.5 12c-.28 0-.5.22-.52.5a7 7 0 0 1-5.13 6.25c-.48.13-.85.55-.85 1.05v.03c0 .6.52 1.06 1.1.92a9 9 0 0 0 6.89-8.25.48.48 0 0 0-.49-.5h-1ZM16.5 12c-.28 0-.5.23-.54.5a3 3 0 0 1-1.33 2.02c-.35.23-.63.6-.63 1.02v.14c0 .63.59 1.1 1.16.83a5 5 0 0 0 2.82-4.01c.02-.28-.2-.5-.48-.5h-1Z"/></svg>',
    stageLock: '<svg viewBox="0 0 24 24" class="hash"><path fill="currentColor" d="M21.92 14.08c.32.27.86.15.93-.26A11 11 0 1 0 2.91 18.2c.34.5 1.05.51 1.46.07l.02-.02c.33-.36.34-.91.07-1.33a9 9 0 1 1 16.48-3.88c-.03.22.1.44.29.55.24.14.48.3.7.49Z"/><path fill="currentColor" d="M13.48 16.18c.39.1.45.62.2.93A2.99 2.99 0 0 0 13 19v3.5c0 .26-.2.47-.46.49a11.16 11.16 0 0 1-5.4-1.12 1.52 1.52 0 0 1-.8-1.84 6 6 0 0 1 7.14-3.85ZM18.98 12.58c-.02.24-.23.42-.48.45-.18.02-.35.05-.53.09-.45.1-1-.36-.98-.82L17 12a5 5 0 1 0-9.6 1.94c.17.42.13.9-.18 1.23l-.05.06c-.43.47-1.18.42-1.45-.14a7 7 0 1 1 13.26-2.51Z"/><path fill="currentColor" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path fill="currentColor" fill-rule="evenodd" d="M16.5 18H16a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-.5v-.5a2.5 2.5 0 0 0-5 0v.5Zm3.5 0v-.5a1 1 0 1 0-2 0v.5h2Z"/></svg>',
    announceLock: '<svg viewBox="0 0 24 24" class="hash"><path fill="currentColor" fill-rule="evenodd" d="M16 4h.5v-.5a2.5 2.5 0 0 1 5 0V4h.5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm4-.5V4h-2v-.5a1 1 0 1 1 2 0Z"/><path fill="currentColor" fill-rule="evenodd" d="M12.33 5.74a.5.5 0 0 1 .67.47V9a3 3 0 0 0 3 3h5.5c.28 0 .5.22.5.5v8c0 .83-.67 1.5-1.5 1.5h-.94a3 3 0 0 1-2.46-1.28 3.86 3.86 0 0 0-1.07-1.03l-2.36-.94a.92.92 0 0 0-1.23.63 2.92 2.92 0 0 1-3.55 2.12l-.62-.15A3 3 0 0 1 6 18.44V8.35c0-.2.13-.4.33-.47l6-2.14Zm-1.3 12.06L8 16.7v1.73a1 1 0 0 0 .76.97l.62.15c.5.13 1-.17 1.12-.67.1-.41.29-.78.53-1.1Z"/><path fill="currentColor" d="M2 10c0-1.1.9-2 2-2h.5c.28 0 .5.22.5.5v7a.5.5 0 0 1-.5.5H4a2 2 0 0 1-2-2v-4Z"/></svg>',
    forumLock: '<svg viewBox="0 0 24 24" class="hash"><path fill="currentColor" fill-rule="evenodd" d="M16 4h.5v-.5a2.5 2.5 0 0 1 5 0V4h.5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm4-.5V4h-2v-.5a1 1 0 1 1 2 0Z"/><path fill="currentColor" d="M13.58 3.23c.24-.33.16-.86-.24-.96C12.59 2.1 11.8 2 11 2c-4.97 0-9 3.58-9 8 0 1.5.47 2.91 1.28 4.11.14.21.12.49-.06.67l-1.51 1.51A1 1 0 0 0 2.4 18h5.1a.5.5 0 0 0 .49-.5c0-3.17 2-5.82 4.77-6.94.29-.11.43-.45.34-.75A3 3 0 0 1 13 9V5c0-.66.22-1.28.58-1.77ZM18.91 12.98a5.45 5.45 0 0 1 2.18 6.2c-.1.33-.09.68.1.96l.83 1.32a1 1 0 0 1-.84 1.54h-5.5A5.6 5.6 0 0 1 10 17.5a5.6 5.6 0 0 1 5.68-5.5c1.2 0 2.32.36 3.23.98Z"/></svg>',
    lock: '<svg class="lockb" viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" fill-rule="evenodd" d="M6 9h1V6a5 5 0 0 1 10 0v3h1a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3Zm9-3v3H9V6a3 3 0 1 1 6 0Z"/></svg>',
    invite: P('M19 14a1 1 0 0 1 1 1v3h3a1 1 0 0 1 0 2h-3v3a1 1 0 0 1-2 0v-3h-3a1 1 0 1 1 0-2h3v-3a1 1 0 0 1 1-1ZM12.5 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9ZM10 13h4.36c.26 0 .41.29.26.5a5.48 5.48 0 0 0-.64 5.03c.08.22-.08.47-.32.47H3.5a.5.5 0 0 1-.5-.5v-.5a4.5 4.5 0 0 1 4.5-4.5H10Z'),
    search: P('M15.62 17.03a9 9 0 1 1 1.41-1.41l4.68 4.67a1 1 0 0 1-1.42 1.42l-4.67-4.68ZM17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z'),
    threads: P('M12 2.81a1 1 0 0 1 0-1.41l.36-.36a1 1 0 0 1 1.41 0l9.2 9.2a1 1 0 0 1 0 1.4l-.7.7a1 1 0 0 1-1.3.13l-9.54-6.72a1 1 0 0 1-.08-1.58l1-1L12 2.8ZM12 21.2a1 1 0 0 1 0 1.41l-.35.35a1 1 0 0 1-1.41 0l-9.2-9.19a1 1 0 0 1 0-1.41l.7-.7a1 1 0 0 1 1.3-.12l9.54 6.72a1 1 0 0 1 .07 1.58l-1 1 .35.36ZM15.66 16.8a1 1 0 0 1-1.38.28l-8.49-5.66A1 1 0 1 1 6.9 9.76l8.49 5.65a1 1 0 0 1 .27 1.39ZM17.1 14.25a1 1 0 1 0 1.11-1.66L9.73 6.93a1 1 0 0 0-1.11 1.66l8.49 5.66Z'),
    clock: P('M12 23a11 11 0 1 0 0-22 11 11 0 0 0 0 22Zm1-18a1 1 0 1 0-2 0v7c0 .27.1.52.3.7l3 3a1 1 0 0 0 1.4-1.4L13 11.58V5Z'),
    translate: P('M2 5a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v2h4a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3v-2H5a3 3 0 0 1-3-3V5Zm6 1a1 1 0 0 1 1 1h2a1 1 0 1 1 0 2h-.35a8.2 8.2 0 0 1-1.6 3.04c.58.41 1.24.75 1.95.97V15a8.7 8.7 0 0 1-3.04-1.6A8.7 8.7 0 0 1 5 15a1 1 0 1 1 0-2c.78 0 1.5-.2 2.13-.55A6.2 6.2 0 0 1 6 9a1 1 0 0 1 2 0c.08.56.3 1.08.62 1.53A6.1 6.1 0 0 0 8.6 9H5a1 1 0 0 1 0-2h2a1 1 0 0 1 1-1Zm9.5 6.5a1 1 0 0 0-1.9 0l-2.5 6a1 1 0 1 0 1.8.8l.4-1.3h2.4l.4 1.3a1 1 0 0 0 1.9-.8l-2.5-6Zm-.95 3.5h-1.1l.55-1.5.55 1.5Z'),
    sticker: P('M5 2h14a3 3 0 0 1 3 3v9h-5a3 3 0 0 0-3 3v5H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm11 20v-5a1 1 0 0 1 1-1h5l-6 6ZM8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM7.5 12a.75.75 0 0 0-.7 1.03 5.6 5.6 0 0 0 5.2 3.47.75.75 0 0 0 0-1.5 4.1 4.1 0 0 1-3.8-2.53.75.75 0 0 0-.7-.47Z'),
    mobile: '<svg class="plat" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H8Zm2 16a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2h-4Z"/></svg>',
    desktop: '<svg class="plat" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M4 3a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h7v2H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-2h7a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H4Z"/></svg>',
    web: '<svg class="plat" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.93 6h-2.95a15.7 15.7 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.93 8ZM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82A14 14 0 0 1 12 4.04ZM4.26 14a8.1 8.1 0 0 1 0-4h3.38a16.5 16.5 0 0 0 0 4H4.26Zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 0 1 5.08 16Zm2.95-8H5.08a7.99 7.99 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.03 8ZM12 19.96A14.1 14.1 0 0 1 10.09 16h3.82A14.1 14.1 0 0 1 12 19.96ZM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4Zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56ZM16.36 14a16.5 16.5 0 0 0 0-4h3.38a8.1 8.1 0 0 1 0 4h-3.38Z"/></svg>',
    back: P('M3.3 11.3a1 1 0 0 0 0 1.4l7 7a1 1 0 0 0 1.4-1.4L6.42 13H20a1 1 0 1 0 0-2H6.41l5.3-5.3a1 1 0 0 0-1.42-1.4l-7 7Z'),
    fwd: P('M20.7 12.7a1 1 0 0 0 0-1.4l-7-7a1 1 0 1 0-1.4 1.4l5.29 5.3H4a1 1 0 1 0 0 2h13.59l-5.3 5.3a1 1 0 0 0 1.42 1.4l7-7Z'),
    min: '<svg viewBox="0 0 12 12" width="12" height="12"><rect fill="currentColor" width="10" height="1.2" x="1" y="6"/></svg>',
    max: '<svg viewBox="0 0 12 12" width="12" height="12"><rect fill="none" stroke="currentColor" stroke-width="1.2" width="9" height="9" x="1.5" y="1.5"/></svg>',
    close: '<svg viewBox="0 0 12 12" width="12" height="12"><path stroke="currentColor" stroke-width="1.3" d="M1.5 1.5l9 9m0-9l-9 9"/></svg>',
    people1: P('M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm-9 9a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7 1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z'),
    at: P('M16.32 14.72a1 1 0 0 1 0 1.41l-.71.7a7 7 0 1 1 2.28-5.17c0 .92-.36 1.8-1 2.45a3.37 3.37 0 0 1-4.76 0l-.03-.03A4 4 0 1 1 16 11.7c0 .38.15.74.42 1a1.37 1.37 0 0 0 1.94 0c.27-.26.42-.62.42-1a5 5 0 1 0-1.63 3.7 1 1 0 0 1 1.41 0l-.24-.24ZM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'),
    shield: P('M12 1.5a1 1 0 0 1 .5.13l8 4.5a1 1 0 0 1 .5.87c0 5.45-2.65 11.3-8.62 14.86a1 1 0 0 1-.76 0C5.65 18.3 3 12.45 3 7a1 1 0 0 1 .5-.87l8-4.5a1 1 0 0 1 .5-.13Z'),
    kick: P('M14.5 8a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM10 14c-3.87 0-7 2.69-7 6a1 1 0 0 0 1 1h9.5a.5.5 0 0 0 .36-.85A5.97 5.97 0 0 1 14 16.5a.5.5 0 0 0-.4-.49A10.5 10.5 0 0 0 10 14ZM15 18a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1Z'),
    hammer: P('M13.6 3.4a2 2 0 0 1 2.82 0l4.18 4.18a2 2 0 0 1 0 2.82l-1.41 1.42a2 2 0 0 1-2.83 0l-.7-.7-6.37 6.36.7.71a2 2 0 0 1 0 2.83l-1.41 1.41a2 2 0 0 1-2.83 0L1.58 18.2a2 2 0 0 1 0-2.83L3 13.96a2 2 0 0 1 2.83 0l.7.7 6.37-6.36-.71-.7a2 2 0 0 1 0-2.83L13.6 3.4Z'),
    idcard: P('M3 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H3Zm3 4a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Zm4 0a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h3a4 4 0 0 0 0-8h-3Zm1 6V10h2a2 2 0 1 1 0 4h-2Z'),
    copy: P('M3 16a1 1 0 0 1-1-1v-5a8 8 0 0 1 8-8h5a1 1 0 0 1 1 1v.5a.5.5 0 0 1-.5.5H10a6 6 0 0 0-6 6v5.5a.5.5 0 0 1-.5.5H3ZM6 18a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-8a4 4 0 0 0-4-4h-8a4 4 0 0 0-4 4v8Z'),
    fwdi: P('M21.7 7.3a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4l3.29-3.3H13a7 7 0 0 0-7 7v4a1 1 0 1 1-2 0v-4a9 9 0 0 1 9-9h5.59l-3.3-3.3a1 1 0 0 1 1.42-1.4l5 5Z'),
    link: P('M16.32 14.72a1 1 0 0 1 0-1.41l2.51-2.51a3.98 3.98 0 0 0-5.62-5.63l-2.52 2.51a1 1 0 0 1-1.41-1.41l2.52-2.52a5.98 5.98 0 0 1 8.45 8.46l-2.52 2.51a1 1 0 0 1-1.41 0ZM7.68 9.29a1 1 0 0 1 0 1.41l-2.52 2.51a3.98 3.98 0 1 0 5.63 5.63l2.51-2.52a1 1 0 0 1 1.42 1.42l-2.52 2.51a5.98 5.98 0 0 1-8.45-8.45l2.51-2.51a1 1 0 0 1 1.42 0ZM14.7 10.7a1 1 0 0 0-1.4-1.4l-4 4a1 1 0 1 0 1.4 1.4l4-4Z'),
    folder: P('M2 5a3 3 0 0 1 3-3h3.93a2 2 0 0 1 1.66.9L12 5h7a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5Z'),
    poll: P('M5 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H5Zm2 13a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2H7Zm-1-4a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1-5a1 1 0 0 0 0 2h10a1 1 0 1 0 0-2H7Z'),
    embed: P('M5 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H5Zm1 4a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2H6Zm0 4a1 1 0 1 0 0 2h12a1 1 0 1 0 0-2H6Zm0 4a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2H6Z'),
    speakerS: P('M12 3a1 1 0 0 0-1-1h-.06a1 1 0 0 0-.74.32L5.92 7H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.92l4.28 4.68a1 1 0 0 0 .74.32H11a1 1 0 0 0 1-1V3ZM15.16 16.51c-.57.28-1.16-.2-1.16-.83v-.14c0-.43.28-.8.63-1.02a3 3 0 0 0 0-5.04c-.35-.23-.63-.6-.63-1.02v-.14c0-.63.59-1.1 1.16-.83a5 5 0 0 1 0 9.02Z'),
    announceS: P('M19.56 2a3 3 0 0 0-2.46 1.28 3.85 3.85 0 0 1-1.86 1.42l-8.9 3.18a.5.5 0 0 0-.34.47v10.3c0 .2.12.39.3.46l.62.27a.5.5 0 0 0 .7-.4l.23-1.5a.5.5 0 0 1 .65-.4l7.6 2.72c.7.25 1.32.7 1.8 1.27A3 3 0 0 0 22 19.2V4.84A2.84 2.84 0 0 0 19.56 2Z'),
    image: P('M2 5a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5Zm13.35 8.13 3.5 4.67c.37.5.02 1.2-.6 1.2H5.81a.75.75 0 0 1-.59-1.22l1.86-2.32a1.5 1.5 0 0 1 2.34 0l.5.64 2.23-2.97a2 2 0 0 1 3.2 0ZM10.5 7.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z'),
    star: P('M10.81 2.86c.38-1.15 2-1.15 2.38 0l1.89 5.83h6.12c1.2 0 1.71 1.54.73 2.25l-4.95 3.6 1.9 5.82a1.25 1.25 0 0 1-1.93 1.4L12 18.16l-4.95 3.6c-.98.7-2.3-.25-1.92-1.4l1.89-5.82-4.95-3.6c-.98-.71-.48-2.25.73-2.25h6.12l1.9-5.83Z'),
    gif: P('M2 5a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5Zm3.58 4.1A2.96 2.96 0 0 1 8.6 7.7c.98 0 1.73.36 2.23 1a1 1 0 1 1-1.58 1.23c-.1-.12-.25-.23-.65-.23-.41 0-.6.15-.73.32-.17.22-.32.62-.32 1.21v1.53c0 .58.15.98.32 1.2.13.17.32.32.73.32.4 0 .58-.13.68-.25.06-.07.12-.19.15-.35H9a1 1 0 1 1 0-2h1.5a1 1 0 0 1 1 1v.5c0 .76-.2 1.53-.73 2.13A2.88 2.88 0 0 1 8.6 16.3c-1.04 0-1.84-.43-2.36-1.1-.5-.65-.73-1.5-.73-2.42v-1.53c0-.92.23-1.78.73-2.43l-.66.27ZM13.5 7.75a1 1 0 0 1 1 1v6.5a1 1 0 1 1-2 0v-6.5a1 1 0 0 1 1-1Zm3 0a1 1 0 0 0-1 1v6.5a1 1 0 1 0 2 0V13h1.5a1 1 0 1 0 0-2H17.5V9.75h2a1 1 0 1 0 0-2h-3Z'),
    play: P('M9.25 3.35C7.87 2.45 6 3.38 6 4.96v14.08c0 1.58 1.87 2.5 3.25 1.61l10.85-7.04a1.9 1.9 0 0 0 0-3.22L9.25 3.35Z'),
    pause: P('M6 4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H6ZM15 4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3Z'),
    download: P('M12 2a1 1 0 0 1 1 1v10.59l3.3-3.3a1 1 0 1 1 1.4 1.42l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.42l3.3 3.3V3a1 1 0 0 1 1-1ZM3 20a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2H3Z'),
    reload: P('M4 12a8 8 0 0 1 14.93-4H16a1 1 0 1 0 0 2h5a1 1 0 0 0 1-1V4a1 1 0 1 0-2 0v2.1A10 10 0 1 0 22 12a1 1 0 1 0-2 0 8 8 0 0 1-16 0Z'),
    dots: P('M4 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10-2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z'),
    spark: '<svg viewBox="0 0 24 24" class="claudelogo"><path fill="currentColor" d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/></svg>', // Anthropic's mark (Simple Icons, CC0)
    send: P('M6.6 10.02 14 11.4a.6.6 0 0 1 0 1.18L6.6 14l-2.94 5.87a1.48 1.48 0 0 0 1.99 1.98l17.03-8.52a1.48 1.48 0 0 0 0-2.64L5.65 2.16a1.48 1.48 0 0 0-1.99 1.98l2.94 5.88Z'),
    stop: P('M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5Z'),
    palette: P('M12 2C6.5 2 2 6 2 11c0 4.2 3.4 7.5 7.5 7.5h1.2c.8 0 1.3.9.9 1.6-.5 1.1.3 2.4 1.5 2.4C17.9 22.5 22 17.6 22 12c0-5.5-4.5-10-10-10ZM7 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm4 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z'),
    keyboard: P('M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7Zm4 1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2H6Zm4 0a1 1 0 0 0 0 2h1a1 1 0 1 0 0-2h-1Zm4 0a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2h-1Zm3 1a1 1 0 0 1 1-1h0a1 1 0 1 1 0 2h0a1 1 0 0 1-1-1ZM6 12a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2H6Zm4 0a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2h-1Zm4 0a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2h-1Zm4 0a1 1 0 1 0 0 2h0a1 1 0 1 0 0-2h0ZM8 16a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8Z'),
    puzzle: P('M9 2a3 3 0 0 1 3 3v1h4a2 2 0 0 1 2 2v4h1a3 3 0 1 1 0 6h-1v2a2 2 0 0 1-2 2h-3.5a.5.5 0 0 1-.5-.5V20a2 2 0 1 0-4 0v1.5a.5.5 0 0 1-.5.5H4a2 2 0 0 1-2-2v-4.5c0-.28.22-.5.5-.5H4a2 2 0 1 0 0-4H2.5a.5.5 0 0 1-.5-.5V8a2 2 0 0 1 2-2h2V5a3 3 0 0 1 3-3Z'),
    code: P('M14.95 3.3a1 1 0 0 1 .75 1.2l-3.5 15a1 1 0 0 1-1.95-.45l3.5-15a1 1 0 0 1 1.2-.75ZM7.7 7.3a1 1 0 0 1 0 1.4L4.42 12l3.3 3.3a1 1 0 0 1-1.42 1.4l-4-4a1 1 0 0 1 0-1.4l4-4a1 1 0 0 1 1.42 0Zm8.6 0a1 1 0 0 1 1.4 0l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4-1.4l3.29-3.3-3.3-3.3a1 1 0 0 1 0-1.4Z'),
    info: P('M23 12a11 11 0 1 1-22 0 11 11 0 0 1 22 0Zm-9.5-4.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm-.77 3.96a1 1 0 1 0-1.96-.42l-1.04 4.86a2.77 2.77 0 0 0 4.31 2.83l.24-.17a1 1 0 1 0-1.16-1.62l-.24.17a.77.77 0 0 1-1.2-.79l1.05-4.86Z'),
    list: P('M3 5a1 1 0 0 1 1-1h1a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1Zm5 0a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Zm-5 7a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm5 0a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Zm-5 7a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm5 0a1 1 0 0 1 1-1h11a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Z'),
    read: P('M2 12a10 10 0 1 1 20 0 10 10 0 0 1-20 0Zm14.7-2.3a1 1 0 0 0-1.4-1.4L11 12.58l-2.3-2.3a1 1 0 0 0-1.4 1.42l3 3a1 1 0 0 0 1.4 0l5-5Z'),
  };
  // Discord's own icons (extracted from its client by tools/discord-icons.py) replace the built-in ones where present
  for (const [k, paths] of Object.entries(window.DICONS || {})) {
    const key = k === 'lockI' ? 'lock' : k === 'crownI' ? null : k; if (!key || !I[key]) continue;
    const attrs = (/<svg([^>]*)>/.exec(I[key]) || [, ' viewBox="0 0 24 24"'])[1].replace(/viewBox="[^"]*"/, 'viewBox="0 0 24 24"');
    I[key] = `<svg${attrs}>${paths.map((x) => `<path fill="currentColor"${x.evenodd ? ' fill-rule="evenodd" clip-rule="evenodd"' : ''} d="${x.d}"/>`).join('')}</svg>`;
  }
  const CH = { TEXT: 0, DM: 1, VOICE: 2, CAT: 4, NEWS: 5, STAGE: 13 };
  const isVoice = (c) => c && (c.type === CH.VOICE || c.type === CH.STAGE);

  const S = {
    me: null, home: null, guilds: new Map(), gid: null, cid: null,
    msgs: new Map(), more: new Map(), ahead: new Set(), loading: false, lru: [],
    typing: new Map(), speaking: new Set(), voice: null, joining: null, wsOk: false,
    reply: null, ping: true, files: [], edit: null, silent: false,
    unread: new Map(), members: new Map(), dms: [], pinnedDms: new Set(store.get('pinnedDms', [])),
    shut: new Set(store.get('shut', [])), showMembers: store.get('showMembers', true),
    silentTyping: store.get('silentTyping', false), voiceSince: 0, aliases: new Map(),
    lastTyping: 0,
  };
  const DMG = '@me';
  const SOUNDS = [['message', 'Message (mention or DM)'], ['join', 'Someone joins your call'], ['leave', 'Someone leaves your call'], ['connect', 'You connect'], ['disconnect', 'You disconnect'],
    ['mute', 'Mute'], ['unmute', 'Unmute'], ['deafen', 'Deafen'], ['undeafen', 'Undeafen'], ['pttOn', 'Push to talk start'], ['pttOff', 'Push to talk end']];
  const SND = Object.assign({ volume: 0.5, pttOn: false, pttOff: false }, store.get('sounds', {}));
  let actx = null;
  // Discord's own sounds when they're present in sounds/ (fetched locally, not in the repo); tones otherwise
  const SFX_FILE = { message: 'message1', join: 'user_join', leave: 'user_leave', connect: 'user_join', disconnect: 'disconnect', mute: 'mute', unmute: 'unmute', deafen: 'deafen', undeafen: 'undeafen', pttOn: 'ptt_start', pttOff: 'ptt_stop' };
  const SFX_BUF = {};
  const newCtx = () => { try { return new AudioContext({ sampleRate: 48000 }); } catch { return new AudioContext(); } }; // same rate as the voice engine: no resampling switch on the device
  function loadSfx() {
    try { actx ??= newCtx(); } catch { return; }
    for (const f of new Set(Object.values(SFX_FILE))) fetch(`sounds/${f}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((b) => actx.decodeAudioData(b)).then((buf) => { SFX_BUF[f] = buf; }).catch(() => {});
  }
  setTimeout(loadSfx, 2000);
  function sfx(kind) {
    if (SND[kind] === false || !SND.volume) return;
    try { actx ??= newCtx(); } catch { return; }
    const buf = SFX_BUF[SFX_FILE[kind]];
    if (buf) { if (actx.state === 'suspended') actx.resume(); const src = actx.createBufferSource(), g = actx.createGain(); g.gain.value = SND.volume; src.buffer = buf; src.connect(g).connect(actx.destination); src.start(); return; }
    const seq = { message: [[880, 0, .09], [1320, .07, .14]], join: [[523, 0, .1], [784, .09, .16]], leave: [[784, 0, .1], [523, .09, .16]],
      connect: [[523, 0, .08], [659, .07, .08], [784, .14, .16]], disconnect: [[784, 0, .08], [659, .07, .08], [523, .14, .16]],
      mute: [[440, 0, .07], [330, .06, .09]], unmute: [[330, 0, .07], [440, .06, .09]], deafen: [[392, 0, .08], [262, .07, .14]], undeafen: [[262, 0, .08], [392, .07, .14]],
      pttOn: [[700, 0, .05]], pttOff: [[500, 0, .05]] }[kind];
    if (!seq) return;
    const t0 = actx.currentTime + .01;
    for (const [f, at, len] of seq) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + at); g.gain.linearRampToValueAtTime(.25 * SND.volume, t0 + at + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + at + len);
      o.connect(g).connect(actx.destination); o.start(t0 + at); o.stop(t0 + at + len + .02);
    }
  }
  const PLUGINS = [
    ['MessageLogger', 'Keeps deleted messages (in red) and edit history'],
    ['ClearURLs', 'Strips tracking parameters from links you send'],
    ['TypingIndicator', 'Shows typing dots next to channels'],
    ['MentionAvatars', 'Shows avatars inside mentions'],
    ['WhoReacted', 'Hover a reaction to see who reacted'],
    ['MessageLinkEmbeds', 'Previews linked Discord messages'],
    ['YoutubeInline', 'Plays YouTube embeds in the chat'],
    ['ImageZoom', 'Scroll to zoom and drag to pan in the image viewer'],
    ['MessageClickActions', 'Double-click to reply, or to edit your own'],
    ['QuickReply', 'Ctrl+Up / Ctrl+Down picks a message to reply to'],
    ['VoiceChatDoubleClick', 'Double-click a voice channel to join (one click opens its chat)'],
    ['CallTimer', 'Shows how long you have been in the call'],
    ['ReplyTimestamp', 'Shows the time of the message being replied to'],
    ['ForceOwnerCrown', 'Shows a crown next to the server owner'],
    ['PlatformIndicators', 'Shows whether people are on mobile, web or desktop'],
    ['PinDMs', 'Pin DMs to the top of the list'],
    ['NotificationsForDMs', 'Desktop notification for DMs and mentions while the window is in the background'],
    ['ClaudeAssistant', 'Claude panel (sparkle in the channel header): ask questions, or have it act as V1. Runs on your Claude Code login'],
  ];
  const PL = store.get('plugins', {});
  const on = (k) => (k === 'ClaudeModerate' ? PL[k] === true : PL[k] !== false);
  const PREF = Object.assign({ fontSize: 16, compact: false, hour24: false, devMode: true, embeds: true, theme: 'onyx', spacing: 16, zoom: 100,
    roleColors: 'names', avatarsCompact: false, reduceMotion: true, customCss: '', scroll: 1, smooth: false }, store.get('prefs', {}));
  if (!store.get('nativeScroll', false)) { PREF.scroll = 1; PREF.smooth = false; store.set('prefs', PREF); store.set('nativeScroll', true); } // native (threaded) scrolling by default
  if (!store.get('calmDefault', false)) { PREF.reduceMotion = true; store.set('prefs', PREF); store.set('calmDefault', true); } // animations off by default
  const applyPrefs = () => {
    document.documentElement.style.fontSize = PREF.fontSize + 'px';
    document.documentElement.style.zoom = PREF.zoom / 100;
    document.body.dataset.theme = PREF.theme;
    document.body.style.setProperty('--gap', PREF.spacing + 'px');
    document.body.classList.toggle('compact', PREF.compact);
    document.body.classList.toggle('compact-av', PREF.avatarsCompact);
    document.body.classList.toggle('no-rolecolor', PREF.roleColors === 'none');
    document.body.classList.toggle('rolecolor-dot', PREF.roleColors === 'dot');
    document.body.classList.toggle('calm', PREF.reduceMotion);
    document.body.classList.toggle('no-mav', !on('MentionAvatars'));
    let cs = document.getElementById('usercss'); if (!cs) { cs = document.createElement('style'); cs.id = 'usercss'; document.head.append(cs); }
    cs.textContent = PREF.customCss || '';
  };
  applyPrefs();

  // ------------------------------------------------------------------ api + ws
  // Every failure carries a reason a person can act on. Network drops (V1 restarting, Wi-Fi) are retried;
  // message sends carry a nonce so a retry can't post twice.
  async function api(method, path, body, tries = 4) {
    const safe = method === 'GET' || (body && body.nonce);
    for (let i = 0; ; i++) {
      let r;
      try {
        r = await fetch(API + '/api' + path, { method, headers: { Authorization: 'Bearer ' + KEY, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
      } catch {
        if (safe && i < tries - 1) { await new Promise((ok) => setTimeout(ok, 600 * 2 ** i)); continue; }
        throw new Error(S.wsOk ? 'Lost the connection to V1 on the Pi mid-request. Check the Pi is on and on the same Wi-Fi, then try again.'
          : 'Can\'t reach V1 on the Pi right now: it\'s restarting or offline. It reconnects on its own; try again in a few seconds.');
      }
      const j = await r.json().catch(() => ({}));
      if (r.ok) return j;
      if (r.status === 401) throw new Error('V1 rejected this client\'s key. The key in ~/.config/v1-client/key no longer matches the Pi\'s.');
      throw new Error(j.error || `V1 answered with an error (HTTP ${r.status}).`);
    }
  }
  let ws = null, wsDelay = 500;
  function connect() {
    ws = new WebSocket(API.replace(/^http/, 'ws') + '/?k=' + encodeURIComponent(KEY));
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => { const wasDown = !!S.downSince; S.wsOk = true; S.downSince = 0; wsDelay = 500; renderMe();
      if (wasDown) for (const cid of [...S.msgs.keys()]) if (cid !== S.cid) { S.msgs.delete(cid); S.more.delete(cid); } if (S.cid) resync(); };
    ws.onclose = () => {
      if (S.wsOk || !S.downSince) S.downSince = Date.now();
      S.wsOk = false; renderMe(); setTimeout(renderMe, 16000);
      if (!Voice.native && Voice.active) { Voice.ended(); S.voice = null; renderVoice(); }
      setTimeout(connect, wsDelay); wsDelay = Math.min(wsDelay * 2, 8000);
    };
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') { if (new Uint8Array(e.data, 0, 1)[0] === 1) Voice.onPacket(e.data); return; }
      let d; try { d = JSON.parse(e.data); } catch { return; }
      onEvent(d);
    };
  }
  const wsSend = (o) => ws?.readyState === 1 && ws.send(JSON.stringify(o));

  function onEvent(d) {
    switch (d.t) {
      case 'hello': onVoiceState(d.voice); if (d.webVersion) noteVersion(d.webVersion); break;
      case 'webVersion': noteVersion(d.v); break;
      case 'msg': addMsg(d.m); break;
      case 'msgUpdate': updMsg(d.m); break;
      case 'msgDelete': delMsg(d.channelId, d.id); break;
      case 'reaction': setReaction(d.channelId, d.id, d.r);
        if (d.added && d.by && d.authorId === S.me.id && NT.reaction && !MUTED.has(d.channelId) && (!document.hasFocus() || d.channelId !== S.cid)) {
          const g = guildOf(d.channelId);
          if (on('NotificationsForDMs')) notify({ author: d.by, guildId: g?.id ?? null, channelId: d.channelId, id: d.id, content: `reacted ${d.r.id ? ':' + d.r.name + ':' : d.r.name} to your message`, attachments: [] });
          sfx('message');
        }
        break;
      case 'reactionsClear': { const m = findMsg(d.channelId, d.id); if (m) { m.reactions = []; rerender(m); } break; }
      case 'typing': {
        let t = S.typing.get(d.channelId); if (!t) S.typing.set(d.channelId, t = new Map());
        t.set(d.user.id, { name: d.user.name, color: d.user.color, avatar: d.user.avatar, until: Date.now() + 10000 });
        if (d.channelId === S.cid) renderTyping();
        paintTypingRows();
        break;
      }
      case 'voiceStates': { const g = S.guilds.get(d.guildId); if (g) {
        setTimeout(() => { if (isVoice(chan(S.cid)) && d.voice[S.cid]) renderCall(); }, 0);
        const mine = S.voice?.channelId;
        if (mine && d.voice[mine]) { const before = new Set((g.voice[mine] || []).map((x) => x.id)), after = new Set(d.voice[mine].map((x) => x.id));
          for (const id of after) if (!before.has(id) && id !== S.me.id) sfx('join');
          for (const id of before) if (!after.has(id) && id !== S.me.id) sfx('leave'); }
        Object.assign(g.voice, d.voice); g.since = Object.assign(g.since || {}, d.since || {}); if (d.guildId === S.gid) renderChannels(); } break; }
      case 'speaking': d.on ? S.speaking.add(d.userId) : S.speaking.delete(d.userId); paintSpeaking(); break;
      case 'selfSpeaking': S.selfSpeaking = d.on; paintSpeaking(); break;
      case 'voice': onVoiceState(d.v, d.why); break;
      case 'guild': { VIEWERS.clear(); const old = S.guilds.get(d.g.id); S.guilds.set(d.g.id, d.g); if (!old) renderRail(); if (d.g.id === S.gid) { renderChannels(); renderHead(); } break; }
      case 'guildGone': S.guilds.delete(d.id); renderRail(); break;
      case 'presence': {
        const ms = S.members.get(d.guildId); const m = ms?.byId.get(d.userId);
        if (m) { const moved = (m.status === 'offline') !== (d.status === 'offline'); Object.assign(m, { status: d.status, activity: d.activity, actType: d.actType, custom: d.custom, platforms: d.platforms || m.platforms }); if (d.guildId === S.gid) moved ? renderMembersSoon() : patchMember(m); }
        break;
      }
      case 'membersStale': VIEWERS.clear(); S.members.delete(d.guildId); if (d.guildId === S.gid) loadMembers(d.guildId); break;
      case 'dm': if (!S.dms.some((x) => x.id === d.dm.id)) { S.dms.unshift(d.dm); if (S.gid === DMG) renderChannels(); } break;
      case 'alert': onAlert(d); break;
      case 'scheduledSent': toast('Scheduled message sent'); break;
      case 'approve': {
        if (!CL.open) toggleClaude(true);
        const card = clAdd('appr', `<div class="aq">${I.hammer}<span>Claude wants to: <b>${esc(d.text)}</b></span></div><div class="ab"><button class="btn red" data-ap="1">Allow</button><button class="btn sec" data-ap="0">Deny</button></div>`);
        card.dataset.id = d.id;
        card.onclick = (e) => { const b = e.target.closest('[data-ap]'); if (!b) return; api('POST', `/approve/${d.id}`, { ok: b.dataset.ap === '1' }).catch(() => {}); card.classList.add('done'); card.querySelector('.ab').innerHTML = `<span class="ares">${b.dataset.ap === '1' ? 'Allowed' : 'Denied'}</span>`; };
        sfx('message');
        break;
      }
      case 'approveGone': { const c2 = document.querySelector(`.cmsg.appr[data-id="${d.id}"]:not(.done)`); if (c2) { c2.classList.add('done'); c2.querySelector('.ab').innerHTML = '<span class="ares">Timed out, not done</span>'; } break; }
      case 'pong': S.rtt = Math.round(performance.now() - d.at); $('#vping').textContent = S.rtt + ' ms'; break;
      case 'error': toast(d.error, true); if (S.joining && !S.voice) { S.joining = null; Voice.ended(); renderVoice(); } break;
    }
  }

  // ------------------------------------------------------------------ helpers
  const fmtClock = (ts) => PREF.hour24 ? new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : new Date(ts).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s?([ap])\.?m\.?/i, ' $1m').toLowerCase();
  const dayKey = (ts) => { const d = new Date(ts); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); };
  function fmtWhen(ts) {
    const d = new Date(ts), now = new Date();
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 864e5);
    if (diff === 0) return fmtClock(ts);
    if (diff === 1) return 'Yesterday at ' + fmtClock(ts);
    return d.toLocaleDateString('en-GB') + ', ' + fmtClock(ts);
  }
  function fmtStamp(unix, f) {
    const d = new Date(unix * 1000);
    if (f === 'R') { const s = Math.round((d - Date.now()) / 1000), a = Math.abs(s);
      const [n, u] = a < 60 ? [a, 'second'] : a < 3600 ? [Math.round(a / 60), 'minute'] : a < 86400 ? [Math.round(a / 3600), 'hour'] : [Math.round(a / 86400), 'day'];
      return s < 0 ? `${n} ${u}${n === 1 ? '' : 's'} ago` : `in ${n} ${u}${n === 1 ? '' : 's'}`; }
    const o = { t: { timeStyle: 'short' }, T: { timeStyle: 'medium' }, d: { dateStyle: 'short' }, D: { dateStyle: 'long' }, f: { dateStyle: 'long', timeStyle: 'short' }, F: { dateStyle: 'full', timeStyle: 'short' } }[f] || { dateStyle: 'long', timeStyle: 'short' };
    return d.toLocaleString('en-GB', o);
  }
  const kb = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const guildOf = (cid) => { for (const g of S.guilds.values()) if (g.channels.some((c) => c.id === cid)) return g; return null; };
  const chan = (cid) => { for (const g of S.guilds.values()) { const c = g.channels.find((x) => x.id === cid); if (c) return c; } const dm = S.dms.find((x) => x.id === cid); return dm ? { id: dm.id, type: CH.DM, name: dm.user.name, dm, send: true } : null; };
  function setCtx(m) {
    const g = S.guilds.get(m.guildId);
    MD.ctx.user = (id) => { const u = m.mentions?.users?.[id]; if (u) return typeof u === 'string' ? { name: u } : u; const mm = S.members.get(m.guildId)?.byId.get(id); return mm ? { name: mm.name, avatar: mm.avatar } : { name: id === S.me?.id ? S.me.name : 'unknown-user' }; };
    MD.ctx.role = (id) => m.mentions?.roles?.[id] ?? g?.roles?.[id] ?? null;
    MD.ctx.channel = (id) => m.mentions?.channels?.[id] ?? chan(id)?.name ?? 'unknown';
    MD.ctx.channelIcon = (id) => { const c = chan(id); if (!c) return null; const ic = c.rules ? I.rules : c.type === CH.NEWS ? I.announce : c.type === 15 || c.type === 16 ? I.forum : isVoice(c) ? I.speaker : c.thread ? I.threads : null; return ic ? ic.replace('class="hash"', 'class="mIcon"') : null; };
    MD.ctx.time = fmtStamp;
    MD.ctx.emoji = () => null;
  }
  const md = (text, m) => { setCtx(m); return MD.render(text); };
  const TWE = { base: 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/', folder: 'svg', ext: '.svg', className: 'emoji', attributes: () => ({ draggable: 'false', loading: 'lazy' }) };
  const twe = () => {}; // emoji render natively in Apple Color Emoji
  const emojiImg = (e) => e.id ? `<img class="emoji" src="${px(`https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? 'gif' : 'webp'}?size=48`, 22)}" alt=":${esc(e.name)}:">` : `<span class="ue">${esc(e.name)}</span>`;
  function toast(text, bad) {
    const t = $('#toast'); t.textContent = text; t.className = bad ? 'bad' : ''; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3200);
  }
  Voice.onError((e) => toast(e, true));
  const findMsg = (cid, id) => S.msgs.get(cid)?.find((m) => m.id === id);
  const onlyEmoji = (s) => s && s.length < 200 && /^(\s*(<a?:\w+:\d+>|\p{Extended_Pictographic}(‍\p{Extended_Pictographic}|️|[\u{1F3FB}-\u{1F3FF}])*|\p{Regional_Indicator}{2}))+\s*$/u.test(s)
    && ((s.match(/<a?:\w+:\d+>|\p{Extended_Pictographic}/gu) || []).length <= 27);
  // Discord's CDN serves power-of-two sizes; ask for the one that matches the real pixels on screen
  const px = (url, css) => {
    if (!url || !/cdn\.discordapp\.com|media\.discordapp\.net/.test(url)) return url;
    const want = css * (devicePixelRatio || 1) * (PREF.zoom || 100) / 100;
    const size = Math.min(4096, 2 ** Math.ceil(Math.log2(Math.max(16, want))));
    return /[?&]size=\d+/.test(url) ? url.replace(/([?&])size=\d+/, `$1size=${size}`) : url + (url.includes('?') ? '&' : '?') + 'size=' + size;
  };
  // every GIF is an animated image made by V1 (WebKit's <video> deadlocks on GIF-heavy channels)
  const gifImg = (src, w = 400) => `${API}/gif?u=${encodeURIComponent(src)}&w=${Math.round(Math.min(640, w * (devicePixelRatio || 1)))}`;
  const NICK = store.get('nicks', {});
  const nickOf = (u) => (u && NICK[u.id]) || null;
  const anim = (still, moving, size) => moving ? ` data-still="${esc(px(still, size))}" data-anim="${esc(px(moving, size))}"` : '';
  // Discord's avatar status geometry (status dot size, cutout stroke, inset) per avatar size
  const AVST = [[16, 6, 2, 0], [20, 6, 2, 0], [24, 8, 3, 0], [32, 10, 3, 0], [40, 12, 4, 0], [48, 12, 4, 0], [56, 14, 4, 2], [72, 16, 6, 4], [80, 16, 6, 4], [96, 20, 8, 6], [120, 24, 8, 8]];
  const avStyle = (size, status) => {
    if (!status) return `width:${size}px;height:${size}px`;
    const [, st, sk, off] = AVST.find((r) => r[0] >= size) || AVST[AVST.length - 1];
    const c = size - st / 2 - off;
    return `width:${size}px;height:${size}px;--sp:${size - st - off}px;--ss:${st}px;--sc:${c}px;--sr:${st / 2 + sk}px`;
  };
  // Discord's dot shapes drawn flat: the dot plus its "hole" painted in the ring colour (CSS masks made WebKit's memory climb)
  const DOTHOLE = { idle: '<circle cx="5" cy="5" r="7.5"/>', dnd: '<rect x="2.5" y="7.5" width="15" height="5" rx="2.5"/>', offline: '<circle cx="10" cy="10" r="5"/>', streaming: '<path d="M7 5l8.66 5L7 15z"/>' };
  const dotSVG = (st) => `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="10"/>${DOTHOLE[st] ? `<g class="h">${DOTHOLE[st]}</g>` : ''}</svg>`;
  const avatarHTML = (u, status, size = 32) => `<span class="av${status ? ' st' : ''}" style="${avStyle(size, status)}"><img src="${esc(px(u.avatar, size))}"${anim(u.avatar, u.avatarAnim, size)} alt="" loading="lazy" decoding="async">${u.deco ? `<img class="deco" src="${esc(px(u.deco, size * 1.2))}"${anim(u.deco, u.decoAnim, size * 1.2)} alt="" loading="lazy" decoding="async">` : ''}${status ? `<i class="${status}">${dotSVG(status)}</i>` : ''}</span>`;
  const statusText = (s) => ({ online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline' }[s] || 'Offline');

  // ------------------------------------------------------------------ rail
  function renderRail() {
    let dmUnread = 0;
    for (const d of S.dms) { const u = S.unread.get(d.id); if (u) dmUnread += u.n; }
    let html = `<button class="srv dm${S.gid === DMG ? ' on' : ''}" data-g="${DMG}" title="Direct Messages">${I.dm}${dmUnread ? `<span class="badge">${dmUnread}</span>` : ''}</button>`;
    html += '<div class="railsep"></div>';
    html += [...S.guilds.values()].map((g) => {
      let n = 0, m = 0;
      for (const c of g.channels) { const u = S.unread.get(c.id); if (u) { n += u.n; m += u.mentions; } }
      const init = g.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3);
      return `<button class="srv${g.id === S.gid ? ' on' : ''}${n && g.id !== S.gid ? ' unread' : ''}" data-g="${g.id}" title="${esc(g.name)}">${g.icon ? `<img src="${esc(px(g.icon, 40))}" alt="">` : esc(init)}${m ? `<span class="badge">${m}</span>` : ''}</button>`;
    }).join('');
    $('#rail').innerHTML = html;
  }
  let hoverT;
  $('#rail').addEventListener('mouseover', (e) => {
    const b = e.target.closest('.srv[data-g]'); if (!b || b.dataset.g === DMG) return;
    clearTimeout(hoverT);
    hoverT = setTimeout(() => {
      const g = S.guilds.get(b.dataset.g); if (!g) return;
      const r = b.getBoundingClientRect();
      let tip = $('#stip'); if (!tip) { tip = document.createElement('div'); tip.id = 'stip'; document.body.append(tip); }
      tip.innerHTML = `<b>${esc(g.name)}</b><div class="sc"><span title="Online"><i class="dot on"></i>${(g.online ?? 0).toLocaleString()}</span><span title="Members"><i class="dot"></i>${(g.total ?? 0).toLocaleString()}</span></div>`;
      tip.style.left = (r.right + 12) + 'px'; tip.style.top = (r.top + r.height / 2) + 'px'; tip.hidden = false;
    }, 200);
  });
  $('#rail').addEventListener('mouseout', (e) => { if (!e.relatedTarget?.closest?.('.srv')) { clearTimeout(hoverT); const t = $('#stip'); if (t) t.hidden = true; } });
  $('#rail').addEventListener('click', (e) => {
    const b = e.target.closest('.srv[data-g]'); if (b) openGuild(b.dataset.g);
  });

  async function openGuild(gid) {
    S.gid = gid; store.set('gid', gid);
    renderRail(); renderSideHead();
    if (gid === DMG) {
      $('#app').classList.add('nomembers');
      await loadDms();
      renderChannels(); setTimeout(() => prefetchGuild(DMG), 400);
      const last = store.get('chan.' + DMG);
      if (last && S.dms.some((d) => d.id === last)) openChannel(last); else if (S.dms[0]) openChannel(S.dms[0].id); else { S.cid = null; renderHead(); $('#log').innerHTML = '<div class="empty">No DMs yet. Open someone\'s profile and press Message.</div>'; }
      return;
    }
    $('#app').classList.toggle('nomembers', !S.showMembers);
    const g = S.guilds.get(gid);
    renderChannels();
    loadMembers(gid);
    setTimeout(() => prefetchGuild(gid), 400);
    const last = store.get('chan.' + gid);
    const first = sortedChannels(g).find((c) => !isVoice(c) && c.type !== CH.CAT);
    const pick = (last && g.channels.find((c) => c.id === last && c.type !== CH.CAT)) || first;
    if (pick) openChannel(pick.id);
  }
  function renderSideHead() {
    const h = $('#sidehead');
    if (S.gid === DMG) { h.innerHTML = '<input class="search" id="dmsearch" placeholder="Find a conversation">'; $('#dmsearch').oninput = () => renderChannels(); return; }
    const g = S.guilds.get(S.gid);
    h.innerHTML = `<button class="gbtn">${g?.icon ? `<img src="${esc(g.icon)}" alt="">` : ''}<span>${esc(g?.name ?? '')}</span>${I.caret}</button><button class="ico ginv" title="Invite People">${I.invite}</button>`;
    h.querySelector('.ginv').onclick = () => serverSettings('invites');
    h.querySelector('.gbtn').onclick = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      menu({ clientX: r.left + 8, clientY: r.bottom + 4 }, [['Invite People', () => serverSettings('invites')], ['Server Settings', () => serverSettings('overview')], ['Create Channel', () => createChannel()], ['Create Category', () => createChannel(null, 'category')], ['-'],
        ['Mark As Read', () => { for (const c of g.channels) S.unread.delete(c.id); renderChannels(); renderRail(); }], ['Copy Server ID', () => copy(g.id)]]);
    };
  }

  // ------------------------------------------------------------------ channels + DMs
  async function loadDms() {
    try { const r = await api('GET', '/dms'); S.dms = r.dms; } catch (e) { toast(e.message, true); }
  }
  function sortedChannels(g) {
    const by = (a, b) => (isVoice(a) - isVoice(b)) || a.pos - b.pos || a.id.localeCompare(b.id);
    const cats = g.channels.filter((c) => c.type === CH.CAT).sort((a, b) => a.pos - b.pos);
    const out = g.channels.filter((c) => c.type !== CH.CAT && !c.parent && !c.thread).sort(by);
    for (const cat of cats) { out.push(cat); out.push(...g.channels.filter((c) => c.parent === cat.id && !c.thread).sort(by)); }
    return out;
  }
  function renderChannels() {
    if (S.gid === DMG) return renderDmList();
    const g = S.guilds.get(S.gid); if (!g) return;
    const list = sortedChannels(g);
    let html = '', cat = null;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.type === CH.CAT) {
        cat = c;
        if (list[i + 1] && list[i + 1].type !== CH.CAT) html += `<div class="cat${S.shut.has(c.id) ? ' shut' : ''}" data-cat="${c.id}"><span>${esc(c.name)}</span>${I.caret}</div>`;
        continue;
      }
      const u = S.unread.get(c.id);
      const hidden = cat && S.shut.has(cat.id) && c.id !== S.cid && !(isVoice(c) && (g.voice[c.id] || []).length) && !u?.mentions;
      if (hidden) continue;
      if (isVoice(c)) {
        const here = S.voice?.channelId === c.id;
        const ms = g.voice[c.id] || [];
        const since = (g.since || {})[c.id] ?? c.since;
        html += `<div class="ch vc${here ? ' here' : ''}${ms.length ? ' live' : ''}${c.id === S.cid ? ' on' : ''}${u?.n ? ' unread' : ''}" role="button" data-vc="${c.id}" title="Double-click to join">${c.type === CH.STAGE ? (c.private ? I.stageLock : I.stage) : (c.private ? I.speakerLock : I.speaker)}<span class="nm">${esc(c.name)}</span>`
          + `${u?.mentions ? `<span class="badge">${u.mentions}</span>` : ''}${ms.length && since ? `<span class="vtimer" data-since="${since}"></span>` : ''}<span class="chat" data-open="${c.id}" title="Open chat">${I.chat}</span></div>`;
        if (ms.length) html += `<div class="vmembers">${ms.map((m) => `<div class="vm" data-uid="${m.id}"><img src="${esc(px(m.avatar, 24))}" alt=""><span class="nm">${esc(nickOf(m) || m.name)}</span>${clanHTML(m)}<span class="vsp"></span>${m.stream ? '<span class="live">LIVE</span>' : ''}${m.deaf ? I.headOff : m.mute ? I.micOff : ''}</div>`).join('')}</div>`;
      } else {
        const icon = c.rules ? I.rules : c.type === CH.NEWS ? (c.private ? I.announceLock : I.announce) : c.type === 15 || c.type === 16 ? (c.private ? I.forumLock : I.forum) : c.private ? I.hashLock : I.hash;
        html += `<button class="ch${c.id === S.cid ? ' on' : ''}${u?.n ? ' unread' : ''}" data-c="${c.id}">${icon}<span class="nm">${esc(c.name)}</span>${u?.mentions ? `<span class="badge">${u.mentions}</span>` : ''}</button>`;
        for (const t of g.channels.filter((x) => x.thread && x.parent === c.id)) {
          const tu = S.unread.get(t.id);
          html += `<button class="ch thr${t.id === S.cid ? ' on' : ''}${tu?.n ? ' unread' : ''}" data-c="${t.id}"><span class="nm">${esc(t.name)}</span></button>`;
        }
      }
    }
    $('#chans').innerHTML = html;
    twe($('#chans'));
    paintSpeaking(); paintTypingRows(); paintTimers();
  }
  function renderDmList() {
    const q = ($('#dmsearch')?.value || '').toLowerCase();
    const list = S.dms.filter((d) => !q || d.user.name.toLowerCase().includes(q) || d.user.username.toLowerCase().includes(q));
    list.sort((a, b) => (S.pinnedDms.has(b.id) - S.pinnedDms.has(a.id)) || (BigInt(b.last || 0) > BigInt(a.last || 0) ? 1 : -1));
    let html = '', pinnedDone = false;
    if (list.some((d) => S.pinnedDms.has(d.id))) html += '<div class="dmhead">Pinned</div>';
    for (const d of list) {
      if (!pinnedDone && !S.pinnedDms.has(d.id) && S.pinnedDms.size) { html += '<div class="dmhead">Direct Messages</div>'; pinnedDone = true; }
      const u = S.unread.get(d.id);
      html += `<button class="ch dmrow${d.id === S.cid ? ' on' : ''}${u?.n ? ' unread' : ''}" data-c="${d.id}" data-dm="${d.user.id}">${avatarHTML(d.user, statusOf(d.user.id))}<span class="nm">${esc(nickOf(d.user) || d.user.name)}</span>${u?.n ? `<span class="badge">${u.n}</span>` : ''}</button>`;
    }
    if (!list.length) html = '<div class="empty">No conversations</div>';
    $('#chans').innerHTML = html;
    twe($('#chans'));
  }
  function statusOf(uid) { for (const ms of S.members.values()) { const m = ms.byId.get(uid); if (m) return m.status; } return 'offline'; }

  $('#chans').addEventListener('click', (e) => {
    const cat = e.target.closest('[data-cat]');
    if (cat) { const id = cat.dataset.cat; S.shut.has(id) ? S.shut.delete(id) : S.shut.add(id); store.set('shut', [...S.shut]); renderChannels(); return; }
    const vm = e.target.closest('.vm'); if (vm) { showProfile(vm.dataset.uid, vm); return; }
    const open = e.target.closest('[data-open]');
    if (open) { e.stopPropagation(); openChannel(open.dataset.open); return; }
    const c = e.target.closest('[data-c]'); if (c) { openChannel(c.dataset.c); return; }
    const vc = e.target.closest('[data-vc]');
    if (vc) { // VoiceChatDoubleClick: one click opens the VC's chat, two join it
      const id = vc.dataset.vc, now = performance.now();
      if (!on('VoiceChatDoubleClick')) { joinVoice(id); if (S.cid !== id) openChannel(id); return; }
      if (lastVc.id === id && now - lastVc.t < 450) { lastVc = {}; joinVoice(id); return; }
      lastVc = { id, t: now };
      if (S.cid !== id) openChannel(id);
    }
  });
  let lastVc = {};
  $('#chans').addEventListener('contextmenu', (e) => {
    const vm = e.target.closest('.vm'); if (vm) { e.preventDefault(); userMenu(e, vm.dataset.uid, true); return; }
    const dm = e.target.closest('[data-dm]');
    if (dm) {
      e.preventDefault();
      const cid = dm.dataset.c, pinned = S.pinnedDms.has(cid);
      menu(e, [...(on('PinDMs') ? [[pinned ? 'Unpin' : 'Pin', () => { pinned ? S.pinnedDms.delete(cid) : S.pinnedDms.add(cid); store.set('pinnedDms', [...S.pinnedDms]); renderChannels(); }]] : []),
        ['Profile', () => showProfile(dm.dataset.dm, dm)], ['Copy User ID', () => copy(dm.dataset.dm)]]);
      return;
    }
    const vc = e.target.closest('[data-vc]');
    if (vc && S.gid !== DMG) {
      e.preventDefault(); const id = vc.dataset.vc, g = S.guilds.get(S.gid); const n = (g.voice[id] || []).filter((m) => m.id !== S.me.id).length;
      const V = (body, msg) => api('POST', `/voice/${S.gid}`, { channelId: id, ...body }).then((r) => toast(`${msg} (${r.done})`), (x) => toast(x.message, true));
      const items = [[S.voice?.channelId === id ? 'Disconnect' : 'Join', () => (S.voice?.channelId === id ? leaveVoice() : joinVoice(id))], ['Open Chat', () => openChannel(id)], ['Edit Channel', () => editChannel(id)]];
      if (n) items.push(['-'], ...g.channels.filter((c) => isVoice(c) && c.id !== id).map((c) => [`Move everyone to ${c.name}`, () => V({ action: 'move', to: c.id }, 'Moved')]),
        ['Mute Everyone', () => V({ action: 'mute', on: true }, 'Muted')], ['Unmute Everyone', () => V({ action: 'mute', on: false }, 'Unmuted')], ['Disconnect Everyone', () => V({ action: 'disconnect' }, 'Disconnected'), 'red']);
      items.push(['-'], ['Copy Channel ID', () => copy(id)]);
      menu(e, items); return;
    }
    if (vc) { e.preventDefault(); menu(e, [[S.voice?.channelId === vc.dataset.vc ? 'Disconnect' : 'Join', () => (S.voice?.channelId === vc.dataset.vc ? leaveVoice() : joinVoice(vc.dataset.vc))], ['Open Chat', () => openChannel(vc.dataset.vc)], ['Copy Channel ID', () => copy(vc.dataset.vc)]]); return; }
    const c = e.target.closest('[data-c]');
    if (c) {
      e.preventDefault(); const ch = chan(c.dataset.c);
      if (ch?.thread) { // Discord's thread menu
        const id = c.dataset.c, TA = (body, msg) => api('POST', `/channels/${id}/threadact`, body).then(() => toast(msg), (x) => toast(x.message, true));
        const ti = [['Mark As Read', () => { S.unread.delete(id); renderChannels(); renderRail(); }], ['Copy Link', () => copy(`https://discord.com/channels/${S.gid}/${id}`)], ['-'],
          ['Edit Thread', () => editChannel(id)], ['Leave Thread', () => { if (S.cid === id && ch.parent) openChannel(ch.parent); TA({ action: 'leave' }, 'Left thread'); }]];
        if (ch.threadManage) ti.push(['Close Thread', () => TA({ action: 'close' }, 'Thread closed')], [ch.locked ? 'Unlock Thread' : 'Lock Thread', () => TA({ action: 'lock', on: !ch.locked }, ch.locked ? 'Thread unlocked' : 'Thread locked: only mods can reply')], ['Delete Thread', () => deleteChannel(id), 'red']);
        ti.push(['-'], ['Copy Thread ID', () => copy(id)]);
        menu(e, ti); return;
      }
      const items = [['Mark As Read', () => { S.unread.delete(c.dataset.c); renderChannels(); renderRail(); }], ['Copy Link', () => copy(`https://discord.com/channels/${S.gid}/${c.dataset.c}`)]];
      if (S.gid !== DMG) items.push(['-'], ['Edit Channel', () => editChannel(c.dataset.c)], ['Create Channel', () => createChannel(ch?.parent)]);
      if (S.gid !== DMG) {
        items.push([ch?.locked ? 'Unlock Channel' : 'Lock Channel', () => api('POST', `/channels/${c.dataset.c}/lock`, { on: !ch?.locked }).then((r) => { ch.locked = r.locked; toast(r.locked ? 'Locked: only people with extra permissions can talk' : 'Unlocked'); }, (x) => toast(x.message, true))]);
        items.push(['Slowmode…', () => menu(e, [['Off', 0], ['5 seconds', 5], ['30 seconds', 30], ['1 minute', 60], ['5 minutes', 300], ['1 hour', 3600]].map(([l, sec]) => [l, () => M_(`channels/${c.dataset.c}`, 'PATCH', { slowmode: sec }).then(() => toast(sec ? `Slowmode: ${l}` : 'Slowmode off'), (x) => toast(x.message, true))]))]);
        items.push(['Clone Channel', () => api('POST', `/channels/${c.dataset.c}/clone`).then(() => toast('Cloned'), (x) => toast(x.message, true))]);
      }
      if (ch?.manage) items.push(['Purge Messages…', () => purge(c.dataset.c), 'red']);
      if (S.gid !== DMG) items.push(['Delete Channel', () => deleteChannel(c.dataset.c), 'red']);
      items.push(['-'], ['Copy Channel ID', () => copy(c.dataset.c)]);
      menu(e, items);
    }
    const cat = e.target.closest('[data-cat]');
    if (cat) { e.preventDefault(); menu(e, [['Create Channel', () => createChannel(cat.dataset.cat)], ['Edit Category', () => editChannel(cat.dataset.cat)], ['Delete Category', () => deleteChannel(cat.dataset.cat), 'red'], ['-'], ['Copy Category ID', () => copy(cat.dataset.cat)]]); }
  });
  const M_ = (path, method = 'GET', body) => api(method, `/guilds/${S.gid}/manage/${path}`, body);
  async function createChannel(parent = null, type) {
    if (!type) {
      const t = await new Promise((ok) => menu({ clientX: innerWidth / 2 - 90, clientY: innerHeight / 3 }, [['Text Channel', () => ok('text')], ['Voice Channel', () => ok('voice')], ['Announcement Channel', () => ok('announcement')], ['Stage Channel', () => ok('stage')], ['Forum Channel', () => ok('forum')]], () => setTimeout(() => ok(null), 50)));
      if (!t) return; type = t;
    }
    const name = await ask({ title: type === 'category' ? 'Create Category' : `Create ${type[0].toUpperCase() + type.slice(1)} Channel`, input: { label: 'Name', placeholder: type === 'category' ? 'New category' : 'new-channel' }, ok: 'Create' });
    if (!name) return;
    M_('channels', 'POST', { name, type, parent }).then(() => toast('Created'), (x) => toast(x.message, true));
  }
  async function deleteChannel(id) {
    const c = chan(id);
    if (!await ask({ title: `Delete ${c?.type === CH.CAT ? 'Category' : 'Channel'}`, body: `Are you sure you want to delete <b>${esc(c?.name ?? '')}</b>? This cannot be undone.`, ok: 'Delete', danger: true })) return;
    M_(`channels/${id}`, 'DELETE').then(() => toast('Deleted'), (x) => toast(x.message, true));
  }
  async function purge(id) {
    const n = await ask({ title: 'Purge Messages', body: 'Bulk-deletes the newest messages in this channel for everyone. Discord allows up to 100 at a time, and only messages younger than 14 days.', input: { label: 'How many', value: '10' }, ok: 'Delete', danger: true });
    if (!n) return;
    api('POST', `/channels/${id}/purge`, { count: +n }).then((r) => toast(`Deleted ${r.deleted}`), (x) => toast(x.message, true));
  }
  async function editChannel(id) {
    let c; try { c = await M_(`channels/${id}`); } catch (x) { toast(x.message, true); return; }
    const g = S.guilds.get(S.gid), cats = g.channels.filter((x) => x.type === CH.CAT);
    const voice = c.type === CH.VOICE || c.type === CH.STAGE, cat = c.type === CH.CAT;
    const box = document.createElement('div'); box.className = 'modal';
    box.innerHTML = `<div class="mcard wide"><h2>Edit ${cat ? 'Category' : 'Channel'}</h2><label>Name<input id="cn" value="${esc(c.name)}"></label>
      ${cat ? '' : `<label>Category<select id="cp"><option value="">No category</option>${cats.map((x) => `<option value="${x.id}"${x.id === c.parent ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>`}
      ${!cat && !voice ? `<label>Topic<textarea id="ct" rows="3" maxlength="1024">${esc(c.topic)}</textarea></label>
      <div class="two"><label>Slowmode (seconds)<input id="cs" type="number" min="0" max="21600" value="${c.slowmode}"></label><label class="chk"><input type="checkbox" id="cnsfw"${c.nsfw ? ' checked' : ''}> Age-restricted</label></div>` : ''}
      ${voice ? `<div class="two"><label>Bitrate (kbps)<input id="cb" type="number" min="8" max="384" value="${Math.round((c.bitrate || 64000) / 1000)}"></label><label>User limit (0 = none)<input id="cu" type="number" min="0" max="99" value="${c.userLimit || 0}"></label></div>` : ''}
      <div class="mact"><button class="sec" data-x>Cancel</button><button data-save>Save Changes</button></div></div>`;
    document.body.append(box);
    const v = (q) => box.querySelector(q);
    box.onmousedown = (e) => { if (e.target === box || e.target.closest('[data-x]')) box.remove(); };
    v('[data-save]').onclick = async () => {
      const body = { name: v('#cn').value.trim() };
      if (v('#cp')) body.parent = v('#cp').value;
      if (v('#ct')) { body.topic = v('#ct').value; body.slowmode = +v('#cs').value || 0; body.nsfw = v('#cnsfw').checked; }
      if (v('#cb')) { body.bitrate = (+v('#cb').value || 64) * 1000; body.userLimit = +v('#cu').value || 0; }
      try { await M_(`channels/${id}`, 'PATCH', body); box.remove(); toast('Saved'); } catch (x) { toast(x.message, true); }
    };
  }

  // ---------- Server Settings (same window as user settings)
  const SSECT = [['overview', 'Overview', 'info'], ['roles', 'Roles', 'shield'], ['emojis', 'Emoji', 'smile'], ['stickers', 'Stickers', 'sticker'], ['invites', 'Invites', 'invite'], ['bans', 'Bans', 'hammer'], ['audit', 'Audit Log', 'list'], ['webhooks', 'Webhooks', 'link']];
  const PERM_NAMES = { Administrator: 'Administrator', ViewChannel: 'View Channels', ManageChannels: 'Manage Channels', ManageRoles: 'Manage Roles', ManageGuildExpressions: 'Manage Expressions', ViewAuditLog: 'View Audit Log',
    ManageWebhooks: 'Manage Webhooks', ManageGuild: 'Manage Server', CreateInstantInvite: 'Create Invite', ChangeNickname: 'Change Nickname', ManageNicknames: 'Manage Nicknames', KickMembers: 'Kick Members', BanMembers: 'Ban Members',
    ModerateMembers: 'Timeout Members', SendMessages: 'Send Messages', SendMessagesInThreads: 'Send Messages in Threads', CreatePublicThreads: 'Create Public Threads', CreatePrivateThreads: 'Create Private Threads', EmbedLinks: 'Embed Links',
    AttachFiles: 'Attach Files', AddReactions: 'Add Reactions', UseExternalEmojis: 'Use External Emoji', UseExternalStickers: 'Use External Stickers', MentionEveryone: 'Mention @everyone', ManageMessages: 'Manage Messages',
    ManageThreads: 'Manage Threads', ReadMessageHistory: 'Read Message History', SendTTSMessages: 'Send TTS Messages', SendVoiceMessages: 'Send Voice Messages', SendPolls: 'Create Polls', UseApplicationCommands: 'Use Application Commands',
    Connect: 'Connect', Speak: 'Speak', Stream: 'Video', UseSoundboard: 'Use Soundboard', UseVAD: 'Use Voice Activity', PrioritySpeaker: 'Priority Speaker', MuteMembers: 'Mute Members', DeafenMembers: 'Deafen Members', MoveMembers: 'Move Members',
    ManageEvents: 'Manage Events', CreateEvents: 'Create Events' };
  function serverSettings(sec = 'overview') {
    const g = S.guilds.get(S.gid); if (!g) return;
    hidePop(); document.querySelector('.settings')?.remove();
    const el = document.createElement('div'); el.className = 'settings';
    el.innerHTML = `<div class="swin"><nav class="snav"><div class="sgroup">${esc(g.name)}</div>${SSECT.map(([k, l, ic]) => `<button data-s="${k}">${I[ic] || ''}<span>${l}</span></button>`).join('')}</nav><section class="sbody"><div class="sinner" id="sin"></div><button class="sclose" title="Close (Esc)">${I.x}</button></section></div>`;
    document.body.append(el);
    const close = () => { el.remove(); removeEventListener('keydown', esc_); };
    const esc_ = (e) => { if (e.key === 'Escape' && !document.querySelector('.modal')) close(); };
    addEventListener('keydown', esc_);
    el.onmousedown = (e) => { if (e.target === el) close(); };
    el.querySelector('.sclose').onclick = close;
    const show = async (k, arg) => {
      for (const b of el.querySelectorAll('.snav [data-s]')) b.classList.toggle('on', b.dataset.s === k);
      const box = $('#sin', el); box.innerHTML = '<div class="empty">Loading</div>';
      try { await serverSection(k, box, (k2, a2) => show(k2 || k, a2), arg); } catch (x) { box.innerHTML = `<h1>${esc(SSECT.find((s2) => s2[0] === k)[1])}</h1><div class="note">${esc(x.message)}</div>`; }
    };
    el.querySelector('.snav').onclick = (e) => { const b = e.target.closest('[data-s]'); if (b) show(b.dataset.s); };
    show(sec);
  }
  const pickImage = () => new Promise((ok) => { const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/png,image/jpeg,image/gif,image/webp'; f.onchange = () => ok(f.files[0] || null); f.click(); });
  async function serverSection(k, box, again, arg) {
    const g = S.guilds.get(S.gid);
    const q = (x) => box.querySelector(x);
    if (k === 'overview') {
      const o = await M_('overview');
      const chs = (t) => g.channels.filter((c) => t(c));
      box.innerHTML = `<h1>Server Overview</h1><div class="ov"><button class="ovicon" id="oicon">${o.icon ? `<img src="${esc(o.icon)}" alt="">` : esc(o.name.slice(0, 2))}<span>Change</span></button>
        <div class="ovf"><label>Server name<input id="oname" value="${esc(o.name)}"></label><label>Description<textarea id="odesc" rows="2">${esc(o.description || '')}</textarea></label></div></div>
        <div class="two"><label class="lab">Inactive channel<select id="oafk"><option value="">No inactive channel</option>${chs(isVoice).map((c) => `<option value="${c.id}"${c.id === o.afkChannel ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label class="lab">Inactive timeout<select id="oafkt">${[[60, '1 minute'], [300, '5 minutes'], [900, '15 minutes'], [1800, '30 minutes'], [3600, '1 hour']].map(([v, l]) => `<option value="${v}"${v === o.afkTimeout ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
        <div class="two"><label class="lab">System messages channel<select id="osys"><option value="">No system messages</option>${chs((c) => c.type === CH.TEXT).map((c) => `<option value="${c.id}"${c.id === o.systemChannel ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label class="lab">Default notifications<select id="onot"><option value="0"${o.defaultMessageNotifications === 0 ? ' selected' : ''}>All messages</option><option value="1"${o.defaultMessageNotifications === 1 ? ' selected' : ''}>Only @mentions</option></select></label></div>
        <div class="two"><label class="lab">Verification level<select id="over">${['None', 'Low', 'Medium', 'High', 'Highest'].map((l, i) => `<option value="${i}"${i === o.verificationLevel ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="lab">Explicit media filter<select id="oexp">${['Don\'t scan', 'Members without roles', 'Everyone'].map((l, i) => `<option value="${i}"${i === o.explicitContentFilter ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
        <div class="kb"><div><span>Members</span><kbd>${o.members}</kbd></div><div><span>Boosts</span><kbd>${o.boosts} (level ${o.tier})</kbd></div><div><span>Created</span><kbd>${new Date(o.created).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</kbd></div></div>
        <div class="savebar"><button class="btn" id="osave">Save Changes</button></div>`;
      let icon = null;
      q('#oicon').onclick = async () => { const f = await pickImage(); if (f) { icon = await b64(f); q('#oicon').innerHTML = `<img src="${URL.createObjectURL(f)}" alt=""><span>Change</span>`; } };
      q('#osave').onclick = () => M_('overview', 'PATCH', { name: q('#oname').value.trim(), description: q('#odesc').value, icon, afkChannel: q('#oafk').value, afkTimeout: +q('#oafkt').value, systemChannel: q('#osys').value,
        defaultMessageNotifications: +q('#onot').value, verificationLevel: +q('#over').value, explicitContentFilter: +q('#oexp').value }).then(() => toast('Saved'), (x) => toast(x.message, true));
      return;
    }
    if (k === 'roles') {
      const r = await M_('roles');
      if (arg) { // one role's editor
        const role = r.roles.find((x) => x.id === arg); if (!role) return again('roles');
        const me = await M_('overview');
        const isEveryone = role.name === '@everyone';
        box.innerHTML = `<h1><button class="link" id="rback">Roles</button> / ${esc(role.name)}</h1>
          ${isEveryone ? '' : `<div class="two"><label class="lab">Role name<input id="rn" value="${esc(role.name)}"${role.editable ? '' : ' disabled'}></label><label class="lab">Colour<input id="rc" type="color" value="${role.color || '#99aab5'}"></label></div>
          ${toggleRow('rh', 'Show members separately', role.hoist)}${toggleRow('rm', 'Allow anyone to @mention this role', role.mentionable)}`}
          <h3>Permissions</h3><input class="rsearch wide" id="pq" placeholder="Search permissions">
          <div class="plist">${me.allPerms.filter((x) => PERM_NAMES[x]).map((x) => `<label class="trow" data-pn="${PERM_NAMES[x].toLowerCase()}"><span><b>${PERM_NAMES[x]}</b></span><input type="checkbox" class="sw" data-perm="${x}"${role.perms.includes(x) ? ' checked' : ''}${me.perms.includes(x) || me.perms.includes('Administrator') ? '' : ' disabled'}></label>`).join('')}</div>
          <div class="savebar">${isEveryone || role.managed ? '' : '<button class="btn red" id="rdel">Delete Role</button>'}<button class="btn" id="rsave">Save Changes</button></div>`;
        q('#rback').onclick = () => again('roles');
        q('#pq').oninput = (e) => { const t = e.target.value.toLowerCase(); for (const l of box.querySelectorAll('[data-pn]')) l.hidden = !l.dataset.pn.includes(t); };
        q('#rsave').onclick = () => M_(`roles/${role.id}`, 'PATCH', { name: q('#rn')?.value.trim(), color: q('#rc')?.value, hoist: q('#rh')?.checked, mentionable: q('#rm')?.checked,
          perms: [...box.querySelectorAll('[data-perm]')].filter((x) => x.checked).map((x) => x.dataset.perm) }).then(() => toast('Saved'), (x) => toast(x.message, true));
        if (q('#rdel')) q('#rdel').onclick = async () => { if (await ask({ title: 'Delete Role', body: `Delete <b>${esc(role.name)}</b>?`, ok: 'Delete', danger: true })) M_(`roles/${role.id}`, 'DELETE').then(() => { toast('Deleted'); again('roles'); }, (x) => toast(x.message, true)); };
        return;
      }
      box.innerHTML = `<h1>Roles</h1><div class="frow"><input class="rsearch wide" id="rq" placeholder="Search roles"><button class="btn" id="rnew">Create Role</button></div>
        <div class="rtable">${r.roles.map((x) => `<button class="rline" data-role="${x.id}" data-rn="${esc(x.name.toLowerCase())}"><i style="background:${x.color || '#99aab5'}"></i><b>${esc(x.name)}</b><span>${x.members} ${x.members === 1 ? 'member' : 'members'}</span>${x.managed ? '<span class="tag">BOT</span>' : ''}</button>`).join('')}</div>`;
      q('#rq').oninput = (e) => { const t = e.target.value.toLowerCase(); for (const l of box.querySelectorAll('[data-rn]')) l.hidden = !l.dataset.rn.includes(t); };
      q('#rnew').onclick = async () => { const n = await ask({ title: 'Create Role', input: { label: 'Role name', value: 'new role' }, ok: 'Create' }); if (n) M_('roles', 'POST', { name: n }).then((x) => again('roles', x.id), (x) => toast(x.message, true)); };
      box.querySelector('.rtable').onclick = (e) => { const b = e.target.closest('[data-role]'); if (b) again('roles', b.dataset.role); };
      return;
    }
    if (k === 'emojis' || k === 'stickers') {
      const r = await M_(k);
      const list = k === 'emojis' ? r.emojis : r.stickers;
      box.innerHTML = `<h1>${k === 'emojis' ? 'Emoji' : 'Stickers'}</h1><div class="frow"><button class="btn" id="up">Upload ${k === 'emojis' ? 'Emoji' : 'Sticker'}</button><span class="note">${list.length} in this server</span></div>
        <div class="egrid">${list.map((x) => `<div class="eitem"><img src="${k === 'emojis' ? `https://cdn.discordapp.com/emojis/${x.id}.${x.animated ? 'gif' : 'webp'}?size=96` : esc(x.url)}" alt="" loading="lazy"><span>${k === 'emojis' ? ':' + esc(x.name) + ':' : esc(x.name)}</span>${k === 'emojis' ? `<button class="ico" data-ren="${x.id}" title="Rename">${I.edit}</button>` : ''}<button class="ico danger" data-del="${x.id}" title="Delete">${I.trash}</button></div>`).join('')}</div>`;
      q('#up').onclick = async () => { const f = await pickImage(); if (!f) return; const n = await ask({ title: 'Name it', input: { label: 'Name', value: f.name.replace(/\.\w+$/, '').replace(/\W/g, '_') }, ok: 'Upload' }); if (!n) return;
        M_(k, 'POST', { name: n, image: await b64(f) }).then(() => { toast('Uploaded'); again(k); }, (x) => toast(x.message, true)); };
      box.querySelector('.egrid').onclick = async (e) => {
        const d = e.target.closest('[data-del]'), rn = e.target.closest('[data-ren]');
        if (d && await ask({ title: 'Delete', body: 'Delete this for everyone?', ok: 'Delete', danger: true })) M_(`${k}/${d.dataset.del}`, 'DELETE').then(() => again(k), (x) => toast(x.message, true));
        if (rn) { const n = await ask({ title: 'Rename Emoji', input: { label: 'Name', value: rn.parentElement.querySelector('span').textContent.replace(/:/g, '') }, ok: 'Save' }); if (n) M_(`emojis/${rn.dataset.ren}`, 'PATCH', { name: n }).then(() => again(k), (x) => toast(x.message, true)); }
      };
      return;
    }
    if (k === 'invites') {
      const r = await M_('invites');
      box.innerHTML = `<h1>Invites</h1><div class="frow"><select id="ich">${g.channels.filter((c) => c.type === CH.TEXT).map((c) => `<option value="${c.id}"${c.id === S.cid ? ' selected' : ''}>#${esc(c.name)}</option>`).join('')}</select>
        <select id="iage"><option value="0">Never expires</option><option value="1800">30 minutes</option><option value="3600">1 hour</option><option value="86400">1 day</option><option value="604800" selected>7 days</option></select><button class="btn" id="inew">Create Invite</button></div>
        <div class="tbl">${r.invites.map((i) => `<div class="trow2"><b>${esc(i.code)}</b><span>#${esc(i.channel || '')}</span><span>${esc(i.by || '')}</span><span>${i.uses}${i.max ? '/' + i.max : ''} uses</span><span>${i.expires ? 'until ' + fmtWhen(i.expires) : 'never expires'}</span><button class="ico" data-copy="https://discord.gg/${esc(i.code)}" title="Copy">${I.file}</button><button class="ico danger" data-rev="${esc(i.code)}" title="Revoke">${I.trash}</button></div>`).join('') || '<div class="note">No invites</div>'}</div>`;
      q('#inew').onclick = () => M_('invites', 'POST', { channel: q('#ich').value, maxAge: +q('#iage').value }).then((x) => { copy(x.url); again('invites'); }, (x) => toast(x.message, true));
      box.querySelector('.tbl').onclick = (e) => { const c = e.target.closest('[data-copy]'), rv = e.target.closest('[data-rev]'); if (c) copy(c.dataset.copy); if (rv) M_(`invites/${rv.dataset.rev}`, 'DELETE').then(() => again('invites'), (x) => toast(x.message, true)); };
      return;
    }
    if (k === 'bans') {
      const r = await M_('bans');
      box.innerHTML = `<h1>Bans <span class="note">${r.bans.length}</span></h1><input class="rsearch wide" id="bq" placeholder="Search bans">
        <div class="tbl">${r.bans.map((b) => `<div class="trow2" data-bn="${esc((b.name + ' ' + b.username + ' ' + b.id).toLowerCase())}"><img src="${esc(b.avatar)}" alt=""><b>${esc(b.name)}</b><span>${esc(b.reason || 'No reason')}</span><button class="btn sec small" data-unban="${b.id}">Unban</button></div>`).join('') || '<div class="note">Nobody is banned</div>'}</div>`;
      q('#bq').oninput = (e) => { const t = e.target.value.toLowerCase(); for (const l of box.querySelectorAll('[data-bn]')) l.hidden = !l.dataset.bn.includes(t); };
      box.querySelector('.tbl').onclick = (e) => { const u = e.target.closest('[data-unban]'); if (u) M_(`bans/${u.dataset.unban}`, 'DELETE').then(() => { toast('Unbanned'); again('bans'); }, (x) => toast(x.message, true)); };
      return;
    }
    if (k === 'audit') {
      const r = await M_('audit');
      const words = (t) => String(t || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, (c) => c.toUpperCase());
      box.innerHTML = `<h1>Audit Log</h1><div class="tbl">${r.entries.map((e) => `<div class="arow2">${e.byAvatar ? `<img src="${esc(e.byAvatar)}" alt="">` : ''}<div><div><b>${esc(e.by || 'Someone')}</b> ${esc(words(e.actionType).toLowerCase())} ${esc(words(e.targetType).toLowerCase())} <b>${esc(e.target || '')}</b> <span class="when">${fmtWhen(e.at)}</span></div>
        ${e.reason ? `<div class="note">Reason: ${esc(e.reason)}</div>` : ''}${e.changes.length ? `<div class="chg">${e.changes.map((c) => `<span>${esc(c.key)}: ${esc(String(c.old ?? '–'))} → ${esc(String(c.new ?? '–'))}</span>`).join('')}</div>` : ''}</div></div>`).join('')}</div>`;
      return;
    }
    if (k === 'webhooks') {
      const r = await M_('webhooks');
      box.innerHTML = `<h1>Webhooks</h1><div class="tbl">${r.webhooks.map((w) => `<div class="trow2">${w.avatar ? `<img src="${esc(w.avatar)}" alt="">` : ''}<b>${esc(w.name)}</b><span>#${esc(w.channel || '')}</span><span>${esc(w.by || '')}</span><button class="ico danger" data-wdel="${w.id}" title="Delete">${I.trash}</button></div>`).join('') || '<div class="note">No webhooks</div>'}</div>`;
      box.querySelector('.tbl').onclick = async (e) => { const d = e.target.closest('[data-wdel]'); if (d && await ask({ title: 'Delete Webhook', ok: 'Delete', danger: true })) M_(`webhooks/${d.dataset.wdel}`, 'DELETE').then(() => again('webhooks'), (x) => toast(x.message, true)); };
    }
  }
  // ---------- voice channel view: participant tiles, chat on the right (like Discord)
  S.callChat = store.get('callChat', true);
  function renderCall() {
    const c = chan(S.cid), g = S.guilds.get(S.gid);
    const on = isVoice(c) && !!g;
    $('#main').classList.toggle('vcview', on);
    $('#main').classList.toggle('nochat', on && !S.callChat);
    const grid = $('#callgrid'); grid.hidden = !on;
    if (!on) return;
    const ms = g.voice[c.id] || [], here = S.voice?.channelId === c.id;
    grid.innerHTML = `<div class="tiles n${Math.min(ms.length, 9)}">${ms.map((m) => `<div class="tile" data-uid="${m.id}"><div class="tav">${avatarHTML(m, null, 80)}</div><div class="tname">${m.mute || m.deaf ? (m.deaf ? I.headOff : I.micOff) : ''}<span>${esc(m.name)}</span>${m.stream ? '<span class="live">LIVE</span>' : ''}</div></div>`).join('')
      || `<div class="callempty"><h2>${esc(c.name)}</h2><div>No one is here yet.</div></div>`}</div>
      <div class="callbar">${here ? `<button class="cb${Voice.muted ? ' off' : ''}" data-cb="mute" title="Mute">${Voice.muted ? I.micOff : I.mic}</button><button class="cb${Voice.deaf ? ' off' : ''}" data-cb="deaf" title="Deafen">${Voice.deaf ? I.headOff : I.head}</button>${NATIVE ? `<button class="cb${S.sharing ? ' sharing' : ''}" data-cb="share" title="${S.sharing ? 'Stop sharing ' + esc(S.sharing) : 'Share an app\'s audio'}">${I.speakerS}</button>` : ''}<button class="cb red" data-cb="leave" title="Disconnect">${I.leave}</button>`
        : '<button class="btn joinbtn" data-cb="join">Join Voice</button>'}<button class="cb${S.callChat ? ' on' : ''}" data-cb="chat" title="Show chat">${I.chat}</button></div>`;
    twe(grid); paintSpeaking();
  }
  $('#callgrid').addEventListener('click', (e) => {
    const t = e.target.closest('.tile'); if (t && !e.target.closest('.callbar')) { showProfile(t.dataset.uid, t); return; }
    const b = e.target.closest('[data-cb]'); if (!b) return;
    const a = b.dataset.cb;
    if (a === 'share') { shareAudioMenu(b); return; }
    if (a === 'join') joinVoice(S.cid);
    if (a === 'leave') leaveVoice();
    if (a === 'mute') $('#bmute').click();
    if (a === 'deaf') $('#bdeaf').click();
    if (a === 'chat') { S.callChat = !S.callChat; store.set('callChat', S.callChat); renderCall(); if (S.callChat) scrollBottom(); }
    renderCall();
  });
  $('#callgrid').addEventListener('contextmenu', (e) => { const t = e.target.closest('.tile'); if (t) { e.preventDefault(); userMenu(e, t.dataset.uid, true); } });
  function paintSpeaking() {
    for (const el of document.querySelectorAll('.vm, .tile')) {
      const uid = el.dataset.uid;
      el.classList.toggle('talk', uid === S.me?.id ? (Voice.sending || S.selfSpeaking) : S.speaking.has(uid));
    }
    $('#meid .av')?.classList.toggle('talk', Voice.sending);
  }
  function paintTimers() { // VC call timers, like your setup
    const now = Date.now();
    for (const el of document.querySelectorAll('.vtimer')) {
      const s2 = Math.max(0, Math.floor((now - +el.dataset.since) / 1000));
      el.textContent = `${Math.floor(s2 / 3600)}:${String(Math.floor(s2 / 60) % 60).padStart(2, '0')}:${String(s2 % 60).padStart(2, '0')}`;
    }
  }
  setInterval(paintTimers, 1000);
  function paintTypingRows() { // TypingIndicator: dots on channels where someone is typing
    if (!on('TypingIndicator')) return;
    const now = Date.now();
    for (const el of document.querySelectorAll('#chans [data-c], #chans [data-vc]')) {
      const id = el.dataset.c || el.dataset.vc, t = S.typing.get(id);
      const on = t && [...t.values()].some((x) => x.until > now) && id !== S.cid;
      let dot = el.querySelector('.tdots');
      if (on && !dot) { dot = document.createElement('span'); dot.className = 'tdots'; dot.innerHTML = '<i></i><i></i><i></i>'; el.querySelector('.nm').after(dot); }
      else if (!on && dot) dot.remove();
    }
  }

  // ------------------------------------------------------------------ members
  async function loadMembers(gid, force) {
    if (!force && S.members.has(gid)) { if (gid === S.gid) renderMembers(); return; }
    try {
      const r = await api('GET', `/guilds/${gid}/members`);
      r.byId = new Map(r.members.map((m) => [m.id, m]));
      S.members.set(gid, r);
      if (gid === S.gid) { renderMembers(); renderSideHead(); }
    } catch (e) { console.warn('members', e); }
  }
  let rmT = null;
  const renderMembersSoon = () => { if (!rmT) rmT = setTimeout(() => { rmT = null; renderMembers(); }, 250); };
  const VIEWERS = new Map(); // channel id -> Set of member ids who can see it (null = everyone)
  async function loadViewers(cid) {
    if (!cid || VIEWERS.has(cid) || S.gid === DMG) return;
    VIEWERS.set(cid, undefined);
    try { const r = await api('GET', `/channels/${cid}/viewers`); VIEWERS.set(cid, r.all ? null : new Set(r.ids)); if (S.cid === cid) renderMembers(); }
    catch { VIEWERS.delete(cid); }
  }
  function renderMembers() {
    const ms0 = S.members.get(S.gid), g = S.guilds.get(S.gid);
    const vw = VIEWERS.get(S.cid);
    const ms = ms0 && vw ? { ...ms0, members: ms0.members.filter((m) => vw.has(m.id)) } : ms0;
    if (!ms || !g) { $('#members').innerHTML = ''; return; }
    const groups = new Map(ms.roles.map((r) => [r.id, { role: r, list: [] }]));
    const online = { role: { name: 'Online' }, list: [] }, offline = { role: { name: 'Offline' }, list: [] };
    for (const m of ms.members) {
      if (m.status === 'offline') offline.list.push(m);
      else (groups.get(m.hoist) || online).list.push(m);
    }
    const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    let html = ms.counts ? `<div class="mcount"><span><i class="dot on"></i>${ms.counts.online.toLocaleString()}</span><span><i class="dot"></i>${ms.counts.total.toLocaleString()}</span><span>${I.mic}${ms.counts.voice}</span></div>` : '';
    for (const grp of [...groups.values(), online, offline]) {
      if (!grp.list.length) continue;
      grp.list.sort(byName);
      const ic = grp.role.icon ? `<img src="${esc(grp.role.icon)}" alt="">` : grp.role.emoji ? `<span class="ue">${esc(grp.role.emoji)}</span>` : '';
      html += `<h3>${ic}${esc(grp.role.name)} — ${grp.list.length}</h3>` + grp.list.map((m) => memberHTML(m, g)).join('');
    }
    const el = $('#members');
    const q0 = $('#msq')?.value || '';
    el.innerHTML = html; twe(el);
    const q1 = $('#hsq')?.value || ''; if (q1) filterMembers(q1);
  }
  function filterMembers(q) {
    q = q.trim().toLowerCase();
    const ms = S.members.get(S.gid);
    for (const row of document.querySelectorAll('#members .mem')) {
      const m = ms?.byId.get(row.dataset.uid);
      row.hidden = !!q && !(m && [m.name, m.username, nickOf(m)].some((x) => x && x.toLowerCase().includes(q)));
    }
    for (const h of document.querySelectorAll('#members h3')) { // hide groups with no matches
      let n = h.nextElementSibling, any = false;
      while (n && n.tagName !== 'H3') { if (n.classList.contains('mem') && !n.hidden) any = true; n = n.nextElementSibling; }
      h.hidden = !any;
    }
  }
  $('#members').addEventListener('input', (e) => { if (e.target.id === 'msq') filterMembers(e.target.value); });
  const platHTML = (u) => (u.platforms || []).filter((p) => p !== 'desktop' || (u.platforms || []).length > 1).map((p) => I[p] || '').join('');
  const ACTVERB = ['Playing', 'Streaming', 'Listening to', 'Watching', '', 'Competing in'];
  function memberHTML(m, g) {
    const sub = m.custom ? esc(m.custom) : m.activity ? `${ACTVERB[m.actType ?? 0] ?? 'Playing'} <b>${esc(m.activity)}</b>` : '';
    const np = m.nameplate ? ` style="--np:url('${esc(m.nameplate.img)}')"` : '';
    return `<button class="mem${m.status === 'offline' ? ' off' : ''}${m.nameplate ? ' np' : ''}" data-uid="${m.id}"${np}>${avatarHTML(m, m.status)}<span class="who"><span class="nrow"><b class="${m.grad ? 'grad' : ''}" style="${nameStyle(m)}">${esc(nickOf(m) || m.name)}</b>${clanHTML(m)}${on('ForceOwnerCrown') && m.id === g.owner ? I.crown : ''}${m.bot ? '<span class="tag">APP</span>' : ''}${platHTML(m)}</span>${sub ? `<small>${sub}</small>` : ''}</span></button>`;
  }
  function patchMember(m) {
    const el = $(`#members .mem[data-uid="${m.id}"]`); if (!el) return;
    const t = document.createElement('div'); t.innerHTML = memberHTML(m, S.guilds.get(S.gid)); twe(t); el.replaceWith(t.firstElementChild);
  }
  $('#members').addEventListener('click', (e) => { const m = e.target.closest('.mem'); if (m) showProfile(m.dataset.uid, m, 'left'); });
  $('#members').addEventListener('contextmenu', (e) => { const m = e.target.closest('.mem'); if (m) { e.preventDefault(); userMenu(e, m.dataset.uid); } });

  // ------------------------------------------------------------------ profiles
  async function showProfile(uid, anchor, side) {
    const gid = S.gid === DMG ? null : S.gid;
    const r = anchor.getBoundingClientRect();
    const place = (p) => side === 'left' ? [r.left - p.offsetWidth - 12, r.top] : [r.right + 12, r.top];
    let p;
    try { p = await api('GET', `/users/${uid}${gid ? `?guild=${gid}` : ''}`); } catch (e) { toast(e.message, true); return; }
    const g = S.guilds.get(gid);
    const inVc = g && Object.entries(g.voice).find(([, list]) => list.some((x) => x.id === uid));
    const ban = p.banner ? `background-image:url('${esc(p.banner)}')` : `background:${p.accent || p.color || '#5865f2'}`;
    const BADGE = { Staff: ['Discord Staff', '🛠️'], Partner: ['Partnered Server Owner', '🤝'], Hypesquad: ['HypeSquad Events', '🎉'], HypeSquadOnlineHouse1: ['HypeSquad Bravery', '🟣'], HypeSquadOnlineHouse2: ['HypeSquad Brilliance', '🔶'],
      HypeSquadOnlineHouse3: ['HypeSquad Balance', '🟢'], BugHunterLevel1: ['Bug Hunter', '🐛'], BugHunterLevel2: ['Bug Hunter Gold', '🐞'], PremiumEarlySupporter: ['Early Supporter', '💎'], VerifiedDeveloper: ['Early Verified Bot Developer', '🛠'],
      CertifiedModerator: ['Moderator Programs Alumni', '🛡️'], ActiveDeveloper: ['Active Developer', '⌨️'], VerifiedBot: ['Verified App', '✔️'] };
    const badges = (p.flags || []).filter((f) => BADGE[f]).map((f) => `<span class="pbadge ue" title="${BADGE[f][0]}">${BADGE[f][1]}</span>`).join('');
    const note = store.get('notes', {})[uid] || '';
    const actTxt = p.activity ? `${ACTVERB[p.activity.type] || ''} <b>${esc(p.activity.name)}</b>` : '';
    const html = `<div class="prof">
      <div class="ban" style="${ban}"><button class="pmore" data-pa="more" title="More">${I.dots}</button></div>
      <div class="phead"><div class="pav" data-pa="full" title="View Full Profile"><img src="${esc(px(p.avatar, 80))}"${anim(p.avatar, p.avatarAnim, 80)} alt="">${p.deco ? `<img class="deco" src="${esc(px(p.deco, 96))}"${anim(p.deco, p.decoAnim, 96)} alt="">` : ''}<i class="${p.status}">${dotSVG(p.status)}</i></div>
        ${p.custom ? `<div class="pbubble">${esc(p.custom)}</div>` : ''}</div>
      <div class="pbody">
        <div class="pname" data-pa="full">${esc(nickOf(p) || p.name)}${p.bot ? ' <span class="tag">APP</span>' : ''}</div>
        <div class="puser">${esc(p.tag || p.username)}${p.clan ? ' • ' + clanHTML(p) : ''}${badges ? `<span class="pbadges">${badges}</span>` : ''}</div>
        ${p.activity ? `<div class="pact2">${p.activity.image ? `<img src="${esc(p.activity.image)}" alt="">` : ''}<div><div>${actTxt}</div>${p.activity.details ? `<div class="sm">${esc(p.activity.details)}</div>` : ''}${p.activity.state ? `<div class="sm">${esc(p.activity.state)}</div>` : ''}</div></div>` : ''}
        ${p.names?.length ? `<div class="psec"><h5>Previously known as</h5><div class="pnames">${p.names.slice().reverse().map((x) => `<span title="${esc(x.kind)} · first seen ${new Date(x.at).toLocaleDateString('en-GB')}">${esc(x.value)}</span>`).join('')}</div></div>` : ''}
        ${inVc ? `<div class="psec"><h5>In Voice</h5><div class="pvc">${I.speakerS}${esc(chan(inVc[0])?.name ?? '')}</div></div>` : ''}
        <div class="psec"><h5>Member Since</h5><div class="psince"><span>${I.dm}${new Date(p.created).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>${p.joined ? `<i class="psd"></i><span>${p.guildIcon ? `<img src="${esc(p.guildIcon)}" alt="">` : ''}${new Date(p.joined).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>` : ''}</div></div>
        ${p.roles?.length || p.canRoles ? `<div class="psec"><h5>Roles</h5><div class="roles">${(p.roles || []).map((x) => `<span class="role" data-role="${x.id}"><i style="${x.color ? `background:${x.color}` : ''}"></i>${esc(x.name)}</span>`).join('')}${p.canRoles && p.id !== S.me.id ? `<button class="role add" data-pa="roles" title="Edit roles">${I.plus}</button>` : ''}</div></div>` : ''}
        <div class="psec"><h5>Note <span class="pnh">(only visible to you)</span></h5><textarea class="pnote" placeholder="Click to add a note" rows="1">${esc(note)}</textarea></div>
        ${p.bot || p.id === S.me.id ? '' : `<input class="pmsg" placeholder="Message @${esc(nickOf(p) || p.name)}">`}
      </div></div>`;
    const fmtD = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    function fullProfile() { // Discord's "View Full Profile"
      const box = document.createElement('div'); box.className = 'modal';
      const tabs = [['about', 'About'], ...(p.activity ? [['act', 'Activity']] : []), ...(p.mutual?.length ? [['mutual', `Mutual Servers (${p.mutual.length})`]] : [])];
      const pane = {
        about: () => `${p.names?.length ? `<div class="psec"><h5>Previously known as</h5><div class="pnames">${p.names.slice().reverse().map((x) => `<span>${esc(x.value)}</span>`).join('')}</div></div>` : ''}
          <div class="psec"><h5>Member Since</h5><div class="psince"><span>${I.dm}${fmtD(p.created)}</span>${p.joined ? `<i class="psd"></i><span>${p.guildIcon ? `<img src="${esc(p.guildIcon)}" alt="">` : ''}${fmtD(p.joined)}</span>` : ''}</div></div>
          ${p.roles?.length ? `<div class="psec"><h5>Roles</h5><div class="roles">${p.roles.map((x) => `<span class="role"><i style="${x.color ? `background:${x.color}` : ''}"></i>${esc(x.name)}</span>`).join('')}</div></div>` : ''}
          ${inVc ? `<div class="psec"><h5>In Voice</h5><div class="pvc">${I.speakerS}${esc(chan(inVc[0])?.name ?? '')}</div></div>` : ''}
          <div class="psec"><h5>Note <span class="pnh">(only visible to you)</span></h5><div class="fnote">${esc(store.get('notes', {})[uid] || '') || 'No note'}</div></div>`,
        act: () => `<div class="pact2">${p.activity.image ? `<img src="${esc(p.activity.image)}" alt="">` : ''}<div><div>${actTxt}</div>${p.activity.details ? `<div class="sm">${esc(p.activity.details)}</div>` : ''}${p.activity.state ? `<div class="sm">${esc(p.activity.state)}</div>` : ''}</div></div>`,
        mutual: () => p.mutual.map((x) => `<button class="fmut" data-g="${x.id}">${x.icon ? `<img src="${esc(x.icon)}" alt="">` : `<span class="fmi">${esc(x.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3))}</span>`}<span><b>${esc(x.name)}</b>${x.nick ? `<small>${esc(x.nick)}</small>` : ''}</span></button>`).join(''),
      };
      box.innerHTML = `<div class="fprof prof"><div class="ban" style="${ban}"></div>
        <div class="phead"><div class="pav"><img src="${esc(px(p.avatar, 128))}"${anim(p.avatar, p.avatarAnim, 128)} alt="">${p.deco ? `<img class="deco" src="${esc(px(p.deco, 160))}"${anim(p.deco, p.decoAnim, 160)} alt="">` : ''}<i class="${p.status}">${dotSVG(p.status)}</i></div>
          ${p.custom ? `<div class="pbubble">${esc(p.custom)}</div>` : ''}
          ${p.bot || p.id === S.me.id ? '' : `<button class="btn fmsg" data-f="dm">${I.dm}Message</button>`}</div>
        <div class="pbody"><div class="pname">${esc(nickOf(p) || p.name)}${p.bot ? ' <span class="tag">APP</span>' : ''}</div>
          <div class="puser">${esc(p.tag || p.username)}${p.clan ? ' • ' + clanHTML(p) : ''}${badges ? `<span class="pbadges">${badges}</span>` : ''}</div>
          <div class="ftabs">${tabs.map(([k, l], i) => `<button data-t="${k}"${i ? '' : ' class="on"'}>${l}</button>`).join('')}</div>
          <div class="fpane">${pane.about()}</div></div></div>`;
      document.body.append(box); twe(box);
      const close = () => { box.remove(); document.removeEventListener('keydown', esc1, true); };
      const esc1 = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
      document.addEventListener('keydown', esc1, true);
      box.onclick = (e) => {
        if (e.target === box) return close();
        const t = e.target.closest('[data-t]');
        if (t) { for (const b of box.querySelectorAll('[data-t]')) b.classList.toggle('on', b === t); box.querySelector('.fpane').innerHTML = pane[t.dataset.t](); twe(box); return; }
        if (e.target.closest('[data-f="dm"]')) { close(); openDm(uid); return; }
        const gb = e.target.closest('[data-g]'); if (gb) { close(); openGuild?.(gb.dataset.g); }
      };
    }
    const pop = showPop(0, 0, html);
    const [x, y] = place(pop); pop.style.left = Math.max(8, Math.min(x, innerWidth - pop.offsetWidth - 8)) + 'px'; pop.style.top = Math.max(8, Math.min(y, innerHeight - pop.offsetHeight - 8)) + 'px';
    twe(pop);
    const nt = pop.querySelector('.pnote');
    if (nt) { const fit = () => { nt.style.height = 'auto'; nt.style.height = nt.scrollHeight + 'px'; }; fit(); nt.oninput = () => { fit(); const n = store.get('notes', {}); if (nt.value.trim()) n[uid] = nt.value; else delete n[uid]; store.set('notes', n); }; nt.onkeydown = (e) => e.stopPropagation(); }
    const qm = pop.querySelector('.pmsg');
    if (qm) qm.onkeydown = async (e) => {
      e.stopPropagation();
      if (e.key !== 'Enter' || !qm.value.trim()) return;
      const text = qm.value.trim(); qm.value = ''; qm.disabled = true;
      try { const r = await api('POST', '/dms', { userId: uid }); await api('POST', `/channels/${r.dm.id}/messages`, { nonce: String(BigInt(Date.now() - 1420070400000) << 22n), content: convertOut(text) }); toast(`Sent to ${p.name}`); hidePop(); }
      catch (x) { toast(x.message, true); qm.disabled = false; qm.value = text; }
    };
    pop.onclick = (e) => {
      const a = e.target.closest('[data-pa]')?.dataset.pa; if (!a) return;
      const r2 = e.target.closest('[data-pa]').getBoundingClientRect();
      if (a === 'more') { userMenu({ clientX: r2.right + 6, clientY: r2.top, target: anchor }, uid, inVc && inVc[0] === S.voice?.channelId); return; }
      if (a === 'roles') { rolesPop(uid, { clientX: r2.left, clientY: r2.bottom + 4 }); return; }
      hidePop();
      if (a === 'full') fullProfile();
      if (a === 'dm') openDm(uid);
      if (a === 'mention') mention(uid, p.name);
      if (a === 'id') copy(uid);
      if (a === 'roles') { rolesPop(uid, { clientX: r2.left, clientY: r2.bottom + 4 }); return; }
      if (a === 'more') { userMenu({ clientX: r2.left, clientY: r2.bottom + 4, target: anchor }, uid, inVc && inVc[0] === S.voice?.channelId); }
    };
  }
  async function openDm(uid) {
    try {
      const r = await api('POST', '/dms', { userId: uid });
      if (!S.dms.some((d) => d.id === r.dm.id)) S.dms.unshift(r.dm);
      S.gid = DMG; store.set('gid', DMG); store.set('chan.' + DMG, r.dm.id);
      $('#app').classList.add('nomembers');
      renderRail(); renderSideHead(); renderChannels(); openChannel(r.dm.id);
    } catch (e) { toast(e.message, true); }
  }
  function mention(uid, name) { S.aliases.set('@' + name, `<@${uid}>`); insert(`@${name} `); }
  function userMenu(e, uid, inVoice) {
    const m = memberById(uid);
    const items = [['Profile', () => showProfile(uid, e.target.closest('[data-uid]') || e.target)], ['Mention', () => mention(uid, m?.name || 'user')]];
    if (!m?.bot && uid !== S.me.id) items.push(['Message', () => openDm(uid)]);
    if (inVoice && uid !== S.me.id) items.push(['__vol', uid]);
    if (uid !== S.me.id) items.push(['Alerts…', () => alertPop(uid, e)]);
    if (inVoice && uid !== S.me.id && S.gid !== DMG) items.push(['Voice…', () => voicePop(uid, e)]);
    if (uid !== S.me.id) items.push([NICK[uid] ? 'Edit Private Nickname' : 'Add Private Nickname', async () => { const v = await ask({ title: 'Private Nickname', body: 'Only you see this, in V1 Client.', input: { label: 'Nickname', value: NICK[uid] || '' }, ok: 'Save' }); if (v === null) return; if (v.trim()) NICK[uid] = v.trim(); else delete NICK[uid]; store.set('nicks', NICK); renderLog(); renderMembers(); renderChannels(); }]);
    if (S.gid !== DMG && uid !== S.me.id) items.push(['-'], ['Roles', () => rolesPop(uid, e)], ['Change Nickname', () => modAct(uid, 'nick')], ['Timeout', () => timeoutPop(uid, e)], ['Kick', () => modAct(uid, 'kick'), 'red'], ['Ban', () => modAct(uid, 'ban'), 'red']);
    items.push(['-'], ['Copy User ID', () => copy(uid)]);
    menu(e, items);
  }
  async function modAct(uid, act) {
    const m = memberById(uid), name = m?.name || 'them', g = S.gid;
    try {
      if (act === 'nick') { const v = await ask({ title: 'Change Nickname', input: { label: 'Nickname', value: m?.name || '' }, ok: 'Save' }); if (v === null) return; await api('POST', `/guilds/${g}/members/${uid}/nick`, { nick: v.trim() }); toast('Nickname changed'); }
      if (act === 'kick') { const r = await ask({ title: `Kick ${name}`, body: `${esc(name)} can rejoin with a new invite.`, input: { label: 'Reason', placeholder: 'Optional' }, ok: 'Kick', danger: true }); if (r === null) return; await api('POST', `/guilds/${g}/members/${uid}/kick`, { reason: r }); toast(`Kicked ${name}`); }
      if (act === 'ban') { const r = await ask({ title: `Ban ${name}`, body: 'Also deletes their messages from the last hour.', input: { label: 'Reason', placeholder: 'Optional' }, ok: 'Ban', danger: true }); if (r === null) return; await api('POST', `/guilds/${g}/members/${uid}/ban`, { reason: r, deleteSeconds: 3600 }); toast(`Banned ${name}`); }
    } catch (x) { toast(x.message, true); }
  }
  function timeoutPop(uid, e) {
    const opts = [['60 seconds', 6e4], ['5 minutes', 3e5], ['10 minutes', 6e5], ['1 hour', 36e5], ['1 day', 864e5], ['1 week', 6048e5], ['Remove timeout', 0]];
    menu(e, opts.map(([l, ms]) => [l, () => api('POST', `/guilds/${S.gid}/members/${uid}/timeout`, { ms: ms || null }).then(() => toast(ms ? `Timed out for ${l}` : 'Timeout removed'), (x) => toast(x.message, true)), ms ? '' : 'red']));
  }
  async function rolesPop(uid, e) {
    let r; try { r = await api('GET', `/guilds/${S.gid}/members/${uid}/roles`); } catch (x) { toast(x.message, true); return; }
    hideMenu();
    cm.innerHTML = `<div class="menu roles-pop"><input class="rsearch" placeholder="Search roles">${r.roles.map((x) => `<button class="rrow${x.has ? ' on' : ''}${x.can ? '' : ' no'}" data-r="${x.id}" data-name="${esc(x.name.toLowerCase())}" title="${x.can ? '' : 'V1 can\'t assign this role: it\'s above V1\'s top role, or managed by an integration'}"><i style="background:${x.color || '#99aab5'}"></i><span>${esc(x.name)}</span>${x.can ? '<b class="rcheck"></b>' : I.lock}</button>`).join('')}</div>`;
    cm.hidden = false;
    const w = cm.offsetWidth, h = cm.offsetHeight;
    cm.style.left = Math.max(8, Math.min(e.clientX, innerWidth - w - 8)) + 'px'; cm.style.top = Math.max(8, Math.min(e.clientY, innerHeight - h - 8)) + 'px';
    const inp = cm.querySelector('.rsearch'); inp.focus();
    inp.oninput = () => { const q = inp.value.toLowerCase(); for (const l of cm.querySelectorAll('.rrow')) l.hidden = !l.dataset.name.includes(q); };
    inp.onkeydown = (ev) => ev.stopPropagation();
    cm.onclick = (ev) => {
      const b2 = ev.target.closest('.rrow'); if (!b2 || b2.classList.contains('no')) return;
      const add = !b2.classList.contains('on'); b2.classList.toggle('on', add);
      const role = r.roles.find((x) => x.id === b2.dataset.r);
      api('POST', `/guilds/${S.gid}/members/${uid}/role`, { roleId: role.id, add }).then(() => {
        const pills = document.querySelector('#pop .prof .roles'); if (!pills) return; // keep the open profile in step
        const ex = pills.querySelector(`[data-role="${role.id}"]`);
        if (add && !ex) pills.querySelector('.role.add')?.insertAdjacentHTML('beforebegin', `<span class="role" data-role="${role.id}"><i style="${role.color ? `background:${role.color}` : ''}"></i>${esc(role.name)}</span>`);
        if (!add) ex?.remove();
      }, (x) => { toast(x.message, true); b2.classList.toggle('on', !add); });
    };
  }
  async function alertPop(uid, e) {
    const a = await api('GET', '/alerts'); const w = (a.users || {})[uid] || {};
    menu(e, [[(w.online ? '✓ ' : '') + 'Alert when they come online', () => setW({ ...w, online: !w.online })], [(w.voice ? '✓ ' : '') + 'Alert when they join voice', () => setW({ ...w, voice: !w.voice })]]);
    function setW(v) { const users = { ...(a.users || {}) }; if (v.online || v.voice) users[uid] = v; else delete users[uid]; api('POST', '/alerts', { users }).then(() => toast('Alerts updated')); }
  }
  function voicePop(uid, e) {
    const g = S.guilds.get(S.gid); const vcs = g.channels.filter(isVoice);
    const V = (body, msg) => api('POST', `/voice/${S.gid}`, body).then(() => toast(msg), (x) => toast(x.message, true));
    menu(e, [...vcs.map((c) => [`Move to ${c.name}`, () => V({ userId: uid, action: 'move', to: c.id }, 'Moved')]), ['-'],
      ['Server Mute', () => V({ userId: uid, action: 'mute', on: true }, 'Muted')], ['Server Unmute', () => V({ userId: uid, action: 'mute', on: false }, 'Unmuted')],
      ['Server Deafen', () => V({ userId: uid, action: 'deafen', on: true }, 'Deafened')], ['Server Undeafen', () => V({ userId: uid, action: 'deafen', on: false }, 'Undeafened')],
      ['Disconnect', () => V({ userId: uid, action: 'disconnect' }, 'Disconnected'), 'red']]);
  }
  const memberById = (uid) => { for (const ms of S.members.values()) { const m = ms.byId.get(uid); if (m) return m; } return null; };

  // ------------------------------------------------------------------ messages
  const READ = store.get('read', {});
  const maxId = (...ids) => ids.filter(Boolean).reduce((a2, b2) => (BigInt(b2) > BigInt(a2) ? b2 : a2), '0');
  const markRead = (cid) => { const c = chan(cid); const last = maxId(S.msgs.get(cid)?.at(-1)?.id, c?.last, READ[cid]); if (last !== '0') { READ[cid] = last; clearTimeout(markRead.t); markRead.t = setTimeout(() => store.set('read', READ), 1500); } };
  function seedUnread() {
    for (const g of S.guilds.values()) for (const c of g.channels) {
      if (!c.last || c.type === CH.CAT) continue;
      if (!READ[c.id]) READ[c.id] = c.last; // first run: everything counts as read
      else if (BigInt(c.last) > BigInt(READ[c.id]) && !S.unread.has(c.id)) S.unread.set(c.id, { n: 1, mentions: 0 });
    }
    store.set('read', READ);
  }
  // bots get generous read limits: keep the next channels you're likely to open already loaded
  const INFLIGHT = new Map(); const preQ = []; let preBusy = 0;
  function fetchChan(cid) {
    if (INFLIGHT.has(cid)) return INFLIGHT.get(cid);
    const p2 = api('GET', `/channels/${cid}/messages?limit=50`).then((r) => {
      if (!S.msgs.has(cid)) { S.msgs.set(cid, r.messages); S.more.set(cid, r.messages.length === 50); if (!S.lru.includes(cid)) S.lru.push(cid); }
      return true;
    }).finally(() => INFLIGHT.delete(cid));
    INFLIGHT.set(cid, p2); return p2;
  }
  function prefetch(cid, urgent) {
    if (!cid || S.msgs.has(cid) || INFLIGHT.has(cid) || preQ.includes(cid)) return;
    urgent ? preQ.unshift(cid) : preQ.push(cid); pump();
  }
  function pump() { while (preBusy < 3 && preQ.length) { const cid = preQ.shift(); if (S.msgs.has(cid)) continue; preBusy++; fetchChan(cid).catch(() => {}).finally(() => { preBusy--; pump(); }); } }
  function prefetchGuild(gid) {
    if (gid === DMG) { for (const d of S.dms.slice(0, 15)) prefetch(d.id); return; }
    const g = S.guilds.get(gid); if (!g) return;
    const list = sortedChannels(g).filter((c) => c.type !== CH.CAT && !isVoice(c) && c.type !== 15 && c.type !== 16);
    const unread = list.filter((c) => S.unread.has(c.id)), rest = list.filter((c) => !S.unread.has(c.id));
    for (const c of [...unread, ...rest].slice(0, 40)) prefetch(c.id);
  }
  $('#chans').addEventListener('mouseover', (e) => { const r = e.target.closest('[data-c], [data-vc]'); if (r) prefetch(r.dataset.c || r.dataset.vc, true); }, { passive: true });
  $('#rail').addEventListener('mouseover', (e) => { const b = e.target.closest('.srv[data-g]'); if (!b) return; const g = S.guilds.get(b.dataset.g); const last = store.get('chan.' + b.dataset.g); if (last) prefetch(last, true); else if (g) { const f = sortedChannels(g).find((c) => c.type !== CH.CAT && !isVoice(c)); if (f) prefetch(f.id, true); } }, { passive: true });
  // forum / media channels: a list of posts (each post is a thread), like Discord
  const ago = (ts) => { const m = Math.round((Date.now() - ts) / 6e4); return m < 1 ? 'now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : m < 43200 ? `${Math.round(m / 1440)}d ago` : new Date(ts).toLocaleDateString('en-GB'); };
  const tagHTML = (t) => `<span class="ftag">${t.emojiId ? `<img class="emoji" src="https://cdn.discordapp.com/emojis/${t.emojiId}.webp?size=32" alt="">` : t.emoji ? `${esc(t.emoji)} ` : ''}${esc(t.name)}</span>`;
  async function openForum(cid) {
    const log = $('#log');
    if (S.forum?.cid !== cid) log.innerHTML = '<div class="empty">Loading</div>';
    let r; try { r = await api('GET', `/channels/${cid}/posts`); } catch (e) { if (S.cid === cid) log.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    if (S.cid !== cid) return;
    S.forum = { cid, ...r, q: S.forum?.cid === cid ? S.forum.q : '', tag: S.forum?.cid === cid ? S.forum.tag : null, making: false, pick: new Set() };
    paintForum(true); $('#scroller').scrollTop = 0;
  }
  function paintForum(full) {
    const F = S.forum, c = chan(F.cid), log = $('#log');
    const q = F.q.toLowerCase();
    const list = F.posts.filter((p) => (!q || p.name.toLowerCase().includes(q) || p.preview.toLowerCase().includes(q)) && (!F.tag || p.tags.some((t) => t.id === F.tag)));
    const cards = list.map((p) => `<div class="fpost" data-post="${p.id}"><div class="fbody">`
      + `<div class="ftitle">${p.pinned ? `<span class="fpin">${I.pin}</span>` : ''}${esc(p.name)}${p.locked ? ' 🔒' : ''}</div>`
      + (p.tags.length ? `<div class="ftags">${p.tags.map(tagHTML).join('')}</div>` : '')
      + `<div class="fprev"><b>${esc(p.owner ? nickOf(p.owner) || p.owner.name : 'Unknown')}</b>: ${p.preview ? MD.renderInline(p.preview.replace(/\n+/g, ' ')) : '(no text)'}</div>`
      + `<div class="fmeta"><span>${I.chat}${p.count}</span><span>${ago(p.lastTs)}</span>${p.archived ? '<span>Closed</span>' : ''}</div></div>`
      + (p.image ? `<img class="fimg" src="${esc(p.image)}" alt="" loading="lazy">` : '') + '</div>').join('');
    const body = cards || `<div class="empty">${F.posts.length ? 'No posts match' : 'No posts yet'}</div>`;
    if (!full && log.querySelector('.fposts')) { log.querySelector('.fposts').innerHTML = body; return; }
    const tags = F.tags.length ? `<div class="ftagbar">${F.tags.map((t) => `<button class="ftagb${F.tag === t.id ? ' on' : ''}" data-ftag="${t.id}">${tagHTML(t)}</button>`).join('')}</div>` : '';
    const maker = F.making ? `<div class="fmake"><input id="fmtitle" maxlength="100" placeholder="Post title" value="${esc(F.q)}"><textarea id="fmbody" rows="4" maxlength="2000" placeholder="Write the post"></textarea>`
      + (F.tags.length ? `<div class="ftagbar">${F.tags.map((t) => `<button class="ftagb${F.pick.has(t.id) ? ' on' : ''}" data-fpick="${t.id}">${tagHTML(t)}</button>`).join('')}</div>` : '')
      + `<div class="fmrow"><button class="btn sec" id="fmcancel">Cancel</button><button class="btn" id="fmpost">Post</button></div></div>` : '';
    log.innerHTML = `<div class="fhead"><input id="fq" placeholder="Search or create a post" value="${esc(F.q)}">${c?.send ? '<button class="btn" id="fnew">New Post</button>' : ''}</div>${tags}${maker}<div class="fposts">${body}</div>`;
    if (F.making) $('#fmtitle').focus();
  }
  function openPost(p) {
    const g = S.guilds.get(S.gid);
    if (g && !g.channels.some((x) => x.id === p.id)) g.channels.push({ ...p, thread: true, post: true });
    openChannel(p.id);
  }
  $('#log').addEventListener('input', (e) => { if (e.target.id === 'fq' && S.forum) { S.forum.q = e.target.value; paintForum(); } });
  $('#log').addEventListener('keydown', (e) => {
    if (e.target.id === 'fq' && e.key === 'Enter' && chan(S.forum?.cid)?.send) { S.forum.making = true; paintForum(true); }
    if (e.target.id === 'fmtitle' && e.key === 'Enter') { e.preventDefault(); $('#fmbody').focus(); }
  });
  $('#log').addEventListener('click', async (e) => {
    const F = S.forum; if (!F || !$('#log').classList.contains('forum')) return;
    const post = e.target.closest('[data-post]'); if (post) { const p = F.posts.find((x) => x.id === post.dataset.post); if (p) openPost(p); return; }
    const tg = e.target.closest('[data-ftag]'); if (tg) { F.tag = F.tag === tg.dataset.ftag ? null : tg.dataset.ftag; paintForum(true); return; }
    const pk = e.target.closest('[data-fpick]'); if (pk) { const id = pk.dataset.fpick; F.pick.has(id) ? F.pick.delete(id) : F.pick.add(id); pk.classList.toggle('on'); return; }
    if (e.target.closest('#fnew')) { F.making = true; paintForum(true); return; }
    if (e.target.closest('#fmcancel')) { F.making = false; paintForum(true); return; }
    const go = e.target.closest('#fmpost'); if (!go) return;
    const name = $('#fmtitle').value.trim(); if (!name) { $('#fmtitle').focus(); return; }
    go.disabled = true;
    try { const r = await api('POST', `/channels/${F.cid}/posts`, { name, content: $('#fmbody').value.trim(), tags: [...F.pick] }); F.making = false; F.q = ''; openPost(r.post); }
    catch (x) { go.disabled = false; toast(x.message, true); }
  });
  async function openChannel(cid) {
    if (S.cid && S.cid !== cid) { saveDraft(S.cid); ta.value = ''; autosize(); }
    S.readAt = { [cid]: READ[cid] }; // where the NEW line goes
    if (!HIST.moving && S.cid && S.cid !== cid) { HIST.back.push({ gid: guildOf(S.cid)?.id ?? DMG, cid: S.cid }); if (HIST.back.length > 50) HIST.back.shift(); HIST.fwd.length = 0; }
    S.cid = cid; store.set('chan.' + S.gid, cid);
    S.unread.delete(cid);
    cancelReply(); cancelEdit(); closeAc();
    renderChannels(); renderRail(); renderHead(); renderTyping(); renderTitle();
    const c = chan(cid);
    renderCall();
    renderMembers(); loadViewers(cid); // member list shows only people who can see this channel
    ta.disabled = c && !c.send;
    ta.placeholder = c && !c.send ? 'V1 cannot send messages here' : c?.type === CH.DM ? `Message @${c.name}` : `Message ${isVoice(c) ? '' : '#'}${c?.name ?? ''}`;
    S.lru = [cid, ...S.lru.filter((x) => x !== cid)];
    for (const old of S.lru.splice(80)) { S.msgs.delete(old); S.more.delete(old); S.ahead.delete(old); } // keep memory flat
    const isForum = c?.type === 15 || c?.type === 16;
    $('#log').classList.toggle('forum', isForum); $('#composer').hidden = isForum;
    if (isForum) { openForum(cid); return; }
    if (!S.msgs.has(cid)) {
      $('#log').innerHTML = '<div class="empty">Loading</div>';
      try { await fetchChan(cid); }
      catch (e) { if (S.cid === cid) $('#log').innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    }
    if (S.cid !== cid) return;
    renderLog(); renderAhead(); if (!S.ahead.has(cid)) { scrollBottom(); markRead(cid); }
    if (S.cid === cid && ta.value === '' ) loadDraft(cid);
    if (!ta.disabled) ta.focus();
  }
  async function resync() {
    try { S.ahead.delete(S.cid); renderAhead(); const r = await api('GET', `/channels/${S.cid}/messages?limit=50`); const keepDeleted = (S.msgs.get(S.cid) || []).filter((m) => m.deleted); S.msgs.set(S.cid, mergeDeleted(r.messages, keepDeleted)); S.more.set(S.cid, r.messages.length === 50); renderLog(); scrollBottom(); } catch { /* next time */ }
  }
  const mergeDeleted = (list, del) => [...list, ...del].sort((a, b) => (BigInt(a.id) > BigInt(b.id) ? 1 : -1));
  function renderHead() {
    const c = chan(S.cid);
    const muted = MUTED.has(S.cid);
    const toggle = (S.gid === DMG ? '' : `<button class="ico" id="tthreads" title="Threads">${I.threads}</button>`)
      + `<button class="ico${muted ? ' off' : ''}" id="tmute" title="${muted ? 'Unmute channel' : 'Mute channel'}">${muted ? I.bellOff : I.bell}</button><button class="ico" id="tpins" title="Pinned messages">${I.pin}</button>`
      + (S.gid === DMG ? '' : `<button class="ico${S.showMembers ? ' on' : ''}" id="tmem" title="Member list">${I.people}</button>`)
      + (NATIVE && on('ClaudeAssistant') ? `<button class="ico${CL.open ? ' on' : ''}" id="tclaude" title="Claude">${I.spark}</button>` : '')
      + (S.gid === DMG ? '' : `<div class="hsearch"><input id="hsq" placeholder="Search ${esc(S.guilds.get(S.gid)?.name ?? '')}" title="Type to filter members. Enter searches every message (from: in: has:link before: after:)">${I.search}</div>`);
    if (!c) { $('#chead').innerHTML = `<span class="sp"></span>${toggle}`; return; }
    const icon = c.type === CH.DM ? avatarHTML(c.dm.user, statusOf(c.dm.user.id), 24) : isVoice(c) ? I.speaker : c.type === 15 || c.type === 16 ? I.forum : c.thread ? I.threads : I.hash;
    $('#chead').innerHTML = `${icon}<span class="nm">${esc(c.name)}</span>${c.topic ? `<span class="topic" title="${esc(c.topic)}">${MD.renderInline(c.topic)}</span>` : '<span class="sp"></span>'}${toggle}`;
    twe($('#chead'));
  }
  const MUTED = new Set(store.get('muted', []));
  $('#chead').addEventListener('input', (e) => { if (e.target.id === 'hsq') filterMembers(e.target.value); });
  $('#chead').addEventListener('keydown', (e) => {
    if (e.target.id !== 'hsq' || e.key !== 'Enter') return;
    const q = e.target.value.trim(); if (!q) return;
    const b = e.target.getBoundingClientRect();
    api('GET', `/search?guild=${S.gid}&q=${encodeURIComponent(q)}`).then((r) => {
      const html = r.results.length ? r.results.map((m) => `<div class="pinm" data-sc="${m.channelId}" data-sm="${m.id}">${m.author.avatar ? `<img src="${esc(m.author.avatar)}" alt="">` : ''}<div><b>${esc(m.author.name)}</b> <span class="when">#${esc(m.channel || '')} · ${fmtWhen(m.ts)}</span><div class="markup">${esc(m.content).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (x) => `<mark>${x}</mark>`)}</div></div></div>`).join('')
        : '<div class="empty">No results</div>';
      const ix = r.index ? `${r.index.messages.toLocaleString()} messages indexed${r.index.finished < r.index.channels ? ` (still backfilling, ${r.index.finished}/${r.index.channels} channels done)` : ''}` : "From V1's saved history";
      const p = showPop(b.right - 420, b.bottom + 8, `<div class="pins"><h4>${r.results.length} result${r.results.length === 1 ? '' : 's'}</h4><div class="note" style="margin:-6px 4px 8px;font-size:12px">${ix}. Filters: from:name in:channel has:link before:2026-01-01 after:2026-01-01</div>${html}</div>`);
      p.onclick = (ev) => { const x = ev.target.closest('[data-sm]'); if (x) { hidePop(); jumpTo(x.dataset.sm, x.dataset.sc); } };
    }, (x) => toast(x.message, true));
  });
  $('#chead').addEventListener('click', (e) => {
    if (e.target.closest('#tclaude')) { toggleClaude(); return; }
    if (e.target.closest('#tmute')) { MUTED.has(S.cid) ? MUTED.delete(S.cid) : MUTED.add(S.cid); store.set('muted', [...MUTED]); renderHead(); return; }
    const tt = e.target.closest('#tthreads');
    if (tt) { const b = tt.getBoundingClientRect(); const g = S.guilds.get(S.gid); const list = g.channels.filter((x) => x.thread && x.parent === S.cid);
      const p = showPop(b.right - 360, b.bottom + 8, `<div class="pins"><h4>Threads</h4>${list.map((t) => `<div class="pinm" data-thread="${t.id}"><div><b>${esc(t.name)}</b></div></div>`).join('') || '<div class="empty">No active threads</div>'}</div>`);
      p.onclick = (ev) => { const x = ev.target.closest('[data-thread]'); if (x) { hidePop(); openChannel(x.dataset.thread); } }; return; }
    const tp = e.target.closest('#tpins');
    if (tp) { const b = tp.getBoundingClientRect(); api('GET', `/channels/${S.cid}/pins`).then((r) => {
      const html = r.messages.length ? r.messages.map((m) => { setCtx(m); return `<div class="pinm" data-jump="${m.id}"><img src="${esc(m.author.avatar)}" alt=""><div><b>${esc(m.author.name)}</b> <span class="when">${fmtWhen(m.ts)}</span><div class="markup">${md(m.content || 'attachment', m)}</div></div></div>`; }).join('') : '<div class="empty">No pinned messages</div>';
      const p = showPop(b.right - 420, b.bottom + 8, `<div class="pins"><h4>Pinned Messages</h4>${html}</div>`);
      p.onclick = (ev) => { const j = ev.target.closest('[data-jump]'); if (j) { hidePop(); jumpTo(j.dataset.jump); } };
    }, (x) => toast(x.message, true)); return; }
    if (e.target.closest('#tmem')) { S.showMembers = !S.showMembers; store.set('showMembers', S.showMembers); $('#app').classList.toggle('nomembers', !S.showMembers); renderHead(); }
    const t = e.target.closest('.topic'); if (t) showPop(t.getBoundingClientRect().left, 56, `<div class="menu" style="max-width:480px;padding:14px;font-size:14px;white-space:pre-wrap;user-select:text">${MD.render(t.title)}</div>`);
  });

  // Discord's own wording; the join line is picked from the message's timestamp like Discord does
  const JOINS = ['{u} joined the party.', '{u} is here.', 'Welcome, {u}. We hope you brought pizza.', 'A wild {u} appeared.', '{u} just landed.', '{u} just slid into the server.',
    '{u} just showed up!', 'Welcome {u}. Say hi!', '{u} hopped into the server.', 'Everyone welcome {u}!', "Glad you're here, {u}.", 'Good to see you, {u}.', 'Yay you made it, {u}!'];
  const SYS_JOIN = '<svg viewBox="0 0 18 18"><path fill="currentColor" d="m0 8h14.2l-3.6-3.6 1.4-1.4 6 6-6 6-1.4-1.4 3.6-3.6h-14.2"/></svg>';
  const SYS_BOOST = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M11.47 6.55a.75.75 0 0 1 1.06 0l2.2 2.14c.14.14.23.34.23.55v5.52c0 .21-.09.4-.23.55l-2.2 2.14a.75.75 0 0 1-1.06 0l-2.2-2.14a.77.77 0 0 1-.23-.55V9.24c0-.21.09-.41.23-.55l2.2-2.14Z"/><path fill="currentColor" fill-rule="evenodd" d="M10.95 1.43a1.5 1.5 0 0 1 2.1 0l5.49 5.33c.3.29.46.68.46 1.1v8.44c-.04.35-.2.69-.46.94l-5.49 5.33-.11.1a1.5 1.5 0 0 1-2-.1l-5.48-5.33c-.3-.29-.46-.68-.46-1.1V7.86c0-.42.17-.81.46-1.1l5.49-5.33ZM7.29 7.76c-.2.2-.3.46-.3.73v7.02c0 .27.1.54.3.73l4 3.9a1 1 0 0 0 1.41 0l4-3.9c.2-.2.31-.46.31-.73V8.49c0-.27-.1-.54-.3-.73l-4-3.9a1 1 0 0 0-1.41 0l-4 3.9Z"/></svg>';
  const boost = (n) => [SYS_BOOST, '#ff73fa', (u) => n ? `${u} just boosted the server! The server has achieved <b>Level ${n}!</b>` : `${u} just boosted the server!`];
  const SYS = { 6: [I.pin, '', (u) => `${u} pinned <span class="syslink" data-sys="pins">a message</span> to this channel. See all <span class="syslink" data-sys="pins">pinned messages</span>.`],
    7: [SYS_JOIN, 'var(--good)', (u, m) => JOINS[Number(BigInt(m.id) >> 22n) % JOINS.length].replace('{u}', u)],
    8: boost(0), 9: boost(1), 10: boost(2), 11: boost(3),
    12: [SYS_JOIN, 'var(--good)', (u) => `${u} has added a channel to this channel. Its most important updates will show up here.`],
    18: [I.threads, '', (u, m) => `${u} started a thread: <b>${esc(m.content || 'thread')}</b>. See all <span class="syslink" data-sys="threads">threads</span>.`],
    37: [I.shield ?? SYS_JOIN, 'var(--good)', (u) => `${u} resumed server activity.`], 38: [I.shield ?? SYS_JOIN, 'var(--dnd)', (u) => `${u} reported a raid.`], 39: [I.shield ?? SYS_JOIN, 'var(--good)', (u) => `${u} reported a false alarm.`],
    36: [I.shield ?? SYS_JOIN, 'var(--idle)', (u, m) => `${u} paused server activity until ${fmtWhen(Date.parse(m.content))}.`] };
  const grouped = (p, m) => p && p.author.id === m.author.id && !m.reply && !(p.system && SYS[p.type]) && m.ts - p.ts < 7 * 60e3 && dayKey(p.ts) === dayKey(m.ts);
  function msgHTML(m, prev) {
    setCtx(m);
    const day = !prev || dayKey(prev.ts) !== dayKey(m.ts) ? `<div class="daysep"><span>${new Date(m.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>` : '';
    const sys = m.system && SYS[m.type];
    if (sys) {
      const [ic, col, txt] = sys, who = `<b class="name${m.author.grad ? ' grad' : ''}" data-uid="${m.author.id}" style="${nameStyle(m.author)}">${esc(nickOf(m.author) || m.author.name)}</b>`;
      return day + `<div class="msg sys" data-id="${m.id}"><span class="sysic"${col ? ` style="color:${col}"` : ''}>${ic}</span><span class="systxt">${txt(who, m)}</span><span class="when">${fmtWhen(m.ts)}</span></div>`;
    }
    const cont = !day && grouped(prev, m);
    const own = m.author.id === S.me.id;
    const ment = m.mentionsMe || (/@(everyone|here)/.test(m.content) && !m.author.bot);
    let r = '';
    if (m.reply) {
      const ref = findMsg(m.channelId, m.reply.id);
      const a = m.reply.author || ref?.author;
      const txt = m.reply.content ?? ref?.content ?? '';
      r = a ? `<div class="reply" data-jump="${m.reply.id}"><img src="${esc(px(a.avatar, 16))}" alt=""><b style="${a.color ? `color:${a.color}` : ''}" data-uid="${a.id}">${esc(a.name)}</b><span class="rt">${txt ? MD.renderInline(txt) : '<i>Click to see attachment</i>'}</span>${on('ReplyTimestamp') && ref ? `<span class="rts">${fmtWhen(ref.ts)}</span>` : ''}</div>`
        : '<div class="reply"><span class="rt"><i>Original message was deleted</i></span></div>';
    }
    const head = cont ? `<span class="side">${fmtClock(m.ts)}</span>` : `<img class="pic" src="${esc(px(m.author.avatar, 40))}"${anim(m.author.avatar, m.author.avatarAnim, 40)} alt="" data-uid="${m.author.id}" loading="lazy" decoding="async">${m.author.deco ? `<img class="pdeco" src="${esc(px(m.author.deco, 48))}"${anim(m.author.deco, m.author.decoAnim, 48)} alt="" decoding="async">` : ''}`;
    const name = cont ? '' : `<div class="head"><span class="name${m.author.grad ? ' grad' : ''}" data-uid="${m.author.id}" style="${nameStyle(m.author)}">${esc(nickOf(m.author) || m.author.name)}</span>${roleIconHTML(m.author)}${on('ForceOwnerCrown') && m.author.id === guildOwner(m.guildId) ? I.crown : ''}${clanHTML(m.author)}${m.author.bot ? '<span class="tag">APP</span>' : ''}${on('PlatformIndicators') ? platHTML(m.author) : ''}<span class="when">${fmtWhen(m.ts)}</span></div>`;
    const hist = (m.history || []).map((h) => `<div class="markup old">${md(h, m)}</div>`).join('');
    const gifOnly = m.content && m.embeds.length === 1 && ['gifv', 'image'].includes(m.embeds[0].type) && m.content.trim() === m.embeds[0].url;
    const body = m.content && !gifOnly ? `<div class="markup${onlyEmoji(m.content) ? ' jumbo' : ''}">${md(m.content, m)}${m.edited ? `<span class="edited" title="${esc(fmtWhen(m.edited))}">(edited)</span>` : ''}</div>` : '';
    const atts = m.attachments.length ? `<div class="atts">${m.attachments.map((a) => attHTML(a, m)).join('')}</div>` : '';
    const stk = m.stickers.map((s) => `<img class="stk" src="${esc(s.url)}" alt="${esc(s.name)}" title="${esc(s.name)}">`).join('');
    const links = !on('MessageLinkEmbeds') ? '' : [...(m.content || '').matchAll(/https:\/\/(?:\w+\.)?discord(?:app)?\.com\/channels\/(\d+|@me)\/(\d+)\/(\d+)/g)].slice(0, 2).map((x) => `<div class="mlink" data-mc="${x[2]}" data-mm="${x[3]}"></div>`).join('');
    const embeds = PREF.embeds ? m.embeds.map((e) => embedHTML(e, m)).join('') : '';
    const poll = m.poll ? pollHTML(m) : '';
    const rx = m.reactions.length ? `<div class="rxs">${m.reactions.map((x) => `<button class="rx${x.me ? ' me' : ''}" data-rx="${esc(x.key)}">${emojiImg(x)}<span>${x.count}</span></button>`).join('')}<button class="rx add" data-act="react" title="Add reaction">${I.smile}</button></div>` : '';
    const tr = m.translated ? `<div class="trans"><b>Translated</b> ${esc(m.translated)}</div>` : '';
    const quick = topReactions().map((k) => `<button class="qr" data-qr="${esc(k.key)}" title="React ${esc(k.name)}">${k.img ? `<img src="${esc(k.img)}" alt="">` : `<span class="ue">${k.uni}</span>`}</button>`).join('');
    const tools = m.deleted ? `<div class="tools"><button data-act="hidedel" title="Remove from history">${I.trash}</button></div>` : `<div class="tools">${quick}${quick ? '<i class="tsep"></i>' : ''}${m.content ? `<button data-act="translate" title="Translate">${I.translate}</button>` : ''}<button data-act="react" title="Add reaction">${I.smile}</button>${own && !m.deleted && m.content ? `<button data-act="edit" title="Edit">${I.edit}</button>` : `<button data-act="reply" title="Reply">${I.reply}</button>`}${m.deleted ? '' : `<button data-act="forward" title="Forward">${I.fwdi}</button>`}<button data-act="more" title="More">${I.dots}</button>${canDelete(m) ? `<button class="del shiftonly" data-act="delete" title="Delete">${I.trash}</button>` : ''}</div>`;
    const fwd = (m.forwarded || []).map((f) => `<div class="fwdbox"><div class="fwdh">${I.reply} Forwarded</div>${f.content ? `<div class="markup">${md(f.content, m)}</div>` : ''}${f.attachments.length ? `<div class="atts">${f.attachments.map(attHTML).join('')}</div>` : ''}${f.embeds.map((e) => embedHTML(e, m)).join('')}</div>`).join('');
    const comps = compHTML(m.components || []);
    const thr = m.thread ? `<div class="thrchip" data-thread="${m.thread.id}">${I.chat}<b>${esc(m.thread.name)}</b><span>${m.thread.count} message${m.thread.count === 1 ? '' : 's'}</span></div>` : '';
    const fail = m.failed ? `<div class="mfail">Message failed to send: ${esc(m.failed)} <button class="link" data-act="retry">Retry</button> · <button class="link" data-act="discard">Delete</button></div>` : '';
    return day + `<div class="msg${cont ? ' cont' : ''}${m.reply ? ' hasreply' : ''}${ment ? ' mentioned' : ''}${m.deleted ? ' deleted' : ''}${m.pending ? ' pending' : ''}${m.failed ? ' failed' : ''}" data-id="${m.pending ? 'p' + m.nonce : m.id}">${r}${head}${name}${hist}${body}${tr}${atts}${stk}${fwd}${poll}${links}${embeds}${comps}${thr}${rx}${fail}${m.pending ? '' : tools}</div>`;
  }
  function compHTML(rows) { // buttons / selects from other bots (a bot can't press them) and V1's link buttons; Components V2 text
    const one = (c) => {
      if (c.type === 1) return `<div class="crow">${(c.components || []).map(one).join('')}</div>`;
      if (c.type === 2) { const st = ['', 'pri', 'sec', 'ok', 'bad', 'lnk', 'pri'][c.style] || 'sec'; const em = c.emoji ? (c.emoji.id ? emojiImg(c.emoji) : `<span class="ue">${esc(c.emoji.name)}</span>`) : '';
        return c.url ? `<a class="cbtn lnk" href="${esc(c.url)}">${em}${esc(c.label || '')} ${P('M15 2a1 1 0 0 0 0 2h3.59l-7.3 7.3a1 1 0 0 0 1.42 1.4L20 5.42V9a1 1 0 1 0 2 0V3a1 1 0 0 0-1-1h-6ZM5 3a3 3 0 0 0-3 3v13a3 3 0 0 0 3 3h13a3 3 0 0 0 3-3v-6a1 1 0 1 0-2 0v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6a1 1 0 1 0 0-2H5Z', ' width="14" height="14"')}</a>`
          : `<span class="cbtn ${st}${c.disabled ? ' dis' : ''}" title="Only people can press bot buttons">${em}${esc(c.label || '')}</span>`; }
      if ([3, 5, 6, 7, 8].includes(c.type)) return `<div class="csel">${esc(c.placeholder || 'Make a selection')}</div>`;
      if (c.type === 10) return `<div class="markup">${md(c.content || '', {})}</div>`;
      if (c.type === 17) return `<div class="cbox" style="${c.accent_color != null ? `--ec:#${c.accent_color.toString(16).padStart(6, '0')}` : ''}">${(c.components || []).map(one).join('')}</div>`;
      if (c.type === 9) return `<div class="csec">${(c.components || []).map(one).join('')}${c.accessory ? one(c.accessory) : ''}</div>`;
      if (c.type === 11) return `<img class="cthumb" src="${esc(c.media?.proxy_url || c.media?.url || '')}" alt="">`;
      // media gallery: Discord's proxy copy (bots' own CDNs often refuse other clients), shown like an attachment
      if (c.type === 12) return `<div class="atts">${(c.items || []).map((x) => { const md2 = x.media || {}, name = (md2.url || '').split('?')[0].split('/').pop() || 'image';
        return attHTML({ url: md2.url, proxy: md2.proxy_url, type: md2.content_type || (/\.gif$/i.test(name) ? 'image/gif' : /\.(mp4|webm|mov)$/i.test(name) ? 'video/mp4' : 'image/png'), w: md2.width, h: md2.height, name }); }).join('')}</div>`;
      if (c.type === 14) return '<hr class="csep">';
      return '';
    };
    return rows.length ? `<div class="comps">${rows.map(one).join('')}</div>` : '';
  }
  function pollHTML(m) {
    const p = m.poll, total = p.answers.reduce((a, x) => a + x.count, 0) || 0;
    const left = p.expires ? p.expires - Date.now() : 0;
    const when = p.final || left <= 0 ? 'Poll closed' : left > 864e5 ? `${Math.round(left / 864e5)}d left` : left > 36e5 ? `${Math.round(left / 36e5)}h left` : `${Math.max(1, Math.round(left / 6e4))}m left`;
    const max = Math.max(...p.answers.map((a) => a.count));
    return `<div class="poll"><div class="pq">${esc(p.question)}</div><div class="psub">${p.multi ? 'Select one or more answers' : 'Select one answer'}</div>`
      + p.answers.map((a) => { const pct = total ? Math.round(a.count / total * 100) : 0; return `<div class="pa${p.final && a.count === max && max ? ' win' : ''}"><i style="width:${pct}%"></i><span>${a.emoji ? emojiImg(a.emoji) + ' ' : ''}${esc(a.text)}</span><b>${a.count} · ${pct}%</b></div>`; }).join('')
      + `<div class="pfoot">${total} vote${total === 1 ? '' : 's'} · ${when}${!p.final && left > 0 && m.author.id === S.me.id ? ' · <button class="link" data-act="endpoll">End poll</button>' : ''}</div></div>`;
  }
  const nameStyle = (u) => u.grad ? `background-image:linear-gradient(90deg,${u.grad.join(',')})` : u.color ? `color:${u.color}` : '';
  const roleIconHTML = (u) => !u.roleIcon ? '' : typeof u.roleIcon === 'string' ? `<img class="ricon" src="${esc(u.roleIcon)}" alt="" title="${esc(u.roleIconName || '')}">` : `<span class="ricon ue" title="${esc(u.roleIconName || '')}">${esc(u.roleIcon.emoji)}</span>`;
  const clanHTML = (u) => u.clan ? `<span class="clan">${u.clan.badge ? `<img src="${esc(u.clan.badge)}" alt="">` : ''}${esc(u.clan.tag)}</span>` : '';
  // three most-used reactions for the hover toolbar, like Discord
  let topCache = null, topAt = 0;
  const topReactions = () => {
    if (topCache && Date.now() - topAt < 5000) return topCache;
    const keys = Object.keys(FREQ).sort((a, b) => score(b) - score(a)).slice(0, 3);
    const fall = ['👍', '✅', '❤️'];
    topCache = (keys.length ? keys : fall).map((k) => k.includes(':') ? { key: k, name: k.split(':')[0], img: `https://cdn.discordapp.com/emojis/${k.split(':')[1]}.webp?size=48` } : { key: k, name: k, uni: k });
    while (topCache.length < 3) { const f = fall.find((x) => !topCache.some((t) => t.key === x)); topCache.push({ key: f, name: f, uni: f }); }
    topAt = Date.now(); return topCache;
  };
  // V1 can delete its own messages anywhere, others' only in servers where it has Manage Messages (never in DMs)
  const canDelete = (m) => !m.deleted && (m.author.id === S.me.id || m.webhook && m.author.id === 'webhook' || (!!m.guildId && !!chan(m.channelId)?.manage));
  const guildOwner = (gid) => S.guilds.get(gid)?.owner;
  const tm = (x) => { x = Math.max(0, Math.floor(x || 0)); return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`; };
  function audioHTML(a, voice) { // Discord's audio card, or the voice-message pill with its waveform
    if (voice && a.waveform) {
      const bytes = Uint8Array.from(atob(a.waveform), (c) => c.charCodeAt(0));
      const n = 40, bars = Array.from({ length: n }, (_, i) => bytes[Math.floor(i * bytes.length / n)] || 0);
      return `<div class="vmsg" data-audio="${esc(a.url)}"><button class="aplay">${I.play}</button><div class="wave">${bars.map((v) => `<i style="height:${Math.max(3, v / 255 * 22)}px"></i>`).join('')}</div><span class="atime">${tm(a.duration)}</span><audio preload="none" src="${esc(a.url)}"></audio></div>`;
    }
    return `<div class="acard" data-audio="${esc(a.url)}"><div class="ahead">${I.file}<div class="aname"><a href="${esc(a.url)}">${esc(a.name)}</a><span>${kb(a.size)}</span></div><a class="ico" href="${esc(a.url)}" title="Download">${I.download}</a></div>
      <div class="actl"><button class="aplay">${I.play}</button><span class="atime">0:00 / ${a.duration ? tm(a.duration) : '–'}</span><input type="range" class="aseek" min="0" max="1000" value="0"><span class="avolw"><button class="avol" title="Mute">${I.speakerS}</button><input type="range" class="avr" min="0" max="100" value="${Math.round(store.get('audioVol', 1) * 100)}" title="Volume"></span></div><audio preload="metadata" src="${esc(a.url)}"></audio></div>`;
  }
  function attHTML(a, m) {
    const t = a.type || '';
    if (t.startsWith('audio/') || (t.startsWith('video/') && !a.w && !a.h)) return audioHTML(a, m?.voiceMsg);
    const fit = (w, h) => { if (!w || !h) return ''; const s = Math.min(1, 400 / w, 320 / h); return ` width="${Math.round(w * s)}" height="${Math.round(h * s)}"`; };
    if (t === 'image/gif' || /\.gif$/i.test(a.name || '')) return `<span class="gifm" data-gurl="${esc(a.url)}" data-gsrc="${esc(a.proxy || a.url)}" data-w="${a.w || 0}" data-h="${a.h || 0}"><button class="gstar${(FAVGIFS || []).some((x) => x.url === a.url) ? ' on' : ''}" title="Favourite">${I.star}</button><img src="${esc(a.proxy || a.url)}" data-full="${esc(a.url)}" alt="${esc(a.name)}" loading="lazy" decoding="async"${fit(a.w, a.h)}></span>`;
    if (t.startsWith('image/')) return `<img src="${esc(a.proxy || a.url)}" data-full="${esc(a.url)}" alt="${esc(a.name)}" loading="lazy" decoding="async"${fit(a.w, a.h)}>`;
    if (t.startsWith('video/')) { // no decoder until played: each loaded <video> holds a whole GStreamer pipeline in WebKit
      const poster = a.proxy && /media\.discordapp\.net/.test(a.proxy) ? a.proxy + (a.proxy.includes('?') ? '&' : '?') + 'format=webp' : '';
      return `<video src="${esc(a.url)}" controls preload="none"${poster ? ` poster="${esc(poster)}"` : ''}${fit(a.w, a.h)}></video>`; }
    if (t.startsWith('audio/')) return `<div class="file">${I.file}<div><a href="${esc(a.url)}">${esc(a.name)}</a> <span class="sz">${kb(a.size)}</span><audio src="${esc(a.url)}" controls preload="none"></audio></div></div>`;
    return `<div class="file">${I.file}<div><a href="${esc(a.url)}">${esc(a.name)}</a><div class="sz">${kb(a.size)}</div></div></div>`;
  }
  const ytId = (u) => /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/.exec(u || '')?.[1];
  function embedHTML(e, m) {
    if (e.type === 'gifv' && !e.video && e.thumbnail) return `<div class="embed media"><img src="${esc(e.thumbnail.proxy_url || e.thumbnail.url)}" alt="" loading="lazy"></div>`;
    if (e.type === 'gifv' && e.video) return `<div class="embed media gifm" data-gurl="${esc(e.url)}" data-gsrc="${esc(e.video.proxy_url || e.video.url)}" data-w="${e.video.width || 0}" data-h="${e.video.height || 0}"><button class="gstar${(FAVGIFS || []).some((x) => x.url === e.url) ? ' on' : ''}" title="Favourite">${I.star}</button><img class="gifimg" src="${esc(gifImg(e.video.proxy_url || e.video.url))}" data-full="${esc(gifImg(e.video.proxy_url || e.video.url, 640))}" onerror="this.onerror=null;this.src='${esc(e.thumbnail?.proxy_url || e.thumbnail?.url || '')}'" alt="" loading="lazy" decoding="async"${e.video.width ? ` width="${Math.min(400, e.video.width)}" style="aspect-ratio:${e.video.width}/${e.video.height};background-image:url('${esc(e.thumbnail?.proxy_url || e.thumbnail?.url || '')}')"` : ''}></div>`;
    if (e.type === 'image' && (e.thumbnail || e.image)) { const im = e.thumbnail || e.image, gif = /\.gif(\?|$)/i.test(im.url || '') || /\.gif(\?|$)/i.test(e.url || '');
      return `<div class="embed media${gif ? ' gifm' : ''}"${gif ? ` data-gurl="${esc(e.url || im.url)}" data-gsrc="${esc(im.proxy_url || im.url)}" data-w="${im.width || 0}" data-h="${im.height || 0}"` : ''}>${gif ? `<button class="gstar${(FAVGIFS || []).some((x) => x.url === (e.url || im.url)) ? ' on' : ''}" title="Favourite">${I.star}</button>` : ''}<img src="${esc(im.proxy_url || im.url)}" alt="" loading="lazy" decoding="async"></div>`; }
    const c = e.color != null ? '#' + e.color.toString(16).padStart(6, '0') : null;
    const yt = on('YoutubeInline') && e.type === 'video' && ytId(e.url);
    let h = '';
    if (e.provider?.name && yt) h += `<div class="efoot">${esc(e.provider.name)}</div>`;
    if (e.author?.name) h += `<div class="eauthor">${e.author.icon_url ? `<img src="${esc(e.author.proxy_icon_url || e.author.icon_url)}" alt="">` : ''}${e.author.url ? `<a href="${esc(e.author.url)}">${esc(e.author.name)}</a>` : esc(e.author.name)}</div>`;
    if (e.title) h += `<div class="etitle">${e.url ? `<a href="${esc(e.url)}">${MD.renderInline(e.title)}</a>` : md(e.title, m)}</div>`;
    if (e.description) h += `<div class="edesc markup${e.type === 'video' || e.type === 'article' || e.type === 'link' ? ' clamp' : ''}">${md(e.description, m)}</div>`;
    if (e.fields?.length) h += `<div class="efields">${e.fields.map((f) => `<div class="ef${f.inline ? ' inl' : ''}"><b>${md(f.name, m)}</b><div class="markup">${md(f.value, m)}</div></div>`).join('')}</div>`;
    if (e.thumbnail?.url && e.type !== 'video' && e.type !== 'article') h += `<img class="ethumb" src="${esc(e.thumbnail.proxy_url || e.thumbnail.url)}" alt="" loading="lazy">`;
    if (e.image?.url) h += `<img class="eimg" src="${esc(e.image.proxy_url || e.image.url)}" alt="" loading="lazy">`;
    else if (yt) h += `<div class="yt" data-yt="${yt}"><img class="eimg" src="https://i.ytimg.com/vi/${yt}/hqdefault.jpg" alt="" loading="lazy"><span class="play">${P('M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z')}</span></div>`;
    else if ((e.type === 'video' || e.type === 'article') && e.thumbnail?.url) h += `<img class="eimg" src="${esc(e.thumbnail.proxy_url || e.thumbnail.url)}" alt="" loading="lazy">`;
    if (e.footer?.text || e.timestamp) h += `<div class="efoot">${e.footer?.icon_url ? `<img src="${esc(e.footer.proxy_icon_url || e.footer.icon_url)}" alt="">` : ''}${esc(e.footer?.text || '')}${e.footer?.text && e.timestamp ? ' • ' : ''}${e.timestamp ? fmtWhen(Date.parse(e.timestamp)) : ''}</div>`;
    return h ? `<div class="embed" style="${c ? `--ec:${c}` : ''}">${h}</div>` : '';
  }

  function rescueAudio() { // a playing clip survives leaving the channel, like Discord's own player
    const au = [...document.querySelectorAll('#log audio')].find((x) => !x.paused);
    if (!au) return;
    const box = au.closest('[data-audio]');
    const name = box?.querySelector('.aname a')?.textContent || 'Voice message';
    $('#bgaudio').replaceChildren(au);
    const bar = $('#nowplay');
    bar.innerHTML = `<button class="aplay" id="npp">${I.pause}</button><span class="npn">${esc(name)}</span><span class="atime" id="npt"></span><button class="ico" id="npx" title="Stop">${I.x}</button>`;
    bar.hidden = false; $('#side').classList.add('np');
    const paint = () => { $('#npp').innerHTML = au.paused ? I.play : I.pause; $('#npt').textContent = `${tm(au.currentTime)} / ${tm(au.duration)}`; };
    for (const ev of ['play', 'pause', 'timeupdate']) au.addEventListener(ev, paint);
    au.addEventListener('ended', () => { bar.hidden = true; $('#side').classList.remove('np'); au.remove(); });
    $('#npp').onclick = () => (au.paused ? au.play() : au.pause());
    $('#npx').onclick = () => { au.pause(); au.remove(); bar.hidden = true; $('#side').classList.remove('np'); };
    paint();
  }
  function renderLog() {
    if (S.forum?.cid === S.cid && $('#log').classList.contains('forum')) { paintForum(); return; }
    rescueAudio();
    const list = S.msgs.get(S.cid) || [];
    const c = chan(S.cid);
    const start = c?.type === CH.DM
      ? `<div class="chanstart"><div class="big"><img src="${esc(px(c.dm.user.avatar, 68))}" alt=""></div><h1>${esc(c.name)}</h1><div>This is the beginning of V1's direct messages with <b>${esc(c.name)}</b>.</div></div>`
      : `<div class="chanstart"><div class="big">${isVoice(c) ? I.speaker : I.hash}</div><h1>Welcome to #${esc(c?.name ?? '')}</h1><div>This is the start of the #${esc(c?.name ?? '')} channel.</div></div>`;
    let html = S.more.get(S.cid) ? '<div class="loadmore">Loading older messages</div>' : start;
    const lastRead = S.readAt?.[S.cid];
    let newDone = false;
    for (let i = 0; i < list.length; i++) {
      if (!newDone && lastRead && BigInt(list[i].id) > BigInt(lastRead) && list[i].author.id !== S.me.id) { html += '<div class="newsep"><span>NEW</span></div>'; newDone = true; }
      html += msgHTML(list[i], list[i - 1]);
    }
    const log = $('#log'); log.innerHTML = html; twe(log); hydrate(log);
  }
  // keep what you're looking at still while a message above/among it changes height (reactions, edits, polls)
  function keepScroll(fn) {
    const sc = $('#scroller');
    if (pinned || nearBottom()) { fn(); scrollBottom(); return; }
    const top = sc.getBoundingClientRect().top;
    let anchor = null, off = 0;
    for (const el of $('#log').children) { const r = el.getBoundingClientRect(); if (r.bottom > top + 1) { anchor = el; off = r.top - top; break; } }
    const id = anchor?.dataset?.id;
    fn();
    const now = id ? $(`#log [data-id="${id}"]`) : anchor;
    if (now && now.isConnected) sc.scrollTop += (now.getBoundingClientRect().top - top) - off;
  }
  function rerender(m) { keepScroll(() => rerenderNow(m)); }
  function rerenderNow(m) {
    if (m.channelId !== S.cid) return;
    const list = S.msgs.get(S.cid); const i = list.indexOf(m);
    const el = $(`.msg[data-id="${m.pending ? 'p' + m.nonce : m.id}"]`); if (!el || i < 0) return;
    const t = document.createElement('div'); t.innerHTML = msgHTML(m, list[i - 1]).replace(/^<div class="daysep">.*?<\/div>/, ''); twe(t); hydrate(t);
    el.replaceWith(t.lastElementChild);
  }
  // message links -> inline previews (MessageLinkEmbeds)
  const linkCache = new Map();
  function hydrate(root) {
    for (const el of root.querySelectorAll('.mlink:not(.done)')) {
      el.classList.add('done');
      const key = el.dataset.mc + '/' + el.dataset.mm;
      const p = linkCache.get(key) || api('GET', `/channels/${el.dataset.mc}/messages/${el.dataset.mm}`).then((r) => r.m).catch(() => null);
      linkCache.set(key, p);
      p.then((lm) => { if (!lm) { el.remove(); return; } setCtx(lm); el.innerHTML = `<div class="embed"><div class="eauthor"><img src="${esc(lm.author.avatar)}" alt="">${esc(lm.author.name)}</div><div class="edesc markup">${md(lm.content || (lm.attachments.length ? 'attachment' : ''), lm)}</div><div class="efoot">#${esc(chan(lm.channelId)?.name ?? '')} • ${fmtWhen(lm.ts)}</div></div>`; twe(el); });
    }
  }

  // GIF videos play only while on screen, and never more than 6 at once: each is a GStreamer pipeline in WebKit
  const PLAYING = new Set();
  const playCapped = (v) => {
    if (!v.src) v.src = v.dataset.src;
    PLAYING.add(v);
    while (PLAYING.size > 6) { const old = PLAYING.values().next().value; PLAYING.delete(old); old.pause(); }
    v.play().catch(() => {});
  };
  const stopCapped = (v) => { PLAYING.delete(v); if (!v.paused) v.pause(); };
  const vio = new IntersectionObserver((ents) => { for (const en of ents) { if (en.isIntersecting) playCapped(en.target); else stopCapped(en.target); } }, { root: $('#scroller'), rootMargin: '0px' });
  new MutationObserver(() => { for (const v of document.querySelectorAll('#log video.lazyv:not([data-w])')) { v.dataset.w = 1; vio.observe(v); } }).observe($('#log'), { childList: true, subtree: true });
  // the message box floats over the chat (like Discord); keep the newest message clear of it
  new ResizeObserver(() => { const h = $('#dock').offsetHeight; const sc = $('#scroller'); const stick = nearBottom(); sc.style.paddingBottom = (h + 2) + 'px'; if (stick) scrollBottom(); }).observe($('#dock'));
  // a <video>/<audio> dropped from the page keeps its GStreamer pipeline (threads + decoded frames) until GC, often never: tear it down
  const killMedia = (el) => { try { el.pause(); el.removeAttribute('src'); for (const x of el.querySelectorAll('source')) x.remove(); el.load(); } catch { /* gone */ } };
  new MutationObserver((recs) => {
    for (const r of recs) for (const n of r.removedNodes) {
      if (n.nodeType !== 1) continue;
      const list = n.matches('video, audio') ? [n] : n.querySelectorAll('video, audio');
      for (const el of list) if (!el.isConnected) killMedia(el); // moved elements (background audio) are connected again by now
    }
  }).observe(document.body, { childList: true, subtree: true });
  // animated images (GIFs) hold every decoded frame in WebKit: unload them when they're well off screen so memory stays flat
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  const animIO = new IntersectionObserver((ents) => {
    for (const en of ents) {
      const im = en.target;
      if (en.isIntersecting) { if (im.dataset.asrc && animOn) { im.src = im.dataset.asrc; delete im.dataset.asrc; } }
      else if (im.src && im.src !== BLANK && !im.src.startsWith('data:')) { const r = im.getBoundingClientRect(); if (r.width && r.height) { im.style.width = r.width + 'px'; im.style.height = r.height + 'px'; } im.dataset.asrc = im.src; im.src = BLANK; }
    }
  }, { rootMargin: '300px 0px' });
  const ANIMSEL = 'img.gifimg, .gifm img, .gtile img, .gcat img, img.emoji[src*=".gif"]';
  const watchAnim = (root) => { for (const im of root.querySelectorAll(ANIMSEL.split(', ').map((x) => x + ':not([data-aw])').join(', '))) { im.dataset.aw = 1; if (!animOn && im.src && !im.src.startsWith('data:')) { im.dataset.asrc = im.src; im.src = BLANK; } animIO.observe(im); } };
  // like Discord: GIFs and animated emojis only play while V1 Client is focused (saves memory and CPU while gaming)
  let animOn = document.hasFocus();
  const stopAnim = () => { for (const im of document.querySelectorAll(ANIMSEL)) if (im.src && !im.src.startsWith('data:')) { const r = im.getBoundingClientRect(); if (r.width && r.height) { im.style.width = r.width + 'px'; im.style.height = r.height + 'px'; } im.dataset.asrc = im.src; im.src = BLANK; } };
  addEventListener('blur', () => { animOn = false; setTimeout(() => { if (!animOn) stopAnim(); }, 1500); });
  addEventListener('focus', () => { animOn = true; for (const im of document.querySelectorAll('img[data-asrc]')) { animIO.unobserve(im); animIO.observe(im); } });
  new MutationObserver(() => watchAnim(document.body)).observe(document.body, { childList: true, subtree: true });
  let pinned = true;
  new ResizeObserver(() => { if (pinned) scrollBottom(); }).observe($('#log'));
  const nearBottom = () => { const s = $('#scroller'); return s.scrollHeight - s.scrollTop - s.clientHeight < 120; };
  const scrollBottom = () => { const s = $('#scroller'); s.scrollTop = s.scrollHeight; pinned = true; };

  // messages always sit in Discord's own order (by snowflake id), whatever order the events arrive in
  const after = (a2, b2) => BigInt(a2) > BigInt(b2);
  function placeSorted(list, m) {
    let i = list.length; // pending (unsent) messages stay at the very end
    while (i > 0 && (list[i - 1].pending || after(list[i - 1].id, m.id))) i--;
    list.splice(i, 0, m); return i;
  }
  // a removed message takes its date line with it when nothing else from that day is left under it
  function dropMsgEl(el) { if (!el) return; const d = el.previousElementSibling, n = el.nextElementSibling; el.remove(); if (d?.classList.contains('daysep') && (!n || n.classList.contains('daysep'))) d.remove(); }
  function addMsg(m) {
    S.typing.get(m.channelId)?.delete(m.author.id); // typing stops when they post
    const list = S.ahead.has(m.channelId) ? null : S.msgs.get(m.channelId); // viewing older messages: it arrives when you jump to present
    let idx = -1, replaced = false;
    if (list) {
      const pend = m.nonce ? list.findIndex((x) => x.pending && x.nonce === m.nonce) : -1;
      if (pend >= 0) { list.splice(pend, 1); replaced = true; dropMsgEl(document.querySelector(`.msg[data-id="p${m.nonce}"]`)); }
      if (list.some((x) => x.id === m.id)) return; // already shown (e.g. a webhook send's gateway event arrived first)
      idx = placeSorted(list, m);
      if (list.length > 500) { list.splice(0, list.length - 350); S.more.set(m.channelId, true); idx = list.indexOf(m); }
    }
    { const c0 = chan(m.channelId); if (c0) c0.last = maxId(c0.last, m.id); }
    if (m.channelId === S.cid) {
      markRead(m.channelId);
      const stick = nearBottom() || m.author.id === S.me.id;
      if (list) {
        const t = document.createElement('div'); t.innerHTML = msgHTML(m, list[idx - 1]); twe(t); hydrate(t);
        const nxt = list[idx + 1];
        const anchor = nxt && document.querySelector(`.msg[data-id="${nxt.pending ? 'p' + nxt.nonce : nxt.id}"]`);
        if (anchor) { // landed mid-list (out-of-order arrival, or your send confirmed after someone else's): put it where the server says
          let a2 = anchor; if (a2.previousElementSibling?.classList.contains('daysep') && dayKey(nxt.ts) !== dayKey(m.ts)) a2 = a2.previousElementSibling;
          a2.before(...t.childNodes); rerender(nxt);
        } else $('#log').append(...t.childNodes);
      }
      if (stick) scrollBottom();
      renderTyping();
    }
    const why = notifyWhy(m);
    if (why && !MUTED.has(m.channelId) && (!document.hasFocus() || m.channelId !== S.cid)) { if (on('NotificationsForDMs')) notify(m, why); sfx('message'); }
    if (m.channelId === S.cid) { /* shown above */ } else if (m.author.id !== S.me.id) {
      const u = S.unread.get(m.channelId) || { n: 0, mentions: 0 };
      u.n++; if (m.mentionsMe || !m.guildId) u.mentions++;
      S.unread.set(m.channelId, u);
      if (!m.guildId) { const d = S.dms.find((x) => x.id === m.channelId); if (d) d.last = m.id; }
      if (m.guildId === S.gid || (!m.guildId && S.gid === DMG)) renderChannels();
      renderRail();
    }
    paintTypingRows();
  }
  const NT = Object.assign({ dm: true, mention: true, reply: true, role: true, everyone: false, reaction: true }, store.get('notifTypes', {}));
  function onAlert(d) {
    const g = S.guilds.get(d.guildId);
    const say = (title, body, target) => { if (NATIVE) invoke('notify', { title, body, target }); sfx('message'); toast(title + (body ? ' · ' + body : '')); };
    if (d.kind === 'keyword') say(`“${d.keyword}” in #${chan(d.m.channelId)?.name ?? ''}`, `${d.m.author.name}: ${d.m.content.slice(0, 140)}`, { guildId: d.m.guildId, channelId: d.m.channelId, id: d.m.id });
    else if (d.kind === 'online') say(`${nickOf(d.user) || d.user.name} is online`, g?.name || '', null);
    else if (d.kind === 'voice') say(`${nickOf(d.user) || d.user.name} joined voice`, `${d.channel} · ${g?.name || ''}`, { guildId: d.guildId, channelId: d.channelId });
    else if (d.kind === 'newAccount') say(`New account joined ${g?.name || ''}`, `${d.user.name} (${d.user.username}), created ${d.days === 0 ? 'today' : d.days + ' day' + (d.days === 1 ? '' : 's') + ' ago'}`, null);
    else if (d.kind === 'raid') say(`Possible raid in ${d.guild}`, `${d.count} people joined within a minute`, null);
    else if (d.kind === 'error') toast(d.text, true);
  }
  function notifyWhy(m) {
    if (m.author.id === S.me.id) return null;
    if (!m.guildId) return NT.dm ? 'dm' : null;
    if (m.mentionsMe) return NT.mention ? 'mention' : null;
    if (m.replyToMe) return NT.reply ? 'reply' : null;
    if (m.mentionsRole) return NT.role ? 'role' : null;
    if (m.everyone) return NT.everyone ? 'everyone' : null;
    return null;
  }
  function notify(m, why) {
    const where = m.guildId ? `#${chan(m.channelId)?.name ?? ''} · ${S.guilds.get(m.guildId)?.name ?? ''}` : 'Direct message';
    const body = (m.content || (m.attachments.length ? 'sent an attachment' : '')).slice(0, 180);
    if (NATIVE) invoke('notify', { title: `${m.author.name} (${where})`, body, target: { guildId: m.guildId || DMG, channelId: m.channelId, id: m.id } });
    else if (window.Notification?.permission === 'granted') new Notification(`${m.author.name} (${where})`, { body, icon: m.author.avatar });
  }
  window.__TAURI__?.event?.listen?.('v1-open', ({ payload: t }) => { if (t?.channelId) goTo(t.guildId, t.channelId, t.id); });
  async function goTo(gid, cid, mid) {
    if (gid && gid !== S.gid) { S.gid = gid; store.set('gid', gid); $('#app').classList.toggle('nomembers', gid === DMG || !S.showMembers); renderRail(); renderSideHead(); if (gid === DMG) await loadDms(); else loadMembers(gid); }
    await openChannel(cid);
    if (mid) jumpTo(mid, cid);
  }
  function updMsg(m) {
    const list = S.msgs.get(m.channelId); if (!list) return;
    const i = list.findIndex((x) => x.id === m.id); if (i < 0) return;
    const old = list[i];
    if (on('MessageLogger') && m.author.id !== S.me.id && old.content !== m.content && old.content) m.history = [...(old.history || []), old.content]; else m.history = old.history; // MessageLogger: keep edits
    m.translated = old.translated;
    list[i] = m; rerender(m);
  }
  function delMsg(cid, id) { // MessageLogger: deleted messages stay, marked red
    const m = findMsg(cid, id); if (!m) return;
    if (!on('MessageLogger') || m.author.id === S.me.id) { const list = S.msgs.get(cid); list.splice(list.indexOf(m), 1); if (cid === S.cid) dropMsgEl($(`.msg[data-id="${id}"]`)); return; }
    m.deleted = true;
    for (const a of m.attachments) if (a.id && /^(image|video)\//.test(a.type || '')) { a.url = a.proxy = `${API}/att/${a.id}?k=${encodeURIComponent(KEY)}`; } // V1 kept a copy; Discord's is gone
    rerender(m);
  }
  function setReaction(cid, id, r) {
    const m = findMsg(cid, id); if (!m) return;
    const i = m.reactions.findIndex((x) => x.key === r.key);
    if (r.count <= 0) { if (i >= 0) m.reactions.splice(i, 1); } else if (i >= 0) m.reactions[i] = r; else m.reactions.push(r);
    rerender(m);
  }

  // scrollback: start loading well before the top, add older messages on top without re-rendering the rest
  async function loadOlder() {
    const sc = $('#scroller');
    if (S.loading || !S.more.get(S.cid) || sc.scrollTop > 2500) return;
    const cid = S.cid, list = S.msgs.get(cid); if (!list?.length) return;
    S.loading = true;
    try {
      const r = await api('GET', `/channels/${cid}/messages?limit=100&before=${list[0].id}`);
      if (S.cid !== cid || !r.messages.length) { S.more.set(cid, false); return; }
      const oldFirst = list[0];
      list.unshift(...r.messages); S.more.set(cid, r.messages.length === 100);
      const before = sc.scrollHeight - sc.scrollTop;
      const log = $('#log');
      log.querySelector(':scope > .loadmore, :scope > .chanstart')?.remove();
      let html = S.more.get(cid) ? '<div class="loadmore">Loading older messages</div>' : '';
      for (let i = 0; i < r.messages.length; i++) html += msgHTML(r.messages[i], r.messages[i - 1]);
      const t = document.createElement('div'); t.innerHTML = html; twe(t); hydrate(t);
      log.prepend(...t.childNodes);
      if (!S.more.get(cid)) renderLog(); // reached the start: show the channel header
      else { const el = log.querySelector(`.msg[data-id="${oldFirst.id}"]`); if (el) { el.previousElementSibling?.classList.contains('daysep') && dayKey(r.messages.at(-1).ts) === dayKey(oldFirst.ts) && el.previousElementSibling.remove(); rerender(oldFirst); } }
      sc.scrollTop = sc.scrollHeight - before;
    } catch (e) { toast(e.message, true); } finally { S.loading = false; }
    if (S.cid === cid && sc.scrollTop < 2500) loadOlder(); // still close to the top: keep going
  }
  $('#scroller').addEventListener('scroll', () => {
    pinned = nearBottom();
    loadOlder(); loadNewer();
  }, { passive: true });

  // audio players
  const audioOf = (el) => el.querySelector('audio');
  $('#log').addEventListener('input', (e) => { const v = e.target.closest('.avr'); if (v) { const au = audioOf(v.closest('[data-audio]')); au.volume = v.value / 100; au.muted = false; store.set('audioVol', au.volume); return; } });
  $('#log').addEventListener('play', (e) => { if (e.target.tagName === 'AUDIO') e.target.volume = store.get('audioVol', 1); }, true);
  $('#log').addEventListener('input', (e) => { const s2 = e.target.closest('.aseek'); if (!s2) return; const au = audioOf(s2.closest('[data-audio]')); if (au.duration) au.currentTime = s2.value / 1000 * au.duration; });
  $('#log').addEventListener('click', (e) => { const sl = e.target.closest('[data-sys]'); if (sl) $(sl.dataset.sys === 'pins' ? '#tpins' : '#tthreads')?.click(); });
  $('#log').addEventListener('click', (e) => {
    const pl = e.target.closest('.aplay'); const vol = e.target.closest('.avol');
    if (!pl && !vol) return;
    e.stopPropagation();
    const box = (pl || vol).closest('[data-audio]'), au = audioOf(box);
    if (vol) { au.muted = !au.muted; vol.classList.toggle('off', au.muted); return; }
    for (const other of document.querySelectorAll('#log audio')) if (other !== au && !other.paused) other.pause();
    if (au.paused) au.play(); else au.pause();
    if (!au.dataset.wired) {
      au.dataset.wired = 1;
      const paint = () => {
        pl.innerHTML = au.paused ? I.play : I.pause;
        const t = box.querySelector('.atime'), sk = box.querySelector('.aseek');
        if (box.classList.contains('vmsg')) { t.textContent = tm(au.paused && !au.currentTime ? au.duration : au.currentTime); const bars = box.querySelectorAll('.wave i'); const k = Math.round((au.currentTime / (au.duration || 1)) * bars.length); bars.forEach((b, i) => b.classList.toggle('on', i < k)); }
        else { t.textContent = `${tm(au.currentTime)} / ${tm(au.duration)}`; if (sk && au.duration) sk.value = au.currentTime / au.duration * 1000; }
      };
      for (const ev of ['play', 'pause', 'timeupdate', 'loadedmetadata', 'ended']) au.addEventListener(ev, paint);
    }
  }, true);

  addEventListener('keydown', (e) => { if (e.key === 'Shift') document.body.classList.add('shift'); });
  addEventListener('keyup', (e) => { if (e.key === 'Shift') document.body.classList.remove('shift'); });
  addEventListener('blur', () => document.body.classList.remove('shift'));
  // star a GIF straight from the chat
  $('#log').addEventListener('click', async (e) => {
    const st2 = e.target.closest('.gifm .gstar'); if (!st2) return;
    e.stopPropagation(); e.preventDefault();
    const box = st2.closest('.gifm');
    if (!FAVGIFS) FAVGIFS = (await api('GET', '/gifs/favs').catch(() => ({ gifs: [] }))).gifs;
    const fav = FAVGIFS.some((x) => x.url === box.dataset.gurl);
    try {
      const r = fav ? await api('DELETE', `/gifs/favs?url=${encodeURIComponent(box.dataset.gurl)}`) : await api('POST', '/gifs/favs', { url: box.dataset.gurl, src: box.dataset.gsrc, w: +box.dataset.w, h: +box.dataset.h });
      FAVGIFS = r.gifs; st2.classList.toggle('on', !fav); toast(fav ? 'Removed from favourite GIFs' : 'Added to favourite GIFs');
    } catch (x) { toast(x.message, true); }
  }, true);

  // message clicks: tools, reactions, spoilers, jumps, profiles, lightbox
  $('#log').addEventListener('click', (e) => {
    const sp = e.target.closest('.spoiler.hidden'); if (sp) { sp.classList.remove('hidden'); return; }
    const el = e.target.closest('.msg'); const m = el && (findMsg(S.cid, el.dataset.id) || (S.msgs.get(S.cid) || []).find((x) => x.pending && 'p' + x.nonce === el.dataset.id));
    const act = e.target.closest('[data-act]');
    if (act && m) {
      const a = act.dataset.act;
      if (a === 'retry') { m.failed = null; rerender(m); sendPending(m); return; }
      if (a === 'discard') { const l = S.msgs.get(m.channelId); l.splice(l.indexOf(m), 1); dropMsgEl(el); return; }
      if (a === 'reply') startReply(m);
      if (a === 'edit') startEdit(m);
      if (a === 'delete') delMessage(m, e.shiftKey);
      if (a === 'hidedel') { const l = S.msgs.get(m.channelId); l.splice(l.indexOf(m), 1); dropMsgEl(el); return; }
      if (a === 'translate') translate(m);
      if (a === 'forward') forwardPop(m, e);
      if (a === 'more') el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: e.clientX - 180, clientY: e.clientY + 10 }));
      if (a === 'endpoll') api('POST', `/channels/${m.channelId}/messages/${m.id}/endpoll`).catch((x) => toast(x.message, true));
      if (a === 'react') { const b = act.getBoundingClientRect(); openPicker(b.left - 300, b.bottom + 6, (k) => react(m, k, true)); }
      return;
    }
    const qr = e.target.closest('[data-qr]');
    if (qr && m) { used(qr.dataset.qr); react(m, qr.dataset.qr, true); return; }
    const rx = e.target.closest('[data-rx]');
    if (rx && m) { const r = m.reactions.find((x) => x.key === rx.dataset.rx); react(m, r.key, !r.me); return; }
    const jump = e.target.closest('[data-jump]');
    if (jump && !e.target.closest('[data-uid]')) { jumpTo(jump.dataset.jump); return; }
    const who = e.target.closest('[data-uid]');
    if (who) { showProfile(who.dataset.uid, who); return; }
    const cm = e.target.closest('[data-cid]'); if (cm) { const g = guildOf(cm.dataset.cid); if (g) { if (g.id !== S.gid) { S.gid = g.id; renderRail(); renderSideHead(); loadMembers(g.id); } openChannel(cm.dataset.cid); } return; }
    const yt = e.target.closest('[data-yt]');
    if (yt) { playYt(yt); return; }
    const pop = e.target.closest('[data-ytpop]'); if (pop) { invoke('play_external', { url: 'https://youtu.be/' + pop.dataset.ytpop }); return; }
    const ml = e.target.closest('.mlink'); if (ml) { jumpTo(ml.dataset.mm, ml.dataset.mc); return; }
    const th = e.target.closest('[data-thread]'); if (th) { openChannel(th.dataset.thread); return; }
    const img = e.target.closest('.atts img, .eimg, .embed.media img, .gifimg');
    if (img && !e.target.closest('.gstar')) {
      const all = [...(img.closest('.msg') || document).querySelectorAll('.atts img, .eimg, .embed.media img, .gifimg')];
      lightbox(all.map((x) => x.dataset.full || x.src), Math.max(0, all.indexOf(img)));
      return;
    }
    const gv = e.target.closest('.embed.media video, .atts video.gifv');
    if (gv && !e.target.closest('.gstar')) { lightbox(gv.dataset.src || gv.src, 0, true); return; }
    const link = e.target.closest('a[href]');
    if (link) { e.preventDefault(); openUrl(link.href); }
  });
  // MessageClickActions: double-click your own message to edit, anyone else's to reply
  $('#log').addEventListener('dblclick', (e) => {
    if (!on('MessageClickActions')) return;
    if (e.target.closest('a, button, img, video, .tools, [data-uid]')) return;
    const el = e.target.closest('.msg'); const m = el && findMsg(S.cid, el.dataset.id); if (!m || m.deleted) return;
    getSelection()?.removeAllRanges();
    m.author.id === S.me.id && m.content ? startEdit(m) : startReply(m);
  });
  $('#log').addEventListener('contextmenu', (e) => {
    const img = e.target.closest('.atts img, .eimg');
    const emo = e.target.closest('img.emoji[src*="/emojis/"]');
    const el = e.target.closest('.msg'); const m = el && findMsg(S.cid, el.dataset.id);
    if (!m) return;
    e.preventDefault();
    el.classList.add('ctx');
    if (m.deleted) { // MessageLogger: a deleted message only offers to be removed from history
      menu(e, [['Remove from history', () => { const l = S.msgs.get(m.channelId); l.splice(l.indexOf(m), 1); dropMsgEl(el); }, 'red']], () => el.classList.remove('ctx'));
      return;
    }
    const sel = String(getSelection() || '');
    const items = [];
    if (sel) items.push(['Copy', () => copy(sel)]);
    items.push(['Add Reaction', () => openPicker(e.clientX, e.clientY, (k) => react(m, k, true))], ['Reply', () => startReply(m)]);
    if (m.author.id === S.me.id && m.content && !m.deleted) items.push(['Edit Message', () => startEdit(m)]);
    if (m.content) items.push(['Copy Text', () => copy(m.content)], ['Translate', () => translate(m)]);
    if (img) items.push(['Open Image', () => openUrl(img.dataset.full || img.src)], ['Copy Image Link', () => copy(img.dataset.full || img.src)], ['Search Image (Google Lens)', () => openUrl('https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(img.dataset.full || img.src))]);
    const gifEmbed = m.embeds.find((x) => x.type === 'gifv' || (x.type === 'image' && /\.gif/i.test(x.url || '')));
    if (gifEmbed && e.target.closest('.embed.media')) { const fav = (FAVGIFS || []).some((x) => x.url === gifEmbed.url);
      items.push([fav ? 'Remove from Favourites' : 'Add to Favourites', async () => { const src = gifEmbed.video?.url || gifEmbed.thumbnail?.url || gifEmbed.url;
        const r = fav ? await api('DELETE', `/gifs/favs?url=${encodeURIComponent(gifEmbed.url)}`) : await api('POST', '/gifs/favs', { url: gifEmbed.url, src, w: gifEmbed.video?.width, h: gifEmbed.video?.height }); FAVGIFS = r.gifs; toast(fav ? 'Removed from Favourites' : 'Added to Favourites'); }]); }
    if (emo) { const id = /emojis\/(\d+)/.exec(emo.src)[1]; items.push(['Copy Emoji Markdown', () => copy(`<${/\.gif/.test(emo.src) ? 'a' : ''}${emo.alt}${id}>`)]); }
    if (!m.deleted) items.push([m.pinned ? 'Unpin Message' : 'Pin Message', () => api(m.pinned ? 'DELETE' : 'PUT', `/channels/${m.channelId}/messages/${m.id}/pin`).then(() => { m.pinned = !m.pinned; toast(m.pinned ? 'Pinned' : 'Unpinned'); }, (x) => toast(x.message, true))]);
    if (!m.deleted) items.push(['Forward', () => forwardPop(m, e)]);
    const ch0 = chan(m.channelId);
    if (!m.deleted && m.embeds.length && (m.author.id === S.me.id || ch0?.manage)) items.push(['Remove Embeds', () => api('POST', `/channels/${m.channelId}/messages/${m.id}/noembeds`).catch((x) => toast(x.message, true))]);
    if (!m.deleted && ch0?.type === CH.NEWS) items.push(['Publish', () => api('POST', `/channels/${m.channelId}/messages/${m.id}/publish`).then(() => toast('Published'), (x) => toast(x.message, true))]);
    if (!m.deleted && m.guildId && !m.thread) items.push(['Create Thread', async () => { const n = await ask({ title: 'Create Thread', input: { label: 'Thread name', value: (m.content || 'Thread').slice(0, 60) }, ok: 'Create' }); if (n) api('POST', `/channels/${m.channelId}/messages/${m.id}/thread`, { name: n }).then((r) => openChannel(r.id), (x) => toast(x.message, true)); }]);
    items.push(['Mention Author', () => mention(m.author.id, m.author.name)], ['Copy Message Link', () => copy(`https://discord.com/channels/${m.guildId || '@me'}/${m.channelId}/${m.id}`)], ['Copy Message ID', () => copy(m.id)]);
    if (m.history?.length) items.push(['Remove Message History', () => { m.history = []; rerender(m); }]);
    if (canDelete(m)) items.push(['-'], ['Delete Message', () => delMessage(m, true), 'red']);
    menu(e, items, () => el.classList.remove('ctx'));
  });
  // WhoReacted: hover a reaction to see who
  $('#log').addEventListener('mouseover', (e) => {
    const rx = e.target.closest('[data-rx]'); if (!rx || rx.title || !on('WhoReacted')) return;
    const el = rx.closest('.msg'); const m = findMsg(S.cid, el.dataset.id); if (!m) return;
    rx.title = '…';
    api('GET', `/channels/${m.channelId}/messages/${m.id}/reactions/${encodeURIComponent(rx.dataset.rx)}`).then((r) => { rx.title = r.users.join(', ') + (r.more ? ` and ${r.more} more` : ''); }).catch(() => { rx.title = ''; });
  });
  function forwardPop(m, e) {
    const all = [...S.dms.map((d) => ({ id: d.id, label: '@' + d.user.name, sub: 'DM' })), ...[...S.guilds.values()].flatMap((g) => g.channels.filter((c) => c.type !== CH.CAT && c.send).map((c) => ({ id: c.id, label: (isVoice(c) ? '🔊 ' : '#') + c.name, sub: g.name })))];
    const p = showPop(e.clientX, e.clientY - 200, `<div class="menu fwd"><input class="rsearch" placeholder="Forward to…"><div class="fl">${all.map((x) => `<button data-to="${x.id}" data-q="${esc((x.label + ' ' + x.sub).toLowerCase())}"><span>${esc(x.label)}</span><small>${esc(x.sub)}</small></button>`).join('')}</div></div>`);
    const inp = p.querySelector('input'); inp.focus();
    inp.oninput = () => { const q = inp.value.toLowerCase(); for (const b of p.querySelectorAll('[data-to]')) b.hidden = !b.dataset.q.includes(q); };
    p.onclick = (ev) => { const b = ev.target.closest('[data-to]'); if (!b) return; hidePop(); api('POST', `/channels/${m.channelId}/messages/${m.id}/forward`, { to: b.dataset.to }).then(() => toast('Forwarded'), (x) => toast(x.message, true)); };
  }
  function jumpTo(id, cid = S.cid) {
    if (cid !== S.cid) { const g = guildOf(cid); if (g && g.id !== S.gid) { S.gid = g.id; renderRail(); renderSideHead(); loadMembers(g.id); } openChannel(cid).then(() => jumpTo(id, cid)); return; }
    const t = $(`.msg[data-id="${id}"]`);
    if (t) { t.scrollIntoView({ block: 'center' }); t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); return; }
    // not loaded: show the messages around it, like Discord, with "Jump to present" until you're back at the latest
    api('GET', `/channels/${cid}/messages?limit=100&around=${id}`).then((r) => {
      if (S.cid !== cid || !r.messages.some((m) => m.id === id)) { toast("Couldn't find that message", true); return; }
      S.msgs.set(cid, r.messages); S.more.set(cid, true); S.ahead.add(cid);
      renderLog(); renderAhead(); jumpTo(id, cid);
    }, (x) => toast(x.message, true));
  }
  function renderAhead() {
    let b = $('#ahead');
    if (!S.ahead.has(S.cid)) { b?.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'ahead'; b.innerHTML = "<span>You're viewing older messages</span><button>Jump to present</button>"; b.querySelector('button').onclick = jumpPresent; $('#dock').prepend(b); }
  }
  function jumpPresent() { const cid = S.cid; S.ahead.delete(cid); S.msgs.delete(cid); S.more.delete(cid); renderAhead(); openChannel(cid); }
  async function loadNewer() { // scrolled to the bottom of an older window: bring in the next 100
    const cid = S.cid, list = S.msgs.get(cid);
    if (S.loading || !S.ahead.has(cid) || !list?.length || !nearBottom()) return;
    S.loading = true;
    try {
      const r = await api('GET', `/channels/${cid}/messages?limit=100&after=${list.at(-1).id}`);
      if (S.cid !== cid) return;
      const fresh = r.messages.filter((m) => !list.some((x) => x.id === m.id));
      let html = ''; for (const m of fresh) { html += msgHTML(m, list.at(-1)); list.push(m); }
      const t = document.createElement('div'); t.innerHTML = html; twe(t); hydrate(t); $('#log').append(...t.childNodes);
      if (r.messages.length < 100) { S.ahead.delete(cid); renderAhead(); markRead(cid); }
      if (list.length > 600) { list.splice(0, list.length - 400); S.more.set(cid, true); const sc = $('#scroller'), before = sc.scrollHeight - sc.scrollTop; renderLog(); sc.scrollTop = sc.scrollHeight - before; }
    } catch (e) { toast(e.message, true); } finally { S.loading = false; }
  }
  function react(m, key, add) {
    const r = m.reactions.find((x) => x.key === key); // show it at once; the server sends the real numbers back
    if (add && r?.me) return;
    if (!add && !r?.me) return;
    if (r) { r.count += add ? 1 : -1; r.me = add; if (r.count <= 0) m.reactions.splice(m.reactions.indexOf(r), 1); }
    else if (add) { const [name, id] = key.includes(':') ? key.split(':') : [key, null]; m.reactions.push({ key, name, id, animated: false, count: 1, me: true }); }
    rerender(m);
    api(add ? 'PUT' : 'DELETE', `/channels/${m.channelId}/messages/${m.id}/reactions/${encodeURIComponent(key)}`).catch((x) => toast(x.message, true));
  }
  function ask({ title, body = '', input = null, ok = 'Confirm', danger = false }) {
    return new Promise((done) => {
      const box = document.createElement('div'); box.className = 'modal';
      box.innerHTML = `<div class="mcard"><h2>${esc(title)}</h2>${body ? `<div class="mtext">${body}</div>` : ''}${input ? `<label>${esc(input.label)}<input id="askin" value="${esc(input.value || '')}" placeholder="${esc(input.placeholder || '')}"></label>` : ''}<div class="mact"><button class="sec" data-a="0">Cancel</button><button data-a="1" class="${danger ? 'red' : ''}">${esc(ok)}</button></div></div>`;
      document.body.append(box);
      const fin = (v) => { box.remove(); done(v); };
      box.onclick = (e) => { const a = e.target.closest('[data-a]'); if (a) fin(a.dataset.a === '1' ? (input ? $('#askin').value : true) : null); else if (e.target === box) fin(null); };
      box.onkeydown = (e) => { if (e.key === 'Escape') fin(null); if (e.key === 'Enter') fin(input ? $('#askin').value : true); };
      (box.querySelector('#askin') || box.querySelector('[data-a="1"]')).focus();
    });
  }
  async function delMessage(m, sure) {
    if (sure || await ask({ title: 'Delete Message', body: 'Are you sure you want to delete this message?', ok: 'Delete', danger: true })) api('DELETE', `/channels/${m.channelId}/messages/${m.id}`).catch((x) => toast(x.message, true));
  }
  async function translate(m) {
    try {
      const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=' + encodeURIComponent(m.content));
      const j = await r.json();
      m.translated = j[0].map((x) => x[0]).join('') + (j[2] && j[2] !== 'en' ? ` (from ${j[2]})` : '');
      rerender(m);
    } catch (e) { toast('Translate failed', true); }
  }
  function playYt(el) { // WebKit's video player can't play YouTube streams reliably (and it's what froze the client): Celluloid (mpv) plays it in HD
    const id = el.dataset.yt;
    if (NATIVE) { invoke('play_external', { url: 'https://youtu.be/' + id }); el.classList.add('playing'); toast('Opening in Celluloid'); setTimeout(() => el.classList.remove('playing'), 4000); return; }
    el.outerHTML = `<iframe class="ytf" src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  }
  function lightbox(srcs, start = 0, video = false) { // gallery: arrows/keys move, wheel zooms, drag pans, Esc or click outside closes
    if (!Array.isArray(srcs)) srcs = [srcs];
    let i = start;
    const lb = document.createElement('div'); lb.id = 'lightbox';
    const many = srcs.length > 1;
    lb.innerHTML = `<div class="lbstage"></div>${many ? `<button class="lbnav prev" title="Previous (←)">${I.back}</button><button class="lbnav next" title="Next (→)">${I.fwd}</button><div class="lbcount"></div>` : ''}<a class="lbopen" href="#">Open original</a>`;
    const stage = lb.querySelector('.lbstage');
    let z = 1, x = 0, y = 0, drag = null, moved = false, el = null;
    const apply = () => { if (el) el.style.transform = `translate(${x}px, ${y}px) scale(${z})`; };
    const show = () => {
      z = 1; x = y = 0;
      const src = srcs[i];
      stage.innerHTML = video ? `<video src="${esc(src)}" autoplay loop muted playsinline></video>` : `<img src="${esc(src)}" alt="">`;
      el = stage.firstChild; apply();
      if (many) lb.querySelector('.lbcount').textContent = `${i + 1} / ${srcs.length}`;
    };
    const go = (d) => { i = (i + d + srcs.length) % srcs.length; show(); };
    const close = () => { lb.remove(); removeEventListener('keydown', onKey, true); };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (many && e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(1); }
      else if (many && e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(-1); }
    };
    addEventListener('keydown', onKey, true);
    lb.querySelector('.lbopen').onclick = (e) => { e.preventDefault(); e.stopPropagation(); openUrl(srcs[i]); };
    if (many) { lb.querySelector('.prev').onclick = (e) => { e.stopPropagation(); go(-1); }; lb.querySelector('.next').onclick = (e) => { e.stopPropagation(); go(1); }; }
    lb.onwheel = (e) => { e.preventDefault(); if (!on('ImageZoom')) return; z = Math.max(1, Math.min(8, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); if (z === 1) x = y = 0; apply(); };
    lb.onmousedown = (e) => { if (e.target.closest('.lbnav, .lbopen')) return; drag = [e.clientX - x, e.clientY - y]; moved = false; };
    lb.onmousemove = (e) => { if (drag && z > 1) { x = e.clientX - drag[0]; y = e.clientY - drag[1]; moved = true; apply(); } };
    lb.onmouseup = (e) => { const wasDrag = moved; drag = null; if (!wasDrag && !e.target.closest('.lbnav, .lbopen') && (z === 1 || e.target === lb || e.target === stage)) close(); };
    document.body.append(lb);
    show();
  }


  // ------------------------------------------------------------------ typing
  function renderTyping() {
    const t = S.typing.get(S.cid), now = Date.now();
    const list = t ? [...t.values()].filter((x) => x.until > now) : [];
    const el = $('#typing');
    if (!list.length) { if (el.innerHTML) el.innerHTML = ''; return; }
    const n = (x) => `<b style="${x.color ? `color:${x.color}` : ''}">${esc(x.name)}</b>`; // TypingTweaks: role colours
    const who = list.length === 1 ? `${n(list[0])} is typing…` : list.length <= 3 ? `${list.map(n).join(', ').replace(/, ([^,]*)$/, ' and $1')} are typing…` : 'Several people are typing…';
    el.innerHTML = `<span class="dots"><i></i><i></i><i></i></span><span>${who}</span>`;
  }
  setInterval(() => {
    if (!S.typing.size) return;
    const now = Date.now();
    for (const [cid, t] of S.typing) { for (const [uid, x] of t) if (x.until <= now) t.delete(uid); if (!t.size) S.typing.delete(cid); }
    renderTyping(); paintTypingRows();
  }, 1000);

  // ------------------------------------------------------------------ composer
  const ta = $('#ta');
  const hl = document.createElement('div'); hl.id = 'hl';
  { const wrap = document.createElement('div'); wrap.className = 'tawrap'; ta.replaceWith(wrap); wrap.append(hl, ta); } // mention highlight layer under the textarea
  function paintHl() {
    const names = new Set([...S.aliases.keys()]);
    for (const m of S.members.get(S.gid)?.members || []) { names.add('@' + m.name); if (m.username) names.add('@' + m.username); }
    hl.innerHTML = esc(ta.value).replace(/(^|\s)(@[^\s@<>]{2,32}|#[^\s#<>]{2,40})/g, (all, pre, tok) => {
      const raw = MD.esc ? tok : tok;
      const hit = names.has(tok) || [...names].some((n) => n.toLowerCase() === tok.toLowerCase()) || S.aliases.has(tok);
      return hit ? `${pre}<mark>${tok}</mark>` : all;
    }) + '\n';
    hl.scrollTop = ta.scrollTop;
  }
  ta.addEventListener('scroll', () => { hl.scrollTop = ta.scrollTop; });
  function autosize() { paintHl(); ta.style.height = '56px'; ta.style.height = Math.min(ta.scrollHeight, innerHeight * 0.5) + 'px'; }
  ta.addEventListener('input', () => {
    if (ta.value && !S.silentTyping && Date.now() - S.lastTyping > 8000) { S.lastTyping = Date.now(); api('POST', `/channels/${S.cid}/typing`).catch((x) => report('typing: ' + x.message)); }
    try { autosize(); autocomplete(); } catch (x) { report('composer: ' + x.message); }
  });
  ta.addEventListener('keydown', (e) => {
    if (!$('#ac').hidden && acKey(e)) return;
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); return; }
    if (e.key === 'Escape') { if (S.edit) cancelEdit(); else cancelReply(); clearFiles(); }
    if (e.key === 'ArrowUp' && e.ctrlKey && on('QuickReply')) { e.preventDefault(); quickReply(-1); return; } // QuickReply
    if (e.key === 'ArrowDown' && e.ctrlKey && on('QuickReply')) { e.preventDefault(); quickReply(1); return; }
    if (e.key === 'ArrowUp' && !ta.value) {
      const mine = (S.msgs.get(S.cid) || []).filter((m) => m.author.id === S.me.id && m.content && !m.deleted).pop();
      if (mine) { e.preventDefault(); startEdit(mine); }
    }
  });
  const typingTarget = (t) => t.closest?.('input, textarea, select, [contenteditable], .settings, .modal, #pop');
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1 || typingTarget(e.target) || ta.disabled || S.binding) return;
    ta.focus(); // the key lands in the box
  });
  addEventListener('paste', (e) => {
    if (typingTarget(e.target) || ta.disabled) return;
    ta.focus();
    const ev = new ClipboardEvent('paste', { clipboardData: e.clipboardData, bubbles: true }); // re-run the box's paste handling
    e.preventDefault();
    if (e.clipboardData?.getData('text/plain')) { insert(e.clipboardData.getData('text/plain')); return; }
    ta.dispatchEvent(ev);
  });
  ta.addEventListener('paste', async (e) => {
    const items = [...(e.clipboardData?.items || [])].filter((x) => x.kind === 'file').map((x) => x.getAsFile()).filter(Boolean);
    const f = items.length ? items : [...(e.clipboardData?.files || [])];
    if (f.length) { e.preventDefault(); addFiles(f); return; }
    const text = e.clipboardData?.getData('text/plain');
    if (NATIVE && !text) { // WebKitGTK hides clipboard images from the page: ask the app
      e.preventDefault();
      const img = await invoke('clipboard_image');
      if (img) { const bin = Uint8Array.from(atob(img.data), (c) => c.charCodeAt(0)); addFiles([new File([bin], img.name, { type: img.type })]); }
    }
  });
  ta.addEventListener('blur', () => setTimeout(closeAc, 150));
  function quickReply(dir) {
    const list = (S.msgs.get(S.cid) || []).filter((m) => !m.deleted && !(m.system && SYS[m.type]));
    let i = S.reply ? list.findIndex((m) => m.id === S.reply.id) + dir : (dir < 0 ? list.length - 1 : -1);
    if (i < 0 || i >= list.length) { cancelReply(); return; }
    startReply(list[i]); $(`.msg[data-id="${list[i].id}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  // ClearURLs: strip tracking junk from outgoing links
  const JUNK = /^(utm_\w+|fbclid|gclid|dclid|msclkid|igshid|si|mc_eid|mc_cid|ref_src|ref_url|_hsenc|_hsmi|yclid|twclid|ttclid|feature|pp)$/i;
  const clean = (text) => text.replace(/https?:\/\/[^\s<>]+/g, (u) => {
    try { const x = new URL(u); for (const k of [...x.searchParams.keys()]) if (JUNK.test(k)) x.searchParams.delete(k); return x.toString().replace(/\?$/, ''); } catch { return u; }
  });
  function convertOut(text) {
    for (const [alias, real] of [...S.aliases].sort((a, b) => b[0].length - a[0].length)) text = text.split(alias).join(real);
    const ms = S.members.get(S.gid)?.members || (S.gid === DMG ? S.dms.map((d) => d.user) : []);
    text = text.replace(/(^|\s)@([^\s@<>]{2,32})/g, (all, pre, n) => { // hand-typed @name or @username
      const l = n.toLowerCase(); const m = ms.find((x) => x.username?.toLowerCase() === l) || ms.find((x) => x.name.toLowerCase() === l);
      return m ? `${pre}<@${m.id}>` : all;
    });
    const g = S.guilds.get(S.gid);
    text = text.replace(/(^|[^<\w]):([\w+-]{1,40}):/g, (all, pre, n) => {
      const e = g?.emojis.find((x) => x.name === n) || allEmojis().find((x) => x.name === n);
      if (e) return `${pre}<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`;
      return NAMES[n] ? pre + NAMES[n] : all;
    });
    return on('ClearURLs') ? clean(text) : text;
  }
  let NAMES = {}, CATS = [];
  fetch('vendor/emoji-cats.json').then((r) => r.json()).then((j) => { CATS = j; }).catch(() => {});
  fetch('vendor/emoji-names.json').then((r) => r.json()).then((j) => { NAMES = j; }).catch(() => {});
  const allEmojis = () => [...S.guilds.values()].flatMap((g) => g.emojis);
  async function submit() {
    const text = ta.value.trim();
    closeAc();

    if (!text && !S.files.length && !S.opts.embedSend) return;
    if (S.ahead.has(S.cid)) jumpPresent();
    if (text.length > 2000) { toast(`Too long: ${text.length}/2000`, true); return; }
    const files = S.files.slice(), replyTo = S.reply?.id, ping = S.ping, cid = S.cid, silent = S.silent;
    ta.value = ''; autosize(); cancelReply(); clearFiles(); S.lastTyping = 0; delete DRAFTS[cid]; store.set('drafts', DRAFTS);
    try {
      const opt = S.opts, emb = opt.embedSend;
      const nonce = String((BigInt(Date.now() - 1420070400000) << 22n) + BigInt(Math.floor(Math.random() * 4096)));
      const g = S.guilds.get(S.gid);
      const prev = S.msgs.get(cid) || [];
      const mine = prev.slice().reverse().find((x) => x.author.id === S.me.id && !x.pending)?.author || g?.me || S.me;
      const refm = replyTo ? prev.find((x) => x.id === replyTo) : null;
      const pm = { id: '9'.repeat(20), nonce, pending: true, channelId: cid, guildId: g?.id ?? null, author: opt.as ? { ...mine, name: opt.as.name, id: 'webhook' } : mine, ts: Date.now(), content: convertOut(text),
        reply: replyTo ? { id: replyTo, author: refm?.author, content: refm?.content } : null, mentions: {},
        attachments: files.map((f) => ({ name: f.name + ' (uploading…)', size: f.size, type: 'application/octet-stream', url: '#' })), embeds: [], stickers: [], reactions: [], components: [] };
      if (S.msgs.has(cid) && !emb) { prev.push(pm); if (cid === S.cid) { const t = document.createElement('div'); t.innerHTML = msgHTML(pm, prev[prev.length - 2]); $('#log').append(...t.childNodes); scrollBottom(); } }
      const payload = { nonce, content: convertOut(text), replyTo, ping, silent, tts: opt.tts, noEmbeds: opt.noEmbeds, as: opt.as || undefined,
        embeds: emb ? [emb.em] : undefined, buttons: emb?.buttons, files: await Promise.all(files.map(async (f) => ({ name: f.name, data: await b64(f) }))) };
      pm.payload = payload;
      await sendPending(pm, true);
      S.aliases.clear(); S.opts.embed = null; S.opts.embedSend = null; S.opts.tts = false; renderOpts(); paintHl();
    } catch (x) { toast('Not sent: ' + x.message, true); if (!ta.value) { ta.value = text; autosize(); } }
  }
  async function sendPending(pm, first) {
    try {
      const r = await api('POST', `/channels/${pm.channelId}/messages`, pm.payload);
      if (pm.pending) { r.m.nonce = pm.nonce; addMsg(r.m); } // the gateway usually beats this; either way it reconciles by nonce
    } catch (x) {
      pm.failed = x.message;
      if (S.msgs.get(pm.channelId)?.includes(pm)) rerender(pm); else if (first) throw x;
    }
  }
  const b64 = (f) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = bad; r.readAsDataURL(f); });

  function startReply(m) {
    cancelEdit();
    document.querySelector('.msg.replying')?.classList.remove('replying');
    S.reply = m; S.ping = m.author.id !== S.me.id && !m.author.bot;
    const rb = $('#replybar');
    rb.innerHTML = `<span>Replying to <b>${esc(m.author.name)}</b></span><button class="ping${S.ping ? '' : ' off'}" title="Ping them">@${S.ping ? 'ON' : 'OFF'}</button><button class="x ico" title="Cancel">${I.x}</button>`;
    rb.hidden = false;
    rb.querySelector('.ping').onclick = (e) => { S.ping = !S.ping; e.target.textContent = '@' + (S.ping ? 'ON' : 'OFF'); e.target.classList.toggle('off', !S.ping); };
    rb.querySelector('.x').onclick = cancelReply;
    $(`.msg[data-id="${m.id}"]`)?.classList.add('replying');
    ta.focus();
  }
  function cancelReply() { S.reply = null; $('#replybar').hidden = true; document.querySelector('.msg.replying')?.classList.remove('replying'); }
  function startEdit(m) {
    cancelReply(); cancelEdit();
    const el = $(`.msg[data-id="${m.id}"]`); if (!el) return;
    S.edit = m;
    el.classList.add('editing');
    const body = el.querySelector(':scope > .markup:not(.old)');
    const box = document.createElement('div'); box.className = 'medit';
    box.innerHTML = '<textarea rows="1" spellcheck="true"></textarea><div class="mhint">escape to <button data-ed="cancel">cancel</button> • enter to <button data-ed="save">save</button></div>';
    if (body) { body.hidden = true; body.after(box); } else el.querySelector('.head')?.after(box) ?? el.append(box);
    const t = box.querySelector('textarea'); t.value = m.content;
    const size = () => { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, innerHeight * 0.5) + 'px'; };
    size(); t.focus(); t.setSelectionRange(t.value.length, t.value.length);
    t.oninput = size;
    const save = () => {
      const v = t.value.trim();
      if (!v) { cancelEdit(); delMessage(m); return; } // like Discord: emptying a message offers to delete it
      if (v !== m.content) { m.content = v; api('PATCH', `/channels/${m.channelId}/messages/${m.id}`, { content: convertOut(v) }).catch((x) => toast('Not edited: ' + x.message, true)); }
      cancelEdit(); rerender(m);
    };
    t.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); ta.focus(); } };
    box.onclick = (e) => { const b = e.target.closest('[data-ed]'); if (!b) return; if (b.dataset.ed === 'save') save(); else { cancelEdit(); ta.focus(); } };
  }
  function cancelEdit() {
    if (!S.edit) return;
    const el = $(`.msg[data-id="${S.edit.id}"]`);
    S.edit = null;
    if (el) { el.classList.remove('editing'); el.querySelector('.medit')?.remove(); const b = el.querySelector(':scope > .markup[hidden]'); if (b) b.hidden = false; }
  }

  function addFiles(list) {
    for (const f of list) {
      if (f.size > 10 * 1024 * 1024) { toast(`${f.name} is over 10 MB`, true); continue; }
      if (S.files.length < 10) S.files.push(f);
    }
    renderFiles();
  }
  function clearFiles() { for (const u of S.fileUrls || []) URL.revokeObjectURL(u); S.files = []; renderFiles(); }
  function renderFiles() {
    const fb = $('#filebar');
    fb.hidden = !S.files.length;
    S.fileUrls = [];
    fb.innerHTML = S.files.map((f, i) => { let prev = `<div class="fi">${I.file}</div>`; if (f.type.startsWith('image/')) { const u = URL.createObjectURL(f); S.fileUrls.push(u); prev = `<img src="${u}" alt="">`; } return `<div class="fchip">${prev}<span>${esc(f.name)}</span><button data-rm="${i}" title="Remove">${I.x}</button></div>`; }).join('');
  }
  $('#filebar').addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { S.files.splice(+b.dataset.rm, 1); renderFiles(); } });
  $('#attach').innerHTML = I.plus;
  $('#attach').onclick = (e) => {
    const g = S.guilds.get(S.gid);
    const items = [['Upload a File', () => $('#file').click()], ['Create Poll', openPollMaker], ['Create Embed', openEmbedMaker], ['Schedule Message', scheduleMaker], ['Scheduled Messages', scheduledList]];
    if (S.gid !== DMG) items.push(['Role Picker', rolePickerMaker], ['Sign-up List', signupMaker]);
    if (g?.stickers?.length) items.push(['Send a Sticker', () => stickerPop(e)]);
    items.push(['-'], [S.opts.tts ? 'TTS Message: on' : 'TTS Message', () => { S.opts.tts = !S.opts.tts; renderOpts(); }], [S.opts.noEmbeds ? 'Suppress Embeds: on' : 'Suppress Embeds', () => { S.opts.noEmbeds = !S.opts.noEmbeds; renderOpts(); }]);
    if (S.gid !== DMG && g?.webhooks) items.push([S.opts.as ? `Sending as ${S.opts.as.name}` : 'Send As…', sendAsPop]);
    menu(e, items);
  };
  S.opts = { tts: false, noEmbeds: false, as: store.get('sendAs', null) && null, embed: null };
  function renderOpts() {
    let bar = $('#optbar'); if (!bar) { bar = document.createElement('div'); bar.id = 'optbar'; $('#composer').before(bar); }
    const chips = [];
    if (S.opts.as) chips.push(['as', `Sending as <b>${esc(S.opts.as.name)}</b>`]);
    if (S.opts.tts) chips.push(['tts', 'TTS']);
    if (S.opts.noEmbeds) chips.push(['noEmbeds', 'No embeds']);
    if (S.opts.embed) chips.push(['embed', `Embed: <b>${esc(S.opts.embed.title || S.opts.embed.description?.slice(0, 30) || 'untitled')}</b>`]);
    bar.innerHTML = chips.map(([k, h]) => `<span class="chip">${h}<button data-off="${k}" title="Remove">${I.x}</button></span>`).join('');
    bar.hidden = !chips.length;
  }
  $('#dock').addEventListener('click', (e) => { const b = e.target.closest('[data-off]'); if (!b) return; const k = b.dataset.off; S.opts[k] = k === 'as' || k === 'embed' ? null : false; renderOpts(); });
  async function sendAsPop() {
    const last = store.get('sendAs', { name: '', avatar: '' });
    const name = await ask({ title: 'Send As', body: 'Messages go out through a webhook with this name. Leave empty to send as V1.', input: { label: 'Name', value: last.name || '' }, ok: 'Next' });
    if (name === null) return;
    if (!name.trim()) { S.opts.as = null; renderOpts(); return; }
    const avatar = await ask({ title: 'Send As', input: { label: 'Avatar image URL (optional)', value: last.avatar || '' }, ok: 'Use' });
    if (avatar === null) return;
    S.opts.as = { name: name.trim(), avatar: avatar.trim() }; store.set('sendAs', S.opts.as); renderOpts();
  }
  function stickerPop(e) {
    const g = S.guilds.get(S.gid);
    const p = showPop(e.clientX, e.clientY - 300, `<div class="picker"><div class="grid stk">${g.stickers.map((x) => `<button data-st="${x.id}" title="${esc(x.name)}"><img src="${esc(x.url)}" alt="" loading="lazy"></button>`).join('')}</div></div>`);
    p.onclick = (ev) => { const b = ev.target.closest('[data-st]'); if (!b) return; hidePop(); api('POST', `/channels/${S.cid}/messages`, { stickers: [b.dataset.st] }).catch((x) => toast(x.message, true)); };
  }
  function openEmbedMaker() {
    const e0 = S.opts.embed || { color: '#5865f2', buttons: [] };
    const box = document.createElement('div'); box.className = 'modal';
    box.innerHTML = `<div class="mcard wide"><h2>Create an embed</h2>
      <div class="two"><label>Title<input id="et" maxlength="256" value="${esc(e0.title || '')}"></label><label>Title link<input id="eu" placeholder="https://" value="${esc(e0.url || '')}"></label></div>
      <label>Description<textarea id="ed" maxlength="4000" rows="5">${esc(e0.description || '')}</textarea></label>
      <div class="two"><label>Image URL<input id="ei" value="${esc(e0.image?.url || '')}"></label><label>Thumbnail URL<input id="eth" value="${esc(e0.thumbnail?.url || '')}"></label></div>
      <div class="two"><label>Footer<input id="ef" maxlength="2048" value="${esc(e0.footer?.text || '')}"></label><label>Colour<input id="ec" type="color" value="${esc(e0.color || '#5865f2')}"></label></div>
      <label>Link buttons (one per line: Label | https://…)<textarea id="eb" rows="2">${esc((e0.buttons || []).map((b) => `${b.label} | ${b.url}`).join('\n'))}</textarea></label>
      <div class="mact"><button class="sec" id="ecx">Cancel</button><button class="sec" id="eatt">Attach to next message</button><button id="esend">Send now</button></div></div>`;
    document.body.append(box);
    const close = () => box.remove();
    const read = () => {
      const v = (id) => box.querySelector(id).value.trim();
      const em = { title: v('#et') || undefined, url: v('#eu') || undefined, description: v('#ed') || undefined, color: parseInt(v('#ec').slice(1), 16),
        image: v('#ei') ? { url: v('#ei') } : undefined, thumbnail: v('#eth') ? { url: v('#eth') } : undefined, footer: v('#ef') ? { text: v('#ef') } : undefined };
      const buttons = v('#eb').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter(([l, u]) => l && /^https?:\/\//.test(u || '')).map(([label, url]) => ({ label, url }));
      return { em, buttons, keep: { ...em, color: v('#ec'), buttons } };
    };
    box.querySelector('#ecx').onclick = close;
    box.onmousedown = (e) => { if (e.target === box) close(); };
    box.querySelector('#eatt').onclick = () => { const r = read(); S.opts.embed = r.keep; S.opts.embedSend = r; close(); renderOpts(); };
    box.querySelector('#esend').onclick = async () => { const r = read(); if (!r.em.title && !r.em.description && !r.em.image) { toast('Give it a title, description or image', true); return; }
      try { await api('POST', `/channels/${S.cid}/messages`, { embeds: [r.em], buttons: r.buttons, as: S.opts.as }); close(); } catch (x) { toast(x.message, true); } };
  }
  // ---------- bot extras in the composer: scheduled messages, role pickers, sign-up lists
  function modalForm(title, inner, okLabel, onOk) {
    const box = document.createElement('div'); box.className = 'modal';
    box.innerHTML = `<div class="mcard wide"><h2>${esc(title)}</h2>${inner}<div class="mact"><button class="sec" data-x>Cancel</button><button data-ok>${esc(okLabel)}</button></div></div>`;
    document.body.append(box);
    const close = () => box.remove();
    box.onmousedown = (e) => { if (e.target === box || e.target.closest('[data-x]')) close(); };
    box.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Escape') close(); };
    box.querySelector('[data-ok]').onclick = async () => { try { if (await onOk(box) !== false) close(); } catch (x) { toast(x.message, true); } };
    fancySelects(box);
    return box;
  }
  function scheduleMaker() {
    const d = new Date(Date.now() + 3600e3); const pad = (n) => String(n).padStart(2, '0');
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const box = modalForm('Schedule a message', `<label>Message<textarea id="sct" rows="4" maxlength="2000">${esc(ta.value)}</textarea></label><label>Send at<input id="scw" type="datetime-local" value="${local}"></label><div class="mtext">V1 sends it to #${esc(chan(S.cid)?.name ?? '')} at that time, even if this client is closed.</div>`, 'Schedule', async (b) => {
      const content = convertOut(b.querySelector('#sct').value.trim()); const at = new Date(b.querySelector('#scw').value).getTime();
      if (!content) throw new Error('Write something first.');
      await api('POST', '/schedule', { channelId: S.cid, content, at });
      if (ta.value.trim() === b.querySelector('#sct').value.trim()) { ta.value = ''; autosize(); }
      toast('Scheduled for ' + fmtWhen(at));
    });
    box.querySelector('#sct').focus();
  }
  async function scheduledList() {
    const r = await api('GET', '/schedule').catch((x) => { toast(x.message, true); return null; }); if (!r) return;
    const box = modalForm('Scheduled messages', `<div class="tbl">${r.list.sort((a, b) => a.at - b.at).map((x) => `<div class="trow2"><b>${fmtWhen(x.at)}</b><span>#${esc(x.channel)}</span><span class="sctx">${esc(x.content.slice(0, 80))}</span><button class="ico danger" data-del="${x.id}" title="Cancel">${I.trash}</button></div>`).join('') || '<div class="note">Nothing scheduled</div>'}</div>`, 'Done', () => true);
    box.querySelector('.tbl').onclick = async (e) => { const d = e.target.closest('[data-del]'); if (!d) return; await api('DELETE', `/schedule/${d.dataset.del}`); d.closest('.trow2').remove(); toast('Cancelled'); };
  }
  async function rolePickerMaker() {
    let r; try { r = await api('GET', `/guilds/${S.gid}/members/${S.me.id}/roles`); } catch (x) { toast(x.message, true); return; }
    const roles = r.roles.filter((x) => x.can);
    modalForm('Role picker', `<label>Message<input id="rpt" value="Pick your roles:"></label><label>Roles people can give themselves</label><div class="rplist">${roles.map((x) => `<label class="rpr"><input type="checkbox" value="${x.id}"><i style="background:${x.color || '#99aab5'}"></i>${esc(x.name)}</label>`).join('') || '<div class="note">V1 can\'t assign any roles here.</div>'}</div><div class="mtext">Posts buttons; pressing one gives or removes that role.</div>`, 'Post', async (b) => {
      const ids = [...b.querySelectorAll('.rplist input:checked')].map((x) => x.value); if (!ids.length) throw new Error('Pick at least one role.');
      await api('POST', `/channels/${S.cid}/rolepicker`, { text: b.querySelector('#rpt').value, roles: ids.map((id) => ({ id })) });
    });
  }
  function signupMaker() {
    modalForm('Sign-up list', `<label>Title<input id="sut" value="Sign up"></label><label>Details<textarea id="sud" rows="3"></textarea></label><label>Spots (0 = no limit)<input id="sum" type="number" min="0" value="0"></label><div class="mtext">Posts a list with Join and Leave buttons that update live.</div>`, 'Post', async (b) => {
      await api('POST', `/channels/${S.cid}/signup`, { title: b.querySelector('#sut').value, desc: b.querySelector('#sud').value, max: +b.querySelector('#sum').value });
    });
  }
  function openPollMaker() {
    const box = document.createElement('div'); box.className = 'modal';
    box.innerHTML = `<div class="mcard"><h2>Create a poll</h2><label>Question<input id="pq" maxlength="300" placeholder="What question do you want to ask?"></label>
      <label>Answers</label><div id="pans"></div><button class="link" id="padd">Add another answer</button>
      <div class="prow"><label>Duration<select id="pdur"><option value="1">1 hour</option><option value="4">4 hours</option><option value="8">8 hours</option><option value="24" selected>24 hours</option><option value="72">3 days</option><option value="168">1 week</option><option value="336">2 weeks</option></select></label>
      <label class="chk"><input type="checkbox" id="pmulti"> Allow multiple answers</label></div>
      <div class="mact"><button class="sec" id="pcancel">Cancel</button><button id="ppost">Post</button></div></div>`;
    document.body.append(box);
    const addAns = () => { if ($('#pans').children.length >= 10) return; const i = document.createElement('input'); i.maxLength = 55; i.placeholder = 'Type your answer'; $('#pans').append(i); i.focus(); };
    addAns(); addAns(); $('#pq').focus();
    $('#padd').onclick = addAns;
    const close = () => box.remove();
    $('#pcancel').onclick = close; box.onmousedown = (e) => { if (e.target === box) close(); };
    box.onkeydown = (e) => { if (e.key === 'Escape') close(); };
    $('#ppost').onclick = async () => {
      const question = $('#pq').value.trim(), answers = [...$('#pans').children].map((i) => i.value.trim()).filter(Boolean);
      if (!question || answers.length < 1) { toast('Add a question and at least one answer', true); return; }
      try { await api('POST', `/channels/${S.cid}/messages`, { poll: { question, answers, hours: +$('#pdur').value, multi: $('#pmulti').checked } }); close(); } catch (x) { toast(x.message, true); }
    };
  }
  $('#file').onchange = (e) => { addFiles([...e.target.files]); e.target.value = ''; };
  $('#emo').innerHTML = I.smile;
  $('#emo').onclick = () => openExpr('emoji');
  // SilentMessageToggle
  const silentBtn = document.createElement('button'); silentBtn.type = 'button'; silentBtn.className = 'ico'; silentBtn.title = 'Silent message (no notification)';
  const paintSilent = () => { silentBtn.innerHTML = S.silent ? I.bellOff : I.bell; silentBtn.classList.toggle('off', S.silent); };
  silentBtn.onclick = () => { S.silent = !S.silent; paintSilent(); }; paintSilent();
  $('#emo').before(silentBtn);
  const mkBtn = (icon, title, fn, extra) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ico' + (extra ? ' xbtn' : ''); b.title = title; b.innerHTML = icon; b.onclick = fn; silentBtn.before(b); return b; };
  silentBtn.classList.add('xbtn');
  mkBtn(I.clock, 'Insert a timestamp', (e) => { // SendTimestamps
    const now = Math.floor(Date.now() / 1000);
    menu(e, [['Short time', 't'], ['Long time', 'T'], ['Short date', 'd'], ['Long date', 'D'], ['Date and time', 'f'], ['Relative', 'R']].map(([l, f]) => [`${l}: ${fmtStamp(now, f)}`, () => insert(`<t:${now}:${f}> `)]));
  }, true);
  silentBtn.after(Object.assign(document.createElement('span'), { hidden: true }));
  mkBtn(I.gif, 'GIFs', () => openExpr('gif'));
  mkBtn(I.sticker, 'Stickers', () => openExpr('sticker'), true);
  function insert(s) { const a = ta.selectionStart, b = ta.selectionEnd; ta.value = ta.value.slice(0, a) + s + ta.value.slice(b); ta.selectionStart = ta.selectionEnd = a + s.length; ta.focus(); autosize(); }

  // ------------------------------------------------------------------ autocomplete (@ members, # channels, : emoji)
  let ac = null;
  function autocomplete() {
    const pos = ta.selectionStart, before = ta.value.slice(0, pos);
    const mt = /(^|\s)([@#:])([^\s@#:]{0,32})$/.exec(before);
    if (!mt || (mt[2] === ':' && mt[3].length < 2)) { closeAc(); return; }
    const kind = mt[2], q = mt[3].toLowerCase(), start = pos - mt[3].length - 1;
    let items = [];
    if (kind === '@') {
      const ms = S.members.get(S.gid)?.members || (S.gid === DMG ? S.dms.map((d) => d.user) : []);
      items = ms.filter((m) => m.name.toLowerCase().includes(q) || m.username?.toLowerCase().includes(q))
        .sort((a, b) => (b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q)) || ((a.status === 'offline') - (b.status === 'offline')))
        .slice(0, 10).map((m) => ({ html: `<img src="${esc(m.avatar)}" alt=""><span style="${m.color ? `color:${m.color}` : ''}">${esc(m.name)}</span><span class="u">${esc(m.username || '')}</span>`, text: `@${m.name} `, alias: ['@' + m.name, `<@${m.id}>`] }));
      for (const r of Object.entries(S.guilds.get(S.gid)?.roles || {}).filter(([, r]) => r.name.toLowerCase().includes(q) && r.name !== '@everyone').slice(0, 4))
        items.push({ html: `<span style="${r[1].color ? `color:${r[1].color}` : ''}">@${esc(r[1].name)}</span><span class="u">role</span>`, text: `@${r[1].name} `, alias: ['@' + r[1].name, `<@&${r[0]}>`] });
    } else if (kind === '#') {
      items = (S.guilds.get(S.gid)?.channels || []).filter((c) => c.type !== CH.CAT && c.name.toLowerCase().includes(q)).slice(0, 10)
        .map((c) => ({ html: `${isVoice(c) ? I.speaker : I.hash}<span>${esc(c.name)}</span>`, text: `#${c.name} `, alias: ['#' + c.name, `<#${c.id}>`] }));
    } else {
      const here = S.guilds.get(S.gid)?.emojis || [];
      const uni = Object.entries(NAMES).filter(([n]) => n.startsWith(q)).sort((a, b) => score(b[1]) - score(a[1]) || a[0].length - b[0].length).slice(0, 8)
        .map(([n, ch]) => ({ html: `<span class="ue big">${ch}</span><span>:${esc(n)}:</span>`, text: ch }));
      items = [...uni, ...[...here, ...allEmojis().filter((e) => !here.includes(e))].filter((e) => e.name.toLowerCase().includes(q)).slice(0, 10)
        .map((e) => ({ html: `<img class="emoji" src="https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? 'gif' : 'webp'}?size=48" alt=""><span>:${esc(e.name)}:</span>`, text: `<${e.animated ? 'a' : ''}:${e.name}:${e.id}> ` }))].slice(0, 12);
    }
    if (!items.length) { closeAc(); return; }
    ac = { items, i: 0, start, end: pos };
    const el = $('#ac');
    el.innerHTML = `<h4>${kind === '@' ? 'Members' : kind === '#' ? 'Channels' : 'Emoji'}</h4>` + items.map((x, i) => `<div class="it${i === 0 ? ' on' : ''}" data-i="${i}">${x.html}</div>`).join('');
    el.hidden = false; twe(el);
  }
  function acPick(i) {
    const x = ac.items[i];
    ta.value = ta.value.slice(0, ac.start) + x.text + ta.value.slice(ac.end);
    const p = ac.start + x.text.length; ta.setSelectionRange(p, p);
    if (x.alias) S.aliases.set(x.alias[0], x.alias[1]);
    closeAc(); ta.focus(); autosize();
  }
  function acKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); ac.i = (ac.i + (e.key === 'ArrowDown' ? 1 : -1) + ac.items.length) % ac.items.length; for (const el of $('#ac').querySelectorAll('.it')) el.classList.toggle('on', +el.dataset.i === ac.i); return true; }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); acPick(ac.i); return true; }
    if (e.key === 'Escape') { closeAc(); return true; }
    return false;
  }
  function closeAc() { ac = null; $('#ac').hidden = true; }
  $('#ac').addEventListener('mousedown', (e) => { const it = e.target.closest('.it'); if (it) { e.preventDefault(); acPick(+it.dataset.i); } });

  // drag and drop
  let dragDepth = 0;
  addEventListener('dragenter', (e) => { if (e.dataTransfer?.types.includes('Files')) { dragDepth++; $('#drop').hidden = false; } });
  addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#drop').hidden = true; } });
  addEventListener('dragover', (e) => e.preventDefault());
  addEventListener('drop', (e) => { e.preventDefault(); dragDepth = 0; $('#drop').hidden = true; if (e.dataTransfer?.files.length) addFiles([...e.dataTransfer.files]); });

  // ------------------------------------------------------------------ popovers, menus, emoji picker
  let onPopClose = null;
  function showPop(x, y, html) {
    hidePop();
    const p = $('#pop'); p.innerHTML = html; p.hidden = false;
    const w = p.offsetWidth, h = p.offsetHeight;
    p.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px';
    p.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + 'px';
    return p;
  }
  function hidePop() { const p = $('#pop'); if (p.hidden) return; p.hidden = true; p.onclick = null; onPopClose?.(); onPopClose = null; }
  addEventListener('mousedown', (e) => { if (!$('#pop').hidden && !e.target.closest('#pop, #cmenu')) hidePop(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePop(); });
  addEventListener('contextmenu', (e) => { if (!e.target.closest('input, textarea, #log, #chans, #members, .menu')) e.preventDefault(); });
  const MI = [[/^Profile/, 'people1'], [/^Mention/, 'at'], [/^Message$|Open Chat/, 'chat'], [/^Roles/, 'shield'], [/Nickname/, 'edit'], [/^Timeout|timeout/, 'clock'], [/^Kick/, 'kick'], [/^Ban/, 'hammer'],
    [/Copy .*ID/, 'idcard'], [/^Reply/, 'reply'], [/Reaction/, 'smile'], [/^Edit/, 'edit'], [/^Copy Text|^Copy$/, 'copy'], [/Pin/, 'pin'], [/^Translate/, 'translate'], [/^Forward/, 'fwdi'],
    [/^Leave Thread/, 'leave'], [/^(Create|Open|View) Thread/, 'threads'], [/^Delete|^Purge|Remove timeout|Remove from history|Remove Message History/, 'trash'], [/Mark As Read/, 'read'], [/Copy .*Link|Copy Link/, 'link'], [/^Invite/, 'invite'], [/Settings/, 'gear'], [/^Create Channel/, 'plus'],
    [/^Create Category/, 'folder'], [/^Upload/, 'file'], [/Poll/, 'poll'], [/Embed/, 'embed'], [/Sticker/, 'sticker'], [/TTS/, 'speakerS'], [/Embeds/, 'embed'], [/Send As/, 'people1'], [/^Join/, 'speakerS'],
    [/^Disconnect/, 'leave'], [/^Publish/, 'announceS'], [/^Search Image/, 'search'], [/^Open Image/, 'image'], [/Emoji/, 'smile'], [/Add to Favourites|Remove from Favourites/, 'star'], [/^Pin$|^Unpin$/, 'pin']];
  const menuIcon = (l) => { for (const [re, k] of MI) if (re.test(l)) return I[k] || ''; return ''; };
  const cm = document.createElement('div'); cm.id = 'cmenu'; cm.hidden = true; document.body.append(cm);
  let onMenuClose = null;
  const hideMenu = () => { if (cm.hidden) return false; cm.hidden = true; cm.onclick = null; onMenuClose?.(); onMenuClose = null; return true; };
  addEventListener('mousedown', (e) => {
    if (cm.hidden || e.target.closest('#cmenu')) return;
    hideMenu();
    if (!e.target.closest('#pop')) hidePop();
  }, true);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && hideMenu()) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  function menu(e, items, onClose) {
    if (!PREF.devMode) items = items.filter(([l]) => !/ ID$/.test(l || ''));
    const html = '<div class="menu">' + items.map(([label, fn, cls], i) => label === '-' ? '<hr>' : label === '__vol'
      ? `<label>User Volume <span id="gv">${Math.round(Voice.gain(fn) * 100)}%</span><input type="range" min="0" max="300" value="${Math.round(Voice.gain(fn) * 100)}" id="gain" data-uid="${fn}"></label>`
      : `<button data-i="${i}" class="${cls || ''}"><span>${esc(label)}</span>${menuIcon(label)}</button>`).join('') + '</div>';
    hideMenu();
    cm.innerHTML = html; cm.hidden = false;
    const w = cm.offsetWidth, h = cm.offsetHeight;
    cm.style.left = Math.max(8, Math.min(e.clientX, innerWidth - w - 8)) + 'px';
    cm.style.top = Math.max(8, Math.min(e.clientY, innerHeight - h - 8)) + 'px';
    onMenuClose = onClose;
    const p = cm;
    const g = $('#gain', p); if (g) g.oninput = () => { $('#gv').textContent = g.value + '%'; Voice.setGain(g.dataset.uid, g.value / 100); }; // VolumeBooster: up to 300%
    p.onclick = (ev) => { const b = ev.target.closest('button[data-i]'); if (!b) return; hideMenu(); items[+b.dataset.i][1](); };
  }

  const COMMON = '👍 👎 😂 🤣 😭 💀 🔥 ❤️ 😍 🥺 😳 😎 🤔 🙄 😡 😢 😮 😅 🙏 👀 💯 ✅ ❌ 🎉 👏 🤝 🫡 😴 🤡 🗿 ☠️ 🤓 😈 👑 ⭐ 🍔 🍕 🎮 🎵 🙃 😬 🤨 😐 🥶 🥵 🤯 😤 🫠 💔 😹 🫂 ✨ 🤍 💜 🖤'.split(' ');
  const recent = () => store.get('recentEmoji', []);
  let FAVGIFS = null;
  const gifProvider = () => store.get('gifProvider', 'klipy');
  // ---------- one expression picker like Discord's: GIFs / Stickers / Emoji tabs
  let EXPR_TAB = 'emoji';
  function openExpr(tab, btn) {
    EXPR_TAB = tab || EXPR_TAB;
    const b = $('#composer').getBoundingClientRect();
    const p = showPop(b.right - 480, b.top - 492, `<div class="expr"><div class="xtabs">${[['gif', 'GIFs'], ['sticker', 'Stickers'], ['emoji', 'Emoji']].map(([k, l]) => `<button data-x="${k}">${l}</button>`).join('')}</div><div class="xbody"></div></div>`);
    const body = p.querySelector('.xbody');
    let cleanup = null;
    const show = (k) => {
      cleanup?.(); cleanup = null; EXPR_TAB = k;
      for (const t of p.querySelectorAll('[data-x]')) t.classList.toggle('on', t.dataset.x === k);
      if (k === 'gif') cleanup = gifTab(body);
      if (k === 'sticker') stickerTab(body);
      if (k === 'emoji') emojiTab(body, (key, raw) => insert(raw));
    };
    p.querySelector('.xtabs').onclick = (e) => { const t = e.target.closest('[data-x]'); if (t) show(t.dataset.x); };
    onPopClose = () => cleanup?.();
    show(EXPR_TAB);
  }
  function sendQuick(payload) {
    api('POST', `/channels/${S.cid}/messages`, { nonce: String(BigInt(Date.now() - 1420070400000) << 22n), replyTo: S.reply?.id, ping: S.ping, ...payload }).catch((x) => toast('Not sent: ' + x.message, true));
    cancelReply();
  }
  function stickerTab(root) {
    const groups = [S.guilds.get(S.gid), ...[...S.guilds.values()].filter((g) => g.id !== S.gid)].filter((g) => g?.stickers?.length);
    root.innerHTML = `<input class="xsearch" placeholder="Find the perfect sticker"><div class="xscroll"><div class="sgrid"></div></div>`;
    const grid = root.querySelector('.sgrid');
    const fill = (q) => {
      q = q.toLowerCase();
      grid.innerHTML = groups.map((g) => { const l = g.stickers.filter((x) => !q || x.name.toLowerCase().includes(q)); return l.length ? `<h4>${esc(g.name)}</h4>` + l.map((x) => `<button data-st="${x.id}" data-g="${g.id}" title="${esc(x.name)}"><img src="${esc(x.url)}" alt="" loading="lazy" decoding="async"></button>`).join('') : ''; }).join('') || '<div class="empty">No stickers</div>';
    };
    fill('');
    const inp = root.querySelector('.xsearch'); inp.oninput = () => fill(inp.value); inp.focus();
    grid.onclick = (e) => {
      const x = e.target.closest('[data-st]'); if (!x) return;
      if (x.dataset.g !== S.gid) { toast('Bots can only send stickers from the server they are in. Pick one from this server.', true); return; }
      hidePop(); sendQuick({ stickers: [x.dataset.st] });
    };
  }
  function gifTab(root) {
    root.innerHTML = `<div class="gtop"><input class="xsearch" id="gq" placeholder="Search ${{ klipy: 'Klipy', tenor: 'Tenor', giphy: 'GIPHY' }[gifProvider()]}"><select id="gprov">${[['klipy', 'Klipy'], ['tenor', 'Tenor'], ['giphy', 'GIPHY']].map(([v, l]) => `<option value="${v}"${v === gifProvider() ? ' selected' : ''}>${l}</option>`).join('')}</select></div><div class="xscroll" id="gg"><div class="empty">Loading</div></div>`;
    const grid = root.querySelector('#gg');
    const io = new IntersectionObserver((ents) => {
      for (const en of ents) { if (en.isIntersecting) playCapped(en.target); else stopCapped(en.target); }
    }, { root: grid, rootMargin: '0px' });
    const mo = new MutationObserver(() => { for (const v of grid.querySelectorAll('video[data-src]:not([data-w])')) { v.dataset.w = 1; io.observe(v); } });
    mo.observe(grid, { childList: true, subtree: true });
    const media = (src) => `<img src="${esc(/\.(mp4|webm)(\?|$)/.test(src) ? gifImg(src, 220) : src)}" alt="" loading="lazy" decoding="async">`;
    const tile = (g, fav) => `<div class="gtile" data-gurl="${esc(g.url)}" data-gsrc="${esc(g.src)}" data-w="${g.w || 0}" data-h="${g.h || 0}" style="${g.w && g.h ? `aspect-ratio:${g.w}/${g.h}` : ''}">${media(g.gif || g.src)}<button class="gstar${fav ? ' on' : ''}" title="${fav ? 'Remove from Favourites' : 'Add to Favourites'}">${I.star}</button></div>`;
    const favSet = () => new Set((FAVGIFS || []).map((x) => x.url));
    const showHome = async () => {
      if (!FAVGIFS) FAVGIFS = (await api('GET', '/gifs/favs').catch(() => ({ gifs: [] }))).gifs;
      let t = { categories: [] }; try { t = await api('GET', `/gifs/trending?provider=${gifProvider()}`); } catch { /* offline */ }
      const fav0 = FAVGIFS[0];
      grid.innerHTML = `<div class="gcats"><div class="gcat fav" data-cat="__fav">${fav0 ? media(fav0.src) : ''}<span>${I.star} Favourites</span></div>${t.categories.map((c) => `<div class="gcat" data-cat="${esc(c.name)}">${media(c.src)}<span>${esc(c.name)}</span></div>`).join('')}</div>`;
    };
    let pending = [];
    const more = () => { if (!pending.length) return; const fs2 = favSet(); grid.querySelector('.gcol')?.insertAdjacentHTML('beforeend', pending.splice(0, 40).map((g) => tile(g, fs2.has(g.url))).join('')); };
    const showList = (list) => { grid.scrollTop = 0; pending = list.slice(); grid.innerHTML = list.length ? '<div class="gcol"></div>' : '<div class="empty">Nothing found</div>'; more(); };
    grid.addEventListener('scroll', () => { if (grid.scrollTop + grid.clientHeight > grid.scrollHeight - 400) more(); }, { passive: true });
    const search = async (q) => { grid.innerHTML = '<div class="empty">Searching</div>'; try { showList((await api('GET', `/gifs/search?provider=${gifProvider()}&q=${encodeURIComponent(q)}`)).gifs); } catch (x) { grid.innerHTML = `<div class="empty">${esc(x.message)}</div>`; } };
    showHome();
    const inp = root.querySelector('#gq');
    let st; inp.oninput = () => { clearTimeout(st); const q = inp.value.trim(); st = setTimeout(() => (q ? search(q) : showHome()), 300); };
    inp.focus();
    root.querySelector('#gprov').onchange = (e) => { store.set('gifProvider', e.target.value); const q = inp.value.trim(); q ? search(q) : showHome(); };
    grid.onclick = async (e) => {
      const c = e.target.closest('[data-cat]');
      if (c) { if (c.dataset.cat === '__fav') showList(FAVGIFS); else { inp.value = c.dataset.cat; search(c.dataset.cat); } return; }
      const t = e.target.closest('.gtile'); if (!t) return;
      if (e.target.closest('.gstar')) {
        e.stopPropagation();
        const on2 = favSet().has(t.dataset.gurl);
        const r = on2 ? await api('DELETE', `/gifs/favs?url=${encodeURIComponent(t.dataset.gurl)}`) : await api('POST', '/gifs/favs', { url: t.dataset.gurl, src: t.dataset.gsrc, w: +t.dataset.w, h: +t.dataset.h });
        FAVGIFS = r.gifs; e.target.closest('.gstar').classList.toggle('on', !on2); return;
      }
      hidePop(); sendQuick({ content: t.dataset.gurl });
    };
    return () => { io.disconnect(); mo.disconnect(); for (const v of root.querySelectorAll('video')) stopCapped(v); for (const im of root.querySelectorAll('img')) { animIO.unobserve(im); im.src = BLANK; } root.innerHTML = ''; };
  }
  // ---------- emoji picker: frecency, favourites, ranked search, skin tones, keyboard, preview
  const FREQ = store.get('emojiFreq', {});
  const FAVE = new Set(store.get('emojiFav', []));
  const TONES = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'];
  const toneOf = () => store.get('skinTone', 0);
  const withTone = (u, skin) => { const t = toneOf(); if (!skin || !t) return u; const cps = [...u]; return cps[0] + TONES[t] + cps.slice(1).join('').replace(/^️/, ''); };
  const score = (k) => { const f = FREQ[k]; return f ? f.n * Math.pow(0.5, (Date.now() - f.t) / (7 * 864e5)) : 0; };
  const used = (k) => { const f = FREQ[k] || { n: 0, t: 0 }; f.n++; f.t = Date.now(); FREQ[k] = f; store.set('emojiFreq', FREQ); };
  function emojiItems() {
    const out = [];
    const order = [S.guilds.get(S.gid), ...[...S.guilds.values()].filter((g) => g.id !== S.gid)].filter(Boolean);
    for (const g of order) for (const e of g.emojis) out.push({ key: `${e.name}:${e.id}`, raw: `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`, name: e.name, words: [e.name.toLowerCase()], img: `https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? 'gif' : 'webp'}?size=48`, sec: 'g:' + g.id, src: g.name });
    for (const c of CATS) for (const [u, n, skin, ...more] of c.list) out.push({ key: u, raw: u, uni: u, skin, name: n, words: [n, ...more].map((x) => String(x).toLowerCase()), sec: 'c:' + c.cat.split(' ')[0], src: c.cat });
    return out;
  }
  function emojiTab(root, pick) {
    const items = emojiItems(), byKey = new Map(items.map((x) => [x.key, x]));
    const guilds = [S.guilds.get(S.gid), ...[...S.guilds.values()].filter((g) => g.id !== S.gid)].filter((g) => g?.emojis.length);
    const catIcons = { Smileys: '😀', People: '👋', Animals: '🐱', Food: '🍔', Travel: '✈️', Activities: '⚽', Objects: '💡', Symbols: '❤️', Flags: '🏳️' };
    root.innerHTML = `<div class="etop"><input class="xsearch" placeholder="Find the perfect emoji"><button class="tonebtn" title="Skin tone">${withTone('👋', 1)}</button></div>
      <div class="ewrap"><nav class="eside">${FAVE.size ? `<button data-go="fav" title="Favourites">${I.star}</button>` : ''}<button data-go="freq" title="Frequently used">${I.clock}</button>
        ${guilds.map((g) => `<button data-go="g:${g.id}" title="${esc(g.name)}">${g.icon ? `<img src="${esc(g.icon)}" alt="">` : esc(g.name.slice(0, 2))}</button>`).join('')}<hr>
        ${Object.entries(catIcons).map(([k, i]) => `<button data-go="c:${k}" title="${k}" class="ue">${i}</button>`).join('')}</nav>
      <div class="xscroll"><div class="egrid2"></div></div></div><div class="eprev"></div>`;
    const grid = root.querySelector('.egrid2'), inp = root.querySelector('.xsearch'), prev = root.querySelector('.eprev'), scroller = root.querySelector('.xscroll');
    const cell = (x) => `<button data-k="${esc(x.key)}" title=":${esc(x.name)}:">${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy" decoding="async">` : withTone(x.uni, x.skin)}</button>`;
    let flat = [], sel = -1;
    const fill = (q) => {
      q = q.trim().toLowerCase().replace(/^:|:$/g, '');
      let html = '';
      if (q) { // ranked: exact, starts-with, word starts-with, contains; then by how much you use it
        const rank = (x) => { let r = 0; for (const w of x.words) { if (w === q) r = Math.max(r, 4); else if (w.startsWith(q)) r = Math.max(r, 3); else if (w.split(/[_-]/).some((p2) => p2.startsWith(q))) r = Math.max(r, 2); else if (w.includes(q)) r = Math.max(r, 1); } return r; };
        flat = items.map((x) => [x, rank(x)]).filter(([, r]) => r).sort((a2, b2) => b2[1] - a2[1] || score(b2[0].key) - score(a2[0].key) || a2[0].name.length - b2[0].name.length).slice(0, 180).map(([x]) => x);
        html = flat.length ? `<h4>Results</h4>${flat.map(cell).join('')}` : '<div class="empty">No emoji found</div>';
      } else {
        const fav = [...FAVE].map((k) => byKey.get(k)).filter(Boolean);
        const freq = Object.keys(FREQ).filter((k) => byKey.has(k)).sort((a2, b2) => score(b2) - score(a2)).slice(0, 27).map((k) => byKey.get(k));
        flat = [];
        const sec = (id, title, list) => { if (!list.length) return ''; flat.push(...list); return `<h4 data-sec="${id}">${esc(title)}</h4>${list.map(cell).join('')}`; };
        html += sec('fav', 'Favourites', fav) + sec('freq', 'Frequently Used', freq);
        for (const g of guilds) html += sec('g:' + g.id, g.name, items.filter((x) => x.sec === 'g:' + g.id));
        for (const c of CATS) html += sec('c:' + c.cat.split(' ')[0], c.cat, items.filter((x) => x.sec === 'c:' + c.cat.split(' ')[0]));
      }
      grid.innerHTML = html; sel = q && flat.length ? 0 : -1; paintSel();
    };
    const paintSel = () => { const btns = grid.querySelectorAll('[data-k]'); btns.forEach((b2, i) => b2.classList.toggle('sel', i === sel)); if (sel >= 0) { btns[sel]?.scrollIntoView({ block: 'nearest' }); showPrev(btns[sel]?.dataset.k); } };
    const showPrev = (k) => { const x = byKey.get(k); prev.innerHTML = x ? `<span class="pbig">${x.img ? `<img src="${esc(x.img)}" alt="">` : withTone(x.uni, x.skin)}</span><b>:${esc(x.name)}:</b><span class="psrc">${esc(x.src)}</span>${FAVE.has(x.key) ? I.star : ''}` : ''; };
    const choose = (k, keep) => { const x = byKey.get(k); if (!x) return; used(k); if (!keep) hidePop(); pick(k, x.uni ? withTone(x.uni, x.skin) : x.raw); };
    fill('');
    inp.oninput = () => fill(inp.value); inp.focus();
    inp.onkeydown = (e) => {
      const n = flat.length; if (!n) return;
      const cols = 9;
      if (e.key === 'ArrowRight') { sel = Math.min(n - 1, sel + 1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { sel = Math.max(0, sel - 1); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { sel = Math.min(n - 1, sel < 0 ? 0 : sel + cols); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - cols); e.preventDefault(); }
      else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); choose(grid.querySelectorAll('[data-k]')[sel].dataset.k, e.shiftKey); return; }
      else return;
      paintSel();
    };
    grid.onmouseover = (e) => { const b2 = e.target.closest('[data-k]'); if (b2) showPrev(b2.dataset.k); };
    grid.onclick = (e) => { const b2 = e.target.closest('[data-k]'); if (b2) choose(b2.dataset.k, e.shiftKey); }; // shift-click keeps it open, like Discord
    grid.oncontextmenu = (e) => { // right-click: favourite (FavoriteEmojiFirst)
      const b2 = e.target.closest('[data-k]'); if (!b2) return; e.preventDefault(); e.stopPropagation();
      const k = b2.dataset.k; FAVE.has(k) ? FAVE.delete(k) : FAVE.add(k); store.set('emojiFav', [...FAVE]); toast(FAVE.has(k) ? 'Added to favourite emoji' : 'Removed from favourite emoji'); showPrev(k);
    };
    root.querySelector('.eside').onclick = (e) => { const b2 = e.target.closest('[data-go]'); if (!b2) return; if (inp.value) { inp.value = ''; fill(''); } grid.querySelector(`[data-sec="${b2.dataset.go}"]`)?.scrollIntoView({ block: 'start' }); };
    root.querySelector('.tonebtn').onclick = (e) => {
      e.stopPropagation();
      const bar = document.createElement('div'); bar.className = 'tonebar';
      bar.innerHTML = TONES.map((t, i) => `<button data-t="${i}" class="ue">${i ? '👋' + t : '👋'}</button>`).join('');
      root.querySelector('.etop').append(bar);
      bar.onclick = (ev) => { const b2 = ev.target.closest('[data-t]'); if (!b2) return; store.set('skinTone', +b2.dataset.t); bar.remove(); root.querySelector('.tonebtn').textContent = withTone('👋', 1); fill(inp.value); };
    };
  }
  function openPicker(x, y, pick) { // reactions: emoji only
    const p = showPop(x, y, '<div class="expr small"><div class="xbody"></div></div>');
    emojiTab(p.querySelector('.xbody'), (k, raw) => pick(k.includes(':') ? k : raw, raw));
    return p;
  }

  // ------------------------------------------------------------------ voice
  async function joinVoice(vcId) {
    if (S.voice?.channelId === vcId) { openChannel(vcId); return; }
    try {
      S.joining = vcId; renderVoice();
      await Voice.join(vcId, wsSend, () => ws);
    } catch (e) { toast('Voice: ' + (e.message || e), true); report('voice join: ' + (e.message || e)); S.joining = null; Voice.ended(); renderVoice(); }
  }
  async function shareAudioMenu(btn) {
    const r = btn.getBoundingClientRect();
    if (S.sharing) { await invoke('share_audio', { id: null }); S.sharing = null; renderCall(); toast('Stopped sharing audio'); return; }
    const apps = await invoke('audio_apps').catch(() => []);
    if (!apps.length) { toast('No app is playing audio right now. Start playback, then try again.'); return; }
    menu({ clientX: r.left, clientY: r.top - 40 * Math.min(apps.length, 8) - 20 }, apps.map((x) => [`${x.app || 'App'}${x.media ? ' · ' + x.media.slice(0, 40) : ''}`, async () => {
      try { await invoke('share_audio', { id: x.id }); S.sharing = x.app || 'audio'; renderCall(); toast(`Sharing ${S.sharing} into the call`); } catch (e) { toast(String(e), true); }
    }]));
  }
  function leaveVoice() {
    if (S.sharing) { invoke('share_audio', { id: null }); S.sharing = null; } Voice.leave(wsSend); if (!S.voice) { S.joining = null; renderVoice(); } }
  function onVoiceState(v, why) {
    const was = S.voice;
    S.voice = v; S.joining = null;
    if (v && !was) { S.voiceSince = Date.now(); if (Voice.whenReady) Voice.whenReady().then(() => setTimeout(() => sfx('connect'), 150)); else sfx('connect'); }
    if (!v && was) sfx('disconnect');
    if (!v && S.sharing) { invoke('share_audio', { id: null }); S.sharing = null; }
    if (!v) { if (Voice.active) Voice.ended(); S.speaking.clear(); S.selfSpeaking = false; if (why && why !== 'left' && was) toast('Voice ' + why); }
    renderVoice(); renderChannels(); renderCall();
  }
  function renderVoice() {
    const on = !!S.voice || !!S.joining;
    $('#vbar').hidden = !on;
    $('#side').classList.toggle('invc', on);
    $('#bmute').innerHTML = Voice.muted ? I.micOff : I.mic; $('#bmute').classList.toggle('off', Voice.muted);
    $('#bdeaf').innerHTML = Voice.deaf ? I.headOff : I.head; $('#bdeaf').classList.toggle('off', Voice.deaf);
    $('#bset').innerHTML = I.gear;
    $('#vleave').innerHTML = I.leave;
    if (!on) return;
    const vcId = S.voice?.channelId || S.joining;
    const c = chan(vcId), g = guildOf(vcId);
    const ready = S.voice?.status === 'ready';
    $('#vstatus').textContent = ready ? 'Voice Connected' : 'Connecting';
    $('#vstatus').classList.toggle('wait', !ready);
    $('#vname').textContent = `${c?.name ?? ''} / ${g?.name ?? ''}`;
    twe($('#vname'));
  }
  function callTimer() { // CallTimer
    if (!S.voice) return;
    if (!on('CallTimer')) { $('#vping').textContent = S.rtt != null ? S.rtt + ' ms' : ''; return; }
    const s = Math.floor((Date.now() - S.voiceSince) / 1000);
    const t = `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ':' : ''}${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    $('#vping').textContent = `${S.rtt != null ? S.rtt + ' ms · ' : ''}${t}`;
  }
  setInterval(() => { if (S.voice) { wsSend({ t: 'ping', at: performance.now() }); } }, 3000);
  setInterval(callTimer, 1000);
  const keyLabel = (k) => ({ Backquote: '`', Space: 'Space', CapsLock: 'Caps Lock', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5', Mouse1: 'Middle Click' }[k] || k.replace(/^Key|^Digit/, ''));
  Voice.on(() => { renderVoice(); paintSpeaking(); paintVset(); });
  for (const [btn, kind] of [['#bmute', 'input'], ['#bdeaf', 'output']]) {
    const c = document.createElement('button'); c.className = 'caret'; c.innerHTML = I.caret; c.title = kind === 'input' ? 'Input device' : 'Output device';
    $(btn).after(c);
    c.onclick = async (e) => {
      if (!NATIVE) return;
      const dev = await invoke('audio_devices').catch(() => ({ inputs: [], outputs: [] }));
      const list = (kind === 'input' ? dev.inputs : dev.outputs).filter((n) => !/^(hw|plughw|dsnoop|dmix|sysdefault|front|surround|iec958|hdmi|usbstream|null|lavrate|samplerate|speexrate|upmix|vdownmix|jack|oss|speex)/.test(n));
      const cur = store.get('devices', {})[kind];
      menu(e, [['Default', null], ...list.map((n) => [n, n])].map(([l, v]) => [(cur === v || (!cur && !v) ? '✓ ' : '') + l, () => { const d = store.get('devices', {}); d[kind] = v; store.set('devices', d); Voice.devices?.(d); toast('Applies the next time you join a call'); }]));
    };
  }
  $('#bmute').onclick = () => { Voice.muted = !Voice.muted; sfx(Voice.muted ? 'mute' : 'unmute'); };
  $('#bdeaf').onclick = () => { Voice.deaf = !Voice.deaf; sfx(Voice.deaf ? 'deafen' : 'undeafen'); };
  let wasSending = false;
  Voice.on(() => { if (Voice.mode === 'ptt' && Voice.sending !== wasSending) sfx(Voice.sending ? 'pttOn' : 'pttOff'); wasSending = Voice.sending; });
  $('#vleave').onclick = leaveVoice;
  $('#bset').onclick = () => openSettingsPage('voice');
  function openSettings(btn) {
    const b = btn.getBoundingClientRect();
    const p = showPop(b.left - 120, b.top - 380, `<div class="vset">
      <h4>Input mode</h4><div class="seg"><button data-m="open">Voice Activity</button><button data-m="ptt">Push to Talk</button></div>
      <div id="vs-ptt"><h4 style="margin-bottom:8px">Shortcut</h4><button class="keybtn" id="vs-key"></button>${Voice.native ? '' : '<div class="note" style="margin-top:6px">Works only while this window is focused.</div>'}</div>
      <div id="vs-open"><h4 style="margin-bottom:8px">Sensitivity</h4><div class="meter"><i id="vs-level"></i><b id="vs-thr"></b></div><input type="range" min="-80" max="-10" step="1" id="vs-range" style="margin-top:8px"></div>
      <h4>Chat</h4><label class="note" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="vs-st"> Silent typing (others don't see you typing)</label>
    </div>`);
    p.querySelector('.seg').onclick = (e) => { const m = e.target.closest('[data-m]'); if (m) Voice.mode = m.dataset.m; };
    $('#vs-key').onclick = () => { S.binding = true; paintVset(); };
    $('#vs-range').value = Voice.threshold;
    $('#vs-range').oninput = (e) => { Voice.threshold = +e.target.value; paintVset(); };
    $('#vs-st').checked = S.silentTyping;
    $('#vs-st').onchange = (e) => { S.silentTyping = e.target.checked; store.set('silentTyping', S.silentTyping); };
    paintVset();
  }
  function paintVset() {
    if (!$('#vs-key')) return;
    for (const b of document.querySelectorAll('.seg [data-m]')) b.classList.toggle('on', b.dataset.m === Voice.mode);
    $('#vs-ptt').hidden = Voice.mode !== 'ptt'; $('#vs-open').hidden = Voice.mode !== 'open';
    $('#vs-key').textContent = S.binding ? 'Press a key or mouse button' : keyLabel(Voice.key);
    $('#vs-key').classList.toggle('wait', !!S.binding);
    $('#vs-thr').style.left = ((Voice.threshold + 80) / 70 * 100) + '%';
  }
  setInterval(() => {
    if (!Voice.active) return;
    const lv = $('#vs-level'); if (!lv) return;
    lv.style.width = Math.max(0, Math.min(100, (Voice.level + 80) / 70 * 100)) + '%';
    lv.classList.toggle('open', Voice.level > Voice.threshold);
  }, 66);

  // key binding capture, and in-window push-to-talk for the browser fallback (the app does it globally)
  addEventListener('keydown', (e) => {
    if (S.binding) { e.preventDefault(); e.stopPropagation(); S.binding = false; if (e.code !== 'Escape') Voice.key = e.code; paintVset(); return; }
    if (Voice.active && Voice.mode === 'ptt' && e.code === Voice.key) {
      if (document.activeElement === ta) e.preventDefault();
      if (!e.repeat) Voice.setHeld(true);
    }
  }, true);
  addEventListener('keyup', (e) => { if (e.code === Voice.key) Voice.setHeld(false); }, true);
  addEventListener('mousedown', (e) => {
    const code = 'Mouse' + e.button;
    if (S.binding && e.button > 0 && e.button !== 2) { e.preventDefault(); e.stopPropagation(); S.binding = false; Voice.key = code; paintVset(); return; }
    if (Voice.active && Voice.mode === 'ptt' && code === Voice.key) { e.preventDefault(); Voice.setHeld(true); }
  }, true);
  addEventListener('mouseup', (e) => { if ('Mouse' + e.button === Voice.key) { Voice.setHeld(false); } }, true);
  addEventListener('auxclick', (e) => { if ('Mouse' + e.button === Voice.key) e.preventDefault(); });
  addEventListener('blur', () => Voice.setHeld(false));
  addEventListener('keydown', (e) => { if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) { e.preventDefault(); location.reload(); } });

  // ------------------------------------------------------------------ settings page (Discord-style, full screen)
  const SECTIONS = [['account', 'My Account', 'people1'], ['voice', 'Voice & Audio', 'mic'], ['chat', 'Chat', 'chat'], ['notifications', 'Notifications', 'bell'], ['appearance', 'Appearance', 'palette'], ['keybinds', 'Keybinds', 'keyboard'], ['plugins', 'Plugins', 'puzzle'], ['advanced', 'Advanced', 'code']];
  const savePrefs = () => { store.set('prefs', PREF); applyPrefs(); renderLog(); };
  const toggleRow = (id, label, checked, sub = '') => `<label class="trow"><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" class="sw" id="${id}"${checked ? ' checked' : ''}></label>`;
  async function openSettingsPage(sec = 'account') {
    hidePop();
    document.querySelector('.settings')?.remove();
    const el = document.createElement('div'); el.className = 'settings';
    el.innerHTML = `<div class="swin"><nav class="snav"><div class="sgroup">User Settings</div>${SECTIONS.map(([k, l, ic]) => `<button data-s="${k}">${I[ic] || ''}<span>${l}</span></button>`).join('')}</nav><section class="sbody"><div class="sinner" id="sin"></div><button class="sclose" title="Close (Esc)">${I.x}</button></section></div>`;
    el.onmousedown = (e) => { if (e.target === el) close(); };
    document.body.append(el);
    const close = () => { el.remove(); S.binding = false; removeEventListener('keydown', esc_); };
    const esc_ = (e) => { if (e.key === 'Escape' && !S.binding) close(); };
    addEventListener('keydown', esc_);
    el.querySelector('.sclose').onclick = close;
    el.querySelector('.snav').onclick = (e) => { const b = e.target.closest('[data-s]'); if (b) show(b.dataset.s); };
    const show = async (k) => {
      for (const b of el.querySelectorAll('.snav [data-s]')) b.classList.toggle('on', b.dataset.s === k);
      const box = $('#sin', el);
      box.innerHTML = await sectionHTML(k);
      twe(box);
      wire(k, box);
    };
    show(sec);
  }
  async function sectionHTML(k) {
    if (k === 'account') {
      const [pr, me] = await Promise.all([api('GET', '/presence').catch(() => ({ status: 'online', activity: null })), api('GET', '/me').catch(() => null)]);
      const ban = me?.banner ? `background-image:url('${esc(me.banner)}')` : `background:${me?.accent || 'var(--accent)'}`;
      return `<h1>My Account</h1><div class="acard"><div class="ban" style="${ban}"></div><div class="arow"><img src="${esc(me?.avatar || S.me.avatar)}" alt=""><div><div class="pname">${esc(S.me.name)} <span class="tag">APP</span></div><div>${esc(S.me.tag || me?.username || S.me.username)}</div></div></div>
        <div class="afields">
          <div class="frow2"><div><h5>Username</h5>${esc(me?.username || '')}</div><button class="btn sec" data-edit="username">Edit</button></div>
          <div class="frow2"><div><h5>Avatar</h5>PNG, JPG or GIF</div><button class="btn sec" data-edit="avatar">Change</button></div>
          <div class="frow2"><div><h5>Banner</h5>${me?.banner ? 'Set' : 'None'}</div><button class="btn sec" data-edit="banner">Change</button></div>
          <div class="frow2"><div><h5>About me</h5><div class="about">${me?.about ? esc(me.about) : 'Nothing yet'}</div></div><button class="btn sec" data-edit="about">Edit</button></div>
        </div></div>
        <h3>Status</h3><div class="seg four">${['online', 'idle', 'dnd', 'invisible'].map((x) => `<button data-st="${x}" class="${pr.status === x ? 'on' : ''}">${{ online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', invisible: 'Invisible' }[x]}</button>`).join('')}</div>
        <h3>Activity</h3><div class="frow"><select id="acttype">${[[0, 'Playing'], [2, 'Listening to'], [3, 'Watching'], [5, 'Competing in'], [4, 'Custom status']].map(([v, l]) => `<option value="${v}"${pr.activity?.type === v ? ' selected' : ''}>${l}</option>`).join('')}</select><input id="actname" maxlength="120" placeholder="Nothing" value="${esc(pr.activity?.name || '')}"><button class="btn" id="actsave">Save</button></div>
        <h3>Server nickname</h3><div class="frow"><select id="nickg">${[...S.guilds.values()].map((g) => `<option value="${g.id}"${g.id === S.gid ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}</select><input id="nick" maxlength="32" placeholder="${esc(S.me.username)}" value="${esc((S.guilds.get(S.gid) || [...S.guilds.values()][0])?.me?.name || '')}"><button class="btn" id="nicksave">Save</button></div>
        <div class="note">Username changes are limited by Discord to twice an hour.</div>`;
    }
    if (k === 'voice') {
      const dev = NATIVE ? await invoke('audio_devices').catch(() => ({ inputs: [], outputs: [] })) : null;
      const sel = (id, list, cur) => `<select id="${id}"><option value="">Default</option>${list.map((n) => `<option${n === cur ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
      const vs = store.get('devices', {});
      return `<h1>Voice & Audio</h1>${dev ? `<div class="two"><div><h3>Input device</h3>${sel('din', dev.inputs, vs.input)}</div><div><h3>Output device</h3>${sel('dout', dev.outputs, vs.output)}</div></div><div class="note">Device changes apply the next time you join a call.</div>` : ''}
        ${Voice.native ? `<h3>Voice processing</h3><div id="noiserow">${toggleRow('p-noise', 'Noise suppression', Voice.noise !== false, 'Removes background noise from your mic (RNNoise)')}</div>` : ''}
        <h3>Input mode</h3><div class="seg"><button data-m="open">Voice Activity</button><button data-m="ptt">Push to Talk</button></div>
        <div id="vs-ptt"><h3>Shortcut</h3><button class="keybtn" id="vs-key"></button>${Voice.native ? '<div class="note">Works everywhere, even while a game is focused.</div>' : '<div class="note">Works only while this window is focused.</div>'}</div>
        <div id="vs-open"><h3>Input sensitivity</h3><div class="meter big"><i id="vs-level"></i><b id="vs-thr"></b></div><input type="range" min="-80" max="-10" step="1" id="vs-range"><div class="note">Join a call to see your level. Anything past the white line is sent.</div></div>
        <h3>V1's own voice</h3><div id="lockrow"></div>
        <h3>People</h3><button class="btn sec" id="resetgain">Reset everyone's volume</button>`;
    }
    if (k === 'chat') {
      return `<h1>Chat</h1>${toggleRow('p-embeds', 'Show embeds and link previews', PREF.embeds)}${toggleRow('p-st', 'Silent typing', S.silentTyping, 'Others do not see you typing')}${toggleRow('p-24', '24-hour time', PREF.hour24)}`;
    }
    if (k === 'notifications') {
      return `<h1>Notifications</h1>${toggleRow('p-notif', 'Desktop notifications', on('NotificationsForDMs'), 'DMs and mentions, while the window is in the background or on another channel')}<h3>Alerts</h3><label class="lab">Keywords (one per line): notify me when anyone says these, in any channel V1 can see<textarea id="al-kw" class="ccss" rows="3" style="min-height:70px;font-family:var(--font)"></textarea></label>
        <div id="al-rows"></div>
        <h3>Notify me about</h3>${[['dm', 'Direct messages'], ['mention', '@mentions of V1'], ['reply', 'Replies to V1'], ['role', 'Mentions of V1\'s roles'], ['everyone', '@everyone and @here'], ['reaction', 'Reactions to V1\'s messages']].map(([k, l]) => toggleRow('nt-' + k, l, NT[k])).join('')}
        <div class="note">Muted channels (bell in the channel header) never notify.</div>
        <button class="btn sec" id="ntest" style="margin-top:12px">Send a test notification</button>
        <h3>Sounds <span id="sndv">${Math.round(SND.volume * 100)}%</span></h3><input type="range" min="0" max="100" id="sndvol" value="${Math.round(SND.volume * 100)}">
        <div class="snds">${SOUNDS.map(([k, l]) => `<label class="trow"><span><b>${l}</b></span><span class="sact"><button class="btn sec small" data-play="${k}">Play</button><input type="checkbox" class="sw" data-snd="${k}"${SND[k] !== false ? ' checked' : ''}></span></label>`).join('')}</div>`;
    }
    if (k === 'appearance') {
      const sw = (t, bg, side, chat) => `<button class="thm${PREF.theme === t ? ' on' : ''}" data-theme="${t}" title="${t[0].toUpperCase() + t.slice(1)}"><i style="background:${side}"></i><i style="background:${chat}"></i><span>${t[0].toUpperCase() + t.slice(1)}</span></button>`;
      return `<h1>Appearance</h1>
        <h3>Theme</h3><div class="thms">${sw('onyx', '#000', '#000', '#000')}${sw('dark', '#121214', '#1a1a1e', '#31323b')}${sw('ash', '#2c2d32', '#323339', '#313338')}</div>
        <h3>Message display</h3><div class="seg"><button data-md="cozy"${PREF.compact ? '' : ' class="on"'}>Cozy</button><button data-md="compact"${PREF.compact ? ' class="on"' : ''}>Compact</button></div>
        ${toggleRow('p-avc', 'Show avatars in compact mode', PREF.avatarsCompact)}
        <h3>Chat font size <span id="fsv">${PREF.fontSize}px</span></h3><input type="range" min="12" max="24" step="1" id="fs" value="${PREF.fontSize}">
        <h3>Space between message groups <span id="spv">${PREF.spacing}px</span></h3><input type="range" min="0" max="24" step="2" id="sp" value="${PREF.spacing}">
        <h3>Zoom level <span id="zmv">${PREF.zoom}%</span></h3><input type="range" min="50" max="200" step="10" id="zm" value="${PREF.zoom}">
        <h3>Scroll speed <span id="scv">${PREF.scroll}×</span></h3><div class="note" style="margin:-4px 0 6px">1× uses WebKit's own scrolling, which is the smoothest. Anything else is handled by the client.</div><input type="range" min="0.5" max="4" step="0.25" id="scs" value="${PREF.scroll}">
        ${toggleRow('p-smooth', 'Smooth scrolling', PREF.smooth)}
        <h3>Role colours</h3><div class="seg three"><button data-rc="names"${PREF.roleColors === 'names' ? ' class="on"' : ''}>Show in names</button><button data-rc="dot"${PREF.roleColors === 'dot' ? ' class="on"' : ''}>Show next to names</button><button data-rc="none"${PREF.roleColors === 'none' ? ' class="on"' : ''}>Don't show</button></div>
        ${toggleRow('p-members', 'Show member list', S.showMembers)}${toggleRow('p-calm', 'Reduce motion', PREF.reduceMotion, 'Turns off picker and hover animations')}
        <h3>Custom CSS</h3><textarea id="ccss" class="ccss" spellcheck="false" placeholder="/* like Vencord's QuickCSS: applies instantly */">${esc(PREF.customCss)}</textarea>`;
    }
    if (k === 'keybinds') {
      return `<h1>Keybinds</h1><div class="note" style="margin:-10px 0 14px">Click a shortcut, then press the new keys. Esc cancels, Backspace clears.</div>
        <div class="kbl"><div class="kbr"><span><b>Push to talk</b><small>${Voice.native ? 'Works everywhere, even in games' : 'Only while this window is focused'}</small></span><button class="keybtn" id="kb-ptt">${esc(keyLabel(Voice.key))}</button></div>
        ${KB_ACTIONS.map(([id, label, sub]) => `<div class="kbr"><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><button class="keybtn" data-kb="${id}">${esc(comboLabel(KB[id]))}</button></div>`).join('')}</div>
        <button class="btn sec" id="kbreset" style="margin-top:16px">Reset to defaults</button>`;
    }
    if (k === 'plugins') {
      return `<h1>Plugins</h1><div class="plugs">${PLUGINS.map(([n, d]) => `<label class="plug"><span><b>${n}</b><small>${d}</small></span><input type="checkbox" class="sw" data-pl="${n}"${on(n) ? ' checked' : ''}></label>`).join('')}</div>`;
    }
    if (k === 'advanced') {
      const auto = NATIVE ? await invoke('autostart', {}).catch(() => null) : null;
      return `<h1>Advanced</h1>${toggleRow('p-dev', 'Developer mode', PREF.devMode, 'Adds Copy ID to right-click menus')}
        ${auto !== null ? toggleRow('p-auto', 'Open V1 Client when you log in', auto) : ''}
        ${NATIVE ? toggleRow('p-gpu', 'Hardware acceleration', await invoke('gpu', {}).catch(() => true), 'Renders on the GPU (smoother). Turn off only if the window flickers or goes blank. Applies after restarting the app') : ''}
        <h3>Diagnostics</h3><div class="kb" id="diag"></div>
        <div class="frow" style="margin-top:12px"><button class="btn sec" id="dcopy">Copy diagnostics</button><button class="btn sec" id="reload">Reload the client</button><button class="btn sec red2" id="dreset">Reset all settings</button></div>`;
    }
    return '';
  }
  function fancySelects(root) {
    for (const sel of root.querySelectorAll('select:not([data-f])')) {
      sel.dataset.f = 1; sel.hidden = true;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'fsel';
      const paint = () => { const o = sel.options[sel.selectedIndex]; b.innerHTML = `<span>${esc(o ? o.text : '')}</span>${I.caret}`; };
      paint(); sel.after(b);
      b.onclick = (e) => {
        e.stopPropagation();
        const r = b.getBoundingClientRect();
        const p = $('#pop');
        const opts = [...sel.options];
        p.innerHTML = `<div class="menu fmenu" style="width:${Math.max(r.width, 180)}px">${opts.map((o, i) => `<button data-i="${i}" class="${i === sel.selectedIndex ? 'on' : ''}"><span>${esc(o.text)}</span>${i === sel.selectedIndex ? I.read : ''}</button>`).join('')}</div>`;
        p.hidden = false;
        const h = p.offsetHeight;
        p.style.left = Math.min(r.left, innerWidth - p.offsetWidth - 8) + 'px';
        p.style.top = (r.bottom + 4 + h > innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4) + 'px';
        p.onclick = (ev) => { const x = ev.target.closest('[data-i]'); if (!x) return; sel.selectedIndex = +x.dataset.i; paint(); p.hidden = true; sel.dispatchEvent(new Event('change', { bubbles: true })); };
      };
    }
  }
  new MutationObserver(() => { for (const r of document.querySelectorAll('.settings, .modal, .gtop')) fancySelects(r); }).observe(document.body, { childList: true, subtree: true });
  function wire(k, box) {
    const q = (s) => box.querySelector(s);
    if (k === 'account') {
      box.querySelector('.seg').onclick = async (e) => { const b = e.target.closest('[data-st]'); if (!b) return; const pr = await api('GET', '/presence'); await api('POST', '/presence', { ...pr, status: b.dataset.st }); for (const x of box.querySelectorAll('[data-st]')) x.classList.toggle('on', x === b); toast('Status set'); };
      q('#actsave').onclick = async () => { const pr = await api('GET', '/presence'); await api('POST', '/presence', { status: pr.status, activity: { type: +q('#acttype').value, name: q('#actname').value.trim() } }); toast(q('#actname').value.trim() ? 'Activity set' : 'Activity cleared'); };
      q('#nickg').onchange = () => { q('#nick').value = S.guilds.get(q('#nickg').value)?.me?.name || ''; };
      q('#nicksave').onclick = () => api('PATCH', `/guilds/${q('#nickg').value}/nick`, { nick: q('#nick').value.trim() }).then(() => toast('Nickname saved'), (x) => toast(x.message, true));
      const pickFile = () => new Promise((ok) => { const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/png,image/jpeg,image/gif,image/webp'; f.onchange = () => ok(f.files[0] || null); f.click(); });
      box.querySelector('.afields').onclick = async (e) => {
        const k2 = e.target.closest('[data-edit]')?.dataset.edit; if (!k2) return;
        try {
          if (k2 === 'username') { const v = await ask({ title: 'Change Username', input: { label: 'Username', value: S.me.username }, ok: 'Save' }); if (!v) return; await api('POST', '/me', { username: v.trim() }); }
          if (k2 === 'about') { const v = await ask({ title: 'About Me', body: 'Shown on V1\'s profile.', input: { label: 'About me', value: box.querySelector('.about').textContent === 'Nothing yet' ? '' : box.querySelector('.about').textContent }, ok: 'Save' }); if (v === null) return; await api('POST', '/me', { about: v }); }
          if (k2 === 'avatar' || k2 === 'banner') { const f = await pickFile(); if (!f) return; await api('POST', '/me', { [k2]: await b64(f) }); }
          toast('Saved'); openSettingsPage('account');
        } catch (x) { toast(x.message, true); }
      };
    }
    if (k === 'voice') {
      const devSave = () => { const d = { input: q('#din')?.value || null, output: q('#dout')?.value || null }; store.set('devices', d); Voice.devices?.(d); };
      if (q('#din')) { q('#din').onchange = devSave; q('#dout').onchange = devSave; }
      q('.seg').onclick = (e) => { const m = e.target.closest('[data-m]'); if (m) Voice.mode = m.dataset.m; };
      q('#vs-key').onclick = () => { S.binding = true; paintVset(); };
      q('#vs-range').value = Voice.threshold;
      q('#vs-range').oninput = (e) => { Voice.threshold = +e.target.value; paintVset(); };
      api('GET', '/voicelock').then((r) => {
        q('#lockrow').innerHTML = toggleRow('p-lock', 'Turn off V1\'s TTS, follow and music while this client is open', r.on, 'V1 leaves any voice channel when you open the client and goes back to normal when you close it');
        q('#p-lock').onchange = (e) => api('POST', '/voicelock', { on: e.target.checked }).then(() => toast(e.target.checked ? 'V1 voice features off while the client is open' : 'V1 voice features back on'));
      });
      if (q('#p-noise')) q('#p-noise').onchange = (e) => { Voice.noise = e.target.checked; };
      q('#resetgain').onclick = () => { store.set('gains', {}); toast('Volumes reset (applies on next call)'); };
      paintVset();
    }
    if (k === 'chat') {
      q('#p-embeds').onchange = (e) => { PREF.embeds = e.target.checked; savePrefs(); };
      q('#p-st').onchange = (e) => { S.silentTyping = e.target.checked; store.set('silentTyping', S.silentTyping); };
      q('#p-24').onchange = (e) => { PREF.hour24 = e.target.checked; savePrefs(); };
    }
    if (k === 'notifications') {
      q('#p-notif').onchange = (e) => { PL.NotificationsForDMs = e.target.checked; store.set('plugins', PL); if (e.target.checked && !NATIVE) Notification.requestPermission?.(); };
      const saveSnd = () => store.set('sounds', SND);
      q('#sndvol').oninput = (e) => { SND.volume = e.target.value / 100; q('#sndv').textContent = e.target.value + '%'; saveSnd(); };
      box.querySelector('.snds').onclick = (e) => { const b = e.target.closest('[data-play]'); if (b) { e.preventDefault(); const k = b.dataset.play, was = SND[k]; SND[k] = true; sfx(k); SND[k] = was; } };
      box.querySelector('.snds').onchange = (e) => { const k = e.target.dataset.snd; if (k) { SND[k] = e.target.checked; saveSnd(); } };
      api('GET', '/alerts').then((a) => {
        q('#al-kw').value = (a.keywords || []).join('\n');
        q('#al-rows').innerHTML = toggleRow('al-new', 'New accounts joining', a.newAccounts, 'Accounts under a week old') + toggleRow('al-raid', 'Possible raids', a.raid, '5 or more joins within a minute')
          + `<div class="note" style="margin-top:8px">Watching ${Object.keys(a.users || {}).length} people (set from someone's profile ⋯ menu).</div>`;
        let t2; q('#al-kw').oninput = () => { clearTimeout(t2); t2 = setTimeout(() => api('POST', '/alerts', { keywords: q('#al-kw').value.split('\n').map((x) => x.trim()).filter(Boolean) }), 500); };
        q('#al-new').onchange = (e) => api('POST', '/alerts', { newAccounts: e.target.checked });
        q('#al-raid').onchange = (e) => api('POST', '/alerts', { raid: e.target.checked });
      }).catch(() => {});
      for (const k of Object.keys(NT)) { const el = q('#nt-' + k); if (el) el.onchange = (e) => { NT[k] = e.target.checked; store.set('notifTypes', NT); }; }
      q('#ntest').onclick = () => notify({ author: S.me, guildId: null, content: 'Notifications work.', attachments: [] });
    }
    if (k === 'appearance') {
      q('#fs').oninput = (e) => { PREF.fontSize = +e.target.value; q('#fsv').textContent = PREF.fontSize + 'px'; savePrefs(); };
      q('#sp').oninput = (e) => { PREF.spacing = +e.target.value; q('#spv').textContent = PREF.spacing + 'px'; store.set('prefs', PREF); applyPrefs(); };
      q('#zm').onchange = (e) => { PREF.zoom = +e.target.value; q('#zmv').textContent = PREF.zoom + '%'; store.set('prefs', PREF); applyPrefs(); };
      q('#zm').oninput = (e) => { q('#zmv').textContent = e.target.value + '%'; };
      box.querySelector('.thms').onclick = (e) => { const t = e.target.closest('[data-theme]'); if (!t) return; PREF.theme = t.dataset.theme; store.set('prefs', PREF); applyPrefs(); for (const x of box.querySelectorAll('.thm')) x.classList.toggle('on', x === t); };
      box.querySelector('[data-md]').parentElement.onclick = (e) => { const t = e.target.closest('[data-md]'); if (!t) return; PREF.compact = t.dataset.md === 'compact'; savePrefs(); for (const x of box.querySelectorAll('[data-md]')) x.classList.toggle('on', x === t); };
      box.querySelector('[data-rc]').parentElement.onclick = (e) => { const t = e.target.closest('[data-rc]'); if (!t) return; PREF.roleColors = t.dataset.rc; savePrefs(); for (const x of box.querySelectorAll('[data-rc]')) x.classList.toggle('on', x === t); };
      q('#scs').oninput = (e) => { PREF.scroll = +e.target.value; q('#scv').textContent = PREF.scroll + '×'; store.set('prefs', PREF); };
      q('#p-smooth').onchange = (e) => { PREF.smooth = e.target.checked; store.set('prefs', PREF); };
      q('#p-avc').onchange = (e) => { PREF.avatarsCompact = e.target.checked; savePrefs(); };
      q('#p-calm').onchange = (e) => { PREF.reduceMotion = e.target.checked; store.set('prefs', PREF); applyPrefs(); };
      let ct; q('#ccss').oninput = (e) => { clearTimeout(ct); ct = setTimeout(() => { PREF.customCss = e.target.value; store.set('prefs', PREF); applyPrefs(); }, 250); };
      q('#p-members').onchange = (e) => { S.showMembers = e.target.checked; store.set('showMembers', S.showMembers); $('#app').classList.toggle('nomembers', !S.showMembers || S.gid === DMG); renderHead(); };
    }
    if (k === 'keybinds') {
      q('#kb-ptt').onclick = () => { S.binding = true; q('#kb-ptt').textContent = 'Press a key or mouse button'; const t = setInterval(() => { if (!S.binding) { clearInterval(t); q('#kb-ptt').textContent = keyLabel(Voice.key); } }, 200); };
      box.querySelector('.kbl').onclick = (e) => {
        const b2 = e.target.closest('[data-kb]'); if (!b2) return;
        b2.textContent = 'Press keys…'; b2.classList.add('wait');
        const cap = (ev) => {
          if (['Shift', 'Control', 'Alt', 'Meta'].includes(ev.key)) return;
          ev.preventDefault(); ev.stopPropagation(); removeEventListener('keydown', cap, true);
          if (ev.key !== 'Escape') { KB[b2.dataset.kb] = ev.key === 'Backspace' ? '' : comboOf(ev); store.set('keybinds', KB); }
          b2.textContent = comboLabel(KB[b2.dataset.kb]); b2.classList.remove('wait');
        };
        addEventListener('keydown', cap, true);
      };
      q('#kbreset').onclick = () => { Object.assign(KB, KB_DEFAULT); store.set('keybinds', KB); openSettingsPage('keybinds'); };
    }
    if (k === 'plugins') box.querySelector('.plugs').onchange = (e) => { const n = e.target.dataset.pl; if (!n) return; PL[n] = e.target.checked; store.set('plugins', PL); applyPrefs(); renderLog(); renderChannels(); };
    if (k === 'advanced') {
      q('#p-dev').onchange = (e) => { PREF.devMode = e.target.checked; store.set('prefs', PREF); };
      if (q('#p-gpu')) q('#p-gpu').onchange = (e) => invoke('gpu', { on: e.target.checked }).then(() => toast('Restart V1 Client to apply'));
      if (q('#p-auto')) q('#p-auto').onchange = (e) => invoke('autostart', { on: e.target.checked }).then((v) => toast(v ? 'Opens when you log in' : 'Won\'t open on login'));
      q('#reload').onclick = () => location.reload();
      const diag = async () => {
        const d = await api('GET', '/debug').catch((x) => ({ error: x.message }));
        const ix = await api('GET', '/index').catch(() => null);
        const rows = [['Connection to V1', S.wsOk ? 'Live' : 'Reconnecting'], ['Round trip to the Pi', S.rtt != null ? S.rtt + ' ms' : 'join a call to measure'], ['V1 at', API],
          ['Voice engine', Voice.native ? 'Native (Opus, RNNoise, global push-to-talk)' : 'Browser'], ['In voice', d.voice ? `${chan(d.voice.channelId)?.name ?? d.voice.channelId} (${d.voice.status})` : 'No'],
          ['Mic frames sent to V1', d.framesIn ?? '–'], ['Talk bursts', d.spurts ?? '–'], ['Typing signals sent', d.typing ?? 0], ['Message history indexed', ix?.messages != null ? `${ix.messages.toLocaleString()} messages (${ix.finished} channels finished, working through the rest)` : '–'], ['Channels cached', S.msgs.size],
          ['Messages in memory', [...S.msgs.values()].reduce((a2, l) => a2 + l.length, 0)], ['Servers', S.guilds.size], ['DMs', S.dms.length]];
        const el = q('#diag'); if (!el) return;
        el.innerHTML = rows.map(([a2, b2]) => `<div><span>${a2}</span><kbd>${esc(String(b2))}</kbd></div>`).join('');
        el.dataset.text = rows.map(([a2, b2]) => `${a2}: ${b2}`).join('\n');
      };
      diag(); const t = setInterval(() => { if (!document.body.contains(box)) clearInterval(t); else diag(); }, 2000);
      q('#dcopy').onclick = () => copy(q('#diag').dataset.text || '');
      q('#dreset').onclick = async () => { if (await ask({ title: 'Reset all settings', body: 'Clears every V1 Client setting on this computer: theme, keybinds, plugins, notifications, read state. Your favourite GIFs stay (they live on the Pi).', ok: 'Reset', danger: true })) { for (const k2 of Object.keys(localStorage)) if (k2.startsWith('v1.')) localStorage.removeItem(k2); location.reload(); } };
    }
  }

  // ------------------------------------------------------------------ keybinds (Discord's defaults) + quick switcher
  const KB_ACTIONS = [['quick', 'Quick switcher', 'Jump to any channel, DM or server'], ['mute', 'Toggle mute'], ['deaf', 'Toggle deafen'], ['chanUp', 'Previous channel'], ['chanDown', 'Next channel'],
    ['unreadUp', 'Previous unread channel'], ['unreadDown', 'Next unread channel'], ['srvUp', 'Previous server'], ['srvDown', 'Next server'], ['markRead', 'Mark channel read'], ['markSrvRead', 'Mark server read'],
    ['search', 'Search'], ['members', 'Toggle member list'], ['pins', 'Pinned messages'], ['emoji', 'Emoji picker'], ['gif', 'GIF picker'], ['upload', 'Upload a file'], ['settings', 'Settings']];
  const KB_DEFAULT = { quick: 'Ctrl+K', mute: 'Ctrl+Shift+M', deaf: 'Ctrl+Shift+D', chanUp: 'Alt+ArrowUp', chanDown: 'Alt+ArrowDown', unreadUp: 'Alt+Shift+ArrowUp', unreadDown: 'Alt+Shift+ArrowDown',
    srvUp: 'Ctrl+Alt+ArrowUp', srvDown: 'Ctrl+Alt+ArrowDown', markRead: 'Escape', markSrvRead: 'Shift+Escape', search: 'Ctrl+F', members: 'Ctrl+U', pins: 'Ctrl+P', emoji: 'Ctrl+E', gif: 'Ctrl+G', upload: 'Ctrl+Shift+U', settings: 'Ctrl+,' };
  const KB = Object.assign({}, KB_DEFAULT, store.get('keybinds', {}));
  const comboOf = (e) => [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super', e.key.length === 1 ? e.key.toUpperCase() : e.key].filter(Boolean).join('+');
  const comboLabel = (c) => !c ? 'Not set' : c.replace(/Arrow(Up|Down|Left|Right)/g, (x, d) => ({ Up: '↑', Down: '↓', Left: '←', Right: '→' }[d])).replace('Escape', 'Esc');
  const visibleChans = () => S.gid === DMG ? S.dms.map((d) => d.id) : sortedChannels(S.guilds.get(S.gid)).filter((c) => c.type !== CH.CAT).map((c) => c.id);
  const ACT = {
    quick: () => quickSwitcher(), mute: () => $('#bmute').click(), deaf: () => $('#bdeaf').click(),
    chanUp: () => { const l = visibleChans(); const i = l.indexOf(S.cid); if (i > 0) openChannel(l[i - 1]); },
    chanDown: () => { const l = visibleChans(); const i = l.indexOf(S.cid); if (i >= 0 && i < l.length - 1) openChannel(l[i + 1]); },
    unreadUp: () => { const l = visibleChans(); const i = l.indexOf(S.cid); const t = l.slice(0, Math.max(0, i)).reverse().find((c) => S.unread.has(c)); if (t) openChannel(t); },
    unreadDown: () => { const l = visibleChans(); const i = l.indexOf(S.cid); const t = l.slice(i + 1).find((c) => S.unread.has(c)); if (t) openChannel(t); },
    srvUp: () => { const l = [DMG, ...S.guilds.keys()]; const i = l.indexOf(S.gid); if (i > 0) openGuild(l[i - 1]); },
    srvDown: () => { const l = [DMG, ...S.guilds.keys()]; const i = l.indexOf(S.gid); if (i < l.length - 1) openGuild(l[i + 1]); },
    markRead: () => { if (S.reply || S.edit || !$('#pop').hidden || document.querySelector('.settings, .modal, .qs, #lightbox')) return false; S.unread.delete(S.cid); markRead(S.cid); renderChannels(); renderRail(); },
    markSrvRead: () => { const g = S.guilds.get(S.gid); for (const c of g?.channels || []) { S.unread.delete(c.id); markRead(c.id); } renderChannels(); renderRail(); },
    search: () => { const i = $('#hsq'); if (i) { i.focus(); i.select(); } }, members: () => $('#tmem')?.click(), pins: () => $('#tpins')?.click(),
    emoji: () => openExpr('emoji'), gif: () => openExpr('gif'), upload: () => $('#file').click(), settings: () => openSettingsPage('account'),
  };
  addEventListener('keydown', (e) => {
    if (S.binding || document.querySelector('.kbr .wait')) return;
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    const c = comboOf(e);
    const id = Object.keys(KB).find((k2) => KB[k2] && KB[k2] === c);
    if (!id) return;
    if (id === 'markRead' && (document.activeElement?.closest?.('.settings, .modal, #pop, .qs') || ta.value)) return;
    if (document.querySelector('.qs') && id !== 'quick') return;
    if (ACT[id]() === false) return;
    e.preventDefault(); e.stopPropagation();
  }, true);
  function quickSwitcher() {
    if (document.querySelector('.qs')) { document.querySelector('.qs').remove(); return; }
    const box = document.createElement('div'); box.className = 'modal qs';
    box.innerHTML = `<div class="mcard qsc"><input id="qsq" placeholder="Where would you like to go?"><div class="qsl"></div><div class="note">Tip: start with # for channels, @ for people, * for servers</div></div>`;
    document.body.append(box);
    const inp = box.querySelector('#qsq'), list = box.querySelector('.qsl');
    const all = () => {
      const out = [];
      for (const g of S.guilds.values()) {
        out.push({ k: '*', label: g.name, sub: 'Server', icon: g.icon, go: () => openGuild(g.id) });
        for (const c of g.channels) if (c.type !== CH.CAT) out.push({ k: '#', label: c.name, sub: g.name, unread: S.unread.has(c.id), go: () => goTo(g.id, c.id) });
      }
      for (const d of S.dms) out.push({ k: '@', label: nickOf(d.user) || d.user.name, sub: d.user.username, icon: d.user.avatar, go: () => goTo(DMG, d.id) });
      for (const m of S.members.get(S.home)?.members || []) if (!S.dms.some((d) => d.user.id === m.id) && !m.bot) out.push({ k: '@', label: nickOf(m) || m.name, sub: m.username, icon: m.avatar, go: () => openDm(m.id) });
      return out;
    };
    const items = all(); let shown = [], sel = 0;
    const fill = () => {
      let q = inp.value.trim().toLowerCase(), kind = null;
      if (/^[#@*]/.test(q)) { kind = q[0]; q = q.slice(1); }
      const rank = (x) => { const l = x.label.toLowerCase(); return l === q ? 4 : l.startsWith(q) ? 3 : l.includes(q) ? 2 : (x.sub || '').toLowerCase().includes(q) ? 1 : 0; };
      shown = items.filter((x) => (!kind || x.k === kind) && (!q || rank(x))).sort((a2, b2) => (q ? rank(b2) - rank(a2) : (b2.unread ? 1 : 0) - (a2.unread ? 1 : 0))).slice(0, 12);
      sel = 0;
      list.innerHTML = shown.map((x, i) => `<div class="qsi${i === 0 ? ' on' : ''}" data-i="${i}">${x.icon ? `<img src="${esc(x.icon)}" alt="">` : `<span class="qk">${x.k === '#' ? I.hash : x.k}</span>`}<b>${esc(x.label)}</b>${x.unread ? '<i class="udot"></i>' : ''}<span class="qsub">${esc(x.sub || '')}</span></div>`).join('') || '<div class="empty">No matches</div>';
    };
    const paint = () => list.querySelectorAll('.qsi').forEach((el, i) => { el.classList.toggle('on', i === sel); if (i === sel) el.scrollIntoView({ block: 'nearest' }); });
    const go = (i) => { const x = shown[i]; if (!x) return; box.remove(); x.go(); };
    fill(); inp.focus();
    inp.oninput = fill;
    inp.onkeydown = (e) => {
      if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); paint(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); paint(); e.preventDefault(); }
      if (e.key === 'Enter') { e.preventDefault(); go(sel); }
      if (e.key === 'Escape') { e.preventDefault(); box.remove(); }
    };
    list.onclick = (e) => { const x = e.target.closest('[data-i]'); if (x) go(+x.dataset.i); };
    box.onmousedown = (e) => { if (e.target === box) box.remove(); };
  }

  // ------------------------------------------------------------------ Claude panel (Claude Code + V1's tools; toggle in Plugins)
  const CL = { open: false, session: store.get('claudeSession', ''), busy: false, cur: null, text: '' };
  const CW = Object.assign({ x: null, y: 80, w: 400, h: 560 }, store.get('claudeWin', {}));
  const placeClaude = () => { const el = $('#claude'); const w = Math.min(CW.w, innerWidth - 16), h = Math.min(CW.h, innerHeight - 16);
    const x = CW.x == null ? innerWidth - w - 24 : Math.max(8, Math.min(CW.x, innerWidth - w - 8)), y = Math.max(8, Math.min(CW.y, innerHeight - h - 8));
    Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }); };
  $('#claude').querySelector('.chd').addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault(); const el = $('#claude'), r = el.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
    document.body.classList.add('dragging'); el.style.willChange = 'transform';
    // move with a GPU transform while dragging (no layout per mouse move), commit the real position on release
    const mv = (ev) => { const dx = Math.max(8 - r.left, Math.min(innerWidth - r.right - 8, ev.clientX - x0)), dy = Math.max(8 - r.top, Math.min(innerHeight - r.bottom - 8, ev.clientY - y0)); el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`; el.dataset.dx = dx; el.dataset.dy = dy; };
    const up = () => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up); document.body.classList.remove('dragging');
      CW.x = r.left + (+el.dataset.dx || 0); CW.y = r.top + (+el.dataset.dy || 0); el.style.transform = ''; el.style.willChange = ''; delete el.dataset.dx; delete el.dataset.dy;
      placeClaude(); store.set('claudeWin', { x: CW.x, y: CW.y, w: CW.w, h: CW.h });
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  });
  new ResizeObserver(() => { const el = $('#claude'); if (el.hidden) return; const r = el.getBoundingClientRect(); if (Math.abs(r.width - CW.w) > 2 || Math.abs(r.height - CW.h) > 2) { CW.w = Math.round(r.width); CW.h = Math.round(r.height); clearTimeout(CW.t); CW.t = setTimeout(() => store.set('claudeWin', { x: CW.x, y: CW.y, w: CW.w, h: CW.h }), 300); } }).observe($('#claude'));
  addEventListener('resize', () => { if (CL.open) placeClaude(); });
  function toggleClaude(force) {
    CL.open = force ?? !CL.open;
    $('#claude').hidden = !CL.open;
    if (CL.open) placeClaude();
    renderHead();
    if (CL.open) { if (!$('#clog').children.length) clWelcome(); $('#cta').focus(); }
  }
  function clWelcome() { if (store.get('claudeNoWelcome', false)) { $('#clog').innerHTML = ''; return; } $('#clog').innerHTML = `<div class="cmsg sys"><button class="ico cwx" title="Hide this">${I.x}</button>Ask anything, or tell me what to do as V1: read a channel, summarise, reply to someone, DM people, react. I can also search the web. Anything destructive (kick, ban, delete…) waits for you to click Allow.</div>`; }
  $('#cnew').innerHTML = I.plus; $('#cclose').innerHTML = I.x; $('#csend').innerHTML = I.send;
  $('#cclose').onclick = () => toggleClaude(false);
  $('#clog').addEventListener('click', (e) => { if (e.target.closest('.cwx')) { store.set('claudeNoWelcome', true); e.target.closest('.cmsg').remove(); } });
  $('#cnew').onclick = () => { if (CL.busy) invoke('claude_stop'); CL.session = ''; store.set('claudeSession', ''); clWelcome(); };
  const cta = $('#cta');
  cta.addEventListener('input', () => { cta.style.height = 'auto'; cta.style.height = Math.min(cta.scrollHeight, 200) + 'px'; });
  cta.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); clSend(); } });
  $('#csend').onclick = () => (CL.busy ? invoke('claude_stop') : clSend());
  const clAdd = (cls, html) => { const d = document.createElement('div'); d.className = 'cmsg ' + cls; d.innerHTML = html; $('#clog').append(d); $('#clog').scrollTop = 1e9; return d; };
  const who2 = (gid, uid) => { const m = S.members.get(gid)?.byId.get(uid) || memberById(uid); return m ? (nickOf(m) || m.name) : 'someone'; };
  const TOOL_LABEL = { list_servers: () => 'Looking at the servers', read_messages: (a) => `Reading ${chanLabel(a.channel_id)}`, search_messages: (a) => `Searching for “${a.query}”`, find_members: (a) => a.query ? `Looking up “${a.query}”` : 'Listing members',
    user_profile: (a) => `Opening ${who2(a.guild_id, a.user_id)}'s profile`, send_message: (a) => `Sending a message in ${chanLabel(a.channel_id)}`, react: (a) => `Reacting ${a.emoji}`, edit_own_message: () => 'Editing a message', open_dm: (a) => `Opening a DM with ${who2(null, a.user_id)}`,
    timeout_member: (a) => a.minutes ? `Timing out ${who2(a.guild_id, a.user_id)} for ${a.minutes} min` : `Removing ${who2(a.guild_id, a.user_id)}'s timeout`, kick_member: (a) => `Kicking ${who2(a.guild_id, a.user_id)}`, ban_member: (a) => `Banning ${who2(a.guild_id, a.user_id)}`,
    unban_user: () => 'Unbanning someone', delete_message: () => 'Deleting a message', purge_messages: (a) => `Deleting ${a.count} messages`, set_role: (a) => (a.add ? 'Giving' : 'Removing') + ` a role ${a.add ? 'to' : 'from'} ${who2(a.guild_id, a.user_id)}`,
    set_nickname: (a) => `Renaming ${who2(a.guild_id, a.user_id)}`, WebSearch: (a) => `Searching the web for “${a.query || ''}”`, WebFetch: (a) => `Reading ${a.url || 'a web page'}` };
  const HIDDEN_TOOLS = /^(ToolSearch|ListMcpResources|ReadMcpResource)/;
  const CHIPS = new Map();
  const chanLabel = (id) => { const c = chan(id); return c ? (c.type === CH.DM ? '@' + c.name : '#' + c.name) : 'a channel'; };
  async function clSend() {
    const q = cta.value.trim(); if (!q || CL.busy) return;
    cta.value = ''; cta.style.height = 'auto';
    clAdd('me', esc(q));
    const g = S.guilds.get(S.gid), c = chan(S.cid);
    const context = `You are the Claude panel inside V1 Client, a Discord client that lets the owner of the bot "${S.me.name}" (user id ${S.me.id}) use Discord as that bot. Use the v1 tools to read and act on Discord; everything you send goes out as the bot, publicly. Keep replies short and plain.
Only post, reply, react or DM when they ask you to; for questions, just answer. After you act, say what you did in one line. Moderation tools (timeout, kick, ban, unban, delete, purge, roles, nicknames) each show the owner an Allow/Deny card and only run if they click Allow; use them only when asked, and if one is denied, don't retry.
They are currently looking at ${c ? `${c.type === CH.DM ? 'a DM with ' + c.name : '#' + c.name} (channel id ${c.id})` : 'nothing'}${g ? ` in the server "${g.name}" (server id ${g.id})` : ''}. "Here" or "this channel" means that one. Time now: ${new Date().toLocaleString('en-GB')}.`;
    CL.busy = true; CL.cur = null; CL.text = '';
    $('#csend').innerHTML = I.stop; $('#cstat').textContent = 'Thinking…';
    try { await invoke('claude_ask', { prompt: q, resume: CL.session || null, context, moderate: true, model: store.get('claudeModel', '') || null }); }
    catch (x) { clAdd('err', esc(String(x.message || x))); clDone(); }
  }
  function clDone() { CL.busy = false; CL.cur = null; $('#csend').innerHTML = I.send; $('#cstat').textContent = ''; }
  const clText = () => { if (!CL.cur) { CL.cur = clAdd('ai', ''); CL.text = ''; } return CL.cur; };
  window.__TAURI__?.event?.listen?.('v1-claude', ({ payload: p }) => {
    if (p.done) { if (p.code && p.code !== 0 && !CL.gotResult) clAdd('err', 'Claude Code stopped early (exit ' + p.code + ').'); CL.gotResult = false; clDone(); return; }
    if (p.stderr) { if (/not logged in|login|auth/i.test(p.stderr)) clAdd('err', 'Claude Code isn\'t logged in on this laptop. Run claude in a terminal once and log in.'); return; }
    let d; try { d = JSON.parse(p.line); } catch { return; }
    if (d.type === 'system' && d.session_id) { CL.session = d.session_id; store.set('claudeSession', d.session_id); }
    else if (d.type === 'stream_event' && d.event?.type === 'content_block_delta' && d.event.delta?.type === 'text_delta') {
      const el = clText(); CL.text += d.event.delta.text; el.innerHTML = MD.render(CL.text); $('#clog').scrollTop = 1e9; $('#cstat').textContent = 'Writing…';
    } else if (d.type === 'assistant') {
      for (const b of d.message?.content || []) if (b.type === 'tool_use') {
        const name = b.name.replace(/^mcp__v1__/, '');
        if (HIDDEN_TOOLS.test(name)) continue;
        const lab = (TOOL_LABEL[name] || (() => name.replace(/_/g, ' ')))(b.input || {});
        // the same step again right after itself stacks into one line with a count
        const last = $('#clog').lastElementChild, st = last?.__step;
        if (st && st.tool === name && !st.bad) {
          st.n++; st.left++; if (!st.labs.includes(lab)) st.labs.push(lab);
          const verb = lab.split(' ')[0], same = st.labs.every((l) => l.split(' ')[0] === verb);
          st.lab = st.labs.length === 1 ? lab : same ? verb + ' ' + st.labs.map((l) => l.slice(verb.length + 1)).join(', ') : st.labs.join(', ');
          last.className = 'cmsg tool run'; last.querySelector('span').textContent = `${st.lab} ×${st.n}…`; CHIPS.set(b.id, { chip: last });
        } else { const chip = clAdd('tool run', `${I.spark}<span>${esc(lab)}…</span>`); chip.__step = { tool: name, lab, labs: [lab], n: 1, left: 1, bad: false }; CHIPS.set(b.id, { chip }); }
        CL.cur = null; $('#cstat').textContent = 'Working…';
        if (name === 'send_message' && b.input?.channel_id === S.cid) setTimeout(scrollBottom, 600);
      }
    } else if (d.type === 'user') { // tool results: settle each step's chip
      for (const b of d.message?.content || []) if (b.type === 'tool_result') {
        const c = CHIPS.get(b.tool_use_id); if (!c) continue; CHIPS.delete(b.tool_use_id);
        const txt = Array.isArray(b.content) ? b.content.map((x) => x.text || '').join(' ') : String(b.content || '');
        const bad = b.is_error || /^Error:|did not approve/.test(txt);
        const st = c.chip.__step; st.left--;
        if (st.bad || (st.left > 0 && !bad)) continue; // a failure in the stack stays shown
        st.bad = bad;
        const cnt = st.n > 1 ? ` ×${st.n}` : '';
        c.chip.classList.remove('run'); c.chip.classList.add(bad ? 'bad' : 'ok');
        c.chip.querySelector('span').textContent = st.lab + cnt + (bad ? (/did not approve/.test(txt) ? ' — not done (denied)' : ' — failed') : ' ✓');
        if (bad && !/did not approve/.test(txt)) c.chip.title = txt.replace(/^Error:\s*/, '');
      }
    } else if (d.type === 'result') {
      CL.gotResult = true;
      if (d.is_error && d.result) clAdd('err', esc(d.result));
      else if (!CL.cur && d.result && !CL.text) clAdd('ai', MD.render(d.result));
      if (d.session_id) { CL.session = d.session_id; store.set('claudeSession', d.session_id); }
    }
  });

  // ------------------------------------------------------------------ auto-refresh when a new UI is deployed, only when nothing is mid-way
  let myVersion = null, wantReload = false;
  window.__TAURI__?.event?.listen?.('v1-memory', ({ payload }) => { if (!wantReload) { report(`memory guard: page at ${payload.mb} MB, reloading when safe`); wantReload = true; tryReload(); } });
  function noteVersion(v) { if (!myVersion) { myVersion = v; return; } if (v !== myVersion) { wantReload = true; tryReload(); } }
  function busy() {
    if (S.voice || S.joining || Voice.active) return 'in a call';
    for (const m of document.querySelectorAll('audio, video')) if (!m.paused && !m.muted) return 'media playing';
    if ($('#bgaudio audio')) return 'audio playing';
    if (CL.busy || document.querySelector('.cmsg.appr:not(.done)')) return 'Claude is working';
    if (document.querySelector('.settings, .modal, #lightbox, .qs') || !$('#pop').hidden) return 'a window is open';
    if (S.edit || document.activeElement?.closest?.('.medit, .settings, .modal')) return 'editing';
    if (S.files.length || dragDepth) return 'attaching files';
    return null;
  }
  function tryReload() {
    if (!wantReload) return;
    if (busy()) { setTimeout(tryReload, 5000); return; }
    saveDraft();
    fetch(API + '/index.html', { method: 'HEAD', cache: 'no-store' }).then((r) => { if (r.ok) location.reload(); else setTimeout(tryReload, 3000); }, () => setTimeout(tryReload, 3000)); // only reload when V1 is up
  }
  // drafts per channel survive reloads and channel switches, like Discord
  const DRAFTS = store.get('drafts', {});
  function saveDraft(cid = S.cid) { if (!cid) return; if (ta.value.trim()) DRAFTS[cid] = ta.value; else delete DRAFTS[cid]; store.set('drafts', DRAFTS); }
  function loadDraft(cid) { ta.value = DRAFTS[cid] || ''; autosize(); }

  // ------------------------------------------------------------------ me bar
  function renderMe() {
    if (!S.me) return;
    $('#meid').innerHTML = `${avatarHTML(S.me, S.wsOk ? (S.presence || 'online') : 'offline')}<div class="who"><b>${esc(S.me.name)}</b><small title="${S.wsOk ? '' : 'The live link to the bot dropped (restarting, or a network blip). It reconnects on its own.'}">${S.wsOk ? esc(S.activity || S.me.tag || S.me.username) : (S.downSince && Date.now() - S.downSince > 15000 ? 'Can\'t reach the Pi' : 'Reconnecting to V1…')}</small></div>`;
  }
  $('#meid').onclick = (e) => showProfile(S.me.id, e.currentTarget);

  // ------------------------------------------------------------------ title bar (Discord-style; the app window has no system frame)
  const HIST = { back: [], fwd: [], moving: false };
  $('#tback').innerHTML = I.back; $('#tfwd').innerHTML = I.fwd;
  $('#treload').innerHTML = I.reload; $('#treload').onclick = () => location.reload();
  const histGo = (from, to) => { const h = from.pop(); if (!h) return; to.push({ gid: S.gid, cid: S.cid }); HIST.moving = true; goTo(h.gid, h.cid).finally(() => { HIST.moving = false; }); };
  $('#tback').onclick = () => histGo(HIST.back, HIST.fwd);
  $('#tfwd').onclick = () => histGo(HIST.fwd, HIST.back);
  addEventListener('mouseup', (e) => { if (e.button === 3) histGo(HIST.back, HIST.fwd); if (e.button === 4) histGo(HIST.fwd, HIST.back); });
  function renderTitle() {
    const g = S.guilds.get(S.gid);
    $('#ttitle').innerHTML = S.gid === DMG ? `${I.dm}<span>Direct Messages</span>` : g ? `${g.icon ? `<img src="${esc(g.icon)}" alt="">` : ''}<span>${esc(g.name)}</span>` : '';
    $('#tback').disabled = !HIST.back.length; $('#tfwd').disabled = !HIST.fwd.length;
  }
  if (NATIVE) {
    const win = () => window.__TAURI__?.window?.getCurrentWindow?.();
    $('#tctl').innerHTML = `<button data-w="min" title="Minimise">${I.min}</button><button data-w="max" title="Maximise">${I.max}</button><button data-w="close" class="x" title="Close">${I.close}</button>`;
    $('#tctl').onclick = (e) => { const b = e.target.closest('[data-w]'); if (!b) return; const w = win(); if (!w) return; ({ min: () => w.minimize(), max: () => w.toggleMaximize(), close: () => w.close() })[b.dataset.w](); };
    document.body.classList.add('tbar');
  } else $('#titlebar').hidden = true;

  // animated avatars/decorations play only while you hover their row (Discord does the same)
  let hoverRow = null;
  const setAnim = (row, on2) => { for (const im of row.querySelectorAll('img[data-anim]')) im.src = on2 ? im.dataset.anim : im.dataset.still; };
  addEventListener('mouseover', (e) => {
    const row = e.target.closest?.('.mem, .msg, .vm, .prof, .tile, .dmrow, .meid'); if (row === hoverRow) return;
    if (hoverRow) setAnim(hoverRow, false);
    hoverRow = row; if (row) setAnim(row, true);
  }, { passive: true });

  // ------------------------------------------------------------------ scroll speed (WebKit's wheel step is small)
  const SCROLLY = new WeakMap();
  const scrollable = (el) => {
    for (; el && el !== document.body; el = el.parentElement) {
      let y = SCROLLY.get(el); if (y === undefined) { y = /(auto|scroll)/.test(getComputedStyle(el).overflowY); SCROLLY.set(el, y); }
      if (y && el.scrollHeight > el.clientHeight) return el;
    }
    return null;
  };
  // zoom: Ctrl+wheel / pinch / Ctrl +,-,0. One relayout when you stop, not one per wheel tick.
  let zoomT = null, zoomTo = null;
  const zoomBadge = () => { let z = $('#zoomb'); if (!z) { z = document.createElement('div'); z.id = 'zoomb'; document.body.append(z); } return z; };
  const setZoom = (v) => {
    zoomTo = Math.max(50, Math.min(200, Math.round(v / 5) * 5));
    const z = zoomBadge(); z.textContent = zoomTo + '%'; z.hidden = false;
    clearTimeout(zoomT);
    zoomT = setTimeout(() => { PREF.zoom = zoomTo; store.set('prefs', PREF); applyPrefs(); zoomTo = null; renderLog(); renderMembers(); renderChannels(); renderRail(); renderMe(); setTimeout(() => { z.hidden = true; }, 600); }, 140);
  };
  addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault(); e.stopPropagation();
    setZoom((zoomTo ?? PREF.zoom) * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  }, { passive: false, capture: true });
  addEventListener('keydown', (e) => {
    if (!e.ctrlKey || e.altKey) return;
    if (e.key === '=' || e.key === '+') { e.preventDefault(); setZoom((zoomTo ?? PREF.zoom) + 10); }
    else if (e.key === '-') { e.preventDefault(); setZoom((zoomTo ?? PREF.zoom) - 10); }
    else if (e.key === '0') { e.preventDefault(); setZoom(100); }
  }, true);
  addEventListener('wheel', (e) => {
    if (e.ctrlKey || (PREF.scroll === 1 && !PREF.smooth && window.V1_INSTANT_NATIVE) || e.target.closest?.('input[type=range], #lightbox')) return; // until the app turns off WebKit's smoothing, scrolling is done here (instant)
    const el = scrollable(e.target); if (!el) return;
    e.preventDefault();
    const dy = (e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * el.clientHeight : e.deltaY) * PREF.scroll;
    if (PREF.smooth) { el.scrollBy({ top: dy, behavior: 'smooth' }); return; }
    if (wheelEl !== el) { flushWheel(); wheelEl = el; }
    wheelAcc += dy;
    if (!wheelRaf) wheelRaf = requestAnimationFrame(flushWheel);
  }, { passive: false });
  let wheelEl = null, wheelAcc = 0, wheelRaf = 0;
  function flushWheel() { wheelRaf = 0; if (wheelEl && wheelAcc) wheelEl.scrollTop += wheelAcc; wheelAcc = 0; }

  // ------------------------------------------------------------------ resizable panes
  { // the chat beside a voice channel: drag its left edge like Discord's
    const cw = store.get('callChatW', 400); $('#main').style.setProperty('--cw', cw + 'px');
    const h = document.createElement('div'); h.className = 'grip callchat'; $('#chatcol').append(h);
    h.onmousedown = (e) => {
      e.preventDefault(); const x0 = e.clientX, w0 = $('#chatcol').offsetWidth, max = $('#main').offsetWidth - 240; let v = w0;
      document.body.classList.add('resizing');
      const mv = (ev) => { v = Math.round(Math.max(300, Math.min(max, w0 - (ev.clientX - x0)))); $('#main').style.setProperty('--cw', v + 'px'); };
      const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); document.body.classList.remove('resizing'); store.set('callChatW', v); };
      addEventListener('mousemove', mv); addEventListener('mouseup', up);
    };
  }
  const W = Object.assign({ side: 268, members: 264 }, store.get('widths', {})); // Discord's own defaults
  const applyW = () => { const a = $('#app'); a.style.setProperty('--sw', W.side + 'px'); a.style.setProperty('--mw', W.members + 'px'); };
  applyW();
  for (const [key, dir] of [['side', 1], ['members', -1]]) {
    const h = document.createElement('div'); h.className = 'grip ' + key; $('#app').append(h);
    h.onmousedown = (e) => {
      e.preventDefault(); const x0 = e.clientX, w0 = W[key]; document.body.classList.add('resizing');
      // freeze every panel's contents at a fixed width while dragging: only the panel edges move (no text re-layout),
      // so the drag follows the mouse instantly; everything re-flows once on release
      const frozen = [];
      // flex only for row children: in a column (sidebar header, channel list, members) flex-basis is the height
      const freeze = (el, w) => { if (!el || el.hidden) return; frozen.push([el, el.style.cssText]); el.style.width = w + 'px'; el.style.maxWidth = 'none'; if (getComputedStyle(el.parentElement).flexDirection.startsWith('row')) el.style.flex = `0 0 ${w}px`; };
      freeze($('#chatcol'), $('#chatcol').offsetWidth); freeze($('#callgrid'), $('#callgrid').offsetWidth);
      for (const id of ['#chans', '#sidehead', '#members']) { const el = $(id); if (el && el.offsetWidth) freeze(el, Math.max(el.offsetWidth, 460)); }
      const mv = (ev) => { const v = Math.round(Math.max(200, Math.min(460, w0 + (ev.clientX - x0) * dir))); if (v !== W[key]) { W[key] = v; applyW(); } };
      const up = () => {
        removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
        for (const [el, css] of frozen) el.style.cssText = css;
        document.body.classList.remove('resizing'); store.set('widths', W);
      };
      addEventListener('mousemove', mv); addEventListener('mouseup', up);
    };
  }

  // ------------------------------------------------------------------ boot
  async function boot() {
    if (!API || !KEY) { $('#log').innerHTML = '<div class="empty">No key</div>'; return; }
    try {
      const st = await api('GET', '/state');
      S.me = st.me; S.home = st.home;
      for (const g of st.guilds) S.guilds.set(g.id, g);
      onVoiceState(st.voice);
    } catch (e) { $('#log').innerHTML = `<div class="empty">Cannot reach V1: ${esc(e.message)}</div>`; setTimeout(boot, 3000); return; }
    seedUnread();
    renderMe(); renderRail(); renderVoice();
    connect();
    loadDms();
    if (S.home) loadMembers(S.home); // statuses for DMs too
    api('GET', '/gifs/favs').then((r) => { FAVGIFS = r.gifs; }).catch(() => {}); // so chat GIF stars show the right state
    const gid = store.get('gid');
    openGuild(gid === DMG || S.guilds.has(gid) ? gid : (S.home && S.guilds.has(S.home) ? S.home : S.guilds.keys().next().value));
  }
  boot();
})();
