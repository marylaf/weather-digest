import { useEffect, useMemo, useRef, useState } from 'react';

import styles from './App.module.css';
import { listSavedReports } from './lib/loadReports';
import { parseCityWeather } from './lib/parseReport';
import { renderMessage, renderReport } from './lib/renderReport';

function css(className: string | undefined): string {
  return className ?? '';
}

const reportStyles = {
  card: css(styles.card),
  title: css(styles.reportTitle),
  meta: css(styles.meta),
  tableWrap: css(styles.tableWrap),
  table: css(styles.table),
  empty: css(styles.empty),
  error: css(styles.error),
};

export function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const reports = useMemo(() => listSavedReports(), []);
  const [selectedId, setSelectedId] = useState<string | null>(reports[0]?.id ?? null);

  const selected = reports.find((report) => report.id === selectedId) ?? null;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) {
      return;
    }

    if (!selected) {
      renderMessage(
        container,
        'Сохранённых отчётов пока нет. Сгенерируйте JSON через CLI.',
        css(styles.empty),
      );
      return;
    }

    renderMessage(container, 'Загрузка отчёта…', css(styles.empty));

    let cancelled = false;

    void selected
      .load()
      .then((value) => {
        if (cancelled) {
          return;
        }

        const report = parseCityWeather(value);
        if (report === null) {
          renderMessage(container, 'Файл не похож на JSON-отчёт погоды.', css(styles.error));
          return;
        }

        renderReport(container, report, reportStyles);
      })
      .catch(() => {
        if (!cancelled) {
          renderMessage(container, 'Не удалось загрузить отчёт.', css(styles.error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Weather Digest</p>
          <h1 className={styles.title}>Сохранённый отчёт о погоде</h1>
          <p className={styles.lead}>
            Страница читает JSON из каталога reports и выводит прогноз через DOM API.
          </p>
        </header>

        <div className={styles.toolbar}>
          {reports.map((report) => (
            <button
              key={report.id}
              type="button"
              className={`${styles.reportButton} ${report.id === selectedId ? styles.reportButtonActive : ''}`}
              aria-pressed={report.id === selectedId}
              onClick={() => {
                setSelectedId(report.id);
              }}
            >
              {report.label}
            </button>
          ))}
        </div>

        <div ref={mountRef} className={styles.mount} />
      </div>
    </div>
  );
}
