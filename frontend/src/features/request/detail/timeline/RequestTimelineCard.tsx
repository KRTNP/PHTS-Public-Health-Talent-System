"use client"

import type { RequestWithDetails } from "@/types/request.types"
import { getOnBehalfMetadata } from "@/features/request/core/utils"
import { ApprovalTimelineCard } from "./ApprovalTimelineCard"
import { OfficerCreatedRequestTimelineCard } from "./OfficerCreatedRequestTimelineCard"

const parseSubmissionData = (
  value: RequestWithDetails["submission_data"],
): Record<string, unknown> | null => {
  if (!value) return null
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  return typeof value === "object" ? (value as Record<string, unknown>) : null
}

export function RequestTimelineCard({ request }: { request: RequestWithDetails }) {
  const onBehalfMeta = getOnBehalfMetadata(parseSubmissionData(request.submission_data))
  if (onBehalfMeta.isOfficerCreated) {
    return <OfficerCreatedRequestTimelineCard request={request} />
  }
  return <ApprovalTimelineCard request={request} />
}
