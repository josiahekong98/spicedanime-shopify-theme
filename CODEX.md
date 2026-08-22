# CODEX.md — SpicedAnime Shopify Theme Instructions

## Purpose

This file defines the rules Codex must follow when working inside the SpicedAnime Shopify theme repository.

Codex should treat this repository as a live production-connected Shopify project. Changes must be small, reversible, easy to review, and aligned with the SpicedAnime design system, UX architecture, engineering standards, and recorded decisions.

---

## Required Context

Before making changes, review the relevant project guidance.

Always check:

- `AGENTS.md`
- `spicedanime-bible/00-SpicedAnime-AI-Context-Summary.md`
- Volume 10 Decision Log
- Volume 4 Shopify Engineering Bible
- Volume 3 UX Page Architecture
- Volume 2 Design System

When instructions conflict, use this priority order:

1. The current task request
2. `CODEX.md`
3. `AGENTS.md`
4. Volume 10 Decision Log
5. Volume 4 Shopify Engineering Bible
6. Volume 3 UX Page Architecture
7. Volume 2 Design System
8. Existing repository conventions

Do not guess when an important requirement is unclear. Inspect the repository and use the safest interpretation supported by the existing code and documentation.

---

## Before Editing

Before modifying any file:

1. Run `git status`.
2. Report any existing uncommitted changes.
3. Identify the current Git branch.
4. Inspect all files relevant to the task.
5. Confirm the exact files that need to change.
6. Check for existing reusable sections, snippets, assets, settings, utilities, and CSS patterns.
7. Review the applicable SpicedAnime Bible guidance.
8. Explain the proposed approach before editing.
9. Use a new Git branch for substantial work unless the user explicitly says otherwise.

Do not overwrite, revert, reformat, or remove unrelated work.

Do not edit files outside the approved scope without explicit permission.

---

## Task Format

When a task is provided, interpret it using this structure:

### Task

The exact website change being requested.

### Purpose

Why the change matters for the customer, website, operations, or business.

### Bible Context

The project documents and decisions that apply to the task.

### Files Allowed to Edit

Only the files explicitly listed for the task.

### Files Not Allowed to Edit

Protected files and any files outside the approved scope.

### Rules

The implementation requirements and project constraints.

### Output Required

The final summary, QA instructions, risk level, and rollback steps.

If the task does not clearly specify files allowed to edit, inspect the codebase and identify the smallest reasonable file set before making changes. Do not expand scope unnecessarily.

---

## Protected Areas

Do not edit these areas unless the task explicitly requires it and the user specifically approves it:

- `layout/theme.liquid`
- Cart files
- Product form files
- Variant picker files
- Checkout-related code
- Search files
- Payment button code
- Authentication or customer account logic
- Shopify Markets logic
- Localization logic
- Analytics or tracking scripts
- Third-party app integration code
- Generated files
- Minified files
- Vendor files
- Environment or credential files
- Git configuration
- Deployment configuration

Do not change Shopify store settings, themes, products, navigation, metafields, app settings, or live content unless explicitly instructed.

---

## Shopify Safety Rules

- Never publish or push changes to the live Shopify theme without explicit approval.
- Never run `shopify theme push --publish`.
- Never overwrite the published theme.
- Never delete a remote theme without explicit approval.
- Never force-push Git branches.
- Never rewrite Git history.
- Never commit, push, merge, deploy, or publish without explicit approval.
- Use a Shopify development theme or preview theme for testing.
- Preserve Shopify-native behavior.
- Preserve section rendering through the Shopify Theme Editor.
- Preserve existing dynamic sources, metafields, localization, and app blocks.
- Do not hard-code store-specific content when a schema setting or Shopify object should be used.
- Do not expose secrets, tokens, customer data, private app credentials, or environment variables.
- Do not add checkout customizations that are unsupported by the store's Shopify plan.
- Do not replace Shopify-native forms, carts, product forms, variant logic, or payment flows unless specifically requested.

---

## Engineering Rules

- Make the smallest safe change that fully completes the task.
- Prefer editing an existing component over creating a duplicate.
- Use `sa-` prefixes for new SpicedAnime-specific classes, IDs, section names, snippet names, settings, and custom events where appropriate.
- Avoid global CSS unless the task explicitly requires it.
- Scope styles to the relevant section or component.
- Do not introduce unnecessary libraries, frameworks, dependencies, or build tools.
- Follow the repository's existing Liquid, CSS, JavaScript, JSON, and naming conventions.
- Reuse existing design tokens, variables, spacing rules, typography, buttons, containers, utilities, and breakpoints.
- Preserve accessibility.
- Preserve keyboard navigation.
- Preserve semantic HTML.
- Include meaningful labels, focus states, and alternative text behavior.
- Avoid layout shifts and unnecessary JavaScript.
- Avoid duplicate JavaScript listeners.
- Avoid inline JavaScript unless consistent with the existing architecture.
- Avoid inline styles unless values must come from Shopify section settings.
- Sanitize and escape merchant-controlled output where appropriate.
- Do not suppress errors without explaining the reason.
- Do not leave debug code, console logs, commented-out experiments, or temporary files.
- Do not silently change unrelated formatting.
- Do not rename or move files unless required.
- Do not change public interfaces, schema setting IDs, block types, section types, or class hooks without checking their current usage.

---

## Shopify Section Requirements

For every new Shopify section:

- Use a descriptive `sa-` prefixed filename.
- Include a valid `{% schema %}` block.
- Include a useful section name.
- Include a relevant preset when the section should be addable through the Theme Editor.
- Use clear setting labels.
- Use stable setting IDs.
- Use appropriate setting types.
- Include sensible defaults.
- Include block limits where appropriate.
- Include empty states.
- Support merchant editing through the Theme Editor.
- Support Shopify block attributes where relevant.
- Preserve app block compatibility when relevant.
- Avoid hard-coded merchant-facing copy when it should be configurable.
- Keep schema valid JSON.
- Do not include unsupported schema properties.

---

## Responsive Design Rules

Every customer-facing change must account for:

- Desktop
- Tablet
- Mobile
- Narrow mobile screens
- Touch interaction
- Long text
- Missing images
- Missing optional content
- Empty states
- Different product titles and content lengths

Mobile behavior is required, not optional.

Do not simply shrink the desktop layout. Adapt spacing, hierarchy, alignment, stacking, controls, tap targets, and image behavior for smaller screens.

Avoid horizontal overflow.

Use existing repository breakpoints unless the task clearly requires a new one.

---

## Design-System Rules

All changes must feel native to SpicedAnime.

Use the existing:

- Color palette
- Typography
- Spacing scale
- Border radii
- Buttons
- Cards
- Container widths
- Shadows
- Icon style
- Image treatment
- Motion style
- Responsive behavior

Do not introduce a new visual language for a single section.

Do not copy generic Shopify theme styling when an established SpicedAnime pattern exists.

Do not use placeholder visual styles in the final implementation.

---

## UX Rules

- Make the primary customer action obvious.
- Avoid unnecessary steps.
- Keep labels understandable.
- Preserve expected Shopify behavior.
- Do not hide important information behind unclear interactions.
- Ensure interactive elements look interactive.
- Include useful empty states.
- Account for loading, unavailable, missing-content, and error states where relevant.
- Avoid duplicating navigation or competing calls to action.
- Respect the page architecture defined in the SpicedAnime documentation.
- Do not add content merely to fill space.

---

## JavaScript Rules

When JavaScript is required:

- Use the minimum amount necessary.
- Confirm that CSS or native HTML cannot solve the problem first.
- Scope selectors to the component.
- Prevent duplicate initialization.
- Support Shopify Theme Editor section reloads when relevant.
- Clean up event listeners when relevant.
- Avoid polluting the global namespace.
- Preserve progressive enhancement.
- Do not block page rendering unnecessarily.
- Do not add dependencies without explicit approval.
- Handle missing elements safely.
- Do not interfere with Shopify product, cart, search, localization, or app scripts.

---

## Performance Rules

- Avoid unnecessary asset requests.
- Avoid loading large libraries for small interactions.
- Use responsive images and Shopify image filters correctly.
- Lazy-load below-the-fold images where appropriate.
- Do not lazy-load the likely Largest Contentful Paint image without a clear reason.
- Avoid oversized images.
- Avoid unnecessary DOM complexity.
- Avoid repeated Liquid loops over large collections.
- Avoid render-blocking scripts.
- Preserve theme performance unless a documented tradeoff is approved.

---

## Accessibility Rules

Customer-facing changes should meet reasonable WCAG expectations.

At minimum:

- Use semantic HTML.
- Maintain visible keyboard focus.
- Support keyboard interaction.
- Use accessible names for controls.
- Use headings in a logical order.
- Do not rely on color alone.
- Maintain readable contrast.
- Include appropriate image alt behavior.
- Respect reduced-motion preferences where animation is used.
- Use ARIA only when native HTML is insufficient.
- Ensure tap targets are usable on mobile.

---

## Validation Requirements

After editing, run all relevant available checks.

These may include:

- `git diff --check`
- Shopify Theme Check
- Existing repository lint commands
- Existing test commands
- Existing build commands
- JSON validation
- Liquid syntax validation
- JavaScript syntax validation
- CSS validation
- Manual browser review
- Shopify development-theme preview

Do not claim a check passed unless it was actually run.

If a check cannot be run, state:

- Which check was not run
- Why it was not run
- What should be checked manually

Always review the final Git diff before completing the task.

---

## Git Rules

- Start by running `git status`.
- Preserve all unrelated local changes.
- Do not stage unrelated files.
- Do not use destructive Git commands.
- Do not run `git reset --hard`.
- Do not run `git clean -fd`.
- Do not force-push.
- Do not amend existing commits unless explicitly requested.
- Do not commit automatically.
- Do not push automatically.
- Do not merge automatically.
- Do not change branches when uncommitted work could be lost.
- Use a task-specific branch for substantial changes when appropriate.

Suggested branch format:

```text
codex/<short-task-name>
```

---

## Scope Control

Stay within the requested task.

Do not:

- Redesign unrelated areas
- Refactor unrelated files
- Rename unrelated classes
- Reformat entire files
- Replace working systems merely because another approach is preferred
- Add speculative features
- Add future-facing abstractions without a current need
- Edit protected files for convenience
- Fix unrelated bugs without reporting them first

If an unrelated issue is discovered, mention it separately without changing it.

---

## Required Final Response

After completing a task, provide the following:

### Files Changed

List every changed, added, deleted, or renamed file.

### What Changed

Explain the implementation in plain language.

### Why It Fits SpicedAnime

Explain how the result follows the design system, UX architecture, engineering standards, and relevant decision records.

### Risk Level

Use one of:

- Low
- Medium
- High

Include a brief reason.

### Validation Performed

List every command, test, lint check, preview, or manual verification actually completed.

### Desktop QA Steps

Provide clear steps to verify the change on desktop.

### Mobile QA Steps

Provide clear steps to verify the change on mobile.

### Edge Cases Checked

List the relevant empty, missing-content, long-text, responsive, accessibility, and interaction cases reviewed.

### Rollback Instructions

Provide exact rollback instructions.

Prefer file-specific rollback commands such as:

```bash
git restore path/to/file
```

For newly created files:

```bash
rm path/to/new-file
```

If the change has already been committed, provide the appropriate non-destructive Git revert instructions.

### Remaining Concerns

State any unresolved risks, assumptions, limitations, or checks that still need to be performed.

---

## Default Task Template

Use this structure when giving Codex a new task:

```markdown
# Task

[Describe the exact task. Example: Create one new Shopify section called `sections/sa-explore-paths.liquid`.]

## Purpose

[Explain why this matters for the website, customer, or business.]

## Bible Context

Use:

- `AGENTS.md`
- `spicedanime-bible/00-SpicedAnime-AI-Context-Summary.md`
- Volume 10 Decision Log
- Volume 4 Shopify Engineering Bible
- Volume 3 UX Page Architecture
- Volume 2 Design System

## Files Allowed to Edit

- [List exact files]

## Files Not Allowed to Edit

- `layout/theme.liquid`
- Cart files
- Product form files
- Variant picker files
- Checkout-related code
- Search files
- Payment button code
- Any file not listed under Files Allowed to Edit

## Rules

- Make the smallest safe change.
- Use `sa-` prefixed classes and files.
- Include Shopify schema for new sections.
- Preserve Shopify-native behavior.
- Include mobile responsive behavior.
- Include empty states.
- Do not add unnecessary libraries.
- Do not modify unrelated code.
- List all files changed.
- Give QA steps.
- Give rollback steps.
- Do not commit, push, deploy, or publish without explicit approval.

## Output Required

After editing, report:

- Files changed
- What changed
- Why it fits SpicedAnime
- Risk level
- Validation performed
- Desktop QA steps
- Mobile QA steps
- Edge cases checked
- Rollback instructions
- Remaining concerns
```

---

## Final Principle

When there is a choice between a broad clever change and a narrow safe change, choose the narrow safe change.

The goal is not merely to produce working code. The goal is to produce SpicedAnime-compatible code that is safe for a production-connected Shopify repository, easy to review, easy to test, and easy to reverse.
