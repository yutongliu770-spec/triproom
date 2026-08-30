import { MockLLMAdapter } from "@/lib/ai/adapters/mock";
import { travelDataService } from "@/lib/travel/service";

export async function processTripEvent(input: { tripId: string; text?: string }) {
  const adapter = new MockLLMAdapter(travelDataService);
  const analysis = await adapter.analyzeEvent({ text: input.text });
  const decision = await adapter.decideIntervention({ text: input.text });
  const generation = decision.shouldSpeak
    ? await adapter.generateResponse({ decision, tripId: input.tripId })
    : {};

  return {
    analysis,
    decision,
    generation
  };
}
