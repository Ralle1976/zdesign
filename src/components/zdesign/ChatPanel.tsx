'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import type { ChatMessage } from '@/types/design';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Send,
  Mic,
  MicOff,
  Paperclip,
  Trash2,
  Sparkles,
  LayoutDashboard,
  Smartphone,
  Presentation,
  Bot,
  User,
  ImageIcon,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { AIImageDialog } from './AIImageDialog';

const EXAMPLE_PROMPTS = [
  {
    icon: LayoutDashboard,
    key: 'landing' as const,
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: LayoutDashboard,
    key: 'dashboard' as const,
    gradient: 'from-teal-500 to-cyan-500',
  },
  {
    icon: Smartphone,
    key: 'app' as const,
    gradient: 'from-cyan-500 to-emerald-500',
  },
  {
    icon: Presentation,
    key: 'slide' as const,
    gradient: 'from-emerald-500 to-green-500',
  },
];

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-bold">
          Z
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1 bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5">
        <motion.span
          className="size-2 rounded-full bg-emerald-500"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
        />
        <motion.span
          className="size-2 rounded-full bg-emerald-500"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
        />
        <motion.span
          className="size-2 rounded-full bg-emerald-500"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
        />
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'system') {
    return (
      <div className="flex justify-center px-4 py-1">
        <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex items-start gap-3 px-4 py-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <Avatar className="size-8 shrink-0">
        <AvatarFallback
          className={
            isUser
              ? 'bg-secondary text-secondary-foreground text-xs'
              : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-bold'
          }
        >
          {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={`max-w-[85%] space-y-1 ${isUser ? 'items-end' : 'items-start'}`}
      >
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-emerald-600 text-white rounded-tr-sm'
              : 'bg-muted rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_code]:text-xs [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-black/5 [&_pre]:rounded-md [&_pre]:p-2">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
        <p
          className={`text-[10px] text-muted-foreground px-1 ${isUser ? 'text-right' : ''}`}
        >
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </motion.div>
  );
}

function WelcomeState({
  onExampleClick,
}: {
  onExampleClick: (prompt: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="text-center space-y-4 max-w-sm"
      >
        {/* Logo */}
        <div className="flex items-center justify-center size-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-2xl shadow-lg shadow-emerald-500/20 mx-auto">
          Z
        </div>

        <div>
          <h2 className="text-lg font-semibold">{t.appName}</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {t.chat.welcome}
          </p>
        </div>

        {/* Example prompts */}
        <div className="grid grid-cols-1 gap-2 w-full mt-4">
          {EXAMPLE_PROMPTS.map((example) => (
            <motion.button
              key={example.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onExampleClick(t.chat.examples[example.key])}
              className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-accent/50 transition-colors text-left group"
            >
              <div
                className={`flex items-center justify-center size-9 rounded-lg bg-gradient-to-br ${example.gradient} text-white shrink-0`}
              >
                <example.icon className="size-4" />
              </div>
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {t.chat.examples[example.key]}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export function ChatPanel() {
  const { t } = useI18n();
  const chatMessages = useZDesignStore((s) => s.chatMessages);
  const addChatMessage = useZDesignStore((s) => s.addChatMessage);
  const clearChat = useZDesignStore((s) => s.clearChat);
  const isGenerating = useZDesignStore((s) => s.isGenerating);
  const setIsGenerating = useZDesignStore((s) => s.setIsGenerating);
  const projectId = useZDesignStore((s) => s.projectId);
  const designTree = useZDesignStore((s) => s.designTree);
  const designSystem = useZDesignStore((s) => s.designSystem);
  const setDesignTree = useZDesignStore((s) => s.setDesignTree);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // AI Image dialog
  const [aiImageOpen, setAiImageOpen] = useState(false);

  // Voice input
  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      if (transcript.trim()) {
        sendMessage(transcript.trim());
      }
    },
    [projectId, isGenerating, chatMessages, designTree, designSystem]
  );

  const handleVoiceInterim = useCallback((interim: string) => {
    setInput((prev) => {
      // Show interim transcript in the input field
      // Remove any previous interim text (it starts with ✨)
      const base = prev.replace(/🎤.*$/, '');
      return interim ? `${base}🎤 ${interim}` : base;
    });
  }, []);

  const {
    isListening,
    isSupported: voiceSupported,
    startListening,
    stopListening,
    error: voiceError,
  } = useVoiceInput({
    onTranscript: handleVoiceTranscript,
    onInterimTranscript: handleVoiceInterim,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isGenerating]);

  const sendMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || !projectId || isGenerating) return;

      // Clean up any voice indicators from the message
      const cleanText = messageText.replace(/🎤/g, '').trim();
      if (!cleanText) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        projectId,
        role: 'user',
        content: cleanText,
        createdAt: new Date(),
      };

      addChatMessage(userMessage);
      setInput('');
      setIsGenerating(true);

      try {
        const history = chatMessages.slice(-10).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: cleanText,
            projectId,
            designTree: designTree.children && designTree.children.length > 0 ? designTree : undefined,
            designSystem: designSystem || undefined,
            history,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const aiMessage: ChatMessage = {
            id: data.id || `ai-${Date.now()}`,
            projectId,
            role: 'assistant',
            content: data.message || 'I processed your request.',
            metadata: data.design
              ? { designUpdate: data.design }
              : undefined,
            createdAt: new Date(data.createdAt || Date.now()),
          };
          addChatMessage(aiMessage);

          if (data.design) {
            setDesignTree(data.design);
          }
        } else {
          const errorData = await res.json().catch(() => ({}));
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            projectId,
            role: 'system',
            content: `${t.common.error}: ${errorData.error || 'Unknown error'}`,
            createdAt: new Date(),
          };
          addChatMessage(errorMessage);
        }
      } catch {
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          projectId,
          role: 'system',
          content: t.common.error,
          createdAt: new Date(),
        };
        addChatMessage(errorMessage);
      } finally {
        setIsGenerating(false);
      }
    },
    [
      projectId,
      isGenerating,
      chatMessages,
      designTree,
      designSystem,
      addChatMessage,
      setIsGenerating,
      setDesignTree,
      t,
    ]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // Clean voice indicators before sending
        const cleanInput = input.replace(/🎤/g, '');
        sendMessage(cleanInput);
      }
    },
    [input, sendMessage]
  );

  const handleExampleClick = useCallback(
    (prompt: string) => {
      sendMessage(prompt);
    },
    [sendMessage]
  );

  const handleClear = useCallback(() => {
    clearChat();
  }, [clearChat]);

  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const hasMessages = chatMessages.length > 0;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-11 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-emerald-600" />
          <span className="text-sm font-medium">{t.chat.title}</span>
          {isGenerating && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            >
              {t.chat.thinking}
            </Badge>
          )}
        </div>
        {hasMessages && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleClear}
              >
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t.chat.clearChat}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Messages or Welcome */}
      {!hasMessages ? (
        <WelcomeState onExampleClick={handleExampleClick} />
      ) : (
        <ScrollArea className="flex-1">
          <div ref={scrollRef} className="py-2 space-y-1">
            <AnimatePresence mode="popLayout">
              {chatMessages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>
            {isGenerating && <TypingIndicator />}
          </div>
        </ScrollArea>
      )}

      <Separator />

      {/* Input area */}
      <div className="p-3 shrink-0">
        <div className="relative flex items-end gap-2 bg-muted/50 rounded-xl border focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
          {/* Attachment button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 ml-2 mb-1.5 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Paperclip className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Attach file</TooltipContent>
          </Tooltip>

          {/* AI Image button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 mb-1.5 shrink-0 text-muted-foreground hover:text-emerald-600"
                onClick={() => setAiImageOpen(true)}
              >
                <ImageIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {t.aiImage?.buttonText || 'AI Image'}
            </TooltipContent>
          </Tooltip>

          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? t.voice?.listening || 'Listening...'
                : t.chat.placeholder
            }
            className={`min-h-[44px] max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:border-0 shadow-none text-sm py-2.5 px-0 placeholder:text-muted-foreground/60 ${
              isListening ? 'placeholder:text-red-500/60' : ''
            }`}
            rows={1}
            disabled={isGenerating}
          />

          <div className="flex items-center gap-0.5 mr-1.5 mb-1.5 shrink-0">
            {/* Voice input button */}
            {voiceSupported && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`size-8 ${
                      isListening
                        ? 'text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={handleVoiceToggle}
                  >
                    {isListening ? (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <Mic className="size-4" />
                      </motion.div>
                    ) : (
                      <Mic className="size-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {isListening
                    ? t.voice?.stopListening || 'Stop listening'
                    : t.voice?.startListening || 'Start voice input'}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Send button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  className="size-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    const cleanInput = input.replace(/🎤/g, '');
                    sendMessage(cleanInput);
                  }}
                  disabled={!input.replace(/🎤/g, '').trim() || isGenerating}
                >
                  <Send className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {t.chat.send} (Enter)
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Voice error */}
        {voiceError && (
          <p className="text-[10px] text-red-500 mt-1 text-center">
            {voiceError}
          </p>
        )}

        {/* Listening indicator */}
        {isListening && (
          <div className="flex items-center justify-center gap-2 mt-1.5">
            <motion.div
              className="size-2 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <span className="text-[10px] text-red-500 font-medium">
              {t.voice?.listening || 'Listening...'}
            </span>
          </div>
        )}

        {!isListening && (
          <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
            Shift+Enter for new line
          </p>
        )}
      </div>

      {/* AI Image Dialog */}
      <AIImageDialog open={aiImageOpen} onOpenChange={setAiImageOpen} />
    </div>
  );
}
