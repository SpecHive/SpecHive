# Changelog

## [0.0.7](https://github.com/SpecHive/SpecHive/compare/api-types-v0.0.6...api-types-v0.0.7) (2026-04-28)


### Features

* **observability:** metrics and dashboards ([b6a11e1](https://github.com/SpecHive/SpecHive/commit/b6a11e1823e7d1a85e8a34d0614653a896fc0232))


### Bug Fixes

* correct broken spechive-dev/spechive URL references across repo ([6e89f17](https://github.com/SpecHive/SpecHive/commit/6e89f171e9fa41a8cc3119a2ceab26d3bd83fc9e))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/shared-types bumped to 0.0.5
  * devDependencies
    * @spechive/typescript-config bumped to 0.0.5

## [0.0.6](https://github.com/SpecHive/SpecHive/compare/api-types-v0.0.5...api-types-v0.0.6) (2026-04-02)


### Features

* add expectedTests, immediate test events, reliability fixes ([e2fed12](https://github.com/SpecHive/SpecHive/commit/e2fed12a0387fa5b6505ca5825e6863132385e8d))
* add expectedTests, immediate test events, reliability fixes ([15b45f8](https://github.com/SpecHive/SpecHive/commit/15b45f8dee58d425a8f03f18a74737269f052365))
* add structured error fields to test detail and persist from worker ([79597b1](https://github.com/SpecHive/SpecHive/commit/79597b128a93d2ea501b9efde0a389f2087ac44f))
* error fingerprinting ([d100c59](https://github.com/SpecHive/SpecHive/commit/d100c597a3c68ab25a79b7aa9f9736458b289e43))
* error fingerprinting with date-scoped lastSeenAt ([2e89efd](https://github.com/SpecHive/SpecHive/commit/2e89efdf7a9a4b49dd080b9ca904a5bb498a8939))
* improve error explorer UX — fix overflow, simplify tabs, relocate filters ([6399ae5](https://github.com/SpecHive/SpecHive/commit/6399ae58403d093630bbd7fe1f8386f1ec30c548))
* improve error fingerprinting with reporter-first architecture and UX enhancements ([733e2be](https://github.com/SpecHive/SpecHive/commit/733e2bea925894931b4c3e95105d0fbb2409eb39))
* **query-api:** add error explorer endpoints and API types ([7863fc3](https://github.com/SpecHive/SpecHive/commit/7863fc31d910c3f2dacbdf29ae1bb8dbccba738a))
* show color-coded category badges, fix ANSI parsing bug in reporter ([10565fb](https://github.com/SpecHive/SpecHive/commit/10565fb230328925e42f79ecfa10b29d1354c557))


### Bug Fixes

* address error explorer review — security, correctness, and shared hooks ([2e7019f](https://github.com/SpecHive/SpecHive/commit/2e7019f11944de2c261b1ca7c5ac4f52d968c75c))


### Refactoring

* address error explorer code review findings ([8a45292](https://github.com/SpecHive/SpecHive/commit/8a4529212ba20b5e962469299b725a0cd020a4d3))
* address error explorer review — dead index, stale code, type safety ([8156398](https://github.com/SpecHive/SpecHive/commit/8156398c2799e0ea572a0f25a7146c0814598464))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/shared-types bumped to 0.0.4

## [0.0.5](https://github.com/SpecHive/SpecHive/compare/api-types-v0.0.4...api-types-v0.0.5) (2026-03-24)


### Features

* Initial release ([06f75a3](https://github.com/SpecHive/SpecHive/commit/06f75a3143a3e0f86205f7e66affede7216e4a85))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/shared-types bumped to 0.0.3
  * devDependencies
    * @spechive/typescript-config bumped to 0.0.4

## [0.0.4](https://github.com/SpecHive/SpecHive/compare/api-types-v0.0.3...api-types-v0.0.4) (2026-03-18)


### Features

* **analytics:** add health scores, sparklines, period-over-period deltas, and enriched comparison ([16fa453](https://github.com/SpecHive/SpecHive/commit/16fa4538a54705d9e88ab818a165d6b2d0da63c2))
* **dashboard,query-api:** refactor to feature-based architecture with org-level APIs ([8e5e5ec](https://github.com/SpecHive/SpecHive/commit/8e5e5ec5019e2032d02aef540daf2ea7e38b8bf3))

## [0.0.3](https://github.com/SpecHive/SpecHive/compare/api-types-v0.0.2...api-types-v0.0.3) (2026-03-17)


### Features

* **analytics:** implement daily pre-aggregation and analytics service ([#2](https://github.com/SpecHive/SpecHive/issues/2).2/[#2](https://github.com/SpecHive/SpecHive/issues/2).3) ([ecc5ec9](https://github.com/SpecHive/SpecHive/commit/ecc5ec9b449f2bf61e0ba09402327d292fe48086))

## [0.0.2](https://github.com/SpecHive/SpecHive/compare/api-types-v0.0.1...api-types-v0.0.2) (2026-03-14)


### Features

* **api:** project creation and token lifecycle management ([bf95b27](https://github.com/SpecHive/SpecHive/commit/bf95b2785569d656941c81cea806b67d68a65214))
* dashboard audit fixes, api-types package, worker auto-discovery, capabilities endpoint ([9ab143f](https://github.com/SpecHive/SpecHive/commit/9ab143ffd7bdb199db064fd1d7d810cf2c0f5364))
* **platform:** add automatic CI environment detection for test runs ([da2e126](https://github.com/SpecHive/SpecHive/commit/da2e1267e0d491ae37ee2e93a1bc8a67b939a8ed))
* **platform:** add organization member management and invitation system ([61fc96d](https://github.com/SpecHive/SpecHive/commit/61fc96ddf51878e0ebbf15baa3befabc40db96f8))
* **platform:** add test retry attempt tracking with per-attempt visibility ([e3c3358](https://github.com/SpecHive/SpecHive/commit/e3c3358575486001976f6e8c463582702834751a))
* **platform:** add user profile management with password change ([928c470](https://github.com/SpecHive/SpecHive/commit/928c47096f426c13261ae4bc054493fedcb73b48))


### Bug Fixes

* **platform:** post-audit remediation — type safety, DRY, and defense-in-depth ([49c91f7](https://github.com/SpecHive/SpecHive/commit/49c91f7c9f58d76096acc85af20288c3122e49a2))
* **security:** add refresh tokens, rate limiting, and tenant isolation tests ([34c41ef](https://github.com/SpecHive/SpecHive/commit/34c41efaba12ccff820acc2a5593d4238da1f3c0))
