/* 拼音随机拼句
   - 开启后出现悬浮小窗：可拖拽、可最小化、可关闭
   - TA 自己随机造句，用拼音逐字母敲、候选字随机选，拼完再整句发出
   - 字卡回复不再走打字动画，只有这里拼出来的句子才有
*/
(function (global) {
  'use strict';
  if (global.TAPinyin) return;

  var AUTO_KEY = 'ta_pinyin_auto_v1';
  var CJK = /^[\u3400-\u9fff]$/;

  // 常用字池：随机抽字组句，不套模板，几乎不会重复
  var POOL = (
    '我我你你我他她它的了在是有个这那就都和要会想说看听觉得喜欢讨厌' +
    '今天明天昨天早上中午晚上刚刚现在时候点分秒年月日风雨雪云太阳月亮星星' +
    '家路车门口学校公司工作吃饭睡觉起床穿衣洗头手机屏幕消息打字聊天语音' +
    '照片音乐电影游戏书字词语句子意思问题答案知道忘记记得想念爱谢谢对不起' +
    '没关系再见晚安早安呵呵哈哈嘿嘿嗯哦啊呀吧呢吗嘛啦喂唉额呃' +
    '去来回到上下进出坐站躺跑走拿放给送买找等做吃喝玩笑哭怕累饿渴冷热' +
    '好坏大小多少高低长短快慢新旧美丑干净安静吵闹忙闲真假难易对错'
  );
  var PUNCT = ['，', '，', '，', '。', '？', '！', '…'];
  var FALLBACK = '我你他她的是不在了有就想说看';

  // 通顺度调高时用这些素材拼，读起来像人话
  var PIECES = {
    time: ['今天', '刚刚', '昨晚', '早上', '下午', '睡前', '刚才', '这两天', '周末', '中午', '傍晚', '半夜', '今天下午', '上周', '前几天'],
    place: ['路上', '地铁上', '公司', '学校', '家里', '楼下', '窗边', '超市里', '公交上', '咖啡馆', '食堂', '操场边', '被窝里', '阳台上'],
    thing: ['看到一只很胖的猫', '听到一首老歌', '买了一束花', '被风吹得有点冷', '吃到一家新店', '看到很好看的晚霞', '手机快没电了', '排了好久的队', '差点睡过头', '碰到一场小雨', '发现楼下开了家小店', '走了很远的路', '喝了杯热的东西', '看到一对很甜的情侣', '把房间收拾了一遍', '想起很久以前的事', '听到有人说方言', '看到小孩子在追泡泡', '晒了一下午的太阳', '把歌单循环了一遍'],
    feel: ['有点想你', '心情一下变好了', '忽然很想跟你说说话', '觉得今天还不错', '有点累但还好', '一下子安静下来', '就想到你了', '有点开心', '有点空落落的', '还挺满足的', '忽然有点困', '莫名有点想笑', '好像没那么烦了', '心里暖了一下', '有点舍不得睡', '想听听你的声音'],
    tail: ['你在做什么呀', '你吃饭了没有', '早点睡', '记得喝水', '晚点再聊', '我一会儿再来找你', '别熬夜', '你今天还好吗', '有空回我就行', '想你了', '外面冷不冷', '记得加件外套']
  };
  var SHORTS = ['在吗。', '想你了。', '刚睡醒。', '今天有点累。', '你在忙吗？', '晚点聊。', '别忘了吃饭。', '我出门了。', '晚安。', '记得早点睡。', '刚到家。', '今天好冷。', '有点无聊。', '在等你回我。', '我先去忙啦。', '路上小心。', '别太累。', '今天心情不错。', '外面下雨了。', '你睡了吗？', '突然想起你。', '喝了口水继续忙。', '今天吃了什么？', '抱一下。'];

  var poolCache = null;

  var active = false;
  var running = false;
  var timer = 0;
  var lastSentence = '';
  var autoOn = true;
  var bound = false;

  try { autoOn = localStorage.getItem(AUTO_KEY) !== '0'; } catch (_) {}

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, Math.max(0, ms)); });
  }

  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function canType(ch, map) {
    return !map || !!map[ch];
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // 字库直接用本地字典里的全部常用字（约三千）
  function poolFor(map) {
    if (poolCache && poolCache.map === map) return poolCache.list;
    var list = [];
    if (map) {
      for (var ch in map) {
        if (CJK.test(ch)) list.push(ch);
      }
    }
    if (list.length < 300) list = Array.from(POOL);
    poolCache = { map: map, list: list };
    return list;
  }

  // 随机抽字组句
  function randomSentence(map) {
    var pool = poolFor(map);
    var sentence = '';
    for (var attempt = 0; attempt < 6; attempt += 1) {
      var length = 5 + Math.floor(Math.random() * 9);
      var parts = [];
      var run = 0;
      var prev = '';

      for (var i = 0; i < length; i += 1) {
        var ch = '';
        var guard = 0;
        while (guard < 8) {
          ch = pool[Math.floor(Math.random() * pool.length)];
          if (ch !== prev && canType(ch, map)) break;
          guard += 1;
        }
        if (!ch || ch === prev || !canType(ch, map)) {
          ch = FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
        }
        parts.push(ch);
        prev = ch;
        run += 1;

        if (run >= 3 && Math.random() < 0.16) {
          parts.push(PUNCT[Math.floor(Math.random() * PUNCT.length)]);
          run = 0;
        }
      }

      sentence = parts.join('') + (Math.random() < 0.3 ? '？' : '。');
      if (sentence !== lastSentence) break;
    }
    return sentence;
  }

  // 通顺模式：用素材拼成能读懂的短句
  function smoothSentence() {
    var time = pick(PIECES.time);
    var place = pick(PIECES.place);
    var thing = pick(PIECES.thing);
    var feel = pick(PIECES.feel);
    var tail = pick(PIECES.tail);
    switch (Math.floor(Math.random() * 8)) {
      case 0:
        return time + place + thing + '，' + feel + '。';
      case 1:
        return thing + '，' + feel + '。' + tail;
      case 2:
        return time + feel + '，' + tail;
      case 3:
        return time + place + thing + '。';
      case 4:
        return feel + '。' + tail;
      case 5:
        return time + thing + '，' + tail;
      case 6:
        return thing + '，' + tail + '。';
      default:
        return pick(SHORTS);
    }
  }

  function generate(map) {
    var smooth = 0;
    try {
      smooth = Number(global.TAStore.state.settings.smooth) || 0;
    } catch (_) {}
    var sentence = '';
    for (var attempt = 0; attempt < 6; attempt += 1) {
      sentence = (smooth > 0 && Math.random() * 100 < smooth)
        ? smoothSentence()
        : randomSentence(map);
      if (sentence !== lastSentence) break;
    }
    lastSentence = sentence;
    return sentence;
  }

  function els() {
    return {
      bar: document.getElementById('typer'),
      letters: document.getElementById('typerLetters'),
      cands: document.getElementById('typerCands'),
      hint: document.getElementById('typerHint')
    };
  }

  function setHint(text) {
    var node = els().hint;
    if (node) node.textContent = text;
  }

  function setStatus(text) {
    if (global.TAChat && global.TAChat.setStatus) global.TAChat.setStatus(text);
  }

  function clearStrip() {
    var ui = els();
    if (ui.letters) ui.letters.textContent = '';
    if (ui.cands) ui.cands.innerHTML = '';
  }

  async function runSentence() {
    if (!active || running) return;
    running = true;
    clearStrip();
    setStatus('对方正在敲拼音…');
    try {
      var settings = global.TAStore.state.settings;
      var letterMs = Math.max(20, Number(settings.letterSpeed) || 70);
      var candMs = Math.max(80, Number(settings.candidateSpeed) || 300);

      if (global.TATyping) {
        global.TATyping.showPanel();
        await global.TATyping.ensureDicts();
      }
      if (!active) return;

      var dict = global.SHEX_PINYIN_DICT || {};
      var map = global.SHEX_CHAR_PINYIN || {};
      var sentence = generate(map);
      var chars = Array.from(sentence);
      var output = '';
      var ui = els();

      for (var index = 0; index < chars.length; index += 1) {
        if (!active) return;
        var ch = chars[index];

        if (CJK.test(ch) && map[ch] && dict[map[ch]]) {
          var pinyin = map[ch];
          setHint('TA 正在敲拼音…');
          var typed = '';
          for (var p = 0; p < pinyin.length; p += 1) {
            if (!active) return;
            typed += pinyin[p];
            if (ui.letters) ui.letters.textContent = typed;
            await sleep(letterMs * (0.75 + Math.random() * 0.5));
          }
          if (!active) return;

          var list = (dict[pinyin] || []).slice(0, 6);
          if (list.indexOf(ch) === -1) {
            if (list.length >= 7) list.pop();
            list.push(ch);
          }
          list = shuffle(list);
          if (ui.cands) {
            ui.cands.innerHTML = list.map(function (item) {
              return '<span class="cand' + (item === ch ? ' is-target' : '') + '">' + item + '</span>';
            }).join('');
          }
          setHint('正在候选字里选…');
          setStatus('对方正在选字…');
          await sleep(candMs * (0.8 + Math.random() * 0.5));
          if (!active) return;

          var target = ui.cands ? ui.cands.querySelector('.cand.is-target') : null;
          if (target) target.classList.add('is-picked');
          await sleep(130);
          if (ui.letters) ui.letters.textContent = '';
          if (ui.cands) ui.cands.innerHTML = '';
        } else {
          await sleep(Math.min(letterMs, 60));
        }

        output += ch;
        setHint(output);
      }

      if (!active) return;
      setHint('这就发出去…');
      setStatus('对方正在输入…');
      await sleep(360);
      if (!active) return;

      if (global.TAChat) global.TAChat.pushTa(output);
      clearStrip();
      setHint('已发送，等 TA 再拼一句…');
      await sleep(400);
    } finally {
      running = false;
      clearStrip();
      setStatus('');
    }
  }

  function schedule() {
    clearTimeout(timer);
    if (!active || !autoOn) return;
    var seconds = Math.max(3, Number(global.TAStore.state.settings.pinyinAutoSeconds) || 20);
    var wait = Math.min(seconds * 1000 * (0.7 + Math.random() * 0.6), 2147000000);
    timer = setTimeout(function () {
      if (active && autoOn) runSentence();
      schedule();
    }, wait);
  }

  function enable() {
    active = true;
    if (global.TATyping) global.TATyping.showPanel();
    setHint('等 TA 自己拼下一句…');
    schedule();
  }

  function disable() {
    active = false;
    clearTimeout(timer);
    if (global.TATyping) global.TATyping.cancel();
    clearStrip();
  }

  function paintAuto() {
    var button = document.getElementById('typerAuto');
    if (button) button.classList.toggle('is-on', autoOn);
  }

  function sync() {
    var on = global.TAStore.state.settings.typing === true;
    if (on && !active) enable();
    if (!on && active) disable();
    paintAuto();
  }

  function bind() {
    if (bound) return;
    bound = true;

    var demo = document.getElementById('typerDemo');
    if (demo) {
      demo.addEventListener('click', function () {
        if (!global.TAStore.state.settings.typing) {
          global.TAStore.updateSettings({ typing: true });
        }
        runSentence();
      });
    }

    var autoButton = document.getElementById('typerAuto');
    if (autoButton) {
      autoButton.addEventListener('click', function () {
        autoOn = !autoOn;
        try { localStorage.setItem(AUTO_KEY, autoOn ? '1' : '0'); } catch (_) {}
        paintAuto();
        if (autoOn) schedule(); else clearTimeout(timer);
        setHint(autoOn ? '等 TA 自己拼下一句…' : '已关掉自主拼句');
      });
    }

    var closeButton = document.getElementById('typerClose');
    if (closeButton) {
      closeButton.addEventListener('click', function () {
        global.TAStore.updateSettings({ typing: false });
      });
    }

    global.TAStore.on('settings', function () {
      sync();
      schedule();
    });
  }

  function init() {
    bind();
    sync();
  }

  global.TAPinyin = {
    init: init,
    run: runSentence,
    isOn: function () { return active; }
  };
})(window);
