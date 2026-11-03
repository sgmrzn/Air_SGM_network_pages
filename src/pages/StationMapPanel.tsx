import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { baseMapStyle } from "../mapStyle";
import { request } from "../shared/http";
import { type Station, typeLabel } from "./StationRegistryPanel";

function hasCoordinates(station: Station) {
  return typeof station.longitude === "number" && typeof station.latitude === "number" && Number.isFinite(station.longitude) && Number.isFinite(station.latitude) && Math.abs(station.longitude) <= 180 && Math.abs(station.latitude) <= 90;
}

function stationCard(station: Station) {
  const card = document.createElement("div");
  card.className = "station-map__popup";
  const heading = document.createElement("strong"); heading.textContent = station.name; card.append(heading);
  for (const [label, value] of [
    ["Ведомство", station.operator || "Не указано"],
    ["Адрес", station.address || "Не указан"],
    ["Тип поста", typeLabel[station.station_type] || station.station_type || "Не указан"],
    ["Координаты", `${station.latitude.toFixed(5)}, ${station.longitude.toFixed(5)}`],
  ]) {
    if (!value) continue;
    const row = document.createElement("p"); const title = document.createElement("span"); title.textContent = label || ""; row.append(title, document.createTextNode(value)); card.append(row);
  }
  return card;
}

export function StationMapPanel() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [region, setRegion] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([request<Station[]>("/api/spatial/monitoring-stations", { signal: controller.signal }), request<string[]>("/api/spatial/monitoring-stations/regions", { signal: controller.signal })])
      .then(([items, names]) => { setStations(items); setRegions(names); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const visible = useMemo(() => stations.filter(station => region === "all" || (station.address || "").toLocaleLowerCase("ru-RU").includes(region.toLocaleLowerCase("ru-RU")) || (region === "Рязанская область" && /рязан/i.test(station.operator))), [stations, region]);
  const located = useMemo(() => visible.filter(hasCoordinates), [visible]);
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({ container: container.current, style: baseMapStyle, center: [40.5, 54.3], zoom: 7 });
    map.addControl(new maplibregl.NavigationControl(), "top-left");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    mapRef.current = map;
    const observer = new ResizeObserver(() => map.resize()); observer.observe(container.current);
    return () => { observer.disconnect(); mapRef.current = null; map.remove(); };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = located.map(station => {
      const button = document.createElement("button"); button.type = "button"; button.className = "station-map__marker station-map__marker--active";
      button.setAttribute("aria-label", station.name); button.title = station.name;
      const popup = new maplibregl.Popup({ offset: 12, maxWidth: "360px" }).setDOMContent(stationCard(station));
      const marker = new maplibregl.Marker({ element: button }).setLngLat([station.longitude, station.latitude]).setPopup(popup).addTo(map);
      button.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); marker.togglePopup(); } });
      return marker;
    });
    if (located.length) {
      const bounds = new maplibregl.LngLatBounds(); located.forEach(s => bounds.extend([s.longitude, s.latitude]));
      map.fitBounds(bounds, { padding: 55, maxZoom: 12, duration: 0 });
    }
    return () => { markers.forEach(marker => { marker.getPopup()?.remove(); marker.remove(); }); };
  }, [located]);
  return <section className="station-map">
    <header className="station-map__head"><div><h2>Карта постов</h2><p>Нажмите на пост для просмотра сведений · На карте: {located.length} из {visible.length}</p></div><label>Регион<select value={region} onChange={e => setRegion(e.target.value)}><option value="all">Все посты Рязанской области</option>{regions.map(name => <option key={name} value={name}>{name}</option>)}</select></label></header>
    {loading && <p role="status">Загрузка реестра…</p>}{error && <div className="form-error" role="alert">{error}</div>}
    {!loading && !error && !located.length && <p role="status">В выбранном регионе нет постов с доступными координатами.</p>}
    <div ref={container} className="station-map__canvas" />
    <p className="station-map__note">Без координат: {visible.length - located.length}. Регион определяется по адресу. Подложка карты требует интернета.</p>
  </section>;
}
