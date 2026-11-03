import { useState, type ReactNode } from "react";
import {
  demographicAgreementRows,
  districtMetricRows,
  districtValidationRows,
  demographicValidationRows,
  validationProtocolFacts,
} from "../data/populationValidationData";
import {
  ablationRows,
  alphaRows,
  annualRows,
  demographicComparisonRows,
  directionalComparisonRows,
  fundamentalBoundaryRows,
  fundamentalRadiusRows,
  fundamentalRasterRows,
  fundamentalResolutionRows,
  fundamentalShiftRows,
  municipalZoneRows,
  rosstatDensityRows,
  ryazanskyDensityRows,
  seasonalRows,
  sectorRows,
  terrainAnnualRows,
  terrainStationRows,
} from "./PopulationCoverageDataPage";

type TabKey = "sources" | "base" | "demography" | "wind" | "terrain" | "sensitivity";

const tabs: Array<[TabKey, string]> = [
  ["sources", "Исходные данные"],
  ["base", "Основной расчёт"],
  ["demography", "Демография"],
  ["wind", "Ветер и геометрия"],
  ["terrain", "Рельеф"],
  ["sensitivity", "Чувствительность"],
];

function ResultTable({ headers, rows }: { headers: string[]; rows: ReadonlyArray<ReadonlyArray<ReactNode>> }) {
  return (
    <div className="population-study__table-wrap">
      <table className="population-study__table">
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function CalculationCard({ step, title, description, badge, children }: {
  step: string; title: string; description: string; badge?: string; children: ReactNode;
}) {
  return (
    <section className="module-card population-study__card">
      <div className="module-card__head population-calculations__head">
        <div><span>{step}</span><h3>{title}</h3><p>{description}</p></div>
        {badge && <b className="population-study__badge">{badge}</b>}
      </div>
      {children}
    </section>
  );
}

function FormulaBlock({ formula, children }: { formula: string; children: ReactNode }) {
  return (
    <div className="population-calculations__formula">
      <span>РАСЧЁТ</span>
      <code>{formula}</code>
      <p>{children}</p>
    </div>
  );
}

export function PopulationCalculationsPage() {
  const [tab, setTab] = useState<TabKey>("sources");
  const annualTable = annualRows.map((row) => [row.year, row.covered.toLocaleString("ru-RU"), `${row.percent.toFixed(3)}%`, row.jaccard.toFixed(3)]);
  const sectorTable = sectorRows.map((row) => [row.year, row.sectors8, row.sectors16, row.sectors36]);

  return (
    <div className="module-page population-study population-calculations">
      <nav className="population-calculations__tabs" aria-label="Группы расчётов">
        {tabs.map(([key, label]) => <button key={key} className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>{label}</button>)}
      </nav>

      {tab === "sources" && <>
        <CalculationCard step="ИСХОДНЫЕ ДАННЫЕ · РАСЧЁТНЫЙ НАБОР" title="Что использовано в статье" description="Версии источников и правила, общие для опубликованных сценариев." badge="актуализация 08.08.2026">
          <div className="population-calculations__source-grid">
            <div><span>ПОСТЫ</span><strong>9 действующих постов Рязани</strong><p>Проверенные координаты и стабильные идентификаторы.</p></div>
            <div><span>НАСЕЛЕНИЕ</span><strong>WorldPop R2025A v1 · 100 м</strong><p>Основная constrained-поверхность; GHS‑POP используется для независимой проверки.</p></div>
            <div><span>МЕТЕОДАННЫЕ</span><strong>ERA5 hourly · 2019–2025</strong><p>Годовые и четыре сезонных агрегата каждого года.</p></div>
            <div><span>РЕЛЬЕФ</span><strong>Copernicus DEM GLO‑30</strong><p>Региональный слой Рязанской области, расчётный шаг 90 м.</p></div>
            <div><span>ГРАНИЦЫ</span><strong>Рязань и Рязанский округ</strong><p>Городская граница задаёт основной знаменатель; зоны учитываются полностью.</p></div>
            <div><span>ГЕОМЕТРИЯ</span><strong>Круг и равноплощадные контуры</strong><p>Радиус 2,5 км; 8, 16 или 36 секторов.</p></div>
            <div><span>РАЙОНЫ РЯЗАНИ</span><strong>4 контура OSM · admin_level 9</strong><p>Фиксированный снимок NextGIS от 28.11.2024; объединение контуров совпадает с границей города.</p></div>
          </div>
        </CalculationCard>
        <CalculationCard step="ОФИЦИАЛЬНАЯ ДЕМОГРАФИЧЕСКАЯ ОСНОВА" title="Население городского округа Рязань" description="Официальные итоги используются для контроля и муниципальной калибровки." badge="Рязаньстат · Росреестр">
          <FormulaBlock formula="ρₘ = Nₘ / Sₘ">Средняя плотность муниципалитета равна официальной численности населения, делённой на опубликованную площадь.</FormulaBlock>
          <ResultTable headers={["Год", "Население, чел.", "Площадь, км²", "Плотность, чел./км²", "Статус"]} rows={rosstatDensityRows} />
        </CalculationCard>
        <CalculationCard step="СОСЕДНЕЕ МУНИЦИПАЛЬНОЕ ОБРАЗОВАНИЕ" title="Рязанский муниципальный район / округ" description="Используется для частей зон, выходящих за границу города.">
          <FormulaBlock formula="N(Z) = Σₘ ρₘ · S(Z ∩ Mₘ)">В контрольном расчёте каждая муниципальная часть зоны умножается на плотность именно своего муниципального образования.</FormulaBlock>
          <ResultTable headers={["Год", "Население, чел.", "Площадь, км²", "Плотность, чел./км²"]} rows={ryazanskyDensityRows} />
          <div className="population-study__notes population-study__notes--two"><p><strong>WorldPop:</strong> пиксели суммируются непосредственно во всех пересечённых муниципальных частях.</p><p><strong>Росстат:</strong> для каждой части применяется плотность соответствующего муниципального образования, а не плотность Рязани.</p></div>
        </CalculationCard>
      </>}

      {tab === "base" && <>
        <CalculationCard step="ШАГ 1 · УСЛОВИЯ РАСЧЁТА" title="Единые условия сравнения" description="Территория, сеть постов и правила, которые остаются одинаковыми во всех сопоставляемых вариантах." badge="единый протокол">
          <dl className="population-study__facts">{validationProtocolFacts.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
        </CalculationCard>
        <CalculationCard step="ШАГ 2 · ОСНОВНОЙ ПОКАЗАТЕЛЬ" title="Круги и ветроориентированные зоны" description="WorldPop и равномерная плотность рассчитаны в одной административной границе Рязани." badge="2025">
          <FormulaBlock formula="Pcovered = Σ[p ∈ T ∩ (∪ᵢ Zᵢ)] pop(p);  C = 100 · Pcovered / P(T)">Пиксель учитывается, если его центр находится одновременно в территории знаменателя и объединении зон. Пересечения зон не суммируются повторно.</FormulaBlock>
          <ResultTable headers={["Геометрия", "Основа", "Население территории", "Покрыто", "Охват", "Вне зон"]} rows={demographicComparisonRows} />
          <div className="population-study__notes population-study__notes--two"><p><strong>Основной результат:</strong> круги радиусом 2,5 км охватывают 340 549 жителей Рязани по WorldPop, или 64,432%.</p><p><strong>Назначение:</strong> значения описывают население заданной расчётной геометрии, а не доказанную экспозицию.</p></div>
        </CalculationCard>
        <CalculationCard step="ШАГ 3 · МУНИЦИПАЛЬНЫЕ ЧАСТИ" title="Полные зоны за городской границей" description="Каждая зона суммируется во всех пересечённых муниципальных образованиях." badge="9 постов">
          <FormulaBlock formula="Pᵢ = Σₘ Σ[p ∈ Zᵢ ∩ Mₘ] pop(p)">Полное население собственной зоны поста равно сумме населения всех её муниципальных частей.</FormulaBlock>
          <ResultTable headers={["Пост", "Рязань", "Рязанский округ", "Полная зона"]} rows={municipalZoneRows} />
        </CalculationCard>
      </>}

      {tab === "demography" && <>
        <CalculationCard step="ДЕМОГРАФИЯ · ВАЛИДАЦИЯ" title="WorldPop, GHS‑POP и Росстат" description="Проверка городской суммы и охвата одинаковым объединением кругов." badge="2020 и 2025">
          <FormulaBlock formula="k = Nofficial / Praster;  p′ᵢ = k · pᵢ">Единый коэффициент приводит сумму растра к официальной численности, не изменяя внутригородские пропорции и процент охвата.</FormulaBlock>
          <ResultTable headers={["Год", "Растр", "Росстат", "Сумма растра", "Смещение", "В кругах", "Охват", "После калибровки"]} rows={demographicValidationRows} />
        </CalculationCard>
        <CalculationCard step="ДЕМОГРАФИЯ · ПРОСТРАНСТВО" title="Согласие распределения населения" description="Обе поверхности приведены к итогу Росстата и общей сетке 1 км." badge="EPSG:32637">
          <FormulaBlock formula="Jw = Σ min(pᵢ,qᵢ) / Σ max(pᵢ,qᵢ);  D = ½ Σ |pᵢ−qᵢ|">Взвешенный Жаккар измеряет совпадение модельного населения, а D — минимальную массу, которую нужно перераспределить между ячейками.</FormulaBlock>
          <ResultTable headers={["Год", "Взвешенный J", "Перекрытие", "Перераспределение, чел.", "Доля", "Разница охвата"]} rows={demographicAgreementRows} />
          <div className="population-study__notes population-study__notes--two"><p><strong>Около 12%</strong> населения пространственно размещено по-разному между моделями.</p><p><strong>Ограничение:</strong> межмодельное согласие не заменяет адресную или квартальную валидацию.</p></div>
        </CalculationCard>
        <CalculationCard step="ДЕМОГРАФИЯ · ВНУТРИГОРОДСКАЯ ПРОВЕРКА" title="Четыре района Рязани" description="Суммы растров в границах районов сопоставлены с итогами ВПН‑2020 на 1 октября 2021 года." badge="528 599 жителей">
          <FormulaBlock formula="eᵣ = 100 · (Pᵣ − Nᵣ) / Nᵣ;  MAPE = ¼ Σ |eᵣ|">Ошибка рассчитывается отдельно для каждого района; единая городская калибровка исправляет общий итог, но не меняет районные доли растра.</FormulaBlock>
          <ResultTable headers={["Растр", "Район", "ВПН‑2020", "Исходно", "Ошибка", "После калибровки", "Ошибка"]} rows={districtValidationRows} />
          <ResultTable headers={["Растр", "Смещение города", "MAE исходно", "MAPE исходно", "MAE после", "MAPE после"]} rows={districtMetricRows} />
          <div className="population-study__notes population-study__notes--two"><p><strong>WorldPop:</strong> после калибровки MAPE по районам составляет 15,43%; наибольшее расхождение наблюдается в Советском районе (+32,2%).</p><p><strong>Вывод:</strong> близкая городская сумма не подтверждает точность внутригородского распределения; GHS‑POP показывает сопоставимую среднюю ошибку.</p></div>
        </CalculationCard>
        <CalculationCard step="ДЕМОГРАФИЯ · ВЫВОД" title="Как использовать результат проверки" description="Городской итог, районное распределение и население зон отвечают на разные контрольные вопросы." badge="протокол v2">
          <dl className="population-study__facts population-study__facts--three">
            <div><dt>ГОРОДСКАЯ СУММА</dt><dd>WorldPop 2021: +0,76%. Растр близок к итогу переписи по городу, но это не проверяет размещение жителей внутри Рязани.</dd></div>
            <div><dt>РАЙОННОЕ РАСПРЕДЕЛЕНИЕ</dt><dd>MAPE 15,43%. Единый коэффициент сохраняет районные доли и потому не устраняет локальные ошибки.</dd></div>
            <div><dt>РЕШЕНИЕ ДЛЯ МОДУЛЯ</dt><dd>WorldPop остаётся основной поверхностью благодаря разрешению и временному соответствию; GHS‑POP сохраняется как независимый сценарий чувствительности.</dd></div>
          </dl>
          <div className="population-study__notes population-study__notes--two"><p><strong>Не доверительный интервал:</strong> 15,43% нельзя механически прибавлять к каждой зоне поста — это MAPE четырёх крупных районов.</p><p><strong>Оставшееся ограничение:</strong> для проверки 100‑метровых ячеек нужны адресные, квартальные или иные более мелкие наблюдаемые итоги.</p></div>
        </CalculationCard>
      </>}

      {tab === "wind" && <>
        <CalculationCard step="ВЕТЕР · МЕЖГОДОВОЕ СРАВНЕНИЕ" title="Базовый 16‑секторный сценарий" description="Одна поверхность WorldPop 2025 используется для всех годов ERA5." badge="7 лет"><FormulaBlock formula="J(A,B) = S(A ∩ B) / S(A ∪ B)">Площадной Жаккар показывает совпадение объединённых зон выбранного года с геометрией 2021 года.</FormulaBlock><ResultTable headers={["Год", "Покрыто, чел.", "Покрыто, %", "Жаккар к 2021"]} rows={annualTable} /></CalculationCard>
        <CalculationCard step="ГЕОМЕТРИЯ · ЧИСЛО СЕКТОРОВ" title="8, 16 и 36 секторов" description="16 секторов — операционная настройка, а не доказанный оптимум."><FormulaBlock formula="Δθ = 360° / n;  n ∈ {8,16,36}">Угловая ширина сектора определяется числом секторов; остальные параметры сценария не меняются.</FormulaBlock><ResultTable headers={["Год", "8 секторов", "16 секторов", "36 секторов"]} rows={sectorTable} /></CalculationCard>
        <CalculationCard step="ГЕОМЕТРИЯ · НАПРАВЛЕННОСТЬ" title="Осесимметричный и направленный варианты" description="Односторонняя геометрия используется только как стресс‑сценарий."><FormulaBlock formula="Fₛ = fₛ + fₛ₊₁₈₀°;   Fₛ(dir) = fₛ">Осесимметричный вариант объединяет противоположные направления в одну ось; направленный использует частоту отдельного сектора.</FormulaBlock><ResultTable headers={["Год", "Осесимметричный", "Направленный", "Δ, чел.", "Δ, п.п."]} rows={directionalComparisonRows} /></CalculationCard>
        <CalculationCard step="ПАРАМЕТРЫ · α" title="Чувствительность к направленности формы" description="Изменяется только параметр α."><FormulaBlock formula="wₛ = 1 + (1−calm)·[((Fₛ+ε)/(F̄+ε))ᵅ−1]">α управляет выраженностью различий между секторными радиусами; ε предотвращает деление на ноль.</FormulaBlock><ResultTable headers={["Год", "α=0", "α=0,5", "α=1", "α=2"]} rows={alphaRows} /></CalculationCard>
        <CalculationCard step="ПЕРИОД · СЕЗОНЫ" title="Четыре сезона каждого года" description="28 сценариев ERA5."><FormulaBlock formula="fₛ(period) = nₛ / Σⱼ nⱼ">Для каждого года и сезона частота направления равна доле почасовых наблюдений, попавших в соответствующий сектор.</FormulaBlock><ResultTable headers={["Год", "Зима", "Весна", "Лето", "Осень"]} rows={seasonalRows} /></CalculationCard>
        <CalculationCard step="АБЛЯЦИЯ" title="Анизотропия, штиль и направленность" description="Однофакторное отключение компонентов метода."><FormulaBlock formula="ΔX = Xvariant − Xbase">В каждом столбце изменяется один компонент, а остальные входные данные и параметры сохраняются базовыми.</FormulaBlock><ResultTable headers={["Год", "Без Amax", "Базовый", "Без штиля", "Направленный"]} rows={ablationRows} /></CalculationCard>
      </>}

      {tab === "terrain" && <>
        <CalculationCard step="РЕЛЬЕФ · ГОДОВЫЕ СЦЕНАРИИ" title="Ветер и рельефно‑чувствительная деформация" description="Сопоставляются равноплощадные зоны при одинаковом ERA5." badge="Copernicus DEM"><FormulaBlock formula="Tₛ = clip[0,72;1,08](1 − min(0,22;0,22H⁺ₛ/800) − min(0,10;0,10ΔHₛ/1000) + min(0,08;0,08H⁻ₛ/1000))">Рельефный множитель корректирует секторный вес; после этого повторно выполняются ограничение анизотропии и равноплощадная нормировка.</FormulaBlock><ResultTable headers={["Год", "Только ветер", "Ветер + рельеф", "Δ, чел.", "Δ, п.п.", "J площади", "J населения", "Население Δ", "Площадь Δ", "d среднее", "d95", "Добавлено", "Исключено"]} rows={terrainAnnualRows} /></CalculationCard>
        <CalculationCard step="РЕЛЬЕФ · ПОСТЫ" title="Рельеф и население собственной зоны" description="Постовые значения содержат пересечения и не суммируются." badge="2025"><FormulaBlock formula="ΔPᵢ = Pᵢ(ветер + рельеф) − Pᵢ(только ветер)">Разность относится к полной собственной зоне поста; сумма по постам завышает охват сети из-за пересечений.</FormulaBlock><ResultTable headers={["Пост", "Отметка", "Подъём", "Диапазон", "Коэффициент", "Ветер", "С рельефом", "Δ"]} rows={terrainStationRows} /></CalculationCard>
      </>}

      {tab === "sensitivity" && <>
        <CalculationCard step="ЧУВСТВИТЕЛЬНОСТЬ · РАДИУС" title="Радиус 1, 2,5 и 5 км" description="Наиболее сильный из проверенных факторов."><FormulaBlock formula="S₀ = πR²;  C(R) = 100 · P[T ∩ (∪ᵢ bufferᵢ(R))] / P(T)">Для каждого радиуса заново строится объединение кругов и рассчитывается доля населения административной территории.</FormulaBlock><ResultTable headers={["Радиус", "Население территории", "Покрыто", "Охват", "Площадь зон"]} rows={fundamentalRadiusRows} /></CalculationCard>
        <CalculationCard step="ЧУВСТВИТЕЛЬНОСТЬ · ЗНАМЕНАТЕЛЬ" title="Граница расчётной территории" description="Одна геометрия сети при трёх территориях знаменателя."><FormulaBlock formula="C(T) = 100 · P[T ∩ Z] / P(T)">Геометрия объединения Z не меняется; изменяется только территория T, формирующая числитель и знаменатель.</FormulaBlock><ResultTable headers={["Территория", "Население", "Покрыто", "Охват"]} rows={fundamentalBoundaryRows} /></CalculationCard>
        <CalculationCard step="ЧУВСТВИТЕЛЬНОСТЬ · ПИКСЕЛЬ" title="Правило включения ячейки" description="Центр, любое касание и пропорциональный учёт площади."><FormulaBlock formula="Pfrac(G) = Σₚ pop(p) · S(p ∩ G) / S(p)">Пропорциональный вариант предполагает равномерное население внутри ячейки; правило центра является основным.</FormulaBlock><ResultTable headers={["Правило", "Население", "Покрыто", "Охват", "Δ"]} rows={fundamentalRasterRows} /></CalculationCard>
        <CalculationCard step="ЧУВСТВИТЕЛЬНОСТЬ · РАЗРЕШЕНИЕ" title="Укрупнение демографического растра" description="Значения суммируются при переходе от 100 до 1000 м."><FormulaBlock formula="pop(coarse cell) = Σ pop(source cells)">При укрупнении сохраняется сумма населения, а не среднее значение исходных ячеек.</FormulaBlock><ResultTable headers={["Разрешение", "Население", "Покрыто", "Охват"]} rows={fundamentalResolutionRows} /></CalculationCard>
        <CalculationCard step="ЧУВСТВИТЕЛЬНОСТЬ · КООРДИНАТЫ" title="Случайное смещение постов" description="200 реализаций для каждого предельного смещения."><FormulaBlock formula="x′ᵢ = xᵢ + rᵢ(cosφᵢ, sinφᵢ);  0 ≤ rᵢ ≤ rmax">Для каждого поста независимо выбираются случайные направление и величина смещения; затем полностью пересчитывается объединение зон.</FormulaBlock><ResultTable headers={["Смещение", "Среднее", "Минимум", "p05", "p95", "Максимум", "Макс. |Δ|"]} rows={fundamentalShiftRows} /></CalculationCard>
      </>}

    </div>
  );
}
