# P0.11 experimental Cordova plugin fork

This is a fixture-only fork of `cordova-sqlite-storage` 7.0.0. It adds two native actions to the copied `SQLitePlugin.java` dispatcher and JavaScript API. `sessionLedgerPublish` has `phase: "reserve"` and `phase: "commit"`; the sequence is allocated and returned by native code. `sessionLedgerReconcile` accepts the sequence and identity metadata, then reads and verifies the native ledger after close/reopen. JavaScript does not submit a commit receipt.

The new ledger has a fixed private database filename separate from every Moodle database. Its executor is owned by the plugin instance and serializes reserve, publish, and reconcile operations. Ordinary SQLite actions keep their existing DBRunner path. This fork is only packaged in the synthetic P0.11 harness.
