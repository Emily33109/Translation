import { getEngine, getLoadedModel } from './model-manager.js';
import { addRecord } from '../storage/local-db.js';

let converter = null;
let converterAttempted = false;
let shouldStop = false;

export function requestStop() {
  shouldStop = true;
  try { getEngine()?.interruptGenerate(); } catch { /* generation may already be complete */ }
}

async function ensureConverter() {
  if (converter || converterAttempted) return;
  converterAttempted = true;
  try {
    const mod = await import('opencc-js');
    const OpenCC = mod.default || mod;
    converter = OpenCC.Converter({ from: 'cn', to: 'twp' });
  } catch {
    converter = null;
    throw new Error('簡轉繁工具載入失敗。請確認網路連線，或取消簡轉繁後重試。');
  }
}

function toTraditional(text) {
  if (!converter) return text;
  try { return converter(text); } catch { return text; }
}

function cleanThink(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*$/, '').trim();
}

export async function translateText({ instruction, source, convertTraditional, onChunk = () => {} }) {
  const engine = getEngine();
  const model = getLoadedModel();
  if (!engine || !model) throw new Error('請先成功載入模型。');
  if (!source.trim()) throw new Error('請先輸入要翻譯的原文。');
  if (convertTraditional) await ensureConverter();

  shouldStop = false;
  let raw = '';
  let usage = null;
  let finishReason = '';
  const started = performance.now();
  let firstTokenAt = 0;
  const prompt = `${instruction.trim()}\n\n${source.trim()}`;
  const request = {
    messages: [
      { role: 'system', content: '你是半導體產業的專業翻譯。譯文必須使用繁體中文（台灣用語），絕對不可以使用簡體字。只輸出譯文，不要解釋。' },
      { role: 'user', content: '請把下列英文翻譯成繁體中文（台灣用語），只輸出譯文：\n\nThe wafer was cleaned in the cleanroom.' },
      { role: 'assistant', content: '晶圓在無塵室中完成清洗。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 768,
    stream: true,
    stream_options: { include_usage: true }
  };
  if (model.startsWith('Qwen3')) request.extra_body = { enable_thinking: false };

  try {
    const chunks = await engine.chat.completions.create(request);
    for await (const chunk of chunks) {
      if (shouldStop) break;
      const choice = chunk.choices?.[0];
      const delta = choice?.delta?.content;
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      if (delta) {
        if (!firstTokenAt) firstTokenAt = performance.now();
        raw += delta;
        const visible = cleanThink(raw);
        onChunk(convertTraditional ? toTraditional(visible) : visible);
      }
      if (chunk.usage) usage = chunk.usage;
    }
  } catch (error) {
    throw new Error(`模型翻譯失敗：${error?.message || error}`);
  }

  const modelOriginal = cleanThink(raw);
  const response = convertTraditional ? toTraditional(modelOriginal) : modelOriginal;
  const seconds = Number(((performance.now() - started) / 1000).toFixed(2));
  const generationSeconds = firstTokenAt ? (performance.now() - firstTokenAt) / 1000 : 0;
  const tokensPerSecond = usage?.completion_tokens && generationSeconds > 0 ? Number((usage.completion_tokens / generationSeconds).toFixed(2)) : null;
  const record = {
    type: 'translation',
    time: new Date().toISOString(),
    model,
    instruction,
    source,
    response,
    model_original: modelOriginal,
    converted_to_traditional: response !== modelOriginal,
    finish_reason: finishReason || null,
    seconds,
    completion_tokens: usage?.completion_tokens ?? null,
    tokens_per_second: tokensPerSecond,
    stopped: shouldStop
  };
  await addRecord(record);
  return record;
}
