-- Reponses aux commentaires des annonces de la marketplace.
-- Ne supprime rien. (L'API applique aussi cette migration toute seule au premier
-- appel si la colonne manque et que l'utilisateur MySQL a le droit ALTER.)
ALTER TABLE marketComment
  ADD COLUMN parentId INT UNSIGNED DEFAULT NULL AFTER userId,
  ADD KEY idx_marketComment_parent (parentId, deletedAt),
  ADD CONSTRAINT fk_marketComment_parent FOREIGN KEY (parentId) REFERENCES marketComment(id) ON DELETE CASCADE;
