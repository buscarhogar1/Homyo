// bh-conversations.js
// Conversaciones del interesado con las inmobiliarias.
// Se guardan en Supabase (tablas conversations / messages, ver supabase/07-mensajes.sql)
// y se mantiene una copia local para que las páginas sigan siendo instantáneas.
// Si Supabase aún no tiene las tablas, funciona solo en local como antes.
import { supabase } from "./bh-user-data.js";

const STORAGE_KEY_PREFIX = "homyo_conversations:";

function storageKey(userId){
  return STORAGE_KEY_PREFIX + (userId || "anon");
}

function safeRead(userId){
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(userId, list){
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(list));
  } catch (e){
    console.warn("No se pudo guardar la conversación", e);
  }
}

function warn(where, e){ console.warn("[conversaciones] " + where, e && (e.message || e)); }

/* ---------- Servidor ---------- */
function mapServer(c){
  const msgs = (c.messages || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return {
    listing_id: c.listing_id,
    listing_snapshot: c.listing_snapshot || null,
    status: c.status,
    visit_label: c.visit_label || null,
    messages: msgs.map(m => ({
      id: m.id,
      direction: m.sender === "buyer" ? "out" : "in",
      author: m.sender === "buyer" ? "Tú" : (m.author_name || (c.listing_snapshot && c.listing_snapshot.agency_name) || "Inmobiliaria"),
      kind: m.kind,
      body: m.body || "",
      visit: m.visit || null,
      created_at: m.created_at
    })),
    created_at: c.created_at,
    last_message_at: c.last_message_at,
    unread_count: c.buyer_unread || 0,
    synced: true
  };
}

// Trae las conversaciones del servidor y las guarda en local. Devuelve true si ha podido.
export async function syncFromServer(userId){
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("id, listing_id, listing_snapshot, status, visit_label, created_at, last_message_at, buyer_unread, buyer_hidden, messages(id, sender, author_name, kind, body, visit, created_at)")
      .eq("user_id", userId)
      .eq("buyer_hidden", false);
    if (error) throw error;
    const server = (data || []).map(mapServer);
    const ids = new Set(server.map(c => String(c.listing_id)));
    const localOnly = safeRead(userId).filter(c => !c.synced && !ids.has(String(c.listing_id)));
    safeWrite(userId, server.concat(localOnly));
    return true;
  } catch (e){ warn("sync", e); return false; }
}

export async function markRead(userId, listingId){
  try { await supabase.rpc("buyer_mark_read", { p_listing_id: listingId }); } catch (e){ warn("markRead", e); }
  const all = safeRead(userId), c = all.find(x => String(x.listing_id) === String(listingId));
  if (c){ c.unread_count = 0; safeWrite(userId, all); }
}

/* ---------- API de siempre (síncrona, local) + envío al servidor ---------- */
export function listConversations(userId){
  const all = safeRead(userId);
  return [...all].sort((a,b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
}

export function getConversation(userId, listingId){
  if (!listingId) return null;
  return safeRead(userId).find(c => String(c.listing_id) === String(listingId)) || null;
}

export function addOrUpdateConversation(userId, payload){
  if (!payload || !payload.listing_id) throw new Error("listing_id required");
  // Al servidor solo van los mensajes reales del interesado (no los avisos automáticos locales)
  const mine = (payload.new_messages || []).filter(m => m.direction === "out");
  const text = mine.filter(m => m.kind === "message").map(m => m.body).join("\n\n");
  const visit = (mine.find(m => m.kind === "visit_request") || {}).visit || null;
  const local = (payload.new_messages || []).filter(m => m.kind !== "auto");
  if (text){
    const args = { p_listing_id: payload.listing_id, p_body: text, p_visit: visit, p_name: payload.buyer_name || null, p_phone: payload.buyer_phone || null };
    supabase.rpc("start_conversation", args)
      .then(({ error }) => {
        // Si aún no está el paso 14 en Supabase, se envía sin teléfono
        if (error && /p_phone|function|schema cache/i.test(error.message || "")) { delete args.p_phone; return supabase.rpc("start_conversation", args); }
        return { error };
      })
      .then(({ error }) => { if (error) warn("start", error); else syncFromServer(userId); }, e => warn("start", e));
  }
  const all = safeRead(userId);
  const idx = all.findIndex(c => String(c.listing_id) === String(payload.listing_id));
  const now = new Date().toISOString();
  if (idx === -1){
    all.push({
      listing_id: payload.listing_id,
      listing_snapshot: payload.listing_snapshot || null,
      messages: local,
      created_at: now,
      last_message_at: local.length ? local[local.length-1].created_at : now,
      unread_count: 0
    });
  } else {
    const conv = all[idx];
    if (payload.listing_snapshot) conv.listing_snapshot = payload.listing_snapshot;
    if (local.length){
      conv.messages = [...(conv.messages || []), ...local];
      conv.last_message_at = local[local.length-1].created_at;
    }
    all[idx] = conv;
  }
  safeWrite(userId, all);
  return all[idx === -1 ? all.length-1 : idx];
}

export function appendMessage(userId, listingId, message){
  if (!listingId || !message) return null;
  const all = safeRead(userId);
  const idx = all.findIndex(c => String(c.listing_id) === String(listingId));
  if (idx === -1) return null;
  const conv = all[idx];
  const msg = {
    id: message.id || ("m_" + Date.now() + "_" + Math.random().toString(36).slice(2,8)),
    direction: message.direction || "out",
    author: message.author || "Tú",
    kind: message.kind || "message",
    body: message.body || "",
    visit: message.visit || null,
    created_at: message.created_at || new Date().toISOString()
  };
  conv.messages = [...(conv.messages || []), msg];
  conv.last_message_at = msg.created_at;
  all[idx] = conv;
  safeWrite(userId, all);
  if (msg.direction === "out" && msg.body){
    supabase.rpc("buyer_send_message", { p_listing_id: listingId, p_body: msg.body })
      .then(({ error }) => { if (error) warn("send", error); }, e => warn("send", e));
  }
  return msg;
}

export function deleteConversation(userId, listingId){
  if (!listingId) return;
  supabase.rpc("buyer_hide_conversation", { p_listing_id: listingId }).then(() => {}, e => warn("hide", e));
  const all = safeRead(userId).filter(c => String(c.listing_id) !== String(listingId));
  safeWrite(userId, all);
}

export function countConversations(userId){
  return safeRead(userId).length;
}
