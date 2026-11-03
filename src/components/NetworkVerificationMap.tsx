import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Minus, Plus, RotateCcw } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { baseMapStyle } from "../mapStyle";
import {
  verification as data,
  type VerificationCase,
  type VerificationMethod,
} from "../shared/networkVerification";
const number = (value: number, digits = 0) =>
  value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
const colors: Record<string, string> = {
  primary_milp: "#186c80",
  greedy_maximum_gain: "#8a65b5",
  spatial_farthest_first: "#b16b27",
  spopt: "#457da9",
};

function radiusRing(point: number[], radius: number) {
  const lat = (point[1] * Math.PI) / 180,
    lon = (point[0] * Math.PI) / 180,
    distance = radius / 6371008.8;
  return Array.from({ length: 73 }, (_, i) => {
    const angle = (i * 5 * Math.PI) / 180;
    const p = Math.asin(
      Math.sin(lat) * Math.cos(distance) +
        Math.cos(lat) * Math.sin(distance) * Math.cos(angle),
    );
    const l =
      lon +
      Math.atan2(
        Math.sin(angle) * Math.sin(distance) * Math.cos(lat),
        Math.cos(distance) - Math.sin(lat) * Math.sin(p),
      );
    return [(l * 180) / Math.PI, (p * 180) / Math.PI];
  });
}

function StreetMap({
  item,
  method,
  showRings,
  active,
  onSelect,
}: {
  item: VerificationCase;
  method: VerificationMethod | undefined;
  showRings: boolean;
  active: number;
  onSelect: (index: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const buttons = useRef<HTMLButtonElement[]>([]);
  const ringsVisible = useRef(showRings);
  ringsVisible.current = showRings;
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!container.current) return;
    setNotice("");
    const boundary = data.cities.find(
      (city) => city.id === item.territory_id,
    )!.boundary;
    const points = method?.coordinates ?? [];
    const color = colors[method?.method ?? "primary_milp"];
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: baseMapStyle,
        center: [40, 55],
        zoom: 5,
      });
    } catch {
      setNotice(
        "Карта недоступна в этом браузере. Переключитесь на схему — она работает без подложки.",
      );
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-left");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }));
    const bounds = new maplibregl.LngLatBounds();
    function collect(value: unknown) {
      if (!Array.isArray(value)) return;
      if (typeof value[0] === "number" && typeof value[1] === "number")
        bounds.extend([value[0], value[1]]);
      else value.forEach(collect);
    }
    function collectGeometry(geometry: GeoJSON.Geometry) {
      if (geometry.type === "GeometryCollection")
        geometry.geometries.forEach(collectGeometry);
      else collect(geometry.coordinates);
    }
    collectGeometry(boundary);
    const rings = points.map((point) => radiusRing(point, item.radius_m));
    rings.forEach(collect);
    const fit = () => {
      if (!bounds.isEmpty())
        map.fitBounds(bounds, { padding: 45, duration: 0 });
    };
    fit();
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "nv-map-reset";
    reset.textContent = "Вся территория";
    reset.onclick = fit;
    const control = {
      onAdd: () => {
        const box = document.createElement("div");
        box.className = "maplibregl-ctrl";
        box.append(reset);
        return box;
      },
      onRemove: () => reset.parentElement?.remove(),
    };
    map.addControl(control, "top-right");
    map.on("error", () =>
      setNotice(
        "Не удалось загрузить часть подложки. Координаты сохранены; можно перейти на схему.",
      ),
    );
    map.on("style.load", () => {
      map.addSource("nv-boundary", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: boundary },
      });
      map.addLayer({
        id: "nv-boundary-fill",
        type: "fill",
        source: "nv-boundary",
        paint: { "fill-color": color, "fill-opacity": 0.06 },
      });
      map.addLayer({
        id: "nv-boundary-line",
        type: "line",
        source: "nv-boundary",
        paint: { "line-color": "#186c80", "line-width": 2 },
      });
      map.addSource("nv-rings", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: rings.map((ring) => ({
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [ring] },
          })),
        },
      });
      map.addLayer({
        id: "nv-rings-line",
        type: "line",
        source: "nv-rings",
        layout: { visibility: ringsVisible.current ? "visible" : "none" },
        paint: {
          "line-color": color,
          "line-width": 1.5,
          "line-dasharray": [3, 3],
        },
      });
    });
    const markers = points.map((point, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nv-map-marker";
      button.style.backgroundColor = color;
      button.textContent = String(index + 1);
      button.setAttribute("aria-label", `Расчётная точка ${index + 1}`);
      button.setAttribute("aria-pressed", String(index === 0));
      button.onclick = () => onSelect(index);
      buttons.current.push(button);
      return new maplibregl.Marker({ element: button })
        .setLngLat([point[0], point[1]])
        .addTo(map);
    });
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      markers.forEach((marker) => marker.remove());
      buttons.current = [];
      mapRef.current = null;
      map.remove();
    };
  }, [item, method, onSelect]);
  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer("nv-rings-line"))
      map.setLayoutProperty(
        "nv-rings-line",
        "visibility",
        showRings ? "visible" : "none",
      );
  }, [showRings]);
  useEffect(() => {
    buttons.current.forEach((button, index) =>
      button.setAttribute("aria-pressed", String(index === active)),
    );
  }, [active]);
  return (
    <div>
      <div
        ref={container}
        className="nv-street-map"
        role="region"
        aria-label={`Карта расчёта: ${item.city}`}
      />
      {notice && (
        <p className="nv-map-notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

export function NetworkVerificationMap({
  item,
  method,
}: {
  item: VerificationCase;
  method: VerificationMethod | undefined;
}) {
  const [mode, setMode] = useState<"map" | "diagram">("map");
  const [showRings, setShowRings] = useState(false);
  const [active, setActive] = useState(0);
  const point = method?.coordinates[active];
  return (
    <div className="nv-geography">
      <div className="nv-map-toolbar">
        <div className="nv-segmented" role="group" aria-label="Вид карты">
          <button
            type="button"
            aria-pressed={mode === "map"}
            onClick={() => setMode("map")}
          >
            Карта
          </button>
          <button
            type="button"
            aria-pressed={mode === "diagram"}
            onClick={() => setMode("diagram")}
          >
            Схема
          </button>
        </div>
        <label>
          <input
            type="checkbox"
            checked={showRings}
            onChange={(event) => setShowRings(event.target.checked)}
          />{" "}
          Радиус {number(item.radius_m / 1000, 1)} км
        </label>
      </div>
      {mode === "map" ? (
        <>
          <StreetMap
            item={item}
            method={method}
            showRings={showRings}
            active={active}
            onSelect={setActive}
          />
          {!method?.coordinates.length && (
            <p className="nv-map-notice">
              Точки для этого задания не сформированы. Показана граница города.
            </p>
          )}
          <div className="nv-map-foot">
            <span>
              Граница города и расчётные точки · подложка OpenStreetMap
            </span>
            {point && (
              <a
                href={`https://www.openstreetmap.org/?mlat=${point[1]}&mlon=${point[0]}#map=14/${point[1]}/${point[0]}`}
                target="_blank"
                rel="noreferrer"
              >
                Точка {active + 1}: {number(point[1], 5)}, {number(point[0], 5)}{" "}
                <ArrowUpRight size={13} />
              </a>
            )}
          </div>
        </>
      ) : (
        <CaseDiagram
          item={item}
          method={method}
          showRings={showRings}
          active={active}
          onSelect={setActive}
        />
      )}
      <p className="nv-map-notice">
        Нажмите на номер точки, чтобы увидеть координаты. Подложка требует
        интернета; схема работает автономно. Круги показывают геометрический
        радиус, а не область обнаружения загрязнения.
      </p>
    </div>
  );
}
function CaseDiagram({
  item,
  method,
  showRings,
  active,
  onSelect,
}: {
  item: VerificationCase;
  method: VerificationMethod | undefined;
  showRings: boolean;
  active: number;
  onSelect: (index: number) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const geometry = data.cities.find(
    (city) => city.id === item.territory_id,
  )!.boundary;
  const points = method?.coordinates || [];
  const locations: number[][] = [];
  function coordinates(value: unknown) {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number") {
      locations.push(value as number[]);
      return;
    }
    value.forEach(coordinates);
  }
  function collect(g: GeoJSON.Geometry) {
    if (g.type === "GeometryCollection") g.geometries.forEach(collect);
    else coordinates(g.coordinates);
  }
  function ring(point: number[]) {
    const lat = (point[1] * Math.PI) / 180,
      lon = (point[0] * Math.PI) / 180,
      distance = item.radius_m / 6371008.8;
    return Array.from({ length: 73 }, (_, index) => {
      const angle = (index * 5 * Math.PI) / 180,
        p = Math.asin(
          Math.sin(lat) * Math.cos(distance) +
            Math.cos(lat) * Math.sin(distance) * Math.cos(angle),
        );
      const l =
        lon +
        Math.atan2(
          Math.sin(angle) * Math.sin(distance) * Math.cos(lat),
          Math.cos(distance) - Math.sin(lat) * Math.sin(p),
        );
      return [(l * 180) / Math.PI, (p * 180) / Math.PI];
    });
  }
  const rings = points.map(ring);
  collect(geometry);
  locations.push(...points, ...rings.flat());
  const lon0 = Math.min(...locations.map((p) => p[0])),
    lon1 = Math.max(...locations.map((p) => p[0]));
  const merc = (lat: number) =>
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const y0 = Math.min(...locations.map((p) => merc(p[1]))),
    y1 = Math.max(...locations.map((p) => merc(p[1])));
  const middleLat =
    ((Math.atan(Math.exp((y0 + y1) / 2)) * 4 - Math.PI) * 90) / Math.PI;
  const radiusAngle =
    item.radius_m / 6371008.8 / Math.cos((middleLat * Math.PI) / 180);
  const scale = Math.min(
    650 / Math.max(((lon1 - lon0) * Math.PI) / 180, radiusAngle * 2),
    310 / Math.max(y1 - y0, radiusAngle * 2),
  );
  const project = (p: number[]) => [
    380 + (((p[0] - (lon0 + lon1) / 2) * Math.PI) / 180) * scale,
    200 - (merc(p[1]) - (y0 + y1) / 2) * scale,
  ];
  function path(g: GeoJSON.Geometry): string {
    if (g.type === "Polygon")
      return g.coordinates
        .map(
          (r) =>
            r
              .map((p, i) => `${i ? "L" : "M"}${project(p).join(",")}`)
              .join(" ") + "Z",
        )
        .join(" ");
    if (g.type === "MultiPolygon")
      return g.coordinates
        .map((c) => path({ type: "Polygon", coordinates: c }))
        .join(" ");
    if (g.type === "GeometryCollection")
      return g.geometries.map(path).join(" ");
    return "";
  }
  const selected = points[Math.min(active, Math.max(0, points.length - 1))];
  return (
    <div className="nv-map-block">
      <div className="nv-map">
        <svg
          viewBox={`${380 - 380 / zoom} ${200 - 200 / zoom} ${760 / zoom} ${400 / zoom}`}
          role="group"
          aria-label={`Граница города ${item.city}, расчётные точки и геометрический радиус 2,5 км`}
        >
          <defs>
            <pattern
              id="nv-map-grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M40 0H0V40"
                fill="none"
                stroke="#dce6e8"
                strokeWidth=".6"
              />
            </pattern>
          </defs>
          <rect
            x="-2000"
            y="-2000"
            width="5000"
            height="5000"
            fill="url(#nv-map-grid)"
          />
          <path
            d={path(geometry)}
            fill="#e2ece8"
            stroke="#75978d"
            strokeWidth={1.5 / zoom}
            fillRule="evenodd"
          />
          {points.map((point, index) => {
            const [cx, cy] = project(point);
            return (
              <g key={index}>
                {showRings && (
                  <path
                    d={path({ type: "Polygon", coordinates: [rings[index]] })}
                    fill={colors[method!.method]}
                    fillOpacity=".035"
                    stroke={colors[method!.method]}
                    strokeOpacity=".35"
                    strokeWidth={1 / zoom}
                    strokeDasharray={`${4 / zoom} ${4 / zoom}`}
                  />
                )}
                <g
                  role="button"
                  tabIndex={0}
                  aria-label={`Расчётная точка ${index + 1}`}
                  aria-pressed={index === active}
                  onClick={() => onSelect(index)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(index);
                    }
                  }}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={(index === active ? 14 : 11) / zoom}
                    fill={colors[method!.method]}
                    stroke="#fff"
                    strokeWidth={2 / zoom}
                  />
                  <text
                    x={cx}
                    y={cy + 4 / zoom}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={11 / zoom}
                    fontWeight="700"
                  >
                    {index + 1}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
        <div className="nv-map-controls">
          <button
            aria-label="Увеличить схему"
            onClick={() => setZoom(Math.min(zoom * 1.5, 8))}
          >
            <Plus size={16} />
          </button>
          <button
            aria-label="Уменьшить схему"
            onClick={() => setZoom(Math.max(zoom / 1.5, 0.6))}
          >
            <Minus size={16} />
          </button>
          <button
            aria-label="Показать всю территорию"
            onClick={() => setZoom(1)}
          >
            <RotateCcw size={15} />
          </button>
        </div>
        <span className="nv-map-caption">
          Сохранённая геометрия · OpenStreetMap
        </span>
        {!points.length && (
          <div className="nv-map-empty">
            Для этого сочетания точки не сформированы
          </div>
        )}
      </div>
      <div className="nv-map-foot">
        <span>
          <i /> Граница города <i className="is-point" /> Расчётные точки{" "}
          <i className="is-ring" /> Радиус 2,5 км
        </span>
        {selected && (
          <a
            href={`https://www.openstreetmap.org/?mlat=${selected[1]}&mlon=${selected[0]}#map=14/${selected[1]}/${selected[0]}`}
            target="_blank"
            rel="noreferrer"
          >
            Точка {active + 1}: {number(selected[1], 5)},{" "}
            {number(selected[0], 5)} <ArrowUpRight size={13} />
          </a>
        )}
      </div>
    </div>
  );
}
