import { Container, Typography, Box, Link, Stack, Divider } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import PageHeader from '../components/ui/PageHeader';
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

const BODY_SX = {
  fontSize: '0.9375rem',
  lineHeight: 1.75,
  maxWidth: '70ch',
};

function Section({ title, children }) {
  return (
    <Box component="section" sx={{ py: 3.5 }}>
      <Typography variant="h5" component="h2" sx={{ mb: 1.5, fontSize: '1.125rem' }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function CodeBlock({ children }) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 2,
        borderRadius: '8px',
        bgcolor: (theme) => (theme.palette.mode === 'light' ? '#161A19' : '#0A0E0D'),
        color: '#EAF3F1',
        border: '1px solid',
        borderColor: 'divider',
        fontFamily: '"Roboto Mono", ui-monospace, monospace',
        fontSize: 12.5,
        lineHeight: 1.7,
        overflowX: 'auto',
      }}>
      {children}
    </Box>
  );
}

function Step({ number, children }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ mb: 1.5 }}>
      <Typography
        aria-hidden
        sx={{
          flexShrink: 0,
          color: 'primary.main',
          fontWeight: 700,
          fontSize: '0.875rem',
          lineHeight: 1.7,
          minWidth: 18,
        }}>
        {number}.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
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
          fontSize: 12.5,
          fontWeight: 600,
          color: 'primary.main',
          bgcolor: 'action.hover',
          px: 0.75,
          py: 0.25,
          borderRadius: '4px',
          flexShrink: 0,
        }}>
        {code}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
        {description}
      </Typography>
    </Stack>
  );
}

export default function InfoPage({ lang }) {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, sm: 4 }, pb: { xs: 8, sm: 10 } }}>
      <Box sx={{ maxWidth: 760 }}>
        <PageHeader title={t(lang, 'info_title')} subtitle={t(lang, 'info_subtitle')} />

        <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
          <Section title={t(lang, 'info_purpose_title')}>
            <Typography variant="body2" color="text.secondary" sx={BODY_SX}>
              {t(lang, 'info_purpose_body')}
            </Typography>
          </Section>

          <Divider />

          <Section title={t(lang, 'info_privacy_title')}>
            <Typography variant="body2" color="text.secondary" sx={BODY_SX}>
              {t(lang, 'info_privacy_body')}
            </Typography>
          </Section>

          <Divider />

          <Section title={t(lang, 'info_disclaimer_title')}>
            <Typography variant="body2" color="text.secondary" sx={BODY_SX}>
              {t(lang, 'info_disclaimer_body')}
            </Typography>
          </Section>

          <Divider />

          {/* Tutorial: come creare un file di configurazione custom */}
          <Section title={t(lang, 'info_tutorial_title')}>
            <Typography variant="body2" color="text.secondary" sx={{ ...BODY_SX, mb: 2.5 }}>
              {t(lang, 'info_tutorial_intro')}
            </Typography>

            <Step number={1}>{t(lang, 'info_tutorial_step1')}</Step>
            <Step number={2}>{t(lang, 'info_tutorial_step2')}</Step>

            <Box sx={{ ml: { xs: 0, sm: 2.2 }, mb: 2 }}>
              <CodeBlock>{EXAMPLE_JSON}</CodeBlock>
            </Box>

            <Box sx={{ ml: { xs: 0, sm: 2.2 }, mb: 2.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t(lang, 'info_tutorial_placeholders_title')}
              </Typography>
              <PlaceholderRow
                code="{base_url}"
                description={t(lang, 'info_tutorial_placeholder_base_url')}
              />
              <PlaceholderRow
                code="{tmdb_id}"
                description={t(lang, 'info_tutorial_placeholder_tmdb_id')}
              />
              <PlaceholderRow
                code="{season}"
                description={t(lang, 'info_tutorial_placeholder_season')}
              />
              <PlaceholderRow
                code="{episode}"
                description={t(lang, 'info_tutorial_placeholder_episode')}
              />
              <PlaceholderRow
                code="{title}"
                description={t(lang, 'info_tutorial_placeholder_title')}
              />
            </Box>

            <Box sx={{ ml: { xs: 0, sm: 2.2 }, mb: 2.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t(lang, 'info_tutorial_anilist_title')}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1.5, lineHeight: 1.7 }}>
                {t(lang, 'info_tutorial_anilist_body')}
              </Typography>
              <PlaceholderRow
                code="{anilist_id}"
                description={t(lang, 'info_tutorial_placeholder_anilist_id')}
              />
              <PlaceholderRow
                code="{mal_id}"
                description={t(lang, 'info_tutorial_placeholder_mal_id')}
              />
            </Box>

            <Step number={3}>{t(lang, 'info_tutorial_step3')}</Step>
            <Step number={4}>{t(lang, 'info_tutorial_step4')}</Step>

            <Divider sx={{ my: 2.5 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t(lang, 'info_tutorial_example_title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              {t(lang, 'onboarding_custom_url')}: <code>https://linkutente.com</code> →{' '}
              <code>https://linkutente.com/movie/603/</code>,{' '}
              <code>https://linkutente.com/tv/1399/1/1/</code>
            </Typography>
          </Section>

          <Divider />

          <Section title={t(lang, 'info_credits_title')}>
            <Stack spacing={1} sx={{ mb: 2 }}>
              {LICENSES.map((l) => (
                <Box key={l.name} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Typography variant="body2">{l.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
                    {l.license || t(lang, l.licenseKey)}
                  </Typography>
                </Box>
              ))}
            </Stack>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.6 }}>
              {t(lang, 'info_tmdb_credit')}{' '}
              <Link href="https://www.themoviedb.org" target="_blank" rel="noopener">
                themoviedb.org
              </Link>
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1, lineHeight: 1.6 }}>
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
              }}>
              <GitHubIcon sx={{ fontSize: 17 }} />
              {t(lang, 'info_github_profile')}
            </Link>
          </Section>
        </Box>
      </Box>
    </Container>
  );
}
