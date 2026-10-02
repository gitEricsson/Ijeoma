import { notFound } from "next/navigation";
import { getAdmin } from "@/lib/admin";
import StopForm from "@/components/admin/StopForm";
import PostManager from "@/components/admin/PostManager";
import PhotoField from "@/components/admin/PhotoField";
import { deleteStop } from "../../../actions";

export default async function EditStop({ params, searchParams }: PageProps<"/admin/stops/[id]">) {
  const { id } = await params;
  const { saved } = await searchParams;
  const { db } = await getAdmin();
  const [{ data: stop }, { data: expeditions }, { data: countries }, { data: posts }] = await Promise.all([
    db.from("stops").select("*").eq("id", id).maybeSingle(),
    db.from("expeditions").select("id,name,end_date").is("deleted_at", null).order("start_date", { ascending: false }),
    db.from("countries").select("iso2,name").order("name"),
    db.from("posts").select("id,url,caption,posted_on,author").eq("stop_id", id).is("deleted_at", null).order("sort"),
  ]);
  if (!stop) notFound();

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="mb-1 text-xl font-semibold">{stop.city}</h1>
        {saved && <p className="mb-4 text-sm text-muted">Saved. The road and country status were updated.</p>}
        <StopForm expeditions={expeditions ?? []} countries={countries ?? []} defaults={stop} />
      </div>

      <section>
        <PhotoField kind="stop" id={stop.id} current={stop.photo_url} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Instagram posts for this stop</h2>
        <PostManager posts={posts ?? []} stopId={stop.id} />
      </section>

      <section className="border-t border-line pt-6">
        <form action={deleteStop}>
          <input type="hidden" name="id" value={stop.id} />
          <button className="btn text-orange">Delete stop</button>
          <p className="mt-2 text-xs text-muted">Recoverable from the Stops page. The road is redrawn without it.</p>
        </form>
      </section>
    </div>
  );
}
