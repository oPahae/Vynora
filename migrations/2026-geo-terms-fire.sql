-- Localisation (gens proches), acceptation des termes et conditions.
-- Ne supprime rien. A executer une seule fois (voir README, section Base de donnees).
-- Le niveau de fire est calcule a partir de la table `reaction` existante :
-- aucune colonne supplementaire n'est necessaire.
ALTER TABLE user
  ADD COLUMN location VARCHAR(150) DEFAULT NULL AFTER country,
  ADD COLUMN latitude DECIMAL(9,6) DEFAULT NULL AFTER location,
  ADD COLUMN longitude DECIMAL(9,6) DEFAULT NULL AFTER latitude,
  ADD COLUMN termsAcceptedAt DATETIME DEFAULT NULL AFTER showReadReceipts,
  ADD COLUMN termsVersion VARCHAR(20) DEFAULT NULL AFTER termsAcceptedAt,
  ADD KEY idx_user_geo (latitude, longitude);

-- Aide au calcul du niveau de fire (reactions donnees sur les 30 derniers jours).
ALTER TABLE reaction ADD KEY idx_reaction_user_date (userId, createdAt);
