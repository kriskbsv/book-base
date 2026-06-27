// ============================================================
// BOOK BASE — напоминания о встрече в Telegram
// Запускается по расписанию (GitHub Actions) или вручную:
//   node bot/notify.js
//
// Требуются переменные окружения (см. bot/README.md):
//   BOT_TOKEN             — токен бота из BotFather
//   SUPABASE_URL          — https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY  — service_role ключ (Project Settings → API)
//   WEBAPP_URL            — адрес мини-аппа (для кнопки «Открыть»)
// ============================================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const SB_URL    = process.env.SUPABASE_URL;
const SB_KEY    = process.env.SUPABASE_SERVICE_KEY;
const WEBAPP    = process.env.WEBAPP_URL || "";

if (!BOT_TOKEN || !SB_URL || !SB_KEY) {
  console.error("Не заданы BOT_TOKEN / SUPABASE_URL / SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sb(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sendMessage(chatId, text) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (WEBAPP) {
    body.reply_markup = {
      inline_keyboard: [[{ text: "📖 Открыть клуб", web_app: { url: WEBAPP } }]],
    };
  }
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return data.ok;
}

async function main() {
  // 1) активная встреча
  const meetings = await sb("meetings?is_active=eq.true&order=id.desc&limit=1");
  if (!meetings.length) {
    console.log("Активной встречи нет — рассылка не нужна.");
    return;
  }
  const m = meetings[0];

  // 2) все пользователи
  const users = await sb("users?select=telegram_id,name");
  if (!users.length) {
    console.log("Нет пользователей.");
    return;
  }

  const place = m.place ? `\n📍 ${m.place}` : "";
  const text =
    `📚 <b>Ближайшая встреча книжного клуба</b>\n\n` +
    `«${m.book_title}» — ${m.book_author}\n` +
    `🗓 ${m.meeting_date} в ${m.meeting_time}${place}\n\n` +
    `Придёшь? Отметься в приложении 👇`;

  let sent = 0, failed = 0;
  for (const u of users) {
    if (!u.telegram_id) continue;
    try {
      const ok = await sendMessage(u.telegram_id, text);
      ok ? sent++ : failed++;
    } catch (e) {
      failed++;
      console.error(`Ошибка для ${u.name}:`, e.message);
    }
    await sleep(120); // бережём лимиты Telegram (~30 сообщений/сек)
  }

  console.log(`Готово. Отправлено: ${sent}, не доставлено: ${failed}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
