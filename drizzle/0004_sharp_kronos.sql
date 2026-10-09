CREATE TABLE `receivables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerName` varchar(180) NOT NULL,
	`phone` varchar(80),
	`description` varchar(255),
	`principal` decimal(12,2) NOT NULL DEFAULT '0',
	`paid` decimal(12,2) NOT NULL DEFAULT '0',
	`balance` decimal(12,2) NOT NULL DEFAULT '0',
	`dueDate` date,
	`status` enum('open','partial','paid','overdue') NOT NULL DEFAULT 'open',
	`notes` text,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `receivables_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `receivables_due_idx` ON `receivables` (`dueDate`);--> statement-breakpoint
CREATE INDEX `receivables_status_idx` ON `receivables` (`status`);