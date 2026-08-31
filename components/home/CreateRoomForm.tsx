"use client";

import { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export function CreateRoomForm() {
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push("/demo");
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
    </form>
  );
}
