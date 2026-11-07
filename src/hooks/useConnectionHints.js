import { useEffect, useState } from 'react';

function readHints() {
  if (typeof navigator === 'undefined') {
    return { saveData: false, effectiveType: '' };
  }
  const connection = navigator.connection;
  return {
    saveData: !!connection?.saveData,
    effectiveType: connection?.effectiveType || '',
  };
}

// Suggerimenti del browser per ridurre rete e memoria su dispositivi
// modesti. Non sono una misura affidabile: solo un'euristica per evitare
// preload aggressivi quando l'utente ha chiesto risparmio dati.
export function useConnectionHints() {
  const [hints, setHints] = useState(readHints);

  useEffect(() => {
    const connection = navigator.connection;
    if (!connection?.addEventListener) return undefined;
    const update = () => setHints(readHints());
    connection.addEventListener('change', update);
    return () => connection.removeEventListener('change', update);
  }, []);

  return hints;
}
