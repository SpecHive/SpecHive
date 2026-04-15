# Changelog

## [0.0.14](https://github.com/SpecHive/SpecHive/compare/dashboard-v0.0.13...dashboard-v0.0.14) (2026-04-15)


### Bug Fixes

* resolve all pnpm audit vulnerabilities ([0b771d0](https://github.com/SpecHive/SpecHive/commit/0b771d07d9352dc670bea746a4ff614365491872))
* resolve DLQ'd events from phantom suite IDs ([01fd632](https://github.com/SpecHive/SpecHive/commit/01fd63249749a1bf8e0a29059feccc81d3997d85))

## [0.0.13](https://github.com/SpecHive/SpecHive/compare/dashboard-v0.0.12...dashboard-v0.0.13) (2026-04-04)


### Features

* **dashboard:** add real-time updates via Server-Sent Events ([9a5b43b](https://github.com/SpecHive/SpecHive/commit/9a5b43b7c7fbc252ef52e4e8c1cea0bc00e3a396))
* **dashboard:** add real-time updates via Server-Sent Events ([4e53a5f](https://github.com/SpecHive/SpecHive/commit/4e53a5fcc87f9d4700787e8853fdfe692414597c))

## [0.0.12](https://github.com/SpecHive/SpecHive/compare/dashboard-v0.0.11...dashboard-v0.0.12) (2026-04-02)


### Features

* add expectedTests, immediate test events, reliability fixes ([e2fed12](https://github.com/SpecHive/SpecHive/commit/e2fed12a0387fa5b6505ca5825e6863132385e8d))
* add expectedTests, immediate test events, reliability fixes ([15b45f8](https://github.com/SpecHive/SpecHive/commit/15b45f8dee58d425a8f03f18a74737269f052365))
* add structured error fields to test detail and persist from worker ([79597b1](https://github.com/SpecHive/SpecHive/commit/79597b128a93d2ea501b9efde0a389f2087ac44f))
* **dashboard:** pass project context through error explorer links ([9032d56](https://github.com/SpecHive/SpecHive/commit/9032d5604a50cda621e5f054fecefb7981d213c8))
* **dashboard:** pass project context through error explorer links ([275f40d](https://github.com/SpecHive/SpecHive/commit/275f40db20267467d3f2962b9fd9f050e02278b0))
* error fingerprinting ([d100c59](https://github.com/SpecHive/SpecHive/commit/d100c597a3c68ab25a79b7aa9f9736458b289e43))
* error fingerprinting with date-scoped lastSeenAt ([2e89efd](https://github.com/SpecHive/SpecHive/commit/2e89efdf7a9a4b49dd080b9ca904a5bb498a8939))
* improve error explorer UX — fix overflow, simplify tabs, relocate filters ([6399ae5](https://github.com/SpecHive/SpecHive/commit/6399ae58403d093630bbd7fe1f8386f1ec30c548))
* improve error fingerprinting with reporter-first architecture and UX enhancements ([733e2be](https://github.com/SpecHive/SpecHive/commit/733e2bea925894931b4c3e95105d0fbb2409eb39))
* show color-coded category badges, fix ANSI parsing bug in reporter ([10565fb](https://github.com/SpecHive/SpecHive/commit/10565fb230328925e42f79ecfa10b29d1354c557))


### Bug Fixes

* address error explorer code review — correctness, quality, and test coverage ([f40fb1b](https://github.com/SpecHive/SpecHive/commit/f40fb1bd959cee7dfb9c38f789d3450156383d2e))
* address error explorer code review findings ([3e2df9a](https://github.com/SpecHive/SpecHive/commit/3e2df9a7408e0e31da5784845d76914793deb2af))
* address error explorer review — correctness, perf, and UX issues ([e3e052a](https://github.com/SpecHive/SpecHive/commit/e3e052a0533cbc9ab05546a3d2ea658fcda850d1))
* address error explorer review — correctness, UX, and documentation ([661aad1](https://github.com/SpecHive/SpecHive/commit/661aad147d90ba56b8b0b429b0ab31ee67e9f59a))
* address error explorer review — fingerprint normalization, ANSI safety, and UX ([6a8b7d1](https://github.com/SpecHive/SpecHive/commit/6a8b7d1137996151aac63c942cf3d908a19445a3))
* address error explorer review — security, correctness, and shared hooks ([2e7019f](https://github.com/SpecHive/SpecHive/commit/2e7019f11944de2c261b1ca7c5ac4f52d968c75c))
* **dashboard:** clean up project context — remove over-engineering ([2d4222a](https://github.com/SpecHive/SpecHive/commit/2d4222aaa4a48644509c55c87cece06dd2e7614f))
* **dashboard:** clean up project context over-engineering ([f9a1887](https://github.com/SpecHive/SpecHive/commit/f9a18878532ec1914418d471d0c016497e861294))
* harden error fingerprinting, explorer queries, and reporter parsing ([7edba06](https://github.com/SpecHive/SpecHive/commit/7edba0626751877551f48a84f0f881aa976d4d26))
* resolve error explorer bugs and add integration tests ([8cf1185](https://github.com/SpecHive/SpecHive/commit/8cf1185c233e4a60af69c8017a77057551e5a6f0))


### Refactoring

* address error explorer code review findings ([8a45292](https://github.com/SpecHive/SpecHive/commit/8a4529212ba20b5e962469299b725a0cd020a4d3))
* fold error_category CHECK constraint into migration 0026 ([cadc377](https://github.com/SpecHive/SpecHive/commit/cadc377c30e40232411a18b67489ca4036714daa))
* simplify error explorer — remove dual-path queries and fix review findings ([5220572](https://github.com/SpecHive/SpecHive/commit/5220572fa851434158f9bea23181d9156f562ec1))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/api-types bumped to 0.0.6

## [0.0.11](https://github.com/SpecHive/SpecHive/compare/dashboard-v0.0.10...dashboard-v0.0.11) (2026-03-29)


### Bug Fixes

* **dashboard:** pass VITE_API_URL build arg in Docker publish workflow ([4d6235d](https://github.com/SpecHive/SpecHive/commit/4d6235d76242debb7d7bf74bf58521a8c1365718))

## [0.0.10](https://github.com/SpecHive/SpecHive/compare/dashboard-v0.0.9...dashboard-v0.0.10) (2026-03-26)


### Refactoring

* consolidate env vars — drop DASHBOARD_URL, rename WORKER_WEBHOOK_URL ([f517571](https://github.com/SpecHive/SpecHive/commit/f5175715fb81b8c165c2e0e2d5cab7d677d1e13e))
* standardize ports and env management ([094d85c](https://github.com/SpecHive/SpecHive/commit/094d85cc748e961298f3125a52402b8145346573))

## [0.0.9](https://github.com/SpecHive/SpecHive/compare/dashboard-v0.0.8...dashboard-v0.0.9) (2026-03-24)


### Features

* Initial release ([06f75a3](https://github.com/SpecHive/SpecHive/commit/06f75a3143a3e0f86205f7e66affede7216e4a85))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/api-types bumped to 0.0.5
  * devDependencies
    * @spechive/typescript-config bumped to 0.0.4

## [0.0.8](https://github.com/SpecHive/SpecHive/compare/dashboard-v0.0.7...dashboard-v0.0.8) (2026-03-21)


### Bug Fixes

* **dashboard:** fix open redirect and duplicate navigation in auth flow ([aef600a](https://github.com/SpecHive/SpecHive/commit/aef600afbdfe31f560b35436d4a96a07be12820d))

## [0.0.7](https://github.com/SpecHive/SpecHive/compare/dashboard-v0.0.6...dashboard-v0.0.7) (2026-03-20)


### Features

* **dashboard:** add widget position registration and PUT/rawBody support ([1012f6a](https://github.com/SpecHive/SpecHive/commit/1012f6ad0247447620a76587e1c33e14033e8420))

## [0.0.6](https://github.com/SpecHive/SpecHive/compare/dashboard-v0.0.5...dashboard-v0.0.6) (2026-03-19)


### Features

* **dashboard:** redesign sidebar layout and add plugin widget support ([90a1d24](https://github.com/SpecHive/SpecHive/commit/90a1d24b72d14788183eeef10d7f42b15dab28ba))

## [0.0.5](https://github.com/SpecHive/SpecHive/compare/dashboard-v0.0.4...dashboard-v0.0.5) (2026-03-19)


### Bug Fixes

* **dashboard:** add keyboard accessibility to sortable table headers ([b7f906d](https://github.com/SpecHive/SpecHive/commit/b7f906d55608f48ace93ee0d7b9b5573cc894fb8))

## [0.0.4](https://github.com/SpecHive/SpecHive/compare/dashboard-v0.0.3...dashboard-v0.0.4) (2026-03-18)


### Features

* **analytics:** add health scores, sparklines, period-over-period deltas, and enriched comparison ([16fa453](https://github.com/SpecHive/SpecHive/commit/16fa4538a54705d9e88ab818a165d6b2d0da63c2))
* **dashboard,query-api:** refactor to feature-based architecture with org-level APIs ([8e5e5ec](https://github.com/SpecHive/SpecHive/commit/8e5e5ec5019e2032d02aef540daf2ea7e38b8bf3))
* **query-api,nestjs-common:** add Redis-backed login rate limiting ([df56b71](https://github.com/SpecHive/SpecHive/commit/df56b71be05615881a48581e4eebdddac5da3554))

## [0.0.3](https://github.com/SpecHive/SpecHive/compare/dashboard-v0.0.2...dashboard-v0.0.3) (2026-03-17)


### Bug Fixes

* pre-release security hardening, RBAC, and code quality sweep ([f7cee0d](https://github.com/SpecHive/SpecHive/commit/f7cee0dfe2fd6e4f6b46f9aef218ef70b92a149d))

## [0.0.2](https://github.com/SpecHive/SpecHive/compare/dashboard-v0.0.1...dashboard-v0.0.2) (2026-03-14)


### Features

* add barrel exports, plugin system, and cloud extension points ([2cb0c9b](https://github.com/SpecHive/SpecHive/commit/2cb0c9b734550bbdf0ac72edf0db015b39faec93))
* add npm token secrets to docker builds, upgrade outboxy to v0.4.0 ([3f59e5f](https://github.com/SpecHive/SpecHive/commit/3f59e5f823acc406c35eaa23d8ca199e7aabc3df))
* add organization switcher endpoint and sidebar dropdown ([e839de6](https://github.com/SpecHive/SpecHive/commit/e839de6114e6684ea264c2fd21efa54d193c9c39))
* **api:** project creation and token lifecycle management ([bf95b27](https://github.com/SpecHive/SpecHive/commit/bf95b2785569d656941c81cea806b67d68a65214))
* connect dashboard to query-api with real auth and data ([c8133e6](https://github.com/SpecHive/SpecHive/commit/c8133e6d7a58a3d4e572b727c2dec67999511a1c))
* dashboard audit fixes, api-types package, worker auto-discovery, capabilities endpoint ([9ab143f](https://github.com/SpecHive/SpecHive/commit/9ab143ffd7bdb199db064fd1d7d810cf2c0f5364))
* **dashboard:** add analytics charts, server-side KPIs, and trend visualizations ([3088e70](https://github.com/SpecHive/SpecHive/commit/3088e7090c89c91f07f94ea7461b93c40e6eb390))
* **dashboard:** add error boundary for graceful rendering error recovery ([b2de9bc](https://github.com/SpecHive/SpecHive/commit/b2de9bcb389fdc3cee12e099abcd39013d78473b))
* **dashboard:** add KPI tooltips, fix flaky analytics query ([6fb723a](https://github.com/SpecHive/SpecHive/commit/6fb723a461ee87023e31b9802cbbfc091306a7d1))
* **dashboard:** add suite tree view with filtering on run detail page ([db18195](https://github.com/SpecHive/SpecHive/commit/db18195daebec8d667a0a66d589d347ed71baef8))
* **dashboard:** add theme cycling support ([dac6f73](https://github.com/SpecHive/SpecHive/commit/dac6f738eca23ef0c33b1ba57c415a45df176da5))
* **dashboard:** add toasts, search, sorting, and auth expiry UX ([0dba55d](https://github.com/SpecHive/SpecHive/commit/0dba55d9f99e8f9b1716e503c34752c26c19e512))
* **dashboard:** display run name in runs list, detail page, and dashboard ([c6633f6](https://github.com/SpecHive/SpecHive/commit/c6633f6d9a7ff5ae25b8cc979054500b8f4340a8))
* **dashboard:** persist jwt in session storage to survive page refresh ([4121360](https://github.com/SpecHive/SpecHive/commit/4121360633807a71ebb3f1821d7060fd69c19c33))
* **dashboard:** shared project context, page header, and token management ([5449d3c](https://github.com/SpecHive/SpecHive/commit/5449d3cd2b29536b0b3e9d66d3a3120b861a4816))
* **database:** add name column to runs table ([1377b85](https://github.com/SpecHive/SpecHive/commit/1377b85afabde15ed32464a26e8ba938dc50d340))
* **platform:** add automatic CI environment detection for test runs ([da2e126](https://github.com/SpecHive/SpecHive/commit/da2e1267e0d491ae37ee2e93a1bc8a67b939a8ed))
* **platform:** add organization member management and invitation system ([61fc96d](https://github.com/SpecHive/SpecHive/commit/61fc96ddf51878e0ebbf15baa3befabc40db96f8))
* **platform:** add test retry attempt tracking with per-attempt visibility ([e3c3358](https://github.com/SpecHive/SpecHive/commit/e3c3358575486001976f6e8c463582702834751a))
* **platform:** add user profile management with password change ([928c470](https://github.com/SpecHive/SpecHive/commit/928c47096f426c13261ae4bc054493fedcb73b48))
* **platform:** add user registration with onboarding flow ([b78287f](https://github.com/SpecHive/SpecHive/commit/b78287fc063d33c7f794d3a2753aa4489e5aaffe))
* **query-api:** add analytics backend with aggregation endpoints ([891d513](https://github.com/SpecHive/SpecHive/commit/891d5139297ee33fb898c9464f79abf738021b3f))
* **query-api:** add suites list endpoint for run suite hierarchy ([b5d83a0](https://github.com/SpecHive/SpecHive/commit/b5d83a0cd236c7ccaf6aabdb8c2240465869fedf))


### Bug Fixes

* address audit findings for config, dry, type safety, tests, and architecture ([1583d68](https://github.com/SpecHive/SpecHive/commit/1583d68ee951b435daaf5aeff89cfa301e496a54))
* **dashboard,query-api:** fix login status code, remove dead links, show user info in sidebar ([25bc791](https://github.com/SpecHive/SpecHive/commit/25bc791b17ffbbb17e1e7a3e5451ac094e0e2314))
* **dashboard:** render stack trace field instead of error message in trace section ([259cebc](https://github.com/SpecHive/SpecHive/commit/259cebcc2dc2bffd088ff1e168128a1cf9e39055))
* **platform:** critical audit fixes — Dockerfiles, CI, artifact states, timing oracle, deps ([073e88b](https://github.com/SpecHive/SpecHive/commit/073e88bfa2671760d06ee251fc5e412acf5fdedd))
* **platform:** post-audit remediation — type safety, DRY, and defense-in-depth ([49c91f7](https://github.com/SpecHive/SpecHive/commit/49c91f7c9f58d76096acc85af20288c3122e49a2))
* resolve all critical sprint 0 audit findings ([87e3237](https://github.com/SpecHive/SpecHive/commit/87e3237ab494090fca12328340161f40cf1aa334))
* resolve code quality findings for error filter, dry, validation, architecture ([41f8a6c](https://github.com/SpecHive/SpecHive/commit/41f8a6c0e88e244440bb5dea25db074798a299ef))
* resolve infrastructure findings for dockerfiles, ci, nginx, dependencies ([18e06a0](https://github.com/SpecHive/SpecHive/commit/18e06a0600ff83551923626c4648148e90d66c4b))
* resolve sprint 0 audit findings across monorepo ([945a319](https://github.com/SpecHive/SpecHive/commit/945a319a92db62c311ac79b6154a8f8f4fee850b))
* **security:** add refresh tokens, rate limiting, and tenant isolation tests ([34c41ef](https://github.com/SpecHive/SpecHive/commit/34c41efaba12ccff820acc2a5593d4238da1f3c0))
* **test:** set baseUrl in api-client tests for CI environment ([d747242](https://github.com/SpecHive/SpecHive/commit/d747242b01b219637792794a8527288f10470327))


### Refactoring

* extract shared nestjs-common package, upgrade dashboard to vite 7 + nginx ([a733eab](https://github.com/SpecHive/SpecHive/commit/a733eab76472eb1afb407162baf08c85bcf75bf1))
* harden security, extract shared configs, and add org_id to project_tokens ([0845e3c](https://github.com/SpecHive/SpecHive/commit/0845e3c2d0c3f23fc71187b5558fe55c21816040))
* harden token hashing, extract shared bootstrap, and propagate org ids ([31a653b](https://github.com/SpecHive/SpecHive/commit/31a653bc9b6e828407cd0ab1991fd9b6853fcc00))
* **platform:** extract shared infra, add runtime validation, DRY patterns ([8f06a56](https://github.com/SpecHive/SpecHive/commit/8f06a5619692d3b786d421c054bc6dd92897ccb6))
