/* Public surface of the Bookmarks feature.

   The pack shipped a react-router route table here. This app has none — its
   router is a pure parser (src/lib/routes.js) and App.jsx switches on the
   parsed name — so the routes live there instead:

     /bookmarks            -> { name: "bookmarks", folder: null }
     /bookmarks/:folder    -> { name: "bookmarks", folder }   (four slugs; anything else redirects)
     /m/:module/library/cards/:chapter -> { name: "cards", moduleCode, chapter }
     /settings, /saved     -> redirect to /bookmarks

   Two entry points rather than one, and the split is deliberate:
   `deck.js` is what the Flight Deck imports EAGERLY (the bag and its count, on
   the first screen), and `screens.jsx` is the lazy chunk with everything else.
   Import from those, not from here, so nothing drags the folder pages into the
   entry chunk by accident. */
export { default as BookmarksScreens } from './screens.jsx';
export { FlightBag, useSavesCount } from './deck.js';
export { default as LibraryStudyCards } from './LibraryStudyCards.jsx';
export { default as SaveButton } from './SaveButton.jsx';
export { BookmarksToastHost } from './Toast.jsx';
export { toast } from './toastBus.js';
export { initSaves, resetSaves, addMany } from './savesStore';
export { provideContent, providePapers } from './content.js';
export { provideNav } from './nav.jsx';
