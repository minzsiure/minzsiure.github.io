// js/api.js
const LOG_TRIAL_URL = "https://piybvpftfzevmvhkcbgi.functions.supabase.co/log_trial";

export async function logTrialToSupabase({ password, row }) {
  const res = await fetch(LOG_TRIAL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, row }),
  });

  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out?.error || `HTTP ${res.status}`);
  return out;
}
