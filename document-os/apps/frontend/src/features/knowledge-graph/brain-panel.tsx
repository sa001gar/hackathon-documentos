import { Brain, Lightbulb, Loader2, Send } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { brainApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export function BrainPanel({}: { workspaceId?: string } = {}) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; sources?: Record<string, unknown>[] }>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const askMutation = useMutation({
    mutationFn: (q: string) => brainApi.ask(q),
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.answer,
        sources: data.sources,
      }]);
    },
    onError: () => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I couldn't find an answer. Try rephrasing your question.",
      }]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || askMutation.isPending) return;
    setMessages(prev => [...prev, { role: "user", content: query }]);
    askMutation.mutate(query);
    setQuery("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b">
        <Brain className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organization Brain</span>
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 p-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
            <Lightbulb className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-xs text-center mb-4">Ask anything about your organization</p>
            <div className="space-y-1.5 w-full">
              {[
                "Why was this feature built?",
                "Who approved the payment API?",
                "What depends on OAuth?",
                "What changed after the last design review?",
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setMessages(prev => [...prev, { role: "user", content: suggestion }]);
                    askMutation.mutate(suggestion);
                  }}
                  className="w-full text-left text-xs p-2 rounded border border-border hover:bg-muted/50 transition-colors"
                >
                  "{suggestion}"
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg p-3 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}>
                <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.sources.map((s: any, j: number) => (
                      <Badge key={j} variant="outline" className="text-[9px] px-1.5 py-0">
                        {s.title || s.label || s.key || s.type}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {askMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-3 border-t flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question..."
          className="h-9 text-sm flex-1"
        />
        <Button type="submit" size="icon-sm" disabled={!query.trim() || askMutation.isPending}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
