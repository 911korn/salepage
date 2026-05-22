import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Wrapped Link / useRouter / usePathname / redirect that are locale-aware
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
