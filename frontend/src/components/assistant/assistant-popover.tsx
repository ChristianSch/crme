"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, History, LinkIcon, MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, AssistantAction, AssistantConversation, ChatMessage, Company, Deal, EntityRef, fullName, Person, Suggestion, Todo } from "@/lib/api";
import { formatMoney, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type PendingAssistantAction = AssistantAction;

export function AssistantPopover({
  selectedSuggestion,
  onChanged,
  onSelectPerson,
  onSelectCompany,
  onSelectDeal,
  onSelectTask,
}: {
  selectedSuggestion?: Suggestion;
  onChanged: () => void;
  onSelectPerson: (person: Person) => void;
  onSelectCompany: (company: Company) => void;
  onSelectDeal: (deal: Deal) => void;
  onSelectTask: (task: Todo) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAssistantAction | null>(null);
  const [conversationId, setConversationId] = useState<string>("");
  const [recentConversations, setRecentConversations] = useState<AssistantConversation[]>([]);
  const [assistantView, setAssistantView] = useState<"chat" | "history">("chat");
  const [open, setOpen] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const loadRecentConversations = useCallback(async (resumeLatest = false) => {
    try {
      const recent = await api.conversations(5);
      setRecentConversations(recent ?? []);
      if (resumeLatest && recent?.[0]) {
        setConversationId(recent[0].id);
        setMessages(recent[0].messages ?? []);
        setPendingAction(recent[0].pending_action ?? null);
      }
    } catch {
      // Conversation history is a convenience; chat should still work if loading it fails.
    }
  }, []);

  useEffect(() => {
    void loadRecentConversations(true);
  }, [loadRecentConversations]);

  const scrollChatToBottom = useCallback(() => {
    requestAnimationFrame(() => chatBottomRef.current?.scrollIntoView({ block: "end" }));
  }, []);

  useEffect(() => {
    if (!open || assistantView !== "chat") return;
    scrollChatToBottom();
  }, [open, assistantView, messages, pendingAction, sending, scrollChatToBottom]);

  function newSession() {
    setMessages([]);
    setInput("");
    setPendingAction(null);
    setConversationId("");
    setAssistantView("chat");
  }

  function resumeConversation(conversation: AssistantConversation) {
    setConversationId(conversation.id);
    setMessages(conversation.messages ?? []);
    setPendingAction(conversation.pending_action ?? null);
    setAssistantView("chat");
    scrollChatToBottom();
  }

  function seedSuggestion() {
    if (!selectedSuggestion) return;
    setInput(`Help me review this CRM suggestion:\n${selectedSuggestion.title}\n\n${selectedSuggestion.body}`);
  }

  async function sendMessage(content: string) {
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");

    setSending(true);
    try {
      const response = await api.chat(nextMessages, conversationId);
      if (response.conversation_id) setConversationId(response.conversation_id);
      setPendingAction(response.pending_action ?? null);
      setMessages([...nextMessages, { role: "assistant", content: assistantMessageContent(response.text, response.entities, response.pending_action) }]);
      void loadRecentConversations();
    } catch (error) {
      setMessages([...nextMessages, { role: "assistant", content: error instanceof Error ? error.message : "Chat failed" }]);
    } finally {
      setSending(false);
    }
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content) return;
    await sendMessage(content);
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    setSending(true);
    try {
      const action = pendingAction;
      const result = await api.executeAssistantAction(action);
      await onChanged();
      const continuationMessages: ChatMessage[] = [
        ...messages,
        { role: "user", content: "Confirm" },
        {
          role: "user",
          content: `ACTION_RESULT:\n${action.command} succeeded.\nResult: ${JSON.stringify(result)}\nContinue the original request if more confirmed steps are needed. If the workflow is complete, say so briefly.`,
        },
      ];
      const response = await api.chat(continuationMessages, conversationId);
      if (response.conversation_id) setConversationId(response.conversation_id);
      setPendingAction(response.pending_action ?? null);
      setMessages([...continuationMessages, { role: "assistant", content: assistantMessageContent(response.text, response.entities, response.pending_action) }]);
      void loadRecentConversations();
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "Action failed" }]);
    } finally {
      setSending(false);
    }
  }

  function cancelPendingAction() {
    setMessages((current) => [...current, { role: "user", content: "Cancel" }, { role: "assistant", content: "Okay, I did not change anything." }]);
    setPendingAction(null);
  }

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button className="h-11 rounded-xl bg-background border border-border px-4 text-foreground shadow-[0_6px_20px_oklch(0.45_0.01_255_/_0.12)] hover:bg-muted">
            <MessageSquareText className="size-4" /> Assistant
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" sideOffset={10} collisionPadding={16} className="z-[101] flex h-[min(520px,calc(100vh-2rem))] w-[min(calc(100vw-2rem),380px)] flex-col overflow-hidden rounded-2xl p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold"><MessageSquareText className="size-4" /> Assistant</h2>
              <p className="text-xs text-muted-foreground">Recent conversations saved</p>
            </div>
            <div className="flex items-center gap-2">
              {assistantView === "history" ? (
                <Button variant="outline" size="sm" className="h-8 rounded-xl bg-background" onClick={() => setAssistantView("chat")}><ChevronLeft className="size-3.5" /> Chat</Button>
              ) : (
                <Button variant="outline" size="sm" className="h-8 rounded-xl bg-background" onClick={() => setAssistantView("history")}><History className="size-3.5" /> History</Button>
              )}
              <Button variant="outline" size="sm" className="h-8 rounded-xl bg-background" onClick={newSession}>New</Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {assistantView === "chat" ? (
              <div className="flex h-full min-w-0 flex-col overflow-hidden bg-background">
                <ScrollArea className="min-h-0 min-w-0 flex-1 p-4">
                  <div className="w-full min-w-0 space-y-1.5 overflow-hidden">
                    {!messages.length && (
                      <div className="rounded-2xl bg-muted/45 p-4 text-sm leading-6 text-muted-foreground">
                        Ask about a contact, draft a follow-up, or review a suggestion. {selectedSuggestion && <button className="font-medium text-foreground underline-offset-4 hover:underline" onClick={seedSuggestion}>Load current suggestion.</button>}
                      </div>
                    )}
                    {visibleAssistantItems(messages).map((item, index, visibleItems) => {
                      if (item.kind === "entity") {
                        return <AssistantEntityCard key={index} entity={item.entity} onSelectPerson={onSelectPerson} onSelectCompany={onSelectCompany} onSelectDeal={onSelectDeal} onSelectTask={onSelectTask} />;
                      }
                      if (item.kind === "action-status") {
                        return <AssistantActionStatus key={index} status={item.status} />;
                      }
                      const message = item.message;
                      const isLastAssistant = message.role === "assistant" && index === visibleItems.length - 1;
                      return (
                        <div key={index} className={cn("max-w-full overflow-hidden text-sm leading-6", message.role === "user" ? "ml-6 rounded-2xl bg-[oklch(0.19_0.006_255)] p-3 text-[oklch(0.985_0.004_255)]" : "border-b border-border/70 py-3 text-foreground last:border-b-0")}>
                          <AssistantMessageText content={message.content} entities={item.entities} onSelectPerson={onSelectPerson} onSelectCompany={onSelectCompany} onSelectDeal={onSelectDeal} onSelectTask={onSelectTask} />
                          {isLastAssistant && pendingAction && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button type="button" size="sm" className="h-8 rounded-xl" disabled={sending} onClick={confirmPendingAction}>Confirm</Button>
                              <Button type="button" size="sm" variant="outline" className="h-8 rounded-xl bg-background" disabled={sending} onClick={cancelPendingAction}>Cancel</Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {sending && <div className="mr-6 rounded-2xl bg-muted/55 p-3 text-sm text-muted-foreground">Thinking...</div>}
                    <div ref={chatBottomRef} />
                  </div>
                </ScrollArea>
                <form onSubmit={send} className="border-t p-3">
                  <Input value={input} onChange={(event) => setInput(event.target.value)} aria-label="Ask CRMe" placeholder="Ask CRMe..." className="h-10 rounded-xl bg-background" />
                </form>
              </div>
            ) : (
              <div className="flex h-full min-w-0 flex-col overflow-hidden bg-background">
                <ScrollArea className="min-h-0 min-w-0 flex-1 p-4">
                  <div className="w-full divide-y overflow-hidden">
                    {recentConversations.length ? recentConversations.map((conversation) => (
                      <button key={conversation.id} type="button" className={cn("block w-full px-3 py-3 text-left transition-colors hover:bg-muted/60", conversation.id === conversationId && "bg-muted/45")} onClick={() => resumeConversation(conversation)}>
                        <div className="whitespace-normal break-words text-sm font-medium leading-5">{conversation.title || "Assistant conversation"}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{shortDate(conversation.updated_at)}</div>
                      </button>
                    )) : (
                      <div className="p-4 text-sm leading-6 text-muted-foreground">No recent conversations yet.</div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

type AssistantVisibleItem =
  | { kind: "message"; message: ChatMessage; entities: AssistantEntity[] }
  | { kind: "entity"; entity: AssistantEntity }
  | { kind: "action-status"; status: "confirmed" | "cancelled" };

type AssistantEntity =
  | { type: "person"; value: Person; title: string; subtitle: string }
  | { type: "company"; value: Company; title: string; subtitle: string }
  | { type: "deal"; value: Deal; title: string; subtitle: string }
  | { type: "task"; value: Todo; title: string; subtitle: string };

function visibleAssistantItems(messages: ChatMessage[]): AssistantVisibleItem[] {
  return messages.flatMap((message): AssistantVisibleItem[] => {
    const actionEntity = assistantEntityFromActionResult(message);
    if (actionEntity) return [{ kind: "entity", entity: actionEntity }];
    const actionStatus = assistantActionStatus(message);
    if (actionStatus) return [{ kind: "action-status", status: actionStatus }];
    if (isInternalAssistantMessage(message)) return [];
    const { text, entities } = splitAssistantEntityBlock(message.content);
    const linkedEntities = entities.filter((entity) => entityMentionedInText(text, entity));
    const cardEntities = entities.filter((entity) => !entityMentionedInText(text, entity));
    return [{ kind: "message", message: { ...message, content: text }, entities: linkedEntities }, ...cardEntities.map((entity) => ({ kind: "entity" as const, entity }))];
  });
}

function entityMentionedInText(text: string, entity: AssistantEntity) {
  return Boolean(entity.title) && text.toLowerCase().includes(entity.title.toLowerCase());
}

function splitAssistantEntityBlock(content: string) {
  const marker = "\n\nASSISTANT_ENTITIES:";
  const index = content.indexOf(marker);
  if (index < 0) return { text: content, entities: [] as AssistantEntity[] };
  const text = content.slice(0, index).trim();
  try {
    const refs = JSON.parse(content.slice(index + marker.length)) as EntityRef[];
    return { text, entities: refs.map(entityFromRef).filter((entity): entity is AssistantEntity => Boolean(entity)) };
  } catch {
    return { text: content, entities: [] as AssistantEntity[] };
  }
}

function entityFromRef(ref: EntityRef): AssistantEntity | null {
  if (ref.entity_type === "deal") return { type: "deal", value: { id: ref.entity_id, name: ref.title, stage: ref.subtitle, workspace_id: "", value_cents: 0, currency: "" } as Deal, title: ref.title, subtitle: ref.subtitle || "Deal" };
  if (ref.entity_type === "company") return { type: "company", value: { id: ref.entity_id, name: ref.title, domain: ref.subtitle } as Company, title: ref.title, subtitle: ref.subtitle || "Company" };
  if (ref.entity_type === "person") return { type: "person", value: { id: ref.entity_id, first_name: ref.title, last_name: "", email: ref.subtitle } as Person, title: ref.title, subtitle: ref.subtitle || "Person" };
  if (ref.entity_type === "task") return { type: "task", value: { id: ref.entity_id, title: ref.title, body: "", status: "open", priority: "normal", entity_type: "", entity_id: "" } as Todo, title: ref.title, subtitle: ref.subtitle || "Task" };
  return null;
}

function assistantActionStatus(message: ChatMessage): "confirmed" | "cancelled" | null {
  if (message.role !== "user") return null;
  const content = message.content.trim().toLowerCase();
  if (content === "confirm") return "confirmed";
  if (content === "cancel") return "cancelled";
  return null;
}

function isInternalAssistantMessage(message: ChatMessage) {
  const content = message.content.trim();
  return message.role === "user" && content.startsWith("ACTION_RESULT:");
}

function assistantEntityFromActionResult(message: ChatMessage): AssistantEntity | null {
  const content = message.content.trim();
  if (message.role !== "user" || !content.startsWith("ACTION_RESULT:")) return null;
  const command = content.match(/^ACTION_RESULT:\n([^\s]+) succeeded\./)?.[1] ?? "";
  const resultMatch = content.match(/\nResult: ([\s\S]*)\nContinue/);
  if (!resultMatch) return null;
  try {
    const value = JSON.parse(resultMatch[1]) as Partial<Person & Company & Deal & Todo>;
    if (!value || typeof value !== "object" || !value.id) return null;
    if (command.startsWith("deal-")) {
      const deal = value as Deal;
      return { type: "deal", value: deal, title: deal.name || "Unnamed deal", subtitle: [formatMoney(deal.value_cents || 0, deal.currency), deal.stage].filter(Boolean).join(" · ") };
    }
    if (command.startsWith("company-")) {
      const company = value as Company;
      return { type: "company", value: company, title: company.name || "Unnamed company", subtitle: company.domain || "Company" };
    }
    if (command.startsWith("person-")) {
      const person = value as Person;
      return { type: "person", value: person, title: fullName(person), subtitle: person.email || person.title || "Person" };
    }
    if (command.startsWith("task-")) {
      const task = value as Todo;
      return { type: "task", value: task, title: task.title || "Untitled task", subtitle: task.status || "Task" };
    }
  } catch {
    return null;
  }
  return null;
}

function AssistantActionStatus({ status }: { status: "confirmed" | "cancelled" }) {
  return (
    <div className="flex justify-end py-1">
      <div className={cn("rounded-full px-2 py-0.5 text-xs", status === "confirmed" ? "bg-muted text-muted-foreground" : "bg-muted/60 text-muted-foreground")}>{status === "confirmed" ? "Confirmed" : "Cancelled"}</div>
    </div>
  );
}

function AssistantMessageText({ content, entities, onSelectPerson, onSelectCompany, onSelectDeal, onSelectTask }: { content: string; entities: AssistantEntity[]; onSelectPerson: (person: Person) => void; onSelectCompany: (company: Company) => void; onSelectDeal: (deal: Deal) => void; onSelectTask: (task: Todo) => void }) {
  const renderInline = (text: string) => <AssistantInlineText content={text} entities={entities} onSelectPerson={onSelectPerson} onSelectCompany={onSelectCompany} onSelectDeal={onSelectDeal} onSelectTask={onSelectTask} />;
  const blocks = markdownBlocks(content);
  return (
    <div className="max-w-full space-y-2 overflow-hidden break-words [overflow-wrap:anywhere]">
      {blocks.map((block, index) => {
        if (block.kind === "ol") return <ol key={index} className="ml-5 list-decimal space-y-1">{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ol>;
        if (block.kind === "ul") return <ul key={index} className="ml-5 list-disc space-y-1">{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ul>;
        if (block.kind === "p") return <p key={index} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{renderInline(block.text)}</p>;
        return null;
      })}
    </div>
  );
}

function markdownBlocks(content: string) {
  const lines = content.split("\n");
  const blocks: Array<{ kind: "p"; text: string } | { kind: "ol" | "ul"; items: string[] }> = [];
  let paragraph: string[] = [];
  let list: { kind: "ol" | "ul"; items: string[] } | null = null;
  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ kind: "p", text: paragraph.join("\n") });
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push(list);
    list = null;
  };
  for (const line of lines) {
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    const unordered = line.match(/^\s*[-*]\s+(.*)$/);
    if (ordered || unordered) {
      flushParagraph();
      const kind = ordered ? "ol" : "ul";
      if (!list || list.kind !== kind) flushList();
      if (!list) list = { kind, items: [] };
      list.items.push((ordered?.[1] ?? unordered?.[1] ?? "").trim());
      continue;
    }
    flushList();
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks.length ? blocks : [{ kind: "p" as const, text: content }];
}

function AssistantInlineText({ content, entities, onSelectPerson, onSelectCompany, onSelectDeal, onSelectTask }: { content: string; entities: AssistantEntity[]; onSelectPerson: (person: Person) => void; onSelectCompany: (company: Company) => void; onSelectDeal: (deal: Deal) => void; onSelectTask: (task: Todo) => void }) {
  const normalizedContent = stripEntityBoldMarkers(content, entities);
  const entityParts = inlineEntityParts(normalizedContent, entities);
  return <>{entityParts.map((part, index) => part.entity ? <button key={index} type="button" className="inline max-w-full rounded-sm bg-muted px-1 font-medium text-foreground underline decoration-border underline-offset-4 hover:bg-muted/70" onClick={() => openAssistantEntity(part.entity!, onSelectPerson, onSelectCompany, onSelectDeal, onSelectTask)}>{part.text}</button> : <span key={index} className="break-words [overflow-wrap:anywhere]">{renderBoldText(part.text)}</span>)}</>;
}

function stripEntityBoldMarkers(content: string, entities: AssistantEntity[]) {
  return entities.reduce((out, entity) => {
    if (!entity.title) return out;
    const escapedTitle = entity.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return out.replace(new RegExp(`\\*\\*${escapedTitle}\\*\\*`, "gi"), entity.title);
  }, content);
}

function renderBoldText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong> : <span key={index}>{part}</span>);
}

function inlineEntityParts(content: string, entities: AssistantEntity[]) {
  const matches = entities
    .flatMap((entity) => entity.title ? [{ entity, index: content.toLowerCase().indexOf(entity.title.toLowerCase()) }] : [])
    .filter((match) => match.index >= 0)
    .sort((a, b) => a.index - b.index || b.entity.title.length - a.entity.title.length);
  const parts: Array<{ text: string; entity?: AssistantEntity }> = [];
  let cursor = 0;
  for (const match of matches) {
    const end = match.index + match.entity.title.length;
    if (match.index < cursor) continue;
    if (match.index > cursor) parts.push({ text: content.slice(cursor, match.index) });
    parts.push({ text: content.slice(match.index, end), entity: match.entity });
    cursor = end;
  }
  if (cursor < content.length) parts.push({ text: content.slice(cursor) });
  return parts.length ? parts : [{ text: content }];
}

function openAssistantEntity(entity: AssistantEntity, onSelectPerson: (person: Person) => void, onSelectCompany: (company: Company) => void, onSelectDeal: (deal: Deal) => void, onSelectTask: (task: Todo) => void) {
  if (entity.type === "person") onSelectPerson(entity.value);
  if (entity.type === "company") onSelectCompany(entity.value);
  if (entity.type === "deal") onSelectDeal(entity.value);
  if (entity.type === "task") onSelectTask(entity.value);
}

function AssistantEntityCard({ entity, onSelectPerson, onSelectCompany, onSelectDeal, onSelectTask }: { entity: AssistantEntity; onSelectPerson: (person: Person) => void; onSelectCompany: (company: Company) => void; onSelectDeal: (deal: Deal) => void; onSelectTask: (task: Todo) => void }) {
  const open = () => {
    openAssistantEntity(entity, onSelectPerson, onSelectCompany, onSelectDeal, onSelectTask);
  };
  const label = entity.type === "person" ? "Person" : entity.type === "company" ? "Company" : entity.type === "deal" ? "Deal" : "Task";
  return (
    <button type="button" onClick={open} className="block w-full max-w-full overflow-hidden border-b border-border/70 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring">
      <div className="grid min-w-0 grid-cols-[4.5rem_1fr_auto] items-start gap-3 px-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="min-w-0">
          <div className="line-clamp-2 break-words font-medium leading-5 text-foreground">{entity.title}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{entity.subtitle}</div>
        </div>
        <LinkIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      </div>
    </button>
  );
}

function assistantMessageContent(text: string, entities?: EntityRef[], action?: PendingAssistantAction) {
  const entityBlock = entities?.length ? `\n\nASSISTANT_ENTITIES:${JSON.stringify(entities)}` : "";
  return `${action ? pendingActionLabel(action, text) : assistantTextWithoutEntityLinks(redactAssistantJSON(text), entities)}${entityBlock}`;
}

function assistantTextWithoutEntityLinks(text: string, entities?: EntityRef[]) {
  if (!entities?.length) return text;
  return entities.reduce((out, entity) => {
    const escapedTitle = entity.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return out.replace(new RegExp(`\\[${escapedTitle}\\]\\([^)]*\\)`, "g"), entity.title);
  }, text);
}

function pendingActionLabel(_action: PendingAssistantAction, text: string) {
  return `${redactAssistantJSON(redactInternalIds(text))}\n\nConfirm this action?`;
}

function redactAssistantJSON(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return text;
  try {
    const parsed = JSON.parse(trimmed) as { text?: string };
    return parsed.text || text;
  } catch {
    const match = trimmed.match(/"text":"([\s\S]*?)","pending_action"/);
    return match?.[1]?.replaceAll("\\n", "\n") ?? text;
  }
}

function redactInternalIds(text: string) {
  return text.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[internal id]");
}

