import LoginForm from "./LoginForm";

export const metadata = { title: "Admin · Spydey Tracker", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <div className="label">Spydey Tracker</div>
      <h1 className="mb-6 text-2xl font-semibold">Admin sign in</h1>
      {error && <p className="mb-4 border border-orange/50 px-3 py-2 text-sm">That link has expired or was already used. Request a new one.</p>}
      <LoginForm />
    </main>
  );
}
