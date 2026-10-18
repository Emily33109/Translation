import * as webllm from '@mlc-ai/web-llm';

let engine = null;
let loadedModel = '';

export const MODEL_IDS = [
  'Qwen3-0.6B-q4f16_1-MLC',
  'Qwen3-0.6B-q4f32_1-MLC',
  'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
  'Qwen3.5-0.8B-q4f16_1-MLC'
];

export function getLoadedModel() { return loadedModel; }
export function getEngine() { return engine; }

export async function loadModel(modelId, onProgress = () => {}) {
  if (!MODEL_IDS.includes(modelId)) throw new Error('選擇的模型不在允許清單中。');
  if (engine && loadedModel === modelId) return engine;
  if (engine) {
    try { await engine.unload(); } catch { /* continue and create a fresh engine */ }
    engine = null;
    loadedModel = '';
  }
  engine = await webllm.CreateMLCEngine(modelId, {
    initProgressCallback: (report) => onProgress({ progress: report.progress || 0, text: report.text || '' })
  });
  loadedModel = modelId;
  return engine;
}

export async function unloadModel() {
  if (engine) {
    try { await engine.unload(); } finally { engine = null; loadedModel = ''; }
  }
}
