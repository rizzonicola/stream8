import { memo } from 'react';
import HorizontalList from './HorizontalList';
import { t } from '../i18n';

function HistorySection({ lang, history, onSelect, onRemove, onPrefetch }) {
  if (!history || history.length === 0) return null;

  return (
    <HorizontalList
      lang={lang}
      title={t(lang, 'section_history')}
      items={history}
      onSelect={onSelect}
      onRemove={onRemove}
      removeLabel={t(lang, 'history_remove')}
      onPrefetch={onPrefetch}
    />
  );
}

export default memo(HistorySection);
