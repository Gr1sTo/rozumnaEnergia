// Module-owned React Router resource routes work in development and production.
// Upstream addresses are configured only on the server, in proxy.server.js.
const moduleApi = "/DataManager_Ryzhenko/api";

export const API_CONFIG = {
  relational: `${moduleApi}/relational`,
  document: `${moduleApi}/document`,
  file: `${moduleApi}/file`,
};
