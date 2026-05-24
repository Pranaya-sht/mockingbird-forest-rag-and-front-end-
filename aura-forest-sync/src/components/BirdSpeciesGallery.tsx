import { useEffect, useState } from "react";
import { Bird, ExternalLink, Leaf, ShieldCheck } from "lucide-react";
import type { DetectedSpecies } from "@/lib/birdApi";
import { cn } from "@/lib/utils";

interface WikiInfo {
  thumb?: string;
  extract?: string;
  url?: string;
}

async function fetchWiki(title: string): Promise<WikiInfo> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`
    );
    if (!res.ok) return {};
    const data = await res.json();
    return {
      thumb: data.thumbnail?.source,
      extract: data.extract,
      url: data.content_urls?.desktop?.page,
    };
  } catch {
    return {};
  }
}

export function BirdSpeciesGallery({ species }: { species: DetectedSpecies[] }) {
  return (
    <div className="rounded-3xl bg-card border border-border p-6 shadow-soft">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display text-2xl">Identified species</h3>
          <p className="text-sm text-muted-foreground">Reference imagery & info from Wikipedia</p>
        </div>
        <span className="text-xs px-3 py-1 rounded-full bg-forest-canopy/15 text-forest-deep border border-forest-canopy/30">
          {species.length} species
        </span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {species.map((s) => (
          <SpeciesCard key={s.name} species={s} />
        ))}
      </div>
    </div>
  );
}

const statusMap: Record<NonNullable<DetectedSpecies["conservationStatus"]>, { label: string; tone: string }> = {
  LC: { label: "Least Concern", tone: "bg-health-good/15 text-health-good border-health-good/30" },
  NT: { label: "Near Threatened", tone: "bg-health-mid/15 text-amber-bird border-health-mid/30" },
  VU: { label: "Vulnerable", tone: "bg-health-mid/20 text-amber-bird border-health-mid/40" },
  EN: { label: "Endangered", tone: "bg-health-bad/15 text-health-bad border-health-bad/30" },
  CR: { label: "Critically Endangered", tone: "bg-health-bad/20 text-health-bad border-health-bad/40" },
  DD: { label: "Data Deficient", tone: "bg-muted text-muted-foreground border-border" },
};

function SpeciesCard({ species }: { species: DetectedSpecies }) {
  const [info, setInfo] = useState<WikiInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Try scientific name first (more unique), fall back to common name
    (async () => {
      let res = await fetchWiki(species.scientificName);
      if (!res.thumb) res = { ...(await fetchWiki(species.name)), ...res };
      if (!cancelled) {
        setInfo(res);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [species.name, species.scientificName]);

  return (
    <article className="group rounded-2xl overflow-hidden border border-border bg-background hover:shadow-soft hover:-translate-y-0.5 transition-all duration-300">
      <div className="aspect-[4/3] bg-gradient-to-br from-forest-canopy/20 to-amber-bird/20 relative overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 animate-pulse bg-muted" />
        ) : info?.thumb ? (
          <img
            src={info.thumb}
            alt={species.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Bird className="h-12 w-12 text-forest-deep/40" />
          </div>
        )}
        {species.indicator && (
          <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground uppercase tracking-wider font-medium">
            Indicator
          </span>
        )}
        <div className="absolute bottom-2 right-2 bg-card/90 backdrop-blur rounded-lg px-2 py-1 text-xs">
          <span className="font-display text-base tabular-nums">{species.count}</span>
          <span className="text-muted-foreground ml-1">birds</span>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-medium truncate">{species.name}</h4>
            <p className="text-xs italic text-muted-foreground truncate">{species.scientificName}</p>
          </div>
          {info?.url && (
            <a
              href={info.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-forest-deep shrink-0"
              aria-label="Open Wikipedia article"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {species.ecologicalRole && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-forest-canopy/15 text-forest-deep border border-forest-canopy/30">
              <Leaf className="h-3 w-3" /> {species.ecologicalRole}
            </span>
          )}
          {species.conservationStatus && (
            <span className={cn("inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border", statusMap[species.conservationStatus].tone)}>
              <ShieldCheck className="h-3 w-3" /> {statusMap[species.conservationStatus].label}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
          {species.description ?? info?.extract ?? "Reference observation logged from forest audio."}
        </p>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Confidence</span>
          <span className="font-medium">{Math.round(species.confidence * 100)}%</span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-forest-canopy to-amber-bird"
            style={{ width: `${species.confidence * 100}%` }}
          />
        </div>
      </div>
    </article>
  );
}
