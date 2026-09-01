export function canonicalEvent(event) {
  return {
    id: String(event.id || ""),
    dateKey: String(event.dateKey || ""),
    time: String(event.time || ""),
    duration: Number(event.duration) || 60,
    status: String(event.status || "confirmada"),
    updatedAt: Number(event.updatedAt) || 0,
  };
}

export function operationFor(event, link) {
  const normalized = canonicalEvent(event);
  if (!normalized.id || !normalized.dateKey || !normalized.time) return { type: "ignore", reason: "invalid" };
  const cancelled = normalized.status.toLowerCase().includes("cancel");
  if (cancelled && !link) return { type: "ignore", reason: "not-created" };
  if (cancelled) return { type: "cancel", googleEventId: link.googleEventId };
  const signature = JSON.stringify(normalized);
  if (link?.signature === signature) return { type: "ignore", reason: "duplicate" };
  return { type: link ? "update" : "create", signature, googleEventId: link?.googleEventId || "" };
}

export async function runSyncBatch(events, links, adapter) {
  const results = [];
  for (const event of events) {
    const link = links.get(event.id);
    const operation = operationFor(event, link);
    if (operation.type === "ignore") { results.push({ id: event.id, ...operation }); continue; }
    try {
      const googleEventId = await adapter[operation.type](event, operation);
      results.push({ id: event.id, type: operation.type, status: "success", googleEventId: googleEventId || operation.googleEventId });
    } catch (error) {
      results.push({ id: event.id, type: operation.type, status: "error", error: error.message });
    }
  }
  return results;
}
