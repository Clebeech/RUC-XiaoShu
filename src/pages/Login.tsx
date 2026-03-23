import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Bot, GraduationCap, ArrowRight, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { setAuthSession } from '@/lib/auth';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      toast.error('请输入用户名和密码');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.login(username.trim(), password.trim());
      setAuthSession(response.token, response.user);
      setIsLoading(false);

      toast.success('登录成功', {
        description: '欢迎回来，' + response.user.username
      });
      navigate('/');
    } catch (error) {
      setIsLoading(false);
      toast.error(error instanceof Error ? error.message : '登录失败');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* 背景装饰 - 左侧 RUC 红圆 */}
      <div className="absolute -left-20 -top-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
      {/* 背景装饰 - 右侧 蓝色圆 */}
      <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>

      <div className="container px-4 md:px-6 flex flex-col items-center">
        <div className="flex flex-col items-center space-y-2 mb-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mb-4 rotate-3 hover:rotate-0 transition-transform duration-300">
            <Bot className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">教务小数</h1>
          <p className="text-muted-foreground">中国人民大学智能教务助手</p>
        </div>

        <Card className="w-full max-w-md border-border/50 shadow-xl bg-card/50 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-500">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">账号登录</CardTitle>
            <CardDescription className="text-center">
              请输入您的学号/工号和密码
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">学号 / 工号</Label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="username" 
                    placeholder="请输入您的学号" 
                    className="pl-9"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">密码</Label>
                  <a href="#" className="text-xs text-primary hover:underline" onClick={(e) => e.preventDefault()}>
                    忘记密码?
                  </a>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all hover:shadow-lg active:scale-95" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  <>
                    登录
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              <div className="text-center text-xs text-muted-foreground">
                没有账号? 
                <a href="#" className="text-primary hover:underline ml-1" onClick={(e) => {
                  e.preventDefault();
                  toast.info('请联系数学学院管理员开通账号');
                }}>
                  联系管理员
                </a>
              </div>
            </CardFooter>
          </form>
        </Card>

        <p className="mt-8 text-xs text-muted-foreground text-center">
          &copy; {new Date().getFullYear()} 中国人民大学数学学院. All rights reserved.
        </p>
      </div>
    </div>
  );
}
