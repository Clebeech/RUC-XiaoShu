import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { BarChart3, Clock3, Filter, Inbox, Layers3, MessageSquareWarning, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { apiClient, DashboardBreakdownItem, DashboardMetric, DashboardSeriesPoint, FeedbackDashboard, FeedbackTicket } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

function metricTone(metric: DashboardMetric) {
  if (metric.trend === 'up') return metric.delta >= 0 ? 'text-emerald-600' : 'text-rose-600';
  return metric.delta <= 0 ? 'text-emerald-600' : 'text-rose-600';
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'open':
      return 'bg-rose-100 text-rose-700';
    case 'reviewing':
      return 'bg-amber-100 text-amber-700';
    case 'answered':
      return 'bg-sky-100 text-sky-700';
    case 'published':
      return 'bg-emerald-100 text-emerald-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function priorityBadgeClass(priority: string) {
  switch (priority) {
    case 'high':
      return 'bg-rose-100 text-rose-700';
    case 'medium':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function BreakdownCard({
  title,
  items,
}: {
  title: string;
  items: DashboardBreakdownItem[];
}) {
  const total = Math.max(items.reduce((sum, item) => sum + item.value, 0), 1);

  return (
    <Card className="border-border/50 bg-card/90 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => {
          const ratio = Math.round((item.value / total) * 100);
          return (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground">{item.label}</span>
                <span className="font-medium text-foreground">{item.value}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${ratio}%`,
                    backgroundColor: item.color || '#a11d33',
                  }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function WeeklyVolumeCard({ series }: { series: DashboardSeriesPoint[] }) {
  const maxValue = Math.max(...series.map((item) => item.value), 1);

  return (
    <Card className="border-border/50 bg-card/90 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">近 7 日工单流量</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-48 items-end gap-3">
          {series.map((item) => (
            <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
              <div className="text-xs text-muted-foreground">{item.value}</div>
              <div className="flex h-36 w-full items-end rounded-xl bg-muted/60 px-2 py-2">
                <div
                  className="w-full rounded-lg bg-gradient-to-t from-primary to-orange-400"
                  style={{ height: `${Math.max((item.value / maxValue) * 100, 10)}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminFeedbackDashboard() {
  const [dashboard, setDashboard] = useState<FeedbackDashboard | null>(null);
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingTicketId, setUpdatingTicketId] = useState<number | null>(null);

  const user = getStoredUser();
  const isAdmin = user?.role === 'admin';

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashboardData, ticketData] = await Promise.all([
        apiClient.getFeedbackDashboard(),
        apiClient.listFeedbackTickets(),
      ]);
      setDashboard(dashboardData);
      setTickets(ticketData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载反馈看板失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      void loadData();
    }
  }, [isAdmin]);

  const openTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === 'open' || ticket.status === 'reviewing'),
    [tickets]
  );

  const handleAdvanceStatus = async (ticket: FeedbackTicket) => {
    const nextStatus =
      ticket.status === 'open'
        ? 'reviewing'
        : ticket.status === 'reviewing'
          ? 'answered'
          : ticket.status === 'answered'
            ? 'published'
            : ticket.status;

    if (nextStatus === ticket.status) {
      toast.info('该工单已处于最终状态');
      return;
    }

    setUpdatingTicketId(ticket.id);
    try {
      const updated = await apiClient.updateFeedbackTicket(ticket.id, { status: nextStatus });
      setTickets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      const dashboardData = await apiClient.getFeedbackDashboard();
      setDashboard(dashboardData);
      toast.success(`工单 #${ticket.id} 已更新为 ${nextStatus}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新工单失败');
    } finally {
      setUpdatingTicketId(null);
    }
  };

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(161,29,51,0.09),_transparent_28%),linear-gradient(180deg,_#fffaf8_0%,_#ffffff_58%,_#f8fafc_100%)]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/90 px-3 py-1 text-xs font-medium text-primary shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              教务问答闭环运营台
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">反馈工单与知识闭环看板</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              聚焦“系统回答不准、引用不全、知识库未命中”等场景，将用户问题沉淀为可处理工单，并转化为后续标准化 Q&A 资产。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新数据
            </Button>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <a href="/">返回问答台</a>
            </Button>
          </div>
        </div>

        {loading || !dashboard ? (
          <Card className="border-border/50 bg-card/90">
            <CardContent className="flex h-64 items-center justify-center text-muted-foreground">
              数据加载中...
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {dashboard.overview.map((metric) => (
                <Card key={metric.label} className="border-border/50 bg-card/90 shadow-sm">
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{metric.label}</span>
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-3xl font-bold tracking-tight text-foreground">{metric.value}</div>
                    <div className={`mt-2 text-xs font-medium ${metricTone(metric)}`}>
                      {metric.delta > 0 ? '+' : ''}
                      {metric.delta}% vs 上周期
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.5fr,1fr,1fr]">
              <WeeklyVolumeCard series={dashboard.weekly_volume} />
              <BreakdownCard title="工单状态分布" items={dashboard.ticket_status} />
              <BreakdownCard title="问题类别分布" items={dashboard.category_breakdown} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
              <Card className="border-border/50 bg-card/90 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Inbox className="h-4 w-4 text-primary" />
                      待处理工单池
                    </CardTitle>
                    <Badge variant="outline" className="bg-primary/5 text-primary">
                      {openTickets.length} 条待推进
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[420px]">
                    <div className="space-y-4 pr-4">
                      {openTickets.map((ticket) => (
                        <div key={ticket.id} className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Badge className={statusBadgeClass(ticket.status)}>{ticket.status}</Badge>
                            <Badge className={priorityBadgeClass(ticket.priority)}>{ticket.priority}</Badge>
                            <Badge variant="outline">{ticket.category}</Badge>
                            <Badge variant="outline">{ticket.knowledge_base_name}</Badge>
                          </div>
                          <div className="font-medium leading-6 text-foreground">{ticket.question}</div>
                          <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">{ticket.system_answer}</div>
                          {ticket.user_comment && (
                            <div className="mt-3 rounded-xl bg-muted/70 p-3 text-sm text-foreground">
                              用户补充：{ticket.user_comment}
                            </div>
                          )}
                          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-3">
                              <span>{ticket.assigned_to || '待分配'}</span>
                              <span>{new Date(ticket.created_at).toLocaleString('zh-CN')}</span>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => void handleAdvanceStatus(ticket)}
                              disabled={updatingTicketId === ticket.id}
                            >
                              {updatingTicketId === ticket.id ? '处理中...' : '推进状态'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <BreakdownCard title="反馈来源分布" items={dashboard.source_breakdown} />
                <Card className="border-border/50 bg-card/90 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock3 className="h-4 w-4 text-primary" />
                      处理效率
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {dashboard.response_efficiency.map((metric) => (
                      <div key={metric.label} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                        <div className="text-sm text-muted-foreground">{metric.label}</div>
                        <div className="mt-2 text-2xl font-semibold text-foreground">{metric.value}</div>
                        <div className={`mt-1 text-xs font-medium ${metricTone(metric)}`}>
                          {metric.delta > 0 ? '+' : ''}
                          {metric.delta}% vs 上周期
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="border-border/50 bg-card/90 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Layers3 className="h-4 w-4 text-primary" />
                    全量反馈工单台账
                  </CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Filter className="h-3.5 w-3.5" />
                    演示数据已自动注入
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>问题摘要</TableHead>
                      <TableHead>类别</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>优先级</TableHead>
                      <TableHead>负责人</TableHead>
                      <TableHead>时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.slice(0, 12).map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-medium">#{ticket.id}</TableCell>
                        <TableCell className="max-w-md">
                          <div className="line-clamp-2 leading-6">{ticket.question}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{ticket.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass(ticket.status)}>{ticket.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={priorityBadgeClass(ticket.priority)}>{ticket.priority}</Badge>
                        </TableCell>
                        <TableCell>{ticket.assigned_to || '待分配'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleDateString('zh-CN')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Separator className="my-4" />
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-muted/60 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                      <MessageSquareWarning className="h-4 w-4 text-primary" />
                      高频问题洞察
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      当前高频投诉集中在“培养方案课程属性判断”“图片识别后未命中知识库”“流程类答案缺少表单附件”三个方向。
                    </p>
                  </div>
                  <div className="rounded-2xl bg-muted/60 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      闭环建议
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      建议将“已发布”工单进一步沉淀为标准化 Q&A，并回灌至增强知识库，用于优先召回和高频问题兜底。
                    </p>
                  </div>
                  <div className="rounded-2xl bg-muted/60 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      运营提示
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      本页为演示版运营看板，当前指标来自系统自动种子数据，后续可无缝切换为真实用户反馈和教务老师处理流水。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
