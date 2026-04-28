# Changelog

## [0.0.5](https://github.com/SpecHive/SpecHive/compare/shared-types-v0.0.4...shared-types-v0.0.5) (2026-04-28)


### Features

* **observability:** metrics and dashboards ([b6a11e1](https://github.com/SpecHive/SpecHive/commit/b6a11e1823e7d1a85e8a34d0614653a896fc0232))


### Bug Fixes

* correct broken spechive-dev/spechive URL references across repo ([6e89f17](https://github.com/SpecHive/SpecHive/commit/6e89f171e9fa41a8cc3119a2ceab26d3bd83fc9e))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @spechive/typescript-config bumped to 0.0.5

## [0.0.4](https://github.com/SpecHive/SpecHive/compare/shared-types-v0.0.3...shared-types-v0.0.4) (2026-04-02)


### Features

* add error fingerprinting and grouping for test failures ([45b6f81](https://github.com/SpecHive/SpecHive/commit/45b6f81eab9c45ac9a66a7e0a511875751f60f64))
* error fingerprinting ([d100c59](https://github.com/SpecHive/SpecHive/commit/d100c597a3c68ab25a79b7aa9f9736458b289e43))
* error fingerprinting with date-scoped lastSeenAt ([2e89efd](https://github.com/SpecHive/SpecHive/commit/2e89efdf7a9a4b49dd080b9ca904a5bb498a8939))


### Refactoring

* address error explorer code review findings ([8a45292](https://github.com/SpecHive/SpecHive/commit/8a4529212ba20b5e962469299b725a0cd020a4d3))

## [0.0.3](https://github.com/SpecHive/SpecHive/compare/shared-types-v0.0.2...shared-types-v0.0.3) (2026-03-24)


### Features

* Initial release ([06f75a3](https://github.com/SpecHive/SpecHive/commit/06f75a3143a3e0f86205f7e66affede7216e4a85))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @spechive/typescript-config bumped to 0.0.4

## [0.0.2](https://github.com/SpecHive/SpecHive/compare/shared-types-v0.0.1...shared-types-v0.0.2) (2026-03-14)


### Features

* add enriched envelope schema, auth functions, s3 module, and shared utilities ([391928c](https://github.com/SpecHive/SpecHive/commit/391928c582d7783873862acd4f750d59809e4163))
* **api:** project creation and token lifecycle management ([bf95b27](https://github.com/SpecHive/SpecHive/commit/bf95b2785569d656941c81cea806b67d68a65214))
* **platform:** add organization member management and invitation system ([61fc96d](https://github.com/SpecHive/SpecHive/commit/61fc96ddf51878e0ebbf15baa3befabc40db96f8))
* **platform:** add test retry attempt tracking with per-attempt visibility ([e3c3358](https://github.com/SpecHive/SpecHive/commit/e3c3358575486001976f6e8c463582702834751a))
* **worker:** strip ANSI escape codes from error messages and stack traces ([237c739](https://github.com/SpecHive/SpecHive/commit/237c73962b5d0b00ee27af34cbf0f085a68a62f5))


### Bug Fixes

* resolve infrastructure findings for dockerfiles, ci, nginx, dependencies ([18e06a0](https://github.com/SpecHive/SpecHive/commit/18e06a0600ff83551923626c4648148e90d66c4b))


### Refactoring

* harden security, extract shared configs, and add org_id to project_tokens ([0845e3c](https://github.com/SpecHive/SpecHive/commit/0845e3c2d0c3f23fc71187b5558fe55c21816040))
* harden token hashing, extract shared bootstrap, and propagate org ids ([31a653b](https://github.com/SpecHive/SpecHive/commit/31a653bc9b6e828407cd0ab1991fd9b6853fcc00))
* migrate token auth to argon2, propagate org ids, and harden docker roles ([06a70d4](https://github.com/SpecHive/SpecHive/commit/06a70d48db9d123979014fe541c067fc3ce471fe))
