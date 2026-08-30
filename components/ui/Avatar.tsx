import type { Member } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

export function Avatar({
  member,
  className
}: {
  member: Pick<Member, "displayName" | "avatarUrl">;
  className?: string;
}) {
  const label = member.avatarUrl || member.displayName.slice(0, 1);

  return (
    <span
      className={cn(
        "inline-grid size-8 place-items-center rounded-full bg-pine text-xs font-semibold text-paper ring-2 ring-paper",
        className
      )}
      title={member.displayName}
      aria-label={member.displayName}
    >
      {label}
    </span>
  );
}
