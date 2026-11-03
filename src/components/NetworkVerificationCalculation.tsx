import {
  calculations,
  methodGeometryStatus,
} from "../shared/networkVerificationCalculations";
import {
  methodNames,
  type VerificationCase,
  type VerificationMethod,
} from "../shared/networkVerification";

const number = (value: number, digits = 3) =>
  value.toLocaleString("ru-RU", { maximumFractionDigits: digits });

export function NetworkVerificationCalculation({
  item,
  method,
}: {
  item: VerificationCase;
  method: VerificationMethod | undefined;
}) {
  const source = calculations[item.id];
  const sums = method && source?.methods[method.method];
  const coverage = method?.common_pixel_coverage;
  const check = method?.exact_geometry_check;
  const reference = item.methods.find((row) => row.method === "spopt");
  const review = method?.requires_review_positions ?? 0;
  const infeasible = item.classification === "infeasible";
  const selected = method?.coordinates.length ?? 0;
  return (
    <section className="nv-worked" aria-labelledby="nv-worked-title">
      <header>
        <span className="nv-eyebrow">ПРОВЕРКА С ЧИСЛАМИ</span>
        <h4 id="nv-worked-title">Как проверен этот расчёт</h4>
        <p>
          {item.city} · точек: {item.post_count} · сетка {number(item.grid_km)}{" "}
          км
        </p>
        <p>
          {method ? methodNames[method.method] : "Задание без решения"}. Разбор
          сохранённых данных: новый поиск точек не запускается.
        </p>
      </header>
      <ol className="nv-worked-steps">
        <li>
          <h5>Выполнение задания</h5>
          <p>
            Задано точек: {item.post_count}. Кандидатов в использованном пуле:{" "}
            {number(source.candidate_count, 0)}.
          </p>
          <div
            className="nv-formula"
            role="math"
            aria-label="Проверка достаточности кандидатов"
          >
            {number(source.candidate_count, 0)}{" "}
            {source.candidate_count >= item.post_count ? "≥" : "<"}{" "}
            {item.post_count}
            {infeasible
              ? " — кандидатов недостаточно"
              : `; получено ${selected} из ${item.post_count} точек`}
          </div>
          {infeasible && (
            <p>
              Задание невыполнимо на этой сетке. Координаты, охват и целевая
              функция отсутствуют. Для Кораблина задание на 5 точек выполнено на
              сетке 0,5 км.
            </p>
          )}
        </li>
        {!infeasible && (
          <>
            <li>
              <h5>Геометрия выбранных точек</h5>
              <p>
                Проверены граница города, жилые контуры и исключающие маски.
              </p>
              <div className="nv-formula">
                {methodGeometryStatus(method)}
                {check
                  ? `: ${check.sites.filter((site) => site.valid).length} из ${check.sites.length} точек прошли геометрические условия`
                  : ""}
                .
              </div>
              <p>
                {review
                  ? `У ${review} ${review === 1 ? "точки есть условные ограничения — нужна" : "точек есть условные ограничения — нужна"} экспертная проверка. `
                  : ""}
                Пригодность площадки для установки поста устанавливается
                обследованием.
              </p>
            </li>
            <li>
              <h5>Целевая функция без повторного учёта</h5>
              {sums ? (
                <>
                  <p>
                    Складываем веса ячеек в пределах радиуса каждой точки. Затем
                    вычитаем повторный учёт общих ячеек.
                  </p>
                  <div
                    className="nv-formula"
                    role="math"
                    aria-label="Сумма весов отдельных точек минус повторный учёт"
                  >
                    {sums.per_point
                      .map((point) => number(point.weight_sum))
                      .join(" + ")}{" "}
                    − {number(sums.duplicate_weight)} ={" "}
                    <strong>{number(sums.union_weight)}</strong>
                  </div>
                  <p>
                    Охвачено {number(sums.covered_cell_count, 0)} уникальных
                    ячеек из {number(source.demand_cell_count, 0)}. Каждая
                    учтена один раз.
                  </p>
                  <p>
                    Расхождение с сохранённой целью:{" "}
                    <strong>
                      {method?.objective_value == null
                        ? "не определено"
                        : number(
                            Math.abs(
                              sums.union_weight - method.objective_value,
                            ),
                            6,
                          )}
                    </strong>
                    . Вычисления используют полную точность; здесь суммы
                    округлены до 0,001.
                  </p>
                  <details className="nv-details">
                    <summary>Вклад каждой точки</summary>
                    <div className="nv-table-scroll">
                      <table className="nv-table">
                        <thead>
                          <tr>
                            <th>Точка</th>
                            <th>Ячеек в радиусе</th>
                            <th>Сумма весов</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sums.per_point.map((point, index) => (
                            <tr key={index}>
                              <td>{index + 1}</td>
                              <td>{number(point.cell_count, 0)}</td>
                              <td>{number(point.weight_sum)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p>
                        Поправка на повторы равна сумме по отдельным точкам
                        минус сумма по объединению. Она учитывает и тройные, и
                        более сложные пересечения.
                      </p>
                    </div>
                  </details>
                </>
              ) : (
                <p>Подробные суммы для этого метода отсутствуют.</p>
              )}
            </li>
            <li>
              <h5>Контроль охвата по исходным пикселям</h5>
              {coverage && coverage.denominator > 0 ? (
                <>
                  <p>
                    Население пригодных пикселей в пределах{" "}
                    {number(item.radius_m / 1000)} км хотя бы от одной точки
                    делим на население всех пригодных пикселей внутри города.
                  </p>
                  <div
                    className="nv-formula"
                    role="math"
                    aria-label="Формула процента охвата населения"
                  >
                    {number(coverage.covered_population)} /{" "}
                    {number(coverage.denominator)} × 100% ={" "}
                    <strong>{number(coverage.coverage_percent, 2)}%</strong>
                  </div>
                  <p>
                    Это модельная оценка по доступным данным. В знаменатель не
                    входят пиксели без пригодных значений. Матричная цель
                    использует расчётные ячейки, а этот контроль — исходные
                    пиксели в точной границе города; значения могут различаться.
                  </p>
                </>
              ) : (
                <p>
                  Пиксельный охват отсутствует; нулевой результат не
                  подставляется.
                </p>
              )}
            </li>
            <li>
              <h5>Сравнение с независимым решением</h5>
              {reference?.objective_value != null &&
              method?.objective_value != null ? (
                <>
                  <div
                    className="nv-formula"
                    role="math"
                    aria-label="Абсолютная разница целевых функций"
                  >
                    |{number(method.objective_value)} −{" "}
                    {number(reference.objective_value)}| ={" "}
                    <strong>
                      {number(
                        Math.abs(
                          method.objective_value - reference.objective_value,
                        ),
                        6,
                      )}
                    </strong>
                  </div>
                  <p>
                    {method.method === "spopt"
                      ? "Выбран сам контрольный метод spopt; сравнение с ним не является отдельным подтверждением."
                      : item.independent_confirmation &&
                          method.method === "primary_milp"
                        ? "Основная цель совпала с независимым оптимальным решением spopt на той же матрице."
                        : "Сопоставляется только основная целевая функция выбранного метода и spopt."}{" "}
                    Это не подтверждает качество исходных данных или
                    экологическую эффективность сети.
                  </p>
                </>
              ) : (
                <p>
                  {item.reference?.status === "reference_skipped_size_limit"
                    ? "Независимое решение пропущено из-за размера задачи. Это не ошибка расчёта и не подтверждение оптимума."
                    : "Независимое сравнение отсутствует."}
                </p>
              )}
            </li>
          </>
        )}
      </ol>
      <details className="nv-details nv-model">
        <summary>Математическая постановка и обозначения</summary>
        <div>
          <p>
            M = {number(source.candidate_count, 0)} кандидатов; K ={" "}
            {number(source.demand_cell_count, 0)} ячеек; N = {item.post_count}{" "}
            точек; R = {number(item.radius_m / 1000)} км.
          </p>
          <div
            className="nv-formula"
            role="math"
            aria-label="Максимизировать сумму весов охваченных ячеек"
          >
            max Z = Σ<sub>i=1…K</sub> w<sub>i</sub> y<sub>i</sub>
          </div>
          <div
            className="nv-formula"
            role="math"
            aria-label="Ограничения модели"
          >
            Σ<sub>j=1…M</sub> x<sub>j</sub> = N<br />y<sub>i</sub> ≤ Σ
            <sub>j=1…M</sub> a<sub>ij</sub>x<sub>j</sub>
            <br />x<sub>j</sub>, y<sub>i</sub> ∈ &#123;0, 1&#125;
          </div>
          <p>
            x<sub>j</sub> = 1, если кандидат j выбран; y<sub>i</sub> = 1, если
            ячейка i охвачена; w<sub>i</sub> — её вес населения. a<sub>ij</sub>{" "}
            = 1, если расстояние от кандидата j до центра ячейки i не превышает
            R по сохранённой матрице покрытия.
          </p>
          <div
            className="nv-formula"
            role="math"
            aria-label="Формула контрольного охвата"
          >
            C = 100% × (Σ<sub>k∈V</sub> p<sub>k</sub> · 1[min<sub>j:xⱼ=1</sub>{" "}
            d(k,j) ≤ R]) / Σ<sub>k∈V</sub> p<sub>k</sub>
          </div>
          <p>
            V — пригодные исходные пиксели внутри границы города; p<sub>k</sub>{" "}
            — население пикселя; d — расстояние по сфере. Индикатор 1[условие]
            равен единице при выполнении условия. Перекрытия учитываются один
            раз.
          </p>
          <p>
            Это основная задача максимального покрытия. Основной алгоритм также
            использует вторичный критерий выбора среди решений с сохранением
            основной цели. Эвристики не гарантируют максимум. При сокращённом
            пуле выводы относятся к использованным кандидатам.
          </p>
          <p>
            Радиус — геометрический параметр проверки; он не задаёт физическую
            область обнаружения загрязнения.
          </p>
          <small>
            Идентификатор расчёта: {item.id}
            <br />
            SHA256 матрицы: <code>{source.matrix_sha256}</code>
          </small>
        </div>
      </details>
    </section>
  );
}
