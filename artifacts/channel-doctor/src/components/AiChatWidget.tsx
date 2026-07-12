import { useState, useRef, useEffect } from "react";
import { useAiChat, useGetConnectedProfile } from "@workspace/api-client-react";
import { useAuth } from "@clerk/clerk-react";
import { MessageCircle, Send, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Why are my views dropping?",
  "Give me 10 video ideas",
  "How can I improve my CTR?",
  "What should I post next?",
];

export default function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const { isSignedIn } = useAuth();
  const me = useGetConnectedProfile({ query: { enabled: !!isSignedIn } as any });
  const chat = useAiChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chat.isPending]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chat.isPending) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    try {
      const res = await chat.mutateAsync({
        data: {
          message: trimmed,
          channelId: me.data?.channelId ?? undefined,
          history: messages.slice(-8),
        },
      });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Hmm, something went wrong. Try again in a moment." },
      ]);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full shadow-2xl transition-all",
          "bg-gradient-to-br from-primary to-accent text-white hover:scale-105",
          open && "scale-90"
        )}
        aria-label="Open AI coach"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[560px] w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-gradient-to-r from-primary/15 to-accent/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-accent">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold">Doc</div>
                <div className="text-[11px] text-muted-foreground">
                  {me.data?.channelTitle ? `Coaching ${me.data.channelTitle}` : "Your AI growth coach"}
                </div>
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                  Hey — I'm Doc. Ask me anything about your channel, content ideas, growth strategy, or thumbnails.
                </div>
                <div className="space-y-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-left text-xs hover-elevate"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-secondary/60 text-foreground"
                )}
              >
                {m.content}
              </div>
            ))}
            {chat.isPending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Doc is thinking…
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-border/60 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Doc anything…"
              className="flex-1 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60"
            />
            <Button type="submit" size="icon" disabled={chat.isPending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
