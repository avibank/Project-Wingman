/* ===========================================================================
   WINGMAN — COPILOT
   copilot.js

   One module. It owns the state of the right seat and hands you the small
   pieces of DOM that state produces. It renders nothing on its own and it
   never navigates — the copilot is a state, not a screen.

   Framework-agnostic on purpose: it is plain DOM and a subscribe callback,
   so it drops into whatever the site is built with.

       Copilot.init({ me, transport })
       Copilot.on(fn)                    → called on every state change
       Copilot.mountCrew(el)             → the pair, in your profile-circle slot
       Copilot.mountBlip(radarEl, capEl) → the deck's radar
       Copilot.railRow()                 → HTML for the Right Seat rail row
       Copilot.rowFace(where)            → HTML for a list row's status column
       Copilot.chat(el)                  → the seat chat, in a surface you own
       Copilot.atPage(el, rectOf)        → the "he is on 0131" pill on the paper
       Copilot.state                     → read it, never write it

   Root attributes it sets, which the stylesheet reads:
       data-cp-seat   "0" | "1"
       data-cp-phase  "pick" | "reveal"     (quiz only)
   =========================================================================== */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Copilot = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';

/* the seat empties itself after an hour with nothing happening.
   Warn at 55 minutes so it is never a surprise. */
var IDLE_MS = 60 * 60 * 1000;
var WARN_MS = 55 * 60 * 1000;

var S = {
  me: null,          // { id, name, initials }
  peer: null,        // { id, name, initials, licence, modules } | null while empty
  where: null,       // { screen, label, page }  where THEY are, not where you are
  follow: false,
  unread: 0,
  chat: [],          // [{ from:'me'|'peer', text, at, kept }]  never persisted
  connection: 'ok',  // 'ok' | 'reconnecting'
  quiz: null         // { qi, mine, theirs, phase }
};

var subs = [];
var tx = null;
var idleT = null, warnT = null;
var els = { crew: null, blip: null, cap: null, atPage: null, chat: null };
var root = document.documentElement;

/* ── plumbing ────────────────────────────────────────────────────────── */
function emit() {
  root.setAttribute('data-cp-seat', S.peer ? '1' : '0');
  paintCrew(); paintChat(); paintAtPage();
  for (var i = 0; i < subs.length; i++) { try { subs[i](S); } catch (e) {} }
}
function on(fn) { subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ── the hour ────────────────────────────────────────────────────────── */
function touch() {
  if (!S.peer) return;
  clearTimeout(idleT); clearTimeout(warnT);
  warnT = setTimeout(function () { say('warn'); }, WARN_MS);
  idleT = setTimeout(function () { leave('idle'); }, IDLE_MS);
}
['pointerdown', 'keydown', 'wheel'].forEach(function (e) {
  addEventListener(e, function () { if (S.peer) touch(); }, { passive: true });
});

/* Anything the host wants to announce goes through here, so the reader's
   island and the rest of the site say the same things in the same words. */
function say(kind, data) {
  for (var i = 0; i < subs.length; i++) {
    try { subs[i](S, { say: kind, data: data }); } catch (e) {}
  }
}

/* ── taking and leaving the seat ─────────────────────────────────────── */
function take(peer) {
  S.peer = peer;
  S.where = { screen: 'deck', label: 'on the flight deck', page: null };
  S.chat = []; S.unread = 0; S.follow = false; S.connection = 'ok';
  touch(); emit(); say('joined');
  if (tx && tx.join) tx.join(peer.id);
}
function leave(by) {
  clearTimeout(idleT); clearTimeout(warnT);
  var was = S.peer;
  S.peer = null; S.where = null; S.follow = false;
  S.chat = []; S.unread = 0; S.quiz = null;     /* the chat does not outlive the seat */
  emit(); say('left', { by: by || 'you' });
  if (tx && tx.leave && by !== 'peer') tx.leave(was && was.id);
}

/* ── what the other side tells us ────────────────────────────────────── */
/* The host calls this with whatever comes off its transport. Nothing here
   ever moves the page: an arrival is an invitation, never a navigation. */
function receive(ev) {
  if (!S.peer && ev.type !== 'request') return;
  touch();
  switch (ev.type) {
    case 'request':  say('request', ev); break;          /* host shows the invite */
    case 'where':    S.where = ev.where; emit(); break;
    case 'opened':   say('opened', ev); break;           /* host shows the invite */
    case 'mark':     say('mark', ev); break;
    case 'ink':      say('ink', ev); break;              /* a whole stroke, on release */
    case 'select':   say('select', ev); break;
    case 'message':
      S.chat.push({ from: 'peer', text: ev.text, at: now() });
      if (!ev.looking) { S.unread++; say('message', ev); }
      emit(); break;
    case 'answer':   say('answer', ev); break;
    case 'left':     leave('peer'); break;
    case 'gone':     S.connection = 'reconnecting'; emit(); break;
    case 'back':     S.connection = 'ok'; emit(); say('back'); break;
  }
}

/* ── chat ────────────────────────────────────────────────────────────── */
function send(text) {
  if (!S.peer || !text || !text.trim()) return;
  S.chat.push({ from: 'me', text: text.trim(), at: now() });
  touch(); emit();
  if (tx && tx.send) tx.send(text.trim());
}
function seen() { S.unread = 0; emit(); }
/* the one bridge out of a disposable chat. The host decides where a kept
   message lands — a note on the paper, a card in the revision deck. */
function keep(i) {
  var m = S.chat[i];
  if (!m || m.kept) return null;
  m.kept = true; emit();
  say('kept', { text: m.text });
  return m.text;
}

function setFollow(v) { S.follow = !!v; touch(); emit(); say(v ? 'following' : 'unfollowed'); }

/* ── the pieces ──────────────────────────────────────────────────────── */
function mountCrew(el) { els.crew = el; paintCrew(); }
function paintCrew() {
  var el = els.crew; if (!el) return;
  var m = el.querySelector('.cp-mate');
  if (!S.peer) { if (m) { m.setAttribute('data-n', ''); m.removeAttribute('data-n'); } return; }
  if (!m) {
    m = document.createElement('button');
    m.className = 'cp-mate';
    m.type = 'button';
    m.innerHTML = '<span class="cp-init"></span><span class="cp-live"></span>' +
                  '<span class="cp-n"></span>';
    m.addEventListener('click', function (e) { e.stopPropagation(); say('menu', { anchor: m }); });
    el.appendChild(m);
  }
  m.querySelector('.cp-init').textContent = S.peer.initials;
  m.setAttribute('aria-label', S.peer.name + ' — your copilot');
  m.setAttribute('data-cp-state', S.connection === 'ok' ? 'ok' : 'reconnecting');
  var n = m.querySelector('.cp-n');
  if (S.unread) { n.dataset.n = S.unread; n.textContent = S.unread; }
  else n.removeAttribute('data-n');
}

/* the deck's radar gains a blip. The instrument is already there. */
function mountBlip(radarEl, capEl) {
  els.blip = radarEl; els.cap = capEl;
  if (radarEl && !radarEl.querySelector('.cp-blip')) {
    var b = document.createElement('span');
    b.className = 'cp-blip';
    radarEl.appendChild(b);
  }
  if (capEl) capEl.classList.add('cp-radar-cap');
  on(function () {
    if (!els.blip) return;
    var b = els.blip.querySelector('.cp-blip');
    if (b) b.textContent = S.peer ? S.peer.initials : '';
  });
}

/* the Right Seat section of the Ready Room rail, when it is filled.
   Return this instead of the empty state — same row markup as the rest. */
function railRow(opts) {
  if (!S.peer) return '';
  var cls = (opts && opts.rowClass) || 'rrow';
  var avCls = (opts && opts.avatarClass) || 'sq';
  return '<button class="' + cls + '" data-cp-open="seat">' +
    '<span class="' + avCls + ' cp-rail-av">' + esc(S.peer.initials) +
      '<span class="cp-live"></span></span>' +
    '<span class="tx"><b>' + esc(S.peer.name) + '</b>' +
      '<span class="cp-where">' + esc(whereLabel()) + '</span></span>' +
    '<span class="rt"><em>now</em>' + (S.unread ? '<b>' + S.unread + '</b>' : '') + '</span>' +
  '</button>';
}

/* a list row's status column. `where` is the row's own id, e.g. 'paper:m1c1'. */
function rowFace(where) {
  if (!S.peer || !S.where || S.where.screen !== where) return '';
  return '<span class="cp-here" title="' + esc(S.peer.name) + ' is here">' +
         esc(S.peer.initials) + '</span>';
}

/* the pill on the paper that says which page they are on */
function atPage(el, rectOf) {
  els.atPage = el; els.atPageRect = rectOf;
  el.addEventListener('click', function () { say('goto', { page: S.where && S.where.page }); });
  paintAtPage();
}
function paintAtPage() {
  var el = els.atPage; if (!el) return;
  if (!S.peer || !S.where || !S.where.page) { el.classList.remove('cp-on'); return; }
  el.classList.add('cp-on');
  el.innerHTML = '<i>' + esc(S.peer.initials) + '</i><span>' + pad(S.where.page) + '</span>';
  if (els.atPageRect) {
    var r = els.atPageRect(S.where.page);
    if (r) el.style.top = Math.min(innerHeight - 46, Math.max(84, r.top + 20)) + 'px';
  }
}
function pad(n) { return String(n).padStart(4, '0'); }

/* the seat chat, rendered into a surface the host already has */
function mountChat(el) { els.chat = el; paintChat(); }
function paintChat() {
  var el = els.chat; if (!el || !S.peer) return;
  var atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  el.innerHTML =
    '<div class="cp-eph"><span><b>This chat lives in the seat.</b> It is gone when one of ' +
      'you gets up — keep anything worth keeping and it becomes a note.</span></div>' +
    '<div class="cp-chat"><div class="cp-msgs">' +
      S.chat.map(function (m, i) {
        return '<div class="cp-bub ' + (m.from === 'me' ? 'cp-mine' : 'cp-them') + '">' +
          esc(m.text) + '<time>' + esc(m.at) + '</time>' +
          (m.from === 'peer'
            ? '<button class="cp-keep" type="button" data-cp-keep="' + i + '"' +
              (m.kept ? ' data-kept' : '') + '>' + (m.kept ? 'kept' : 'keep this') + '</button>'
            : '') +
        '</div>';
      }).join('') +
    '</div>' +
    '<div class="cp-compose"><input data-cp-input placeholder="Message ' +
      esc(S.peer.name.split(' ')[0]) + '">' +
      '<button type="button" data-cp-send aria-label="Send">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 12h15M12.6 5.4L19.2 12l-6.6 6.6"/></svg></button></div></div>';
  var msgs = el.querySelector('.cp-msgs');
  if (msgs && atBottom) msgs.scrollTop = msgs.scrollHeight;
  var input = el.querySelector('[data-cp-input]');
  var go = function () { if (input) { send(input.value); input.value = ''; } };
  el.querySelector('[data-cp-send]').addEventListener('click', go);
  if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  el.addEventListener('click', function (e) {
    var k = e.target.closest && e.target.closest('[data-cp-keep]');
    if (k) keep(+k.getAttribute('data-cp-keep'));
  });
  seenIfVisible(el);
}
function seenIfVisible(el) {
  if (!S.unread) return;
  if (el.offsetParent !== null) seen();
}

function whereLabel() {
  if (!S.where) return '';
  return S.where.label || '';
}

/* ── the quiz, flown together ────────────────────────────────────────── */
/* Neither of you sees the other until both are locked in. That is what keeps
   the score honest, and the score feeds accuracy, Master Caution and the deck. */
function quizStart(count) { S.quiz = { qi: 0, mine: null, theirs: null, phase: 'pick', count: count };
  root.setAttribute('data-cp-phase', 'pick'); emit(); }
function quizPick(i) {
  if (!S.quiz || S.quiz.phase === 'reveal') return;
  S.quiz.mine = i; touch(); emit();
  if (tx && tx.answer) tx.answer(S.quiz.qi, i);
  if (S.quiz.theirs !== null) quizReveal();
}
function quizTheirs(i) {
  if (!S.quiz || S.quiz.phase === 'reveal') return;
  S.quiz.theirs = i; emit();
  if (S.quiz.mine !== null) quizReveal();
}
function quizReveal() {
  S.quiz.phase = 'reveal';
  root.setAttribute('data-cp-phase', 'reveal');
  emit(); say('reveal');
}
function quizNext() {
  if (!S.quiz) return;
  S.quiz.qi++; S.quiz.mine = null; S.quiz.theirs = null; S.quiz.phase = 'pick';
  root.setAttribute('data-cp-phase', 'pick'); emit();
}
/* what the reveal says. Both answered alone, so both scores count normally. */
function quizVerdict(correct) {
  var q = S.quiz; if (!q) return null;
  var me = q.mine === correct, them = q.theirs === correct;
  if (me && them)   return { cls: 'cp-agree',   line: 'You both had it.', deck: false, flag: false };
  if (me && !them)  return { cls: 'cp-split',   line: 'You had it, ' + first() + ' did not.', deck: false, flag: false };
  if (!me && them)  return { cls: 'cp-split',   line: first() + ' had it, you did not.', deck: true,  flag: false };
  return { cls: 'cp-neither',
           line: q.mine === q.theirs ? 'You both picked the same wrong answer.' : 'Neither of you had it.',
           deck: true, flag: q.mine === q.theirs };
}
function first() { return S.peer ? S.peer.name.split(' ')[0] : 'They'; }

function picksHTML(i) {
  if (!S.quiz) return '';
  var reveal = S.quiz.phase === 'reveal';
  return '<span class="cp-picks">' +
    '<span class="cp-pick cp-them' + (reveal && S.quiz.theirs === i ? ' cp-on' : '') + '">' +
      esc(S.peer ? S.peer.initials : '') + '</span>' +
    '<span class="cp-pick cp-me' + (S.quiz.mine === i ? ' cp-on' : '') + '">' +
      esc(S.me ? S.me.initials : '') + '</span></span>';
}

/* ── init ────────────────────────────────────────────────────────────── */
function init(o) {
  S.me = o.me;
  tx = o.transport || null;
  if (tx && tx.onEvent) tx.onEvent(receive);
  root.setAttribute('data-cp-seat', '0');
  return API;
}

var API = {
  init: init, on: on, state: S,
  take: take, leave: leave, receive: receive,
  send: send, seen: seen, keep: keep, setFollow: setFollow,
  mountCrew: mountCrew, mountBlip: mountBlip, mountChat: mountChat, atPage: atPage,
  railRow: railRow, rowFace: rowFace, picksHTML: picksHTML,
  quizStart: quizStart, quizPick: quizPick, quizTheirs: quizTheirs,
  quizNext: quizNext, quizVerdict: quizVerdict,
  where: whereLabel
};
return API;
}));
