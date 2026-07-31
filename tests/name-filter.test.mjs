import assert from "node:assert/strict";
import test from "node:test";

import { hasBlockedName } from "../lib/name-filter.js";

test("blocks obvious and obfuscated inappropriate leaderboard names", () => {
  assert.equal(hasBlockedName("f.u.c.k"), true);
  assert.equal(hasBlockedName("sh111t"), true);
  assert.equal(hasBlockedName("Friendly Idiot"), true);
});

test("does not reject ordinary names containing partial matches", () => {
  assert.equal(hasBlockedName("Class Act"), false);
  assert.equal(hasBlockedName("Dickens"), false);
  assert.equal(hasBlockedName("Scunthorpe"), false);
});
