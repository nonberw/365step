# ENT exam year implementation plan

Goal: A grade 10 student in the 2026/27 school year prepares for 2028, with an explicit year override.

Constraints: Preserve previous content changes, user rows and explicitly saved exam dates. No commits, publication or paid API calls.

- [x] Add shared school-year inference and year-specific tentative sessions; test November 2026 grade 10 → 2028, grade 11 → 2027, grade 9 → 2029, September boundary, explicit overrides and old draft migration.
- [x] Apply the selected year to registration, restored drafts, saved goals, profile editing, onboarding roadmap, ENT overview countdown and server plan input/cache.
- [x] Test saving/reopening 2028 goals and plan invalidation on a disposable database; run types/build and verify the onboarding page in the browser.

Validation: 47 ENT year assertions and 71 content API assertions passed on disposable databases. TypeScript and production build passed. Browser verified grade 10 → 2028 and manual switch to 2029. Preview uses a QA database with paid API credentials disabled.
