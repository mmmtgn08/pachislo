"""1フレームずつ描画して ffmpeg に流し込み、動きのある縦動画(1080x1920)を作る。

演出:
- 冒頭: フックを画面中央に特大表示 → 上部ヘッダーへ縮小移動
- キャラ2人(ずんだもん/四国めたん)が口パク・まばたき・話者は拡大バウンド
- テロップはポップイン、emphasis 行は画面揺れ+フラッシュ+赤文字
- reaction スタンプ、流れる背景、最終行でチャンネル登録 CTA
"""
from __future__ import annotations

import math
import os
import random
import subprocess
from array import array
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .schema import SPEAKERS

W, H = 1080, 1920
FPS = 30
CHANNEL_NAME = os.environ.get("CHANNEL_NAME", "")

THEME_COLORS = {
    "あるある": ((40, 10, 70), (140, 20, 90)),
    "設定判別": ((5, 30, 70), (10, 110, 150)),
    "収支": ((60, 10, 10), (170, 60, 0)),
    "雑学": ((10, 50, 30), (20, 120, 90)),
    "ランキング": ((70, 50, 0), (170, 110, 0)),
    "名言": ((15, 15, 15), (70, 70, 90)),
    "ネタ": ((60, 0, 60), (0, 80, 160)),
}

FONT_CANDIDATES = [
    os.environ.get("FONT_PATH", ""),
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
]

NO_LINE_START = set("、。，．・ー〜！？!?）」』】っゃゅょァィゥェォッャュョぁぃぅぇぉ")

# レイアウト(ショートのUIは下部と右側を覆うので、重要要素は中央〜上に置く)
HEADER_TOP_CY, HEADER_TOP_SCALE = 300, 0.82
HEADER_INTRO_CY = 820
TELOP_CY = 860
AVATAR_CY = 1330
AVATAR_X = {"zundamon": 260, "metan": 600}
CTA_CY = 1530


# ───────── フォント・テキスト ─────────
def _font_path() -> str:
    for p in FONT_CANDIDATES:
        if p and Path(p).exists():
            return p
    raise RuntimeError("日本語フォントが見つかりません。FONT_PATH を指定してください")


_FONTS: dict[int, ImageFont.FreeTypeFont] = {}


def font(size: int) -> ImageFont.FreeTypeFont:
    if size not in _FONTS:
        _FONTS[size] = ImageFont.truetype(_font_path(), size)
    return _FONTS[size]


def wrap(text: str, f: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    out: list[str] = []
    for para in text.split("\n"):
        cur = ""
        for ch in para:
            if f.getlength(cur + ch) <= max_w or not cur or ch in NO_LINE_START:
                cur += ch
            else:
                out.append(cur)
                cur = ch
        out.append(cur)
    return out


def fit_text(text: str, max_w: int, max_h: int, start: int, minimum: int = 40, spacing: float = 1.22,
             keep_lines_min: int = 92):
    """収まる最大サイズを探す。まずは指定した改行以外で折り返さないサイズ(keep_lines_min まで)を優先。"""
    n_explicit = len(text.split("\n"))
    for allow_wrap in (False, True):
        size = start
        floor = keep_lines_min if not allow_wrap else minimum
        while size >= floor:
            f = font(size)
            lines = wrap(text, f, max_w)
            ok_h = len(lines) * size * spacing <= max_h
            ok_w = all(f.getlength(l) <= max_w * 1.04 for l in lines)
            if ok_h and ok_w and (allow_wrap or len(lines) == n_explicit):
                return f, lines, size
            size -= 4
    f = font(minimum)
    return f, wrap(text, f, max_w), minimum


def text_sprite(text: str, max_w: int, max_h: int, start: int, fill, stroke, stroke_w: int,
                spacing: float = 1.22, outer=None) -> Image.Image:
    """縁取り文字のRGBA画像。outer を指定すると外側にもう一段太い縁を付ける。"""
    f, lines, size = fit_text(text, max_w, max_h, start, spacing=spacing)
    lh = int(size * spacing)
    pad = stroke_w * 2 + (stroke_w if outer else 0) + 6
    w = int(max(f.getlength(l) for l in lines)) + pad * 2
    h = lh * len(lines) + pad * 2
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for layer in ([(outer, stroke_w * 2)] if outer else []) + [(stroke, stroke_w)]:
        col, sw = layer
        y = pad
        for ln in lines:
            d.text(((w - f.getlength(ln)) / 2, y), ln, font=f, fill=col, stroke_width=sw, stroke_fill=col)
            y += lh
    y = pad
    for ln in lines:
        d.text(((w - f.getlength(ln)) / 2, y), ln, font=f, fill=fill)
        y += lh
    return img


# ───────── 部品スプライト ─────────
def background(theme: str) -> Image.Image:
    c0, c1 = THEME_COLORS.get(theme, THEME_COLORS["ネタ"])
    bw = W + 120
    img = Image.new("RGB", (bw, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (bw, y)], fill=tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(3)))
    ov = Image.new("RGBA", (bw, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for x in range(-H, bw, 120):
        od.polygon([(x, 0), (x + 50, 0), (x + 50 + H, H), (x + H, H)], fill=(255, 255, 255, 16))
    # 中央をうっすら明るく(集中感)
    glow = Image.new("RGBA", (bw, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r in range(700, 0, -50):
        gd.ellipse([bw / 2 - r, TELOP_CY - r, bw / 2 + r, TELOP_CY + r], fill=(255, 255, 255, 5))
    return Image.alpha_composite(Image.alpha_composite(img.convert("RGBA"), ov), glow).convert("RGB")


def header_sprite(hook: str, badge: str) -> Image.Image:
    bw, bh = 1000, 400
    img = Image.new("RGBA", (bw, bh + 50), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 50, bw - 1, bh + 49], radius=40, fill=(10, 10, 10, 235), outline=(255, 215, 0), width=10)
    txt = text_sprite(hook, bw - 90, bh - 70, 150, (255, 228, 0), (150, 0, 0), 8)
    img.alpha_composite(txt, ((bw - txt.width) // 2, 50 + (bh - txt.height) // 2))
    if badge:
        bf = font(46)
        tw = int(bf.getlength(badge)) + 60
        d.rounded_rectangle([40, 0, 40 + tw, 86], radius=22, fill=(230, 20, 40), outline=(255, 255, 255), width=5)
        d.text((70, 14), badge, font=bf, fill=(255, 255, 255))
    return img


def avatar_sprite(key: str, size: int = 300) -> Image.Image:
    """シンプルな自作キャラ(口は毎フレーム別に描く)。"""
    color = SPEAKERS[key]["color"]
    img = Image.new("RGBA", (size, size + 70), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy, r = size // 2, size // 2 + 20, size // 2 - 20
    dark = tuple(max(0, c - 70) for c in color)
    if key == "zundamon":  # 頭の枝豆っぽい葉
        d.ellipse([cx - 70, cy - r - 55, cx - 5, cy - r + 25], fill=(120, 210, 90), outline=dark, width=6)
        d.ellipse([cx + 5, cy - r - 55, cx + 70, cy - r + 25], fill=(120, 210, 90), outline=dark, width=6)
    else:  # めたんのドリル髪
        for sx in (-1, 1):
            x = cx + sx * (r + 5)
            for k in range(3):
                rr = 34 - k * 6
                yy = cy + 10 + k * 46
                d.ellipse([x - rr, yy - rr, x + rr, yy + rr], fill=color, outline=dark, width=5)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 236, 220), outline=dark, width=8)
    d.chord([cx - r, cy - r, cx + r, cy + r * 0.3], 180, 360, fill=color, outline=dark, width=8)  # 前髪
    d.ellipse([cx - 82, cy + 22, cx - 46, cy + 46], fill=(255, 170, 180))  # ほっぺ
    d.ellipse([cx + 46, cy + 22, cx + 82, cy + 46], fill=(255, 170, 180))
    nf = font(40)
    name = SPEAKERS[key]["name"]
    tw = nf.getlength(name)
    d.text(((size - tw) / 2, size + 12), name, font=nf, fill=(255, 255, 255), stroke_width=5, stroke_fill=(0, 0, 0))
    return img


def draw_face(img: Image.Image, open_amt: float, blink: bool, size: int = 300) -> None:
    d = ImageDraw.Draw(img)
    cx, cy = size // 2, size // 2 + 20
    for ex in (cx - 50, cx + 50):
        if blink:
            d.line([ex - 20, cy - 8, ex + 20, cy - 8], fill=(40, 20, 20), width=7)
        else:
            d.ellipse([ex - 20, cy - 34, ex + 20, cy + 14], fill=(255, 255, 255), outline=(40, 20, 20), width=4)
            d.ellipse([ex - 12, cy - 22, ex + 12, cy + 8], fill=(40, 20, 20))
            d.ellipse([ex - 5, cy - 18, ex + 3, cy - 10], fill=(255, 255, 255))
    mh = 6 + open_amt * 46
    d.ellipse([cx - 26, cy + 50 - mh / 2 + 10, cx + 26, cy + 50 + mh / 2 + 10], fill=(150, 20, 40), outline=(60, 10, 10), width=4)


def cta_sprite(text: str) -> Image.Image:
    f = font(54)
    tw = int(f.getlength(text))
    w, h = tw + 150, 110
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=55, fill=(230, 20, 30), outline=(255, 255, 255), width=6)
    d.polygon([(40, 30), (40, 80), (84, 55)], fill=(255, 255, 255))  # ▶
    d.text((110, 22), text, font=f, fill=(255, 255, 255))
    return img


# ───────── 合成ヘルパ ─────────
class ScaleCache:
    def __init__(self, img: Image.Image):
        self.img = img
        self.cache: dict[int, Image.Image] = {}

    def get(self, scale: float) -> Image.Image:
        k = int(round(scale * 100))
        if k == 100:
            return self.img
        if k not in self.cache:
            w, h = self.img.size
            self.cache[k] = self.img.resize((max(1, int(w * k / 100)), max(1, int(h * k / 100))), Image.BILINEAR)
        return self.cache[k]


def paste_center(frame: Image.Image, sprite: Image.Image, cx: float, cy: float) -> None:
    frame.paste(sprite, (int(cx - sprite.width / 2), int(cy - sprite.height / 2)), sprite)


def pop_scale(t: float, dur: float = 0.25, peak: float = 1.12, start: float = 0.4) -> float:
    if t >= dur:
        return 1.0
    a = 0.6 * dur
    if t < a:
        return start + (peak - start) * (t / a)
    return peak + (1.0 - peak) * ((t - a) / (dur - a))


def ease(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


# ───────── メイン ─────────
def render(script: dict, starts: list[float], durations: list[float], voice: array, audio: Path, out: Path,
           sample_rate: int, bgm: Path | None = None) -> Path:
    lines = script["lines"]
    total = starts[-1] + durations[-1]
    nframes = int(math.ceil(total * FPS))

    bg = background(script["theme"])
    badge = ""
    if script.get("series"):
        badge = script["series"] + (f" #{script['episode']}" if script.get("episode") else "")
    header = ScaleCache(header_sprite(script["hook"], badge))
    telops = []
    for ln in lines:
        fill = (255, 50, 50) if ln["emphasis"] else (255, 255, 255)
        outer = (255, 230, 0) if ln["emphasis"] else None
        telops.append(ScaleCache(text_sprite(ln["telop"], 940, 480, 136 if ln["emphasis"] else 118,
                                             fill, (0, 0, 0), 12, outer=outer)))
    stamps = [ScaleCache(text_sprite(ln["reaction"], 400, 200, 120, (255, 230, 0), (200, 0, 0), 10)
                         .rotate(14, expand=True, resample=Image.BICUBIC)) if ln["reaction"] else None
              for ln in lines]
    avatars = {k: avatar_sprite(k) for k in AVATAR_X}
    cta = ScaleCache(cta_sprite(script["cta"]))
    note_font = font(28)
    note = "※パチンコ・パチスロは18歳以上。のめり込みに注意。"
    rnd = random.Random(7)

    # 口パク用: フレームごとの音量(0..1)
    spf = sample_rate / FPS
    amps = []
    for fi in range(nframes):
        s0, s1 = int(fi * spf), int((fi + 1) * spf)
        seg = voice[s0:s1]
        rms = math.sqrt(sum(x * x for x in seg) / len(seg)) if len(seg) else 0.0
        amps.append(min(1.0, rms / 5000))

    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", str(audio)]
    if bgm and bgm.exists():
        cmd += ["-stream_loop", "-1", "-i", str(bgm), "-filter_complex",
                "[2:a]volume=0.10[b];[1:a][b]amix=inputs=2:duration=first:normalize=0[a]",
                "-map", "0:v", "-map", "[a]"]
    else:
        cmd += ["-map", "0:v", "-map", "1:a"]
    cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", f"{total:.3f}", "-movflags", "+faststart", str(out)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    intro_end = durations[0]
    mouth = {k: 0.0 for k in AVATAR_X}
    try:
        for fi in range(nframes):
            t = fi / FPS
            idx = max(i for i in range(len(starts)) if starts[i] <= t + 1e-6)
            lt = t - starts[idx]
            ln = lines[idx]

            off = int(t * 70) % 120
            frame = bg.crop((off, 0, off + W, H))

            # 揺れ
            sx = sy = 0
            if ln["emphasis"] and lt < 0.35:
                k = (0.35 - lt) / 0.35
                sx, sy = rnd.randint(-14, 14) * k, rnd.randint(-14, 14) * k

            # ヘッダー(冒頭は中央に特大 → 上へ)
            if t < intro_end:
                sc = pop_scale(t, 0.3, 1.04, 0.3) * (1.0 + 0.015 * math.sin(t * 8))
                paste_center(frame, header.get(sc), W / 2 + sx, HEADER_INTRO_CY + sy)
            else:
                p = ease((t - intro_end) / 0.3)
                sc = 1.0 + (HEADER_TOP_SCALE - 1.0) * p
                cy = HEADER_INTRO_CY + (HEADER_TOP_CY - HEADER_INTRO_CY) * p
                paste_center(frame, header.get(sc), W / 2 + sx, cy + sy)

            # テロップ(冒頭行はヘッダーが主役なので出さない)
            delay = 0.3 if idx == 1 else 0.0  # ヘッダーが上に移動し終えてから出す
            if idx > 0 and lt >= delay:
                sc = pop_scale(lt - delay)
                paste_center(frame, telops[idx].get(sc), W / 2 + sx, TELOP_CY + 40 + sy)
                if stamps[idx] is not None and lt > 0.15 + delay:
                    paste_center(frame, stamps[idx].get(pop_scale(lt - 0.15 - delay, 0.2, 1.3, 0.2)), 850, 560)

            # キャラ
            for key, ax in AVATAR_X.items():
                speaking = ln["speaker"] == key
                target = amps[fi] if speaking else 0.0
                mouth[key] = mouth[key] * 0.4 + target * 0.6
                img = avatars[key].copy()
                blink = (int(t * FPS) + (0 if key == "zundamon" else 41)) % 95 < 4
                draw_face(img, mouth[key], blink)
                if speaking:
                    bounce = abs(math.sin(lt * 9)) * 14 * (1 if amps[fi] > 0.05 else 0.3)
                    img = img.resize((int(img.width * 1.12), int(img.height * 1.12)), Image.BILINEAR)
                    paste_center(frame, img, ax, AVATAR_CY - bounce)
                else:
                    img = img.resize((int(img.width * 0.9), int(img.height * 0.9)), Image.BILINEAR)
                    dim = Image.new("RGBA", img.size, (0, 0, 0, 0))
                    dim.paste((0, 0, 0, 110), mask=img.getchannel("A"))
                    img.alpha_composite(dim)
                    paste_center(frame, img, ax, AVATAR_CY + 16)

            # 最終行: 登録CTA
            if idx == len(lines) - 1:
                sc = pop_scale(lt, 0.3, 1.15, 0.3) * (1.0 + 0.04 * math.sin(lt * 7))
                paste_center(frame, cta.get(sc), W / 2 - 30, CTA_CY)

            d = ImageDraw.Draw(frame)
            d.rectangle([0, 0, W, 12], fill=(0, 0, 0))
            d.rectangle([0, 0, int(W * t / total), 12], fill=(255, 215, 0))
            d.text((40, 24), note, font=note_font, fill=(235, 235, 235), stroke_width=3, stroke_fill=(0, 0, 0))
            if CHANNEL_NAME:
                d.text((40, 62), CHANNEL_NAME, font=note_font, fill=(255, 215, 0), stroke_width=3, stroke_fill=(0, 0, 0))

            # フラッシュ
            if ln["emphasis"] and lt < 0.12:
                frame = Image.blend(frame, Image.new("RGB", (W, H), (255, 255, 255)), 0.55 * (1 - lt / 0.12))

            proc.stdin.write(frame.tobytes())
    finally:
        proc.stdin.close()
        rc = proc.wait()
    if rc != 0:
        raise RuntimeError(f"ffmpeg が失敗しました (code {rc})")
    return out


def thumbnail(script: dict, out: Path) -> Path:
    """確認用: 冒頭フレームの静止画。"""
    bg = background(script["theme"])
    frame = bg.crop((0, 0, W, H))
    badge = script["series"] + (f" #{script['episode']}" if script.get("episode") else "") if script.get("series") else ""
    paste_center(frame, header_sprite(script["hook"], badge), W / 2, HEADER_INTRO_CY)
    frame.save(out)
    return out
