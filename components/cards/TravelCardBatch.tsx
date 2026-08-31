"use client";

import { useEffect, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  DestinationNode,
  Material,
  Member,
  MemberSignal,
  PlaceOpinion,
  ReactionType,
  RoomNodeState,
  TravelCard
} from "@/lib/types";
import { TravelCardItem } from "@/components/cards/TravelCardItem";

export function TravelCardBatch({
  cards,
  activeIndex,
  nodes,
  members,
  currentMember,
  signals,
  opinions,
  materials,
  roomNodeStates,
  onReact,
  onComment,
  onActiveIndexChange,
  onExploreAreaFocus
}: {
  cards: TravelCard[];
  activeIndex: number;
  nodes: DestinationNode[];
  members: Member[];
  currentMember: Member;
  signals: MemberSignal[];
  opinions: PlaceOpinion[];
  materials: Material[];
  roomNodeStates: RoomNodeState[];
  onReact: (card: TravelCard, reaction: ReactionType) => void;
  onComment: (
    card: TravelCard,
    text: string,
    visibility: "group" | "ai_only",
    source?: "text" | "voice"
  ) => void;
  onActiveIndexChange: (index: number) => void;
  onExploreAreaFocus: (nodeId: string) => void;
}) {
  const dragStartX = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const clampedIndex = Math.min(Math.max(activeIndex, 0), Math.max(0, cards.length - 1));
  const activeCard = cards[clampedIndex]!;
  const nextCard = cards[clampedIndex + 1];

  useEffect(() => {
    if (activeIndex !== clampedIndex) onActiveIndexChange(clampedIndex);
  }, [activeIndex, clampedIndex, onActiveIndexChange]);

  if (cards.length === 0) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center rounded-[24px] border border-dashed border-ink/15 bg-white p-8 text-center text-sm text-ink/55">
        还没有卡片。发送旅行意向后，AI 会先供应具体目的地。
      </div>
    );
  }

  function goTo(index: number) {
    dragOffsetRef.current = 0;
    setDragOffset(0);
    if (cards.length <= 1) {
      onActiveIndexChange(0);
      return;
    }
    onActiveIndexChange((index + cards.length) % cards.length);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    dragStartX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragStartX.current === null) return;
    const nextOffset = event.clientX - dragStartX.current;
    const boundedOffset = Math.max(-160, Math.min(160, nextOffset));
    dragOffsetRef.current = boundedOffset;
    setDragOffset(boundedOffset);
  }

  function handlePointerEnd() {
    if (dragStartX.current === null) return;
    const finalOffset = dragOffsetRef.current;
    if (finalOffset < -72) goTo(clampedIndex + 1);
    else if (finalOffset > 72) goTo(clampedIndex - 1);
    else {
      dragOffsetRef.current = 0;
      setDragOffset(0);
    }
    dragStartX.current = null;
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft") goTo(clampedIndex - 1);
    if (event.key === "ArrowRight") goTo(clampedIndex + 1);
  }

  return (
    <section
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      aria-label="单卡 Swipe 浏览"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="mb-2 flex shrink-0 justify-end gap-2">
        <button
          type="button"
          className="focus-ring grid size-8 place-items-center rounded-full bg-white text-ink shadow-[0_8px_20px_rgba(23,33,31,0.08)] disabled:opacity-35"
          aria-label="向左滑动卡片"
          disabled={cards.length <= 1}
          onClick={() => goTo(clampedIndex - 1)}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="focus-ring grid size-8 place-items-center rounded-full bg-white text-ink shadow-[0_8px_20px_rgba(23,33,31,0.08)] disabled:opacity-35"
          aria-label="向右滑动卡片"
          disabled={cards.length <= 1}
          onClick={() => goTo(clampedIndex + 1)}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-hidden px-1 pb-2 [touch-action:pan-y]"
        onPointerDownCapture={handlePointerDown}
        onPointerMoveCapture={handlePointerMove}
        onPointerUpCapture={handlePointerEnd}
        onPointerCancelCapture={handlePointerEnd}
      >
        {nextCard && (
          <div
            className="pointer-events-none absolute inset-x-5 bottom-2 top-5 mx-auto max-w-[620px] translate-x-5 rotate-2 rounded-[28px] border border-ink/10 bg-white/70 shadow-[0_10px_24px_rgba(23,33,31,0.07)]"
            aria-hidden="true"
          >
            <div className="p-4 text-sm font-semibold text-ink/35">{nextCard.title}</div>
          </div>
        )}
        <div
          className="absolute inset-0 flex justify-center transition-transform duration-200 ease-out"
          style={{
            transform: `translateX(${dragOffset}px) rotate(${dragOffset / 28}deg)`
          }}
        >
          <div className="h-full w-full max-w-[620px]">
            <TravelCardItem
              card={activeCard}
              nodes={nodes}
              members={members}
              currentMember={currentMember}
              signals={signals.filter((signal) => signal.targetId === activeCard.nodeId)}
              opinions={opinions.filter((opinion) => opinion.nodeId === activeCard.nodeId)}
              materials={materials.filter((material) => material.primaryNodeId === activeCard.nodeId)}
              roomNodeState={roomNodeStates.find((state) => state.nodeId === activeCard.nodeId)}
              onReact={onReact}
              onComment={onComment}
              onExploreAreaFocus={onExploreAreaFocus}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
