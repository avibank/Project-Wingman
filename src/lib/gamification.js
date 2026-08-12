import { loadJSON } from "./storage.js";

// Gamification helpers
function rankForXP(xp) {
  if (xp >= 600) return { stripes: 4, gold: true };
  if (xp >= 300) return { stripes: 3, gold: false };
  if (xp >= 100) return { stripes: 2, gold: false };
  return { stripes: 1, gold: false };
}

function tierColor(pct) {
  if (pct >= 90) return "#D4AF37"; // gold
  if (pct >= 70) return "#B9C2CC"; // silver
  if (pct >= 50) return "#B5762C"; // bronze
  return "var(--muted2)";
}

function tierLabel(pct) {
  if (pct >= 90) return "Gold";
  if (pct >= 70) return "Silver";
  if (pct >= 50) return "Bronze";
  return "Attempted";
}

// Called on every answered question — awards XP, tracks totals and the daily goal
function recordAnswer(correct) {
  const today = new Date().toDateString();
  const total = parseInt(localStorage.getItem("pw-total-answered") || "0", 10) + 1;
  localStorage.setItem("pw-total-answered", String(total));

  if (localStorage.getItem("pw-daily-date") !== today) {
    localStorage.setItem("pw-daily-date", today);
    localStorage.setItem("pw-daily-count", "0");
  }
  const dailyCount = parseInt(localStorage.getItem("pw-daily-count") || "0", 10) + 1;
  localStorage.setItem("pw-daily-count", String(dailyCount));

  if (correct) {
    const xp = parseInt(localStorage.getItem("pw-xp") || "0", 10) + 5;
    localStorage.setItem("pw-xp", String(xp));
  }
}

export { rankForXP, tierColor, tierLabel, recordAnswer };
