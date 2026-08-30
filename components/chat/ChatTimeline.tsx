import { CalendarDays, MapPin } from "lucide-react";
import type { ChatMessage, DestinationNode, MemberSignal, PlanVariant, TravelCard, Trip } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";

export function ChatTimeline({
  trip,
  messages,
  nodes,
  cardsByNodeId,
  plans,
  signals,
  onOpenPlace,
  onOpenPlanning
}: {
  trip: Trip;
  messages: ChatMessage[];
  nodes: DestinationNode[];
  cardsByNodeId: Record<string, TravelCard>;
  plans: PlanVariant[];
  signals: MemberSignal[];
  onOpenPlace: (nodeId: string) => void;
  onOpenPlanning: () => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5" aria-label="Group Conversation">
      <div className="space-y-5">
        {messages
          .filter((message) => message.visibility === "group")
          .map((message) => {
            const cardNodeIds = Array.isArray(message.payload?.cardNodeIds)
              ? message.payload.cardNodeIds.filter((nodeId): nodeId is string => typeof nodeId === "string")
              : [];
            const payloadNodeId =
              typeof message.payload?.nodeId === "string"
                ? message.payload.nodeId
                : typeof message.payload?.primaryNodeId === "string"
                  ? message.payload.primaryNodeId
                  : undefined;
            const placeNodeIds = Array.from(new Set([...cardNodeIds, ...(payloadNodeId ? [payloadNodeId] : [])]));
            const referencedPlans = Array.isArray(message.payload?.planIds)
              ? message.payload.planIds
                  .filter((planId): planId is string => typeof planId === "string")
                  .map((planId) => plans.find((plan) => plan.id === planId))
                  .filter((plan): plan is PlanVariant => Boolean(plan))
              : [];

            return (
              <div key={message.id} className="space-y-3">
                <MessageBubble trip={trip} message={message} />
                {placeNodeIds.length > 0 && (
                  <PlaceReferenceRow
                    nodeIds={placeNodeIds}
                    nodes={nodes}
                    cardsByNodeId={cardsByNodeId}
                    signals={signals}
                    onOpenPlace={onOpenPlace}
                  />
                )}
                {referencedPlans.length > 0 && (
                  <PlanReferenceRow plans={referencedPlans} onOpenPlanning={onOpenPlanning} />
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

function MessageBubble({ trip, message }: { trip: Trip; message: ChatMessage }) {
  const member = trip.members.find((item) => item.id === message.authorMemberId);
  const isAi = message.authorType === "ai";
  const isSystem = message.authorType === "system";

  if (isSystem) {
    return (
      <div className="mx-auto w-fit rounded-full bg-cloud px-4 py-2 text-xs font-medium text-ink/60">
        {message.textContent}
      </div>
    );
  }

  return (
    <article className={`flex gap-3 ${isAi ? "" : "justify-end"}`}>
      {isAi && (
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-coral text-sm font-bold text-white">
          AI
        </div>
      )}
      <div
        className={`max-w-[78%] rounded-[22px] px-4 py-3 ${
          isAi ? "bg-cloud text-ink" : "bg-pine text-paper"
        }`}
      >
        <div className="mb-1 text-xs font-semibold opacity-70">
          {isAi ? "TripRoom AI" : member?.displayName}
        </div>
        <p className="whitespace-pre-line text-sm leading-6">{message.textContent}</p>
      </div>
      {!isAi && member && <Avatar member={member} className="shrink-0" />}
    </article>
  );
}

function PlaceReferenceRow({
  nodeIds,
  nodes,
  cardsByNodeId,
  signals,
  onOpenPlace
}: {
  nodeIds: string[];
  nodes: DestinationNode[];
  cardsByNodeId: Record<string, TravelCard>;
  signals: MemberSignal[];
  onOpenPlace: (nodeId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 pl-12">
      {nodeIds.map((nodeId) => {
        const node = nodes.find((item) => item.id === nodeId);
        const card = cardsByNodeId[nodeId];
        const label = node?.canonicalName ?? card?.title ?? nodeId;
        const summary = summarizePlaceSignals(signals, nodeId);

        return (
          <button
            key={nodeId}
            type="button"
            className="focus-ring inline-flex max-w-full items-center gap-2 rounded-full border border-ink/10 bg-white px-3 py-2 text-left text-xs font-semibold text-ink/70 shadow-[0_6px_16px_rgba(23,33,31,0.06)]"
            onClick={() => onOpenPlace(nodeId)}
          >
            <MapPin size={13} className="shrink-0 text-coral" aria-hidden="true" />
            <span className="truncate">{label}</span>
            {summary && <span className="shrink-0 text-ink/40">· {summary}</span>}
          </button>
        );
      })}
    </div>
  );
}

function PlanReferenceRow({
  plans,
  onOpenPlanning
}: {
  plans: PlanVariant[];
  onOpenPlanning: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 pl-12">
      {plans.map((plan) => (
        <button
          key={plan.id}
          type="button"
          className="focus-ring inline-flex max-w-full items-center gap-2 rounded-full border border-ink/10 bg-white px-3 py-2 text-left text-xs font-semibold text-ink/70 shadow-[0_6px_16px_rgba(23,33,31,0.06)]"
          onClick={onOpenPlanning}
        >
          <CalendarDays size={13} className="shrink-0 text-pine" aria-hidden="true" />
          <span className="truncate">{plan.title}</span>
        </button>
      ))}
    </div>
  );
}

function summarizePlaceSignals(signals: MemberSignal[], nodeId: string) {
  const nodeSignals = signals.filter((signal) => signal.targetType === "node" && signal.targetId === nodeId);
  const positiveMembers = new Set(
    nodeSignals
      .filter((signal) => signal.polarity > 0 || signal.signalType === "want_to_know")
      .map((signal) => signal.memberId)
  );
  const negativeMembers = new Set(
    nodeSignals.filter((signal) => signal.polarity < 0).map((signal) => signal.memberId)
  );

  if (positiveMembers.size > 0 && negativeMembers.size > 0) return "有分歧";
  if (positiveMembers.size > 0) return `${positiveMembers.size} 人感兴趣`;
  if (negativeMembers.size > 0) return `${negativeMembers.size} 人有顾虑`;
  return "";
}
