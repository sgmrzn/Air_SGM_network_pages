import { useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  FlaskConical,
  Info,
  ShieldCheck,
} from "lucide-react";
import {
  verification as data,
  methodNames,
  methodOrder,
  primary,
  solverStatus,
  type VerificationCase,
  type VerificationMethod,
} from "../shared/networkVerification";
import {
  filterVerificationCases,
  updateVerificationFilters,
  verificationFilterLabels,
  type VerificationFilters,
} from "../shared/networkVerificationFilters";
import { NetworkVerificationMap } from "../components/NetworkVerificationMap";
import { NetworkVerificationCalculation } from "../components/NetworkVerificationCalculation";
import {
  calculations,
  methodGeometryStatus,
  availableVerificationOptions,
} from "../shared/networkVerificationCalculations";
import "./NetworkVerificationPage.css";
const number = (value: number | null | undefined, digits = 0) =>
  value == null
    ? "—"
    : value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
const colors: Record<string, string> = {
  primary_milp: "#186c80",
  greedy_maximum_gain: "#8a65b5",
  spatial_farthest_first: "#b16b27",
  spopt: "#457da9",
};
function Badge({
  kind,
  children,
}: {
  kind?: string;
  children: React.ReactNode;
}) {
  return <span className={`nv-badge ${kind || ""}`}>{children}</span>;
}
function GridChart({
  item,
  onSelect,
  selectedMethod,
}: {
  item: VerificationCase;
  onSelect: (id: string, method: string) => void;
  selectedMethod: string;
}) {
  const series = data.cases
    .filter(
      (c) =>
        c.territory_id === item.territory_id &&
        c.post_count === item.post_count,
    )
    .sort((a, b) => b.grid_km - a.grid_km);
  return (
    <div className="nv-chart">
      <svg
        viewBox="0 0 650 245"
        role="group"
        aria-label="Изменение охвата населения при уточнении сетки"
      >
        {[0, 25, 50, 75, 100].map((value) => (
          <g key={value}>
            <line
              x1="48"
              x2="612"
              y1={194 - value * 1.6}
              y2={194 - value * 1.6}
              stroke="#e1e7ed"
            />
            <text x="38" y={198 - value * 1.6} textAnchor="end">
              {value}%
            </text>
          </g>
        ))}
        {series.map((c, index) => (
          <text key={c.id} x={90 + index * 220} y="225" textAnchor="middle">
            {number(c.grid_km, 2)} км
          </text>
        ))}
        {[selectedMethod].map((method) => {
          const values = series.map((c, index) => ({
            c,
            x: 90 + index * 220,
            y: c.methods.find((m) => m.method === method)?.common_pixel_coverage
              ?.coverage_percent,
          }));
          const present = values.filter((v) => v.y != null);
          return (
            <g key={method}>
              {values
                .slice(1)
                .map((v, index) =>
                  v.y != null && values[index].y != null ? (
                    <line
                      key={v.c.id}
                      x1={values[index].x}
                      y1={194 - values[index].y! * 1.6}
                      x2={v.x}
                      y2={194 - v.y * 1.6}
                      stroke={colors[method]}
                      strokeWidth="2"
                    />
                  ) : null,
                )}
              {present.map((v) => (
                <g
                  key={v.c.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${methodNames[method]}, сетка ${v.c.grid_km} км, охват ${number(v.y, 2)}%`}
                  onClick={() => onSelect(v.c.id, method)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(v.c.id, method);
                    }
                  }}
                >
                  <circle
                    cx={v.x}
                    cy={194 - v.y! * 1.6}
                    r="6"
                    fill={colors[method]}
                    stroke="#fff"
                    strokeWidth="2"
                  />
                  <title>
                    {methodNames[method]}: {number(v.y, 2)}%
                  </title>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="nv-chart-legend">
        {[selectedMethod].map((method) => (
          <span key={method}>
            <i style={{ background: colors[method] }} />
            {methodNames[method]}
          </span>
        ))}
      </div>
      <p>
        Охват посчитан по пригодным исходным пикселям WorldPop в точной границе
        города. Пропуск означает отсутствие расчёта, а не нулевой охват.
      </p>
    </div>
  );
}
export function NetworkVerificationPage() {
  const [city, setCity] = useState("all"),
    [grid, setGrid] = useState("0.5"),
    [count, setCount] = useState("3"),
    [scope, setScope] = useState("all");
  const [selectedId, setSelectedId] = useState(
      () =>
        data.cases.find((c) => c.city === "Рязань" && c.grid_km === 0.5)!.id,
    ),
    [method, setMethod] = useState("primary_milp");
  const [filterNotice, setFilterNotice] = useState("");
  const seriesCases = availableVerificationOptions(data.cases, count);
  const seriesCities = data.cities.filter((city) =>
    seriesCases.some((item) => item.territory_id === city.id),
  );
  const visible = filterVerificationCases(data.cases, {
    city,
    grid,
    count,
    scope,
  });
  function changeFilter(key: keyof VerificationFilters, value: string) {
    const { filters, reset } = updateVerificationFilters(
      data.cases,
      { city, grid, count, scope },
      key,
      value,
      key === "count" || count === "all" ? [] : ["count"],
    );
    setCity(filters.city);
    setGrid(filters.grid);
    setCount(filters.count);
    setScope(filters.scope);
    setFilterNotice(
      reset.length
        ? `Для выбранного варианта нет расчётов с прежними условиями. Сброшены фильтры: ${reset.map((field) => verificationFilterLabels[field]).join(", ")}.`
        : "",
    );
  }
  const item = visible.find((c) => c.id === selectedId) || visible[0];
  const shownMethod =
    item?.methods.find((m) => m.method === method) ||
    (item ? primary(item) : undefined);
  function selectTableCase(id: string) {
    setSelectedId(id);
    requestAnimationFrame(() =>
      document
        .getElementById("nv-selected-case")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  function selectFromChart(id: string, selectedMethod: string) {
    setMethod(selectedMethod);
    setFilterNotice("");
    setGrid("all");
    setScope("all");
    setSelectedId(id);
  }
  function example(name: string, n = 3, h = "0.5") {
    setMethod("primary_milp");
    setFilterNotice("");
    setCity(data.cities.find((c) => c.name === name)!.id);
    setCount(String(n));
    setGrid(h);
    setScope("all");
    setSelectedId(
      data.cases.find(
        (c) => c.city === name && c.post_count === n && c.grid_km === Number(h),
      )!.id,
    );
    document
      .getElementById("nv-results")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return (
    <div className="nv-page">
      <section className="nv-hero">
        <div>
          <span className="nv-eyebrow">
            <FlaskConical size={15} /> ИССЛЕДОВАТЕЛЬСКАЯ СЕРИЯ · 22 ОКТЯБРЯ 2026
          </span>
          <h2>Проверка работоспособности алгоритма</h2>
          <p>
            От исходных данных до кандидатных зон: что проверено, где получено
            решение и какие ограничения остаются.
          </p>
          <div className="nv-hero-tags">
            <span>15 городов</span>
            <span>
              Методика {data.methodology_version.split("-")[2]?.slice(1)}
            </span>
            <span>Новая сеть · R = 2,5 км</span>
            <span>Сетки 1 / 0,5 / 0,25 км</span>
          </div>
        </div>
      </section>
      <div className="nv-scope">
        <Info size={18} />
        <p>
          Проверяется{" "}
          <strong>расчётный компонент предварительного отбора</strong>.
          Полученные точки — ориентиры для обследования. Пригодность площадок,
          концентрации загрязняющих веществ и репрезентативность измерений здесь
          не подтверждаются.
        </p>
      </div>
      <section className="nv-kpis" aria-label="Итоги всей серии">
        <article>
          <span>Территории</span>
          <strong>{data.cities.length}</strong>
          <p>городов разного масштаба</p>
        </article>
        <article>
          <span>Контрольные сочетания</span>
          <strong>{data.summary.recorded}</strong>
          <p>повторы города не независимы</p>
        </article>
        <article>
          <span>Заданное число точек</span>
          <strong>
            {data.summary.classification.completed}
            <small> / {data.summary.planned}</small>
          </strong>
          <p>в одном случае не хватает кандидатов</p>
        </article>
        <article>
          <span>Независимое подтверждение цели</span>
          <strong>
            {data.summary.independent_confirmations}
            <small> / 48 решений</small>
          </strong>
          <p>spopt · та же задача покрытия</p>
        </article>
      </section>
      <nav className="nv-section-nav" aria-label="Содержание проверки">
        <a
          href="#nv-results"
          onClick={(e) => {
            e.preventDefault();
            document
              .getElementById("nv-results")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Результаты по городам
        </a>
        <a
          href="#nv-method"
          onClick={(e) => {
            e.preventDefault();
            document
              .getElementById("nv-method")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Как проверяли
        </a>
        <a
          href="#nv-passport"
          onClick={(e) => {
            e.preventDefault();
            document
              .getElementById("nv-passport")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Паспорт серии
        </a>
      </nav>
      <section id="nv-results" className="nv-section">
        <header className="nv-heading">
          <div>
            <span className="nv-eyebrow">01 · РЕЗУЛЬТАТЫ</span>
            <h3>От общего итога к отдельному расчёту</h3>
            <p>
              Начните с общей проверки на 3 точки. Дополнительная серия
              проверяет задание на 5 точек в двух городах. Это тестовые задания,
              а не рекомендации по необходимому числу постов.
            </p>
          </div>
          <button
            className="nv-button is-light"
            onClick={() => {
              setFilterNotice("");
              setCity("all");
              setGrid("all");
              setCount("all");
              setScope("all");
            }}
          >
            Показать все 49 сочетаний
          </button>
        </header>
        <div
          className="nv-series-switch nv-segmented"
          role="group"
          aria-label="Серия проверки"
        >
          <button
            type="button"
            aria-pressed={count === "3"}
            onClick={() => changeFilter("count", "3")}
          >
            Основная · 3 точки · 15 городов
          </button>
          <button
            type="button"
            aria-pressed={count === "5"}
            onClick={() => changeFilter("count", "5")}
          >
            Дополнительная · 5 точек · 2 города
          </button>
        </div>
        <p className="nv-filter-help" id="nv-filter-help">
          {count === "5"
            ? "Четыре проверки в Спасске-Рязанском и Кораблине на сетках 1 и 0,5 км: хватает ли кандидатов и выполняется ли задание на 5 точек."
            : count === "3"
              ? "Общее задание для 15 городов: 3 точки на сетках 1, 0,5 и 0,25 км — всего 45 случаев. Начальная сетка 0,5 км выбрана для представления; её превосходство не установлено."
              : "Все 49 случаев: 45 основных и 4 дополнительных."}{" "}
          Фильтры обновляют список автоматически. Несовместимые условия
          сбрасываются с пояснением; выбранная серия сохраняется.
        </p>
        <div
          className="nv-filters"
          role="group"
          aria-label="Фильтры расчётов"
          aria-describedby="nv-filter-help"
        >
          <label>
            Город
            <select
              value={city}
              onChange={(e) => changeFilter("city", e.target.value)}
            >
              <option value="all">
                Все города серии ({seriesCities.length})
              </option>
              {seriesCities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Шаг сетки
            <select
              value={grid}
              onChange={(e) => changeFilter("grid", e.target.value)}
            >
              <option value="all">Все сетки</option>
              {[1, 0.5, 0.25].map((h) => (
                <option
                  value={h}
                  key={h}
                  disabled={!seriesCases.some((item) => item.grid_km === h)}
                >
                  {number(h, 2)} км
                </option>
              ))}
            </select>
          </label>
          <details className="nv-filter-details">
            <summary>
              Дополнительный фильтр{scope !== "all" ? " · включён" : ""}
            </summary>
            <label>
              Особенности расчёта
              <select
                value={scope}
                onChange={(e) => changeFilter("scope", e.target.value)}
              >
                <option value="all">Все расчёты</option>
                <option
                  value="review"
                  disabled={
                    !seriesCases.some(
                      (item) => item.feasibility.status === "requires_review",
                    )
                  }
                >
                  Условные зоны
                </option>
                <option
                  value="infeasible"
                  disabled={
                    !seriesCases.some(
                      (item) => item.classification === "infeasible",
                    )
                  }
                >
                  Не хватает кандидатов
                </option>
                <option
                  value="reference"
                  disabled={
                    !seriesCases.some(
                      (item) =>
                        item.classification === "completed" &&
                        !item.independent_confirmation,
                    )
                  }
                >
                  Без независимого подтверждения
                </option>
              </select>
            </label>
          </details>
        </div>
        {filterNotice && (
          <p className="nv-note" role="status">
            {filterNotice}
          </p>
        )}
        <div className="nv-table-caption">
          <span>
            Найдено: <strong>{visible.length}</strong> из {seriesCases.length}{" "}
            случаев выбранной серии
          </span>
          
        </div>
        <p className="nv-selection-help" id="nv-selection-help">
          Нажмите в любом месте строки, чтобы открыть карту и подробности
          расчёта ниже. Выбранная строка выделена цветом.
        </p>
        <div className="nv-table-scroll">
          <table className="nv-table">
            <caption className="nv-sr">
              Результаты проверки. Нажмите строку или кнопку с названием города,
              чтобы открыть расчёт ниже.
            </caption>
            <thead>
              <tr>
                <th>Город / сетка</th>
                <th>Задание</th>
                <th>
                  Охват населения
                  <br />
                  <small>по доступным данным</small>
                </th>
                <th>Результат проверки</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const p = primary(c);
                return (
                  <tr
                    key={c.id}
                    className={`nv-result-row${item?.id === c.id ? " is-selected" : ""}`}
                    onClick={() => selectTableCase(c.id)}
                  >
                    <td>
                      <button
                        type="button"
                        aria-label={`Открыть расчёт: ${c.city}, точек: ${c.post_count}, сетка ${number(c.grid_km, 2)} км`}
                        aria-describedby="nv-selection-help"
                        aria-controls="nv-selected-case"
                        aria-pressed={item?.id === c.id}
                      >
                        {c.city}
                        <ChevronDown size={13} aria-hidden="true" />
                      </button>
                      <small>{number(c.grid_km, 2)} км</small>
                    </td>
                    <td>
                      <strong>
                        {c.feasibility.selected_positions} / {c.post_count}
                      </strong>
                      <small>получено / задано</small>
                    </td>
                    <td>
                      <strong>
                        {number(p?.common_pixel_coverage?.coverage_percent, 2)}
                        {p?.common_pixel_coverage ? "%" : ""}
                      </strong>
                    </td>
                    <td>
                      <Badge
                        kind={
                          c.classification === "infeasible"
                            ? "is-error"
                            : c.feasibility.status === "requires_review"
                              ? "is-amber"
                              : "is-green"
                        }
                      >
                        {c.classification === "infeasible"
                          ? "Недостаточно кандидатов"
                          : c.feasibility.status === "requires_review"
                            ? "Нужна экспертная проверка"
                            : "Точки сформированы"}
                      </Badge>
                      {p?.status === "native_fallback_not_proven" && (
                        <small className="nv-amber-text">
                          Оптимум не доказан
                        </small>
                      )}
                      {c.screening.reduced && (
                        <small className="nv-amber-text">
                          Сокращённый пул кандидатов
                        </small>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visible.length && (
            <div className="nv-empty">
              Для выбранного сочетания фильтров случаев нет. Измените фильтры
              или покажите всю серию.
            </div>
          )}
        </div>
        {item && (
          <article id="nv-selected-case" className="nv-case">
            <header>
              <div>
                <span className="nv-eyebrow">ВЫБРАННЫЙ РАСЧЁТ</span>
                <h3>
                  {item.city}{" "}
                  <span>
                    · N = {item.post_count} · h = {number(item.grid_km, 2)} км
                  </span>
                </h3>
              </div>
              <label>
                Показать метод
                <select
                  value={shownMethod?.method || ""}
                  disabled={!item.methods.length}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {!item.methods.length && (
                    <option value="">Точки отсутствуют</option>
                  )}
                  {methodOrder
                    .filter((m) => item.methods.some((row) => row.method === m))
                    .map((m) => (
                      <option key={m} value={m}>
                        {methodNames[m]}
                      </option>
                    ))}
                </select>
              </label>
            </header>
            <div className="nv-case-workspace">
              <NetworkVerificationMap
                key={item.id + "-" + shownMethod?.method}
                item={item}
                method={shownMethod}
              />
              <aside className="nv-case-evidence">
                <span className="nv-eyebrow">ЧТО ОЗНАЧАЕТ РЕЗУЛЬТАТ</span>
                <h4>
                  {item.classification === "infeasible"
                    ? "Недостаточно кандидатов"
                    : methodGeometryStatus(shownMethod)}
                </h4>
                <p>
                  {item.classification === "infeasible"
                    ? item.feasibility.message
                    : (shownMethod?.requires_review_positions ?? 0) > 0
                      ? `У выбранного метода ${shownMethod?.requires_review_positions} точек с условными ограничениями. Нужна экспертная проверка и обследование площадок.`
                      : "Точки прошли геометрические проверки. Пригодность площадок для установки постов устанавливается обследованием."}
                </p>
                <dl>
                  <div>
                    <dt>Пул кандидатов</dt>
                    <dd>
                      {number(item.screening.screened_count)}
                      {item.screening.reduced &&
                        ` из ${number(item.screening.admissible_total)}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Охват населения по доступным данным</dt>
                    <dd>
                      {number(
                        shownMethod?.common_pixel_coverage?.coverage_percent,
                        2,
                      )}
                      {shownMethod?.common_pixel_coverage ? "%" : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Статус выбранного метода</dt>
                    <dd>{solverStatus(shownMethod?.status)}</dd>
                  </div>
                  <div>
                    <dt>Пиксели без пригодных данных</dt>
                    <dd>
                      {number(item.pixel_field.missing_pixels)} /{" "}
                      {number(item.pixel_field.inside_pixels)} (
                      {number(
                        item.pixel_field.inside_pixels
                          ? (item.pixel_field.missing_pixels /
                              item.pixel_field.inside_pixels) *
                              100
                          : null,
                        1,
                      )}
                      %)
                    </dd>
                  </div>
                </dl>
                {item.screening.reduced && (
                  <p className="nv-note is-amber">
                    Использован сокращённый пул. Подтверждение оптимальности,
                    если оно получено, относится только к этому пулу, а не ко
                    всем потенциальным местам города.
                  </p>
                )}
                <p className="nv-note">
                  Охват рассчитан для геометрического радиуса 2,5 км по
                  пригодным пикселям населения. Пропуски исключены из
                  знаменателя; их доля относится к пикселям, а не к населению.
                  100% не означает доказанную эффективность мониторинга.
                </p>
              </aside>
            </div>
            <NetworkVerificationCalculation item={item} method={shownMethod} />
            <details className="nv-details nv-technical">
              <summary>Подробности: сравнение методов и сеток</summary>
              <div className="nv-analysis-grid">
                <section>
                  <h4>Чувствительность к шагу сетки</h4>
                  <p>
                    Один город, N = {item.post_count}, неизменный радиус 2,5 км.
                    Показан выбранный метод. Нажмите на отметку, чтобы открыть
                    соответствующее сочетание.
                  </p>
                  <GridChart
                    item={item}
                    selectedMethod={shownMethod?.method ?? "primary_milp"}
                    onSelect={selectFromChart}
                  />
                </section>
                <section>
                  <h4>Сравнение методов на одной задаче</h4>
                  <p>
                    Оптимизируется сумма весов ячеек. Охват ниже проверяется
                    отдельно по исходным пикселям.
                  </p>
                  <div className="nv-table-scroll">
                    <table className="nv-table is-compact">
                      <thead>
                        <tr>
                          <th>Метод</th>
                          <th>Цель матрицы</th>
                          <th>Пиксели, %</th>
                          <th>Время, с</th>
                          <th>Потеря к оптимуму, %</th>
                          <th>Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {methodOrder.map((m) => {
                          const row = item.methods.find((r) => r.method === m);
                          return (
                            <tr key={m}>
                              <td>
                                <i
                                  className="nv-dot"
                                  style={{ background: colors[m] }}
                                />
                                {methodNames[m]}
                              </td>
                              <td>{number(row?.objective_value, 3)}</td>
                              <td>
                                {number(
                                  row?.common_pixel_coverage?.coverage_percent,
                                  2,
                                )}
                              </td>
                              <td>{number(row?.duration_seconds, 4)}</td>
                              <td>
                                {number(
                                  row?.loss_to_confirmed_optimum_percent,
                                  3,
                                )}
                              </td>
                              <td>
                                {row
                                  ? solverStatus(row.status)
                                  : m === "spopt" &&
                                      item.reference?.status ===
                                        "reference_skipped_size_limit"
                                    ? "Пропущено: размер задачи"
                                    : "Не выполнялось"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="nv-note">
                    spopt проверяет основную целевую функцию на той же матрице.
                    Совпадение цели не подтверждает исходные данные, вторичный
                    критерий или экологическую эффективность.
                  </p>
                </section>
              </div>
            </details>
          </article>
        )}
      </section>
      <section className="nv-section nv-examples">
        <header className="nv-heading">
          <div>
            <span className="nv-eyebrow">ТРИ ПРИЧИНЫ · ТРИ ДЕЙСТВИЯ</span>
            <h3>Что удалось понять при проверке</h3>
          </div>
        </header>
        <div className="nv-example-grid">
          <article>
            <span>01 · УТОЧНЕНИЕ ДАННЫХ</span>
            <h4>Шацк и Михайлов</h4>
            <p>
              Уточнение жилой застройки позволило сформировать кандидатов.
              Отсутствие зон может быть связано с качеством карты.
            </p>
            <button onClick={() => example("Шацк")}>
              Посмотреть Шацк <ArrowUpRight size={14} />
            </button>
            <button onClick={() => example("Михайлов")}>
              Посмотреть Михайлов <ArrowUpRight size={14} />
            </button>
          </article>
          <article>
            <span>02 · ЭКСПЕРТНАЯ ПРОВЕРКА</span>
            <h4>Спас-Клепики</h4>
            <p>
              Контур национального парка «Мещёрский» обусловил условный статус.
              Ограничения конкретных участков требуют отдельного выяснения.
            </p>
            <button onClick={() => example("Спас-Клепики")}>
              Открыть условные зоны <ArrowUpRight size={14} />
            </button>
          </article>
          <article>
            <span>03 · ДИСКРЕТИЗАЦИЯ</span>
            <h4>Кораблино · пять позиций</h4>
            <p>
              На сетке 1 км — 4 кандидата при заданных 5. Сетка 0,5 км дала 13
              кандидатов и позволила сформировать вариант.
            </p>
            <button onClick={() => example("Кораблино", 5, "1")}>
              Показать нехватку кандидатов <ArrowUpRight size={14} />
            </button>
          </article>
        </div>
      </section>
      <section id="nv-method" className="nv-section">
        <header className="nv-heading">
          <div>
            <span className="nv-eyebrow">02 · МЕТОДИКА ПРОВЕРКИ</span>
            <h3>Что именно подтверждает эта серия</h3>
          </div>
        </header>
        <div className="nv-method-grid">
          <article>
            <span className="nv-step">1</span>
            <h4>Зафиксировали входы</h4>
            <p>
              Версия алгоритма, границы, жилые контуры, ограничения, население и
              матрицы закреплены контрольными суммами до повторного решения.
            </p>
          </article>
          <article>
            <span className="nv-step">2</span>
            <h4>Решили 49 задач</h4>
            <p>
              По три сетки для N = 3 в каждом городе: 45 сочетаний. Ещё четыре —
              N = 5 в Спасске-Рязанском и Кораблине при h = 1 и 0,5 км.
            </p>
          </article>
          <article>
            <span className="nv-step">3</span>
            <h4>Сопоставили методы</h4>
            <p>
              Основной алгоритм, последовательное добавление, пространственное
              разнесение и spopt. Слишком большие независимые задачи явно
              пропущены.
            </p>
          </article>
          <article>
            <span className="nv-step">4</span>
            <h4>Пересчитали показатели</h4>
            <p>
              Прямой контроль агрегации, координат, объединений покрытия и
              исходных пикселей. Пропуски населения не восстанавливались.
            </p>
          </article>
        </div>
        <div className="nv-audit">
          <ShieldCheck size={23} />
          <div>
            <h4>Контрольный пересчёт: выполнен</h4>
            <p>
              Проверено {number(data.audit.cell_weights_checked)} весов ячеек,{" "}
              {number(data.audit.distance_matrix_rows_checked)} строк матриц,{" "}
              {number(data.audit.algorithm_objectives_recomputed)} значений
              цели, {number(data.audit.common_pixel_metrics_recomputed)}{" "}
              показателей охвата и{" "}
              {number(data.audit.selected_geometry_checked_points)} координат.
              Это контроль реализации, а не новый набор оптимизаций.
            </p>
          </div>
        </div>
        <details className="nv-details">
          <summary>
            Как читать статусы и сравнения <ChevronDown size={17} />
          </summary>
          <div>
            <p>
              <strong>48 из 49</strong> — сформировано заданное число позиций.
              Три завершённых сочетания имеют условные территориальные
              ограничения; 45 — статус зон для обследования.
            </p>
            <p>
              <strong>45 из 48 решений</strong> — основной решатель подтвердил
              оптимум. В трёх случаях сохранено резервное решение без
              доказанного оптимума.
            </p>
            <p>
              <strong>41 из 48 решений</strong> — получено независимое
              подтверждение основной цели. Отсутствие подтверждения и ошибка —
              разные статусы. При сокращении пула вывод ограничен
              использованными кандидатами.
            </p>
            <p>
              <strong>Матричная цель</strong> использует веса расчётных ячеек.{" "}
              <strong>Пиксельный охват</strong> использует пригодное население в
              точной городской границе, учитывая перекрытия один раз. Эти
              численные показатели не обязаны совпадать.
            </p>
            <p>
              Серия диагностическая, выполнена после исправления чтения растров.
              49 сочетаний не являются 49 независимыми территориями. Срез 0,5 км
              выбран после расчётов для представления; его преимущество не
              установлено. Сравнение времени относится к сохранённым запускам, а
              не к универсальной скорости методов.
            </p>
          </div>
        </details>
      </section>
      <section id="nv-passport" className="nv-section">
        <header className="nv-heading">
          <div>
            <span className="nv-eyebrow">03 · ВОСПРОИЗВОДИМОСТЬ</span>
            <h3>Паспорт исследовательской серии</h3>
            <p>
              Исправленная ревизия показана отдельно от пилота 15 октября и
              предыдущих серий. Их результаты не объединены. Выводы этой
              проверки не распространяются автоматически на другие версии и
              архивные расчёты.
            </p>
          </div>
        </header>
        <details className="nv-details">
          <summary>Версии, контрольные суммы и выгрузки</summary>
          <div>
            <dl className="nv-passport">
              <div>
                <dt>Протокол</dt>
                <dd>{data.protocol_id}</dd>
              </div>
              <div>
                <dt>Версия методики</dt>
                <dd>{data.methodology_version}</dd>
              </div>
              <div>
                <dt>Область проверки</dt>
                <dd>15 городов · 49 сочетаний · 45 снимков входов</dd>
              </div>
              <div>
                <dt>Контрольный пересчёт</dt>
                <dd>
                  22 октября 2026 ·{" "}
                  {data.audit.status === "verified"
                    ? "согласованность подтверждена"
                    : "статус не подтверждён"}
                </dd>
              </div>
              <div>
                <dt>SHA256 протокола</dt>
                <dd>
                  <code>{data.audit.protocol_sha256}</code>
                </dd>
              </div>
              <div>
                <dt>SHA256 скрипта контрольного пересчёта</dt>
                <dd>
                  <code>{data.audit.implementation_sha256}</code>
                </dd>
              </div>
            </dl>
            <p className="nv-note">
              Серия включает 12 городов Рязанской области, Пермь, Москву и
              Санкт-Петербург. Это исследовательские территории; региональный
              каталог проектирования не расширяется.
            </p>


          </div>
        </details>
      </section>
    </div>
  );
}
