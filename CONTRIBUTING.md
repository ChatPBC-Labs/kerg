# Contributing to Kerg

1. Keep the core **stdlib-only**: any new dependency must be an optional extra with a real justification.
2. Run the checks before opening a PR:

```bash
# python agent
cd kerg-agent
python -m venv .venv && .venv/Scripts/activate   # POSIX: . .venv/bin/activate
pip install -e .[dev]
pytest -q

# mobile client
cd ../kerg-mobile
npm install
npm test && npm run build
```

3. The known-answer test (`test_signed.py::test_known_vector` ↔ `kergClient.test.ts`) must stay in sync — it enforces sign parity between Python and TypeScript.
4. Safety changes require tests proving rejections.

Apache-2.0; contributions licensed the same.
