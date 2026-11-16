/* 数据层：整站唯一数据源。
   字卡支持分组与「表情字卡」，另存自定义表情与朋友圈动态。 */
(function (global) {
  'use strict';

  var KEY = 'ta_card_chat_v1';
  var MAX_MESSAGES = 300;
  var MAX_POSTS = 60;
  var MAX_MAIL = 60;
  var DEFAULT_GROUP = '默认';

  var SEED_CARDS = [
    '我在呢，慢慢说，我听着。',
    '今天辛苦了，先喝口水。',
    '嗯，我知道。',
    '别一个人扛着，说给我听。',
    '想你了，比昨天多一点。',
    '早点睡，好吗？我陪着你。',
    '过来，抱一下。',
    '你说的我都记着。',
    '不管多晚，我都在这儿。',
    '今天有没有好好吃饭？',
    '我有点想你，虽然才刚分开。',
    '别急，我们慢慢来。',
    '你不开心的时候，可以不用笑。',
    '我在，一直在。',
    '想牵你的手走一段路。',
    '记得盖被子。',
    '你已经做得很好了。',
    '要不，跟我说说今天？',
    '有我在，别怕。',
    '晚安，做个好梦。'
  ];

  var listeners = [];

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function makeSeed() {
    return {
      version: 2,
      taName: '秦梧',
      myName: '我',
      taAvatar: '',
      myAvatar: '',
      settings: {
        replyDelayMin: 700,
        replyDelayMax: 3000,
        readNoReplyChance: 5,
        quoteChance: 30,
        avoidRepeat: true,
        typing: false,
        letterSpeed: 150,
        candidateSpeed: 600,
        activeOn: false,
        activeMinutes: 30,
        activeMaxMinutes: 60,
        pinyinAutoSeconds: 20,
        smooth: 0,
        mailMinHours: 3,
        mailMaxHours: 12,
        randomNamesOn: true,
        randomAvatarsOn: true,
        profileMinHours: 1,
        profileMaxHours: 8
      },
      taNames: ['秦梧'],
      myNames: ['我'],
      taAvatars: [],
      myAvatars: [],
      profileNext: { names: 0, avatars: 0 },
      groups: [DEFAULT_GROUP],
      cards: SEED_CARDS.map(function (text) {
        return { id: uid('card'), text: text, at: Date.now(), group: DEFAULT_GROUP, stickerId: '' };
      }),
      messages: [],
      posts: [],
      stickers: [],
      mail: [],
      lastCardId: ''
    };
  }

  function normalizeCards(list, fallback) {
    if (!Array.isArray(list)) return fallback;
    return list.filter(function (item) {
      if (!item || typeof item !== 'object') return false;
      return (typeof item.text === 'string' && item.text.trim()) || item.stickerId;
    }).map(function (item) {
      return {
        id: item.id || uid('card'),
        text: typeof item.text === 'string' ? item.text.trim() : '',
        at: Number(item.at) || Date.now(),
        group: typeof item.group === 'string' && item.group.trim() ? item.group.trim() : DEFAULT_GROUP,
        stickerId: typeof item.stickerId === 'string' ? item.stickerId : ''
      };
    });
  }

  function normalizeMessages(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (item) {
      return item && (typeof item.text === 'string' || item.stickerId);
    }).map(function (item) {
      return {
        id: item.id || uid('msg'),
        role: item.role === 'ta' ? 'ta' : (item.role === 'sys' ? 'sys' : 'me'),
        text: typeof item.text === 'string' ? String(item.text) : '',
        stickerId: typeof item.stickerId === 'string' ? item.stickerId : '',
        at: Number(item.at) || Date.now(),
        cardId: item.cardId || '',
        readAt: Number(item.readAt) || 0,
        quote: item.quote && typeof item.quote.text === 'string'
          ? { role: item.quote.role === 'ta' ? 'ta' : 'me', text: String(item.quote.text).slice(0, 200) }
          : null
      };
    }).slice(-MAX_MESSAGES);
  }

  function normalizeStickers(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (item) {
      return item && typeof item.dataUrl === 'string' && /^data:image\//.test(item.dataUrl);
    }).map(function (item) {
      return { id: item.id || uid('stk'), dataUrl: item.dataUrl, at: Number(item.at) || Date.now() };
    });
  }

  function normalizePosts(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (item) {
      return item && (typeof item.text === 'string' || item.stickerId || (Array.isArray(item.images) && item.images.length));
    }).slice(0, MAX_POSTS).map(function (item) {
      return {
        id: item.id || uid('post'),
        text: typeof item.text === 'string' ? item.text : '',
        stickerId: typeof item.stickerId === 'string' ? item.stickerId : '',
        images: (Array.isArray(item.images) ? item.images : []).filter(function (url) {
          return typeof url === 'string' && /^data:image\//.test(url);
        }).slice(0, 9),
        at: Number(item.at) || Date.now(),
        liked: item.liked === true
      };
    });
  }

  function normalizeMail(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (item) {
      return item && typeof item.text === 'string' && item.text.trim();
    }).slice(0, MAX_MAIL).map(function (item) {
      return {
        id: item.id || uid('mail'),
        text: String(item.text).slice(0, 800),
        at: Number(item.at) || Date.now(),
        read: item.read === true,
        role: item.role === 'me' ? 'me' : 'ta',
        replies: (Array.isArray(item.replies) ? item.replies : []).filter(function (reply) {
          return reply && typeof reply.text === 'string' && reply.text.trim();
        }).map(function (reply) {
          return {
            role: reply.role === 'ta' ? 'ta' : 'me',
            text: String(reply.text).slice(0, 500),
            at: Number(reply.at) || Date.now()
          };
        })
      };
    });
  }

  function clamp(value, min, max, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }

  function normalizeAvatar(value) {
    var url = typeof value === 'string' ? value : '';
    if (!/^data:image\//.test(url) || url.length > 800000) return '';
    return url;
  }

  function normalizeNames(raw, fallback) {
    var list = [];
    (Array.isArray(raw) ? raw : []).forEach(function (name) {
      var value = String(name || '').trim().slice(0, 24);
      if (value && list.indexOf(value) === -1) list.push(value);
    });
    if (fallback && list.indexOf(fallback) === -1) list.unshift(fallback);
    return list;
  }

  function normalizeAvatars(raw) {
    var list = [];
    (Array.isArray(raw) ? raw : []).forEach(function (url) {
      var value = normalizeAvatar(url);
      if (value && list.indexOf(value) === -1) list.push(value);
    });
    return list;
  }

  function hydrate(raw) {
    var base = makeSeed();
    if (!raw || typeof raw !== 'object') return base;

    var settings = Object.assign({}, base.settings, raw.settings || {});
    var cards = normalizeCards(raw.cards, base.cards);

    /* 老版本只有一个回复时间，升级成区间时以它为最短、三倍为最长 */
    var rawSettings = raw.settings || {};
    var legacyDelay = Math.max(0, Number(rawSettings.replyDelay) || 0);
    var delayMin = rawSettings.replyDelayMin != null
      ? Math.max(0, Number(rawSettings.replyDelayMin) || 0)
      : legacyDelay;
    var delayMax = rawSettings.replyDelayMax != null
      ? Math.max(0, Number(rawSettings.replyDelayMax) || 0)
      : legacyDelay * 3;

    var groups = [];
    (Array.isArray(raw.groups) ? raw.groups : []).forEach(function (name) {
      var value = String(name || '').trim();
      if (value && groups.indexOf(value) === -1) groups.push(value.slice(0, 20));
    });
    cards.forEach(function (card) {
      if (groups.indexOf(card.group) === -1) groups.push(card.group);
    });
    if (!groups.length) groups.push(DEFAULT_GROUP);
    if (groups.indexOf(DEFAULT_GROUP) === -1) groups.unshift(DEFAULT_GROUP);

    var taName = (typeof raw.taName === 'string' && raw.taName.trim()) ? raw.taName.trim().slice(0, 24) : base.taName;
    var myName = (typeof raw.myName === 'string' && raw.myName.trim()) ? raw.myName.trim().slice(0, 24) : base.myName;

    return {
      version: 2,
      taName: taName,
      myName: myName,
      taAvatar: normalizeAvatar(raw.taAvatar),
      myAvatar: normalizeAvatar(raw.myAvatar),
      settings: {
        replyDelayMin: delayMin,
        replyDelayMax: delayMax,
        readNoReplyChance: clamp(Number(settings.readNoReplyChance), 0, 100, base.settings.readNoReplyChance),
        quoteChance: clamp(Number(settings.quoteChance), 0, 100, base.settings.quoteChance),
        avoidRepeat: settings.avoidRepeat !== false,
        typing: settings.typing === true,
        letterSpeed: clamp(Number(settings.letterSpeed) === 70 ? 150 : Number(settings.letterSpeed), 20, 2000, base.settings.letterSpeed),
        candidateSpeed: clamp(Number(settings.candidateSpeed) === 300 ? 600 : Number(settings.candidateSpeed), 80, 6000, base.settings.candidateSpeed),
        activeOn: settings.activeOn === true,
        activeMinutes: clamp(Number(settings.activeMinutes), 1, 100000, base.settings.activeMinutes),
        activeMaxMinutes: clamp(Number(settings.activeMaxMinutes), 1, 100000, base.settings.activeMaxMinutes),
        pinyinAutoSeconds: clamp(Number(settings.pinyinAutoSeconds), 3, 100000, base.settings.pinyinAutoSeconds),
        smooth: clamp(Number(settings.smooth), 0, 100, base.settings.smooth),
        mailMinHours: clamp(Number(settings.mailMinHours), 0, 100000, base.settings.mailMinHours),
        mailMaxHours: clamp(Number(settings.mailMaxHours), 0, 100000, base.settings.mailMaxHours),
        randomNamesOn: settings.randomNamesOn !== false && settings.taMayChangeProfile !== false,
        randomAvatarsOn: settings.randomAvatarsOn !== false,
        profileMinHours: clamp(Number(settings.profileMinHours), 0.1, 100000, base.settings.profileMinHours),
        profileMaxHours: clamp(Number(settings.profileMaxHours), 0.1, 100000, base.settings.profileMaxHours)
      },
      taNames: normalizeNames(raw.taNames, taName),
      myNames: normalizeNames(raw.myNames, myName),
      taAvatars: normalizeAvatars(raw.taAvatars),
      myAvatars: normalizeAvatars(raw.myAvatars),
      profileNext: {
        names: Number(raw.profileNext && raw.profileNext.names) || 0,
        avatars: Number(raw.profileNext && raw.profileNext.avatars) || 0
      },
      groups: groups,
      cards: cards,
      messages: normalizeMessages(raw.messages),
      posts: normalizePosts(raw.posts),
      stickers: normalizeStickers(raw.stickers),
      mail: normalizeMail(raw.mail),
      lastCardId: typeof raw.lastCardId === 'string' ? raw.lastCardId : ''
    };
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      return hydrate(raw ? JSON.parse(raw) : null);
    } catch (error) {
      console.warn('[TAStore] 读取失败，使用初始数据', error);
      return makeSeed();
    }
  }

  var state = read();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn('[TAStore] 保存失败（可能是空间不足）', error);
      return false;
    }
  }

  function on(type, handler) {
    if (typeof handler !== 'function') return function () {};
    listeners.push({ type: type, handler: handler });
    return function off() {
      listeners = listeners.filter(function (item) { return item.handler !== handler; });
    };
  }

  function emit(type, payload) {
    listeners.slice().forEach(function (item) {
      if (item.type !== type && item.type !== '*') return;
      try {
        item.handler(payload, type);
      } catch (error) {
        console.error('[TAStore] listener error', error);
      }
    });
  }

  var api = {
    on: on,
    DEFAULT_GROUP: DEFAULT_GROUP,

    get state() {
      return state;
    },

    /* ---------- 分组 ---------- */

    addGroup: function (name) {
      var value = String(name || '').trim().slice(0, 20);
      if (!value) return null;
      if (state.groups.indexOf(value) !== -1) return value;
      state.groups.push(value);
      save();
      emit('groups', state.groups);
      return value;
    },

    removeGroup: function (name) {
      if (!name || name === DEFAULT_GROUP) return false;
      state.cards.forEach(function (card) {
        if (card.group === name) card.group = DEFAULT_GROUP;
      });
      state.groups = state.groups.filter(function (item) { return item !== name; });
      save();
      emit('groups', state.groups);
      emit('cards', { regrouped: true });
      return true;
    },

    moveCards: function (ids, group) {
      var target = String(group || DEFAULT_GROUP);
      var drop = new Set(ids || []);
      if (!drop.size) return 0;
      var moved = 0;
      state.cards.forEach(function (card) {
        if (!drop.has(card.id)) return;
        card.group = target;
        moved += 1;
      });
      if (moved) {
        save();
        emit('cards', { moved: moved });
      }
      return moved;
    },

    /* ---------- 字卡 ---------- */

    addCards: function (texts, group) {
      var target = String(group || DEFAULT_GROUP);
      var incoming = (Array.isArray(texts) ? texts : [texts]);
      var existing = new Set(state.cards.map(function (card) { return card.text; }));
      var added = 0;
      var skipped = 0;
      incoming.forEach(function (raw) {
        var text = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
        if (!text) return;
        if (text.length > 200) text = text.slice(0, 200);
        if (existing.has(text)) { skipped += 1; return; }
        existing.add(text);
        state.cards.push({ id: uid('card'), text: text, at: Date.now(), group: target, stickerId: '' });
        added += 1;
      });
      if (added) {
        save();
        emit('cards', { added: added, skipped: skipped });
      }
      return { added: added, skipped: skipped };
    },

    addStickerCard: function (stickerId, group) {
      if (!stickerId) return null;
      var card = {
        id: uid('card'),
        text: '',
        at: Date.now(),
        group: String(group || DEFAULT_GROUP),
        stickerId: stickerId
      };
      state.cards.push(card);
      save();
      emit('cards', { added: 1, skipped: 0 });
      return card;
    },

    removeCards: function (ids) {
      var drop = new Set(ids || []);
      if (!drop.size) return 0;
      var before = state.cards.length;
      state.cards = state.cards.filter(function (card) { return !drop.has(card.id); });
      var removed = before - state.cards.length;
      if (removed) {
        if (drop.has(state.lastCardId)) state.lastCardId = '';
        save();
        emit('cards', { removed: removed });
      }
      return removed;
    },

    clearCards: function () {
      state.cards = [];
      state.lastCardId = '';
      save();
      emit('cards', { cleared: true });
    },

    /* ---------- 自定义表情 ---------- */

    addSticker: function (dataUrl) {
      if (typeof dataUrl !== 'string' || !/^data:image\//.test(dataUrl)) return null;
      var sticker = { id: uid('stk'), dataUrl: dataUrl, at: Date.now() };
      state.stickers.push(sticker);
      if (!save()) {
        state.stickers.pop();
        return { error: 'quota' };
      }
      emit('stickers', state.stickers);
      return sticker;
    },

    removeSticker: function (id) {
      var before = state.stickers.length;
      state.stickers = state.stickers.filter(function (item) { return item.id !== id; });
      if (state.stickers.length === before) return false;
      // 用到这个表情的字卡一起清掉，避免出现空白气泡
      state.cards = state.cards.filter(function (card) { return card.stickerId !== id; });
      save();
      emit('stickers', state.stickers);
      emit('cards', { removed: 1 });
      return true;
    },

    getSticker: function (id) {
      for (var i = 0; i < state.stickers.length; i += 1) {
        if (state.stickers[i].id === id) return state.stickers[i];
      }
      return null;
    },

    /* ---------- 消息 ---------- */

    addMessage: function (message) {
      state.messages.push(message);
      if (state.messages.length > MAX_MESSAGES) {
        state.messages = state.messages.slice(-MAX_MESSAGES);
      }
      save();
      return message;
    },

    markRead: function (id) {
      for (var i = state.messages.length - 1; i >= 0; i--) {
        if (state.messages[i].id === id) {
          state.messages[i].readAt = Date.now();
          save();
          return;
        }
      }
    },

    clearMessages: function () {
      state.messages = [];
      save();
      emit('messages:clear');
    },

    /* ---------- 抽卡 ---------- */

    drawCard: function () {
      var cards = state.cards;
      if (!cards.length) return null;
      var pool = cards;
      if (state.settings.avoidRepeat && cards.length > 1 && state.lastCardId) {
        pool = cards.filter(function (card) { return card.id !== state.lastCardId; });
        if (!pool.length) pool = cards;
      }
      var card = pool[Math.floor(Math.random() * pool.length)];
      state.lastCardId = card.id;
      save();
      return card;
    },

    /* ---------- 朋友圈 ---------- */

    addPost: function (payload) {
      var data = payload || {};
      var text = String(data.text || '').trim().slice(0, 300);
      var images = (Array.isArray(data.images) ? data.images : []).filter(function (url) {
        return typeof url === 'string' && /^data:image\//.test(url);
      }).slice(0, 9);
      if (!text && !data.stickerId && !images.length) return null;
      var post = {
        id: uid('post'),
        text: text,
        stickerId: data.stickerId || '',
        images: images,
        at: Date.now(),
        liked: false
      };
      state.posts.unshift(post);
      if (state.posts.length > MAX_POSTS) state.posts.length = MAX_POSTS;
      if (!save()) {
        state.posts.shift();
        return { error: 'quota' };
      }
      emit('posts', state.posts);
      return post;
    },

    toggleLike: function (id) {
      state.posts.forEach(function (post) {
        if (post.id === id) post.liked = !post.liked;
      });
      save();
      emit('posts', state.posts);
    },

    removePost: function (id) {
      state.posts = state.posts.filter(function (post) { return post.id !== id; });
      save();
      emit('posts', state.posts);
    },

    /* ---------- 信箱 ---------- */

    addLetter: function (text, role) {
      var body = String(text || '').trim().slice(0, 800);
      if (!body) return null;
      var letter = { id: uid('mail'), text: body, at: Date.now(), read: false, role: role === 'me' ? 'me' : 'ta', replies: [] };
      state.mail.unshift(letter);
      if (state.mail.length > MAX_MAIL) state.mail.length = MAX_MAIL;
      save();
      emit('mail', state.mail);
      return letter;
    },

    replyLetter: function (id, text, role) {
      var body = String(text || '').trim().slice(0, 500);
      if (!body) return null;
      var letter = null;
      state.mail.forEach(function (item) { if (item.id === id) letter = item; });
      if (!letter) return null;
      var reply = { role: role === 'ta' ? 'ta' : 'me', text: body, at: Date.now() };
      letter.replies.push(reply);
      letter.read = true;
      save();
      emit('mail', state.mail);
      return reply;
    },

    clearMail: function () {
      state.mail = [];
      save();
      emit('mail', state.mail);
    },

    /* ---------- 设置 ---------- */

    updateSettings: function (patch) {
      state.settings = Object.assign({}, state.settings, patch || {});
      save();
      emit('settings', state.settings);
    },

    setTaName: function (name) {
      var next = String(name || '').trim().slice(0, 24);
      if (!next) return;
      state.taName = next;
      save();
      emit('taName', next);
      emit('profile', state);
    },

    setMyName: function (name) {
      var next = String(name || '').trim().slice(0, 24);
      if (!next) return;
      state.myName = next;
      save();
      emit('profile', state);
    },

    setAvatar: function (role, dataUrl) {
      var key = role === 'ta' ? 'taAvatar' : 'myAvatar';
      state[key] = normalizeAvatar(dataUrl);
      save();
      emit('profile', state);
    },

    /* ---------- 昵称池 / 头像池 ---------- */

    addNames: function (role, names) {
      var key = role === 'ta' ? 'taNames' : 'myNames';
      var pool = state[key];
      var added = 0;
      var skipped = 0;
      (names || []).forEach(function (raw) {
        var value = String(raw || '').trim().slice(0, 24);
        if (!value) return;
        if (pool.indexOf(value) !== -1) { skipped += 1; return; }
        pool.push(value);
        added += 1;
      });
      if (added) { save(); emit('profile', state); }
      return { added: added, skipped: skipped };
    },

    removeName: function (role, name) {
      var key = role === 'ta' ? 'taNames' : 'myNames';
      state[key] = state[key].filter(function (item) { return item !== name; });
      save();
      emit('profile', state);
    },

    clearNames: function (role) {
      var key = role === 'ta' ? 'taNames' : 'myNames';
      state[key] = [];
      save();
      emit('profile', state);
    },

    addAvatars: function (role, urls) {
      var key = role === 'ta' ? 'taAvatars' : 'myAvatars';
      var pool = state[key];
      var before = pool.slice();
      var added = 0;
      (urls || []).forEach(function (raw) {
        var value = normalizeAvatar(raw);
        if (!value || pool.indexOf(value) !== -1) return;
        pool.push(value);
        added += 1;
      });
      if (!added) return { added: 0 };
      if (!save()) {
        state[key] = before;
        return { added: 0, error: 'quota' };
      }
      emit('profile', state);
      return { added: added };
    },

    removeAvatar: function (role, url) {
      var key = role === 'ta' ? 'taAvatars' : 'myAvatars';
      state[key] = state[key].filter(function (item) { return item !== url; });
      save();
      emit('profile', state);
    },

    clearAvatars: function (role) {
      var key = role === 'ta' ? 'taAvatars' : 'myAvatars';
      state[key] = [];
      save();
      emit('profile', state);
    },

    setProfileNext: function (kind, at) {
      state.profileNext[kind] = Number(at) || 0;
      save();
    },

    /* ---------- 备份 ---------- */

    exportData: function () {
      return {
        app: 'ta-card-chat',
        version: 2,
        exportedAt: new Date().toISOString(),
        taName: state.taName,
        myName: state.myName,
        taAvatar: state.taAvatar,
        myAvatar: state.myAvatar,
        settings: state.settings,
        groups: state.groups,
        cards: state.cards,
        stickers: state.stickers
      };
    },

    importCards: function (payload) {
      var list = [];
      if (Array.isArray(payload)) {
        list = payload;
      } else if (payload && Array.isArray(payload.cards)) {
        list = payload.cards;
      } else if (payload && typeof payload === 'object') {
        list = Object.values(payload).filter(function (value) { return typeof value === 'string'; });
      }
      var groups = payload && Array.isArray(payload.groups) ? payload.groups : [];
      groups.forEach(function (name) { api.addGroup(name); });

      var texts = list.map(function (item) {
        if (typeof item === 'string') return item;
        return item && item.text;
      }).filter(Boolean);
      return api.addCards(texts);
    },

    /* ---------- 调试/扩展 ---------- */

    reset: function () {
      state = makeSeed();
      save();
      emit('reset');
    },

    _uid: uid
  };

  global.TAStore = api;
})(window);
