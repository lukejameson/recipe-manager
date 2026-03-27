Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
UI/UX Review Plan - Tabella Recipe Manager

Context

Tabella is a Recipe Management PWA built with SvelteKit 5, featuring AI-powered recipe generation,
photo import, chat, and comprehensive recipe organization. The application currently implements a
mobile-first responsive design with a custom CSS variable-based theming system (Terra & Sage
palette).

This review will evaluate the UI/UX across desktop and mobile breakpoints, focusing on mobile-first
improvements while maintaining desktop excellence.

---

Current State Summary

Strengths

- Consistent Terra & Sage color palette throughout
- Custom CSS variable system for theming
- Mobile-first responsive approach (768px primary breakpoint)
- Slide-out mobile navigation (280px drawer)
- PWA-ready with proper manifest
- Good touch target sizing (44px+ on mobile)
- Three view modes for recipes (grid/list/compact)

Architecture

- Framework: SvelteKit 2.14+ with Svelte 5 runes
- Styling: Scoped CSS in components, global CSS variables in layout
- Icons: Lucide Svelte
- State: Svelte 5 runes + TanStack Query
- Breakpoints: 768px (primary), 640px (secondary)

---

Review Scope

1.  Navigation & Layout

Files to Review:

- /app/src/lib/components/Header.svelte - Navigation header with mobile drawer
- /app/src/routes/+layout.svelte - Global layout, CSS variables

Review Checklist:

- Mobile hamburger menu visibility and animation smoothness
- Slide-out drawer animation performance (GPU-accelerated transforms)
- Touch target sizes on mobile nav items (currently 52px min-height - verify)
- Desktop navigation spacing and alignment
- User dropdown positioning on different screen sizes
- Sticky header behavior during scroll
- Safe area insets for notched devices (env(safe-area-inset-top))
- Focus management when mobile menu opens/closes (accessibility)
- Backdrop click-to-close on mobile menu
- Active state indicators in navigation

Mobile-First Concerns:

- Header height is appropriate (reduces from desktop to mobile)
- Logo scales down on mobile (32px → 28px)
- Right-side slide-out is thumb-friendly
- 280px drawer width is appropriate

---

2.  Recipe Listing Page (Home)

Files to Review:

- /app/src/routes/+page.svelte - Main recipe listing
- /app/src/lib/components/RecipeCard.svelte - Recipe card component

Review Checklist:

- Grid responsiveness: repeat(auto-fill, minmax(320px, 1fr)) → single column on mobile
- Recipe card touch targets on mobile (favorite button 40px, verify sufficient)
- Category tabs (All/Food/Cocktails) overflow handling on small screens
- Search bar usability on mobile (16px font prevents iOS zoom)
- View mode toggle - hidden on mobile (desktop-only class), verify necessity
- Tag filter collapsible UX on mobile
- Active filters display and "Clear" button sizing
- Empty state readability
- Loading state (currently text-only, could use skeleton)
- Recipe card hover effects disabled on mobile (transform: none)

Mobile-First Concerns:

- Recipe card hides description and tags on mobile (good for space)
- Image height reduces from 220px to 180px on mobile
- Actions hidden on mobile cards (user must tap through to detail)
- Category tabs stretch full width on mobile with equal flex distribution

---

3.  Recipe Detail Page

Files to Review:

- /app/src/routes/recipe/[id]/+page.svelte - Recipe detail (large file)

Review Checklist:

- Hero image aspect ratio and loading behavior
- Title and metadata layout on mobile
- Cooking mode button placement
- Timer functionality visibility
- Ingredient list readability on small screens
- Instruction step numbering and spacing
- Scaling controls (servings multiplier) UX
- AI chat widget positioning on mobile
- Related recipes section at bottom
- Print stylesheet effectiveness
- "Cooked" and "Favorite" action placement

Mobile-First Concerns:

- Complex page with many sections - evaluate collapsible sections
- Chat widget may need bottom-sheet pattern on mobile
- Consider sticky action bar for key actions

---

4.  Forms (Recipe Create/Edit, Login)

Files to Review:

- /app/src/lib/components/RecipeForm.svelte - Recipe form
- /app/src/routes/login/+page.svelte - Authentication form

Review Checklist:

- Input field sizing (16px minimum to prevent iOS zoom)
- Form row grid adapts to single column on mobile (@media (max-width: 640px))
- Button sizing on mobile (52px minimum height implemented)
- Collapsible sections (Nutrition, Components) UX
- Label positioning and readability
- Error message display and accessibility
- Modal positioning on mobile (AddComponentModal, ImageSearchModal)
- Textarea sizing for ingredients/instructions
- Focus states visible and accessible
- Form submission loading states

Mobile-First Concerns:

- Login form: centered card with max-width 440px, good for all screens
- Recipe form has many fields - evaluate progressive disclosure
- Nutrition section uses 3-column grid on desktop, stacks on mobile (good)
- Component management UI may be cramped on mobile

---

5.  Button System

Files to Review:

- /app/src/lib/components/Button.svelte - Reusable button
- /app/src/routes/+layout.svelte - Global button classes

Review Checklist:

- Button height consistency (32px/40px/48px sizes)
- Icon-only button sizing and touch targets
- Button text vs icon-only on mobile (current: .btn-text { display: none; } on mobile)
- Primary/Secondary/Tertiary/Danger variants visually distinct
- Disabled states clearly indicated
- Focus indicators for keyboard navigation
- Loading states (spinner integration)
- Active/pressed states on touch devices

Mobile-First Concerns:

- Global .btn-text { display: none; } on mobile may reduce clarity
- Consider icon + text for primary actions even on mobile
- Verify 48px minimum touch target for all interactive elements

---

6.  Chat Interface

Files to Review:

- /app/src/lib/components/RecipeChat.svelte - Recipe chat widget
- /app/src/lib/components/chat/ChatHistorySidebar.svelte - Chat history

Review Checklist:

- Chat sidebar responsive behavior (240px desktop, overlay on mobile)
- Message input field accessibility on mobile
- Keyboard handling on mobile (viewport resizing)
- Message bubble readability on small screens
- Agent selector visibility and touch targets
- @mentions interface on mobile
- Chat history search on mobile
- Backdrop handling for mobile sidebar

Mobile-First Concerns:

- Chat sidebar slides from left on mobile - verify animation smoothness
- Consider bottom-sheet for chat on mobile (more thumb-friendly)
- Message input may be obscured by virtual keyboard

---

7.  Settings & Profile Pages

Files to Review:

- /app/src/routes/settings/+page.svelte
- /app/src/routes/settings/ai/+page.svelte
- /app/src/routes/profile/+page.svelte

Review Checklist:

- Settings form layout on mobile
- AI provider configuration table/list responsive behavior
- Feature flag toggles sizing
- Profile page information density
- Session management list on mobile
- Password change form usability

---

8.  Admin Pages

Files to Review:

- /app/src/routes/admin/+page.svelte
- /app/src/routes/admin/users/+page.svelte
- /app/src/routes/admin/invites/+page.svelte
- /app/src/routes/admin/audit-logs/+page.svelte

Review Checklist:

- Data table responsiveness (horizontal scroll vs card flip)
- Admin navigation on mobile
- Action buttons sizing in tables
- Modal forms for user/invite management
- Audit log filtering on mobile

---

9.  Import & Generate Pages

Files to Review:

- /app/src/routes/recipe/import/+page.svelte
- /app/src/routes/generate/+page.svelte
- /app/src/lib/components/PhotoUploader.svelte
- /app/src/lib/components/BulkRecipeReview.svelte

Review Checklist:

- Photo upload area sizing on mobile
- URL import input usability
- Photo grouping interface touch targets
- Bulk review card navigation
- Generate page chat interface
- Camera capture functionality on mobile devices

---

10. Visual Design System Audit

Review Checklist:

- Color Contrast: Verify WCAG AA compliance (4.5:1 for text)
  - Primary text (#2D2D2D) on bg (#FDF9F3)
  - Primary button text (white) on #E07A52
  - Error text (#C84B4B) contrast
- Typography Hierarchy: Consistent heading sizes across pages
- Spacing Consistency: Verify --spacing-\* variables used consistently
- Border Radius: Consistent rounding (cards, buttons, inputs)
- Shadows: Appropriate depth hierarchy
- Transitions: Consistent timing (150ms/200ms/300ms)
- Focus States: Visible and consistent across all interactive elements
- Loading States: Skeletons vs spinners vs text consistency

---

11. Accessibility Review

Review Checklist:

- Semantic HTML structure (nav, main, section, article)
- ARIA labels on icon-only buttons
- Form labels properly associated
- Error announcements for screen readers
- Focus trap in modals
- Skip navigation link (if missing, add)
- Color not sole indicator of state (favorites, errors)
- Touch target minimum 44x44px
- Reduced motion media query support
- Keyboard navigation flow

---

12. Performance & PWA

Review Checklist:

- Image lazy loading implementation
- Image optimization (WebP/AVIF support)
- Route-level code splitting
- Service worker caching strategy
- Offline state UI handling
- Pull-to-refresh on mobile (if applicable)
- Smooth scrolling performance
- Animation GPU acceleration (transform/opacity only)

---

Critical Files to Review

┌──────────┬───────────────────────────────────────────┬─────────────────────────────────────┐
│ Priority │ File │ Reason │
├──────────┼───────────────────────────────────────────┼─────────────────────────────────────┤
│ P0 │ /app/src/routes/recipe/[id]/+page.svelte │ Most complex page, content-heavy │
├──────────┼───────────────────────────────────────────┼─────────────────────────────────────┤
│ P0 │ /app/src/lib/components/Header.svelte │ Primary navigation, used everywhere │
├──────────┼───────────────────────────────────────────┼─────────────────────────────────────┤
│ P0 │ /app/src/routes/+layout.svelte │ Global styles, affects all pages │
├──────────┼───────────────────────────────────────────┼─────────────────────────────────────┤
│ P1 │ /app/src/routes/+page.svelte │ Homepage, first impression │
├──────────┼───────────────────────────────────────────┼─────────────────────────────────────┤
│ P1 │ /app/src/lib/components/RecipeCard.svelte │ Core component, high visibility │
├──────────┼───────────────────────────────────────────┼─────────────────────────────────────┤
│ P1 │ /app/src/lib/components/RecipeForm.svelte │ Complex form, mobile critical │
├──────────┼───────────────────────────────────────────┼─────────────────────────────────────┤
│ P1 │ /app/src/routes/generate/+page.svelte │ AI chat interface │
├──────────┼───────────────────────────────────────────┼─────────────────────────────────────┤
│ P2 │ /app/src/routes/login/+page.svelte │ Entry point │
├──────────┼───────────────────────────────────────────┼─────────────────────────────────────┤
│ P2 │ /app/src/lib/components/RecipeChat.svelte │ Chat UX │
├──────────┼───────────────────────────────────────────┼─────────────────────────────────────┤
│ P2 │ /app/src/routes/settings/ai/+page.svelte │ Admin settings │
└──────────┴───────────────────────────────────────────┴─────────────────────────────────────┘

---

Expected Deliverables

1.  UI/UX Review Report documenting:

- Issues found (categorized by severity)
- Mobile-specific concerns
- Desktop-specific concerns
- Accessibility violations
- Performance observations

2.  Recommendations for:

- Layout improvements
- Interaction pattern enhancements
- Visual design refinements
- Accessibility fixes
- Mobile optimization opportunities

3.  Priority Matrix:

- Quick wins (easy fixes, high impact)
- Medium effort improvements
- Long-term enhancements

---

Verification Approach

1.  Manual Testing:

- Test on actual mobile devices (iOS Safari, Android Chrome)
- Chrome DevTools device emulation
- Verify at breakpoints: 320px, 375px, 414px, 768px, 1024px, 1440px

2.  Accessibility Testing:

- axe DevTools scan
- Keyboard-only navigation test
- Screen reader test (VoiceOver/TalkBack)

3.  Visual Regression:

- Compare key pages at each breakpoint
- Document inconsistencies

---

Implementation Notes

- All findings will be documented with specific file paths and line numbers
- Recommendations will reference existing code patterns where applicable
- Mobile-first approach: prioritize mobile experience, enhance for desktop
- Maintain existing design system (CSS variables, spacing, colors)
- Ensure changes don't break existing functionality
