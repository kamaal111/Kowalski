CREATE TABLE "exchange_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"base" char(3) NOT NULL,
	"rates" jsonb NOT NULL,
	CONSTRAINT "exchange_rates_base_date_unique" UNIQUE("base","date"),
	CONSTRAINT "exchange_rate_entry" UNIQUE("base","date")
);
