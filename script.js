const titles = {
   home: "Painel inicial",
  treino: "Treino",
  avaliacao: "Avaliacao fisica",
  evolucao: "Evolucao corporal",
  perfil: "Perfil",
  videos: "Videos dos exercicios",
  agenda: "Agendamento",
  beach: "Area beach tennis",
  admin: "Area administrativa",
  aluno: "Area do aluno",
};

const navButtons = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");
const pageTitle = document.querySelector("#page-title");
const todayLabel = document.querySelector("#today-label");
const loginScreen = document.querySelector("#login-screen");
const appShell = document.querySelector("#app-shell");
const loginButtons = document.querySelectorAll("[data-login-role]");
const loginStudentSelect = document.querySelector("#login-student-select");
const loginStudentButton = document.querySelector("#login-student-button");
const supabaseLoginForm = document.querySelector("#supabase-login-form");
const supabaseLoginEmail = document.querySelector("#supabase-login-email");
const supabaseLoginPassword = document.querySelector("#supabase-login-password");
const supabaseForgotPasswordButton = document.querySelector("#supabase-forgot-password-button");
const supabaseLoginMessage = document.querySelector("#supabase-login-message");
let currentUserType = null;
let selectedStudentProfile = "";
let supabaseClient = null;
let supabaseAppStateClient = null;
let currentSupabaseUser = null;
try {
  selectedStudentProfile = localStorage.getItem("student-profile") || "";
} catch {
  selectedStudentProfile = "";
}

function openView(id) {
  if (!currentUserType) return;

  if (currentUserType === "student" && id === "admin") {
    id = "treino";
  }

  if (currentUserType === "admin" && ["treino", "videos", "avaliacao", "evolucao", "perfil", "agenda", "beach", "home"].includes(id)) {
    id = "admin";
  }

  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === id));
  views.forEach((view) => view.classList.toggle("active", view.id === id));
  safeSetText(pageTitle, titles[id] || "Painel inicial");
  if (id === "admin" && typeof showAdminDashboard === "function") {
    showAdminDashboard();
  }
  if (id === "evolucao" && typeof renderStudentLoadEvolution === "function") {
    renderStudentLoadEvolution();
  }
  if (id === "avaliacao" && typeof renderStudentAssessments === "function") {
    renderStudentAssessments();
  }
  if (id === "agenda" && typeof renderStudentPackagePanel === "function") {
    renderStudentPackagePanel();
  }
  if (id === "treino" && typeof renderCurrentWorkout === "function") {
    renderCurrentWorkout();
  }
  if (id === "perfil" && typeof renderStudentProfile === "function") {
    renderStudentProfile();
    renderStudentCheckinStatus();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => openView(button.dataset.view));
});

document.querySelectorAll("[data-jump]").forEach((button) => {
  button.addEventListener("click", () => openView(button.dataset.jump));
});

const studentStorageKey = "joao-victor-students";
const workoutStorageKey = "joao-victor-workouts";
const loadProgressStorageKey = "joao-victor-load-progress";
const assessmentStorageKey = "joao-victor-assessments";
const checkinStorageKey = "joao-victor-checkins";
const packageStorageKey = "joao-victor-class-packages";
const feedbackStorageKey = "joao-victor-workout-feedbacks";
const appDataStorageKey = "joao-victor-app-data";
const billingSettingsStorageKey = "joao-victor-billing-settings";
const supabaseTables = {
  appState: "app_state",
  profiles: "profiles",
  students: "students",
  workouts: "workouts",
  assessments: "assessments",
  loadProgress: "load_progress",
  classPackages: "class_packages",
  checkins: "checkins",
  billingSettings: "billing_settings",
};
const personalAdminEmail = "jvictordesc99@gmail.com";
const supabaseFallbackConfig = {
  url: "https://wsvjopplvspjkxjbexkj.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzdmpvcHBsdnNwamt4amJleGtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDI4NjIsImV4cCI6MjA5NjAxODg2Mn0.SndPqwDDBT6xCCqbzkvUOEpmq1_EJCX0uFPPTR2-ZqA",
};
const defaultStudents = [
  { name: "Marina Costa", email: "", plan: "Performance", value: "R$ 250,00", due: "05/06", payment: "Em dia" },
  { name: "Pedro Alves", email: "", plan: "Beach", value: "R$ 180,00", due: "10/06", payment: "Pendente" },
  { name: "Ana Lima", email: "", plan: "Completo", value: "R$ 320,00", due: "15/06", payment: "Em dia" },
];
const whatsappUrl = "https://wa.me/5519992782696";

const studentForm = document.querySelector("#student-form");
const studentList = document.querySelector("#student-list");
const studentCount = document.querySelector("#student-count");
const pendingCount = document.querySelector("#pending-count");
const nameInput = document.querySelector("#student-name");
const emailInput = document.querySelector("#student-email");
const tempPasswordInput = document.querySelector("#student-temp-password");
const phoneInput = document.querySelector("#student-phone");
const birthDateInput = document.querySelector("#student-birth-date");
const planInput = document.querySelector("#student-plan");
const valueInput = document.querySelector("#student-value");
const dueInput = document.querySelector("#student-due");
const paymentInput = document.querySelector("#student-payment");
const newStudentButton = document.querySelector("[data-focus-student]");
const workoutFocusButtons = document.querySelectorAll("[data-focus-workout]");
const adminDashboard = document.querySelector("#admin-dashboard");
const paymentBlockedPanel = document.querySelector("#payment-blocked-panel");
const adminModules = document.querySelectorAll(".admin-module");
const adminModuleButtons = document.querySelectorAll("[data-admin-target]");
const adminBackButtons = document.querySelectorAll("[data-admin-back]");
const saveMessage = document.querySelector("#save-message");
const saveStudentButton = document.querySelector("#save-student-button");
const cancelEditButton = document.querySelector("#cancel-edit-button");
const workoutStudentSearch = document.querySelector("#workout-student-search");
const workoutStudentDirectory = document.querySelector("#workout-student-directory");
const workoutStudentWorkspace = document.querySelector("#workout-student-workspace");
const workoutSelectedStudentName = document.querySelector("#workout-selected-student-name");
const workoutSelectedStudentDetails = document.querySelector("#workout-selected-student-details");
const backToWorkoutStudents = document.querySelector("#back-to-workout-students");
const createWorkoutForStudent = document.querySelector("#create-workout-for-student");
const workoutTablePanel = document.querySelector("#workout-table-panel");
const workoutForm = document.querySelector("#workout-form");
const workoutStudent = document.querySelector("#workout-student");
const workoutViewStudent = document.querySelector("#workout-view-student");
const workoutTitle = document.querySelector("#workout-title");
const workoutGoal = document.querySelector("#workout-goal");
const workoutFrequency = document.querySelector("#workout-frequency");
const workoutStartDate = document.querySelector("#workout-start-date");
const workoutDueDate = document.querySelector("#workout-due-date");
const workoutNotes = document.querySelector("#workout-notes");
const workoutExercises = document.querySelector("#workout-exercises");
const addExerciseButton = document.querySelector("#add-exercise-button");
const workoutTemplateSource = document.querySelector("#workout-template-source");
const loadWorkoutButton = document.querySelector("#load-workout-button");
const workoutImportText = document.querySelector("#workout-import-text");
const organizeWorkoutTextButton = document.querySelector("#organize-workout-text-button");
const workoutMessage = document.querySelector("#workout-message");
const workoutList = document.querySelector("#workout-list");
const workoutExpirationPanel = document.querySelector("#workout-expiration-panel");
const currentWorkout = document.querySelector("#current-workout");
const workoutSummary = document.querySelector("#workout-summary");
const workoutTabs = document.querySelector("#workout-tabs");
const studentLoadHistory = document.querySelector("#student-load-history");
const studentLoadExercise = document.querySelector("#student-load-exercise");
const studentLoadChart = document.querySelector("#student-load-chart");
const studentLoadChartTitle = document.querySelector("#student-load-chart-title");
const studentLoadChartSubtitle = document.querySelector("#student-load-chart-subtitle");
const studentLoadChartBadge = document.querySelector("#student-load-chart-badge");
const studentLoadList = document.querySelector("#student-load-list");
const adminLoadStudent = document.querySelector("#admin-load-student");
const adminLoadHistory = document.querySelector("#admin-load-history");
const adminEvolutionStudent = document.querySelector("#admin-evolution-student");
const adminEvolutionExercise = document.querySelector("#admin-evolution-exercise");
const adminEvolutionChart = document.querySelector("#admin-evolution-chart");
const adminEvolutionChartTitle = document.querySelector("#admin-evolution-chart-title");
const adminEvolutionChartSubtitle = document.querySelector("#admin-evolution-chart-subtitle");
const adminEvolutionChartBadge = document.querySelector("#admin-evolution-chart-badge");
const adminPersonalRecords = document.querySelector("#admin-personal-records");
const adminAdherenceSummary = document.querySelector("#admin-adherence-summary");
const adminFeedbackHistory = document.querySelector("#admin-feedback-history");
const adminFeedbackNotes = document.querySelector("#admin-feedback-notes");
const assessmentForm = document.querySelector("#assessment-form");
const assessmentStudent = document.querySelector("#assessment-student");
const assessmentDate = document.querySelector("#assessment-date");
const assessmentWeight = document.querySelector("#assessment-weight");
const assessmentFat = document.querySelector("#assessment-fat");
const assessmentMuscle = document.querySelector("#assessment-muscle");
const assessmentImc = document.querySelector("#assessment-imc");
const assessmentNotes = document.querySelector("#assessment-notes");
const assessmentFile = document.querySelector("#assessment-file");
const assessmentMessage = document.querySelector("#assessment-message");
const adminAssessmentHistory = document.querySelector("#admin-assessment-history");
const studentAssessmentSummary = document.querySelector("#student-assessment-summary");
const studentAssessmentHistory = document.querySelector("#student-assessment-history");
const saveWorkoutButton = document.querySelector("#save-workout-button");
const cancelWorkoutEditButton = document.querySelector("#cancel-workout-edit-button");
const studentProfilePanel = document.querySelector("#student-profile-panel");
const studentCheckinButton = document.querySelector("#student-checkin-button");
const studentCheckinStatus = document.querySelector("#student-checkin-status");
const studentAdminProfile = document.querySelector("#student-admin-profile");
const manualCheckinForm = document.querySelector("#manual-checkin-form");
const manualCheckinStudent = document.querySelector("#manual-checkin-student");
const manualCheckinPackage = document.querySelector("#manual-checkin-package");
const checkinFilterStudent = document.querySelector("#checkin-filter-student");
const checkinFilterDate = document.querySelector("#checkin-filter-date");
const checkinMonthTotal = document.querySelector("#checkin-month-total");
const checkinHistory = document.querySelector("#checkin-history");
const packageForm = document.querySelector("#package-form");
const newPackageButton = document.querySelector("#new-package-button");
const packageViewStudent = document.querySelector("#package-view-student");
const packageEmptyState = document.querySelector("#package-empty-state");
const packageStudent = document.querySelector("#package-student");
const packageName = document.querySelector("#package-name");
const packageTotal = document.querySelector("#package-total");
const packageStart = document.querySelector("#package-start");
const packageEnd = document.querySelector("#package-end");
const packageDays = document.querySelector("#package-days");
const packageTime = document.querySelector("#package-time");
const packageNotes = document.querySelector("#package-notes");
const packageAdminList = document.querySelector("#package-admin-list");
const studentPackagePanel = document.querySelector("#student-package-panel");
const billingSettingsForm = document.querySelector("#billing-settings-form");
const billingPixKey = document.querySelector("#billing-pix-key");
const billingSenderName = document.querySelector("#billing-sender-name");
const billingDefaultMessage = document.querySelector("#billing-default-message");
const billingSettingsMessage = document.querySelector("#billing-settings-message");
const billingList = document.querySelector("#billing-list");
const studentCardName = document.querySelector(".student-card strong");
const studentCardPlan = document.querySelector(".student-card span");
const studentCardAvatar = document.querySelector(".student-card img");
let memoryStudents = null;
let memoryWorkouts = null;
let memoryLoadProgress = null;
let memoryAssessments = null;
let memoryCheckins = null;
let memoryPackages = null;
let memoryFeedbacks = null;
let editingStudentIndex = null;
let editingWorkout = null;
let editingPackageId = null;
let selectedAdminWorkoutStudent = "";
let selectedAdminProfileStudent = "";
const activeWorkoutByStudent = {};
const activeSessionByWorkout = {};
let appEventsBound = false;
let isApplyingRemoteState = false;
let supabaseSyncTimer = null;
let lastSupabaseSyncWarning = 0;

function showMessage(text, type = "success") {
  if (!saveMessage) return;
  saveMessage.textContent = text;
  saveMessage.classList.toggle("error", type === "error");
}

function safeSetText(element, text = "") {
  if (element) element.textContent = text;
}

function updateTodayLabel() {
  if (!todayLabel) return;
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = today.toLocaleDateString("pt-BR", { month: "long" });
  todayLabel.textContent = `Hoje, ${day} de ${month}`;
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatCurrencyBR(value) {
  const digits = onlyDigits(value);
  if (!digits) return "";
  const cents = Number(digits) / 100;
  return cents.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBR(value) {
  const digits = onlyDigits(value).slice(0, 8);
  if (!digits) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatLoadKg(value) {
  const cleaned = String(value || "")
    .replace(/[^\d,.]/g, "")
    .replace(/\./g, ",");
  if (!cleaned) return "";
  const normalized = cleaned.replace(/,+/g, ",").replace(/^,/, "0,").replace(/(,\d*),.*/, "$1");
  return `${normalized} kg`;
}

function formatRestSeconds(value) {
  const digits = onlyDigits(value);
  return digits ? `${digits}s` : "";
}

function applyInputMasks(root = document) {
  root.querySelectorAll("#student-value").forEach((input) => {
    input.inputMode = "numeric";
    input.addEventListener("input", () => {
      input.value = formatCurrencyBR(input.value);
    });
  });

  root.querySelectorAll("#student-due, #student-birth-date, #assessment-date, #workout-start-date, #workout-due-date, #package-start, #package-end, #checkin-filter-date").forEach((input) => {
    input.inputMode = "numeric";
    input.addEventListener("input", () => {
      input.value = formatDateBR(input.value);
    });
  });
}

function applyExerciseFieldMask(input) {
  if (!input?.dataset?.exerciseField) return;

  if (input.dataset.exerciseField === "currentLoad") {
    input.value = formatLoadKg(input.value);
  }

  if (input.dataset.exerciseField === "rest") {
    input.value = formatRestSeconds(input.value);
  }
}

function getSupabaseConfig() {
  const config = window.SUPABASE_CONFIG || {};
  return {
    url: String(config.url || supabaseFallbackConfig.url || "").trim(),
    anonKey: String(config.anonKey || supabaseFallbackConfig.anonKey || "").trim(),
  };
}

function isSupabaseConfigured() {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey && window.supabase?.createClient);
}

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  if (!isSupabaseConfigured()) {
    const config = getSupabaseConfig();
    console.error("Supabase nao inicializado para app_state.", {
      hasUrl: Boolean(config.url),
      hasAnonKey: Boolean(config.anonKey),
      hasSupabaseLibrary: Boolean(window.supabase?.createClient),
      url: config.url,
    });
    return null;
  }

  const config = getSupabaseConfig();
  supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  console.info("Supabase client inicializado para app_state.", {
    url: config.url,
    anonKeyPrefix: config.anonKey.slice(0, 12),
    anonKeyLength: config.anonKey.length,
  });
  return supabaseClient;
}

function getSupabaseAppStateClient() {
  if (supabaseAppStateClient) return supabaseAppStateClient;

  if (!isSupabaseConfigured()) {
    const config = getSupabaseConfig();
    console.error("Supabase app_state nao inicializado.", {
      hasUrl: Boolean(config.url),
      hasAnonKey: Boolean(config.anonKey),
      hasSupabaseLibrary: Boolean(window.supabase?.createClient),
      url: config.url,
    });
    return null;
  }

  const config = getSupabaseConfig();
  supabaseAppStateClient = window.supabase.createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "joao-victor-app-state-sync",
    },
  });
  console.info(`Supabase app_state client inicializado: ${JSON.stringify({
    url: config.url,
    anonKeyPrefix: config.anonKey.slice(0, 12),
    anonKeyLength: config.anonKey.length,
    authMode: "anon-sem-login",
  })}`);
  return supabaseAppStateClient;
}

function showSupabaseSyncWarning(message) {
  const now = Date.now();
  if (now - lastSupabaseSyncWarning < 8000) return;

  lastSupabaseSyncWarning = now;
  console.warn(message);
}

function logSupabaseAppStateError(action, error) {
  const details = {
    action,
    message: error?.message || "",
    code: error?.code || "",
    status: error?.status || "",
    details: error?.details || "",
    hint: error?.hint || "",
    supabaseUrl: getSupabaseConfig().url,
    table: supabaseTables.appState,
    id: "main",
  };
  console.error(`Erro Supabase app_state ao ${action}: ${JSON.stringify(details)}`);

  const text = `${details.message} ${details.code} ${details.details} ${details.hint}`.toLowerCase();
  if (text.includes("row-level security") || text.includes("rls") || details.code === "42501") {
    console.error(`RLS provavelmente bloqueou o app_state. Para teste temporario sem login, crie policies:
create policy "app_state_select_anon" on public.app_state for select to anon using (true);
create policy "app_state_insert_anon" on public.app_state for insert to anon with check (true);
create policy "app_state_update_anon" on public.app_state for update to anon using (true) with check (true);`);
  }
}

function getAppStateSnapshot() {
  return {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    students: loadStudents(),
    workouts: loadWorkouts(),
    loadProgress: loadProgressRecords(),
    assessments: loadAssessments(),
    checkins: loadCheckins(),
    classPackages: loadClassPackages(),
    workoutFeedbacks: loadWorkoutFeedbacks(),
    billingSettings: loadBillingSettings(),
  };
}

function writeAppStateToLocalStorage(state) {
  if (!state || typeof state !== "object") return false;

  isApplyingRemoteState = true;
  try {
    memoryStudents = normalizeStudentsData(state.students || defaultStudents);
    memoryWorkouts = normalizeWorkoutsData(state.workouts || {});
    memoryLoadProgress = normalizeListData(state.loadProgress || []).map(normalizeStudentLinkedRecord);
    memoryAssessments = normalizeListData(state.assessments || []).map(normalizeStudentLinkedRecord);
    memoryCheckins = normalizeListData(state.checkins || []).map(normalizeStudentLinkedRecord);
    memoryPackages = normalizeClassPackages(state.classPackages || []);
    memoryFeedbacks = normalizeListData(state.workoutFeedbacks || []).map(normalizeStudentLinkedRecord);

    localStorage.setItem(studentStorageKey, JSON.stringify(memoryStudents));
    localStorage.setItem(workoutStorageKey, JSON.stringify(memoryWorkouts));
    localStorage.setItem(loadProgressStorageKey, JSON.stringify(memoryLoadProgress));
    localStorage.setItem(assessmentStorageKey, JSON.stringify(memoryAssessments));
    localStorage.setItem(checkinStorageKey, JSON.stringify(memoryCheckins));
    localStorage.setItem(packageStorageKey, JSON.stringify(memoryPackages));
    localStorage.setItem(feedbackStorageKey, JSON.stringify(memoryFeedbacks));
    if (state.billingSettings) {
      localStorage.setItem(billingSettingsStorageKey, JSON.stringify(state.billingSettings));
    }
    persistAppDataMeta();
    return true;
  } catch (error) {
    console.error("Nao foi possivel aplicar dados do Supabase no localStorage.", error);
    return false;
  } finally {
    isApplyingRemoteState = false;
  }
}

async function loadSupabaseAppState() {
  const client = getSupabaseAppStateClient();
  if (!client) return "unconfigured";

  try {
    const { data, error } = await client
      .from(supabaseTables.appState)
      .select("data,updated_at")
      .eq("id", "main")
      .maybeSingle();

    if (error) {
      logSupabaseAppStateError("carregar", error);
      return "failed";
    }

    if (!data?.data) return "missing";
    return writeAppStateToLocalStorage(data.data) ? "loaded" : "failed";
  } catch (error) {
    logSupabaseAppStateError("carregar por rede/CDN", error);
    return "failed";
  }
}

async function upsertAppStateWithRest(payload) {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return {
      ok: false,
      error: {
        message: "Supabase URL ou anon key ausente.",
        code: "missing_config",
      },
    };
  }

  const endpoint = `${config.url.replace(/\/$/, "")}/rest/v1/${supabaseTables.appState}?on_conflict=id`;
  try {
    console.info(`Tentando fallback REST app_state: ${endpoint}`);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    const parsed = text ? JSON.parse(text) : null;

    if (!response.ok) {
      return {
        ok: false,
        error: {
          message: parsed?.message || response.statusText,
          code: parsed?.code || String(response.status),
          details: parsed?.details || text,
          hint: parsed?.hint || "",
          status: response.status,
        },
      };
    }

    return { ok: true, data: parsed };
  } catch (error) {
    return {
      ok: false,
      error: {
        message: error?.message || "Falha no fetch REST.",
        code: error?.name || "",
        details: error?.stack || "",
        hint: "Verifique bloqueio de rede, CORS, extensoes do navegador ou URL do projeto Supabase.",
      },
    };
  }
}

async function syncAppStateToSupabase() {
  console.info("syncAppStateToSupabase chamado.");
  if (isApplyingRemoteState) return;

  const client = getSupabaseAppStateClient();
  if (!client) {
    console.error("syncAppStateToSupabase interrompido: cliente Supabase indisponivel.");
    return;
  }

  const appState = getAppStateSnapshot();
  const payload = {
    id: "main",
    data: appState,
    updated_at: new Date().toISOString(),
  };
  console.info(`Enviando app_state para Supabase: ${JSON.stringify({
    table: supabaseTables.appState,
    id: payload.id,
    updated_at: payload.updated_at,
    data: payload.data,
  })}`);

  try {
    const { data, error } = await client
      .from(supabaseTables.appState)
      .upsert(payload, { onConflict: "id" })
      .select("id,updated_at")
      .single();

    if (error) {
      console.error(`Erro retornado pelo upsert app_state: ${JSON.stringify(error)}`);
      logSupabaseAppStateError("salvar", error);
      const restResult = await upsertAppStateWithRest(payload);
      if (restResult.ok) {
        console.info(`Upsert app_state via REST concluido com sucesso: ${JSON.stringify(restResult.data)}`);
        return;
      }
      showSupabaseSyncWarning("Dados salvos localmente. Supabase indisponivel no momento.");
      console.error(`Erro retornado pelo fallback REST app_state: ${JSON.stringify(restResult.error)}`);
      logSupabaseAppStateError("salvar via REST", restResult.error);
      return;
    }

    console.info(`Upsert app_state concluido com sucesso: ${JSON.stringify(data)}`);
  } catch (error) {
    logSupabaseAppStateError("salvar por rede/CDN", error);
    const restResult = await upsertAppStateWithRest(payload);
    if (restResult.ok) {
      console.info(`Upsert app_state via REST concluido com sucesso: ${JSON.stringify(restResult.data)}`);
      return;
    }
    showSupabaseSyncWarning("Dados salvos localmente. Supabase indisponivel no momento.");
    console.error(`Erro retornado pelo fallback REST app_state: ${JSON.stringify(restResult.error)}`);
    logSupabaseAppStateError("salvar via REST", restResult.error);
  }
}

function queueSupabaseAppStateSync() {
  if (isApplyingRemoteState) return;
  window.clearTimeout(supabaseSyncTimer);
  console.info("Sincronizacao app_state agendada.");
  supabaseSyncTimer = window.setTimeout(syncAppStateToSupabase, 300);
}

function getSupabaseUserRole(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  if (email === personalAdminEmail) return "admin";

  const role = String(user?.user_metadata?.role || user?.app_metadata?.role || "").toLowerCase();
  return role === "admin" || role === "personal" ? "admin" : "student";
}

async function getSupabaseProfile(user) {
  const client = getSupabaseClient();
  if (!client || !user?.id) return null;

  try {
    const { data, error } = await client
      .from(supabaseTables.profiles)
      .select("id,email,role,student_id")
      .eq("id", user.id)
      .maybeSingle();
    return error ? null : data;
  } catch {
    return null;
  }
}

async function saveSupabaseProfile(profile) {
  const client = getSupabaseClient();
  if (!client || !profile?.id) return;

  try {
    await client.from(supabaseTables.profiles).upsert({
      id: profile.id,
      email: profile.email || "",
      role: profile.role || "student",
      student_id: profile.student_id || null,
      created_at: profile.created_at || new Date().toISOString(),
    });
  } catch {
    // A tabela profiles e as policies serao configuradas na etapa do banco.
  }
}

async function getStudentNameFromSupabaseUser(user) {
  const profile = await getSupabaseProfile(user);
  const metadataName = user?.user_metadata?.student_name || user?.user_metadata?.studentName || user?.user_metadata?.name || "";
  const email = String(user?.email || "").toLowerCase();
  const students = loadStudents();
  if (profile?.student_id) {
    const byId = students.find((student) => student.id === profile.student_id || student.supabaseUserId === profile.student_id);
    if (byId) return byId.name;
  }

  return students.find((student) => student.name === metadataName)?.name
    || students.find((student) => student.supabaseUserId && student.supabaseUserId === user?.id)?.name
    || students.find((student) => student.email && student.email === email)?.name
    || "";
}

function saveSupabaseStudentLink(studentName, user) {
  if (!studentName || !user?.id) return;

  const students = loadStudents();
  const index = students.findIndex((student) => student.name === studentName);
  if (index < 0) return;

  const email = String(user.email || "").toLowerCase();
  if (students[index].supabaseUserId === user.id && (!email || students[index].email === email)) return;

  students[index] = {
    ...students[index],
    email: students[index].email || email,
    supabaseUserId: user.id,
  };
  saveStudents(students);
}

async function createStudentAuthUser(email, password, studentName) {
  if (!email || !password || !isSupabaseConfigured()) return { userId: "", error: null };

  try {
    const config = getSupabaseConfig();
    const signupClient = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `signup-${Date.now()}`,
      },
    });

    const { data, error } = await signupClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: "student",
          student_name: studentName,
        },
      },
    });

    return { userId: data?.user?.id || "", error };
  } catch (error) {
    console.error("Erro ao criar usuario do aluno no Supabase Auth.", {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      supabaseConfigured: isSupabaseConfigured(),
      supabaseUrl: getSupabaseConfig().url,
      hint: "Verifique conexao, CORS/Live Server, CDN do Supabase, URL e anon key.",
    });
    return { userId: "", error };
  }
}

function showSupabaseLoginMessage(text, type = "success") {
  if (!supabaseLoginMessage) return;
  supabaseLoginMessage.textContent = text;
  supabaseLoginMessage.classList.toggle("error", type === "error");
}

async function applySupabaseUser(user) {
  currentSupabaseUser = user || null;
  if (!user) return false;

  const userEmail = String(user.email || "").trim().toLowerCase();
  const profile = await getSupabaseProfile(user);
  const profileRole = String(profile?.role || "").trim().toLowerCase();
  const role = userEmail === personalAdminEmail || profileRole === "admin" || profileRole === "personal"
    ? "admin"
    : getSupabaseUserRole(user);
  if (role === "admin") {
    saveSupabaseProfile({ id: user.id, email: user.email, role: "admin" });
    enterTestMode("admin");
    safeSetText(document.querySelector("#user-mode"), `Personal | ${user.email || "Supabase"}`);
    return true;
  }

  const studentName = await getStudentNameFromSupabaseUser(user);
  if (!studentName) {
    showSupabaseLoginMessage("Login feito, mas este usuario ainda nao esta vinculado a um aluno.", "error");
    return false;
  }

  saveSupabaseStudentLink(studentName, user);
  enterTestMode("student", studentName);
  safeSetText(document.querySelector("#user-mode"), `Aluno | ${user.email || studentName}`);
  return true;
}

async function restoreSupabaseSession() {
  const client = getSupabaseClient();
  if (!client) {
    showSupabaseLoginMessage("Supabase ainda nao configurado. Use o acesso local temporario.");
    return;
  }

  const { data } = await client.auth.getSession();
  if (data?.session?.user) {
    await applySupabaseUser(data.session.user);
  }

  client.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) await applySupabaseUser(session.user);
  });
}

function normalizeStudentsData(students) {
  if (!Array.isArray(students)) return normalizeStudentsData(defaultStudents);
  const validPayments = ["Em dia", "Pendente", "Atrasado"];

  const normalized = students
    .filter((student) => student && typeof student === "object")
    .map((student) => ({
      id: student.id || createId(),
      supabaseUserId: String(student.supabaseUserId || student.authUserId || "").trim(),
      name: String(student.name || "").trim(),
      email: String(student.email || "").trim().toLowerCase(),
      phone: String(student.phone || student.whatsapp || "").trim(),
      birthDate: String(student.birthDate || student.birth_date || "").trim(),
      plan: String(student.plan || "Plano nao informado").trim(),
      value: String(student.value || "").trim(),
      due: String(student.due || "").trim(),
      payment: validPayments.includes(student.payment) ? student.payment : "Em dia",
    }))
    .filter((student) => student.name);

  return normalized.length ? normalized : normalizeStudentsData(defaultStudents);
}

function normalizeListData(data) {
  return Array.isArray(data) ? data.filter(Boolean) : [];
}

function getStudentByName(studentName) {
  return loadStudents().find((student) => student.name === studentName) || null;
}

function getStudentIdByName(studentName) {
  return getStudentByName(studentName)?.id || "";
}

function normalizeStudentLinkedRecord(record) {
  const studentName = String(record.studentName || "").trim();
  return {
    ...record,
    id: record.id || createId(),
    studentName,
    studentId: record.studentId || getStudentIdByName(studentName),
    timestamp: record.timestamp || Date.now(),
  };
}

function loadBillingSettings() {
  try {
    const saved = localStorage.getItem(billingSettingsStorageKey);
    const settings = saved ? JSON.parse(saved) : {};
    return {
      pixKey: settings.pixKey || "",
      senderName: settings.senderName || "Personal Joao Victor",
      defaultMessage: settings.defaultMessage || "Para manter seu acesso aos treinos e acompanhamento, voce pode realizar o pagamento via Pix.",
    };
  } catch {
    return {
      pixKey: "",
      senderName: "Personal Joao Victor",
      defaultMessage: "Para manter seu acesso aos treinos e acompanhamento, voce pode realizar o pagamento via Pix.",
    };
  }
}

function saveBillingSettings(settings) {
  try {
    localStorage.setItem(billingSettingsStorageKey, JSON.stringify(settings));
    queueSupabaseAppStateSync();
    if (billingSettingsMessage) {
      billingSettingsMessage.textContent = "Configuracoes de cobranca salvas.";
      billingSettingsMessage.classList.remove("error");
    }
  } catch {
    if (billingSettingsMessage) {
      billingSettingsMessage.textContent = "Configuracoes apareceram na tela, mas o navegador bloqueou salvar.";
      billingSettingsMessage.classList.add("error");
    }
  }
}

function normalizeWhatsAppPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function getStudentBillingStatus(student) {
  const dueStatus = getWorkoutExpirationStatus(student.due);
  const paymentBlocked = isPaymentBlocked(student);
  return {
    dueStatus,
    shouldShow: paymentBlocked || (dueStatus.days !== null && dueStatus.days <= 7),
  };
}

function createBillingMessage(student, settings) {
  const activePackage = getActivePackage(student.name);
  const planName = activePackage?.name || student.plan || "plano";
  const value = activePackage?.value || student.value || "valor nao informado";
  return `Ola, ${student.name}! Tudo bem?\n\nPassando para lembrar que seu plano ${planName} vence em ${student.due}.\nValor: ${value}\n\n${settings.defaultMessage}\n\nChave Pix: ${settings.pixKey || "nao configurada"}\n\nApos o pagamento, me envie o comprovante por aqui.\n\n${settings.senderName}`;
}

function renderBillingSettings() {
  const settings = loadBillingSettings();
  if (billingPixKey) billingPixKey.value = settings.pixKey;
  if (billingSenderName) billingSenderName.value = settings.senderName;
  if (billingDefaultMessage) billingDefaultMessage.value = settings.defaultMessage;
}

function renderBillingList() {
  if (!billingList) return;

  const settings = loadBillingSettings();
  const students = loadStudents().filter((student) => getStudentBillingStatus(student).shouldShow);
  billingList.innerHTML = "";

  if (!students.length) {
    billingList.textContent = "Nenhuma cobranca vencida ou vencendo nos proximos 7 dias.";
    return;
  }

  students.forEach((student) => {
    const status = getStudentBillingStatus(student);
    const activePackage = getActivePackage(student.name);
    const planName = activePackage?.name || student.plan || "Plano";
    const value = activePackage?.value || student.value || "Valor nao informado";
    const phone = normalizeWhatsAppPhone(student.phone);
    const card = document.createElement("article");
    card.className = "billing-card";

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = student.name;
    const details = document.createElement("span");
    details.textContent = `${planName} | ${value} | vence ${student.due}`;
    const statusText = document.createElement("small");
    statusText.textContent = isPaymentBlocked(student) ? `Pagamento ${student.payment}` : status.dueStatus.detail;
    info.append(title, details, statusText);

    const link = document.createElement("a");
    link.className = phone ? "primary" : "secondary";
    link.href = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(createBillingMessage(student, settings))}` : "#";
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = phone ? "Enviar cobranca no WhatsApp" : "Telefone nao cadastrado";
    if (!phone) {
      link.addEventListener("click", (event) => event.preventDefault());
    }

    card.append(info, link);
    billingList.appendChild(card);
  });
}

function isPaymentBlocked(student) {
  return ["Pendente", "Atrasado"].includes(student?.payment);
}

function setLocalValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    showMessage("O navegador limitou o salvamento local nesta abertura.", "error");
  }
}

function removeLocalValue(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    showMessage("O navegador limitou o salvamento local nesta abertura.", "error");
  }
}

function persistAppDataMeta() {
  try {
    const workouts = loadWorkouts();
    const meta = {
      schemaVersion: 2,
      storageMode: isSupabaseConfigured() ? "supabase-auth-localstorage-data" : "localStorage",
      supabaseTables,
      updatedAt: new Date().toISOString(),
      collections: {
        students: loadStudents().length,
        workouts: Object.values(workouts).reduce((total, studentWorkouts) => total + studentWorkouts.length, 0),
        progressRecords: loadProgressRecords().length,
        assessments: loadAssessments().length,
        packages: loadClassPackages().length,
        checkins: loadCheckins().length,
        feedbacks: loadWorkoutFeedbacks().length,
      },
    };
    localStorage.setItem(appDataStorageKey, JSON.stringify(meta));
  } catch {
    // Metadados sao auxiliares; o app continua funcionando sem eles.
  }
}

function normalizeStoredAppData() {
  const students = loadStudents();
  const validNames = new Set(students.map((student) => student.name));

  if (selectedStudentProfile && !validNames.has(selectedStudentProfile)) {
    selectedStudentProfile = students[0]?.name || "";
    if (selectedStudentProfile) {
      setLocalValue("student-profile", selectedStudentProfile);
    } else {
      removeLocalValue("student-profile");
    }
  }

  try {
    localStorage.setItem(studentStorageKey, JSON.stringify(students));
    localStorage.setItem(workoutStorageKey, JSON.stringify(loadWorkouts()));
    localStorage.setItem(loadProgressStorageKey, JSON.stringify(loadProgressRecords()));
    localStorage.setItem(assessmentStorageKey, JSON.stringify(loadAssessments()));
    localStorage.setItem(checkinStorageKey, JSON.stringify(loadCheckins()));
    localStorage.setItem(packageStorageKey, JSON.stringify(loadClassPackages()));
    localStorage.setItem(feedbackStorageKey, JSON.stringify(loadWorkoutFeedbacks()));
    persistAppDataMeta();
  } catch {
    showMessage("Alguns dados foram carregados, mas o navegador limitou o salvamento local.", "error");
  }
}

function loadStudents() {
  if (memoryStudents) return memoryStudents;

  try {
    const savedStudents = localStorage.getItem(studentStorageKey);
    memoryStudents = normalizeStudentsData(savedStudents ? JSON.parse(savedStudents) : defaultStudents);
  } catch {
    memoryStudents = [...defaultStudents];
    showMessage("O navegador bloqueou o salvamento local neste modo de arquivo.", "error");
  }

  return memoryStudents;
}

function saveStudents(students) {
  memoryStudents = normalizeStudentsData(students);

  try {
    localStorage.setItem(studentStorageKey, JSON.stringify(memoryStudents));
    persistAppDataMeta();
    queueSupabaseAppStateSync();
    showMessage("Aluno salvo neste navegador.");
  } catch {
    showMessage("Aluno apareceu na lista, mas este navegador bloqueou salvar ao recarregar.", "error");
  }
}

function loadWorkouts() {
  if (memoryWorkouts) return memoryWorkouts;

  try {
    const savedWorkouts = localStorage.getItem(workoutStorageKey);
    memoryWorkouts = normalizeWorkoutsData(savedWorkouts ? JSON.parse(savedWorkouts) : {});
  } catch {
    memoryWorkouts = {};
  }

  return memoryWorkouts;
}

function saveWorkouts(workouts) {
  memoryWorkouts = normalizeWorkoutsData(workouts);

  try {
    localStorage.setItem(workoutStorageKey, JSON.stringify(memoryWorkouts));
    persistAppDataMeta();
    queueSupabaseAppStateSync();
    if (workoutMessage) {
      workoutMessage.textContent = "Treino salvo para o aluno.";
      workoutMessage.classList.remove("error");
    }
  } catch {
    if (workoutMessage) {
      workoutMessage.textContent = "Treino apareceu na lista, mas este navegador bloqueou salvar ao recarregar.";
      workoutMessage.classList.add("error");
    }
  }
}

function loadProgressRecords() {
  if (memoryLoadProgress) return memoryLoadProgress;

  try {
    const savedProgress = localStorage.getItem(loadProgressStorageKey);
    memoryLoadProgress = normalizeListData(savedProgress ? JSON.parse(savedProgress) : []).map(normalizeStudentLinkedRecord);
  } catch {
    memoryLoadProgress = [];
  }

  return memoryLoadProgress;
}

function saveProgressRecords(records) {
  memoryLoadProgress = normalizeListData(records).map(normalizeStudentLinkedRecord);
  try {
    localStorage.setItem(loadProgressStorageKey, JSON.stringify(memoryLoadProgress));
    persistAppDataMeta();
    queueSupabaseAppStateSync();
  } catch {
    showMessage("Carga registrada na tela, mas este navegador bloqueou salvar ao recarregar.", "error");
  }
}

function loadAssessments() {
  if (memoryAssessments) return memoryAssessments;

  try {
    const savedAssessments = localStorage.getItem(assessmentStorageKey);
    memoryAssessments = normalizeListData(savedAssessments ? JSON.parse(savedAssessments) : []).map(normalizeStudentLinkedRecord);
  } catch {
    memoryAssessments = [];
  }

  return memoryAssessments;
}

function saveAssessments(assessments) {
  memoryAssessments = normalizeListData(assessments).map(normalizeStudentLinkedRecord);

  try {
    localStorage.setItem(assessmentStorageKey, JSON.stringify(memoryAssessments));
    persistAppDataMeta();
    queueSupabaseAppStateSync();
    if (assessmentMessage) {
      assessmentMessage.textContent = "Avaliacao salva no historico.";
      assessmentMessage.classList.remove("error");
    }
  } catch {
    if (assessmentMessage) {
      assessmentMessage.textContent = "Avaliacao apareceu na tela, mas o navegador bloqueou salvar o anexo.";
      assessmentMessage.classList.add("error");
    }
  }
}

function loadCheckins() {
  if (memoryCheckins) return memoryCheckins;

  try {
    const savedCheckins = localStorage.getItem(checkinStorageKey);
    memoryCheckins = normalizeListData(savedCheckins ? JSON.parse(savedCheckins) : []).map(normalizeStudentLinkedRecord);
  } catch {
    memoryCheckins = [];
  }

  return memoryCheckins;
}

function saveCheckins(checkins) {
  memoryCheckins = normalizeListData(checkins).map(normalizeStudentLinkedRecord);

  try {
    localStorage.setItem(checkinStorageKey, JSON.stringify(memoryCheckins));
    persistAppDataMeta();
    queueSupabaseAppStateSync();
  } catch {
    showMessage("Check-in registrado na tela, mas o navegador bloqueou salvar ao recarregar.", "error");
  }
}

function normalizeClassPackages(packages) {
  return normalizeListData(packages)
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: item.id || createId(),
      studentName: item.studentName || "",
      studentId: item.studentId || getStudentIdByName(item.studentName || ""),
      name: item.name || "Pacote de aulas",
      total: Number(item.total) || 0,
      startDate: item.startDate || "",
      endDate: item.endDate || "",
      days: item.days || "",
      time: item.time || "",
      notes: item.notes || "",
      createdAt: item.createdAt || Date.now(),
      updatedAt: item.updatedAt || item.createdAt || Date.now(),
    }))
    .filter((item) => item.studentName && item.total > 0);
}

function loadClassPackages() {
  if (memoryPackages) return memoryPackages;

  try {
    const savedPackages = localStorage.getItem(packageStorageKey);
    memoryPackages = normalizeClassPackages(savedPackages ? JSON.parse(savedPackages) : []);
  } catch {
    memoryPackages = [];
  }

  return memoryPackages;
}

function saveClassPackages(packages) {
  memoryPackages = normalizeClassPackages(packages);

  try {
    localStorage.setItem(packageStorageKey, JSON.stringify(memoryPackages));
    persistAppDataMeta();
    queueSupabaseAppStateSync();
  } catch {
    showMessage("Pacote salvo na tela, mas o navegador bloqueou salvar ao recarregar.", "error");
  }
}

function normalizeWorkoutFeedbacks(feedbacks) {
  return normalizeListData(feedbacks)
    .filter((item) => item && typeof item === "object")
    .map((item) => normalizeStudentLinkedRecord({
      ...item,
      workoutTitle: item.workoutTitle || item.workout || "Treino",
      rating: String(item.rating || "").trim(),
      pain: item.pain === true || item.pain === "Sim" || item.pain === "sim",
      painLocation: String(item.painLocation || "").trim(),
      note: String(item.note || item.observation || "").trim(),
      date: item.date || formatToday(),
    }));
}

function loadWorkoutFeedbacks() {
  if (memoryFeedbacks) return memoryFeedbacks;

  try {
    const savedFeedbacks = localStorage.getItem(feedbackStorageKey);
    memoryFeedbacks = normalizeWorkoutFeedbacks(savedFeedbacks ? JSON.parse(savedFeedbacks) : []);
  } catch {
    memoryFeedbacks = [];
  }

  return memoryFeedbacks;
}

function saveWorkoutFeedbacks(feedbacks) {
  memoryFeedbacks = normalizeWorkoutFeedbacks(feedbacks);

  try {
    localStorage.setItem(feedbackStorageKey, JSON.stringify(memoryFeedbacks));
    persistAppDataMeta();
    queueSupabaseAppStateSync();
  } catch {
    showMessage("Feedback salvo na tela, mas este navegador bloqueou salvar ao recarregar.", "error");
  }
}

function syncStudentNameReferences(previousName, nextName) {
  const nextStudentId = getStudentIdByName(nextName);
  const workouts = loadWorkouts();
  if (workouts[previousName]) {
    const renamedWorkouts = workouts[previousName].map((workout) => ({
      ...workout,
      studentName: nextName,
      studentId: nextStudentId || workout.studentId || "",
      updatedAt: Date.now(),
    }));
    workouts[nextName] = [...(workouts[nextName] || []), ...renamedWorkouts];
    delete workouts[previousName];
    saveWorkouts(workouts);
  }

  const progressRecords = loadProgressRecords().map((record) =>
    record.studentName === previousName ? { ...record, studentName: nextName, studentId: nextStudentId || record.studentId || "" } : record,
  );
  saveProgressRecords(progressRecords);

  const assessments = loadAssessments().map((assessment) =>
    assessment.studentName === previousName ? { ...assessment, studentName: nextName, studentId: nextStudentId || assessment.studentId || "" } : assessment,
  );
  saveAssessments(assessments);

  const packages = loadClassPackages().map((classPackage) =>
    classPackage.studentName === previousName ? { ...classPackage, studentName: nextName, studentId: nextStudentId || classPackage.studentId || "" } : classPackage,
  );
  saveClassPackages(packages);

  const checkins = loadCheckins().map((checkin) =>
    checkin.studentName === previousName ? { ...checkin, studentName: nextName, studentId: nextStudentId || checkin.studentId || "" } : checkin,
  );
  saveCheckins(checkins);

  const feedbacks = loadWorkoutFeedbacks().map((feedback) =>
    feedback.studentName === previousName ? { ...feedback, studentName: nextName, studentId: nextStudentId || feedback.studentId || "" } : feedback,
  );
  saveWorkoutFeedbacks(feedbacks);

  if (selectedStudentProfile === previousName) {
    selectedStudentProfile = nextName;
    setLocalValue("student-profile", selectedStudentProfile);
  }

  if (selectedAdminWorkoutStudent === previousName) {
    selectedAdminWorkoutStudent = nextName;
  }

  if (selectedAdminProfileStudent === previousName) {
    selectedAdminProfileStudent = nextName;
  }

  if (activeWorkoutByStudent[previousName]) {
    activeWorkoutByStudent[nextName] = activeWorkoutByStudent[previousName];
    delete activeWorkoutByStudent[previousName];
  }
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getInitials(name) {
  return String(name || "Aluno")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function createInitialsAvatar(name) {
  const initials = getInitials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="16" fill="#071723"/><circle cx="72" cy="20" r="18" fill="#28d80f" opacity=".22"/><text x="48" y="57" text-anchor="middle" font-family="Arial" font-size="30" font-weight="800" fill="#b8ff38">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function normalizeWorkout(workout, studentName = "") {
  const legacyExercises = (workout.exercises || []).map(normalizeExercise);
  const sessions = (workout.sessions?.length ? workout.sessions : [{ id: createId(), title: "Treino principal", exercises: legacyExercises }]).map(
    (session, index) => ({
      id: session.id || createId(),
      title: session.title || `Treino ${index + 1}`,
      exercises: (session.exercises || []).map(normalizeExercise),
    }),
  );

  return {
    id: workout.id || createId(),
    studentName: workout.studentName || studentName,
    studentId: workout.studentId || getStudentIdByName(workout.studentName || studentName),
    title: workout.title || "Treino",
    goal: workout.goal || "Objetivo nao informado",
    frequency: workout.frequency || "Frequencia nao informada",
    startDate: workout.startDate || "Sem inicio",
    dueDate: workout.dueDate || "Sem vencimento",
    notes: workout.notes || "Sem observacoes do personal.",
    createdAt: workout.createdAt || Date.now(),
    updatedAt: workout.updatedAt || workout.createdAt || Date.now(),
    sessions,
    exercises: sessions.flatMap((session) => session.exercises),
  };
}

function parseWorkoutDueDate(dateText) {
  const match = String(dateText || "").match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  let year = match[3] ? Number(match[3]) : new Date().getFullYear();
  if (year < 100) year += 2000;

  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getWorkoutPeriodStatus(workout) {
  const startDate = parseWorkoutDueDate(workout?.startDate);
  const dueDate = parseWorkoutDueDate(workout?.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (startDate) startDate.setHours(0, 0, 0, 0);
  if (dueDate) dueDate.setHours(0, 0, 0, 0);

  if (startDate && startDate > today) {
    const days = Math.ceil((startDate - today) / 86400000);
    return { label: "Ficha programada", detail: `Inicia em ${workout.startDate}`, className: "workout-status-neutral", state: "scheduled", days };
  }

  if (dueDate && dueDate < today) {
    const days = Math.ceil((dueDate - today) / 86400000);
    return { label: "Ficha vencida", detail: `Venceu ha ${Math.abs(days)} dia(s)`, className: "workout-status-expired", state: "expired", days };
  }

  const expiration = getWorkoutExpirationStatus(workout?.dueDate);
  return { ...expiration, label: "Ficha ativa", state: "active" };
}

function getWorkoutExpirationStatus(dueDateText) {
  const dueDate = parseWorkoutDueDate(dueDateText);

  if (!dueDate) {
    return { label: "Sem validade", detail: "Informe uma data", className: "workout-status-neutral", days: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  const days = Math.ceil((dueDate - today) / 86400000);

  if (days < 0) {
    return { label: "Ficha vencida", detail: `Venceu ha ${Math.abs(days)} dia(s)`, className: "workout-status-expired", days };
  }

  if (days === 0) {
    return { label: "Vence hoje", detail: "Renovar ficha", className: "workout-status-warning", days };
  }

  if (days <= 7) {
    return { label: "Perto de vencer", detail: `Faltam ${days} dia(s)`, className: "workout-status-warning", days };
  }

  return { label: "Ficha ativa", detail: `Faltam ${days} dia(s)`, className: "workout-status-active", days };
}

function createWorkoutStatusBadge(status) {
  const badge = document.createElement("span");
  badge.className = `workout-status-badge ${status.className}`;

  const label = document.createElement("strong");
  label.textContent = status.label;

  const detail = document.createElement("small");
  detail.textContent = status.detail;

  badge.append(label, detail);
  return badge;
}

function normalizeWorkoutsData(workouts) {
  if (!workouts || typeof workouts !== "object" || Array.isArray(workouts)) return {};

  return Object.fromEntries(
    Object.entries(workouts).map(([studentName, studentWorkouts]) => {
      if (Array.isArray(studentWorkouts)) {
        return [studentName, studentWorkouts.map((workout) => normalizeWorkout(workout, studentName))];
      }

      return [studentName, [normalizeWorkout(studentWorkouts, studentName)]];
    }),
  );
}

function fillStudentSelects() {
  if (!workoutStudent || !workoutViewStudent || !assessmentStudent) return;

  const students = loadStudents();
  if (selectedStudentProfile && !students.some((student) => student.name === selectedStudentProfile)) {
    selectedStudentProfile = students[0]?.name || "";
    setLocalValue("student-profile", selectedStudentProfile);
  }

  const selectedWorkoutStudent = workoutStudent.value;
  const selectedViewStudent = workoutViewStudent.value;
  const selectedAdminLoadStudent = adminLoadStudent?.value || "";
  const selectedAdminEvolutionStudent = adminEvolutionStudent?.value;
  const selectedAssessmentStudent = assessmentStudent.value;
  const selectedPackageStudent = packageStudent?.value;
  const selectedPackageViewStudent = packageViewStudent?.value;
  const selectedManualCheckinStudent = manualCheckinStudent?.value;
  const selectedCheckinFilterStudent = checkinFilterStudent?.value;
  const selectedLoginStudent = loginStudentSelect?.value || selectedStudentProfile;
  const studentNames = students.map((student) => student.name);
  const firstStudentName = students[0]?.name || "";
  const validName = (name, fallback = firstStudentName) => (studentNames.includes(name) ? name : fallback);
  const visibleStudentOptions =
    currentUserType === "student" && selectedStudentProfile
      ? students.filter((student) => student.name === selectedStudentProfile)
      : students;

  workoutStudent.replaceChildren();
  workoutViewStudent.replaceChildren();
  adminLoadStudent?.replaceChildren();
  adminEvolutionStudent?.replaceChildren();
  assessmentStudent.replaceChildren();
  packageViewStudent?.replaceChildren();
  packageStudent?.replaceChildren();
  manualCheckinStudent?.replaceChildren();
  checkinFilterStudent?.replaceChildren();
  loginStudentSelect?.replaceChildren();

  if (checkinFilterStudent) {
    const allOption = document.createElement("option");
    allOption.textContent = "Todos os alunos";
    allOption.value = "";
    checkinFilterStudent.appendChild(allOption);
  }

  if (packageViewStudent) {
    const placeholder = document.createElement("option");
    placeholder.textContent = "Selecione um aluno";
    placeholder.value = "";
    packageViewStudent.appendChild(placeholder);
  }

  students.forEach((student) => {
    const adminOption = document.createElement("option");
    adminOption.textContent = student.name;
    adminOption.value = student.name;

    const loadOption = document.createElement("option");
    loadOption.textContent = student.name;
    loadOption.value = student.name;

    const assessmentOption = document.createElement("option");
    assessmentOption.textContent = student.name;
    assessmentOption.value = student.name;

    const evolutionOption = document.createElement("option");
    evolutionOption.textContent = student.name;
    evolutionOption.value = student.name;

    const manualCheckinOption = document.createElement("option");
    manualCheckinOption.textContent = student.name;
    manualCheckinOption.value = student.name;

    const packageOption = document.createElement("option");
    packageOption.textContent = student.name;
    packageOption.value = student.name;

    const packageViewOption = document.createElement("option");
    packageViewOption.textContent = student.name;
    packageViewOption.value = student.name;

    const checkinFilterOption = document.createElement("option");
    checkinFilterOption.textContent = student.name;
    checkinFilterOption.value = student.name;

    const loginOption = document.createElement("option");
    loginOption.textContent = student.name;
    loginOption.value = student.name;

    workoutStudent.appendChild(adminOption);
    adminLoadStudent?.appendChild(loadOption);
    adminEvolutionStudent?.appendChild(evolutionOption);
    assessmentStudent.appendChild(assessmentOption);
    packageViewStudent?.appendChild(packageViewOption);
    packageStudent?.appendChild(packageOption);
    manualCheckinStudent?.appendChild(manualCheckinOption);
    checkinFilterStudent?.appendChild(checkinFilterOption);
    loginStudentSelect?.appendChild(loginOption);
  });

  visibleStudentOptions.forEach((student) => {
    const viewOption = document.createElement("option");
    viewOption.textContent = student.name;
    viewOption.value = student.name;
    workoutViewStudent.appendChild(viewOption);
  });

  workoutStudent.value = validName(selectedWorkoutStudent);
  workoutViewStudent.value =
    currentUserType === "student" && selectedStudentProfile
      ? selectedStudentProfile
      : validName(selectedViewStudent, visibleStudentOptions[0]?.name || firstStudentName);
  if (adminLoadStudent) adminLoadStudent.value = validName(selectedAdminLoadStudent, workoutViewStudent.value || firstStudentName);
  if (adminEvolutionStudent) adminEvolutionStudent.value = validName(selectedAdminEvolutionStudent, workoutViewStudent.value || firstStudentName);
  assessmentStudent.value = validName(selectedAssessmentStudent, workoutViewStudent.value || firstStudentName);
  if (packageViewStudent) packageViewStudent.value = selectedPackageViewStudent && studentNames.includes(selectedPackageViewStudent) ? selectedPackageViewStudent : "";
  if (packageStudent) packageStudent.value = validName(selectedPackageStudent);
  if (manualCheckinStudent) manualCheckinStudent.value = validName(selectedManualCheckinStudent);
  if (checkinFilterStudent) checkinFilterStudent.value = selectedCheckinFilterStudent && studentNames.includes(selectedCheckinFilterStudent) ? selectedCheckinFilterStudent : "";
  if (loginStudentSelect) loginStudentSelect.value = validName(selectedLoginStudent);
  updateStudentHeader();
  fillManualCheckinPackageSelect();
}

function updateStudentHeader() {
  if (currentUserType === "admin") {
    safeSetText(studentCardName, "Joao Victor");
    safeSetText(studentCardPlan, "Personal Trainer");
    if (studentCardAvatar) {
      studentCardAvatar.src = createInitialsAvatar("Joao Victor");
      studentCardAvatar.alt = "Avatar do Personal Joao Victor";
    }
    return;
  }

  const selectedName = currentUserType === "student" ? selectedStudentProfile : workoutViewStudent?.value;
  const student = loadStudents().find((item) => item.name === selectedName);
  if (!student) {
    safeSetText(studentCardName, "Aluno");
    safeSetText(studentCardPlan, "Plano");
    if (studentCardAvatar) {
      studentCardAvatar.src = createInitialsAvatar("Aluno");
      studentCardAvatar.alt = "Avatar do aluno";
    }
    return;
  }

  safeSetText(studentCardName, student.name);
  safeSetText(studentCardPlan, student.plan);
  if (studentCardAvatar) {
    studentCardAvatar.src = createInitialsAvatar(student.name);
    studentCardAvatar.alt = `Avatar de ${student.name}`;
  }
  renderStudentAssessments();
  renderStudentProfile();
  renderStudentCheckinStatus();
  renderStudentPackagePanel();
}

function createStudentRow(student, index) {
  const row = document.createElement("div");
  row.className = "table-row student-row";

  const name = document.createElement("span");
  name.textContent = student.name;

  const plan = document.createElement("span");
  plan.textContent = student.plan;

  const value = document.createElement("span");
  value.textContent = student.value;
  const due = document.createElement("small");
  due.textContent = `Vence ${student.due}`;
  value.appendChild(due);

  const status = document.createElement("span");
  status.textContent = "Ativo";

  const payment = document.createElement("span");
  payment.className = student.payment === "Atrasado" ? "status-danger" : isPaymentBlocked(student) ? "status-pending" : "status-ok";
  payment.textContent = student.payment;

  const remove = document.createElement("button");
  remove.type = "button";
  remove.dataset.removeStudent = index;
  remove.textContent = "Remover";

  const actions = document.createElement("span");
  actions.className = "student-actions";

  const edit = document.createElement("button");
  edit.type = "button";
  edit.dataset.editStudent = index;
  edit.textContent = "Editar";

  const open = document.createElement("button");
  open.type = "button";
  open.dataset.openStudentProfile = student.name;
  open.textContent = "Abrir perfil";

  actions.append(open, edit, remove);
  row.append(name, plan, value, status, payment, actions);
  return row;
}

function createAdminProfileCard(title, eyebrow, contentNodes = [], actionButtons = []) {
  const card = document.createElement("article");
  card.className = "admin-profile-card";

  const head = document.createElement("div");
  head.className = "admin-profile-card-head";
  const titleBox = document.createElement("div");
  const small = document.createElement("p");
  small.className = "eyebrow";
  small.textContent = eyebrow;
  const heading = document.createElement("h3");
  heading.textContent = title;
  titleBox.append(small, heading);
  head.appendChild(titleBox);

  const body = document.createElement("div");
  body.className = "admin-profile-card-body";
  contentNodes.forEach((node) => body.appendChild(node));

  if (actionButtons.length) {
    const actions = document.createElement("div");
    actions.className = "student-actions";
    actionButtons.forEach((button) => actions.appendChild(button));
    card.append(head, body, actions);
  } else {
    card.append(head, body);
  }

  return card;
}

function createAdminMetric(label, value) {
  const item = document.createElement("span");
  item.className = "admin-profile-metric";
  const strong = document.createElement("strong");
  strong.textContent = value === 0 ? "0" : value || "-";
  const small = document.createElement("small");
  small.textContent = label;
  item.append(strong, small);
  return item;
}

function createActionButton(label, action, studentName) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = action === "package" ? "primary" : "secondary";
  button.dataset.studentProfileAction = action;
  button.dataset.studentName = studentName;
  button.textContent = label;
  return button;
}

function createAdminPackageProfileCard(studentName, activePackage, packageStatus) {
  const card = document.createElement("article");
  card.className = "admin-profile-card admin-package-card";

  const head = document.createElement("div");
  head.className = "admin-profile-card-head";
  const titleBox = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Presencas";
  const title = document.createElement("h3");
  title.textContent = "Pacote e check-ins";
  titleBox.append(eyebrow, title);
  head.appendChild(titleBox);

  const body = document.createElement("div");
  body.className = "admin-profile-card-body package-compact-body";
  body.append(
    createAdminMetric("Pacote", activePackage?.name || "Sem pacote ativo"),
    createAdminMetric("Progresso", activePackage ? `${packageStatus.completed}/${activePackage.total}` : "0/0"),
    createAdminMetric("Restantes", packageStatus?.remaining ?? "0"),
    createAdminMetric("Status", packageStatus?.remaining <= 0 && activePackage ? "Finalizado" : activePackage ? "Ativo" : "Sem pacote"),
  );

  const actions = document.createElement("div");
  actions.className = "student-actions";
  [
    ["Gerenciar pacote", "manage"],
    ["Marcar presenca", "checkin"],
    ["Marcar falta", "absence"],
    ["Ver historico", "history"],
  ].forEach(([label, action]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = action === "manage" ? "primary" : "secondary";
    button.dataset.adminPackageAction = action;
    button.dataset.studentName = studentName;
    button.textContent = label;
    actions.appendChild(button);
  });

  const detail = document.createElement("div");
  detail.className = "admin-package-detail";
  detail.dataset.adminPackageDetail = studentName;

  card.append(head, body, actions, detail);
  return card;
}

function createHistoryItem(title, detail = "") {
  const item = document.createElement("li");
  const strong = document.createElement("strong");
  strong.textContent = title || "-";
  item.appendChild(strong);

  if (detail) {
    const small = document.createElement("small");
    small.textContent = detail;
    item.appendChild(small);
  }

  return item;
}

function createHistoryGroup(title, items, emptyText) {
  const details = document.createElement("details");
  details.className = "student-history-card";

  const summary = document.createElement("summary");
  summary.textContent = title;

  const list = document.createElement("ul");
  if (items.length) {
    items.forEach((item) => list.appendChild(item));
  } else {
    list.appendChild(createHistoryItem(emptyText));
  }

  details.append(summary, list);
  return details;
}

function createAdminStudentHistorySection(studentName) {
  const section = document.createElement("section");
  section.className = "student-history-section";

  const head = document.createElement("div");
  head.className = "student-history-head";
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Historico";
  const title = document.createElement("h3");
  title.textContent = "Historico do aluno";
  head.append(eyebrow, title);

  const workouts = loadWorkouts()[studentName] || [];
  const currentWorkout = getCurrentStudentWorkout(studentName);
  const oldWorkouts = workouts.filter((workout) => workout.id !== currentWorkout?.id).slice().reverse();
  const assessments = getStudentAssessments(studentName);
  const oldAssessments = assessments.slice(0, -1).reverse();
  const activePackage = getActivePackage(studentName);
  const oldPackages = loadClassPackages()
    .filter((classPackage) => classPackage.studentName === studentName && classPackage.id !== activePackage?.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  const checkins = loadCheckins()
    .filter((checkin) => checkin.studentName === studentName)
    .sort((a, b) => b.timestamp - a.timestamp);
  const progressGroups = Object.values(groupProgressByExercise(studentName))
    .filter((group) => group.records.some((record) => !record.prescribed))
    .sort((a, b) => (b.records[b.records.length - 1]?.timestamp || 0) - (a.records[a.records.length - 1]?.timestamp || 0));

  const grid = document.createElement("div");
  grid.className = "student-history-grid";
  grid.append(
    createHistoryGroup(
      "Fichas anteriores",
      oldWorkouts.map((workout) => createHistoryItem(workout.title, `${workout.goal || "Sem objetivo"} | validade ${workout.dueDate || "-"}`)),
      "Nenhuma ficha anterior.",
    ),
    createHistoryGroup(
      "Avaliacoes anteriores",
      oldAssessments.map((assessment) => createHistoryItem(assessment.date, `Peso ${assessment.weight || "-"} | gordura ${assessment.fat || "-"} | massa ${assessment.muscle || "-"}`)),
      "Nenhuma avaliacao anterior.",
    ),
    createHistoryGroup(
      "Pacotes anteriores",
      oldPackages.map((classPackage) => {
        const status = getPackageStatus(classPackage);
        return createHistoryItem(classPackage.name, `${status.completed}/${classPackage.total} aulas | ${classPackage.startDate || "-"} a ${classPackage.endDate || "-"}`);
      }),
      "Nenhum pacote anterior.",
    ),
    createHistoryGroup(
      "Check-ins, cancelamentos e faltas",
      checkins.slice(0, 12).map((checkin) => createHistoryItem(
        `${checkin.date} as ${checkin.time}`,
        `${checkin.packageName || "Sem pacote"} | ${getCheckinStatusLabel(checkin)} | ${checkin.markedBy || "aluno"}`,
      )),
      "Nenhum registro de presenca ainda.",
    ),
    createHistoryGroup(
      "Desempenho registrado",
      progressGroups.slice(0, 12).map((group) => {
        const progress = getProgressFromRecords(group.records);
        return createHistoryItem(group.exerciseName, `${group.workoutTitle || "Treino"} | ${progress.detail}`);
      }),
      "Nenhuma evolucao registrada.",
    ),
  );

  section.append(head, grid);
  return section;
}

function renderAdminPackageDetail(studentName, action) {
  const detail = studentAdminProfile?.querySelector(`[data-admin-package-detail="${studentName}"]`);
  if (!detail) return;

  const activePackage = getActivePackage(studentName) || loadClassPackages().filter((item) => item.studentName === studentName).sort((a, b) => b.createdAt - a.createdAt)[0];
  const status = activePackage ? getPackageStatus(activePackage) : null;
  detail.innerHTML = "";

  if (action === "manage") {
    const box = document.createElement("div");
    box.className = "package-inline-panel";
    const text = document.createElement("span");
    text.textContent = activePackage
      ? `${activePackage.name} | ${activePackage.total} aulas | ${activePackage.startDate} a ${activePackage.endDate} | ${activePackage.days} as ${activePackage.time}`
      : "Nenhum pacote ativo para este aluno.";
    const actions = document.createElement("div");
    actions.className = "student-actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "primary";
    edit.dataset.packageManageAction = "edit";
    edit.dataset.studentName = studentName;
    edit.dataset.packageId = activePackage?.id || "";
    edit.textContent = activePackage ? "Editar pacote" : "Criar pacote";
    actions.appendChild(edit);

    if (activePackage) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary danger-action";
      remove.dataset.packageManageAction = "delete";
      remove.dataset.studentName = studentName;
      remove.dataset.packageId = activePackage.id;
      remove.textContent = "Excluir pacote";
      actions.appendChild(remove);
    }

    box.append(text, actions);
    detail.appendChild(box);
    return;
  }

  if (action === "checkin") {
    const box = document.createElement("div");
    box.className = "package-inline-panel";
    const text = document.createElement("span");
    text.textContent = activePackage
      ? `${status.completed}/${activePackage.total} aulas realizadas.`
      : "Crie um pacote antes de marcar presenca.";
    const button = createActionButton("Marcar agora", "checkin", studentName);
    box.append(text, button);
    detail.appendChild(box);
    return;
  }

  if (action === "absence") {
    if (!activePackage) {
      detail.textContent = "Crie um pacote antes de marcar falta.";
      return;
    }

    const schedule = generatePackageSchedule(activePackage);
    const todayKey = getDateKey();
    const availableLessons = schedule.filter((lesson) => lesson.dateKey >= todayKey && !getLessonRecord(activePackage.id, lesson.dateKey)).slice(0, 8);
    if (!availableLessons.length) {
      detail.textContent = "Nenhuma aula disponivel para marcar falta.";
      return;
    }

    availableLessons.forEach((lesson) => {
      const row = document.createElement("div");
      row.className = "package-inline-panel";
      const text = document.createElement("span");
      text.textContent = `${lesson.date} | ${lesson.time}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary danger-action";
      button.dataset.packageManageAction = "absence";
      button.dataset.studentName = studentName;
      button.dataset.packageId = activePackage.id;
      button.dataset.lessonDate = lesson.dateKey;
      button.textContent = "Marcar falta";
      row.append(text, button);
      detail.appendChild(row);
    });
    return;
  }

  const history = loadCheckins().filter((checkin) => checkin.packageId === activePackage?.id).sort((a, b) => b.timestamp - a.timestamp);
  if (!activePackage || !history.length) {
    detail.textContent = "Nenhum check-in registrado neste pacote.";
    return;
  }

  history.slice(0, 6).forEach((checkin) => {
    const item = document.createElement("small");
    item.textContent = checkin.type === "cancelamento de aula"
      ? `${checkin.date} as ${checkin.time} | ${getCheckinStatusLabel(checkin)}`
      : checkin.status === "falta"
        ? `${checkin.date} as ${checkin.time} | ${getCheckinStatusLabel(checkin)}`
      : `${checkin.date} as ${checkin.time} | check-in por ${checkin.markedBy || "aluno"}`;
    detail.appendChild(item);
  });
}

function renderAdminStudentProfile(studentName) {
  if (!studentAdminProfile) return;

  const student = loadStudents().find((item) => item.name === studentName);
  if (!student) {
    studentAdminProfile.hidden = true;
    return;
  }

  selectedAdminProfileStudent = studentName;
  const studentWorkouts = loadWorkouts()[student.name] || [];
  const workout = studentWorkouts.find((item) => getWorkoutPeriodStatus(item).state === "active") || studentWorkouts[0] || null;
  const workoutStatus = workout ? getWorkoutPeriodStatus(workout) : null;
  const activePackage = getActivePackage(student.name);
  const packageStatus = activePackage ? getPackageStatus(activePackage) : null;
  const assessments = getStudentAssessments(student.name);
  const latestAssessment = assessments[assessments.length - 1];
  const progress = getRecentLoadProgressText(student.name);

  studentAdminProfile.hidden = false;
  studentAdminProfile.innerHTML = "";

  const header = document.createElement("div");
  header.className = "student-admin-profile-head";
  const info = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Perfil do aluno";
  const title = document.createElement("h3");
  title.textContent = student.name;
  const detail = document.createElement("span");
  detail.textContent = `${student.plan} | ${student.value} | pagamento ${student.payment}`;
  info.append(eyebrow, title, detail);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "secondary";
  close.dataset.closeStudentProfile = "true";
  close.textContent = "Fechar";
  header.append(info, close);

  const grid = document.createElement("div");
  grid.className = "student-admin-profile-grid";

  grid.append(
    createAdminProfileCard("Dados do aluno", "Cadastro", [
      createAdminMetric("Plano", student.plan),
      createAdminMetric("WhatsApp", student.phone || "Nao cadastrado"),
      createAdminMetric("Nascimento", student.birthDate || "Nao informado"),
      createAdminMetric("Login", student.supabaseUserId ? "Vinculado" : "Sem userId"),
      createAdminMetric("Valor", student.value),
      createAdminMetric("Vencimento", student.due),
      createAdminMetric("Pagamento", student.payment),
    ], [createActionButton("Editar aluno", "edit", student.name)]),
    createAdminProfileCard("Ficha de treino", "Treino", [
      createAdminMetric("Ficha atual", workout?.title || "Sem ficha"),
      createAdminMetric("Status", workoutStatus?.label || "-"),
      createAdminMetric("Objetivo", workout?.goal || "-"),
      createAdminMetric("Validade", workout?.dueDate || "-"),
      createAdminMetric("Treinos", workout?.sessions?.length || "0"),
    ], [createActionButton(workout ? "Abrir fichas" : "Criar ficha", "workout", student.name)]),
    createAdminPackageProfileCard(student.name, activePackage, packageStatus || { completed: 0, remaining: 0 }),
    createAdminProfileCard("Avaliacoes", "Bioimpedancia", [
      createAdminMetric("Total", assessments.length),
      createAdminMetric("Ultima avaliacao", latestAssessment?.date || "Sem avaliacao"),
      createAdminMetric("Peso", latestAssessment?.weight || "-"),
      createAdminMetric("Gordura", latestAssessment?.fat || "-"),
    ], [createActionButton("Abrir avaliacoes", "assessment", student.name)]),
    createAdminProfileCard("Evolucao", "Carga", [
      createAdminMetric("Progresso recente", progress.title),
      createAdminMetric("Detalhe", progress.detail),
    ], [createActionButton("Ver evolucao", "evolution", student.name)]),
  );

  studentAdminProfile.append(header, grid, createAdminStudentHistorySection(student.name));
}

function renderBlockedPaymentPanel() {
  if (!paymentBlockedPanel) return;

  const blockedStudents = loadStudents().filter(isPaymentBlocked);
  paymentBlockedPanel.innerHTML = "";

  const title = document.createElement("strong");
  title.textContent = "Pagamentos pendentes/atrasados";

  const summary = document.createElement("span");
  summary.textContent = blockedStudents.length
    ? `${blockedStudents.length} aluno(s) com acesso ao treino bloqueado.`
    : "Nenhum aluno bloqueado no momento.";

  paymentBlockedPanel.append(title, summary);

  if (!blockedStudents.length) return;

  const list = document.createElement("div");
  list.className = "blocked-payment-list";

  blockedStudents.forEach((student) => {
    const item = document.createElement("div");
    item.className = "blocked-payment-item";

    const info = document.createElement("small");
    info.textContent = `${student.name} | ${student.payment} | vence ${student.due}`;

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "secondary";
    edit.dataset.editBlockedPaymentStudent = student.name;
    edit.textContent = "Editar pagamento";

    item.append(info, edit);
    list.appendChild(item);
  });

  paymentBlockedPanel.appendChild(list);
}

function renderStudents() {
  if (!studentList) return;

  const students = loadStudents();
  const pendingStudents = students.filter(isPaymentBlocked);

  studentList.innerHTML = "";
  students.forEach((student, index) => {
    studentList.appendChild(createStudentRow(student, index));
  });

  safeSetText(studentCount, students.length);
  safeSetText(pendingCount, pendingStudents.length);
  renderBlockedPaymentPanel();
  fillStudentSelects();
  renderPackageAdminList();
  renderWorkouts();
  renderAdminAssessments();
  renderCheckinHistory();
  renderBillingList();
}

function createWorkoutRow(studentName, workout) {
  const row = document.createElement("div");
  row.className = "table-row workout-row";
  const expiration = getWorkoutPeriodStatus(workout);

  const student = document.createElement("span");
  student.textContent = studentName;

  const title = document.createElement("span");
  title.textContent = workout.title;

  const due = document.createElement("span");
  due.textContent = workout.dueDate;

  const status = document.createElement("span");
  status.appendChild(createWorkoutStatusBadge(expiration));

  const total = document.createElement("span");
  total.textContent = `${workout.exercises.length} exercicios`;

  const actions = document.createElement("span");
  actions.className = "student-actions";

  const edit = document.createElement("button");
  edit.type = "button";
  edit.dataset.editWorkoutStudent = studentName;
  edit.dataset.editWorkoutId = workout.id;
  edit.textContent = "Editar";

  const copy = document.createElement("button");
  copy.type = "button";
  copy.dataset.copyWorkoutStudent = studentName;
  copy.dataset.copyWorkoutId = workout.id;
  copy.textContent = "Usar";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.dataset.removeWorkoutStudent = studentName;
  remove.dataset.removeWorkoutId = workout.id;
  remove.textContent = "Remover";

  actions.append(edit, copy, remove);
  row.append(student, title, due, status, total, actions);
  return row;
}

function createWorkoutStudentCard(student) {
  const workouts = loadWorkouts()[student.name] || [];
  const expiring = workouts.filter((workout) => {
    const status = getWorkoutPeriodStatus(workout);
    return status.state === "expired" || (status.state === "active" && status.days !== null && status.days <= 7);
  }).length;

  const card = document.createElement("article");
  card.className = "workout-student-card";

  const title = document.createElement("strong");
  title.textContent = student.name;

  const details = document.createElement("span");
  details.textContent = `${student.plan} | ${workouts.length} ficha(s)`;

  const status = document.createElement("small");
  status.textContent = expiring ? `${expiring} ficha(s) vencendo ou vencida(s)` : "Fichas em ordem";

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.openWorkoutStudent = student.name;
  button.textContent = "Abrir fichas";

  card.append(title, details, status, button);
  return card;
}

function renderWorkoutStudentDirectory() {
  if (!workoutStudentDirectory || !workoutStudentSearch) return;

  workoutStudentDirectory.innerHTML = "";
  const query = workoutStudentSearch.value.trim().toLowerCase();

  if (!query) {
    workoutStudentDirectory.textContent = "Digite o nome de um aluno para localizar as fichas.";
    return;
  }

  const students = loadStudents().filter((student) => student.name.toLowerCase().includes(query));

  if (!students.length) {
    workoutStudentDirectory.textContent = "Nenhum aluno encontrado com esse nome.";
    return;
  }

  students.forEach((student) => {
    workoutStudentDirectory.appendChild(createWorkoutStudentCard(student));
  });
}

function openWorkoutStudentWorkspace(studentName) {
  if (!workoutStudentDirectory || !workoutStudentWorkspace || !workoutTablePanel || !workoutStudent) return;

  selectedAdminWorkoutStudent = studentName;
  const student = loadStudents().find((item) => item.name === studentName);

  workoutStudentDirectory.hidden = true;
  workoutStudentWorkspace.hidden = false;
  workoutTablePanel.hidden = false;
  safeSetText(workoutSelectedStudentName, studentName);
  safeSetText(workoutSelectedStudentDetails, student
    ? `${student.plan} | ${student.value} | pagamento ${student.payment}`
    : "Aluno selecionado");
  workoutStudent.value = studentName;
  renderWorkouts();
}

function showWorkoutStudentDirectory() {
  if (!workoutStudentDirectory || !workoutStudentWorkspace || !workoutForm || !workoutTablePanel || !workoutStudent) return;

  selectedAdminWorkoutStudent = "";
  workoutStudentDirectory.hidden = false;
  workoutStudentWorkspace.hidden = true;
  workoutForm.hidden = true;
  workoutTablePanel.hidden = true;
  workoutStudent.disabled = false;
  editingWorkout = null;
  renderWorkouts();
}

function showWorkoutFormForStudent(studentName, mode = "create") {
  if (!workoutForm || !workoutStudent) return;

  workoutForm.hidden = false;
  workoutStudent.value = studentName;
  workoutStudent.disabled = true;
  if (mode === "create") {
    workoutForm.reset();
    workoutStudent.value = studentName;
    resetExerciseRows();
    editingWorkout = null;
    safeSetText(saveWorkoutButton, "Salvar ficha");
    if (cancelWorkoutEditButton) cancelWorkoutEditButton.hidden = false;
    if (workoutMessage) {
      workoutMessage.textContent = "Criando nova ficha para este aluno.";
      workoutMessage.classList.remove("error");
    }
  }
  workoutTitle?.focus();
}

function normalizeExercise(exercise) {
  if (typeof exercise === "string") {
    return { name: exercise, weight: "", previousLoad: "", currentLoad: "", recordDate: "", progressNote: "", videoUrl: "", reps: "", sets: "", rest: "" };
  }

  if (!exercise || typeof exercise !== "object") {
    return { name: "", weight: "", previousLoad: "", currentLoad: "", recordDate: "", progressNote: "", videoUrl: "", reps: "", sets: "", rest: "" };
  }

  return {
    name: exercise.name || "",
    weight: exercise.weight || "",
    previousLoad: exercise.previousLoad || "",
    currentLoad: exercise.currentLoad || exercise.weight || "",
    recordDate: exercise.recordDate || "",
    progressNote: exercise.progressNote || "",
    videoUrl: exercise.videoUrl || "",
    reps: exercise.reps || "",
    sets: exercise.sets || "",
    rest: exercise.rest || "",
  };
}

function createExerciseFormRow(exercise = {}) {
  const row = document.createElement("div");
  row.className = "exercise-form-row";

  const fields = [
    ["name", "Nome do exercicio", true],
    ["currentLoad", "Carga prescrita", false],
    ["reps", "Ex: 12", false],
    ["sets", "Ex: 4", false],
    ["rest", "Ex: 60s", false],
    ["progressNote", "Observacao", false],
    ["videoUrl", "Link do video", false],
  ];

  fields.forEach(([key, placeholder, required]) => {
    const input = document.createElement("input");
    input.dataset.exerciseField = key;
    input.placeholder = placeholder;
    input.value = exercise[key] || "";
    if (key === "currentLoad" || key === "sets" || key === "rest") input.inputMode = "decimal";
    if (required) input.required = true;
    row.appendChild(input);
  });

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "secondary";
  remove.dataset.removeExerciseRow = "true";
  remove.textContent = "Remover";
  row.appendChild(remove);

  return row;
}

function createTrainingSessionBlock(session = {}) {
  const block = document.createElement("article");
  block.className = "training-session-builder";
  block.dataset.sessionId = session.id || createId();

  const head = document.createElement("div");
  head.className = "training-session-head";

  const label = document.createElement("label");
  label.textContent = "Nome do treino";
  const input = document.createElement("input");
  input.dataset.sessionTitle = "true";
  input.placeholder = "Ex: Pernas, Superiores, Full Body";
  input.value = session.title || "";
  label.appendChild(input);

  const actions = document.createElement("div");
  actions.className = "student-actions";

  const addExercise = document.createElement("button");
  addExercise.type = "button";
  addExercise.className = "secondary";
  addExercise.dataset.addSessionExercise = "true";
  addExercise.textContent = "Adicionar exercicio";

  const removeSession = document.createElement("button");
  removeSession.type = "button";
  removeSession.className = "secondary";
  removeSession.dataset.removeSession = "true";
  removeSession.textContent = "Remover treino";

  actions.append(addExercise, removeSession);
  head.append(label, actions);

  const list = document.createElement("div");
  list.className = "training-session-exercises";
  (session.exercises?.length ? session.exercises : [{}]).map(normalizeExercise).forEach((exercise) => {
    list.appendChild(createExerciseFormRow(exercise));
  });

  block.append(head, list);
  return block;
}

function addTrainingSession(session = {}) {
  if (!workoutExercises) return;
  workoutExercises.appendChild(createTrainingSessionBlock(session));
}

function resetTrainingSessions(sessions = [{ title: "Treino principal", exercises: [{}] }]) {
  if (!workoutExercises) return;
  workoutExercises.replaceChildren();
  sessions.forEach(addTrainingSession);
}

function resetExerciseRows(exercises = [{}]) {
  resetTrainingSessions([{ title: "Treino principal", exercises }]);
}

function looksLikeWorkoutTitle(line) {
  const text = String(line || "").trim();
  if (!text) return false;
  if (/\d+\s*x\s*\d+/i.test(text)) return false;
  if (/\b(series?|s[eé]ries?|reps?|repeti[cç][oõ]es?|kg|carga|descanso)\b/i.test(text)) return false;
  return /^treino\s+[a-z0-9]/i.test(text) || /^[a-zÀ-ÿ\s]+(\s*-\s*[a-zÀ-ÿ\s]+)?$/i.test(text);
}

function isWorkoutBlockTitle(line) {
  const text = String(line || "").trim();
  if (!text) return false;
  if (/\d+\s*x\s*\d+/i.test(text)) return false;
  if (/\b(series?|s[eé]ries?|reps?|repeti[cç][oõ]es?|kg|carga|peso|descanso)\b/i.test(text)) return false;

  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return /^(treino|ficha|workout|parte)\s+[a-z0-9]\b/i.test(normalized)
    || /^dia\s+\d+\b/i.test(normalized)
    || /^(inferiores|superiores|full body|costas e biceps|peito e triceps)\b/i.test(normalized);
}

function cleanExerciseName(line) {
  return String(line || "")
    .replace(/\b\d+\s*x\s*\d+\b/gi, "")
    .replace(/\b\d+\s*s[eé]ries?\s*(de)?\s*\d+\s*(reps?|repeti[cç][oõ]es?)?\b/gi, "")
    .replace(/\b\d+\s*(s[eé]ries?|series?)\b/gi, "")
    .replace(/\b\d+\s*(reps?|repeti[cç][oõ]es?)\b/gi, "")
    .replace(/\b(carga|peso)\s*\d+[,.]?\d*\s*(kg|kgs|quilos?)?\b/gi, "")
    .replace(/\b\d+[,.]?\d*\s*(kg|kgs|quilos?)\b/gi, "")
    .replace(/\bdescanso\s*\d+\s*(s|seg|segundos?|min|minutos?)?\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[-–—|]+$/g, "")
    .trim();
}

function parseWorkoutExerciseLine(line) {
  const text = String(line || "").trim();
  if (!text) return null;

  const compactMatch = text.match(/\b(\d+)\s*x\s*(\d+)\b/i);
  const seriesRepMatch = text.match(/\b(\d+)\s*s[eé]ries?\s*(?:de)?\s*(\d+)\s*(?:reps?|repeti[cç][oõ]es?)?\b/i);
  const setsOnlyMatch = text.match(/\b(\d+)\s*(?:s[eé]ries?|series?)\b/i);
  const repsOnlyMatch = text.match(/\b(\d+)\s*(?:reps?|repeti[cç][oõ]es?)\b/i);
  const loadMatch = text.match(/\b(?:carga|peso)\s*(\d+[,.]?\d*)\s*(kg|kgs|quilos?)?\b/i) || text.match(/\b(\d+[,.]?\d*)\s*(kg|kgs|quilos?)\b/i);
  const restMatch = text.match(/\bdescanso\s*(\d+)\s*(s|seg|segundos?|min|minutos?)?\b/i);

  const sets = compactMatch?.[1] || seriesRepMatch?.[1] || setsOnlyMatch?.[1] || "";
  const reps = compactMatch?.[2] || seriesRepMatch?.[2] || repsOnlyMatch?.[1] || "";
  const load = loadMatch ? `${loadMatch[1]}${loadMatch[2] ? loadMatch[2].replace(/kgs?|quilos?/i, "kg") : "kg"}` : "";
  const rest = restMatch ? `${restMatch[1]}${restMatch[2] ? restMatch[2].replace(/segundos?|seg/i, "s").replace(/minutos?/i, "min") : "s"}` : "";
  const name = cleanExerciseName(text);

  if (!name) return null;

  return {
    name,
    currentLoad: load,
    weight: load,
    reps,
    sets,
    rest,
    progressNote: "",
    videoUrl: "",
  };
}

function importWorkoutFromText() {
  const rawText = workoutImportText?.value || "";
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    if (workoutMessage) {
      workoutMessage.textContent = "Cole o treino em texto antes de organizar.";
      workoutMessage.classList.add("error");
    }
    workoutImportText?.focus();
    return;
  }

  const sessions = [];
  let currentSession = null;

  const startSession = (title = "Treino principal") => {
    currentSession = { title, exercises: [] };
    sessions.push(currentSession);
  };

  lines.forEach((line, index) => {
    if (isWorkoutBlockTitle(line)) {
      startSession(line);
      if (index === 0 && workoutTitle && !workoutTitle.value.trim()) workoutTitle.value = line;
      return;
    }

    const exercise = parseWorkoutExerciseLine(line);
    if (!exercise) return;

    if (!currentSession) startSession(workoutTitle?.value.trim() || "Treino principal");
    currentSession.exercises.push(exercise);
  });

  const filledSessions = sessions.filter((session) => session.exercises.length);
  const exerciseCount = filledSessions.reduce((total, session) => total + session.exercises.length, 0);

  if (!filledSessions.length) {
    if (workoutMessage) {
      workoutMessage.textContent = "Nao encontrei exercicios no texto. Revise o formato e tente novamente.";
      workoutMessage.classList.add("error");
    }
    return;
  }

  resetTrainingSessions(filledSessions);
  if (workoutMessage) {
    workoutMessage.textContent = `${exerciseCount} exercicio(s) em ${filledSessions.length} treino(s) organizados. Revise os campos antes de salvar.`;
    workoutMessage.classList.remove("error");
  }
}

function getWorkoutCopy(studentName, workoutId) {
  const workout = (loadWorkouts()[studentName] || []).find((item) => item.id === workoutId);
  if (!workout) return null;

  return {
    title: workout.title,
    goal: workout.goal,
    frequency: workout.frequency,
    startDate: workout.startDate,
    dueDate: workout.dueDate,
    notes: workout.notes,
    sessions: workout.sessions.map((session) => ({
      id: createId(),
      title: session.title,
      exercises: session.exercises.map(normalizeExercise),
    })),
  };
}

function loadWorkoutIntoForm(sourceStudent, workoutId) {
  if (!workoutTitle || !workoutGoal || !workoutFrequency || !workoutStartDate || !workoutDueDate || !workoutNotes) return;

  const workout = getWorkoutCopy(sourceStudent, workoutId);
  if (!workout) return;

  workoutTitle.value = workout.title;
  workoutGoal.value = workout.goal;
  workoutFrequency.value = workout.frequency || "";
  workoutStartDate.value = workout.startDate || "";
  workoutDueDate.value = workout.dueDate;
  workoutNotes.value = workout.notes;
  resetTrainingSessions(workout.sessions);
  editingWorkout = null;
  safeSetText(saveWorkoutButton, "Salvar ficha");
  if (cancelWorkoutEditButton) cancelWorkoutEditButton.hidden = true;
  if (workoutMessage) {
    workoutMessage.textContent = "Ficha carregada. Escolha o aluno destino e salve.";
    workoutMessage.classList.remove("error");
  }
}

function collectExerciseRows() {
  if (!workoutExercises) return [];

  const getFieldValue = (row, field) => row.querySelector(`[data-exercise-field="${field}"]`)?.value.trim() || "";

  return [...workoutExercises.querySelectorAll(".exercise-form-row")]
    .map((row) => ({
      name: getFieldValue(row, "name"),
      weight: getFieldValue(row, "currentLoad"),
      previousLoad: getFieldValue(row, "previousLoad"),
      currentLoad: getFieldValue(row, "currentLoad"),
      reps: getFieldValue(row, "reps"),
      sets: getFieldValue(row, "sets"),
      rest: getFieldValue(row, "rest"),
      recordDate: getFieldValue(row, "recordDate"),
      progressNote: getFieldValue(row, "progressNote"),
      videoUrl: getFieldValue(row, "videoUrl"),
    }))
    .filter((exercise) => exercise.name);
}

function collectTrainingSessions() {
  if (!workoutExercises) return [];

  return [...workoutExercises.querySelectorAll(".training-session-builder")]
    .map((session, index) => ({
      id: session.dataset.sessionId || createId(),
      title: session.querySelector("[data-session-title]")?.value.trim() || `Treino ${index + 1}`,
      exercises: [...session.querySelectorAll(".exercise-form-row")]
        .map((row) => ({
          name: row.querySelector('[data-exercise-field="name"]')?.value.trim() || "",
          weight: row.querySelector('[data-exercise-field="currentLoad"]')?.value.trim() || "",
          previousLoad: "",
          currentLoad: row.querySelector('[data-exercise-field="currentLoad"]')?.value.trim() || "",
          reps: row.querySelector('[data-exercise-field="reps"]')?.value.trim() || "",
          sets: row.querySelector('[data-exercise-field="sets"]')?.value.trim() || "",
          rest: row.querySelector('[data-exercise-field="rest"]')?.value.trim() || "",
          recordDate: "",
          progressNote: row.querySelector('[data-exercise-field="progressNote"]')?.value.trim() || "",
          videoUrl: row.querySelector('[data-exercise-field="videoUrl"]')?.value.trim() || "",
        }))
        .filter((exercise) => exercise.name),
    }))
    .filter((session) => session.exercises.length);
}

function parseLoad(load) {
  const value = String(load || "").replace(",", ".").match(/-?\d+(\.\d+)?/);
  return value ? Number(value[0]) : null;
}

function getLoadUnit(currentLoad, previousLoad) {
  const source = String(currentLoad || previousLoad || "");
  const unit = source.replace(/[-\d.,\s]/g, "").trim();
  return unit || "kg";
}

function getExerciseProgress(exercise) {
  const previous = parseLoad(exercise.previousLoad);
  const current = parseLoad(exercise.currentLoad);

  if (previous === null || current === null) {
    return { label: "Sem dados", detail: "Informe as cargas", className: "progress-neutral" };
  }

  const difference = current - previous;
  const unit = getLoadUnit(exercise.currentLoad, exercise.previousLoad);

  if (difference > 0) {
    return { label: "Aumentou carga", detail: `+${difference}${unit}`, className: "progress-up" };
  }

  if (difference < 0) {
    return { label: "Reduziu carga", detail: `${difference}${unit}`, className: "progress-down" };
  }

  return { label: "Manteve carga", detail: `0${unit}`, className: "progress-neutral" };
}

function formatToday() {
  return new Date().toLocaleDateString("pt-BR");
}

function formatCurrentTime() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseBrazilianDate(dateText) {
  const match = String(dateText || "").match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  let year = match[3] ? Number(match[3]) : new Date().getFullYear();
  if (year < 100) year += 2000;

  const date = new Date(year, month, day);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateKey(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : dateKey;
}

function parseLessonDateTime(dateKey, timeText) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (!year || !month || !day) return null;

  const match = String(timeText || "").match(/(\d{1,2})(?:h|:)?\s*(\d{1,2})?/i);
  const hour = match ? Number(match[1]) : 0;
  const minute = match?.[2] ? Number(match[2]) : 0;
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLessonRecord(packageId, lessonDateKey) {
  return loadCheckins().find((checkin) => checkin.packageId === packageId && checkin.dateKey === lessonDateKey);
}

function isConsumedLesson(checkin) {
  return checkin?.status === "realizado" || checkin?.consumed === true || checkin?.status === "cancelada-fora-prazo" || checkin?.status === "falta";
}

function getCheckinStatusLabel(checkin) {
  if (checkin?.status === "falta") return "Falta - aula contabilizada";
  if (checkin?.status === "cancelada-no-prazo") return "Cancelada no prazo";
  if (checkin?.status === "cancelada-fora-prazo") return "Cancelada fora do prazo - aula contabilizada";
  return checkin?.statusLabel || "Realizado";
}

function getCancellationStatus(lesson) {
  const lessonDate = parseLessonDateTime(lesson.dateKey, lesson.time);
  if (!lessonDate) return { status: "cancelada-fora-prazo", label: "Cancelada fora do prazo - aula contabilizada", consumed: true };

  const hoursUntilLesson = (lessonDate.getTime() - Date.now()) / 3600000;
  const inTime = hoursUntilLesson > 2;
  return inTime
    ? { status: "cancelada-no-prazo", label: "Cancelada no prazo", consumed: false }
    : { status: "cancelada-fora-prazo", label: "Cancelada fora do prazo - aula contabilizada", consumed: true };
}

function parsePackageDays(daysText) {
  const normalized = String(daysText || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const aliases = [
    ["domingo", 0],
    ["segunda", 1],
    ["terca", 2],
    ["terça", 2],
    ["quarta", 3],
    ["quinta", 4],
    ["sexta", 5],
    ["sabado", 6],
    ["sábado", 6],
  ];

  return [...new Set(aliases.filter(([name]) => normalized.includes(name)).map(([, index]) => index))];
}

function generatePackageSchedule(classPackage) {
  const start = parseBrazilianDate(classPackage.startDate);
  const end = parseBrazilianDate(classPackage.endDate);
  const weekdays = parsePackageDays(classPackage.days);
  const total = Number(classPackage.total) || 0;
  if (!start || !end || !weekdays.length || !total) return [];

  const lessons = [];
  const cursor = new Date(start);
  while (cursor <= end && lessons.length < total) {
    if (weekdays.includes(cursor.getDay())) {
      lessons.push({
        packageId: classPackage.id,
        date: cursor.toLocaleDateString("pt-BR"),
        dateKey: getDateKey(cursor),
        time: classPackage.time,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return lessons;
}

function getPackageCheckins(packageId) {
  return loadCheckins().filter((checkin) => checkin.packageId === packageId && isConsumedLesson(checkin));
}

function getCompletedLessons(classPackage) {
  return getPackageCheckins(classPackage.id).length;
}

function getActivePackage(studentName) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return loadClassPackages()
    .filter((classPackage) => classPackage.studentName === studentName)
    .sort((a, b) => b.createdAt - a.createdAt)
    .find((classPackage) => {
      const end = parseBrazilianDate(classPackage.endDate);
      const completed = getCompletedLessons(classPackage);
      return completed < classPackage.total && (!end || end >= today);
    }) || null;
}

function getPackageStatus(classPackage) {
  const completed = getCompletedLessons(classPackage);
  const remaining = Math.max((Number(classPackage.total) || 0) - completed, 0);
  return {
    completed,
    remaining,
    label: remaining <= 0 ? "Pacote finalizado" : `${completed}/${classPackage.total} aulas realizadas`,
  };
}

function getTodayPackageLesson(classPackage) {
  const todayKey = getDateKey();
  return generatePackageSchedule(classPackage).find((lesson) => lesson.dateKey === todayKey) || null;
}

function createCheckin(studentName, type = "check-in do aluno", classPackage = null, markedBy = "aluno") {
  return {
    id: createId(),
    studentName,
    studentId: getStudentIdByName(studentName),
    packageId: classPackage?.id || "",
    packageName: classPackage?.name || "",
    date: formatToday(),
    dateKey: getDateKey(),
    time: formatCurrentTime(),
    type,
    status: "realizado",
    markedBy,
    month: currentMonthKey(),
    timestamp: Date.now(),
  };
}

function getTodayStudentCheckin(studentName, packageId = "") {
  const today = getDateKey();
  const todayText = formatToday();
  return loadCheckins().find(
    (checkin) =>
      checkin.studentName === studentName &&
      (checkin.dateKey === today || (!checkin.dateKey && checkin.date === todayText)) &&
      (!packageId || checkin.packageId === packageId),
  );
}

function registerPackageCheckin(studentName, classPackage, markedBy = "aluno") {
  if (!studentName || !classPackage) return false;

  const status = getPackageStatus(classPackage);
  if (status.remaining <= 0) return false;

  const todayCheckin = getTodayStudentCheckin(studentName, classPackage.id);
  if (todayCheckin) return false;

  const checkins = loadCheckins();
  checkins.push(createCheckin(studentName, markedBy === "personal" ? "presenca manual do personal" : "check-in do aluno", classPackage, markedBy));
  saveCheckins(checkins);
  return true;
}

function registerLessonCancellation(studentName, classPackage, lesson) {
  if (!studentName || !classPackage || !lesson) return false;
  if (getLessonRecord(classPackage.id, lesson.dateKey)) return false;

  const cancellation = getCancellationStatus(lesson);
  const status = getPackageStatus(classPackage);
  if (cancellation.consumed && status.remaining <= 0) return false;

  const checkins = loadCheckins();
  checkins.push({
    id: createId(),
    studentName,
    studentId: getStudentIdByName(studentName),
    packageId: classPackage.id,
    packageName: classPackage.name,
    date: lesson.date,
    dateKey: lesson.dateKey,
    time: lesson.time,
    type: "cancelamento de aula",
    status: cancellation.status,
    statusLabel: cancellation.label,
    consumed: cancellation.consumed,
    markedBy: "aluno",
    cancellationDate: formatToday(),
    cancellationTime: formatCurrentTime(),
    month: currentMonthKey(),
    timestamp: Date.now(),
  });
  saveCheckins(checkins);
  return true;
}

function registerLessonAbsence(studentName, classPackage, lesson) {
  if (!studentName || !classPackage || !lesson) return false;
  if (getLessonRecord(classPackage.id, lesson.dateKey)) return false;

  const status = getPackageStatus(classPackage);
  if (status.remaining <= 0) return false;

  const checkins = loadCheckins();
  checkins.push({
    id: createId(),
    studentName,
    studentId: getStudentIdByName(studentName),
    packageId: classPackage.id,
    packageName: classPackage.name,
    date: lesson.date,
    dateKey: lesson.dateKey,
    time: lesson.time,
    type: "falta",
    status: "falta",
    statusLabel: "Falta - aula contabilizada",
    consumed: true,
    markedBy: "personal",
    absenceDate: formatToday(),
    absenceTime: formatCurrentTime(),
    month: currentMonthKey(),
    timestamp: Date.now(),
  });
  saveCheckins(checkins);
  return true;
}

function getExerciseKey(workoutId, exerciseName, index) {
  return `${workoutId}|||${exerciseName.toLowerCase().trim()}|||${index}`;
}

function getWorkoutExerciseEntries(workout) {
  let flatIndex = 0;
  return (workout.sessions || [{ title: "Treino principal", exercises: workout.exercises || [] }]).flatMap((session) =>
    (session.exercises || []).map((exercise) => ({
      session,
      exercise: normalizeExercise(exercise),
      index: flatIndex++,
    })),
  );
}

function getPrescribedLoad(exercise) {
  const normalizedExercise = normalizeExercise(exercise);
  return normalizedExercise.currentLoad || normalizedExercise.weight || "";
}

function getProgressFromRecords(records) {
  if (records.length < 2) {
    return { label: "Primeiro registro", detail: "Sem comparacao", className: "progress-neutral" };
  }

  const previous = parseLoad(records[records.length - 2].load);
  const current = parseLoad(records[records.length - 1].load);
  const unit = getLoadUnit(records[records.length - 1].load, records[records.length - 2].load);

  if (previous === null || current === null) {
    return { label: "Sem dados", detail: "Confira a carga", className: "progress-neutral" };
  }

  const difference = current - previous;
  if (difference > 0) return { label: "Aumentou", detail: `+${difference}${unit}`, className: "progress-up" };
  if (difference < 0) return { label: "Reduziu", detail: `${difference}${unit}`, className: "progress-down" };
  return { label: "Manteve", detail: `0${unit}`, className: "progress-neutral" };
}

function getExerciseRecords(studentName, exerciseKey) {
  return groupProgressByExercise(studentName)[exerciseKey]?.records || [];
}

function createProgressBadge(progress) {
  const badge = document.createElement("span");
  badge.className = `load-progress ${progress.className}`;

  const label = document.createElement("strong");
  label.textContent = progress.label;

  const detail = document.createElement("small");
  detail.textContent = progress.detail;

  badge.append(label, detail);
  return badge;
}

function renderPaymentBlockedWorkout(student) {
  workoutSummary.textContent = "Acesso bloqueado por pagamento.";

  const card = document.createElement("article");
  card.className = "payment-blocked-card";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Pagamento";

  const title = document.createElement("h3");
  title.textContent = "Treino temporariamente bloqueado";

  const message = document.createElement("span");
  message.textContent = "Seu acesso ao treino está temporariamente bloqueado. Regularize o pagamento com o Personal João Victor.";

  const status = document.createElement("small");
  status.textContent = `Status atual: ${student.payment}`;

  const button = document.createElement("a");
  button.className = "primary payment-whatsapp-button";
  button.href = whatsappUrl;
  button.target = "_blank";
  button.rel = "noreferrer";
  button.textContent = "Falar no WhatsApp";

  card.append(eyebrow, title, message, status, button);
  currentWorkout.appendChild(card);
}

function renderCurrentWorkout() {
  if (!currentWorkout || !workoutSummary || !workoutTabs || !workoutViewStudent) return;

  const workouts = loadWorkouts();
  const selectedStudent = currentUserType === "student" ? selectedStudentProfile : workoutViewStudent.value;
  if (currentUserType === "student" && workoutViewStudent.value !== selectedStudent) {
    workoutViewStudent.value = selectedStudent;
  }
  const student = loadStudents().find((item) => item.name === selectedStudent);
  const studentWorkouts = workouts[selectedStudent] || [];
  const availableWorkouts = currentUserType === "student"
    ? studentWorkouts.filter((item) => getWorkoutPeriodStatus(item).state === "active")
    : studentWorkouts;
  const initialWorkout = availableWorkouts[0];
  const activeWorkoutId = activeWorkoutByStudent[selectedStudent] || initialWorkout?.id;
  const workout = availableWorkouts.find((item) => item.id === activeWorkoutId) || initialWorkout;

  currentWorkout.innerHTML = "";
  workoutSummary.innerHTML = "";
  workoutTabs.innerHTML = "";

  if (!selectedStudent) {
    workoutSummary.textContent = "Selecione um aluno para visualizar a ficha.";
    currentWorkout.textContent = "Cadastre um aluno para visualizar treinos.";
    return;
  }

  if (currentUserType === "student" && isPaymentBlocked(student)) {
    renderPaymentBlockedWorkout(student);
    return;
  }

  if (!studentWorkouts.length) {
    workoutSummary.textContent = "Nenhuma ficha salva para este aluno ainda.";
    currentWorkout.textContent = "Nenhuma ficha salva para este aluno ainda.";
    return;
  }

  if (!availableWorkouts.length) {
    const scheduledWorkout = studentWorkouts.find((item) => getWorkoutPeriodStatus(item).state === "scheduled");
    workoutSummary.textContent = scheduledWorkout
      ? `Ficha programada para iniciar em ${scheduledWorkout.startDate}.`
      : "Nenhuma ficha ativa no momento.";
    currentWorkout.textContent = "Nenhuma ficha ativa no momento. Fale com o Personal Joao Victor.";
    if (scheduledWorkout) {
      const status = getWorkoutPeriodStatus(scheduledWorkout);
      workoutTabs.appendChild(createWorkoutStatusBadge(status));
    }
    return;
  }

  activeWorkoutByStudent[selectedStudent] = workout.id;

  availableWorkouts.forEach((studentWorkout) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.dataset.workoutTab = studentWorkout.id;
    tab.className = studentWorkout.id === workout.id ? "active" : "";
    tab.textContent = studentWorkout.title;
    workoutTabs.appendChild(tab);
  });

  const summaryHeader = document.createElement("div");
  summaryHeader.className = "workout-summary-header";

  const summaryKicker = document.createElement("span");
  summaryKicker.textContent = "Ficha de Treino";

  const summaryTitle = document.createElement("strong");
  summaryTitle.textContent = workout.title;

  summaryHeader.append(summaryKicker, summaryTitle);

  const meta = document.createElement("div");
  meta.className = "workout-meta";

  const goal = document.createElement("span");
  const goalLabel = document.createElement("strong");
  goalLabel.textContent = "Objetivo";
  const goalText = document.createElement("small");
  goalText.textContent = workout.goal;
  goal.append(goalLabel, goalText);

  const frequency = document.createElement("span");
  const frequencyLabel = document.createElement("strong");
  frequencyLabel.textContent = "Frequencia";
  const frequencyText = document.createElement("small");
  frequencyText.textContent = workout.frequency;
  frequency.append(frequencyLabel, frequencyText);

  const startDate = document.createElement("span");
  const startDateLabel = document.createElement("strong");
  startDateLabel.textContent = "Inicio";
  const startDateText = document.createElement("small");
  startDateText.textContent = workout.startDate;
  startDate.append(startDateLabel, startDateText);

  const dueDate = document.createElement("span");
  const dueDateLabel = document.createElement("strong");
  dueDateLabel.textContent = "Validade";
  const dueDateText = document.createElement("small");
  dueDateText.textContent = workout.dueDate;
  dueDate.append(dueDateLabel, dueDateText);

  const expiration = getWorkoutPeriodStatus(workout);
  const expirationCard = document.createElement("span");
  expirationCard.className = `workout-expiration-card ${expiration.className}`;
  const expirationLabel = document.createElement("strong");
  expirationLabel.textContent = expiration.label;
  const expirationText = document.createElement("small");
  expirationText.textContent = expiration.detail;
  expirationCard.append(expirationLabel, expirationText);

  const notes = document.createElement("span");
  notes.className = "workout-notes-card";
  const notesLabel = document.createElement("strong");
  notesLabel.textContent = "Observacoes do personal";
  const notesText = document.createElement("small");
  notesText.textContent = workout.notes;
  notes.append(notesLabel, notesText);

  meta.append(goal, frequency, startDate, dueDate, expirationCard, notes);
  workoutSummary.append(summaryHeader, meta);

  const list = document.createElement("div");
  list.className = "student-exercise-list";

  const sessionTabs = document.createElement("div");
  sessionTabs.className = "workout-tabs training-tabs";
  const sessions = workout.sessions?.length ? workout.sessions : [{ id: createId(), title: "Treino principal", exercises: [] }];
  const activeSessionId = activeSessionByWorkout[workout.id] || sessions[0]?.id;
  const activeSession = sessions.find((session) => session.id === activeSessionId) || sessions[0];
  activeSessionByWorkout[workout.id] = activeSession?.id;

  sessions.forEach((session) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.sessionTab = session.id;
    button.className = session.id === activeSession?.id ? "active" : "";
    button.textContent = session.title;
    sessionTabs.appendChild(button);
  });

  currentWorkout.appendChild(sessionTabs);

  const visibleEntries = getWorkoutExerciseEntries({ ...workout, sessions })
    .filter((entry) => entry.session.id === activeSession?.id)
  if (!visibleEntries.length) {
    list.textContent = "Nenhum exercicio cadastrado neste treino.";
  }

  visibleEntries.forEach(({ exercise: normalizedExercise, index: flatIndex }) => {
    const exerciseKey = getExerciseKey(workout.id, normalizedExercise.name, flatIndex);
    const records = getExerciseRecords(selectedStudent, exerciseKey);
    const lastRecord = records[records.length - 1];
    const progress = getProgressFromRecords(records);
    const card = document.createElement("article");
    card.className = "student-exercise-card";

    const header = document.createElement("div");
    header.className = "student-exercise-card-head";

    const title = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = normalizedExercise.name;
    const details = document.createElement("small");
    details.textContent = `${normalizedExercise.sets || "-"} series | ${normalizedExercise.reps || "-"} reps | descanso ${normalizedExercise.rest || "-"}`;
    title.append(name, details);
    header.append(title, createProgressBadge(progress));

    const form = document.createElement("div");
    form.className = "load-entry-form";
    form.dataset.studentName = selectedStudent;
    form.dataset.workoutId = workout.id;
    form.dataset.workoutTitle = workout.title;
    form.dataset.exerciseKey = exerciseKey;
    form.dataset.exerciseName = normalizedExercise.name;
    form.dataset.sets = normalizedExercise.sets || "";
    form.dataset.reps = normalizedExercise.reps || "";

    const loadInput = document.createElement("input");
    loadInput.placeholder = "Carga atual";
    loadInput.value = "";
    loadInput.dataset.loadInput = "true";

    const noteInput = document.createElement("input");
    noteInput.placeholder = "Observacao opcional";
    noteInput.dataset.loadNote = "true";

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "primary";
    saveButton.dataset.saveLoad = "true";
    saveButton.textContent = "Salvar carga";

    form.append(loadInput, noteInput, saveButton);

    const last = document.createElement("small");
    last.className = "last-load-note";
    last.textContent = lastRecord ? `Ultima carga: ${lastRecord.load} em ${lastRecord.date}` : "Nenhuma carga registrada ainda.";

    card.append(header, form, last);
    list.appendChild(card);
  });

  currentWorkout.append(list);
  currentWorkout.appendChild(createWorkoutFeedbackPanel(selectedStudent, workout));
  renderStudentLoadEvolution();
  renderAdminLoadEvolution();
}

function createWorkoutFeedbackPanel(studentName, workout) {
  const panel = document.createElement("section");
  panel.className = "workout-feedback-panel";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "primary";
  toggle.textContent = "Concluir treino";

  const form = document.createElement("form");
  form.className = "workout-feedback-form";
  form.hidden = true;
  form.dataset.studentName = studentName;
  form.dataset.workoutId = workout.id;
  form.dataset.workoutTitle = workout.title;

  const title = document.createElement("div");
  title.innerHTML = "<p class=\"eyebrow\">Feedback</p><h3>Como foi seu treino hoje?</h3>";

  const rating = document.createElement("div");
  rating.className = "feedback-rating";
  [1, 2, 3, 4, 5].forEach((value) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "rating";
    input.value = String(value);
    input.required = true;
    label.append(input, document.createTextNode(`★ ${value}`));
    rating.appendChild(label);
  });

  const pain = document.createElement("div");
  pain.className = "feedback-pain";
  pain.innerHTML = `
    <span>Sentiu alguma dor?</span>
    <label><input type="radio" name="pain" value="nao" checked> Nao</label>
    <label><input type="radio" name="pain" value="sim"> Sim</label>
  `;

  const painLocation = document.createElement("label");
  painLocation.textContent = "Local da dor";
  const painInput = document.createElement("input");
  painInput.name = "painLocation";
  painInput.placeholder = "Ex: ombro, joelho, lombar";
  painLocation.appendChild(painInput);

  const note = document.createElement("label");
  note.textContent = "Observacoes";
  const textarea = document.createElement("textarea");
  textarea.name = "note";
  textarea.placeholder = "Ex: Treino excelente, aumentar carga do supino, dor no ombro...";
  note.appendChild(textarea);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "primary";
  submit.textContent = "Finalizar treino";

  toggle.addEventListener("click", () => {
    form.hidden = false;
    toggle.hidden = true;
  });

  form.append(title, rating, pain, painLocation, note, submit);
  panel.append(toggle, form);
  return panel;
}

function groupProgressByExercise(studentName) {
  const groups = {};
  const studentWorkouts = loadWorkouts()[studentName] || [];

  studentWorkouts.forEach((workout) => {
    getWorkoutExerciseEntries(workout).forEach(({ session, exercise: normalizedExercise, index }) => {
      const prescribedLoad = getPrescribedLoad(normalizedExercise);
      if (!prescribedLoad) return;

      const exerciseKey = getExerciseKey(workout.id, normalizedExercise.name, index);
      groups[exerciseKey] = {
        exerciseName: normalizedExercise.name,
        workoutTitle: `${workout.title} | ${session.title}`,
        records: [
          {
            studentName,
            workoutId: workout.id,
            workoutTitle: workout.title,
            exerciseKey,
            exerciseName: normalizedExercise.name,
            load: prescribedLoad,
            sets: normalizedExercise.sets || "",
            reps: normalizedExercise.reps || "",
            note: "Carga prescrita pelo personal",
            date: "Prescrito",
            timestamp: 0,
            prescribed: true,
          },
        ],
      };
    });
  });

  loadProgressRecords()
    .filter((record) => record.studentName === studentName)
    .sort((a, b) => a.timestamp - b.timestamp)
    .forEach((record) => {
      if (!groups[record.exerciseKey]) {
        groups[record.exerciseKey] = {
          exerciseName: record.exerciseName,
          workoutTitle: record.workoutTitle,
          records: [],
        };
      }

      groups[record.exerciseKey].records.push(record);
    });

  return groups;
}

function renderLoadHistory(container, studentName) {
  container.innerHTML = "";

  if (!studentName) {
    container.textContent = "Selecione um aluno para visualizar a evolucao.";
    return;
  }

  const groups = Object.values(groupProgressByExercise(studentName));

  if (!groups.length) {
    container.textContent = "Nenhuma carga registrada ainda.";
    return;
  }

  groups.forEach((group) => {
    const card = document.createElement("article");
    card.className = "load-history-card";

    const head = document.createElement("div");
    head.className = "load-history-head";

    const title = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = group.exerciseName;
    const workout = document.createElement("small");
    workout.textContent = group.workoutTitle;
    title.append(name, workout);

    head.append(title, createProgressBadge(getProgressFromRecords(group.records)));

    const list = document.createElement("ul");
    group.records.forEach((record) => {
      const item = document.createElement("li");
      const load = document.createElement("span");
      load.textContent = `${record.load} - ${record.date}`;
      item.appendChild(load);

      if (record.note) {
        const note = document.createElement("small");
        note.textContent = record.note;
        item.appendChild(note);
      }

      list.appendChild(item);
    });

    card.append(head, list);
    container.appendChild(card);
  });
}

function renderStudentLoadEvolution() {
  if (!studentLoadExercise || !studentLoadChart || !studentLoadChartTitle || !studentLoadChartSubtitle || !studentLoadChartBadge || !studentLoadList || !workoutViewStudent) return;

  const studentName = workoutViewStudent.value;
  const groups = Object.entries(groupProgressByExercise(studentName));
  const selectedExercise = studentLoadExercise.value;

  studentLoadExercise.replaceChildren();
  studentLoadChart.innerHTML = "";
  studentLoadChartBadge.innerHTML = "";
  studentLoadList.innerHTML = "";

  if (!studentName) {
    studentLoadChartTitle.textContent = "Evolucao";
    studentLoadChartSubtitle.textContent = "Selecione um aluno para visualizar.";
    return;
  }

  if (!groups.length) {
    studentLoadChartTitle.textContent = "Sem registros";
    studentLoadChartSubtitle.textContent = "Salve uma carga dentro do treino para gerar o grafico.";
    const option = document.createElement("option");
    option.textContent = "Nenhum exercicio registrado";
    option.value = "";
    studentLoadExercise.appendChild(option);
    return;
  }

  groups.forEach(([exerciseKey, group]) => {
    const option = document.createElement("option");
    option.value = exerciseKey;
    option.textContent = group.exerciseName;
    studentLoadExercise.appendChild(option);
  });

  const activeKey = groups.some(([exerciseKey]) => exerciseKey === selectedExercise) ? selectedExercise : groups[0][0];
  studentLoadExercise.value = activeKey;
  const group = Object.fromEntries(groups)[activeKey];
  const progress = getProgressFromRecords(group.records);

  studentLoadChartTitle.textContent = group.exerciseName;
  studentLoadChartSubtitle.textContent = group.workoutTitle;
  studentLoadChartBadge.appendChild(createProgressBadge(progress));
  renderLoadChart(studentLoadChart, group.records);
  renderSingleExerciseHistory(studentLoadList, group.records);
}

function renderAdminLoadEvolution() {
  if (!adminLoadHistory || !adminLoadStudent) return;
  renderLoadHistory(adminLoadHistory, adminLoadStudent.value);
}

function fillAdminEvolutionExercises() {
  if (!adminEvolutionExercise || !adminEvolutionStudent) return;
  const selected = adminEvolutionExercise.value;
  const groups = Object.entries(groupProgressByExercise(adminEvolutionStudent.value));
  adminEvolutionExercise.replaceChildren();

  if (!groups.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Nenhum exercicio";
    adminEvolutionExercise.appendChild(option);
    return;
  }

  groups.forEach(([key, group]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = group.exerciseName;
    adminEvolutionExercise.appendChild(option);
  });
  adminEvolutionExercise.value = groups.some(([key]) => key === selected) ? selected : groups[0][0];
}

function renderAdminEvolution() {
  if (!adminEvolutionStudent || !adminEvolutionExercise || !adminEvolutionChart) return;

  const students = loadStudents();
  const selectedStudent = adminEvolutionStudent.value || students[0]?.name || "";
  if (adminEvolutionStudent.options.length !== students.length) {
    const previous = adminEvolutionStudent.value;
    adminEvolutionStudent.replaceChildren();
    students.forEach((student) => {
      const option = document.createElement("option");
      option.value = student.name;
      option.textContent = student.name;
      adminEvolutionStudent.appendChild(option);
    });
    adminEvolutionStudent.value = students.some((student) => student.name === previous) ? previous : selectedStudent;
  }

  fillAdminEvolutionExercises();
  const studentName = adminEvolutionStudent.value;
  const groups = Object.entries(groupProgressByExercise(studentName));
  const activeKey = adminEvolutionExercise.value;
  const group = Object.fromEntries(groups)[activeKey];

  adminEvolutionChart.innerHTML = "";
  adminEvolutionChartBadge.innerHTML = "";
  if (!group) {
    safeSetText(adminEvolutionChartTitle, "Sem dados de carga");
    safeSetText(adminEvolutionChartSubtitle, "Selecione um aluno com cargas registradas.");
  } else {
    safeSetText(adminEvolutionChartTitle, group.exerciseName);
    safeSetText(adminEvolutionChartSubtitle, group.workoutTitle);
    adminEvolutionChartBadge.appendChild(createProgressBadge(getProgressFromRecords(group.records)));
    renderLoadChart(adminEvolutionChart, group.records);
  }

  renderPersonalRecords(studentName, activeKey);
  renderAdherenceSummary(studentName);
  renderAdminFeedbacks(studentName);
}

function getFeedbackForLoadRecord(studentName, record) {
  const feedbacks = loadWorkoutFeedbacks()
    .filter((feedback) => feedback.studentName === studentName)
    .filter((feedback) => !record.workoutId || feedback.workoutId === record.workoutId)
    .sort((a, b) => b.timestamp - a.timestamp);

  if (!feedbacks.length) return null;
  return feedbacks.find((feedback) => feedback.date === record.date) || feedbacks[0];
}

function renderPersonalRecords(studentName, exerciseKey) {
  if (!adminPersonalRecords) return;
  adminPersonalRecords.innerHTML = "";

  if (!studentName || !exerciseKey) {
    adminPersonalRecords.textContent = "Selecione um aluno e um exercicio para visualizar recordes.";
    return;
  }

  const group = groupProgressByExercise(studentName)[exerciseKey];
  if (!group) {
    adminPersonalRecords.textContent = "Nenhum registro para este exercicio.";
    return;
  }

  const numericRecords = group.records
    .map((record) => ({ record, value: parseLoad(record.load) }))
    .filter((item) => item.value !== null);

  const executedRecords = numericRecords.filter((item) => !item.record.prescribed);
  const recordPool = executedRecords.length ? executedRecords : numericRecords;
  if (!recordPool.length) {
    adminPersonalRecords.textContent = "Nenhuma carga numerica registrada para este exercicio.";
    return;
  }

  const best = recordPool.reduce((winner, item) => (item.value > winner.value ? item : winner), recordPool[0]);
  const feedback = getFeedbackForLoadRecord(studentName, best.record);
  const history = [...recordPool]
    .sort((a, b) => (b.record.timestamp || 0) - (a.record.timestamp || 0))
    .slice(0, 5);

  const card = document.createElement("article");
  card.className = "personal-record-card";

  const title = document.createElement("div");
  title.className = "load-history-head";
  title.innerHTML = `<div><strong>${group.exerciseName}</strong><small>${studentName}</small></div><span class="status-ok">Recorde</span>`;

  const metrics = document.createElement("div");
  metrics.className = "record-metrics-grid";
  [
    ["Maior carga registrada", `${best.value.toLocaleString("pt-BR")} kg`],
    ["Data do recorde", best.record.date || "-"],
    ["Treino", best.record.workoutTitle || group.workoutTitle || "-"],
    ["Series e repeticoes", `${best.record.sets || "-"} x ${best.record.reps || "-"}`],
  ].forEach(([label, value]) => {
    metrics.appendChild(createAdminMetric(label, value));
  });

  const note = document.createElement("div");
  note.className = "record-feedback-note";
  note.innerHTML = `<strong>Observacao/feedback</strong><span>${feedback?.note || feedback?.painLocation || best.record.note || "Nenhuma observacao vinculada a este recorde."}</span>`;

  const historyTitle = document.createElement("strong");
  historyTitle.textContent = "Ultimos registros deste exercicio";
  const historyList = document.createElement("div");
  historyList.className = "record-history-list";
  history.forEach(({ record }) => {
    const item = document.createElement("div");
    item.className = "evolution-mini-row";
    item.innerHTML = `<strong>${record.date}</strong><span>${record.load} | ${record.sets || "-"} series | ${record.reps || "-"} reps</span>`;
    historyList.appendChild(item);
  });

  card.append(title, metrics, note, historyTitle, historyList);
  adminPersonalRecords.appendChild(card);
}

function renderAdherenceSummary(studentName) {
  if (!adminAdherenceSummary) return;
  adminAdherenceSummary.innerHTML = "";
  const month = new Date().toISOString().slice(0, 7);
  const feedbacks = loadWorkoutFeedbacks().filter((item) => item.studentName === studentName && new Date(item.timestamp).toISOString().slice(0, 7) === month);
  const checkins = loadCheckins().filter((item) => item.studentName === studentName && (item.month === month || new Date(item.timestamp || Date.now()).toISOString().slice(0, 7) === month));
  const prescribed = (loadWorkouts()[studentName] || []).reduce((total, workout) => total + (workout.sessions?.length || 1), 0);
  const completed = feedbacks.length;
  const adherence = prescribed ? Math.min(100, Math.round((completed / prescribed) * 100)) : 0;

  [
    ["Treinos concluidos no mes", completed],
    ["Treinos prescritos", prescribed],
    ["Adesao", `${adherence}%`],
    ["Check-ins realizados", checkins.filter(isConsumedLesson).length],
  ].forEach(([label, value]) => {
    adminAdherenceSummary.appendChild(createAdminMetric(label, value));
  });
}

function renderAdminFeedbacks(studentName) {
  if (!adminFeedbackHistory || !adminFeedbackNotes) return;
  const feedbacks = loadWorkoutFeedbacks()
    .filter((feedback) => !studentName || feedback.studentName === studentName)
    .sort((a, b) => b.timestamp - a.timestamp);

  adminFeedbackHistory.innerHTML = "";
  adminFeedbackNotes.innerHTML = "";

  if (!feedbacks.length) {
    adminFeedbackHistory.textContent = "Nenhum feedback registrado ainda.";
    adminFeedbackNotes.textContent = "Nenhuma observacao enviada.";
    return;
  }

  feedbacks.forEach((feedback) => {
    const item = document.createElement("article");
    item.className = "feedback-card";
    item.innerHTML = `<strong>${feedback.date} | ${feedback.workoutTitle}</strong><span>${feedback.studentName} | Nota ${feedback.rating || "-"} | Dor: ${feedback.pain ? feedback.painLocation || "sim" : "nao"}</span><small>${feedback.note || "Sem observacao."}</small>`;
    adminFeedbackHistory.appendChild(item);

    if (feedback.note || feedback.painLocation) {
      const note = document.createElement("article");
      note.className = "feedback-card";
      note.innerHTML = `<strong>${feedback.studentName} | ${feedback.date}</strong><small>${feedback.note || feedback.painLocation}</small>`;
      adminFeedbackNotes.appendChild(note);
    }
  });
}

function renderLoadChart(container, records) {
  container.innerHTML = "";

  const numericRecords = records
    .map((record) => ({ record, value: parseLoad(record.load) }))
    .filter((item) => item.value !== null);

  const values = numericRecords.map((item) => item.value);
  if (!values.length) {
    container.textContent = "Registros sem carga numerica para montar o grafico.";
    return;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const initial = values[0];
  const current = values[values.length - 1];
  const best = max;
  const percent = initial ? ((current - initial) / initial) * 100 : 0;

  const chartArea = document.createElement("div");
  chartArea.className = "load-chart-area";

  const axis = document.createElement("div");
  axis.className = "load-chart-axis";
  [max, (max + min) / 2, min].forEach((value) => {
    const tick = document.createElement("span");
    tick.textContent = `${Number(value.toFixed(1)).toLocaleString("pt-BR")} kg`;
    axis.appendChild(tick);
  });

  const bars = document.createElement("div");
  bars.className = "load-chart-bars";

  const tooltip = document.createElement("div");
  tooltip.className = "load-chart-tooltip";
  tooltip.hidden = true;

  records.forEach((record) => {
    const value = parseLoad(record.load);
    const bar = document.createElement("div");
    bar.className = "load-chart-bar";
    const height = value === null ? 12 : 28 + ((value - min) / range) * 68;
    bar.style.setProperty("--bar-height", `${height}%`);

    const fill = document.createElement("span");
    fill.tabIndex = 0;
    fill.setAttribute("role", "button");
    fill.setAttribute("aria-label", `${record.exerciseName || "Exercicio"} ${record.date} ${record.load}`);
    const load = document.createElement("strong");
    load.textContent = record.load;
    const date = document.createElement("small");
    date.textContent = formatShortChartDate(record.date);

    const showTooltip = () => {
      tooltip.innerHTML = "";
      [
        record.exerciseName || "Exercicio",
        `Data: ${record.date}`,
        `Carga: ${record.load}`,
        `Series: ${record.sets || "-"}`,
        `Repeticoes: ${record.reps || "-"}`,
      ].forEach((text, index) => {
        const item = document.createElement(index === 0 ? "strong" : "span");
        item.textContent = text;
        tooltip.appendChild(item);
      });
      tooltip.hidden = false;
    };

    fill.addEventListener("click", showTooltip);
    fill.addEventListener("focus", showTooltip);

    bar.append(fill, load, date);
    bars.appendChild(bar);
  });

  chartArea.append(axis, bars, tooltip);

  const summary = document.createElement("div");
  summary.className = "load-chart-summary";
  [
    ["Carga inicial", `${Number(initial.toFixed(1)).toLocaleString("pt-BR")} kg`],
    ["Carga atual", `${Number(current.toFixed(1)).toLocaleString("pt-BR")} kg`],
    ["Maior carga", `${Number(best.toFixed(1)).toLocaleString("pt-BR")} kg`],
    ["Evolucao em %", `${percent >= 0 ? "+" : ""}${Number(percent.toFixed(1)).toLocaleString("pt-BR")}%`],
  ].forEach(([label, value]) => {
    const card = document.createElement("article");
    const small = document.createElement("small");
    small.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    card.append(small, strong);
    summary.appendChild(card);
  });

  container.append(chartArea, summary);
}

function formatShortChartDate(dateText) {
  const text = String(dateText || "");
  if (/prescrito/i.test(text)) return "Presc.";
  const match = text.match(/(\d{1,2})[/-](\d{1,2})(?:[/-]\d{2,4})?/);
  if (!match) return text;
  return `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}`;
}

function renderSingleExerciseHistory(container, records) {
  container.innerHTML = "";

  const card = document.createElement("article");
  card.className = "load-history-card";
  const list = document.createElement("ul");

  records.forEach((record) => {
    const item = document.createElement("li");
    const load = document.createElement("span");
    load.textContent = `${record.date} | ${record.load}`;
    item.appendChild(load);

    if (record.note) {
      const note = document.createElement("small");
      note.textContent = record.note;
      item.appendChild(note);
    }

    list.appendChild(item);
  });

  card.appendChild(list);
  container.appendChild(card);
}

function getStudentAssessments(studentName) {
  return loadAssessments()
    .filter((assessment) => assessment.studentName === studentName)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function getMetricComparison(current, previous, key, suffix = "") {
  if (!previous) return "Primeira avaliacao";

  const currentValue = parseLoad(current[key]);
  const previousValue = parseLoad(previous[key]);
  if (currentValue === null || previousValue === null) return "Sem comparacao";

  const difference = currentValue - previousValue;
  if (difference > 0) return `+${difference}${suffix}`;
  if (difference < 0) return `${difference}${suffix}`;
  return `0${suffix}`;
}

function createAssessmentSummaryCard(label, value, comparison) {
  const card = document.createElement("article");
  card.className = "assessment-metric-card";

  const title = document.createElement("span");
  title.textContent = label;

  const main = document.createElement("strong");
  main.textContent = value || "-";

  const diff = document.createElement("small");
  diff.textContent = comparison;

  card.append(title, main, diff);
  return card;
}

function createAssessmentHistoryCard(assessment, previous) {
  const card = document.createElement("article");
  card.className = "assessment-history-card";

  const head = document.createElement("div");
  head.className = "load-history-head";

  const title = document.createElement("div");
  const date = document.createElement("strong");
  date.textContent = assessment.date;
  const subtitle = document.createElement("small");
  subtitle.textContent = previous ? "Comparada com a avaliacao anterior" : "Primeira avaliacao registrada";
  title.append(date, subtitle);
  head.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "assessment-mini-grid";
  [
    ["Peso", assessment.weight, getMetricComparison(assessment, previous, "weight", "kg")],
    ["Gordura", assessment.fat, getMetricComparison(assessment, previous, "fat", "%")],
    ["Massa muscular", assessment.muscle, getMetricComparison(assessment, previous, "muscle", "kg")],
    ["IMC", assessment.imc, getMetricComparison(assessment, previous, "imc")],
  ].forEach(([label, value, comparison]) => {
    grid.appendChild(createAssessmentSummaryCard(label, value, comparison));
  });

  const notes = document.createElement("p");
  notes.textContent = assessment.notes || "Sem observacoes.";

  card.append(head, grid, notes);

  if (assessment.attachment?.dataUrl) {
    const attachment = document.createElement("a");
    attachment.href = assessment.attachment.dataUrl;
    attachment.target = "_blank";
    attachment.rel = "noreferrer";
    attachment.textContent = `Abrir anexo: ${assessment.attachment.name}`;
    card.appendChild(attachment);
  }

  return card;
}

function renderAssessmentHistory(container, assessments) {
  if (!container) return;
  container.innerHTML = "";

  if (!assessments.length) {
    container.textContent = "Nenhuma avaliacao fisica registrada ainda.";
    return;
  }

  [...assessments].reverse().forEach((assessment, index, reversed) => {
    container.appendChild(createAssessmentHistoryCard(assessment, reversed[index + 1]));
  });
}

function renderStudentAssessments() {
  if (!studentAssessmentSummary || !studentAssessmentHistory || !workoutViewStudent) return;

  const assessments = getStudentAssessments(workoutViewStudent.value);
  studentAssessmentSummary.innerHTML = "";

  if (!assessments.length) {
    studentAssessmentSummary.textContent = "Nenhuma avaliacao fisica registrada ainda.";
    studentAssessmentHistory.innerHTML = "";
    return;
  }

  const latest = assessments[assessments.length - 1];
  const previous = assessments[assessments.length - 2];

  [
    ["Peso", latest.weight, getMetricComparison(latest, previous, "weight", "kg")],
    ["Gordura corporal", latest.fat, getMetricComparison(latest, previous, "fat", "%")],
    ["Massa muscular", latest.muscle, getMetricComparison(latest, previous, "muscle", "kg")],
    ["IMC", latest.imc, getMetricComparison(latest, previous, "imc")],
  ].forEach(([label, value, comparison]) => {
    studentAssessmentSummary.appendChild(createAssessmentSummaryCard(label, value, comparison));
  });

  renderAssessmentHistory(studentAssessmentHistory, assessments);
}

function renderAdminAssessments() {
  if (!adminAssessmentHistory || !assessmentStudent) return;
  renderAssessmentHistory(adminAssessmentHistory, getStudentAssessments(assessmentStudent.value));
}

function renderStudentCheckinStatus() {
  if (!studentCheckinStatus || !studentCheckinButton || !workoutViewStudent) return;

  const studentName = workoutViewStudent.value;
  const activePackage = getActivePackage(studentName);
  const todayLesson = activePackage ? getTodayPackageLesson(activePackage) : null;
  const todayCheckin = getTodayStudentCheckin(studentName, activePackage?.id || "");
  if (!activePackage) {
    studentCheckinStatus.textContent = "Nenhum pacote ativo. Fale com o Personal Joao Victor.";
    studentCheckinButton.textContent = "Sem pacote ativo";
    studentCheckinButton.disabled = true;
    return;
  }

  if (!todayLesson) {
    studentCheckinStatus.textContent = "Nao ha aula prevista para hoje no pacote ativo.";
    studentCheckinButton.textContent = "Sem aula hoje";
    studentCheckinButton.disabled = true;
    return;
  }

  if (todayCheckin) {
    studentCheckinStatus.textContent = todayCheckin.status === "realizado"
      ? `Check-in de hoje feito as ${todayCheckin.time}.`
      : getCheckinStatusLabel(todayCheckin);
    studentCheckinButton.textContent = todayCheckin.status === "realizado" ? "Check-in feito hoje" : "Aula cancelada";
    studentCheckinButton.disabled = true;
    return;
  }

  studentCheckinStatus.textContent = "Registre sua presenca na aula presencial.";
  studentCheckinButton.textContent = "Fazer check-in de hoje";
  studentCheckinButton.disabled = false;
}

function fillManualCheckinPackageSelect() {
  if (!manualCheckinPackage || !manualCheckinStudent) return;

  const selectedPackage = manualCheckinPackage.value;
  const packages = loadClassPackages().filter((classPackage) => classPackage.studentName === manualCheckinStudent.value);
  manualCheckinPackage.replaceChildren();

  if (!packages.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Nenhum pacote salvo";
    manualCheckinPackage.appendChild(option);
    return;
  }

  packages.forEach((classPackage) => {
    const option = document.createElement("option");
    option.value = classPackage.id;
    option.textContent = classPackage.name;
    manualCheckinPackage.appendChild(option);
  });

  manualCheckinPackage.value = packages.some((classPackage) => classPackage.id === selectedPackage) ? selectedPackage : packages[0].id;
}

function fillPackageForm(classPackage = null, studentName = "") {
  if (!packageForm) return;

  editingPackageId = classPackage?.id || null;
  if (packageStudent) packageStudent.value = classPackage?.studentName || studentName || packageStudent.value;
  if (packageName) packageName.value = classPackage?.name || "";
  if (packageTotal) packageTotal.value = classPackage?.total || "";
  if (packageStart) packageStart.value = classPackage?.startDate || "";
  if (packageEnd) packageEnd.value = classPackage?.endDate || "";
  if (packageDays) packageDays.value = classPackage?.days || "";
  if (packageTime) packageTime.value = classPackage?.time || "";
  if (packageNotes) packageNotes.value = classPackage?.notes || "";
}

function createPackageSummaryCard(classPackage) {
  const status = getPackageStatus(classPackage);
  const card = document.createElement("article");
  card.className = "package-card";

  const head = document.createElement("div");
  head.className = "load-history-head";
  const title = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = classPackage.name;
  const detail = document.createElement("small");
  detail.textContent = `${classPackage.studentName} | ${classPackage.days} | ${classPackage.time}`;
  title.append(name, detail);

  const badge = document.createElement("span");
  badge.className = status.remaining <= 0 ? "status-pending" : "status-ok";
  badge.textContent = status.label;
  head.append(title, badge);

  const meta = document.createElement("div");
  meta.className = "package-meta";
  [
    ["Total", `${classPackage.total} aulas`],
    ["Realizadas", status.completed],
    ["Restantes", status.remaining],
    ["Periodo", `${classPackage.startDate} a ${classPackage.endDate}`],
  ].forEach(([label, value]) => {
    const item = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = label;
    const small = document.createElement("small");
    small.textContent = value;
    item.append(strong, small);
    meta.appendChild(item);
  });

  const notes = document.createElement("p");
  notes.textContent = classPackage.notes || "Sem observacoes.";
  card.append(head, meta, notes);
  return card;
}

function renderPackageAdminList() {
  if (!packageAdminList) return;

  const selectedStudent = packageViewStudent?.value || "";
  packageAdminList.innerHTML = "";

  if (!selectedStudent) {
    if (packageEmptyState) packageEmptyState.hidden = false;
    return;
  }

  if (packageEmptyState) packageEmptyState.hidden = true;

  const packages = loadClassPackages()
    .filter((classPackage) => classPackage.studentName === selectedStudent)
    .sort((a, b) => b.createdAt - a.createdAt);

  if (!packages.length) {
    packageAdminList.textContent = "Nenhum pacote cadastrado para este aluno.";
    return;
  }

  packages.forEach((classPackage) => {
    const status = getPackageStatus(classPackage);
    const schedule = generatePackageSchedule(classPackage);
    const usedDateKeys = new Set(loadCheckins().filter((checkin) => checkin.packageId === classPackage.id).map((checkin) => checkin.dateKey || ""));
    const nextLesson = schedule.find((lesson) => lesson.dateKey >= getDateKey() && !usedDateKeys.has(lesson.dateKey));
    const card = document.createElement("article");
    card.className = "package-card package-admin-card";

    const head = document.createElement("div");
    head.className = "package-card-summary";

    const title = document.createElement("div");
    const student = document.createElement("small");
    student.textContent = classPackage.studentName;
    const name = document.createElement("strong");
    name.textContent = classPackage.name;
    title.append(student, name);

    const progress = document.createElement("div");
    progress.className = "package-summary-metrics";
    progress.append(
      createAdminMetric("Usadas / total", `${status.completed}/${classPackage.total}`),
      createAdminMetric("Restantes", status.remaining),
      createAdminMetric("Status", status.remaining <= 0 ? "Finalizado" : "Ativo"),
      createAdminMetric("Proxima aula", nextLesson ? `${nextLesson.date} | ${nextLesson.time}` : "Sem aula"),
    );

    head.append(title, progress);

    const actions = document.createElement("div");
    actions.className = "student-actions package-card-actions";
    [
      ["Ver detalhes", "details", "secondary"],
      ["Marcar presenca", "presence", "primary"],
      ["Mais ações", "more", "secondary"],
    ].forEach(([label, action, className]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.dataset.packageListAction = action;
      button.dataset.packageId = classPackage.id;
      button.textContent = label;
      actions.appendChild(button);
    });

    const detail = document.createElement("div");
    detail.className = "admin-package-detail";
    detail.dataset.packageListDetail = classPackage.id;

    card.append(head, actions, detail);
    packageAdminList.appendChild(card);
  });
}

function renderPackageListDetails(classPackage, detail) {
  detail.innerHTML = "";
  const box = document.createElement("div");
  box.className = "package-detail-grid";
  [
    ["Dias", classPackage.days],
    ["Horario", classPackage.time],
    ["Inicio", classPackage.startDate],
    ["Termino", classPackage.endDate],
  ].forEach(([label, value]) => {
    box.appendChild(createAdminMetric(label, value || "-"));
  });

  const historyButton = document.createElement("button");
  historyButton.type = "button";
  historyButton.className = "secondary";
  historyButton.dataset.packageListAction = "history";
  historyButton.dataset.packageId = classPackage.id;
  historyButton.textContent = "Ver historico";

  detail.append(box, historyButton);
}

function renderPackageListHistory(classPackage, detail) {
  detail.innerHTML = "";
  const history = loadCheckins().filter((checkin) => checkin.packageId === classPackage.id).sort((a, b) => b.timestamp - a.timestamp);
  if (!history.length) {
    detail.textContent = "Nenhum registro neste pacote.";
    return;
  }

  history.forEach((record) => {
    const item = document.createElement("article");
    item.className = "checkin-history-card";
    item.classList.toggle("cancel-late", record.status === "cancelada-fora-prazo" || record.status === "falta");
    item.classList.toggle("cancel-ok", record.status === "cancelada-no-prazo");
    item.classList.toggle("checkin-ok", record.status === "realizado");
    item.textContent = `${record.date} as ${record.time} | ${getCheckinStatusLabel(record)}`;
    detail.appendChild(item);
  });
}

function renderPackageListMoreActions(classPackage, detail) {
  detail.innerHTML = "";
  const actions = document.createElement("div");
  actions.className = "student-actions package-more-actions";
  [
    ["Editar pacote", "edit", "primary"],
    ["Excluir pacote", "delete", "secondary danger-action"],
    ["Marcar falta", "absence", "secondary danger-action"],
  ].forEach(([label, action, className]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.dataset.packageListAction = action;
    button.dataset.packageId = classPackage.id;
    button.textContent = label;
    actions.appendChild(button);
  });
  detail.appendChild(actions);
}

function renderCheckinHistory() {
  if (!checkinHistory || !checkinMonthTotal) return;

  const selectedStudent = checkinFilterStudent?.value || "";
  const selectedDate = checkinFilterDate?.value.trim() || "";
  const month = currentMonthKey();
  const checkins = loadCheckins()
    .filter((checkin) => !selectedStudent || checkin.studentName === selectedStudent)
    .filter((checkin) => !selectedDate || checkin.date === selectedDate)
    .sort((a, b) => b.timestamp - a.timestamp);

  const monthlyTotal = loadCheckins().filter((checkin) => checkin.month === month).length;
  checkinMonthTotal.textContent = `Total de presencas no mes: ${monthlyTotal}`;
  checkinHistory.innerHTML = "";

  if (!checkins.length) {
    checkinHistory.textContent = "Nenhum check-in encontrado para este filtro.";
    return;
  }

  checkins.forEach((checkin) => {
    const card = document.createElement("article");
    card.className = "checkin-history-card";
    card.classList.toggle("cancel-late", checkin.status === "cancelada-fora-prazo" || checkin.status === "falta");
    card.classList.toggle("cancel-ok", checkin.status === "cancelada-no-prazo");

    const head = document.createElement("div");
    head.className = "load-history-head";

    const title = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = checkin.studentName;
    const detail = document.createElement("small");
    detail.textContent = `${checkin.date} as ${checkin.time}${checkin.packageName ? ` | ${checkin.packageName}` : ""}`;
    title.append(name, detail);

    const type = document.createElement("span");
    type.className = checkin.status === "cancelada-fora-prazo" || checkin.status === "falta" ? "status-danger" : "status-ok";
    type.textContent = getCheckinStatusLabel(checkin);

    if (checkin.type === "cancelamento de aula") {
      const cancelDetail = document.createElement("small");
      cancelDetail.textContent = `Cancelada em ${checkin.cancellationDate} as ${checkin.cancellationTime} | ${checkin.consumed ? "descontou aula" : "nao descontou aula"}`;
      title.appendChild(cancelDetail);
    } else if (checkin.status === "falta") {
      const absenceDetail = document.createElement("small");
      absenceDetail.textContent = `Falta registrada em ${checkin.absenceDate} as ${checkin.absenceTime} | descontou aula`;
      title.appendChild(absenceDetail);
    }

    head.append(title, type);
    card.appendChild(head);
    checkinHistory.appendChild(card);
  });
}

function renderStudentPackagePanel() {
  if (!studentPackagePanel || !workoutViewStudent) return;

  const studentName = workoutViewStudent.value;
  const activePackage = getActivePackage(studentName);
  const latestPackage = loadClassPackages()
    .filter((classPackage) => classPackage.studentName === studentName)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  studentPackagePanel.innerHTML = "";

  if (!activePackage) {
    if (latestPackage && getPackageStatus(latestPackage).remaining <= 0) {
      studentPackagePanel.appendChild(createPackageSummaryCard(latestPackage));
      const done = document.createElement("article");
      done.className = "package-card";
      done.textContent = "Pacote finalizado.";
      studentPackagePanel.appendChild(done);
      return;
    }

    const empty = document.createElement("article");
    empty.className = "package-card";
    empty.innerHTML = "<strong>Nenhum pacote ativo</strong><span>Fale com o Personal Joao Victor para liberar um pacote de aulas presenciais.</span>";
    studentPackagePanel.appendChild(empty);
    return;
  }

  const schedule = generatePackageSchedule(activePackage);
  const packageRecords = loadCheckins().filter((checkin) => checkin.packageId === activePackage.id);
  const checkins = packageRecords.filter(isConsumedLesson);
  const usedDateKeys = new Set(packageRecords.map((checkin) => checkin.dateKey || ""));
  const todayKey = getDateKey();
  const status = getPackageStatus(activePackage);
  const upcoming = schedule.filter((lesson) => lesson.dateKey >= todayKey && !usedDateKeys.has(lesson.dateKey));
  const nextLesson = upcoming[0];

  const cards = document.createElement("div");
  cards.className = "package-compact-grid";

  const packageCard = createStudentPackageCompactCard("Meu pacote", `${status.completed}/${activePackage.total}`, `${status.remaining} restantes`, status.remaining <= 0 ? "Pacote finalizado" : "Ativo", "Ver detalhes", "details");
  const nextCard = createStudentPackageCompactCard("Proxima aula", nextLesson?.date || "Sem aula prevista", nextLesson?.time || "-", nextLesson?.dateKey === todayKey ? "Hoje" : "Agendada", nextLesson?.dateKey === todayKey ? "Fazer check-in" : "Ver detalhes", nextLesson?.dateKey === todayKey ? "checkin" : "next");
  const historyCard = createStudentPackageCompactCard("Historico", `${packageRecords.length} registros`, "Aulas e cancelamentos", "Check-ins", "Ver historico", "history");

  cards.append(packageCard, nextCard, historyCard);

  const detail = document.createElement("div");
  detail.className = "package-expand-panel";
  detail.dataset.studentPackageDetail = "true";

  studentPackagePanel.append(cards, detail);
}

function createStudentPackageCompactCard(title, main, detail, status, buttonLabel, action) {
  const card = document.createElement("article");
  card.className = "package-compact-card";

  const heading = document.createElement("strong");
  heading.textContent = title;
  const value = document.createElement("span");
  value.textContent = main;
  const small = document.createElement("small");
  small.textContent = detail;
  const badge = document.createElement("em");
  badge.textContent = status;

  const button = document.createElement("button");
  button.type = "button";
  button.className = action === "checkin" ? "primary" : "secondary";
  button.dataset.studentPackageAction = action;
  button.textContent = buttonLabel;

  card.append(heading, value, small, badge, button);
  return card;
}

function renderStudentPackageDetail(action) {
  const detail = studentPackagePanel?.querySelector("[data-student-package-detail]");
  const studentName = workoutViewStudent?.value;
  const activePackage = getActivePackage(studentName);
  if (!detail || !activePackage) return;

  const schedule = generatePackageSchedule(activePackage);
  const packageRecords = loadCheckins().filter((checkin) => checkin.packageId === activePackage.id);
  const checkins = packageRecords.filter(isConsumedLesson);
  const status = getPackageStatus(activePackage);
  const todayKey = getDateKey();
  detail.innerHTML = "";

  if (action === "details") {
    detail.appendChild(createPackageSummaryCard(activePackage));
    return;
  }

  if (action === "next") {
    const list = document.createElement("div");
    list.className = "package-lesson-list";
    schedule
      .filter((lesson) => lesson.dateKey >= todayKey)
      .slice(0, 6)
      .forEach((lesson) => {
        const item = document.createElement("article");
        item.className = "package-lesson";
        const info = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = lesson.date;
        const time = document.createElement("small");
        time.textContent = lesson.time;
        info.append(title, time);

        const actions = document.createElement("div");
        actions.className = "student-actions";
        const existingRecord = getLessonRecord(activePackage.id, lesson.dateKey);
        if (existingRecord) {
          const badge = document.createElement("span");
          badge.className = existingRecord.status === "cancelada-fora-prazo" ? "status-danger" : "status-ok";
          badge.textContent = getCheckinStatusLabel(existingRecord);
          actions.appendChild(badge);
        } else {
          const cancel = document.createElement("button");
          cancel.type = "button";
          cancel.className = "secondary";
          cancel.dataset.cancelLesson = activePackage.id;
          cancel.dataset.lessonDate = lesson.dateKey;
          cancel.textContent = "Cancelar aula";
          actions.appendChild(cancel);
        }

        item.append(info, actions);
        list.appendChild(item);
      });
    detail.appendChild(list);
    return;
  }

  if (action === "history") {
    if (!packageRecords.length) {
      detail.textContent = "Nenhuma aula realizada ainda.";
      return;
    }
    packageRecords
      .sort((a, b) => b.timestamp - a.timestamp)
      .forEach((record) => {
        const card = document.createElement("article");
        card.className = "checkin-history-card";
        card.classList.toggle("cancel-late", record.status === "cancelada-fora-prazo" || record.status === "falta");
        card.classList.toggle("cancel-ok", record.status === "cancelada-no-prazo");
        if (record.type === "cancelamento de aula") {
          card.textContent = `${record.date} as ${record.time} | ${getCheckinStatusLabel(record)} | cancelada em ${record.cancellationDate} as ${record.cancellationTime} | ${record.consumed ? "descontou aula" : "nao descontou aula"}`;
        } else if (record.status === "falta") {
          card.textContent = `${record.date} as ${record.time} | ${getCheckinStatusLabel(record)} | registrada em ${record.absenceDate} as ${record.absenceTime} | descontou aula`;
        } else {
          card.textContent = `${record.date} as ${record.time} | check-in feito por ${record.markedBy || "aluno"}`;
        }
        detail.appendChild(card);
      });
    return;
  }

  if (action === "checkin" && status.remaining > 0) {
    registerPackageCheckin(studentName, activePackage, "aluno");
    renderStudentCheckinStatus();
    renderStudentPackagePanel();
    renderCheckinHistory();
    renderPackageAdminList();
  }
}

function getCurrentStudentWorkout(studentName) {
  const studentWorkouts = loadWorkouts()[studentName] || [];
  const activeWorkouts = currentUserType === "student"
    ? studentWorkouts.filter((workout) => getWorkoutPeriodStatus(workout).state === "active")
    : studentWorkouts;
  const initialWorkout = activeWorkouts[0];
  const activeWorkoutId = activeWorkoutByStudent[studentName] || initialWorkout?.id;
  return activeWorkouts.find((workout) => workout.id === activeWorkoutId) || initialWorkout || null;
}

function createProfileMetric(label, value, detail = "") {
  const card = document.createElement("article");
  card.className = "profile-metric-card";
  const title = document.createElement("span");
  title.textContent = label;
  const main = document.createElement("strong");
  main.textContent = value || "-";
  const small = document.createElement("small");
  small.textContent = detail;
  card.append(title, main, small);
  return card;
}

function getRecentLoadProgressText(studentName) {
  const groups = Object.values(groupProgressByExercise(studentName));
  const latestGroup = groups
    .map((group) => ({
      ...group,
      realRecords: group.records.filter((record) => !record.prescribed),
    }))
    .filter((group) => group.realRecords.length)
    .sort((a, b) => (b.realRecords[b.realRecords.length - 1]?.timestamp || 0) - (a.realRecords[a.realRecords.length - 1]?.timestamp || 0))[0];

  if (!latestGroup) return { title: "Sem registros", detail: "Registre cargas no treino." };

  const progress = getProgressFromRecords(latestGroup.records);
  return { title: progress.detail, detail: `${latestGroup.exerciseName} | ${progress.label}` };
}

function renderStudentProfile() {
  if (!studentProfilePanel || !workoutViewStudent) return;

  const selectedName = currentUserType === "student" ? selectedStudentProfile : workoutViewStudent.value;
  const student = loadStudents().find((item) => item.name === selectedName);
  if (!student) {
    studentProfilePanel.textContent = "Nenhum aluno selecionado.";
    return;
  }

  const workout = getCurrentStudentWorkout(student.name);
  const expiration = workout ? getWorkoutPeriodStatus(workout) : null;
  const assessments = getStudentAssessments(student.name);
  const latestAssessment = assessments[assessments.length - 1];
  const recentProgress = getRecentLoadProgressText(student.name);

  studentProfilePanel.innerHTML = "";

  const hero = document.createElement("section");
  hero.className = "profile-hero-card";

  const avatar = document.createElement("div");
  avatar.className = "profile-avatar";
  avatar.textContent = getInitials(student.name);

  const info = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Aluno";
  const name = document.createElement("h3");
  name.textContent = student.name;
  const plan = document.createElement("span");
  plan.textContent = `${student.plan} | Pagamento ${student.payment}`;
  info.append(eyebrow, name, plan);

  hero.append(avatar, info);

  const grid = document.createElement("div");
  grid.className = "profile-grid";
  grid.append(
    createProfileMetric("Objetivo atual", workout?.goal || "Sem ficha ativa", workout?.title || "Nenhuma ficha selecionada"),
    createProfileMetric("Treinos da ficha", workout?.sessions?.length || "0", workout?.frequency || "Frequencia nao informada"),
    createProfileMetric("Inicio do plano", workout?.startDate || "-", "Data de inicio"),
    createProfileMetric("Vencimento", workout?.dueDate || "-", expiration?.detail || "Sem validade"),
    createProfileMetric("Status da ficha", expiration?.label || "Sem ficha", workout?.title || ""),
    createProfileMetric("Ultima avaliacao", latestAssessment?.date || "Sem avaliacao", latestAssessment ? `${latestAssessment.weight} | ${latestAssessment.fat}` : "Bioimpedancia nao registrada"),
    createProfileMetric("Progresso de carga", recentProgress.title, recentProgress.detail),
  );

  studentProfilePanel.append(hero, grid);
}

function renderWorkouts() {
  if (!workoutList) return;

  const workouts = loadWorkouts();
  workoutList.innerHTML = "";
  let visibleWorkoutCount = 0;

  Object.entries(workouts).forEach(([studentName, studentWorkouts]) => {
    if (selectedAdminWorkoutStudent && studentName !== selectedAdminWorkoutStudent) return;

    studentWorkouts.forEach((workout) => {
      workoutList.appendChild(createWorkoutRow(studentName, workout));
      visibleWorkoutCount += 1;
    });
  });

  if (selectedAdminWorkoutStudent && visibleWorkoutCount === 0) {
    const empty = document.createElement("div");
    empty.className = "table-row workout-row";
    empty.textContent = "Este aluno ainda nao possui fichas salvas.";
    workoutList.appendChild(empty);
  }

  renderWorkoutStudentDirectory();
  renderWorkoutExpirationPanel(workouts);
  fillWorkoutTemplateSelect();
  renderCurrentWorkout();
  renderStudentProfile();
}

function renderWorkoutExpirationPanel(workouts) {
  if (!workoutExpirationPanel) return;
  workoutExpirationPanel.innerHTML = "";

  const title = document.createElement("div");
  title.className = "workout-expiration-title";
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Treinos a vencer";
  const heading = document.createElement("h3");
  heading.textContent = "Alertas de validade";
  title.append(eyebrow, heading);
  workoutExpirationPanel.appendChild(title);

  const alerts = Object.entries(workouts).flatMap(([studentName, studentWorkouts]) =>
    studentWorkouts
      .map((workout) => ({ studentName, workout, status: getWorkoutPeriodStatus(workout) }))
      .filter(({ status }) => status.state === "expired" || (status.state === "active" && status.days !== null && status.days <= 7)),
  );

  if (!alerts.length) {
    const empty = document.createElement("span");
    empty.textContent = "Nenhuma ficha vencida ou vencendo nos proximos 7 dias.";
    workoutExpirationPanel.appendChild(empty);
    return;
  }

  alerts.forEach(({ studentName, workout, status }) => {
    const card = document.createElement("article");
    card.className = `workout-expiration-alert ${status.className}`;

    const title = document.createElement("strong");
    title.textContent = studentName;

    const details = document.createElement("span");
    details.textContent = `${workout.title} | ${workout.dueDate}`;

    card.append(title, details, createWorkoutStatusBadge(status));
    workoutExpirationPanel.appendChild(card);
  });
}

function fillWorkoutTemplateSelect() {
  if (!workoutTemplateSource || !loadWorkoutButton) return;

  const selectedTemplate = workoutTemplateSource.value;
  const workouts = loadWorkouts();
  const templateOptions = Object.entries(workouts).flatMap(([studentName, studentWorkouts]) =>
    studentWorkouts.map((workout) => ({ studentName, workout })),
  );

  workoutTemplateSource.replaceChildren();

  if (!templateOptions.length) {
    const option = document.createElement("option");
    option.textContent = "Nenhuma ficha salva";
    option.value = "";
    workoutTemplateSource.appendChild(option);
    loadWorkoutButton.disabled = true;
    return;
  }

  templateOptions.forEach(({ studentName, workout }) => {
    const option = document.createElement("option");
    option.textContent = `${studentName} - ${workout.title}`;
    option.value = `${studentName}|||${workout.id}`;
    workoutTemplateSource.appendChild(option);
  });

  const fallbackTemplate = `${templateOptions[0].studentName}|||${templateOptions[0].workout.id}`;
  const availableTemplates = templateOptions.map(({ studentName, workout }) => `${studentName}|||${workout.id}`);
  workoutTemplateSource.value = availableTemplates.includes(selectedTemplate) ? selectedTemplate : fallbackTemplate;
  loadWorkoutButton.disabled = false;
}

function resetStudentForm() {
  if (!studentForm) return;
  studentForm.reset();
  if (paymentInput) paymentInput.value = "Em dia";
  if (emailInput) emailInput.value = "";
  if (tempPasswordInput) tempPasswordInput.value = "";
  if (phoneInput) phoneInput.value = "";
  if (birthDateInput) birthDateInput.value = "";
  editingStudentIndex = null;
  safeSetText(saveStudentButton, "Salvar aluno");
  if (cancelEditButton) cancelEditButton.hidden = true;
  nameInput?.focus();
}

function startEditingStudent(index, message = "Editando aluno. Altere os campos e salve.") {
  const students = loadStudents();
  const student = students[index];
  if (!student) return false;

  editingStudentIndex = index;
  nameInput.value = student.name;
  if (emailInput) emailInput.value = student.email || "";
  if (phoneInput) phoneInput.value = student.phone || "";
  if (birthDateInput) birthDateInput.value = student.birthDate || "";
  planInput.value = student.plan;
  valueInput.value = student.value;
  dueInput.value = student.due;
  paymentInput.value = student.payment;
  saveStudentButton.textContent = "Salvar alteracao";
  cancelEditButton.hidden = false;
  nameInput.focus();
  showMessage(message);
  return true;
}

studentForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const students = loadStudents();
  const previousName = editingStudentIndex === null ? "" : students[editingStudentIndex]?.name;
  const student = {
    id: editingStudentIndex === null ? createId() : students[editingStudentIndex]?.id || createId(),
    supabaseUserId: students[editingStudentIndex]?.supabaseUserId || "",
    name: nameInput.value.trim(),
    email: emailInput?.value.trim().toLowerCase() || "",
    phone: phoneInput?.value.trim() || "",
    birthDate: birthDateInput?.value.trim() || "",
    plan: planInput.value.trim(),
    value: valueInput.value.trim(),
    due: dueInput.value.trim(),
    payment: paymentInput.value,
  };

  const duplicateName = students.some((item, index) => item.name.toLowerCase() === student.name.toLowerCase() && index !== editingStudentIndex);
  if (duplicateName) {
    showMessage("Ja existe um aluno com este nome. Use um nome diferente para evitar misturar historicos.", "error");
    nameInput.focus();
    return;
  }

  if (editingStudentIndex === null) {
    students.push(student);
  } else {
    students[editingStudentIndex] = student;
  }

  saveStudents(students);

  if (previousName && previousName !== student.name) {
    syncStudentNameReferences(previousName, student.name);
  }

  renderStudents();
  fillStudentSelects();
  if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
  showMessage("Aluno salvo. Sincronizacao online sera tentada em segundo plano.");
  resetStudentForm();
});

workoutForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const workouts = loadWorkouts();
  const selectedStudent = workoutStudent.value;
  const sessions = collectTrainingSessions();
  if (!selectedStudent || !sessions.length) {
    if (workoutMessage) {
      workoutMessage.textContent = "Selecione um aluno e cadastre pelo menos um exercicio.";
      workoutMessage.classList.add("error");
    }
    return;
  }

  const existingWorkout = editingWorkout
    ? (workouts[editingWorkout.studentName] || []).find((item) => item.id === editingWorkout.id)
    : null;
  const workout = {
    id: editingWorkout?.id || createId(),
    studentName: selectedStudent,
    studentId: getStudentIdByName(selectedStudent),
    title: workoutTitle.value.trim(),
    goal: workoutGoal.value.trim(),
    frequency: workoutFrequency.value.trim(),
    startDate: workoutStartDate.value.trim(),
    dueDate: workoutDueDate.value.trim(),
    notes: workoutNotes.value.trim(),
    createdAt: existingWorkout?.createdAt || Date.now(),
    updatedAt: Date.now(),
    sessions,
    exercises: sessions.flatMap((session) => session.exercises),
  };

  if (editingWorkout) {
    workouts[editingWorkout.studentName] = (workouts[editingWorkout.studentName] || []).filter(
      (item) => item.id !== editingWorkout.id,
    );
  }

  workouts[selectedStudent] = workouts[selectedStudent] || [];
  workouts[selectedStudent].push(workout);

  saveWorkouts(workouts);
  workoutViewStudent.value = selectedStudent;
  activeWorkoutByStudent[selectedStudent] = workout.id;
  renderWorkouts();
  workoutForm.reset();
  resetExerciseRows();
  workoutForm.hidden = true;
  workoutStudent.disabled = false;
  editingWorkout = null;
  saveWorkoutButton.textContent = "Salvar ficha";
  cancelWorkoutEditButton.hidden = true;
});

function readAssessmentAttachment(file) {
  if (!file) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type,
        dataUrl: reader.result,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

assessmentForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const attachment = await readAssessmentAttachment(assessmentFile.files[0]);
  const assessments = loadAssessments();
  assessments.push({
    id: createId(),
    studentName: assessmentStudent.value,
    studentId: getStudentIdByName(assessmentStudent.value),
    date: assessmentDate.value.trim(),
    weight: assessmentWeight.value.trim(),
    fat: assessmentFat.value.trim(),
    muscle: assessmentMuscle.value.trim(),
    imc: assessmentImc.value.trim(),
    notes: assessmentNotes.value.trim(),
    attachment,
    timestamp: Date.now(),
  });

  saveAssessments(assessments);
  assessmentForm.reset();
  assessmentStudent.value = assessments[assessments.length - 1].studentName;
  assessmentDate.value = formatToday();
  renderAdminAssessments();
  if (workoutViewStudent.value === assessmentStudent.value) {
    renderStudentAssessments();
    renderStudentProfile();
  }
});

workoutViewStudent?.addEventListener("change", () => {
  updateStudentHeader();
  renderCurrentWorkout();
  renderStudentAssessments();
});

workoutTabs?.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-workout-tab]");
  if (!tab) return;

  activeWorkoutByStudent[workoutViewStudent.value] = tab.dataset.workoutTab;
  renderCurrentWorkout();
});

currentWorkout?.addEventListener("click", (event) => {
  const sessionTab = event.target.closest("[data-session-tab]");
  if (sessionTab) {
    activeSessionByWorkout[activeWorkoutByStudent[workoutViewStudent.value]] = sessionTab.dataset.sessionTab;
    renderCurrentWorkout();
    return;
  }

  const button = event.target.closest("[data-save-load]");
  if (!button) return;

  const form = button.closest(".load-entry-form");
  const loadInput = form.querySelector("[data-load-input]");
  const noteInput = form.querySelector("[data-load-note]");
  const load = loadInput.value.trim();

  if (!load) {
    loadInput.focus();
    return;
  }

  const records = loadProgressRecords();
  records.push({
    id: createId(),
    studentName: form.dataset.studentName,
    studentId: getStudentIdByName(form.dataset.studentName),
    workoutId: form.dataset.workoutId,
    workoutTitle: form.dataset.workoutTitle,
    exerciseKey: form.dataset.exerciseKey,
    exerciseName: form.dataset.exerciseName,
    load,
    sets: form.dataset.sets || "",
    reps: form.dataset.reps || "",
    note: noteInput.value.trim(),
    date: formatToday(),
    timestamp: Date.now(),
  });

  saveProgressRecords(records);
  loadInput.value = "";
  noteInput.value = "";
  renderCurrentWorkout();
  renderStudentProfile();
});

currentWorkout?.addEventListener("submit", (event) => {
  const form = event.target.closest(".workout-feedback-form");
  if (!form) return;

  event.preventDefault();
  const feedbacks = loadWorkoutFeedbacks();
  const pain = form.querySelector('[name="pain"]:checked')?.value === "sim";
  feedbacks.push({
    id: createId(),
    studentName: form.dataset.studentName,
    studentId: getStudentIdByName(form.dataset.studentName),
    workoutId: form.dataset.workoutId,
    workoutTitle: form.dataset.workoutTitle,
    rating: form.querySelector('[name="rating"]:checked')?.value || "",
    pain,
    painLocation: pain ? form.querySelector('[name="painLocation"]')?.value.trim() || "" : "",
    note: form.querySelector('[name="note"]')?.value.trim() || "",
    date: formatToday(),
    timestamp: Date.now(),
  });
  saveWorkoutFeedbacks(feedbacks);
  form.innerHTML = "<strong>Treino finalizado.</strong><small>Feedback enviado para o Personal.</small>";
  renderAdminEvolution();
  renderStudentProfile();
});

adminLoadStudent?.addEventListener("change", renderAdminLoadEvolution);
adminEvolutionStudent?.addEventListener("change", () => {
  fillAdminEvolutionExercises();
  renderAdminEvolution();
});
adminEvolutionExercise?.addEventListener("change", renderAdminEvolution);
assessmentStudent?.addEventListener("change", renderAdminAssessments);
studentLoadExercise?.addEventListener("change", renderStudentLoadEvolution);
checkinFilterStudent?.addEventListener("change", renderCheckinHistory);
checkinFilterDate?.addEventListener("input", renderCheckinHistory);
manualCheckinStudent?.addEventListener("change", fillManualCheckinPackageSelect);
packageViewStudent?.addEventListener("change", () => {
  if (packageForm) packageForm.hidden = true;
  editingPackageId = null;
  renderPackageAdminList();
});

newPackageButton?.addEventListener("click", () => {
  if (!packageViewStudent?.value) {
    if (packageEmptyState) {
      packageEmptyState.hidden = false;
      packageEmptyState.textContent = "Selecione um aluno para criar um pacote.";
    }
    return;
  }

  editingPackageId = null;
  packageForm?.reset();
  if (packageStudent) packageStudent.value = packageViewStudent.value;
  if (packageForm) packageForm.hidden = false;
  packageName?.focus();
});

packageForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const packages = loadClassPackages();
  const packageData = {
    id: editingPackageId || createId(),
    studentName: packageStudent?.value || "",
    studentId: getStudentIdByName(packageStudent?.value || ""),
    name: packageName?.value.trim() || "Pacote de aulas",
    total: Number(packageTotal?.value) || 0,
    startDate: packageStart?.value.trim() || "",
    endDate: packageEnd?.value.trim() || "",
    days: packageDays?.value.trim() || "",
    time: packageTime?.value.trim() || "",
    notes: packageNotes?.value.trim() || "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const existingIndex = packages.findIndex((item) => item.id === editingPackageId);
  if (existingIndex >= 0) {
    packageData.createdAt = packages[existingIndex].createdAt || packageData.createdAt;
    packages[existingIndex] = packageData;
  } else {
    packages.push(packageData);
  }

  saveClassPackages(packages);
  packageForm.reset();
  packageForm.hidden = true;
  editingPackageId = null;
  fillManualCheckinPackageSelect();
  renderPackageAdminList();
  renderStudentPackagePanel();
  renderBillingList();
  if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
});

billingSettingsForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  saveBillingSettings({
    pixKey: billingPixKey?.value.trim() || "",
    senderName: billingSenderName?.value.trim() || "Personal Joao Victor",
    defaultMessage: billingDefaultMessage?.value.trim() || "Para manter seu acesso aos treinos e acompanhamento, voce pode realizar o pagamento via Pix.",
  });
  renderBillingList();
});

studentCheckinButton?.addEventListener("click", () => {
  const studentName = workoutViewStudent?.value;
  const activePackage = getActivePackage(studentName);
  if (!studentName || !activePackage || !getTodayPackageLesson(activePackage)) return;

  registerPackageCheckin(studentName, activePackage, "aluno");
  renderStudentCheckinStatus();
  renderCheckinHistory();
  renderStudentPackagePanel();
});

manualCheckinForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const studentName = manualCheckinStudent?.value;
  const classPackage = loadClassPackages().find((item) => item.id === manualCheckinPackage?.value) || getActivePackage(studentName);
  if (!studentName || !classPackage) return;

  registerPackageCheckin(studentName, classPackage, "personal");
  renderCheckinHistory();
  renderPackageAdminList();
  renderStudentPackagePanel();
  if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
  if (workoutViewStudent?.value === studentName) {
    renderStudentCheckinStatus();
  }
});

packageAdminList?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-package-list-action]");
  if (actionButton) {
    const packageId = actionButton.dataset.packageId;
    const action = actionButton.dataset.packageListAction;
    const classPackage = loadClassPackages().find((item) => item.id === packageId);
    if (!classPackage) return;
    const detail = packageAdminList.querySelector(`[data-package-list-detail="${classPackage.id}"]`);

    if (action === "details" && detail) {
      renderPackageListDetails(classPackage, detail);
      return;
    }

    if (action === "history" && detail) {
      renderPackageListHistory(classPackage, detail);
      return;
    }

    if (action === "more" && detail) {
      renderPackageListMoreActions(classPackage, detail);
      return;
    }

    if (action === "presence") {
      const detail = packageAdminList.querySelector(`[data-package-list-detail="${classPackage.id}"]`);
      const saved = registerPackageCheckin(classPackage.studentName, classPackage, "personal");
      renderCheckinHistory();
      renderPackageAdminList();
      renderStudentPackagePanel();
      if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
      if (detail && !saved) {
        detail.textContent = "Presenca nao registrada: pacote finalizado ou aula de hoje ja possui registro.";
      }
      return;
    }

    if (action === "edit") {
      if (packageViewStudent) packageViewStudent.value = classPackage.studentName;
      if (packageForm) packageForm.hidden = false;
      fillPackageForm(classPackage, classPackage.studentName);
      packageName?.focus();
      return;
    }

    if (action === "delete") {
      if (!window.confirm("Excluir este pacote? O historico antigo sera mantido.")) return;
      saveClassPackages(loadClassPackages().filter((item) => item.id !== classPackage.id));
      renderPackageAdminList();
      renderStudentPackagePanel();
      if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
      return;
    }

    if (action === "absence") {
      if (!detail) return;
      detail.innerHTML = "";

      const todayKey = getDateKey();
      const availableLessons = generatePackageSchedule(classPackage)
        .filter((lesson) => lesson.dateKey >= todayKey && !getLessonRecord(classPackage.id, lesson.dateKey))
        .slice(0, 10);

      if (!availableLessons.length) {
        detail.textContent = "Nenhuma aula disponivel para marcar falta.";
        return;
      }

      availableLessons.forEach((lesson) => {
        const row = document.createElement("div");
        row.className = "package-inline-panel";
        const text = document.createElement("span");
        text.textContent = `${lesson.date} | ${lesson.time}`;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary danger-action";
        button.dataset.packageAbsenceLesson = lesson.dateKey;
        button.dataset.packageId = classPackage.id;
        button.textContent = "Confirmar falta";
        row.append(text, button);
        detail.appendChild(row);
      });
    }
    return;
  }

  const absenceButton = event.target.closest("[data-package-absence-lesson]");
  if (!absenceButton) return;

  const classPackage = loadClassPackages().find((item) => item.id === absenceButton.dataset.packageId);
  const lesson = generatePackageSchedule(classPackage || {}).find((item) => item.dateKey === absenceButton.dataset.packageAbsenceLesson);
  if (!classPackage || !lesson || getLessonRecord(classPackage.id, lesson.dateKey)) return;
  if (!window.confirm("Marcar falta nesta aula? Esta acao contabiliza uma aula do pacote.")) return;

  registerLessonAbsence(classPackage.studentName, classPackage, lesson);
  renderCheckinHistory();
  renderPackageAdminList();
  renderStudentPackagePanel();
  if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
});

studentPackagePanel?.addEventListener("click", (event) => {
  const packageAction = event.target.closest("[data-student-package-action]");
  if (packageAction) {
    renderStudentPackageDetail(packageAction.dataset.studentPackageAction);
    return;
  }

  const cancelButton = event.target.closest("[data-cancel-lesson]");
  if (cancelButton) {
    const studentName = workoutViewStudent?.value;
    const classPackage = loadClassPackages().find((item) => item.id === cancelButton.dataset.cancelLesson);
    const lesson = generatePackageSchedule(classPackage || {}).find((item) => item.dateKey === cancelButton.dataset.lessonDate);
    if (!studentName || !classPackage || !lesson || getLessonRecord(classPackage.id, lesson.dateKey)) return;

    if (!window.confirm("Deseja cancelar esta aula? A regra de 2 horas sera aplicada automaticamente.")) return;

    registerLessonCancellation(studentName, classPackage, lesson);
    renderStudentCheckinStatus();
    renderStudentPackagePanel();
    renderCheckinHistory();
    renderPackageAdminList();
    if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
    return;
  }

  const button = event.target.closest("[data-package-checkin]");
  if (!button || button.disabled) return;

  const studentName = workoutViewStudent?.value;
  const classPackage = loadClassPackages().find((item) => item.id === button.dataset.packageCheckin);
  if (!studentName || !classPackage) return;

  registerPackageCheckin(studentName, classPackage, "aluno");
  renderStudentCheckinStatus();
  renderStudentPackagePanel();
  renderCheckinHistory();
  renderPackageAdminList();
  if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
});

loadWorkoutButton?.addEventListener("click", () => {
  const [studentName, workoutId] = workoutTemplateSource.value.split("|||");
  loadWorkoutIntoForm(studentName, workoutId);
});

workoutStudentDirectory?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-workout-student]");
  if (!button) return;

  openWorkoutStudentWorkspace(button.dataset.openWorkoutStudent);
});

workoutStudentSearch?.addEventListener("input", renderWorkoutStudentDirectory);

backToWorkoutStudents?.addEventListener("click", showWorkoutStudentDirectory);

createWorkoutForStudent?.addEventListener("click", () => {
  showWorkoutFormForStudent(selectedAdminWorkoutStudent, "create");
});

workoutList?.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-workout-id]");
  if (editButton) {
    const studentName = editButton.dataset.editWorkoutStudent;
    const workout = (loadWorkouts()[studentName] || []).find((item) => item.id === editButton.dataset.editWorkoutId);
    if (!workout) return;

    editingWorkout = { studentName, id: workout.id };
    openWorkoutStudentWorkspace(studentName);
    workoutStudent.value = studentName;
    workoutStudent.disabled = true;
    workoutTitle.value = workout.title;
    workoutGoal.value = workout.goal || "";
    workoutFrequency.value = workout.frequency || "";
    workoutStartDate.value = workout.startDate || "";
    workoutDueDate.value = workout.dueDate || "";
    workoutNotes.value = workout.notes || "";
    resetTrainingSessions(workout.sessions);
    workoutForm.hidden = false;
    saveWorkoutButton.textContent = "Salvar alteracao";
    cancelWorkoutEditButton.hidden = false;
    workoutTitle.focus();
    workoutMessage.textContent = "Editando treino. Altere os campos e salve.";
    workoutMessage.classList.remove("error");
    return;
  }

  const copyButton = event.target.closest("[data-copy-workout-id]");
  if (copyButton) {
    workoutTemplateSource.value = `${copyButton.dataset.copyWorkoutStudent}|||${copyButton.dataset.copyWorkoutId}`;
    showWorkoutFormForStudent(selectedAdminWorkoutStudent || copyButton.dataset.copyWorkoutStudent, "copy");
    loadWorkoutIntoForm(copyButton.dataset.copyWorkoutStudent, copyButton.dataset.copyWorkoutId);
    workoutStudent.disabled = true;
    workoutStudent.value = selectedAdminWorkoutStudent || copyButton.dataset.copyWorkoutStudent;
    workoutStudent.focus();
    return;
  }

  const removeButton = event.target.closest("[data-remove-workout-id]");
  if (!removeButton) return;

  const workouts = loadWorkouts();
  const studentName = removeButton.dataset.removeWorkoutStudent;
  workouts[studentName] = (workouts[studentName] || []).filter((workout) => workout.id !== removeButton.dataset.removeWorkoutId);
  if (!workouts[studentName].length) delete workouts[studentName];
  saveWorkouts(workouts);
  renderWorkouts();
});

cancelWorkoutEditButton?.addEventListener("click", () => {
  editingWorkout = null;
  workoutForm.reset();
  resetExerciseRows();
  workoutForm.hidden = true;
  workoutStudent.disabled = false;
  saveWorkoutButton.textContent = "Salvar ficha";
  cancelWorkoutEditButton.hidden = true;
  workoutMessage.textContent = "Edicao de treino cancelada.";
  workoutMessage.classList.remove("error");
});

studentList?.addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-open-student-profile]");
  if (openButton) {
    renderAdminStudentProfile(openButton.dataset.openStudentProfile);
    return;
  }

  const editButton = event.target.closest("[data-edit-student]");
  if (editButton) {
    startEditingStudent(Number(editButton.dataset.editStudent));
    return;
  }

  const removeButton = event.target.closest("[data-remove-student]");
  if (!removeButton) return;

  const students = loadStudents();
  students.splice(Number(removeButton.dataset.removeStudent), 1);
  saveStudents(students);
  renderStudents();
  if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
});

paymentBlockedPanel?.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-blocked-payment-student]");
  if (!editButton) return;

  const studentIndex = loadStudents().findIndex((student) => student.name === editButton.dataset.editBlockedPaymentStudent);
  if (studentIndex < 0) return;

  openAdminModule("students");
  startEditingStudent(studentIndex, "Altere o status de pagamento e salve o aluno.");
});

cancelEditButton?.addEventListener("click", () => {
  resetStudentForm();
  showMessage("Edicao cancelada.");
});

studentAdminProfile?.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-close-student-profile]");
  if (closeButton) {
    studentAdminProfile.hidden = true;
    selectedAdminProfileStudent = "";
    return;
  }

  const actionButton = event.target.closest("[data-student-profile-action]");
  const packageActionButton = event.target.closest("[data-admin-package-action]");
  if (packageActionButton) {
    renderAdminPackageDetail(packageActionButton.dataset.studentName, packageActionButton.dataset.adminPackageAction);
    return;
  }

  const packageManageButton = event.target.closest("[data-package-manage-action]");
  if (packageManageButton) {
    const studentName = packageManageButton.dataset.studentName;
    const packageId = packageManageButton.dataset.packageId;
    const action = packageManageButton.dataset.packageManageAction;
    const classPackage = loadClassPackages().find((item) => item.id === packageId) || getActivePackage(studentName);

    if (action === "edit") {
      openAdminModule("checkins");
      fillPackageForm(classPackage, studentName);
      packageName?.focus();
      return;
    }

    if (action === "delete" && classPackage) {
      if (!window.confirm("Excluir este pacote? O historico antigo sera mantido.")) return;
      const packages = loadClassPackages().filter((item) => item.id !== classPackage.id);
      saveClassPackages(packages);
      renderPackageAdminList();
      renderStudentPackagePanel();
      renderAdminStudentProfile(studentName);
      return;
    }

    if (action === "absence" && classPackage) {
      const lesson = generatePackageSchedule(classPackage).find((item) => item.dateKey === packageManageButton.dataset.lessonDate);
      if (!lesson || getLessonRecord(classPackage.id, lesson.dateKey)) return;
      if (!window.confirm("Marcar falta nesta aula? Esta acao contabiliza uma aula do pacote.")) return;
      registerLessonAbsence(studentName, classPackage, lesson);
      renderCheckinHistory();
      renderPackageAdminList();
      renderStudentPackagePanel();
      renderAdminStudentProfile(studentName);
      return;
    }
  }

  if (!actionButton) return;

  const studentName = actionButton.dataset.studentName;
  const action = actionButton.dataset.studentProfileAction;
  const students = loadStudents();
  const studentIndex = students.findIndex((student) => student.name === studentName);

  if (action === "edit" && studentIndex >= 0) {
    const student = students[studentIndex];
    editingStudentIndex = studentIndex;
    nameInput.value = student.name;
    if (emailInput) emailInput.value = student.email || "";
    if (phoneInput) phoneInput.value = student.phone || "";
    if (birthDateInput) birthDateInput.value = student.birthDate || "";
    planInput.value = student.plan;
    valueInput.value = student.value;
    dueInput.value = student.due;
    paymentInput.value = student.payment;
    safeSetText(saveStudentButton, "Salvar alteracao");
    if (cancelEditButton) cancelEditButton.hidden = false;
    nameInput?.focus();
    return;
  }

  if (action === "workout") {
    openAdminModule("workouts");
    openWorkoutStudentWorkspace(studentName);
    return;
  }

  if (action === "package" || action === "checkin") {
    openAdminModule("checkins");
    const activePackage = getActivePackage(studentName) || loadClassPackages().filter((item) => item.studentName === studentName).sort((a, b) => b.createdAt - a.createdAt)[0];
    fillPackageForm(action === "package" ? activePackage : null, studentName);
    if (manualCheckinStudent) manualCheckinStudent.value = studentName;
    fillManualCheckinPackageSelect();
    if (action === "checkin") {
      manualCheckinForm?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }

  if (action === "assessment") {
    openAdminModule("assessments");
    if (assessmentStudent) assessmentStudent.value = studentName;
    renderAdminAssessments();
    return;
  }

  if (action === "evolution") {
    openAdminModule("assessments");
    if (adminLoadStudent) adminLoadStudent.value = studentName;
    renderAdminLoadEvolution();
  }
});

function openAdminModule(moduleName) {
  if (!adminDashboard) return;

  adminDashboard.hidden = true;
  adminModules.forEach((module) => {
    module.hidden = module.id !== `admin-module-${moduleName}`;
  });
  if (moduleName === "assessments") {
    if (!assessmentDate.value) assessmentDate.value = formatToday();
    renderAdminAssessments();
    renderAdminLoadEvolution();
  }
  if (moduleName === "checkins") {
    if (packageViewStudent) packageViewStudent.value = "";
    if (packageForm) packageForm.hidden = true;
    renderPackageAdminList();
    fillManualCheckinPackageSelect();
    renderCheckinHistory();
  }
  if (moduleName === "evolution") {
    renderAdminEvolution();
  }
  if (moduleName === "workouts") {
    showWorkoutStudentDirectory();
  }
  if (moduleName === "finance") {
    renderBillingSettings();
    renderBillingList();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showAdminDashboard() {
  if (!adminDashboard) return;

  adminDashboard.hidden = false;
  adminModules.forEach((module) => {
    module.hidden = true;
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

newStudentButton?.addEventListener("click", () => {
  openView("admin");
  openAdminModule("students");
  resetStudentForm();
});

workoutFocusButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openView("admin");
    openAdminModule("workouts");
    workoutStudent.focus();
  });
});

adminModuleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openAdminModule(button.dataset.adminTarget);
  });
});

adminBackButtons.forEach((button) => {
  button.addEventListener("click", showAdminDashboard);
});

addExerciseButton?.addEventListener("click", () => addTrainingSession({ title: "", exercises: [{}] }));

organizeWorkoutTextButton?.addEventListener("click", importWorkoutFromText);

workoutExercises?.addEventListener("click", (event) => {
  const addExercise = event.target.closest("[data-add-session-exercise]");
  if (addExercise) {
    addExercise.closest(".training-session-builder").querySelector(".training-session-exercises").appendChild(createExerciseFormRow());
    return;
  }

  const removeSession = event.target.closest("[data-remove-session]");
  if (removeSession) {
    const sessions = workoutExercises.querySelectorAll(".training-session-builder");
    if (sessions.length === 1) {
      sessions[0].querySelector("[data-session-title]").value = "";
      sessions[0].querySelector(".training-session-exercises").replaceChildren(createExerciseFormRow());
      return;
    }
    removeSession.closest(".training-session-builder").remove();
    return;
  }

  const removeButton = event.target.closest("[data-remove-exercise-row]");
  if (!removeButton) return;

  const session = removeButton.closest(".training-session-builder");
  const rows = session.querySelectorAll(".exercise-form-row");
  if (rows.length === 1) {
    rows[0].querySelectorAll("input").forEach((input) => {
      input.value = "";
    });
    return;
  }

  removeButton.closest(".exercise-form-row").remove();
});

workoutExercises?.addEventListener("input", (event) => {
  const input = event.target.closest("[data-exercise-field]");
  if (!input) return;

  if (input.dataset.exerciseField === "currentLoad") {
    const cursorAtEnd = input.selectionStart === input.value.length;
    input.value = String(input.value).replace(/[^\d,.]/g, "").replace(/\./g, ",");
    if (cursorAtEnd) input.setSelectionRange(input.value.length, input.value.length);
  }

  if (input.dataset.exerciseField === "rest") {
    input.value = onlyDigits(input.value);
  }
});

workoutExercises?.addEventListener("blur", (event) => {
  const input = event.target.closest("[data-exercise-field]");
  applyExerciseFieldMask(input);
}, true);

function applyUserPermissions() {
  if (!currentUserType || !loginScreen || !appShell) return;

  const adminItems = document.querySelectorAll("[data-admin-only]");
  const studentItems = document.querySelectorAll("[data-student-only]");
  const userModeText = document.querySelector("#user-mode");
  loginScreen.hidden = true;
  appShell.hidden = false;

  if (currentUserType === "student") {
    safeSetText(userModeText, "Modo aluno");
    if (workoutViewStudent) workoutViewStudent.disabled = true;

    adminItems.forEach((item) => {
      item.style.display = "none";
    });

    studentItems.forEach((item) => {
      item.style.display = "";
    });

    openView("treino");
  } else {
    safeSetText(userModeText, "Modo personal");
    if (workoutViewStudent) workoutViewStudent.disabled = false;

    adminItems.forEach((item) => {
      item.style.display = "";
    });

    studentItems.forEach((item) => {
      item.style.display = "none";
    });

    openView("admin");
  }
}

const logoutButton = document.querySelector("#logout-button");

function enterTestMode(role, studentName = "") {
  if (!["student", "admin"].includes(role)) return;

  Object.keys(activeWorkoutByStudent).forEach((key) => delete activeWorkoutByStudent[key]);
  Object.keys(activeSessionByWorkout).forEach((key) => delete activeSessionByWorkout[key]);
  currentUserType = role;
  setLocalValue("user-type", role);

  if (role === "student") {
    const students = loadStudents();
    const requestedStudent = studentName || loginStudentSelect?.value || students[0]?.name || "";
    selectedStudentProfile = students.some((student) => student.name === requestedStudent) ? requestedStudent : students[0]?.name || "";
    setLocalValue("student-profile", selectedStudentProfile);
    if (workoutViewStudent) workoutViewStudent.value = selectedStudentProfile;
  }

  fillStudentSelects();
  updateStudentHeader();
  applyUserPermissions();
  renderCurrentWorkout();
}

loginButtons.forEach((button) => {
  button.addEventListener("click", () => {
    enterTestMode(button.dataset.loginRole);
  });
});

loginStudentButton?.addEventListener("click", () => {
  enterTestMode("student", loginStudentSelect?.value);
});

supabaseLoginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const client = getSupabaseClient();
  if (!client) {
    showSupabaseLoginMessage("Configure a URL e a chave publica do Supabase antes de usar login real.", "error");
    return;
  }

  const email = supabaseLoginEmail?.value.trim() || "";
  const password = supabaseLoginPassword?.value || "";
  if (!email || !password) {
    showSupabaseLoginMessage("Informe e-mail e senha.", "error");
    return;
  }

  showSupabaseLoginMessage("Entrando...");
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    showSupabaseLoginMessage("Nao foi possivel entrar. Confira e-mail e senha.", "error");
    return;
  }

  if (await applySupabaseUser(data.user)) {
    supabaseLoginForm.reset();
    showSupabaseLoginMessage("");
  }
});

supabaseForgotPasswordButton?.addEventListener("click", async () => {
  const client = getSupabaseClient();
  if (!client) {
    showSupabaseLoginMessage("Configure o Supabase antes de recuperar senha.", "error");
    return;
  }

  const email = supabaseLoginEmail?.value.trim() || "";
  if (!email) {
    showSupabaseLoginMessage("Informe seu e-mail para recuperar a senha.", "error");
    supabaseLoginEmail?.focus();
    return;
  }

  const redirectTo = window.location.origin.startsWith("http") ? window.location.origin : undefined;
  const { error } = await client.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  if (error) {
    showSupabaseLoginMessage("Nao foi possivel enviar a recuperacao de senha.", "error");
    return;
  }

  showSupabaseLoginMessage("Enviamos um link de recuperacao para seu e-mail.");
});

logoutButton?.addEventListener("click", async () => {
  const client = getSupabaseClient();
  if (client && currentSupabaseUser) {
    await client.auth.signOut();
    currentSupabaseUser = null;
  }

  currentUserType = null;
  Object.keys(activeWorkoutByStudent).forEach((key) => delete activeWorkoutByStudent[key]);
  Object.keys(activeSessionByWorkout).forEach((key) => delete activeSessionByWorkout[key]);
  removeLocalValue("user-type");
  if (appShell) appShell.hidden = true;
  if (loginScreen) loginScreen.hidden = false;
  fillStudentSelects();
  updateStudentHeader();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

function refreshAppAfterRemoteState() {
  normalizeStoredAppData();
  resetExerciseRows();
  renderStudents();
  renderBillingSettings();
  fillStudentSelects();
  updateStudentHeader();
  if (currentUserType === "student") {
    renderCurrentWorkout();
    renderStudentAssessments();
    renderStudentLoadEvolution();
    renderStudentPackagePanel();
    renderStudentProfile();
  }
  if (currentUserType === "admin") {
    renderWorkouts();
    renderBillingList();
    renderPackageAdminList();
    renderAdminEvolution();
  }
}

function initializeApp() {
  if (appEventsBound) return;
  appEventsBound = true;

  currentUserType = null;
  console.info(`Supabase URL utilizada: ${getSupabaseConfig().url}`);
  updateTodayLabel();
  applyInputMasks();
  normalizeStoredAppData();

  if (loginScreen) loginScreen.hidden = false;
  if (appShell) appShell.hidden = true;
  if (!assessmentDate?.value && assessmentDate) assessmentDate.value = formatToday();

  resetExerciseRows();
  renderStudents();
  renderBillingSettings();
  fillStudentSelects();
  loadSupabaseAppState()
    .then((status) => {
      if (status === "loaded") {
        refreshAppAfterRemoteState();
        return;
      }
      if (status === "missing") {
        queueSupabaseAppStateSync();
      }
    })
    .catch((error) => {
      console.warn("Supabase app_state nao carregou. App local continua funcionando.", error);
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp, { once: true });
} else {
  initializeApp();
}
