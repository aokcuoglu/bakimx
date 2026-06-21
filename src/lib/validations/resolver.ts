import type { Resolver, FieldValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "zod"

export function typedResolver<T extends FieldValues>(schema: z.ZodType<T>): Resolver<T, unknown, T> {
  return zodResolver(schema as never) as unknown as Resolver<T, unknown, T>
}