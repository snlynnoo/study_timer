import React from "react";
import { motion } from "motion/react";
import { Clock, Coffee, Repeat, Zap, Brain, Target, CheckCircle2 } from "lucide-react";

export default function PomodoroInfo() {
  const steps = [
    {
      icon: <Target className="w-6 h-6 text-rose-500" />,
      title: "Pick a Task",
      description: "Choose a single task you want to focus on. One task at a time is the key to deep work.",
      color: "bg-rose-50"
    },
    {
      icon: <Clock className="w-6 h-6 text-rose-500" />,
      title: "Work for 25 Mins",
      description: "Set your timer for 25 minutes and immerse yourself in the task until the bell rings.",
      color: "bg-rose-100"
    },
    {
      icon: <Coffee className="w-6 h-6 text-teal-500" />,
      title: "5 Min Short Break",
      description: "Take a quick 5-minute break. Step away from your desk, stretch, or grab some water.",
      color: "bg-teal-50"
    },
    {
      icon: <Repeat className="w-6 h-6 text-rose-500" />,
      title: "Repeat 4 Times",
      description: "Complete four focus sessions with short breaks in between to maintain high energy.",
      color: "bg-rose-50"
    },
    {
      icon: <Zap className="w-6 h-6 text-sky-500" />,
      title: "15-30 Min Long Break",
      description: "After four sessions, take a longer break to fully recharge your brain for the next round.",
      color: "bg-sky-50"
    }
  ];

  return (
    <div className="w-full max-w-4xl mt-12 px-4 space-y-12 pb-20">
      <header className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur rounded-full border border-white/30 text-white text-xs font-bold uppercase tracking-widest"
        >
          <Brain className="w-4 h-4" />
          The Science of Focus
        </motion.div>
        <h2 className="text-4xl font-black text-white drop-shadow-lg">The Pomodoro Technique</h2>
        <p className="text-white/80 max-w-xl mx-auto text-lg leading-relaxed">
          A time management method developed by Francesco Cirillo in the late 1980s. It uses a timer to break work into intervals, traditionally 25 minutes in length, separated by short breaks.
        </p>
      </header>

      {/* Visual Timeline */}
      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-1 bg-white/10 rounded-full hidden md:block" />
        <div className="space-y-8">
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="relative flex flex-col md:flex-row items-start md:items-center gap-6 group"
            >
              <div className={`z-10 flex-shrink-0 w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform`}>
                {step.icon}
              </div>
              <div className="flex-1 bg-white/90 backdrop-blur p-6 rounded-3xl shadow-xl border border-white/20">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Benefits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BenefitCard 
          title="Beat Procrastination" 
          text="The 25-minute goal feels achievable, making it easier to just start."
        />
        <BenefitCard 
          title="Maintain Focus" 
          text="Scheduled breaks prevent burnout and keep your mind fresh for hours."
        />
        <BenefitCard 
          title="Track Progress" 
          text="Seeing your completed 'Pomodoros' gives you a sense of accomplishment."
        />
      </div>

      <footer className="text-center pt-8">
        <div className="inline-block p-6 bg-black/20 backdrop-blur rounded-3xl border border-white/10 text-white/70 text-sm italic">
          "The Pomodoro Technique is not just about managing time, it's about managing your energy and attention."
        </div>
      </footer>
    </div>
  );
}

function BenefitCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="p-6 bg-white/10 backdrop-blur rounded-3xl border border-white/20 text-white space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        <h4 className="font-bold">{title}</h4>
      </div>
      <p className="text-sm text-white/70 leading-relaxed">{text}</p>
    </div>
  );
}
