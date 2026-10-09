export const DONATE_URL = "https://www.gofundme.com/f/help-michaelspyder-raise-1000000-for-cancer-awareness-in";
export const INSTAGRAM_URL = "https://www.instagram.com/michaelspyder/";
// His YouTube channel, where the live streams are.
export const YOUTUBE_URL = "https://www.youtube.com/@michaelspyder";
export const JOURNEY_TAG = "journey";
export const RAISED_TAG = "raised";
export const CONTACT_EMAIL = "michaelspyderinfo@gmail.com";

// The garage groups sponsors by the side of IJEOMA they're on.
export const SECTIONS = [
  { id: "front", label: "Front" },
  { id: "right", label: "Right side" },
  { id: "left", label: "Left side" },
  { id: "rear", label: "Rear" },
  { id: "roof", label: "Roof" },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];

// Sticker spots on the real car and the side each is on. A sponsor's `panel`
// is one of these (its sticker is drawn there), or a section id (listed on
// that side, no sticker yet). Placements are in lib/three/ijeoma.ts.
export const SPOTS: Record<string, SectionId> = {
  bonnet: "front",
  "right front door handle": "right",
  "right front wing": "right",
  "right rear door glass": "right",
  "right rear quarter glass": "right",
  "left front door": "left",
  "left rear window": "left",
  "left C-pillar": "left",
  "rear window": "rear",
  "rear left corner": "rear",
};

// Opens a DM to @michaelspyder (the app on phones, instagram.com on desktop).
export const INSTAGRAM_DM = "https://ig.me/m/michaelspyder";
export const BUILDER_URL = "https://www.instagram.com/ericssonraphael/";
