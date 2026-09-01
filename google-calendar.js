(function () {
  const pushDelayMs = 1200;
  let initialized = false;
  let connected = false;
  let pushTimer = null;
  let queuedEvents = [];
  let applyingLinks = false;

  const elements = () => ({
    connect: document.querySelector("#google-calendar-connect"),
    disconnect: document.querySelector("#google-calendar-disconnect"),
    sync: document.querySelector("#google-calendar-sync"),
    status: document.querySelector("#google-calendar-status"),
    account: document.querySelector("#google-calendar-account"),
    message: document.querySelector("#google-calendar-message"),
    notifications: document.querySelector("#google-calendar-notifications"),
    notificationList: document.querySelector("#google-calendar-notification-list"),
    markRead: document.querySelector("#google-calendar-mark-read"),
  });

  function setMessage(message, error = false) {
    const node = elements().message;
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("error", error);
  }

  async function invoke(action, payload = {}) {
    const client = getSupabaseClient();
    if (!client || !currentSupabaseUser) throw new Error("Entre como personal pelo Supabase antes de conectar o Google.");
    const { data, error } = await client.functions.invoke("google-calendar", { body: { action, ...payload } });
    if (error) throw new Error(data?.error || error.message || "Falha na integração com Google Calendar.");
    if (data?.error) throw new Error(data.error);
    return data;
  }

  function renderStatus(connection) {
    const ui = elements();
    connected = Boolean(connection && connection.connection_status === "connected");
    if (ui.status) {
      ui.status.textContent = connected ? "Conectado" : connection?.connection_status === "error" ? "Atenção" : "Desconectado";
      ui.status.dataset.connected = String(connected);
    }
    if (ui.account) ui.account.textContent = connected ? `${connection.google_email} · ${connection.calendar_id}` : "Conta não conectada";
    if (ui.connect) ui.connect.hidden = connected;
    if (ui.disconnect) ui.disconnect.hidden = !connected;
    if (ui.sync) ui.sync.hidden = !connected;
    if (connection?.last_error) setMessage(connection.last_error, true);
  }

  async function loadStatus() {
    if (currentUserType !== "admin" || !currentSupabaseUser) return;
    try {
      const result = await invoke("status");
      renderStatus(result.connection);
      await loadNotifications();
    } catch (error) {
      setMessage(error.message, true);
    }
  }

  function collectEvents() {
    const students = new Map(loadStudents().map((student) => [student.id || student.name, student]));
    const byId = new Map(loadAgendaEvents().map((event) => [event.id, event]));
    const cursor = new Date();
    cursor.setDate(1);
    for (let month = 0; month < 6; month += 1) {
      const reference = new Date(cursor.getFullYear(), cursor.getMonth() + month, 1);
      getAgendaEventsForRange("month", reference).forEach((event) => {
        if (event.id && event.dateKey && event.time && !String(event.status || "").toLowerCase().includes("realiz")) byId.set(event.id, event);
      });
    }
    return Array.from(byId.values()).map((event) => {
      const student = students.get(event.studentId) || students.get(event.studentName);
      return { ...event, studentEmail: student?.email_login || student?.email || "" };
    });
  }

  function persistGoogleIds(results, sourceEvents = []) {
    if (!Array.isArray(results) || !results.length) return;
    const links = new Map(results.filter((item) => item.google_event_id).map((item) => [item.app_event_id, item.google_event_id]));
    if (!links.size) return;
    const events = loadAgendaEvents();
    const sourceById = new Map(sourceEvents.map((event) => [event.id, event]));
    let changed = false;
    events.forEach((event) => {
      const googleId = links.get(event.id);
      if (googleId && event.google_event_id !== googleId) {
        event.google_event_id = googleId;
        event.origem_da_alteracao = event.origem_da_alteracao || "aplicativo";
        changed = true;
      }
    });
    links.forEach((googleId, appEventId) => {
      if (events.some((event) => event.id === appEventId)) return;
      const source = sourceById.get(appEventId);
      if (!source) return;
      events.push({ ...source, google_event_id: googleId, origem_da_alteracao: source.origem_da_alteracao || "aplicativo", updatedAt: source.updatedAt || Date.now() });
      changed = true;
    });
    if (!changed) return;
    applyingLinks = true;
    saveAgendaEvents(events);
    applyingLinks = false;
  }

  async function push(events = collectEvents()) {
    if (!connected || applyingLinks || !events.length) return;
    try {
      const results = [];
      for (let index = 0; index < events.length; index += 200) {
        const result = await invoke("push", { events: events.slice(index, index + 200) });
        results.push(...(result.results || []));
      }
      persistGoogleIds(results, events);
      setMessage("Agenda sincronizada com o Google Calendar.");
    } catch (error) {
      setMessage(`Não foi possível enviar ao Google. ${error.message}`, true);
    }
  }

  function queuePush(events) {
    if (!connected || applyingLinks) return;
    queuedEvents = Array.isArray(events) ? events : [];
    window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => {
      const eventsToPush = queuedEvents;
      queuedEvents = [];
      push(eventsToPush);
    }, pushDelayMs);
  }

  async function synchronizeNow() {
    setMessage("Sincronizando...");
    await push(collectEvents());
    await invoke("pull");
    await loadSupabaseAppState({ retry: true });
    refreshAppAfterRemoteState();
    await loadNotifications();
    setMessage("Sincronização concluída.");
  }

  async function loadNotifications() {
    const ui = elements();
    if (!currentSupabaseUser || !ui.notificationList) return;
    const { data, error } = await getSupabaseClient().from("google_calendar_notifications").select("id,title,message,kind,read_at,created_at").is("read_at", null).order("created_at", { ascending: false }).limit(20);
    if (error) return;
    ui.notificationList.replaceChildren();
    (data || []).forEach((notification) => {
      const item = document.createElement("article");
      item.className = "google-calendar-notification";
      const title = document.createElement("strong");
      title.textContent = notification.title;
      const message = document.createElement("span");
      message.textContent = notification.message;
      item.append(title, message);
      ui.notificationList.appendChild(item);
    });
    if (ui.notifications) ui.notifications.hidden = !(data || []).length;
  }

  async function connect() {
    try {
      setMessage("Abrindo autorização do Google...");
      const returnUrl = `${window.location.origin}${window.location.pathname}`;
      const result = await invoke("authorize", { app_return_url: returnUrl });
      window.location.assign(result.url);
    } catch (error) { setMessage(error.message, true); }
  }

  async function disconnect() {
    if (!window.confirm("Desconectar o Google Calendar? Os eventos já criados no Google serão preservados.")) return;
    try {
      await invoke("disconnect");
      renderStatus(null);
      setMessage("Conta Google desconectada.");
    } catch (error) { setMessage(error.message, true); }
  }

  async function markRead() {
    const client = getSupabaseClient();
    await client.from("google_calendar_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", currentSupabaseUser.id).is("read_at", null);
    await loadNotifications();
  }

  function handleOAuthReturn() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("google_calendar");
    if (!status) return;
    setMessage(status === "connected" ? "Conta Google conectada. Iniciando sincronização..." : params.get("message") || "Não foi possível conectar.", status !== "connected");
    history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
    if (status === "connected") window.setTimeout(async () => {
      await loadStatus();
      await invoke("watch").catch((error) => setMessage(`Conta conectada, mas o webhook falhou: ${error.message}`, true));
      await synchronizeNow().catch((error) => setMessage(error.message, true));
    }, 500);
  }

  function initialize() {
    if (initialized) { loadStatus(); return; }
    initialized = true;
    const ui = elements();
    ui.connect?.addEventListener("click", connect);
    ui.disconnect?.addEventListener("click", disconnect);
    ui.sync?.addEventListener("click", () => synchronizeNow().catch((error) => setMessage(error.message, true)));
    ui.markRead?.addEventListener("click", markRead);
    handleOAuthReturn();
    loadStatus();
  }

  window.GoogleCalendarIntegration = { initialize, queuePush, synchronizeNow };
})();
