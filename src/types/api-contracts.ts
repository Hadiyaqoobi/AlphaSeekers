import type { UserRole } from "@prisma/client";

export type ApiErrorResponse = {
  message: string;
};

// POST /api/auth/register
export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
  role: Extract<UserRole, "STUDENT" | "TEACHER">;
  phone?: string;
  language?: "FA" | "EN";
  timezone?: string;
};

export type RegisterResponse = {
  id: string;
  email: string;
  role: RegisterRequest["role"];
  approvedAt: string | null;
  createdAt: string;
};

