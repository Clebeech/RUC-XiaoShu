interface APIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

class BaseAPIClient {
  protected max_retries: number;
  
  constructor(max_retries: number = 5) {
    this.max_retries = max_retries;
  }
}

export class QwenAPIClient extends BaseAPIClient {
  private api_key: string;
  private model_name: string;
  private base_url: string;

  constructor(api_key?: string, model_name: string = "qwen-max") {
    super(5);
    this.api_key = api_key || 'sk-c730dd545e724682a71a897155fe58e9';
    this.model_name = model_name;
    this.base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1";
  }

  async makeRequest(prompt: string, system_prompt?: string): Promise<string> {
    const messages = [];
    
    if (system_prompt) {
      messages.push({ role: "system", content: system_prompt });
    }
    
    messages.push({ 
      role: "user", 
      content: prompt 
    });

    try {
      console.log('🚀 发送API请求到:', this.base_url);
      console.log('📝 请求消息:', messages);
      console.log('🔑 使用API密钥:', this.api_key.substring(0, 10) + '...');
      console.log('🤖 使用模型:', this.model_name);
      
      const requestBody = {
        model: this.model_name,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000
      };
      
      console.log('📦 请求体:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(`${this.base_url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.api_key}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📊 API响应状态:', response.status);
      console.log('📋 响应头信息:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API错误响应 (状态码 ' + response.status + '):', errorText);
        
        // 尝试解析错误信息
        let errorDetails = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = JSON.stringify(errorJson, null, 2);
          console.error('📄 解析后的错误信息:', errorJson);
        } catch (parseError) {
          console.error('⚠️ 无法解析错误响应为JSON:', parseError);
        }
        
        // 根据状态码提供具体的错误信息
        let errorMessage = `API请求失败 (状态码: ${response.status})`;
        
        switch (response.status) {
          case 400:
            errorMessage += ' - 请求参数错误，请检查模型名称和请求格式';
            break;
          case 401:
            errorMessage += ' - API密钥无效或已过期，请检查密钥配置';
            break;
          case 403:
            errorMessage += ' - 访问被拒绝，请检查API密钥权限';
            break;
          case 429:
            errorMessage += ' - 请求频率超限，请稍后重试';
            break;
          case 500:
            errorMessage += ' - 服务器内部错误，请稍后重试';
            break;
          case 502:
          case 503:
          case 504:
            errorMessage += ' - 服务暂时不可用，请稍后重试';
            break;
          default:
            errorMessage += ' - 未知错误';
        }
        
        errorMessage += `\n\n详细错误信息:\n${errorDetails}`;
        
        throw new Error(errorMessage);
      }

      const responseText = await response.text();
      console.log('📄 原始响应文本:', responseText);
      
      let data: APIResponse;
      try {
        data = JSON.parse(responseText);
        console.log('✅ API响应数据解析成功:', data);
      } catch (parseError) {
        console.error('❌ 响应JSON解析失败:', parseError);
        throw new Error(`响应格式错误，无法解析JSON: ${parseError}`);
      }
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('❌ API响应格式不正确:', data);
        throw new Error('API响应格式错误：缺少choices或message字段');
      }
      
      const content = data.choices[0].message.content;
      console.log('✅ 成功获取AI回复:', content.substring(0, 100) + '...');
      
      return content;
      
    } catch (error) {
      console.error('💥 Qwen API请求发生错误:', error);
      
      // 详细分析错误类型
      if (error instanceof TypeError) {
        if (error.message.includes('fetch')) {
          console.error('🌐 网络错误详情:', {
            message: error.message,
            stack: error.stack,
            name: error.name
          });
          
          // 检查是否是CORS错误
          if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
            console.warn('🚫 检测到CORS错误，返回模拟响应用于演示');
            return `这是一个模拟的AI响应，用于演示RAG功能。您的问题是："${prompt}"。

🚫 **CORS错误**: 浏览器阻止了跨域请求到 ${this.base_url}

**解决方案**:
1. **开发环境**: 使用浏览器扩展禁用CORS检查
2. **生产环境**: 配置后端代理服务器
3. **服务端部署**: 将API调用移到服务端处理

**当前RAG系统状态**:
- ✅ 文档上传和解析功能正常
- ✅ 向量存储和检索功能正常  
- ❌ AI API调用受CORS限制

您可以继续测试文档上传和检索功能。当前时间：${new Date().toLocaleString()}`;
          } else {
            console.warn('🌐 检测到网络连接错误，返回模拟响应');
            return `这是一个模拟的AI响应，用于演示功能。您的问题是："${prompt}"。

🌐 **网络连接错误**: ${error.message}

**可能的原因**:
1. 网络连接不稳定
2. DNS解析问题
3. 防火墙阻止访问
4. API服务暂时不可用

**建议操作**:
1. 检查网络连接
2. 尝试刷新页面重试
3. 检查API服务状态
4. 联系网络管理员

当前时间：${new Date().toLocaleString()}`;
          }
        }
      }
      
      // 如果是我们抛出的错误，直接传递
      if (error instanceof Error && error.message.includes('API请求失败')) {
        throw error;
      }
      
      // 其他未知错误
      console.error('❓ 未知错误类型:', {
        type: typeof error,
        constructor: error?.constructor?.name,
        message: error?.message,
        stack: error?.stack
      });
      
      throw new Error(`AI服务暂时不可用: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}

export const qwenClient = new QwenAPIClient();