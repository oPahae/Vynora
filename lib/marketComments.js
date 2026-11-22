import { query } from '@/lib/db';

// Les reponses aux commentaires d'annonces reposent sur la colonne marketComment.parentId
// (voir migrations/2026-market-comment-replies.sql). Si la migration n'a pas encore ete
// jouee, on l'applique une seule fois ici ; sans droit ALTER, on retombe sur le mode sans
// reponses au lieu de casser les commentaires existants.
let supportPromise = null;

export function marketRepliesSupported() {
  if (!supportPromise) {
    supportPromise = (async () => {
      try {
        const rows = await query(
          `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketComment' AND COLUMN_NAME = 'parentId'`
        );
        if (Number(rows[0]?.total) > 0) return true;
        await query('ALTER TABLE marketComment ADD COLUMN parentId INT UNSIGNED DEFAULT NULL AFTER userId');
        try {
          await query('ALTER TABLE marketComment ADD KEY idx_marketComment_parent (parentId, deletedAt)');
          await query(
            'ALTER TABLE marketComment ADD CONSTRAINT fk_marketComment_parent FOREIGN KEY (parentId) REFERENCES marketComment(id) ON DELETE CASCADE'
          );
        } catch (error) {
          // index / cle etrangere facultatifs : la colonne suffit au fonctionnement.
        }
        return true;
      } catch (error) {
        supportPromise = null;
        return false;
      }
    })();
  }
  return supportPromise;
}
