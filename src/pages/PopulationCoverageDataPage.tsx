import {
  demographicAgreementRows,
  demographicValidationRows,
} from "../data/populationValidationData";

type AnnualRow = {
  year: number;
  covered: number;
  percent: number;
  jaccard: number;
};

type SectorRow = {
  year: number | string;
  sectors8: string;
  sectors16: string;
  sectors36: string;
};

export const annualRows: AnnualRow[] = [
  { year: 2019, covered: 348449, percent: 60.819, jaccard: 0.91 },
  { year: 2020, covered: 346419, percent: 60.465, jaccard: 0.916 },
  { year: 2021, covered: 348820, percent: 60.884, jaccard: 1.0 },
  { year: 2022, covered: 348728, percent: 60.868, jaccard: 0.95 },
  { year: 2023, covered: 348138, percent: 60.765, jaccard: 0.918 },
  { year: 2024, covered: 346997, percent: 60.566, jaccard: 0.911 },
  { year: 2025, covered: 348871, percent: 60.893, jaccard: 0.944 },
];

export const sectorRows: SectorRow[] = [
  {
    year: 2019,
    sectors8: "348 930 · 60,903%",
    sectors16: "348 449 · 60,819%",
    sectors36: "349 149 · 60,941%",
  },
  {
    year: 2020,
    sectors8: "346 879 · 60,545%",
    sectors16: "346 419 · 60,465%",
    sectors36: "346 774 · 60,527%",
  },
  {
    year: 2021,
    sectors8: "348 220 · 60,779%",
    sectors16: "348 820 · 60,884%",
    sectors36: "347 085 · 60,581%",
  },
  {
    year: 2022,
    sectors8: "348 471 · 60,823%",
    sectors16: "348 728 · 60,868%",
    sectors36: "348 841 · 60,887%",
  },
  {
    year: 2023,
    sectors8: "348 671 · 60,858%",
    sectors16: "348 138 · 60,765%",
    sectors36: "348 586 · 60,843%",
  },
  {
    year: 2024,
    sectors8: "347 296 · 60,618%",
    sectors16: "346 997 · 60,566%",
    sectors36: "347 429 · 60,641%",
  },
  {
    year: 2025,
    sectors8: "348 895 · 60,897%",
    sectors16: "348 871 · 60,893%",
    sectors36: "347 703 · 60,689%",
  },
  {
    year: "Среднее",
    sectors8: "348 195 · 60,775%",
    sectors16: "348 060 · 60,751%",
    sectors36: "347 938 · 60,730%",
  },
];

export const alphaRows = [
  [2019, "348 186 · 60,773%", "348 449 · 60,819%", "347 620 · 60,674%", "347 667 · 60,682%"],
  [2020, "346 856 · 60,541%", "346 419 · 60,465%", "345 854 · 60,366%", "345 544 · 60,312%"],
  [2021, "347 479 · 60,650%", "348 820 · 60,884%", "349 537 · 61,009%", "349 205 · 60,951%"],
  [2022, "348 030 · 60,746%", "348 728 · 60,868%", "348 721 · 60,866%", "348 698 · 60,862%"],
  [2023, "347 943 · 60,731%", "348 138 · 60,765%", "347 409 · 60,637%", "346 867 · 60,543%"],
  [2024, "347 198 · 60,601%", "346 997 · 60,566%", "346 032 · 60,397%", "345 865 · 60,368%"],
  [2025, "347 689 · 60,686%", "348 871 · 60,893%", "350 258 · 61,135%", "351 803 · 61,404%"],
] as const;

export const seasonalRows = [
  [2019, "348 415 · 60,813%", "348 834 · 60,886%", "348 527 · 60,833%", "347 472 · 60,648%"],
  [2020, "348 134 · 60,764%", "347 782 · 60,703%", "348 498 · 60,828%", "346 650 · 60,505%"],
  [2021, "347 774 · 60,701%", "348 393 · 60,809%", "347 700 · 60,688%", "348 624 · 60,850%"],
  [2022, "345 268 · 60,264%", "348 923 · 60,902%", "352 387 · 61,506%", "348 875 · 60,893%"],
  [2023, "344 331 · 60,100%", "349 311 · 60,969%", "348 392 · 60,809%", "348 694 · 60,862%"],
  [2024, "347 296 · 60,618%", "347 715 · 60,691%", "346 443 · 60,469%", "346 688 · 60,512%"],
  [2025, "348 981 · 60,912%", "348 590 · 60,844%", "345 760 · 60,350%", "349 453 · 60,994%"],
] as const;

export const ablationRows = [
  [2019, "348 579 · 60,842%", "348 449 · 60,819%", "348 150 · 60,767%", "360 918 · 62,995%"],
  [2020, "346 419 · 60,465%", "346 419 · 60,465%", "346 487 · 60,477%", "361 861 · 63,160%"],
  [2021, "348 820 · 60,884%", "348 820 · 60,884%", "348 784 · 60,877%", "357 362 · 62,375%"],
  [2022, "348 728 · 60,868%", "348 728 · 60,868%", "348 697 · 60,862%", "355 461 · 62,043%"],
  [2023, "348 043 · 60,748%", "348 138 · 60,765%", "348 164 · 60,769%", "356 552 · 62,233%"],
  [2024, "347 021 · 60,570%", "346 997 · 60,566%", "347 002 · 60,566%", "357 610 · 62,418%"],
  [2025, "348 871 · 60,893%", "348 871 · 60,893%", "348 831 · 60,886%", "364 229 · 63,573%"],
] as const;

export const directionalComparisonRows = [
  [2019, "348 449 · 60,819%", "360 918 · 62,995%", "+12 469", "+2,176 п.п."],
  [2020, "346 419 · 60,465%", "361 861 · 63,160%", "+15 442", "+2,695 п.п."],
  [2021, "348 820 · 60,884%", "357 362 · 62,375%", "+8 542", "+1,491 п.п."],
  [2022, "348 728 · 60,868%", "355 461 · 62,043%", "+6 733", "+1,175 п.п."],
  [2023, "348 138 · 60,765%", "356 552 · 62,233%", "+8 414", "+1,468 п.п."],
  [2024, "346 997 · 60,566%", "357 610 · 62,418%", "+10 613", "+1,852 п.п."],
  [2025, "348 871 · 60,893%", "364 229 · 63,573%", "+15 358", "+2,680 п.п."],
] as const;

export const terrainAnnualRows = [
  [2019, "348 449 · 60,819%", "347 611 · 60,673%", "−838", "−0,146 п.п.", "0,9947", "0,9961", "1 348", "0,6916", "7,6", "23,4", "255", "1 093"],
  [2020, "346 419 · 60,465%", "346 022 · 60,395%", "−397", "−0,069 п.п.", "0,9948", "0,9955", "1 563", "0,6830", "7,5", "24,0", "583", "980"],
  [2021, "348 820 · 60,884%", "347 973 · 60,736%", "−847", "−0,148 п.п.", "0,9945", "0,9949", "1 791", "0,7265", "7,8", "24,8", "472", "1 319"],
  [2022, "348 728 · 60,868%", "347 923 · 60,727%", "−805", "−0,141 п.п.", "0,9947", "0,9951", "1 697", "0,6952", "7,7", "23,1", "446", "1 251"],
  [2023, "348 138 · 60,765%", "347 318 · 60,622%", "−820", "−0,143 п.п.", "0,9948", "0,9953", "1 628", "0,6808", "7,6", "23,2", "404", "1 224"],
  [2024, "346 997 · 60,566%", "346 293 · 60,443%", "−704", "−0,123 п.п.", "0,9949", "0,9955", "1 577", "0,6732", "7,4", "22,8", "437", "1 140"],
  [2025, "348 871 · 60,893%", "347 770 · 60,700%", "−1 101", "−0,192 п.п.", "0,9944", "0,9947", "1 863", "0,7368", "8,1", "27,4", "381", "1 482"],
] as const;

export const terrainStationRows = [
  ["СП-1", "131,3", "12,8", "43,6", "0,995–0,999", "54 094", "54 034", "−60"],
  ["СП-2", "143,2", "48,8", "54,0", "0,982–1,000", "87 135", "87 255", "+120"],
  ["СП-3", "112,7", "47,0", "52,1", "0,982–1,000", "89 577", "89 001", "−576"],
  ["ПНЗ № 1", "158,9", "33,7", "70,5", "0,987–0,999", "23 517", "23 602", "+85"],
  ["ПНЗ № 2", "130,2", "13,4", "49,6", "0,994–0,998", "79 328", "79 362", "+34"],
  ["ПНЗ № 3", "120,0", "74,1", "76,5", "0,972–1,000", "117 380", "116 238", "−1 142"],
  ["ПНЗ № 6", "155,9", "32,1", "54,0", "0,988–0,996", "12 304", "12 303", "−1"],
  ["Маршрутный пост № 7", "166,8", "25,0", "59,3", "0,990–0,999", "11 016", "11 005", "−11"],
  ["Маршрутный пост № 9", "133,8", "54,1", "57,2", "0,980–0,999", "93 591", "93 248", "−343"],
] as const;

export const rosstatDensityRows = [
  [2019, "539 789", "223,7", "2 413,0", "Опубликовано"],
  [2020, "539 290", "223,7", "2 410,8", "Опубликовано"],
  [2021, "534 801", "223,7", "2 390,7", "Опубликовано"],
  [2022, "529 401", "222,1", "2 383,7", "Опубликовано"],
  [2023, "523 203", "222,1", "2 355,8", "Опубликовано"],
  [2024, "520 509", "222,1", "2 343,6", "Опубликовано"],
  [2025, "519 315", "222,1", "≈2 338,2", "Расчётно"],
] as const;

export const ryazanskyDensityRows = [
  [2019, "59 266", "2 171,2", "27,3"],
  [2020, "60 058", "2 171,2", "27,7"],
  [2021, "60 492", "2 171,2", "27,9"],
  [2022, "61 850", "2 171,2", "28,5"],
  [2023, "62 396", "2 171,2", "28,7"],
  [2024, "63 439", "2 171,2", "29,2"],
  [2025, "63 235", "2 171,2", "29,1"],
] as const;

export const municipalZoneRows = [
  ["СП-1", "54 016", "0", "54 016"],
  ["СП-2", "86 261", "1 945", "88 206"],
  ["СП-3", "91 784", "24", "91 808"],
  ["ПНЗ № 1", "21 030", "175", "21 205"],
  ["ПНЗ № 2", "80 437", "137", "80 574"],
  ["ПНЗ № 3", "116 320", "0", "116 320"],
  ["ПНЗ № 6", "11 113", "2 094", "13 207"],
  ["Маршрутный пост № 7", "7 385", "3 352", "10 737"],
  ["Маршрутный пост № 9", "95 433", "1 634", "97 067"],
] as const;

export const demographicComparisonRows = [
  ["Круг 2,5 км", "WorldPop 2025, 100 м", "528 539", "340 549", "64,432%", "187 990"],
  ["Осесимметричный контур · ERA5 2025", "WorldPop 2025, 100 м", "528 539", "341 229", "64,561%", "187 310"],
  ["Круг 2,5 км", "Плотность Росстата · 2 338,2 чел./км²", "516 559", "235 308", "45,553%", "281 251"],
  ["Осесимметричный контур · ERA5 2025", "Плотность Росстата · 2 338,2 чел./км²", "516 559", "232 237", "44,958%", "284 322"],
] as const;

export const fundamentalRadiusRows = [
  ["1,0", "528 539", "105 740", "20,006%", "23,002"],
  ["2,5", "528 539", "340 549", "64,432%", "100,233"],
  ["5,0", "528 539", "519 428", "98,276%", "189,500"],
] as const;

export const fundamentalBoundaryRows = [
  ["Городской округ Рязань", "528 539", "340 549", "64,432%"],
  ["Рязань + Рязанский округ", "593 288", "348 189", "58,688%"],
  ["Техническая рамка", "572 928", "348 189", "60,774%"],
] as const;

export const fundamentalRasterRows = [
  ["Центр пикселя", "528 539", "340 549", "64,432%", "0 п.п."],
  ["Любое касание", "530 501", "348 457", "65,685%", "+1,253 п.п."],
  ["По площади пересечения", "528 338", "340 576", "64,462%", "+0,030 п.п."],
] as const;

export const fundamentalResolutionRows = [
  ["100 м", "528 539", "340 549", "64,432%"],
  ["250 м", "526 853", "338 910", "64,327%"],
  ["500 м", "526 542", "337 127", "64,027%"],
  ["1000 м", "529 133", "338 697", "64,010%"],
] as const;

export const fundamentalShiftRows = [
  ["50 м", "340 739", "336 986", "338 229", "343 677", "344 932", "4 383"],
  ["100 м", "340 450", "332 777", "335 011", "345 774", "348 518", "7 969"],
  ["250 м", "341 200", "322 607", "328 388", "354 477", "361 748", "21 199"],
] as const;

const integer = new Intl.NumberFormat("ru-RU");
const decimal = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

export function PopulationCoverageDataPage() {
  return (
    <div className="module-page population-study">
      <section className="module-intro population-study__intro">
        <div>
          <span>ВОСПРОИЗВОДИМЫЙ НАБОР · АКТУАЛИЗАЦИЯ 08.08.2026</span>
          <h2>Данные к модулю покрытия населения</h2>
          <p>
            Полный свод расчётов, использованных в статье: исходные данные,
            параметры метода, годовая и сезонная устойчивость, чувствительность
            к форме контура, числу секторов розы ветров и макрорельефу.
          </p>
        </div>
        <div className="dataset-chip">
          <strong>equal-area-wind-terrain-sensitivity-v1</strong>
          <span>Рязань · 9 постов · ERA5 2019–2025 · WorldPop 2025 · Copernicus DEM</span>
        </div>
      </section>

      <div className="population-study__two-column">
        <section className="module-card population-study__card">
          <div className="module-card__head">
            <div>
              <span>ИСХОДНЫЕ ДАННЫЕ</span>
              <h3>Расчётный набор</h3>
            </div>
          </div>
          <dl className="population-study__facts">
            <div>
              <dt>Посты</dt>
              <dd>9 действующих постов Рязани</dd>
            </div>
            <div>
              <dt>Население</dt>
              <dd>WorldPop R2025A v1, constrained, 100 м</dd>
            </div>
            <div>
              <dt>Метеоданные</dt>
              <dd>ERA5 HOURLY, годовые агрегаты 2019–2025</dd>
            </div>
            <div>
              <dt>Сезонный анализ</dt>
              <dd>Четыре сезона каждого года за 2019–2025 гг. · 28 сценариев</dd>
            </div>
            <div>
              <dt>Правило растра</dt>
              <dd>Включение по центру пикселя</dd>
            </div>
            <div>
              <dt>Пересечения</dt>
              <dd>Пересечение технически назначается ближайшему центру; равенство разрешается по стабильному ID</dd>
            </div>
          </dl>
        </section>

        <section className="module-card population-study__card">
          <div className="module-card__head">
            <div>
              <span>ПАРАМЕТРЫ МЕТОДА</span>
              <h3>Контрольная геометрия</h3>
            </div>
          </div>
          <dl className="population-study__facts">
            <div>
              <dt>Радиус</dt>
              <dd>2,5 км — половина максимального шага сети 5 км</dd>
            </div>
            <div>
              <dt>Площадь зоны</dt>
              <dd>19,634954 км² для каждого поста</dd>
            </div>
            <div>
              <dt>Базовая роза</dt>
              <dd>16 секторов, 8 осей симметрии — операционный вариант, не эталон точности</dd>
            </div>
            <div>
              <dt>Базовые параметры</dt>
              <dd>α = 0,5; Amax = 2; штиль включён</dd>
            </div>
            <div>
              <dt>Допуск площади</dt>
              <dd>Относительная ошибка не более 10⁻⁶</dd>
            </div>
            <div>
              <dt>Фактическая макс. ошибка</dt>
              <dd>2,23 × 10⁻⁷ для 21 секторно-годового сценария</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="module-card population-study__card">
        <div className="module-card__head">
          <div>
            <span>ВОСПРОИЗВОДИМЫЙ ПРОТОКОЛ</span>
            <h3>Параметры построения ветрового контура</h3>
            <p>
              Технические настройки полностью фиксируют текущую реализацию, но не
              являются эмпирически откалиброванной моделью рассеивания.
            </p>
          </div>
          <b className="population-study__badge">equal-area-wind-v1</b>
        </div>
        <dl className="population-study__facts">
          <div>
            <dt>Регуляризация частоты</dt>
            <dd>ε = max(0,01 × средняя частота; 10⁻⁹)</dd>
          </div>
          <div>
            <dt>Ограничение весов</dt>
            <dd>От G / √Amax до G × √Amax; G — геометрическое среднее, Amax = 2</dd>
          </div>
          <div>
            <dt>Интерполяция</dt>
            <dd>Линейная по азимуту и радиусу; 4 интервала на сектор</dd>
          </div>
          <div>
            <dt>Размер полигона</dt>
            <dd>33 / 65 / 145 точек для 8 / 16 / 36 секторов, включая замыкание</dd>
          </div>
          <div>
            <dt>Нормирование площади</dt>
            <dd>3 численных повтора; досрочный критерий остановки не применяется</dd>
          </div>
          <div>
            <dt>Система координат</dt>
            <dd>Хранение EPSG:4326; площадь — локальная плоская аппроксимация на широте поста</dd>
          </div>
          <div>
            <dt>Ветер ERA5</dt>
            <dd>Часовые u/v на высоте 10 м; выборка в координате поста, масштаб 27 830 м</dd>
          </div>
          <div>
            <dt>Штиль</dt>
            <dd>Скорость менее 0,5 м/с; входит в знаменатель, но не в направленные секторы</dd>
          </div>
          <div>
            <dt>Годовой профиль</dt>
            <dd>Все валидные часы календарного года; пропуски не восстанавливаются</dd>
          </div>
          <div>
            <dt>Сезоны</dt>
            <dd>Дек.–фев., март–май, июнь–авг., сент.–нояб.; декабрь относится к своему году</dd>
          </div>
        </dl>
      </section>

      <section className="module-card population-study__card">
        <div className="module-card__head">
          <div>
            <span>НЕЗАВИСИМАЯ ДЕМОГРАФИЧЕСКАЯ ПРОВЕРКА · 2020 И 2025</span>
            <h3>WorldPop, GHS‑POP и официальный итог Рязани</h3>
            <p>Оба растра рассчитаны в одной административной границе и для одного объединения девяти кругов радиусом 2,5 км.</p>
          </div>
          <b className="population-study__badge population-study__badge--green">протокол v1</b>
        </div>
        <div className="population-study__table-wrap">
          <table className="population-study__table">
            <thead><tr><th>Год</th><th>Растр</th><th>Росстат</th><th>Сумма растра</th><th>Смещение</th><th>В кругах</th><th>Охват</th><th>После калибровки</th></tr></thead>
            <tbody>{demographicValidationRows.map((row) => <tr key={`${row[0]}-${row[1]}`}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <div className="population-study__table-wrap">
          <table className="population-study__table">
            <thead><tr><th>Год</th><th>Взвешенный Жаккар</th><th>Перекрытие</th><th>Перераспределение, чел.</th><th>Перераспределение</th><th>Разница охвата</th></tr></thead>
            <tbody>{demographicAgreementRows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <div className="population-study__notes population-study__notes--two">
          <p><strong>Итог:</strong> WorldPop ближе к официальной численности в обеих эпохах. GHS‑POP даёт более низкий городской итог, но после калибровки оценки охвата кругами различаются лишь на 3,6 тыс. человек в 2020 г. и 1,1 тыс. в 2025 г.</p>
          <p><strong>Ограничение:</strong> около 12% населения меняет ячейку между калиброванными поверхностями на общей сетке 1 км. Это межмодельная чувствительность, а не проверка по адресам фактического проживания.</p>
        </div>
      </section>

      <section className="module-card population-study__card">
        <div className="module-card__head">
          <div>
            <span>ОФИЦИАЛЬНАЯ ДЕМОГРАФИЧЕСКАЯ ОСНОВА</span>
            <h3>Плотность населения городского округа Рязань</h3>
            <p>
              Данные приведены на 1 января соответствующего года. Показатели
              2019–2024 опубликованы Рязаньстатом; значение 2025 года рассчитано
              из официальной численности и последней опубликованной площади.
            </p>
          </div>
          <b className="population-study__badge">Росстат · Росреестр</b>
        </div>
        <div className="population-study__table-wrap">
          <table className="population-study__table">
            <thead>
              <tr>
                <th>Год</th>
                <th>Население, чел.</th>
                <th>Площадь, км²</th>
                <th>Плотность, чел./км²</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {rosstatDensityRows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td
                      className={index === 3 ? "is-primary" : undefined}
                      key={index}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="population-study__notes population-study__sources">
          <p>
            <strong>Источники:</strong>{" "}
            <a
              href="https://62.rosstat.gov.ru/statpublications/document/43914"
              target="_blank"
              rel="noreferrer"
            >
              архив статистических ежегодников Рязаньстата
            </a>
            ,{" "}
            <a
              href="https://rosstat.gov.ru/compendium/document/13282"
              target="_blank"
              rel="noreferrer"
            >
              численность населения по муниципальным образованиям Росстата
            </a>
            ,{" "}
            <a
              href="https://62.rosstat.gov.ru/storage/mediabank/%D0%A2%D0%BE%D0%BC%201%283%29.pdf"
              target="_blank"
              rel="noreferrer"
            >
              ежегодник за 2022 год, том 1
            </a>
            ,{" "}
            <a
              href="https://62.rosstat.gov.ru/storage/mediabank/%D0%A2%D0%BE%D0%BC%201%285%29.pdf"
              target="_blank"
              rel="noreferrer"
            >
              ежегодник за 2023 год, том 1
            </a>
            ,{" "}
            <a
              href="https://62.rosstat.gov.ru/storage/mediabank/%D0%A2%D0%BE%D0%BC%201-2024.pdf"
              target="_blank"
              rel="noreferrer"
            >
              ежегодник за 2024 год, том 1
            </a>
            .
          </p>
          <p>
            В 2022 году опубликованная площадь изменилась с 223,7 до 222,1 км².
            Кроме того, ряд имеет методологический разрыв: оценка на 01.01.2022
            дана без учёта итогов ВПН-2020, а на 01.01.2023 — с их учётом.
            Поэтому межгодовые изменения нельзя объяснять только демографией.
          </p>
          <p>
            В режиме «Плотность Росстата» модуль применяет среднее значение
            равномерно: население зоны = площадь зоны × плотность. Этот сценарий
            нужен для официальной контрольной оценки, но не воспроизводит
            внутригородскую неоднородность населения, доступную в WorldPop.
          </p>
        </div>
      </section>

      <section className="module-card population-study__card">
        <div className="module-card__head">
          <div>
            <span>МЕЖМУНИЦИПАЛЬНЫЙ РАСЧЁТ</span>
            <h3>Рязанский муниципальный округ</h3>
            <p>
              Данные используются для частей зон, выходящих за административную
              границу Рязани. Городская плотность на эти участки не переносится.
            </p>
          </div>
          <b className="population-study__badge">Рязаньстат · Росреестр</b>
        </div>
        <div className="population-study__table-wrap">
          <table className="population-study__table">
            <thead><tr><th>Год</th><th>Население, чел.</th><th>Площадь, км²</th><th>Плотность, чел./км²</th></tr></thead>
            <tbody>{ryazanskyDensityRows.map((row) => (
              <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
        <div className="population-study__notes population-study__notes--two">
          <p><strong>Правило:</strong> WorldPop суммируется по пикселям каждой пересечённой муниципальной части; в режиме Росстата каждая часть получает плотность своего муниципалитета.</p>
          <p><strong>Версия ряда:</strong> использованы опубликованные для соответствующих лет оценки. Позднейшие пересчёты по ВПН‑2020 не смешиваются с исходным рядом.</p>
        </div>
      </section>

      <section className="module-card population-study__card">
        <div className="module-card__head">
          <div>
            <span>ФИКСИРОВАННЫЕ КРУГИ · WORLDPOP 2025</span>
            <h3>Полные зоны постов по муниципалитетам</h3>
            <p>Полная зона не обрезается границей Рязани; пересечения постов допускают повторный учёт и поэтому строки нельзя суммировать.</p>
          </div>
          <b className="population-study__badge">Объединение зон · 348 189 чел.</b>
        </div>
        <div className="population-study__table-wrap">
          <table className="population-study__table">
            <thead><tr><th>Пост</th><th>Рязань, чел.</th><th>Рязанский округ, чел.</th><th>Полная зона, чел.</th></tr></thead>
            <tbody>{municipalZoneRows.map((row) => (
              <tr key={row[0]}>{row.map((cell, index) => <td className={index === 3 ? "is-primary" : undefined} key={index}>{cell}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
        <div className="population-study__notes population-study__notes--two">
          <p><strong>WorldPop:</strong> объединение кругов включает 340 549 жителей Рязани и 7 640 жителей Рязанского округа — всего 348 189 человек без двойного учёта.</p>
          <p><strong>Плотность Росстата:</strong> соответствующие значения равны 235 308, 877 и 236 185 человек.</p>
        </div>
      </section>

      <section className="module-card population-study__card">
        <div className="module-card__head">
          <div>
            <span>СОПОСТАВЛЕНИЕ ДЕМОГРАФИЧЕСКИХ ОСНОВ · 2025</span>
            <h3>WorldPop и равномерная плотность Росстата</h3>
            <p>
              Расчёт выполнен в одной административной границе городского округа
              Рязань для одних и тех же девяти постов.
            </p>
          </div>
        </div>
        <div className="population-study__table-wrap">
          <table className="population-study__table population-study__table--demography">
            <thead>
              <tr>
                <th>Геометрия зон</th>
                <th>Демографическая основа</th>
                <th>Население территории</th>
                <th>Покрыто, чел.</th>
                <th>Покрыто, %</th>
                <th>Вне зон, чел.</th>
              </tr>
            </thead>
            <tbody>
              {demographicComparisonRows.map((row) => (
                <tr key={row.join("-")}>
                  {row.map((cell, index) => (
                    <td
                      className={index === 4 && row[1].startsWith("WorldPop") ? "is-primary" : undefined}
                      key={index}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="population-study__notes population-study__notes--two">
          <p>
            <strong>WorldPop:</strong> сумма внутри городской границы составляет
            528 539 человек — на 9 224 человека, или 1,78%, выше официальной
            численности 519 315 человек на 1 января 2025 года.
          </p>
          <p>
            <strong>Интерпретация:</strong> Росстат задаёт официальный муниципальный
            итог, но равномерно распределяет его по площади. WorldPop является
            модельной поверхностью и отражает внутригородскую концентрацию населения;
            результаты источников следует показывать раздельно.
          </p>
        </div>
      </section>

      <section className="module-card population-study__card">
        <div className="module-card__head">
          <div>
            <span>МЕЖГОДОВАЯ УСТОЙЧИВОСТЬ</span>
            <h3>Базовый 16-секторный сценарий</h3>
            <p>Жаккар рассчитан относительно геометрии 2021 года.</p>
          </div>
          <b className="population-study__badge">Диапазон 0,413 п.п.</b>
        </div>
        <div className="population-study__table-wrap">
          <table className="population-study__table">
            <thead>
              <tr>
                <th>Год</th>
                <th>Покрыто, чел.</th>
                <th>Покрыто, %</th>
                <th>Вне зон, чел.</th>
                <th>Жаккар</th>
              </tr>
            </thead>
            <tbody>
              {annualRows.map((row) => (
                <tr key={row.year}>
                  <td>
                    <strong>{row.year}</strong>
                  </td>
                  <td>{integer.format(row.covered)}</td>
                  <td>{decimal.format(row.percent)}%</td>
                  <td>{integer.format(572928 - row.covered)}</td>
                  <td>{decimal.format(row.jaccard)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Среднее</td>
                <td>348 346</td>
                <td>60,801%</td>
                <td>224 582</td>
                <td>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="module-card population-study__card">
        <div className="module-card__head">
          <div>
            <span>УГЛОВОЕ РАЗРЕШЕНИЕ</span>
            <h3>Сравнение 8, 16 и 36 секторов</h3>
            <p>
              В каждой ячейке указаны покрытое население и доля
              исследовательской области.
            </p>
          </div>
          <b className="population-study__badge population-study__badge--green">
            Рекомендуется 16
          </b>
        </div>
        <div className="population-study__table-wrap">
          <table className="population-study__table population-study__table--sectors">
            <thead>
              <tr>
                <th>Год</th>
                <th>8 секторов · 4 оси</th>
                <th>16 секторов · 8 осей</th>
                <th>36 секторов · 18 осей</th>
              </tr>
            </thead>
            <tbody>
              {sectorRows.map((row) => (
                <tr key={row.year}>
                  <td>
                    <strong>{row.year}</strong>
                  </td>
                  <td>{row.sectors8}</td>
                  <td className="is-primary">{row.sectors16}</td>
                  <td>{row.sectors36}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="population-study__notes">
          <p>
            <strong>8 секторов:</strong> наиболее сглаженный результат;
            межгодовой диапазон 1 999 человек, средний межгодовой Жаккар 0,940.
          </p>
          <p>
            <strong>16 секторов:</strong> рабочий компромисс; диапазон 2 367
            человек, средний межгодовой Жаккар 0,925.
          </p>
          <p>
            <strong>36 секторов:</strong> нативное разбиение по 10°; диапазон 2
            472 человека, средний межгодовой Жаккар 0,913.
          </p>
          <p>
            <strong>Максимальная разница:</strong> 1 663 человека, или 0,290
            п.п., между разрешениями в 2021 году.
          </p>
        </div>
      </section>

      <section className="module-card population-study__card">
        <div className="module-card__head">
          <div>
            <span>ПАРАМЕТРИЧЕСКАЯ ЧУВСТВИТЕЛЬНОСТЬ · 2019–2025</span>
            <h3>Параметр направленности α</h3>
            <p>В ячейках: покрытое население · доля территории.</p>
          </div>
          <b className="population-study__badge">28 сценариев</b>
        </div>
        <div className="population-study__table-wrap">
          <table className="population-study__table population-study__table--sectors">
            <thead>
              <tr><th>Год</th><th>α = 0,25</th><th>α = 0,50</th><th>α = 0,75</th><th>α = 1,00</th></tr>
            </thead>
            <tbody>
              {alphaRows.map((row) => (
                <tr key={row[0]}>{row.map((cell, index) => <td className={index === 2 ? "is-primary" : undefined} key={cell}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="population-study__notes">
          <p><strong>Полный диапазон:</strong> 345 544–351 803 человека (60,312–61,404%).</p>
          <p><strong>Максимальная внутригодовая чувствительность:</strong> 4 114 человек, или 0,718 п.п., в 2025 году.</p>
        </div>
      </section>

      <section className="module-card population-study__card">
        <div className="module-card__head">
          <div>
            <span>СЕЗОННАЯ УСТОЙЧИВОСТЬ · 2019–2025</span>
            <h3>Четыре сезона каждого года</h3>
            <p>В ячейках: покрытое население · доля территории.</p>
          </div>
          <b className="population-study__badge">28 сценариев</b>
        </div>
        <div className="population-study__table-wrap">
          <table className="population-study__table population-study__table--sectors">
            <thead><tr><th>Год</th><th>Зима</th><th>Весна</th><th>Лето</th><th>Осень</th></tr></thead>
            <tbody>
              {seasonalRows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
        <div className="population-study__notes">
          <p><strong>Полный диапазон:</strong> 344 331–352 387 человек (60,100–61,506%).</p>
          <p><strong>Максимальный сезонный диапазон одного года:</strong> 7 119 человек, или 1,242 п.п., в 2022 году.</p>
        </div>
      </section>

      <section className="module-card population-study__card">
        <div className="module-card__head">
          <div>
            <span>ДОПОЛНИТЕЛЬНЫЕ ПРОВЕРКИ · 2019–2025</span>
            <h3>Анизотропия, штиль и направленная форма</h3>
          </div>
          <b className="population-study__badge">28 сценариев</b>
        </div>
        <div className="population-study__table-wrap">
          <table className="population-study__table population-study__table--sectors">
            <thead><tr><th>Год</th><th>Amax = 1,5</th><th>Amax = 2,5</th><th>Без штиля</th><th>Направленный асимметричный</th></tr></thead>
            <tbody>
              {ablationRows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
        <div className="population-study__notes">
          <p><strong>Анизотропия:</strong> максимальное отличие от Amax = 2 составило 130 человек (0,023 п.п.).</p>
          <p><strong>Исключение штиля:</strong> максимальное абсолютное изменение — 299 человек (0,052 п.п.).</p>
          <p><strong>Направленный асимметричный сценарий:</strong> увеличение относительно осесимметричного варианта составило 6 733–15 442 человека (1,175–2,695 п.п.).</p>
        </div>
      </section>

      <section className="module-card population-study__card">
        <div className="module-card__head">
          <div>
            <span>СТРУКТУРНАЯ ЧУВСТВИТЕЛЬНОСТЬ · 2019–2025</span>
            <h3>Осесимметричная и направленная геометрия</h3>
          </div>
          <b className="population-study__badge">7 сравнений</b>
        </div>
        <div className="population-study__method-note">
          <p>
            В основном сценарии пост рассматривается как рецептор, а противоположные
            направления объединяются в одну пространственную ось.
          </p>
          <div className="population-study__formula-row" aria-label="Формулы сравниваемых сценариев">
            <span><b>Осесимметричный:</b> F<sub>s</sub> = f<sub>s</sub> + f<sub>s+180°</sub></span>
            <span><b>Направленный:</b> F<sub>s</sub><sup>dir</sup> = f<sub>s</sub></span>
            <span><b>Площадь:</b> 19,634954 км² для каждого контура</span>
          </div>
          <p>
            Площадь в обоих вариантах одинакова, поэтому разность определяется
            положением геометрии относительно населения, соседних зон и границы
            исследования.
          </p>
        </div>
        <div className="population-study__table-wrap">
          <table className="population-study__table population-study__table--sectors">
            <thead>
              <tr><th>Год</th><th>Осесимметричный</th><th>Направленный</th><th>Δ, чел.</th><th>Δ, п.п.</th></tr>
            </thead>
            <tbody>
              {directionalComparisonRows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
        <div className="population-study__notes population-study__notes--two">
          <p><strong>Интерпретация:</strong> направленный вариант является стресс-сценарием, а не моделью шлейфа. Роза ветров без данных об источниках, измеренных полях концентраций или расчётах рассеивания не позволяет доказать, какая сторона относительно поста должна считаться зоной воздействия.</p>
          <p><strong>Вывод:</strong> тип симметрии заметно влияет на охват и должен фиксироваться в протоколе, но эти результаты не доказывают физическое преимущество направленной формы.</p>
        </div>
      </section>

      <section className="module-card population-study__card">
        <div className="module-card__head">
          <div>
            <span>МАКРОРЕЛЬЕФ · 2019–2025</span>
            <h3>Ветер и рельеф: годовые сценарии</h3>
            <p>
              Copernicus DEM GLO-30, расчётный шаг 90 м; профиль по 16
              направлениям до 5 км. Площадь каждого контура сохранена.
            </p>
          </div>
          <b className="population-study__badge">7 сравнений</b>
        </div>
        <div className="population-study__method-note">
          <p>
            Рельефный множитель применяется к ветровым весам до ограничения
            анизотропии и повторной равноплощадной нормировки. Это сценарная
            деформация, а не модель воздушного потока или рассеивания.
          </p>
        </div>
        <div className="population-study__table-wrap">
          <table className="population-study__table population-study__table--sectors">
            <thead>
              <tr><th>Год</th><th>Только ветер</th><th>Ветер + рельеф</th><th>Δ, чел.</th><th>Δ, п.п.</th><th>Площадной J</th><th>Взвешенный J</th><th>Население симм. разности</th><th>Симм. разность, км²</th><th>Среднее смещение, м</th><th>d95, м</th><th>Добавлено, чел.</th><th>Исключено, чел.</th></tr>
            </thead>
            <tbody>
              {terrainAnnualRows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
        <div className="population-study__notes population-study__notes--two">
          <p><strong>Годовой результат:</strong> −397…−1 101 человек, или −0,069…−0,192 п.п.; среднее изменение −787 человек (−0,137 п.п.).</p>
          <p><strong>Все 28 сезонов:</strong> −227…−1 151 человек (−0,040…−0,201 п.п.); площадной J 0,9940–0,9960; взвешенный J 0,9939–0,9970; население симметрической разности 1 019–2 124 человека.</p>
        </div>
      </section>

      <section className="module-card population-study__card">
        <div className="module-card__head">
          <div>
            <span>ДЕТАЛИЗАЦИЯ ПО ПОСТАМ · 2025</span>
            <h3>Рельеф и население собственной зоны</h3>
            <p>
              Постовые значения содержат пересечения и не предназначены для
              суммирования в общий охват сети.
            </p>
          </div>
          <b className="population-study__badge population-study__badge--green">9 постов</b>
        </div>
        <div className="population-study__table-wrap">
          <table className="population-study__table">
            <thead>
              <tr><th>Пост</th><th>Отметка, м</th><th>Макс. подъём, м</th><th>Диапазон, м</th><th>Коэффициент</th><th>Ветер, чел.</th><th>С рельефом, чел.</th><th>Δ</th></tr>
            </thead>
            <tbody>
              {terrainStationRows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
        <div className="population-study__notes population-study__notes--two">
          <p><strong>Наибольший локальный сдвиг:</strong> ПНЗ № 3, −1 142 человека; здесь же максимальны подъём и диапазон высот.</p>
          <p><strong>Интерпретация:</strong> знак определяется совместным положением рельефа, ветровой формы и населения; у трёх постов собственная численность немного выросла.</p>
        </div>
      </section>

      <section className="module-card population-study__card">
        <div className="module-card__head">
          <div>
            <span>ФУНДАМЕНТАЛЬНАЯ НЕОПРЕДЕЛЁННОСТЬ · 9 ПОСТОВ</span>
            <h3>Что сильнее всего меняет оценку покрытия</h3>
            <p>Однофакторные проверки выполнены на WorldPop 2025 для фиксированных зон; основной знаменатель — административная граница Рязани.</p>
          </div>
          <b className="population-study__badge population-study__badge--green">200 Монте-Карло реализаций</b>
        </div>

        <div className="population-study__method-note">
          <p><strong>Радиус зоны.</strong> Переход от 1 до 5 км изменяет долю охвата с 20,006% до 98,276%. Радиус 2,5 км остаётся операционным контрольным масштабом, а не установленной зоной репрезентативности.</p>
        </div>
        <div className="population-study__table-wrap">
          <table className="population-study__table">
            <thead><tr><th>Радиус</th><th>Население территории</th><th>Покрыто, чел.</th><th>Покрыто, %</th><th>Площадь зон в городе, км²</th></tr></thead>
            <tbody>{fundamentalRadiusRows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>

        <div className="population-study__table-wrap">
          <table className="population-study__table">
            <thead><tr><th>Граница знаменателя</th><th>Население территории</th><th>Покрыто, чел.</th><th>Покрыто, %</th></tr></thead>
            <tbody>{fundamentalBoundaryRows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <div className="population-study__notes population-study__notes--two">
          <p><strong>Граница:</strong> при одной сети доля меняется от 58,688% до 64,432%. Техническая рамка пригодна для ретроспективного сравнения, но не должна задавать основной практический знаменатель.</p>
          <p><strong>Муниципальная калибровка:</strong> приведение WorldPop к данным Росстата уменьшает городской абсолютный охват с 340 549 до 334 606 человек; доля в пределах одного муниципалитета сохраняется.</p>
        </div>

        <div className="population-study__table-wrap">
          <table className="population-study__table">
            <thead><tr><th>Правило ячейки</th><th>Население территории</th><th>Покрыто, чел.</th><th>Покрыто, %</th><th>Δ к центру</th></tr></thead>
            <tbody>{fundamentalRasterRows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <div className="population-study__table-wrap">
          <table className="population-study__table">
            <thead><tr><th>Разрешение</th><th>Население территории</th><th>Покрыто, чел.</th><th>Покрыто, %</th></tr></thead>
            <tbody>{fundamentalResolutionRows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <div className="population-study__notes population-study__notes--two">
          <p><strong>Пиксели:</strong> пропорциональный учёт отличается от правила центра на 27 человек и 0,030 п.п.; «любое касание» даёт верхнюю оценку +1,253 п.п.</p>
          <p><strong>Разрешение:</strong> агрегация до 250–1000 м меняет долю на −0,105…−0,422 п.п. Значения населения при агрегации суммируются.</p>
        </div>

        <div className="population-study__table-wrap">
          <table className="population-study__table population-study__table--sectors">
            <thead><tr><th>Смещение</th><th>Среднее</th><th>Минимум</th><th>P05</th><th>P95</th><th>Максимум</th><th>Макс. |Δ|</th></tr></thead>
            <tbody>{fundamentalShiftRows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <div className="population-study__notes population-study__notes--two">
          <p><strong>Координаты:</strong> для каждого поста направление и величина смещения выбирались независимо; 200 повторов, зерно 6202026. При смещении до 100 м центральный 90%-й сценарный интервал равен 335,0–345,8 тыс. человек, или примерно 63,4–65,4%.</p>
          <p><strong>Точность представления:</strong> целые люди и 0,001 п.п. сохранены для воспроизводимости сравнений, но не означают фактической точности. Интервал координат является сценарным, а не доверительным. Совокупный вероятностный интервал без моделей ошибок WorldPop и геометрии не рассчитывается.</p>
        </div>
      </section>

      <section className="module-card population-study__interpretation">
        <div>
          <span>ИНТЕРПРЕТАЦИЯ</span>
          <h3>Границы применимости</h3>
        </div>
        <ul>
          <li>
            16 секторов выбраны как операционный баланс между сглаживанием и
            угловой детализацией; это не нормативно установленное разрешение.
          </li>
          <li>
            Близкая численность населения не означает совпадения
            пространственных границ — поэтому вместе с процентом анализируется
            коэффициент Жаккара.
          </li>
          <li>
            Одна поверхность WorldPop 2025 использована для всех
            метеорологических лет; результаты не описывают демографическую
            динамику.
          </li>
          <li>
            Контуры являются сценариями расчётной территории, а не моделью
            рассеивания и не оценкой фактически экспонированного населения.
          </li>
        </ul>
      </section>
    </div>
  );
}
