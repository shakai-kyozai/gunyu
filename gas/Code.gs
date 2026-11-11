// 群雄割拠：GASの入口。ゲームの中身は GitHub（jsDelivr経由）から読みこむ。
// GitHubを更新すると、1分ほどで新しい版が届く（ここは書きかえなくてよい）。
var GH_USER = 'shakai-kyozai';   // GitHubのアカウント名
var GH_REPO = 'gunyu';           // リポジトリ名

function doGet() {
  var t = HtmlService.createTemplateFromFile('index');
  t.base = 'https://cdn.jsdelivr.net/gh/' + GH_USER + '/' + GH_REPO + '@' + latestVersion_().v + '/';
  return t.evaluate()
    .setTitle('群雄割拠')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// いちばん新しい版を調べる。1分間は覚えておく。
// 調べ方を3つ用意し、どれも失敗したときは、前に調べられた版を使う（古い版に戻らないように）
function latestVersion_() {
  var cache = CacheService.getScriptCache();
  var props = PropertiesService.getScriptProperties();
  var c = cache.get('ver');
  if (c) return {v: c, how: '1分以内に調べた版'};
  var tries = [
    ['GitHubの版の一覧', function () {
      var r = UrlFetchApp.fetch('https://github.com/' + GH_USER + '/' + GH_REPO + '.git/info/refs?service=git-upload-pack', {muteHttpExceptions: true});
      var m = r.getContentText().match(/([0-9a-f]{40}) refs\/heads\/main/);
      return m ? m[1] : null;
    }],
    ['GitHubのVERSIONファイル', function () {
      var r = UrlFetchApp.fetch('https://raw.githubusercontent.com/' + GH_USER + '/' + GH_REPO + '/main/VERSION?t=' + Date.now(), {muteHttpExceptions: true});
      var s = r.getResponseCode() === 200 ? r.getContentText().trim() : '';
      return /^v[0-9a-z.-]+$/.test(s) ? s : null;
    }],
    ['GitHubのAPI', function () {
      var r = UrlFetchApp.fetch('https://api.github.com/repos/' + GH_USER + '/' + GH_REPO + '/commits/main', {muteHttpExceptions: true, headers: {Accept: 'application/vnd.github.sha'}});
      var s = r.getContentText().trim();
      return /^[0-9a-f]{40}$/.test(s) ? s : null;
    }]
  ];
  for (var i = 0; i < tries.length; i++) {
    try {
      var v = tries[i][1]();
      if (v) { cache.put('ver', v, 60); props.setProperty('lastVer', v); return {v: v, how: tries[i][0]}; }
    } catch (e) {}
  }
  var last = props.getProperty('lastVer');
  if (last) return {v: last, how: '調べられなかったので、前に調べた版'};
  return {v: 'main', how: '調べられなかった（main）'};
}

// 確かめるとき：エディタでこの関数を選んで「実行」→ 下の「実行ログ」に、どの版をどう調べたかが出る
function checkVersion() {
  CacheService.getScriptCache().remove('ver');
  var r = latestVersion_();
  Logger.log('版：' + r.v + '（' + r.how + '）');
}
