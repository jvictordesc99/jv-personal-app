// The owner explicitly reviews and publishes this snapshot. Never infer authority
// from profiles.role, user_metadata, names or the anonymous app_state document.
export function buildCancellationCatalog(input: any) {
  if (!Array.isArray(input?.students) || !Array.isArray(input?.packages) || !Array.isArray(input?.checkins)) throw new Error("Catalogo invalido.");
  if (input.students.length > 2000 || input.packages.length > 5000 || input.checkins.length > 50000) throw new Error("Catalogo muito grande.");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const students = input.students.map((s: any) => {
    if (!s.id || !s.name || !uuid.test(s.authUserId)) throw new Error("Confira o ID Supabase de cada aluno.");
    return { id: String(s.id), name: String(s.name), authUserId: s.authUserId };
  });
  if (new Set(students.map((s: any) => s.id)).size !== students.length || new Set(students.map((s: any) => s.authUserId)).size !== students.length) throw new Error("Vinculo de aluno duplicado.");
  const studentIds = new Set(students.map((s: any) => s.id));
  const dateKey = (value: string) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || "");
    if (!m) throw new Error("Data do pacote invalida.");
    const key = `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date(`${key}T12:00:00Z`);
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== key) throw new Error("Data do pacote invalida.");
    return d;
  };
  const packages = input.packages.map((p: any) => {
    if (!p.id || !studentIds.has(p.studentId) || !Number.isInteger(Number(p.total)) || p.total <= 0) throw new Error("Pacote sem aluno vinculado ou saldo valido.");
    const start = dateKey(p.startDate), end = dateKey(p.endDate);
    if (end < start || end.getTime() - start.getTime() > 5 * 366 * 86400000) throw new Error("Periodo do pacote invalido.");
    const text = String(p.days || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const weekdays = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"].flatMap((name, index) => text.includes(name) ? [index] : []);
    if (!weekdays.length) throw new Error("Pacote sem dias de aula.");
    const lessons = [];
    for (const cursor = new Date(start); cursor <= end && lessons.length < Number(p.total); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      if (!weekdays.includes(cursor.getUTCDay())) continue;
      const key = cursor.toISOString().slice(0, 10);
      const schedule = p.schedule?.[cursor.getUTCDay()] || {};
      const time = String(schedule.time || p.time || "");
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Horario do pacote invalido.");
      const records = input.checkins.filter((r: any) => r.packageId === p.id && r.dateKey === key && (r.lessonType || "package") === "package");
      const events = (input.events || []).filter((e: any) => e.packageId === p.id && e.dateKey === key && e.time === time && e.type === "package");
      if (events.length > 1) throw new Error("Mais de um evento para a mesma aula; revise a agenda.");
      lessons.push({ dateKey: key, startsAt: `${key}T${time}:00-03:00`, duration: Number(schedule.duration) || Number(p.duration) || 60,
        eventId: events[0]?.id || `${p.id}-${key}`, recorded: records.length > 0,
        consumed: records.some((r: any) => r.consumed === true || ["realizado", "aula-dada", "cancelada-fora-prazo", "falta"].includes(r.status)) });
    }
    return { id: String(p.id), studentId: p.studentId, name: p.name || "Pacote", total: Number(p.total), lessons };
  });
  if (new Set(packages.map((p: any) => p.id)).size !== packages.length) throw new Error("Pacote duplicado.");
  return { students, packages };
}
