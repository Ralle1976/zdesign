# Graph Report - Z.Design  (2026-08-01)

## Corpus Check
- 333 files · ~2,237,177 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2463 nodes · 5298 edges · 194 communities (112 shown, 82 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a4308365`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- registry.ts
- patch-proposer.ts
- types.ts
- accessibility.ts
- route.ts
- zip-generator.ts
- health-check.ts
- cn
- DesignRenderer.tsx
- props-editors.tsx
- patch-disclosure.ts
- design.ts
- orchestra.ts
- route.ts
- sidebar.tsx
- ChatPanel.tsx
- compilerOptions
- TopToolbar.tsx
- use-toast.ts
- fusion-pipeline.ts
- negative-memory.ts
- server.ts
- index.ts
- devDependencies
- useZDesignStore
- call-text-llm.ts
- provider-config.ts
- DesignSystemManager.tsx
- art-direction.ts
- shared.tsx
- db.ts
- alert-dialog.tsx
- optimizer.ts
- ZDesignApp.tsx
- multi-pass-pipeline.ts
- fresh-images.ts
- generateImageWithProvider
- PresenceBar.tsx
- skill-memory.ts
- react
- panelists.ts
- Contributing to Z.Design
- utils.ts
- anti-slop.ts
- systems.ts
- GLOBALE REGELN (Auto-synced v2)
- components.json
- dependencies
- route.ts
- menubar.tsx
- images-first.ts
- style-dna.ts
- context-menu.tsx
- dropdown-menu.tsx
- HtmlArtifactPreview.tsx
- reference-rag.ts
- Diverse verticals — real generated imagery
- route.ts
- lessons.ts
- gepa-extended.ts
- creative-diversity.ts
- Z.Design — Autonomous AI Design Agent
- Workflow — Step by Step
- carousel.tsx
- speech-recognition.d.ts
- parseAIResponse
- health-check.ts
- fallback-templates.ts
- registry.ts
- run-visible-design-tests.mjs
- auth.ts
- index.ts
- form.tsx
- route.ts
- drawer.tsx
- package.json
- index.ts
- command.tsx
- context-manager.ts
- api-registry.ts
- xai-direct.ts
- Z.Design Showcase — Agent-Anweisungen
- retry-failed-tests.mjs
- route.ts
- _fresh_bakery.mjs
- page.tsx
- toggle-group.tsx
- Gallery.tsx
- pipeline-integration.mjs
- dev.sh
- streamClient.ts
- route.ts
- route.ts
- route.ts
- alert.tsx
- StatsBar.tsx
- eslint.config.mjs
- route.ts
- route.ts
- route.ts
- image-gen.ts
- mini-services-start.sh
- test-pdf-export.ts
- error.tsx
- global-error.tsx
- build.sh
- mini-services-build.sh
- mini-services-install.sh
- start.sh
- clsx
- cmdk
- date-fns
- publish-showcase.sh
- @dnd-kit/core
- DesignSystemManager.tsx
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
- patch-disclosure.ts
- @dnd-kit/sortable
- DiversityTracker
- command.tsx
- provider.ts
- route.ts
- _test_exploded.mjs
- _test_video_exploded.mjs

## God Nodes (most connected - your core abstractions)
1. `cn()` - 226 edges
2. `useZDesignStore` - 48 edges
3. `POST()` - 43 edges
4. `useI18n()` - 42 edges
5. `ProviderRegistry` - 31 edges
6. `Button()` - 30 edges
7. `POST()` - 29 edges
8. `ProviderConfig` - 24 edges
9. `recallAntiPatterns()` - 23 edges
10. `AIProviderAdapter` - 23 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --indirect_call--> `callTextLLM()`  [INFERRED]
  Projekt/src/app/api/design/agent/route.ts → Projekt/src/lib/ai/call-text-llm.ts
- `AlertDialogOverlay()` --calls--> `cn()`  [EXTRACTED]
  Projekt/src/components/ui/alert-dialog.tsx → Projekt/src/lib/utils.ts
- `AlertDialogContent()` --calls--> `cn()`  [EXTRACTED]
  Projekt/src/components/ui/alert-dialog.tsx → Projekt/src/lib/utils.ts
- `AlertDialogHeader()` --calls--> `cn()`  [EXTRACTED]
  Projekt/src/components/ui/alert-dialog.tsx → Projekt/src/lib/utils.ts
- `AlertDialogFooter()` --calls--> `cn()`  [EXTRACTED]
  Projekt/src/components/ui/alert-dialog.tsx → Projekt/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (194 total, 82 thin omitted)

### Community 0 - "registry.ts"
Cohesion: 0.09
Nodes (21): AnthropicProvider, MINIMAX_MODELS, MinimaxProvider, OpenAIProvider, OpenRouterProvider, DEFAULT_PROVIDERS, NOTE: import the persona-routing LEAF directly (not the fusion barrel) to avoid, AIProviderAdapter (+13 more)

### Community 1 - "patch-proposer.ts"
Cohesion: 0.13
Nodes (24): Correlation, auditProposal(), conceptProposal(), ensureDir(), genericProposal(), getPendingPatches(), makePatch(), modelProposal() (+16 more)

### Community 2 - "types.ts"
Cohesion: 0.05
Nodes (53): POST(), callGemini(), callGeminiMultimodal(), callGeminiVision(), doRequest(), extractText(), GeminiCallOptions, getKey() (+45 more)

### Community 3 - "accessibility.ts"
Cohesion: 0.06
Nodes (62): AccessibilityAuditResult, auditAccessibility(), AuditFinding, AuditSeverity, checkAltText(), checkContrast(), CheckCtx, checkFocusVisible() (+54 more)

### Community 4 - "route.ts"
Cohesion: 0.08
Nodes (58): acceptHtmlDoc(), autoCloseHtml(), isValidHtmlDoc(), lintToRefinements(), POST(), TraceStep, acceptHtmlDoc(), autoCloseHtml() (+50 more)

### Community 5 - "zip-generator.ts"
Cohesion: 0.07
Nodes (44): jszip, jszip, GET(), DesignNode, designNodeToHTML(), escapeHtml(), ExportRequestBody, generateFullHTML() (+36 more)

### Community 6 - "health-check.ts"
Cohesion: 0.09
Nodes (42): buildManifest(), CapabilitiesManifest, CapabilityFeature, CapabilityProvider, CapabilityRouteGroup, detectFeatures(), discoverProviders(), GET() (+34 more)

### Community 7 - "cn"
Cohesion: 0.06
Nodes (56): BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator(), Card(), CardAction() (+48 more)

### Community 8 - "DesignRenderer.tsx"
Cohesion: 0.07
Nodes (35): AnnotationPin, AnnotationPinProps, CanvasToolbar, DesignRenderer, DesignRendererProps, NodeRenderer, NodeRendererProps, getDefaultStyle() (+27 more)

### Community 9 - "props-editors.tsx"
Cohesion: 0.12
Nodes (20): Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), Slider(), BorderEditor(), ColorInput(), ContentEditor() (+12 more)

### Community 10 - "patch-disclosure.ts"
Cohesion: 0.15
Nodes (16): PatchDisclosable, atLevel(), Disclosable, DisclosureLevel, listForIndex(), loadForTrigger(), pickAccentLabel(), recipeAsDisclosable() (+8 more)

### Community 11 - "design.ts"
Cohesion: 0.07
Nodes (38): NewProjectDialogProps, MODE_ICONS, StatusBarProps, VIEWPORT_ICONS, CapabilitiesManifest, BUILT_IN_PROVIDERS, defaultDesignTree, defaultGenerationProgress (+30 more)

### Community 12 - "orchestra.ts"
Cohesion: 0.10
Nodes (24): GET(), CreativeRequestBody, AgentCallError, CreativeOrchestra, DEFAULT_CONFIG, ALL_SKILL_PACKS, CREATIVE_DIRECTOR_SKILL, CRITIQUE_AGENT_SKILL (+16 more)

### Community 13 - "route.ts"
Cohesion: 0.15
Nodes (17): autoCloseHtml(), BatchBody, BatchDesignResult, BatchProgress, batchStore, buildBriefPrompt(), DesignBrief, mapWithConcurrency() (+9 more)

### Community 14 - "sidebar.tsx"
Cohesion: 0.20
Nodes (19): generateHeroImage(), buildHarmonizedImagePrompt(), buildImagePrompts(), buildThaiFoodPrompts(), GeneratedImage, generateImageMinimax(), generateImagesMinimax(), isMinimaxImageConfigured() (+11 more)

### Community 15 - "ChatPanel.tsx"
Cohesion: 0.15
Nodes (28): Progress(), AccessibilityScanner(), AnnotationsPanel(), CanvasArea(), GENERATION_STEPS, GenerationProgressIndicator(), getStepIndex(), QualityBadge() (+20 more)

### Community 16 - "compilerOptions"
Cohesion: 0.05
Nodes (36): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+28 more)

### Community 17 - "TopToolbar.tsx"
Cohesion: 0.13
Nodes (22): Badge(), badgeVariants, Dialog(), DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay() (+14 more)

### Community 18 - "use-toast.ts"
Cohesion: 0.09
Nodes (28): geistMono, geistSans, metadata, Providers(), Toast, ToastAction, ToastActionElement, ToastClose (+20 more)

### Community 19 - "fusion-pipeline.ts"
Cohesion: 0.12
Nodes (28): ChatRequestBody, POST(), CRAFT, DEFAULTS, deriveDesignDirection(), DesignDirective, DirectionDef, DIRECTIONS (+20 more)

### Community 20 - "negative-memory.ts"
Cohesion: 0.16
Nodes (16): Tabs(), TabsContent(), TabsList(), TabsTrigger(), PropsPanel(), formatTokens(), StatsBar(), StatsSnapshot (+8 more)

### Community 21 - "server.ts"
Cohesion: 0.11
Nodes (29): check(), main(), POST(), sanitizePayload(), recordCounterEvidence(), ADMIN_CONTEXT, apiBase(), apiFetch() (+21 more)

### Community 22 - "index.ts"
Cohesion: 0.35
Nodes (11): POST(), fetchWithTimeout(), pingGemini(), pingMinimax(), pingOpenRouter(), pingProvider(), pingReplicate(), pingXai() (+3 more)

### Community 23 - "devDependencies"
Cohesion: 0.06
Nodes (31): bun-types, eslint, eslint-config-next, devDependencies, bun-types, eslint, eslint-config-next, tailwindcss (+23 more)

### Community 24 - "useZDesignStore"
Cohesion: 0.11
Nodes (12): Checkbox(), HoverCardContent(), RadioGroup(), RadioGroupItem(), ResizableHandle(), ResizablePanel(), ResizablePanelGroup(), Switch() (+4 more)

### Community 25 - "call-text-llm.ts"
Cohesion: 0.19
Nodes (16): clamp(), critiquePrompt(), critiqueRenderedGemini(), RenderOpts, VisionCritique, callZai(), callZaiVision(), doRequest() (+8 more)

### Community 26 - "provider-config.ts"
Cohesion: 0.11
Nodes (34): ENV_PATH, GET(), POST(), upsertEnvEntry(), GET(), GET(), POST(), bustTextLLMConfigCache() (+26 more)

### Community 27 - "DesignSystemManager.tsx"
Cohesion: 0.10
Nodes (33): ScrollArea(), ScrollBar(), Select(), SelectContent(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton() (+25 more)

### Community 28 - "art-direction.ts"
Cohesion: 0.13
Nodes (21): POST(), POST(), callTextLLM(), MultiPassInput, ExperienceMode, ArtBrief, atmosphereGuidance(), briefLabel() (+13 more)

### Community 29 - "shared.tsx"
Cohesion: 0.15
Nodes (13): buildInjectCss(), DEFAULT_SLIDERS, HtmlArtifactPreview(), HtmlArtifactPreviewProps, RefinePopover, scaleBox(), SliderRowProps, SliderState (+5 more)

### Community 30 - "db.ts"
Cohesion: 0.16
Nodes (15): Separator(), AccessibilityScannerProps, CATEGORY_CONFIG, ScoreCircle(), SEVERITY_CONFIG, A11yCategory, A11ySeverity, calculateContrastRatio() (+7 more)

### Community 31 - "alert-dialog.tsx"
Cohesion: 0.10
Nodes (18): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogTitle() (+10 more)

### Community 32 - "optimizer.ts"
Cohesion: 0.18
Nodes (16): main(), callFusionText(), extractText(), DEFAULT_BRIEFS, extractWeaknessSignal(), FusionCall, generatePrompt(), GepaResult (+8 more)

### Community 33 - "ZDesignApp.tsx"
Cohesion: 0.21
Nodes (16): auditCorrelations(), compositeOf(), confidenceFor(), correlationsForField(), findCorrelations(), getTopInsights(), insightLine(), isNum() (+8 more)

### Community 34 - "multi-pass-pipeline.ts"
Cohesion: 0.13
Nodes (25): getExperiencePrompt(), countVisibleImages(), ensureDesignImages(), injectHeroOnly(), applyFreshImages(), applyImageHarmonyCss(), imageMapToPromptBlock(), assembleDocument() (+17 more)

### Community 35 - "fresh-images.ts"
Cohesion: 0.25
Nodes (12): FusionPipeline, safeJsonParse(), withTimeout(), describeRouting(), isUsable(), PERSONA_MODEL_MAP, PersonaPreference, personaPreferredModel() (+4 more)

### Community 36 - "generateImageWithProvider"
Cohesion: 0.15
Nodes (17): pickSize(), POST(), VALID_SIZES, deepinfraImage(), enrichImagePrompt(), falImage(), generateImageWithProvider(), IMAGE_PROVIDER_CATALOGUE (+9 more)

### Community 37 - "PresenceBar.tsx"
Cohesion: 0.13
Nodes (16): CursorOverlay(), CursorOverlayProps, Avatar, AvatarProps, ConnectionDot, ConnectionDotProps, orderUsers(), OverflowBadge (+8 more)

### Community 38 - "skill-memory.ts"
Cohesion: 0.31
Nodes (9): appendLessonHistory(), asStringArray(), clamp(), dedupe(), loadApprovedRecipeForTopic(), parseRecipe(), patchRecipe(), proposeRecipe() (+1 more)

### Community 39 - "react"
Cohesion: 0.12
Nodes (17): react, ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload() (+9 more)

### Community 40 - "panelists.ts"
Cohesion: 0.15
Nodes (16): CallFn, ROLE_LABEL, runCritiqueTheater(), TheaterResult, a11yPrompt(), brandPrompt(), briefLine(), CONCEPT_NEUTRAL_SENTINEL (+8 more)

### Community 41 - "Contributing to Z.Design"
Cohesion: 0.11
Nodes (17): Adding a Design System (DESIGN.md), Adding a Panelist, Adding a Skill (SKILL.md), Adding an Audit, Adding an MCP Tool, Commit style, Contributing to Z.Design, Development workflow (+9 more)

### Community 42 - "utils.ts"
Cohesion: 0.29
Nodes (6): Popover(), PopoverContent(), PopoverTrigger(), STYLE_DIRECTIONS, StyleSelectorProps, StyleDirection

### Community 43 - "anti-slop.ts"
Cohesion: 0.16
Nodes (19): AI_DEFAULT_INDIGO, clip(), declarationLaundersIndigo(), detectBlueCyanTrustGradient(), escapeRe(), FILLER_PATTERNS, GLOBAL_THEME_ATTRIBUTES, INVENTED_METRIC_PATTERNS (+11 more)

### Community 44 - "systems.ts"
Cohesion: 0.18
Nodes (17): channelLin(), CONTRAST_CHECK_RESULTS, ContrastCheckResult, contrastRatio(), DESIGN_SYSTEMS, enforceTextContrast(), fold(), hexToRgb() (+9 more)

### Community 45 - "GLOBALE REGELN (Auto-synced v2)"
Cohesion: 0.11
Nodes (17): Anti-AI-Slop, Auto-Commit, Autonomie-Stufe 3 (Default), Code-Architektur-Hygiene, 🧠 Geteiltes Agent-Gedächtnis (Vault), GLOBALE REGELN (Auto-synced v2), Nach einer längeren Session, Projekt (+9 more)

### Community 46 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 47 - "dependencies"
Cohesion: 0.12
Nodes (17): class-variance-authority, dependencies, class-variance-authority, @radix-ui/react-accordion, @radix-ui/react-checkbox, @radix-ui/react-menubar, @radix-ui/react-navigation-menu, @radix-ui/react-toggle-group (+9 more)

### Community 48 - "route.ts"
Cohesion: 0.20
Nodes (15): contrastRatioServer(), countNodes(), DesignNode, evaluateAccessibility(), evaluateCompleteness(), evaluateCSS(), evaluateResponsiveness(), evaluateSemantics() (+7 more)

### Community 49 - "menubar.tsx"
Cohesion: 0.12
Nodes (11): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarRadioItem(), MenubarSeparator(), MenubarShortcut() (+3 more)

### Community 50 - "images-first.ts"
Cohesion: 0.22
Nodes (14): GET(), POST(), GET(), FeedbackFilter, feedbackPath(), FeedbackStats, getFeedbackStats(), normalize() (+6 more)

### Community 51 - "style-dna.ts"
Cohesion: 0.13
Nodes (20): POST(), COLOR_PALETTES, ColorPalette, generateStyleDNA(), getColorPalette(), getTypographyPreset(), STYLE_PRESETS, styleDNAToPrompt() (+12 more)

### Community 52 - "context-menu.tsx"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 53 - "dropdown-menu.tsx"
Cohesion: 0.12
Nodes (17): DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut() (+9 more)

### Community 54 - "HtmlArtifactPreview.tsx"
Cohesion: 0.35
Nodes (8): POST(), isSttConfigured(), TranscribeOptions, transcribeViaManualMultipart(), transcribeViaOpenRouter(), isZaiSttConfigured(), transcribeViaZai(), ZaiTranscribeOptions

### Community 55 - "reference-rag.ts"
Cohesion: 0.23
Nodes (12): buildReferenceAnchor(), extractStyleAnchor(), ReferenceAnchor, loadReferenceHtml(), REFS_DIR, pickTemplate(), templateById(), TEMPLATES (+4 more)

### Community 56 - "Diverse verticals — real generated imagery"
Cohesion: 0.12
Nodes (15): Blütenwerk — Floristik, Casa Verde — Boutique Jungle Lodge, Craft & trade verticals (generated WITH the memory system), Diverse verticals — real generated imagery, Ember & Smoke — Cocktail Bar, Fougère — Botanical Studio, Holzwerk Manufaktur — Tischlerei, How these are made (+7 more)

### Community 57 - "route.ts"
Cohesion: 0.26
Nodes (11): appendPatch(), applyPatch(), approvePatch(), ensureDir(), patchesPath(), processPendingPatches(), readPatches(), rejectPatch() (+3 more)

### Community 58 - "lessons.ts"
Cohesion: 0.24
Nodes (9): DATA_DIR, ensureDataDir(), LESSONS_PATH, LessonSignal, Outcome, readSignals(), reflect(), ScoredPattern (+1 more)

### Community 59 - "gepa-extended.ts"
Cohesion: 0.21
Nodes (13): applyPrompt(), BaseRunFn, GepaCall, GepaTarget, GepaTargetResult, judgePrompt(), mutatePrompt(), parseJudgeScore() (+5 more)

### Community 60 - "creative-diversity.ts"
Cohesion: 0.18
Nodes (6): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 61 - "Z.Design — Autonomous AI Design Agent"
Cohesion: 0.14
Nodes (12): Architecture — How Z.Design Works, File-Based Extensibility, System Architecture, Technology Stack, The Design Pipeline (End-to-End), Architecture, How It Works (30-second version), Key Features (+4 more)

### Community 62 - "Workflow — Step by Step"
Cohesion: 0.14
Nodes (13): 1. Start Z.Design, 2. Enable Agent Mode, 3. Type Your Prompt, 4. Choose a Concept, 5. Wait for Generation (~5 min), 6. Explore the Result, 7. Iterate, 8. Export (+5 more)

### Community 63 - "carousel.tsx"
Cohesion: 0.20
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 64 - "speech-recognition.d.ts"
Cohesion: 0.14
Nodes (8): SpeechRecognition, SpeechRecognitionAlternative, SpeechRecognitionConstructor, SpeechRecognitionErrorEvent, SpeechRecognitionEvent, SpeechRecognitionResult, SpeechRecognitionResultList, Window

### Community 65 - "parseAIResponse"
Cohesion: 0.24
Nodes (9): AnalyzeRequestBody, buildGenerationPrompt(), GenerateRequestBody, getZAI(), POST(), ProjectType, parseAIResponse(), repairLLMJson() (+1 more)

### Community 66 - "health-check.ts"
Cohesion: 0.22
Nodes (9): callXai(), doRequest(), extractText(), getApiKey(), getBase(), sleep(), XAI_MODELS, XaiCallOptions (+1 more)

### Community 67 - "fallback-templates.ts"
Cohesion: 0.26
Nodes (12): buildDashboardFallback(), buildDefaultFallback(), buildLandingPageFallback(), buildMobileOnboardingFallback(), buildPitchDeckFallback(), buildPortfolioFallback(), buildPricingFallback(), buildTopicDesign() (+4 more)

### Community 68 - "registry.ts"
Cohesion: 0.28
Nodes (12): IGNORE_FILES, listAvailable(), listDirectory(), looksLikePanelist(), PROJECT_ROOT, RegistryEntry, RegistrySnapshot, RegistryType (+4 more)

### Community 69 - "run-visible-design-tests.mjs"
Cohesion: 0.26
Nodes (10): api(), buildIndex(), consumeSSE(), createProject(), __dirname, main(), OUT_DIR, ROOT (+2 more)

### Community 70 - "auth.ts"
Cohesion: 0.21
Nodes (8): handler, POST(), adapter, AdapterUser, authOptions, hashPassword(), providers, SCRYPT_PARAMS

### Community 71 - "index.ts"
Cohesion: 0.33
Nodes (7): getTranslations(), I18nContext, I18nContextType, I18nProvider(), Locale, TranslationKey, translations

### Community 72 - "form.tsx"
Cohesion: 0.22
Nodes (10): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItemContext, FormItemContextValue, FormLabel(), FormMessage() (+2 more)

### Community 73 - "route.ts"
Cohesion: 0.04
Nodes (36): main(), GET(), GET(), since24h(), BUILT_IN_TEMPLATES, ConsolidationCandidate, ConsolidationStatus, listConsolidation() (+28 more)

### Community 74 - "drawer.tsx"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 75 - "package.json"
Cohesion: 0.20
Nodes (9): cors, dependencies, cors, socket.io, name, scripts, dev, version (+1 more)

### Community 76 - "index.ts"
Cohesion: 0.20
Nodes (6): CollabUser, CURSOR_COLORS, httpServer, io, rooms, RoomState

### Community 77 - "command.tsx"
Cohesion: 0.30
Nodes (12): getActiveImageProvider(), FreshImageOpts, DesignPalette, buildImagePrompt(), extractImageContexts(), getDomainStyle(), ImageReplacement, isFreshTarget() (+4 more)

### Community 78 - "context-manager.ts"
Cohesion: 0.44
Nodes (8): buildContext(), ChatTurn, estimateTokens(), estimateTurns(), formatForModel(), ManagedContext, shouldTrim(), trimHistory()

### Community 79 - "api-registry.ts"
Cohesion: 0.33
Nodes (8): API_ROOT, apiManifest(), ApiRouteInfo, extractDescription(), extractMethods(), getApiRoutes(), METHODS, walk()

### Community 80 - "xai-direct.ts"
Cohesion: 0.08
Nodes (27): Avatar(), AvatarFallback(), AvatarImage(), Button(), Textarea(), FilterMode, ChatPanel(), collectPendingImages() (+19 more)

### Community 81 - "Z.Design Showcase — Agent-Anweisungen"
Cohesion: 0.22
Nodes (8): Control-Tower-MCP, Control-Tower-MCP nutzen, Deploy-Regeln, MCP-Server-Verwaltung, Test-Kommando (aus projects.yml), Verfügbare MCP-Tools, Wichtige Regeln, Z.Design Showcase — Agent-Anweisungen

### Community 82 - "retry-failed-tests.mjs"
Cohesion: 0.29
Nodes (6): api(), __dirname, report, reportPath, RETRY, runTest()

### Community 83 - "route.ts"
Cohesion: 0.48
Nodes (6): convertFigmaLikeToDesignTree(), importFromFigma(), importFromJSON(), importFromURL(), ImportRequestBody, POST()

### Community 84 - "_fresh_bakery.mjs"
Cohesion: 0.29
Nodes (6): elapsed, hasFeatures, hasFonts, hasFooter, hasTestimonials, start

### Community 85 - "page.tsx"
Cohesion: 0.33
Nodes (5): DesignEntry, DESIGNS, metadata, readMetrics(), ShowcasePage()

### Community 86 - "toggle-group.tsx"
Cohesion: 0.24
Nodes (15): appendRecord(), autoRevertIfRegressed(), ensureDir(), evaluatePatch(), OutcomeRecord, outcomesPath(), PatchOutcome, readRecords() (+7 more)

### Community 87 - "Gallery.tsx"
Cohesion: 0.38
Nodes (6): extractSwatches(), Gallery(), GalleryCard(), GalleryProject, ProjectsResponse, statusBadgeClass()

### Community 88 - "pipeline-integration.mjs"
Cohesion: 0.48
Nodes (6): fail(), main(), parseSseLines(), pass(), results, timed()

### Community 89 - "dev.sh"
Cohesion: 0.57
Nodes (5): log_step_end(), log_step_start(), dev.sh script, start_mini_services(), wait_for_service()

### Community 90 - "streamClient.ts"
Cohesion: 0.40
Nodes (5): jsonFallback(), StageEvent, streamChat(), StreamChatInput, StreamChatResult

### Community 91 - "route.ts"
Cohesion: 0.43
Nodes (5): getInteractiveSpecs(), injectProductRuntime(), InteractiveSpecs, isInteractiveProductBrief(), ConceptSpecs

### Community 94 - "alert.tsx"
Cohesion: 0.50
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 96 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): __dirname, eslintConfig, __filename

### Community 97 - "route.ts"
Cohesion: 0.83
Nodes (3): applyRuleBasedEnhancements(), getZAI(), POST()

### Community 98 - "route.ts"
Cohesion: 0.21
Nodes (14): AssistantAction, AssistantActionType, AssistantContext, AssistantResponse, buildSystemPrompt(), CANVAS_MODE_VALUES, EXPORT_VALUES, extractJsonObject() (+6 more)

### Community 100 - "route.ts"
Cohesion: 0.19
Nodes (14): creativeBlockFor(), CreativeMode, hash32(), LAYOUT_ARCHETYPES, LayoutArchetype, MOTION_RECIPES, MotionFamily, MotionRecipe (+6 more)

### Community 116 - "DesignSystemManager.tsx"
Cohesion: 0.16
Nodes (13): COLOR_CATEGORIES, DEFAULT_BORDER_RADIUS, DEFAULT_SHADOWS, DEFAULT_SPACING, DEFAULT_TYPOGRAPHY, DesignSystemManager(), DesignSystemManagerProps, FONT_FAMILIES (+5 more)

### Community 185 - "patch-disclosure.ts"
Cohesion: 0.41
Nodes (11): conf(), level0(), level1(), level2(), loadPatchDetail(), patchesToDisclosable(), patchIndex(), proposalFields() (+3 more)

### Community 188 - "DiversityTracker"
Cohesion: 0.22
Nodes (5): DesignFingerprint, DiversityTracker, fingerprint(), isTooSimilar(), paletteJaccard()

### Community 189 - "command.tsx"
Cohesion: 0.20
Nodes (8): Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator(), CommandShortcut()

### Community 190 - "provider.ts"
Cohesion: 0.33
Nodes (6): callLLM(), CallOpts, getProvider(), isConfigured(), LLMProvider, ZaiProvider

### Community 191 - "route.ts"
Cohesion: 0.50
Nodes (4): POST(), sseLine(), STAGE_LABELS, StreamRequestBody

## Knowledge Gaps
- **610 isolated node(s):** `build.sh script`, `NEXT_TELEMETRY_DISABLED`, `start.sh script`, `start`, `elapsed` (+605 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **82 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `props-editors.tsx`, `ChatPanel.tsx`, `TopToolbar.tsx`, `use-toast.ts`, `negative-memory.ts`, `useZDesignStore`, `DesignSystemManager.tsx`, `db.ts`, `alert-dialog.tsx`, `react`, `utils.ts`, `menubar.tsx`, `context-menu.tsx`, `dropdown-menu.tsx`, `creative-diversity.ts`, `command.tsx`, `carousel.tsx`, `form.tsx`, `drawer.tsx`, `xai-direct.ts`, `alert.tsx`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `next-intl`, `next-themes`, `prisma`, `@prisma/client`, `zip-generator.ts`, `puppeteer`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-avatar`, `@radix-ui/react-collapsible`, `@radix-ui/react-context-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-label`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slider`, `devDependencies`, `@radix-ui/react-slot`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-toast`, `@radix-ui/react-toggle`, `@radix-ui/react-tooltip`, `react-day-picker`, `react-dom`, `react-hook-form`, `react-markdown`, `react-resizable-panels`, `@reactuses/core`, `recharts`, `sharp`, `socket.io-client`, `react`, `sonner`, `tailwind-merge`, `tailwindcss-animate`, `@tanstack/react-query`, `@tanstack/react-table`, `@types/jszip`, `uuid`, `vaul`, `z-ai-web-dev-sdk`, `zustand`, `@dnd-kit/sortable`, `clsx`, `cmdk`, `date-fns`, `@dnd-kit/core`, `@dnd-kit/utilities`, `embla-carousel-react`, `framer-motion`, `@hookform/resolvers`, `html-pdf-node`, `input-otp`, `jsonrepair`, `lucide-react`, `@mdxeditor/editor`, `next`, `next-auth`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Why does `Concept` connect `art-direction.ts` to `multi-pass-pipeline.ts`, `route.ts`, `design.ts`, `xai-direct.ts`, `shared.tsx`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **What connects `build.sh script`, `NEXT_TELEMETRY_DISABLED`, `start.sh script` to the rest of the system?**
  _616 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `registry.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08596491228070176 - nodes in this community are weakly interconnected._
- **Should `patch-proposer.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13230769230769232 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.053923541247484906 - nodes in this community are weakly interconnected._