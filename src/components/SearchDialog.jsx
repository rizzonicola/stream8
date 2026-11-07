import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  CircularProgress,
  Box,
  IconButton,
  Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { searchMulti } from '../api/tmdb';
import { posterUrl } from '../utils/images';
import { tmdbLangCode, t } from '../i18n';

export default function SearchDialog({ open, lang, onClose, onSelect, onPrefetch }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const latestRequestId = useRef(0);
  const abortRef = useRef(null);

  useEffect(() => {
    abortRef.current?.abort();
    // Invalida subito la richiesta precedente: anche se la risposta era già
    // in volo, non potrà più sovrascrivere la UI (né al cambio query né
    // quando il campo viene svuotato o il dialog chiuso).
    const requestId = ++latestRequestId.current;

    if (!open) {
      setQuery('');
      setResults([]);
      setLoading(false);
      return undefined;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    const handle = setTimeout(() => {
      searchMulti(trimmed, tmdbLangCode(lang), { signal: controller.signal })
        .then((data) => {
          if (latestRequestId.current !== requestId) return;
          setResults(data);
          setLoading(false);
        })
        .catch(() => {
          if (latestRequestId.current !== requestId) return;
          setResults([]);
          setLoading(false);
        });
    }, 300);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [open, query, lang]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogContent sx={{ p: 2 }}>
        <TextField
          autoFocus
          fullWidth
          placeholder={t(lang, 'search_placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={onClose} aria-label={t(lang, 'close')}>
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ mt: 1.5, minHeight: 80 }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
              —
            </Typography>
          )}

          <List disablePadding>
            {results.map((item) => (
              <ListItemButton
                key={`${item.mediaType}-${item.id}`}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                onMouseEnter={onPrefetch}
                onFocus={onPrefetch}
                sx={{ borderRadius: '8px', mb: 0.5 }}
              >
                <ListItemAvatar>
                  <Avatar
                    variant="rounded"
                    src={posterUrl(item.posterPath, 'w92') || undefined}
                    sx={{ width: 40, height: 56, borderRadius: '4px' }}
                  >
                    {item.title[0]}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary={item.title} secondary={item.year} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
