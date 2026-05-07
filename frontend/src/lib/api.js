import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

export const api = {
  // queries
  listQueries: () => client.get("/queries").then((r) => r.data),
  getQuery: (id) => client.get(`/queries/${id}`).then((r) => r.data),
  createQuery: (payload) => client.post("/queries", payload).then((r) => r.data),
  updateQuery: (id, payload) => client.patch(`/queries/${id}`, payload).then((r) => r.data),
  deleteQuery: (id) => client.delete(`/queries/${id}`).then((r) => r.data),
  runQuery: (id) => client.post(`/queries/${id}/run`).then((r) => r.data),

  // discoveries
  listDiscoveries: (params = {}) =>
    client.get("/discoveries", { params }).then((r) => r.data),
  updateDiscovery: (id, status) =>
    client.patch(`/discoveries/${id}`, { status }).then((r) => r.data),
  deleteDiscovery: (id) => client.delete(`/discoveries/${id}`).then((r) => r.data),

  // runs
  listRuns: (params = {}) => client.get("/runs", { params }).then((r) => r.data),

  // stats
  stats: () => client.get("/stats").then((r) => r.data),
};
