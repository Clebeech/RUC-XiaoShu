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
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

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
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
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
      <div className="flex-1 flex">
        {/* 左侧聊天记录栏 */}
        <ChatHistory
          currentChatId={currentChatId}
          messages={currentMessages}
          onChatSelect={handleChatSelect}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
        />

        {/* 聊天区域 */}
        <div className="flex-1 flex flex-col">
          {/* 聊天标题栏 */}
          <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">教务小数</h1>
                <p className="text-sm text-gray-400">中国人民大学智能教务助手</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-green-600">
                {selectedKnowledgeBase === 'education' ? '教务知识库' : 
                 selectedKnowledgeBase === 'course' ? '课程知识库' : '通用知识库'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearChat}
                className="bg-gray-700 border-gray-600 hover:bg-gray-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                清空聊天
              </Button>
            </div>
          </div>

          {/* 消息列表 */}
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-4 max-w-4xl mx-auto">
              {currentMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start space-x-3 ${
                    message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    message.sender === 'user' 
                      ? 'bg-blue-600' 
                      : 'bg-gray-700'
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
                    <div className={`inline-block p-4 rounded-lg ${
                      message.sender === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 border border-gray-700'
                    }`}>
                      {message.isLoading ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{message.content}</span>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      )}
                    </div>

                    {/* 时间 + 反馈 */}
                    <div className={`flex items-center mt-1 ${
                      message.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}>
                      <div className={`text-xs text-gray-500 ${
                        message.sender === 'bot' ? 'mr-2' : 'ml-2'
                      }`}>
                        {formatTime(message.timestamp)}
                      </div>

                      {message.sender === 'bot' && !message.isLoading && (
                        <div className="flex items-center space-x-1">
                          <Button
                            aria-label="点赞此回复"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMessageFeedback(message.id, 'like')}
                            className={`h-7 w-7 p-0 rounded-full ${
                              message.feedback === 'like' 
                                ? 'text-green-400 hover:text-green-300' 
                                : 'text-gray-400 hover:text-green-400'
                            }`}
                          >
                            <ThumbsUp className="w-4 h-4" />
                          </Button>
                          <Button
                            aria-label="点踩此回复"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMessageFeedback(message.id, 'dislike')}
                            className={`h-7 w-7 p-0 rounded-full ${
                              message.feedback === 'dislike' 
                                ? 'text-red-400 hover:text-red-300' 
                                : 'text-gray-400 hover:text-red-400'
                            }`}
                          >
                            <ThumbsDown className="w-4 h-4" />
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

          {/* 输入区域 */}
          <div className="bg-gray-800 border-t border-gray-700 p-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="请输入您的问题..."
                    disabled={isLoading}
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                  />
                </div>
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              
              {/* 提示信息 */}
              <div className="mt-3 text-xs text-gray-500 text-center">
                <p>
                  当前使用 <span className="text-blue-400">{selectedModel}</span> 模型
                  {documents.length > 0 && (
                    <span> • 已加载 <span className="text-green-400">{documents.length}</span> 个文档</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}