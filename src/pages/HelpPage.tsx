const MODULES = [
  {
    title: "Загрузчик ERA5",
    status: "Работает",
    text: "Сохраняет месячные метеоагрегаты по национальной сетке. Загрузка возобновляется с последнего сохранённого месяца.",
  },
  {
    title: "Пространственные слои",
    status: "Работает",
    text: "Загружает границы, население WorldPop, рельеф Copernicus DEM и справочные реестры постов и источников.",
  },
  {
    title: "Покрытие данных",
    status: "Работает",
    text: "Показывает фактически сохранённые ERA5 и состояние пространственных слоёв; обновляется автоматически.",
  },
  {
    title: "Роза ветров",
    status: "Работает",
    text: "Строит розу ветров по локальным агрегатам ERA5 без повторного обращения к внешним сервисам.",
  },
  {
    title: "Сеть мониторинга",
    status: "Работает",
    text: "Карта показывает действующие посты, расчётные кандидатные зоны и предварительные точки размещения. Предварительная точка является ориентиром: до утверждения необходимы полевая и инженерная проверка площадки, оценка безопасности, питания и связи, а при необходимости — расчёт рассеивания.",
  },
  {
    title: "Покрытие населения",
    status: "Работает",
    text: "Оценивает охват WorldPop существующими постами в радиусном, ветровом и рельефно-чувствительном режимах.",
  },
];

export function HelpPage() {
  return (
    <div className="module-page help-page">
      <section className="module-intro help-intro">
        <div>
          <span>СПРАВКА СИСТЕМЫ</span>
          <h2>Как устроена Air SGM</h2>
          <p>
            Краткое описание рабочих модулей, данных и порядка подготовки
            расчётов.
          </p>
        </div>
        <div className="dataset-chip">
          <strong>Принцип работы</strong>
          <span>Исходные данные → локальные агрегаты и слои → анализ</span>
        </div>
      </section>

      <section className="module-card help-card">
        <div className="module-card__head">
          <div>
            <span>ТЕКУЩИЕ МОДУЛИ</span>
            <h3>Возможности системы</h3>
          </div>
        </div>
        <div className="help-module-grid">
          {MODULES.map((module) => (
            <article key={module.title}>
              <div>
                <strong>{module.title}</strong>
                <i
                  className={
                    module.status === "Работает" ? "help-status--ready" : ""
                  }
                >
                  {module.status}
                </i>
              </div>
              <p>{module.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="help-rule-grid">
        <article className="module-card help-rule">
          <span>ПОРЯДОК ЗАГРУЗКИ</span>
          <h3>Сначала — национальные слои</h3>
          <p>
            ERA5 подготавливается по всей России помесячно. WorldPop, границы,
            рельеф и реестры загружаются как версионируемые пространственные
            наборы и повторно используются в расчётах.
          </p>
        </article>
        <article className="module-card help-rule">
          <span>СТАТУС ДАННЫХ</span>
          <h3>Где проверить готовность</h3>
          <p>
            Раздел «Покрытие данных» — единое место контроля загрузок. Журналы
            конкретных задач доступны на страницах ERA5 и пространственных
            слоёв.
          </p>
        </article>
      </section>

      <section className="module-card help-card help-sources">
        <div className="module-card__head">
          <div>
            <span>ИСТОЧНИКИ</span>
            <h3>Какие данные использует система</h3>
          </div>
        </div>
        <div>
          <article>
            <strong>Google Earth Engine</strong>
            <span>ERA5 — получение и месячная агрегация метеоданных.</span>
          </article>
          <article>
            <strong>OpenStreetMap / Geofabrik</strong>
            <span>Границы населённых пунктов и базовая география.</span>
          </article>
          <article>
            <strong>WorldPop и Copernicus DEM</strong>
            <span>Население и рельеф для расчёта покрытия и проверки чувствительности.</span>
          </article>
          <article>
            <strong>Локальные реестры</strong>
            <span>
              CSV или GeoJSON для известных источников и тематических зон.
            </span>
          </article>
        </div>
      </section>
    </div>
  );
}
