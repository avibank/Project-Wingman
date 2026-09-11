# Wingman — the Copilot

Three files. Two are the copilot; this one says where the two attach.

```
copilot.css   the pieces the state produces
copilot.js    the state itself
COPILOT.md    this
```

**The person is your copilot. The position is the right seat.**

---

## The one rule

**The copilot is a state, not a screen.**

It gets no navigation item, no page of its own, no "sessions" view, no separate
inbox. It may only ever **add a face and a dot to chrome that already exists**, and
it may never change what a screen is or move anything on one.

Every time you are tempted to build a right-seat *place*, the answer is a smaller
addition to somewhere that already exists. That is the whole design.

Tested in a browser: taking the seat, the presence badge, the unread count, the page
pill, the rail row, the row face, sending, keeping a message, the quiz reveal and
verdict, and leaving — all with no console errors, and the chat correctly emptied on
leaving.

---

## What attaches where

Five mounts. Nothing else changes.

### 1 · The profile circle — every screen

The pair lives in whatever the screen already puts in the top-right. On the site
that is the round profile button; in the papers reader it is the island. Same
component either way.

```html
<!-- your existing markup, with one class and one wrapper -->
<div class="cp-crew" id="crew">
  <button class="pfp">…your profile button, untouched…</button>
</div>
```

```js
Copilot.mountCrew(document.getElementById('crew'));
```

The module appends the copilot's face itself and keeps it in sync. When the seat is
empty the face is not just hidden — it collapses to zero width and takes no space,
so the header is byte-for-byte what it is today.

Set `--cp-size` on `.cp-crew` if your slot is not 52px. The reader's island uses 26px.

### 2 · The radar, on the Flight Deck

You already have an instrument whose caption says *the Ready Room finds you company*.
That is the copilot's home on the deck. It gains a blip; nothing else moves.

```js
Copilot.mountBlip(radarScopeEl, radarCaptionEl);
```

Swap the caption text yourself when seated — `AHMAD IS IN YOUR RIGHT SEAT.` — the
module only adds `.cp-radar-cap` so the caption takes the presence colour.

The formation card in **Back on the ground** takes a second route line and a second
row. Use `.cp-route`, `.cp-route-dot` and `.cp-who-av` on the elements you already
render for yourself.

### 3 · The Right Seat section of the Ready Room rail

The section header already exists. When the seat is filled, render
`Copilot.railRow()` in place of the "You haven't flown with anyone yet" block and
the two Find buttons.

```js
railSection.innerHTML = Copilot.state.peer
  ? Copilot.railRow({ rowClass: 'rrow', avatarClass: 'sq' })   // your own row classes
  : emptyStateYouAlreadyHave;
```

It reuses **your** row markup — pass the class names in — and only adds the presence
avatar, the live dot and the where-they-are line. Pressing it fires `data-cp-open="seat"`;
open the seat in the main pane, which already changes shape between threads and
squadron chat.

### 4 · A list row's status column

On the module screen, a lesson, paper or quiz row shows their face when they are in
it. The row does not change. Drop this into the column where Master Caution and the
Resume pill already live:

```js
row.querySelector('.act').insertAdjacentHTML('afterbegin', Copilot.rowFace('paper:m1c1'));
```

`rowFace(id)` returns the face only when `Copilot.state.where.screen === id`, and an
empty string otherwise. Give each row a stable id and send the same id in the
`where` event.

### 5 · The paper

Two pieces, both in the reader's own chrome.

```js
Copilot.atPage(pillEl, page => pageRectFor(page));   // "he is on 0131", down the edge
```

And their selection, drawn as one box per line, exactly like a mark:

```html
<span class="cp-sel cp-on" data-who="AH" style="left:…;top:…;width:…;height:…"></span>
```

A mark of theirs arriving gets `.cp-land` for one pulse, then it is an ordinary mark.

**Their cursor is deliberately not shown.** A drifting pointer is noise; a selected
sentence is them saying "this bit".

### 6 · The chat

Not a window. It goes in a surface the screen already has — the Ready Room's main
pane, and the reader's panel as a third tab beside Marks and Pages.

```js
Copilot.mountChat(paneEl);
```

The module renders the ephemeral notice, the messages, the composer and the
**keep this** control. Keeping fires a `kept` event with the text; you decide where
it lands — a note on the current page, or a card in the revision deck. That is the
only bridge out of a chat that does not persist.

---

## The transport

The module never opens a connection. You give it one.

```js
Copilot.init({
  me: { id, name, initials },
  transport: {
    onEvent(fn) { socket.on('copilot', fn); },   // hand the module inbound events
    join(peerId) { … }, leave(peerId) { … },
    send(text) { … }, answer(qi, choice) { … }
  }
});
```

Inbound events it understands:

| type | carries | what it does |
|---|---|---|
| `request` | who | fires `request` — **you** show the invite. It does not join |
| `where` | `{screen, label, page}` | updates where *they* are |
| `opened` | what they opened | fires `opened` — **you** show the invite |
| `mark` `ink` `select` | the thing | fires the event; you draw it |
| `message` | `{text, looking}` | appends, counts unread if you are not looking at the chat |
| `answer` | `{qi, choice}` | pass to `Copilot.quizTheirs(choice)` |
| `left` `gone` `back` | — | leaves, or shows reconnecting |

**One event may ever move the page: none of them.** An arrival is an invitation
hanging off their face. The student decides.

Subscribe to everything the module wants to say:

```js
Copilot.on((state, ev) => {
  if (!ev) return render(state);
  if (ev.say === 'request') showInvite(anchorFace, `${ev.name} wants the right seat.`, () => Copilot.take(ev.peer));
  if (ev.say === 'opened')  showInvite(anchorFace, `${name} opened ${ev.what}.`,      () => goTo(ev.href));
  if (ev.say === 'warn')    announce('Still flying? The seat empties in five minutes.');
  if (ev.say === 'left')    announce(ev.data.by === 'idle' ? 'The seat emptied.' : '…');
  if (ev.say === 'kept')    saveAsNote(ev.data.text);
});
```

---

## The hour

The seat empties itself after **60 minutes** with nothing happening from either of
you, and warns at **55**. Any pointer, key or scroll resets it, as does any event
from them. This is in the module — you do not need to build it — but you do need to
render the two announcements.

---

## The quiz, flown together

The rule that matters: **neither of you sees the other until both are locked in.**

Accuracy feeds the chop gauge, Master Caution, the calibration tag and the revision
deck. If the answer can be discussed while it is being given, every one of those is
reporting a number that is not true. So the discussion strip opens *after* the
reveal and closes again on the next question.

```js
Copilot.quizStart(count);
Copilot.quizPick(i);           // you answered
Copilot.quizTheirs(i);         // from the transport
const v = Copilot.quizVerdict(correctIndex);
// v.line  what to print
// v.cls   cp-agree | cp-split | cp-neither
// v.deck  true → add to this student's revision deck
// v.flag  true → both picked the SAME wrong answer; count it as a question
//         the class trips on. Aggregate only, nobody named.
```

Because both answered alone, both scores count normally. No asterisk.

Render each option's picks with `Copilot.picksHTML(i)` inside the option you already
have. The `data-cp-phase` attribute on `<html>` drives the reveal styling and opens
the discussion strip.

---

## What the server owes this

- **A pairing only between people who share a squadron.** That rule already exists.
- **The chat is never stored.** It exists in memory for the length of the seat.
  The one exception: when someone **reports** a session, the client uploads that
  transcript at that moment and only then. Decide this now — if nothing is stored
  and nothing is uploaded on report, a report has nothing behind it.
- **Red marks never cross.** A private revise flag is not sent to the copilot, not
  counted in class heat, not in any payload the other side receives. Filtering it in
  the client is not enough.
- **A kept message becomes an ordinary note**, owned by the student who kept it.
- **Idle-out is agreed on the server too**, so both ends end at the same moment.

---

## Things that will look like bugs and are not

**The face takes no space when the seat is empty.** It is not `display:none` — it is
collapsed with a negative margin so it animates in. The header is unchanged either way.

**Presence is teal, and teal is not a mark colour.** Amber, blue, green, violet and
red all mean something. If presence shared one of them, "Ahmad is here" and "this is
a definition" would look like the same statement.

**Nothing follows anyone by default.** You each scroll freely; the pill tells you
where they are and `Copilot.setFollow(true)` is opt-in. Scrolling breaks it — that
is `setFollow(false)` from your scroll handler, not a bug.

**Ink arrives on release, not point by point.** A finished stroke is one small
message; streaming hundreds of points is where this gets expensive and janky. Send
the whole stroke.

**A dropped connection shows as reconnecting, not as leaving.** Do not remove the
face on a socket drop — `gone` and `back` exist for exactly this.

---

## Order to build it

1. `Copilot.init` with a stubbed transport that does nothing. Mount the crew slot.
   Confirm the header is identical when the seat is empty.
2. The Ready Room rail row and taking the seat from the Find button.
3. The invite pattern, once, and reuse it for everything.
4. The chat and `keep this`.
5. The paper: the page pill, their selection, their marks.
6. The quiz.
7. The radar blip and the formation card — smallest payoff, do it last.
