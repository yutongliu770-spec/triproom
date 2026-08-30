import Link from "next/link";
import { ArrowRight, RotateCcw, Sparkles } from "lucide-react";

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-paper px-5 py-6 md:px-10">
      <section className="mx-auto flex min-h-[calc(100vh-48px)] max-w-5xl flex-col justify-center">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-ink/60 shadow-soft">
            <Sparkles size={14} aria-hidden="true" />
            Hackathon Demo
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-normal text-ink md:text-6xl">
            选择评委体验入口
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink/65">
            两个入口共用同一套 TripRoom、Place、Preference、Map 和 Planning 逻辑，只是初始 Seed 状态不同。
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <DemoEntry
            href="/demo/quick"
            title="Quick Demo"
            eyebrow="30% 已探索"
            description="四位成员、部分聊天、Reaction、评论和外部素材已经沉淀，适合评委快速看到多人探索价值。"
            cta="进入 Quick Demo"
            primary
          />
          <DemoEntry
            href="/demo/fresh"
            title="Start from Scratch"
            eyebrow="冷启动"
            description="只保留“我们想去日本旅游”的模糊意向，用于展示 TripRoom 从零推荐、探索和沉淀偏好的能力。"
            cta="进入 Fresh Demo"
          />
        </div>

        <div className="mt-8 inline-flex max-w-xl items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-ink/60 shadow-soft">
          <RotateCcw size={16} className="shrink-0" aria-hidden="true" />
          <span>
            比赛前可运行 <code className="font-semibold text-ink">npm run seed:demo</code> 恢复固定演示状态。
          </span>
        </div>
      </section>
    </main>
  );
}

function DemoEntry({
  href,
  title,
  eyebrow,
  description,
  cta,
  primary = false
}: {
  href: string;
  title: string;
  eyebrow: string;
  description: string;
  cta: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`focus-ring rounded-[24px] p-6 shadow-soft ${
        primary ? "bg-pine text-paper" : "bg-white text-ink"
      }`}
    >
      <span className={`text-xs font-semibold uppercase tracking-[0.08em] ${primary ? "text-paper/60" : "text-ink/45"}`}>
        {eyebrow}
      </span>
      <h2 className="mt-3 text-2xl font-semibold tracking-normal">{title}</h2>
      <p className={`mt-3 min-h-24 text-sm leading-7 ${primary ? "text-paper/70" : "text-ink/60"}`}>
        {description}
      </p>
      <span
        className={`mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
          primary ? "bg-paper text-pine" : "bg-ink text-paper"
        }`}
      >
        {cta}
        <ArrowRight size={16} aria-hidden="true" />
      </span>
    </Link>
  );
}
