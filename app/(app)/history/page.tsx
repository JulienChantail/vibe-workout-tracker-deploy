import { getCurrentUser } from '../../../lib/session';
import HistoryView from './HistoryView';

export default async function HistoryPage() {
  const user = await getCurrentUser();

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Historique des séances</h1>
      <HistoryView currentUserId={user!.id} />
    </div>
  );
}
