-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('starter', 'pro', 'premium');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled');

-- CreateEnum
CREATE TYPE "WorkshopApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'manager', 'staff');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'accepted', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('individual', 'corporate');

-- CreateEnum
CREATE TYPE "CustomerTag" AS ENUM ('standard', 'vip', 'risky', 'fleet');

-- CreateEnum
CREATE TYPE "CustomerSource" AS ENUM ('referral', 'google', 'social_media', 'walk_in', 'existing', 'other');

-- CreateEnum
CREATE TYPE "CustomerPriceGroup" AS ENUM ('standard', 'discounted', 'fleet');

-- CreateEnum
CREATE TYPE "IntakeStatus" AS ENUM ('draft', 'waiting_approval', 'approved', 'in_progress', 'ready_for_delivery', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "VehiclePhotoType" AS ENUM ('front', 'rear', 'left_side', 'right_side', 'dashboard_mileage', 'registration_front', 'registration_back', 'vin_area', 'damage_detail', 'other');

-- CreateEnum
CREATE TYPE "PhotoPhase" AS ENUM ('intake', 'repair_progress', 'delivery');

-- CreateEnum
CREATE TYPE "DamageType" AS ENUM ('scratch', 'dent', 'broken', 'cracked', 'paint_damage', 'missing_part', 'other');

-- CreateEnum
CREATE TYPE "DamageSeverity" AS ENUM ('light', 'medium', 'heavy');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'verified', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "TechnicianRole" AS ENUM ('usta', 'teknisyen', 'servis_danismani', 'yonetici');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('draft', 'waiting_approval', 'approved', 'in_progress', 'waiting_parts', 'ready_for_delivery', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'partial', 'paid', 'overpaid', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'credit_card', 'bank_transfer', 'other');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('completed', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "OrderItemType" AS ENUM ('part', 'labor');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted', 'cancelled');

-- CreateEnum
CREATE TYPE "QuoteItemType" AS ENUM ('part', 'labor');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('scheduled', 'confirmed', 'arrived', 'converted', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('none', 'pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "MaintenanceReminderStatus" AS ENUM ('upcoming', 'due_soon', 'overdue', 'completed', 'postponed', 'cancelled');

-- CreateEnum
CREATE TYPE "MaintenanceReminderType" AS ENUM ('periodic_maintenance', 'oil_change', 'inspection', 'tire_change', 'brake_check', 'battery_check', 'insurance', 'other');

-- CreateEnum
CREATE TYPE "MaintenanceChannel" AS ENUM ('none', 'sms', 'whatsapp', 'phone', 'email');

-- CreateEnum
CREATE TYPE "ChecklistCategory" AS ENUM ('inspection', 'repair', 'delivery');

-- CreateEnum
CREATE TYPE "PartsRequestStatus" AS ENUM ('requested', 'prepared', 'delivered');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('sms', 'whatsapp', 'email');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('appointment', 'delivery', 'maintenance_reminder');

-- CreateTable
CREATE TABLE "Workshop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "address" TEXT NOT NULL,
    "email" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "taxNumber" TEXT,
    "taxOffice" TEXT,
    "invoiceTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "planTier" "PlanTier" NOT NULL DEFAULT 'pro',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "approvalStatus" "WorkshopApprovalStatus" NOT NULL DEFAULT 'approved',
    "trialStartedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "requestedPlanTier" "PlanTier",
    "planRequestedAt" TIMESTAMP(3),
    "extraSeats" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Workshop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopSettings" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "pdfLogoUrl" TEXT,
    "publicPortalLogoUrl" TEXT,
    "passportLogoUrl" TEXT,
    "themeColor" TEXT,
    "accentColor" TEXT,
    "smsProvider" TEXT NOT NULL DEFAULT 'mock',
    "smsApiKey" TEXT,
    "smsSenderName" TEXT,
    "whatsappProvider" TEXT NOT NULL DEFAULT 'mock',
    "whatsappApiKey" TEXT,
    "whatsappPhoneNumber" TEXT,
    "emailProvider" TEXT NOT NULL DEFAULT 'mock',
    "emailApiKey" TEXT,
    "emailFromAddress" TEXT,
    "emailFromName" TEXT,
    "weekdayStart" TEXT NOT NULL DEFAULT '09:00',
    "weekdayEnd" TEXT NOT NULL DEFAULT '18:00',
    "weekdayWorkingDays" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    "weekendStart" TEXT NOT NULL DEFAULT '10:00',
    "weekendEnd" TEXT NOT NULL DEFAULT '14:00',
    "weekendWorkingDays" TEXT NOT NULL DEFAULT '6',
    "holidayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "holidayDates" TEXT,
    "defaultAppointmentDuration" INTEGER NOT NULL DEFAULT 60,
    "bufferDuration" INTEGER NOT NULL DEFAULT 15,
    "reminderTimings" TEXT NOT NULL DEFAULT '60,30',
    "workOrderTemplate" TEXT,
    "servicePassportTemplate" TEXT,
    "collectionReceiptTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "workshopId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'owner',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'staff',
    "tokenHash" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'individual',
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT,
    "companyName" TEXT,
    "contactName" TEXT,
    "phone" TEXT NOT NULL,
    "phone2" TEXT,
    "email" TEXT,
    "city" TEXT,
    "district" TEXT,
    "address" TEXT,
    "identityNumber" TEXT,
    "taxNumber" TEXT,
    "taxOffice" TEXT,
    "notes" TEXT,
    "tag" "CustomerTag" DEFAULT 'standard',
    "source" "CustomerSource",
    "priceGroup" "CustomerPriceGroup" DEFAULT 'standard',
    "discountRate" DOUBLE PRECISION DEFAULT 0,
    "riskNote" TEXT,
    "whatsappConsent" BOOLEAN NOT NULL DEFAULT false,
    "smsConsent" BOOLEAN NOT NULL DEFAULT false,
    "emailConsent" BOOLEAN NOT NULL DEFAULT false,
    "kvkkApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "vehicleType" TEXT,
    "modelYear" INTEGER,
    "mileage" INTEGER,
    "vin" TEXT,
    "vinOcrRaw" TEXT,
    "vinConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "engineNo" TEXT,
    "fuelType" TEXT,
    "transmission" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleIntakeForm" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "status" "IntakeStatus" NOT NULL DEFAULT 'draft',
    "mileageAtIntake" INTEGER,
    "customerComplaint" TEXT NOT NULL,
    "internalNote" TEXT,
    "approvalTextVersion" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleIntakeForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehiclePhoto" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "intakeFormId" TEXT NOT NULL,
    "serviceOrderId" TEXT,
    "type" "VehiclePhotoType" NOT NULL,
    "phase" "PhotoPhase" NOT NULL DEFAULT 'intake',
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storageProvider" TEXT,
    "storageKey" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehiclePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DamageMark" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "intakeFormId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "damageType" "DamageType" NOT NULL,
    "severity" "DamageSeverity" NOT NULL,
    "note" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DamageMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "intakeFormId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "otpCode" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "approvalType" TEXT NOT NULL DEFAULT 'vehicle_intake',
    "approvalTextVersion" TEXT,
    "approvedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicShareLink" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "intakeFormId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "showPhotos" BOOLEAN NOT NULL DEFAULT true,
    "showDamage" BOOLEAN NOT NULL DEFAULT true,
    "showOrderItems" BOOLEAN NOT NULL DEFAULT true,
    "showPaymentStatus" BOOLEAN NOT NULL DEFAULT false,
    "showTimeline" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeTimelineEvent" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "intakeFormId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Technician" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "TechnicianRole" NOT NULL DEFAULT 'usta',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Technician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrder" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "intakeFormId" TEXT NOT NULL,
    "workOrderNo" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'draft',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "technicianName" TEXT,
    "assignedTechnicianId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "estimatedDeliveryAt" TIMESTAMP(3),
    "discountAmount" DOUBLE PRECISION,
    "taxRate" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAmount" DOUBLE PRECISION,
    "remainingAmount" DOUBLE PRECISION,
    "lastPaymentAt" TIMESTAMP(3),

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionPayment" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceOrderId" TEXT,
    "quoteId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "method" "PaymentMethod" NOT NULL DEFAULT 'cash',
    "status" "CollectionStatus" NOT NULL DEFAULT 'completed',
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceNo" TEXT,
    "note" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrderItem" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "type" "OrderItemType" NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION,
    "totalPrice" DOUBLE PRECISION,
    "partId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "quoteNo" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'draft',
    "title" TEXT,
    "customerRequest" TEXT,
    "internalNote" TEXT,
    "validUntil" TIMESTAMP(3),
    "estimatedLaborTotal" DOUBLE PRECISION,
    "estimatedPartsTotal" DOUBLE PRECISION,
    "discountAmount" DOUBLE PRECISION,
    "taxRate" DOUBLE PRECISION,
    "grandTotal" DOUBLE PRECISION,
    "convertedServiceOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "type" "QuoteItemType" NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION,
    "totalPrice" DOUBLE PRECISION,
    "partId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "appointmentNo" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'scheduled',
    "appointmentAt" TIMESTAMP(3) NOT NULL,
    "estimatedDurationMinutes" INTEGER,
    "title" TEXT,
    "customerRequest" TEXT,
    "internalNote" TEXT,
    "reminderStatus" "ReminderStatus" NOT NULL DEFAULT 'none',
    "lastRemindedAt" TIMESTAMP(3),
    "convertedServiceOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceReminder" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "MaintenanceReminderType" NOT NULL DEFAULT 'other',
    "status" "MaintenanceReminderStatus" NOT NULL DEFAULT 'upcoming',
    "dueDate" TIMESTAMP(3),
    "dueMileage" INTEGER,
    "currentMileage" INTEGER,
    "lastServiceDate" TIMESTAMP(3),
    "lastServiceMileage" INTEGER,
    "reminderDaysBefore" INTEGER,
    "reminderKmBefore" INTEGER,
    "preferredChannel" "MaintenanceChannel" NOT NULL DEFAULT 'none',
    "reminderStatus" "ReminderStatus" NOT NULL DEFAULT 'none',
    "lastRemindedAt" TIMESTAMP(3),
    "customerNote" TEXT,
    "internalNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedServiceOrderId" TEXT,
    "createdAppointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartStockItem" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "oemNo" TEXT,
    "brand" TEXT,
    "category" TEXT,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'adet',
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "criticalStockQty" INTEGER NOT NULL DEFAULT 0,
    "purchasePrice" DOUBLE PRECISION,
    "salePrice" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "supplierName" TEXT,
    "supplierPhone" TEXT,
    "supplierId" TEXT,
    "shelfLocation" TEXT,
    "barcode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartStockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousQty" INTEGER,
    "newQty" INTEGER,
    "reason" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "phone2" TEXT,
    "email" TEXT,
    "website" TEXT,
    "city" TEXT,
    "address" TEXT,
    "taxNumber" TEXT,
    "taxOffice" TEXT,
    "category" TEXT,
    "paymentTermDays" INTEGER,
    "averageDeliveryDays" INTEGER,
    "performanceNote" TEXT,
    "internalNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehiclePassportToken" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "showServiceHistory" BOOLEAN NOT NULL DEFAULT true,
    "showWorkOrders" BOOLEAN NOT NULL DEFAULT true,
    "showDamages" BOOLEAN NOT NULL DEFAULT true,
    "showPhotos" BOOLEAN NOT NULL DEFAULT true,
    "showReminders" BOOLEAN NOT NULL DEFAULT true,
    "showPaymentStatus" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehiclePassportToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrLog" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "ocrProvider" TEXT NOT NULL,
    "rawText" TEXT,
    "extractedJson" TEXT,
    "confirmedJson" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "userId" TEXT,
    "customerId" TEXT,
    "vehicleId" TEXT,
    "serviceOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcrLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "category" "ChecklistCategory" NOT NULL DEFAULT 'inspection',
    "description" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "authorId" TEXT,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartsRequest" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "requestedById" TEXT,
    "partName" TEXT NOT NULL,
    "partSku" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "status" "PartsRequestStatus" NOT NULL DEFAULT 'requested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartsRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborSession" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "technicianId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaborSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationTemplate" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "channel" "CommunicationType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarSyncLog" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "eventType" TEXT,
    "entityId" TEXT,
    "externalEventId" TEXT,
    "errorMessage" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderExecutionLog" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "type" "CommunicationType" NOT NULL,
    "provider" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "templateKey" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "providerId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopSettings_workshopId_key" ON "WorkshopSettings"("workshopId");

-- CreateIndex
CREATE INDEX "WorkshopSettings_workshopId_idx" ON "WorkshopSettings"("workshopId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_workshopId_idx" ON "User"("workshopId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE INDEX "Invite_workshopId_idx" ON "Invite"("workshopId");

-- CreateIndex
CREATE INDEX "Invite_status_idx" ON "Invite"("status");

-- CreateIndex
CREATE INDEX "Invite_expiresAt_idx" ON "Invite"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_workshopId_email_key" ON "Invite"("workshopId", "email");

-- CreateIndex
CREATE INDEX "Customer_workshopId_idx" ON "Customer"("workshopId");

-- CreateIndex
CREATE INDEX "Customer_workshopId_type_idx" ON "Customer"("workshopId", "type");

-- CreateIndex
CREATE INDEX "Customer_workshopId_phone_idx" ON "Customer"("workshopId", "phone");

-- CreateIndex
CREATE INDEX "Vehicle_workshopId_idx" ON "Vehicle"("workshopId");

-- CreateIndex
CREATE INDEX "Vehicle_customerId_idx" ON "Vehicle"("customerId");

-- CreateIndex
CREATE INDEX "Vehicle_workshopId_vin_idx" ON "Vehicle"("workshopId", "vin");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_workshopId_plate_key" ON "Vehicle"("workshopId", "plate");

-- CreateIndex
CREATE INDEX "VehicleIntakeForm_workshopId_idx" ON "VehicleIntakeForm"("workshopId");

-- CreateIndex
CREATE INDEX "VehicleIntakeForm_customerId_idx" ON "VehicleIntakeForm"("customerId");

-- CreateIndex
CREATE INDEX "VehicleIntakeForm_vehicleId_idx" ON "VehicleIntakeForm"("vehicleId");

-- CreateIndex
CREATE INDEX "VehiclePhoto_workshopId_idx" ON "VehiclePhoto"("workshopId");

-- CreateIndex
CREATE INDEX "VehiclePhoto_intakeFormId_idx" ON "VehiclePhoto"("intakeFormId");

-- CreateIndex
CREATE INDEX "VehiclePhoto_phase_idx" ON "VehiclePhoto"("phase");

-- CreateIndex
CREATE INDEX "VehiclePhoto_serviceOrderId_idx" ON "VehiclePhoto"("serviceOrderId");

-- CreateIndex
CREATE INDEX "DamageMark_workshopId_idx" ON "DamageMark"("workshopId");

-- CreateIndex
CREATE INDEX "DamageMark_intakeFormId_idx" ON "DamageMark"("intakeFormId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_workshopId_idx" ON "ApprovalRequest"("workshopId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_intakeFormId_idx" ON "ApprovalRequest"("intakeFormId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicShareLink_token_key" ON "PublicShareLink"("token");

-- CreateIndex
CREATE INDEX "PublicShareLink_workshopId_idx" ON "PublicShareLink"("workshopId");

-- CreateIndex
CREATE INDEX "PublicShareLink_intakeFormId_idx" ON "PublicShareLink"("intakeFormId");

-- CreateIndex
CREATE INDEX "IntakeTimelineEvent_workshopId_idx" ON "IntakeTimelineEvent"("workshopId");

-- CreateIndex
CREATE INDEX "IntakeTimelineEvent_intakeFormId_idx" ON "IntakeTimelineEvent"("intakeFormId");

-- CreateIndex
CREATE INDEX "IntakeTimelineEvent_eventType_idx" ON "IntakeTimelineEvent"("eventType");

-- CreateIndex
CREATE INDEX "IntakeTimelineEvent_createdAt_idx" ON "IntakeTimelineEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Technician_workshopId_idx" ON "Technician"("workshopId");

-- CreateIndex
CREATE INDEX "Technician_workshopId_isActive_idx" ON "Technician"("workshopId", "isActive");

-- CreateIndex
CREATE INDEX "Technician_workshopId_role_idx" ON "Technician"("workshopId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_intakeFormId_key" ON "ServiceOrder"("intakeFormId");

-- CreateIndex
CREATE INDEX "ServiceOrder_workshopId_idx" ON "ServiceOrder"("workshopId");

-- CreateIndex
CREATE INDEX "ServiceOrder_status_idx" ON "ServiceOrder"("status");

-- CreateIndex
CREATE INDEX "ServiceOrder_paymentStatus_idx" ON "ServiceOrder"("paymentStatus");

-- CreateIndex
CREATE INDEX "ServiceOrder_assignedTechnicianId_idx" ON "ServiceOrder"("assignedTechnicianId");

-- CreateIndex
CREATE INDEX "ServiceOrder_workshopId_assignedTechnicianId_idx" ON "ServiceOrder"("workshopId", "assignedTechnicianId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_workshopId_workOrderNo_key" ON "ServiceOrder"("workshopId", "workOrderNo");

-- CreateIndex
CREATE INDEX "CollectionPayment_workshopId_idx" ON "CollectionPayment"("workshopId");

-- CreateIndex
CREATE INDEX "CollectionPayment_customerId_idx" ON "CollectionPayment"("customerId");

-- CreateIndex
CREATE INDEX "CollectionPayment_serviceOrderId_idx" ON "CollectionPayment"("serviceOrderId");

-- CreateIndex
CREATE INDEX "CollectionPayment_paymentDate_idx" ON "CollectionPayment"("paymentDate");

-- CreateIndex
CREATE INDEX "CollectionPayment_method_idx" ON "CollectionPayment"("method");

-- CreateIndex
CREATE INDEX "CollectionPayment_status_idx" ON "CollectionPayment"("status");

-- CreateIndex
CREATE INDEX "ServiceOrderItem_workshopId_idx" ON "ServiceOrderItem"("workshopId");

-- CreateIndex
CREATE INDEX "ServiceOrderItem_serviceOrderId_idx" ON "ServiceOrderItem"("serviceOrderId");

-- CreateIndex
CREATE INDEX "ServiceOrderItem_partId_idx" ON "ServiceOrderItem"("partId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_convertedServiceOrderId_key" ON "Quote"("convertedServiceOrderId");

-- CreateIndex
CREATE INDEX "Quote_workshopId_idx" ON "Quote"("workshopId");

-- CreateIndex
CREATE INDEX "Quote_customerId_idx" ON "Quote"("customerId");

-- CreateIndex
CREATE INDEX "Quote_vehicleId_idx" ON "Quote"("vehicleId");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "QuoteItem_workshopId_idx" ON "QuoteItem"("workshopId");

-- CreateIndex
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteItem_partId_idx" ON "QuoteItem"("partId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_convertedServiceOrderId_key" ON "Appointment"("convertedServiceOrderId");

-- CreateIndex
CREATE INDEX "Appointment_workshopId_idx" ON "Appointment"("workshopId");

-- CreateIndex
CREATE INDEX "Appointment_customerId_idx" ON "Appointment"("customerId");

-- CreateIndex
CREATE INDEX "Appointment_vehicleId_idx" ON "Appointment"("vehicleId");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_appointmentAt_idx" ON "Appointment"("appointmentAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceReminder_completedServiceOrderId_key" ON "MaintenanceReminder"("completedServiceOrderId");

-- CreateIndex
CREATE INDEX "MaintenanceReminder_workshopId_idx" ON "MaintenanceReminder"("workshopId");

-- CreateIndex
CREATE INDEX "MaintenanceReminder_customerId_idx" ON "MaintenanceReminder"("customerId");

-- CreateIndex
CREATE INDEX "MaintenanceReminder_vehicleId_idx" ON "MaintenanceReminder"("vehicleId");

-- CreateIndex
CREATE INDEX "MaintenanceReminder_status_idx" ON "MaintenanceReminder"("status");

-- CreateIndex
CREATE INDEX "MaintenanceReminder_dueDate_idx" ON "MaintenanceReminder"("dueDate");

-- CreateIndex
CREATE INDEX "MaintenanceReminder_dueMileage_idx" ON "MaintenanceReminder"("dueMileage");

-- CreateIndex
CREATE INDEX "PartStockItem_workshopId_idx" ON "PartStockItem"("workshopId");

-- CreateIndex
CREATE INDEX "PartStockItem_name_idx" ON "PartStockItem"("name");

-- CreateIndex
CREATE INDEX "PartStockItem_sku_idx" ON "PartStockItem"("sku");

-- CreateIndex
CREATE INDEX "PartStockItem_oemNo_idx" ON "PartStockItem"("oemNo");

-- CreateIndex
CREATE INDEX "PartStockItem_brand_idx" ON "PartStockItem"("brand");

-- CreateIndex
CREATE INDEX "PartStockItem_category_idx" ON "PartStockItem"("category");

-- CreateIndex
CREATE INDEX "PartStockItem_stockQty_idx" ON "PartStockItem"("stockQty");

-- CreateIndex
CREATE INDEX "PartStockItem_isActive_idx" ON "PartStockItem"("isActive");

-- CreateIndex
CREATE INDEX "PartStockItem_supplierId_idx" ON "PartStockItem"("supplierId");

-- CreateIndex
CREATE INDEX "StockMovement_workshopId_idx" ON "StockMovement"("workshopId");

-- CreateIndex
CREATE INDEX "StockMovement_partId_idx" ON "StockMovement"("partId");

-- CreateIndex
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_workshopId_idx" ON "AuditLog"("workshopId");

-- CreateIndex
CREATE INDEX "Supplier_workshopId_idx" ON "Supplier"("workshopId");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_phone_idx" ON "Supplier"("phone");

-- CreateIndex
CREATE INDEX "Supplier_email_idx" ON "Supplier"("email");

-- CreateIndex
CREATE INDEX "Supplier_city_idx" ON "Supplier"("city");

-- CreateIndex
CREATE INDEX "Supplier_isActive_idx" ON "Supplier"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "VehiclePassportToken_token_key" ON "VehiclePassportToken"("token");

-- CreateIndex
CREATE INDEX "VehiclePassportToken_workshopId_idx" ON "VehiclePassportToken"("workshopId");

-- CreateIndex
CREATE INDEX "VehiclePassportToken_vehicleId_idx" ON "VehiclePassportToken"("vehicleId");

-- CreateIndex
CREATE INDEX "VehiclePassportToken_token_idx" ON "VehiclePassportToken"("token");

-- CreateIndex
CREATE INDEX "OcrLog_workshopId_idx" ON "OcrLog"("workshopId");

-- CreateIndex
CREATE INDEX "OcrLog_customerId_idx" ON "OcrLog"("customerId");

-- CreateIndex
CREATE INDEX "OcrLog_vehicleId_idx" ON "OcrLog"("vehicleId");

-- CreateIndex
CREATE INDEX "OcrLog_serviceOrderId_idx" ON "OcrLog"("serviceOrderId");

-- CreateIndex
CREATE INDEX "ChecklistItem_workshopId_idx" ON "ChecklistItem"("workshopId");

-- CreateIndex
CREATE INDEX "ChecklistItem_serviceOrderId_idx" ON "ChecklistItem"("serviceOrderId");

-- CreateIndex
CREATE INDEX "ChecklistItem_category_idx" ON "ChecklistItem"("category");

-- CreateIndex
CREATE INDEX "ChecklistItem_isCompleted_idx" ON "ChecklistItem"("isCompleted");

-- CreateIndex
CREATE INDEX "InternalNote_workshopId_idx" ON "InternalNote"("workshopId");

-- CreateIndex
CREATE INDEX "InternalNote_serviceOrderId_idx" ON "InternalNote"("serviceOrderId");

-- CreateIndex
CREATE INDEX "InternalNote_authorId_idx" ON "InternalNote"("authorId");

-- CreateIndex
CREATE INDEX "InternalNote_createdAt_idx" ON "InternalNote"("createdAt");

-- CreateIndex
CREATE INDEX "PartsRequest_workshopId_idx" ON "PartsRequest"("workshopId");

-- CreateIndex
CREATE INDEX "PartsRequest_serviceOrderId_idx" ON "PartsRequest"("serviceOrderId");

-- CreateIndex
CREATE INDEX "PartsRequest_status_idx" ON "PartsRequest"("status");

-- CreateIndex
CREATE INDEX "PartsRequest_requestedById_idx" ON "PartsRequest"("requestedById");

-- CreateIndex
CREATE INDEX "LaborSession_workshopId_idx" ON "LaborSession"("workshopId");

-- CreateIndex
CREATE INDEX "LaborSession_serviceOrderId_idx" ON "LaborSession"("serviceOrderId");

-- CreateIndex
CREATE INDEX "LaborSession_technicianId_idx" ON "LaborSession"("technicianId");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_workshopId_idx" ON "CommunicationTemplate"("workshopId");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_templateKey_idx" ON "CommunicationTemplate"("templateKey");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_channel_idx" ON "CommunicationTemplate"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationTemplate_workshopId_templateKey_channel_key" ON "CommunicationTemplate"("workshopId", "templateKey", "channel");

-- CreateIndex
CREATE INDEX "CalendarSyncLog_workshopId_idx" ON "CalendarSyncLog"("workshopId");

-- CreateIndex
CREATE INDEX "CalendarSyncLog_provider_idx" ON "CalendarSyncLog"("provider");

-- CreateIndex
CREATE INDEX "CalendarSyncLog_status_idx" ON "CalendarSyncLog"("status");

-- CreateIndex
CREATE INDEX "CalendarSyncLog_syncedAt_idx" ON "CalendarSyncLog"("syncedAt");

-- CreateIndex
CREATE INDEX "ReminderExecutionLog_workshopId_idx" ON "ReminderExecutionLog"("workshopId");

-- CreateIndex
CREATE INDEX "ReminderExecutionLog_jobType_idx" ON "ReminderExecutionLog"("jobType");

-- CreateIndex
CREATE INDEX "ReminderExecutionLog_status_idx" ON "ReminderExecutionLog"("status");

-- CreateIndex
CREATE INDEX "ReminderExecutionLog_executedAt_idx" ON "ReminderExecutionLog"("executedAt");

-- CreateIndex
CREATE INDEX "CommunicationLog_workshopId_idx" ON "CommunicationLog"("workshopId");

-- CreateIndex
CREATE INDEX "CommunicationLog_type_idx" ON "CommunicationLog"("type");

-- CreateIndex
CREATE INDEX "CommunicationLog_status_idx" ON "CommunicationLog"("status");

-- CreateIndex
CREATE INDEX "CommunicationLog_templateKey_idx" ON "CommunicationLog"("templateKey");

-- CreateIndex
CREATE INDEX "CommunicationLog_entityType_entityId_idx" ON "CommunicationLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "CommunicationLog_sentAt_idx" ON "CommunicationLog"("sentAt");

-- AddForeignKey
ALTER TABLE "WorkshopSettings" ADD CONSTRAINT "WorkshopSettings_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleIntakeForm" ADD CONSTRAINT "VehicleIntakeForm_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleIntakeForm" ADD CONSTRAINT "VehicleIntakeForm_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleIntakeForm" ADD CONSTRAINT "VehicleIntakeForm_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_intakeFormId_fkey" FOREIGN KEY ("intakeFormId") REFERENCES "VehicleIntakeForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageMark" ADD CONSTRAINT "DamageMark_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageMark" ADD CONSTRAINT "DamageMark_intakeFormId_fkey" FOREIGN KEY ("intakeFormId") REFERENCES "VehicleIntakeForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_intakeFormId_fkey" FOREIGN KEY ("intakeFormId") REFERENCES "VehicleIntakeForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicShareLink" ADD CONSTRAINT "PublicShareLink_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicShareLink" ADD CONSTRAINT "PublicShareLink_intakeFormId_fkey" FOREIGN KEY ("intakeFormId") REFERENCES "VehicleIntakeForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeTimelineEvent" ADD CONSTRAINT "IntakeTimelineEvent_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeTimelineEvent" ADD CONSTRAINT "IntakeTimelineEvent_intakeFormId_fkey" FOREIGN KEY ("intakeFormId") REFERENCES "VehicleIntakeForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technician" ADD CONSTRAINT "Technician_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_intakeFormId_fkey" FOREIGN KEY ("intakeFormId") REFERENCES "VehicleIntakeForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionPayment" ADD CONSTRAINT "CollectionPayment_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionPayment" ADD CONSTRAINT "CollectionPayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionPayment" ADD CONSTRAINT "CollectionPayment_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderItem" ADD CONSTRAINT "ServiceOrderItem_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderItem" ADD CONSTRAINT "ServiceOrderItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "PartStockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_convertedServiceOrderId_fkey" FOREIGN KEY ("convertedServiceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "PartStockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_convertedServiceOrderId_fkey" FOREIGN KEY ("convertedServiceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceReminder" ADD CONSTRAINT "MaintenanceReminder_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceReminder" ADD CONSTRAINT "MaintenanceReminder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceReminder" ADD CONSTRAINT "MaintenanceReminder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartStockItem" ADD CONSTRAINT "PartStockItem_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartStockItem" ADD CONSTRAINT "PartStockItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_partId_fkey" FOREIGN KEY ("partId") REFERENCES "PartStockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePassportToken" ADD CONSTRAINT "VehiclePassportToken_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePassportToken" ADD CONSTRAINT "VehiclePassportToken_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrLog" ADD CONSTRAINT "OcrLog_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartsRequest" ADD CONSTRAINT "PartsRequest_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartsRequest" ADD CONSTRAINT "PartsRequest_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartsRequest" ADD CONSTRAINT "PartsRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborSession" ADD CONSTRAINT "LaborSession_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborSession" ADD CONSTRAINT "LaborSession_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborSession" ADD CONSTRAINT "LaborSession_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationTemplate" ADD CONSTRAINT "CommunicationTemplate_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSyncLog" ADD CONSTRAINT "CalendarSyncLog_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderExecutionLog" ADD CONSTRAINT "ReminderExecutionLog_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

