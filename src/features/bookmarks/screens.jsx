/* THE LAZY ENTRY. One chunk holds all three Bookmarks screens, because they
   share the store, the adapter, the study pad and the whole stylesheet — split
   apart, most of it would come down the wire twice.
   This app has no route table (src/lib/routes.js is a parser), so the parsed
   route is handed in and this picks the screen. */
import BookmarksPage from './BookmarksPage';
import FolderPage from './FolderPage';
import CardSetPage from './CardSetPage';
import CardSessionPage from '../../components/module/library/CardSessionPage.jsx';
import { useFlags } from '../../lib/flags.js';

export default function BookmarksScreens({ route, onCloseCards }) {
  const { flags } = useFlags();
  /* THE PORTED SESSION REPLACES THE OLD CARDS PAGE, behind the same flag as
     the rest of the module screen (§2: "Study cards → Demo study-card session
     (#deck). Replaces the old cards page"). A branch rather than a deletion
     while the flag is admin-only: `CardSetPage` is what every student still
     opens, and it keeps working until the flag goes to everyone. */
  if (route?.name === 'cards' && flags?.['library.batches']) {
    return <CardSessionPage moduleId={route.moduleCode} chapter={route.chapter} onClose={onCloseCards} />;
  }
  if (route?.name === 'cards') return <CardSetPage moduleId={route.moduleCode} chapter={route.chapter} />;
  if (route?.folder) return <FolderPage slug={route.folder} />;
  return <BookmarksPage />;
}
