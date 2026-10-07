(function (root) {
  const money = (value) => typeof value === "number" ? value : Number(String(value || "").replace(/\D/g, "")) / 100;
  const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const belongs = (item, student) => item.studentId ? item.studentId === student.id : item.studentName === student.name;
  const period = (pack, monthKey) => {
    const start = CalendarRules.dateKey(pack.startDate), end = CalendarRules.dateKey(pack.endDate);
    const from = `${monthKey}-01`;
    const last = new Date(`${from}T12:00:00Z`);
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    const until = last.toISOString().slice(0, 10);
    return { start, end, from, until, overlaps: Boolean(start && end && start <= end && start <= until && end >= from) };
  };
  function packageLines(student, monthKey, packages, events, checkins, holidays) {
    return packages.filter((pack) => belongs(pack, student) && ["fixed", "per_class"].includes(pack.billingType))
      .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0) || a.id.localeCompare(b.id))
      .flatMap((pack) => {
        const bounds = period(pack, monthKey);
        if (bounds.start && bounds.end && !bounds.overlaps) return [];
        const bySlot = new Map();
        const add = (lesson) => {
          const key = lesson.dateKey || CalendarRules.dateKey(lesson.date);
          if (!key || key < bounds.start || key > bounds.end) return;
          const slot = `${key}|${lesson.time || pack.time || ""}`;
          bySlot.set(slot, { ...lesson, dateKey: key });
        };
        (pack.scheduledLessons || []).forEach(add);
        events.filter((event) => event.packageId === pack.id && ["package", "cancellation"].includes(event.type)).forEach(add);
        // Attendance for a flexible package also identifies the contracted lesson.
        checkins.filter((record) => record.packageId === pack.id && (record.lessonType || "package") === "package")
          .forEach((record) => {
            const key = record.dateKey || CalendarRules.dateKey(record.date);
            if (![...bySlot.values()].some((lesson) => lesson.dateKey === key)) add(record);
          });
        const lessons = [...bySlot.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey) || String(a.time || "").localeCompare(String(b.time || "")))
          .slice(0, Math.max(Number(pack.total) || 0, 0));
        const inMonth = (lesson) => lesson.dateKey >= bounds.from && lesson.dateKey <= bounds.until;
        const monthLessons = lessons.filter(inMonth);
        const billable = monthLessons.filter((lesson) => !holidays.has(lesson.dateKey));
        const unitValue = money(pack.classValue);
        const missingDates = !bounds.start || !bounds.end;
        const missingRate = pack.billingType === "per_class" && unitValue <= 0;
        const totalValue = missingDates || missingRate ? 0 : pack.billingType === "per_class" ? round(billable.length * unitValue) : money(pack.value);
        const completedLessons = checkins.filter((record) => record.packageId === pack.id && (record.lessonType || "package") === "package"
          && inMonth({ dateKey: record.dateKey || CalendarRules.dateKey(record.date) }) && !holidays.has(record.dateKey || CalendarRules.dateKey(record.date))
          && (record.consumed === true || ["realizado", "aula-dada", "cancelada-fora-prazo", "falta"].includes(record.status))).length;
        return [{ id: pack.id, packageId: pack.id, name: pack.name, modality: pack.modality || "", billingType: pack.billingType,
          unitValue, predictedLessons: pack.billingType === "per_class" ? billable.length : monthLessons.length,
          completedLessons, totalValue: round(totalValue), startDate: pack.startDate || "", endDate: pack.endDate || "",
          warning: missingDates ? "Preencha início e término para calcular a cobrança deste pacote." : missingRate ? "Informe o valor por aula deste pacote." : "" }];
      });
  }
  function applyPayments(lines, record, legacyPaid = false) {
    const allocations = Array.isArray(record?.paymentAllocations) ? record.paymentAllocations.map((entry) => ({ ...entry, paidValue: round(entry.paidValue) })) : [];
    // Preserve an existing month receipt before introducing package allocations.
    let unallocated = allocations.length ? Math.max(Number(record?.unallocatedPaidValue) || 0, 0) : Math.max(Number(record?.paidValue) || 0, 0);
    const result = lines.map((line) => {
      let allocation = allocations.find((entry) => entry.id === line.id);
      if (!allocation && line.packageId) allocation = allocations.find((entry) => entry.id === line.packageId);
      if (allocation && allocation.id !== line.id) allocation.id = line.id;
      if (!allocation && line.packageId) {
        const previousLine = (record?.chargeLines || []).find((entry) => entry.packageId === line.packageId);
        allocation = previousLine && allocations.find((entry) => entry.id === previousLine.id);
        if (allocation) allocation.id = line.id;
      }
      if (!allocation) {
        const paidValue = unallocated > 0 ? Math.min(unallocated, line.totalValue) : legacyPaid && line.legacy ? line.totalValue : 0;
        unallocated = round(Math.max(unallocated - paidValue, 0));
        allocation = { id: line.id, paidValue: round(paidValue) };
        allocations.push(allocation);
      }
      return { ...line, paidValue: allocation.paidValue, outstandingValue: round(Math.max(line.totalValue - allocation.paidValue, 0)) };
    });
    const paidValue = round(allocations.reduce((sum, entry) => sum + entry.paidValue, 0) + unallocated);
    return { lines: result, paymentAllocations: allocations, paidValue,
      unallocatedPaidValue: unallocated, outstandingValue: round(result.reduce((sum, line) => sum + line.outstandingValue, 0)),
      creditValue: round(result.reduce((sum, line) => sum + Math.max(line.paidValue - line.totalValue, 0), 0) + unallocated) };
  }
  function mergeFinancialRecords(online, local) {
    const allocations = new Map();
    const aliases = new Map([...(online?.chargeLines || []), ...(local?.chargeLines || [])]
      .filter((line) => line.packageId).map((line) => [line.id, line.packageId]));
    for (const entry of [...(online?.paymentAllocations || []), ...(local?.paymentAllocations || [])]) {
      const id = aliases.get(entry.id) || entry.id;
      const previous = allocations.get(id);
      if (!previous || Number(entry.paidValue) >= Number(previous.paidValue)) allocations.set(id, { ...entry, id });
    }
    const paymentAllocations = [...allocations.values()];
    const allocatedTotal = round(paymentAllocations.reduce((sum, entry) => sum + Number(entry.paidValue || 0), 0));
    const paidValue = Math.max(Number(online?.paidValue) || 0, Number(local?.paidValue) || 0,
      allocatedTotal);
    const unallocatedPaidValue = round(Math.max(paidValue - allocatedTotal, 0));
    return { ...online, ...local, paymentAllocations, unallocatedPaidValue, paidValue };
  }
  root.PackageBilling = { money, round, belongs, period, packageLines, applyPayments, mergeFinancialRecords };
})(globalThis);
