import { useEffect, useMemo, useState, type FormEvent } from "react";

export type Station = {
  id: string;
  name: string;
  operator: string;
  station_type: string;
  status: string;
  longitude: number;
  latitude: number;
  address?: string | null;
  pollutants: string[];
  measurement_program?: string | null;
  verification_status: string;
  source_url?: string | null;
  source_date?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  notes?: string | null;
};

export const typeLabel: Record<string, string> = {
  stationary: "Стационарный",
  route: "Маршрутный",
  mobile: "Передвижной",
  background: "Фоновый",
};
export const statusLabel: Record<string, string> = {
  active: "Действует",
  inactive: "Закрыт",
  planned: "Планируется",
  unknown: "Не подтверждён",
};
export const verificationLabel: Record<string, string> = {
  verified: "Подтверждено",
  source_reported: "Указано в источнике",
  address_geocoded: "Геокодировано",
  unverified: "Не проверено",
};
const monitoringPrograms = [
  "Круглосуточная программа",
  "4 раза в сутки",
  "Сокращённая программа",
  "Маршрутные наблюдения",
  "Иная программа",
];
const pollutantOptions = [
  "Взвешенные вещества",
  "PM10",
  "PM2.5",
  "Диоксид азота (NO₂)",
  "Оксид азота (NO)",
  "Диоксид серы (SO₂)",
  "Оксид углерода (CO)",
  "Озон (O₃)",
  "Сероводород (H₂S)",
  "Формальдегид",
  "Фенол",
  "Бензол",
  "Бенз(а)пирен",
  "Аммиак (NH₃)",
  "Углеводороды C1–C5",
];

export function StationRegistryPanel() {
  const [stations, setStations] = useState<Station[]>([]);
  const [addresses, setAddresses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [region, setRegion] = useState("all");

  const load = async () => {
    const response = await fetch("/api/spatial/monitoring-stations");
    if (!response.ok) throw new Error("Не удалось загрузить реестр");
    setStations((await response.json()) as Station[]);
  };

  useEffect(() => {
    void load()
      .catch((reason) =>
        setMessage(reason instanceof Error ? reason.message : String(reason)),
      )
      .finally(() => setLoading(false));
    void fetch("/api/spatial/monitoring-stations/regions")
      .then((response) =>
        response.ok ? (response.json() as Promise<string[]>) : [],
      )
      .then(setRegions);
    void fetch("/api/spatial/monitoring-stations/addresses")
      .then((response) =>
        response.ok ? (response.json() as Promise<string[]>) : [],
      )
      .then(setAddresses);
  }, []);

  const visibleStations = stations.filter((station) => {
    if (region === "all") return true;
    const address = station.address?.toLocaleLowerCase("ru-RU") ?? "";
    return (
      address.includes(region.toLocaleLowerCase("ru-RU")) ||
      (region === "Рязанская область" && /рязан/i.test(station.operator))
    );
  });
  const refresh = async () => {
    await load();
    const response = await fetch("/api/spatial/monitoring-stations/addresses");
    if (response.ok) setAddresses((await response.json()) as string[]);
  };

  const update = async (
    event: FormEvent<HTMLFormElement>,
    station: Station,
  ) => {
    event.preventDefault();
    setBusyId(station.id);
    setMessage("");
    try {
      const response = await fetch(
        `/api/spatial/monitoring-stations/${station.id}`,
        { method: "PUT", body: new FormData(event.currentTarget) },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.detail ?? "Не удалось обновить пост");
      setEditing(null);
      setMessage(`Сохранено: ${result.name}`);
      await refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (station: Station) => {
    setBusyId(station.id);
    setMessage("");
    try {
      const response = await fetch(
        `/api/spatial/monitoring-stations/${station.id}`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.detail ?? "Не удалось удалить пост");
      if (editing === station.id) setEditing(null);
      setMessage(result.message);
      await refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="module-card station-registry">
      <div className="module-card__head station-registry__head">
        <div>
          <span>ОСНОВНОЙ КАТАЛОГ</span>
          <h3>Реестр постов</h3>
          <p>
            Сведения о постах, их расположении, источниках и статусе верификации.
          </p>
        </div>
        <label className="station-registry__region">
          <span>Регион</span>
          <select
            value={region}
            onChange={(event) => setRegion(event.target.value)}
          >
            <option value="all">Все посты Рязанской области</option>
            {regions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <b>
          {visibleStations.length}{" "}
          {visibleStations.length === 1 ? "пост" : "постов"}
        </b>
      </div>
      {message && <div className="form-error">{message}</div>}
      {loading ? (
        <p className="station-empty">Загрузка реестра…</p>
      ) : visibleStations.length === 0 ? (
        <div className="station-empty">
          <b>
            {region === "all"
              ? "Реестр пока пуст"
              : "В выбранном регионе постов пока нет"}
          </b>
          <span>
            {region === "all"
              ? "Добавьте первый пост вручную и укажите первичный источник сведений."
              : "Смените регион или добавьте первый пост вручную."}
          </span>
        </div>
      ) : (
        <div className="station-registry__list">
          {visibleStations.map((station) => (
            <article
              key={station.id}
              className={
                editing === station.id ? "station-registry__item--editing" : ""
              }
            >
              {editing === station.id ? (
                <StationEditForm
                  station={station}
                  addresses={addresses}
                  busy={busyId === station.id}
                  onSubmit={(event) => void update(event, station)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  <div>
                    <b>{station.name}</b>
                    <span>
                      {station.operator} · {typeLabel[station.station_type]} ·{" "}
                      {statusLabel[station.status]}
                    </span>
                  </div>
                  <div className="station-registry__meta">
                    {station.address && (
                      <span className="station-registry__address">
                        {station.address}
                      </span>
                    )}
                    <span>
                      {station.latitude.toFixed(5)},{" "}
                      {station.longitude.toFixed(5)}
                    </span>
                    <span>
                      {verificationLabel[station.verification_status]}
                    </span>
                    {station.source_date && (
                      <span>Сведения: {station.source_date}</span>
                    )}
                    {station.pollutants.length > 0 && (
                      <span>{station.pollutants.join(", ")}</span>
                    )}
                  </div>
                  <div className="station-registry__actions">
                    {station.source_url && (
                      <a
                        href={station.source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Источник
                      </a>
                    )}
                    
                    
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function StationEditForm({
  station,
  addresses,
  busy,
  onSubmit,
  onCancel,
}: {
  station: Station;
  addresses: string[];
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const [pollutants, setPollutants] = useState(station.pollutants);
  const programs =
    station.measurement_program &&
    !monitoringPrograms.includes(station.measurement_program)
      ? [station.measurement_program, ...monitoringPrograms]
      : monitoringPrograms;
  const addressListId = `station-addresses-${station.id}`;
  return (
    <form className="station-registry__edit" onSubmit={onSubmit}>
      <label>
        Название
        <input name="name" required defaultValue={station.name} />
      </label>
      <label title="Организация, которая эксплуатирует пост или отвечает за программу наблюдений">
        Организация-оператор
        <input name="operator" required defaultValue={station.operator} />
      </label>
      <label>
        Тип
        <select name="station_type" defaultValue={station.station_type}>
          {Object.entries(typeLabel).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="station-registry__edit-address">
        Адрес
        <input
          name="address"
          list={addressListId}
          defaultValue={station.address ?? ""}
          placeholder="Начните вводить адрес для поиска"
        />
        <datalist id={addressListId}>
          {addresses.map((address) => (
            <option key={address} value={address} />
          ))}
        </datalist>
      </label>
      <label>
        Статус
        <select name="status" defaultValue={station.status}>
          {Object.entries(statusLabel).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Долгота WGS‑84
        <input
          name="longitude"
          type="number"
          step="any"
          required
          defaultValue={station.longitude}
        />
      </label>
      <label>
        Широта WGS‑84
        <input
          name="latitude"
          type="number"
          step="any"
          required
          defaultValue={station.latitude}
        />
      </label>
      <RegistryPollutantSelect value={pollutants} onChange={setPollutants} />
      <label>
        Программа наблюдений
        <select
          name="measurement_program"
          defaultValue={station.measurement_program ?? ""}
        >
          <option value="">Не указана</option>
          {programs.map((program) => (
            <option key={program} value={program}>
              {program}
            </option>
          ))}
        </select>
      </label>
      <label>
        Работает с
        <input
          name="valid_from"
          type="date"
          defaultValue={station.valid_from ?? ""}
        />
      </label>
      <label>
        по
        <input
          name="valid_to"
          type="date"
          defaultValue={station.valid_to ?? ""}
        />
      </label>
      <label>
        Источник
        <input
          name="source_url"
          type="url"
          defaultValue={station.source_url ?? ""}
        />
      </label>
      <label>
        Дата источника
        <input
          name="source_date"
          type="date"
          defaultValue={station.source_date ?? ""}
        />
      </label>
      <label>
        Верификация
        <select
          name="verification_status"
          defaultValue={station.verification_status}
        >
          {Object.entries(verificationLabel).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="station-registry__edit-note">
        Примечание
        <textarea name="notes" defaultValue={station.notes ?? ""} />
      </label>
      <div className="station-registry__edit-actions">
        <button className="button button--primary" disabled={busy}>
          Сохранить
        </button>
        <button type="button" className="button" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}

function RegistryPollutantSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (items: string[]) => void;
}) {
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () =>
      pollutantOptions.filter((item) =>
        item.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")),
      ),
    [query],
  );
  const toggle = (item: string) =>
    onChange(
      value.includes(item)
        ? value.filter((current) => current !== item)
        : [...value, item],
    );
  return (
    <label className="station-registry__pollutants">
      Вещества
      <input type="hidden" name="pollutants" value={value.join(", ")} />
      <button
        type="button"
        className="station-registry__select-trigger"
        onClick={() => setOpen((open) => !open)}
        aria-expanded={isOpen}
      >
        {value.length ? `Выбрано: ${value.length}` : "Выберите вещества"}
        <i>⌄</i>
      </button>
      {value.length > 0 && (
        <div className="station-registry__tags">
          {value.map((item) => (
            <button type="button" key={item} onClick={() => toggle(item)}>
              {item}
              <b>×</b>
            </button>
          ))}
        </div>
      )}
      {isOpen && (
        <div className="station-registry__select-menu">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск вещества…"
          />
          {visible.map((item) => (
            <button
              type="button"
              className={
                value.includes(item) ? "station-registry__option--selected" : ""
              }
              key={item}
              onClick={() => toggle(item)}
            >
              <span>{value.includes(item) ? "✓" : ""}</span>
              {item}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}
