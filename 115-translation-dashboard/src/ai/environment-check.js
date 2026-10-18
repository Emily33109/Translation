export async function checkEnvironment() {
  const rows = [];
  const ua = navigator.userAgent;
  const match = ua.match(/(Edg|Chrome)\/(\d+)/);
  const version = match ? Number(match[2]) : 0;
  const browserLabel = match ? `${match[1] === 'Edg' ? 'Edge' : 'Chrome'} ${version}` : '未辨識的瀏覽器';
  rows.push({ label: '瀏覽器', hint: '建議使用最新版 Chrome 或 Edge', value: browserLabel, kind: version >= 113 ? 'ok' : 'warn' });
  rows.push({ label: '安全環境', hint: 'WebGPU 通常需要 HTTPS 或 localhost', value: window.isSecureContext ? '安全環境' : '非安全環境', kind: window.isSecureContext ? 'ok' : 'bad' });
  rows.push({ label: 'IndexedDB', hint: '用於保存本機研究紀錄', value: 'indexedDB' in window ? '支援' : '不支援', kind: 'indexedDB' in window ? 'ok' : 'bad' });
  if (!navigator.gpu) {
    rows.push({ label: 'WebGPU', hint: '此瀏覽器或目前設定未提供 WebGPU', value: '不支援', kind: 'bad' });
    return { rows, canTryModel: false, supportsF16: false };
  }
  let adapter = null;
  try { adapter = await navigator.gpu.requestAdapter(); } catch { /* handled below */ }
  if (!adapter) {
    rows.push({ label: 'WebGPU', hint: '找不到可用的 GPU adapter；可能受驅動程式或瀏覽器設定影響', value: '無法取得', kind: 'bad' });
    return { rows, canTryModel: false, supportsF16: false };
  }
  rows.push({ label: 'WebGPU', hint: '已取得 GPU adapter；仍需實際載入模型確認', value: '可用', kind: 'ok' });
  let info = adapter.info || null;
  if (!info && adapter.requestAdapterInfo) {
    try { info = await adapter.requestAdapterInfo(); } catch { /* some browsers do not expose adapter info */ }
  }
  const gpuName = info ? [info.vendor, info.architecture, info.description].filter(Boolean).join(' / ') : '瀏覽器未提供資訊';
  rows.push({ label: '顯示卡資訊', hint: '瀏覽器可能隱藏實際型號', value: gpuName || '瀏覽器未提供資訊', kind: '' });
  const supportsF16 = Boolean(adapter.features?.has('shader-f16'));
  rows.push({ label: 'shader-f16', hint: '支援時可優先嘗試 q4f16 模型；不支援時改試 q4f32', value: supportsF16 ? '支援' : '不支援', kind: supportsF16 ? 'ok' : 'warn' });
  const maxBufferMB = adapter.limits?.maxBufferSize ? Math.round(adapter.limits.maxBufferSize / 1048576) : null;
  rows.push({ label: '單一緩衝區上限', hint: '不等於 GPU 總記憶體容量', value: maxBufferMB ? `${maxBufferMB} MB` : '未提供', kind: maxBufferMB >= 1024 ? 'ok' : 'warn' });
  rows.push({ label: 'GPU 專用記憶體', hint: '瀏覽器不一定會公開此資訊，必要時請在作業系統工作管理員確認', value: '請手動確認', kind: 'warn' });
  return { rows, canTryModel: true, supportsF16 };
}
