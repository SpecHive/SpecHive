# Changelog

## [0.0.5](https://github.com/SpecHive/SpecHive/compare/database-v0.0.4...database-v0.0.5) (2026-03-17)


### Features

* **typescript-config,database:** add nestjs-library tsconfig preset and fix exports order ([0b5494b](https://github.com/SpecHive/SpecHive/commit/0b5494bb020c00dad06edad857937fbf6563873c))

## [0.0.4](https://github.com/SpecHive/SpecHive/compare/database-v0.0.3...database-v0.0.4) (2026-03-17)


### Features

* **analytics:** implement daily pre-aggregation and analytics service ([#2](https://github.com/SpecHive/SpecHive/issues/2).2/[#2](https://github.com/SpecHive/SpecHive/issues/2).3) ([ecc5ec9](https://github.com/SpecHive/SpecHive/commit/ecc5ec9b449f2bf61e0ba09402327d292fe48086))
* **database:** add pre-aggregation tables and partition tests/test_attempts ([85bce24](https://github.com/SpecHive/SpecHive/commit/85bce240b03726cfa510436cd4ab7e3c7ab0bcad))


### Bug Fixes

* pre-release security hardening, RBAC, and code quality sweep ([f7cee0d](https://github.com/SpecHive/SpecHive/commit/f7cee0dfe2fd6e4f6b46f9aef218ef70b92a149d))
* **worker,tests:** fix Date serialization in analytics handlers and seed stats tables in tests ([e1e9054](https://github.com/SpecHive/SpecHive/commit/e1e9054e88dd3fe9b9654f46fb242c7512fc0d08))

## [0.0.3](https://github.com/SpecHive/SpecHive/compare/database-v0.0.2...database-v0.0.3) (2026-03-15)


### Bug Fixes

* **database:** move drizzle-orm to peerDependencies ([5e1e43c](https://github.com/SpecHive/SpecHive/commit/5e1e43cfd9ec844af970f24488797d1d84c41b8a))

## [0.0.2](https://github.com/SpecHive/SpecHive/compare/database-v0.0.1...database-v0.0.2) (2026-03-14)


### Features

* add API Gateway with reverse proxy for multi-service routing ([06ae577](https://github.com/SpecHive/SpecHive/commit/06ae577e908b7b0e114eec941148b024cc923a4c))
* add barrel exports, plugin system, and cloud extension points ([2cb0c9b](https://github.com/SpecHive/SpecHive/commit/2cb0c9b734550bbdf0ac72edf0db015b39faec93))
* add enriched envelope schema, auth functions, s3 module, and shared utilities ([391928c](https://github.com/SpecHive/SpecHive/commit/391928c582d7783873862acd4f750d59809e4163))
* add npm token secrets to docker builds, upgrade outboxy to v0.4.0 ([3f59e5f](https://github.com/SpecHive/SpecHive/commit/3f59e5f823acc406c35eaa23d8ca199e7aabc3df))
* add S3 public endpoint, batch webhooks, and webhook secret validation ([fa5ded5](https://github.com/SpecHive/SpecHive/commit/fa5ded503dc0e3e6a4ee34e5503c266af8e53663))
* **api:** project creation and token lifecycle management ([bf95b27](https://github.com/SpecHive/SpecHive/commit/bf95b2785569d656941c81cea806b67d68a65214))
* **database:** add name column to runs table ([1377b85](https://github.com/SpecHive/SpecHive/commit/1377b85afabde15ed32464a26e8ba938dc50d340))
* **database:** enhance seed script with multiple projects and complex test data ([4f0c5ba](https://github.com/SpecHive/SpecHive/commit/4f0c5ba561e1c158fb66974bba6814e359c482f1))
* harden auth with RLS context, extract outboxy adapter, add integration tests ([11be8ef](https://github.com/SpecHive/SpecHive/commit/11be8ef24acda650add8ca9be682ffe6b707c42d))
* **platform:** add automatic artifact cleanup with S3 bulk delete ([2fe20b7](https://github.com/SpecHive/SpecHive/commit/2fe20b78f99b926243f323ae30df3e9f23ca33f6))
* **platform:** add automatic CI environment detection for test runs ([da2e126](https://github.com/SpecHive/SpecHive/commit/da2e1267e0d491ae37ee2e93a1bc8a67b939a8ed))
* **platform:** add organization member management and invitation system ([61fc96d](https://github.com/SpecHive/SpecHive/commit/61fc96ddf51878e0ebbf15baa3befabc40db96f8))
* **platform:** add test retry attempt tracking with per-attempt visibility ([e3c3358](https://github.com/SpecHive/SpecHive/commit/e3c3358575486001976f6e8c463582702834751a))
* **platform:** add user profile management with password change ([928c470](https://github.com/SpecHive/SpecHive/commit/928c47096f426c13261ae4bc054493fedcb73b48))
* **platform:** add user registration with onboarding flow ([b78287f](https://github.com/SpecHive/SpecHive/commit/b78287fc063d33c7f794d3a2753aa4489e5aaffe))
* **platform:** orphaned run detection, status guards, flaky index, prod hardening ([3fdbe07](https://github.com/SpecHive/SpecHive/commit/3fdbe07aafe0ca0139a09981a3d220848f555732))
* **query-api:** add analytics backend with aggregation endpoints ([891d513](https://github.com/SpecHive/SpecHive/commit/891d5139297ee33fb898c9464f79abf738021b3f))
* wire branded typescript ids, add postgresql row-level security ([2c9ab45](https://github.com/SpecHive/SpecHive/commit/2c9ab450bdf7361378ecef26401833bd1c5674f7))
* **worker:** add scheduled cleanup for stale pending artifacts ([76fcac0](https://github.com/SpecHive/SpecHive/commit/76fcac0ae54ec80a5733938b4f710d7658dce745))


### Bug Fixes

* activate rls tenant isolation, harden database and security baseline ([f1c7a46](https://github.com/SpecHive/SpecHive/commit/f1c7a466f6d2b49c9a4ed47e8776ebf613f90473))
* address audit findings for db, config, code quality, and tests ([259b774](https://github.com/SpecHive/SpecHive/commit/259b77465302ef92cafb999eabab85b961fec3f0))
* harden security, extract shared health module, and expand test coverage ([7a3bbd6](https://github.com/SpecHive/SpecHive/commit/7a3bbd605d73d26d08ea539c820e902cfafcd47f))
* **platform:** critical audit fixes — Dockerfiles, CI, artifact states, timing oracle, deps ([073e88b](https://github.com/SpecHive/SpecHive/commit/073e88bfa2671760d06ee251fc5e412acf5fdedd))
* **platform:** post-audit remediation — type safety, DRY, and defense-in-depth ([49c91f7](https://github.com/SpecHive/SpecHive/commit/49c91f7c9f58d76096acc85af20288c3122e49a2))
* resolve all critical sprint 0 audit findings ([87e3237](https://github.com/SpecHive/SpecHive/commit/87e3237ab494090fca12328340161f40cf1aa334))
* resolve infrastructure findings for dockerfiles, ci, nginx, dependencies ([18e06a0](https://github.com/SpecHive/SpecHive/commit/18e06a0600ff83551923626c4648148e90d66c4b))
* resolve sprint 0 audit findings across monorepo ([945a319](https://github.com/SpecHive/SpecHive/commit/945a319a92db62c311ac79b6154a8f8f4fee850b))
* resolve sprint 0 audit quick-win findings ([e9f6e99](https://github.com/SpecHive/SpecHive/commit/e9f6e997865648f1924f284e103a8ca4873324bf))
* **security:** add refresh tokens, rate limiting, and tenant isolation tests ([34c41ef](https://github.com/SpecHive/SpecHive/commit/34c41efaba12ccff820acc2a5593d4238da1f3c0))
* squash migrations, correct transaction types, and harden docker healthchecks ([a9c539f](https://github.com/SpecHive/SpecHive/commit/a9c539fe28a2fd31925068febe7fcf583146b4da))


### Refactoring

* harden security, extract shared configs, and add org_id to project_tokens ([0845e3c](https://github.com/SpecHive/SpecHive/commit/0845e3c2d0c3f23fc71187b5558fe55c21816040))
* harden token hashing, extract shared bootstrap, and propagate org ids ([31a653b](https://github.com/SpecHive/SpecHive/commit/31a653bc9b6e828407cd0ab1991fd9b6853fcc00))
* migrate token auth to argon2, propagate org ids, and harden docker roles ([06a70d4](https://github.com/SpecHive/SpecHive/commit/06a70d48db9d123979014fe541c067fc3ce471fe))
* scope minio credentials, add db constraints, and expand test coverage ([0f176b4](https://github.com/SpecHive/SpecHive/commit/0f176b481b7c0939f00aef2cc9400336ca381e1e))
* **test:** consolidate test utilities into shared helpers ([1ac1013](https://github.com/SpecHive/SpecHive/commit/1ac101336e5e57f34d31037c74f27ed0bad975d8))
* **test:** simplify test commands and remove skip patterns ([743a7a3](https://github.com/SpecHive/SpecHive/commit/743a7a3b18e935493130528d8906fc84e236189a))
