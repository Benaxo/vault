import React, { useEffect, useState } from "react";

// ParallaxDivider composant local
const ParallaxDivider = () => (
  <div
    className="relative w-full overflow-hidden leading-none"
    style={{ height: "60px" }}
  >
    <svg
      className="absolute top-0 left-0 w-full h-full"
      viewBox="0 0 1440 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <path
        d="M0 0C360 60 1080 0 1440 60V60H0V0Z"
        fill="url(#parallax-gradient)"
      />
      <defs>
        <linearGradient
          id="parallax-gradient"
          x1="0"
          y1="0"
          x2="1440"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#06b6d4" />
          <stop offset="1" stopColor="#a21caf" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

const Hero = ({ setShowHero }) => {
  const [expanded, setExpanded] = useState(false);
  const [parallaxOffset, setParallaxOffset] = useState(0);

  // Parallax scroll effect for the hero image
  useEffect(() => {
    const handleScroll = () => {
      // Limite l'effet à la première section (par exemple, 0 à 500px de scroll)
      const scrollY = window.scrollY;
      const max = 100;
      setParallaxOffset(Math.min(scrollY * 0.4, max));
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
    <div className="">
      {/* Section principale */}
      <section className="py-12 bg-black sm:pb-16 lg:pb-20 xl:pb-24">
        <div className="px-4 mx-auto sm:px-6 lg:px-8 max-w-7xl">
          <div className="relative">
            <div className="lg:w-2/3">
              <h1 className="mt-6 text-4xl font-normal text-white sm:mt-10 sm:text-5xl lg:text-6xl xl:text-8xl">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-purple-500">
                  Investissez simplement
                </span>{" "}
              </h1>
              <p className="max-w-lg mt-4 text-xl font-normal text-gray-400 sm:mt-8">
                Surfer sur le marché crypto de manière simple et sécurisée avec
                notre application.
              </p>
              <div className="relative inline-flex items-center justify-center mt-8 sm:mt-12 group">
                <div className="absolute transition-all duration-200 rounded-full -inset-px bg-gradient-to-r from-cyan-500 to-purple-500 group-hover:shadow-lg group-hover:shadow-cyan-500/50"></div>
                <a
                  href="#"
                  title=""
                  className="relative inline-flex items-center justify-center px-8 py-3 text-base font-normal text-white bg-black border border-transparent rounded-full"
                  role="button"
                  onClick={() => setShowHero(false)}
                >
                  Commencer l'expérience
                </a>
              </div>

              <div>
                <div className="inline-flex items-center pt-6 mt-8 border-t border-gray-800 sm:pt-10 sm:mt-14">
                  <svg
                    className="w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth="1.5"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M13 7.00003H21M21 7.00003V15M21 7.00003L13 15L9 11L3 17"
                      stroke="url(#a)"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <defs>
                      <linearGradient
                        id="a"
                        x1="3"
                        y1="7.00003"
                        x2="22.2956"
                        y2="12.0274"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop
                          offset="0%"
                          style={{ stopColor: "var(--color-cyan-500)" }}
                        />
                        <stop
                          offset="100%"
                          style={{ stopColor: "var(--color-purple-500)" }}
                        />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
            </div>

            <div className="mt-8 md:absolute md:mt-0 md:top-32 lg:top-0 md:right-0">
              <img
                className="w-full max-w-xs mx-auto lg:max-w-lg xl:max-w-xl"
                src="https://landingfoliocom.imgix.net/store/collection/dusk/images/hero/1/3d-illustration.png"
                alt=""
                style={{
                  transform: `translateY(${parallaxOffset}px)`,
                  transition: "transform 0.1s linear",
                  willChange: "transform",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Parallax Divider */}
      <ParallaxDivider />

      {/* Section Avis */}
      <section className="bg-black py-12">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Ils nous font confiance
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Avis 1 */}
            <div className="bg-gray-900 rounded-xl p-6 flex flex-col items-center shadow-lg">
              <img
                src="https://randomuser.me/api/portraits/men/32.jpg"
                alt="avatar"
                className="w-16 h-16 rounded-full mb-4"
              />
              <h3 className="text-lg font-semibold text-white mb-2">
                Lucas M.
              </h3>
              <p className="text-gray-300 text-center mb-3">
                "Interface intuitive, j'ai pu économiser sans stress. Je
                recommande !"
              </p>
              <div className="flex space-x-1">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-yellow-400">
                    ★
                  </span>
                ))}
              </div>
            </div>
            {/* Avis 2 */}
            <div className="bg-gray-900 rounded-xl p-6 flex flex-col items-center shadow-lg">
              <img
                src="https://randomuser.me/api/portraits/women/44.jpg"
                alt="avatar"
                className="w-16 h-16 rounded-full mb-4"
              />
              <h3 className="text-lg font-semibold text-white mb-2">
                Sophie L.
              </h3>
              <p className="text-gray-300 text-center mb-3">
                "La sécurité avant tout, et des objectifs clairs. Parfait pour
                débuter dans la crypto !"
              </p>
              <div className="flex space-x-1">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-yellow-400">
                    ★
                  </span>
                ))}
              </div>
            </div>
            {/* Avis 3 */}
            <div className="bg-gray-900 rounded-xl p-6 flex flex-col items-center shadow-lg">
              <img
                src="https://randomuser.me/api/portraits/men/65.jpg"
                alt="avatar"
                className="w-16 h-16 rounded-full mb-4"
              />
              <h3 className="text-lg font-semibold text-white mb-2">
                Yanis D.
              </h3>
              <p className="text-gray-300 text-center mb-3">
                "J'adore suivre ma progression, l'app est motivante et simple
                d'utilisation."
              </p>
              <div className="flex space-x-1">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-yellow-400">
                    ★
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Parallax Divider */}
      <ParallaxDivider />

      {/* Section Communauté */}
      <section className="bg-black py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-5xl font-bold text-white text-center mb-4">
            Community
          </h2>
          <p className="text-xl text-gray-300 text-center mb-12">
            Get involved in our community. Everyone is welcome!
          </p>
          <div className="flex flex-col md:flex-row gap-8 justify-center items-center">
            {/* X */}
            <div className="bg-gray-900 rounded-2xl p-8 flex-1 min-w-[260px] max-w-sm flex flex-col items-start shadow-lg">
              <div className="flex items-center mb-3">
                <img
                  src="/X_logo_2023_(white).png"
                  alt="X logo"
                  className="h-8 w-8 mr-2"
                />
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-gray-400 hover:text-white"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 inline"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M18 8l4 4m0 0l-4 4m4-4H2"
                    />
                  </svg>
                </a>
              </div>
              <p className="text-gray-300">
                For announcements, tips and general information.
              </p>
            </div>
            {/* Discord */}
            <div className="bg-gray-900 rounded-2xl p-8 flex-1 min-w-[260px] max-w-sm flex flex-col items-start shadow-lg">
              <div className="flex items-center mb-3">
                <img
                  src="/Discord_Logo_sans_texte.svg.png"
                  alt="Discord logo"
                  className="h-8 w-8 mr-2"
                />
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-gray-400 hover:text-white"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 inline"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M18 8l4 4m0 0l-4 4m4-4H2"
                    />
                  </svg>
                </a>
              </div>
              <p className="text-gray-300">
                To get involved in the community, ask questions and share tips.
              </p>
            </div>
            {/* Github */}
            <div className="bg-gray-900 rounded-2xl p-8 flex-1 min-w-[260px] max-w-sm flex flex-col items-start shadow-lg">
              <div className="flex items-center mb-3">
                <svg className="h-7 w-7 mr-2" fill="white" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.157-1.11-1.465-1.11-1.465-.908-.62.069-.608.069-.608 1.004.07 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.091-.647.35-1.088.636-1.339-2.221-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.295 2.748-1.025 2.748-1.025.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.847-2.337 4.695-4.566 4.944.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.578.688.48C19.138 20.2 22 16.447 22 12.021 22 6.484 17.523 2 12 2z" />
                </svg>
                <span className="font-semibold text-white text-lg mr-2">
                  Github
                </span>
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-gray-400 hover:text-white"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 inline"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M18 8l4 4m0 0l-4 4m4-4H2"
                    />
                  </svg>
                </a>
              </div>
              <p className="text-gray-300">
                To report bugs, request features and contribute to the project.
              </p>
            </div>
          </div>
          <div className="text-center text-gray-500 mt-12 text-sm">
            © 2025 PiggyBank Vault. All rights reserved.
          </div>
        </div>
      </section>
    </div>
  );
};

export default Hero;
