import { LoaderCircle } from 'lucide-react';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <span className="loading-state" role="status"><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />{label}</span>;
}
