"""VOICEVOX エンジンでの音声合成。

VOICEVOX_URL (既定 http://127.0.0.1:50021) で起動している VOICEVOX ENGINE を使う。
engine="silent" のときは文字数から長さを見積もった無音を作る(ローカル確認用)。
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


def _silent(text: str) -> bytes:
    seconds = 0.4 + len(text) * 0.11 / SPEED
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(b"\x00\x00" * int(SAMPLE_RATE * seconds))
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
            data = _silent(ln["text"])
        p = out_dir / f"line_{i:02d}.wav"
        p.write_bytes(data)
        paths.append(p)
    return paths


def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / w.getframerate()


def concat_wavs(paths: list[Path], out: Path, gap: float = 0.12) -> list[float]:
    """wavを隙間付きで連結し、各区間の長さ(秒、隙間込み)を返す。"""
    durations = []
    with wave.open(str(out), "wb") as dst:
        dst.setnchannels(1)
        dst.setsampwidth(2)
        dst.setframerate(SAMPLE_RATE)
        silence = b"\x00\x00" * int(SAMPLE_RATE * gap)
        for p in paths:
            with wave.open(str(p), "rb") as src:
                if src.getframerate() != SAMPLE_RATE or src.getnchannels() != 1 or src.getsampwidth() != 2:
                    raise RuntimeError(f"想定外のwav形式: {p}")
                frames = src.readframes(src.getnframes())
                dst.writeframes(frames)
                dst.writeframes(silence)
                durations.append(src.getnframes() / SAMPLE_RATE + gap)
    return durations
