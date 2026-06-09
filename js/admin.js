// ─────────────────────────────────────────────
// КОНФИГУРАЦИЯ
// ─────────────────────────────────────────────
 
const SUPABASE_URL = "https://fbvrfykgbfkgpfrdnwvg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZidnJmeWtnYmZrZ3BmcmRud3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzA4NDksImV4cCI6MjA5NTcwNjg0OX0.3W43-HLEdlWAqDhuPNYiC14voju7v1usqiS2gLRp-NA";
 
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
 
// ─────────────────────────────────────────────
// СПИСОК АДМИНОВ
// ─────────────────────────────────────────────
 
const ADMIN_IDS = [
  "5194563864", // kris
  "753274211",  // @atakell
];
 
// ─────────────────────────────────────────────
// TELEGRAM
// ─────────────────────────────────────────────
 
function getTelegramUser() {
  const tg = window.Telegram?.WebApp;
 
  if (!tg) {
    console.warn("Telegram WebApp не найден. Тестовый режим.");
    return { id: 5194563864, first_name: "Тест", username: "test_admin" };
  }
 
  tg.ready();
  tg.expand();
 
  return tg.initDataUnsafe?.user ?? null;
}
 
function isAdmin(telegramUser) {
  if (!telegramUser) return false;
  return ADMIN_IDS.includes(String(telegramUser.id));
}
 
// ─────────────────────────────────────────────
// ДОБАВЛЕНИЕ ВСТРЕЧИ
// ─────────────────────────────────────────────
 
function showFeedback(elId, message, isError = false) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#c0392b" : "#a8c5a0";
 
  setTimeout(() => { el.textContent = ""; }, 4000);
}
 
async function addMeeting() {
  const title    = document.getElementById("newBookTitle").value.trim();
  const author   = document.getElementById("newBookAuthor").value.trim();
  const cover    = document.getElementById("newBookCover").value.trim();
  const date     = document.getElementById("newMeetingDate").value.trim();
  const time     = document.getElementById("newMeetingTime").value.trim();
  const place    = document.getElementById("newMeetingPlace").value.trim();
  const desc     = document.getElementById("newMeetingDesc").value.trim();
  const isActive = document.getElementById("newMeetingActive").checked;
 
  if (!title || !author || !date || !time) {
    showFeedback("addMeetingFeedback", "Заполни название, автора, дату и время", true);
    return;
  }
 
  const btn = document.getElementById("addMeetingButton");
  btn.textContent = "Добавляем...";
  btn.disabled    = true;
 
  if (isActive) {
    await db
      .from("meetings")
      .update({ is_active: false })
      .eq("is_active", true);
  }
 
  const { error } = await db
    .from("meetings")
    .insert({
      book_title:   title,
      book_author:  author,
      book_cover:   cover || null,
      meeting_date: date,
      meeting_time: time,
      place:        place || null,
      description:  desc || null,
      is_active:    isActive,
    });
 
  btn.textContent = "Добавить встречу";
  btn.disabled    = false;
 
  if (error) {
    console.error("Ошибка добавления встречи:", error.message);
    showFeedback("addMeetingFeedback", "Ошибка: " + error.message, true);
    return;
  }
 
  ["newBookTitle", "newBookAuthor", "newBookCover", "newMeetingDate",
   "newMeetingTime", "newMeetingPlace", "newMeetingDesc"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("newMeetingActive").checked = true;
 
  showFeedback("addMeetingFeedback", "Встреча добавлена ✓");
  await loadMeetingsSelect();
}
 
// ─────────────────────────────────────────────
// ОТМЕТКА ПРИСУТСТВИЯ
// ─────────────────────────────────────────────
 
async function loadMeetingsSelect() {
  const select = document.getElementById("attendanceMeetingSelect");
  if (!select) return;
 
  const { data: meetings, error } = await db
    .from("meetings")
    .select("id, book_title, meeting_date, is_active")
    .order("id", { ascending: false });
 
  if (error) {
    console.error("Ошибка загрузки встреч:", error.message);
    return;
  }
 
  select.innerHTML = `<option value="">Выбери встречу...</option>`;
 
  meetings.forEach((m) => {
    const opt = document.createElement("option");
    opt.value       = m.id;
    opt.textContent = `«${m.book_title}» — ${m.meeting_date}${m.is_active ? " 🟢" : ""}`;
    select.appendChild(opt);
  });
}
 
async function loadAttendanceList(meetingId) {
  const listEl  = document.getElementById("attendanceList");
  const saveBtn = document.getElementById("saveAttendanceButton");
 
  if (!listEl) return;
 
  listEl.innerHTML = `<p class="admin__hint">Загружаем...</p>`;
 
  const { data: records, error } = await db
    .from("attendance")
    .select(`
      id,
      attended,
      users (
        id,
        name,
        username
      )
    `)
    .eq("meeting_id", meetingId);
 
  if (error) {
    console.error("Ошибка загрузки списка:", error.message);
    listEl.innerHTML = `<p class="admin__hint">Ошибка загрузки</p>`;
    return;
  }
 
  if (!records || records.length === 0) {
    listEl.innerHTML = `<p class="admin__hint">Никто не записался на эту встречу</p>`;
    saveBtn.style.display = "none";
    return;
  }
 
  listEl.innerHTML = "";
 
  records.forEach((record) => {
    const item = document.createElement("div");
    item.className = "admin__attendance-item";
 
    item.innerHTML = `
      <label class="admin__attendance-label">
        <input
          type="checkbox"
          class="admin__attendance-checkbox"
          data-record-id="${record.id}"
          ${record.attended ? "checked" : ""}
        >
        <span class="admin__attendance-name">${record.users.name}</span>
        <span class="admin__attendance-username">${record.users.username || ""}</span>
      </label>
    `;
 
    listEl.appendChild(item);
  });
 
  saveBtn.style.display = "block";
}
 
async function saveAttendance() {
  const checkboxes = document.querySelectorAll(".admin__attendance-checkbox");
  const saveBtn    = document.getElementById("saveAttendanceButton");
 
  if (checkboxes.length === 0) return;
 
  saveBtn.textContent = "Сохраняем...";
  saveBtn.disabled    = true;
 
  const updates = Array.from(checkboxes).map((cb) => {
    return db
      .from("attendance")
      .update({ attended: cb.checked })
      .eq("id", cb.dataset.recordId);
  });
 
  const results  = await Promise.all(updates);
  const hasError = results.some(({ error }) => error);
 
  saveBtn.textContent = "Сохранить отметки";
  saveBtn.disabled    = false;
 
  if (hasError) {
    showFeedback("saveAttendanceFeedback", "Некоторые отметки не сохранились", true);
  } else {
    showFeedback("saveAttendanceFeedback", "Отметки сохранены ✓");
  }
}
 
// ─────────────────────────────────────────────
// ЗАВЕРШЕНИЕ ВСТРЕЧИ
// ─────────────────────────────────────────────
 
async function closeMeeting(meetingId) {
  const btn = document.getElementById("closeMeetingButton");
 
  const confirmed = confirm("Завершить встречу? Она пропадёт с главной страницы.");
  if (!confirmed) return;
 
  btn.textContent = "Завершаем...";
  btn.disabled    = true;
 
  const { error } = await db
    .from("meetings")
    .update({ is_active: false })
    .eq("id", meetingId);
 
  btn.textContent = "Завершить встречу";
  btn.disabled    = false;
 
  if (error) {
    showFeedback("closeMeetingFeedback", "Ошибка: " + error.message, true);
    return;
  }
 
  showFeedback("closeMeetingFeedback", "Встреча завершена ✓");
  btn.style.display = "none";
 
  // Обновляем селект чтобы убрать зелёный кружок
  await loadMeetingsSelect();
}
 
// ─────────────────────────────────────────────
// ИНИЦИАЛИЗАЦИЯ
// ─────────────────────────────────────────────
 
async function initAdminPage() {
  const telegramUser = getTelegramUser();
 
  const deniedEl  = document.getElementById("adminDenied");
  const contentEl = document.getElementById("adminContent");
 
  if (!isAdmin(telegramUser)) {
    deniedEl.style.display  = "block";
    contentEl.style.display = "none";
    return;
  }
 
  contentEl.style.display = "block";
 
  document.getElementById("addMeetingButton")
    .addEventListener("click", addMeeting);
 
  await loadMeetingsSelect();
 
  document.getElementById("attendanceMeetingSelect")
    .addEventListener("change", async (e) => {
      const meetingId = e.target.value;
      const closeBtn  = document.getElementById("closeMeetingButton");
 
      if (!meetingId) {
        document.getElementById("attendanceList").innerHTML =
          `<p class="admin__hint">Выбери встречу чтобы увидеть список</p>`;
        document.getElementById("saveAttendanceButton").style.display = "none";
        closeBtn.style.display = "none";
        return;
      }
 
      await loadAttendanceList(meetingId);
 
      // Показываем кнопку завершения только для активных встреч
      const { data } = await db
        .from("meetings")
        .select("is_active")
        .eq("id", meetingId)
        .single();
 
      if (data?.is_active) {
        closeBtn.style.display = "block";
        closeBtn.onclick = () => closeMeeting(meetingId);
      } else {
        closeBtn.style.display = "none";
      }
    });
 
  document.getElementById("saveAttendanceButton")
    .addEventListener("click", saveAttendance);
 
  console.log("Админ-панель готова");
}

 
initAdminPage();