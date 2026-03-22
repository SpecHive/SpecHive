# Changelog

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
