(function (root) {
  const validKey = (key) => /^\d{4}-\d{2}-\d{2}$/.test(key || "") && Number.isFinite(Date.parse(`${key}T12:00:00Z`)) && new Date(`${key}T12:00:00Z`).toISOString().slice(0, 10) === key;
  const dateKey = (value) => {
    if (validKey(value)) return value;
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value || "");
    const key = match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
    return validKey(key) ? key : "";
  };
  const today = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const holidayKeys = (events = []) => new Set(events.filter((e) => e.type === "global-holiday" && e.holidayActive === true).map((e) => e.dateKey));
  const overlay = (event, keys) => keys.has(event.dateKey) ? { ...event, holidayOriginalStatus: event.holidayOriginalStatus || event.status, status: "feriado", holiday: true } : event;
  const packageState = (pack, used, key = today()) => {
    const start = dateKey(pack.startDate), end = dateKey(pack.endDate);
    if (pack.status === "encerrado" || used >= Number(pack.total)) return "Encerrado";
    if (end && key > end) return "Vencido";
    if (start && key < start) return "Ainda não começou";
    return "Ativo";
  };
  const schedulingError = (key, keys, pack) => {
    if (!validKey(key)) return "Informe uma data válida com dia, mês e ano.";
    if (keys.has(key)) return "Feriado: não é possível agendar aulas nesta data.";
    if (pack) {
      const start = dateKey(pack.startDate), end = dateKey(pack.endDate);
      if ((start && key < start) || (end && key > end)) return "Aula fora da validade do pacote.";
      if (pack.status === "encerrado") return "Pacote encerrado.";
    }
    return "";
  };
  root.CalendarRules = { validKey, dateKey, today, holidayKeys, overlay, packageState, schedulingError };
})(globalThis);
