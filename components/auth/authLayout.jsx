import { motion } from 'framer-motion';
import { Users, MessageCircle, Radio, Heart, MessageSquare, Share2, Sparkles, Flame } from 'lucide-react';
import Logomark from '@/components/shared/logomark';
import Tilt from '@/components/shared/tilt';
import { APP_NAME } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
import LanguageSwitcher from '@/components/shared/languageSwitcher';

const features = [
  { icon: Users, get label() { return t("Retrouvez vos amis et votre communaute"); } },
  { icon: MessageCircle, get label() { return t("Messagerie instantanee et fluide"); } },
  { icon: Radio, get label() { return t("Stories, reactions et notifications en direct"); } }
];

// Constellation : le reseau qui donne son nom au produit. Chaque noeud est une personne.
const NODES = [
  { x: 70, y: 70, r: 9, c: '#FFFFFF' },
  { x: 250, y: 40, r: 6, c: '#FFC857' },
  { x: 410, y: 130, r: 11, c: '#BBCCFB' },
  { x: 150, y: 200, r: 7, c: '#FF8FA3' },
  { x: 330, y: 270, r: 8, c: '#7BE8B0' },
  { x: 60, y: 330, r: 6, c: '#FFFFFF' }
];
const LINKS = [[0, 1], [1, 2], [1, 3], [3, 5], [2, 4], [3, 4], [0, 3]];

function Constellation() {
  return (
    <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 470 380" preserveAspectRatio="xMidYMid meet" aria-hidden>
      {LINKS.map(([a, b], index) => (
        <motion.line
          key={`${a}-${b}`}
          x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y}
          stroke="rgba(255,255,255,0.25)" strokeWidth="1"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, delay: 0.4 + index * 0.12, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
      {NODES.map((n, i) => (
        <g key={i}>
          <motion.circle
            cx={n.x} cy={n.y} r={n.r * 2.6} fill={n.c} opacity="0.18"
            initial={{ scale: 0 }} animate={{ scale: [1, 1.18, 1] }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
            transition={{ scale: { duration: 4 + i * 0.7, delay: 1 + i * 0.2, repeat: Infinity, ease: 'easeInOut' } }}
          />
          <motion.circle
            cx={n.x} cy={n.y} r={n.r} fill={n.c}
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.2 + i * 0.1 }}
          />
        </g>
      ))}
    </svg>
  );
}

const glassCard = 'bg-white/[0.12] ring-1 ring-white/20';

// Scene 3D : trois surfaces de verre a des profondeurs differentes. Quand le
// curseur bouge, l'ensemble pivote et les couches se decalent en parallaxe.
// Aucun texte : le produit se montre sans rien a traduire.
function Scene() {
  return (
    <Tilt max={9} glare={false} className="w-[20rem] xl:w-[22rem]">
      {/* Couche 0 : la publication */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className={`rounded-3xl p-4 ${glassCard}`}
        aria-hidden
      >
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-lumen-400" />
          <div className="space-y-1.5 flex-1">
            <div className="h-2.5 w-24 rounded-full bg-white/70" />
            <div className="h-2 w-14 rounded-full bg-white/25" />
          </div>
        </div>
        <div className="mt-3.5 space-y-2">
          <div className="h-2 w-full rounded-full bg-white/30" />
          <div className="h-2 w-4/5 rounded-full bg-white/30" />
        </div>
        <div className="mt-3.5 h-32 rounded-2xl relative overflow-hidden bg-[#FFC857]">
          <span className="absolute -bottom-10 -start-6 w-40 h-40 rounded-full bg-[#1F3FB3]/60" />
          <span className="absolute -bottom-14 end-2 w-36 h-36 rounded-full bg-[#3D63E8]/70" />
          <span className="absolute top-4 end-6 w-7 h-7 rounded-full bg-white" />
        </div>
        <div className="mt-3.5 flex items-center gap-4 text-white/70">
          <span className="flex items-center gap-1.5 text-xs font-medium"><Heart size={15} className="text-[#FF7489]" fill="currentColor" />128</span>
          <span className="flex items-center gap-1.5 text-xs font-medium"><MessageSquare size={15} />24</span>
          <Share2 size={15} className="ms-auto" />
        </div>
      </motion.div>

      {/* Couche +60 : une conversation qui s'ecrit */}
      <motion.div
        initial={{ opacity: 0, x: -20, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.9, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="absolute -bottom-8 -start-10 xl:-start-16"
        style={{ z: 70 }}
        aria-hidden
      >
        <div className={`animate-float rounded-2xl rounded-es-md px-3.5 py-3 ${glassCard}`} style={{ animationDelay: '-2s' }}>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((dot) => (
              <motion.span
                key={dot}
                className="w-1.5 h-1.5 rounded-full bg-[#DDF6FB]"
                animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: dot * 0.15, ease: 'easeInOut' }}
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Couche +110 : reactions en suspension */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 1.5 }}
        className="absolute -top-5 -end-6 xl:-end-10"
        style={{ z: 110 }}
        aria-hidden
      >
        <div className={`animate-float flex items-center gap-1 rounded-full px-2 py-1.5 ${glassCard}`} style={{ animationDelay: '-4s' }}>
          <span className="w-7 h-7 rounded-full bg-[#EF4F6B] flex items-center justify-center "><Heart size={13} className="text-white" fill="currentColor" /></span>
          <span className="w-7 h-7 rounded-full bg-[#FFB38A] flex items-center justify-center "><Flame size={13} className="text-white" fill="currentColor" /></span>
          <span className="w-7 h-7 rounded-full bg-[#7C9BFF] flex items-center justify-center "><Sparkles size={13} className="text-white" /></span>
        </div>
      </motion.div>
    </Tilt>
  );
}

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen w-full flex">
      {/* Panneau d'identite (desktop) : aplat cobalt */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-1/2 relative overflow-hidden text-white bg-[#2F52D4]">
        <div className="absolute -top-40 -start-32 w-[34rem] h-[34rem] rounded-full bg-white/[0.07] animate-drift-a" />
        <div className="absolute -bottom-48 -end-24 w-[30rem] h-[30rem] rounded-full bg-[#1F3FB3]/60 animate-drift-b" />
        <div className="absolute top-1/2 start-1/3 w-24 h-24 rounded-full bg-[#FFC857]/90 animate-drift-c" />
        <div className="absolute inset-x-8 top-[6%] h-[40%] opacity-60"><Constellation /></div>

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <Logomark size={40} />
            <span className="font-display text-2xl font-bold tracking-tight">{APP_NAME}</span>
          </motion.div>

          <div className="flex items-center justify-center mt-2 mb-16 xl:pe-4">
            <Scene />
          </div>

          <div className="space-y-7">
            <motion.h1
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-4xl xl:text-[2.9rem] font-semibold leading-[1.06] tracking-[-0.035em] max-w-md text-balance"
            >{t("Un espace pour rester connecte a l'essentiel.")}</motion.h1>
            <ul className="space-y-3.5">
              {features.map((feature, index) => (
                <motion.li
                  key={feature.label}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-3 text-white/75 text-[0.95rem]"
                >
                  <span className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
                    <feature.icon size={16} />
                  </span>
                  {feature.label}
                </motion.li>
              ))}
            </ul>
            <p className="text-white/40 text-xs">{t("© 2026 {APP_NAME}. Tous droits reserves.", { APP_NAME })}</p>
          </div>
        </div>
      </div>

      {/* Formulaire : directement sur le canevas, sans carte superflue */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-5 sm:px-8 py-14 pt-safe pb-safe">
        <div className="absolute top-4 end-4 z-20 pt-safe"><LanguageSwitcher /></div>
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[26rem]"
        >
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <Logomark size={40} />
            <span className="font-display text-xl font-bold tracking-tight text-slate-900">{APP_NAME}</span>
          </div>

          <div className="mb-8">
            <h2 className="font-display text-[1.95rem] sm:text-[2.2rem] font-semibold text-slate-900 leading-[1.1] tracking-[-0.03em] text-balance">{title}</h2>
            <p className="text-slate-500 text-[0.95rem] mt-2.5 leading-relaxed text-pretty">{subtitle}</p>
          </div>
          {children}
        </motion.div>
      </div>
    </div>
  );
}
