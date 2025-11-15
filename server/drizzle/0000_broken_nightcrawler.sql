CREATE TYPE "public"."transaction_types" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rate" (
	"id" text PRIMARY KEY NOT NULL,
	"currency" char(3) NOT NULL,
	"rate" numeric(20, 10) NOT NULL,
	"source_id" text NOT NULL,
	CONSTRAINT "exchange_rate_currency_source_id_unique" UNIQUE("currency","source_id"),
	CONSTRAINT "rate_entry" UNIQUE("currency","source_id")
);
--> statement-breakpoint
CREATE TABLE "exchange_rate_source" (
	"id" text PRIMARY KEY NOT NULL,
	"sourceDate" date NOT NULL,
	"base_currency" char(3) NOT NULL,
	CONSTRAINT "exchange_rate_source_sourceDate_base_currency_unique" UNIQUE("sourceDate","base_currency"),
	CONSTRAINT "source_entry" UNIQUE("sourceDate","base_currency")
);
--> statement-breakpoint
CREATE TABLE "portfolio" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_transaction" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"transaction_type" "transaction_types" NOT NULL,
	"transaction_date" date NOT NULL,
	"amount" numeric(20, 10) NOT NULL,
	"purchase_price" numeric(20, 10) NOT NULL,
	"purchase_price_currency" char(3) NOT NULL,
	"ticker_id" text NOT NULL,
	"portfolio_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_info" (
	"id" text PRIMARY KEY NOT NULL,
	"currency" char(3) NOT NULL,
	"timestamp" timestamp NOT NULL,
	"rate" numeric(20, 10) NOT NULL,
	"ticker_id" text NOT NULL,
	CONSTRAINT "stock_info_ticker_id_timestamp_unique" UNIQUE("ticker_id","timestamp"),
	CONSTRAINT "entry" UNIQUE("ticker_id","timestamp")
);
--> statement-breakpoint
CREATE TABLE "stock_ticker" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"isin" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "stock_ticker_isin_unique" UNIQUE("isin"),
	CONSTRAINT "stock_ticker_isin_symbol_unique" UNIQUE("isin","symbol"),
	CONSTRAINT "mapping" UNIQUE("isin","symbol")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rate" ADD CONSTRAINT "exchange_rate_source_id_exchange_rate_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."exchange_rate_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio" ADD CONSTRAINT "portfolio_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_transaction" ADD CONSTRAINT "portfolio_transaction_ticker_id_stock_ticker_id_fk" FOREIGN KEY ("ticker_id") REFERENCES "public"."stock_ticker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_transaction" ADD CONSTRAINT "portfolio_transaction_portfolio_id_portfolio_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_info" ADD CONSTRAINT "stock_info_ticker_id_stock_ticker_id_fk" FOREIGN KEY ("ticker_id") REFERENCES "public"."stock_ticker"("id") ON DELETE cascade ON UPDATE no action;