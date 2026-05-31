// ============================================================
// Vertical onboarding templates — pre-filled services + working
// hours per business type. Picked during onboarding (step 2) so a
// new tenant starts with sensible defaults instead of a blank slate.
// Service names are bilingual (En primary, Ar secondary).
// ============================================================

import type { BusinessType } from "@prisma/client"

export interface TemplateService {
  nameEn: string
  nameAr: string
  durationMin: number
  bufferMin: number
  price: number
  maxCapacity: number
}

export interface VerticalTemplate {
  type: BusinessType
  labelEn: string
  labelAr: string
  // Default working hours applied to every seeded service.
  hours: { startTime: string; endTime: string; slotMin: number; days: number[] }
  services: TemplateService[]
}

// dayOfWeek: 0 = Sunday … 6 = Saturday. Sun–Thu is the common KSA work week.
const SUN_TO_THU = [0, 1, 2, 3, 4]
const SAT_TO_THU = [6, 0, 1, 2, 3, 4]

export const TEMPLATES: Record<BusinessType, VerticalTemplate> = {
  CLINIC: {
    type: "CLINIC",
    labelEn: "Clinic",
    labelAr: "عيادة",
    hours: { startTime: "09:00", endTime: "17:00", slotMin: 30, days: SUN_TO_THU },
    services: [
      { nameEn: "General Consultation", nameAr: "استشارة عامة", durationMin: 30, bufferMin: 10, price: 150, maxCapacity: 1 },
      { nameEn: "Follow-up Visit", nameAr: "زيارة متابعة", durationMin: 20, bufferMin: 10, price: 100, maxCapacity: 1 },
    ],
  },
  SALON: {
    type: "SALON",
    labelEn: "Salon",
    labelAr: "صالون",
    hours: { startTime: "10:00", endTime: "22:00", slotMin: 30, days: SAT_TO_THU },
    services: [
      { nameEn: "Haircut", nameAr: "قص شعر", durationMin: 45, bufferMin: 15, price: 80, maxCapacity: 1 },
      { nameEn: "Hair Color", nameAr: "صبغة شعر", durationMin: 90, bufferMin: 15, price: 250, maxCapacity: 1 },
    ],
  },
  FITNESS: {
    type: "FITNESS",
    labelEn: "Fitness Studio",
    labelAr: "استوديو رياضي",
    hours: { startTime: "06:00", endTime: "23:00", slotMin: 60, days: SAT_TO_THU },
    services: [
      { nameEn: "Group Class", nameAr: "حصة جماعية", durationMin: 60, bufferMin: 0, price: 50, maxCapacity: 15 },
      { nameEn: "Personal Training", nameAr: "تدريب شخصي", durationMin: 60, bufferMin: 0, price: 200, maxCapacity: 1 },
    ],
  },
  CONSULTING: {
    type: "CONSULTING",
    labelEn: "Consulting",
    labelAr: "استشارات",
    hours: { startTime: "09:00", endTime: "18:00", slotMin: 60, days: SUN_TO_THU },
    services: [
      { nameEn: "Discovery Call", nameAr: "مكالمة تعارف", durationMin: 30, bufferMin: 0, price: 0, maxCapacity: 1 },
      { nameEn: "Consultation Session", nameAr: "جلسة استشارية", durationMin: 60, bufferMin: 15, price: 500, maxCapacity: 1 },
    ],
  },
  EDUCATION: {
    type: "EDUCATION",
    labelEn: "Education",
    labelAr: "تعليم",
    hours: { startTime: "14:00", endTime: "21:00", slotMin: 60, days: SAT_TO_THU },
    services: [
      { nameEn: "Private Lesson", nameAr: "درس خصوصي", durationMin: 60, bufferMin: 0, price: 120, maxCapacity: 1 },
      { nameEn: "Group Workshop", nameAr: "ورشة جماعية", durationMin: 90, bufferMin: 15, price: 80, maxCapacity: 10 },
    ],
  },
  OTHER: {
    type: "OTHER",
    labelEn: "Other",
    labelAr: "أخرى",
    hours: { startTime: "09:00", endTime: "18:00", slotMin: 30, days: SUN_TO_THU },
    services: [
      { nameEn: "Standard Appointment", nameAr: "موعد قياسي", durationMin: 30, bufferMin: 10, price: 100, maxCapacity: 1 },
    ],
  },
}

export const BUSINESS_TYPES = Object.values(TEMPLATES).map((t) => ({
  type: t.type,
  labelEn: t.labelEn,
  labelAr: t.labelAr,
}))
