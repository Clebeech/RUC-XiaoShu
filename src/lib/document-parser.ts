import { Document, DocumentChunk } from '@/types/knowledge';
import { v4 as uuidv4 } from 'uuid';

export class DocumentParser {
  
  // 解析文件内容
  static async parseFile(file: File): Promise<Document> {
    console.log(`📄 开始解析文件: ${file.name} (${file.type}, ${file.size} bytes)`);
    
    const content = await this.extractTextContent(file);
    console.log(`📝 文本提取完成，内容长度: ${content.length} 字符`);
    console.log(`📄 内容预览: ${content.substring(0, 200)}...`);
    
    const chunks = this.splitIntoChunks(content, file.name);
    console.log(`🔪 文档分块完成，共 ${chunks.length} 个块`);
    
    return {
      id: uuidv4(),
      name: file.name,
      content,
      chunks,
      uploadedAt: new Date(),
      size: file.size,
      type: file.type
    };
  }

  // 提取文本内容
  private static async extractTextContent(file: File): Promise<string> {
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    
    console.log(`🔍 检测文件类型: ${fileType || '未知'}`);
    
    if (fileType.includes('text/') || fileName.endsWith('.txt')) {
      console.log('📝 处理为文本文件');
      return await this.readTextFile(file);
    } else if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
      console.log('📄 处理为PDF文件');
      return await this.readPDFFile(file);
    } else if (fileType.includes('word') || fileType.includes('document') || 
               fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
      console.log('📝 处理为Word文件');
      return await this.readWordFile(file);
    } else {
      // 尝试作为文本文件读取
      console.log('❓ 未知文件类型，尝试作为文本文件读取');
      return await this.readTextFile(file);
    }
  }

  // 读取文本文件
  private static async readTextFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string || '';
        console.log(`✅ 文本文件读取成功，长度: ${content.length}`);
        resolve(content);
      };
      reader.onerror = (e) => {
        console.error('❌ 文本文件读取失败:', e);
        reject(new Error('文本文件读取失败'));
      };
      reader.readAsText(file, 'UTF-8');
    });
  }

  // 读取PDF文件（简化版本，实际项目中需要使用pdf.js）
  private static async readPDFFile(file: File): Promise<string> {
    console.warn('⚠️ PDF解析需要额外的库支持，当前返回占位符内容');
    
    // 尝试读取为文本（某些PDF可能包含文本内容）
    try {
      const textContent = await this.readTextFile(file);
      if (textContent.trim().length > 0) {
        console.log('✅ PDF文件包含可读文本内容');
        return `[PDF文档: ${file.name}]\n\n${textContent}`;
      }
    } catch (error) {
      console.log('📄 PDF文件无法直接读取为文本');
    }
    
    return `[PDF文档: ${file.name}]

这是一个PDF文档的占位符内容。在生产环境中，需要集成pdf.js或其他PDF解析库来提取实际文本内容。

文件信息:
- 文件名: ${file.name}
- 文件大小: ${(file.size / 1024).toFixed(2)} KB
- 上传时间: ${new Date().toLocaleString()}

要启用真实的PDF解析功能，请：
1. 安装 pdf.js 库: npm install pdfjs-dist
2. 实现PDF文本提取逻辑
3. 处理PDF的页面和格式信息

当前您可以上传TXT文件来测试RAG功能。`;
  }

  // 读取Word文件（简化版本）
  private static async readWordFile(file: File): Promise<string> {
    console.warn('⚠️ Word文档解析需要额外的库支持，当前返回占位符内容');
    
    return `[Word文档: ${file.name}]

这是一个Word文档的占位符内容。在生产环境中，需要集成mammoth.js或其他Word解析库来提取实际文本内容。

文件信息:
- 文件名: ${file.name}
- 文件大小: ${(file.size / 1024).toFixed(2)} KB
- 上传时间: ${new Date().toLocaleString()}

要启用真实的Word解析功能，请：
1. 安装 mammoth.js 库: npm install mammoth
2. 实现Word文档文本提取逻辑
3. 处理Word的样式和格式信息

当前您可以上传TXT文件来测试RAG功能。`;
  }

  // 将文本分割成块
  private static splitIntoChunks(content: string, fileName: string): DocumentChunk[] {
    const chunkSize = 1000; // 每块最大字符数
    const overlap = 200; // 重叠字符数
    const chunks: DocumentChunk[] = [];
    
    console.log(`🔪 开始文档分块，目标块大小: ${chunkSize}, 重叠: ${overlap}`);
    
    // 按段落分割
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    console.log(`📄 检测到 ${paragraphs.length} 个段落`);
    
    let currentChunk = '';
    let startIndex = 0;
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      
      if (currentChunk.length + paragraph.length <= chunkSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        if (currentChunk) {
          const chunk = this.createChunk(currentChunk, fileName, chunks.length, startIndex, startIndex + currentChunk.length);
          chunks.push(chunk);
          console.log(`📦 创建文档块 ${chunks.length}: ${currentChunk.substring(0, 50)}...`);
          
          // 处理重叠
          const overlapText = currentChunk.slice(-overlap);
          currentChunk = overlapText + '\n\n' + paragraph;
          startIndex = startIndex + currentChunk.length - overlap;
        } else {
          // 如果单个段落太长，直接作为一块
          currentChunk = paragraph;
        }
      }
    }
    
    // 添加最后一块
    if (currentChunk) {
      const chunk = this.createChunk(currentChunk, fileName, chunks.length, startIndex, startIndex + currentChunk.length);
      chunks.push(chunk);
      console.log(`📦 创建最后文档块 ${chunks.length}: ${currentChunk.substring(0, 50)}...`);
    }
    
    console.log(`✅ 文档分块完成，共创建 ${chunks.length} 个块`);
    return chunks;
  }

  private static createChunk(content: string, fileName: string, index: number, startIndex: number, endIndex: number): DocumentChunk {
    return {
      id: uuidv4(),
      documentId: '', // 将在创建文档时设置
      content: content.trim(),
      metadata: {
        section: `${fileName} - 第${index + 1}部分`,
        startIndex,
        endIndex
      }
    };
  }
}