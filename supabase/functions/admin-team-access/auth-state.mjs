// Pure Auth-state helpers shared by the Edge Function and Node regression tests.
const cloneJson = (value) => value == null ? {} : JSON.parse(JSON.stringify(value));

export function captureAuthState(user, nowMs = Date.now()) {
  const bannedUntil = user?.banned_until ? Date.parse(user.banned_until) : 0;
  const remainingMs = Number.isFinite(bannedUntil) ? bannedUntil - nowMs : 0;
  return Object.freeze({
    email: user?.email || "",
    email_confirm: Boolean(user?.email_confirmed_at),
    user_metadata: cloneJson(user?.user_metadata),
    ban_duration: remainingMs > 0 ? `${Math.max(1, Math.ceil(remainingMs / 1000))}s` : "none"
  });
}

export function anonymizeAuthPatch(userId) {
  return {
    email: `removed+${String(userId).replaceAll("-", "")}@example.invalid`,
    email_confirm: true,
    user_metadata: {},
    ban_duration: "876000h"
  };
}

export function restoreAuthPatch(snapshot) {
  return {
    email: snapshot.email,
    email_confirm: snapshot.email_confirm,
    user_metadata: cloneJson(snapshot.user_metadata),
    ban_duration: snapshot.ban_duration
  };
}
