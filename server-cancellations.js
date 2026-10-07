(function () {
  const review = document.querySelector("#cancellation-catalog-review");
  const publish = document.querySelector("#cancellation-catalog-publish");
  const preview = document.querySelector("#cancellation-catalog-preview");
  const message = document.querySelector("#cancellation-catalog-message");
  let reviewed;
  review?.addEventListener("click", () => {
    const all = loadStudents();
    const students = all.filter((s) => getStudentAuthUserId(s)).map((s) => ({
      id: s.id, name: s.name, authUserId: getStudentAuthUserId(s),
    }));
    const ids = new Set(students.map((s) => s.id));
    const packages = loadClassPackages().filter((p) => ids.has(p.studentId));
    reviewed = structuredClone({ students, packages, checkins: loadCheckins(), events: loadAgendaEvents() });
    const lines = students.map((s) => `${s.name}\n  Aluno: ${s.id}\n  Login Supabase: ${s.authUserId}`);
    for (const p of packages) {
      lines.push(`${p.studentName} — ${p.name}: ${p.startDate} a ${p.endDate}, ${p.total} aulas`);
      for (const l of generatePackageSchedule(p)) lines.push(`  ${l.date} ${l.time} (${l.duration} min)${getLessonRecord(p.id, l.dateKey) ? " — ja registrada" : ""}`);
    }
    const excluded = all.filter((s) => !getStudentAuthUserId(s));
    if (excluded.length) lines.push("Sem login vinculado (nao serao autorizados): " + excluded.map((s) => s.name).join(", "));
    preview.textContent = lines.join("\n");
    publish.hidden = false;
    message.textContent = "Confira cada login e horario. Esta confirmacao substitui o cadastro autorizado anterior; nao troca identidades ja protegidas.";
  });
  publish?.addEventListener("click", async () => {
    if (!reviewed || !currentSupabaseUser) return;
    publish.disabled = true;
    try {
      const { data, error } = await getSupabaseClient().functions.invoke("lesson-cancellation", { body: { action: "publish-catalog", catalog: reviewed } });
      if (error) {
        const details = await error.context?.json?.().catch(() => null);
        throw new Error(details?.error || error.message);
      }
      if (!data?.ok) throw new Error(data?.error || "Publicacao nao confirmada.");
      message.textContent = `Cadastro confirmado: ${data.students} alunos e ${data.packages} pacotes. Os cancelamentos serao processados pelo servidor.`;
      publish.hidden = true;
      reviewed = null;
    } catch (error) { message.textContent = error.message; }
    finally { publish.disabled = false; }
  });
})();
