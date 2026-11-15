"""VOICEVOX エンジンでの音声合成。

VOICEVOX_URL (既定 http://127.0.0.1:50021) で起動している VOICEVOX ENGINE を使う。
engine="dummy" のときは文字数から長さを見積もった仮の音を作る(ローカル確認用)。
"""
from __future__ import annotations

import io
import os
import time
import wave
from pathlib import Path

import requests

from .schema import SPEAKERS

SAMPLE_RATE = 24000
SPEED = float(os.environ.get("VOICE_SPEED", "1.2"))


def _wait_engine(url: str, timeout: float = 180) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if requests.get(f"{url}/version", timeout=5).ok:
                return
        except requests.RequestException:
            pass
        time.sleep(2)
    raise RuntimeError(f"VOICEVOX エンジンに接続できません: {url}")


def _voicevox(text: str, speaker_id: int, url: str) -> bytes:
    q = requests.post(f"{url}/audio_query", params={"text": text, "speaker": speaker_id}, timeout=60)
    q.raise_for_status()
    query = q.json()
    query["speedScale"] = SPEED
    query["intonationScale"] = 1.15
    query["prePhonemeLength"] = 0.05
    query["postPhonemeLength"] = 0.08
    query["outputSamplingRate"] = SAMPLE_RATE
    query["outputStereo"] = False
    r = requests.post(f"{url}/synthesis", params={"speaker": speaker_id}, json=query, timeout=120)
    r.raise_for_status()
    return r.content


def _dummy(text: str) -> bytes:
    """ローカル確認用: 文字数ぶんの長さの小さな断続音(口パク確認用)。"""
    import math
    seconds = 0.4 + len(text) * 0.11 / SPEED
    n = int(SAMPLE_RATE * seconds)
    frames = bytearray()
    for i in range(n):
        t = i / SAMPLE_RATE
        env = 0.5 + 0.5 * math.sin(2 * math.pi * 6 * t)
        v = int(6000 * env * math.sin(2 * math.pi * 220 * t))
        frames += v.to_bytes(2, "little", signed=True)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(bytes(frames))
    return buf.getvalue()


def synthesize(lines: list[dict], out_dir: Path, engine: str = "voicevox") -> list[Path]:
    """各行のwavを書き出してパスのリストを返す。"""
    out_dir.mkdir(parents=True, exist_ok=True)
    url = os.environ.get("VOICEVOX_URL", "http://127.0.0.1:50021").rstrip("/")
    if engine == "voicevox":
        _wait_engine(url)
    paths = []
    for i, ln in enumerate(lines):
        if engine == "voicevox":
            data = _voicevox(ln["text"], SPEAKERS[ln["speaker"]]["id"], url)
        else:
            data = _dummy(ln["text"])
        p = out_dir / f"line_{i:02d}.wav"
        p.write_bytes(data)
        paths.append(p)
    return paths


def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / w.getframerate()


def build_track(paths: list[Path], gap: float = 0.08, tail: float = 0.5):
    """wavを隙間付きで連結する。(int16 array, 各行の開始秒, 各行の長さ秒) を返す。"""
    from array import array
    track = array("h")
    starts, durations = [], []
    silence = array("h", [0]) * int(SAMPLE_RATE * gap)
    for p in paths:
        with wave.open(str(p), "rb") as src:
            if src.getframerate() != SAMPLE_RATE or src.getnchannels() != 1 or src.getsampwidth() != 2:
                raise RuntimeError(f"想定外のwav形式: {p}")
            data = array("h")
            data.frombytes(src.readframes(src.getnframes()))
        starts.append(len(track) / SAMPLE_RATE)
        track.extend(data)
        track.extend(silence)
        durations.append(len(data) / SAMPLE_RATE + gap)
    durations[-1] += tail
    track.extend(array("h", [0]) * int(SAMPLE_RATE * tail))
    return track, starts, durations


def write_wav(track, out: Path) -> None:
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(track.tobytes())
