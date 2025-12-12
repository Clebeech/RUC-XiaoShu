import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { Message } from '@/types/chat';

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
}

export default function ChatArea({ messages, onSendMessage, isLoading }: ChatAreaProps) {
  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      <MessageList messages={messages} />
      <MessageInput onSendMessage={onSendMessage} isLoading={isLoading} />
    </div>
  );
}