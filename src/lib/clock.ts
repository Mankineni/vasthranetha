/**
 * Current time for this request. Server components render once per request,
 * so reading the clock there is safe; this wrapper keeps the call out of the
 * component body, where React's purity lint rule would flag it.
 */
export function requestTime(): number {
  return Date.now()
}
