export function errorInfo(error: unknown): { message?: string; code?: string } {
  if (typeof error === 'object' && error !== null) {
    const e = error as { message?: unknown; code?: unknown };
    return {
      message: typeof e.message === 'string' ? e.message : undefined,
      code: typeof e.code === 'string' ? e.code : undefined,
    };
  }
  return {};
}
