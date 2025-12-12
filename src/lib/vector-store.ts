import { DocumentChunk, SearchResult, Document } from '@/types/knowledge';

export class VectorStore {
  private chunks: Map<string, DocumentChunk> = new Map();
  private documents: Map<string, Document> = new Map();

  // 添加文档到向量存储
  async addDocument(document: Document): Promise<void> {
    console.log(`📄 开始添加文档到向量存储: ${document.name}`);
    console.log(`📊 文档信息: 大小=${document.size}字节, 类型=${document.type}, 块数=${document.chunks.length}`);
    
    this.documents.set(document.id, document);
    
    // 为每个chunk生成嵌入向量
    for (let i = 0; i < document.chunks.length; i++) {
      const chunk = document.chunks[i];
      chunk.documentId = document.id;
      
      console.log(`🔄 处理文档块 ${i + 1}/${document.chunks.length}: ${chunk.content.substring(0, 50)}...`);
      
      chunk.embedding = await this.generateEmbedding(chunk.content);
      this.chunks.set(chunk.id, chunk);
      
      console.log(`✅ 文档块 ${i + 1} 向量化完成，向量维度: ${chunk.embedding?.length}`);
    }
    
    console.log(`✅ 文档 "${document.name}" 已添加到向量存储，包含 ${document.chunks.length} 个文档块`);
    console.log(`📊 当前向量存储统计: 文档=${this.documents.size}, 文档块=${this.chunks.size}`);
  }

  // 搜索相似文档块
  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    console.log(`🔍 开始向量搜索: "${query}"`);
    console.log(`📊 搜索范围: ${this.chunks.size} 个文档块`);
    
    if (this.chunks.size === 0) {
      console.log('⚠️ 向量存储为空，无法进行搜索');
      return [];
    }
    
    const queryEmbedding = await this.generateEmbedding(query);
    console.log(`🎯 查询向量生成完成，维度: ${queryEmbedding.length}`);
    
    const results: SearchResult[] = [];

    for (const chunk of this.chunks.values()) {
      if (chunk.embedding) {
        const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
        const document = this.documents.get(chunk.documentId);
        
        if (document) {
          results.push({
            chunk,
            document,
            similarity
          });
        }
      } else {
        console.warn(`⚠️ 文档块 ${chunk.id} 没有嵌入向量`);
      }
    }

    // 按相似度排序并返回前K个结果
    const sortedResults = results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
    
    console.log(`🎯 搜索完成，找到 ${sortedResults.length} 个结果:`);
    sortedResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.document.name} - 相似度: ${(result.similarity * 100).toFixed(2)}%`);
    });
    
    return sortedResults;
  }

  // 生成文本嵌入向量（简化版本）
  private async generateEmbedding(text: string): Promise<number[]> {
    console.log(`🔄 生成嵌入向量，文本长度: ${text.length}`);
    
    // 这是一个简化的嵌入生成器，实际项目中应该使用真正的嵌入模型
    // 比如 OpenAI embeddings API 或本地的 sentence-transformers
    
    const words = text.toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // 保留中英文和数字
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    console.log(`📝 文本预处理完成，词汇数: ${words.length}`);
    
    const embedding = new Array(384).fill(0); // 384维向量
    
    // 简单的基于词频和位置的向量化
    const wordFreq: { [key: string]: number } = {};
    words.forEach((word, index) => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
      
      // 考虑词的位置权重
      const positionWeight = 1 + (1 / (index + 1)) * 0.1;
      wordFreq[word] *= positionWeight;
    });
    
    // 使用改进的哈希函数将词映射到向量维度
    Object.entries(wordFreq).forEach(([word, freq]) => {
      // 为每个词生成多个哈希值，增加向量的丰富度
      for (let i = 0; i < 3; i++) {
        const hash = this.simpleHash(word + i.toString());
        const index = Math.abs(hash) % embedding.length;
        embedding[index] += freq * (1 - i * 0.2); // 递减权重
      }
    });
    
    // 归一化向量
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }
    
    console.log(`✅ 嵌入向量生成完成，向量范数: ${magnitude.toFixed(4)}`);
    return embedding;
  }

  // 计算余弦相似度
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      console.warn(`⚠️ 向量维度不匹配: ${a.length} vs ${b.length}`);
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    const similarity = magnitude === 0 ? 0 : dotProduct / magnitude;
    
    return Math.max(0, similarity); // 确保相似度非负
  }

  // 简单哈希函数
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash;
  }

  // 获取所有文档
  getDocuments(): Document[] {
    return Array.from(this.documents.values());
  }

  // 删除文档
  removeDocument(documentId: string): void {
    const document = this.documents.get(documentId);
    if (document) {
      // 删除相关的chunks
      document.chunks.forEach(chunk => {
        this.chunks.delete(chunk.id);
      });
      
      this.documents.delete(documentId);
      console.log(`🗑️ 文档 "${document.name}" 已从向量存储中删除`);
    }
  }

  // 清空存储
  clear(): void {
    this.chunks.clear();
    this.documents.clear();
    console.log('🧹 向量存储已清空');
  }
}

// 全局向量存储实例
export const vectorStore = new VectorStore();