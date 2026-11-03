import { useState } from "react";

type Props = { onImported: () => void };

export function PopulationLoaderPanel({ onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("WorldPop population raster");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [sourceUrl, setSourceUrl] = useState("");
  const [license, setLicense] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const upload = async () => {
    if (!file) return;
    try {
      setBusy(true);
      setMessage("");
      const form = new FormData();
      form.append("name", name);
      form.append("reference_year", year);
      form.append("source_url", sourceUrl);
      form.append("license", license);
      form.append("file", file);
      const response = await fetch("/api/spatial/population/import", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.detail ?? "Не удалось импортировать растр");
      setMessage(result.message);
      onImported();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="module-card spatial-source-loaders">
      <div className="module-card__head">
        <div>
          <span>НАСЕЛЕНИЕ · ОФЛАЙН-АРХИВ</span>
          <h3>Импорт растра численности населения</h3>
          <p>
            Загрузите локально скачанный GeoTIFF или COG. Сохраняются выпуск,
            год, источник, лицензия и контрольная сумма.
          </p>
        </div>
      </div>
      <div className="spatial-source-loaders__body">
        <div className="spatial-source-loaders__import">
          <label>
            <span>НАЗВАНИЕ ВЫПУСКА</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={200}
            />
          </label>
          <label>
            <span>ГОД ДАННЫХ</span>
            <input
              type="number"
              min="1900"
              max="2100"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            />
          </label>
          <label>
            <span>GEOTIFF / COG</span>
            <input
              type="file"
              accept=".tif,.tiff,image/tiff"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label>
            <span>ССЫЛКА НА ВЫПУСК</span>
            <input
              type="url"
              placeholder="https://…"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
            />
          </label>
          <label>
            <span>ЛИЦЕНЗИЯ</span>
            <input
              placeholder="Например, CC BY 4.0"
              value={license}
              onChange={(event) => setLicense(event.target.value)}
            />
          </label>
          <button
            className="spatial-source-action"
            disabled={busy || !file || !name.trim() || !year}
            onClick={() => void upload()}
          >
            {busy ? "Сохранение…" : "Импортировать растр"}
          </button>
        </div>
      </div>
      {message && <div className="form-error">{message}</div>}
      <footer>
        После импорта растр хранится локально. Агрегация в Analytical Cell и
        расчёт охвата будут добавлены отдельным ETL-этапом.
      </footer>
    </section>
  );
}
