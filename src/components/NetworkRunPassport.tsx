import { NetworkDataQualityView } from "./NetworkDataQuality";
import { NetworkTerritoryWindDetails } from "./NetworkTerritoryWindDetails";
import { networkTerritoryWind } from "../shared/networkTerritoryWind";
import type { NetworkDesignRun } from "../types";

export function NetworkRunPassport({
  run,
  windView = "ensemble",
}: {
  run: NetworkDesignRun;
  windView?: string;
}) {
  const manifest = run.reproducibility;
  return (
    <section
      className="network-run-passport"
      aria-label="Паспорт исходного запуска"
    >
      <header className="planning-heading">
        <div>
          <span className="planning-eyebrow">СОХРАНЁННЫЙ ЗАПУСК</span>
          <h3>Паспорт и исходные данные</h3>
          <p>
            Параметры, версии данных и сведения для воспроизведения результата.
          </p>
        </div>
        
      </header>
      <NetworkDataQualityView quality={run.data_quality} />
      {run.scenario_results[0]?.result.placement_evidence?.hazard_status && (
        <div className="notice">
          <p>Учтены отдельные положения МР 2.1.6.0157-19: детализация сетки,
            геометрия площадок и интерполяция розы ветров. Полный алгоритм МР
            не выполнен: данные о выбросах по веществам и концентрациях отсутствуют;
            опасность предприятий и риск для здоровья не определены.</p>
          <p>Промышленный балл описывает расположение объектов, ветер и расстояние.
            Он не учитывает мощность выбросов. Веса комплексного режима 45/25/20/10%
            являются авторскими параметрами сценария, а не коэффициентами МР.</p>
        </div>
      )}
      <NetworkTerritoryWindDetails rose={networkTerritoryWind(run, windView)} />
      <dl>
        <div>
          <dt>Территория</dt>
          <dd>{run.readiness.territory.name}</dd>
        </div>
        <div>
          <dt>Задача сети</dt>
          <dd>
            {run.request.planning_mode === "expand"
              ? "Расширение действующей сети"
              : "Новая сеть с нуля"}
          </dd>
        </div>
        <div>
          <dt>Запрошено постов</dt>
          <dd>{run.request.post_count}</dd>
        </div>
        <div>
          <dt>Сетка и радиус</dt>
          <dd>
            {run.request.grid_km} км · {run.request.radius_m / 1000} км
          </dd>
        </div>
        <div>
          <dt>Идентификатор запуска</dt>
          <dd>
            <code>{run.id}</code>
          </dd>
        </div>
        <div>
          <dt>Версия методики</dt>
          <dd>{run.methodology_version}</dd>
        </div>
        <div>
          <dt>Отпечаток входов</dt>
          <dd>
            <code>{run.input_fingerprint}</code>
          </dd>
        </div>
        <div>
          <dt>Проверка устойчивости</dt>
          <dd>
            {run.request.sensitivity_mode === "standard"
              ? "Включена"
              : "Один основной расчёт"}
          </dd>
        </div>
      </dl>
      <details>
        <summary>Готовность исходных слоёв</summary>
        <div className="network-result-tools__table">
          <table>
            <thead>
              <tr>
                <th>Слой</th>
                <th>Состояние при запуске</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(run.readiness.layers).map(([id, layer]) => (
                <tr key={id}>
                  <td>{layer.label}</td>
                  <td>
                    {layer.status === "ready"
                      ? "Готов"
                      : layer.status === "diagnostic_only"
                        ? "Только диагностика"
                        : "Нет данных"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details>
        <summary>Снимок параметров и версий данных</summary>
        <pre>
          {JSON.stringify(
            { request: run.request, dataset_snapshot: run.dataset_snapshot },
            null,
            2,
          )}
        </pre>
      </details>
      {manifest ? (
        <details>
          <summary>Воспроизводимость и методические источники</summary>
          <p>
            Версия диагностики: {manifest.version}. Python{" "}
            {manifest.runtime.python}.
          </p>
          <p>
            {Object.entries(manifest.runtime.packages)
              .map(
                ([name, version]) => `${name}: ${version ?? "не установлен"}`,
              )
              .join("; ")}
          </p>
          <ul>
            {manifest.limitations.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
          <ul>
            {manifest.method_references.map((item) => (
              <li key={item.url}>
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>{" "}
                — {item.role}
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="planning-help">
          Для этого сохранённого запуска отдельный паспорт воспроизводимости не
          сформирован.
        </p>
      )}
    </section>
  );
}
