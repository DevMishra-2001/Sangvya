// The selfie + map pin saved with a check-in / check-out
import { MapPin } from "lucide-react";
import type { PunchGeo } from "@/lib/types";

export const mapsLink = (g: PunchGeo) => `https://www.google.com/maps?q=${g.lat},${g.lng}`;

export function PunchProof({ photo, geo, label }: { photo: string | null; geo: PunchGeo | null; label: string }) {
  if (!photo && !geo) return null;
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      {photo && (
        <a href={photo} target="_blank" rel="noreferrer" aria-label={`${label} photo`} className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageKit thumbnail */}
          <img src={`${photo}?tr=w-64,h-64,fo-face`} alt="" className="size-7 rounded-full border object-cover" />
        </a>
      )}
      {geo && (
        <a
          href={mapsLink(geo)}
          target="_blank"
          rel="noreferrer"
          aria-label={`${label} location on map`}
          title={geo.accuracy ? `Within ${geo.accuracy} m` : undefined}
          className="inline-flex size-7 items-center justify-center rounded-full border text-primary hover:bg-primary/10"
        >
          <MapPin className="size-3.5" />
        </a>
      )}
    </span>
  );
}
