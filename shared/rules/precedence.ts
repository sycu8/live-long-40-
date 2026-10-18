import {
  corroboratingCues,
  evaluateHighRisk,
  hasAcuteCue,
  hasFirstPersonHarmIntent,
  hasSelfHarmCue,
  selfHarmLooksPastStable,
  type RiskClass,
} from "./safety";

export type ScreenClass = Exclude<RiskClass, "none">;

export type RuleView = {
  /** Specific rule class. Null when the rules did not take a screen. */
  class: ScreenClass | null;
  acuteCue: boolean;
  /** A self-harm lexicon or rule cue in the text, not the classifier's word. */
  selfHarmLexicon: boolean;
  firstPersonHarmIntent: boolean;
  pastStable: boolean;
  /** Classes corroborated by a lexicon or rule cue. */
  cues: readonly ScreenClass[];
};

export type ClassifierView = {
  class: ScreenClass | null;
  /** The model called this a crisis, including when it also said figurative. */
  crisis: boolean;
  /**
   * Second verifier. Omitted until that call returns.
   * True keeps the crisis screen. False is the gentle line.
   */
  verified?: boolean;
} | null;

export type Decision =
  | { kind: "screen"; riskClass: ScreenClass }
  | { kind: "gentle" }
  | { kind: "verify" }
  | { kind: "none" };

/**
 * Classes that may replace a lower one. Pairs that are absent keep the rule
 * class, so poisoning and unconscious do not swap, and a generic screen
 * never replaces a specific one.
 */
const OUTRANKS: Partial<Record<ScreenClass, readonly ScreenClass[]>> = {
  self_harm: [
    "choking",
    "breathing",
    "severe_allergy",
    "seizure",
    "low_blood_sugar",
    "chest_pain",
    "stroke",
    "bleeding",
    "unconscious",
    "poisoning",
    "head_injury",
    "burn",
    "fall_emergency",
    "urgent",
  ],
  choking: ["poisoning", "unconscious", "urgent"],
  breathing: ["poisoning", "unconscious", "urgent"],
  severe_allergy: ["poisoning", "unconscious", "chest_pain", "urgent"],
  seizure: ["poisoning", "unconscious", "urgent"],
  low_blood_sugar: ["poisoning", "unconscious", "urgent"],
};

function screen(riskClass: ScreenClass): Decision {
  return { kind: "screen", riskClass };
}

export function strictlyMoreSevere(next: ScreenClass, current: ScreenClass): boolean {
  if (next === current || next === "urgent") return false;
  if (current === "urgent") return true;
  return (OUTRANKS[next] ?? []).includes(current);
}

function corroborated(rules: RuleView, next: ScreenClass): boolean {
  if (next === "self_harm") return rules.selfHarmLexicon;
  if (next === "urgent") return false;
  return rules.cues.includes(next);
}

/**
 * One precedence table.
 * A rule screen is the answer when the classifier is still unknown.
 * A known classifier may replace that screen only when its class is strictly
 * more severe and a lexicon or rule cue of that class is in the text.
 * A self-harm verdict with no lexicon cue never replaces a rule class.
 */
export function decide(
  rules: RuleView,
  classifier: ClassifierView,
  timeout: boolean,
): Decision {
  if (timeout) {
    if (rules.class) return screen(rules.class);
    if (rules.acuteCue) return screen("urgent");
    return { kind: "gentle" };
  }

  if (rules.pastStable && !rules.class) return { kind: "gentle" };

  if (rules.class) {
    const next = classifier?.class ?? null;
    if (
      next &&
      next !== rules.class &&
      strictlyMoreSevere(next, rules.class) &&
      corroborated(rules, next)
    ) {
      return screen(next);
    }
    return screen(rules.class);
  }

  const crisis = classifier?.crisis === true || classifier?.class === "self_harm";
  if (crisis) {
    if (rules.firstPersonHarmIntent || rules.selfHarmLexicon) return screen("self_harm");
    if (classifier?.verified === true) return screen("self_harm");
    if (classifier?.verified === false) return { kind: "gentle" };
    return { kind: "verify" };
  }

  const model = classifier?.class ?? null;
  if (model && model !== "urgent") return screen(model);
  return { kind: "none" };
}

export function ruleViewFor(question: string): RuleView {
  const risk = evaluateHighRisk(question);
  const riskClass = risk.matched && risk.riskClass !== "none" ? risk.riskClass : null;
  return {
    class: riskClass,
    acuteCue: hasAcuteCue(question),
    selfHarmLexicon: hasSelfHarmCue(question),
    firstPersonHarmIntent: hasFirstPersonHarmIntent(question),
    pastStable: selfHarmLooksPastStable(question),
    cues: corroboratingCues(question),
  };
}
