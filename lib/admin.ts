import { redirect } from "next/navigation";
import { createSessionClient } from "./supabase/server";

// Gate for admin pages: signed in AND on the allow-list.
export async function getAdmin() {
  const db = await createSessionClient();
  const { data } = await db.auth.getClaims();
  const email = (data?.claims?.email as string | undefined)?.toLowerCase();
  if (!email) redirect("/admin/login");
  const { data: admin } = await db.from("admins").select("email").eq("email", email).maybeSingle();
  return { db, email, isAdmin: !!admin };
}
