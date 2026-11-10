// 群雄割拠：GASの入口。ゲームの中身は GitHub（jsDelivr経由）から読みこむ。
// GitHubを更新すると、1分ほどで新しい版が届く（ここは書きかえなくてよい）。
var GH_USER = 'shakai-kyozai';   // GitHubのアカウント名
var GH_REPO = 'gunyu';           // リポジトリ名

function doGet() {
  var t = HtmlService.createTemplateFromFile('index');
  t.base = 'https://cdn.jsdelivr.net/gh/' + GH_USER + '/' + GH_REPO + '@' + latestVersion_() + '/';
  return t.evaluate()
    .setTitle('群雄割拠')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// GitHubの main の最新の版（コミット番号）を調べる。1分間は覚えておく。調べられないときは main を使う
function latestVersion_() {
  var cache = CacheService.getScriptCache();
  var v = cache.get('ver');
  if (v) return v;
  try {
    var r = UrlFetchApp.fetch('https://github.com/' + GH_USER + '/' + GH_REPO + '.git/info/refs?service=git-upload-pack', {muteHttpExceptions: true});
    var m = r.getContentText().match(/([0-9a-f]{40}) refs\/heads\/main/);
    if (m) { cache.put('ver', m[1], 60); return m[1]; }
  } catch (e) {}
  return 'main';
}
