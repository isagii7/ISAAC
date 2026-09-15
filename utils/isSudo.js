const fs = require('fs');
const path = require('path');
const { isOwner } = require('./isOwner');

const sudoPath = path.join(__dirname, '../config/sudoList.json');

/**
 * Collects every plausible real-ID (phone number or LID) from an
 * object with participant-style fields — msg.key or a quoted
 * message's contextInfo both use the same field names.
 * Returns an array of {id, type, jid}, deduplicated.
 */
function resolveIds(obj) {
  const raw = [
    obj?.participantPn,
    obj?.participantAlt,
    obj?.remoteJidAlt,
    obj?.participant,
    obj?.remoteJid,
  ].filter(Boolean);

  const seen = new Set();
  const ids = [];

  for (const jid of raw) {
    const digits = jid.split('@')[0].split(':')[0];
    if (!/^\d{7,15}$/.test(digits) || seen.has(digits)) continue;
    seen.add(digits);
    const type = jid.endsWith('@lid') ? 'lid' : 'pn';
    ids.push({ id: digits, type, jid });
  }

  return ids;
}

function load() {
  if (!fs.existsSync(sudoPath)) return [];
  const raw = JSON.parse(fs.readFileSync(sudoPath, 'utf8'));
  return raw.map((entry) => {
    if (typeof entry === 'string') return { ids: [{ id: entry, type: 'pn' }] };
    if (entry.id && !entry.ids) return { ids: [{ id: entry.id, type: entry.type || 'pn' }] };
    return entry;
  });
}
function save(list) {
  fs.writeFileSync(sudoPath, JSON.stringify(list, null, 2));
}

function isSudo(msg) {
  if (isOwner(msg)) return true;
  const candidateIds = resolveIds(msg.key).map((c) => c.id);
  if (!candidateIds.length) return false;
  return load().some((entry) => entry.ids.some((i) => candidateIds.includes(i.id)));
}

function findEntryByAnyId(list, ids) {
  const idSet = ids.map((i) => i.id);
  return list.findIndex((entry) => entry.ids.some((stored) => idSet.includes(stored.id)));
}

function addSudo(ids) {
  const list = load();
  const idx = findEntryByAnyId(list, ids);
  if (idx !== -1) {
    const existing = list[idx];
    for (const newId of ids) {
      if (!existing.ids.some((i) => i.id === newId.id)) existing.ids.push({ id: newId.id, type: newId.type });
    }
  } else {
    list.push({ ids: ids.map((i) => ({ id: i.id, type: i.type })) });
  }
  save(list);
}
function removeSudo(ids) {
  const idSet = ids.map((i) => i.id);
  save(load().filter((entry) => !entry.ids.some((stored) => idSet.includes(stored.id))));
}
function findSudoEntry(ids) {
  const idSet = ids.map((i) => i.id);
  return load().find((entry) => entry.ids.some((i) => idSet.includes(i.id)));
}
function listSudo() {
  return load();
}
function clearSudo() {
  save([]);
}

module.exports = { isSudo, addSudo, removeSudo, listSudo, clearSudo, findSudoEntry, resolveIds };
