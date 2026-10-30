const endpoints = [
  ["Backend health", "http://127.0.0.1:18090/api/v1/health"],
  ["Vite frontend", "http://127.0.0.1:5174/inventory/"],
  ["Vite backend proxy", "http://127.0.0.1:5174/inventory-api/api/v1/health"],
];
for (const [label,url] of endpoints) {
  try {
    const response = await fetch(url);
    const content = await response.text();
    console.log(label, response.status, response.headers.get("content-type"), content.slice(0,130).replace(/\s+/g," "));
  } catch (error) { console.error(label, error.message); process.exitCode = 1; }
}