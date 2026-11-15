"""テロップ画像の生成と ffmpeg による縦動画(1080x1920)の書き出し。"""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .schema import SPEAKERS

W, H = 1080, 1920
FPS = 30
CHANNEL_NAME = os.environ.get("CHANNEL_NAME", "")

# ショートのUI(下部のタイトル・右側のボタン)に被らない安全領域
SAFE_X0, SAFE_X1 = 60, 900

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


def _font_path() -> str:
    for p in FONT_CANDIDATES:
        if p and Path(p).exists():
            return p
    raise RuntimeError("日本語フォントが見つかりません。FONT_PATH を指定してください")


_FONT_CACHE: dict[int, ImageFont.FreeTypeFont] = {}


def font(size: int) -> ImageFont.FreeTypeFont:
    if size not in _FONT_CACHE:
        _FONT_CACHE[size] = ImageFont.truetype(_font_path(), size)
    return _FONT_CACHE[size]


def wrap(text: str, f: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    out: list[str] = []
    for para in text.split("\n"):
        cur = ""
        for ch in para:
            if f.getlength(cur + ch) <= max_w or not cur:
                cur += ch
            elif ch in NO_LINE_START:
                # 行頭禁則: 句読点等は前の行にぶら下げる
                cur += ch
            else:
                out.append(cur)
                cur = ch
        out.append(cur)
    return out


def fit_text(text: str, max_w: int, max_h: int, start: int, minimum: int = 40, spacing: float = 1.25):
    size = start
    while size > minimum:
        f = font(size)
        lines = wrap(text, f, max_w)
        if len(lines) * size * spacing <= max_h and all(f.getlength(l) <= max_w * 1.04 for l in lines):
            return f, lines, size
        size -= 4
    f = font(minimum)
    return f, wrap(text, f, max_w), minimum


def draw_lines(d: ImageDraw.ImageDraw, lines, f, size, cx, top, fill, stroke, stroke_w, spacing=1.25):
    y = top
    for ln in lines:
        w = f.getlength(ln)
        d.text((cx - w / 2, y), ln, font=f, fill=fill, stroke_width=stroke_w, stroke_fill=stroke)
        y += int(size * spacing)


def background(theme: str) -> Image.Image:
    c0, c1 = THEME_COLORS.get(theme, THEME_COLORS["ネタ"])
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(3)))
    # 斜めストライプ(パチスロっぽい集中線の代わり)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for x in range(-H, W, 90):
        od.polygon([(x, 0), (x + 40, 0), (x + 40 + H, H), (x + H, H)], fill=(255, 255, 255, 14))
    img = Image.alpha_composite(img.convert("RGBA"), overlay)
    return img


def make_frame(script: dict, idx: int, bg: Image.Image, progress: float) -> Image.Image:
    line = script["lines"][idx]
    img = bg.copy()
    d = ImageDraw.Draw(img)
    cx = (SAFE_X0 + SAFE_X1) // 2 + 30

    # 上部: 進捗バー
    d.rectangle([0, 0, W, 14], fill=(0, 0, 0))
    d.rectangle([0, 0, int(W * progress), 14], fill=(255, 220, 0))

    # 上部: フック(常時表示)
    box = [40, 150, W - 40, 560]
    d.rounded_rectangle(box, radius=36, fill=(0, 0, 0, 200), outline=(255, 220, 0), width=8)
    f, lines, size = fit_text(script["hook"], box[2] - box[0] - 80, box[3] - box[1] - 70, 120)
    th = len(lines) * int(size * 1.25)
    draw_lines(d, lines, f, size, W // 2, (box[1] + box[3]) // 2 - th // 2, (255, 230, 0), (120, 0, 0), 6)

    # 中央: 話者バッジ
    sp = SPEAKERS[line["speaker"]]
    bf = font(52)
    name = sp["name"]
    bw = int(bf.getlength(name)) + 70
    by = 700
    d.rounded_rectangle([SAFE_X0, by, SAFE_X0 + bw, by + 90], radius=45, fill=sp["color"], outline=(255, 255, 255), width=5)
    d.text((SAFE_X0 + 35, by + 14), name, font=bf, fill=(255, 255, 255), stroke_width=3, stroke_fill=(0, 0, 0))

    # 中央: テロップ
    area_top, area_bottom = 820, 1430
    max_w = SAFE_X1 - SAFE_X0 + 60
    start = 130 if line["emphasis"] else 110
    f, lines, size = fit_text(line["telop"], max_w, area_bottom - area_top, start)
    th = len(lines) * int(size * 1.25)
    fill = (255, 60, 60) if line["emphasis"] else (255, 255, 255)
    draw_lines(d, lines, f, size, cx - 30, area_top + (area_bottom - area_top - th) // 2, fill, (0, 0, 0), 12)

    # 下部: 注意書き・チャンネル名
    small = font(34)
    note = "※パチンコ・パチスロは18歳以上。のめり込みに注意。"
    d.text((SAFE_X0, 1480), note, font=small, fill=(230, 230, 230), stroke_width=3, stroke_fill=(0, 0, 0))
    if CHANNEL_NAME:
        d.text((SAFE_X0, 1530), CHANNEL_NAME, font=small, fill=(255, 220, 0), stroke_width=3, stroke_fill=(0, 0, 0))
    return img.convert("RGB")


def render(script: dict, durations: list[float], audio: Path, out: Path, work: Path, bgm: Path | None = None) -> Path:
    work.mkdir(parents=True, exist_ok=True)
    bg = background(script["theme"])
    total = sum(durations)
    elapsed = 0.0
    concat = work / "frames.txt"
    with open(concat, "w", encoding="utf-8") as fl:
        last = None
        for i, dur in enumerate(durations):
            elapsed += dur
            p = work / f"frame_{i:02d}.png"
            make_frame(script, i, bg, elapsed / total).save(p)
            fl.write(f"file '{p.resolve()}'\nduration {dur:.3f}\n")
            last = p
        fl.write(f"file '{last.resolve()}'\n")  # concat demuxer は最後の duration を無視するため

    vf = f"fps={FPS},format=yuv420p"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(concat), "-i", str(audio)]
    if bgm and bgm.exists():
        cmd += ["-stream_loop", "-1", "-i", str(bgm), "-filter_complex",
                f"[0:v]{vf}[v];[2:a]volume=0.12[b];[1:a][b]amix=inputs=2:duration=first:normalize=0[a]",
                "-map", "[v]", "-map", "[a]"]
    else:
        cmd += ["-filter_complex", f"[0:v]{vf}[v]", "-map", "[v]", "-map", "1:a"]
    cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
            "-t", f"{total:.3f}", "-movflags", "+faststart", str(out)]
    subprocess.run(cmd, check=True)
    return out
