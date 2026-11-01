import { useState } from 'react';
import { UserRound } from 'lucide-react';

export function ProfileAvatar({ name, url = '', large = false }: { name: string; url?: string; large?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <span className={`profile-avatar ${large ? 'profile-avatar-large' : ''}`}>
    {url && failedUrl !== url
      ? <img src={url} alt={`${name}'s profile`} referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
      : <UserRound size={large ? 32 : 19} strokeWidth={1.3} aria-label={`${name}'s profile`} />}
  </span>;
}
