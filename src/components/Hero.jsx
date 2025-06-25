import { motion } from "framer-motion";
import React from "react";

const Hero = ({ setShowHero }) => {
  const stats = [
    { value: "100+", label: "Active Savers" },
    { value: "500+", label: "ETH Saved" },
    { value: "85%", label: "Goal Completion" },
  ];

  const features = [
    {
      icon: "🔒",
      title: "Locked Savings",
      description: "Your funds are locked until you reach your goals",
    },
    {
      icon: "🎯",
      title: "Smart Goals",
      description: "Set amount or time-based goals for your savings",
    },
    {
      icon: "📈",
      title: "Track Progress",
      description: "Visualize your journey to financial freedom",
    },
  ];

  return (
    <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 text-white rounded-xl shadow-2xl overflow-hidden">
      <div className="container mx-auto px-6 py-16 md:py-24">
        {/* Main Content */}
        <div className="md:flex md:items-center md:space-x-12">
          {/* Left Column - Text Content */}
          <div className="md:w-1/2 mb-12 md:mb-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
                Your Digital
                <span className="block text-yellow-300">Piggy Bank</span>
              </h1>
              <p className="text-xl md:text-2xl mb-8 opacity-90 leading-relaxed">
                Transform your savings habits with blockchain technology. Set
                goals, lock funds, and watch your wealth grow.
              </p>

              {/* Storytelling Section */}
              <div className="bg-white bg-opacity-10 rounded-lg p-6 mb-8 backdrop-blur-sm">
                <h3 className="text-xl font-semibold mb-3">Imagine this...</h3>
                <p className="opacity-90">
                  You want to save for that dream vacation, but temptation
                  always wins. With PiggyBank Vault, your savings are locked
                  until you reach your goal. No more impulse spending, just
                  steady progress towards your dreams.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-yellow-400 text-blue-900 font-bold py-4 px-8 rounded-full hover:bg-yellow-300 transition-colors shadow-lg"
                  onClick={() => setShowHero(false)}
                >
                  Start Your Journey
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-transparent border-2 border-white font-bold py-4 px-8 rounded-full hover:bg-white hover:bg-opacity-10 transition-all"
                >
                  Learn More
                </motion.button>
              </div>
            </motion.div>
          </div>

          {/* Right Column - Visual Elements */}
          <div className="md:w-1/2">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              {/* Animated Piggy Bank */}
              <div className="relative w-96 h-96 mx-auto">
                <motion.div
                  animate={{
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full shadow-2xl flex items-center justify-center"
                >
                  <span className="text-8xl">🐷</span>
                </motion.div>

                {/* Floating Coins */}
                <motion.div
                  animate={{
                    y: [0, -20, 0],
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute top-0 right-0 text-4xl"
                >
                  💰
                </motion.div>
                <motion.div
                  animate={{
                    y: [0, -15, 0],
                    rotate: [0, -360],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute bottom-0 left-0 text-4xl"
                >
                  💎
                </motion.div>
              </div>

              {/* Stats Section */}
              <div className="grid grid-cols-3 gap-4 mt-8">
                {stats.map((stat, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.2 }}
                    className="bg-white bg-opacity-10 rounded-lg p-4 text-center backdrop-blur-sm"
                  >
                    <div className="text-2xl font-bold text-yellow-300">
                      {stat.value}
                    </div>
                    <div className="text-sm opacity-80">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Features Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid md:grid-cols-3 gap-6 mt-16"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              whileHover={{ scale: 1.05 }}
              className="bg-white bg-opacity-10 rounded-lg p-6 backdrop-blur-sm"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="opacity-80">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default Hero;
