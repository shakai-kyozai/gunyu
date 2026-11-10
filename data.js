/* =========================================================
   群雄割拠　データ（GAS版ではスプレッドシートから読みこむ）
   ========================================================= */
// 収入の倍率（1＝もとのまま。15ターンで金があまりすぎないように少しおさえている）
const INCOME_RATE=0.9;
// 兵の維持費：兵何百人ごとに金1かかるか（小さいほど維持費が高い）
const UPKEEP_DIV=15;
// 一揆の起きやすさ（1ターンに1地域で起きる割合のもと）
const IKKI_BASE=0.01;
// 天下統一の条件：京都を持ち、家臣と合わせて全国の石高のこの割合以上を持つ（0.4＝4割）
const UNIFY_SHARE=0.4;
// 籠城：攻めに負けても、本拠の城は honjo ターン、国の拠点の城は main ターン持ちこたえる（そのあいだに助けに行ける）
const SIEGE_TURNS={honjo:3,main:2};
// 年貢：家臣の家が主君に毎ターン納める金の割合（収入の何割か。0.2＝2割）
const NENGU_RATE=0.2;
// 大将（当主以外の武将）の顔の絵：武将の名前と、img/face/ に置いたファイル名。絵がない武将は書かない（家紋の丸になる）
// 例：'柴田勝家':'b_oda_2.jpg',
const BUSHO_FACE={
  '高坂昌信':'b_takeda_4.jpg',
  '馬場信春':'b_takeda_3.jpg',
  '山県昌景':'b_takeda_2.jpg',
  '本多忠勝':'b_matsudaira_3.jpg',
  '酒井忠次':'b_matsudaira_2.jpg',
  '岡部元信':'b_imagawa_3.jpg',
  '朝比奈泰朝':'b_imagawa_2.jpg',
  '丹羽長秀':'b_oda_4.jpg',
  '木下藤吉郎':'b_oda_3.jpg',
  '柴田勝家':'b_oda_2.jpg',
  '宇喜多直家':'b_uragami_2.jpg',
  '里見義弘':'b_satomi_2.jpg',
  '佐竹義昭':'b_satake_2.jpg',
  '鍋島直茂':'b_ryuzoji_2.jpg',
  '山中鹿介':'b_amago_2.jpg',
  '蒲生賢秀':'b_rokkaku_2.jpg',
  '竹中半兵衛':'b_saito_3.jpg',
  '稲葉一鉄':'b_saito_2.jpg',
  '真柄直隆':'b_asakura_2.jpg',
  '磯野員昌':'b_azai_2.jpg',
  '伊達輝宗':'b_date_2.jpg',
  '香宗我部親泰':'b_chosokabe_2.jpg',
  '高橋紹運':'b_otomo_3.jpg',
  '戸次鑑連':'b_otomo_2.jpg',
  '安宅冬康':'b_miyoshi_4.jpg',
  '三好実休':'b_miyoshi_3.jpg',
  '十河一存':'b_miyoshi_2.jpg',
  '島津家久':'b_shimazu_3.jpg',
  '島津義弘':'b_shimazu_2.jpg',
  '小早川隆景':'b_mori_3.jpg',
  '吉川元春':'b_mori_2.jpg',
  '北条氏政':'b_hojo_3.jpg',
  '北条綱成':'b_hojo_2.jpg',
  '直江景綱':'b_uesugi_3.jpg',
  '柿崎景家':'b_uesugi_2.jpg',
};
// ゲームの題名（タイトル画面・ブラウザのタブに出る）
const GAME_TITLE={n:'群雄割拠',yomi:'ぐんゆうかっきょ',sub:'戦国大名の天下取り'};
const YEARS=[1560,1562,1564,1566,1568,1570,1572,1574,1576,1578,1580,1582,1584,1586,1588]; // 1ターン＝2年・15ターン
const TURN_SEC=120;   // 1ターンの命令の制限時間（秒）。0にすると制限なし
const END_YEAR=1590;
const MP=5;                 // 1ターン（2年）に動ける距離（主な街道1、山道2）
const BATCH=5;              // 兵を集める単位（5＝500人）
// 兵種：n=地図の表記, cost=5（500人）集める金
const TYPES={
 ashi:{n:'歩',full:'足軽（雑兵）',cost:2,d:'安く集められる。槍で騎馬に強いが、弓・鉄砲に弱い。乱戦で力を出す。'},
 kiba:{n:'騎',full:'騎馬（武者）',cost:4,d:'突撃で大きな力を出す。弓・鉄砲に強いが、足軽の槍に弱い。山では力が落ちる。'},
 yumi:{n:'弓',full:'弓隊',cost:3,d:'遠くから攻める。足軽に強いが、騎馬に弱い。'},
 teppo:{n:'鉄',full:'鉄砲隊',cost:6,d:'遠くから大きな力で攻める（1575年からさらに強い）。足軽に強いが、騎馬に弱い。鉄砲の産地か南蛮貿易が必要。'}
};
const TORDER=['ashi','kiba','yumi','teppo'];

// 大将の護衛（旗本・馬廻衆）：重い甲冑の武者。人数は百人単位（2＝200人）。1人で兵 pow 人分の力があり、損害も pow 分の1しか受けない
// 護衛が全滅すると、その大将は討ち死にする（1人でも生き残れば大丈夫）
const GUARD={lord:2,gen:1,pow:5};
// 陣形（野戦・城攻めの攻める側）。dealt：与える損害、taken：受ける損害、expo：大将の旗本がねらわれる割合、beats：相性で有利な陣形
const FORMS={
 atk:{n:'魚鱗の陣',k:'攻め',d:'先手の備のすぐ後ろに本陣を進め、うろこのように固まって敵のまん中をつき破る。与える損害+25%・受ける損害+10%。大将が前に出るので、旗本がねらわれやすい。',dealt:1.25,taken:1.1,expo:0.10,beats:'bal'},
 bal:{n:'鶴翼の陣',k:'つり合い',d:'備を左右に広げ、鶴がつばさを広げたように敵をつつむ。兵が敵より3割以上多いと、与える損害がさらに+15%。',dealt:1,taken:1,expo:0.05,beats:'def',wrap:0.15},
 def:{n:'方円の陣',k:'守り',d:'本陣をまん中に置き、まわりを備で円く固める。与える損害-15%・受ける損害-20%・士気が下がりにくい。大将がいちばん安全。',dealt:0.85,taken:0.8,expo:0.02,beats:'atk',morale:0.85}
};
const FORM_BEAT=0.1;   // 陣形の相性で有利なとき、与える損害+10%（魚鱗→鶴翼→方円→魚鱗）
// 城を守る側の大将の指揮のしかた
const SIEGE_CMD={
 front:{n:'前線で指揮する',k:'前線',d:'大将みずから城門で戦い、兵の気持ちを高める。士気+10・与える損害+20%・受ける損害-10%。ただし旗本がねらわれやすい。',dealt:1.2,taken:0.9,expo:0.10},
 honmaru:{n:'本丸で指揮する',k:'本丸',d:'大将は本丸から指図する。大将は安全だが、力は上がらない。',dealt:1,taken:1,expo:0.01}
};
const BATTLE_ROUNDS=6;  // 1つの戦いの最大の段階の数（射撃戦・鑓合わせ・打撃・乱戦・乱戦…）
// 戦いの画面の背景（img/bf/）。戦場ごとに部隊が動ける範囲を、画像の幅・高さに対する割合（0〜1）で書く
//  野戦・山地：y＝部隊が並べる上下の範囲
//  城攻め：front＝攻める側が寄せられる右のはし（堀の手前）、inn＝城の中で守る側が並べる範囲[左,右,上,下]、keep＝天守（本丸）の位置[x,y]
const BATTLE_BG={
 plain:[
  {src:'img/bf/plain1.jpg',y:[0.10,0.90]},
  {src:'img/bf/plain2.jpg',y:[0.08,0.90]},
  {src:'img/bf/plain3.jpg',y:[0.08,0.90]}],
 mountain:[
  {src:'img/bf/mtn1.jpg',y:[0.10,0.74]},
  {src:'img/bf/mtn2.jpg',y:[0.12,0.80]},
  {src:'img/bf/mtn3.jpg',y:[0.06,0.74]},
  {src:'img/bf/mtn4.jpg',y:[0.28,0.84]}],
 siege:[
  {src:'img/bf/siege1.jpg',front:0.29,inn:[0.53,0.86,0.20,0.80],keep:[0.93,0.48]},
  {src:'img/bf/siege2.jpg',front:0.44,inn:[0.57,0.89,0.24,0.90],keep:[0.94,0.40]},
  {src:'img/bf/siege3.jpg',front:0.31,inn:[0.52,0.87,0.18,0.86],keep:[0.94,0.36]},
  {src:'img/bf/siege4.jpg',front:0.42,inn:[0.57,0.88,0.22,0.88],keep:[0.94,0.22]}]
};
// 3つの段階での力（CK3の戦いの段階にならう）
// 戦国の合戦の流れ：①射撃戦（弓・鉄砲）→②鑓合わせ（長柄足軽が鑓をたたきつけて敵の足を止める＝拘束）→③打撃（騎馬武者・旗本が突撃する）→④乱戦
const PHASES=[
 {n:'射撃戦',d:'弓・鉄砲で撃ち合う。鉄砲の音と煙は、当たらなくても敵をひるませる',p:{ashi:0.1,kiba:0,yumi:1.0,teppo:1.6}},
 {n:'鑓合わせ',d:'長柄足軽が前に出て、長い鑓をたたきつけて敵の足を止める',p:{ashi:1.3,kiba:0.5,yumi:0.3,teppo:0.3}},
 {n:'打撃',d:'足の止まった敵に、騎馬武者と旗本が突撃する',p:{ashi:0.6,kiba:2.0,yumi:0.3,teppo:0.3}},
 {n:'乱戦',d:'槍と刀で入り乱れて戦う',p:{ashi:1.2,kiba:1.2,yumi:0.6,teppo:0.6}}
];
// 士気：はじめは100。損害や鉄砲の音と煙で下がり、ROUT 以下になると軍勢はくずれて敗走する
const MORALE={start:100,rout:20,lossK:140,teppoK:0.8,teppoMax:25,generalDead:15,front:10,castle:0.8};
// 相性（行が攻める側、列が相手）
const BEATS={ashi:['kiba'],kiba:['yumi','teppo'],yumi:['ashi'],teppo:['ashi']};
const ADV=1.5,DIS=0.75;
const KIND={'城':{n:'城',i:'▲',g:0},'港':{n:'港',i:'◆',g:1},'銀':{n:'鉱山',i:'◇',g:4},'京':{n:'京都',i:'★',g:3},'堺':{n:'堺',i:'◎',g:5},'寺':{n:'寺社',i:'卍',g:1}};
const TEPPO_SRC=['sakai','saika','odani']; // 鉄砲の産地（堺・雑賀・国友）

// 主な街道（つながっている地域の順）。主な街道は1、そのほかのとなりは山道で2を使う
const ROADS={
 '東海道':['kyoto','sakamoto','koka','kanbe','nagashima','kiyosu','okazaki','yoshida','hikuma','kakegawa','sunpu','kokokuji','nirayama','odawara','tamanawa','edo'],
 '中山道':['sakamoto','kannonji','sawayama','ogaki','inabayama','iwamura','kiso','fukashi','suwa','ueda','minowa','umayabashi','oshi','iwatsuki','edo'],
 '北陸道':['sawayama','odani','tsuruga','ichijodani','daishoji','oyama','masuyama','toyama','matsukura','kasugayama','tochio','shibata'],
 '北国街道':['ueda','kawanakajima','kasugayama'],
 '甲州街道':['edo','takiyama','gunnai','tsutsujigasaki','suwa'],
 '奥州街道':['edo','iwatsuki','koga','utsunomiya','nasu','shirakawa','miharu','dategun','kokubun','osaki','kasai','kozukata','sannohe','tsugaru'],
 '羽州街道':['dategun','yonezawa','yamagata','senboku','minato','tsugaru'],
 '山陽道':['kyoto','akutagawa','arioka','hyogo','miki','oshio','kozuki','tenjinyama','takamatsu','kannabe','itsukushima','iwakuni','yamaguchi','katsuyama'],
 '山陰道':['kyoto','kameyama','yakami','kuroi','konosumi','tottori','odaka','gassantoda','omori','tsuwano','hagi','katsuyama'],
 '南海道':['kyoto','makishima','iimori','takaya','kishiwada','saika'],
 '大坂道':['akutagawa','ishiyama','sakai','kishiwada'],
 '大和路':['makishima','shigisan','tsutsui','yoshino'],
 '伊勢路':['kanbe','anotsu','okochi','toba'],
 '四国の道':['shozui','tenkiri','niiza','yuzuki','ozu','nakamura'],
 '土佐の道':['shozui','oko','aki_t'],
 '西海道':['kokura','hakata','iwaya','yanagawa','kumamoto','yatsushiro','izumi_s','uchijo'],
 '豊後の道':['kokura','nakatsu','funai','agata','tonokori','obi'],
 '肥前の道':['iwaya','saga','nagasaki']
};
// 海の道：[地域, 地域, 使う距離]
const SEA=[['katsuyama','kokura',1],['hyogo','awaji',1],['awaji','shozui',1],['nagashima','kiyosu',1],['tamanawa','tateyama',2],
 ['itsukushima','yuzuki',2],['funai','ozu',2],['hinoe','kumamoto',2],['tenjinyama','tenkiri',2],['saika','shozui',2],['hakata','karatsu',1],['karatsu','hirado',1]];

/* 大名：id, 家名, 字, はじめの地域, ☆, 目標, 必要数, 目標の文, 実際の歴史, 裏切りやすさ, 武将[名前,統率] , 騎馬の割合 */
// 家ごとの色（「家ごとの色」の地図・家紋の丸に使う）。となりあう家ができるだけ見分けやすくなるように選んである
// 色を変えるときは '#' のあとの6けたを書きかえる。ここにない家は自動で色が決まる
const HOUSE_COL={
  oda:'#2cb9dd',   // 織田
  imagawa:'#955cd6',   // 今川
  matsudaira:'#3d9e1a',   // 松平（徳川）
  takeda:'#c11f1f',   // 武田
  uesugi:'#9e1a9e',   // 上杉
  hojo:'#729e1a',   // 北条
  mori:'#c78a6b',   // 毛利
  shimazu:'#c76bb5',   // 島津
  miyoshi:'#1fc160',   // 三好
  otomo:'#dd2cdd',   // 大友
  chosokabe:'#d65c85',   // 長宗我部
  date:'#dd7f2c',   // 伊達
  azai:'#9e691a',   // 浅井
  asakura:'#1fc11f',   // 朝倉
  saito:'#dd2ca2',   // 斎藤
  rokkaku:'#2c50dd',   // 六角
  amago:'#962cdd',   // 尼子
  ryuzoji:'#933325',   // 龍造寺
  satake:'#9e1a69',   // 佐竹
  ashina:'#25935f',   // 蘆名
  mogami:'#2c8add',   // 最上
  nanbu:'#853249',   // 南部
  satomi:'#846bc7',   // 里見
  kitabatake:'#857a32',   // 北畠
  matsunaga:'#dd2c73',   // 松永
  hatakeyama:'#254993',   // 畠山
  uragami:'#c1a11f',   // 浦上
  yamana:'#b42d48',   // 山名
  akamatsu:'#255f93',   // 赤松
  kono:'#2c73dd',   // 河野
  ito:'#4e8532',   // 伊東
  jinbo:'#2db4ab',   // 神保
  anegakoji:'#2c2cdd',   // 姉小路
};
const HOUSE_DEF=[
 ['oda','織田','織',['kiyosu','inuyama'],1,['inabayama','kyoto'],2,'美濃の稲葉山城を取り、京都に上る','1560年に桶狭間の戦いで今川義元を討つ。1568年に足利義昭を連れて上洛し、1573年に室町幕府を滅ぼす。1575年に長篠の戦いで鉄砲隊を使って武田を破る。1582年に本能寺の変で討たれる。',.15,[['織田信長',92],['柴田勝家',88],['木下藤吉郎',86],['丹羽長秀',80]],.15],
 ['imagawa','今川','今',['sunpu','kokokuji','hikuma','kakegawa','yoshida'],1,['kiyosu','okazaki'],2,'三河を固め、尾張の清洲へ進む','1560年に桶狭間の戦いで義元が討たれ、1569年に大名としては滅ぶ。',.1,[['今川義元',80],['朝比奈泰朝',76],['岡部元信',74]],.15],
 ['matsudaira','松平（徳川）','松',['okazaki'],1,['okazaki','yoshida','hikuma'],2,'今川から独立し、三河・遠江に家を広げる','1560年に今川から独立し、1562年に信長と同盟する。のちに豊臣秀吉に従い、1603年に江戸幕府を開く。',.1,[['松平元康',88],['酒井忠次',82],['本多忠勝',90]],.15],
 ['takeda','武田','武',['tsutsujigasaki','gunnai','suwa','ina','fukashi','ueda'],1,['kawanakajima','sunpu'],2,'北信濃の川中島を取り、海のある駿河へ出る','川中島で上杉と争う。1575年に長篠の戦いで織田・徳川の鉄砲隊に敗れ、1582年に滅ぶ。',.25,[['武田信玄',95],['山県昌景',90],['馬場信春',88],['高坂昌信',85]],.35],
 ['uesugi','上杉','上',['kasugayama','tochio','sakato','shibata'],1,['kawanakajima','umayabashi','edo'],2,'関東管領として、川中島・上野・武蔵をおさえる','謙信が武田・北条と争い続ける。のちに豊臣秀吉に従い、会津、さらに米沢へ移される。',.1,[['上杉謙信',98],['柿崎景家',84],['直江景綱',75]],.25],
 ['hojo','北条','北',['odawara','tamanawa','nirayama','edo','kawagoe','takiyama'],1,['iwatsuki','umayabashi','sakura','koga'],2,'関東をまとめる','関東の大部分を従えるが、1590年に豊臣秀吉の小田原攻めで滅ぶ。',.2,[['北条氏康',90],['北条綱成',88],['北条氏政',72]],.2],
 ['mori','毛利','毛',['koriyama','itsukushima','yamaguchi','iwakuni','katsuyama','hagi','miyoshi'],1,['gassantoda','omori'],2,'尼子を破り、石見銀山を手に入れる','1566年に尼子を滅ぼし、中国地方の大部分を従える。秀吉と和睦し、家を保つ。',.2,[['毛利元就',92],['吉川元春',90],['小早川隆景',88]],.15],
 ['shimazu','島津','島',['uchijo','izumi_s','kajiki'],1,['koyama','tonokori','kumamoto'],2,'九州の南を一つにまとめる','九州のほとんどを従えるが、1587年に秀吉の九州攻めで降伏し、家を保つ。',.2,[['島津義久',85],['島津義弘',92],['島津家久',88]],.2],
 ['miyoshi','三好','三',['akutagawa','iimori','arioka','hyogo','shozui','hakuchi','tenkiri','awaji','kishiwada'],1,['kyoto','sakai'],2,'京都と堺をおさえる','1560年ごろ畿内を支配するが、信長の上洛のあと力を失う。',.25,[['三好長慶',85],['十河一存',85],['三好実休',80],['安宅冬康',75]],.1],
 ['otomo','大友','大',['funai','oka','hita','nakatsu','kokura','hakata','iwaya'],1,['akizuki','yanagawa','saga'],2,'九州の北をおさえる','南蛮貿易で栄えるが、1578年に島津に敗れ、秀吉に助けを求める。',.15,[['大友宗麟',70],['戸次鑑連',92],['高橋紹運',85]],.15],
 ['chosokabe','長宗我部','長',['oko'],1,['aki_t','nakamura','shozui'],2,'土佐をまとめ、四国へ広げる','1585年ごろ四国のほとんどを従えるが、秀吉の四国攻めで降伏する。',.2,[['長宗我部元親',88],['香宗我部親泰',72]],.1],
 ['date','伊達','伊',['yonezawa','dategun'],1,['kurokawa','kokubun','miharu'],2,'奥州の家々を従える','政宗が南奥州を広げるが、小田原に遅れて参陣し、領地を減らされる。',.25,[['伊達晴宗',70],['伊達輝宗',74]],.2],
 ['azai','浅井','浅',['odani','sawayama'],0,['kannonji','takashima'],1,'近江をまとめる','信長と同盟するが、1570年に朝倉の側について信長と戦い、1573年に滅ぼされる。',.1,[['浅井長政',82],['磯野員昌',80]],.15],
 ['asakura','朝倉','朝',['ichijodani','tsuruga'],0,['oyama','obama'],1,'越前を守り、加賀か若狭へ広げる','1573年に信長に滅ぼされる。',.1,[['朝倉義景',60],['真柄直隆',78]],.15],
 ['saito','斎藤','斎',['inabayama','ogaki'],0,['inabayama','gujo','iwamura'],2,'美濃をまとめる','1567年に信長に美濃を奪われる。',.2,[['斎藤義龍',80],['稲葉一鉄',78],['竹中半兵衛',72]],.15],
 ['rokkaku','六角','六',['kannonji','koka'],0,['kannonji','kyoto'],2,'京都への道を守る','1568年に信長の上洛で居城を追われる。',.15,[['六角義賢',72],['蒲生賢秀',70]],.1],
 ['amago','尼子','尼',['gassantoda','omori','odaka','takada'],0,['omori','gassantoda'],2,'石見銀山を守り、毛利に負けない','1566年に毛利に滅ぼされる。',.1,[['尼子晴久',78],['山中鹿介',85]],.15],
 ['ryuzoji','龍造寺','龍',['saga'],0,['karatsu','nagasaki','yanagawa'],2,'肥前をまとめ、筑後へ進む','九州の西に広がるが、1584年に島津に敗れて力を失う。',.25,[['龍造寺隆信',84],['鍋島直茂',85]],.15],
 ['satake','佐竹','佐',['ota','mito'],0,['oda_h','utsunomiya'],1,'北関東をおさえる','家を保つが、関ヶ原の戦いのあと秋田へ移される。',.15,[['佐竹義重',86],['佐竹義昭',70]],.15],
 ['ashina','蘆名','蘆',['kurokawa'],0,['kurokawa'],1,'会津を守りぬく','1589年に伊達政宗に敗れて滅ぶ。',.15,[['蘆名盛氏',75]],.15],
 ['mogami','最上','最',['yamagata'],0,['shonai','minato'],1,'出羽をまとめる','家を保ち、江戸時代のはじめまで大名として続く。',.2,[['最上義光',80]],.15],
 ['nanbu','南部','南',['sannohe','kozukata'],0,['tsugaru','kasai'],1,'陸奥の北をまとめる','秀吉に従い、家を保つ。',.1,[['南部晴政',70]],.2],
 ['satomi','里見','里',['tateyama','kururi'],0,['otaki','sakura'],1,'房総を守り、下総へ進む','家を保つが、江戸時代に領地を取り上げられる。',.15,[['里見義堯',78],['里見義弘',76]],.15],
 ['kitabatake','北畠','畠',['okochi','anotsu'],0,['kanbe','iga'],1,'伊勢を守りぬく','1569年に信長に攻められて降伏し、のちに滅ぶ。',.1,[['北畠具教',72]],.1],
 ['matsunaga','松永','永',['shigisan'],0,['tsutsui','kyoto'],1,'大和をおさえ、京都の政治に関わる','信長に従ったりそむいたりをくり返し、1577年に滅ぶ。',.45,[['松永久秀',80]],.1],
 ['hatakeyama','畠山','山',['takaya'],0,['saika','koya'],1,'河内を守り、紀伊へ広げる','家臣に力を奪われ、力を失っていく。',.15,[['畠山高政',62]],.1],
 ['uragami','浦上','浦',['tenjinyama'],0,['takamatsu','matsuyama_b'],1,'備前を守り、備中へ進む','1575年に家臣の宇喜多直家に滅ぼされる（下剋上）。',.2,[['浦上宗景',70],['宇喜多直家',82]],.15],
 ['yamana','山名','名',['konosumi','ikuno'],0,['tottori'],1,'生野銀山を守り、因幡をまとめる','1580年に秀吉に攻められ、力を失う。',.15,[['山名祐豊',58]],.1],
 ['akamatsu','赤松','赤',['oshio','kozuki'],0,['miki'],1,'播磨をまとめる','家臣たちが力をつけ、力を失っていく。',.15,[['赤松義祐',55]],.1],
 ['kono','河野','河',['yuzuki'],0,['niiza','ozu'],1,'伊予をまとめる','1585年に秀吉の四国攻めで滅ぶ。',.1,[['河野通直',55]],.1],
 ['ito','伊東','東',['tonokori'],0,['obi','agata'],1,'日向をまとめ、島津に負けない','1577年に島津に追われる。',.1,[['伊東義祐',68]],.15],
 ['jinbo','神保','神',['toyama','masuyama'],0,['matsukura','nanao'],1,'越中を守り、能登へ進む','上杉に押されて力を失う。',.15,[['神保長職',62]],.1],
 ['anegakoji','姉小路','姉',['sakurabora'],0,['sakurabora'],1,'山国の飛騨で生き残る','1585年に秀吉の軍に攻められて降伏する。',.15,[['姉小路良頼',58]],.1]
];
// どの家にも属さない勢力（守りの強さ）
const NEUTRAL_POW={kyoto:2.0,ishiyama:2.6,nagashima:2.0,oyama:2.0,daishoji:1.8,saika:2.2,koya:1.5,sakamoto:1.6,sakai:1.6};
const NEUTRAL_NAME={kyoto:'室町幕府',ishiyama:'石山本願寺',nagashima:'長島一向一揆',oyama:'加賀一向一揆',daishoji:'加賀一向一揆',saika:'雑賀衆',koya:'高野山',sakamoto:'延暦寺',sakai:'堺の会合衆'};
const NEUTRAL_TEPPO=['ishiyama','saika','sakai'];
const IKKO=['nagashima','oyama','daishoji','ishiyama','okazaki','yoshida','ichijodani','saika'];
const REL0=[['takeda','hojo','domei'],['takeda','imagawa','domei'],['hojo','imagawa','domei'],['azai','asakura','domei'],['imagawa','matsudaira','domei'],
 ['mori','amago','teki'],['uesugi','takeda','teki'],['uesugi','hojo','teki'],['oda','imagawa','teki'],['oda','saito','teki'],
 ['otomo','ryuzoji','teki'],['shimazu','ito','teki'],['miyoshi','rokkaku','teki'],['miyoshi','hatakeyama','teki'],['date','ashina','teki'],['satomi','hojo','teki'],['satake','hojo','teki']];

// img：政策の挿絵（画像を差しかえるときは、ここのファイル名を書きかえる。なしでもよい）
const POLICIES=[
 {id:'bunkoku',img:'img/pol/bunkoku.jpg',n:'分国法を定める',y:1560,cost:3,d:'家のきまりを定め、自分の国で一揆が起きにくくなる。'},
 {id:'joraku',img:'img/pol/joraku.jpg',n:'上洛する',y:1568,cost:0,d:'京都をおさえていれば使える。将軍の名で、となりの家を1つえらんで「停戦命令」を出す。えらんだ家は、次のターンのあいだ、あなたの領地に攻めこめない。'},
 {id:'sonae',img:'img/pol/sonae.jpg',n:'備を立てる（兵種別編成）',y:1566,cost:6,d:'家臣がそれぞれ連れてきた兵（寄親寄子）を、弓・鉄砲・長柄・騎馬の兵種ごとに組みなおして「備」をつくる。長柄が敵の足を止めてから騎馬が突撃する動きがそろい（打撃の力が上がる）、小頭が兵をまとめるので士気もくずれにくくなる。'},
 {id:'rakuichi',img:'img/pol/rakuichi.jpg',n:'楽市・楽座',y:1572,cost:8,d:'城下町で、だれでも自由に商売できるようにする。毎ターンの収入が2割増える。'},
 {id:'kirisuto',img:'img/pol/kirisuto.jpg',n:'キリスト教を保護する',y:1572,cost:3,d:'港を持っていれば使える。南蛮貿易で金が毎ターン3増え、鉄砲の産地がなくても鉄砲隊を集められる。ただし一向宗の強い地域で一揆が起きやすくなる。'},
 {id:'kenchi',img:'img/pol/kenchi.jpg',n:'検地',y:1584,cost:10,d:'田畑の広さと収穫量を調べる。自分の地域の石高が2割増え、兵を多く持てるようになり、収入も増える。'},
 {id:'katana',img:'img/pol/katana.jpg',n:'刀狩',y:1588,cost:5,d:'検地をしていれば使える。農民から刀や鉄砲を取り上げ、一揆が起きなくなる。'},
 {id:'soubuji',img:'img/pol/soubuji.jpg',n:'関白になり惣無事令を出す',y:1584,cost:0,d:'京都をおさえ、最も多くの石高を持っていれば使える。大名どうしの争いを禁じ、これから先、戦いの力が1割増える。'}
];

// 場面の挿絵（画像ができたら、ファイル名を入れる。nullのあいだは模様だけを出す）
const SCENE_IMG={title:'img/scene/title.jpg',1560:'img/scene/1560.jpg',1564:'img/scene/1563.jpg',1566:'img/scene/1566.jpg',1568:'img/scene/1569.jpg',1572:'img/scene/1572.jpg',1574:'img/scene/1575.jpg',1576:'img/scene/1578.jpg',1582:'img/scene/1581.jpg',1584:'img/scene/1584.jpg',1588:'img/scene/1587.jpg',end:'img/scene/end.jpg',1562:'img/scene/1562.jpg',1570:'img/scene/1570.jpg',1578:'img/scene/1578.jpg',1580:'img/scene/1580.jpg',1586:'img/scene/1586.jpg'};
const EVENTS={
 1562:{t:'清洲同盟',d:'尾張の織田信長と三河の松平元康が同盟を結んだ。背後の心配がなくなった両家は、それぞれ別の方向へ勢力を広げていく。となりの家と同盟を結べば、守りに兵を割かずにすむ。'},
 1570:{t:'姉川の戦いと信長包囲網',d:'京都をおさえた大名に対して、浅井・朝倉・武田・本願寺などが手を結び、まわりから同時に攻めようとしている。強くなりすぎた家は、まわりの家からいっせいにねらわれやすい。'},
 1578:{t:'上杉謙信の死',d:'越後の上杉謙信が亡くなり、家の中で跡継ぎをめぐる争いが起きた。大名が亡くなると、強い家でも急に弱まることがある。'},
 1580:{t:'石山合戦の終わり',d:'10年にわたって戦い続けてきた石山本願寺が、朝廷の仲立ちで大坂の地を明けわたした。各地の一向一揆の力は、しだいに弱まっていく。'},
 1586:{t:'豊臣の姓と全国統一への道',d:'関白となった羽柴秀吉は、朝廷から豊臣の姓をあたえられた。惣無事令にしたがわない大名を攻め、全国統一は目前にせまっている。'},
 1560:{t:'桶狭間の戦いの直前',d:'駿河・遠江・三河を従える今川義元が、大軍で尾張へ向かおうとしている。尾張の織田信長は、まだ小さな大名にすぎない。幕府の力はおとろえ、各地の戦国大名が領地を広げようと争っている。'},
 1564:{t:'三河の一向一揆',d:'三河では、一向宗の信者たちが領主にそむいて一揆を起こしている。一向宗の力が強い地域（卍のある地域の近く）では、一揆に気をつけなければならない。'},
 1566:{t:'鉄砲の広まり',d:'1543年に種子島に伝わった鉄砲は、堺や紀伊の雑賀、近江の国友でつくられるようになった。これらの地域を持つ家は、鉄砲隊を集められる。'},
 1568:{t:'足利義昭が上洛を求める',d:'足利義昭が、自分を京都へ連れていき、将軍にしてくれる大名を探している。京都をおさえた家は「上洛する」を使えるようになった。'},
 1572:{t:'南蛮貿易と楽市・楽座',d:'ポルトガルの南蛮船が、長崎や平戸などの港に来るようになった。城下町で自由な商売を認める「楽市・楽座」も使えるようになった。'},
 1574:{t:'長篠の戦い',d:'三河の長篠で、大量の鉄砲隊をそろえた織田・徳川の軍が、武田の騎馬隊を破った。これからは、鉄砲隊の遠戦の力が大きくなる。'},
 1576:{t:'安土城と天下布武',d:'近江に、天守をもつ巨大な城が建てられた。「天下布武」の印を使う大名は、武力で天下を統一しようとしている。'},
 1582:{t:'本能寺の変',d:'天下統一に最も近い大名の家で、家臣がそむいた。いちばん多くの石高を持つ家は、京都に最も近い軍勢を失い、その地域は家臣のものになる。'},
 1584:{t:'太閤検地と関白',d:'京都をおさえた大名が、全国の田畑の広さと収穫量を調べる「検地」を始めた。朝廷から関白の位を得た大名は、「惣無事令」で大名どうしの争いを禁じようとしている。'},
 1588:{t:'刀狩と最後の戦い',d:'検地をした大名は、農民から刀を取り上げる「刀狩」を行えるようになった。武士と農民の身分が分かれていく。これが最後のターンである。'}
};
const HIST=[
 ['1560','桶狭間の戦い。織田信長が今川義元を討つ'],['1562','織田信長と徳川家康が同盟を結ぶ'],['1567','信長が美濃を手に入れ、「天下布武」の印を使い始める'],
 ['1568','信長が足利義昭を連れて上洛する'],['1573','信長が足利義昭を京都から追放し、室町幕府が滅ぶ'],['1575','長篠の戦い。鉄砲隊で武田軍を破る'],
 ['1576','安土城を築き始める。城下で楽市・楽座を行う'],['1582','本能寺の変。信長が家臣の明智光秀に討たれる。豊臣秀吉が光秀を破る。秀吉が検地を始める'],
 ['1585','秀吉が関白となる。四国を従える'],['1587','秀吉が九州を従える。バテレン追放令を出す'],['1588','秀吉が刀狩令を出す'],['1590','秀吉が小田原の北条氏を滅ぼし、全国を統一する']
];

// 地図の絵（ゲームの座標で、絵を置く範囲）
const MAP_BG={src:'img/map_hi.jpg',pol:'img/map_pol.jpg',x:14,y:-378,w:1435.11,h:1336.03};

// 軍勢の駒の絵（右向き・左向き）。空にすると、これまでの将軍のアイコンにもどる
// 家紋（画像は発光大王堂 hakko-daiodo.com の家紋素材を縮小して1枚にまとめたもの。6列×6行、1マス128px）
const KAMON={src:'img/kamon.png',n:6,cell:128,
 order:['oda','imagawa','matsudaira','takeda','uesugi','hojo','mori','shimazu','miyoshi','otomo','chosokabe','date','azai','asakura','saito','rokkaku','amago','ryuzoji','satake','ashina','mogami','nanbu','satomi','kitabatake','matsunaga','hatakeyama','uragami','yamana','akamatsu','kono','ito','jinbo','anegakoji'],
 name:{oda:'織田木瓜',imagawa:'丸の内に二つ引き',matsudaira:'三つ葉葵',takeda:'武田菱',uesugi:'竹に二羽飛び雀',hojo:'北条鱗',mori:'一文字に三つ星',shimazu:'島津十字',miyoshi:'三階菱に五つ釘抜き',otomo:'抱き杏葉',chosokabe:'七つ片喰',date:'竪三つ引両',azai:'三つ盛り亀甲に花菱',asakura:'三つ盛り木瓜',saito:'二頭立浪',rokkaku:'隅立て四つ目',amago:'平四つ目',ryuzoji:'変わり十二日足',satake:'五本骨扇に月丸',ashina:'丸に三つ引き',mogami:'丸に二つ引き',nanbu:'南部鶴',satomi:'丸に二つ引き',kitabatake:'笹竜胆',matsunaga:'蔦',hatakeyama:'丸に二つ引き',uragami:'檜扇',yamana:'山名桐',akamatsu:'左三つ巴',kono:'折敷に三文字',ito:'庵木瓜',jinbo:'丸に竪二つ引き',anegakoji:'丸に剣花菱'}};
// 立体の地図：標高・地面の色・兵科ごとの駒（3Dモデルをbase64にした.txt）。駒は軍勢でいちばん多い兵科。当主が率いる軍勢には大将（taisho）がならぶ
// yaw：モデルの正面を右向き（進む向き）にそろえる回転　idle：命令がないときの向き（大きいほど手前を向く）　s：大きさ
const VIEW3D={roadsInMap:true,h:'img/height16.png',tex:'img/terrain3d.jpg',texHi:'img/terrain3d_hi.jpg',
  // 近づいたときだけ読みこむ高精細の区画（地理院 標高タイル ズーム10＋素材の画像から作成）
  tiles:{dir:'img/t3d/',ts:2048,ow:12288,oh:11440,near:1150,list:["0_4", "0_5", "1_3", "1_4", "1_5", "2_3", "2_4", "3_0", "3_1", "3_2", "3_3", "3_4", "4_0", "4_1", "4_2", "5_0", "5_1"]},models:{
  ashi:{src:'img/u_ashi.txt',yaw:Math.PI/2,idle:1.0,s:1.2},
  kiba:{src:'img/u_kiba.txt',yaw:Math.PI,idle:0.35,s:1.05},
  yumi:{src:'img/u_yumi.txt',yaw:Math.PI/2,idle:1.0,s:1.15},
  teppo:{src:'img/u_teppo.txt',yaw:Math.PI/2,idle:1.0,s:1.15},
  taisho:{src:'img/u_taisho.txt',yaw:Math.PI/2,idle:1.1,s:1.1}},
  // 地図の建物。fp：横幅（地図の単位）。vary：地域ごとのばらつき（yaw向き・size大きさ・height高さ・tint色）。国の拠点の城＝late、山地の城＝yama（2種類から地域ごとに選ぶ）、ほかの城＝石高でmid/early
  props:{late:{src:'img/p_shiro_late.txt',fp:11,vary:{yaw:0.35,size:0.08,height:0.08}},mid:{src:'img/p_shiro_mid.txt',fp:9.5,vary:{yaw:0.5,size:0.1,height:0.1}},early:{src:'img/p_shiro_early.txt',fp:9,vary:{yaw:0.6,size:0.1,height:0.1}},
    yama:{src:['img/p_yamajiro2.txt','img/p_yamajiro3.txt'],fp:11,vary:{yaw:Math.PI,size:0.15,height:0.25,tint:0.07,green:true,bright:0.1}},minato:{src:'img/p_minato.txt',fp:9.5,vary:{yaw:0.6,size:0.1,height:0.05}},gin:{src:'img/p_gin.txt',fp:8.5,vary:{yaw:1.2,size:0.12,height:0.15}},
    tera:{src:'img/p_tera.txt',fp:9.5,vary:{yaw:0.5,size:0.1,height:0.08}},kyoto:{src:'img/p_kyoto.txt',fp:17},sakai:{src:'img/p_sakai.txt',fp:14}}};
const UNIT_SPRITE={r:'img/kiba_r.png',l:'img/kiba_l.png',w:30,h:32};

/* ---------- みんなで遊ぶ（通信） ----------
   Firebase（Cloud Firestore＋匿名ログイン）の接続先。別のFirebaseプロジェクトを使うときは、ここだけ書きかえる。
   ここに書く内容は公開されても問題ない（だれが何をできるかは、Firebase側のセキュリティルールで決める）。 */
const FIREBASE_CONFIG={
  apiKey:"AIzaSyBEZCIuc_yXpPpZpt_ihd-6CG-8AgoE2dU",
  authDomain:"gunyu-e50dc.firebaseapp.com",
  projectId:"gunyu-e50dc",
  storageBucket:"gunyu-e50dc.firebasestorage.app",
  messagingSenderId:"1006905839773",
  appId:"1:1006905839773:web:34ed80f5b10fe1564cc474"
};
// 部屋番号のけた数
const ROOM_DIGITS=6;
