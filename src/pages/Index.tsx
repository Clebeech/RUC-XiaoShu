import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, User, Bot, Loader2, Trash2, ThumbsUp, ThumbsDown } from 'lucide-react';
import TopBar from '@/components/TopBar';
import ChatHistory from '@/components/ChatHistory';
import { RAGService } from '@/lib/rag-service';
import { Document } from '@/types/knowledge';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  isLoading?: boolean;
  feedback?: 'like' | 'dislike' | null;
}

interface SavedMessage {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: string;
  isLoading?: boolean;
  feedback?: 'like' | 'dislike' | null;
}

interface ChatData {
  [chatId: string]: Message[];
}

interface SavedChatData {
  [chatId: string]: SavedMessage[];
}

export default function Index() {
  const [allChats, setAllChats] = useState<ChatData>({});
  const [currentChatId, setCurrentChatId] = useState('current');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState('education');
  const [selectedModel, setSelectedModel] = useState('qwen-max');
  const [documents, setDocuments] = useState<Document[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 初始化默认消息
  const getDefaultMessage = (): Message => ({
    id: '1',
    content: '您好！我是教务小数，中国人民大学的智能教务助手。我可以帮助您解答各种教务相关问题，包括课程安排、考试信息、学分要求等。请问有什么可以帮助您的吗？',
    sender: 'bot',
    timestamp: new Date()
  });

  // 初始化聊天数据
  useEffect(() => {
    const savedChats = localStorage.getItem('allChats');
    if (savedChats) {
      try {
        const parsedChats: SavedChatData = JSON.parse(savedChats);
        const convertedChats: ChatData = {};
        Object.keys(parsedChats).forEach(chatId => {
          convertedChats[chatId] = parsedChats[chatId].map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
        });
        setAllChats(convertedChats);
      } catch (error) {
        console.error('Failed to parse saved chats:', error);
        const defaultChats: ChatData = {
          'current': [getDefaultMessage()]
        };
        setAllChats(defaultChats);
      }
    } else {
      const defaultChats: ChatData = {
        'current': [getDefaultMessage()]
      };
      setAllChats(defaultChats);
    }
  }, []);

  // 保存聊天数据到localStorage
  useEffect(() => {
    if (Object.keys(allChats).length > 0) {
      localStorage.setItem('allChats', JSON.stringify(allChats));
    }
  }, [allChats]);

  // 获取当前聊天的消息
  const currentMessages = allChats[currentChatId] || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
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

    setAllChats(prev => ({
      ...prev,
      [currentChatId]: [...(prev[currentChatId] || []), userMessage, loadingMessage]
    }));
    
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await RAGService.query(userMessage.content, selectedKnowledgeBase);

      setAllChats(prev => ({
        ...prev,
        [currentChatId]: prev[currentChatId].map(msg => 
          msg.id === loadingMessage.id 
            ? { ...msg, content: response, isLoading: false }
            : msg
        )
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '发生未知错误';
      setAllChats(prev => ({
        ...prev,
        [currentChatId]: prev[currentChatId].map(msg => 
          msg.id === loadingMessage.id 
            ? { 
                ...msg, 
                content: `抱歉，发生了错误：${errorMessage}\n\n这可能是由于：\n1. 网络连接问题\n2. API服务暂时不可用\n3. 知识库处理错误\n\n请稍后重试，或联系管理员检查配置。`, 
                isLoading: false 
              }
            : msg
        )
      }));
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

  const handleClearChat = () => {
    if (confirm('确定要清空当前聊天记录吗？此操作不可撤销。')) {
      setAllChats(prev => ({
        ...prev,
        [currentChatId]: [getDefaultMessage()]
      }));
    }
  };

  const handleNewChat = () => {
    const newChatId = `chat-${Date.now()}`;
    setAllChats(prev => ({
      ...prev,
      [newChatId]: [getDefaultMessage()]
    }));
    setCurrentChatId(newChatId);
  };

  const handleChatSelect = (chatId: string) => {
    setCurrentChatId(chatId);
    if (!allChats[chatId]) {
      setAllChats(prev => ({
        ...prev,
        [chatId]: [getDefaultMessage()]
      }));
    }
  };

  const handleDeleteChat = (chatId: string) => {
    setAllChats(prev => {
      const newChats = { ...prev };
      delete newChats[chatId];
      return newChats;
    });
    if (chatId === currentChatId) {
      const remainingChatIds = Object.keys(allChats).filter(id => id !== chatId);
      if (remainingChatIds.length > 0) {
        setCurrentChatId(remainingChatIds[0]);
      } else {
        handleNewChat();
      }
    }
  };

  const handleMessageFeedback = (messageId: string, feedback: 'like' | 'dislike') => {
    setAllChats(prev => {
      const updated = {
        ...prev,
        [currentChatId]: prev[currentChatId].map(msg => 
          msg.id === messageId 
            ? { ...msg, feedback: msg.feedback === feedback ? null : feedback }
            : msg
        )
      };
      const target = updated[currentChatId].find(m => m.id === messageId);
      if (target) {
        if (target.feedback === 'like') {
          toast.success('已反馈：赞');
        } else if (target.feedback === 'dislike') {
          toast('已反馈：踩', { description: '感谢您的反馈' });
        } else {
          toast('已取消反馈');
        }
      }
      return updated;
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
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
          messages={currentMessages}
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
              {currentMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start space-x-3 group ${
                    message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${
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
                    <div className={`inline-block p-4 rounded-2xl shadow-sm text-left ${
                      message.sender === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                        : 'bg-card border border-border/50 text-foreground rounded-tl-none'
                    }`}>
                      {message.isLoading ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin opacity-70" />
                          <span>{message.content}</span>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
                      )}
                    </div>

                    {/* 时间 + 反馈 */}
                    <div className={`flex items-center mt-1.5 ${
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
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* 输入区域 - 悬浮效果 */}
          <div className="p-6 bg-gradient-to-t from-background via-background to-transparent sticky bottom-0 z-10">
            <div className="max-w-4xl mx-auto relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
              <div className="relative bg-card rounded-2xl shadow-lg border border-border/50 flex items-center p-1.5 focus-within:ring-1 focus-within:ring-primary/30 transition-shadow">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="请输入您关于教务、课程或考试的问题..."
                  disabled={isLoading}
                  className="flex-1 border-0 focus-visible:ring-0 shadow-none bg-transparent py-6 px-4 text-base placeholder:text-muted-foreground/50"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  size="icon"
                  className={`h-10 w-10 rounded-xl transition-all duration-300 mr-1 ${
                    !inputValue.trim() || isLoading 
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
                {documents.length > 0 && (
                  <>
                    <span>•</span>
                    <span>已加载 {documents.length} 个文档</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}