/**
 * Anti-slop craft prompt (ported from OpenDesign craft/anti-ai-slop.md).
 *
 * Concatenated into the generate system prompt to steer the model away
 * from default-LLM output and toward "designed by a human who has shipped
 * product". Every rule is concrete and checkable by the linter or a
 * reviewer — no vague guidance.
 */

export const ANTI_SLOP_CRAFT = `\
CRAFT BAR — anti-AI-slop. Jede Regel ist konkret und prüfbar; ein Verstoß ist eine Regression.

SIEBEN TODESSÜNDEN (P0 — dürfen NICHT vorkommen):
1. Tailwind-Indigo als Akzent — nie #6366f1/#4f46e5/#4338ca/#3730a3/#8b5cf6/#7c3aed/#a855f7 als Akzent. Indigo ist das AI-Merkzeichen. Akzent kommt NUR aus dem Design-System.
2. Zwei-Stop „Trust"-Verlauf im Hero — kein purple→blue, blue→cyan, indigo→pink. Eine flache Surface + gesetzte Typografie schlägt das jedes Mal.
3. Emoji als Feature-Icons — kein ✨🚀🎯⚡🔥💡 in Headings/Buttons/Listen/Icon-Klassen. Stattdessen 1.6–1.8px-monoline SVG mit currentColor.
4. Sans-Serif auf Display-Headings wenn das System eine Serif bindet — h1/h2 via var(--font-display), nie hartes Inter/Roboto/system-ui.
5. Abgerundete Karte mit farbigem linken Border-Akzent — die kanonische „AI-Dashboard-Kachel". Streiche Radius ODER Border.
6. Erfundene Metriken — kein „10× schneller"/„99,9 % Uptime"/„3× produktiver" ohne echte Quelle. Lieber beschrifteten Platzhalter.
7. Filler-Copy — kein Lorem ipsum, kein „Feature eins/zwei/drei", kein Platzhaltertext. Eine leere Sektion ist ein Kompositionsfehler, kein Anlass, Text zu erfinden.

SOFT TELLS (P1 — vermeiden):
- Generisches Hero→Features→Pricing→FAQ→CTA-Gerüst ohne Variation. Baue mindestens eine unkonventionelle Sektion ein.
- Mehr als ~12 Hex-Werte außerhalb von :root.
- var(--accent) 6+× auf einem Screen sichtbar — kappe bei ~2 sichtbaren Verwendungen.

TOKEN-DISZIPLIN (erzwungen): Jede Farbe referenziert ein :root-Token (var(--accent), var(--surface) …). KEIN Hex außerhalb von :root. Definiere --bg, --surface, --primary, --accent, --text, --text-muted, --border EINMAL in :root, referenziere sie überall.

QUALITÄTSLEISTE — Seele: ~80 % bewährte Muster + ~20 % charaktervolle Entscheidung. Die 20 % leben in: EINEM mutigen visuellen Move (Type/Color/Proportion), echter Stimme im Microcopy („Tracking starten" schlägt „Loslegen"), EINER einprägsamen Micro-Interaction (2px-Press, count-up), EINEM Detail das nur ein echter Nutzer setzt (kbd-Hint, produktspezifische Status-Phrase). Test: Wer außerhalb des Projekts kann am Screenshot Marke/Studio erkennen → Seele da. Sonst Template.`;
