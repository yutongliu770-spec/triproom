import type { MemberSignal, PlanVariant } from "@/lib/types";

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

export interface TravelPlanningPromptInput {
  trip: unknown;
  members: unknown[];
  candidatePlaces: unknown[];
  roomPlaceProfiles: unknown[];
  memberPlaceProfiles: unknown[];
  constraints: unknown[];
  keyEvidence: unknown[];
  relations: unknown[];
  existingPlan?: PlanVariant;
  revisionInstruction?: string;
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
  generateTravelPlans(input: TravelPlanningPromptInput): Promise<PlanVariant[]>;
  reviseTravelPlan(input: TravelPlanningPromptInput): Promise<PlanVariant[]>;
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

  async generateTravelPlans(input: TravelPlanningPromptInput) {
    const { generateJapanPlanVariants } = await import("@/lib/plans/generator");
    const trip = input.trip as { id?: string; tripDurationDays?: number } | undefined;
    return generateJapanPlanVariants({
      tripId: trip?.id ?? "demo-japan-quick",
      totalDays: trip?.tripDurationDays ?? 7,
      basedOnSignalIds: keySignalIds(input)
    });
  }

  async reviseTravelPlan(input: TravelPlanningPromptInput) {
    const { generateJapanPlanVariants } = await import("@/lib/plans/generator");
    const trip = input.trip as { id?: string; tripDurationDays?: number } | undefined;
    return generateJapanPlanVariants({
      tripId: trip?.id ?? "demo-japan-quick",
      totalDays: trip?.tripDurationDays ?? 7,
      basedOnSignalIds: keySignalIds(input),
      parentPlanId: input.existingPlan?.id
    });
  }
}

export class DeepSeekModelProvider implements ModelProvider {
  name = "deepseek";
  version = process.env.DEEPSEEK_MODEL || process.env.MODEL_NAME || "deepseek-chat";

  private readonly baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  private readonly apiKey = process.env.DEEPSEEK_API_KEY || process.env.MODEL_API_KEY;
  private readonly requestTimeoutMs = 8500;

  async analyzeEvidence(evidence: EvidenceForAnalysis) {
    const fallback = new MockModelProvider();
    const seeded = await fallback.analyzeEvidence(evidence);
    if (!this.apiKey) return seeded;

    const content = await this.chatJson({
      system:
        "你是 TripRoom 的偏好抽取服务。只返回 JSON，不要返回 Markdown。保持原始 evidence 可追溯，不要编造地点。",
      user: JSON.stringify({
        task: "analyze_evidence",
        evidence,
        requiredShape: {
          signals: [
            {
              targetType: "node|material|plan",
              targetId: "string",
              signalType: "positive|neutral|negative|must_go|hard_reject|concern|want_to_know|questioned",
              polarity: -1,
              intensity: 3,
              reason: "string",
              aspect: "string",
              intent: "want_to_go|avoid|learn_more|must_go|hard_reject|condition|concern|neutral",
              conditionText: "string optional",
              constraintCandidate: false,
              extractedAttributes: [{ key: "string", polarity: 1, text: "string" }]
            }
          ],
          constraints: [
            {
              targetType: "trip|node|material|plan",
              targetId: "string optional",
              constraintType: "budget|date|duration|mobility|pace|must_go|hard_reject|route_condition|other",
              severity: "soft|strong|hard",
              polarity: 0,
              priorityScore: 0.8,
              confidence: 0.8,
              summary: "string",
              conditionText: "string optional",
              structuredValue: {}
            }
          ]
        },
        fallbackSignals: seeded.signals,
        fallbackConstraints: seeded.constraints
      })
    });

    return {
      signals: Array.isArray(content.signals) ? content.signals.map(normalizeSignalDraft).filter(Boolean) as SignalDraft[] : seeded.signals,
      constraints: Array.isArray(content.constraints) ? content.constraints.map(normalizeConstraintDraft).filter(Boolean) as ConstraintDraft[] : seeded.constraints
    };
  }

  async summarizeMemberPlace(input: MemberPlaceSummaryInput) {
    return new MockModelProvider().summarizeMemberPlace(input);
  }

  async summarizeRoomPlace(input: RoomPlaceSummaryInput) {
    return new MockModelProvider().summarizeRoomPlace(input);
  }

  async generateTravelPlans(input: TravelPlanningPromptInput) {
    return this.generatePlansWithTask("generate_candidate_plans", input);
  }

  async reviseTravelPlan(input: TravelPlanningPromptInput) {
    return this.generatePlansWithTask("revise_candidate_plan", input);
  }

  private async generatePlansWithTask(task: string, input: TravelPlanningPromptInput) {
    if (!this.apiKey) {
      throw new Error("DeepSeek API key is not configured on the server.");
    }

    const content = await this.chatJson({
      system:
        "你是 TripRoom 的 TravelPlanningAgent。必须基于输入的 room/member/place/preference/constraint 数据生成可执行日本旅行候选方案。只返回 JSON，不要 Markdown，不要解释 JSON 外内容。",
      user: JSON.stringify({
        task,
        instructions: [
          "返回至少 2 个结构明显不同的候选方案，最多 3 个。",
          "每个方案必须有 overview、完整 day-by-day itinerary、route nodeIds。",
          "不要伪造实时酒店、航班、票价或天气；预算和交通只能写粗略估算。",
          "尊重 hard constraints；如果存在取舍，在 gains/tradeoffs/unresolvedQuestions 里说明。",
          "id/version/score/validation 可以留空，后端会重新赋值和校验评分。"
        ],
        requiredJsonShape: {
          plans: [
            {
              title: "string",
              summary: "string",
              totalDays: 7,
              segments: [
                {
                  nodeId: "tokyo",
                  name: "东京",
                  days: 4,
                  representativeNodeIds: ["asakusa-ueno"],
                  experienceSummary: "string",
                  stayArea: "string"
                }
              ],
              includedNodeIds: ["tokyo"],
              excludedHighlights: ["string"],
              mobilityText: "string",
              budgetText: "string",
              gains: ["string"],
              tradeoffs: ["string"],
              unresolvedQuestions: ["string"],
              itinerary: [
                {
                  day: 1,
                  city: "东京",
                  area: "浅草 / 上野",
                  morning: "string",
                  afternoon: "string",
                  evening: "string",
                  stayArea: "东京",
                  placeNodeIds: ["asakusa-ueno"],
                  transport: "string",
                  costText: "string",
                  imageNodeId: "asakusa-ueno"
                }
              ],
              route: {
                nodeIds: ["tokyo", "asakusa-ueno"],
                summary: "string"
              },
              changeSummary: ["string"]
            }
          ]
        },
        context: input
      })
    });

    if (!Array.isArray(content.plans)) {
      throw new Error("DeepSeek planning response did not include plans[].");
    }

    return content.plans.map(normalizePlanDraft).filter(Boolean) as PlanVariant[];
  }

  private async chatJson(input: { system: string; user: string }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.version,
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user }
          ],
          temperature: 0.35,
          response_format: { type: "json_object" }
        })
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`DeepSeek request timed out after ${this.requestTimeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`DeepSeek request failed: ${response.status} ${detail.slice(0, 240)}`);
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = payload.choices?.[0]?.message?.content;
    if (!text) throw new Error("DeepSeek response did not include message content.");

    return JSON.parse(stripJsonFence(text)) as Record<string, unknown>;
  }
}

export const modelProvider: ModelProvider = createModelProvider();

function createModelProvider(): ModelProvider {
  if (process.env.NODE_ENV === "test" && process.env.FORCE_REAL_MODEL_PROVIDER !== "1") {
    return new MockModelProvider();
  }
  const configured = (process.env.MODEL_PROVIDER || process.env.AI_ADAPTER_MODE || "").toLowerCase();
  if (configured === "deepseek" || (!configured && process.env.DEEPSEEK_API_KEY)) {
    return new DeepSeekModelProvider();
  }
  return new MockModelProvider();
}

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

function normalizeSignalDraft(value: unknown): SignalDraft | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const targetType = record.targetType === "material" || record.targetType === "plan" ? record.targetType : "node";
  const targetId = typeof record.targetId === "string" ? record.targetId : undefined;
  if (!targetId) return undefined;
  return {
    targetType,
    targetId,
    signalType: typeof record.signalType === "string" ? record.signalType as SignalDraft["signalType"] : "want_to_know",
    polarity: polarity(record.polarity),
    intensity: intensity(record.intensity),
    reason: typeof record.reason === "string" ? record.reason : undefined,
    aspect: typeof record.aspect === "string" ? record.aspect : undefined,
    intent: typeof record.intent === "string" ? record.intent : undefined,
    conditionText: typeof record.conditionText === "string" ? record.conditionText : undefined,
    constraintCandidate: record.constraintCandidate === true,
    extractedAttributes: Array.isArray(record.extractedAttributes)
      ? record.extractedAttributes
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
          .map((item) => ({
            key: typeof item.key === "string" ? item.key : "overall",
            polarity: polarity(item.polarity),
            text: typeof item.text === "string" ? item.text : ""
          }))
          .filter((item) => item.text)
      : undefined
  };
}

function normalizeConstraintDraft(value: unknown): ConstraintDraft | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.summary !== "string") return undefined;
  return {
    targetType: typeof record.targetType === "string" ? record.targetType as ConstraintDraft["targetType"] : undefined,
    targetId: typeof record.targetId === "string" ? record.targetId : undefined,
    constraintType: typeof record.constraintType === "string" ? record.constraintType : "other",
    severity: record.severity === "hard" || record.severity === "soft" ? record.severity : "strong",
    polarity: record.polarity == null ? undefined : polarity(record.polarity),
    priorityScore: typeof record.priorityScore === "number" ? record.priorityScore : undefined,
    confidence: typeof record.confidence === "number" ? record.confidence : undefined,
    summary: record.summary,
    conditionText: typeof record.conditionText === "string" ? record.conditionText : undefined,
    structuredValue: record.structuredValue && typeof record.structuredValue === "object" && !Array.isArray(record.structuredValue)
      ? record.structuredValue as Record<string, unknown>
      : undefined
  };
}

function normalizePlanDraft(value: unknown): PlanVariant | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title : undefined;
  if (!title) return undefined;
  return {
    id: "",
    tripId: "",
    version: 1,
    title,
    summary: typeof record.summary === "string" ? record.summary : "基于当前团队偏好生成的候选方案。",
    status: "draft",
    totalDays: typeof record.totalDays === "number" ? record.totalDays : undefined,
    segments: arrayOfRecords(record.segments).map((segment) => ({
      nodeId: stringValue(segment.nodeId, "tokyo"),
      name: stringValue(segment.name, stringValue(segment.nodeId, "东京")),
      days: numberValue(segment.days, 1),
      representativeNodeIds: stringArray(segment.representativeNodeIds),
      experienceSummary: stringValue(segment.experienceSummary, ""),
      stayArea: typeof segment.stayArea === "string" ? segment.stayArea : undefined
    })),
    includedNodeIds: stringArray(record.includedNodeIds),
    excludedHighlights: stringArray(record.excludedHighlights),
    mobilityText: stringValue(record.mobilityText, "移动强度为粗略估算，以实际交通查询为准。"),
    budgetText: stringValue(record.budgetText, "粗略预算估算，未接入实时价格。"),
    budgetIsEstimate: true,
    gains: stringArray(record.gains),
    tradeoffs: stringArray(record.tradeoffs),
    basedOnSignalIds: [],
    unresolvedQuestions: stringArray(record.unresolvedQuestions),
    parentPlanId: undefined,
    changeSummary: stringArray(record.changeSummary),
    createdAt: new Date().toISOString(),
    itinerary: arrayOfRecords(record.itinerary).map((day, index) => ({
      day: numberValue(day.day, index + 1),
      city: stringValue(day.city, ""),
      area: typeof day.area === "string" ? day.area : undefined,
      morning: stringValue(day.morning, ""),
      afternoon: stringValue(day.afternoon, ""),
      evening: stringValue(day.evening, ""),
      stayArea: stringValue(day.stayArea, stringValue(day.city, "")),
      placeNodeIds: stringArray(day.placeNodeIds),
      transport: stringValue(day.transport, "市内交通 / 铁路，具体以实际查询为准。"),
      costText: stringValue(day.costText, "粗略估算"),
      imageNodeId: typeof day.imageNodeId === "string" ? day.imageNodeId : undefined
    })),
    route: record.route && typeof record.route === "object"
      ? {
          nodeIds: stringArray((record.route as Record<string, unknown>).nodeIds),
          summary: stringValue((record.route as Record<string, unknown>).summary, "")
        }
      : undefined
  };
}

function keySignalIds(input: TravelPlanningPromptInput) {
  return Array.isArray(input.roomPlaceProfiles)
    ? input.roomPlaceProfiles
        .flatMap((profile) => {
          if (!profile || typeof profile !== "object") return [];
          const ids = (profile as Record<string, unknown>).topSignalIds;
          return Array.isArray(ids) ? ids : [];
        })
        .filter((id): id is string => typeof id === "string")
        .slice(0, 24)
    : [];
}

function stripJsonFence(text: string) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function polarity(value: unknown): -1 | 0 | 1 {
  if (typeof value !== "number") return 0;
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

function intensity(value: unknown): MemberSignal["intensity"] {
  if (typeof value !== "number") return 1;
  if (value <= 0) return 0;
  if (value >= 5) return 5;
  return Math.round(value) as MemberSignal["intensity"];
}

function arrayOfRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
