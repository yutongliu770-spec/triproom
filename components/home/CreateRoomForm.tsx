"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Copy } from "lucide-react";

export function CreateRoomForm() {
  const [created, setCreated] = useState(false);
  const inviteUrl = "/room/demo-japan-7d/join";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreated(true);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 max-w-xl rounded-[24px] bg-white p-4 shadow-soft">
      <div className="grid gap-3 md:grid-cols-[1fr_120px]">
        <input
          name="roomName"
          defaultValue="日本 7 天探索"
          className="focus-ring rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink"
          aria-label="房间名称"
        />
        <input
          name="days"
          defaultValue="7 天"
          className="focus-ring rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink"
          aria-label="大致天数"
        />
      </div>
      <input
        name="destination"
        defaultValue="日本"
        className="focus-ring mt-3 w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink"
        aria-label="大致目的地"
      />
      <button
        type="submit"
        className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white"
      >
        创建 TripRoom
        <ArrowRight size={16} aria-hidden="true" />
      </button>

      {created && (
        <div className="mt-4 rounded-2xl bg-cloud p-4 text-sm leading-6 text-ink/70">
          <div className="font-semibold text-ink">房间已创建：日本 7 天探索</div>
          <div className="mt-1">邀请链接：{inviteUrl}</div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-ink"
              onClick={() => navigator.clipboard?.writeText(`${location.origin}${inviteUrl}`)}
            >
              <Copy size={14} aria-hidden="true" />
              复制邀请链接
            </button>
            <Link
              href="/room/demo-japan-7d"
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-pine px-3 py-2 text-xs font-semibold text-paper"
            >
              进入房间
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </form>
  );
}
