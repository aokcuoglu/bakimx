import { test, expect } from "bun:test"
import { GET } from "./route"

// Kapı ortak yoldur: username dalı da aynı guard'dan geçer ve DB'ye varmadan 404 döner.
test("development dışında username yolu da 404 döner", async () => {
  const original = process.env.NODE_ENV
  Object.assign(process.env, { NODE_ENV: "production" })
  try {
    const res = await GET(
      new Request("http://localhost:3001/api/auth/dev-login?username=usta1&code=demo", {
        headers: { host: "localhost:3001" },
      })
    )
    expect(res.status).toBe(404)
  } finally {
    Object.assign(process.env, { NODE_ENV: original })
  }
})

test("uzak host'ta username yolu 404 döner", async () => {
  const original = process.env.NODE_ENV
  Object.assign(process.env, { NODE_ENV: "development" })
  try {
    const res = await GET(
      new Request("https://app-dev.bakimx.com/api/auth/dev-login?username=usta1&code=demo", {
        headers: { host: "app-dev.bakimx.com" },
      })
    )
    expect(res.status).toBe(404)
  } finally {
    Object.assign(process.env, { NODE_ENV: original })
  }
})
