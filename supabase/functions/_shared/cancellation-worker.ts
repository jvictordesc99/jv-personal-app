// Durable jobs are acknowledged only after Google and local bookkeeping succeed.
// Dependencies are injected so timeouts and ambiguous responses can be tested.
export async function processCancellationJob(db: any, job: any, accessTokenFor: any, fetchGoogle: any) {
  const c = job.cancellation;
  const { data: link, error } = await db.from("google_calendar_event_links").select("*")
    .eq("user_id", c.owner_id).eq("app_event_id", c.event.id).maybeSingle();
  if (error) throw error;
  if (link && !link.deleted_at) {
    const { accessToken, connection } = await accessTokenFor(c.owner_id);
    const response = await fetchGoogle(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events/${encodeURIComponent(link.google_event_id)}?sendUpdates=all`, {
      method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20_000),
    });
    // Missing/gone after a previous successful DELETE is already the desired state.
    if (!response.ok && response.status !== 404 && response.status !== 410) {
      const failure: any = new Error(`Google HTTP ${response.status}`);
      const retry = response.headers.get("retry-after");
      failure.retrySeconds = retry ? (/^\d+$/.test(retry) ? Number(retry) : Math.max(1, Math.ceil((Date.parse(retry) - Date.now()) / 1000))) : undefined;
      failure.permanent = response.status === 400;
      throw failure;
    }
    const { error: writeError } = await db.from("google_calendar_event_links").update({ deleted_at: new Date().toISOString(), last_origin: "app", updated_at: new Date().toISOString() }).eq("id", link.id);
    if (writeError) throw writeError;
  }
  const { error: historyError } = await db.from("google_calendar_sync_history").upsert({
    user_id: c.owner_id, app_event_id: c.event.id, google_event_id: link?.google_event_id || null,
    action: "cancelled", origin: "app", status: link ? "success" : "ignored", origem_da_alteracao: "aplicativo_aluno",
    cancelado_por: c.event.studentName, cancelado_em: c.received_at, idempotency_key: `official-cancellation:${c.id}`,
    details: link ? {} : { reason: "not-created" },
  }, { onConflict: "user_id,idempotency_key" });
  if (historyError) throw historyError;
}

export async function runCancellationBatch(db: any, accessTokenFor: any, fetchGoogle: any) {
  const { data: jobs, error } = await db.rpc("claim_calendar_cancellations", { batch_size: 5 });
  if (error) throw error;
  const results = await Promise.all((jobs || []).map(async (job: any) => {
    let failure: any;
    try { await processCancellationJob(db, job, accessTokenFor, fetchGoogle); } catch (error) { failure = error; }
    const { data: acknowledged, error: ackError } = await db.rpc("finish_calendar_cancellation", {
      job_id: job.id, token: job.lease_token, succeeded: !failure,
      // Do not persist provider responses or credentials in diagnostics.
      failure: failure ? (/^Google HTTP \d+$/.test(failure.message) ? failure.message : "Falha de rede, credencial ou persistencia; repetir processamento.") : null,
      retry_seconds: Number.isFinite(failure?.retrySeconds) ? failure.retrySeconds : Math.min(3600, 30 * 2 ** job.attempts) + Math.floor(Math.random() * 15),
      permanent: failure?.permanent === true,
    });
    if (ackError) throw ackError; // Lease expiry recovers even an acknowledgement outage.
    return { id: job.id, acknowledged, success: !failure };
  }));
  return results;
}
