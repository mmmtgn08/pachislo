"""効果音をプログラムで合成する(著作権フリー)。

SE名: pop / don / peka / chan / boo / whoosh / kira
"""
from __future__ import annotations

import math
import random
from array import array

SR = 24000


def _env(i: int, n: int, attack: float = 0.005, decay: float = 6.0) -> float:
    t = i / SR
    a = min(1.0, t / attack) if attack > 0 else 1.0
    return a * math.exp(-decay * i / n)


def _tone(dur: float, f0: float, f1: float | None = None, vol: float = 0.5, decay: float = 6.0,
          wave: str = "sine") -> list[float]:
    n = int(SR * dur)
    f1 = f1 or f0
    out, ph = [], 0.0
    for i in range(n):
        f = f0 + (f1 - f0) * i / n
        ph += 2 * math.pi * f / SR
        s = math.sin(ph)
        if wave == "square":
            s = 1.0 if s >= 0 else -1.0
            s *= 0.5
        out.append(s * vol * _env(i, n, decay=decay))
    return out


def _noise(dur: float, vol: float = 0.3, decay: float = 8.0) -> list[float]:
    rnd = random.Random(1)
    n = int(SR * dur)
    out, prev = [], 0.0
    for i in range(n):
        prev = prev * 0.85 + rnd.uniform(-1, 1) * 0.15  # 簡易ローパス
        out.append(prev * 3 * vol * _env(i, n, decay=decay))
    return out


def _mix(*tracks: list[float], offsets: list[float] | None = None) -> list[float]:
    offsets = offsets or [0.0] * len(tracks)
    n = max(int(o * SR) + len(t) for t, o in zip(tracks, offsets))
    out = [0.0] * n
    for t, o in zip(tracks, offsets):
        s = int(o * SR)
        for i, v in enumerate(t):
            out[s + i] += v
    return out


def _build(name: str) -> list[float]:
    if name == "pop":
        return _tone(0.09, 900, 1700, vol=0.45, decay=5)
    if name == "don":
        return _mix(_tone(0.45, 110, 45, vol=0.9, decay=5), _noise(0.12, vol=0.5, decay=10))
    if name == "peka":  # パチスロの告知っぽい上昇音
        notes = [988, 1319, 1976]
        return _mix(*[_tone(0.22, f, vol=0.28, decay=4, wave="square") for f in notes],
                    offsets=[0.0, 0.07, 0.14])
    if name == "chan":  # 鈴っぽい和音
        return _mix(*[_tone(0.7, f, vol=0.22, decay=5) for f in (1047, 1568, 2093)])
    if name == "boo":  # ハズレ・ブッブー
        return _mix(_tone(0.22, 160, vol=0.35, decay=1, wave="square"),
                    _tone(0.35, 140, vol=0.35, decay=2, wave="square"), offsets=[0.0, 0.26])
    if name == "whoosh":
        return _noise(0.3, vol=0.35, decay=3)
    if name == "kira":
        return _mix(*[_tone(0.18, f, vol=0.2, decay=5) for f in (1760, 2217, 2637, 3520)],
                    offsets=[0.0, 0.05, 0.1, 0.15])
    raise KeyError(name)


NAMES = ["pop", "don", "peka", "chan", "boo", "whoosh", "kira"]
_CACHE: dict[str, list[float]] = {}


def get(name: str) -> list[float]:
    if name not in _CACHE:
        _CACHE[name] = _build(name)
    return _CACHE[name]


def mix_into(track: array, name: str, start_sec: float, gain: float = 1.0) -> None:
    """int16 の array に効果音を加算する(クリップ付き)。"""
    s = int(start_sec * SR)
    for i, v in enumerate(get(name)):
        j = s + i
        if j >= len(track):
            break
        x = track[j] + int(v * gain * 32767)
        track[j] = 32767 if x > 32767 else -32768 if x < -32768 else x


def export_all(out_dir: str) -> None:
    """全効果音を wav で書き出す(Remotion 版で使用)。"""
    import os
    import wave

    os.makedirs(out_dir, exist_ok=True)
    for name in NAMES:
        tr = array("h", [0]) * len(get(name))
        mix_into(tr, name, 0.0, gain=0.8)
        with wave.open(os.path.join(out_dir, f"{name}.wav"), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(tr.tobytes())


if __name__ == "__main__":
    import sys

    export_all(sys.argv[1])
