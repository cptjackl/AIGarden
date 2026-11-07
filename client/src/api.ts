import type { z } from "zod";
import { ApiErrorSchema } from "@loregarden/shared";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Calls the API, validates the JSON response with the given schema, and throws ApiError on failure. */
export async function request<S extends z.ZodTypeAny>(
  schema: S,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<z.infer<S>> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as z.infer<S>;

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(json);
    throw new ApiError(res.status, parsed.success ? parsed.data.error : `Request failed (${res.status})`);
  }
  return schema.parse(json);
}
