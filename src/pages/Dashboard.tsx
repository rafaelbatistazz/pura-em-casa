import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Users, UserPlus, TrendingUp, MessageSquare, CalendarIcon, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

import { cn, getSaoPauloTimestamp, formatDisplayTime } from '@/lib/utils';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, startOfYear, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Lead } from '@/types/database';
import type { DateRange } from 'react-day-picker';

type DateFilterType = 'today' | 'week' | 'month' | 'lastMonth' | 'year' | 'custom';

const filterLabels: Record<DateFilterType, string> = {
  today: 'Hoje',
  week: '7 dias',
  month: 'Este mês',
  lastMonth: 'Mês passado',
  year: 'Este ano',
  custom: 'Personalizado',
};

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilterType>('month');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLeads(data as Lead[]);
    }
    setLoading(false);
  };

  const getDateRange = (filter: DateFilterType): { start: Date; end: Date } => {
    const now = new Date();
    switch (filter) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
      case 'month':
        return { start: startOfMonth(now), end: endOfDay(now) };
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'year':
        return { start: startOfYear(now), end: endOfDay(now) };
      case 'custom':
        if (customDateRange?.from && customDateRange?.to) {
          return { start: startOfDay(customDateRange.from), end: endOfDay(customDateRange.to) };
        }
        return { start: startOfMonth(now), end: endOfDay(now) };
      default:
        return { start: startOfMonth(now), end: endOfDay(now) };
    }
  };

  const filteredLeads = useMemo(() => {
    const { start, end } = getDateRange(dateFilter);
    return leads.filter((lead) => {
      const createdAt = new Date(lead.created_at);
      return createdAt >= start && createdAt <= end;
    });
  }, [leads, dateFilter, customDateRange]);

  const today = getSaoPauloTimestamp().split('T')[0];
  const leadsToday = leads.filter(
    (lead) => lead.created_at.split('T')[0] === today
  ).length;

  const leadsGanho = filteredLeads.filter((lead) => lead.status === 'ganho').length;
  const conversionRate = filteredLeads.length > 0 ? ((leadsGanho / filteredLeads.length) * 100).toFixed(1) : '0';

  const leadsEmAtendimento = filteredLeads.filter(
    (lead) => lead.status === 'em_atendimento'
  ).length;

  // Group leads by hour
  const leadsByHour = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}h`,
    leads: filteredLeads.filter(
      (lead) => parseInt(formatDisplayTime(lead.created_at, { hour: '2-digit', hour12: false })) === i
    ).length,
  }));

  // Group leads by day of week
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const leadsByDay = dayNames.map((day, index) => ({
    day,
    leads: filteredLeads.filter(
      (lead) => {
        // formatDisplayTime returns day/month/year... 
        // We need day index 0-6. getDay() is easier but depends on locale.
        // Let's create a date object FROM the formatted string to be safe or just use Date object forced to SP?
        // Actually, straightforward way:
        const spDateStr = formatDisplayTime(lead.created_at, { timeZone: 'America/Sao_Paulo' });
        // But formatDisplayTime returns string.
        // Let's use toLocaleString directly here for index or Date object shim.
        // Simplest: Check if formatted date matches "Sunday", "Monday" etc? No, we have dayNames array.
        // Let's use: new Date(lead.created_at).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Sao_Paulo' })
        // Mapping 'Dom' etc is manual.

        // Better approach matching original logic structure:
        const dateInSP = new Date(new Date(lead.created_at).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        return dateInSP.getDay() === index;
      }
    ).length,
  }));

  // Group leads by source
  const leadsBySource = useMemo(() => {
    const sourceCount: Record<string, number> = {};
    filteredLeads.forEach((lead) => {
      const source = lead.source || 'Sem fonte';
      sourceCount[source] = (sourceCount[source] || 0) + 1;
    });

    return Object.entries(sourceCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredLeads]);

  const stats = [
    {
      title: 'Total de Leads',
      value: filteredLeads.length,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Leads Hoje',
      value: leadsToday,
      icon: UserPlus,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Taxa de Conversão',
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Em Atendimento',
      value: leadsEmAtendimento,
      icon: MessageSquare,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
  ];

  const handleFilterChange = (filter: DateFilterType) => {
    if (filter === 'custom') {
      setCalendarOpen(true);
    } else {
      setDateFilter(filter);
      setCalendarOpen(false);
    }
  };

  const handleCustomDateSelect = (range: DateRange | undefined) => {
    setCustomDateRange(range);
    if (range?.from && range?.to) {
      setDateFilter('custom');
      setCalendarOpen(false);
    }
  };

  const getFilterLabel = () => {
    if (dateFilter === 'custom' && customDateRange?.from && customDateRange?.to) {
      return `${format(customDateRange.from, 'dd/MM', { locale: ptBR })} - ${format(customDateRange.to, 'dd/MM', { locale: ptBR })}`;
    }
    return filterLabels[dateFilter];
  };

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-8 space-y-6 pb-24 lg:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do seu CRM</p>
        </div>

        {/* Date Filter Dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <CalendarIcon className="h-4 w-4" />
              <span>{getFilterLabel()}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end">
            <div className="space-y-1">
              {(['today', 'week', 'month', 'lastMonth', 'year'] as DateFilterType[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => handleFilterChange(filter)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors flex items-center gap-2',
                    dateFilter === filter && 'bg-muted font-medium'
                  )}
                >
                  {dateFilter === filter && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  <span className={dateFilter !== filter ? 'ml-3.5' : ''}>{filterLabels[filter]}</span>
                </button>
              ))}
              <div className="border-t border-border my-1" />
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors flex items-center gap-2',
                      dateFilter === 'custom' && 'bg-muted font-medium'
                    )}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    <span>Personalizado</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end" side="left">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customDateRange?.from}
                    selected={customDateRange}
                    onSelect={handleCustomDateSelect}
                    numberOfMonths={1}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="border-border/50 animate-slide-in" style={{ animationDelay: `${index * 50}ms` }}>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs lg:text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-xl lg:text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-2 lg:p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 lg:h-5 lg:w-5 ${stat.color}`} />
                </div>
              </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-border/50">
          <CardHeader>
            <CardTitle>Leads por Hora</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadsByHour}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar
                    dataKey="leads"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 border-border/50">
          <CardHeader>
            <CardTitle>Origem dos Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={leadsBySource}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={32}>
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
