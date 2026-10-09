import { CONTACT_EMAIL, DONATE_URL, INSTAGRAM_DM, YOUTUBE_URL } from "./site";

// The FAQ, in Michael's own words: cleaned up from the Q&A at IJEOMA's
// send-off (some questions weren't audible and are inferred from his answers).
// Edit the copy here; components/sheets/Faq.tsx only lays it out.

/** A paragraph, or a list of short points. */
export type FaqBlock = string | { list: string[]; ordered?: boolean };
/** A link out, or "garage" to open IJEOMA's sponsors. */
export type FaqLink = { label: string; href: string } | { label: string; action: "garage" };
export type FaqItem = { q: string; a: FaqBlock[]; links?: FaqLink[] };
export type FaqGroup = { title: string; items: FaqItem[] };

const EMAIL: FaqLink = { label: "Email Michael", href: `mailto:${CONTACT_EMAIL}` };
const DM: FaqLink = { label: "DM on Instagram", href: INSTAGRAM_DM };
const YOUTUBE: FaqLink = { label: "Watch on YouTube", href: YOUTUBE_URL };

export const FAQ: FaqGroup[] = [
  {
    title: "The journey",
    items: [
      {
        q: "What is this journey?",
        a: [
          "I'm driving IJEOMA, my orange Mercedes ML350, through all 54 African countries to raise $1,000,000 for cancer awareness. In every country, I'll tell a story about cancer before I move on to the next.",
        ],
      },
      {
        q: "How long will the whole trip take?",
        a: [
          "Honestly, I don't know, and I don't want to put a deadline on it. I'm travelling, and I want to enjoy it. I might spend two weeks in one country and two months in another. It depends on the vibes.",
          "Some visas will take a month or more to come through, and while I wait, I'll visit other countries. Most likely, it'll take over a year.",
        ],
      },
      {
        q: "What's the route?",
        a: ["West Africa first, then North or East Africa. South Africa will be the last."],
      },
      {
        q: "Why a Mercedes and not a Toyota?",
        a: [
          "No special reason. It's the car I have, and I don't like to make excuses. I wasn't going to say, \"I don't have a Toyota, so I can't do it.\"",
          "In my experience, Mercedes are really reliable. I've driven one before, and an Audi, and both were solid. This trip is a different level, though, so let's see if the engine holds up!",
        ],
      },
    ],
  },
  {
    title: "The $1M",
    items: [
      {
        q: "Where does the money go?",
        a: [
          "Into four areas:",
          { list: ["People living with cancer", "Cancer research facilities", "Cancer hospitals", "Cancer awareness campaigns"], ordered: true },
          "I'll share exactly how it's split. And I'm not waiting until the whole $1M is raised before using it: in every country, I'll visit a cancer hospital, meet a patient, or run an awareness drive, so the money is spent as I go.",
        ],
      },
      {
        q: "Is the money for you?",
        a: [
          "No. It's not my money, and I won't spend a dime of it on myself. There'll be full transparency on social media about how every bit of it is spent.",
        ],
      },
      {
        q: "How can I donate, and can I see what's been raised?",
        a: ["It's a public crowdfunding campaign on GoFundMe, so everyone can see how much has been raised. The total is on this tracker too."],
        links: [{ label: "Donate", href: DONATE_URL }],
      },
      {
        q: "If the $1M is for cancer, how is the trip itself paid for?",
        a: [
          "By selling ad space on IJEOMA. Brands sponsor spots on the car, and that funds the expedition: fuel, visas, repairs. It's expensive, and I can't fund it all on my own.",
        ],
      },
    ],
  },
  {
    title: "Sponsors & brands",
    items: [
      {
        q: "How can my brand sponsor the trip?",
        a: ["The best way to come in is as a sponsor, with your brand on IJEOMA. Reach out by email or DM, and I'll send you a layout showing exactly where your brand can go."],
        links: [EMAIL, DM],
      },
      {
        q: "How much does ad space cost?",
        a: [
          "It depends on where it goes, and prices will change as I travel, so I can't post a fixed price. The bonnet and the doors cost more than the boot and the glass. The windscreen is the biggest spot and the most expensive.",
          "Reach out, and we'll find what fits your budget.",
        ],
        links: [EMAIL, DM],
      },
      {
        q: "Can I see which spaces are taken?",
        a: ["Yes. Open IJEOMA on this tracker to see every sponsor and exactly where they are on the car."],
        links: [{ label: "See IJEOMA's sponsors", action: "garage" }],
      },
      {
        q: "What happens if a new sponsor joins while you're on the road?",
        a: ["I'm travelling with a printer, so I can print a new sponsor's sticker and put it on wherever I am."],
      },
    ],
  },
  {
    title: "Following along & safety",
    items: [
      {
        q: "How can I watch the journey?",
        a: [
          "I'll be documenting everything on Instagram, Facebook, TikTok, Snapchat, WhatsApp, Threads, X and YouTube, and going live on my YouTube channel.",
          "The link in my bio brings you here, to see where I've been and how much we've raised.",
        ],
        links: [YOUTUBE],
      },
      {
        q: "Is the tracker live?",
        a: [
          "Not exactly, and that's on purpose. A lot of people asked about my safety, so the tracker runs on a delay: by the time you see a location, I've probably left it. You'll still know which part of which country I'm in.",
        ],
      },
      {
        q: "What's your security plan?",
        a: ["God first! Beyond that, the tracker is delayed for safety, I park somewhere as safe as I can every night, and I post every single day so you know I'm okay."],
      },
      {
        q: "What if we don't hear from you?",
        a: [
          "I'll post every single day. If you don't see a post from me in three days, start worrying and come and look for me. The tracker shows where I was last.",
          "I hope it never comes to that!",
        ],
      },
      {
        q: "What if IJEOMA breaks down?",
        a: [
          "I've learned to fix the basics myself, and I'm carrying spare parts, so I can handle things like spark plugs and tyres. I'll service the car as often as I can so I don't get stranded on a long, lonely road. If it's something I can't fix, I'll find a mechanic.",
          "No matter how much I plan, things will happen that I can't predict. When I get to that bridge, I'll cross it.",
        ],
      },
      {
        q: "How will you have power and internet?",
        a: [
          "I have a solar battery setup from Solsync. I charge it during the day with the panel on the roof, or from inside the car, so I always have electricity. It powers my laptop and my Starlink, and as long as I have internet, I can find my way.",
        ],
      },
      {
        q: "What's the biggest challenge you expect?",
        a: [
          {
            list: [
              "A break-in. Everything I have is in the car, so if someone breaks in, I'm cooked. I'll park as safely as I can.",
              "Police and customs. IJEOMA's colour is loud. That's the point, but it attracts attention, and I've already had issues with the police in Nigeria.",
            ],
          },
          "Whatever happens, I'll document it. If they arrest me, you'll see the video.",
        ],
      },
    ],
  },
  {
    title: "Supporting Michael",
    items: [
      {
        q: "How can I support you, including your wellbeing on the road?",
        a: [
          "Repost my videos, as much as you can. It might feel small, but if a repost reaches the right brand, that's funding that keeps the trip going.",
          "Gifts are welcome too, and so are monetary gifts. I really appreciate it.",
        ],
      },
      {
        q: "I can't donate. How else can I help?",
        a: [
          "Share and repost, on Instagram, TikTok, anywhere. Tell your family and friends. $1M is a lot of money, and it's going to take a lot of people to raise it. Every share helps.",
        ],
      },
      {
        q: "How can I reach you?",
        a: ["Email me, or DM me on Instagram."],
        links: [EMAIL, DM],
      },
    ],
  },
];
