import "server-only"

import { prisma } from "@/lib/db"
import type { LiveChatConversationStatus } from "@prisma/client"

export type InboxFilter = "open" | "closed" | "all"

export interface InboxRow {
  id: string
  visitorName: string
  visitorEmail: string
  visitorPhone: string | null
  status: LiveChatConversationStatus
  startedOffline: boolean
  /** Ziyaretçi son mesajından beri yönetici okudu mu? */
  unread: boolean
  preview: string
  lastMessageAt: string
  createdAt: string
}

export interface ThreadMessage {
  id: string
  sender: "visitor" | "agent" | "system"
  agentEmail: string | null
  body: string
  createdAt: string
}

export interface ThreadDetail {
  id: string
  visitorName: string
  visitorEmail: string
  visitorPhone: string | null
  status: LiveChatConversationStatus
  startedOffline: boolean
  pageUrl: string | null
  clientIp: string | null
  createdAt: string
  messages: ThreadMessage[]
}

/** Okunmamış = ziyaretçinin son mesajı, yöneticinin son okumasından yeni. */
function isUnread(lastVisitorMessageAt: Date | null, agentLastReadAt: Date | null): boolean {
  if (!lastVisitorMessageAt) return false
  if (!agentLastReadAt) return true
  return lastVisitorMessageAt > agentLastReadAt
}

const STATUS_WHERE: Record<InboxFilter, { status?: LiveChatConversationStatus }> = {
  open: { status: "open" },
  closed: { status: "closed" },
  all: {},
}

export async function getInbox(filter: InboxFilter): Promise<InboxRow[]> {
  const conversations = await prisma.liveChatConversation.findMany({
    where: STATUS_WHERE[filter],
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    // Son 5 mesaj: önizleme otomatik (system) metinleri ATLAR. Aksi hâlde
    // mesai dışı açılan her görüşme, ziyaretçinin asıl sorusu yerine kendi
    // çevrimdışı şablonumuzu gösterirdi — listede hepsi birbirinin aynı olurdu.
    select: {
      id: true,
      visitorName: true,
      visitorEmail: true,
      visitorPhone: true,
      status: true,
      startedOffline: true,
      lastVisitorMessageAt: true,
      agentLastReadAt: true,
      lastMessageAt: true,
      createdAt: true,
      messages: { select: { sender: true, body: true }, orderBy: { createdAt: "desc" }, take: 5 },
    },
  })

  return conversations.map((c) => ({
    id: c.id,
    visitorName: c.visitorName,
    visitorEmail: c.visitorEmail,
    visitorPhone: c.visitorPhone,
    status: c.status,
    startedOffline: c.startedOffline,
    unread: isUnread(c.lastVisitorMessageAt, c.agentLastReadAt),
    preview: (c.messages.find((m) => m.sender !== "system") ?? c.messages[0])?.body ?? "",
    lastMessageAt: c.lastMessageAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
  }))
}

/** Nav rozetindeki sayı — açık VE yanıt bekleyen görüşme adedi. */
export async function getUnansweredCount(): Promise<number> {
  const rows = await prisma.liveChatConversation.findMany({
    where: { status: "open" },
    select: { lastVisitorMessageAt: true, agentLastReadAt: true },
    take: 200,
  })
  return rows.filter((r) => isUnread(r.lastVisitorMessageAt, r.agentLastReadAt)).length
}

export async function getThread(conversationId: string): Promise<ThreadDetail | null> {
  const conversation = await prisma.liveChatConversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      visitorName: true,
      visitorEmail: true,
      visitorPhone: true,
      status: true,
      startedOffline: true,
      pageUrl: true,
      clientIp: true,
      createdAt: true,
      messages: {
        select: { id: true, sender: true, agentEmail: true, body: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 500,
      },
    },
  })
  if (!conversation) return null

  return {
    id: conversation.id,
    visitorName: conversation.visitorName,
    visitorEmail: conversation.visitorEmail,
    visitorPhone: conversation.visitorPhone,
    status: conversation.status,
    startedOffline: conversation.startedOffline,
    pageUrl: conversation.pageUrl,
    clientIp: conversation.clientIp,
    createdAt: conversation.createdAt.toISOString(),
    messages: conversation.messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      agentEmail: m.agentEmail,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  }
}
