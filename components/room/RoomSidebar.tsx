"use client";

import { useState } from "react";
import { Copy, MapPin, UserPlus, UsersRound } from "lucide-react";
import type { DestinationNode, Member, RoomNodeState, Trip } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";

export function RoomSidebar({
  trip,
  nodes,
  roomNodeStates,
  currentMemberId,
  onMemberChange,
  onAddDemoMember,
  canAddDemoMember
}: {
  trip: Trip;
  nodes: DestinationNode[];
  roomNodeStates: RoomNodeState[];
  currentMemberId: string;
  onMemberChange: (member: Member) => void;
  onAddDemoMember: () => void;
  canAddDemoMember: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const focusNode = nodes.find((node) => node.id === trip.currentFocusNodeId);
  const exploredCount = roomNodeStates.filter((state) =>
    ["shown", "opened", "selected"].includes(state.state)
  ).length;
  const isGroupRoom = trip.members.length > 1;

  return (
    <aside className="bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-full bg-pine text-paper">
          <MapPin size={20} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-ink">{trip.name}</h1>
          <p className="text-sm text-ink/55">
            {isGroupRoom ? "Group Room" : "Solo Room"} · 房间码 {trip.inviteCode}
          </p>
        </div>
      </div>

      <button
        type="button"
        className="focus-ring mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-cloud px-4 py-3 text-sm font-semibold text-ink"
        onClick={() => {
          const invitePath = `/room/${trip.id}/join`;
          const inviteUrl =
            typeof window === "undefined" ? invitePath : `${window.location.origin}${invitePath}`;
          void navigator.clipboard?.writeText(inviteUrl);
          setCopied(true);
        }}
      >
        <Copy size={16} aria-hidden="true" />
        {copied ? "邀请链接已复制" : "复制邀请链接"}
      </button>

      <button
        type="button"
        disabled={!canAddDemoMember}
        className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-coral px-4 py-3 text-sm font-semibold text-white"
        onClick={onAddDemoMember}
      >
        <UserPlus size={16} aria-hidden="true" />
        {canAddDemoMember ? "+ 邀请旅伴" : "Demo 成员已加入"}
      </button>

      <section className="mt-7">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink/70">
          <UsersRound size={16} aria-hidden="true" />
          成员
        </div>
        <div className="flex flex-wrap gap-2">
          {trip.members.map((member) => (
            <button
              key={member.id}
              type="button"
              className={`focus-ring rounded-full ${
                currentMemberId === member.id ? "ring-2 ring-coral" : ""
              }`}
              title={`切换为${member.displayName}`}
              aria-label={`切换为${member.displayName}`}
              onClick={() => onMemberChange(member)}
            >
              <Avatar member={member} />
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-ink/50">
          当前身份：{trip.members.find((member) => member.id === currentMemberId)?.displayName}。
          {isGroupRoom ? "可切换成员模拟多人加入。" : "邀请旅伴后会无损变成 Group Room。"}
        </p>
      </section>

      <section className="mt-7 rounded-2xl bg-cloud p-4">
        <h2 className="text-sm font-semibold text-ink">当前已知信息</h2>
        <dl className="mt-3 space-y-2 text-sm text-ink/65">
          <div className="flex justify-between gap-4">
            <dt>目的地</dt>
            <dd className="font-medium text-ink">{trip.roughDestination ?? "待确认"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>天数</dt>
            <dd className="font-medium text-ink">
              {trip.tripDurationDays ? `${trip.tripDurationDays} 天` : "待确认"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>焦点</dt>
            <dd className="font-medium text-ink">{focusNode?.canonicalName ?? "未设置"}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-4 rounded-2xl border border-ink/10 p-4">
        <h2 className="text-sm font-semibold text-ink">探索状态</h2>
        <p className="mt-2 text-sm leading-6 text-ink/65">
          已点亮 {exploredCount} 个地点。可以直接展开东京、跳到大阪，也可以随时回到日本层。
        </p>
      </section>
    </aside>
  );
}
