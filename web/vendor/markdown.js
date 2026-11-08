/* Discord-flavoured markdown on top of simple-markdown (MIT), which is what Discord's client parser is built on.
   Rules follow Discord's behaviour: everything parses in inline scope, block constructs only at the start of a line. */
const MD = (() => {
  const SM = window.SimpleMarkdown;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ctx = { // filled in by the app
    user: () => null, role: () => null, emoji: () => null, names: () => [], time: () => '', channel: n => n,
  };
  const startOfLine = (state, prev) => !state.inInline && !state.flat && (prev == null || prev === '' || /\n$/.test(prev));
  const sub = (parse, content, state) => { const o = state.inInline; state.inInline = true; const r = parse(content, state); state.inInline = o; return r; };
  const lineStart = re => (source, state, prev) => startOfLine(state, prev) ? re.exec(source) : null;
  const inlineRe = re => (source) => re.exec(source);
  const out = (nodes, output, state) => output(nodes, state);
  let order = 0;
  const R = {};
  const rule = (name, def) => { R[name] = Object.assign({ order: order++ }, def); };

  rule('codeBlock', {
    match: inlineRe(/^```(?:([a-z0-9_+\-.#]+?)\n)?\n*([^\n][\s\S]*?)\n*```\n?/i),
    parse: c => ({ lang: c[1] || '', content: c[2] || '' }),
    html: n => {
      let body = esc(n.content);
      if (window.hljs && n.lang) {
        try { if (hljs.getLanguage(n.lang)) body = hljs.highlight(n.content, { language: n.lang, ignoreIllegals: true }).value; } catch (e) {}
      }
      return `<pre><code class="hljs${n.lang ? ' ' + esc(n.lang) : ''}">${body}</code></pre>`;
    },
  });
  rule('blockQuote', {
    match: (source, state, prev) => {
      if (state.inQuote || !startOfLine(state, prev)) return null;
      return /^( *>>> ([\s\S]*))|^( *> [^\n]*(\n *> [^\n]*)*\n?)/.exec(source);
    },
    parse: (c, parse, state) => {
      const all = c[0];
      const multi = /^ *>>> ?/.test(all);
      const content = multi ? all.replace(/^ *>>> ?/, '') : all.replace(/^ *> ?/gm, '').replace(/\n$/, '');
      const inQuote = state.inQuote; state.inQuote = true;
      const nodes = parse(content, state);
      state.inQuote = inQuote;
      return { content: nodes, trailingNewline: !multi && /\n$/.test(all) };
    },
    html: (n, output, state) => `<div class="quote"><div class="bar"></div><blockquote>${out(n.content, output, state)}</blockquote></div>`,
  });
  rule('heading', {
    match: lineStart(/^ *(#{1,3}) +([^\n]+?)#*\s*(?:\n|$)/),
    parse: (c, parse, state) => ({ level: c[1].length, content: sub(parse, c[2].trim(), state) }),
    html: (n, output, state) => `<h${n.level}>${out(n.content, output, state)}</h${n.level}>`,
  });
  rule('subtext', {
    match: lineStart(/^ *-# +([^\n]+?)(?:\n|$)/),
    parse: (c, parse, state) => ({ content: sub(parse, c[1], state) }),
    html: (n, output, state) => `<small>${out(n.content, output, state)}</small>`,
  });
  rule('list', {
    match: (source, state, prev) => {
      if (!startOfLine(state, prev)) return null;
      // consecutive item lines; a top-level marker change (bullet vs number) starts a new list, like Discord
      const first = /^( *)([-*]|\d{1,9}\.) +[^\n]*/.exec(source);
      if (!first) return null;
      const base = first[1].length, ordered = /\d/.test(first[2]);
      let end = first[0].length;
      const re = /\n( *)([-*]|\d{1,9}\.) +[^\n]*/y;
      for (;;) {
        re.lastIndex = end;
        const n = re.exec(source);
        if (!n) break;
        if (n[1].length <= base && /\d/.test(n[2]) !== ordered) break;
        end = re.lastIndex;
      }
      if (source[end] === '\n') end++;
      return [source.slice(0, end)];
    },
    parse: (c, parse, state) => {
      const lines = c[0].replace(/\n$/, '').split('\n').map(l => {
        const m = /^( *)([-*]|\d{1,9}\.) +(.*)$/.exec(l);
        return { indent: m[1].length, ordered: /\d/.test(m[2]), start: parseInt(m[2], 10) || 1, text: m[3] };
      });
      // nest by indentation: an item indented 2+ spaces deeper than the previous item's level becomes its child
      const build = (items, base) => {
        const list = { ordered: items[0].ordered, start: items[0].start, items: [] };
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const kids = [];
          while (i + 1 < items.length && items[i + 1].indent >= it.indent + 2) kids.push(items[++i]);
          list.items.push({ content: sub(parse, it.text, state), sub: kids.length ? build(kids, it.indent + 2) : null });
        }
        return list;
      };
      return { list: build(lines, 0) };
    },
    html: (n, output, state) => {
      const render = l => {
        const tag = l.ordered ? 'ol' : 'ul';
        const chars = String(l.start + l.items.length - 1).length;
        const attrs = l.ordered ? ` start="${l.start}" style="--chars:${chars}"` : '';
        return `<${tag}${attrs}>${l.items.map(it => `<li>${out(it.content, output, state)}${it.sub ? render(it.sub) : ''}</li>`).join('')}</${tag}>`;
      };
      return render(n.list);
    },
  });
  rule('escape', {
    match: inlineRe(/^\\([^0-9A-Za-z\s])/),
    parse: c => ({ type: 'text', content: c[1] }),
    html: n => esc(n.content),
  });
  rule('autolink', {
    match: inlineRe(/^<(https?:\/\/[^ >]+)>/),
    parse: c => ({ url: c[1] }),
    html: n => `<a href="${esc(n.url)}">${esc(n.url)}</a>`,
  });
  rule('link', {
    match: inlineRe(/^\[((?:\[[^\]]*\]|[^\[\]])*)\]\(\s*<?(https?:\/\/[^\s>)]+)>?(?:\s+['"]([\s\S]*?)['"])?\s*\)/),
    parse: (c, parse, state) => { const o = state.inLink; state.inLink = true; const content = sub(parse, c[1], state); state.inLink = o; return { content, url: c[2] }; },
    html: (n, output, state) => `<a href="${esc(n.url)}">${out(n.content, output, state)}</a>`,
  });
  rule('url', {
    match: (source, state) => state.inLink ? null : /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/.exec(source),
    parse: c => ({ url: c[1] }),
    html: n => `<a href="${esc(n.url)}">${esc(n.url)}</a>`,
  });
  rule('timestamp', {
    match: inlineRe(/^<t:(-?\d{1,17})(?::([tTdDfFR]))?>/),
    parse: c => ({ unix: +c[1], fmt: c[2] || 'f' }),
    html: n => `<span class="timestamp">${esc(ctx.time(n.unix, n.fmt))}</span>`,
  });
  rule('customEmoji', {
    match: inlineRe(/^<(a)?:(\w+):(\d+)>/),
    parse: c => ({ name: c[2], src: `https://cdn.discordapp.com/emojis/${c[3]}.${c[1] ? 'gif' : 'webp'}?size=96&quality=lossless` }),
    html: n => `<img class="emoji custom" alt=":${esc(n.name)}:" src="${esc(n.src)}" draggable="false">`,
  });
  rule('libEmoji', {
    match: (source) => { const m = /^:([\w~-]+):/.exec(source); return m && ctx.emoji(m[1]) ? m : null; },
    parse: c => ({ name: c[1] }),
    html: n => { const e = ctx.emoji(n.name); return `<img class="emoji custom" alt=":${esc(n.name)}:" src="${esc(e.src)}" draggable="false">`; },
  });
  rule('slashMention', {
    match: inlineRe(/^<\/([\w\- ]+):\d+>/),
    parse: c => ({ name: c[1] }),
    html: n => `<span class="mention interactive">/${esc(n.name)}</span>`,
  });
  rule('channel', {
    match: inlineRe(/^<#([^>\n]+)>/),
    parse: c => ({ name: c[1] }),
    html: n => ctx.channelIcon && ctx.channelIcon(n.name) ? `<span class="mention interactive channelMention" data-cid="${esc(n.name)}">${ctx.channelIcon(n.name)}${esc(ctx.channel(n.name))}</span>` : `<span class="mention interactive channelMention" data-cid="${esc(n.name)}"><svg class="mIcon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M10.99 3.16A1 1 0 1 0 9 2.84L8.15 8H4a1 1 0 0 0 0 2h3.82l-.67 4H3a1 1 0 1 0 0 2h3.82l-.8 4.84a1 1 0 0 0 1.97.32L8.85 16h4.97l-.8 4.84a1 1 0 0 0 1.97.32l.86-5.16H20a1 1 0 1 0 0-2h-3.82l.67-4H21a1 1 0 1 0 0-2h-3.82l.8-4.84a1 1 0 1 0-1.97-.32L15.15 8h-4.97l.8-4.84ZM14.15 14l.67-4H9.85l-.67 4h4.97Z" clip-rule="evenodd"/></svg>${esc(ctx.channel(n.name))}</span>`,
  });
  rule('roleMention', {
    match: inlineRe(/^<@&([^>\n]+)>/),
    parse: c => ({ name: c[1] }),
    html: n => roleHtml(ctx.role(n.name), n.name),
  });
  rule('userMention', {
    match: inlineRe(/^<@!?([^>\n]+)>/),
    parse: c => ({ name: c[1] }),
    html: n => { const p = ctx.user(n.name); return `<span class="mention interactive" data-uid="${esc(n.name)}">${p && p.avatar ? `<img class="mav" src="${esc(p.avatar)}" alt="">` : ''}@${esc(p ? p.name : n.name)}</span>`; },
  });
  rule('everyone', {
    match: (source, state, prev) => (prev == null || !/[\w@]$/.test(prev)) ? /^@(everyone|here)\b/.exec(source) : null,
    parse: c => ({ name: c[1] }),
    html: n => `<span class="mention interactive">@${n.name}</span>`,
  });
  rule('atName', { // shorthand: @Name for any profile or role
    match: (source, state, prev) => {
      if (source[0] !== '@' || (prev && /[\w@]$/.test(prev))) return null;
      const lower = source.slice(1).toLowerCase();
      for (const n of ctx.names()) {
        if (lower.startsWith(n.key) && !/[\w]/.test(source[1 + n.key.length] || '')) return [source.slice(0, 1 + n.key.length), n];
      }
      return null;
    },
    parse: c => ({ ref: c[1] }),
    html: n => n.ref.role ? roleHtml(n.ref.role, n.ref.role.name) : `<span class="mention interactive">@${esc(n.ref.profile.name)}</span>`,
  });
  rule('spoiler', {
    match: inlineRe(/^\|\|([\s\S]+?)\|\|/),
    parse: (c, parse, state) => ({ content: sub(parse, c[1], state) }),
    html: (n, output, state) => `<span class="spoiler hidden"><span class="spoilerInner">${out(n.content, output, state)}</span></span>`,
  });
  rule('strong', {
    match: inlineRe(/^\*\*((?:\\[\s\S]|[^\\])+?)\*\*(?!\*)/),
    parse: (c, parse, state) => ({ content: sub(parse, c[1], state) }),
    html: (n, output, state) => `<strong>${out(n.content, output, state)}</strong>`,
  });
  rule('u', {
    match: inlineRe(/^__((?:\\[\s\S]|[^\\])+?)__(?!_)/),
    parse: (c, parse, state) => ({ content: sub(parse, c[1], state) }),
    html: (n, output, state) => `<u>${out(n.content, output, state)}</u>`,
  });
  rule('em', {
    match: (source, state, prev) => {
      const m = SM.defaultRules.em.match(source, state, prev);
      return m;
    },
    parse: (c, parse, state) => ({ content: sub(parse, c[2] || c[1], state) }),
    html: (n, output, state) => `<em>${out(n.content, output, state)}</em>`,
  });
  rule('del', {
    match: inlineRe(/^~~([\s\S]+?)~~(?!_)/),
    parse: (c, parse, state) => ({ content: sub(parse, c[1], state) }),
    html: (n, output, state) => `<s>${out(n.content, output, state)}</s>`,
  });
  rule('inlineCode', {
    match: inlineRe(/^(`+)([\s\S]*?[^`])\1(?!`)/),
    parse: c => ({ content: c[2].replace(/^ (?= *`)|(` *) $/g, '$1') }),
    html: n => `<code class="inline">${esc(n.content)}</code>`,
  });
  rule('newline', {
    match: inlineRe(/^\n/),
    parse: () => ({}),
    html: () => '\n',
  });
  rule('text', {
    match: inlineRe(/^[\s\S]+?(?=[^0-9A-Za-z\sÀ-￿]|\n|\w+:\S|$)/),
    parse: c => ({ content: c[0] }),
    html: n => esc(n.content),
  });

  function roleHtml(role, name) {
    if (role && role.color) {
      const c = role.color;
      return `<span class="mention interactive roleMention" style="color:${esc(c)};--rm-bg:${esc(hexA(c, .1))};--rm-bg-h:${esc(hexA(c, .3))}">@${esc(role.name)}</span>`;
    }
    return `<span class="mention interactive roleMention">@${esc(role ? role.name : name)}</span>`;
  }
  function hexA(hex, a) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex || '');
    return m ? `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})` : 'transparent';
  }

  const parser = SM.parserFor(R, { inline: true });
  const output = SM.outputFor(R, 'html');
  function render(text, opts) {
    if (!text) return '';
    try {
      const state = Object.assign({ inline: true }, opts || {});
      return output(parser(text, state), state);
    } catch (e) {
      console.warn('markdown', e);
      return esc(text);
    }
  }
  /* reply/thread previews: Discord renders a reduced set inline on one line */
  function renderInline(text) {
    const flat = String(text || '').replace(/```[\s\S]*?```/g, ' ').replace(/^ *(>>> ?|> |#{1,3} |-# |[-*] |\d+\. )/gm, '').replace(/\n+/g, ' ').trim();
    return render(flat, { flat: true });
  }
  return { render, renderInline, ctx, esc, hexA };
})();
