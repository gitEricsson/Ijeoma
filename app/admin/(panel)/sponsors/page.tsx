import { getAdmin } from "@/lib/admin";
import { PANELS } from "@/lib/site";
import ActionForm, { Field } from "@/components/admin/ActionForm";
import { deleteSponsor, saveSponsor } from "../../actions";

type Sponsor = { id?: string; name?: string; panel?: string; tier?: string; link?: string | null; logo_url?: string | null; active?: boolean };

function SponsorFields({ s }: { s: Sponsor }) {
  return (
    <>
      <input type="hidden" name="id" value={s.id ?? ""} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Brand">
          <input name="name" required defaultValue={s.name ?? ""} className="field" />
        </Field>
        <Field label="Panel on IJEOMA">
          <select name="panel" defaultValue={s.panel ?? PANELS[0]} className="field">
            {PANELS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tier">
          <input name="tier" defaultValue={s.tier ?? "partner"} className="field" />
        </Field>
        <Field label="Link">
          <input name="link" type="url" defaultValue={s.link ?? ""} className="field" />
        </Field>
      </div>
      <Field label="Logo URL" hint="A hosted image link (PNG or SVG).">
        <input name="logo_url" type="url" defaultValue={s.logo_url ?? ""} className="field" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={s.active ?? true} className="accent-orange" /> Active
      </label>
    </>
  );
}

export default async function SponsorsPage() {
  const { db } = await getAdmin();
  const { data: sponsors } = await db.from("sponsors").select("*").is("deleted_at", null).order("created_at");
  const count = (panel: string) => sponsors?.filter((s) => s.active && s.panel === panel).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Sponsors</h1>
      <div className="flex flex-wrap gap-2">
        {PANELS.map((p) => (
          <span key={p} className={`label border px-2 py-1 capitalize ${count(p) ? "border-orange text-orange" : "border-line"}`}>
            {p}: {count(p)} {count(p) === 1 ? "sponsor" : "sponsors"}
          </span>
        ))}
      </div>
      {sponsors?.map((s) => (
        <div key={s.id} className="border border-line p-3">
          <ActionForm action={saveSponsor}>
            <SponsorFields s={s} />
          </ActionForm>
          <form action={deleteSponsor} className="mt-3">
            <input type="hidden" name="id" value={s.id} />
            <button className="btn">Remove sponsor</button>
          </form>
        </div>
      ))}
      <div className="border border-dashed border-line-strong p-3">
        <h2 className="mb-3 font-semibold">Add sponsor</h2>
        <ActionForm action={saveSponsor} submit="Add sponsor">
          <SponsorFields s={{}} />
        </ActionForm>
      </div>
    </div>
  );
}
