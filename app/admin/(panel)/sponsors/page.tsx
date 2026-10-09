import { getAdmin } from "@/lib/admin";
import { SECTIONS, SPOTS } from "@/lib/site";
import { sectionOf } from "@/lib/sponsors";
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
        <Field label="Where on IJEOMA">
          <select name="panel" defaultValue={s.panel ?? Object.keys(SPOTS)[0]} className="field">
            {SECTIONS.map(({ id, label }) => (
              <optgroup key={id} label={label}>
                {Object.entries(SPOTS)
                  .filter(([, side]) => side === id)
                  .map(([spot]) => (
                    <option key={spot} value={spot}>
                      {spot}
                    </option>
                  ))}
                <option value={id}>{label} (no sticker yet)</option>
              </optgroup>
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
      <Field label="Logo URL" hint="A hosted image link, or a file in public/ such as /sponsors/c9x.webp. White on transparent reads best on the car.">
        <input name="logo_url" defaultValue={s.logo_url ?? ""} className="field" />
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
  const count = (side: string) => sponsors?.filter((s) => s.active && sectionOf(s.panel) === side).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Sponsors</h1>
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map(({ id, label }) => (
          <span key={id} className={`label border px-2 py-1 ${count(id) ? "border-orange text-orange" : "border-line"}`}>
            {label}: {count(id)} {count(id) === 1 ? "sponsor" : "sponsors"}
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
