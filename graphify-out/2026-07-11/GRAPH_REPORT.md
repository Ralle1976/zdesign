# Graph Report - Z.Design  (2026-07-11)

## Corpus Check
- 285 files · ~1,238,181 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2256 nodes · 4616 edges · 176 communities (94 shown, 82 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d7c1331c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- patch-proposer.ts
- types.ts
- health-check.ts
- accessibility.ts
- registry.ts
- TopToolbar.tsx
- DesignSystemManager.tsx
- cn
- zip-generator.ts
- patch-disclosure.ts
- fusion-pipeline.ts
- orchestra.ts
- ZDesignApp.tsx
- route.ts
- ChatPanel.tsx
- sidebar.tsx
- compilerOptions
- db.ts
- provider-config.ts
- DesignRenderer.tsx
- art-direction.ts
- use-toast.ts
- design.ts
- devDependencies
- route.ts
- props-editors.tsx
- optimizer.ts
- server.ts
- route.ts
- alert-dialog.tsx
- PresenceBar.tsx
- AccessibilityScanner.tsx
- zai-direct.ts
- .runSynthesis
- anti-slop.ts
- panelists.ts
- Contributing to Z.Design
- react
- negative-memory.ts
- components.json
- ProviderRegistry
- dependencies
- route.ts
- systems.ts
- generate.ts
- context-menu.tsx
- Diverse verticals — real generated imagery
- route.ts
- gepa-extended.ts
- Z.Design — Autonomous AI Design Agent
- Workflow — Step by Step
- carousel.tsx
- history.ts
- creative-diversity.ts
- speech-recognition.d.ts
- Revidierter Plan: Maximaler Effekt, minimale Complexity
- parseAIResponse
- ErrorBoundary
- fallback-templates.ts
- registry.ts
- auth.ts
- style-dna.ts
- index.ts
- form.tsx
- route.ts
- drawer.tsx
- 🧠 Geteiltes Agent-Gedächtnis (Vault)
- package.json
- index.ts
- navigation-menu.tsx
- StyleSelector.tsx
- DiversityTracker
- context-manager.ts
- api-registry.ts
- consolidation.ts
- provider.ts
- registry.ts
- Z.Design Showcase — Agent-Anweisungen
- ADR 0001 — feature/feature-001 Branch: behalten, nicht mergen
- eval-memory-guards.ts
- toggle-group.tsx
- Gallery.tsx
- dev.sh
- route.ts
- alert.tsx
- input-otp.tsx
- StatsBar.tsx
- eslint.config.mjs
- route.ts
- route.ts
- hover-card.tsx
- image-gen.ts
- logger.ts
- mini-services-start.sh
- test-pdf-export.ts
- error.tsx
- global-error.tsx
- build.sh
- mini-services-build.sh
- mini-services-install.sh
- start.sh
- class-variance-authority
- clsx
- cmdk
- date-fns
- publish-showcase.sh
- @dnd-kit/core
- @dnd-kit/utilities
- embla-carousel-react
- framer-motion
- @hookform/resolvers
- html-pdf-node
- input-otp
- jsonrepair
- lucide-react
- @mdxeditor/editor
- next
- next-auth
- next-intl
- next-themes
- prisma
- @prisma/client
- next.config.ts
- next-env.d.ts
- puppeteer
- @radix-ui/react-alert-dialog
- @radix-ui/react-aspect-ratio
- @radix-ui/react-avatar
- @radix-ui/react-collapsible
- @radix-ui/react-context-menu
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-hover-card
- @radix-ui/react-label
- @radix-ui/react-popover
- @radix-ui/react-progress
- @radix-ui/react-radio-group
- @radix-ui/react-scroll-area
- @radix-ui/react-select
- @radix-ui/react-separator
- @radix-ui/react-slider
- @radix-ui/react-slot
- @radix-ui/react-switch
- @radix-ui/react-tabs
- @radix-ui/react-toast
- @radix-ui/react-toggle
- @radix-ui/react-tooltip
- react-day-picker
- react-dom
- react-hook-form
- react-markdown
- react-resizable-panels
- @reactuses/core
- recharts
- sharp
- socket.io-client
- sonner
- tailwind-merge
- tailwindcss-animate
- @tanstack/react-query
- @tanstack/react-table
- @types/jszip
- uuid
- vaul
- z-ai-web-dev-sdk
- zustand
- postcss.config.mjs
- soul-guidance.md
- tailwind.config.ts

## God Nodes (most connected - your core abstractions)
1. `cn()` - 226 edges
2. `useZDesignStore` - 40 edges
3. `useI18n()` - 34 edges
4. `ProviderRegistry` - 31 edges
5. `POST()` - 30 edges
6. `Button()` - 25 edges
7. `recallAntiPatterns()` - 22 edges
8. `POST()` - 21 edges
9. `ProviderConfig` - 21 edges
10. `AIProviderAdapter` - 21 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --indirect_call--> `callZai()`  [INFERRED]
  Projekt/src/app/api/design/agent/route.ts → Projekt/src/lib/ai/zai-direct.ts
- `POST()` --indirect_call--> `callZai()`  [INFERRED]
  Projekt/src/app/api/design/concepts/route.ts → Projekt/src/lib/ai/zai-direct.ts
- `AlertDialogOverlay()` --calls--> `cn()`  [EXTRACTED]
  Projekt/src/components/ui/alert-dialog.tsx → Projekt/src/lib/utils.ts
- `AlertDialogContent()` --calls--> `cn()`  [EXTRACTED]
  Projekt/src/components/ui/alert-dialog.tsx → Projekt/src/lib/utils.ts
- `AlertDialogHeader()` --calls--> `cn()`  [EXTRACTED]
  Projekt/src/components/ui/alert-dialog.tsx → Projekt/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (176 total, 82 thin omitted)

### Community 0 - "patch-proposer.ts"
Cohesion: 0.06
Nodes (61): auditCorrelations(), compositeOf(), confidenceFor(), Correlation, correlationsForField(), findCorrelations(), getTopInsights(), insightLine() (+53 more)

### Community 1 - "types.ts"
Cohesion: 0.05
Nodes (54): POST(), POST(), callGemini(), callGeminiMultimodal(), callGeminiVision(), doRequest(), extractText(), GeminiCallOptions (+46 more)

### Community 2 - "health-check.ts"
Cohesion: 0.06
Nodes (56): buildManifest(), CapabilitiesManifest, CapabilityFeature, CapabilityProvider, CapabilityRouteGroup, detectFeatures(), discoverProviders(), GET() (+48 more)

### Community 3 - "accessibility.ts"
Cohesion: 0.06
Nodes (63): AccessibilityAuditResult, auditAccessibility(), AuditFinding, AuditSeverity, checkAltText(), checkContrast(), CheckCtx, checkFocusVisible() (+55 more)

### Community 4 - "registry.ts"
Cohesion: 0.09
Nodes (20): AnthropicProvider, MINIMAX_MODELS, MinimaxProvider, OpenAIProvider, OpenRouterProvider, DEFAULT_PROVIDERS, NOTE: import the persona-routing LEAF directly (not the fusion barrel) to avoid, AIProviderAdapter (+12 more)

### Community 5 - "TopToolbar.tsx"
Cohesion: 0.06
Nodes (43): Button(), Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator() (+35 more)

### Community 6 - "DesignSystemManager.tsx"
Cohesion: 0.07
Nodes (48): Badge(), badgeVariants, Input(), ScrollArea(), Select(), SelectContent(), SelectItem(), SelectTrigger() (+40 more)

### Community 7 - "cn"
Cohesion: 0.06
Nodes (42): BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator(), Card(), CardAction() (+34 more)

### Community 8 - "zip-generator.ts"
Cohesion: 0.07
Nodes (44): jszip, jszip, GET(), DesignNode, designNodeToHTML(), escapeHtml(), ExportRequestBody, generateFullHTML() (+36 more)

### Community 9 - "patch-disclosure.ts"
Cohesion: 0.08
Nodes (42): appendRecord(), autoRevertIfRegressed(), ensureDir(), evaluatePatch(), OutcomeRecord, outcomesPath(), PatchOutcome, readRecords() (+34 more)

### Community 10 - "fusion-pipeline.ts"
Cohesion: 0.09
Nodes (36): getColorPalette(), CRAFT, DEFAULTS, DesignDirective, DesignPalette, DirectionDef, DIRECTIONS, directiveLabel() (+28 more)

### Community 11 - "orchestra.ts"
Cohesion: 0.10
Nodes (24): GET(), CreativeRequestBody, AgentCallError, CreativeOrchestra, DEFAULT_CONFIG, ALL_SKILL_PACKS, CREATIVE_DIRECTOR_SKILL, CRITIQUE_AGENT_SKILL (+16 more)

### Community 12 - "ZDesignApp.tsx"
Cohesion: 0.10
Nodes (35): ResizableHandle(), ResizablePanel(), ResizablePanelGroup(), AccessibilityScanner(), AnnotationsPanel(), CanvasArea(), GENERATION_STEPS, GenerationProgressIndicator() (+27 more)

### Community 13 - "route.ts"
Cohesion: 0.11
Nodes (33): acceptHtmlDoc(), autoCloseHtml(), isValidHtmlDoc(), lintToRefinements(), POST(), TraceStep, autoCloseHtml(), BatchBody (+25 more)

### Community 14 - "ChatPanel.tsx"
Cohesion: 0.07
Nodes (25): Avatar(), AvatarFallback(), AvatarImage(), Progress(), Separator(), Textarea(), FilterMode, collectPendingImages() (+17 more)

### Community 15 - "sidebar.tsx"
Cohesion: 0.07
Nodes (33): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle(), Sidebar() (+25 more)

### Community 16 - "compilerOptions"
Cohesion: 0.05
Nodes (36): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+28 more)

### Community 17 - "db.ts"
Cohesion: 0.06
Nodes (12): convertFigmaLikeToDesignTree(), importFromFigma(), importFromJSON(), importFromURL(), ImportRequestBody, POST(), DEFAULT_STYLES, DEFAULT_TOKENS (+4 more)

### Community 18 - "provider-config.ts"
Cohesion: 0.12
Nodes (30): ENV_PATH, GET(), POST(), upsertEnvEntry(), GET(), GET(), POST(), POST() (+22 more)

### Community 19 - "DesignRenderer.tsx"
Cohesion: 0.11
Nodes (24): AnnotationPin, CanvasToolbar, CanvasToolbarProps, DesignRenderer, NodeRenderer, getDefaultStyle(), getHeadingLevel(), getHtmlTag() (+16 more)

### Community 20 - "art-direction.ts"
Cohesion: 0.10
Nodes (25): POST(), buildInjectCss(), DEFAULT_SLIDERS, HtmlArtifactPreview(), HtmlArtifactPreviewProps, RefinePopover, scaleBox(), SliderRowProps (+17 more)

### Community 21 - "use-toast.ts"
Cohesion: 0.09
Nodes (28): geistMono, geistSans, metadata, Providers(), Toast, ToastAction, ToastActionElement, ToastClose (+20 more)

### Community 22 - "design.ts"
Cohesion: 0.10
Nodes (28): AnnotationPinProps, BUILT_IN_PROVIDERS, defaultDesignTree, defaultGenerationProgress, ZDesignState, AIModelConfig, AIProviderConfig, AnimationPreset (+20 more)

### Community 23 - "devDependencies"
Cohesion: 0.06
Nodes (31): bun-types, eslint, eslint-config-next, devDependencies, bun-types, eslint, eslint-config-next, tailwindcss (+23 more)

### Community 24 - "route.ts"
Cohesion: 0.13
Nodes (23): POST(), GET(), POST(), DATA_DIR, ensureDataDir(), LESSONS_PATH, LessonSignal, lessonsToPromptBlock() (+15 more)

### Community 25 - "props-editors.tsx"
Cohesion: 0.12
Nodes (20): Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), Label(), BorderEditor(), ColorInput(), ContentEditor() (+12 more)

### Community 26 - "optimizer.ts"
Cohesion: 0.13
Nodes (22): main(), CallFusionOpts, callFusionText(), extractText(), DEFAULT_BRIEFS, extractWeaknessSignal(), FusionCall, generatePrompt() (+14 more)

### Community 27 - "server.ts"
Cohesion: 0.12
Nodes (23): POST(), ADMIN_CONTEXT, apiBase(), apiFetch(), AuthContext, canCall(), dispatchTool(), errorResponse() (+15 more)

### Community 28 - "route.ts"
Cohesion: 0.15
Nodes (16): acceptHtmlDoc(), autoCloseHtml(), isValidHtmlDoc(), TraceStep, appendLessonHistory(), enforceConceptTokens(), digestHtml(), refinePrompt() (+8 more)

### Community 29 - "alert-dialog.tsx"
Cohesion: 0.10
Nodes (18): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogTitle() (+10 more)

### Community 30 - "PresenceBar.tsx"
Cohesion: 0.12
Nodes (17): CursorOverlay(), CursorOverlayProps, Avatar, AvatarProps, ConnectionDot, ConnectionDotProps, orderUsers(), OverflowBadge (+9 more)

### Community 31 - "AccessibilityScanner.tsx"
Cohesion: 0.15
Nodes (18): AccessibilityScannerProps, CATEGORY_CONFIG, ScoreCircle(), SEVERITY_CONFIG, DesignRendererProps, NodeRendererProps, A11yCategory, A11ySeverity (+10 more)

### Community 32 - "zai-direct.ts"
Cohesion: 0.16
Nodes (20): clamp(), critiquePrompt(), critiqueRendered(), critiqueRenderedGemini(), renderAndCritique(), renderHtmlToPng(), RenderOpts, VisionCritique (+12 more)

### Community 33 - ".runSynthesis"
Cohesion: 0.25
Nodes (12): FusionPipeline, safeJsonParse(), withTimeout(), describeRouting(), isUsable(), PERSONA_MODEL_MAP, PersonaPreference, personaPreferredModel() (+4 more)

### Community 34 - "anti-slop.ts"
Cohesion: 0.16
Nodes (19): AI_DEFAULT_INDIGO, clip(), declarationLaundersIndigo(), detectBlueCyanTrustGradient(), escapeRe(), FILLER_PATTERNS, GLOBAL_THEME_ATTRIBUTES, INVENTED_METRIC_PATTERNS (+11 more)

### Community 35 - "panelists.ts"
Cohesion: 0.15
Nodes (16): CallFn, ROLE_LABEL, runCritiqueTheater(), TheaterResult, a11yPrompt(), brandPrompt(), briefLine(), CONCEPT_NEUTRAL_SENTINEL (+8 more)

### Community 36 - "Contributing to Z.Design"
Cohesion: 0.11
Nodes (17): Adding a Design System (DESIGN.md), Adding a Panelist, Adding a Skill (SKILL.md), Adding an Audit, Adding an MCP Tool, Commit style, Contributing to Z.Design, Development workflow (+9 more)

### Community 37 - "react"
Cohesion: 0.15
Nodes (15): react, ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload() (+7 more)

### Community 38 - "negative-memory.ts"
Cohesion: 0.18
Nodes (15): main(), GET(), detectInjection(), INJECTION_PATTERNS, SanitizeResult, TRUST, TrustTier, wrapUntrusted() (+7 more)

### Community 39 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 41 - "dependencies"
Cohesion: 0.12
Nodes (17): @dnd-kit/sortable, dependencies, @dnd-kit/sortable, @radix-ui/react-accordion, @radix-ui/react-checkbox, @radix-ui/react-menubar, @radix-ui/react-navigation-menu, @radix-ui/react-toggle-group (+9 more)

### Community 42 - "route.ts"
Cohesion: 0.20
Nodes (15): contrastRatioServer(), countNodes(), DesignNode, evaluateAccessibility(), evaluateCompleteness(), evaluateCSS(), evaluateResponsiveness(), evaluateSemantics() (+7 more)

### Community 43 - "systems.ts"
Cohesion: 0.20
Nodes (15): channelLin(), CONTRAST_CHECK_RESULTS, ContrastCheckResult, contrastRatio(), DESIGN_SYSTEMS, enforceTextContrast(), fold(), hexToRgb() (+7 more)

### Community 44 - "generate.ts"
Cohesion: 0.20
Nodes (12): ChatRequestBody, POST(), POST(), sseLine(), STAGE_LABELS, StreamRequestBody, deriveDesignDirection(), generateDesign() (+4 more)

### Community 45 - "context-menu.tsx"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 46 - "Diverse verticals — real generated imagery"
Cohesion: 0.12
Nodes (15): Blütenwerk — Floristik, Casa Verde — Boutique Jungle Lodge, Craft & trade verticals (generated WITH the memory system), Diverse verticals — real generated imagery, Ember & Smoke — Cocktail Bar, Fougère — Botanical Studio, Holzwerk Manufaktur — Tischlerei, How these are made (+7 more)

### Community 47 - "route.ts"
Cohesion: 0.21
Nodes (14): AssistantAction, AssistantActionType, AssistantContext, AssistantResponse, buildSystemPrompt(), CANVAS_MODE_VALUES, EXPORT_VALUES, extractJsonObject() (+6 more)

### Community 48 - "gepa-extended.ts"
Cohesion: 0.21
Nodes (13): applyPrompt(), BaseRunFn, GepaCall, GepaTarget, GepaTargetResult, judgePrompt(), mutatePrompt(), parseJudgeScore() (+5 more)

### Community 49 - "Z.Design — Autonomous AI Design Agent"
Cohesion: 0.14
Nodes (12): Architecture — How Z.Design Works, File-Based Extensibility, System Architecture, Technology Stack, The Design Pipeline (End-to-End), Architecture, How It Works (30-second version), Key Features (+4 more)

### Community 50 - "Workflow — Step by Step"
Cohesion: 0.14
Nodes (13): 1. Start Z.Design, 2. Enable Agent Mode, 3. Type Your Prompt, 4. Choose a Concept, 5. Wait for Generation (~5 min), 6. Explore the Result, 7. Iterate, 8. Export (+5 more)

### Community 51 - "carousel.tsx"
Cohesion: 0.20
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 52 - "history.ts"
Cohesion: 0.21
Nodes (10): deriveValence(), DesignHistoryRow, recordDesign(), RecordDesignInput, reinforceDomainPositives(), containsSecret(), passesLuhn(), RedactResult (+2 more)

### Community 53 - "creative-diversity.ts"
Cohesion: 0.20
Nodes (13): creativeBlockFor(), CreativeMode, hash32(), LAYOUT_ARCHETYPES, LayoutArchetype, MOTION_RECIPES, MotionFamily, MotionRecipe (+5 more)

### Community 54 - "speech-recognition.d.ts"
Cohesion: 0.14
Nodes (8): SpeechRecognition, SpeechRecognitionAlternative, SpeechRecognitionConstructor, SpeechRecognitionErrorEvent, SpeechRecognitionEvent, SpeechRecognitionResult, SpeechRecognitionResultList, Window

### Community 55 - "Revidierter Plan: Maximaler Effekt, minimale Complexity"
Cohesion: 0.14
Nodes (13): 1.1 rootCause-Persistenz (2 Zeilen pro Route), 1.2 User-Memory-Injektion (4 Zeilen pro Route), 1.3 Chat-Route bekommt Memory (der größte Hebel!), 2.1 `src/lib/ai/memory/lessons.ts` (eine Datei, ~100-150 Zeilen), 2.2 Reflect-Trigger, Datei-Übersicht (drastisch reduziert), Phase 1: Die drei forgotten Quick Wins (höchster ROI, minimaler Aufwand), Phase 2: LESSONS.md — Graphify's Best-Idee in 100 Zeilen (nicht 1000) (+5 more)

### Community 56 - "parseAIResponse"
Cohesion: 0.24
Nodes (9): AnalyzeRequestBody, buildGenerationPrompt(), GenerateRequestBody, getZAI(), POST(), ProjectType, parseAIResponse(), repairLLMJson() (+1 more)

### Community 57 - "ErrorBoundary"
Cohesion: 0.19
Nodes (6): DefaultErrorFallback(), ErrorBoundary, ErrorBoundaryProps, ErrorBoundaryState, FallbackProps, sanitizeErrorMessage()

### Community 58 - "fallback-templates.ts"
Cohesion: 0.26
Nodes (12): buildDashboardFallback(), buildDefaultFallback(), buildLandingPageFallback(), buildMobileOnboardingFallback(), buildPitchDeckFallback(), buildPortfolioFallback(), buildPricingFallback(), buildTopicDesign() (+4 more)

### Community 59 - "registry.ts"
Cohesion: 0.28
Nodes (12): IGNORE_FILES, listAvailable(), listDirectory(), looksLikePanelist(), PROJECT_ROOT, RegistryEntry, RegistrySnapshot, RegistryType (+4 more)

### Community 60 - "auth.ts"
Cohesion: 0.21
Nodes (8): handler, POST(), adapter, AdapterUser, authOptions, hashPassword(), providers, SCRYPT_PARAMS

### Community 61 - "style-dna.ts"
Cohesion: 0.23
Nodes (9): POST(), COLOR_PALETTES, ColorPalette, generateStyleDNA(), getTypographyPreset(), STYLE_PRESETS, styleDNAToPrompt(), TYPOGRAPHY_PRESETS (+1 more)

### Community 62 - "index.ts"
Cohesion: 0.33
Nodes (7): getTranslations(), I18nContext, I18nContextType, I18nProvider(), Locale, TranslationKey, translations

### Community 63 - "form.tsx"
Cohesion: 0.23
Nodes (10): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+2 more)

### Community 64 - "route.ts"
Cohesion: 0.35
Nodes (8): POST(), isSttConfigured(), TranscribeOptions, transcribeViaManualMultipart(), transcribeViaOpenRouter(), isZaiSttConfigured(), transcribeViaZai(), ZaiTranscribeOptions

### Community 65 - "drawer.tsx"
Cohesion: 0.18
Nodes (6): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 66 - "🧠 Geteiltes Agent-Gedächtnis (Vault)"
Cohesion: 0.20
Nodes (9): Control-Tower-MCP, Deploy-Regeln, 🧠 Geteiltes Agent-Gedächtnis (Vault), Nach einer längeren Session, Projekt, Sicherheitsregeln, Verfügbare MCP-Tools, Vor einer Aufgabe (+1 more)

### Community 67 - "package.json"
Cohesion: 0.20
Nodes (9): cors, dependencies, cors, socket.io, name, scripts, dev, version (+1 more)

### Community 68 - "index.ts"
Cohesion: 0.20
Nodes (6): CollabUser, CURSOR_COLORS, httpServer, io, rooms, RoomState

### Community 69 - "navigation-menu.tsx"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 70 - "StyleSelector.tsx"
Cohesion: 0.29
Nodes (6): Popover(), PopoverContent(), PopoverTrigger(), STYLE_DIRECTIONS, StyleSelectorProps, StyleDirection

### Community 71 - "DiversityTracker"
Cohesion: 0.24
Nodes (4): DesignFingerprint, DiversityTracker, isTooSimilar(), paletteJaccard()

### Community 72 - "context-manager.ts"
Cohesion: 0.44
Nodes (8): buildContext(), ChatTurn, estimateTokens(), estimateTurns(), formatForModel(), ManagedContext, shouldTrim(), trimHistory()

### Community 73 - "api-registry.ts"
Cohesion: 0.33
Nodes (8): API_ROOT, apiManifest(), ApiRouteInfo, extractDescription(), extractMethods(), getApiRoutes(), METHODS, walk()

### Community 74 - "consolidation.ts"
Cohesion: 0.31
Nodes (7): ConsolidationCandidate, ConsolidationStatus, listConsolidation(), promoteConsolidation(), proposeConsolidation(), toCandidate(), normAnti()

### Community 75 - "provider.ts"
Cohesion: 0.33
Nodes (6): callLLM(), CallOpts, getProvider(), isConfigured(), LLMProvider, ZaiProvider

### Community 76 - "registry.ts"
Cohesion: 0.31
Nodes (7): pickTemplate(), templateById(), TEMPLATES, Template, TemplateFonts, TemplatePalette, TemplateSignature

### Community 77 - "Z.Design Showcase — Agent-Anweisungen"
Cohesion: 0.22
Nodes (8): Control-Tower-MCP, Control-Tower-MCP nutzen, Deploy-Regeln, MCP-Server-Verwaltung, Test-Kommando (aus projects.yml), Verfügbare MCP-Tools, Wichtige Regeln, Z.Design Showcase — Agent-Anweisungen

### Community 78 - "ADR 0001 — feature/feature-001 Branch: behalten, nicht mergen"
Cohesion: 0.29
Nodes (6): ADR 0001 — feature/feature-001 Branch: behalten, nicht mergen, Begründung, Entscheidung, Konsequenzen, Kontext, Untersuchung (04.07.2026)

### Community 79 - "eval-memory-guards.ts"
Cohesion: 0.57
Nodes (6): check(), main(), sanitizePayload(), recordCounterEvidence(), isAuthorized(), resolveAuth()

### Community 80 - "toggle-group.tsx"
Cohesion: 0.43
Nodes (5): ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 81 - "Gallery.tsx"
Cohesion: 0.38
Nodes (6): extractSwatches(), Gallery(), GalleryCard(), GalleryProject, ProjectsResponse, statusBadgeClass()

### Community 82 - "dev.sh"
Cohesion: 0.57
Nodes (5): log_step_end(), log_step_start(), dev.sh script, start_mini_services(), wait_for_service()

### Community 84 - "alert.tsx"
Cohesion: 0.50
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 85 - "input-otp.tsx"
Cohesion: 0.40
Nodes (3): InputOTP(), InputOTPGroup(), InputOTPSlot()

### Community 86 - "StatsBar.tsx"
Cohesion: 0.50
Nodes (3): formatTokens(), StatsBar(), StatsSnapshot

### Community 87 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): __dirname, eslintConfig, __filename

### Community 88 - "route.ts"
Cohesion: 0.83
Nodes (3): applyRuleBasedEnhancements(), getZAI(), POST()

## Knowledge Gaps
- **575 isolated node(s):** `build.sh script`, `NEXT_TELEMETRY_DISABLED`, `start.sh script`, `$schema`, `style` (+570 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **82 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `TopToolbar.tsx`, `DesignSystemManager.tsx`, `ZDesignApp.tsx`, `ChatPanel.tsx`, `sidebar.tsx`, `use-toast.ts`, `props-editors.tsx`, `alert-dialog.tsx`, `react`, `context-menu.tsx`, `carousel.tsx`, `form.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `StyleSelector.tsx`, `toggle-group.tsx`, `alert.tsx`, `input-otp.tsx`, `hover-card.tsx`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `@radix-ui/react-avatar`, `@radix-ui/react-collapsible`, `@radix-ui/react-context-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-label`, `@radix-ui/react-popover`, `zip-generator.ts`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slider`, `@radix-ui/react-slot`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-toast`, `@radix-ui/react-toggle`, `@radix-ui/react-tooltip`, `react-day-picker`, `react-dom`, `devDependencies`, `react-hook-form`, `react-markdown`, `react-resizable-panels`, `@reactuses/core`, `recharts`, `sharp`, `socket.io-client`, `sonner`, `tailwind-merge`, `tailwindcss-animate`, `@tanstack/react-query`, `@tanstack/react-table`, `@types/jszip`, `react`, `uuid`, `vaul`, `z-ai-web-dev-sdk`, `zustand`, `class-variance-authority`, `clsx`, `cmdk`, `date-fns`, `@dnd-kit/core`, `@dnd-kit/utilities`, `embla-carousel-react`, `framer-motion`, `@hookform/resolvers`, `html-pdf-node`, `input-otp`, `jsonrepair`, `lucide-react`, `@mdxeditor/editor`, `next`, `next-auth`, `next-intl`, `next-themes`, `prisma`, `@prisma/client`, `puppeteer`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-aspect-ratio`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Why does `deriveDesignDirection()` connect `generate.ts` to `fusion-pipeline.ts`, `art-direction.ts`, `ChatPanel.tsx`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **What connects `build.sh script`, `NEXT_TELEMETRY_DISABLED`, `start.sh script` to the rest of the system?**
  _581 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `patch-proposer.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05860805860805861 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05251141552511415 - nodes in this community are weakly interconnected._
- **Should `health-check.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.057971014492753624 - nodes in this community are weakly interconnected._