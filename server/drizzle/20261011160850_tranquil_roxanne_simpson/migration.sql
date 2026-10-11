DROP INDEX "account_issuer_account_id_unique";--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" DROP NOT NULL;