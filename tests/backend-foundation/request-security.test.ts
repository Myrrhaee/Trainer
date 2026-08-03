import assert from "node:assert/strict";
import test from "node:test";

import { isSameOriginRequest } from "../../lib/server/http/request-security";

test("same-origin protection accepts direct and reverse-proxy origins", () => {
  assert.equal(isSameOriginRequest(new Request("http://127.0.0.1:3011/api/test", {
    method: "POST",
    headers: { Origin: "http://127.0.0.1:3011" },
  })), true);

  assert.equal(isSameOriginRequest(new Request("http://internal-container:3000/api/test", {
    method: "POST",
    headers: {
      Origin: "https://alpha.example.test",
      "X-Forwarded-Host": "alpha.example.test",
      "X-Forwarded-Proto": "https",
    },
  })), true);
});

test("same-origin protection rejects absent and cross-site origins", () => {
  assert.equal(isSameOriginRequest(new Request("https://alpha.example.test/api/test", {
    method: "POST",
  })), false);
  assert.equal(isSameOriginRequest(new Request("https://alpha.example.test/api/test", {
    method: "POST",
    headers: { Origin: "https://attacker.example" },
  })), false);
});
