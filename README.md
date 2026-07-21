# 遙控無人機專業操作證 學科測驗模擬

台灣交通部民航局「遙控無人機專業操作證」學科測驗的線上模擬測驗，題庫取自官方題庫 PDF（`professional_exam.pdf`，最近更新日期 114.5.28），共 4 章、588 題。

## 線上使用

**https://cg-aa.github.io/taiwan-drone-exam-practice/**

- 可選擇章節與題數（預設 40 題，模擬正式測驗）
- 不計時，交卷後顯示分數、及格判定（85 分）與錯題檢討

> 首次部署：合併到 `main` 後，`Deploy to GitHub Pages` workflow 會自動建置並啟用 Pages。若未自動啟用，請至 repo 的 Settings → Pages 將 Source 設為「GitHub Actions」再重新執行 workflow。

## 本機使用

```bash
python3 -m http.server -d site 8000
# 開啟 http://localhost:8000
```

（直接以 `file://` 開啟 `index.html` 會因瀏覽器限制無法載入題庫 JSON，請使用上述本機伺服器。）

## 專案結構

- `professional_exam.pdf` — 官方題庫原始檔
- `tools/extract_questions.py` — 以 PyMuPDF 解析 PDF，輸出 `site/data/questions.json`
- `site/` — 靜態網站（純 HTML/JS/CSS，無需建置）
- `.github/workflows/pages.yml` — GitHub Pages 自動部署

## 題庫更新

官方發布新題庫 PDF 後，覆蓋 `professional_exam.pdf` 並重新執行：

```bash
pip install pymupdf
python3 tools/extract_questions.py
```

腳本會驗證每題有 A–D 四個選項、答案齊全且題號連續，驗證失敗會直接報錯。

## 免責聲明

僅供練習參考，正式題庫與規定以[交通部民用航空局](https://www.caa.gov.tw/)公告為準。
