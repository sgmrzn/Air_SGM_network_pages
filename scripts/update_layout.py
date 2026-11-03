from pathlib import Path
p=Path(__file__).resolve().parents[1]
def change(file, old, new):
 s=(p/file).read_text(encoding='utf-8'); assert old in s, (file,old[:60]); (p/file).write_text(s.replace(old,new),encoding='utf-8')
f='src/pages/NetworkDesignPage.tsx'
s=(p/f).read_text(encoding='utf-8').replace('  networkDesignReportUrl,\n','').replace('  saveNetworkDesignReport,\n','')
a=s.index('  const reportRequest ='); b=s.index('  const [runError',a); s=s[:a]+s[b:]
a=s.index('  const downloadReport = async () => {'); b=s.index('\n  return (',a)
s=s[:a]+'''  const downloadReport = async () => {
    if (!run) return;
    setReportSaving(true);
    try {
      const url = URL.createObjectURL(new Blob([networkScreeningReportHtml(run)], { type: "text/html;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `air-sgm-network-${run.id}.html`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setReportState({ runId: run.id, id: run.id });
    } catch (reason) {
      setReportState({ runId: run.id, error: reason instanceof Error ? reason.message : "Не удалось подготовить отчёт" });
    } finally { setReportSaving(false); }
  };
''' +s[b:]
s=s.replace('Сохранить отчёт · HTML/PDF','Скачать отчёт · HTML')
(p/f).write_text(s,encoding='utf-8')
f='src/components/NetworkDesignResultView.tsx'
change(f,'reportSaving ? "Сохраняем…" : reportError ? "Повторить сохранение" : "Открыть отчёт"','reportSaving ? "Формируем…" : reportError ? "Повторить скачивание" : "Скачать отчёт"')
change(f,'reportSaving ? "Отчёт автоматически сохраняется в «Отчёты сети»…" : reportError ? `Отчёт не сохранён: ${reportError}. Нажмите «Повторить сохранение».` : reportSaved ? "Отчёт сохранён в «Отчёты сети». Его можно открыть позже." : "Подготовка автоматического сохранения отчёта…"','reportSaving ? "Формируем файл отчёта…" : reportError ? `Не удалось подготовить отчёт: ${reportError}` : reportSaved ? "Файл передан браузеру для скачивания. Откройте его на компьютере; для PDF используйте печать." : "Скачайте отчёт в HTML на компьютер. Для сохранения в PDF откройте файл и выберите печать."')
f='src/demo/api.ts'; s=(p/f).read_text(encoding='utf-8'); s=s.replace('const reportUrls = new Map<string, string>();\n','').replace("return reportUrls.get(id) ||",'return')
a=s.index("    if (method === 'POST') {",s.index("if (p === '/api/spatial/network-design/reports')")); b=s.index("  if (p === '/api/spatial/monitoring-stations/regions')",a)
s=s[:a]+'''    if (method !== 'GET') return asJson({detail:'Скачайте отчёт на компьютер. Каталог готовых отчётов доступен только для чтения.'},405);
    return asJson((await catalog()).map(x => ({id:x.id,run_id:x.id,territory:x.city,created_at:x.created_at,recommended_positions:x.resolved_post_count,scenario_count:1,methodology_version:x.methodology_version,input_fingerprint:x.input_fingerprint,size_bytes:x.report_size_bytes || 0,demo_mode:x.planning_mode,demo_count:x.post_count,demo_note:x.empty_baseline?'Пустой исходный реестр':''})));
  }
  if (p.startsWith('/api/spatial/network-design/reports/')) return asJson({detail:'Каталог отчётов доступен только для чтения.'},405);
''' +s[b:]; (p/f).write_text(s,encoding='utf-8')
f='src/pages/NetworkReportsPage.tsx'; s=(p/f).read_text(encoding='utf-8').replace(', Trash2','').replace('  deleteNetworkDesignReport,\n','').replace('  const [deletingId, setDeletingId] = useState<string | null>(null);','''  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(() => Math.max(3, Math.floor((window.innerHeight - 340) / 58)));
  useEffect(() => { const resize = () => setPageSize(Math.max(3, Math.floor((window.innerHeight - 340) / 58))); window.addEventListener('resize',resize); return () => window.removeEventListener('resize',resize); }, []);
  useEffect(() => setPage(0), [city, mode, count, pageSize]);''')
# Hook dependencies must be declared first.
a=s.index('  useEffect(() => setPage(0)'); b=s.index('\n',a); hook=s[a:b]; s=s[:a]+s[b:]; a=s.index('  const visibleReports'); s=s[:a]+hook+'\n'+s[a:]
a=s.index('  const remove ='); b=s.index('  return (',a); s=s[:a]+s[b:]
s=s.replace('АРХИВ РЕЗУЛЬТАТОВ','КАТАЛОГ ГОТОВЫХ ОТЧЁТОВ').replace('Сохранённые версии связаны с неизменяемым паспортом расчёта и fingerprint исходных данных.','Готовые отчёты доступны для просмотра и скачивания. Отчёт из результата сохраняйте на своём компьютере.').replace('visibleReports.map((item)', 'visibleReports.slice(page * pageSize, (page + 1) * pageSize).map((item)')
a=s.index('<button className="button network-reports__delete"'); b=s.index('</button>',a)+len('</button>'); s=s[:a]+s[b:]
s=s.replace('Выполните расчёт сети. При появлении результата отчёт автоматически сохраняется здесь; статус сохранения показан на итоговом экране.','Отчёт из результата можно скачать на компьютер.').replace('Загрузка архива…','Загрузка каталога…')
s=s.replace('      </section>','''        {!loading && <footer className="demo-pagination"><span>{visibleReports.length ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, visibleReports.length)} из ${visibleReports.length}` : 'Нет отчётов по выбранным условиям'}</span><button className="button button--ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</button><label>Страница <select value={page} onChange={e => setPage(Number(e.target.value))}>{Array.from({length:Math.max(1,Math.ceil(visibleReports.length / pageSize))},(_,n)=><option key={n} value={n}>{n+1}</option>)}</select></label><button className="button button--ghost" disabled={(page + 1) * pageSize >= visibleReports.length} onClick={() => setPage(page + 1)}>Далее</button></footer>}
      </section>'''); (p/f).write_text(s,encoding='utf-8')
change('src/App.tsx','main-shell${page===','main-shell demo-page-${page}${page===')
change('src/App.tsx','Изменения реестра и отчётов сохраняются в этом браузере; исходные расчёты остаются неизменными.','Правки реестра сохраняются в этом браузере. Отчёты скачиваются на компьютер; исходные расчёты остаются неизменными.')
change('src/demo/Help.tsx','Открытый результат также сохраняет свой отчёт в браузере. Отчёт можно открыть, скачать или распечатать в PDF.','Каталог доступен только для чтения и разбит на страницы. На экране результата нажмите «Скачать отчёт»: браузер сохранит HTML-файл на компьютере согласно своим настройкам загрузок. Откройте файл и используйте печать, чтобы сохранить PDF. Новые отчёты на GitHub Pages не записываются.')
change('src/demo/Help.tsx','Удаление отчёта скрывает его в этом браузере. ','')
change('README.md','Редактирование постов и удаление отчётов сохраняется только в браузере (IndexedDB).','Редактирование постов сохраняется только в браузере (IndexedDB). Каталог 372 готовых отчётов доступен только для чтения и разбит на страницы. Кнопка «Скачать отчёт» на результате формирует HTML-файл непосредственно в браузере для сохранения на компьютере; серверное и автоматическое локальное сохранение отчётов отключено. PDF можно получить через печать открытого HTML-файла.')
