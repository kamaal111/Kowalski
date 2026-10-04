CREATE TABLE "stock_price_history_coverage" (
	"ticker_id" text,
	"start_date" date,
	"end_date" date NOT NULL,
	CONSTRAINT "stock_price_history_coverage_pkey" PRIMARY KEY("ticker_id","start_date"),
	CONSTRAINT "stock_price_history_coverage_order" CHECK ("start_date" <= "end_date")
);
--> statement-breakpoint
ALTER TABLE "stock_price_history_coverage" ADD CONSTRAINT "stock_price_history_coverage_ticker_id_stock_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "stock_ticker"("id") ON DELETE CASCADE;