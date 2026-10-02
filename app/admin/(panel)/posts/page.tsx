import { getAdmin } from "@/lib/admin";
import PostManager from "@/components/admin/PostManager";

export default async function PostsPage() {
  const { db } = await getAdmin();
  const [{ data: posts }, { data: stops }, { data: countries }] = await Promise.all([
    db.from("posts").select("id,url,caption,posted_on,author,stop_id").is("deleted_at", null).order("posted_on", { ascending: false }),
    db.from("stops").select("id,city,arrived_on").is("deleted_at", null).order("arrived_on", { ascending: false }),
    db.from("countries").select("iso2,name").order("name"),
  ]);
  const feed = posts?.filter((p) => !p.stop_id) ?? [];
  const attached = (posts?.length ?? 0) - feed.length;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Posts</h1>
        <p className="mt-1 text-sm text-muted">
          Posts not tied to a stop show under &ldquo;Feed&rdquo; on the site. You can also add posts from a stop&apos;s own page.
          {attached > 0 && ` ${attached} post(s) are attached to stops.`}
        </p>
      </div>
      <PostManager posts={feed} stops={stops?.map((s) => ({ id: s.id, label: `${s.city} · ${s.arrived_on}` }))} countries={countries ?? []} />
    </div>
  );
}
