/* eslint-disable @next/next/no-img-element */

// Square SVG flag from /public/flags (flag-icons). Emoji flags don't render on Windows.
export default function Flag({ iso, size = 16, className = "" }: { iso: string; size?: number; className?: string }) {
  return <img src={`/flags/${iso.toLowerCase()}.svg`} alt="" width={size} height={size} className={`inline-block shrink-0 rounded-[2px] align-[-2px] ${className}`} />;
}
