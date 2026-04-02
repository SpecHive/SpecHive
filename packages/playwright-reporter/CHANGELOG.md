# Changelog

## [0.0.8](https://github.com/SpecHive/SpecHive/compare/playwright-reporter-v0.0.7...playwright-reporter-v0.0.8) (2026-04-02)


### Features

* add error fingerprinting and grouping for test failures ([45b6f81](https://github.com/SpecHive/SpecHive/commit/45b6f81eab9c45ac9a66a7e0a511875751f60f64))
* add expectedTests, immediate test events, reliability fixes ([e2fed12](https://github.com/SpecHive/SpecHive/commit/e2fed12a0387fa5b6505ca5825e6863132385e8d))
* add expectedTests, immediate test events, reliability fixes ([15b45f8](https://github.com/SpecHive/SpecHive/commit/15b45f8dee58d425a8f03f18a74737269f052365))
* error fingerprinting ([d100c59](https://github.com/SpecHive/SpecHive/commit/d100c597a3c68ab25a79b7aa9f9736458b289e43))
* error fingerprinting with date-scoped lastSeenAt ([2e89efd](https://github.com/SpecHive/SpecHive/commit/2e89efdf7a9a4b49dd080b9ca904a5bb498a8939))
* improve error fingerprinting with reporter-first architecture and UX enhancements ([733e2be](https://github.com/SpecHive/SpecHive/commit/733e2bea925894931b4c3e95105d0fbb2409eb39))
* **reporter:** add configurable log-level system ([080df7c](https://github.com/SpecHive/SpecHive/commit/080df7c2f8b5a2b0e6589f10b292fe95d09b1432))
* **reporter:** add configurable log-level system ([2be8322](https://github.com/SpecHive/SpecHive/commit/2be83220277755e5eaa38a1636b69086fc07012d))
* show color-coded category badges, fix ANSI parsing bug in reporter ([10565fb](https://github.com/SpecHive/SpecHive/commit/10565fb230328925e42f79ecfa10b29d1354c557))


### Bug Fixes

* address error explorer code review findings ([3e2df9a](https://github.com/SpecHive/SpecHive/commit/3e2df9a7408e0e31da5784845d76914793deb2af))
* address error explorer review — correctness, perf, and UX issues ([e3e052a](https://github.com/SpecHive/SpecHive/commit/e3e052a0533cbc9ab05546a3d2ea658fcda850d1))
* harden error fingerprinting, explorer queries, and reporter parsing ([7edba06](https://github.com/SpecHive/SpecHive/commit/7edba0626751877551f48a84f0f881aa976d4d26))
* resolve error explorer bugs and add integration tests ([8cf1185](https://github.com/SpecHive/SpecHive/commit/8cf1185c233e4a60af69c8017a77057551e5a6f0))


### Refactoring

* address error explorer code review findings ([8a45292](https://github.com/SpecHive/SpecHive/commit/8a4529212ba20b5e962469299b725a0cd020a4d3))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @spechive/reporter-client bumped to 0.0.3
    * @spechive/reporter-core-protocol bumped to 0.0.4
    * @spechive/shared-types bumped to 0.0.4

## [0.0.7](https://github.com/SpecHive/SpecHive/compare/playwright-reporter-v0.0.6...playwright-reporter-v0.0.7) (2026-03-27)


### Features

* **reporter-client:** extract shared reporter client from playwright-reporter ([808612e](https://github.com/SpecHive/SpecHive/commit/808612ed33d59cc839a46773248d2db9fad8cae5))
* **reporter-client:** extract shared reporter client from playwright-reporter ([d26ee7d](https://github.com/SpecHive/SpecHive/commit/d26ee7d96df4132f5f086f36ab39c415c2d43ef7))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @spechive/reporter-client bumped to 0.0.2

## [0.0.6](https://github.com/SpecHive/SpecHive/compare/playwright-reporter-v0.0.5...playwright-reporter-v0.0.6) (2026-03-25)


### Bug Fixes

* **playwright-reporter:** stub GITHUB_HEAD_REF in CI detection tests ([792af2a](https://github.com/SpecHive/SpecHive/commit/792af2a2ca9a566bba959936e8f7580580c4dafd))

## [0.0.5](https://github.com/SpecHive/SpecHive/compare/playwright-reporter-v0.0.4...playwright-reporter-v0.0.5) (2026-03-24)


### Features

* Initial release ([06f75a3](https://github.com/SpecHive/SpecHive/commit/06f75a3143a3e0f86205f7e66affede7216e4a85))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @spechive/reporter-core-protocol bumped to 0.0.3
    * @spechive/shared-types bumped to 0.0.3
    * @spechive/typescript-config bumped to 0.0.4

## [0.0.4](https://github.com/SpecHive/SpecHive/compare/playwright-reporter-v0.0.3...playwright-reporter-v0.0.4) (2026-03-22)


### Features

* **platform:** add automatic CI environment detection for test runs ([da2e126](https://github.com/SpecHive/SpecHive/commit/da2e1267e0d491ae37ee2e93a1bc8a67b939a8ed))
* **platform:** add test retry attempt tracking with per-attempt visibility ([e3c3358](https://github.com/SpecHive/SpecHive/commit/e3c3358575486001976f6e8c463582702834751a))
* **platform:** replace base64 artifact pipeline with direct S3 presigned uploads ([1ef92b1](https://github.com/SpecHive/SpecHive/commit/1ef92b1ead53f08cb804d004824b74ff6c850278))
* **playwright-reporter:** add artifact capture from test attachments ([c854516](https://github.com/SpecHive/SpecHive/commit/c85451628a5f4c529a862a0442eaf4cf2b302dba))
* **playwright-reporter:** add configurable run name with smart defaults ([bed12d6](https://github.com/SpecHive/SpecHive/commit/bed12d614c1887bab8b52a5a700d60d42f4f1726))
* **playwright-reporter:** add flaky test detection from Playwright retries ([13e4442](https://github.com/SpecHive/SpecHive/commit/13e444298546814ef839a30e20b40e4d38ba4139))
* **playwright-reporter:** add retry with exponential backoff and event queue ([c3d3896](https://github.com/SpecHive/SpecHive/commit/c3d38960c53256da103b1f2d3745d4d713e7f117))
* **playwright-reporter:** implement core lifecycle hooks and HTTP client ([17f0b66](https://github.com/SpecHive/SpecHive/commit/17f0b66bb0225228f34e65375696f762c59a4724))
* **playwright-reporter:** migrate to tsup build with improved config resolution ([8c70687](https://github.com/SpecHive/SpecHive/commit/8c70687f668e2a119195bbd40f76846edd6fcc28))
* **playwright-reporter:** scaffold package with Reporter interface ([18cd132](https://github.com/SpecHive/SpecHive/commit/18cd132c4ee3373fb2e4b059bdbf181c4fd6153c))


### Bug Fixes

* **test:** isolate CI detection tests from real environment variables ([2125ba1](https://github.com/SpecHive/SpecHive/commit/2125ba1628b5c8ceb7adb85642ef2190ed095eed))

## [0.0.3](https://github.com/SpecHive/SpecHive/compare/playwright-reporter-v0.0.2...playwright-reporter-v0.0.3) (2026-03-22)


### Features

* **playwright-reporter:** add configurable run name with smart defaults ([bed12d6](https://github.com/SpecHive/SpecHive/commit/bed12d614c1887bab8b52a5a700d60d42f4f1726))

## [0.0.2](https://github.com/SpecHive/SpecHive/compare/playwright-reporter-v0.0.1...playwright-reporter-v0.0.2) (2026-03-14)


### Features

* **platform:** add automatic CI environment detection for test runs ([da2e126](https://github.com/SpecHive/SpecHive/commit/da2e1267e0d491ae37ee2e93a1bc8a67b939a8ed))
* **platform:** add test retry attempt tracking with per-attempt visibility ([e3c3358](https://github.com/SpecHive/SpecHive/commit/e3c3358575486001976f6e8c463582702834751a))
* **platform:** replace base64 artifact pipeline with direct S3 presigned uploads ([1ef92b1](https://github.com/SpecHive/SpecHive/commit/1ef92b1ead53f08cb804d004824b74ff6c850278))
* **playwright-reporter:** add artifact capture from test attachments ([c854516](https://github.com/SpecHive/SpecHive/commit/c85451628a5f4c529a862a0442eaf4cf2b302dba))
* **playwright-reporter:** add flaky test detection from Playwright retries ([13e4442](https://github.com/SpecHive/SpecHive/commit/13e444298546814ef839a30e20b40e4d38ba4139))
* **playwright-reporter:** add retry with exponential backoff and event queue ([c3d3896](https://github.com/SpecHive/SpecHive/commit/c3d38960c53256da103b1f2d3745d4d713e7f117))
* **playwright-reporter:** implement core lifecycle hooks and HTTP client ([17f0b66](https://github.com/SpecHive/SpecHive/commit/17f0b66bb0225228f34e65375696f762c59a4724))
* **playwright-reporter:** migrate to tsup build with improved config resolution ([8c70687](https://github.com/SpecHive/SpecHive/commit/8c70687f668e2a119195bbd40f76846edd6fcc28))
* **playwright-reporter:** scaffold package with Reporter interface ([18cd132](https://github.com/SpecHive/SpecHive/commit/18cd132c4ee3373fb2e4b059bdbf181c4fd6153c))


### Bug Fixes

* **test:** isolate CI detection tests from real environment variables ([2125ba1](https://github.com/SpecHive/SpecHive/commit/2125ba1628b5c8ceb7adb85642ef2190ed095eed))
