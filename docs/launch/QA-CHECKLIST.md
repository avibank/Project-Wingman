# Launch checklist

## Wiring
- [ ] Every button reaches a real screen or action
- [ ] No placeholder toasts left (grep for "Opens", "Demo", "coming soon")
- [ ] Ready Room, squadron chat, module threads, quiz and paper reader links all work
- [ ] Library shows all three sections: Quizzes, Study cards, Papers — chips and search filter all three
- [ ] "Test yourself" opens the card set; keeping a card lands it in Bookmarks -> Study cards
- [ ] Crew tab opens and shows its explained empty state when nobody else is on the module

## States
- [ ] Empty: no squadron / nobody on module / no papers / no notes / no stamp / new account
- [ ] Loading and error states on every fetch, with retry
- [ ] Long names, long titles, crowded chapter walls (100+ stamps)

## Rules
- [ ] Stamp can't be changed once issued (server enforced)
- [ ] Code, callsign, rim text and bio validated server-side
- [ ] A student can only edit their own card
- [ ] Fly solo actually hides them everywhere
- [ ] Crew shows chapter level only — never a lesson or a score

## Look
- [ ] 390 / 768 / 1280 / 1600px
- [ ] 6 liveries x 3 finishes x light/dark
- [ ] Reduced motion (Smooth Air) turns the stamp animations off
- [ ] Matches the reference builds side by side

## Health
- [ ] Console clean
- [ ] Uploads: type and size limits, resizing, old file cleanup
- [ ] Stamp SVGs cached per user; filter ids unique
- [ ] Unit tests: every shape x pattern x rim state renders; validation
- [ ] E2E: sign off a lesson; create and issue a stamp; take a note and jump to it
