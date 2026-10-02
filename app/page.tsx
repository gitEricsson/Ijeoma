import { preconnect, preload } from "react-dom";
import { getJourney, getRaised } from "@/lib/data";
import { STYLE_URL } from "@/lib/map/style";
import MapApp from "@/components/map/MapApp";

export default async function Home() {
  // The map needs these first; start them while the page's JS is still loading
  // instead of after the map chunk arrives.
  preload(STYLE_URL, { as: "fetch", crossOrigin: "anonymous" });
  preload("/data/africa.geojson", { as: "fetch", crossOrigin: "anonymous" });
  preconnect("https://tiles.openfreemap.org", { crossOrigin: "anonymous" });
  const journey = await getJourney();
  const raised = await getRaised(journey.site);
  return <MapApp journey={journey} raised={raised} />;
}
