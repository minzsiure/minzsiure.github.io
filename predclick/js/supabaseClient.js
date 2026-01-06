import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://piybvpftfzevmvhkcbgi.supabase.co";
export const SUPABASE_ANON_KEY =
  "sb_publishable_0LDVAp4pidIU-KVWa3kusA_sEv2x835";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
