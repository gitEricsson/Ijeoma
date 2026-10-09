import { getAdmin } from "@/lib/admin";
import IgImport from "@/components/admin/IgImport";

export default async function ImportPostsPage() {
  const { db } = await getAdmin();
  const [{ data: stops }, { data: posts }] = await Promise.all([
    db.from("stops").select("id,city,country_iso2,arrived_on").is("deleted_at", null).order("arrived_on"),
    db.from("posts").select("shortcode,deleted_at"),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Import from Instagram</h1>
        <p className="mt-1 text-sm text-muted">New posts are ticked. Each is dated from Instagram and filed under the stop Michael was at that day; you can move one later from Posts.</p>
      </div>
      <IgImport
        stops={stops ?? []}
        known={(posts ?? []).filter((p) => !p.deleted_at).map((p) => p.shortcode)}
        removed={(posts ?? []).filter((p) => p.deleted_at).map((p) => p.shortcode)}
      />
    </div>
  );
}
