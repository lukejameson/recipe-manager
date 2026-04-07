# RecipeFlow SaaS Tier Plan

## Overview
Transform RecipeFlow into a multi-tier SaaS product with fair, transparent pricing that doesn't feel like a cash grab.

**Core Philosophy**: AI features should feel integrated and native, not marketed as "AI this, AI that." The AI is a subtle productivity layer, not the selling point.

---

## Target Audience
- Primary: Home cooks
- Secondary: Food enthusiasts

---

## Pricing Tiers

### Free ($0/month)
| Feature | Limit |
|---------|-------|
| Recipes | 75 |
| URL Import | 30/month |
| Photo Storage | 500MB |
| AI Features | None |
| Recipe Scaling | ✓ |
| Shopping Lists | ✓ |
| Manual Entry | ✓ |
| Tagging System | ✓ |
| Collections | ✓ |

**Rationale**: Zero LLM cost to operate. Enough to be genuinely useful, but serious cooks hit the wall.

---

### Cook ($5/month | $48/year)
| Feature | Limit |
|---------|-------|
| Recipes | 500 |
| URL Import | 100/month |
| Photo Storage | 2GB + $0.10/GB over |
| AI Messages | 50/month |
| Photo Recipe Import | 20/month |
| AI Recipe Adaptation | 10/month |
| AI Auto-tagging | ✓ |
| AI Nutrition Calc | ✓ |
| AI Substitution Suggestions | ✓ |
| AI "What Can I Make?" | ✓ |
| Custom AI Agents | 1 |
| Model Tier | Budget (Gemini Flash 2.5, GPT-4o-mini) |

**Rationale**: Entry paid tier with genuinely useful AI. Subtle integration feels native.

---

### Chef ($12/month | $115/year)
| Feature | Limit |
|---------|-------|
| Recipes | Unlimited |
| URL Import | Unlimited |
| Photo Storage | 10GB + $0.05/GB over |
| AI Messages | 200/month |
| Photo Recipe Import | 100/month |
| AI Recipe Adaptation | Unlimited |
| AI Auto-tagging | ✓ |
| AI Nutrition Calc | ✓ |
| AI Substitution Suggestions | ✓ |
| AI "What Can I Make?" | ✓ |
| Custom AI Agents | 5 |
| Priority Processing | ✓ |
| Model Tier | Premium (Claude Opus/Sonnet, GPT-4o, Gemini Pro) |

**Rationale**: Power users get more, higher-quality AI access.

---

## Feature Comparison Matrix

| Feature | Free | Cook | Chef |
|---------|:----:|:----:|:----:|
| Recipe CRUD | ✓ | ✓ | ✓ |
| Manual Entry | ✓ | ✓ | ✓ |
| URL Import | 30/mo | 100/mo | ∞ |
| Recipe Scaling | ✓ | ✓ | ✓ |
| Shopping Lists | ✓ | ✓ | ✓ |
| Tagging System | ✓ | ✓ | ✓ |
| Collections | ✓ | ✓ | ✓ |
| Photo Storage | 500MB | 2GB | 10GB |
| Photo Import (AI) | ✗ | 20/mo | 100/mo |
| AI Chat | ✗ | 50/mo | 200/mo |
| AI Recipe Adaptation | ✗ | 10/mo | ∞ |
| AI Auto-tagging | ✗ | ✓ | ✓ |
| AI Nutrition Calculation | ✗ | ✓ | ✓ |
| AI Ingredient Substitution | ✗ | ✓ | ✓ |
| AI "What Can I Make?" | ✗ | ✓ | ✓ |
| Custom AI Agents | ✗ | 1 | 5 |
| Priority Processing | ✗ | ✗ | ✓ |
| Model Access | None | Budget | Premium |

---

## AI Model Tiers

### Budget Models (Cook)
- Gemini 2.5 Flash (primary)
- GPT-4o-mini
- Claude 3.5 Haiku

### Premium Models (Chef)
- Claude 4 Opus (default)
- Claude 4 Sonnet
- GPT-4o
- GPT-4o-mini
- Gemini 2.5 Pro
- Gemini 2.5 Flash

**Admin Control**: Model selection per tier configurable in admin settings UI.

---

## Rate Limits & Usage Tracking

### AI Usage Limits
- Monthly resets (not cumulative)
- Visible in settings with clear meter
- Soft upgrade prompts when at 80%
- Hard block at limit with upgrade CTA

### Storage Limits
- Real-time byte tracking per user
- Graceful rejection when over quota
- Clear messaging about storage usage

### Visible Usage Display
- "32 AI messages remaining this month"
- Not aggressive, not hidden
- Builds trust through transparency

---

## Family Plan (Deprioritized)
- Considered for v2
- Would include multi-user seats
- Shared collections
- Family shopping list merging

---

## Annual Discount
- 20% off for annual billing
- Cook: $48/year (vs $60)
- Chef: $115/year (vs $144)

---

## Storage Billing
- Cook: $0.10/GB/month over 2GB
- Chef: $0.05/GB/month over 10GB

---

## Implementation Phases

### Phase 1: Database & Schema
- [ ] Add `subscriptions` table
  - user_id, tier, status, current_period_end, stripe_customer_id, annual
- [ ] Add `usage_tracking` table
  - user_id, feature_type, used_count, period_start, period_end
- [ ] Add `storage_usage` table
  - user_id, bytes_used, last_updated
- [ ] Add `feature_flags` migration for tier-based access

### Phase 2: Backend Infrastructure
- [ ] Tier-checking middleware for all AI endpoints
- [ ] Usage counter service (atomic increments)
- [ ] Storage quota service
- [ ] Rate limit response handler (429 with upgrade prompt)

### Phase 3: AI Routing
- [ ] AI proxy layer with tier-based routing
- [ ] Model selection by tier (configurable)
- [ ] Admin settings UI for model configuration

### Phase 4: Frontend Paywall
- [ ] Usage meter in settings page
- [ ] Upgrade prompts (clear, not aggressive)
- [ ] Feature gate UI components
- [ ] Storage usage display

### Phase 5: Billing Integration
- [ ] Stripe subscription setup
- [ ] Webhook handlers (subscription events)
- [ ] Usage-based billing for storage overages
- [ ] Annual/monthly toggle

---

## Technical Notes

### AI Feature Detection
All AI features already exist in codebase:
- Recipe Ideas Chat
- Ask AI (recipe-specific chat)
- Auto-tagging
- Nutrition calculation
- Ingredient substitution
- Recipe improvements
- Recipe adaptation
- Technique explanations
- "What Can I Make?" (pantry matching)
- Recipe from photos
- Custom AI Agents
- User memories

### Existing Architecture
- SvelteKit 5 PWA
- PostgreSQL database
- Multi-provider LLM (Anthropic, OpenAI, Google, OpenRouter)
- Cloudflare R2 / AWS S3 / Local storage
- Sharp for image processing
- Feature flags already exist (JSONB per user)

### Storage Providers
- Cloudflare R2 (S3-compatible)
- AWS S3
- Local filesystem

---

## Questions / Open Decisions

1. [ ] Stripe vs other payment provider
2. [ ] Trial period for paid tiers?
3. [ ] First-time user flow (force to signup/signin?)
4. [ ] Migration path for existing users (legacy free tier?)
5. [ ] Export data if cancel subscription?
6. [ ] Offline PWA support across tiers?

---

## Cash Grab Avoidance Principles

1. **No AI theater** - Features are genuinely useful, not gimmicky
2. **Fair limits** - 50 AI messages/month is real usage, not a tease
3. **Same models, more access** - Cook tier gets good models, just fewer
4. **Transparent limits** - Users see exactly where they stand
5. **No dark patterns** - No countdown timers, fake urgency, or feature teasing
6. **Value correlation** - Price reflects actual cost (LLM + storage)

---

## Next Steps
1. Finalize tier limits and pricing
2. Decide on payment provider
3. Design user migration strategy for existing users
4. Create Stripe products/pricing in dashboard
5. Begin Phase 1 implementation
