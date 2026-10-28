#!/usr/bin/env python3
"""把小魔女夜空飞行从单文件拆出的源码重新打包成单文件 index.html。

src/shell.html   —— HTML + CSS + 界面 DOM，含 /*@@GAME_JS@@*/ 占位
src/game.src.js  —— 游戏 JS，长资源行被替换成 /*@@ASSET_n@@*/ 占位
src/assets.json  —— 资源行原文，键为原行号

用法： python tools/build.py [--check]
"""
import base64
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(ROOT, 'index.html')

GAME_JS = '/*@@GAME_JS@@*/'
ART_DIR = os.path.join(SRC, 'art')
AUDIO_DIR = os.path.join(SRC, 'audio')
# 界面素材：shell.html 里写 @@ART_title_bg@@，构建时内联成 data URI（仍是单文件）
ART_RE = re.compile(r'@@ART_([A-Za-z0-9_\-/]+)@@')
# 音频素材：JS 里写 @@AUDIO_bgm_normal@@，同样内联
AUDIO_RE = re.compile(r'@@AUDIO_([A-Za-z0-9_\-]+)@@')


def load():
    shell = open(os.path.join(SRC, 'shell.html'), encoding='utf-8').read()
    code = open(os.path.join(SRC, 'game.src.js'), encoding='utf-8').read()
    assets = json.load(open(os.path.join(SRC, 'assets.json'), encoding='utf-8'))
    return shell, code, assets


def expand(code, assets):
    missing = []

    def sub(m):
        key = m.group(1)
        if key not in assets:
            missing.append(key)
            return m.group(0)
        return assets[key]

    code = re.sub(r'/\*@@ASSET_(\d+)@@\*/', sub, code)
    if missing:
        raise SystemExit('资源占位找不到: %s' % missing)
    return code


def inject_art(html):
    def sub(m):
        name = m.group(1)
        for ext, mime in (('.webp', 'image/webp'), ('.png', 'image/png'), ('.jpg', 'image/jpeg')):
            p = os.path.join(ART_DIR, name + ext)
            if os.path.exists(p):
                b64 = base64.b64encode(open(p, 'rb').read()).decode('ascii')
                return 'data:%s;base64,%s' % (mime, b64)
        # 缺素材不再中断构建：留空串，运行期 FX_IMG 拿不到 naturalWidth，
        # 走代码里的回退分支（例如 fx_bloom 未出图时的程序化光环）。
        print('警告：界面素材缺失，按空串注入 —— %s' % name)
        return ''
    return ART_RE.sub(sub, html)


def inject_audio(js):
    def sub(m):
        name = m.group(1)
        p = os.path.join(AUDIO_DIR, name + '.mp3')
        if not os.path.exists(p):
            raise SystemExit('音频素材找不到: %s' % p)
        b64 = base64.b64encode(open(p, 'rb').read()).decode('ascii')
        return 'data:audio/mpeg;base64,' + b64
    return AUDIO_RE.sub(sub, js)


def build():
    shell, code, assets = load()
    if GAME_JS not in shell:
        raise SystemExit('shell.html 缺少 %s 占位' % GAME_JS)
    js = expand(code, assets)
    js = inject_audio(js)
    js = inject_art(js)          # 图标也要能内联进 JS（心形数组用）
    html = shell.replace(GAME_JS, js)
    html = inject_art(html)
    return html


def main():
    html = build()
    if '--print' in sys.argv:
        sys.stdout.write(html)
        return
    if '--check' in sys.argv:
        cur = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
        print('build ok, %d chars, 与现有 index.html %s' % (len(html), '一致' if cur == html else '不同'))
        return
    old = None
    if os.path.exists(OUT):
        old = len(open(OUT, encoding='utf-8').read())
    open(OUT, 'w', encoding='utf-8', newline='\n').write(html)
    print('写出 index.html: %d chars (原 %s)' % (len(html), old))


if __name__ == '__main__':
    main()
