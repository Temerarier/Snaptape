import type { AuthState } from "./actions";

export type RecoverableAuthState = AuthState & { refreshRequired?: boolean };

/** Only a rejected, obsolete action ID is recoverable by reloading the page.
 * Do not retry submissions or hide genuine application/redirect errors.
 */
export async function recoverStaleAction(
  action: (state: AuthState, data: FormData) => Promise<AuthState>,
  state: RecoverableAuthState,
  data: FormData,
  outdatedMessage: string,
): Promise<RecoverableAuthState> {
  try {
    return await action(state, data);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "UnrecognizedActionError" ||
        /^Server Action "[^"]+" was not found on the server\./.test(error.message))
    ) {
      return { error: outdatedMessage, refreshRequired: true };
    }
    throw error;
  }
}