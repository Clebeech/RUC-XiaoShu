import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Settings, FileText, Database, Sparkles, HelpCircle, Trash2, LogOut, PanelsTopLeft } from 'lucide-react';
import KnowledgeBaseManager from './KnowledgeBaseManager';
import { Document } from '@/types/knowledge';
import { toast } from 'sonner';
import { clearAuthSession, getStoredUser } from '@/lib/auth';

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const currentUser = getStoredUser();
  const isAdmin = currentUser?.role === 'admin';

  const handleClearCache = () => {
    if (confirm('确定要清除本地登录态和界面缓存吗？页面将重新加载。')) {
      sessionStorage.clear();
      toast.success('缓存已清除', { description: '页面即将刷新...' });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      clearAuthSession();
      toast.success('已退出登录');
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
    }
  };

  return (
    <div className="bg-background border-b px-6 py-3 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center space-x-6">
        {/* 知识库选择器 */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center text-sm font-medium text-muted-foreground">
            <Database className="w-4 h-4 mr-2 text-primary" />
            知识库
          </div>
          <Select value={selectedKnowledgeBase} onValueChange={onKnowledgeBaseChange}>
            <SelectTrigger className="w-40 h-9 bg-background">
              <SelectValue placeholder="选择知识库" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="education">教务知识库</SelectItem>
              <SelectItem value="course">课程知识库</SelectItem>
              <SelectItem value="general">通用知识库</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 模型选择器 */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center text-sm font-medium text-muted-foreground">
            <Sparkles className="w-4 h-4 mr-2 text-blue-500" />
            模型
          </div>
          <Select value={selectedModel} onValueChange={onModelChange}>
            <SelectTrigger className="w-32 h-9 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="qwen-max">qwen-max</SelectItem>
              <SelectItem value="qwen-plus">qwen-plus</SelectItem>
              <SelectItem value="qwen-turbo">qwen-turbo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-px h-6 bg-border mx-2"></div>

        {/* 知识库管理按钮 */}
        <KnowledgeBaseManager 
          knowledgeBaseId={selectedKnowledgeBase}
          onDocumentsChange={onDocumentsChange}
        />
      </div>

      <div className="flex items-center space-x-1">
        {isAdmin && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="mr-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
          >
            <a href="/admin/feedback">
              <PanelsTopLeft className="mr-2 h-4 w-4" />
              闭环看板
            </a>
          </Button>
        )}

        {/* 使用帮助 Dialog */}
        <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" title="使用帮助">
              <FileText className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-primary" />
                使用帮助
              </DialogTitle>
              <DialogDescription>
                快速了解如何使用教务小数助手
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 text-sm">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">1. 什么是教务小数？</h3>
                <p className="text-muted-foreground">
                  教务小数是中国人民大学的智能教务助手，基于先进的 RAG（检索增强生成）技术，
                  结合校内文档为您提供准确的教务、课程和考试咨询服务。
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">2. 如何提高回答准确度？</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>选择正确的<strong>知识库</strong>（如询问课程问题请选择“课程知识库”）。</li>
                  <li>使用<strong>知识库管理</strong>功能上传相关的 PDF/Word 文档。</li>
                  <li>提问时尽量描述清晰、具体。</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">3. 关于模型选择</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li><strong>qwen-max</strong>: 能力最强，适合复杂推理，但速度稍慢。</li>
                  <li><strong>qwen-plus</strong>: 性价比平衡，适合大多数场景。</li>
                  <li><strong>qwen-turbo</strong>: 响应速度最快，适合简单问答。</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsHelpOpen(false)}>知道了</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 系统设置 Dialog */}
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" title="系统设置">
              <Settings className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-500" />
                系统设置
              </DialogTitle>
              <DialogDescription>
                管理您的应用偏好设置
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* 退出登录 */}
              <div className="flex items-center justify-between pb-4 border-b">
                <div className="space-y-0.5">
                  <div className="font-medium text-foreground">退出登录</div>
                  <div className="text-xs text-muted-foreground">注销当前账号，下次访问需要重新登录</div>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout} className="text-primary hover:text-primary hover:bg-primary/5">
                  <LogOut className="w-4 h-4 mr-2" />
                  退出
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium text-foreground">清除本地缓存</div>
                  <div className="text-xs text-muted-foreground">删除所有聊天记录和本地设置，恢复默认状态</div>
                </div>
                <Button variant="destructive" size="sm" onClick={handleClearCache}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  清除
                </Button>
              </div>
              
              <div className="space-y-2 pt-4 border-t">
                <h4 className="text-sm font-medium text-muted-foreground">关于信息</h4>
                <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">当前版本</span>
                    <span className="font-mono text-foreground">v1.2.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">构建时间</span>
                    <span className="font-mono text-foreground">2025-12-12</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">技术支持</span>
                    <span className="font-mono text-foreground">MGX Team</span>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
