import { z } from "zod";

export const eventAnalysisSchema = z.object({
  extractedNodes: z.array(
    z.object({
      name: z.string(),
      canonicalNodeId: z.string().optional(),
      confidence: z.number()
    })
  ),
  newMaterials: z.array(
    z.object({
      title: z.string(),
      materialType: z.string(),
      sourceType: z.string(),
      summary: z.string().optional(),
      nodeIds: z.array(z.string()),
      confidence: z.number()
    })
  ),
  signals: z.array(z.unknown()),
  structuralUpdates: z.array(
    z.object({
      key: z.enum(["trip_duration", "rough_date", "destination_focus", "budget_band", "constraint"]),
      value: z.unknown(),
      confidence: z.number(),
      requiresConfirmation: z.boolean()
    })
  ),
  factsOrClaims: z.array(
    z.object({
      text: z.string(),
      type: z.enum(["verified_fact", "user_experience", "unverified_claim"]),
      source: z.string().optional()
    })
  ),
  requiresAIResponse: z.boolean(),
  responseReason: z.string().optional()
});

export const interventionDecisionSchema = z.object({
  shouldSpeak: z.boolean(),
  mode: z.enum([
    "ask_minimal_question",
    "supply_cards",
    "answer_fact",
    "acknowledge_material",
    "expand_branch",
    "summarize",
    "reframe_key_decision",
    "offer_plan",
    "revise_plan",
    "stay_silent"
  ]),
  score: z.number(),
  reasons: z.array(z.string()),
  suppressedBy: z.array(z.string()).optional(),
  focusNodeId: z.string().optional(),
  cardNodeIds: z.array(z.string()).optional(),
  planIds: z.array(z.string()).optional()
});

export type EventAnalysis = z.infer<typeof eventAnalysisSchema>;
export type InterventionDecision = z.infer<typeof interventionDecisionSchema>;
