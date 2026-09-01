import { accessTokenFor, admin, googleFetch, sha256 } from "./google.ts";

const iso = (value: any) => value?.dateTime || (value?.date ? `${value.date}T00:00:00Z` : null);

export function googlePayload(event: any) {
  const start = new Date(`${event.dateKey}T${event.time || "00:00"}:00-03:00`);
  const end = new Date(start.getTime() + (Number(event.duration) || 60) * 60000);
  const payload: any = {
    summary: `${event.modality || "Aula"} - ${event.studentName || "Aluno"}`,
    description: event.note || "Sincronizado pelo aplicativo Joao Victor Personal.",
    location: event.location || "",
    start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
    end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
    status: String(event.status || "").toLowerCase().includes("cancel") ? "cancelled" : "confirmed",
    extendedProperties: { private: {
      app_event_id: String(event.id),
      student_id: String(event.studentId || ""),
      student_name: String(event.studentName || ""),
      package_id: String(event.packageId || ""),
      app_origin: "joao-victor-personal",
    } },
  };
  if (event.studentEmail) payload.attendees = [{ email: event.studentEmail, displayName: event.studentName || "Aluno" }];
  return payload;
}

export async function pushEvents(userId: string, events: any[]) {
  const db = admin();
  const { accessToken, connection } = await accessTokenFor(userId);
  const results = [];
  for (const event of events.slice(0, 250)) {
    if (!event?.id || !event.dateKey || !event.time) continue;
    const payload = googlePayload(event);
    const payloadHash = await sha256(JSON.stringify(payload));
    const { data: link } = await db.from("google_calendar_event_links").select("*").eq("user_id", userId).eq("app_event_id", event.id).maybeSingle();
    if (link?.last_origin === "google" && event.origem_da_alteracao === "google_calendar" && Number(event.updatedAt || 0) <= Number(link.app_updated_at || 0)) {
      results.push({ app_event_id: event.id, google_event_id: link.google_event_id, status: "ignored", reason: "google-origin" });
      continue;
    }
    if (link?.payload_hash === payloadHash && !link.deleted_at) {
      results.push({ app_event_id: event.id, google_event_id: link.google_event_id, status: "ignored" });
      continue;
    }
    if (payload.status === "cancelled" && !link?.google_event_id) {
      results.push({ app_event_id: event.id, status: "ignored", reason: "not-created" });
      continue;
    }
    if (payload.status === "cancelled" && link?.google_event_id) {
      await googleFetch(accessToken, `/calendars/${encodeURIComponent(connection.calendar_id)}/events/${encodeURIComponent(link.google_event_id)}?sendUpdates=all`, { method: "DELETE" });
      await db.from("google_calendar_event_links").update({ payload_hash: payloadHash, last_origin: "app", deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", link.id);
      await db.from("google_calendar_sync_history").upsert({ user_id: userId, app_event_id: event.id, google_event_id: link.google_event_id, action: "cancelled", origin: "app", status: "success", cancelado_por: event.cancelado_por || "personal", cancelado_em: event.cancelado_em || new Date().toISOString(), origem_da_alteracao: "aplicativo", idempotency_key: `app:${event.id}:${payloadHash}` }, { onConflict: "user_id,idempotency_key", ignoreDuplicates: true });
      results.push({ app_event_id: event.id, google_event_id: link.google_event_id, status: "success" });
      continue;
    }
    const path = link?.google_event_id
      ? `/calendars/${encodeURIComponent(connection.calendar_id)}/events/${encodeURIComponent(link.google_event_id)}?sendUpdates=none`
      : `/calendars/${encodeURIComponent(connection.calendar_id)}/events?sendUpdates=all`;
    delete payload.status;
    const updatePath = link?.google_event_id ? path.replace("sendUpdates=none", "sendUpdates=all") : path;
    const googleEvent = await googleFetch(accessToken, updatePath, { method: link?.google_event_id ? "PATCH" : "POST", body: JSON.stringify(payload) });
    const row = {
      user_id: userId, app_event_id: event.id, google_event_id: googleEvent.id,
      google_recurring_event_id: googleEvent.recurringEventId || null,
      google_original_start_time: iso(googleEvent.originalStartTime), google_etag: googleEvent.etag,
      last_google_start: iso(googleEvent.start), last_google_end: iso(googleEvent.end),
      app_updated_at: Number(event.updatedAt || Date.now()), payload_hash: payloadHash,
      last_origin: "app", deleted_at: googleEvent.status === "cancelled" ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
    };
    await db.from("google_calendar_event_links").upsert(row, { onConflict: "user_id,app_event_id" });
    await db.from("google_calendar_sync_history").upsert({
      user_id: userId, app_event_id: event.id, google_event_id: googleEvent.id,
      action: link ? "updated" : "created", origin: "app", status: "success", origem_da_alteracao: "aplicativo",
      idempotency_key: `app:${event.id}:${payloadHash}`,
    }, { onConflict: "user_id,idempotency_key", ignoreDuplicates: true });
    results.push({ app_event_id: event.id, google_event_id: googleEvent.id, status: "success" });
  }
  return results;
}

function brazilDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(date);
}

function brazilTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

export async function applyGoogleEvent(userId: string, event: any) {
  const db = admin();
  const privateData = event.extendedProperties?.private || {};
  let { data: link } = await db.from("google_calendar_event_links").select("*").eq("user_id", userId).eq("google_event_id", event.id).maybeSingle();
  if (!link && privateData.app_event_id) {
    const result = await db.from("google_calendar_event_links").select("*").eq("user_id", userId).eq("app_event_id", privateData.app_event_id).maybeSingle();
    link = result.data;
  }
  if (!link) return { status: "ignored", reason: "unlinked" };
  if (event.status === "cancelled" && link.last_origin === "app" && link.deleted_at) {
    await db.from("google_calendar_event_links").update({ google_etag: event.etag || link.google_etag, updated_at: new Date().toISOString() }).eq("id", link.id);
    return { status: "ignored", reason: "app-cancellation-echo" };
  }
  if (link.google_etag === event.etag && link.last_origin === "google") return { status: "ignored", reason: "etag" };

  const appEventId = link.app_event_id;
  const startIso = iso(event.start);
  const endIso = iso(event.end);
  const cancelled = event.status === "cancelled";
  const declined = (event.attendees || []).some((item: any) => item.responseStatus === "declined" && !item.self);
  const rescheduled = Boolean(startIso && link.last_google_start && startIso !== link.last_google_start);
  const action = cancelled ? "cancelled" : declined ? "declined" : rescheduled ? "rescheduled" : "updated";
  const idempotencyKey = `google:${event.id}:${event.etag || event.updated}:${action}`;
  const { data: prior } = await db.from("google_calendar_sync_history").select("id").eq("user_id", userId).eq("idempotency_key", idempotencyKey).maybeSingle();
  if (prior) return { status: "ignored", reason: "duplicate" };

  const { data: stateRow, error: stateError } = await db.from("app_state").select("data").eq("id", "main").single();
  if (stateError) throw stateError;
  const state = structuredClone(stateRow.data || {});
  state.agendaEvents = Array.isArray(state.agendaEvents) ? state.agendaEvents : [];
  let appEvent = state.agendaEvents.find((item: any) => item.id === appEventId);
  if (!appEvent) {
    appEvent = { id: appEventId, studentId: privateData.student_id || "", studentName: privateData.student_name || "", packageId: privateData.package_id || "", source: "google", createdAt: Date.now() };
    state.agendaEvents.push(appEvent);
  }
  const start = startIso ? new Date(startIso) : null;
  const end = endIso ? new Date(endIso) : null;
  Object.assign(appEvent, {
    google_event_id: event.id, google_recurring_event_id: event.recurringEventId || "",
    date: start ? brazilDate(start) : appEvent.date, dateKey: start ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(start) : appEvent.dateKey,
    time: start ? brazilTime(start) : appEvent.time,
    duration: start && end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000)) : appEvent.duration,
    status: cancelled ? "cancelada pelo Google" : declined ? "recusada no Google" : "confirmada",
    cancelado_por: cancelled || declined ? (privateData.student_name || "Google Calendar") : appEvent.cancelado_por || "",
    cancelado_em: cancelled || declined ? new Date().toISOString() : appEvent.cancelado_em || "",
    origem_da_alteracao: "google_calendar", updatedAt: Date.now(),
  });
  if ((cancelled || declined) && appEvent.packageId) {
    state.checkins = Array.isArray(state.checkins) ? state.checkins : [];
    state.makeupCredits = Array.isArray(state.makeupCredits) ? state.makeupCredits : [];
    const alreadyRegistered = state.checkins.some((item: any) => item.packageId === appEvent.packageId && item.dateKey === appEvent.dateKey && (item.lessonType || "package") === "package");
    if (!alreadyRegistered) {
      const lessonStart = start || (appEvent.dateKey && appEvent.time ? new Date(`${appEvent.dateKey}T${appEvent.time}:00-03:00`) : null);
      const inTime = lessonStart ? (lessonStart.getTime() - Date.now()) > 2 * 3600000 : false;
      const checkinId = crypto.randomUUID();
      const validUntilDate = lessonStart ? new Date(lessonStart.getTime() + 10 * 86400000) : null;
      const validUntil = validUntilDate ? brazilDate(validUntilDate) : "";
      state.checkins.push({
        id: checkinId, studentName: appEvent.studentName || privateData.student_name || "", studentId: appEvent.studentId || privateData.student_id || "",
        packageId: appEvent.packageId, packageName: appEvent.modality || "Pacote", date: appEvent.date, dateKey: appEvent.dateKey, time: appEvent.time,
        type: "cancelamento de aula", lessonType: "package", status: inTime ? "cancelada-no-prazo" : "cancelada-fora-prazo",
        statusLabel: inTime ? "Cancelada no prazo" : "Cancelada fora do prazo - aula contabilizada", consumed: !inTime,
        generatedMakeup: inTime, makeupValidUntil: validUntil, reason: inTime ? "Cancelamento no Google dentro do prazo. Reposicao gerada." : "Cancelamento no Google fora do prazo minimo de 2 horas.",
        markedBy: appEvent.studentName || "aluno", cancellationDate: brazilDate(new Date()), cancellationTime: brazilTime(new Date()),
        cancelado_por: appEvent.studentName || privateData.student_name || "Google Calendar", cancelado_em: new Date().toISOString(), origem_da_alteracao: "google_calendar",
        month: appEvent.dateKey?.slice(0, 7) || "", timestamp: Date.now(),
      });
      if (inTime) state.makeupCredits.push({
        id: crypto.randomUUID(), studentName: appEvent.studentName || privateData.student_name || "", studentId: appEvent.studentId || privateData.student_id || "",
        packageId: appEvent.packageId, packageName: appEvent.modality || "Pacote", sourceLessonDate: appEvent.date, lessonTime: appEvent.time,
        noticeDate: brazilDate(new Date()), noticeTime: brazilTime(new Date()), validUntil, status: "available", generated: true,
        reason: "Cancelamento do aluno no Google dentro do prazo.", sourceCheckinId: checkinId, note: "", timestamp: Date.now(), createdAt: Date.now(),
        origem_da_alteracao: "google_calendar",
      });
    }
  }
  state.savedAt = new Date().toISOString();
  await db.from("app_state").update({ data: state, updated_at: new Date().toISOString() }).eq("id", "main");

  if (cancelled || declined || rescheduled) {
    const studentName = privateData.student_name || appEvent.studentName || "Aluno";
    await db.from("google_calendar_notifications").insert({
      user_id: userId, student_id: privateData.student_id || appEvent.studentId || null, student_name: studentName, app_event_id: appEventId,
      kind: cancelled ? "cancelled" : declined ? "declined" : "rescheduled",
      title: cancelled || declined ? `${studentName} cancelou uma aula` : `${studentName} alterou o horario`,
      message: cancelled || declined ? `A aula de ${appEvent.date} as ${appEvent.time} foi cancelada no Google Calendar.` : `Novo horario: ${appEvent.date} as ${appEvent.time}.`,
    });
  }
  await db.from("google_calendar_sync_history").insert({
    user_id: userId, app_event_id: appEventId, google_event_id: event.id, action, origin: "google", status: "success",
    cancelado_por: cancelled || declined ? (privateData.student_name || "Google Calendar") : null,
    cancelado_em: cancelled || declined ? new Date().toISOString() : null,
    origem_da_alteracao: "google_calendar", idempotency_key: idempotencyKey,
    details: { recurring_event_id: event.recurringEventId || null, original_start_time: iso(event.originalStartTime) },
  });
  await db.from("google_calendar_event_links").update({ google_etag: event.etag, last_google_start: startIso, last_google_end: endIso, app_updated_at: appEvent.updatedAt, last_origin: "google", deleted_at: cancelled ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", link.id);
  return { status: "success", action };
}

export async function incrementalSync(userId: string) {
  const db = admin();
  const { accessToken, connection } = await accessTokenFor(userId);
  let pageToken: string | null = null;
  let syncToken = connection.sync_token || null;
  const results = [];
  do {
    const params = new URLSearchParams({ showDeleted: "true", singleEvents: "true", maxResults: "2500" });
    if (syncToken) params.set("syncToken", syncToken);
    else params.set("timeMin", new Date(Date.now() - 90 * 86400000).toISOString());
    if (pageToken) params.set("pageToken", pageToken);
    let page;
    try {
      page = await googleFetch(accessToken, `/calendars/${encodeURIComponent(connection.calendar_id)}/events?${params}`);
    } catch (error) {
      if (syncToken && String(error).includes("HTTP 410")) {
        await db.from("google_calendar_connections").update({ sync_token: null, updated_at: new Date().toISOString() }).eq("user_id", userId);
        return incrementalSync(userId);
      }
      throw error;
    }
    for (const event of page.items || []) results.push(await applyGoogleEvent(userId, event));
    pageToken = page.nextPageToken || null;
    if (page.nextSyncToken) {
      await db.from("google_calendar_connections").update({ sync_token: page.nextSyncToken, last_synced_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq("user_id", userId);
    }
  } while (pageToken);
  return results;
}
