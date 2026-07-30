// Z.Design Prompt for Boss Watches with 3D zoom interaction
// This is the EXACT technical specification Z.Design needs to generate
// a premium watch page with CSS 3D transforms + scroll-wheel zoom.

const PROMPT = `Erstelle eine Premium-Landingpage für den Uhren-Hersteller BOSS.

KRITISCHE ANFORDERUNGEN (BINDEND):

1. HERO-SEKTION: Zentrierte 3D-Uhr im Mittelpunkt
   - Eine realistische Armbanduhr (Metallgehäuse, goldene Akzente, schwarzes Zifferblatt)
   - Die Uhr ist in ein 3D-Container mit perspective: 1000px eingebettet
   - Die Uhr hat mehrere Schichten (layered): Gehäuse, Zifferblatt, Zeiger, Krone, Armband
   - Jede Schicht ist ein <div> mit transform-style: preserve-3d und individuellem translateZ

2. MAUSRAD-ZOOM-INTERAKTION (CUSTOM JAVASCRIPT):
   - Ein Custom-Event-Listener für "wheel" (Mausrad) auf dem Hero-Container
   - Bei wheel-DeltaY > 0 (runterscrollen): Die Uhr zoomt REIN (scale: 1 → 1.5 → 2)
   - Bei wheel-DeltaY < 0 (hochscrollen): Die Uhr zoomt RAUS (scale: 2 → 1.5 → 1)
   - Während des Zooms ändern sich die translateZ-Werte der Schichten:
     * scale 1.0: alle Schichten eng zusammen (translateZ: 0px, 5px, 10px)
     * scale 1.5: Schichten auseinander (translateZ: 20px, 50px, 80px)
     * scale 2.0: Exploded View (translateZ: 40px, 100px, 160px)
   - Das gibt den Effekt einer Explosionszeichnung (Exploded View) — man sieht das Innere der Uhr
   - Smooth CSS transition: transform 800ms cubic-bezier(0.22, 1, 0.36, 1)

3. CSS-3D-TRANSFORMS (exakt diese Properties):
   .watch-container {
     perspective: 1000px;
     transform-style: preserve-3d;
   }
   .watch-layer {
     transform-style: preserve-3d;
     transition: transform 800ms cubic-bezier(0.22, 1, 0.36, 1);
   }
   .watch-case { transform: translateZ(0px); }
   .watch-dial { transform: translateZ(5px); }
   .watch-hands { transform: translateZ(10px); }
   .watch-crown { transform: translateZ(15px); }
   .watch-band { transform: translateZ(-10px); }

4. PREMIUM-LOOK (BOSS-Ästhetik):
   - Deep black background (#08070a)
   - Gold accents (#C9A961, #B8860B)
   - Cormorant Garamond für Headlines (font-weight 300)
   - JetBrains Mono für technische Details
   - Film-grain noise overlay (opacity 0.035)
   - Ambient golden glow hinter der Uhr (radial-gradient pulse)

5. Sektionen: Header (BOSS Logo, Nav, CTA), Hero (3D-Uhr + Zoom), Features (Uhrwerk, Wasserdichtigkeit, Garantie), Story (BOSS Geschichte), CTA (Kauf-Anfrage), Footer

6. KEINE externen 3D-Libraries (kein Three.js, kein WebGL). Nur CSS 3D + Custom JavaScript.

GENERIERE DIE VOLLSTÄNDIGE HTML-DATEI mit inline <style> und inline <script> für die Mausrad-Interaktion.`;

console.log(PROMPT);
