import type { MemberSignal } from "@/lib/types";

export const MODEL_PROVIDER_NAME = "mock";
export const MODEL_PROVIDER_VERSION = "mock-preference-v1";

export interface EvidenceForAnalysis {
  id: string;
  tripId: string;
  memberId?: string | null;
  targetType: string;
  targetId?: string | null;
  evidenceType: string;
  rawTextSnapshot?: string | null;
  rawPayload?: unknown;
  visibility: string;
  sourceMessageId?: string | null;
  sourceMaterialId?: string | null;
  sourcePlaceOpinionId?: string | null;
}

export interface SignalDraft {
  targetType: MemberSignal["targetType"];
  targetId: string;
  signalType: MemberSignal["signalType"];
  polarity: MemberSignal["polarity"];
  intensity: MemberSignal["intensity"];
  reason?: string;
  aspect?: string;
  intent?: string;
  conditionText?: string;
  constraintCandidate?: boolean;
  extractedAttributes?: Array<{ key: string; polarity: -1 | 0 | 1; text: string }>;
}

export interface ConstraintDraft {
  targetType?: "trip" | "node" | "material" | "plan";
  targetId?: string;
  constraintType: string;
  severity: "soft" | "strong" | "hard";
  polarity?: -1 | 0 | 1;
  priorityScore?: number;
  confidence?: number;
  summary: string;
  conditionText?: string;
  structuredValue?: Record<string, unknown>;
}

export interface MemberPlaceSummaryInput {
  placeName?: string;
  positiveReasons: string[];
  negativeReasons: string[];
  conditionText?: string;
  stance: string;
}

export interface RoomPlaceSummaryInput {
  placeName?: string;
  commonPositiveReasons: string[];
  mainConcerns: string[];
  memberStanceCount: number;
}

export interface ModelProvider {
  name: string;
  version: string;
  analyzeEvidence(evidence: EvidenceForAnalysis): Promise<{
    signals: SignalDraft[];
    constraints: ConstraintDraft[];
  }>;
  summarizeMemberPlace(input: MemberPlaceSummaryInput): Promise<string>;
  summarizeRoomPlace(input: RoomPlaceSummaryInput): Promise<string>;
}

export class MockModelProvider implements ModelProvider {
  name = MODEL_PROVIDER_NAME;
  version = MODEL_PROVIDER_VERSION;

  async analyzeEvidence(evidence: EvidenceForAnalysis) {
    const targetId = evidence.targetId ?? undefined;
    if (!targetId || !evidence.memberId || !isSignalTargetType(evidence.targetType)) {
      return { signals: [], constraints: extractTripConstraints(evidence) };
    }

    if (evidence.evidenceType === "reaction") {
      const reaction = payloadValue(evidence.rawPayload, "reaction");
      return {
        signals: [signalForReaction(evidence.targetType, targetId, reaction)],
        constraints: constraintsForReaction(evidence.targetType, targetId, reaction)
      };
    }

    const text = evidence.rawTextSnapshot ?? "";
    const signals = signalsForText({
      targetType: evidence.targetType,
      targetId,
      text
    });
    const constraints = [
      ...extractTripConstraints(evidence),
      ...signals
        .filter((signal) => signal.constraintCandidate)
        .map<ConstraintDraft>((signal) => ({
          targetType: signal.targetType,
          targetId: signal.targetId,
          constraintType:
            signal.intent === "must_go"
              ? "must_go"
              : signal.intent === "hard_reject" || signal.intent === "avoid"
                ? "hard_reject"
                : "route_condition",
          severity: signal.intent === "hard_reject" ? "hard" : "strong",
          polarity: signal.polarity,
          priorityScore: signal.intent === "condition" || signal.intent === "concern" ? 0.78 : 0.9,
          confidence: 0.82,
          summary: signal.conditionText ?? signal.reason ?? "从用户表达中提取的规划约束。",
          conditionText: signal.conditionText,
          structuredValue: {
            aspect: signal.aspect,
            intent: signal.intent
          }
        }))
    ];

    return { signals, constraints };
  }

  async summarizeMemberPlace(input: MemberPlaceSummaryInput) {
    if (input.stance === "unknown") return "还没有形成明确态度。";

    const positive = input.positiveReasons.length
      ? `喜欢 ${input.positiveReasons.slice(0, 3).join("、")}`
      : "有一定兴趣";
    const negative = input.negativeReasons.length
      ? `，顾虑 ${input.negativeReasons.slice(0, 3).join("、")}`
      : "";
    const condition = input.conditionText ? `，条件是${input.conditionText}` : "";

    return `${input.placeName ? `对${input.placeName}` : "对这个地点"}${positive}${negative}${condition}。`;
  }

  async summarizeRoomPlace(input: RoomPlaceSummaryInput) {
    if (input.memberStanceCount === 0) return "团队还没有形成明确态度。";

    const positive = input.commonPositiveReasons.length
      ? `共同兴趣集中在 ${input.commonPositiveReasons.slice(0, 3).join("、")}`
      : "团队已有成员开始表态";
    const concerns = input.mainConcerns.length
      ? `，主要顾虑是 ${input.mainConcerns.slice(0, 3).join("、")}`
      : "";

    return `${input.placeName ? `${input.placeName}：` : ""}${positive}${concerns}。`;
  }
}

export const modelProvider: ModelProvider = new MockModelProvider();

function isSignalTargetType(targetType: string): targetType is MemberSignal["targetType"] {
  return targetType === "node" || targetType === "material" || targetType === "plan";
}

function payloadValue(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object" || !(key in payload)) return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function signalForReaction(
  targetType: MemberSignal["targetType"],
  targetId: string,
  reaction?: string
): SignalDraft {
  if (reaction === "must_go") {
    return {
      targetType,
      targetId,
      signalType: "must_go",
      polarity: 1,
      intensity: 5,
      aspect: "overall",
      intent: "must_go",
      reason: "成员明确标记为必去。",
      constraintCandidate: true
    };
  }
  if (reaction === "not_interested") {
    return {
      targetType,
      targetId,
      signalType: "negative",
      polarity: -1,
      intensity: 3,
      aspect: "overall",
      intent: "avoid",
      reason: "成员表达不想去。",
      constraintCandidate: false
    };
  }
  if (reaction === "concern") {
    return {
      targetType,
      targetId,
      signalType: "concern",
      polarity: -1,
      intensity: 4,
      aspect: "overall",
      intent: "concern",
      reason: "成员对这个地点有顾虑。",
      constraintCandidate: true
    };
  }
  if (reaction === "want_to_know") {
    return {
      targetType,
      targetId,
      signalType: "want_to_know",
      polarity: 0,
      intensity: 2,
      aspect: "overall",
      intent: "learn_more",
      reason: "成员想进一步了解。",
      constraintCandidate: false
    };
  }
  if (reaction === "neutral") {
    return {
      targetType,
      targetId,
      signalType: "neutral",
      polarity: 0,
      intensity: 1,
      aspect: "overall",
      intent: "neutral",
      reason: "成员态度中立。",
      constraintCandidate: false
    };
  }

  return {
    targetType,
    targetId,
    signalType: "positive",
    polarity: 1,
    intensity: 3,
    aspect: "overall",
    intent: "want_to_go",
    reason: "成员表达想去。",
    constraintCandidate: false
  };
}

function constraintsForReaction(
  targetType: MemberSignal["targetType"],
  targetId: string,
  reaction?: string
): ConstraintDraft[] {
  if (reaction === "must_go") {
    return [
      {
        targetType,
        targetId,
        constraintType: "must_go",
        severity: "hard",
        polarity: 1,
        priorityScore: 1,
        confidence: 1,
        summary: "成员明确标记这个地点为必去。",
        structuredValue: { reaction }
      }
    ];
  }
  if (reaction === "concern") {
    return [
      {
        targetType,
        targetId,
        constraintType: "route_condition",
        severity: "soft",
        polarity: -1,
        priorityScore: 0.6,
        confidence: 0.75,
        summary: "成员对该地点有顾虑，后续规划需要解释取舍。",
        structuredValue: { reaction }
      }
    ];
  }
  return [];
}

function signalsForText(input: {
  targetType: MemberSignal["targetType"];
  targetId: string;
  text: string;
}): SignalDraft[] {
  const signals: SignalDraft[] = [];
  const attributes: Array<{ key: string; polarity: -1 | 0 | 1; text: string }> = [];

  if (/海边|海|沙滩|江之岛/.test(input.text)) {
    attributes.push({ key: "sea", polarity: 1, text: "喜欢海边氛围" });
    signals.push({
      targetType: input.targetType,
      targetId: input.targetId,
      signalType: "positive",
      polarity: 1,
      intensity: 3,
      reason: "喜欢海边氛围",
      aspect: "sea",
      intent: "want_to_go",
      extractedAttributes: attributes
    });
  }

  if (/电车|铁路|列车|江之电/.test(input.text)) {
    attributes.push({ key: "train_experience", polarity: 1, text: "喜欢电车体验" });
    signals.push({
      targetType: input.targetType,
      targetId: input.targetId,
      signalType: "positive",
      polarity: 1,
      intensity: 3,
      reason: "喜欢电车体验",
      aspect: "train_experience",
      intent: "want_to_go",
      extractedAttributes: attributes
    });
  }

  if (/好看|喜欢|想去|不错|挺好|打动/.test(input.text)) {
    signals.push({
      targetType: input.targetType,
      targetId: input.targetId,
      signalType: /必去|一定要/.test(input.text) ? "must_go" : "positive",
      polarity: 1,
      intensity: /很|非常|必去|一定/.test(input.text) ? 4 : 3,
      reason: "整体表达了正向兴趣",
      aspect: "overall",
      intent: /必去|一定要/.test(input.text) ? "must_go" : "want_to_go",
      constraintCandidate: /必去|一定要/.test(input.text)
    });
  }

  if (/不值|太远|太久|太累|不想专门|专门.*一天|一天.*不/.test(input.text)) {
    const conditionText = "不希望为了这个地点单独花一整天或明显绕路";
    attributes.push({ key: "time_cost", polarity: -1, text: "顾虑时间成本" });
    signals.push({
      targetType: input.targetType,
      targetId: input.targetId,
      signalType: "concern",
      polarity: -1,
      intensity: 4,
      reason: "顾虑时间成本和路线代价",
      aspect: "time_cost",
      intent: "condition",
      conditionText,
      constraintCandidate: true,
      extractedAttributes: attributes
    });
  }

  if (/不去|不想去|坚决不|避开/.test(input.text)) {
    signals.push({
      targetType: input.targetType,
      targetId: input.targetId,
      signalType: "hard_reject",
      polarity: -1,
      intensity: 5,
      reason: "明确表达不想去或需要避开",
      aspect: "overall",
      intent: "hard_reject",
      constraintCandidate: true
    });
  }

  if (signals.length === 0 && input.text.trim()) {
    signals.push({
      targetType: input.targetType,
      targetId: input.targetId,
      signalType: "want_to_know",
      polarity: 0,
      intensity: 1,
      reason: input.text.trim(),
      aspect: "overall",
      intent: "learn_more"
    });
  }

  return signals;
}

function extractTripConstraints(evidence: EvidenceForAnalysis): ConstraintDraft[] {
  const text = evidence.rawTextSnapshot ?? "";
  const constraints: ConstraintDraft[] = [];
  const budgetMatch = text.match(/预算(?:大概|大约|控制在|不要超过|上限)?\s*(\d{3,6})/);
  if (budgetMatch) {
    constraints.push({
      targetType: "trip",
      targetId: evidence.tripId,
      constraintType: "budget",
      severity: "strong",
      polarity: 0,
      priorityScore: 0.86,
      confidence: 0.78,
      summary: `预算相关约束：${budgetMatch[0]}`,
      structuredValue: { amountText: budgetMatch[1], sourceText: budgetMatch[0] }
    });
  }

  if (/不想太赶|慢一点|轻松|少走路/.test(text)) {
    constraints.push({
      targetType: "trip",
      targetId: evidence.tripId,
      constraintType: /少走路/.test(text) ? "mobility" : "pace",
      severity: "strong",
      polarity: -1,
      priorityScore: 0.82,
      confidence: 0.8,
      summary: "成员希望行程节奏更轻松，避免过赶或步行过多。",
      structuredValue: { sourceText: text }
    });
  }

  return constraints;
}
