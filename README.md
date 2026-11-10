# gunyu
授業用

戦国大名の天下取りゲーム「群雄割拠」（中1社会）。

- 遊ぶページ：`index.html`（GitHub Pages で公開）
- 先生が書きかえるデータ：`data.js`（家・武将・政策・戦いの数値など）。コードを書きかえなくても、このファイルだけで調整できる。
- 画像：`img/`
- プログラム本体：`js/`

## 学校（i-FILTER）で使うとき
github.io が「カテゴリー外」で止められるため、GAS（script.google.com）を入口にする。
- `gas/Code.gs` と `gas/index.html` をGASのプロジェクトに貼り、ウェブアプリとしてデプロイする。
- ゲームの中身（`boot.js`・`style.css`・`js/`・`data.js`・`img/`）は jsDelivr 経由でこのリポジトリから読みこむ。GAS側は書きかえなくてよい。
