import { getAdmin } from "@/lib/admin";
import ActionForm, { Field } from "@/components/admin/ActionForm";
import { deleteExpedition, saveExpedition } from "../../actions";

export default async function ExpeditionsPage() {
  const { db } = await getAdmin();
  const { data: expeditions } = await db.from("expeditions").select("*").is("deleted_at", null).order("start_date", { ascending: false });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Expeditions</h1>
      <p className="text-sm text-muted">
        One expedition per trip out of Nigeria and back. Leave the end date empty while it&apos;s running; fill it in to close it.
      </p>

      <div className="border border-dashed border-line-strong p-3">
        <h2 className="mb-3 font-semibold">Start a new expedition</h2>
        <ActionForm action={saveExpedition} submit="Start expedition">
          <Field label="Name">
            <input name="name" required placeholder="e.g. Central Africa run" className="field" />
          </Field>
          <Field label="Start date">
            <input name="start_date" type="date" required defaultValue={today} className="field" />
          </Field>
          <Field label="Summary (optional)">
            <textarea name="summary" rows={2} className="field" />
          </Field>
        </ActionForm>
      </div>

      {expeditions?.map((e) => (
        <div key={e.id} className="border border-line p-3">
          <ActionForm action={saveExpedition}>
            <input type="hidden" name="id" value={e.id} />
            <Field label="Name">
              <input name="name" required defaultValue={e.name} className="field" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">
                <input name="start_date" type="date" required defaultValue={e.start_date} className="field" />
              </Field>
              <Field label="End (empty = running)">
                <input name="end_date" type="date" defaultValue={e.end_date ?? ""} className="field" />
              </Field>
            </div>
            <Field label="Summary">
              <textarea name="summary" rows={2} defaultValue={e.summary ?? ""} className="field" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_placeholder" defaultChecked={e.is_placeholder} className="accent-orange" />
              Placeholder (dates left out of &ldquo;days on the road&rdquo;)
            </label>
          </ActionForm>
          <form action={deleteExpedition} className="mt-3">
            <input type="hidden" name="id" value={e.id} />
            <button className="btn text-orange">Delete expedition and its stops</button>
          </form>
        </div>
      ))}
    </div>
  );
}
