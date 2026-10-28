# EventFlow Copilot Instructions

## Project boundaries

- EventFlow is an existing full-stack application. Preserve its React/Vite frontend, Express/Mongoose backend, and current folder structure; do not recreate or replace the architecture.
- Frontend code is in `client/src` and its Node test-runner tests are in `client/test`.
- Backend code is in `server/src` and its Node test-runner tests are in `server/test`.
- Keep changes focused. Do not modify dependency manifests unless the requested implementation requires a dependency change.

## Roles and access control

- Use the backend role names exactly: `administrator`, `organizer`, `participant`, and `vendor`.
- Backend authorization is authoritative. Preserve `verifyToken`, `authorizeRoles`, controller ownership checks, and input validation on protected operations. Frontend route guards improve navigation but do not replace backend authorization.
- Public registration is restricted to participants and organizers. Do not allow self-registration to assign administrator or vendor privileges.
- Do not expose password hashes, JWTs, database credentials, or other secrets. Never read or print `server/.env`; use safe examples or placeholders in documentation and tests.

## Backend conventions

- Keep HTTP routes in `server/src/routes`, request handling in `controllers`, persistence schemas in `models`, and input validation in `utils`.
- Reuse the existing Mongoose models, validation helpers, middleware, and response/error patterns. Preserve ownership and status-transition rules when changing workflows.
- Tests may inject in-memory stores through `app.locals.mock*Store` and dispatch requests through `server/test/testHelper.js`. Treat these as mock-store tests, not real MongoDB integration tests. Do not connect tests to MongoDB Atlas or perform destructive database operations.
- Keep static routes (for example, `/me` or `/incoming`) ahead of parameterized routes when route matching could otherwise capture them.

## Frontend conventions

- Put HTTP calls in the existing modules under `client/src/services` and use the shared Axios client in `services/api.js`; do not duplicate API base URLs or token handling in pages.
- Follow the existing `AuthContext`, `ProtectedRoute`, `RoleRoute`, `AppLayout`, and `AppRoutes` patterns for authentication, role-specific navigation, and page registration.
- Match existing page-level loading, error, and success handling. Verify that frontend request/response fields agree with the backend API contract before changing an integration.

## Validation

- Run backend tests from `server` with `npm test`; run frontend tests from `client` with `npm test`.
- For frontend production-build changes, run `npm run build` from `client`. Also run `git diff --check` for code changes.
- Report whether validation used mock stores or a real database; a successful mock-store test is not evidence of MongoDB Atlas integration.
