#!/usr/bin/env python3
"""Word-level timestamps for the voiceover → projects/<p>/sync.json

usage: transcribe.py <audio> <out.json> [model=small] [language=ar]
Requires: pip install faster-whisper
sync.json:  {"text": "...", "words": [{"w": "كلمة", "s": 0.52, "e": 0.91}, ...]}
Use in project.json as "@w12" (start of word 12), "@w12.e" (its end), "@w12+0.2".
"""
import json
import sys

try:
    from faster_whisper import WhisperModel
except ImportError:
    sys.exit("faster-whisper غير مثبّت. نفّذ:  pip install faster-whisper")

audio, out = sys.argv[1], sys.argv[2]
model = sys.argv[3] if len(sys.argv) > 3 else "small"
lang = sys.argv[4] if len(sys.argv) > 4 else "ar"

m = WhisperModel(model, device="cpu", compute_type="int8")
segs, _ = m.transcribe(audio, language=lang, word_timestamps=True, vad_filter=True)
words, text = [], []
for s in segs:
    text.append(s.text.strip())
    for w in s.words or []:
        words.append({"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)})
json.dump({"text": " ".join(text), "words": words}, open(out, "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(f"{len(words)} words → {out}\nقارن النص بالسكربت المعتمد وصحّح أي اختلاف قبل بناء المشاهد.")
