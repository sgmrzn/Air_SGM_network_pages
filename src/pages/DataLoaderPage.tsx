import { useState } from "react";
import { CloudSun, Layers3 } from "lucide-react";

import { LoaderPage } from "./LoaderPage";
import { SpatialLoaderPage } from "./SpatialLoaderPage";

type LoaderTab = "era5" | "spatial";

const tabs: {
  id: LoaderTab;
  title: string;
  description: string;
  Icon: typeof CloudSun;
}[] = [
  {
    id: "era5",
    title: "ERA5",
    description: "Метеоданные и роза ветров",
    Icon: CloudSun,
  },
  {
    id: "spatial",
    title: "Пространственные слои",
    description: "Границы, население, рельеф и источники",
    Icon: Layers3,
  },
];

export function DataLoaderPage({
  onOpenRose,
}: {
  onOpenRose: (jobId: number) => void;
}) {
  const [active, setActive] = useState<LoaderTab>("era5");
  return (
    <div className="data-loader-page">
      <section className="module-card data-loader-intro">
        <div>
          <span>ЕДИНЫЙ ОФЛАЙН-АРХИВ</span>
          <h2>Загрузка данных</h2>
          <p>
            Подготовьте метеоданные и пространственные слои в одном разделе.
            Каждый загрузчик сохраняет данные локально и ведёт собственный журнал.
          </p>
        </div>
        <div className="data-loader-intro__note">
          <b>Рекомендуемый порядок</b>
          <span>Пространственные слои → ERA5 → расчёт покрытия</span>
        </div>
      </section>
      <nav className="data-loader-tabs" aria-label="Тип данных для загрузки">
        {tabs.map(({ id, title, description, Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={active === id ? "page" : undefined}
            className={active === id ? "data-loader-tabs__active" : ""}
            onClick={() => setActive(id)}
          >
            <Icon aria-hidden="true" />
            <span>
              <b>{title}</b>
              <small>{description}</small>
            </span>
          </button>
        ))}
      </nav>
      <div className="data-loader-content">
        {active === "era5" && <LoaderPage onOpenRose={onOpenRose} />}
        {active === "spatial" && <SpatialLoaderPage />}
      </div>
    </div>
  );
}
