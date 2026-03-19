import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, Trash2, Database, RefreshCw } from 'lucide-react';
import { Document } from '@/types/knowledge';
import { apiClient, BackendDocument } from '@/lib/api';
import { toast } from 'sonner';

interface KnowledgeBaseManagerProps {
  knowledgeBaseId: string;
  onDocumentsChange: (documents: Document[]) => void;
}

export default function KnowledgeBaseManager({ 
  knowledgeBaseId, 
  onDocumentsChange 
}: KnowledgeBaseManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mapDocument = (document: BackendDocument): Document => ({
    id: String(document.id),
    name: document.name,
    content: '',
    chunks: Array.from({ length: document.chunk_count }).map((_, index) => ({
      id: `${document.id}-${index}`,
      documentId: String(document.id),
      content: '',
      metadata: {
        startIndex: 0,
        endIndex: 0,
      },
    })),
    uploadedAt: new Date(document.uploaded_at),
    size: document.size,
    type: document.mime_type,
  });

  const refreshDocuments = async () => {
    try {
      const backendDocuments = await apiClient.listDocuments(knowledgeBaseId);
      const mapped = backendDocuments.map(mapDocument);
      setDocuments(mapped);
      onDocumentsChange(mapped);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '获取文档列表失败');
    }
  };

  React.useEffect(() => {
    void refreshDocuments();
  }, [knowledgeBaseId]);

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    
    try {
      for (const file of Array.from(files)) {
        await apiClient.uploadDocument(knowledgeBaseId, file);
      }

      await refreshDocuments();

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      toast.success('文档上传完成');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '文件上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    const document = documents.find(doc => doc.id === documentId);
    if (document && confirm(`确定要删除文档 "${document.name}" 吗？`)) {
      try {
        await apiClient.deleteDocument(Number(documentId));
        await refreshDocuments();
        toast.success('文档已删除');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '删除文档失败');
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm('确定要清空所有知识库文档吗？此操作不可撤销！')) {
      try {
        await Promise.all(documents.map((document) => apiClient.deleteDocument(Number(document.id))));
        await refreshDocuments();
        toast.success('知识库已清空');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '清空知识库失败');
      }
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 格式化日期
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString('zh-CN');
  };

  const totalChunks = documents.reduce((sum, doc) => sum + doc.chunks.length, 0);

  return (
    <>
      {/* 触发按钮 */}
      <Button 
        variant="outline" 
        size="sm" 
        className="bg-background text-foreground hover:bg-secondary/50 border-border"
        onClick={() => setIsOpen(true)}
      >
        <Database className="w-4 h-4 mr-2" />
        知识库管理
      </Button>

      {/* 弹窗 */}
      {isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl border-border">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Database className="h-5 w-5 text-primary" />
                知识库管理
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={refreshDocuments}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  刷新
                </Button>
                <Button variant="destructive" size="sm" onClick={handleClearAll}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  清空全部
                </Button>
                <Button variant="ghost" onClick={() => setIsOpen(false)}>
                  关闭
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="overflow-y-auto max-h-[calc(90vh-120px)] p-6 bg-background">
              {/* 统计信息 */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card className="bg-muted/20 border-border/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{documents.length}</div>
                    <div className="text-sm text-muted-foreground">文档总数</div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/20 border-border/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{totalChunks}</div>
                    <div className="text-sm text-muted-foreground">文档块数</div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/20 border-border/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {documents.reduce((sum, doc) => sum + doc.size, 0) > 0 
                        ? formatFileSize(documents.reduce((sum, doc) => sum + doc.size, 0))
                        : '0 B'
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">总大小</div>
                  </CardContent>
                </Card>
              </div>

              {/* 知识库标签页 */}
              <Tabs defaultValue="upload" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="upload">文档上传</TabsTrigger>
                  <TabsTrigger value="manage">文档管理</TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="space-y-4">
                  {/* 文件上传区域 */}
                  <Card className="border-dashed border-2 bg-muted/10">
                    <CardContent className="p-10">
                      <div className="text-center">
                        <div className="bg-primary/5 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                           <Upload className="h-10 w-10 text-primary" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground mb-2">
                          上传文档到知识库
                        </h3>
                        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                          支持 PDF、Word、TXT 格式文件，上传后将自动进行分块和向量化处理
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.txt"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <Button 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="px-8"
                          size="lg"
                        >
                          {uploading ? '正在处理...' : '选择文件'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="manage" className="space-y-4">
                  {/* 文档列表 */}
                  <Card className="border-none shadow-none">
                    <CardContent className="p-0">
                      {documents.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <FileText className="mx-auto h-12 w-12 mb-4 opacity-20" />
                          <p>暂无文档，请切换到上传页签添加文档</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {documents.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors">
                              <div className="flex items-center space-x-4">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                  <FileText className="h-6 w-6 text-blue-500" />
                                </div>
                                <div>
                                  <h4 className="font-medium text-foreground">{doc.name}</h4>
                                  <div className="flex items-center space-x-3 text-xs text-muted-foreground mt-1">
                                    <span>{formatFileSize(doc.size)}</span>
                                    <span>•</span>
                                    <span>{doc.chunks.length} 个块</span>
                                    <span>•</span>
                                    <span>{formatDate(doc.uploadedAt)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge variant="secondary" className="font-normal">
                                  {doc.type || '未知'}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteDocument(doc.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
