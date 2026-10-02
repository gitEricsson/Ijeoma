import { addPost, deletePost } from "@/app/admin/actions";
import { fmtDate } from "@/lib/format";
import ActionForm, { Field } from "./ActionForm";

type Post = { id: string; url: string; caption: string | null; posted_on: string | null; author: string };

type Props = {
  posts: Post[];
  stopId?: string;
  stops?: { id: string; label: string }[];
  countries?: { iso2: string; name: string }[];
};

// Lists posts with a delete button, plus a form to paste in a new link.
export default function PostManager({ posts, stopId, stops, countries }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {posts.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="min-w-0 text-sm hover:text-orange">
              <div className="truncate">{p.caption ?? p.url.replace("https://www.instagram.com/", "")}</div>
              <div className="label">
                @{p.author} · {fmtDate(p.posted_on)}
              </div>
            </a>
            <form action={deletePost}>
              <input type="hidden" name="id" value={p.id} />
              <button className="btn shrink-0">Remove</button>
            </form>
          </li>
        ))}
        {posts.length === 0 && <li className="label py-3">No posts yet.</li>}
      </ul>

      <ActionForm action={addPost} submit="Add post">
        {stopId && <input type="hidden" name="stop_id" value={stopId} />}
        <Field label="Instagram post or reel link">
          <input name="url" required placeholder="https://www.instagram.com/reel/…" className="field" inputMode="url" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Posted on">
            <input name="posted_on" type="date" className="field" />
          </Field>
          <Field label="Author" hint="Leave blank for @michaelspyder">
            <input name="author" placeholder="michaelspyder" className="field" />
          </Field>
        </div>
        <Field label="Caption (optional)">
          <input name="caption" maxLength={200} className="field" />
        </Field>
        {stops && (
          <Field label="Attach to stop" hint="Leave empty to show it in the Feed.">
            <select name="stop_id" className="field" defaultValue="">
              <option value="">Feed only</option>
              {stops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {countries && (
          <Field label="Country (optional)">
            <select name="country_iso2" className="field" defaultValue="">
              <option value="">None</option>
              {countries.map((c) => (
                <option key={c.iso2} value={c.iso2}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </ActionForm>
    </div>
  );
}
