import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, User } from 'lucide-react';
import { Message } from '@/types/chat';

interface MessageListProps {
  messages: Message[];
}

export default function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mb-6">
          <Bot className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">
          我今天能帮你做什么？
        </h2>
        <p className="text-gray-400 text-sm">
          内容由AI生成，请仔细甄别
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-6 max-w-4xl mx-auto">
        {messages.map((message) => (
          <div key={message.id} className="flex space-x-4">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className={message.role === 'user' ? 'bg-blue-600' : 'bg-gray-600'}>
                {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className={`rounded-lg p-4 ${
                message.role === 'user' 
                  ? 'bg-blue-600 text-white ml-8' 
                  : 'bg-gray-700 text-gray-100'
              }`}>
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}