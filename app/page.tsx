import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Compass, UsersRound } from "lucide-react";
import { CreateRoomForm } from "@/components/home/CreateRoomForm";

export default function HomePage() {
  return (
    <main className="min-h-screen px-5 py-6 md:px-10">
      <section className="mx-auto flex min-h-[calc(100vh-48px)] max-w-6xl flex-col justify-between">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-pine text-paper">
              <Compass size={20} aria-hidden="true" />
            </div>
            <span className="text-lg font-semibold tracking-normal">TripRoom</span>
          </div>
          <Link
            href="/demo"
            className="focus-ring inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper"
          >
            打开演示房间
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </header>

        <div className="grid gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.04] tracking-normal text-ink md:text-7xl">
              和朋友一起把旅行想出来
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/70">
              AI 先把具体目的地、景点和路线可能性摆到群里，成员围绕卡片表达、分享素材，最后沉淀成可比较的旅行结构方案。
            </p>
            <CreateRoomForm />
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/room/demo-japan-7d"
                className="focus-ring inline-flex items-center gap-2 rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white shadow-soft"
              >
                进入 TripRoom
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                href="/room/demo-japan-7d/join"
                className="focus-ring inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-5 py-3 text-sm font-semibold text-ink"
              >
                <UsersRound size={16} aria-hidden="true" />
                加入房间
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] bg-paper p-4 shadow-soft">
            <div className="overflow-hidden rounded-[22px]">
              <Image
                src="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80"
                alt="京都传统街道与樱花"
                width={1200}
                height={840}
                className="h-[420px] w-full object-cover"
              />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-4 text-sm">
              <div>
                <strong className="block text-ink">卡片</strong>
                <span className="text-ink/60">具体地点</span>
              </div>
              <div>
                <strong className="block text-ink">素材</strong>
                <span className="text-ink/60">来源保留</span>
              </div>
              <div>
                <strong className="block text-ink">方案</strong>
                <span className="text-ink/60">先比结构</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
