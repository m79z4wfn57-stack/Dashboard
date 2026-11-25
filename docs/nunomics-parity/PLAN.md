# Nunomics Tableau Parity Plan

## Purpose

This document is a provisional requirements inventory for delivering Tableau-equivalent authoring and consumption workflows in Superset. It is not a claim that any requirement is complete. A requirement can move to **verified** only when `STATUS.md` records implementation evidence and a focused automated test.

## Guardrails

- Preserve Superset's existing APIs, RBAC, row-level security, feature flags, and saved-object compatibility.
- Extend existing Explore, dashboard, dataset, and chart-plugin architecture before introducing parallel abstractions.
- Keep persisted chart and dashboard metadata backward compatible; gate migrations and breaking changes explicitly.
- Ship small vertical increments that remain usable, testable, and reversible.
- Prefer unit tests, then integration tests, and use Playwright only for critical cross-page workflows.

## Priority model

- **P0**: Required for the first complete author-to-viewer workflow (Milestone A).
- **P1**: Required for practical workbook migration and governed production use.
- **P2**: Advanced analytics, administration, and ecosystem breadth.

## Milestones

### Milestone A — Core authoring path (P0)

Deliver one secure, persistent workflow in this order:

1. Select an authorized dataset.
2. Place fields on Rows and Columns shelves.
3. Treat a categorical field as a dimension and a numeric field as `SUM` by default, with an editable aggregation.
4. Render a bar chart from the shelf state.
5. Add fields to Labels and Detail without changing the primary axes.
6. Add, edit, and remove worksheet filters.
7. Undo and redo authoring mutations without undoing server-side security decisions.
8. Save and reload the authored state without semantic drift.
9. Place the saved visualization on a dashboard.
10. Verify author and viewer permissions across dataset, chart, and dashboard access.

Milestone A acceptance requires a focused test at each step and an integration test covering save/reload and permissions. Existing Superset behavior may satisfy an item, but it remains unverified until the evidence is recorded in `STATUS.md`.

### Milestone B — Workbook authoring and dashboard interaction (P1)

- Multi-sheet workbook/container model with sheet naming, duplication, ordering, and navigation.
- Marks controls: color, size, shape, tooltip, label formatting, and detail.
- Sort, hierarchy, drill-down, groups, sets, bins, parameters, and reference lines.
- Dashboard filter, highlight, URL, navigation, and parameter actions.
- Device layouts, containers, shared filters, cross-filtering, and presentation mode.
- Import/migration mapping for supported Tableau workbook concepts with explicit unsupported diagnostics.

### Milestone C — Data semantics and calculations (P1)

- Physical and virtual datasets, joins/relationships, unions, metadata refresh, and lineage.
- Typed calculated fields with validation, dependency tracking, and reusable dataset-level definitions.
- Level-of-detail expressions: `FIXED`, `INCLUDE`, and `EXCLUDE`, with database-portable query generation.
- Table calculations, addressing/partitioning controls, rank, running totals, percent-of-total, and moving windows.
- Date semantics, fiscal calendars, geographic roles, null handling, aliases, and default formats.
- Extract/caching strategy with freshness, invalidation, and query-cost visibility.

### Milestone D — Advanced analytics and visualization breadth (P1/P2)

- Forecasting with configurable model inputs, confidence intervals, seasonality, and explainable failures.
- Trend lines, clustering, distribution bands, totals/subtotals, and statistical summaries.
- Visualization parity matrix covering tables, maps, scatter, dual axis, combo, heatmap, treemap, box plot, funnel, and extensible plugins.
- Accessible keyboard interaction, screen-reader semantics, palettes, and high-contrast rendering.

### Milestone E — Governance, distribution, and operations (P1/P2)

- RLS policy composition and author/viewer test coverage.
- SSO/OIDC/SAML integration compatibility and group/role synchronization.
- Multi-tenant isolation for metadata, cache keys, async jobs, assets, and audit events.
- Embedded dashboards with guest tokens, domain controls, tenant context, and configurable interaction.
- Branding and theming without bypassing content security or accessibility controls.
- PDF, image, CSV, crosstab, and packaged-content exports with permission enforcement.
- Alerts, subscriptions, schedules, delivery audit, retry, and recipient authorization.
- Performance budgets for authoring latency, query execution, rendering, dashboard load, and concurrency.

## Cross-cutting acceptance criteria

Every increment must document:

- Requirement identifier and user-visible outcome.
- Existing architecture reused and persisted schema/API impact.
- Authorization and RLS behavior.
- Backward-compatibility considerations.
- Focused automated tests and their result.
- Observability or performance impact when applicable.

## Provisional requirement inventory

| ID | Priority | Capability | Acceptance summary |
| --- | --- | --- | --- |
| A01 | P0 | Dataset selection | Only authorized datasets can be selected and queried. |
| A02 | P0 | Rows/Columns shelves | Typed fields can be placed, reordered, removed, and restored. |
| A03 | P0 | Dimension + SUM | Categorical dimensions and explicit/default `SUM` produce stable query semantics. |
| A04 | P0 | Bar chart | Shelf state generates and renders a bar chart through existing chart APIs. |
| A05 | P0 | Labels/Detail | Mark metadata enriches output without silently changing aggregation grain. |
| A06 | P0 | Filters | Worksheet filters round-trip and honor RLS. |
| A07 | P0 | Undo/Redo | Authoring mutations are reversible with bounded history. |
| A08 | P0 | Save/Reload | Semantic state round-trips through existing chart persistence. |
| A09 | P0 | Dashboard placement | A saved chart can be placed and persisted in dashboard layout. |
| A10 | P0 | Author/Viewer permissions | Read/write paths enforce existing RBAC, ownership, dataset access, and RLS. |
| B01 | P1 | Workbook/sheets | Multiple ordered sheets persist as a cohesive authoring unit. |
| B02 | P1 | Marks and formatting | Visual encodings and formats persist predictably. |
| B03 | P1 | Dashboard actions | Filter, highlight, URL, navigation, and parameter actions are permission-safe. |
| C01 | P1 | Data management | Governed modeling, refresh, lineage, and caching workflows are supported. |
| C02 | P1 | Calculated fields | Typed reusable calculations validate and execute portably. |
| C03 | P1 | LOD | `FIXED`, `INCLUDE`, and `EXCLUDE` have documented query semantics. |
| C04 | P1 | Table calculations | Partitioning/addressing and common calculations are reproducible. |
| D01 | P2 | Forecasting | Forecasts expose model settings, uncertainty, and failure diagnostics. |
| D02 | P1 | Visualization breadth | A maintained matrix maps supported Tableau visual forms and gaps. |
| E01 | P1 | RLS and identity | RLS, SSO, and role synchronization remain enforced end to end. |
| E02 | P1 | Multi-tenancy | Tenant boundaries cover metadata, execution, cache, jobs, and audit. |
| E03 | P1 | Embedding | Guest access and host integration preserve authorization boundaries. |
| E04 | P2 | Branding | Supported theme/brand configuration remains accessible and secure. |
| E05 | P1 | Exports | Export formats enforce the same data permissions as interactive views. |
| E06 | P1 | Alerts | Scheduled delivery is authorized, observable, and retry-safe. |
| E07 | P1 | Performance | Measurable budgets and representative benchmarks prevent regressions. |

## Delivery sequence

Work proceeds in inventory order beginning with A01. An item is split if it cannot be reviewed and tested as a small change. `STATUS.md` is updated in the same change as each implementation increment; no item is marked verified from documentation or feature resemblance alone.
