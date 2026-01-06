// js/api.js
const LOG_TRIAL_URL =
  "https://piybvpftfzevmvhkcbgi.functions.supabase.co/log_trial";

async function post(payload, accessToken = null) {
  const headers = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(LOG_TRIAL_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out?.error || `HTTP ${res.status}`);
  return out;
}

// calls edge function with {password} only -> should return {ok:true} if correct
export async function verifyPassword(password) {
  return await post({ password });
}

export async function logTrialToSupabase({ password, row }) {
  return await post({ password, row });
}
