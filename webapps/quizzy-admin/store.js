// Everything this app keeps in hrhub.data. Keys:
//   event:<CODE>              the event: title, settings, questions (with the correct answers: never shown to players)
//   run:<CODE>                progress of the run being played (lets the host resume after a reload)
//   result:<CODE>:<runId>     final ranking and per-question stats of a finished run
//   rt:event:<CODE>:<member>  every answer of one player, written by HR Hub itself (send(..., { persist }))

/** Slug of the app players use: the "playerApp" setting (hrhub.json), chosen by the administrator. */
export async function playerApp() {
  const settings = await window.hrhub.settings.get();
  return settings.playerApp || null;
}

export const channelName = (code) => `event:${code}`;
const eventKey = (code) => `event:${code}`;
const runKey = (code) => `run:${code}`;

const hrhub = () => window.hrhub;

/** All events, newest first, with the entry's audit info and how many times each was played. */
export async function loadEvents() {
  const entries = await hrhub().data.all();
  const runs = {};
  for (const entry of entries) {
    if (!entry.key.startsWith('result:')) continue;
    const code = entry.key.split(':')[1];
    const finishedAt = entry.value && entry.value.finishedAt;
    runs[code] = { count: (runs[code] ? runs[code].count : 0) + 1, last: [runs[code] && runs[code].last, finishedAt].filter(Boolean).sort().pop() };
  }
  return entries
    .filter((entry) => entry.key.startsWith('event:'))
    .map((entry) => ({
      ...entry.value,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      createdBy: entry.createdBy,
      runs: runs[entry.value.code] || { count: 0, last: null },
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** { event, updatedAt } or null. */
export async function loadEvent(code) {
  const entry = await hrhub().data.getEntry(eventKey(code));
  return entry ? { event: entry.value, updatedAt: entry.updatedAt } : null;
}

/** Optimistic concurrency: `ifUpdatedAt` 0 = must be new. Rejects with status 409 when someone else saved meanwhile. */
export function saveEvent(event, ifUpdatedAt) {
  const { updatedAt, createdAt, createdBy, runs, ...rest } = event;
  // imageUrl only lives between an import and its download.
  const value = { ...rest, questions: rest.questions.map(({ imageUrl, ...question }) => question) };
  return hrhub().data.set(eventKey(event.code), value, { ifUpdatedAt });
}

export function removeEvent(code) {
  return hrhub().data.remove(eventKey(code));
}

export function loadRun(code) {
  return hrhub().data.get(runKey(code));
}

export function saveRun(code, run) {
  return hrhub().data.set(runKey(code), run);
}

export function clearRun(code) {
  return hrhub()
    .data.remove(runKey(code))
    .catch((error) => {
      if (error.status !== 404) throw error;
    });
}

export function saveResult(code, result) {
  return hrhub().data.set(`result:${code}:${result.runId}`, result);
}

export async function loadResults(code) {
  const entries = await hrhub().data.all();
  return entries
    .filter((entry) => entry.key.startsWith(`result:${code}:`))
    .map((entry) => entry.value)
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
}
