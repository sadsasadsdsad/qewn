(function() {
"use strict";

/* ═══════════════════════════════════════════════════════════════
   КОНСТАНТЫ И КОНФИГУРАЦИЯ
   ═══════════════════════════════════════════════════════════════ */
const LS_KEY = 'chernovik.v2';
const COLORS = ['#c93a2b', '#b3762c', '#2e6f5e', '#39618f', '#7a4a8b', '#a04a68'];

const WIKI_TYPES = [
  { k: 'city', t: 'Города', s: 'Страна', color: '#39618f' },
  { k: 'country', t: 'Страны', s: 'Страна', color: '#2e6f5e' },
  { k: 'person', t: 'Персонажи', s: 'Персонаж', color: '#c93a2b' },
  { k: 'org', t: 'Организации', s: 'Организация', color: '#6d3b57' },
  { k: 'item', t: 'Предметы', s: 'Предмет', color: '#b3762c' },
  { k: 'event', t: 'События', s: 'Событие', color: '#7a4a8b' },
  { k: 'other', t: 'Другое', s: 'Другое', color: '#6a5f4c' }
];

const DEBOUNCE_DELAY = {
  SAVE: 600,
  HIGHLIGHT: 800,
  SEARCH: 300
};

const ANIMATION = {
  EASE_OUT: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
  DURATION_FAST: 150,
  DURATION: 300,
  DURATION_SLOW: 450
};

/* ═══════════════════════════════════════════════════════════════
   УТИЛИТЫ
   ═══════════════════════════════════════════════════════════════ */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mk = (t) => document.createElement(t);
const tmp = (html) => { const d = mk('div'); d.innerHTML = html; return d; };

function plural(n, a, b, c) {
  n = Math.abs(n) % 100;
  const d = n % 10;
  if (n > 10 && n < 20) return c;
  if (d > 1 && d < 5) return b;
  if (d === 1) return a;
  return c;
}

function fmt(n) {
  return n.toLocaleString('ru-RU');
}

function countWords(s) {
  s = (s || '').trim();
  return s ? s.split(/\s+/).length : 0;
}

function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/* ═══════════════════════════════════════════════════════════════
   ИНИЦИАЛИЗАЦИЯ ПОСЛЕ ЗАГРУЗКИ DOM
   ═══════════════════════════════════════════════════════════════ */

// Глобальное состояние
let state, menuOpen = false, menuBlock = null, menuItems = [], menuIdx = 0;
let selectedSep = null, saveTimer = null, highlightTimer = null;
let dragChId = null, editingWikiId = null, wikiFilter = '', wikiTypeFilter = 'all';
let selectedType = 'city', searchOpen = false, searchResults = [], searchIdx = 0;
let zenAnchor = null, applyMarksTimer = null;

function initApp() {
const editor = $('#editor');
const scroller = $('#scroller');
const list = $('#chlist');
const selbar = $('#selbar');
const menu = $('#blockmenu');
const saveTxt = $('#saveTxt');
const saveDot = $('#saveDot');
const library = $('#library');
const workspace = $('#workspace');
const shelf = $('#shelf');
const bookView = $('#bookView');
const bvGrid = $('#bvGrid');
const wpBody = $('#wpBody');
const edRz = $('#edRz');
const spRes = $('#spRes');

const mqMobile = matchMedia('(max-width:880px)');

/* ═══════════════════════════════════════════════════════════════
   ЗАГРУЗКА И СОХРАНЕНИЕ
   ═══════════════════════════════════════════════════════════════ */
function seed() {
  const c1 = {
    id: uid(),
    html: '<h1>Дом над туманом</h1><h2>I · Прибытие</h2><p>Поезд остановился ровно в полночь, и Анна первой шагнула на мокрый перрон. Воздух пах <em>дымом, хвоей и чем-то ещё</em> — так пахнет место, где тебя давно ждут.</p><p><strong>Дом стоял на холме.</strong> Ниже, под туманом, спала деревня; выше — только небо и гулкий ветер в проводах.</p><div class="sep" contenteditable="false"><span><i></i><i></i><i></i></span></div><p>— Вы, верно, к смотрителю, — сказал старик у вокзала. Он не спрашивал. Он <em>знал</em>.</p><p>Анна кивнула и крепче сжала ручку чемодана. Где-то в глубине дома, на самом его дне, тихо скрипнула дверь.</p>'
  };
  const c2 = { id: uid(), html: pamatkaHtml() };
  return {
    v: 2,
    theme: 'light',
    zen: false,
    spell: true,
    activeBookId: null,
    heroes: [],
    ui: {},
    books: [{
      id: uid(),
      title: 'Дом над туманом',
      color: COLORS[0],
      updated: Date.now(),
      current: c1.id,
      chapters: [c1, c2],
      customTypes: [],
      wiki: [
        { id: uid(), type: 'person', name: 'Анна', desc: '' },
        { id: uid(), type: 'other', name: 'Туман', desc: 'Живая пелена, которая по ночам укрывает деревню под холмом.' }
      ]
    }]
  };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY));
    if (s && Array.isArray(s.books)) return s;
  } catch (e) {}
  try {
    const o = JSON.parse(localStorage.getItem('chernovik.v1'));
    if (o && o.chapters && o.chapters.length) {
      return {
        v: 2,
        theme: o.theme || 'light',
        zen: false,
        spell: true,
        activeBookId: null,
        heroes: [],
        ui: {},
        books: [{
          id: uid(),
          title: o.book || 'Без названия',
          color: COLORS[0],
          updated: Date.now(),
          current: o.current,
          chapters: o.chapters,
          customTypes: [],
          wiki: []
        }]
      };
    }
  } catch (e) {}
  return seed();
}

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Ошибка сохранения:', e);
  }
}

state = load();
state.spell = (state.spell === undefined) ? true : !!state.spell;
state.ui = (state.ui && typeof state.ui === 'object') ? state.ui : {};

function migrateHeroes(st) {
  if (!st || !Array.isArray(st.heroes) || !st.heroes.length) return st;
  st.books.forEach(function(b) {
    b.wiki = Array.isArray(b.wiki) ? b.wiki : [];
    st.heroes.forEach(function(h) {
      if (!h || !h.name) return;
      const exists = b.wiki.some(function(w) {
        return (w.name || '').toLowerCase() === h.name.toLowerCase();
      });
      if (!exists) b.wiki.push({ id: uid(), type: 'person', name: h.name, desc: h.desc || '' });
    });
  });
  st.heroes = [];
  return st;
}

migrateHeroes(state);
state.books.forEach(refreshPamatka);
state.books.forEach(function(b) {
  b.wiki = Array.isArray(b.wiki) ? b.wiki : [];
  b.customTypes = Array.isArray(b.customTypes) ? b.customTypes : [];
});
persist();

function normalizeState(s) {
  if (!s || !Array.isArray(s.books)) return null;
  return {
    v: 2,
    theme: (s.theme === 'dark') ? 'dark' : 'light',
    zen: false,
    spell: (s.spell === undefined) ? true : !!s.spell,
    activeBookId: null,
    heroes: Array.isArray(s.heroes) ? s.heroes : [],
    ui: (s.ui && typeof s.ui === 'object') ? s.ui : {},
    books: s.books.map(function(b) {
      return {
        id: (typeof b.id === 'string' && b.id) ? b.id : uid(),
        title: (typeof b.title === 'string') ? b.title : 'Без названия',
        color: (COLORS.indexOf(b.color) >= 0) ? b.color : COLORS[0],
        updated: (typeof b.updated === 'number') ? b.updated : Date.now(),
        current: (typeof b.current === 'string') ? b.current : null,
        customTypes: Array.isArray(b.customTypes) ? b.customTypes.filter(function(t) {
          return t && t.k && t.s;
        }) : [],
        wiki: Array.isArray(b.wiki) ? b.wiki.map(function(w) {
          return {
            id: (w && w.id) ? w.id : uid(),
            type: (w && typeof w.type === 'string') ? w.type : 'other',
            name: (w && typeof w.name === 'string') ? w.name : '',
            desc: (w && typeof w.desc === 'string') ? w.desc : ''
          };
        }).filter(function(w) {
          return w.name;
        }) : [],
        chapters: Array.isArray(b.chapters) ? b.chapters.map(function(c) {
          return {
            id: (c && typeof c.id === 'string') ? c.id : uid(),
            html: (c && typeof c.html === 'string') ? c.html : '',
            pos: (c && typeof c.pos === 'number') ? c.pos : 0
          };
        }) : []
      };
    })
  };
}

/* ═══════════════════════════════════════════════════════════════
   РАБОТА
   /* ═══════════════════════════════════════════════════════════════
      РАБОТА С КНИГАМИ И ГЛАВАМИ
      ═══════════════════════════════════════════════════════════════ */
   function book() {
     return state.books.find(function(b) { return b.id === state.activeBookId; });
   }

   function currentCh() {
     const b = book();
     if (!b || !b.chapters.length) return null;
     return b.chapters.find(function(c) { return c.id === b.current; }) || b.chapters[0];
   }

   function chapterTitle(ch) {
     const h = tmp(ch.html).querySelector('h1');
     const t = h ? h.textContent.trim() : '';
     return t || 'Без названия';
   }

   function chapterWords(ch) {
     return countWords(tmp(ch.html).textContent);
   }

   function bookWords(b) {
     return b.chapters.reduce(function(a, c) { return a + chapterWords(c); }, 0);
   }

   function chapterExcerpt(ch, maxBlocks) {
     const d = tmp(ch.html);
     const out = [];
     for (let i = 0; i < d.children.length && out.length < maxBlocks; i++) {
       const el = d.children[i];
       if (el.tagName === 'H1') continue;
       if (el.classList.contains('sep')) {
         out.push({ sep: true, text: '✦ ✦ ✦' });
         continue;
       }
       let t = (el.textContent || '').replace(/\s+/g, ' ').trim();
       if (!t) continue;
       if (t.length > 150) t = t.slice(0, 147) + '…';
       out.push({ sep: false, text: t });
     }
     return out;
   }

   function timeAgo(ts) {
     if (!ts) return '';
     const d = Date.now() - ts;
     const m = Math.floor(d / 60000);
     if (m < 1) return 'только что';
     if (m < 60) return m + ' мин назад';
     const h = Math.floor(m / 60);
     if (h < 24) return h + ' ч назад';
     const days = Math.floor(h / 24);
     if (days === 1) return 'вчера';
     if (days < 7) return days + ' дн назад';
     return new Date(ts).toLocaleDateString('ru-RU');
   }

   /* ═══════════════════════════════════════════════════════════════
      ПАМЯТКА
      ═══════════════════════════════════════════════════════════════ */
   function pamatkaHtml() {
     return '<!--pamatka-v12--><h1>Памятка</h1>' +
       '<p>Это ваша рукопись: всё, что вы пишете, <strong>сохраняется автоматически</strong> в этом браузере. Кнопка с полкой вверху слева возвращает к списку книг, стрелка вниз скачивает книгу, а <strong>Ctrl&nbsp;+&nbsp;P</strong> печатает её целиком — с титульной страницей.</p>' +
       '<h2>Обзор книги</h2>' +
       '<p>Клик по обложке в библиотеке открывает <strong>обзор книги</strong>: карточки глав с названием, началом текста и статистикой. Клик по карточке открывает редактор на этой главе.</p>' +
       '<h2>Горячие клавиши</h2>' +
       '<p><strong>Ctrl&nbsp;+&nbsp;B</strong> — жирный, <strong>Ctrl&nbsp;+&nbsp;I</strong> — курсив. <strong>Ctrl&nbsp;+&nbsp;F</strong> — поиск по рукописи.</p>' +
       '<p><strong>Ctrl&nbsp;+&nbsp;Alt&nbsp;+&nbsp;1</strong> — заголовок главы, <strong>2</strong> — подзаголовок, <strong>3</strong> — цитата, <strong>0</strong> — обычный текст.</p>' +
       '<h2>Быстрый ввод</h2>' +
       '<p>Наберите <strong>/</strong> в начале строки — откроется меню блоков. Начните строку с <strong>#</strong> или <strong>##</strong> и нажмите пробел, чтобы получить заголовок. Три дефиса <strong>---</strong> превращаются в разделитель.</p>' +
       '<h2>Энциклопедия мира</h2>' +
       '<p>Кнопка с <strong>глобусом</strong> открывает энциклопедию. Выделите слово — в мини‑панели кнопка <strong>Э+</strong>.</p>' +
       '<h2>Фокус</h2>' +
       '<p>Кнопка с мишенью: лишнее гаснет по мере удаления от курсора. Выход — <strong>Esc</strong>.</p>';
   }

   function refreshPamatka(b) {
     let ch = null;
     for (let i = 0; i < b.chapters.length; i++) {
       const h = tmp(b.chapters[i].html).querySelector('h1');
       if (h && h.textContent.trim() === 'Памятка') { ch = b.chapters[i]; break; }
     }
     if (!ch) {
       b.chapters.push({ id: uid(), html: pamatkaHtml() });
     } else if (ch.html.indexOf('pamatka-v12') < 0 && /Горячие клавиши<\/h2>/.test(ch.html)) {
       ch.html = pamatkaHtml();
     }
   }

   /* ═══════════════════════════════════════════════════════════════
      РАЗМЕРЫ ПАНЕЛЕЙ (RESIZE)
      ═══════════════════════════════════════════════════════════════ */
   function setLayoutVars() {
     const u = state.ui;
     const r = document.documentElement.style;
     r.setProperty('--side-w', (u.sideW || 272) + 'px');
     r.setProperty('--wiki-w', (u.wikiW || 390) + 'px');
     r.setProperty('--ed-w', (u.edW || 660) + 'px');
     positionEdRz();
   }

   function positionEdRz() {
     if (workspace.hidden) return;
     const r = editor.getBoundingClientRect();
     edRz.style.left = Math.min(r.right + 8, innerWidth - 8) + 'px';
   }

   function dragX(handle, onMove) {
     let active = false, lx = 0;
     handle.addEventListener('pointerdown', function(e) {
       active = true;
       lx = e.clientX;
       handle.setPointerCapture(e.pointerId);
       handle.classList.add('on');
       e.preventDefault();
       e.stopPropagation();
     });
     handle.addEventListener('pointermove', function(e) {
       if (!active) return;
       const dx = e.clientX - lx;
       lx = e.clientX;
       onMove(dx);
     });
     handle.addEventListener('pointerup', function() {
       active = false;
       handle.classList.remove('on');
       persist();
     });
     handle.addEventListener('pointercancel', function() {
       active = false;
       handle.classList.remove('on');
     });
   }

   dragX($('#sideRz'), function(dx) {
     state.ui.sideW = clamp((state.ui.sideW || 272) + dx, 220, 440);
     document.documentElement.style.setProperty('--side-w', state.ui.sideW + 'px');
   });

   dragX($('#wikiRz'), function(dx) {
     state.ui.wikiW = clamp((state.ui.wikiW || 390) - dx, 300, 780);
     document.documentElement.style.setProperty('--wiki-w', state.ui.wikiW + 'px');
   });

   dragX(edRz, function(dx) {
     state.ui.edW = clamp((state.ui.edW || 660) + dx * 2, 520, 1040);
     document.documentElement.style.setProperty('--ed-w', state.ui.edW + 'px');
     positionEdRz();
   });

   addEventListener('resize', positionEdRz);

   /* ═══════════════════════════════════════════════════════════════
      ПЕРЕТАСКИВАНИЕ МОДАЛОК
      ═══════════════════════════════════════════════════════════════ */
   function dragify(modal, cardSel, headSel) {
     const card = modal.querySelector(cardSel);
     const head = modal.querySelector(headSel);
     let dx = 0, dy = 0, sx = 0, sy = 0, drag = false;

     head.addEventListener('pointerdown', function(e) {
       if (e.target.closest('button')) return;
       drag = true;
       sx = e.clientX - dx;
       sy = e.clientY - dy;
       card.classList.add('dragging');
       try { head.setPointerCapture(e.pointerId); } catch (err) {}
     });

     head.addEventListener('pointermove', function(e) {
       if (!drag) return;
       dx = e.clientX - sx;
       dy = e.clientY - sy;
       card.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
     });

     head.addEventListener('pointerup', function() {
       drag = false;
       card.classList.remove('dragging');
     });

     modal._dragReset = function() {
       dx = 0; dy = 0;
       card.style.transform = '';
       card.classList.remove('dragging');
     };
   }

   dragify($('#wikiModal'), '.wm-card', '.wm-head');

   /* ═══════════════════════════════════════════════════════════════
      СКЛОНЕНИЕ И ПОИСК ИМЁН
      ═══════════════════════════════════════════════════════════════ */
   function declForms(name) {
     const w = (name || '').trim().toLowerCase();
     if (!w) return [w];
     const f = {};
     f[w] = 1;
     function add(x) { if (x && x.length > 1) f[x] = 1; }

     const hard = 'бвгджзклмнпрстфхцчшщ';
     const last = w.slice(-1);
     let stem;

     if (last === 'а' && w.length > 2) {
       stem = w.slice(0, -1);
       add(stem + 'а'); add(stem + 'е'); add(stem + 'у');
       if (/[кгхжшщчй]/.test(stem.slice(-1))) {
         add(stem + 'и'); add(stem + 'ей'); add(stem + 'ею');
       } else {
         add(stem + 'ы'); add(stem + 'ой'); add(stem + 'ою');
       }
     } else if (last === 'я' && w.length > 2) {
       stem = w.slice(0, -1);
       add(stem + 'я'); add(stem + 'и'); add(stem + 'е');
       add(stem + 'ю'); add(stem + 'ей'); add(stem + 'ею');
     } else if ((last === 'о' || last === 'е') && w.length > 2) {
       stem = w.slice(0, -1);
       add(stem + 'о'); add(stem + 'е'); add(stem + 'а');
       add(stem + 'у'); add(stem + 'ом'); add(stem + 'ем');
     } else if (last === 'й' && w.length > 2) {
       stem = w.slice(0, -1);
       add(stem + 'я'); add(stem + 'ю'); add(stem + 'ем'); add(stem + 'е');
     } else if (last === 'ь' && w.length > 2) {
       stem = w.slice(0, -1);
       add(stem + 'и'); add(stem + 'ю'); add(stem + 'ью'); add(stem + 'е');
     } else if (hard.indexOf(last) >= 0 && w.length > 1) {
       add(w + 'а'); add(w + 'у'); add(w + 'е');
       add(w + 'ом'); add(w + 'ем'); add(w + 'ы'); add(w + 'и');
     }
     return Object.keys(f);
   }

   function buildNameAlts(name) {
     return declForms(name).map(escRe).sort(function(a, b) { return b.length - a.length; }).join('|');
   }

   function buildNameRegex(name) {
     const a = buildNameAlts(name);
     if (!a) return null;
     return new RegExp('(^|[^а-яёa-z0-9])(' + a + ')(?![а-яёa-z0-9])', 'gi');
   }

   function getWikiType(k) {
     for (let i = 0; i < WIKI_TYPES.length; i++) {
       if (WIKI_TYPES[i].k === k) return WIKI_TYPES[i];
     }
     const b = book();
     if (b && b.customTypes) {
       for (let j = 0; j < b.customTypes.length; j++) {
         if (b.customTypes[j].k === k) return b.customTypes[j];
       }
     }
     return WIKI_TYPES[WIKI_TYPES.length - 1];
   }

   function allTypes() {
     const b = book();
     return WIKI_TYPES.concat((b && b.customTypes) || []);
   }

   function wikiTypeLabel(k) { return getWikiType(k).s; }
   function wikiTypeColor(k) { return getWikiType(k).color; }

   function nameStats(name) {
     const b = book();
     const re = buildNameRegex(name);
     const appear = [];
     let totalMatches = 0;
     if (b && re) {
       b.chapters.forEach(function(ch, i) {
         const m = tmp(ch.html).textContent.match(re);
         const c = m ? m.length : 0;
         if (c > 0) { appear.push(i); totalMatches += c; }
       });
     }
     return {
       forms: declForms(name),
       appear: appear,
       total: b ? b.chapters.length : 0,
       totalMatches: totalMatches
     };
   }

   function findContexts(name) {
     const b = book();
     const out = [];
     if (!b) return out;
     const alts = buildNameAlts(name);
     if (!alts) return out;
     const testRe = new RegExp('(^|[^а-яёa-z0-9])(' + alts + ')(?![а-яёa-z0-9])', 'i');
     b.chapters.forEach(function(ch, i) {
       const text = tmp(ch.html).textContent;
       const parts = text.match(/[^.!?\n]+[.!?…]*/g) || [];
       parts.forEach(function(s) {
         s = s.replace(/\s+/g, ' ').trim();
         if (!s || s.length < 12 || out.length >= 200) return;
         testRe.lastIndex = 0;
         if (testRe.test(s)) {
           out.push({ ch: i, text: (s.length > 220 ? s.slice(0, 217) + '…' : s) });
         }
       });
     });
     return out;
   }

   function timelineHtml(appear, totalCh, mini) {
     if (!appear.length) return '<div class="hc-tl empty">пока не встречается в тексте</div>';
     const dense = (appear.length > 6 || mini) ? ' dense' : '';
     const ticks = appear.map(function(idx, i) {
       let left = totalCh > 1 ? (idx / (totalCh - 1)) * 100 : 50;
       left = Math.min(97, Math.max(3, left));
       return '<span class="hc-tick ' + ((i % 2 === 0) ? 'top' : 'bottom') + '" style="left:' + left + '%"><i></i><em>Глава ' + (idx + 1) + '</em></span>';
     }).join('');
     return '<div class="hc-tl' + dense + (mini ? ' mini' : '') + '">' + ticks + '</div>';
   }

   /* ═══════════════════════════════════════════════════════════════
      КУРСОР И ПОДСВЕТКА
      ═══════════════════════════════════════════════════════════════ */
   function saveCaretOffset() {
     const s = getSelection();
     if (!s.rangeCount) return null;
     const r = s.getRangeAt(0);
     if (!editor.contains(r.startContainer)) return null;
     const pre = r.cloneRange();
     pre.selectNodeContents(editor);
     pre.setEnd(r.startContainer, r.startOffset);
     return pre.toString().length;
   }

   function restoreCaretOffset(off) {
     if (off == null) return;
     const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
     let acc = 0, node;
     while ((node = walker.nextNode())) {
       const len = node.nodeValue.length;
       if (acc + len >= off) {
         const r = document.createRange();
         r.setStart(node, off - acc);
         r.collapse(true);
         const s = getSelection();
         s.removeAllRanges();
         s.addRange(r);
         return;
       }
       acc += len;
     }
   }

   function rangeFromOffset(off, len) {
     const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
     let acc = 0, node, sN = null, sO = 0, eN = null, eO = 0;
     while ((node = walker.nextNode())) {
       const l = node.nodeValue.length;
       if (sN === null && off < acc + l) { sN = node; sO = off - acc; }
       if (off + len <= acc + l) { eN = node; eO = off + len - acc; break; }
       acc += l;
     }
     if (!sN || !eN) return null;
     const r = document.createRange();
     try { r.setStart(sN, sO); r.setEnd(eN, eO); } catch (e) { return null; }
     return r;
   }

   function flashRange(off, len, ms) {
     const r = rangeFromOffset(off, len);
     if (!r) return false;
     const sp = mk('span');
     sp.className = 'hit-flash';
     try {
       sp.appendChild(r.extractContents());
       r.insertNode(sp);
     } catch (e) { return false; }
     sp.scrollIntoView({ block: 'center', behavior: 'smooth' });
     setTimeout(function() {
       if (sp.parentNode) {
         sp.replaceWith(document.createTextNode(sp.textContent));
         editor.normalize();
         applyMarks(true);
       }
     }, ms || 2000);
     return true;
   }

   function findQuoteOffset(text, quote, name) {
     let off = -1, len = 0;
     if (quote) {
       const q = quote.replace(/\s+/g, ' ').trim();
       let i = text.indexOf(q);
       if (i >= 0) { off = i; len = q.length; }
       else {
         const head = q.slice(0, Math.min(28, q.length));
         i = text.indexOf(head);
         if (i >= 0) { off = i; len = Math.min(head.length, text.length - i); }
       }
     }
     if (off < 0 && name) {
       const re = buildNameRegex(name);
       if (re) {
         const m = re.exec(text);
         if (m) { off = m.index + m[1].length; len = m[2].length; }
       }
     }
     return off >= 0 ? { off: off, len: len } : null;
   }

   function jumpToQuote(idx, quote, name) {
     closeWikiView();
     const b = book();
     if (!b) return;
     const ch = b.chapters[idx];
     if (!ch) return;
     enterEditor(ch.id);
     const text = tmp(ch.html).textContent;
     const f = findQuoteOffset(text, quote, name);
     if (f) setTimeout(function() { flashRange(f.off, f.len, 2200); }, 80);
   }

   /* ═══════════════════════════════════════════════════════════════
      ПОДСВЕТКА УПОМИНАНИЙ В ТЕКСТЕ
      ═══════════════════════════════════════════════════════════════ */
   function unwrapMarks() {
     const spans = editor.querySelectorAll('.wiki');
     if (!spans.length) return;
     spans.forEach(function(sp) { sp.replaceWith(document.createTextNode(sp.textContent)); });
     editor.normalize();
   }

   function wrapMarks(re, en) {
     const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
     const nodes = [];
     while (walker.nextNode()) nodes.push(walker.currentNode);
     nodes.forEach(function(node) {
       const p = node.parentNode;
       if (p && p.classList && p.classList.contains('wiki')) return;
       const text = node.nodeValue;
       re.lastIndex = 0;
       let m, last = 0, frag = null;
       while ((m = re.exec(text))) {
         if (!frag) frag = document.createDocumentFragment();
         const start = m.index + m[1].length;
         const word = m[2];
         frag.appendChild(document.createTextNode(text.slice(last, start)));
         const sp = document.createElement('span');
         sp.className = 'wiki';
         sp.dataset.wiki = en.id;
         if (en.type === 'person') sp.classList.add('wk-person');
         sp.textContent = word;
         frag.appendChild(sp);
         last = start + word.length;
         if (re.lastIndex === m.index) re.lastIndex++;
       }
       if (!frag) return;
       frag.appendChild(document.createTextNode(text.slice(last)));
       node.parentNode.replaceChild(frag, node);
     });
   }

   function applyMarks(savePosition) {
     const b = book();
     if (!b || !b.wiki || !b.wiki.length) return;
     const saved = savePosition ? saveCaretOffset() : null;
     unwrapMarks();
     b.wiki.forEach(function(en) {
       const re = buildNameRegex(en.name);
       if (re) wrapMarks(re, en);
     });
     if (saved != null) restoreCaretOffset(saved);
   }

   function scheduleHighlight() {
     clearTimeout(applyMarksTimer);
     applyMarksTimer = setTimeout(function() { applyMarks(true); }, DEBOUNCE_DELAY.HIGHLIGHT);
   }

   function cleanHtml() {
     const d = mk('div');
     d.innerHTML = editor.innerHTML;
     d.querySelectorAll('.wiki,.hit-flash').forEach(function(sp) {
       sp.replaceWith(document.createTextNode(sp.textContent));
     });
     d.normalize();
     return d.innerHTML;
   }

   function wikiById(id) {
     const b = book();
     return b && b.wiki ? b.wiki.find(function(w) { return w.id === id; }) : null;
   }

   /* ═══════════════════════════════════════════════════════════════
      ПЛАВНЫЕ КРАЯ ПРОКРУТКИ
      ═══════════════════════════════════════════════════════════════ */
   function bindFade(el) {
     const upd = function() {
       el.classList.toggle('f-top', el.scrollTop > 4);
       el.classList.toggle('f-bot', el.scrollTop + el.clientHeight < el.scrollHeight - 4);
     };
     el.addEventListener('scroll', upd, { passive: true });
     upd();
     return upd;
   }

   const spFade = bindFade(spRes);

   /* ═══════════════════════════════════════════════════════════════
      ЭНЦИКЛОПЕДИЯ: ТИПЫ СТАТЕЙ
      ═══════════════════════════════════════════════════════════════ */
   function renderTypeChips() {
     const box = $('#wmTypeChips');
     box.innerHTML = '';
     allTypes().forEach(function(tp) {
       const chip = mk('button');
       chip.type = 'button';
       chip.className = 'type-chip' + (selectedType === tp.k ? ' on' : '');
       chip.style.setProperty('--tc', tp.color);
       chip.innerHTML = '<span>' + esc(tp.s) + '</span>';
       chip.addEventListener('click', function() {
         selectedType = tp.k;
         box.querySelectorAll('.type-chip').forEach(function(c) {
           c.classList.toggle('on', c === chip);
         });
         paintTypeBadge();
       });
       box.appendChild(chip);
     });

     const add = mk('button');
     add.type = 'button';
     add.className = 'type-chip add';
     add.innerHTML = '<span>+ свой</span>';
     add.title = 'Создать свой тип';
     add.addEventListener('click', function() {
       const b = book();
       if (!b) return;
       const name = prompt('Название нового типа (например, «Артефакты»):');
       if (!name) return;
       const trimmed = name.trim();
       if (!trimmed) return;
       b.customTypes = b.customTypes || [];
       const k = 'custom_' + uid();
       const color = COLORS[(b.customTypes.length + 3) % COLORS.length];
       b.customTypes.push({ k: k, t: trimmed, s: trimmed, color: color });
       persist();
       selectedType = k;
       renderTypeChips();
     });
     box.appendChild(add);
     paintTypeBadge();
   }

   function paintTypeBadge() {
     const tp = getWikiType(selectedType);
     const b = $('#wmTypeBadge');
     b.textContent = tp.s;
     b.style.color = tp.color;
   }

   /* ═══════════════════════════════════════════════════════════════
      ЭНЦИКЛОПЕДИЯ: РЕНДЕРИНГ
      ═══════════════════════════════════════════════════════════════ */
   function renderWikiFilters() {
     const box = $('#wpFilters');
     box.innerHTML = '';

     const all = mk('button');
     all.className = 'wp-f nodia' + (wikiTypeFilter === 'all' ? ' on' : '');
     all.textContent = 'Все';
     all.addEventListener('click', function() {
       wikiTypeFilter = 'all';
       renderWikiFilters();
       renderWiki();
     });
     box.appendChild(all);

     allTypes().forEach(function(tp) {
       const b = mk('button');
       b.className = 'wp-f' + (wikiTypeFilter === tp.k ? ' on' : '');
       b.style.setProperty('--tc', tp.color);
       b.textContent = tp.s;
       b.addEventListener('click', function() {
         wikiTypeFilter = tp.k;
         renderWikiFilters();
         renderWiki();
       });
       box.appendChild(b);
     });
   }

   function renderWiki() {
     wpBody.innerHTML = '';
     const b = book();
     const entries = (b && b.wiki) || [];

     $('#wpCount').textContent = entries.length
       ? fmt(entries.length) + ' ' + plural(entries.length, 'статья', 'статьи', 'статей')
       : '';

     const q = wikiFilter.toLowerCase().trim();
     const shown = entries.filter(function(en) {
       if (wikiTypeFilter !== 'all' && en.type !== wikiTypeFilter) return false;
       return !q ||
         en.name.toLowerCase().indexOf(q) >= 0 ||
         (en.desc || '').toLowerCase().indexOf(q) >= 0;
     });

     if (!entries.length) {
       wpBody.innerHTML = '<div class="wp-empty">здесь живёт мир вашей книги: добавляйте города, страны, персонажей, предметы и события.</div>';
       return;
     }
     if (!shown.length) {
       wpBody.innerHTML = '<div class="wp-empty">ничего не найдено — попробуйте другой запрос или тип</div>';
       return;
     }

     allTypes().forEach(function(tp) {
       const group = shown.filter(function(en) { return en.type === tp.k; });
       if (!group.length) return;

       const g = mk('div');
       g.className = 'wp-group';
       g.innerHTML = '<div class="wp-glabel">' + esc(tp.t) + '<span class="wp-gn">' + group.length + '</span></div>';

       const wrap = mk('div');
       wrap.className = 'wg-cards';

       group.forEach(function(en) {
         const st = nameStats(en.name);
         const card = mk('div');
         card.className = 'wk-card';
         card.dataset.type = en.type;
         card.title = 'Открыть досье';

         card.innerHTML =
           '<div class="wk-top">' +
             '<span class="wk-dia" style="background:' + wikiTypeColor(en.type) + '"></span>' +
             '<span class="wk-name"></span>' +
             '<span class="wk-type">' + esc(wikiTypeLabel(en.type)) + '</span>' +
             '<button class="wk-del" title="Удалить статью">×</button>' +
           '</div>' +
           (en.desc ? '<div class="wk-desc"></div>' : '') +
           (st.appear.length ? '<div class="wk-tl">' + timelineHtml(st.appear, st.total, true) + '</div>' : '') +
           '<div class="wk-count"></div>';

         card.querySelector('.wk-name').textContent = en.name;
         if (en.desc) card.querySelector('.wk-desc').textContent = en.desc;

         card.querySelector('.wk-count').textContent = st.totalMatches
           ? st.totalMatches + ' ' + plural(st.totalMatches, 'упоминание', 'упоминания', 'упоминаний') + ' · главы ' + st.appear.map(function(i) { return i + 1; }).join(', ')
           : 'в тексте пока не встречается';

         card.addEventListener('click', function() { openWikiView(en.id); });

         card.querySelector('.wk-del').addEventListener('click', function(e) {
           e.stopPropagation();
           if (!confirm('Удалить статью «' + en.name + '»?')) return;
           b.wiki = b.wiki.filter(function(x) { return x.id !== en.id; });
           persist();
           renderWiki();
           applyMarks(true);
         });

         wrap.appendChild(card);
       });

       g.appendChild(wrap);
       wpBody.appendChild(g);
     });
   }

   /* ═══════════════════════════════════════════════════════════════
      ЭНЦИКЛОПЕДИЯ: МОДАЛКА РЕДАКТИРОВАНИЯ
      ═══════════════════════════════════════════════════════════════ */
   function openWikiModal(id, prefill) {
     editingWikiId = id || null;
     const en = id ? wikiById(id) : null;

     if ($('#wikiModal')._dragReset) $('#wikiModal')._dragReset();

     $('#wmTitle').textContent = en ? en.name : 'Новая статья';
     $('#wmName').value = en ? en.name : (prefill || '');
     $('#wmDesc').value = en ? (en.desc || '') : '';
     selectedType = en ? en.type : 'person';

     renderTypeChips();
     $('#wmDelete').style.display = en ? '' : 'none';
     updateWikiPreview();

     $('#wikiModal').classList.add('on');
     setTimeout(function() { $('#wmName').focus(); }, 60);
   }

   function closeWikiModal() {
     $('#wikiModal').classList.remove('on');
     editingWikiId = null;
   }

   function updateWikiPreview() {
     const name = $('#wmName').value.trim();
     const prev = $('#wmPrev');

     if (name) {
       $('#wmTitle').textContent = name;
     } else {
       $('#wmTitle').textContent = editingWikiId ? 'Статья' : 'Новая статья';
     }

     if (!name) {
       prev.innerHTML = '<div class="hc-tl empty">введите название — я сам найду упоминания в тексте</div>';
       return;
     }

     const st = nameStats(name);
     const ctx = findContexts(name);

     let html = '<div class="m-forms">' + st.forms.slice(0, 8).map(function(f) {
       return '<span>' + esc(f) + '</span>';
     }).join('') + '</div>';

     html += timelineHtml(st.appear, st.total);

     html += '<div class="hc-count" style="text-align:center">' +
       (st.totalMatches
         ? st.totalMatches + ' ' + plural(st.totalMatches, 'упоминание', 'упоминания', 'упоминаний')
         : 'пока не встречается') +
       '</div>';

     if (ctx.length) {
       const shown = ctx.slice(0, 4);
       html += '<div class="wp-sug-label">найдено в тексте (' + ctx.length + ')</div>';
       html += '<div class="wm-qs">' + shown.map(function(c, i) {
         return '<button class="wv-q" data-i="' + i + '"><em>гл.' + (c.ch + 1) + '</em><span>' + esc(c.text) + '</span></button>';
       }).join('') + '</div>';
       if (ctx.length > 4) html += '<div class="wm-more">и ещё ' + (ctx.length - 4) + '</div>';
       html += '<div style="margin-top:10px"><button class="m-btn" id="wmAuto">СОБРАТЬ ОПИСАНИЕ</button></div>';
     }

     prev.innerHTML = html;

     prev.querySelectorAll('.wv-q').forEach(function(btn) {
       btn.addEventListener('click', function() {
         const c = ctx[+btn.dataset.i];
         const ta = $('#wmDesc');
         ta.value = (ta.value ? ta.value.replace(/\s+$/, '') + ' ' : '') + c.text;
       });
     });

     const auto = $('#wmAuto');
     if (auto) {
       auto.addEventListener('click', function() {
         $('#wmDesc').value = ctx.map(function(c) { return c.text; }).join(' ');
       });
     }
   }

   function toggleWikiPanel(force) {
     const on = (force === undefined) ? !$('#wikiPanel').classList.contains('on') : force;
     $('#wikiPanel').classList.toggle('on', on);
     $('#btnWiki').classList.toggle('on', on);
     if (on) {
       renderWikiFilters();
       renderWiki();
       setTimeout(positionEdRz, 450);
     }
   }

   $('#btnWiki').addEventListener('click', function() { toggleWikiPanel(); });
   $('#wpClose').addEventListener('click', function() { toggleWikiPanel(false); });
   $('#wpFull').addEventListener('click', function() { $('#wikiPanel').classList.toggle('full'); });
   $('#wpAdd').addEventListener('click', function() { openWikiModal(null); });
   $('#wpSearch').addEventListener('input', function() { wikiFilter = this.value; renderWiki(); });
   $('#wmClose').addEventListener('click', closeWikiModal);
   $('#wmCancel').addEventListener('click', closeWikiModal);
   $('#wikiModal').addEventListener('click', function(e) { if (e.target === this) closeWikiModal(); });
   $('#wmName').addEventListener('input', updateWikiPreview);

   $('#wmSave').addEventListener('click', function() {
     const b = book();
     if (!b) return;
     b.wiki = Array.isArray(b.wiki) ? b.wiki : [];
     const name = $('#wmName').value.trim();
     if (!name) return;

     if (editingWikiId) {
       const en = wikiById(editingWikiId);
       if (en) {
         en.name = name;
         en.desc = $('#wmDesc').value.trim();
         en.type = selectedType;
       }
     } else {
       b.wiki.push({
         id: uid(),
         type: selectedType,
         name: name,
         desc: $('#wmDesc').value.trim()
       });
     }
     persist();
     closeWikiModal();
     renderWiki();
     applyMarks(true);
   });

   $('#wmDelete').addEventListener('click', function() {
     const b = book();
     if (!b || !editingWikiId) return;
     const en = wikiById(editingWikiId);
     if (en && !confirm('Удалить статью «' + en.name + '»?')) return;
     b.wiki = b.wiki.filter(function(x) { return x.id !== editingWikiId; });
     persist();
     closeWikiModal();
     renderWiki();
     applyMarks(true);
   });

   /* ═══════════════════════════════════════════════════════════════
      ЭНЦИКЛОПЕДИЯ: ДОСЬЕ
      ═══════════════════════════════════════════════════════════════ */
   function openWikiView(id) {
     const en = wikiById(id);
     if (!en) return;

     const st = nameStats(en.name);
     const ctx = findContexts(en.name);
     const tp = getWikiType(en.type);

     $('#wvName').textContent = en.name;
     const typeEl = $('#wvType');
     typeEl.textContent = tp.s;
     typeEl.style.color = tp.color;

     $('#wvDesc').innerHTML = en.desc
       ? esc(en.desc).replace(/\n/g, '<br>')
       : '<span style="color:var(--ink3);font-style:italic">описание пока отсутствует</span>';

     $('#wvTimeline').innerHTML =
       '<div class="lbl" style="text-align:center;margin-bottom:4px">Где встречается</div>' +
       timelineHtml(st.appear, st.total) +
       '<div class="hc-count" style="text-align:center">' +
       (st.totalMatches
         ? st.totalMatches + ' ' + plural(st.totalMatches, 'упоминание', 'упоминания', 'упоминаний')
         : 'пока не встречается в тексте') +
       '</div>';

     const box = $('#wvQuotes');
     const hint = $('#wvHint');
     box.innerHTML = '';
     box.classList.remove('cols');
     hint.textContent = '';

     if (ctx.length) {
       if (ctx.length > 6) {
         box.classList.add('cols');
         const wrap = mk('div');
         wrap.className = 'wv-cols-wrap';
         const byCh = {};
         ctx.forEach(function(c) { (byCh[c.ch] = byCh[c.ch] || []).push(c); });
         const keys = Object.keys(byCh).map(Number).sort(function(a, b) { return a - b; });

         keys.forEach(function(k, ci) {
           const col = mk('div');
           col.className = 'wv-col';
           col.style.animationDelay = (ci * 70) + 'ms';

           const h = mk('div');
           h.className = 'wc-h';
           h.title = 'Перейти к главе ' + (k + 1);
           h.innerHTML = '<span>Глава ' + (k + 1) + '</span><b>' + byCh[k].length + '</b>';
           h.addEventListener('click', function() { jumpToQuote(k, null, en.name); });
           col.appendChild(h);

           const body = mk('div');
           body.className = 'col-body fadebox';
           byCh[k].forEach(function(c) {
             const q = mk('button');
             q.className = 'wv-q';
             q.innerHTML = '<span>' + esc(c.text) + '</span>';
             q.title = 'Перейти к этому месту текста';
             q.addEventListener('click', function() { jumpToQuote(c.ch, c.text, en.name); });
             body.appendChild(q);
           });
           col.appendChild(body);
           bindFade(body);
           wrap.appendChild(col);
         });
         box.appendChild(wrap);
         hint.textContent = 'цитаты разбиты по главам · клик по цитате — переход к тексту';
       } else {
         const single = mk('div');
         single.className = 'wv-single';
         const oneCh = ctx.every(function(c) { return c.ch === ctx[0].ch; });
         ctx.forEach(function(c) {
           const q = mk('button');
           q.className = 'wv-q';
           q.innerHTML = (oneCh ? '' : '<em>гл.' + (c.ch + 1) + '</em>') + '<span>' + esc(c.text) + '</span>';
           q.title = 'Перейти к этому месту текста';
           q.addEventListener('click', function() { jumpToQuote(c.ch, c.text, en.name); });
           single.appendChild(q);
         });
         box.appendChild(single);
         hint.textContent = 'клик по цитате — переход к месту текста';
       }
     } else {
       hint.textContent = 'в тексте пока не встречается';
     }

     $('#wvEdit').onclick = function() {
       closeWikiView();
       setTimeout(function() { openWikiModal(id); }, 200);
     };

     $('#wikiViewModal').classList.add('on');
   }

   function closeWikiView() { $('#wikiViewModal').classList.remove('on'); }
   $('#wvClose').addEventListener('click', closeWikiView);
   $('#wvCloseBtn').addEventListener('click', closeWikiView);
   $('#wikiViewModal').addEventListener('click', function(e) { if (e.target === this) closeWikiView(); });

   /* ═══════════════════════════════════════════════════════════════
      ПОИСК
      ═══════════════════════════════════════════════════════════════ */
   function openSearch() {
     $('#searchPanel').classList.add('on');
     searchOpen = true;
     $('#spInput').value = '';
     spRes.innerHTML = '';
     $('#spCount').textContent = '';
     searchResults = [];
     searchIdx = 0;
     spFade();
     setTimeout(function() { $('#spInput').focus(); }, 50);
   }

   function closeSearch() {
     $('#searchPanel').classList.remove('on');
     searchOpen = false;
   }

   $('#btnSearch').addEventListener('click', function() {
     searchOpen ? closeSearch() : openSearch();
   });

   $('#spClose').addEventListener('click', closeSearch);

   $('#spInput').addEventListener('input', function() {
     const q = this.value.toLowerCase().trim();
     spRes.innerHTML = '';
     searchResults = [];
     searchIdx = 0;

     if (q.length < 2) { $('#spCount').textContent = ''; spFade(); return; }

     const b = book();
     if (!b) return;

     b.chapters.forEach(function(ch, i) {
       const text = tmp(ch.html).textContent;
       const lower = text.toLowerCase();
       let idx = lower.indexOf(q);
       while (idx >= 0 && searchResults.length < 60) {
         const from = Math.max(0, idx - 46);
         const snip = (from > 0 ? '…' : '') + text.slice(from, idx + q.length + 64).replace(/\s+/g, ' ');
         searchResults.push({ i: i, idx: idx, len: q.length, snip: snip, q: q });
         idx = lower.indexOf(q, idx + q.length);
       }
     });

     $('#spCount').textContent = searchResults.length ? fmt(searchResults.length) : '';

     if (!searchResults.length) {
       spRes.innerHTML = '<div class="sp-empty">ничего не найдено</div>';
       spFade();
       return;
     }

     const b2 = book();
     searchResults.forEach(function(r, n) {
       const it = mk('div');
       it.className = 'sp-item' + (n === 0 ? ' act' : '');
       it.innerHTML =
         '<span class="t"><em>гл.' + (r.i + 1) + '</em>' + esc(chapterTitle(b2.chapters[r.i])) + '</span>' +
         '<span class="s">' + esc(r.snip).replace(new RegExp('(' + escRe(esc(r.q)) + ')', 'i'), '<mark>$1</mark>') + '</span>';
       it.addEventListener('click', function() { goToResult(r); });
       spRes.appendChild(it);
     });
     spFade();
   });

   function paintSearch() {
     spRes.querySelectorAll('.sp-item').forEach(function(el, i) {
       el.classList.toggle('act', i === searchIdx);
     });
   }

   function scrollSearchAct() {
     const el = spRes.querySelector('.sp-item.act');
     if (el) el.scrollIntoView({ block: 'nearest' });
   }

   $('#spInput').addEventListener('keydown', function(e) {
     if (e.key === 'Escape') { closeSearch(); return; }
     if (!searchResults.length) return;
     if (e.key === 'ArrowDown') {
       e.preventDefault();
       searchIdx = (searchIdx + 1) % searchResults.length;
       paintSearch();
       scrollSearchAct();
     }
     if (e.key === 'ArrowUp') {
       e.preventDefault();
       searchIdx = (searchIdx - 1 + searchResults.length) % searchResults.length;
       paintSearch();
       scrollSearchAct();
     }
     if (e.key === 'Enter') {
       e.preventDefault();
       goToResult(searchResults[searchIdx]);
     }
   });

   function goToResult(r) {
     closeSearch();
     const b = book();
     if (!b) return;
     const ch = b.chapters[r.i];
     if (!ch) return;
     enterEditor(ch.id);
     setTimeout(function() { flashRange(r.idx, r.len, 2000); }, 80);
   }

   /* ═══════════════════════════════════════════════════════════════
      ОРФОГРАФИЯ
      ═══════════════════════════════════════════════════════════════ */
   function applySpell() {
     editor.setAttribute('spellcheck', state.spell ? 'true' : 'false');
     $('#bookTitle').setAttribute('spellcheck', state.spell ? 'true' : 'false');
     $('#btnSpell').classList.toggle('on', state.spell);
     $('#btnSpell').title = state.spell ? 'Орфография: вкл' : 'Орфография: выкл';
   }

   function forceSpell() {
     if (!state.spell) return;
     const active = document.activeElement === editor;
     if (active) {
       editor.blur();
       setTimeout(function() { editor.focus(); }, 10);
     }
   }

   $('#btnSpell').addEventListener('click', function() {
     state.spell = !state.spell;
     persist();
     applySpell();
     if (state.spell) {
       forceSpell();
       applyMarks(true);
       editor.focus();
       caretEnd(ensureLastP());
     }
   });

   /* ═══════════════════════════════════════════════════════════════
      РЕДАКТОР: КУРСОР И БЛОКИ
      ═══════════════════════════════════════════════════════════════ */
   function caretEnd(el) {
     const r = document.createRange();
     const s = getSelection();
     r.selectNodeContents(el);
     r.collapse(false);
     s.removeAllRanges();
     s.addRange(r);
   }

   function caretStart(el) {
     const r = document.createRange();
     const s = getSelection();
     r.setStart(el, 0);
     r.collapse(true);
     s.removeAllRanges();
     s.addRange(r);
   }

   function getBlock() {
     const s = getSelection();
     if (!s.rangeCount) return null;
     let n = s.anchorNode;
     if (!n || !editor.contains(n)) return null;
     if (n.nodeType === 3) n = n.parentElement;
     return n.closest('p,h1,h2,blockquote');
   }

   function caretAtStartOf(block) {
     const s = getSelection();
     if (!s.rangeCount) return false;
     const r = s.getRangeAt(0).cloneRange();
     r.collapse(true);
     const pre = r.cloneRange();
     pre.selectNodeContents(block);
     pre.setEnd(r.endContainer, r.endOffset);
     return pre.toString().length === 0;
   }

   function convertBlock(block, tag) {
     if (!block) return;
     if (block.tagName.toLowerCase() === tag) { caretEnd(block); return; }
     const n = mk(tag);
     while (block.firstChild) n.appendChild(block.firstChild);
     block.replaceWith(n);
     applyDropcap();
     caretEnd(n);
     scheduleSave();
   }

   function reTag(block, tag, text) {
     const n = mk(tag);
     n.textContent = text || '';
     block.replaceWith(n);
     applyDropcap();
     caretEnd(n);
     scheduleSave();
   }

   function makeSepFrom(block) {
     const s = mk('div');
     s.className = 'sep';
     s.contentEditable = 'false';
     s.innerHTML = '<span><i></i><i></i><i></i></span>';
     const p = mk('p');
     block.replaceWith(s);
     s.after(p);
     applyDropcap();
     caretStart(p);
     scheduleSave();
   }

   function splitBlock(block) {
     const s = getSelection();
     const r = s.getRangeAt(0);
     r.deleteContents();
     const tail = document.createRange();
     tail.selectNodeContents(block);
     tail.setStart(r.endContainer, r.endOffset);
     const tag = (block.tagName === 'H1' || block.tagName === 'H2') ? 'p' : block.tagName.toLowerCase();
     const p = mk(tag);
     p.appendChild(tail.extractContents());
     block.after(p);
     caretStart(p);
     scheduleSave();
   }

   function ensureLastP() {
     let last = editor.lastElementChild;
     if (!last || last.classList.contains('sep') || /^(H1|H2)$/.test(last.tagName)) {
       const p = mk('p');
       editor.appendChild(p);
       last = p;
     }
     return last;
   }

   function applyDropcap() {
     editor.querySelectorAll('.dropcap').forEach(function(n) { n.classList.remove('dropcap'); });
     const h = editor.querySelector('h1');
     if (!h) return;
     let node = h;
     while ((node = node.nextElementSibling)) {
       if (node.tagName === 'H1') break;
       if (node.tagName === 'P' && node.textContent.trim()) {
         node.classList.add('dropcap');
         break;
       }
     }
   }

   /* ═══════════════════════════════════════════════════════════════
      МЕНЮ БЛОКОВ (/)
      ═══════════════════════════════════════════════════════════════ */
   const ITEMS = [
     { tag: 'h1', badge: 'Н1', title: 'Заголовок главы', hint: 'CTRL ALT 1', al: 'title заголовок h1' },
     { tag: 'h2', badge: 'Н2', title: 'Подзаголовок', hint: 'CTRL ALT 2', al: 'subtitle подзаголовок h2' },
     { tag: 'p', badge: 'Aa', title: 'Обычный текст', hint: 'CTRL ALT 0', al: 'text текст параграф p' },
     { tag: 'blockquote', badge: '❝', title: 'Цитата', hint: 'CTRL ALT 3', al: 'quote цитата эпиграф bq' },
     { tag: 'sep', badge: '✦', title: 'Разделитель', hint: '— — —', al: 'sep разделитель сцена' }
   ];

   menu.innerHTML = '<div class="bm-head">Вставить блок</div>' + ITEMS.map(function(it, i) {
     return '<div class="bm-item" data-i="' + i + '"><span class="bm-badge">' + it.badge + '</span><span class="t">' + it.title + '</span><span class="h">' + it.hint + '</span></div>';
   }).join('');

   const itemEls = Array.prototype.slice.call(menu.querySelectorAll('.bm-item'));
   itemEls.forEach(function(el) {
     el.addEventListener('mousedown', function(e) { e.preventDefault(); });
     el.addEventListener('click', function() { applyItem(ITEMS[+el.dataset.i]); });
   });

   function openSlash(block, q) {
     menuBlock = block;
     q = (q || '').toLowerCase().trim();
     menuItems = ITEMS.filter(function(it) {
       return !q ||
         it.title.toLowerCase().indexOf(q) >= 0 ||
         it.tag.indexOf(q) >= 0 ||
         (it.al || '').indexOf(q) >= 0;
     });
     itemEls.forEach(function(el, i) {
       el.style.display = menuItems.indexOf(ITEMS[i]) >= 0 ? '' : 'none';
     });
     menuIdx = 0;
     paintMenu();
     if (!menuItems.length) { closeMenu(); return; }

     let r = null;
     try {
       const sel = getSelection();
       if (sel.rangeCount) {
         const cr = sel.getRangeAt(0).getBoundingClientRect();
         if (cr && (cr.top || cr.bottom)) r = cr;
       }
     } catch (e) {}
     if (!r) r = block.getBoundingClientRect();

     let left = Math.max(10, r.left);
     if (left + 254 > innerWidth) left = innerWidth - 264;
     menu.style.left = left + 'px';
     menu.style.top = (r.bottom + 8) + 'px';
     menu.classList.add('on');
     menuOpen = true;
   }

   function paintMenu() {
     itemEls.forEach(function(el) {
       el.classList.toggle('act', +el.dataset.i === ITEMS.indexOf(menuItems[menuIdx]));
     });
   }

   function closeMenu() {
     menu.classList.remove('on');
     menuOpen = false;
     menuBlock = null;
   }

   function applyItem(item) {
     if (!item) return;
     const block = menuBlock || getBlock();
     closeMenu();
     editor.focus();
     if (!block) return;
     if (item.tag === 'sep') { makeSepFrom(block); return; }
     block.textContent = '';
     convertBlock(block, item.tag);
   }

   /* ═══════════════════════════════════════════════════════════════
      ПАНЕЛЬ ФОРМАТИРОВАНИЯ
      ═══════════════════════════════════════════════════════════════ */
   selbar.querySelectorAll('button').forEach(function(b) {
     b.addEventListener('mousedown', function(e) { e.preventDefault(); });
     b.addEventListener('click', function() {
       if (b.dataset.cmd === 'wiki') {
         const t = getSelection().toString().replace(/\s+/g, ' ').trim().slice(0, 60);
         if (t) openWikiModal(null, t);
         return;
       }
       document.execCommand(b.dataset.cmd);
       editor.focus();
       refreshFloats(true);
     });
   });

   /* ═══════════════════════════════════════════════════════════════
      РЕДАКТОР: СОБЫТИЯ
      ═══════════════════════════════════════════════════════════════ */
   editor.addEventListener('keydown', function(e) {
     if (selectedSep && (e.key === 'Delete' || e.key === 'Backspace')) {
       e.preventDefault();
       selectedSep.remove();
       selectedSep = null;
       scheduleSave();
       return;
     }
     if (e.key === 'Escape') { closeMenu(); return; }
     if (menuOpen) {
       if (e.key === 'ArrowDown') { e.preventDefault(); menuIdx = (menuIdx + 1) % menuItems.length; paintMenu(); return; }
       if (e.key === 'ArrowUp') { e.preventDefault(); menuIdx = (menuIdx - 1 + menuItems.length) % menuItems.length; paintMenu(); return; }
       if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyItem(menuItems[menuIdx]); return; }
     }
     if ((e.ctrlKey || e.metaKey) && e.altKey && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
       e.preventDefault();
       const cur = currentCh();
       if (cur) moveChapter(cur.id, e.code === 'ArrowUp' ? -1 : 1);
       return;
     }
     const block = getBlock();
     if (e.key === 'Enter' && !e.shiftKey && block) {
       const tag = block.tagName;
       if (tag === 'H1' || tag === 'H2') {
         e.preventDefault();
         if (!block.textContent.trim()) { convertBlock(block, 'p'); }
         else { const p = mk('p'); block.after(p); caretStart(p); }
         scheduleSave();
         return;
       }
       if (block.textContent.trim() === '---') { e.preventDefault(); makeSepFrom(block); return; }
       e.preventDefault();
       splitBlock(block);
       return;
     }
     if (e.key === ' ' && block && block.tagName === 'P') {
       const t = block.textContent;
       let m;
       if (t === '---') { e.preventDefault(); makeSepFrom(block); return; }
       if ((m = t.match(/^##\s?(.*)$/))) { e.preventDefault(); reTag(block, 'h2', m[1]); return; }
       if ((m = t.match(/^#\s?(.*)$/))) { e.preventDefault(); reTag(block, 'h1', m[1]); return; }
     }
     if (e.key === 'Backspace' && block) {
       const prev = block.previousElementSibling;
       if (prev && prev.classList.contains('sep') && caretAtStartOf(block)) {
         e.preventDefault();
         prev.remove();
         scheduleSave();
         return;
       }
     }
     if ((e.ctrlKey || e.metaKey) && e.altKey) {
       const map = { Digit1: 'h1', Digit2: 'h2', Digit3: 'blockquote', Digit0: 'p' }[e.code];
       if (map) { e.preventDefault(); convertBlock(block, map); }
     }
   });

   editor.addEventListener('input', function() {
     editor.querySelectorAll(':scope > div:not(.sep)').forEach(function(d) {
       const p = mk('p');
       while (d.firstChild) p.appendChild(d.firstChild);
       d.replaceWith(p);
     });
     applyDropcap();

     const block = getBlock();
     if (block && block.tagName === 'P') {
       const t = block.textContent;
       if (t.indexOf('/') === 0) { openSlash(block, t.slice(1)); updateStats(); return; }
       if (t === '---') { makeSepFrom(block); updateStats(); return; }
     }
     if (menuOpen && (!block || block !== menuBlock || block.textContent.indexOf('/') !== 0)) closeMenu();
     updateStats();
     scheduleSave();
     scheduleHighlight();
     refreshFloats(true);
   });

   editor.addEventListener('paste', function(e) {
     e.preventDefault();
     const t = (e.clipboardData || window.clipboardData).getData('text/plain');
     if (t) document.execCommand('insertText', false, t);
   });

   editor.addEventListener('click', function(e) {
     const wsp = e.target.closest('.wiki');
     if (wsp) { openWikiView(wsp.dataset.wiki); return; }
     const s = e.target.closest('.sep');
     if (selectedSep) { selectedSep.classList.remove('selected'); selectedSep = null; }
     if (s) {
       selectedSep = s;
       s.classList.add('selected');
       let nxt = s.nextElementSibling;
       if (!nxt) { nxt = mk('p'); s.after(nxt); }
       caretStart(nxt);
     }
   });

   scroller.addEventListener('click', function(e) {
     if (e.target !== scroller && e.target !== editor) return;
     caretEnd(ensureLastP());
     editor.focus();
   });

   document.addEventListener('click', function(e) {
     if (selectedSep && !e.target.closest('.sep')) { selectedSep.classList.remove('selected'); selectedSep = null; }
     if (menuOpen && !e.target.closest('#blockmenu')) closeMenu();
     if (searchOpen && !e.target.closest('#searchPanel') && !e.target.closest('#btnSearch')) closeSearch();
   });

   /* ═══════════════════════════════════════════════════════════════
      РЕЖИМ ФОКУСА И ПЛАВАЮЩИЕ ПАНЕЛИ
      ═══════════════════════════════════════════════════════════════ */
   function refreshFloats(allowKeep) {
     const s = getSelection();
     let showBar = false;
     if (s.rangeCount && editor.contains(s.anchorNode) && !s.isCollapsed) {
       const txt = s.toString().trim();
       if (txt) {
         const r = s.getRangeAt(0).getBoundingClientRect();
         const x = Math.min(Math.max(r.left + r.width / 2, 90), innerWidth - 90);
         selbar.style.left = x + 'px';
         selbar.style.top = Math.max(60, r.top - 34) + 'px';
         showBar = true;
         try {
           selbar.querySelector('[data-cmd=bold]').classList.toggle('active', document.queryCommandState('bold'));
           selbar.querySelector('[data-cmd=italic]').classList.toggle('active', document.queryCommandState('italic'));
         } catch (err) {}
       }
     }
     selbar.classList.toggle('on', showBar);

     const zen = document.body.classList.contains('zen');
     const blocks = Array.prototype.slice.call(editor.children);
     const act = getBlock();
     if (act) zenAnchor = act;
     const anchor = zenAnchor || act;
     const ai = anchor ? blocks.indexOf(anchor) : -1;

     blocks.forEach(function(el, i) {
       if (zen) {
         const d = Math.abs(i - ai);
         el.style.opacity = (ai < 0) ? 1 : (d === 0 ? 1 : (d === 1 ? 0.45 : (d === 2 ? 0.3 : 0.16)));
         el.classList.toggle('lit', d === 0);
       } else {
         el.style.opacity = '';
         el.classList.remove('lit');
       }
     });

     if (zen && allowKeep && s.rangeCount && s.isCollapsed && editor.contains(s.anchorNode)) {
       try {
         const cr = s.getRangeAt(0).getBoundingClientRect();
         if (cr && (cr.top || cr.bottom)) {
           const sr = scroller.getBoundingClientRect();
           const top = cr.top - sr.top;
           const bottom = cr.bottom - sr.top;
           let target = null;
           if (top < 8) target = scroller.scrollTop + top - 90;
           else if (bottom > sr.height - 8) target = scroller.scrollTop + (bottom - sr.height) + 90;
           if (target != null && Math.abs(target - scroller.scrollTop) > 4) {
             scroller.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
           }
         }
       } catch (e) {}
     }

     if (menuOpen && menuBlock) {
       const rm = menuBlock.getBoundingClientRect();
       menu.style.top = (rm.bottom + 8) + 'px';
     }
   }

   document.addEventListener('selectionchange', function() { refreshFloats(true); });
   scroller.addEventListener('scroll', function() { selbar.classList.remove('on'); refreshFloats(false); }, { passive: true });

   /* ═══════════════════════════════════════════════════════════════
      СТАТИСТИКА И СОХРАНЕНИЕ
      ═══════════════════════════════════════════════════════════════ */
   function updateStats() {
     const t = editor.innerText || '';
     const w = countWords(t);
     const c = t.replace(/\s/g, '').length;
     const m = Math.ceil(w / 180);
     let pos = '';
     const b = book();
     if (b) {
       const ch = currentCh();
       const idx = ch ? b.chapters.indexOf(ch) : -1;
       if (idx >= 0) pos = 'гл. ' + (idx + 1) + '/' + b.chapters.length + ' · ';
     }
     $('#wcTop').textContent = fmt(w) + ' ' + plural(w, 'слово', 'слова', 'слов');
     $('#statRight').textContent = pos +
       (w ? ('≈ ' + m + ' мин чтения · ') : '') +
       fmt(w) + ' ' + plural(w, 'слово', 'слова', 'слов') + ' · ' +
       fmt(c) + ' ' + plural(c, 'знак', 'знака', 'знаков');
   }

   function rememberPos() {
     const b = book();
     if (!b) return;
     const ch = currentCh();
     if (ch) ch.pos = scroller.scrollTop;
   }

   function commitNow() {
     const b = book();
     if (b && workspace.hidden === false) {
       rememberPos();
       const ch = currentCh();
       if (ch) ch.html = cleanHtml();
       b.updated = Date.now();
       persist();
     }
   }

   function scheduleSave() {
     saveTxt.textContent = 'Сохранение…';
     clearTimeout(saveTimer);
     saveTimer = setTimeout(function() {
       const b = book();
       if (!b) return;
       rememberPos();
       const ch = currentCh();
       if (ch) ch.html = cleanHtml();
       b.updated = Date.now();
       persist();
       renderList(false);
       if ($('#wikiPanel').classList.contains('on')) renderWiki();
       updateCrumb();
       saveTxt.textContent = 'Сохранено · ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
       saveDot.classList.remove('pulse');
       void saveDot.offsetWidth;
       saveDot.classList.add('pulse');
     }, DEBOUNCE_DELAY.SAVE);
   }

   addEventListener('beforeunload', commitNow);

   /* ═══════════════════════════════════════════════════════════════
      РЕЗЕРВНЫЕ КОПИИ
      ═══════════════════════════════════════════════════════════════ */
   $('#btnBackup').addEventListener('click', function() {
     commitNow();
     const d = new Date();
     const name = 'chernovik-backup-' + d.getFullYear() + '-' +
       String(d.getMonth() + 1).padStart(2, '0') + '-' +
       String(d.getDate()).padStart(2, '0') + '.json';
     const a = mk('a');
     a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
     a.download = name;
     a.click();
     setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
   });

   $('#btnRestore').addEventListener('click', function() { $('#restoreInput').click(); });

   $('#restoreInput').addEventListener('change', function() {
     const f = this.files && this.files[0];
     this.value = '';
     if (f) restoreBackup(f);
   });

   function restoreBackup(file) {
     const reader = new FileReader();
     reader.onload = function() {
       let st = null;
       try { st = normalizeState(JSON.parse(reader.result)); } catch (e) { st = null; }
       if (st) st = migrateHeroes(st);
       if (!st) { alert('Это не похоже на резервную копию «Черновика»'); return; }
       if (!confirm('Загрузить резервную копию?\nТекущие книги будут полностью заменены.')) return;

       state = st;
       state.ui = (state.ui && typeof state.ui === 'object') ? state.ui : {};
       state.books.forEach(refreshPamatka);
       state.books.forEach(function(b) { b.customTypes = Array.isArray(b.customTypes) ? b.customTypes : []; });
       persist();

       document.body.classList.remove('zen', 'side-open');
       $('#btnZen').classList.remove('on');
       setTheme(state.theme || 'light');
       setLayoutVars();
       applySpell();
       closeMenu();
       selbar.classList.remove('on');
       closeSearch();
       toggleWikiPanel(false);

       workspace.hidden = true;
       bookView.hidden = true;
       library.hidden = false;
       library.scrollTop = 0;
       viewIn(library);
       renderLibrary();
     };
     reader.readAsText(file);
   }

   /* ═══════════════════════════════════════════════════════════════
      ПЕРЕТАСКИВАНИЕ ГЛАВ
      ═══════════════════════════════════════════════════════════════ */
   function clearDropMarks() {
     list.querySelectorAll('.drop-before,.drop-after').forEach(function(n) {
       n.classList.remove('drop-before', 'drop-after');
     });
     list.classList.remove('drop-end');
   }

   function moveChapter(id, dir) {
     const b = book();
     if (!b) return;
     const arr = b.chapters;
     const i = arr.findIndex(function(x) { return x.id === id; });
     const j = i + dir;
     if (i < 0 || j < 0 || j >= arr.length) return;
     const t = arr[i];
     arr[i] = arr[j];
     arr[j] = t;
     persist();
     renderList(false);
     updateStats();
   }

   function dropAtEnd() {
     const b = book();
     if (!b || !dragChId) return;
     const arr = b.chapters;
     const from = arr.findIndex(function(x) { return x.id === dragChId; });
     if (from >= 0 && from < arr.length - 1) {
       const it = arr.splice(from, 1)[0];
       arr.push(it);
       persist();
       renderList(false);
       updateStats();
     }
   }

   list.addEventListener('dragover', function(e) {
     if (!dragChId) return;
     if (e.target === list) { e.preventDefault(); clearDropMarks(); list.classList.add('drop-end'); }
   });

   list.addEventListener('dragleave', function(e) {
     if (e.target === list) list.classList.remove('drop-end');
   });

   list.addEventListener('drop', function(e) {
     if (dragChId && list.classList.contains('drop-end')) { e.preventDefault(); dropAtEnd(); }
   });

   /* ═══════════════════════════════════════════════════════════════
      РЕНДЕРИНГ СПИСКА ГЛАВ
      ═══════════════════════════════════════════════════════════════ */
   function renderList(animate) {
     const b = book();
     if (!b) return;
     list.innerHTML = '';
     let total = 0;

     b.chapters.forEach(function(ch, i) {
       const w = chapterWords(ch);
       total += w;
       const el = mk('div');
       el.className = 'ch' + (ch.id === b.current ? ' active' : '') + (animate ? ' boot' : '');
       if (animate) el.style.animationDelay = (i * 35) + 'ms';
       el.draggable = true;
       el.title = 'Перетащите, чтобы изменить порядок';
       el.innerHTML =
         '<span class="num">' + String(i + 1).padStart(2, '0') + '</span>' +
         '<span class="ttl"></span>' +
         '<span class="wc"></span>' +
         '<button class="del" title="Удалить главу">×</button>';
       el.querySelector('.ttl').textContent = chapterTitle(ch);
       el.querySelector('.wc').textContent = fmt(w);

       el.addEventListener('click', function() { openChapter(ch.id); });

       el.querySelector('.del').addEventListener('click', function(e) {
         e.stopPropagation();
         if (b.chapters.length === 1) return;
         if (!confirm('Удалить главу «' + chapterTitle(ch) + '»?')) return;
         b.chapters = b.chapters.filter(function(x) { return x.id !== ch.id; });
         if (b.current === ch.id) openChapter(b.chapters[0].id, true);
         persist();
         renderList(true);
       });

       el.addEventListener('dragstart', function(e) {
         dragChId = ch.id;
         el.classList.add('drag');
         e.dataTransfer.effectAllowed = 'move';
         try { e.dataTransfer.setData('text/plain', ch.id); } catch (err) {}
       });

       el.addEventListener('dragend', function() {
         el.classList.remove('drag');
         dragChId = null;
         clearDropMarks();
       });

       el.addEventListener('dragover', function(e) {
         if (!dragChId || dragChId === ch.id) return;
         e.preventDefault();
         e.stopPropagation();
         e.dataTransfer.dropEffect = 'move';
         const r = el.getBoundingClientRect();
         const before = (e.clientY - r.top) < r.height / 2;
         clearDropMarks();
         el.classList.add(before ? 'drop-before' : 'drop-after');
       });

       el.addEventListener('drop', function(e) {
         e.preventDefault();
         e.stopPropagation();
         if (!dragChId || dragChId === ch.id) return;
         const before = el.classList.contains('drop-before');
         const arr = b.chapters;
         const from = arr.findIndex(function(x) { return x.id === dragChId; });
         if (from < 0) return;
         const item = arr.splice(from, 1)[0];
         const to = arr.findIndex(function(x) { return x.id === ch.id; });
         arr.splice(before ? to : to + 1, 0, item);
         dragChId = null;
         clearDropMarks();
         persist();
         renderList(false);
         updateStats();
       });

       list.appendChild(el);
     });

     $('#chCount').textContent = b.chapters.length + ' шт.';
     $('#totalWords').textContent = fmt(total) + ' ' + plural(total, 'слово', 'слова', 'слов');
     $('#totalRead').textContent = total ? ('≈ ' + Math.ceil(total / 180) + ' мин') : '';
   }

   function updateCrumb() {
     const b = book();
     $('#crumbBook').textContent = b ? (b.title || 'Без названия') : '';
     const ch = currentCh();
     $('#crumbCh').textContent = ch ? chapterTitle(ch) : '';
     document.title = ((b && b.title) || 'Без названия') + ' — Черновик';
   }

   function loadChapter(c) {
     zenAnchor = null;
     editor.innerHTML = c.html || '<p></p>';
     if (!editor.firstElementChild) editor.innerHTML = '<p></p>';
     applyDropcap();
     forceSpell();
     applyMarks(false);
     editor.classList.remove('enter');
     void editor.offsetWidth;
     editor.classList.add('enter');
     scroller.scrollTop = (typeof c.pos === 'number') ? c.pos : 0;
     positionEdRz();
   }

   function openChapter(id, skipSave) {
     const b = book();
     if (!b) return;
     if (!skipSave) {
       const prev = currentCh();
       if (prev) { prev.html = cleanHtml(); prev.pos = scroller.scrollTop; }
     }
     closeMenu();
     selbar.classList.remove('on');
     b.current = id;
     loadChapter(currentCh());
     renderList(true);
     updateCrumb();
     updateStats();
     persist();
     if (mqMobile.matches) document.body.classList.remove('side-open');
   }

   $('#addCh').addEventListener('click', function() {
     const b = book();
     if (!b) return;
     const ch = currentCh();
     if (ch) { ch.html = cleanHtml(); ch.pos = scroller.scrollTop; }
     const n = { id: uid(), html: '<h1></h1><p></p>', pos: 0 };
     b.chapters.push(n);
     persist();
     openChapter(n.id, true);
     editor.focus();
     caretStart(editor.querySelector('h1'));
   });

   $('#bookTitle').addEventListener('input', function() {
     const b = book();
     if (!b) return;
     b.title = $('#bookTitle').value;
     updateCrumb();
     scheduleSave();
   });

   /* ═══════════════════════════════════════════════════════════════
      ОБЗОР КНИГИ
      ═══════════════════════════════════════════════════════════════ */
   function openBookOverview(id) {
     state.activeBookId = id;
     const b = book();
     if (!b) return;
     b.wiki = Array.isArray(b.wiki) ? b.wiki : [];
     b.customTypes = Array.isArray(b.customTypes) ? b.customTypes : [];
     commitNow();

     library.hidden = true;
     workspace.hidden = true;
     bookView.hidden = false;
     bookView.scrollTop = 0;
     viewIn(bookView);
     renderBookView();
     persist();
   }

   function renderBookView() {
     const b = book();
     if (!b) return;
     $('#bvTitle').textContent = b.title || 'Без названия';
     const w = bookWords(b);
     const min = Math.ceil(w / 180);
     $('#bvDesc').textContent = b.chapters.length + ' ' + plural(b.chapters.length, 'глава', 'главы', 'глав') +
       ' · ' + fmt(w) + ' ' + plural(w, 'слово', 'слова', 'слов') +
       (w ? (' · ≈ ' + min + ' ' + plural(min, 'минута', 'минуты', 'минут') + ' чтения') : '');
     $('#bvStats').textContent = b.updated ? ('изменено ' + timeAgo(b.updated)) : '';
     bvGrid.innerHTML = '';

     b.chapters.forEach(function(ch, i) {
       const cw = chapterWords(ch);
       const card = mk('div');
       card.className = 'bv-card' + (ch.id === b.current ? ' cur' : '');
       card.style.animationDelay = (i * 45) + 'ms';
       card.setAttribute('role', 'button');
       card.tabIndex = 0;
       card.title = 'Открыть главу ' + (i + 1) + ' в редакторе';
       card.innerHTML =
         '<div class="bv-ch"><span>Глава ' + (i + 1) + '</span><b>' + fmt(cw) + '</b></div>' +
         '<div class="bv-ct"></div>' +
         '<div class="bv-ex"></div>' +
         '<div class="bv-meta">' +
         (cw ? ('≈ ' + Math.ceil(cw / 180) + ' мин чтения') : 'пустая глава') +
         (ch.id === b.current ? ' · <span class="here">вы остановились здесь</span>' : '') +
         '</div>';

       card.querySelector('.bv-ct').textContent = chapterTitle(ch);

       const exEl = card.querySelector('.bv-ex');
       const boxes = chapterExcerpt(ch, 3);
       if (!boxes.length) {
         const eb = mk('div');
         eb.className = 'bv-box';
         eb.style.fontStyle = 'italic';
         eb.textContent = 'в главе пока нет текста';
         exEl.appendChild(eb);
       }
       boxes.forEach(function(bx) {
         const d2 = mk('div');
         d2.className = 'bv-box' + (bx.sep ? ' sep' : '');
         d2.textContent = bx.text;
         exEl.appendChild(d2);
       });

       card.addEventListener('click', function() { enterEditor(ch.id); });
       card.addEventListener('keydown', function(e) { if (e.key === 'Enter') enterEditor(ch.id); });
       bvGrid.appendChild(card);
     });

     const nc = mk('button');
     nc.className = 'bv-card new';
     nc.style.animationDelay = (b.chapters.length * 45) + 'ms';
     nc.innerHTML = '<span class="nc-dia"></span><span class="nc-t">Новая глава</span>';
     nc.addEventListener('click', function() {
       const b2 = book();
       if (!b2) return;
       const n = { id: uid(), html: '<h1></h1><p></p>', pos: 0 };
       b2.chapters.push(n);
       persist();
       enterEditor(n.id);
       editor.focus();
       caretStart(editor.querySelector('h1'));
     });
     bvGrid.appendChild(nc);

     document.title = (b.title || 'Без названия') + ' — Черновик';
   }

   function enterEditor(chId) {
     const b = book();
     if (!b) return;
     b.wiki = Array.isArray(b.wiki) ? b.wiki : [];
     b.customTypes = Array.isArray(b.customTypes) ? b.customTypes : [];

     if (!b.chapters.length) {
       const c0 = { id: uid(), html: '<h1></h1><p></p>', pos: 0 };
       b.chapters.push(c0);
       b.current = c0.id;
     }
     if (chId) b.current = chId;
     if (!b.chapters.some(function(c) { return c.id === b.current; })) b.current = b.chapters[0].id;

     $('#bookTitle').value = b.title || '';
     library.hidden = true;
     bookView.hidden = true;
     workspace.hidden = false;
     viewIn(workspace);

     loadChapter(currentCh());
     renderList(true);
     updateCrumb();
     updateStats();
     persist();

     setTimeout(positionEdRz, 60);
     editor.focus();
   }

   $('#bvBack').addEventListener('click', function() {
     bookView.hidden = true;
     library.hidden = false;
     library.scrollTop = 0;
     viewIn(library);
     renderLibrary();
   });

   $('#bvOpen').addEventListener('click', function() { enterEditor(null); });

   /* ═══════════════════════════════════════════════════════════════
      БИБЛИОТЕКА
      ═══════════════════════════════════════════════════════════════ */
   function renderLibrary() {
     shelf.innerHTML = '';
     const sorted = state.books.slice().sort(function(a, b) { return (b.updated || 0) - (a.updated || 0); });
     let total = 0;

     sorted.forEach(function(b, i) {
       const w = bookWords(b);
       total += w;
       const el = mk('div');
       el.className = 'cover boot';
       el.setAttribute('role', 'button');
       el.tabIndex = 0;
       el.style.setProperty('--c', b.color || COLORS[0]);
       el.style.animationDelay = (i * 50) + 'ms';
       el.innerHTML =
         '<span class="cv-top"><span class="cv-dia"></span><span class="cv-tools">' +
         '<button class="cv-ren" title="Переименовать"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3"/></svg></button>' +
         '<button class="cv-del" title="Удалить">×</button></span></span>' +
         '<span class="cv-title"></span>' +
         '<span class="cv-rule"></span>' +
         '<span class="cv-meta"></span>' +
         '<span class="cv-time"></span>';

       el.querySelector('.cv-title').textContent = b.title || 'Без названия';
       el.querySelector('.cv-meta').innerHTML =
         '<span>' + b.chapters.length + ' ' + plural(b.chapters.length, 'глава', 'главы', 'глав') + '</span>' +
         '<span class="cv-dot"></span>' +
         '<span>' + fmt(w) + ' ' + plural(w, 'слово', 'слова', 'слов') + '</span>';
       el.querySelector('.cv-time').textContent = b.updated ? ('изменено ' + timeAgo(b.updated)) : '';

       el.addEventListener('click', function() { openBookOverview(b.id); });
       el.addEventListener('keydown', function(e) { if (e.key === 'Enter') openBookOverview(b.id); });

       el.querySelector('.cv-ren').addEventListener('click', function(e) {
         e.stopPropagation();
         const t = prompt('Название книги', b.title);
         if (t !== null) {
           b.title = t.trim() || b.title;
           b.updated = Date.now();
           persist();
           renderLibrary();
         }
       });

       el.querySelector('.cv-del').addEventListener('click', function(e) {
         e.stopPropagation();
         if (!confirm('Удалить книгу «' + (b.title || 'Без названия') + '» со всеми главами?')) return;
         state.books = state.books.filter(function(x) { return x.id !== b.id; });
         if (state.activeBookId === b.id) state.activeBookId = null;
         persist();
         renderLibrary();
       });

       shelf.appendChild(el);
     });

     const nc = mk('button');
     nc.className = 'cover new boot';
     nc.style.animationDelay = (sorted.length * 50) + 'ms';
     nc.innerHTML = '<span class="nc-dia"></span><span class="nc-t">Новая книга</span><span class="nc-h">начать рукопись</span>';
     nc.addEventListener('click', createBook);
     shelf.appendChild(nc);

     const n = state.books.length;
     $('#libStats').innerHTML = n
       ? fmt(n) + ' ' + plural(n, 'книга', 'книги', 'книг') + '<br>' + fmt(total) + ' ' + plural(total, 'слово', 'слова', 'слов') + ' во всех рукописях'
       : 'полка пуста —<br>начните первую книгу';

     document.title = 'Черновик — библиотека';
   }

   function createBook() {
     const first = { id: uid(), html: '<h1></h1><p></p>', pos: 0 };
     const b = {
       id: uid(),
       title: 'Без названия',
       color: COLORS[state.books.length % COLORS.length],
       updated: Date.now(),
       chapters: [first, { id: uid(), html: pamatkaHtml(), pos: 0 }],
       current: first.id,
       customTypes: [],
       wiki: []
     };
     state.books.push(b);
     state.activeBookId = b.id;
     persist();
     enterEditor(first.id);
     $('#bookTitle').focus();
     $('#bookTitle').select();
   }

   function viewIn(el) {
     el.classList.remove('view-in');
     void el.offsetWidth;
     el.classList.add('view-in');
   }

   function toLibrary() {
     commitNow();
     closeMenu();
     selbar.classList.remove('on');
     closeSearch();
     toggleWikiPanel(false);
     workspace.hidden = true;
     bookView.hidden = true;
     library.hidden = false;
     library.scrollTop = 0;
     viewIn(library);
     renderLibrary();
   }

   $('#btnShelf').addEventListener('click', toLibrary);

   /* ═══════════════════════════════════════════════════════════════
      ПЕЧАТЬ
      ═══════════════════════════════════════════════════════════════ */
   function buildPrintBook() {
     const pb = $('#printBook');
     pb.innerHTML = '';
     document.body.classList.toggle('pb-on', workspace.hidden === false);
     if (workspace.hidden) return;
     const b = book();
     if (!b) return;
     const cur = currentCh();
     const t = mk('div');
     t.className = 'pb-title';
     t.textContent = b.title || 'Без названия';
     pb.appendChild(t);
     b.chapters.forEach(function(ch) {
       const html = (cur && ch.id === cur.id) ? cleanHtml() : ch.html;
       const d = mk('div');
       d.className = 'pb-ch';
       d.innerHTML = html;
       pb.appendChild(d);
     });
   }

   addEventListener('beforeprint', buildPrintBook);

   /* ═══════════════════════════════════════════════════════════════
      БОКОВАЯ ПАНЕЛЬ И ТЕМЫ
      ═══════════════════════════════════════════════════════════════ */
   $('#btnSide').addEventListener('click', function() {
     if (mqMobile.matches) document.body.classList.toggle('side-open');
     else document.body.classList.toggle('side-hidden');
     setTimeout(positionEdRz, 500);
   });

   $('#veil').addEventListener('click', function() { document.body.classList.remove('side-open'); });

   $('#btnZen').addEventListener('click', toggleZen);
   $('#zenpill').addEventListener('click', toggleZen);

   function toggleZen() {
     const on = document.body.classList.toggle('zen');
     $('#btnZen').classList.toggle('on', on);
     state.zen = on;
     persist();
     if (!on) {
       zenAnchor = null;
       Array.prototype.forEach.call(editor.children, function(el) {
         el.style.opacity = '';
         el.classList.remove('lit');
       });
     }
     editor.focus();
     refreshFloats(true);
   }

   function setTheme(t) {
     document.documentElement.dataset.theme = t;
     state.theme = t;
     document.querySelectorAll('.ic-sun').forEach(function(i) { i.style.display = (t === 'light') ? '' : 'none'; });
     document.querySelectorAll('.ic-moon').forEach(function(i) { i.style.display = (t === 'dark') ? '' : 'none'; });
     persist();
   }

   document.querySelectorAll('.btn-theme').forEach(function(b) {
     b.addEventListener('click', function() {
       setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
     });
   });

   /* ═══════════════════════════════════════════════════════════════
      ЭКСПОРТ
      ═══════════════════════════════════════════════════════════════ */
   $('#btnExport').addEventListener('click', function() {
     const b = book();
     if (!b) return;
     const ch = currentCh();
     if (ch) { ch.html = cleanHtml(); ch.pos = scroller.scrollTop; }

     let out = (b.title || 'Без названия').toUpperCase() + '\n';
     b.chapters.forEach(function(c) {
       const d = tmp(c.html);
       out += '\n\n';
       d.childNodes.forEach(function(n) {
         if (n.nodeType !== 1) return;
         if (n.classList.contains('sep')) { out += '\n* * *\n\n'; return; }
         const t = n.textContent.trim();
         if (!t) return;
         if (n.tagName === 'H1') out += t + '\n\n';
         else if (n.tagName === 'H2') out += t + '\n\n';
         else out += t + '\n';
       });
     });

     persist();
     const a = mk('a');
     a.href = URL.createObjectURL(new Blob([out], { type: 'text/plain;charset=utf-8' }));
     a.download = (b.title || 'рукопись') + '.txt';
     a.click();
     setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
   });

   /* ═══════════════════════════════════════════════════════════════
      ГЛОБАЛЬНЫЕ ГОРЯЧИЕ КЛАВИШИ
      ═══════════════════════════════════════════════════════════════ */
   document.addEventListener('keydown', function(e) {
     if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
       e.preventDefault();
       scheduleSave();
     }
     if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F') && workspace.hidden === false) {
       e.preventDefault();
       searchOpen ? closeSearch() : openSearch();
       return;
     }
     if (e.key === 'Escape') {
       if ($('#wikiViewModal').classList.contains('on')) { closeWikiView(); return; }
       if ($('#wikiModal').classList.contains('on')) { closeWikiModal(); return; }
       if (searchOpen) { closeSearch(); return; }
       if ($('#wikiPanel').classList.contains('on')) { toggleWikiPanel(false); return; }
       if (!bookView.hidden) {
         bookView.hidden = true;
         library.hidden = false;
         viewIn(library);
         renderLibrary();
         return;
       }
       if (menuOpen) { closeMenu(); return; }
       if (document.body.classList.contains('zen')) toggleZen();
     }
   });

   /* ═══════════════════════════════════════════════════════════════
      ИНИЦИАЛИЗАЦИЯ
      ═══════════════════════════════════════════════════════════════ */
   setLayoutVars();
   setTheme(state.theme || 'light');
   if (state.zen) { document.body.classList.add('zen'); $('#btnZen').classList.add('on'); }
   applySpell();
   library.hidden = false;
   workspace.hidden = true;
   bookView.hidden = true;
   renderLibrary();
   saveTxt.textContent = 'Сохранено';
}

// Запуск после загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

})();
