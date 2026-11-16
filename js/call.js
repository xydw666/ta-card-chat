/* 通话：仿微信语音通话的全屏界面，不接真实线路 */
(function (global) {
  'use strict';

  var ICONS = {
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/></svg>',
    speaker: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4Z"/><path d="M16 9.5a3.6 3.6 0 0 1 0 5"/><path d="M18.6 7a7.4 7.4 0 0 1 0 10"/></svg>',
    hangup: '<svg viewBox="0 0 24 24"><path d="M4.6 14.2c4-2.4 10.8-2.4 14.8 0l-2.1 2.6c-.5.6-1.4.8-2.1.4l-1.8-1a2 2 0 0 1-1-1.4l-.2-1.2a9.4 9.4 0 0 0-3.4 0l-.2 1.2a2 2 0 0 1-1 1.4l-1.8 1c-.7.4-1.6.2-2.1-.4Z"/></svg>'
  };

  var root = null;
  var avatarEl = null;
  var bgEl = null;
  var nameEl = null;
  var statusEl = null;
  var timerEl = null;
  var muteBtn = null;
  var speakerBtn = null;

  var active = false;
  var connectedAt = 0;
  var muted = false;

  var connectTimer = 0;
  var tickTimer = 0;
  var hangTimer = 0;

  function state() {
    return global.TAStore.state;
  }

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function fmt(ms) {
    var total = Math.floor(Math.max(0, ms) / 1000);
    return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
  }

  function fillAvatar() {
    var url = state().taAvatar;
    avatarEl.textContent = '';
    if (url) {
      var img = document.createElement('img');
      img.src = url;
      img.alt = '';
      avatarEl.appendChild(img);
      bgEl.style.backgroundImage = 'url("' + url + '")';
    } else {
      avatarEl.textContent = (state().taName || 'TA').slice(0, 1) || 'T';
      bgEl.style.backgroundImage = '';
    }
  }

  /* 通话中每隔半分钟掷一次骰子，约 3% 概率对方主动挂断 */
  function scheduleHangup() {
    clearTimeout(hangTimer);
    hangTimer = setTimeout(function () {
      if (!active || !connectedAt) return;
      if (Math.random() < 0.03) {
        taHangup();
        return;
      }
      scheduleHangup();
    }, 30000);
  }

  function taHangup() {
    if (!active) return;
    clearTimeout(hangTimer);
    clearInterval(tickTimer);
    statusEl.textContent = '对方已挂断';
    setTimeout(function () {
      if (active) end('对方已挂断');
    }, 1400);
  }

  function tick() {
    if (!connectedAt) return;
    timerEl.textContent = fmt(Date.now() - connectedAt);
  }

  function build() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'call-screen';
    root.hidden = true;
    root.innerHTML = [
      '<div class="call-bg"></div>',
      '<div class="call-main">',
      '  <div class="call-avatar"></div>',
      '  <div class="call-name"></div>',
      '  <div class="call-status">正在呼叫…</div>',
      '  <div class="call-timer"></div>',
      '</div>',
      '<div class="call-actions">',
      '  <button type="button" class="call-btn" data-call="mute">',
      '    <span class="call-icon">' + ICONS.mic + '</span><span class="call-label">静音</span>',
      '  </button>',
      '  <button type="button" class="call-btn" data-call="speaker">',
      '    <span class="call-icon">' + ICONS.speaker + '</span><span class="call-label">免提</span>',
      '  </button>',
      '  <button type="button" class="call-btn hang" data-call="hangup">',
      '    <span class="call-icon">' + ICONS.hangup + '</span><span class="call-label">挂断</span>',
      '  </button>',
      '</div>'
    ].join('');
    document.body.appendChild(root);

    avatarEl = root.querySelector('.call-avatar');
    bgEl = root.querySelector('.call-bg');
    nameEl = root.querySelector('.call-name');
    statusEl = root.querySelector('.call-status');
    timerEl = root.querySelector('.call-timer');
    muteBtn = root.querySelector('[data-call="mute"]');
    speakerBtn = root.querySelector('[data-call="speaker"]');

    root.addEventListener('click', function (event) {
      var button = event.target.closest('[data-call]');
      if (!button) return;
      var action = button.dataset.call;
      if (action === 'hangup') {
        end();
        return;
      }
      if (action === 'mute') {
        muted = !muted;
        muteBtn.classList.toggle('is-on', muted);
        muteBtn.querySelector('.call-label').textContent = muted ? '已静音' : '静音';
        return;
      }
      if (action === 'speaker') {
        var on = speakerBtn.classList.toggle('is-on');
        speakerBtn.querySelector('.call-label').textContent = on ? '免提中' : '免提';
      }
    });
  }

  function open() {
    build();
    if (!state().cards.length) {
      if (global.TAToast) global.TAToast('先去字卡库添加几张字卡');
      return;
    }

    active = true;
    connectedAt = 0;
    muted = false;
    clearTimeout(connectTimer);
    clearInterval(tickTimer);
    clearTimeout(hangTimer);

    fillAvatar();
    nameEl.textContent = state().taName || 'TA';
    statusEl.textContent = '正在呼叫…';
    timerEl.textContent = '';
    muteBtn.classList.remove('is-on');
    muteBtn.querySelector('.call-label').textContent = '静音';
    speakerBtn.classList.remove('is-on');
    speakerBtn.querySelector('.call-label').textContent = '免提';
    root.hidden = false;

    connectTimer = setTimeout(function () {
      if (!active) return;
      connectedAt = Date.now();
      statusEl.textContent = '通话中';
      tick();
      tickTimer = setInterval(tick, 1000);
      scheduleHangup();
    }, 2200 + Math.random() * 2200);
  }

  function end(reason) {
    if (!active) return;
    active = false;
    clearTimeout(connectTimer);
    clearInterval(tickTimer);
    clearTimeout(hangTimer);
    root.hidden = true;

    var duration = connectedAt ? Date.now() - connectedAt : 0;
    var text;
    if (reason) text = reason + ' · 通话时长 ' + fmt(duration);
    else text = duration ? '通话时长 ' + fmt(duration) : '已取消';

    var message = {
      id: global.TAStore._uid('msg'),
      role: 'sys',
      text: text,
      stickerId: '',
      at: Date.now()
    };
    global.TAStore.addMessage(message);
    if (global.TAChat) global.TAChat.renderAll();
    if (duration && global.TAProfile) global.TAProfile.maybeTaChange();
  }

  global.TACall = {
    open: open,
    end: end,
    isActive: function () { return active; }
  };
})(window);
