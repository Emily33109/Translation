import './styles/main.css';
import { checkEnvironment } from './ai/environment-check.js';
import { getLoadedModel, loadModel } from './ai/model-manager.js';
import { translateText, requestStop } from './ai/translation.js';
import { addRecord, getRecords, clearRecords, importRecords } from './storage/local-db.js';

const $ = (id) => document.getElementById(id);
const state = { environmentPassed: false, modelLoaded: false, translationPassed: false, environment: null };
const pageNames = { overview: '儀表板總覽', ai: 'AI 環境測試', translation: '翻譯測試', records: '本機研究紀錄' };

function showPage(page) {
  document.querySelectorAll('.page').forEach(el => el.classList.toggle('active', el.id === `page-${page}`));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  $('pageTitle').textContent = pageNames[page] || pageNames.overview;
}

document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.page)));
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.go)));

function renderEnvironmentRows(rows) {
  const box = $('envRows');
  box.replaceChildren();
  rows.forEach(row => {
    const item = document.createElement('div'); item.className = 'env-row';
    const main = document.createElement('div'); main.className = 'env-main';
    const label = document.createElement('div'); label.className = 'env-label'; label.textContent = row.label;
    const hint = document.createElement('div'); hint.className = 'env-hint'; hint.textContent = row.hint;
    main.append(label, hint);
    const value = document.createElement('div'); value.className = `env-value ${row.kind || ''}`; value.textContent = row.value;
    item.append(main, value); box.append(item);
  });
}

async function runEnvironmentCheck() {
  $('btnCheck').disabled = true;
  $('btnCheck').textContent = '檢查中…';
  $('envRows').innerHTML = '<div class="empty-state">正在檢查瀏覽器、GPU 與本機儲存支援…</div>';
  try {
    const result = await checkEnvironment();
    state.environment = result;
    state.environmentPassed = result.canTryModel;
    renderEnvironmentRows(result.rows);
    if (result.canTryModel) {
      $('loadStatus').textContent = '環境初步檢查完成。請載入模型並完成翻譯測試。';
      $('model').value = result.supportsF16 ? 'Qwen3-0.6B-q4f16_1-MLC' : 'Qwen3-0.6B-q4f32_1-MLC';
      $('overviewEnv').textContent = '可嘗試載入模型';
    } else {
      $('overviewEnv').textContent = '需要排除問題';
      $('loadStatus').textContent = '環境初步檢查未通過，請先查看上方原因。';
    }
    try {
      await addRecord({ type: 'environment-test', time: new Date().toISOString(), rows: result.rows, canTryModel: result.canTryModel, supportsF16: result.supportsF16 });
      await refreshRecords();
    } catch (storageError) {
      $('recordStatus').textContent = `本機紀錄無法儲存：${storageError.message || storageError}`;
    }
  } catch (error) {
    $('envRows').innerHTML = `<div class="empty-state">環境檢查發生錯誤：${escapeHtml(error.message || String(error))}</div>`;
  } finally {
    $('btnCheck').disabled = false;
    $('btnCheck').textContent = '重新檢查';
  }
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

async function runModelLoad() {
  $('btnLoad').disabled = true;
  $('btnGo').disabled = true;
  $('bar').style.width = '0%';
  $('overviewModel').textContent = '載入中';
  try {
    const modelId = $('model').value;
    await loadModel(modelId, ({ progress, text }) => {
      $('bar').style.width = `${Math.round(progress * 100)}%`;
      $('loadStatus').textContent = text || `載入模型中：${Math.round(progress * 100)}%`;
    });
    state.modelLoaded = true;
    $('bar').style.width = '100%';
    $('loadStatus').textContent = `模型已載入：${getLoadedModel()}。接著請執行一筆翻譯測試。`;
    $('btnGo').disabled = false;
    $('overviewModel').textContent = '已載入';
  } catch (error) {
    state.modelLoaded = false;
    $('overviewModel').textContent = '載入失敗';
    $('loadStatus').textContent = `載入失敗：${error?.message || error}。可嘗試重新載入、切換模型或更新瀏覽器與顯示卡驅動程式。`;
  } finally {
    $('btnLoad').disabled = false;
  }
}

async function runTranslation() {
  $('btnGo').disabled = true;
  $('btnStop').disabled = false;
  $('out').textContent = '模型正在產生譯文…';
  $('speed').textContent = '';
  try {
    const record = await translateText({
      instruction: $('instr').value,
      source: $('src').value,
      convertTraditional: $('optConv').checked,
      onChunk: text => { $('out').textContent = text || '模型正在產生譯文…'; }
    });
    state.translationPassed = Boolean(record.response && record.response.trim());
    $('out').textContent = record.response || (record.stopped ? '翻譯已停止，未取得完整譯文。' : '模型沒有輸出譯文。');
    $('speed').textContent = `耗時 ${record.seconds} 秒${record.tokens_per_second ? ` · 約 ${record.tokens_per_second} tokens/秒` : ''}`;
    $('overviewTranslation').textContent = state.translationPassed ? '測試成功' : '未完成';
    $('recordStatus').textContent = '翻譯紀錄已儲存於本機。';
    await refreshRecords();
  } catch (error) {
    $('out').textContent = error?.message || String(error);
    state.translationPassed = false;
    $('overviewTranslation').textContent = '測試失敗';
  } finally {
    $('btnGo').disabled = !state.modelLoaded;
    $('btnStop').disabled = true;
  }
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function csvCell(value) {
  const str = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

async function refreshRecords() {
  const records = await getRecords();
  const body = $('logBody'); body.replaceChildren();
  const translations = records.filter(record => record.type === 'translation');
  if (!records.length) {
    const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 5; td.className = 'table-empty'; td.textContent = '尚無本機紀錄'; tr.append(td); body.append(tr); return records;
  }
  records.forEach(record => {
    const tr = document.createElement('tr');
    const cells = [record.time || record.createdAt || '', record.model || (record.type === 'environment-test' ? '環境檢查' : ''), record.source || (record.type === 'environment-test' ? '環境相容性檢查' : ''), record.response || (record.type === 'environment-test' ? (record.canTryModel ? '可嘗試載入模型' : '未通過初步檢查') : ''), record.seconds != null ? `${record.seconds} 秒` : '—'];
    cells.forEach(value => { const td = document.createElement('td'); td.textContent = String(value); tr.append(td); }); body.append(tr);
  });
  $('recordStatus').textContent = `${records.length} 筆本機紀錄（翻譯 ${translations.length} 筆）`;
  return records;
}

async function exportJSON() {
  const records = await getRecords();
  downloadBlob(`115-translation-records-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(records, null, 2), 'application/json;charset=utf-8');
}

async function exportCSV() {
  const records = await getRecords();
  const headers = ['type','time','model','instruction','source','response','model_original','converted_to_traditional','seconds','completion_tokens','tokens_per_second','finish_reason','canTryModel','supportsF16','rows'];
  const lines = [headers.map(csvCell).join(','), ...records.map(record => headers.map(key => csvCell(record[key])).join(','))];
  downloadBlob(`115-translation-records-${new Date().toISOString().slice(0,10)}.csv`, '\ufeff' + lines.join('\r\n'), 'text/csv;charset=utf-8');
}

async function importJSON(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const count = await importRecords(parsed);
    $('recordStatus').textContent = `已匯入 ${count} 筆紀錄。`;
    await refreshRecords();
  } catch (error) {
    $('recordStatus').textContent = `匯入失敗：${error?.message || error}`;
  } finally {
    $('jsonImport').value = '';
  }
}

$('btnCheck').addEventListener('click', runEnvironmentCheck);
$('btnLoad').addEventListener('click', runModelLoad);
$('btnGo').addEventListener('click', runTranslation);
$('btnStop').addEventListener('click', requestStop);
$('btnJson').addEventListener('click', exportJSON);
$('btnCsv').addEventListener('click', exportCSV);
$('jsonImport').addEventListener('change', event => importJSON(event.target.files?.[0]));
$('btnClear').addEventListener('click', async () => {
  if (!window.confirm('確定要清除這台電腦中保存的所有研究紀錄？此操作無法復原，請先匯出備份。')) return;
  await clearRecords();
  $('recordStatus').textContent = '本機紀錄已清除。';
  await refreshRecords();
});
$('optConv').addEventListener('change', async () => {
  $('convStatus').textContent = $('optConv').checked ? '啟用後會在首次翻譯時載入簡轉繁工具。' : '已關閉自動簡轉繁。';
});

// First screen is the AI readiness test, as required for per-computer compatibility checks.
showPage('ai');
runEnvironmentCheck();
refreshRecords().catch(error => { $('recordStatus').textContent = `本機資料庫錯誤：${error.message || error}`; });
