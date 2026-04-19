export type ItemKind = "lecture" | "assignment" | "exam";

export interface ParsedItem {
  title: string;
  kind: ItemKind;
}

export function detectKind(line: string): ItemKind {
  const l = line.toLowerCase();
  if (
    /\b(assignment|homework|hw\d*|problem set|pset\d*|lab report|lab\d*|project|worksheet)\b/.test(l)
  )
    return "assignment";
  if (/\b(exam|midterm|final|quiz|test)\b/.test(l)) return "exam";
  return "lecture";
}

export function stripPrefix(line: string): string {
  let cleaned = line.replace(/^(week|lecture|assignment|unit|chapter|module|class|hw|pset)\s*\d+[\s:\-\.]*/i, "");
  cleaned = cleaned.replace(/^[\s\d\.\-\*\•\–\—:]+/, "");
  return cleaned.trim();
}

/**
 * Parse a pasted syllabus text into a list of course items.
 * Empty lines are ignored. Leading numbering/bullets are stripped.
 * Kind is auto-detected from keyword matching.
 */
export function parseSyllabus(text: string): ParsedItem[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => ({
      title: stripPrefix(line) || line,
      kind: detectKind(line),
    }));
}
