"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { RequestWizard } from "@/features/request"

export default function NewRequestPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <Link
          href="/user/my-requests"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปคำขอของฉัน
        </Link>
        <h1 className="text-2xl font-bold text-foreground">ส่งคำขอ พ.ต.ส.</h1>
        <p className="mt-1 text-muted-foreground">
          กรอกข้อมูลและแนบเอกสารเพื่อส่งคำขอ
        </p>
      </div>

      <RequestWizard />
    </div>
  )
}
