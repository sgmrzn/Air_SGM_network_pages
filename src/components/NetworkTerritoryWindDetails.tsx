import type { NetworkSourceWindContext } from "../types";
import { CompactWindRose } from "./CompactWindRose";

export function NetworkTerritoryWindDetails({
  rose,
}: {
  rose: NetworkSourceWindContext["wind_rose"];
}) {
  const aggregation = rose?.territory_aggregation;
  if (!aggregation) return null;
  const maximum =
    Math.ceil(
      Math.max(
        1,
        ...(rose?.directions.map((item) => item.total_frequency) ?? []),
        ...aggregation.cells.flatMap((cell) =>
          cell.wind_rose.directions.map((item) => item.total_frequency),
        ),
      ) / 5,
    ) * 5;
  return (
    <details className="network-territory-wind-details">
      <summary>Данные и ячейки ERA5</summary>
      <p>
        Единая роза для всех точек. Сетка{" "}
        {aggregation.grid_resolution_degrees.toLocaleString("ru-RU")}°; частоты
        взвешены по площади пересечения ячеек с границей территории. Ветер между
        зданиями не учитывается.
      </p>
      {rose?.dataset?.period_start && rose?.dataset?.period_end ? (
        <p>
          Период: {String(rose.dataset.period_start)} —{" "}
          {String(rose.dataset.period_end)}.
        </p>
      ) : null}
      <p>
        Пространственное покрытие территории:{" "}
        {aggregation.spatial_coverage_percent.toLocaleString("ru-RU", {
          maximumFractionDigits: 1,
        })}
        %.
      </p>
      {aggregation.cells.map((cell) => (
        <div key={String(cell.grid_cell.grid_cell_id)}>
          <p>
            Ячейка {String(cell.grid_cell.source_cell_key)} · вес{" "}
            {(cell.weight * 100).toLocaleString("ru-RU", {
              maximumFractionDigits: 1,
            })}
            % · широта {Number(cell.grid_cell.min_lat).toFixed(5)}–
            {Number(cell.grid_cell.max_lat).toFixed(5)} · долгота{" "}
            {Number(cell.grid_cell.min_lon).toFixed(5)}–
            {Number(cell.grid_cell.max_lon).toFixed(5)}
          </p>
          <CompactWindRose
            title={`Ячейка ${String(cell.grid_cell.source_cell_key)}`}
            data={cell.wind_rose}
            showMetrics={false}
            showScaleLabels
            percentScaleMaximum={maximum}
          />
        </div>
      ))}
    </details>
  );
}
