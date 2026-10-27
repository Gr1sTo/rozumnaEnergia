import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { createDataManagerProxy } from "../api/proxy.server.js";
import { action, loader } from "../ApiProxy.js";

let server;
let origin;
let proxy;
let calls = [];
let reply;

function call(service, path, { method = "GET", body, headers = {}, signal } = {}, handler = proxy) {
  const request = new Request(`http://frontend.test/DataManager_Ryzhenko/api/${service}/${path}`, {
    method,
    headers,
    signal,
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
  return handler({ request, params: { service, "*": path.split("?")[0] } });
}

before(async () => {
  server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const entry = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: Buffer.concat(chunks).toString(),
    };
    calls.push(entry);
    if (reply) return reply(entry, response);
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ data: [], meta: { total: 0, pages: 0 } }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `http://127.0.0.1:${server.address().port}`;
  proxy = createDataManagerProxy({ env: {
    DATA_MANAGER_DOCUMENT_API_URL: `${origin}/api/v1`,
    DATA_MANAGER_RELATIONAL_API_URL: origin,
    DATA_MANAGER_FILE_API_URL: `${origin}/api/file`,
  } });
});

beforeEach(() => { calls = []; reply = undefined; });

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test("resource route exposes loader and action without a component", () => {
  assert.equal(typeof loader, "function");
  assert.equal(loader, action);
});

test("login preserves JSON and content type without forwarding cookies", async () => {
  reply = (_, response) => {
    response.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": "upstream=ignored" });
    response.end(JSON.stringify({ data: { access_token: "fixture-access-token" } }));
  };
  const payload = { username: "fixture-user", password: "fixture-only-password" };
  const result = await call("document", "auth/login", {
    method: "POST", body: payload,
    headers: { "Content-Type": "application/json", Cookie: "host-session=do-not-forward" },
  });
  assert.equal(result.status, 200);
  assert.equal(calls[0].url, "/api/v1/auth/login");
  assert.deepEqual(JSON.parse(calls[0].body), payload);
  assert.equal(calls[0].headers["content-type"], "application/json");
  assert.equal(calls[0].headers.cookie, undefined);
  assert.equal(result.headers.get("set-cookie"), null);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal((await result.json()).data.access_token, "fixture-access-token");
});

test("document filters preserve repeated tags, pagination, and Bearer", async () => {
  const query = "documents?page=2&page_size=25&tags=energy&tags=lab&sort=-created_at";
  await call("document", query, { headers: { Authorization: "Bearer fixture-session" } });
  assert.equal(calls[0].url, `/api/v1/${query}`);
  assert.equal(calls[0].headers.authorization, "Bearer fixture-session");
});

test("profile, data types, and admin user endpoints use their exact routes", async () => {
  for (const [method, path] of [
    ["GET", "auth/me"], ["GET", "data-types"], ["GET", "auth/users?page=1&role=admin"],
    ["POST", "auth/register"], ["PATCH", "auth/users/fixture-user"],
  ]) {
    const result = await call("document", path, { method, ...(method === "GET" ? {} : { body: {} }) });
    assert.equal(result.status, 200);
    assert.equal(calls.at(-1).url, `/api/v1/${path}`);
    assert.equal(calls.at(-1).method, method);
  }
});

test("document POST/PATCH/DELETE preserve payload and status", async () => {
  reply = (_, response) => { response.writeHead(201, { "Content-Type": "application/json" }); response.end('{"data":{"id":"fixture-doc"}}'); };
  const created = await call("document", "documents", { method: "POST", body: { payload: { power: 10 } } });
  assert.equal(created.status, 201);
  await call("document", "documents/fixture-doc", { method: "PATCH", body: { payload: { power: 11 } } });
  assert.deepEqual(JSON.parse(calls.at(-1).body), { payload: { power: 11 } });
  reply = (_, response) => { response.writeHead(204); response.end(); };
  const deleted = await call("document", "documents/fixture-doc", { method: "DELETE" });
  assert.equal(calls.at(-1).method, "DELETE");
  assert.equal(deleted.status, 204);
  assert.equal(await deleted.text(), "");
});

test("401, 403, 404, and 422 JSON responses retain status and diagnostics", async () => {
  for (const status of [401, 403, 404, 422]) {
    const body = { detail: `fixture-status-${status}` };
    reply = (_, response) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(body)); };
    const result = await call("document", "documents");
    assert.equal(result.status, status);
    assert.deepEqual(await result.json(), body);
    assert.equal(result.headers.get("cache-control"), "no-store");
  }
});

test("temperature POST preserves numbers and receives no document JWT or cookies", async () => {
  const record = { sensorId: -2, parameter: "TEMPERATURE", value: -4.25, timestamp: "2026-10-07T12:00:00Z" };
  reply = (_, response) => { response.writeHead(201, { "Content-Type": "application/json" }); response.end(JSON.stringify({ record: { id: 1, ...record } })); };
  const result = await call("relational", "api/temp-control/records", {
    method: "POST", body: record,
    headers: { Authorization: "Bearer must-not-leak", Cookie: "host-session=must-not-leak" },
  });
  assert.equal(result.status, 201);
  assert.deepEqual(JSON.parse(calls[0].body), record);
  assert.equal(calls[0].url, "/api/temp-control/records");
  assert.equal(calls[0].headers.authorization, undefined);
  assert.equal(calls[0].headers.cookie, undefined);
  assert.deepEqual((await result.json()).record, { id: 1, ...record });
});

test("temperature latest and exclusive range parameters retain their values", async () => {
  await call("relational", "api/temp-control/records/latest?sensorId=-2");
  assert.equal(calls[0].url, "/api/temp-control/records/latest?sensorId=-2");
  const query = "after=2026-10-07T11%3A59%3A59.000Z&before=2026-10-07T12%3A00%3A01.000Z";
  await call("relational", `api/temp-control/records?${query}`);
  assert.equal(calls[1].url, `/api/temp-control/records?${query}`);
});

test("file list/update/delete retain the existing API and strip auth", async () => {
  for (const [method, path] of [["GET", "data"], ["PUT", "data/1"], ["DELETE", "data/1"]]) {
    const result = await call("file", path, {
      method,
      headers: { Authorization: "Bearer must-not-leak", Cookie: "host-session=must-not-leak" },
      ...(method === "PUT" ? { body: { id: 1, name: "fixture-file" } } : {}),
    });
    assert.equal(result.status, 200);
    assert.equal(calls.at(-1).url, `/api/file/${path}`);
    assert.equal(calls.at(-1).method, method);
    assert.equal(calls.at(-1).headers.authorization, undefined);
    assert.equal(calls.at(-1).headers.cookie, undefined);
  }
});

test("encoded usernames retain literal percent characters without changing upstream paths", async () => {
  for (const username of ["meter%lab", "meter%2Flab", "%2e%2e", "сенсор №1"]) {
    const path = `auth/users/${encodeURIComponent(username)}`;
    const result = await call("document", path, { method: "PATCH", body: { full_name: "Updated user" } });
    assert.equal(result.status, 200);
    assert.equal(calls.at(-1).url, `/api/v1/${path}`);
  }
});

test("unknown services, arbitrary endpoints, traversal, and encoded separators never reach upstream", async () => {
  for (const [service, path] of [
    ["unknown", "documents"], ["__proto__", "documents"], ["document", "health"],
    ["document", "documents/%2e%2e/auth/login"],
    ["document", "documents/%2F%2Fevil.test"], ["document", "documents/%5Cevil.test"],
    ["document", "documents/%00"], ["document", "documents/%ZZ"],
    ["relational", "api/temp-control/records/../admin"], ["file", "http://evil.test/data"],
  ]) {
    const result = await call(service, path);
    // URL parsing can normalize dot segments to another known route, still denied here.
    assert.ok([400, 404, 405].includes(result.status), `${service}/${path}: ${result.status}`);
  }
  assert.equal(calls.length, 0);
});

test("unsupported methods fail locally with Allow", async () => {
  const result = await call("relational", "api/temp-control/records", { method: "DELETE" });
  assert.equal(result.status, 405);
  assert.equal(result.headers.get("allow"), "GET, POST");
  assert.equal(calls.length, 0);
});

test("client query parameters cannot choose the upstream destination", async () => {
  await call("document", "documents?url=http%3A%2F%2Fevil.test&target=https%3A%2F%2Fevil.test");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.host, new URL(origin).host);
});

test("redirects are rejected without following or exposing a Location", async () => {
  reply = (_, response) => { response.writeHead(307, { Location: `${origin}/unexpected-target` }); response.end(); };
  const result = await call("document", "documents", { headers: { Authorization: "Bearer fixture-session" } });
  assert.equal(result.status, 502);
  assert.equal(result.headers.get("location"), null);
  assert.equal(calls.length, 1);
});

test("upstream timeout returns a sanitized 504", async () => {
  reply = () => {};
  const timedProxy = createDataManagerProxy({ env: { DATA_MANAGER_DOCUMENT_API_URL: `${origin}/api/v1` }, timeoutMs: 30 });
  const result = await call("document", "documents", {}, timedProxy);
  assert.equal(result.status, 504);
  assert.match((await result.json()).detail, /не відповів вчасно/);
});

test("upstream socket failures return a sanitized 502", async () => {
  reply = (_, response) => response.destroy(new Error("fixture internal failure must not appear"));
  const result = await call("document", "documents");
  assert.equal(result.status, 502);
  assert.equal((await result.json()).detail, "Не вдалося з’єднатися з API.");
});

test("aborted requests do not make an upstream call", async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await call("document", "documents", { signal: controller.signal });
  assert.equal(result.status, 499);
  assert.equal(calls.length, 0);
});

test("invalid server configuration is rejected without exposing its contents", async () => {
  for (const value of ["file:///tmp/fixture", "http://user:fixture-secret@127.0.0.1", `${origin}/api?v=1`]) {
    const invalidProxy = createDataManagerProxy({ env: { DATA_MANAGER_DOCUMENT_API_URL: value } });
    const result = await call("document", "documents", {}, invalidProxy);
    assert.equal(result.status, 502);
    assert.equal((await result.json()).detail, "Некоректне серверне налаштування API.");
  }
  assert.equal(calls.length, 0);
});
