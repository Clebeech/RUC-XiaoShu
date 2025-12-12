import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, Trash2, Database, RefreshCw } from 'lucide-react';
import { DocumentParser } from '@/lib/document-parser';
import { vectorStore } from '@/lib/vector-store';
import { RAGService } from '@/lib/rag-service';
import { Document } from '@/types/knowledge';

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

  // 刷新文档列表
  const refreshDocuments = () => {
    const stats = RAGService.getKnowledgeBaseStats();
    setDocuments(stats.documents);
    onDocumentsChange(stats.documents);
    console.log('📊 刷新知识库统计:', stats);
  };

  // 组件挂载时刷新
  React.useEffect(() => {
    refreshDocuments();
  }, []);

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    
    try {
      for (const file of Array.from(files)) {
        console.log(`📤 开始上传文件: ${file.name}`);
        
        // 解析文档
        const document = await DocumentParser.parseFile(file);
        console.log(`✅ 文档解析完成: ${document.name}`);
        
        // 添加到向量存储
        await vectorStore.addDocument(document);
        console.log(`🎯 文档已添加到向量存储: ${document.name}`);
      }
      
      // 刷新文档列表
      refreshDocuments();
      
      // 清空文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      console.log('🎉 所有文件上传完成');
      
    } catch (error) {
      console.error('❌ 文件上传失败:', error);
      alert(`文件上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setUploading(false);
    }
  };

  // 删除文档
  const handleDeleteDocument = (documentId: string) => {
    const document = documents.find(doc => doc.id === documentId);
    if (document && confirm(`确定要删除文档 "${document.name}" 吗？`)) {
      console.log(`🗑️ 删除文档: ${document.name}`);
      vectorStore.removeDocument(documentId);
      refreshDocuments();
    }
  };

  // 清空所有文档
  const handleClearAll = () => {
    if (confirm('确定要清空所有知识库文档吗？此操作不可撤销！')) {
      console.log('🧹 清空所有知识库文档');
      vectorStore.clear();
      refreshDocuments();
      alert('知识库已清空！');
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

  const stats = RAGService.getKnowledgeBaseStats();

  return (
    <>
      {/* 触发按钮 */}
      <Button 
        variant="outline" 
        size="sm" 
        className="bg-gray-700 border-gray-600 hover:bg-gray-600"
        onClick={() => setIsOpen(true)}
      >
        <Database className="w-4 h-4 mr-2" />
        知识库
      </Button>

      {/* 弹窗 */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
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
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  关闭
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* 统计信息 */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.totalDocuments}</div>
                    <div className="text-sm text-muted-foreground">文档总数</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.totalChunks}</div>
                    <div className="text-sm text-muted-foreground">文档块数</div>
                  </CardContent>
                </Card>
                <Card>
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
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload">文档上传</TabsTrigger>
                  <TabsTrigger value="manage">文档管理</TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="space-y-4">
                  {/* 文件上传区域 */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          上传文档到知识库
                        </h3>
                        <p className="text-gray-500 mb-4">
                          支持 PDF、Word、TXT 格式文件
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
                        >
                          {uploading ? '上传中...' : '选择文件'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="manage" className="space-y-4">
                  {/* 文档列表 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">已上传文档</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {documents.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <FileText className="mx-auto h-12 w-12 mb-4" />
                          <p>暂无文档，请上传文档到知识库</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {documents.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                              <div className="flex items-center space-x-3">
                                <FileText className="h-8 w-8 text-blue-500" />
                                <div>
                                  <h4 className="font-medium">{doc.name}</h4>
                                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                                    <span>{formatFileSize(doc.size)}</span>
                                    <span>{doc.chunks.length} 个文档块</span>
                                    <span>{formatDate(doc.uploadedAt)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline">
                                  {doc.type || '未知格式'}
                                </Badge>
                                <Button
                                  variant="destructive"
                                  size="sm"
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