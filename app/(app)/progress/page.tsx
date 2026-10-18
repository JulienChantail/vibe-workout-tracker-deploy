import { getCurrentUser } from '../../../lib/session';
import ProgressView from './ProgressView';

export default async function ProgressPage() {
  const user = await getCurrentUser();

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Progression</h1>
      <ProgressView currentUserId={user!.id} />
    </div>
  );
}
