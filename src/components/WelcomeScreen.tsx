import React from 'react';
import { ArrowRight, Check } from 'lucide-react';

interface WelcomeScreenProps {
  onStart: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => (
  <div className="planner-welcome fixed inset-0 z-[200] flex items-center justify-center overflow-hidden p-6">
    <div className="planner-welcome-orb planner-welcome-orb-one" />
    <div className="planner-welcome-orb planner-welcome-orb-two" />
    <div className="planner-welcome-orb planner-welcome-orb-three" />
    <main className="planner-welcome-card relative z-10 flex max-w-lg flex-col items-center rounded-[32px] border border-white/65 bg-white/35 px-10 py-12 text-center shadow-2xl backdrop-blur-2xl">
      <div className="planner-welcome-logo flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#79dce7] via-[#c9b9f1] to-[#efb5d4] shadow-lg">
        <Check className="h-8 w-8 stroke-[3.5] text-white drop-shadow" />
      </div>
      <span className="mt-7 text-[10px] font-bold uppercase tracking-[0.35em] text-purple-500">Your visual planner</span>
      <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-700">欢迎使用 Planner</h1>
      <p className="mt-4 max-w-sm text-sm leading-7 text-slate-500">把目标、任务与时间放进同一张可视化蓝图，让每一个想法都找到下一步。</p>
      <button type="button" autoFocus onClick={onStart} className="planner-welcome-start group mt-8 flex h-12 items-center gap-2 rounded-full bg-slate-700 px-7 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-purple-200">
        开始使用
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </button>
      <span className="mt-5 text-[10px] text-slate-400">点击按钮进入你的工作空间</span>
    </main>
  </div>
);
