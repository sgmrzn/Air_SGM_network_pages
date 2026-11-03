import dictionary from "../data/sourceNamesRu.json";

const aliases = new Map(dictionary.rules.flatMap(rule => rule.aliases.map(alias => [alias.trim().toLocaleLowerCase("ru-RU"), rule.name_ru] as const)));

/** A display label only: never changes source IDs, matching, or calculation inputs. */
export function russianSourceName(item: { id?: string; name?: string | null }): string {
  const original = item.name || "";
  const key = original.trim().toLocaleLowerCase("ru-RU");
  const translated = aliases.get(key);
  if (translated) return translated;
  if (key === "openstreetmap landfill") return "Свалка / полигон отходов (OSM)";
  if (key === "unknown" || key === "unknown name") {
    const id = item.id?.split(":").at(-1);
    return `Объект без названия${id ? ` · № ${id}` : ""}`;
  }
  return original;
}
