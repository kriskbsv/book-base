
// ─────────────────────────────────────────────
// КОНФИГУРАЦИЯ
// ─────────────────────────────────────────────
 
const SUPABASE_URL = "https://fbvrfykgbfkgpfrdnwvg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZidnJmeWtnYmZrZ3BmcmRud3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzA4NDksImV4cCI6MjA5NTcwNjg0OX0.3W43-HLEdlWAqDhuPNYiC14voju7v1usqiS2gLRp-NA";
 
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
 
// ─────────────────────────────────────────────
// АДМИНЫ
// ─────────────────────────────────────────────
 
const ADMIN_IDS = ["5194563864", "753274211"];
 
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
    return null;
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
// АВАТАР
// ─────────────────────────────────────────────
 
async function uploadAvatar(file, previewModal) {
  const fileExt  = file.name.split(".").pop();
  const fileName = `${state.currentUser.id}.${fileExt}`;
 
  const { error: uploadError } = await db.storage
    .from("avatar")
    .upload(fileName, file, { upsert: true });
 
  if (uploadError) {
    console.error("Ошибка загрузки фото:", uploadError.message);
    closeAvatarModal(previewModal);
    return;
  }
 
  const { data } = db.storage
    .from("avatar")
    .getPublicUrl(fileName);
 
  const avatarUrl = data.publicUrl;
 
  const { error: updateError } = await db
    .from("users")
    .update({ avatar_url: avatarUrl })
    .eq("id", state.currentUser.id);
 
  if (updateError) {
    console.error("Ошибка сохранения ссылки:", updateError.message);
    closeAvatarModal(previewModal);
    return;
  }
 
  // Обновляем аватар на странице
  const avatarEl = document.getElementById("profileAvatar");
  if (avatarEl) avatarEl.src = avatarUrl + "?t=" + Date.now();
 
  closeAvatarModal(previewModal);
}
 
function closeAvatarModal(modal) {
  if (modal) modal.remove();
}
 
function showAvatarPreview(file, input) {
  const reader = new FileReader();
 
  reader.onload = (e) => {
    const previewSrc = e.target.result;
 
    // Создаём модальное окно с превью
    const modal = document.createElement("div");
    modal.className = "avatar-modal";
    modal.innerHTML = `
      <div class="avatar-modal__overlay"></div>
      <div class="avatar-modal__content">
        <h3 class="avatar-modal__title">Новое фото</h3>
        <div class="avatar-modal__preview-wrapper">
          <img src="${previewSrc}" class="avatar-modal__preview" alt="Превью">
        </div>
        <p class="avatar-modal__hint">Так будет выглядеть твой аватар</p>
        <div class="avatar-modal__buttons">
          <button class="avatar-modal__cancel">Отмена</button>
          <button class="avatar-modal__save">Сохранить</button>
        </div>
      </div>
    `;
 
    document.body.appendChild(modal);
 
    // Отмена
    modal.querySelector(".avatar-modal__cancel").addEventListener("click", () => {
      closeAvatarModal(modal);
      input.value = ""; // сбрасываем выбор файла
    });
 
    modal.querySelector(".avatar-modal__overlay").addEventListener("click", () => {
      closeAvatarModal(modal);
      input.value = "";
    });
 
    // Сохранить
    const saveBtn = modal.querySelector(".avatar-modal__save");
    saveBtn.addEventListener("click", async () => {
      saveBtn.textContent = "Сохраняем...";
      saveBtn.disabled    = true;
      await uploadAvatar(file, modal);
    });
  };
 
  reader.readAsDataURL(file);
}
 
function initAvatarUpload() {
  const avatarEl = document.getElementById("profileAvatar");
  if (!avatarEl) return;
 
  const input    = document.createElement("input");
  input.type     = "file";
  input.accept   = "image/*";
 
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
 
    if (file.size > 5 * 1024 * 1024) {
      alert("Фото слишком большое. Максимум 5MB.");
      return;
    }
 
    showAvatarPreview(file, input);
  });
 
  avatarEl.style.cursor = "pointer";
  avatarEl.addEventListener("click", () => input.click());
}
 
// ─────────────────────────────────────────────
// ПОСЕЩЁННЫЕ ВСТРЕЧИ
// ─────────────────────────────────────────────
 
async function loadVisitedMeetings(userId) {
  const listEl  = document.getElementById("visitedMeetingsList");
  const countEl = document.getElementById("visitedMeetingsCount");
 
  const { data, error } = await db
    .from("attendance")
    .select(`
      *,
      meetings (
        book_title,
        meeting_date
      )
    `)
    .eq("user_id", userId)
    .eq("attended", true);
 
  if (error) {
    console.error("Ошибка загрузки встреч:", error.message);
    return;
  }
 
  if (countEl) countEl.textContent = data.length;
 
  if (!listEl) return;
 
  if (data.length === 0) {
    listEl.innerHTML = `<p class="profile__empty">Пока нет посещённых встреч</p>`;
    return;
  }
 
  listEl.innerHTML = "";
  data.forEach((item) => {
    listEl.innerHTML += `
      <div class="profile__visited-item">
        <div class="profile__visited-info">
          <p class="profile__visited-title">«${item.meetings.book_title}»</p>
          <p class="profile__visited-date">${item.meetings.meeting_date}</p>
        </div>
        <span class="profile__visited-status">✓</span>
      </div>
    `;
  });
}
 
// ─────────────────────────────────────────────
// ЦИТАТЫ
// ─────────────────────────────────────────────
 
async function loadQuotes(userId) {
  const listEl  = document.getElementById("quotesList");
  const countEl = document.getElementById("quotesCount");
 
  const { data, error } = await db
    .from("quotes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
 
  if (error) {
    console.error("Ошибка загрузки цитат:", error.message);
    return;
  }
 
  if (countEl) countEl.textContent = data.length;
  if (!listEl) return;
 
  renderQuotes(data, listEl);
}
 
function renderQuotes(quotes, listEl) {
  if (quotes.length === 0) {
    listEl.innerHTML = `<p class="profile__empty">Пока нет цитат — добавь первую!</p>`;
    return;
  }
 
  listEl.innerHTML = "";
  quotes.forEach((quote) => {
    listEl.innerHTML += `
      <div class="profile__quotes-item">
        <p class="profile__quote-text">«${quote.quote_text}»</p>
        ${quote.quote_author ? `<p class="profile__quote-author">${quote.quote_author}</p>` : ""}
      </div>
    `;
  });
}
 
// ─────────────────────────────────────────────
// МОДАЛЬНОЕ ОКНО ЦИТАТЫ
// ─────────────────────────────────────────────
 
function openModal() {
  const modal = document.getElementById("quoteModal");
  if (!modal) return;
  modal.classList.add("modal_open");
  document.getElementById("quoteText").focus();
}
 
function closeModal() {
  const modal = document.getElementById("quoteModal");
  if (!modal) return;
  modal.classList.remove("modal_open");
 
  document.getElementById("quoteText").value   = "";
  document.getElementById("quoteAuthor").value = "";
}
 
async function submitQuote() {
  if (!state.currentUser) return;
 
  const text   = document.getElementById("quoteText").value.trim();
  const author = document.getElementById("quoteAuthor").value.trim();
 
  if (!text) {
    document.getElementById("quoteText").focus();
    return;
  }
 
  const submitBtn = document.getElementById("quoteModalSubmit");
  submitBtn.textContent = "Сохраняем...";
  submitBtn.disabled    = true;
 
  const { error } = await db
    .from("quotes")
    .insert({
      user_id:      state.currentUser.id,
      quote_text:   text,
      quote_author: author || null,
    });
 
  submitBtn.textContent = "Сохранить";
  submitBtn.disabled    = false;
 
  if (error) {
    console.error("Ошибка сохранения цитаты:", error.message);
    return;
  }
 
  closeModal();
  await loadQuotes(state.currentUser.id);
}
 
function initModal() {
  const addBtn    = document.getElementById("addQuoteButton");
  const cancelBtn = document.getElementById("quoteModalCancel");
  const submitBtn = document.getElementById("quoteModalSubmit");
  const overlay   = document.getElementById("quoteModalOverlay");
 
  if (addBtn)    addBtn.addEventListener("click", openModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  if (submitBtn) submitBtn.addEventListener("click", submitQuote);
  if (overlay)   overlay.addEventListener("click", closeModal);
}
 
// ─────────────────────────────────────────────
// ИНИЦИАЛИЗАЦИЯ
// ─────────────────────────────────────────────
 
async function initProfilePage() {
  const telegramUser = getTelegramUser();
 
  if (!telegramUser) {
    console.warn("Не удалось получить пользователя Telegram");
    return;
  }
 
  state.currentUser = await registerOrFindUser(telegramUser);
 
  if (!state.currentUser) return;
 
  // Имя
  const nameEl = document.getElementById("profileName");
  if (nameEl) nameEl.textContent = state.currentUser.name;
 
  // Аватар
  const avatarEl = document.getElementById("profileAvatar");
  if (avatarEl && state.currentUser.avatar_url) {
    avatarEl.src = state.currentUser.avatar_url;
  }
  initAvatarUpload();
 
  // Ссылка на админку — только для админов
  if (ADMIN_IDS.includes(String(state.currentUser.telegram_id))) {
    const adminLink = document.getElementById("adminLink");
    if (adminLink) adminLink.style.display = "block";
  }
 
  await Promise.all([
    loadVisitedMeetings(state.currentUser.id),
    loadQuotes(state.currentUser.id),
  ]);
 
  initModal();
 
  console.log("Профиль готов:", state.currentUser.name);
}
 
initProfilePage();