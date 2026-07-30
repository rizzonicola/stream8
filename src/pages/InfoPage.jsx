import { Container, Typography, Paper, Box, Link, Stack, Divider } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import { t } from '../i18n';

const LICENSES = [
  { name: 'React', license: 'MIT' },
  { name: 'MUI (Material UI)', license: 'MIT' },
  { name: 'Emotion', license: 'MIT' },
  { name: 'Vite', license: 'MIT' },
  { name: 'Google Fonts (Manrope, Roboto Flex)', license: 'SIL OFL 1.1' },
  { name: 'TMDb API', licenseKey: 'info_license_tmdb_terms' },
  { name: 'AniList API', licenseKey: 'info_license_anilist_terms' },
];

// Esempio di configurazione: schema universale, non tradotto (il JSON è lo
// stesso indipendentemente dalla lingua dell'interfaccia).
const EXAMPLE_JSON = `{
  "movie_pattern": "{base_url}/movie/{tmdb_id}/",
  "episode_pattern": "{base_url}/tv/{tmdb_id}/{season}/{episode}/",
  "anime_pattern": "{base_url}/tv/{tmdb_id}/{season}/{episode}/"
}`;

function CodeBlock({ children }) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 2,
        borderRadius: 2,
        bgcolor: (theme) => (theme.palette.mode === 'light' ? '#161A19' : '#0A0E0D'),
        color: '#EAF3F1',
        fontFamily: '"Roboto Mono", ui-monospace, monospace',
        fontSize: 13,
        lineHeight: 1.6,
        overflowX: 'auto',
      }}
    >
      {children}
    </Box>
  );
}

function Step({ number, children }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
      <Box
        sx={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 800,
        }}
      >
        {number}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ pt: 0.15 }}>
        {children}
      </Typography>
    </Stack>
  );
}

function PlaceholderRow({ code, description }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="baseline" sx={{ mb: 0.75 }}>
      <Box
        component="code"
        sx={{
          fontFamily: '"Roboto Mono", ui-monospace, monospace',
          fontSize: 13,
          fontWeight: 700,
          color: 'primary.main',
          bgcolor: 'action.hover',
          px: 0.75,
          py: 0.25,
          borderRadius: 1,
          flexShrink: 0,
        }}
      >
        {code}
      </Box>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </Stack>
  );
}

export default function InfoPage({ lang }) {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>
        {t(lang, 'info_title')}
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          {t(lang, 'info_purpose_title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(lang, 'info_purpose_body')}
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          {t(lang, 'info_privacy_title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(lang, 'info_privacy_body')}
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          {t(lang, 'info_disclaimer_title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(lang, 'info_disclaimer_body')}
        </Typography>
      </Paper>

      {/* Tutorial: come creare un file di configurazione custom */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {t(lang, 'info_tutorial_title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          {t(lang, 'info_tutorial_intro')}
        </Typography>

        <Step number={1}>{t(lang, 'info_tutorial_step1')}</Step>
        <Step number={2}>{t(lang, 'info_tutorial_step2')}</Step>

        <Box sx={{ ml: 4.5, mb: 2 }}>
          <CodeBlock>{EXAMPLE_JSON}</CodeBlock>
        </Box>

        <Box sx={{ ml: 4.5, mb: 2.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t(lang, 'info_tutorial_placeholders_title')}
          </Typography>
          <PlaceholderRow code="{base_url}" description={t(lang, 'info_tutorial_placeholder_base_url')} />
          <PlaceholderRow code="{tmdb_id}" description={t(lang, 'info_tutorial_placeholder_tmdb_id')} />
          <PlaceholderRow code="{season}" description={t(lang, 'info_tutorial_placeholder_season')} />
          <PlaceholderRow code="{episode}" description={t(lang, 'info_tutorial_placeholder_episode')} />
          <PlaceholderRow code="{title}" description={t(lang, 'info_tutorial_placeholder_title')} />
        </Box>

        <Box sx={{ ml: 4.5, mb: 2.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t(lang, 'info_tutorial_anilist_title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t(lang, 'info_tutorial_anilist_body')}
          </Typography>
          <PlaceholderRow code="{anilist_id}" description={t(lang, 'info_tutorial_placeholder_anilist_id')} />
          <PlaceholderRow code="{mal_id}" description={t(lang, 'info_tutorial_placeholder_mal_id')} />
        </Box>

        <Step number={3}>{t(lang, 'info_tutorial_step3')}</Step>
        <Step number={4}>{t(lang, 'info_tutorial_step4')}</Step>

        <Divider sx={{ my: 2.5 }} />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t(lang, 'info_tutorial_example_title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(lang, 'onboarding_custom_url')}: <code>https://linkutente.com</code> →{' '}
          <code>https://linkutente.com/movie/603/</code>,{' '}
          <code>https://linkutente.com/tv/1399/1/1/</code>
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          {t(lang, 'info_credits_title')}
        </Typography>
        <Stack spacing={1} sx={{ mb: 2 }}>
          {LICENSES.map((l) => (
            <Box key={l.name} sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">{l.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {l.license || t(lang, l.licenseKey)}
              </Typography>
            </Box>
          ))}
        </Stack>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {t(lang, 'info_tmdb_credit')}{' '}
          <Link href="https://www.themoviedb.org" target="_blank" rel="noopener">
            themoviedb.org
          </Link>
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {t(lang, 'info_anilist_credit')}{' '}
          <Link href="https://anilist.co" target="_blank" rel="noopener">
            anilist.co
          </Link>
        </Typography>

        <Divider sx={{ my: 2 }} />
        <Link
          href="https://github.com/rizzonicola"
          target="_blank"
          rel="noopener"
          underline="hover"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            color: 'text.secondary',
            fontSize: 13,
          }}
        >
          <GitHubIcon fontSize="small" />
          {t(lang, 'info_github_profile')}
        </Link>
      </Paper>
    </Container>
  );
}
