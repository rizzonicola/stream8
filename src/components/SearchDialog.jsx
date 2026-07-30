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
import { searchMulti, posterUrl } from '../api/tmdb';
import { tmdbLangCode, t } from '../i18n';

export default function SearchDialog({ open, lang, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const latestRequestId = useRef(0);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      const requestId = ++latestRequestId.current;
      searchMulti(query.trim(), tmdbLangCode(lang))
        .then((data) => {
          // Se nel frattempo è partita una ricerca più recente (utente ha
          // continuato a digitare), questa risposta è ormai obsoleta:
          // applicarla comunque mostrerebbe risultati sbagliati per la
          // query attuale se arrivasse dopo quella più recente (rete non
          // garantisce l'ordine di arrivo delle risposte).
          if (latestRequestId.current !== requestId) return;
          setResults(data);
        })
        .catch(() => {
          if (latestRequestId.current !== requestId) return;
          setResults([]);
        })
        .finally(() => {
          if (latestRequestId.current !== requestId) return;
          setLoading(false);
        });
    }, 350);
    return () => clearTimeout(handle);
  }, [query, lang]);

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
                <IconButton size="small" onClick={onClose}>
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
                sx={{ borderRadius: 2, mb: 0.5 }}
              >
                <ListItemAvatar>
                  <Avatar
                    variant="rounded"
                    src={posterUrl(item.posterPath, 'w92') || undefined}
                    sx={{ width: 40, height: 56, borderRadius: 2 }}
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
