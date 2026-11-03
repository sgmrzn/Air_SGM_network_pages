import { catalog, loadDemoRun, type CatalogItem } from './api';

export async function preparedReportHtml(id: string, preset?: {file:string;preset_key?:string}) {
  const item = preset ? ({...preset,id} as CatalogItem) : (await catalog()).find(row => row.id === id);
  if (!item) throw new Error('Готовый расчёт не найден');
  const [run, renderer] = await Promise.all([loadDemoRun(item), import('../pages/NetworkDesignPage')]);
  return renderer.networkScreeningReportHtml(run);
}
export async function openPreparedReport(id: string, preset?: {file:string;preset_key?:string}) {
  const preview = window.open('about:blank', '_blank');
  if (preview) { preview.opener = null; preview.document.body.textContent = 'Готовим отчёт из сохранённого расчёта…'; }
  try {
    const html = await preparedReportHtml(id,preset);
    const url = URL.createObjectURL(new Blob([html], {type:'text/html;charset=utf-8'}));
    if (preview) preview.location.replace(url);
    else {
      const link = document.createElement('a'); link.href = url;
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      document.body.append(link); link.click(); link.remove();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) { preview?.close(); throw error; }
}
