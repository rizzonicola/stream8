import { memo, useMemo, useState } from 'react';
import {
  Toolbar,
  Tabs,
  Tab,
  Typography,
  Box,
  IconButton,
  useMediaQuery,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import LocalMoviesRoundedIcon from '@mui/icons-material/LocalMoviesRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import TvRoundedIcon from '@mui/icons-material/TvRounded';
import AnimationRoundedIcon from '@mui/icons-material/AnimationRounded';
import { t } from '../i18n';
import { SURFACE_RADIUS } from '../theme';

export const VIEWS = { HOME: 'home', MOVIES: 'movies', SERIES: 'series', ANIME: 'anime' };

// Sopra questa larghezza usiamo la barra orizzontale completa (desktop/tablet
// largo); sotto, un pulsante hamburger apre il menu laterale (mobile).
const DESKTOP_BREAKPOINT = '(min-width:900px)';

function NavBar({
  lang,
  activeView,
  onChangeView,
  onOpenSettings,
  onOpenInfo,
  onOpenSearch,
  onOpenHistory,
}) {
  const isDesktop = useMediaQuery(DESKTOP_BREAKPOINT);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = useMemo(
    () => [
      { value: VIEWS.HOME, label: t(lang, 'nav_home'), icon: <HomeRoundedIcon /> },
      { value: VIEWS.MOVIES, label: t(lang, 'nav_movies'), icon: <MovieRoundedIcon /> },
      { value: VIEWS.SERIES, label: t(lang, 'nav_series'), icon: <TvRoundedIcon /> },
      { value: VIEWS.ANIME, label: t(lang, 'nav_anime'), icon: <AnimationRoundedIcon /> },
    ],
    [lang]
  );

  const barBg = (theme) =>
    theme.palette.mode === 'dark' ? 'rgba(27, 33, 31, 0.62)' : 'rgba(255, 255, 255, 0.76)';

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        px: { xs: 1.5, sm: 2, md: 3 },
        // env(safe-area-inset-top) vale 0px ovunque tranne che su iPhone con
        // notch/Dynamic Island (e solo se il viewport ha viewport-fit=cover,
        // già impostato in index.html): lì restituisce l'altezza esatta
        // dell'area riservata dall'hardware, calcolata da Safari stesso.
        // Nessun rilevamento del browser, nessun impatto su Android/desktop.
        pt: {
          xs: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          md: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        },
        pb: 1,
      }}
    >
      <Box
        sx={{
          borderRadius: `${SURFACE_RADIUS}px`,
          backdropFilter: 'blur(20px)',
          backgroundColor: barBg,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? '0 12px 32px -16px rgba(0,0,0,0.65)'
              : '0 12px 32px -18px rgba(20,24,26,0.28)',
        }}
      >
        <Toolbar sx={{ gap: { xs: 1, md: 2 }, py: 1, minHeight: { xs: 56, md: 64 } }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: { xs: 'auto', md: 2 }, flex: isDesktop ? 'initial' : 1 }}
          >
            <LocalMoviesRoundedIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {t(lang, 'appName')}
            </Typography>
          </Box>

          {isDesktop ? (
            <>
              <Tabs
                value={activeView}
                onChange={(_, v) => onChangeView(v)}
                sx={{
                  flex: 1,
                  minHeight: 40,
                  '& .MuiTab-root': {
                    minHeight: 40,
                    fontWeight: 700,
                    mx: 0.25,
                  },
                  '& .Mui-selected': { color: 'primary.main' },
                  '& .MuiTabs-indicator': {
                    height: 3,
                    borderRadius: 3,
                    backgroundColor: 'primary.main',
                  },
                }}
              >
                {navItems.map((item) => (
                  <Tab key={item.value} value={item.value} label={item.label} />
                ))}
              </Tabs>

              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton onClick={onOpenSearch} aria-label="search">
                  <SearchRoundedIcon />
                </IconButton>
                <IconButton onClick={onOpenHistory} aria-label={t(lang, 'section_history')}>
                  <HistoryRoundedIcon />
                </IconButton>
                <IconButton onClick={onOpenInfo} aria-label={t(lang, 'nav_info')}>
                  <InfoOutlinedIcon />
                </IconButton>
                <IconButton onClick={onOpenSettings} aria-label={t(lang, 'nav_settings')}>
                  <SettingsIcon />
                </IconButton>
              </Box>
            </>
          ) : (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <IconButton onClick={onOpenSearch} aria-label="search">
                <SearchRoundedIcon />
              </IconButton>
              <IconButton onClick={() => setDrawerOpen(true)} aria-label="menu">
                <MenuRoundedIcon />
              </IconButton>
            </Box>
          )}
        </Toolbar>
      </Box>

      {!isDesktop && (
        <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <Box
            sx={{ width: 260, pt: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
            role="presentation"
          >
            <List>
              {navItems.map((item) => (
                <ListItemButton
                  key={item.value}
                  selected={activeView === item.value}
                  onClick={() => {
                    onChangeView(item.value);
                    setDrawerOpen(false);
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              ))}
            </List>
            <Divider />
            <List>
              <ListItemButton
                onClick={() => {
                  onOpenHistory();
                  setDrawerOpen(false);
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HistoryRoundedIcon />
                </ListItemIcon>
                <ListItemText primary={t(lang, 'section_history')} />
              </ListItemButton>
              <ListItemButton
                onClick={() => {
                  onOpenInfo();
                  setDrawerOpen(false);
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <InfoOutlinedIcon />
                </ListItemIcon>
                <ListItemText primary={t(lang, 'nav_info')} />
              </ListItemButton>
              <ListItemButton
                onClick={() => {
                  onOpenSettings();
                  setDrawerOpen(false);
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText primary={t(lang, 'nav_settings')} />
              </ListItemButton>
            </List>
          </Box>
        </Drawer>
      )}
    </Box>
  );
}

export default memo(NavBar);
