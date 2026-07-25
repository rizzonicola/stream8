import React, { memo, useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  CircularProgress,
  Box,
  IconButton,
  Badge,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import { MAINSTREAM_SERVICES, MAINSTREAM_TMDB_PROVIDER_NAMES } from '../utils/streamingServices';
import { fetchWatchProviders } from '../api/tmdb';
import { searchAnilistMedia } from '../api/anilist';
import { pickPatternForItem, patternNeedsAnilist } from '../utils/customConfigParser';
import { t } from '../i18n';

// Piccola funzione pura (non dipende dallo stato del componente): tenerla
// fuori evita di ricrearla ad ogni render.
function renderAvatar(svc, isUnavailable, isResolving, bgColor) {
  if (isResolving) {
    return (
      <Avatar sx={{ bgcolor: 'action.disabledBackground' }}>
        <CircularProgress size={18} />
      </Avatar>
    );
  }
  const avatar = (
    <Avatar sx={{ bgcolor: isUnavailable ? 'error.main' : bgColor, fontSize: 13 }}>
      {svc.name[0]}
    </Avatar>
  );
  if (!isUnavailable) return avatar;
  return (
    <Badge
      overlap="circular"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      badgeContent={<ErrorRoundedIcon sx={{ fontSize: 14, color: 'error.main' }} />}
    >
      {avatar}
    </Badge>
  );
}

/**
 * WatchOnDialog
 * -------------
 * Mostra i servizi attivi dell'utente.
 *  - Servizi mainstream: la disponibilità (TMDb /watch/providers) è già
 *    nota da un'unica chiamata fatta all'apertura del dialog, quindi le
 *    icone dei servizi NON disponibili appaiono subito rosse, senza dover
 *    cliccarle per scoprirlo. Se disponibile, il click usa il link "watch"
 *    di TMDb (JustWatch) per quella regione quando presente — il modo più
 *    vicino a un deep-link reale che una API pubblica di metadata possa
 *    offrire. Nessuna chiamata TMDb viene fatta se l'utente non ha
 *    selezionato alcun servizio mainstream.
 *  - Servizi custom: se il pattern richiede {anilist_id}/{mal_id}, l'ID
 *    viene risolto al volo tramite l'API pubblica di AniList solo al
 *    click (mai in anticipo). Se la risoluzione fallisce, la stessa icona
 *    rossa segnala il problema.
 */
function WatchOnDialog({ open, onClose, lang, item, settings, onConfirmWatch }) {
  const [providerData, setProviderData] = useState({ names: [], link: null });
  const [loading, setLoading] = useState(true);
  // Usato solo per i servizi custom: la loro disponibilità non è nota in
  // anticipo (dipende da una risoluzione AniList fatta al click).
  const [customUnavailableIds, setCustomUnavailableIds] = useState(() => new Set());
  const [resolvingId, setResolvingId] = useState(null);

  const mainstreamActive = MAINSTREAM_SERVICES.filter((s) =>
    settings.selectedMainstream.includes(s.id)
  );
  const customActive = settings.customServices;

  useEffect(() => {
    if (!open || !item) return;
    setCustomUnavailableIds(new Set());

    if (mainstreamActive.length === 0) {
      // Nessun servizio mainstream selezionato: nessuna chiamata TMDb da
      // fare, evitando una richiesta di rete completamente inutile.
      setProviderData({ names: [], link: null });
      setLoading(false);
      return;
    }

    setLoading(true);
    const tmdbType = item.mediaType === 'anime' ? 'tv' : item.mediaType;
    fetchWatchProviders(item.id, tmdbType)
      .then(setProviderData)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  if (!item) return null;

  const isMainstreamAvailable = (svc) => {
    const names = MAINSTREAM_TMDB_PROVIDER_NAMES[svc.id] || [];
    return names.some((n) => providerData.names.includes(n));
  };

  const handlePickMainstream = (svc) => {
    if (!isMainstreamAvailable(svc)) return; // già segnalato in rosso, nessuna azione
    onConfirmWatch({ kind: 'mainstream', service: svc, item, watchLink: providerData.link });
  };

  const handlePickCustom = async (svc) => {
    const pattern = pickPatternForItem(svc.config, item);
    if (!patternNeedsAnilist(pattern)) {
      // Nessuna risoluzione esterna necessaria: nessuna richiesta di rete
      // aggiuntiva, come deve essere quando questa funzione non serve.
      onConfirmWatch({ kind: 'custom', service: svc, item });
      return;
    }

    setResolvingId(svc.id);
    const anilist = await searchAnilistMedia(item.title, item.year ? Number(item.year) : undefined);
    setResolvingId(null);

    if (!anilist) {
      setCustomUnavailableIds((prev) => new Set(prev).add(svc.id));
      return;
    }
    onConfirmWatch({ kind: 'custom', service: svc, item, anilist });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {t(lang, 'watch_on_dialog_title')}
        <IconButton onClick={onClose} size="small">
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ minHeight: 160 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <List disablePadding>
            {mainstreamActive.map((svc) => {
              const isUnavailable = !isMainstreamAvailable(svc);
              return (
                <ListItemButton
                  key={svc.id}
                  onClick={() => handlePickMainstream(svc)}
                  disabled={isUnavailable}
                  sx={{ borderRadius: 2, mb: 0.5, opacity: isUnavailable ? 0.7 : 1 }}
                >
                  <ListItemAvatar>{renderAvatar(svc, isUnavailable, false, svc.color)}</ListItemAvatar>
                  <ListItemText
                    primary={svc.name}
                    secondary={isUnavailable ? t(lang, 'watch_on_not_found') : undefined}
                    secondaryTypographyProps={{ color: 'error.main' }}
                  />
                </ListItemButton>
              );
            })}
            {customActive.map((svc) => {
              const isUnavailable = customUnavailableIds.has(svc.id);
              const isResolving = resolvingId === svc.id;
              return (
                <ListItemButton
                  key={svc.id}
                  onClick={() => handlePickCustom(svc)}
                  disabled={isResolving}
                  sx={{ borderRadius: 2, mb: 0.5 }}
                >
                  <ListItemAvatar>
                    {renderAvatar(svc, isUnavailable, isResolving, 'secondary.main')}
                  </ListItemAvatar>
                  <ListItemText
                    primary={svc.name}
                    secondary={isUnavailable ? t(lang, 'watch_on_not_found') : svc.baseUrl}
                    secondaryTypographyProps={isUnavailable ? { color: 'error.main' } : undefined}
                  />
                </ListItemButton>
              );
            })}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default memo(WatchOnDialog);
