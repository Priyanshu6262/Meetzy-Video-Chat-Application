import { motion } from 'framer-motion';

const steps = [
  {
    number: "01",
    title: "Create a Room",
    description: "Start a new meeting with one click and get a unique link."
  },
  {
    number: "02",
    title: "Invite People",
    description: "Share the link with your colleagues, friends, or family."
  },
  {
    number: "03",
    title: "Start Collaboration",
    description: "Talk, chat, and share your screen in a secure environment."
  }
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            Simple and easy to use
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Get your meeting started in seconds. No complex setup or technical knowledge required.
          </p>
        </div>

        <div className="relative">
          {/* Connecting Line (Desktop) */}
          <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 -z-10"></div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-white dark:bg-slate-950 text-indigo-600 border-4 border-indigo-50 dark:border-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-8 text-2xl font-black shadow-xl">
                  {step.number}
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                  {step.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};

export default HowItWorks;
