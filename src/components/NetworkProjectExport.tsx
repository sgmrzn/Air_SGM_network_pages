import { useState } from "react";
import { API_BASE } from "../shared/http";

export function NetworkProjectExport({ runId }: { runId: string }) {
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  async function download() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/spatial/network-design/runs/${encodeURIComponent(runId)}/bundle`);
      if (!response.ok) { const error = await response.json(); throw new Error(error.detail ?? "Не удалось собрать комплект"); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href=url; link.download=`air-sgm-${runId}.zip`; link.click(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  return <section className="planning-project-export"><h4>Единый комплект проекта</h4><p>Исходный запуск, матрицы и геометрии, все сохранённые эксперименты, точки GeoJSON и HTML-отчёт для печати в PDF. Полные исходные растры в ZIP не включены.</p>
    <button className="planning-button is-primary" disabled={busy} onClick={() => void download()}>{busy ? "Собираем комплект…" : "Скачать проект · ZIP"}</button>
    <label className="planning-help">Проверить ранее скачанный комплект (ZIP до 50 МБ)<input type="file" accept=".zip" disabled={busy} onChange={async event => {
      const file=event.target.files?.[0]; if (!file) return;
      const input=event.target; setBusy(true); setMessage("");
      try {
        if (file.size>50*1024*1024) throw new Error("ZIP больше 50 МБ");
        const form=new FormData(); form.append("file",file);
        const response=await fetch(`${API_BASE}/api/spatial/network-design/bundle/validate`,{method:"POST",body:form});
        const result=await response.json(); if (!response.ok) throw new Error(result.detail ?? "Ошибка проверки");
        setMessage(`${result.message} Файлов: ${result.file_count}; экспериментов: ${result.experiment_count}.`);
      } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
      finally { setBusy(false); input.value=""; }
    }} /></label>
    {message && <p role="status">{message}</p>}
  </section>;
}
