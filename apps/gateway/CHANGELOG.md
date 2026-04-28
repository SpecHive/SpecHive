# Changelog

## [0.0.17](https://github.com/SpecHive/SpecHive/compare/gateway-v0.0.16...gateway-v0.0.17) (2026-04-28)


### Features

* **observability:** metrics and dashboards ([5a4cbc3](https://github.com/SpecHive/SpecHive/commit/5a4cbc3307e13f2a035611dbdb176ae436d65958))
* **observability:** metrics and dashboards ([b6a11e1](https://github.com/SpecHive/SpecHive/commit/b6a11e1823e7d1a85e8a34d0614653a896fc0232))


### Bug Fixes

* correct broken spechive-dev/spechive URL references across repo ([6e89f17](https://github.com/SpecHive/SpecHive/commit/6e89f171e9fa41a8cc3119a2ceab26d3bd83fc9e))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.14
    * @spechive/nestjs-common bumped to 0.0.18
    * @spechive/shared-types bumped to 0.0.5
  * devDependencies
    * @spechive/typescript-config bumped to 0.0.5

## [0.0.16](https://github.com/SpecHive/SpecHive/compare/gateway-v0.0.15...gateway-v0.0.16) (2026-04-15)


### Bug Fixes

* resolve all pnpm audit vulnerabilities ([0b771d0](https://github.com/SpecHive/SpecHive/commit/0b771d07d9352dc670bea746a4ff614365491872))
* resolve DLQ'd events from phantom suite IDs ([01fd632](https://github.com/SpecHive/SpecHive/commit/01fd63249749a1bf8e0a29059feccc81d3997d85))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.13
    * @spechive/nestjs-common bumped to 0.0.17

## [0.0.15](https://github.com/SpecHive/SpecHive/compare/gateway-v0.0.14...gateway-v0.0.15) (2026-04-04)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.16

## [0.0.14](https://github.com/SpecHive/SpecHive/compare/gateway-v0.0.13...gateway-v0.0.14) (2026-04-04)


### Features

* **dashboard:** add real-time updates via Server-Sent Events ([9a5b43b](https://github.com/SpecHive/SpecHive/commit/9a5b43b7c7fbc252ef52e4e8c1cea0bc00e3a396))
* **dashboard:** add real-time updates via Server-Sent Events ([4e53a5f](https://github.com/SpecHive/SpecHive/commit/4e53a5fcc87f9d4700787e8853fdfe692414597c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.15

## [0.0.13](https://github.com/SpecHive/SpecHive/compare/gateway-v0.0.12...gateway-v0.0.13) (2026-04-02)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.14

## [0.0.12](https://github.com/SpecHive/SpecHive/compare/gateway-v0.0.11...gateway-v0.0.12) (2026-04-02)


### Features

* add expectedTests, immediate test events, reliability fixes ([e2fed12](https://github.com/SpecHive/SpecHive/commit/e2fed12a0387fa5b6505ca5825e6863132385e8d))
* add expectedTests, immediate test events, reliability fixes ([15b45f8](https://github.com/SpecHive/SpecHive/commit/15b45f8dee58d425a8f03f18a74737269f052365))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.12
    * @spechive/nestjs-common bumped to 0.0.13
    * @spechive/shared-types bumped to 0.0.4

## [0.0.11](https://github.com/SpecHive/SpecHive/compare/gateway-v0.0.10...gateway-v0.0.11) (2026-03-29)


### Refactoring

* **nestjs-common:** migrate to nestjs-pino structured logging ([d511677](https://github.com/SpecHive/SpecHive/commit/d511677653c45c0b86d5d9cb1c890d33c1c438ff))
* **nestjs-common:** migrate to nestjs-pino structured logging ([d77e98e](https://github.com/SpecHive/SpecHive/commit/d77e98e60d6253ff16496974f0ab6c6fcb85c840))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.12

## [0.0.10](https://github.com/SpecHive/SpecHive/compare/gateway-v0.0.9...gateway-v0.0.10) (2026-03-26)


### Refactoring

* reassign service ports with gateway as public entry on :3000 ([1f08b92](https://github.com/SpecHive/SpecHive/commit/1f08b92b20f11db202acbcdc4ca0e18e4de934c3))
* standardize ports and env management ([094d85c](https://github.com/SpecHive/SpecHive/commit/094d85cc748e961298f3125a52402b8145346573))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.11

## [0.0.9](https://github.com/SpecHive/SpecHive/compare/gateway-v0.0.8...gateway-v0.0.9) (2026-03-24)


### Features

* Initial release ([06f75a3](https://github.com/SpecHive/SpecHive/commit/06f75a3143a3e0f86205f7e66affede7216e4a85))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.11
    * @spechive/nestjs-common bumped to 0.0.10

## [0.0.8](https://github.com/SpecHive/SpecHive/compare/gateway-v0.0.7...gateway-v0.0.8) (2026-03-24)


### Features

* Initial release ([06f75a3](https://github.com/SpecHive/SpecHive/commit/06f75a3143a3e0f86205f7e66affede7216e4a85))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.10
    * @spechive/nestjs-common bumped to 0.0.9
    * @spechive/shared-types bumped to 0.0.3
  * devDependencies
    * @spechive/typescript-config bumped to 0.0.4

## [0.0.7](https://github.com/SpecHive/SpecHive/compare/gateway-v0.0.6...gateway-v0.0.7) (2026-03-22)


### Features

* add API Gateway with reverse proxy for multi-service routing ([06ae577](https://github.com/SpecHive/SpecHive/commit/06ae577e908b7b0e114eec941148b024cc923a4c))
* **analytics:** implement daily pre-aggregation and analytics service ([#2](https://github.com/SpecHive/SpecHive/issues/2).2/[#2](https://github.com/SpecHive/SpecHive/issues/2).3) ([ecc5ec9](https://github.com/SpecHive/SpecHive/commit/ecc5ec9b449f2bf61e0ba09402327d292fe48086))
* **dashboard,query-api:** refactor to feature-based architecture with org-level APIs ([8e5e5ec](https://github.com/SpecHive/SpecHive/commit/8e5e5ec5019e2032d02aef540daf2ea7e38b8bf3))
* **gateway:** add API gateway with auth, proxy routing, and dev networking fixes ([215edc3](https://github.com/SpecHive/SpecHive/commit/215edc333ebc0e65f0b63df9b0260e1f72b95395))


### Bug Fixes

* **docker:** use HUSKY=0 instead of --ignore-scripts to fix arm64 QEMU crash ([f605b37](https://github.com/SpecHive/SpecHive/commit/f605b37fc2e86d48a007faaf86377a50e52c47e7))
* pre-release security hardening, RBAC, and code quality sweep ([f7cee0d](https://github.com/SpecHive/SpecHive/commit/f7cee0dfe2fd6e4f6b46f9aef218ef70b92a149d))
* **worker,tests:** fix Date serialization in analytics handlers and seed stats tables in tests ([e1e9054](https://github.com/SpecHive/SpecHive/commit/e1e9054e88dd3fe9b9654f46fb242c7512fc0d08))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.9
    * @spechive/nestjs-common bumped to 0.0.8

## [0.0.6](https://github.com/SpecHive/SpecHive/compare/gateway-v0.0.5...gateway-v0.0.6) (2026-03-22)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.8
    * @spechive/nestjs-common bumped to 0.0.7

## [0.0.5](https://github.com/SpecHive/SpecHive/compare/gateway-v0.0.4...gateway-v0.0.5) (2026-03-20)


### Bug Fixes

* **docker:** use HUSKY=0 instead of --ignore-scripts to fix arm64 QEMU crash ([f605b37](https://github.com/SpecHive/SpecHive/commit/f605b37fc2e86d48a007faaf86377a50e52c47e7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.6

## [0.0.4](https://github.com/SpecHive/SpecHive/compare/gateway-v0.0.3...gateway-v0.0.4) (2026-03-19)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.7
    * @spechive/nestjs-common bumped to 0.0.5

## [0.0.3](https://github.com/SpecHive/SpecHive/compare/gateway-v0.0.2...gateway-v0.0.3) (2026-03-18)


### Features

* **dashboard,query-api:** refactor to feature-based architecture with org-level APIs ([8e5e5ec](https://github.com/SpecHive/SpecHive/commit/8e5e5ec5019e2032d02aef540daf2ea7e38b8bf3))

## [0.0.2](https://github.com/SpecHive/SpecHive/compare/gateway-v0.0.1...gateway-v0.0.2) (2026-03-17)


### Features

* add API Gateway with reverse proxy for multi-service routing ([06ae577](https://github.com/SpecHive/SpecHive/commit/06ae577e908b7b0e114eec941148b024cc923a4c))
* **analytics:** implement daily pre-aggregation and analytics service ([#2](https://github.com/SpecHive/SpecHive/issues/2).2/[#2](https://github.com/SpecHive/SpecHive/issues/2).3) ([ecc5ec9](https://github.com/SpecHive/SpecHive/commit/ecc5ec9b449f2bf61e0ba09402327d292fe48086))
* **gateway:** add API gateway with auth, proxy routing, and dev networking fixes ([215edc3](https://github.com/SpecHive/SpecHive/commit/215edc333ebc0e65f0b63df9b0260e1f72b95395))


### Bug Fixes

* pre-release security hardening, RBAC, and code quality sweep ([f7cee0d](https://github.com/SpecHive/SpecHive/commit/f7cee0dfe2fd6e4f6b46f9aef218ef70b92a149d))
* **worker,tests:** fix Date serialization in analytics handlers and seed stats tables in tests ([e1e9054](https://github.com/SpecHive/SpecHive/commit/e1e9054e88dd3fe9b9654f46fb242c7512fc0d08))
