<!--
Sync Impact Report - Constitution v1.0.0

VERSION CHANGE: Initial constitution (0.0.0 → 1.0.0)
BUMP RATIONALE: First formal adoption of project constitution establishing core principles

PRINCIPLES ESTABLISHED:
- Code Quality & Standards (Type Safety, Consistency)
- Testing Standards (Test-First Development)
- User Experience Consistency (Cross-Platform UX)
- Performance Requirements (Response Times, Build Performance)

SECTIONS ADDED:
- Core Principles (4 principles)
- Quality Gates
- Development Workflow
- Governance

TEMPLATES REQUIRING UPDATES:
✅ plan-template.md - Constitution Check section aligns with new principles
✅ spec-template.md - User Scenarios section supports testability principle
✅ tasks-template.md - Test-first workflow aligns with Principle II
✅ agent-file-template.md - No specific updates required (auto-generated)
✅ checklist-template.md - No specific updates required (command-driven)

FOLLOW-UP TODOS: None - all placeholders resolved
-->

# Kowalski Constitution

## Core Principles

### I. Code Quality & Standards (NON-NEGOTIABLE)

**Type Safety & Strict Compilation**

All code MUST compile without warnings or errors under strict mode:

- **TypeScript**: `verbatimModuleSyntax` enabled, all Oxlint rules enforced
- **Swift**: All packages MUST use `.treatAllWarnings(as: .error)` - zero tolerance for warnings
- **Type Declarations**: Explicit typing required; no implicit `any` or loose inference
- **Linting**: Oxlint (TypeScript) and SwiftLint violations block PR merge

**Consistency & Standards**

- **Naming Conventions**:
  - TypeScript: kebab-case files, camelCase vars/functions, PascalCase types/schemas
  - Swift: PascalCase files/types, camelCase vars/functions
- **Module System**:
  - TypeScript: ESM only with `.js` extensions on local imports
  - Swift: Swift Package Manager (SPM) for all packages
- **Error Handling**:
  - TypeScript: Custom exception classes extending `APIException`
  - Swift: Custom error enums with `errorDescription`, `Result<T, E>` for async ops
- **Constants**: Centralized in dedicated directories (`server/src/constants/`, shared configs)

**Rationale**: Type safety catches bugs at compile time, not runtime. Strict standards eliminate ambiguity, reduce cognitive load, and ensure code is self-documenting. Consistency across the monorepo makes context switching between TypeScript and Swift seamless.

### II. Testing Standards (NON-NEGOTIABLE)

**Test-First Development**

Tests MUST be written before implementation:

1. **Write tests** for user stories and acceptance criteria
2. **User approval** of test scenarios
3. **Tests MUST fail** (red state)
4. **Implement** feature to make tests pass (green state)
5. **Refactor** while maintaining green state

**Testing Requirements**

- **Contract Tests**: Required for all API endpoints and public library interfaces
- **Integration Tests**: Required for cross-service communication, database operations, auth flows
- **Unit Tests**: Required for business logic, utilities, transformations
- **Test Independence**: Each test MUST be runnable in isolation
- **Test Commands**:
  - TypeScript: `just test` (vitest), `pnpm test -- <filename>` for single tests
  - Swift: Xcode Test (Cmd+U), `swift test` for packages

**Coverage Standards**

- New features MUST have >80% coverage for business logic
- Critical paths (auth, payment, data persistence) MUST have 100% coverage
- Tests MUST verify both happy paths and error scenarios

**Rationale**: Test-first development ensures features are testable by design. Writing tests before code clarifies requirements, catches edge cases early, and creates living documentation. High coverage prevents regressions and enables confident refactoring.

### III. User Experience Consistency

**Cross-Platform UX Principles**

User experience MUST be consistent across iOS, macOS, and web:

- **Design System**: Use centralized `KowalskiDesignSystem` package for colors, typography, spacing
- **Component Reusability**: Share UI components across iOS/macOS where appropriate
- **Platform Conventions**: Follow Apple HIG for native apps, modern web standards for browser
- **Localization**: All user-facing strings MUST use `NSLocalizedString` (Swift) with `.xcstrings` files
  - **CRITICAL**: Never manually edit `.xcstrings` - Xcode auto-updates them
- **Accessibility**: Support VoiceOver, Dynamic Type, keyboard navigation, reduced motion

**Interaction Patterns**

- **Loading States**: Always show feedback for async operations >300ms
- **Error Messages**: User-friendly with actionable guidance, not technical jargon
- **Confirmations**: Require confirmation for destructive actions
- **Navigation**: Clear, predictable flows with proper back/cancel options

**Rationale**: Consistent UX reduces learning curve, builds user trust, and creates a professional feel. Centralized design systems prevent drift and enable rapid iteration. Accessibility is a core value, not an afterthought.

### IV. Performance Requirements

**Response Time Standards**

- **API Endpoints**: <200ms p95 latency for read operations, <500ms for writes
- **UI Rendering**: 60fps for all animations and scrolling (16ms frame budget)
- **Initial Load**: <2s for app launch (cold start), <1s for authenticated screens
- **Database Queries**: <100ms p95 with proper indexing

**Build & Development Performance**

- **TypeScript Hot Reload**: <1s for code changes in dev mode
- **Swift Compilation**: Incremental builds <5s for single file changes
- **Test Execution**: Unit test suite MUST complete <30s
- **CI Pipeline**: Full quality checks (lint + format + typecheck + test) <5min

**Resource Constraints**

- **Memory**: Server processes <500MB baseline, mobile apps <200MB foreground
- **Bundle Size**: iOS/macOS app <50MB download, web bundle <1MB initial load
- **Database Connections**: Connection pooling with max 20 concurrent connections

**Performance Monitoring**

- **Logging**: Structured logging for all API requests with timing data
- **Profiling**: Use Instruments (Swift) and Chrome DevTools (web) for optimization
- **Regression Prevention**: Performance tests MUST run in CI for critical paths

**Rationale**: Performance directly impacts user satisfaction and retention. Fast feedback loops during development boost productivity. Clear performance budgets prevent gradual degradation. Monitoring catches regressions before users notice.

## Quality Gates

**Pre-Implementation Gates**

Before starting any feature implementation:

1. **Constitution Check**: Verify alignment with all 4 core principles
2. **Test Planning**: Acceptance criteria defined and testable
3. **Performance Budget**: Establish measurable targets if applicable
4. **UX Review**: Design consistency validated against design system

**Pre-Merge Gates**

All pull requests MUST pass:

1. **Quality Command**: `just quality` (lint + format-check + typecheck) with zero errors
2. **Test Suite**: All tests passing with required coverage thresholds
3. **Build Verification**: Swift packages MUST build with `swift build` (zero warnings)
4. **Manual Testing**: Feature tested on target platforms (iOS, macOS, web as applicable)

**Violation Justification**

Any principle violation MUST be documented in plan.md "Complexity Tracking" section with:

- Which principle is violated and why
- Technical or business justification
- Mitigation plan and timeline for resolution
- Approval from team lead or architect

## Development Workflow

**Feature Development Lifecycle**

1. **Specification**: Create `spec.md` with user stories, acceptance criteria, requirements
2. **Planning**: Generate `plan.md` with technical approach, constitution check, structure
3. **Task Breakdown**: Create `tasks.md` organized by user story priority (P1, P2, P3...)
4. **Implementation**: Follow test-first development cycle per Principle II
5. **Review**: Validate against quality gates and constitution principles
6. **Deployment**: Staged rollout with monitoring and rollback plan

**Branch Strategy**

- **Feature Branches**: `[###-feature-name]` format (e.g., `001-user-authentication`)
- **Main Branch**: Always production-ready, protected with status checks
- **Hotfixes**: `hotfix/[description]` merged directly to main after fast-track review

**Code Review Requirements**

- Minimum 1 approval from team member familiar with area
- All comments resolved or explicitly deferred with issue created
- Constitution compliance verified (especially test coverage and type safety)
- Performance impact assessed for critical paths

## Governance

**Authority & Precedence**

This constitution supersedes all other project practices and guidelines. In case of conflict between this document and other guidance (README, AGENTS.md, templates), the constitution takes precedence.

**Amendment Process**

Constitution amendments require:

1. **Proposal**: Written RFC documenting change rationale and impact
2. **Impact Analysis**: Review of all templates and existing features for alignment
3. **Approval**: Consensus from project maintainers
4. **Migration Plan**: Update path for existing code that violates new principles
5. **Version Bump**: Follow semantic versioning rules for constitution updates

**Versioning Policy**

- **MAJOR** (x.0.0): Backward-incompatible changes - principle removals or redefinitions requiring code changes
- **MINOR** (0.x.0): New principles added or existing ones materially expanded
- **PATCH** (0.0.x): Clarifications, wording improvements, non-semantic refinements

**Compliance Review**

- **PR Reviews**: All pull requests MUST verify constitution compliance
- **Quarterly Audits**: Review existing codebase for drift from principles
- **Retrospectives**: Assess whether principles enabled or hindered productivity
- **Continuous Improvement**: Use learnings to propose amendments

**Runtime Development Guidance**

For day-to-day development practices, tooling setup, and commands, refer to `AGENTS.md`. This file provides concrete implementation guidance while the constitution defines non-negotiable principles.

**Version**: 1.0.0 | **Ratified**: 2025-11-15 | **Last Amended**: 2025-11-15
