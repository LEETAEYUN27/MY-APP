import axios from "axios";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url.includes("/auth/")) {
      original._retry = true;
      try {
        await axios.post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true });
        return api(original);
      } catch {
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export function formatApiErrorDetail(detail) {
  if (detail == null) return "오류가 발생했습니다. 다시 시도해주세요.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default api;
