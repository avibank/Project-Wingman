/* THE LAZY ENTRY. One chunk holds all three Bookmarks screens, because they
   share the store, the adapter, the study pad and the whole stylesheet — split
   apart, most of it would come down the wire twice.
   This app has no route table (src/lib/routes.js is a parser), so the parsed
   route is handed in and this picks the screen. */
import BookmarksPage from './BookmarksPage';
import FolderPage from './FolderPage';
import CardSetPage from './CardSetPage';

export default function BookmarksScreens({ route }) {
  if (route?.name === 'cards') return <CardSetPage moduleId={route.moduleCode} chapter={route.chapter} />;
  if (route?.folder) return <FolderPage slug={route.folder} />;
  return <BookmarksPage />;
}
