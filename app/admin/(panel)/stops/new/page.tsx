import Link from "next/link";
import { getAdmin } from "@/lib/admin";
import StopForm from "@/components/admin/StopForm";

export default async function NewStop() {
  const { db } = await getAdmin();
  const [{ data: expeditions }, { data: countries }] = await Promise.all([
    db.from("expeditions").select("id,name,end_date").is("deleted_at", null).order("start_date", { ascending: false }),
    db.from("countries").select("iso2,name").order("name"),
  ]);
  if (!expeditions?.length) {
    return (
      <p className="text-sm">
        Start an expedition first: <Link href="/admin/expeditions" className="text-orange underline">Expeditions</Link>.
      </p>
    );
  }
  const open = expeditions.find((e) => !e.end_date) ?? expeditions[0];
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Add stop</h1>
      <StopForm expeditions={expeditions} countries={countries ?? []} defaults={{ expedition_id: open.id }} />
    </>
  );
}
