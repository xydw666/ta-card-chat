/* 头像与昵称：双方都有头像池 / 昵称池，TA 按间隔随机换 */
(function (global) {
  'use strict';

  var HOUR = 60 * 60 * 1000;
  var timer = 0;

  function state() {
    return global.TAStore.state;
  }

  function initial(role) {
    var name = role === 'ta' ? state().taName : state().myName;
    return (name || '').slice(0, 1) || (role === 'ta' ? 'T' : '我');
  }

  /* 把头像画进任意容器：有图就放图，没有就用昵称首字 */
  function fill(node, role) {
    if (!node) return;
    var url = role === 'ta' ? state().taAvatar : state().myAvatar;
    node.classList.toggle('has-img', !!url);
    if (url) {
      var img = node.querySelector('img');
      if (!img) {
        node.textContent = '';
        img = document.createElement('img');
        img.alt = '';
        node.appendChild(img);
      }
      if (img.getAttribute('src') !== url) img.src = url;
    } else {
      node.textContent = initial(role);
    }
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function intervalMs() {
    var settings = state().settings;
    var min = Math.max(0.1, Number(settings.profileMinHours) || 1);
    var max = Math.max(min, Number(settings.profileMaxHours) || min);
    return (min + Math.random() * (max - min)) * HOUR;
  }

  function schedule(kind) {
    var next = state().profileNext;
    var due = Number(next && next[kind]) || 0;
    if (!due) {
      global.TAStore.setProfileNext(kind, Date.now() + intervalMs());
      return false;
    }
    return Date.now() >= due;
  }

  function rotateNames() {
    var s = state();
    var taChanged = '';
    var myChanged = '';

    if (s.taNames.length > 1) {
      var taNext = pick(s.taNames.filter(function (name) { return name !== s.taName; }));
      if (taNext) { global.TAStore.setTaName(taNext); taChanged = taNext; }
    }
    if (state().myNames.length > 1) {
      var myNext = pick(state().myNames.filter(function (name) { return name !== state().myName; }));
      if (myNext) { global.TAStore.setMyName(myNext); myChanged = myNext; }
    }

    global.TAStore.setProfileNext('names', Date.now() + intervalMs());

    if (global.TAToast) {
      if (taChanged) global.TAToast('TA 把聊天昵称换成了「' + taChanged + '」');
      if (myChanged) {
        setTimeout(function () {
          global.TAToast('TA 把我的聊天昵称换成了「' + myChanged + '」');
        }, 1200);
      }
    }
  }

  function rotateAvatars() {
    var s = state();
    var taPool = s.taAvatars.filter(function (url) { return url !== s.taAvatar; });
    var myPool = s.myAvatars.filter(function (url) { return url !== s.myAvatar; });
    if (!taPool.length && !myPool.length) return;

    if (taPool.length) global.TAStore.setAvatar('ta', pick(taPool));
    if (myPool.length) global.TAStore.setAvatar('me', pick(myPool));
    global.TAStore.setProfileNext('avatars', Date.now() + intervalMs());

    if (global.TAToast) global.TAToast('TA 换了头像');
  }

  function check() {
    var settings = state().settings;
    if (settings.randomNamesOn && schedule('names')) rotateNames();
    if (state().settings.randomAvatarsOn && schedule('avatars')) rotateAvatars();
  }

  /* TA 回完消息后调用一次，加上定时器兜底 */
  function maybeTaChange() {
    check();
  }

  function init() {
    check();
    clearInterval(timer);
    timer = setInterval(check, 60 * 1000);
  }

  global.TAProfile = {
    init: init,
    fill: fill,
    maybeTaChange: maybeTaChange,
    check: check
  };
})(window);
