const titles = {
   home: "Painel inicial",
  treino: "Treino",
  avaliacao: "Avaliação física",
  evolucao: "Evolução corporal",
  perfil: "Perfil",
  videos: "Vídeos dos exercícios",
  agenda: "Agendamento",
  beach: "Área beach tennis",
  admin: "Área administrativa",
  aluno: "Área do aluno",
};

const navButtons = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");
const pageTitle = document.querySelector("#page-title");
const todayLabel = document.querySelector("#today-label");
const loginScreen = document.querySelector("#login-screen");
const appShell = document.querySelector("#app-shell");
const loginStudentSelect = document.querySelector("#login-student-select");
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
let currentSupabaseProfile = null;
let supabaseAuthListenerBound = false;
let applySupabaseUserPromise = null;
let applyingSupabaseUserId = "";
let globalErrorHandlersBound = false;
let activeLoginSource = "";
const supabaseOperationTimeoutMs = 15000;
const supabaseQueryTimeoutMs = 7000;
const supabaseUserApplyTimeoutMs = 30000;
try {
  selectedStudentProfile = localStorage.getItem("student-profile") || "";
} catch {
  selectedStudentProfile = "";
}

function openView(id, options = {}) {
  if (!currentUserType) return;

  if (currentUserType === "student" && id === "admin") {
    id = "treino";
  }

  if (currentUserType === "admin" && ["treino", "videos", "avaliacao", "evolucao", "perfil", "agenda", "beach", "home"].includes(id)) {
    id = "admin";
  }

  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === id && !button.dataset.adminShortcut));
  views.forEach((view) => view.classList.toggle("active", view.id === id));
  activeViewId = id;
  safeSetText(pageTitle, titles[id] || "Painel inicial");
  if (id === "admin" && !isRestoringNavigation && typeof showAdminDashboard === "function") {
    showAdminDashboard({ persistDashboard: options.userInitiated === true });
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
  if (id === "home" && typeof renderHomeDashboard === "function") {
    renderHomeDashboard();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
  saveNavigationState();
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openView(button.dataset.view, { userInitiated: true });
    if (button.dataset.adminShortcut && currentUserType === "admin") {
      openAdminModule(button.dataset.adminShortcut);
      navButtons.forEach((item) => item.classList.toggle("active", item === button));
    }
  });
});

document.querySelectorAll("[data-jump]").forEach((button) => {
  button.addEventListener("click", () => openView(button.dataset.jump, { userInitiated: true }));
});

const studentStorageKey = "joao-victor-students";
const workoutStorageKey = "joao-victor-workouts";
const loadProgressStorageKey = "joao-victor-load-progress";
const assessmentStorageKey = "joao-victor-assessments";
const checkinStorageKey = "joao-victor-checkins";
const packageStorageKey = "joao-victor-class-packages";
const dropInStorageKey = "joao-victor-dropin-classes";
const agendaEventStorageKey = "joao-victor-agenda-events";
const classGroupStorageKey = "joao-victor-class-groups";
const makeupStorageKey = "joao-victor-makeup-credits";
const feedbackStorageKey = "joao-victor-workout-feedbacks";
const resolvedAlertsStorageKey = "joao-victor-resolved-alerts";
const appDataStorageKey = "joao-victor-app-data";
const appSessionStorageKey = "joao-victor-login-session";
const billingSettingsStorageKey = "joao-victor-billing-settings";
const financialHistoryStorageKey = "joao-victor-financial-history";
const packageModelStorageKey = "joao-victor-package-models";
const navigationStateStorageKey = "joao-victor-navigation-state";
const pendingSupabaseSyncStorageKey = "joao-victor-pending-supabase-sync";
const deletionTombstoneStorageKey = "joao-victor-deletion-tombstones";
const tombstoneRetentionMs = 180 * 24 * 60 * 60 * 1000;
const supabaseTables = {
  appState: "app_state",
  profiles: "profiles",
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
const loadChartModes = [
  { value: "last10", label: "Ultimos 10" },
  { value: "last20", label: "Ultimos 20" },
  { value: "last50", label: "Ultimos 50" },
  { value: "all", label: "Tudo" },
  { value: "monthly-average", label: "Media mensal" },
  { value: "monthly-best", label: "Melhor carga por mes" },
];

const studentForm = document.querySelector("#student-form");
const studentList = document.querySelector("#student-list");
const studentListSearch = document.querySelector("#student-list-search");
const studentCount = document.querySelector("#student-count");
const pendingCount = document.querySelector("#pending-count");
const nameInput = document.querySelector("#student-name");
const emailInput = document.querySelector("#student-email");
const tempPasswordInput = document.querySelector("#student-temp-password");
const createStudentAccessButton = document.querySelector("#create-student-access-button");
const phoneInput = document.querySelector("#student-phone");
const birthDateInput = document.querySelector("#student-birth-date");
const planInput = document.querySelector("#student-plan");
const modalityInput = document.querySelector("#student-modality");
const studentStartDateInput = document.querySelector("#student-start-date");
const frequencyInput = document.querySelector("#student-frequency");
const makeupLimitInput = document.querySelector("#student-makeup-limit");
const billingDayInputs = document.querySelectorAll('[name="student-billing-day"]');
const studentWeeklySchedule = document.querySelector("#student-weekly-schedule");
const billingTypeInput = document.querySelector("#student-billing-type");
const classValueInput = document.querySelector("#student-class-value");
const valueInput = document.querySelector("#student-value");
const dueInput = document.querySelector("#student-due");
const paymentMethodInput = document.querySelector("#student-payment-method");
const paymentInput = document.querySelector("#student-payment");
const studentBillingNotesInput = document.querySelector("#student-billing-notes");
const studentPackagePreview = document.querySelector("#student-package-preview");
const adminAgendaView = document.querySelector("#admin-agenda-view");
const adminAgendaDate = document.querySelector("#admin-agenda-date");
const adminAgendaGrid = document.querySelector("#admin-agenda-grid");
const agendaMakeupForm = document.querySelector("#agenda-makeup-form");
const agendaDropinForm = document.querySelector("#agenda-dropin-form");
const agendaCancelForm = document.querySelector("#agenda-cancel-form");
const agendaMakeupStudent = document.querySelector("#agenda-makeup-student");
const agendaMakeupDate = document.querySelector("#agenda-makeup-date");
const agendaMakeupTime = document.querySelector("#agenda-makeup-time");
const agendaMakeupDuration = document.querySelector("#agenda-makeup-duration");
const agendaMakeupNote = document.querySelector("#agenda-makeup-note");
const agendaDropinStudent = document.querySelector("#agenda-dropin-student");
const agendaDropinName = document.querySelector("#agenda-dropin-name");
const agendaDropinDate = document.querySelector("#agenda-dropin-date");
const agendaDropinTime = document.querySelector("#agenda-dropin-time");
const agendaDropinDuration = document.querySelector("#agenda-dropin-duration");
const agendaDropinValue = document.querySelector("#agenda-dropin-value");
const agendaDropinStatus = document.querySelector("#agenda-dropin-status");
const agendaCancelEvent = document.querySelector("#agenda-cancel-event");
const agendaCancelReason = document.querySelector("#agenda-cancel-reason");
const agendaCancelMakeup = document.querySelector("#agenda-cancel-makeup");
const scheduleAdminPanel = document.querySelector(".schedule-admin-panel");
const newStudentButton = document.querySelector("[data-focus-student]");
const workoutFocusButtons = document.querySelectorAll("[data-focus-workout]");
const adminDashboard = document.querySelector("#admin-dashboard");
const adminAlertCard = document.querySelector("#admin-alert-card");
const paymentBlockedPanel = document.querySelector("#payment-blocked-panel");
const adminAlertsList = document.querySelector("#admin-alerts-list");
const adminAlertFilter = document.querySelector("#admin-alert-filter");
const adminModules = document.querySelectorAll(".admin-module");
const adminModuleButtons = document.querySelectorAll("[data-admin-target]");
const adminBackButtons = document.querySelectorAll("[data-admin-back]");
const adminSubpageMenus = document.querySelectorAll("[data-subpage-menu]");
const adminSubpages = document.querySelectorAll("[data-subpage]");
const saveMessage = document.querySelector("#save-message");
const saveStudentButton = document.querySelector("#save-student-button");
const cancelEditButton = document.querySelector("#cancel-edit-button");
const exportDataButton = document.querySelector("#export-data-button");
const studentPlanSummary = document.querySelector("#student-plan-summary");
const studentStatusSummary = document.querySelector("#student-status-summary");
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
const studentLoadChartMode = document.querySelector("#student-load-chart-mode");
const studentLoadChart = document.querySelector("#student-load-chart");
const studentLoadChartTitle = document.querySelector("#student-load-chart-title");
const studentLoadChartSubtitle = document.querySelector("#student-load-chart-subtitle");
const studentLoadChartBadge = document.querySelector("#student-load-chart-badge");
const studentLoadList = document.querySelector("#student-load-list");
const adminLoadStudent = document.querySelector("#admin-load-student");
const adminLoadHistory = document.querySelector("#admin-load-history");
const adminEvolutionStudent = document.querySelector("#admin-evolution-student");
const adminEvolutionExercise = document.querySelector("#admin-evolution-exercise");
const adminEvolutionChartMode = document.querySelector("#admin-evolution-chart-mode");
const adminEvolutionChart = document.querySelector("#admin-evolution-chart");
const adminEvolutionChartTitle = document.querySelector("#admin-evolution-chart-title");
const adminEvolutionChartSubtitle = document.querySelector("#admin-evolution-chart-subtitle");
const adminEvolutionChartBadge = document.querySelector("#admin-evolution-chart-badge");
const adminPersonalRecords = document.querySelector("#admin-personal-records");
const adminAdherenceSummary = document.querySelector("#admin-adherence-summary");
const adminFeedbackHistory = document.querySelector("#admin-feedback-history");
const adminFeedbackNotes = document.querySelector("#admin-feedback-notes");
const adminFeedbackStudentFilter = document.querySelector("#admin-feedback-student-filter");
const adminFeedbackTypeFilter = document.querySelector("#admin-feedback-type-filter");
const adminNotesStudentFilter = document.querySelector("#admin-notes-student-filter");
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
const assessmentChartSummary = document.querySelector("#assessment-chart-summary");
const assessmentPhotoSummary = document.querySelector("#assessment-photo-summary");
const assessmentCompareSummary = document.querySelector("#assessment-compare-summary");
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
const manualCheckinType = document.querySelector("#manual-checkin-type");
const manualCheckinValue = document.querySelector("#manual-checkin-value");
const manualCheckinNote = document.querySelector("#manual-checkin-note");
const checkinFilterStudent = document.querySelector("#checkin-filter-student");
const checkinFilterDate = document.querySelector("#checkin-filter-date");
const checkinMonthTotal = document.querySelector("#checkin-month-total");
const checkinHistory = document.querySelector("#checkin-history");
const packageForm = document.querySelector("#package-form");
const newPackageButton = document.querySelector("#new-package-button");
const packageViewStudent = document.querySelector("#package-view-student");
const packageStudentSearch = document.querySelector("#package-student-search");
const packageStudentResults = document.querySelector("#package-student-results");
const packageEmptyState = document.querySelector("#package-empty-state");
const packageStudent = document.querySelector("#package-student");
const packageName = document.querySelector("#package-name");
const packageModelList = document.querySelector("#package-model-list");
const packageTotal = document.querySelector("#package-total");
const packageFrequency = document.querySelector("#package-frequency");
const packageValue = document.querySelector("#package-value");
const packageStart = document.querySelector("#package-start");
const packageEnd = document.querySelector("#package-end");
const packageMakeupLimit = document.querySelector("#package-makeup-limit");
const packageDays = document.querySelector("#package-days");
const packageTime = document.querySelector("#package-time");
const packageNotes = document.querySelector("#package-notes");
const packageAdminList = document.querySelector("#package-admin-list");
const lessonBalancePanel = document.querySelector("#lesson-balance-panel");
const packageModuleMenu = document.querySelector("#package-module-menu");
const packageSubpages = document.querySelectorAll("[data-package-page]");
const packageEditorTitle = document.querySelector("#package-editor-title");
const dropInForm = document.querySelector("#dropin-class-form");
const dropInStudent = document.querySelector("#dropin-student");
const dropInDate = document.querySelector("#dropin-date");
const dropInModality = document.querySelector("#dropin-modality");
const dropInValue = document.querySelector("#dropin-value");
const dropInStatus = document.querySelector("#dropin-status");
const dropInNote = document.querySelector("#dropin-note");
const makeupForm = document.querySelector("#makeup-credit-form");
const makeupStudent = document.querySelector("#makeup-student");
const makeupPackage = document.querySelector("#makeup-package");
const makeupDate = document.querySelector("#makeup-date");
const makeupLessonTime = document.querySelector("#makeup-lesson-time");
const makeupNoticeTime = document.querySelector("#makeup-notice-time");
const makeupNote = document.querySelector("#makeup-note");
const personalRescheduleForm = document.querySelector("#personal-reschedule-form");
const personalRescheduleStudent = document.querySelector("#personal-reschedule-student");
const personalReschedulePackage = document.querySelector("#personal-reschedule-package");
const personalRescheduleDate = document.querySelector("#personal-reschedule-date");
const personalRescheduleTime = document.querySelector("#personal-reschedule-time");
const personalRescheduleReason = document.querySelector("#personal-reschedule-reason");
const makeupListStudent = document.querySelector("#makeup-list-student");
const makeupCreditList = document.querySelector("#makeup-credit-list");
const lessonHistoryStudent = document.querySelector("#lesson-history-student");
const lessonHistoryStart = document.querySelector("#lesson-history-start");
const lessonHistoryEnd = document.querySelector("#lesson-history-end");
const lessonExtraHistory = document.querySelector("#lesson-extra-history");
const studentPackagePanel = document.querySelector("#student-package-panel");
const billingSettingsForm = document.querySelector("#billing-settings-form");
const billingPixKey = document.querySelector("#billing-pix-key");
const billingSenderName = document.querySelector("#billing-sender-name");
const billingDefaultMessage = document.querySelector("#billing-default-message");
const billingSettingsMessage = document.querySelector("#billing-settings-message");
const billingFilterMonth = document.querySelector("#billing-filter-month");
const billingFilterStatus = document.querySelector("#billing-filter-status");
const billingFilterName = document.querySelector("#billing-filter-name");
const billingCountHolidays = document.querySelector("#billing-count-holidays");
const billingHolidays = document.querySelector("#billing-holidays");
const billingForecastSummary = document.querySelector("#billing-forecast-summary");
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
let memoryPackageModels = null;
let memoryDropIns = null;
let memoryAgendaEvents = null;
let memoryClassGroups = null;
let memoryMakeups = null;
let memoryFeedbacks = null;
let memoryFinancialHistory = null;
let editingStudentIndex = null;
let editingWorkout = null;
let editingPackageId = null;
let editingClassGroupId = "";
let selectedAdminWorkoutStudent = "";
let selectedAdminProfileStudent = "";
let highlightedMakeupCreditId = "";
let highlightedFeedbackId = "";
let highlightedStudentStatusName = "";
let isProcessingAutomaticLessons = false;
let activeViewId = "";
let activeAdminModule = "";
let activeAdminSubpage = "";
let activePackageSubpage = "";
let activePackageMode = "";
let isRestoringNavigation = false;
let classGroupEditorParticipants = [];
let agendaMakeupParticipants = [];
let agendaDropinParticipants = [];
const activeWorkoutByStudent = {};
const activeSessionByWorkout = {};
let appEventsBound = false;
let isApplyingRemoteState = false;
let supabaseSyncTimer = null;
let supabaseSyncPromise = Promise.resolve();
let lastSupabaseSyncWarning = 0;
let lastRecoverableGlobalWarning = 0;
let appInitializationPromise = null;
const missingTrainingDaysMessage = "Este aluno ainda não possui dias de treino cadastrados. Sem isso, o sistema não consegue calcular aulas previstas, cobranças e treinos do mês.";

function showMessage(text, type = "success") {
  if (!saveMessage) return;
  saveMessage.textContent = text;
  saveMessage.classList.toggle("error", type === "error");
}

function showAppErrorRecovery(message = "O aplicativo encontrou um erro ao carregar.") {
  let recovery = document.querySelector("#app-error-recovery");
  if (!recovery) {
    recovery = document.createElement("div");
    recovery.id = "app-error-recovery";
    recovery.style.cssText = "position:fixed;inset:auto 16px 16px 16px;z-index:9999;padding:16px;border-radius:16px;background:#111827;color:#fff;box-shadow:0 18px 50px rgba(15,23,42,.25);font-family:Manrope,Arial,sans-serif;display:grid;gap:10px;max-width:520px;margin:auto;";
    const text = document.createElement("span");
    text.dataset.appErrorText = "true";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Recarregar aplicativo";
    button.style.cssText = "border:0;border-radius:12px;padding:12px 16px;background:#22c55e;color:#052e16;font-weight:800;cursor:pointer;";
    button.addEventListener("click", () => window.location.reload());
    recovery.append(text, button);
    document.body?.appendChild(recovery);
  }
  safeSetText(recovery.querySelector("[data-app-error-text]"), `${message} Seus dados salvos nao serao apagados.`);
}

function hideAppErrorRecovery() {
  document.querySelector("#app-error-recovery")?.remove();
}

function getOriginalErrorMessage(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  return String(error.message || error.reason?.message || error.name || error.code || "");
}

function isRecoverableAsyncError(error) {
  const message = getOriginalErrorMessage(error).toLowerCase();
  return [
    "tempo esgotado",
    "timeout",
    "failed to fetch",
    "networkerror",
    "load failed",
    "cliente supabase indisponivel",
    "supabase app_state",
    "carregar app_state",
    "profiles",
    "auth",
  ].some((token) => message.includes(token));
}

function showOfflineNotice(message = "Modo offline: usando dados salvos neste dispositivo.") {
  const now = Date.now();
  if (now - lastRecoverableGlobalWarning < 15000) return;
  lastRecoverableGlobalWarning = now;
  console.warn(message);
  showSupabaseSyncWarning(message);
  let notice = document.querySelector("#app-connectivity-notice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "app-connectivity-notice";
    notice.setAttribute("role", "status");
    notice.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:9998;max-width:360px;padding:10px 14px;border-radius:12px;background:#334155;color:#fff;box-shadow:0 8px 24px rgba(15,23,42,.18);font:600 13px Manrope,Arial,sans-serif;";
    document.body?.appendChild(notice);
  }
  safeSetText(notice, message);
}

function hideConnectivityNotice() {
  document.querySelector("#app-connectivity-notice")?.remove();
}

function bindGlobalErrorHandlers() {
  if (globalErrorHandlersBound) return;
  globalErrorHandlersBound = true;
  window.addEventListener("error", (event) => {
    console.error("Erro global capturado pelo app.", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
    showAppErrorRecovery("O aplicativo encontrou um erro inesperado.");
  });
  window.addEventListener("unhandledrejection", (event) => {
    console.error("Promessa rejeitada sem tratamento capturada pelo app.", {
      operacao: "unhandledrejection",
      erroOriginal: event.reason,
      mensagem: getOriginalErrorMessage(event.reason),
    });
    if (!navigator.onLine) {
      event.preventDefault();
      showOfflineNotice();
      return;
    }
    if (isRecoverableAsyncError(event.reason)) {
      event.preventDefault();
      showOfflineNotice("Sincronizacao demorou ou falhou momentaneamente. O app continua usando o cache local e tentara novamente.");
      return;
    }
    showAppErrorRecovery("O aplicativo encontrou um erro inesperado.");
  });
  window.addEventListener("offline", () => showOfflineNotice());
  window.addEventListener("online", () => {
    hideConnectivityNotice();
    retryPendingAppStateSync("conexao restaurada").catch((error) => {
      console.error("Falha ao sincronizar pendencias apos a conexao voltar.", {
        operacao: "retryPendingAppStateSync:online",
        erroOriginal: error,
      });
    });
  });
}

function isPublishedApp() {
  const host = window.location.hostname;
  return window.location.protocol.startsWith("http")
    && host
    && !["localhost", "127.0.0.1", "::1"].includes(host);
}

function safeSetText(element, text = "") {
  if (element) element.textContent = text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getOrCreateElement(id, className = "", tag = "div") {
  let element = document.querySelector(`#${id}`);
  if (!element) {
    element = document.createElement(tag);
    element.id = id;
    if (className) element.className = className;
  }
  return element;
}

function updateTodayLabel() {
  if (!todayLabel) return;
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = today.toLocaleDateString("pt-BR", { month: "long" });
  todayLabel.textContent = `Hoje, ${day} de ${month}`;
}

function updateEvolutionNavigationLabels() {
  const recordsCard = document.querySelector('[data-subpage-target="evolution-records"]');
  const recordsTitle = recordsCard?.querySelector("strong");
  const recordsDescription = recordsCard?.querySelector("small");
  if (recordsTitle) recordsTitle.textContent = "Progressão de Cargas";
  if (recordsDescription) recordsDescription.textContent = "Maior carga, carga anterior e histórico.";
  const recordsHeader = document.querySelector('[data-subpage="evolution-records"] .load-history-head strong');
  if (recordsHeader) recordsHeader.textContent = "Progressão de Cargas";
  const notesCard = document.querySelector('[data-subpage-target="evolution-notes"]');
  const notesPage = document.querySelector('[data-subpage="evolution-notes"]');
  if (notesCard) notesCard.hidden = true;
  if (notesPage) notesPage.hidden = true;
}

function renderHomeDashboard() {
  const metricsGrid = document.querySelector("#home .metrics-grid");
  if (!metricsGrid) return;

  const students = loadStudents();
  const monthKey = getDefaultBillingMonthKey();
  const billing = students.map((student) => getStudentBillingProjection(student, monthKey));
  const pendingBilling = billing.filter((item) => item.status === "Pendente" || item.status === "Vencido");
  const pendingValue = pendingBilling.reduce((sum, item) => sum + item.totalValue, 0);
  const monthLessons = billing.reduce((sum, item) => sum + item.predictedLessons, 0);
  const monthRevenue = billing.reduce((sum, item) => sum + item.totalValue, 0);
  const alerts = currentUserType === "admin" ? collectAdminAlerts() : [];
  const todayWorkouts = students.reduce((total, student) => {
    const workout = getCurrentStudentWorkout(student.name);
    return total + (workout && getWorkoutPeriodStatus(workout).state === "active" ? 1 : 0);
  }, 0);

  const cards = [
    ["Alunos ativos", students.length, "Com cadastro no app"],
    ["Treinos de hoje", todayWorkouts, "Fichas ativas ou recomendadas"],
    ["Cobrancas pendentes", pendingBilling.length, formatCurrencyNumber(pendingValue)],
    ["Alertas importantes", alerts.length, "Prioridades pendentes"],
    ["Aulas previstas no mes", monthLessons, `${formatCurrencyNumber(monthRevenue)} previsto`],
  ];

  metricsGrid.classList.add("home-dashboard-grid");
  metricsGrid.innerHTML = "";
  cards.forEach(([label, value, detail]) => {
    const card = document.createElement("article");
    card.className = "metric home-metric-card";
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    const valueEl = document.createElement("strong");
    valueEl.textContent = value;
    const detailEl = document.createElement("small");
    detailEl.textContent = detail;
    card.append(labelEl, valueEl, detailEl);
    metricsGrid.appendChild(card);
  });
}

function renderMissingTrainingDaysPanel() {
  if (!adminDashboard) return;
  const missing = loadStudents().filter((student) => !normalizeBillingDays(student.billingDays).length);
  let panel = document.querySelector("#missing-training-days-panel");

  if (!missing.length) {
    panel?.remove();
    return;
  }

  if (!panel) {
    panel = document.createElement("article");
    panel.id = "missing-training-days-panel";
    panel.className = "missing-training-days-panel";
    adminDashboard.appendChild(panel);
  }

  panel.innerHTML = "";
  const title = document.createElement("strong");
  title.textContent = "Cadastros incompletos";
  const detail = document.createElement("span");
  detail.className = "admin-card-detail";
  const detailNumber = document.createElement("b");
  detailNumber.className = "admin-card-number";
  detailNumber.textContent = `${missing.length} aluno(s)`;
  const detailText = document.createElement("small");
  detailText.textContent = "sem dias de treino cadastrados.";
  detail.append(detailNumber, detailText);
  const list = document.createElement("div");
  list.className = "missing-training-days-list";

  missing.slice(0, 5).forEach((student) => {
    const row = document.createElement("div");
    row.className = "missing-training-days-item";
    const name = document.createElement("small");
    name.textContent = `${student.name} | ${student.plan || "Plano não informado"}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.dataset.completeStudentDays = student.id || student.name;
    button.textContent = "Completar cadastro";
    row.append(name, button);
    list.appendChild(row);
  });

  if (missing.length > 5) {
    const more = document.createElement("small");
    more.className = "missing-training-days-more";
    more.textContent = `+${missing.length - 5} alunos...`;
    list.appendChild(more);
  }

  panel.append(title, detail, list);
}

function getNextStudentLesson(studentName) {
  const activePackage = getActivePackage(studentName);
  if (!activePackage) return null;
  const usedDateKeys = new Set(loadCheckins().filter((checkin) => checkin.packageId === activePackage.id).map((checkin) => checkin.dateKey));
  return generatePackageSchedule(activePackage).find((lesson) => lesson.dateKey >= getDateKey() && !usedDateKeys.has(lesson.dateKey)) || null;
}

function renderStudentTopSummary(studentName, workout = null, activeSession = null) {
  const treinoView = document.querySelector("#treino");
  const layout = treinoView?.querySelector(".student-training-layout");
  if (!treinoView || !layout || !studentName) return;

  const student = getStudentByName(studentName);
  const monthKey = currentMonthKey();
  const projection = student ? getStudentBillingProjection(student, monthKey) : null;
  const nextLesson = getNextStudentLesson(studentName);
  const recommended = activeSession?.title || (workout ? getOrderedWorkoutSessions(workout)[0]?.title : "") || "Sem treino ativo";
  const remainingLessons = projection ? Math.max(projection.predictedLessons - projection.completedLessons, 0) : 0;

  const summary = getOrCreateElement("student-top-summary", "student-top-summary", "section");
  summary.innerHTML = "";

  const heading = document.createElement("div");
  heading.className = "student-top-summary-head";
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Resumo do aluno";
  const headingTitle = document.createElement("h3");
  headingTitle.textContent = studentName;
  const headingPlan = document.createElement("span");
  headingPlan.textContent = student?.plan || "Plano nao informado";
  heading.append(eyebrow, headingTitle, headingPlan);

  const grid = document.createElement("div");
  grid.className = "student-top-summary-grid";
  [
    ["Proxima aula", nextLesson ? `${nextLesson.date} | ${nextLesson.time || "horario nao informado"}` : "Sem aula prevista"],
    ["Aulas previstas", projection?.predictedLessons ?? 0],
    ["Realizadas", projection?.completedLessons ?? 0],
    ["Restantes", remainingLessons],
    ["Treino recomendado", recommended],
    ["Pagamento", student?.payment || "Sem status"],
  ].forEach(([label, value]) => {
    const item = document.createElement("article");
    item.className = "student-top-summary-item";
    const labelEl = document.createElement("small");
    labelEl.textContent = label;
    const valueEl = document.createElement("strong");
    valueEl.textContent = value;
    item.append(labelEl, valueEl);
    grid.appendChild(item);
  });

  summary.append(heading, grid);
  layout.insertAdjacentElement("beforebegin", summary);
}

function hasCompletedSessionToday(studentName, workoutId, sessionId) {
  const today = formatToday();
  return loadWorkoutFeedbacks().some((feedback) =>
    feedback.studentName === studentName &&
    feedback.workoutId === workoutId &&
    (!sessionId || feedback.sessionId === sessionId) &&
    feedback.date === today
  );
}

function fillLoadChartModeSelect(select) {
  if (!select || select.options.length) return;
  loadChartModes.forEach((mode) => {
    const option = document.createElement("option");
    option.value = mode.value;
    option.textContent = mode.label;
    select.appendChild(option);
  });
  select.value = "last10";
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
  root.querySelectorAll("#student-value, #student-class-value, #package-value, #dropin-value, #manual-checkin-value, #agenda-dropin-value").forEach((input) => {
    input.inputMode = "numeric";
    input.addEventListener("input", () => {
      input.value = formatCurrencyBR(input.value);
    });
  });

  root.querySelectorAll("#student-due, #student-birth-date, #student-start-date, #assessment-date, #workout-start-date, #workout-due-date, #package-start, #package-end, #checkin-filter-date, #dropin-date, #makeup-date, #personal-reschedule-date, #lesson-history-start, #lesson-history-end, #admin-agenda-date, #agenda-makeup-date, #agenda-dropin-date").forEach((input) => {
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

function getPersonalRecordsSnapshot() {
  const bestByKey = {};
  loadProgressRecords()
    .filter((record) => !record.prescribed)
    .forEach((record) => {
      const value = parseLoad(record.load);
      if (value === null) return;
      const key = `${record.studentName}::${record.exerciseKey || record.exerciseName}`;
      if (!bestByKey[key] || value > bestByKey[key].value) {
        bestByKey[key] = {
          studentName: record.studentName,
          studentId: record.studentId || getStudentIdByName(record.studentName),
          exerciseKey: record.exerciseKey || "",
          exerciseName: record.exerciseName || "",
          workoutTitle: record.workoutTitle || "",
          load: record.load,
          value,
          date: record.date || "",
          sets: record.sets || "",
          reps: record.reps || "",
          note: record.note || "",
          timestamp: record.timestamp || 0,
        };
      }
    });
  return Object.values(bestByKey);
}

function getAppStateSnapshot() {
  return {
    schemaVersion: 2,
    savedAt: new Date().toISOString(),
    deletionTombstones: loadDeletionTombstones(),
    students: loadStudents(),
    workouts: loadWorkouts(),
    loadProgress: loadProgressRecords(),
    assessments: loadAssessments(),
    checkins: loadCheckins(),
    classPackages: loadClassPackages(),
    packageModels: loadPackageModels(),
    dropInClasses: loadDropInClasses(),
    agendaEvents: loadAgendaEvents(),
    classGroups: loadClassGroups(),
    makeupCredits: loadMakeupCredits(),
    workoutFeedbacks: loadWorkoutFeedbacks(),
    resolvedAlerts: loadResolvedAlerts(),
    personalRecords: getPersonalRecordsSnapshot(),
    billingSettings: loadBillingSettings(),
    financialHistory: loadFinancialHistory(),
  };
}

function getAppStateAuditCounts(state = getAppStateSnapshot()) {
  const workouts = state.workouts || {};
  return {
    students: normalizeListData(state.students || []).length,
    workouts: Object.values(workouts).reduce((total, items) => total + normalizeListData(items).length, 0),
    assessments: normalizeListData(state.assessments || []).length,
    loadProgress: normalizeListData(state.loadProgress || []).length,
    feedbacks: normalizeListData(state.workoutFeedbacks || []).length,
    personalRecords: normalizeListData(state.personalRecords || []).length || getPersonalRecordsSnapshot().length,
    classPackages: normalizeListData(state.classPackages || []).length,
    packageModels: normalizeListData(state.packageModels || []).length,
    checkins: normalizeListData(state.checkins || []).length,
    dropInClasses: normalizeListData(state.dropInClasses || []).length,
    agendaEvents: normalizeListData(state.agendaEvents || []).length,
    classGroups: normalizeListData(state.classGroups || []).length,
    makeupCredits: normalizeListData(state.makeupCredits || []).length,
    resolvedAlerts: normalizeListData(state.resolvedAlerts || []).length,
    financialHistory: normalizeListData(state.financialHistory || []).length,
    deletionTombstones: normalizeDeletionTombstones(state.deletionTombstones || []).length,
  };
}

function getMergeItemKey(item, fallbackPrefix = "item") {
  const id = String(item?.id || "").trim();
  if (id) return id;
  const fallbackParts = [
    item?.studentId,
    item?.studentName,
    item?.name,
    item?.email,
    item?.monthKey,
    item?.dateKey,
    item?.date,
    item?.time,
    item?.exerciseKey,
    item?.exerciseName,
    item?.createdAt,
    item?.timestamp,
  ].map((part) => String(part || "").trim()).filter(Boolean);
  return fallbackParts.length ? fallbackParts.join("::") : fallbackPrefix;
}

function normalizeDeletionTombstones(tombstones = []) {
  const cutoff = Date.now() - tombstoneRetentionMs;
  const merged = new Map();
  normalizeListData(tombstones).forEach((item) => {
    if (!item || typeof item !== "object") return;
    const collection = String(item.collection || "").trim();
    const itemId = String(item.itemId || item.id || "").trim();
    if (!collection || !itemId) return;
    const deletedAt = item.deletedAt || new Date().toISOString();
    const deletedTime = Date.parse(deletedAt);
    if (Number.isFinite(deletedTime) && deletedTime < cutoff) return;
    const key = `${collection}::${itemId}`;
    const previous = merged.get(key);
    if (previous && Date.parse(previous.deletedAt || "") > Date.parse(deletedAt || "")) return;
    merged.set(key, {
      id: key,
      collection,
      itemId,
      name: String(item.name || "").trim(),
      studentId: String(item.studentId || "").trim(),
      studentName: String(item.studentName || "").trim(),
      deletedAt,
      reason: String(item.reason || "exclusao_intencional").trim(),
    });
  });
  return Array.from(merged.values());
}

function loadDeletionTombstones() {
  return normalizeDeletionTombstones(getLocalJson(deletionTombstoneStorageKey, []));
}

function saveDeletionTombstones(tombstones) {
  const normalized = normalizeDeletionTombstones(tombstones);
  try {
    localStorage.setItem(deletionTombstoneStorageKey, JSON.stringify(normalized));
    persistAppDataMeta();
  } catch (error) {
    console.warn("Nao foi possivel salvar tombstones no cache local.", error);
  }
  return normalized;
}

function getTombstoneKey(collection, itemId) {
  return `${String(collection || "").trim()}::${String(itemId || "").trim()}`;
}

function createTombstoneSet(tombstones = []) {
  return new Set(normalizeDeletionTombstones(tombstones).map((item) => getTombstoneKey(item.collection, item.itemId)));
}

function hasDeletionTombstone(tombstoneSet, collection, itemId) {
  if (!collection || !itemId) return false;
  return tombstoneSet.has(getTombstoneKey(collection, itemId));
}

function addDeletionTombstones(entries = []) {
  const existing = loadDeletionTombstones();
  const deletedAt = new Date().toISOString();
  const next = [
    ...existing,
    ...entries
      .filter((entry) => entry?.collection && entry?.itemId)
      .map((entry) => ({
        ...entry,
        deletedAt: entry.deletedAt || deletedAt,
        reason: entry.reason || "exclusao_intencional",
      })),
  ];
  return saveDeletionTombstones(next);
}

function getItemTombstoneIds(item = {}) {
  const ids = [
    item.id,
    getMergeItemKey(item, ""),
  ].map((value) => String(value || "").trim()).filter(Boolean);
  return Array.from(new Set(ids));
}

function isItemDeletedByTombstone(item, collection, tombstoneSet) {
  return getItemTombstoneIds(item).some((id) => hasDeletionTombstone(tombstoneSet, collection, id));
}

function filterListByTombstones(items = [], collection, tombstoneSet = createTombstoneSet()) {
  return normalizeListData(items).filter((item) => !isItemDeletedByTombstone(item, collection, tombstoneSet));
}

function filterWorkoutsByTombstones(workouts = {}, tombstoneSet = createTombstoneSet()) {
  const result = {};
  Object.entries(workouts && typeof workouts === "object" ? workouts : {}).forEach(([studentName, items]) => {
    const visible = filterListByTombstones(items, "workouts", tombstoneSet);
    if (visible.length && !hasDeletionTombstone(tombstoneSet, "workoutStudents", studentName)) {
      result[studentName] = visible;
    }
  });
  return result;
}

function mergeListsById(onlineItems = [], localItems = [], options = {}) {
  const collection = options.collection || "";
  const tombstoneSet = options.tombstoneSet || createTombstoneSet();
  const merged = new Map();
  normalizeListData(onlineItems).forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const key = getMergeItemKey(item, `online-${index}`);
    if (collection && hasDeletionTombstone(tombstoneSet, collection, key)) return;
    if (key) {
      merged.set(key, { ...item });
    }
  });
  normalizeListData(localItems).forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const key = getMergeItemKey(item, `local-${index}`);
    if (collection && hasDeletionTombstone(tombstoneSet, collection, key)) return;
    if (key) {
      merged.set(key, { ...(merged.get(key) || {}), ...item });
    } else {
      merged.set(`local-${merged.size}-${Date.now()}`, { ...item });
    }
  });
  return Array.from(merged.values());
}

function mergeStudentsById(onlineStudents = [], localStudents = [], tombstoneSet = createTombstoneSet()) {
  return normalizeStudentsData(mergeListsById(onlineStudents, localStudents, { collection: "students", tombstoneSet })).map((student) => {
    const status = String(student.syncStatus || student.sync_status || "").trim();
    return {
      ...student,
      syncStatus: status === "pending" ? "pending" : "synced",
      syncError: String(student.syncError || student.sync_error || "").trim(),
      syncUpdatedAt: student.syncUpdatedAt || student.sync_updated_at || "",
    };
  });
}

function mergeWorkoutsByStudent(onlineWorkouts = {}, localWorkouts = {}, tombstoneSet = createTombstoneSet()) {
  const merged = { ...(onlineWorkouts && typeof onlineWorkouts === "object" ? onlineWorkouts : {}) };
  Object.entries(localWorkouts && typeof localWorkouts === "object" ? localWorkouts : {}).forEach(([studentKey, workouts]) => {
    if (hasDeletionTombstone(tombstoneSet, "workoutStudents", studentKey)) {
      delete merged[studentKey];
      return;
    }
    merged[studentKey] = mergeListsById(merged[studentKey] || [], workouts || [], { collection: "workouts", tombstoneSet });
  });
  return filterWorkoutsByTombstones(merged, tombstoneSet);
}

function mergeAppStateForSupabase(onlineState = {}, localState = getAppStateSnapshot()) {
  const deletionTombstones = normalizeDeletionTombstones([
    ...(onlineState?.deletionTombstones || []),
    ...(localState?.deletionTombstones || []),
  ]);
  const tombstoneSet = createTombstoneSet(deletionTombstones);
  return {
    ...onlineState,
    ...localState,
    schemaVersion: Math.max(Number(onlineState?.schemaVersion) || 0, Number(localState?.schemaVersion) || 0, 2),
    savedAt: new Date().toISOString(),
    deletionTombstones,
    students: mergeStudentsById(onlineState?.students || [], localState?.students || [], tombstoneSet),
    workouts: mergeWorkoutsByStudent(onlineState?.workouts || {}, localState?.workouts || {}, tombstoneSet),
    loadProgress: mergeListsById(onlineState?.loadProgress || [], localState?.loadProgress || [], { collection: "loadProgress", tombstoneSet }),
    assessments: mergeListsById(onlineState?.assessments || [], localState?.assessments || [], { collection: "assessments", tombstoneSet }),
    checkins: mergeListsById(onlineState?.checkins || [], localState?.checkins || [], { collection: "checkins", tombstoneSet }),
    classPackages: mergeListsById(onlineState?.classPackages || [], localState?.classPackages || [], { collection: "classPackages", tombstoneSet }),
    packageModels: mergeListsById(onlineState?.packageModels || [], localState?.packageModels || [], { collection: "packageModels", tombstoneSet }),
    dropInClasses: mergeListsById(onlineState?.dropInClasses || [], localState?.dropInClasses || [], { collection: "dropInClasses", tombstoneSet }),
    agendaEvents: mergeListsById(onlineState?.agendaEvents || [], localState?.agendaEvents || [], { collection: "agendaEvents", tombstoneSet }),
    classGroups: mergeListsById(onlineState?.classGroups || [], localState?.classGroups || [], { collection: "classGroups", tombstoneSet }),
    makeupCredits: mergeListsById(onlineState?.makeupCredits || [], localState?.makeupCredits || [], { collection: "makeupCredits", tombstoneSet }),
    workoutFeedbacks: mergeListsById(onlineState?.workoutFeedbacks || [], localState?.workoutFeedbacks || [], { collection: "workoutFeedbacks", tombstoneSet }),
    resolvedAlerts: mergeListsById(onlineState?.resolvedAlerts || [], localState?.resolvedAlerts || [], { collection: "resolvedAlerts", tombstoneSet }),
    financialHistory: mergeListsById(onlineState?.financialHistory || [], localState?.financialHistory || [], { collection: "financialHistory", tombstoneSet }),
    billingSettings: {
      ...(onlineState?.billingSettings || {}),
      ...(localState?.billingSettings || {}),
    },
  };
}

async function fetchSupabaseAppStateData(client = getSupabaseAppStateClient()) {
  if (!client) {
    return { ok: false, error: { message: "Cliente Supabase indisponivel." } };
  }

  try {
    const { data, error } = await client
      .from(supabaseTables.appState)
      .select("data,updated_at")
      .eq("id", "main")
      .maybeSingle();

    if (error) {
      logSupabaseAppStateError("carregar para mesclagem", error);
      return { ok: false, error };
    }

    return {
      ok: true,
      data: data?.data || null,
      updatedAt: data?.updated_at || "",
      missing: !data?.data,
    };
  } catch (error) {
    logSupabaseAppStateError("carregar para mesclagem por rede/CDN", error);
    return { ok: false, error };
  }
}

function markStudentsSyncStatus(studentIds = [], status = "pending", error = "") {
  const ids = new Set(studentIds.filter(Boolean));
  if (!ids.size) return;

  const students = loadStudents().map((student) => {
    if (!ids.has(student.id)) return student;
    return {
      ...student,
      syncStatus: status,
      syncError: status === "pending" ? String(error || "Aguardando sincronizacao com Supabase.").slice(0, 300) : "",
      syncUpdatedAt: new Date().toISOString(),
    };
  });
  memoryStudents = normalizeStudentsData(students);
  try {
    localStorage.setItem(studentStorageKey, JSON.stringify(memoryStudents));
    persistAppDataMeta();
  } catch (storageError) {
    console.warn("Nao foi possivel marcar status de sincronizacao do aluno no cache local.", storageError);
  }
}

function getPendingSupabaseSync() {
  try {
    const saved = localStorage.getItem(pendingSupabaseSyncStorageKey);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function setPendingSupabaseSync(context = "alteracao", error = "") {
  const previous = getPendingSupabaseSync() || {};
  const contexts = Array.from(new Set([...(previous.contexts || []), context].filter(Boolean)));
  const payload = {
    pending: true,
    contexts,
    lastError: String(error || "Supabase indisponivel.").slice(0, 500),
    attempts: Number(previous.attempts || 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(pendingSupabaseSyncStorageKey, JSON.stringify(payload));
  } catch (storageError) {
    console.warn("Nao foi possivel registrar pendencia de sincronizacao.", storageError);
  }
  return payload;
}

function clearPendingSupabaseSync() {
  try {
    localStorage.removeItem(pendingSupabaseSyncStorageKey);
  } catch {
    // Controle auxiliar; se falhar, o app segue com cache local.
  }
}

function getPendingStudentIdsFromLocalCache() {
  return loadStudents()
    .filter((student) => student.syncStatus === "pending")
    .map((student) => student.id)
    .filter(Boolean);
}

async function persistAppStateSafely(options = {}) {
  const {
    context = "alteracao",
    showSuccess = false,
    pendingStudentIds = [],
  } = options;

  if (isApplyingRemoteState) return { ok: true, skipped: true, reason: "applying-remote-state" };

  window.clearTimeout(supabaseSyncTimer);
  console.info("Persistencia segura solicitada.", { context });
  if (!navigator.onLine) {
    const offlineMessage = "Modo offline. Dados mantidos no localStorage e aguardando sincronizacao.";
    setPendingSupabaseSync(context, offlineMessage);
    showOfflineNotice();
    return { ok: false, skipped: true, reason: "offline", error: { message: offlineMessage } };
  }
  const result = await syncAppStateToSupabase();

  if (result?.ok) {
    clearPendingSupabaseSync();
    markStudentsSyncStatus([...pendingStudentIds, ...getPendingStudentIdsFromLocalCache()], "synced");
    console.info("Salvo no Supabase.", {
      context,
      via: result.via || "supabase",
      auditoria: getAppStateAuditCounts(),
    });
    if (showSuccess) showMessage("Salvo no Supabase.");
    return result;
  }

  const message = getStepErrorMessage(result?.error);
  setPendingSupabaseSync(context, message);
  markStudentsSyncStatus([...pendingStudentIds, ...getPendingStudentIdsFromLocalCache()], "pending", message);
  console.error("Nao sincronizado com Supabase. Dados mantidos no localStorage como backup temporario.", {
    context,
    erro: result?.error,
  });
  if (showSuccess) showMessage("Nao sincronizado. Dados mantidos no navegador e aguardando nova tentativa.", "error");
  return { ok: false, error: result?.error || { message } };
}

function queueSupabaseAppStateSync(context = "alteracao", options = {}) {
  if (isApplyingRemoteState) return supabaseSyncPromise;
  window.clearTimeout(supabaseSyncTimer);
  console.info("Sincronizacao app_state solicitada pela fila central.", { context });
  supabaseSyncPromise = supabaseSyncPromise
    .catch(() => null)
    .then(() => persistAppStateSafely({ context, showSuccess: options.showSuccess !== false }));
  return supabaseSyncPromise;
}

async function retryPendingAppStateSync(context = "retry pendente") {
  if (!navigator.onLine) {
    showOfflineNotice();
    return { ok: false, skipped: true, reason: "offline" };
  }
  const pending = getPendingSupabaseSync();
  const pendingStudentIds = getPendingStudentIdsFromLocalCache();
  if (!pending?.pending && !pendingStudentIds.length) return { ok: true, skipped: true, reason: "no-pending-sync" };
  console.info("Tentando reenviar pendencias locais ao Supabase.", {
    context,
    pending,
    pendingStudents: pendingStudentIds.length,
  });
  return persistAppStateSafely({ context, pendingStudentIds });
}

function writeAppStateToLocalStorage(state) {
  if (!state || typeof state !== "object") return false;

  isApplyingRemoteState = true;
  try {
    const tombstoneSet = createTombstoneSet(state.deletionTombstones || []);
    memoryStudents = normalizeStudentsData(filterListByTombstones(state.students || defaultStudents, "students", tombstoneSet));
    memoryWorkouts = normalizeWorkoutsData(filterWorkoutsByTombstones(state.workouts || {}, tombstoneSet));
    memoryLoadProgress = filterListByTombstones(state.loadProgress || [], "loadProgress", tombstoneSet).map(normalizeStudentLinkedRecord);
    memoryAssessments = filterListByTombstones(state.assessments || [], "assessments", tombstoneSet).map(normalizeStudentLinkedRecord);
    memoryCheckins = filterListByTombstones(state.checkins || [], "checkins", tombstoneSet).map(normalizeStudentLinkedRecord);
    memoryPackages = normalizeClassPackages(filterListByTombstones(state.classPackages || [], "classPackages", tombstoneSet));
    memoryPackageModels = normalizePackageModels(state.packageModels || []);
    memoryDropIns = normalizeDropInClasses(filterListByTombstones(state.dropInClasses || [], "dropInClasses", tombstoneSet));
    memoryAgendaEvents = normalizeAgendaEvents(filterListByTombstones(state.agendaEvents || [], "agendaEvents", tombstoneSet));
    memoryClassGroups = normalizeClassGroups(filterListByTombstones(state.classGroups || [], "classGroups", tombstoneSet));
    memoryMakeups = normalizeMakeupCredits(filterListByTombstones(state.makeupCredits || [], "makeupCredits", tombstoneSet));
    memoryFeedbacks = normalizeWorkoutFeedbacks(filterListByTombstones(state.workoutFeedbacks || [], "workoutFeedbacks", tombstoneSet));
    memoryFinancialHistory = normalizeFinancialHistory(filterListByTombstones(state.financialHistory || [], "financialHistory", tombstoneSet));

    localStorage.setItem(deletionTombstoneStorageKey, JSON.stringify(normalizeDeletionTombstones(state.deletionTombstones || [])));
    localStorage.setItem(studentStorageKey, JSON.stringify(memoryStudents));
    localStorage.setItem(workoutStorageKey, JSON.stringify(memoryWorkouts));
    localStorage.setItem(loadProgressStorageKey, JSON.stringify(memoryLoadProgress));
    localStorage.setItem(assessmentStorageKey, JSON.stringify(memoryAssessments));
    localStorage.setItem(checkinStorageKey, JSON.stringify(memoryCheckins));
    localStorage.setItem(packageStorageKey, JSON.stringify(memoryPackages));
    localStorage.setItem(packageModelStorageKey, JSON.stringify(memoryPackageModels));
    localStorage.setItem(dropInStorageKey, JSON.stringify(memoryDropIns));
    localStorage.setItem(agendaEventStorageKey, JSON.stringify(memoryAgendaEvents));
    localStorage.setItem(classGroupStorageKey, JSON.stringify(memoryClassGroups));
    localStorage.setItem(makeupStorageKey, JSON.stringify(memoryMakeups));
    localStorage.setItem(feedbackStorageKey, JSON.stringify(memoryFeedbacks));
    localStorage.setItem(financialHistoryStorageKey, JSON.stringify(memoryFinancialHistory));
    localStorage.setItem(resolvedAlertsStorageKey, JSON.stringify(normalizeResolvedAlerts(state.resolvedAlerts || [])));
    if (state.billingSettings) {
      localStorage.setItem(billingSettingsStorageKey, JSON.stringify(state.billingSettings));
    }
    persistAppDataMeta();
    console.info(`Auditoria app_state carregado do Supabase/cache: ${JSON.stringify(getAppStateAuditCounts(state))}`);
    return true;
  } catch (error) {
    console.error("Nao foi possivel aplicar dados do Supabase no localStorage.", error);
    return false;
  } finally {
    isApplyingRemoteState = false;
  }
}

async function loadSupabaseAppState(options = {}) {
  const client = getSupabaseAppStateClient();
  if (!client) return "unconfigured";

  const loadOnce = async () => {
    const attemptResult = await fetchSupabaseAppStateData(client);
    if (!attemptResult.ok) throw attemptResult.error || new Error("Falha ao carregar app_state.");
    return attemptResult;
  };
  const result = options.retry === false
    ? await withTimeout(loadOnce(), supabaseQueryTimeoutMs, "carregar app_state")
    : await retryAsyncOperation("carregar app_state do Supabase", loadOnce, { recoverableOnly: false });
  if (!result.ok) return "failed";
  if (result.missing) return "missing";

  const localState = getAppStateSnapshot();
  const mergedState = mergeAppStateForSupabase(result.data || {}, localState);
  console.info("app_state carregado do Supabase e mesclado com cache local.", {
    online: getAppStateAuditCounts(result.data || {}),
    local: getAppStateAuditCounts(localState),
    merged: getAppStateAuditCounts(mergedState),
  });
  return writeAppStateToLocalStorage(mergedState) ? "loaded" : "failed";
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
  if (isApplyingRemoteState) return { ok: true, skipped: true, reason: "applying-remote-state" };

  const client = getSupabaseAppStateClient();
  if (!client) {
    console.error("syncAppStateToSupabase interrompido: cliente Supabase indisponivel.");
    return { ok: false, error: { message: "Cliente Supabase indisponivel." } };
  }

  const localState = getAppStateSnapshot();
  const remoteResult = await retryAsyncOperation("carregar app_state para sincronizacao", async () => {
    const attemptResult = await fetchSupabaseAppStateData(client);
    if (!attemptResult.ok) throw attemptResult.error || new Error("Falha ao carregar app_state para sincronizacao.");
    return attemptResult;
  }, { recoverableOnly: false }).catch((error) => ({ ok: false, error }));
  if (!remoteResult.ok) {
    console.error("Sincronizacao interrompida: nao foi possivel carregar app_state online para mesclagem segura.", remoteResult.error);
    showSupabaseSyncWarning("Dados salvos localmente. Supabase indisponivel no momento.");
    return { ok: false, error: remoteResult.error };
  }

  const appState = mergeAppStateForSupabase(remoteResult.data || {}, localState);
  appState.students = normalizeStudentsData(appState.students || []).map((student) => ({
    ...student,
    syncStatus: "synced",
    syncError: "",
    syncUpdatedAt: new Date().toISOString(),
  }));
  memoryStudents = normalizeStudentsData(appState.students || []);
  try {
    localStorage.setItem(studentStorageKey, JSON.stringify(memoryStudents));
    persistAppDataMeta();
  } catch (storageError) {
    console.warn("Nao foi possivel atualizar o cache local apos mesclagem segura de alunos.", storageError);
  }
  const payload = {
    id: "main",
    data: appState,
    updated_at: new Date().toISOString(),
  };
  const auditCounts = getAppStateAuditCounts(appState);
  console.info("Mesclagem segura app_state antes do envio.", {
    online: getAppStateAuditCounts(remoteResult.data || {}),
    local: getAppStateAuditCounts(localState),
    merged: auditCounts,
    remoteUpdatedAt: remoteResult.updatedAt || "",
  });
  console.info(`Enviando app_state para Supabase: ${JSON.stringify({
    table: supabaseTables.appState,
    id: payload.id,
    updated_at: payload.updated_at,
    collections: auditCounts,
  })}`);

  try {
    const { data, error } = await retryAsyncOperation("upsert app_state Supabase", async () => {
      const result = await client
        .from(supabaseTables.appState)
        .upsert(payload, { onConflict: "id" })
        .select("id,updated_at")
        .single();
      if (result.error) throw result.error;
      return result;
    }, { recoverableOnly: false });

    if (error) {
      console.error(`Erro retornado pelo upsert app_state: ${JSON.stringify(error)}`);
      logSupabaseAppStateError("salvar", error);
      const restResult = await upsertAppStateWithRest(payload);
      if (restResult.ok) {
        console.info(`Upsert app_state via REST concluido com sucesso: ${JSON.stringify(restResult.data)}`);
        console.info(`Auditoria app_state sincronizado via REST: ${JSON.stringify(auditCounts)}`);
        writeAppStateToLocalStorage(appState);
        return { ok: true, data: restResult.data, via: "rest" };
      }
      showSupabaseSyncWarning("Dados salvos localmente. Supabase indisponivel no momento.");
      console.error(`Erro retornado pelo fallback REST app_state: ${JSON.stringify(restResult.error)}`);
      logSupabaseAppStateError("salvar via REST", restResult.error);
      return { ok: false, error: restResult.error || error };
    }

    console.info(`Upsert app_state concluido com sucesso: ${JSON.stringify(data)}`);
    console.info(`Auditoria app_state sincronizado: ${JSON.stringify(auditCounts)}`);
    writeAppStateToLocalStorage(appState);
    return { ok: true, data, via: "supabase" };
  } catch (error) {
    logSupabaseAppStateError("salvar por rede/CDN", error);
    const restResult = await upsertAppStateWithRest(payload);
    if (restResult.ok) {
      console.info(`Upsert app_state via REST concluido com sucesso: ${JSON.stringify(restResult.data)}`);
      console.info(`Auditoria app_state sincronizado via REST: ${JSON.stringify(auditCounts)}`);
      writeAppStateToLocalStorage(appState);
      return { ok: true, data: restResult.data, via: "rest" };
    }
    showSupabaseSyncWarning("Dados salvos localmente. Supabase indisponivel no momento.");
    console.error(`Erro retornado pelo fallback REST app_state: ${JSON.stringify(restResult.error)}`);
    logSupabaseAppStateError("salvar via REST", restResult.error);
    return { ok: false, error: restResult.error || error };
  }
}

async function flushAppStateSyncNow(context = "manual") {
  window.clearTimeout(supabaseSyncTimer);
  console.info(`Sincronizando app_state agora: ${context}`);
  const result = await persistAppStateSafely({ context, showSuccess: false });
  if (!result?.ok) {
    console.error("Falha ao sincronizar app_state imediatamente.", {
      context,
      error: result?.error,
    });
  }
  return result;
}

function getStepErrorMessage(error) {
  if (!error) return "erro desconhecido";
  return error.message || error.details || error.hint || JSON.stringify(error);
}

function logLocalPersistenceAudit(context = "local") {
  console.info(`Auditoria de persistencia (${context}): ${JSON.stringify(getAppStateAuditCounts())}`);
}

function getSupabaseUserRole(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  if (email === personalAdminEmail) return "admin";

  const role = String(user?.user_metadata?.role || user?.app_metadata?.role || "").toLowerCase();
  return role === "admin" || role === "personal" ? "admin" : "student";
}

function findStudentFromSupabaseUser(user) {
  const metadataName = user?.user_metadata?.student_name || user?.user_metadata?.studentName || user?.user_metadata?.name || "";
  const email = String(user?.email || "").toLowerCase();
  const authUserId = String(user?.id || "");
  const students = loadStudents();
  console.info("Buscando aluno vinculado no app_state/localStorage.", {
    email,
    auth_user_id: authUserId,
    totalAlunos: students.length,
    alunos: students.map((student) => ({
      id: student.id,
      nome: student.name,
      email: student.email,
      email_login: student.email_login || "",
      auth_user_id: student.auth_user_id || student.authUserId || student.supabaseUserId || "",
    })),
  });

  return students.find((student) => (
      student.authUserId === authUserId
      || student.supabaseUserId === authUserId
      || student.auth_user_id === authUserId
    ))
    || students.find((student) => student.email_login && student.email_login.toLowerCase() === email)
    || students.find((student) => student.email && student.email.toLowerCase() === email)
    || students.find((student) => student.name === metadataName)
    || null;
}

function saveSupabaseStudentLink(studentName, user) {
  if (!studentName || !user?.id) return;

  const students = loadStudents();
  const index = students.findIndex((student) => student.name === studentName);
  if (index < 0) return;

  const email = String(user.email || "").toLowerCase();
  if (getStudentAuthUserId(students[index]) === user.id
    && (!email || (students[index].email === email && students[index].email_login === email))
  ) return;

  students[index] = {
    ...students[index],
    email: students[index].email || email,
    email_login: email,
    supabaseUserId: user.id,
    authUserId: user.id,
    auth_user_id: user.id,
    role: "aluno",
  };
  saveStudents(students);
}

function isLikelyRealEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return false;
  const domain = value.split("@")[1] || "";
  if (!domain || !domain.includes(".")) return false;
  if (/(teste|test|fake|falso|exemplo|example|email|sememail|naotem|noemail)/i.test(value)) return false;
  if (["example.com", "example.com.br", "teste.com", "test.com", "email.com", "dominio.com"].includes(domain)) return false;
  return true;
}

function getTemporaryStudentPassword(student = {}) {
  const digits = String(student.phone || student.whatsapp || "").replace(/\D/g, "");
  const lastDigits = digits.length >= 4 ? digits.slice(-4) : "1234";
  return `jv${lastDigits}`;
}

function getStudentAuthUserId(student = {}) {
  return student.auth_user_id || student.authUserId || student.supabaseUserId || "";
}

function hasStudentAppAccess(student = {}) {
  return Boolean(getStudentAuthUserId(student));
}

function isSupabaseRlsError(error) {
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""} ${error?.code || ""}`.toLowerCase();
  return Number(error?.status || 0) === 403
    || text.includes("row-level security")
    || text.includes("rls")
    || text.includes("42501");
}

async function getSupabaseProfileByUser(user) {
  const client = getSupabaseClient();
  if (!client || !user?.id) return null;

  try {
    let result = await client
      .from(supabaseTables.profiles)
      .select("id,auth_user_id,email,role,student_id,name,first_login,created_at")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!result.data && !result.error) {
      result = await client
        .from(supabaseTables.profiles)
        .select("id,auth_user_id,email,role,student_id,name,first_login,created_at")
        .eq("id", user.id)
        .maybeSingle();
    }

    if (result.error) {
      console.error("Erro ao buscar profile no Supabase.", {
        auth_user_id: user.id,
        email: user.email,
        erro: result.error,
      });
      return null;
    }

    return result.data || null;
  } catch (error) {
    console.error("Erro inesperado ao buscar profile.", error);
    return null;
  }
}

async function upsertSupabaseProfile(profile) {
  const client = getSupabaseClient();
  if (!client || !profile?.auth_user_id) {
    const error = new Error("Supabase nao configurado ou auth_user_id ausente.");
    console.error("Profile nao foi salvo: configuracao invalida.", {
      supabaseConfigurado: Boolean(client),
      auth_user_id: profile?.auth_user_id || "",
      profileRecebido: profile,
    });
    return { data: null, error };
  }

  const authenticatedUserId = currentSupabaseUser?.id || "";
  if (!authenticatedUserId || profile.auth_user_id !== authenticatedUserId) {
    console.warn("Upsert de profile ignorado: o cliente so pode gravar o proprio perfil.", {
      tabela: supabaseTables.profiles,
      operacao: "upsert",
      auth_uid: authenticatedUserId,
      payload_auth_user_id: profile.auth_user_id,
      motivo: authenticatedUserId ? "auth.uid diferente do auth_user_id" : "sem usuario autenticado neste cliente",
    });
    return { data: null, error: null, skipped: true, reason: "not-profile-owner" };
  }

  const payload = {
    // A policy RLS exige que ambos correspondam a auth.uid().
    id: authenticatedUserId,
    auth_user_id: authenticatedUserId,
    email: profile.email || "",
    role: profile.role || "aluno",
    student_id: profile.student_id || null,
    name: profile.name || "",
    first_login: profile.first_login !== false,
    created_at: profile.created_at || new Date().toISOString(),
  };

  try {
    console.info("Tentando salvar profile no Supabase.", {
      tabela: supabaseTables.profiles,
      payload,
      supabaseUrl: getSupabaseConfig().url,
    });

    const { data, error } = await client
      .from(supabaseTables.profiles)
      .upsert(payload, { onConflict: "id" })
      .select("id,auth_user_id,email,role,student_id,name,first_login,created_at")
      .maybeSingle();

    if (error) {
      if (isSupabaseRlsError(error)) {
        console.warn("Profile nao foi salvo por RLS. Auth e app_state continuam funcionando.", {
          tabela: supabaseTables.profiles,
          operacao: "upsert",
          status: error.status || 403,
          auth_uid: authenticatedUserId,
          auth_user_id: payload.auth_user_id,
          email: payload.email,
          role: payload.role,
          student_id: payload.student_id,
          message: error.message || "",
        });
        return { data: null, error };
      }
      console.error("Erro ao salvar profile no Supabase.", {
        tabela: supabaseTables.profiles,
        payload,
        erro: error,
        code: error.code || "",
        message: error.message || "",
        details: error.details || "",
        hint: error.hint || "",
        possivelCausa: "Verifique se a tabela profiles existe, se auth_user_id/email/role/student_id/first_login existem e se as policies/RLS permitem upsert/select.",
      });
      return { data: null, error };
    }

    console.info("Profile salvo no Supabase.", {
      tabela: supabaseTables.profiles,
      auth_user_id: (data || payload).auth_user_id,
      email: (data || payload).email,
      role: (data || payload).role,
      student_id: (data || payload).student_id,
      first_login: (data || payload).first_login,
      retorno: data || payload,
    });
    return { data: data || payload, error: null };
  } catch (error) {
    console.error("Erro inesperado ao salvar profile.", {
      tabela: supabaseTables.profiles,
      payload,
      erro: error,
      message: error?.message || "",
      stack: error?.stack || "",
    });
    return { data: null, error };
  }
}

async function getSupabaseProfileByEmail(email) {
  const client = getSupabaseClient();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!client || !normalizedEmail) return null;

  try {
    const { data, error } = await client
      .from(supabaseTables.profiles)
      .select("id,auth_user_id,email,role,student_id,name,first_login,created_at")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar profile por email.", { email: normalizedEmail, erro: error });
      return null;
    }

    return data || null;
  } catch (error) {
    console.error("Erro inesperado ao buscar profile por email.", error);
    return null;
  }
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
          role: "aluno",
          student_name: studentName,
        },
      },
    });

    const alreadyExists = /already|registered|exists|user.*exist|already registered/i.test(error?.message || "")
      || (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0);

    console.info("Criacao de acesso do aluno no Supabase Auth.", {
      email,
      aluno: studentName,
      userId: data?.user?.id || "",
      novoUsuario: Boolean(data?.user?.id && !alreadyExists),
      emailJaExistia: Boolean(alreadyExists),
      confirmationSentAt: data?.user?.confirmation_sent_at || "",
      emailConfirmedAt: data?.user?.email_confirmed_at || "",
      error,
    });

    if (alreadyExists) {
      await signupClient.auth.signOut().catch(() => null);
      return {
        userId: "",
        error: null,
        alreadyExists: true,
        created: false,
        loginVerified: false,
      };
    }

    if (error) return { userId: "", error };

    const userId = data?.user?.id || "";
    if (!userId) {
      await signupClient.auth.signOut().catch(() => null);
      return { userId: "", error: new Error("Supabase nao retornou o id do usuario criado.") };
    }

    const validationClient = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `signup-validation-${Date.now()}`,
      },
    });
    const { data: validationData, error: validationError } = await validationClient.auth.signInWithPassword({ email, password });
    await validationClient.auth.signOut().catch(() => null);
    await signupClient.auth.signOut().catch(() => null);

    if (validationError || validationData?.user?.id !== userId) {
      console.error("Teste de login do aluno falhou apos signUp.", {
        email,
        aluno: studentName,
        auth_user_id: userId,
        erro: validationError,
        userIdValidado: validationData?.user?.id || "",
      });
      return {
        userId: "",
        error: validationError || new Error("Login de validacao nao retornou o mesmo usuario criado."),
        created: false,
        loginVerified: false,
      };
    }

    console.info("Teste de login do aluno validado com sucesso.", {
      email,
      aluno: studentName,
      auth_user_id: userId,
    });
    return {
      userId,
      error: null,
      alreadyExists: false,
      created: true,
      loginVerified: true,
    };
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

async function createStudentAccessForRecord(student) {
  const email = String(student.email_login || student.email || "").trim().toLowerCase();
  const name = String(student.name || "").trim();
  if (!name || !isLikelyRealEmail(email)) {
    return {
      student,
      temporaryPassword: "",
      created: false,
      error: new Error("Informe um e-mail real para criar o acesso do aluno."),
    };
  }

  const temporaryPassword = getTemporaryStudentPassword(student);
  console.info("Criando acesso do aluno no Supabase.", { email, aluno: name });
  const authResult = await createStudentAuthUser(email, temporaryPassword, name);
  const { userId, error } = authResult;

  if (authResult?.alreadyExists) {
    console.warn("E-mail ja possui acesso no Supabase Auth. Senha provisoria nao foi aplicada.", {
      email,
      aluno: name,
    });
    return {
      student,
      temporaryPassword: "",
      created: false,
      alreadyExists: true,
      error: new Error("Este e-mail ja possui acesso. A senha existente nao foi alterada."),
    };
  }

  if (error) {
    console.error("Erro detalhado ao criar usuario do aluno.", { email, aluno: name, erro: error });
    return { student, temporaryPassword: "", created: false, error };
  }

  if (!userId || !authResult?.loginVerified) {
    return {
      student,
      temporaryPassword: "",
      created: false,
      error: new Error("Acesso nao vinculado porque o teste de login nao foi confirmado."),
    };
  }

  const authUserId = userId;
  const linkedStudent = {
    ...student,
    supabaseUserId: authUserId,
    authUserId: authUserId,
    auth_user_id: authUserId,
    email_login: email,
    role: "aluno",
    acesso_status: "ativo",
    first_login: student.first_login === false ? false : true,
  };

  const profilePayload = {
    auth_user_id: authUserId,
    email,
    role: "aluno",
    student_id: linkedStudent.id,
    name,
    first_login: true,
  };

  console.info("Preparando profile do aluno para gravar.", {
    profilePayload,
    alunoLocal: {
      id: linkedStudent.id,
      name: linkedStudent.name,
      email: linkedStudent.email,
      auth_user_id: linkedStudent.auth_user_id,
      role: linkedStudent.role,
      first_login: linkedStudent.first_login,
    },
  });

  const profileResult = await upsertSupabaseProfile(profilePayload);

  if (profileResult.error) {
    console.warn("Acesso Auth criado, mas gravação em profiles falhou. O login do aluno segue válido pelo auth_user_id salvo no app_state/localStorage.", {
      profilePayload,
      erro: profileResult.error,
      aluno: linkedStudent.name,
      auth_user_id: authUserId,
    });
    return {
      student: linkedStudent,
      temporaryPassword,
      created: true,
      profileCreated: false,
      profileError: profileResult.error,
      error: null,
    };
  }

  console.info("Acesso do aluno criado/vinculado.", {
    email,
    auth_user_id: authUserId,
    profile: profileResult.data,
    senhaTemporariaGeradaPorWhatsApp: "gerada_e_exibida_apenas_na_mensagem_de_sucesso",
  });

  return { student: linkedStudent, temporaryPassword, created: true, profileCreated: true, error: null };
}

function showSupabaseLoginMessage(text, type = "success") {
  if (!supabaseLoginMessage) return;
  supabaseLoginMessage.textContent = text;
  supabaseLoginMessage.classList.toggle("error", type === "error");
}

function withTimeout(promise, timeoutMs = supabaseOperationTimeoutMs, label = "operacao") {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => {
      const error = new Error(`Tempo esgotado em ${label}.`);
      error.name = "OperationTimeoutError";
      error.operation = label;
      error.timeoutMs = timeoutMs;
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

function waitForRetry(delayMs) {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

async function retryAsyncOperation(operationName, operation, options = {}) {
  const {
    attempts = 3,
    delays = [800, 1800, 3600],
    recoverableOnly = true,
    timeoutMs = supabaseQueryTimeoutMs,
  } = options;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      console.info("Executando operacao com retry.", { operationName, attempt, attempts });
      return await withTimeout(Promise.resolve().then(() => operation(attempt)), timeoutMs, `${operationName} (tentativa ${attempt})`);
    } catch (error) {
      lastError = error;
      console.warn("Operacao falhou durante tentativa.", {
        operationName,
        attempt,
        attempts,
        erroOriginal: error,
        mensagem: getOriginalErrorMessage(error),
      });
      if (recoverableOnly && !isRecoverableAsyncError(error)) break;
      if (attempt < attempts) await waitForRetry(delays[Math.min(attempt - 1, delays.length - 1)] || 1000);
    }
  }

  console.error("Operacao falhou apos tentativas automaticas.", {
    operationName,
    attempts,
    erroOriginal: lastError,
    mensagem: getOriginalErrorMessage(lastError),
  });
  throw lastError || new Error(`Falha em ${operationName}.`);
}

function setSupabaseLoginButtonLoading(isLoading) {
  const submitButton = supabaseLoginForm?.querySelector('button[type="submit"]');
  if (!submitButton) return;
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Entrando..." : "Entrar";
}

function applySupabaseUserOnce(user, source = "manual") {
  if (!user?.id) return Promise.resolve(false);
  if (applySupabaseUserPromise && applyingSupabaseUserId === user.id) {
    console.info("Aplicacao de usuario Supabase ja em andamento; reutilizando tentativa.", { source, auth_user_id: user.id });
    return applySupabaseUserPromise;
  }

  applyingSupabaseUserId = user.id;
  activeLoginSource = source;
  applySupabaseUserPromise = withTimeout(applySupabaseUser(user), supabaseUserApplyTimeoutMs, "aplicar usuario Supabase")
    .finally(() => {
      applyingSupabaseUserId = "";
      applySupabaseUserPromise = null;
      activeLoginSource = "";
    });
  return applySupabaseUserPromise;
}

function scheduleSupabaseUserApplication(user, source = "auth-state") {
  if (!user?.id) return;
  window.setTimeout(() => {
    if (activeLoginSource === "login-submit" || (applySupabaseUserPromise && applyingSupabaseUserId === user.id)) {
      console.info("Evento Auth ignorado porque o login do formulario ja esta aplicando o usuario.", {
        source,
        auth_user_id: user.id,
      });
      return;
    }
    applySupabaseUserOnce(user, source).catch((error) => {
      console.error("Falha ao aplicar usuario Supabase agendado.", {
        source,
        auth_user_id: user.id,
        email: user.email || "",
        erro: error,
      });
    });
  }, 0);
}

async function applySupabaseUser(user) {
  currentSupabaseUser = user || null;
  currentSupabaseProfile = null;
  if (!user) return false;

  const userEmail = String(user.email || "").trim().toLowerCase();
  const localStudentBeforeRemote = findStudentFromSupabaseUser(user);
  const [profileResult, appStateResult] = await Promise.allSettled([
    retryAsyncOperation("carregar profile do Supabase", () => getSupabaseProfileByUser(user), { recoverableOnly: false }),
    loadSupabaseAppState({ retry: false }),
  ]);

  const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
  const appStateStatus = appStateResult.status === "fulfilled" ? appStateResult.value : "failed";
  if (profileResult.status === "rejected") {
    console.warn("Consulta de profiles falhou ou demorou. Login seguira pelo app_state quando possivel.", {
      etapa: "profiles",
      email: userEmail,
      auth_user_id: user.id,
      erro: profileResult.reason,
    });
  }
  if (appStateResult.status === "rejected") {
    console.warn("Carregamento de app_state falhou ou demorou. Login tentara usar cache local.", {
      etapa: "app_state",
      email: userEmail,
      auth_user_id: user.id,
      erro: appStateResult.reason,
    });
  }
  currentSupabaseProfile = profile;
  if (!profile) {
    console.warn("Login Supabase sem profile vinculado.", {
      auth_user_id: user.id,
      email: userEmail,
      tabelaEsperada: supabaseTables.profiles,
      buscaRealizadaPor: "auth_user_id",
      fallback: "app_state auth_user_id/email",
    });
  }
  const profileRole = String(profile?.role || "").toLowerCase();
  const metadataRole = String(user?.user_metadata?.role || user?.app_metadata?.role || "").toLowerCase();
  const role = userEmail === personalAdminEmail || profileRole === "personal"
    ? "admin"
    : profileRole === "aluno" || metadataRole === "aluno" ? "student" : getSupabaseUserRole(user);
  console.info("Login Supabase realizado.", {
    email: userEmail,
    auth_user_id: user.id,
    profile,
    roleDetectada: role,
    origemPerfil: profile ? "profiles" : "metadata/app_state",
    appStateStatus,
    alunoLocalAntesDoRemoto: localStudentBeforeRemote?.name || "",
  });

  if (role === "admin") {
    console.info("Redirecionando login Supabase para area Personal/Admin.", {
      email: userEmail,
      auth_user_id: user.id,
      motivo: userEmail === personalAdminEmail ? "email_admin_configurado" : "profile_role_personal",
    });
    if (userEmail === personalAdminEmail && (!profile || profile.role !== "personal")) {
      await withTimeout(upsertSupabaseProfile({
        auth_user_id: user.id,
        email: user.email,
        role: "personal",
        name: "Personal João Victor",
        first_login: false,
      }), supabaseQueryTimeoutMs, "salvar profile personal").catch((error) => {
        console.warn("Profile do Personal nao foi atualizado, mas o login admin sera liberado pelo e-mail configurado.", error);
      });
    }
    enterModeForSessionRestore("admin");
    saveAppLoginSession({
      role: "admin",
      provider: "supabase",
      email: userEmail,
      authUserId: user.id,
    });
    safeSetText(document.querySelector("#user-mode"), `Personal | ${user.email || "Supabase"}`);
    restoreNavigationState();
    return true;
  }

  console.info("Tentativa de login aluno: procurando vinculo no app_state/cache.", {
    email: userEmail,
    auth_user_id: user.id,
  });
  const student = (profile?.student_id
    ? loadStudents().find((item) => item.id === profile.student_id || item.auth_user_id === user.id || item.authUserId === user.id || item.supabaseUserId === user.id)
    : null) || localStudentBeforeRemote || findStudentFromSupabaseUser(user);
  if (!student) {
    const failedStages = [
      profileResult.status === "rejected" ? `profiles: ${getStepErrorMessage(profileResult.reason)}` : "",
      appStateResult.status === "rejected" ? `app_state: ${getStepErrorMessage(appStateResult.reason)}` : "",
      "vinculo do aluno: nao encontrado por auth_user_id nem e-mail",
    ].filter(Boolean);
    console.warn("Aluno nao encontrado para usuario Supabase.", {
      email: userEmail,
      auth_user_id: user.id,
      etapas: failedStages,
      alunosDisponiveis: loadStudents().map((item) => ({
        id: item.id,
        nome: item.name,
        email: item.email,
        auth_user_id: item.auth_user_id || item.authUserId || item.supabaseUserId || "",
      })),
    });
    showSupabaseLoginMessage(`Login autenticado, mas nao encontrei seu cadastro. Etapa: ${failedStages.join(" | ")}. Fale com o personal.`, "error");
    return false;
  }

  console.info("Aluno vinculado ao login Supabase encontrado.", {
    aluno: student.name,
    alunoId: student.id,
    email: student.email,
    profile,
    auth_user_id: student.auth_user_id || student.authUserId || student.supabaseUserId || "",
  });
  // Profile e opcional. O proprio aluno tenta cria-lo/atualiza-lo depois de
  // autenticado; qualquer falha fica local e nao impede o acesso via app_state.
  upsertSupabaseProfile({
    ...(profile || {}),
    auth_user_id: user.id,
    email: user.email || student.email_login || student.email || "",
    role: "aluno",
    student_id: student.id || null,
    name: student.name || "",
    first_login: profile?.first_login !== false,
  }).then((profileSyncResult) => {
    if (profileSyncResult?.data) currentSupabaseProfile = profileSyncResult.data;
    if (profileSyncResult?.error) {
      console.warn("Profile opcional do aluno ficou pendente; login continua pelo app_state.", {
        tabela: supabaseTables.profiles,
        operacao: "upsert do proprio profile",
        auth_user_id: user.id,
        erroOriginal: profileSyncResult.error,
      });
    }
  }).catch((error) => {
    console.warn("Falha local ao sincronizar profile opcional; login continua pelo app_state.", {
      tabela: supabaseTables.profiles,
      operacao: "upsert do proprio profile",
      auth_user_id: user.id,
      erroOriginal: error,
    });
  });
  const alreadyLinkedToAuth = getStudentAuthUserId(student) === user.id;
  saveSupabaseStudentLink(student.name, user);
  if (!alreadyLinkedToAuth) {
    supabaseSyncPromise
      .then((result) => console.info("Vinculo auth_user_id do aluno sincronizado apos login.", {
        aluno: student.name,
        auth_user_id: user.id,
        ok: Boolean(result?.ok),
      }))
      .catch((error) => console.warn("Vinculo auth_user_id ficou pendente de sincronizacao.", {
        aluno: student.name,
        auth_user_id: user.id,
        erro: error,
      }));
  }
  enterModeForSessionRestore("student", student.name);
  saveAppLoginSession({
    role: "student",
    studentName: student.name,
    provider: "supabase",
    email: userEmail,
    authUserId: user.id,
  });
  safeSetText(document.querySelector("#user-mode"), `Aluno | ${user.email || student.name}`);
  console.info("Redirecionando aluno autenticado para area do aluno.", {
    aluno: student.name,
    auth_user_id: user.id,
  });
  restoreNavigationState();
  return true;
}

async function restoreSupabaseSession() {
  const client = getSupabaseClient();
  if (!client) {
    showSupabaseLoginMessage("Supabase ainda nao configurado.", "error");
    return false;
  }

  if (!supabaseAuthListenerBound) {
    supabaseAuthListenerBound = true;
    client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) scheduleSupabaseUserApplication(session.user, "auth-state-change");
    });
  }

  try {
    const { data } = await retryAsyncOperation("restaurar sessao Supabase", () => client.auth.getSession(), { recoverableOnly: false });
    if (!data?.session?.user) return false;
    return await applySupabaseUserOnce(data.session.user, "restore-session");
  } catch (error) {
    console.warn("Nao foi possivel restaurar sessao Supabase apos tentativas. Login ficara disponivel.", {
      operacao: "restoreSupabaseSession",
      erroOriginal: error,
      mensagem: getOriginalErrorMessage(error),
    });
    return false;
  }
}

function normalizeStudentsData(students) {
  if (!Array.isArray(students)) return normalizeStudentsData(defaultStudents);
  const validPayments = ["Em dia", "Pendente", "Atrasado"];

  const normalized = students
    .filter((student) => student && typeof student === "object")
    .map((student) => {
      const frequency = normalizeWeeklyFrequency(student.frequency || student.weeklyFrequency);
      const billingDays = normalizeBillingDays(student.billingDays || student.trainingDays || student.weekdays || []);
      return {
        id: student.id || createId(),
        supabaseUserId: String(student.supabaseUserId || student.authUserId || "").trim(),
        authUserId: String(student.authUserId || student.supabaseUserId || "").trim(),
        auth_user_id: String(student.auth_user_id || student.authUserId || student.supabaseUserId || "").trim(),
        name: String(student.name || "").trim(),
        email: String(student.email || "").trim().toLowerCase(),
        email_login: String(student.email_login || student.email || "").trim().toLowerCase(),
        role: String(student.role || "aluno").trim().toLowerCase(),
        acesso_status: String(student.acesso_status || "").trim(),
        first_login: student.first_login === true,
        convite_enviado_em: student.convite_enviado_em || "",
        phone: String(student.phone || student.whatsapp || "").trim(),
        birthDate: String(student.birthDate || student.birth_date || "").trim(),
        plan: String(student.plan || "Plano nao informado").trim(),
        modality: String(student.modality || student.attendanceType || student.mode || "").trim(),
        startDate: String(student.startDate || student.start_date || student.enrollmentDate || "").trim(),
        frequency,
        billingDays,
        weeklySchedule: normalizeWeeklySchedule(student.weeklySchedule || student.schedule || {}, billingDays),
        billingType: normalizeBillingType(student.billingType || student.chargeType || student.billing_type),
        classValue: String(student.classValue || student.valuePerClass || student.valorAula || "").trim(),
        paymentMethod: String(student.paymentMethod || student.payment_method || "").trim(),
        billingNotes: String(student.billingNotes || student.billing_notes || student.notes || "").trim(),
        makeupLimit: normalizeMakeupLimit(student.makeupLimit ?? student.makeup_limit, frequency),
        value: String(student.value || "").trim(),
        due: String(student.due || "").trim(),
        payment: validPayments.includes(student.payment) ? student.payment : "Em dia",
        lastPaymentDate: String(student.lastPaymentDate || student.last_payment_date || "").trim(),
        syncStatus: String(student.syncStatus || student.sync_status || "synced").trim(),
        syncError: String(student.syncError || student.sync_error || "").trim(),
        syncUpdatedAt: String(student.syncUpdatedAt || student.sync_updated_at || "").trim(),
      };
    })
    .filter((student) => student.name);

  const sorted = normalized.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  return sorted.length ? sorted : normalizeStudentsData(defaultStudents);
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
      countHolidays: settings.countHolidays !== false,
      holidaysText: settings.holidaysText || "",
      holidayKeys: parseHolidayKeys(settings.holidaysText || ""),
    };
  } catch {
    return {
      pixKey: "",
      senderName: "Personal Joao Victor",
      defaultMessage: "Para manter seu acesso aos treinos e acompanhamento, voce pode realizar o pagamento via Pix.",
      countHolidays: true,
      holidaysText: "",
      holidayKeys: [],
    };
  }
}

function saveBillingSettings(settings) {
  try {
    localStorage.setItem(billingSettingsStorageKey, JSON.stringify(settings));
    queueSupabaseAppStateSync("configuracoes de cobranca");
    if (billingSettingsMessage) {
      billingSettingsMessage.textContent = "Sincronizando configuracoes de cobranca com Supabase...";
      billingSettingsMessage.classList.remove("error");
    }
  } catch {
    if (billingSettingsMessage) {
      billingSettingsMessage.textContent = "Configuracoes apareceram na tela, mas o navegador bloqueou salvar.";
      billingSettingsMessage.classList.add("error");
    }
  }
}

function normalizeFinancialHistory(records) {
  return normalizeListData(records)
    .filter((record) => record && typeof record === "object")
    .map((record) => ({
      id: record.id || `${record.studentId || record.studentName || "student"}-${record.monthKey || currentMonthKey()}`,
      studentId: record.studentId || "",
      studentName: String(record.studentName || "").trim(),
      monthKey: record.monthKey || currentMonthKey(),
      predictedLessons: Number(record.predictedLessons) || 0,
      completedLessons: Number(record.completedLessons) || 0,
      chargedValue: Number(record.chargedValue) || 0,
      paidValue: Number(record.paidValue) || 0,
      status: record.status || "Pendente",
      updatedAt: record.updatedAt || new Date().toISOString(),
    }));
}

function loadFinancialHistory() {
  if (memoryFinancialHistory) return memoryFinancialHistory;
  try {
    const saved = localStorage.getItem(financialHistoryStorageKey);
    memoryFinancialHistory = normalizeFinancialHistory(saved ? JSON.parse(saved) : []);
  } catch {
    memoryFinancialHistory = [];
  }
  return memoryFinancialHistory;
}

function saveFinancialHistory(records, { silent = false } = {}) {
  memoryFinancialHistory = normalizeFinancialHistory(records);
  try {
    localStorage.setItem(financialHistoryStorageKey, JSON.stringify(memoryFinancialHistory));
    persistAppDataMeta();
    if (!silent) queueSupabaseAppStateSync("historico financeiro");
  } catch {
    console.warn("Historico financeiro apareceu na tela, mas o navegador bloqueou salvar ao recarregar.");
  }
}

function updateFinancialHistoryFromProjections(projections, monthKey) {
  const history = loadFinancialHistory();
  const byId = new Map(history.map((record) => [record.id, record]));
  projections.forEach((projection) => {
    const id = `${projection.student.id || projection.student.name}-${monthKey}`;
    const previous = byId.get(id);
    const nextRecord = {
      id,
      studentId: projection.student.id || "",
      studentName: projection.student.name,
      monthKey,
      predictedLessons: projection.predictedLessons,
      completedLessons: projection.completedLessons,
      chargedValue: projection.totalValue,
      paidValue: projection.status === "Pago" ? projection.totalValue : 0,
      status: projection.status,
    };
    const changed = !previous || ["predictedLessons", "completedLessons", "chargedValue", "paidValue", "status"].some((key) => previous[key] !== nextRecord[key]);
    byId.set(id, { ...nextRecord, updatedAt: changed ? new Date().toISOString() : previous.updatedAt });
  });
  const next = [...byId.values()];
  if (JSON.stringify(next) !== JSON.stringify(history)) saveFinancialHistory(next);
}

function normalizeWhatsAppPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function normalizeWeeklyFrequency(value) {
  if (String(value || "").toLowerCase() === "custom") return "custom";
  const match = String(value || "").match(/[1-5]/);
  return match ? `${match[0]}x` : "3x";
}

function getDefaultMakeupLimit(frequency) {
  const normalized = normalizeWeeklyFrequency(frequency);
  if (normalized === "3x") return 3;
  return Number(normalized.replace("x", "")) || 0;
}

function normalizeMakeupLimit(value, frequency) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : getDefaultMakeupLimit(frequency);
}

function normalizeBillingDays(days) {
  const source = Array.isArray(days) ? days : String(days || "").split(/[,\s]+/);
  return [...new Set(source.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
}

function normalizeWeeklySchedule(schedule = {}, selectedDays = []) {
  const days = normalizeBillingDays(selectedDays);
  const source = schedule && typeof schedule === "object" ? schedule : {};
  return days.reduce((acc, day) => {
    const item = source[day] || source[String(day)] || {};
    acc[day] = {
      time: normalizeTimeText(item.time || item.start || ""),
      duration: Number(item.duration) || 60,
      location: String(item.location || "").trim(),
    };
    return acc;
  }, {});
}

function getWeeklyScheduleFromForm() {
  const days = getSelectedBillingDays();
  return days.reduce((acc, day) => {
    const timeInput = document.querySelector(`[data-student-schedule-time="${day}"]`);
    acc[day] = {
      time: normalizeTimeText(timeInput?.value || ""),
      duration: Number(document.querySelector(`[data-student-schedule-duration="${day}"]`)?.value) || 60,
      location: document.querySelector(`[data-student-schedule-location="${day}"]`)?.value.trim() || "",
    };
    return acc;
  }, {});
}

function getMissingScheduleDays(schedule = getWeeklyScheduleFromForm(), days = getSelectedBillingDays()) {
  return normalizeBillingDays(days).filter((day) => !String(schedule?.[day]?.time || "").trim());
}

function getInvalidScheduleDays(schedule = getWeeklyScheduleFromForm(), days = getSelectedBillingDays()) {
  return normalizeBillingDays(days).filter((day) => {
    const time = String(schedule?.[day]?.time || "").trim();
    return time && !parseFlexibleTimeText(time).valid;
  });
}

function formatStudentScheduleTimeInput(input) {
  if (!input) return true;
  const parsed = parseFlexibleTimeText(input.value);
  input.classList.remove("field-error");
  input.removeAttribute("aria-invalid");
  if (parsed.empty) return true;
  if (!parsed.valid) {
    input.classList.add("field-error");
    input.setAttribute("aria-invalid", "true");
    showMessage("Horário inválido. Use um horário entre 00:00 e 23:59.", "error");
    return false;
  }
  input.value = parsed.value;
  return true;
}

function normalizeBillingType(value) {
  const text = String(value || "").toLowerCase();
  return text === "per_class" || text.includes("aula") ? "per_class" : "fixed";
}

function getSelectedBillingDays() {
  return Array.from(billingDayInputs || [])
    .filter((input) => input.checked)
    .map((input) => Number(input.value))
    .filter((day) => Number.isInteger(day));
}

function getWeeklyClassCountForStudentForm() {
  const frequency = normalizeWeeklyFrequency(frequencyInput?.value || "3x");
  if (frequency === "custom") return getSelectedBillingDays().length;
  return Number(frequency.replace("x", "")) || 0;
}

function updateStudentMonthlyValueFromBilling() {
  if (!billingTypeInput || !valueInput) return;
  const billingType = normalizeBillingType(billingTypeInput.value);
  const isPerClass = billingType === "per_class";

  valueInput.readOnly = isPerClass;
  valueInput.classList.toggle("readonly-field", isPerClass);
  valueInput.setAttribute("aria-readonly", isPerClass ? "true" : "false");

  if (!isPerClass) return;

  const classValue = parseCurrencyValue(classValueInput?.value || "");
  const weeklyClasses = getWeeklyClassCountForStudentForm();
  const monthlyValue = classValue * weeklyClasses * 4;
  valueInput.value = monthlyValue > 0 ? formatCurrencyNumber(monthlyValue) : "";
}

function getStudentDraftFromForm() {
  return {
    id: editingStudentIndex === null ? "" : loadStudents()[editingStudentIndex]?.id || "",
    name: nameInput?.value.trim() || "",
    plan: planInput?.value.trim() || "",
    modality: modalityInput?.value || "presencial",
    startDate: studentStartDateInput?.value.trim() || formatToday(),
    frequency: frequencyInput?.value || "3x",
    billingDays: getSelectedBillingDays(),
    weeklySchedule: getWeeklyScheduleFromForm(),
    billingType: billingTypeInput?.value || "fixed",
    classValue: classValueInput?.value.trim() || "",
    value: valueInput?.value.trim() || "",
    due: dueInput?.value.trim() || "",
    makeupLimit: normalizeMakeupLimit(makeupLimitInput?.value, frequencyInput?.value || "3x"),
  };
}

function renderStudentPackagePreview() {
  if (!studentPackagePreview) return;
  updateStudentMonthlyValueFromBilling();
  const draft = getStudentDraftFromForm();
  const shouldShow = isPresentialStudent(draft) && normalizeBillingDays(draft.billingDays).length > 0;
  studentPackagePreview.hidden = !shouldShow;
  studentPackagePreview.innerHTML = "";
  if (!shouldShow) return;

  const preview = getStudentInitialPackagePreview(draft);
  const title = document.createElement("strong");
  title.textContent = "Pacote automático do mês";
  const details = document.createElement("span");
  details.textContent = `${preview.remainingLessons} aula(s) previstas em ${preview.monthLabel}. Valor: ${formatCurrencyNumber(preview.totalValue)}.`;
  const note = document.createElement("small");
  const missingScheduleDays = getMissingScheduleDays(draft.weeklySchedule, draft.billingDays);
  note.textContent = missingScheduleDays.length
    ? `Horario pendente: ${missingScheduleDays.map(getWeekdayName).join(", ")}.`
    : preview.proportional
      ? "Valor proporcional do primeiro mês, calculado apenas pelas aulas restantes."
      : "Pacote calculado para o mês inteiro conforme os dias cadastrados.";
  studentPackagePreview.append(title, details, note);
}

function setSelectedBillingDays(days) {
  const selected = normalizeBillingDays(days);
  Array.from(billingDayInputs || []).forEach((input) => {
    input.checked = selected.includes(Number(input.value));
  });
}

function renderStudentWeeklySchedule(schedule = getWeeklyScheduleFromForm()) {
  if (!studentWeeklySchedule) return;
  const days = getSelectedBillingDays();
  studentWeeklySchedule.innerHTML = "";
  studentWeeklySchedule.hidden = !days.length;
  if (!days.length) return;

  const title = document.createElement("strong");
  title.textContent = "Horários das aulas";
  studentWeeklySchedule.appendChild(title);

  days.forEach((day) => {
    const item = schedule?.[day] || {};
    const row = document.createElement("div");
    row.className = "student-schedule-row";
    const label = document.createElement("span");
    label.textContent = getWeekdayName(day);
    const time = document.createElement("input");
    time.placeholder = "07:00";
    time.value = item.time || "";
    time.dataset.studentScheduleTime = day;
    const duration = document.createElement("input");
    duration.type = "number";
    duration.min = "30";
    duration.step = "30";
    duration.value = item.duration || 60;
    duration.dataset.studentScheduleDuration = day;
    const location = document.createElement("input");
    location.placeholder = "Local";
    location.value = item.location || "";
    location.dataset.studentScheduleLocation = day;
    row.append(label, time, duration, location);
    studentWeeklySchedule.appendChild(row);
  });
}

function renderStudentFormTrainingDaysWarning(show = false) {
  if (!studentForm) return;
  const warning = getOrCreateElement("student-training-days-warning", "form-warning-card", "p");
  warning.textContent = missingTrainingDaysMessage;
  warning.hidden = !show;
  if (!warning.parentElement) {
    const fieldset = studentForm.querySelector(".weekday-picker");
    fieldset?.insertAdjacentElement("afterend", warning);
  }
}

function getNextMonthKey(date = new Date()) {
  return getDefaultBillingMonthKey(date);
}

function getDefaultBillingMonthKey(date = new Date()) {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthBounds(monthKey) {
  const match = String(monthKey || "").match(/^(\d{4})-(\d{2})$/);
  const fallback = getDefaultBillingMonthKey();
  const [year, month] = match ? [Number(match[1]), Number(match[2])] : fallback.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return { year, month, start, end, monthKey: `${year}-${String(month).padStart(2, "0")}` };
}

function getMonthLabel(monthKey) {
  const { start } = getMonthBounds(monthKey);
  return start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function getWeekdayName(day) {
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"][Number(day)] || "";
}

function getWeekdayFullName(day) {
  return ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"][Number(day)] || "";
}

function parseHolidayKeys(text) {
  return String(text || "")
    .split(/\n+/)
    .map((line) => parseBrazilianDate(line))
    .filter(Boolean)
    .map((date) => getDateKey(date));
}

function countBillingLessonsForMonth(monthKey, weekdays, settings) {
  const days = normalizeBillingDays(weekdays);
  if (!days.length) return 0;
  const { start, end } = getMonthBounds(monthKey);
  const holidaySet = settings?.countHolidays === false ? new Set(settings.holidayKeys || []) : new Set();
  let total = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = getDateKey(cursor);
    if (days.includes(cursor.getDay()) && !holidaySet.has(key)) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

function countBillingLessonsBetweenDates(startDate, endDate, weekdays, settings = loadBillingSettings()) {
  const days = normalizeBillingDays(weekdays);
  if (!startDate || !endDate || !days.length) return 0;
  const holidaySet = settings?.countHolidays === false ? new Set(settings.holidayKeys || []) : new Set();
  let total = 0;
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const key = getDateKey(cursor);
    if (days.includes(cursor.getDay()) && !holidaySet.has(key)) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

function isPresentialStudent(student) {
  const text = `${student?.modality || ""} ${student?.plan || ""}`.toLowerCase();
  return text.includes("presencial") || (!text.includes("online") && !text.includes("hibrido"));
}

function getStudentStartDate(student) {
  return parseBrazilianDate(student?.startDate || "") || new Date();
}

function getStudentInitialPackagePreview(student, settings = loadBillingSettings()) {
  const startDate = getStudentStartDate(student);
  startDate.setHours(0, 0, 0, 0);
  const monthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
  const { start, end } = getMonthBounds(monthKey);
  const remainingLessons = countBillingLessonsBetweenDates(startDate, end, student.billingDays, settings);
  const fullMonthLessons = countBillingLessonsBetweenDates(start, end, student.billingDays, settings);
  const billingType = normalizeBillingType(student.billingType);
  const perClassValue = parseCurrencyValue(student.classValue);
  const monthlyValue = parseCurrencyValue(student.value);
  const proportional = startDate > start;
  const totalValue = billingType === "per_class"
    ? remainingLessons * perClassValue
    : fullMonthLessons > 0
      ? (monthlyValue / fullMonthLessons) * remainingLessons
      : monthlyValue;

  return {
    monthKey,
    monthLabel: getMonthLabel(monthKey),
    startDate,
    endDate: end,
    remainingLessons,
    fullMonthLessons,
    totalValue,
    billingType,
    proportional,
    daysText: normalizeBillingDays(student.billingDays).map(getWeekdayFullName).filter(Boolean).join(", "),
  };
}

function getBillingDueDate(student, monthKey) {
  const { year, month } = getMonthBounds(monthKey);
  const due = parseBrazilianDate(student?.due || "");
  const day = due?.getDate() || Number(String(student?.due || "").match(/\d{1,2}/)?.[0]) || 5;
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, lastDay));
}

function getBillingStatusForStudent(student, monthKey) {
  if (student?.payment === "Em dia") return "Pago";
  const dueDate = getBillingDueDate(student, monthKey);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today || student?.payment === "Atrasado" ? "Vencido" : "Pendente";
}

function getStudentCompletedLessonsForMonth(student, monthKey) {
  const { start, end } = getMonthBounds(monthKey);
  return loadCheckins().filter((checkin) => {
    if (checkin.studentId && student.id && checkin.studentId !== student.id) return false;
    if (!checkin.studentId && checkin.studentName !== student.name) return false;
    if (!isConsumedLesson(checkin)) return false;
    const date = checkin.dateKey ? new Date(`${checkin.dateKey}T00:00:00`) : parseBrazilianDate(checkin.date);
    return date && date >= start && date <= end;
  }).length;
}

function getStudentBillingProjection(student, monthKey, settings = loadBillingSettings()) {
  const billingType = normalizeBillingType(student.billingType);
  const automaticPackage = loadClassPackages().find((item) =>
    item.autoGenerated === true
    && item.monthKey === monthKey
    && ((student.id && item.studentId === student.id) || item.studentName === student.name)
  );
  const predictedLessons = automaticPackage
    ? Number(automaticPackage.total) || 0
    : countBillingLessonsForMonth(monthKey, student.billingDays, settings);
  const completedLessons = getStudentCompletedLessonsForMonth(student, monthKey);
  const perClassValue = parseCurrencyValue(student.classValue);
  const monthlyValue = parseCurrencyValue(student.value);
  const totalValue = automaticPackage
    ? parseCurrencyValue(automaticPackage.value || automaticPackage.expectedValue)
    : billingType === "per_class" ? predictedLessons * perClassValue : monthlyValue;
  const attendance = predictedLessons > 0 ? Math.round((completedLessons / predictedLessons) * 1000) / 10 : 0;
  const status = getBillingStatusForStudent(student, monthKey);

  return {
    student,
    monthKey,
    billingType,
    predictedLessons,
    completedLessons,
    attendance,
    individualValue: billingType === "per_class" ? perClassValue : monthlyValue,
    totalValue,
    dueDate: getBillingDueDate(student, monthKey),
    status,
    daysLabel: normalizeBillingDays(student.billingDays).map(getWeekdayName).filter(Boolean).join(", ") || "Dias nao cadastrados",
  };
}

function markStudentBillingAsPaid(studentId) {
  const students = loadStudents();
  const index = students.findIndex((student) => student.id === studentId || student.name === studentId);
  if (index < 0) return false;
  students[index] = {
    ...students[index],
    payment: "Em dia",
    lastPaymentDate: formatToday(),
  };
  saveStudents(students);
  renderStudents();
  renderBillingList();
  renderHomeDashboard();
  showMessage(`Sincronizando pagamento de ${students[index].name} com Supabase...`);
  return true;
}

function createAutomaticBillingMessage(projection) {
  const { student, predictedLessons, billingType, individualValue, totalValue, dueDate } = projection;
  const dueText = dueDate.toLocaleDateString("pt-BR");
  if (billingType === "per_class") {
    return `Ola, ${student.name}.\n\nSua programacao para o proximo mes sera de ${predictedLessons} aulas, realizadas nos dias cadastrados em seu plano.\n\nQuantidade de aulas previstas: ${predictedLessons}\nValor por aula: ${formatCurrencyNumber(individualValue)}\nValor total do mes: ${formatCurrencyNumber(totalValue)}\nVencimento: ${dueText}\n\nQualquer duvida estou a disposicao.`;
  }
  return `Ola, ${student.name}.\n\nSeu plano mensal esta programado para o proximo mes conforme os dias cadastrados.\n\nValor da mensalidade: ${formatCurrencyNumber(totalValue)}\nVencimento: ${dueText}\n\nQualquer duvida estou a disposicao.`;
}

function getStudentBillingStatus(student) {
  const dueStatus = getWorkoutExpirationStatus(student.due);
  const paymentBlocked = isPaymentBlocked(student);
  const hasPendingDropIns = getPendingDropInValue(student.name) > 0;
  return {
    dueStatus,
    shouldShow: hasPendingDropIns || paymentBlocked || (dueStatus.days !== null && dueStatus.days <= 7),
  };
}

function createBillingMessage(student, settings) {
  const activePackage = getActivePackage(student.name);
  const pendingDropIns = getPendingDropInValue(student.name);
  const planName = activePackage?.name || student.plan || "plano";
  const value = pendingDropIns > 0 ? formatCurrencyNumber(pendingDropIns) : activePackage?.value || student.value || "valor nao informado";
  return `Ola, ${student.name}! Tudo bem?\n\nPassando para lembrar que seu plano ${planName} vence em ${student.due}.\nValor: ${value}\n\n${settings.defaultMessage}\n\nChave Pix: ${settings.pixKey || "nao configurada"}\n\nApos o pagamento, me envie o comprovante por aqui.\n\n${settings.senderName}`;
}

function parseDateLike(value) {
  const text = String(value || "").trim();
  if (!text || /prescrito/i.test(text)) return null;

  const brDate = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (brDate) {
    const currentYear = new Date().getFullYear();
    const year = brDate[3] ? Number(brDate[3].length === 2 ? `20${brDate[3]}` : brDate[3]) : currentYear;
    const date = new Date(year, Number(brDate[2]) - 1, Number(brDate[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDaysSince(date) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return Math.floor((today - normalized) / 86400000);
}

function findStudentByIdentifier(identifier) {
  const value = String(identifier || "");
  return loadStudents().find((student) => student.id === value || student.name === value || student.email === value) || null;
}

function openAdminStudentProfile(studentIdentifier) {
  const student = findStudentByIdentifier(studentIdentifier);
  if (!student) return;
  openAdminModule("students");
  openAdminSubpage("students-profile");
  selectedAdminProfileStudent = student.name;
  renderAdminStudentProfile(student.id);
}

function getSubpageGroup(pageName) {
  if (pageName.startsWith("assessment-")) return "assessments";
  if (pageName.startsWith("students-")) return "students";
  if (pageName.startsWith("evolution-")) return "evolution";
  return pageName.split("-")[0];
}

function isSubpageInGroup(pageName, groupName) {
  return getSubpageGroup(pageName || "") === groupName;
}

function showAdminSubpageMenu(menuName) {
  adminSubpageMenus.forEach((menu) => {
    menu.hidden = menu.dataset.subpageMenu !== menuName ? menu.hidden : false;
  });
  adminSubpages.forEach((page) => {
    if (isSubpageInGroup(page.dataset.subpage, menuName)) {
      page.hidden = true;
    }
  });
}

function openAdminSubpage(pageName) {
  if (pageName === "evolution-notes") pageName = "evolution-feedbacks";
  const page = document.querySelector(`[data-subpage="${pageName}"]`);
  if (!page) return;
  activeAdminSubpage = pageName;
  const menuName = getSubpageGroup(pageName);
  const menu = document.querySelector(`[data-subpage-menu="${menuName}"]`);
  if (menu) menu.hidden = true;
  adminSubpages.forEach((item) => {
    const sameGroup = isSubpageInGroup(item.dataset.subpage, menuName);
    if (sameGroup) item.hidden = item.dataset.subpage !== pageName;
  });
  renderAdminSubpageContent(pageName);
  saveNavigationState();
}

function renderSummaryCard(title, detail, tone = "") {
  const card = document.createElement("article");
  card.className = `checkin-history-card ${tone}`;
  const strong = document.createElement("strong");
  strong.textContent = title;
  const small = document.createElement("small");
  small.textContent = detail;
  card.append(strong, small);
  return card;
}

function renderStudentPlanSummary() {
  if (!studentPlanSummary) return;
  studentPlanSummary.innerHTML = "";
  loadStudents().forEach((student) => {
    studentPlanSummary.appendChild(renderSummaryCard(student.name, `${student.plan} | ${student.value || "-"} | ${student.frequency || "3x"} | vence ${student.due || "-"}`));
  });
}

function renderStudentStatusSummary() {
  if (!studentStatusSummary) return;
  studentStatusSummary.innerHTML = "";
  loadStudents().forEach((student) => {
    const tone = student.payment === "Em dia" ? "checkin-ok" : "cancel-late";
    const card = renderSummaryCard(student.name, `${student.payment || "-"} | vencimento ${student.due || "-"}`, tone);
    card.classList.toggle("alert-focus-card", highlightedStudentStatusName === student.name);
    studentStatusSummary.appendChild(card);
    if (highlightedStudentStatusName === student.name) {
      setTimeout(() => card.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    }
  });
}

function renderAssessmentSupportSummaries() {
  ensureAssessmentProfessionalUi();
  syncAssessmentStudentSelects();
  const studentName = assessmentStudent?.value || loadStudents()[0]?.name || "";
  const assessments = getStudentAssessments(studentName);
  if (assessmentChartSummary) {
    assessmentChartSummary.innerHTML = "";
    if (assessments.length) {
      assessmentChartSummary.append(
        renderAssessmentChartCard("Evolução do peso", assessments, "weight", "kg"),
        renderAssessmentChartCard("Evolução da gordura", assessments, "fat", "%"),
        renderAssessmentChartCard("Evolução da massa muscular", assessments, "muscle", "kg"),
        renderAssessmentChartCard("Evolução do abdômen/cintura", assessments, assessments.some((item) => item.abdomen) ? "abdomen" : "waist", "cm"),
      );
    } else {
      assessmentChartSummary.textContent = "Nenhuma avaliação para montar gráficos ainda.";
    }
  }
  if (assessmentPhotoSummary) {
    assessmentPhotoSummary.innerHTML = "";
    assessments
      .filter((item) => item.attachment?.dataUrl || item.photos?.front?.dataUrl || item.photos?.side?.dataUrl || item.photos?.back?.dataUrl || item.photos?.bio?.dataUrl)
      .forEach((item) => assessmentPhotoSummary.appendChild(renderSummaryCard(item.date, [
        item.photos?.front ? "frente" : "",
        item.photos?.side ? "lado" : "",
        item.photos?.back ? "costas" : "",
        item.photos?.bio || item.attachment ? "bioimpedância" : "",
      ].filter(Boolean).join(" | ") || "Anexo salvo")));
    if (!assessmentPhotoSummary.children.length) assessmentPhotoSummary.textContent = "Nenhuma foto/anexo de evolução cadastrado.";
  }
  if (assessmentCompareSummary) {
    assessmentCompareSummary.innerHTML = "";
    const first = assessments[0];
    const last = assessments[assessments.length - 1];
    if (first && last && first !== last) {
      assessmentCompareSummary.appendChild(renderSummaryCard(`${first.date} x ${last.date}`, `Peso: ${first.weight || "-"} -> ${last.weight || "-"} | Gordura: ${first.fat || "-"} -> ${last.fat || "-"} | Massa: ${first.muscle || "-"} -> ${last.muscle || "-"} | Abdômen: ${first.abdomen || first.waist || "-"} -> ${last.abdomen || last.waist || "-"}`));
      assessmentCompareSummary.appendChild(renderSummaryCard("Parecer para WhatsApp", createAssessmentReportText(last, first, studentName)));
    } else {
      assessmentCompareSummary.textContent = "Cadastre pelo menos duas avaliações para comparar.";
    }
  }
  renderAssessmentOverview(studentName);
}

function renderAdminSubpageContent(pageName) {
  if (pageName === "students-list") renderStudents();
  if (pageName === "students-profile" && selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
  if (pageName === "students-plans") renderStudentPlanSummary();
  if (pageName === "students-status") renderStudentStatusSummary();
  if (pageName.startsWith("assessment-")) {
    renderAdminAssessments();
    renderAssessmentSupportSummaries();
  }
  if (pageName.startsWith("evolution-")) renderAdminEvolution();
}

function normalizeResolvedAlerts(alerts) {
  return normalizeListData(alerts)
    .filter((item) => item && typeof item === "object" && item.id)
    .map((item) => ({
      ...item,
      id: String(item.id),
      type: String(item.type || ""),
      title: String(item.title || ""),
      detail: String(item.detail || ""),
      studentName: String(item.studentName || ""),
      tone: String(item.tone || "neutral"),
      status: item.resolvedAt ? "resolvido" : item.status || "resolvido",
      destination: item.destination || "",
      date: item.date || "",
      studentId: item.studentId || getStudentIdByName(item.studentName || ""),
      resolvedAt: item.resolvedAt || new Date().toISOString(),
    }));
}

function loadResolvedAlerts() {
  try {
    const saved = localStorage.getItem(resolvedAlertsStorageKey);
    return normalizeResolvedAlerts(saved ? JSON.parse(saved) : []);
  } catch {
    return [];
  }
}

function saveResolvedAlerts(alerts) {
  try {
    localStorage.setItem(resolvedAlertsStorageKey, JSON.stringify(normalizeResolvedAlerts(alerts)));
    persistAppDataMeta();
    queueSupabaseAppStateSync("alertas resolvidos");
  } catch (error) {
    console.error("Nao foi possivel salvar alertas resolvidos.", error);
  }
}

function resolveAdminAlert(alertId) {
  const alert = collectAdminAlerts({ includeResolved: true }).find((item) => item.id === alertId);
  if (!alert) return false;
  const resolved = loadResolvedAlerts();
  if (!resolved.some((item) => item.id === alertId)) {
    resolved.push({ ...alert, status: "resolvido", resolvedAt: new Date().toISOString() });
    saveResolvedAlerts(resolved);
  }
  return true;
}

function isOnlineStudentPlan(student) {
  const text = `${student?.plan || ""} ${student?.modality || ""} ${student?.mode || ""}`.toLowerCase();
  return text.includes("online") || text.includes("consultoria") || text.includes("remoto");
}

function createAdminAlert(type, title, detail, studentName, tone = "warning", idSeed = detail, extra = {}) {
  return {
    id: `${type}-${studentName}-${idSeed}`.toLowerCase().replace(/\s+/g, "-"),
    type,
    title,
    detail,
    studentName,
    studentId: getStudentIdByName(studentName),
    date: formatToday(),
    status: "pendente",
    tone,
    ...extra,
  };
}

function collectAdminAlerts(options = {}) {
  processAutomaticPastLessons();
  const alerts = [];
  const students = loadStudents();
  const feedbacks = loadWorkoutFeedbacks();
  const checkins = loadCheckins();

  students.forEach((student) => {
    if (!normalizeBillingDays(student.billingDays).length) {
      alerts.push(createAdminAlert(
        "Cadastro incompleto",
        "Aluno sem dias de treino cadastrados",
        "Complete os dias da semana para calcular aulas, cobranças e treinos do mês.",
        student.name,
        "warning",
        "sem-dias-treino",
        { destination: "students-register" },
      ));
    }

    const studentFeedbacks = feedbacks
      .filter((feedback) => feedback.studentName === student.name)
      .sort((a, b) => b.timestamp - a.timestamp);

    const onlinePlan = isOnlineStudentPlan(student);
    if (onlinePlan) {
      const completedDates = studentFeedbacks
        .map((feedback) => parseDateLike(feedback.date) || new Date(feedback.timestamp || 0))
        .filter((date) => date && !Number.isNaN(date.getTime()))
        .sort((a, b) => b - a);
      const lastCompleted = completedDates[0];
      const daysWithoutWorkout = lastCompleted ? getDaysSince(lastCompleted) : null;
      if (daysWithoutWorkout === null || daysWithoutWorkout > 7) {
        const lastKey = lastCompleted ? getDateKey(lastCompleted) : "sem-registro";
        alerts.push(createAdminAlert(
          "Treino online",
          "Aluno online sem treinar ha mais de 7 dias",
          daysWithoutWorkout === null ? "Nenhum treino concluido registrado." : `Ultimo treino concluido ha ${daysWithoutWorkout} dias.`,
          student.name,
          "warning",
          `online-${lastKey}`,
          { destination: "evolution-adherence" },
        ));
      }
    }

    const analytics = getStudentWorkoutAnalytics(student);
    if (!onlinePlan && analytics.daysSinceLast !== null && analytics.daysSinceLast >= 7) {
      alerts.push(createAdminAlert(
        "Frequencia",
        `${student.name} está há ${analytics.daysSinceLast} dias sem concluir treino`,
        `Último treino: ${analytics.lastFeedback?.workoutTitle || "sem registro"} em ${analytics.lastFeedback?.date || "-"}`,
        student.name,
        "warning",
        `sem-treino-${analytics.lastFeedback?.date || "sem-data"}`,
        { destination: "evolution-adherence" },
      ));
    }

    if (analytics.completed7 <= 1 && analytics.feedbacks.length) {
      alerts.push(createAdminAlert(
        "Baixa frequencia",
        `${student.name} concluiu apenas ${analytics.completed7} treino(s) nos últimos 7 dias`,
        `Adesão mensal estimada: ${analytics.adherence}% | risco ${analytics.risk}`,
        student.name,
        "warning",
        `baixa-frequencia-${analytics.completed7}-${analytics.lastFeedback?.date || "sem-data"}`,
        { destination: "evolution-adherence" },
      ));
    }

    checkins
      .filter((checkin) =>
        checkin.studentName === student.name &&
        ["cancelada-no-prazo", "cancelada-fora-prazo", "desmarcada-com-reposicao", "desmarcada-sem-reposicao"].includes(checkin.status),
      )
      .slice(0, 8)
      .forEach((checkin) => {
        const generated = checkin.generatedMakeup || checkin.status === "desmarcada-com-reposicao";
        alerts.push(createAdminAlert(
          "Cancelamento",
          "Aluno cancelou aula",
          `${checkin.date || "-"} | ${checkin.time || "-"} | ${generated ? "gerou reposição" : "não gerou reposição"}`,
          student.name,
          generated ? "warning" : "danger",
          checkin.id,
          {
            destination: generated ? "packages-makeup" : "packages-checkin",
            checkinId: checkin.id,
            packageId: checkin.packageId || "",
            lessonDateKey: checkin.dateKey || "",
          },
        ));
      });

    studentFeedbacks
      .filter((feedback) => feedback.pain)
      .slice(0, 8)
      .forEach((feedback) => {
      alerts.push(createAdminAlert(
        "Dor",
        "Aluno relatou dor no treino",
        `${feedback.date || "-"} | ${feedback.workoutTitle || "Treino"} | ${feedback.painLocation || "Local nao informado"}`,
        student.name,
        "danger",
        feedback.id || feedback.timestamp || `${feedback.date}-${feedback.workoutTitle}-${feedback.painLocation}`,
        { destination: "evolution-feedbacks", feedbackId: feedback.id || "", date: feedback.date || "" },
      ));
    });

    const dueStatus = getWorkoutExpirationStatus(student.due);
    if (student.payment === "Atrasado" || student.payment === "Pendente" || (dueStatus.days !== null && dueStatus.days <= 7)) {
        alerts.push(createAdminAlert(
        "Vencimento",
        "Vencimento do plano",
        `Vencimento ${student.due || "-"} | pagamento ${student.payment || "Status nao informado"}`,
          student.name,
        student.payment === "Em dia" ? "success" : "danger",
        `${student.due || "sem-vencimento"}-${student.payment || "sem-status"}`,
        { destination: "students-status", dueDate: student.due || "" },
        ));
    }

    const studentWorkouts = loadWorkouts()[student.name] || [];
    studentWorkouts.forEach((workout) => {
      const workoutStatus = getWorkoutPeriodStatus(workout);
      if (workoutStatus.state === "expired" || (workoutStatus.state === "active" && workoutStatus.days !== null && workoutStatus.days <= 7)) {
        alerts.push(createAdminAlert(
          "Ficha",
          workoutStatus.state === "expired" ? `${student.name} está com ficha vencida` : `${student.name} tem ficha vencendo em ${workoutStatus.days} dia(s)`,
          `${workout.title || "Ficha"} | vencimento ${workout.dueDate || "-"}`,
          student.name,
          "warning",
          `ficha-${workout.id}-${workout.dueDate || "sem-data"}`,
          { destination: "workouts", workoutId: workout.id },
        ));
      }
    });
    if (onlinePlan && !studentWorkouts.length) {
      alerts.push(createAdminAlert(
        "Ficha",
        "Aluno sem ficha de treino",
        "Nenhuma ficha cadastrada para este aluno.",
        student.name,
        "warning",
        "sem-ficha",
        { destination: "workouts", studentId: student.id || "" },
      ));
    }
  });

  loadMakeupCredits()
    .filter((credit) => credit.status === "requested")
    .forEach((credit) => {
      alerts.push(createAdminAlert(
        "Reagendamento",
        "Aluno solicitou reagendamento",
        `Aula ${credit.sourceLessonDate || "-"} | ${credit.lessonTime || "-"} | validade ${credit.validUntil || "-"}`,
        credit.studentName,
        "warning",
        credit.id,
        {
          destination: "packages-makeup",
          makeupCreditId: credit.id,
          packageId: credit.packageId || "",
          date: credit.sourceLessonDate || "",
        },
      ));
    });

  const unique = [];
  const seen = new Set();
  alerts.forEach((alert) => {
    if (seen.has(alert.id)) return;
    seen.add(alert.id);
    unique.push(alert);
  });

  if (options.includeResolved) return unique;

  const resolvedIds = new Set(loadResolvedAlerts().map((alert) => alert.id));
  return unique.filter((alert) => !resolvedIds.has(alert.id));
}

function renderAdminAlerts() {
  if (!adminAlertsList) return;
  renderAdminAlertBadge();
  const filter = adminAlertFilter?.value || "pending";
  const pendingAlerts = collectAdminAlerts();
  const resolvedAlerts = loadResolvedAlerts();
  const alerts = filter === "resolved"
    ? resolvedAlerts
    : filter === "all"
      ? [...pendingAlerts, ...resolvedAlerts.map((alert) => ({ ...alert, resolved: true }))]
      : pendingAlerts;
  adminAlertsList.innerHTML = "";

  if (!alerts.length) {
    const empty = document.createElement("article");
    empty.className = "alert-card neutral";
    empty.innerHTML = filter === "resolved"
      ? "<strong>Nenhum alerta resolvido ainda.</strong><span>Quando voce marcar um alerta como resolvido, ele aparece aqui.</span>"
      : "<strong>Nenhum alerta pendente agora.</strong><span>Seu painel esta em ordem.</span>";
    adminAlertsList.appendChild(empty);
    return;
  }

  alerts.forEach((alert) => {
    const card = document.createElement("article");
    const isResolved = Boolean(alert.resolved || alert.resolvedAt);
    card.className = `alert-card ${alert.tone}${isResolved ? " resolved" : ""}`;
    const badge = document.createElement("span");
    badge.className = "alert-badge";
    badge.textContent = isResolved ? `${alert.type} resolvido` : alert.type;
    const title = document.createElement("strong");
    title.textContent = alert.title;
    const detail = document.createElement("small");
    detail.textContent = `${alert.studentName} | ${alert.detail}${isResolved && alert.resolvedAt ? ` | resolvido em ${new Date(alert.resolvedAt).toLocaleDateString("pt-BR")}` : ""}`;

    const actions = document.createElement("div");
    actions.className = "student-actions alert-actions";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary";
    button.dataset.resolveAlertDestination = alert.id;
    button.textContent = "Resolver";
    actions.appendChild(button);

    if (!isResolved && alert.type === "Vencimento") {
      const billing = document.createElement("button");
      billing.type = "button";
      billing.className = "secondary";
      billing.dataset.alertBillingStudent = alert.studentName;
      billing.textContent = "Enviar cobranca WhatsApp";
      actions.appendChild(billing);
    }

    if (!isResolved) {
      const resolve = document.createElement("button");
      resolve.type = "button";
      resolve.className = "secondary";
      resolve.dataset.resolveAlert = alert.id;
      resolve.textContent = "Marcar como resolvido";
      actions.appendChild(resolve);
    }

    card.append(badge, title, detail, actions);
    adminAlertsList.appendChild(card);
  });
}

function renderAdminAlertBadge() {
  if (!adminAlertCard) return;
  adminAlertCard.querySelector(".admin-alert-badge")?.remove();
  const count = collectAdminAlerts().length;
  if (!count) return;
  const badge = document.createElement("span");
  badge.className = "admin-alert-badge";
  badge.textContent = count > 99 ? "99+" : String(count);
  adminAlertCard.appendChild(badge);
}

function createQuickBillingMessage(student) {
  return `Ola, ${student.name}! Tudo bem?\n\nPassando para lembrar que seu plano venceu em ${student.due || "-"}.\n\nQuando puder, me envie o comprovante ou confirme o pagamento.\n\nObrigado!\nPersonal Joao Victor`;
}

function openAlertBillingWhatsApp(studentName) {
  const student = getStudentByName(studentName);
  const phone = normalizeWhatsAppPhone(student?.phone);
  if (!student || !phone) {
    window.alert("Cadastre o WhatsApp do aluno para enviar cobranca.");
    return;
  }
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(createQuickBillingMessage(student))}`, "_blank", "noopener");
}

function resolveAlertDestination(alertId) {
  const alert = collectAdminAlerts({ includeResolved: true }).find((item) => item.id === alertId) || loadResolvedAlerts().find((item) => item.id === alertId);
  if (!alert) return;
  const studentName = alert.studentName || "";

  if (alert.destination === "evolution-adherence") {
    openAdminModule("evolution");
    if (adminEvolutionStudent) adminEvolutionStudent.value = studentName;
    openAdminSubpage("evolution-adherence");
    renderAdminEvolution();
    return;
  }

  if (alert.destination === "evolution-feedbacks") {
    highlightedFeedbackId = alert.feedbackId || "";
    openAdminModule("evolution");
    if (adminEvolutionStudent) adminEvolutionStudent.value = studentName;
    openAdminSubpage("evolution-feedbacks");
    renderAdminEvolution();
    return;
  }

  if (alert.destination === "students-status") {
    highlightedStudentStatusName = studentName;
    openAdminModule("students");
    openAdminSubpage("students-status");
    renderStudentStatusSummary();
    return;
  }

  if (alert.destination === "students-register") {
    startEditingStudentByIdentifier(studentName, "Complete os dias de treino deste aluno para liberar cálculos automáticos.");
    return;
  }

  if (alert.destination === "packages-checkin" || alert.destination === "packages-makeup") {
    openAdminModule("checkins");
    if (packageViewStudent) packageViewStudent.value = studentName;
    if (makeupListStudent) makeupListStudent.value = studentName;
    if (manualCheckinStudent) manualCheckinStudent.value = studentName;
    highlightedMakeupCreditId = alert.makeupCreditId || "";
    openPackageSubpage(alert.destination === "packages-makeup" ? "makeup" : "checkin");
    fillManualCheckinPackageSelect();
    fillMakeupPackageSelect();
    renderPackageAdminList();
    renderMakeupCreditList(studentName);
    return;
  }

  if (alert.destination === "workouts") {
    openAdminModule("workouts");
    openWorkoutStudentWorkspace(studentName);
    return;
  }

  openAdminStudentProfile(studentName);
}

function exportAppData() {
  const payload = getAppStateSnapshot();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `backup-joao-victor-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showMessage("Backup JSON exportado com sucesso.");
}

function showConfirmDialog({ title, message, confirmLabel = "Confirmar", cancelLabel = "Cancelar" }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    const dialog = document.createElement("article");
    dialog.className = "confirm-dialog";
    const heading = document.createElement("h3");
    heading.textContent = title;
    const text = document.createElement("p");
    text.textContent = message;
    const actions = document.createElement("div");
    actions.className = "confirm-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "secondary";
    cancel.textContent = cancelLabel;
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "primary danger-action";
    confirm.textContent = confirmLabel;

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };

    cancel.addEventListener("click", () => close(false));
    confirm.addEventListener("click", () => close(true));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close(false);
    });

    actions.append(cancel, confirm);
    dialog.append(heading, text, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    cancel.focus();
  });
}

function confirmStudentDeletion(student) {
  return showConfirmDialog({
    title: "Tem certeza que deseja remover este aluno?",
    message: `Esta ação poderá remover ou desvincular: fichas, avaliações, histórico, evolução, feedbacks, pacotes, check-ins e reposições. Aluno: ${student?.name || "-"}.`,
    cancelLabel: "Cancelar",
    confirmLabel: "Confirmar remoção",
  });
}

function createTombstoneEntry(collection, item, extra = {}) {
  const itemId = String(extra.itemId || item?.id || getMergeItemKey(item, "") || "").trim();
  if (!collection || !itemId) return null;
  return {
    collection,
    itemId,
    name: extra.name || item?.name || item?.title || item?.workoutTitle || item?.packageName || "",
    studentId: extra.studentId || item?.studentId || "",
    studentName: extra.studentName || item?.studentName || "",
    reason: extra.reason || "exclusao_intencional",
  };
}

function getStudentDeletionTombstones(student) {
  const studentName = student?.name || "";
  const studentId = student?.id || "";
  const belongsToStudent = (item) => item?.studentId === studentId || item?.studentName === studentName;
  const entries = [
    createTombstoneEntry("students", student, { itemId: studentId, name: studentName, studentId, studentName }),
    createTombstoneEntry("workoutStudents", null, { itemId: studentName, name: studentName, studentId, studentName }),
  ];

  (loadWorkouts()[studentName] || []).forEach((workout) => {
    entries.push(createTombstoneEntry("workouts", workout, { studentId, studentName }));
  });
  loadAssessments().filter(belongsToStudent).forEach((item) => entries.push(createTombstoneEntry("assessments", item, { studentId, studentName })));
  loadProgressRecords().filter(belongsToStudent).forEach((item) => entries.push(createTombstoneEntry("loadProgress", item, { studentId, studentName })));
  loadWorkoutFeedbacks().filter(belongsToStudent).forEach((item) => entries.push(createTombstoneEntry("workoutFeedbacks", item, { studentId, studentName })));
  loadCheckins().filter(belongsToStudent).forEach((item) => entries.push(createTombstoneEntry("checkins", item, { studentId, studentName })));
  loadClassPackages().filter(belongsToStudent).forEach((item) => entries.push(createTombstoneEntry("classPackages", item, { studentId, studentName })));
  loadDropInClasses().filter(belongsToStudent).forEach((item) => entries.push(createTombstoneEntry("dropInClasses", item, { studentId, studentName })));
  loadAgendaEvents().filter(belongsToStudent).forEach((item) => entries.push(createTombstoneEntry("agendaEvents", item, { studentId, studentName })));
  loadMakeupCredits().filter(belongsToStudent).forEach((item) => entries.push(createTombstoneEntry("makeupCredits", item, { studentId, studentName })));
  loadFinancialHistory().filter(belongsToStudent).forEach((item) => entries.push(createTombstoneEntry("financialHistory", item, { studentId, studentName })));

  return entries.filter(Boolean);
}

async function deleteStudentWithLinkedData(student) {
  if (!student?.name) return null;
  const studentName = student.name;
  const studentId = student.id;

  addDeletionTombstones(getStudentDeletionTombstones(student));
  const previousApplyingState = isApplyingRemoteState;
  isApplyingRemoteState = true;
  try {
    saveStudents(loadStudents().filter((item) => item.id !== studentId && item.name !== studentName));

    const workouts = loadWorkouts();
    delete workouts[studentName];
    saveWorkouts(workouts);

    saveAssessments(loadAssessments().filter((item) => item.studentId !== studentId && item.studentName !== studentName));
    saveProgressRecords(loadProgressRecords().filter((item) => item.studentId !== studentId && item.studentName !== studentName));
    saveWorkoutFeedbacks(loadWorkoutFeedbacks().filter((item) => item.studentId !== studentId && item.studentName !== studentName));
    saveCheckins(loadCheckins().filter((item) => item.studentId !== studentId && item.studentName !== studentName));
    saveClassPackages(loadClassPackages().filter((item) => item.studentId !== studentId && item.studentName !== studentName));
    saveDropInClasses(loadDropInClasses().filter((item) => item.studentId !== studentId && item.studentName !== studentName));
    saveAgendaEvents(loadAgendaEvents().filter((item) => item.studentId !== studentId && item.studentName !== studentName));
    saveMakeupCredits(loadMakeupCredits().filter((item) => item.studentId !== studentId && item.studentName !== studentName));
    saveFinancialHistory(loadFinancialHistory().filter((item) => item.studentId !== studentId && item.studentName !== studentName));
  } finally {
    isApplyingRemoteState = previousApplyingState;
  }

  if (selectedStudentProfile === studentName) {
    selectedStudentProfile = "";
    removeLocalValue("student-profile");
  }
  if (selectedAdminProfileStudent === studentName) selectedAdminProfileStudent = "";
  if (selectedAdminWorkoutStudent === studentName) selectedAdminWorkoutStudent = "";
  delete activeWorkoutByStudent[studentName];
  const result = await flushAppStateSyncNow("exclusao de aluno");
  if (result?.ok) {
    showMessage("Aluno excluído e salvo no Supabase.");
  } else {
    showMessage("Exclusão pendente de sincronização. O aluno foi removido deste navegador e será reenviado ao Supabase.", "error");
  }
  return result;
}

function renderBillingSettings() {
  const settings = loadBillingSettings();
  if (billingPixKey) billingPixKey.value = settings.pixKey;
  if (billingSenderName) billingSenderName.value = settings.senderName;
  if (billingDefaultMessage) billingDefaultMessage.value = settings.defaultMessage;
  if (billingCountHolidays) billingCountHolidays.value = settings.countHolidays ? "yes" : "no";
  if (billingHolidays) billingHolidays.value = settings.holidaysText || "";
  if (billingFilterMonth && !billingFilterMonth.value) billingFilterMonth.value = getDefaultBillingMonthKey();
}

function renderBillingList() {
  if (!billingList) return;

  const savedSettings = loadBillingSettings();
  const settings = {
    ...savedSettings,
    countHolidays: billingCountHolidays ? billingCountHolidays.value !== "no" : savedSettings.countHolidays,
    holidaysText: billingHolidays ? billingHolidays.value : savedSettings.holidaysText,
  };
  settings.holidayKeys = parseHolidayKeys(settings.holidaysText || "");
  const monthKey = billingFilterMonth?.value || getDefaultBillingMonthKey();
  const statusFilter = billingFilterStatus?.value || "all";
  const nameFilter = String(billingFilterName?.value || "").trim().toLowerCase();
  const projections = loadStudents()
    .map((student) => getStudentBillingProjection(student, monthKey, settings))
    .filter((projection) => {
      const matchesStatus = statusFilter === "all" || projection.status === statusFilter;
      const matchesName = !nameFilter || projection.student.name.toLowerCase().includes(nameFilter);
      return matchesStatus && matchesName;
    });

  renderBillingForecastSummary(projections, monthKey, settings);
  billingList.innerHTML = "";

  if (!projections.length) {
    billingList.textContent = "Nenhuma cobranca encontrada para os filtros selecionados.";
    return;
  }

  projections.forEach((projection) => {
    const student = projection.student;
    const phone = normalizeWhatsAppPhone(student.phone);
    const message = createAutomaticBillingMessage(projection);
    const card = document.createElement("article");
    card.className = `billing-card billing-status-${projection.status.toLowerCase()}`;

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = student.name;
    const details = document.createElement("span");
    details.textContent = `${student.plan || "Plano"} | ${student.frequency || "frequencia nao informada"} | ${projection.daysLabel} | ${projection.predictedLessons} aulas previstas`;
    const statusText = document.createElement("small");
    statusText.textContent = `${projection.billingType === "per_class" ? `Por aula: ${formatCurrencyNumber(projection.individualValue)}` : `Mensalidade: ${formatCurrencyNumber(projection.totalValue)}`} | Total: ${formatCurrencyNumber(projection.totalValue)} | Vence ${projection.dueDate.toLocaleDateString("pt-BR")} | ${projection.status}`;
    const attendance = document.createElement("small");
    attendance.textContent = `Realizadas: ${projection.completedLessons}/${projection.predictedLessons} | Frequencia: ${projection.attendance}%`;
    info.append(title, details, statusText);
    info.appendChild(attendance);

    if (student.paymentMethod || student.billingNotes || student.lastPaymentDate) {
      const notes = document.createElement("small");
      notes.textContent = [
        student.paymentMethod && `Pagamento: ${student.paymentMethod}`,
        student.lastPaymentDate && `Pago em: ${student.lastPaymentDate}`,
        student.billingNotes,
      ].filter(Boolean).join(" | ");
      info.appendChild(notes);
    }

    const actions = document.createElement("div");
    actions.className = "billing-actions";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "secondary";
    copyButton.textContent = "Copiar mensagem";
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(message);
        showMessage("Mensagem de cobranca copiada.");
      } catch (error) {
        console.error("Nao foi possivel copiar mensagem de cobranca.", error);
        showMessage("Nao foi possivel copiar automaticamente. Abra o WhatsApp e copie manualmente.", "error");
      }
    });

    const paidButton = document.createElement("button");
    paidButton.type = "button";
    paidButton.className = "secondary billing-paid-button";
    paidButton.dataset.markBillingPaid = student.id || student.name;
    paidButton.textContent = "Marcar como pago";

    const link = document.createElement("a");
    link.className = phone ? "primary" : "secondary";
    link.href = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : "#";
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = phone ? "Abrir WhatsApp" : "Telefone nao cadastrado";
    if (!phone) {
      link.addEventListener("click", (event) => event.preventDefault());
    }

    actions.append(copyButton, paidButton, link);
    card.append(info, actions);
    billingList.appendChild(card);
  });
}

function renderBillingForecastSummary(projections, monthKey, settings = loadBillingSettings()) {
  if (!billingForecastSummary) return;

  const allProjections = loadStudents().map((student) => getStudentBillingProjection(student, monthKey, settings));
  updateFinancialHistoryFromProjections(allProjections, monthKey);
  const activeStudents = allProjections.length;
  const totalLessons = allProjections.reduce((sum, item) => sum + item.predictedLessons, 0);
  const expectedRevenue = allProjections.reduce((sum, item) => sum + item.totalValue, 0);
  const received = allProjections.filter((item) => item.status === "Pago").reduce((sum, item) => sum + item.totalValue, 0);
  const pending = allProjections.filter((item) => item.status === "Pendente").reduce((sum, item) => sum + item.totalValue, 0);
  const overdueCount = allProjections.filter((item) => item.status === "Vencido").length;
  const paidCount = allProjections.filter((item) => item.status === "Pago").length;

  billingForecastSummary.innerHTML = "";
  [
    ["Alunos ativos", activeStudents],
    ["Aulas previstas", totalLessons],
    ["Faturamento previsto", formatCurrencyNumber(expectedRevenue)],
    ["Valor recebido", formatCurrencyNumber(received)],
    ["Valor pendente", formatCurrencyNumber(pending)],
    ["Vencidas", overdueCount],
    ["Pagas", paidCount],
  ].forEach(([label, value]) => {
    const card = document.createElement("article");
    card.className = "billing-summary-card";
    card.innerHTML = `<span>${label}</span><strong>${value}</strong><small>${getMonthLabel(monthKey)}</small>`;
    billingForecastSummary.appendChild(card);
  });

  renderBillingDashboardForecast(allProjections);
}

function renderBillingDashboardForecast(projections = null) {
  const financeCard = document.querySelector('[data-admin-target="finance"]')?.closest("article");
  if (!financeCard) return;
  const monthKey = getDefaultBillingMonthKey();
  const items = projections || loadStudents().map((student) => getStudentBillingProjection(student, monthKey));
  const totalStudents = items.length;
  const totalLessons = items.reduce((sum, item) => sum + item.predictedLessons, 0);
  const totalRevenue = items.reduce((sum, item) => sum + item.totalValue, 0);
  const pendingCountValue = items.filter((item) => item.status === "Pendente").length;
  const overdueCount = items.filter((item) => item.status === "Vencido").length;
  const text = `${totalStudents} alunos ativos | ${totalLessons} aulas previstas | ${formatCurrencyNumber(totalRevenue)} previsto | ${pendingCountValue} pendentes | ${overdueCount} vencidas`;
  const description = financeCard.querySelector("span");
  if (description) description.textContent = text;
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

function getLocalJson(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveAppLoginSession({ role, studentName = "", provider = "local", email = "", authUserId = "" } = {}) {
  if (!["admin", "student"].includes(role)) return;
  const session = {
    active: true,
    role,
    userType: role,
    studentName: role === "student" ? studentName : "",
    provider,
    email,
    auth_user_id: authUserId,
    savedAt: Date.now(),
  };

  try {
    localStorage.setItem(appSessionStorageKey, JSON.stringify(session));
    localStorage.setItem("user-type", role);
    if (role === "student" && studentName) localStorage.setItem("student-profile", studentName);
  } catch (error) {
    console.warn("Nao foi possivel salvar sessao local do app.", error);
  }
}

function clearAppLoginSession() {
  removeLocalValue(appSessionStorageKey);
  removeLocalValue("user-type");
  removeLocalValue("student-profile");
}

function enterModeForSessionRestore(role, studentName = "") {
  const previousRestoringState = isRestoringNavigation;
  isRestoringNavigation = true;
  try {
    enterTestMode(role, studentName, { persist: false, provider: "supabase" });
  } finally {
    isRestoringNavigation = previousRestoringState;
  }
}

function getWorkoutNavigationState() {
  if (activeAdminModule !== "workouts") return null;

  const formOpen = !!workoutForm && workoutForm.hidden === false;
  const selectedStudent = selectedAdminWorkoutStudent || workoutStudent?.value || "";
  const draft = formOpen
    ? {
        title: workoutTitle?.value || "",
        goal: workoutGoal?.value || "",
        frequency: workoutFrequency?.value || "",
        startDate: workoutStartDate?.value || "",
        dueDate: workoutDueDate?.value || "",
        notes: workoutNotes?.value || "",
        sessions: collectTrainingSessions(),
      }
    : null;

  return {
    selectedStudent,
    formOpen,
    mode: editingWorkout ? "edit" : formOpen ? "create" : selectedStudent ? "student" : "directory",
    editingWorkout: editingWorkout ? { ...editingWorkout } : null,
    draft,
  };
}

function restoreWorkoutNavigationState(workoutFlow = null) {
  if (!workoutFlow || activeAdminModule !== "workouts") return;

  const selectedStudent = workoutFlow.selectedStudent || workoutFlow.editingWorkout?.studentName || "";
  if (!selectedStudent) {
    showWorkoutStudentDirectory({ preserveNavigation: true });
    return;
  }

  openWorkoutStudentWorkspace(selectedStudent);

  if (!workoutFlow.formOpen) return;

  workoutForm.hidden = false;
  workoutStudent.value = selectedStudent;
  workoutStudent.disabled = true;

  if (workoutFlow.editingWorkout?.id) {
    const workout = (loadWorkouts()[workoutFlow.editingWorkout.studentName] || []).find(
      (item) => item.id === workoutFlow.editingWorkout.id,
    );
    if (workout) {
      editingWorkout = { studentName: workoutFlow.editingWorkout.studentName, id: workout.id };
      workoutTitle.value = workout.title || "";
      workoutGoal.value = workout.goal || "";
      workoutFrequency.value = workout.frequency || "";
      workoutStartDate.value = workout.startDate || "";
      workoutDueDate.value = workout.dueDate || "";
      workoutNotes.value = workout.notes || "";
      resetTrainingSessions(workout.sessions || [{ title: "Treino principal", exercises: [{}] }]);
      safeSetText(saveWorkoutButton, "Salvar alteracao");
      if (cancelWorkoutEditButton) cancelWorkoutEditButton.hidden = false;
      if (workoutMessage) {
        workoutMessage.textContent = "Editando treino. Altere os campos e salve.";
        workoutMessage.classList.remove("error");
      }
    }
  }

  if (workoutFlow.draft) {
    workoutTitle.value = workoutFlow.draft.title ?? workoutTitle.value ?? "";
    workoutGoal.value = workoutFlow.draft.goal ?? workoutGoal.value ?? "";
    workoutFrequency.value = workoutFlow.draft.frequency ?? workoutFrequency.value ?? "";
    workoutStartDate.value = workoutFlow.draft.startDate ?? workoutStartDate.value ?? "";
    workoutDueDate.value = workoutFlow.draft.dueDate ?? workoutDueDate.value ?? "";
    workoutNotes.value = workoutFlow.draft.notes ?? workoutNotes.value ?? "";
    if (Array.isArray(workoutFlow.draft.sessions) && workoutFlow.draft.sessions.length) {
      resetTrainingSessions(workoutFlow.draft.sessions);
    }
  }

  if (!editingWorkout) {
    safeSetText(saveWorkoutButton, "Salvar ficha");
    if (cancelWorkoutEditButton) cancelWorkoutEditButton.hidden = false;
  }
}

function saveNavigationState(options = {}) {
  if (isRestoringNavigation || !currentUserType) return;
  const state = {
    view: activeViewId || "",
    adminModule: activeAdminModule || "",
    adminSubpage: activeAdminSubpage || "",
    packageSubpage: activePackageSubpage || "",
    packageMode: activePackageMode || "",
    selectedStudentProfile,
    selectedAdminProfileStudent,
    selectedAdminWorkoutStudent,
    workoutFlow: getWorkoutNavigationState(),
    activeWorkoutByStudent: { ...activeWorkoutByStudent },
    activeSessionByWorkout: { ...activeSessionByWorkout },
    packageViewStudent: packageViewStudent?.value || "",
    packageStudent: packageStudent?.value || "",
    packageId: editingPackageId || "",
    savedAt: Date.now(),
  };

  const isAdminDashboardState = currentUserType === "admin"
    && state.view === "admin"
    && !state.adminModule
    && !state.adminSubpage
    && !state.packageSubpage;
  if (isAdminDashboardState && options.allowDashboardState !== true) {
    const previousState = getLocalJson(navigationStateStorageKey, null);
    const previousWasAdminSubpage = previousState?.view === "admin"
      && (previousState.adminModule || previousState.adminSubpage || previousState.packageSubpage);
    if (previousWasAdminSubpage) {
      console.info("Estado de navegacao mantido: reset automatico para dashboard ignorado.", {
        estadoAnterior: previousState,
      });
      return;
    }
  }

  try {
    localStorage.setItem(navigationStateStorageKey, JSON.stringify(state));
  } catch {
    // Navegacao e apenas conveniencia; se o navegador bloquear, o app segue normal.
  }
}

function restoreNavigationState() {
  const state = getLocalJson(navigationStateStorageKey, null);
  if (!state || !currentUserType) return false;

  isRestoringNavigation = true;
  try {
    if (state.activeWorkoutByStudent && typeof state.activeWorkoutByStudent === "object") {
      Object.assign(activeWorkoutByStudent, state.activeWorkoutByStudent);
    }
    if (state.activeSessionByWorkout && typeof state.activeSessionByWorkout === "object") {
      Object.assign(activeSessionByWorkout, state.activeSessionByWorkout);
    }

    if (state.selectedStudentProfile && currentUserType === "student") {
      const student = findStudentByIdentifier(state.selectedStudentProfile);
      if (student) {
        selectedStudentProfile = student.name;
        if (workoutViewStudent) workoutViewStudent.value = student.name;
      }
    }

    const targetView = currentUserType === "student" && state.view !== "admin" ? state.view || "treino" : currentUserType === "admin" ? "admin" : "treino";
    openView(targetView);

    if (currentUserType === "admin") {
      if (state.selectedAdminProfileStudent) selectedAdminProfileStudent = state.selectedAdminProfileStudent;
      if (state.packageViewStudent && packageViewStudent) packageViewStudent.value = state.packageViewStudent;
      if (state.packageViewStudent && packageStudentSearch) packageStudentSearch.value = state.packageViewStudent;
      if (state.packageStudent && packageStudent) packageStudent.value = state.packageStudent;

      if (state.adminModule) {
        openAdminModule(state.adminModule);
      }
      if (state.adminSubpage) {
        openAdminSubpage(state.adminSubpage);
      }
      if (state.adminModule === "checkins" && state.packageSubpage) {
        openPackageSubpage(state.packageSubpage, state.packageMode || "");
      }
      if (state.adminModule === "workouts") {
        restoreWorkoutNavigationState(state.workoutFlow);
      }
    }
    return true;
  } finally {
    isRestoringNavigation = false;
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
        packageModels: loadPackageModels().length,
        checkins: loadCheckins().length,
        dropInClasses: loadDropInClasses().length,
        agendaEvents: loadAgendaEvents().length,
        makeupCredits: loadMakeupCredits().length,
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
    localStorage.setItem(packageModelStorageKey, JSON.stringify(loadPackageModels()));
    localStorage.setItem(dropInStorageKey, JSON.stringify(loadDropInClasses()));
    localStorage.setItem(agendaEventStorageKey, JSON.stringify(loadAgendaEvents()));
    localStorage.setItem(makeupStorageKey, JSON.stringify(loadMakeupCredits()));
    localStorage.setItem(feedbackStorageKey, JSON.stringify(loadWorkoutFeedbacks()));
    localStorage.setItem(financialHistoryStorageKey, JSON.stringify(loadFinancialHistory()));
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
    queueSupabaseAppStateSync("alunos");
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
    queueSupabaseAppStateSync("fichas e treinos");
    if (workoutMessage) {
      workoutMessage.textContent = "Sincronizando treino com Supabase...";
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
    queueSupabaseAppStateSync("evolucao de carga");
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
    queueSupabaseAppStateSync("avaliacoes fisicas");
    if (assessmentMessage) {
      assessmentMessage.textContent = "Sincronizando avaliacao com Supabase...";
      assessmentMessage.classList.remove("error");
    }
  } catch {
    if (assessmentMessage) {
      assessmentMessage.textContent = "Avaliação apareceu na tela, mas o navegador bloqueou salvar o anexo.";
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
    queueSupabaseAppStateSync("check-ins");
    if (currentUserType === "admin") renderBillingList();
  } catch {
    showMessage("Check-in registrado na tela, mas o navegador bloqueou salvar ao recarregar.", "error");
  }
}

function normalizeDropInClasses(classes) {
  return normalizeListData(classes)
    .filter((item) => item && typeof item === "object")
    .map((item) => normalizeStudentLinkedRecord({
      ...item,
      date: item.date || formatToday(),
      modality: String(item.modality || item.type || "Aula avulsa").trim(),
      value: String(item.value || "").trim(),
      status: ["pendente", "pago", "cancelado"].includes(String(item.status || "").toLowerCase()) ? String(item.status).toLowerCase() : "pendente",
      note: String(item.note || item.observation || "").trim(),
      createdAt: item.createdAt || Date.now(),
    }));
}

function loadDropInClasses() {
  if (memoryDropIns) return memoryDropIns;

  try {
    const saved = localStorage.getItem(dropInStorageKey);
    memoryDropIns = normalizeDropInClasses(saved ? JSON.parse(saved) : []);
  } catch {
    memoryDropIns = [];
  }

  return memoryDropIns;
}

function saveDropInClasses(classes) {
  memoryDropIns = normalizeDropInClasses(classes);

  try {
    localStorage.setItem(dropInStorageKey, JSON.stringify(memoryDropIns));
    persistAppDataMeta();
    queueSupabaseAppStateSync("aulas avulsas");
  } catch {
    showMessage("Aula avulsa apareceu na tela, mas o navegador bloqueou salvar ao recarregar.", "error");
  }
}

function normalizeAgendaEvents(events) {
  return normalizeListData(events)
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: item.id || createId(),
      studentName: String(item.studentName || item.name || "").trim(),
      studentId: item.studentId || getStudentIdByName(item.studentName || ""),
      date: item.date || formatToday(),
      dateKey: item.dateKey || (parseBrazilianDate(item.date) ? getDateKey(parseBrazilianDate(item.date)) : ""),
      time: normalizeTimeText(item.time || ""),
      duration: Number(item.duration) || 60,
      type: item.type || "extra",
      modality: item.modality || "Aula",
      location: item.location || "",
      status: item.status || "confirmada",
      value: item.value || "",
      note: item.note || "",
      source: item.source || "manual",
      packageId: item.packageId || "",
      personalId: item.personalId || item.ownerId || personalAdminEmail,
      createdAt: item.createdAt || Date.now(),
      updatedAt: item.updatedAt || item.createdAt || Date.now(),
    }))
    .filter((item) => item.dateKey && item.time);
}

function loadAgendaEvents() {
  if (memoryAgendaEvents) return memoryAgendaEvents;

  try {
    const saved = localStorage.getItem(agendaEventStorageKey);
    memoryAgendaEvents = normalizeAgendaEvents(saved ? JSON.parse(saved) : []);
  } catch {
    memoryAgendaEvents = [];
  }

  return memoryAgendaEvents;
}

function saveAgendaEvents(events) {
  memoryAgendaEvents = normalizeAgendaEvents(events);

  try {
    localStorage.setItem(agendaEventStorageKey, JSON.stringify(memoryAgendaEvents));
    persistAppDataMeta();
    queueSupabaseAppStateSync("agenda");
  } catch {
    showMessage("Agenda atualizada na tela, mas o navegador bloqueou salvar ao recarregar.", "error");
  }
}

function normalizeClassGroups(groups) {
  const students = loadStudents();
  return normalizeListData(groups)
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const participantIds = normalizeListData(item.participantIds || item.studentIds || [])
        .map((id) => String(id || "").trim())
        .filter(Boolean);
      const participantNames = normalizeListData(item.participantNames || item.students || [])
        .map((name) => String(name || "").trim())
        .filter(Boolean);
      const resolvedIds = new Set(participantIds);
      participantNames.forEach((name) => {
        const student = students.find((candidate) => candidate.name === name);
        if (student?.id) resolvedIds.add(student.id);
      });
      const resolvedParticipants = Array.from(resolvedIds)
        .map((id) => students.find((student) => student.id === id))
        .filter(Boolean);
      return {
        id: item.id || createId(),
        name: String(item.name || "Grupo sem nome").trim(),
        participantIds: resolvedParticipants.map((student) => student.id),
        participantNames: resolvedParticipants.map((student) => student.name),
        notes: String(item.notes || "").trim(),
        createdAt: item.createdAt || Date.now(),
        updatedAt: item.updatedAt || item.createdAt || Date.now(),
      };
    })
    .filter((item) => item.name && item.participantIds.length);
}

function loadClassGroups() {
  if (memoryClassGroups) return memoryClassGroups;

  try {
    const saved = localStorage.getItem(classGroupStorageKey);
    memoryClassGroups = normalizeClassGroups(saved ? JSON.parse(saved) : []);
  } catch {
    memoryClassGroups = [];
  }

  return memoryClassGroups;
}

function saveClassGroups(groups) {
  memoryClassGroups = normalizeClassGroups(groups);

  try {
    localStorage.setItem(classGroupStorageKey, JSON.stringify(memoryClassGroups));
    persistAppDataMeta();
    queueSupabaseAppStateSync("grupos de aulas");
  } catch {
    showMessage("Grupo atualizado na tela, mas o navegador bloqueou salvar ao recarregar.", "error");
  }
}

function getStudentsByIds(ids = []) {
  const idSet = new Set(ids.filter(Boolean));
  return loadStudents().filter((student) => idSet.has(student.id));
}

function addStudentToSelection(selection, studentId) {
  const student = loadStudents().find((item) => item.id === studentId || item.name === studentId);
  if (!student?.id || selection.includes(student.id)) return selection;
  return [...selection, student.id];
}

function removeStudentFromSelection(selection, studentId) {
  return selection.filter((id) => id !== studentId);
}

function createStudentMultiPicker({ title, description, getSelection, setSelection, onChange }) {
  const panel = document.createElement("section");
  panel.className = "student-multi-picker";
  const head = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  const text = document.createElement("small");
  text.textContent = description;
  head.append(heading, text);

  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = "Pesquisar aluno pelo nome...";
  input.autocomplete = "off";
  const results = document.createElement("div");
  results.className = "student-search-suggestions";
  results.hidden = true;
  const chips = document.createElement("div");
  chips.className = "student-selection-chips";

  const renderChips = () => {
    chips.innerHTML = "";
    getStudentsByIds(getSelection()).forEach((student) => {
      const chip = document.createElement("span");
      chip.className = "student-selection-chip";
      const name = document.createElement("strong");
      name.textContent = student.name;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "X";
      remove.setAttribute("aria-label", `Remover ${student.name}`);
      remove.addEventListener("click", () => {
        setSelection(removeStudentFromSelection(getSelection(), student.id));
        renderChips();
        onChange?.();
      });
      chip.append(name, remove);
      chips.appendChild(chip);
    });
  };

  const renderResults = () => {
    results.innerHTML = "";
    const query = normalizeSearchText(input.value);
    const selected = new Set(getSelection());
    const matches = loadStudents()
      .filter((student) => !selected.has(student.id))
      .filter((student) => !query || normalizeSearchText(student.name).includes(query))
      .slice(0, 8);
    if (!matches.length) {
      const empty = document.createElement("span");
      empty.className = "student-search-empty";
      empty.textContent = "Nenhum aluno encontrado.";
      results.appendChild(empty);
    }
    matches.forEach((student) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = student.name;
      button.addEventListener("click", () => {
        setSelection(addStudentToSelection(getSelection(), student.id));
        input.value = "";
        results.hidden = true;
        renderChips();
        onChange?.();
      });
      results.appendChild(button);
    });
  };

  input.addEventListener("input", () => {
    results.hidden = false;
    renderResults();
  });
  input.addEventListener("focus", () => {
    results.hidden = false;
    renderResults();
  });
  document.addEventListener("click", (event) => {
    if (!panel.contains(event.target)) results.hidden = true;
  });

  panel.append(head, input, results, chips);
  panel.renderChips = renderChips;
  renderChips();
  return panel;
}

function renderClassGroupsList(container) {
  if (!container) return;
  container.innerHTML = "";
  const groups = loadClassGroups();
  if (!groups.length) {
    const empty = document.createElement("small");
    empty.textContent = "Nenhum grupo fixo cadastrado.";
    container.appendChild(empty);
    return;
  }
  groups.forEach((group) => {
    const card = document.createElement("article");
    card.className = "class-group-card";
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = group.name;
    const detail = document.createElement("small");
    detail.textContent = group.participantNames.join(", ");
    info.append(title, detail);

    const actions = document.createElement("div");
    actions.className = "student-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "secondary";
    edit.textContent = "Editar";
    edit.addEventListener("click", () => {
      editingClassGroupId = group.id;
      const form = document.querySelector("#class-group-form");
      const name = document.querySelector("#class-group-name");
      if (name) name.value = group.name;
      classGroupEditorParticipants = [...group.participantIds];
      form?.querySelector(".student-multi-picker")?.renderChips?.();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary danger";
    remove.textContent = "Excluir";
    remove.addEventListener("click", () => {
      if (!confirm(`Excluir o grupo "${group.name}"?`)) return;
      addDeletionTombstones([createTombstoneEntry("classGroups", group)]);
      saveClassGroups(loadClassGroups().filter((item) => item.id !== group.id));
      if (editingClassGroupId === group.id) {
        editingClassGroupId = "";
        classGroupEditorParticipants = [];
        const name = document.querySelector("#class-group-name");
        if (name) name.value = "";
      }
      renderClassGroupsList(container);
      refreshAgendaGroupSelects();
    });
    actions.append(edit, remove);
    card.append(info, actions);
    container.appendChild(card);
  });
}

function createClassGroupManager() {
  if (!scheduleAdminPanel || document.querySelector("#class-group-manager")) return;
  const panel = document.createElement("section");
  panel.className = "class-group-manager";
  panel.id = "class-group-manager";
  panel.innerHTML = `
    <div>
      <p class="eyebrow">Grupos fixos</p>
      <h3>Aulas em grupo</h3>
      <span>Crie grupos como Beach Tennis - Sexta 18h ou Beach Tennis - Mães.</span>
    </div>
    <form id="class-group-form" class="class-group-form">
      <label>Nome do grupo<input id="class-group-name" placeholder="Ex: Beach Tennis - Sexta 18h" /></label>
      <button type="submit" class="primary">Salvar grupo</button>
      <button type="button" class="secondary" id="class-group-clear">Novo grupo</button>
    </form>
    <div class="class-group-list" id="class-group-list"></div>
  `;
  const toolbar = scheduleAdminPanel.querySelector(".agenda-toolbar");
  scheduleAdminPanel.insertBefore(panel, toolbar?.nextSibling || scheduleAdminPanel.firstChild);
  const form = panel.querySelector("#class-group-form");
  const nameInputField = panel.querySelector("#class-group-name");
  const list = panel.querySelector("#class-group-list");
  const picker = createStudentMultiPicker({
    title: "Integrantes",
    description: "Pesquise e adicione vários alunos ao grupo.",
    getSelection: () => classGroupEditorParticipants,
    setSelection: (next) => { classGroupEditorParticipants = next; },
  });
  form.insertBefore(picker, form.querySelector("button"));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = nameInputField.value.trim();
    if (!name || !classGroupEditorParticipants.length) {
      showMessage("Informe nome do grupo e pelo menos um aluno.", "error");
      return;
    }
    const groups = loadClassGroups();
    const index = groups.findIndex((group) => group.id === editingClassGroupId);
    const payload = {
      id: editingClassGroupId || createId(),
      name,
      participantIds: [...classGroupEditorParticipants],
      createdAt: index >= 0 ? groups[index].createdAt : Date.now(),
      updatedAt: Date.now(),
    };
    if (index >= 0) groups[index] = { ...groups[index], ...payload };
    else groups.push(payload);
    saveClassGroups(groups);
    const syncResult = await supabaseSyncPromise;
    if (!syncResult?.ok) {
      showMessage("Grupo salvo localmente, aguardando sincronização com Supabase.", "error");
      return;
    }
    editingClassGroupId = "";
    classGroupEditorParticipants = [];
    nameInputField.value = "";
    picker.renderChips();
    renderClassGroupsList(list);
    refreshAgendaGroupSelects();
    showMessage("Grupo salvo no Supabase.");
  });
  panel.querySelector("#class-group-clear")?.addEventListener("click", () => {
    editingClassGroupId = "";
    classGroupEditorParticipants = [];
    nameInputField.value = "";
    picker.renderChips();
  });
  renderClassGroupsList(list);
}

function refreshAgendaGroupSelects() {
  document.querySelectorAll("[data-agenda-group-select]").forEach((select) => {
    const previous = select.value;
    select.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecione um grupo";
    select.appendChild(placeholder);
    loadClassGroups().forEach((group) => {
      const option = document.createElement("option");
      option.value = group.id;
      option.textContent = group.name;
      select.appendChild(option);
    });
    select.value = loadClassGroups().some((group) => group.id === previous) ? previous : "";
  });
}

function applyGroupToAgendaSelection(groupId, setSelection, renderPicker) {
  const group = loadClassGroups().find((item) => item.id === groupId);
  if (!group) return;
  setSelection(Array.from(new Set(group.participantIds || [])));
  renderPicker?.();
}

function createAgendaAudienceControls(form, select, type) {
  if (!form || !select || form.dataset.audienceEnhanced === "true") return;
  form.dataset.audienceEnhanced = "true";
  const state = {
    get selection() {
      return type === "makeup" ? agendaMakeupParticipants : agendaDropinParticipants;
    },
    set selection(next) {
      if (type === "makeup") agendaMakeupParticipants = next;
      else agendaDropinParticipants = next;
    },
  };
  const panel = document.createElement("section");
  panel.className = "agenda-audience-panel";
  const label = document.createElement("label");
  label.textContent = "Tipo de aula";
  const mode = document.createElement("select");
  mode.dataset.agendaAudienceMode = type;
  mode.innerHTML = '<option value="individual">Aluno individual</option><option value="group">Grupo</option>';
  label.appendChild(mode);

  const groupLabel = document.createElement("label");
  groupLabel.textContent = "Grupo";
  const groupSelect = document.createElement("select");
  groupSelect.dataset.agendaGroupSelect = type;
  groupLabel.appendChild(groupSelect);
  groupLabel.hidden = true;

  const picker = createStudentMultiPicker({
    title: "Participantes desta aula",
    description: "Ao selecionar um grupo, você pode retirar ou acrescentar alunos só nesta aula.",
    getSelection: () => state.selection,
    setSelection: (next) => { state.selection = next; },
  });
  picker.hidden = true;

  mode.addEventListener("change", () => {
    const isGroup = mode.value === "group";
    groupLabel.hidden = !isGroup;
    picker.hidden = !isGroup;
    select.closest("label").hidden = isGroup;
  });
  groupSelect.addEventListener("change", () => {
    applyGroupToAgendaSelection(groupSelect.value, (next) => { state.selection = next; }, () => picker.renderChips());
  });

  panel.append(label, groupLabel, picker);
  form.insertBefore(panel, select.closest("label"));
  refreshAgendaGroupSelects();
}

function setupAgendaGroupFeatures() {
  createClassGroupManager();
  createAgendaAudienceControls(agendaMakeupForm, agendaMakeupStudent, "makeup");
  createAgendaAudienceControls(agendaDropinForm, agendaDropinStudent, "dropin");
}

function getAgendaFormParticipants(type, fallbackName) {
  const ids = type === "makeup" ? agendaMakeupParticipants : agendaDropinParticipants;
  const students = getStudentsByIds(ids);
  if (students.length) return students;
  const fallback = loadStudents().find((student) => student.name === fallbackName);
  return fallback ? [fallback] : [{ id: "", name: fallbackName }];
}

function resetAgendaAudiencePanel(form, type) {
  const mode = form?.querySelector(`[data-agenda-audience-mode='${type}']`);
  const groupSelect = form?.querySelector(`[data-agenda-group-select='${type}']`);
  const groupLabel = groupSelect?.closest("label");
  const picker = form?.querySelector(".student-multi-picker");
  const studentSelect = type === "makeup" ? agendaMakeupStudent : agendaDropinStudent;
  mode && (mode.value = "individual");
  if (groupSelect) groupSelect.value = "";
  if (groupLabel) groupLabel.hidden = true;
  if (picker) picker.hidden = true;
  if (studentSelect?.closest("label")) studentSelect.closest("label").hidden = false;
}

function syncAutomaticPackageAgendaEvents(student, classPackage) {
  if (!student || !classPackage) {
    return { ok: false, events: [], created: 0, expected: 0, error: new Error("Aluno ou pacote ausente para gerar agenda.") };
  }
  const todayKey = getDateKey();
  const existingEvents = loadAgendaEvents();
  const lessons = generatePackageSchedule(classPackage);
  const keptEvents = existingEvents.filter((event) => {
    const samePackage = event.packageId === classPackage.id && event.source === "pacote automático";
    const isFuture = !event.dateKey || event.dateKey >= todayKey;
    return !(samePackage && isFuture);
  });
  const nextEvents = [...keptEvents];
  let created = 0;
  lessons.forEach((lesson) => {
    const duplicateIndex = nextEvents.findIndex((event) =>
      ((student.id && event.studentId === student.id) || event.studentName === student.name)
      && event.dateKey === lesson.dateKey
      && event.time === lesson.time
      && !String(event.status || "").toLowerCase().includes("cancel")
    );
    if (duplicateIndex >= 0) {
      nextEvents[duplicateIndex] = {
        ...nextEvents[duplicateIndex],
        studentName: student.name,
        studentId: student.id || nextEvents[duplicateIndex].studentId || "",
        type: "package",
        source: nextEvents[duplicateIndex].source === "manual" ? "pacote automático" : nextEvents[duplicateIndex].source,
        packageId: classPackage.id,
        personalId: classPackage.personalId || currentSupabaseUser?.id || personalAdminEmail,
        updatedAt: Date.now(),
      };
      return;
    }
    nextEvents.push({
      id: createId(),
      studentName: student.name,
      studentId: student.id || "",
      date: lesson.date,
      dateKey: lesson.dateKey,
      time: lesson.time || "",
      duration: Number(lesson.duration) || 60,
      type: "package",
      modality: student.modality || classPackage.name || "Aula presencial",
      location: lesson.location || "Studio Joao Victor",
      status: "confirmada",
      source: "pacote automático",
      packageId: classPackage.id,
      personalId: classPackage.personalId || currentSupabaseUser?.id || personalAdminEmail,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    created += 1;
  });
  saveAgendaEvents(nextEvents);
  return { ok: true, events: nextEvents, created, expected: lessons.length };
}

function addDaysToBrazilianDate(dateText, days) {
  const date = parseBrazilianDate(dateText);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("pt-BR");
}

function isPastBrazilianDate(dateText) {
  const date = parseBrazilianDate(dateText);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function normalizeMakeupStatus(status, validUntil) {
  const allowed = ["available", "requested", "approved", "used", "expired", "rejected", "personal-pending"];
  const normalized = allowed.includes(status) ? status : status === "used" ? "used" : "available";
  if (["used", "rejected", "expired"].includes(normalized)) return normalized;
  return isPastBrazilianDate(validUntil) ? "expired" : normalized;
}

function getMakeupStatusLabel(status) {
  const labels = {
    available: "Disponível",
    requested: "Solicitada",
    approved: "Aprovada",
    used: "Concluída",
    expired: "Expirada",
    rejected: "Recusada",
    "personal-pending": "Remarcada pelo personal - aguardando reagendamento",
  };
  return labels[status] || "Disponível";
}

function getMakeupDisplayStatus(credit) {
  if (credit?.source === "personal") {
    if (credit.status === "personal-pending") return "Aguardando reagendamento";
    if (credit.status === "requested") return "Solicitada pelo aluno";
    if (credit.status === "approved") return "Reagendada";
    if (credit.status === "used") return "Concluída";
    if (credit.status === "rejected") return "Recusada";
  }
  return getMakeupStatusLabel(credit?.status);
}

function normalizeMakeupCredits(credits) {
  return normalizeListData(credits)
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const sourceLessonDate = item.sourceLessonDate || item.date || "";
      const validUntil = item.validUntil || item.expiresAt || addDaysToBrazilianDate(sourceLessonDate, 10);
      const status = normalizeMakeupStatus(item.status, validUntil);
      return normalizeStudentLinkedRecord({
        ...item,
        packageId: item.packageId || "",
        packageName: item.packageName || "",
        sourceLessonDate,
        lessonTime: item.lessonTime || "",
        noticeDate: item.noticeDate || item.cancellationDate || "",
        noticeTime: item.noticeTime || "",
        leadMinutes: Number(item.leadMinutes) || 0,
        generated: item.generated !== false,
        reason: item.reason || "",
        validUntil,
        status,
        usedAt: item.usedAt || "",
        requestedAt: item.requestedAt || "",
        approvedAt: item.approvedAt || "",
        rejectedAt: item.rejectedAt || "",
        replacementDate: item.replacementDate || "",
        replacementTime: item.replacementTime || "",
        note: String(item.note || "").trim(),
        personalNote: String(item.personalNote || item.personal_note || "").trim(),
        createdAt: item.createdAt || Date.now(),
      });
    });
}

function loadMakeupCredits() {
  if (memoryMakeups) return memoryMakeups;

  try {
    const saved = localStorage.getItem(makeupStorageKey);
    memoryMakeups = normalizeMakeupCredits(saved ? JSON.parse(saved) : []);
  } catch {
    memoryMakeups = [];
  }

  return memoryMakeups;
}

function saveMakeupCredits(credits) {
  memoryMakeups = normalizeMakeupCredits(credits);

  try {
    localStorage.setItem(makeupStorageKey, JSON.stringify(memoryMakeups));
    persistAppDataMeta();
    queueSupabaseAppStateSync("reposicoes");
  } catch {
    showMessage("Reposição apareceu na tela, mas o navegador bloqueou salvar ao recarregar.", "error");
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
      frequency: item.frequency || "",
      value: item.value || "",
      startDate: item.startDate || "",
      endDate: item.endDate || "",
      makeupLimit: Number(item.makeupLimit) || 0,
      days: item.days || "",
      schedule: normalizeWeeklySchedule(item.schedule || {}, parsePackageDays(item.days || "")),
      time: item.time || "",
      notes: item.notes || "",
      monthKey: item.monthKey || "",
      predictedLessons: Number(item.predictedLessons) || Number(item.total) || 0,
      remainingLessons: Number(item.remainingLessons) || Math.max((Number(item.total) || 0) - getCompletedLessons({ ...item, id: item.id || "" }), 0),
      expectedValue: item.expectedValue || item.value || "",
      status: item.status || "ativo",
      autoGenerated: item.autoGenerated === true,
      personalId: item.personalId || item.ownerId || personalAdminEmail,
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
    queueSupabaseAppStateSync("pacotes");
  } catch {
    showMessage("Pacote salvo na tela, mas o navegador bloqueou salvar ao recarregar.", "error");
  }
}

function upsertAutomaticMonthlyPackageForStudent(student) {
  if (!student || !isPresentialStudent(student)) return null;
  const preview = getStudentInitialPackagePreview(student);
  if (!preview.remainingLessons || !normalizeBillingDays(student.billingDays).length) return null;

  const packages = loadClassPackages();
  const existingIndex = packages.findIndex((item) =>
    item.autoGenerated === true
    && item.monthKey === preview.monthKey
    && ((student.id && item.studentId === student.id) || item.studentName === student.name)
  );
  const existing = existingIndex >= 0 ? packages[existingIndex] : null;
  const packageData = {
    id: existing?.id || createId(),
    studentName: student.name,
    studentId: student.id || getStudentIdByName(student.name),
    name: `Pacote mensal - ${preview.monthLabel}`,
    total: preview.remainingLessons,
    frequency: student.frequency || "",
    value: formatCurrencyNumber(preview.totalValue),
    startDate: preview.startDate.toLocaleDateString("pt-BR"),
    endDate: preview.endDate.toLocaleDateString("pt-BR"),
    makeupLimit: normalizeMakeupLimit(student.makeupLimit, student.frequency),
    days: preview.daysText,
    schedule: normalizeWeeklySchedule(student.weeklySchedule || {}, student.billingDays),
    time: "",
    notes: preview.proportional
      ? "Pacote criado automaticamente no cadastro do aluno. Valor proporcional do primeiro mês."
      : "Pacote criado automaticamente no cadastro do aluno.",
    monthKey: preview.monthKey,
    predictedLessons: preview.remainingLessons,
    remainingLessons: preview.remainingLessons,
    expectedValue: formatCurrencyNumber(preview.totalValue),
    status: "ativo",
    autoGenerated: true,
    personalId: currentSupabaseUser?.id || personalAdminEmail,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  if (existingIndex >= 0) {
    packages[existingIndex] = { ...existing, ...packageData };
  } else {
    packages.push(packageData);
  }

  saveClassPackages(packages);
  return packageData;
}

function normalizePackageModels(models) {
  return normalizeListData(models)
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: item.id || createId(),
      name: String(item.name || "").trim(),
      value: String(item.value || "").trim(),
      frequency: String(item.frequency || "").trim(),
      total: Number(item.total) || 0,
      makeupLimit: Number(item.makeupLimit) || 0,
      updatedAt: item.updatedAt || Date.now(),
    }))
    .filter((item) => item.name)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}

function loadPackageModels() {
  if (memoryPackageModels) return memoryPackageModels;

  try {
    const savedModels = localStorage.getItem(packageModelStorageKey);
    memoryPackageModels = normalizePackageModels(savedModels ? JSON.parse(savedModels) : [
      { name: "Musculação 2x", frequency: "2x", total: 8, makeupLimit: 2 },
      { name: "Musculação 3x", frequency: "3x", total: 12, makeupLimit: 3 },
      { name: "Beach Tennis", frequency: "1x", total: 4, makeupLimit: 1 },
      { name: "Online", frequency: "online", total: 0, makeupLimit: 0 },
    ]);
  } catch {
    memoryPackageModels = [];
  }

  return memoryPackageModels;
}

function savePackageModels(models) {
  memoryPackageModels = normalizePackageModels(models);

  try {
    localStorage.setItem(packageModelStorageKey, JSON.stringify(memoryPackageModels));
    persistAppDataMeta();
    queueSupabaseAppStateSync("modelos de pacote");
  } catch {
    showMessage("Modelo de pacote salvo na tela, mas o navegador limitou o cache local.", "error");
  }
}

function upsertPackageModelFromForm(packageData) {
  if (!packageData?.name) return;
  const models = loadPackageModels();
  const index = models.findIndex((model) => model.name.toLowerCase() === packageData.name.toLowerCase());
  const model = {
    id: index >= 0 ? models[index].id : createId(),
    name: packageData.name,
    value: packageData.value,
    frequency: packageData.frequency,
    total: packageData.total,
    makeupLimit: packageData.makeupLimit,
    updatedAt: Date.now(),
  };
  if (index >= 0) {
    models[index] = { ...models[index], ...model };
  } else {
    models.push(model);
  }
  savePackageModels(models);
  fillPackageModelList();
}

function normalizeWorkoutFeedbacks(feedbacks) {
  return normalizeListData(feedbacks)
    .filter((item) => item && typeof item === "object")
    .map((item) => normalizeStudentLinkedRecord({
      ...item,
      workoutTitle: item.workoutTitle || item.workout || "Treino",
      sessionId: String(item.sessionId || "").trim(),
      sessionTitle: String(item.sessionTitle || "").trim(),
      rating: String(item.rating || "").trim(),
      difficulty: String(item.difficulty || "").trim(),
      pain: item.pain === true || item.pain === "Sim" || item.pain === "sim",
      painLocation: String(item.painLocation || "").trim(),
      note: String(item.note || item.observation || "").trim(),
      skipped: item.skipped === true,
      status: String(item.status || "").trim(),
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
    queueSupabaseAppStateSync("feedbacks de treino");
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

  const dropIns = loadDropInClasses().map((item) =>
    item.studentName === previousName ? { ...item, studentName: nextName, studentId: nextStudentId || item.studentId || "" } : item,
  );
  saveDropInClasses(dropIns);

  const makeups = loadMakeupCredits().map((item) =>
    item.studentName === previousName ? { ...item, studentName: nextName, studentId: nextStudentId || item.studentId || "" } : item,
  );
  saveMakeupCredits(makeups);

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
      order: Number(session.order || index + 1),
      exercises: (session.exercises || []).map(normalizeExercise),
    }),
  );

  return {
    id: workout.id || createId(),
    studentName: workout.studentName || studentName,
    studentId: workout.studentId || getStudentIdByName(workout.studentName || studentName),
    title: workout.title || "Treino",
    goal: workout.goal || "Objetivo nao informado",
    frequency: workout.frequency || "Frequência não informada",
    startDate: workout.startDate || "Sem início",
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
  const selectedDropInStudent = dropInStudent?.value;
  const selectedMakeupStudent = makeupStudent?.value;
  const selectedMakeupListStudent = makeupListStudent?.value;
  const selectedPersonalRescheduleStudent = personalRescheduleStudent?.value;
  const selectedLessonHistoryStudent = lessonHistoryStudent?.value;
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
  dropInStudent?.replaceChildren();
  makeupStudent?.replaceChildren();
  makeupListStudent?.replaceChildren();
  personalRescheduleStudent?.replaceChildren();
  lessonHistoryStudent?.replaceChildren();
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

    const dropInOption = document.createElement("option");
    dropInOption.textContent = student.name;
    dropInOption.value = student.name;

    const makeupOption = document.createElement("option");
    makeupOption.textContent = student.name;
    makeupOption.value = student.name;

    const makeupListOption = document.createElement("option");
    makeupListOption.textContent = student.name;
    makeupListOption.value = student.name;

    const personalRescheduleOption = document.createElement("option");
    personalRescheduleOption.textContent = student.name;
    personalRescheduleOption.value = student.name;

    const lessonHistoryOption = document.createElement("option");
    lessonHistoryOption.textContent = student.name;
    lessonHistoryOption.value = student.name;

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
    dropInStudent?.appendChild(dropInOption);
    makeupStudent?.appendChild(makeupOption);
    makeupListStudent?.appendChild(makeupListOption);
    personalRescheduleStudent?.appendChild(personalRescheduleOption);
    lessonHistoryStudent?.appendChild(lessonHistoryOption);
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
  if (dropInStudent) dropInStudent.value = validName(selectedDropInStudent, packageViewStudent?.value || firstStudentName);
  if (makeupStudent) makeupStudent.value = validName(selectedMakeupStudent, packageViewStudent?.value || firstStudentName);
  if (makeupListStudent) makeupListStudent.value = validName(selectedMakeupListStudent, packageViewStudent?.value || firstStudentName);
  if (personalRescheduleStudent) personalRescheduleStudent.value = validName(selectedPersonalRescheduleStudent, packageViewStudent?.value || firstStudentName);
  if (lessonHistoryStudent) lessonHistoryStudent.value = validName(selectedLessonHistoryStudent, packageViewStudent?.value || firstStudentName);
  if (checkinFilterStudent) checkinFilterStudent.value = selectedCheckinFilterStudent && studentNames.includes(selectedCheckinFilterStudent) ? selectedCheckinFilterStudent : "";
  if (loginStudentSelect) loginStudentSelect.value = validName(selectedLoginStudent);
  updateStudentHeader();
  fillManualCheckinPackageSelect();
  fillMakeupPackageSelect();
  fillPersonalReschedulePackageSelect();
  refreshSearchableStudentSelects();
}

const searchableStudentSelectIds = [
  "assessment-student",
  "admin-evolution-student",
  "admin-feedback-student-filter",
  "admin-notes-student-filter",
  "manual-checkin-student",
  "makeup-student",
  "dropin-student",
  "personal-reschedule-student",
  "makeup-list-student",
  "lesson-history-student",
  "checkin-filter-student",
  "agenda-makeup-student",
  "agenda-dropin-student",
];

function getStudentSearchOptionLabel(select, value) {
  const option = Array.from(select?.options || []).find((item) => item.value === value);
  return option?.textContent || value || "";
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function renderStudentSearchSuggestions(wrapper, select, query = "") {
  const list = wrapper.querySelector("[data-student-search-suggestions]");
  if (!list || !select) return;
  list.innerHTML = "";
  const normalizedQuery = normalizeSearchText(query);
  const options = Array.from(select.options || [])
    .filter((option) => option.value || option.textContent)
    .filter((option) => !normalizedQuery || normalizeSearchText(option.textContent).includes(normalizedQuery))
    .slice(0, 8);

  if (!options.length) {
    const empty = document.createElement("span");
    empty.className = "student-search-empty";
    empty.textContent = "Nenhum aluno encontrado.";
    list.appendChild(empty);
    return;
  }

  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.textContent;
    button.dataset.studentSearchValue = option.value;
    button.addEventListener("click", () => {
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      const input = wrapper.querySelector("[data-student-search-input]");
      if (input) input.value = option.textContent;
      list.hidden = true;
    });
    list.appendChild(button);
  });
}

function enhanceStudentSelect(select) {
  if (!select || select.dataset.searchEnhanced === "true") return;
  const parent = select.parentElement;
  if (!parent) return;

  select.dataset.searchEnhanced = "true";
  select.classList.add("student-select-native-hidden");
  const wrapper = document.createElement("div");
  wrapper.className = "student-search-select";
  wrapper.dataset.studentSearchFor = select.id || "";

  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = "Buscar aluno...";
  input.autocomplete = "off";
  input.dataset.studentSearchInput = "true";
  input.value = getStudentSearchOptionLabel(select, select.value);

  const suggestions = document.createElement("div");
  suggestions.className = "student-search-suggestions";
  suggestions.dataset.studentSearchSuggestions = "true";
  suggestions.hidden = true;

  input.addEventListener("input", () => {
    suggestions.hidden = false;
    renderStudentSearchSuggestions(wrapper, select, input.value);
  });
  input.addEventListener("focus", () => {
    suggestions.hidden = false;
    renderStudentSearchSuggestions(wrapper, select, input.value);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") suggestions.hidden = true;
  });
  select.addEventListener("change", () => {
    input.value = getStudentSearchOptionLabel(select, select.value);
  });
  document.addEventListener("click", (event) => {
    if (!wrapper.contains(event.target)) suggestions.hidden = true;
  });

  wrapper.append(input, suggestions);
  parent.insertBefore(wrapper, select.nextSibling);
  renderStudentSearchSuggestions(wrapper, select, input.value);
}

function refreshSearchableStudentSelects() {
  searchableStudentSelectIds.forEach((id) => {
    const select = document.querySelector(`#${id}`);
    if (!select) return;
    enhanceStudentSelect(select);
    const wrapper = document.querySelector(`[data-student-search-for="${id}"]`);
    const input = wrapper?.querySelector("[data-student-search-input]");
    if (input) input.value = getStudentSearchOptionLabel(select, select.value);
    if (wrapper) renderStudentSearchSuggestions(wrapper, select, input?.value || "");
  });
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

function createStudentRow(student) {
  const row = document.createElement("article");
  row.className = "student-list-card";

  const head = document.createElement("div");
  head.className = "student-list-card-head";
  const name = document.createElement("strong");
  name.textContent = student.name;
  const payment = document.createElement("span");
  payment.className = `student-status-pill ${student.payment === "Atrasado" ? "danger" : isPaymentBlocked(student) ? "pending" : "ok"}`;
  payment.textContent = student.payment || "Sem status";
  head.append(name, payment);

  const details = document.createElement("div");
  details.className = "student-list-card-grid";
  [
    ["Plano", student.plan || "-"],
    ["Vencimento", student.due || "-"],
    ["Status", isPaymentBlocked(student) ? "Bloqueado" : "Ativo"],
    ["Aplicativo", hasStudentAppAccess(student) ? "✔ Acesso criado" : "⚠ Sem acesso ao aplicativo"],
  ].forEach(([label, value]) => details.appendChild(createAdminMetric(label, value)));

  const actions = document.createElement("div");
  actions.className = "student-actions";

  const open = document.createElement("button");
  open.type = "button";
  open.className = "primary";
  open.dataset.openStudentProfile = student.id;
  open.textContent = "Abrir perfil";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "secondary danger-action";
  remove.dataset.removeStudent = student.id;
  remove.textContent = "Remover aluno";

  actions.append(open, remove);
  row.append(head, details, actions);
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
  eyebrow.textContent = "Presenças";
  const title = document.createElement("h3");
  title.textContent = "Pacote e check-ins";
  titleBox.append(eyebrow, title);
  head.appendChild(titleBox);

  const body = document.createElement("div");
  body.className = "admin-profile-card-body package-compact-body";
  const balance = getLessonBalance(studentName, activePackage);
  body.append(
    createAdminMetric("Pacote", activePackage?.name || "Sem pacote ativo"),
    createAdminMetric("Progresso", activePackage ? `${packageStatus.completed}/${activePackage.total}` : "0/0"),
    createAdminMetric("Restantes", packageStatus?.remaining ?? "0"),
    createAdminMetric("Reposições disp.", balance.makeupAvailable),
    createAdminMetric("Solicitadas", balance.makeupRequested),
    createAdminMetric("Usadas", balance.makeupUsed),
    createAdminMetric("Expiradas", balance.makeupExpired),
    createAdminMetric("Avulsas", balance.dropInCount),
    createAdminMetric("Pendente avulsa", formatCurrencyNumber(balance.pendingDropInValue)),
  );

  const actions = document.createElement("div");
  actions.className = "student-actions";
  [
    ["Gerenciar pacote", "manage"],
    ["Marcar presença", "checkin"],
    ["Marcar falta", "absence"],
    ["Ver histórico", "history"],
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
  eyebrow.textContent = "Histórico";
  const title = document.createElement("h3");
  title.textContent = "Histórico do aluno";
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
      "Avaliações anteriores",
      oldAssessments.map((assessment) => createHistoryItem(assessment.date, `Peso ${assessment.weight || "-"} | gordura ${assessment.fat || "-"} | massa ${assessment.muscle || "-"}`)),
      "Nenhuma avaliação anterior.",
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
      "Nenhum registro de presença ainda.",
    ),
    createHistoryGroup(
      "Desempenho registrado",
      progressGroups.slice(0, 12).map((group) => {
        const progress = getProgressFromRecords(group.records);
        return createHistoryItem(group.exerciseName, `${group.workoutTitle || "Treino"} | ${progress.detail}`);
      }),
      "Nenhuma evolução registrada.",
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
      : "Crie um pacote antes de marcar presença.";
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

  const student = findStudentByIdentifier(studentName);
  if (!student) {
    studentAdminProfile.hidden = true;
    return;
  }

  selectedAdminProfileStudent = student.name;
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
  detail.textContent = `${student.plan} | ${student.value || "-"} | pagamento ${student.payment}`;
  info.append(eyebrow, title, detail);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "secondary";
  close.dataset.closeStudentProfile = "true";
  close.textContent = "Voltar para lista de alunos";
  header.append(info, close);

  const grid = document.createElement("div");
  grid.className = "student-admin-profile-grid";

  const actionPanel = document.createElement("div");
  actionPanel.className = "student-profile-actions-panel";
  [
    ["Criar acesso do aluno", "access"],
    ["Editar cadastro", "edit"],
    ["Ver fichas", "workout"],
    ["Ver avaliações", "assessment"],
    ["Ver evolução", "evolution"],
    ["Ver pacotes e check-ins", "checkin"],
  ].forEach(([label, action]) => actionPanel.appendChild(createActionButton(label, action, student.name)));
  if (hasStudentAppAccess(student)) {
    actionPanel.querySelector('[data-student-profile-action="access"]')?.remove();
  }

  grid.append(
    createAdminProfileCard("Dados do aluno", "Cadastro", [
      createAdminMetric("Nome", student.name),
      createAdminMetric("Telefone", student.phone || "Não cadastrado"),
      createAdminMetric("WhatsApp", student.phone || "Não cadastrado"),
      createAdminMetric("Email", student.email || "Não cadastrado"),
      createAdminMetric("Plano", student.plan),
      createAdminMetric("Modalidade", student.modality || student.plan || "-"),
      createAdminMetric("Frequência", student.frequency || "3x"),
      createAdminMetric("Limite reposições", normalizeMakeupLimit(student.makeupLimit, student.frequency)),
      createAdminMetric("WhatsApp", student.phone || "Não cadastrado"),
      createAdminMetric("Nascimento", student.birthDate || "Não informado"),
      createAdminMetric("Login", hasStudentAppAccess(student) ? "✔ Acesso criado" : "⚠ Sem acesso ao aplicativo"),
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
    createAdminProfileCard("Avaliações", "Bioimpedância", [
      createAdminMetric("Total", assessments.length),
      createAdminMetric("Última avaliação", latestAssessment?.date || "Sem avaliação"),
      createAdminMetric("Peso", latestAssessment?.weight || "-"),
      createAdminMetric("Gordura", latestAssessment?.fat || "-"),
    ], [createActionButton("Abrir avaliações", "assessment", student.name)]),
    createAdminProfileCard("Evolução", "Carga", [
      createAdminMetric("Progresso recente", progress.title),
      createAdminMetric("Detalhe", progress.detail),
    ], [createActionButton("Ver evolução", "evolution", student.name)]),
  );

  studentAdminProfile.append(header, actionPanel, grid, createAdminStudentHistorySection(student.name));
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
  const query = studentListSearch?.value.trim().toLowerCase() || "";
  const visibleStudents = query
    ? students.filter((student) => [
      student.name,
      student.phone,
      student.whatsapp,
      student.email,
    ].some((value) => String(value || "").toLowerCase().includes(query)))
    : students;

  studentList.innerHTML = "";
  visibleStudents.forEach((student) => {
    studentList.appendChild(createStudentRow(student));
  });
  if (!visibleStudents.length) {
    studentList.textContent = query ? "Nenhum aluno encontrado para essa busca." : "Nenhum aluno cadastrado.";
  }

  safeSetText(studentCount, students.length);
  safeSetText(pendingCount, pendingStudents.length);
  renderBlockedPaymentPanel();
  fillStudentSelects();
  renderPackageAdminList();
  renderWorkouts();
  renderAdminAssessments();
  renderCheckinHistory();
  renderBillingList();
  renderAdminAlerts();
  renderHomeDashboard();
  renderMissingTrainingDaysPanel();
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
  total.textContent = `${workout.exercises.length} exercícios`;

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
  saveNavigationState();
}

function showWorkoutStudentDirectory(options = {}) {
  if (!workoutStudentDirectory || !workoutStudentWorkspace || !workoutForm || !workoutTablePanel || !workoutStudent) return;

  if (isRestoringNavigation && options.preserveNavigation !== true) return;

  selectedAdminWorkoutStudent = "";
  workoutStudentDirectory.hidden = false;
  workoutStudentWorkspace.hidden = true;
  workoutForm.hidden = true;
  workoutTablePanel.hidden = true;
  workoutStudent.disabled = false;
  editingWorkout = null;
  renderWorkouts();
  saveNavigationState();
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
  saveNavigationState();
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
    ["name", "Nome do exercício", true],
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

  const orderLabel = document.createElement("label");
  orderLabel.textContent = "Ordem";
  const orderInput = document.createElement("input");
  orderInput.type = "number";
  orderInput.min = "1";
  orderInput.step = "1";
  orderInput.dataset.sessionOrder = "true";
  orderInput.placeholder = "1";
  orderInput.value = session.order || "";
  orderLabel.appendChild(orderInput);

  const actions = document.createElement("div");
  actions.className = "student-actions";

  const addExercise = document.createElement("button");
  addExercise.type = "button";
  addExercise.className = "secondary";
  addExercise.dataset.addSessionExercise = "true";
  addExercise.textContent = "Adicionar exercício";

  const removeSession = document.createElement("button");
  removeSession.type = "button";
  removeSession.className = "secondary";
  removeSession.dataset.removeSession = "true";
  removeSession.textContent = "Remover treino";

  actions.append(addExercise, removeSession);
  head.append(label, orderLabel, actions);

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
      workoutMessage.textContent = "Não encontrei exercícios no texto. Revise o formato e tente novamente.";
      workoutMessage.classList.add("error");
    }
    return;
  }

  resetTrainingSessions(filledSessions);
  if (workoutMessage) {
    workoutMessage.textContent = `${exerciseCount} exercício(s) em ${filledSessions.length} treino(s) organizados. Revise os campos antes de salvar.`;
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
      order: Number(session.querySelector("[data-session-order]")?.value || index + 1),
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
  const value = String(dateText || "").trim();
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const date = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    date.setHours(0, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const match = value.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
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
  return loadCheckins().find((checkin) => checkin.packageId === packageId && checkin.dateKey === lessonDateKey && (checkin.lessonType || "package") === "package");
}

function isConsumedLesson(checkin) {
  if (checkin?.lessonType === "makeup" || checkin?.lessonType === "dropin") return false;
  return checkin?.status === "realizado" || checkin?.status === "aula-dada" || checkin?.consumed === true || checkin?.status === "cancelada-fora-prazo" || checkin?.status === "falta";
}

function getCheckinStatusLabel(checkin) {
  if (checkin?.statusLabel) return checkin.statusLabel;
  if (checkin?.status === "falta") return "Falta - aula contabilizada";
  if (checkin?.status === "aula-dada") return "Aula dada";
  if (checkin?.status === "remarcada-personal") return "Remarcada pelo personal";
  if (checkin?.status === "cancelada-no-prazo") return "Cancelada no prazo";
  if (checkin?.status === "cancelada-fora-prazo") return "Cancelada fora do prazo - aula contabilizada";
  if (checkin?.status === "desmarcada-com-reposicao") return "Desmarcada no prazo - gerou reposição";
  if (checkin?.status === "desmarcada-sem-reposicao") return "Desmarcada fora do prazo - sem reposição";
  return "Realizado";
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
      const daySchedule = classPackage.schedule?.[cursor.getDay()] || {};
      lessons.push({
        packageId: classPackage.id,
        date: cursor.toLocaleDateString("pt-BR"),
        dateKey: getDateKey(cursor),
        time: daySchedule.time || classPackage.time,
        duration: Number(daySchedule.duration) || Number(classPackage.duration) || 60,
        location: daySchedule.location || classPackage.location || "",
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return lessons;
}

function getPackageCheckins(packageId) {
  return loadCheckins().filter((checkin) => checkin.packageId === packageId && isConsumedLesson(checkin));
}

function parseCurrencyValue(value) {
  const digits = onlyDigits(value);
  return digits ? Number(digits) / 100 : 0;
}

function formatCurrencyNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getStudentMakeupCredits(studentName) {
  const credits = loadMakeupCredits();
  let changed = false;
  const refreshed = credits.map((credit) => {
    if (!["used", "rejected", "expired"].includes(credit.status) && isPastBrazilianDate(credit.validUntil)) {
      changed = true;
      return { ...credit, status: "expired", expiredAt: new Date().toISOString() };
    }
    return credit;
  });
  if (changed) saveMakeupCredits(refreshed);
  return refreshed.filter((credit) => credit.studentName === studentName);
}

function getAvailableMakeupCredits(studentName) {
  return getStudentMakeupCredits(studentName).filter((credit) => credit.status === "available");
}

function getApprovedMakeupCredits(studentName) {
  return getStudentMakeupCredits(studentName).filter((credit) => credit.status === "approved");
}

function getMakeupCreditsByStatus(studentName, status) {
  return getStudentMakeupCredits(studentName).filter((credit) => credit.status === status);
}

function getPackageGeneratedMakeupCount(classPackage, studentName = classPackage?.studentName || "") {
  if (!classPackage) return 0;
  return getStudentMakeupCredits(studentName).filter((credit) => credit.packageId === classPackage.id && credit.generated !== false && credit.status !== "rejected").length;
}

function getStudentPackageMakeupLimit(studentName) {
  const student = getStudentByName(studentName);
  return normalizeMakeupLimit(student?.makeupLimit, student?.frequency || "3x");
}

function getPackageMakeupLimit(classPackage, studentName = classPackage?.studentName || "") {
  return Number(classPackage?.makeupLimit) > 0 ? Number(classPackage.makeupLimit) : getStudentPackageMakeupLimit(studentName);
}

function getStudentDropIns(studentName) {
  return loadDropInClasses().filter((item) => item.studentName === studentName);
}

function getPendingDropInValue(studentName) {
  return getStudentDropIns(studentName)
    .filter((item) => item.status === "pendente")
    .reduce((total, item) => total + parseCurrencyValue(item.value), 0);
}

function getLessonBalance(studentName, activePackage = getActivePackage(studentName)) {
  const status = activePackage ? getPackageStatus(activePackage) : { completed: 0, remaining: 0 };
  const dropIns = getStudentDropIns(studentName);
  const makeups = getStudentMakeupCredits(studentName);
  const validities = makeups
    .filter((item) => ["available", "requested", "approved"].includes(item.status) && item.validUntil)
    .map((item) => item.validUntil)
    .join(", ");
  return {
    packageTotal: activePackage?.total || 0,
    completed: status.completed || 0,
    remaining: status.remaining || 0,
    makeupAvailable: getAvailableMakeupCredits(studentName).length,
    makeupRequested: getMakeupCreditsByStatus(studentName, "requested").length,
    makeupApproved: getMakeupCreditsByStatus(studentName, "approved").length,
    makeupUsed: getMakeupCreditsByStatus(studentName, "used").length,
    makeupExpired: getMakeupCreditsByStatus(studentName, "expired").length,
    personalReschedules: getMakeupCreditsByStatus(studentName, "personal-pending").length,
    makeupValidities: validities || "-",
    dropInCount: dropIns.length,
    pendingDropInValue: getPendingDropInValue(studentName),
  };
}

function getMinutesFromTime(timeText) {
  const match = String(timeText || "").match(/(\d{1,2})[:hH](\d{2})?/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function parseFlexibleTimeText(timeText) {
  const value = String(timeText || "").trim();
  if (!value) return { valid: false, empty: true, value: "", minutes: null };

  const normalized = value.replace(/\s+/g, "").toLowerCase();
  let hours = null;
  let minutes = 0;
  const separated = normalized.match(/^(\d{1,2})(?::|h)(\d{0,2})$/);

  if (separated) {
    hours = Number(separated[1]);
    minutes = separated[2] === "" ? 0 : Number(separated[2]);
  } else if (/^\d{1,4}$/.test(normalized)) {
    if (normalized.length <= 2) {
      hours = Number(normalized);
      minutes = 0;
    } else {
      hours = Number(normalized.slice(0, -2));
      minutes = Number(normalized.slice(-2));
    }
  } else {
    return { valid: false, empty: false, value, minutes: null };
  }

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return { valid: false, empty: false, value, minutes: null };
  }

  const totalMinutes = hours * 60 + minutes;
  return { valid: true, empty: false, value: formatMinutesAsTime(totalMinutes), minutes: totalMinutes };
}

function normalizeTimeText(timeText) {
  const parsed = parseFlexibleTimeText(timeText);
  return parsed.valid ? parsed.value : String(timeText || "").trim();
}

function getNoticeDifferenceMinutes(lessonTime, noticeTime) {
  const lessonMinutes = getMinutesFromTime(lessonTime);
  const noticeMinutes = getMinutesFromTime(noticeTime);
  if (lessonMinutes === null || noticeMinutes === null) return null;
  return lessonMinutes - noticeMinutes;
}

function formatMinutesAsTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function getAgendaRange(view = "week", referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  if (view === "day") return { start: ref, end: new Date(ref), days: [new Date(ref)] };
  if (view === "month") {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    const days = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return { start, end, days };
  }
  const start = new Date(ref);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const days = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return { start, end, days };
}

function getAgendaEventsForRange(view = "week", referenceDate = new Date()) {
  const { start, end } = getAgendaRange(view, referenceDate);
  const items = [];
  const storedAgendaEvents = loadAgendaEvents();
  loadClassPackages().forEach((classPackage) => {
    if (classPackage.autoGenerated === true) return;
    generatePackageSchedule(classPackage).forEach((lesson) => {
      const date = lesson.dateKey ? new Date(`${lesson.dateKey}T00:00:00`) : parseBrazilianDate(lesson.date);
      if (!date || date < start || date > end) return;
      const record = getLessonRecord(classPackage.id, lesson.dateKey);
      items.push({
        id: `${classPackage.id}-${lesson.dateKey}`,
        source: "package",
        packageId: classPackage.id,
        studentName: classPackage.studentName,
        date: lesson.date,
        dateKey: lesson.dateKey,
        time: lesson.time || "00:00",
        duration: Number(lesson.duration) || 60,
        modality: classPackage.name,
        location: lesson.location || "Studio Joao Victor",
        status: record ? getCheckinStatusLabel(record) : "confirmada",
      });
    });
  });
  loadStudents().forEach((student) => {
    const schedule = normalizeWeeklySchedule(student.weeklySchedule || {}, student.billingDays);
    const studentStartDate = getStudentStartDate(student);
    const cursor = new Date(start);
    while (cursor <= end) {
      const day = cursor.getDay();
      const item = schedule[day];
      if (item?.time && cursor >= studentStartDate) {
        const dateKey = getDateKey(cursor);
        const duplicated = items.some((event) =>
          event.studentName === student.name
          && event.dateKey === dateKey
          && event.time === item.time
        ) || storedAgendaEvents.some((event) =>
          event.studentName === student.name
          && event.dateKey === dateKey
          && event.time === item.time
          && !String(event.status || "").toLowerCase().includes("cancel")
        );
        if (!duplicated) {
          items.push({
            id: `fixed-${student.id || student.name}-${dateKey}-${item.time}`,
            source: "student-fixed",
            studentName: student.name,
            studentId: student.id || "",
            date: cursor.toLocaleDateString("pt-BR"),
            dateKey,
            time: item.time,
            duration: Number(item.duration) || 60,
            modality: student.modality || student.plan || "Aula fixa",
            location: item.location || "Studio Joao Victor",
            status: "confirmada",
          });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  storedAgendaEvents.forEach((event) => {
    const date = event.dateKey ? new Date(`${event.dateKey}T00:00:00`) : parseBrazilianDate(event.date);
    if (date && date >= start && date <= end) items.push(event);
  });
  return items.sort((a, b) => (a.dateKey || "").localeCompare(b.dateKey || "") || (getMinutesFromTime(a.time) ?? 0) - (getMinutesFromTime(b.time) ?? 0));
}

function hasAgendaConflict(dateText, timeText, duration = 60, ignoreId = "") {
  const date = parseBrazilianDate(dateText);
  const dateKey = date ? getDateKey(date) : "";
  const start = getMinutesFromTime(timeText);
  if (!dateKey || start === null) return false;
  const end = start + (Number(duration) || 60);
  return getAgendaEventsForRange("day", date).some((event) => {
    if (ignoreId && event.id === ignoreId) return false;
    if (event.dateKey !== dateKey || String(event.status || "").toLowerCase().includes("cancel")) return false;
    const eventStart = getMinutesFromTime(event.time);
    if (eventStart === null) return false;
    const eventEnd = eventStart + (Number(event.duration) || 60);
    return start < eventEnd && end > eventStart;
  });
}

function fillAgendaStudentSelects() {
  const students = loadStudents();
  [agendaMakeupStudent, agendaDropinStudent].forEach((select) => {
    if (!select) return;
    const previous = select.value;
    select.replaceChildren();
    students.forEach((student) => {
      const option = document.createElement("option");
      option.value = student.name;
      option.textContent = student.name;
      select.appendChild(option);
    });
    select.value = students.some((student) => student.name === previous) ? previous : students[0]?.name || "";
  });
  refreshSearchableStudentSelects();
}

function fillAgendaCancelSelect() {
  if (!agendaCancelEvent) return;
  const events = getAgendaEventsForRange(adminAgendaView?.value || "week", parseBrazilianDate(adminAgendaDate?.value || "") || new Date())
    .filter((event) => !String(event.status || "").toLowerCase().includes("cancel"));
  const previous = agendaCancelEvent.value;
  agendaCancelEvent.replaceChildren();
  events.forEach((event) => {
    const option = document.createElement("option");
    option.value = event.id;
    option.textContent = `${event.date} ${event.time} | ${event.studentName || "Aluno"} | ${event.modality}`;
    agendaCancelEvent.appendChild(option);
  });
  agendaCancelEvent.value = events.some((event) => event.id === previous) ? previous : events[0]?.id || "";
}

function renderAdminAgenda() {
  if (!adminAgendaGrid) return;
  if (adminAgendaDate && !adminAgendaDate.value) adminAgendaDate.value = formatToday();
  fillAgendaStudentSelects();
  const view = adminAgendaView?.value || "week";
  const referenceDate = parseBrazilianDate(adminAgendaDate?.value || "") || new Date();
  const { days } = getAgendaRange(view, referenceDate);
  const events = getAgendaEventsForRange(view, referenceDate);
  console.info("Auditoria agenda renderizada.", {
    view,
    referenceDate: referenceDate.toLocaleDateString("pt-BR"),
    storedEvents: loadAgendaEvents().length,
    eventsInRange: events.length,
    rangeStart: days[0] ? getDateKey(days[0]) : "",
    rangeEnd: days[days.length - 1] ? getDateKey(days[days.length - 1]) : "",
  });
  adminAgendaGrid.innerHTML = "";
  adminAgendaGrid.className = `agenda-grid-panel agenda-view-${view}`;

  const hours = [];
  for (let minutes = 5 * 60; minutes <= 22 * 60; minutes += 30) hours.push(minutes);

  days.forEach((day) => {
    const dayKey = getDateKey(day);
    const column = document.createElement("section");
    column.className = "agenda-day-column";
    const title = document.createElement("h3");
    title.textContent = `${getWeekdayName(day.getDay())} ${day.toLocaleDateString("pt-BR")}`;
    column.appendChild(title);
    const dayEvents = events.filter((event) => event.dateKey === dayKey);
    const renderedEventIds = new Set();
    hours.forEach((minutes) => {
      const slotEvents = dayEvents.filter((event) => {
        const eventMinutes = getMinutesFromTime(event.time);
        return eventMinutes !== null && eventMinutes >= minutes && eventMinutes < minutes + 30;
      });
      if (slotEvents.length) {
        slotEvents.forEach((event) => {
          renderedEventIds.add(event.id);
          const card = document.createElement("article");
          card.className = `agenda-event-card status-${String(event.status || "confirmada").toLowerCase().replace(/\s+/g, "-")}`;
          card.innerHTML = `<strong>${event.time} | ${event.studentName || "Aluno"}</strong><span>${event.modality || "Aula"} ${event.location ? `| ${event.location}` : ""}</span><small>${event.status || "confirmada"}</small>`;
          column.appendChild(card);
        });
      } else if (view !== "month") {
        const free = document.createElement("div");
        free.className = "agenda-free-slot";
        free.textContent = `${formatMinutesAsTime(minutes)} livre`;
        column.appendChild(free);
      }
    });
    dayEvents
      .filter((event) => !renderedEventIds.has(event.id))
      .forEach((event) => {
        const card = document.createElement("article");
        card.className = `agenda-event-card status-${String(event.status || "confirmada").toLowerCase().replace(/\s+/g, "-")}`;
        card.innerHTML = `<strong>${event.time || "Horário pendente"} | ${event.studentName || "Aluno"}</strong><span>${event.modality || "Aula"} ${event.location ? `| ${event.location}` : ""}</span><small>${event.status || "confirmada"}</small>`;
        column.appendChild(card);
      });
    if (view === "month" && !dayEvents.length) {
      const free = document.createElement("div");
      free.className = "agenda-free-slot";
      free.textContent = "Sem aulas";
      column.appendChild(free);
    }
    adminAgendaGrid.appendChild(column);
  });
  fillAgendaCancelSelect();
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

function createCheckin(studentName, type = "check-in do aluno", classPackage = null, markedBy = "aluno", extras = {}) {
  return {
    id: createId(),
    studentName,
    studentId: getStudentIdByName(studentName),
    packageId: classPackage?.id || "",
    packageName: classPackage?.name || "",
    lessonType: extras.lessonType || "package",
    value: extras.value || "",
    note: extras.note || "",
    dropInId: extras.dropInId || "",
    makeupCreditId: extras.makeupCreditId || "",
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

function createScheduledLessonRecord(studentName, classPackage, lesson, extras = {}) {
  return {
    id: createId(),
    studentName,
    studentId: getStudentIdByName(studentName),
    packageId: classPackage?.id || "",
    packageName: classPackage?.name || "",
    lessonType: "package",
    date: lesson.date,
    dateKey: lesson.dateKey,
    time: lesson.time,
    type: extras.type || "aula dada automatica",
    status: extras.status || "aula-dada",
    statusLabel: extras.statusLabel || "Aula dada",
    consumed: extras.consumed !== false,
    generatedMakeup: false,
    reason: extras.reason || "",
    note: extras.note || "",
    markedBy: extras.markedBy || "sistema",
    month: lesson.dateKey ? lesson.dateKey.slice(0, 7) : currentMonthKey(),
    timestamp: Date.now(),
    ...extras,
  };
}

function processAutomaticPastLessons() {
  if (isProcessingAutomaticLessons) return false;
  isProcessingAutomaticLessons = true;

  try {
    const now = Date.now();
    const checkins = loadCheckins();
    let changed = false;

    loadClassPackages().forEach((classPackage) => {
      const schedule = generatePackageSchedule(classPackage);
      let consumed = checkins.filter((checkin) => checkin.packageId === classPackage.id && isConsumedLesson(checkin)).length;
      const total = Number(classPackage.total) || 0;

      schedule.forEach((lesson) => {
        if (consumed >= total) return;
        if (getLessonRecord(classPackage.id, lesson.dateKey)) return;
        const lessonDate = parseLessonDateTime(lesson.dateKey, lesson.time);
        if (!lessonDate || lessonDate.getTime() >= now) return;

        checkins.push(createScheduledLessonRecord(classPackage.studentName, classPackage, lesson, {
          type: "aula dada automatica",
          status: "aula-dada",
          statusLabel: "Aula dada",
          consumed: true,
          reason: "Aula agendada passou do horário sem cancelamento no prazo.",
          markedBy: "sistema",
        }));
        consumed += 1;
        changed = true;
      });
    });

    if (changed) {
      saveCheckins(checkins);
      renderAdminAlertBadge();
    }
    return changed;
  } finally {
    isProcessingAutomaticLessons = false;
  }
}

function getTodayStudentCheckin(studentName, packageId = "") {
  const today = getDateKey();
  const todayText = formatToday();
  return loadCheckins().find(
    (checkin) =>
      checkin.studentName === studentName &&
      (checkin.dateKey === today || (!checkin.dateKey && checkin.date === todayText)) &&
      (!packageId || (checkin.packageId === packageId && (checkin.lessonType || "package") === "package")),
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

function registerFlexibleLessonCheckin(studentName, lessonType = "package", classPackage = null, markedBy = "personal", options = {}) {
  if (!studentName) return { ok: false, message: "Selecione um aluno." };

  if (lessonType === "makeup") {
    const credits = loadMakeupCredits();
    const creditIndex = credits.findIndex((credit) => credit.studentName === studentName && credit.status === "approved");
    if (creditIndex < 0) return { ok: false, message: "Aluno sem reposição aprovada disponível." };
    credits[creditIndex] = {
      ...credits[creditIndex],
      status: "used",
      usedAt: new Date().toISOString(),
      replacementDate: formatToday(),
      replacementTime: formatCurrentTime(),
    };
    saveMakeupCredits(credits);

    const checkins = loadCheckins();
    checkins.push(createCheckin(studentName, "aula de reposicao", classPackage, markedBy, {
      lessonType: "makeup",
      makeupCreditId: credits[creditIndex].id,
      note: options.note || "Reposição utilizada",
    }));
    saveCheckins(checkins);
    return { ok: true, message: "Reposição usada sem consumir pacote." };
  }

  if (lessonType === "dropin") {
    const dropIn = {
      id: createId(),
      studentName,
      studentId: getStudentIdByName(studentName),
      date: formatToday(),
      modality: options.modality || "Aula avulsa",
      value: options.value || "",
      status: options.status || "pendente",
      note: options.note || "Lancada pelo check-in",
      timestamp: Date.now(),
      createdAt: Date.now(),
    };
    const dropIns = loadDropInClasses();
    dropIns.push(dropIn);
    saveDropInClasses(dropIns);

    const checkins = loadCheckins();
    checkins.push(createCheckin(studentName, "aula avulsa", classPackage, markedBy, {
      lessonType: "dropin",
      value: dropIn.value,
      note: dropIn.note,
      dropInId: dropIn.id,
    }));
    saveCheckins(checkins);
    return { ok: true, message: "Aula avulsa registrada sem consumir pacote." };
  }

  return registerPackageCheckin(studentName, classPackage, markedBy)
    ? { ok: true, message: "Aula do pacote registrada." }
    : { ok: false, message: "Presença não registrada: pacote finalizado ou aula de hoje já possui registro." };
}

function registerLessonCancellation(studentName, classPackage, lesson) {
  if (!studentName || !classPackage || !lesson) return { ok: false, message: "Nao foi possivel cancelar esta aula." };
  if (getLessonRecord(classPackage.id, lesson.dateKey)) return { ok: false, message: "Esta aula ja possui registro." };

  const cancellation = getCancellationStatus(lesson);
  const status = getPackageStatus(classPackage);
  if (cancellation.consumed && status.remaining <= 0) return { ok: false, message: "Pacote sem saldo para contabilizar cancelamento." };
  const generated = cancellation.status === "cancelada-no-prazo";
  const validUntil = generated ? addDaysToBrazilianDate(lesson.date, 10) : "";
  const checkinId = createId();

  const checkins = loadCheckins();
  checkins.push({
    id: checkinId,
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
    generatedMakeup: generated,
    makeupValidUntil: validUntil,
    reason: generated ? "Cancelamento dentro do prazo. Reposição gerada." : "Fora do prazo mínimo de 2 horas.",
    markedBy: "aluno",
    cancellationDate: formatToday(),
    cancellationTime: formatCurrentTime(),
    month: currentMonthKey(),
    timestamp: Date.now(),
  });
  saveCheckins(checkins);

  let credit = null;
  if (generated) {
    credit = {
      id: createId(),
      studentName,
      studentId: getStudentIdByName(studentName),
      packageId: classPackage.id,
      packageName: classPackage.name,
      sourceLessonDate: lesson.date,
      lessonTime: lesson.time,
      noticeDate: formatToday(),
      noticeTime: formatCurrentTime(),
      validUntil,
      status: "available",
      generated: true,
      reason: "Cancelamento do aluno dentro do prazo.",
      sourceCheckinId: checkinId,
      note: "",
      timestamp: Date.now(),
      createdAt: Date.now(),
    };
    const credits = loadMakeupCredits();
    credits.push(credit);
    saveMakeupCredits(credits);
  }

  return {
    ok: true,
    generated,
    credit,
    message: generated
      ? "Cancelamento realizado. Você tem direito a uma reposição."
      : "Cancelamento realizado, mas sem direito a reposição por estar fora do prazo mínimo de 2 horas.",
  };
}

function registerStudentRescheduleNotice({ studentName, classPackage, date, lessonTime, noticeTime, note = "" }) {
  if (!studentName || !date || !lessonTime || !noticeTime) {
    return { ok: false, message: "Preencha aluno, data, horário da aula e horário do aviso." };
  }

  const difference = getNoticeDifferenceMinutes(lessonTime, noticeTime);
  if (difference === null) return { ok: false, message: "Confira os horários informados." };

  const inTime = difference > 120;
  const packageId = classPackage?.id || "";
  const packageName = classPackage?.name || "";
  const dateKey = parseBrazilianDate(date) ? getDateKey(parseBrazilianDate(date)) : "";
  if (packageId && dateKey && getLessonRecord(packageId, dateKey)) {
    return { ok: false, message: "Esta aula já possui registro." };
  }
  const noticeDate = formatToday();
  const limit = getPackageMakeupLimit(classPackage, studentName);
  const alreadyGenerated = classPackage
    ? getPackageGeneratedMakeupCount(classPackage, studentName)
    : getStudentMakeupCredits(studentName).filter((credit) => credit.generated !== false && credit.status !== "rejected").length;
  const limitReached = inTime && alreadyGenerated >= limit;
  const generated = inTime && !limitReached;
  const validUntil = generated ? addDaysToBrazilianDate(date, 10) : "";
  const reason = generated
    ? "Reposição gerada dentro do prazo."
    : limitReached
      ? "Limite de reposições do pacote atingido."
      : "Aviso com 2 horas ou menos de antecedência.";
  const status = generated ? "desmarcada-com-reposicao" : "desmarcada-sem-reposicao";

  const checkins = loadCheckins();
  const checkinId = createId();
  checkins.push({
    id: checkinId,
    studentName,
    studentId: getStudentIdByName(studentName),
    packageId,
    packageName,
    lessonType: "package",
    date,
    dateKey,
    time: lessonTime,
    type: "aluno desmarcou",
    status,
    statusLabel: generated ? "Desmarcada no prazo - gerou reposição" : "Desmarcada sem direito a reposição",
    cancellationDate: noticeDate,
    cancellationTime: noticeTime,
    noticeDate,
    noticeTime,
    leadMinutes: difference,
    generatedMakeup: generated,
    makeupValidUntil: validUntil,
    reason,
    consumed: !generated,
    note,
    markedBy: "personal",
    month: currentMonthKey(),
    timestamp: Date.now(),
  });
  saveCheckins(checkins);

  if (generated) {
    const credits = loadMakeupCredits();
    credits.push({
      id: createId(),
      studentName,
      studentId: getStudentIdByName(studentName),
      packageId,
      packageName,
      sourceLessonDate: date,
      lessonTime,
      noticeDate,
      noticeTime,
      leadMinutes: difference,
      validUntil,
      status: "available",
      generated: true,
      reason,
      sourceCheckinId: checkinId,
      note,
      timestamp: Date.now(),
      createdAt: Date.now(),
    });
    saveMakeupCredits(credits);
  }

  return {
    ok: true,
    generated,
    message: generated ? `Reposição disponível até ${validUntil}.` : reason,
  };
}

function registerPersonalLessonReschedule({ studentName, classPackage, date, lessonTime, reason = "" }) {
  if (!studentName || !date || !lessonTime) {
    return { ok: false, message: "Preencha aluno, data e horário original da aula." };
  }

  const packageId = classPackage?.id || "";
  const packageName = classPackage?.name || "";
  const lessonDate = parseBrazilianDate(date);
  const dateKey = lessonDate ? getDateKey(lessonDate) : "";
  if (packageId && dateKey && getLessonRecord(packageId, dateKey)) {
    return { ok: false, message: "Esta aula já possui registro." };
  }

  const checkinId = createId();
  const checkins = loadCheckins();
  checkins.push({
    id: checkinId,
    studentName,
    studentId: getStudentIdByName(studentName),
    packageId,
    packageName,
    lessonType: "package",
    date,
    dateKey,
    time: lessonTime,
    type: "remarcação pelo personal",
    status: "remarcada-personal",
    statusLabel: "Remarcada pelo personal",
    consumed: false,
    generatedMakeup: false,
    reason: reason || "Remarcação solicitada pelo personal.",
    markedBy: "personal",
    cancellationDate: formatToday(),
    cancellationTime: formatCurrentTime(),
    month: currentMonthKey(),
    timestamp: Date.now(),
  });
  saveCheckins(checkins);

  const credit = {
    id: createId(),
    studentName,
    studentId: getStudentIdByName(studentName),
    packageId,
    packageName,
    sourceLessonDate: date,
    lessonTime,
    noticeDate: formatToday(),
    noticeTime: formatCurrentTime(),
    validUntil: "",
    status: "personal-pending",
    generated: false,
    source: "personal",
    reason: reason || "Aula remarcada pelo personal.",
    sourceCheckinId: checkinId,
    note: reason,
    timestamp: Date.now(),
    createdAt: Date.now(),
  };
  const credits = loadMakeupCredits();
  credits.push(credit);
  saveMakeupCredits(credits);

  return { ok: true, credit, message: "Remarcação registrada. Esta aula não será descontada do pacote." };
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
    document.querySelector("#student-top-summary")?.remove();
    workoutSummary.textContent = "Selecione um aluno para visualizar a ficha.";
    currentWorkout.textContent = "Cadastre um aluno para visualizar treinos.";
    return;
  }

  if (currentUserType === "student" && isPaymentBlocked(student)) {
    renderStudentTopSummary(selectedStudent);
    renderPaymentBlockedWorkout(student);
    return;
  }

  if (!studentWorkouts.length) {
    renderStudentTopSummary(selectedStudent);
    workoutSummary.textContent = "Nenhuma ficha salva para este aluno ainda.";
    currentWorkout.textContent = "Nenhuma ficha salva para este aluno ainda.";
    return;
  }

  if (!availableWorkouts.length) {
    renderStudentTopSummary(selectedStudent);
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
  summaryKicker.textContent = selectedStudent;

  const summaryTitle = document.createElement("strong");
  summaryTitle.textContent = workout.title;

  const summarySubtitle = document.createElement("small");
  summarySubtitle.textContent = `Ficha de treino | ${workout.startDate || "inicio nao informado"} a ${workout.dueDate || "validade nao informada"}`;

  summaryHeader.append(summaryKicker, summaryTitle, summarySubtitle);

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
  frequencyLabel.textContent = "Frequência";
  const frequencyText = document.createElement("small");
  frequencyText.textContent = workout.frequency;
  frequency.append(frequencyLabel, frequencyText);

  const startDate = document.createElement("span");
  const startDateLabel = document.createElement("strong");
  startDateLabel.textContent = "Início";
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

  [goal, frequency, startDate, dueDate, expirationCard, notes].forEach((item) => item.classList.add("workout-meta-card"));
  meta.append(goal, frequency, startDate, dueDate, expirationCard, notes);
  workoutSummary.append(summaryHeader, meta);

  const list = document.createElement("div");
  list.className = "student-exercise-list";

  const sessionTabs = document.createElement("div");
  sessionTabs.className = "workout-tabs training-tabs";
  const sessions = getOrderedWorkoutSessions(workout);
  const recommendedSessionId = getRecommendedSessionId(selectedStudent, workout, sessions);
  const activeSessionId = activeSessionByWorkout[workout.id] || recommendedSessionId || sessions[0]?.id;
  const activeSession = sessions.find((session) => session.id === activeSessionId) || sessions[0];
  activeSessionByWorkout[workout.id] = activeSession?.id;
  renderStudentTopSummary(selectedStudent, workout, activeSession);

  sessions.forEach((session) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.sessionTab = session.id;
    button.className = session.id === activeSession?.id ? "active" : "";
    if (session.id === recommendedSessionId) button.classList.add("recommended-workout-tab");
    button.textContent = session.id === recommendedSessionId ? `${session.title} - Treino recomendado` : session.title;
    sessionTabs.appendChild(button);
  });

  if (activeSession) {
    const recommendation = document.createElement("div");
    recommendation.className = "recommended-workout-banner";
    recommendation.innerHTML = `<strong>Treino de hoje</strong><span>${activeSession.id === recommendedSessionId ? activeSession.title : `${activeSession.title} selecionado manualmente`}</span>`;
    currentWorkout.appendChild(recommendation);

    if (currentUserType === "student" && !hasCompletedSessionToday(selectedStudent, workout.id, activeSession.id)) {
      const finishNotice = document.createElement("div");
      finishNotice.className = "finish-workout-notice";
      finishNotice.textContent = "Finalize o treino atual para liberar o próximo treino recomendado.";
      currentWorkout.appendChild(finishNotice);
    }
  }

  currentWorkout.appendChild(sessionTabs);

  const visibleEntries = getWorkoutExerciseEntries({ ...workout, sessions })
    .filter((entry) => entry.session.id === activeSession?.id)
  if (!visibleEntries.length) {
    list.textContent = "Nenhum exercício cadastrado neste treino.";
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
    title.className = "exercise-title-block";
    const name = document.createElement("strong");
    name.textContent = normalizedExercise.name;
    const details = document.createElement("small");
    details.textContent = `${normalizedExercise.sets || "-"} séries | ${normalizedExercise.reps || "-"} reps | descanso ${normalizedExercise.rest || "-"}`;
    title.append(name, details);
    const prescriptionGrid = document.createElement("div");
    prescriptionGrid.className = "exercise-prescription-grid";
    [
      ["Series", normalizedExercise.sets || "-"],
      ["Reps", normalizedExercise.reps || "-"],
      ["Carga", normalizedExercise.currentLoad || normalizedExercise.weight || "-"],
      ["Descanso", normalizedExercise.rest || "-"],
    ].forEach(([label, value]) => {
      const chip = document.createElement("span");
      chip.className = "exercise-prescription-chip";
      const chipLabel = document.createElement("small");
      chipLabel.textContent = label;
      const chipValue = document.createElement("strong");
      chipValue.textContent = value;
      chip.append(chipLabel, chipValue);
      prescriptionGrid.appendChild(chip);
    });
    title.appendChild(prescriptionGrid);
    header.append(title, createProgressBadge(progress));

    const form = document.createElement("div");
    form.className = "load-entry-form";
    form.dataset.studentName = selectedStudent;
    form.dataset.workoutId = workout.id;
    form.dataset.workoutTitle = workout.title;
    form.dataset.sessionId = activeSession?.id || "";
    form.dataset.sessionTitle = activeSession?.title || "";
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
    last.textContent = lastRecord ? `Última carga: ${lastRecord.load} em ${lastRecord.date}` : "Nenhuma carga registrada ainda.";

    card.append(header, form, last);
    list.appendChild(card);
  });

  currentWorkout.append(list);
  currentWorkout.appendChild(createWorkoutFeedbackPanel(selectedStudent, workout, activeSession));
  renderStudentLoadEvolution();
  renderAdminLoadEvolution();
}

function getOrderedWorkoutSessions(workout) {
  const sessions = workout?.sessions?.length ? workout.sessions : [{ id: createId(), title: "Treino principal", order: 1, exercises: [] }];
  return [...sessions].sort((a, b) => (Number(a.order || 999) - Number(b.order || 999)) || String(a.title || "").localeCompare(String(b.title || "")));
}

function getRecommendedSessionId(studentName, workout, sessions = getOrderedWorkoutSessions(workout)) {
  if (!studentName || !workout?.id || !sessions.length) return sessions[0]?.id || "";
  const completed = loadWorkoutFeedbacks()
    .filter((feedback) => feedback.studentName === studentName && feedback.workoutId === workout.id && feedback.sessionId)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const lastSessionId = completed[0]?.sessionId;
  if (!lastSessionId) return sessions[0]?.id || "";
  const currentIndex = sessions.findIndex((session) => session.id === lastSessionId);
  if (currentIndex < 0) return sessions[0]?.id || "";
  return sessions[(currentIndex + 1) % sessions.length]?.id || sessions[0]?.id || "";
}

function getNextSessionIdAfterCompletion(workout, sessionId) {
  const sessions = getOrderedWorkoutSessions(workout);
  const currentIndex = sessions.findIndex((session) => session.id === sessionId);
  if (currentIndex < 0) return sessions[0]?.id || "";
  return sessions[(currentIndex + 1) % sessions.length]?.id || sessions[0]?.id || "";
}

function createWorkoutFeedbackPanel(studentName, workout, session = null) {
  const panel = document.createElement("section");
  panel.className = "workout-feedback-panel";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "primary";
  toggle.textContent = "Concluir treino";

  const form = document.createElement("form");
  form.className = "workout-feedback-form workout-feedback-card";
  form.hidden = true;
  form.dataset.studentName = studentName;
  form.dataset.workoutId = workout.id;
  form.dataset.workoutTitle = workout.title;
  form.dataset.sessionId = session?.id || "";
  form.dataset.sessionTitle = session?.title || "";

  const title = document.createElement("div");
  title.className = "workout-feedback-head";
  title.innerHTML = `
    <p class="eyebrow">Feedback</p>
    <h3>Como foi seu treino hoje?</h3>
    <small>Seu feedback ajuda o personal a ajustar melhor seus proximos treinos.</small>
  `;

  const ratingBlock = document.createElement("div");
  ratingBlock.className = "feedback-block";
  const ratingTitle = document.createElement("strong");
  ratingTitle.textContent = "Nota do treino";

  const rating = document.createElement("div");
  rating.className = "feedback-rating";
  [1, 2, 3, 4, 5].forEach((value) => {
    const label = document.createElement("label");
    label.className = "feedback-star";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "rating";
    input.value = String(value);
    input.required = true;
    label.append(input, document.createTextNode(`★ ${value}`));
    rating.appendChild(label);
  });

  ratingBlock.append(ratingTitle, rating);

  const difficulty = document.createElement("div");
  difficulty.className = "feedback-choice-row";
  ["Muito facil", "Na medida", "Muito pesado"].forEach((value) => {
    const label = document.createElement("label");
    label.className = "feedback-chip";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "difficulty";
    input.value = value;
    label.append(input, document.createTextNode(value));
    difficulty.appendChild(label);
  });
  ratingBlock.appendChild(difficulty);

  const painBlock = document.createElement("div");
  painBlock.className = "feedback-block";
  const painTitle = document.createElement("strong");
  painTitle.textContent = "Dor ou desconforto";
  const pain = document.createElement("div");
  pain.className = "feedback-pain";
  pain.innerHTML = `
    <label class="feedback-chip"><input type="radio" name="pain" value="nao" checked> Não senti dor</label>
    <label class="feedback-chip"><input type="radio" name="pain" value="sim"> Senti dor</label>
  `;

  const painLocation = document.createElement("label");
  painLocation.className = "feedback-pain-location";
  painLocation.hidden = true;
  painLocation.textContent = "Onde sentiu dor ou desconforto?";
  const painInput = document.createElement("input");
  painInput.name = "painLocation";
  painInput.placeholder = "Ex: ombro, joelho, lombar";
  painLocation.appendChild(painInput);
  painBlock.append(painTitle, pain, painLocation);

  const note = document.createElement("label");
  note.className = "feedback-block";
  const noteTitle = document.createElement("strong");
  noteTitle.textContent = "Observacao rapida";
  const textarea = document.createElement("textarea");
  textarea.name = "note";
  textarea.placeholder = "Ex: supino ficou leve, senti dor no joelho, consegui aumentar carga...";
  note.append(noteTitle, textarea);

  const actions = document.createElement("div");
  actions.className = "feedback-actions";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "primary";
  submit.textContent = "Salvar feedback e concluir treino";

  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "secondary";
  skip.dataset.skipFeedback = "true";
  skip.textContent = "Pular feedback";

  actions.append(submit, skip);

  pain.addEventListener("change", () => {
    const hasPain = pain.querySelector('[name="pain"]:checked')?.value === "sim";
    painLocation.hidden = !hasPain;
    if (!hasPain) painInput.value = "";
  });

  toggle.addEventListener("click", () => {
    form.hidden = false;
    toggle.hidden = true;
  });

  form.append(title, ratingBlock, painBlock, note, actions);
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
    container.textContent = "Selecione um aluno para visualizar a evolução.";
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
    studentLoadChartTitle.textContent = "Evolução";
    studentLoadChartSubtitle.textContent = "Selecione um aluno para visualizar.";
    return;
  }

  if (!groups.length) {
    studentLoadChartTitle.textContent = "Sem registros";
    studentLoadChartSubtitle.textContent = "Salve uma carga dentro do treino para gerar o gráfico.";
    const option = document.createElement("option");
    option.textContent = "Nenhum exercício registrado";
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
  renderLoadChart(studentLoadChart, group.records, studentLoadChartMode?.value || "last10");
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
    option.textContent = "Nenhum exercício";
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
    renderLoadChart(adminEvolutionChart, group.records, adminEvolutionChartMode?.value || "last10");
  }

  renderPersonalRecords(studentName, activeKey);
  renderAdherenceSummary();
  renderAdminFeedbacks();
}

function getFeedbackDate(feedback) {
  return parseDateLike(feedback.date) || new Date(feedback.timestamp || 0);
}

function isFeedbackDifficultyHigh(feedback) {
  const text = String(feedback?.difficulty || "").toLowerCase();
  const rating = Number(feedback?.rating || 0);
  return text.includes("pesado") || text.includes("dificil") || text.includes("difícil") || rating > 0 && rating <= 3;
}

function getWorkoutFrequencyTarget(student, days = 7) {
  const source = `${student?.frequency || ""} ${student?.plan || ""}`;
  const match = source.match(/(\d+)\s*x/i);
  const weekly = match ? Number(match[1]) : 3;
  return Math.max(1, Math.round((weekly || 3) * (days / 7)));
}

function getStudentWorkoutAnalytics(student) {
  if (!student?.name) {
    return {
      feedbacks: [],
      progress: [],
      lastFeedback: null,
      lastDate: null,
      daysSinceLast: null,
      completed7: 0,
      completed30: 0,
      unfinished: 0,
      adherence: 0,
      risk: "alto",
      workoutStatus: { label: "Sem ficha", state: "missing", days: null },
      paymentStatus: "Sem status",
      planStatus: "Sem vencimento",
      hasPain: false,
      hasDifficulty: false,
      hasNote: false,
    };
  }

  const now = new Date();
  const since7 = new Date(now);
  since7.setDate(now.getDate() - 7);
  const since30 = new Date(now);
  since30.setDate(now.getDate() - 30);

  const feedbacks = loadWorkoutFeedbacks()
    .filter((feedback) => feedback.studentName === student.name)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const progress = loadProgressRecords()
    .filter((record) => record.studentName === student.name)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const completedKeys = new Set(feedbacks.map((feedback) => `${feedback.workoutId || feedback.workoutTitle || ""}|${feedback.date || ""}`));
  const startedKeys = new Set(progress.map((record) => `${record.workoutId || record.workoutTitle || ""}|${record.date || ""}`));
  const unfinished = [...startedKeys].filter((key) => !completedKeys.has(key)).length;
  const feedbacks7 = feedbacks.filter((feedback) => {
    const date = getFeedbackDate(feedback);
    return date && !Number.isNaN(date.getTime()) && date >= since7;
  });
  const feedbacks30 = feedbacks.filter((feedback) => {
    const date = getFeedbackDate(feedback);
    return date && !Number.isNaN(date.getTime()) && date >= since30;
  });
  const lastFeedback = feedbacks[0] || null;
  const lastDate = lastFeedback ? getFeedbackDate(lastFeedback) : null;
  const daysSinceLast = lastDate && !Number.isNaN(lastDate.getTime()) ? getDaysSince(lastDate) : null;
  const monthlyTarget = getWorkoutFrequencyTarget(student, 30);
  const weeklyTarget = getWorkoutFrequencyTarget(student, 7);
  const adherence = monthlyTarget ? Math.min(100, Math.round((feedbacks30.length / monthlyTarget) * 100)) : 0;
  const activeWorkout = getCurrentWorkoutForStudent(student.name);
  const workoutStatus = activeWorkout ? getWorkoutPeriodStatus(activeWorkout) : { label: "Sem ficha", state: "missing", days: null };
  const hasPain = feedbacks.some((feedback) => feedback.pain);
  const hasDifficulty = feedbacks.some(isFeedbackDifficultyHigh);
  const hasNote = feedbacks.some((feedback) => String(feedback.note || "").trim());
  const risk = daysSinceLast === null || daysSinceLast >= 7 || unfinished >= 3 || adherence < 40
    ? "alto"
    : daysSinceLast >= 4 || adherence < 70 || feedbacks7.length < Math.max(1, Math.floor(weeklyTarget / 2))
      ? "médio"
      : "baixo";

  return {
    feedbacks,
    progress,
    lastFeedback,
    lastDate,
    daysSinceLast,
    completed7: feedbacks7.length,
    completed30: feedbacks30.length,
    unfinished,
    adherence,
    risk,
    workoutStatus,
    paymentStatus: student.payment || "Sem status",
    planStatus: student.due || "Sem vencimento",
    hasPain,
    hasDifficulty,
    hasNote,
  };
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
    adminPersonalRecords.textContent = "Selecione um aluno e um exercício para visualizar recordes.";
    return;
  }

  const group = groupProgressByExercise(studentName)[exerciseKey];
  if (!group) {
    adminPersonalRecords.textContent = "Nenhum registro para este exercício.";
    return;
  }

  const numericRecords = group.records
    .map((record) => ({ record, value: parseLoad(record.load) }))
    .filter((item) => item.value !== null);

  const executedRecords = numericRecords.filter((item) => !item.record.prescribed);
  const recordPool = executedRecords.length ? executedRecords : numericRecords;
  if (!recordPool.length) {
    adminPersonalRecords.textContent = "Nenhuma carga numérica registrada para este exercício.";
    return;
  }

  const best = recordPool.reduce((winner, item) => (item.value > winner.value ? item : winner), recordPool[0]);
  const feedback = getFeedbackForLoadRecord(studentName, best.record);
  const history = [...recordPool]
    .sort((a, b) => (b.record.timestamp || 0) - (a.record.timestamp || 0))
    .slice(0, 5);
  const current = history[0] || best;
  const previous = history[1] || null;
  const evolutionKg = previous ? current.value - previous.value : 0;

  const card = document.createElement("article");
  card.className = "personal-record-card";

  const title = document.createElement("div");
  title.className = "load-history-head";
  title.innerHTML = `<div><strong>${group.exerciseName}</strong><small>${studentName}</small></div><span class="status-ok">Progressão</span>`;

  const metrics = document.createElement("div");
  metrics.className = "record-metrics-grid";
  [
    ["Maior carga registrada", `${best.value.toLocaleString("pt-BR")} kg`],
    ["Carga anterior", previous ? `${previous.value.toLocaleString("pt-BR")} kg` : "-"],
    ["Evolução recente", `${evolutionKg > 0 ? "+" : ""}${evolutionKg.toLocaleString("pt-BR")} kg`],
    ["Data do recorde", best.record.date || "-"],
    ["Treino", best.record.workoutTitle || group.workoutTitle || "-"],
    ["Series e repeticoes", `${best.record.sets || "-"} x ${best.record.reps || "-"}`],
  ].forEach(([label, value]) => {
    metrics.appendChild(createAdminMetric(label, value));
  });

  const note = document.createElement("div");
  note.className = "record-feedback-note";
  note.innerHTML = `<strong>Observação/feedback</strong><span>${feedback?.note || feedback?.painLocation || best.record.note || "Nenhuma observação vinculada a este recorde."}</span>`;

  const historyTitle = document.createElement("strong");
  historyTitle.textContent = "Últimos registros deste exercício";
  const historyList = document.createElement("div");
  historyList.className = "record-history-list";
  history.forEach(({ record }) => {
    const item = document.createElement("div");
    item.className = "evolution-mini-row";
    item.innerHTML = `<strong>${record.date}</strong><span>${record.load} | ${record.sets || "-"} séries | ${record.reps || "-"} reps</span>`;
    historyList.appendChild(item);
  });

  card.append(title, metrics, note, historyTitle, historyList);
  adminPersonalRecords.appendChild(card);
}

function renderAdherenceSummary() {
  if (!adminAdherenceSummary) return;
  adminAdherenceSummary.innerHTML = "";

  const students = loadStudents();
  if (!students.length) {
    adminAdherenceSummary.textContent = "Nenhum aluno cadastrado.";
    return;
  }

  students.forEach((student) => {
    const data = getStudentWorkoutAnalytics(student);
    const checkins = loadCheckins().filter((item) => item.studentName === student.name && isConsumedLesson(item));
    const card = document.createElement("article");
    card.className = `feedback-card adherence-card risk-${data.risk}`;
    const riskLabel = data.risk === "alto" ? "Risco alto" : data.risk === "médio" ? "Risco médio" : "Risco baixo";
    card.innerHTML = `
      <strong>${student.name}</strong>
      <span>Último treino: ${data.lastFeedback?.workoutTitle || "sem treino finalizado"} | ${data.daysSinceLast === null ? "sem registro" : `${data.daysSinceLast} dia(s)`}</span>
      <div class="record-metrics-grid">
        ${[
          ["7 dias", data.completed7],
          ["30 dias", data.completed30],
          ["Adesão", `${data.adherence}%`],
          ["Não finalizados", data.unfinished],
          ["Check-ins", checkins.length],
          ["Status", riskLabel],
          ["Dor", data.hasPain ? "Sim" : "Não"],
          ["Dificuldade", data.hasDifficulty ? "Atenção" : "Normal"],
          ["Observação", data.hasNote ? "Sim" : "Não"],
        ].map(([label, value]) => `<span class="admin-profile-metric"><strong>${value}</strong><small>${label}</small></span>`).join("")}
      </div>
      <small>Ficha: ${data.workoutStatus.label} | Plano: ${student.plan || "-"} | Pagamento: ${data.paymentStatus}</small>
    `;
    adminAdherenceSummary.appendChild(card);
  });
}

function fillEvolutionFilterSelect(select, selectedValue = "", includeAll = true) {
  if (!select) return;
  const previous = selectedValue || select.value || "";
  select.replaceChildren();
  if (includeAll) {
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "Todos os alunos";
    select.appendChild(all);
  }
  loadStudents().forEach((student) => {
    const option = document.createElement("option");
    option.value = student.name;
    option.textContent = student.name;
    select.appendChild(option);
  });
  select.value = [...select.options].some((option) => option.value === previous) ? previous : "";
}

function matchesFeedbackType(feedback, type) {
  if (!type || type === "all") return true;
  if (type === "pain") return feedback.pain;
  if (type === "difficulty") return isFeedbackDifficultyHigh(feedback);
  if (type === "note") return !!String(feedback.note || "").trim();
  if (type === "incomplete") return feedback.status === "nao_finalizado";
  return true;
}

function getIncompleteWorkoutItems(studentFilter = "") {
  const feedbackKeys = new Set(loadWorkoutFeedbacks().map((feedback) => `${feedback.studentName}|${feedback.workoutId || feedback.workoutTitle || ""}|${feedback.date || ""}`));
  const grouped = new Map();
  loadProgressRecords()
    .filter((record) => !studentFilter || record.studentName === studentFilter)
    .forEach((record) => {
      const key = `${record.studentName}|${record.workoutId || record.workoutTitle || ""}|${record.date || ""}`;
      if (feedbackKeys.has(key) || grouped.has(key)) return;
      grouped.set(key, {
        id: `incomplete-${key}`,
        studentName: record.studentName,
        workoutTitle: record.workoutTitle || "Treino iniciado",
        date: record.date || "-",
        timestamp: record.timestamp || 0,
        rating: "",
        difficulty: "Treino não concluído",
        pain: false,
        painLocation: "",
        note: "Há carga registrada, mas o treino não foi finalizado com feedback.",
        status: "nao_finalizado",
      });
    });
  return [...grouped.values()];
}

function renderAdminFeedbacks() {
  if (!adminFeedbackHistory || !adminFeedbackNotes) return;
  fillEvolutionFilterSelect(adminFeedbackStudentFilter, adminFeedbackStudentFilter?.value || "");
  fillEvolutionFilterSelect(adminNotesStudentFilter, adminNotesStudentFilter?.value || "");

  const studentFilter = adminFeedbackStudentFilter?.value || "";
  const typeFilter = adminFeedbackTypeFilter?.value || "all";
  const baseFeedbacks = loadWorkoutFeedbacks()
    .filter((feedback) => !studentFilter || feedback.studentName === studentFilter)
    .filter((feedback) => matchesFeedbackType(feedback, typeFilter))
    .concat(typeFilter === "incomplete" || typeFilter === "all" ? getIncompleteWorkoutItems(studentFilter) : []);
  const feedbacks = baseFeedbacks
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  adminFeedbackHistory.innerHTML = "";
  adminFeedbackNotes.innerHTML = "";

  if (!feedbacks.length) {
    adminFeedbackHistory.textContent = "Nenhum feedback encontrado para os filtros atuais.";
  } else {
    feedbacks.forEach((feedback) => {
      const item = document.createElement("article");
      const isPain = feedback.pain;
      const isHard = isFeedbackDifficultyHigh(feedback);
      item.className = `feedback-card ${feedback.status === "nao_finalizado" ? "feedback-neutral" : isPain ? "feedback-danger" : isHard ? "feedback-warning" : ""}`;
      item.dataset.feedbackCard = feedback.id;
      item.classList.toggle("alert-focus-card", highlightedFeedbackId === feedback.id);
      item.innerHTML = `
        <strong>${feedback.studentName} | ${feedback.date || "-"}</strong>
        <span>${feedback.sessionTitle || feedback.workoutTitle || "Treino"} | Nota ${feedback.rating || "-"} | ${feedback.difficulty || "Sem intensidade"}</span>
        <small>${isPain ? `Dor: ${feedback.painLocation || "local não informado"}` : "Sem dor relatada"}${feedback.note ? ` | ${feedback.note}` : ""}</small>
        <em>Clique para ver os detalhes do treino executado.</em>
      `;
      const detail = renderFeedbackWorkoutDetail(feedback);
      detail.hidden = true;
      item.appendChild(detail);
      adminFeedbackHistory.appendChild(item);
      if (highlightedFeedbackId === feedback.id) {
        setTimeout(() => item.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
      }
    });
  }

  const notesStudent = adminNotesStudentFilter?.value || "";
  const notes = loadWorkoutFeedbacks()
    .filter((feedback) => !notesStudent || feedback.studentName === notesStudent)
    .filter((feedback) => feedback.note || feedback.painLocation)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  if (!notes.length) {
    adminFeedbackNotes.textContent = "Nenhuma observação enviada.";
    return;
  }
  notes.forEach((feedback) => {
    const note = document.createElement("article");
    note.className = `feedback-card ${feedback.pain ? "feedback-danger" : ""}`;
    note.classList.toggle("alert-focus-card", highlightedFeedbackId === feedback.id);
    note.innerHTML = `<strong>${feedback.studentName} | ${feedback.date || "-"}</strong><span>${feedback.workoutTitle || "Treino"}</span><small>${feedback.note || feedback.painLocation}</small>`;
    adminFeedbackNotes.appendChild(note);
  });
}

function renderFeedbackWorkoutDetail(feedback) {
  const detail = document.createElement("div");
  detail.className = "feedback-workout-detail";
  const workout = (loadWorkouts()[feedback.studentName] || []).find((item) => item.id === feedback.workoutId);
  const sessions = getOrderedWorkoutSessions(workout || {});
  const session = sessions.find((item) => item.id === feedback.sessionId)
    || sessions.find((item) => item.title === feedback.sessionTitle)
    || sessions[0];
  const records = loadProgressRecords().filter((record) =>
    record.studentName === feedback.studentName &&
    (!feedback.workoutId || record.workoutId === feedback.workoutId) &&
    (!feedback.sessionId || record.sessionId === feedback.sessionId) &&
    record.date === feedback.date,
  );

  const title = document.createElement("strong");
  title.textContent = `${feedback.sessionTitle || session?.title || feedback.workoutTitle || "Treino"} | ${feedback.date || "-"}`;
  detail.appendChild(title);

  if (!session?.exercises?.length) {
    const empty = document.createElement("small");
    empty.textContent = "Ficha original não encontrada. Exibindo apenas cargas registradas.";
    detail.appendChild(empty);
  }

  const list = document.createElement("div");
  list.className = "record-history-list";
  const exercises = session?.exercises?.length
    ? session.exercises.map((exercise, index) => ({ exercise: normalizeExercise(exercise), index }))
    : records.map((record, index) => ({ exercise: { name: record.exerciseName, sets: record.sets, reps: record.reps, progressNote: record.note }, index }));

  exercises.forEach(({ exercise, index }) => {
    const exerciseKey = getExerciseKey(feedback.workoutId || "feedback", exercise.name, index);
    const record = records.find((item) => item.exerciseKey === exerciseKey || item.exerciseName === exercise.name);
    const row = document.createElement("div");
    row.className = "evolution-mini-row";
    row.innerHTML = `<strong>${exercise.name || "Exercício"}</strong><span>${exercise.sets || record?.sets || "-"} séries | ${exercise.reps || record?.reps || "-"} reps | carga ${record?.load || exercise.currentLoad || exercise.weight || "-"}</span><small>${record?.note || exercise.progressNote || "Sem observação."}</small>`;
    list.appendChild(row);
  });

  detail.appendChild(list);
  return detail;
}

function getRecordMonthKey(record) {
  const text = String(record?.date || "");
  const brDate = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (brDate) {
    const year = brDate[3].length === 2 ? `20${brDate[3]}` : brDate[3];
    return `${year}-${brDate[2].padStart(2, "0")}`;
  }

  const parsed = new Date(record?.timestamp || text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 7);
  return "";
}

function formatMonthLabel(monthKey) {
  if (!monthKey) return "-";
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  const monthName = date.toLocaleDateString("pt-BR", { month: "long" });
  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)}/${year}`;
}

function prepareChartRecords(records, mode = "last10") {
  const numericRecords = records
    .map((record) => ({ record, value: parseLoad(record.load) }))
    .filter((item) => item.value !== null)
    .sort((a, b) => (a.record.timestamp || 0) - (b.record.timestamp || 0));

  const prescribed = numericRecords.filter((item) => item.record.prescribed);
  const executed = numericRecords.filter((item) => !item.record.prescribed);

  if (mode === "monthly-average" || mode === "monthly-best") {
    const monthly = {};
    executed.forEach((item) => {
      const monthKey = getRecordMonthKey(item.record);
      if (!monthKey) return;
      monthly[monthKey] ||= [];
      monthly[monthKey].push(item);
    });

    return Object.entries(monthly).map(([monthKey, items]) => {
      const selected =
        mode === "monthly-best"
          ? items.reduce((best, item) => (item.value > best.value ? item : best), items[0])
          : items[items.length - 1];
      const value =
        mode === "monthly-best"
          ? selected.value
          : items.reduce((total, item) => total + item.value, 0) / items.length;
      return {
        record: {
          ...selected.record,
          load: `${Number(value.toFixed(1)).toLocaleString("pt-BR")} kg`,
          date: formatMonthLabel(monthKey),
          note: mode === "monthly-best" ? "Melhor carga do mes" : "Media mensal",
        },
        value,
      };
    });
  }

  if (mode === "all") return numericRecords;

  const limit = Number(mode.replace("last", "")) || 10;
  const visible = executed.slice(-limit);
  return prescribed.length && visible.length ? [prescribed[0], ...visible] : visible.length ? visible : numericRecords.slice(-limit);
}

function getTrendLabel(records) {
  const numeric = records.map((record) => parseLoad(record.load)).filter((value) => value !== null);
  if (numeric.length < 2) return "Sem tendencia";
  const first = numeric[0];
  const last = numeric[numeric.length - 1];
  const diff = last - first;
  if (Math.abs(diff) < 0.5) return "Mantendo";
  return diff > 0 ? "Subindo" : "Caindo";
}

function renderLoadChart(container, records, mode = "last10") {
  container.innerHTML = "";

  const numericRecords = records
    .map((record) => ({ record, value: parseLoad(record.load) }))
    .filter((item) => item.value !== null)
    .sort((a, b) => (a.record.timestamp || 0) - (b.record.timestamp || 0));
  const chartRecords = prepareChartRecords(records, mode);

  const values = numericRecords.map((item) => item.value);
  if (!values.length) {
    container.textContent = "Registros sem carga numérica para montar o gráfico.";
    return;
  }

  if (!chartRecords.length) {
    container.textContent = "Não há registros suficientes para esta visualização.";
    return;
  }

  const chartValues = chartRecords.map((item) => item.value);
  const max = Math.max(...chartValues);
  const min = Math.min(...chartValues);
  const range = Math.max(max - min, 1);
  const initial = values[0];
  const current = values[values.length - 1];
  const allBest = Math.max(...values);
  const percent = initial ? ((current - initial) / initial) * 100 : 0;
  const totalExecutions = numericRecords.filter((item) => !item.record.prescribed).length;

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

  chartRecords.forEach(({ record, value }) => {
    const bar = document.createElement("div");
    bar.className = "load-chart-bar";
    const height = 28 + ((value - min) / range) * 68;
    bar.style.setProperty("--bar-height", `${height}%`);

    const fill = document.createElement("span");
    fill.tabIndex = 0;
    fill.setAttribute("role", "button");
    fill.setAttribute("aria-label", `${record.exerciseName || "Exercício"} ${record.date} ${record.load}`);
    const load = document.createElement("strong");
    load.textContent = record.load;
    const date = document.createElement("small");
    date.textContent = formatShortChartDate(record.date);

    const showTooltip = () => {
      tooltip.innerHTML = "";
      [
        record.exerciseName || "Exercício",
        `Data: ${record.date}`,
        `Carga: ${record.load}`,
        `Séries: ${record.sets || "-"}`,
        `Repeticoes: ${record.reps || "-"}`,
        `Treino: ${record.workoutTitle || "-"}`,
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
    ["Maior carga", `${Number(allBest.toFixed(1)).toLocaleString("pt-BR")} kg`],
    ["Evolução em %", `${percent >= 0 ? "+" : ""}${Number(percent.toFixed(1)).toLocaleString("pt-BR")}%`],
    ["Total de execucoes", totalExecutions],
    ["Tendencia", getTrendLabel(numericRecords.map((item) => item.record))],
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
  if (!previous) return "Primeira avaliação";

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
  subtitle.textContent = previous ? "Comparada com a avaliação anterior" : "Primeira avaliação registrada";
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

  const actions = document.createElement("div");
  actions.className = "student-actions";
  const details = document.createElement("button");
  details.type = "button";
  details.className = "secondary";
  details.dataset.assessmentDetails = assessment.id;
  details.textContent = "Ver detalhes";
  const compare = document.createElement("button");
  compare.type = "button";
  compare.className = "secondary";
  compare.dataset.assessmentCompare = assessment.id;
  compare.textContent = "Comparar";
  actions.append(details, compare);
  card.appendChild(actions);

  const detail = document.createElement("div");
  detail.className = "assessment-detail-panel";
  detail.hidden = true;
  detail.innerHTML = `
    <strong>Detalhes profissionais</strong>
    <span>Altura: ${assessment.height || "-"} | Idade: ${assessment.age || "-"} | Visceral: ${assessment.visceralFat || "-"}</span>
    <span>Cintura: ${assessment.waist || "-"} | Abdômen: ${assessment.abdomen || "-"} | Quadril: ${assessment.hip || "-"}</span>
    <small>Queixas: ${assessment.complaints || "-"}</small>
    <small>Pontos de atenção: ${assessment.attention || "-"}</small>
    <small>Conduta: ${assessment.conduct || "-"}</small>
    <small>Parecer: ${assessment.autoOpinion || "-"}</small>
  `;
  card.appendChild(detail);

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
    container.textContent = "Nenhuma avaliação física registrada ainda.";
    return;
  }

  [...assessments].reverse().forEach((assessment, index, reversed) => {
    container.appendChild(createAssessmentHistoryCard(assessment, reversed[index + 1]));
  });
}

function getAssessmentNumber(assessment, key) {
  return parseLoad(assessment?.[key]);
}

function getAssessmentDelta(current, previous, key, suffix = "") {
  const currentValue = getAssessmentNumber(current, key);
  const previousValue = getAssessmentNumber(previous, key);
  if (currentValue === null || previousValue === null) return "Sem comparação";
  const diff = currentValue - previousValue;
  return `${diff > 0 ? "↑ +" : diff < 0 ? "↓ " : "→ "}${diff.toLocaleString("pt-BR")}${suffix}`;
}

function getNextAssessmentDateLabel(latest) {
  const base = parseDateLike(latest?.date) || new Date();
  base.setDate(base.getDate() + 30);
  return base.toLocaleDateString("pt-BR");
}

function ensureAssessmentProfessionalUi() {
  const module = document.querySelector("#admin-module-assessments");
  const menu = document.querySelector('[data-subpage-menu="assessments"]');
  if (!module || !menu || document.querySelector("#assessment-dashboard-panel")) return;

  const panel = document.createElement("section");
  panel.id = "assessment-dashboard-panel";
  panel.className = "assessment-dashboard-panel";
  panel.innerHTML = `
    <label class="assessment-main-selector">Aluno
      <select id="assessment-dashboard-student"></select>
    </label>
    <div class="assessment-student-overview" id="assessment-student-overview"></div>
    <div class="assessment-summary-grid" id="assessment-admin-summary"></div>
    <div class="assessment-goals-panel" id="assessment-goals-panel"></div>
  `;
  menu.parentNode.insertBefore(panel, menu);

  const extra = document.createElement("div");
  extra.id = "assessment-extra-fields";
  extra.className = "assessment-extra-fields";
  extra.innerHTML = `
    <section class="assessment-form-section"><strong>Dados gerais</strong><div class="assessment-fields">
      <label>Altura<input id="assessment-height" placeholder="Ex: 1,75 m" /></label>
      <label>Idade<input id="assessment-age" placeholder="Ex: 32" /></label>
      <label>Objetivo do aluno<input id="assessment-goal" placeholder="Ex: reduzir gordura e ganhar massa" /></label>
    </div></section>
    <section class="assessment-form-section"><strong>Bioimpedância</strong><div class="assessment-fields">
      <label>Massa muscular esquelética<input id="assessment-skeletal-muscle" placeholder="Ex: 34 kg" /></label>
      <label>Massa livre de gordura<input id="assessment-lean-mass" placeholder="Ex: 62 kg" /></label>
      <label>Água corporal total<input id="assessment-water" placeholder="Ex: 42 L" /></label>
      <label>Gordura visceral<input id="assessment-visceral-fat" placeholder="Ex: 8" /></label>
      <label>TMB<input id="assessment-bmr" placeholder="Ex: 1780 kcal" /></label>
      <label>Calorias recomendadas<input id="assessment-calories" placeholder="Ex: 2200 kcal" /></label>
    </div></section>
    <section class="assessment-form-section"><strong>Circunferências</strong><div class="assessment-fields">
      <label>Pescoço<input id="assessment-neck" /></label>
      <label>Ombros<input id="assessment-shoulders" /></label>
      <label>Tórax<input id="assessment-chest" /></label>
      <label>Braço direito<input id="assessment-right-arm" /></label>
      <label>Braço esquerdo<input id="assessment-left-arm" /></label>
      <label>Cintura<input id="assessment-waist" /></label>
      <label>Abdômen<input id="assessment-abdomen" /></label>
      <label>Quadril<input id="assessment-hip" /></label>
      <label>Coxa direita<input id="assessment-right-thigh" /></label>
      <label>Coxa esquerda<input id="assessment-left-thigh" /></label>
      <label>Panturrilha direita<input id="assessment-right-calf" /></label>
      <label>Panturrilha esquerda<input id="assessment-left-calf" /></label>
    </div></section>
    <section class="assessment-form-section"><strong>Fotos</strong><div class="assessment-fields">
      <label>Frente<input id="assessment-photo-front" type="file" accept="image/*" /></label>
      <label>Lado<input id="assessment-photo-side" type="file" accept="image/*" /></label>
      <label>Costas<input id="assessment-photo-back" type="file" accept="image/*" /></label>
      <label>Bioimpedância<input id="assessment-photo-bio" type="file" accept="image/*,.pdf" /></label>
    </div></section>
    <section class="assessment-form-section"><strong>Observações e parecer</strong><div class="assessment-fields">
      <label>Queixas do aluno<textarea id="assessment-complaints"></textarea></label>
      <label>Pontos de atenção<textarea id="assessment-attention"></textarea></label>
      <label>Conduta para o próximo mês<textarea id="assessment-conduct"></textarea></label>
      <label>Meta de peso<input id="assessment-goal-weight" /></label>
      <label>Meta de gordura<input id="assessment-goal-fat" /></label>
      <label>Meta abdominal<input id="assessment-goal-abdomen" /></label>
      <label>Prazo da meta<input id="assessment-goal-deadline" placeholder="DD/MM/AAAA" /></label>
      <label class="assessment-notes">Parecer automático editável<textarea id="assessment-auto-opinion"></textarea></label>
    </div></section>
    <div class="student-actions">
      <button type="button" class="secondary" id="assessment-generate-summary">Gerar resumo da avaliação</button>
      <button type="button" class="secondary" id="assessment-copy-report">Copiar relatório para WhatsApp</button>
    </div>
  `;
  assessmentForm?.insertBefore(extra, assessmentForm.querySelector("button[type='submit']"));
}

function getAssessmentDashboardStudent() {
  const select = document.querySelector("#assessment-dashboard-student");
  return select?.value || assessmentStudent?.value || loadStudents()[0]?.name || "";
}

function syncAssessmentStudentSelects(studentName = getAssessmentDashboardStudent()) {
  const dashboardSelect = document.querySelector("#assessment-dashboard-student");
  fillStudentSelects();
  if (dashboardSelect) {
    const previous = studentName || dashboardSelect.value;
    dashboardSelect.replaceChildren();
    loadStudents().forEach((student) => {
      const option = document.createElement("option");
      option.value = student.name;
      option.textContent = student.name;
      dashboardSelect.appendChild(option);
    });
    dashboardSelect.value = loadStudents().some((student) => student.name === previous) ? previous : loadStudents()[0]?.name || "";
  }
  if (assessmentStudent && dashboardSelect?.value) assessmentStudent.value = dashboardSelect.value;
}

function renderAssessmentOverview(studentName = getAssessmentDashboardStudent()) {
  const overview = document.querySelector("#assessment-student-overview");
  const summary = document.querySelector("#assessment-admin-summary");
  const goals = document.querySelector("#assessment-goals-panel");
  if (!overview || !summary || !goals) return;

  const student = loadStudents().find((item) => item.name === studentName);
  const assessments = getStudentAssessments(studentName);
  const latest = assessments[assessments.length - 1];
  const previous = assessments[assessments.length - 2];
  overview.innerHTML = "";
  summary.innerHTML = "";
  goals.innerHTML = "";

  if (!student) {
    overview.textContent = "Selecione um aluno para visualizar a avaliação.";
    return;
  }

  overview.innerHTML = `
    <div><strong>${student.name}</strong><span>${student.plan || "-"} | objetivo: ${latest?.goal || student.goal || student.plan || "não informado"}</span></div>
    <div class="student-actions">
      <button type="button" class="primary" data-open-assessment-page="assessment-new">Nova avaliação</button>
      <button type="button" class="secondary" data-open-assessment-page="assessment-history">Ver histórico</button>
    </div>
    <small>Última avaliação: ${latest?.date || "sem registro"} | Próxima recomendada: ${latest ? getNextAssessmentDateLabel(latest) : "após primeira avaliação"}</small>
  `;

  [
    ["Peso atual", latest?.weight, getAssessmentDelta(latest, previous, "weight", "kg")],
    ["% gordura", latest?.fat, getAssessmentDelta(latest, previous, "fat", "%")],
    ["Massa muscular", latest?.muscle, getAssessmentDelta(latest, previous, "muscle", "kg")],
    ["Abdômen/cintura", latest?.abdomen || latest?.waist, getAssessmentDelta(latest, previous, latest?.abdomen ? "abdomen" : "waist", "cm")],
    ["Gordura visceral", latest?.visceralFat, getAssessmentDelta(latest, previous, "visceralFat")],
    ["IMC", latest?.imc, getAssessmentDelta(latest, previous, "imc")],
  ].forEach(([label, value, comparison]) => summary.appendChild(createAssessmentSummaryCard(label, value, comparison)));

  goals.appendChild(renderAssessmentGoals(latest, previous));
}

function renderAssessmentGoals(latest) {
  const card = document.createElement("article");
  card.className = "assessment-history-card assessment-goal-card";
  if (!latest) {
    card.textContent = "Cadastre uma avaliação para acompanhar metas.";
    return card;
  }
  const goals = [
    ["Peso", latest.weight, latest.goalWeight, "kg"],
    ["Gordura", latest.fat, latest.goalFat, "%"],
    ["Abdômen", latest.abdomen || latest.waist, latest.goalAbdomen, "cm"],
  ];
  card.innerHTML = `<div class="load-history-head"><strong>Metas</strong><small>Prazo: ${latest.goalDeadline || "-"}</small></div>`;
  goals.forEach(([label, current, target, suffix]) => {
    const currentNumber = parseLoad(current);
    const targetNumber = parseLoad(target);
    const progress = currentNumber !== null && targetNumber !== null && currentNumber
      ? Math.max(0, Math.min(100, Math.round((1 - Math.abs(currentNumber - targetNumber) / Math.max(currentNumber, targetNumber, 1)) * 100)))
      : 0;
    const row = document.createElement("div");
    row.className = "assessment-goal-row";
    row.innerHTML = `<span>${label}: ${current || "-"} / meta ${target || "-"}</span><strong>${progress}%</strong><div><i style="width:${progress}%"></i></div>`;
    card.appendChild(row);
  });
  return card;
}

function renderAssessmentChartCard(title, assessments, key, suffix = "") {
  const card = document.createElement("article");
  card.className = "assessment-history-card assessment-chart-card";
  card.innerHTML = `<strong>${title}</strong>`;
  const values = assessments.map((item) => ({ item, value: parseLoad(item[key]) })).filter((entry) => entry.value !== null);
  if (!values.length) {
    card.appendChild(document.createTextNode("Sem dados para gráfico."));
    return card;
  }
  const max = Math.max(...values.map((entry) => entry.value), 1);
  values.slice(-8).forEach(({ item, value }) => {
    const row = document.createElement("div");
    row.className = "assessment-chart-row";
    row.innerHTML = `<span>${item.date}</span><div><i style="width:${Math.max(4, Math.round((value / max) * 100))}%"></i></div><strong>${value.toLocaleString("pt-BR")}${suffix}</strong>`;
    card.appendChild(row);
  });
  return card;
}

function createAssessmentReportText(assessment, previous, studentName) {
  if (!assessment) return "Nenhuma avaliação selecionada.";
  const weight = getAssessmentDelta(assessment, previous, "weight", "kg");
  const fat = getAssessmentDelta(assessment, previous, "fat", "%");
  const abdomenKey = assessment.abdomen ? "abdomen" : "waist";
  const abdomen = getAssessmentDelta(assessment, previous, abdomenKey, "cm");
  return `Avaliação física - ${studentName}\nData: ${assessment.date}\nPeso: ${assessment.weight || "-"} (${weight})\nGordura: ${assessment.fat || "-"} (${fat})\nMassa muscular: ${assessment.muscle || "-"}\nAbdômen/Cintura: ${assessment.abdomen || assessment.waist || "-"} (${abdomen})\n\nParecer: ${assessment.autoOpinion || assessment.notes || "Evolução registrada. Manter acompanhamento e ajustes progressivos."}`;
}

function updateAssessmentOpinion() {
  const opinion = document.querySelector("#assessment-auto-opinion");
  if (!opinion || opinion.value.trim()) return;
  const studentName = assessmentStudent?.value || getAssessmentDashboardStudent();
  const assessments = getStudentAssessments(studentName);
  const previous = assessments[assessments.length - 1];
  const draft = {
    date: assessmentDate?.value || formatToday(),
    weight: assessmentWeight?.value || "",
    fat: assessmentFat?.value || "",
    muscle: assessmentMuscle?.value || "",
    abdomen: document.querySelector("#assessment-abdomen")?.value || "",
    waist: document.querySelector("#assessment-waist")?.value || "",
    notes: assessmentNotes?.value || "",
  };
  opinion.value = createAssessmentReportText(draft, previous, studentName)
    .replace(`Avaliação física - ${studentName}\nData: ${draft.date}\n`, "Desde a última avaliação, o aluno apresentou os seguintes dados: ")
    .replace(/\n/g, " ");
}

async function readOptionalAssessmentFile(id) {
  const input = document.querySelector(`#${id}`);
  return readAssessmentAttachment(input?.files?.[0]);
}

function getAssessmentExtraPayload() {
  const value = (id) => document.querySelector(`#${id}`)?.value.trim() || "";
  return {
    height: value("assessment-height"),
    age: value("assessment-age"),
    goal: value("assessment-goal"),
    skeletalMuscle: value("assessment-skeletal-muscle"),
    leanMass: value("assessment-lean-mass"),
    water: value("assessment-water"),
    visceralFat: value("assessment-visceral-fat"),
    bmr: value("assessment-bmr"),
    calories: value("assessment-calories"),
    neck: value("assessment-neck"),
    shoulders: value("assessment-shoulders"),
    chest: value("assessment-chest"),
    rightArm: value("assessment-right-arm"),
    leftArm: value("assessment-left-arm"),
    waist: value("assessment-waist"),
    abdomen: value("assessment-abdomen"),
    hip: value("assessment-hip"),
    rightThigh: value("assessment-right-thigh"),
    leftThigh: value("assessment-left-thigh"),
    rightCalf: value("assessment-right-calf"),
    leftCalf: value("assessment-left-calf"),
    complaints: value("assessment-complaints"),
    attention: value("assessment-attention"),
    conduct: value("assessment-conduct"),
    goalWeight: value("assessment-goal-weight"),
    goalFat: value("assessment-goal-fat"),
    goalAbdomen: value("assessment-goal-abdomen"),
    goalDeadline: value("assessment-goal-deadline"),
    autoOpinion: value("assessment-auto-opinion"),
  };
}

function renderStudentAssessments() {
  if (!studentAssessmentSummary || !studentAssessmentHistory || !workoutViewStudent) return;

  const assessments = getStudentAssessments(workoutViewStudent.value);
  studentAssessmentSummary.innerHTML = "";

  if (!assessments.length) {
    studentAssessmentSummary.textContent = "Nenhuma avaliação física registrada ainda.";
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
  ensureAssessmentProfessionalUi();
  syncAssessmentStudentSelects();
  const studentName = getAssessmentDashboardStudent();
  if (assessmentStudent) assessmentStudent.value = studentName;
  renderAssessmentHistory(adminAssessmentHistory, getStudentAssessments(studentName));
  renderAssessmentSupportSummaries();
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
    studentCheckinStatus.textContent = "Não há aula prevista para hoje no pacote ativo.";
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

  studentCheckinStatus.textContent = "Registre sua presença na aula presencial.";
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

function formatDatePtBr(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

function getSameDayNextMonth(dateText) {
  const date = parseBrazilianDate(dateText);
  if (!date) return "";
  const targetYear = date.getFullYear() + (date.getMonth() === 11 ? 1 : 0);
  const targetMonth = (date.getMonth() + 1) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  return formatDatePtBr(new Date(targetYear, targetMonth, Math.min(date.getDate(), lastDay)));
}

function fillPackageModelList() {
  if (!packageModelList) return;
  packageModelList.innerHTML = "";
  loadPackageModels().forEach((model) => {
    const option = document.createElement("option");
    option.value = model.name;
    option.label = [model.value, model.frequency, model.total ? `${model.total} aulas` : ""].filter(Boolean).join(" | ");
    packageModelList.appendChild(option);
  });
}

function applyPackageModelByName(modelName = packageName?.value || "") {
  const model = loadPackageModels().find((item) => item.name.toLowerCase() === String(modelName).trim().toLowerCase());
  if (!model) return false;
  if (packageValue) packageValue.value = model.value || packageValue.value;
  if (packageTotal) packageTotal.value = model.total || packageTotal.value;
  if (packageFrequency) packageFrequency.value = model.frequency || packageFrequency.value;
  if (packageMakeupLimit) packageMakeupLimit.value = model.makeupLimit || packageMakeupLimit.value;
  return true;
}

function fillMakeupPackageSelect() {
  if (!makeupPackage || !makeupStudent) return;

  const selectedPackage = makeupPackage.value;
  const packages = loadClassPackages().filter((classPackage) => classPackage.studentName === makeupStudent.value);
  makeupPackage.replaceChildren();

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = packages.length ? "Sem pacote vinculado" : "Nenhum pacote salvo";
  makeupPackage.appendChild(empty);

  packages.forEach((classPackage) => {
    const option = document.createElement("option");
    option.value = classPackage.id;
    option.textContent = classPackage.name;
    makeupPackage.appendChild(option);
  });

  makeupPackage.value = packages.some((classPackage) => classPackage.id === selectedPackage) ? selectedPackage : "";
}

function fillPersonalReschedulePackageSelect() {
  if (!personalReschedulePackage || !personalRescheduleStudent) return;

  const selectedPackage = personalReschedulePackage.value;
  const packages = loadClassPackages().filter((classPackage) => classPackage.studentName === personalRescheduleStudent.value);
  personalReschedulePackage.replaceChildren();

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = packages.length ? "Sem pacote vinculado" : "Nenhum pacote salvo";
  personalReschedulePackage.appendChild(empty);

  packages.forEach((classPackage) => {
    const option = document.createElement("option");
    option.value = classPackage.id;
    option.textContent = classPackage.name;
    personalReschedulePackage.appendChild(option);
  });

  personalReschedulePackage.value = packages.some((classPackage) => classPackage.id === selectedPackage) ? selectedPackage : "";
}

function fillPackageForm(classPackage = null, studentName = "") {
  if (!packageForm) return;

  editingPackageId = classPackage?.id || null;
  if (packageStudent) packageStudent.value = classPackage?.studentName || studentName || packageStudent.value;
  if (packageViewStudent) packageViewStudent.value = classPackage?.studentName || studentName || packageViewStudent.value;
  if (packageStudentSearch) packageStudentSearch.value = classPackage?.studentName || studentName || packageStudentSearch.value;
  if (packageName) packageName.value = classPackage?.name || "";
  if (packageTotal) packageTotal.value = classPackage?.total || "";
  if (packageFrequency) packageFrequency.value = classPackage?.frequency || "";
  if (packageValue) packageValue.value = classPackage?.value || "";
  if (packageStart) packageStart.value = classPackage?.startDate || "";
  if (packageEnd) packageEnd.value = classPackage?.endDate || "";
  if (packageMakeupLimit) packageMakeupLimit.value = classPackage?.makeupLimit || "";
  if (packageDays) packageDays.value = classPackage?.days || "";
  if (packageTime) packageTime.value = classPackage?.time || "";
  if (packageNotes) packageNotes.value = classPackage?.notes || "";
}

function selectPackageStudent(studentName) {
  if (!studentName) return;
  if (packageViewStudent) packageViewStudent.value = studentName;
  if (packageStudent) packageStudent.value = studentName;
  if (packageStudentSearch) packageStudentSearch.value = studentName;
  if (packageForm && editingPackageId === null) packageForm.hidden = false;
  renderPackageStudentResults();
  renderPackageAdminList();
  fillManualCheckinPackageSelect();
  fillMakeupPackageSelect();
  saveNavigationState();
}

function renderPackageStudentResults() {
  if (!packageStudentResults) return;
  packageStudentResults.innerHTML = "";
  const query = packageStudentSearch?.value.trim().toLowerCase() || "";
  const students = loadStudents().filter((student) => !query || [
    student.name,
    student.phone,
    student.email,
  ].some((value) => String(value || "").toLowerCase().includes(query)));

  if (!query && packageViewStudent?.value) return;
  students.slice(0, 8).forEach((student) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = student.name === packageViewStudent?.value ? "primary" : "secondary";
    button.dataset.selectPackageStudent = student.name;
    button.textContent = `${student.name} | ${student.phone || student.email || "sem contato"}`;
    packageStudentResults.appendChild(button);
  });
  if (query && !students.length) {
    packageStudentResults.textContent = "Nenhum aluno encontrado.";
  }
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
    ["Valor", classPackage.value || "-"],
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
  processAutomaticPastLessons();

  const selectedStudent = packageViewStudent?.value || "";
  packageAdminList.innerHTML = "";

  if (!selectedStudent) {
    if (packageEmptyState) packageEmptyState.hidden = false;
    renderLessonBalancePanel("");
    renderLessonExtraHistory("");
    return;
  }

  if (packageEmptyState) packageEmptyState.hidden = true;
  if (manualCheckinStudent) manualCheckinStudent.value = selectedStudent;
  if (dropInStudent) dropInStudent.value = selectedStudent;
  if (makeupStudent) makeupStudent.value = selectedStudent;
  if (personalRescheduleStudent) personalRescheduleStudent.value = selectedStudent;
  fillManualCheckinPackageSelect();
  fillMakeupPackageSelect();
  fillPersonalReschedulePackageSelect();

  const packages = loadClassPackages()
    .filter((classPackage) => classPackage.studentName === selectedStudent)
    .sort((a, b) => b.createdAt - a.createdAt);

  if (!packages.length) {
    packageAdminList.textContent = "Nenhum pacote cadastrado para este aluno.";
    renderLessonBalancePanel(selectedStudent);
    renderLessonExtraHistory(selectedStudent);
    return;
  }

  packages.forEach((classPackage) => {
    const status = getPackageStatus(classPackage);
    const schedule = generatePackageSchedule(classPackage);
    const usedDateKeys = new Set(loadCheckins().filter((checkin) => checkin.packageId === classPackage.id && (checkin.lessonType || "package") === "package").map((checkin) => checkin.dateKey || ""));
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
      createAdminMetric("Valor", classPackage.value || "-"),
      createAdminMetric("Status", status.remaining <= 0 ? "Finalizado" : "Ativo"),
      createAdminMetric("Proxima aula", nextLesson ? `${nextLesson.date} | ${nextLesson.time}` : "Sem aula"),
    );

    head.append(title, progress);

    const actions = document.createElement("div");
    actions.className = "student-actions package-card-actions";
    [
      ["Ver detalhes", "details", "secondary"],
      ["Marcar presença", "presence", "primary"],
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
  renderLessonBalancePanel(selectedStudent);
  renderLessonExtraHistory(selectedStudent);
}

function showPackageModuleMenu() {
  if (packageModuleMenu) packageModuleMenu.hidden = false;
  packageSubpages.forEach((page) => {
    page.hidden = true;
  });
  if (packageForm) packageForm.hidden = true;
  editingPackageId = null;
  activePackageSubpage = "";
  activePackageMode = "";
  saveNavigationState();
}

function openPackageSubpage(pageName, mode = "") {
  activePackageSubpage = pageName;
  activePackageMode = mode;
  if (packageModuleMenu) packageModuleMenu.hidden = true;
  packageSubpages.forEach((page) => {
    page.hidden = page.dataset.packagePage !== pageName;
  });

  if (pageName === "packages") {
    fillPackageModelList();
    renderPackageStudentResults();
    if (packageEditorTitle) packageEditorTitle.textContent = mode === "create" ? "Criar novo pacote" : "Editar pacote";
    if (mode === "create") {
      editingPackageId = null;
      packageForm?.reset();
      if (packageViewStudent?.value && packageStudent) packageStudent.value = packageViewStudent.value;
      if (packageStudentSearch && packageViewStudent?.value) packageStudentSearch.value = packageViewStudent.value;
      if (packageForm) packageForm.hidden = !packageViewStudent?.value;
    } else if (packageForm) {
      packageForm.hidden = true;
    }
    renderPackageAdminList();
  }

  if (pageName === "makeup") {
    if (personalRescheduleStudent && packageViewStudent?.value) personalRescheduleStudent.value = packageViewStudent.value;
    fillPersonalReschedulePackageSelect();
    renderMakeupCreditList();
  }

  if (pageName === "history") {
    renderLessonExtraHistory(lessonHistoryStudent?.value || packageViewStudent?.value || "");
  }
  saveNavigationState();
}

function renderLessonBalancePanel(studentName = packageViewStudent?.value || "") {
  if (!lessonBalancePanel) return;
  lessonBalancePanel.innerHTML = "";

  if (!studentName) {
    lessonBalancePanel.textContent = "Selecione um aluno para ver saldo de pacote, reposições e avulsas.";
    return;
  }

  const activePackage = getActivePackage(studentName);
  const balance = getLessonBalance(studentName, activePackage);
  const card = document.createElement("section");
  card.className = "lesson-balance-grid";
  [
    ["Aulas do pacote", balance.packageTotal],
    ["Aulas realizadas", balance.completed],
    ["Aulas restantes", balance.remaining],
    ["Reposições disponíveis", balance.makeupAvailable],
    ["Reposições solicitadas", balance.makeupRequested],
    ["Reposições aprovadas", balance.makeupApproved],
    ["Reposições usadas", balance.makeupUsed],
    ["Reposições expiradas", balance.makeupExpired],
    ["Validade das reposições", balance.makeupValidities],
    ["Aulas avulsas lancadas", balance.dropInCount],
    ["Valor pendente avulsas", formatCurrencyNumber(balance.pendingDropInValue)],
  ].forEach(([label, value]) => card.appendChild(createAdminMetric(label, value)));
  lessonBalancePanel.appendChild(card);
}

function createMakeupWhatsAppUrl(student, credit) {
  const phone = normalizeWhatsAppPhone(student?.phone);
  if (!phone) return "";
  if (credit.status === "personal-pending" || credit.source === "personal") {
    const personalMessage = `Olá, ${student.name}! Tudo bem?\n\nSua aula do dia ${credit.sourceLessonDate} às ${credit.lessonTime} precisou ser remarcada pelo personal.\n\nEsta aula não será descontada do seu pacote.\n\nMe envie uma opção de horário para combinarmos a remarcação.\n\nPersonal João Victor`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(personalMessage)}`;
  }
  const message = `Olá, ${student.name}! Tudo bem?\n\nVocê possui 1 aula de reposição disponível referente à aula desmarcada em ${credit.sourceLessonDate}.\n\nEssa reposição é válida até ${credit.validUntil}.\n\nMe envie uma opção de horário para avaliarmos o reagendamento.\n\nPersonal João Victor`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function createStudentMakeupWhatsAppUrl(studentName, credit) {
  const phone = normalizeWhatsAppPhone("19992782696");
  const message = `Olá, João! Aqui é ${studentName}.\n\nCancelei minha aula do dia ${credit.sourceLessonDate} às ${credit.lessonTime} e gostaria de remarcar minha reposição.\n\nMinha reposição é válida até ${credit.validUntil}.\n\nPode me passar os horários disponíveis?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function createStudentPersonalRescheduleWhatsAppUrl(studentName, credit) {
  const phone = normalizeWhatsAppPhone("19992782696");
  const message = `Olá, João!\n\nAqui é ${studentName}.\n\nMinha aula do dia ${credit.sourceLessonDate} às ${credit.lessonTime} precisou ser remarcada.\n\nGostaria de combinar um novo horário.\n\nObrigado!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function requestStudentMakeupReschedule(creditId) {
  const credit = loadMakeupCredits().find((item) => item.id === creditId);
  if (!credit || !["available", "personal-pending"].includes(credit.status)) return "";
  const url = credit.status === "personal-pending"
    ? createStudentPersonalRescheduleWhatsAppUrl(credit.studentName, credit)
    : createStudentMakeupWhatsAppUrl(credit.studentName, credit);
  updateMakeupCreditStatus(creditId, "requested");
  return url;
}

function updateMakeupCreditStatus(creditId, status, extras = {}) {
  const credits = loadMakeupCredits();
  const index = credits.findIndex((credit) => credit.id === creditId);
  if (index < 0) return false;
  credits[index] = {
    ...credits[index],
    ...extras,
    status,
    updatedAt: Date.now(),
  };
  if (status === "requested") credits[index].requestedAt = new Date().toISOString();
  if (status === "approved") credits[index].approvedAt = new Date().toISOString();
  if (status === "rejected") credits[index].rejectedAt = new Date().toISOString();
  saveMakeupCredits(credits);
  renderAdminAlertBadge();
  return true;
}

function defineMakeupReplacementDate(creditId) {
  const credit = loadMakeupCredits().find((item) => item.id === creditId);
  if (!credit) return false;
  const replacementDate = window.prompt("Nova data da aula (DD/MM/AAAA):", credit.replacementDate || "");
  if (!replacementDate) return false;
  const replacementTime = window.prompt("Novo horário:", credit.replacementTime || credit.lessonTime || "");
  if (!replacementTime) return false;
  return updateMakeupCreditStatus(creditId, "approved", {
    replacementDate,
    replacementTime,
    personalNote: "Nova data definida pelo personal.",
  });
}

function useMakeupCreditById(creditId, markedBy = "personal") {
  const credits = loadMakeupCredits();
  const index = credits.findIndex((credit) => credit.id === creditId && credit.status === "approved");
  if (index < 0) return false;
  const credit = credits[index];
  credits[index] = {
    ...credit,
    status: "used",
    usedAt: new Date().toISOString(),
    replacementDate: formatToday(),
    replacementTime: formatCurrentTime(),
  };
  saveMakeupCredits(credits);

  const checkins = loadCheckins();
  checkins.push(createCheckin(credit.studentName, "aula de reposicao", { id: credit.packageId, name: credit.packageName }, markedBy, {
    lessonType: "makeup",
    makeupCreditId: credit.id,
    note: "Reposição utilizada",
  }));
  saveCheckins(checkins);
  return true;
}

function createLessonHistoryItem(entry) {
  const card = document.createElement("article");
  card.className = "checkin-history-card";
  card.classList.toggle("cancel-late", ["expired", "rejected", "desmarcada-sem-reposicao", "falta"].includes(entry.status));
  card.classList.toggle("cancel-ok", ["available", "approved", "requested", "used", "personal-pending", "desmarcada-com-reposicao"].includes(entry.status));
  const title = document.createElement("strong");
  title.textContent = entry.title;
  const detail = document.createElement("span");
  detail.textContent = entry.detail;
  card.append(title, detail);
  if (entry.note) {
    const note = document.createElement("small");
    note.textContent = entry.note;
    card.appendChild(note);
  }
  if (entry.kind === "makeup") {
    const actions = document.createElement("div");
    actions.className = "student-actions package-card-actions";
    if (entry.status === "available") {
      const whatsapp = document.createElement("button");
      whatsapp.type = "button";
      whatsapp.className = "secondary";
      whatsapp.dataset.sendMakeupWhatsapp = entry.id;
      whatsapp.textContent = "Enviar mensagem para agendar reposição";
      actions.appendChild(whatsapp);

      const request = document.createElement("button");
      request.type = "button";
      request.className = "secondary";
      request.dataset.requestMakeup = entry.id;
      request.textContent = "Marcar como solicitada";
      actions.appendChild(request);
    }
    if (entry.status === "available" || entry.status === "requested") {
      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "primary";
      approve.dataset.approveMakeup = entry.id;
      approve.textContent = "Aprovar reposição";
      actions.appendChild(approve);
    }
    if (entry.status === "approved") {
      const use = document.createElement("button");
      use.type = "button";
      use.className = "primary";
      use.dataset.useMakeup = entry.id;
      use.textContent = "Marcar como usada";
      actions.appendChild(use);
    }
    if (entry.status === "personal-pending") {
      const whatsapp = document.createElement("button");
      whatsapp.type = "button";
      whatsapp.className = "secondary";
      whatsapp.dataset.sendMakeupWhatsapp = entry.id;
      whatsapp.textContent = "Enviar mensagem";
      actions.appendChild(whatsapp);

      const request = document.createElement("button");
      request.type = "button";
      request.className = "secondary";
      request.dataset.requestMakeup = entry.id;
      request.textContent = "Marcar como solicitada";
      actions.appendChild(request);

      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "primary";
      approve.dataset.approveMakeup = entry.id;
      approve.textContent = "Aprovar remarcação";
      actions.appendChild(approve);
    }
    if (entry.status === "requested") {
      const whatsapp = document.createElement("button");
      whatsapp.type = "button";
      whatsapp.className = "secondary";
      whatsapp.dataset.sendMakeupWhatsapp = entry.id;
      whatsapp.textContent = "Enviar mensagem";
      actions.appendChild(whatsapp);
    }
    if (entry.status === "requested" || entry.status === "approved" || entry.status === "personal-pending") {
      const defineDate = document.createElement("button");
      defineDate.type = "button";
      defineDate.className = "secondary";
      defineDate.dataset.defineMakeupDate = entry.id;
      defineDate.textContent = "Definir nova data";
      actions.appendChild(defineDate);
    }
    if (entry.status !== "used" && entry.status !== "expired" && entry.status !== "rejected") {
      const reject = document.createElement("button");
      reject.type = "button";
      reject.className = "secondary danger-action";
      reject.dataset.rejectMakeup = entry.id;
      reject.textContent = "Recusar";
      actions.appendChild(reject);
    }
    if (actions.children.length) card.appendChild(actions);
  }
  return card;
}

function getUnifiedLessonHistory(studentName) {
  const checkinEntries = loadCheckins()
    .filter((item) => item.studentName === studentName)
    .map((item) => ({
      timestamp: item.timestamp || 0,
      status: item.status,
      date: item.date || "",
      title: `${item.date} | ${item.lessonType === "makeup" ? "Reposição" : item.lessonType === "dropin" ? "Avulsa" : "Pacote"}`,
      detail: `${getCheckinStatusLabel(item)}${item.value ? ` | ${item.value}` : ""}`,
      note: [
        item.reason,
        item.makeupValidUntil ? `Validade reposição: ${item.makeupValidUntil}` : "",
        item.leadMinutes ? `Antecedência: ${Math.floor(item.leadMinutes / 60)}h${String(item.leadMinutes % 60).padStart(2, "0")}` : "",
        item.note || item.packageName || "",
      ].filter(Boolean).join(" | "),
    }));
  const dropInEntries = getStudentDropIns(studentName).map((item) => ({
    timestamp: item.timestamp || item.createdAt || 0,
    date: item.date || "",
    title: `${item.date} | Avulsa`,
    detail: `${item.modality} | ${item.status} | ${item.value || "Sem valor"}`,
    note: item.note || "",
  }));
  const makeupEntries = getStudentMakeupCredits(studentName).map((item) => ({
    timestamp: item.timestamp || item.createdAt || 0,
    kind: "makeup",
    id: item.id,
    status: item.status,
    date: item.sourceLessonDate || "",
    title: `${item.sourceLessonDate} | ${item.source === "personal" ? "Remarcação pelo personal" : "Reposição"}`,
      detail: `${getMakeupDisplayStatus(item)} | aula ${item.lessonTime} | aviso ${item.noticeDate || "-"} ${item.noticeTime} | validade ${item.validUntil || "-"}`,
    note: [
      item.reason,
      item.leadMinutes ? `Antecedência: ${Math.floor(item.leadMinutes / 60)}h${String(item.leadMinutes % 60).padStart(2, "0")}` : "",
      item.replacementDate ? `Reposição em ${item.replacementDate} ${item.replacementTime || ""}` : "",
      item.note || item.packageName || "",
    ].filter(Boolean).join(" | "),
  }));
  return [...checkinEntries, ...dropInEntries, ...makeupEntries].sort((a, b) => b.timestamp - a.timestamp);
}

function renderLessonExtraHistory(studentName = packageViewStudent?.value || "") {
  if (!lessonExtraHistory) return;
  lessonExtraHistory.innerHTML = "";
  const selectedStudent = studentName || lessonHistoryStudent?.value || "";
  if (!selectedStudent) {
    lessonExtraHistory.textContent = "";
    return;
  }

  const startDate = parseBrazilianDate(lessonHistoryStart?.value || "");
  const endDate = parseBrazilianDate(lessonHistoryEnd?.value || "");
  const history = getUnifiedLessonHistory(selectedStudent).filter((entry) => {
    const entryDate = parseDateLike(entry.date);
    if (!entryDate) return true;
    if (startDate && entryDate < startDate) return false;
    if (endDate && entryDate > endDate) return false;
    return true;
  });
  if (!history.length) {
    lessonExtraHistory.textContent = "Nenhum histórico de pacote, reposição ou aula avulsa para este aluno.";
    return;
  }
  history.slice(0, 20).forEach((entry) => lessonExtraHistory.appendChild(createLessonHistoryItem(entry)));
}

function renderMakeupCreditList(studentName = makeupListStudent?.value || packageViewStudent?.value || "") {
  if (!makeupCreditList) return;
  makeupCreditList.innerHTML = "";

  if (!studentName) {
    makeupCreditList.textContent = "Selecione um aluno para visualizar reposições.";
    return;
  }

  const credits = getStudentMakeupCredits(studentName).sort((a, b) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0));
  if (!credits.length) {
    makeupCreditList.textContent = "Nenhuma reposição registrada para este aluno.";
    return;
  }

  credits.forEach((item) => {
    const card = createLessonHistoryItem({
      timestamp: item.timestamp || item.createdAt || 0,
      kind: "makeup",
      id: item.id,
      status: item.status,
      date: item.sourceLessonDate || "",
    title: `${item.sourceLessonDate} | ${item.source === "personal" ? "Remarcação pelo personal" : "Reposição"}`,
      detail: `${getMakeupDisplayStatus(item)} | validade ${item.validUntil || "-"} | aula ${item.lessonTime || "-"}`,
      note: [
        item.reason,
        item.noticeDate || item.noticeTime ? `Aviso: ${item.noticeDate || "-"} ${item.noticeTime || ""}` : "",
        item.replacementDate ? `Reposição em ${item.replacementDate} ${item.replacementTime || ""}` : "",
        item.note || item.packageName || "",
      ].filter(Boolean).join(" | "),
    });
    card.classList.toggle("alert-focus-card", highlightedMakeupCreditId === item.id);
    makeupCreditList.appendChild(card);
    if (highlightedMakeupCreditId === item.id) {
      setTimeout(() => card.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    }
  });
}

function renderPackageListDetails(classPackage, detail) {
  detail.innerHTML = "";
  const box = document.createElement("div");
  box.className = "package-detail-grid";
  [
    ["Dias", classPackage.days],
    ["Frequência", classPackage.frequency || "-"],
    ["Valor", classPackage.value || "-"],
    ["Limite reposições", classPackage.makeupLimit || "-"],
    ["Horário", classPackage.time],
    ["Início", classPackage.startDate],
    ["Término", classPackage.endDate],
  ].forEach(([label, value]) => {
    box.appendChild(createAdminMetric(label, value || "-"));
  });

  const historyButton = document.createElement("button");
  historyButton.type = "button";
  historyButton.className = "secondary";
  historyButton.dataset.packageListAction = "history";
  historyButton.dataset.packageId = classPackage.id;
  historyButton.textContent = "Ver histórico";

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
    item.classList.toggle("cancel-late", record.status === "cancelada-fora-prazo" || record.status === "desmarcada-sem-reposicao" || record.status === "falta");
    item.classList.toggle("cancel-ok", record.status === "cancelada-no-prazo" || record.status === "desmarcada-com-reposicao");
    item.classList.toggle("checkin-ok", record.status === "realizado");
    item.textContent = `${record.date} as ${record.time} | ${getCheckinStatusLabel(record)}${record.reason ? ` | ${record.reason}` : ""}${record.makeupValidUntil ? ` | validade ${record.makeupValidUntil}` : ""}`;
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
    ["Aluno desmarcou", "reschedule", "secondary"],
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
  processAutomaticPastLessons();

  const selectedStudent = checkinFilterStudent?.value || "";
  const selectedDate = checkinFilterDate?.value.trim() || "";
  const month = currentMonthKey();
  const checkins = loadCheckins()
    .filter((checkin) => !selectedStudent || checkin.studentName === selectedStudent)
    .filter((checkin) => !selectedDate || checkin.date === selectedDate)
    .sort((a, b) => b.timestamp - a.timestamp);

  const monthlyTotal = loadCheckins().filter((checkin) => checkin.month === month).length;
  checkinMonthTotal.textContent = `Total de presenças no mês: ${monthlyTotal}`;
  checkinHistory.innerHTML = "";

  if (!checkins.length) {
    checkinHistory.textContent = "Nenhum check-in encontrado para este filtro.";
    return;
  }

  checkins.forEach((checkin) => {
    const card = document.createElement("article");
    card.className = "checkin-history-card";
    card.classList.toggle("cancel-late", checkin.status === "cancelada-fora-prazo" || checkin.status === "desmarcada-sem-reposicao" || checkin.status === "falta");
    card.classList.toggle("cancel-ok", checkin.status === "cancelada-no-prazo" || checkin.status === "desmarcada-com-reposicao");

    const head = document.createElement("div");
    head.className = "load-history-head";

    const title = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = checkin.studentName;
    const detail = document.createElement("small");
    detail.textContent = `${checkin.date} as ${checkin.time}${checkin.packageName ? ` | ${checkin.packageName}` : ""}`;
    title.append(name, detail);

    const type = document.createElement("span");
    type.className = checkin.status === "cancelada-fora-prazo" || checkin.status === "desmarcada-sem-reposicao" || checkin.status === "falta" ? "status-danger" : "status-ok";
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
  processAutomaticPastLessons();

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

  const cards = document.createElement("div");
  cards.className = "nav-card-grid student-agenda-menu";
  cards.dataset.studentAgendaMenu = "true";
  const studentMakeups = getStudentMakeupCredits(activePackage.studentName);
  const makeupAvailable = studentMakeups.filter((item) => item.status === "available").length;
  const makeupRequested = studentMakeups.filter((item) => item.status === "requested").length;
  cards.append(
    createStudentAgendaNavCard("calendar", "Minhas aulas", "Veja suas próximas aulas agendadas.", "lessons"),
    createStudentAgendaNavCard("calendar-x", "Cancelar aula", "Cancele uma aula futura com regra de 2 horas.", "cancel"),
    createStudentAgendaNavCard("refresh", "Reposições disponíveis", `${makeupAvailable} disponíveis para reagendar.`, "makeups"),
    createStudentAgendaNavCard("message", "Solicitar reagendamento", `${makeupRequested} solicitadas em andamento.`, "reschedule"),
    createStudentAgendaNavCard("history", "Histórico", "Aulas, cancelamentos e reposições.", "history"),
  );

  const detail = document.createElement("div");
  detail.className = "package-expand-panel";
  detail.dataset.studentPackageDetail = "true";
  detail.hidden = true;

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

function getStudentAgendaIconSvg(icon) {
  const icons = {
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>',
    "calendar-x": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="m9.5 14.5 5 5M14.5 14.5l-5 5"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 0 1-13.7 5.6"/><path d="M4 12A8 8 0 0 1 17.7 6.4"/><path d="M7 18H4v-3M17 6h3v3"/></svg>',
    message: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M8 10h8M8 13h5"/></svg>',
    history: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 7v5l3 2"/></svg>',
  };
  return icons[icon] || icons.calendar;
}

function createStudentAgendaNavCard(icon, title, description, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nav-card";
  button.dataset.studentPackageAction = action;

  const iconNode = document.createElement("span");
  iconNode.className = "nav-card-icon";
  iconNode.innerHTML = getStudentAgendaIconSvg(icon);
  const titleNode = document.createElement("strong");
  titleNode.textContent = title;
  const descNode = document.createElement("small");
  descNode.textContent = description;
  const open = document.createElement("em");
  open.textContent = "Abrir";

  button.append(iconNode, titleNode, descNode, open);
  return button;
}

function createStudentLessonCard(lesson, classPackage, mode = "view") {
  const item = document.createElement("article");
  item.className = "package-lesson";
  const info = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = lesson.date;
  const detail = document.createElement("small");
  detail.textContent = `${lesson.time || "-"} | ${classPackage.name || "Aula"} | Local: Studio Joao Victor`;
  const status = document.createElement("small");
  const existingRecord = getLessonRecord(classPackage.id, lesson.dateKey);
  status.textContent = `Status: ${existingRecord ? getCheckinStatusLabel(existingRecord) : "Agendada"}`;
  info.append(title, detail, status);

  const actions = document.createElement("div");
  actions.className = "student-actions";
  if (existingRecord) {
    const badge = document.createElement("span");
    badge.className = existingRecord.status === "cancelada-fora-prazo" || existingRecord.status === "desmarcada-sem-reposicao" ? "status-danger" : "status-ok";
    badge.textContent = getCheckinStatusLabel(existingRecord);
    actions.appendChild(badge);
  } else {
    const detailButton = document.createElement("button");
    detailButton.type = "button";
    detailButton.className = "secondary";
    detailButton.textContent = "Ver detalhes";
    detailButton.addEventListener("click", () => window.alert(`${lesson.date} as ${lesson.time}\\n${classPackage.name}\\nLocal: Studio Joao Victor`));
    actions.appendChild(detailButton);

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = mode === "cancel" ? "primary" : "secondary";
    cancel.dataset.cancelLesson = classPackage.id;
    cancel.dataset.lessonDate = lesson.dateKey;
    cancel.textContent = mode === "cancel" ? "Selecionar aula" : "Cancelar aula";
    actions.appendChild(cancel);
  }

  item.append(info, actions);
  return item;
}

function appendStudentAgendaBack(detail) {
  const back = document.createElement("button");
  back.type = "button";
  back.className = "secondary package-page-back";
  back.dataset.studentPackageAction = "menu";
  back.textContent = "Voltar para agenda";
  detail.appendChild(back);
}

function renderStudentCancelConfirmation(classPackage, lesson) {
  const detail = studentPackagePanel?.querySelector("[data-student-package-detail]");
  if (!detail || !classPackage || !lesson) return;
  const cancellation = getCancellationStatus(lesson);
  const hasMakeup = cancellation.status === "cancelada-no-prazo";
  detail.innerHTML = "";
  appendStudentAgendaBack(detail);

  const card = document.createElement("article");
  card.className = "package-card";
  const title = document.createElement("strong");
  title.textContent = "Cancelar aula";
  const step = document.createElement("span");
  step.textContent = "Passo 2: confirmar cancelamento";
  card.append(title, step);

  const summary = document.createElement("div");
  summary.className = "lesson-balance-grid";
  [
    ["Modalidade", classPackage.name || "Aula"],
    ["Data", lesson.date],
    ["Horário", lesson.time],
    ["Local", "Studio Joao Victor"],
  ].forEach(([label, value]) => summary.appendChild(createAdminMetric(label, value)));

  const notice = document.createElement("small");
  notice.textContent = "Se o cancelamento for feito com mais de 2 horas de antecedência, você terá direito a uma reposição.";

  const result = document.createElement("span");
  result.className = hasMakeup ? "status-ok" : "status-danger";
  result.textContent = hasMakeup
    ? "Você terá direito a 1 reposição."
    : "Você não terá direito a reposição, pois está fora do prazo mínimo de 2 horas.";

  const actions = document.createElement("div");
  actions.className = "student-actions";
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = "primary";
  confirm.dataset.confirmCancelLesson = classPackage.id;
  confirm.dataset.lessonDate = lesson.dateKey;
  confirm.textContent = "Cancelar agora";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "secondary";
  back.dataset.studentPackageAction = "cancel";
  back.textContent = "Voltar";
  actions.append(confirm, back);

  card.append(summary, notice, result, actions);
  detail.appendChild(card);
}

function renderStudentCancelSuccess(result) {
  const detail = studentPackagePanel?.querySelector("[data-student-package-detail]");
  if (!detail) return;
  detail.innerHTML = "";
  appendStudentAgendaBack(detail);

  const card = document.createElement("article");
  card.className = "package-card";
  const title = document.createElement("strong");
  title.textContent = result?.generated
    ? "Cancelamento realizado. Você ganhou 1 aula de reposição."
    : "Cancelamento realizado. Esta aula não gerou reposição.";
  card.appendChild(title);

  if (result?.credit) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary";
    button.dataset.studentRequestMakeup = result.credit.id;
    button.textContent = "Solicitar reagendamento pelo WhatsApp";
    card.appendChild(button);
  }

  detail.appendChild(card);
}

function createStudentMakeupCard(credit) {
  const card = document.createElement("article");
  card.className = "checkin-history-card";
  card.classList.toggle("cancel-late", credit.status === "expired" || credit.status === "rejected");
  card.classList.toggle("cancel-ok", ["available", "requested", "approved", "used", "personal-pending"].includes(credit.status));

  const title = document.createElement("strong");
  title.textContent = credit.status === "personal-pending"
    ? "Sua aula precisou ser remarcada pelo personal."
    : `Aula original: ${credit.sourceLessonDate} às ${credit.lessonTime || "-"}`;
  const detail = document.createElement("span");
  detail.textContent = credit.status === "personal-pending"
    ? `Aula original: ${credit.sourceLessonDate} às ${credit.lessonTime || "-"} | Esta aula não será descontada do seu pacote.`
    : `Validade: ${credit.validUntil || "-"} | Status: ${getMakeupDisplayStatus(credit)}`;
  card.append(title, detail);

  if (credit.status === "available" || credit.status === "personal-pending") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary";
    button.dataset.studentRequestMakeup = credit.id;
    button.textContent = credit.status === "personal-pending" ? "Solicitar novo horário" : "Solicitar reagendamento";
    card.appendChild(button);
  }

  return card;
}

function renderStudentMakeupList(container, studentName) {
  const credits = getStudentMakeupCredits(studentName);
  const counts = {
    available: credits.filter((item) => item.status === "available").length,
    requested: credits.filter((item) => item.status === "requested").length,
    approved: credits.filter((item) => item.status === "approved").length,
    expired: credits.filter((item) => item.status === "expired").length,
    personalPending: credits.filter((item) => item.status === "personal-pending").length,
  };

  const summary = document.createElement("article");
  summary.className = "package-card";
  summary.innerHTML = `<strong>Reposições/Reagendamentos</strong><span>Você tem ${counts.available} aula(s) para reagendar.</span>`;
  const grid = document.createElement("div");
  grid.className = "lesson-balance-grid";
  [
    ["Disponíveis", counts.available],
    ["Solicitadas", counts.requested],
    ["Aprovadas", counts.approved],
    ["Expiradas", counts.expired],
    ["Remarcações", counts.personalPending],
  ].forEach(([label, value]) => grid.appendChild(createAdminMetric(label, value)));
  summary.appendChild(grid);
  container.appendChild(summary);

  const list = document.createElement("div");
  list.className = "load-history-list";
  credits
    .sort((a, b) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0))
    .forEach((credit) => list.appendChild(createStudentMakeupCard(credit)));
  if (!credits.length) {
    list.textContent = "Nenhuma reposição registrada.";
  }
  container.appendChild(list);
}

function renderStudentPackageDetail(action) {
  const detail = studentPackagePanel?.querySelector("[data-student-package-detail]");
  const menu = studentPackagePanel?.querySelector("[data-student-agenda-menu]");
  const studentName = workoutViewStudent?.value;
  const activePackage = getActivePackage(studentName);
  if (!detail || !activePackage) return;

  const schedule = generatePackageSchedule(activePackage);
  const packageRecords = loadCheckins().filter((checkin) => checkin.packageId === activePackage.id);
  const checkins = packageRecords.filter(isConsumedLesson);
  const status = getPackageStatus(activePackage);
  const todayKey = getDateKey();
  detail.innerHTML = "";

  if (action === "menu") {
    detail.hidden = true;
    if (menu) menu.hidden = false;
    return;
  }

  if (menu) menu.hidden = true;
  detail.hidden = false;

  if (action === "details") {
    appendStudentAgendaBack(detail);
    detail.appendChild(createPackageSummaryCard(activePackage));
    return;
  }

  if (action === "lessons" || action === "cancel" || action === "next") {
    appendStudentAgendaBack(detail);
    const heading = document.createElement("article");
    heading.className = "package-card";
    heading.innerHTML = action === "cancel"
      ? "<strong>Cancelar aula</strong><span>Passo 1: escolha a aula que deseja cancelar.</span>"
      : "<strong>Minhas aulas</strong><span>Próximas aulas agendadas.</span>";
    detail.appendChild(heading);

    const list = document.createElement("div");
    list.className = "package-lesson-list";
    schedule
      .filter((lesson) => lesson.dateKey >= todayKey)
      .slice(0, 6)
      .forEach((lesson) => {
        list.appendChild(createStudentLessonCard(lesson, activePackage, action === "cancel" ? "cancel" : "view"));
      });
    if (!list.children.length) list.textContent = "Nenhuma aula futura encontrada.";
    detail.appendChild(list);
    return;
  }

  if (action === "makeups" || action === "reschedule") {
    appendStudentAgendaBack(detail);
    const heading = document.createElement("article");
    heading.className = "package-card";
    heading.innerHTML = action === "reschedule"
      ? "<strong>Solicitar reagendamento</strong><span>Use o WhatsApp para combinar um novo horário com o Personal.</span>"
      : "<strong>Reposições disponíveis</strong><span>Acompanhe validade e status das suas reposições.</span>";
    detail.appendChild(heading);
    renderStudentMakeupList(detail, studentName);
    return;
  }

  if (action === "history") {
    appendStudentAgendaBack(detail);
    const unifiedHistory = getUnifiedLessonHistory(studentName);
    renderStudentMakeupList(detail, studentName);
    if (!unifiedHistory.length) {
      return;
    }
    unifiedHistory.slice(0, 20).forEach((entry) => detail.appendChild(createLessonHistoryItem(entry)));
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

function getCurrentWorkoutForStudent(studentIdentifier) {
  const student = findStudentByIdentifier(studentIdentifier) || loadStudents().find((item) => item.name === studentIdentifier);
  const studentName = student?.name || String(studentIdentifier || "");
  if (!studentName) return null;

  const studentWorkouts = loadWorkouts()?.[studentName] || [];
  const activeWorkouts = studentWorkouts.filter((workout) => getWorkoutPeriodStatus(workout).state === "active");
  const activeWorkoutId = activeWorkoutByStudent[studentName] || activeWorkouts[0]?.id;
  return activeWorkouts.find((workout) => workout.id === activeWorkoutId) || activeWorkouts[0] || null;
}

function getCurrentStudentWorkout(studentName) {
  const studentWorkouts = loadWorkouts()?.[studentName] || [];
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

function getStudentBirthDateInputValue(student = {}) {
  const rawDate = student.birthDate || student.birthdate || student.birth || "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
  const parsedDate = parseDateLike(rawDate);
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) return "";
  return parsedDate.toISOString().slice(0, 10);
}

function createStudentDataPanel(student) {
  const section = document.createElement("section");
  section.className = "account-security-card student-data-card";

  const title = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Meus dados";
  const heading = document.createElement("h3");
  heading.textContent = "Dados de acesso";
  title.append(eyebrow, heading);
  section.appendChild(title);

  if (currentSupabaseProfile?.first_login) {
    const notice = document.createElement("div");
    notice.className = "temporary-password-notice";
    notice.innerHTML = "<strong>Você está utilizando uma senha temporária.</strong><span>Sua senha inicial corresponde a jv + os últimos 4 números do WhatsApp cadastrado. Recomendamos alterar sua senha.</span>";
    section.appendChild(notice);
  }

  const form = document.createElement("form");
  form.id = "student-profile-data-form";
  form.className = "account-security-form student-data-form";
  const emailValue = student.email_login || student.email || currentSupabaseUser?.email || "";
  form.innerHTML = `
    <label>Nome completo
      <input type="text" name="fullName" value="${escapeHtml(student.name || "")}" readonly />
    </label>
    <label>E-mail
      <input type="email" name="email" value="${escapeHtml(emailValue)}" autocomplete="email" />
    </label>
    <label>Celular/WhatsApp
      <input type="tel" name="phone" value="${escapeHtml(student.phone || student.whatsapp || "")}" autocomplete="tel" />
    </label>
    <label>Data de nascimento
      <input type="date" name="birthDate" value="${escapeHtml(getStudentBirthDateInputValue(student))}" />
    </label>
    <label>Nova senha
      <input type="password" name="newPassword" autocomplete="new-password" minlength="6" placeholder="Mínimo 6 caracteres" />
    </label>
    <label>Confirmar nova senha
      <input type="password" name="confirmPassword" autocomplete="new-password" minlength="6" placeholder="Repita a nova senha" />
    </label>
    <button type="submit" class="primary">Salvar alterações</button>
    <p class="save-message" data-profile-message></p>
  `;
  section.appendChild(form);
  return section;
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
    createProfileMetric("Treinos da ficha", workout?.sessions?.length || "0", workout?.frequency || "Frequência não informada"),
    createProfileMetric("Início do plano", workout?.startDate || "-", "Data de início"),
    createProfileMetric("Vencimento", workout?.dueDate || "-", expiration?.detail || "Sem validade"),
    createProfileMetric("Status da ficha", expiration?.label || "Sem ficha", workout?.title || ""),
    createProfileMetric("Última avaliação", latestAssessment?.date || "Sem avaliação", latestAssessment ? `${latestAssessment.weight} | ${latestAssessment.fat}` : "Bioimpedância não registrada"),
    createProfileMetric("Progresso de carga", recentProgress.title, recentProgress.detail),
  );

  studentProfilePanel.append(hero, grid);
  if (currentUserType === "student") {
    studentProfilePanel.appendChild(createStudentDataPanel(student));
  }
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
  if (modalityInput) modalityInput.value = "presencial";
  if (studentStartDateInput) studentStartDateInput.value = formatToday();
  if (frequencyInput) frequencyInput.value = "3x";
  setSelectedBillingDays([]);
  renderStudentWeeklySchedule({});
  renderStudentFormTrainingDaysWarning(false);
  if (makeupLimitInput) makeupLimitInput.value = "3";
  if (billingTypeInput) billingTypeInput.value = "fixed";
  if (classValueInput) classValueInput.value = "";
  if (valueInput) {
    valueInput.readOnly = false;
    valueInput.classList.remove("readonly-field");
    valueInput.setAttribute("aria-readonly", "false");
  }
  if (paymentMethodInput) paymentMethodInput.value = "";
  if (studentBillingNotesInput) studentBillingNotesInput.value = "";
  editingStudentIndex = null;
  safeSetText(saveStudentButton, "Salvar aluno");
  if (createStudentAccessButton) createStudentAccessButton.hidden = true;
  if (cancelEditButton) cancelEditButton.hidden = true;
  renderStudentPackagePreview();
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
  if (modalityInput) modalityInput.value = student.modality || "presencial";
  if (studentStartDateInput) studentStartDateInput.value = student.startDate || formatToday();
  if (frequencyInput) frequencyInput.value = normalizeWeeklyFrequency(student.frequency);
  setSelectedBillingDays(student.billingDays);
  renderStudentWeeklySchedule(student.weeklySchedule || {});
  renderStudentFormTrainingDaysWarning(!normalizeBillingDays(student.billingDays).length);
  if (makeupLimitInput) makeupLimitInput.value = normalizeMakeupLimit(student.makeupLimit, student.frequency);
  if (billingTypeInput) billingTypeInput.value = normalizeBillingType(student.billingType);
  if (classValueInput) classValueInput.value = student.classValue || "";
  valueInput.value = student.value;
  updateStudentMonthlyValueFromBilling();
  dueInput.value = student.due;
  if (paymentMethodInput) paymentMethodInput.value = student.paymentMethod || "";
  paymentInput.value = student.payment;
  if (studentBillingNotesInput) studentBillingNotesInput.value = student.billingNotes || "";
  renderStudentPackagePreview();
  saveStudentButton.textContent = "Salvar alteracao";
  if (createStudentAccessButton) createStudentAccessButton.hidden = hasStudentAppAccess(student);
  cancelEditButton.hidden = false;
  nameInput.focus();
  showMessage(message);
  return true;
}

function startEditingStudentByIdentifier(identifier, message) {
  const index = loadStudents().findIndex((student) => student.id === identifier || student.name === identifier || student.email === identifier);
  if (index < 0) return false;
  openAdminModule("students");
  openAdminSubpage("students-register");
  return startEditingStudent(index, message);
}

studentForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  updateStudentMonthlyValueFromBilling();

  const students = loadStudents();
  const previousName = editingStudentIndex === null ? "" : students[editingStudentIndex]?.name;
  let student = {
    id: editingStudentIndex === null ? createId() : students[editingStudentIndex]?.id || createId(),
    supabaseUserId: students[editingStudentIndex]?.supabaseUserId || "",
    authUserId: students[editingStudentIndex]?.authUserId || students[editingStudentIndex]?.supabaseUserId || "",
    auth_user_id: students[editingStudentIndex]?.auth_user_id || students[editingStudentIndex]?.authUserId || students[editingStudentIndex]?.supabaseUserId || "",
    name: nameInput.value.trim(),
    email: emailInput?.value.trim().toLowerCase() || "",
    email_login: students[editingStudentIndex]?.email_login || emailInput?.value.trim().toLowerCase() || "",
    role: students[editingStudentIndex]?.role || "aluno",
    phone: phoneInput?.value.trim() || "",
    birthDate: birthDateInput?.value.trim() || "",
    plan: planInput.value.trim(),
    modality: modalityInput?.value || "presencial",
    startDate: studentStartDateInput?.value.trim() || formatToday(),
    frequency: frequencyInput?.value || "3x",
    billingDays: getSelectedBillingDays(),
    weeklySchedule: getWeeklyScheduleFromForm(),
    billingType: billingTypeInput?.value || "fixed",
    classValue: classValueInput?.value.trim() || "",
    paymentMethod: paymentMethodInput?.value.trim() || "",
    billingNotes: studentBillingNotesInput?.value.trim() || "",
    makeupLimit: normalizeMakeupLimit(makeupLimitInput?.value, frequencyInput?.value || "3x"),
    value: valueInput.value.trim(),
    due: dueInput.value.trim(),
    payment: paymentInput.value,
  };

  const duplicateName = students.some((item, index) => item.name.toLowerCase() === student.name.toLowerCase() && index !== editingStudentIndex);
  if (duplicateName) {
    showMessage("Já existe um aluno com este nome. Use um nome diferente para evitar misturar históricos.", "error");
    nameInput.focus();
    return;
  }

  const missingTrainingDays = !normalizeBillingDays(student.billingDays).length;
  renderStudentFormTrainingDaysWarning(missingTrainingDays);
  if (isPresentialStudent(student) && missingTrainingDays) {
    showMessage("Aluno presencial precisa ter dias de treino cadastrados para criar pacote e agenda automaticamente.", "error");
    return;
  }
  const invalidScheduleDays = getInvalidScheduleDays(student.weeklySchedule, student.billingDays);
  if (isPresentialStudent(student) && invalidScheduleDays.length) {
    showMessage(`Horário inválido em: ${invalidScheduleDays.map(getWeekdayName).join(", ")}. Use horários entre 00:00 e 23:59.`, "error");
    renderStudentWeeklySchedule(student.weeklySchedule);
    return;
  }
  const missingScheduleDays = getMissingScheduleDays(student.weeklySchedule, student.billingDays);
  if (isPresentialStudent(student) && missingScheduleDays.length) {
    showMessage(`Horario pendente: informe o horario de ${missingScheduleDays.map(getWeekdayName).join(", ")} antes de salvar.`, "error");
    renderStudentWeeklySchedule(student.weeklySchedule);
    return;
  }

  let accessResult = null;
  if (!hasStudentAppAccess(student)) {
    accessResult = await createStudentAccessForRecord(student);
    if (accessResult.created) {
      student = accessResult.student;
    } else {
      console.error("Aluno salvo sem acesso ao aplicativo.", {
        aluno: student.name,
        email: student.email,
        erro: accessResult.error,
      });
    }
  }

  if (editingStudentIndex === null) {
    students.push(student);
  } else {
    students[editingStudentIndex] = student;
  }

  let automaticPackage = null;
  let agendaResult = null;
  let supabaseSyncResult = null;

  try {
    saveStudents(students);

    if (previousName && previousName !== student.name) {
      syncStudentNameReferences(previousName, student.name);
    }

    if (isPresentialStudent(student)) {
      automaticPackage = upsertAutomaticMonthlyPackageForStudent(student);
      if (!automaticPackage?.id) {
        throw new Error("pacote automático não foi criado. Verifique data de início, dias da semana, frequência e valores do aluno.");
      }

      agendaResult = syncAutomaticPackageAgendaEvents(student, automaticPackage);
      if (!agendaResult?.ok) {
        throw new Error(`agenda não foi gerada: ${getStepErrorMessage(agendaResult?.error)}`);
      }

      const packageAgendaCount = loadAgendaEvents().filter((event) =>
        event.packageId === automaticPackage.id
        && ((student.id && event.studentId === student.id) || event.studentName === student.name)
        && !String(event.status || "").toLowerCase().includes("cancel")
      ).length;
      if (packageAgendaCount < Number(automaticPackage.total || 0)) {
        throw new Error(`agenda incompleta: ${packageAgendaCount}/${automaticPackage.total} aulas vinculadas ao pacote.`);
      }
    }

    supabaseSyncResult = await flushAppStateSyncNow("cadastro de aluno, pacote e agenda");
    if (!supabaseSyncResult?.ok) {
      const syncErrorMessage = getStepErrorMessage(supabaseSyncResult?.error);
      markStudentsSyncStatus([student.id], "pending", syncErrorMessage);
      console.error("Aluno/pacote/agenda salvos localmente, mas Supabase falhou.", {
        aluno: student.name,
        pacote: automaticPackage,
        agenda: agendaResult,
        supabase: supabaseSyncResult?.error,
      });
      showMessage(`Nao sincronizado. Aluno${automaticPackage ? ", pacote e aulas" : ""} ficaram no localStorage e aguardam nova tentativa. Supabase falhou: ${syncErrorMessage}.`, "error");
      return;
    }
  } catch (error) {
    console.error("Falha no fluxo de cadastro do aluno.", {
      aluno: student,
      etapa: automaticPackage ? "agenda" : "pacote",
      pacote: automaticPackage,
      agenda: agendaResult,
      erro: error,
    });
    showMessage(`Aluno salvo, mas falhou na etapa ${automaticPackage ? "agenda" : "pacote"}: ${getStepErrorMessage(error)}`, "error");
    return;
  }

  renderStudents();
  fillStudentSelects();
  fillManualCheckinPackageSelect();
  fillMakeupPackageSelect();
  renderPackageAdminList();
  renderStudentPackagePanel();
  renderAdminAgenda();
  renderBillingList();
  if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
  if (accessResult?.created) {
    const successMessage = automaticPackage
      ? `Salvo no Supabase.\n\nAluno, pacote e aulas criados com sucesso.\n\nEmail: ${student.email_login || student.email}\nSenha temporária: ${accessResult.temporaryPassword}`
      : `Salvo no Supabase.\n\nAluno cadastrado e acesso criado com sucesso.\n\nEmail: ${student.email_login || student.email}\nSenha temporária: ${accessResult.temporaryPassword}`;
    showMessage(successMessage);
    if (accessResult.profileCreated === false) {
      console.warn("Profile do aluno nao foi salvo, mas o acesso Auth foi criado e o aluno foi vinculado localmente.", {
        aluno: student.name,
        email: student.email_login || student.email,
        auth_user_id: getStudentAuthUserId(student),
        erro: accessResult.profileError,
        observacao: "Se quiser usar profiles como fonte de permissao, ajuste as policies/RLS ou crie trigger no Supabase. O app tambem localiza aluno por auth_user_id/email no app_state.",
      });
    }
  } else if (accessResult?.alreadyExists) {
    showMessage("Este e-mail já possui acesso. A senha existente não foi alterada.", "error");
  } else if (accessResult?.error) {
    showMessage(`Aluno salvo, mas o acesso ao aplicativo não foi criado: ${accessResult.error.message}`, "error");
  } else {
    showMessage(automaticPackage
      ? "Salvo no Supabase. Aluno, pacote e aulas criados com sucesso."
      : "Salvo no Supabase. Aluno atualizado com sucesso. Login existente mantido.");
  }
  resetStudentForm();
});

async function createStudentTemporaryAccessFromForm() {
  const name = nameInput?.value.trim() || "";
  const email = emailInput?.value.trim().toLowerCase() || "";
  updateStudentMonthlyValueFromBilling();

  if (!name || !isLikelyRealEmail(email)) {
    showMessage("Informe um e-mail real para criar o acesso do aluno.", "error");
    emailInput?.focus();
    return;
  }

  const students = loadStudents();
  const existingIndex = editingStudentIndex !== null
    ? editingStudentIndex
    : students.findIndex((student) => student.name.toLowerCase() === name.toLowerCase() || student.email === email || student.email_login === email);
  const baseStudent = existingIndex >= 0 ? students[existingIndex] : {
    id: createId(),
    name,
    email,
    phone: phoneInput?.value.trim() || "",
    plan: planInput?.value.trim() || "Plano nao informado",
  };
  const temporaryPassword = getTemporaryStudentPassword({
    ...baseStudent,
    phone: phoneInput?.value.trim() || baseStudent.phone || "",
  });

  createStudentAccessButton.disabled = true;
  safeSetText(createStudentAccessButton, "Criando acesso...");

  const authResult = await createStudentAuthUser(email, temporaryPassword, name);
  const { userId, error } = authResult;
  const alreadyExists = Boolean(authResult?.alreadyExists);
  let authUserId = userId;

  if (alreadyExists) {
    showMessage("Este e-mail já possui acesso. A senha existente não foi alterada.", "error");
    createStudentAccessButton.disabled = false;
    safeSetText(createStudentAccessButton, "Criar acesso do aluno");
    return;
  }

  if (error) {
    console.error("Erro detalhado ao criar usuario do aluno.", { email, aluno: name, erro: error });
    showMessage(`Nao foi possivel criar o acesso: ${error?.message || "erro desconhecido"}.`, "error");
    createStudentAccessButton.disabled = false;
    safeSetText(createStudentAccessButton, "Criar acesso do aluno");
    return;
  }

  if (!authUserId || !authResult?.loginVerified) {
    showMessage("Acesso nao criado: o teste de login com a senha temporaria nao foi confirmado.", "error");
    createStudentAccessButton.disabled = false;
    safeSetText(createStudentAccessButton, "Criar acesso do aluno");
    return;
  }

  const linkedStudent = {
    ...baseStudent,
    id: baseStudent.id || createId(),
    supabaseUserId: authUserId,
    authUserId: authUserId,
    auth_user_id: authUserId,
    email_login: email,
    role: "aluno",
    acesso_status: "ativo",
    first_login: true,
    name,
    email,
    phone: phoneInput?.value.trim() || baseStudent.phone || "",
    birthDate: birthDateInput?.value.trim() || baseStudent.birthDate || "",
    plan: planInput?.value.trim() || baseStudent.plan || "Plano nao informado",
    modality: modalityInput?.value || baseStudent.modality || "presencial",
    startDate: studentStartDateInput?.value.trim() || baseStudent.startDate || formatToday(),
    frequency: frequencyInput?.value || baseStudent.frequency || "3x",
    billingDays: getSelectedBillingDays().length ? getSelectedBillingDays() : baseStudent.billingDays || [],
    weeklySchedule: getSelectedBillingDays().length ? getWeeklyScheduleFromForm() : baseStudent.weeklySchedule || {},
    billingType: billingTypeInput?.value || baseStudent.billingType || "fixed",
    classValue: classValueInput?.value.trim() || baseStudent.classValue || "",
    makeupLimit: normalizeMakeupLimit(makeupLimitInput?.value || baseStudent.makeupLimit, frequencyInput?.value || baseStudent.frequency || "3x"),
    value: valueInput?.value.trim() || baseStudent.value || "",
    due: dueInput?.value.trim() || baseStudent.due || "",
    payment: paymentInput?.value || baseStudent.payment || "Em dia",
  };

  const profileResult = await upsertSupabaseProfile({
    auth_user_id: authUserId,
    email,
    role: "aluno",
    student_id: linkedStudent.id,
    name,
    first_login: true,
  });

  if (profileResult.error) {
    console.warn("Acesso Auth criado, mas profile nao foi salvo. O login segue valido pelo auth_user_id salvo no aluno.", {
      email,
      auth_user_id: authUserId,
      erro: profileResult.error,
      observacao: "Ajuste policies/RLS ou trigger de profiles se quiser manter essa tabela sincronizada.",
    });
  }

  if (existingIndex >= 0) {
    students[existingIndex] = { ...students[existingIndex], ...linkedStudent };
    editingStudentIndex = existingIndex;
  } else {
    students.push(linkedStudent);
    editingStudentIndex = students.length - 1;
  }

  saveStudents(students);
  const accessSync = await supabaseSyncPromise;
  if (!accessSync?.ok) {
    showMessage("Nao sincronizado. Acesso criado no Auth, mas o vinculo do aluno ficou pendente no app_state.", "error");
    createStudentAccessButton.disabled = false;
    safeSetText(createStudentAccessButton, "Criar acesso do aluno");
    return;
  }
  renderStudents();
  fillStudentSelects();
  if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
  showMessage(`Acesso criado com sucesso.\n\nEmail: ${email}\nSenha temporária: ${temporaryPassword}\n\nVocê pode enviar essas informações ao aluno.`);
  console.info("Acesso do aluno criado.", {
    email,
    auth_user_id: authUserId,
    profile: profileResult.data,
    senhaTemporariaGeradaPorWhatsApp: "gerada_e_exibida_apenas_na_mensagem_de_sucesso",
  });
  createStudentAccessButton.disabled = false;
  safeSetText(createStudentAccessButton, "Criar acesso do aluno");
  createStudentAccessButton.hidden = true;
}

createStudentAccessButton?.addEventListener("click", createStudentTemporaryAccessFromForm);
if (createStudentAccessButton) createStudentAccessButton.hidden = true;

workoutForm?.addEventListener("submit", async (event) => {
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
  saveNavigationState();
  await supabaseSyncPromise;
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
  const photos = {
    front: await readOptionalAssessmentFile("assessment-photo-front"),
    side: await readOptionalAssessmentFile("assessment-photo-side"),
    back: await readOptionalAssessmentFile("assessment-photo-back"),
    bio: await readOptionalAssessmentFile("assessment-photo-bio"),
  };
  const assessments = loadAssessments();
  updateAssessmentOpinion();
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
    ...getAssessmentExtraPayload(),
    attachment,
    photos,
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
  await supabaseSyncPromise;
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
  saveNavigationState();
  renderCurrentWorkout();
});

currentWorkout?.addEventListener("click", async (event) => {
  const sessionTab = event.target.closest("[data-session-tab]");
  if (sessionTab) {
    activeSessionByWorkout[activeWorkoutByStudent[workoutViewStudent.value]] = sessionTab.dataset.sessionTab;
    saveNavigationState();
    renderCurrentWorkout();
    return;
  }

  const skipFeedbackButton = event.target.closest("[data-skip-feedback]");
  if (skipFeedbackButton) {
    const form = skipFeedbackButton.closest(".workout-feedback-form");
    if (form) {
      const feedbacks = loadWorkoutFeedbacks();
      feedbacks.push({
        id: createId(),
        studentName: form.dataset.studentName,
        studentId: getStudentIdByName(form.dataset.studentName),
        workoutId: form.dataset.workoutId,
        workoutTitle: form.dataset.workoutTitle,
        sessionId: form.dataset.sessionId || "",
        sessionTitle: form.dataset.sessionTitle || "",
        rating: "",
        difficulty: "Sem feedback",
        pain: false,
        painLocation: "",
        note: "",
        skipped: true,
        status: "sem_feedback",
        date: formatToday(),
        timestamp: Date.now(),
      });
      saveWorkoutFeedbacks(feedbacks);
      await supabaseSyncPromise;
      const completedWorkout = (loadWorkouts()[form.dataset.studentName] || []).find((item) => item.id === form.dataset.workoutId);
      if (completedWorkout) activeSessionByWorkout[completedWorkout.id] = getNextSessionIdAfterCompletion(completedWorkout, form.dataset.sessionId);
      saveNavigationState();
      form.innerHTML = "<strong>Treino finalizado.</strong><small>Feedback pulado. Suas cargas salvas continuam no histórico.</small>";
      renderAdminEvolution();
      renderStudentProfile();
    }
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
    sessionId: form.dataset.sessionId || "",
    sessionTitle: form.dataset.sessionTitle || "",
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
  await supabaseSyncPromise;
  loadInput.value = "";
  noteInput.value = "";
  renderCurrentWorkout();
  renderStudentProfile();
});

currentWorkout?.addEventListener("submit", async (event) => {
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
    sessionId: form.dataset.sessionId || "",
    sessionTitle: form.dataset.sessionTitle || "",
    rating: form.querySelector('[name="rating"]:checked')?.value || "",
    difficulty: form.querySelector('[name="difficulty"]:checked')?.value || "",
    pain,
    painLocation: pain ? form.querySelector('[name="painLocation"]')?.value.trim() || "" : "",
    note: form.querySelector('[name="note"]')?.value.trim() || "",
    date: formatToday(),
    timestamp: Date.now(),
  });
  saveWorkoutFeedbacks(feedbacks);
  await supabaseSyncPromise;
  const completedWorkout = (loadWorkouts()[form.dataset.studentName] || []).find((item) => item.id === form.dataset.workoutId);
  if (completedWorkout) activeSessionByWorkout[completedWorkout.id] = getNextSessionIdAfterCompletion(completedWorkout, form.dataset.sessionId);
  saveNavigationState();
  form.innerHTML = "<strong>Treino finalizado.</strong><small>Feedback enviado para o Personal.</small>";
  renderAdminEvolution();
  renderStudentProfile();
});

studentProfilePanel?.addEventListener("submit", async (event) => {
  const form = event.target.closest("#student-profile-data-form");
  if (!form) return;

  event.preventDefault();
  const message = form.querySelector("[data-profile-message]");
  const setProfileMessage = (text, isError = false) => {
    if (!message) return;
    message.textContent = text;
    message.classList.toggle("error", isError);
  };

  if (currentUserType !== "student") {
    setProfileMessage("Somente o aluno logado pode editar estes dados.", true);
    return;
  }

  const students = loadStudents();
  const currentStudent = findStudentByIdentifier(selectedStudentProfile);
  const studentIndex = students.findIndex((student) => student.id === currentStudent?.id || student.name === currentStudent?.name);
  if (!currentStudent || studentIndex < 0) {
    setProfileMessage("Aluno logado não foi encontrado.", true);
    return;
  }

  const authId = getStudentAuthUserId(currentStudent);
  if (currentSupabaseUser?.id && authId && currentSupabaseUser.id !== authId) {
    setProfileMessage("Este login não pode editar outro aluno.", true);
    return;
  }
  if (currentSupabaseProfile?.student_id && currentStudent.id && String(currentSupabaseProfile.student_id) !== String(currentStudent.id)) {
    setProfileMessage("Este login não pode editar outro aluno.", true);
    return;
  }

  const client = getSupabaseClient();
  const nextEmail = String(form.elements.email?.value || "").trim().toLowerCase();
  const nextPhone = String(form.elements.phone?.value || "").trim();
  const nextBirthDate = String(form.elements.birthDate?.value || "").trim();
  const newPassword = form.elements.newPassword?.value || "";
  const confirmPassword = form.elements.confirmPassword?.value || "";
  const emailChanged = nextEmail && nextEmail !== String(currentStudent.email_login || currentStudent.email || currentSupabaseUser?.email || "").toLowerCase();
  const passwordRequested = Boolean(newPassword || confirmPassword);
  let passwordChanged = false;
  let emailConfirmationNotice = "";

  if (nextEmail && !isLikelyRealEmail(nextEmail)) {
    setProfileMessage("Informe um e-mail válido para salvar.", true);
    return;
  }

  if (passwordRequested) {
    if (!newPassword || !confirmPassword) {
      setProfileMessage("Preencha a nova senha e a confirmação.", true);
      return;
    }
    if (newPassword.length < 6) {
      setProfileMessage("A senha deve ter pelo menos 6 caracteres.", true);
      return;
    }
    if (newPassword !== confirmPassword) {
      setProfileMessage("As senhas não conferem.", true);
      return;
    }
    if (!client || !currentSupabaseUser) {
      setProfileMessage("Entre com login real para alterar a senha.", true);
      return;
    }

    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) {
      console.error("Erro ao alterar senha do aluno.", error);
      setProfileMessage("Não foi possível alterar a senha agora.", true);
      return;
    }
    passwordChanged = true;
  }

  if (emailChanged && client && currentSupabaseUser) {
    const { data, error } = await client.auth.updateUser({ email: nextEmail });
    if (error) {
      console.error("Erro ao alterar e-mail do aluno.", error);
      setProfileMessage("Não foi possível alterar o e-mail agora.", true);
      return;
    }
    if (data?.user) currentSupabaseUser = data.user;
    if (data?.user?.email && data.user.email.toLowerCase() !== nextEmail) {
      emailConfirmationNotice = " Verifique seu e-mail para confirmar a alteração.";
    }
  }

  const updatedStudent = {
    ...students[studentIndex],
    email: nextEmail || students[studentIndex].email || "",
    email_login: nextEmail || students[studentIndex].email_login || "",
    phone: nextPhone,
    whatsapp: nextPhone,
    birthDate: nextBirthDate,
    auth_user_id: students[studentIndex].auth_user_id || currentSupabaseUser?.id || "",
    authUserId: students[studentIndex].authUserId || currentSupabaseUser?.id || "",
    supabaseUserId: students[studentIndex].supabaseUserId || currentSupabaseUser?.id || "",
    role: students[studentIndex].role || "aluno",
  };
  students[studentIndex] = updatedStudent;
  saveStudents(students);
  const profileSync = await supabaseSyncPromise;
  if (!profileSync?.ok) {
    setProfileMessage("Nao sincronizado. Seus dados ficaram salvos neste navegador e serao reenviados automaticamente.", true);
    return;
  }
  selectedStudentProfile = updatedStudent.name;
  setLocalValue("student-profile", selectedStudentProfile);

  const profileAuthId = currentSupabaseUser?.id || getStudentAuthUserId(updatedStudent);
  if (profileAuthId) {
    const profileResult = await upsertSupabaseProfile({
      ...(currentSupabaseProfile || {}),
      auth_user_id: profileAuthId,
      email: nextEmail || currentSupabaseUser?.email || updatedStudent.email || "",
      role: "aluno",
      student_id: updatedStudent.id || currentSupabaseProfile?.student_id || "",
      name: updatedStudent.name,
      first_login: passwordChanged ? false : currentSupabaseProfile?.first_login !== false,
    });
    if (!profileResult.error) {
      currentSupabaseProfile = profileResult.data;
    } else {
      console.warn("Dados do aluno foram salvos, mas o profile não foi atualizado.", profileResult.error);
    }
  }

  form.elements.newPassword.value = "";
  form.elements.confirmPassword.value = "";
  fillStudentSelects();
  renderStudentProfile();
  const freshMessage = studentProfilePanel.querySelector("[data-profile-message]");
  if (freshMessage) {
    freshMessage.textContent = `Salvo no Supabase.${emailConfirmationNotice}`;
    freshMessage.classList.remove("error");
  }
});
adminLoadStudent?.addEventListener("change", renderAdminLoadEvolution);
adminEvolutionStudent?.addEventListener("change", () => {
  fillAdminEvolutionExercises();
  renderAdminEvolution();
});
adminEvolutionExercise?.addEventListener("change", renderAdminEvolution);
adminEvolutionChartMode?.addEventListener("change", renderAdminEvolution);
adminFeedbackStudentFilter?.addEventListener("change", renderAdminFeedbacks);
adminFeedbackTypeFilter?.addEventListener("change", renderAdminFeedbacks);
adminNotesStudentFilter?.addEventListener("change", renderAdminFeedbacks);
adminFeedbackHistory?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-feedback-card]");
  if (!card) return;
  const detail = card.querySelector(".feedback-workout-detail");
  if (detail) detail.hidden = !detail.hidden;
});
assessmentStudent?.addEventListener("change", () => {
  const dashboardSelect = document.querySelector("#assessment-dashboard-student");
  if (dashboardSelect) dashboardSelect.value = assessmentStudent.value;
  renderAdminAssessments();
  renderAssessmentSupportSummaries();
});

document.addEventListener("change", (event) => {
  if (event.target?.id === "assessment-dashboard-student") {
    if (assessmentStudent) assessmentStudent.value = event.target.value;
    renderAdminAssessments();
  }
});

document.addEventListener("click", async (event) => {
  const pageButton = event.target.closest("[data-open-assessment-page]");
  if (pageButton) {
    openAdminSubpage(pageButton.dataset.openAssessmentPage);
    return;
  }

  const detailButton = event.target.closest("[data-assessment-details]");
  if (detailButton) {
    const card = detailButton.closest(".assessment-history-card");
    const panel = card?.querySelector(".assessment-detail-panel");
    if (panel) panel.hidden = !panel.hidden;
    return;
  }

  const compareButton = event.target.closest("[data-assessment-compare]");
  if (compareButton) {
    openAdminSubpage("assessment-compare");
    return;
  }

  if (event.target?.id === "assessment-generate-summary") {
    updateAssessmentOpinion();
    return;
  }

  if (event.target?.id === "assessment-copy-report") {
    updateAssessmentOpinion();
    const studentName = assessmentStudent?.value || getAssessmentDashboardStudent();
    const assessments = getStudentAssessments(studentName);
    const latest = assessments[assessments.length - 1] || {
      date: assessmentDate?.value || formatToday(),
      weight: assessmentWeight?.value || "",
      fat: assessmentFat?.value || "",
      muscle: assessmentMuscle?.value || "",
      abdomen: document.querySelector("#assessment-abdomen")?.value || "",
      waist: document.querySelector("#assessment-waist")?.value || "",
      autoOpinion: document.querySelector("#assessment-auto-opinion")?.value || "",
    };
    const previous = assessments[assessments.length - 2] || assessments[assessments.length - 1] || null;
    const report = createAssessmentReportText(latest, previous, studentName);
    await navigator.clipboard?.writeText(report).catch(() => null);
    if (assessmentMessage) {
      assessmentMessage.textContent = "Resumo copiado para WhatsApp.";
      assessmentMessage.classList.remove("error");
    }
  }
});
studentLoadExercise?.addEventListener("change", renderStudentLoadEvolution);
studentLoadChartMode?.addEventListener("change", renderStudentLoadEvolution);
checkinFilterStudent?.addEventListener("change", renderCheckinHistory);
checkinFilterDate?.addEventListener("input", renderCheckinHistory);
manualCheckinStudent?.addEventListener("change", fillManualCheckinPackageSelect);
makeupStudent?.addEventListener("change", fillMakeupPackageSelect);
makeupListStudent?.addEventListener("change", renderMakeupCreditList);
personalRescheduleStudent?.addEventListener("change", fillPersonalReschedulePackageSelect);
lessonHistoryStudent?.addEventListener("change", () => renderLessonExtraHistory(lessonHistoryStudent.value));
lessonHistoryStart?.addEventListener("input", () => renderLessonExtraHistory(lessonHistoryStudent?.value || ""));
lessonHistoryEnd?.addEventListener("input", () => renderLessonExtraHistory(lessonHistoryStudent?.value || ""));
packageViewStudent?.addEventListener("change", () => {
  if (packageStudentSearch) packageStudentSearch.value = packageViewStudent.value;
  if (packageStudent) packageStudent.value = packageViewStudent.value;
  if (packageForm) packageForm.hidden = true;
  editingPackageId = null;
  renderPackageAdminList();
  saveNavigationState();
});

packageStudentSearch?.addEventListener("input", renderPackageStudentResults);
packageStudentResults?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select-package-student]");
  if (!button) return;
  selectPackageStudent(button.dataset.selectPackageStudent);
});

packageName?.addEventListener("change", () => {
  applyPackageModelByName(packageName.value);
});

packageStart?.addEventListener("change", () => {
  if (packageEnd && packageStart.value && !editingPackageId) {
    packageEnd.value = getSameDayNextMonth(packageStart.value) || packageEnd.value;
  }
});

packageModuleMenu?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-package-page-target]");
  if (!button) return;
  openPackageSubpage(button.dataset.packagePageTarget, button.dataset.packageMode || "");
});

document.querySelectorAll("[data-agenda-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.agendaAction;
    if (agendaMakeupForm) agendaMakeupForm.hidden = action !== "makeup";
    if (agendaDropinForm) agendaDropinForm.hidden = action !== "dropin";
    if (agendaCancelForm) agendaCancelForm.hidden = action !== "cancel";
    fillAgendaStudentSelects();
    fillAgendaCancelSelect();
  });
});

[adminAgendaView, adminAgendaDate].forEach((input) => {
  input?.addEventListener("change", renderAdminAgenda);
  input?.addEventListener("input", () => setTimeout(renderAdminAgenda, 0));
});

agendaMakeupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const isGroup = agendaMakeupForm.querySelector("[data-agenda-audience-mode='makeup']")?.value === "group";
  const participants = getAgendaFormParticipants(isGroup ? "makeup" : "individual", agendaMakeupStudent?.value || "");
  const date = agendaMakeupDate?.value.trim() || "";
  const time = agendaMakeupTime?.value.trim() || "";
  const duration = Number(agendaMakeupDuration?.value) || 60;
  if (!participants.length || !participants.some((student) => student.name)) {
    showMessage("Selecione pelo menos um aluno.", "error");
    return;
  }
  if (hasAgendaConflict(date, time, duration)) {
    showMessage("Esse horario ja esta ocupado.", "error");
    return;
  }
  const parsedDate = parseBrazilianDate(date);
  const events = loadAgendaEvents();
  participants.forEach((student) => events.push({
    id: createId(),
    studentName: student.name,
    studentId: student.id || getStudentIdByName(student.name),
    date,
    dateKey: parsedDate ? getDateKey(parsedDate) : "",
    time,
    duration,
    type: "makeup",
    modality: "Reposicao",
    status: "reposicao",
    note: agendaMakeupNote?.value.trim() || "",
    groupMode: isGroup,
    source: "manual",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
  saveAgendaEvents(events);
  agendaMakeupForm.reset();
  agendaMakeupParticipants = [];
  agendaMakeupForm.querySelector(".student-multi-picker")?.renderChips?.();
  resetAgendaAudiencePanel(agendaMakeupForm, "makeup");
  renderAdminAgenda();
  await supabaseSyncPromise;
});

agendaDropinForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const isGroup = agendaDropinForm.querySelector("[data-agenda-audience-mode='dropin']")?.value === "group";
  const manualName = agendaDropinName?.value.trim() || "";
  const participants = isGroup ? getAgendaFormParticipants("dropin", "") : getAgendaFormParticipants("individual", manualName || agendaDropinStudent?.value || "");
  const date = agendaDropinDate?.value.trim() || "";
  const time = agendaDropinTime?.value.trim() || "";
  const duration = Number(agendaDropinDuration?.value) || 60;
  if (!participants.length || !participants.some((student) => student.name)) {
    showMessage("Selecione pelo menos um aluno.", "error");
    return;
  }
  if (hasAgendaConflict(date, time, duration)) {
    showMessage("Esse horario ja esta ocupado.", "error");
    return;
  }
  const parsedDate = parseBrazilianDate(date);
  const nextDropIns = [...loadDropInClasses()];
  const nextEvents = [...loadAgendaEvents()];
  participants.forEach((student) => {
    const studentName = student.name;
    const studentId = student.id || getStudentIdByName(studentName);
    nextDropIns.push({
    id: createId(),
    studentName,
    studentId,
    date,
    modality: "Aula avulsa",
    value: agendaDropinValue?.value.trim() || "",
    status: agendaDropinStatus?.value || "pendente",
    note: `Agenda ${time}`,
    groupMode: isGroup,
    createdAt: Date.now(),
    });
    nextEvents.push({
    id: createId(),
    studentName,
    studentId,
    date,
    dateKey: parsedDate ? getDateKey(parsedDate) : "",
    time,
    duration,
    type: "dropin",
    modality: "Aula avulsa",
    status: agendaDropinStatus?.value || "pendente",
    value: agendaDropinValue?.value.trim() || "",
    groupMode: isGroup,
    source: "manual",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    });
  });
  saveDropInClasses(nextDropIns);
  saveAgendaEvents(nextEvents);
  agendaDropinForm.reset();
  agendaDropinParticipants = [];
  agendaDropinForm.querySelector(".student-multi-picker")?.renderChips?.();
  resetAgendaAudiencePanel(agendaDropinForm, "dropin");
  renderAdminAgenda();
  renderPackageAdminList();
  await supabaseSyncPromise;
});

agendaCancelForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const eventId = agendaCancelEvent?.value || "";
  const currentEvent = getAgendaEventsForRange(adminAgendaView?.value || "week", parseBrazilianDate(adminAgendaDate?.value || "") || new Date()).find((item) => item.id === eventId);
  if (!currentEvent) return;
  if (currentEvent.source === "package" && currentEvent.packageId && agendaCancelMakeup?.value === "yes") {
    const classPackage = loadClassPackages().find((item) => item.id === currentEvent.packageId);
    if (classPackage) {
      registerPersonalLessonReschedule({
        studentName: currentEvent.studentName,
        classPackage,
        date: currentEvent.date,
        lessonTime: currentEvent.time,
        reason: agendaCancelReason?.value.trim() || "Cancelamento registrado pela agenda.",
      });
    }
  }
  saveAgendaEvents([...loadAgendaEvents(), {
    ...currentEvent,
    id: createId(),
    type: "cancellation",
    status: agendaCancelMakeup?.value === "yes" ? "cancelada - gera reposicao" : "cancelada",
    note: agendaCancelReason?.value.trim() || "",
    source: "manual-cancel",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }]);
  agendaCancelForm.reset();
  renderAdminAgenda();
  await supabaseSyncPromise;
});

document.querySelectorAll("[data-package-page-back]").forEach((button) => {
  button.addEventListener("click", showPackageModuleMenu);
});

studentWeeklySchedule?.addEventListener("blur", (event) => {
  const input = event.target.closest("[data-student-schedule-time]");
  if (!input) return;
  formatStudentScheduleTimeInput(input);
  renderStudentPackagePreview();
}, true);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && currentUserType) {
    saveNavigationState();
    return;
  }

  if (document.visibilityState === "visible" && currentUserType && !isRestoringNavigation) {
    const restored = restoreNavigationState();
    console.info("Navegacao restaurada apos retorno da aba.", { restored });
  }
});

window.addEventListener("pagehide", () => {
  if (currentUserType) saveNavigationState();
});

window.addEventListener("pageshow", () => {
  if (currentUserType && !isRestoringNavigation) {
    const restored = restoreNavigationState();
    console.info("Navegacao restaurada apos reexibir pagina.", { restored });
  }
  retryPendingAppStateSync("pagina reexibida");
});

window.addEventListener("online", () => {
  retryPendingAppStateSync("internet restaurada").then((result) => {
    if (result?.ok && !result.skipped) {
      console.info("Pendencias locais sincronizadas apos retorno da internet.");
    }
  });
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
  if (packageStudentSearch) packageStudentSearch.value = packageViewStudent.value;
  if (packageForm) packageForm.hidden = false;
  packageName?.focus();
});

packageForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const packages = loadClassPackages();
  const packageData = {
    id: editingPackageId || createId(),
    studentName: packageStudent?.value || "",
    studentId: getStudentIdByName(packageStudent?.value || ""),
    name: packageName?.value.trim() || "Pacote de aulas",
    total: Number(packageTotal?.value) || 0,
    frequency: packageFrequency?.value.trim() || "",
    value: packageValue?.value.trim() || "",
    startDate: packageStart?.value.trim() || "",
    endDate: packageEnd?.value.trim() || "",
    makeupLimit: Number(packageMakeupLimit?.value) || 0,
    days: packageDays?.value.trim() || "",
    time: normalizeTimeText(packageTime?.value || ""),
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

  upsertPackageModelFromForm(packageData);
  saveClassPackages(packages);
  packageForm.reset();
  packageForm.hidden = true;
  editingPackageId = null;
  fillManualCheckinPackageSelect();
  fillMakeupPackageSelect();
  renderPackageAdminList();
  renderMakeupCreditList();
  renderStudentPackagePanel();
  renderBillingList();
  if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
  await supabaseSyncPromise;
});

billingSettingsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  saveBillingSettings({
    pixKey: billingPixKey?.value.trim() || "",
    senderName: billingSenderName?.value.trim() || "Personal Joao Victor",
    defaultMessage: billingDefaultMessage?.value.trim() || "Para manter seu acesso aos treinos e acompanhamento, voce pode realizar o pagamento via Pix.",
    countHolidays: (billingCountHolidays?.value || "yes") === "yes",
    holidaysText: billingHolidays?.value.trim() || "",
  });
  renderBillingList();
  await supabaseSyncPromise;
});

[billingFilterMonth, billingFilterStatus, billingFilterName, billingCountHolidays, billingHolidays].forEach((input) => {
  input?.addEventListener("input", renderBillingList);
  input?.addEventListener("change", renderBillingList);
});

billingList?.addEventListener("click", async (event) => {
  const paidButton = event.target.closest("[data-mark-billing-paid]");
  if (!paidButton) return;
  markStudentBillingAsPaid(paidButton.dataset.markBillingPaid);
  await supabaseSyncPromise;
});

frequencyInput?.addEventListener("change", () => {
  const defaultLimit = getDefaultMakeupLimit(frequencyInput.value);
  if (makeupLimitInput && (!makeupLimitInput.value || Number(makeupLimitInput.value) === 0)) {
    makeupLimitInput.value = String(defaultLimit);
  }
  renderStudentPackagePreview();
});

billingTypeInput?.addEventListener("change", renderStudentPackagePreview);
classValueInput?.addEventListener("input", renderStudentPackagePreview);
valueInput?.addEventListener("input", () => {
  if (normalizeBillingType(billingTypeInput?.value) === "fixed") renderStudentPackagePreview();
});
modalityInput?.addEventListener("change", renderStudentPackagePreview);
studentStartDateInput?.addEventListener("input", () => setTimeout(renderStudentPackagePreview, 0));
studentStartDateInput?.addEventListener("change", renderStudentPackagePreview);
Array.from(billingDayInputs || []).forEach((input) => {
  input.addEventListener("change", () => {
    renderStudentWeeklySchedule();
    renderStudentPackagePreview();
  });
});

studentWeeklySchedule?.addEventListener("input", renderStudentPackagePreview);

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
  const lessonType = manualCheckinType?.value || "package";
  if (!studentName || (lessonType === "package" && !classPackage)) return;

  const result = registerFlexibleLessonCheckin(studentName, lessonType, classPackage, "personal", {
    value: manualCheckinValue?.value.trim() || "",
    note: manualCheckinNote?.value.trim() || "",
  });
  if (!result.ok) showMessage(result.message, "error");
  if (manualCheckinValue) manualCheckinValue.value = "";
  if (manualCheckinNote) manualCheckinNote.value = "";
  renderCheckinHistory();
  renderPackageAdminList();
  renderMakeupCreditList();
  renderStudentPackagePanel();
  if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
  if (workoutViewStudent?.value === studentName) {
    renderStudentCheckinStatus();
  }
});

dropInForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const dropIns = loadDropInClasses();
  dropIns.push({
    id: createId(),
    studentName: dropInStudent?.value || "",
    studentId: getStudentIdByName(dropInStudent?.value || ""),
    date: dropInDate?.value.trim() || formatToday(),
    modality: dropInModality?.value.trim() || "Aula avulsa",
    value: dropInValue?.value.trim() || "",
    status: dropInStatus?.value || "pendente",
    note: dropInNote?.value.trim() || "",
    timestamp: Date.now(),
    createdAt: Date.now(),
  });
  saveDropInClasses(dropIns);
  dropInForm.reset();
  if (dropInStudent && packageViewStudent?.value) dropInStudent.value = packageViewStudent.value;
  renderPackageAdminList();
  renderBillingList();
  if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
});

makeupForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const studentName = makeupStudent?.value || "";
  const classPackage = loadClassPackages().find((item) => item.id === makeupPackage?.value) || null;
  const result = registerStudentRescheduleNotice({
    studentName,
    classPackage,
    date: makeupDate?.value.trim() || "",
    lessonTime: makeupLessonTime?.value.trim() || "",
    noticeTime: makeupNoticeTime?.value.trim() || "",
    note: makeupNote?.value.trim() || "",
  });
  if (!result.ok) {
    showMessage(result.message, "error");
    return;
  }
  showMessage(result.message);
  makeupForm.reset();
  if (makeupStudent && packageViewStudent?.value) makeupStudent.value = packageViewStudent.value;
  fillMakeupPackageSelect();
  renderCheckinHistory();
  renderPackageAdminList();
  renderMakeupCreditList();
  renderStudentPackagePanel();
  renderAdminAlertBadge();
  if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
});

personalRescheduleForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const studentName = personalRescheduleStudent?.value || "";
  const classPackage = loadClassPackages().find((item) => item.id === personalReschedulePackage?.value) || null;
  const result = registerPersonalLessonReschedule({
    studentName,
    classPackage,
    date: personalRescheduleDate?.value.trim() || "",
    lessonTime: personalRescheduleTime?.value.trim() || "",
    reason: personalRescheduleReason?.value.trim() || "",
  });
  if (!result.ok) {
    showMessage(result.message, "error");
    return;
  }
  showMessage(result.message);
  personalRescheduleForm.reset();
  if (personalRescheduleStudent && packageViewStudent?.value) personalRescheduleStudent.value = packageViewStudent.value;
  fillPersonalReschedulePackageSelect();
  renderCheckinHistory();
  renderPackageAdminList();
  renderMakeupCreditList();
  renderStudentPackagePanel();
  renderAdminAlertBadge();
  if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
});

lessonExtraHistory?.addEventListener("click", (event) => {
  const whatsappButton = event.target.closest("[data-send-makeup-whatsapp]");
  const requestButton = event.target.closest("[data-request-makeup]");
  const approveButton = event.target.closest("[data-approve-makeup]");
  const useButton = event.target.closest("[data-use-makeup]");
  const rejectButton = event.target.closest("[data-reject-makeup]");
  const defineDateButton = event.target.closest("[data-define-makeup-date]");
  const button = whatsappButton || requestButton || approveButton || useButton || rejectButton || defineDateButton;
  if (!button) return;

  const creditId = button.dataset.sendMakeupWhatsapp || button.dataset.requestMakeup || button.dataset.approveMakeup || button.dataset.useMakeup || button.dataset.rejectMakeup || button.dataset.defineMakeupDate;
  const credit = loadMakeupCredits().find((item) => item.id === creditId);
  if (!credit) return;

  if (whatsappButton) {
    const student = getStudentByName(credit.studentName);
    const url = createMakeupWhatsAppUrl(student, credit);
    if (!url) {
      window.alert("Cadastre o WhatsApp do aluno para enviar a mensagem.");
      return;
    }
    window.open(url, "_blank", "noopener");
    return;
  }

  if (requestButton) updateMakeupCreditStatus(creditId, "requested");
  if (approveButton) updateMakeupCreditStatus(creditId, "approved");
  if (defineDateButton) defineMakeupReplacementDate(creditId);
  if (useButton) useMakeupCreditById(creditId);
  if (rejectButton && window.confirm("Recusar esta reposição?")) updateMakeupCreditStatus(creditId, "rejected");

  renderPackageAdminList();
  renderStudentPackagePanel();
  if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
});

makeupCreditList?.addEventListener("click", (event) => {
  const whatsappButton = event.target.closest("[data-send-makeup-whatsapp]");
  const requestButton = event.target.closest("[data-request-makeup]");
  const approveButton = event.target.closest("[data-approve-makeup]");
  const useButton = event.target.closest("[data-use-makeup]");
  const rejectButton = event.target.closest("[data-reject-makeup]");
  const defineDateButton = event.target.closest("[data-define-makeup-date]");
  const button = whatsappButton || requestButton || approveButton || useButton || rejectButton || defineDateButton;
  if (!button) return;

  const creditId = button.dataset.sendMakeupWhatsapp || button.dataset.requestMakeup || button.dataset.approveMakeup || button.dataset.useMakeup || button.dataset.rejectMakeup || button.dataset.defineMakeupDate;
  const credit = loadMakeupCredits().find((item) => item.id === creditId);
  if (!credit) return;

  if (whatsappButton) {
    const student = getStudentByName(credit.studentName);
    const url = createMakeupWhatsAppUrl(student, credit);
    if (!url) {
      window.alert("Cadastre o WhatsApp do aluno para enviar a mensagem.");
      return;
    }
    window.open(url, "_blank", "noopener");
    return;
  }

  if (requestButton) updateMakeupCreditStatus(creditId, "requested");
  if (approveButton) updateMakeupCreditStatus(creditId, "approved");
  if (defineDateButton) defineMakeupReplacementDate(creditId);
  if (useButton) useMakeupCreditById(creditId);
  if (rejectButton && window.confirm("Recusar esta reposição?")) updateMakeupCreditStatus(creditId, "rejected");

  renderPackageAdminList();
  renderMakeupCreditList();
  renderLessonExtraHistory(lessonHistoryStudent?.value || "");
  renderStudentPackagePanel();
  if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
});

packageAdminList?.addEventListener("click", async (event) => {
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
      if (saved) await supabaseSyncPromise;
      renderCheckinHistory();
      renderPackageAdminList();
      renderStudentPackagePanel();
      if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
      if (detail && !saved) {
        detail.textContent = "Presença não registrada: pacote finalizado ou aula de hoje já possui registro.";
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
      if (!window.confirm("Excluir este pacote? O histórico antigo será mantido.")) return;
      addDeletionTombstones([createTombstoneEntry("classPackages", classPackage)]);
      saveClassPackages(loadClassPackages().filter((item) => item.id !== classPackage.id));
      await supabaseSyncPromise;
      renderPackageAdminList();
      renderStudentPackagePanel();
      if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
      return;
    }

    if (action === "reschedule") {
      if (makeupStudent) makeupStudent.value = classPackage.studentName;
      fillMakeupPackageSelect();
      if (makeupPackage) makeupPackage.value = classPackage.id;
      const nextLesson = generatePackageSchedule(classPackage).find((lesson) => lesson.dateKey >= getDateKey() && !getLessonRecord(classPackage.id, lesson.dateKey));
      if (nextLesson) {
        if (makeupDate) makeupDate.value = nextLesson.date;
        if (makeupLessonTime) makeupLessonTime.value = nextLesson.time;
      }
      makeupForm?.scrollIntoView({ behavior: "smooth", block: "center" });
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
  await supabaseSyncPromise;
  renderCheckinHistory();
  renderPackageAdminList();
  renderStudentPackagePanel();
  if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
});

studentPackagePanel?.addEventListener("click", async (event) => {
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

    renderStudentCancelConfirmation(classPackage, lesson);
    return;
  }

  const confirmCancelButton = event.target.closest("[data-confirm-cancel-lesson]");
  if (confirmCancelButton) {
    const studentName = workoutViewStudent?.value;
    const classPackage = loadClassPackages().find((item) => item.id === confirmCancelButton.dataset.confirmCancelLesson);
    const lesson = generatePackageSchedule(classPackage || {}).find((item) => item.dateKey === confirmCancelButton.dataset.lessonDate);
    if (!studentName || !classPackage || !lesson || getLessonRecord(classPackage.id, lesson.dateKey)) return;

    const result = registerLessonCancellation(studentName, classPackage, lesson);
    await supabaseSyncPromise;
    renderStudentCheckinStatus();
    renderStudentCancelSuccess(result);
    renderCheckinHistory();
    renderPackageAdminList();
    renderMakeupCreditList();
    renderAdminAlertBadge();
    if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
    return;
  }

  const requestMakeupButton = event.target.closest("[data-student-request-makeup]");
  if (requestMakeupButton) {
    const url = requestStudentMakeupReschedule(requestMakeupButton.dataset.studentRequestMakeup);
    await supabaseSyncPromise;
    if (url) window.open(url, "_blank", "noopener");
    renderStudentPackagePanel();
    renderStudentPackageDetail("history");
    renderPackageAdminList();
    renderMakeupCreditList();
    if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
    return;
  }

  const button = event.target.closest("[data-package-checkin]");
  if (!button || button.disabled) return;

  const studentName = workoutViewStudent?.value;
  const classPackage = loadClassPackages().find((item) => item.id === button.dataset.packageCheckin);
  if (!studentName || !classPackage) return;

  registerPackageCheckin(studentName, classPackage, "aluno");
  await supabaseSyncPromise;
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
studentListSearch?.addEventListener("input", renderStudents);

backToWorkoutStudents?.addEventListener("click", showWorkoutStudentDirectory);

createWorkoutForStudent?.addEventListener("click", () => {
  showWorkoutFormForStudent(selectedAdminWorkoutStudent, "create");
});

workoutList?.addEventListener("click", async (event) => {
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
    saveNavigationState();
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
    saveNavigationState();
    return;
  }

  const removeButton = event.target.closest("[data-remove-workout-id]");
  if (!removeButton) return;

  const workouts = loadWorkouts();
  const studentName = removeButton.dataset.removeWorkoutStudent;
  const removedWorkout = (workouts[studentName] || []).find((workout) => workout.id === removeButton.dataset.removeWorkoutId);
  if (removedWorkout) {
    addDeletionTombstones([createTombstoneEntry("workouts", removedWorkout, { studentName, studentId: getStudentIdByName(studentName) })]);
  }
  workouts[studentName] = (workouts[studentName] || []).filter((workout) => workout.id !== removeButton.dataset.removeWorkoutId);
  if (!workouts[studentName].length) delete workouts[studentName];
  saveWorkouts(workouts);
  await supabaseSyncPromise;
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
  saveNavigationState();
});

studentList?.addEventListener("click", async (event) => {
  const openButton = event.target.closest("[data-open-student-profile]");
  if (openButton) {
    renderAdminStudentProfile(openButton.dataset.openStudentProfile);
    openAdminSubpage("students-profile");
    return;
  }

  const editButton = event.target.closest("[data-edit-student]");
  if (editButton) {
    startEditingStudentByIdentifier(editButton.dataset.editStudent);
    return;
  }

  const removeButton = event.target.closest("[data-remove-student]");
  if (!removeButton) return;

  const students = loadStudents();
  const student = students.find((item) => item.id === removeButton.dataset.removeStudent || item.name === removeButton.dataset.removeStudent);
  if (!student || !(await confirmStudentDeletion(student))) return;

  await deleteStudentWithLinkedData(student);
  renderStudents();
  fillStudentSelects();
  renderWorkouts();
  renderWorkoutStudentDirectory();
  renderAdminAlerts();
  if (selectedAdminProfileStudent) renderAdminStudentProfile(selectedAdminProfileStudent);
});

paymentBlockedPanel?.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-blocked-payment-student]");
  if (!editButton) return;

  const studentIndex = loadStudents().findIndex((student) => student.name === editButton.dataset.editBlockedPaymentStudent);
  if (studentIndex < 0) return;

  openAdminModule("students");
  openAdminSubpage("students-register");
  startEditingStudent(studentIndex, "Altere o status de pagamento e salve o aluno.");
});

adminDashboard?.addEventListener("click", (event) => {
  const completeButton = event.target.closest("[data-complete-student-days]");
  if (!completeButton) return;
  startEditingStudentByIdentifier(completeButton.dataset.completeStudentDays, "Complete os dias de treino para ativar os cálculos automáticos.");
});

cancelEditButton?.addEventListener("click", () => {
  resetStudentForm();
  showMessage("Edicao cancelada.");
});

studentAdminProfile?.addEventListener("click", async (event) => {
  const closeButton = event.target.closest("[data-close-student-profile]");
  if (closeButton) {
    openAdminSubpage("students-list");
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
      if (!window.confirm("Excluir este pacote? O histórico antigo será mantido.")) return;
      addDeletionTombstones([createTombstoneEntry("classPackages", classPackage)]);
      const packages = loadClassPackages().filter((item) => item.id !== classPackage.id);
      saveClassPackages(packages);
      await supabaseSyncPromise;
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
      await supabaseSyncPromise;
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

  if (action === "access" && studentIndex >= 0) {
    startEditingStudentByIdentifier(students[studentIndex].id || studentName);
    createStudentTemporaryAccessFromForm();
    return;
  }

  if (action === "edit" && studentIndex >= 0) {
    startEditingStudentByIdentifier(students[studentIndex].id || studentName);
    return;
  }

  if (action === "workout") {
    openAdminModule("workouts");
    openWorkoutStudentWorkspace(studentName);
    return;
  }

  if (action === "package" || action === "checkin") {
    openAdminModule("checkins");
    openPackageSubpage(action === "package" ? "packages" : "checkin", action === "package" ? "edit" : "");
    if (packageViewStudent) packageViewStudent.value = studentName;
    const activePackage = getActivePackage(studentName) || loadClassPackages().filter((item) => item.studentName === studentName).sort((a, b) => b.createdAt - a.createdAt)[0];
    fillPackageForm(action === "package" ? activePackage : null, studentName);
    if (manualCheckinStudent) manualCheckinStudent.value = studentName;
    fillManualCheckinPackageSelect();
    renderPackageAdminList();
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
    openAdminModule("evolution");
    if (adminEvolutionStudent) adminEvolutionStudent.value = studentName;
    fillAdminEvolutionExercises();
    renderAdminEvolution();
  }
});

function openAdminModule(moduleName) {
  if (!adminDashboard) return;

  activeAdminModule = moduleName;
  activeAdminSubpage = "";
  adminDashboard.hidden = true;
  adminModules.forEach((module) => {
    module.hidden = module.id !== `admin-module-${moduleName}`;
  });
  navButtons.forEach((button) => {
    if (button.dataset.adminShortcut) {
      button.classList.toggle("active", button.dataset.adminShortcut === moduleName);
    } else if (button.dataset.view === "admin") {
      button.classList.toggle("active", moduleName !== "schedule");
    }
  });
  if (moduleName === "assessments") {
    ensureAssessmentProfessionalUi();
    syncAssessmentStudentSelects();
    showAdminSubpageMenu("assessments");
    if (!assessmentDate.value) assessmentDate.value = formatToday();
    renderAdminAssessments();
    renderAdminLoadEvolution();
  }
  if (moduleName === "checkins") {
    if (!isRestoringNavigation) {
      if (packageViewStudent) packageViewStudent.value = "";
      if (packageStudentSearch) packageStudentSearch.value = "";
      if (packageStudentResults) packageStudentResults.innerHTML = "";
    }
    if (!isRestoringNavigation) {
      if (packageForm) packageForm.hidden = true;
      showPackageModuleMenu();
    }
    renderPackageAdminList();
    fillManualCheckinPackageSelect();
    renderCheckinHistory();
  }
  if (moduleName === "evolution") {
    showAdminSubpageMenu("evolution");
    renderAdminEvolution();
  }
  if (moduleName === "alerts") {
    renderAdminAlerts();
  }
  if (moduleName === "schedule") {
    renderAdminAgenda();
  }
  if (moduleName === "workouts") {
    showWorkoutStudentDirectory();
  }
  if (moduleName === "students") {
    showAdminSubpageMenu("students");
  }
  if (moduleName === "finance") {
    renderBillingSettings();
    renderBillingList();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
  saveNavigationState();
}

function showAdminDashboard(options = {}) {
  if (!adminDashboard) return;

  if (isRestoringNavigation) return;

  activeAdminModule = "";
  activeAdminSubpage = "";
  activePackageSubpage = "";
  activePackageMode = "";
  adminDashboard.hidden = false;
  adminModules.forEach((module) => {
    module.hidden = true;
  });
  renderAdminAlerts();
  window.scrollTo({ top: 0, behavior: "smooth" });
  saveNavigationState({ allowDashboardState: options.persistDashboard === true });
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
  button.addEventListener("click", () => showAdminDashboard({ persistDashboard: true }));
});

adminAlertsList?.addEventListener("click", (event) => {
  const destinationButton = event.target.closest("[data-resolve-alert-destination]");
  if (destinationButton) {
    resolveAlertDestination(destinationButton.dataset.resolveAlertDestination);
    return;
  }

  const billingButton = event.target.closest("[data-alert-billing-student]");
  if (billingButton) {
    openAlertBillingWhatsApp(billingButton.dataset.alertBillingStudent);
    return;
  }

  const resolveButton = event.target.closest("[data-resolve-alert]");
  if (resolveButton) {
    resolveAdminAlert(resolveButton.dataset.resolveAlert);
    renderAdminAlerts();
    renderAdminAlertBadge();
    return;
  }

  const button = event.target.closest("[data-open-alert-student]");
  if (!button) return;
  openAdminStudentProfile(button.dataset.openAlertStudent);
});

adminAlertFilter?.addEventListener("change", renderAdminAlerts);

exportDataButton?.addEventListener("click", exportAppData);

document.addEventListener("click", (event) => {
  const subpageButton = event.target.closest("[data-subpage-target]");
  if (subpageButton) {
    openAdminSubpage(subpageButton.dataset.subpageTarget);
    return;
  }

  const backButton = event.target.closest("[data-subpage-back]");
  if (backButton) {
    showAdminSubpageMenu(backButton.dataset.subpageBack);
  }
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
  saveNavigationState();
});

workoutForm?.addEventListener("input", saveNavigationState);

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

function enterTestMode(role, studentName = "", options = {}) {
  if (!["student", "admin"].includes(role)) return;
  if (options.provider !== "supabase" || !currentSupabaseUser) {
    showSupabaseLoginMessage("Use o login real com e-mail e senha.", "error");
    console.warn("Entrada local/teste bloqueada. Login real Supabase obrigatorio.");
    return;
  }
  const shouldPersist = options.persist !== false;
  const provider = "supabase";

  Object.keys(activeWorkoutByStudent).forEach((key) => delete activeWorkoutByStudent[key]);
  Object.keys(activeSessionByWorkout).forEach((key) => delete activeSessionByWorkout[key]);
  currentUserType = role;
  setLocalValue("user-type", role);

  if (role === "student") {
    const students = loadStudents();
    const requestedStudent = studentName || "";
    selectedStudentProfile = students.some((student) => student.name === requestedStudent) ? requestedStudent : students[0]?.name || "";
    setLocalValue("student-profile", selectedStudentProfile);
    if (workoutViewStudent) workoutViewStudent.value = selectedStudentProfile;
  }

  if (shouldPersist) {
    saveAppLoginSession({
      role,
      studentName: role === "student" ? selectedStudentProfile : "",
      provider,
    });
  }

  fillStudentSelects();
  updateStudentHeader();
  applyUserPermissions();
  renderHomeDashboard();
  renderCurrentWorkout();
}

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

  console.info("Tentativa de login Supabase.", { email });
  showSupabaseLoginMessage("Entrando...");
  setSupabaseLoginButtonLoading(true);
  activeLoginSource = "login-submit";
  try {
    const { data, error } = await retryAsyncOperation(
      "login Supabase",
      async () => {
        const result = await client.auth.signInWithPassword({ email, password });
        if (result.error && !/invalid login credentials/i.test(result.error.message || "")) throw result.error;
        return result;
      },
      { attempts: 2, recoverableOnly: false, timeoutMs: supabaseOperationTimeoutMs },
    );
    if (error) {
      console.error("Erro no login Supabase Auth.", {
        email,
        status: error.status,
        name: error.name,
        message: error.message,
        supabaseUrl: getSupabaseConfig().url,
      });
      const invalidCredentials = /invalid login credentials/i.test(error.message || "");
      showSupabaseLoginMessage(
        invalidCredentials
          ? "E-mail ou senha incorretos. No primeiro acesso, use a senha temporária informada pelo personal."
          : "Nao foi possivel entrar. Confira e-mail e senha.",
        "error",
      );
      return;
    }
    console.info("Supabase Auth autenticou usuario.", {
      emailInformado: email,
      userId: data?.user?.id || "",
      userEmail: data?.user?.email || "",
    });

    const applied = await applySupabaseUserOnce(data.user, "login-submit");
    if (applied) {
      supabaseLoginForm.reset();
      showSupabaseLoginMessage("");
    }
  } catch (error) {
    console.error("Login Supabase finalizado com erro/timeout.", {
      email,
      erro: error,
      message: error?.message || "",
    });
    showSupabaseLoginMessage(
      /tempo esgotado/i.test(error?.message || "")
        ? "O login demorou mais que o esperado. Confira sua conexão e tente novamente."
        : "Nao foi possivel entrar agora. Tente novamente.",
      "error",
    );
  } finally {
    if (!applySupabaseUserPromise) activeLoginSource = "";
    setSupabaseLoginButtonLoading(false);
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
  selectedStudentProfile = "";
  Object.keys(activeWorkoutByStudent).forEach((key) => delete activeWorkoutByStudent[key]);
  Object.keys(activeSessionByWorkout).forEach((key) => delete activeSessionByWorkout[key]);
  clearAppLoginSession();
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
  renderHomeDashboard();
  renderAdminAlerts();
  renderBillingSettings();
  fillStudentSelects();
  setupAgendaGroupFeatures();
  refreshAgendaGroupSelects();
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
    renderAdminAlerts();
  }
}

async function initializeApp() {
  if (appInitializationPromise) return appInitializationPromise;
  if (appEventsBound) return;
  appEventsBound = true;

  bindGlobalErrorHandlers();
  hideAppErrorRecovery();
  currentUserType = null;
  console.info(`Supabase URL utilizada: ${getSupabaseConfig().url}`);
  updateTodayLabel();
  updateEvolutionNavigationLabels();
  fillLoadChartModeSelect(studentLoadChartMode);
  fillLoadChartModeSelect(adminEvolutionChartMode);
  fillPackageModelList();
  applyInputMasks();
  normalizeStoredAppData();
  setupAgendaGroupFeatures();

  if (loginScreen) loginScreen.hidden = true;
  if (appShell) appShell.hidden = true;
  if (!assessmentDate?.value && assessmentDate) assessmentDate.value = formatToday();

  resetExerciseRows();
  renderStudents();
  renderAdminAlerts();
  renderBillingSettings();
  logLocalPersistenceAudit("início");
  fillStudentSelects();
  refreshAgendaGroupSelects();
  // Pendencias sao reenviadas em segundo plano e nunca bloqueiam login/carregamento.
  retryPendingAppStateSync("abertura do app").catch((error) => {
    console.error("Nao foi possivel reenviar pendencias na abertura.", {
      operacao: "retryPendingAppStateSync:inicializacao",
      erroOriginal: error,
    });
  });
  appInitializationPromise = Promise.resolve()
    .then(() => {
      if (!navigator.onLine) {
        showOfflineNotice();
        return "offline";
      }
      return loadSupabaseAppState({ retry: true });
    })
    .then((status) => {
      if (status === "loaded") {
        hideAppErrorRecovery();
        logLocalPersistenceAudit("supabase carregado");
        refreshAppAfterRemoteState();
        return;
      }
      if (status === "missing") {
        console.warn("Supabase app_state ainda sem registro main. Enviando cache local como estado inicial.");
        queueSupabaseAppStateSync("estado inicial app_state", { showSuccess: false });
        return;
      }
      if (status === "offline") {
        console.warn("App iniciado em modo offline. Cache local mantido.");
        return;
      }
      console.warn(`Supabase app_state nao carregado (${status}). LocalStorage segue como cache/fallback.`);
    })
    .catch((error) => {
      console.warn("Supabase app_state nao carregou. App local continua funcionando.", error);
    })
    .then(async () => {
      const supabaseRestored = await restoreSupabaseSession().catch((error) => {
        console.warn("Sessao Supabase nao restaurada dentro do esperado.", error);
        showSupabaseLoginMessage("Nao foi possivel restaurar a sessao. Entre novamente.", "error");
        return false;
      });
      if (!supabaseRestored) {
        if (loginScreen) loginScreen.hidden = false;
        if (appShell) appShell.hidden = true;
      }
    })
    .finally(() => {
      if (!currentSupabaseUser && loginScreen) loginScreen.hidden = false;
      appInitializationPromise = null;
    });
  return appInitializationPromise;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp, { once: true });
} else {
  initializeApp();
}
