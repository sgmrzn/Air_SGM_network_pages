export const placementOptions = [
  ['population_coverage', 'Охват населения'],
  ['industrial_influence', 'Промышленные источники'],
  ['transport_influence', 'Транспорт'],
  ['urban_background', 'Городской фон'],
  ['integrated_screening', 'Комплексное проектирование'],
] as const;
export const meteoOptions = [
  ['annual', 'Годовая роза ветров'],
  ['cold_period', 'Холодный период'],
  ['warm_period', 'Тёплый период'],
  ['weak_wind', 'Слабый ветер 0,5–2 м/с'],
  ['calm_accumulation', 'Штиль менее 0,5 м/с'],
] as const;
export const placementLabel = (id?: string) => placementOptions.find(x => x[0] === id)?.[1] || 'Охват населения';
export const meteoLabel = (id?: string) => id === 'accumulation_risk' ? 'Слабое перемешивание · архивный профиль' : meteoOptions.find(x => x[0] === id)?.[1] || 'Годовая роза ветров';
