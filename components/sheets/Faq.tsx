import { FAQ, type FaqBlock, type FaqLink } from "@/lib/faq";
import { CONTACT_EMAIL, INSTAGRAM_DM } from "@/lib/site";

// The FAQ sheet's body: questions grouped by topic, one answer open at a
// time (native <details name>, so it works by keyboard and without JS).
export default function Faq({ onGarage }: { onGarage: () => void }) {
  return (
    <div>
      {FAQ.map((group, g) => (
        <section key={group.title} className={g ? "mt-7" : "mt-1"}>
          <h3 className="label mb-1 font-semibold uppercase tracking-wider">{group.title}</h3>
          {group.items.map((item) => (
            <details key={item.q} name="faq" className="border-b border-line">
              <summary className="faq-q flex cursor-pointer items-start justify-between gap-4 py-3.5 text-[15px] font-semibold leading-snug transition-colors hover:text-orange">
                {item.q}
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="faq-chev mt-1 shrink-0 text-muted">
                  <path d="M3 5.25l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </summary>
              <div className="pb-4 text-sm leading-relaxed">
                {item.a.map((block, i) => (
                  <Block key={i} block={block} first={i === 0} />
                ))}
                {item.links && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.links.map((link) => (
                      <LinkChip key={link.label} link={link} onGarage={onGarage} />
                    ))}
                  </div>
                )}
              </div>
            </details>
          ))}
        </section>
      ))}

      <div className="mt-8 bg-orange-soft p-3.5">
        <p className="text-sm font-semibold">Didn&apos;t find your question?</p>
        <p className="mt-1 text-sm text-muted">Ask Michael directly.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`mailto:${CONTACT_EMAIL}`} className="chip">
            Email Michael
          </a>
          <a href={INSTAGRAM_DM} target="_blank" rel="noopener noreferrer" className="chip">
            DM on Instagram
          </a>
        </div>
      </div>
    </div>
  );
}

function Block({ block, first }: { block: FaqBlock; first: boolean }) {
  if (typeof block === "string") return <p className={first ? "" : "mt-2"}>{block}</p>;
  const List = block.ordered ? "ol" : "ul";
  return (
    <List className={`${first ? "" : "mt-2"} flex flex-col gap-1.5 pl-5 ${block.ordered ? "list-decimal" : "list-disc"} marker:text-orange`}>
      {block.list.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </List>
  );
}

function LinkChip({ link, onGarage }: { link: FaqLink; onGarage: () => void }) {
  if ("action" in link) {
    return (
      <button onClick={onGarage} className="chip hover:text-orange">
        {link.label}
      </button>
    );
  }
  const external = !link.href.startsWith("mailto:");
  return (
    <a href={link.href} className="chip hover:text-orange" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {link.label}
    </a>
  );
}
