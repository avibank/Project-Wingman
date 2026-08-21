import { supabase } from "./supabaseClient.js";

export async function fetchEnrollments(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("enrollments")
    .select("module_code")
    .eq("user_id", userId);
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []).map((row) => row.module_code);
}

export async function enrollInModule(userId, moduleCode) {
  if (!userId) return false;
  const { error } = await supabase
    .from("enrollments")
    .insert({ user_id: userId, module_code: moduleCode });
  if (error) {
    console.error(error);
    return false;
  }
  return true;
}
