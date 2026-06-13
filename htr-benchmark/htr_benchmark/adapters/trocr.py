"""TrOCR adapter stub (HuggingFace transformers).

This is a functional skeleton: if ``transformers`` + ``torch`` + a
TrOCR checkpoint are installed it will run real inference; otherwise it
degrades gracefully to an informative error so the harness still works.

TrOCR is a line-level recognizer — it expects a single text line per
image. Full-page manuscripts therefore need line segmentation upstream;
the segmentation hook below is intentionally left as a no-op stub so the
integration point is explicit. See README "TrOCR integration" for the
recommended pipeline (binarize -> line-segment -> batch recognize).
"""

from __future__ import annotations

import time
from typing import Any, Dict, List

from .base import BaseTranscriber, TranscriptionOutput


class TrOCRTranscriber(BaseTranscriber):
    def __init__(
        self,
        model_name: str = "microsoft/trocr-base-handwritten",
        device: str = "cpu",
        max_new_tokens: int = 256,
    ):
        self.model_name = model_name
        self.device = device
        self.max_new_tokens = max_new_tokens
        self._ready = False
        self._init_error = ""
        try:
            import torch  # type: ignore
            from PIL import Image  # type: ignore
            from transformers import (  # type: ignore
                TrOCRProcessor,
                VisionEncoderDecoderModel,
            )

            self._torch = torch
            self._Image = Image
            self._processor = TrOCRProcessor.from_pretrained(model_name)
            self._model = VisionEncoderDecoderModel.from_pretrained(model_name)
            self._model.to(device)
            self._model.eval()
            self._ready = True
        except Exception as exc:  # ImportError or checkpoint download failure
            self._init_error = (
                f"TrOCR backend unavailable ({exc}). Install with "
                "`pip install transformers torch` and ensure the checkpoint "
                f"'{model_name}' is reachable."
            )

    def name(self) -> str:
        return f"trocr::{self.model_name.split('/')[-1]}"

    # --- Integration point: replace with a real line segmenter ----------
    def _segment_lines(self, image) -> List[Any]:
        """Return a list of single-line image crops.

        Stub: treats the whole page as one line. A production setup would
        plug in Kraken/docTR/an OpenCV projection-profile segmenter here.
        """
        return [image]

    def _recognize_line(self, line_image) -> str:
        pixel_values = self._processor(
            images=line_image.convert("RGB"), return_tensors="pt"
        ).pixel_values.to(self.device)
        with self._torch.no_grad():
            generated = self._model.generate(
                pixel_values, max_new_tokens=self.max_new_tokens
            )
        return self._processor.batch_decode(generated, skip_special_tokens=True)[0]

    def transcribe(self, image_path: str, metadata: Dict[str, Any]) -> TranscriptionOutput:
        if not self._ready:
            return TranscriptionOutput(text="", error=self._init_error)
        t0 = time.time()
        try:
            image = self._Image.open(image_path)
            lines = self._segment_lines(image)
            text = "\n".join(self._recognize_line(ln) for ln in lines)
            return TranscriptionOutput(
                text=text.strip(),
                latency_sec=time.time() - t0,
                raw={"lines": len(lines)},
            )
        except Exception as exc:
            return TranscriptionOutput(
                text="", latency_sec=time.time() - t0, error=str(exc)
            )
