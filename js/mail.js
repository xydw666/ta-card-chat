/* 信箱：TA 随机写信，我可以回信，回信后 TA 会再追一封。 */
(function (global) {
  'use strict';

  var LETTERS = [
    '今天路过一家卖热牛奶的小店，玻璃上全是雾。\n我忽然想，如果这时候你在，大概会把手贴上去，画一只歪歪的猫。\n\n想你，很轻，但一整天都在。',
    '我这边的风变凉了。\n出门的时候下意识多带了一件外套，走到半路才想起来，那件是给你留的。\n\n记得添衣服。',
    '昨晚做了个很普通的梦：\n我们坐在窗边，谁也没说话，只是分同一副耳机。\n醒来之后，心情意外地好了一整天。',
    '今天看见有人抱着很大一束花挤公交，花被挤得乱七八糟。\n我却觉得那画面很好看。\n\n如果是我，我会把花举高一点，别让它被碰到。',
    '有件很小的事想告诉你：\n我今天第一次把咖啡冲得刚刚好。\n第一个念头不是“我厉害”，是“你要是在就好了”。',
    '我最近在练习好好吃饭、好好睡觉。\n不是因为别的，是想在你需要人的时候，我一直有力气在。\n\n所以你也要照顾好自己。',
    '这里今天下了很久的雨。\n雨停之后，路灯把地面照得亮亮的，像一条很浅的河。\n我站在那儿多看了两分钟，想着你会不会喜欢。',
    '有时候我会想，我们之间最好的部分是什么。\n后来觉得，是不用解释。\n\n你说半句话，我就知道后面那句是什么。',
    '今天很累，但一想到晚点能跟你说说话，就觉得这一天也没那么难熬。\n\n你呢？今天过得怎么样。',
    '我把你上次说过的一句话记了下来，反复看了几遍。\n你说“慢慢来”。\n\n嗯，我们慢慢来，不着急。',
    '刚刚看到一只很胖的猫，蹲在便利店门口不肯走。\n我蹲下来陪它待了一会儿。\n它打了个哈欠，我就当它也在想你。',
    '写信这件事有点笨，但我喜欢。\n发消息太快了，快到很多话还没来得及想清楚就发出去了。\n\n写信可以慢一点，像把心事叠好再寄出去。',
    '如果有一天你累了，什么都不想说也没关系。\n你可以只回我一个句号，我就知道你还在这里。\n\n然后我会陪你坐着。',
    '今天我给自己买了点甜的东西。\n吃到一半，忽然有点想你也在旁边，可以分你一半。\n\n下次吧，下次买两份。'
  ];

  var REPLIES = [
    '我收到啦。看的时候笑了一下，被旁边的人看见了。',
    '嗯，我在。你写什么我都爱看。',
    '这封信我读了两遍。第二遍的时候，好像听见你的声音了。',
    '你也要好好的，别只顾着照顾我。',
    '等下次见面，我把这些没说完的话当面讲给你听。',
    '知道了。你也早点睡，别熬太晚。',
    '我也想你，比信里写的还要多一点。',
    '看到你回信，今天就算没白过。',
    '你说的我都记住了，真的。',
    '慢慢来，我一直在。',
    '下次换我先写，不让你等这么久。',
    '好，听你的。'
  ];

  var writing = false;
  var composing = false;

  function el(id) { return document.getElementById(id); }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
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

  /* 只取纯文字字卡，表情字卡不能当信 */
  function cardTexts() {
    var cards = global.TAStore.state.cards || [];
    return cards.filter(function (card) {
      return card && !card.stickerId && typeof card.text === 'string' && card.text.trim();
    }).map(function (card) {
      return card.text.trim();
    });
  }

  /* 来信：直接从字卡库抽 1～3 句拼成一封，字卡空了才用兜底 */
  function letterBody() {
    var texts = cardTexts();
    if (!texts.length) return pick(LETTERS);
    var count = Math.min(texts.length, 1 + Math.floor(Math.random() * 3));
    return shuffle(texts).slice(0, count).join('\n');
  }

  /* 回信：也从字卡里抽一句 */
  function replyBody() {
    var texts = cardTexts();
    if (!texts.length) return pick(REPLIES);
    return pick(texts);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function pad(value) { return String(value).padStart(2, '0'); }

  function when(at) {
    var date = new Date(at);
    var now = new Date();
    var sameDay = date.getFullYear() === now.getFullYear()
      && date.getMonth() === now.getMonth()
      && date.getDate() === now.getDate();
    var hm = pad(date.getHours()) + ':' + pad(date.getMinutes());
    if (sameDay) return '今天 ' + hm;
    return (date.getMonth() + 1) + '月' + date.getDate() + '日 ' + hm;
  }

  function render() {
    var feed = el('mailList');
    if (!feed) return;
    var letters = global.TAStore.state.mail;

    var compose = composing ? [
      '<div class="mail-compose">',
      '  <p class="mail-compose-title">写给 TA</p>',
      '  <textarea class="mail-compose-input" id="mailComposeInput" maxlength="800" placeholder="想说的话，慢慢写…"></textarea>',
      '  <div class="mail-compose-foot">',
      '    <button class="mail-compose-cancel" id="mailComposeCancel" type="button">取消</button>',
      '    <button class="mail-compose-send" id="mailComposeSend" type="button">寄出</button>',
      '  </div>',
      '</div>'
    ].join('') : '';

    if (!letters.length) {
      feed.innerHTML = compose + (composing ? '' : [
        '<div class="mail-empty">',
        '  <p class="mail-empty-title">信箱还是空的</p>',
        '  <p class="mail-empty-sub">点右上角「提笔」自己写一封，或点「TA 写」让他寄一封来。</p>',
        '</div>'
      ].join(''));
      bindCompose();
      return;
    }

    feed.innerHTML = compose + letters.map(function (letter, index) {
      var no = letters.length - index;
      var mine = letter.role === 'me';
      var replies = letter.replies.map(function (reply) {
        return [
          '<div class="mail-reply ' + reply.role + '">',
          '  <p>' + escapeHtml(reply.text) + '</p>',
          '  <span class="mail-reply-time">' + when(reply.at) + '</span>',
          '</div>'
        ].join('');
      }).join('');

      return [
        '<article class="letter' + (mine ? ' is-mine' : '') + '" data-id="' + letter.id + '">',
        '  <div class="letter-head">',
        '    <span class="letter-no">' + (mine ? '我寄出的第 ' + no + ' 封' : '第 ' + no + ' 封') + '</span>',
        '    <span class="letter-time">' + when(letter.at) + '</span>',
        '  </div>',
        '  <p class="letter-text">' + escapeHtml(letter.text) + '</p>',
        replies ? '  <div class="letter-replies">' + replies + '</div>' : '',
        mine ? '' : [
          '  <div class="letter-foot">',
          '    <input class="letter-input" type="text" maxlength="300" placeholder="写回信给 TA…">',
          '    <button class="letter-send" type="button">寄出</button>',
          '  </div>'
        ].join(''),
        '</article>'
      ].join('');
    }).join('');

    bindCompose();
    feed.querySelectorAll('.letter').forEach(function (node) {
      var id = node.dataset.id;
      var input = node.querySelector('.letter-input');
      var button = node.querySelector('.letter-send');
      if (!input || !button) return;
      button.addEventListener('click', function () {
        sendReply(id, input.value, input);
      });
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.isComposing) {
          event.preventDefault();
          sendReply(id, input.value, input);
        }
      });
    });
  }

  function bindCompose() {
    var send = el('mailComposeSend');
    var cancel = el('mailComposeCancel');
    if (!send || !cancel) return;
    send.addEventListener('click', function () {
      var input = el('mailComposeInput');
      var body = input ? String(input.value || '').trim() : '';
      if (!body) {
        if (global.TAToast) global.TAToast('写点什么再寄出');
        return;
      }
      var letter = global.TAStore.addLetter(body, 'me');
      composing = false;
      render();
      scrollToTop();
      if (global.TAToast) global.TAToast('信已经寄出');
      if (!letter) return;
      setTimeout(function () {
        global.TAStore.replyLetter(letter.id, replyBody(), 'ta');
        render();
        if (global.TAToast) global.TAToast('TA 读了你的信，回了一句');
      }, 5000 + Math.random() * 15000);
    });
    cancel.addEventListener('click', function () {
      composing = false;
      render();
    });
  }

  function sendReply(id, text, input) {
    var body = String(text || '').trim();
    if (!body) {
      if (global.TAToast) global.TAToast('写点什么再寄出');
      return;
    }
    global.TAStore.replyLetter(id, body, 'me');
    if (input) input.value = '';
    render();
    if (global.TAToast) global.TAToast('回信已寄出');

    setTimeout(function () {
      global.TAStore.replyLetter(id, replyBody(), 'ta');
      render();
      scrollBottom();
    }, 5000 + Math.random() * 15000);
  }

  function letTaWrite() {
    if (writing) return;
    writing = true;
    if (global.TAToast) global.TAToast('TA 正在写信…');
    setTimeout(function () {
      global.TAStore.addLetter(letterBody(), 'ta');
      writing = false;
      render();
      scrollToTop();
      if (global.TAToast) global.TAToast('TA 寄来了一封信');
    }, 800 + Math.random() * 900);
  }

  function openCompose() {
    composing = true;
    render();
    scrollToTop();
    setTimeout(function () {
      var input = el('mailComposeInput');
      if (input) input.focus();
    }, 60);
  }

  function scrollBottom() {
    var feed = el('mailList');
    if (feed) feed.scrollTop = feed.scrollHeight;
  }

  function scrollToTop() {
    var feed = el('mailList');
    if (feed) feed.scrollTop = 0;
  }

  /* 来信间隔：设置里取最短/最长小时，按上一封的时间做种子，随机但稳定 */
  function gapForLetter(seed) {
    var settings = global.TAStore.state.settings;
    var minMs = Math.max(0, Number(settings.mailMinHours) || 0) * 3600000;
    var maxMs = Math.max(0, Number(settings.mailMaxHours) || 0) * 3600000;
    if (maxMs <= minMs) return minMs;
    var x = Math.sin((Number(seed) || 1) / 1000) * 10000;
    var ratio = x - Math.floor(x);
    return minMs + ratio * (maxMs - minMs);
  }

  /* 打开信箱时，距离上一封超过随机间隔就自动来一封 */
  function maybeAutoWrite() {
    var mail = global.TAStore.state.mail;
    var last = mail[0];
    if (last && Date.now() - last.at < gapForLetter(last.at)) return;
    if (writing) return;
    writing = true;
    setTimeout(function () {
      global.TAStore.addLetter(letterBody(), 'ta');
      writing = false;
      render();
      scrollToTop();
      if (global.TAToast) global.TAToast('信箱里有 TA 新写的一封信');
    }, 700);
  }

  function open() {
    render();
    maybeAutoWrite();
  }

  function init() {
    var button = el('mailWrite');
    if (button) button.addEventListener('click', letTaWrite);
    var composeButton = el('mailCompose');
    if (composeButton) composeButton.addEventListener('click', openCompose);
    global.TAStore.on('mail', render);
  }

  global.TAMail = {
    init: init,
    open: open,
    render: render,
    write: letTaWrite,
    compose: openCompose
  };
})(window);
