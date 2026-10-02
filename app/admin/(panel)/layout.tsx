import Link from "next/link";
import { getAdmin } from "@/lib/admin";
import { signOut } from "../actions";

export const metadata = { title: "Admin · Spydey Tracker", robots: { index: false } };

const NAV = [
  ["/admin", "Dashboard"],
  ["/admin/stops", "Stops"],
  ["/admin/posts", "Posts"],
  ["/admin/countries", "Countries"],
  ["/admin/sponsors", "Sponsors"],
  ["/admin/expeditions", "Expeditions"],
] as const;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { email, isAdmin } = await getAdmin();

  if (!isAdmin) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-5">
        <h1 className="text-xl font-semibold">No access</h1>
        <p className="text-sm text-muted">{email} isn&apos;t on the admin list. Ask an existing admin to add you.</p>
        <form action={signOut}>
          <button className="btn">Sign out</button>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="text-sm font-semibold uppercase tracking-[0.18em]">
            Spydey <span className="text-orange">Admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="label hover:text-text" target="_blank">
              View site ↗
            </Link>
            <form action={signOut}>
              <button className="label hover:text-text">Sign out</button>
            </form>
          </div>
        </div>
        <nav className="no-scrollbar mx-auto flex max-w-3xl gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="label shrink-0 px-2.5 py-1.5 hover:text-text">
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 pb-24">{children}</main>
    </div>
  );
}
