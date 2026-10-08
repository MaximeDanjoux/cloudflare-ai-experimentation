export function logStep(
  requestId: string,
  step: string,
  startedAt: number,
  counts: Record<string, number>,
): void {
  console.log(JSON.stringify({
    requestId,
    step,
    durationMs: Date.now() - startedAt,
    counts,
  }));
}
