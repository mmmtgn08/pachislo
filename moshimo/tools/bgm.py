"""BGM をプログラムで合成する(著作権フリー)。

  python3 tools/bgm.py out.wav --seconds 40 --seed "2026-11-16-タイトル"

シードからテンポ・コード進行・音色・ドラムの有無を決めるので、動画ごとに違う曲になる。
雰囲気は「ちょっと不思議・ワクワクする科学番組」寄り。ナレーションの邪魔をしないよう、
中音域を控えめにしたシンプルな構成にしている。
"""
from __future__ import annotations

import argparse
import hashlib
import math
import random
import wave
from array import array

SR = 22050

NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def freq(name: str, octave: int) -> float:
    return 440.0 * 2 ** ((NOTE[name] + (octave - 4) * 12 - 9) / 12)


# コード進行(ルート, 種類)。m=マイナー, M=メジャー, M7/m7 はセブンス
PROGRESSIONS = [
    [("A", "m"), ("F", "M"), ("C", "M"), ("G", "M")],  # 王道で少し切ない
    [("D", "m"), ("A#", "M"), ("F", "M"), ("C", "M")],
    [("E", "m"), ("C", "M"), ("G", "M"), ("D", "M")],
    [("A", "m7"), ("F", "M7"), ("D", "m7"), ("E", "M")],  # ミステリアス
    [("C", "M7"), ("A", "m7"), ("F", "M7"), ("G", "M")],  # 明るい
    [("F", "M7"), ("G", "M"), ("E", "m7"), ("A", "m")],
]
INTERVALS = {"M": [0, 4, 7], "m": [0, 3, 7], "M7": [0, 4, 7, 11], "m7": [0, 3, 7, 10]}


def chord_freqs(root: str, kind: str, octave: int) -> list[float]:
    base = NOTE[root] + (octave - 4) * 12 - 9
    return [440.0 * 2 ** ((base + iv) / 12) for iv in INTERVALS[kind]]


def synth(seconds: float, seed: str) -> array:
    rng = random.Random(int(hashlib.md5(seed.encode()).hexdigest()[:8], 16))
    bpm = rng.choice([92, 100, 106, 112, 118])
    prog = rng.choice(PROGRESSIONS)
    arp_wave = rng.choice(["tri", "sine", "square"])
    arp_pattern = rng.choice([[0, 1, 2, 1], [0, 2, 1, 2], [0, 1, 2, 3], [2, 1, 0, 1]])
    drums = rng.random() < 0.7
    beat = 60.0 / bpm
    bar = beat * 4
    n = int(seconds * SR)
    out = [0.0] * n

    def add(start: float, dur: float, f: float, vol: float, kind: str = "sine", attack=0.01, decay=4.0, release=0.05):
        s0 = int(start * SR)
        ln = int(dur * SR)
        ph = 0.0
        step = 2 * math.pi * f / SR
        for i in range(ln):
            j = s0 + i
            if j >= n:
                break
            t = i / SR
            env = min(1.0, t / attack) * math.exp(-decay * t)
            if i > ln - release * SR:
                env *= max(0.0, (ln - i) / (release * SR))
            ph += step
            if kind == "sine":
                v = math.sin(ph)
            elif kind == "tri":
                x = (ph / (2 * math.pi)) % 1.0
                v = 4 * abs(x - 0.5) - 1
            else:  # 柔らかめの矩形(奇数倍音を2つだけ)
                v = math.sin(ph) + math.sin(3 * ph) / 3 + math.sin(5 * ph) / 5
                v *= 0.7
            out[j] += v * vol * env

    t = 0.0
    ci = 0
    while t < seconds:
        root, kind = prog[ci % len(prog)]
        # パッド(ゆっくり立ち上がる和音)
        for k, f in enumerate(chord_freqs(root, kind, 3)):
            add(t, bar, f, 0.05, "sine", attack=0.35, decay=0.25, release=0.3)
            add(t, bar, f * 1.004, 0.03, "sine", attack=0.4, decay=0.25, release=0.3)
        # ベース
        for b in (0, 2):
            add(t + b * beat, beat * 1.6, freq(root, 2), 0.16, "sine", attack=0.01, decay=1.8, release=0.1)
        # アルペジオ(8分音符)
        tones = chord_freqs(root, kind, 5)
        for e in range(8):
            f = tones[arp_pattern[e % 4] % len(tones)]
            add(t + e * beat / 2, beat / 2, f, 0.045, arp_wave, attack=0.005, decay=7.0, release=0.03)
        # ドラム(ごく控えめ)
        if drums:
            for b in range(4):
                if b in (0, 2):
                    s0 = int((t + b * beat) * SR)
                    for i in range(int(0.18 * SR)):
                        j = s0 + i
                        if j >= n:
                            break
                        tt = i / SR
                        out[j] += math.sin(2 * math.pi * (110 - 260 * tt) * tt) * 0.22 * math.exp(-22 * tt)
                # ハイハット(裏拍)
                s0 = int((t + b * beat + beat / 2) * SR)
                prev = 0.0
                for i in range(int(0.05 * SR)):
                    j = s0 + i
                    if j >= n:
                        break
                    r = rng.uniform(-1, 1)
                    hp = r - prev
                    prev = r
                    out[j] += hp * 0.025 * math.exp(-80 * i / SR)
        t += bar
        ci += 1

    # 正規化とフェードイン・アウト
    peak = max(1e-6, max(abs(v) for v in out))
    gain = 0.5 / peak
    fade_in, fade_out = int(0.6 * SR), int(1.5 * SR)
    buf = array("h")
    for i, v in enumerate(out):
        g = gain
        if i < fade_in:
            g *= i / fade_in
        if i > n - fade_out:
            g *= max(0.0, (n - i) / fade_out)
        buf.append(int(max(-1.0, min(1.0, v * g)) * 32767))
    return buf


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--seconds", type=float, default=45)
    ap.add_argument("--seed", default="moshimo")
    a = ap.parse_args()
    buf = synth(a.seconds, a.seed)
    with wave.open(a.out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(buf.tobytes())


if __name__ == "__main__":
    main()
