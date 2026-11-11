# Graph Report - reverse-cloud  (2026-11-09)

## Corpus Check
- 379 files · ~176,559 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 47 file(s) not represented in the graph (top: (none) 38, .example 3, .ai 1)

## Summary
- 2037 nodes · 5280 edges · 111 communities (96 shown, 15 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 93 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2b2f242a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- chat_agent.py
- get_settings
- content/actions.ts
- web/package.json
- lucide-react
- test_outbox_db.py
- instrumentation-client.ts
- next-intl
- clients/page.tsx
- Link
- outbox.py
- Reverse Cloud manual hosting and operations guide
- projects/actions.ts
- Badge
- test_chat_agent.py
- calcom.ts
- email/index.ts
- httpx
- steps
- env
- roles.ts
- test_timeout.py
- deploy.sh
- portal/types.ts
- schedule-view.tsx
- Settings
- payments/actions.ts
- staff/page.tsx
- mock-stream.ts
- test_transcript_review.py
- leads/route.ts
- portal-server.ts
- steps
- OllamaEmbedder
- portal/layout.tsx
- createClient
- portal/index.ts
- test_guardrails.py
- ingest.py
- test_cost_report.py
- next
- chat/route.ts
- money.ts
- auth/routes.ts
- routes.py
- meetings/actions.ts
- compilerOptions
- components.json
- vitest
- accept-invite/page.tsx
- portfolio/[slug]/page.tsx
- services/[slug]/page.tsx
- guardrails.py
- ratelimit.ts
- blog-catalog.ts
- book/route.ts
- wizard-container.tsx
- estimate_project
- ref_node_crypto
- Runbook: Database Backup and Restore Drill
- web
- scripts
- renovate.json
- confirm-booking/route.ts
- main.py
- badge.tsx
- server-only
- (public)/page.tsx
- signOut
- knowledge-sync
- tunnel
- server.ts
- projects/page.tsx
- admin/payments/page.tsx
- healthcheck
- test_reindex_knowledge.py
- public-origin.ts
- Payment gateway research
- Authentication setup
- Runbook: AI Service Kill Switch
- Connection
- §13 Pre-Launch & Go-Live Verification Checklist
- Secret Rotation Log & Execution Checklist
- services
- ai
- ai-monitor
- Development
- i18n.test.mjs
- Chat API Contract
- Runbook: Branch Protection & CI Quality Gates
- ollama
- deploy
- deploy
- Phase 5 Google authentication review
- environment
- Contact leads and notifications
- pull_request_template.md
- watch-activity.sh
- Architecture
- AGENTS.md
- postcss.config.mjs
- 00-plan.md
- api-estimate.md
- add-staff.md
- calcom.md
- phase-4-end-to-end.md
- dockerfile-runtime-permissions.sh
- pnpm-workspace.yaml

## God Nodes (most connected - your core abstractions)
1. `next` - 93 edges
2. `requirePermission()` - 69 edges
3. `next-intl` - 63 edges
4. `Link` - 60 edges
5. `createClient()` - 56 edges
6. `routing` - 55 edges
7. `vitest` - 48 edges
8. `get_settings()` - 38 edges
9. `lucide-react` - 37 edges
10. `Settings` - 36 edges

## Surprising Connections (you probably didn't know these)
- `5. Admin provisioning` --references--> `admin()`  [INFERRED]
  docs/runbooks/google-oauth.md → services/ai/tests/integration/test_outbox_db.py
- `Supabase and Google login` --references--> `admin()`  [INFERRED]
  README.md → services/ai/tests/integration/test_outbox_db.py
- `Scheduling API` --references--> `start()`  [INFERRED]
  docs/api/scheduling.md → apps/web/tests/chat-stream.test.ts
- `ProjectProgressBarProps` --references--> `PortalProject`  [EXTRACTED]
  apps/web/src/components/portal/project-progress-bar.tsx → apps/web/src/lib/portal/types.ts
- `_chat_events()` --uses--> `TextChunk`  [INFERRED]
  services/ai/app/api/v1/routes.py → services/ai/app/agents/chat_agent.py

## Import Cycles
- None detected.

## Communities (111 total, 15 thin omitted)

### Community 0 - "chat_agent.py"
Cohesion: 0.05
Nodes (26): create_chat_agent(), resolve_model(), AgentDeps, Embedder, hybrid_search(), get_estimate(), request_human_handoff(), format_search_results() (+18 more)

### Community 1 - "get_settings"
Cohesion: 0.07
Nodes (17): get_settings(), resolved_gemini_api_key(), resolved_gemini_embedding_model(), resolved_gemini_model(), configured_embedder(), OpenAIEmbedder, ingest_entries(), load_entries() (+9 more)

### Community 2 - "content/actions.ts"
Cohesion: 0.16
Nodes (41): actionError(), actionSuccess(), deleteBlogPost(), deleteFaq(), deletePortfolio(), deletePortfolioMedia(), deleteSetting(), localeFrom() (+33 more)

### Community 3 - "web/package.json"
Cohesion: 0.05
Nodes (45): dependencies, clsx@^2.1.1, lucide-react@^0.475.0, next@16.4.5, next-intl@4.14.9, react@19.3.0, react-dom@19.3.0, tailwind-merge@^3.0.2 (+37 more)

### Community 4 - "lucide-react"
Cohesion: 0.10
Nodes (32): ConfirmationCard(), checkAuth(), ConfirmationCardProps, ConfirmedBookingInfo, EstimateCard(), EstimateCardProps, FallbackState(), FallbackStateProps (+24 more)

### Community 5 - "test_outbox_db.py"
Cohesion: 0.11
Nodes (29): add_row(), admin(), ai_url(), _ai_url(), clean(), make_settings(), Recorder, run_worker() (+21 more)

### Community 6 - "instrumentation-client.ts"
Cohesion: 0.08
Nodes (35): configuredOrigin(), POST(), rateAllowed(), RateBucket, rateBuckets, requestIp(), response(), runtime (+27 more)

### Community 7 - "next-intl"
Cohesion: 0.09
Nodes (22): bengaliFont, generateMetadata(), Props, sansFont, ContactPage(), Props, generateMetadata(), PrivacyPage() (+14 more)

### Community 8 - "clients/page.tsx"
Cohesion: 0.12
Nodes (32): clientsPath(), createClientInvite(), InviteActionState, localeFrom(), revokeClientInvite(), saveClient(), saveError(), setClientArchived() (+24 more)

### Community 9 - "Link"
Cohesion: 0.25
Nodes (31): BlogPage(), Search, FaqsPage(), Search, PortfolioPage(), Search, Search, ServicesPage() (+23 more)

### Community 10 - "outbox.py"
Cohesion: 0.13
Nodes (25): _alert_outbox_failure(), _configured_channels(), _deliver(), _invite_email(), _lead_text(), _main(), _payload(), _payment_reminder_email() (+17 more)

### Community 11 - "Reverse Cloud manual hosting and operations guide"
Cohesion: 0.05
Nodes (34): Automatic updates from GitHub Dev, Connect and check, How the containers connect, Manual update, Named Cloudflare Tunnel lifecycle, Private environment and tunnel credential, Server layout, Ubuntu laptop hosting preview (+26 more)

### Community 12 - "projects/actions.ts"
Cohesion: 0.15
Nodes (29): actionError(), addProjectUpdate(), deleteProjectUpdate(), localeFrom(), projectsPath(), removeProjectMember(), replaceProjectMilestones(), revalidate() (+21 more)

### Community 13 - "Badge"
Cohesion: 0.20
Nodes (23): AboutPage(), Props, BlogPage(), Props, BlogPostDetailPage(), Props, HomePage(), PortfolioPage() (+15 more)

### Community 14 - "test_chat_agent.py"
Cohesion: 0.09
Nodes (16): CardEvent, convert_chat_messages(), dynamic_system_prompt(), has_explicit_save_confirmation(), load_system_prompt(), run_agent_stream(), UsageEvent, stream_chat_completion() (+8 more)

### Community 15 - "calcom.ts"
Cohesion: 0.11
Nodes (28): handled, json(), needsDetails, POST(), runtime, AvailableSlot, CALCOM_BOOKINGS_API_VERSION, CALCOM_CANCELLATION_API_VERSION (+20 more)

### Community 16 - "email/index.ts"
Cohesion: 0.24
Nodes (22): renderEmail(), EmailLayoutOptions, escapeEmailHtml(), safeEmailSubject(), safeEmailUrl(), toBanglaDigits(), wrapEmailLayout(), renderDeliveredEmail() (+14 more)

### Community 17 - "httpx"
Cohesion: 0.14
Nodes (15): main(), worker(), make_signature(), print_summary(), simulate_chat_user(), evaluate_live_response(), evaluate_question(), load_eval_questions() (+7 more)

### Community 18 - "steps"
Cohesion: 0.06
Nodes (30): name, runs-on, steps, timeout-minutes, concurrency, cancel-in-progress, group, AI_DATABASE_URL (+22 more)

### Community 19 - "env"
Cohesion: 0.06
Nodes (30): concurrency, cancel-in-progress, group, AI_HMAC_SECRET_CURRENT, CHAT_COOKIE_SECRET, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (+22 more)

### Community 20 - "roles.ts"
Cohesion: 0.13
Nodes (22): AdminLayout(), AdminPage(), AdminNavigation(), Item, AdminSection, adminSections, visibleAdminSections(), requireStaff (+14 more)

### Community 21 - "test_timeout.py"
Cohesion: 0.11
Nodes (13): TextChunk, stream_with_timeout(), StreamTimeoutError, _signature(), test_chat_streams_contract_events(), fake_stream(), test_chat_caps_history_before_streaming(), fake_stream() (+5 more)

### Community 22 - "deploy.sh"
Cohesion: 0.09
Nodes (27): AI_CANDIDATE_CONTAINER, AI_CONTAINER, AI_IMAGE_REPOSITORY, CANDIDATE_CONTAINER, cleanup_candidate(), compose(), COMPOSE_FILE, DEPLOY_BRANCH (+19 more)

### Community 23 - "portal/types.ts"
Cohesion: 0.14
Nodes (18): Item, Payment, PortalPaymentsPage(), Project, InvoiceModal(), InvoiceModalProps, PaymentScheduleProps, CurrencyTotal (+10 more)

### Community 24 - "schedule-view.tsx"
Cohesion: 0.15
Nodes (17): Props, SchedulePage(), BookingConfirmedDetails, ScheduleView(), fetchSlots(), ScheduleViewProps, SlotItem, FALLBACK_MEETING_TYPES (+9 more)

### Community 25 - "Settings"
Cohesion: 0.14
Nodes (10): Settings, alert_band(), main(), check_and_alert_token_usage(), get_daily_token_usage(), send_token_alert(), test_alert_band_only_crosses_eighty_and_one_hundred_percent(), test_get_daily_token_usage() (+2 more)

### Community 26 - "payments/actions.ts"
Cohesion: 0.21
Nodes (21): actionError(), localeFrom(), paymentsPath(), revalidate(), savePayment(), savePaymentItem(), text(), voidPayment() (+13 more)

### Community 27 - "staff/page.tsx"
Cohesion: 0.16
Nodes (20): addStaffMember(), localeFrom(), revokeStaffInvite(), setStaffRoleStatus(), staffPath(), text(), validEmail(), validUuid() (+12 more)

### Community 28 - "mock-stream.ts"
Cohesion: 0.13
Nodes (18): ChatWidget(), handleCardAction(), handleSendMessage(), createMockChatReadableStream(), createMockChatResponse(), getMockEvents(), MockStreamOptions, MockStreamScenario (+10 more)

### Community 29 - "test_transcript_review.py"
Cohesion: 0.18
Nodes (10): _fetch_flagged_responses(), _fetch_locale_summary(), _fetch_sample_exchanges(), generate_transcript_review(), run_transcript_review(), since(), test_fetch_flagged_responses(), test_fetch_locale_summary() (+2 more)

### Community 30 - "leads/route.ts"
Cohesion: 0.13
Nodes (17): POST(), response(), runtime, clean(), LeadPayload, LeadValidationResult, object(), utmKeys (+9 more)

### Community 31 - "portal-server.ts"
Cohesion: 0.17
Nodes (17): PortalProjectsPage(), ProjectProgressBarProps, calculateClientProgress(), calculateInternalProgress(), getPortalProjectById(), getPortalProjects(), portalCatalogProjects, DbAppointmentRow (+9 more)

### Community 32 - "steps"
Cohesion: 0.08
Nodes (23): concurrency, cancel-in-progress, group, jobs, test, name, on, pull_request (+15 more)

### Community 33 - "OllamaEmbedder"
Cohesion: 0.12
Nodes (8): FallbackEmbedder, GeminiEmbedder, OllamaEmbedder, test_embedding_fallback_uses_gemini_after_ollama_failure(), test_gemini_embedder_requests_matching_dimensions(), test_ollama_embedder_rejects_wrong_dimensions(), test_ollama_embedder_requests_configured_dimensions(), fake_post()

### Community 34 - "portal/layout.tsx"
Cohesion: 0.19
Nodes (14): PortalLayout(), Props, PublicLayout(), Footer(), Header(), HeaderUser, LanguageSwitcher(), Separator (+6 more)

### Community 35 - "createClient"
Cohesion: 0.23
Nodes (18): checkedEmail(), checkedLocale(), continueWithClientAccount(), signInWithGoogle(), signInWithMagicLink(), Context, GET(), loginError() (+10 more)

### Community 36 - "portal/index.ts"
Cohesion: 0.19
Nodes (15): ProjectDetailPage(), ActivityFeed(), ActivityFeedProps, LivePreviewCard(), LivePreviewCardProps, FilterStatus, MilestoneTimeline(), MilestoneTimelineProps (+7 more)

### Community 37 - "test_guardrails.py"
Cohesion: 0.16
Nodes (15): _chat_events(), _daily_tokens(), _persist_message(), _sse(), cap_message_history(), detect_prompt_injection(), estimate_token_count(), redact_pii() (+7 more)

### Community 38 - "ingest.py"
Cohesion: 0.17
Nodes (10): ContentRecord, ContentRepository, ingest_content_tables(), split_content(), VectorStore, Repository, test_ingests_published_content_into_vector_store(), test_split_content_preserves_overlap() (+2 more)

### Community 39 - "test_cost_report.py"
Cohesion: 0.16
Nodes (9): _estimate_cost(), generate_cost_report(), run_cost_report(), test_estimate_cost_gpt4o(), test_estimate_cost_gpt4o_mini(), test_estimate_cost_unknown_model_uses_default(), test_estimate_cost_zero_tokens(), test_generate_cost_report() (+1 more)

### Community 40 - "next"
Cohesion: 0.18
Nodes (14): nextConfig, withNextIntl, ContentPage(), resources, statuses, updateLeadStatus(), Search, sources (+6 more)

### Community 41 - "chat/route.ts"
Cohesion: 0.20
Nodes (16): attachSession(), authenticatedClientId(), connectTimeoutMs(), json(), POST(), primaryRate(), rateHeaders(), runtime (+8 more)

### Community 42 - "money.ts"
Cohesion: 0.17
Nodes (12): escapeHtml(), generateInvoiceHtml(), GET(), invoiceCsp(), invoiceNotFound(), PaymentItemDbRow, runtime, formatBdt() (+4 more)

### Community 43 - "auth/routes.ts"
Cohesion: 0.22
Nodes (15): StaffDashboardSegment, staffDashboardSegments, localizedPath(), pathSegments(), protectedArea(), staffDashboardRoute(), unlocalizedStaffPath(), refreshSession() (+7 more)

### Community 44 - "routes.py"
Cohesion: 0.21
Nodes (7): cost_report(), create_chat(), create_estimate(), EstimateRequest, EstimateResponse, InvalidSignature, verify_request_signature()

### Community 45 - "meetings/actions.ts"
Cohesion: 0.16
Nodes (11): DELETE(), json(), runtime, actionError(), cancelAdminAppointment(), meetingsPath(), requireAdmin(), CalcomBookingError (+3 more)

### Community 46 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 47 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 48 - "vitest"
Cohesion: 0.14
Nodes (10): dynamic, GET(), UpcomingAppointmentCard(), validTimeZone(), AppointmentPhase, AppointmentTiming, getAppointmentTiming(), PortalAppointment (+2 more)

### Community 49 - "accept-invite/page.tsx"
Cohesion: 0.27
Nodes (14): acceptClientInvite(), checkedLocale(), inviteErrorPath(), AcceptInvitePage(), dynamic, metadata, Props, Locale (+6 more)

### Community 50 - "portfolio/[slug]/page.tsx"
Cohesion: 0.20
Nodes (12): generateMetadata(), generateStaticParams(), Props, robots(), sitemap(), getBlogPosts(), DbPortfolioRow, getAllPortfolioSlugs() (+4 more)

### Community 51 - "services/[slug]/page.tsx"
Cohesion: 0.20
Nodes (13): generateMetadata(), generateStaticParams(), iconMap, Props, getAllServiceSlugs(), PricingModel, ServiceDetailItem, SERVICES_CATALOG (+5 more)

### Community 52 - "guardrails.py"
Cohesion: 0.19
Nodes (8): check_kill_switch(), check_token_budget(), GuardrailState, GuardrailViolation, KillSwitchActiveError, TokenBudgetExceededError, test_kill_switch(), test_token_budget()

### Community 53 - "ratelimit.ts"
Cohesion: 0.18
Nodes (14): GET(), json(), runtime, GET, runtime, fetchAvailableSlots(), ChatRateLimitResult, hashedKey() (+6 more)

### Community 54 - "blog-catalog.ts"
Cohesion: 0.17
Nodes (13): generateMetadata(), generateStaticParams(), BLOG_CATALOG, BlogPostItem, DbBlogRow, getAllBlogSlugs(), getBlogPostBySlug(), Document (+5 more)

### Community 55 - "book/route.ts"
Cohesion: 0.18
Nodes (11): BookingInput, bookingInput(), boundedText(), isSelectedSlotAvailable(), json(), POST(), runtime, isValidTimeZone() (+3 more)

### Community 56 - "wizard-container.tsx"
Cohesion: 0.26
Nodes (9): Props, WizardPage(), WizardContainerProps, calculateTopServices(), FALLBACK_WIZARD_QUESTIONS, TopServiceResult, WizardOption, WizardQuestion (+1 more)

### Community 57 - "estimate_project"
Cohesion: 0.28
Nodes (8): Estimate, estimate_from_mapping(), estimate_project(), EstimateInput, _round_up(), test_simple_automation_without_optional_work(), test_standard_web_estimate_golden_case(), test_unknown_features_use_conservative_discovery_allowance()

### Community 58 - "ref_node_crypto"
Cohesion: 0.14
Nodes (4): mocks, mocks, mocks, payload

### Community 59 - "Runbook: Database Backup and Restore Drill"
Cohesion: 0.14
Nodes (12): Certification, Database Restore Drill Log, Drill 1: Pre-Launch / Wave 1 Baseline Recovery Drill, Execution Summary, Findings & Observations, 1. Backup Architecture, 2. Recovery Procedures, 3. Post-Restore Verification Checklist (+4 more)

### Community 60 - "web"
Cohesion: 0.14
Nodes (14): condition, ai, AI_SERVICE_URL, LOCAL_OLLAMA_PREVIEW, TRUSTED_PUBLIC_ORIGINS, web, command, container_name (+6 more)

### Community 61 - "scripts"
Cohesion: 0.14
Nodes (13): engines, node, name, packageManager, private, scripts, build, dev (+5 more)

### Community 62 - "renovate.json"
Cohesion: 0.14
Nodes (13): config:recommended, :dependencyDashboard, :rebaseStalePrs, :semanticCommits, description, extends, labels, packageRules (+5 more)

### Community 63 - "confirm-booking/route.ts"
Cohesion: 0.32
Nodes (11): attendeeName(), ConfirmedProposal, confirmedProposal(), json(), markProposalFailed(), POST(), recordConfirmedBooking(), rpcFailure() (+3 more)

### Community 64 - "main.py"
Cohesion: 0.21
Nodes (4): add_request_id(), health(), lifespan(), ready()

### Community 65 - "badge.tsx"
Cohesion: 0.24
Nodes (9): class-variance-authority@^0.7.1, BadgeProps, badgeVariants, Button, ButtonProps, buttonVariants, CardFooter, cn() (+1 more)

### Community 66 - "server-only"
Cohesion: 0.24
Nodes (11): server-only@0.0.1, ChatSession, chatSession(), chatSessionCookie, chatSessionMaxAge, createSession(), requireSecret(), SessionOptions (+3 more)

### Community 67 - "(public)/page.tsx"
Cohesion: 0.29
Nodes (8): Props, ReviewCategoryFilter, TestimonialsSection(), TestimonialsSectionProps, getApprovedReviews(), PublicReviewItem, REVIEWS_CATALOG, getPublicSupabaseEnv()

### Community 68 - "signOut"
Cohesion: 0.24
Nodes (7): signOut(), PortalHeader(), PortalHeaderProps, initials(), Props, UserMenu(), handleSignOut()

### Community 69 - "knowledge-sync"
Cohesion: 0.18
Nodes (11): depends_on, ollama, command, container_name, depends_on, image, network_mode, restart (+3 more)

### Community 70 - "tunnel"
Cohesion: 0.18
Nodes (11): tunnel, cap_drop, command, container_name, image, network_mode, read_only, restart (+3 more)

### Community 71 - "server.ts"
Cohesion: 0.29
Nodes (6): @supabase/ssr@0.12.7, @supabase/supabase-js@2.117.3, requirePublicSupabaseEnv(), Cookie, @supabase/ssr, @supabase/supabase-js

### Community 72 - "projects/page.tsx"
Cohesion: 0.20
Nodes (9): Client, errorKeys, Member, Milestone, Project, savedKeys, Search, Staff (+1 more)

### Community 73 - "admin/payments/page.tsx"
Cohesion: 0.22
Nodes (8): dateTimeLocal(), errorKeys, Item, money(), Payment, Project, savedKeys, Search

### Community 74 - "healthcheck"
Cohesion: 0.56
Nodes (9): healthcheck, interval, retries, start_period, test, timeout, healthcheck, healthcheck (+1 more)

### Community 75 - "test_reindex_knowledge.py"
Cohesion: 0.28
Nodes (3): Connection, Embedder, test_reindexes_existing_chunks_without_creating_documents()

### Community 76 - "public-origin.ts"
Cohesion: 0.46
Nodes (7): configuredSiteUrl(), exactOrigin(), firstHeaderValue(), forwardedOrigin(), httpProtocols, trustedOrigins(), trustedPublicOrigin()

### Community 77 - "Payment gateway research"
Cohesion: 0.25
Nodes (7): Current product boundary, Estimate after merchant credentials arrive, Payment gateway research, Provider comparison, Recommendation, Required implementation contract, Sources

### Community 78 - "Authentication setup"
Cohesion: 0.25
Nodes (7): 1. Google Auth Platform, 2. Supabase URL configuration, 3. Email magic links, 4. Web environment, 5. Admin provisioning, 6. Acceptance check, Authentication setup

### Community 79 - "Runbook: AI Service Kill Switch"
Cohesion: 0.25
Nodes (7): 1. When to Flip the Kill Switch, 2. Immediate Action (Emergency Shutdown), 3. System Behavior While Kill Switch Is Active, 4. Post-Incident Recovery & Verification, Method 1: Railway Dashboard (Recommended, zero downtime), Method 2: Railway CLI (Fastest command line action), Runbook: AI Service Kill Switch

### Community 81 - "§13 Pre-Launch & Go-Live Verification Checklist"
Cohesion: 0.29
Nodes (6): §13 Pre-Launch & Go-Live Verification Checklist, 1. Security & Access Control, 2. Integrations & Third-Party APIs, 3. Database & Operations, 4. Test Suite Quality Gate, 5. Final Launch Steps (Team Action)

### Community 82 - "Secret Rotation Log & Execution Checklist"
Cohesion: 0.29
Nodes (5): Rotate secrets, Baseline Wave 3 Rotation Verification Record, Execution Verification Steps Performed:, Secret Inventory & Rotation Matrix, Secret Rotation Log & Execution Checklist

### Community 83 - "services"
Cohesion: 0.29
Nodes (6): name, external, name, services, volumes, ollama_models

### Community 84 - "ai"
Cohesion: 0.29
Nodes (7): command, container_name, image, network_mode, restart, volumes, ai

### Community 85 - "ai-monitor"
Cohesion: 0.29
Nodes (7): command, container_name, image, network_mode, restart, volumes, ai-monitor

### Community 86 - "Development"
Cohesion: 0.29
Nodes (6): Current scaffold, Development, English and Bangla, Repository layout, Reverse Cloud, Supabase and Google login

### Community 88 - "Chat API Contract"
Cohesion: 0.33
Nodes (5): Chat API Contract, Local Ollama with RAG, Request, SSE response, Web configuration

### Community 89 - "Runbook: Branch Protection & CI Quality Gates"
Cohesion: 0.33
Nodes (5): 1. Protected Branches, 2. Required Status Checks, 3. GitHub Branch Protection Policy Configuration, 4. Automated Dependency Maintenance (Renovate), Runbook: Branch Protection & CI Quality Gates

### Community 90 - "ollama"
Cohesion: 0.33
Nodes (6): container_name, image, ports, restart, volumes, ollama

### Community 91 - "deploy"
Cohesion: 0.33
Nodes (5): deploy, healthcheckPath, healthcheckTimeout, startCommand, $schema

### Community 92 - "deploy"
Cohesion: 0.33
Nodes (5): deploy, cronSchedule, restartPolicyType, startCommand, $schema

### Community 93 - "Phase 5 Google authentication review"
Cohesion: 0.40
Nodes (4): Evidence and completion, Phase 5 Google authentication review, Preconditions, Test matrix

### Community 94 - "environment"
Cohesion: 0.50
Nodes (5): environment, OLLAMA_EMBEDDING_MODEL, OLLAMA_MODEL, OLLAMA_URL, environment

### Community 95 - "Contact leads and notifications"
Cohesion: 0.50
Nodes (3): Contact leads and notifications, Railway outbox cron, Web configuration

### Community 96 - "pull_request_template.md"
Cohesion: 0.50
Nodes (3): Security, Summary, Validation

### Community 97 - "watch-activity.sh"
Cohesion: 0.50
Nodes (3): SERVER, watch-activity.sh script, SSH_KEY

## Knowledge Gaps
- **26 isolated node(s):** `HOSTING_ROOT`, `REPOSITORY_DIR`, `SECRETS_DIR`, `STATE_DIR`, `COMPOSE_FILE` (+21 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 778 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `content/actions.ts`, `web/package.json`, `lucide-react`, `instrumentation-client.ts`, `next-intl`, `clients/page.tsx`, `Link`, `projects/actions.ts`, `Badge`, `calcom.ts`, `roles.ts`, `portal/types.ts`, `schedule-view.tsx`, `payments/actions.ts`, `staff/page.tsx`, `mock-stream.ts`, `leads/route.ts`, `portal-server.ts`, `portal/layout.tsx`, `createClient`, `portal/index.ts`, `chat/route.ts`, `money.ts`, `auth/routes.ts`, `meetings/actions.ts`, `vitest`, `accept-invite/page.tsx`, `portfolio/[slug]/page.tsx`, `services/[slug]/page.tsx`, `ratelimit.ts`, `book/route.ts`, `wizard-container.tsx`, `ref_node_crypto`, `confirm-booking/route.ts`, `(public)/page.tsx`, `signOut`, `server.ts`, `projects/page.tsx`, `admin/payments/page.tsx`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **What connects `HOSTING_ROOT`, `REPOSITORY_DIR`, `SECRETS_DIR` to the rest of the system?**
  _26 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `chat_agent.py` be split into smaller, more focused modules?**
  _Cohesion score 0.046010483401281305 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `vitest` to `content/actions.ts`, `web/package.json`, `instrumentation-client.ts`, `next-intl`, `clients/page.tsx`, `projects/actions.ts`, `calcom.ts`, `email/index.ts`, `roles.ts`, `schedule-view.tsx`, `payments/actions.ts`, `staff/page.tsx`, `mock-stream.ts`, `leads/route.ts`, `portal-server.ts`, `portal/layout.tsx`, `createClient`, `chat/route.ts`, `money.ts`, `auth/routes.ts`, `meetings/actions.ts`, `accept-invite/page.tsx`, `portfolio/[slug]/page.tsx`, `services/[slug]/page.tsx`, `blog-catalog.ts`, `book/route.ts`, `wizard-container.tsx`, `ref_node_crypto`, `(public)/page.tsx`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `get_settings` be split into smaller, more focused modules?**
  _Cohesion score 0.07127882599580712 - nodes in this community are weakly interconnected._
- **Why does `next-intl` connect `next-intl` to `content/actions.ts`, `web/package.json`, `lucide-react`, `clients/page.tsx`, `Link`, `projects/actions.ts`, `Badge`, `roles.ts`, `portal/types.ts`, `schedule-view.tsx`, `payments/actions.ts`, `staff/page.tsx`, `portal-server.ts`, `portal/layout.tsx`, `createClient`, `portal/index.ts`, `next`, `auth/routes.ts`, `meetings/actions.ts`, `accept-invite/page.tsx`, `portfolio/[slug]/page.tsx`, `services/[slug]/page.tsx`, `wizard-container.tsx`, `(public)/page.tsx`, `signOut`, `projects/page.tsx`, `admin/payments/page.tsx`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Should `web/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.0549645390070922 - nodes in this community are weakly interconnected._