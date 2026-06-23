/**
 * Safely parse form data and return the first Turkish error message.
 */
export function getValidationError(result: {
  success: boolean
  error?: { issues?: { message?: string }[] }
}): string | null {
  if (!result.success && result.error?.issues?.[0]?.message) {
    return result.error.issues[0].message
  }
  return null
}