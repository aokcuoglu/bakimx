"use client"

import { useState } from "react"
import { MarketResearchForm } from "./market-research-form"
import { MarketResearchUsage } from "./market-research-usage"

export function MarketResearchWorkspace({ canManageCredential }: { canManageCredential: boolean }) {
  const [usageVersion, setUsageVersion] = useState(0)

  return (
    <div className="space-y-5">
      <MarketResearchForm onResearchComplete={() => setUsageVersion((value) => value + 1)} />
      <MarketResearchUsage canManageCredential={canManageCredential} refreshKey={usageVersion} />
    </div>
  )
}
