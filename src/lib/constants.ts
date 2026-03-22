import type { UserRole } from "@prisma/client";

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password: string;
};

export const DEMO_USERS: DemoUser[] = [
  {
    id: "demo-admin",
    name: "AlphaSeekers Admin",
    email: "admin@alphaseekers.org",
    role: "ADMIN",
    password: "admin123",
  },
  {
    id: "demo-teacher",
    name: "Volunteer Teacher",
    email: "teacher@alphaseekers.org",
    role: "TEACHER",
    password: "teacher123",
  },
  {
    id: "demo-student",
    name: "Fatima",
    email: "student@alphaseekers.org",
    role: "STUDENT",
    password: "student123",
  },
];
