import { useEffect, useMemo, useState, type FormEvent } from "react";

type FormState = Record<string, string>;
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
const emptyForm: FormState = {
  name: "",
  operator: "",
  station_type: "stationary",
  status: "active",
  address: "",
  latitude: "",
  longitude: "",
  measurement_program: "",
  valid_from: "",
  valid_to: "",
  source_url: "",
  source_date: "",
  verification_status: "source_reported",
  notes: "",
};

export function MonitoringStationsPanel({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [addresses, setAddresses] = useState<string[]>([]);
  const [pollutants, setPollutants] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (name: string, value: string) =>
    setForm((current) => ({ ...current, [name]: value }));
  useEffect(() => {
    void fetch("/api/spatial/monitoring-stations/addresses")
      .then((response) =>
        response.ok ? (response.json() as Promise<string[]>) : [],
      )
      .then(setAddresses);
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/spatial/monitoring-stations", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.detail ?? "Не удалось сохранить пост");
      setForm(emptyForm);
      setPollutants([]);
      setMessage(`Пост «${result.name}» добавлен в реестр.`);
      onSaved();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="module-card station-entry">
      <div className="module-card__head">
        <div>
          <span>РУЧНОЙ ВВОД · ЛОКАЛЬНЫЙ РЕЕСТР</span>
          <h3>Новый пост мониторинга</h3>
          <p>
            Укажите фактические координаты, адрес и сведения из первичного
            документа или ответа оператора.
          </p>
        </div>
      </div>
      <form
        className="station-entry__form"
        onSubmit={(event) => void submit(event)}
      >
        <fieldset>
          <legend>Основные сведения</legend>
          <div className="station-entry__grid station-entry__grid--main">
            <Field label="Название поста" required>
              <input
                name="name"
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Например, ПНЗ № 1"
              />
            </Field>
            <Field label="Организация-оператор" required>
              <input
                name="operator"
                required
                value={form.operator}
                onChange={(e) => set("operator", e.target.value)}
                placeholder="ФГБУ «Центральное УГМС»"
              />
            </Field>
            <Field label="Тип">
              <select
                name="station_type"
                value={form.station_type}
                onChange={(e) => set("station_type", e.target.value)}
              >
                <option value="stationary">Стационарный</option>
                <option value="route">Маршрутный</option>
                <option value="mobile">Передвижной</option>
                <option value="background">Фоновый</option>
              </select>
            </Field>
            <Field label="Статус">
              <select
                name="status"
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                <option value="active">Действует</option>
                <option value="inactive">Закрыт</option>
                <option value="planned">Планируется</option>
                <option value="unknown">Не подтверждён</option>
              </select>
            </Field>
          </div>
        </fieldset>
        <fieldset>
          <legend>Расположение и программа</legend>
          <div className="station-entry__grid station-entry__grid--location">
            <Field label="Адрес" wide>
              <input
                name="address"
                list="station-address-directory"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Начните вводить адрес для поиска в справочнике"
              />
              <datalist id="station-address-directory">
                {addresses.map((address) => (
                  <option key={address} value={address} />
                ))}
              </datalist>
            </Field>
            <Field label="Широта, WGS‑84" required>
              <input
                name="latitude"
                type="number"
                step="any"
                required
                value={form.latitude}
                onChange={(e) => set("latitude", e.target.value)}
                placeholder="54.6269"
              />
            </Field>
            <Field label="Долгота, WGS‑84" required>
              <input
                name="longitude"
                type="number"
                step="any"
                required
                value={form.longitude}
                onChange={(e) => set("longitude", e.target.value)}
                placeholder="39.6916"
              />
            </Field>
            <PollutantSelect value={pollutants} onChange={setPollutants} />
            <Field label="Программа наблюдений" wide>
              <input
                name="measurement_program"
                value={form.measurement_program}
                onChange={(e) => set("measurement_program", e.target.value)}
                placeholder="Например, круглосуточная программа"
              />
            </Field>
          </div>
        </fieldset>
        <fieldset>
          <legend>Происхождение и проверка</legend>
          <div className="station-entry__grid">
            <Field label="Ссылка на источник">
              <input
                name="source_url"
                type="url"
                value={form.source_url}
                onChange={(e) => set("source_url", e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field label="Дата сведений">
              <input
                name="source_date"
                type="date"
                value={form.source_date}
                onChange={(e) => set("source_date", e.target.value)}
              />
            </Field>
            <Field label="Статус проверки">
              <select
                name="verification_status"
                value={form.verification_status}
                onChange={(e) => set("verification_status", e.target.value)}
              >
                <option value="source_reported">Указано в источнике</option>
                <option value="verified">Подтверждено оператором</option>
                <option value="unverified">Не проверено</option>
              </select>
            </Field>
            <Field label="Период работы с">
              <input
                name="valid_from"
                type="date"
                value={form.valid_from}
                onChange={(e) => set("valid_from", e.target.value)}
              />
            </Field>
            <Field label="по">
              <input
                name="valid_to"
                type="date"
                value={form.valid_to}
                onChange={(e) => set("valid_to", e.target.value)}
              />
            </Field>
            <Field label="Примечание" wide>
              <textarea
                name="notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Реквизиты документа или сведения, которые нужно уточнить…"
              />
            </Field>
          </div>
        </fieldset>
        <div className="station-entry__actions">
          <span>
            Поля со звёздочкой обязательны. Для использования в анализе укажите
            первоисточник и статус проверки.
          </span>
          <button className="button button--primary" disabled={busy}>
            {busy ? "Сохранение…" : "Добавить в реестр"}
          </button>
        </div>
      </form>
      {message && <div className="station-entry__message">{message}</div>}
    </section>
  );
}

function PollutantSelect({
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
    <label className="station-entry__pollutants station-entry__field--wide">
      <span>Вещества</span>
      <input type="hidden" name="pollutants" value={value.join(", ")} />
      <button
        className="station-entry__select-trigger"
        type="button"
        aria-expanded={isOpen}
        onClick={() => setOpen((open) => !open)}
      >
        {value.length ? `Выбрано: ${value.length}` : "Выберите вещества"}
        <i>⌄</i>
      </button>
      {value.length > 0 && (
        <div className="station-entry__tags">
          {value.map((item) => (
            <button type="button" key={item} onClick={() => toggle(item)}>
              {item}
              <b aria-label={`Удалить ${item}`}>×</b>
            </button>
          ))}
        </div>
      )}
      {isOpen && (
        <div className="station-entry__select-menu">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск вещества…"
          />
          {visible.length ? (
            <div>
              {visible.map((item) => (
                <button
                  type="button"
                  className={
                    value.includes(item)
                      ? "station-entry__option--selected"
                      : ""
                  }
                  key={item}
                  onClick={() => toggle(item)}
                >
                  <span>{value.includes(item) ? "✓" : ""}</span>
                  {item}
                </button>
              ))}
            </div>
          ) : (
            <small>Ничего не найдено</small>
          )}
        </div>
      )}
    </label>
  );
}

function Field({
  label,
  required,
  wide,
  children,
}: {
  label: string;
  required?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={wide ? "station-entry__field--wide" : ""}>
      <span>
        {label}
        {required && " *"}
      </span>
      {children}
    </label>
  );
}
