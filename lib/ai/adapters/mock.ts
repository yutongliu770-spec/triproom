import type { TravelCard } from "@/lib/types";
import type { EventAnalysis, InterventionDecision } from "@/lib/ai/schemas";
import { generateJapanPlanVariants } from "@/lib/plans/generator";
import type { TravelDataService } from "@/lib/travel/service";

export interface AIGenerationResult {
  messageText?: string;
  cardBatch?: TravelCard[];
  plans?: ReturnType<typeof generateJapanPlanVariants>;
  proposedFollowUp?: string;
}

export class MockLLMAdapter {
  constructor(private readonly travelData: TravelDataService) {}

  async analyzeEvent(input: { text?: string }): Promise<EventAnalysis> {
    const text = input.text ?? "";
    const extractedNodes = [
      ["日本", "japan"],
      ["东京", "tokyo"],
      ["大阪", "osaka"],
      ["环球", "usj"],
      ["USJ", "usj"],
      ["富士", "fuji-kawaguchiko"],
      ["箱根", "hakone"],
      ["镰仓", "kamakura"]
    ]
      .filter(([keyword]) => text.includes(keyword))
      .map(([name, canonicalNodeId]) => ({ name, canonicalNodeId, confidence: 0.9 }));

    const durationMatch = text.match(/(\d+)\s*天/);

    return {
      extractedNodes,
      newMaterials: [],
      signals: [],
      structuralUpdates: durationMatch
        ? [
            {
              key: "trip_duration",
              value: Number(durationMatch[1]),
              confidence: 0.9,
              requiresConfirmation: false
            }
          ]
        : [],
      factsOrClaims: [],
      requiresAIResponse: /日本|东京|大阪|环球|USJ|富士|箱根|怎么|推荐|方案/.test(text),
      responseReason: "mock_keyword_match"
    };
  }

  async decideIntervention(input: { text?: string }): Promise<InterventionDecision> {
    const text = input.text ?? "";

    if (/东京.*(肯定|一定|先看|展开|看看)|想.*东京/.test(text)) {
      return {
        shouldSpeak: true,
        mode: "expand_branch",
        score: 8,
        reasons: ["用户明确把东京设为当前焦点"],
        focusNodeId: "tokyo",
        cardNodeIds: ["asakusa-ueno", "shibuya-shinjuku", "tokyo-disney", "kamakura", "hakone"]
      };
    }

    if (/(远|交通|预算|几天|够不够|怎么去|值得|安排)/.test(text)) {
      return {
        shouldSpeak: true,
        mode: "answer_fact",
        score: 9,
        reasons: ["用户在追问地点或路线事实"],
        focusNodeId: inferFocusNode(text)
      };
    }

    if (/方案|怎么组合|够不够时间|哪种/.test(text)) {
      return {
        shouldSpeak: true,
        mode: "offer_plan",
        score: 8,
        reasons: ["出现路线级问题"],
        planIds: ["plan-a-v1", "plan-b-v1"]
      };
    }

    if (/日本/.test(text)) {
      return {
        shouldSpeak: true,
        mode: "supply_cards",
        score: 7,
        reasons: ["冷启动已有国家意向，适合直接供给具体目的地"],
        focusNodeId: "japan",
        cardNodeIds: [
          "arashiyama",
          "fushimi-inari",
          "usj",
          "kamakura",
          "lake-kawaguchiko"
        ]
      };
    }

    return {
      shouldSpeak: false,
      mode: "stay_silent",
      score: 1,
      reasons: [],
      suppressedBy: ["普通聊天不需要 AI 抢话"]
    };
  }

  async generateResponse(input: {
    decision: InterventionDecision;
    tripId: string;
  }): Promise<AIGenerationResult> {
    const { decision } = input;

    if (decision.mode === "expand_branch") {
      return {
        messageText:
          "好，东京可以先作为当前焦点。下面这几张不是同一种东西：有传统街区、城市夜景、整天主题乐园，也有镰仓和箱根这种周边。大家不用按顺序评价，看到有感觉的点一下或说一句就行。",
        cardBatch: await this.travelData.getCardsForNodes(decision.cardNodeIds ?? [])
      };
    }

    if (decision.mode === "offer_plan") {
      return {
        messageText:
          "你们现在已经有两个比较清楚的路线方向了。我先整理成两版结构方案，重点看得到什么、放弃什么，而不是直接给唯一答案。",
        plans: generateJapanPlanVariants({ tripId: input.tripId, totalDays: 7 })
      };
    }

    if (decision.mode === "answer_fact") {
      return {
        messageText: factAnswer(decision.focusNodeId)
      };
    }

    if (decision.mode === "supply_cards") {
      return {
        messageText:
          "如果现在只确定想去日本，可以先从具体地点建立感觉。我先混合京都、关西、东京周边和富士山方向，之后可以聚焦某个城市，也可以换一组完全不同的小簇。",
        cardBatch: await this.travelData.getCardsForNodes(decision.cardNodeIds ?? [])
      };
    }

    return {};
  }
}

function inferFocusNode(text: string) {
  if (/镰仓|鎌倉|江之岛|高校前/i.test(text)) return "kamakura";
  if (/箱根/.test(text)) return "hakone";
  if (/富士|河口湖/.test(text)) return "fuji-kawaguchiko";
  if (/大阪|USJ|环球/.test(text)) return "osaka";
  if (/京都/.test(text)) return "kyoto";
  if (/东京/.test(text)) return "tokyo";
  return undefined;
}

function factAnswer(nodeId?: string) {
  if (nodeId === "kamakura") {
    return "镰仓从东京出发适合半天到一天。它的价值是海边、电车和小街散步；主要代价是会占用东京行程的一段完整白天。现在先不要把它当成必去，可以看大家对“海边电车”和“时间成本”的反应。";
  }

  if (nodeId === "hakone" || nodeId === "fuji-kawaguchiko") {
    return "箱根 / 富士山方向更适合 1-2 天。如果你们想少移动，东京 + 箱根会比东京 + 大阪轻；但如果 USJ 是必去，就要在自然段和大阪段之间做取舍。交通与预算现在都是参考估算 / Mock Data。";
  }

  if (nodeId === "osaka") {
    return "东京 + 大阪 7 天可以做，但会增加一次长距离移动和换酒店压力。它的主要收益是 USJ 和关西美食；主要取舍是富士山 / 箱根大概率要压缩或放弃。";
  }

  return "这个问题我先按 Mock 旅行知识回答：当前 MVP 不接实时地图、票价或天气 API，所以交通和预算都只是参考估算。适合先用它判断路线结构，等方向稳定后再查真实数据。";
}
