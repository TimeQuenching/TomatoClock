import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, CheckCircle2, History, Timer as TimerIcon, Plus, ArrowDownRight, ChevronLeft, ChevronRight, Calendar, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Session {
  id: number;
  task_name: string;
  duration_minutes: number;
  completed_at: string;
}

const POMODORO_TIME = 25 * 60; // 25 minutes in seconds

export default function App() {
  const [timeLeft, setTimeLeft] = useState(POMODORO_TIME);
  const [isActive, setIsActive] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [view, setView] = useState<'timer' | 'history'>('timer');
  const [isExpanded, setIsExpanded] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchSessions(selectedDate);
  }, [selectedDate]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      handleComplete();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft]);

  const fetchSessions = async (date: string) => {
    try {
      const res = await fetch(`/api/sessions?date=${date}`);
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    }
  };

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    const today = new Date().toISOString().split('T')[0];
    if (selectedDate === today) return;
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  useEffect(() => {
    // 通知 Electron 调整窗口大小
    try {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('toggle-mini', !isExpanded);
      }
    } catch (e) {
      console.log('Not in Electron environment');
    }
  }, [isExpanded]);

  const handleToggle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!taskName.trim()) {
      showToast('请先为你的任务命名！');
      return;
    }
    setIsActive(!isActive);
  };

  const handleReset = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsActive(false);
    setTimeLeft(POMODORO_TIME);
    setIsCompleted(false);
  };

  const handleComplete = async () => {
    setIsActive(false);
    setIsCompleted(true);
    
    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_name: taskName,
          duration_minutes: 25
        }),
      });
      fetchSessions(selectedDate);
    } catch (err) {
      console.error('Failed to save session', err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((POMODORO_TIME - timeLeft) / POMODORO_TIME) * 100;

  // 通用拖拽处理函数
  const onDragStart = (e: React.MouseEvent) => {
    // 如果点击的是按钮、输入框或图标，则不触发拖拽
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'BUTTON' || 
      target.tagName === 'INPUT' || 
      target.closest('button') || 
      target.closest('svg')
    ) {
      return;
    }

    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('window-drag-start', { x: e.clientX, y: e.clientY });
      
      const handleMouseMove = (moveEvent: MouseEvent) => {
        ipcRenderer.send('window-drag-move', { screenX: moveEvent.screenX, screenY: moveEvent.screenY });
      };
      
      const handleMouseUp = () => {
        ipcRenderer.send('window-drag-end');
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
  };

  return (
    <div className="h-screen w-screen bg-transparent flex items-center justify-center font-sans select-none overflow-hidden p-10">
      <AnimatePresence mode="wait">
        {isExpanded ? (
          /* Expanded Panel */
          <motion.div 
            key="expanded"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onMouseDown={onDragStart}
            className="w-[500px] h-[500px] bg-white rounded-[32px] shadow-2xl shadow-black/20 overflow-hidden flex flex-col border border-black/5 relative cursor-default"
          >
            {/* Header Content */}
            <div className="p-6 pb-2 flex items-center justify-between z-20 relative">
              <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <TimerIcon className="text-white w-5 h-5" />
                </div>
                <h1 className="text-lg font-semibold text-zinc-900">TomatoClock</h1>
              </div>
              
              <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <div className="flex bg-zinc-100 p-1 rounded-xl">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setView('timer'); }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      view === 'timer' 
                        ? 'bg-white shadow-sm text-orange-600' 
                        : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50'
                    }`}
                  >
                    计时
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setView('history'); }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      view === 'history' 
                        ? 'bg-white shadow-sm text-orange-600' 
                        : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50'
                    }`}
                  >
                    归档
                  </button>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                  className="p-2 hover:bg-zinc-100 rounded-full text-zinc-500 transition-colors"
                  title="收起面板"
                >
                  <motion.div whileHover={{ scale: 1.1, y: 2 }} whileTap={{ scale: 0.9 }}>
                    <ArrowDownRight className="w-5 h-5" />
                  </motion.div>
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {view === 'timer' ? (
                <motion.div 
                  key="timer-view"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex-1 flex flex-col items-center justify-center p-6 relative"
                >
                  {/* Toast Notification */}
                  <AnimatePresence>
                    {toast && (
                      <motion.div
                        initial={{ opacity: 0, y: -20, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -20, x: '-50%' }}
                        className="absolute top-0 left-1/2 z-50 bg-zinc-900 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg"
                      >
                        {toast}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="relative w-48 h-48 flex items-center justify-center">
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle cx="96" cy="96" r="88" fill="none" stroke="#F1F1F1" strokeWidth="6" />
                      <motion.circle
                        cx="96" cy="96" r="88" fill="none"
                        stroke={isCompleted ? "#10B981" : "#F97316"}
                        strokeWidth="6"
                        strokeDasharray="552.92"
                        initial={{ strokeDashoffset: 552.92 }}
                        animate={{ strokeDashoffset: 552.92 - (552.92 * progress) / 100 }}
                        transition={{ duration: 1, ease: "linear" }}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="flex flex-col items-center">
                      <span className="text-5xl font-light tracking-tighter text-zinc-900 tabular-nums">
                        {formatTime(timeLeft)}
                      </span>
                      {isCompleted && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-600 text-xs font-medium mt-1">完成！</motion.div>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 w-full max-w-[280px]">
                    <input
                      type="text"
                      placeholder="输入任务名称..."
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      disabled={isActive}
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500/20 transition-all outline-none text-zinc-800 text-center"
                      style={{ WebkitAppRegion: 'no-drag' } as any}
                    />
                  </div>

                  <div className="mt-6 flex items-center gap-4">
                    <button onClick={handleReset} className="p-3 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors" style={{ WebkitAppRegion: 'no-drag' } as any}>
                      <RotateCcw className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleToggle}
                      style={{ WebkitAppRegion: 'no-drag' } as any}
                      className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all transform active:scale-95 ${
                        isActive ? 'bg-zinc-900 text-white' : 'bg-orange-500 text-white'
                      }`}
                    >
                      {isActive ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                    </button>
                    <div className="w-11" />
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="history-view"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex-1 flex flex-col p-6 overflow-hidden"
                >
                  {/* Date Navigation */}
                  <div className="flex items-center justify-between mb-6 bg-zinc-50 p-2 rounded-2xl border border-black/5" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <button 
                      onClick={handlePrevDay}
                      className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-zinc-500 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    <div className="flex items-center gap-2 text-zinc-800 font-bold text-sm">
                      <Calendar className="w-4 h-4 text-orange-500" />
                      <span>{selectedDate === new Date().toISOString().split('T')[0] ? '今天' : selectedDate}</span>
                    </div>

                    <button 
                      onClick={handleNextDay}
                      disabled={selectedDate === new Date().toISOString().split('T')[0]}
                      className={`p-2 rounded-xl transition-all ${selectedDate === new Date().toISOString().split('T')[0] ? 'text-zinc-200 cursor-not-allowed' : 'hover:bg-white hover:shadow-sm text-zinc-500'}`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    {sessions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-zinc-300 space-y-3">
                        <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center border border-dashed border-zinc-200">
                          <Plus className="w-6 h-6 rotate-45 opacity-20" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold uppercase tracking-widest">空</p>
                          <p className="text-[10px] mt-1 font-medium italic">该日没有番茄钟记录</p>
                        </div>
                      </div>
                    ) : (
                      sessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between bg-zinc-50 p-4 rounded-2xl border border-black/5 hover:border-orange-200 transition-colors group">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-zinc-800 group-hover:text-orange-600 transition-colors">{session.task_name}</span>
                            <span className="text-[10px] text-zinc-400 font-medium">完成于 {new Date(session.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-lg">25 MIN</div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="px-4 py-5 text-center border-t border-zinc-50 bg-white">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest truncate">Focusing on {taskName || '...'}</p>
            </div>
          </motion.div>
        ) : (
          /* Mini Mode Timer Block */
          <motion.div
            key="mini"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onMouseDown={onDragStart}
            className="group flex items-center bg-white rounded-2xl shadow-xl border border-black/5 hover:shadow-2xl transition-all overflow-hidden cursor-default"
          >
            {/* 点击展开区域：右侧内容 */}
            <div 
              className="flex items-center gap-3 p-2 pr-4 cursor-pointer" 
              onClick={() => setIsExpanded(true)}
              title="点击展开"
            >
              <div 
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isActive ? 'bg-zinc-900' : 'bg-orange-500'}`}
              >
                {isActive ? (
                  <Pause className="w-4 h-4 text-white fill-current" onClick={(e) => { e.stopPropagation(); handleToggle(); }} />
                ) : (
                  <Play className="w-4 h-4 text-white fill-current ml-0.5" onClick={(e) => { e.stopPropagation(); handleToggle(); }} />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tabular-nums text-zinc-800 leading-none">{formatTime(timeLeft)}</span>
                <span className="text-[10px] text-zinc-400 font-medium truncate max-w-[80px] mt-1">
                  {taskName || '未命名任务'}
                </span>
              </div>
              <div className="ml-2 w-1 h-8 bg-zinc-100 rounded-full overflow-hidden">
                <motion.div 
                  className="w-full bg-orange-500"
                  animate={{ height: `${progress}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
