

// ─────────────────────────────────────────────
// КОНФИГУРАЦИЯ
// ─────────────────────────────────────────────
 
const SUPABASE_URL = "https://fbvrfykgbfkgpfrdnwvg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZidnJmeWtnYmZrZ3BmcmRud3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzA4NDksImV4cCI6MjA5NTcwNjg0OX0.3W43-HLEdlWAqDhuPNYiC14voju7v1usqiS2gLRp-NA";
 
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
 
// ─────────────────────────────────────────────
// ПОЛУЧАЕМ ID ИЗ URL
// ─────────────────────────────────────────────
 
function getUserIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}
 
// ─────────────────────────────────────────────
// ЗАГРУЗКА ПРОФИЛЯ УЧАСТНИКА
// ─────────────────────────────────────────────
 
async function loadUserProfile(userId) {
  // Данные пользователя
  const { data: user, error: userError } = await db
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();
 
  if (userError || !user) {
    console.error("Пользователь не найден");
    document.getElementById("userName").textContent = "Участник не найден";
    return;
  }
 
  // Имя и аватар
  document.getElementById("userName").textContent = user.name;
  document.getElementById("userUsername").textContent = user.username || "";
 
  if (user.avatar_url) {
    const avatar = document.getElementById("userAvatar");
    if (avatar) avatar.src = user.avatar_url;
  }
 
  // Посещённые встречи
  const { data: attended, error: attendedError } = await db
    .from("attendance")
    .select("*")
    .eq("user_id", userId)
    .eq("attended", true);
 
  const meetingsCount = attendedError ? 0 : (attended?.length ?? 0);
  document.getElementById("userMeetingsCount").textContent = meetingsCount;
 
  // Цитаты
  const { data: quotes, error: quotesError } = await db
    .from("quotes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
 
  const quotesList = document.getElementById("userQuotesList");
  const quotesCount = quotesError ? 0 : (quotes?.length ?? 0);
  document.getElementById("userQuotesCount").textContent = quotesCount;
 
  if (!quotesError && quotes && quotes.length > 0) {
    quotesList.innerHTML = "";
    quotes.forEach((quote) => {
      quotesList.innerHTML += `
        <div class="profile__quotes-item">
          <p class="profile__quote-text">«${quote.quote_text}»</p>
          ${quote.quote_author ? `<p class="profile__quote-author">${quote.quote_author}</p>` : ""}
        </div>
      `;
    });
  } else {
    quotesList.innerHTML = `<p class="profile__empty">Цитат пока нет</p>`;
  }
}
 
// ─────────────────────────────────────────────
// КНОПКА НАЗАД
// ─────────────────────────────────────────────
 
function initBackButton() {
  const btn = document.getElementById("backButton");
  if (!btn) return;
 
  btn.addEventListener("click", () => {
    window.history.back();
  });
}
 
// ─────────────────────────────────────────────
// ИНИЦИАЛИЗАЦИЯ
// ─────────────────────────────────────────────
 
async function initUserPage() {
  const userId = getUserIdFromUrl();
 
  if (!userId) {
    console.error("ID пользователя не передан в URL");
    document.getElementById("userName").textContent = "Участник не найден";
    return;
  }
 
  initBackButton();
  await loadUserProfile(userId);
 
  console.log("Страница участника готова, id:", userId);
}
 
initUserPage();