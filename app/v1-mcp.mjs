#!/usr/bin/env node
// MCP server (stdio, newline-delimited JSON-RPC) that lets Claude Code act through V1 Client's API on the Pi.
// Moderation tools only exist when V1_MCP_MOD=1 (the "Let Claude moderate" switch).
import fs from 'node:fs';

const API = process.env.V1_API || (() => { try { return fs.readFileSync(`${process.env.HOME}/.config/v1-client/api`, 'utf8').trim(); } catch { return 'http://127.0.0.1:7380'; } })();
const KEY = fs.readFileSync(`${process.env.HOME}/.config/v1-client/key`, 'utf8').trim();
const MOD = true; // destructive tools are always offered, and each one waits for a click in V1 Client
// ask the owner first: V1 shows an Allow / Deny card in the client; nothing runs without Allow (2 min timeout = deny)
async function approve(tool, text) {
  const r = await api('POST', '/approve', { tool, text });
  if (!r.ok) throw new Error('The owner did not approve this (denied, or no answer within 2 minutes). Do not retry unless they ask again.');
}
const name = async (gid, uid) => { try { const p = await api('GET', `/users/${uid}${gid ? '?guild=' + gid : ''}`); return `${p.name} (${p.username})`; } catch { return uid; } };

async function api(method, path, body) {
  const r = await fetch(API + '/api' + path, { method, headers: { Authorization: 'Bearer ' + KEY, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
const nonce = () => String((BigInt(Date.now()) - 1420070400000n) << 22n);
const slim = (m) => ({ id: m.id, channel: m.channelId, author: `${m.author.name} (${m.author.username}, ${m.author.id})${m.author.bot ? ' [bot]' : ''}`, at: new Date(m.ts).toISOString(),
  content: m.content, reply_to: m.reply?.id ?? undefined, attachments: m.attachments?.map((a) => a.url), embeds: m.embeds?.length ? m.embeds.map((e) => [e.title, e.description].filter(Boolean).join(': ')).filter(Boolean) : undefined,
  reactions: m.reactions?.length ? m.reactions.map((r) => `${r.name} ${r.count}`).join(', ') : undefined, deleted: m.deleted || undefined });

const S = (props, req = []) => ({ type: 'object', properties: props, required: req, additionalProperties: false });
const str = (d) => ({ type: 'string', description: d });
const TOOLS = [
  ['list_servers', 'Servers V1 is in, with their text and voice channels (ids, names, who is in each voice channel).', S({}), async () => {
    const s = await api('GET', '/state');
    return s.guilds.map((g) => ({ id: g.id, name: g.name, members: g.total, online: g.online,
      channels: g.channels.filter((c) => c.type !== 4).map((c) => `${c.type === 2 || c.type === 13 ? 'voice' : c.thread ? 'thread' : 'text'} #${c.name} (${c.id})${(g.voice[c.id] || []).length ? ' in voice: ' + g.voice[c.id].map((m) => m.name).join(', ') : ''}`) }));
  }],
  ['read_messages', 'Read recent messages in a channel, DM or thread (newest last). Use before to page back.', S({ channel_id: str('channel id'), limit: { type: 'integer', description: '1-100, default 30' }, before: str('message id to read before') }, ['channel_id']),
    async (a) => (await api('GET', `/channels/${a.channel_id}/messages?limit=${Math.min(100, a.limit || 30)}${a.before ? '&before=' + a.before : ''}`)).messages.map(slim)],
  ['search_messages', "Search V1's saved history of a server's messages (bots can't use Discord search).", S({ guild_id: str('server id'), query: str('text to find') }, ['guild_id', 'query']),
    async (a) => (await api('GET', `/search?guild=${a.guild_id}&q=${encodeURIComponent(a.query)}`)).results.map((r) => ({ id: r.id, channel: `#${r.channel} (${r.channelId})`, author: r.author.name, at: new Date(r.ts).toISOString(), content: r.content }))],
  ['find_members', 'List or search members of a server: name, username, id, status, roles group, activity.', S({ guild_id: str('server id'), query: str('optional name filter') }, ['guild_id']), async (a) => {
    const r = await api('GET', `/guilds/${a.guild_id}/members`); const q = (a.query || '').toLowerCase();
    return r.members.filter((m) => !q || m.name.toLowerCase().includes(q) || m.username.toLowerCase().includes(q)).slice(0, 60).map((m) => ({ id: m.id, name: m.name, username: m.username, status: m.status, activity: m.activity || m.custom || undefined, bot: m.bot || undefined }));
  }],
  ['user_profile', 'Profile of a user: roles, join date, status.', S({ user_id: str('user id'), guild_id: str('optional server id') }, ['user_id']), async (a) => api('GET', `/users/${a.user_id}${a.guild_id ? '?guild=' + a.guild_id : ''}`)],
  ['send_message', 'Send a message as V1. Optionally reply to a message. Mentions: <@user_id>, <#channel_id>.', S({ channel_id: str('channel or DM id'), content: str('message text, up to 2000 chars'), reply_to: str('optional message id to reply to') }, ['channel_id', 'content']),
    async (a) => { const r = await api('POST', `/channels/${a.channel_id}/messages`, { nonce: nonce(), content: a.content, replyTo: a.reply_to, ping: true }); return { sent: r.m.id }; }],
  ['react', 'Add a reaction as V1 (a unicode emoji, or name:id for a custom one).', S({ channel_id: str('channel id'), message_id: str('message id'), emoji: str('emoji') }, ['channel_id', 'message_id', 'emoji']),
    async (a) => { await api('PUT', `/channels/${a.channel_id}/messages/${a.message_id}/reactions/${encodeURIComponent(a.emoji)}`); return 'ok'; }],
  ['edit_own_message', "Edit one of V1's own messages.", S({ channel_id: str('channel id'), message_id: str('message id'), content: str('new text') }, ['channel_id', 'message_id', 'content']),
    async (a) => { await api('PATCH', `/channels/${a.channel_id}/messages/${a.message_id}`, { content: a.content }); return 'ok'; }],
  ['open_dm', 'Open (or find) V1\'s DM channel with a user; returns the channel id to send to.', S({ user_id: str('user id') }, ['user_id']), async (a) => ({ channel_id: (await api('POST', '/dms', { userId: a.user_id })).dm.id })],
];
if (MOD) TOOLS.push(
  ['timeout_member', 'Time out a member. The owner must approve in the client first.', S({ guild_id: str('server id'), user_id: str('user id'), minutes: { type: 'integer', description: '1-40320; 0 removes the timeout' }, reason: str('reason') }, ['guild_id', 'user_id', 'minutes']),
    async (a) => { await approve('timeout', `${a.minutes ? `Time out ${await name(a.guild_id, a.user_id)} for ${a.minutes} min` : `Remove ${await name(a.guild_id, a.user_id)}'s timeout`}${a.reason ? ` — ${a.reason}` : ''}`); await api('POST', `/guilds/${a.guild_id}/members/${a.user_id}/timeout`, { ms: a.minutes ? a.minutes * 60000 : null, reason: a.reason }); return 'done'; }],
  ['kick_member', 'Kick a member. The owner must approve in the client first.', S({ guild_id: str('server id'), user_id: str('user id'), reason: str('reason') }, ['guild_id', 'user_id']),
    async (a) => { await approve('kick', `Kick ${await name(a.guild_id, a.user_id)}${a.reason ? ` — ${a.reason}` : ''}`); await api('POST', `/guilds/${a.guild_id}/members/${a.user_id}/kick`, { reason: a.reason }); return 'done'; }],
  ['ban_member', 'Ban a user. The owner must approve in the client first.', S({ guild_id: str('server id'), user_id: str('user id'), reason: str('reason'), delete_hours: { type: 'integer', description: 'delete their messages from the last N hours (0-168)' } }, ['guild_id', 'user_id']),
    async (a) => { await approve('ban', `Ban ${await name(a.guild_id, a.user_id)}${a.reason ? ` — ${a.reason}` : ''}`); await api('POST', `/guilds/${a.guild_id}/members/${a.user_id}/ban`, { reason: a.reason, deleteSeconds: Math.min(168, a.delete_hours || 0) * 3600 }); return 'done'; }],
  ['unban_user', 'Unban a user. The owner must approve in the client first.', S({ guild_id: str('server id'), user_id: str('user id') }, ['guild_id', 'user_id']),
    async (a) => { await approve('unban', `Unban ${await name(null, a.user_id)}`); await api('DELETE', `/guilds/${a.guild_id}/manage/bans/${a.user_id}`); return 'done'; }],
  ['delete_message', 'Delete a message. The owner must approve in the client first.', S({ channel_id: str('channel id'), message_id: str('message id') }, ['channel_id', 'message_id']),
    async (a) => { let what = 'a message'; try { const m = (await api('GET', `/channels/${a.channel_id}/messages/${a.message_id}`)).m; what = `${m.author.name}'s message “${(m.content || 'attachment').slice(0, 80)}”`; } catch { /* gone */ } await approve('delete', `Delete ${what}`); await api('DELETE', `/channels/${a.channel_id}/messages/${a.message_id}`); return 'done'; }],
  ['purge_messages', 'Delete the newest N messages in a channel (max 100, under 14 days old). The owner must approve in the client first.', S({ channel_id: str('channel id'), count: { type: 'integer', description: '1-100' } }, ['channel_id', 'count']),
    async (a) => { await approve('purge', `Delete the newest ${Math.min(100, a.count)} messages in this channel (${a.channel_id})`); const r = await api('POST', `/channels/${a.channel_id}/purge`, { count: a.count }); return `deleted ${r.deleted}`; }],
  ['set_role', 'Give or remove a role. The owner must approve in the client first.', S({ guild_id: str('server id'), user_id: str('user id'), role_id: str('role id'), add: { type: 'boolean' } }, ['guild_id', 'user_id', 'role_id', 'add']),
    async (a) => { await approve('role', `${a.add ? 'Give' : 'Remove'} role ${a.role_id} ${a.add ? 'to' : 'from'} ${await name(a.guild_id, a.user_id)}`); await api('POST', `/guilds/${a.guild_id}/members/${a.user_id}/role`, { roleId: a.role_id, add: a.add }); return 'done'; }],
  ['set_nickname', "Change a member's server nickname. The owner must approve in the client first.", S({ guild_id: str('server id'), user_id: str('user id'), nickname: str('new nickname, empty to reset') }, ['guild_id', 'user_id', 'nickname']),
    async (a) => { await approve('nick', `Rename ${await name(a.guild_id, a.user_id)} to “${a.nickname || '(reset)'}”`); await api('POST', `/guilds/${a.guild_id}/members/${a.user_id}/nick`, { nick: a.nickname }); return 'done'; }],
);


const out = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (line) handle(JSON.parse(line)).catch(() => {});
  }
});
async function handle(m) {
  if (m.method === 'initialize') return out({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: m.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'v1', version: '1.0.0' } } });
  if (m.method === 'tools/list') return out({ jsonrpc: '2.0', id: m.id, result: { tools: TOOLS.map(([name, description, inputSchema]) => ({ name, description, inputSchema })) } });
  if (m.method === 'tools/call') {
    const t = TOOLS.find((x) => x[0] === m.params.name);
    try {
      if (!t) throw new Error('unknown tool');
      const r = await t[3](m.params.arguments || {});
      return out({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: typeof r === 'string' ? r : JSON.stringify(r) }] } });
    } catch (e) { return out({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true } }); }
  }
  if (m.id !== undefined) out({ jsonrpc: '2.0', id: m.id, result: {} });
}
