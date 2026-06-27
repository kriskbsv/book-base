
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
 
const COVER_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='70'%3E%3Crect width='50' height='70' rx='8' fill='%23241b14'/%3E%3Crect x='14' y='20' width='22' height='3' rx='1.5' fill='%23a58352' opacity='0.5'/%3E%3Crect x='14' y='28' width='22' height='3' rx='1.5' fill='%23a58352' opacity='0.5'/%3E%3Crect x='14' y='36' width='14' height='3' rx='1.5' fill='%23a58352' opacity='0.5'/%3E%3C/svg%3E";

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ── ТРЕКЕР НАГРАД (каждая 5-я встреча) ──
function renderRewardTracker(attendedCount) {
  const el = document.getElementById("rewardTracker");
  if (!el) return;

  const cycle       = attendedCount % 5;
  const rewardReady = attendedCount > 0 && cycle === 0;
  const filled      = rewardReady ? 5 : cycle;
  const remaining   = rewardReady ? 0 : 5 - cycle;

  const plural = (n) => {
    const n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return "встреча";
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return "встречи";
    return "встреч";
  };

  let segments = "";
  for (let i = 1; i <= 5; i++) {
    segments += `<div class="tracker__seg ${i <= filled ? "is-filled" : ""}"></div>`;
  }
  segments += `<div class="tracker__seg tracker__seg--gift ${rewardReady ? "is-filled" : ""}">🎁</div>`;

  const note = rewardReady
    ? `<b>Подарок ждёт тебя</b> на ближайшей встрече клуба ✨`
    : `Ещё <b>${remaining}</b> ${plural(remaining)} до награды`;

  el.innerHTML = `
    <div class="tracker__top">
      <span class="tracker__label">До награды</span>
      <span class="tracker__count">Посещено: <b>${attendedCount}</b></span>
    </div>
    <div class="tracker__segments">${segments}</div>
    <p class="tracker__note">${note}</p>
  `;
  el.style.display = "block";
}

// ── ОЦЕНКА КНИГИ (звёзды) ──
async function updateRating(attendanceId, rating, starsEl) {
  starsEl.querySelectorAll(".stars__star").forEach((s, i) => {
    s.classList.toggle("is-on", i < rating);
  });

  const { error } = await db
    .from("attendance")
    .update({ rating })
    .eq("id", attendanceId);

  if (error) console.error("Ошибка сохранения оценки:", error.message);
}

function starsMarkup(rating) {
  let out = "";
  for (let i = 1; i <= 5; i++) {
    out += `<span class="stars__star ${i <= (rating || 0) ? "is-on" : ""}" data-value="${i}">★</span>`;
  }
  return out;
}

async function loadVisitedMeetings(userId) {
  const listEl  = document.getElementById("visitedMeetingsList");
  const countEl = document.getElementById("visitedMeetingsCount");

  const { data, error } = await db
    .from("attendance")
    .select(`
      id,
      rating,
      meetings (
        book_title,
        book_author,
        book_cover,
        meeting_date
      )
    `)
    .eq("user_id", userId)
    .eq("attended", true);

  if (error) {
    console.error("Ошибка загрузки встреч:", error.message);
    return;
  }

  const count = data.length;
  if (countEl) countEl.textContent = count;
  renderRewardTracker(count);

  if (!listEl) return;

  if (count === 0) {
    listEl.innerHTML = `<p class="profile__empty">Полка пока пуста — приходи на встречу, и сюда встанет первая книга</p>`;
    return;
  }

  listEl.innerHTML = "";
  data.forEach((item) => {
    const m = item.meetings || {};
    const card = document.createElement("div");
    card.className = "shelf-item";
    card.innerHTML = `
      <img class="shelf-item__cover" src="${m.book_cover || COVER_FALLBACK}"
           onerror="this.src='${COVER_FALLBACK}'" alt="${escapeHtml(m.book_title)}">
      <div class="shelf-item__info">
        <p class="shelf-item__title">«${escapeHtml(m.book_title)}»</p>
        <p class="shelf-item__date">${escapeHtml(m.book_author || m.meeting_date || "")}</p>
        <div class="stars">${starsMarkup(item.rating)}</div>
      </div>
    `;

    const starsEl = card.querySelector(".stars");
    starsEl.querySelectorAll(".stars__star").forEach((star) => {
      star.addEventListener("click", () => {
        updateRating(item.id, Number(star.dataset.value), starsEl);
      });
    });

    listEl.appendChild(card);
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