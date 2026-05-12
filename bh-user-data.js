import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://dpusnylssfjnksbieimj.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_tSSgJcWWRfEe2uob7SFYgw_AqcBL7KK";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getSession(){
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session || null;
}

export async function requireSession(){
  const session = await getSession();
  if (!session?.user) throw new Error("LOGIN_REQUIRED");
  return session;
}

export async function isFavorite(listingId){
  const session = await getSession();
  if (!session?.user || !listingId) return false;
  const { data, error } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", session.user.id)
    .eq("listing_id", listingId)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

export async function addFavorite(listingId){
  const session = await requireSession();
  if (!listingId) throw new Error("LISTING_ID_REQUIRED");

  const exists = await isFavorite(listingId);
  if (exists) return true;

  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: session.user.id, listing_id: listingId });
  if (error) throw error;
  return true;
}

export async function removeFavorite(listingId){
  const session = await requireSession();
  if (!listingId) throw new Error("LISTING_ID_REQUIRED");

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", session.user.id)
    .eq("listing_id", listingId);
  if (error) throw error;
  return false;
}

export async function toggleFavorite(listingId){
  const fav = await isFavorite(listingId);
  if (fav) return await removeFavorite(listingId);
  return await addFavorite(listingId);
}

export async function listFavorites(){
  await requireSession();
  const { data, error } = await supabase
    .from("my_favorites")
    .select("*")
    .order("favorited_at", { ascending:false });
  if (error) throw error;
  return data || [];
}

function cleanFiltersFromUrl(url){
  const u = new URL(url || window.location.href, window.location.href);
  const obj = {};
  u.searchParams.forEach((value, key) => { obj[key] = value; });
  obj.map_url = `${u.pathname}${u.search || ""}`;
  obj.absolute_url = u.href;
  return obj;
}

export function buildSavedSearchPayload({ name, map, url } = {}){
  const sourceUrl = url || window.location.href;
  const filters = cleanFiltersFromUrl(sourceUrl);
  const u = new URL(sourceUrl, window.location.href);

  let bounds = null;
  if (map && typeof map.getBounds === "function") {
    const b = map.getBounds();
    bounds = {
      bbox_min_lat: b.getSouthWest().lat,
      bbox_min_lng: b.getSouthWest().lng,
      bbox_max_lat: b.getNorthEast().lat,
      bbox_max_lng: b.getNorthEast().lng,
    };
  }

  const city = (u.searchParams.get("city") || "").trim();
  const mode = (u.searchParams.get("mode") || "buy").trim();
  const finalName = String(name || city || "Búsqueda guardada").trim();

  return {
    name: finalName,
    frequency: "paused",
    frequency_value: null,
    channel_email: false,
    channel_internal: false,
    active: false,
    filters: {
      ...filters,
      city,
      mode,
      saved_from: "map",
      saved_at_client: new Date().toISOString(),
    },
    ...(bounds || {})
  };
}

export async function saveCurrentSearch({ name, map, url } = {}){
  const session = await requireSession();
  const payload = buildSavedSearchPayload({ name, map, url });
  const { data, error } = await supabase
    .from("saved_searches")
    .insert({ user_id: session.user.id, ...payload })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function listSavedSearches(){
  await requireSession();
  const { data, error } = await supabase
    .from("my_saved_searches")
    .select("*")
    .order("created_at", { ascending:false });
  if (error) throw error;
  return data || [];
}

export async function deleteSavedSearch(savedSearchId){
  await requireSession();
  const { error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("id", savedSearchId);
  if (error) throw error;
}

export async function updateSavedSearchFrequency(savedSearchId, frequency){
  await requireSession();
  const map = {
    instant: { frequency:"instant", active:true, frequency_value:1, channel_email:true, channel_internal:true },
    daily: { frequency:"daily", active:true, frequency_value:1, channel_email:true, channel_internal:true },
    weekly: { frequency:"weekly", active:true, frequency_value:7, channel_email:true, channel_internal:true },
    paused: { frequency:"paused", active:false, frequency_value:null, channel_email:false, channel_internal:false },
  };
  const patch = map[frequency] || map.daily;
  const { error } = await supabase
    .from("saved_searches")
    .update(patch)
    .eq("id", savedSearchId);
  if (error) throw error;
}

export function openLoginModalOrAlert(){
  const navLogin = document.getElementById("navLogin");
  if (navLogin) navLogin.click();
  else alert("Inicia sesión para usar esta función.");
}
