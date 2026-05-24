import { type Biome } from "./birdApi";

export interface UserInputs {
  location_text: string;
  latitude: number | null;
  longitude: number | null;
  radius_km: number;
  season: string | null;
  weather_summary: string | null;
  inaturalist_observations: any[];
  inaturalist_taxa_summary: Array<{ taxon: string; count: number }>;
  habitat_tags: string[];
  time_of_day: string | null;
}

export interface TreeAsset {
  type: string;
  count_hint: string;
  height_m: [number, number];
  dominance: "low" | "medium" | "high";
}

export interface SceneBlueprint {
  location_profile: {
    region_name: string;
    biome: string;
    habitat_type: string;
    canopy_density: "low" | "medium" | "high";
    moisture_level: "dry" | "moderate" | "wet";
    biodiversity_mood: "sparse" | "balanced" | "lush";
  };
  scene_assets: {
    trees: TreeAsset[];
    understory: string[];
    ground_cover: string[];
    water_features: string[];
    rocks_and_decoration: string[];
    wildlife_visual_cues: string[];
  };
  lighting: {
    time_style: string;
    fog: "none" | "light" | "medium" | "heavy";
    sun_intensity: "low" | "medium" | "high";
    atmosphere: string;
  };
  render_guidance: {
    camera_angle: string;
    composition: string;
    color_palette: string[];
    detail_priority: string[];
  };
  confidence: {
    overall: number;
    biome: number;
    vegetation: number;
    lighting: number;
  };
  fallbacks: {
    if_data_is_sparse: string[];
    if_location_is_urban_edge: string[];
  };
}

export interface EcosystemInsight {
  location: {
    area_name: string;
    country: string;
    region: string;
    latitude: number;
    longitude: number;
  };
  climate: {
    label: string;
    description: string;
    confidence: number;
  };
  season: {
    label: string;
    description: string;
    confidence: number;
  };
  vegetation_density: {
    label: "Sparse" | "Moderate" | "Good" | "Dense" | string;
    ndvi_simulation: number;
    status: string;
    description: string;
    confidence: number;
  };
  fire_risk: {
    label: "Low" | "Moderate" | "High" | "Critical" | string;
    thermal_anomaly_index: number;
    status: string;
    description: string;
    confidence: number;
  };
  water_resources: {
    label: "Scarce" | "Limited" | "Good" | "Rich" | string;
    water_presence_index: number;
    status: string;
    description: string;
    confidence: number;
  };
  land_use_change: {
    label: "Stable" | "Mild change" | "Active change" | "Rapid change" | string;
    index: number;
    status: string;
    description: string;
    confidence: number;
  };
  ai_insight: {
    headline: string;
    summary: string;
    recommended_action: string;
  };
  scene_guidance: {
    canopy_density: "low" | "medium" | "high" | string;
    ground_moisture: "dry" | "moderate" | "wet" | string;
    fog_level: "none" | "light" | "medium" | "heavy" | string;
    dominant_colors: string[];
    visual_mood: string;
  };
  confidence_overall: number;
}

/**
 * Fetch nearby observations and summarize taxa and habitat tags from iNaturalist.
 */
export async function fetchINaturalistData(
  lat: number,
  lon: number,
  radiusKm: number = 10
): Promise<{
  observations: any[];
  taxaSummary: Array<{ taxon: string; count: number }>;
  habitatTags: string[];
}> {
  try {
    const url = `https://api.inaturalist.org/v1/observations?lat=${lat}&lng=${lon}&radius=${radiusKm}&order_by=observations.id&order=desc&per_page=30&quality_grade=research`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`iNaturalist API returned status: ${res.status}`);
    }
    const data = await res.json();
    const results = data.results || [];

    const observations = results.map((obs: any) => ({
      species_guess: obs.species_guess || "Unknown species",
      common_name: obs.taxon?.preferred_common_name || obs.species_guess || "Unknown common name",
      scientific_name: obs.taxon?.name || "Unknown scientific name",
      iconic_taxon: obs.taxon?.iconic_taxon_name || "Unknown",
      rank: obs.taxon?.rank || "unknown",
      observed_on: obs.observed_on || "unknown",
      place_guess: obs.place_guess || "unknown",
    }));

    // Calculate taxa summary
    const counts: Record<string, number> = {};
    const tagsSet = new Set<string>();

    results.forEach((obs: any) => {
      const taxonName = obs.taxon?.iconic_taxon_name || "Other";
      counts[taxonName] = (counts[taxonName] || 0) + 1;

      // Extract simple habitat hints/tags from observations
      if (obs.place_guess) {
        const parts = obs.place_guess.split(",").map((s: string) => s.trim().toLowerCase());
        parts.forEach((p: string) => {
          if (p.length > 3 && !p.includes("district") && !p.includes("zone") && !p.includes("nepal")) {
            tagsSet.add(p);
          }
        });
      }
      if (obs.taxon?.preferred_common_name) {
        const nameLower = obs.taxon.preferred_common_name.toLowerCase();
        if (nameLower.includes("pine") || nameLower.includes("sal ") || nameLower.includes("oak") || nameLower.includes("rhododendron")) {
          tagsSet.add(nameLower.split(" ").slice(-1)[0]);
        }
      }
    });

    const taxaSummary = Object.keys(counts).map((taxon) => ({
      taxon,
      count: counts[taxon],
    }));

    return {
      observations: observations.slice(0, 15),
      taxaSummary,
      habitatTags: Array.from(tagsSet).slice(0, 10),
    };
  } catch (error) {
    console.error("Error fetching iNaturalist data:", error);
    return {
      observations: [],
      taxaSummary: [],
      habitatTags: [],
    };
  }
}

/**
 * Perform reverse geocoding via OpenStreetMap Nominatim.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<{
  area_name: string;
  country: string;
  region: string;
  admin_area: string;
}> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "MockingBird-Forest-Intelligence-App/1.0"
      }
    });
    if (!res.ok) throw new Error("Reverse geocode failed");
    const data = await res.json();
    const address = data.address || {};

    const area_name =
      address.park ||
      address.nature_reserve ||
      address.natural ||
      address.forest ||
      address.attraction ||
      address.suburb ||
      address.village ||
      address.county ||
      "Selected Forest Area";

    const country = address.country || "Nepal";
    const region = address.state || address.province || address.state_district || "Bagmati Province";
    const admin_area = address.county || address.district || address.city || "Chitwan";

    return { area_name, country, region, admin_area };
  } catch (error) {
    console.error("Geocoding failed, using fallbacks:", error);
    return {
      area_name: "Forest Zone",
      country: "Nepal",
      region: "Himalayan Forest Range",
      admin_area: "Chitwan"
    };
  }
}

/**
 * Fetch elevation from Open-Meteo elevation API.
 */
export async function fetchElevation(lat: number, lon: number): Promise<number> {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    return data.elevation?.[0] ?? 1400;
  } catch {
    return 1400; // Nepal hill average fallback
  }
}

/**
 * Generate 3D forest scene plan using Gemini Structured Output.
 */
export async function generateSceneBlueprint(inputs: UserInputs): Promise<SceneBlueprint> {
  const apiKey = import.meta.env.VITE_AI_STUDIO_KEY || "";
  if (!apiKey) {
    console.warn("VITE_AI_STUDIO_KEY is missing. Using local scene generator fallback.");
    return generateFallbackBlueprint(inputs);
  }

  const promptText = `
You are a forest-environment interpretation engine for a 3D scene generator.
Your job is to convert a real-world location and biodiversity observations into a
compact, visually rich forest scene plan for a 3D renderer.

You must:
- Use only the provided location and biodiversity data.
- Infer scene features conservatively.
- Return valid JSON only conforming strictly to the requested schema.
- Prefer ecologically grounded details over dramatic fantasy details.
- Keep the scene realistic, immersive, and visually balanced.

USER INPUTS:
- location_text: "${inputs.location_text}"
- latitude: ${inputs.latitude}
- longitude: ${inputs.longitude}
- radius_km: ${inputs.radius_km}
- season: "${inputs.season || 'unknown'}"
- weather_summary: "${inputs.weather_summary || 'unknown'}"
- inaturalist_observations: ${JSON.stringify(inputs.inaturalist_observations)}
- inaturalist_taxa_summary: ${JSON.stringify(inputs.inaturalist_taxa_summary)}
- habitat_tags: ${JSON.stringify(inputs.habitat_tags)}
- time_of_day: "${inputs.time_of_day || 'unknown'}"

TASK:
1) Read the location and biodiversity data.
2) Infer forest type, ground cover, canopy density, moisture, and biodiversity mood.
3) Decide what 3D assets should appear in the scene.
4) Produce a scene blueprint that a renderer can use directly.
5) Include confidence scores and fallback values.

RULES:
- If biodiversity data is sparse, use conservative defaults.
- If the location appears urban, reduce canopy density and vegetation dominance.
- Never invent rare species unless strongly supported by the observations.
- Prefer general species groups over exact species when uncertain.
- Keep outputs concise and renderer-friendly.
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                location_profile: {
                  type: "OBJECT",
                  properties: {
                    region_name: { type: "STRING" },
                    biome: { type: "STRING" },
                    habitat_type: { type: "STRING" },
                    canopy_density: { type: "STRING", enum: ["low", "medium", "high"] },
                    moisture_level: { type: "STRING", enum: ["dry", "moderate", "wet"] },
                    biodiversity_mood: { type: "STRING", enum: ["sparse", "balanced", "lush"] },
                  },
                  required: ["region_name", "biome", "habitat_type", "canopy_density", "moisture_level", "biodiversity_mood"],
                },
                scene_assets: {
                  type: "OBJECT",
                  properties: {
                    trees: {
                      type: "ARRAY",
                      items: {
                        type: "OBJECT",
                        properties: {
                          type: { type: "STRING" },
                          count_hint: { type: "STRING" },
                          height_m: {
                            type: "ARRAY",
                            items: { type: "NUMBER" },
                          },
                          dominance: { type: "STRING", enum: ["low", "medium", "high"] },
                        },
                        required: ["type", "count_hint", "height_m", "dominance"],
                      },
                    },
                    understory: { type: "ARRAY", items: { type: "STRING" } },
                    ground_cover: { type: "ARRAY", items: { type: "STRING" } },
                    water_features: { type: "ARRAY", items: { type: "STRING" } },
                    rocks_and_decoration: { type: "ARRAY", items: { type: "STRING" } },
                    wildlife_visual_cues: { type: "ARRAY", items: { type: "STRING" } },
                  },
                  required: ["trees", "understory", "ground_cover", "water_features", "rocks_and_decoration", "wildlife_visual_cues"],
                },
                lighting: {
                  type: "OBJECT",
                  properties: {
                    time_style: { type: "STRING" },
                    fog: { type: "STRING", enum: ["none", "light", "medium", "heavy"] },
                    sun_intensity: { type: "STRING", enum: ["low", "medium", "high"] },
                    atmosphere: { type: "STRING" },
                  },
                  required: ["time_style", "fog", "sun_intensity", "atmosphere"],
                },
                render_guidance: {
                  type: "OBJECT",
                  properties: {
                    camera_angle: { type: "STRING" },
                    composition: { type: "STRING" },
                    color_palette: { type: "ARRAY", items: { type: "STRING" } },
                    detail_priority: { type: "ARRAY", items: { type: "STRING" } },
                  },
                  required: ["camera_angle", "composition", "color_palette", "detail_priority"],
                },
                confidence: {
                  type: "OBJECT",
                  properties: {
                    overall: { type: "NUMBER" },
                    biome: { type: "NUMBER" },
                    vegetation: { type: "NUMBER" },
                    lighting: { type: "NUMBER" },
                  },
                  required: ["overall", "biome", "vegetation", "lighting"],
                },
                fallbacks: {
                  type: "OBJECT",
                  properties: {
                    if_data_is_sparse: { type: "ARRAY", items: { type: "STRING" } },
                    if_location_is_urban_edge: { type: "ARRAY", items: { type: "STRING" } },
                  },
                  required: ["if_data_is_sparse", "if_location_is_urban_edge"],
                },
              },
              required: ["location_profile", "scene_assets", "lighting", "render_guidance", "confidence", "fallbacks"],
            },
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API returned status: ${response.status}`);
    }

    const resJson = await response.json();
    const textResult = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) {
      throw new Error("Empty response from Gemini API");
    }

    return JSON.parse(textResult) as SceneBlueprint;
  } catch (error) {
    console.error("Error generating scene blueprint via Gemini:", error);
    return generateFallbackBlueprint(inputs);
  }
}

/**
 * Generate Geospatial Ecosystem Insight Panel using Gemini Structured Output.
 */
export async function generateEcosystemInsight(
  lat: number,
  lon: number,
  extra?: { climate?: string; season?: string }
): Promise<EcosystemInsight> {
  const apiKey = import.meta.env.VITE_AI_STUDIO_KEY || "";
  
  // 1. Gather all inputs
  const geo = await reverseGeocode(lat, lon);
  const elev = await fetchElevation(lat, lon);
  const inat = await fetchINaturalistData(lat, lon);

  // 2. Synthesize/simulate realistic proxy signals based on coordinates & altitude
  // Nepal ranges: lat ~26.3 to 30.5, lon ~80 to 88.3
  const isNepal = lat >= 26 && lat <= 31 && lon >= 80 && lon <= 89;
  const isHighAlt = elev > 2500;
  const isLowAlt = elev < 900;
  
  // Calculate remote sensing proxies
  let ndvi = 78; // forest baseline
  if (isHighAlt) ndvi = 32; // alpine vegetation
  else if (elev > 1800) ndvi = 62; // pine/temperate
  else if (isLowAlt) ndvi = 88; // tropical lushness

  // Add small noise
  ndvi = Math.max(10, Math.min(100, ndvi + Math.floor((Math.random() - 0.5) * 10)));

  const thermalAnomaly = isHighAlt ? 8 : 18; // mostly cold unless hot lower valley
  const waterPresence = hasWaterSignal(inat.habitatTags, geo.area_name) ? 82 : (isLowAlt ? 65 : 48);
  const landUseStable = geo.area_name.toLowerCase().includes("park") || geo.area_name.toLowerCase().includes("reserve") || geo.area_name.toLowerCase().includes("conservation");
  const landUseChange = landUseStable ? 12 : 28;

  const climateZone = extra?.climate || (isHighAlt ? "Alpine" : (elev > 1800 ? "Temperate" : (elev > 900 ? "Subtropical" : "Tropical")));
  const seasonContext = extra?.season || getSeasonForMonth(new Date().getMonth());

  const weatherSummary = climateZone === "Tropical" ? "Warm and humid" : (climateZone === "Alpine" ? "Cold and misty" : "Mild, clear skies");
  
  const payload = {
    location: {
      place_name: geo.area_name,
      latitude: lat,
      longitude: lon,
      country: geo.country,
      region: geo.region,
      admin_area: geo.admin_area
    },
    geospatial_signals: {
      ndvi_score: ndvi,
      thermal_anomaly_index: thermalAnomaly,
      water_presence_index: waterPresence,
      land_use_change_index: landUseChange,
      elevation: elev,
      land_cover_class: isHighAlt ? "Subalpine Conifer Woodland" : (isLowAlt ? "Tropical Broadleaf Forest" : "Pine/Mixed Temperate Forest"),
      nearby_water_features: hasWaterSignal(inat.habitatTags, geo.area_name) ? ["river", "stream"] : ["brook"],
      nearby_habitat_tags: inat.habitatTags
    },
    biodiversity_context: {
      inaturalist_taxa_summary: inat.taxaSummary,
      inaturalist_observation_density: inat.observations.length,
      inaturalist_habitat_signals: inat.habitatTags
    },
    environmental_context: {
      climate_zone: climateZone,
      seasonal_context: seasonContext,
      weather_summary: weatherSummary,
      date_context: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })
    }
  };

  if (!apiKey) {
    console.warn("VITE_AI_STUDIO_KEY is missing. Using local ecosystem insight fallback.");
    return generateFallbackInsight(payload);
  }

  const promptText = `
You are a geospatial forest intelligence engine for a nature-monitoring app.

Your job is to analyze a selected location and synthesize a clear forest/ecosystem insight panel from geospatial signals, remote-sensing proxies, and biodiversity context.

You must:
- Use only the provided inputs.
- Never invent facts that are not supported by the data.
- Prefer conservative, location-grounded interpretations.
- Return valid JSON only conforming to the schema.
- Keep the result suitable for a UI dashboard and a 3D forest scene generator.
- Use simple, readable labels, but include brief scientific reasoning inside the JSON.

INPUTS:
${JSON.stringify(payload, null, 2)}

TASK:
1. Identify the forest or area name from the place information.
2. Infer climate using the climate zone and surrounding context.
3. Infer season in a way that makes sense for the location and date.
4. Interpret vegetation density using NDVI and habitat signals.
5. Interpret fire risk using thermal anomaly and dryness indicators.
6. Interpret water resources using rivers, lakes, wetlands, and water presence.
7. Interpret land use change using stability/disturbance signals.
8. Write a short AI insight summary that sounds like an intelligent monitoring system (under 4 sentences).
9. Provide confidence scores for each section.
10. Keep the tone scientific, calm, and positive, but not exaggerated.

IMPORTANT RULES:
- If a value is missing, infer only a conservative fallback.
- If the location is urban or near urban edges, reduce forest confidence.
- If NDVI is high, vegetation density should usually be "Good" or "Dense".
- If thermal anomaly is low, fire risk should be "Low" or "Moderate".
- If water presence is low, do not describe the area as water-rich.
- If land use change is stable, describe minimal disturbance or stable cover.
- Do not mention sources by name in the final narrative.
- Do not output markdown.
- Output JSON only conforming to the schema.

LABEL GUIDELINES:
Vegetation density: 0-25=Sparse, 26-50=Moderate, 51-75=Good, 76-100=Dense
Fire risk: 0-20=Low, 21-50=Moderate, 51-75=High, 76-100=Critical
Water resources: 0-20=Scarce, 21-50=Limited, 51-75=Good, 76-100=Rich
Land use change: 0-20=Stable, 21-50=Mild change, 51-75=Active change, 76-100=Rapid change

STYLE OF AI INSIGHT:
- "Vegetation cover is healthy and well-established."
- "Fire pressure remains low under current conditions."
- "Water availability is present but seasonal."
- "Land use appears stable with limited disturbance."
- "Overall ecosystem condition is functioning at a healthy baseline."
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                location: {
                  type: "OBJECT",
                  properties: {
                    area_name: { type: "STRING" },
                    country: { type: "STRING" },
                    region: { type: "STRING" },
                    latitude: { type: "NUMBER" },
                    longitude: { type: "NUMBER" },
                  },
                  required: ["area_name", "country", "region", "latitude", "longitude"],
                },
                climate: {
                  type: "OBJECT",
                  properties: {
                    label: { type: "STRING" },
                    description: { type: "STRING" },
                    confidence: { type: "NUMBER" },
                  },
                  required: ["label", "description", "confidence"],
                },
                season: {
                  type: "OBJECT",
                  properties: {
                    label: { type: "STRING" },
                    description: { type: "STRING" },
                    confidence: { type: "NUMBER" },
                  },
                  required: ["label", "description", "confidence"],
                },
                vegetation_density: {
                  type: "OBJECT",
                  properties: {
                    label: { type: "STRING" },
                    ndvi_simulation: { type: "NUMBER" },
                    status: { type: "STRING" },
                    description: { type: "STRING" },
                    confidence: { type: "NUMBER" },
                  },
                  required: ["label", "ndvi_simulation", "status", "description", "confidence"],
                },
                fire_risk: {
                  type: "OBJECT",
                  properties: {
                    label: { type: "STRING" },
                    thermal_anomaly_index: { type: "NUMBER" },
                    status: { type: "STRING" },
                    description: { type: "STRING" },
                    confidence: { type: "NUMBER" },
                  },
                  required: ["label", "thermal_anomaly_index", "status", "description", "confidence"],
                },
                water_resources: {
                  type: "OBJECT",
                  properties: {
                    label: { type: "STRING" },
                    water_presence_index: { type: "NUMBER" },
                    status: { type: "STRING" },
                    description: { type: "STRING" },
                    confidence: { type: "NUMBER" },
                  },
                  required: ["label", "water_presence_index", "status", "description", "confidence"],
                },
                land_use_change: {
                  type: "OBJECT",
                  properties: {
                    label: { type: "STRING" },
                    index: { type: "NUMBER" },
                    status: { type: "STRING" },
                    description: { type: "STRING" },
                    confidence: { type: "NUMBER" },
                  },
                  required: ["label", "index", "status", "description", "confidence"],
                },
                ai_insight: {
                  type: "OBJECT",
                  properties: {
                    headline: { type: "STRING" },
                    summary: { type: "STRING" },
                    recommended_action: { type: "STRING" },
                  },
                  required: ["headline", "summary", "recommended_action"],
                },
                scene_guidance: {
                  type: "OBJECT",
                  properties: {
                    canopy_density: { type: "STRING" },
                    ground_moisture: { type: "STRING" },
                    fog_level: { type: "STRING" },
                    dominant_colors: { type: "ARRAY", items: { type: "STRING" } },
                    visual_mood: { type: "STRING" },
                  },
                  required: ["canopy_density", "ground_moisture", "fog_level", "dominant_colors", "visual_mood"],
                },
                confidence_overall: { type: "NUMBER" }
              },
              required: [
                "location",
                "climate",
                "season",
                "vegetation_density",
                "fire_risk",
                "water_resources",
                "land_use_change",
                "ai_insight",
                "scene_guidance",
                "confidence_overall"
              ],
            },
          },
        }),
      }
    );

    if (!response.ok) throw new Error("Gemini request failed");
    const resJson = await response.json();
    const textResult = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) throw new Error("Empty response candidates");
    return JSON.parse(textResult) as EcosystemInsight;
  } catch (error) {
    console.error("Gemini failed, using local insight synthesis fallback:", error);
    return generateFallbackInsight(payload);
  }
}

function hasWaterSignal(tags: string[], place: string): boolean {
  const t = tags.join(" ").toLowerCase();
  const p = place.toLowerCase();
  return (
    t.includes("water") ||
    t.includes("river") ||
    t.includes("wetland") ||
    t.includes("stream") ||
    t.includes("lake") ||
    p.includes("lake") ||
    p.includes("river") ||
    p.includes("wetland")
  );
}

function getSeasonForMonth(month: number): string {
  if (month >= 2 && month <= 4) return "Spring";
  if (month >= 5 && month <= 7) return "Summer";
  if (month >= 8 && month <= 10) return "Autumn";
  return "Winter";
}

function generateFallbackInsight(payload: any): EcosystemInsight {
  const ndvi = payload.geospatial_signals.ndvi_score;
  const thermal = payload.geospatial_signals.thermal_anomaly_index;
  const water = payload.geospatial_signals.water_presence_index;
  const landUse = payload.geospatial_signals.land_use_change_index;

  const vegLabel = ndvi > 75 ? "Dense" : (ndvi > 50 ? "Good" : (ndvi > 25 ? "Moderate" : "Sparse"));
  const fireLabel = thermal > 75 ? "Critical" : (thermal > 50 ? "High" : (thermal > 20 ? "Moderate" : "Low"));
  const waterLabel = water > 75 ? "Rich" : (water > 50 ? "Good" : (water > 20 ? "Limited" : "Scarce"));
  const landLabel = landUse > 75 ? "Rapid change" : (landUse > 50 ? "Active change" : (landUse > 20 ? "Mild change" : "Stable"));

  return {
    location: {
      area_name: payload.location.place_name,
      country: payload.location.country,
      region: payload.location.region,
      latitude: payload.location.latitude,
      longitude: payload.location.longitude
    },
    climate: {
      label: payload.environmental_context.climate_zone,
      description: `Ecosystem sits within a ${payload.environmental_context.climate_zone.toLowerCase()} climate belt.`,
      confidence: 0.85
    },
    season: {
      label: payload.environmental_context.seasonal_context,
      description: `Analyzing under ${payload.environmental_context.seasonal_context.toLowerCase()} seasonal profile.`,
      confidence: 0.9
    },
    vegetation_density: {
      label: vegLabel,
      ndvi_simulation: ndvi,
      status: ndvi > 50 ? "Healthy" : "Stressed",
      description: `NDVI signal stands at ${ndvi}/100, reflecting ${vegLabel.toLowerCase()} canopy density.`,
      confidence: 0.8
    },
    fire_risk: {
      label: fireLabel,
      thermal_anomaly_index: thermal,
      status: thermal < 30 ? "Safe" : "Warning",
      description: `Thermal anomalies index at ${thermal}/100. Fire pressure is ${fireLabel.toLowerCase()}.`,
      confidence: 0.8
    },
    water_resources: {
      label: waterLabel,
      water_presence_index: water,
      status: water > 50 ? "Sufficient" : "Low",
      description: `Surface water indices indicate ${waterLabel.toLowerCase()} hydrologic resources.`,
      confidence: 0.75
    },
    land_use_change: {
      label: landLabel,
      index: landUse,
      status: landUse < 30 ? "Stable" : "Alert",
      description: `Land stability index at ${landUse}/100, confirming a ${landLabel.toLowerCase()} land-use pattern.`,
      confidence: 0.8
    },
    ai_insight: {
      headline: `${vegLabel} Forest Canopy & ${fireLabel} Fire Risk`,
      summary: `Vegetation cover is healthy and well-established. Fire pressure remains low under current conditions. Water availability is present but seasonal. Land use appears stable with limited disturbance.`,
      recommended_action: "Continue routine satellite sweeps and acoustic monitoring."
    },
    scene_guidance: {
      canopy_density: ndvi > 75 ? "high" : (ndvi > 40 ? "medium" : "low"),
      ground_moisture: water > 60 ? "wet" : (water > 30 ? "moderate" : "dry"),
      fog_level: water > 75 ? "heavy" : (water > 45 ? "medium" : "light"),
      dominant_colors: ndvi > 75 ? ["#1B5E20", "#2E7D32", "#4CAF50"] : ["#8D6E63", "#4CAF50", "#E0F2F1"],
      visual_mood: ndvi > 75 ? "lush and humid" : "serene alpine"
    },
    confidence_overall: 0.83
  };
}

/**
 * Fallback generator when Gemini is not configured or fails.
 */
function generateFallbackBlueprint(inputs: UserInputs): SceneBlueprint {
  const isSparse = inputs.inaturalist_observations.length === 0;
  const isAlpine = inputs.latitude && inputs.latitude > 28.5; // simple heuristic for mountainous
  
  return {
    location_profile: {
      region_name: inputs.location_text || "Generic Forest Zone",
      biome: isAlpine ? "alpine" : "pine",
      habitat_type: isAlpine ? "Coniferous Mountain Woodland" : "Temperate Pine Forest",
      canopy_density: isSparse ? "low" : "medium",
      moisture_level: "moderate",
      biodiversity_mood: isSparse ? "sparse" : "balanced",
    },
    scene_assets: {
      trees: [
        {
          type: isAlpine ? "Alpine Fir" : "Pinus wallichiana",
          count_hint: "80-120",
          height_m: [12, 25],
          dominance: "high",
        },
        {
          type: "Rhododendron",
          count_hint: "20-40",
          height_m: [3, 8],
          dominance: "medium",
        }
      ],
      understory: ["Ferns", "Shrubs", "Wild berries"],
      ground_cover: ["Moss", "Pine needles", "Grass patches"],
      water_features: isAlpine ? ["Glacial stream"] : ["Forest brook"],
      rocks_and_decoration: ["Granite boulders", "Fallen logs"],
      wildlife_visual_cues: ["Birds in flight", "Butterflies"],
    },
    lighting: {
      time_style: inputs.time_of_day || "Golden Hour",
      fog: "light",
      sun_intensity: "medium",
      atmosphere: "misty and serene",
    },
    render_guidance: {
      camera_angle: "45-degree orbit",
      composition: "Rule of thirds, centered forest trail",
      color_palette: ["#1b5e20", "#4caf50", "#d4e5d8", "#8d6e63", "#a1887f"],
      detail_priority: ["Canopy shadows", "Understory moss", "Water reflections"],
    },
    confidence: {
      overall: 0.6,
      biome: 0.7,
      vegetation: 0.5,
      lighting: 0.6,
    },
    fallbacks: {
      if_data_is_sparse: ["Use standard Pine Forest assets"],
      if_location_is_urban_edge: ["Add sparse grass patches, reduce tree count by 40%"],
    },
  };
}

export interface WikimediaImage {
  pageid: number;
  title: string;
  url: string;
  description?: string;
  author?: string;
}

export async function fetchLocalWikimediaImages(lat: number, lon: number): Promise<WikimediaImage[]> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${lat}|${lon}&ggsradius=10000&ggslimit=12&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Wikimedia request failed");
    const data = await res.json();
    
    const pages = data.query?.pages || {};
    const images: WikimediaImage[] = [];
    
    Object.keys(pages).forEach((key) => {
      const page = pages[key];
      const info = page.imageinfo?.[0];
      if (info && info.url) {
        // filter for image files
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(info.url);
        if (!isImage) return;

        const ext = info.extmetadata || {};
        const description = ext.ImageDescription?.value 
          ? ext.ImageDescription.value.replace(/<[^>]*>/g, "").slice(0, 150)
          : undefined;
        const author = ext.Artist?.value 
          ? ext.Artist.value.replace(/<[^>]*>/g, "")
          : undefined;

        images.push({
          pageid: page.pageid,
          title: page.title.replace(/^File:/i, "").replace(/\.[^/.]+$/, ""),
          url: info.url,
          description,
          author
        });
      }
    });
    
    return images;
  } catch (error) {
    console.error("Error fetching Wikimedia images:", error);
    return [];
  }
}
