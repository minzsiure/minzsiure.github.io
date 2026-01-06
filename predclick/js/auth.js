import { supabase } from "./supabaseClient.js";

function usernameToEmail(username) {
  return `${username}@predclick.local`;
}

export async function signUpUsername(username, password) {
  const email = usernameToEmail(username);
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) throw error;
}

export async function signInUsername(username, password) {
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data.session; // contains access_token
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}
