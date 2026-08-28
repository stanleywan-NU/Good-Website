"use client";

import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-center gap-3 text-center"
      >
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
          Stanley
        </h1>
        <p className="max-w-md text-lg text-zinc-500">
          Portfolio scaffold is live — Next.js, Tailwind, and Framer Motion
          are all wired up. Real design starts next.
        </p>
      </motion.div>
    </div>
  );
}
