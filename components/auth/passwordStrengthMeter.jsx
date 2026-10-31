import { motion, AnimatePresence } from 'framer-motion';
import { Check, Circle } from 'lucide-react';
import { evaluatePassword } from '@/lib/passwordStrength';

import { t } from '@/lib/i18n/runtime';

// Barre de progression animee, mise a jour en temps reel pendant la saisie.
export default function PasswordStrengthMeter({ password, className = '' }) {
  const result = evaluatePassword(password);

  const rules = [
    { ok: result.checks.length, label: t("8 caracteres minimum") },
    { ok: result.checks.long, label: t("12 caracteres ou plus") },
    { ok: result.checks.mixedCase, label: t("Majuscules et minuscules") },
    { ok: result.checks.digit, label: t("Un chiffre") },
    { ok: result.checks.symbol, label: t("Un symbole (!@#...)") }
  ];

  return (
    <AnimatePresence initial={false}>
      {password && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className={`overflow-hidden ${className}`}
          aria-live="polite"
        >
          <div className="pt-1">
            <div className="flex items-center gap-3">
              <div
                className="relative flex-1 h-2 rounded-full bg-slate-200/80 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={result.percent}
                aria-label={t("Force du mot de passe")}
              >
                <motion.div
                  className="absolute inset-y-0 start-0 rounded-full"
                  initial={false}
                  animate={{ width: `${result.percent}%`, backgroundColor: result.level.color }}
                  transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                />
                {/* reflet qui balaie la barre */}
                <motion.div
                  key={result.score}
                  className="absolute inset-y-0 w-10 bg-white/40 blur-[2px]"
                  initial={{ x: '-40px' }}
                  animate={{ x: '320px' }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                />
              </div>
              <motion.span
                key={result.level.label}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs font-semibold w-20 text-end"
                style={{ color: result.level.color }}
              >
                {t(result.level.label)}
              </motion.span>
            </div>

            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2.5">
              {rules.map((rule) => (
                <li key={rule.label} className={`flex items-center gap-1.5 text-xs transition-colors ${rule.ok ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {rule.ok ? <Check size={12} strokeWidth={3} /> : <Circle size={10} />}
                  {rule.label}
                </li>
              ))}
            </ul>
            {(result.weakPattern || result.hasSequence) && (
              <p className="text-xs text-amber-600 mt-2">{t("Evitez les mots de passe courants, les repetitions et les suites (1234, abcd).")}</p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
