export type ExperimentOperation = "status" | "submit" | "cancel" | "history" | "validate" | "compute";

export function explainExperimentError(failure: unknown, operation: ExperimentOperation) {
  const status = failure && typeof failure === "object" && "status" in failure && typeof failure.status === "number" ? failure.status : null;
  const detail = failure instanceof Error ? failure.message : String(failure);
  const statusMissing = operation === "status" && status === 404;
  let title: string, advice: string;
  if (failure instanceof RangeError) {
    title = "Проверьте параметры эксперимента";
    advice = "Исправьте указанные значения перед запуском. Задание не отправлено.";
  } else if (operation === "compute") {
    title = "Вычисление завершилось с ошибкой";
    advice = "Исходный расчёт не изменён. Устраните причину из ответа исполнителя перед повторной проверкой.";
  } else if (status === 404) {
    title = operation === "status" ? "Задание не найдено" : "Запрошенные материалы недоступны";
    advice = operation === "status" ? "Вернитесь к сохранённым экспериментам. Отсутствие задания не означает, что оно завершилось успешно." : "Проверьте, доступен ли исходный расчёт в отчётах сети.";
  } else if (status === 405) {
    title = "Сервер не поддерживает эту операцию";
    advice = "Обновите и перезапустите backend, затем обновите страницу.";
  } else if (status === 409) {
    title = "Результат пока недоступен";
    advice = "Проверьте завершение исходного расчёта и наличие сохранённого паспорта. Повторная отправка эксперимента не восстанавливает потерянный файл.";
  } else if (status === 422) {
    title = "Эксперимент не может быть выполнен с этими данными";
    advice = "Исправьте указанную сервером причину. Если нет сохранённой матрицы или геометрий, потребуется новый исходный расчёт; его старый результат сохранится.";
  } else if (status === 429) {
    title = "Вычислительные ресурсы заняты";
    advice = "Проверьте очередь и дождитесь завершения либо отмените ненужное задание.";
  } else {
    title = status != null ? "Не удалось получить ответ для этой операции" : "Связь с сервером не подтверждена";
    advice = operation === "submit" ? "Добавление задания не подтверждено. Сначала проверьте очередь, чтобы не отправить повторный эксперимент." : operation === "cancel" ? "Отмена не подтверждена. Проверьте статус задания; не считайте его остановленным." : operation === "status" ? "Текущее состояние неизвестно. Повторите проверку статуса; новый эксперимент не нужен для восстановления связи." : "Повторите загрузку. Неудачная загрузка не означает отсутствие сохранённых результатов.";
  }
  return {status, statusMissing, message:`${title}. ${advice}`, detail};
}
