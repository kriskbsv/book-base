// ─────────────────────────────────────────────
// КОНФИГУРАЦИЯ
// ─────────────────────────────────────────────
 
const SUPABASE_URL = "https://fbvrfykgbfkgpfrdnwvg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZidnJmeWtnYmZrZ3BmcmRud3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzA4NDksImV4cCI6MjA5NTcwNjg0OX0.3W43-HLEdlWAqDhuPNYiC14voju7v1usqiS2gLRp-NA";
 
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
 
// ─────────────────────────────────────────────
// СОСТОЯНИЕ ПРИЛОЖЕНИЯ
// ─────────────────────────────────────────────
 
const state = {
  currentUser: null,    // объект пользователя из таблицы users
  activeMeeting: null,  // объект ближайшей встречи из таблицы meetings
};
 
// ─────────────────────────────────────────────
// TELEGRAM
// ─────────────────────────────────────────────
 
function getTelegramUser() {
  const tg = window.Telegram?.WebApp;
 
  if (!tg) {
  console.warn("Открой в Telegram для полной функциональности");
  return null; // вместо фейкового пользователя
}
 
  tg.ready();
  tg.expand();
 
  return tg.initDataUnsafe?.user ?? null;
}
 
// ─────────────────────────────────────────────
// ПОЛЬЗОВАТЕЛЬ
// ─────────────────────────────────────────────
 
// Находит пользователя в базе или создаёт нового
async function registerOrFindUser(telegramUser) {
  const telegramId = String(telegramUser.id);
 
  const { data: existing, error: findError } = await db
    .from("users")
    .select("*")
    .eq("telegram_id", telegramId)
    .maybeSingle();
 
  if (findError) {
    console.error("Ошибка поиска пользователя:", findError.message);
    return null;
  }
 
  if (existing) {
    return existing;
  }
 
  // Пользователь новый — создаём запись
  const { data: newUser, error: createError } = await db
    .from("users")
    .insert({
      telegram_id: telegramId,
      name: telegramUser.first_name || "Участник",
      username: telegramUser.username ? `@${telegramUser.username}` : "",
    })
    .select()
    .single();
 
  if (createError) {
    console.error("Ошибка создания пользователя:", createError.message);
    return null;
  }
 
  return newUser;
}
 
// ─────────────────────────────────────────────
// ВСТРЕЧИ
// ─────────────────────────────────────────────
 
// Загружает активную (ближайшую) встречу и рендерит её на главной
async function loadActiveMeeting() {
  const titleEl   = document.getElementById("meetingTitle");
  const authorEl  = document.getElementById("meetingAuthor");
  const dateEl    = document.getElementById("meetingDate");
  const timeEl    = document.getElementById("meetingTime");
  const coverEl   = document.getElementById("meetingCover");
 
  // Если этих элементов нет — мы не на главной, выходим
  if (!titleEl) return;
 
  const { data, error } = await db
    .from("meetings")
    .select("*")
    .eq("is_active", true)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
 
  if (error) {
    console.error("Ошибка загрузки встречи:", error.message);
    return;
  }
 
  if (!data) {
    titleEl.textContent  = "Встречи скоро появятся";
    authorEl.textContent = "";
    dateEl.textContent   = "";
    timeEl.textContent   = "";
    return;
  }
 
  state.activeMeeting = data;
 
  titleEl.textContent  = `«${data.book_title}»`;
  authorEl.textContent = data.book_author;
  dateEl.textContent   = data.meeting_date;
  timeEl.textContent   = data.meeting_time;
 
  if (data.book_cover && coverEl) {
    coverEl.src = data.book_cover;
  }
}
 
// ─────────────────────────────────────────────
// КНОПКА «Я ПРИДУ»
// ─────────────────────────────────────────────
 
// Проверяет, записан ли пользователь на встречу, и обновляет кнопку
async function checkAndSetButtonState(button) {
  if (!state.currentUser || !state.activeMeeting) return;
 
  const { data, error } = await db
    .from("attendance")
    .select("id")
    .eq("user_id", state.currentUser.id)
    .eq("meeting_id", state.activeMeeting.id)
    .maybeSingle();
 
  if (error) {
    console.error("Ошибка проверки записи:", error.message);
    return;
  }
 
  if (data) {
    setButtonJoined(button);
  } else {
    setButtonDefault(button);
  }
}
 
function setButtonDefault(button) {
  button.textContent = "Я приду";
  button.disabled    = false;
  button.classList.remove("app__content-link_joined");
}
 
function setButtonJoined(button) {
  button.textContent = "Ты записана ✓";
  button.disabled    = true;
  button.classList.add("app__content-link_joined");
}
 
function setButtonLoading(button) {
  button.textContent = "Записываем...";
  button.disabled    = true;
}
 
// Записывает пользователя на встречу
async function joinMeeting(button) {
  if (!state.currentUser || !state.activeMeeting) {
    console.warn("Нет пользователя или встречи");
    return;
  }
 
  setButtonLoading(button);
 
  // Проверяем ещё раз (защита от двойного клика)
  const { data: existing } = await db
    .from("attendance")
    .select("id")
    .eq("user_id", state.currentUser.id)
    .eq("meeting_id", state.activeMeeting.id)
    .maybeSingle();
 
  if (existing) {
    setButtonJoined(button);
    return;
  }
 
  const { error } = await db
    .from("attendance")
    .insert({
      user_id:    state.currentUser.id,
      meeting_id: state.activeMeeting.id,
      will_come:  true,
      attended:   false,
    });
 
  if (error) {
    console.error("Ошибка записи на встречу:", error.message);
    setButtonDefault(button); // возвращаем кнопку если ошибка
    return;
  }
 
  setButtonJoined(button);
}
 
// ─────────────────────────────────────────────
// ИНИЦИАЛИЗАЦИЯ ГЛАВНОЙ СТРАНИЦЫ
// ─────────────────────────────────────────────
 
async function initIndexPage() {
  const button = document.getElementById("joinMeetingButton");
 
  // Запускаем загрузку встречи и пользователя параллельно
  const telegramUser = getTelegramUser();
 
  await Promise.all([
    loadActiveMeeting(),
    (async () => {
      if (!telegramUser) {
        console.warn("Не удалось получить пользователя Telegram");
        return;
      }
      state.currentUser = await registerOrFindUser(telegramUser);
    })(),
  ]);
 
  // После загрузки — проверяем статус записи и вешаем обработчик
  if (button) {
    await checkAndSetButtonState(button);
 
    button.addEventListener("click", () => joinMeeting(button));
  }
 
  console.log("Главная готова. Пользователь:", state.currentUser?.name, "| Встреча:", state.activeMeeting?.book_title);
}
 
// ─────────────────────────────────────────────
// СТАРТ
// ─────────────────────────────────────────────
 
initIndexPage();