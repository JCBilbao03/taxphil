# Firebase Security Rules regression tests

Requires Node.js 22 or newer, npm, and a Java 21 or newer runtime on `PATH`. The first run downloads the official Firebase emulators. No Firebase sign-in is required.

From the repository root:

```sh
cd tests/security-rules
npm ci
npm test
```

The standalone package pins the same Firebase SDK, Rules test library and Firebase CLI versions used for release validation. It does not change the app's dependencies. Before creating fixtures, the test script loads the repository's actual `firestore.rules` and `storage.rules` via relative paths and installs them into the emulators using the Rules testing API; there are no test copies of the rules. The emulator startup warning about missing configured rules is expected; initialization must succeed before any assertion runs.

The command starts isolated Firestore and Storage emulators using the fixed `demo-taxphil-rules` project on localhost. The script refuses a different project or missing/unexpected emulator endpoints. Ports 18080, 19199, 19150, 14400 and 14500 must be available. Fixture data is synthetic and is cleared before and after testing; the emulators stop when the command exits.

Expected result: **151 assertions passed**. Coverage includes anonymous, unverified, inactive and foreign-company clients; all four company roles; accounting and directory reads; private employee, payroll and tax-draft reads; denied direct writes and membership elevation; document upload permissions; and denied overwrites, deletions, unsupported MIME types, empty files and files over 10 MiB.

The explicit `resource == null` create guards enforce document immutability even when an overwrite is classified as `create`, as happens in the [Firebase Storage emulator](https://github.com/firebase/firebase-tools/issues/10302).

These tests cover Security Rules. Live authentication, Cloud Functions, bucket CORS, payment callbacks and production service configuration require separate integration checks.
