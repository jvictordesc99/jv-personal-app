// The callback must only mutate its snapshot: it can be replayed on conflict.
export async function updateAppState(db: any, mutate: (state: any) => any) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: row, error: readError } = await db.from("app_state")
      .select("data,updated_at").eq("id", "main").single();
    if (readError) throw readError;
    if (!row || !row.data || typeof row.data !== "object" || Array.isArray(row.data)) {
      throw new Error("app_state/main ausente ou invalido.");
    }
    const state = structuredClone(row.data);
    const result = mutate(state);
    state.savedAt = new Date().toISOString();
    const { data: committed, error: writeError } = await db.rpc("compare_and_swap_app_state", {
      expected_data: row.data,
      expected_updated_at: row.updated_at ?? null,
      next_data: state,
      expected_exists: true,
    });
    if (writeError) throw writeError;
    if (committed === true) return result;
    if (committed !== false) throw new Error("Resposta invalida ao gravar app_state/main.");
    // A concurrent writer won. Read again and rebuild the mutation, never resend
    // an old full document or fall back to an unconditional update/upsert.
  }
  throw new Error("Conflito ao gravar app_state/main apos 3 tentativas. Tente sincronizar novamente.");
}
