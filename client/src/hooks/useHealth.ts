import { useEffect, useState } from 'react';
import { getHealth } from '../services/api';

export function useHealth() {
  const [status, setStatus] = useState<'loading' | 'available' | 'unavailable'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal).then(result => {
      if (!controller.signal.aborted) setStatus(result.status === 'ok' ? 'available' : 'unavailable');
    }).catch(() => { if (!controller.signal.aborted) setStatus('unavailable'); });
    return () => controller.abort();
  }, []);
  return status;
}
