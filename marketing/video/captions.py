"""Caption chunking shared by record.py (burned-in) and build.py (YouTube .srt)."""
import re


def chunks(vo_text, seconds, width=78):
    text = vo_text.replace("P-I-I", "PII").replace(" dot web dot app", ".web.app")
    parts = []
    for sent in re.split(r"(?<=[.?!])\s+", text):
        while len(sent) > width:
            cut = max(sent.rfind(", ", 0, width), sent.rfind(": ", 0, width))
            if cut < 25:
                cut = sent.rfind(" ", 0, width)
            parts.append(sent[: cut + 1].strip())
            sent = sent[cut + 1 :].strip()
        if sent:
            parts.append(sent)
    total = sum(len(p) for p in parts)
    return [{"text": p, "ms": int(seconds * 1000 * len(p) / total)} for p in parts]
