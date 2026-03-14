# Changelog

## [0.0.2](https://github.com/SpecHive/SpecHive/compare/nestjs-common-v0.0.1...nestjs-common-v0.0.2) (2026-03-14)


### Features

* add API Gateway with reverse proxy for multi-service routing ([06ae577](https://github.com/SpecHive/SpecHive/commit/06ae577e908b7b0e114eec941148b024cc923a4c))
* add barrel exports, plugin system, and cloud extension points ([2cb0c9b](https://github.com/SpecHive/SpecHive/commit/2cb0c9b734550bbdf0ac72edf0db015b39faec93))
* add enriched envelope schema, auth functions, s3 module, and shared utilities ([391928c](https://github.com/SpecHive/SpecHive/commit/391928c582d7783873862acd4f750d59809e4163))
* add S3 public endpoint, batch webhooks, and webhook secret validation ([fa5ded5](https://github.com/SpecHive/SpecHive/commit/fa5ded503dc0e3e6a4ee34e5503c266af8e53663))
* **database:** enhance seed script with multiple projects and complex test data ([4f0c5ba](https://github.com/SpecHive/SpecHive/commit/4f0c5ba561e1c158fb66974bba6814e359c482f1))
* harden auth with RLS context, extract outboxy adapter, add integration tests ([11be8ef](https://github.com/SpecHive/SpecHive/commit/11be8ef24acda650add8ca9be682ffe6b707c42d))
* **nestjs-common:** add health readiness probe with DB and S3 indicators ([f3cbb90](https://github.com/SpecHive/SpecHive/commit/f3cbb90afe1db620a4f2b8ce0676f6e4eab230bb))
* **platform:** add automatic artifact cleanup with S3 bulk delete ([2fe20b7](https://github.com/SpecHive/SpecHive/commit/2fe20b78f99b926243f323ae30df3e9f23ca33f6))
* **platform:** add graceful shutdown, parallelize queries, and shutdown integration test ([730d9c7](https://github.com/SpecHive/SpecHive/commit/730d9c74088f57ca6be8ab20c2dfb79524cce0ac))
* **platform:** add user profile management with password change ([928c470](https://github.com/SpecHive/SpecHive/commit/928c47096f426c13261ae4bc054493fedcb73b48))
* **platform:** orphaned run detection, status guards, flaky index, prod hardening ([3fdbe07](https://github.com/SpecHive/SpecHive/commit/3fdbe07aafe0ca0139a09981a3d220848f555732))
* **platform:** replace base64 artifact pipeline with direct S3 presigned uploads ([1ef92b1](https://github.com/SpecHive/SpecHive/commit/1ef92b1ead53f08cb804d004824b74ff6c850278))


### Bug Fixes

* address audit findings for db, config, code quality, and tests ([259b774](https://github.com/SpecHive/SpecHive/commit/259b77465302ef92cafb999eabab85b961fec3f0))
* harden security, extract shared health module, and expand test coverage ([7a3bbd6](https://github.com/SpecHive/SpecHive/commit/7a3bbd605d73d26d08ea539c820e902cfafcd47f))
* move NestJS peer deps to dependencies and fix docker init password substitution ([613f315](https://github.com/SpecHive/SpecHive/commit/613f315041d61e4d9be59024b1ebdd2fe08e9b37))
* **nestjs-common:** make DbHealthIndicator dependency optional ([9d3b75c](https://github.com/SpecHive/SpecHive/commit/9d3b75c1e2c69b188c8f2ccaea734fd36dcf5d87))
* **platform:** post-audit remediation — type safety, DRY, and defense-in-depth ([49c91f7](https://github.com/SpecHive/SpecHive/commit/49c91f7c9f58d76096acc85af20288c3122e49a2))
* resolve code quality findings for error filter, dry, validation, architecture ([41f8a6c](https://github.com/SpecHive/SpecHive/commit/41f8a6c0e88e244440bb5dea25db074798a299ef))
* resolve infrastructure findings for dockerfiles, ci, nginx, dependencies ([18e06a0](https://github.com/SpecHive/SpecHive/commit/18e06a0600ff83551923626c4648148e90d66c4b))
* resolve typecheck errors in worker and ingestion-api tests ([681ec09](https://github.com/SpecHive/SpecHive/commit/681ec096e32cee79a3a7b69ab018687eacd8d659))
* **security:** add refresh tokens, rate limiting, and tenant isolation tests ([34c41ef](https://github.com/SpecHive/SpecHive/commit/34c41efaba12ccff820acc2a5593d4238da1f3c0))


### Refactoring

* convert ingestion-api to publish-only mode ([07f5541](https://github.com/SpecHive/SpecHive/commit/07f5541fb4ec83f43f97011b4c71f501a5c10122))
* extract shared nestjs-common package, upgrade dashboard to vite 7 + nginx ([a733eab](https://github.com/SpecHive/SpecHive/commit/a733eab76472eb1afb407162baf08c85bcf75bf1))
* harden security, extract shared configs, and add org_id to project_tokens ([0845e3c](https://github.com/SpecHive/SpecHive/commit/0845e3c2d0c3f23fc71187b5558fe55c21816040))
* harden token hashing, extract shared bootstrap, and propagate org ids ([31a653b](https://github.com/SpecHive/SpecHive/commit/31a653bc9b6e828407cd0ab1991fd9b6853fcc00))
* migrate token auth to argon2, propagate org ids, and harden docker roles ([06a70d4](https://github.com/SpecHive/SpecHive/commit/06a70d48db9d123979014fe541c067fc3ce471fe))
* **platform:** extract shared infra, add runtime validation, DRY patterns ([8f06a56](https://github.com/SpecHive/SpecHive/commit/8f06a5619692d3b786d421c054bc6dd92897ccb6))
* scope minio credentials, add db constraints, and expand test coverage ([0f176b4](https://github.com/SpecHive/SpecHive/commit/0f176b481b7c0939f00aef2cc9400336ca381e1e))
