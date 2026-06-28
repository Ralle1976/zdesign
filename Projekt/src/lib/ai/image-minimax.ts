// Z.Design — MiniMax image-01 client
//
// PRIMARY image provider. The MiniMax coding plan key (already in .env)
// generates ~100-130 images/day at no extra cost. Model "image-01" produces
// photorealistic food/design photography from text prompts.
//
// API: POST https://api.minimax.io/v1/image_generation
// Auth: Bearer $MINIMAX_API_KEY (same key as the text LLM)
// Response: { data: { image_urls: ["https://..."] }, base_resp: { status_code: 0 } }

export interface MinimaxImageOpts {
  model?: string;        // default: image-01
  aspectRatio?: string; // default: "4:3" (options: "1:1", "4:3", "16:9", "3:4", "9:16")
  numImages?: number;    // default: 1
  timeoutMs?: number;   // default: 60000
}

export interface GeneratedImage {
  url: string;
  prompt: string;
  model: string;
  provider: string;
}

export function isMinimaxImageConfigured(): boolean {
  return !!process.env.MINIMAX_API_KEY;
}

export async function generateImageMinimax(
  prompt: string,
  opts: MinimaxImageOpts = {},
): Promise<GeneratedImage> {
  const key = process.env.MINIMAX_API_KEY;
  if (!key) throw new Error('MINIMAX_API_KEY not set');

  const model = opts.model || 'image-01';
  const aspectRatio = opts.aspectRatio || '4:3';
  const numImages = opts.numImages || 1;
  const timeoutMs = opts.timeoutMs || 60_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.minimax.io/v1/image_generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        aspect_ratio: aspectRatio,
        num_images: numImages,
        response_format: 'url',
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`MiniMax image error ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const status = data?.base_resp?.status_code ?? -1;
    if (status !== 0) {
      throw new Error(`MiniMax image failed: ${data?.base_resp?.status_msg || JSON.stringify(data).slice(0, 200)}`);
    }

    const urls: string[] = data?.data?.image_urls || [];
    if (urls.length === 0) {
      throw new Error('MiniMax returned no image URLs');
    }

    return {
      url: urls[0],
      prompt,
      model,
      provider: 'minimax',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generate multiple images in parallel (with concurrency limit).
 */
export async function generateImagesMinimax(
  prompts: string[],
  opts?: MinimaxImageOpts,
  concurrency = 3,
): Promise<GeneratedImage[]> {
  const results: GeneratedImage[] = new Array(prompts.length);
  let cursor = 0;

  async function worker() {
    while (cursor < prompts.length) {
      const i = cursor++;
      try {
        results[i] = await generateImageMinimax(prompts[i], opts);
      } catch (e) {
        console.error(`[image-minimax] failed for prompt ${i}:`, e instanceof Error ? e.message : e);
        results[i] = { url: '', prompt: prompts[i], model: opts?.model || 'image-01', provider: 'minimax' };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, prompts.length) }, () => worker()));
  return results;
}

/**
 * Build Thai-food-specific image prompts from a brief.
 * Produces 3-5 specific dish prompts that image-01 renders photorealistically.
 */
export function buildThaiFoodPrompts(theme: string, imagery?: string): string[] {
  const prompts: string[] = [];

  prompts.push(
    `Professional overhead food photography of authentic Thai dishes spread on a rustic wooden table, steam rising, warm natural lighting, fresh herbs, lime wedges, chili garnish, appetizing, high resolution. Style: ${theme}`,
  );

  prompts.push(
    `Close-up of Pad Thai noodles being tossed in a wok with shrimp, bean sprouts, crushed peanuts, lime wedge, motion blur on the wok toss, street food style, dramatic warm lighting, professional food photography. Style: ${theme}`,
  );

  prompts.push(
    `Thai green curry in a rustic ceramic bowl with jasmine rice on the side, fresh Thai basil, coconut milk sauce glistening, steam rising, overhead food photography, warm tones, appetizing. Style: ${theme}`,
  );

  prompts.push(
    `Golden crispy Thai spring rolls with sweet chili dipping sauce, fresh herb garnish, on a dark ceramic plate, close-up food photography, warm appetizing lighting, shallow depth of field. Style: ${theme}`,
  );

  if (imagery && imagery.length > 10) {
    prompts.push(`Professional food photography: ${imagery}. Warm lighting, rustic table, appetizing, high resolution. Style: ${theme}`);
  }

  return prompts.slice(0, 4);
}

/**
 * General image-prompt builder for ANY showcase subject (coffee, surf, hotel,
 * bar, florist, gym, …). Detects the category from theme/imagery and emits 3
 * concrete, art-directed photography prompts that image-01 renders
 * photorealistically. Falls back to a generic editorial prompt using `imagery`.
 *
 * Used by the batch/showcase route to give diverse, non-food designs real
 * generated imagery. (Thai food still goes through buildThaiFoodPrompts.)
 */
export function buildImagePrompts(theme: string, imagery?: string): string[] {
  const hay = `${theme} ${imagery || ''}`.toLowerCase();
  // NOTE: do NOT shortcut on `imagery` — it's the imageryGuidance boilerplate
  // (a style hint), NOT the subject. Using it as the subject feeds MiniMax
  // "Themengerechte, hochwertige Bildwelt…" instead of the actual topic.
  // The domain branches below derive the subject from `theme` (the real brief).

  if (/(coffee|espresso|roaster|café|cafe|barista)/.test(hay)) {
    return [
      `Close-up of a barista pulling a fresh espresso shot, crema streaming into a warm ceramic cup, steam, golden morning light through a window, professional specialty-coffee photography, shallow depth of field.`,
      `Overhead of freshly roasted coffee beans spilling from a burlap sack onto a dark concrete surface, glossy oils, warm tones, macro food photography.`,
      `Cozy minimalist specialty coffee shop interior, warm wood, pendant lights, a latte with latte art on a marble counter, inviting ambiance, architectural photography.`,
    ];
  }
  if (/(surf|skate|ocean|wave|board)/.test(hay)) {
    return [
      `Surfer riding a glassy morning wave at sunrise, spray, warm golden light, action sports photography, telephoto, vivid.`,
      `Close-up of a waxed surfboard leaning against weathered wood, ocean backdrop, sun-bleached, laid-back coastal lifestyle photography.`,
      `Aerial drone shot of a turquoise coastline with waves breaking over sand, dramatic cliffs, cinematic travel photography.`,
    ];
  }
  if (/(hotel|villa|resort|spa|retreat|boutique|wellness)/.test(hay)) {
    return [
      `Infinity pool overlooking tropical jungle at dusk, warm villa lights reflecting on the water, luxury resort photography, cinematic, serene.`,
      `Minimalist boutique hotel suite interior, warm wood, linen bedding, soft daylight through sheer curtains, architectural interior photography.`,
      `Close-up of a spa still life: rolled towels, orchid, stone bowl, candlelight, wellness photography, calming, high-end.`,
    ];
  }
  if (/(cocktail|bar|mixolog|drink|spirits|whisky|whiskey|lounge)/.test(hay)) {
    return [
      `Craft cocktail in a crystal glass with a large ice cube and citrus peel, moody bar lighting, bokeh of backlit bottles behind, professional beverage photography.`,
      `Bartender pouring a smoked cocktail behind a dark marble bar, dramatic single-source light, motion, atmospheric.`,
      `Close-up of bar tools and fresh garnishes — citrus, herbs, bitters — on a dark brass counter, moody, premium.`,
    ];
  }
  if (/(plant|florist|flower|garden|botan|greenery|blumen)/.test(hay)) {
    return [
      `Lush monstera and fern arrangement in a bright plant shop, dappled natural light, green tones, fresh, lifestyle photography.`,
      `Florist's hands arranging wild seasonal blooms on a paper-covered workbench, earthy palette, artisanal, close-up.`,
      `Close-up of dewy petals and eucalyptus, macro botanical photography, soft-focus background, vibrant.`,
    ];
  }
  if (/(gym|fitness|strength|crossfit|training|athlete|boxgym)/.test(hay)) {
    return [
      `Athlete mid-lift with a loaded barbell, chalk dust in the air, dramatic side light, raw industrial gym, powerful sports photography.`,
      `Close-up of calloused hands chalking up, gritty texture, dark moody gym background, intense, photorealistic.`,
      `Wide shot of a brutalist strength gym, racks, weights, a single shaft of light, cinematic, motivating.`,
    ];
  }
  if (/(architect|studio|interior|design studio|bau)/.test(hay)) {
    return [
      `Low-angle architectural photograph of a striking modern concrete-and-glass building at golden hour, sharp lines, blue sky, professional architecture photography.`,
      `Minimalist interior of a design studio, raw concrete, oak, large windows, a model on a table, soft daylight, architectural photography.`,
      `Close-up of material samples — concrete, wood, steel — arranged on a drafting table, raking light, tactile, premium.`,
    ];
  }
  if (/(food|restaurant|kitchen|cuisine|dining|bistro|eatery|imbiss)/.test(hay)) {
    return [
      `Overhead spread of signature dishes on a styled table, steam, fresh garnish, warm natural light, professional food photography, appetizing.`,
      `Close-up of a signature dish being plated by a chef, motion, dramatic warm lighting, shallow depth of field, premium.`,
      `Atmospheric restaurant interior, warm pendant lights, set tables, inviting ambiance, architectural photography.`,
    ];
  }

  if (/(law|legal|recht|anwalt|kanzlei|notar|jurist|finance|bank|consulting|corporate|steuer)/.test(hay)) {
    return [
      `Modern law firm conference room with leather chairs and a large wooden table, warm professional lighting, legal books on shelves behind, serious trustworthy atmosphere, professional interior photography.`,
      `Close-up of a lawyer's hands reviewing documents at an elegant desk, pen, legal texts, warm wood, soft natural light from a window, professional editorial photography, depth of field.`,
      `Classic law library or courthouse facade, stone columns, warm afternoon light conveying authority and tradition, architectural photography, dignified.`,
    ];
  }
  if (/(yoga|meditation|wellness|mindful|achtsam|vinyasa|yin|atem)/.test(hay)) {
    return [
      `Serene yoga studio interior with wooden floor, large windows with soft morning light, plants, rolled yoga mats, peaceful and warm atmosphere, lifestyle photography.`,
      `Close-up of hands in a meditation mudra on a wooden yoga block, warm natural light, calm and mindful, premium wellness photography, shallow depth of field.`,
      `Group of yogis in a gentle pose on mats in a bright warm studio, morning sunlight streaming through windows, peaceful community atmosphere, lifestyle photography.`,
    ];
  }
  if (/(crypto|web3|blockchain|bitcoin|ethereum|nft|defi|wallet|token)/.test(hay)) {
    return [
      `Abstract glowing 3D geometric network of connected nodes and data streams, deep dark background with cyan and violet light, futuristic blockchain visualization, digital art, cinematic.`,
      `Close-up of a sleek hardware crypto wallet device on a dark reflective surface with subtle neon glow, premium tech product photography, dramatic lighting.`,
      `Wide shot of an abstract digital landscape with floating transparent glass cards showing data, dark space background, particle effects, futuristic Web3 aesthetic, cinematic.`,
    ];
  }
  if (/(analytics|saas|software|platform|dashboard|data|tracking|metric|product)/.test(hay)) {
    return [
      `Modern clean SaaS analytics dashboard on a laptop screen showing colorful charts and graphs, on a minimalist desk with a coffee cup, warm natural light, tech lifestyle photography.`,
      `Close-up of a finger interacting with a data visualization on a tablet, clean UI with charts and numbers, shallow depth of field, professional product photography.`,
      `Abstract geometric representation of data flow — connected nodes, lines, and bars in indigo and cyan on a dark background, clean tech aesthetic, digital art.`,
    ];
  }
  if (/(festival|music|club|concert|techno|dj|party|nightlife|lineup|rave)/.test(hay)) {
    return [
      `Energetic crowd at an indoor techno festival with hands raised, fog machine haze, laser beams in blue and magenta cutting through the darkness, dramatic stage lighting, event photography.`,
      `Close-up of a DJ's hands on a mixing console in a dark booth, LED lights reflecting on the equipment, backlit by stage lights, atmospheric music photography.`,
      `Wide shot of a massive industrial warehouse venue at night with dramatic stage production, lasers, LED screens, silhouetted crowd, cinematic event photography, vivid colors.`,
    ];
  }
  if (/(perfum|parfum|duft|fragrance|cosmetic|beauty|flacon)/.test(hay)) {
    return [
      `Elegant minimalist perfume flacons on a stone surface with soft directional light casting long dramatic shadows, ivory and gold tones, luxury product photography, editorial.`,
      `Close-up of a glass perfume dropper with golden oil, botanical ingredients like bergamot and cedar around it, warm soft light, premium cosmetic still life photography.`,
      `Atmospheric perfume atelier interior with shelves of ingredients, glass bottles, warm afternoon light through sheer curtains, artisanal craftsmanship, editorial photography.`,
    ];
  }
  if (/(outdoor|hiking|berg|wandern|alpine|mountain|natur|adventure|guide)/.test(hay)) {
    return [
      `Breathtaking alpine mountain panorama at golden sunrise, sharp dramatic peaks with layered ridgelines, warm light flooding the valley, wide landscape photography, cinematic.`,
      `Lone hiker with a backpack on a narrow ridge trail, dramatic peaks behind, golden hour light, sense of adventure and scale, outdoor lifestyle photography.`,
      `Cozy mountain hut at dusk with warm lights in the windows, surrounded by dramatic peaks, clear sky with stars beginning to appear, atmospheric landscape photography.`,
    ];
  }

  // Generic editorial fallback for anything else — uses `theme` as the subject.
  return [
    `Editorial hero photograph capturing the essence of: ${theme}. Dramatic professional lighting, strong composition, magazine quality, high resolution.`,
    `Close-up detail shot conveying the texture and craft of: ${theme}. Natural light, shallow depth of field, photorealistic, premium.`,
    `Atmospheric wide shot telling the story of: ${theme}. Cinematic, warm tonal range, professional photography, inviting.`,
  ];
}
