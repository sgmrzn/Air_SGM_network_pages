import { useEffect, useState } from "react";
import {
  Building2,
  Route,
  ShieldOff,
  Search,
  Database,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Users,
  Wind,
} from "lucide-react";
import {
  PopulationRasterViewer,
  StoredEra5Viewer,
} from "../components/NetworkPrimaryViewers";
import {
  InputOverview,
  InputVectorMap,
  VectorPassport,
  RasterMeteoPassport,
  inputLayerNames,
  inputTypeNames,
  relationNames,
  number,
  date,
} from "../components/NetworkInputEvidence";
import type {
  InputLayer,
  InputPassport,
  VectorData,
} from "../components/NetworkInputEvidence";
import { fetchNetworkTerritories } from "../api";
import { DEFAULT_TERRITORY } from "../defaults";
import { request } from "../shared/http";
import type { NetworkTerritory } from "../types";
import "./NetworkInputsPage.css";

const icons = {
  residential: Building2,
  roads: Route,
  constraints: ShieldOff,
  population: Users,
  hourly: Wind,
};
export function NetworkInputsPage() {
  const [query, setQuery] = useState(DEFAULT_TERRITORY.name);
  const [territories, setTerritories] = useState<NetworkTerritory[]>([]);
  const [selectedTerritory, setSelectedTerritory] =
    useState<NetworkTerritory | null>(DEFAULT_TERRITORY);
  const territory = selectedTerritory?.id || "";
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [layer, setLayer] = useState<InputLayer>("residential");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<VectorData | null>(null);
  const [passport, setPassport] = useState<InputPassport | null>(null);
  const [passportError, setPassportError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [showOutside, setShowOutside] = useState(false);
  const [relation, setRelation] = useState("all");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    const search = query.trim();
    setTerritories([]);
    setSearchError("");
    if (search.length < 2) {
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      fetchNetworkTerritories("settlement", search)
        .then((items) => {
          if (active) setTerritories(items);
        })
        .catch((e) => {
          if (active) setSearchError(String(e));
        })
        .finally(() => {
          if (active) setSearchLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);
  useEffect(() => {
    setPassport(null);
    setPassportError("");
    if (!territory) return;
    const controller = new AbortController();
    request<InputPassport>(
      `/api/spatial/network-design/input-passport?territory_id=${encodeURIComponent(territory)}`,
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) setPassport(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setPassportError(String(e));
      });
    return () => controller.abort();
  }, [territory, revision]);
  useEffect(() => {
    setData(null);
    setError("");
    setSelectedId("");
    setOffset(0);
    setRelation("all");
    if (!territory || layer === "population" || layer === "hourly") {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    request<VectorData>(
      `/api/spatial/network-design/input-layer?${new URLSearchParams({ territory_id: territory, layer })}`,
      { signal: controller.signal },
    )
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(String(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [territory, layer, revision]);

  function selectLayer(value: InputLayer) {
    setLayer(value);
    setOffset(0);
  }
  function selectObject(id: string) {
    setSelectedId(id);
    const index = filtered.findIndex((feature) => feature.properties.id === id);
    if (index >= 0) setOffset(Math.floor(index / 25) * 25);
  }
  const filtered =
    data?.features.filter(
      (feature) =>
        relation === "all" || feature.properties.spatial_relation === relation,
    ) || [];
  const selected = data?.features.find(
    (feature) => feature.properties.id === selectedId,
  )?.properties;
  const summaryMismatch =
    data &&
    passport &&
    passport.vectors[data.layer].content_sha256 !== data.summary.content_sha256;

  return (
    <div className="module-page network-inputs">
      <section className="module-card network-inputs__shell">
        <header className="network-inputs__head">
          <div>
            <span className="network-inputs__eyebrow">
              МОДУЛЬ 1 · ПРОИСХОЖДЕНИЕ И КАЧЕСТВО ДАННЫХ
            </span>
            <h2>Паспорт исходных данных территории</h2>
            <p>
              Состав, пространственное покрытие и ограничения данных для
              проектирования сети.
            </p>
          </div>
          <span className="network-inputs__badge">
            <Database aria-hidden="true" />
            Снимок публикации
          </span>
        </header>
        <div className="network-inputs__filters">
          <label htmlFor="network-inputs-search">
            Поиск населённого пункта
            <div className="network-inputs__search">
              <Search aria-hidden="true" />
              <input
                id="network-inputs-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Не менее 2 символов, например Рязань"
                aria-describedby="network-inputs-search-status"
              />
            </div>
            <small id="network-inputs-search-status" role="status">
              {query.trim().length < 2
                ? "Введите не менее 2 символов для поиска."
                : searchLoading
                  ? "Ищем территории…"
                  : searchError
                    ? "Не удалось найти территории. Измените запрос, чтобы повторить."
                    : territories.length
                      ? `Найдено: ${territories.length}. Выберите территорию справа.`
                      : "Территории не найдены. Уточните название."}
            </small>
          </label>
          <label htmlFor="network-inputs-territory">
            Территория
            <select
              id="network-inputs-territory"
              value={territory}
              onChange={(e) => {
                setSelectedTerritory(
                  territories.find((t) => t.id === e.target.value) ||
                    (selectedTerritory?.id === e.target.value
                      ? selectedTerritory
                      : null),
                );
                setOffset(0);
              }}
            >
              <option value="">Выберите из найденных территорий</option>
              {selectedTerritory &&
                !territories.some((t) => t.id === territory) && (
                  <option value={territory}>
                    {selectedTerritory.label || selectedTerritory.name}
                  </option>
                )}
              {territories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label || t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {territory && (
          <div className="input-evidence__scope">
            <p>
              Опубликованный снимок исходных данных территории. Версии и происхождение
              показаны в сводном паспорте. Версии конкретного расчёта
              зафиксированы отдельно в его паспорте; готовые расчёты не пересчитываются.
            </p>
            <div>
              <button
                className="button button--ghost"
                onClick={() => setRevision((value) => value + 1)}
              >
                Обновить
              </button>
              
            </div>
          </div>
        )}
        {passportError && (
          <div className="form-error" role="alert">
            Не удалось подготовить сводный паспорт: {passportError}
          </div>
        )}
        {territory && !passport && !passportError && (
          <p className="input-evidence__loading" role="status">
            Проверяем геометрию, метаданные и покрытие территории…
          </p>
        )}
        {passport && (
          <InputOverview
            passport={passport}
            layer={layer}
            onSelect={selectLayer}
          />
        )}
        <div
          className="network-inputs__tabs"
          role="group"
          aria-label="Исходный слой"
        >
          {(Object.keys(inputLayerNames) as InputLayer[]).map((key) => {
            const Icon = icons[key];
            return (
              <button
                type="button"
                key={key}
                aria-pressed={layer === key}
                className={layer === key ? "is-active" : ""}
                onClick={() => selectLayer(key)}
              >
                <Icon aria-hidden="true" />
                {inputLayerNames[key]}
              </button>
            );
          })}
        </div>
        {!territory && (
          <div className="network-inputs__empty">
            <MapPin aria-hidden="true" />
            <h3>Выберите территорию</h3>
            <p>
              Введите не менее 2 символов названия города и выберите его в
              списке.
            </p>
          </div>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {summaryMismatch && (
          <p className="input-evidence__warning">
            Набор изменился во время подготовки сводки. Обновите паспорт для
            согласования версий. Карта и показатели слоя ниже относятся к одной
            выборке.
          </p>
        )}
        {territory && (layer === "population" || layer === "hourly") && (
          <>
            {passport && (
              <RasterMeteoPassport passport={passport} layer={layer} />
            )}
            {layer === "population" ? (
              <PopulationRasterViewer
                key={territory + revision}
                territory={territory}
              />
            ) : (
              <StoredEra5Viewer />
            )}
          </>
        )}
        {loading && (
          <div className="network-inputs__empty" role="status">
            <Database aria-hidden="true" />
            <h3>Готовим карту и показатели слоя…</h3>
          </div>
        )}
        {data && layer !== "population" && layer !== "hourly" && (
          <>
            <div className="network-inputs__toolbar">
              <div>
                <h3>{inputLayerNames[data.layer]}</h3>
                <span>
                  {number(data.summary.total, 0)} объектов в полной выборке ·{" "}
                  {selectedTerritory?.name}
                </span>
              </div>
              
            </div>
            <VectorPassport summary={data.summary} />
            <div className="input-evidence__map-controls">
              <label>
                <input
                  type="checkbox"
                  checked={showOutside}
                  onChange={(e) => setShowOutside(e.target.checked)}
                />
                Показывать также объекты вне границы
              </label>
            </div>
            <InputVectorMap
              data={data}
              selectedId={selectedId}
              onSelect={selectObject}
              showOutside={showOutside}
            />
            {selected && (
              <div className="input-evidence__object" role="status">
                <strong>
                  {selected.name ||
                    inputTypeNames[selected.feature_type] ||
                    selected.feature_type}
                </strong>
                <code>{selected.id}</code>
                <span>
                  {relationNames[selected.spatial_relation]} · внутри границы:{" "}
                  {number(selected.area_inside_km2)} км² /{" "}
                  {number(selected.length_inside_km)} км линейной геометрии
                </span>
                {selected.restriction_policy && (
                  <span>
                    {selected.restriction_policy === "review"
                      ? "Требуется экспертная проверка ограничений"
                      : "Исключающая маска при включённом учёте ограничений"}
                  </span>
                )}
              </div>
            )}
            <div className="input-evidence__table-head">
              <div>
                <h3>Объекты и измеряемые характеристики</h3>
                <p>
                  Площади и длины в строках — внутри границы. Пересечения
                  объектов в строках могут повторяться; сводные площади
                  рассчитаны по объединению.
                </p>
              </div>
              <label>
                Расположение
                <select
                  value={relation}
                  onChange={(e) => {
                    setRelation(e.target.value);
                    setOffset(0);
                  }}
                >
                  <option value="all">Вся выборка</option>
                  {Object.entries(relationNames).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="network-inputs__table">
              <table>
                <thead>
                  <tr>
                    <th>Объект</th>
                    <th>Класс</th>
                    <th>Расположение</th>
                    <th>Площадь, км²</th>
                    <th>Линейная длина, км</th>
                    <th>Импорт</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(offset, offset + 25).map((feature) => {
                    const item = feature.properties;
                    return (
                      <tr
                        key={item.id}
                        className={selectedId === item.id ? "is-selected" : ""}
                      >
                        <td>
                          <button
                            className="input-evidence__text-button"
                            disabled={!feature.geometry}
                            onClick={() => {
                              if (item.spatial_relation === "outside")
                                setShowOutside(true);
                              selectObject(item.id);
                            }}
                          >
                            {item.name ||
                              inputTypeNames[item.feature_type] ||
                              "Объект без названия"}
                          </button>
                          <small>{item.id}</small>
                        </td>
                        <td>
                          {inputTypeNames[item.feature_type] ||
                            item.feature_type}
                        </td>
                        <td>{relationNames[item.spatial_relation]}</td>
                        <td>{number(item.area_inside_km2, 4)}</td>
                        <td>{number(item.length_inside_km, 3)}</td>
                        <td>{date(item.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!filtered.length && (
              <p className="input-evidence__loading">
                Объектов с выбранным расположением нет.
              </p>
            )}
            <footer className="network-inputs__pagination">
              <span>
                {filtered.length ? offset + 1 : 0}–
                {Math.min(offset + 25, filtered.length)} из{" "}
                {number(filtered.length, 0)}
              </span>
              <div>
                <button
                  className="button button--ghost"
                  aria-label="Предыдущая страница"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 25))}
                >
                  <ChevronLeft aria-hidden="true" />
                  Назад
                </button>
                <button
                  className="button button--ghost"
                  aria-label="Следующая страница"
                  disabled={offset + 25 >= filtered.length}
                  onClick={() => setOffset(offset + 25)}
                >
                  Далее
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </footer>

          </>
        )}
      </section>
    </div>
  );
}
