/** FlowGuard Calm Operations Console: simple editorial page headers make operational context visible without decorative clutter. */
import type { ReactNode } from "react";
export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-bold tracking-[0.16em] text-blue-600">{eyebrow}</p><h1 className="mt-2 text-2xl font-extrabold tracking-[-0.045em] text-slate-900 sm:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p></div>{action}</div>;
}
