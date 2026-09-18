import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5080/api";

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function errorMessage(err: unknown): string {
  const anyErr = err as { response?: { data?: { error?: string; title?: string } } };
  return anyErr?.response?.data?.error || anyErr?.response?.data?.title || "Something went wrong. Please try again.";
}
