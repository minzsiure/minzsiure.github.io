// supabase/functions/log_trial/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Payload = {
  password?: unknown;
  row?: unknown;
};

function corsHeaders(origin: string | null) {
  // If you want to lock this down later, replace "*" with your GitHub Pages origin
  // e.g. "https://eva-xie.github.io"
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers":
      "content-type, authorization, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(
  status: number,
  body: Record<string, unknown>,
  origin: string | null
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

serve(async (req) => {
  const origin = req.headers.get("origin");

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" }, origin);
  }

  // Secrets (set these with `supabase secrets set ...`)
  const EDGE_PASSWORD = Deno.env.get("EDGE_PASSWORD");
  const PROJECT_URL = Deno.env.get("PROJECT_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");

  if (!EDGE_PASSWORD || !PROJECT_URL || !SERVICE_ROLE_KEY) {
    return json(
      500,
      {
        ok: false,
        error:
          "Missing env vars (EDGE_PASSWORD / PROJECT_URL / SERVICE_ROLE_KEY)",
      },
      origin
    );
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" }, origin);
  }

  const { password, row } = (payload ?? {}) as Payload;

  if (typeof password !== "string" || password.length === 0) {
    return json(400, { ok: false, error: "Missing password" }, origin);
  }

  if (password !== EDGE_PASSWORD) {
    return json(401, { ok: false, error: "Wrong password" }, origin);
  }

  // If no row provided, just confirm password is correct
  if (row === undefined || row === null) {
    return json(200, { ok: true }, origin);
  }

  if (typeof row !== "object" || Array.isArray(row)) {
    return json(400, { ok: false, error: "Invalid row" }, origin);
  }

  // from here on, row is an object
  const rowObj = row as Record<string, unknown>;

  // (Optional) light sanity checks to avoid junk writes
  const required = [
    "trial_index",
    "audio_start_iso",
    "response_iso",
    "rt_ms",
    "lam_pair",
    "lam_l",
    "lam_r",
    "left_clicks_s",
    "right_clicks_s",
    "correct_choice",
    "user_choice",
    "success",
  ];
  for (const k of required) {
    if (!(k in rowObj)) {
      return json(400, { ok: false, error: `Row missing field: ${k}` }, origin);
    }
  }

  const supabaseAdmin = createClient(PROJECT_URL, SERVICE_ROLE_KEY);

  const { error } = await supabaseAdmin.from("predclick_trials").insert(rowObj);

  if (error) {
    return json(500, { ok: false, error: error.message }, origin);
  }

  return json(200, { ok: true }, origin);
});
