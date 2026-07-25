import { useEffect, useState } from 'react';

// Hook minimale per sapere se il browser è online, con aggiornamento in
// tempo reale tramite gli eventi nativi 'online'/'offline'. Usato per
// mostrare un piccolo avviso non invasivo invece di liste vuote silenziose
// quando manca la connessione.
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
