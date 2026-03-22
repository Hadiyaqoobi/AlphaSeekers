import type { RegisterRequest, RegisterResponse } from "@/types/api-contracts";

import { fetchJson } from "./fetch-json";

export async function registerUser(payload: RegisterRequest): Promise<RegisterResponse> {
  return fetchJson<RegisterResponse>("/api/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

