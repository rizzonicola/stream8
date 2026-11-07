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
  Stack,
  Tooltip,
  alpha,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import LocalMoviesRoundedIcon from '@mui/icons-material/LocalMoviesRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import TvRoundedIcon from '@mui/icons-material/TvRounded';
import AnimationRoundedIcon from '@mui/icons-material/AnimationRounded';
import { t } from '../i18n';
import { VIEWS } from '../utils/router';
import { SURFACE_RADIUS } from '../theme';

// Sopra questa larghezza usiamo la barra orizzontale completa (desktop/tablet
// largo); sotto, un pulsante hamburger apre il menu laterale (mobile).
const DESKTOP_BREAKPOINT = '(min-width:900px)';

// Le icone secondarie (Cronologia, Info, Impostazioni) non sono tab: quando
// la pagina è attiva lo segnalano con il colore e con un piccolo indicatore
// uguale a quello delle tab, così il linguaggio resta uno solo.
const secondaryButtonSx = (active) => ({
  color: active ? 'primary.main' : 'text.secondary',
  '&:hover': {
    color: active ? 'primary.main' : 'text.primary',
    bgcolor: 'action.hover',
  },
  ...(active && {
    '&::after': {
      content: '""',
      position: 'absolute',
      left: '50%',
      bottom: 4,
      width: 16,
      height: 2,
      borderRadius: 1,
      bgcolor: 'primary.main',
      transform: 'translateX(-50%)',
    },
  }),
});

function BrandMark({ compact = false }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
      <LocalMoviesRoundedIcon
        color="primary"
        sx={{ fontSize: compact ? 24 : 26, flexShrink: 0 }}
      />
      <Typography
        variant="h6"
        component="span"
        sx={{
          fontWeight: 800,
          letterSpacing: '-0.025em',
          whiteSpace: 'nowrap',
          fontSize: compact ? '1.0625rem' : '1.125rem',
        }}>
        {t('it', 'appName')}
      </Typography>
    </Stack>
  );
}

function NavBar({
  lang,
  activeView,
  activePage,
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

  const secondaryItems = useMemo(
    () => [
      {
        key: 'history',
        label: t(lang, 'section_history'),
        icon: <HistoryRoundedIcon />,
        onClick: onOpenHistory,
      },
      {
        key: 'info',
        label: t(lang, 'nav_info'),
        icon: <InfoOutlinedIcon />,
        onClick: onOpenInfo,
      },
      {
        key: 'settings',
        label: t(lang, 'nav_settings'),
        icon: <SettingsIcon />,
        onClick: onOpenSettings,
      },
    ],
    [lang, onOpenHistory, onOpenInfo, onOpenSettings]
  );

  const handleNav = (value) => {
    if (!value) return;
    onChangeView(value);
    setDrawerOpen(false);
  };

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        px: { xs: 1.5, sm: 2, md: 3 },
        // env(safe-area-inset-top) vale 0px ovunque tranne che su iPhone con
        // notch/Dynamic Island: lì restituisce l'altezza esatta dell'area
        // riservata dall'hardware.
        pt: {
          xs: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          md: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        },
        pb: 1,
      }}>
      <Box
        sx={{
          borderRadius: `${SURFACE_RADIUS}px`,
          backdropFilter: { xs: 'blur(10px)', md: 'blur(16px)' },
          backgroundColor: (theme) =>
            alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.72 : 0.78),
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? '0 12px 32px -16px rgba(0,0,0,0.65)'
              : '0 12px 32px -18px rgba(20,24,26,0.28)',
        }}>
        <Toolbar
          sx={{
            gap: { xs: 1, md: 2 },
            px: { xs: 1.5, sm: 2 },
            py: 1,
            minHeight: { xs: 56, md: 64 },
          }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mr: { xs: 'auto', md: 2 },
              minWidth: 0,
              flex: isDesktop ? 'initial' : 1,
            }}>
            <BrandMark compact={!isDesktop} />
          </Box>

          {isDesktop ? (
            <>
              <Tabs
                value={activeView ?? false}
                onChange={(_, value) => handleNav(value)}
                aria-label={t(lang, 'appName')}
                sx={{
                  flex: 1,
                  minHeight: 40,
                  '& .MuiTab-root': {
                    minHeight: 40,
                    mx: 0.25,
                    px: 1.75,
                    fontWeight: 700,
                    color: 'text.secondary',
                    '&:hover': { color: 'text.primary' },
                  },
                  '& .Mui-selected': { color: 'primary.main' },
                  '& .MuiTabs-indicator': {
                    height: 3,
                    borderRadius: 3,
                    backgroundColor: 'primary.main',
                  },
                }}>
                {navItems.map((item) => (
                  <Tab key={item.value} value={item.value} label={item.label} />
                ))}
              </Tabs>

              <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                <Tooltip title={t(lang, 'search_placeholder')}>
                  <IconButton
                    onClick={onOpenSearch}
                    aria-label={t(lang, 'search')}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
                    }}>
                    <SearchRoundedIcon />
                  </IconButton>
                </Tooltip>
                {secondaryItems.map((item) => (
                  <Tooltip key={item.key} title={item.label}>
                    <IconButton
                      onClick={item.onClick}
                      aria-label={item.label}
                      aria-current={activePage === item.key ? 'page' : undefined}
                      sx={secondaryButtonSx(activePage === item.key)}>
                      {item.icon}
                    </IconButton>
                  </Tooltip>
                ))}
              </Stack>
            </>
          ) : (
            <Stack direction="row" spacing={0.25}>
              <IconButton
                onClick={onOpenSearch}
                aria-label={t(lang, 'search')}
                sx={{ color: 'text.secondary' }}>
                <SearchRoundedIcon />
              </IconButton>
              <IconButton
                onClick={() => setDrawerOpen(true)}
                aria-label={t(lang, 'menu')}
                sx={{ color: 'text.secondary' }}>
                <MenuRoundedIcon />
              </IconButton>
            </Stack>
          )}
        </Toolbar>
      </Box>

      {!isDesktop && (
        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{
            sx: {
              width: 280,
              maxWidth: '86vw',
              backgroundImage: 'none',
              borderLeft: '1px solid',
              borderColor: 'divider',
            },
          }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ px: 2, pt: 'calc(env(safe-area-inset-top, 0px) + 16px)', pb: 1.5 }}>
              <BrandMark compact />
              <IconButton
                onClick={() => setDrawerOpen(false)}
                aria-label={t(lang, 'close')}
                sx={{ color: 'text.secondary' }}>
                <CloseRoundedIcon />
              </IconButton>
            </Stack>

            <Divider />

            <List sx={{ px: 1, py: 1.5 }} aria-label={t(lang, 'appName')}>
              {navItems.map((item) => (
                <ListItemButton
                  key={item.value}
                  selected={activeView === item.value}
                  onClick={() => handleNav(item.value)}>
                  <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9375rem' }}
                  />
                </ListItemButton>
              ))}
            </List>

            <Divider />

            <List sx={{ px: 1, py: 1.5 }}>
              {secondaryItems.map((item) => (
                <ListItemButton
                  key={item.key}
                  selected={activePage === item.key}
                  onClick={() => {
                    item.onClick();
                    setDrawerOpen(false);
                  }}>
                  <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9375rem' }}
                  />
                </ListItemButton>
              ))}
            </List>

            <Box sx={{ mt: 'auto', pb: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }} />
          </Box>
        </Drawer>
      )}
    </Box>
  );
}

export default memo(NavBar);
