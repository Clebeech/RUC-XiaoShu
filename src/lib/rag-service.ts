import { vectorStore } from './vector-store';
import { qwenClient } from './qwen-api';
import { SearchResult, Document } from '@/types/knowledge';

export class RAGService {
  
  // 执行RAG查询
  static async query(question: string, knowledgeBase: string = 'general'): Promise<string> {
    try {
      console.log(`🔍 开始RAG查询: ${question}`);
      console.log(`📚 当前知识库: ${knowledgeBase}`);
      
      // 检查向量存储中的文档数量
      const allDocuments = vectorStore.getDocuments();
      console.log(`📄 向量存储中的文档数量: ${allDocuments.length}`);
      allDocuments.forEach((doc, index) => {
        console.log(`  文档${index + 1}: ${doc.name} (${doc.chunks.length} 个块)`);
      });
      
      // 1. 检索相关文档
      const searchResults = await vectorStore.search(question, 3); // 减少到3个结果
      console.log(`🎯 找到 ${searchResults.length} 个相关文档块`);
      
      // 打印检索结果详情
      searchResults.forEach((result, index) => {
        console.log(`  结果${index + 1}: ${result.document.name} - 相似度: ${(result.similarity * 100).toFixed(2)}%`);
        console.log(`    内容预览: ${result.chunk.content.substring(0, 100)}...`);
      });
      
      if (searchResults.length === 0) {
        // 如果没有找到相关文档，直接使用AI回答
        console.log('❌ 未找到相关文档，使用通用AI回答');
        const response = await qwenClient.makeRequest(question, this.getSystemPrompt(knowledgeBase));
        return `${response}\n\n💡 **提示**: 当前知识库中没有找到相关文档。如果您已上传文档，请确保：\n1. 文档内容与问题相关\n2. 尝试使用不同的关键词提问\n3. 检查是否选择了正确的知识库`;
      }
      
      // 2. 构建上下文 - 限制长度
      const context = this.buildContext(searchResults, 15000); // 限制上下文长度
      console.log(`📝 构建的上下文长度: ${context.length} 字符`);
      console.log(`📋 上下文内容预览:\n${context.substring(0, 500)}...`);
      
      // 3. 生成带上下文的提示词 - 检查总长度
      const enhancedPrompt = this.buildRAGPrompt(question, context);
      console.log(`🚀 RAG提示词长度: ${enhancedPrompt.length} 字符`);
      
      // 检查提示词长度是否超限
      if (enhancedPrompt.length > 25000) { // 留一些余量
        console.warn('⚠️ 提示词过长，进行截断处理');
        const truncatedContext = this.truncateContext(context, 10000);
        const truncatedPrompt = this.buildRAGPrompt(question, truncatedContext);
        console.log(`✂️ 截断后提示词长度: ${truncatedPrompt.length} 字符`);
        
        const response = await qwenClient.makeRequest(
          truncatedPrompt, 
          this.getSystemPrompt(knowledgeBase)
        );
        
        const responseWithCitations = this.addCitations(response, searchResults);
        return responseWithCitations + '\n\n⚠️ **注意**: 由于内容较长，部分文档内容已被截断。';
      }
      
      // 4. 调用AI生成回答
      console.log('🤖 发送请求到AI...');
      const response = await qwenClient.makeRequest(
        enhancedPrompt, 
        this.getSystemPrompt(knowledgeBase)
      );
      
      console.log(`✅ 收到AI回答: ${response.substring(0, 200)}...`);
      
      // 5. 添加引用信息
      const responseWithCitations = this.addCitations(response, searchResults);
      
      return responseWithCitations;
      
    } catch (error) {
      console.error('❌ RAG查询失败:', error);
      throw error;
    }
  }
  
  // 构建文档上下文 - 添加长度限制
  private static buildContext(searchResults: SearchResult[], maxLength: number = 15000): string {
    const contexts: string[] = [];
    let totalLength = 0;
    
    for (let i = 0; i < searchResults.length; i++) {
      const result = searchResults[i];
      const similarity = (result.similarity * 100).toFixed(1);
      const contextItem = `[文档${i + 1}: ${result.document.name} (相似度: ${similarity}%)]\n${result.chunk.content}\n`;
      
      if (totalLength + contextItem.length > maxLength) {
        console.log(`📏 上下文长度达到限制 (${maxLength})，停止添加更多文档块`);
        break;
      }
      
      contexts.push(contextItem);
      totalLength += contextItem.length;
    }
    
    return contexts.join('\n---\n\n');
  }
  
  // 截断上下文
  private static truncateContext(context: string, maxLength: number): string {
    if (context.length <= maxLength) {
      return context;
    }
    
    // 尝试在合适的位置截断（段落边界）
    const truncated = context.substring(0, maxLength);
    const lastParagraph = truncated.lastIndexOf('\n\n');
    
    if (lastParagraph > maxLength * 0.8) {
      return truncated.substring(0, lastParagraph) + '\n\n[内容已截断...]';
    }
    
    return truncated + '\n\n[内容已截断...]';
  }
  
  // 构建RAG提示词
  private static buildRAGPrompt(question: string, context: string): string {
    const basePrompt = `基于以下文档内容回答用户问题。请仔细阅读提供的文档内容，并基于这些信息给出准确、详细的回答。

相关文档内容：
${context}

用户问题：${question}

请基于上述文档内容回答问题。如果文档中包含相关信息，请引用具体的文档内容。`;

    return basePrompt;
  }
  
  // 获取系统提示词 - 简化以节省长度
  private static getSystemPrompt(knowledgeBase: string): string {
    const basePrompt = "你是一个专业的AI助手，擅长基于文档内容回答问题。请优先使用提供的文档内容，并明确引用相关片段。";
    
    const knowledgeBasePrompts = {
      education: basePrompt + "专门处理教务相关问题。",
      course: basePrompt + "专门处理课程相关问题。",
      general: basePrompt
    };
    
    return knowledgeBasePrompts[knowledgeBase as keyof typeof knowledgeBasePrompts] || knowledgeBasePrompts.general;
  }
  
  // 添加引用信息
  private static addCitations(response: string, searchResults: SearchResult[]): string {
    if (searchResults.length === 0) {
      return response;
    }
    
    const citations = searchResults.map((result, index) => {
      const similarity = (result.similarity * 100).toFixed(1);
      return `[${index + 1}] ${result.document.name} (相似度: ${similarity}%)`;
    }).join('\n');
    
    return `${response}\n\n📚 **参考文档：**\n${citations}`;
  }
  
  // 获取知识库统计信息
  static getKnowledgeBaseStats(): {
    totalDocuments: number;
    totalChunks: number;
    documents: Document[];
  } {
    const documents = vectorStore.getDocuments();
    const totalChunks = documents.reduce((sum, doc) => sum + doc.chunks.length, 0);
    
    return {
      totalDocuments: documents.length,
      totalChunks,
      documents
    };
  }
}