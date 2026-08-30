import Link from "next/link";
import { ArrowRight, UsersRound } from "lucide-react";
import { getDemoTrip } from "@/lib/demo/room";

interface JoinRoomPageProps {
  params: Promise<{ tripId: string }>;
}

export default async function JoinRoomPage({ params }: JoinRoomPageProps) {
  const { tripId } = await params;
  const trip = await getDemoTrip(tripId);

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <section className="w-full max-w-md rounded-[28px] bg-paper p-7 shadow-soft">
        <div className="grid size-12 place-items-center rounded-full bg-pine text-paper">
          <UsersRound size={22} aria-hidden="true" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold text-ink">加入 {trip.name}</h1>
        <p className="mt-3 leading-7 text-ink/65">
          MVP 暂用匿名访客身份。点击后会以演示成员身份进入同一个 TripRoom。
        </p>
        <div className="mt-6 rounded-2xl bg-cloud p-4 text-sm text-ink/70">
          房间码：<span className="font-semibold text-ink">{trip.inviteCode}</span>
        </div>
        <Link
          href={`/room/${trip.id}`}
          className="focus-ring mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white"
        >
          进入房间
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
