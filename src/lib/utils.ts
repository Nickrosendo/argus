import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Reduce user input to a bare domain for the block list.
 * "https://www.Example.com/page?x=1" -> "example.com". Returns "" when the
 * input does not contain a usable domain.
 */
export function normalizeDomain(input: string): string {
  const domain = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "") // protocol
    .replace(/[/?#].*$/, "") // path, query, fragment
    .replace(/^[^@]*@/, "") // credentials
    .replace(/:\d+$/, "") // port
    .replace(/^www\./, "")
    .replace(/\.$/, "");

  return /^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(domain) ? domain : "";
}
