# 115 翻譯專案儀表板（第一階段原型）

這個原型先完成網站骨架、AI 環境檢查、WebLLM 模型載入與實際翻譯測試，以及 IndexedDB 本機紀錄和 CSV／JSON 匯出。Firebase Google 登入與角色審核尚未接入。

## 需求
- Node.js 20 或更新的 LTS 版本
- 最新版 Chrome 或 Edge（WebGPU 支援依作業系統、GPU 與驅動程式而異）
- 首次安裝相依套件及首次下載 AI 模型時需要網路

## 本機執行

```bash
npm install
npm run dev
```

請使用終端機顯示的 localhost 網址開啟網站，不要直接以 `file://` 開啟 `index.html`。

## 建置

```bash
npm run build
npm run preview
```

建置結果位於 `dist/`。`vite.config.js` 使用相對資源路徑，可配合 GitHub Pages 的 repository 子路徑部署；實際部署仍需設定 GitHub Actions 或 Pages 的 build 流程。

## 目前功能
- 首頁直接顯示 AI 環境測試。
- 檢查瀏覽器、HTTPS 安全環境、IndexedDB、WebGPU、GPU adapter 與 `shader-f16`。
- 依 `shader-f16` 支援情況推薦初始模型，允許手動切換。
- 顯示模型載入進度；需真正載入模型後才可翻譯。
- 半導體專業英文翻譯，預設繁體中文（台灣用語），可選擇簡轉繁。
- 研究紀錄存於瀏覽器 IndexedDB，支援 CSV／JSON 匯出及 JSON 匯入。
- 包含原始測試頁及儀表板模板副本於 `reference/`，供後續比對與保留。

## 重要限制
- 此原型尚未串接 Firebase、登入、帳號審核或教師／學生權限。
- 環境檢查是初步判斷；真正的相容性需以模型成功載入並完成翻譯為準。
- WebLLM 模型與部分程式相依資源首次使用時需要網路。瀏覽器快取可能被清除，不保證永久離線可用。
- 本機紀錄不會同步到其他裝置。請定期匯出 JSON 備份。
- 不要把 Firebase Admin SDK 私密金鑰或任何伺服器秘密放進 GitHub Pages 前端程式。
