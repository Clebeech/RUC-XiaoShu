import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, User, Bot, Loader2, Trash2, ThumbsUp, ThumbsDown, ImagePlus, Mic, X } from 'lucide-react';
import TopBar from '@/components/TopBar';
import ChatHistory, { ChatSessionItem } from '@/components/ChatHistory';
import { Document } from '@/types/knowledge';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient, BackendChat } from '@/lib/api';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  isLoading?: boolean;
  feedback?: 'like' | 'dislike' | null;
}

interface PendingImage {
  file: File;
  previewUrl: string;
}

interface ParsedMessageContent {
  imageUrl: string | null;
  text: string;
}

export default function Index() {
  const [chats, setChats] = useState<BackendChat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [draftMessages, setDraftMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState('education');
  const [selectedModel, setSelectedModel] = useState('qwen-max');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // 初始化默认消息
  const getDefaultMessage = (): Message => ({
    id: '1',
    content: '您好！我是教务小数，中国人民大学的智能教务助手。我可以帮助您解答各种教务相关问题，包括课程安排、考试信息、学分要求等。请问有什么可以帮助您的吗？',
    sender: 'bot',
    timestamp: new Date()
  });

  useEffect(() => {
    setDraftMessages([getDefaultMessage()]);
    void refreshChats();
  }, []);

  useEffect(() => {
    return () => {
      if (pendingImage?.previewUrl) {
        URL.revokeObjectURL(pendingImage.previewUrl);
      }
    };
  }, [pendingImage]);

  const mapBackendChatMessages = (chat: BackendChat): Message[] => (
    chat.messages.map((message) => ({
      id: String(message.id),
      content: message.content,
      sender: message.role === 'assistant' ? 'bot' : 'user',
      timestamp: new Date(message.created_at),
      feedback: message.feedback ?? null,
    }))
  );

  const parseMessageContent = (content: string): ParsedMessageContent => {
    const match = content.match(/^\[\[image:(.+?)\]\]\n?/s);
    if (!match) {
      return { imageUrl: null, text: content };
    }
    return {
      imageUrl: match[1],
      text: content.slice(match[0].length),
    };
  };

  const refreshChats = async (preferredChatId?: number) => {
    try {
      const backendChats = await apiClient.listChats();
      setChats(backendChats);

      if (typeof preferredChatId === 'number') {
        setCurrentChatId(String(preferredChatId));
        return;
      }

      setCurrentChatId((prev) => {
        if (prev && backendChats.some((chat) => String(chat.id) === prev)) {
          return prev;
        }
        return null;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载聊天记录失败');
    }
  };

  const currentMessages = currentChatId
    ? mapBackendChatMessages(
        chats.find((chat) => String(chat.id) === currentChatId) ?? {
          id: 0,
          title: '',
          knowledge_base_name: selectedKnowledgeBase,
          created_at: new Date().toISOString(),
          messages: [],
        }
      )
    : draftMessages;

  const chatSessions: ChatSessionItem[] = chats.map((chat) => {
    const lastMessage = chat.messages[chat.messages.length - 1];
    const parsedLastMessage = lastMessage ? parseMessageContent(lastMessage.content) : null;
    return {
      id: String(chat.id),
      title: chat.title,
      lastMessage: parsedLastMessage?.text || '新对话',
      timestamp: new Date(lastMessage?.created_at || chat.created_at),
      messageCount: chat.messages.length,
    };
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages]);

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && !pendingImage) || isLoading) return;

    const questionText = inputValue.trim() || '请结合这张图片回答。';
    const userContent = pendingImage
      ? `[[image:${pendingImage.previewUrl}]]\n${questionText}`
      : questionText;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: userContent,
      sender: 'user',
      timestamp: new Date()
    };

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: '正在思考中...',
      sender: 'bot',
      timestamp: new Date(),
      isLoading: true
    };

    if (currentChatId) {
      setChats((prev) => prev.map((chat) => (
        String(chat.id) === currentChatId
          ? {
              ...chat,
              messages: [
                ...chat.messages,
                {
                  id: Number(userMessage.id),
                  role: 'user',
                  content: userMessage.content,
                  created_at: userMessage.timestamp.toISOString(),
                },
                {
                  id: Number(loadingMessage.id),
                  role: 'assistant',
                  content: loadingMessage.content,
                  created_at: loadingMessage.timestamp.toISOString(),
                },
              ],
            }
          : chat
      )));
    } else {
      setDraftMessages((prev) => [...prev, userMessage, loadingMessage]);
    }
    
    setInputValue('');
    setIsLoading(true);

    try {
      const response = pendingImage
        ? await apiClient.imageQuery(
            questionText,
            pendingImage.file,
            selectedKnowledgeBase,
            selectedModel,
            currentChatId ? Number(currentChatId) : undefined
          )
        : await apiClient.query(
            userMessage.content,
            selectedKnowledgeBase,
            selectedModel,
            currentChatId ? Number(currentChatId) : undefined
          );

      await refreshChats(response.chat_id);
      setDraftMessages([getDefaultMessage()]);
      if (pendingImage?.previewUrl) {
        URL.revokeObjectURL(pendingImage.previewUrl);
      }
      setPendingImage(null);
      toast.success(response.citations.length > 0 ? '回答已更新并附带引用' : '回答已更新');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '发生未知错误';
      const failureMessage = `抱歉，发生了错误：${errorMessage}\n\n请稍后重试，或联系管理员检查后端配置。`;
      if (currentChatId) {
        setChats((prev) => prev.map((chat) => (
          String(chat.id) === currentChatId
            ? {
                ...chat,
                messages: chat.messages.map((message) => (
                  String(message.id) === loadingMessage.id
                    ? { ...message, content: failureMessage }
                    : message
                )),
              }
            : chat
        )));
      } else {
        setDraftMessages((prev) => prev.map((message) => (
          message.id === loadingMessage.id
            ? { ...message, content: failureMessage, isLoading: false }
            : message
        )));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageTrigger = () => {
    if (isLoading) return;
    imageInputRef.current?.click();
  };

  const handleAudioTrigger = () => {
    if (isLoading) return;
    audioInputRef.current?.click();
  };

  const handleImageFile = (file: File) => {
    if (pendingImage?.previewUrl) {
      URL.revokeObjectURL(pendingImage.previewUrl);
    }
    setPendingImage({
      file,
      previewUrl: URL.createObjectURL(file),
    });
    toast.success('图片已添加，请输入问题后发送');
  };

  const handleImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    handleImageFile(file);
  };

  const handleAudioSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsLoading(true);
    try {
      const response = await apiClient.transcribeAudio(file);
      setInputValue(response.transcript);
      toast.success('语音识别完成，已填入输入框');
      inputRef.current?.focus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '语音识别失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputPaste = async (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (isLoading) return;

    const items = Array.from(event.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    event.preventDefault();
    handleImageFile(file);
  };

  const handleRemovePendingImage = () => {
    if (pendingImage?.previewUrl) {
      URL.revokeObjectURL(pendingImage.previewUrl);
    }
    setPendingImage(null);
  };

  const handleClearChat = () => {
    if (!confirm('确定要清空当前聊天记录吗？此操作不可撤销。')) return;
    if (!currentChatId) {
      setDraftMessages([getDefaultMessage()]);
      return;
    }
    void handleDeleteChat(currentChatId);
  };

  const handleNewChat = () => {
    setCurrentChatId(null);
    setDraftMessages([getDefaultMessage()]);
  };

  const handleChatSelect = (chatId: string) => {
    setCurrentChatId(chatId);
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      await apiClient.deleteChat(Number(chatId));
      const nextChats = chats.filter((chat) => String(chat.id) !== chatId);
      setChats(nextChats);
      if (chatId === currentChatId) {
        setCurrentChatId(nextChats[0] ? String(nextChats[0].id) : null);
        if (nextChats.length === 0) {
          setDraftMessages([getDefaultMessage()]);
        }
      }
      toast.success('对话已删除');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除对话失败');
    }
  };

  const handleMessageFeedback = (messageId: string, feedback: 'like' | 'dislike') => {
    if (currentChatId) {
      setChats((prev) => prev.map((chat) => (
        String(chat.id) === currentChatId
          ? {
              ...chat,
              messages: chat.messages.map((message) => (
                String(message.id) === messageId
                  ? {
                      ...message,
                      feedback: message.feedback === feedback ? null : feedback,
                    }
                  : message
              )),
            }
          : chat
      )));
    } else {
      setDraftMessages((prev) => prev.map((message) => (
        message.id === messageId
          ? { ...message, feedback: message.feedback === feedback ? null : feedback }
          : message
      )));
    }

    const target = currentMessages.find((message) => message.id === messageId);
    const nextFeedback = target?.feedback === feedback ? null : feedback;
    if (nextFeedback === 'like') {
      toast.success('已反馈：赞');
    } else if (nextFeedback === 'dislike') {
      toast('已反馈：踩', { description: '感谢您的反馈' });
    } else {
      toast('已取消反馈');
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderMessageContent = (content: string) => {
    const parsed = parseMessageContent(content);
    const textLines = parsed.text.split('\n');

    const renderedText = textLines.map((line, lineIndex) => {
      const parts: React.ReactNode[] = [];
      const pattern = /\[\[doc:(\d+)\|([^\]]+)\]\]/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(line)) !== null) {
        const [raw, documentId, documentName] = match;
        if (match.index > lastIndex) {
          parts.push(line.slice(lastIndex, match.index));
        }

        parts.push(
          <a
            key={`${documentId}-${match.index}`}
            href={`${API_BASE_URL}/api/documents/${documentId}/download`}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:opacity-80"
          >
            {documentName}
          </a>
        );

        lastIndex = match.index + raw.length;
      }

      if (lastIndex < line.length) {
        parts.push(line.slice(lastIndex));
      }

      return (
        <span key={`line-${lineIndex}`}>
          {parts.length > 0 ? parts : line}
          {lineIndex < textLines.length - 1 && <br />}
        </span>
      );
    });

    return (
      <>
        {parsed.imageUrl && (
          <img
            src={parsed.imageUrl}
            alt="聊天图片"
            className="mb-3 max-h-64 w-auto rounded-xl border border-white/10 object-contain"
          />
        )}
        {renderedText}
      </>
    );
  };

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden font-sans">
      {/* 全局 Toast 容器 */}
      <Toaster />

      {/* 顶部工具栏 */}
      <TopBar
        selectedKnowledgeBase={selectedKnowledgeBase}
        selectedModel={selectedModel}
        onKnowledgeBaseChange={setSelectedKnowledgeBase}
        onModelChange={setSelectedModel}
        onDocumentsChange={setDocuments}
      />

      {/* 主要内容区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧聊天记录栏 */}
        <ChatHistory
          currentChatId={currentChatId}
          chatSessions={chatSessions}
          onChatSelect={handleChatSelect}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
        />

        {/* 聊天区域 */}
        <div className="flex-1 flex flex-col relative bg-secondary/20">
          {/* 聊天标题栏 - 磨砂效果 */}
          <div className="bg-background/80 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground tracking-tight">教务小数</h1>
                <p className="text-xs text-muted-foreground font-medium">中国人民大学智能教务助手</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="outline" className={`
                px-3 py-1 rounded-full border-0 font-medium
                ${selectedKnowledgeBase === 'education' ? 'bg-primary/10 text-primary' : 
                  selectedKnowledgeBase === 'course' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}
              `}>
                {selectedKnowledgeBase === 'education' ? '教务知识库' : 
                 selectedKnowledgeBase === 'course' ? '课程知识库' : '通用知识库'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                清空
              </Button>
            </div>
          </div>

          {/* 消息列表 */}
          <ScrollArea className="flex-1 px-4 md:px-8 py-6">
            <div className="space-y-6 max-w-4xl mx-auto pb-6">
              <AnimatePresence initial={false}>
              {currentMessages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className={`flex items-start space-x-3 group ${
                    message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm transition-transform hover:scale-110 ${
                    message.sender === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-white text-primary border border-gray-100'
                  }`}>
                    {message.sender === 'user' ? (
                      <User className="w-5 h-5" />
                    ) : (
                      <Bot className="w-5 h-5" />
                    )}
                  </div>
                  
                  <div className={`flex-1 max-w-3xl ${
                    message.sender === 'user' ? 'text-right' : ''
                  }`}>
                    <div className={`inline-block p-4 rounded-2xl shadow-sm text-left relative overflow-hidden ${
                      message.sender === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                        : 'bg-card border border-border/50 text-foreground rounded-tl-none'
                    }`}>
                      {/* 微光效果 */}
                      {message.isLoading && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] animate-[shimmer_1.5s_infinite]" />
                      )}
                      
                      {message.isLoading ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin opacity-70" />
                          <span>{message.content}</span>
                        </div>
                      ) : (
                        <div className="leading-relaxed break-words">{renderMessageContent(message.content)}</div>
                      )}
                    </div>

                    {/* 时间 + 反馈 */}
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className={`flex items-center mt-1.5 ${
                      message.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}>
                      <div className={`text-[10px] text-muted-foreground ${
                        message.sender === 'bot' ? 'mr-2' : 'ml-2'
                      }`}>
                        {formatTime(message.timestamp)}
                      </div>

                      {message.sender === 'bot' && !message.isLoading && (
                        <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            aria-label="点赞"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMessageFeedback(message.id, 'like')}
                            className={`h-6 w-6 rounded-full hover:bg-green-50 ${
                              message.feedback === 'like' 
                                ? 'text-green-600 bg-green-50' 
                                : 'text-muted-foreground hover:text-green-600'
                            }`}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            aria-label="点踩"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMessageFeedback(message.id, 'dislike')}
                            className={`h-6 w-6 rounded-full hover:bg-red-50 ${
                              message.feedback === 'dislike' 
                                ? 'text-red-600 bg-red-50' 
                                : 'text-muted-foreground hover:text-red-600'
                            }`}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  </div>
                </motion.div>
              ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* 输入区域 - 悬浮效果 */}
          <div className="p-6 bg-gradient-to-t from-background via-background to-transparent sticky bottom-0 z-10">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="max-w-4xl mx-auto relative group"
            >
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelected}
              />
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleAudioSelected}
              />
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-blue-500/30 rounded-2xl blur opacity-20 group-hover:opacity-100 transition duration-700 animate-pulse"></div>
              <div className="relative bg-card rounded-2xl shadow-xl border border-border/50 flex items-center p-1.5 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300">
                {pendingImage && (
                  <div className="ml-2 mr-1 flex items-center gap-2 rounded-xl border border-border/60 bg-background px-2 py-1">
                    <img
                      src={pendingImage.previewUrl}
                      alt="待发送图片"
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                    <div className="max-w-28 truncate text-xs text-muted-foreground">
                      {pendingImage.file.name}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleRemovePendingImage}
                      className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <Button
                  onClick={handleImageTrigger}
                  disabled={isLoading}
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl ml-1 text-muted-foreground hover:text-primary hover:bg-primary/10"
                >
                  <ImagePlus className="w-5 h-5" />
                </Button>
                <Button
                  onClick={handleAudioTrigger}
                  disabled={isLoading}
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10"
                >
                  <Mic className="w-5 h-5" />
                </Button>
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onPaste={(e) => {
                    void handleInputPaste(e);
                  }}
                  placeholder="请输入您关于教务、课程或考试的问题..."
                  disabled={isLoading}
                  className="flex-1 border-0 focus-visible:ring-0 shadow-none bg-transparent py-6 px-4 text-base placeholder:text-muted-foreground/50"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={(!inputValue.trim() && !pendingImage) || isLoading}
                  size="icon"
                  className={`h-10 w-10 rounded-xl transition-all duration-300 mr-1 ${
                    ((!inputValue.trim() && !pendingImage) || isLoading)
                      ? 'bg-muted text-muted-foreground' 
                      : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg scale-100 active:scale-95'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
              
              {/* 提示信息 */}
              <div className="mt-2.5 flex justify-center items-center gap-2 text-[10px] text-muted-foreground font-medium opacity-70">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  {selectedModel}
                </span>
                <span>•</span>
                <span>支持粘贴图片并随问题发送</span>
                {documents.length > 0 && (
                  <>
                    <span>•</span>
                    <span>已加载 {documents.length} 个文档</span>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
