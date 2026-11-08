# V1 Client

**Experimental, designed to be adopted with an AI agent.** Expect to read the code and adapt it to your bot; an agent like Claude Code is the intended way to do that.

A Discord client that lets a bot's owner use Discord *as the bot*: chat, DMs, voice, server management, polls, GIFs, a Claude panel that can act through the bot. It uses the bot's normal token, so there's no self-botting and no user token anywhere.

## What's in it

- **Chat:** servers, channels, threads, DMs (opened by the bot), live edits/deletes, scrollback, instant (optimistic) sends kept in the server's order, replies, mentions with autocomplete, `:emoji:` shortcodes, reactions, uploads and pasted images, drafts per channel, inline editing, polls, embeds with link buttons, stickers, forwarding, send-as (webhook), TTS and silent messages.
- **Looks like Discord:** Onyx/Dark/Ash themes, Discord's sizes, gg sans and Discord's icons if you supply them, profile popouts with banners, decorations, server tags and badges, role colours and icons, nameplates, platform indicators.
- **Built-in Vencord-style plugins (toggleable):** message logger, who reacted, typing indicators, message link previews, image zoom and gallery, quick reply, double-click actions, call timer, pinned DMs, private nicknames and notes, ClearURLs, translate.
- **Pickers:** one expression picker (GIFs with favourites and providers, stickers, emoji with frecency, skin tones and keyboard control), Ctrl+K quick switcher, editable keybinds.
- **Voice:** native Opus with RNNoise, voice activity or global push-to-talk, per-user volume up to 300%, a call view, and a "voice lock" that keeps the bot's own voice features out of the way while you're connected.
- **Server management:** settings for overview, roles and permissions, emoji, stickers, invites, bans, audit log, webhooks; channel create/edit/delete; kick, ban, timeout, roles, nicknames, purge, pins.
- **Claude panel:** a floating window running Claude Code with only the bot's tools (plus web search). Anything destructive shows an Allow/Deny card first.
- **Speed:** channels preload, GIF videos become cached animated WebP (WebKit's video player deadlocks on GIF-heavy channels), off-screen rows are skipped, the UI updates itself when you deploy a new `web/`.

## How it fits together

```
your discord.js bot process ──► server/client-api.js  (required inside the bot: one login)
        │                         HTTP + WebSocket on :7380, private network only, long random key
        │                         also serves web/ and converts GIF videos to animated WebP (ffmpeg)
        ▼
   app/ (Tauri 2, WebKitGTK, Linux/X11)  loads the UI from the bot's machine
        native voice: cpal + Opus + RNNoise, global push-to-talk (rdev), clipboard images (xclip),
        notifications (notify-send), YouTube via Celluloid/yt-dlp, Claude panel via Claude Code
```

## Setup (outline: adapt it to your bot)

1. **Bot side.** Copy `server/client-api.js` next to your bot and wire it in:
   ```js
   const clientApi = require('./client-api.js');
   clientApi.setup(client.on.bind(client), client, { sessions, ensureSession, followVoice, dropSession, db });
   clientApi.start(); // before client.login()
   ```
   The hooks are for bots that already do voice (`sessions` = your per-guild voice sessions, `followVoice`, etc.) and for message search (`db` = a SQLite handle with a `seen` table). Without them, pass simple stubs; the "voice lock" and search need them. Guard your own voice code with `clientApi.owns(guildId)` so the client can take the voice connection.
   Intents used: Guilds, GuildMessages, MessageContent, GuildMembers, GuildPresences, GuildVoiceStates, GuildMessageReactions, GuildMessageTyping, GuildMessagePolls, DirectMessages (+ Reactions, Typing, Polls). Needs `@discordjs/voice`, `ws`, and `ffmpeg` on the PATH.
   A key is created at `.secrets/client-key` on first start. Set `GUILD_ID` for the home server; `CLIENT_API_ALLOW` (regex) to change which addresses may connect.
2. **UI.** Copy `web/` to `client-web/` next to `client-api.js`. Updates reload clients automatically.
3. **App.** On the machine you use: put the key in `~/.config/v1-client/key` and the bot's address in `~/.config/v1-client/api` (e.g. `http://192.168.1.50:7380`). Then `cd app && cargo build --release`. If your API isn't on port 7380, change `app/capabilities/default.json`.
4. **Optional.** Claude panel: install and log in to Claude Code. Discord's own icons: save the web client's JS into a folder, then `DISCORD_BUNDLE=that/folder python3 tools/discord-icons.py ...` (see the script). Without it the built-in icons are used.

## What a bot can't do

Read bios, pronouns or profile effects; screen share or watch streams; run slash commands; press other bots' buttons; vote in polls. The client says so where it matters.

## Licence

AGPL-3.0. Bundled: simple-markdown (MIT), highlight.js (BSD-3-Clause), emoji names from GitHub's gemoji (MIT). Discord's fonts and icons are not included.
