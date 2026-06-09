
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
  allParticipants: [], // полный список для поиска
};
 
// ─────────────────────────────────────────────
// СТАТИСТИКА КЛУБА
// ─────────────────────────────────────────────
 
async function loadClubStats() {
  const participantsCountEl = document.getElementById("participantsCount");
  const meetingsCountEl     = document.getElementById("meetingsCount");
 
  // Количество участников
  const { count: usersCount, error: usersError } = await db
    .from("users")
    .select("*", { count: "exact", head: true });
 
  if (!usersError && participantsCountEl) {
    participantsCountEl.textContent = usersCount ?? 0;
  }
 
  // Общее количество посещённых встреч (attended = true)
  const { count: attendedCount, error: attendedError } = await db
    .from("attendance")
    .select("*", { count: "exact", head: true })
    .eq("attended", true);
 
  if (!attendedError && meetingsCountEl) {
    meetingsCountEl.textContent = attendedCount ?? 0;
  }
}
 
// ─────────────────────────────────────────────
// РЕНДЕР УЧАСТНИКОВ
// ─────────────────────────────────────────────
 
function renderParticipants(participants) {
  const container = document.getElementById("participantsList");
  if (!container) return;
 
  if (participants.length === 0) {
    container.innerHTML = `<p class="participants__empty">Никого не найдено</p>`;
    return;
  }
 
  container.innerHTML = "";
 
  participants.forEach((user) => {
    const card = document.createElement("div");
    card.className = "participants__content-item";
 
    const avatarSrc = user.avatar_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Ccircle cx='40' cy='40' r='40' fill='%23281e18'/%3E%3Ccircle cx='40' cy='32' r='14' fill='%23a58352' opacity='0.6'/%3E%3Cellipse cx='40' cy='68' rx='22' ry='16' fill='%23a58352' opacity='0.6\'/%3E%3C/svg%3E";
 
    card.innerHTML = `
      <img
        src="${avatarSrc}"
        alt="${user.name}"
        class="participants__content-item-image"
        onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'80\' height=\'80\' viewBox=\'0 0 80 80\'%3E%3Ccircle cx=\'40\' cy=\'40\' r=\'40\' fill=\'%23281e18\'/%3E%3Ccircle cx=\'40\' cy=\'32\' r=\'14\' fill=\'%23a58352\' opacity=\'0.6\'/%3E%3Cellipse cx=\'40\' cy=\'68\' rx=\'22\' ry=\'16\' fill=\'%23a58352\' opacity=\'0.6\'/%3E%3C/svg%3E'"
      >
      <p class="participants__content-item-name">${user.name}</p>
      <button class="participants__content-item-button" data-user-id="${user.id}">
        Профиль
      </button>
    `;
 
    card.querySelector("button").addEventListener("click", () => {
      window.location.href = `user.html?id=${user.id}`;
    });
 
    container.appendChild(card);
  });
}
 
// ─────────────────────────────────────────────
// ЗАГРУЗКА УЧАСТНИКОВ
// ─────────────────────────────────────────────
 
async function loadParticipants() {
  const container = document.getElementById("participantsList");
  if (!container) return;
 
  container.innerHTML = `<p class="participants__empty">Загружаем...</p>`;
 
  const { data: users, error } = await db
    .from("users")
    .select("*")
    .order("name", { ascending: true });
 
  if (error) {
    console.error("Ошибка загрузки участников:", error.message);
    container.innerHTML = `<p class="participants__empty">Не удалось загрузить участников</p>`;
    return;
  }
 
  state.allParticipants = users || [];
  renderParticipants(state.allParticipants);
}
 
// ─────────────────────────────────────────────
// ПОИСК
// ─────────────────────────────────────────────
 
function initSearch() {
  const input = document.getElementById("participantsSearch");
  if (!input) return;
 
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
 
    if (!query) {
      renderParticipants(state.allParticipants);
      return;
    }
 
    const filtered = state.allParticipants.filter((user) =>
      user.name.toLowerCase().includes(query) ||
      (user.username && user.username.toLowerCase().includes(query))
    );
 
    renderParticipants(filtered);
  });
}
 
// ─────────────────────────────────────────────
// ИНИЦИАЛИЗАЦИЯ
// ─────────────────────────────────────────────
 
async function initParticipantsPage() {
  await Promise.all([
    loadClubStats(),
    loadParticipants(),
  ]);
 
  initSearch();
 
  console.log("Страница участников готова");
}
 
initParticipantsPage();