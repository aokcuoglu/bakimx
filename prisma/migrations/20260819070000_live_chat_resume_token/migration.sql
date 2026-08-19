-- BAK-99: canlı destek "sohbete geri dön" bağlantısının süreli anahtarı.
--
-- Yalnız yeni bir tablo eklenir; mevcut hiçbir satır/sütun değişmez, geri alma
-- tek adımdır (DROP TABLE). `publicToken` e-postaya girmesin diye görüşmeden
-- AYRI bir anahtar tutulur: sha256 özeti saklanır, süresi vardır, iptal edilebilir.

-- CreateTable
CREATE TABLE "LiveChatResumeToken" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveChatResumeToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveChatResumeToken_tokenHash_key" ON "LiveChatResumeToken"("tokenHash");

-- CreateIndex
CREATE INDEX "LiveChatResumeToken_conversationId_idx" ON "LiveChatResumeToken"("conversationId");

-- CreateIndex
CREATE INDEX "LiveChatResumeToken_expiresAt_idx" ON "LiveChatResumeToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "LiveChatResumeToken" ADD CONSTRAINT "LiveChatResumeToken_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "LiveChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
