import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  FileText, 
  BarChart3, 
  Bot, 
  MessageSquarePlus,
  Search,
  Bookmark,
  School
} from 'lucide-react';

interface SidebarProps {
  onNewChat: () => void;
  chats: Array<{ id: string; title: string }>;
  currentChatId?: string;
  onSelectChat: (chatId: string) => void;
}

export default function Sidebar({ onNewChat, chats, currentChatId, onSelectChat }: SidebarProps) {
  const menuItems = [
    { icon: User, label: '个人中心', id: 'profile' },
    { icon: FileText, label: '作业管理', id: 'homework' },
    { icon: BarChart3, label: '成绩概览', id: 'grades' },
    { icon: Bot, label: 'AI助手', id: 'ai', active: true }
  ];

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col h-full">
      {/* Logo区域 */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <School className="w-6 h-6 text-blue-400" />
          <span className="font-bold text-lg">智作最灵</span>
        </div>
        <div className="text-xs text-gray-400 mt-1">smartestu.cn</div>
      </div>

      {/* 学校信息 */}
      <div className="px-4 py-2 text-sm text-gray-400 border-b border-gray-700">
        清华大学校
      </div>

      {/* 导航菜单 */}
      <div className="p-4 space-y-2">
        {menuItems.map((item) => (
          <Button
            key={item.id}
            variant={item.active ? "secondary" : "ghost"}
            className={`w-full justify-start text-left ${
              item.active ? 'bg-blue-600 hover:bg-blue-700' : 'hover:bg-gray-800'
            }`}
          >
            <item.icon className="w-4 h-4 mr-3" />
            {item.label}
          </Button>
        ))}
      </div>

      <Separator className="bg-gray-700" />

      {/* 聊天功能区 */}
      <div className="p-4 flex-1 flex flex-col">
        <Button
          onClick={onNewChat}
          className="w-full mb-4 bg-gray-800 hover:bg-gray-700 border border-gray-600"
          variant="outline"
        >
          <MessageSquarePlus className="w-4 h-4 mr-2" />
          创建新对话
        </Button>

        <Button
          variant="ghost"
          className="w-full mb-2 justify-start hover:bg-gray-800"
        >
          <Search className="w-4 h-4 mr-3" />
          搜索消息
        </Button>

        <Button
          variant="ghost"
          className="w-full mb-4 justify-start hover:bg-gray-800"
        >
          <Bookmark className="w-4 h-4 mr-3" />
          书签
        </Button>

        {/* 聊天历史 */}
        <div className="text-sm text-gray-400 mb-2">今天</div>
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {chats.map((chat) => (
              <Button
                key={chat.id}
                variant="ghost"
                className={`w-full justify-start text-left hover:bg-gray-800 ${
                  currentChatId === chat.id ? 'bg-gray-800' : ''
                }`}
                onClick={() => onSelectChat(chat.id)}
              >
                <MessageSquarePlus className="w-4 h-4 mr-3 flex-shrink-0" />
                <span className="truncate">{chat.title}</span>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* 底部测试区域 */}
      <div className="p-4 border-t border-gray-700">
        <div className="bg-red-600 text-white px-2 py-1 rounded text-xs inline-block">
          测试
        </div>
        <span className="text-sm text-gray-400 ml-2">测试教师</span>
      </div>
    </div>
  );
}