import { liraToKurus, parseTRYToKurus } from "@/lib/money"

const OPERATORS = new Set(["+", "-", "*", "/"])

/** Safely evaluates a small money expression without eval/Function. */
export function evaluateMoneyExpression(input: string): number | null {
  const source = input.trim().replace(/[₺\s]/g, "").replace(/TL/gi, "").replace(/×/g, "*").replace(/÷/g, "/")
  if (!source || source.length > 120) return null
  if (!/[+*/()]/.test(source) && !/-(?!^)/.test(source)) {
    const value = parseTRYToKurus(source)
    return value != null && value >= 0 ? value : null
  }

  let index = 0
  const peek = () => source[index]
  const consume = () => source[index++]

  function number(): number | null {
    const start = index
    while (/[0-9.,]/.test(peek() ?? "")) consume()
    if (start === index) return null
    const token = source.slice(start, index)
    if (!/^\d+(?:[.,]\d+)?$/.test(token)) return null
    const value = Number(token.replace(",", "."))
    return Number.isFinite(value) ? value : null
  }

  function primary(): number | null {
    if (peek() === "(") {
      consume()
      const value = expression()
      if (value == null || consume() !== ")") return null
      return value
    }
    return number()
  }

  function unary(): number | null {
    if (peek() === "+") { consume(); return unary() }
    if (peek() === "-") { consume(); const value = unary(); return value == null ? null : -value }
    return primary()
  }

  function term(): number | null {
    let value = unary()
    if (value == null) return null
    while (peek() === "*" || peek() === "/") {
      const operator = consume()
      const right = unary()
      if (right == null || (operator === "/" && right === 0)) return null
      value = operator === "*" ? value * right : value / right
      if (!Number.isFinite(value)) return null
    }
    return value
  }

  function expression(): number | null {
    let value = term()
    if (value == null) return null
    while (peek() === "+" || peek() === "-") {
      const operator = consume()
      const right = term()
      if (right == null) return null
      value = operator === "+" ? value + right : value - right
    }
    return value
  }

  const value = expression()
  if (value == null || index !== source.length || value < 0 || OPERATORS.has(source.at(-1) ?? "")) return null
  return liraToKurus(value)
}
