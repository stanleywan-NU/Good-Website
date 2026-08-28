"use client";

import { motion } from "framer-motion";

const projects = [
  {
    name: "rising team",
    category: "product design",
    icon: (
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <path
          d="M10 48V32M26 48V20M42 48V28M58 48V12"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    name: "borderx lab — beyondstyle",
    category: "content strategy & geo",
    icon: (
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <path
          d="M22 10h20l6 10-18 34-18-34z"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M28 10l4 8 4-8"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-black">
      <nav className="flex items-center justify-between border-b-[3px] border-black px-8 py-9 sm:px-16">
        <span className="text-xl font-bold tracking-tight">stanley wan</span>
        <div className="flex gap-10 text-sm font-medium">
          <a href="#work" className="hover:text-zinc-500">
            work
          </a>
          <a href="#about" className="hover:text-zinc-500">
            about
          </a>
          <a href="#contact" className="hover:text-zinc-500">
            contact
          </a>
        </div>
      </nav>

      <header className="relative overflow-hidden bg-black px-8 py-20 sm:px-16 sm:py-24">
        <svg
          className="pointer-events-none absolute -right-32 -bottom-32"
          width="480"
          height="480"
          viewBox="0 0 480 480"
          fill="none"
        >
          <circle cx="240" cy="240" r="236" stroke="#fff" strokeWidth="3" />
          <circle cx="240" cy="240" r="176" stroke="#fff" strokeWidth="3" />
        </svg>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative flex flex-col gap-6"
        >
          <span className="text-sm font-medium text-zinc-400">
            product design &amp; content strategy
          </span>
          <h1 className="max-w-4xl text-6xl leading-[0.96] font-bold tracking-tight text-white sm:text-7xl lg:text-8xl">
            product design.
            <br />
            content strategy.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed font-medium text-zinc-300 sm:text-xl">
            building at rising team and borderx lab&apos;s beyondstyle — one
            person shaping both the product and the story around it.
          </p>
          <a
            href="#work"
            className="mt-2 inline-flex w-fit items-center gap-2 border-[3px] border-white px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-white hover:text-black"
          >
            view selected work
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </a>
        </motion.div>
      </header>

      <section
        id="work"
        className="grid grid-cols-1 gap-6 px-8 py-14 sm:grid-cols-3 sm:px-16 sm:py-16"
      >
        {projects.map((project) => (
          <div key={project.name} className="group flex flex-col gap-4">
            <div className="flex aspect-4/3 items-center justify-center border-[3px] border-black text-black transition-opacity group-hover:opacity-80">
              {project.icon}
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold">{project.name}</span>
              <span className="text-sm font-medium text-zinc-500">
                {project.category}
              </span>
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-4">
          <div className="flex aspect-4/3 items-center justify-center border-[3px] border-dashed border-zinc-400">
            <span className="text-xs font-medium text-zinc-400">
              [ more case studies soon ]
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-zinc-400">
              coming soon
            </span>
            <span className="text-sm text-zinc-300">&nbsp;</span>
          </div>
        </div>
      </section>
    </div>
  );
}
