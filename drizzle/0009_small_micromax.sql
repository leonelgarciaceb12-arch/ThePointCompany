ALTER TABLE `loans` ADD COLUMN IF NOT EXISTS `interestBase` varchar(24) DEFAULT 'initial_principal' NOT NULL;
