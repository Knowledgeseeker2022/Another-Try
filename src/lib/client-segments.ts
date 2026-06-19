export const SEGMENTS = [
  "Financial",
  "Federal",
  "Healthcare",
  "Legal",
  "Technology",
  "Education",
  "Nonprofit",
  "Manufacturing",
  "Professional Services",
  "Retail",
] as const;

export type Segment = (typeof SEGMENTS)[number];

export function isValidSegment(value: string): value is Segment {
  return (SEGMENTS as readonly string[]).includes(value);
}

// Attributes supported in group rules (extensible without schema changes).
export const RULE_ATTRIBUTES = ["segment"] as const;
export type RuleAttribute = (typeof RULE_ATTRIBUTES)[number];
