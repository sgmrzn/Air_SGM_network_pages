import { useState } from "react";
import { MonitoringStationsPanel } from "./MonitoringStationsPanel";
import { StationRegistryPanel } from "./StationRegistryPanel";
import { StationMapPanel } from "./StationMapPanel";

export function StationsPage() {
  const [tab, setTab] = useState<"registry" | "map" | "manual">("registry");
  return (
    <div className="module-page spatial-loader-page">
      <section className="station-workspace">
        <div
          className="station-tabs"
          role="tablist"
          aria-label="Работа с реестром"
        >
          <button
            role="tab"
            aria-selected={tab === "registry"}
            className={tab === "registry" ? "station-tabs__item--active" : ""}
            onClick={() => setTab("registry")}
          >
            Реестр постов
          </button>
          <button role="tab" aria-selected={tab === "map"} className={tab === "map" ? "station-tabs__item--active" : ""} onClick={() => setTab("map")}>Карта постов</button>
          <button
            role="tab"
            aria-selected={tab === "manual"}
            className={tab === "manual" ? "station-tabs__item--active" : ""}
            onClick={() => setTab("manual")}
          >
            Добавить пост вручную
          </button>
        </div>
        <div className="station-tab-content">
          {tab === "registry" && <StationRegistryPanel />}
          {tab === "map" && <StationMapPanel />}
          {tab === "manual" && (
            <MonitoringStationsPanel onSaved={() => setTab("registry")} />
          )}
        </div>
      </section>
    </div>
  );
}
