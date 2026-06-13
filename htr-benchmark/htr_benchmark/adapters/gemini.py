"""Google Gemini multimodal adapter (lazy, dependency-optional).

Imports of ``google-generativeai`` and ``Pillow`` are deferred to
construction time so the rest of the harness runs without them. Low
temperature decoding is used to keep the generative decoder grounded in
the image rather than producing fluent-but-fabricated text.
"""

from __future__ import annotations

import os
import time
from typing import Any, Dict

from .base import BaseTranscriber, TranscriptionOutput

_PROMPT = (
    "You are an expert paleographer and archival transcriber.\n"
    "Transcribe the handwritten manuscript in the image exactly as written.\n"
    "Language: {language}. Century: {century}.\n"
    "Rules:\n"
    "1) Preserve original spelling, grammar, and punctuation verbatim.\n"
    "2) Maintain original line breaks.\n"
    "3) Use [illegible] for unreadable spans.\n"
    "4) Output ONLY the transcription with no commentary or code fences.\n"
)


class GeminiTranscriber(BaseTranscriber):
    def __init__(
        self,
        model_name: str = "gemini-1.5-flash",
        temperature: float = 0.1,
        top_p: float = 0.95,
        api_key_env: str = "GEMINI_API_KEY",
    ):
        self.model_name = model_name
        self.temperature = temperature
        self.top_p = top_p
        self._ready = False
        self._init_error = ""
        try:
            import google.generativeai as genai  # type: ignore
            from PIL import Image  # type: ignore

            key = os.environ.get(api_key_env, "")
            if not key:
                raise RuntimeError(f"Missing environment variable {api_key_env}")
            genai.configure(api_key=key)
            self._genai = genai
            self._Image = Image
            self._ready = True
        except Exception as exc:  # ImportError or missing key
            self._init_error = str(exc)

    def name(self) -> str:
        return f"gemini::{self.model_name}"

    def transcribe(self, image_path: str, metadata: Dict[str, Any]) -> TranscriptionOutput:
        if not self._ready:
            return TranscriptionOutput(text="", error=self._init_error)
        t0 = time.time()
        try:
            img = self._Image.open(image_path)
            model = self._genai.GenerativeModel(self.model_name)
            cfg = self._genai.GenerationConfig(
                temperature=self.temperature, top_p=self.top_p
            )
            prompt = _PROMPT.format(
                language=metadata.get("language", "unknown"),
                century=metadata.get("century", "unknown"),
            )
            resp = model.generate_content([prompt, img], generation_config=cfg)
            return TranscriptionOutput(
                text=(getattr(resp, "text", "") or "").strip(),
                latency_sec=time.time() - t0,
                raw={"ok": True},
            )
        except Exception as exc:
            return TranscriptionOutput(
                text="", latency_sec=time.time() - t0, error=str(exc)
            )
