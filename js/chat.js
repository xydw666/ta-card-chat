/* 聊天区：微信式布局（方头像 + 气泡 + 居中时间），支持表情消息。 */
(function (global) {
  'use strict';

  var logEl = null;
  var replying = false;
  var pendingQuote = null;

  function log() {
    if (!logEl || !logEl.isConnected) logEl = document.getElementById('chatLog');
    return logEl;
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function dayKey(at) {
    var date = new Date(at);
    return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
  }

  function sepLabel(at) {
    var date = new Date(at);
    var now = new Date();
    var hm = pad(date.getHours()) + ':' + pad(date.getMinutes());
    if (dayKey(at) === dayKey(now.getTime())) return hm;
    var yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
    if (dayKey(at) === dayKey(yesterday)) return '昨天 ' + hm;
    return (date.getMonth() + 1) + '月' + date.getDate() + '日 ' + hm;
  }

  function needsSeparator(prev, message) {
    if (!prev || message.role === 'sys') return false;
    if (dayKey(prev.at) !== dayKey(message.at)) return true;
    return message.at - prev.at > 5 * 60 * 1000;
  }

  function makeSeparator(at) {
    var node = document.createElement('div');
    node.className = 'time-sep';
    node.textContent = sepLabel(at);
    return node;
  }

  function makeStickerImage(sticker) {
    var image = document.createElement('img');
    image.className = 'sticker-img';
    image.alt = '表情';
    image.src = sticker ? sticker.dataUrl : '';
    return image;
  }

  function clock(at) {
    var date = new Date(Number(at) || Date.now());
    return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
  }

  function makeBubble(message) {
    if (message.role === 'sys') {
      var record = document.createElement('div');
      record.className = message.pat ? 'pat-record' : 'call-record';
      record.dataset.id = message.id;
      record.textContent = message.text;
      return { wrap: record, text: null, bubble: null };
    }

    var taName = global.TAStore.state.taName || 'TA';
    var isTa = message.role === 'ta';

    var wrap = document.createElement('div');
    wrap.className = 'msg ' + (isTa ? 'ta' : 'me');
    wrap.dataset.id = message.id;

    var avatar = document.createElement('div');
    avatar.className = 'avatar-sm ' + (isTa ? 'ta' : 'me');
    if (global.TAProfile) {
      global.TAProfile.fill(avatar, isTa ? 'ta' : 'me');
    } else {
      avatar.textContent = isTa ? (taName.slice(0, 1) || 'T') : '我';
    }

    var bubble = document.createElement('div');
    bubble.className = 'bubble';

    var text = null;
    if (message.stickerId) {
      var sticker = global.TAStore.getSticker(message.stickerId);
      bubble.classList.add('is-sticker');
      bubble.appendChild(makeStickerImage(sticker));
    } else {
      if (message.quote && message.quote.text) {
        var quote = document.createElement('div');
        quote.className = 'bubble-quote';
        quote.textContent = message.quote.text;
        bubble.appendChild(quote);
      }
      text = document.createElement('span');
      text.className = 'text';
      text.textContent = message.text;
      bubble.appendChild(text);
    }

    var col = document.createElement('div');
    col.className = 'bubble-col';
    col.appendChild(bubble);

    var meta = document.createElement('div');
    meta.className = 'msg-meta';
    var time = document.createElement('time');
    time.className = 'msg-time';
    time.textContent = clock(message.at);
    meta.appendChild(time);
    if (!isTa) {
      var read = document.createElement('span');
      read.className = 'read-flag';
      read.textContent = message.readAt ? '已读' : '';
      meta.appendChild(read);
    }
    col.appendChild(meta);

    if (isTa) {
      wrap.appendChild(avatar);
      wrap.appendChild(col);
    } else {
      wrap.appendChild(col);
      wrap.appendChild(avatar);
    }
    return { wrap: wrap, text: text, bubble: bubble };
  }

  function makeTypingIndicator() {
    var wrap = document.createElement('div');
    wrap.className = 'msg ta is-typing-indicator';
    var avatar = document.createElement('div');
    avatar.className = 'avatar-sm ta';
    if (global.TAProfile) global.TAProfile.fill(avatar, 'ta');
    else avatar.textContent = (global.TAStore.state.taName || 'TA').slice(0, 1) || 'T';
    wrap.appendChild(avatar);
    wrap.insertAdjacentHTML('beforeend', '<div class="bubble"><span class="dots"><i></i><i></i><i></i></span></div>');
    return wrap;
  }

  function scrollToBottom(force) {
    var el = log();
    if (!el) return;
    var nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 240;
    if (force || nearBottom) el.scrollTop = el.scrollHeight;
  }

  function refreshList() {
    if (global.TAShell && global.TAShell.refreshList) global.TAShell.refreshList();
  }

  function renderEmpty() {
    var el = log();
    if (!el) return;
    var empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = [
      '<p class="empty-title">今天想说点什么？</p>',
      '<p class="empty-sub">我在这里听你说。</p>',
      '<button type="button" class="empty-btn">查看 TA 的字卡</button>'
    ].join('');
    empty.querySelector('.empty-btn').addEventListener('click', function () {
      if (global.TAPanel) global.TAPanel.openCards();
    });
    el.appendChild(empty);
  }

  function renderAll() {
    var el = log();
    if (!el) return;
    el.innerHTML = '';
    var messages = global.TAStore.state.messages;
    if (!messages.length) {
      renderEmpty();
      return;
    }
    var prev = null;
    messages.forEach(function (message) {
      if (needsSeparator(prev, message)) el.appendChild(makeSeparator(message.at));
      el.appendChild(makeBubble(message).wrap);
      prev = message;
    });
    scrollToBottom(true);
  }

  function appendMessage(message, previous) {
    var el = log();
    if (!el) return null;
    var empty = el.querySelector('.empty');
    if (empty) empty.remove();

    if (needsSeparator(previous, message)) el.appendChild(makeSeparator(message.at));
    var node = makeBubble(message);
    el.appendChild(node.wrap);
    scrollToBottom(true);
    return node;
  }

  function setStatus(text) {
    var el = document.getElementById('chatStatus');
    if (!el) return;
    if (text) {
      el.textContent = text;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  function rollChance(value) {
    var chance = Number(value);
    if (!Number.isFinite(chance) || chance <= 0) return false;
    return Math.random() * 100 < chance;
  }

  function sampleReplyDelay() {
    var settings = global.TAStore.state.settings;
    var min = Math.max(0, Number(settings.replyDelayMin) || 0);
    var max = Math.max(0, Number(settings.replyDelayMax) || 0);
    if (max < min) {
      var swap = min;
      min = max;
      max = swap;
    }
    return min + Math.random() * (max - min);
  }

  function quoteOf(message) {
    if (!message || message.role === 'sys') return null;
    var text = message.stickerId ? '[表情]' : String(message.text || '').trim();
    if (!text) return null;
    return { role: message.role === 'ta' ? 'ta' : 'me', text: text.slice(0, 120) };
  }

  /* 我长按消息 → 输入框上方出现引用条，发出去就带上引用 */
  function clearQuote() {
    pendingQuote = null;
    var bar = document.getElementById('quoteBar');
    if (bar) bar.hidden = true;
  }

  function startQuote(message) {
    var quote = quoteOf(message);
    if (!quote) return;
    pendingQuote = quote;
    var bar = document.getElementById('quoteBar');
    var text = document.getElementById('quoteBarText');
    if (!bar || !text) return;
    var author = quote.role === 'ta' ? (global.TAStore.state.taName || 'TA') : '我';
    text.textContent = '回复 ' + author + '：' + quote.text;
    bar.hidden = false;
    var input = document.getElementById('input');
    if (input) input.focus();
  }

  function bindQuote() {
    var close = document.getElementById('quoteBarClose');
    if (close) close.addEventListener('click', clearQuote);
    var el = log();
    if (!el) return;

    function messageFromNode(node) {
      var wrap = node && node.closest ? node.closest('.msg') : null;
      if (!wrap) return null;
      var id = wrap.dataset.id;
      var list = global.TAStore.state.messages;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i];
      }
      return null;
    }

    /* 双击 TA 头像 = 我拍了拍 TA */
    el.addEventListener('dblclick', function (event) {
      if (!event.target.closest) return;
      if (event.target.closest('.msg.ta .avatar-sm')) pat(false);
    });

    el.addEventListener('contextmenu', function (event) {
      var message = messageFromNode(event.target);
      if (!message) return;
      event.preventDefault();
      startQuote(message);
    });

    var pressTimer = 0;
    el.addEventListener('touchstart', function (event) {
      var message = messageFromNode(event.target);
      clearTimeout(pressTimer);
      if (!message) return;
      pressTimer = setTimeout(function () { startQuote(message); }, 480);
    }, { passive: true });
    ['touchend', 'touchcancel', 'touchmove'].forEach(function (name) {
      el.addEventListener(name, function () { clearTimeout(pressTimer); }, { passive: true });
    });
  }

  /* 拍一拍：居中灰字，不走气泡 */
  function pat(fromTa) {
    var taName = global.TAStore.state.taName || 'TA';
    var pool = global.TAStore.state.patTexts || [];
    var template = pool.length ? pool[Math.floor(Math.random() * pool.length)] : '拍了拍{我}';
    var actor = fromTa ? taName : '我';
    var target = fromTa ? '我' : taName;
    var list = global.TAStore.state.messages;
    var previous = list.length ? list[list.length - 1] : null;
    var message = {
      id: global.TAStore._uid('msg'),
      role: 'sys',
      text: actor + ' ' + template.split('{我}').join(target),
      stickerId: '',
      at: Date.now(),
      pat: true
    };
    global.TAStore.addMessage(message);
    appendMessage(message, previous);
    refreshList();
  }

  function markRead(message) {
    if (!message || message.readAt) return;
    global.TAStore.markRead(message.id);
    var el = log();
    if (!el) return;
    var flag = el.querySelector('.msg[data-id="' + message.id + '"] .read-flag');
    if (flag) flag.textContent = '已读';
  }

  function replyWithCard(previous, delay, trigger) {
    var settings = global.TAStore.state.settings;

    if (trigger) {
      /* TA 过一小会儿才看到消息，先补一个已读回执 */
      setTimeout(function () { markRead(trigger); }, 500 + Math.random() * 1200);
      /* 拍一拍是独立的，已读不回时也可能拍你一下 */
      if (rollChance(settings.patChance)) {
        setTimeout(function () { pat(true); }, 800 + Math.random() * 1500);
      }
      /* 命中已读不回：只留回执，这次不再回复 */
      if (rollChance(settings.readNoReplyChance)) return;
    }

    replying = true;
    var existing = log().querySelector('.is-typing-indicator');
    if (existing) existing.remove();
    var indicator = makeTypingIndicator();
    log().appendChild(indicator);
    setStatus('对方正在输入…');
    scrollToBottom(true);

    setTimeout(function () {
      if (indicator.isConnected) indicator.remove();
      setStatus('');

      var card = global.TAStore.drawCard();
      if (!card) {
        replying = false;
        return;
      }

      var taMessage = {
        id: global.TAStore._uid('msg'),
        role: 'ta',
        text: card.text || '',
        stickerId: card.stickerId || '',
        at: Date.now(),
        cardId: card.id,
        quote: trigger && rollChance(settings.quoteChance) ? quoteOf(trigger) : null
      };
      global.TAStore.addMessage(taMessage);

      appendMessage(taMessage, previous);
      refreshList();
      if (global.TAProfile) global.TAProfile.maybeTaChange();

      replying = false;
    }, delay);
  }

  function pushTa(text) {
    var content = String(text || '').trim();
    if (!content) return null;
    var messages = global.TAStore.state.messages;
    var previous = messages.length ? messages[messages.length - 1] : null;
    var message = {
      id: global.TAStore._uid('msg'),
      role: 'ta',
      text: content,
      stickerId: '',
      at: Date.now()
    };
    global.TAStore.addMessage(message);
    appendMessage(message, previous);
    refreshList();
    if (global.TAProfile) global.TAProfile.maybeTaChange();
    return message;
  }

  function ask(question, answer, thinkMs, stickerId) {
    var content = String(question || '').trim();
    if (!content) return false;

    var messages = global.TAStore.state.messages;
    var previous = messages.length ? messages[messages.length - 1] : null;
    var mine = {
      id: global.TAStore._uid('msg'),
      role: 'me',
      text: content,
      stickerId: '',
      at: Date.now()
    };
    global.TAStore.addMessage(mine);
    appendMessage(mine, previous);
    refreshList();

    if (!answer && !stickerId) return true;

    setStatus('对方正在想…');
    setTimeout(function () {
      setStatus('');
      var list = global.TAStore.state.messages;
      var prev = list.length ? list[list.length - 1] : null;
      var reply = {
        id: global.TAStore._uid('msg'),
        role: 'ta',
        text: answer || '',
        stickerId: stickerId || '',
        at: Date.now()
      };
      global.TAStore.addMessage(reply);
      appendMessage(reply, prev);
      refreshList();
      if (global.TAProfile) global.TAProfile.maybeTaChange();
    }, Math.max(0, Number(thinkMs) || 0));
    return true;
  }

  function guard() {
    if (!global.TAStore.state.cards.length) {
      if (global.TAToast) global.TAToast('先去「字卡库」里添加几张字卡吧');
      if (global.TAPanel) global.TAPanel.openCards();
      return false;
    }
    return true;
  }

  function send(text) {
    var content = String(text || '').trim();
    if (!content) return false;
    if (!guard()) return false;

    var messages = global.TAStore.state.messages;
    var previous = messages.length ? messages[messages.length - 1] : null;

    var userMessage = {
      id: global.TAStore._uid('msg'),
      role: 'me',
      text: content,
      stickerId: '',
      at: Date.now(),
      quote: pendingQuote
    };
    global.TAStore.addMessage(userMessage);
    appendMessage(userMessage, previous);
    refreshList();
    clearQuote();

    replyWithCard(userMessage, sampleReplyDelay(), userMessage);
    return true;
  }

  function sendSticker(stickerId) {
    if (!stickerId) return false;
    if (!guard()) return false;
    var sticker = global.TAStore.getSticker(stickerId);
    if (!sticker) return false;

    var messages = global.TAStore.state.messages;
    var previous = messages.length ? messages[messages.length - 1] : null;

    var message = {
      id: global.TAStore._uid('msg'),
      role: 'me',
      text: '',
      stickerId: stickerId,
      at: Date.now()
    };
    global.TAStore.addMessage(message);
    appendMessage(message, previous);
    refreshList();

    var delay = sampleReplyDelay();
    replyWithCard(message, delay, message);
    return true;
  }

  var activeTimer = 0;

  function activeSend() {
    if (!global.TAStore.state.cards.length) {
      if (global.TAToast) global.TAToast('先去「字卡库」里添加几张字卡吧');
      return false;
    }
    if (replying) return false;
    var messages = global.TAStore.state.messages;
    var previous = messages.length ? messages[messages.length - 1] : null;
    replyWithCard(previous, 900);
    return true;
  }

  function scheduleActive() {
    clearTimeout(activeTimer);
    var settings = global.TAStore.state.settings;
    if (!settings.activeOn) return;
    var minMinutes = Math.max(1, Number(settings.activeMinutes) || 30);
    var maxMinutes = Math.max(minMinutes, Number(settings.activeMaxMinutes) || minMinutes);
    var minutes = minMinutes + Math.random() * (maxMinutes - minMinutes);
    var wait = Math.min(minutes * 60000, 2147000000);
    activeTimer = setTimeout(function () {
      if (global.TAStore.state.settings.activeOn && !replying) activeSend();
      scheduleActive();
    }, wait);
  }

  function init() {
    logEl = document.getElementById('chatLog');
    if (!logEl) return;
    renderAll();
    bindQuote();
    scheduleActive();
    global.TAStore.on('settings', scheduleActive);
    global.TAStore.on('messages:clear', function () {
      renderAll();
      refreshList();
    });
    global.TAStore.on('reset', function () {
      renderAll();
      refreshList();
    });
    global.TAStore.on('taName', renderAll);
    global.TAStore.on('profile', renderAll);
    global.TAStore.on('stickers', function () {
      // 表情被删掉时，聊天里的旧图片不至于留空白
      renderAll();
    });
  }

  global.TAChat = {
    init: init,
    send: send,
    sendSticker: sendSticker,
    active: activeSend,
    pushTa: pushTa,
    ask: ask,
    setStatus: setStatus,
    renderAll: renderAll,
    isReplying: function () { return replying; }
  };
})(window);
