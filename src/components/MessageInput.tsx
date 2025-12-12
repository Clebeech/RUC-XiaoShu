import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
}

export default function MessageInput({ onSendMessage, isLoading }: MessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-gray-700 bg-gray-800 p-4">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="relative flex items-end space-x-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white hover:bg-gray-700 mb-2"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          
          <div className="flex-1 relative">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="问题 Rag"
              className="min-h-[60px] max-h-32 bg-gray-700 border-gray-600 text-white placeholder-gray-400 resize-none pr-12"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!message.trim() || isLoading}
              className="absolute right-2 bottom-2 bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="text-xs text-gray-500 mt-2 text-center">
          内容由AI生成，请仔细甄别
        </div>
      </form>
    </div>
  );
}