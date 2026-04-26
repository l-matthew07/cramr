export function getAllowedOrigins() {
  return (process.env.WEB_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
}
