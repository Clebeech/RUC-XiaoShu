import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, FileText, Database } from 'lucide-react';
import KnowledgeBaseManager from './KnowledgeBaseManager';
import { Document } from '@/types/knowledge';

interface TopBarProps {
  selectedKnowledgeBase: string;
  selectedModel: string;
  onKnowledgeBaseChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onDocumentsChange: (documents: Document[]) => void;
}

export default function TopBar({ 
  selectedKnowledgeBase, 
  selectedModel, 
  onKnowledgeBaseChange, 
  onModelChange,
  onDocumentsChange
}: TopBarProps) {
  return (
    <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        {/* 知识库选择器 */}
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-gray-400" />
          <Select value={selectedKnowledgeBase} onValueChange={onKnowledgeBaseChange}>
            <SelectTrigger className="w-40 bg-gray-700 border-gray-600 text-white">
              <SelectValue placeholder="选择知识库" />
            </SelectTrigger>
            <SelectContent className="bg-gray-700 border-gray-600">
              <SelectItem value="education">教务知识库</SelectItem>
              <SelectItem value="course">课程知识库</SelectItem>
              <SelectItem value="general">通用知识库</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 模型选择器 */}
        <div className="flex items-center space-x-2">
          <span className="text-gray-400 text-sm">模型:</span>
          <Select value={selectedModel} onValueChange={onModelChange}>
            <SelectTrigger className="w-32 bg-gray-700 border-gray-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-700 border-gray-600">
              <SelectItem value="qwen-max">qwen-max</SelectItem>
              <SelectItem value="qwen-plus">qwen-plus</SelectItem>
              <SelectItem value="qwen-turbo">qwen-turbo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 知识库管理按钮 */}
        <KnowledgeBaseManager 
          knowledgeBaseId={selectedKnowledgeBase}
          onDocumentsChange={onDocumentsChange}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-gray-700">
          <FileText className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-gray-700">
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}