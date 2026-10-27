import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

// Exercise the integrated module without a backend or real credentials.
const tokenKey = "smartenergy_document_access_token";
const storedValues = new Map();
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const storage = {
  getItem: (key) => storedValues.get(key) ?? null,
  setItem: (key, value) => storedValues.set(key, value),
  removeItem: (key) => storedValues.delete(key),
};
let server;
let auth;
let api;
let users;
let client;

before(async () => {
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage: storage },
  });
  server = await createServer({
    root: fileURLToPath(new URL("../../../../", import.meta.url)),
    configFile: false,
    envDir: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  auth = await server.ssrLoadModule("/app/routes/DataManager_Ryzhenko/api/documentAuth.js");
  api = await server.ssrLoadModule("/app/routes/DataManager_Ryzhenko/api/documentApi.js");
  users = await server.ssrLoadModule("/app/routes/DataManager_Ryzhenko/api/documentUsersApi.js");
  client = await server.ssrLoadModule("/app/routes/DataManager_Ryzhenko/api/documentClient.js");
});

beforeEach(() => {
  auth.logoutDocumentApi();
  mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected network request in test");
  });
});

afterEach(() => mock.restoreAll());

after(async () => {
  await server?.close();
  if (originalStorage) {
    Object.defineProperty(globalThis, "sessionStorage", originalStorage);
  } else {
    delete globalThis.sessionStorage;
  }
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
  } else {
    delete globalThis.window;
  }
});

async function login() {
  const token = randomUUID();
  fetch.mock.mockImplementation(async () => Response.json({
    data: { access_token: token },
  }));
  await auth.loginDocumentApi("test-user", randomUUID());
  return token;
}

const documentRequests = {
  list: () => api.getDocumentData(),
  types: () => api.getDocumentTypes(),
  view: () => api.getDocumentById("test-id"),
  create: () => api.createDocumentData({ payload: {} }),
  edit: () => api.updateDocumentData("test-id", { payload: {} }),
  delete: () => api.deleteDocumentData("test-id"),
  profile: () => users.getDocumentProfile(),
  "user list": () => users.getDocumentUsers(),
  "user creation": () => users.createDocumentUser({ username: "test-user", password: randomUUID() }),
  "user update": () => users.updateDocumentUser("test-user", { role: "researcher" }),
};

for (const [name, request] of Object.entries(documentRequests)) {
  test(`401 during ${name} clears the session and notifies subscribers`, async (t) => {
    const token = await login();
    let expirations = 0;
    t.after(auth.subscribeToDocumentSessionExpired(() => expirations++));
    // A 401 may have no JSON body; session invalidation must not depend on it.
    fetch.mock.mockImplementation(async (_url, options) => {
      assert.equal(options.headers.Authorization, `Bearer ${token}`);
      return new Response("Unauthorized", { status: 401 });
    });

    await assert.rejects(request(), auth.DocumentSessionExpiredError);
    assert.equal(auth.getDocumentAccessToken(), null);
    assert.equal(sessionStorage.getItem(tokenKey), null);
    assert.equal(expirations, 1);
  });
}

test("re-login loads only the requested document page with the new token", async () => {
  await login();
  fetch.mock.mockImplementation(async () => Response.json({}, { status: 401 }));
  await assert.rejects(api.getDocumentData(), auth.DocumentSessionExpiredError);

  const token = await login();
  const pages = [];
  fetch.mock.mockImplementation(async (url, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    const page = Number(new URL(url, "https://document-api.test").searchParams.get("page"));
    pages.push(page);
    return Response.json({ data: [{ id: page }], meta: { pages: 2 } });
  });

  assert.deepEqual(await api.getDocumentData(), { data: [{ id: 1 }], meta: { pages: 2 } });
  assert.deepEqual(pages, [1]);
  assert.equal(sessionStorage.getItem(tokenKey), token);
});

test("a 401 when requesting a later page clears the session", async () => {
  await login();
  fetch.mock.mockImplementation(async (url) => {
    return new URL(url, "https://document-api.test").searchParams.get("page") === "1"
      ? Response.json({ data: [{ id: 1 }], meta: { pages: 2 } })
      : Response.json({}, { status: 401 });
  });
  assert.deepEqual((await api.getDocumentData()).data, [{ id: 1 }]);
  await assert.rejects(api.getDocumentData({ page: 2 }), auth.DocumentSessionExpiredError);
  assert.equal(sessionStorage.getItem(tokenKey), null);
});

test("403 and server errors do not clear a valid session", async (t) => {
  const token = await login();
  let expirations = 0;
  t.after(auth.subscribeToDocumentSessionExpired(() => expirations++));
  for (const status of [403, 500]) {
    fetch.mock.mockImplementation(async () => Response.json({ detail: "API error" }, { status }));
    await assert.rejects(api.getDocumentData(), { message: "API error" });
    assert.equal(auth.getDocumentAccessToken(), token);
    assert.equal(sessionStorage.getItem(tokenKey), token);
  }
  assert.equal(expirations, 0);
});

test("incorrect login credentials produce a login error, not a session-expiry event", async (t) => {
  let expirations = 0;
  t.after(auth.subscribeToDocumentSessionExpired(() => expirations++));
  fetch.mock.mockImplementation(async () => new Response(null, { status: 401 }));
  await assert.rejects(auth.loginDocumentApi("test-user", randomUUID()), {
    message: "Неправильний логін або пароль",
  });
  assert.equal(sessionStorage.getItem(tokenKey), null);
  assert.equal(expirations, 0);
});

test("concurrent 401 responses notify only once", async (t) => {
  await login();
  let expirations = 0;
  t.after(auth.subscribeToDocumentSessionExpired(() => expirations++));
  fetch.mock.mockImplementation(async () => new Response(null, { status: 401 }));
  const results = await Promise.allSettled([
    api.getDocumentData(),
    api.getDocumentTypes(),
  ]);
  assert.ok(results.every(({ status, reason }) =>
    status === "rejected" && reason instanceof auth.DocumentSessionExpiredError));
  assert.equal(expirations, 1);
});

for (const status of [200, 401, 403, 422]) {
  test(`a late ${status} from the expired session cannot affect a new login`, async (t) => {
    await login();
    let expirations = 0;
    t.after(auth.subscribeToDocumentSessionExpired(() => expirations++));
    let finishOldRequest;
    fetch.mock.mockImplementation(() => new Promise((resolve) => {
      finishOldRequest = resolve;
    }));
    const pendingRequest = assert.rejects(api.getDocumentById("old"), auth.DocumentSessionExpiredError);

    fetch.mock.mockImplementation(async () => new Response(null, { status: 401 }));
    await assert.rejects(api.getDocumentTypes(), auth.DocumentSessionExpiredError);
    const newToken = await login();
    finishOldRequest(Response.json({ data: { id: "old" } }, { status }));
    await pendingRequest;

    assert.equal(expirations, 1);
    assert.equal(auth.getDocumentAccessToken(), newToken);
    assert.equal(sessionStorage.getItem(tokenKey), newToken);
  });
}

test("unsubscribed expiry handlers are not called", async () => {
  await login();
  const unsubscribe = auth.subscribeToDocumentSessionExpired(() => {
    assert.fail("The expired session handler should have been removed");
  });
  unsubscribe();
  fetch.mock.mockImplementation(async () => new Response(null, { status: 401 }));
  await assert.rejects(api.getDocumentTypes(), auth.DocumentSessionExpiredError);
});

test("document filters are encoded as documented query parameters with repeated tags", async () => {
  await login();
  const controller = new AbortController();
  const filters = {
    page: 3,
    page_size: 25,
    type: "panel/config",
    category: "configuration",
    source_system: "UI & gateway",
    entity_id: "панель 1",
    owner_id: "owner+1",
    visibility: "project",
    sort: "created_at:desc,type:asc",
    created_after: "2026-01-01T00:00:00Z",
    created_before: "2026-02-01T00:00:00Z",
    tags: ["solar & wind", "lab"],
    signal: controller.signal,
    q: "unsupported",
  };
  let requests = 0;
  fetch.mock.mockImplementation(async (url, options) => {
    requests++;
    const parsed = new URL(url, "https://document-api.test");
    assert.equal(parsed.pathname, "/DataManager_Ryzhenko/api/document/documents");
    assert.equal(options.signal, controller.signal);
    for (const field of ["page", "page_size", "type", "category", "source_system", "entity_id", "owner_id", "visibility", "sort", "created_after", "created_before"]) {
      assert.equal(parsed.searchParams.get(field), String(filters[field]));
    }
    assert.deepEqual(parsed.searchParams.getAll("tags"), filters.tags);
    assert.equal(parsed.searchParams.has("signal"), false);
    assert.equal(parsed.searchParams.has("q"), false);
    return Response.json({ data: [{ id: "filtered" }], meta: { page: 3, total: 501, pages: 21 } });
  });
  assert.deepEqual(await api.getDocumentData(filters), {
    data: [{ id: "filtered" }], meta: { page: 3, total: 501, pages: 21 },
  });
  assert.equal(requests, 1);
});

test("empty filter values are omitted, and missing pagination metadata remains unknown", async () => {
  await login();
  fetch.mock.mockImplementation(async (url) => {
    const params = new URL(url, "https://document-api.test").searchParams;
    assert.deepEqual([...params.keys()], ["page", "page_size"]);
    return Response.json({ data: [] });
  });
  assert.deepEqual(await api.getDocumentData({ type: "", category: null, owner_id: undefined, tags: [] }), {
    data: [], meta: {},
  });
});

test("invalid page sizes and malformed lists are rejected", async () => {
  await login();
  const before = fetch.mock.callCount();
  await assert.rejects(api.getDocumentData({ page: 0 }), /сторінки/);
  await assert.rejects(api.getDocumentData({ page_size: 501 }), /від 1 до 500/);
  await assert.rejects(api.getDocumentData({ tags: "must-be-an-array" }), /масивом рядків/);
  assert.equal(fetch.mock.callCount(), before);
  fetch.mock.mockImplementation(async () => Response.json({ data: {} }));
  await assert.rejects(api.getDocumentData(), /Некоректний формат списку документів/);
  await assert.rejects(users.getDocumentUsers(), /Некоректний формат списку користувачів/);
});

test("aborted list requests preserve the session and forward the AbortSignal", async () => {
  const token = await login();
  const controller = new AbortController();
  fetch.mock.mockImplementation(async (_url, options) => {
    assert.equal(options.signal, controller.signal);
    controller.abort();
    return Response.json({ data: [] });
  });
  await assert.rejects(api.getDocumentData({ signal: controller.signal }), { name: "AbortError" });
  assert.equal(auth.getDocumentAccessToken(), token);
  const before = fetch.mock.callCount();
  await assert.rejects(api.getDocumentData({ signal: controller.signal }), { name: "AbortError" });
  assert.equal(fetch.mock.callCount(), before);
});

test("profile comes from auth/me and rejects an unknown role instead of enabling admin UI", async () => {
  const token = await login();
  fetch.mock.mockImplementation(async (url, options) => {
    assert.equal(url, "/DataManager_Ryzhenko/api/document/auth/me");
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    return Response.json({ data: { username: "current-user", role: "admin", full_name: "Test User" } });
  });
  assert.deepEqual(await users.getDocumentProfile(), { username: "current-user", role: "admin", full_name: "Test User" });
  fetch.mock.mockImplementation(async () => Response.json({ data: { username: "current-user", role: "unexpected" } }));
  await assert.rejects(users.getDocumentProfile(), /невідому роль/);
  fetch.mock.mockImplementation(async () => Response.json({ data: { role: "admin" } }));
  await assert.rejects(users.getDocumentProfile(), /коректний профіль/);
});

test("user listing requests one filtered server page", async () => {
  await login();
  const controller = new AbortController();
  let requests = 0;
  fetch.mock.mockImplementation(async (url, options) => {
    requests++;
    const parsed = new URL(url, "https://document-api.test");
    assert.equal(parsed.pathname, "/DataManager_Ryzhenko/api/document/auth/users");
    assert.equal(parsed.searchParams.get("page"), "2");
    assert.equal(parsed.searchParams.get("page_size"), "20");
    assert.equal(parsed.searchParams.get("role"), "sensor");
    assert.equal(options.signal, controller.signal);
    return Response.json({ data: [{ username: "sensor1", role: "sensor" }], meta: { total: 21, pages: 2 } });
  });
  assert.deepEqual(await users.getDocumentUsers({ page: 2, page_size: 20, role: "sensor", signal: controller.signal }), {
    data: [{ username: "sensor1", role: "sensor" }], meta: { total: 21, pages: 2 },
  });
  assert.equal(requests, 1);
});

test("create and update users use the documented endpoints and supported fields only", async () => {
  const token = await login();
  const password = randomUUID();
  fetch.mock.mockImplementation(async (url, options) => {
    assert.equal(url, "/DataManager_Ryzhenko/api/document/auth/register");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.deepEqual(JSON.parse(options.body), {
      username: "created-user", password, role: "researcher", is_active: false, email: null, full_name: "Created User",
    });
    return Response.json({ data: { username: "created-user" } }, { status: 201 });
  });
  assert.deepEqual(await users.createDocumentUser({
    username: "created-user", password, role: "researcher", is_active: false,
    email: null, full_name: "Created User", unsupported: "ignored",
  }), { username: "created-user" });

  fetch.mock.mockImplementation(async (url, options) => {
    assert.equal(url, "/DataManager_Ryzhenko/api/document/auth/users/name%2Fwith%20space");
    assert.equal(options.method, "PATCH");
    assert.deepEqual(JSON.parse(options.body), { role: "sensor", is_active: false });
    return Response.json({ data: { username: "name/with space", role: "sensor" } });
  });
  assert.deepEqual(await users.updateDocumentUser("name/with space", {
    username: "must-not-rename", role: "sensor", is_active: false, password: undefined,
  }), { username: "name/with space", role: "sensor" });
});

test("403 and 422 retain status and validation detail without expiring the session", async () => {
  const token = await login();
  fetch.mock.mockImplementation(async () => Response.json({ detail: "Admin only" }, { status: 403 }));
  await assert.rejects(users.getDocumentUsers(), (error) => {
    assert.ok(error instanceof client.DocumentApiError);
    assert.equal(error.status, 403);
    assert.equal(error.message, "Admin only");
    return true;
  });
  const detail = [{ loc: ["body", "email"], msg: "Invalid email", type: "value_error" }];
  fetch.mock.mockImplementation(async () => Response.json({ detail }, { status: 422 }));
  await assert.rejects(users.createDocumentUser({}), (error) => {
    assert.equal(error.status, 422);
    assert.equal(error.message, "email: Invalid email");
    assert.deepEqual(error.details, detail);
    return true;
  });
  assert.equal(auth.getDocumentAccessToken(), token);
});

test("validation diagnostics never retain password input echoed by the API", async () => {
  await login();
  const submittedValue = randomUUID();
  fetch.mock.mockImplementation(async () => Response.json({
    detail: [{ loc: ["body", "password"], msg: "Too short", type: "string_too_short", input: submittedValue }],
  }, { status: 422 }));
  await assert.rejects(users.createDocumentUser({ password: submittedValue }), (error) => {
    assert.deepEqual(error.details, [{ loc: ["body", "password"], msg: "Too short", type: "string_too_short" }]);
    assert.equal(JSON.stringify(error).includes(submittedValue), false);
    return true;
  });
});

test("an aborted deferred login cannot store a token after leaving the login screen", async () => {
  const controller = new AbortController();
  let finishLogin;
  fetch.mock.mockImplementation((_url, options) => {
    assert.equal(options.signal, controller.signal);
    return new Promise((resolve) => { finishLogin = resolve; });
  });
  const rejected = assert.rejects(
    auth.loginDocumentApi("test-user", randomUUID(), { signal: controller.signal }),
    { name: "AbortError" },
  );
  controller.abort();
  // Simulate a server response arriving even though the caller cancelled.
  finishLogin(Response.json({ data: { access_token: randomUUID() } }));
  await rejected;
  assert.equal(auth.getDocumentAccessToken(), null);
  assert.equal(sessionStorage.getItem(tokenKey), null);
});

test("an error body finishing after re-login cannot surface an old session error", async () => {
  const oldToken = await login();
  let finishErrorBody;
  let signalBodyStarted;
  const bodyStarted = new Promise((resolve) => { signalBodyStarted = resolve; });
  fetch.mock.mockImplementation(async () => ({
    status: 403,
    ok: false,
    json: () => {
      signalBodyStarted();
      return new Promise((resolve) => { finishErrorBody = resolve; });
    },
  }));
  const rejected = assert.rejects(api.getDocumentData(), auth.DocumentSessionExpiredError);
  await bodyStarted;
  auth.expireDocumentSession(oldToken);
  const newToken = await login();
  finishErrorBody({ detail: "Outdated permissions" });
  await rejected;
  assert.equal(auth.getDocumentAccessToken(), newToken);
  assert.equal(sessionStorage.getItem(tokenKey), newToken);
});


test("server rendering cannot read browser tokens or perform a login", async () => {
  const browserToken = randomUUID();
  storage.setItem(tokenKey, browserToken);
  const browserWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  delete globalThis.window;
  try {
    const serverAuth = await server.ssrLoadModule(
      "/app/routes/DataManager_Ryzhenko/api/documentAuth.js?server-isolation",
    );
    assert.equal(serverAuth.getDocumentAccessToken(), null);
    serverAuth.logoutDocumentApi();
    serverAuth.expireDocumentSession(browserToken);
    await assert.rejects(serverAuth.loginDocumentApi("test-user", randomUUID()), {
      message: "Авторизація доступна лише у браузері.",
    });
    assert.equal(fetch.mock.callCount(), 0);
    assert.equal(storage.getItem(tokenKey), browserToken);
  } finally {
    Object.defineProperty(globalThis, "window", browserWindow);
  }
  assert.equal(auth.getDocumentAccessToken(), browserToken);
});

test("session tokens follow the current browser storage instead of server module state", async () => {
  const token = await login();
  const browserWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const otherValues = new Map();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key) => otherValues.get(key) ?? null,
        setItem: (key, value) => otherValues.set(key, value),
        removeItem: (key) => otherValues.delete(key),
      },
    },
  });
  try {
    assert.equal(auth.getDocumentAccessToken(), null);
    auth.logoutDocumentApi();
    assert.equal(storage.getItem(tokenKey), token);
  } finally {
    Object.defineProperty(globalThis, "window", browserWindow);
  }
  assert.equal(auth.getDocumentAccessToken(), token);
});
