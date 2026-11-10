// 群雄割拠：GASの入口。ゲームの中身は GitHub（jsDelivr経由）から読みこむので、ここは書きかえなくてよい。
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('群雄割拠')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
