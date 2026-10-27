import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

let server;
let api;
const sample = { id: 42, sensorId: 1, parameter: "TEMPERATURE", value: -2.75, timestamp: "2026-05-27T12:00:00Z" };
const range = { after: "2026-05-27T00:00:00Z", before: "2026-05-28T00:00:00Z" };

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL("../../../../", import.meta.url)),
    configFile: false,
    envDir: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  api = await server.ssrLoadModule("/app/routes/DataManager_Ryzhenko/api/relationalApi.js");
});

beforeEach(() => mock.method(globalThis, "fetch", () => {
  throw new Error("Unexpected network request in test");
}));
afterEach(() => mock.restoreAll());
after(async () => server?.close());

test("range GET uses documented path and exclusive ISO bounds, returning a bare array", async () => {
  fetch.mock.mockImplementation(async (url, options) => {
    const parsed = new URL(url, "https://relational-api.test");
    assert.equal(parsed.pathname, "/DataManager_Ryzhenko/api/relational/api/temp-control/records");
    assert.equal(parsed.searchParams.get("after"), "2026-05-27T00:00:00.000Z");
    assert.equal(parsed.searchParams.get("before"), "2026-05-28T00:00:00.000Z");
    assert.equal(options.method, "GET");
    assert.equal(options.headers.Authorization, undefined);
    return Response.json([sample]);
  });
  assert.deepEqual(await api.getTemperatureRecords(range), [sample]);
  assert.equal(fetch.mock.callCount(), 1);
});

test("offset bounds are converted without changing the represented instants", async () => {
  fetch.mock.mockImplementation(async (url) => {
    const params = new URL(url, "https://relational-api.test").searchParams;
    assert.equal(params.get("after"), "2026-05-27T00:00:00.000Z");
    return Response.json([]);
  });
  assert.deepEqual(await api.getTemperatureRecords({ ...range, after: "2026-05-27T03:00:00+03:00" }), []);
});

test("range validation rejects missing, reversed, equal, local and impossible dates before fetch", async () => {
  for (const invalid of [
    {}, { ...range, after: range.before }, { after: range.before, before: range.after },
    { ...range, after: "2026-05-27T00:00" },
    { ...range, after: "2026-02-31T00:00:00Z" },
  ]) await assert.rejects(api.getTemperatureRecords(invalid));
  assert.equal(fetch.mock.callCount(), 0);
});

test("latest uses sensorId query without document authentication, including signed int32 limits", async () => {
  for (const sensorId of [-2147483648, 0, 2147483647]) {
    fetch.mock.mockImplementation(async (url, options) => {
      const parsed = new URL(url, "https://relational-api.test");
      assert.equal(parsed.pathname, "/DataManager_Ryzhenko/api/relational/api/temp-control/records/latest");
      assert.equal(parsed.searchParams.get("sensorId"), String(sensorId));
      assert.equal(options.headers.Authorization, undefined);
      return Response.json({ ...sample, sensorId });
    });
    assert.equal((await api.getLatestTemperatureRecord(sensorId)).sensorId, sensorId);
  }
});

test("invalid sensor IDs are not silently coerced to zero", async () => {
  for (const value of ["", "1", null, undefined, NaN, Infinity, 1.5, -2147483649, 2147483648]) {
    await assert.rejects(api.getLatestTemperatureRecord(value));
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("creation sends typed supported fields and unwraps the 201 record envelope", async () => {
  fetch.mock.mockImplementation(async (url, options) => {
    assert.equal(url, "/DataManager_Ryzhenko/api/relational/api/temp-control/records");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), { sensorId: 1, parameter: "TEMPERATURE", value: -2.75, timestamp: "2026-05-27T12:00:00.000Z" });
    return Response.json({ record: sample }, { status: 201 });
  });
  assert.deepEqual(await api.createTemperatureRecord({ ...sample, ignored: "field" }), sample);
});

test("creation rejects blank, string, non-finite values and unsupported parameters", async () => {
  for (const changes of [
    { value: "" }, { value: "2.5" }, { value: null }, { value: NaN }, { value: Infinity },
    { sensorId: "" }, { sensorId: 1.2 }, { parameter: "PRESSURE" }, { timestamp: "" },
  ]) await assert.rejects(api.createTemperatureRecord({ ...sample, ...changes }));
  assert.equal(fetch.mock.callCount(), 0);
});

test("400 preserves validation messages and 404 remains distinguishable for latest", async () => {
  fetch.mock.mockImplementation(async () => Response.json({ message: "Invalid timestamp" }, { status: 400 }));
  await assert.rejects(api.getTemperatureRecords(range), { status: 400, message: "Invalid timestamp" });
  fetch.mock.mockImplementation(async () => new Response(null, { status: 404 }));
  await assert.rejects(api.getLatestTemperatureRecord(1), { status: 404 });
});

test("network failures have an actionable message", async () => {
  fetch.mock.mockImplementation(async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(api.getTemperatureRecords(range), (error) => error.status === 0 && error.message.includes("з’єднатися"));
});

test("AbortSignal is forwarded and cancellation is not masked as a network error", async () => {
  const controller = new AbortController();
  fetch.mock.mockImplementation(async (_url, options) => {
    assert.equal(options.signal, controller.signal);
    controller.abort();
    throw new DOMException("Aborted", "AbortError");
  });
  await assert.rejects(api.getTemperatureRecords({ ...range, signal: controller.signal }), { name: "AbortError" });
  const calls = fetch.mock.callCount();
  await assert.rejects(api.getLatestTemperatureRecord(1, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(fetch.mock.callCount(), calls);
});

test("a cancelled response body cannot return data", async () => {
  const controller = new AbortController();
  fetch.mock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => {
    controller.abort();
    return [sample];
  } }));
  await assert.rejects(api.getTemperatureRecords({ ...range, signal: controller.signal }), { name: "AbortError" });
});

test("malformed list, latest and creation responses are rejected", async () => {
  fetch.mock.mockImplementation(async () => Response.json({ data: [sample] }));
  await assert.rejects(api.getTemperatureRecords(range), /список/);
  fetch.mock.mockImplementation(async () => Response.json({ ...sample, value: "2.5" }));
  await assert.rejects(api.getLatestTemperatureRecord(1), /некоректний/);
  fetch.mock.mockImplementation(async () => Response.json(sample, { status: 201 }));
  await assert.rejects(api.createTemperatureRecord(sample), /некоректний/);
});
