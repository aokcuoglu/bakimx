-- CreateEnum
CREATE TYPE "LiveChatConversationStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "LiveChatSender" AS ENUM ('visitor', 'agent', 'system');

-- CreateTable
CREATE TABLE "LiveChatSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "schedule" JSONB NOT NULL,
    "holidays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "greeting" TEXT NOT NULL,
    "offlineMessage" TEXT NOT NULL,
    "responseNote" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByEmail" TEXT,

    CONSTRAINT "LiveChatSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveChatConversation" (
    "id" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "status" "LiveChatConversationStatus" NOT NULL DEFAULT 'open',
    "visitorName" TEXT NOT NULL,
    "visitorEmail" TEXT NOT NULL,
    "visitorPhone" TEXT,
    "startedOffline" BOOLEAN NOT NULL DEFAULT false,
    "clientIp" TEXT,
    "userAgent" TEXT,
    "pageUrl" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitorMessageAt" TIMESTAMP(3),
    "lastAgentMessageAt" TIMESTAMP(3),
    "agentLastReadAt" TIMESTAMP(3),
    "visitorLastReadAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sender" "LiveChatSender" NOT NULL,
    "agentEmail" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveChatConversation_publicToken_key" ON "LiveChatConversation"("publicToken");

-- CreateIndex
CREATE INDEX "LiveChatConversation_status_lastMessageAt_idx" ON "LiveChatConversation"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "LiveChatConversation_lastMessageAt_idx" ON "LiveChatConversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "LiveChatMessage_conversationId_createdAt_idx" ON "LiveChatMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "LiveChatMessage" ADD CONSTRAINT "LiveChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "LiveChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
