import { getAdmin } from "@/lib/admin";
import { fmtDate } from "@/lib/format";
import Flag from "@/components/Flag";
import ActionForm, { Field } from "@/components/admin/ActionForm";
import PhotoField from "@/components/admin/PhotoField";
import { updateCountry } from "../../actions";

const ORDER: Record<string, number> = { current: 0, visited: 1, upcoming: 2 };

export default async function CountriesPage() {
  const { db } = await getAdmin();
  const { data: countries } = await db.from("countries").select("*").order("name");
  const sorted = [...(countries ?? [])].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Countries</h1>
      <p className="text-sm text-muted">
        Status and entry dates come from the stops automatically. Add a cancer fact (from a source you trust) and the Instagram highlight link for each country.
      </p>
      {sorted.map((c) => (
        <details key={c.iso2} className="border border-line">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-3">
            <span>
              <Flag iso={c.iso2} /> {c.name}
            </span>
            <span className={`label ${c.status !== "upcoming" ? "text-orange" : ""}`}>
              {c.status}
              {c.first_entered_on ? ` · ${fmtDate(c.first_entered_on)}` : ""}
              {c.photo_url ? "" : " · no picture"}{c.cancer_fact ? "" : " · no fact"}
            </span>
          </summary>
          <div className="flex flex-col gap-5 border-t border-line p-3">
            <PhotoField kind="country" id={c.iso2} current={c.photo_url} />
            <ActionForm action={updateCountry}>
              <input type="hidden" name="iso2" value={c.iso2} />
              <Field label="Cancer fact">
                <textarea name="cancer_fact" rows={3} defaultValue={c.cancer_fact ?? ""} className="field" />
              </Field>
              <Field label="Instagram highlight link">
                <input name="ig_highlight_url" defaultValue={c.ig_highlight_url ?? ""} placeholder="https://www.instagram.com/stories/highlights/…" className="field" />
              </Field>
            </ActionForm>
          </div>
        </details>
      ))}
    </div>
  );
}
