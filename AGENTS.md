# Project-Specific Guidelines

## React State Declarations
- **MANDATORY**: Always declare all `useState` hooks at the very top of the `App` component (or any functional component).
- **REASON**: Prevents `ReferenceError: can't access lexical declaration '...' before initialization` when hooks or effects try to access state variables in their dependency arrays or bodies.

## Google Sheets Authentication
- **ROBUST KEY PARSING**: The `getAuth` function in `server.ts` is designed to handle various malformed private key formats (JSON strings, missing newlines, escaped `\n`).
- **PEM FORMATTING**: OpenSSL 3 is extremely strict. If modifying the auth logic, ensure the private key always includes the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` headers and that the base64 content is properly wrapped with newlines.
- **DEBUGGING**: Use the `/api/debug/auth` endpoint to verify the state of environment variables without exposing the full secret.

## Timer Logic
- **COMPLETION TRIGGER**: The timer completion logic in `App.tsx` and `Timer.tsx` is sensitive to state updates. Ensure that `onComplete` is called exactly once when `timeLeft` reaches zero.
- **MODE SWITCHING**: Always switch the timer mode (Focus -> Break) immediately upon completion to reset the UI state.
