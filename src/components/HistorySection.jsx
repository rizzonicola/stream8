import { memo, useCallback } from 'react';
import HorizontalList from './HorizontalList';
import { t } from '../i18n';

function HistorySection({ lang, history, onSelect, onRemove }) {
  const handleRemove = useCallback((item) => onRemove(item._key), [onRemove]);

  if (!history || history.length === 0) return null;

  return (
    <HorizontalList
      title={t(lang, 'section_history')}
      items={history}
      onSelect={onSelect}
      onRemove={handleRemove}
      removeLabel={t(lang, 'history_remove')}
    />
  );
}

export default memo(HistorySection);
