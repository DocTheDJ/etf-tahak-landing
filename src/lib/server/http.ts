// Response helpers for the API routes.

export function json(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Parse a JSON body, refusing anything over `limit` bytes. */
export async function readJson<T = Record<string, unknown>>(request: Request, limit = 32_000): Promise<T> {
  const text = await request.text();
  if (text.length > limit) throw new Error("body too large");
  return (text ? JSON.parse(text) : {}) as T;
}
