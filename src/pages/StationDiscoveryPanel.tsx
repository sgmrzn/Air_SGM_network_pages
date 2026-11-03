import { useEffect, useState, type FormEvent } from "react";

type Run = {
  id: string;
  source_group: string;
  region: string;
  status: string;
  query_text: string;
};
type Document = { id: string; url: string; title: string | null };
type Candidate = {
  id: string;
  name: string;
  location_text?: string | null;
  pollutants: string[];
  measurement_program?: string | null;
  source_url: string;
  status: string;
};
type Geocode = {
  longitude: number;
  latitude: number;
  display_name?: string;
  note: string;
  suggested_accuracy_m: number;
};

const sources = [
  {
    id: "roshydromet",
    label: "Росгидромет / УГМС / ЦГМС",
    help: "Официальные обзоры и новости Росгидромета; из PDF извлекаются только пары «пост + адрес».",
  },
  {
    id: "minprirody",
    label: "Минприроды и ФГИС «Экомониторинг»",
    help: "Материалы ФГИС и Минприроды. Реестр формируется только после проверки найденного первоисточника.",
  },
  {
    id: "rospotrebnadzor",
    label: "Роспотребнадзор и ЦГиЭ",
    help: "Официальные отчёты санитарного мониторинга. Для Рязанской области подключён специализированный разбор отчёта.",
  },
  {
    id: "regional",
    label: "Региональные автоматизированные сети",
    help: "Открытые данные и документы региональных сетей; автоматически извлекаются только явно указанные посты с адресом.",
  },
];
const yandexMapsUrl = (longitude: number, latitude: number) =>
  `https://yandex.ru/maps/?ll=${encodeURIComponent(`${longitude},${latitude}`)}&z=16&pt=${encodeURIComponent(`${longitude},${latitude},pm2rdm`)}`;

export function StationDiscoveryPanel() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [geocodes, setGeocodes] = useState<Record<string, Geocode>>({});
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scope, setScope] = useState<"region" | "national">("region");
  const [sourceGroup, setSourceGroup] = useState("roshydromet");

  const load = async () => {
    const response = await fetch(
      "/api/spatial/monitoring-stations/discovery-runs",
    );
    if (response.ok) setRuns((await response.json()) as Run[]);
  };

  useEffect(() => {
    void load();
    void fetch("/api/spatial/monitoring-stations/discovery-regions")
      .then((response) => response.json() as Promise<string[]>)
      .then(setRegions)
      .catch(() => setRegions([]));
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusyId("search");
    setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const endpoint =
        scope === "national"
          ? "/api/spatial/monitoring-stations/discovery-runs/national"
          : "/api/spatial/monitoring-stations/discovery-runs";
      const response = await fetch(endpoint, { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.detail ?? "Не удалось создать поиск");
      setMessage(
        scope === "national"
          ? `Создано региональных заданий: ${result.runs_created}`
          : `Поиск поставлен в очередь: ${result.query_text}`,
      );
      await load();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyId(null);
    }
  };

  const execute = async (run: Run) => {
    setBusyId(run.id);
    setMessage("");
    try {
      const response = await fetch(
        `/api/spatial/monitoring-stations/discovery-runs/${run.id}/execute`,
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.detail ?? "Не удалось выполнить поиск");
      setMessage(
        `Найдено документов: ${result.documents_found}; извлечено черновиков постов: ${result.candidates_found}`,
      );
      await load();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyId(null);
    }
  };

  const removeRun = async (run: Run) => {
    setBusyId(run.id);
    setMessage("");
    try {
      const response = await fetch(
        `/api/spatial/monitoring-stations/discovery-runs/${run.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.detail ?? "Не удалось удалить задание");
      }
      if (selectedRun === run.id) {
        setSelectedRun(null);
        setDocuments([]);
        setCandidates([]);
      }
      setMessage("Поисковое задание удалено.");
      await load();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyId(null);
    }
  };

  const showResult = async (run: Run) => {
    setSelectedRun(run.id);
    const [docs, drafts] = await Promise.all([
      fetch(
        `/api/spatial/monitoring-stations/discovery-runs/${run.id}/documents`,
      ),
      fetch(
        `/api/spatial/monitoring-stations/discovery-runs/${run.id}/candidates`,
      ),
    ]);
    if (docs.ok) setDocuments((await docs.json()) as Document[]);
    if (drafts.ok) setCandidates((await drafts.json()) as Candidate[]);
  };

  const geocode = async (candidate: Candidate) => {
    setBusyId(candidate.id);
    setMessage("");
    try {
      const response = await fetch(
        `/api/spatial/monitoring-stations/discovery-candidates/${candidate.id}/geocode`,
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.detail ?? "Не удалось геокодировать адрес");
      setGeocodes((current) => ({
        ...current,
        [candidate.id]: result as Geocode,
      }));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyId(null);
    }
  };

  const promote = async (
    event: FormEvent<HTMLFormElement>,
    candidate: Candidate,
  ) => {
    event.preventDefault();
    setBusyId(candidate.id);
    setMessage("");
    try {
      const response = await fetch(
        `/api/spatial/monitoring-stations/discovery-candidates/${candidate.id}/promote`,
        {
          method: "POST",
          body: new FormData(event.currentTarget),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.detail ?? "Не удалось перенести пост");
      setMessage(result.message);
      setCandidates((current) =>
        current.map((item) =>
          item.id === candidate.id ? { ...item, status: "promoted" } : item,
        ),
      );
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="module-card spatial-source-loaders">
      <div className="module-card__head">
        <div>
          <span>ПОИСК И ИМПОРТ · ИСТОЧНИКИ ПОСТОВ</span>
          <h3>Автоматизированное пополнение реестра</h3>
          <p>
            Выберите источник и территорию поиска. Найденные материалы всегда
            проходят проверку до добавления постов в реестр.
          </p>
        </div>
      </div>
      <div className="spatial-source-loaders__body">
        <form
          className="station-discovery-form"
          onSubmit={(event) => void submit(event)}
        >
          <div className="station-discovery-form__settings">
            <label>
              <span>1 · ГРУППА ИСТОЧНИКОВ</span>
              <select
                name="source_group"
                value={sourceGroup}
                onChange={(event) => setSourceGroup(event.target.value)}
              >
                {sources.map((source) => (
                  <option value={source.id} key={source.id}>
                    {source.label}
                  </option>
                ))}
              </select>
              <small>
                {sources.find((source) => source.id === sourceGroup)?.help}
              </small>
            </label>
            <label>
              <span>2 · ОБЛАСТЬ ПОИСКА</span>
              <select
                value={scope}
                onChange={(event) =>
                  setScope(event.target.value as "region" | "national")
                }
              >
                <option value="region">Один регион</option>
                <option value="national">Вся Россия</option>
              </select>
            </label>
          </div>
          {scope === "region" ? (
            <label className="station-discovery-form__region">
              <span>3 · ВЫБЕРИТЕ РЕГИОН</span>
              <input
                name="region"
                required
                list="discovery-regions"
                defaultValue="Рязанская область"
                placeholder="Начните вводить: например, «Красн…»"
                autoComplete="off"
              />
              <small>Начните печатать — появятся подходящие субъекты РФ.</small>
              <datalist id="discovery-regions">
                {regions.map((region) => (
                  <option value={region} key={region} />
                ))}
              </datalist>
            </label>
          ) : (
            <div className="station-discovery-form__national">
              <b>Федеральная кампания</b>
              <span>
                Будет создано отдельное задание для каждого субъекта РФ.
              </span>
            </div>
          )}
          <button
            className="spatial-source-action station-discovery-form__action"
            disabled={busyId === "search"}
          >
            {busyId === "search"
              ? "Выполняется…"
              : scope === "national"
                ? "Создать кампанию России"
                : "Создать поиск по региону"}
          </button>
        </form>
      </div>
      {message && <div className="form-error">{message}</div>}
      <footer>
        Для Рязанской области в источнике «Роспотребнадзор и ЦГиЭ» подключён
        разбор официального PDF-отчёта.
      </footer>
      {runs.length > 0 && (
        <div className="job-log station-discovery-runs">
          {runs.map((run) => (
            <div className="job-log__entry" key={run.id}>
              <time>
                {run.status === "documents_found"
                  ? "РЕЗУЛЬТАТ ГОТОВ"
                  : run.status === "failed"
                    ? "ОШИБКА"
                    : "ОЖИДАЕТ ЗАПУСКА"}
              </time>
              <span>
                <b>{run.region}</b> ·{" "}
                {
                  sources.find((source) => source.id === run.source_group)
                    ?.label
                }
                <br />
                {run.query_text}
              </span>
              <div className="station-discovery-runs__actions">
                {run.status !== "documents_found" && (
                  <button
                    className="button button--primary"
                    disabled={busyId === run.id}
                    onClick={() => void execute(run)}
                  >
                    Искать документы
                  </button>
                )}
                <button className="button" onClick={() => void showResult(run)}>
                  Разобрать результат
                </button>
                <button
                  className="button station-discovery-runs__delete"
                  disabled={busyId === run.id}
                  onClick={() => void removeRun(run)}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {selectedRun && (
        <section className="station-documents">
          {candidates.length > 0 && (
            <>
              <div>
                <b>Извлечённые черновики постов</b>
                <span>
                  {
                    candidates.filter(
                      (candidate) => candidate.status !== "promoted",
                    ).length
                  }{" "}
                  · требуют проверки
                </span>
              </div>
              {candidates.map((candidate) => (
                <article className="station-candidate" key={candidate.id}>
                  <b>{candidate.name}</b>
                  <span>{candidate.location_text || "Адрес не извлечён"}</span>
                  <small>
                    {candidate.pollutants.join(", ") || "Вещества не извлечены"}{" "}
                    · {candidate.measurement_program}
                  </small>
                  <a
                    href={candidate.source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Открыть первоисточник ↗
                  </a>
                  {candidate.status === "promoted" ? (
                    <em>Внесён в реестр</em>
                  ) : (
                    <form
                      className="station-candidate__promote"
                      key={`${candidate.id}-${geocodes[candidate.id]?.longitude ?? "manual"}`}
                      onSubmit={(event) => void promote(event, candidate)}
                    >
                      {geocodes[candidate.id] && (
                        <>
                          <input name="geocoded" type="hidden" value="true" />
                          <p>
                            {geocodes[candidate.id].note}
                            <br />
                            OpenStreetMap Nominatim / ODbL:{" "}
                            {geocodes[candidate.id].display_name}
                          </p>
                        </>
                      )}
                      <label>
                        Долгота WGS‑84
                        <input
                          name="longitude"
                          type="number"
                          step="any"
                          required
                          defaultValue={geocodes[candidate.id]?.longitude}
                        />
                      </label>
                      <label>
                        Широта WGS‑84
                        <input
                          name="latitude"
                          type="number"
                          step="any"
                          required
                          defaultValue={geocodes[candidate.id]?.latitude}
                        />
                      </label>
                      <label>
                        Точность, м
                        <input
                          name="coordinate_accuracy_m"
                          type="number"
                          min="0"
                          step="any"
                          defaultValue={
                            geocodes[candidate.id]?.suggested_accuracy_m
                          }
                          placeholder="Напр. 50"
                        />
                      </label>
                      <button
                        type="button"
                        className="button"
                        disabled={busyId === candidate.id}
                        onClick={() => void geocode(candidate)}
                      >
                        Геокодировать автоматически
                      </button>
                      {geocodes[candidate.id] && (
                        <a
                          className="button station-candidate__map-check"
                          href={yandexMapsUrl(
                            geocodes[candidate.id].longitude,
                            geocodes[candidate.id].latitude,
                          )}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Проверить на Яндекс Картах ↗
                        </a>
                      )}
                      <button
                        className="button button--primary"
                        disabled={busyId === candidate.id}
                      >
                        Подтвердить и внести
                      </button>
                    </form>
                  )}
                </article>
              ))}
            </>
          )}
          <div>
            <b>Документы-кандидаты</b>
            <span>{documents.length} для выбранного запуска</span>
          </div>
          {documents.length === 0 ? (
            <p>Материалы ещё не найдены.</p>
          ) : (
            documents.map((document) => (
              <a
                href={document.url}
                target="_blank"
                rel="noreferrer"
                key={document.id}
              >
                <span>{document.title || document.url}</span>
                <small>Открыть источник ↗ · требуется проверка</small>
              </a>
            ))
          )}
        </section>
      )}
    </section>
  );
}
