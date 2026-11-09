// V1 Client: a local API so a bot's owner can chat and talk in VC as the bot.
// Lives inside the V1 process (one bot login). HTTP + WebSocket, LAN only, long random key.
// Voice: browser Opus frames in -> V1 plays them; V1 receives each speaker's Opus -> browser mixes.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { WebSocketServer } = require('ws');
const { ChannelType, PermissionFlagsBits, Events, AttachmentBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, OverwriteType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, StreamType, AudioPlayerStatus,
  VoiceConnectionStatus, EndBehaviorType, NoSubscriberBehavior, entersState } = require('@discordjs/voice');

const PORT = Number(process.env.CLIENT_API_PORT || 7380);
const KEY_FILE = path.join(__dirname, '.secrets', 'client-key');
// only private-network addresses may connect (override with CLIENT_API_ALLOW, a regex)
const LAN = new RegExp(process.env.CLIENT_API_ALLOW || '^(::ffff:)?(10\\.\\d+\\.\\d+\\.\\d+|192\\.168\\.\\d+\\.\\d+|172\\.(1[6-9]|2\\d|3[01])\\.\\d+\\.\\d+)$');

let client, hooks, KEY;
const sockets = new Set();
let voice = null; // { guildId, vcId, conn, owner(ws), subs: Map, onStart, onEnd, watcher }

function loadKey() {
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true, mode: 0o700 });
  if (!fs.existsSync(KEY_FILE)) fs.writeFileSync(KEY_FILE, crypto.randomBytes(32).toString('hex') + '\n', { mode: 0o600 });
  fs.chmodSync(KEY_FILE, 0o600);
  return Buffer.from(fs.readFileSync(KEY_FILE, 'utf8').trim());
}
function keyOk(k) {
  if (!k) return false;
  const b = Buffer.from(String(k));
  return b.length === KEY.length && crypto.timingSafeEqual(b, KEY);
}
const lanOk = (req) => LAN.test(req.socket.remoteAddress || '') && LAN.test(req.socket.localAddress || '');

// ================================================================ bot-only extras ("Discord client +")
const jsonFile = (name, def) => { const f = path.join(__dirname, name); return { get: () => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } }, set: (v) => fs.writeFileSync(f, JSON.stringify(v)) }; };

// ---- full-history index: every message V1 can read, backfilled politely, searchable with FTS5
let IDX = null;
function idxInit() {
  if (IDX || !hooks.db) return IDX;
  const db = hooks.db;
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS client_fts USING fts5(content, id UNINDEXED, guild UNINDEXED, channel UNINDEXED, author UNINDEXED, name UNINDEXED, ts UNINDEXED, tokenize='unicode61 remove_diacritics 2');
    CREATE TABLE IF NOT EXISTS client_idx (channel TEXT PRIMARY KEY, oldest TEXT, done INTEGER DEFAULT 0, n INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS client_ids (id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS client_threads (id TEXT PRIMARY KEY, parent TEXT, guild TEXT, name TEXT);
    CREATE TABLE IF NOT EXISTS client_names (user TEXT, kind TEXT, value TEXT, at INTEGER, PRIMARY KEY (user, kind, value));`);
  IDX = { ins: db.prepare('INSERT INTO client_fts (content, id, guild, channel, author, name, ts) VALUES (?, ?, ?, ?, ?, ?, ?)'), seen: db.prepare('INSERT OR IGNORE INTO client_ids (id) VALUES (?)'),
    state: db.prepare('SELECT oldest, done, n FROM client_idx WHERE channel = ?'), save: db.prepare('INSERT INTO client_idx (channel, oldest, done, n) VALUES (?, ?, ?, ?) ON CONFLICT(channel) DO UPDATE SET oldest = excluded.oldest, done = excluded.done, n = excluded.n'),
    name: db.prepare('INSERT OR IGNORE INTO client_names (user, kind, value, at) VALUES (?, ?, ?, ?)'),
    thr: db.prepare('INSERT INTO client_threads (id, parent, guild, name) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name'), thrGet: db.prepare('SELECT parent, name FROM client_threads WHERE id = ?') };
  return IDX;
}
function idxMsg(m) {
  if (!idxInit() || !m.guildId || !m.content) return false;
  if (IDX.seen.run(m.id).changes === 0) return false;
  IDX.ins.run(m.content, m.id, m.guildId, m.channelId, m.author?.id ?? '', m.member?.displayName ?? m.author?.globalName ?? m.author?.username ?? '', m.createdTimestamp);
  return true;
}
let backfillBusy = false;
async function backfillStep() { // one request at a time, ~3 per second: well inside a bot's read limits
  if (backfillBusy || !idxInit()) return; backfillBusy = true;
  try {
    for (const g of client.guilds.cache.values()) {
      const me = g.members.me;
      const chans = [...g.channels.cache.values()].filter((c) => c.isTextBased?.() && !c.isThread?.() && c.viewable && c.permissionsFor(me)?.has(PermissionFlagsBits.ReadMessageHistory));
      for (const c of chans) {
        const st = IDX.state.get(c.id) || { oldest: null, done: 0, n: 0 };
        if (st.done) continue;
        const got = await c.messages.fetch({ limit: 100, ...(st.oldest ? { before: st.oldest } : {}), cache: false }).catch(() => null);
        if (!got) { IDX.save.run(c.id, st.oldest, 1, st.n); continue; }
        let n = st.n, oldest = st.oldest;
        for (const m of got.values()) { if (idxMsg(m)) n++; if (!oldest || BigInt(m.id) < BigInt(oldest)) oldest = m.id; }
        IDX.save.run(c.id, oldest, got.size < 100 ? 1 : 0, n);
        return; // one fetch per step
      }
    }
    // then threads, active and archived (found by scanThreads), the same way
    if (!thrScanned) { thrScanned = true; await scanThreads(); return; }
    for (const t of THR.values()) {
      const st = IDX.state.get(t.id) || { oldest: null, done: 0, n: 0 };
      if (st.done) { THR.delete(t.id); continue; }
      const got = await t.messages.fetch({ limit: 100, ...(st.oldest ? { before: st.oldest } : {}), cache: false }).catch(() => null);
      if (!got) { IDX.save.run(t.id, st.oldest, 1, st.n); THR.delete(t.id); return; }
      let n = st.n, oldest = st.oldest;
      for (const m of got.values()) { if (idxMsg(m)) n++; if (!oldest || BigInt(m.id) < BigInt(oldest)) oldest = m.id; }
      IDX.save.run(t.id, oldest, got.size < 100 ? 1 : 0, n);
      return;
    }
  } finally { backfillBusy = false; }
}
// every thread V1 can read: active ones plus each channel's archived ones (public, and private where it manages threads)
const THR = new Map(); let thrScanned = false;
const nap = (ms) => new Promise((ok) => setTimeout(ok, ms));
function noteThread(t) { if (!t?.parentId) return; IDX?.thr.run(t.id, t.parentId, t.guildId, t.name); THR.set(t.id, t); }
async function scanThreads() {
  for (const g of client.guilds.cache.values()) {
    const me = g.members.me;
    const a = await g.channels.fetchActiveThreads().catch(() => null); a?.threads.forEach(noteThread); await nap(350);
    for (const c of [...g.channels.cache.values()]) {
      const pm = c.threads && c.viewable && c.permissionsFor(me);
      if (!pm?.has(PermissionFlagsBits.ReadMessageHistory)) continue;
      for (const type of pm.has(PermissionFlagsBits.ManageThreads) ? ['public', 'private'] : ['public']) {
        let before;
        for (let i = 0; i < 100; i++) {
          const r = await c.threads.fetchArchived({ type, limit: 100, ...(before ? { before } : {}) }).catch(() => null); await nap(350);
          if (!r?.threads.size) break;
          r.threads.forEach(noteThread);
          if (!r.hasMore) break;
          before = [...r.threads.values()].reduce((x, y) => ((y.archiveTimestamp ?? 0) < (x.archiveTimestamp ?? 0) ? y : x));
        }
      }
    }
  }
}
// a thread that isn't cached any more (archived): its parent decides who can see it
function chanOrThread(id) {
  const ch = client.channels.cache.get(id); if (ch) return { ch, name: ch.name };
  const t = IDX?.thrGet.get(id); const parent = t && client.channels.cache.get(t.parent);
  return parent ? { ch: parent, name: t.name } : null;
}
function idxStatus() {
  if (!idxInit()) return { ready: false };
  const rows = hooks.db.prepare('SELECT COUNT(*) c, SUM(done) d, SUM(n) n FROM client_idx').get();
  const total = hooks.db.prepare('SELECT COUNT(*) c FROM client_ids').get().c;
  return { channels: rows.c, finished: rows.d ?? 0, messages: total };
}
// search with Discord-style filters: from:name in:#channel has:link before:/after:YYYY-MM-DD
function searchIndex(gid, q) {
  const f = { from: null, in: null, has: null, before: null, after: null };
  const words = [];
  for (const tok of q.match(/\S+:"[^"]+"|\S+/g) || []) {
    const mm = /^(from|in|has|before|after):"?([^"]+)"?$/i.exec(tok);
    if (mm) f[mm[1].toLowerCase()] = mm[2]; else words.push(tok);
  }
  const g = client.guilds.cache.get(gid);
  const where = ['guild = ?'], args = [gid];
  if (words.length) { where.unshift('client_fts MATCH ?'); args.unshift(words.map((w) => '"' + w.replace(/"/g, '""') + '"').join(' ')); }
  if (f.from && g) { const l = f.from.toLowerCase().replace(/^@/, ''); const ids = [...g.members.cache.values()].filter((m) => m.user.username.toLowerCase() === l || m.displayName.toLowerCase().includes(l)).map((m) => m.id); where.push(`author IN (${ids.map(() => '?').join(',') || "''"})`); args.push(...ids); }
  if (f.in && g) { const l = f.in.toLowerCase().replace(/^#/, ''); const ids = [...g.channels.cache.values()].filter((c) => c.name.toLowerCase().includes(l)).map((c) => c.id); where.push(`channel IN (${ids.map(() => '?').join(',') || "''"})`); args.push(...ids); }
  if (f.has === 'link') where.push("content LIKE '%http%'");
  if (f.before) { const t = Date.parse(f.before); if (t) { where.push('CAST(ts AS INTEGER) < ?'); args.push(t); } }
  if (f.after) { const t = Date.parse(f.after); if (t) { where.push('CAST(ts AS INTEGER) > ?'); args.push(t + 864e5); } }
  if (!words.length && !f.from && !f.in && !f.has && !f.before && !f.after) return [];
  return hooks.db.prepare(`SELECT id, channel, author, name, content, ts FROM client_fts WHERE ${where.join(' AND ')} ORDER BY CAST(ts AS INTEGER) DESC LIMIT 80`).all(...args);
}

// ---- name history: every nickname / display name / username V1 has seen a user use
function noteNames(u, m) {
  if (!idxInit() || !u) return;
  const now = Date.now();
  IDX.name.run(u.id, 'username', u.username, now);
  if (u.globalName) IDX.name.run(u.id, 'display', u.globalName, now);
  if (m?.nickname) IDX.name.run(u.id, 'nick:' + m.guild.id, m.nickname, now);
}
function nameHistory(uid) {
  if (!idxInit()) return [];
  const rows = hooks.db.prepare('SELECT kind, value, at FROM client_names WHERE user = ? ORDER BY at').all(uid);
  const seen = hooks.db.prepare('SELECT name value, MIN(ts) at FROM seen WHERE author = ? AND name IS NOT NULL GROUP BY name').all(uid).map((r) => ({ kind: 'seen', value: r.value, at: r.at }));
  const out = new Map();
  for (const r of [...seen, ...rows]) { const k = r.value.toLowerCase(); if (!out.has(k) || r.at < out.get(k).at) out.set(k, { value: r.value, kind: r.kind.startsWith('nick') ? 'nickname' : r.kind === 'seen' ? 'name' : r.kind, at: r.at }); }
  return [...out.values()].sort((a, b) => a.at - b.at);
}

// ---- scheduled messages
const SCHED = jsonFile('client-schedule.json', []);
async function schedTick() {
  const list = SCHED.get(); const now = Date.now(); const due = list.filter((x) => x.at <= now);
  if (!due.length) return;
  SCHED.set(list.filter((x) => x.at > now));
  for (const x of due) {
    try { const ch = await client.channels.fetch(x.channelId); const m = await ch.send({ content: x.content, allowedMentions: { parse: ['users', 'roles', 'everyone'] } }); broadcast({ t: 'scheduledSent', id: x.id, channelId: x.channelId, messageId: m.id }); }
    catch (e) { broadcast({ t: 'alert', kind: 'error', text: `A scheduled message couldn't be sent: ${e.message}` }); }
  }
}

// ---- alerts: keywords, people coming online / joining voice, new accounts, raids
const ALERTS = jsonFile('client-alerts.json', { keywords: [], users: {}, newAccounts: true, raid: true });
const joinTimes = new Map();
function alertHooks(on) {
  on(Events.MessageCreate, (m) => {
    if (!sockets.size || !m.guildId || m.author.bot || !m.content) return;
    const kw = ALERTS.get().keywords || [];
    const hit = kw.find((k) => k && new RegExp(`(^|\\W)${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\W)`, 'i').test(m.content));
    if (hit) broadcast({ t: 'alert', kind: 'keyword', keyword: hit, m: ser(m) });
  });
  on(Events.PresenceUpdate, (b, a) => {
    const w = ALERTS.get().users?.[a.userId]; if (!w?.online || !sockets.size) return;
    if ((b?.status ?? 'offline') === 'offline' && a.status !== 'offline') broadcast({ t: 'alert', kind: 'online', user: who(a.user ?? client.users.cache.get(a.userId), a.guild), guildId: a.guild?.id });
  });
  on(Events.VoiceStateUpdate, (b, a) => {
    const w = ALERTS.get().users?.[a.id]; if (!w?.voice || !sockets.size || !a.channelId || b.channelId === a.channelId) return;
    broadcast({ t: 'alert', kind: 'voice', user: who(a.member.user, a.guild), guildId: a.guild.id, channelId: a.channelId, channel: a.channel?.name });
  });
  on(Events.GuildMemberAdd, (m) => {
    const cfg = ALERTS.get(); if (!sockets.size) return;
    const age = Date.now() - m.user.createdTimestamp;
    if (cfg.newAccounts && age < 7 * 864e5) broadcast({ t: 'alert', kind: 'newAccount', user: who(m.user, m.guild), guildId: m.guild.id, days: Math.floor(age / 864e5) });
    const list = (joinTimes.get(m.guild.id) || []).filter((t) => Date.now() - t < 60000); list.push(Date.now()); joinTimes.set(m.guild.id, list);
    if (cfg.raid && list.length === 5) broadcast({ t: 'alert', kind: 'raid', guildId: m.guild.id, guild: m.guild.name, count: list.length });
  });
  on(Events.GuildMemberUpdate, (b, a) => { if (b.nickname !== a.nickname) noteNames(a.user, a); });
  on(Events.UserUpdate, (b, a) => noteNames(a));
}

// ---- interactive posts: role pickers and sign-up lists (buttons people can press)
const SIGNUPS = jsonFile('client-signups.json', {});
function signupEmbed(s2) {
  return new EmbedBuilder().setColor(0x5865f2).setTitle(s2.title).setDescription(`${s2.desc ? s2.desc + '\n\n' : ''}${s2.people.length ? s2.people.map((id, i) => `${i + 1}. <@${id}>`).join('\n') : '*Nobody yet*'}`)
    .setFooter({ text: `${s2.people.length}${s2.max ? ' / ' + s2.max : ''} signed up` });
}
const signupRow = () => new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('v1c:join').setLabel('Join').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('v1c:leave').setLabel('Leave').setStyle(ButtonStyle.Secondary));
async function handle(i) { // called from the bot's InteractionCreate before its own handlers
  if (!i.isButton?.() || !i.customId.startsWith('v1c:')) return false;
  const [, kind, arg] = i.customId.split(':');
  try {
    if (kind === 'role') {
      const role = i.guild.roles.cache.get(arg); if (!role) { await i.reply({ content: 'That role no longer exists.', flags: MessageFlags.Ephemeral }); return true; }
      const has = i.member.roles.cache.has(role.id);
      if (has) await i.member.roles.remove(role, 'role picker'); else await i.member.roles.add(role, 'role picker');
      await i.reply({ content: has ? `Removed **${role.name}**.` : `Gave you **${role.name}**.`, flags: MessageFlags.Ephemeral });
      return true;
    }
    if (kind === 'join' || kind === 'leave') {
      const all = SIGNUPS.get(); const s2 = all[i.message.id];
      if (!s2) { await i.reply({ content: 'This sign-up has closed.', flags: MessageFlags.Ephemeral }); return true; }
      const had = s2.people.includes(i.user.id);
      if (kind === 'join' && !had) { if (s2.max && s2.people.length >= s2.max) { await i.reply({ content: "It's full.", flags: MessageFlags.Ephemeral }); return true; } s2.people.push(i.user.id); }
      if (kind === 'leave') s2.people = s2.people.filter((x) => x !== i.user.id);
      SIGNUPS.set(all);
      await i.update({ embeds: [signupEmbed(s2)], components: [signupRow()] });
      return true;
    }
  } catch (e) { try { await i.reply({ content: "That didn't work: " + e.message, flags: MessageFlags.Ephemeral }); } catch { /* */ } return true; }
  return false;
}

// ---------------------------------------------------------------- DMs
// Bots can't list their DM channels, so remember who V1 has DMs with.
const DM_FILE = path.join(__dirname, 'client-dms.json');
const dmUsers = new Set((() => { try { return JSON.parse(fs.readFileSync(DM_FILE, 'utf8')); } catch { return []; } })());
const isDM = (ch) => !!ch?.isDMBased?.() && !ch.guild;
function rememberDM(uid) {
  if (!uid || dmUsers.has(uid)) return false;
  dmUsers.add(uid);
  fs.writeFile(DM_FILE, JSON.stringify([...dmUsers]), () => {});
  return true;
}
function dmInfo(ch) {
  const u = ch.recipient ?? client.users.cache.get(ch.recipientId);
  return { id: ch.id, user: who(u), last: ch.lastMessageId ?? '0' };
}
async function dmList() {
  const out = [];
  for (const uid of dmUsers) {
    const u = client.users.cache.get(uid) ?? await client.users.fetch(uid).catch(() => null);
    const ch = u && (u.dmChannel ?? await u.createDM().catch(() => null));
    if (ch) out.push(dmInfo(ch));
  }
  return out.sort((a, b) => (BigInt(b.last) > BigInt(a.last) ? 1 : -1));
}

// V1's status/activity, set from the client's settings; kept across restarts
const PRESENCE_FILE = path.join(__dirname, 'client-presence.json');
let presence = (() => { try { return JSON.parse(fs.readFileSync(PRESENCE_FILE, 'utf8')); } catch { return { status: 'online', activity: null }; } })();
function applyPresence() {
  const act = presence.activity ? [{ type: presence.activity.type, name: presence.activity.name, ...(presence.activity.type === 4 ? { state: presence.activity.name } : {}) }] : [];
  client.user?.setPresence({ status: presence.status, activities: act });
}

// ---------------------------------------------------------------- serialise
const hex = (n) => (n ? '#' + n.toString(16).padStart(6, '0') : null);
const canSee = (ch) => { if (isDM(ch)) return true; const me = ch.guild?.members.me; return me ? ch.permissionsFor(me)?.has(PermissionFlagsBits.ViewChannel) : true; };
const canSend = (ch) => { const me = ch.guild?.members.me; return me ? ch.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages) : true; };

function who(user, guild) {
  if (!user) return null;
  const m = guild?.members.cache.get(user.id);
  const pg = user.primaryGuild;
  const clan = pg?.identityEnabled && pg.tag ? { tag: pg.tag, badge: pg.badge ? `https://cdn.discordapp.com/guild-tag-badges/${pg.identityGuildId}/${pg.badge}.png?size=32` : null } : null;
  const dd = m?.avatarDecorationData ?? user.avatarDecorationData;
  // static by default; the client swaps in the animated version on hover, like Discord (animating everything made scrolling lag)
  const deco = dd?.asset ? `https://cdn.discordapp.com/avatar-decoration-presets/${dd.asset}.png?size=96&passthrough=false` : null;
  const decoAnim = dd?.asset ? `https://cdn.discordapp.com/avatar-decoration-presets/${dd.asset}.png?size=96&passthrough=true` : null;
  const av = m ?? user, animated = (m?.avatar ?? user.avatar)?.startsWith('a_');
  // role gradient (new Discord role styles) and role icon, from the member's top coloured / iconed roles
  const cr = m?.roles?.color, ir = m?.roles?.icon;
  const grad = cr?.colors?.secondaryColor ? [cr.colors.primaryColor, cr.colors.secondaryColor, cr.colors.tertiaryColor].filter((x) => x != null).map(hex) : null;
  const roleIcon = ir ? (ir.icon ? ir.iconURL({ size: 32, extension: 'webp' }) : ir.unicodeEmoji ? { emoji: ir.unicodeEmoji } : null) : null;
  const np = user.collectibles?.nameplate;
  const nameplate = np?.asset ? { img: `https://cdn.discordapp.com/assets/collectibles/${np.asset}static.png`, palette: np.palette ?? null } : null;
  const cs = m?.presence?.clientStatus;
  const platforms = cs ? Object.keys(cs) : [];
  return { id: user.id, name: m?.displayName ?? user.globalName ?? user.username, username: user.username, tag: user.discriminator && user.discriminator !== '0' ? `${user.username}#${user.discriminator}` : user.username, clan, deco, grad, roleIcon, roleIconName: ir?.name ?? null, nameplate, platforms,
    avatar: av.displayAvatarURL({ size: 64, extension: 'webp', forceStatic: true }), avatarAnim: animated ? av.displayAvatarURL({ size: 64, extension: 'webp' }) : null, decoAnim, bot: !!user.bot,
    color: m && m.displayColor ? hex(m.displayColor) : null };
}

function mentionsOf(text, guild) {
  const users = {}, roles = {}, channels = {};
  for (const [, id] of String(text).matchAll(/<@!?(\d+)>/g)) {
    const m = guild?.members.cache.get(id); const u = m?.user ?? client.users.cache.get(id);
    users[id] = { name: m?.displayName ?? u?.globalName ?? u?.username ?? 'unknown-user', avatar: (m ?? u)?.displayAvatarURL({ size: 32, extension: 'webp' }) ?? null };
  }
  for (const [, id] of String(text).matchAll(/<@&(\d+)>/g)) {
    const r = guild?.roles.cache.get(id);
    roles[id] = { name: r?.name ?? 'unknown-role', color: r?.color ? hex(r.color) : null };
  }
  for (const [, id] of String(text).matchAll(/<#(\d+)>/g)) channels[id] = client.channels.cache.get(id)?.name ?? 'unknown';
  return { users, roles, channels };
}

const emojiKey = (e) => (e.id ? `${e.name}:${e.id}` : e.name);
function reactionsOf(m) {
  return [...m.reactions.cache.values()].map((r) => ({
    key: emojiKey(r.emoji), name: r.emoji.name, id: r.emoji.id, animated: !!r.emoji.animated, count: r.count ?? 1, me: !!r.me,
  }));
}

function ser(m) {
  if (!m) return null;
  const guild = m.guild;
  const ref = m.reference?.messageId ? m.channel?.messages.cache.get(m.reference.messageId) : null;
  const text = [m.content, ref?.content ?? '', ...m.embeds.map((e) => `${e.title ?? ''} ${e.description ?? ''} ${(e.fields ?? []).map((f) => f.value).join(' ')}`)].join(' ');
  return {
    id: m.id, channelId: m.channelId, guildId: m.guildId, type: m.type, system: m.system,
    author: who(m.author, guild), ts: m.createdTimestamp, edited: m.editedTimestamp, content: m.content,
    webhook: !!m.webhookId, pinned: !!m.pinned, nonce: m.nonce ?? null,
    reply: m.reference?.messageId ? { id: m.reference.messageId, author: ref ? who(ref.author, guild) : null,
      content: ref ? (ref.content || (ref.attachments.size ? 'attachment' : ref.embeds.length ? 'embed' : '')) : null } : null,
    attachments: [...m.attachments.values()].map((a) => ({ id: a.id, url: a.url, proxy: a.proxyURL, name: a.name, size: a.size, type: a.contentType, w: a.width, h: a.height, spoiler: a.spoiler,
      waveform: a.waveform ?? null, duration: a.duration ?? null })),
    voiceMsg: m.flags?.has?.(MessageFlags.IsVoiceMessage) ?? false,
    embeds: m.embeds.map((e) => e.toJSON()),
    stickers: [...m.stickers.values()].map((s) => ({ name: s.name, url: s.url })),
    reactions: reactionsOf(m),
    components: m.components?.map((c) => c.toJSON()) ?? [],
    forwarded: m.messageSnapshots?.size ? [...m.messageSnapshots.values()].map((x) => ({ content: x.content ?? '', embeds: (x.embeds ?? []).map((e) => e.toJSON?.() ?? e),
      attachments: [...(x.attachments?.values() ?? [])].map((a) => ({ url: a.url, proxy: a.proxyURL, name: a.name, size: a.size, type: a.contentType, w: a.width, h: a.height })) })) : null,
    thread: m.thread ? { id: m.thread.id, name: m.thread.name, count: m.thread.messageCount ?? 0 } : null,
    poll: m.poll ? { question: m.poll.question?.text ?? '', multi: !!m.poll.allowMultiselect, expires: m.poll.expiresTimestamp ?? null, final: !!m.poll.resultsFinalized,
      answers: [...m.poll.answers.values()].map((a) => ({ id: a.id, text: a.text ?? '', emoji: a.emoji ? { id: a.emoji.id, name: a.emoji.name, animated: !!a.emoji.animated } : null, count: a.voteCount ?? 0 })) } : null,
    mentions: mentionsOf(text, guild),
    mentionsMe: m.mentions?.users?.has(client.user.id) ?? false,
    mentionsRole: !!m.guild && (m.mentions?.roles?.some((r) => m.guild.members.me?.roles.cache.has(r.id)) ?? false),
    everyone: !!m.mentions?.everyone,
    replyToMe: !!ref && ref.author?.id === client.user.id,
  };
}

function chanInfo(ch) {
  return { id: ch.id, name: ch.name, type: ch.type, parent: ch.parentId, pos: ch.rawPosition ?? ch.position ?? 0, last: ch.lastMessageId ?? null,
    topic: ch.topic ?? null, send: canSend(ch), nsfw: !!ch.nsfw,
    manage: !!(ch.guild && ch.permissionsFor(ch.guild.members.me)?.has(PermissionFlagsBits.ManageMessages)),
    rules: !!ch.guild && ch.id === ch.guild.rulesChannelId,
    locked: !!ch.guild && (ch.isThread?.() ? !!ch.locked : !!ch.permissionOverwrites?.cache.get(ch.guild.id)?.deny.has(PermissionFlagsBits.SendMessages)),
    threadManage: !!ch.isThread?.() && !!ch.permissionsFor(ch.guild.members.me)?.has(PermissionFlagsBits.ManageThreads),
    private: !!ch.guild && !ch.isThread() && !ch.permissionsFor(ch.guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel),
    since: vcSince.get(ch.id) ?? null };
}
function voiceMembers(vc) {
  return [...vc.members.values()].map((m) => ({ ...who(m.user, vc.guild), mute: !!(m.voice.selfMute || m.voice.serverMute),
    deaf: !!(m.voice.selfDeaf || m.voice.serverDeaf), stream: !!m.voice.streaming, video: !!m.voice.selfVideo }));
}
const STATUS = { online: 0, idle: 1, dnd: 2 };
const approvals = new Map(); // id -> resolve(ok)
const vcSince = new Map(); // voice channel id -> when it last went from empty to occupied (call timers)
function membersOf(g) {
  const hoisted = [...g.roles.cache.values()].filter((r) => r.hoist).sort((a, b) => b.position - a.position);
  const roles = hoisted.map((r) => ({ id: r.id, name: r.name, color: r.color ? hex(r.color) : null, icon: r.icon ? r.iconURL({ size: 32, extension: 'webp' }) : null, emoji: r.unicodeEmoji ?? null }));
  const members = [...g.members.cache.values()].map((m) => {
    const top = hoisted.find((r) => m.roles.cache.has(r.id));
    const st = m.presence?.status ?? 'offline';
    return { ...who(m.user, g), status: st, hoist: top?.id ?? null,
      activity: m.presence?.activities?.find((a) => a.type !== 4)?.name ?? null, actType: m.presence?.activities?.find((a) => a.type !== 4)?.type ?? 0,
      custom: m.presence?.activities?.find((a) => a.type === 4)?.state ?? null };
  });
  const inVoice = g.voiceStates.cache.filter((v) => v.channelId).size;
  return { roles, members, counts: { online: members.filter((x) => x.status !== 'offline').length, total: g.memberCount, voice: inVoice } };
}
function profileOf(g, uid) {
  const m = g?.members.cache.get(uid);
  const u = m?.user ?? client.users.cache.get(uid);
  if (!u) return null;
  const acts = m?.presence?.activities ?? [];
  const act = acts.find((x) => x.type !== 4);
  return { ...who(u, g), status: m?.presence?.status ?? 'offline', joined: m?.joinedTimestamp ?? null, created: u.createdTimestamp,
    flags: u.flags?.toArray?.() ?? [], custom: acts.find((x) => x.type === 4)?.state ?? null,
    activity: act ? { type: act.type, name: act.name, details: act.details ?? null, state: act.state ?? null, since: act.timestamps?.start?.getTime?.() ?? null, image: act.assets?.largeImageURL?.() ?? null } : null,
    names: nameHistory(uid).filter((x) => x.value !== (m?.displayName ?? u.globalName ?? u.username) && x.value !== u.username).slice(-8),
    guildIcon: g?.iconURL({ size: 32 }) ?? null, guildName: g?.name ?? null, canRoles: !!g?.members.me?.permissions.has(PermissionFlagsBits.ManageRoles),
    banner: u.bannerURL?.({ size: 1024 }) ?? null, accent: u.hexAccentColor ?? null,
    mutual: [...client.guilds.cache.values()].filter((x) => x.members.cache.has(uid)).map((x) => ({ id: x.id, name: x.name, icon: x.iconURL({ size: 64, extension: 'webp' }), nick: x.members.cache.get(uid)?.nickname ?? null })),
    roles: m ? [...m.roles.cache.values()].filter((r) => r.id !== g.id).sort((a, b) => b.position - a.position).map((r) => ({ id: r.id, name: r.name, color: r.color ? hex(r.color) : null })) : [] };
}
function guildInfo(g) {
  // like Discord: only threads V1 has joined, and never forum posts (a forum shows as one channel)
  const threads = [...g.channels.cache.values()].filter((c) => c.isThread() && !c.archived && c.joined && canSee(c)
    && ![ChannelType.GuildForum, ChannelType.GuildMedia].includes(c.parent?.type)).map((c) => ({ ...chanInfo(c), thread: true }));
  const chans = [...g.channels.cache.values()].filter((c) => !c.isThread() && canSee(c)
    && [ChannelType.GuildCategory, ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice, ChannelType.GuildForum, ChannelType.GuildMedia].includes(c.type));
  return {
    id: g.id, name: g.name, icon: g.iconURL({ size: 64, extension: 'webp' }), owner: g.ownerId,
    total: g.memberCount, online: g.presences.cache.filter((x) => x.status !== 'offline').size,
    channels: [...chans.map(chanInfo), ...threads],
    stickers: [...g.stickers.cache.values()].map((x) => ({ id: x.id, name: x.name, url: x.url })),
    webhooks: !!g.members.me?.permissions.has(PermissionFlagsBits.ManageWebhooks),
    voice: Object.fromEntries(chans.filter((c) => c.isVoiceBased()).map((c) => [c.id, voiceMembers(c)])),
    emojis: [...g.emojis.cache.values()].map((e) => ({ id: e.id, name: e.name, animated: !!e.animated })),
    roles: Object.fromEntries([...g.roles.cache.values()].map((r) => [r.id, { name: r.name, color: r.color ? hex(r.color) : null }])),
    me: who(client.user, g),
  };
}

// ---------------------------------------------------------------- broadcast
function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast(obj) { const s = JSON.stringify(obj); for (const ws of sockets) if (ws.readyState === 1) ws.send(s); }

function onGifWarm(on) {
  on(Events.MessageCreate, (m) => { if (m.guildId || isDM(m.channel)) { warmMessage(m); attKeep(m); } });
  on(Events.MessageUpdate, (_b, m) => { if (m.embeds?.length) warmMessage(m); }); // Discord adds GIF embeds a moment after the message
}
function hookEvents(on) {
  onGifWarm(on);
  on(Events.MessageCreate, async (m) => {
    if (!m.guildId && !isDM(m.channel)) return;
    if (!m.guildId) {
      if (m.channel.partial) await m.channel.fetch().catch(() => {});
      if (rememberDM(m.channel.recipientId ?? m.author.id)) broadcast({ t: 'dm', dm: dmInfo(m.channel) });
    }
    if (sockets.size) broadcast({ t: 'msg', m: ser(m) });
  });
  on(Events.MessageUpdate, async (_b, m) => {
    if (!sockets.size || (!m.guildId && !isDM(m.channel))) return;
    try { if (m.partial) m = await m.fetch(); } catch { return; }
    broadcast({ t: 'msgUpdate', m: ser(m) });
  });
  on(Events.MessageDelete, (m) => { if (sockets.size && (m.guildId || isDM(m.channel))) broadcast({ t: 'msgDelete', channelId: m.channelId, id: m.id }); });
  on(Events.MessageBulkDelete, (ms, ch) => { if (sockets.size) for (const id of ms.keys()) broadcast({ t: 'msgDelete', channelId: ch.id, id }); });
  const react = async (r, user, added) => {
    if (!sockets.size || (!r.message.guildId && !isDM(r.message.channel))) return;
    let count = r.count, me = !!r.me;
    if (r.partial || r.message.partial || count == null) { // only ask Discord when the cache doesn't know (V1 reacts to every count; a fetch each time would hit rate limits)
      try { const fresh = await r.message.channel.messages.fetch({ message: r.message.id, force: true }); const fr = fresh.reactions.cache.get(r.emoji.id ?? r.emoji.name); count = fr?.count ?? 0; me = !!fr?.me; }
      catch { count = count ?? 0; }
    }
    broadcast({ t: 'reaction', channelId: r.message.channelId, id: r.message.id,
      r: { key: emojiKey(r.emoji), name: r.emoji.name, id: r.emoji.id, animated: !!r.emoji.animated, count, me },
      by: user && user.id !== client.user.id ? who(user, r.message.guild) : null, authorId: r.message.author?.id ?? null, added });
  };
  on(Events.MessageReactionAdd, (r, u) => react(r, u, true));
  const pollVote = async (ans) => {
    if (!sockets.size) return;
    try { const msg = await ans.poll.message.fetch(true); broadcast({ t: 'msgUpdate', m: ser(msg) }); } catch { /* gone */ }
  };
  on(Events.MessagePollVoteAdd, pollVote);
  on(Events.MessagePollVoteRemove, pollVote);
  on(Events.MessageReactionRemove, (r, u) => react(r, u, false));
  on(Events.MessageReactionRemoveAll, (m) => broadcast({ t: 'reactionsClear', channelId: m.channelId, id: m.id }));
  on(Events.TypingStart, (ty) => {
    if (!sockets.size || ty.user.id === client.user.id) return;
    broadcast({ t: 'typing', channelId: ty.channel.id, user: who(ty.user, ty.guild) });
  });
  on(Events.VoiceStateUpdate, (b, a) => {
    const g = a.guild ?? b.guild;
    for (const id of [b.channelId, a.channelId]) { if (!id) continue; const vc = g.channels.cache.get(id); const n = vc?.members.size ?? 0; if (n && !vcSince.has(id)) vcSince.set(id, Date.now()); if (!n) vcSince.delete(id); }
    if (!sockets.size) return;
    const ids = new Set([b.channelId, a.channelId].filter(Boolean));
    const voiceMap = {};
    for (const id of ids) { const vc = g.channels.cache.get(id); if (vc && canSee(vc)) voiceMap[id] = voiceMembers(vc); }
    broadcast({ t: 'voiceStates', guildId: g.id, voice: voiceMap, since: Object.fromEntries([...ids].map((id) => [id, vcSince.get(id) ?? null])) });
  });
  const chUp = (c) => { if (sockets.size && c.guild) broadcast({ t: 'guild', g: guildInfo(c.guild) }); };
  on(Events.ThreadCreate, chUp); on(Events.ThreadDelete, chUp); on(Events.ThreadUpdate, (_b, c) => chUp(c));
  on(Events.ChannelCreate, chUp); on(Events.ChannelDelete, chUp); on(Events.ChannelUpdate, (_b, c) => chUp(c));
  on(Events.PresenceUpdate, (_b, p) => {
    if (!sockets.size || !p.guild) return;
    broadcast({ t: 'presence', guildId: p.guild.id, userId: p.userId, status: p.status,
      activity: p.activities?.find((a) => a.type !== 4)?.name ?? null, actType: p.activities?.find((a) => a.type !== 4)?.type ?? 0, custom: p.activities?.find((a) => a.type === 4)?.state ?? null });
  });
  on(Events.GuildMemberAdd, (m) => broadcast({ t: 'membersStale', guildId: m.guild.id }));
  on(Events.GuildMemberRemove, (m) => broadcast({ t: 'membersStale', guildId: m.guild.id }));
  on(Events.GuildCreate, (g) => broadcast({ t: 'guild', g: guildInfo(g) }));
  on(Events.GuildDelete, (g) => broadcast({ t: 'guildGone', id: g.id }));
}

// ---------------------------------------------------------------- voice
// Voice lock: while the client is open, V1's own voice features (follow, TTS, music) stay off and V1 leaves any VC.
const LOCK_FILE = path.join(__dirname, 'client-voicelock.json');
let lockOn = (() => { try { return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')).on !== false; } catch { return true; } })();
const locked = () => lockOn && sockets.size > 0;
const owns = (guildId) => (!!voice && voice.guildId === guildId) || locked();
function kickPiVoice() { // drop every V1 voice session except the one the client is using
  for (const gid of [...hooks.sessions.keys()]) {
    if (voice?.guildId === gid) continue;
    getVoiceConnection(gid)?.destroy();
    hooks.dropSession(gid);
    console.log('client voice lock: V1 left voice in ' + (client.guilds.cache.get(gid)?.name ?? gid));
  }
}
function releasePiVoice() {
  for (const g of client.guilds.cache.values()) hooks.followVoice(g).catch(() => {});
}

const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play, maxMissedFrames: 15 } });
player.on('error', (e) => console.error('client voice player:', e.message));
player.on('stateChange', (o, n) => { if (voice && o.status !== n.status) broadcast({ t: 'selfSpeaking', on: n.status === AudioPlayerStatus.Playing }); });

// One "spurt" per stretch of talking: the browser sends frames while the key is held / the gate is open.
const stats = { framesIn: 0, spurts: 0, played: 0, lastAt: 0 };
let spurt = null; // { stream, pre: [], idle timer }
function endSpurt() {
  if (!spurt) return;
  clearTimeout(spurt.idle);
  if (spurt.stream) spurt.stream.push(null);
  spurt = null;
}
function onMicFrame(pkt) {
  stats.framesIn++; stats.lastAt = Date.now();
  if (!voice) return;
  if (!spurt) spurt = { stream: null, pre: [], idle: null };
  clearTimeout(spurt.idle);
  spurt.idle = setTimeout(endSpurt, 250);
  if (!spurt.stream) {
    spurt.pre.push(pkt);
    if (spurt.pre.length < 2) return; // 40 ms of cushion against wifi jitter
    spurt.stream = new Readable({ objectMode: true, read() {} });
    for (const p of spurt.pre) spurt.stream.push(p);
    spurt.pre = [];
    player.play(createAudioResource(spurt.stream, { inputType: StreamType.Opus }));
    if (++stats.spurts <= 3) console.log(`client voice: talking (player ${player.state.status}, conn ${voice.conn.state.status}, subs ${player.playable.length})`);
    return;
  }
  spurt.stream.push(pkt);
  while (spurt.stream.readableLength > 8) spurt.stream.read(); // never let lag build up past ~160 ms
}

function listen(conn) {
  const rx = conn.receiver;
  const subs = new Map();
  const onStart = (uid) => {
    broadcast({ t: 'speaking', guildId: voice?.guildId, userId: uid, on: true });
    if (uid === client.user.id || subs.has(uid)) return;
    const st = rx.subscribe(uid, { end: { behavior: EndBehaviorType.AfterSilence, duration: 2000 } });
    const head = Buffer.alloc(9); head[0] = 1; head.writeBigUInt64BE(BigInt(uid), 1);
    st.on('data', (op) => {
      const ws = voice?.owner;
      if (!ws || ws.readyState !== 1 || ws.bufferedAmount > 96_000) return;
      ws.send(Buffer.concat([head, op]));
    });
    const done = () => { subs.delete(uid); };
    st.on('end', done); st.on('close', done); st.on('error', done);
    subs.set(uid, st);
  };
  const onEnd = (uid) => broadcast({ t: 'speaking', guildId: voice?.guildId, userId: uid, on: false });
  rx.speaking.on('start', onStart);
  rx.speaking.on('end', onEnd);
  return { subs, stop() { rx.speaking.off('start', onStart); rx.speaking.off('end', onEnd); for (const s of subs.values()) s.destroy(); subs.clear(); } };
}

function voiceStatus() {
  return voice ? { guildId: voice.guildId, channelId: voice.vcId, status: voice.conn.state.status } : null;
}

async function joinVoice(ws, vcId) {
  const vc = client.channels.cache.get(vcId);
  if (!vc?.isVoiceBased()) throw new Error('not a voice channel');
  const me = vc.guild.members.me;
  const perms = vc.permissionsFor(me);
  if (!perms?.has(PermissionFlagsBits.Connect) || !perms.has(PermissionFlagsBits.Speak)) throw new Error('V1 cannot connect or speak there');
  if (voice && voice.guildId !== vc.guild.id) await leaveVoice('switching server');
  if (voice && voice.vcId === vc.id) { voice.owner = ws; send(ws, { t: 'voice', v: voiceStatus() }); return; }

  const s = hooks.sessions.get(vc.guild.id); // V1's TTS/music session, if it has one there
  if (voice) { voice.listener.stop(); voice.conn.off('stateChange', voice.watch); }
  const was = !voice;
  voice = { guildId: vc.guild.id, vcId: vc.id, conn: null, owner: ws, listener: null, watch: null };
  const conn = joinVoiceChannel({ channelId: vc.id, guildId: vc.guild.id, adapterCreator: vc.guild.voiceAdapterCreator, selfDeaf: false, selfMute: false });
  if (s) { s.tts.length = 0; s.vcId = vc.id; s.conn = conn; } // its queued TTS is stale by the time it'd be heard
  else conn.on(VoiceConnectionStatus.Disconnected, () => { try { conn.destroy(); } catch { /* gone */ } });
  voice.conn = conn;
  conn.subscribe(player); // TTS/music player loses its subscriber and auto-pauses until we hand back
  voice.listener = listen(conn);
  voice.watch = (_o, n) => {
    if (n.status === VoiceConnectionStatus.Destroyed && voice?.conn === conn) { cleanup(); broadcast({ t: 'voice', v: null, why: 'disconnected' }); }
  };
  conn.on('stateChange', voice.watch);
  try { await entersState(conn, VoiceConnectionStatus.Ready, 15_000); } catch { /* status is reported either way */ }
  if (was) console.log(`client voice: took over in ${vc.name}`);
  broadcast({ t: 'voice', v: voiceStatus() });
}

function cleanup() {
  if (!voice) return;
  endSpurt();
  player.stop(true);
  voice.listener?.stop();
  voice.conn.off('stateChange', voice.watch);
  voice = null;
}

async function leaveVoice(why = 'left') {
  if (!voice) return;
  const { guildId, conn } = voice;
  cleanup();
  const s = hooks.sessions.get(guildId);
  const guild = client.guilds.cache.get(guildId);
  if (s && !locked() && conn.state.status !== VoiceConnectionStatus.Destroyed && guild) {
    s.tts.length = 0;
    joinVoiceChannel({ channelId: s.vcId, guildId, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true, selfMute: false });
    conn.subscribe(s.player); // TTS / music picks up where it paused
  } else {
    if (conn.state.status !== VoiceConnectionStatus.Destroyed) conn.destroy();
    if (s) hooks.dropSession(guildId);
  }
  console.log(`client voice: handed back (${why})`);
  broadcast({ t: 'voice', v: null, why });
  if (guild && !locked()) hooks.followVoice(guild).catch((e) => console.error('client voice handback:', e.message));
}

// ---------------------------------------------------------------- http
// Discord's error codes in plain English, so the client can say WHY something failed
const REASONS = {
  10003: 'That channel no longer exists.', 10004: 'V1 is not in that server any more.', 10007: 'That person is not in this server.', 10008: 'That message was already deleted.',
  10011: 'That role no longer exists.', 10013: 'Discord has no user with that ID.', 10014: 'That emoji no longer exists.', 10026: 'That person is not banned.', 10060: 'That sticker no longer exists.',
  20028: 'Discord is rate limiting V1 here. Wait a few seconds and try again.', 30005: 'This server already has the maximum of 250 roles.', 30007: 'This channel already has the maximum of 15 webhooks.',
  30008: 'This server has no free emoji slots left (boost level decides how many).', 30010: 'That message already has 20 different reactions.', 30013: 'This server already has the maximum number of channels.',
  30039: 'This server has no free sticker slots left.', 40005: 'That file is too big for this server (10 MB without boosts).', 40058: 'That message is too old to forward or crosspost.',
  50001: 'V1 cannot see that channel (no View Channel permission there).', 50005: 'V1 can only edit its own messages.', 50006: 'Discord will not send an empty message.',
  50007: 'Cannot DM them: they have DMs from server members turned off, or share no server with V1.', 50008: 'Messages cannot be sent in a voice channel V1 is not allowed to post in.',
  50013: 'V1 does not have permission to do that here.', 50021: 'System messages cannot be edited or deleted.', 50024: 'That cannot be done in this kind of channel.',
  50034: 'Bulk delete only works on messages younger than 14 days.', 50035: 'Discord rejected some of the values.', 50045: 'That file is too big.', 50046: 'That image is not a valid PNG, JPG or GIF.',
  50055: 'Invalid server.', 50083: 'That thread is archived.', 50101: 'Only server owners can do that (V1 is not the owner).', 160002: 'That message already has a thread.',
  160004: 'A thread was already started from that message.', 170005: 'That sticker is not allowed in this server.',
};
const NEEDS = { '/kick': 'Kick Members', '/ban': 'Ban Members', '/timeout': 'Timeout Members', '/role': 'Manage Roles (and the role must be below V1\'s top role)', '/nick': 'Manage Nicknames',
  '/pin': 'Pin Messages', '/purge': 'Manage Messages', '/noembeds': 'Manage Messages', 'manage/roles': 'Manage Roles', 'manage/channels': 'Manage Channels', 'manage/emojis': 'Manage Expressions',
  'manage/stickers': 'Manage Expressions', 'manage/invites': 'Manage Server', 'manage/bans': 'Ban Members', 'manage/audit': 'View Audit Log', 'manage/webhooks': 'Manage Webhooks', 'manage/overview': 'Manage Server',
  '/reactions': 'Add Reactions', '/thread': 'Create Public Threads', '/messages': 'Send Messages' };
function explain(e, path) {
  let why = REASONS[e.code] ?? null;
  if (e.code === 50013) { const k = Object.keys(NEEDS).find((x) => path.includes(x)); if (k) why = `V1 does not have permission to do that here. It needs: ${NEEDS[k]}.`; if (/role|kick|ban|timeout|nick/.test(path)) why += ' It also cannot act on people whose top role is above V1\'s.'; }
  if (e.code === 50035 && e.rawError?.errors) why += ' ' + JSON.stringify(e.rawError.errors).match(/"message":"([^"]+)"/)?.[1];
  if (!why && /ECONN|ETIMEDOUT|ENOTFOUND|fetch failed/i.test(e.message)) why = 'The Pi could not reach Discord just then (internet blip). Try again.';
  if (!why && e.status === 429) why = 'Discord is rate limiting V1. Wait a moment.';
  return why ? `${why}` : e.message;
}
function reply(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json', ...cors() });
  res.end(JSON.stringify(body));
}
function cors() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS', 'Access-Control-Allow-Private-Network': 'true' };
}
function body(req, limit = 30 * 1024 * 1024) {
  return new Promise((ok, bad) => {
    const parts = []; let n = 0;
    req.on('data', (d) => { n += d.length; if (n > limit) { bad(new Error('too big')); req.destroy(); } else parts.push(d); });
    req.on('end', () => { try { ok(n ? JSON.parse(Buffer.concat(parts)) : {}); } catch (e) { bad(e); } });
    req.on('error', bad);
  });
}
async function textChannel(id) { // cache first, then ask Discord (DMs and threads aren't cached after a restart)
  let ch = client.channels.cache.get(id);
  if (!ch) ch = await client.channels.fetch(id).catch(() => null);
  if (!ch) throw Object.assign(new Error('That channel no longer exists, or V1 was removed from it.'), { code: 404 });
  if ((!ch.guild && !isDM(ch)) || !ch.isTextBased()) throw Object.assign(new Error('That isn\'t a channel V1 can read messages in.'), { code: 404 });
  if (!canSee(ch)) throw Object.assign(new Error('V1 can\'t see that channel (no View Channel permission).'), { code: 404 });
  return ch;
}
function emojiParam(s) { return decodeURIComponent(s); }

async function route(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.split('/').filter(Boolean); // api, ...
  if (p[0] !== 'api') return reply(res, 404, { error: 'not found' });
  const M = req.method;

  if (M === 'POST' && p[1] === 'log') { const b = await body(req, 8192); console.error('client ui:', String(b.msg).slice(0, 500)); return reply(res, 200, { ok: true }); }
  if (M === 'GET' && p[1] === 'debug') return reply(res, 200, { ...stats, player: player.state.status, voice: voiceStatus(), playable: player.playable.length });
  if (M === 'GET' && p[1] === 'state') {
    const guilds = [...client.guilds.cache.values()].sort((a, b) => (a.id === process.env.GUILD_ID ? -1 : b.id === process.env.GUILD_ID ? 1 : a.name.localeCompare(b.name)));
    return reply(res, 200, { me: who(client.user), home: process.env.GUILD_ID, guilds: guilds.map(guildInfo), voice: voiceStatus() });
  }
  if (M === 'GET' && p[1] === 'guilds' && p[3] === 'members') {
    const g = client.guilds.cache.get(p[2]); if (!g) return reply(res, 404, { error: 'no such server' });
    return reply(res, 200, membersOf(g));
  }
  if (M === 'GET' && p[1] === 'users' && p[2]) {
    const g = client.guilds.cache.get(url.searchParams.get('guild'));
    if (!g?.members.cache.has(p[2])) await client.users.fetch(p[2], { force: true }).catch(() => {});
    else await client.users.fetch(p[2], { force: true }).catch(() => {});
    const pr = profileOf(g, p[2]);
    return pr ? reply(res, 200, pr) : reply(res, 404, { error: 'no such user' });
  }
  if (p[1] === 'guilds' && p[3] === 'manage') return manage(req, res, url, p, M);
  if (p[1] === 'guilds' && p[3] === 'members' && p[4]) { // server actions, done as V1
    const g = client.guilds.cache.get(p[2]); if (!g) return reply(res, 404, { error: 'no such server' });
    const me = g.members.me;
    const mem = await g.members.fetch(p[4]).catch(() => null);
    const act = p[5];
    if (M === 'GET' && act === 'roles') {
      const top = me.roles.highest.position;
      return reply(res, 200, { roles: [...g.roles.cache.values()].filter((r) => r.id !== g.id).sort((a, b) => b.position - a.position)
        .map((r) => ({ id: r.id, name: r.name, color: r.color ? hex(r.color) : null, has: !!mem?.roles.cache.has(r.id), can: !r.managed && r.position < top })),
        perms: { kick: me.permissions.has(PermissionFlagsBits.KickMembers), ban: me.permissions.has(PermissionFlagsBits.BanMembers), timeout: me.permissions.has(PermissionFlagsBits.ModerateMembers), roles: me.permissions.has(PermissionFlagsBits.ManageRoles), nick: me.permissions.has(PermissionFlagsBits.ManageNicknames) },
        timedOut: mem?.communicationDisabledUntilTimestamp > Date.now() ? mem.communicationDisabledUntilTimestamp : null });
    }
    if (M !== 'POST') return reply(res, 404, { error: 'not found' });
    const b = await body(req);
    const reason = b.reason ? String(b.reason).slice(0, 400) : 'via V1 Client';
    if (act === 'ban') { await g.members.ban(p[4], { reason, deleteMessageSeconds: Math.min(604800, Number(b.deleteSeconds) || 0) }); return reply(res, 200, { ok: true }); }
    if (!mem) return reply(res, 404, { error: 'not in this server' });
    if (act === 'kick') await mem.kick(reason);
    else if (act === 'timeout') await mem.timeout(b.ms ? Math.min(Number(b.ms), 28 * 864e5) : null, reason);
    else if (act === 'role') { if (b.add) await mem.roles.add(b.roleId, reason); else await mem.roles.remove(b.roleId, reason); }
    else if (act === 'nick') await mem.setNickname(b.nick || null, reason);
    else return reply(res, 404, { error: 'unknown action' });
    return reply(res, 200, { ok: true });
  }
  if (M === 'PATCH' && p[1] === 'guilds' && p[3] === 'nick') {
    const g = client.guilds.cache.get(p[2]); if (!g) return reply(res, 404, { error: 'no such server' });
    const b = await body(req); await g.members.me.setNickname(b.nick || null);
    return reply(res, 200, { ok: true });
  }
  if (p[1] === 'me') { // V1's own profile: username, avatar, banner, About Me (= the app description)
    if (M === 'POST') {
      const b = await body(req);
      if (b.username) await client.user.setUsername(String(b.username).slice(0, 32));
      if (b.avatar) await client.user.setAvatar(Buffer.from(b.avatar, 'base64'));
      if (b.banner) await client.user.setBanner(Buffer.from(b.banner, 'base64'));
      if (b.about != null) await client.application.edit({ description: String(b.about).slice(0, 400) });
    }
    const app = await client.application.fetch();
    const u = await client.user.fetch(true);
    return reply(res, 200, { username: u.username, avatar: u.displayAvatarURL({ size: 256, extension: 'webp' }), banner: u.bannerURL({ size: 1024 }) ?? null,
      accent: u.hexAccentColor ?? null, about: app.description ?? '', id: u.id, created: u.createdTimestamp });
  }
  if (p[1] === 'presence') {
    if (M === 'POST') { const b = await body(req); presence = { status: b.status || 'online', activity: b.activity?.name ? { type: Number(b.activity.type) || 0, name: String(b.activity.name).slice(0, 120) } : null }; applyPresence(); fs.writeFile(PRESENCE_FILE, JSON.stringify(presence), () => {}); }
    return reply(res, 200, presence);
  }
  if (p[1] === 'voicelock') {
    if (M === 'POST') {
      const b = await body(req); lockOn = !!b.on; fs.writeFile(LOCK_FILE, JSON.stringify({ on: lockOn }), () => {});
      if (lockOn) kickPiVoice(); else releasePiVoice();
    }
    return reply(res, 200, { on: lockOn });
  }
  if (p[1] === 'gifs') { // Discord's own GIF search answers bot tokens too
    const FAV = path.join(__dirname, 'client-favgifs.json');
    const favs = () => { try { return JSON.parse(fs.readFileSync(FAV, 'utf8')); } catch { return []; } };
    if (p[2] === 'favs') {
      let list = favs();
      if (M === 'POST') { const b = await body(req); list = [{ url: b.url, src: b.src, w: b.w || 0, h: b.h || 0, order: Date.now() }, ...list.filter((x) => x.url !== b.url)]; fs.writeFileSync(FAV, JSON.stringify(list)); }
      if (M === 'DELETE') { const u = url.searchParams.get('url'); list = list.filter((x) => x.url !== u); fs.writeFileSync(FAV, JSON.stringify(list)); }
      return reply(res, 200, { gifs: list });
    }
    const prov = ['tenor', 'giphy', 'klipy'].includes(url.searchParams.get('provider')) ? url.searchParams.get('provider') : 'klipy';
    const q = url.searchParams.get('q');
    const shape = (x) => ({ url: x.url, src: x.src, gif: x.gif_src ?? null, w: x.width, h: x.height });
    if (p[2] === 'search' && q) return reply(res, 200, { gifs: (await client.rest.get('/gifs/search', { query: new URLSearchParams({ q, media_format: 'mp4', provider: prov, locale: 'en-GB' }) })).map(shape) });
    if (p[2] === 'trending') {
      const t = await client.rest.get('/gifs/trending', { query: new URLSearchParams({ media_format: 'mp4', provider: prov, locale: 'en-GB' }) });
      const gifs = await client.rest.get('/gifs/trending-gifs', { query: new URLSearchParams({ media_format: 'mp4', provider: prov, locale: 'en-GB' }) }).catch(() => []);
      return reply(res, 200, { categories: (t.categories || []).map((c) => ({ name: c.name, src: c.src })), gifs: gifs.map(shape) });
    }
    return reply(res, 404, { error: 'unknown gif call' });
  }
  if (p[1] === 'approve') { // the Claude panel's destructive actions wait here until the owner clicks Allow or Deny in the client
    if (M === 'POST' && !p[2]) {
      const b = await body(req);
      const id = crypto.randomBytes(6).toString('hex');
      const ok = await new Promise((done) => {
        const t = setTimeout(() => { approvals.delete(id); broadcast({ t: 'approveGone', id }); done(false); }, 120000);
        approvals.set(id, (v) => { clearTimeout(t); approvals.delete(id); done(v); });
        broadcast({ t: 'approve', id, text: String(b.text || 'a destructive action').slice(0, 300), tool: b.tool });
        if (!sockets.size) { approvals.get(id)?.(false); }
      });
      return reply(res, 200, { ok });
    }
    if (M === 'POST' && p[2]) { const f = approvals.get(p[2]); const b = await body(req); if (f) f(!!b.ok); broadcast({ t: 'approveGone', id: p[2] }); return reply(res, 200, { ok: !!f }); }
  }
  if (p[1] === 'schedule') {
    if (M === 'POST') { const b = await body(req); const x = { id: crypto.randomBytes(5).toString('hex'), channelId: b.channelId, content: String(b.content).slice(0, 2000), at: Number(b.at) }; if (!(x.at > Date.now())) throw new Error('Pick a time in the future.'); await textChannel(x.channelId); SCHED.set([...SCHED.get(), x]); return reply(res, 200, x); }
    if (M === 'DELETE' && p[2]) { SCHED.set(SCHED.get().filter((x) => x.id !== p[2])); return reply(res, 200, { ok: true }); }
    return reply(res, 200, { list: SCHED.get().map((x) => ({ ...x, channel: client.channels.cache.get(x.channelId)?.name ?? 'DM' })) });
  }
  if (p[1] === 'alerts') { if (M === 'POST') ALERTS.set({ ...ALERTS.get(), ...(await body(req)) }); return reply(res, 200, ALERTS.get()); }
  if (M === 'GET' && p[1] === 'index') return reply(res, 200, idxStatus());
  if (M === 'GET' && p[1] === 'names' && p[2]) return reply(res, 200, { names: nameHistory(p[2]) });
  if (p[1] === 'voice' && p[2] && M === 'POST') { // move / mute / deafen / disconnect one person or everyone in a voice channel
    const b = await body(req); const g = client.guilds.cache.get(p[2]); if (!g) throw Object.assign(new Error('no such server'), { code: 404 });
    let targets = [];
    if (b.userId) { const m = await g.members.fetch(b.userId); if (!m.voice.channelId) throw new Error("They're not in a voice channel."); targets = [m]; }
    else if (b.channelId) targets = [...(g.channels.cache.get(b.channelId)?.members?.values() ?? [])].filter((m) => m.id !== client.user.id);
    let n = 0;
    for (const m of targets) {
      if (b.action === 'move') await m.voice.setChannel(b.to, 'V1 Client');
      else if (b.action === 'mute') await m.voice.setMute(!!b.on, 'V1 Client');
      else if (b.action === 'deafen') await m.voice.setDeaf(!!b.on, 'V1 Client');
      else if (b.action === 'disconnect') await m.voice.disconnect('V1 Client');
      n++;
    }
    return reply(res, 200, { done: n });
  }
  if (M === 'GET' && p[1] === 'search') {
    const q = String(url.searchParams.get('q') || '').trim(); const gid = url.searchParams.get('guild');
    if (!q || !hooks.db) return reply(res, 200, { results: [] });
    let rows0 = []; try { rows0 = searchIndex(gid, q); } catch { /* bad FTS syntax: fall back */ }
    if (rows0.length || /\b(from|in|has|before|after):/i.test(q)) {
      const g0 = client.guilds.cache.get(gid);
      return reply(res, 200, { index: idxStatus(), results: rows0.filter((r) => { const c = chanOrThread(r.channel); return c && canSee(c.ch); }).map((r) => {
        const u = client.users.cache.get(r.author);
        return { id: r.id, channelId: r.channel, channel: chanOrThread(r.channel)?.name, content: r.content, ts: Number(r.ts), author: u ? who(u, g0) : { id: r.author, name: r.name, avatar: null } };
      }) });
    }
    const rows = hooks.db.prepare("SELECT id, channel, author, name, content, ts FROM seen WHERE guild = ? AND content LIKE ? ESCAPE '\\' ORDER BY ts DESC LIMIT 50")
      .all(gid, '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%');
    const g = client.guilds.cache.get(gid);
    return reply(res, 200, { results: rows.filter((r) => { const ch = client.channels.cache.get(r.channel); return ch && canSee(ch); }).map((r) => {
      const u = client.users.cache.get(r.author);
      return { id: r.id, channelId: r.channel, channel: client.channels.cache.get(r.channel)?.name, content: r.content, ts: r.ts, author: u ? who(u, g) : { id: r.author, name: r.name, avatar: null } };
    }) });
  }
  if (M === 'GET' && p[1] === 'dms') return reply(res, 200, { dms: await dmList() });
  if (M === 'POST' && p[1] === 'dms') {
    const b = await body(req);
    const u = await client.users.fetch(String(b.userId));
    if (u.bot) throw new Error('cannot DM a bot');
    const ch = await u.createDM();
    rememberDM(u.id);
    return reply(res, 200, { dm: dmInfo(ch) });
  }
  if (p[1] === 'channels' && p[2]) {
    const ch = await textChannel(p[2]);
    if (M === 'GET' && p[3] === 'messages' && !p[4]) {
      const opts = { limit: Math.min(Number(url.searchParams.get('limit')) || 50, 100) };
      for (const k of ['before', 'after', 'around']) if (url.searchParams.get(k)) { opts[k] = url.searchParams.get(k); break; }
      const got = await ch.messages.fetch(opts);
      return reply(res, 200, { messages: [...got.values()].reverse().map(ser) });
    }
    if (M === 'POST' && p[3] === 'messages' && !p[4]) {
      const b = await body(req);
      const files = (b.files ?? []).slice(0, 10).map((f) => new AttachmentBuilder(Buffer.from(f.data, 'base64'), { name: f.name }));
      const out = { content: b.content || undefined, files };
      if (b.nonce) { out.nonce = String(b.nonce).slice(0, 25); out.enforceNonce = true; } // a retried send can't post twice
      if (b.embeds?.length) out.embeds = b.embeds.slice(0, 10);
      if (b.buttons?.length) out.components = [new ActionRowBuilder().addComponents(...b.buttons.slice(0, 5).map((x) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(String(x.label).slice(0, 80)).setURL(x.url)))];
      if (b.stickers?.length) out.stickers = b.stickers.slice(0, 3);
      if (b.tts) out.tts = true;
      if (b.replyTo) out.reply = { messageReference: b.replyTo, failIfNotExists: false };
      out.allowedMentions = { parse: ['users', 'roles', 'everyone'], repliedUser: b.ping !== false };
      out.flags = (b.silent ? MessageFlags.SuppressNotifications : 0) | (b.noEmbeds ? MessageFlags.SuppressEmbeds : 0) || undefined;
      if (b.poll) out.poll = { question: { text: String(b.poll.question).slice(0, 300) }, answers: b.poll.answers.slice(0, 10).map((t) => ({ text: String(t).slice(0, 55) })),
        duration: Math.max(1, Math.min(768, Number(b.poll.hours) || 24)), allowMultiselect: !!b.poll.multi };
      let m;
      if (b.as?.name && !isDM(ch)) { // send as anyone: a webhook with a custom name and avatar
        const parent = ch.isThread() ? ch.parent : ch;
        const hooks = await parent.fetchWebhooks();
        const hook = hooks.find((w) => w.owner?.id === client.user.id && w.name === 'V1 Client') ?? await parent.createWebhook({ name: 'V1 Client' });
        delete out.reply;
        m = await hook.send({ ...out, username: String(b.as.name).slice(0, 80), avatarURL: b.as.avatar || undefined, threadId: ch.isThread() ? ch.id : undefined });
      } else m = await ch.send(out);
      if (isDM(ch)) rememberDM(ch.recipientId);
      return reply(res, 200, { m: ser(m) });
    }
    if (p[3] === 'messages' && p[4]) {
      const m = await ch.messages.fetch(p[4]);
      if (M === 'GET' && !p[5]) return reply(res, 200, { m: ser(m) });
      if (M === 'POST' && p[5] === 'forward') { const b = await body(req); const to = await textChannel(b.to); await m.forward(to); return reply(res, 200, { ok: true }); }
      if (M === 'POST' && p[5] === 'thread') { const b = await body(req); const t = await m.startThread({ name: String(b.name || 'Thread').slice(0, 100) }); return reply(res, 200, { id: t.id }); }
      if (M === 'POST' && p[5] === 'noembeds') { await m.suppressEmbeds(true); return reply(res, 200, { ok: true }); }
      if (M === 'POST' && p[5] === 'publish') { await m.crosspost(); return reply(res, 200, { ok: true }); }
      if (M === 'PUT' && p[5] === 'pin') { await m.pin(); return reply(res, 200, { ok: true }); }
      if (M === 'DELETE' && p[5] === 'pin') { await m.unpin(); return reply(res, 200, { ok: true }); }
      if (M === 'POST' && p[5] === 'endpoll') { await m.poll.end(); return reply(res, 200, { ok: true }); }
      if (M === 'GET' && p[5] === 'reactions' && p[6]) {
        const e = emojiParam(p[6]);
        const r = m.reactions.cache.get(e.includes(':') ? e.split(':')[1] : e);
        const users = r ? await r.users.fetch({ limit: 15 }) : new Map();
        const names = [...users.values()].map((u) => m.guild?.members.cache.get(u.id)?.displayName ?? u.globalName ?? u.username);
        return reply(res, 200, { users: names, more: Math.max(0, (r?.count ?? 0) - names.length) });
      }
      if (M === 'PATCH') { const b = await body(req); const e = await m.edit({ content: b.content }); return reply(res, 200, { m: ser(e) }); }
      if (M === 'DELETE' && !p[5]) { await m.delete(); return reply(res, 200, { ok: true }); }
      if (p[5] === 'reactions' && p[6]) {
        const e = emojiParam(p[6]);
        if (M === 'PUT') await m.react(e);
        if (M === 'DELETE') await client.rest.delete(`/channels/${ch.id}/messages/${m.id}/reactions/${encodeURIComponent(e)}/@me`); // straight to Discord: the cache can miss the reaction and silently skip it
        if (M === 'PUT' || M === 'DELETE') { // send the real counts back so nothing can drift or stack
          const fresh = await ch.messages.fetch({ message: m.id, force: true });
          broadcast({ t: 'msgUpdate', m: ser(fresh) });
          setTimeout(() => ch.messages.fetch({ message: m.id, force: true }).then((f) => broadcast({ t: 'msgUpdate', m: ser(f) }), () => {}), 2500); // again once late gateway events have landed
          return reply(res, 200, { reactions: reactionsOf(fresh) });
        }
      }
    }
    if (M === 'POST' && p[3] === 'rolepicker') {
      const b = await body(req);
      const rows = []; let row = new ActionRowBuilder();
      for (const r of b.roles.slice(0, 25)) { if (row.components.length === 5) { rows.push(row); row = new ActionRowBuilder(); } const bt = new ButtonBuilder().setCustomId('v1c:role:' + r.id).setLabel(String(r.label || ch.guild.roles.cache.get(r.id)?.name || 'Role').slice(0, 80)).setStyle(ButtonStyle.Secondary); if (r.emoji) bt.setEmoji(r.emoji); row.addComponents(bt); }
      if (row.components.length) rows.push(row);
      const m = await ch.send({ content: b.text || 'Pick your roles:', components: rows, allowedMentions: { parse: [] } });
      return reply(res, 200, { m: ser(m) });
    }
    if (M === 'POST' && p[3] === 'signup') {
      const b = await body(req); const s2 = { title: String(b.title || 'Sign up').slice(0, 200), desc: String(b.desc || '').slice(0, 1000), max: Number(b.max) || 0, people: [] };
      const m = await ch.send({ embeds: [signupEmbed(s2)], components: [signupRow()] });
      const all = SIGNUPS.get(); all[m.id] = s2; SIGNUPS.set(all);
      return reply(res, 200, { m: ser(m) });
    }
    if (M === 'POST' && p[3] === 'lock') { // lock / unlock: @everyone can't send
      const b = await body(req);
      await ch.permissionOverwrites.edit(ch.guild.roles.everyone, { SendMessages: b.on ? false : null }, { reason: 'V1 Client', type: OverwriteType.Role });
      return reply(res, 200, { locked: !!b.on });
    }
    if (M === 'POST' && p[3] === 'threadact' && ch.isThread?.()) { // Discord's thread menu: leave / close / lock
      const b = await body(req);
      if (b.action === 'leave') await ch.leave();
      else if (b.action === 'close') await ch.setArchived(true, 'V1 Client');
      else if (b.action === 'lock') await ch.setLocked(!!b.on, 'V1 Client');
      else return reply(res, 400, { error: 'unknown action' });
      broadcast({ t: 'guild', g: guildInfo(ch.guild) });
      return reply(res, 200, { ok: true, locked: !!ch.locked });
    }
    if (M === 'POST' && p[3] === 'clone') { const c2 = await ch.clone({ reason: 'V1 Client' }); return reply(res, 200, { id: c2.id }); }
    if (M === 'GET' && p[3] === 'viewers') { // who can see this channel (Discord's member list is per channel)
      if (!ch.guild) return reply(res, 200, { all: true, ids: [] });
      const ev = ch.permissionsFor(ch.guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel);
      const ids = [...ch.guild.members.cache.values()].filter((m) => ch.permissionsFor(m)?.has(PermissionFlagsBits.ViewChannel)).map((m) => m.id);
      return reply(res, 200, { all: !!ev && ids.length === ch.guild.members.cache.size, ids });
    }
    if (M === 'GET' && p[3] === 'pins') { const got = await ch.messages.fetchPinned(); return reply(res, 200, { messages: [...got.values()].map(ser) }); }
    if (M === 'POST' && p[3] === 'purge') { const n = Math.max(1, Math.min(100, Number((await body(req)).count) || 0)); const del = await ch.bulkDelete(n, true); return reply(res, 200, { deleted: del.size }); }
    if (M === 'POST' && p[3] === 'typing') { stats.typing = (stats.typing || 0) + 1; await ch.sendTyping(); return reply(res, 200, { ok: true }); }
  }
  return reply(res, 404, { error: 'not found' });
}

// GIF videos as animated WebP. WebKitGTK's <video> deadlocked the client twice on GIF-heavy channels (8 Nov),
// so V1 converts each clip once with ffmpeg (low priority, one at a time) and the client shows a plain <img>.
const { spawn } = require('node:child_process');
const GIF_DIR = path.join(__dirname, 'gifcache');
fs.mkdirSync(GIF_DIR, { recursive: true });
const GIF_HOSTS = /^(static\.klipy\.com|media[0-9]*\.tenor\.com|media[0-9]*\.giphy\.com|i\.giphy\.com|i\.imgur\.com|media\.discordapp\.net|cdn\.discordapp\.com|images-ext-[0-9]+\.discordapp\.net)$/;
const gifJobs = new Map(); let gifBusy = 0; const gifQueue = [];
function gifRun() {
  while (gifBusy < 3 && gifQueue.length) { // three at a time: a GIF-heavy channel shouldn't sit on stills
    const { src, out, w, done } = gifQueue.shift(); gifBusy++;
    const tmp = out + '.part';
    const ff = spawn('nice', ['-n', '15', 'ffmpeg', '-v', 'error', '-y', '-t', '15', '-i', src, '-vf', `fps=15,scale='min(${w},iw)':-2:flags=lanczos`, '-an', '-loop', '0', '-c:v', 'libwebp_anim', '-quality', '70', '-compression_level', '0', '-f', 'webp', tmp], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; ff.stderr.on('data', (d) => { err += d; });
    const fin = (ok) => { gifBusy--; if (ok) fs.renameSync(tmp, out); else { try { fs.rmSync(tmp, { force: true }); } catch { /* */ } } done(ok ? null : (err.trim().slice(0, 200) || 'ffmpeg failed')); gifRun(); };
    const kill = setTimeout(() => ff.kill('SIGKILL'), 30000);
    ff.on('close', (c) => { clearTimeout(kill); fin(c === 0); });
    ff.on('error', () => { clearTimeout(kill); fin(false); });
  }
}
function gifTrim() { // keep the cache under ~300 MB, oldest out first
  try {
    const files = fs.readdirSync(GIF_DIR).map((f) => { const p2 = path.join(GIF_DIR, f); const st = fs.statSync(p2); return { p: p2, t: st.atimeMs, n: st.size }; }).sort((a, b) => a.t - b.t);
    let total = files.reduce((a, f) => a + f.n, 0);
    for (const f of files) { if (total < 300e6) break; fs.rmSync(f.p, { force: true }); total -= f.n; }
  } catch { /* fine */ }
}
setInterval(gifTrim, 3600e3).unref();
// start converting before anyone asks: new GIF messages, and the favourites list (background, low priority)
function gifWarm(src, w = 400) {
  let host = ''; try { host = new URL(src).hostname; } catch { return; }
  if (!GIF_HOSTS.test(host)) return;
  const out = path.join(GIF_DIR, crypto.createHash('sha1').update(src + '|' + w).digest('hex') + '.webp');
  if (fs.existsSync(out) || gifJobs.has(out)) return;
  const job = new Promise((ok) => gifQueue.push({ src, out, w, done: ok })); gifJobs.set(out, job); gifRun(); job.finally(() => gifJobs.delete(out));
}
function warmMessage(m) { for (const e of m.embeds || []) if (e.data?.type === 'gifv' && e.video) gifWarm(e.video.proxyURL || e.video.url); }
// MessageLogger: Discord deletes a message's files along with it, so V1 keeps a copy of each image/clip as it
// arrives (10 MB each at most, 500 MB total, oldest out). The client switches a deleted message's files to /att/<id>.
const ATT_DIR = path.join(__dirname, 'attcache');
fs.mkdirSync(ATT_DIR, { recursive: true });
const ATT_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
const ATT_TYPE = Object.fromEntries(Object.entries(ATT_EXT).map(([t, e]) => [e, t]));
const attQ = []; let attBusy = 0;
function attKeep(m) {
  for (const a of m.attachments?.values() ?? []) {
    const ext = ATT_EXT[(a.contentType || '').split(';')[0]];
    if (ext && a.size <= 10e6) attQ.push({ url: a.url, out: path.join(ATT_DIR, `${a.id}.${ext}`) });
  }
  attRun();
}
function attRun() {
  while (attBusy < 2 && attQ.length) {
    const { url, out } = attQ.shift(); if (fs.existsSync(out)) continue;
    attBusy++;
    fetch(url).then(async (r) => { if (!r.ok) return; fs.writeFileSync(out + '.part', Buffer.from(await r.arrayBuffer())); fs.renameSync(out + '.part', out); })
      .catch(() => {}).finally(() => { attBusy--; attRun(); });
  }
}
function attTrim() {
  try {
    const files = fs.readdirSync(ATT_DIR).map((f) => { const p2 = path.join(ATT_DIR, f); const st = fs.statSync(p2); return { p: p2, t: st.mtimeMs, n: st.size }; }).sort((a, b) => a.t - b.t);
    let total = files.reduce((a, f) => a + f.n, 0);
    for (const f of files) { if (total < 500e6) break; fs.rmSync(f.p, { force: true }); total -= f.n; }
  } catch { /* fine */ }
}
setInterval(attTrim, 3600e3).unref();
function serveAtt(req, res, url) {
  if (!keyOk(url.searchParams.get('k') || '')) { res.writeHead(401); return res.end(); }
  const id = (url.pathname.split('/')[2] || '').replace(/\D/g, '');
  for (const ext of Object.keys(ATT_TYPE)) {
    const f = path.join(ATT_DIR, `${id}.${ext}`);
    if (id && fs.existsSync(f)) { res.writeHead(200, { 'Content-Type': ATT_TYPE[ext], 'Cache-Control': 'private, max-age=31536000, immutable' }); return fs.createReadStream(f).pipe(res); }
  }
  res.writeHead(404); res.end('not kept');
}
function serveGif(req, res, url) {
  const src = url.searchParams.get('u') || ''; const w = Math.max(64, Math.min(640, Number(url.searchParams.get('w')) || 400));
  let host = ''; try { host = new URL(src).hostname; } catch { /* */ }
  if (!GIF_HOSTS.test(host)) { res.writeHead(400); return res.end('not a GIF host'); }
  const out = path.join(GIF_DIR, crypto.createHash('sha1').update(src + '|' + w).digest('hex') + '.webp');
  const send = () => { res.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' }); fs.createReadStream(out).pipe(res); };
  if (fs.existsSync(out)) return send();
  let job = gifJobs.get(out);
  if (!job) { job = new Promise((ok) => gifQueue.push({ src, out, w, done: ok })); gifJobs.set(out, job); gifRun(); job.finally(() => gifJobs.delete(out)); }
  job.then((e) => { if (e) { res.writeHead(502); res.end(e); } else send(); });
}

// The UI itself (no secrets in it): ./client-web next to this file, served to the LAN.
const WEB = path.join(__dirname, 'client-web');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
// UI version = newest file time in client-web; clients reload themselves when it changes (when it's safe for them)
let webV = '0';
function webVersion() {
  let newest = 0;
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p2 = path.join(d, f.name); if (f.isDirectory()) walk(p2); else newest = Math.max(newest, fs.statSync(p2).mtimeMs); } };
  try { walk(WEB); } catch { /* none yet */ }
  return String(Math.round(newest));
}
function watchWeb() {
  webV = webVersion();
  let t = null;
  const kick = () => { clearTimeout(t); t = setTimeout(() => { const v = webVersion(); if (v !== webV) { webV = v; broadcast({ t: 'webVersion', v }); } }, 1500); };
  try { fs.watch(WEB, { recursive: true }, kick); } catch { try { fs.watch(WEB, kick); } catch { /* no watching */ } }
}
function serveStatic(req, res) {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.join(WEB, rel);
  if (!file.startsWith(WEB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end(); }
    const tag = `"${st.size}-${st.mtimeMs}"`;
    if (req.headers['if-none-match'] === tag) { res.writeHead(304); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', ETag: tag, 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

// ---------------------------------------------------------------- server settings (as V1)
const PERMS = Object.keys(PermissionFlagsBits);
async function manage(req, res, url, p, M) {
  const g = client.guilds.cache.get(p[2]); if (!g) return reply(res, 404, { error: 'no such server' });
  const what = p[4], id = p[5];
  const me = g.members.me;
  const b = M === 'GET' || M === 'DELETE' ? {} : await body(req, 12 * 1024 * 1024);
  const img = (x) => (x ? Buffer.from(String(x).replace(/^data:[^,]+,/, ''), 'base64') : undefined);
  const roleOut = (r) => ({ id: r.id, name: r.name, color: r.color ? hex(r.color) : null, hoist: r.hoist, mentionable: r.mentionable, managed: r.managed, pos: r.position,
    perms: r.permissions.toArray(), members: r.members.size, icon: r.iconURL?.({ size: 32 }) ?? null, editable: !r.managed && r.position < me.roles.highest.position && r.id !== g.id || (r.id === g.id) });
  if (what === 'overview') {
    if (M === 'PATCH') {
      await g.edit({ name: b.name || undefined, description: b.description ?? undefined, icon: b.icon ? img(b.icon) : undefined, banner: b.banner ? img(b.banner) : undefined,
        afkTimeout: b.afkTimeout ?? undefined, afkChannel: b.afkChannel === '' ? null : b.afkChannel ?? undefined, systemChannel: b.systemChannel === '' ? null : b.systemChannel ?? undefined,
        verificationLevel: b.verificationLevel ?? undefined, explicitContentFilter: b.explicitContentFilter ?? undefined, defaultMessageNotifications: b.defaultMessageNotifications ?? undefined });
    }
    await g.fetch();
    return reply(res, 200, { name: g.name, description: g.description, icon: g.iconURL({ size: 256 }), banner: g.bannerURL({ size: 1024 }), afkTimeout: g.afkTimeout, afkChannel: g.afkChannelId,
      systemChannel: g.systemChannelId, verificationLevel: g.verificationLevel, explicitContentFilter: g.explicitContentFilter, defaultMessageNotifications: g.defaultMessageNotifications,
      members: g.memberCount, boosts: g.premiumSubscriptionCount ?? 0, tier: g.premiumTier, created: g.createdTimestamp, owner: g.ownerId, perms: me.permissions.toArray(), allPerms: PERMS });
  }
  if (what === 'roles') {
    if (M === 'POST' && !id) { const r = await g.roles.create({ name: b.name || 'new role', color: b.color || undefined, reason: 'V1 Client' }); return reply(res, 200, roleOut(r)); }
    if (M === 'POST' && id === 'order') { await g.roles.setPositions(b.order.map((x) => ({ role: x.id, position: x.pos }))); return reply(res, 200, { ok: true }); }
    if (id) {
      const r = g.roles.cache.get(id); if (!r) return reply(res, 404, { error: 'no such role' });
      if (M === 'DELETE') { await r.delete('V1 Client'); return reply(res, 200, { ok: true }); }
      if (M === 'PATCH') await r.edit({ name: b.name ?? undefined, color: b.color === '' ? 0 : b.color ?? undefined, hoist: b.hoist ?? undefined, mentionable: b.mentionable ?? undefined,
        permissions: b.perms ? b.perms.filter((x) => PERMS.includes(x)) : undefined, reason: 'V1 Client' });
      return reply(res, 200, roleOut(r));
    }
    return reply(res, 200, { roles: [...g.roles.cache.values()].sort((a, c) => c.position - a.position).map(roleOut), myTop: me.roles.highest.position });
  }
  if (what === 'emojis') {
    if (M === 'POST') { const e = await g.emojis.create({ attachment: img(b.image), name: String(b.name).replace(/\W/g, '_').slice(0, 32) || 'emoji' }); return reply(res, 200, { id: e.id }); }
    if (M === 'DELETE' && id) { await g.emojis.cache.get(id)?.delete(); return reply(res, 200, { ok: true }); }
    if (M === 'PATCH' && id) { await g.emojis.cache.get(id)?.setName(String(b.name).replace(/\W/g, '_')); return reply(res, 200, { ok: true }); }
    const list = await g.emojis.fetch();
    return reply(res, 200, { emojis: [...list.values()].map((e) => ({ id: e.id, name: e.name, animated: !!e.animated, by: e.author?.username ?? null })) });
  }
  if (what === 'stickers') {
    if (M === 'POST') { const st = await g.stickers.create({ file: img(b.image), name: String(b.name).slice(0, 30), tags: b.tags || 'smile', description: b.description || '' }); return reply(res, 200, { id: st.id }); }
    if (M === 'DELETE' && id) { await g.stickers.delete(id); return reply(res, 200, { ok: true }); }
    const list = await g.stickers.fetch();
    return reply(res, 200, { stickers: [...list.values()].map((x) => ({ id: x.id, name: x.name, url: x.url, tags: x.tags })) });
  }
  if (what === 'invites') {
    if (M === 'POST') { const ch = g.channels.cache.get(b.channel) ?? g.systemChannel ?? g.channels.cache.find((c) => c.type === ChannelType.GuildText);
      const inv = await ch.createInvite({ maxAge: Number(b.maxAge) || 0, maxUses: Number(b.maxUses) || 0, unique: true, reason: 'V1 Client' }); return reply(res, 200, { code: inv.code, url: inv.url }); }
    if (M === 'DELETE' && id) { await g.invites.delete(id); return reply(res, 200, { ok: true }); }
    const list = await g.invites.fetch();
    return reply(res, 200, { invites: [...list.values()].map((i) => ({ code: i.code, channel: i.channel?.name, by: i.inviter?.username ?? null, uses: i.uses, max: i.maxUses, expires: i.expiresTimestamp })) });
  }
  if (what === 'bans') {
    if (M === 'DELETE' && id) { await g.members.unban(id, 'V1 Client'); return reply(res, 200, { ok: true }); }
    const list = await g.bans.fetch({ limit: 1000 });
    return reply(res, 200, { bans: [...list.values()].map((x) => ({ id: x.user.id, name: x.user.globalName ?? x.user.username, username: x.user.username, avatar: x.user.displayAvatarURL({ size: 64 }), reason: x.reason })) });
  }
  if (what === 'audit') {
    const log = await g.fetchAuditLogs({ limit: 50 });
    return reply(res, 200, { entries: [...log.entries.values()].map((e) => ({ id: e.id, action: e.action, actionType: e.actionType, targetType: e.targetType, by: e.executor?.globalName ?? e.executor?.username ?? null,
      byAvatar: e.executor?.displayAvatarURL({ size: 32 }) ?? null, target: e.target?.username ?? e.target?.name ?? e.targetId ?? null, reason: e.reason, at: e.createdTimestamp,
      changes: (e.changes || []).slice(0, 4).map((c) => ({ key: c.key, old: typeof c.old === 'object' ? JSON.stringify(c.old)?.slice(0, 60) : c.old, new: typeof c.new === 'object' ? JSON.stringify(c.new)?.slice(0, 60) : c.new })) })) });
  }
  if (what === 'webhooks') {
    if (M === 'DELETE' && id) { await client.deleteWebhook(id); return reply(res, 200, { ok: true }); }
    const list = await g.fetchWebhooks();
    return reply(res, 200, { webhooks: [...list.values()].map((w) => ({ id: w.id, name: w.name, channel: g.channels.cache.get(w.channelId)?.name, avatar: w.avatarURL?.({ size: 64 }) ?? null, by: w.owner?.username ?? null })) });
  }
  if (what === 'channels') {
    if (M === 'POST' && !id) {
      const type = { text: ChannelType.GuildText, voice: ChannelType.GuildVoice, category: ChannelType.GuildCategory, announcement: ChannelType.GuildAnnouncement, stage: ChannelType.GuildStageVoice, forum: ChannelType.GuildForum }[b.type] ?? ChannelType.GuildText;
      const c = await g.channels.create({ name: b.name || 'new-channel', type, parent: b.parent || undefined, reason: 'V1 Client' }); return reply(res, 200, { id: c.id });
    }
    const c = g.channels.cache.get(id); if (!c) return reply(res, 404, { error: 'no such channel' });
    if (M === 'DELETE') { await c.delete('V1 Client'); return reply(res, 200, { ok: true }); }
    if (M === 'PATCH') await c.edit({ name: b.name ?? undefined, topic: b.topic ?? undefined, nsfw: b.nsfw ?? undefined, rateLimitPerUser: b.slowmode ?? undefined,
      bitrate: b.bitrate ?? undefined, userLimit: b.userLimit ?? undefined, parent: b.parent === '' ? null : b.parent ?? undefined, reason: 'V1 Client' });
    return reply(res, 200, { id: c.id, name: c.name, type: c.type, topic: c.topic ?? '', nsfw: !!c.nsfw, slowmode: c.rateLimitPerUser ?? 0, bitrate: c.bitrate ?? null, userLimit: c.userLimit ?? null, parent: c.parentId });
  }
  return reply(res, 404, { error: 'unknown setting' });
}

function start() {
  const server = http.createServer(async (req, res) => {
    if (!lanOk(req)) { req.socket.destroy(); return; }
    if (req.method === 'OPTIONS') { res.writeHead(204, cors()); return res.end(); }
    if (req.method === 'GET' && req.url.startsWith('/gif?')) return serveGif(req, res, new URL(req.url, 'http://x'));
    if (req.method === 'GET' && req.url.startsWith('/att/')) return serveAtt(req, res, new URL(req.url, 'http://x'));
    if (req.method === 'GET' && !req.url.startsWith('/api/')) return serveStatic(req, res);
    if (!keyOk((req.headers.authorization || '').replace(/^Bearer /, ''))) return reply(res, 401, { error: 'no' });
    try { await route(req, res); } catch (e) {
      const msg = explain(e, req.url);
      if (!REASONS[e.code] && e.code !== 404) console.error('client api:', req.method, req.url.split('?')[0], e.code ?? '', e.message);
      reply(res, e.code === 404 ? 404 : 400, { error: msg, code: e.code ?? null, detail: e.message });
    }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on('upgrade', (req, sock, head) => {
    const k = new URL(req.url, 'http://x').searchParams.get('k');
    if (!lanOk(req) || !keyOk(k)) { sock.destroy(); return; }
    wss.handleUpgrade(req, sock, head, (ws) => wss.emit('connection', ws));
  });
  wss.on('connection', (ws) => {
    sockets.add(ws);
    if (lockOn && sockets.size === 1) kickPiVoice();
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    send(ws, { t: 'hello', voice: voiceStatus(), webVersion: webV });
    ws.on('message', async (data, isBinary) => {
      if (isBinary) { if (voice?.owner === ws && data[0] === 2) onMicFrame(data.subarray(1)); return; }
      let msg; try { msg = JSON.parse(data); } catch { return; }
      try {
        if (msg.t === 'join') await joinVoice(ws, msg.channelId);
        else if (msg.t === 'leave') { if (voice) await leaveVoice('left'); }
        else if (msg.t === 'talkEnd') { if (voice?.owner === ws) endSpurt(); }
        else if (msg.t === 'ping') send(ws, { t: 'pong', at: msg.at });
      } catch (e) { send(ws, { t: 'error', error: e.message }); }
    });
    ws.on('close', () => {
      sockets.delete(ws);
      if (voice?.owner === ws) leaveVoice('client closed').catch(() => {});
      if (lockOn && sockets.size === 0) setTimeout(() => { if (!sockets.size) { console.log('client voice lock: released'); releasePiVoice(); } }, 5000);
    });
  });
  setInterval(() => { for (const ws of sockets) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); } }, 15_000).unref();
  server.on('error', (e) => console.error('client api:', e.message));
  watchWeb();
  server.listen(PORT, '0.0.0.0', () => console.log(`client api on :${PORT} (LAN only)`));
}

// setup() only hooks events (safe in selftest); main() calls start() to open the port.
function setup(onAll, c, h) {
  client = c; hooks = h;
  hookEvents(onAll);
  alertHooks(onAll);
  onAll(Events.MessageCreate, (m) => { try { if (idxMsg(m) && m.channel?.isThread?.() && m.channel.parentId) IDX.thr.run(m.channel.id, m.channel.parentId, m.guildId, m.channel.name); } catch { /* */ } });
  onAll(Events.ClientReady, () => {
    setInterval(() => backfillStep().catch(() => {}), 350).unref();
    setInterval(() => schedTick().catch(() => {}), 10000).unref();
    setTimeout(() => { for (const g of client.guilds.cache.values()) for (const m of g.members.cache.values()) noteNames(m.user, m); }, 30000);
    setTimeout(() => { try { for (const g of JSON.parse(fs.readFileSync(path.join(__dirname, 'client-favgifs.json'), 'utf8')).slice(0, 300)) if (/\.(mp4|webm)(\?|$)/.test(g.src)) gifWarm(g.src, 220); } catch { /* none */ } }, 60000);
    for (const g of client.guilds.cache.values()) for (const st of g.voiceStates.cache.values()) if (st.channelId && !vcSince.has(st.channelId)) vcSince.set(st.channelId, Date.now());
    applyPresence(); dmList().catch((e) => console.error('client dms:', e.message)); });
}

module.exports = { setup, start: () => { KEY = loadKey(); start(); }, owns, handle };
