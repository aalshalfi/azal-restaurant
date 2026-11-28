// Server-side diagnostic for action-handler exceptions. Never return this detail to clients.
export function logActionFailure(action, error, logger = console) {
  const detail = error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { message: String(error) };
  logger.error("[admin-team-access] action failed", { action, ...detail });
}
