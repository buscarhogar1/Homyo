// bh-conversations.js
// Lightweight client-side storage for "anuncios contactados" — local-only MVP.
// Each user has a list of conversations keyed by listing_id. When the backend
// is ready this module can be swapped for Supabase-backed calls without
// touching the pages that import it.

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

export function listConversations(userId){
  const all = safeRead(userId);
  // newest first
  return [...all].sort((a,b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
}

export function getConversation(userId, listingId){
  if (!listingId) return null;
  return safeRead(userId).find(c => String(c.listing_id) === String(listingId)) || null;
}

export function addOrUpdateConversation(userId, payload){
  if (!payload || !payload.listing_id) throw new Error("listing_id required");
  const all = safeRead(userId);
  const idx = all.findIndex(c => String(c.listing_id) === String(payload.listing_id));
  const now = new Date().toISOString();

  if (idx === -1){
    const conv = {
      listing_id: payload.listing_id,
      listing_snapshot: payload.listing_snapshot || null,
      messages: payload.new_messages || [],
      created_at: now,
      last_message_at: (payload.new_messages && payload.new_messages.length)
        ? payload.new_messages[payload.new_messages.length-1].created_at
        : now,
      unread_count: 0
    };
    all.push(conv);
  } else {
    const conv = all[idx];
    if (payload.listing_snapshot) conv.listing_snapshot = payload.listing_snapshot;
    if (Array.isArray(payload.new_messages) && payload.new_messages.length){
      conv.messages = [...(conv.messages || []), ...payload.new_messages];
      conv.last_message_at = payload.new_messages[payload.new_messages.length-1].created_at;
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
  return msg;
}

export function deleteConversation(userId, listingId){
  if (!listingId) return;
  const all = safeRead(userId).filter(c => String(c.listing_id) !== String(listingId));
  safeWrite(userId, all);
}

export function countConversations(userId){
  return safeRead(userId).length;
}
