// Speech-to-text that runs on your phone (Whisper, via transformers.js).
// The model (~77 MB) downloads once on first use, then is kept by Safari for next time.
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2";

const MODEL = "onnx-community/whisper-base.en_timestamped";
let asr = null;

async function load() {
  if (asr) return asr;
  const progress_callback = (p) => {
    if (p.status === "progress" && p.total) {
      self.postMessage({ type: "download", file: p.file, loaded: p.loaded, total: p.total });
    }
  };
  // WASM is slower than the GPU but works on every iPhone/iPad, so it's the safe default.
  asr = await pipeline("automatic-speech-recognition", MODEL, { device: "wasm", dtype: "q8", progress_callback });
  return asr;
}

self.onmessage = async (e) => {
  const { pcm } = e.data;
  try {
    const model = await load();
    self.postMessage({ type: "listening" });
    const out = await model(pcm, { return_timestamps: "word", chunk_length_s: 30, stride_length_s: 5 });
    self.postMessage({ type: "done", out });
  } catch (err) {
    self.postMessage({ type: "error", message: String(err?.message || err) });
  }
};
