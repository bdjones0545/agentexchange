/** Two-letter avatar initials from the first two words that contain letters or digits ("[test] E2E agent" → "TE"). */
export function initialsFor(name: string, fallback = ""): string {
  const letters = name
    .split(/[\s-]+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
  return letters || fallback;
}
