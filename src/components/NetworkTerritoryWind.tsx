import type { NetworkSourceWindContext } from "../types";
import { CompactWindRose } from "./CompactWindRose";

export function NetworkTerritoryWind({
  rose,
  territory,
}: {
  rose: NetworkSourceWindContext["wind_rose"];
  territory: string;
}) {
  return (
    <section
      className="network-territory-wind"
      aria-label="Ветер населённого пункта"
    >
      {rose ? (
        <>
          <CompactWindRose
            title={`Роза ветров · ${territory}`}
            data={rose}
            showScaleLabels
            leadingDirections={rose.summary?.leading_directions}
            prevailingDirection={rose.summary?.prevailing_direction}
            prevailingDegrees={rose.summary?.prevailing_degrees}
            prevailingFrequency={rose.summary?.prevailing_frequency}
            averageSpeed={rose.summary?.mean_speed}
            calmPercent={rose.summary?.calm_percent}
            observationCount={rose.summary?.observations_count}
          />
          <p className="network-zone-card__wind-caption">
            ERA5
            {rose.dataset?.period_start && rose.dataset?.period_end
              ? ` · ${String(rose.dataset.period_start).slice(0, 4)}–${String(rose.dataset.period_end).slice(0, 4)}`
              : ""}
            {rose.summary?.observations_count != null
              ? ` · ${rose.summary.observations_count.toLocaleString("ru-RU")} ч.`
              : ""}
          </p>
          <details className="network-zone-card__details">
            <summary>Примечание</summary>
            <p>
              Лепестки показывают, откуда приходит ветер. Длина — повторяемость,
              цвет — класс скорости. Стрелки на карте направлены к выбранной
              точке.
            </p>
            <p>
              Штиль — скорость менее 0,5 м/с. Сектор на карте не показывает
              дальность переноса загрязнения.
            </p>
          </details>
        </>
      ) : (
        <>
          <h4>Ветер населённого пункта</h4>
          <p className="planning-help">
            Для этого сохранённого запуска общая роза ветров территории
            недоступна.
          </p>
        </>
      )}
    </section>
  );
}
