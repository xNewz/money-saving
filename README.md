# Money Saving App

A personal finance tracking application built with **Next.js**, React, and Firebase.

## Features
- Server-Side Rendering & API Routes via Next.js
- Real-time data sync with Firebase Firestore
- Secure Authentication with Firebase Auth
- Beautiful UI with Tailwind CSS and shadcn/ui
- Built-in APIs for external integrations

## Getting Started

1. Clone the repository
2. Run `npm install`
3. Configure your `.env.local` file with Firebase credentials (using `NEXT_PUBLIC_` prefix)
4. Run `npm run dev` to start the development server

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
