import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Leaf, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioInput } from "@/components/AudioInput";
import { LocationInput, type LocationData } from "@/components/LocationInput";
import { ResultsDisplay } from "@/components/ResultsDisplay";
import { ForestScene3D } from "@/components/ForestScene3D";
import { ForestRangeInfo } from "@/components/ForestRangeInfo";
import { BirdSpeciesGallery } from "@/components/BirdSpeciesGallery";
import { MapPreview } from "@/components/MapPreview";
import { ImageIntelligence } from "@/components/ImageIntelligence";
import { LayerControls, type LayerState } from "@/components/LayerControls";
import { EnvFactors } from "@/components/EnvFactors";
import { AIInsightPanel } from "@/components/AIInsightPanel";
import { WildlifeGallery } from "@/components/WildlifeGallery";
import { analyzeAudio, type AnalyzeResult, type ImageIntel } from "@/lib/birdApi";
import {
  fetchINaturalistData,
  generateSceneBlueprint,
  generateEcosystemInsight,
  type SceneBlueprint,
  type EcosystemInsight
} from "@/lib/scenePlanner";
import forestHero from "@/assets/forest-hero.jpg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "MockingBird · Forest Biodiversity Intelligence" },
      { name: "description", content: "AI-powered forest health analysis from bird audio. Detect species, estimate populations, and score ecosystem health." },
    ],
  }),
});

function Index() {
  const [audio, setAudio] = useState<Blob | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [location, setLocation] = useState<LocationData>({ lat: "", lon: "", climate: "", season: "", forestName: "", biome: "" });
  const [imageIntel, setImageIntel] = useState<ImageIntel | null>(null);
  const [layers, setLayers] = useState<LayerState>({ ndvi: true, fire: true, water: true, landUse: true });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<string>("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // iNaturalist & Gemini Scene Planner integration states
  const [blueprint, setBlueprint] = useState<SceneBlueprint | null>(null);
  const [ecosystemInsight, setEcosystemInsight] = useState<EcosystemInsight | null>(null);
  const [sceneLoading, setSceneLoading] = useState(false);

  const ready = audio && location.lat !== "" && location.lon !== "";

  // Trigger iNaturalist and Gemini Scene planning when coordinates change
  useEffect(() => {
    if (location.lat === "" || location.lon === "") {
      setBlueprint(null);
      setEcosystemInsight(null);
      return;
    }

    let active = true;
    async function loadGeospatialInsight() {
      setSceneLoading(true);
      try {
        const latNum = Number(location.lat);
        const lonNum = Number(location.lon);

        // Fetch observations and taxa from iNaturalist
        const inat = await fetchINaturalistData(latNum, lonNum);
        if (!active) return;

        // Generate Geospatial Ecosystem Insight via Gemini
        const insight = await generateEcosystemInsight(latNum, lonNum, {
          climate: location.climate || undefined,
          season: location.season || undefined
        });

        if (!active) return;
        setEcosystemInsight(insight);

        // Update form values automatically based on geospatial data
        let mappedBiome: any = "pine";
        const clim = insight.climate.label.toLowerCase();
        if (clim.includes("alpine") || clim.includes("mountain") || clim.includes("himalayan")) {
          mappedBiome = "alpine";
        } else if (clim.includes("tropical") || clim.includes("rainforest")) {
          mappedBiome = "rainforest";
        } else if (insight.scene_guidance.ground_moisture === "wet") {
          mappedBiome = "wetland";
        } else if (clim.includes("arid") || clim.includes("dry")) {
          mappedBiome = "dry";
        }

        setLocation(prev => ({
          ...prev,
          forestName: insight.location.area_name,
          climate: insight.climate.label,
          season: insight.season.label,
          biome: mappedBiome
        }));

        // Generate 3D Scene Blueprint
        const bp = await generateSceneBlueprint({
          location_text: insight.location.area_name,
          latitude: latNum,
          longitude: lonNum,
          radius_km: 10,
          season: insight.season.label,
          weather_summary: insight.climate.description,
          inaturalist_observations: inat.observations,
          inaturalist_taxa_summary: inat.taxaSummary,
          habitat_tags: inat.habitatTags,
          time_of_day: new Date().getHours() > 18 || new Date().getHours() < 6 ? "Night" : "Day",
        });

        if (!active) return;
        setBlueprint(bp);
      } catch (err) {
        console.error("Failed to load ecosystem insights:", err);
      } finally {
        if (active) setSceneLoading(false);
      }
    }

    loadGeospatialInsight();
    return () => {
      active = false;
    };
  }, [location.lat, location.lon]);

  useEffect(() => {
    if (!loading) return;
    const phases = [
      "Decoding audio waveform…",
      "Isolating bird vocalizations…",
      "Matching species signatures…",
      "Estimating population density…",
      "Computing biodiversity index…",
    ];
    let p = 0;
    setProgress(0);
    setPhase(phases[0]);
    const id = window.setInterval(() => {
      p = Math.min(95, p + Math.random() * 12 + 4);
      setProgress(p);
      setPhase(phases[Math.min(phases.length - 1, Math.floor((p / 100) * phases.length))]);
    }, 320);
    return () => window.clearInterval(id);
  }, [loading]);

  async function run() {
    if (!ready || !audio) return;
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeAudio({
        audio,
        lat: Number(location.lat),
        lon: Number(location.lon),
        climate: location.climate || undefined,
        season: location.season || undefined,
        forestName: location.forestName || undefined,
        biome: (location.biome || undefined) as any,
        imageIntel: imageIntel ?? undefined,
      });
      setProgress(100);
      setResult(res);
      setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e: any) {
      setError(e.message ?? "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${forestHero})` }}
        />
        <div className="absolute inset-0 bg-gradient-canopy" />
        <div className="relative max-w-6xl mx-auto px-6 pt-12 pb-20 text-primary-foreground">
          <div className="flex items-center gap-2 text-sm tracking-widest uppercase opacity-80">
            <Leaf className="h-4 w-4" />
            MockingBird
          </div>
          <h1 className="font-display text-5xl md:text-7xl mt-4 max-w-3xl text-balance">
            Hear the forest. <em className="not-italic text-accent">Read its health.</em>
          </h1>
          <p className="mt-5 max-w-xl text-base md:text-lg opacity-85">
            Record or upload forest audio. Our AI identifies bird species, estimates populations,
            and scores ecosystem health — early warnings, written by birdsong.
          </p>
        </div>
      </section>

      {/* Workflow */}
      <section className="max-w-6xl mx-auto px-6 -mt-12 relative z-10 pb-20">
        <div className="grid lg:grid-cols-2 gap-6">
          <Step number={1} title="Capture audio">
            <AudioInput audio={audio} onChange={setAudio} onAudioElement={setAudioEl} />
          </Step>
          <Step number={2} title="Anchor the location">
            <LocationInput value={location} onChange={setLocation} />
          </Step>
        </div>

        {/* Dynamic 3D preview card once location is set (and analysis hasn't run yet) */}
        {(blueprint || sceneLoading) && !result && (
          <div className="mt-6 space-y-6">
            <div className="rounded-3xl bg-card border border-border p-6 shadow-soft relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-2xl font-semibold flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                    Location Forest Preview
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    3D environmental reconstruction generated from nearby iNaturalist records & Gemini AI
                  </p>
                </div>
                {sceneLoading && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary animate-pulse bg-primary/10 rounded-full px-3 py-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generating 3D blueprint...
                  </div>
                )}
              </div>
              <ForestScene3D
                treeCount={80}
                birdCount={12}
                forestRangeKm2={25}
                healthScore={75}
                biome={location.biome || "pine"}
                audioElement={audioEl}
                audioIntensity={0.15}
                blueprint={blueprint}
              />
            </div>

            {ecosystemInsight && (
              <AIInsightPanel
                result={{} as any}
                intel={{} as any}
                layers={layers}
                ecosystemInsight={ecosystemInsight}
              />
            )}

            <WildlifeGallery lat={location.lat} lon={location.lon} />
          </div>
        )}

        <div className="mt-6">
          <Step number={3} title="Visual intelligence (optional)">
            <ImageIntelligence value={imageIntel} onChange={setImageIntel} />
          </Step>
        </div>

        <div className="mt-8 rounded-3xl bg-card border border-border p-6 shadow-soft flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="font-display text-2xl">Run analysis</h3>
            <p className="text-sm text-muted-foreground">
              {loading
                ? phase
                : ready
                ? "Audio and coordinates ready — send to the AI engine."
                : "Add an audio sample and location to enable analysis."}
            </p>
            {loading && (
              <div className="mt-3 h-1.5 w-full md:w-80 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-forest-canopy to-amber-bird transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            {error && <p className="text-sm text-destructive mt-1">{error}</p>}
          </div>
          <Button size="lg" onClick={run} disabled={!ready || loading} className="bg-gradient-forest hover:opacity-90 text-primary-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="ml-2">{loading ? "Analyzing ecosystem…" : "Identify birds"}</span>
          </Button>
        </div>

        {result && (
          <div id="results" className="mt-10 space-y-6">
            <ForestRangeInfo result={result} lat={Number(location.lat)} lon={Number(location.lon)} />
            <MapPreview
              lat={Number(location.lat)}
              lon={Number(location.lon)}
              forestName={result.forestName}
              ecoregion={result.ecoregion}
            />
            <LayerControls value={layers} onChange={setLayers} />
            {result.imageIntel && <EnvFactors intel={result.imageIntel} enabledLayers={layers} />}
            
            {result.imageIntel && (
              <AIInsightPanel
                result={result}
                intel={result.imageIntel}
                layers={layers}
                ecosystemInsight={ecosystemInsight}
              />
            )}

            <WildlifeGallery lat={location.lat} lon={location.lon} />
            
            <ForestScene3D
              treeCount={Math.round((result.estimatedTreeCount ?? 60000) / 800)}
              birdCount={Math.min(24, Math.max(6, Math.round(result.totalBirds / 2)))}
              forestRangeKm2={result.forestRangeKm2}
              healthScore={result.forestHealthIndex}
              biome={result.biome}
              audioElement={audioEl}
              audioIntensity={0.35}
              blueprint={blueprint}
            />
            
            <BirdSpeciesGallery species={result.speciesDetected} />
            <ResultsDisplay result={result} />
          </div>
        )}
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        MockingBird · Forest Biodiversity Intelligence
      </footer>
    </main>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-card border border-border p-6 shadow-soft">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-8 w-8 rounded-full bg-gradient-forest text-primary-foreground flex items-center justify-center font-display text-sm">
          {number}
        </div>
        <h2 className="font-display text-2xl">{title}</h2>
      </div>
      {children}
    </div>
  );
}
