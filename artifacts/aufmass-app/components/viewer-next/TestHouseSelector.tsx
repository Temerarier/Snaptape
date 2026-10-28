"use client";
import { useRouter } from "next/navigation";

export function TestHouseSelector({ value, label, options }: {
  value: string; label: string; options: readonly { id: string; label: string }[];
}) {
  const router = useRouter();
  return <label className="flex items-center gap-3 px-6 py-2 text-sm">
    {label}
    <select aria-label={label} value={value}
      className="rounded border border-neutral-300 bg-white px-3 py-1 text-neutral-900"
      onChange={event => router.push(`/viewer-next?house=${encodeURIComponent(event.target.value)}`)}>
      {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  </label>;
}
