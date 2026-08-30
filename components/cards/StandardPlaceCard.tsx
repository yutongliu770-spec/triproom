"use client";

import { useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import Image from "next/image";
import {
  ChevronRight,
  CircleHelp,
  CircleMinus,
  Clock3,
  ExternalLink,
  Flame,
  Heart,
  LocateFixed,
  MapPin,
  MessageCircle,
  Mic,
  Sparkles,
  TriangleAlert,
  WalletCards,
  X,
  XCircle
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { EstimateBadge } from "@/components/ui/EstimateBadge";
import { placeContextForNode } from "@/lib/graph/explore-recommendations";
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

const reactions: Array<{ type: ReactionType; label: string; Icon: LucideIcon }> = [
  { type: "want_to_go", label: "想去", Icon: Heart },
  { type: "neutral", label: "一般", Icon: CircleMinus },
  { type: "not_interested", label: "不想去", Icon: XCircle },
  { type: "want_to_know", label: "想了解", Icon: CircleHelp }
];

export function StandardPlaceCard({
  card,
  nodes,
  members,
  currentMember,
  signals,
  opinions,
  materials,
  roomNodeState,
  variant = "explore",
  onReact,
  onComment,
  onExploreAreaFocus
}: {
  card: TravelCard;
  nodes: DestinationNode[];
  members: Member[];
  currentMember: Member;
  signals: MemberSignal[];
  opinions: PlaceOpinion[];
  materials: Material[];
  roomNodeState?: RoomNodeState;
  variant?: "explore" | "detail";
  onReact: (card: TravelCard, reaction: ReactionType) => void;
  onComment: (
    card: TravelCard,
    text: string,
    visibility: "group" | "ai_only",
    source?: "text" | "voice"
  ) => void;
  onExploreAreaFocus?: (nodeId: string) => void;
}) {
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [privateComment, setPrivateComment] = useState(false);
  const [voiceComment, setVoiceComment] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const visibleOpinions = opinions.filter(
    (opinion) =>
      opinion.nodeId === card.nodeId &&
      (opinion.visibility === "group" || opinion.memberId === currentMember.id)
  );
  const latestMemberSignals = getLatestMemberSignals(signals, members, card.nodeId);
  const images = card.images?.length
    ? card.images
    : card.imageUrl
      ? [{ url: card.imageUrl, alt: card.imageAlt }]
      : [];
  const placeContext = placeContextForNode(card.nodeId, nodes);
  const relatedMaterials = materials.filter((material) => material.primaryNodeId === card.nodeId);
  const activityCount = visibleOpinions.length + relatedMaterials.length;
  const interestLabel = groupInterestLabel(roomNodeState);
  const engagementText = engagementLabel(roomNodeState);
  const isDetail = variant === "detail";
  const explorableArea = placeContext.cluster ?? placeContext.parent;

  function submitComment() {
    const text = comment.trim();
    if (!text) return;
    onComment(card, text, privateComment ? "ai_only" : "group", voiceComment ? "voice" : "text");
    setComment("");
    setVoiceComment(false);
  }

  return (
    <article
      className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-ink/10 bg-white shadow-[0_12px_30px_rgba(23,33,31,0.08)] transition duration-200 ${
        commentPanelOpen ? "bg-ink/5" : ""
      } ${isDetail ? "max-w-[680px]" : ""}`}
      aria-label={`Standard Place Card ${card.title}`}
    >
      <div
        className={`min-h-0 origin-top overflow-hidden bg-white transition duration-300 ${
          commentPanelOpen
            ? "h-[46%] -translate-y-2 scale-[0.92] rounded-[24px] shadow-[0_16px_36px_rgba(23,33,31,0.12)]"
            : "flex-1"
        }`}
      >
        <ImagePager
          images={images}
          imageIndex={imageIndex}
          compact={commentPanelOpen}
          onImageIndexChange={setImageIndex}
        />

        <div className={`${commentPanelOpen ? "px-4 pb-3 pt-3" : "px-4 pb-3 pt-3 md:px-4"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {placeContext.label && (
                onExploreAreaFocus && explorableArea ? (
                  <button
                    type="button"
                    className="focus-ring mb-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-cloud px-2.5 py-1 text-xs font-semibold text-ink/60 hover:bg-coral/10 hover:text-coral"
                    aria-label={`探索${explorableArea.canonicalName}`}
                    title={`探索${explorableArea.canonicalName}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onExploreAreaFocus(explorableArea.id);
                    }}
                  >
                    <MapPin size={13} className="shrink-0 text-coral" aria-hidden="true" />
                    <span className="truncate">{placeContext.label}</span>
                    <LocateFixed size={12} className="shrink-0" aria-hidden="true" />
                  </button>
                ) : (
                  <div className="mb-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-cloud px-2.5 py-1 text-xs font-semibold text-ink/60">
                    <MapPin size={13} className="shrink-0 text-coral" aria-hidden="true" />
                    <span className="truncate">{placeContext.label}</span>
                  </div>
                )
              )}
              <h3 className={`${commentPanelOpen ? "text-xl" : "text-2xl"} font-semibold leading-tight text-ink`}>
                {card.title}
              </h3>
              {card.subtitle && !commentPanelOpen && (
                <p className="mt-1 text-xs font-medium text-ink/45">{card.subtitle}</p>
              )}
            </div>
          </div>

          {!commentPanelOpen && (
            <>
              <p className="mt-2 line-clamp-2 text-sm leading-5 text-ink/70">{card.shortSummary}</p>
              <ul className="mt-2 grid gap-1 text-sm leading-5 text-ink/70">
                {card.highlights.slice(0, 3).map((highlight) => (
                  <li key={highlight} className="flex gap-2">
                    <Sparkles size={15} className="mt-0.5 shrink-0 text-coral" aria-hidden="true" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 grid grid-cols-1 gap-1.5 rounded-2xl bg-cloud px-3 py-2 text-xs leading-5 text-ink/65 sm:grid-cols-2">
                <span className="inline-flex gap-2">
                  <Clock3 size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  {card.suggestedStay?.text}
                </span>
                <span className="inline-flex gap-2">
                  <WalletCards size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  {card.budget?.text}
                </span>
              </div>
            </>
          )}

          <div className="mt-2 flex items-center justify-between gap-3">
            <MemberReactionLine latestMemberSignals={latestMemberSignals} compact={commentPanelOpen} />
          </div>

          {!commentPanelOpen && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1.5">
                {reactions.slice(0, 3).map((reaction) => (
                  <button
                    key={reaction.type}
                    type="button"
                    className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-paper px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-coral/40"
                    onClick={() => onReact(card, reaction.type)}
                  >
                    <reaction.Icon size={14} className="text-coral" aria-hidden="true" />
                    {reaction.label}
                  </button>
                ))}
              </div>
              <XiaohongshuLink
                href={card.socialDiscovery?.xiaohongshu?.searchUrl}
                label={`去小红书查看${card.title}攻略`}
              />
              <button
                type="button"
                className="focus-ring ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-pine px-3 py-2 text-xs font-semibold text-paper"
                aria-label={`查看${card.title}观点`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setCommentPanelOpen(true);
                }}
              >
                <MessageCircle size={14} aria-hidden="true" />
                {activityCount}
              </button>
            </div>
          )}
        </div>
      </div>

      {commentPanelOpen && (
        <div
          className="comment-sheet-enter absolute inset-x-0 bottom-0 z-20 h-[70%] translate-y-0 rounded-t-[22px] border-t border-ink/10 bg-white shadow-[0_-18px_40px_rgba(23,33,31,0.16)]"
          aria-label={`${card.title}评论区`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <CommentPanel
            card={card}
            members={members}
            latestMemberSignals={latestMemberSignals}
            opinions={visibleOpinions}
            materials={relatedMaterials}
            interestLabel={interestLabel}
            engagementText={engagementText}
            xiaohongshuUrl={card.socialDiscovery?.xiaohongshu?.searchUrl}
            comment={comment}
            privateComment={privateComment}
            onCommentChange={setComment}
            onPrivateCommentChange={setPrivateComment}
            onVoiceDraft={() => {
              setComment("海边和电车我挺喜欢，不过专门占一天感觉有点久。");
              setVoiceComment(true);
            }}
            onSubmitComment={submitComment}
            onClose={() => setCommentPanelOpen(false)}
            onReact={(reaction) => onReact(card, reaction)}
          />
        </div>
      )}
    </article>
  );
}

function ImagePager({
  images,
  imageIndex,
  compact,
  onImageIndexChange
}: {
  images: Array<{ url: string; alt: string; caption?: string }>;
  imageIndex: number;
  compact: boolean;
  onImageIndexChange: (index: number) => void;
}) {
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const activeImage = images[imageIndex] ?? images[0];

  function go(delta: number) {
    if (images.length <= 1) return;
    onImageIndexChange((imageIndex + delta + images.length) % images.length);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    setDragStartX(event.clientX);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (dragStartX === null) return;
    const delta = event.clientX - dragStartX;
    if (delta < -42) go(1);
    if (delta > 42) go(-1);
    setDragStartX(null);
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || images.length <= 1) return;
    event.preventDefault();
    go(event.deltaX > 0 ? 1 : -1);
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-cloud transition-[height] duration-200 ${
        compact ? "h-[98px]" : "h-[150px] md:h-[168px]"
      }`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={() => setDragStartX(null)}
      onWheel={handleWheel}
    >
      {activeImage && (
        <Image
          src={activeImage.url}
          alt={activeImage.alt}
          width={900}
          height={560}
          className="h-full w-full object-cover"
          priority={!compact && imageIndex === 0}
        />
      )}
      <div className="absolute left-3 top-3">
        <EstimateBadge />
      </div>
      {images.length > 1 && (
        <>
          <button
            type="button"
            className="focus-ring absolute left-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink"
            aria-label="上一张图片"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              go(-1);
            }}
          >
            <ChevronRight size={16} className="rotate-180" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="focus-ring absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink"
            aria-label="下一张图片"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              go(1);
            }}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-ink/45 px-2 py-1">
            {images.map((image, index) => (
              <button
                key={`${image.url}-${index}`}
                type="button"
                className={`size-1.5 rounded-full ${index === imageIndex ? "bg-white" : "bg-white/45"}`}
                aria-label={`查看第 ${index + 1} 张图片`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onImageIndexChange(index);
                }}
              />
            ))}
          </div>
          <div className="absolute bottom-3 right-3 rounded-full bg-ink/55 px-2 py-1 text-[10px] font-semibold text-white">
            {imageIndex + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  );
}

function CommentPanel({
  card,
  members,
  latestMemberSignals,
  opinions,
  materials,
  interestLabel,
  engagementText,
  xiaohongshuUrl,
  comment,
  privateComment,
  onCommentChange,
  onPrivateCommentChange,
  onVoiceDraft,
  onSubmitComment,
  onClose,
  onReact
}: {
  card: TravelCard;
  members: Member[];
  latestMemberSignals: Array<{ member: Member; signal: MemberSignal }>;
  opinions: PlaceOpinion[];
  materials: Material[];
  interestLabel: string;
  engagementText: string;
  xiaohongshuUrl?: string;
  comment: string;
  privateComment: boolean;
  onCommentChange: (value: string) => void;
  onPrivateCommentChange: (value: boolean) => void;
  onVoiceDraft: () => void;
  onSubmitComment: () => void;
  onClose: () => void;
  onReact: (reaction: ReactionType) => void;
}) {
  const discussionMembers = withDemoCommentMembers(members);
  const activityItems = buildPlaceActivityItems({
    opinions,
    materials,
    members: discussionMembers,
    xiaohongshuUrl,
    card
  });
  const externalItems = activityItems.filter((item) => item.type !== "opinion");
  const discussionItems = buildPlaceDiscussionItems({
    card,
    members: discussionMembers,
    latestMemberSignals,
    opinions
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-t-[22px] bg-white">
      <div className="shrink-0 border-b border-ink/10 bg-white px-3.5 pb-2 pt-1.5">
        <div className="mx-auto mb-1.5 h-1 w-9 rounded-full bg-ink/15" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 text-center">
            <h4 className="truncate text-[15px] font-semibold leading-5 text-ink">评论区</h4>
            <p className="truncate text-[11px] font-medium leading-4 text-ink/40">{card.title}</p>
          </div>
          <button
            type="button"
            className="focus-ring grid size-7 shrink-0 place-items-center rounded-full bg-cloud text-ink/60"
            aria-label={`收起${card.title}观点`}
            onClick={onClose}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-2.5">
        <section aria-label="感兴趣程度">
          <div className="flex items-center justify-between gap-3">
            <h5 className="text-[13px] font-semibold leading-5 text-ink">感兴趣程度</h5>
            <span className="truncate text-[11px] font-medium leading-4 text-ink/45">讨论度：{engagementText}</span>
          </div>
          <div className="mt-1.5 rounded-2xl bg-paper px-3 py-2">
            <div className="flex items-center gap-3">
              <div className="shrink-0 text-xs font-semibold text-ink">{interestLabel}</div>
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-cloud">
                <div
                  className="h-full rounded-full bg-coral"
                  style={{ width: `${interestPercentFromText(interestLabel)}%` }}
                />
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {reactions.slice(0, 3).map((reaction) => (
              <button
                key={reaction.type}
                type="button"
                className="focus-ring inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white px-2.5 py-1 text-[11px] font-semibold leading-4 text-ink hover:border-coral/40"
                onClick={() => onReact(reaction.type)}
              >
                <reaction.Icon size={13} className="text-coral" aria-hidden="true" />
                {reaction.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-3" aria-label="成员态度评论">
          <div className="space-y-2.5">
            {discussionItems.map((item) => (
              <PlaceCommentRow key={item.id} item={item} />
            ))}
          </div>
          <div className="mt-3 rounded-2xl border border-ink/10 bg-paper p-2">
            <div className="flex gap-2">
              <input
                value={comment}
                onChange={(event) => onCommentChange(event.target.value)}
                placeholder={`说一句对${card.title}的感受`}
                className="focus-ring min-w-0 flex-1 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs leading-5 text-ink placeholder:text-ink/35"
              />
              <button
                type="button"
                className="focus-ring grid size-8 place-items-center rounded-full bg-cloud text-ink/70"
                aria-label="填入语音转写示例"
                onClick={onVoiceDraft}
              >
                <Mic size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="focus-ring grid size-8 place-items-center rounded-full bg-pine text-paper"
                aria-label="发送评论"
                onClick={onSubmitComment}
              >
                <MessageCircle size={14} aria-hidden="true" />
              </button>
            </div>
            <label className="mt-1.5 flex items-center gap-1.5 text-[11px] leading-4 text-ink/50">
              <input
                type="checkbox"
                checked={privateComment}
                onChange={(event) => onPrivateCommentChange(event.target.checked)}
              />
              仅 AI 可见
            </label>
          </div>
        </section>

        <section className="mt-3 border-t border-ink/10 pb-3 pt-2.5" aria-label="小红书或抖音链接">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-[13px] font-semibold leading-5 text-ink">相关链接</h5>
            <span className="text-[11px] font-semibold leading-4 text-ink/40">{externalItems.length} 个来源</span>
          </div>
          <div className="mt-2 space-y-2">
            {externalItems.length === 0 ? (
              <div className="rounded-2xl bg-paper p-2.5 text-xs leading-5 text-ink/45">
                暂时没有外部链接。小红书入口会使用真实搜索页，抖音只展示成员主动分享的 URL。
              </div>
            ) : (
              externalItems.map((item) => <PlaceActivityCard key={item.id} item={item} />)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

type PlaceActivityItem =
  | {
      id: string;
      type: "opinion";
      sourceLabel: string;
      member?: Member;
      content: string;
      isVoice: boolean;
      createdAt: string;
    }
  | {
      id: string;
      type: "material" | "xiaohongshu_entry";
      sourceLabel: string;
      member?: Member;
      title: string;
      summary?: string;
      imageUrl?: string;
      sourceUrl?: string;
      createdAt: string;
    };

type PlaceDiscussionItem = {
  id: string;
  member: Member;
  attitudeLabel: string;
  content: string;
  sourceLabel: string;
  isVoice: boolean;
  isMock: boolean;
};

const demoCommentMembers: Member[] = [
  { id: "m-anna", displayName: "安安", avatarUrl: "安", role: "organizer" },
  { id: "m-bo", displayName: "博文", avatarUrl: "博", role: "member" },
  { id: "m-chen", displayName: "晨晨", avatarUrl: "晨", role: "member" },
  { id: "m-ding", displayName: "丁丁", avatarUrl: "丁", role: "member" }
];

function withDemoCommentMembers(members: Member[]) {
  const isDemoRoomMember = members.some((member) =>
    demoCommentMembers.some((demoMember) => demoMember.id === member.id)
  );

  if (!isDemoRoomMember || members.length >= demoCommentMembers.length) return members;

  const memberById = new Map(members.map((member) => [member.id, member]));

  for (const demoMember of demoCommentMembers) {
    if (!memberById.has(demoMember.id)) memberById.set(demoMember.id, demoMember);
  }

  return demoCommentMembers.map((demoMember) => memberById.get(demoMember.id) ?? demoMember);
}

function buildPlaceDiscussionItems({
  card,
  members,
  latestMemberSignals,
  opinions
}: {
  card: TravelCard;
  members: Member[];
  latestMemberSignals: Array<{ member: Member; signal: MemberSignal }>;
  opinions: PlaceOpinion[];
}): PlaceDiscussionItem[] {
  const latestOpinionByMember = new Map<string, PlaceOpinion>();

  for (const opinion of opinions) {
    const existing = latestOpinionByMember.get(opinion.memberId);
    if (!existing || opinion.createdAt.localeCompare(existing.createdAt) > 0) {
      latestOpinionByMember.set(opinion.memberId, opinion);
    }
  }

  return members.map((member, index) => {
    const opinion = latestOpinionByMember.get(member.id);
    const signal = latestMemberSignals.find((item) => item.member.id === member.id)?.signal;
    const attitudeLabel = signal ? signalMeta(signal).label : mockAttitudeLabel(index);

    return {
      id: opinion?.id ?? `mock-discussion-${card.nodeId}-${member.id}`,
      member,
      attitudeLabel,
      content: opinion?.content ?? mockPlaceDiscussion(card, index, attitudeLabel),
      sourceLabel: opinion ? opinionSourceLabel(opinion.sourceType) : "Mock 讨论",
      isVoice: opinion?.sourceType === "voice_comment",
      isMock: !opinion
    };
  });
}

function buildPlaceActivityItems({
  opinions,
  materials,
  members,
  xiaohongshuUrl,
  card
}: {
  opinions: PlaceOpinion[];
  materials: Material[];
  members: Member[];
  xiaohongshuUrl?: string;
  card: TravelCard;
}): PlaceActivityItem[] {
  const opinionItems: PlaceActivityItem[] = opinions.map((opinion) => ({
    id: opinion.id,
    type: "opinion",
    sourceLabel: opinion.sourceType === "voice_comment" ? "语音观点" : opinionSourceLabel(opinion.sourceType),
    member: members.find((member) => member.id === opinion.memberId),
    content: opinion.content,
    isVoice: opinion.sourceType === "voice_comment",
    createdAt: opinion.createdAt
  }));
  const materialItems: PlaceActivityItem[] = materials.map((material) => ({
    id: material.id,
    type: "material",
    sourceLabel: materialSourceLabel(material),
    member: material.createdByMemberId
      ? members.find((member) => member.id === material.createdByMemberId)
      : undefined,
    title: material.title,
    summary: material.summary ?? material.rawText,
    imageUrl: material.attachmentUrl,
    sourceUrl: material.sourceUrl,
    createdAt: material.createdAt
  }));
  const xiaohongshuItem: PlaceActivityItem[] = xiaohongshuUrl
    ? [
        {
          id: `xhs-entry-${card.nodeId}`,
          type: "xiaohongshu_entry",
          sourceLabel: "小红书",
          title: `去小红书看${card.title}热门攻略`,
          summary: "真实外部搜索入口，不抓取、不缓存、不伪造帖子内容。",
          sourceUrl: xiaohongshuUrl,
          createdAt: ""
        }
      ]
    : [];

  return [...opinionItems, ...materialItems, ...xiaohongshuItem].sort((left, right) => {
    if (!left.createdAt) return 1;
    if (!right.createdAt) return -1;
    return right.createdAt.localeCompare(left.createdAt);
  });
}

function PlaceCommentRow({ item }: { item: PlaceDiscussionItem }) {
  return (
    <div className="flex gap-2.5">
      <Avatar member={item.member} className="mt-0.5 size-8 shrink-0 text-[10px]" />
      <div className="min-w-0 flex-1 border-b border-ink/10 pb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-semibold leading-4 text-ink/60">{item.member.displayName}</span>
          <span className="shrink-0 text-[10px] font-medium leading-4 text-ink/30">
            {item.isMock ? item.sourceLabel : "刚刚"}
          </span>
        </div>
        <div className="mt-0.5 text-[13px] leading-5 text-ink/78">
          <span className="mr-1.5 inline-flex rounded-full bg-coral/10 px-1.5 py-0.5 text-[10px] font-semibold leading-3 text-coral">
            {item.attitudeLabel}
          </span>
          {item.isVoice && <Mic size={12} className="mr-1 inline text-coral" aria-hidden="true" />}
          {item.content}
        </div>
        <button
          type="button"
          className="focus-ring mt-0.5 text-[11px] font-medium leading-4 text-ink/35 hover:text-ink/60"
          aria-label={`回复${item.member.displayName}`}
        >
          回复
        </button>
      </div>
    </div>
  );
}

function PlaceActivityCard({ item }: { item: PlaceActivityItem }) {
  if (item.type === "opinion") {
    return (
      <div className="rounded-2xl bg-paper p-2.5 text-xs leading-5 text-ink/70">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold leading-4 text-ink/45">
          {item.member && <Avatar member={item.member} className="size-5 text-[9px]" />}
          <span>{item.member?.displayName ?? "成员"}</span>
          <span>{item.sourceLabel}</span>
        </div>
        {item.isVoice && <Mic size={12} className="mr-1 inline text-coral" aria-hidden="true" />}
        {item.content}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-paper p-2.5 text-xs leading-5 text-ink/70">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold leading-4 text-ink/45">
        {item.member && <Avatar member={item.member} className="size-5 text-[9px]" />}
        <span>{item.member ? `${item.member.displayName} 分享了` : "外部入口"}</span>
        <span>{item.sourceLabel}</span>
      </div>
      <div className="mt-1 font-semibold leading-5 text-ink">{item.title}</div>
      {item.imageUrl && (
        <span className="relative mt-1.5 block h-16 overflow-hidden rounded-xl bg-cloud">
          <Image src={item.imageUrl} alt="" fill sizes="260px" className="object-cover" />
        </span>
      )}
      {item.summary && <p className="mt-1 line-clamp-2">{item.summary}</p>}
      {item.sourceUrl && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="focus-ring mt-1.5 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold leading-4 text-ink/70"
        >
          打开原文
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

function XiaohongshuLink({
  href,
  label,
  compact = true
}: {
  href?: string;
  label: string;
  compact?: boolean;
}) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className={`focus-ring inline-flex items-center gap-2 rounded-full border border-[#ff2442]/20 bg-[#ff2442]/10 font-semibold text-[#ff2442] hover:border-[#ff2442]/45 ${
        compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm"
      }`}
    >
      <span className="grid size-5 place-items-center rounded-full bg-[#ff2442] text-[10px] font-bold text-white">
        红
      </span>
      小红书攻略
      <ExternalLink size={compact ? 13 : 15} aria-hidden="true" />
    </a>
  );
}

function MemberReactionLine({
  latestMemberSignals,
  compact
}: {
  latestMemberSignals: Array<{ member: Member; signal: MemberSignal }>;
  compact: boolean;
}) {
  if (compact) {
    return (
      <div className="min-w-0 flex-1 truncate text-xs font-semibold text-ink/45">
        {latestMemberSignals.length ? `${latestMemberSignals.length} 人已表态` : "等待成员表态"}
      </div>
    );
  }

  return (
    <div className="min-h-8 min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]">
      {latestMemberSignals.length === 0 ? (
        <div className="flex h-8 items-center text-xs text-ink/45">等待成员表态</div>
      ) : (
        <div className="flex w-max items-center gap-2">
          {latestMemberSignals.map(({ member, signal }) => {
            const meta = signalMeta(signal);
            return (
              <span
                key={`${member.id}-${signal.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-cloud px-2.5 py-1.5 text-xs font-medium text-ink/70"
                title={`${member.displayName}：${meta.label}`}
              >
                <meta.Icon size={14} className={meta.iconClassName} aria-hidden="true" />
                <Avatar member={member} className="size-5 text-[9px]" />
                <span>{member.displayName}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getLatestMemberSignals(signals: MemberSignal[], members: Member[], targetNodeId: string) {
  const publicSignals = signals.filter(
    (signal) =>
      signal.visibility === "group" &&
      signal.targetType === "node" &&
      signal.targetId === targetNodeId
  );
  const latestByMember = new Map<string, MemberSignal>();

  for (const signal of publicSignals) latestByMember.set(signal.memberId, signal);

  return members
    .map((member) => {
      const signal = latestByMember.get(member.id);
      return signal ? { member, signal } : undefined;
    })
    .filter((item): item is { member: Member; signal: MemberSignal } => Boolean(item));
}

function signalMeta(signal: MemberSignal): {
  label: string;
  Icon: LucideIcon;
  iconClassName: string;
} {
  if (signal.signalType === "must_go") {
    return { label: "必去", Icon: Flame, iconClassName: "text-coral" };
  }
  if (signal.signalType === "concern") {
    return { label: "有顾虑", Icon: TriangleAlert, iconClassName: "text-sun" };
  }
  if (signal.signalType === "negative" || signal.signalType === "hard_reject") {
    return { label: "不想去", Icon: XCircle, iconClassName: "text-ink/45" };
  }
  if (signal.signalType === "neutral") {
    return { label: "一般", Icon: CircleMinus, iconClassName: "text-ink/45" };
  }
  if (signal.signalType === "want_to_know" || signal.signalType === "questioned") {
    return { label: "想了解", Icon: CircleHelp, iconClassName: "text-skywash" };
  }

  return { label: "想去", Icon: Heart, iconClassName: "text-coral" };
}

function groupInterestLabel(state?: RoomNodeState) {
  const interest = state?.interestScore ?? 0;
  if (interest >= 7) return "团队兴趣：高";
  if (interest >= 3) return "团队兴趣：中";
  return "团队兴趣：待形成";
}

function engagementLabel(state?: RoomNodeState) {
  const engagement = state?.engagementScore ?? 0;
  const comments = state?.aggregateSignal?.comments ?? 0;
  const mentions = state?.mentionCount ?? 0;

  if (engagement >= 7) return comments > 0 ? `讨论很热 · ${comments} 条观点` : "讨论很热";
  if (engagement >= 3) return comments > 0 ? `持续讨论 · ${comments} 条观点` : "持续讨论";
  if (comments > 0) return `${comments} 条观点`;
  if (mentions > 0) return `${mentions} 次提到`;
  return "刚开始探索";
}

function interestPercentFromText(text: string) {
  if (/高/.test(text)) return 88;
  if (/中|有兴趣/.test(text)) return 58;
  return 18;
}

function mockAttitudeLabel(index: number) {
  const labels = ["想去", "想了解", "一般", "不想去"];
  return labels[index % labels.length];
}

function mockPlaceDiscussion(card: TravelCard, index: number, attitudeLabel: string) {
  const highlight = card.highlights[index % Math.max(card.highlights.length, 1)] ?? card.title;
  const comments = [
    `${card.title}可以先放进备选，${highlight}这点很打动我。`,
    "我想再看看交通和排队情况，如果顺路就很适合安排进去。",
    `感觉不错，但不想为了${card.title}单独绕太远，可以看整体路线再决定。`,
    "我会先保留意见，等大家把攻略链接和实际时间成本补齐。"
  ];

  return `${attitudeLabel}。${comments[index % comments.length]}`;
}

function materialSourceLabel(material: Material) {
  if (material.sourceProvider === "xiaohongshu") return "小红书";
  if (material.sourceProvider === "douyin") return "抖音";
  if (material.sourceType === "ai_recommendation" || material.sourceType === "ai_seed") return "AI Seed Content";
  if (material.sourceUrl) return material.sourceProvider ?? "外部链接";
  return material.sourceProvider ?? material.materialType;
}

function opinionSourceLabel(source: PlaceOpinion["sourceType"]) {
  if (source === "group_chat") return "群聊观点";
  if (source === "explore_comment") return "探索观点";
  if (source === "card_comment") return "卡片评论";
  return "语音观点";
}
