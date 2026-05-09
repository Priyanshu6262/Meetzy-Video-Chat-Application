import { motion } from 'framer-motion';
import { Video, MessageSquare, ScreenShare, ShieldCheck, Users, Zap } from 'lucide-react';

const features = [
  {
    icon: <Video className="w-8 h-8" />,
    title: "HD Video Calls",
    description: "Crystal clear video and audio quality even on slower connections."
  },
  {
    icon: <MessageSquare className="w-8 h-8" />,
    title: "Real-time Chat",
    description: "Send messages, files, and emojis instantly during your meetings."
  },
  {
    icon: <ScreenShare className="w-8 h-8" />,
    title: "Screen Sharing",
    description: "Share your screen with high frame rates for presentations or coding."
  },
  {
    icon: <ShieldCheck className="w-8 h-8" />,
    title: "End-to-End Encryption",
    description: "Your conversations are private and secure with top-tier encryption."
  },
  {
    icon: <Users className="w-8 h-8" />,
    title: "Group Meetings",
    description: "Host up to 500 participants without any lag or quality drop."
  },
  {
    icon: <Zap className="w-8 h-8" />,
    title: "Instant Connection",
    description: "No downloads required. Join via a simple link in your browser."
  }
];

const Features = () => {
  return (
    <section id="features" className="py-24 bg-slate-50 dark:bg-slate-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            Powerful features for teams
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Everything you need to collaborate effectively with your team, no matter where they are located.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="p-8 bg-white dark:bg-slate-950 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-all hover:shadow-xl hover:shadow-indigo-500/5 group"
            >
              <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
