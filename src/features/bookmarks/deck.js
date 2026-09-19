/* What the Flight Deck needs, and only that. The bag is on the first screen,
   so it is imported eagerly; everything else in this feature is behind the
   lazy chunk in screens.jsx. Keeping the eager surface to one named export is
   what stops the folder pages drifting into the entry chunk. */
export { default as FlightBag } from './FlightBag.jsx';

/* The same count the bag shows, for the Manual finish's drawn strip. One
   source: the Flight Deck's instrument and its paper twin cannot disagree
   about how many things are in the bag. */
export { useSavesCount } from './useSaves.js';
