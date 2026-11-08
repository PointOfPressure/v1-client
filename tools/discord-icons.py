#!/usr/bin/env python3
"""Pull Discord's own icon SVG paths out of its client bundle (msgmock's ref/js dump) by component name."""
import re, glob, json, sys, os
REF = os.path.expanduser(os.environ.get('DISCORD_BUNDLE', '~/discord-bundle/js'))  # a folder of Discord's web client .js files (saved from your own browser)
web = open(glob.glob(f'{REF}/web.*.js')[0], encoding='utf-8', errors='ignore').read()
allsrc = {f: open(f, encoding='utf-8', errors='ignore').read() for f in glob.glob(f'{REF}/*.js')}

def module_body(mid):
    pat = re.compile(r'(?:[,{])' + mid + r'(?::\(e,t,n\)=>\{|:function\(e,t,n\)\{|\(e,t,n\)\{)')
    for f, src in allsrc.items():
        m = pat.search(src)
        if m:
            nxt = re.compile(r',\d{3,7}(?::\(e,t,n\)=>\{|:function\(e,t,n\)\{|\(e,t,n\)\{)').search(src, m.end())
            return src[m.end(): nxt.start() if nxt else m.end() + 8000]
    return None

def paths_in(body, fn=None):
    if fn:
        i = body.find('function ' + fn + '(')
        if i < 0: i = body.find(fn + '=')
        if i >= 0: body = body[i:i + 6000]
    out = []
    for m in re.finditer(r'\(0,\w+\.jsx\)\("path",\{([^}]*)\}', body):
        props = m.group(1)
        d = re.search(r'\bd:"([^"]+)"', props)
        if not d: continue
        out.append({'d': d.group(1), 'evenodd': 'evenodd' in props})
    return out

def icon(name):
    m = re.search(r'\b' + name + r':\(\)=>([\w$]+)(?:\.([\w$]+))?', web)
    if not m: return None
    var, prop = m.group(1), m.group(2)
    if prop:
        a = re.search(r'\b' + re.escape(var) + r'=n\((\d+)\)', web)
        if not a: return None
        body = module_body(a.group(1))
        if not body: return None
        e = re.search(r'n\.d\(t,\{([^}]*)\}\)', body)
        fn = None
        if e:
            mm = re.search(r'\b' + re.escape(prop) + r':\(\)=>([\w$]+)', e.group(1))
            if mm: fn = mm.group(1)
        return paths_in(body, fn)
    return paths_in(web, var)

if __name__ == '__main__':
    names = sys.argv[1:]
    res = {n: icon(n) for n in names}
    json.dump(res, sys.stdout)
