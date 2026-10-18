import TemplatesManager from './TemplatesManager';

export default function TemplatesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Séances préenregistrées</h1>
      <TemplatesManager />
    </div>
  );
}
