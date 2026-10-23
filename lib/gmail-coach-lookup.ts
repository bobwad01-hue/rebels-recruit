/**
 * Only retry a read-only coach lookup before contacting Gmail.
 * Never retry the Gmail send request: a send may have succeeded even if its
 * response was lost, and repeating it could deliver duplicate emails.
 */
export type CoachLookupError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};
export type CoachLookupResponse<T> = {
  data: T | null;
  error: CoachLookupError | null;
  status?: number;
};
export type CoachLookupFailure = {
  error: CoachLookupError;
  status?: number;
  attempt: number;
  retrying: boolean;
};

export function isTransientCoachLookupError(error: CoachLookupError, status?: number): boolean {
  const code = String(error.code || '').toUpperCase();
  // Network/gateway failures and PostgREST connection-pool unavailability.
  // Do not retry authorization (42501), missing schema/relationship (PGRST200),
  // or other permanent SQL errors.
  return [408, 502, 503, 504, 520, 521, 522, 523, 524].includes(status || 0)
    || ['PGRST000', 'PGRST001', 'PGRST002', 'PGRST003', 'NETWORK_ERROR'].includes(code)
    || code.startsWith('08')
    || ['57P01', '57P02', '57P03', '53300'].includes(code);
}

export async function lookupCoachWithRetry<T>(
  query: () => PromiseLike<CoachLookupResponse<T>>,
  onFailure?: (failure: CoachLookupFailure) => void,
  wait: (milliseconds: number) => Promise<void> = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds)),
): Promise<CoachLookupResponse<T>> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let response: CoachLookupResponse<T>;
    try {
      response = await query();
    } catch (caught) {
      const e = caught as {name?: string; message?: string};
      response = {
        data: null,
        status: 0,
        error: {
          code: e?.name === 'TypeError' || e?.name === 'AbortError' ? 'NETWORK_ERROR' : 'QUERY_EXCEPTION',
          message: e?.message || 'Unexpected coach lookup exception.',
        },
      };
    }
    if (!response.error) return response; // A genuine empty result is NOT an error.
    const retrying = attempt === 1 && isTransientCoachLookupError(response.error, response.status);
    onFailure?.({error: response.error, status: response.status, attempt, retrying});
    if (!retrying) return response;
    await wait(200); // One short, bounded retry of this read-only query.
  }
  throw new Error('Unreachable coach lookup retry state');
}
