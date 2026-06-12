export type AiProviderName = "mock" | "openai" | "deepseek"

export interface ServiceAdvisorInput {
  customerComplaint: string
  vehicleBrand: string
  vehicleModel: string
  mileage: number | null
  previousWorkOrders: Array<{
    workOrderNo: string | null
    createdAt: string
    customerComplaint: string
    items: Array<{ type: string; name: string }>
  }>
}

export interface ServiceAdvisorResult {
  suggestedInspections: string[]
  suggestedLabor: string[]
  suggestedParts: string[]
  customerDescription: string
  internalNote: string
  missingInfoWarnings: string[]
  provider: AiProviderName
  rawResponse?: string
}

export interface AiProvider {
  readonly name: AiProviderName
  suggest(input: ServiceAdvisorInput): Promise<ServiceAdvisorResult>
}