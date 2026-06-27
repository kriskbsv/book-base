
// ─────────────────────────────────────────────
// КОНФИГУРАЦИЯ
// ─────────────────────────────────────────────
 
const SUPABASE_URL = "https://fbvrfykgbfkgpfrdnwvg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZidnJmeWtnYmZrZ3BmcmRud3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzA4NDksImV4cCI6MjA5NTcwNjg0OX0.3W43-HLEdlWAqDhuPNYiC14voju7v1usqiS2gLRp-NA";
 
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
 
// ─────────────────────────────────────────────
// СОСТОЯНИЕ
// ─────────────────────────────────────────────
 
const state = {
  currentUser: null,
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
 
  if (existing) return existing;
 
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
// КНОПКА «Я ПРИДУ»
// ─────────────────────────────────────────────
 
function setButtonDefault(button) {
  button.textContent = "Я приду";
  button.disabled = false;
  button.classList.remove("app__content-link_joined");
}
 
function setButtonJoined(button) {
  button.textContent = "Ты записана ✓";
  button.disabled = true;
  button.classList.add("app__content-link_joined");
}
 
function setButtonLoading(button) {
  button.textContent = "Записываем...";
  button.disabled = true;
}
 
async function checkAndSetButtonState(button, meetingId) {
  if (!state.currentUser) return;
 
  const { data, error } = await db
    .from("attendance")
    .select("id")
    .eq("user_id", state.currentUser.id)
    .eq("meeting_id", meetingId)
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
 
async function joinMeeting(button, meetingId) {
  if (!state.currentUser) return;
 
  setButtonLoading(button);
 
  const { data: existing } = await db
    .from("attendance")
    .select("id")
    .eq("user_id", state.currentUser.id)
    .eq("meeting_id", meetingId)
    .maybeSingle();
 
  if (existing) {
    setButtonJoined(button);
    return;
  }
 
  const { error } = await db
    .from("attendance")
    .insert({
      user_id: state.currentUser.id,
      meeting_id: meetingId,
      will_come: true,
      attended: false,
    });
 
  if (error) {
    console.error("Ошибка записи на встречу:", error.message);
    setButtonDefault(button);
    return;
  }
 
  setButtonJoined(button);
}
 
// ─────────────────────────────────────────────
// РЕНДЕР ВСТРЕЧ
// ─────────────────────────────────────────────
 
function renderMeeting(meeting) {
  const wrapper = document.createElement("div");
  wrapper.className = "app__content-wrapper";
 
  const isActive = meeting.is_active;
 
  wrapper.innerHTML = `
    <div class="app__content-item">
      <img
        src="${meeting.book_cover || "images/placeholder.jpg"}"
        alt="Обложка книги"
        class="app__content-item-image"
      >
      <div class="app__content-item-info">
        ${isActive ? `<span class="meetings__badge">Ближайшая</span>` : ""}
        <h2 class="app__content-item-title">«${meeting.book_title}»</h2>
        <p class="app__content-item-author">${meeting.book_author}</p>
        <p class="app__content-item-date">${meeting.meeting_date}</p>
        <p class="app__content-item-time">${meeting.meeting_time}</p>
        ${meeting.place ? `<p class="app__content-item-place">${meeting.place}</p>` : ""}
      </div>
    </div>
    ${isActive ? `<button class="app__content-link" data-meeting-id="${meeting.id}">Я приду</button><div class="js-att" data-att="${meeting.id}"></div>` : ""}
  `;
 
  return wrapper;
}
 
async function loadMeetings() {
  const container = document.getElementById("meetingsList");
  if (!container) return;
 
  container.innerHTML = `<p class="meetings__loading">Загружаем встречи...</p>`;
 
  const { data: meetings, error } = await db
    .from("meetings")
    .select("*")
    .order("id", { ascending: false });
 
  if (error) {
    console.error("Ошибка загрузки встреч:", error.message);
    container.innerHTML = `<p class="meetings__empty">Не удалось загрузить встречи</p>`;
    return;
  }
 
  if (!meetings || meetings.length === 0) {
    container.innerHTML = `<p class="meetings__empty">Встреч пока нет</p>`;
    return;
  }
 
  container.innerHTML = "";
 
  for (const meeting of meetings) {
    const card = renderMeeting(meeting);
    container.appendChild(card);
 
    // Если встреча активная — вешаем логику на кнопку
    if (meeting.is_active) {
      const button = card.querySelector(`[data-meeting-id="${meeting.id}"]`);
      if (button) {
        await checkAndSetButtonState(button, meeting.id);
        button.addEventListener("click", () => joinMeeting(button, meeting.id));
      }
      const attBox = card.querySelector(".js-att");
      if (attBox) await loadMeetingAttendees(meeting.id, attBox);
    }
  }
}
 
// ─────────────────────────────────────────────
// ИНИЦИАЛИЗАЦИЯ
// ─────────────────────────────────────────────
 
async function initMeetingsPage() {
  const telegramUser = getTelegramUser();
 
  await Promise.all([
    (async () => {
      if (!telegramUser) return;
      state.currentUser = await registerOrFindUser(telegramUser);
    })(),
  ]);
 
  await loadMeetings();
 
  console.log("Страница встреч готова. Пользователь:", state.currentUser?.name);
}
 

// ─────────────────────────────────────────────
// КТО ПРИДЁТ
// ─────────────────────────────────────────────

const M_AVA_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle cx='30' cy='30' r='30' fill='%23281e18'/%3E%3Ccircle cx='30' cy='24' r='10' fill='%23a58352' opacity='0.6'/%3E%3Cellipse cx='30' cy='50' rx='16' ry='12' fill='%23a58352' opacity='0.6'/%3E%3C/svg%3E";

function mEsc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function loadMeetingAttendees(meetingId, box) {
  const { data, error } = await db
    .from("attendance")
    .select("users ( name, avatar_url )")
    .eq("meeting_id", meetingId)
    .eq("will_come", true);

  if (error) { console.error("Кто придёт:", error.message); return; }

  const people = (data || []).map((r) => r.users).filter(Boolean);
  if (people.length === 0) {
    box.outerHTML = `<p class="attendees__empty">Будь первым, кто придёт →</p>`;
    return;
  }

  const shown = people.slice(0, 5);
  const extra = people.length - shown.length;
  const avatars = shown.map((u) =>
    `<img class="attendees__avatar" src="${u.avatar_url || M_AVA_FALLBACK}"
          onerror="this.src='${M_AVA_FALLBACK}'" alt="${mEsc(u.name)}">`).join("");
  const more = extra > 0 ? `<span class="attendees__more">+${extra}</span>` : "";
  const word = people.length === 1 ? "идёт" : "идут";

  box.className = "attendees";
  box.innerHTML = `
    <div class="attendees__avatars">${avatars}${more}</div>
    <span class="attendees__label"><b>${people.length}</b> ${word}</span>
  `;
}


initMeetingsPage();
