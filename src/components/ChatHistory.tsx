import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Plus, Trash2, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messageCount: number;
}

interface Message {
  id:string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  isLoading?: boolean;
}

interface SavedChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  messageCount: number;
}

interface ChatHistoryProps {
  currentChatId: string;
  messages: Message[];
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
}

export default function ChatHistory({ 
  currentChatId, 
  messages,
  onChatSelect, 
  onNewChat, 
  onDeleteChat 
}: ChatHistoryProps) {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const { toast } = useToast();
  const [feedbackText, setFeedbackText] = useState("");
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);

  useEffect(() => {
    const savedChats = localStorage.getItem('chatSessions');
    if (savedChats) {
      try {
        const parsedChats: SavedChatSession[] = JSON.parse(savedChats);
        setChatSessions(parsedChats.map(chat => ({ ...chat, timestamp: new Date(chat.timestamp) })));
      } catch (e) {
        setChatSessions([]);
      }
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setChatSessions(prev => {
        const updated = prev.map(chat => {
          if (chat.id === currentChatId) {
            const lastUserMessage = messages.filter(m => m.sender === 'user').pop();
            const lastBotMessage = messages.filter(m => m.sender === 'bot' && !m.isLoading).pop();
            const lastMessage = lastUserMessage || lastBotMessage;
            
            return {
              ...chat,
              lastMessage: lastMessage ? lastMessage.content : chat.lastMessage,
              messageCount: messages.length,
              timestamp: new Date(),
              title: generateChatTitle(messages)
            };
          }
          return chat;
        });
        localStorage.setItem('chatSessions', JSON.stringify(updated));
        return updated;
      });
    }
  }, [messages, currentChatId]);

  const generateChatTitle = (msgs: Message[]): string => {
    const userMessage = msgs.find(m => m.sender === 'user');
    return userMessage ? userMessage.content.substring(0, 20) + (userMessage.content.length > 20 ? '...' : '') : '新对话';
  };

  const handleNewChat = () => {
    const newChatId = `chat-${Date.now()}`;
    const newChat: ChatSession = {
      id: newChatId,
      title: '新对话',
      lastMessage: '您好！我是教务小数...',
      timestamp: new Date(),
      messageCount: 1
    };
    setChatSessions(prev => {
      const updated = [newChat, ...prev];
      localStorage.setItem('chatSessions', JSON.stringify(updated));
      return updated;
    });
    onNewChat();
  };

  const handleDeleteChat = (chatId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (chatSessions.length <= 1) {
      toast({ title: '操作失败', description: '至少需要保留一个对话。', variant: 'destructive' });
      return;
    }
    if (confirm('确定要删除这个对话吗？此操作不可撤销。')) {
      const updatedSessions = chatSessions.filter(chat => chat.id !== chatId);
      setChatSessions(updatedSessions);
      localStorage.setItem('chatSessions', JSON.stringify(updatedSessions));
      onDeleteChat(chatId);
      if (chatId === currentChatId) {
        onChatSelect(updatedSessions[0]?.id || '');
      }
    }
  };

  const handleSendFeedback = () => {
    if (feedbackText.trim() === "") {
        toast({
            title: "反馈内容不能为空",
            variant: "destructive",
        });
        return;
    }
    console.log("Feedback submitted to 1944836358@qq.com:", feedbackText);
    setFeedbackText("");
    setIsFeedbackDialogOpen(false);
    toast({
      title: "反馈已发送",
      description: "感谢您的支持，我们会尽快处理！",
    });
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    if (diffInHours < 1) return '刚刚';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}小时前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-white flex items-center">
            <MessageSquare className="w-5 h-5 mr-2" />
            聊天记录
          </h2>
          <Button onClick={handleNewChat} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {chatSessions.map((chat) => (
            <Card
              key={chat.id}
              className={`mb-2 cursor-pointer transition-colors ${
                currentChatId === chat.id
                  ? 'bg-gray-600 border-blue-500'
                  : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
              }`}
              onClick={() => onChatSelect(chat.id)}
            >
              <CardContent className="p-3">
                <div className="grid grid-cols-[1fr_auto] items-start gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">{chat.title}</h3>
                    <p className="text-xs text-gray-400 mt-1 truncate">{chat.lastMessage}</p>
                    <div className="flex items-center mt-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatTime(chat.timestamp)}
                      <span className="ml-2">{chat.messageCount} 条消息</span>
                    </div>
                  </div>
                  <div className="flex items-center h-full">
                    <Button
                      aria-label="删除对话"
                      title="删除对话"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteChat(chat.id, e)}
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-gray-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-gray-700">
        <div className="text-xs text-gray-500 text-center mb-2">
          <p>共 {chatSessions.length} 个对话</p>
        </div>
        <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              <span className="mr-2">📧</span> 点我反馈
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-gray-800 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle>问题反馈</DialogTitle>
              <DialogDescription>
                请详细描述您遇到的问题或建议，我们会尽快处理。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid w-full gap-1.5">
                <Label htmlFor="feedback-text">反馈内容</Label>
                <Textarea
                  id="feedback-text"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="bg-gray-700 border-gray-600 placeholder:text-gray-500"
                  placeholder="请在此处输入您的反馈..."
                  rows={6}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsFeedbackDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" onClick={handleSendFeedback} className="bg-blue-600 hover:bg-blue-700">
                发送
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}