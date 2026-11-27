ALTER TABLE `loans` ADD COLUMN IF NOT EXISTS `interestPeriod` enum('daily','monthly','weekly') NOT NULL DEFAULT 'monthly';--> statement-breakpoint
ALTER TABLE `loans` ADD COLUMN IF NOT EXISTS `interestUnit` varchar(16) DEFAULT 'percent' NOT NULL;
